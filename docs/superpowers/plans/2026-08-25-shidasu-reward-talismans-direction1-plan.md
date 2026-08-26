# 報酬増加系護符(方向性1・24件) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `docs/superpowers/specs/2026-08-25-shidasu-reward-talismans-implementation-design.md`の「方向性1: 全24件」を実装し、護符の売却価格に個体ごとの永続ボーナス(`sellBonus`)を持たせる基盤を新設する。

**Architecture:** `HeldItem`に`sellBonus?: number`を追加し、`itemSellPrice`にsellBonus引数を追加する。24種の護符それぞれのトリガー判定は新設モジュール`src/lib/game/shidasu/rewardTalismanEffects.ts`に集約し、`playCard`(プレイ中トリガー)・`resolveWaveEnd`(Wave終了時トリガー)・`useRite`/`useRevelation`/`useOracle`(秘儀等使用トリガー)・`sellItem`(護符売却トリガー)のそれぞれから呼び出す。`playCard`はどの新規護符がトリガーされたかを`triggeredRewardTalismanIds: ItemId[]`という新しい戻り値フィールドで報告し、`RunState`全体を持つ`applyPlayCard`側がそのリストを使って`run.items`内の対象instanceId(同名護符を複数所持していれば全個体)へ`sellBonus`を加算する。同名護符を複数所持している場合は所持する全個体にそれぞれ効果が適用される。

**Tech Stack:** TypeScript, Vitest, SvelteKit (既存の`src/lib/game/shidasu/`配下の純粋関数群への追加)

---

## 前提知識(既存コードの構造)

- `HeldItem = { instanceId: number; id: ItemId }`(`types.ts:393`)。`RunState.items: HeldItem[]`(`types.ts:409`)。
- `itemSellPrice(params, run, id): number`(`shop.ts:69-71`)は現在`params.talismans[id].rarity`のみから価格を算出する。
- `playCard(params, wave, modifier, items: ItemId[], target, colIndex, deckComposition, rand, scoreLock, rowIndex, sealedRoleEffect, comboCap): { wave: WaveState; deckComposition: DeckCard[] }`(`engine.ts:337`)。`items`はid配列のみでinstanceIdを持たない。
- `applyPlayCard(params, run, colIndex, rand, rowIndex): RunState`(`engine.ts:1747`)が`playCard`を呼び、`run`全体(`run.items`含む)にアクセスできる唯一の層。
- `ItemEffectContext`(`itemEffects.ts:11-48`)は得点計算用のコンテキストで、新規護符の「売値+=N」効果はこの得点計算パイプライン(`ITEM_EFFECTS`/`applyItemEffects`)には**登録しない**(得点そのものを変えないため)。
- `sellItem(params, run, instanceId, itemId): RunState`(`engine.ts:1689-1691`)。
- `useRite`(`engine.ts:1049`)・`useRevelation`(`engine.ts:1558`)・`useOracle`(`engine.ts:1647`)はいずれも`RunState`全体を受け取り返す。
- `resolveWaveEnd(params, run, rand, seed): RunState`(`engine.ts:1002`)。Wave成功クリア確定時に`enterShop`へ進む直前の一箇所(`runWithCurrency`構築部、`engine.ts:1016-1026`)。
- `mitsu`天啓の合計売値計算(`engine.ts:1537`): `runAfterRemoval.items.reduce((sum, h) => sum + itemSellPrice(params, runAfterRemoval, h.id), 0)`。
- `analyzeStair(chain): { held; dir; len }`・`analyzeSuitColor(chain, items): { suitHeld; colorHeld }`・`analyzeAlternatingColor(chain, items, minLen): { held }`(`patterns.ts`)。
- `RoleName = 'flush' | 'royalSet' | 'sameRank' | 'completeRun' | 'columnSweep' | 'suit' | 'color' | 'stair' | 'pair' | 'alternating'`(`types.ts:55`)。`roleFired: { name: RoleName; usedWild: boolean; amount: number }[]`は`playCard`のローカル変数(`engine.ts:423`)。
- `ITEM_POOL: ItemId[]`(`items.ts:8-39`)が抽選対象の全護符id配列。
- `ITEM_GROUPS: ItemGroup[]`(`itemGroups.ts:8-31`)がadmin画面(`/admin/shidasu-talismans`)のグルーピング。**新規idを`ITEM_GROUPS`に追加するだけでadmin画面に自動反映される**(新規admin画面は不要)。
- `ITEM_ACTUAL_EFFECTS: Record<ItemId, string>`(`itemActualEffects.ts:6`)は全`ItemId`必須の監査用テキスト。
- 既存テストは`createInitialRun()`(`engine.ts`からexport)でベースの`RunState`を作る(`shop.test.ts`参照)。

## 24護符の英語ID対応表

| 日本語名 | ItemId | rarity |
|---|---|---|
| 両替 | `exchange` | C |
| 小判 | `koban` | C |
| 千両 | `senryo` | U |
| 万両 | `manryo` | R |
| 豊作 | `harvest` | C |
| 決算 | `settlement` | U |
| 秘宝 | `hiddenTreasure` | C |
| 至宝 | `greatestTreasure` | C |
| 家宝 | `heirloom` | C |
| 宝庫 | `treasury` | C |
| 好況 | `boom` | C |
| 潤沢 | `abundantFunds` | C |
| 蓄財 | `savings` | C |
| 大漁 | `bigCatch` | C |
| 五穀 | `grains` | C |
| 活況 | `liveliness` | C |
| 盛況 | `prosperity` | C |
| 天恵 | `heavenlyBlessing` | C |
| 瑞穂 | `mizuho` | C |
| 豊年 | `bountifulYear` | C |
| 利得 | `profit` | C |
| 収穫 | `bounty` | R |
| 役得 | `perk` | C |
| 儲蓄 | `nestEgg` | C |

`types.ts`の既存`ItemId`との衝突なし(全て新規語)。既存`ItemId`一覧(`types.ts:56-86`)を確認済み。

---

## Task 1: 型定義とitemSellPrice/riteSellPrice等のsellBonus対応

**Files:**
- Modify: `src/lib/game/shidasu/types.ts:393`
- Modify: `src/lib/game/shidasu/types.ts:184-317` (WaveState)
- Modify: `src/lib/game/shidasu/shop.ts:69-71`
- Modify: `src/lib/game/shidasu/engine.ts:1537`, `engine.ts:1689-1691`
- Test: `src/lib/game/shidasu/shop.test.ts`

- [ ] **Step 1: HeldItemにsellBonusフィールドを追加**

`types.ts:393`を変更:

```ts
export interface HeldItem { instanceId: number; id: ItemId; sellBonus?: number }
```

- [ ] **Step 2: WaveStateにplayCountThisWaveフィールドを追加(決算用)**

`types.ts:203`(`endReason: WaveEndReason`の直後)に追加:

```ts
  // 決算用: このウェーブ中にplayCardが実行された回数(drawStockは含まない)。startWaveで0に初期化する。
  playCountThisWave: number
```

- [ ] **Step 3: itemSellPriceのシグネチャ変更の失敗テストを書く**

`shop.test.ts`の`describe('価格関数', ...)`ブロック内に追記:

```ts
  test('itemSellPriceはsellBonusを乗算後に加算する', () => {
    const run = createInitialRun()
    const rarityC = ITEM_POOL.find(id => DEFAULT_PARAMS.talismans[id].rarity === 'C')!
    expect(itemSellPrice(DEFAULT_PARAMS, run, rarityC, 3)).toBe(4 + 3)
  })

  test('itemSellPriceはsellBonus未指定なら0扱い', () => {
    const run = createInitialRun()
    const rarityC = ITEM_POOL.find(id => DEFAULT_PARAMS.talismans[id].rarity === 'C')!
    expect(itemSellPrice(DEFAULT_PARAMS, run, rarityC)).toBe(4)
  })

  test('itemSellPriceはsellBonusにレリック倍率を適用しない', () => {
    const run = { ...createInitialRun(), relics: [{ id: 'manekiNeko' as const, tsukumoka: false }] }
    const rarityC = ITEM_POOL.find(id => DEFAULT_PARAMS.talismans[id].rarity === 'C')!
    const base = itemSellPrice(DEFAULT_PARAMS, run, rarityC)
    expect(itemSellPrice(DEFAULT_PARAMS, run, rarityC, 10)).toBe(base + 10)
  })
```

必要な`import`(`ITEM_POOL`)がファイル先頭に無ければ追加する。

- [ ] **Step 4: テストを実行し失敗を確認**

Run: `npm run test -- shop.test.ts`
Expected: FAIL (itemSellPriceは3引数までしか受け付けない、または4引数目が無視される)

- [ ] **Step 5: itemSellPriceにsellBonus引数を追加**

`shop.ts:69-71`を変更:

```ts
export function itemSellPrice(params: ShidasuParams, run: RunState, id: ItemId, sellBonus: number = 0): number {
  return categoryPrice(params, run, params.shop.itemPrice[params.talismans[id].rarity], 'sell') + sellBonus
}
```

- [ ] **Step 6: 呼び出し元(mitsu天啓・sellItem)を更新**

`engine.ts:1537`を変更:

