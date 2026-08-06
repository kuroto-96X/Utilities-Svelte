# ペア役・交互パターンの追加 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shidasuに新規役「ペア」(チェーン全体で同ランク組が2組以上成立で加点)と新規パターン「交互」(チェーン内が赤黒4枚以上交互で加点)を追加する。

**Architecture:** `RoleName`型に`'pair'`・`'alternating'`を追加し、`scoring`パラメータ・`ROLE_LIST`・`roleBasePoint`・`ORACLE_ACTUAL_EFFECTS`・`defaultOracleLevels`を型エラーが解消するまで拡張する(Task 1)。その後`patterns.ts`の`evaluateChainBonus`に交互パターン(Task 2)・ペア役(Task 3)の判定ロジックを追加する。`ORACLE_POOL`(神託として実際に入手できる対象)への追加は今回のスコープ外。

**Tech Stack:** SvelteKit, Svelte 5 runes, TypeScript, Vitest

---

### Task 1: RoleName型の拡張とパラメータ基盤の追加

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`
- Modify: `src/lib/game/shidasu/params.ts`
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Modify: `src/lib/game/shidasu/roles.ts`
- Modify: `src/lib/game/shidasu/oracleActualEffects.ts`
- Modify: `src/lib/game/shidasu/oracles.ts`

この計画は`RoleName`型を拡張することで、`Record<RoleName, ...>`型を使っている複数箇所(`ORACLE_ACTUAL_EFFECTS`、`roleBasePoint`のswitch文)が自動的にコンパイルエラーになる設計を利用する。エラーが出なくなるまで1つずつ実装していくことで、実装漏れを防ぐ。

**注記(YAGNI判断)**: `params.oracles`型(神託の名前・説明文、8卦モチーフ)への`pair`・`alternating`追加は今回含めない。この型は`Record<RoleName, ...>`ではなく個別フィールド列挙型で、`ORACLE_POOL`(今回のスコープ外)に含まれない役については実際には参照されないため、今追加しても使われないコードになる。`ORACLE_POOL`に追加する際にまとめて追加する。

- [ ] **Step 1: RoleName型に新しい役を追加する**

`src/lib/game/shidasu/types.ts`37行目を以下のように変更する。

変更前:
```ts
export type RoleName = 'flush' | 'royalSet' | 'sameRank' | 'completeRun' | 'columnSweep' | 'suit' | 'color' | 'stair'
```

変更後:
```ts
export type RoleName = 'flush' | 'royalSet' | 'sameRank' | 'completeRun' | 'columnSweep' | 'suit' | 'color' | 'stair' | 'pair' | 'alternating'
```

- [ ] **Step 2: 型チェックを実行し、エラー箇所を確認する**

Run: `npm run check`
Expected: `oracleActualEffects.ts`の`ORACLE_ACTUAL_EFFECTS`(`Record<RoleName, string>`)、`oracles.ts`の`defaultOracleLevels()`の戻り値オブジェクトリテラル、`roles.ts`の`roleBasePoint`のswitch文(すべてのケースを網羅していないため`function lacks ending return statement`または同様のエラー)でコンパイルエラーが出る

- [ ] **Step 3: scoringパラメータにpair・alternating用の値を追加する**

`src/lib/game/shidasu/params.ts`10〜26行目の`scoring`型を以下のように変更する。

変更前:
```ts
  scoring: {
    basePoint: number
    suitBonus: number
    colorBonus: number
    suitColorMinLen: number
    stairBonus: number
    stairMinLen: number
    clearBonus: number
    clearBonusPerStock: number
    comboMultiplierStep: number
    flushBonus: number
    royalSetBonus: number
    sameRankBonusUnit: number
    completeRunBonus: number
    completeRunSuitBonus: number
    columnSweepBonus: number
  }
```

変更後:
```ts
  scoring: {
    basePoint: number
    suitBonus: number
    colorBonus: number
    suitColorMinLen: number
    stairBonus: number
    stairMinLen: number
    clearBonus: number
    clearBonusPerStock: number
    comboMultiplierStep: number
    flushBonus: number
    royalSetBonus: number
    sameRankBonusUnit: number
    completeRunBonus: number
    completeRunSuitBonus: number
    columnSweepBonus: number
    pairBonusUnit: number
    alternatingBonus: number
    alternatingMinLen: number
  }
