# 誓約・契り・紅蓮・漆黒 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** デメリット付き倍算護符「誓約」(同色制約)・「契り」(同スート制約)と、その色制約を緩和するイネーブラー護符「紅蓮」・「漆黒」を実装する。

**Architecture:** `patterns.ts`に紅蓮・漆黒を考慮した色判定ヘルパー`cardColors`を新設し、既存の`isRed`利用箇所(9箇所)を段階的に置き換える。誓約・契りは`isPlayable`(取得可否判定)に新しい制約を追加する形で実装する。各ファイルへの変更は影響範囲の小さい順(ヘルパー関数→既存判定の書き換え→新規制約→新規護符データ→秘儀)に進める。

**Tech Stack:** TypeScript, Vitest

---

### Task 1: cardColorsヘルパー関数を新設する

**Files:**
- Modify: `src/lib/game/shidasu/patterns.ts`
- Modify: `src/lib/game/shidasu/types.ts`(ItemIdに紅蓮・漆黒を追加)
- Test: `src/lib/game/shidasu/patterns.test.ts`(存在しなければ確認して作成)

このタスクでは、紅蓮・漆黒を考慮した色判定の基盤となる`cardColors`関数だけを作る。まだ既存の`isRed`呼び出し箇所は書き換えない(Task 2以降で行う)。

- [ ] **Step 1: types.tsにItemIdを2種追加する**

`src/lib/game/shidasu/types.ts`の`ItemId`型の末尾(`| 'waterMirror'`の行)に、以下を追記する。

変更前:
```ts
  | 'waterMirror'
```

変更後:
```ts
  | 'waterMirror'
  | 'crimson' | 'jetBlack'
```

「紅蓮」の英語IDは`crimson`、「漆黒」の英語IDは`jetBlack`とする。

- [ ] **Step 2: patterns.test.tsが存在するか確認する**

Run: `ls src/lib/game/shidasu/patterns.test.ts`

存在しなければ、以下の内容で新規作成する(存在すれば、ファイル内容を確認した上で末尾に追記する)。

```ts
// src/lib/game/shidasu/patterns.test.ts
import { describe, test, expect } from 'vitest'
import { cardColors } from './patterns'
import { card } from './testHelpers'
```

- [ ] **Step 3: 失敗するテストを書く**

`patterns.test.ts`に以下を追加する。

```ts
describe('cardColors(紅蓮・漆黒を考慮した色判定)', () => {
  test('護符なしの場合、赤札はred:trueのみ、黒札はblack:trueのみを返す', () => {
    expect(cardColors(card(1, '♥', 5), [])).toEqual({ red: true, black: false })
    expect(cardColors(card(1, '♦', 5), [])).toEqual({ red: true, black: false })
    expect(cardColors(card(1, '♠', 5), [])).toEqual({ red: false, black: true })
    expect(cardColors(card(1, '♣', 5), [])).toEqual({ red: false, black: true })
  })

  test('紅蓮所持時、黒札もred:trueになる(blackは元のまま)', () => {
    expect(cardColors(card(1, '♠', 5), ['crimson'])).toEqual({ red: true, black: true })
  })

  test('紅蓮所持時、赤札はred:trueのまま(blackは変化しない)', () => {
    expect(cardColors(card(1, '♥', 5), ['crimson'])).toEqual({ red: true, black: false })
  })

  test('漆黒所持時、赤札もblack:trueになる(redは元のまま)', () => {
    expect(cardColors(card(1, '♥', 5), ['jetBlack'])).toEqual({ red: true, black: true })
  })

  test('紅蓮・漆黒を両方所持時、どのカードもred:true・black:trueになる', () => {
    expect(cardColors(card(1, '♠', 5), ['crimson', 'jetBlack'])).toEqual({ red: true, black: true })
    expect(cardColors(card(1, '♥', 5), ['crimson', 'jetBlack'])).toEqual({ red: true, black: true })
  })
})
```

- [ ] **Step 4: テストを実行して失敗を確認する**

Run: `npx vitest run src/lib/game/shidasu/patterns.test.ts -t "cardColors"`
Expected: FAIL(`cardColors`が`patterns.ts`からexportされていない)

- [ ] **Step 5: patterns.tsにcardColorsを実装する**

`src/lib/game/shidasu/patterns.ts`の1-8行目を以下のように変更する。

変更前:
```ts
// src/lib/game/shidasu/patterns.ts
import type { Card, Suit, RoleName } from './types'
import type { ShidasuParams } from './params'
import { addPart, type ScorePart } from './scoreParts'

export function isRed(card: Card): boolean {
  return card.suit === '♥' || card.suit === '♦'
}
```

変更後:
```ts
// src/lib/game/shidasu/patterns.ts
import type { Card, Suit, RoleName, ItemId } from './types'
import type { ShidasuParams } from './params'
import { addPart, type ScorePart } from './scoreParts'

export function isRed(card: Card): boolean {
  return card.suit === '♥' || card.suit === '♦'
}

export interface CardColors {
  red: boolean
  black: boolean
}

// 紅蓮・漆黒による色の拡張解釈。紅蓮所持時は全ての札がredとしても扱われ(blackは元のまま)、
// 漆黒所持時は全ての札がblackとしても扱われる(redは元のまま)。両方所持時はどちらも常にtrue。
// ワイルドカードの扱いは呼び出し元で個別に処理する(この関数はワイルドの母数を考慮しない)。
export function cardColors(card: Card, items: ItemId[]): CardColors {
  const baseRed = card.suit === '♥' || card.suit === '♦'
  return {
    red: baseRed || items.includes('crimson'),
    black: !baseRed || items.includes('jetBlack'),
  }
}
```

- [ ] **Step 6: テストを実行して成功を確認する**

Run: `npx vitest run src/lib/game/shidasu/patterns.test.ts -t "cardColors"`
Expected: PASS(5件とも)

- [ ] **Step 7: 全体テスト・型チェックを実行する**

Run: `npx vitest run`
Expected: 全件PASS(既存の`isRed`はまだ変更していないため影響なし)

Run: `npm run check`
Expected: shidasu関連のエラー0件

- [ ] **Step 8: Commit**

```bash
git add src/lib/game/shidasu/patterns.ts src/lib/game/shidasu/patterns.test.ts src/lib/game/shidasu/types.ts
git commit -m "feat: 紅蓮・漆黒の色拡張解釈を行うcardColorsヘルパーを追加"
```

---

### Task 2: analyzeSuitColor(同色パターンボーナス・誓約の色制約)をcardColorsベースに書き換える

**Files:**
- Modify: `src/lib/game/shidasu/patterns.ts`
- Modify: `src/lib/game/shidasu/engine.ts`(evaluateChainBonusの呼び出し元2箇所)
- Test: `src/lib/game/shidasu/patterns.test.ts`

`analyzeSuitColor`は既存の同色パターンボーナス判定に使われている汎用関数。紅蓮・漆黒所持時、同色パターンボーナスの成立条件も拡張解釈されるようにする(specの「全範囲に波及」方針)。この関数はTask 4で実装する誓約の色制約判定にも再利用する。

