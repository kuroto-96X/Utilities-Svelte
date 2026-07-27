# 場札プレイ時の得点内訳表示・アニメーション Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 場札プレイ時の得点計算を、基礎点・パターン・役・護符・コンボ倍率などの内訳を1つずつ順番にハイライト表示しながら仮合計を見せ、最後にSCORE欄へ飛び込むアニメーションで反映する。

**Architecture:** 現在`parts: string[]`という単なる表示文字列の配列で保持している得点内訳を、`ScorePart = { label, kind: 'add'|'multiply'|'lock', amount, text }`という構造化データに置き換える(計算エンジン側は全ファイルで機械的な変更のみ、計算ロジック自体は変えない)。これにより各ステップ後の仮合計をUI側で正確に再現できる。UIは`PlayArea.svelte`に、カード移動アニメ完了後の`onPlayCard`戻り値としてその場のプレイ結果を受け取り、順番表示→合計表示→SCOREへ飛び込み、の3フェーズのローカルアニメーションを追加する。

**Tech Stack:** SvelteKit / Svelte 5 runes(`$state`, `$effect`は使わず戻り値ベースで駆動)、TypeScript、CSS transition、Vitest

---

## 事前情報(実装者向け)

- 対象は場札プレイ(`applyPlayCard`が呼ばれる通常プレイ画面)のみ。バラ売り・福袋の中身選択画面、ショップ、山札めくり(`applyDrawStock`)のUIは対象外。ただしデータ型(`ScorePart`)への変更自体は`applyDrawStock`内の得点計算コード(素朴の抵筆等)にも及ぶ(既存の`parts: string[]`を使っている箇所すべてが対象)。
- 既存の得点内訳の`parts.push(...)`は、いずれも金額・倍率の数値が既にその場で計算済みの状態で文字列に整形しているだけなので、構造化オブジェクトへの置き換えは機械的な変更であり計算ロジックは一切変わらない。
- `parts: string[]`を参照している既存テストが6ファイル・約33箇所ある(`cardComboEffects.test.ts`, `chainAttributeEffects.test.ts`は無し、`clearBonusEffects.test.ts`, `directEffects.test.ts`, `engine.test.ts`, `itemEffects.test.ts`, `patterns.test.ts`)。型変更後はこれらを`.parts.map(p => p.text)`に置き換える形で移行する(Task 3)。
- 得点内訳表示アニメーションは、直前に実装済みの「カードが場札からチェーンへ移動するアニメーション」(`PlayArea.svelte`の`startPlayCardAnimation`)の完了直後に始まる。そのアニメーションの最終`setTimeout`が`onPlayCard(colIndex, rowIndex)`を呼んでいる箇所(`PlayArea.svelte`)を、戻り値を受け取れる形に変更する(Task 5)。

---

### Task 1: `ScorePart`型と計算ユーティリティを新規作成する

**Files:**
- Create: `src/lib/game/shidasu/scoreParts.ts`
- Test: `src/lib/game/shidasu/scoreParts.test.ts`

このタスクは他ファイルに一切依存しない、完全に独立した新規ユーティリティの追加。`fmtMultiplier`(倍率の表示整形関数、現在`patterns.ts`にある)もこのファイルに移す(Task 2で`patterns.ts`側がこのファイルの`addPart`をimportすることになり、`patterns.ts`→`scoreParts.ts`→`patterns.ts`の循環importを避けるため)。

- [ ] **Step 1: 失敗するテストを書く**

```ts
// src/lib/game/shidasu/scoreParts.test.ts
import { describe, it, expect } from 'vitest'
import { addPart, multiplyPart, lockPart, fmtMultiplier, runningTotalsFromScoreParts, finalScoreFromScoreParts } from './scoreParts'

describe('fmtMultiplier', () => {
  it('小数第2位までに丸めて文字列化する', () => {
    expect(fmtMultiplier(1.5)).toBe('1.5')
    expect(fmtMultiplier(1.23456)).toBe('1.23')
  })
})

describe('addPart / multiplyPart / lockPart', () => {
  it('addPartはkind=addとtextを生成する', () => {
    expect(addPart('基礎点', 10)).toEqual({ label: '基礎点', kind: 'add', amount: 10, text: '基礎点+10' })
  })

  it('multiplyPartはkind=multiplyとtextを生成する', () => {
    expect(multiplyPart('コンボ倍率', 1.5)).toEqual({ label: 'コンボ倍率', kind: 'multiply', amount: 1.5, text: 'コンボ倍率×1.5' })
  })

  it('lockPartはkind=lockでamountが0、textはlabelそのまま', () => {
    expect(lockPart('小凶: 獲得点0')).toEqual({ label: '小凶: 獲得点0', kind: 'lock', amount: 0, text: '小凶: 獲得点0' })
  })
})

describe('runningTotalsFromScoreParts', () => {
  it('加算のみなら各ステップの累計を返す', () => {
    const parts = [addPart('基礎点', 10), addPart('同スート', 50)]
    expect(runningTotalsFromScoreParts(parts)).toEqual([10, 60])
  })

  it('乗算は直前の累計に掛け算する', () => {
    const parts = [addPart('基礎点', 100), multiplyPart('コンボ倍率', 1.5)]
    expect(runningTotalsFromScoreParts(parts)).toEqual([100, 150])
  })

  it('lockはそれ以降の累計を0にする', () => {
    const parts = [addPart('基礎点', 100), multiplyPart('コンボ倍率', 1.5), lockPart('ロック')]
    expect(runningTotalsFromScoreParts(parts)).toEqual([100, 150, 0])
  })

  it('空配列なら空配列を返す', () => {
    expect(runningTotalsFromScoreParts([])).toEqual([])
  })
})

describe('finalScoreFromScoreParts', () => {
  it('最終ステップの値に床関数を適用して返す', () => {
    const parts = [addPart('基礎点', 10), multiplyPart('コンボ倍率', 1.35)]
    expect(finalScoreFromScoreParts(parts)).toBe(Math.floor(13.5))
  })

  it('空配列なら0を返す', () => {
    expect(finalScoreFromScoreParts([])).toBe(0)
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run src/lib/game/shidasu/scoreParts.test.ts`
Expected: FAIL(`scoreParts.ts`が存在しない)

- [ ] **Step 3: 実装を書く**

```ts
// src/lib/game/shidasu/scoreParts.ts

// 得点内訳の1ステップを表す構造化データ。kind='add'は加算量、kind='multiply'は倍率をamountに持つ。
// kind='lock'は特殊ステップで、それまでの仮合計に関わらず以降の合計を0にする(ボス得点ロック用)。
// textは従来通りの表示用文字列(例: "基礎点+10")で、既存のテスト・非対応箇所での表示に使う。
export interface ScorePart {
  label: string
  kind: 'add' | 'multiply' | 'lock'
  amount: number
  text: string
}

// 護符の内訳表示用に倍率を丸めて整形する(浮動小数の誤差で末尾が長くなるのを防ぐ)
export function fmtMultiplier(n: number): string {
  return String(Math.round(n * 100) / 100)
}

export function addPart(label: string, amount: number): ScorePart {
  return { label, kind: 'add', amount, text: `${label}+${amount}` }
}

export function multiplyPart(label: string, factor: number): ScorePart {
  return { label, kind: 'multiply', amount: factor, text: `${label}×${fmtMultiplier(factor)}` }
}

export function lockPart(label: string): ScorePart {
  return { label, kind: 'lock', amount: 0, text: label }
}

// ScorePartを先頭から順に適用し、各ステップ後の仮合計を返す。addは加算、multiplyは乗算(浮動小数のまま
// 保持し、床関数は最後の要素にのみ適用しない=呼び出し側が最終値にfinalScoreFromScorePartsで丸める)、
// lockは合計を0にする。engine.tsのapplyPlayCardが実際に行っている計算(護符効果を順に適用し、最後に
// コンボ倍率・マンナズ倍率をかけて1回だけ床関数を適用する)と同じ順序・同じ数値を構造化データとして
// 再生するため、両者の結果は常に一致する。
export function runningTotalsFromScoreParts(parts: ScorePart[]): number[] {
  const totals: number[] = []
  let running = 0
  for (const part of parts) {
    if (part.kind === 'add') running += part.amount
    else if (part.kind === 'multiply') running *= part.amount
    else running = 0
    totals.push(running)
  }
  return totals
}

// 最終的な仮合計(床関数を適用した整数)を返す。partsが空の場合は0を返す。
export function finalScoreFromScoreParts(parts: ScorePart[]): number {
  const totals = runningTotalsFromScoreParts(parts)
  return totals.length > 0 ? Math.floor(totals[totals.length - 1]) : 0
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npx vitest run src/lib/game/shidasu/scoreParts.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/scoreParts.ts src/lib/game/shidasu/scoreParts.test.ts
git commit -m "feat: 得点内訳の構造化データ型ScorePartと計算ユーティリティを追加"
```

---

### Task 2: 計算エンジン側を構造化ScorePartへ移行する

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`
- Modify: `src/lib/game/shidasu/patterns.ts`
- Modify: `src/lib/game/shidasu/itemEffects.ts`
- Modify: `src/lib/game/shidasu/cardComboEffects.ts`
- Modify: `src/lib/game/shidasu/chainAttributeEffects.ts`
- Modify: `src/lib/game/shidasu/stateAndPatternEffects.ts`
- Modify: `src/lib/game/shidasu/clearBonusEffects.ts`
- Modify: `src/lib/game/shidasu/directEffects.ts`
- Modify: `src/lib/game/shidasu/engine.ts`

このタスクは9ファイルにまたがる機械的な型移行。各ステップの変更は「金額・倍率が既に分かっている箇所で、文字列テンプレートの代わりに`addPart`/`multiplyPart`/`lockPart`を呼ぶ」だけで、計算結果(数値)は一切変えない。**このタスクの途中(Step 1〜9)では意図的に型エラーが残るため、`npm run check`は最後のStep 10でのみ実行すること。** また`npx vitest run`は、既存テストが`parts`を文字列配列として比較しているため、Step 10の時点でも失敗する(これはTask 3で対応する想定通りの失敗)。

- [ ] **Step 1: `types.ts`を変更する**

`src/lib/game/shidasu/types.ts`の86-97行目を以下に変更する:

```ts
export interface ScoreGain {
  points: number
  parts: ScorePart[]
}