```

`src/lib/game/shidasu/shidasu.config.json`6〜22行目の`scoring`セクションを以下のように変更する。

変更前:
```json
  "scoring": {
    "basePoint": 100,
    "suitBonus": 100,
    "colorBonus": 50,
    "suitColorMinLen": 3,
    "stairBonus": 150,
    "stairMinLen": 3,
    "clearBonus": 2000,
    "clearBonusPerStock": 50,
    "comboMultiplierStep": 0.1,
    "flushBonus": 300,
    "royalSetBonus": 400,
    "sameRankBonusUnit": 100,
    "completeRunBonus": 1000,
    "completeRunSuitBonus": 1000,
    "columnSweepBonus": 500
  },
```

変更後:
```json
  "scoring": {
    "basePoint": 100,
    "suitBonus": 100,
    "colorBonus": 50,
    "suitColorMinLen": 3,
    "stairBonus": 150,
    "stairMinLen": 3,
    "clearBonus": 2000,
    "clearBonusPerStock": 50,
    "comboMultiplierStep": 0.1,
    "flushBonus": 300,
    "royalSetBonus": 400,
    "sameRankBonusUnit": 100,
    "completeRunBonus": 1000,
    "completeRunSuitBonus": 1000,
    "columnSweepBonus": 500,
    "pairBonusUnit": 50,
    "alternatingBonus": 80,
    "alternatingMinLen": 4
  },