- [ ] **Step 1: 失敗するテストを書く**

`patterns.test.ts`に以下を追加する。既存の`analyzeSuitColor`のテストが既にあれば、その直後に追加する。

```ts
describe('analyzeSuitColor with 紅蓮・漆黒', () => {
  test('紅蓮所持時、黒札のみのチェーンでもcolorHeldがtrueになる(赤札が混ざっても崩れない)', () => {
    const chain = [card(1, '♠', 5), card(2, '♣', 6), card(3, '♥', 7)]
    const result = analyzeSuitColor(chain, ['crimson'])
    expect(result.colorHeld).toBe(true)
  })

  test('護符なしの場合、黒札と赤札が混在するとcolorHeldはfalse', () => {
    const chain = [card(1, '♠', 5), card(2, '♣', 6), card(3, '♥', 7)]
    const result = analyzeSuitColor(chain, [])
    expect(result.colorHeld).toBe(false)
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run src/lib/game/shidasu/patterns.test.ts -t "analyzeSuitColor with"`
Expected: FAIL(`analyzeSuitColor`が第2引数`items`を受け付けない、または常に`false`を返す)

- [ ] **Step 3: analyzeSuitColorをcardColorsベースに書き換える**

`src/lib/game/shidasu/patterns.ts`の`analyzeSuitColor`関数を以下のように変更する。

変更前:
```ts
export function analyzeSuitColor(chain: Card[]): SuitColorAnalysis {
  const realCards = chain.filter(c => !c.wild)
  if (realCards.length === 0) return { suitHeld: true, colorHeld: true }
  const first = realCards[0]
  return {
    suitHeld: realCards.every(c => c.suit === first.suit),
    colorHeld: realCards.every(c => isRed(c) === isRed(first)),
  }
}
```

変更後:
```ts
export function analyzeSuitColor(chain: Card[], items: ItemId[] = []): SuitColorAnalysis {
  const realCards = chain.filter(c => !c.wild)
  if (realCards.length === 0) return { suitHeld: true, colorHeld: true }
  const first = realCards[0]
  const firstColors = cardColors(first, items)
  return {
    suitHeld: realCards.every(c => c.suit === first.suit),
    // 全カードが「firstと共通の色を持つか」で判定する(紅蓮・漆黒で複数色を持つカードは
    // どちらの色とも一致しうる、都合の良い解釈)
    colorHeld: realCards.every(c => {
      const cColors = cardColors(c, items)
      return (cColors.red && firstColors.red) || (cColors.black && firstColors.black)
    }),
  }
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npx vitest run src/lib/game/shidasu/patterns.test.ts -t "analyzeSuitColor with"`
Expected: PASS(2件とも)

- [ ] **Step 5: evaluateChainBonusにitems引数を追加し、呼び出し元を更新する**

`src/lib/game/shidasu/patterns.ts`の`evaluateChainBonus`関数シグネチャを以下のように変更する。

変更前:
```ts
export function evaluateChainBonus(
  scoring: ShidasuParams['scoring'],
  chainBefore: Card[],
  card: Card,
  stairMinLen: number = scoring.stairMinLen,
  roleBonusMultiplier: (name: RoleName) => number = () => 1,
  suitColorMinLen: number = scoring.suitColorMinLen,
  oracleLevel: (name: RoleName) => number = () => 1
): ChainBonusResult {
```

変更後:
```ts
export function evaluateChainBonus(
  scoring: ShidasuParams['scoring'],
  chainBefore: Card[],
  card: Card,
  stairMinLen: number = scoring.stairMinLen,
  roleBonusMultiplier: (name: RoleName) => number = () => 1,
  suitColorMinLen: number = scoring.suitColorMinLen,
  oracleLevel: (name: RoleName) => number = () => 1,
  items: ItemId[] = []
): ChainBonusResult {
```

同関数内、`const { suitHeld, colorHeld } = analyzeSuitColor(chainIncludingThis)`の行を以下のように変更する。

変更前:
```ts
  const { suitHeld, colorHeld } = analyzeSuitColor(chainIncludingThis)
```

変更後:
```ts
  const { suitHeld, colorHeld } = analyzeSuitColor(chainIncludingThis, items)
```

`src/lib/game/shidasu/engine.ts`内の`evaluateChainBonus`呼び出し2箇所を更新する。

変更前(399行目付近):
```ts
  const chainResult = evaluateChainBonus(params.scoring, wave.chain, card, effectiveStairMinLen, roleBonusMultiplier, effectiveSuitColorMinLen, oracleLevel)
```

変更後:
```ts
  const chainResult = evaluateChainBonus(params.scoring, wave.chain, card, effectiveStairMinLen, roleBonusMultiplier, effectiveSuitColorMinLen, oracleLevel, items)
```

変更前(779行目付近):
```ts
      const chainResult = evaluateChainBonus(params.scoring, wave.chain, drawnCard, effectiveStairMinLen, undefined, effectiveSuitColorMinLen, oracleLevel)
```

変更後:
```ts
      const chainResult = evaluateChainBonus(params.scoring, wave.chain, drawnCard, effectiveStairMinLen, undefined, effectiveSuitColorMinLen, oracleLevel, items)
```

- [ ] **Step 6: engine.tsの747行目付近、drawStock内のanalyzeSuitColor呼び出しも更新する**

`src/lib/game/shidasu/engine.ts`の以下の行を確認し、更新する。

変更前:
```ts
    const { colorHeld, suitHeld } = analyzeSuitColor([...wave.chain, drawnCard])
```

変更後:
```ts
    const { colorHeld, suitHeld } = analyzeSuitColor([...wave.chain, drawnCard], items)
```

- [ ] **Step 7: 全体テスト・型チェックを実行する**

Run: `npx vitest run`
Expected: 全件PASS

Run: `npm run check`
Expected: shidasu関連のエラー0件

- [ ] **Step 8: Commit**

```bash
git add src/lib/game/shidasu/patterns.ts src/lib/game/shidasu/patterns.test.ts src/lib/game/shidasu/engine.ts
git commit -m "feat: analyzeSuitColorの同色判定に紅蓮・漆黒の拡張解釈を反映"
```

---

### Task 3: 単色専有判定(月光・陽光)と切替検出(宵闇・払暁)をcardColorsベースに書き換える

**Files:**
- Modify: `src/lib/game/shidasu/chainAttributeEffects.ts`
- Modify: `src/lib/game/shidasu/cardComboEffects.ts`
- Modify: `src/lib/game/shidasu/itemEffects.ts`(ItemEffectContextにitemsを追加)
- Modify: `src/lib/game/shidasu/engine.ts`(itemEffectCtxの構築箇所2箇所にitemsを追加)
- Test: `src/lib/game/shidasu/engine.test.ts`

`ItemEffectContext`に`items: ItemId[]`を追加し、各護符効果関数(`ItemEffect`)から`ctx.items`経由で紅蓮・漆黒の所持を参照できるようにする。

- [ ] **Step 1: ItemEffectContextにitemsを追加する**

`src/lib/game/shidasu/itemEffects.ts`の`ItemEffectContext`インターフェース、`mercyActiveNextCombo: boolean`の行の直後に以下を追加する。