// 全消しボーナス・護符による直接加算など、通常のプレイ得点(ScoreGain/lastGain)とは
// 別枠でログ表示する得点イベント。labelでイベント種別を表す。
export interface BonusGain {
  label: string
  points: number
  parts: ScorePart[]
}
```

ファイル冒頭のimport文に`ScorePart`を追加する。`src/lib/game/shidasu/types.ts`の1行目付近を確認し、既存のimport文が無ければ以下を`export type Suit = ...`より前に追加する:

```ts
// src/lib/game/shidasu/types.ts
import type { ScorePart } from './scoreParts'
```

- [ ] **Step 2: `patterns.ts`を変更する**

`src/lib/game/shidasu/patterns.ts`のimport文(ファイル冒頭)を以下に変更する:

```ts
// src/lib/game/shidasu/patterns.ts
import type { Card, Suit, RoleName } from './types'
import type { ShidasuParams } from './params'
import { addPart, type ScorePart } from './scoreParts'
```

`ChainBonusResult`インターフェース(146-160行目)の`parts: string[]`を`parts: ScorePart[]`に変更する:

```ts
export interface ChainBonusResult {
  bonus: number
  parts: ScorePart[]
  // 同スート/同色/階段のいずれかの「パターンボーナス」が成立したか
  patternFired: boolean
  // 成立したパターンボーナスの種類数(同スート/同色のいずれかで+1、階段でさらに+1。最大2)。瑠璃が参照する。
  patternFiredCount: number
  // 成立した「役ボーナス」の一覧。usedWildの意味はrole名によって異なる:
  // flush/royalSet/completeRunは「実カードだけでは成立せずワイルドの穴埋めが必須だったか」(必要性ベース)。
  // sameRankは同ランクボーナスの加点量自体がワイルド枚数を無条件に含むため、
  // 「チェーンにワイルドが1枚でも存在すれば常にtrue」(寄与ベース)になる。
  // amountはこの役が実際に加算した点数(roleBonusMultiplier適用後、completeRunは同スート追加分を含む)。
  // 明星(倍率適用)・水鏡(遅延複製)が参照する。
  roleFired: { name: RoleName; usedWild: boolean; amount: number }[]
}
```

`evaluateChainBonus`関数内(162-259行目)の`const parts: string[] = []`宣言と、その後の8箇所の`parts.push(...)`を以下のように変更する。まず171-179行目:

```ts
  if (chainBefore.length === 0) {
    return { bonus: 0, parts: [], patternFired: false, patternFiredCount: 0, roleFired: [] }
  }

  let bonus = 0
  const parts: ScorePart[] = []
  let patternFired = false
  let patternFiredCount = 0
  const roleFired: { name: RoleName; usedWild: boolean; amount: number }[] = []
```

184-198行目(同スート・同色):

```ts
  const { suitHeld, colorHeld } = analyzeSuitColor(chainIncludingThis)
  if (chainIncludingThis.length >= suitColorMinLen) {
    if (suitHeld) {
      const suitGain = Math.floor(scoring.suitBonus * oracleLevel('suit'))
      bonus += suitGain
      parts.push(addPart('同スート', suitGain))
      patternFired = true
      patternFiredCount += 1
    } else if (colorHeld) {
      const colorGain = Math.floor(scoring.colorBonus * oracleLevel('color'))
      bonus += colorGain
      parts.push(addPart('同色', colorGain))
      patternFired = true
      patternFiredCount += 1
    }
  }
```

200-207行目(階段):

```ts
  const stairInfo = analyzeStair(chainIncludingThis)
  if (stairInfo.held && stairInfo.len >= stairMinLen) {
    const stairGain = Math.floor(scoring.stairBonus * oracleLevel('stair'))
    bonus += stairGain
    parts.push(addPart(`階段${stairInfo.len} `, stairGain))
    patternFired = true
    patternFiredCount += 1
  }
```

注意: 元の文字列は`` `階段${stairInfo.len} +${stairGain}` ``(数字と`+`の間に半角スペースが1つ)なので、`addPart`のlabel引数を`` `階段${stairInfo.len} ` ``(末尾にスペースを含む)にすることで、`text`が従来と全く同じ`` `階段5 +100` ``という形式になる。

209-217行目(フラッシュ):

```ts
  if (checkFlush(chainIncludingThis)) {
    const flushGain = Math.floor(scoring.flushBonus * oracleLevel('flush') * roleBonusMultiplier('flush'))
    bonus += flushGain
    parts.push(addPart('フラッシュ', flushGain))
    const last4 = chainIncludingThis.slice(-4)
    const realSuits = new Set(last4.filter(c => !c.wild).map(c => c.suit))
    const flushUsedWild = ALL_SUITS_REAL.some(s => !realSuits.has(s))
    roleFired.push({ name: 'flush', usedWild: flushUsedWild, amount: flushGain })
  }
```

219-228行目(ロイヤル):

```ts
  if (checkRoyalSet(chainIncludingThis)) {
    const royalSetGain = Math.floor(scoring.royalSetBonus * oracleLevel('royalSet') * roleBonusMultiplier('royalSet'))
    bonus += royalSetGain
    parts.push(addPart('ロイヤル', royalSetGain))
    const last3 = chainIncludingThis.slice(-3)
    const realRanks = new Set(last3.filter(c => !c.wild).map(c => c.rank))
    const requiredRanks: Card['rank'][] = [11, 12, 13]
    const royalSetUsedWild = requiredRanks.some(r => !realRanks.has(r))
    roleFired.push({ name: 'royalSet', usedWild: royalSetUsedWild, amount: royalSetGain })
  }
```

230-237行目(同ランク):

```ts
  const sameRankCount = card.wild ? countSameRankForWildPlay(chainBefore) : countSameRankBefore(chainBefore, card.rank)
  if (sameRankCount > 0) {
    const sameRankGain = Math.floor(scoring.sameRankBonusUnit * sameRankCount * oracleLevel('sameRank') * roleBonusMultiplier('sameRank'))
    bonus += sameRankGain
    parts.push(addPart('同ランク', sameRankGain))
    const sameRankUsedWild = card.wild || chainBefore.some(c => c.wild)
    roleFired.push({ name: 'sameRank', usedWild: sameRankUsedWild, amount: sameRankGain })
  }
```

239-256行目(コンプリートラン、同スート追加分を含む):

```ts
  if (checkCompleteRun(chainBefore, chainIncludingThis)) {
    const completeRunGain = Math.floor(scoring.completeRunBonus * oracleLevel('completeRun') * roleBonusMultiplier('completeRun'))
    bonus += completeRunGain
    parts.push(addPart('コンプリートラン', completeRunGain))
    const distinctRealNow = new Set(chainIncludingThis.filter(c => !c.wild).map(c => c.rank)).size
    const wildCountNow = chainIncludingThis.filter(c => c.wild).length
    const completeRunUsedWild = distinctRealNow < 13 && wildCountNow > 0
    // completeRunのみ、同スート追加ボーナスの有無を確定させてからroleFiredにpushする
    // (他の役は単一の加点のみだが、completeRunは同スート追加分も合算してamountに含めるため)。
    let completeRunTotalGain = completeRunGain
    if (suitHeld) {
      const completeRunSuitGain = Math.floor(scoring.completeRunSuitBonus * oracleLevel('completeRun') * roleBonusMultiplier('completeRun'))
      bonus += completeRunSuitGain
      parts.push(addPart('コンプリートラン(同スート)', completeRunSuitGain))
      completeRunTotalGain += completeRunSuitGain
    }
    roleFired.push({ name: 'completeRun', usedWild: completeRunUsedWild, amount: completeRunTotalGain })
  }

  return { bonus, parts, patternFired, patternFiredCount, roleFired }
```

最後に、ファイル末尾付近にある`fmtMultiplier`関数の定義(280-282行目)を削除する(Task 1で`scoreParts.ts`に移設済みのため):

```ts
// この関数定義ブロックを削除する:
// export function fmtMultiplier(n: number): string {
//   return String(Math.round(n * 100) / 100)
// }
```

- [ ] **Step 3: `itemEffects.ts`を変更する**

`src/lib/game/shidasu/itemEffects.ts`の47行目・56-72行目を以下に変更する:

```ts
export type ItemEffect = (value: number, ctx: ItemEffectContext, params: ShidasuParams) => { value: number; part: ScorePart | null }
```

(1行目のimport文に`import type { ScorePart } from './scoreParts'`を追加する)

```ts
export function applyItemEffects(
  channel: 'gained' | 'clearBonus',
  baseValue: number,
  items: ItemId[],
  ctx: ItemEffectContext,
  params: ShidasuParams
): { value: number; parts: ScorePart[] } {
  const parts: ScorePart[] = []
  const value = items.reduce((v, id) => {
    const entry = ITEM_EFFECTS[id]
    if (!entry || entry.channel !== channel) return v
    const result = entry.effect(v, ctx, params)
    if (result.part) parts.push(result.part)
    return result.value
  }, baseValue)
  return { value, parts }
}
```

- [ ] **Step 4: `cardComboEffects.ts`を全文置き換える**

`src/lib/game/shidasu/cardComboEffects.ts`の内容を以下で完全に置き換える:

```ts
// src/lib/game/shidasu/cardComboEffects.ts
import type { ItemId } from './types'
import { isRed } from './patterns'
import { addPart, multiplyPart } from './scoreParts'
import type { ItemEffect } from './itemEffects'

export const CARD_COMBO_EFFECTS: Partial<Record<ItemId, { channel: 'gained' | 'clearBonus'; effect: ItemEffect }>> = {
  springBreeze: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.card.suit === '♣'
        ? { value: v + p.talismans.springBreeze.n, part: addPart('春風', p.talismans.springBreeze.n) }
        : { value: v, part: null },
  },
  summerBreeze: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.card.suit === '♦'
        ? { value: v + p.talismans.summerBreeze.n, part: addPart('夏風', p.talismans.summerBreeze.n) }
        : { value: v, part: null },
  },
  autumnBreeze: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.card.suit === '♥'
        ? { value: v + p.talismans.autumnBreeze.n, part: addPart('秋風', p.talismans.autumnBreeze.n) }
        : { value: v, part: null },
  },
  winterBreeze: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.card.suit === '♠'
        ? { value: v + p.talismans.winterBreeze.n, part: addPart('冬風', p.talismans.winterBreeze.n) }
        : { value: v, part: null },
  },
  kinship: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.card.suit === '♥' && ctx.previousFoundation.suit !== '♥'
        ? { value: v + p.talismans.kinship.n, part: addPart('友愛', p.talismans.kinship.n) }
        : { value: v, part: null },
  },
  thaw: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.previousFoundation.suit === '♠' && ctx.card.suit !== '♠'
        ? { value: v + p.talismans.thaw.n, part: addPart('雪解', p.talismans.thaw.n) }
        : { value: v, part: null },
  },
  dusk: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      isRed(ctx.previousFoundation) && !isRed(ctx.card)
        ? { value: v + p.talismans.dusk.n, part: addPart('宵闇', p.talismans.dusk.n) }
        : { value: v, part: null },
  },
  dawn: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      !isRed(ctx.previousFoundation) && isRed(ctx.card)
        ? { value: v + p.talismans.dawn.n, part: addPart('払暁', p.talismans.dawn.n) }
        : { value: v, part: null },
  },
  wit: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.card.wild ? { value: v + p.talismans.wit.n, part: addPart('機知', p.talismans.wit.n) } : { value: v, part: null },
  },
  courage: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const factor = 1 + ctx.combo * p.talismans.courage.x
      return { value: v * factor, part: multiplyPart('勇気', factor) }
    },
  },
  daybreak: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.combo <= p.talismans.daybreak.c
        ? { value: v * p.talismans.daybreak.x, part: multiplyPart('暁', p.talismans.daybreak.x) }
        : { value: v, part: null },
  },
  twilight: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.combo >= p.talismans.twilight.c
        ? { value: v * p.talismans.twilight.x, part: multiplyPart('黄昏', p.talismans.twilight.x) }
        : { value: v, part: null },
  },
  cheerful: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.combo % 2 === 0
        ? { value: v + p.talismans.cheerful.n, part: addPart('快活', p.talismans.cheerful.n) }
        : { value: v, part: null },
  },
  conscience: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.combo % 2 !== 0
        ? { value: v + p.talismans.conscience.n, part: addPart('良心', p.talismans.conscience.n) }
        : { value: v, part: null },
  },
  morningMist: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const factor = ctx.combo < p.talismans.morningMist.c ? 1 / p.talismans.morningMist.x : p.talismans.morningMist.x
      return { value: v * factor, part: multiplyPart('朝霧', factor) }
    },
  },
}
```

- [ ] **Step 5: `chainAttributeEffects.ts`を全文置き換える**

`src/lib/game/shidasu/chainAttributeEffects.ts`の内容を以下で完全に置き換える:

```ts
// src/lib/game/shidasu/chainAttributeEffects.ts
import type { Card, ItemId, Suit } from './types'
import { isRed, isFace, analyzeSuitColor, analyzeStair, stairUsesKALoop } from './patterns'
import { addPart, multiplyPart } from './scoreParts'
import type { ItemEffect } from './itemEffects'

