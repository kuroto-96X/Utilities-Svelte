# Shidasu 護符候補グループ1〜3(全18個)実装 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `docs/shidasu-gofu-candidates.md`のグループ1〜3(全18個の護符)を実装し、あわせて汎用的な「護符効果パイプライン」を新規構築する。

**Architecture:** 各護符IDに`{channel, effect}`を登録する`ITEM_EFFECTS`レジストリと、それを所持順(取得順)に適用する`applyItemEffects`関数を新設する。`channel: 'gained'`はカードプレイ時の獲得点、`channel: 'clearBonus'`は全消しボーナスに対して適用する。

**Tech Stack:** TypeScript、Vitest、SvelteKit(既存のShidasuエンジン`src/lib/game/shidasu/`に追加)。

---

## 前提知識(実装者向け)

- 護符関連のコードは全て`src/lib/game/shidasu/{types,params,engine}.ts`と`src/lib/game/shidasu/shidasu.config.json`、`src/routes/admin/shidasu/+page.svelte`に集約されている。
- 現状`ItemId`は`'bridge' | 'grace'`の2種類のみで、効果はエンジン内(`playCard`)にハードコードされている。
- テストは`src/lib/game/shidasu/engine.test.ts`に集約。`function card(id, suit, rank, wild=false): Card`というヘルパーが既に定義済み。
- `ShidasuParams`と`shidasu.config.json`は常に同一の内容を保つ(`params.test.ts`に`loadParams()`が`DEFAULT_PARAMS`と一致することを確認する既存テストがある)。
- 各タスクの最後に`npm run test`を実行し、全テストが通ることを確認してからコミットする。
- **重要な型の制約**: `ItemId`型に新しいIDを追加すると、`Record<ItemId, string>`型の`ITEM_NAMES`と、`ItemId`を網羅的に処理する`itemDesc`の`switch`文が、その時点で全IDに対応していないとTypeScriptの型エラーになる。そのためTask 1では、型の拡張(`types.ts`)・設定値の拡張(`params.ts`・`shidasu.config.json`)・表示名/説明文の拡張(`engine.ts`のITEM_NAMES/itemDesc)を1つのタスクとしてまとめて行う(`ITEM_POOL`自体は単なる配列でこの制約を受けないため、Task 4で別途拡張する)。

---

### Task 1: データモデル拡張(ItemId・talismans設定・ITEM_NAMES・itemDesc)

**Files:**
- Modify: `src/lib/game/shidasu/types.ts:5`
- Modify: `src/lib/game/shidasu/params.ts:5-79`
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Modify: `src/lib/game/shidasu/engine.ts:207-222`(`ITEM_NAMES`・`itemDesc`)
- Test: `src/lib/game/shidasu/engine.test.ts`(`ITEM_POOL / ITEM_NAMES / itemDesc`のdescribeブロック)

- [ ] **Step 1: テストを追加する(RED)**

`src/lib/game/shidasu/engine.test.ts`のimport文(`import type { Card, WaveState, RunState } from './types'`の行)を編集し、`ItemId`を追加する:

```ts
import type { Card, WaveState, RunState, ItemId } from './types'
```

`describe('ITEM_POOL / ITEM_NAMES / itemDesc', () => { ... })`ブロック内、既存の2テストの直後に以下を追加する:

```ts
  test('新規追加した18個の護符も名前と説明文を持つ', () => {
    const newIds: ItemId[] = [
      'patience', 'purify', 'temperance',
      'springBreeze', 'summerBreeze', 'autumnBreeze', 'winterBreeze',
      'kinship', 'thaw', 'dusk', 'dawn', 'wit',
      'courage', 'daybreak', 'twilight', 'cheerful', 'conscience', 'morningMist',
    ]
    newIds.forEach(id => {
      expect(ITEM_NAMES[id]).toBeTruthy()
      expect(itemDesc(id, DEFAULT_PARAMS)).toBeTruthy()
    })
  })
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test -- engine.test.ts`
Expected: `新規追加した18個の護符も名前と説明文を持つ`がFAIL(`ITEM_NAMES['patience']`等が`undefined`のため`toBeTruthy()`が失敗する)

- [ ] **Step 3: types.ts・params.ts・shidasu.config.json・engine.tsを実装する**

`src/lib/game/shidasu/types.ts`の5行目、`ItemId`型を編集する:

```ts
export type ItemId =
  | 'bridge' | 'grace'
  | 'patience' | 'purify' | 'temperance'
  | 'springBreeze' | 'summerBreeze' | 'autumnBreeze' | 'winterBreeze'
  | 'kinship' | 'thaw' | 'dusk' | 'dawn' | 'wit'
  | 'courage' | 'daybreak' | 'twilight' | 'cheerful' | 'conscience' | 'morningMist'
```

`src/lib/game/shidasu/params.ts`の`ShidasuParams`インターフェースに、`items: {...}`ブロックの直後(`flow: {...}`の直前)に`talismans`を追加する:

```ts
  talismans: {
    patience: { x: number }
    purify: { n: number }
    temperance: { x: number }
    springBreeze: { n: number }
    summerBreeze: { n: number }
    autumnBreeze: { n: number }
    winterBreeze: { n: number }
    kinship: { n: number }
    thaw: { n: number }
    dusk: { n: number }
    dawn: { n: number }
    wit: { n: number }
    courage: { x: number }
    daybreak: { c: number; x: number }
    twilight: { c: number; x: number }
    cheerful: { n: number }
    conscience: { n: number }
    morningMist: { c: number; x: number }
  }
```