```ts
  // 紅蓮・漆黒用: このプレイ時点で所持している護符一覧(cardColorsに渡すため)
  items: ItemId[]
```

- [ ] **Step 2: engine.tsのitemEffectCtx構築箇所2箇所にitemsを追加する**

`src/lib/game/shidasu/engine.ts`内、`ItemEffectContext`型のオブジェクトを構築している箇所(`playCard`関数内の`itemEffectCtx`、`drawStock`関数内の`naiveCtx`)それぞれに、`mercyActiveNextCombo: wave.mercyActiveNextCombo,`の行の直後に以下を追加する。

```ts
    items,
```

（`playCard`・`drawStock`双方とも既に`items: ItemId[]`という引数を受け取っているため、そのまま渡せる）

- [ ] **Step 3: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`で`playCard`が既にimportされていることを確認する。既存の月光・陽光・宵闇・払暁のテスト(それぞれの護符名で検索すると見つかる)の直後に、以下を追加する。

```ts
describe('月光・陽光と紅蓮・漆黒の相互作用', () => {
  test('紅蓮所持時、黒札のみのチェーンでも月光(黒専有倍算)は成立する(黒札はblackを保つため影響なし)', () => {
    const wave = makeWave({
      foundation: card(0, '♠', 5),
      chain: [card(1, '♠', 6), card(2, '♣', 7)],
      tableau: [[card(3, '♠', 8)], [card(4, '♦', 2)]],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['moonlight', 'crimson'], 1000000, 0, standardDeckComposition())
    expect(next.lastGain?.parts.some(p => p.text.includes('月光'))).toBe(true)
  })

  test('漆黒所持時、赤札を含むチェーンでも月光(黒専有倍算)が成立する(赤札もblack:trueになるため)', () => {
    const wave = makeWave({
      foundation: card(0, '♥', 5),
      chain: [card(1, '♥', 6), card(2, '♦', 7)],
      tableau: [[card(3, '♥', 8)], [card(4, '♦', 2)]],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['moonlight', 'jetBlack'], 1000000, 0, standardDeckComposition())
    expect(next.lastGain?.parts.some(p => p.text.includes('月光'))).toBe(true)
  })

  test('護符なしの場合、赤札が混ざると月光(黒専有倍算)は成立しない', () => {
    const wave = makeWave({
      foundation: card(0, '♥', 5),
      chain: [card(1, '♥', 6), card(2, '♦', 7)],
      tableau: [[card(3, '♥', 8)], [card(4, '♦', 2)]],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['moonlight'], 1000000, 0, standardDeckComposition())
    expect(next.lastGain?.parts.some(p => p.text.includes('月光'))).toBe(false)
  })
})

describe('宵闇・払暁と紅蓮の相互作用', () => {
  test('護符なしの場合、黒札→黒札のプレイでは宵闇も払暁も成立しない', () => {
    const wave = makeWave({
      foundation: card(0, '♠', 5),
      chain: [card(1, '♠', 5)],
      tableau: [[card(2, '♣', 6)], [card(3, '♦', 2)]],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['dusk', 'dawn'], 1000000, 0, standardDeckComposition())
    expect(next.lastGain?.parts.some(p => p.text.includes('宵闇'))).toBe(false)
    expect(next.lastGain?.parts.some(p => p.text.includes('払暁'))).toBe(false)
  })

  test('紅蓮所持時、黒札→黒札のプレイで宵闇・払暁の両方が成立しうる(黒札はredも含むため)', () => {
    const wave = makeWave({
      foundation: card(0, '♠', 5),
      chain: [card(1, '♠', 5)],
      tableau: [[card(2, '♣', 6)], [card(3, '♦', 2)]],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['dusk', 'dawn', 'crimson'], 1000000, 0, standardDeckComposition())
    expect(next.lastGain?.parts.some(p => p.text.includes('宵闇'))).toBe(true)
    expect(next.lastGain?.parts.some(p => p.text.includes('払暁'))).toBe(true)
  })
})
```

- [ ] **Step 4: テストを実行して失敗を確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "紅蓮"`
Expected: FAIL(`crimson`/`jetBlack`所持が判定に反映されないため、期待通りの成立/不成立にならない)

- [ ] **Step 5: chainAttributeEffects.tsのchainColorExclusiveをcardColorsベースに書き換える**

`src/lib/game/shidasu/chainAttributeEffects.ts`の1-20行目を以下のように変更する。

変更前:
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
```

変更後:
```ts
// src/lib/game/shidasu/chainAttributeEffects.ts
import type { Card, ItemId, Suit } from './types'
import { isRed, isFace, analyzeSuitColor, analyzeStair, stairUsesKALoop, cardColors } from './patterns'
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

// red=trueなら「全カードがredを含む」、red=falseなら「全カードがblackを含む」で判定する
// (紅蓮・漆黒所持時、複数色を持つカードはどちらの専有判定も満たしうる)
function chainColorExclusive(chain: Card[], red: boolean, items: ItemId[]): boolean {
  return chain.every(c => {
    if (c.wild) return true
    const colors = cardColors(c, items)
    return red ? colors.red : colors.black
  })
}
```

`moonlight`(月光、黒専有)・`sunlight`(陽光、赤専有)エントリの`effect`内、`chainColorExclusive`の呼び出しに`ctx.items`を追加する。

変更前:
```ts
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
```

変更後:
```ts
  moonlight: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!chainColorExclusive(ctx.chain, false, ctx.items)) return { value: v, part: null }
      const factor = p.talismans.moonlight.x
      return { value: v * factor, part: multiplyPart('月光', factor) }
    },
  },
  sunlight: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!chainColorExclusive(ctx.chain, true, ctx.items)) return { value: v, part: null }
      const factor = p.talismans.sunlight.x
      return { value: v * factor, part: multiplyPart('陽光', factor) }
    },
  },
```

- [ ] **Step 6: cardComboEffects.tsのdusk・dawnをcardColorsベースに書き換える**

`src/lib/game/shidasu/cardComboEffects.ts`の1-3行目・50-63行目を以下のように変更する。

変更前:
```ts
// src/lib/game/shidasu/cardComboEffects.ts
import type { ItemId } from './types'
import { isRed } from './patterns'
```

変更後:
```ts
// src/lib/game/shidasu/cardComboEffects.ts
import type { ItemId } from './types'
import { isRed, cardColors } from './patterns'
```

変更前:
```ts
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
```

変更後:
```ts
  dusk: {
    channel: 'gained',
    // 直前の札がredを含み、かつ今回の札がblackを含めば成立(紅蓮所持時は黒札もredを含むため、
    // 黒札→黒札の連続でも成立しうる)
    effect: (v, ctx, p) =>
      cardColors(ctx.previousFoundation, ctx.items).red && cardColors(ctx.card, ctx.items).black
        ? { value: v + p.talismans.dusk.n, part: addPart('宵闇', p.talismans.dusk.n) }
        : { value: v, part: null },
  },
  dawn: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      cardColors(ctx.previousFoundation, ctx.items).black && cardColors(ctx.card, ctx.items).red
        ? { value: v + p.talismans.dawn.n, part: addPart('払暁', p.talismans.dawn.n) }
        : { value: v, part: null },
  },
