# Shidasu itemEffects.ts さらなる分割 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `src/lib/game/shidasu/itemEffects.ts`(578行)の`ITEM_EFFECTS`レジストリを、`docs/shidasu-gofu-candidates.md`の既存グループ分類に沿って4つのカテゴリファイルに分割し、`itemEffects.ts`本体を型・マージ・ディスパッチ関数のみに縮小する。**挙動は一切変更しない、純粋なリファクタリング。**

**Architecture:** 各護符エントリを4つのカテゴリ定数(`CLEAR_BONUS_EFFECTS`/`CARD_COMBO_EFFECTS`/`CHAIN_ATTRIBUTE_EFFECTS`/`STATE_AND_PATTERN_EFFECTS`)としてそれぞれ独立ファイルに定義し、`itemEffects.ts`側でspread構文により1つの`ITEM_EFFECTS`にマージする。カテゴリファイルは`ItemEffectContext`/`ItemEffect`型を`itemEffects.ts`から型のみimportする(型のみimportは実行時の循環を生まない)。`fmtMultiplier`は実行時循環を避けるため`patterns.ts`に移動する。

**Tech Stack:** TypeScript, Vitest, SvelteKit

**この計画の性質について:** 前回のengine.ts分割と同様、ロジックを一切変更しない「移動のみ」のリファクタリング。各タスクは移動元の正確な行範囲と、移動先の完全なコードを記載する。各タスク完了後、`ITEM_EFFECTS`は常に62護符すべてを含む完全な状態を保ち、テストは常に全件成功する。

---

## 事前準備: 対象ファイルの現状(このplan作成時点)

- `src/lib/game/shidasu/itemEffects.ts`: 579行
- `src/lib/game/shidasu/itemEffects.test.ts`: 576行(`test(`出現数74件)
- `src/lib/game/shidasu/patterns.ts`: 冒頭に`isRed`/`isFace`が既にある(1〜11行目)
- `src/lib/game/shidasu/engine.ts`冒頭のimport(2〜8行目):
  ```ts
  import type { Card, StageModifier, WaveState, ItemId, WaveEndReason, RunState, Suit, Rank, DeckCard, RoleName, BonusGain } from './types'
  import type { ShidasuParams } from './params'
  import { createRng, shuffle, shuffleInPlace, standardDeckComposition } from './deck'
  import { isFace, chainContinuesPattern, evaluateChainBonus, analyzeSuitColor, countSameRankBefore, countSameRankForWildPlay } from './patterns'
  import { rollItemOffer } from './items'
  import { applyDirectEffects, type DirectEffectContext } from './directEffects'
  import { applyItemEffects, fmtMultiplier, type ItemEffectContext } from './itemEffects'
  ```

**重要:** 各タスクは直前のタスクの結果を前提に行番号がずれるため、必ず直前のタスク完了後の実際のファイル内容を`Read`ツールで確認してから作業すること。以下の行番号はすべて上記「事前準備時点」のオリジナルファイルを指す。

---

### Task 1: `fmtMultiplier`を`patterns.ts`へ移動 + `ItemEffect`型のexport化

**Files:**
- Modify: `src/lib/game/shidasu/patterns.ts`
- Modify: `src/lib/game/shidasu/itemEffects.ts`
- Modify: `src/lib/game/shidasu/engine.ts`

**背景:** 後続タスクで作成する4つのカテゴリファイルは、いずれも`fmtMultiplier`を実体として呼び出す必要がある。`itemEffects.ts`に残したままだと「`itemEffects.ts`がカテゴリファイルの効果マップをimportし、カテゴリファイルが`itemEffects.ts`の`fmtMultiplier`をimportする」という実行時の循環importになるため、依存を持たない`patterns.ts`へ移動する。また`ItemEffect`型は現在`itemEffects.ts`内で`export`されておらず、カテゴリファイルが型としてimportできるよう`export`を付与する。

- [ ] **Step 1: `patterns.ts`に`fmtMultiplier`を追加する**

`src/lib/game/shidasu/itemEffects.ts`の43〜46行目(コメント含む)を確認する:

```ts
// 護符の内訳表示用に倍率を丸めて整形する(浮動小数の誤差で末尾が長くなるのを防ぐ)
export function fmtMultiplier(n: number): string {
  return String(Math.round(n * 100) / 100)
}
```

これと全く同じ内容を`patterns.ts`の末尾に追記する。

- [ ] **Step 2: `itemEffects.ts`から`fmtMultiplier`を削除し、`ItemEffect`型をexportする**

`itemEffects.ts`の43〜46行目(`fmtMultiplier`本体)を削除する。

48行目の
```ts
type ItemEffect = (value: number, ctx: ItemEffectContext, params: ShidasuParams) => { value: number; part: string | null }
```
を
```ts
export type ItemEffect = (value: number, ctx: ItemEffectContext, params: ShidasuParams) => { value: number; part: string | null }
```
に変更する(`export`を追加するのみ)。

`itemEffects.ts`の残りのコード(`ITEM_EFFECTS`定数内で`fmtMultiplier`を呼んでいる全箇所)はそのまま残すが、`fmtMultiplier`を`patterns.ts`からimportする必要があるため、ファイル冒頭のimport文を以下に変更する:

```ts
// src/lib/game/shidasu/itemEffects.ts
import type { Card, ItemId, Suit } from './types'
import type { ShidasuParams } from './params'
import { isRed, isFace, analyzeSuitColor, analyzeStair, stairUsesKALoop, fmtMultiplier, type ChainBonusResult } from './patterns'
```

- [ ] **Step 3: `engine.ts`のimportを更新する**

`engine.ts`の8行目:
```ts
import { applyItemEffects, fmtMultiplier, type ItemEffectContext } from './itemEffects'
```
を
```ts
import { applyItemEffects, type ItemEffectContext } from './itemEffects'
```
に変更し、5行目の`patterns`からのimportに`fmtMultiplier`を追加する:
```ts
import { isFace, chainContinuesPattern, evaluateChainBonus, analyzeSuitColor, countSameRankBefore, countSameRankForWildPlay, fmtMultiplier } from './patterns'
```

- [ ] **Step 4: テスト実行・型チェック**

```bash
npm run test
npm run check
```

Expected: 全テスト成功、型エラーなし(ロジック変更はゼロなので、この時点でテスト内容・件数は一切変わらない)。

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/patterns.ts src/lib/game/shidasu/itemEffects.ts src/lib/game/shidasu/engine.ts
git commit -m "refactor: fmtMultiplierをpatterns.tsに移動しItemEffect型をexportする"
```

---

### Task 2: `clearBonusEffects.ts`(グループ1)の抽出

**Files:**
- Create: `src/lib/game/shidasu/clearBonusEffects.ts`
- Create: `src/lib/game/shidasu/clearBonusEffects.test.ts`
- Modify: `src/lib/game/shidasu/itemEffects.ts`
- Modify: `src/lib/game/shidasu/itemEffects.test.ts`

**対象護符:** 忍耐(patience)・浄化(purify)・節制(temperance)。いずれも`channel: 'clearBonus'`。

- [ ] **Step 1: `clearBonusEffects.ts`を新規作成する**

以下の内容で作成する(Task1後の`itemEffects.ts`から`patience`/`purify`/`temperance`の3エントリをそのまま移す):

```ts
// src/lib/game/shidasu/clearBonusEffects.ts
import type { ItemId } from './types'
import type { ShidasuParams } from './params'
import { fmtMultiplier } from './patterns'
import type { ItemEffectContext, ItemEffect } from './itemEffects'