```

- [ ] **Step 4: ROLE_LISTとroleBasePointに新しい役を追加する**

`src/lib/game/shidasu/roles.ts`の`ROLE_LIST`配列に以下2エントリを追加する(末尾、`columnSweep`エントリの後)。

変更前:
```ts
export const ROLE_LIST: RoleEntry[] = [
  { name: 'suit', label: '同スート', desc: 'チェーンが3枚以上かつ全て同じスート' },
  { name: 'color', label: '同色', desc: '同スート不成立、かつチェーンが3枚以上かつ全て同じ色' },
  { name: 'stair', label: '階段', desc: 'チェーンが同方向に連続し、最小連続枚数以上' },
  { name: 'flush', label: 'フラッシュ', desc: '直近4枚で♠♥♦♣が全て揃う' },
  { name: 'royalSet', label: 'ロイヤルセット', desc: '直近3枚でJ・Q・Kが揃う' },
  { name: 'sameRank', label: '同ランク', desc: 'チェーン内に同じランクが複数出現' },
  { name: 'completeRun', label: 'コンプリートラン', desc: '13ランクが出揃った瞬間(同スートなら追加ボーナスも)' },
  { name: 'columnSweep', label: '列一掃', desc: '場札の列を最後の1枚まで取り切る' },
]
```

変更後:
```ts
export const ROLE_LIST: RoleEntry[] = [
  { name: 'suit', label: '同スート', desc: 'チェーンが3枚以上かつ全て同じスート' },
  { name: 'color', label: '同色', desc: '同スート不成立、かつチェーンが3枚以上かつ全て同じ色' },
  { name: 'stair', label: '階段', desc: 'チェーンが同方向に連続し、最小連続枚数以上' },
  { name: 'flush', label: 'フラッシュ', desc: '直近4枚で♠♥♦♣が全て揃う' },
  { name: 'royalSet', label: 'ロイヤルセット', desc: '直近3枚でJ・Q・Kが揃う' },
  { name: 'sameRank', label: '同ランク', desc: 'チェーン内に同じランクが複数出現' },
  { name: 'completeRun', label: 'コンプリートラン', desc: '13ランクが出揃った瞬間(同スートなら追加ボーナスも)' },
  { name: 'columnSweep', label: '列一掃', desc: '場札の列を最後の1枚まで取り切る' },
  { name: 'pair', label: 'ペア', desc: 'チェーン全体で同ランクの組が2組以上成立' },
  { name: 'alternating', label: '交互', desc: 'チェーンが4枚以上かつ赤黒交互に並ぶ' },
]
```

同ファイルの`roleBasePoint`関数を以下のように変更する。

変更前:
```ts
export function roleBasePoint(params: ShidasuParams, roleName: RoleName): number {
  switch (roleName) {
    case 'suit': return params.scoring.suitBonus
    case 'color': return params.scoring.colorBonus
    case 'stair': return params.scoring.stairBonus
    case 'flush': return params.scoring.flushBonus
    case 'royalSet': return params.scoring.royalSetBonus
    case 'sameRank': return params.scoring.sameRankBonusUnit
    case 'completeRun': return params.scoring.completeRunBonus
    case 'columnSweep': return params.scoring.columnSweepBonus
  }
}
```

変更後:
```ts
export function roleBasePoint(params: ShidasuParams, roleName: RoleName): number {
  switch (roleName) {
    case 'suit': return params.scoring.suitBonus
    case 'color': return params.scoring.colorBonus
    case 'stair': return params.scoring.stairBonus
    case 'flush': return params.scoring.flushBonus
    case 'royalSet': return params.scoring.royalSetBonus
    case 'sameRank': return params.scoring.sameRankBonusUnit
    case 'completeRun': return params.scoring.completeRunBonus
    case 'columnSweep': return params.scoring.columnSweepBonus
    case 'pair': return params.scoring.pairBonusUnit
    case 'alternating': return params.scoring.alternatingBonus
  }
}
```

- [ ] **Step 5: ORACLE_ACTUAL_EFFECTSに新しい役を追加する**

`src/lib/game/shidasu/oracleActualEffects.ts`の`ORACLE_ACTUAL_EFFECTS`オブジェクトに以下2エントリを追加する(末尾、`columnSweep`エントリの後)。

変更前:
```ts
  columnSweep: '列一掃のレベルを+1する。以後playCard(engine.ts)の列一掃加点計算で、基礎点(columnSweepBonus)にこのレベルを乗算した額が加点される(明星・ソウィロ由来のroleBonusMultiplierとも併せて乗算される)',
}
```

変更後:
```ts
  columnSweep: '列一掃のレベルを+1する。以後playCard(engine.ts)の列一掃加点計算で、基礎点(columnSweepBonus)にこのレベルを乗算した額が加点される(明星・ソウィロ由来のroleBonusMultiplierとも併せて乗算される)',
  pair: 'ペアのレベルを+1する。以後evaluateChainBonus(patterns.ts)のペアボーナス計算で、基礎点(pairBonusUnit)にこのレベルを乗算した額が加点される(明星・ソウィロ由来のroleBonusMultiplierとも併せて乗算される)。現時点ではORACLE_POOLに含まれないため、実際にこの神託を入手する手段は無い(将来の追加を見越した先行実装)',
  alternating: '交互のレベルを+1する。以後evaluateChainBonus(patterns.ts)の交互ボーナス計算で、基礎点(alternatingBonus)にこのレベルを乗算した額が加点される。現時点ではORACLE_POOLに含まれないため、実際にこの神託を入手する手段は無い(将来の追加を見越した先行実装)',
}
```

- [ ] **Step 6: defaultOracleLevelsに新しい役を追加する**

`src/lib/game/shidasu/oracles.ts`の`defaultOracleLevels`関数を以下のように変更する。

変更前:
```ts
export function defaultOracleLevels(): Record<RoleName, number> {
  return {
    flush: 1, royalSet: 1, sameRank: 1, completeRun: 1, columnSweep: 1,
    suit: 1, color: 1, stair: 1,
  }
}
```

変更後:
```ts
export function defaultOracleLevels(): Record<RoleName, number> {
  return {
    flush: 1, royalSet: 1, sameRank: 1, completeRun: 1, columnSweep: 1,
    suit: 1, color: 1, stair: 1,
    pair: 1, alternating: 1,
  }
}
```

- [ ] **Step 7: 型チェックを実行し、エラーが解消されたことを確認する**

Run: `npm run check`
Expected: shidasu関連のエラー0件(他ツールの既存エラーは無関係のため無視してよい)

- [ ] **Step 8: 全体テストを実行する**

Run: `npx vitest run`
Expected: 全件PASS(既存の`roleBasePoint`・`ROLE_LIST`・`ORACLE_ACTUAL_EFFECTS`を直接検証するテストは無いため、型チェックが通れば既存テストへの影響は無い)

- [ ] **Step 9: Commit**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/roles.ts src/lib/game/shidasu/oracleActualEffects.ts src/lib/game/shidasu/oracles.ts
git commit -m "feat: ペア役・交互パターン用にRoleName型とパラメータ基盤を拡張"
```

---

### Task 2: 交互パターンの判定ロジックを実装する

**Files:**
- Modify: `src/lib/game/shidasu/patterns.ts`
- Test: `src/lib/game/shidasu/patterns.test.ts`

**Files context:** Task 1が完了・コミット済みであることが前提。`src/lib/game/shidasu/patterns.ts`には既存の`cardColors`(18行目付近)・`analyzeSuitColor`(35行目付近)・`analyzeStair`(64行目付近)・`evaluateChainBonus`(185行目付近)・`chainContinuesPattern`(307行目付近)が定義されている。

- [ ] **Step 1: 失敗するテストを書く(analyzeAlternatingColor)**

`src/lib/game/shidasu/patterns.test.ts`215行目の`describe('analyzeSuitColor', () => { ... })`ブロックの直前に、以下の新規`describe`ブロックを追加する。