function chainHasNoFace(chain: Card[]): boolean {
  return chain.every(c => c.wild || !isFace(c))
}
function chainIsFaceOnly(chain: Card[]): boolean {
  return chain.every(c => c.wild || isFace(c))
}

function chainSuitExclusive(chain: Card[], suit: Suit): boolean {
  return chain.every(c => c.wild || c.suit === suit)
}

function chainColorExclusive(chain: Card[], red: boolean): boolean {
  return chain.every(c => c.wild || isRed(c) === red)
}

function countSuitInChain(chain: Card[], suit: Suit): number {
  const real = chain.filter(c => !c.wild && c.suit === suit).length
  const wild = chain.filter(c => c.wild).length
  return real + wild
}

function countRankInChain(chain: Card[], rank: Card['rank']): number {
  const real = chain.filter(c => !c.wild && c.rank === rank).length
  const wild = chain.filter(c => c.wild).length
  return real + wild
}

// 赤黒の差(diff)をワイルドで埋めて同数にできるかを判定する。
// ワイルドをwildToRed/wildToBlackに振り分けてrealRed+wildToRed = realBlack+wildToBlackを
// 満たすには、wildToRed-wildToBlack = diffかつwildToRed+wildToBlack = wildCountを共に
// 満たす非負整数解が要る。これはdiff<=wildCountに加えて、両者の差(wildCount-diff)が
// 偶数である場合のみ整数解になる(そうでなければワイルドを半端に割ることになり不可能)。
// (wildCount-diff)の偶奇は合計枚数(realRed+realBlack+wildCount)の偶奇と一致するため、
// 後者で判定する。
function redBlackBalanced(chain: Card[]): boolean {
  const realRed = chain.filter(c => !c.wild && isRed(c)).length
  const realBlack = chain.filter(c => !c.wild && !isRed(c)).length
  const wildCount = chain.filter(c => c.wild).length
  const diff = Math.abs(realRed - realBlack)
  const totalIsEven = (realRed + realBlack + wildCount) % 2 === 0
  return diff <= wildCount && totalIsEven
}

export const CHAIN_ATTRIBUTE_EFFECTS: Partial<Record<ItemId, { channel: 'gained' | 'clearBonus'; effect: ItemEffect }>> = {
  calm: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      chainHasNoFace(ctx.chain) ? { value: v + p.talismans.calm.n, part: addPart('平穏', p.talismans.calm.n) } : { value: v, part: null },
  },
  serenity: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!chainHasNoFace(ctx.chain)) return { value: v, part: null }
      const factor = p.talismans.serenity.x
      return { value: v * factor, part: multiplyPart('安寧', factor) }
    },
  },
  destiny: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      chainIsFaceOnly(ctx.chain) ? { value: v + p.talismans.destiny.n, part: addPart('運命', p.talismans.destiny.n) } : { value: v, part: null },
  },
  fate: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!chainIsFaceOnly(ctx.chain)) return { value: v, part: null }
      const factor = p.talismans.fate.x
      return { value: v * factor, part: multiplyPart('宿命', factor) }
    },
  },
  relief: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.card.wild || (ctx.card.rank >= 1 && ctx.card.rank <= 10)
        ? { value: v + p.talismans.relief.n, part: addPart('安堵', p.talismans.relief.n) }
        : { value: v, part: null },
  },
  verdantGreen: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!chainSuitExclusive(ctx.chain, '♣')) return { value: v, part: null }
      const factor = p.talismans.verdantGreen.x
      return { value: v * factor, part: multiplyPart('深緑', factor) }
    },
  },
  gem: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!chainSuitExclusive(ctx.chain, '♦')) return { value: v, part: null }
      const factor = p.talismans.gem.x
      return { value: v * factor, part: multiplyPart('宝石', factor) }
    },
  },
  resolve: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!chainSuitExclusive(ctx.chain, '♠')) return { value: v, part: null }
      const factor = p.talismans.resolve.x
      return { value: v * factor, part: multiplyPart('真剣', factor) }
    },
  },
  grail: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!chainSuitExclusive(ctx.chain, '♥')) return { value: v, part: null }
      const factor = p.talismans.grail.x
      return { value: v * factor, part: multiplyPart('聖杯', factor) }
    },
  },
  moonlight: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!chainColorExclusive(ctx.chain, false)) return { value: v, part: null }
      const factor = p.talismans.moonlight.x
      return { value: v * factor, part: multiplyPart('月光', factor) }
    },
  },
  sunlight: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!chainColorExclusive(ctx.chain, true)) return { value: v, part: null }
      const factor = p.talismans.sunlight.x
      return { value: v * factor, part: multiplyPart('陽光', factor) }
    },
  },
  crown: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const count = countRankInChain(ctx.chain, 13)
      if (count === 0) return { value: v, part: null }
      const factor = 1 + count * p.talismans.crown.x
      return { value: v * factor, part: multiplyPart('王冠', factor) }
    },
  },
  cloverLeaf: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const count = countSuitInChain(ctx.chain, '♣')
      if (count === 0) return { value: v, part: null }
      const add = count * p.talismans.cloverLeaf.n
      return { value: v + add, part: addPart('青葉', add) }
    },
  },
  coin: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const count = countSuitInChain(ctx.chain, '♦')
      if (count === 0) return { value: v, part: null }
      const add = count * p.talismans.coin.n
      return { value: v + add, part: addPart('硬貨', add) }
    },
  },
  blade: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const count = countSuitInChain(ctx.chain, '♠')
      if (count === 0) return { value: v, part: null }
      const add = count * p.talismans.blade.n
      return { value: v + add, part: addPart('武器', add) }
    },
  },
  chalice: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const count = countSuitInChain(ctx.chain, '♥')
      if (count === 0) return { value: v, part: null }
      const add = count * p.talismans.chalice.n
      return { value: v + add, part: addPart('献杯', add) }
    },
  },
  balance: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      redBlackBalanced(ctx.chain) ? { value: v + p.talismans.balance.n, part: addPart('均衡', p.talismans.balance.n) } : { value: v, part: null },
  },
  harmony: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!redBlackBalanced(ctx.chain)) return { value: v, part: null }
      const factor = p.talismans.harmony.x
      return { value: v * factor, part: multiplyPart('調和', factor) }
    },
  },
  nobility: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const { suitHeld } = analyzeSuitColor(ctx.chain)
      if (ctx.chain.length < ctx.effectiveSuitColorMinLen || !suitHeld) return { value: v, part: null }
      return { value: v + p.talismans.nobility.n, part: addPart('高潔', p.talismans.nobility.n) }
    },
  },
  tenacity: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const { suitHeld } = analyzeSuitColor(ctx.chain)
      if (ctx.chain.length < ctx.effectiveSuitColorMinLen || !suitHeld) return { value: v, part: null }
      const factor = 1 + ctx.chain.length * p.talismans.tenacity.x
      return { value: v * factor, part: multiplyPart('執念', factor) }
    },
  },
  determination: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const stairInfo = analyzeStair(ctx.chain)
      if (!stairInfo.held || stairInfo.dir === 0 || stairInfo.len < ctx.effectiveStairMinLen) return { value: v, part: null }
      const factor = 1 + stairInfo.len * p.talismans.determination.x
      return { value: v * factor, part: multiplyPart('覚悟', factor) }
    },
  },
  cycle: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const matches = (c: Card, rank: Card['rank']) => c.wild || c.rank === rank
      const kToA = matches(ctx.previousFoundation, 13) && matches(ctx.card, 1)
      const aToK = matches(ctx.previousFoundation, 1) && matches(ctx.card, 13)
      if (!kToA && !aToK) return { value: v, part: null }
      const factor = p.talismans.cycle.x
      return { value: v * factor, part: multiplyPart('循環', factor) }
    },
  },
  reincarnation: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const stairInfo = analyzeStair(ctx.chain)
      const completeRunFired = ctx.chainBonus.roleFired.some(r => r.name === 'completeRun')
      if (!completeRunFired || !stairInfo.held || stairInfo.dir === 0 || !stairUsesKALoop(ctx.chain)) return { value: v, part: null }
      const factor = p.talismans.reincarnation.x
      return { value: v * factor, part: multiplyPart('輪廻', factor) }
    },
  },
  majesty: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const stairInfo = analyzeStair(ctx.chain)
      const { suitHeld } = analyzeSuitColor(ctx.chain)
      const completeRunFired = ctx.chainBonus.roleFired.some(r => r.name === 'completeRun')
      if (!completeRunFired || !stairInfo.held || stairInfo.dir === 0 || !suitHeld) return { value: v, part: null }
      const factor = p.talismans.majesty.x
      return { value: v * factor, part: multiplyPart('威光', factor) }
    },
  },
}
```

- [ ] **Step 6: `stateAndPatternEffects.ts`を全文置き換える**

`src/lib/game/shidasu/stateAndPatternEffects.ts`の内容を以下で完全に置き換える:

```ts
// src/lib/game/shidasu/stateAndPatternEffects.ts
import type { ItemId } from './types'
import { addPart, multiplyPart } from './scoreParts'
import type { ItemEffect } from './itemEffects'