export const CLEAR_BONUS_EFFECTS: Partial<Record<ItemId, { channel: 'gained' | 'clearBonus'; effect: ItemEffect }>> = {
  patience: {
    channel: 'clearBonus',
    effect: (v, ctx, p) => {
      const add = ctx.stockRemaining * p.talismans.patience.x
      return { value: v + add, part: `忍耐+${add}` }
    },
  },
  purify: {
    channel: 'clearBonus',
    effect: (v, _ctx, p) => ({ value: v + p.talismans.purify.n, part: `浄化+${p.talismans.purify.n}` }),
  },
  temperance: {
    channel: 'clearBonus',
    effect: (v, ctx, p) => {
      const factor = 1 + ctx.stockRemaining * p.talismans.temperance.x
      return { value: v * factor, part: `節制×${fmtMultiplier(factor)}` }
    },
  },
}
```

- [ ] **Step 2: `itemEffects.ts`から3エントリを削除し、spreadでマージする**

`ITEM_EFFECTS`定数の先頭にあった`patience`/`purify`/`temperance`の3エントリを削除する。ファイル冒頭に以下のimportを追加する:

```ts
import { CLEAR_BONUS_EFFECTS } from './clearBonusEffects'
```

`const ITEM_EFFECTS: Partial<Record<ItemId, { channel: 'gained' | 'clearBonus'; effect: ItemEffect }>> = {`の直後に以下を追加する:

```ts
  ...CLEAR_BONUS_EFFECTS,
```

- [ ] **Step 3: `clearBonusEffects.test.ts`を新規作成する**

`itemEffects.test.ts`の`describe('applyItemEffects', ...)`ブロック内、17〜35行目の3テスト(`patience`・`purify`・`temperance`のテスト)を、以下のヘッダーとともに新規ファイルに移す(アサーション内容は一切変更しない):

```ts
// src/lib/game/shidasu/clearBonusEffects.test.ts
import { describe, test, expect } from 'vitest'
import { applyItemEffects } from './itemEffects'
import { DEFAULT_PARAMS } from './params'
import { ctx } from './testHelpers'

describe('applyItemEffects (グループ1: 全消しボーナス系)', () => {
  const params = DEFAULT_PARAMS

  test('patience: clearBonusチャンネルで残り山札数×xを加算し、内訳に「忍耐+n」が入る', () => {
    const result = applyItemEffects('clearBonus', 1000, ['patience'], ctx({ stockRemaining: 4 }), params)
    const add = 4 * params.talismans.patience.x
    expect(result.value).toBe(1000 + add)
    expect(result.parts).toEqual([`忍耐+${add}`])
  })

  test('purify: clearBonusチャンネルでnを加算し、内訳に「浄化+n」が入る', () => {
    const result = applyItemEffects('clearBonus', 1000, ['purify'], ctx(), params)
    expect(result.value).toBe(1000 + params.talismans.purify.n)
    expect(result.parts).toEqual([`浄化+${params.talismans.purify.n}`])
  })

  test('temperance: clearBonusチャンネルで残り山札数×x分倍算し、内訳に「節制×倍率」が入る', () => {
    const result = applyItemEffects('clearBonus', 1000, ['temperance'], ctx({ stockRemaining: 4 }), params)
    const factor = 1 + 4 * params.talismans.temperance.x
    expect(result.value).toBe(1000 * factor)
    expect(result.parts).toEqual([`節制×${factor}`])
  })
})
```

- [ ] **Step 4: `itemEffects.test.ts`から該当3テストを削除する**

上記3テスト(17〜35行目)を`itemEffects.test.ts`から削除する。残る`describe('applyItemEffects', ...)`ブロックには「未登録の護符は素通り」テスト・(このあとTask3で移す)springBreeze等のテスト・「複数護符は所持順」テスト・「gainedチャンネルの護符はclearBonus…」テストが残る。

- [ ] **Step 5: テスト実行・型チェック**

```bash
npm run test
npm run check
```

Expected: 全テスト成功、型エラーなし。テストケース総数(`test(`出現数)は分割前後で変化しないこと。

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/clearBonusEffects.ts src/lib/game/shidasu/clearBonusEffects.test.ts src/lib/game/shidasu/itemEffects.ts src/lib/game/shidasu/itemEffects.test.ts
git commit -m "refactor: グループ1(全消しボーナス系)護符をclearBonusEffects.tsに分離"
```

---

### Task 3: `cardComboEffects.ts`(グループ2+3)の抽出

**Files:**
- Create: `src/lib/game/shidasu/cardComboEffects.ts`
- Create: `src/lib/game/shidasu/cardComboEffects.test.ts`
- Modify: `src/lib/game/shidasu/itemEffects.ts`
- Modify: `src/lib/game/shidasu/itemEffects.test.ts`

**対象護符(15個):** 春風(springBreeze)・夏風(summerBreeze)・秋風(autumnBreeze)・冬風(winterBreeze)・友愛(kinship)・雪解(thaw)・宵闇(dusk)・払暁(dawn)・機知(wit)・勇気(courage)・暁(daybreak)・黄昏(twilight)・快活(cheerful)・良心(conscience)・朝霧(morningMist)。すべて`channel: 'gained'`。

- [ ] **Step 1: `cardComboEffects.ts`を新規作成する**

Task2後の`itemEffects.ts`を`Read`し、上記15エントリをこの順序のまま新規ファイルに移す(ロジック変更なし)。

```ts
// src/lib/game/shidasu/cardComboEffects.ts
import type { ItemId } from './types'
import { isRed, fmtMultiplier } from './patterns'
import type { ItemEffect } from './itemEffects'

export const CARD_COMBO_EFFECTS: Partial<Record<ItemId, { channel: 'gained' | 'clearBonus'; effect: ItemEffect }>> = {
  springBreeze: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.card.suit === '♣'
        ? { value: v + p.talismans.springBreeze.n, part: `春風+${p.talismans.springBreeze.n}` }
        : { value: v, part: null },
  },
  summerBreeze: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.card.suit === '♦'
        ? { value: v + p.talismans.summerBreeze.n, part: `夏風+${p.talismans.summerBreeze.n}` }
        : { value: v, part: null },
  },
  autumnBreeze: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.card.suit === '♥'
        ? { value: v + p.talismans.autumnBreeze.n, part: `秋風+${p.talismans.autumnBreeze.n}` }
        : { value: v, part: null },
  },
  winterBreeze: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.card.suit === '♠'
        ? { value: v + p.talismans.winterBreeze.n, part: `冬風+${p.talismans.winterBreeze.n}` }
        : { value: v, part: null },
  },
  kinship: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.card.suit === '♥' && ctx.previousFoundation.suit !== '♥'
        ? { value: v + p.talismans.kinship.n, part: `友愛+${p.talismans.kinship.n}` }
        : { value: v, part: null },
  },
  thaw: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.previousFoundation.suit === '♠' && ctx.card.suit !== '♠'
        ? { value: v + p.talismans.thaw.n, part: `雪解+${p.talismans.thaw.n}` }
        : { value: v, part: null },
  },
  dusk: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      isRed(ctx.previousFoundation) && !isRed(ctx.card)
        ? { value: v + p.talismans.dusk.n, part: `宵闇+${p.talismans.dusk.n}` }
        : { value: v, part: null },
  },
  dawn: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      !isRed(ctx.previousFoundation) && isRed(ctx.card)
        ? { value: v + p.talismans.dawn.n, part: `払暁+${p.talismans.dawn.n}` }
        : { value: v, part: null },
  },
  wit: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.card.wild ? { value: v + p.talismans.wit.n, part: `機知+${p.talismans.wit.n}` } : { value: v, part: null },
  },
  courage: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const factor = 1 + ctx.combo * p.talismans.courage.x
      return { value: v * factor, part: `勇気×${fmtMultiplier(factor)}` }
    },
  },
  daybreak: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.combo <= p.talismans.daybreak.c
        ? { value: v * p.talismans.daybreak.x, part: `暁×${fmtMultiplier(p.talismans.daybreak.x)}` }
        : { value: v, part: null },
  },
  twilight: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.combo >= p.talismans.twilight.c
        ? { value: v * p.talismans.twilight.x, part: `黄昏×${fmtMultiplier(p.talismans.twilight.x)}` }
        : { value: v, part: null },
  },
  cheerful: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.combo % 2 === 0
        ? { value: v + p.talismans.cheerful.n, part: `快活+${p.talismans.cheerful.n}` }
        : { value: v, part: null },
  },
  conscience: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.combo % 2 !== 0
        ? { value: v + p.talismans.conscience.n, part: `良心+${p.talismans.conscience.n}` }
        : { value: v, part: null },
  },
  morningMist: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const factor = ctx.combo < p.talismans.morningMist.c ? 1 / p.talismans.morningMist.x : p.talismans.morningMist.x
      return { value: v * factor, part: `朝霧×${fmtMultiplier(factor)}` }
    },
  },
}
```

- [ ] **Step 2: `itemEffects.ts`から15エントリを削除し、spreadでマージする**

上記15エントリを`ITEM_EFFECTS`定数から削除する。冒頭importに以下を追加する:

```ts
import { CARD_COMBO_EFFECTS } from './cardComboEffects'
```

`ITEM_EFFECTS`定数の`...CLEAR_BONUS_EFFECTS,`の直後に以下を追加する:

```ts
  ...CARD_COMBO_EFFECTS,
```

- [ ] **Step 3: `cardComboEffects.test.ts`を新規作成する**

`itemEffects.test.ts`(Task2適用後)の`describe('applyItemEffects', ...)`ブロック内にある、springBreeze〜morningMistの15テスト(元ファイルで37〜139行目)を、以下のヘッダーとともに新規ファイルに移す(アサーション内容は一切変更しない):

```ts
// src/lib/game/shidasu/cardComboEffects.test.ts
import { describe, test, expect } from 'vitest'
import { applyItemEffects } from './itemEffects'
import { DEFAULT_PARAMS } from './params'
import { card, ctx } from './testHelpers'

describe('applyItemEffects (グループ2+3: カード単体属性・コンボ数系)', () => {
  const params = DEFAULT_PARAMS

  test('springBreeze: ♣を取った時のみgainedにnを加算し、内訳に「春風+n」が入る', () => {
    const withClub = applyItemEffects('gained', 100, ['springBreeze'], ctx({ card: card(1, '♣', 5) }), params)
    expect(withClub.value).toBe(100 + params.talismans.springBreeze.n)
    expect(withClub.parts).toEqual([`春風+${params.talismans.springBreeze.n}`])
    const withoutClub = applyItemEffects('gained', 100, ['springBreeze'], ctx({ card: card(1, '♥', 5) }), params)
    expect(withoutClub.value).toBe(100)
    expect(withoutClub.parts).toEqual([])
  })

  test('summerBreeze: ♦を取った時のみgainedにnを加算', () => {
    const result = applyItemEffects('gained', 100, ['summerBreeze'], ctx({ card: card(1, '♦', 5) }), params)
    expect(result.value).toBe(100 + params.talismans.summerBreeze.n)
  })

  test('autumnBreeze: ♥を取った時のみgainedにnを加算', () => {
    const result = applyItemEffects('gained', 100, ['autumnBreeze'], ctx({ card: card(1, '♥', 5) }), params)
    expect(result.value).toBe(100 + params.talismans.autumnBreeze.n)
  })

  test('winterBreeze: ♠を取った時のみgainedにnを加算', () => {
    const result = applyItemEffects('gained', 100, ['winterBreeze'], ctx({ card: card(1, '♠', 5) }), params)
    expect(result.value).toBe(100 + params.talismans.winterBreeze.n)
  })

  test('kinship: 直前が♥以外から今回♥を取った時のみnを加算', () => {
    const triggered = applyItemEffects('gained', 100, ['kinship'], ctx({ previousFoundation: card(2, '♣', 4), card: card(1, '♥', 5) }), params)
    expect(triggered.value).toBe(100 + params.talismans.kinship.n)
    const notTriggered = applyItemEffects('gained', 100, ['kinship'], ctx({ previousFoundation: card(2, '♥', 4), card: card(1, '♥', 5) }), params)
    expect(notTriggered.value).toBe(100)
  })

  test('thaw: 直前が♠から今回♠以外を取った時のみnを加算', () => {
    const triggered = applyItemEffects('gained', 100, ['thaw'], ctx({ previousFoundation: card(2, '♠', 4), card: card(1, '♥', 5) }), params)
    expect(triggered.value).toBe(100 + params.talismans.thaw.n)
    const notTriggered = applyItemEffects('gained', 100, ['thaw'], ctx({ previousFoundation: card(2, '♠', 4), card: card(1, '♠', 6) }), params)
    expect(notTriggered.value).toBe(100)
  })

  test('dusk: 直前が赤から今回黒を取った時のみnを加算', () => {
    const triggered = applyItemEffects('gained', 100, ['dusk'], ctx({ previousFoundation: card(2, '♥', 4), card: card(1, '♠', 5) }), params)
    expect(triggered.value).toBe(100 + params.talismans.dusk.n)
    const notTriggered = applyItemEffects('gained', 100, ['dusk'], ctx({ previousFoundation: card(2, '♠', 4), card: card(1, '♣', 5) }), params)
    expect(notTriggered.value).toBe(100)
  })

  test('dawn: 直前が黒から今回赤を取った時のみnを加算', () => {
    const triggered = applyItemEffects('gained', 100, ['dawn'], ctx({ previousFoundation: card(2, '♠', 4), card: card(1, '♥', 5) }), params)
    expect(triggered.value).toBe(100 + params.talismans.dawn.n)
    const notTriggered = applyItemEffects('gained', 100, ['dawn'], ctx({ previousFoundation: card(2, '♥', 4), card: card(1, '♦', 5) }), params)
    expect(notTriggered.value).toBe(100)
  })

  test('wit: ワイルドを取った時のみnを加算', () => {
    const triggered = applyItemEffects('gained', 100, ['wit'], ctx({ card: card(1, '★', 0, true) }), params)
    expect(triggered.value).toBe(100 + params.talismans.wit.n)
    const notTriggered = applyItemEffects('gained', 100, ['wit'], ctx({ card: card(1, '♠', 5) }), params)
    expect(notTriggered.value).toBe(100)
  })

  test('courage: コンボ数×xで倍算し、内訳に「勇気×倍率」が入る', () => {
    const result = applyItemEffects('gained', 100, ['courage'], ctx({ combo: 5 }), params)
    const factor = 1 + 5 * params.talismans.courage.x
    expect(result.value).toBe(100 * factor)
    expect(result.parts).toEqual([`勇気×${factor}`])
  })

  test('daybreak: コンボ数がc以下の時のみx倍', () => {
    const triggered = applyItemEffects('gained', 100, ['daybreak'], ctx({ combo: params.talismans.daybreak.c }), params)
    expect(triggered.value).toBe(100 * params.talismans.daybreak.x)
    const notTriggered = applyItemEffects('gained', 100, ['daybreak'], ctx({ combo: params.talismans.daybreak.c + 1 }), params)
    expect(notTriggered.value).toBe(100)
  })

  test('twilight: コンボ数がc以上の時のみx倍', () => {
    const triggered = applyItemEffects('gained', 100, ['twilight'], ctx({ combo: params.talismans.twilight.c }), params)
    expect(triggered.value).toBe(100 * params.talismans.twilight.x)
    const notTriggered = applyItemEffects('gained', 100, ['twilight'], ctx({ combo: params.talismans.twilight.c - 1 }), params)
    expect(notTriggered.value).toBe(100)
  })

  test('cheerful: コンボ数が偶数の時のみnを加算', () => {
    const triggered = applyItemEffects('gained', 100, ['cheerful'], ctx({ combo: 4 }), params)
    expect(triggered.value).toBe(100 + params.talismans.cheerful.n)
    const notTriggered = applyItemEffects('gained', 100, ['cheerful'], ctx({ combo: 5 }), params)
    expect(notTriggered.value).toBe(100)
  })

  test('conscience: コンボ数が奇数の時のみnを加算', () => {
    const triggered = applyItemEffects('gained', 100, ['conscience'], ctx({ combo: 5 }), params)
    expect(triggered.value).toBe(100 + params.talismans.conscience.n)
    const notTriggered = applyItemEffects('gained', 100, ['conscience'], ctx({ combo: 4 }), params)
    expect(notTriggered.value).toBe(100)
  })

  test('morningMist: コンボ数がc未満なら1/x倍、c以上ならx倍で、内訳に「朝霧×倍率」が入る', () => {
    const below = applyItemEffects('gained', 100, ['morningMist'], ctx({ combo: params.talismans.morningMist.c - 1 }), params)
    const belowFactor = 1 / params.talismans.morningMist.x
    expect(below.value).toBe(100 * belowFactor)
    expect(below.parts).toEqual([`朝霧×${Math.round(belowFactor * 100) / 100}`])
    const aboveOrEqual = applyItemEffects('gained', 100, ['morningMist'], ctx({ combo: params.talismans.morningMist.c }), params)
    expect(aboveOrEqual.value).toBe(100 * params.talismans.morningMist.x)
    expect(aboveOrEqual.parts).toEqual([`朝霧×${params.talismans.morningMist.x}`])
  })
})
```

- [ ] **Step 4: `itemEffects.test.ts`から該当15テストを削除する**

上記15テストを削除する。残る`describe('applyItemEffects', ...)`ブロックには「未登録の護符は素通り」テスト・「複数護符は所持順」テスト・「gainedチャンネルの護符はclearBonus…」テストの3件のみが残る(これが最終形)。

- [ ] **Step 5: テスト実行・型チェック**

```bash
npm run test
npm run check
```

Expected: 全テスト成功、型エラーなし。テストケース総数は分割前後で変化しないこと。

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/cardComboEffects.ts src/lib/game/shidasu/cardComboEffects.test.ts src/lib/game/shidasu/itemEffects.ts src/lib/game/shidasu/itemEffects.test.ts
git commit -m "refactor: グループ2+3(カード単体属性・コンボ数系)護符をcardComboEffects.tsに分離"
```

---

### Task 4: `chainAttributeEffects.ts`(グループ4)の抽出

**Files:**
- Create: `src/lib/game/shidasu/chainAttributeEffects.ts`
- Create: `src/lib/game/shidasu/chainAttributeEffects.test.ts`
- Modify: `src/lib/game/shidasu/itemEffects.ts`
- Modify: `src/lib/game/shidasu/itemEffects.test.ts`

**対象護符(24個):** 平穏(calm)・安寧(serenity)・運命(destiny)・宿命(fate)・安堵(relief)・深緑(verdantGreen)・宝石(gem)・真剣(resolve)・聖杯(grail)・月光(moonlight)・陽光(sunlight)・王冠(crown)・青葉(cloverLeaf)・硬貨(coin)・武器(blade)・献杯(chalice)・均衡(balance)・調和(harmony)・高潔(nobility)・執念(tenacity)・覚悟(determination)・循環(cycle)・輪廻(reincarnation)・威光(majesty)。すべて`channel: 'gained'`。

このグループのみが使う内部ヘルパー関数(`chainHasNoFace`・`chainIsFaceOnly`・`chainSuitExclusive`・`chainColorExclusive`・`countSuitInChain`・`countRankInChain`・`redBlackBalanced`)もこのファイルに移す。

- [ ] **Step 1: `chainAttributeEffects.ts`を新規作成する**

Task3後の`itemEffects.ts`を`Read`し、上記24エントリと7つの内部ヘルパー関数(現在`itemEffects.ts`の50〜91行目付近)をこの順序のまま新規ファイルに移す(ロジック変更なし)。

```ts
// src/lib/game/shidasu/chainAttributeEffects.ts
import type { Card, ItemId, Suit } from './types'
import { isRed, isFace, analyzeSuitColor, analyzeStair, stairUsesKALoop, fmtMultiplier } from './patterns'
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
      chainHasNoFace(ctx.chain) ? { value: v + p.talismans.calm.n, part: `平穏+${p.talismans.calm.n}` } : { value: v, part: null },
  },
  serenity: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!chainHasNoFace(ctx.chain)) return { value: v, part: null }
      const factor = p.talismans.serenity.x
      return { value: v * factor, part: `安寧×${fmtMultiplier(factor)}` }
    },
  },
  destiny: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      chainIsFaceOnly(ctx.chain) ? { value: v + p.talismans.destiny.n, part: `運命+${p.talismans.destiny.n}` } : { value: v, part: null },
  },
  fate: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!chainIsFaceOnly(ctx.chain)) return { value: v, part: null }
      const factor = p.talismans.fate.x
      return { value: v * factor, part: `宿命×${fmtMultiplier(factor)}` }
    },
  },
  relief: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.card.wild || (ctx.card.rank >= 1 && ctx.card.rank <= 10)
        ? { value: v + p.talismans.relief.n, part: `安堵+${p.talismans.relief.n}` }
        : { value: v, part: null },
  },
  verdantGreen: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!chainSuitExclusive(ctx.chain, '♣')) return { value: v, part: null }
      const factor = p.talismans.verdantGreen.x
      return { value: v * factor, part: `深緑×${fmtMultiplier(factor)}` }
    },
  },
  gem: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!chainSuitExclusive(ctx.chain, '♦')) return { value: v, part: null }
      const factor = p.talismans.gem.x
      return { value: v * factor, part: `宝石×${fmtMultiplier(factor)}` }
    },
  },
  resolve: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!chainSuitExclusive(ctx.chain, '♠')) return { value: v, part: null }
      const factor = p.talismans.resolve.x
      return { value: v * factor, part: `真剣×${fmtMultiplier(factor)}` }
    },
  },
  grail: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!chainSuitExclusive(ctx.chain, '♥')) return { value: v, part: null }
      const factor = p.talismans.grail.x
      return { value: v * factor, part: `聖杯×${fmtMultiplier(factor)}` }
    },
  },
  moonlight: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!chainColorExclusive(ctx.chain, false)) return { value: v, part: null }
      const factor = p.talismans.moonlight.x
      return { value: v * factor, part: `月光×${fmtMultiplier(factor)}` }
    },
  },
  sunlight: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!chainColorExclusive(ctx.chain, true)) return { value: v, part: null }
      const factor = p.talismans.sunlight.x
      return { value: v * factor, part: `陽光×${fmtMultiplier(factor)}` }
    },
  },
  crown: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const count = countRankInChain(ctx.chain, 13)
      if (count === 0) return { value: v, part: null }
      const factor = 1 + count * p.talismans.crown.x
      return { value: v * factor, part: `王冠×${fmtMultiplier(factor)}` }
    },
  },
  cloverLeaf: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const count = countSuitInChain(ctx.chain, '♣')
      if (count === 0) return { value: v, part: null }
      const add = count * p.talismans.cloverLeaf.n
      return { value: v + add, part: `青葉+${add}` }
    },
  },
  coin: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const count = countSuitInChain(ctx.chain, '♦')
      if (count === 0) return { value: v, part: null }
      const add = count * p.talismans.coin.n
      return { value: v + add, part: `硬貨+${add}` }
    },
  },
  blade: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const count = countSuitInChain(ctx.chain, '♠')
      if (count === 0) return { value: v, part: null }
      const add = count * p.talismans.blade.n
      return { value: v + add, part: `武器+${add}` }
    },
  },
  chalice: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const count = countSuitInChain(ctx.chain, '♥')
      if (count === 0) return { value: v, part: null }
      const add = count * p.talismans.chalice.n
      return { value: v + add, part: `献杯+${add}` }
    },
  },
  balance: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      redBlackBalanced(ctx.chain) ? { value: v + p.talismans.balance.n, part: `均衡+${p.talismans.balance.n}` } : { value: v, part: null },
  },
  harmony: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!redBlackBalanced(ctx.chain)) return { value: v, part: null }
      const factor = p.talismans.harmony.x
      return { value: v * factor, part: `調和×${fmtMultiplier(factor)}` }
    },
  },
  nobility: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const { suitHeld } = analyzeSuitColor(ctx.chain)
      if (ctx.chain.length < ctx.effectiveSuitColorMinLen || !suitHeld) return { value: v, part: null }
      return { value: v + p.talismans.nobility.n, part: `高潔+${p.talismans.nobility.n}` }
    },
  },
  tenacity: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const { suitHeld } = analyzeSuitColor(ctx.chain)
      if (ctx.chain.length < ctx.effectiveSuitColorMinLen || !suitHeld) return { value: v, part: null }
      const factor = 1 + ctx.chain.length * p.talismans.tenacity.x
      return { value: v * factor, part: `執念×${fmtMultiplier(factor)}` }
    },
  },
  determination: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const stairInfo = analyzeStair(ctx.chain)
      if (!stairInfo.held || stairInfo.dir === 0 || stairInfo.len < ctx.effectiveStairMinLen) return { value: v, part: null }
      const factor = 1 + stairInfo.len * p.talismans.determination.x
      return { value: v * factor, part: `覚悟×${fmtMultiplier(factor)}` }
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
      return { value: v * factor, part: `循環×${fmtMultiplier(factor)}` }
    },
  },
  reincarnation: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const stairInfo = analyzeStair(ctx.chain)
      const completeRunFired = ctx.chainBonus.roleFired.some(r => r.name === 'completeRun')
      if (!completeRunFired || !stairInfo.held || stairInfo.dir === 0 || !stairUsesKALoop(ctx.chain)) return { value: v, part: null }
      const factor = p.talismans.reincarnation.x
      return { value: v * factor, part: `輪廻×${fmtMultiplier(factor)}` }
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
      return { value: v * factor, part: `威光×${fmtMultiplier(factor)}` }
    },
  },
}
```

- [ ] **Step 2: `itemEffects.ts`から24エントリ+7ヘルパー関数を削除し、spreadでマージする**

上記24エントリと7つのヘルパー関数を`itemEffects.ts`から削除する。冒頭importに以下を追加する:

```ts
import { CHAIN_ATTRIBUTE_EFFECTS } from './chainAttributeEffects'
```

`ITEM_EFFECTS`定数の`...CARD_COMBO_EFFECTS,`の直後に以下を追加する:

```ts
  ...CHAIN_ATTRIBUTE_EFFECTS,