```ts
      const total = runAfterRemoval.items.reduce((sum, h) => sum + itemSellPrice(params, runAfterRemoval, h.id, h.sellBonus ?? 0), 0)
```

`engine.ts:1689-1691`を変更:

```ts
export function sellItem(params: ShidasuParams, run: RunState, instanceId: number, itemId: ItemId): RunState {
  const held = run.items.find(h => h.instanceId === instanceId)
  return sellFromArray(run, 'items', run.items, instanceId, itemSellPrice(params, run, itemId, held?.sellBonus ?? 0))
}
```

- [ ] **Step 7: テストを実行し成功を確認**

Run: `npm run test -- shop.test.ts`
Expected: PASS

- [ ] **Step 8: startWaveにplayCountThisWave初期化を追加**

`engine.ts:190`(`firstPlayDone: false,`の直後)に追加:

```ts
    playCountThisWave: 0,
```

- [ ] **Step 9: ビルド・型チェックを実行**

Run: `npm run build` → 成功を確認
Run: `npm run check` → `WaveState`リテラルを直接組み立てている既存テストがあれば型エラーが出るので、出た箇所すべてに`playCountThisWave: 0`を追加する(該当ファイルは`engine.test.ts`等、`npm run check`のエラー出力に従う)。

- [ ] **Step 10: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/shop.ts src/lib/game/shidasu/engine.ts src/lib/game/shidasu/shop.test.ts
git commit -m "feat: HeldItem.sellBonusとitemSellPriceのsellBonus対応を追加"
```

---

## Task 2: params.tsに24護符のパラメータ定義を追加

**Files:**
- Modify: `src/lib/game/shidasu/params.ts` (型定義部分、`talismans`型の末尾付近)
- Modify: `src/lib/game/shidasu/params.ts` (DEFAULT_PARAMS.talismans、末尾付近)
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Test: `src/lib/game/shidasu/params.test.ts`

- [ ] **Step 1: paramsのtalismans型に24件のエントリを追加する失敗テストを書く**

`params.test.ts`に追記(既存の`talismans`件数を検証するテストがあれば件数を+24した値に更新、無ければ新規に追加):

```ts
test('方向性1の24護符がtalismansに定義されている', () => {
  const ids = ['exchange', 'koban', 'senryo', 'manryo', 'harvest', 'settlement', 'hiddenTreasure', 'greatestTreasure', 'heirloom', 'treasury', 'boom', 'abundantFunds', 'savings', 'bigCatch', 'grains', 'liveliness', 'prosperity', 'heavenlyBlessing', 'mizuho', 'bountifulYear', 'profit', 'bounty', 'perk', 'nestEgg'] as const
  for (const id of ids) {
    expect(DEFAULT_PARAMS.talismans[id]).toBeDefined()
    expect(typeof DEFAULT_PARAMS.talismans[id].name).toBe('string')
  }
})
```

- [ ] **Step 2: テストを実行し失敗を確認**

Run: `npm run test -- params.test.ts`
Expected: FAIL (TypeScriptの型エラーとしても、実行時のundefinedとしても失敗する)

- [ ] **Step 3: types.tsのItemIdユニオン型に24件追加**

`types.ts:86`(`| 'discretion' | 'frost'`の直後)に追加:

```ts
  | 'exchange' | 'koban' | 'senryo' | 'manryo'
  | 'harvest' | 'settlement'
  | 'hiddenTreasure' | 'greatestTreasure' | 'heirloom' | 'treasury'
  | 'boom' | 'abundantFunds' | 'savings' | 'bigCatch' | 'grains'
  | 'liveliness' | 'prosperity' | 'heavenlyBlessing' | 'mizuho'
  | 'bountifulYear' | 'profit' | 'bounty' | 'perk' | 'nestEgg'
```

- [ ] **Step 4: params.tsのtalismans型定義に24件追加**

`params.ts`の`talismans`型定義内、`frost: { name: string; ... }`のようなエントリが並ぶ末尾(既存フィールドの直後、型定義ブロックの閉じ`}`の直前)に追加:

```ts
    exchange: { name: string; n: number; rarity: Rarity; desc: string }
    koban: { name: string; c: number; n: number; rarity: Rarity; desc: string }
    senryo: { name: string; c: number; n: number; rarity: Rarity; desc: string }
    manryo: { name: string; c: number; n: number; rarity: Rarity; desc: string }
    harvest: { name: string; n: number; rarity: Rarity; desc: string }
    settlement: { name: string; c: number; n: number; rarity: Rarity; desc: string }
    hiddenTreasure: { name: string; n: number; rarity: Rarity; desc: string }
    greatestTreasure: { name: string; n: number; rarity: Rarity; desc: string }
    heirloom: { name: string; n: number; rarity: Rarity; desc: string }
    treasury: { name: string; n: number; rarity: Rarity; desc: string }
    boom: { name: string; n: number; rarity: Rarity; desc: string }
    abundantFunds: { name: string; m: number; n: number; rarity: Rarity; desc: string }
    savings: { name: string; n: number; rarity: Rarity; desc: string }
    bigCatch: { name: string; n: number; rarity: Rarity; desc: string }
    grains: { name: string; n: number; rarity: Rarity; desc: string }
    liveliness: { name: string; m: number; n: number; rarity: Rarity; desc: string }
    prosperity: { name: string; m: number; n: number; rarity: Rarity; desc: string }
    heavenlyBlessing: { name: string; m: number; n: number; rarity: Rarity; desc: string }
    mizuho: { name: string; m: number; n: number; rarity: Rarity; desc: string }
    bountifulYear: { name: string; n: number; rarity: Rarity; desc: string }
    profit: { name: string; n: number; rarity: Rarity; desc: string }
    bounty: { name: string; n: number; rarity: Rarity; desc: string }
    perk: { name: string; n: number; rarity: Rarity; desc: string }
    nestEgg: { name: string; n: number; rarity: Rarity; desc: string }
```

- [ ] **Step 5: DEFAULT_PARAMS.talismansに24件のデフォルト値を追加**

同ファイルの`DEFAULT_PARAMS`内、`talismans`オブジェクトの末尾(`frost: { name: '星霜', ... }`のようなエントリの直後)に追加:

```ts
    exchange: { name: '両替', n: 2, rarity: 'C', desc: '秘儀・天啓・神託を使用するたび、この護符の売値に{n}を加算する' },
    koban: { name: '小判', c: 3, n: 1, rarity: 'C', desc: 'コンボ数が{c}に到達した瞬間、この護符の売値に{n}を加算する' },
    senryo: { name: '千両', c: 6, n: 3, rarity: 'U', desc: 'コンボ数が{c}に到達した瞬間、この護符の売値に{n}を加算する' },
    manryo: { name: '万両', c: 10, n: 4, rarity: 'R', desc: 'コンボ数が{c}に到達した瞬間、この護符の売値に{n}を加算する' },
    harvest: { name: '豊作', n: 5, rarity: 'C', desc: '全消しを達成するたび、この護符の売値に{n}を加算する' },
    settlement: { name: '決算', c: 15, n: 5, rarity: 'U', desc: 'カードプレイ{c}回以下でウェーブをクリアするたび、この護符の売値に{n}を加算する' },
    hiddenTreasure: { name: '秘宝', n: 5, rarity: 'C', desc: '♠のAをプレイするたび、この護符の売値に{n}を加算する' },
    greatestTreasure: { name: '至宝', n: 5, rarity: 'C', desc: '♥のKをプレイするたび、この護符の売値に{n}を加算する' },
    heirloom: { name: '家宝', n: 5, rarity: 'C', desc: '♦のJをプレイするたび、この護符の売値に{n}を加算する' },
    treasury: { name: '宝庫', n: 5, rarity: 'C', desc: '♣のQをプレイするたび、この護符の売値に{n}を加算する' },
    boom: { name: '好況', n: 2, rarity: 'C', desc: 'フラッシュが成立するたび、この護符の売値に{n}を加算する' },
    abundantFunds: { name: '潤沢', m: 10, n: 5, rarity: 'C', desc: '場札の残り枚数が{m}枚以下になった瞬間、この護符の売値に{n}を加算する' },
    savings: { name: '蓄財', n: 1, rarity: 'C', desc: '同じ列を連続でプレイするたび(2回目以降)、連続回数×{n}を売値に加算する' },
    bigCatch: { name: '大漁', n: 3, rarity: 'C', desc: '列一掃を達成するたび、この護符の売値に{n}を加算する' },
    grains: { name: '五穀', n: 2, rarity: 'C', desc: 'ワイルドをプレイするたび、この護符の売値に{n}を加算する' },
    liveliness: { name: '活況', m: 6, n: 3, rarity: 'C', desc: '同スートが成立し、かつチェーンが{m}枚以上のとき、この護符の売値に{n}を加算する' },
    prosperity: { name: '盛況', m: 6, n: 3, rarity: 'C', desc: '同色が成立し、かつチェーンが{m}枚以上のとき、この護符の売値に{n}を加算する' },
    heavenlyBlessing: { name: '天恵', m: 6, n: 4, rarity: 'C', desc: '階段が成立し、かつチェーンが{m}枚以上のとき、この護符の売値に{n}を加算する' },
    mizuho: { name: '瑞穂', m: 6, n: 4, rarity: 'C', desc: '交互が成立し、かつチェーンが{m}枚以上のとき、この護符の売値に{n}を加算する' },
    bountifulYear: { name: '豊年', n: 2, rarity: 'C', desc: 'ロイヤルセットが成立するたび、この護符の売値に{n}を加算する' },
    profit: { name: '利得', n: 2, rarity: 'C', desc: '同ランクが成立するたび、この護符の売値に{n}を加算する' },
    bounty: { name: '収穫', n: 10, rarity: 'R', desc: 'コンプリートランが成立するたび、この護符の売値に{n}を加算する' },
    perk: { name: '役得', n: 2, rarity: 'C', desc: 'ペアが成立するたび、この護符の売値に{n}を加算する' },
    nestEgg: { name: '儲蓄', n: 2, rarity: 'C', desc: '他の護符を売却するたび、この護符の売値に{n}を加算する' },