`DEFAULT_PARAMS`にも同様に、`items: {...}`の直後(`flow: {...}`の直前)へ追加する:

```ts
  talismans: {
    patience: { x: 500 },
    purify: { n: 10000 },
    temperance: { x: 0.1 },
    springBreeze: { n: 100 },
    summerBreeze: { n: 100 },
    autumnBreeze: { n: 100 },
    winterBreeze: { n: 100 },
    kinship: { n: 200 },
    thaw: { n: 200 },
    dusk: { n: 100 },
    dawn: { n: 100 },
    wit: { n: 200 },
    courage: { x: 0.1 },
    daybreak: { c: 3, x: 2 },
    twilight: { c: 8, x: 2 },
    cheerful: { n: 50 },
    conscience: { n: 50 },
    morningMist: { c: 5, x: 3 },
  },
```

`src/lib/game/shidasu/shidasu.config.json`にも、`"items": {...}`の直後(`"flow": {...}`の直前)へ、同じ値をJSON形式で追加する:

```json
  "talismans": {
    "patience": { "x": 500 },
    "purify": { "n": 10000 },
    "temperance": { "x": 0.1 },
    "springBreeze": { "n": 100 },
    "summerBreeze": { "n": 100 },
    "autumnBreeze": { "n": 100 },
    "winterBreeze": { "n": 100 },
    "kinship": { "n": 200 },
    "thaw": { "n": 200 },
    "dusk": { "n": 100 },
    "dawn": { "n": 100 },
    "wit": { "n": 200 },
    "courage": { "x": 0.1 },
    "daybreak": { "c": 3, "x": 2 },
    "twilight": { "c": 8, "x": 2 },
    "cheerful": { "n": 50 },
    "conscience": { "n": 50 },
    "morningMist": { "c": 5, "x": 3 }
  },
```

`src/lib/game/shidasu/engine.ts`の`ITEM_NAMES`(207-212行目付近)を編集する:

```ts
export const ITEM_NAMES: Record<ItemId, string> = {
  bridge: '架橋の護符',
  grace: '寛容の護符',
  patience: '忍耐の護符',
  purify: '浄化の護符',
  temperance: '節制の護符',
  springBreeze: '春風の護符',
  summerBreeze: '夏風の護符',
  autumnBreeze: '秋風の護符',
  winterBreeze: '冬風の護符',
  kinship: '友愛の護符',
  thaw: '雪解の護符',
  dusk: '宵闇の護符',
  dawn: '払暁の護符',
  wit: '機知の護符',
  courage: '勇気の護符',
  daybreak: '暁の護符',
  twilight: '黄昏の護符',
  cheerful: '快活の護符',
  conscience: '良心の護符',
  morningMist: '朝霧の護符',
}
```

同ファイルの`itemDesc`関数(214-222行目付近)を編集し、18個分のcaseを追加する:

```ts
export function itemDesc(id: ItemId, params: ShidasuParams): string {
  switch (id) {
    case 'bridge': return `階段成立に必要な最小連続枚数を${params.scoring.stairMinLen}→${params.items.stairRelaxedMinLen}枚に緩和`
    case 'grace': {
      const relaxed = params.layout.rows - params.items.columnSweepRelaxCards
      return `列一掃ボーナスの条件を「列の全${params.layout.rows}枚を1コンボで空に」→「残り${relaxed}枚から1コンボで空に」に緩和`
    }
    case 'patience': return `全消しボーナスに残り山札枚数×${params.talismans.patience.x}点を加算`
    case 'purify': return `全消しボーナスに${params.talismans.purify.n}点を加算`
    case 'temperance': return `全消しボーナスを残り山札枚数×${params.talismans.temperance.x}分だけ倍加`
    case 'springBreeze': return `クラブ(♣)を取ったとき、${params.talismans.springBreeze.n}点加算`
    case 'summerBreeze': return `ダイヤ(♦)を取ったとき、${params.talismans.summerBreeze.n}点加算`
    case 'autumnBreeze': return `ハート(♥)を取ったとき、${params.talismans.autumnBreeze.n}点加算`
    case 'winterBreeze': return `スペード(♠)を取ったとき、${params.talismans.winterBreeze.n}点加算`
    case 'kinship': return `他のスートからハート(♥)を取ったとき、${params.talismans.kinship.n}点加算`
    case 'thaw': return `スペード(♠)から別のスートを取ったとき、${params.talismans.thaw.n}点加算`
    case 'dusk': return `赤から黒に変わったとき、${params.talismans.dusk.n}点加算`
    case 'dawn': return `黒から赤に変わったとき、${params.talismans.dawn.n}点加算`
    case 'wit': return `ワイルドを取ったとき、${params.talismans.wit.n}点加算`
    case 'courage': return `コンボ数×${params.talismans.courage.x}分、獲得点を倍加`
    case 'daybreak': return `コンボ数が${params.talismans.daybreak.c}以下のとき、獲得点を${params.talismans.daybreak.x}倍`
    case 'twilight': return `コンボ数が${params.talismans.twilight.c}以上のとき、獲得点を${params.talismans.twilight.x}倍`
    case 'cheerful': return `コンボ数が偶数のとき、${params.talismans.cheerful.n}点加算`
    case 'conscience': return `コンボ数が奇数のとき、${params.talismans.conscience.n}点加算`
    case 'morningMist': return `コンボ数が${params.talismans.morningMist.c}未満のとき獲得点を1/${params.talismans.morningMist.x}に、${params.talismans.morningMist.c}以上のとき${params.talismans.morningMist.x}倍に`
  }
}
```