```

ヘルパー関数削除後、`itemEffects.ts`冒頭の`patterns`からのimportのうち`isFace`・`analyzeSuitColor`・`analyzeStair`・`stairUsesKALoop`が`itemEffects.ts`内で使われなくなっている場合は削除する(`isRed`が引き続き必要かどうかも確認する。`chainAttributeEffects.ts`に完全移動した場合、`itemEffects.ts`本体ではこれらのpatterns関数を直接使わなくなるはずなので、Task5完了後の最終形では`ChainBonusResult`型のみが必要になる見込み。このタスクの時点ではまだ他の護符が`itemEffects.ts`に残っているため、`npm run check`の未使用importの警告に従って過不足なく調整すること)。

- [ ] **Step 3: `chainAttributeEffects.test.ts`を新規作成する**

`itemEffects.test.ts`(Task3適用後)の以下4つのdescribeブロック(元ファイルで158〜351行目)を、アサーション内容を一切変更せずそのまま新規ファイルに移す。

```ts
// src/lib/game/shidasu/chainAttributeEffects.test.ts
import { describe, test, expect } from 'vitest'
import { applyItemEffects } from './itemEffects'
import { DEFAULT_PARAMS } from './params'
import { card, ctx } from './testHelpers'
import type { Card } from './types'