```ts
describe('analyzeAlternatingColor', () => {
  test('実カード3枚では不成立', () => {
    const chain = [card(1, '♥', 1), card(2, '♠', 2), card(3, '♦', 3)]
    expect(analyzeAlternatingColor(chain).held).toBe(false)
  })

  test('実カード4枚が赤黒交互に並べば成立', () => {
    const chain = [card(1, '♥', 1), card(2, '♠', 2), card(3, '♦', 3), card(4, '♣', 4)]
    expect(analyzeAlternatingColor(chain).held).toBe(true)
  })

  test('隣接する2枚が同色なら不成立', () => {
    const chain = [card(1, '♥', 1), card(2, '♦', 2), card(3, '♠', 3), card(4, '♣', 4)]
    expect(analyzeAlternatingColor(chain).held).toBe(false)
  })

  test('ワイルドを挟んでも実カード同士が交互なら成立', () => {
    const chain = [card(1, '♥', 1), card(2, '★', 0, true), card(3, '♠', 2), card(4, '♦', 3), card(5, '♣', 4)]
    expect(analyzeAlternatingColor(chain).held).toBe(true)
  })

  test('5枚以上でも交互が続けば成立、途中で崩れれば不成立', () => {
    const alternating = [card(1, '♥', 1), card(2, '♠', 2), card(3, '♦', 3), card(4, '♣', 4), card(5, '♥', 5)]
    expect(analyzeAlternatingColor(alternating).held).toBe(true)
    const broken = [card(1, '♥', 1), card(2, '♠', 2), card(3, '♦', 3), card(4, '♣', 4), card(5, '♦', 5)]
    expect(analyzeAlternatingColor(broken).held).toBe(false)
  })

  test('紅蓮所持時、黒札も赤として扱われるため、赤黒交互のはずが共通色を持ち不成立になる', () => {
    const chain = [card(1, '♥', 1), card(2, '♠', 2), card(3, '♦', 3), card(4, '♣', 4)]
    expect(analyzeAlternatingColor(chain, []).held).toBe(true)
    expect(analyzeAlternatingColor(chain, ['crimson']).held).toBe(false)
  })
})
```

`src/lib/game/shidasu/patterns.test.ts`3行目のimport文を以下のように変更する。

変更前:
```ts
import { isRed, analyzeSuitColor, analyzeStair, checkFlush, checkRoyalSet, countSameRankBefore, countSameRankForWildPlay, checkCompleteRun, evaluateChainBonus, stairUsesKALoop, chainContinuesPattern, cardColors } from './patterns'
```

変更後:
```ts
import { isRed, analyzeSuitColor, analyzeStair, checkFlush, checkRoyalSet, countSameRankBefore, countSameRankForWildPlay, checkCompleteRun, evaluateChainBonus, stairUsesKALoop, chainContinuesPattern, cardColors, analyzeAlternatingColor } from './patterns'
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run src/lib/game/shidasu/patterns.test.ts -t "analyzeAlternatingColor"`
Expected: FAIL(`analyzeAlternatingColor`が未定義のため型エラー、またはimportエラー)

- [ ] **Step 3: analyzeAlternatingColorを実装する**

`src/lib/game/shidasu/patterns.ts`の`analyzeStair`関数の直前(64行目付近)に、以下の新規関数を追加する。

```ts
export interface AlternatingColorAnalysis {
  held: boolean
}

// チェーン内の実カード(ワイルド除く)がminLen枚以上、隣接するカード同士の色が常に異なる
// (赤黒交互)かどうかを判定する。ワイルドは実カードの並びから除外して(位置を飛ばして)判定する
// (analyzeStairのワイルド跨ぎと同じ考え方)。紅蓮・漆黒所持時は都合の良い解釈により、
// 拡張された色同士が共通性を持ちやすくなる分、交互は成立しにくくなる
// (同色パターンとは逆方向の影響を受ける)。minLenの既定値4はscoring.alternatingMinLenの
// デフォルト値と一致させている(呼び出し元がscoring.alternatingMinLenを明示的に渡すため、
// 実際にはこのデフォルト値はテストコードから直接呼ぶ場合にのみ使われる)。
export function analyzeAlternatingColor(chain: Card[], items: ItemId[] = [], minLen: number = 4): AlternatingColorAnalysis {
  const realCards = chain.filter(c => !c.wild)
  if (realCards.length < minLen) return { held: false }
  for (let i = 1; i < realCards.length; i++) {
    const prevColors = cardColors(realCards[i - 1], items)
    const currColors = cardColors(realCards[i], items)
    const sharesColor = (prevColors.red && currColors.red) || (prevColors.black && currColors.black)
    if (sharesColor) return { held: false }
  }
  return { held: true }
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npx vitest run src/lib/game/shidasu/patterns.test.ts -t "analyzeAlternatingColor"`
Expected: PASS(全件)

