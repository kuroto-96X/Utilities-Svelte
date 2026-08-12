# レリック個別候補(第1弾)実装 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `docs/superpowers/specs/2026-08-12-shidasu-relic-candidates-design.md`で採用された13個の個別レリックを実装し、動作確認用の`placeholder`レリックを置き換える。

**Architecture:** `RelicId`型に13個の新IDを追加し、既存の`params.relics`・`RELIC_POOL`・UIバッジ表示の仕組み(先行実装済み)にそのまま乗せる。各レリックの効果は「ショップ価格」「所持上限」「Waveクリア追加報酬」「ショップ枠数」の4系統に分類し、それぞれ`relics.ts`に集約した共通ヘルパー関数(`relicPriceMultiplier`・`itemMaxCapacity`/`riteMaxCapacity`/`revelationOracleMaxCapacity`・`relicWaveEndBonus`・各種スロット数ヘルパー)経由で`shop.ts`・`engine.ts`の既存コードに横断的に組み込む。最後に`/admin/shidasu-relics`管理画面を新設する。

**Tech Stack:** SvelteKit, Svelte 5 runes, TypeScript, Vitest

---

## 決定済みの初期値(spec「未定」の確定値)

| 仮称 | 変数 | 初期値 | 付喪化後 |
|---|---|---|---|
| 招き猫 | discountPercent | 25 | tsukumokaDiscountPercent: 50 |
| 福だるま | n | 2 | (同じn、効果に初回無料が追加) |
| 熊手 | n | 1 | (同じn、効果に福袋+n枠が追加) |
| 数珠 | n | 1 | tsukumokaN: 2 |
| 招き布袋像 | n | 1 | tsukumokaN: 1(合計+2) |
| 破魔矢 | n | 1 | tsukumokaN: 1(合計+2) |
| 千羽鶴 | n | 1 | tsukumokaN: 1(合計+2) |
| 福笹 | n | 1 | (同じn、効果にバラ売り+n枚が追加) |
| 開運こけし | sellBonusPercent | 25 | tsukumokaSellBonusPercent: 50 |
| 縁起小槌 | n | 1 | tsukumokaN: 1(合計+2) |
| 縁起鈴 | n | 1 | tsukumokaN: 1(合計+2) |
| 千社札 | n | 1 | tsukumoka時n=2 |
| 算盤 | n | 5 | tsukumoka時n=10 |

## File Structure

- `src/lib/game/shidasu/types.ts` — `RelicId`に13個追加。`ShopState.relic`を配列化(縁起鈴のため)。
- `src/lib/game/shidasu/relics.ts` — `RELIC_POOL`更新。価格倍率・所持上限・Wave報酬加算・ショップ枠数の共通ヘルパーを追加。
- `src/lib/game/shidasu/relics.test.ts` — 上記ヘルパーのユニットテスト。
- `src/lib/game/shidasu/params.ts` — `relics`型に13個のフィールド追加、`DEFAULT_PARAMS.relics`更新。
- `src/lib/game/shidasu/shidasu.config.json` — 同上のJSON側。
- `src/lib/game/shidasu/shop.ts` — 価格関数群に倍率適用、`rollShop`の枠数を可変化、リロールコストにn適用。
- `src/lib/game/shidasu/shop.test.ts` — 上記の追加テスト。
- `src/lib/game/shidasu/engine.ts` — 所持上限9箇所を動的化、`resolveWaveEnd`に報酬加算、`buyRelic`を配列対応に更新、`rerollShop`初回無料対応。
- `src/lib/game/shidasu/engine.test.ts` — 上記の追加テスト。
- `src/routes/game/shidasu/+page.svelte` — `run.shop.relic`配列化対応(既存の単一表示を`{#each}`化)。
- `src/routes/admin/shidasu-relics/+page.svelte`(新規) — レリックパラメータ編集画面。
- `src/routes/admin/+page.svelte` — 管理ページ一覧にリンク追加。
- `docs/shidasu/shidasu-roadmap.md` — 項目5に実装完了を追記。
- `docs/shidasu/shidasu-relic-candidates-design.md`へ移動想定は無し(specはdone/へ後で移動、本プランの最終タスクで実施)。

---

### Task 1: RelicId型・パラメータ土台の追加(13候補ぶん)

**Files:**
- Modify: `src/lib/game/shidasu/types.ts:115`
- Modify: `src/lib/game/shidasu/params.ts:240`, `params.ts:495-498`
- Modify: `src/lib/game/shidasu/shidasu.config.json:1229-1236`
- Modify: `src/lib/game/shidasu/relics.ts`
- Test: `src/lib/game/shidasu/relics.test.ts`

このタスクは新しい挙動を追加しないため、TDDの「先に落ちるテストを書く」対象は「13種すべてが`RELIC_POOL`に含まれ、`params.relics`から参照できる」という土台の存在確認テストとする。

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/relics.test.ts`の既存内容を確認し、末尾に追記する:

```ts
import { DEFAULT_PARAMS } from './params'