describe('applyItemEffects (グループ4-a: 絵札条件系)', () => {
  const params = DEFAULT_PARAMS

  test('平穏: チェーンにJQKが無ければ加算、絵札が混ざれば不発動', () => {
    const fired = applyItemEffects('gained', 100, ['calm'], ctx({ chain: [card(1, '♠', 5), card(2, '♦', 8)] }), params)
    expect(fired.value).toBe(100 + params.talismans.calm.n)
    const notFired = applyItemEffects('gained', 100, ['calm'], ctx({ chain: [card(1, '♠', 5), card(2, '♦', 12)] }), params)
    expect(notFired.value).toBe(100)
  })

  test('安寧: チェーンにJQKが無ければ倍算', () => {
    const result = applyItemEffects('gained', 100, ['serenity'], ctx({ chain: [card(1, '♠', 5), card(2, '♦', 8)] }), params)
    expect(result.value).toBe(100 * params.talismans.serenity.x)
  })

  test('運命: チェーンがJQKのみなら加算、非絵札が混ざれば不発動', () => {
    const fired = applyItemEffects('gained', 100, ['destiny'], ctx({ chain: [card(1, '♠', 11), card(2, '♦', 13)] }), params)
    expect(fired.value).toBe(100 + params.talismans.destiny.n)
    const notFired = applyItemEffects('gained', 100, ['destiny'], ctx({ chain: [card(1, '♠', 11), card(2, '♦', 5)] }), params)
    expect(notFired.value).toBe(100)
  })

  test('宿命: チェーンがJQKのみなら倍算', () => {
    const result = applyItemEffects('gained', 100, ['fate'], ctx({ chain: [card(1, '♠', 11), card(2, '♦', 13)] }), params)
    expect(result.value).toBe(100 * params.talismans.fate.x)
  })

  test('安堵: 取得したカードのランクが1〜10なら加算、ワイルドなら都合よく発動、絵札なら不発動', () => {
    const numberCard = applyItemEffects('gained', 100, ['relief'], ctx({ card: card(1, '♠', 7) }), params)
    expect(numberCard.value).toBe(100 + params.talismans.relief.n)
    const wildCard = applyItemEffects('gained', 100, ['relief'], ctx({ card: card(1, '★', 0, true) }), params)
    expect(wildCard.value).toBe(100 + params.talismans.relief.n)
    const faceCard = applyItemEffects('gained', 100, ['relief'], ctx({ card: card(1, '♠', 12) }), params)
    expect(faceCard.value).toBe(100)
  })
})