export const STATE_AND_PATTERN_EFFECTS: Partial<Record<ItemId, { channel: 'gained' | 'clearBonus'; effect: ItemEffect }>> = {
  omen: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.remainingTableauCount > p.talismans.omen.m) return { value: v, part: null }
      const factor = p.talismans.omen.x
      return { value: v * factor, part: multiplyPart('兆し', factor) }
    },
  },
  crescent: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.remainingTableauCount > p.talismans.crescent.m) return { value: v, part: null }
      const factor = p.talismans.crescent.x
      return { value: v * factor, part: multiplyPart('三日月', factor) }
    },
  },
  blessing: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.chainBonus.roleFired.length === 0) return { value: v, part: null }
      const factor = p.talismans.blessing.x
      return { value: v * factor, part: multiplyPart('恩寵', factor) }
    },
  },
  focus: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!ctx.chainBonus.roleFired.some(r => r.name === 'sameRank')) return { value: v, part: null }
      const factor = p.talismans.focus.x
      return { value: v * factor, part: multiplyPart('集中', factor) }
    },
  },
  lapis: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const total = ctx.chainBonus.roleFired.length + ctx.chainBonus.patternFiredCount
      if (total < 2) return { value: v, part: null }
      const factor = p.talismans.lapis.x
      return { value: v * factor, part: multiplyPart('瑠璃', factor) }
    },
  },
  jade: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.chainBonus.roleFired.some(r => r.usedWild)
        ? { value: v + p.talismans.jade.n, part: addPart('翡翠', p.talismans.jade.n) }
        : { value: v, part: null },
  },
  emptyMind: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.chainBonus.patternFired || ctx.chainBonus.roleFired.length > 0) return { value: v, part: null }
      const factor = p.talismans.emptyMind.x
      return { value: v * factor, part: multiplyPart('無心', factor) }
    },
  },
  prologue: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.isPlayAction && ctx.playCountInChain === 1
        ? { value: v + p.talismans.prologue.n, part: addPart('序章', p.talismans.prologue.n) }
        : { value: v, part: null },
  },
  interlude: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.isPlayAction && ctx.playCountInChain === p.talismans.interlude.m
        ? { value: v + p.talismans.interlude.n, part: addPart('幕間', p.talismans.interlude.n) }
        : { value: v, part: null },
  },
  morningDew: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.isFirstPlayOfWave ? { value: v + p.talismans.morningDew.n, part: addPart('朝露', p.talismans.morningDew.n) } : { value: v, part: null },
  },
  drizzle: {
    channel: 'gained',
    effect: (v, _ctx, p) => ({ value: v + p.talismans.drizzle.n, part: addPart('小雨', p.talismans.drizzle.n) }),
  },
  gentleBreeze: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.sameColumnStreak < 2) return { value: v, part: null }
      const add = ctx.sameColumnStreak * p.talismans.gentleBreeze.n
      return { value: v + add, part: addPart('微風', add) }
    },
  },
  resonance: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.sameColumnStreak < 2) return { value: v, part: null }
      const factor = 1 + ctx.sameColumnStreak * p.talismans.resonance.x
      return { value: v * factor, part: multiplyPart('共鳴', factor) }
    },
  },
  azureSky: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.totalColumnsEmptiedThisWave === 0) return { value: v, part: null }
      const factor = 1 + ctx.totalColumnsEmptiedThisWave * p.talismans.azureSky.x
      return { value: v * factor, part: multiplyPart('蒼穹', factor) }
    },
  },
  amber: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.maxComboThisWave === 0) return { value: v, part: null }
      const factor = 1 + ctx.maxComboThisWave * p.talismans.amber.x
      return { value: v * factor, part: multiplyPart('琥珀', factor) }
    },
  },
  passion: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.flushActiveThisCombo
        ? { value: v * p.talismans.passion.x, part: multiplyPart('情熱', p.talismans.passion.x) }
        : { value: v, part: null },
  },
  fightingSpirit: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.columnSweepActiveThisWave
        ? { value: v * p.talismans.fightingSpirit.x, part: multiplyPart('闘志', p.talismans.fightingSpirit.x) }
        : { value: v, part: null },
  },
  intuition: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.drawContinueCountThisChain === 0) return { value: v, part: null }
      const factor = 1 + ctx.drawContinueCountThisChain * p.talismans.intuition.x
      return { value: v * factor, part: multiplyPart('直感', factor) }
    },
  },
  mercy: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.mercyActiveNextCombo
        ? { value: v * p.talismans.mercy.x, part: multiplyPart('慈悲', p.talismans.mercy.x) }
        : { value: v, part: null },
  },
  deadline: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.stockRemaining === 0) return { value: v, part: null }
      const add = ctx.stockRemaining * p.talismans.deadline.n
      return { value: v + add, part: addPart('刻限', add) }
    },
  },
}
```

- [ ] **Step 7: `clearBonusEffects.ts`を全文置き換える**

`src/lib/game/shidasu/clearBonusEffects.ts`の内容を以下で完全に置き換える:

```ts
// src/lib/game/shidasu/clearBonusEffects.ts
import type { ItemId } from './types'
import { addPart, multiplyPart } from './scoreParts'
import type { ItemEffect } from './itemEffects'

export const CLEAR_BONUS_EFFECTS: Partial<Record<ItemId, { channel: 'gained' | 'clearBonus'; effect: ItemEffect }>> = {
  patience: {
    channel: 'clearBonus',
    effect: (v, ctx, p) => {
      const add = ctx.stockRemaining * p.talismans.patience.x
      return { value: v + add, part: addPart('忍耐', add) }
    },
  },
  purify: {
    channel: 'clearBonus',
    effect: (v, _ctx, p) => ({ value: v + p.talismans.purify.n, part: addPart('浄化', p.talismans.purify.n) }),
  },
  temperance: {
    channel: 'clearBonus',
    effect: (v, ctx, p) => {
      const factor = 1 + ctx.stockRemaining * p.talismans.temperance.x
      return { value: v * factor, part: multiplyPart('節制', factor) }
    },
  },
}
```

- [ ] **Step 8: `directEffects.ts`を変更する**

`src/lib/game/shidasu/directEffects.ts`の内容を以下で完全に置き換える:

```ts
// src/lib/game/shidasu/directEffects.ts
import type { ItemId } from './types'
import type { ShidasuParams } from './params'
import { itemName } from './items'
import { addPart, type ScorePart } from './scoreParts'

export type DirectChannel = 'resetDirect' | 'stockEmptyDirect' | 'comboMilestoneDirect' | 'drawContinueDirect'

export interface DirectEffectContext {
  comboBeforeReset: number
  hasPlayableColumns: boolean
  roleFiredThisChain: boolean
  remainingTableauCount: number
  combo: number
  colorHeld: boolean
  // 流星用: このアクション直前のコンボ数(閾値をまたいで通過したかの判定に使う)
  previousCombo: number
  // 流星用: このアクションの通常獲得点(gained)を加算した後のスコア
  scoreAfterGained: number
}

type DirectEffect = (ctx: DirectEffectContext, params: ShidasuParams) => number

const DIRECT_EFFECTS: Partial<Record<ItemId, { channel: DirectChannel; effect: DirectEffect }>> = {
  composure: {
    channel: 'resetDirect',
    effect: (ctx, p) => (ctx.hasPlayableColumns ? 0 : p.talismans.composure.n),
  },
  clarity: {
    channel: 'resetDirect',
    effect: (ctx, p) => (ctx.roleFiredThisChain ? 0 : p.talismans.clarity.n),
  },
  echo: {
    channel: 'resetDirect',
    effect: (ctx, p) => ctx.comboBeforeReset * p.talismans.echo.n,
  },
  arrogance: {
    channel: 'stockEmptyDirect',
    effect: (ctx, p) => ctx.remainingTableauCount * p.talismans.arrogance.x,
  },
  shootingStar: {
    channel: 'comboMilestoneDirect',
    effect: (ctx, p) => {
      const c = p.talismans.shootingStar.c
      if (ctx.previousCombo >= c || ctx.combo < c) return 0
      return Math.floor(ctx.scoreAfterGained * p.talismans.shootingStar.p / 100)
    },
  },
  sincerity: {
    channel: 'drawContinueDirect',
    effect: (ctx, p) => (ctx.colorHeld ? p.talismans.sincerity.n : 0),
  },
}

export function applyDirectEffects(
  channel: DirectChannel,
  items: ItemId[],
  ctx: DirectEffectContext,
  params: ShidasuParams
): { value: number; parts: ScorePart[] } {
  const parts: ScorePart[] = []
  const value = items.reduce((total, id) => {
    const entry = DIRECT_EFFECTS[id]
    if (!entry || entry.channel !== channel) return total
    const amount = entry.effect(ctx, params)
    if (amount !== 0) parts.push(addPart(itemName(id, params), amount))
    return total + amount
  }, 0)
  return { value, parts }
}
```

- [ ] **Step 9: `engine.ts`を変更する**

`src/lib/game/shidasu/engine.ts`の5行目(import文)を以下に変更する:

```ts
import { isFace, chainContinuesPattern, evaluateChainBonus, analyzeSuitColor, countSameRankBefore, countSameRankForWildPlay } from './patterns'
```

同じimportブロックの直後(6行目付近、`import { rollItemOffer } from './items'`の前)に以下を追加する:

```ts
import { addPart, multiplyPart, lockPart, type ScorePart } from './scoreParts'
```

353-360行目(基礎点・水鏡)を以下に変更する:

```ts
  let base = params.scoring.basePoint
  const parts: ScorePart[] = [addPart('基礎点', base)]

  // 水鏡: 前のプレイで予約された役ボーナスの遅延複製を無条件で上乗せする
  if (items.includes('mirror') && wave.pendingRoleEcho) {
    base += wave.pendingRoleEcho.amount
    parts.push(addPart(`水鏡(${wave.pendingRoleEcho.name})`, wave.pendingRoleEcho.amount))
  }
```

406-411行目(列一掃)を以下に変更する:

```ts
  if (sweepQualifies) {
    const sweepGain = Math.floor(params.scoring.columnSweepBonus * oracleLevel('columnSweep') * newColumnsEmptied * roleBonusMultiplier('columnSweep'))
    base += sweepGain
    parts.push(addPart('列一掃', sweepGain))
    roleFired.push({ name: 'columnSweep', usedWild: false, amount: sweepGain })
  }
```

498-507行目(コンボ倍率・マンナズ・ボスロック)を以下に変更する:

```ts
  const comboMultiplierStep = params.scoring.comboMultiplierStep
  const multiplier = 1 + effectiveCombo * comboMultiplierStep
  if (multiplier !== 1) parts.push(multiplyPart('コンボ倍率', multiplier))
  const mannazFactor = wave.mannazActiveThisWave ? 1 + mannazWeightSum(items, params) * params.rites.mannaz.x : 1
  if (mannazFactor !== 1) parts.push(multiplyPart('マンナズ', mannazFactor))
  let gained = Math.floor(itemResult.value * multiplier * mannazFactor)
  if (scoreLock && isBossScoreLocked(scoreLock, effectiveCombo, card)) {
    parts.push(lockPart(bossScoreLockMessage(scoreLock)))
    gained = 0
  }
```

526行目(目標達成時のmilestoneResultデフォルト)を以下に変更する:

```ts
    ? { value: 0, parts: [] as ScorePart[] }
```

585-590行目(全消しボーナスの内訳)を以下に変更する:

```ts
    const clearBonusGain: BonusGain = {
      label: '全消しボーナス',
      points: clearBonus,
      parts: [
        addPart('基礎', params.scoring.clearBonus),
        addPart('山札残数', wave.stock.length * params.scoring.clearBonusPerStock),
        ...clearBonusResult.parts,
      ],
    }