```

- [ ] **Step 7: テストを実行して成功を確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "紅蓮"`
Expected: PASS(5件とも)

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "宵闇\|払暁\|月光\|陽光"`
Expected: 既存テストも全てPASS(退行なし)

- [ ] **Step 8: 全体テスト・型チェックを実行する**

Run: `npx vitest run`
Expected: 全件PASS

Run: `npm run check`
Expected: shidasu関連のエラー0件

- [ ] **Step 9: Commit**

```bash
git add src/lib/game/shidasu/chainAttributeEffects.ts src/lib/game/shidasu/cardComboEffects.ts src/lib/game/shidasu/itemEffects.ts src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 月光・陽光・宵闇・払暁の色判定に紅蓮・漆黒の拡張解釈を反映"
```

---

### Task 4: 均衡・調和(赤黒枚数判定)をcardColorsベースに書き換える

**Files:**
- Modify: `src/lib/game/shidasu/chainAttributeEffects.ts`
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`のTask 3で追加したdescribeブロックの直後に、以下を追加する。均衡・調和は「チェーン内の赤黒枚数が同数(ワイルドで埋め合わせ可能な範囲を含む)」で成立する。以下のテストケースは事前に計算式で検算済みの値を使っている(`realRedOnly`/`realBlackOnly`/`flexible`の3変数で`diff<=flexible`かつ`(realRedOnly+realBlackOnly+flexible)`が偶数、という条件)。

```ts
describe('均衡・調和と紅蓮の相互作用', () => {
  test('護符なしの場合、黒2枚(chain1枚+取得1枚)では均衡は成立しない', () => {
    const wave = makeWave({
      foundation: card(0, '♠', 5),
      chain: [card(1, '♠', 6)],
      tableau: [[card(2, '♣', 7)], [card(3, '♦', 2)]],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['balance'], 1000000, 0, standardDeckComposition())
    expect(next.lastGain?.parts.some(p => p.text.includes('均衡'))).toBe(false)
  })

  test('紅蓮所持時、黒2枚(chain1枚+取得1枚)でも均衡が成立する(黒札がredも含むflexible扱いになるため)', () => {
    const wave = makeWave({
      foundation: card(0, '♠', 5),
      chain: [card(1, '♠', 6)],
      tableau: [[card(2, '♣', 7)], [card(3, '♦', 2)]],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['balance', 'crimson'], 1000000, 0, standardDeckComposition())
    expect(next.lastGain?.parts.some(p => p.text.includes('均衡'))).toBe(true)
  })

  test('紅蓮所持時でも、赤3枚(chain2枚+取得1枚)では均衡は成立しない(紅蓮は黒→赤拡張のみで赤はflexible化されないため)', () => {
    const wave = makeWave({
      foundation: card(0, '♥', 5),
      chain: [card(1, '♥', 6), card(2, '♦', 7)],
      tableau: [[card(3, '♥', 8)], [card(4, '♦', 2)]],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['balance', 'crimson'], 1000000, 0, standardDeckComposition())
    expect(next.lastGain?.parts.some(p => p.text.includes('均衡'))).toBe(false)
  })
})
```

**注意**: このタスクの均衡・調和のテストケースは、赤黒枚数のカウント方式(紅蓮所持時に黒札を赤カウントにも算入できる、という「都合の良い解釈」)の性質上、テストデータの設計が複雑になりやすい。実装者はStep 3で`redBlackBalanced`の実装を確定させた後、実際の計算結果に基づいてテストの期待値を検算し、上記のコメント付きテストケースを実態に合わせて具体化・修正すること(コメントは意図の説明であり、実装完了後に矛盾があれば修正する)。