- [ ] **Step 4: テストを実行して全て通ることを確認**

Run: `npm run test`
Expected: PASS(全テスト)

Run: `npm run check`
Expected: 型エラーなし

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: Shidasuに護符候補グループ1〜3(全18個)のID・設定値・表示名・説明文を追加
EOF
)"
```

---

### Task 2: 護符効果レジストリ(ItemEffectContext・ITEM_EFFECTS・applyItemEffects)の実装

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`(`markStuck`の直後、`ITEM_POOL`の直前に新規追加)
- Test: `src/lib/game/shidasu/engine.test.ts`(新規describeブロック追加)

- [ ] **Step 1: テストを書く(RED)**

`src/lib/game/shidasu/engine.test.ts`のimport文に`applyItemEffects`を追加する(`itemDesc,`の行の直後):

```ts
  itemDesc,
  applyItemEffects,
```

`describe('markStuck', ...)`ブロックの直後(`describe('rollItemOffer', ...)`の直前)に、新しいdescribeブロックを追加する:

```ts
describe('applyItemEffects', () => {
  const params = DEFAULT_PARAMS

  function ctx(overrides: Partial<{ card: Card; previousFoundation: Card; combo: number; stockRemaining: number }> = {}) {
    return {
      card: card(1, '♠', 5),
      previousFoundation: card(2, '♣', 4),
      combo: 1,
      stockRemaining: 0,
      ...overrides,
    }
  }

  test('未登録の護符は素通りする', () => {
    expect(applyItemEffects('gained', 100, ['bridge'], ctx(), params)).toBe(100)
  })

  test('patience: clearBonusチャンネルで残り山札数×xを加算', () => {
    const result = applyItemEffects('clearBonus', 1000, ['patience'], ctx({ stockRemaining: 4 }), params)
    expect(result).toBe(1000 + 4 * params.talismans.patience.x)
  })

  test('purify: clearBonusチャンネルでnを加算', () => {
    const result = applyItemEffects('clearBonus', 1000, ['purify'], ctx(), params)
    expect(result).toBe(1000 + params.talismans.purify.n)
  })

  test('temperance: clearBonusチャンネルで残り山札数×x分倍算', () => {
    const result = applyItemEffects('clearBonus', 1000, ['temperance'], ctx({ stockRemaining: 4 }), params)
    expect(result).toBe(1000 * (1 + 4 * params.talismans.temperance.x))
  })

  test('springBreeze: ♣を取った時のみgainedにnを加算', () => {
    const withClub = applyItemEffects('gained', 100, ['springBreeze'], ctx({ card: card(1, '♣', 5) }), params)
    expect(withClub).toBe(100 + params.talismans.springBreeze.n)
    const withoutClub = applyItemEffects('gained', 100, ['springBreeze'], ctx({ card: card(1, '♥', 5) }), params)
    expect(withoutClub).toBe(100)
  })

  test('summerBreeze: ♦を取った時のみgainedにnを加算', () => {
    const result = applyItemEffects('gained', 100, ['summerBreeze'], ctx({ card: card(1, '♦', 5) }), params)
    expect(result).toBe(100 + params.talismans.summerBreeze.n)
  })

  test('autumnBreeze: ♥を取った時のみgainedにnを加算', () => {
    const result = applyItemEffects('gained', 100, ['autumnBreeze'], ctx({ card: card(1, '♥', 5) }), params)
    expect(result).toBe(100 + params.talismans.autumnBreeze.n)
  })

  test('winterBreeze: ♠を取った時のみgainedにnを加算', () => {
    const result = applyItemEffects('gained', 100, ['winterBreeze'], ctx({ card: card(1, '♠', 5) }), params)
    expect(result).toBe(100 + params.talismans.winterBreeze.n)
  })

  test('kinship: 直前が♥以外から今回♥を取った時のみnを加算', () => {
    const triggered = applyItemEffects('gained', 100, ['kinship'], ctx({ previousFoundation: card(2, '♣', 4), card: card(1, '♥', 5) }), params)
    expect(triggered).toBe(100 + params.talismans.kinship.n)
    const notTriggered = applyItemEffects('gained', 100, ['kinship'], ctx({ previousFoundation: card(2, '♥', 4), card: card(1, '♥', 5) }), params)
    expect(notTriggered).toBe(100)
  })

  test('thaw: 直前が♠から今回♠以外を取った時のみnを加算', () => {
    const triggered = applyItemEffects('gained', 100, ['thaw'], ctx({ previousFoundation: card(2, '♠', 4), card: card(1, '♥', 5) }), params)
    expect(triggered).toBe(100 + params.talismans.thaw.n)
    const notTriggered = applyItemEffects('gained', 100, ['thaw'], ctx({ previousFoundation: card(2, '♠', 4), card: card(1, '♠', 6) }), params)
    expect(notTriggered).toBe(100)
  })

  test('dusk: 直前が赤から今回黒を取った時のみnを加算', () => {
    const triggered = applyItemEffects('gained', 100, ['dusk'], ctx({ previousFoundation: card(2, '♥', 4), card: card(1, '♠', 5) }), params)
    expect(triggered).toBe(100 + params.talismans.dusk.n)
    const notTriggered = applyItemEffects('gained', 100, ['dusk'], ctx({ previousFoundation: card(2, '♠', 4), card: card(1, '♣', 5) }), params)
    expect(notTriggered).toBe(100)
  })

  test('dawn: 直前が黒から今回赤を取った時のみnを加算', () => {
    const triggered = applyItemEffects('gained', 100, ['dawn'], ctx({ previousFoundation: card(2, '♠', 4), card: card(1, '♥', 5) }), params)
    expect(triggered).toBe(100 + params.talismans.dawn.n)
    const notTriggered = applyItemEffects('gained', 100, ['dawn'], ctx({ previousFoundation: card(2, '♥', 4), card: card(1, '♦', 5) }), params)
    expect(notTriggered).toBe(100)
  })

  test('wit: ワイルドを取った時のみnを加算', () => {
    const triggered = applyItemEffects('gained', 100, ['wit'], ctx({ card: card(1, '★', 0, true) }), params)
    expect(triggered).toBe(100 + params.talismans.wit.n)
    const notTriggered = applyItemEffects('gained', 100, ['wit'], ctx({ card: card(1, '♠', 5) }), params)
    expect(notTriggered).toBe(100)
  })

  test('courage: コンボ数×xで倍算', () => {
    const result = applyItemEffects('gained', 100, ['courage'], ctx({ combo: 5 }), params)
    expect(result).toBe(100 * (1 + 5 * params.talismans.courage.x))
  })

  test('daybreak: コンボ数がc以下の時のみx倍', () => {
    const triggered = applyItemEffects('gained', 100, ['daybreak'], ctx({ combo: params.talismans.daybreak.c }), params)
    expect(triggered).toBe(100 * params.talismans.daybreak.x)
    const notTriggered = applyItemEffects('gained', 100, ['daybreak'], ctx({ combo: params.talismans.daybreak.c + 1 }), params)
    expect(notTriggered).toBe(100)
  })

  test('twilight: コンボ数がc以上の時のみx倍', () => {
    const triggered = applyItemEffects('gained', 100, ['twilight'], ctx({ combo: params.talismans.twilight.c }), params)
    expect(triggered).toBe(100 * params.talismans.twilight.x)
    const notTriggered = applyItemEffects('gained', 100, ['twilight'], ctx({ combo: params.talismans.twilight.c - 1 }), params)
    expect(notTriggered).toBe(100)
  })

  test('cheerful: コンボ数が偶数の時のみnを加算', () => {
    const triggered = applyItemEffects('gained', 100, ['cheerful'], ctx({ combo: 4 }), params)
    expect(triggered).toBe(100 + params.talismans.cheerful.n)
    const notTriggered = applyItemEffects('gained', 100, ['cheerful'], ctx({ combo: 5 }), params)
    expect(notTriggered).toBe(100)
  })

  test('conscience: コンボ数が奇数の時のみnを加算', () => {
    const triggered = applyItemEffects('gained', 100, ['conscience'], ctx({ combo: 5 }), params)
    expect(triggered).toBe(100 + params.talismans.conscience.n)
    const notTriggered = applyItemEffects('gained', 100, ['conscience'], ctx({ combo: 4 }), params)
    expect(notTriggered).toBe(100)
  })

  test('morningMist: コンボ数がc未満なら1/x倍、c以上ならx倍', () => {
    const below = applyItemEffects('gained', 100, ['morningMist'], ctx({ combo: params.talismans.morningMist.c - 1 }), params)
    expect(below).toBe(100 / params.talismans.morningMist.x)
    const aboveOrEqual = applyItemEffects('gained', 100, ['morningMist'], ctx({ combo: params.talismans.morningMist.c }), params)
    expect(aboveOrEqual).toBe(100 * params.talismans.morningMist.x)
  })

  test('複数護符は所持順(配列順)に適用される(加算→倍算と倍算→加算で結果が変わることを確認)', () => {
    const order1 = applyItemEffects('clearBonus', 1000, ['purify', 'temperance'], ctx({ stockRemaining: 4 }), params)
    const order2 = applyItemEffects('clearBonus', 1000, ['temperance', 'purify'], ctx({ stockRemaining: 4 }), params)
    expect(order1).not.toBe(order2)
    expect(order1).toBe((1000 + params.talismans.purify.n) * (1 + 4 * params.talismans.temperance.x))
    expect(order2).toBe(1000 * (1 + 4 * params.talismans.temperance.x) + params.talismans.purify.n)
  })

  test('gainedチャンネルの護符はclearBonusチャンネル計算には適用されない', () => {
    const result = applyItemEffects('clearBonus', 1000, ['springBreeze'], ctx({ card: card(1, '♣', 5) }), params)
    expect(result).toBe(1000)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test -- engine.test.ts`