```

671行目(stockEmptyResultの型注釈)を以下に変更する:

```ts
  let stockEmptyResult: { value: number; parts: ScorePart[] } = { value: 0, parts: [] }
```

726行目(drawContinueResultのデフォルト)を以下に変更する:

```ts
      : { value: 0, parts: [] as ScorePart[] }
```

731行目(naivePartsの型注釈)を以下に変更する:

```ts
    let naiveParts: ScorePart[] = []
```

738行目(素朴パスの基礎点)を以下に変更する:

```ts
      const parts: ScorePart[] = [addPart('基礎点', base)]
```

783-790行目(素朴パスのコンボ倍率・マンナズ・ボスロック)を以下に変更する:

```ts
      const comboMultiplierStep = params.scoring.comboMultiplierStep
      const multiplier = 1 + effectiveCombo * comboMultiplierStep
      if (multiplier !== 1) parts.push(multiplyPart('コンボ倍率', multiplier))
      const mannazFactor = wave.mannazActiveThisWave ? 1 + mannazWeightSum(items, params) * params.rites.mannaz.x : 1
      if (mannazFactor !== 1) parts.push(multiplyPart('マンナズ', mannazFactor))
      naiveGained = Math.floor(itemResult.value * multiplier * mannazFactor)
      if (scoreLock && isBossScoreLocked(scoreLock, effectiveCombo, drawnCard)) {
        parts.push(lockPart(bossScoreLockMessage(scoreLock)))
        naiveGained = 0
      }
      naiveParts = parts
```

- [ ] **Step 10: 型チェックを実行して0件であることを確認する**

Run: `npm run check`
Expected: shidasuディレクトリ関連のエラー0件(他ツールの既存エラーは無視)。もしエラーが残っていたら、Step 1〜9のいずれかの箇所を見落としている可能性が高いので、エラーメッセージのファイル名・行番号を元に該当箇所を修正する。

続けて以下を実行し、既知の失敗のみであることを確認する(このタスクではテスト移行を行わないため、`.parts`を文字列配列として比較している既存テストは失敗するのが正しい状態):

Run: `npx vitest run src/lib/game/shidasu`
Expected: `cardComboEffects.test.ts`, `clearBonusEffects.test.ts`, `directEffects.test.ts`, `engine.test.ts`, `itemEffects.test.ts`, `patterns.test.ts`の6ファイルで失敗が出ること。これら以外のファイル(`chainLayout.test.ts`, `scoreParts.test.ts`など)はすべてPASSしていることを確認する。

- [ ] **Step 11: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/patterns.ts src/lib/game/shidasu/itemEffects.ts src/lib/game/shidasu/cardComboEffects.ts src/lib/game/shidasu/chainAttributeEffects.ts src/lib/game/shidasu/stateAndPatternEffects.ts src/lib/game/shidasu/clearBonusEffects.ts src/lib/game/shidasu/directEffects.ts src/lib/game/shidasu/engine.ts
git commit -m "feat: 得点内訳をScorePart構造化データへ移行(計算エンジン側)"
```

---

### Task 3: 既存テストをScorePart対応に移行する

**Files:**
- Modify: `src/lib/game/shidasu/cardComboEffects.test.ts`
- Modify: `src/lib/game/shidasu/clearBonusEffects.test.ts`
- Modify: `src/lib/game/shidasu/directEffects.test.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`
- Modify: `src/lib/game/shidasu/itemEffects.test.ts`
- Modify: `src/lib/game/shidasu/patterns.test.ts`

Task 2で`parts`が`string[]`から`ScorePart[]`に変わったため、既存テストの`.parts`を比較している箇所を`.parts`の各要素の`.text`プロパティで比較する形に移行する。表示文言の期待値そのものは一切変更しない。

- [ ] **Step 1: `cardComboEffects.test.ts`を修正する**

以下の5箇所を、`old_string`→`new_string`の通りに置き換える(該当行のみ変更、前後は変えない):

13行目
- old: `    expect(withClub.parts).toEqual([\`春風+${params.talismans.springBreeze.n}\`])`
- new: `    expect(withClub.parts.map(p => p.text)).toEqual([\`春風+${params.talismans.springBreeze.n}\`])`

16行目
- old: `    expect(withoutClub.parts).toEqual([])`
- new: `    expect(withoutClub.parts).toEqual([])`
- (この行は空配列との比較のため変更不要。空配列同士の比較は要素の型に関わらず成立する)

73行目
- old: `    expect(result.parts).toEqual([\`勇気×${factor}\`])`
- new: `    expect(result.parts.map(p => p.text)).toEqual([\`勇気×${factor}\`])`

108行目
- old: `    expect(below.parts).toEqual([\`朝霧×${Math.round(belowFactor * 100) / 100}\`])`
- new: `    expect(below.parts.map(p => p.text)).toEqual([\`朝霧×${Math.round(belowFactor * 100) / 100}\`])`

111行目
- old: `    expect(aboveOrEqual.parts).toEqual([\`朝霧×${params.talismans.morningMist.x}\`])`
- new: `    expect(aboveOrEqual.parts.map(p => p.text)).toEqual([\`朝霧×${params.talismans.morningMist.x}\`])`

- [ ] **Step 2: `clearBonusEffects.test.ts`を修正する**

14行目
- old: `    expect(result.parts).toEqual([\`忍耐+${add}\`])`
- new: `    expect(result.parts.map(p => p.text)).toEqual([\`忍耐+${add}\`])`

20行目
- old: `    expect(result.parts).toEqual([\`浄化+${params.talismans.purify.n}\`])`
- new: `    expect(result.parts.map(p => p.text)).toEqual([\`浄化+${params.talismans.purify.n}\`])`

27行目
- old: `    expect(result.parts).toEqual([\`節制×${factor}\`])`
- new: `    expect(result.parts.map(p => p.text)).toEqual([\`節制×${factor}\`])`

- [ ] **Step 3: `directEffects.test.ts`を修正する**

104行目
- old: `    expect(result.parts).toContain(\`沈着+${DEFAULT_PARAMS.talismans.composure.n}\`)`
- new: `    expect(result.parts.map(p => p.text)).toContain(\`沈着+${DEFAULT_PARAMS.talismans.composure.n}\`)`

120行目
- old: `    expect(result.parts).toEqual([])`
- new: `    expect(result.parts).toEqual([])`
- (空配列同士の比較のため変更不要)

136行目
- old: `    expect(result.parts).toContain(\`沈着+${DEFAULT_PARAMS.talismans.composure.n}\`)`
- new: `    expect(result.parts.map(p => p.text)).toContain(\`沈着+${DEFAULT_PARAMS.talismans.composure.n}\`)`

137行目
- old: `    expect(result.parts).toContain(\`冷静+${DEFAULT_PARAMS.talismans.clarity.n}\`)`
- new: `    expect(result.parts.map(p => p.text)).toContain(\`冷静+${DEFAULT_PARAMS.talismans.clarity.n}\`)`

- [ ] **Step 4: `itemEffects.test.ts`を修正する**

13行目
- old: `    expect(result.parts).toEqual([])`
- new: `    expect(result.parts).toEqual([])`
- (空配列同士の比較のため変更不要)

22行目
- old: `    expect(order1.parts).toEqual([\`浄化+${params.talismans.purify.n}\`, \`節制×${1 + 4 * params.talismans.temperance.x}\`])`
- new: `    expect(order1.parts.map(p => p.text)).toEqual([\`浄化+${params.talismans.purify.n}\`, \`節制×${1 + 4 * params.talismans.temperance.x}\`])`

23行目
- old: `    expect(order2.parts).toEqual([\`節制×${1 + 4 * params.talismans.temperance.x}\`, \`浄化+${params.talismans.purify.n}\`])`
- new: `    expect(order2.parts.map(p => p.text)).toEqual([\`節制×${1 + 4 * params.talismans.temperance.x}\`, \`浄化+${params.talismans.purify.n}\`])`

29行目
- old: `    expect(result.parts).toEqual([])`
- new: `    expect(result.parts).toEqual([])`
- (空配列同士の比較のため変更不要)

- [ ] **Step 5: `patterns.test.ts`を修正する**

426行目
- old: `    expect(result.parts.some(p => p.startsWith('同スート'))).toBe(false)`
- new: `    expect(result.parts.some(p => p.text.startsWith('同スート'))).toBe(false)`

433行目
- old: `    expect(result.parts).toEqual([\`同スート+${scoring.suitBonus}\`])`
- new: `    expect(result.parts.map(p => p.text)).toEqual([\`同スート+${scoring.suitBonus}\`])`

441行目
- old: `    expect(result.parts).toContain(\`同スート+${scoring.suitBonus}\`)`
- new: `    expect(result.parts.map(p => p.text)).toContain(\`同スート+${scoring.suitBonus}\`)`

447行目
- old: `    expect(result.parts).toContain(\`同スート+${scoring.suitBonus}\`)`
- new: `    expect(result.parts.map(p => p.text)).toContain(\`同スート+${scoring.suitBonus}\`)`

453行目
- old: `    expect(result.parts.some(p => p.startsWith('同スート'))).toBe(false)`
- new: `    expect(result.parts.some(p => p.text.startsWith('同スート'))).toBe(false)`

460行目
- old: `    expect(result.parts.some(p => p.startsWith('階段'))).toBe(false)`
- new: `    expect(result.parts.some(p => p.text.startsWith('階段'))).toBe(false)`

466行目
- old: `    expect(result.parts).toContain(\`階段5 +${scoring.stairBonus}\`)`
- new: `    expect(result.parts.map(p => p.text)).toContain(\`階段5 +${scoring.stairBonus}\`)`

472行目
- old: `    expect(result.parts).toContain(\`階段3 +${scoring.stairBonus}\`)`
- new: `    expect(result.parts.map(p => p.text)).toContain(\`階段3 +${scoring.stairBonus}\`)`

479行目
- old: `    expect(result.parts).toContain(\`階段3 +${scoring.stairBonus}\`)`
- new: `    expect(result.parts.map(p => p.text)).toContain(\`階段3 +${scoring.stairBonus}\`)`

485行目
- old: `    expect(result.parts).toContain(\`フラッシュ+${scoring.flushBonus}\`)`
- new: `    expect(result.parts.map(p => p.text)).toContain(\`フラッシュ+${scoring.flushBonus}\`)`

491行目
- old: `    expect(result.parts).toContain(\`ロイヤル+${scoring.royalSetBonus}\`)`
- new: `    expect(result.parts.map(p => p.text)).toContain(\`ロイヤル+${scoring.royalSetBonus}\`)`

497行目
- old: `    expect(result.parts).toContain(\`同ランク+${scoring.sameRankBonusUnit * 2}\`)`
- new: `    expect(result.parts.map(p => p.text)).toContain(\`同ランク+${scoring.sameRankBonusUnit * 2}\`)`

504行目
- old: `    expect(result.parts).toContain(\`同ランク+${scoring.sameRankBonusUnit * 2}\`)`
- new: `    expect(result.parts.map(p => p.text)).toContain(\`同ランク+${scoring.sameRankBonusUnit * 2}\`)`