describe('applyItemEffects (グループ4-b: スート/色専有系)', () => {
  const params = DEFAULT_PARAMS

  test('深緑: ♣専有チェーンで倍算、他スートが混ざれば不発動、全ワイルドでも都合よく発動', () => {
    const pure = applyItemEffects('gained', 100, ['verdantGreen'], ctx({ chain: [card(1, '♣', 3), card(2, '♣', 5)] }), params)
    expect(pure.value).toBe(100 * params.talismans.verdantGreen.x)
    const mixed = applyItemEffects('gained', 100, ['verdantGreen'], ctx({ chain: [card(1, '♣', 3), card(2, '♦', 5)] }), params)
    expect(mixed.value).toBe(100)
    const allWild = applyItemEffects('gained', 100, ['verdantGreen'], ctx({ chain: [card(1, '★', 0, true), card(2, '★', 0, true)] }), params)
    expect(allWild.value).toBe(100 * params.talismans.verdantGreen.x)
  })

  test('宝石: ♦専有チェーンで倍算', () => {
    const result = applyItemEffects('gained', 100, ['gem'], ctx({ chain: [card(1, '♦', 3), card(2, '♦', 5)] }), params)
    expect(result.value).toBe(100 * params.talismans.gem.x)
  })

  test('真剣: ♠専有チェーンで倍算', () => {
    const result = applyItemEffects('gained', 100, ['resolve'], ctx({ chain: [card(1, '♠', 3), card(2, '♠', 5)] }), params)
    expect(result.value).toBe(100 * params.talismans.resolve.x)
  })

  test('聖杯: ♥専有チェーンで倍算', () => {
    const result = applyItemEffects('gained', 100, ['grail'], ctx({ chain: [card(1, '♥', 3), card(2, '♥', 5)] }), params)
    expect(result.value).toBe(100 * params.talismans.grail.x)
  })

  test('月光: 黒専有チェーンで倍算、赤が混ざれば不発動', () => {
    const pure = applyItemEffects('gained', 100, ['moonlight'], ctx({ chain: [card(1, '♠', 3), card(2, '♣', 5)] }), params)
    expect(pure.value).toBe(100 * params.talismans.moonlight.x)
    const mixed = applyItemEffects('gained', 100, ['moonlight'], ctx({ chain: [card(1, '♠', 3), card(2, '♥', 5)] }), params)
    expect(mixed.value).toBe(100)
  })

  test('陽光: 赤専有チェーンで倍算', () => {
    const result = applyItemEffects('gained', 100, ['sunlight'], ctx({ chain: [card(1, '♥', 3), card(2, '♦', 5)] }), params)
    expect(result.value).toBe(100 * params.talismans.sunlight.x)
  })
})

describe('applyItemEffects (グループ4-c: 枚数カウント系)', () => {
  const params = DEFAULT_PARAMS

  test('王冠: チェーン内のK枚数(ワイルド込み)×xで倍算、K無しなら不発動', () => {
    const chain = [card(1, '♠', 13), card(2, '♦', 13), card(3, '★', 0, true)]
    const result = applyItemEffects('gained', 100, ['crown'], ctx({ chain }), params)
    expect(result.value).toBe(100 * (1 + 3 * params.talismans.crown.x))
    const noKing = applyItemEffects('gained', 100, ['crown'], ctx({ chain: [card(1, '♠', 5)] }), params)
    expect(noKing.value).toBe(100)
  })

  test('青葉: チェーン内の♣枚数(ワイルド込み)×nで加算', () => {
    const chain = [card(1, '♣', 3), card(2, '♣', 5), card(3, '★', 0, true)]
    const result = applyItemEffects('gained', 100, ['cloverLeaf'], ctx({ chain }), params)
    expect(result.value).toBe(100 + 3 * params.talismans.cloverLeaf.n)
  })

  test('硬貨: チェーン内の♦枚数×nで加算', () => {
    const chain = [card(1, '♦', 3), card(2, '♦', 5)]
    const result = applyItemEffects('gained', 100, ['coin'], ctx({ chain }), params)
    expect(result.value).toBe(100 + 2 * params.talismans.coin.n)
  })

  test('武器: チェーン内の♠枚数×nで加算', () => {
    const chain = [card(1, '♠', 3), card(2, '♠', 5)]
    const result = applyItemEffects('gained', 100, ['blade'], ctx({ chain }), params)
    expect(result.value).toBe(100 + 2 * params.talismans.blade.n)
  })

  test('献杯: チェーン内の♥枚数×nで加算', () => {
    const chain = [card(1, '♥', 3), card(2, '♥', 5)]
    const result = applyItemEffects('gained', 100, ['chalice'], ctx({ chain }), params)
    expect(result.value).toBe(100 + 2 * params.talismans.chalice.n)
  })

  test('均衡: 赤黒枚数が同数(ワイルドで調整可)なら加算', () => {
    const balanced = applyItemEffects('gained', 100, ['balance'], ctx({ chain: [card(1, '♠', 3), card(2, '♥', 5)] }), params)
    expect(balanced.value).toBe(100 + params.talismans.balance.n)
    const adjustedByWild = applyItemEffects('gained', 100, ['balance'], ctx({ chain: [card(1, '♠', 3), card(2, '♥', 4), card(3, '♠', 5), card(4, '★', 0, true)] }), params)
    expect(adjustedByWild.value).toBe(100 + params.talismans.balance.n)
    const unbalanced = applyItemEffects('gained', 100, ['balance'], ctx({ chain: [card(1, '♠', 3), card(2, '♠', 4), card(3, '♥', 5)] }), params)
    expect(unbalanced.value).toBe(100)
  })

  test('均衡: 合計枚数が奇数だとワイルドをどう振り分けても同数にできないため不発動', () => {
    const singleWild = applyItemEffects('gained', 100, ['balance'], ctx({ chain: [card(1, '★', 0, true)] }), params)
    expect(singleWild.value).toBe(100)
    const oddTotal = applyItemEffects('gained', 100, ['balance'], ctx({ chain: [card(1, '♠', 3), card(2, '★', 0, true), card(3, '★', 0, true)] }), params)
    expect(oddTotal.value).toBe(100)
  })

  test('調和: 赤黒枚数が同数なら倍算', () => {
    const result = applyItemEffects('gained', 100, ['harmony'], ctx({ chain: [card(1, '♠', 3), card(2, '♥', 5)] }), params)
    expect(result.value).toBe(100 * params.talismans.harmony.x)
  })
})