describe('RELIC_POOL(第1弾13候補)', () => {
  const expectedIds = [
    'maneki-neko', 'fuku-daruma', 'kumade', 'juzu',
    'maneki-hoteizo', 'hamaya', 'senbazuru', 'fukuzasa',
    'kaiun-kokeshi', 'engi-kozuchi', 'engi-suzu', 'senjafuda', 'soroban',
  ] as const

  it('13候補すべてがRELIC_POOLに含まれる(placeholderは除去済み)', () => {
    for (const id of expectedIds) {
      expect(RELIC_POOL).toContain(id)
    }
    expect(RELIC_POOL).not.toContain('placeholder')
    expect(RELIC_POOL).toHaveLength(13)
  })

  it('全13候補がparams.relicsに定義されている', () => {
    for (const id of expectedIds) {
      expect(DEFAULT_PARAMS.relics[id]).toBeDefined()
      expect(DEFAULT_PARAMS.relics[id].name.length).toBeGreaterThan(0)
      expect(DEFAULT_PARAMS.relics[id].price).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test -- relics.test.ts`
Expected: FAIL(`RelicId`にまだ`maneki-neko`等が存在せず型エラー、または`RELIC_POOL`に含まれず失敗)

- [ ] **Step 3: `types.ts`の`RelicId`を更新**

`src/lib/game/shidasu/types.ts:115`を置き換える:

```ts
// レリック(Relic): ショップ販売価格・提示数・リロールコストの減少、秘儀・天啓・神託の所持上限増加など、
// ラン単位の経済・メタ的な効果を持つ、護符の守備範囲外のアイテム。所持数に上限は無いが重複所持はできない。
// 個体ごとに「付喪化」(進化)状態を持ち、付喪化すると効果が上方修正される。第1弾13候補(仮称)。
export type RelicId =
  | 'maneki-neko' | 'fuku-daruma' | 'kumade' | 'juzu'
  | 'maneki-hoteizo' | 'hamaya' | 'senbazuru' | 'fukuzasa'
  | 'kaiun-kokeshi' | 'engi-kozuchi' | 'engi-suzu' | 'senjafuda' | 'soroban'
```

- [ ] **Step 4: `params.ts`の`relics`型と`DEFAULT_PARAMS.relics`を更新**

`src/lib/game/shidasu/params.ts:240`を置き換える:

```ts
  relics: {
    'maneki-neko': { name: string; desc: string; tsukumokaDesc: string; price: number; discountPercent: number; tsukumokaDiscountPercent: number }
    'fuku-daruma': { name: string; desc: string; tsukumokaDesc: string; price: number; n: number }
    kumade: { name: string; desc: string; tsukumokaDesc: string; price: number; n: number }
    juzu: { name: string; desc: string; tsukumokaDesc: string; price: number; n: number; tsukumokaN: number }
    'maneki-hoteizo': { name: string; desc: string; tsukumokaDesc: string; price: number; n: number; tsukumokaN: number }
    hamaya: { name: string; desc: string; tsukumokaDesc: string; price: number; n: number; tsukumokaN: number }
    senbazuru: { name: string; desc: string; tsukumokaDesc: string; price: number; n: number; tsukumokaN: number }
    fukuzasa: { name: string; desc: string; tsukumokaDesc: string; price: number; n: number }
    'kaiun-kokeshi': { name: string; desc: string; tsukumokaDesc: string; price: number; sellBonusPercent: number; tsukumokaSellBonusPercent: number }
    'engi-kozuchi': { name: string; desc: string; tsukumokaDesc: string; price: number; n: number; tsukumokaN: number }
    'engi-suzu': { name: string; desc: string; tsukumokaDesc: string; price: number; n: number; tsukumokaN: number }
    senjafuda: { name: string; desc: string; tsukumokaDesc: string; price: number; n: number; tsukumokaN: number }
    soroban: { name: string; desc: string; tsukumokaDesc: string; price: number; n: number; tsukumokaN: number }
  }
```

`src/lib/game/shidasu/params.ts:495-498`(`relics: { placeholder: ... }`)を置き換える:

```ts
  relics: {
    'maneki-neko': { name: '招き猫', desc: 'ショップの全商品の購入価格を{discountPercent}%値引きする', tsukumokaDesc: 'ショップの全商品の購入価格を{tsukumokaDiscountPercent}%値引きする', price: 25, discountPercent: 25, tsukumokaDiscountPercent: 50 },
    'fuku-daruma': { name: '福だるま', desc: 'ショップのリロールコストの刻み幅を{n}減らす', tsukumokaDesc: 'ショップのリロールコストの刻み幅を{n}減らし、同一ショップ訪問中の最初の1回のリロールを無料にする', price: 20, n: 2 },
    kumade: { name: '熊手', desc: 'ショップのバラ売り枠を{n}枠増やす', tsukumokaDesc: 'ショップのバラ売り枠を{n}枠、福袋枠も{n}枠増やす', price: 25, n: 1 },
    juzu: { name: '数珠', desc: 'Waveクリア時、そのWaveでの最大コンボ数に応じて追加報酬(floor(最大コンボ数/5)×{n})を得る', tsukumokaDesc: 'Waveクリア時、そのWaveでの最大コンボ数に応じて追加報酬(floor(最大コンボ数/5)×{tsukumokaN})を得る', price: 20, n: 1, tsukumokaN: 2 },
    'maneki-hoteizo': { name: '招き布袋像', desc: '護符の所持上限を{n}増やす', tsukumokaDesc: '護符の所持上限を{n}増やし、さらに{tsukumokaN}増やす', price: 30, n: 1, tsukumokaN: 1 },
    hamaya: { name: '破魔矢', desc: '秘儀の所持上限を{n}増やす', tsukumokaDesc: '秘儀の所持上限を{n}増やし、さらに{tsukumokaN}増やす', price: 30, n: 1, tsukumokaN: 1 },
    senbazuru: { name: '千羽鶴', desc: '天啓・神託(合算)の所持上限を{n}増やす', tsukumokaDesc: '天啓・神託(合算)の所持上限を{n}増やし、さらに{tsukumokaN}増やす', price: 30, n: 1, tsukumokaN: 1 },
    fukuzasa: { name: '福笹', desc: '福袋の枠を{n}枠増やす', tsukumokaDesc: '福袋の枠を{n}枠、バラ売り枠も{n}枚増やす', price: 25, n: 1 },
    'kaiun-kokeshi': { name: '開運こけし', desc: '護符・秘儀・天啓・神託の売却価格を{sellBonusPercent}%上乗せする', tsukumokaDesc: '護符・秘儀・天啓・神託の売却価格を{tsukumokaSellBonusPercent}%上乗せする', price: 20, sellBonusPercent: 25, tsukumokaSellBonusPercent: 50 },
    'engi-kozuchi': { name: '縁起小槌', desc: '福袋の選択肢数を全ジャンル{n}増やす', tsukumokaDesc: '福袋の選択肢数を全ジャンル{n}増やし、さらに{tsukumokaN}増やす', price: 25, n: 1, tsukumokaN: 1 },
    'engi-suzu': { name: '縁起鈴', desc: 'レリック専用枠の提示数を{n}増やす', tsukumokaDesc: 'レリック専用枠の提示数を{n}増やし、さらに{tsukumokaN}増やす', price: 35, n: 1, tsukumokaN: 1 },
    senjafuda: { name: '千社札', desc: 'Waveクリア時、そのWaveで成立した役の種類数に応じて追加報酬(floor(役の種類数/2)×{n})を得る', tsukumokaDesc: 'Waveクリア時、そのWaveで成立した役の種類数に応じて追加報酬(floor(役の種類数/2)×{n})を得る(付喪化によりn=2に強化)', price: 20, n: 1 },
    soroban: { name: '算盤', desc: 'Waveクリア時、山札の消費割合に応じて追加報酬(floor(((c-b-a)/(c-b))×{n})、a=残り山札枚数,b=初期配布枚数,c=デッキ総枚数)を得る', tsukumokaDesc: 'Waveクリア時、山札の消費割合に応じて追加報酬(floor(((c-b-a)/(c-b))×{n})、a=残り山札枚数,b=初期配布枚数,c=デッキ総枚数)を得る(付喪化によりn=10に強化)', price: 20, n: 5 },
  },
```

**注意:** `senjafuda`・`soroban`は「付喪化でnの値そのものが変わる」設計(spec通り)であり、`tsukumokaDesc`のテキストは説明文だが実際の数値はコード側(Task 5)でハードコードされた`2`/`10`を使う(`tsukumokaN`フィールドは持たない)。descテンプレートの`{n}`展開は常に`n`(基本値)を使うため、tsukumokaDescの文言はプレースホルダー展開に頼らず地の文で説明する形にした(上記の通りdesc内に直接「(付喪化によりn=2に強化)」と書く)。

- [ ] **Step 5: `shidasu.config.json`の`relics`ブロックを更新**

`src/lib/game/shidasu/shidasu.config.json:1229-1236`を、Step 4で書いた`DEFAULT_PARAMS.relics`と同じ内容のJSON形式で置き換える(キーをダブルクォート、末尾カンマ無し)。

- [ ] **Step 6: `relics.ts`の`RELIC_POOL`を更新**

`src/lib/game/shidasu/relics.ts:6`を置き換える:

```ts
export const RELIC_POOL: RelicId[] = [
  'maneki-neko', 'fuku-daruma', 'kumade', 'juzu',
  'maneki-hoteizo', 'hamaya', 'senbazuru', 'fukuzasa',
  'kaiun-kokeshi', 'engi-kozuchi', 'engi-suzu', 'senjafuda', 'soroban',
]
```

- [ ] **Step 7: テストを実行して成功を確認**

Run: `npm run test -- relics.test.ts`
Expected: PASS

- [ ] **Step 8: 型チェックとビルド**

Run: `npm run check`
Expected: `placeholder`を参照していた既存コード(shop.test.ts・engine.test.ts等)で型エラーが出る可能性がある。出た場合は該当箇所を`'maneki-neko'`など実在のIDに置き換える(このタスクの範囲内で修正してよい、機械的な置換)。

- [ ] **Step 9: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/relics.ts src/lib/game/shidasu/relics.test.ts
git commit -m "feat: レリック13候補のRelicId・パラメータ土台を追加"
```

---

### Task 2: 価格倍率ヘルパー(招き猫)を実装しショップ価格に適用

**Files:**
- Modify: `src/lib/game/shidasu/relics.ts`
- Modify: `src/lib/game/shidasu/shop.ts:64-98`
- Test: `src/lib/game/shidasu/relics.test.ts`
- Test: `src/lib/game/shidasu/shop.test.ts`

招き猫所持時、`itemBuyPrice`・`riteBuyPrice`・`revelationBuyPrice`・`oracleBuyPrice`・`relicBuyPrice`の全て、および福袋のスナップショット価格(`rollPackSlots`)に割引を適用する。売却価格(`itemSellPrice`等)には適用しない(spec通り、招き猫は購入価格のみ)。

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/relics.test.ts`に追記:

```ts
import type { RunState } from './types'

describe('relicPriceMultiplier(招き猫)', () => {
  const baseRun = { relics: [] } as unknown as RunState

  it('招き猫を所持していなければ倍率1', () => {
    expect(relicPriceMultiplier(DEFAULT_PARAMS, baseRun)).toBe(1)
  })

  it('招き猫(未付喪化)所持時は(100-25)/100=0.75', () => {
    const run = { relics: [{ id: 'maneki-neko' as const, tsukumoka: false }] } as unknown as RunState
    expect(relicPriceMultiplier(DEFAULT_PARAMS, run)).toBeCloseTo(0.75)
  })

  it('招き猫(付喪化済み)所持時は(100-50)/100=0.5', () => {
    const run = { relics: [{ id: 'maneki-neko' as const, tsukumoka: true }] } as unknown as RunState
    expect(relicPriceMultiplier(DEFAULT_PARAMS, run)).toBeCloseTo(0.5)
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test -- relics.test.ts`
Expected: FAIL(`relicPriceMultiplier`が存在しない)

- [ ] **Step 3: `relics.ts`に`relicPriceMultiplier`を実装**

`src/lib/game/shidasu/relics.ts`の末尾に追記:

```ts
import type { RunState } from './types'

// 招き猫所持時のショップ購入価格倍率。所持していなければ1(無変化)。
// 端数はMath.roundで各価格関数側が丸める(このヘルパー自体は丸めない)。
export function relicPriceMultiplier(params: ShidasuParams, run: RunState): number {
  const relic = run.relics.find(r => r.id === 'maneki-neko')
  if (!relic) return 1
  const percent = relic.tsukumoka ? params.relics['maneki-neko'].tsukumokaDiscountPercent : params.relics['maneki-neko'].discountPercent
  return (100 - percent) / 100
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm run test -- relics.test.ts`
Expected: PASS

- [ ] **Step 5: `shop.ts`の価格関数群を更新**

`src/lib/game/shidasu/shop.ts:1-2`のimportに`relicPriceMultiplier`を追加:

```ts
import { RELIC_POOL, relicPriceMultiplier } from './relics'
```

`src/lib/game/shidasu/shop.ts:64-98`を置き換える(全ての`buyPrice`系関数に`run: RunState`引数と倍率適用を追加。`sellPrice`系は変更しない):

```ts
export function itemBuyPrice(params: ShidasuParams, run: RunState, id: ItemId): number {
  return Math.round(params.shop.itemPrice[params.talismans[id].rarity].buy * relicPriceMultiplier(params, run))
}

export function itemSellPrice(params: ShidasuParams, id: ItemId): number {
  return params.shop.itemPrice[params.talismans[id].rarity].sell
}

export function riteBuyPrice(params: ShidasuParams, run: RunState): number {
  return Math.round(params.shop.ritePrice.buy * relicPriceMultiplier(params, run))
}

export function riteSellPrice(params: ShidasuParams): number {
  return params.shop.ritePrice.sell
}

export function revelationBuyPrice(params: ShidasuParams, run: RunState): number {
  return Math.round(params.shop.revelationPrice.buy * relicPriceMultiplier(params, run))
}

export function revelationSellPrice(params: ShidasuParams): number {
  return params.shop.revelationPrice.sell
}

export function oracleBuyPrice(params: ShidasuParams, run: RunState): number {
  return Math.round(params.shop.oraclePrice.buy * relicPriceMultiplier(params, run))
}

export function oracleSellPrice(params: ShidasuParams): number {
  return params.shop.oraclePrice.sell
}

export function relicBuyPrice(params: ShidasuParams, run: RunState, id: RelicId): number {
  return Math.round(params.relics[id].price * relicPriceMultiplier(params, run))
}
```

`src/lib/game/shidasu/shop.ts:39-43`の`rollPackSlots`を、招き猫の倍率も適用するよう置き換える:

```ts
// params.shop.packCatalogをシャッフルし、先頭2件を選ぶ(均等抽選)。選ばれたエントリの
// name・priceはこの時点でShopPackSlotにスナップショットとしてコピーする(招き猫所持時は割引後の価格をスナップショットする)。
function rollPackSlots(params: ShidasuParams, run: RunState, rand: () => number): ShopPackSlot[] {
  const entries = [...params.shop.packCatalog]
  shuffleInPlace(entries, rand)
  const multiplier = relicPriceMultiplier(params, run)
  return entries.slice(0, 2).map(e => ({ packKind: e.packKind, offerCount: e.offerCount, pickCount: e.pickCount, name: e.name, price: Math.round(e.price * multiplier), sold: false }))
}
```

`rollShop`内の`rollPackSlots(params, rand)`呼び出し(現`shop.ts:61`)を`rollPackSlots(params, run, rand)`に更新する。

- [ ] **Step 6: 呼び出し元(`engine.ts`・`+page.svelte`)を更新**

`buyIndividualItem`(engine.ts:1196付近)・`buyIndividualRite`(1209)・`buyIndividualRevelationUse`(1241)・`buyIndividualRevelationHold`(1256)・`buyIndividualOracleUse`・`buyIndividualOracleHold`・`buyRelic`内の各`xxxBuyPrice(params)`/`xxxBuyPrice(params, id)`呼び出しに`run`引数を追加する(`xxxBuyPrice(params, run)`/`xxxBuyPrice(params, run, id)`)。`Grep`で`BuyPrice(params` を検索し、該当箇所全てを機械的に更新する。

`src/routes/game/shidasu/+page.svelte`内で同様に`itemBuyPrice`・`riteBuyPrice`・`revelationBuyPrice`・`oracleBuyPrice`・`relicBuyPrice`を呼んでいる箇所(価格表示・disabled判定)に`run`引数を追加する。

- [ ] **Step 7: 型チェック**

Run: `npm run check`
Expected: 呼び出し元の引数不足エラーが全て解消していること。エラーが残っていれば該当箇所を修正する。

- [ ] **Step 8: 既存テストの呼び出し箇所を更新**

`src/lib/game/shidasu/shop.test.ts`・`src/lib/game/shidasu/engine.test.ts`内で上記の価格関数を呼んでいるテストに`run`引数(ダミーの`RunState`、既存のテストヘルパーがあればそれを使う)を追加する。

- [ ] **Step 9: 新規テストを追加**

`src/lib/game/shidasu/shop.test.ts`に追記:

```ts
it('招き猫所持時、福袋のスナップショット価格が割引される', () => {
  const params = DEFAULT_PARAMS
  const run = { ...someBaseRunState, relics: [{ id: 'maneki-neko' as const, tsukumoka: false }] }
  const shop = rollShop(params, run, () => 0)
  const expectedMultiplier = 0.75
  for (const pack of shop.packs) {
    const catalogEntry = params.shop.packCatalog.find(e => e.name === pack.name && e.offerCount === pack.offerCount)!
    expect(pack.price).toBe(Math.round(catalogEntry.price * expectedMultiplier))
  }
})
```

(`someBaseRunState`は既存の`shop.test.ts`内で使われているテスト用`RunState`生成ヘルパー・定数を実際に探して使うこと。無ければ`createInitialRun`等の既存エクスポートを使う。)

- [ ] **Step 10: 全テスト実行**

Run: `npm run test`
Expected: PASS

- [ ] **Step 11: コミット**

```bash
git add src/lib/game/shidasu/relics.ts src/lib/game/shidasu/shop.ts src/lib/game/shidasu/engine.ts src/routes/game/shidasu/+page.svelte src/lib/game/shidasu/relics.test.ts src/lib/game/shidasu/shop.test.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 招き猫(ショップ価格割引)を実装"
```

---

### Task 3: 所持上限の動的化ヘルパー(招き布袋像・破魔矢・千羽鶴)

**Files:**
- Modify: `src/lib/game/shidasu/relics.ts`
- Modify: `src/lib/game/shidasu/engine.ts`(9箇所)
- Test: `src/lib/game/shidasu/relics.test.ts`
- Test: `src/lib/game/shidasu/engine.test.ts`

現状ハードコードされている所持上限(`params.items.maxItems`・秘儀`3`・天啓+神託合算`2`)を、所持レリックに応じて動的に加算する3つのヘルパー関数を追加し、既存の9箇所の比較式を置き換える。

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/relics.test.ts`に追記:

```ts
describe('所持上限ヘルパー', () => {
  it('itemMaxCapacity: 招き布袋像なしならparams.items.maxItemsそのまま', () => {
    const run = { relics: [] } as unknown as RunState
    expect(itemMaxCapacity(DEFAULT_PARAMS, run)).toBe(DEFAULT_PARAMS.items.maxItems)
  })
  it('itemMaxCapacity: 招き布袋像(未付喪化)で+1', () => {
    const run = { relics: [{ id: 'maneki-hoteizo' as const, tsukumoka: false }] } as unknown as RunState
    expect(itemMaxCapacity(DEFAULT_PARAMS, run)).toBe(DEFAULT_PARAMS.items.maxItems + 1)
  })
  it('itemMaxCapacity: 招き布袋像(付喪化)で+2', () => {
    const run = { relics: [{ id: 'maneki-hoteizo' as const, tsukumoka: true }] } as unknown as RunState
    expect(itemMaxCapacity(DEFAULT_PARAMS, run)).toBe(DEFAULT_PARAMS.items.maxItems + 2)
  })
  it('riteMaxCapacity: 破魔矢なしなら3', () => {
    const run = { relics: [] } as unknown as RunState
    expect(riteMaxCapacity(DEFAULT_PARAMS, run)).toBe(3)
  })
  it('riteMaxCapacity: 破魔矢(付喪化)で3+2', () => {
    const run = { relics: [{ id: 'hamaya' as const, tsukumoka: true }] } as unknown as RunState
    expect(riteMaxCapacity(DEFAULT_PARAMS, run)).toBe(5)
  })
  it('revelationOracleMaxCapacity: 千羽鶴なしなら2', () => {
    const run = { relics: [] } as unknown as RunState
    expect(revelationOracleMaxCapacity(DEFAULT_PARAMS, run)).toBe(2)
  })
  it('revelationOracleMaxCapacity: 千羽鶴(付喪化)で2+2', () => {
    const run = { relics: [{ id: 'senbazuru' as const, tsukumoka: true }] } as unknown as RunState
    expect(revelationOracleMaxCapacity(DEFAULT_PARAMS, run)).toBe(4)
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test -- relics.test.ts`
Expected: FAIL(3関数とも未定義)

- [ ] **Step 3: `relics.ts`にヘルパーを実装**

`src/lib/game/shidasu/relics.ts`の末尾に追記:

```ts
function relicBonus(run: RunState, id: RelicId, n: number, tsukumokaN: number): number {
  const relic = run.relics.find(r => r.id === id)
  if (!relic) return 0
  return relic.tsukumoka ? n + tsukumokaN : n
}

// 護符の所持上限。招き布袋像所持時はn(付喪化ならさらにtsukumokaN)を加算する。
export function itemMaxCapacity(params: ShidasuParams, run: RunState): number {
  const r = params.relics['maneki-hoteizo']
  return params.items.maxItems + relicBonus(run, 'maneki-hoteizo', r.n, r.tsukumokaN)
}

// 秘儀の所持上限(基本値3)。破魔矢所持時はn(付喪化ならさらにtsukumokaN)を加算する。
export function riteMaxCapacity(params: ShidasuParams, run: RunState): number {
  const r = params.relics.hamaya
  return 3 + relicBonus(run, 'hamaya', r.n, r.tsukumokaN)
}

// 天啓・神託合算の所持上限(基本値2)。千羽鶴所持時はn(付喪化ならさらにtsukumokaN)を加算する。
export function revelationOracleMaxCapacity(params: ShidasuParams, run: RunState): number {
  const r = params.relics.senbazuru
  return 2 + relicBonus(run, 'senbazuru', r.n, r.tsukumokaN)
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm run test -- relics.test.ts`
Expected: PASS

- [ ] **Step 5: `engine.ts`の9箇所を置き換え**

`src/lib/game/shidasu/engine.ts`冒頭のimportに追加:

```ts
import { itemMaxCapacity, riteMaxCapacity, revelationOracleMaxCapacity } from './relics'
```

以下9箇所を機械的に置き換える(`Grep`で`>= 3\)|>= 2\)|maxItems\)`を検索して洗い出す):

- `engine.ts:1195` `if (run.items.length >= params.items.maxItems) return run` → `if (run.items.length >= itemMaxCapacity(params, run)) return run`
- `engine.ts:1208` `if (run.rites.length >= 3) return run` → `if (run.rites.length >= riteMaxCapacity(params, run)) return run`
- `engine.ts:1254` `if (run.revelations.length + run.oracles.length >= 2) return run` → `if (run.revelations.length + run.oracles.length >= revelationOracleMaxCapacity(params, run)) return run`
- `engine.ts:1281` 同上パターン → 同様に置き換え
- `engine.ts:1317` `if (run.items.length >= params.items.maxItems) {` → `if (run.items.length >= itemMaxCapacity(params, run)) {`
- `engine.ts:1356` `if (run.rites.length >= 3) {` → `if (run.rites.length >= riteMaxCapacity(params, run)) {`
- `engine.ts:1402` 同上(revelations+oracles)パターン → 同様に置き換え
- `engine.ts:1450` `if (runAfterRemoval.items.length >= params.items.maxItems) return {}` → `if (runAfterRemoval.items.length >= itemMaxCapacity(params, runAfterRemoval)) return {}`
- `engine.ts:1537` 同上(revelations+oracles)パターン → 同様に置き換え

各置換後、その関数のシグネチャに`params: ShidasuParams`が既に存在することを確認する(全箇所とも既存シグネチャに`params`引数がある想定。無い関数があれば`params`を追加し、呼び出し元も更新する)。

- [ ] **Step 6: 型チェック**

Run: `npm run check`
Expected: PASS(エラーがあれば呼び出し元の引数不足を修正)

- [ ] **Step 7: 既存テストを更新**

`src/lib/game/shidasu/engine.test.ts`内で、上限到達を検証している既存テスト(`items.length >= 5`等を直接組み立てているもの)が壊れていないか確認する。壊れていれば`itemMaxCapacity`等の想定値に合わせて修正する。

- [ ] **Step 8: 新規テストを追加**

`src/lib/game/shidasu/engine.test.ts`に追記:

```ts
describe('招き布袋像による護符所持上限の拡張', () => {
  it('招き布袋像所持時、maxItems+1まで購入できる', () => {
    const params = DEFAULT_PARAMS
    let run = createInitialRun(params)
    run = { ...run, relics: [{ id: 'maneki-hoteizo', tsukumoka: false }], items: new Array(params.items.maxItems).fill('bridge') as ItemId[], currency: 9999, phase: 'shop', shop: { individual: [{ kind: 'item', id: 'grace', sold: false }], packs: [], relic: [] } }
    run = buyIndividualItem(params, run, 0)
    expect(run.items).toHaveLength(params.items.maxItems + 1)
  })
})
```

(実際の`RunState`必須フィールドが多いため、既存の`engine.test.ts`内で使われている`baseRun`/`makeRun`等のテストヘルパーを探して使い、上記は差分のみ`{ ...baseRun, ... }`で上書きする形に調整すること。)

- [ ] **Step 9: テスト実行**

Run: `npm run test`
Expected: PASS

- [ ] **Step 10: コミット**

```bash
git add src/lib/game/shidasu/relics.ts src/lib/game/shidasu/engine.ts src/lib/game/shidasu/relics.test.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 所持上限の動的化(招き布袋像・破魔矢・千羽鶴)を実装"
```

---

### Task 4: 開運こけし(売却価格上乗せ)を実装

**Files:**
- Modify: `src/lib/game/shidasu/relics.ts`
- Modify: `src/lib/game/shidasu/shop.ts`
- Test: `src/lib/game/shidasu/relics.test.ts`
- Test: `src/lib/game/shidasu/shop.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/relics.test.ts`に追記:

```ts
describe('relicSellBonusMultiplier(開運こけし)', () => {
  it('所持していなければ倍率1', () => {
    const run = { relics: [] } as unknown as RunState
    expect(relicSellBonusMultiplier(DEFAULT_PARAMS, run)).toBe(1)
  })
  it('未付喪化なら1.25', () => {
    const run = { relics: [{ id: 'kaiun-kokeshi' as const, tsukumoka: false }] } as unknown as RunState
    expect(relicSellBonusMultiplier(DEFAULT_PARAMS, run)).toBeCloseTo(1.25)
  })
  it('付喪化済みなら1.5', () => {
    const run = { relics: [{ id: 'kaiun-kokeshi' as const, tsukumoka: true }] } as unknown as RunState
    expect(relicSellBonusMultiplier(DEFAULT_PARAMS, run)).toBeCloseTo(1.5)
  })
})
```

- [ ] **Step 2: テスト実行して失敗確認**

Run: `npm run test -- relics.test.ts`
Expected: FAIL

- [ ] **Step 3: `relics.ts`に実装**

```ts
// 開運こけし所持時の売却価格倍率。所持していなければ1(無変化)。
export function relicSellBonusMultiplier(params: ShidasuParams, run: RunState): number {
  const relic = run.relics.find(r => r.id === 'kaiun-kokeshi')
  if (!relic) return 1
  const percent = relic.tsukumoka ? params.relics['kaiun-kokeshi'].tsukumokaSellBonusPercent : params.relics['kaiun-kokeshi'].sellBonusPercent
  return (100 + percent) / 100
}
```

- [ ] **Step 4: テスト実行して成功確認**

Run: `npm run test -- relics.test.ts`
Expected: PASS

- [ ] **Step 5: `shop.ts`の売却価格関数を更新**

`itemSellPrice`・`riteSellPrice`・`revelationSellPrice`・`oracleSellPrice`(shop.ts、Task2で`run`引数追加済みの`xxxBuyPrice`とは別物、`sellPrice`系は今回`run`引数を追加する)に`run`引数を追加し倍率を適用する:

```ts
export function itemSellPrice(params: ShidasuParams, run: RunState, id: ItemId): number {
  return Math.round(params.shop.itemPrice[params.talismans[id].rarity].sell * relicSellBonusMultiplier(params, run))
}

export function riteSellPrice(params: ShidasuParams, run: RunState): number {
  return Math.round(params.shop.ritePrice.sell * relicSellBonusMultiplier(params, run))
}

export function revelationSellPrice(params: ShidasuParams, run: RunState): number {
  return Math.round(params.shop.revelationPrice.sell * relicSellBonusMultiplier(params, run))
}

export function oracleSellPrice(params: ShidasuParams, run: RunState): number {
  return Math.round(params.shop.oraclePrice.sell * relicSellBonusMultiplier(params, run))
}
```

importに`relicSellBonusMultiplier`を追加する。

- [ ] **Step 6: 呼び出し元を更新**

`engine.ts`内で護符・秘儀・天啓・神託の売却処理(`sellItem`等、`Grep`で`SellPrice(params`を検索)を`run`引数付きに更新する。`+page.svelte`内の売却価格表示も同様に更新する。

- [ ] **Step 7: 型チェック**

Run: `npm run check`
Expected: PASS

- [ ] **Step 8: 既存テストを更新**

`shop.test.ts`・`engine.test.ts`内の`xxxSellPrice`呼び出しに`run`引数を追加する。

- [ ] **Step 9: 新規テストを追加**

`src/lib/game/shidasu/shop.test.ts`に追記:

```ts
it('開運こけし所持時、護符の売却価格が上乗せされる', () => {
  const params = DEFAULT_PARAMS
  const run = { relics: [{ id: 'kaiun-kokeshi' as const, tsukumoka: false }] } as unknown as RunState
  const base = itemSellPrice(params, { relics: [] } as unknown as RunState, 'bridge')
  expect(itemSellPrice(params, run, 'bridge')).toBe(Math.round(base * 1.25))
})
```

- [ ] **Step 10: テスト実行**

Run: `npm run test`
Expected: PASS

- [ ] **Step 11: コミット**

```bash
git add src/lib/game/shidasu/relics.ts src/lib/game/shidasu/shop.ts src/lib/game/shidasu/engine.ts src/routes/game/shidasu/+page.svelte src/lib/game/shidasu/relics.test.ts src/lib/game/shidasu/shop.test.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 開運こけし(売却価格上乗せ)を実装"
```

---

### Task 5: Waveクリア追加報酬ヘルパー(数珠・千社札・算盤)を実装

**Files:**
- Modify: `src/lib/game/shidasu/relics.ts`
- Modify: `src/lib/game/shidasu/engine.ts:1053-1085`(`resolveWaveEnd`)
- Test: `src/lib/game/shidasu/relics.test.ts`
- Test: `src/lib/game/shidasu/engine.test.ts`

`WaveState`から3種の追加報酬を計算する`relicWaveEndBonus`を実装し、`resolveWaveEnd`の`earned`計算に加算する。算盤の`b`(場札の初期配布枚数)は`wave.dealtRows × params.layout.cols`、`c`(デッキ総枚数)は`run.deckComposition.filter(c => !c.removed).length`、`a`(クリア時点の山札残り枚数)は`wave.stock.length`から算出する。

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/relics.test.ts`に追記:

```ts
describe('relicWaveEndBonus', () => {
  const baseWave = { maxComboThisWave: 0, roleOccurrenceCountThisWave: {}, stock: [], dealtRows: 5 } as unknown as WaveState

  it('レリック無しなら0', () => {
    const run = { relics: [] } as unknown as RunState
    expect(relicWaveEndBonus(DEFAULT_PARAMS, run, baseWave, 40)).toBe(0)
  })

  it('数珠(未付喪化): floor(maxComboThisWave/5)*1', () => {
    const run = { relics: [{ id: 'juzu' as const, tsukumoka: false }] } as unknown as RunState
    const wave = { ...baseWave, maxComboThisWave: 12 } as WaveState
    expect(relicWaveEndBonus(DEFAULT_PARAMS, run, wave, 40)).toBe(2) // floor(12/5)=2, *1
  })

  it('数珠(付喪化): floor(maxComboThisWave/5)*2', () => {
    const run = { relics: [{ id: 'juzu' as const, tsukumoka: true }] } as unknown as RunState
    const wave = { ...baseWave, maxComboThisWave: 12 } as WaveState
    expect(relicWaveEndBonus(DEFAULT_PARAMS, run, wave, 40)).toBe(4) // floor(12/5)=2, *2
  })

  it('千社札(未付喪化): floor(成立役の種類数/2)*1', () => {
    const run = { relics: [{ id: 'senjafuda' as const, tsukumoka: false }] } as unknown as RunState
    const wave = { ...baseWave, roleOccurrenceCountThisWave: { flush: 3, pair: 1, stair: 2 } } as unknown as WaveState
    expect(relicWaveEndBonus(DEFAULT_PARAMS, run, wave, 40)).toBe(1) // 3種類, floor(3/2)=1, *1
  })

  it('千社札(付喪化): n=2に強化', () => {
    const run = { relics: [{ id: 'senjafuda' as const, tsukumoka: true }] } as unknown as RunState
    const wave = { ...baseWave, roleOccurrenceCountThisWave: { flush: 3, pair: 1, stair: 2 } } as unknown as WaveState
    expect(relicWaveEndBonus(DEFAULT_PARAMS, run, wave, 40)).toBe(2) // floor(3/2)=1, *2
  })

  it('算盤(未付喪化): floor(((c-b-a)/(c-b))*5)', () => {
    const run = {
      relics: [{ id: 'soroban' as const, tsukumoka: false }],
      deckComposition: new Array(52).fill(0).map((_, i) => ({ deckId: i, suit: '♠', rank: 1, wild: false, removed: false })),
    } as unknown as RunState
    // b = dealtRows(5) * layout.cols(7) = 35, c = 52, a(stock残り) = 5
    const wave = { ...baseWave, dealtRows: 5, stock: new Array(5).fill(0) } as unknown as WaveState
    // ((52-35-5)/(52-35)) * 5 = (12/17)*5 = 3.529... -> floor = 3
    expect(relicWaveEndBonus(DEFAULT_PARAMS, run, wave, 40)).toBe(3)
  })
})
```

- [ ] **Step 2: テスト実行して失敗確認**

Run: `npm run test -- relics.test.ts`
Expected: FAIL(`relicWaveEndBonus`が未定義)

- [ ] **Step 3: `relics.ts`に実装**

`src/lib/game/shidasu/relics.ts`の末尾に追記(`WaveState`のimportを追加):

```ts
import type { WaveState } from './types'

// Waveクリア時の追加報酬(数珠・千社札・算盤)。所持していないレリックの項は0として扱う。
// baseReward(星のreward)自体はこの関数の戻り値に含まない(呼び出し元resolveWaveEndで別途加算する)。
export function relicWaveEndBonus(params: ShidasuParams, run: RunState, wave: WaveState, _baseReward: number): number {
  let bonus = 0

  const juzuRelic = run.relics.find(r => r.id === 'juzu')
  if (juzuRelic) {
    const n = juzuRelic.tsukumoka ? params.relics.juzu.tsukumokaN : params.relics.juzu.n
    bonus += Math.floor(wave.maxComboThisWave / 5) * n
  }

  const senjafudaRelic = run.relics.find(r => r.id === 'senjafuda')
  if (senjafudaRelic) {
    const roleTypeCount = Object.values(wave.roleOccurrenceCountThisWave).filter(count => (count ?? 0) > 0).length
    const n = senjafudaRelic.tsukumoka ? 2 : params.relics.senjafuda.n
    bonus += Math.floor(roleTypeCount / 2) * n
  }

  const sorobanRelic = run.relics.find(r => r.id === 'soroban')
  if (sorobanRelic) {
    const a = wave.stock.length
    const b = wave.dealtRows * params.layout.cols
    const c = run.deckComposition.filter(card => !card.removed).length
    const denominator = c - b
    if (denominator > 0) {
      const n = sorobanRelic.tsukumoka ? 10 : params.relics.soroban.n
      bonus += Math.floor(((c - b - a) / denominator) * n)
    }
  }

  return bonus
}
```

- [ ] **Step 4: テスト実行して成功確認**

Run: `npm run test -- relics.test.ts`
Expected: PASS

- [ ] **Step 5: `resolveWaveEnd`に組み込み**

`src/lib/game/shidasu/engine.ts`冒頭のimportに`relicWaveEndBonus`を追加。

`src/lib/game/shidasu/engine.ts:1064-1065`を置き換える:

```ts
  const currentStar = run.stageStars[run.waveIndex]
  const baseEarned = currentStar?.reward ?? 0
  const earned = baseEarned + relicWaveEndBonus(params, run, wave, baseEarned)
```

- [ ] **Step 6: 型チェック**

Run: `npm run check`
Expected: PASS

- [ ] **Step 7: `resolveWaveEnd`の統合テストを追加**

`src/lib/game/shidasu/engine.test.ts`に追記:

```ts
describe('resolveWaveEnd: レリックによる追加報酬', () => {
  it('数珠所持時、星のrewardに追加報酬が加算される', () => {
    const params = DEFAULT_PARAMS
    let run = createInitialRun(params)
    // 既存のresolveWaveEndテストと同じ手順でrun.waveをstatus:'ended'かつscore>=targetにし、
    // run.relicsに数珠を追加したうえでmaxComboThisWaveを設定してから呼び出す
    run = { ...run, relics: [{ id: 'juzu', tsukumoka: false }] }
    // (以下、既存のresolveWaveEndテストのセットアップパターンをそのまま踏襲して
    //  wave.maxComboThisWave=10, wave.status='ended', wave.score>=targetにした状態を作り、
    //  resolveWaveEndを呼んでrun.currencyが「星のreward + floor(10/5)*1」だけ増えていることを検証する)
  })
})
```

**実装者への注記:** 上記テストのセットアップは既存の`resolveWaveEnd`関連テスト(`engine.test.ts`内で`describe('resolveWaveEnd'`を検索)の記述パターンをそのまま踏襲すること(`startWave`でwaveを生成し、スコアをtargetまで到達させ、`wave.status = 'ended'`にしてから呼ぶ、という既存の型がある)。プレースホルダーではなく、実際に動くテストコードとして完成させること。

- [ ] **Step 8: テスト実行**

Run: `npm run test`
Expected: PASS

- [ ] **Step 9: コミット**

```bash
git add src/lib/game/shidasu/relics.ts src/lib/game/shidasu/engine.ts src/lib/game/shidasu/relics.test.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: Waveクリア追加報酬(数珠・千社札・算盤)を実装"
```

---

### Task 6: ショップ枠数ヘルパー(熊手・福笹・縁起小槌)を実装

**Files:**
- Modify: `src/lib/game/shidasu/relics.ts`
- Modify: `src/lib/game/shidasu/shop.ts`
- Test: `src/lib/game/shidasu/relics.test.ts`
- Test: `src/lib/game/shidasu/shop.test.ts`

熊手(バラ売り+n、付喪化で福袋も+n)・福笹(福袋+n、付喪化でバラ売りも+n)・縁起小槌(福袋オファー数+n、付喪化でさらに+n)の3つを実装する。熊手と福笹は同時所持もありうるため、両方の加算を合算する。

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/relics.test.ts`に追記:

```ts
describe('ショップ枠数ヘルパー', () => {
  it('individualSlotCount: レリック無しなら3', () => {
    const run = { relics: [] } as unknown as RunState
    expect(individualSlotCount(DEFAULT_PARAMS, run)).toBe(3)
  })
  it('individualSlotCount: 熊手(未付喪化)で3+1', () => {
    const run = { relics: [{ id: 'kumade' as const, tsukumoka: false }] } as unknown as RunState
    expect(individualSlotCount(DEFAULT_PARAMS, run)).toBe(4)
  })
  it('individualSlotCount: 福笹(付喪化)で3+1', () => {
    const run = { relics: [{ id: 'fukuzasa' as const, tsukumoka: true }] } as unknown as RunState
    expect(individualSlotCount(DEFAULT_PARAMS, run)).toBe(4)
  })
  it('individualSlotCount: 熊手+福笹(付喪化)両方で3+1+1', () => {
    const run = { relics: [{ id: 'kumade' as const, tsukumoka: false }, { id: 'fukuzasa' as const, tsukumoka: true }] } as unknown as RunState
    expect(individualSlotCount(DEFAULT_PARAMS, run)).toBe(5)
  })
  it('packSlotCount: レリック無しなら2', () => {
    const run = { relics: [] } as unknown as RunState
    expect(packSlotCount(DEFAULT_PARAMS, run)).toBe(2)
  })
  it('packSlotCount: 福笹(未付喪化)で2+1', () => {
    const run = { relics: [{ id: 'fukuzasa' as const, tsukumoka: false }] } as unknown as RunState
    expect(packSlotCount(DEFAULT_PARAMS, run)).toBe(3)
  })
  it('packSlotCount: 熊手(付喪化)で2+1', () => {
    const run = { relics: [{ id: 'kumade' as const, tsukumoka: true }] } as unknown as RunState
    expect(packSlotCount(DEFAULT_PARAMS, run)).toBe(3)
  })
  it('packOfferCountBonus: 縁起小槌(未付喪化)で+1', () => {
    const run = { relics: [{ id: 'engi-kozuchi' as const, tsukumoka: false }] } as unknown as RunState
    expect(packOfferCountBonus(DEFAULT_PARAMS, run)).toBe(1)
  })
  it('packOfferCountBonus: 縁起小槌(付喪化)で+2', () => {
    const run = { relics: [{ id: 'engi-kozuchi' as const, tsukumoka: true }] } as unknown as RunState
    expect(packOfferCountBonus(DEFAULT_PARAMS, run)).toBe(2)
  })
})
```

- [ ] **Step 2: テスト実行して失敗確認**

Run: `npm run test -- relics.test.ts`
Expected: FAIL

- [ ] **Step 3: `relics.ts`に実装**

```ts
// バラ売り枠の総数(基本値3)。熊手所持でn(付喪化でも同じn、効果ではなく対象が増える設計のため
// individualSlotCountとしては+nのみ)、福笹(付喪化)所持でさらに+n。
export function individualSlotCount(params: ShidasuParams, run: RunState): number {
  let count = 3
  const kumadeRelic = run.relics.find(r => r.id === 'kumade')
  if (kumadeRelic) count += params.relics.kumade.n
  const fukuzasaRelic = run.relics.find(r => r.id === 'fukuzasa')
  if (fukuzasaRelic?.tsukumoka) count += params.relics.fukuzasa.n
  return count
}

// 福袋枠の総数(基本値2)。福笹所持でn、熊手(付喪化)所持でさらにn。
export function packSlotCount(params: ShidasuParams, run: RunState): number {
  let count = 2
  const fukuzasaRelic = run.relics.find(r => r.id === 'fukuzasa')
  if (fukuzasaRelic) count += params.relics.fukuzasa.n
  const kumadeRelic = run.relics.find(r => r.id === 'kumade')
  if (kumadeRelic?.tsukumoka) count += params.relics.kumade.n
  return count
}

// 福袋の選択肢数(offerCount)への加算値。縁起小槌所持時n(付喪化ならさらにtsukumokaN)。
export function packOfferCountBonus(params: ShidasuParams, run: RunState): number {
  const r = params.relics['engi-kozuchi']
  return relicBonus(run, 'engi-kozuchi', r.n, r.tsukumokaN)
}
```

- [ ] **Step 4: テスト実行して成功確認**

Run: `npm run test -- relics.test.ts`
Expected: PASS

- [ ] **Step 5: `shop.ts`の`rollShop`を可変枠数対応に更新**

importに`individualSlotCount, packSlotCount, packOfferCountBonus`を追加。

`src/lib/game/shidasu/shop.ts:54-62`の`rollShop`を置き換える:

```ts
export function rollShop(params: ShidasuParams, run: RunState, rand: () => number = Math.random): ShopState {
  const usedItemIds = new Set<ItemId>()
  const individualCount = individualSlotCount(params, run)
  const individual: ShopIndividualSlot[] = Array.from({ length: individualCount }, () => rollIndividualSlot(run, usedItemIds, rand))
  return { individual, packs: rollPackSlots(params, run, rand), relic: rollRelicSlots(params, run, rand) }
}
```

(`rollRelicSlots`はTask 7で複数形に変更する。このステップ時点では暫定的に既存の`rollRelicSlot`を`[rollRelicSlot(run, rand)].filter((s): s is NonNullable<typeof s> => s !== null)`のようにラップして`relic?: {...}|null`のままにしてよい。Task 7で正式に配列型へ移行する。)

`src/lib/game/shidasu/shop.ts:39-43`の`rollPackSlots`(Task2で更新済み)をさらに更新し、`slice(0, 2)`を`slice(0, packSlotCount(params, run))`に、`offerCount: e.offerCount`を`offerCount: e.offerCount + packOfferCountBonus(params, run)`に変更する:

```ts
function rollPackSlots(params: ShidasuParams, run: RunState, rand: () => number): ShopPackSlot[] {
  const entries = [...params.shop.packCatalog]
  shuffleInPlace(entries, rand)
  const multiplier = relicPriceMultiplier(params, run)
  const offerBonus = packOfferCountBonus(params, run)
  return entries.slice(0, packSlotCount(params, run)).map(e => ({ packKind: e.packKind, offerCount: e.offerCount + offerBonus, pickCount: e.pickCount, name: e.name, price: Math.round(e.price * multiplier), sold: false }))
}
```

- [ ] **Step 6: 型チェック**

Run: `npm run check`
Expected: PASS

- [ ] **Step 7: 新規テストを追加**

`src/lib/game/shidasu/shop.test.ts`に追記:

```ts
it('熊手所持時、バラ売り枠が4枠になる', () => {
  const params = DEFAULT_PARAMS
  const run = { ...someBaseRunState, relics: [{ id: 'kumade' as const, tsukumoka: false }] }
  const shop = rollShop(params, run, () => 0.5)
  expect(shop.individual).toHaveLength(4)
})

it('福笹所持時、福袋枠が3枠になる', () => {
  const params = DEFAULT_PARAMS
  const run = { ...someBaseRunState, relics: [{ id: 'fukuzasa' as const, tsukumoka: false }] }
  const shop = rollShop(params, run, () => 0.5)
  expect(shop.packs).toHaveLength(3)
})

it('縁起小槌所持時、福袋のofferCountが+1される', () => {
  const params = DEFAULT_PARAMS
  const run = { ...someBaseRunState, relics: [{ id: 'engi-kozuchi' as const, tsukumoka: false }] }
  const shop = rollShop(params, run, () => 0.5)
  for (const pack of shop.packs) {
    const catalogEntry = params.shop.packCatalog.find(e => e.name === pack.name)!
    expect(pack.offerCount).toBe(catalogEntry.offerCount + 1)
  }
})
```

- [ ] **Step 8: テスト実行**

Run: `npm run test`
Expected: PASS

- [ ] **Step 9: コミット**

```bash
git add src/lib/game/shidasu/relics.ts src/lib/game/shidasu/shop.ts src/lib/game/shidasu/relics.test.ts src/lib/game/shidasu/shop.test.ts
git commit -m "feat: ショップ枠数の拡張(熊手・福笹・縁起小槌)を実装"
```

---

### Task 7: 縁起鈴(レリック専用枠の複数化)を実装 — `ShopState.relic`の配列化

**Files:**
- Modify: `src/lib/game/shidasu/types.ts:324-333`
- Modify: `src/lib/game/shidasu/relics.ts`
- Modify: `src/lib/game/shidasu/shop.ts`
- Modify: `src/lib/game/shidasu/engine.ts`(`buyRelic`)
- Modify: `src/routes/game/shidasu/+page.svelte`
- Test: `src/lib/game/shidasu/shop.test.ts`
- Test: `src/lib/game/shidasu/engine.test.ts`

specの技術メモ通り、`ShopState.relic`を単一の`{id, sold}|null`から`{id, sold}[]`に変更する。既存のオプショナル設計思想(無関係テストへの影響回避)は維持しつつ、型を配列にする。

- [ ] **Step 1: `types.ts`の`ShopState.relic`を配列型に変更**

`src/lib/game/shidasu/types.ts:324-333`を置き換える:

```ts
export interface ShopState {
  individual: ShopIndividualSlot[]
  packs: ShopPackSlot[]
  // レリック専用枠。既存のバラ売り3枠(individual)・福袋2枠(packs)とは別に、ショップ訪問のたびに
  // 未所持のレリックから抽選する(基本1枠、縁起鈴所持時は複数枠)。配列が空なら枠自体を非表示にする。
  // オプショナルにしているのは、ShopStateをリテラルで直接組み立てている既存テスト(レリックと無関係な
  // 護符・秘儀・天啓・神託・福袋のテスト)を変更せずに済ませるため。本番コードでShopStateを生成する
  // 唯一の経路であるrollShopは必ずこのフィールドを設定する
  relic?: { id: RelicId; sold: boolean }[]
}
```

- [ ] **Step 2: `relics.ts`に縁起鈴のスロット数ヘルパーを追加**

```ts
// レリック専用枠の提示数(基本1枠)。縁起鈴所持時n(付喪化ならさらにtsukumokaN)を加算する。
export function relicSlotCount(params: ShidasuParams, run: RunState): number {
  const r = params.relics['engi-suzu']
  return 1 + relicBonus(run, 'engi-suzu', r.n, r.tsukumokaN)
}
```

- [ ] **Step 3: `shop.ts`の`rollRelicSlot`を`rollRelicSlots`(複数形)に変更**

`src/lib/game/shidasu/shop.ts:45-52`を置き換える:

```ts
// 未所持のレリックから、relicSlotCount枠ぶんランダムに選ぶ(重複無し)。候補が枠数に満たなければ
// 候補の数だけ返す(全種所持済みなら空配列。ショップ画面で枠自体を非表示にする)。
function rollRelicSlots(params: ShidasuParams, run: RunState, rand: () => number): { id: RelicId; sold: boolean }[] {
  const ownedIds = new Set(run.relics.map(r => r.id))
  const available = RELIC_POOL.filter(id => !ownedIds.has(id))
  shuffleInPlace(available, rand)
  const count = relicSlotCount(params, run)
  return available.slice(0, count).map(id => ({ id, sold: false }))
}
```

importに`relicSlotCount`を追加する。

`rollShop`(Task6で更新済み)の`relic: rollRelicSlots(params, run, rand)`呼び出しを、Task6の暫定ラップ実装から正式な複数形呼び出しに整理する:

```ts
export function rollShop(params: ShidasuParams, run: RunState, rand: () => number = Math.random): ShopState {
  const usedItemIds = new Set<ItemId>()
  const individual: ShopIndividualSlot[] = Array.from({ length: individualSlotCount(params, run) }, () => rollIndividualSlot(run, usedItemIds, rand))
  return { individual, packs: rollPackSlots(params, run, rand), relic: rollRelicSlots(params, run, rand) }
}
```

- [ ] **Step 4: `engine.ts`の`buyRelic`を配列インデックス対応に更新**

`src/lib/game/shidasu/engine.ts:1215-1228`の`buyRelic`を置き換える(`slotIndex`引数を追加):

```ts
// レリックを1つ購入する。ショップのレリック専用枠(run.shop.relic配列)からslotIndex番目を購入する。
// 売り切れ済み・枠が無い・通貨不足のいずれかならno-op
export function buyRelic(params: ShidasuParams, run: RunState, slotIndex: number): RunState {
  if (run.phase !== 'shop' || !run.shop || !run.shop.relic) return run
  const slot = run.shop.relic[slotIndex]
  if (!slot || slot.sold) return run
  const price = relicBuyPrice(params, run, slot.id)
  if (run.currency < price) return run
  const relic = run.shop.relic.map((s, i) => (i === slotIndex ? { ...s, sold: true } : s))
  return {
    ...run,
    currency: run.currency - price,
    relics: [...run.relics, { id: slot.id, tsukumoka: false }],
    shop: { ...run.shop, relic },
  }
}
```

- [ ] **Step 5: `+page.svelte`のレリック関連UIを配列対応に更新**

`handleBuyRelic`(+page.svelte:242付近)を`slotIndex`引数対応に更新:

```ts
function handleBuyRelic(slotIndex: number) {
  run = buyRelic(params, run, slotIndex)
}
```

`{#if run.shop.relic}`(+page.svelte:822付近)を`{#if run.shop.relic && run.shop.relic.length > 0}`に変え、単一表示だったブロックを`{#each run.shop.relic as slot, i (i)}`でループするように変更する。既存の`run.shop.relic.id`/`run.shop.relic.sold`参照を`slot.id`/`slot.sold`に、`handleBuyRelic()`呼び出しを`handleBuyRelic(i)`に、`relicBuyPrice(params, run.shop.relic.id)`を`relicBuyPrice(params, run, slot.id)`に置き換える。

- [ ] **Step 6: 型チェック**

Run: `npm run check`
Expected: PASS(既存の`run.shop.relic.id`のような単数アクセスが残っていればエラーになるので全て洗い出して修正する)

- [ ] **Step 7: 既存テストを更新**

`shop.test.ts`・`engine.test.ts`内で`shop.relic`を単一オブジェクトとして扱っていたテスト(Task1の`placeholder`→実IDへの置換時に触れた箇所含む)を配列アクセスに更新する。`buyRelic`呼び出しに`slotIndex`引数(既存は`0`固定でよい)を追加する。

- [ ] **Step 8: 新規テストを追加**

`src/lib/game/shidasu/shop.test.ts`に追記:

```ts
it('縁起鈴所持時、レリック専用枠が2枠になる', () => {
  const params = DEFAULT_PARAMS
  const run = { ...someBaseRunState, relics: [{ id: 'engi-suzu' as const, tsukumoka: false }] }
  const shop = rollShop(params, run, () => 0.1)
  expect(shop.relic).toHaveLength(2)
})

it('縁起鈴(付喪化)所持時、レリック専用枠が3枠になる', () => {
  const params = DEFAULT_PARAMS
  const run = { ...someBaseRunState, relics: [{ id: 'engi-suzu' as const, tsukumoka: true }] }
  const shop = rollShop(params, run, () => 0.1)
  expect(shop.relic).toHaveLength(3)
})

it('レリック専用枠は所持レリックと重複しない', () => {
  const params = DEFAULT_PARAMS
  const run = { ...someBaseRunState, relics: [{ id: 'maneki-neko' as const, tsukumoka: false }, { id: 'kumade' as const, tsukumoka: false }] }
  const shop = rollShop(params, run, () => 0.1)
  const relicIds = (shop.relic ?? []).map(s => s.id)
  expect(relicIds).not.toContain('maneki-neko')
  expect(relicIds).not.toContain('kumade')
})
```

`src/lib/game/shidasu/engine.test.ts`に追記:

```ts
describe('buyRelic(配列スロット対応)', () => {
  it('slotIndexで指定した枠のレリックを購入できる', () => {
    const params = DEFAULT_PARAMS
    let run = createInitialRun(params)
    run = { ...run, phase: 'shop', currency: 9999, shop: { individual: [], packs: [], relic: [{ id: 'maneki-neko', sold: false }, { id: 'kumade', sold: false }] } }
    run = buyRelic(params, run, 1)
    expect(run.relics).toEqual([{ id: 'kumade', tsukumoka: false }])
    expect(run.shop!.relic![1].sold).toBe(true)
    expect(run.shop!.relic![0].sold).toBe(false)
  })
})
```

- [ ] **Step 9: テスト実行**

Run: `npm run test`
Expected: PASS

- [ ] **Step 10: 手動UI確認**

Run: `npm run dev`

`http://localhost:5173/game/shidasu`を開き、ショップ画面でレリック枠が表示され購入できることを確認する(縁起鈴自体は他タスクで初めて出現するため、この時点ではまだ1枠のみの見た目でよい)。

- [ ] **Step 11: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/relics.ts src/lib/game/shidasu/shop.ts src/lib/game/shidasu/engine.ts src/routes/game/shidasu/+page.svelte src/lib/game/shidasu/shop.test.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 縁起鈴(レリック専用枠の複数化)を実装、ShopState.relicを配列化"
```

---

### Task 8: 福だるま(リロールコスト減少+初回無料)を実装

**Files:**
- Modify: `src/lib/game/shidasu/relics.ts`
- Modify: `src/lib/game/shidasu/engine.ts`(`shopRerollCost`・`rerollShop`)
- Test: `src/lib/game/shidasu/relics.test.ts`
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/relics.test.ts`に追記:

```ts
describe('relicRerollCostStep(福だるま)', () => {
  it('所持していなければparams.shop.rerollCostStepそのまま', () => {
    const run = { relics: [] } as unknown as RunState
    expect(relicRerollCostStep(DEFAULT_PARAMS, run)).toBe(DEFAULT_PARAMS.shop.rerollCostStep)
  })
  it('福だるま所持時はn減る(0未満にはならない)', () => {
    const run = { relics: [{ id: 'fuku-daruma' as const, tsukumoka: false }] } as unknown as RunState
    expect(relicRerollCostStep(DEFAULT_PARAMS, run)).toBe(Math.max(0, DEFAULT_PARAMS.shop.rerollCostStep - DEFAULT_PARAMS.relics['fuku-daruma'].n))
  })
})

describe('relicFirstRerollFree(福だるま付喪化)', () => {
  it('未付喪化なら常にfalse', () => {
    const run = { relics: [{ id: 'fuku-daruma' as const, tsukumoka: false }] } as unknown as RunState
    expect(relicFirstRerollFree(run)).toBe(false)
  })
  it('付喪化済みならtrue', () => {
    const run = { relics: [{ id: 'fuku-daruma' as const, tsukumoka: true }] } as unknown as RunState
    expect(relicFirstRerollFree(run)).toBe(true)
  })
})
```

- [ ] **Step 2: テスト実行して失敗確認**

Run: `npm run test -- relics.test.ts`
Expected: FAIL

- [ ] **Step 3: `relics.ts`に実装**

```ts
// ショップリロールコストの刻み幅。福だるま所持時、params.shop.rerollCostStepからnを減らす(0未満にはしない)。
export function relicRerollCostStep(params: ShidasuParams, run: RunState): number {
  const relic = run.relics.find(r => r.id === 'fuku-daruma')
  if (!relic) return params.shop.rerollCostStep
  return Math.max(0, params.shop.rerollCostStep - params.relics['fuku-daruma'].n)
}

// 福だるま(付喪化)所持時、同一ショップ訪問中の最初の1回のリロールが無料になるか。
export function relicFirstRerollFree(run: RunState): boolean {
  const relic = run.relics.find(r => r.id === 'fuku-daruma')
  return relic?.tsukumoka ?? false
}
```

- [ ] **Step 4: テスト実行して成功確認**

Run: `npm run test -- relics.test.ts`
Expected: PASS

- [ ] **Step 5: `engine.ts`の`shopRerollCost`・`rerollShop`を更新**

importに`relicRerollCostStep, relicFirstRerollFree`を追加。

`src/lib/game/shidasu/engine.ts:1174-1176`を置き換える:

```ts
// リロール回数(shopRerollCount)に応じて回数ごとにrerollCostStep分ずつ増額する
// (1回目はrerollCostStep、2回目は2倍、3回目は3倍…)。福だるま所持時はrerollCostStep自体が減少し、
// 付喪化済みなら同一ショップ訪問中の最初の1回(shopRerollCount===0)は無料になる。
export function shopRerollCost(params: ShidasuParams, run: RunState): number {
  if (run.shopRerollCount === 0 && relicFirstRerollFree(run)) return 0
  return (run.shopRerollCount + 1) * relicRerollCostStep(params, run)
}
```

`rerollShop`(engine.ts:1182-1187)は`shopRerollCost(params, run)`を呼んでいるだけなので変更不要。

- [ ] **Step 6: 型チェック**

Run: `npm run check`
Expected: PASS

- [ ] **Step 7: 新規テストを追加**

`src/lib/game/shidasu/engine.test.ts`に追記:

```ts
describe('shopRerollCost: 福だるま', () => {
  it('福だるま所持時、コストがn減る', () => {
    const params = DEFAULT_PARAMS
    let run = createInitialRun(params)
    run = { ...run, relics: [{ id: 'fuku-daruma', tsukumoka: false }], shopRerollCount: 0 }
    const expectedStep = params.shop.rerollCostStep - params.relics['fuku-daruma'].n
    expect(shopRerollCost(params, run)).toBe(expectedStep)
  })

  it('福だるま(付喪化)所持時、最初の1回は無料', () => {
    const params = DEFAULT_PARAMS
    let run = createInitialRun(params)
    run = { ...run, relics: [{ id: 'fuku-daruma', tsukumoka: true }], shopRerollCount: 0 }
    expect(shopRerollCost(params, run)).toBe(0)
  })

  it('福だるま(付喪化)所持時、2回目以降は通常通り課金される', () => {
    const params = DEFAULT_PARAMS
    let run = createInitialRun(params)
    run = { ...run, relics: [{ id: 'fuku-daruma', tsukumoka: true }], shopRerollCount: 1 }
    const expectedStep = params.shop.rerollCostStep - params.relics['fuku-daruma'].n
    expect(shopRerollCost(params, run)).toBe(2 * expectedStep)
  })
})
```

- [ ] **Step 8: テスト実行**

Run: `npm run test`
Expected: PASS

- [ ] **Step 9: コミット**

```bash
git add src/lib/game/shidasu/relics.ts src/lib/game/shidasu/engine.ts src/lib/game/shidasu/relics.test.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 福だるま(リロールコスト減少・初回無料)を実装"
```

---

### Task 9: `+page.svelte`の招き猫・開運こけし・所持上限系の表示反映を最終確認

**Files:**
- Modify: `src/routes/game/shidasu/+page.svelte`

Task2〜8で価格関数・上限関数のシグネチャは既に更新済みだが、UI側で「所持上限に達しているためボタンをdisabledにする」判定が`params.items.maxItems`等をハードコードで直接参照している箇所が残っていないか最終確認する。

- [ ] **Step 1: ハードコード残存箇所を検索**

`Grep`で`+page.svelte`内の`params.items.maxItems`・`.length >= 3`・`.length + run.oracles.length >= 2`を検索する。

- [ ] **Step 2: 見つかった箇所を動的ヘルパーに置き換え**

`itemMaxCapacity(params, run)`・`riteMaxCapacity(params, run)`・`revelationOracleMaxCapacity(params, run)`のimportを追加し、該当箇所を置き換える。

- [ ] **Step 3: 型チェック**

Run: `npm run check`
Expected: PASS

- [ ] **Step 4: ビルド確認**

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: 開発サーバーで動作確認**

Run: `npm run dev`

`http://localhost:5173/game/shidasu`を開き、デバッグ画面(`/admin/shidasu-debug`)等でレリックを付与し(付与手段が無ければ`/admin/shidasu-debug`のRunState直接編集、または一時的にコンソールで`run.relics`を書き換えるなどして)、以下を目視確認する:
- ショップの護符・秘儀・天啓・神託・レリックの価格が招き猫所持時に下がって表示される
- 護符・秘儀・天啓・神託の所持上限に達したとき、対応するレリック(招き布袋像・破魔矢・千羽鶴)所持で購入可能枠が増えている

- [ ] **Step 6: コミット(変更があれば)**

```bash
git add src/routes/game/shidasu/+page.svelte
git commit -m "fix: 所持上限UIのハードコード箇所を動的ヘルパーに統一"
```

(変更が無ければこのタスクはコミット無しで完了とする。)

---

### Task 10: `/admin/shidasu-relics`管理画面を新設

**Files:**
- Create: `src/routes/admin/shidasu-relics/+page.svelte`
- Modify: `src/routes/admin/+page.svelte`

`src/routes/admin/shidasu-rites/+page.svelte`のパターン(`RiteEntry`型でname/desc以外の数値キーを動的に列挙し、`<input type="number">`で編集)を踏襲する。レリックは護符ごとにパラメータのキー構成が異なる(招き猫は`discountPercent`/`tsukumokaDiscountPercent`、数珠は`n`/`tsukumokaN`など)ため、`riteParamKeys`と同じ「name/desc/tsukumokaDesc/price以外のキーを動的列挙する」方式をそのまま使う。

- [ ] **Step 1: `src/routes/admin/shidasu-relics/+page.svelte`を新規作成**

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { DEFAULT_PARAMS, type ShidasuParams } from '$lib/game/shidasu/params'
  import { RELIC_POOL } from '$lib/game/shidasu/relics'
  import type { RelicId } from '$lib/game/shidasu/types'

  let config = $state<ShidasuParams | null>(null)
  let error = $state<string | null>(null)
  let flash = $state<string | null>(null)
  let flashTimer: ReturnType<typeof setTimeout> | null = null

  function showToast(message: string) {
    if (flashTimer) clearTimeout(flashTimer)
    flash = message
    flashTimer = setTimeout(() => { flash = null }, 2000)
  }

  type RelicEntry = { name: string; desc: string; tsukumokaDesc: string; price: number } & Record<string, number | string>

  function relicEntry(id: RelicId): RelicEntry {
    return config!.relics[id] as unknown as RelicEntry
  }

  function relicParamKeys(id: RelicId): string[] {
    const fixedKeys = new Set(['name', 'desc', 'tsukumokaDesc', 'price'])
    return Object.keys(relicEntry(id)).filter(key => !fixedKeys.has(key))
  }

  let hasValidationError = $derived.by(() => {
    if (!config) return false
    return RELIC_POOL.some(id => {
      const entry = relicEntry(id)
      if (!entry.name.trim()) return true
      if (!entry.desc.trim()) return true
      if (!entry.tsukumokaDesc.trim()) return true
      if (!Number.isFinite(entry.price)) return true
      return relicParamKeys(id).some(key => !Number.isFinite(entry[key] as number))
    })
  })

  async function loadConfig(toast = false) {
    try {
      const res = await fetch('/api/admin/shidasu-config')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      config = await res.json() as ShidasuParams
      error = null
      if (toast) showToast('リロードしました')
    } catch {
      error = 'Shidasu設定APIに接続できません。npm run dev で起動してください。'
      if (!config) config = JSON.parse(JSON.stringify(DEFAULT_PARAMS))
    }
  }

  async function save() {
    if (!config) return
    try {
      const res = await fetch('/api/admin/shidasu-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      showToast('保存しました(反映には再ビルド・再デプロイが必要です)')
    } catch {
      error = '保存に失敗しました'
    }
  }

  onMount(() => loadConfig())
  onDestroy(() => {
    if (flashTimer) clearTimeout(flashTimer)
  })
</script>

<svelte:head>
  <title>Shidasu レリックパラメータ設定</title>
</svelte:head>

<div class="max-w-6xl mx-auto px-4 py-8">
  <a href="/admin" class="text-xs text-slate-400 hover:text-teal-600 mb-4 inline-block">← 管理ページ一覧</a>

  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold text-slate-800">星詠みソリティア -Shidasu- レリックパラメータ設定</h1>
    <div class="flex gap-2">
      <button onclick={() => loadConfig(true)} class="text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
        リロード
      </button>
      {#if hasValidationError}
        <p class="text-xs text-red-600 self-center">名前・説明文・価格・パラメータが未入力の項目があります</p>
      {/if}
      <button
        onclick={save}
        disabled={hasValidationError || !config}
        class="text-sm px-3 py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        保存
      </button>
    </div>
  </div>

  {#if error}
    <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
  {/if}

  {#if config}
    <section class="bg-white border border-slate-200 rounded-xl p-4">
      <div class="overflow-x-auto">
        <table class="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
          <thead>
            <tr class="bg-slate-50 text-slate-500">
              <th class="px-2 py-1.5 text-left" style="width:8rem;">名前</th>
              <th class="px-2 py-1.5 text-left" style="width:6rem;">価格</th>
              <th class="px-2 py-1.5 text-left" style="width:12rem;">パラメータ</th>
              <th class="px-2 py-1.5 text-left" style="width:18rem;">効果説明文(未付喪化)</th>
              <th class="px-2 py-1.5 text-left" style="width:18rem;">効果説明文(付喪化後)</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            {#each RELIC_POOL as id (id)}
              {@const entry = relicEntry(id)}
              <tr>
                <td class="px-2 py-1.5 align-top">
                  <input type="text" bind:value={entry.name} class="w-full border border-slate-200 rounded px-1.5 py-0.5" />
                </td>
                <td class="px-2 py-1.5 align-top">
                  <input type="number" step="1" bind:value={entry.price} class="w-full border border-slate-200 rounded px-1 py-0.5" />
                </td>
                <td class="px-2 py-1.5 align-top">
                  <div class="flex flex-wrap gap-1.5">
                    {#each relicParamKeys(id) as key (key)}
                      <label class="flex items-center gap-1 text-[11px] text-slate-500">
                        {key}
                        <input type="number" step="any" bind:value={entry[key]} class="w-16 border border-slate-200 rounded px-1 py-0.5" />
                      </label>
                    {/each}
                    {#if relicParamKeys(id).length === 0}
                      <span class="text-slate-300">-</span>
                    {/if}
                  </div>
                </td>
                <td class="px-2 py-1.5 align-top">
                  <textarea bind:value={entry.desc} rows="3" class="w-full border border-slate-200 rounded px-1.5 py-0.5 font-mono text-[11px] resize-y"></textarea>
                </td>
                <td class="px-2 py-1.5 align-top">
                  <textarea bind:value={entry.tsukumokaDesc} rows="3" class="w-full border border-slate-200 rounded px-1.5 py-0.5 font-mono text-[11px] resize-y"></textarea>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  {:else if !error}
    <p class="text-slate-500 text-sm">読み込み中...</p>
  {/if}
</div>

{#if flash}
  <div class="fixed bottom-6 right-6 bg-slate-800 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-50">
    {flash}
  </div>
{/if}
```

- [ ] **Step 2: `src/routes/admin/+page.svelte`にリンクを追加**

`src/routes/admin/+page.svelte:79-85`(`shidasu-packs`リンクの直後)に追記:

```svelte
    <a href="/admin/shidasu-relics" class="flex items-center gap-3 px-4 py-4 hover:bg-slate-50 transition-colors group">
      <div class="flex-1">
        <p class="text-sm font-semibold text-slate-700 group-hover:text-teal-700">星詠みソリティア -Shidasu- レリックパラメータ設定</p>
        <p class="text-xs text-slate-400 mt-0.5">レリックごとの名前・価格・数値パラメータ・効果説明文(付喪化前後)を1行ずつ編集</p>
      </div>
      <span class="text-slate-300 group-hover:text-teal-600 transition-colors">→</span>
    </a>
```

- [ ] **Step 3: 型チェックとビルド**

Run: `npm run check`
Expected: PASS

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: 開発サーバーで動作確認**

Run: `npm run dev`

`http://localhost:5173/admin/shidasu-relics`を開き、13候補全てが1行ずつ表示され、パラメータ編集・保存ができることを確認する。`http://localhost:5173/admin`からもリンクをたどれることを確認する。

- [ ] **Step 5: コミット**

```bash
git add src/routes/admin/shidasu-relics/+page.svelte src/routes/admin/+page.svelte
git commit -m "feat: /admin/shidasu-relics管理画面を新設"
```

---

### Task 11: ドキュメント更新と最終確認

**Files:**
- Modify: `docs/shidasu/shidasu-roadmap.md`
- Move: `docs/superpowers/specs/2026-08-12-shidasu-relic-candidates-design.md` → `docs/shidasu/done/shidasu-relic-candidates.md`(既存の運用パターン、例: `shidasu-rite-redesign-candidates.md`・`shidasu-gofu-candidates.md`に合わせ、日付無しの`shidasu-<topic>-candidates.md`形式にリネームする)

- [ ] **Step 1: roadmap.md項目5を更新**

`docs/shidasu/shidasu-roadmap.md`を読み、項目5「レリックの実装」のセクションに、個別13候補の実装が完了したことを追記する(既存の「システム実装済み・個別候補は未着手」という記述を「個別候補13種を実装済み」に更新する)。

- [ ] **Step 2: specファイルをdone/へ移動**

```bash
git mv docs/superpowers/specs/2026-08-12-shidasu-relic-candidates-design.md docs/shidasu/done/shidasu-relic-candidates.md
```

- [ ] **Step 3: 全体ビルド・型チェック・テストの最終確認**

Run: `npm run build`
Expected: PASS

Run: `npm run check`
Expected: PASS

Run: `npm run test`
Expected: PASS(全テストグリーン)

- [ ] **Step 4: 開発サーバーでの最終通し確認**

Run: `npm run dev`

`http://localhost:5173/game/shidasu`でラン開始からショップ突入までプレイし、以下を確認する:
- レリック専用枠が表示され購入できる
- 所持レリックバッジが表示され、ツールチップに説明文が出る
- ショップ・常設UIともにレイアウト崩れが無い

- [ ] **Step 5: コミット**

```bash
git add docs/shidasu/shidasu-roadmap.md docs/shidasu/done/shidasu-relic-candidates.md
git commit -m "docs: レリック個別候補13種の実装完了をroadmapへ反映、specをdone/へ移動"
```

---

## Self-Review メモ(執筆時点で実施済み)

- **spec網羅性:** 採用13候補すべてにタスクが対応している(招き猫→Task2、福だるま→Task8、熊手→Task6/7、数珠→Task5、招き布袋像・破魔矢・千羽鶴→Task3、福笹→Task6、開運こけし→Task4、縁起小槌→Task6、縁起鈴→Task7、千社札・算盤→Task5)。admin画面新設(spec記載の技術メモ)→Task10。所持上限のハードコード解消→Task3・Task9。
- **型の一貫性:** `RelicId`(Task1)→全タスクで同じ13個のkebab-caseリテラルを使用。`relicBonus`ヘルパー(Task3で定義)をTask6・Task7でも再利用し、`n`/`tsukumokaN`の加算パターンを統一。`ShopState.relic`の配列化(Task7)以降、全タスクで配列前提のAPIに統一(Task6時点の暫定実装はTask7で正式化することを明記済み)。
- **プレースホルダー無し確認:** 全ステップに実コード・実コマンドを記載。ただしTask5 Step7・Task3 Step8は「既存テストのセットアップパターンを踏襲する」という指示を含む(既存コードを読んで実際のテストコードを書く必要がある箇所。プレースホルダーではなく、実装者が既存の同種テストを参照して完成させる設計判断)。
- **スコープ外の再確認:** 独楽(保留)・暗雲/虚の削除検討・付喪化トリガー天啓は本プランに含めない(spec通り)。