511行目
- old: `    expect(result.parts).toContain(\`同ランク+${scoring.sameRankBonusUnit * 3}\`)`
- new: `    expect(result.parts.map(p => p.text)).toContain(\`同ランク+${scoring.sameRankBonusUnit * 3}\`)`

517行目
- old: `    expect(result.parts).toContain(\`同ランク+${scoring.sameRankBonusUnit * 2}\`)`
- new: `    expect(result.parts.map(p => p.text)).toContain(\`同ランク+${scoring.sameRankBonusUnit * 2}\`)`

523行目
- old: `    expect(result.parts).toContain(\`コンプリートラン+${scoring.completeRunBonus}\`)`
- new: `    expect(result.parts.map(p => p.text)).toContain(\`コンプリートラン+${scoring.completeRunBonus}\`)`

524行目
- old: `    expect(result.parts.some(p => p.includes('コンプリートラン(同スート)'))).toBe(false)`
- new: `    expect(result.parts.some(p => p.text.includes('コンプリートラン(同スート)'))).toBe(false)`

530行目
- old: `    expect(result.parts).toContain(\`コンプリートラン+${scoring.completeRunBonus}\`)`
- new: `    expect(result.parts.map(p => p.text)).toContain(\`コンプリートラン+${scoring.completeRunBonus}\`)`

531行目
- old: `    expect(result.parts).toContain(\`コンプリートラン(同スート)+${scoring.completeRunSuitBonus}\`)`
- new: `    expect(result.parts.map(p => p.text)).toContain(\`コンプリートラン(同スート)+${scoring.completeRunSuitBonus}\`)`

562行目
- old: `    expect(result.parts).toContain(\`同スート+${DEFAULT_PARAMS.scoring.suitBonus}\`)`
- new: `    expect(result.parts.map(p => p.text)).toContain(\`同スート+${DEFAULT_PARAMS.scoring.suitBonus}\`)`

570行目
- old: `    expect(result.parts).toContain(\`同スート+${DEFAULT_PARAMS.scoring.suitBonus}\`)`
- new: `    expect(result.parts.map(p => p.text)).toContain(\`同スート+${DEFAULT_PARAMS.scoring.suitBonus}\`)`

571行目
- old: `    expect(result.parts.some(p => p.startsWith('階段'))).toBe(true)`
- new: `    expect(result.parts.some(p => p.text.startsWith('階段'))).toBe(true)`

- [ ] **Step 6: `engine.test.ts`を修正する**

以下30箇所を、`old_string`→`new_string`の通りに置き換える(該当行のみ変更、前後は変えない):

380行目
- old: `    expect(next.lastGain?.parts[0]).toBe(\`基礎点+${scoring.basePoint}\`)`
- new: `    expect(next.lastGain?.parts[0].text).toBe(\`基礎点+${scoring.basePoint}\`)`

381行目
- old: `    expect(next.lastGain?.parts).toContain('コンボ倍率×1.1')`
- new: `    expect(next.lastGain?.parts.map(p => p.text)).toContain('コンボ倍率×1.1')`

404行目
- old: `    expect(next.lastGain?.parts).toContain('コンボ倍率×1.2')`
- new: `    expect(next.lastGain?.parts.map(p => p.text)).toContain('コンボ倍率×1.2')`

415行目
- old: `    expect(next.lastGain?.parts).toContain(\`列一掃+${scoring.columnSweepBonus}\`)`
- new: `    expect(next.lastGain?.parts.map(p => p.text)).toContain(\`列一掃+${scoring.columnSweepBonus}\`)`

425行目
- old: `    expect(next.lastGain?.parts.some(p => p.startsWith('列一掃'))).toBe(false)`
- new: `    expect(next.lastGain?.parts.some(p => p.text.startsWith('列一掃'))).toBe(false)`

435行目
- old: `    expect(next.lastGain?.parts).toContain(\`列一掃+${scoring.columnSweepBonus}\`)`
- new: `    expect(next.lastGain?.parts.map(p => p.text)).toContain(\`列一掃+${scoring.columnSweepBonus}\`)`

447行目
- old: `    expect(next.lastGain?.parts.some(p => p.startsWith('列一掃'))).toBe(true)`
- new: `    expect(next.lastGain?.parts.some(p => p.text.startsWith('列一掃'))).toBe(true)`

460行目
- old: `    expect(next.lastGain?.parts).toContain(\`列一掃+${scoring.columnSweepBonus}\`)`
- new: `    expect(next.lastGain?.parts.map(p => p.text)).toContain(\`列一掃+${scoring.columnSweepBonus}\`)`

472行目
- old: `    expect(next.lastGain?.parts).toContain(\`列一掃+${scoring.columnSweepBonus * 2}\`)`
- new: `    expect(next.lastGain?.parts.map(p => p.text)).toContain(\`列一掃+${scoring.columnSweepBonus * 2}\`)`

499行目
- old: `    expect(next.lastGain?.parts).not.toContain(\`全消しボーナス+${expectedClearBonus}\`)`
- new: `    expect(next.lastGain?.parts.map(p => p.text)).not.toContain(\`全消しボーナス+${expectedClearBonus}\`)`

503行目
- old: `    expect(next.lastBonusGains[0].parts).toContain(\`基礎+${scoring.clearBonus}\`)`
- new: `    expect(next.lastBonusGains[0].parts.map(p => p.text)).toContain(\`基礎+${scoring.clearBonus}\`)`

504行目
- old: `    expect(next.lastBonusGains[0].parts).toContain(\`山札残数+${2 * scoring.clearBonusPerStock}\`)`
- new: `    expect(next.lastBonusGains[0].parts.map(p => p.text)).toContain(\`山札残数+${2 * scoring.clearBonusPerStock}\`)`

522行目
- old: `    expect(next.lastBonusGains[0].parts).toContain(\`流星+${expectedBonus}\`)`
- new: `    expect(next.lastBonusGains[0].parts.map(p => p.text)).toContain(\`流星+${expectedBonus}\`)`

538行目
- old: `    expect(next.lastBonusGains.some(g => g.parts.some(p => p.startsWith('流星')))).toBe(true)`
- new: `    expect(next.lastBonusGains.some(g => g.parts.some(p => p.text.startsWith('流星')))).toBe(true)`

551行目
- old: `    expect(next.lastBonusGains.some(g => g.parts.some(p => p.startsWith('流星')))).toBe(false)`
- new: `    expect(next.lastBonusGains.some(g => g.parts.some(p => p.text.startsWith('流星')))).toBe(false)`

613行目
- old: `    expect(next.lastGain?.parts.some(p => p.startsWith('階段'))).toBe(false)`
- new: `    expect(next.lastGain?.parts.some(p => p.text.startsWith('階段'))).toBe(false)`

623行目
- old: `    expect(next.lastGain?.parts).toContain(\`階段3 +${scoring.stairBonus}\`)`
- new: `    expect(next.lastGain?.parts.map(p => p.text)).toContain(\`階段3 +${scoring.stairBonus}\`)`

637行目
- old: `    expect(next.lastGain?.parts.some(p => p.startsWith('階段'))).toBe(true)`
- new: `    expect(next.lastGain?.parts.some(p => p.text.startsWith('階段'))).toBe(true)`

651行目
- old: `    expect(next.lastGain?.parts).toContain(\`同スート+${DEFAULT_PARAMS.scoring.suitBonus}\`)`
- new: `    expect(next.lastGain?.parts.map(p => p.text)).toContain(\`同スート+${DEFAULT_PARAMS.scoring.suitBonus}\`)`

1081行目
- old: `    expect(next.lastGain?.parts).toContain(\`コンプリートラン+${scoring.completeRunBonus * DEFAULT_PARAMS.rites.sowilo.x}\`)`
- new: `    expect(next.lastGain?.parts.map(p => p.text)).toContain(\`コンプリートラン+${scoring.completeRunBonus * DEFAULT_PARAMS.rites.sowilo.x}\`)`

1082行目
- old: `    expect(next.lastGain?.parts).toContain(\`コンプリートラン(同スート)+${scoring.completeRunSuitBonus * DEFAULT_PARAMS.rites.sowilo.x}\`)`
- new: `    expect(next.lastGain?.parts.map(p => p.text)).toContain(\`コンプリートラン(同スート)+${scoring.completeRunSuitBonus * DEFAULT_PARAMS.rites.sowilo.x}\`)`

1155行目
- old: `    expect(next.lastGain?.parts).toContain(\`高潔+${DEFAULT_PARAMS.talismans.nobility.n}\`)`
- new: `    expect(next.lastGain?.parts.map(p => p.text)).toContain(\`高潔+${DEFAULT_PARAMS.talismans.nobility.n}\`)`

1671行目
- old: `    expect(gain?.parts).toContain(\`慢心+${2 * x}\`)`
- new: `    expect(gain?.parts.map(p => p.text)).toContain(\`慢心+${2 * x}\`)`

1843行目
- old: `    expect(next.lastBonusGains.some(g => g.label === '護符による直接加算' && g.parts.includes(\`慢心+${expected}\`))).toBe(true)`
- new: `    expect(next.lastBonusGains.some(g => g.label === '護符による直接加算' && g.parts.map(p => p.text).includes(\`慢心+${expected}\`))).toBe(true)`

1864行目
- old: `    expect(entry?.parts).toContain(\`沈着+${DEFAULT_PARAMS.talismans.composure.n}\`)`
- new: `    expect(entry?.parts.map(p => p.text)).toContain(\`沈着+${DEFAULT_PARAMS.talismans.composure.n}\`)`

1865行目
- old: `    expect(entry?.parts).toContain(\`冷静+${DEFAULT_PARAMS.talismans.clarity.n}\`)`
- new: `    expect(entry?.parts.map(p => p.text)).toContain(\`冷静+${DEFAULT_PARAMS.talismans.clarity.n}\`)`

1884行目
- old: `    expect(next.lastBonusGains.some(g => g.label === '護符による直接加算' && g.parts.includes(\`誠実+${DEFAULT_PARAMS.talismans.sincerity.n}\`))).toBe(true)`
- new: `    expect(next.lastBonusGains.some(g => g.label === '護符による直接加算' && g.parts.map(p => p.text).includes(\`誠実+${DEFAULT_PARAMS.talismans.sincerity.n}\`))).toBe(true)`

1908行目
- old: `    expect(next.lastBonusGains.some(g => g.label === '護符による直接加算' && g.parts.includes(\`誠実+${DEFAULT_PARAMS.talismans.sincerity.n}\`))).toBe(true)`
- new: `    expect(next.lastBonusGains.some(g => g.label === '護符による直接加算' && g.parts.map(p => p.text).includes(\`誠実+${DEFAULT_PARAMS.talismans.sincerity.n}\`))).toBe(true)`

3015行目
- old: `    expect(next.lastGain?.parts).toContain('中凶: 獲得点0')`
- new: `    expect(next.lastGain?.parts.map(p => p.text)).toContain('中凶: 獲得点0')`