describe('applyItemEffects (グループ4-d: 既存フラグ再利用・KAループ系)', () => {
  const params = DEFAULT_PARAMS

  test('高潔: 同スートパターン成立時(3枚以上・同スート)に加算', () => {
    const chain = [card(1, '♠', 3), card(2, '♠', 5), card(3, '♠', 9)]
    const fired = applyItemEffects('gained', 100, ['nobility'], ctx({ chain }), params)
    expect(fired.value).toBe(100 + params.talismans.nobility.n)
    const tooShort = applyItemEffects('gained', 100, ['nobility'], ctx({ chain: chain.slice(0, 2) }), params)
    expect(tooShort.value).toBe(100)
  })

  test('執念: 同スートパターン成立時、チェーン長×xで倍算', () => {
    const chain = [card(1, '♠', 3), card(2, '♠', 5), card(3, '♠', 9)]
    const result = applyItemEffects('gained', 100, ['tenacity'], ctx({ chain }), params)
    expect(result.value).toBe(100 * (1 + chain.length * params.talismans.tenacity.x))
  })

  test('覚悟: 階段成立時(effectiveStairMinLen以上)、階段長×xで倍算', () => {
    const chain = [card(1, '♠', 3), card(2, '♦', 4), card(3, '♥', 5), card(4, '♣', 6), card(5, '♠', 7)]
    const result = applyItemEffects('gained', 100, ['determination'], ctx({ chain, effectiveStairMinLen: 5 }), params)
    expect(result.value).toBe(100 * (1 + 5 * params.talismans.determination.x))
  })

  test('覚悟: 階段の長さがeffectiveStairMinLen未満、または階段が崩れていれば不発動', () => {
    const tooShort = [card(1, '♠', 3), card(2, '♦', 4), card(3, '♥', 5)]
    const tooShortResult = applyItemEffects('gained', 100, ['determination'], ctx({ chain: tooShort, effectiveStairMinLen: 5 }), params)
    expect(tooShortResult.value).toBe(100)
    const broken = [card(1, '♠', 3), card(2, '♦', 9), card(3, '♥', 5), card(4, '♣', 6), card(5, '♠', 7)]
    const brokenResult = applyItemEffects('gained', 100, ['determination'], ctx({ chain: broken, effectiveStairMinLen: 5 }), params)
    expect(brokenResult.value).toBe(100)
  })

  test('循環: K→A、A→Kの遷移で倍算し、ワイルドが絡む場合も都合よく成立する', () => {
    const kToA = applyItemEffects('gained', 100, ['cycle'], ctx({ previousFoundation: card(1, '♠', 13), card: card(2, '♦', 1) }), params)
    expect(kToA.value).toBe(100 * params.talismans.cycle.x)
    const wildAsA = applyItemEffects('gained', 100, ['cycle'], ctx({ previousFoundation: card(1, '♠', 13), card: card(2, '★', 0, true) }), params)
    expect(wildAsA.value).toBe(100 * params.talismans.cycle.x)
    const notFired = applyItemEffects('gained', 100, ['cycle'], ctx({ previousFoundation: card(1, '♠', 7), card: card(2, '♦', 8) }), params)
    expect(notFired.value).toBe(100)
  })

  const kaLoopChain: Card[] = [8, 9, 10, 11, 12, 13, 1, 2, 3, 4, 5, 6, 7].map((r, i) => card(i + 1, '♠', r as Card['rank']))
  const completeRunRoleFired = { bonus: 0, parts: [], patternFired: false, patternFiredCount: 0, roleFired: [{ name: 'completeRun' as const, usedWild: false, amount: 0 }] }

  test('輪廻: コンプリートラン成立かつ階段成立かつK↔Aループを跨ぐ場合に倍算', () => {
    const fired = applyItemEffects('gained', 100, ['reincarnation'], ctx({ chain: kaLoopChain, chainBonus: completeRunRoleFired }), params)
    expect(fired.value).toBe(100 * params.talismans.reincarnation.x)
    const noLoopChain = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((r, i) => card(i + 1, '♠', r as Card['rank']))
    const notFired = applyItemEffects('gained', 100, ['reincarnation'], ctx({ chain: noLoopChain, chainBonus: completeRunRoleFired }), params)
    expect(notFired.value).toBe(100)
  })

  test('威光: コンプリートラン成立かつ階段成立かつ同スート専有の場合に倍算', () => {
    const fired = applyItemEffects('gained', 100, ['majesty'], ctx({ chain: kaLoopChain, chainBonus: completeRunRoleFired }), params)
    expect(fired.value).toBe(100 * params.talismans.majesty.x)
    const mixedSuitChain = kaLoopChain.map((c, i) => (i === 0 ? { ...c, suit: '♦' as const } : c))
    const notFired = applyItemEffects('gained', 100, ['majesty'], ctx({ chain: mixedSuitChain, chainBonus: completeRunRoleFired }), params)
    expect(notFired.value).toBe(100)
  })
})
```

- [ ] **Step 4: `itemEffects.test.ts`から該当4ブロックを削除する**

上記4つのdescribeブロックを`itemEffects.test.ts`から削除する。

- [ ] **Step 5: テスト実行・型チェック**

```bash
npm run test
npm run check
```

Expected: 全テスト成功、型エラーなし。テストケース総数は分割前後で変化しないこと。

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/chainAttributeEffects.ts src/lib/game/shidasu/chainAttributeEffects.test.ts src/lib/game/shidasu/itemEffects.ts src/lib/game/shidasu/itemEffects.test.ts
git commit -m "refactor: グループ4(チェーン全体属性系)護符をchainAttributeEffects.tsに分離"
```

---

### Task 5: `stateAndPatternEffects.ts`(グループ5,6,7,8,9,10,12,16,17)の抽出

**Files:**
- Create: `src/lib/game/shidasu/stateAndPatternEffects.ts`
- Create: `src/lib/game/shidasu/stateAndPatternEffects.test.ts`
- Modify: `src/lib/game/shidasu/itemEffects.ts`
- Modify: `src/lib/game/shidasu/itemEffects.test.ts`

**対象護符(20個):** 兆し(omen)・三日月(crescent)・恩寵(blessing)・集中(focus)・瑠璃(lapis)・翡翠(jade)・無心(emptyMind)・序章(prologue)・幕間(interlude)・朝露(morningDew)・小雨(drizzle)・微風(gentleBreeze)・共鳴(resonance)・蒼穹(azureSky)・琥珀(amber)・情熱(passion)・闘志(fightingSpirit)・直感(intuition)・慈悲(mercy)・刻限(deadline)。すべて`channel: 'gained'`。

このグループは`patterns.ts`の関数に依存しない(型・params・`fmtMultiplier`のみ必要)。

- [ ] **Step 1: `stateAndPatternEffects.ts`を新規作成する**

Task4後の`itemEffects.ts`を`Read`し、残っている上記20エントリをこの順序のまま新規ファイルに移す(ロジック変更なし)。

```ts
// src/lib/game/shidasu/stateAndPatternEffects.ts
import type { ItemId } from './types'
import { fmtMultiplier } from './patterns'
import type { ItemEffect } from './itemEffects'

export const STATE_AND_PATTERN_EFFECTS: Partial<Record<ItemId, { channel: 'gained' | 'clearBonus'; effect: ItemEffect }>> = {
  omen: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.remainingTableauCount > p.talismans.omen.m) return { value: v, part: null }
      const factor = p.talismans.omen.x
      return { value: v * factor, part: `兆し×${fmtMultiplier(factor)}` }
    },
  },
  crescent: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.remainingTableauCount > p.talismans.crescent.m) return { value: v, part: null }
      const factor = p.talismans.crescent.x
      return { value: v * factor, part: `三日月×${fmtMultiplier(factor)}` }
    },
  },
  blessing: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.chainBonus.roleFired.length === 0) return { value: v, part: null }
      const factor = p.talismans.blessing.x
      return { value: v * factor, part: `恩寵×${fmtMultiplier(factor)}` }
    },
  },
  focus: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!ctx.chainBonus.roleFired.some(r => r.name === 'sameRank')) return { value: v, part: null }
      const factor = p.talismans.focus.x
      return { value: v * factor, part: `集中×${fmtMultiplier(factor)}` }
    },
  },
  lapis: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const total = ctx.chainBonus.roleFired.length + ctx.chainBonus.patternFiredCount
      if (total < 2) return { value: v, part: null }
      const factor = p.talismans.lapis.x
      return { value: v * factor, part: `瑠璃×${fmtMultiplier(factor)}` }
    },
  },
  jade: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.chainBonus.roleFired.some(r => r.usedWild)
        ? { value: v + p.talismans.jade.n, part: `翡翠+${p.talismans.jade.n}` }
        : { value: v, part: null },
  },
  emptyMind: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.chainBonus.patternFired || ctx.chainBonus.roleFired.length > 0) return { value: v, part: null }
      const factor = p.talismans.emptyMind.x
      return { value: v * factor, part: `無心×${fmtMultiplier(factor)}` }
    },
  },
  prologue: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.isPlayAction && ctx.playCountInChain === 1
        ? { value: v + p.talismans.prologue.n, part: `序章+${p.talismans.prologue.n}` }
        : { value: v, part: null },
  },
  interlude: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.isPlayAction && ctx.playCountInChain === p.talismans.interlude.m
        ? { value: v + p.talismans.interlude.n, part: `幕間+${p.talismans.interlude.n}` }
        : { value: v, part: null },
  },
  morningDew: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.isFirstPlayOfWave ? { value: v + p.talismans.morningDew.n, part: `朝露+${p.talismans.morningDew.n}` } : { value: v, part: null },
  },
  drizzle: {
    channel: 'gained',
    effect: (v, _ctx, p) => ({ value: v + p.talismans.drizzle.n, part: `小雨+${p.talismans.drizzle.n}` }),
  },
  gentleBreeze: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.sameColumnStreak < 2) return { value: v, part: null }
      const add = ctx.sameColumnStreak * p.talismans.gentleBreeze.n
      return { value: v + add, part: `微風+${add}` }
    },
  },
  resonance: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.sameColumnStreak < 2) return { value: v, part: null }
      const factor = 1 + ctx.sameColumnStreak * p.talismans.resonance.x
      return { value: v * factor, part: `共鳴×${fmtMultiplier(factor)}` }
    },
  },
  azureSky: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.totalColumnsEmptiedThisWave === 0) return { value: v, part: null }
      const factor = 1 + ctx.totalColumnsEmptiedThisWave * p.talismans.azureSky.x
      return { value: v * factor, part: `蒼穹×${fmtMultiplier(factor)}` }
    },
  },
  amber: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.maxComboThisWave === 0) return { value: v, part: null }
      const factor = 1 + ctx.maxComboThisWave * p.talismans.amber.x
      return { value: v * factor, part: `琥珀×${fmtMultiplier(factor)}` }
    },
  },
  passion: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.flushActiveThisCombo
        ? { value: v * p.talismans.passion.x, part: `情熱×${fmtMultiplier(p.talismans.passion.x)}` }
        : { value: v, part: null },
  },
  fightingSpirit: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.columnSweepActiveThisWave
        ? { value: v * p.talismans.fightingSpirit.x, part: `闘志×${fmtMultiplier(p.talismans.fightingSpirit.x)}` }
        : { value: v, part: null },
  },
  intuition: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.drawContinueCountThisChain === 0) return { value: v, part: null }
      const factor = 1 + ctx.drawContinueCountThisChain * p.talismans.intuition.x
      return { value: v * factor, part: `直感×${fmtMultiplier(factor)}` }
    },
  },
  mercy: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.mercyActiveNextCombo
        ? { value: v * p.talismans.mercy.x, part: `慈悲×${fmtMultiplier(p.talismans.mercy.x)}` }
        : { value: v, part: null },
  },
  deadline: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.stockRemaining === 0) return { value: v, part: null }
      const add = ctx.stockRemaining * p.talismans.deadline.n
      return { value: v + add, part: `刻限+${add}` }
    },
  },
}
```