- [ ] **Step 5: 失敗するテストを書く(evaluateChainBonusへの統合)**

`src/lib/game/shidasu/patterns.test.ts`の`describe('evaluateChainBonus', ...)`ブロック内(既存の各テストの末尾付近)に以下を追加する。

```ts
  test('交互パターン: 4枚未満では成立しない', () => {
    const chainBefore = [card(1, '♥', 1), card(2, '♠', 2)]
    const result = evaluateChainBonus(scoring, chainBefore, card(3, '♦', 3))
    expect(result.parts.some(p => p.label === '交互')).toBe(false)
  })

  test('交互パターン: 4枚以上が赤黒交互なら成立し、alternatingBonus分加点される', () => {
    const chainBefore = [card(1, '♥', 1), card(2, '♠', 2), card(3, '♦', 3)]
    const result = evaluateChainBonus(scoring, chainBefore, card(4, '♣', 4))
    expect(result.parts.map(p => p.text)).toContain(`交互+${scoring.alternatingBonus}`)
    expect(result.patternFiredCount).toBe(1)
  })

  test('交互パターン: 同色が続く場合は成立しない', () => {
    const chainBefore = [card(1, '♥', 1), card(2, '♦', 2), card(3, '♠', 3)]
    const result = evaluateChainBonus(scoring, chainBefore, card(4, '♣', 4))
    expect(result.parts.some(p => p.label === '交互')).toBe(false)
  })

  test('交互パターン: 神託レベルが乗算される', () => {
    const chainBefore = [card(1, '♥', 1), card(2, '♠', 2), card(3, '♦', 3)]
    const oracleLevel = (name: RoleName) => (name === 'alternating' ? 3 : 1)
    const result = evaluateChainBonus(scoring, chainBefore, card(4, '♣', 4), undefined, undefined, undefined, oracleLevel)
    expect(result.parts.map(p => p.text)).toContain(`交互+${scoring.alternatingBonus * 3}`)
  })
```

- [ ] **Step 6: テストを実行して失敗を確認する**

Run: `npx vitest run src/lib/game/shidasu/patterns.test.ts -t "交互パターン"`
Expected: FAIL(交互パーツが積まれないため)

- [ ] **Step 7: evaluateChainBonusに交互パターンの判定を組み込む**

`src/lib/game/shidasu/patterns.ts`の`evaluateChainBonus`関数内、既存の同スート・同色パターン判定ブロック(`if (chainIncludingThis.length >= suitColorMinLen) { ... }`)の直後に以下を追加する。

変更前:
```ts
  const { suitHeld, colorHeld } = analyzeSuitColor(chainIncludingThis, items)
  if (chainIncludingThis.length >= suitColorMinLen) {
    if (suitHeld) {
      const suitGain = Math.floor(scoring.suitBonus * oracleLevel('suit'))
      bonus += suitGain
      parts.push(addPart('同スート', suitGain, chainIncludingThisIds))
      patternFired = true
      patternFiredCount += 1
    } else if (colorHeld) {
      const colorGain = Math.floor(scoring.colorBonus * oracleLevel('color'))
      bonus += colorGain
      parts.push(addPart('同色', colorGain, chainIncludingThisIds))
      patternFired = true
      patternFiredCount += 1
    }
  }

  const stairInfo = analyzeStair(chainIncludingThis)
```

変更後:
```ts
  const { suitHeld, colorHeld } = analyzeSuitColor(chainIncludingThis, items)
  if (chainIncludingThis.length >= suitColorMinLen) {
    if (suitHeld) {
      const suitGain = Math.floor(scoring.suitBonus * oracleLevel('suit'))
      bonus += suitGain
      parts.push(addPart('同スート', suitGain, chainIncludingThisIds))
      patternFired = true
      patternFiredCount += 1
    } else if (colorHeld) {
      const colorGain = Math.floor(scoring.colorBonus * oracleLevel('color'))
      bonus += colorGain
      parts.push(addPart('同色', colorGain, chainIncludingThisIds))
      patternFired = true
      patternFiredCount += 1
    }
  }

  if (analyzeAlternatingColor(chainIncludingThis, items, scoring.alternatingMinLen).held) {
    const alternatingGain = Math.floor(scoring.alternatingBonus * oracleLevel('alternating'))
    bonus += alternatingGain
    parts.push(addPart('交互', alternatingGain, chainIncludingThisIds))
    patternFired = true
    patternFiredCount += 1
  }

  const stairInfo = analyzeStair(chainIncludingThis)
```

