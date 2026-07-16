# Shidasu スコア計算式並び替え・護符4種の効果変更 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** コンボ倍率をスコア計算の最後に一括適用するよう並び替え、流星・序章・幕間・瑠璃の4護符の発動条件・効果を変更する。

**Architecture:** `src/lib/game/shidasu/engine.ts`の`playCard`・`drawStock`のスコアリングロジックを中心に変更する。`ItemEffectContext`・`DirectEffectContext`・`ChainBonusResult`という3つの共有コンテキスト/結果型に新規フィールドを追加し、それぞれ複数の構築箇所(本体コード4箇所超、テストヘルパー14+1箇所)を漏れなく更新する必要がある。

**Tech Stack:** TypeScript、Vitest。

---

## 前提知識(実装前に把握しておくこと)

- **過去の教訓**: このプロジェクトでは、コンテキスト型(`ItemEffectContext`等)に必須フィールドを追加した際、本体コードの構築箇所を1つ見落として`npm run build`(esbuildは型チェックしない)では検出されず`npm run check`でのみ発覚した実例が複数回ある。今回も`ItemEffectContext`・`DirectEffectContext`・`ChainBonusResult`に新規フィールドを追加するため、各タスクで**必ず**該当型の全構築箇所をgrepし、本体コード(`engine.ts`)とテストコード(`engine.test.ts`)の両方を漏れなく更新すること。
- `ItemEffectContext`の構築箇所は本体コードに2箇所(`playCard`の`itemEffectCtx`、`drawStock`の`naiveCtx`)、テストコードに14箇所(`describe`ブロックごとにローカルな`function ctx(overrides) {...}`ヘルパーが14個存在、全て同じ形)。
- `DirectEffectContext`の構築箇所は本体コードに4箇所(`playCard`の`milestoneCtx`、`drawStock`の`stockEmptyCtx`・`drawContinueCtx`・`resetCtx`)、テストコードに1箇所(`function directCtx(overrides) {...}`)。
- `ChainBonusResult`の構築箇所は本体コード側は`evaluateChainBonus`内の2箇所(空チェーン時の早期return、通常の最終return)のみ(他は全て`evaluateChainBonus`の戻り値をスプレッドして使っているため自動追従する)。テストコード側は`chainBonus: { bonus: 0, parts: [], patternFired: ..., roleFired: [...] }`という形のリテラルが約25箇所ある。
- `npm run check`(型チェック)は`npm run build`では検出されないため、各タスクで必ず実行する。

---

## ファイル構成

- `src/lib/game/shidasu/engine.ts`(修正): 本feature の中心。多数の関数を修正
- `src/lib/game/shidasu/engine.test.ts`(修正): 新規テスト追加、既存テストヘルパー・アサーションの更新
- `src/lib/game/shidasu/params.ts`(修正): `talismans.shootingStar`のパラメータ形状変更(`n`→`p`)
- `src/lib/game/shidasu/shidasu.config.json`(修正): 同上

---

### Task 1: `ChainBonusResult`に`patternFiredCount`を追加する

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の`describe('evaluateChainBonus', ...)`ブロック内(`evaluateChainBonus`を直接テストしている`describe`を探す)に、以下を追加する。

```ts
  test('同スート・階段が同時成立すると、patternFiredCountが2になる', () => {
    // 実カード3枚を同スート(♠)かつ連続ランク(3,4,5)にして、同スートと階段の両方を成立させる。
    const chainBefore = [card(20, '♠', 3), card(21, '♠', 4)]
    const result = evaluateChainBonus(DEFAULT_PARAMS.scoring, chainBefore, card(22, '♠', 5))
    expect(result.parts).toContain(`同スート+${DEFAULT_PARAMS.scoring.suitBonus}`)
    expect(result.parts.some(p => p.startsWith('階段'))).toBe(true)
    expect(result.patternFiredCount).toBe(2)
  })

  test('パターンボーナスが1種類も成立しなければpatternFiredCountは0', () => {
    const chainBefore = [card(20, '♠', 3)]
    const result = evaluateChainBonus(DEFAULT_PARAMS.scoring, chainBefore, card(21, '♦', 9))
    expect(result.patternFiredCount).toBe(0)
  })
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run engine.test -t "patternFiredCount"`
Expected: FAIL(`result.patternFiredCount`が`undefined`)

- [ ] **Step 3: `ChainBonusResult`型と`evaluateChainBonus`を実装する**

`src/lib/game/shidasu/engine.ts`の

```ts
export interface ChainBonusResult {
  bonus: number
  parts: string[]
  // 同スート/同色/階段のいずれかの「パターンボーナス」が成立したか
  patternFired: boolean
```

を、以下に置き換える。

```ts
export interface ChainBonusResult {
  bonus: number
  parts: string[]
  // 同スート/同色/階段のいずれかの「パターンボーナス」が成立したか
  patternFired: boolean
  // 成立したパターンボーナスの種類数(同スート/同色のいずれかで+1、階段でさらに+1。最大2)。瑠璃が参照する。
  patternFiredCount: number
```

同ファイルの

```ts
  if (chainBefore.length === 0) {
    return { bonus: 0, parts: [], patternFired: false, roleFired: [] }
  }

  let bonus = 0
  const parts: string[] = []
  let patternFired = false
  const roleFired: { name: RoleName; usedWild: boolean; amount: number }[] = []

  const chainIncludingThis = [...chainBefore, card]

  const { suitHeld, colorHeld } = analyzeSuitColor(chainIncludingThis)
  if (chainIncludingThis.length >= suitColorMinLen) {
    if (suitHeld) {
      bonus += scoring.suitBonus
      parts.push(`同スート+${scoring.suitBonus}`)
      patternFired = true
    } else if (colorHeld) {
      bonus += scoring.colorBonus
      parts.push(`同色+${scoring.colorBonus}`)
      patternFired = true
    }
  }

  const stairInfo = analyzeStair(chainIncludingThis)
  if (stairInfo.held && stairInfo.len >= stairMinLen) {
    bonus += scoring.stairBonus
    parts.push(`階段${stairInfo.len} +${scoring.stairBonus}`)
    patternFired = true
  }
```

を、以下に置き換える。