```

- [ ] **Step 6: shidasu.config.jsonに同内容を追加**

`shidasu.config.json`の`talismans`オブジェクトに、Step 5と全く同じキー・値をJSON形式で追加する(この設定ファイルはDEFAULT_PARAMSの初期スナップショットとしてadmin API `/api/admin/shidasu-config`が読み書きする対象。DEFAULT_PARAMSとキー・値が食い違うと保存時にadmin画面の表示と実体がズレるため、Step 5の内容をそのままJSON化して追記する)。

- [ ] **Step 7: テストを実行し成功を確認**

Run: `npm run test -- params.test.ts`
Expected: PASS

- [ ] **Step 8: ビルド・型チェック**

Run: `npm run build`
Run: `npm run check`

- [ ] **Step 9: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/params.test.ts
git commit -m "feat: 方向性1護符24件のparams定義を追加"
```

---

## Task 3: ITEM_POOL・ITEM_GROUPS・ITEM_ACTUAL_EFFECTSへの登録

**Files:**
- Modify: `src/lib/game/shidasu/items.ts:8-39`
- Modify: `src/lib/game/shidasu/itemGroups.ts:8-31`
- Modify: `src/lib/game/shidasu/itemActualEffects.ts`
- Test: `src/lib/game/shidasu/itemGroups.test.ts`

- [ ] **Step 1: itemGroups.test.tsの既存アサーション(全ItemIdがいずれかのグループに属する、等)を確認**

`itemGroups.test.ts`を読み、「`ITEM_POOL`の全idが`ITEM_GROUPS`のいずれかに含まれる」ような網羅性テストが既にあるか確認する。無ければ Step 2 のテストを新規追加し、あれば既存のテストがそのままカバーするので Step 2 はスキップしてよい。

- [ ] **Step 2 (既存の網羅性テストが無い場合のみ): 失敗するテストを追加**

```ts
test('方向性1の24護符がITEM_POOL・ITEM_GROUPSの両方に含まれる', () => {
  const ids = ['exchange', 'koban', 'senryo', 'manryo', 'harvest', 'settlement', 'hiddenTreasure', 'greatestTreasure', 'heirloom', 'treasury', 'boom', 'abundantFunds', 'savings', 'bigCatch', 'grains', 'liveliness', 'prosperity', 'heavenlyBlessing', 'mizuho', 'bountifulYear', 'profit', 'bounty', 'perk', 'nestEgg']
  const groupedIds = ITEM_GROUPS.flatMap(g => g.ids)
  for (const id of ids) {
    expect(ITEM_POOL).toContain(id)
    expect(groupedIds).toContain(id)
  }
})
```

- [ ] **Step 3: テストを実行し失敗を確認**

Run: `npm run test -- itemGroups.test.ts`
Expected: FAIL

- [ ] **Step 4: ITEM_POOLに24件追加**

`items.ts:38`(`'discretion', 'frost',`の直後)に追加:

```ts
  'exchange', 'koban', 'senryo', 'manryo',
  'harvest', 'settlement',
  'hiddenTreasure', 'greatestTreasure', 'heirloom', 'treasury',
  'boom', 'abundantFunds', 'savings', 'bigCatch', 'grains',
  'liveliness', 'prosperity', 'heavenlyBlessing', 'mizuho',
  'bountifulYear', 'profit', 'bounty', 'perk', 'nestEgg',
```

- [ ] **Step 5: ITEM_GROUPSに新規グループを追加**

`itemGroups.ts:30`(`{ label: 'グループ22: 他カテゴリ依存', ids: ['discretion', 'frost'] },`の直後)に追加:

```ts
  { label: 'グループ23: 売値ボーナス(方向性1)', ids: ['exchange', 'koban', 'senryo', 'manryo', 'harvest', 'settlement', 'hiddenTreasure', 'greatestTreasure', 'heirloom', 'treasury', 'boom', 'abundantFunds', 'savings', 'bigCatch', 'grains', 'liveliness', 'prosperity', 'heavenlyBlessing', 'mizuho', 'bountifulYear', 'profit', 'bounty', 'perk', 'nestEgg'] },
```

- [ ] **Step 6: ITEM_ACTUAL_EFFECTSに24件追加**

`itemActualEffects.ts`の`ITEM_ACTUAL_EFFECTS`オブジェクト末尾(`frost: '...',`のようなエントリの直後)に追加:

```ts
  // グループ23: 売値ボーナス(方向性1)
  exchange: '秘儀・天啓・神託のいずれかを使用した直後、この護符自身のsellBonusにnを加算する',
  koban: 'コンボ数がc未満からc以上へ変化した瞬間(エッジトリガー)、この護符自身のsellBonusにnを加算する',
  senryo: 'コンボ数がc未満からc以上へ変化した瞬間(エッジトリガー)、この護符自身のsellBonusにnを加算する',
  manryo: 'コンボ数がc未満からc以上へ変化した瞬間(エッジトリガー)、この護符自身のsellBonusにnを加算する',
  harvest: '全消し(remainingTableauCount===0)を達成したプレイで、この護符自身のsellBonusにnを加算する',
  settlement: 'ウェーブクリア確定時、そのウェーブのplayCountThisWaveがc以下であれば、この護符自身のsellBonusにnを加算する',
  hiddenTreasure: '取得したカードが♠のAのとき、この護符自身のsellBonusにnを加算する',
  greatestTreasure: '取得したカードが♥のKのとき、この護符自身のsellBonusにnを加算する',
  heirloom: '取得したカードが♦のJのとき、この護符自身のsellBonusにnを加算する',
  treasury: '取得したカードが♣のQのとき、この護符自身のsellBonusにnを加算する',
  boom: 'そのプレイでroleFiredにflushが含まれるとき、この護符自身のsellBonusにnを加算する',
  abundantFunds: '場札の残り枚数がm超からm以下へ変化した瞬間(エッジトリガー)、この護符自身のsellBonusにnを加算する',
  savings: '同じ列を連続でプレイした場合(2回目以降)、この護符自身のsellBonusに(連続回数-1)×nを加算する',
  bigCatch: 'そのプレイで列一掃(sweepQualifies)が成立したとき、この護符自身のsellBonusにnを加算する',
  grains: '取得したカードがワイルドのとき、この護符自身のsellBonusにnを加算する',
  liveliness: 'analyzeSuitColorがsuitHeld=trueを返し、かつチェーン長がm以上のとき、この護符自身のsellBonusにnを加算する',
  prosperity: 'analyzeSuitColorがcolorHeld=trueを返し、かつチェーン長がm以上のとき、この護符自身のsellBonusにnを加算する',
  heavenlyBlessing: 'analyzeStairが階段成立(held&&dir!==0)を返し、かつstairInfo.lenがm以上のとき、この護符自身のsellBonusにnを加算する',
  mizuho: 'analyzeAlternatingColorにminLen=mを渡してheld=trueが返るとき、この護符自身のsellBonusにnを加算する',
  bountifulYear: 'そのプレイでroleFiredにroyalSetが含まれるとき、この護符自身のsellBonusにnを加算する',
  profit: 'そのプレイでroleFiredにsameRankが含まれるとき、この護符自身のsellBonusにnを加算する',
  bounty: 'そのプレイでroleFiredにcompleteRunが含まれるとき、この護符自身のsellBonusにnを加算する',
  perk: 'そのプレイでroleFiredにpairが含まれるとき、この護符自身のsellBonusにnを加算する',
  nestEgg: '他の護符が売却されるたび、この護符自身のsellBonusにnを加算する(自分自身が売却対象の場合は加算しない)',
```

- [ ] **Step 7: テストを実行し成功を確認**

Run: `npm run test -- itemGroups.test.ts`
Expected: PASS

- [ ] **Step 8: ビルド・型チェック**

Run: `npm run build`
Run: `npm run check`

- [ ] **Step 9: コミット**

```bash
git add src/lib/game/shidasu/items.ts src/lib/game/shidasu/itemGroups.ts src/lib/game/shidasu/itemActualEffects.ts src/lib/game/shidasu/itemGroups.test.ts
git commit -m "feat: 方向性1護符24件をITEM_POOL/ITEM_GROUPS/ITEM_ACTUAL_EFFECTSへ登録"
```