`analyzeAlternatingColor`は内部で「実カード4枚未満ならheld: false」を返すため、枚数チェックをここで別途行う必要は無い。

- [ ] **Step 8: テストを実行して成功を確認する**

Run: `npx vitest run src/lib/game/shidasu/patterns.test.ts -t "交互パターン"`
Expected: PASS(全件)

- [ ] **Step 9: chainContinuesPatternに交互パターンを組み込む**

`src/lib/game/shidasu/patterns.test.ts`57行目の`describe('chainContinuesPattern', () => { ... })`ブロック内、114行目の`})`(ブロック終了)の直前に以下のテストを追加する。このブロック内の既存テストは`scoring`変数ではなく`DEFAULT_PARAMS.scoring`を直接使うパターンのため、それに合わせる。

```ts
  test('交互パターンが成立していれば、山札めくりでもコンボが継続する', () => {
    const chain = [card(1, '♥', 1), card(2, '♠', 2), card(3, '♦', 3)]
    expect(chainContinuesPattern(DEFAULT_PARAMS.scoring, chain, card(4, '♣', 9))).toBe(true)
  })
```

`chain`に含まれる4枚(今回のカードを含む)が赤黒交互になっており、既存の同スート・同色・階段のいずれの条件も満たさない組み合わせ(ランクがバラバラ、スートもバラバラ)にすることで、交互パターン由来でのみ`true`になることを確認する。

`src/lib/game/shidasu/patterns.ts`の`chainContinuesPattern`関数を以下のように変更する。

変更前:
```ts
export function chainContinuesPattern(
  scoring: ShidasuParams['scoring'],
  chain: Card[],
  card: Card,
  stairMinLen: number = scoring.stairMinLen,
  suitColorMinLen: number = scoring.suitColorMinLen,
  items: ItemId[] = []
): boolean {
  const chainIncludingThis = [...chain, card]

  const { suitHeld, colorHeld } = analyzeSuitColor(chainIncludingThis, items)
  if (chainIncludingThis.length >= suitColorMinLen && (suitHeld || colorHeld)) return true

  const stairInfo = analyzeStair(chainIncludingThis)
  if (stairInfo.held && stairInfo.dir !== 0 && stairInfo.len >= stairMinLen) return true

  return false
}
```

変更後:
```ts
export function chainContinuesPattern(
  scoring: ShidasuParams['scoring'],
  chain: Card[],
  card: Card,
  stairMinLen: number = scoring.stairMinLen,
  suitColorMinLen: number = scoring.suitColorMinLen,
  items: ItemId[] = []
): boolean {
  const chainIncludingThis = [...chain, card]

  const { suitHeld, colorHeld } = analyzeSuitColor(chainIncludingThis, items)
  if (chainIncludingThis.length >= suitColorMinLen && (suitHeld || colorHeld)) return true

  const stairInfo = analyzeStair(chainIncludingThis)
  if (stairInfo.held && stairInfo.dir !== 0 && stairInfo.len >= stairMinLen) return true

  if (analyzeAlternatingColor(chainIncludingThis, items, scoring.alternatingMinLen).held) return true

  return false
}
```

- [ ] **Step 10: テストを実行して成功を確認する**

Run: `npx vitest run src/lib/game/shidasu/patterns.test.ts`
Expected: PASS(全件)

- [ ] **Step 11: patternFiredCountのコメントを更新する**

`src/lib/game/shidasu/patterns.ts`の`ChainBonusResult`インターフェース内、`patternFiredCount`のコメントを以下のように変更する。

変更前:
```ts
  // 成立したパターンボーナスの種類数(同スート/同色のいずれかで+1、階段でさらに+1。最大2)。瑠璃が参照する。
  patternFiredCount: number
```

変更後:
```ts
  // 成立したパターンボーナスの種類数(同スート/同色のいずれかで+1、階段で+1、交互で+1。最大3)。瑠璃が参照する。
  patternFiredCount: number
```

- [ ] **Step 12: 全体テスト・型チェックを実行する**

Run: `npx vitest run`
Expected: 全件PASS

Run: `npm run check`
Expected: shidasu関連のエラー0件

- [ ] **Step 13: Commit**

```bash
git add src/lib/game/shidasu/patterns.ts src/lib/game/shidasu/patterns.test.ts
git commit -m "feat: 交互パターン(赤黒4枚以上交互)を実装"
```

---

### Task 3: ペア役の判定ロジックを実装する

**Files:**
- Modify: `src/lib/game/shidasu/patterns.ts`
- Test: `src/lib/game/shidasu/patterns.test.ts`