Expected: `applyItemEffects`が未定義のためTypeScriptエラー(またはimportエラー)でFAIL

- [ ] **Step 3: ItemEffectContext・ITEM_EFFECTS・applyItemEffectsを実装する**

`src/lib/game/shidasu/engine.ts`の`markStuck`関数の直後、`ITEM_POOL`の直前に以下を追加する:

```ts
export interface ItemEffectContext {
  card: Card
  previousFoundation: Card
  combo: number
  stockRemaining: number
}

type ItemEffect = (value: number, ctx: ItemEffectContext, params: ShidasuParams) => number

const ITEM_EFFECTS: Partial<Record<ItemId, { channel: 'gained' | 'clearBonus'; effect: ItemEffect }>> = {
  patience: {
    channel: 'clearBonus',
    effect: (v, ctx, p) => v + ctx.stockRemaining * p.talismans.patience.x,
  },
  purify: {
    channel: 'clearBonus',
    effect: (v, _ctx, p) => v + p.talismans.purify.n,
  },
  temperance: {
    channel: 'clearBonus',
    effect: (v, ctx, p) => v * (1 + ctx.stockRemaining * p.talismans.temperance.x),
  },
  springBreeze: {
    channel: 'gained',
    effect: (v, ctx, p) => (ctx.card.suit === '♣' ? v + p.talismans.springBreeze.n : v),
  },
  summerBreeze: {
    channel: 'gained',
    effect: (v, ctx, p) => (ctx.card.suit === '♦' ? v + p.talismans.summerBreeze.n : v),
  },
  autumnBreeze: {
    channel: 'gained',
    effect: (v, ctx, p) => (ctx.card.suit === '♥' ? v + p.talismans.autumnBreeze.n : v),
  },
  winterBreeze: {
    channel: 'gained',
    effect: (v, ctx, p) => (ctx.card.suit === '♠' ? v + p.talismans.winterBreeze.n : v),
  },
  kinship: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.card.suit === '♥' && ctx.previousFoundation.suit !== '♥' ? v + p.talismans.kinship.n : v,
  },
  thaw: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.previousFoundation.suit === '♠' && ctx.card.suit !== '♠' ? v + p.talismans.thaw.n : v,
  },
  dusk: {
    channel: 'gained',
    effect: (v, ctx, p) => (isRed(ctx.previousFoundation) && !isRed(ctx.card) ? v + p.talismans.dusk.n : v),
  },
  dawn: {
    channel: 'gained',
    effect: (v, ctx, p) => (!isRed(ctx.previousFoundation) && isRed(ctx.card) ? v + p.talismans.dawn.n : v),
  },
  wit: {
    channel: 'gained',
    effect: (v, ctx, p) => (ctx.card.wild ? v + p.talismans.wit.n : v),
  },
  courage: {
    channel: 'gained',
    effect: (v, ctx, p) => v * (1 + ctx.combo * p.talismans.courage.x),
  },
  daybreak: {
    channel: 'gained',
    effect: (v, ctx, p) => (ctx.combo <= p.talismans.daybreak.c ? v * p.talismans.daybreak.x : v),
  },
  twilight: {
    channel: 'gained',
    effect: (v, ctx, p) => (ctx.combo >= p.talismans.twilight.c ? v * p.talismans.twilight.x : v),
  },
  cheerful: {
    channel: 'gained',
    effect: (v, ctx, p) => (ctx.combo % 2 === 0 ? v + p.talismans.cheerful.n : v),
  },
  conscience: {
    channel: 'gained',
    effect: (v, ctx, p) => (ctx.combo % 2 !== 0 ? v + p.talismans.conscience.n : v),
  },
  morningMist: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.combo < p.talismans.morningMist.c ? v / p.talismans.morningMist.x : v * p.talismans.morningMist.x,
  },
}

export function applyItemEffects(
  channel: 'gained' | 'clearBonus',
  baseValue: number,
  items: ItemId[],
  ctx: ItemEffectContext,
  params: ShidasuParams
): number {
  return items.reduce((v, id) => {
    const entry = ITEM_EFFECTS[id]
    return entry && entry.channel === channel ? entry.effect(v, ctx, params) : v
  }, baseValue)
}
```