```ts
  if (chainBefore.length === 0) {
    return { bonus: 0, parts: [], patternFired: false, patternFiredCount: 0, roleFired: [] }
  }

  let bonus = 0
  const parts: string[] = []
  let patternFired = false
  let patternFiredCount = 0
  const roleFired: { name: RoleName; usedWild: boolean; amount: number }[] = []

  const chainIncludingThis = [...chainBefore, card]

  const { suitHeld, colorHeld } = analyzeSuitColor(chainIncludingThis)
  if (chainIncludingThis.length >= suitColorMinLen) {
    if (suitHeld) {
      bonus += scoring.suitBonus
      parts.push(`同スート+${scoring.suitBonus}`)
      patternFired = true
      patternFiredCount += 1
    } else if (colorHeld) {
      bonus += scoring.colorBonus
      parts.push(`同色+${scoring.colorBonus}`)
      patternFired = true
      patternFiredCount += 1
    }
  }

  const stairInfo = analyzeStair(chainIncludingThis)
  if (stairInfo.held && stairInfo.len >= stairMinLen) {
    bonus += scoring.stairBonus
    parts.push(`階段${stairInfo.len} +${scoring.stairBonus}`)
    patternFired = true
    patternFiredCount += 1
  }
```

同ファイルの`evaluateChainBonus`最終行

```ts
  return { bonus, parts, patternFired, roleFired }
}
```

を、以下に置き換える。

```ts
  return { bonus, parts, patternFired, patternFiredCount, roleFired }
}
```

- [ ] **Step 4: テストコード側の全構築箇所を一括修正する**

`src/lib/game/shidasu/engine.test.ts`に対して以下のコマンドを実行し、`patternFired: false, roleFired`という形の全ての`ChainBonusResult`リテラル(大多数を占める)に`patternFiredCount: 0`を挿入する。

```bash
sed -i 's/patternFired: false, roleFired/patternFired: false, patternFiredCount: 0, roleFired/g' src/lib/game/shidasu/engine.test.ts
```

続けて、このsedパターンに一致しない残り2箇所を手動で修正する。

`src/lib/game/shidasu/engine.test.ts`内、複数行にまたがる

```ts
    const chainBonus = {
      bonus: 0, parts: [], patternFired: false,
      roleFired: [{ name: 'flush' as const, usedWild: false, amount: 0 }, { name: 'sameRank' as const, usedWild: false, amount: 0 }],
    }
```

を、以下に置き換える(このリテラルはTask 4で瑠璃のテストとして書き換えるため、ここでは型エラーを消すためだけの暫定対応でよい)。

```ts
    const chainBonus = {
      bonus: 0, parts: [], patternFired: false, patternFiredCount: 0,
      roleFired: [{ name: 'flush' as const, usedWild: false, amount: 0 }, { name: 'sameRank' as const, usedWild: false, amount: 0 }],
    }
```

`src/lib/game/shidasu/engine.test.ts`内の

```ts
    const withPattern = { bonus: 0, parts: [], patternFired: true, roleFired: [] }
```

を、以下に置き換える。

```ts
    const withPattern = { bonus: 0, parts: [], patternFired: true, patternFiredCount: 1, roleFired: [] }
```

- [ ] **Step 5: テストを実行して成功を確認する**

Run: `npm run test`
Expected: 全テスト成功

- [ ] **Step 6: 型チェック・ビルド**

Run: `npm run check && npm run build`
Expected: どちらもエラーなく成功。`grep -n "patternFired: false, roleFired\|patternFired: true, roleFired" src/lib/game/shidasu/engine.test.ts`が0件であることを確認する(全て`patternFiredCount`付きに置き換わっているはず)。

- [ ] **Step 7: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: ChainBonusResultにpatternFiredCountを追加

同スート/同色・階段のパターンボーナスが実際に何種類成立したかを
カウントするフィールドを追加した。瑠璃の護符修正(次タスク)の
土台となる。既存の判定ロジック・返り値の他フィールドは変更なし。
EOF
)"
```

---

### Task 2: `playCard`でコンボ倍率を最後に一括適用するよう並び替える

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の`describe('playCard', ...)`ブロック内に、以下を追加する。

```ts
  test('コンボ倍率は護符のgained加算効果にも適用される(最後に一括適用)', () => {
    // 春風(springBreeze)は♣を取ったときn点の固定加算。コンボ3(倍率1.2)の状態でプレイし、
    // 固定加算分にもコンボ倍率がかかっていることを確認する。
    const items: ItemId[] = ['springBreeze']
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      combo: 2,
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', items, 1000000, 0)
    const multiplier = 1 + (3 - 1) * scoring.comboMultiplierStep
    const expectedGained = Math.floor((scoring.basePoint + DEFAULT_PARAMS.talismans.springBreeze.n) * multiplier)
    expect(next.lastGain?.points).toBe(expectedGained)
  })
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run engine.test -t "コンボ倍率は護符のgained加算効果にも適用される"`
Expected: FAIL(現行実装では春風の加算がコンボ倍率の対象外のため、期待値と一致しない)

- [ ] **Step 3: `playCard`を実装する**

`src/lib/game/shidasu/engine.ts`の`playCard`内、

```ts
  const comboMultiplierStep = params.scoring.comboMultiplierStep
  const multiplier = 1 + (effectiveCombo - 1) * comboMultiplierStep
  if (multiplier !== 1) parts.push(`コンボ倍率×${fmtMultiplier(multiplier)}`)
  const rawGained = Math.floor(base * multiplier)
  const itemResult = applyItemEffects('gained', rawGained, items, itemEffectCtx, params)
  parts.push(...itemResult.parts)
  let gained = Math.floor(itemResult.value)
```

を、以下に置き換える。

```ts
  const itemResult = applyItemEffects('gained', base, items, itemEffectCtx, params)
  parts.push(...itemResult.parts)

  const comboMultiplierStep = params.scoring.comboMultiplierStep
  const multiplier = 1 + (effectiveCombo - 1) * comboMultiplierStep
  if (multiplier !== 1) parts.push(`コンボ倍率×${fmtMultiplier(multiplier)}`)
  let gained = Math.floor(itemResult.value * multiplier)
```

(護符の`gained`効果をコンボ倍率適用前の`base`に対して適用し、最後にコンボ倍率を一度だけかける形になる。`parts`内の「コンボ倍率×N」の表示位置も、計算順序に合わせて護符効果の内訳より後ろに移動する。)

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npm run test`
Expected: 全テスト成功。既存テストの中に`parts`配列の並び順を厳密に検証しているものがあれば、失敗内容を確認し、新しい計算順序を反映した期待値に更新する(内容自体は変えず、「コンボ倍率×N」の出現位置のみが変わる想定)。

- [ ] **Step 5: 型チェック・ビルド**

Run: `npm run check && npm run build`
Expected: どちらもエラーなく成功

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: playCardでコンボ倍率を最後に一括適用するよう並び替え