3164行目
- old: `    expect(next.lastGain?.parts.some(p => p.startsWith('序章'))).toBe(false)`
- new: `    expect(next.lastGain?.parts.some(p => p.text.startsWith('序章'))).toBe(false)`

3187行目
- old: `    expect(next.lastGain?.parts.some(p => p.startsWith('幕間'))).toBe(false)`
- new: `    expect(next.lastGain?.parts.some(p => p.text.startsWith('幕間'))).toBe(false)`

- [ ] **Step 7: 全テストを実行して成功を確認する**

Run: `npx vitest run src/lib/game/shidasu`
Expected: 全ファイルPASS(失敗0件)

- [ ] **Step 8: 型チェックを実行する**

Run: `npm run check`
Expected: shidasuディレクトリ関連のエラー0件

- [ ] **Step 9: コミット**

```bash
git add src/lib/game/shidasu/cardComboEffects.test.ts src/lib/game/shidasu/clearBonusEffects.test.ts src/lib/game/shidasu/directEffects.test.ts src/lib/game/shidasu/engine.test.ts src/lib/game/shidasu/itemEffects.test.ts src/lib/game/shidasu/patterns.test.ts
git commit -m "test: ScorePart構造化データへの移行に伴い既存テストを更新"
```

---

### Task 4: 仮合計計算が実際の付与得点と一致することを保証するテストを追加する

**Files:**
- Modify: `src/lib/game/shidasu/engine.test.ts`

`finalScoreFromScoreParts(lastGain.parts)`が、実際に`applyPlayCard`が計算した`lastGain.points`と必ず一致することを、複数の代表的なシナリオで確認する。

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`のファイル冒頭のimport文に以下を追加する(既存のimport文の末尾に追記):

```ts
import { finalScoreFromScoreParts } from './scoreParts'
```

377行目付近の`test('lastGain.partsの先頭に基礎点の内訳が入り...`のブロックの直後に、以下のテストを追加する:

```ts
  test('lastGain.partsから再計算した仮合計は、実際に付与されたlastGain.pointsと一致する(パターン成立あり)', () => {
    const wave = baseWave({ tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]] })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(next.lastGain).not.toBeNull()
    expect(finalScoreFromScoreParts(next.lastGain!.parts)).toBe(next.lastGain!.points)
  })

  test('lastGain.partsから再計算した仮合計は、護符を複数所持している場合も実際のlastGain.pointsと一致する', () => {
    const wave = baseWave({
      tableau: [
        [card(9, '♠', 1), card(1, '♣', 6)],
        [card(2, '♦', 2)],
      ],
      combo: 3,
    })
    const items: ItemId[] = ['springBreeze', 'courage', 'calm']
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', items, 1000000, 0, standardDeckComposition())
    expect(next.lastGain).not.toBeNull()
    expect(finalScoreFromScoreParts(next.lastGain!.parts)).toBe(next.lastGain!.points)
  })
```

このファイル内の既存の`baseWave`ヘルパー・`card`ヘルパー・`ItemId`型のimportをそのまま使う(ファイル内で既に定義・importされているはずなので、新規にimportを追加する必要はない。ファイル冒頭を確認し、`ItemId`が型としてimportされていなければ`import type { ItemId } from './types'`を追加する)。

- [ ] **Step 2: テストを実行して通ることを確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts`
Expected: PASS(Task 2でengine.tsの構造化が正しく行われていれば、追加した2件も含めて全件成功するはず)

- [ ] **Step 3: コミット**

```bash
git add src/lib/game/shidasu/engine.test.ts
git commit -m "test: ScorePartから再計算した仮合計が実際の付与得点と一致することを検証するテストを追加"
```

---

### Task 5: プレイ結果をPlayAreaへ返す配線を追加する

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`
- Modify: `src/routes/game/shidasu/PlayArea.svelte`
- Modify: `src/routes/game/shidasu/+page.svelte`

得点内訳アニメーションは、カード移動アニメ完了時に呼ばれる`onPlayCard`の**戻り値**としてそのプレイの`lastGain`/`lastBonusGains`を受け取ることで駆動する(`wave`プロパティの変化を監視するリアクティブな方式は、山札めくり由来の得点更新と区別できないため採用しない)。

- [ ] **Step 1: `types.ts`に`PlayCardResult`型を追加する**

`src/lib/game/shidasu/types.ts`の`BonusGain`インターフェースの直後に以下を追加する:

```ts
// PlayArea.svelteのonPlayCardが、プレイ結果(得点内訳アニメーションに必要な情報)を
// 呼び出し元へ同期的に返すための型。applyPlayCardが常に同期関数であることを前提にしている。
export interface PlayCardResult {
  lastGain: ScoreGain | null
  lastBonusGains: BonusGain[]
}
```

- [ ] **Step 2: `PlayArea.svelte`の`onPlayCard`プロパティの型を変更する**

`src/routes/game/shidasu/PlayArea.svelte`のimport文(5行目付近)に`PlayCardResult`, `ScoreGain`, `BonusGain`を追加する:

```svelte
  import type { WaveState, StageModifier, ItemId, RiteId, RevelationId, Card, PlayCardResult, ScoreGain, BonusGain } from '$lib/game/shidasu/types'
```

`$props()`の型定義内(29行目付近)の`onPlayCard`の型を以下に変更する:

```ts
    onPlayCard: (colIndex: number, rowIndex: number) => PlayCardResult | void
```

- [ ] **Step 3: `+page.svelte`の`handlePlayCard`が結果を返すようにする**

`src/routes/game/shidasu/+page.svelte`の`handlePlayCard`関数(108-112行目)を以下に変更する:

```ts
  function handlePlayCard(colIndex: number, rowIndex: number): PlayCardResult | void {
    if (run.phase !== 'playing' || run.wave?.status !== 'playing') return
    run = applyPlayCard(params, run, colIndex, undefined, rowIndex)
    afterAction()
    return { lastGain: run.wave?.lastGain ?? null, lastBonusGains: run.wave?.lastBonusGains ?? [] }
  }
```

`+page.svelte`のimport文に`PlayCardResult`を追加する。既存の型import行(`import type { RunState, ItemId, Suit, Rank, RiteId, RevelationId, RoleName, SpreadId, HeldRevelationOrOracleRef, ShopSlotKind } from '$lib/game/shidasu/types'`)を以下に変更する:

```ts
  import type { RunState, ItemId, Suit, Rank, RiteId, RevelationId, RoleName, SpreadId, HeldRevelationOrOracleRef, ShopSlotKind, PlayCardResult } from '$lib/game/shidasu/types'
```

- [ ] **Step 4: `PlayArea.svelte`の呼び出し箇所を戻り値を受け取れる形に変更する(次タスクで使用するのみ、このタスクではまだ何もしない)**

`startPlayCardAnimation`関数内、最後の`setTimeout`(現状)を以下に変更する:

```ts
    animationTimer2 = setTimeout(() => {
      playingAnimation = null
      onPlayCard(colIndex, rowIndex)
    }, ANIMATION_UP_MS + ANIMATION_LEFT_MS)
```

これを以下に変更する(戻り値を受け取るだけで、まだ何も使わない):

```ts
    animationTimer2 = setTimeout(() => {
      playingAnimation = null
      const result = onPlayCard(colIndex, rowIndex)
      void result
    }, ANIMATION_UP_MS + ANIMATION_LEFT_MS)
```

- [ ] **Step 5: 型チェックを実行する**

Run: `npm run check`
Expected: shidasuディレクトリ関連のエラー0件

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/routes/game/shidasu/PlayArea.svelte src/routes/game/shidasu/+page.svelte
git commit -m "feat: onPlayCardがプレイ結果(得点内訳)を返すよう配線を追加"
```

---

### Task 6: 得点内訳の順番表示・SCOREへの飛び込みアニメーションを実装する

**Files:**
- Modify: `src/routes/game/shidasu/PlayArea.svelte`

Task 5で追加した`onPlayCard`の戻り値を使い、3フェーズのアニメーション(内訳を順番に表示→合計表示→SCOREへ飛び込み)を実装する。このタスクもUIコンポーネントの変更でありSvelteコンポーネントテストは書かず、Task 7のブラウザ手動確認で動作を確かめる。

- [ ] **Step 1: importと定数を追加する**

`src/routes/game/shidasu/PlayArea.svelte`のimport文を以下のように変更する。既存の`import { onDestroy } from 'svelte'`を:

```svelte
  import { onDestroy, tick } from 'svelte'
```

に変更する。`import { nextChainSlotPosition } from '$lib/game/shidasu/chainLayout'`の直後に以下を追加する:

```svelte
  import { runningTotalsFromScoreParts, type ScorePart } from '$lib/game/shidasu/scoreParts'
```

- [ ] **Step 2: 得点内訳アニメーションの状態を追加する**

Task 2で追加した`animationTimer1`/`animationTimer2`の宣言と`onDestroy`ブロックの直後に、以下を追加する:

```ts
  const SCORE_PART_REVEAL_MS = 280
  const SCORE_FLY_UP_MS = 200
  const SCORE_FLY_TO_SCORE_MS = 250
  const SCORE_FLY_UP_DISTANCE_PX = 40
  const SCORE_FLY_UP_SCALE = 1.5

  interface ScoreRevealState {
    parts: ScorePart[]
    runningTotals: number[]
    revealedCount: number
    totalGain: number
    flyPhase: 'none' | 'up' | 'toScore'
    flyLeft: number
    flyTop: number
    flyScale: number
    flyTransitionMs: number
  }

  let scoreReveal = $state<ScoreRevealState | null>(null)
  let displayedScore = $state(wave.score)
  let scoreNumberEl: HTMLDivElement | undefined = $state()
  let totalGainEl: HTMLSpanElement | undefined = $state()

  let scoreRevealTimer: ReturnType<typeof setTimeout> | undefined
```

- [ ] **Step 3: 既存の`onDestroy`ブロックに`scoreRevealTimer`のクリーンアップを追加する**

既存の(カード移動アニメ用の)`onDestroy`ブロック:

```ts
  onDestroy(() => {
    clearTimeout(animationTimer1)
    clearTimeout(animationTimer2)
  })
```

を以下に変更する:

```ts
  onDestroy(() => {
    clearTimeout(animationTimer1)
    clearTimeout(animationTimer2)
    clearTimeout(scoreRevealTimer)
  })
```

- [ ] **Step 4: 得点内訳アニメーションの開始・進行関数を追加する**

Step 2で追加したコードブロックの直後に、以下の関数群を追加する:

```ts
  function startScoreReveal(lastGain: ScoreGain | null, lastBonusGains: BonusGain[]) {
    const allParts = [...(lastGain?.parts ?? []), ...lastBonusGains.flatMap(g => g.parts)]
    if (allParts.length === 0) {
      displayedScore = wave.score
      return
    }
    const runningTotals = runningTotalsFromScoreParts(allParts)
    const totalGain = (lastGain?.points ?? 0) + lastBonusGains.reduce((sum, g) => sum + g.points, 0)
    clearTimeout(scoreRevealTimer)
    scoreReveal = {
      parts: allParts,
      runningTotals,
      revealedCount: 1,
      totalGain,
      flyPhase: 'none',
      flyLeft: 0,
      flyTop: 0,
      flyScale: 1,
      flyTransitionMs: 0,
    }
    if (allParts.length === 1) {
      // パーツが1つだけの地味なプレイは、DOMの初回描画を待ってから即座に飛び込みアニメへ進む
      // (bind:thisで参照するtotalGainElが、直前のscoreReveal代入によってまだDOMに描画されていない
      // 可能性があるため、tick()でSvelteの描画反映を待つ)
      tick().then(() => startScoreFly())
    } else {
      scoreRevealTimer = setTimeout(revealNextScorePart, SCORE_PART_REVEAL_MS)
    }
  }

  function revealNextScorePart() {
    if (!scoreReveal) return
    if (scoreReveal.revealedCount < scoreReveal.parts.length) {
      scoreReveal = { ...scoreReveal, revealedCount: scoreReveal.revealedCount + 1 }
      scoreRevealTimer = setTimeout(revealNextScorePart, SCORE_PART_REVEAL_MS)
    } else {
      startScoreFly()
    }
  }

  function startScoreFly() {
    if (!scoreReveal || !totalGainEl || !scoreNumberEl) {
      finishScoreReveal()
      return
    }
    const fromRect = totalGainEl.getBoundingClientRect()
    const toRect = scoreNumberEl.getBoundingClientRect()
    scoreReveal = { ...scoreReveal, flyPhase: 'up', flyLeft: fromRect.left, flyTop: fromRect.top, flyScale: 1, flyTransitionMs: 0 }
    // transitionMs:0でのスタイル変更をブラウザが実際に描画へ反映してから次のtransitionを開始するために
    // 2段rAFが必要。1段のrAFだけだと同一フレーム内でスタイル変更がバッチ処理され、transitionが
    // 発生しないブラウザがある(カード移動アニメのワープ処理と同じ理由)。
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!scoreReveal) return
        scoreReveal = {
          ...scoreReveal,
          flyLeft: fromRect.left,
          flyTop: fromRect.top - SCORE_FLY_UP_DISTANCE_PX,
          flyScale: SCORE_FLY_UP_SCALE,
          flyTransitionMs: SCORE_FLY_UP_MS,
        }
      })
    })
    scoreRevealTimer = setTimeout(() => {
      if (!scoreReveal) return
      scoreReveal = { ...scoreReveal, flyPhase: 'toScore', flyLeft: toRect.left, flyTop: toRect.top, flyScale: 1, flyTransitionMs: SCORE_FLY_TO_SCORE_MS }
      scoreRevealTimer = setTimeout(finishScoreReveal, SCORE_FLY_TO_SCORE_MS)
    }, SCORE_FLY_UP_MS)
  }

  function finishScoreReveal() {
    displayedScore = wave.score
    scoreReveal = null
  }