- [ ] **Step 4: テストを実行して全て通ることを確認**

Run: `npm run test -- engine.test.ts`
Expected: PASS(全テスト)

Run: `npm run check`
Expected: 型エラーなし

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: Shidasuに護符効果レジストリ(ITEM_EFFECTS/applyItemEffects)を実装
EOF
)"
```

---

### Task 3: playCardへの組み込み(gained/clearBonusチャンネル適用)

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts:81-155`(`playCard`)
- Test: `src/lib/game/shidasu/engine.test.ts`(`describe('playCard', ...)`ブロック)

- [ ] **Step 1: テストを書く(RED)**

`src/lib/game/shidasu/engine.test.ts`の`describe('playCard', () => { ... })`ブロック内、最後のテスト(`架橋の護符を持っていれば...`)の直後に、以下を追加する:

```ts
  test('gainedチャンネルの護符(springBreeze)は♣を取った時、得点に加算される', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['springBreeze'], 1000000, 0)
    expect(next.score).toBe(scoring.basePoint + DEFAULT_PARAMS.talismans.springBreeze.n)
  })

  test('clearBonusチャンネルの護符(purify)は全消し時のみclearBonusに加算される', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [card(9, '♠', 1), card(10, '♠', 2)],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['purify'], 100000000, 0)
    expect(next.endReason).toBe('fullClear')
    const expectedClearBonus = scoring.clearBonus + 2 * scoring.clearBonusPerStock + DEFAULT_PARAMS.talismans.purify.n
    expect(next.score).toBe(scoring.basePoint + scoring.columnSweepBonus * 1 + expectedClearBonus)
  })

  test('複数のclearBonus護符は所持順に適用される(purify→temperanceとtemperance→purifyで結果が異なる)', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [card(9, '♠', 1), card(10, '♠', 2)],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
    })
    const order1 = playCard(DEFAULT_PARAMS, wave, 'none', ['purify', 'temperance'], 100000000, 0)
    const order2 = playCard(DEFAULT_PARAMS, wave, 'none', ['temperance', 'purify'], 100000000, 0)
    expect(order1.score).not.toBe(order2.score)
  })
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test -- engine.test.ts`
Expected: 上記3テストがFAIL(現行の`playCard`はまだ`applyItemEffects`を呼んでいないため、`springBreeze`/`purify`/`temperance`を所持していても得点に反映されない)