これまでbase(基礎点+チェーンボーナス+列一掃)にコンボ倍率をかけた後
護符のgained効果を適用していたが、逆に護符のgained効果を先に全て
適用してから最後にコンボ倍率を一度だけかけるようにした。加算型護符
(春風など)もコンボ倍率でスケールするようになる。全消しボーナス・
護符の直接加算はこれまで通りコンボ倍率の対象外のまま。
EOF
)"
```

---

### Task 3: `drawStock`(naive分岐)でもコンボ倍率を最後に一括適用するよう並び替える

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の`describe('drawStock', ...)`ブロック内に、以下を追加する。

```ts
  test('素朴(naive)のスコアリングでも、コンボ倍率は護符のgained加算効果に最後に適用される', () => {
    const items: ItemId[] = ['naive', 'springBreeze']
    const wave = makeWave({
      foundation: card(0, '♥', 3),
      combo: 2,
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      stock: [card(9, '♦', 7)],
      chain: [card(20, '♥', 3), card(21, '♦', 9), card(22, '♥', 2)],
      linked: true,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, items, standardDeckComposition(), 'none')
    expect(next.lastDrawEffect).toBe('pattern')
    const multiplier = 1 + (3 - 1) * scoring.comboMultiplierStep
    // ♦カードを引くため春風(♣専用)は発動しない。基礎点のみにコンボ倍率がかかる想定。
    const expectedGained = Math.floor(scoring.basePoint * multiplier)
    expect(next.lastGain?.points).toBe(expectedGained)
  })
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run engine.test -t "素朴(naive)のスコアリングでも"`
Expected: FAIL(現行実装では並び替え前のため、`scoring`変数が`describe('drawStock', ...)`スコープに無ければ`DEFAULT_PARAMS.scoring`に読み替えてよい。まずは計算順序の違いにより期待値と一致せずFAILすることを確認する)

- [ ] **Step 3: `drawStock`のnaive分岐を実装する**

`src/lib/game/shidasu/engine.ts`の`drawStock`内、

```ts
      const comboMultiplierStep = params.scoring.comboMultiplierStep
      const multiplier = 1 + (effectiveCombo - 1) * comboMultiplierStep
      if (multiplier !== 1) parts.push(`コンボ倍率×${fmtMultiplier(multiplier)}`)
      const rawGained = Math.floor(base * multiplier)
      const itemResult = applyItemEffects('gained', rawGained, items, naiveCtx, params)
      parts.push(...itemResult.parts)
      naiveGained = Math.floor(itemResult.value)
```

を、以下に置き換える。

```ts
      const itemResult = applyItemEffects('gained', base, items, naiveCtx, params)
      parts.push(...itemResult.parts)

      const comboMultiplierStep = params.scoring.comboMultiplierStep
      const multiplier = 1 + (effectiveCombo - 1) * comboMultiplierStep
      if (multiplier !== 1) parts.push(`コンボ倍率×${fmtMultiplier(multiplier)}`)
      naiveGained = Math.floor(itemResult.value * multiplier)
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npm run test`
Expected: 全テスト成功

- [ ] **Step 5: 型チェック・ビルド**

Run: `npm run check && npm run build`
Expected: どちらもエラーなく成功

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: drawStock(素朴)でもコンボ倍率を最後に一括適用するよう並び替え

playCardと同じ並び替えを、素朴の護符による山札めくり時のスコア
計算にも適用した。
EOF
)"
```

---

### Task 4: 瑠璃の護符を「役+パターンの成立数合計2以上」で発動するよう変更する

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 既存テストを新仕様のテストに置き換える**

`src/lib/game/shidasu/engine.test.ts`の

```ts
  test('瑠璃: 役ボーナスが2種類以上同時発生していれば倍算', () => {
    const chainBonus = {
      bonus: 0, parts: [], patternFired: false, patternFiredCount: 0,
      roleFired: [{ name: 'flush' as const, usedWild: false, amount: 0 }, { name: 'sameRank' as const, usedWild: false, amount: 0 }],
    }
    const fired = applyItemEffects('gained', 100, ['lapis'], ctx({ chainBonus }), params)
    expect(fired.value).toBe(100 * params.talismans.lapis.x)
    const singleRole = { bonus: 0, parts: [], patternFired: false, roleFired: [{ name: 'flush' as const, usedWild: false, amount: 0 }] }
    const notFired = applyItemEffects('gained', 100, ['lapis'], ctx({ chainBonus: singleRole }), params)
    expect(notFired.value).toBe(100)
  })
```

を、以下に置き換える。

```ts
  test('瑠璃: 役ボーナス2種類以上の同時発生でも倍算(従来の役のみパターンでも成立)', () => {
    const chainBonus = {
      bonus: 0, parts: [], patternFired: false, patternFiredCount: 0,
      roleFired: [{ name: 'flush' as const, usedWild: false, amount: 0 }, { name: 'sameRank' as const, usedWild: false, amount: 0 }],
    }
    const fired = applyItemEffects('gained', 100, ['lapis'], ctx({ chainBonus }), params)
    expect(fired.value).toBe(100 * params.talismans.lapis.x)
  })

  test('瑠璃: 役ボーナス1種類のみでは発動しない', () => {
    const singleRole = { bonus: 0, parts: [], patternFired: false, patternFiredCount: 0, roleFired: [{ name: 'flush' as const, usedWild: false, amount: 0 }] }
    const notFired = applyItemEffects('gained', 100, ['lapis'], ctx({ chainBonus: singleRole }), params)
    expect(notFired.value).toBe(100)
  })

  test('瑠璃: 役ボーナス1種類+パターンボーナス1種類の組み合わせでも倍算', () => {
    const roleAndPattern = {
      bonus: 0, parts: [], patternFired: true, patternFiredCount: 1,
      roleFired: [{ name: 'flush' as const, usedWild: false, amount: 0 }],
    }
    const fired = applyItemEffects('gained', 100, ['lapis'], ctx({ chainBonus: roleAndPattern }), params)
    expect(fired.value).toBe(100 * params.talismans.lapis.x)
  })

  test('瑠璃: パターンボーナス2種類(同スート+階段)の組み合わせのみでも倍算', () => {
    const bothPatterns = { bonus: 0, parts: [], patternFired: true, patternFiredCount: 2, roleFired: [] }
    const fired = applyItemEffects('gained', 100, ['lapis'], ctx({ chainBonus: bothPatterns }), params)
    expect(fired.value).toBe(100 * params.talismans.lapis.x)
  })

  test('瑠璃: パターンボーナス1種類のみでは発動しない', () => {
    const singlePattern = { bonus: 0, parts: [], patternFired: true, patternFiredCount: 1, roleFired: [] }
    const notFired = applyItemEffects('gained', 100, ['lapis'], ctx({ chainBonus: singlePattern }), params)
    expect(notFired.value).toBe(100)
  })
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run engine.test -t "瑠璃"`
Expected: 新規追加した「役ボーナス1種類+パターンボーナス1種類」「パターンボーナス2種類」の2件がFAIL(現行実装は`roleFired.length`のみを見ているため)

- [ ] **Step 3: `lapis`の効果を実装する**

`src/lib/game/shidasu/engine.ts`の

```ts
  lapis: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.chainBonus.roleFired.length < 2) return { value: v, part: null }
      const factor = p.talismans.lapis.x
      return { value: v * factor, part: `瑠璃×${fmtMultiplier(factor)}` }
    },
  },
```

を、以下に置き換える。

```ts
  lapis: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const total = ctx.chainBonus.roleFired.length + ctx.chainBonus.patternFiredCount
      if (total < 2) return { value: v, part: null }
      const factor = p.talismans.lapis.x
      return { value: v * factor, part: `瑠璃×${fmtMultiplier(factor)}` }
    },
  },
```

- [ ] **Step 4: `itemDesc`の瑠璃の説明文を更新する**

`src/lib/game/shidasu/engine.ts`の

```ts
    case 'lapis': return `2種類以上の役ボーナスが同時に発生したとき、獲得点を${params.talismans.lapis.x}倍`
```

を、以下に置き換える。

```ts
    case 'lapis': return `役ボーナス・パターンボーナス(同スート/同色・階段)をあわせて2種類以上成立したとき、獲得点を${params.talismans.lapis.x}倍`
```

- [ ] **Step 5: テストを実行して成功を確認する**

Run: `npm run test`
Expected: 全テスト成功

- [ ] **Step 6: 型チェック・ビルド**

Run: `npm run check && npm run build`
Expected: どちらもエラーなく成功

- [ ] **Step 7: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: 瑠璃の護符を役+パターンの成立数合計2以上で発動するよう変更

これまで役ボーナス(フラッシュ・ロイヤル等)が2種類以上同時発生した
場合のみ発動していたが、パターンボーナス(同スート/同色・階段)の
成立数も合算し、合計2以上で発動するようにした。
EOF
)"
```

---

### Task 5: `DirectEffectContext`に`previousCombo`・`scoreAfterGained`を追加する

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の`describe('applyDirectEffects', ...)`ブロック内に、以下を追加する(この時点ではまだ`shootingStar`自体は旧仕様のままなので、`directCtx`が新フィールドを受け付けることだけを確認する)。

```ts
  test('directCtxはpreviousCombo・scoreAfterGainedを受け付ける(型の確認)', () => {
    const c = directCtx({ previousCombo: 5, scoreAfterGained: 1000 })
    expect(c.previousCombo).toBe(5)
    expect(c.scoreAfterGained).toBe(1000)
  })
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run engine.test -t "previousCombo・scoreAfterGained"`
Expected: FAIL(型エラー、`DirectEffectContext`に該当フィールドが無い)

- [ ] **Step 3: `DirectEffectContext`型を拡張する**

`src/lib/game/shidasu/engine.ts`の

```ts
export interface DirectEffectContext {
  comboBeforeReset: number
  hasPlayableColumns: boolean
  roleFiredThisChain: boolean
  remainingTableauCount: number
  combo: number
  colorHeld: boolean
}
```

を、以下に置き換える。

```ts
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
```

- [ ] **Step 4: 本体コードの4つの構築箇所を更新する**

`src/lib/game/shidasu/engine.ts`の`playCard`内、

```ts
  const milestoneCtx: DirectEffectContext = {
    comboBeforeReset: 0,
    hasPlayableColumns: true,
    roleFiredThisChain: newRoleFiredThisChain,
    remainingTableauCount: remaining,
    combo: newCombo,
    colorHeld: false,
  }
  const milestoneResult = applyDirectEffects('comboMilestoneDirect', items, milestoneCtx, params)

  const newScore = wave.score + gained + milestoneResult.value