---

## Task 4: rewardTalismanEffects.ts新設 — プレイ中トリガー14種の判定関数

**Files:**
- Create: `src/lib/game/shidasu/rewardTalismanEffects.ts`
- Test: `src/lib/game/shidasu/rewardTalismanEffects.test.ts`

このタスクでは、`playCard`が呼び出す「今回のプレイで、どの新規護符idがトリガーされたか」を判定する純粋関数を実装する。まだ`playCard`本体への組み込みは行わない(Task 5で行う)。

対象14種(プレイ中に即座にトリガーされるもの): `koban`/`senryo`/`manryo`(コンボ到達エッジトリガー)、`harvest`(全消し)、`hiddenTreasure`/`greatestTreasure`/`heirloom`/`treasury`(特定カード)、`boom`/`bountifulYear`/`profit`/`bounty`/`perk`(役成立)、`grains`(ワイルド)、`abundantFunds`(場札枚数エッジトリガー)、`savings`(列連続、加算量が可変)、`bigCatch`(列一掃)、`liveliness`/`prosperity`/`heavenlyBlessing`/`mizuho`(パターン+チェーン長複合)。

- [ ] **Step 1: 失敗するテストを書く**

`rewardTalismanEffects.test.ts`を新規作成:

```ts
import { describe, test, expect } from 'vitest'
import { DEFAULT_PARAMS } from './params'
import { resolvePlayTriggeredRewardTalismans, type PlayTriggerContext } from './rewardTalismanEffects'
import type { Card } from './types'

const card = (suit: Card['suit'], rank: Card['rank'], wild = false): Card => ({ id: 1, deckId: 1, suit, rank, wild })

function baseCtx(overrides: Partial<PlayTriggerContext> = {}): PlayTriggerContext {
  return {
    card: card('♠', 5),
    chain: [card('♠', 5)],
    comboBefore: 0,
    comboAfter: 1,
    remainingTableauCountBefore: 10,
    remainingTableauCountAfter: 9,
    roleFired: [],
    sweepQualifies: false,
    sameColumnStreak: 1,
    ...overrides,
  }
}

describe('resolvePlayTriggeredRewardTalismans', () => {
  test('小判: コンボがcに到達した瞬間のみtriggeredIdsに含む', () => {
    const ctx = baseCtx({ comboBefore: 2, comboAfter: 3 })
    const result = resolvePlayTriggeredRewardTalismans(DEFAULT_PARAMS, ['koban'], ctx)
    expect(result.triggeredIds).toContain('koban')
  })

  test('小判: コンボがc以上のまま推移した場合は再発動しない', () => {
    const ctx = baseCtx({ comboBefore: 3, comboAfter: 4 })
    const result = resolvePlayTriggeredRewardTalismans(DEFAULT_PARAMS, ['koban'], ctx)
    expect(result.triggeredIds).not.toContain('koban')
  })

  test('豊作: 全消し達成時のみtriggeredIdsに含む', () => {
    const ctx = baseCtx({ remainingTableauCountAfter: 0 })
    const result = resolvePlayTriggeredRewardTalismans(DEFAULT_PARAMS, ['harvest'], ctx)
    expect(result.triggeredIds).toContain('harvest')
  })

  test('秘宝: ♠のAをプレイしたときのみtriggeredIdsに含む', () => {
    const ctx = baseCtx({ card: card('♠', 1) })
    const result = resolvePlayTriggeredRewardTalismans(DEFAULT_PARAMS, ['hiddenTreasure'], ctx)
    expect(result.triggeredIds).toContain('hiddenTreasure')
  })

  test('秘宝: ♠以外のAではtriggeredIdsに含まない', () => {
    const ctx = baseCtx({ card: card('♥', 1) })
    const result = resolvePlayTriggeredRewardTalismans(DEFAULT_PARAMS, ['hiddenTreasure'], ctx)
    expect(result.triggeredIds).not.toContain('hiddenTreasure')
  })

  test('好況: roleFiredにflushが含まれるときtriggeredIdsに含む', () => {
    const ctx = baseCtx({ roleFired: [{ name: 'flush', usedWild: false, amount: 10 }] })
    const result = resolvePlayTriggeredRewardTalismans(DEFAULT_PARAMS, ['boom'], ctx)
    expect(result.triggeredIds).toContain('boom')
  })

  test('潤沢: 場札残数がm超からm以下へ変化した瞬間のみtriggeredIdsに含む', () => {
    const ctx = baseCtx({ remainingTableauCountBefore: 11, remainingTableauCountAfter: 10 })
    const result = resolvePlayTriggeredRewardTalismans(DEFAULT_PARAMS, ['abundantFunds'], ctx)
    expect(result.triggeredIds).toContain('abundantFunds')
  })

  test('蓄財: 連続回数-1に応じたsellBonus加算量をamountsに返す', () => {
    const ctx = baseCtx({ sameColumnStreak: 3 })
    const result = resolvePlayTriggeredRewardTalismans(DEFAULT_PARAMS, ['savings'], ctx)
    expect(result.amounts.savings).toBe((3 - 1) * DEFAULT_PARAMS.talismans.savings.n)
  })

  test('蓄財: 連続回数1(初回)ではtriggeredIdsに含まない', () => {
    const ctx = baseCtx({ sameColumnStreak: 1 })
    const result = resolvePlayTriggeredRewardTalismans(DEFAULT_PARAMS, ['savings'], ctx)
    expect(result.triggeredIds).not.toContain('savings')
  })

  test('大漁: 列一掃成立時のみtriggeredIdsに含む', () => {
    const ctx = baseCtx({ sweepQualifies: true })
    const result = resolvePlayTriggeredRewardTalismans(DEFAULT_PARAMS, ['bigCatch'], ctx)
    expect(result.triggeredIds).toContain('bigCatch')
  })

  test('五穀: ワイルドをプレイしたときのみtriggeredIdsに含む', () => {
    const ctx = baseCtx({ card: card('★', 0, true) })
    const result = resolvePlayTriggeredRewardTalismans(DEFAULT_PARAMS, ['grains'], ctx)
    expect(result.triggeredIds).toContain('grains')
  })

  test('活況: 同スート成立かつチェーン長m以上でtriggeredIdsに含む', () => {
    const chain = Array.from({ length: 6 }, (_, i) => card('♠', ((i % 13) + 1) as Card['rank']))
    const ctx = baseCtx({ chain })
    const result = resolvePlayTriggeredRewardTalismans(DEFAULT_PARAMS, ['liveliness'], ctx)
    expect(result.triggeredIds).toContain('liveliness')
  })

  test('活況: チェーン長がm未満ならtriggeredIdsに含まない', () => {
    const chain = [card('♠', 1), card('♠', 2)]
    const ctx = baseCtx({ chain })
    const result = resolvePlayTriggeredRewardTalismans(DEFAULT_PARAMS, ['liveliness'], ctx)
    expect(result.triggeredIds).not.toContain('liveliness')
  })

  test('天恵: 階段成立かつ長さm以上でtriggeredIdsに含む', () => {
    const chain = Array.from({ length: 6 }, (_, i) => card('♠', (i + 1) as Card['rank']))
    const ctx = baseCtx({ chain })
    const result = resolvePlayTriggeredRewardTalismans(DEFAULT_PARAMS, ['heavenlyBlessing'], ctx)
    expect(result.triggeredIds).toContain('heavenlyBlessing')
  })

  test('瑞穂: 交互成立(minLen=m)でtriggeredIdsに含む', () => {
    const chain = [card('♠', 1), card('♥', 2), card('♣', 3), card('♦', 4), card('♠', 5), card('♥', 6)]
    const ctx = baseCtx({ chain })
    const result = resolvePlayTriggeredRewardTalismans(DEFAULT_PARAMS, ['mizuho'], ctx)
    expect(result.triggeredIds).toContain('mizuho')
  })

  test('利得: roleFiredにsameRankが含まれるときtriggeredIdsに含む', () => {
    const ctx = baseCtx({ roleFired: [{ name: 'sameRank', usedWild: false, amount: 5 }] })
    const result = resolvePlayTriggeredRewardTalismans(DEFAULT_PARAMS, ['profit'], ctx)
    expect(result.triggeredIds).toContain('profit')
  })

  test('役得: roleFiredにpairが含まれるときtriggeredIdsに含む', () => {
    const ctx = baseCtx({ roleFired: [{ name: 'pair', usedWild: false, amount: 5 }] })
    const result = resolvePlayTriggeredRewardTalismans(DEFAULT_PARAMS, ['perk'], ctx)
    expect(result.triggeredIds).toContain('perk')
  })

  test('複数護符が同時に条件を満たす場合、全てtriggeredIdsに含む', () => {
    const ctx = baseCtx({ card: card('♠', 1), remainingTableauCountAfter: 0 })
    const result = resolvePlayTriggeredRewardTalismans(DEFAULT_PARAMS, ['hiddenTreasure', 'harvest'], ctx)
    expect(result.triggeredIds).toEqual(expect.arrayContaining(['hiddenTreasure', 'harvest']))
  })
})
```

- [ ] **Step 2: テストを実行し失敗を確認**