- [ ] **Step 2: `itemEffects.ts`を最終形に整理する**

上記20エントリを`itemEffects.ts`から削除する。冒頭importに以下を追加する:

```ts
import { STATE_AND_PATTERN_EFFECTS } from './stateAndPatternEffects'
```

`ITEM_EFFECTS`定数を、4つのspreadのみで構成される以下の形にする:

```ts
const ITEM_EFFECTS: Partial<Record<ItemId, { channel: 'gained' | 'clearBonus'; effect: ItemEffect }>> = {
  ...CLEAR_BONUS_EFFECTS,
  ...CARD_COMBO_EFFECTS,
  ...CHAIN_ATTRIBUTE_EFFECTS,
  ...STATE_AND_PATTERN_EFFECTS,
}
```

この時点で`itemEffects.ts`にはインラインの護符エントリが1つも残らない。ファイル冒頭のimportを、実際に使われているものだけに整理する(`npm run check`の未使用import警告に従う)。最終形は概ね以下になる見込み:

```ts
// src/lib/game/shidasu/itemEffects.ts
import type { ItemId } from './types'
import type { ShidasuParams } from './params'
import type { ChainBonusResult } from './patterns'
import { CLEAR_BONUS_EFFECTS } from './clearBonusEffects'
import { CARD_COMBO_EFFECTS } from './cardComboEffects'
import { CHAIN_ATTRIBUTE_EFFECTS } from './chainAttributeEffects'
import { STATE_AND_PATTERN_EFFECTS } from './stateAndPatternEffects'
```

(`Card`/`Suit`/`isRed`/`isFace`/`analyzeSuitColor`/`analyzeStair`/`stairUsesKALoop`/`fmtMultiplier`は`itemEffects.ts`本体ではもう使われなくなっているはずなので、`ItemEffectContext`インターフェース定義に必要な型のみ残す。`ItemEffectContext`が`Card`型・`ChainBonusResult`型を使っているため、これらのimportは維持すること。)

- [ ] **Step 3: `stateAndPatternEffects.test.ts`を新規作成する**

`itemEffects.test.ts`(Task4適用後)に残っている9つのdescribeブロック(元ファイルで353〜575行目: グループ5,6,7,8,9,10,16,12,17)を、アサーション内容を一切変更せずそのまま新規ファイルに移す。

```ts
// src/lib/game/shidasu/stateAndPatternEffects.test.ts
import { describe, test, expect } from 'vitest'
import { applyItemEffects } from './itemEffects'
import { DEFAULT_PARAMS } from './params'
import { ctx } from './testHelpers'

describe('applyItemEffects (グループ5: 場札残数系)', () => {
  const params = DEFAULT_PARAMS

  test('兆し: 場札残数がm以下なら倍算、超えていれば不発動', () => {
    const fired = applyItemEffects('gained', 100, ['omen'], ctx({ remainingTableauCount: params.talismans.omen.m }), params)
    expect(fired.value).toBe(100 * params.talismans.omen.x)
    const notFired = applyItemEffects('gained', 100, ['omen'], ctx({ remainingTableauCount: params.talismans.omen.m + 1 }), params)
    expect(notFired.value).toBe(100)
  })

  test('三日月: 場札残数がm以下なら倍算', () => {
    const result = applyItemEffects('gained', 100, ['crescent'], ctx({ remainingTableauCount: params.talismans.crescent.m }), params)
    expect(result.value).toBe(100 * params.talismans.crescent.x)
  })
})

describe('applyItemEffects (グループ6: 役・パターン成立状況系)', () => {
  const params = DEFAULT_PARAMS

  test('恩寵: いずれかの役ボーナスが成立していれば倍算', () => {
    const chainBonus = { bonus: 0, parts: [], patternFired: false, patternFiredCount: 0, roleFired: [{ name: 'flush' as const, usedWild: false, amount: 0 }] }
    const fired = applyItemEffects('gained', 100, ['blessing'], ctx({ chainBonus }), params)
    expect(fired.value).toBe(100 * params.talismans.blessing.x)
    const notFired = applyItemEffects('gained', 100, ['blessing'], ctx(), params)
    expect(notFired.value).toBe(100)
  })

  test('集中: 同ランクによる役が含まれていれば倍算', () => {
    const chainBonus = { bonus: 0, parts: [], patternFired: false, patternFiredCount: 0, roleFired: [{ name: 'sameRank' as const, usedWild: false, amount: 0 }] }
    const fired = applyItemEffects('gained', 100, ['focus'], ctx({ chainBonus }), params)
    expect(fired.value).toBe(100 * params.talismans.focus.x)
    const otherRole = { bonus: 0, parts: [], patternFired: false, patternFiredCount: 0, roleFired: [{ name: 'flush' as const, usedWild: false, amount: 0 }] }
    const notFired = applyItemEffects('gained', 100, ['focus'], ctx({ chainBonus: otherRole }), params)
    expect(notFired.value).toBe(100)
  })

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

  test('翡翠: 役の成立にワイルドが使われていれば加算', () => {
    const chainBonus = { bonus: 0, parts: [], patternFired: false, patternFiredCount: 0, roleFired: [{ name: 'flush' as const, usedWild: true, amount: 0 }] }
    const fired = applyItemEffects('gained', 100, ['jade'], ctx({ chainBonus }), params)
    expect(fired.value).toBe(100 + params.talismans.jade.n)
    const withoutWild = { bonus: 0, parts: [], patternFired: false, patternFiredCount: 0, roleFired: [{ name: 'flush' as const, usedWild: false, amount: 0 }] }
    const notFired = applyItemEffects('gained', 100, ['jade'], ctx({ chainBonus: withoutWild }), params)
    expect(notFired.value).toBe(100)
  })

  test('無心: 役もパターンも無ければ倍算', () => {
    const fired = applyItemEffects('gained', 100, ['emptyMind'], ctx(), params)
    expect(fired.value).toBe(100 * params.talismans.emptyMind.x)
    const withPattern = { bonus: 0, parts: [], patternFired: true, patternFiredCount: 1, roleFired: [] }
    const notFired = applyItemEffects('gained', 100, ['emptyMind'], ctx({ chainBonus: withPattern }), params)
    expect(notFired.value).toBe(100)
  })
})

describe('applyItemEffects (グループ7: コンボ内位置系)', () => {
  const params = DEFAULT_PARAMS

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

  test('ctxはisPlayAction・playCountInChainを受け付ける(型の確認)', () => {
    const playCtx = ctx({ isPlayAction: true, playCountInChain: 3 })
    expect(playCtx.isPlayAction).toBe(true)
    expect(playCtx.playCountInChain).toBe(3)
    const drawCtx = ctx({ isPlayAction: false, playCountInChain: 0 })
    expect(drawCtx.isPlayAction).toBe(false)
    expect(drawCtx.playCountInChain).toBe(0)
  })

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

  test('朝露: ウェーブで最初にプレイしたカードのみ加算', () => {
    const fired = applyItemEffects('gained', 100, ['morningDew'], ctx({ isFirstPlayOfWave: true }), params)
    expect(fired.value).toBe(100 + params.talismans.morningDew.n)
    const notFired = applyItemEffects('gained', 100, ['morningDew'], ctx({ isFirstPlayOfWave: false }), params)
    expect(notFired.value).toBe(100)
  })
})

describe('applyItemEffects (グループ8: 無条件固定加算)', () => {
  const params = DEFAULT_PARAMS

  test('小雨: 常にn点加算', () => {
    const result = applyItemEffects('gained', 100, ['drizzle'], ctx(), params)
    expect(result.value).toBe(100 + params.talismans.drizzle.n)
  })
})

describe('applyItemEffects (グループ9: 列選択の連続性)', () => {
  const params = DEFAULT_PARAMS

  test('微風: 同一列連続2回目以降のみ、連続回数×nを加算', () => {
    const notFired = applyItemEffects('gained', 100, ['gentleBreeze'], ctx({ sameColumnStreak: 1 }), params)
    expect(notFired.value).toBe(100)
    const fired = applyItemEffects('gained', 100, ['gentleBreeze'], ctx({ sameColumnStreak: 3 }), params)
    expect(fired.value).toBe(100 + 3 * params.talismans.gentleBreeze.n)
  })

  test('共鳴: 同一列連続2回目以降のみ、連続回数×xで倍算', () => {
    const notFired = applyItemEffects('gained', 100, ['resonance'], ctx({ sameColumnStreak: 1 }), params)
    expect(notFired.value).toBe(100)
    const fired = applyItemEffects('gained', 100, ['resonance'], ctx({ sameColumnStreak: 3 }), params)
    expect(fired.value).toBe(100 * (1 + 3 * params.talismans.resonance.x))
  })
})

describe('applyItemEffects (グループ10: ウェーブ内累積state)', () => {
  const params = DEFAULT_PARAMS

  test('蒼穹: ウェーブ内列一掃累計回数×xで倍算', () => {
    const result = applyItemEffects('gained', 100, ['azureSky'], ctx({ totalColumnsEmptiedThisWave: 4 }), params)
    expect(result.value).toBe(100 * (1 + 4 * params.talismans.azureSky.x))
  })

  test('琥珀: ウェーブ内最大到達コンボ数×xで倍算', () => {
    const result = applyItemEffects('gained', 100, ['amber'], ctx({ maxComboThisWave: 8 }), params)
    expect(result.value).toBe(100 * (1 + 8 * params.talismans.amber.x))
  })
})

describe('applyItemEffects (グループ16: 持続効果)', () => {
  const params = DEFAULT_PARAMS

  test('情熱: フラッシュ成立中フラグが立っていれば倍算', () => {
    const fired = applyItemEffects('gained', 100, ['passion'], ctx({ flushActiveThisCombo: true }), params)
    expect(fired.value).toBe(100 * params.talismans.passion.x)
    const notFired = applyItemEffects('gained', 100, ['passion'], ctx({ flushActiveThisCombo: false }), params)
    expect(notFired.value).toBe(100)
  })

  test('闘志: 列一掃発生済みフラグが立っていれば倍算', () => {
    const fired = applyItemEffects('gained', 100, ['fightingSpirit'], ctx({ columnSweepActiveThisWave: true }), params)
    expect(fired.value).toBe(100 * params.talismans.fightingSpirit.x)
    const notFired = applyItemEffects('gained', 100, ['fightingSpirit'], ctx({ columnSweepActiveThisWave: false }), params)
    expect(notFired.value).toBe(100)
  })

  test('慈悲: mercyActiveNextComboが立っていれば倍算', () => {
    const fired = applyItemEffects('gained', 100, ['mercy'], ctx({ mercyActiveNextCombo: true }), params)
    expect(fired.value).toBe(100 * params.talismans.mercy.x)
    const notFired = applyItemEffects('gained', 100, ['mercy'], ctx({ mercyActiveNextCombo: false }), params)
    expect(notFired.value).toBe(100)
  })
})

describe('applyItemEffects (グループ12: 直感)', () => {
  const params = DEFAULT_PARAMS

  test('直感: drawContinueCountThisChainが0より大きい時のみ、その回数×xで倍算', () => {
    const notFired = applyItemEffects('gained', 100, ['intuition'], ctx({ drawContinueCountThisChain: 0 }), params)
    expect(notFired.value).toBe(100)
    const fired = applyItemEffects('gained', 100, ['intuition'], ctx({ drawContinueCountThisChain: 3 }), params)
    expect(fired.value).toBe(100 * (1 + 3 * params.talismans.intuition.x))
  })
})

describe('applyItemEffects (グループ17: 刻限)', () => {
  const params = DEFAULT_PARAMS

  test('刻限: 山札残り枚数×nを加算', () => {
    const notFired = applyItemEffects('gained', 100, ['deadline'], ctx({ stockRemaining: 0 }), params)
    expect(notFired.value).toBe(100)
    const fired = applyItemEffects('gained', 100, ['deadline'], ctx({ stockRemaining: 5 }), params)
    expect(fired.value).toBe(100 + 5 * params.talismans.deadline.n)
  })
})
```