```

を、以下に置き換える。

```ts
  const scoreAfterGained = wave.score + gained

  const milestoneCtx: DirectEffectContext = {
    comboBeforeReset: 0,
    hasPlayableColumns: true,
    roleFiredThisChain: newRoleFiredThisChain,
    remainingTableauCount: remaining,
    combo: newCombo,
    colorHeld: false,
    previousCombo: wave.combo,
    scoreAfterGained,
  }
  const milestoneResult = applyDirectEffects('comboMilestoneDirect', items, milestoneCtx, params)

  const newScore = scoreAfterGained + milestoneResult.value
```

`drawStock`内、以下3箇所それぞれに`previousCombo: wave.combo,`と`scoreAfterGained: wave.score,`を追加する(この3チャンネルは流星と無関係のため、`scoreAfterGained`は「このアクション時点のスコア」を意味のある値として渡しておく)。

```ts
    const stockEmptyCtx: DirectEffectContext = {
      comboBeforeReset: 0,
      hasPlayableColumns: true,
      roleFiredThisChain: false,
      remainingTableauCount: remainingCount(wave.tableau),
      combo: wave.combo,
      colorHeld: false,
    }
```

を、以下に置き換える。

```ts
    const stockEmptyCtx: DirectEffectContext = {
      comboBeforeReset: 0,
      hasPlayableColumns: true,
      roleFiredThisChain: false,
      remainingTableauCount: remainingCount(wave.tableau),
      combo: wave.combo,
      colorHeld: false,
      previousCombo: wave.combo,
      scoreAfterGained: wave.score,
    }
```

```ts
    const drawContinueCtx: DirectEffectContext = {
      comboBeforeReset: 0,
      hasPlayableColumns: true,
      roleFiredThisChain: false,
      remainingTableauCount: remainingCount(wave.tableau),
      combo: wave.combo,
      colorHeld: colorHeld && !suitHeld,
    }
```

を、以下に置き換える。

```ts
    const drawContinueCtx: DirectEffectContext = {
      comboBeforeReset: 0,
      hasPlayableColumns: true,
      roleFiredThisChain: false,
      remainingTableauCount: remainingCount(wave.tableau),
      combo: wave.combo,
      colorHeld: colorHeld && !suitHeld,
      previousCombo: wave.combo,
      scoreAfterGained: wave.score,
    }
```

```ts
  const resetCtx: DirectEffectContext = {
    comboBeforeReset: wave.combo,
    hasPlayableColumns,
    roleFiredThisChain: wave.roleFiredThisChain,
    remainingTableauCount: remainingCount(wave.tableau),
    combo: wave.combo,
    colorHeld: false,
  }