Run: `npm run test -- rewardTalismanEffects.test.ts`
Expected: FAIL (モジュールが存在しない)

- [ ] **Step 3: rewardTalismanEffects.tsを実装**

```ts
// src/lib/game/shidasu/rewardTalismanEffects.ts
import type { Card, ItemId, RoleName } from './types'
import type { ShidasuParams } from './params'
import { analyzeStair, analyzeSuitColor, analyzeAlternatingColor } from './patterns'

export interface PlayTriggerContext {
  card: Card
  chain: Card[]
  comboBefore: number
  comboAfter: number
  remainingTableauCountBefore: number
  remainingTableauCountAfter: number
  roleFired: { name: RoleName; usedWild: boolean; amount: number }[]
  sweepQualifies: boolean
  sameColumnStreak: number
}

export interface RewardTalismanTriggerResult {
  // トリガー成立した護符のid一覧
  triggeredIds: ItemId[]
  // triggeredIdsに含まれる各idについて、実際にsellBonusへ加算すべき確定量。
  // 契約: triggeredIdsに含まれるidは必ずこのamountsにも値を持つ(呼び出し元はamounts[id]が
  // 存在する前提でsellBonusへ加算してよく、0扱いへのフォールバックを書く必要はない)。
  amounts: Partial<Record<ItemId, number>>
}

function hasRole(roleFired: { name: RoleName }[], name: RoleName): boolean {
  return roleFired.some(r => r.name === name)
}

// プレイ中に即座にトリガーされる、方向性1の14種の護符について、今回のプレイで
// トリガー成立したものを判定する。heldIdsは所持している護符idの集合(重複含まない、
// 呼び出し元が対象種別ごとに1回だけ呼ぶ)。
export function resolvePlayTriggeredRewardTalismans(
  params: ShidasuParams,
  heldIds: ItemId[],
  ctx: PlayTriggerContext
): RewardTalismanTriggerResult {
  const triggeredIds: ItemId[] = []
  const amounts: Partial<Record<ItemId, number>> = {}
  const trigger = (id: ItemId, amount: number) => {
    triggeredIds.push(id)
    amounts[id] = amount
  }

  for (const id of heldIds) {
    switch (id) {
      case 'koban':
        if (ctx.comboBefore < params.talismans.koban.c && ctx.comboAfter >= params.talismans.koban.c) trigger(id, params.talismans.koban.n)
        break
      case 'senryo':
        if (ctx.comboBefore < params.talismans.senryo.c && ctx.comboAfter >= params.talismans.senryo.c) trigger(id, params.talismans.senryo.n)
        break
      case 'manryo':
        if (ctx.comboBefore < params.talismans.manryo.c && ctx.comboAfter >= params.talismans.manryo.c) trigger(id, params.talismans.manryo.n)
        break
      case 'harvest':
        if (ctx.remainingTableauCountAfter === 0) trigger(id, params.talismans.harvest.n)
        break
      case 'hiddenTreasure':
        if (!ctx.card.wild && ctx.card.suit === '♠' && ctx.card.rank === 1) trigger(id, params.talismans.hiddenTreasure.n)
        break
      case 'greatestTreasure':
        if (!ctx.card.wild && ctx.card.suit === '♥' && ctx.card.rank === 13) trigger(id, params.talismans.greatestTreasure.n)
        break
      case 'heirloom':
        if (!ctx.card.wild && ctx.card.suit === '♦' && ctx.card.rank === 11) trigger(id, params.talismans.heirloom.n)
        break
      case 'treasury':
        if (!ctx.card.wild && ctx.card.suit === '♣' && ctx.card.rank === 12) trigger(id, params.talismans.treasury.n)
        break
      case 'boom':
        if (hasRole(ctx.roleFired, 'flush')) trigger(id, params.talismans.boom.n)
        break
      case 'abundantFunds':
        if (ctx.remainingTableauCountBefore > params.talismans.abundantFunds.m && ctx.remainingTableauCountAfter <= params.talismans.abundantFunds.m) trigger(id, params.talismans.abundantFunds.n)
        break
      case 'savings':
        if (ctx.sameColumnStreak >= 2) trigger(id, (ctx.sameColumnStreak - 1) * params.talismans.savings.n)
        break
      case 'bigCatch':
        if (ctx.sweepQualifies) trigger(id, params.talismans.bigCatch.n)
        break
      case 'grains':
        if (ctx.card.wild) trigger(id, params.talismans.grains.n)
        break
      case 'liveliness': {
        const { suitHeld } = analyzeSuitColor(ctx.chain)
        if (suitHeld && ctx.chain.filter(c => !c.wild).length >= params.talismans.liveliness.m) trigger(id, params.talismans.liveliness.n)
        break
      }
      case 'prosperity': {
        const { colorHeld } = analyzeSuitColor(ctx.chain)
        if (colorHeld && ctx.chain.filter(c => !c.wild).length >= params.talismans.prosperity.m) trigger(id, params.talismans.prosperity.n)
        break
      }
      case 'heavenlyBlessing': {
        const stairInfo = analyzeStair(ctx.chain)
        if (stairInfo.held && stairInfo.dir !== 0 && stairInfo.len >= params.talismans.heavenlyBlessing.m) trigger(id, params.talismans.heavenlyBlessing.n)
        break
      }
      case 'mizuho':
        if (analyzeAlternatingColor(ctx.chain, [], params.talismans.mizuho.m).held) trigger(id, params.talismans.mizuho.n)
        break
      case 'bountifulYear':
        if (hasRole(ctx.roleFired, 'royalSet')) trigger(id, params.talismans.bountifulYear.n)
        break
      case 'profit':
        if (hasRole(ctx.roleFired, 'sameRank')) trigger(id, params.talismans.profit.n)
        break
      case 'bounty':
        if (hasRole(ctx.roleFired, 'completeRun')) trigger(id, params.talismans.bounty.n)
        break
      case 'perk':
        if (hasRole(ctx.roleFired, 'pair')) trigger(id, params.talismans.perk.n)
        break
      default:
        break
    }
  }

  return { triggeredIds, amounts }
}
```

- [ ] **Step 4: テストを実行し成功を確認**

Run: `npm run test -- rewardTalismanEffects.test.ts`
Expected: PASS

- [ ] **Step 5: ビルド・型チェック**

Run: `npm run build`
Run: `npm run check`

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/rewardTalismanEffects.ts src/lib/game/shidasu/rewardTalismanEffects.test.ts
git commit -m "feat: プレイ中トリガー14種の護符判定ロジックを追加"
```

---

## Task 5: playCard/applyPlayCardへのプレイ中トリガー組み込み

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts` (`playCard`関数, `engine.ts:337`〜)
- Modify: `src/lib/game/shidasu/engine.ts` (`applyPlayCard`関数, `engine.ts:1747`)
- Test: `src/lib/game/shidasu/engine.test.ts`

このタスクでは、Task 4で作った判定関数を`playCard`から呼び出し、トリガー結果を戻り値で報告した上で、`applyPlayCard`が`run.items`のsellBonusを実際に更新する配線を行う。`playCard`自体は`ItemId[]`しか持たずinstanceIdを扱えないため、「どのidが何回・いくら分トリガーされたか」を返すところまでが`playCard`の責務、実際に`run.items`へ反映するのは`applyPlayCard`の責務、という分担にする。

- [ ] **Step 1: 失敗するテストを書く**

`engine.test.ts`に追記(`createInitialRun`・`applyPlayCard`・`startWave`は既存importに含まれている前提。無ければ追加する):

```ts
describe('方向性1護符: プレイ中トリガー', () => {
  test('秘宝所持中に♠のAをプレイするとsellBonusが加算される', () => {
    let run = { ...createInitialRun(), items: [{ instanceId: 1, id: 'hiddenTreasure' as const }], nextInstanceId: 2 }
    const { wave, deckComposition } = startWave(DEFAULT_PARAMS, 0, 0, ['hiddenTreasure'], run.deckComposition, 1)
    run = { ...run, phase: 'playing', wave, deckComposition }
    run = { ...run, wave: forceStockTop(run.wave!, '♠', 1, false) }
    // 場札の最初の1枚を強制的に♠のAへ差し替えてプレイする
    const colIndex = run.wave!.tableau.findIndex(col => col.length > 0)
    run = { ...run, wave: { ...run.wave!, tableau: run.wave!.tableau.map((col, i) => i === colIndex ? [...col.slice(0, -1), { id: 999, deckId: 999, suit: '♠', rank: 1, wild: false }] : col) } }
    const result = applyPlayCard(DEFAULT_PARAMS, run, colIndex, createRng(1))
    const held = result.items.find(h => h.instanceId === 1)
    expect(held?.sellBonus).toBe(DEFAULT_PARAMS.talismans.hiddenTreasure.n)
  })

  test('小判を2枚所持している場合、両方のinstanceIdにsellBonusが加算される', () => {
    let run = {
      ...createInitialRun(),
      items: [{ instanceId: 1, id: 'koban' as const }, { instanceId: 2, id: 'koban' as const }],
      nextInstanceId: 3,
    }
    const { wave, deckComposition } = startWave(DEFAULT_PARAMS, 0, 0, ['koban', 'koban'], run.deckComposition, 1)
    run = { ...run, phase: 'playing', wave: { ...wave, combo: DEFAULT_PARAMS.talismans.koban.c - 1 }, deckComposition }
    const colIndex = run.wave!.tableau.findIndex(col => col.length > 0)
    const result = applyPlayCard(DEFAULT_PARAMS, run, colIndex, createRng(1))
    expect(result.items[0].sellBonus).toBe(DEFAULT_PARAMS.talismans.koban.n)
    expect(result.items[1].sellBonus).toBe(DEFAULT_PARAMS.talismans.koban.n)
  })

  test('sellBonusは永続的に加算され続ける(上限なし)', () => {
    let run = { ...createInitialRun(), items: [{ instanceId: 1, id: 'hiddenTreasure' as const, sellBonus: 20 }], nextInstanceId: 2 }
    const { wave, deckComposition } = startWave(DEFAULT_PARAMS, 0, 0, ['hiddenTreasure'], run.deckComposition, 1)
    run = { ...run, phase: 'playing', wave, deckComposition }
    const colIndex = run.wave!.tableau.findIndex(col => col.length > 0)
    run = { ...run, wave: { ...run.wave!, tableau: run.wave!.tableau.map((col, i) => i === colIndex ? [...col.slice(0, -1), { id: 999, deckId: 999, suit: '♠', rank: 1, wild: false }] : col) } }
    const result = applyPlayCard(DEFAULT_PARAMS, run, colIndex, createRng(1))
    expect(result.items[0].sellBonus).toBe(20 + DEFAULT_PARAMS.talismans.hiddenTreasure.n)
  })
})
```