- [ ] **Step 3: playCardにapplyItemEffectsの呼び出しを組み込む**

`src/lib/game/shidasu/engine.ts`の`playCard`関数を編集する。現在の該当箇所:

```ts
  const comboMultiplierStep = params.scoring.comboMultiplierStep
  const multiplier = 1 + (newCombo - 1) * comboMultiplierStep
  const gained = Math.floor(base * multiplier)

  const remaining = remainingCount(newTableau)
  const newScore = wave.score + gained
```

これを以下に変更する:

```ts
  const itemEffectCtx: ItemEffectContext = {
    card,
    previousFoundation: wave.foundation,
    combo: newCombo,
    stockRemaining: wave.stock.length,
  }

  const comboMultiplierStep = params.scoring.comboMultiplierStep
  const multiplier = 1 + (newCombo - 1) * comboMultiplierStep
  const rawGained = Math.floor(base * multiplier)
  const gained = Math.floor(applyItemEffects('gained', rawGained, items, itemEffectCtx, params))

  const remaining = remainingCount(newTableau)
  const newScore = wave.score + gained
```

続けて、同関数内の全消し分岐、現在の該当箇所:

```ts
  if (remaining === 0) {
    const clearBonus = params.scoring.clearBonus + wave.stock.length * params.scoring.clearBonusPerStock
    return { ...next, score: newScore + clearBonus, status: 'ended', endReason: 'fullClear' }
  }
```

これを以下に変更する:

```ts
  if (remaining === 0) {
    const rawClearBonus = params.scoring.clearBonus + wave.stock.length * params.scoring.clearBonusPerStock
    const clearBonus = Math.floor(applyItemEffects('clearBonus', rawClearBonus, items, itemEffectCtx, params))
    return { ...next, score: newScore + clearBonus, status: 'ended', endReason: 'fullClear' }
  }
```

- [ ] **Step 4: テストを実行して全て通ることを確認**

Run: `npm run test`
Expected: PASS(全テスト)

Run: `npm run check`
Expected: 型エラーなし

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: ShidasuのplayCardに護符効果パイプライン(gained/clearBonusチャンネル)を組み込む
EOF
)"
```

---

### Task 4: ITEM_POOLの拡張とrollItemOffer関連テストの更新

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts:207`(`ITEM_POOL`)
- Test: `src/lib/game/shidasu/engine.test.ts`(`describe('rollItemOffer', ...)`・`describe('ITEM_POOL / ITEM_NAMES / itemDesc', ...)`)

- [ ] **Step 1: 既存テストを新しいプール数(20個)に合わせて更新する(RED)**

`src/lib/game/shidasu/engine.test.ts`の`describe('rollItemOffer', () => { ... })`ブロック全体を、以下に置き換える:

```ts
describe('rollItemOffer', () => {
  test('未所持のアイテムの中から最大3件返す(プール数が3件を超える場合)', () => {
    const offer = rollItemOffer([], createRng(1))
    expect(offer).toHaveLength(3)
    offer.forEach(id => expect(ITEM_POOL).toContain(id))
    expect(new Set(offer).size).toBe(3) // 重複なし
  })

  test('既に持っているアイテムは種類を問わず候補から除外される', () => {
    const owned = ITEM_POOL.slice(0, ITEM_POOL.length - 1) // 1個だけ未所持にする
    const remaining = ITEM_POOL[ITEM_POOL.length - 1]
    const offer = rollItemOffer(owned, createRng(1))
    expect(offer).toEqual([remaining])
  })

  test('全て持っていれば候補は空になる', () => {
    const offer = rollItemOffer([...ITEM_POOL], createRng(1))
    expect(offer).toEqual([])
  })
})
```

続けて、`describe('ITEM_POOL / ITEM_NAMES / itemDesc', () => { ... })`ブロック内の最初のテストを、以下に置き換える:

```ts
  test('20種類のアイテムが定義されている', () => {
    expect(ITEM_POOL).toHaveLength(20)
    expect(new Set(ITEM_POOL).size).toBe(20) // 重複なし
    ITEM_POOL.forEach(id => expect(ITEM_NAMES[id]).toBeTruthy())
  })
```

(2番目のテスト`itemDescはパラメータの数値を埋め込んだ説明文を返す`はそのまま変更しない。)

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test -- engine.test.ts`
Expected: 上記の更新した3テストがFAIL(現行の`ITEM_POOL`はまだ`['bridge', 'grace']`の2個のみのため)

- [ ] **Step 3: ITEM_POOLを拡張する**

`src/lib/game/shidasu/engine.ts`の`ITEM_POOL`(207行目付近)を編集する:

```ts
export const ITEM_POOL: ItemId[] = [
  'bridge', 'grace',
  'patience', 'purify', 'temperance',
  'springBreeze', 'summerBreeze', 'autumnBreeze', 'winterBreeze',
  'kinship', 'thaw', 'dusk', 'dawn', 'wit',
  'courage', 'daybreak', 'twilight', 'cheerful', 'conscience', 'morningMist',
]
```

- [ ] **Step 4: テストを実行して全て通ることを確認**

Run: `npm run test`
Expected: PASS(全テスト)

Run: `npm run check`
Expected: 型エラーなし

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: ShidasuのITEM_POOLを20個に拡張する
EOF
)"
```

---

### Task 5: 管理画面(admin)に護符パラメータの入力欄を追加