```

を、以下に置き換える。

```ts
  const resetCtx: DirectEffectContext = {
    comboBeforeReset: wave.combo,
    hasPlayableColumns,
    roleFiredThisChain: wave.roleFiredThisChain,
    remainingTableauCount: remainingCount(wave.tableau),
    combo: wave.combo,
    colorHeld: false,
    previousCombo: wave.combo,
    scoreAfterGained: wave.score,
  }
```

- [ ] **Step 5: テストコード側の`directCtx`ヘルパーを更新する**

`src/lib/game/shidasu/engine.test.ts`の

```ts
  function directCtx(overrides: Partial<DirectEffectContext> = {}): DirectEffectContext {
    return {
      comboBeforeReset: 0,
      hasPlayableColumns: true,
      roleFiredThisChain: false,
      remainingTableauCount: 10,
      combo: 1,
      colorHeld: false,
      ...overrides,
    }
  }
```

を、以下に置き換える。

```ts
  function directCtx(overrides: Partial<DirectEffectContext> = {}): DirectEffectContext {
    return {
      comboBeforeReset: 0,
      hasPlayableColumns: true,
      roleFiredThisChain: false,
      remainingTableauCount: 10,
      combo: 1,
      colorHeld: false,
      previousCombo: 0,
      scoreAfterGained: 0,
      ...overrides,
    }
  }
```

- [ ] **Step 6: テストを実行して成功を確認する**

Run: `npm run test`
Expected: 全テスト成功

- [ ] **Step 7: 型チェック・ビルド**

Run: `npm run check && npm run build`
Expected: どちらもエラーなく成功。`grep -n "DirectEffectContext = {" src/lib/game/shidasu/engine.ts`で全構築箇所を再確認し、`previousCombo`・`scoreAfterGained`が漏れなく含まれていることを目視確認する。

- [ ] **Step 8: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: DirectEffectContextにpreviousCombo・scoreAfterGainedを追加

流星の護符の新効果(次タスク)で必要になる、直前コンボ数と獲得点
加算後のスコアをコンテキストに追加した。この時点では既存の護符
効果には影響しない。
EOF
)"
```

---

### Task 6: 流星の護符を「コンボ閾値到達+現在スコアの割合加算」方式に変更する

**Files:**
- Modify: `src/lib/game/shidasu/params.ts`
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: `talismans.shootingStar`のパラメータを`n`から`p`に変更する**

`src/lib/game/shidasu/params.ts`の

```ts
    shootingStar: { name: string; c: number; n: number }
```

を、以下に置き換える。

```ts
    shootingStar: { name: string; c: number; p: number }
```

同ファイルの

```ts
    shootingStar: { name: '流星', c: 10, n: 1000 },
```

を、以下に置き換える(既定値は「現在スコアの10%」)。

```ts
    shootingStar: { name: '流星', c: 10, p: 10 },
```

`src/lib/game/shidasu/shidasu.config.json`の`"shootingStar"`エントリを確認し(`grep -n -A3 '"shootingStar"' src/lib/game/shidasu/shidasu.config.json`で位置を確認)、`"n": 1000`を`"p": 10`に置き換える。

- [ ] **Step 2: 既存テストを新仕様のテストに置き換える**

`src/lib/game/shidasu/engine.test.ts`の

```ts
  test('流星の護符でコンボが到達値になった瞬間、lastBonusGainsに直接加算が別枠で入る', () => {
    const items: ItemId[] = ['shootingStar']
    const wave = baseWave({
      combo: DEFAULT_PARAMS.talismans.shootingStar.c - 1,
      chain: [card(20, '♥', 3), card(21, '♦', 4)],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', items, 100000000, 0)
    expect(next.combo).toBe(DEFAULT_PARAMS.talismans.shootingStar.c)
    expect(next.lastBonusGains).toHaveLength(1)
    expect(next.lastBonusGains[0].label).toBe('護符による直接加算')
    expect(next.lastBonusGains[0].points).toBe(DEFAULT_PARAMS.talismans.shootingStar.n)
    expect(next.lastBonusGains[0].parts).toContain(`流星+${DEFAULT_PARAMS.talismans.shootingStar.n}`)
    // 回帰防止: 流星の加算額がlastGainとlastBonusGainsの両方に二重計上されていないことを確認する。
    // (lastGain.points + lastBonusGainsの合計) が実際のスコア増分と一致するはず。
    const bonusTotal = next.lastBonusGains.reduce((sum, g) => sum + g.points, 0)
    expect((next.lastGain?.points ?? 0) + bonusTotal).toBe(next.score - wave.score)
  })
```

を、以下に置き換える。

```ts
  test('流星の護符: コンボが閾値に到達した瞬間、獲得点加算後のスコアのp%がlastBonusGainsに別枠で入る', () => {
    const items: ItemId[] = ['shootingStar']
    const wave = baseWave({
      score: 5000,
      combo: DEFAULT_PARAMS.talismans.shootingStar.c - 1,
      chain: [card(20, '♥', 3), card(21, '♦', 4)],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', items, 100000000, 0)
    expect(next.combo).toBe(DEFAULT_PARAMS.talismans.shootingStar.c)
    const scoreAfterGained = wave.score + (next.lastGain?.points ?? 0)
    const expectedBonus = Math.floor(scoreAfterGained * DEFAULT_PARAMS.talismans.shootingStar.p / 100)
    expect(next.lastBonusGains).toHaveLength(1)
    expect(next.lastBonusGains[0].label).toBe('護符による直接加算')
    expect(next.lastBonusGains[0].points).toBe(expectedBonus)
    expect(next.lastBonusGains[0].parts).toContain(`流星+${expectedBonus}`)
    // 回帰防止: 流星の加算額がlastGainとlastBonusGainsの両方に二重計上されていないことを確認する。
    const bonusTotal = next.lastBonusGains.reduce((sum, g) => sum + g.points, 0)
    expect((next.lastGain?.points ?? 0) + bonusTotal).toBe(next.score - wave.score)
  })

  test('流星の護符: 黄金と併用しコンボが閾値をまたいでジャンプしても発動する', () => {
    const items: ItemId[] = ['shootingStar', 'golden']
    const c = DEFAULT_PARAMS.talismans.shootingStar.c
    const wave = baseWave({
      score: 5000,
      combo: c - 1, // 黄金の+2適用でc+1へジャンプし、cをちょうど踏まない
      chain: [card(20, '♥', 3), card(21, '♦', 4)],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', items, 100000000, 0)
    expect(next.combo).toBe(c + 1)
    expect(next.lastBonusGains.some(g => g.parts.some(p => p.startsWith('流星')))).toBe(true)
  })

  test('流星の護符: 既に閾値以上の状態が続いている間は再発動しない', () => {
    const items: ItemId[] = ['shootingStar']
    const c = DEFAULT_PARAMS.talismans.shootingStar.c
    const wave = baseWave({
      score: 5000,
      combo: c, // 既に閾値以上
      chain: [card(20, '♥', 3), card(21, '♦', 4)],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', items, 100000000, 0)
    expect(next.combo).toBe(c + 1)
    expect(next.lastBonusGains.some(g => g.parts.some(p => p.startsWith('流星')))).toBe(false)
  })
```