- [ ] **Step 4: `itemEffects.test.ts`を最終形に整理する**

上記9ブロックを削除する。この時点で`itemEffects.test.ts`には`describe('applyItemEffects', ...)`ブロック1つのみが残り、その中身は以下の3テストのみになっているはずである:

- 「未登録の護符は素通りし、内訳(parts)も空になる」
- 「複数護符は所持順(配列順)に適用され、内訳もその順で並ぶ…」
- 「gainedチャンネルの護符はclearBonusチャンネル計算には適用されない」

冒頭importも、`applyItemEffects`・`DEFAULT_PARAMS`・`card`・`ctx`のみが必要な形に整理する(`type Card`のimportが不要になっていれば削除する)。

- [ ] **Step 5: テスト実行・型チェック・ビルド**

```bash
npm run test
npm run check
npm run build
```

Expected: すべて成功。テストケース総数は分割前後で変化しないこと。

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/stateAndPatternEffects.ts src/lib/game/shidasu/stateAndPatternEffects.test.ts src/lib/game/shidasu/itemEffects.ts src/lib/game/shidasu/itemEffects.test.ts
git commit -m "refactor: グループ5,6,7,8,9,10,12,16,17護符をstateAndPatternEffects.tsに分離"
```

---

### Task 6: 最終整理・全体検証

**Files:**
- Modify: `src/lib/game/shidasu/itemEffects.ts` (import整理のみ、ロジック変更なし)

- [ ] **Step 1: `itemEffects.ts`の最終行数・内容を確認する**

`itemEffects.ts`を`Read`し、以下の構成のみになっていることを確認する: ファイル冒頭のimport(4カテゴリファイル+型)・`ItemEffectContext`インターフェース・`ItemEffect`型・`ITEM_EFFECTS`定数(4つのspreadのみ)・`applyItemEffects`関数。100〜130行程度になっている見込み。

- [ ] **Step 2: 5つの新規ファイルの行数を確認する**

```bash
wc -l src/lib/game/shidasu/itemEffects.ts src/lib/game/shidasu/clearBonusEffects.ts src/lib/game/shidasu/cardComboEffects.ts src/lib/game/shidasu/chainAttributeEffects.ts src/lib/game/shidasu/stateAndPatternEffects.ts
```

- [ ] **Step 3: テストケース総数の分割前後一致を確認する**

```bash
grep -c "test(" src/lib/game/shidasu/itemEffects.test.ts src/lib/game/shidasu/clearBonusEffects.test.ts src/lib/game/shidasu/cardComboEffects.test.ts src/lib/game/shidasu/chainAttributeEffects.test.ts src/lib/game/shidasu/stateAndPatternEffects.test.ts
```

Expected: 5ファイルの合計が74件(このリファクタリング開始前の`itemEffects.test.ts`単体でのテストケース総数)と一致する。

- [ ] **Step 4: 全体テスト・型チェック・ビルド**

```bash
npm run test
npm run check
npm run build
```

Expected: すべて成功。`src/lib/game/shidasu/`配下にエラー・警告がないこと。

- [ ] **Step 5: コミット(差分がある場合のみ)**

Step1で修正すべき差分があった場合のみ、以下でコミットする:

```bash
git add src/lib/game/shidasu/itemEffects.ts
git commit -m "refactor: itemEffects.tsの最終整理(未使用import削除)"
```

---

### Task 7: ブラウザでの動作確認

**Files:** なし(確認のみ)

- [ ] **Step 1: 開発サーバーを起動する**

```bash
npm run dev
```

- [ ] **Step 2: `/game/shidasu`を確認する**

ブラウザ(またはPlaywright)で開き、カードをプレイ・山札をめくる操作を行い、コンソールエラーが出ないこと、スコア表示・護符効果の内訳表示が分割前と同じ形式で表示されることを確認する。

- [ ] **Step 3: `/admin/shidasu-debug`を確認する**

護符をいくつかチェックした状態でプレイし(4カテゴリすべてから最低1つずつ護符を選ぶ。例: 忍耐[clearBonus]・春風[cardCombo]・深緑[chainAttribute]・小雨[stateAndPattern])、スコア計算・内訳表示が正しく行われることを確認する。

- [ ] **Step 4: 開発サーバーを停止する**

動作確認が完了したら開発サーバーを終了する。

---

## Self-Review 結果

- **spec coverage:** spec section1(ファイル構成)→Task1-6、section2(型の相互参照)→Task1,2、section3(テスト分割)→Task2-5、section4(検証方針)→Task2-7、受け入れ基準1-8→Task1-7でそれぞれ充足。
- **placeholder scan:** 全タスクで移動対象コードの完全な内容を記載済み(現行itemEffects.ts/itemEffects.test.tsの実内容から転記)。「グループ2+3のテスト」等の曖昧な指示ではなく、実際のテストコードを全文記載した。
- **type consistency:** `CLEAR_BONUS_EFFECTS`/`CARD_COMBO_EFFECTS`/`CHAIN_ATTRIBUTE_EFFECTS`/`STATE_AND_PATTERN_EFFECTS`の定数名・`ItemEffectContext`/`ItemEffect`の型名はTask1-6を通して一貫させた。