**Files context:** Task 2が完了・コミット済みであることが前提。

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/patterns.test.ts`の`describe('evaluateChainBonus', ...)`ブロック内、Task 2で追加した交互パターンのテストの直後に以下を追加する。

```ts
  test('ペア: 組数0では加点なし', () => {
    const chainBefore = [card(1, '♠', 3), card(2, '♥', 6)]
    const result = evaluateChainBonus(scoring, chainBefore, card(3, '♦', 9))
    expect(result.roleFired.find(r => r.name === 'pair')).toBeUndefined()
  })

  test('ペア: 組数1(1組のみ)では加点なし', () => {
    const chainBefore = [card(1, '♠', 3), card(2, '♥', 3), card(3, '♦', 6)]
    const result = evaluateChainBonus(scoring, chainBefore, card(4, '♣', 9))
    expect(result.roleFired.find(r => r.name === 'pair')).toBeUndefined()
  })

  test('ペア: 組数2で成立し、組数×pairBonusUnit分加点される', () => {
    const chainBefore = [card(1, '♠', 3), card(2, '♥', 3), card(3, '♦', 9)]
    const result = evaluateChainBonus(scoring, chainBefore, card(4, '♣', 9))
    const pairEntry = result.roleFired.find(r => r.name === 'pair')
    expect(pairEntry?.amount).toBe(scoring.pairBonusUnit * 2)
  })

  test('ペア: チェーン内のワイルドは今回プレイしたカードのランクにのみ加算される', () => {
    const chainBefore = [card(1, '♠', 3), card(2, '♥', 3), card(3, '★', 0, true), card(4, '♦', 6)]
    const result = evaluateChainBonus(scoring, chainBefore, card(5, '♣', 6))
    // ランク3: 実カード2枚(組成立)、ランク6: 実カード1枚+ワイルド1枚+今回1枚=3枚(組成立)
    const pairEntry = result.roleFired.find(r => r.name === 'pair')
    expect(pairEntry?.amount).toBe(scoring.pairBonusUnit * 2)
  })

  test('ペア: ワイルド自身をプレイした場合、最大枚数の実ランクにワイルド分が加算される', () => {
    const chainBefore = [card(1, '♠', 3), card(2, '♥', 3), card(3, '♦', 9)]
    const result = evaluateChainBonus(scoring, chainBefore, card(4, '★', 0, true))
    // ランク3: 実カード2枚+今回のワイルド1枚=3枚(組成立)、ランク9: 実カード1枚のまま(組不成立)
    expect(result.roleFired.find(r => r.name === 'pair')).toBeUndefined()
  })

  test('ペア: ワイルド自身をプレイし、複数組が成立していれば加点される', () => {
    const chainBefore = [card(1, '♠', 3), card(2, '♥', 3), card(3, '♦', 9), card(4, '♣', 9)]
    const result = evaluateChainBonus(scoring, chainBefore, card(5, '★', 0, true))
    const pairEntry = result.roleFired.find(r => r.name === 'pair')
    expect(pairEntry?.amount).toBe(scoring.pairBonusUnit * 2)
  })

  test('ペア: 神託レベルが乗算される', () => {
    const chainBefore = [card(1, '♠', 3), card(2, '♥', 3), card(3, '♦', 9)]
    const oracleLevel = (name: RoleName) => (name === 'pair' ? 2 : 1)
    const result = evaluateChainBonus(scoring, chainBefore, card(4, '♣', 9), undefined, undefined, undefined, oracleLevel)
    const pairEntry = result.roleFired.find(r => r.name === 'pair')
    expect(pairEntry?.amount).toBe(scoring.pairBonusUnit * 2 * 2)
  })
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run src/lib/game/shidasu/patterns.test.ts -t "ペア"`
Expected: FAIL(ペアの判定ロジックが無いため、`roleFired`に`pair`が一切積まれない)

- [ ] **Step 3: evaluateChainBonusにペアの判定を組み込む**

`src/lib/game/shidasu/patterns.ts`の`evaluateChainBonus`関数内、`return { bonus, parts, patternFired, patternFiredCount, roleFired }`の直前(コンプリートランブロックの直後)に以下を追加する。

変更前:
```ts
    roleFired.push({ name: 'completeRun', usedWild: completeRunUsedWild, amount: completeRunTotalGain })
  }

  return { bonus, parts, patternFired, patternFiredCount, roleFired }
}
```

変更後:
```ts
    roleFired.push({ name: 'completeRun', usedWild: completeRunUsedWild, amount: completeRunTotalGain })
  }

  // ペア: チェーン全体でランクごとに集計し、2枚以上あるランクが2組以上あれば成立する累積型役。
  // ワイルドは「今回プレイしたカードのランク」(ワイルド自身の場合は最大枚数の実ランク)にのみ
  // 加算し、複数ランクへの二重カウントを避ける(countSameRankBefore/countSameRankForWildPlayと同じ思想)。
  const pairRankCounts = new Map<Card['rank'], number>()
  for (const c of chainBefore) {
    if (!c.wild) pairRankCounts.set(c.rank, (pairRankCounts.get(c.rank) ?? 0) + 1)
  }
  const pairWildCountInChain = chainBefore.filter(c => c.wild).length
  if (card.wild) {
    let maxRank: Card['rank'] | null = null
    let maxCount = 0
    for (const [rank, count] of pairRankCounts) {
      if (count > maxCount) {
        maxRank = rank
        maxCount = count
      }
    }
    if (maxRank !== null) {
      pairRankCounts.set(maxRank, Math.max(maxCount + pairWildCountInChain, 1) + 1)
    }
  } else {
    const currentCount = pairRankCounts.get(card.rank) ?? 0
    pairRankCounts.set(card.rank, currentCount + pairWildCountInChain + 1)
  }
  const pairCount = [...pairRankCounts.values()].filter(c => c >= 2).length
  if (pairCount >= 2) {
    const pairGain = Math.floor(scoring.pairBonusUnit * pairCount * oracleLevel('pair') * roleBonusMultiplier('pair'))
    bonus += pairGain
    parts.push(addPart('ペア', pairGain, chainIncludingThisIds))
    const pairUsedWild = card.wild || pairWildCountInChain > 0
    roleFired.push({ name: 'pair', usedWild: pairUsedWild, amount: pairGain })
  }

  return { bonus, parts, patternFired, patternFiredCount, roleFired }
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npx vitest run src/lib/game/shidasu/patterns.test.ts -t "ペア"`
Expected: PASS(全件)

- [ ] **Step 5: 全体テスト・型チェックを実行する**

Run: `npx vitest run`
Expected: 全件PASS

Run: `npm run check`
Expected: shidasu関連のエラー0件

- [ ] **Step 6: Commit**

```bash
git add src/lib/game/shidasu/patterns.ts src/lib/game/shidasu/patterns.test.ts
git commit -m "feat: ペア役(同ランク組2組以上で加点)を実装"
```

---

### Task 4: 統合確認

**Files:**
- Modify: `docs/shidasu/shidasu-role-candidates.md`

- [ ] **Step 1: 全テストを実行する**

Run: `npx vitest run`
Expected: 全ファイルPASS

- [ ] **Step 2: ビルドを実行する**

Run: `npm run build`
Expected: ビルド成功

- [ ] **Step 3: 型チェックを実行する**

Run: `npm run check`
Expected: shidasu関連のエラー0件(他ツールの既存エラーは無関係のため無視してよい)

- [ ] **Step 4: 開発サーバーで目視確認する**

Run: `npm run dev`

確認項目:
- `/admin/shidasu-debug`または`/game/shidasu`で、赤黒交互に4枚以上プレイし、得点内訳に「交互+80」のパーツが表示されることを確認する
- 同ランクの組を2組以上作るプレイを行い、得点内訳に「ペア+(組数×50)」のパーツが表示されることを確認する
- `/game/shidasu`の`RoleStatusPanel`(常時表示エリア)に「ペア」「交互」が新規の役・パターンとして一覧表示されることを確認する
- `/admin/shidasu-debug`の`RoleStatusEditor`でも同様に「ペア」「交互」が表示・レベル編集できることを確認する

- [ ] **Step 5: shidasu-role-candidates.mdを更新する**

`docs/shidasu/shidasu-role-candidates.md`の「中(4個)」テーブル内のペアの行、および全体の見出しを、実装完了を反映する形に更新する。「交互」については既存候補一覧に無い新規パターンのため、候補一覧の該当セクション(中難易度、または新規セクション)に実装済みとして追記する。

具体的には、12行目の見出し`## 候補一覧(12個、難易度別)`の直後に実装状況の注記を追加し、39行目のペアの行の末尾(実装メモ列)に「【2026-08-06実装済み】発動条件を2組以上に変更、得点を組数×50に変更」を追記する。「交互」については42行目(交代スートの行)の直後に新しい行として追加し、実装済みである旨・得点80・最小4枚である旨を記載する。

- [ ] **Step 6: Commit**

```bash
git add docs/shidasu/shidasu-role-candidates.md
git commit -m "docs: shidasu-role-candidates.mdにペア・交互の実装完了を反映"
```