`src/lib/game/shidasu/engine.test.ts`の

```ts
  test('流星: コンボ数がcに到達した瞬間、直接点が加算される', () => {
    const c = DEFAULT_PARAMS.talismans.shootingStar.c
    const wave = baseWave({
      combo: c - 1,
      tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['shootingStar'], 1000000, 0)
    expect(next.combo).toBe(c)
    // コンボ倍率(comboMultiplierStep)込みの通常獲得点 + 流星の直接加算点
    const multiplier = 1 + (c - 1) * scoring.comboMultiplierStep
    const expectedGained = Math.floor(scoring.basePoint * multiplier) + DEFAULT_PARAMS.talismans.shootingStar.n
    expect(next.score).toBe(expectedGained)
  })
```

を、以下に置き換える(このテストは重複する内容のため削除し、上で追加した3件に統合する)。

```ts
```

- [ ] **Step 3: `applyDirectEffects`単体テストを新仕様に置き換える**

`src/lib/game/shidasu/engine.test.ts`の

```ts
  test('流星: comboMilestoneDirectでコンボ数がちょうどcの時のみ加算', () => {
    const fired = applyDirectEffects('comboMilestoneDirect', ['shootingStar'], directCtx({ combo: params.talismans.shootingStar.c }), params)
    expect(fired.value).toBe(params.talismans.shootingStar.n)
    const notFired = applyDirectEffects('comboMilestoneDirect', ['shootingStar'], directCtx({ combo: params.talismans.shootingStar.c + 1 }), params)
    expect(notFired.value).toBe(0)
  })
```

を、以下に置き換える。

```ts
  test('流星: comboMilestoneDirectで閾値未満→以上に到達した時のみ、scoreAfterGainedのp%を加算', () => {
    const c = params.talismans.shootingStar.c
    const fired = applyDirectEffects(
      'comboMilestoneDirect',
      ['shootingStar'],
      directCtx({ previousCombo: c - 1, combo: c, scoreAfterGained: 2000 }),
      params
    )
    expect(fired.value).toBe(Math.floor(2000 * params.talismans.shootingStar.p / 100))
    // 既に閾値以上だった場合は再発動しない
    const notFiredAlreadyPast = applyDirectEffects(
      'comboMilestoneDirect',
      ['shootingStar'],
      directCtx({ previousCombo: c, combo: c + 1, scoreAfterGained: 2000 }),
      params
    )
    expect(notFiredAlreadyPast.value).toBe(0)
    // まだ閾値未満の場合は発動しない
    const notFiredBelow = applyDirectEffects(
      'comboMilestoneDirect',
      ['shootingStar'],
      directCtx({ previousCombo: c - 2, combo: c - 1, scoreAfterGained: 2000 }),
      params
    )
    expect(notFiredBelow.value).toBe(0)
  })
```

- [ ] **Step 4: 既定値テストを更新する**

`src/lib/game/shidasu/engine.test.ts`の

```ts
    expect(DEFAULT_PARAMS.talismans.shootingStar.c).toBe(10)
    expect(DEFAULT_PARAMS.talismans.shootingStar.n).toBe(1000)
```

を、以下に置き換える。

```ts
    expect(DEFAULT_PARAMS.talismans.shootingStar.c).toBe(10)
    expect(DEFAULT_PARAMS.talismans.shootingStar.p).toBe(10)
```

- [ ] **Step 5: テストを実行して失敗を確認する**

Run: `npx vitest run engine.test -t "流星"`
Expected: FAIL(現行の`shootingStar`実装は`ctx.combo === c`のみを見ており、`p`パラメータも存在しないため型エラー・アサーション不一致が起きる)

- [ ] **Step 6: `shootingStar`の効果を実装する**

`src/lib/game/shidasu/engine.ts`の

```ts
  shootingStar: {
    channel: 'comboMilestoneDirect',
    effect: (ctx, p) => (ctx.combo === p.talismans.shootingStar.c ? p.talismans.shootingStar.n : 0),
  },
```

を、以下に置き換える。

```ts
  shootingStar: {
    channel: 'comboMilestoneDirect',
    effect: (ctx, p) => {
      const c = p.talismans.shootingStar.c
      if (ctx.previousCombo >= c || ctx.combo < c) return 0
      return Math.floor(ctx.scoreAfterGained * p.talismans.shootingStar.p / 100)
    },
  },
```

- [ ] **Step 7: `itemDesc`の流星の説明文を更新する**

`src/lib/game/shidasu/engine.ts`の

```ts
    case 'shootingStar': return `コンボ数が${params.talismans.shootingStar.c}に到達した瞬間、直接${params.talismans.shootingStar.n}点加算`
```

を、以下に置き換える。

```ts
    case 'shootingStar': return `コンボ数が${params.talismans.shootingStar.c}に到達した瞬間、獲得点を加算した後の現在スコアの${params.talismans.shootingStar.p}%を直接加算`
```

- [ ] **Step 8: テストを実行して成功を確認する**

Run: `npm run test`
Expected: 全テスト成功

- [ ] **Step 9: 型チェック・ビルド**

Run: `npm run check && npm run build`
Expected: どちらもエラーなく成功。`grep -rn "talismans.shootingStar.n\|shootingStar: { .*n:" src/`が0件であることを確認する。

- [ ] **Step 10: コミット**

```bash
git add src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: 流星の護符をコンボ閾値通過+現在スコア割合加算方式に変更

固定n点の直接加算から、獲得点加算後の現在スコアのp%を加算する方式に
変更した。判定も「コンボ数がちょうどc」から「c未満からc以上へ通過
した瞬間」に変更し、黄金の護符併用でコンボが+2ずつ進みcをちょうど
踏まない場合にも対応した。
EOF
)"
```

---

### Task 7: `ItemEffectContext`に`isPlayAction`・`playCountInChain`を追加する

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の`describe('playCard', ...)`ブロック内に、以下を追加する。