- [ ] **Step 2: テストを実行して現状を確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "均衡・調和"`
Expected: FAIL(`balance`の効果が`ctx.items`を見ておらず、紅蓮所持時のテストケースが期待通りに成立しない)

- [ ] **Step 3: redBlackBalancedをcardColorsベースに書き換える**

`src/lib/game/shidasu/chainAttributeEffects.ts`の`redBlackBalanced`関数を以下のように変更する。

変更前:
```ts
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
```

変更後:
```ts
// 赤黒の差(diff)をワイルドで埋めて同数にできるかを判定する。紅蓮・漆黒所持時、両方の性質を
// 持つカード(例: 紅蓮所持時の黒札はred:true・black:trueの両方)は、赤としても黒としても
// カウントできる「都合の良い解釈」を適用する。具体的には、実カードのうち「赤のみ(blackを
// 持たない)」枚数をrealRedOnly、「黒のみ」枚数をrealBlackOnly、「両方持つ(紅蓮/漆黒の
// 効果で拡張されたカード)」枚数をflexibleとし、flexibleはワイルドと同様どちらにも
// 割り振れる母数として扱う。
function redBlackBalanced(chain: Card[], items: ItemId[]): boolean {
  const realCards = chain.filter(c => !c.wild)
  let realRedOnly = 0
  let realBlackOnly = 0
  let flexible = 0
  for (const c of realCards) {
    const colors = cardColors(c, items)
    if (colors.red && colors.black) flexible += 1
    else if (colors.red) realRedOnly += 1
    else realBlackOnly += 1
  }
  const wildCount = chain.filter(c => c.wild).length
  const totalFlexible = wildCount + flexible
  const diff = Math.abs(realRedOnly - realBlackOnly)
  const totalIsEven = (realRedOnly + realBlackOnly + totalFlexible) % 2 === 0
  return diff <= totalFlexible && totalIsEven
}
```

`balance`(均衡)・`harmony`(調和)エントリの`effect`内、`redBlackBalanced`の呼び出しに`ctx.items`を追加する。

変更前:
```ts
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
```

変更後:
```ts
  balance: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      redBlackBalanced(ctx.chain, ctx.items) ? { value: v + p.talismans.balance.n, part: addPart('均衡', p.talismans.balance.n) } : { value: v, part: null },
  },
  harmony: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!redBlackBalanced(ctx.chain, ctx.items)) return { value: v, part: null }
      const factor = p.talismans.harmony.x
      return { value: v * factor, part: multiplyPart('調和', factor) }
    },
  },
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "均衡・調和"`
Expected: PASS(3件とも)

- [ ] **Step 5: 全体テスト・型チェックを実行する**

Run: `npx vitest run`
Expected: 全件PASS

Run: `npm run check`
Expected: shidasu関連のエラー0件

- [ ] **Step 6: Commit**

```bash
git add src/lib/game/shidasu/chainAttributeEffects.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 均衡・調和の赤黒判定に紅蓮・漆黒の拡張解釈を反映"
```

---

### Task 5: isPlayableに誓約・契りの制約を追加する

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/routes/game/shidasu/PlayArea.svelte`(isPlayable呼び出し1箇所)
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`で`isPlayable`の既存テストを探し(`describe('isPlayable'`または類似)、その直後に以下を追加する。

```ts
describe('isPlayable with 誓約・契り', () => {
  test('誓約所持時、チェーン最新札と異なる色のカードは取れない', () => {
    const wave = makeWave({
      foundation: card(0, '♥', 5),
      chain: [card(0, '♥', 5)],
    })
    // ♥5(赤)の隣接ランク6を、黒のスペードで用意(rank差1でisPlayableの基本条件は満たす)
    expect(isPlayable('none', wave, card(1, '♠', 6), ['vow'])).toBe(false)
  })

  test('誓約所持時、チェーン最新札と同じ色のカードは取れる', () => {
    const wave = makeWave({
      foundation: card(0, '♥', 5),
      chain: [card(0, '♥', 5)],
    })
    expect(isPlayable('none', wave, card(1, '♦', 6), ['vow'])).toBe(true)
  })

  test('誓約所持時、チェーンが空(ウェーブ最初の1枚)なら色制約は適用されない', () => {
    const wave = makeWave({
      foundation: card(0, '♥', 5),
      chain: [],
    })
    expect(isPlayable('none', wave, card(1, '♠', 6), ['vow'])).toBe(true)
  })

  test('誓約を所持していなければ色制約は適用されない', () => {
    const wave = makeWave({
      foundation: card(0, '♥', 5),
      chain: [card(0, '♥', 5)],
    })
    expect(isPlayable('none', wave, card(1, '♠', 6), [])).toBe(true)
  })

  test('契り所持時、チェーン最新札と異なるスートのカードは取れない', () => {
    const wave = makeWave({
      foundation: card(0, '♥', 5),
      chain: [card(0, '♥', 5)],
    })
    expect(isPlayable('none', wave, card(1, '♦', 6), ['pact'])).toBe(false)
  })

  test('契り所持時、チェーン最新札と同じスートのカードは取れる', () => {
    const wave = makeWave({
      foundation: card(0, '♥', 5),
      chain: [card(0, '♥', 5)],
    })
    expect(isPlayable('none', wave, card(1, '♥', 6), ['pact'])).toBe(true)
  })

  test('誓約+紅蓮所持時、黒札のチェーンに対して赤札(紅蓮で黒扱いも可)が取れる', () => {
    const wave = makeWave({
      foundation: card(0, '♠', 5),
      chain: [card(0, '♠', 5)],
    })
    // ♠5(黒)の隣接ランク6を、赤のハートで用意。護符なしなら不一致で弾かれるが、
    // 紅蓮所持時は赤札も「黒扱い」できるため一致とみなされる
    expect(isPlayable('none', wave, card(1, '♥', 6), ['vow', 'crimson'])).toBe(true)
  })
})
```

「誓約」の英語IDは`vow`、「契り」の英語IDは`pact`とする。

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "isPlayable with"`
Expected: FAIL(`isPlayable`が第4引数`items`を受け付けないため型エラー、または誓約・契りの制約が反映されず全て`true`になる)

- [ ] **Step 3: isPlayableに誓約・契りの制約を実装する**

`src/lib/game/shidasu/engine.ts`の`isPlayable`関数を以下のように変更する。まずファイル冒頭のimportに`cardColors`を追加する必要があるか確認し、なければ追加する。

`src/lib/game/shidasu/engine.ts`の`import`文に`patterns`からの`cardColors`が含まれているか確認し、含まれていなければ追加する(既存の`isFace`等のimportと同じ行、または近い行に追記)。

`isPlayable`関数を以下のように変更する。

変更前:
```ts
export function isPlayable(modifier: StageModifier, wave: WaveState, card: Card): boolean {
  // faceLockはワイルド(場札含む)より優先して評価する: ワイルド場札でも絵札はコンボ不足なら拒否する
  if (modifier === 'faceLock' && isFace(card) && wave.combo < 2) return false
  if (card.wild || wave.foundation.wild) return true
  const d = Math.abs(card.rank - wave.foundation.rank)
  if (d === 1) return true
  if (d === 12 && modifier !== 'noLoop') return true
  // エワズ発動中は、そのウェーブが終わるまでランク差2(ループ越え含む)も許可する。
  // 階段パターン判定(analyzeStair)には一切影響しない。
  if (wave.ehwazActiveThisWave) {
    if (d === 2) return true
    if (d === 11 && modifier !== 'noLoop') return true
  }
  return false
}
```

変更後:
```ts
export function isPlayable(modifier: StageModifier, wave: WaveState, card: Card, items: ItemId[] = []): boolean {
  // faceLockはワイルド(場札含む)より優先して評価する: ワイルド場札でも絵札はコンボ不足なら拒否する
  if (modifier === 'faceLock' && isFace(card) && wave.combo < 2) return false
  if (card.wild || wave.foundation.wild) return true
  const d = Math.abs(card.rank - wave.foundation.rank)
  const rankOk = d === 1 || (d === 12 && modifier !== 'noLoop') ||
    (wave.ehwazActiveThisWave && (d === 2 || (d === 11 && modifier !== 'noLoop')))
  if (!rankOk) return false

  // 誓約・契り: チェーンの最新実カードと色/スートが一致しなければ取れない(チェーンが空なら制約なし)
  const lastChainCard = wave.chain[wave.chain.length - 1]
  if (lastChainCard && !lastChainCard.wild) {
    if (items.includes('vow')) {
      const lastColors = cardColors(lastChainCard, items)
      const cardCol = cardColors(card, items)
      const colorMatches = (lastColors.red && cardCol.red) || (lastColors.black && cardCol.black)
      if (!colorMatches) return false
    }
    if (items.includes('pact') && !card.wild && lastChainCard.suit !== card.suit) {
      return false
    }
  }

  return true
}
```

`ItemId`型が`engine.ts`で既にimportされているか確認し、なければ`types`からのimportに追加する。

- [ ] **Step 4: isPlayableの呼び出し元にitemsを渡すよう更新する**

`src/lib/game/shidasu/engine.ts`の`getPlayableRowsInColumn`・`getPlayableColumns`関数、および`playCard`関数内の`isPlayable`呼び出しを更新する。

変更前:
```ts
export function getPlayableRowsInColumn(modifier: StageModifier, wave: WaveState, colIndex: number): Set<number> {
  const col = wave.tableau[colIndex]
  const result = new Set<number>()
  if (!col || col.length === 0) return result
  if (wave.playFromAnywhereActiveThisWave) {
    col.forEach((c, ri) => {
      if (isPlayable(modifier, wave, c)) result.add(ri)
    })
  } else {
    const topIndex = col.length - 1
    if (isPlayable(modifier, wave, col[topIndex])) result.add(topIndex)
  }
  return result
}

export function getPlayableColumns(modifier: StageModifier, wave: WaveState): Set<number> {
  const result = new Set<number>()
  wave.tableau.forEach((col, i) => {
    if (getPlayableRowsInColumn(modifier, wave, i).size > 0) result.add(i)
  })
  return result
}
```

変更後:
```ts
export function getPlayableRowsInColumn(modifier: StageModifier, wave: WaveState, colIndex: number, items: ItemId[] = []): Set<number> {
  const col = wave.tableau[colIndex]
  const result = new Set<number>()
  if (!col || col.length === 0) return result
  if (wave.playFromAnywhereActiveThisWave) {
    col.forEach((c, ri) => {
      if (isPlayable(modifier, wave, c, items)) result.add(ri)
    })
  } else {
    const topIndex = col.length - 1
    if (isPlayable(modifier, wave, col[topIndex], items)) result.add(topIndex)
  }
  return result
}

export function getPlayableColumns(modifier: StageModifier, wave: WaveState, items: ItemId[] = []): Set<number> {
  const result = new Set<number>()
  wave.tableau.forEach((col, i) => {
    if (getPlayableRowsInColumn(modifier, wave, i, items).size > 0) result.add(i)
  })
  return result
}
```

`playCard`関数内、`if (!isPlayable(modifier, wave, card)) return { wave, deckComposition }`の行を以下のように変更する。

変更前:
```ts
  if (!isPlayable(modifier, wave, card)) return { wave, deckComposition }
```

変更後:
```ts
  if (!isPlayable(modifier, wave, card, items)) return { wave, deckComposition }
```

(`playCard`は既に`items: ItemId[]`引数を持っているため、そのまま渡せる)

- [ ] **Step 5: PlayArea.svelteの呼び出し2箇所にitemsを渡す**

`src/routes/game/shidasu/PlayArea.svelte`の`getPlayableColumns`・`isPlayable`呼び出しを更新する。

変更前(802行目付近):
```svelte
  let playableCols = $derived(getPlayableColumns(modifier, wave))
```

変更後:
```svelte
  let playableCols = $derived(getPlayableColumns(modifier, wave, items))
```

変更前(901行目付近):
```svelte
              {@const isCardPlayable = !columnTargetMode && wave.status === 'playing' && isPlayable(modifier, wave, card)}
```

変更後:
```svelte
              {@const isCardPlayable = !columnTargetMode && wave.status === 'playing' && isPlayable(modifier, wave, card, items)}
```

`PlayArea.svelte`は既に`items: ItemId[]`をpropsとして受け取っているため、そのまま参照できる。`isPlayable`・`getPlayableColumns`が`$lib/game/shidasu/engine`からimportされていることを確認する。

- [ ] **Step 6: テストを実行して成功を確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "isPlayable with"`
Expected: PASS(7件とも)

- [ ] **Step 7: 全体テスト・型チェックを実行する**

Run: `npx vitest run`
Expected: 全件PASS(既存の`isPlayable`呼び出しはデフォルト値`items = []`で動くため退行なし)

Run: `npm run check`
Expected: shidasu関連のエラー0件

- [ ] **Step 8: Commit**

```bash
git add src/lib/game/shidasu/engine.ts src/routes/game/shidasu/PlayArea.svelte src/lib/game/shidasu/engine.test.ts
git commit -m "feat: isPlayableに誓約・契りの色/スート制約を実装"
```

---

### Task 6: 誓約・契り・紅蓮・漆黒の護符データを追加する(倍算効果+護符定義)

**Files:**
- Modify: `src/lib/game/shidasu/params.ts`(型・DEFAULT_PARAMSに4種追加)
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Modify: `src/lib/game/shidasu/itemGroups.ts`(新規グループ追加)
- Modify: `src/lib/game/shidasu/items.ts`(ITEM_POOLに4種追加)
- Modify: `src/lib/game/shidasu/itemActualEffects.ts`
- Modify: `src/lib/game/shidasu/cardComboEffects.ts`(誓約・契りの倍算効果)
- Test: `src/lib/game/shidasu/engine.test.ts`

紅蓮・漆黒自体は「色の拡張解釈」効果のみで、`ITEM_EFFECTS`(スコア計算のreduceに登録する効果)は持たない(点数計算に直接寄与しないため)。誓約・契りは「取れる札を制限する代わりに倍算する」効果を`ITEM_EFFECTS`に登録する。

- [ ] **Step 1: params.tsのShidasuParams型に4種を追加する**

`src/lib/game/shidasu/params.ts`の`talismans`型定義、`waterMirror: { name: string; rarity: Rarity; desc: string }`の行の直後に以下を追加する。

```ts
    vow: { name: string; x: number; rarity: Rarity; desc: string }
    pact: { name: string; x: number; rarity: Rarity; desc: string }
    crimson: { name: string; rarity: Rarity; desc: string }
    jetBlack: { name: string; rarity: Rarity; desc: string }
```

- [ ] **Step 2: params.tsのDEFAULT_PARAMSに4種の実データを追加する**

`src/lib/game/shidasu/params.ts`の`DEFAULT_PARAMS.talismans`、`waterMirror: { name: '水鏡', ... }`の行の直後に以下を追加する。

```ts
    vow: { name: '誓約', x: 2, rarity: 'U', desc: 'コンボ内の札と同じ色の札しか取れなくなるが、x倍算' },
    pact: { name: '契り', x: 3, rarity: 'R', desc: 'コンボ内の札と同じスートの札しか取れなくなるが、x倍算' },
    crimson: { name: '紅蓮', rarity: 'U', desc: '全ての札が赤の札としても扱われる' },
    jetBlack: { name: '漆黒', rarity: 'U', desc: '全ての札が黒の札としても扱われる' },
```

- [ ] **Step 3: shidasu.config.jsonに4種の実データを追加する**

`src/lib/game/shidasu/shidasu.config.json`の`talismans`オブジェクト内、`waterMirror`エントリの直後に以下を追加する。

```json
      "vow": { "name": "誓約", "x": 2, "rarity": "U", "desc": "コンボ内の札と同じ色の札しか取れなくなるが、x倍算" },
      "pact": { "name": "契り", "x": 3, "rarity": "R", "desc": "コンボ内の札と同じスートの札しか取れなくなるが、x倍算" },
      "crimson": { "name": "紅蓮", "rarity": "U", "desc": "全ての札が赤の札としても扱われる" },
      "jetBlack": { "name": "漆黒", "rarity": "U", "desc": "全ての札が黒の札としても扱われる" },
```

- [ ] **Step 4: itemGroups.tsに新規グループを追加する**

`src/lib/game/shidasu/itemGroups.ts`の末尾(グループ18の行の直後)に以下を追加する。

```ts
  { label: 'グループ19: デメリット付き倍算・色拡張イネーブラー', ids: ['vow', 'pact', 'crimson', 'jetBlack'] },
```

- [ ] **Step 5: items.tsのITEM_POOLに4種を追加する**

`src/lib/game/shidasu/items.ts`の`ITEM_POOL`配列、`'waterMirror',`の行の直後に以下を追加する。

```ts
  'vow', 'pact', 'crimson', 'jetBlack',
```

- [ ] **Step 6: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`のTask 5で追加したdescribeブロックの直後に、以下を追加する。

```ts
describe('誓約・契りの倍算効果', () => {
  test('誓約所持時、獲得点がx2倍算される', () => {
    const wave = makeWave({
      foundation: card(0, '♥', 5),
      chain: [card(0, '♥', 5)],
      tableau: [[card(1, '♦', 6)], [card(2, '♦', 2)]],
    })
    const withoutVow = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    const withVow = playCard(DEFAULT_PARAMS, wave, 'none', ['vow'], 1000000, 0, standardDeckComposition())
    expect(withVow.wave.score).toBe(withoutVow.wave.score * DEFAULT_PARAMS.talismans.vow.x)
  })

  test('契り所持時、獲得点がx3倍算される', () => {
    const wave = makeWave({
      foundation: card(0, '♥', 5),
      chain: [card(0, '♥', 5)],
      tableau: [[card(1, '♥', 6)], [card(2, '♦', 2)]],
    })
    const withoutPact = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    const withPact = playCard(DEFAULT_PARAMS, wave, 'none', ['pact'], 1000000, 0, standardDeckComposition())
    expect(withPact.wave.score).toBe(withoutPact.wave.score * DEFAULT_PARAMS.talismans.pact.x)
  })
})
```

- [ ] **Step 7: テストを実行して失敗を確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "誓約・契りの倍算効果"`
Expected: FAIL(`vow`/`pact`が`ITEM_EFFECTS`に登録されておらず倍算が発生しない)

- [ ] **Step 8: cardComboEffects.tsに誓約・契りの倍算効果を追加する**

`src/lib/game/shidasu/cardComboEffects.ts`の`CARD_COMBO_EFFECTS`オブジェクト末尾(`dawn`エントリの直後)に以下を追加する。

```ts
  vow: {
    channel: 'gained',
    effect: (v, _ctx, p) => {
      const factor = p.talismans.vow.x
      return { value: v * factor, part: multiplyPart('誓約', factor) }
    },
  },
  pact: {
    channel: 'gained',
    effect: (v, _ctx, p) => {
      const factor = p.talismans.pact.x
      return { value: v * factor, part: multiplyPart('契り', factor) }
    },
  },
```

- [ ] **Step 9: テストを実行して成功を確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "誓約・契りの倍算効果"`
Expected: PASS(2件とも)

- [ ] **Step 10: itemActualEffects.tsに4種の説明文を追加する**

`src/lib/game/shidasu/itemActualEffects.ts`を開き、既存の護符の説明文パターン(1エントリ1行、`id: '説明文',`の形式)を確認した上で、末尾に`vow`・`pact`・`crimson`・`jetBlack`の実際の効果を簡潔に説明する行を追加する。

- [ ] **Step 11: 全体テスト・型チェックを実行する**

Run: `npx vitest run`
Expected: 全件PASS

Run: `npm run check`
Expected: shidasu関連のエラー0件

- [ ] **Step 12: Commit**

```bash
git add src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/itemGroups.ts src/lib/game/shidasu/items.ts src/lib/game/shidasu/itemActualEffects.ts src/lib/game/shidasu/cardComboEffects.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 誓約・契り・紅蓮・漆黒の護符データと倍算効果を追加"
```

---

### Task 7: 秘儀(ヴンヨー・ラグズ)に紅蓮・漆黒を反映する

**Files:**
- Modify: `src/lib/game/shidasu/riteEffects.ts`
- Modify: `src/lib/game/shidasu/engine.ts`(applyRiteEffect呼び出し元)
- Test: `src/lib/game/shidasu/riteEffects.test.ts`(存在すれば確認、なければ`engine.test.ts`に追加)

- [ ] **Step 1: riteEffects.test.tsが存在するか確認する**

Run: `ls src/lib/game/shidasu/riteEffects.test.ts`

- [ ] **Step 2: applyRiteEffectのシグネチャにitemsを追加する**

`src/lib/game/shidasu/riteEffects.ts`の1行目のimportに`ItemId`を追加する。

変更前:
```ts
import type { Card, Rank, Suit, WaveState, RiteId } from './types'
import type { ShidasuParams } from './params'
import { isRed, isFace } from './patterns'
import { shuffleInPlace } from './deck'
```

変更後:
```ts
import type { Card, Rank, Suit, WaveState, RiteId, ItemId } from './types'
import type { ShidasuParams } from './params'
import { isRed, isFace, cardColors } from './patterns'
import { shuffleInPlace } from './deck'
```

`applyWunjo`・`applyLaguz`関数のシグネチャに`items: ItemId[]`引数を追加し、`isRed`ベースの集計を`cardColors`ベースに書き換える。

変更前:
```ts
function applyWunjo(wave: WaveState, rand: () => number): WaveState {
  const realCards = wave.tableau.flat().filter(c => !c.wild)
  const redCount = realCards.filter(isRed).length
  const blackCount = realCards.length - redCount
  const toRed = redCount === blackCount ? rand() < 0.5 : redCount > blackCount
  const suits: Suit[] = toRed ? ['♥', '♦'] : ['♠', '♣']
  const tableau = wave.tableau.map(col => col.map(c => (c.wild ? c : { ...c, suit: pickRandom(suits, rand) })))
  return { ...wave, tableau }
}
```

変更後:
```ts
function applyWunjo(wave: WaveState, rand: () => number, items: ItemId[]): WaveState {
  const realCards = wave.tableau.flat().filter(c => !c.wild)
  // 紅蓮・漆黒所持時、両方の性質を持つカードはredCount側にカウントする(都合の良い解釈)。
  // これによりtoRedの判定が紅蓮所持時は赤寄りに、漆黒所持時は挙動に影響しにくくなる。
  const redCount = realCards.filter(c => cardColors(c, items).red).length
  const blackCount = realCards.length - redCount
  const toRed = redCount === blackCount ? rand() < 0.5 : redCount > blackCount
  const suits: Suit[] = toRed ? ['♥', '♦'] : ['♠', '♣']
  const tableau = wave.tableau.map(col => col.map(c => (c.wild ? c : { ...c, suit: pickRandom(suits, rand) })))
  return { ...wave, tableau }
}
```

変更前:
```ts
function applyLaguz(wave: WaveState, rand: () => number): WaveState {
  if (wave.chain.length < 2) return wave
  const realCards = wave.chain.filter(c => !c.wild)
  if (realCards.length === 0) return wave
  const redCount = realCards.filter(isRed).length
  const blackCount = realCards.length - redCount
  const toRed = redCount === blackCount ? rand() < 0.5 : redCount > blackCount
  const suits: Suit[] = toRed ? ['♥', '♦'] : ['♠', '♣']
  const chain = wave.chain.map(c => (c.wild ? c : { ...c, suit: pickRandom(suits, rand) }))
  return { ...wave, chain, foundation: chain[chain.length - 1] }
}
```

変更後:
```ts
function applyLaguz(wave: WaveState, rand: () => number, items: ItemId[]): WaveState {
  if (wave.chain.length < 2) return wave
  const realCards = wave.chain.filter(c => !c.wild)
  if (realCards.length === 0) return wave
  const redCount = realCards.filter(c => cardColors(c, items).red).length
  const blackCount = realCards.length - redCount
  const toRed = redCount === blackCount ? rand() < 0.5 : redCount > blackCount
  const suits: Suit[] = toRed ? ['♥', '♦'] : ['♠', '♣']
  const chain = wave.chain.map(c => (c.wild ? c : { ...c, suit: pickRandom(suits, rand) }))
  return { ...wave, chain, foundation: chain[chain.length - 1] }
}
```

`applyRiteEffect`関数のシグネチャと、`wunjo`・`laguz`のswitchケースを更新する。

変更前:
```ts
export function applyRiteEffect(params: ShidasuParams, wave: WaveState, riteId: RiteId, rand: () => number): WaveState {
  switch (riteId) {
    case 'raidho':
      return applyRaidho(wave, rand)
    case 'jera':
      return applyJera(wave, rand)
    case 'wunjo':
      return applyWunjo(wave, rand)
```

変更後:
```ts
export function applyRiteEffect(params: ShidasuParams, wave: WaveState, riteId: RiteId, rand: () => number, items: ItemId[] = []): WaveState {
  switch (riteId) {
    case 'raidho':
      return applyRaidho(wave, rand)
    case 'jera':
      return applyJera(wave, rand)
    case 'wunjo':
      return applyWunjo(wave, rand, items)
```

`laguz`のcaseも同様に`applyLaguz(wave, rand, items)`に更新する(実際のファイルを開いて該当箇所を探すこと)。

- [ ] **Step 3: engine.tsのapplyRiteEffect呼び出し元を更新する**

`src/lib/game/shidasu/engine.ts`の`useRite`関数内、`applyRiteEffect`呼び出しを更新する。

変更前:
```ts
  const wave = applyRiteEffect(params, run.wave, riteId, rand)
```

変更後:
```ts
  const wave = applyRiteEffect(params, run.wave, riteId, rand, run.items)
```

- [ ] **Step 4: 失敗するテストを書く**

`riteEffects.test.ts`が存在すれば、既存の`ヴンヨー`または`wunjo`のテストパターンを確認した上で、以下のようなテストケースを追加する。存在しなければ、以下の内容で新規作成する。

```ts
// src/lib/game/shidasu/riteEffects.test.ts (新規作成の場合)
import { describe, test, expect } from 'vitest'
import { applyRiteEffect } from './riteEffects'
import { DEFAULT_PARAMS } from './params'
import { card } from './testHelpers'
import type { WaveState } from './types'

function makeWave(overrides: Partial<WaveState> = {}): WaveState {
  return {
    tableau: [], stock: [], foundation: card(0, '♠', 5), score: 0, combo: 0,
    chain: [], chainOrigin: [], linked: false, columnsEmptiedThisCombo: 0,
    comboStreakColumnLengths: [], dealtRows: DEFAULT_PARAMS.layout.rows,
    lastDrawEffect: null, status: 'playing', endReason: null, lastGain: null,
    lastBonusGains: [], firstPlayDone: false, discardPile: [], lastPlayedColumn: null,
    sameColumnStreak: 0, maxComboThisWave: 0, totalColumnsEmptiedThisWave: 0,
    roleFiredThisChain: false, drawContinueCountThisChain: 0, flushActiveThisCombo: false,
    columnSweepActiveThisWave: false, benevolenceUsedThisCombo: false, baseComboCount: 0,
    dedicationX: 1, diligenceX: 1, divineProtectionX: 1,
    roleEchoUsedThisCombo: {}, sameRankEchoUsedThisCombo: [], pendingRoleEcho: null,
    roleOccurrenceCountThisWave: {}, mercyActiveNextCombo: false, sweptColumnsThisCombo: [],
    regenerationUsedThisWave: false, resilienceUsedThisWave: false, comboResetShieldRemaining: 0,
    playFromAnywhereActiveThisWave: false, nauthizActiveThisWave: false, comboFrozenThisWave: false,
    sowiloActiveThisWave: false, sowiloBoostedRole: null, mannazActiveThisWave: false,
    ehwazActiveThisWave: false,
    ...overrides,
  } as WaveState
}

describe('ヴンヨー(wunjo)と紅蓮・漆黒の相互作用', () => {
  test('紅蓮所持時、場札が全て黒でもcardColorsのredがtrueになりランダム判定に影響しうる', () => {
    const wave = makeWave({
      tableau: [[card(1, '♠', 1), card(2, '♣', 2)], [card(3, '♠', 3)]],
    })
    // 決定的な乱数(常に0を返す)で、紅蓮なしなら黒優勢のため必ず黒スートに統一される
    const withoutCrimson = applyRiteEffect(DEFAULT_PARAMS, wave, 'wunjo', () => 0, [])
    expect(withoutCrimson.tableau.flat().every(c => c.suit === '♠' || c.suit === '♣')).toBe(true)
  })
})
```

**注意**: `makeWave`の完全なフィールド一覧は`engine.test.ts`内の`makeWave`実装を参照し、`WaveState`型に必須の全フィールドを漏れなく含めること(上記は簡略版のため、実際の型定義と照合して不足があれば補うこと)。既存の`WaveState`必須フィールド(`ehwazActiveThisWave`等)が漏れていると型エラーになる。

- [ ] **Step 5: テストを実行して失敗を確認する**

Run: `npx vitest run src/lib/game/shidasu/riteEffects.test.ts`
Expected: FAIL(`applyRiteEffect`が第5引数`items`を受け付けない)

- [ ] **Step 6: テストを実行して成功を確認する**

Step 2の実装が完了していれば、このテストは自動的にPASSするはずである。

Run: `npx vitest run src/lib/game/shidasu/riteEffects.test.ts`
Expected: PASS

- [ ] **Step 7: 全体テスト・型チェックを実行する**

Run: `npx vitest run`
Expected: 全件PASS

Run: `npm run check`
Expected: shidasu関連のエラー0件

- [ ] **Step 8: Commit**

```bash
git add src/lib/game/shidasu/riteEffects.ts src/lib/game/shidasu/engine.ts src/lib/game/shidasu/riteEffects.test.ts
git commit -m "feat: 秘儀ヴンヨー・ラグズの赤黒判定に紅蓮・漆黒の拡張解釈を反映"
```

---

### Task 8: 統合確認

**Files:** なし(確認のみ)

- [ ] **Step 1: 護符定義の整合性を確認する**

```bash
grep -n "vow\|pact\|crimson\|jetBlack" src/lib/game/shidasu/items.ts src/lib/game/shidasu/itemGroups.ts
```

Expected: 4護符すべてが両ファイルに出現する

- [ ] **Step 2: 全テストを実行する**

Run: `npx vitest run`
Expected: 全ファイルPASS

- [ ] **Step 3: ビルドを実行する**

Run: `npm run build`
Expected: ビルド成功

- [ ] **Step 4: 型チェックを実行する**

Run: `npm run check`
Expected: shidasu関連のエラー0件(他ツールの既存エラーは無関係のため無視してよい)

- [ ] **Step 5: 開発サーバーでブラウザ確認する**

Run: `npm run dev`
確認項目:
- `/admin/shidasu-debug`で誓約・契りを付与し、コンボ中に色/スートが異なる札が実際にグレーアウト(取得不可)になること
- 誓約+紅蓮の組み合わせで、本来なら色不一致で弾かれるはずの札が取得可能になること
- 誓約・契りを付与した状態でプレイし、獲得点がx2/x3倍算されていること(スコア内訳表示で確認)
- `/admin/shidasu-talismans`で誓約・契り・紅蓮・漆黒の名前・説明文が正しく表示・編集できること

---