**Files:**
- Modify: `src/routes/admin/shidasu/+page.svelte`

このタスクはUIのみの変更でユニットテストは無い(既存のVitestスイートはAPI/DOM層を対象にしていないため)。

- [ ] **Step 1: hasValidationErrorに除算エラー防止のチェックを追加する**

`src/routes/admin/shidasu/+page.svelte`の`hasValidationError`(18〜34行目)の`return false`の直前に、以下を追加する(`morningMist.x`は`v / x`という除算に使われるため、0や負の値だとゲームが壊れる):

```ts
    if (!Number.isFinite(config.talismans.morningMist.x) || config.talismans.morningMist.x <= 0) return true
```

- [ ] **Step 2: isValidShidasuParamsにtalismansのチェックを追加する**

`isValidShidasuParams`関数(91〜102行目)の`return (`の中、`typeof v.ui === 'object' && v.ui !== null`の行の直後に以下を追加する:

```ts
      typeof v.talismans === 'object' && v.talismans !== null &&
```

- [ ] **Step 3: 護符パラメータの入力セクションを追加する**

「アイテム」セクション(`<h2 class="font-semibold text-slate-700 text-sm mb-3">アイテム</h2>`を含む`<section>`)の直後、「フロー・UI」セクションの直前に、新しいセクションを追加する:

```svelte
      <section class="bg-white border border-slate-200 rounded-xl p-4">
        <h2 class="font-semibold text-slate-700 text-sm mb-3">護符パラメータ(グループ1〜3)</h2>
        <div class="grid grid-cols-2 gap-3">
          <label class="text-xs text-slate-500">
            忍耐: 残り山札数倍率(patience.x)
            <input type="number" min="0" step="1" bind:value={config.talismans.patience.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            浄化: 全消しボーナス加算(purify.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.purify.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            節制: 残り山札数倍率(temperance.x)
            <input type="number" min="0" step="0.01" bind:value={config.talismans.temperance.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            春風: ♣取得時加算(springBreeze.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.springBreeze.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            夏風: ♦取得時加算(summerBreeze.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.summerBreeze.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            秋風: ♥取得時加算(autumnBreeze.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.autumnBreeze.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            冬風: ♠取得時加算(winterBreeze.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.winterBreeze.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            友愛: 他スート→♥切替時加算(kinship.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.kinship.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            雪解: ♠→他スート切替時加算(thaw.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.thaw.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            宵闇: 赤→黒切替時加算(dusk.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.dusk.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            払暁: 黒→赤切替時加算(dawn.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.dawn.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            機知: ワイルド取得時加算(wit.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.wit.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            勇気: コンボ数倍率(courage.x)
            <input type="number" min="0" step="0.01" bind:value={config.talismans.courage.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            暁: 閾値(daybreak.c)
            <input type="number" min="0" step="1" bind:value={config.talismans.daybreak.c} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            暁: 倍率(daybreak.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.daybreak.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            黄昏: 閾値(twilight.c)
            <input type="number" min="0" step="1" bind:value={config.talismans.twilight.c} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            黄昏: 倍率(twilight.x)
            <input type="number" min="0" step="0.1" bind:value={config.talismans.twilight.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            快活: コンボ偶数時加算(cheerful.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.cheerful.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            良心: コンボ奇数時加算(conscience.n)
            <input type="number" min="0" step="1" bind:value={config.talismans.conscience.n} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            朝霧: 閾値(morningMist.c)
            <input type="number" min="0" step="1" bind:value={config.talismans.morningMist.c} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            朝霧: 倍率(morningMist.x)
            <input type="number" min="0.01" step="0.1" bind:value={config.talismans.morningMist.x} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
        </div>
      </section>
```

- [ ] **Step 4: 型チェックとビルドを確認**

Run: `npm run check`
Expected: 型エラーなし

Run: `npm run build`
Expected: ビルド成功

- [ ] **Step 5: コミット**

```bash
git add src/routes/admin/shidasu/+page.svelte
git commit -m "$(cat <<'EOF'
feat: Shidasu管理画面に護符候補グループ1〜3のパラメータ入力欄を追加
EOF
)"
```

---

### Task 6: 最終検証とドキュメント更新

**Files:**
- Verify: `npm run test`・`npm run check`・`npm run build`
- Verify: ブラウザでの動作確認(`/game/shidasu`・`/admin/shidasu`)
- Modify: `docs/shidasu-current-rules.md`
- Modify: `docs/shidasu-gofu-candidates.md`

- [ ] **Step 1: 自動テスト・型チェック・ビルドを実行**

```bash
npm run test
npm run check
npm run build
```

Expected: 全て成功。失敗があれば修正してから次に進む。

- [ ] **Step 2: `npm run dev`を起動し、`/admin/shidasu`でUIを確認**

- 「護符パラメータ(グループ1〜3)」セクションが表示され、18個(21入力欄)の値が編集できることを確認する。
- `morningMist.x`に`0`を入力すると保存ボタンが無効化される(`入力値が不正です`と表示される)ことを確認する。

- [ ] **Step 3: `/game/shidasu`でプレイして護符が正しく機能することを確認する**

一時的に`src/lib/game/shidasu/shidasu.config.json`の`items.maxItems`を編集する必要はない(既定の5枚のままでよい)。以下を確認する:

- ウェーブクリア時のアイテム選択画面に、新しい18個の護符名(忍耐の護符、春風の護符など)が選択肢として出現しうることを確認する(`DebugPanel`または実プレイで複数回ウェーブをクリアして確認する)。
- いずれかの`gained`系護符(例: 春風の護符)を取得した状態で対応する条件(例: ♣を取る)を満たすプレイをし、獲得点表示にボーナスが上乗せされることを確認する。
- いずれかの`clearBonus`系護符(例: 浄化の護符)を取得した状態で場札を全消しし、全消しボーナスに加算が反映されることを確認する。

確認後、開発サーバーを停止する。

- [ ] **Step 4: `docs/shidasu-current-rules.md`の護符プール一覧を更新する**

8節の護符プールの説明とテーブルを更新する。現在の記載:

```
- 現行の護符プール(2個):

  | 護符名 | 効果 |
  |---|---|
  | 架橋の護符 | 階段成立に必要な最小連続枚数を5→3枚に緩和 |
  | 寛容の護符 | 列一掃ボーナスの条件を「列の全5枚を1コンボで空に」→「残り3枚から1コンボで空に」に緩和 |

  (両方を取り尽くすと、以降のウェーブクリア時のアイテム選択肢は空になる。今後の護符追加で解消される想定。)
```

これを以下に置き換える:

```
- **加算・倍算型の護符が複数所持されている場合、適用順は所持順(取得した順)に固定される**(並べ替えUIは`docs/shidasu-roadmap.md`項目6の残タスク)。
- 現行の護符プール(20個):

  | 護符名 | 効果 |
  |---|---|
  | 架橋の護符 | 階段成立に必要な最小連続枚数を5→3枚に緩和 |
  | 寛容の護符 | 列一掃ボーナスの条件を「列の全5枚を1コンボで空に」→「残り3枚から1コンボで空に」に緩和 |
  | 忍耐の護符 | 全消しボーナスに残り山札枚数×500点を加算 |
  | 浄化の護符 | 全消しボーナスに10000点を加算 |
  | 節制の護符 | 全消しボーナスを残り山札枚数×0.1分だけ倍加 |
  | 春風の護符 | クラブ(♣)を取ったとき、100点加算 |
  | 夏風の護符 | ダイヤ(♦)を取ったとき、100点加算 |
  | 秋風の護符 | ハート(♥)を取ったとき、100点加算 |
  | 冬風の護符 | スペード(♠)を取ったとき、100点加算 |
  | 友愛の護符 | 他のスートからハート(♥)を取ったとき、200点加算 |
  | 雪解の護符 | スペード(♠)から別のスートを取ったとき、200点加算 |
  | 宵闇の護符 | 赤から黒に変わったとき、100点加算 |
  | 払暁の護符 | 黒から赤に変わったとき、100点加算 |
  | 機知の護符 | ワイルドを取ったとき、200点加算(現状ワイルド供給源が無いため発動機会が少ない) |
  | 勇気の護符 | コンボ数×0.1分、獲得点を倍加 |
  | 暁の護符 | コンボ数が3以下のとき、獲得点を2倍 |
  | 黄昏の護符 | コンボ数が8以上のとき、獲得点を2倍 |
  | 快活の護符 | コンボ数が偶数のとき、50点加算 |
  | 良心の護符 | コンボ数が奇数のとき、50点加算 |
  | 朝霧の護符 | コンボ数が5未満のとき獲得点を1/3に、5以上のとき3倍に |
```

- [ ] **Step 5: `docs/shidasu-gofu-candidates.md`のグループ1〜3を実装済みとして記録する**

以下3箇所の見出しを編集する:

```
### グループ1: 全消しボーナスへの加算/倍算(3個)
```
を
```
### グループ1: 全消しボーナスへの加算/倍算(3個)【実装済み: 2026-07-13】
```
に、

```
### グループ2: このカード単体の属性による取得時加算(9個)
```
を
```
### グループ2: このカード単体の属性による取得時加算(9個)【実装済み: 2026-07-13】
```
に、

```
### グループ3: 現在のコンボ数のみで判定する取得時加算/倍算(6個)
```
を
```
### グループ3: 現在のコンボ数のみで判定する取得時加算/倍算(6個)【実装済み: 2026-07-13】
```

にそれぞれ置き換える。

- [ ] **Step 6: コミット**

```bash
git add docs/shidasu-current-rules.md docs/shidasu-gofu-candidates.md
git commit -m "$(cat <<'EOF'
docs: Shidasu護符候補グループ1〜3の実装完了に伴いドキュメントを更新
EOF
)"
```

---

## 完了条件(specの受け入れ基準との対応)

1. `ITEM_EFFECTS`に18個全ての効果が登録され、`applyItemEffects`で正しく適用される → Task 2
2. 複数のgained系護符は所持順に適用される → Task 2(直接テスト)・Task 3(playCard経由の統合テスト)
3. `patience`/`purify`/`temperance`は`clearBonus`にのみ作用し、通常プレイの`gained`には影響しない → Task 2・Task 3
4. 色・スート切り替え系(友愛・雪解・宵闇・払暁)は、ウェーブ開始直後の1枚目のプレイでも`wave.foundation`との比較で正しく判定される → Task 2(`ctx`のprevious Foundationを使ったテストで検証済み。playCard呼び出し時に`wave.foundation`をそのまま渡すため、ウェーブ開始直後でも常に有効な値が入っている)
5. `ITEM_POOL`が20個になり、`rollItemOffer`が引き続き正しく動作する → Task 4
6. `npm run test`・`npm run build`が成功する → 各タスクのStep 4 + Task 6 Step 1