```ts
  test('itemEffectCtxのplayCountInChainは、このプレイを含めたチェーン内のプレイ回数になる', () => {
    // baseWave()の既定はchainOrigin未指定(空配列相当のmakeWave既定)。プレイ前は0回、
    // このプレイで1回目になるはず。序章(プレイ1枚目でn点加算)を使って間接的に確認する。
    const items: ItemId[] = ['prologue']
    const wave = baseWave()
    const next = playCard(DEFAULT_PARAMS, wave, 'none', items, 1000000, 0)
    expect(next.lastGain?.parts).toContain(`序章+${DEFAULT_PARAMS.talismans.prologue.n}`)
  })
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run engine.test -t "playCountInChain"`
Expected: FAIL(`prologue`は現行`ctx.combo === 1`判定のままなので、この時点ではむしろ偶然PASSする可能性がある。もしPASSしてしまう場合は次のcaseを追加する: `chain`に既存の`draw`起源カードを含めても発動することを検証する)

以下を追加で確認する(既存のプレイのみで判定していないことを保証するテスト)。

```ts
  test('序章は山札めくり(素朴)の獲得点計算では発動しない(isPlayActionガード)', () => {
    const items: ItemId[] = ['prologue', 'naive']
    const wave = makeWave({
      foundation: card(0, '♥', 3),
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      stock: [card(9, '♦', 7)],
      chain: [card(20, '♥', 3), card(21, '♦', 9), card(22, '♥', 2)],
      linked: true,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, items, standardDeckComposition(), 'none')
    expect(next.lastDrawEffect).toBe('pattern')
    expect(next.lastGain?.parts.some(p => p.startsWith('序章'))).toBe(false)
  })
```

- [ ] **Step 3: `ItemEffectContext`型を拡張する**

`src/lib/game/shidasu/engine.ts`の`ItemEffectContext`インターフェース内、`isFirstPlayOfWave: boolean`の行の直後に、以下を追加する。

```ts
  // 序章・幕間用: このスコアリングがプレイによるものか(true)、山札めくり(素朴)によるものか(false)
  isPlayAction: boolean
  // 序章・幕間用: このプレイを含めて、現在のチェーン内で何回目のプレイか
  playCountInChain: number
```

- [ ] **Step 4: 本体コードの2つの構築箇所を更新する**

`src/lib/game/shidasu/engine.ts`の`playCard`内、`itemEffectCtx`オブジェクトリテラルの`isFirstPlayOfWave: !wave.firstPlayDone,`の行の直後に、以下を追加する。

```ts
    isPlayAction: true,
    playCountInChain: wave.chainOrigin.filter(o => o === 'play').length + 1,
```

`drawStock`内、`naiveCtx`オブジェクトリテラルの`isFirstPlayOfWave: !wave.firstPlayDone,`の行の直後に、以下を追加する。

```ts
        isPlayAction: false,
        playCountInChain: wave.chainOrigin.filter(o => o === 'play').length,
```

- [ ] **Step 5: テストコード側の全14箇所の`ctx()`ヘルパーを一括修正する**

`src/lib/game/shidasu/engine.test.ts`に対して以下のコマンドを実行し、`isFirstPlayOfWave: false,`という形の全ての`ItemEffectContext`ヘルパーに`isPlayAction`・`playCountInChain`を挿入する。

```bash
sed -i 's/isFirstPlayOfWave: false,/isFirstPlayOfWave: false,\n      isPlayAction: true,\n      playCountInChain: 1,/g' src/lib/game/shidasu/engine.test.ts
```

実行後、`grep -c "isPlayAction: true," src/lib/game/shidasu/engine.test.ts`で14件挿入されたことを確認する(14個の`ctx()`ヘルパー全てに`isFirstPlayOfWave: false,`が含まれている前提。もし件数が14件に満たない場合は、`grep -n "isFirstPlayOfWave:" src/lib/game/shidasu/engine.test.ts`で漏れている箇所を特定し、同じ2行を手動で追加する)。

- [ ] **Step 6: テストを実行して成功を確認する**

Run: `npm run test`
Expected: 全テスト成功

- [ ] **Step 7: 型チェック・ビルド**

Run: `npm run check && npm run build`
Expected: どちらもエラーなく成功

- [ ] **Step 8: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: ItemEffectContextにisPlayAction・playCountInChainを追加

序章・幕間の護符修正(次タスク)で必要になる、プレイかどうかの区別と
チェーン内のプレイ回数をコンテキストに追加した。この時点では既存の
護符効果には影響しない。
EOF
)"
```

---

### Task 8: 序章の護符を「チェーン内プレイ1枚目」判定に変更する

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 既存テストを新仕様のテストに置き換える**

`src/lib/game/shidasu/engine.test.ts`の

```ts
  test('序章: コンボ1枚目のみ加算', () => {
    const fired = applyItemEffects('gained', 100, ['prologue'], ctx({ combo: 1 }), params)
    expect(fired.value).toBe(100 + params.talismans.prologue.n)
    const notFired = applyItemEffects('gained', 100, ['prologue'], ctx({ combo: 2 }), params)
    expect(notFired.value).toBe(100)
  })
```

を、以下に置き換える。

```ts
  test('序章: プレイでチェーン内1枚目の時のみ加算', () => {
    const fired = applyItemEffects('gained', 100, ['prologue'], ctx({ playCountInChain: 1 }), params)
    expect(fired.value).toBe(100 + params.talismans.prologue.n)
    const notFired = applyItemEffects('gained', 100, ['prologue'], ctx({ playCountInChain: 2 }), params)
    expect(notFired.value).toBe(100)
  })

  test('序章: プレイでなければ(山札めくり)チェーン内1枚目相当でも加算しない', () => {
    const notFired = applyItemEffects('gained', 100, ['prologue'], ctx({ isPlayAction: false, playCountInChain: 1 }), params)
    expect(notFired.value).toBe(100)
  })
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run engine.test -t "序章"`
Expected: FAIL(現行実装は`ctx.combo`を見ており`playCountInChain`/`isPlayAction`を見ていないため)

- [ ] **Step 3: `prologue`の効果を実装する**

`src/lib/game/shidasu/engine.ts`の

```ts
  prologue: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.combo === 1 ? { value: v + p.talismans.prologue.n, part: `序章+${p.talismans.prologue.n}` } : { value: v, part: null },
  },
```

を、以下に置き換える。

```ts
  prologue: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.isPlayAction && ctx.playCountInChain === 1
        ? { value: v + p.talismans.prologue.n, part: `序章+${p.talismans.prologue.n}` }
        : { value: v, part: null },
  },
```

- [ ] **Step 4: `itemDesc`の序章の説明文を更新する**

`src/lib/game/shidasu/engine.ts`の

```ts
    case 'prologue': return `コンボ1枚目のとき、${params.talismans.prologue.n}点加算`