```

`ScoreGain`, `BonusGain`は既にTask 5でimport済みなので追加不要。

- [ ] **Step 5: `onPlayCard`の戻り値で得点内訳アニメーションを開始する**

Task 5のStep 4で追加した仮のコードを、以下に置き換える:

```ts
    animationTimer2 = setTimeout(() => {
      playingAnimation = null
      const result = onPlayCard(colIndex, rowIndex)
      if (result) startScoreReveal(result.lastGain, result.lastBonusGains)
    }, ANIMATION_UP_MS + ANIMATION_LEFT_MS)
```

- [ ] **Step 6: 場札・山札・秘儀・天啓の操作ロックに得点内訳アニメーション中も含める**

場札のカードボタンの`disabled`条件(`disabled={playingAnimation !== null}`)を以下に変更する:

```svelte
                disabled={playingAnimation !== null || scoreReveal !== null}
```

山札めくりボタンの`disabled`条件を以下に変更する:

```svelte
    disabled={wave.stock.length === 0 || !allowDraw || playingAnimation !== null || scoreReveal !== null}
```

秘儀ボタンの`usable`計算を以下に変更する:

```svelte
      {@const usable = canUseRite(params, wave, riteId) && playingAnimation === null && scoreReveal === null}
```

天啓ボタンの`usable`計算を以下に変更する:

```svelte
      {@const usable = canUseRevelation(params, wave, revelationId) && playingAnimation === null && scoreReveal === null}
```

- [ ] **Step 7: SCORE表示に`bind:this`を追加し、`wave.score`を`displayedScore`に置き換える**

SCORE/TARGET表示ブロックを以下に変更する:

```svelte
      <div>
        <div class="text-xs text-emerald-300/70 tracking-widest">SCORE / TARGET</div>
        <div bind:this={scoreNumberEl} class="text-xl font-black text-amber-50 tabular-nums">
          {displayedScore} <span class="text-sm text-emerald-300/70">/ {target}</span>
        </div>
      </div>
```

- [ ] **Step 8: 得点内訳の表示ブロックを、順番表示に対応させる**

既存の内訳表示ブロック(`{#if wave.lastGain || wave.lastBonusGains.length > 0} ... {:else} ... {/if}`)を以下に置き換える。乗算ステップの直後は仮合計が小数になり得るため、表示時のみ`Math.round`で丸める(`scoreReveal.runningTotals`自体は丸めず、最終的な`scoreReveal.totalGain`は既にengine側で床関数済みの正しい値をそのまま使う):

```svelte
  {#if scoreReveal}
    <div class="text-right text-sm h-5">
      {#if scoreReveal.flyPhase === 'none'}
        <span bind:this={totalGainEl} class="text-yellow-300 font-black">+{Math.round(scoreReveal.runningTotals[scoreReveal.revealedCount - 1])}</span>
        <span class="text-emerald-200 text-xs ml-2">{scoreReveal.parts.slice(0, scoreReveal.revealedCount).map(p => p.text).join(' ')}</span>
      {/if}
    </div>
  {:else if wave.lastGain || wave.lastBonusGains.length > 0}
    {@const totalPoints = (wave.lastGain?.points ?? 0) + wave.lastBonusGains.reduce((sum, g) => sum + g.points, 0)}
    {@const allParts = [...(wave.lastGain?.parts ?? []), ...wave.lastBonusGains.flatMap(g => g.parts)]}
    <div class="text-right text-sm h-5">
      <span class="text-yellow-300 font-black">+{totalPoints}</span>
      {#if allParts.length > 0}
        <span class="text-emerald-200 text-xs ml-2">{allParts.map(p => p.text).join(' ')}</span>
      {/if}
    </div>
  {:else}
    <div class="h-5"></div>
  {/if}
```

`scoreReveal === null`かつ`wave.lastGain`がある場合(=山札めくりによる得点)は、従来通りその場で全内訳を表示する静的な分岐にフォールバックする。

- [ ] **Step 9: SCOREへ飛び込むオーバーレイを追加する**

ファイル末尾、カード移動アニメのオーバーレイ(`{#if playingAnimation} ... {/if}`)の直後に、以下を追加する:

```svelte
{#if scoreReveal && scoreReveal.flyPhase !== 'none'}
  <div
    class="fixed pointer-events-none z-[100] ease-out text-yellow-300 font-black text-lg"
    style="left:{scoreReveal.flyLeft}px; top:{scoreReveal.flyTop}px; transform: scale({scoreReveal.flyScale}); transition-property: left, top, transform; transition-duration:{scoreReveal.flyTransitionMs}ms;"
  >+{scoreReveal.totalGain}</div>
{/if}
```

- [ ] **Step 10: 型チェックを実行する**

Run: `npm run check`
Expected: `PlayArea.svelte`に関するエラーが0件(既存の無関係な警告・他ファイルのエラーは無視してよい)

- [ ] **Step 11: コミット**

```bash
git add src/routes/game/shidasu/PlayArea.svelte
git commit -m "feat: 場札プレイ時に得点内訳を順番表示しSCOREへ飛び込むアニメーションを追加"
```

---

### Task 7: ビルド・型チェック・ブラウザでの動作確認

**Files:** なし(検証のみ)

- [ ] **Step 1: 全体ビルドを実行する**

Run: `npm run build`
Expected: `✓ built` で成功終了

- [ ] **Step 2: 型チェックを実行する**

Run: `npm run check`
Expected: shidasuディレクトリ関連のエラー0件(他ツールの既存エラー・警告は無視)

- [ ] **Step 3: 全体のユニットテストを実行する**

Run: `npx vitest run src/lib/game/shidasu`
Expected: 全件PASS

- [ ] **Step 4: devサーバーを起動しブラウザで確認する**

Run: `npm run dev`

`http://localhost:5173/game/shidasu` を開き、以下を確認する:
- パターン・役・護符ボーナスが複数発生するプレイをして、内訳が1つずつ順番にハイライト表示され、各ステップの仮合計が表示されること
- 全内訳の表示が終わった後、「+合計加点数」が上方向に拡大しながら移動し、続いてSCORE表示位置へ縮小しながら移動して消えること
- そのタイミングでSCORE数字が新しい値に更新されること
- 得点内訳アニメーション中は場札・山札・秘儀・天啓のいずれもクリックできないこと
- パターン・役が一切発生しない地味なプレイ(基礎点のみ)でも、順番表示はスキップされて即座に合計が表示され、SCOREへの飛び込みアニメは通常通り実行されること
- 山札をめくって得点が発生した場合(パターン継続時)は、従来通り即座に内訳が表示される静的な見た目のままであること(順番アニメは発生しない)
- 複数回連続でプレイしても、アニメーションや表示が壊れずに繰り返し動作すること

- [ ] **Step 5: 問題があれば修正し、再度Step 1-4を実行する。問題なければ完了**

---

## Self-Review メモ(実装者は読み飛ばしてよい)

- spec要件「基礎点・パターン・役・護符・コンボ倍率などを順番に強調表示しつつ仮合計を表示」は Task 6 の Step 4・Step 8 でカバーしている。
- spec要件「山札めくり経由の得点は対象外」は Task 5(onPlayCardの戻り値ベースで駆動、山札めくりは`onDraw`という別callbackのため混入しない)と Task 6 Step 8 の`{:else if wave.lastGain ...}`フォールバック(静的表示のまま)で担保している。
- spec要件「パーツが1つだけなら即時表示」は Task 6 Step 4 の`startScoreReveal`内の`if (allParts.length === 1)`分岐で担保している。
- spec要件「SCORE数字は飛び込みアニメ完了後に更新」は Task 6 Step 4 の`displayedScore`(ローカルstate、`finishScoreReveal`でのみ更新)と Step 7 の表示置き換えで担保している。
- spec要件「得点内訳アニメ中は操作をブロック」は Task 6 Step 6 で担保している。
- 仮合計の正確性(spec「実際に付与された得点と一致する」)は Task 1 の`runningTotalsFromScoreParts`/`finalScoreFromScoreParts`と、Task 4 の一致検証テストで担保している。
- 全消しボーナス(`全消しボーナス`というBonusGain、`remainingBeforeRevival === 0`時に発生)もengine.ts側でScorePart化しており(Task 2 Step 9)、UIの`lastBonusGains`結合ロジック(Task 6 Step 4)により同じ一連の演出に含まれる。