**注記:** 上記テストの`forceStockTop`呼び出しは山札側の差し替えであり実際には不要(場札tableauを直接書き換えている行が実質のセットアップ)。実装担当者は既存の`engine.test.ts`内で「特定のカードを場札に配置してプレイする」パターンが既にあればそれに倣って書き直してよい(既存の類似テスト、例えば`springBreeze`や`wit`のテストを探して同じセットアップ手法を使うこと)。テストの意図(1: 特定カードトリガーでsellBonus加算、2: 同名複数所持で両方に加算、3: 永続加算)を満たせば手段は問わない。

- [ ] **Step 2: テストを実行し失敗を確認**

Run: `npm run test -- engine.test.ts -t "方向性1護符"`
Expected: FAIL (`items`に`sellBonus`が反映されない、または`RunState`に`items`のsellBonus変化が無い)

- [ ] **Step 3: playCardの戻り値にtriggeredRewardTalismanIds/amountsを追加**

`engine.ts:337-350`の関数シグネチャ内、戻り値の型を変更:

```ts
export function playCard(
  params: ShidasuParams,
  wave: WaveState,
  modifier: StageModifier,
  items: ItemId[],
  target: number,
  colIndex: number,
  deckComposition: DeckCard[],
  rand: () => number = Math.random,
  scoreLock: BossScoreLock = null,
  rowIndex?: number,
  sealedRoleEffect: SealedRoleEffect = { zeroRoles: [], oracleBaselineRole: null },
  comboCap: number | null = null
): { wave: WaveState; deckComposition: DeckCard[]; rewardTalismanTrigger: RewardTalismanTriggerResult } {
```

ファイル先頭のimportに追加:

```ts
import { resolvePlayTriggeredRewardTalismans, type RewardTalismanTriggerResult, type PlayTriggerContext } from './rewardTalismanEffects'
```

`engine.ts:351-353`の早期return箇所(3箇所: `wave.status !== 'playing'`、`col`が無い、`row`が不正)それぞれに空の`rewardTalismanTrigger: { triggeredIds: [], amounts: {} }`を追加する。該当箇所:

```ts
  if (wave.status !== 'playing') return { wave, deckComposition, rewardTalismanTrigger: { triggeredIds: [], amounts: {} } }
  const col = wave.tableau[colIndex]
  if (!col || col.length === 0) return { wave, deckComposition, rewardTalismanTrigger: { triggeredIds: [], amounts: {} } }
  const row = rowIndex ?? col.length - 1
  if (row !== col.length - 1 && !wave.playFromAnywhereActiveThisWave) return { wave, deckComposition, rewardTalismanTrigger: { triggeredIds: [], amounts: {} } }
  const card = col[row]
  if (!card) return { wave, deckComposition, rewardTalismanTrigger: { triggeredIds: [], amounts: {} } }
  if (!isPlayable(modifier, wave, card, items)) return { wave, deckComposition, rewardTalismanTrigger: { triggeredIds: [], amounts: {} } }
```

- [ ] **Step 4: playCard内でresolvePlayTriggeredRewardTalismansを呼び出す**

`engine.ts:527`(`const itemResult = applyItemEffects('gained', base, items, itemEffectCtx, params)`の直後)に追加:

```ts
  const rewardTalismanCtx: PlayTriggerContext = {
    card,
    chain: chainIncludingThis,
    comboBefore: wave.combo,
    comboAfter: newCombo,
    remainingTableauCountBefore: remainingCount(wave.tableau),
    remainingTableauCountAfter: remaining,
    roleFired,
    sweepQualifies,
    sameColumnStreak: newSameColumnStreak,
  }
  const rewardTalismanTrigger = resolvePlayTriggeredRewardTalismans(params, items, rewardTalismanCtx)
```

`remainingCount`関数が既にファイル内でimport/定義済みか確認する(`engine.ts:458`の`remainingBeforeRevival = remainingCount(newTableau)`から使用箇所は確認済み。同名関数を`wave.tableau`にも適用してプレイ前の残数を出す)。

`playCountThisWave`の加算は`next: WaveState`オブジェクト構築部(`engine.ts:581`)に追加:

```ts
    playCountThisWave: wave.playCountThisWave + 1,
```

- [ ] **Step 5: 関数末尾の全てのreturn文にrewardTalismanTriggerを追加**

`playCard`関数内の残りの`return { wave: ..., deckComposition }`形式の箇所(全消し即終了、通常終了など複数ある)全てに`rewardTalismanTrigger`を追加する。該当箇所は`engine.ts:626`以降を読み、`return {`で`wave`と`deckComposition`を返している全箇所を洗い出して追加すること(正確な行数はTask実行時に`playCard`関数の全文を再読して特定する)。

- [ ] **Step 6: applyPlayCardでrun.itemsを更新**

`engine.ts:1747-1753`を変更:

```ts
export function applyPlayCard(params: ShidasuParams, run: RunState, colIndex: number, rand: () => number = Math.random, rowIndex?: number): RunState {
  if (run.phase !== 'playing' || !run.wave) return run
  const modifier = stageModifierFor(params, run)
  const { target, scoreLock, effectiveItems, sealedRoleEffect, comboCap } = resolvePlayContext(params, run, run.wave)
  const { wave, deckComposition, rewardTalismanTrigger } = playCard(params, run.wave, modifier, effectiveItems, target, colIndex, run.deckComposition, rand, scoreLock, rowIndex, sealedRoleEffect, comboCap)
  const items = applyRewardTalismanTrigger(run.items, rewardTalismanTrigger)
  return resolveActionSabotage(params, { ...run, wave, deckComposition, items }, wave, rand)
}

// トリガーが成立した護符idについて、所持する全個体のsellBonusへ加算する(同名複数所持時は全個体に適用)。
// Task 4の契約により、triggeredIdsに含まれるidは必ずamountsにも確定値を持つ(0扱いへのフォールバック不要)。
function applyRewardTalismanTrigger(items: HeldItem[], trigger: RewardTalismanTriggerResult): HeldItem[] {
  if (trigger.triggeredIds.length === 0) return items
  return items.map(h => {
    const amount = trigger.amounts[h.id]
    if (amount === undefined) return h
    return { ...h, sellBonus: (h.sellBonus ?? 0) + amount }
  })
}
```

`HeldItem`型のimportが`engine.ts`に無ければ追加する。

- [ ] **Step 7: playCard呼び出し元(applyPlayCard以外)の修正**

`engine.ts`内で`playCard(`を呼んでいる他の箇所(`resolvePlayContext`経由ではなく直接呼んでいる箇所、`applyStuckCheck`等)を`grep`で洗い出し、戻り値の分割代入に`rewardTalismanTrigger`が増えても既存コードがエラーにならないか確認する(分割代入で使わないフィールドを無視するのは合法なので、型エラーが出なければ対応不要)。

- [ ] **Step 8: テストを実行し成功を確認**

Run: `npm run test -- engine.test.ts -t "方向性1護符"`
Expected: PASS

- [ ] **Step 9: 全体テストスイートを実行し既存テストが壊れていないか確認**

Run: `npm run test`
Expected: PASS (既存の`playCard`呼び出しテストが分割代入で`wave`/`deckComposition`のみ取り出している場合は影響を受けないはずだが、型チェックで引っかかる箇所が無いか確認)

- [ ] **Step 10: ビルド・型チェック**

Run: `npm run build`
Run: `npm run check`

- [ ] **Step 11: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/rewardTalismanEffects.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: playCard/applyPlayCardにプレイ中トリガー護符14種を組み込み"
```

---

## Task 6: 儲蓄(nestEgg)— 護符売却トリガーの実装

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts` (`sellItem`関数, `engine.ts:1689`)
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`engine.test.ts`に追記:

```ts
describe('儲蓄(nestEgg)', () => {
  test('他の護符を売却すると儲蓄のsellBonusが加算される', () => {
    const run = {
      ...createInitialRun(),
      phase: 'playing' as const,
      items: [{ instanceId: 1, id: 'nestEgg' as const }, { instanceId: 2, id: 'bridge' as const }],
      nextInstanceId: 3,
    }
    const result = sellItem(DEFAULT_PARAMS, run, 2, 'bridge')
    const nestEgg = result.items.find(h => h.instanceId === 1)
    expect(nestEgg?.sellBonus).toBe(DEFAULT_PARAMS.talismans.nestEgg.n)
  })

  test('儲蓄自身を売却しても他の儲蓄インスタンスは加算されるが、売却された自分自身は配列から消える', () => {
    const run = {
      ...createInitialRun(),
      phase: 'playing' as const,
      items: [{ instanceId: 1, id: 'nestEgg' as const }, { instanceId: 2, id: 'nestEgg' as const }],
      nextInstanceId: 3,
    }
    const result = sellItem(DEFAULT_PARAMS, run, 1, 'nestEgg')
    expect(result.items.find(h => h.instanceId === 1)).toBeUndefined()
    const remaining = result.items.find(h => h.instanceId === 2)
    expect(remaining?.sellBonus).toBe(DEFAULT_PARAMS.talismans.nestEgg.n)
  })

  test('儲蓄を複数所持していれば売却のたび全個体に加算される', () => {
    const run = {
      ...createInitialRun(),
      phase: 'playing' as const,
      items: [{ instanceId: 1, id: 'nestEgg' as const }, { instanceId: 2, id: 'nestEgg' as const }, { instanceId: 3, id: 'bridge' as const }],
      nextInstanceId: 4,
    }
    const result = sellItem(DEFAULT_PARAMS, run, 3, 'bridge')
    expect(result.items.find(h => h.instanceId === 1)?.sellBonus).toBe(DEFAULT_PARAMS.talismans.nestEgg.n)
    expect(result.items.find(h => h.instanceId === 2)?.sellBonus).toBe(DEFAULT_PARAMS.talismans.nestEgg.n)
  })
})
```

- [ ] **Step 2: テストを実行し失敗を確認**

Run: `npm run test -- engine.test.ts -t "儲蓄"`
Expected: FAIL

- [ ] **Step 3: sellItemを修正**

`engine.ts:1687-1691`を変更:

```ts
// 所持中の護符を1個売却し、通貨を得る。playing/shopフェーズでのみ呼べる。instanceIdで対象個体を特定し、
// itemIdは価格計算(itemSellPrice)に使う。儲蓄(nestEgg): 売却された護符自身以外に儲蓄を所持していれば、
// その全個体のsellBonusにnを加算する(売却対象自身が儲蓄であっても、他の儲蓄インスタンスには加算する)。
export function sellItem(params: ShidasuParams, run: RunState, instanceId: number, itemId: ItemId): RunState {
  const held = run.items.find(h => h.instanceId === instanceId)
  const sold = sellFromArray(run, 'items', run.items, instanceId, itemSellPrice(params, run, itemId, held?.sellBonus ?? 0))
  if (sold === run) return sold
  const items = (sold as RunState).items.map(h =>
    h.id === 'nestEgg' ? { ...h, sellBonus: (h.sellBonus ?? 0) + params.talismans.nestEgg.n } : h
  )
  return { ...sold, items } as RunState
}
```

`sellFromArray`の戻り値が「対象が見つからなければ`run`をそのまま返す」仕様であることを`engine.ts:1680-1685`から確認済み。それを利用して早期returnしている。

- [ ] **Step 4: テストを実行し成功を確認**

Run: `npm run test -- engine.test.ts -t "儲蓄"`
Expected: PASS

- [ ] **Step 5: ビルド・型チェック**

Run: `npm run build`
Run: `npm run check`

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 儲蓄(nestEgg)の護符売却トリガーを実装"
```

---

## Task 7: 両替(exchange)— 秘儀・天啓・神託使用トリガーの実装

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts` (`useRite:1049`, `useRevelation:1558`, `useOracle:1647`)
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`engine.test.ts`に追記(各関数の既存テストの近くに配置するのが望ましいが、新規`describe`ブロックでもよい):

```ts
describe('両替(exchange)', () => {
  test('秘儀を使用すると両替のsellBonusが加算される', () => {
    let run = {
      ...createInitialRun(),
      phase: 'playing' as const,
      items: [{ instanceId: 1, id: 'exchange' as const }],
      rites: [{ instanceId: 2, id: 'raidho' as const }],
      nextInstanceId: 3,
    }
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, ['exchange'], run.deckComposition, 1)
    run = { ...run, wave }
    const result = useRite(DEFAULT_PARAMS, run, 2, 'raidho', createRng(1))
    const exchange = result.items.find(h => h.instanceId === 1)
    expect(exchange?.sellBonus).toBe(DEFAULT_PARAMS.talismans.exchange.n)
  })

  test('神託を使用すると両替のsellBonusが加算される', () => {
    let run = {
      ...createInitialRun(),
      phase: 'playing' as const,
      items: [{ instanceId: 1, id: 'exchange' as const }],
      oracles: [{ instanceId: 2, id: 'flush' as const }],
      nextInstanceId: 3,
    }
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, ['exchange'], run.deckComposition, 1)
    run = { ...run, wave }
    const result = useOracle(DEFAULT_PARAMS, run, 'flush')
    const exchange = result.items.find(h => h.instanceId === 1)
    expect(exchange?.sellBonus).toBe(DEFAULT_PARAMS.talismans.exchange.n)
  })
})
```

**注記:** `useRevelation`のテストは対象の天啓id・引数(`targetCol`等)が複雑なため、上記2テスト(秘儀・神託)で「使用トリガー」の仕組みが動くことを確認できれば十分とし、天啓分は実装のみ行い個別テストは省略してよい(3関数とも同じ共通関数を呼ぶ設計にするため、1つで検証できていれば残り2つはロジック共有により安全)。

- [ ] **Step 2: テストを実行し失敗を確認**

Run: `npm run test -- engine.test.ts -t "両替"`
Expected: FAIL

- [ ] **Step 3: applyDiscretionFrostBonusと同じ場所に共通関数を追加**

`engine.ts:1037-1043`の`applyDiscretionFrostBonus`関数の直後に追加:

```ts
// 両替: 秘儀・天啓・神託のいずれかを使用するたび、所持する両替の全インスタンスのsellBonusにnを加算する。
function applyExchangeBonus(params: ShidasuParams, run: RunState): HeldItem[] {
  if (!run.items.some(h => h.id === 'exchange')) return run.items
  return run.items.map(h => h.id === 'exchange' ? { ...h, sellBonus: (h.sellBonus ?? 0) + params.talismans.exchange.n } : h)
}
```

`HeldItem`型のimportが無ければ追加する。

- [ ] **Step 4: useRite/useRevelation/useOracleの3箇所で呼び出す**

`useRite`(`engine.ts:1049-1062`)の`return`文直前に追加、`items`フィールドをreturnオブジェクトに含める:

```ts
export function useRite(params: ShidasuParams, run: RunState, instanceId: number, riteId: RiteId, rand: () => number = Math.random): RunState {
  if ((run.phase !== 'playing' && !SHOP_FLOW_PHASES.includes(run.phase)) || !run.wave || run.wave.status !== 'playing') return run
  if (!canUseRite(params, run.wave, instanceId, riteId)) return run
  const idx = run.rites.findIndex(h => h.instanceId === instanceId)
  if (idx === -1) return run
  let wave = applyRiteEffect(params, run.wave, riteId, rand)
  wave = applyDiscretionFrostBonus(params, run, wave)
  if (riteId === 'dagaz') {
    wave = { ...wave, lastStockShuffle: { seq: (run.wave.lastStockShuffle?.seq ?? 0) + 1 } }
  }
  const rites = [...run.rites.slice(0, idx), ...run.rites.slice(idx + 1)]
  const recentUsedRiteIds = [riteId, ...run.recentUsedRiteIds].slice(0, 2)
  const items = applyExchangeBonus(params, run)
  return { ...run, wave, rites, recentUsedRiteIds, items }
}
```

`useRevelation`(`engine.ts:1558-1579`)の`return`文を変更:

```ts
  const items = applyExchangeBonus(params, run)
  return { ...run, wave, deckComposition, revelations, extraTableauRows, lastUsedRevelationId, items, ...reward }
```

(`items`は`...reward`より前に置き、`reward`が万一`items`を含んでいてもそちらを優先させる。`grantRevelationReward`の戻り値`reward`の型を確認し、`items`を含む場合は競合しないことを確認すること。含まない場合は上記の順序のままでよい。)

`useOracle`(`engine.ts:1647-1656`)の`return`文を変更:

```ts
export function useOracle(params: ShidasuParams, run: RunState, roleName: RoleName): RunState {
  if (run.phase !== 'playing') return run
  const idx = run.oracles.findIndex(h => h.id === roleName)
  if (idx === -1) return run
  const oracles = [...run.oracles.slice(0, idx), ...run.oracles.slice(idx + 1)]
  const oracleLevels = { ...run.oracleLevels, [roleName]: run.oracleLevels[roleName] + 1 }
  let wave = run.wave ? { ...run.wave, oracleLevels } : run.wave
  if (wave) wave = applyDiscretionFrostBonus(params, run, wave)
  const items = applyExchangeBonus(params, run)
  return { ...run, oracles, oracleLevels, wave, items }
}
```

- [ ] **Step 5: テストを実行し成功を確認**

Run: `npm run test -- engine.test.ts -t "両替"`
Expected: PASS

- [ ] **Step 6: 全体テストスイート・ビルド・型チェック**

Run: `npm run test`
Run: `npm run build`
Run: `npm run check`

- [ ] **Step 7: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 両替(exchange)の秘儀・天啓・神託使用トリガーを実装"
```

---

## Task 8: 決算(settlement)— Wave終了時トリガーの実装

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts` (`resolveWaveEnd:1002`)
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

```ts
describe('決算(settlement)', () => {
  test('プレイ回数がc以下でWaveクリアするとsellBonusが加算される', () => {
    let run = {
      ...createInitialRun(),
      phase: 'playing' as const,
      items: [{ instanceId: 1, id: 'settlement' as const }],
      nextInstanceId: 2,
    }
    const { wave, deckComposition } = startWave(DEFAULT_PARAMS, 0, 0, ['settlement'], run.deckComposition, 1)
    run = {
      ...run,
      deckComposition,
      wave: { ...wave, status: 'ended', endReason: 'fullClear', score: 999999, playCountThisWave: DEFAULT_PARAMS.talismans.settlement.c },
    }
    const result = resolveWaveEnd(DEFAULT_PARAMS, run, createRng(1))
    const settlement = result.items.find(h => h.instanceId === 1)
    expect(settlement?.sellBonus).toBe(DEFAULT_PARAMS.talismans.settlement.n)
  })

  test('プレイ回数がcを超えていればsellBonusは加算されない', () => {
    let run = {
      ...createInitialRun(),
      phase: 'playing' as const,
      items: [{ instanceId: 1, id: 'settlement' as const }],
      nextInstanceId: 2,
    }
    const { wave, deckComposition } = startWave(DEFAULT_PARAMS, 0, 0, ['settlement'], run.deckComposition, 1)
    run = {
      ...run,
      deckComposition,
      wave: { ...wave, status: 'ended', endReason: 'fullClear', score: 999999, playCountThisWave: DEFAULT_PARAMS.talismans.settlement.c + 1 },
    }
    const result = resolveWaveEnd(DEFAULT_PARAMS, run, createRng(1))
    const settlement = result.items.find(h => h.instanceId === 1)
    expect(settlement?.sellBonus ?? 0).toBe(0)
  })
})
```

`score: 999999`は`waveTarget`を確実に上回らせてクリア扱いにするための値(既存テストの慣習に倣う。既存テストで目標スコアを上回らせる別の書き方があれば、それに合わせて修正してよい)。

- [ ] **Step 2: テストを実行し失敗を確認**

Run: `npm run test -- engine.test.ts -t "決算"`
Expected: FAIL

- [ ] **Step 3: resolveWaveEndに決算の判定を追加**

`engine.ts:1014-1026`を変更:

```ts
  const currentStar = run.stageStars[run.waveIndex]
  const baseEarned = Math.max(0, (currentStar?.reward ?? 0) - run.rewardPenalty)
  const earned = baseEarned + relicWaveEndBonus(params, run, wave, baseEarned)
  const settlementQualifies = wave.playCountThisWave <= params.talismans.settlement.c
  const items = settlementQualifies
    ? run.items.map(h => h.id === 'settlement' ? { ...h, sellBonus: (h.sellBonus ?? 0) + params.talismans.settlement.n } : h)
    : run.items
  const runWithCurrency = {
    ...run,
    currency: run.currency + earned,
    items,
    dedicationX: wave.dedicationX,
    diligenceX: wave.diligenceX,
    divineProtectionX: wave.divineProtectionX,
    discretionN: wave.discretionN,
    frostX: wave.frostX,
    echoX: wave.echoX,
    shootingStarN: wave.shootingStarN,
  }
```

**注記:** `settlementQualifies`の判定は「決算を所持しているかどうか」を問わず計算しているが、`items.map`が`h.id === 'settlement'`でフィルタしているため、未所持なら実質何もしない(既存の`applyDiscretionFrostBonus`と同じ「所持していなければno-op」という設計と整合)。

- [ ] **Step 4: テストを実行し成功を確認**

Run: `npm run test -- engine.test.ts -t "決算"`
Expected: PASS

- [ ] **Step 5: 全体テストスイート・ビルド・型チェック**

Run: `npm run test`
Run: `npm run build`
Run: `npm run check`

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 決算(settlement)のWave終了時トリガーを実装"
```

---

## Task 9: 最終チェック — 24種全件の統合確認とデバッグパネル反映確認

**Files:**
- Read: `src/lib/game/shidasu/rewardTalismanEffects.ts`
- Read: `src/lib/game/shidasu/engine.ts`
- Modify: (必要であれば) `src/routes/**/debug*` 配下の護符強制付与UI

- [ ] **Step 1: 24件が全てTask 4-8のいずれかで実装されていることをチェックリストで確認**

以下の対応表を実装担当者自身が読み合わせ、抜けが無いか確認する:

| ItemId | 実装タスク |
|---|---|
| exchange | Task 7 |
| koban / senryo / manryo | Task 4-5 |
| harvest | Task 4-5 |
| settlement | Task 8 |
| hiddenTreasure / greatestTreasure / heirloom / treasury | Task 4-5 |
| boom | Task 4-5 |
| abundantFunds | Task 4-5 |
| savings | Task 4-5 |
| bigCatch | Task 4-5 |
| grains | Task 4-5 |
| liveliness / prosperity / heavenlyBlessing / mizuho | Task 4-5 |
| bountifulYear / profit / bounty / perk | Task 4-5 |
| nestEgg | Task 6 |

- [ ] **Step 2: デバッグパネル(護符を任意付与できるUI)が新規idを自動的に扱えるか確認**

`src/routes`配下で護符付与のデバッグ機能を検索する(`Grep`で`ITEM_POOL`を参照している`+page.svelte`を探す)。`ITEM_POOL`をそのままプルダウン等の選択肢に使っている実装であれば、Task 3で`ITEM_POOL`に追加した時点で自動的に選択可能になっているはずなので、追加の実装は不要。もし護符idをハードコードしたリストがどこかにあれば、そこにも24件を追加する。

- [ ] **Step 3: npm run devで実際に動作確認**

Run: `npm run dev`
ブラウザで `http://localhost:5173` を開き、以下を確認する:
1. `/admin/shidasu-talismans` を開き、「グループ23: 売値ボーナス(方向性1)」が表示され、24件の名前・rarity・パラメータ・説明文が編集できることを確認する。
2. デバッグパネル等から`koban`(小判)を1個付与し、コンボを3まで伸ばすプレイをして、護符一覧(または売却画面)でその護符の売値が上昇していることを確認する。
3. `nestEgg`(儲蓄)を付与した状態で別の護符を売却し、儲蓄の売値が上昇することを確認する。

- [ ] **Step 4: 問題があれば修正、無ければ完了報告**

ビルドエラー・型エラー・画面崩れがあれば修正してから完了とする(プロジェクトCLAUDE.mdの完了前チェック)。

- [ ] **Step 5: 最終コミット(修正があった場合のみ)**

```bash
git add -A
git commit -m "fix: 方向性1護符の動作確認で見つかった不具合を修正"
```

---

## 自己レビュー用メモ(実装完了後にplan作成者が確認する事項)

- **spec coverage:** 設計docの「護符一覧(方向性1: 全24件)」表の24行全てがTask 4/6/7/8のいずれかでカバーされている。「エッジトリガーの明確化」の要件(コンボ・場札枚数閾値は瞬間発動)はTask 4のロジック(`comboBefore < c && comboAfter >= c`等の差分判定)で満たしている。「決算」のWave終了時事後判定・`playCountThisWave`はTask 1 Step 2・Task 8で対応済み。技術的前提1(sellBonus・itemSellPriceシグネチャ)はTask 1、技術的前提2(admin画面での変数編集)はTask 2・3で対応済み。
- **placeholder scan:** 全タスクに具体的なコード・テストコードを記載済み。当初Task 5 Step 6に型安全性の実装方針分岐(a)/(b)を残していたが、Task 4側の`RewardTalismanTriggerResult.amounts`契約(triggeredIdsに含まれるidは必ずamountsにも確定値を持つ)を先に確定させ、Task 5の`applyRewardTalismanTrigger`をその契約に沿った1通りの実装に統一した。
- **type consistency:** `HeldItem.sellBonus?`・`itemSellPrice(..., sellBonus: number = 0)`・`RewardTalismanTriggerResult { triggeredIds; amounts }`・`PlayTriggerContext`のフィールド名は全タスクで一貫させている。