```

を、以下に置き換える。

```ts
    case 'prologue': return `チェーン内でプレイ1枚目のとき、${params.talismans.prologue.n}点加算`
```

- [ ] **Step 5: テストを実行して成功を確認する**

Run: `npm run test`
Expected: 全テスト成功

- [ ] **Step 6: 型チェック・ビルド**

Run: `npm run check && npm run build`
Expected: どちらもエラーなく成功

- [ ] **Step 7: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: 序章の護符をチェーン内プレイ1枚目判定に変更

コンボ数が1の時という判定(山札めくりの素朴スコアリングでも該当し
うる)から、プレイでチェーン内の1枚目のプレイの時のみ発動する判定に
変更した。山札めくりでは発動しない。
EOF
)"
```

---

### Task 9: 幕間の護符を「チェーン内プレイちょうどm枚目、一回のみ」判定に変更する

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 既存テストを新仕様のテストに置き換える**

`src/lib/game/shidasu/engine.test.ts`の

```ts
  test('幕間: コンボがm枚目に達するたび加算', () => {
    const m = params.talismans.interlude.m
    const fired = applyItemEffects('gained', 100, ['interlude'], ctx({ combo: m * 2 }), params)
    expect(fired.value).toBe(100 + params.talismans.interlude.n)
    const notFired = applyItemEffects('gained', 100, ['interlude'], ctx({ combo: m + 1 }), params)
    expect(notFired.value).toBe(100)
  })
```

を、以下に置き換える。

```ts
  test('幕間: プレイでチェーン内ちょうどm枚目の時のみ加算', () => {
    const m = params.talismans.interlude.m
    const fired = applyItemEffects('gained', 100, ['interlude'], ctx({ playCountInChain: m }), params)
    expect(fired.value).toBe(100 + params.talismans.interlude.n)
    const notFired = applyItemEffects('gained', 100, ['interlude'], ctx({ playCountInChain: m * 2 }), params)
    expect(notFired.value).toBe(100)
  })

  test('幕間: プレイでなければ(山札めくり)m枚目相当でも加算しない', () => {
    const m = params.talismans.interlude.m
    const notFired = applyItemEffects('gained', 100, ['interlude'], ctx({ isPlayAction: false, playCountInChain: m }), params)
    expect(notFired.value).toBe(100)
  })
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run engine.test -t "幕間"`
Expected: FAIL(現行実装は`ctx.combo % m === 0`を見ており`playCountInChain`を見ていないため)

- [ ] **Step 3: `interlude`の効果を実装する**

`src/lib/game/shidasu/engine.ts`の

```ts
  interlude: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.combo % p.talismans.interlude.m === 0
        ? { value: v + p.talismans.interlude.n, part: `幕間+${p.talismans.interlude.n}` }
        : { value: v, part: null },
  },
```

を、以下に置き換える。

```ts
  interlude: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.isPlayAction && ctx.playCountInChain === p.talismans.interlude.m
        ? { value: v + p.talismans.interlude.n, part: `幕間+${p.talismans.interlude.n}` }
        : { value: v, part: null },
  },
```

- [ ] **Step 4: `itemDesc`の幕間の説明文を更新する**

`src/lib/game/shidasu/engine.ts`の

```ts
    case 'interlude': return `コンボが${params.talismans.interlude.m}枚目に達するたび、${params.talismans.interlude.n}点加算`
```

を、以下に置き換える。

```ts
    case 'interlude': return `チェーン内でプレイちょうど${params.talismans.interlude.m}枚目のとき、${params.talismans.interlude.n}点加算`
```

- [ ] **Step 5: テストを実行して成功を確認する**

Run: `npm run test`
Expected: 全テスト成功

- [ ] **Step 6: 型チェック・ビルド**

Run: `npm run check && npm run build`
Expected: どちらもエラーなく成功

- [ ] **Step 7: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: 幕間の護符をチェーン内プレイちょうどm枚目・一回のみ判定に変更

コンボ数がmの倍数に達するたび繰り返し発動していたのを、プレイで
チェーン内のちょうどm枚目のプレイの時のみ一回発動する判定に変更した。
山札めくりでは発動しない。
EOF
)"
```

---

### Task 10: 最終確認

**Files:** なし(検証のみ)

- [ ] **Step 1: テスト全体を実行する**

Run: `npm run test`
Expected: 全テスト成功

- [ ] **Step 2: ビルド・型チェック**

Run: `npm run build && npm run check`
Expected: どちらもエラーなく成功。以下のコマンドで取り残しが無いことを確認する。

```bash
grep -rn "talismans.shootingStar.n\|items.stairRelaxedMinLen\|items.columnSweepRelaxCards" src/
```

Expected: 0件

- [ ] **Step 3: ブラウザで受け入れ基準を確認する**

Run: `npm run dev` → 以下を順に確認する(`docs/superpowers/specs/2026-07-16-shidasu-scoring-formula-and-talisman-tweaks-design.md` 7節の受け入れ基準に対応)。

1. `/admin/shidasu-debug`で流星・序章・幕間・瑠璃をチェックし、それぞれ意図した条件でのみ獲得点ログに反映されることを内部状態パネルで確認する
2. `/admin/shidasu-talismans`で流星の行に`p`パラメータ(割合)が表示され、説明文プレビューが新しい文言になっていることを確認する
3. `/game/shidasu`で実際にプレイし、得点表示・護符選択画面の説明文にエラーが無いことを確認する

- [ ] **Step 4: 完了報告**

問題があれば修正してから完了とする。新規コミットは不要(Task 1〜9で既にコミット済み)。

---

## 自己レビュー結果

- **spec カバレッジ:** spec 1節(コンボ倍率の並び替え)→ Task 2-3、spec 2節(流星)→ Task 5-6、spec 3節(序章)→ Task 7-8、spec 4節(幕間)→ Task 7・9、spec 5節(瑠璃)→ Task 1・4。全項目に対応するタスクあり。
- **プレースホルダースキャン:** 「TBD」「後で実装」等の記述なし。全コード変更箇所を具体的なold/new textまたは明示的なsedコマンドで記載した。
- **型・シグネチャ整合性:** `ChainBonusResult.patternFiredCount`・`DirectEffectContext.previousCombo/scoreAfterGained`・`ItemEffectContext.isPlayAction/playCountInChain`は、それぞれTask 1・5・7で型定義後、後続タスクで一貫して同じフィールド名で参照している。`talismans.shootingStar`のパラメータ名`p`はTask 6で型・DEFAULT_PARAMS・config.json・engine.ts全てで統一して使用している。
