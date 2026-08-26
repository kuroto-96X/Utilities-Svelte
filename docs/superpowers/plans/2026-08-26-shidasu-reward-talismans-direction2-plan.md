# 報酬増加系護符(方向性2・8件) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `docs/superpowers/specs/2026-08-25-shidasu-reward-talismans-implementation-design.md`の「方向性非依存→方向性2扱い: 全8件」を実装する。方向性1(24件、実装済み)の`sellBonus`基盤に加え、`HeldRite`/`HeldRevelation`/`HeldOracle`への`sellBonus`拡張(還元用)、`HeldItem.randomTarget`(賞金・祝儀の個体別ランダム対象)、`HeldItem.rewardBonus`(恩賞の蓄積値)という3つの新しい状態管理を追加する。

**Architecture:** 8護符は効果の性質で3グループに分かれる。(A) プレイ中に`currency`(星片)へ即時加算するもの(賞金・僥倖・祝儀) — 新設`resolvePlayTriggeredCurrencyGain`関数で判定し、`applyPlayCard`で`run.currency`に反映する。(B) Wave終了時に`currency`へまとめて加算するもの(報奨・褒賞・恩賞) — `resolveWaveEnd`内で直接計算する。(C) その他のトリガー(配当は妨害発動時、還元はWave終了時に売値ボーナスを付与)。`sellBonus`系(還元)は方向性1で確立した`HeldItem.sellBonus`パターンを`HeldRite`/`HeldRevelation`/`HeldOracle`にも展開する。

**Tech Stack:** TypeScript, Vitest, SvelteKit (既存の`src/lib/game/shidasu/`配下の純粋関数群への追加)

---

## 前提知識(既存コードの構造、方向性1実装完了後の状態)

- `HeldItem = { instanceId: number; id: ItemId; sellBonus?: number }`(`types.ts:401`)。`HeldRite`/`HeldRevelation`/`HeldOracle`は現在`sellBonus`を持たない(`types.ts:402-404`)。
- `itemSellPrice(params, run, id, sellBonus = 0)`(`shop.ts:69-71`)は既にsellBonus対応済み。`riteSellPrice(params, run)`/`revelationSellPrice(params, run)`/`oracleSellPrice(params, run)`(`shop.ts:78-100`)は個体別引数を受け取らない一律価格のまま。
- `sellRite`/`sellRevelation`/`sellOracle`(`engine.ts`、`sellFromArray`共通ヘルパー経由)。`sellFromArray<T>(run, arrayField, arr, instanceId, price): RunState`(`engine.ts:1725-1731`、対象が見つからなければ`run`をそのまま返す)。
- `triggerSabotage(params, run, id, rand): RunState`(`engine.ts:1181-1201`)。妨害行動が実際に発動した時点で呼ばれる、`RunState`全体を持つ関数。
- `finishShop(params, run, seed): RunState`(`engine.ts:1140-1145`)。ショップ終了時、次Waveの`startWave`を呼ぶ唯一の入口(`beginRun`は`phase: 'shop'`で開始するため、全てのWave開始はここを通る)。`run.items`への書き戻しは現在無い。
- `applyPlayCard(params, run, colIndex, rand, rowIndex): RunState`(`engine.ts:1800-1807`)。`playCard`の戻り値`rewardTalismanTrigger`を使い`applyRewardTalismanTrigger`で`run.items`の`sellBonus`を更新する既存パターンがある。
- `resolvePlayTriggeredRewardTalismans(params, heldIds: ItemId[], ctx: PlayTriggerContext): RewardTalismanTriggerResult`(`rewardTalismanEffects.ts:34-125`)。方向性1のプレイ中トリガー14種の判定ロジック。
- `resolveWaveEnd(params, run, rand, seed): RunState`(`engine.ts:1027-1066`)。Wave成功クリア確定時の`currency`加算・`items`のsellBonus更新(決算)が既にある。`isBossWave(params, run.waveIndex)`(`engine.ts:869-872`、`waveIndex === wavesPerStage - 1`)がステージクリア判定。
- `ORACLE_POOL: RoleName[]`(`oracles.ts:8-10`、10役全件)。役をランダムに1つ選ぶ際に使える。
- `isFace(card): boolean`(`patterns.ts:26-28`、`rank >= 11`)。J/Q/K判定にそのまま使える。
- `DeckCard { deckId, suit, rank, wild, removed }`(`types.ts:162-170`)。ランク別集計の既存ヘルパーは無い。
- `RunState.currency: number`(星片所持数)。`RunState.stageIndex`(ステージ管理)。
- Admin画面(`/admin/shidasu-talismans`)は`ITEM_GROUPS`にidを追加するだけで自動反映(方向性1で確認済み)。

## 8護符の英語ID対応表

| 日本語名 | ItemId | rarity | 効果分類 |
|---|---|---|---|
| 配当 | `dividend` | C | 妨害発動トリガー |
| 賞金 | `prizeMoney` | C | プレイ中currency加算(ランダムランク、Wave単位再抽選) |
| 僥倖 | `windfall` | U | プレイ中currency加算(確率) |
| 祝儀 | `celebration` | C | プレイ中currency加算(ランダム役、Wave単位再抽選) |
| 還元 | `refund` | U | Wave終了時、全保有品のsellBonus加算 |
| 報奨 | `bonus` | C | Wave終了時currency加算 |
| 褒賞 | `commendation` | U | Wave終了時currency加算(デッキ内ランク集計) |
| 恩賞 | `grace` | R | Wave終了時currency加算(蓄積増加) |

**注意:** `grace`は既存`ItemId`に「架橋の対」として既に存在する可能性がある。Task 1の実装前に`types.ts`の既存`ItemId`一覧を確認し、衝突する場合は`favor`など別名に変更すること(既存の`grace`は"pardon"ではなく別の護符名の可能性があるため、必ず事前確認する)。

---

## Task 1: 型定義の拡張 — sellBonus(rite/revelation/oracle)・randomTarget・rewardBonus

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`
- Test: (型のみの変更のため専用テストは無し、後続タスクのテストで検証される)

- [ ] **Step 1: 既存ItemIdとの名前衝突確認**

`types.ts`の`ItemId`ユニオン型全体を読み、`dividend`/`prizeMoney`/`windfall`/`celebration`/`refund`/`bonus`/`commendation`/`grace`の8つが既存と衝突しないか確認する。衝突があれば別名に変更し、以降の全タスクの該当箇所を統一すること(このプラン内では衝突が無い前提で`grace`のまま記述しているが、実際に衝突していた場合は実装者の判断で`favor`等に置き換え、プラン内の全出現箇所を読み替えて進めること)。

- [ ] **Step 2: HeldRite/HeldRevelation/HeldOracleにsellBonusを追加**

`types.ts`の該当箇所(`export interface HeldRite { instanceId: number; id: RiteId }`等)を変更:

```ts
export interface HeldRite { instanceId: number; id: RiteId; sellBonus?: number }
export interface HeldRevelation { instanceId: number; id: RevelationId; sellBonus?: number }
export interface HeldOracle { instanceId: number; id: RoleName; sellBonus?: number }
```

- [ ] **Step 3: HeldItemにrandomTarget・rewardBonusを追加**

`types.ts`の`HeldItem`定義を変更:

```ts
export interface HeldItem {
  instanceId: number
  id: ItemId
  sellBonus?: number
  // 賞金(prizeMoney)・祝儀(celebration)用: Wave開始時(finishShop)にinstanceIdごと独立して
  // 再抽選されるランダム対象。prizeMoneyはRank、celebrationはRoleNameを持つ。他の護符では未使用。
  randomTarget?: Rank | RoleName
  // 恩賞(grace)用: Wave終了時に付与するcurrency量の現在値。取得時にparams.talismans.grace.nで
  // 初期化され、ステージクリアのたびparams.talismans.grace.aずつ増加する。他の護符では未使用。
  rewardBonus?: number
}
```

- [ ] **Step 4: ビルド・型チェック**

Run: `npm run build`
Run: `npm run check`

型エラーが出た場合、`HeldRite`/`HeldRevelation`/`HeldOracle`をリテラルで直接組み立てている既存テストファイルがあれば、そのままで動くはず(全フィールドoptionalなので追加フィールドを省略しても型エラーにならない)。もしエラーが出た場合は該当箇所を確認して対応する。

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/types.ts
git commit -m "feat: HeldRite/HeldRevelation/HeldOracleのsellBonus、HeldItemのrandomTarget/rewardBonusを追加"
```

---

## Task 2: params.tsに8護符のパラメータ定義を追加

**Files:**
- Modify: `src/lib/game/shidasu/types.ts` (ItemIdユニオン型)
- Modify: `src/lib/game/shidasu/params.ts`
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Test: `src/lib/game/shidasu/params.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`params.test.ts`に追記:

```ts
test('方向性2の8護符がtalismansに定義されている', () => {
  const ids = ['dividend', 'prizeMoney', 'windfall', 'celebration', 'refund', 'bonus', 'commendation', 'grace'] as const
  for (const id of ids) {
    expect(DEFAULT_PARAMS.talismans[id]).toBeDefined()
    expect(typeof DEFAULT_PARAMS.talismans[id].name).toBe('string')
  }
})
```

(Task 1 Step 1で名前衝突により別名に変更した場合は、このidリストも読み替えること。)

- [ ] **Step 2: テストを実行し失敗を確認**

Run: `npm run test -- params.test.ts`
Expected: FAIL

- [ ] **Step 3: types.tsのItemIdユニオン型に8件追加**

`types.ts`の`ItemId`ユニオン型末尾(方向性1で追加した24件のさらに末尾)に追加:

```ts
  | 'dividend' | 'prizeMoney' | 'windfall' | 'celebration'
  | 'refund' | 'bonus' | 'commendation' | 'grace'
```

- [ ] **Step 4: params.tsのtalismans型定義に8件追加**

`params.ts`の`talismans`型定義末尾に追加:

```ts
    dividend: { name: string; n: number; rarity: Rarity; desc: string }
    prizeMoney: { name: string; n: number; rarity: Rarity; desc: string }
    windfall: { name: string; p: number; n: number; rarity: Rarity; desc: string }
    celebration: { name: string; n: number; rarity: Rarity; desc: string }
    refund: { name: string; n: number; rarity: Rarity; desc: string }
    bonus: { name: string; n: number; rarity: Rarity; desc: string }
    commendation: { name: string; l: number; n: number; rarity: Rarity; desc: string }
    grace: { name: string; n: number; a: number; rarity: Rarity; desc: string }
```

- [ ] **Step 5: DEFAULT_PARAMS.talismansに8件のデフォルト値を追加**

`params.ts`の`DEFAULT_PARAMS.talismans`オブジェクト末尾に追加:

```ts
    dividend: { name: '配当', n: 5, rarity: 'C', desc: '星の妨害行動が発動するたび、星片に{n}を加算する' },
    prizeMoney: { name: '賞金', n: 2, rarity: 'C', desc: 'ランク{randomTarget}のカードをプレイするたび、星片に{n}を加算する(対象ランクはウェーブごとにランダムに決まる)' },
    windfall: { name: '僥倖', p: 25, n: 2, rarity: 'U', desc: 'J・Q・Kのいずれかをプレイしたとき、{p}%の確率で星片に{n}を加算する' },
    celebration: { name: '祝儀', n: 2, rarity: 'C', desc: '役が成立するたび、星片に{n}を加算する(対象の役はウェーブごとにランダムに決まる)' },
    refund: { name: '還元', n: 1, rarity: 'U', desc: 'ウェーブ終了時、所持している護符・秘儀・天啓・神託すべての売値に{n}を加算する' },
    bonus: { name: '報奨', n: 3, rarity: 'C', desc: 'ウェーブ終了時、星片に{n}を加算する' },
    commendation: { name: '褒賞', l: 7, n: 1, rarity: 'U', desc: 'ウェーブ終了時、デッキにあるランク{l}のカード1枚につき星片に{n}を加算する' },
    grace: { name: '恩賞', n: 2, a: 1, rarity: 'R', desc: 'ウェーブ終了時、星片に加算する(ステージクリアごとに加算量が{a}ずつ増加して蓄積する)' },
```

**注記:** `prizeMoney`のdescテンプレート内`{randomTarget}`は、既存の`itemDesc`(`items.ts:45-52`)の変数展開の仕組み上、`params.talismans[id]`の数値フィールドしか展開できない(`entry`の`typeof value === 'number'`のみを`context`に詰める仕組みのため)。`randomTarget`は`HeldItem`側のランタイム状態でありparamsの静的フィールドではないため、この`{randomTarget}`プレースホルダーはそのままでは展開されない。Task 6でこの点を扱うため、ここでは一旦`desc`に含めたままにしておき、Task 6で対応方針を確定する。

- [ ] **Step 6: shidasu.config.jsonに同内容を追加**

`shidasu.config.json`の`talismans`オブジェクトに、Step 5と全く同じキー・値をJSON形式で追加する。

- [ ] **Step 7: テストを実行し成功を確認**

Run: `npm run test -- params.test.ts`
Expected: PASS

- [ ] **Step 8: ビルド・型チェック**

Run: `npm run build`
Run: `npm run check`

- [ ] **Step 9: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/params.test.ts
git commit -m "feat: 方向性2護符8件のparams定義を追加"
```

---

## Task 3: ITEM_POOL・ITEM_GROUPS・ITEM_ACTUAL_EFFECTSへの登録

**Files:**
- Modify: `src/lib/game/shidasu/items.ts`
- Modify: `src/lib/game/shidasu/itemGroups.ts`
- Modify: `src/lib/game/shidasu/itemActualEffects.ts`
- Test: `src/lib/game/shidasu/itemGroups.test.ts`

- [ ] **Step 1: 失敗するテストを追加**

`itemGroups.test.ts`に追記(既存の網羅性テストが無い場合。方向性1のTask 3で追加済みの類似テストがあれば、その隣に追加する):

```ts
test('方向性2の8護符がITEM_POOL・ITEM_GROUPSの両方に含まれる', () => {
  const ids = ['dividend', 'prizeMoney', 'windfall', 'celebration', 'refund', 'bonus', 'commendation', 'grace']
  const groupedIds = ITEM_GROUPS.flatMap(g => g.ids)
  for (const id of ids) {
    expect(ITEM_POOL).toContain(id)
    expect(groupedIds).toContain(id)
  }
})
```

- [ ] **Step 2: テストを実行し失敗を確認**

Run: `npm run test -- itemGroups.test.ts`
Expected: FAIL

- [ ] **Step 3: ITEM_POOLに8件追加**

`items.ts`の`ITEM_POOL`配列末尾(方向性1で追加した24件のさらに末尾)に追加:

```ts
  'dividend', 'prizeMoney', 'windfall', 'celebration',
  'refund', 'bonus', 'commendation', 'grace',
```

- [ ] **Step 4: ITEM_GROUPSに新規グループを追加**

`itemGroups.ts`の`ITEM_GROUPS`配列末尾(「グループ23: 売値ボーナス(方向性1)」の直後)に追加:

```ts
  { label: 'グループ24: 星片獲得(方向性2)', ids: ['dividend', 'prizeMoney', 'windfall', 'celebration', 'refund', 'bonus', 'commendation', 'grace'] },
```

- [ ] **Step 5: ITEM_ACTUAL_EFFECTSに8件追加**

`itemActualEffects.ts`の`ITEM_ACTUAL_EFFECTS`オブジェクト末尾に追加:

```ts
  // グループ24: 星片獲得(方向性2)
  dividend: '星の妨害行動(triggerSabotage)が発動するたび、星片(currency)にnを加算する',
  prizeMoney: 'プレイしたカードのランクがrandomTarget(ウェーブ開始時にinstanceIdごと再抽選)と一致するとき、星片にnを加算する',
  windfall: 'J・Q・Kのいずれかをプレイしたとき、p%の確率で星片にnを加算する',
  celebration: 'そのプレイでroleFiredにrandomTarget(ウェーブ開始時にinstanceIdごと再抽選)が含まれるとき、星片にnを加算する',
  refund: 'ウェーブ終了時、所持している護符・秘儀・天啓・神託すべて(refund自身を含む)のsellBonusにnを加算する',
  bonus: 'ウェーブ終了時、無条件で星片にnを加算する',
  commendation: 'ウェーブ終了時、deckComposition内のランクlの現存カード枚数×nを星片に加算する',
  grace: 'ウェーブ終了時、所持するgraceインスタンスごとにrewardBonusの現在値を星片に加算する。ステージクリア(isBossWave)時はrewardBonusにaを加算して蓄積する',
```

- [ ] **Step 6: テストを実行し成功を確認**

Run: `npm run test -- itemGroups.test.ts`
Expected: PASS

- [ ] **Step 7: ビルド・型チェック**

Run: `npm run build`
Run: `npm run check`

- [ ] **Step 8: コミット**

```bash
git add src/lib/game/shidasu/items.ts src/lib/game/shidasu/itemGroups.ts src/lib/game/shidasu/itemActualEffects.ts src/lib/game/shidasu/itemGroups.test.ts
git commit -m "feat: 方向性2護符8件をITEM_POOL/ITEM_GROUPS/ITEM_ACTUAL_EFFECTSへ登録"
```

---

## Task 4: 還元(refund)— rite/revelation/oracleのsellBonus対応とWave終了時トリガー

**Files:**
- Modify: `src/lib/game/shidasu/shop.ts` (`riteSellPrice`/`revelationSellPrice`/`oracleSellPrice`)
- Modify: `src/lib/game/shidasu/engine.ts` (`sellRite`/`sellRevelation`/`sellOracle`/`resolveWaveEnd`/`mitsu`天啓)
- Test: `src/lib/game/shidasu/shop.test.ts`, `src/lib/game/shidasu/engine.test.ts`

このタスクは方向性2で最も影響範囲が広い。`itemSellPrice`が方向性1のTask 1で辿った変更(`sellBonus`引数追加)を、`riteSellPrice`/`revelationSellPrice`/`oracleSellPrice`にも同様に適用する。

- [ ] **Step 1: 失敗するテストを書く**

`shop.test.ts`の`describe('価格関数', ...)`ブロック内に追記:

```ts
  test('riteSellPriceはsellBonusを加算する', () => {
    const run = createInitialRun()
    expect(riteSellPrice(DEFAULT_PARAMS, run, 5)).toBe(riteSellPrice(DEFAULT_PARAMS, run) + 5)
  })

  test('revelationSellPriceはsellBonusを加算する', () => {
    const run = createInitialRun()
    expect(revelationSellPrice(DEFAULT_PARAMS, run, 5)).toBe(revelationSellPrice(DEFAULT_PARAMS, run) + 5)
  })

  test('oracleSellPriceはsellBonusを加算する', () => {
    const run = createInitialRun()
    expect(oracleSellPrice(DEFAULT_PARAMS, run, 5)).toBe(oracleSellPrice(DEFAULT_PARAMS, run) + 5)
  })
```

- [ ] **Step 2: テストを実行し失敗を確認**

Run: `npm run test -- shop.test.ts`
Expected: FAIL

- [ ] **Step 3: shop.tsの3関数にsellBonus引数を追加**

`shop.ts`の該当3関数を変更:

```ts
export function riteSellPrice(params: ShidasuParams, run: RunState, sellBonus: number = 0): number {
  return categoryPrice(params, run, params.shop.ritePrice, 'sell') + sellBonus
}

export function revelationSellPrice(params: ShidasuParams, run: RunState, sellBonus: number = 0): number {
  return categoryPrice(params, run, params.shop.revelationPrice, 'sell') + sellBonus
}

export function oracleSellPrice(params: ShidasuParams, run: RunState, sellBonus: number = 0): number {
  return categoryPrice(params, run, params.shop.oraclePrice, 'sell') + sellBonus
}
```

(buyPrice系の3関数は変更しない。sellBonusは売却時のみ適用される概念のため。)

- [ ] **Step 4: sellRite/sellRevelation/sellOracleを更新**

`engine.ts`の該当3関数を変更:

```ts
export function sellRite(params: ShidasuParams, run: RunState, instanceId: number, riteId: RiteId): RunState {
  const held = run.rites.find(h => h.instanceId === instanceId)
  return sellFromArray(run, 'rites', run.rites, instanceId, riteSellPrice(params, run, held?.sellBonus ?? 0))
}

export function sellRevelation(params: ShidasuParams, run: RunState, instanceId: number, revelationId: RevelationId): RunState {
  const held = run.revelations.find(h => h.instanceId === instanceId)
  return sellFromArray(run, 'revelations', run.revelations, instanceId, revelationSellPrice(params, run, held?.sellBonus ?? 0))
}

export function sellOracle(params: ShidasuParams, run: RunState, instanceId: number, roleName: RoleName): RunState {
  const held = run.oracles.find(h => h.instanceId === instanceId)
  return sellFromArray(run, 'oracles', run.oracles, instanceId, oracleSellPrice(params, run, held?.sellBonus ?? 0))
}
```

- [ ] **Step 5: テストを実行し成功を確認**

Run: `npm run test -- shop.test.ts`
Expected: PASS

- [ ] **Step 6: 還元(refund)のWave終了時トリガーをresolveWaveEndに追加**

`resolveWaveEnd`関数内、決算(settlement)の`items`計算の直後(既存の`const items = settlementQualifies ? ... : run.items`の直後)に追加:

```ts
  // 還元: ウェーブ終了時、所持している護符・秘儀・天啓・神託すべて(還元自身を含む)のsellBonusにnを加算する。
  const refundHeld = run.items.some(h => h.id === 'refund')
  const itemsAfterRefund = refundHeld
    ? items.map(h => ({ ...h, sellBonus: (h.sellBonus ?? 0) + params.talismans.refund.n }))
    : items
  const ritesAfterRefund = refundHeld
    ? run.rites.map(h => ({ ...h, sellBonus: (h.sellBonus ?? 0) + params.talismans.refund.n }))
    : run.rites
  const revelationsAfterRefund = refundHeld
    ? run.revelations.map(h => ({ ...h, sellBonus: (h.sellBonus ?? 0) + params.talismans.refund.n }))
    : run.revelations
  const oraclesAfterRefund = refundHeld
    ? run.oracles.map(h => ({ ...h, sellBonus: (h.sellBonus ?? 0) + params.talismans.refund.n }))
    : run.oracles
```

続けて`runWithCurrency`オブジェクト構築部を変更し、上記4変数を反映する:

```ts
  const runWithCurrency = {
    ...run,
    currency: run.currency + earned,
    items: itemsAfterRefund,
    rites: ritesAfterRefund,
    revelations: revelationsAfterRefund,
    oracles: oraclesAfterRefund,
    dedicationX: wave.dedicationX,
    diligenceX: wave.diligenceX,
    divineProtectionX: wave.divineProtectionX,
    discretionN: wave.discretionN,
    frostX: wave.frostX,
    echoX: wave.echoX,
    shootingStarN: wave.shootingStarN,
  }
```

(元の`items: items,`という行を`items: itemsAfterRefund,`に置き換える形になる。決算(settlement)由来の`items`変数を土台にして、その上に還元の加算を重ねる順序を守ること。)

- [ ] **Step 7: mitsu天啓の合計計算を確認**

`engine.ts`内の`mitsu`ケース(`runAfterRemoval.items.reduce((sum, h) => sum + itemSellPrice(params, runAfterRemoval, h.id, h.sellBonus ?? 0), 0)`)は護符のみを対象にしており、rite/revelation/oracleの`sellBonus`は含まれない。これは仕様通り(`mitsu`は元々護符限定の効果)なので変更不要。ただし、この関数を変更する必要が無いことを確認するためだけに、該当箇所を一度読んでおくこと。

- [ ] **Step 8: 失敗するテストを書く(還元のWave終了時トリガー)**

`engine.test.ts`に追記(方向性1の「決算(settlement)」テストの近く、既存の`endedRun`ヘルパーを使う):

```ts
describe('還元(refund)', () => {
  test('ウェーブクリア時、護符・秘儀・天啓・神託すべてのsellBonusが加算される(還元自身も含む)', () => {
    let run = {
      ...createInitialRun(),
      phase: 'playing' as const,
      items: [{ instanceId: 1, id: 'refund' as const }, { instanceId: 2, id: 'bridge' as const }],
      rites: [{ instanceId: 3, id: 'raidho' as const }],
      revelations: [{ instanceId: 4, id: 'kaku' as const }],
      oracles: [{ instanceId: 5, id: 'flush' as const }],
      nextInstanceId: 6,
    }
    const { wave, deckComposition } = startWave(DEFAULT_PARAMS, 0, 0, ['refund', 'bridge'], run.deckComposition, 1)
    run = { ...run, deckComposition, wave: { ...wave, status: 'ended', endReason: 'fullClear', score: 999999 } }
    const result = resolveWaveEnd(DEFAULT_PARAMS, run, createRng(1))
    expect(result.items.find(h => h.instanceId === 1)?.sellBonus).toBe(DEFAULT_PARAMS.talismans.refund.n)
    expect(result.items.find(h => h.instanceId === 2)?.sellBonus).toBe(DEFAULT_PARAMS.talismans.refund.n)
    expect(result.rites.find(h => h.instanceId === 3)?.sellBonus).toBe(DEFAULT_PARAMS.talismans.refund.n)
    expect(result.revelations.find(h => h.instanceId === 4)?.sellBonus).toBe(DEFAULT_PARAMS.talismans.refund.n)
    expect(result.oracles.find(h => h.instanceId === 5)?.sellBonus).toBe(DEFAULT_PARAMS.talismans.refund.n)
  })

  test('還元を所持していなければsellBonusは加算されない', () => {
    let run = {
      ...createInitialRun(),
      phase: 'playing' as const,
      items: [{ instanceId: 1, id: 'bridge' as const }],
      nextInstanceId: 2,
    }
    const { wave, deckComposition } = startWave(DEFAULT_PARAMS, 0, 0, ['bridge'], run.deckComposition, 1)
    run = { ...run, deckComposition, wave: { ...wave, status: 'ended', endReason: 'fullClear', score: 999999 } }
    const result = resolveWaveEnd(DEFAULT_PARAMS, run, createRng(1))
    expect(result.items.find(h => h.instanceId === 1)?.sellBonus ?? 0).toBe(0)
  })
})
```

`score: 999999`でクリア扱いにする方式が既存の`endedRun`ヘルパー等と食い違う場合は、方向性1のTask 8実装時に採用された既存ヘルパーの使い方に合わせて書き直してよい(`resolveWaveEnd`の既存テストを探して同じセットアップ手法を使うこと)。

- [ ] **Step 9: テストを実行し失敗→成功を確認**

Run: `npm run test -- engine.test.ts -t "還元"`
Expected: 実装前FAIL、実装後PASS

- [ ] **Step 10: 全体テストスイート・ビルド・型チェック**

Run: `npm run test`
Run: `npm run build`
Run: `npm run check`

- [ ] **Step 11: コミット**

```bash
git add src/lib/game/shidasu/shop.ts src/lib/game/shidasu/engine.ts src/lib/game/shidasu/shop.test.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 還元(refund)を実装、rite/revelation/oracleにsellBonus対応を追加"
```

---

## Task 5: 配当(dividend)— 妨害発動トリガーと報奨・褒賞・恩賞のWave終了時currency加算

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts` (`triggerSabotage`, `resolveWaveEnd`)
- Test: `src/lib/game/shidasu/engine.test.ts`

このタスクでは、配当(妨害トリガー)と報奨・褒賞・恩賞(Wave終了時トリガー、currencyへの直接加算)をまとめて実装する。いずれも「所持していれば無条件、または簡単な条件でcurrencyに加算する」という単純な効果のため、1タスクにまとめる。恩賞は`HeldItem.rewardBonus`の初期化・蓄積処理も含む。

- [ ] **Step 1: 失敗するテストを書く(配当)**

`engine.test.ts`に追記:

```ts
describe('配当(dividend)', () => {
  test('妨害行動が発動すると星片が加算される', () => {
    const run = {
      ...createInitialRun(),
      phase: 'playing' as const,
      items: [{ instanceId: 1, id: 'dividend' as const }],
      currency: 100,
      wave: startWave(DEFAULT_PARAMS, 0, 0, ['dividend'], createInitialRun().deckComposition, 1).wave,
    }
    const result = triggerSabotage(DEFAULT_PARAMS, run, 'stockPurge', createRng(1))
    expect(result.currency).toBe(100 + DEFAULT_PARAMS.talismans.dividend.n)
  })

  test('配当を所持していなければ星片は加算されない', () => {
    const run = {
      ...createInitialRun(),
      phase: 'playing' as const,
      items: [],
      currency: 100,
      wave: startWave(DEFAULT_PARAMS, 0, 0, [], createInitialRun().deckComposition, 1).wave,
    }
    const result = triggerSabotage(DEFAULT_PARAMS, run, 'stockPurge', createRng(1))
    expect(result.currency).toBe(100)
  })
})
```

`triggerSabotage`の第3引数`id`には、実在する`SabotageActionId`(例: `'stockPurge'`)を渡すこと。既存の`sabotageEffects.test.ts`または`sabotage.test.ts`を参照し、`triggerSabotage`のテストで使われている典型的な呼び出し方・セットアップ(特に`run.wave`が正しい形になっているか)に倣うこと。

- [ ] **Step 2: テストを実行し失敗を確認**

Run: `npm run test -- engine.test.ts -t "配当"`
Expected: FAIL

- [ ] **Step 3: triggerSabotageに配当の加算を追加**

`triggerSabotage`関数の戻り値構築部分の直前(関数最後の`return`文の前)に追加:

```ts
  const currencyAfterDividend = nextRun.items.some(h => h.id === 'dividend')
    ? nextRun.currency + params.talismans.dividend.n
    : nextRun.currency
```

そして最後の`return`オブジェクトに`currency: currencyAfterDividend`を追加する(既存の`return { ...nextRun, wave: {...} }`という形の`nextRun`スプレッドの後に`currency`を明示的に上書きする形。`nextRun`は既に`...run, ...result.run`を経ているため、その`currency`の上にさらに加算する形にすること)。

- [ ] **Step 4: テストを実行し成功を確認**

Run: `npm run test -- engine.test.ts -t "配当"`
Expected: PASS

- [ ] **Step 5: 失敗するテストを書く(報奨・褒賞・恩賞)**

`engine.test.ts`に追記:

```ts
describe('報奨(bonus)', () => {
  test('ウェーブクリア時、無条件で星片が加算される', () => {
    let run = {
      ...createInitialRun(),
      phase: 'playing' as const,
      items: [{ instanceId: 1, id: 'bonus' as const }],
      currency: 0,
      nextInstanceId: 2,
    }
    const { wave, deckComposition } = startWave(DEFAULT_PARAMS, 0, 0, ['bonus'], run.deckComposition, 1)
    run = { ...run, deckComposition, wave: { ...wave, status: 'ended', endReason: 'fullClear', score: 999999 } }
    const result = resolveWaveEnd(DEFAULT_PARAMS, run, createRng(1))
    // 通常のearned加算に加えて報奨のnが上乗せされているはず。厳密な等式より「増分」で検証する。
    const runWithoutBonus = { ...run, items: [] }
    const resultWithoutBonus = resolveWaveEnd(DEFAULT_PARAMS, runWithoutBonus, createRng(1))
    expect(result.currency - resultWithoutBonus.currency).toBe(DEFAULT_PARAMS.talismans.bonus.n)
  })
})

describe('褒賞(commendation)', () => {
  test('ウェーブクリア時、デッキ内の対象ランク枚数×nが星片に加算される', () => {
    let run = {
      ...createInitialRun(),
      phase: 'playing' as const,
      items: [{ instanceId: 1, id: 'commendation' as const }],
      currency: 0,
      nextInstanceId: 2,
    }
    const targetRankCount = run.deckComposition.filter(c => !c.removed && c.rank === DEFAULT_PARAMS.talismans.commendation.l).length
    const { wave, deckComposition } = startWave(DEFAULT_PARAMS, 0, 0, ['commendation'], run.deckComposition, 1)
    run = { ...run, deckComposition, wave: { ...wave, status: 'ended', endReason: 'fullClear', score: 999999 } }
    const result = resolveWaveEnd(DEFAULT_PARAMS, run, createRng(1))
    const runWithoutCommendation = { ...run, items: [] }
    const resultWithoutCommendation = resolveWaveEnd(DEFAULT_PARAMS, runWithoutCommendation, createRng(1))
    expect(result.currency - resultWithoutCommendation.currency).toBe(targetRankCount * DEFAULT_PARAMS.talismans.commendation.n)
  })
})

describe('恩賞(grace)', () => {
  test('取得直後の初回ウェーブクリアでは初期値nが星片に加算される', () => {
    let run = {
      ...createInitialRun(),
      phase: 'playing' as const,
      items: [{ instanceId: 1, id: 'grace' as const, rewardBonus: DEFAULT_PARAMS.talismans.grace.n }],
      currency: 0,
      nextInstanceId: 2,
    }
    const { wave, deckComposition } = startWave(DEFAULT_PARAMS, 0, 0, ['grace'], run.deckComposition, 1)
    run = { ...run, deckComposition, wave: { ...wave, status: 'ended', endReason: 'fullClear', score: 999999 } }
    const result = resolveWaveEnd(DEFAULT_PARAMS, run, createRng(1))
    const runWithoutGrace = { ...run, items: [] }
    const resultWithoutGrace = resolveWaveEnd(DEFAULT_PARAMS, runWithoutGrace, createRng(1))
    expect(result.currency - resultWithoutGrace.currency).toBe(DEFAULT_PARAMS.talismans.grace.n)
  })

  test('ステージクリア(最終ウェーブ)時、rewardBonusがaずつ増加して蓄積する', () => {
    let run = {
      ...createInitialRun(),
      phase: 'playing' as const,
      waveIndex: DEFAULT_PARAMS.flow.wavesPerStage - 1,
      items: [{ instanceId: 1, id: 'grace' as const, rewardBonus: DEFAULT_PARAMS.talismans.grace.n }],
      currency: 0,
      nextInstanceId: 2,
    }
    const { wave, deckComposition } = startWave(DEFAULT_PARAMS, 0, run.waveIndex, ['grace'], run.deckComposition, 1)
    run = { ...run, deckComposition, wave: { ...wave, status: 'ended', endReason: 'fullClear', score: 999999 } }
    const result = resolveWaveEnd(DEFAULT_PARAMS, run, createRng(1))
    const grace = result.items.find(h => h.instanceId === 1)
    expect(grace?.rewardBonus).toBe(DEFAULT_PARAMS.talismans.grace.n + DEFAULT_PARAMS.talismans.grace.a)
  })
})
```

`DEFAULT_PARAMS.flow.wavesPerStage`が実在するフィールド名か`params.ts`で確認し、異なる場合は正しいフィールド名に読み替えること。`isBossWave`関数の実装(`waveIndex === wavesPerStage - 1`)と一致する条件を使うこと。

- [ ] **Step 6: テストを実行し失敗を確認**

Run: `npm run test -- engine.test.ts -t "報奨|褒賞|恩賞"`
Expected: FAIL

- [ ] **Step 7: resolveWaveEndに報奨・褒賞・恩賞の判定を追加**

`resolveWaveEnd`関数内、Task 4で追加した還元の判定コードの直後に追加:

```ts
  // 報奨: ウェーブクリア時、無条件で星片にnを加算する。
  const bonusEarned = run.items.some(h => h.id === 'bonus') ? params.talismans.bonus.n : 0

  // 褒賞: ウェーブクリア時、デッキに現存するランクlのカード枚数×nを星片に加算する。
  const commendationHeld = run.items.some(h => h.id === 'commendation')
  const commendationEarned = commendationHeld
    ? run.deckComposition.filter(c => !c.removed && c.rank === params.talismans.commendation.l).length * params.talismans.commendation.n
    : 0

  // 恩賞: ウェーブクリア時、所持する各graceインスタンスのrewardBonus現在値を星片に加算する。
  // ステージクリア(このウェーブがステージの最終ウェーブ)の場合、rewardBonusにaを加算して蓄積する。
  const graceEarned = run.items.filter(h => h.id === 'grace').reduce((sum, h) => sum + (h.rewardBonus ?? params.talismans.grace.n), 0)
  const isStageClearing = isBossWave(params, run.waveIndex)
  const itemsAfterGrace = isStageClearing
    ? itemsAfterRefund.map(h => h.id === 'grace' ? { ...h, rewardBonus: (h.rewardBonus ?? params.talismans.grace.n) + params.talismans.grace.a } : h)
    : itemsAfterRefund
```

続けて`runWithCurrency`オブジェクト構築部を変更する。`currency`の計算式に`bonusEarned`・`commendationEarned`・`graceEarned`を合算し、`items`をTask 4の`itemsAfterRefund`から今回の`itemsAfterGrace`に差し替える:

```ts
  const runWithCurrency = {
    ...run,
    currency: run.currency + earned + bonusEarned + commendationEarned + graceEarned,
    items: itemsAfterGrace,
    rites: ritesAfterRefund,
    revelations: revelationsAfterRefund,
    oracles: oraclesAfterRefund,
    dedicationX: wave.dedicationX,
    diligenceX: wave.diligenceX,
    divineProtectionX: wave.divineProtectionX,
    discretionN: wave.discretionN,
    frostX: wave.frostX,
    echoX: wave.echoX,
    shootingStarN: wave.shootingStarN,
  }
```

- [ ] **Step 8: 恩賞取得時の初期化について確認**

`HeldItem.rewardBonus`は護符取得時(ショップ購入・福袋当選)に`params.talismans.grace.n`で初期化される必要がある。護符取得処理(`buyItem`または`grantItem`のような関数、`engine.ts`内で`items: [...run.items, { instanceId: ..., id: ... }]`のような形でitemsに新規追加している箇所を`grep`で検索する)を確認し、新規追加される`HeldItem`が`id === 'grace'`の場合のみ`rewardBonus: params.talismans.grace.n`を明示的に設定するよう変更する。該当箇所が複数(通常購入・福袋当選・スワップ確定等)ある可能性があるため、全て洗い出して対応すること。対応が漏れると、`rewardBonus`が`undefined`のまま`resolveWaveEnd`の`h.rewardBonus ?? params.talismans.grace.n`のフォールバックに頼ることになり、動作はするが「一度も蓄積が起きていないのか、フォールバック中なのか」が区別できなくなる点に注意(フォールバックがあるため機能的には壊れないが、Task 9でこの初期化が実際に行われているか確認すること)。

- [ ] **Step 9: テストを実行し成功を確認**

Run: `npm run test -- engine.test.ts -t "報奨|褒賞|恩賞"`
Expected: PASS

- [ ] **Step 10: 全体テストスイート・ビルド・型チェック**

Run: `npm run test`
Run: `npm run build`
Run: `npm run check`

- [ ] **Step 11: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 配当・報奨・褒賞・恩賞を実装"
```

---

## Task 6: 賞金(prizeMoney)・祝儀(celebration)のランダム対象決定(startWave/finishShop)

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts` (`finishShop`)
- Modify: `src/lib/game/shidasu/items.ts` (`itemDesc`、必要であれば)
- Test: `src/lib/game/shidasu/engine.test.ts`

このタスクでは、賞金・祝儀のランダム対象(`HeldItem.randomTarget`)をWave開始時(`finishShop`)に再抽選する処理を実装する。実際のcurrency加算ロジック(Task 7)より先に、このランダム対象決定の仕組みだけを独立して実装する。

- [ ] **Step 1: 失敗するテストを書く**

`engine.test.ts`に追記:

```ts
describe('賞金・祝儀のランダム対象再抽選', () => {
  test('finishShop実行時、賞金のrandomTargetが1〜13のランクに設定される', () => {
    // beginRunでphase: 'shop'・stageStars設定済みのRunStateを作り、finishShopの前提条件を満たす
    let run = beginRun(DEFAULT_PARAMS, 1)
    run = { ...run, items: [{ instanceId: 1, id: 'prizeMoney' as const }], nextInstanceId: 2 }
    const result = finishShop(DEFAULT_PARAMS, run, 1)
    const prizeMoney = result.items.find(h => h.instanceId === 1)
    expect(typeof prizeMoney?.randomTarget).toBe('number')
    expect(prizeMoney?.randomTarget).toBeGreaterThanOrEqual(1)
    expect(prizeMoney?.randomTarget).toBeLessThanOrEqual(13)
  })

  test('finishShop実行時、祝儀のrandomTargetがORACLE_POOL内の役に設定される', () => {
    let run = beginRun(DEFAULT_PARAMS, 1)
    run = { ...run, items: [{ instanceId: 1, id: 'celebration' as const }], nextInstanceId: 2 }
    const result = finishShop(DEFAULT_PARAMS, run, 1)
    const celebration = result.items.find(h => h.instanceId === 1)
    expect(ORACLE_POOL).toContain(celebration?.randomTarget)
  })

  test('同名を複数所持している場合、instanceIdごとに独立してrandomTargetが決まる(必ずしも同じ値である必要はない)', () => {
    let run = beginRun(DEFAULT_PARAMS, 1)
    run = { ...run, items: [{ instanceId: 1, id: 'prizeMoney' as const }, { instanceId: 2, id: 'prizeMoney' as const }], nextInstanceId: 3 }
    const result = finishShop(DEFAULT_PARAMS, run, 1)
    const a = result.items.find(h => h.instanceId === 1)
    const b = result.items.find(h => h.instanceId === 2)
    expect(typeof a?.randomTarget).toBe('number')
    expect(typeof b?.randomTarget).toBe('number')
    // 両方とも有効な値であることのみ検証(偶然同じ値になっても許容)
  })
})
```

上記1件目のテストコード中、`stageStars: ...`という無意味なplaceholder行は削除し、実際に`beginRun`を使ってセットアップすること(テストコード内のコメント`// stageStarsが必要な場合は...`以降の書き方を正として使う。最初の`run = { ... }`ブロックは書き損じなので無視してよい)。`ORACLE_POOL`のimportが`engine.test.ts`に無ければ追加すること。

- [ ] **Step 2: テストを実行し失敗を確認**

Run: `npm run test -- engine.test.ts -t "ランダム対象"`
Expected: FAIL

- [ ] **Step 3: finishShopにランダム対象再抽選ロジックを追加**

`engine.ts`に新規関数を追加(`finishShop`関数の直前が適切):

```ts
// 賞金・祝儀: ウェーブ開始のたび(finishShop経由)、instanceIdごとに独立してランダム対象を再抽選する。
// 賞金はRank(1〜13)、祝儀はORACLE_POOL内のRoleNameを対象とする。同名護符を複数所持していても
// 個体ごとに別々の値になりうる(instanceIdベースの個体管理という設計方針に沿う)。
function rerollRandomTargets(items: HeldItem[], rand: () => number): HeldItem[] {
  return items.map(h => {
    if (h.id === 'prizeMoney') {
      const rank = (Math.floor(rand() * 13) + 1) as Rank
      return { ...h, randomTarget: rank }
    }
    if (h.id === 'celebration') {
      const role = ORACLE_POOL[Math.floor(rand() * ORACLE_POOL.length)]
      return { ...h, randomTarget: role }
    }
    return h
  })
}
```

`ORACLE_POOL`のimportを`engine.ts`先頭に追加(`import { ORACLE_POOL } from './oracles'`、既にimport済みなら不要)。`Rank`型のimportも確認する。

`finishShop`関数を変更:

```ts
export function finishShop(params: ShidasuParams, run: RunState, seed?: number): RunState {
  if (run.phase !== 'shop') return run
  const star = run.stageStars[run.waveIndex]
  const rand = createRng(seed ?? Math.floor(Math.random() * 999999) + 1)
  const items = rerollRandomTargets(run.items, rand)
  const { wave, deckComposition } = startWave(params, run.stageIndex, run.waveIndex, items.map(h => h.id), run.deckComposition, seed, run.extraTableauRows, run.oracleLevels, run.dedicationX, run.diligenceX, run.divineProtectionX, run.discretionN, run.frostX, run.echoX, run.shootingStarN, star?.sabotage ?? { kind: 'none' })
  return { ...run, phase: 'playing', wave, waveGeneration: run.waveGeneration + 1, deckComposition, items, shop: null }
}
```

**注意:** `startWave`は内部で独自に`createRng(seed ?? ...)`を呼んで乱数列を生成する(`engine.ts`の`startWave`冒頭を確認)。今回`finishShop`側でも`rand`を新規生成しているが、`startWave`に渡す`seed`引数はそのまま維持しているため、`startWave`内部の乱数列(デッキシャッフル等)には影響しない(`finishShop`側の`rand`は`rerollRandomTargets`専用の独立した乱数列)。ただし`seed`が同一の場合、`rerollRandomTargets`用の乱数列と`startWave`内部の乱数列が同じシード値から独立に生成されるため、テストの再現性は保たれるがランダム対象とデッキシャッフルの相関は無いことに注意。

- [ ] **Step 4: テストを実行し成功を確認**

Run: `npm run test -- engine.test.ts -t "ランダム対象"`
Expected: PASS

- [ ] **Step 5: 全体テストスイート・ビルド・型チェック**

Run: `npm run test`
Run: `npm run build`
Run: `npm run check`

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 賞金・祝儀のランダム対象をfinishShopで再抽選する仕組みを追加"
```

---

## Task 7: 賞金(prizeMoney)・僥倖(windfall)・祝儀(celebration)— プレイ中currency加算トリガー

**Files:**
- Modify: `src/lib/game/shidasu/rewardTalismanEffects.ts` (新規関数追加)
- Modify: `src/lib/game/shidasu/engine.ts` (`playCard`, `applyPlayCard`)
- Test: `src/lib/game/shidasu/rewardTalismanEffects.test.ts`, `src/lib/game/shidasu/engine.test.ts`

賞金・僥倖・祝儀は、方向性1のプレイ中トリガー14種と同じ「プレイのたびに判定する」性質を持つが、効果が`sellBonus`ではなく`currency`(星片)への加算である点が異なる。また賞金・祝儀は`randomTarget`(instanceId単位のランタイム状態)を参照する必要があるため、方向性1の`resolvePlayTriggeredRewardTalismans`(`ItemId[]`のみを引数に取る)とは別の、`HeldItem[]`を引数に取る新規関数として実装する。

- [ ] **Step 1: 失敗するテストを書く**

`rewardTalismanEffects.test.ts`に追記:

```ts
import { resolvePlayTriggeredCurrencyGain, type CurrencyGainTriggerContext } from './rewardTalismanEffects'

describe('resolvePlayTriggeredCurrencyGain', () => {
  function baseCurrencyCtx(overrides: Partial<CurrencyGainTriggerContext> = {}): CurrencyGainTriggerContext {
    return {
      card: card('♠', 5),
      roleFired: [],
      ...overrides,
    }
  }

  test('賞金: プレイしたカードのランクがrandomTargetと一致すればcurrency加算対象になる', () => {
    const held = [{ instanceId: 1, id: 'prizeMoney' as const, randomTarget: 5 as const }]
    const ctx = baseCurrencyCtx({ card: card('♠', 5) })
    const result = resolvePlayTriggeredCurrencyGain(DEFAULT_PARAMS, held, ctx, () => 0.99)
    expect(result.totalGain).toBe(DEFAULT_PARAMS.talismans.prizeMoney.n)
  })

  test('賞金: ランクが一致しなければcurrency加算されない', () => {
    const held = [{ instanceId: 1, id: 'prizeMoney' as const, randomTarget: 5 as const }]
    const ctx = baseCurrencyCtx({ card: card('♠', 6) })
    const result = resolvePlayTriggeredCurrencyGain(DEFAULT_PARAMS, held, ctx, () => 0.99)
    expect(result.totalGain).toBe(0)
  })

  test('僥倖: J/Q/Kプレイ時、確率roll次第でcurrency加算される', () => {
    const held = [{ instanceId: 1, id: 'windfall' as const }]
    const ctx = baseCurrencyCtx({ card: card('♠', 13) })
    const resultHit = resolvePlayTriggeredCurrencyGain(DEFAULT_PARAMS, held, ctx, () => 0)
    expect(resultHit.totalGain).toBe(DEFAULT_PARAMS.talismans.windfall.n)
    const resultMiss = resolvePlayTriggeredCurrencyGain(DEFAULT_PARAMS, held, ctx, () => 0.99)
    expect(resultMiss.totalGain).toBe(0)
  })

  test('僥倖: J/Q/K以外では確率判定自体が発生しない', () => {
    const held = [{ instanceId: 1, id: 'windfall' as const }]
    const ctx = baseCurrencyCtx({ card: card('♠', 5) })
    const result = resolvePlayTriggeredCurrencyGain(DEFAULT_PARAMS, held, ctx, () => 0)
    expect(result.totalGain).toBe(0)
  })

  test('祝儀: 成立した役がrandomTargetと一致すればcurrency加算対象になる', () => {
    const held = [{ instanceId: 1, id: 'celebration' as const, randomTarget: 'flush' as const }]
    const ctx = baseCurrencyCtx({ roleFired: [{ name: 'flush', usedWild: false, amount: 10 }] })
    const result = resolvePlayTriggeredCurrencyGain(DEFAULT_PARAMS, held, ctx, () => 0.99)
    expect(result.totalGain).toBe(DEFAULT_PARAMS.talismans.celebration.n)
  })

  test('祝儀: randomTargetと異なる役が成立してもcurrency加算されない', () => {
    const held = [{ instanceId: 1, id: 'celebration' as const, randomTarget: 'flush' as const }]
    const ctx = baseCurrencyCtx({ roleFired: [{ name: 'pair', usedWild: false, amount: 10 }] })
    const result = resolvePlayTriggeredCurrencyGain(DEFAULT_PARAMS, held, ctx, () => 0.99)
    expect(result.totalGain).toBe(0)
  })

  test('複数所持していれば個体ごとに独立して加算が積み上がる', () => {
    const held = [
      { instanceId: 1, id: 'prizeMoney' as const, randomTarget: 5 as const },
      { instanceId: 2, id: 'prizeMoney' as const, randomTarget: 5 as const },
    ]
    const ctx = baseCurrencyCtx({ card: card('♠', 5) })
    const result = resolvePlayTriggeredCurrencyGain(DEFAULT_PARAMS, held, ctx, () => 0.99)
    expect(result.totalGain).toBe(DEFAULT_PARAMS.talismans.prizeMoney.n * 2)
  })
})
```

`card`ヘルパー関数は同ファイル冒頭に既存のもの(方向性1のTask 4で追加済み)を再利用する。

- [ ] **Step 2: テストを実行し失敗を確認**

Run: `npm run test -- rewardTalismanEffects.test.ts -t "resolvePlayTriggeredCurrencyGain"`
Expected: FAIL(モジュールが該当exportを持たない)

- [ ] **Step 3: rewardTalismanEffects.tsに新規関数を追加**

`rewardTalismanEffects.ts`の末尾に追加(importに`HeldItem`型を追加する必要あり):

```ts
export interface CurrencyGainTriggerContext {
  card: Card
  roleFired: { name: RoleName; usedWild: boolean; amount: number }[]
}

export interface CurrencyGainTriggerResult {
  totalGain: number
}

// プレイ中に即座にcurrency(星片)へ加算される、方向性2の3種(賞金・僥倖・祝儀)を判定する。
// 賞金・祝儀はHeldItem.randomTarget(ウェーブ開始時にinstanceIdごと再抽選済み)を参照するため、
// heldはItemId[]ではなくHeldItem[]全体を受け取る。同名複数所持時は個体ごとに独立して判定・加算する。
export function resolvePlayTriggeredCurrencyGain(
  params: ShidasuParams,
  held: HeldItem[],
  ctx: CurrencyGainTriggerContext,
  rand: () => number = Math.random
): CurrencyGainTriggerResult {
  let totalGain = 0
  for (const h of held) {
    if (h.id === 'prizeMoney' && !ctx.card.wild && h.randomTarget === ctx.card.rank) {
      totalGain += params.talismans.prizeMoney.n
    } else if (h.id === 'windfall' && isFace(ctx.card)) {
      if (rand() * 100 < params.talismans.windfall.p) totalGain += params.talismans.windfall.n
    } else if (h.id === 'celebration' && ctx.roleFired.some(r => r.name === h.randomTarget)) {
      totalGain += params.talismans.celebration.n
    }
  }
  return { totalGain }
}
```

`isFace`のimportを`rewardTalismanEffects.ts`先頭に追加(`import { analyzeStair, analyzeSuitColor, analyzeAlternatingColor, isFace } from './patterns'`)。`HeldItem`型のimportも追加。

- [ ] **Step 4: テストを実行し成功を確認**

Run: `npm run test -- rewardTalismanEffects.test.ts`
Expected: PASS(既存テストも含め全件)

- [ ] **Step 5: playCard/applyPlayCardに組み込むための失敗テストを書く**

`engine.test.ts`に追記:

```ts
describe('賞金・僥倖・祝儀: プレイ中currency加算', () => {
  test('賞金所持中、randomTargetと同じランクをプレイするとcurrencyが加算される', () => {
    let run = { ...createInitialRun(), phase: 'playing' as const, items: [{ instanceId: 1, id: 'prizeMoney' as const, randomTarget: 6 as const }], currency: 0, nextInstanceId: 2 }
    const { wave, deckComposition } = startWave(DEFAULT_PARAMS, 0, 0, ['prizeMoney'], run.deckComposition, 1)
    run = { ...run, wave, deckComposition }
    const colIndex = run.wave!.tableau.findIndex(col => col.length > 0)
    run = { ...run, wave: { ...run.wave!, tableau: run.wave!.tableau.map((col, i) => i === colIndex ? [...col.slice(0, -1), { id: 999, deckId: 999, suit: '♣' as const, rank: 6 as const, wild: false }] : col) } }
    const result = applyPlayCard(DEFAULT_PARAMS, run, colIndex, createRng(1))
    expect(result.currency).toBe(DEFAULT_PARAMS.talismans.prizeMoney.n)
  })
})
```

- [ ] **Step 6: テストを実行し失敗を確認**

Run: `npm run test -- engine.test.ts -t "プレイ中currency加算"`
Expected: FAIL

- [ ] **Step 7: playCardの戻り値にcurrencyGainを追加**

`playCard`関数の戻り値の型を変更(既存の`rewardTalismanTrigger`フィールドの隣に追加):

```ts
): { wave: WaveState; deckComposition: DeckCard[]; rewardTalismanTrigger: RewardTalismanTriggerResult; currencyGainHeldItems: HeldItem[] | null } {
```

**設計上の注意:** `playCard`は`items: ItemId[]`のみを引数に持ち、`HeldItem[]`(instanceId・randomTarget込み)を持たない。賞金・祝儀の判定には`randomTarget`が必須のため、`playCard`関数自体にシグネチャ変更で`heldItems: HeldItem[]`を追加で受け取らせる必要がある。以下の方針で実装すること:

1. `playCard`関数のパラメータリストに`heldItems: HeldItem[]`を追加する(既存の`items: ItemId[]`パラメータの直後に追加するのが分かりやすい)。
2. 関数内、`resolvePlayTriggeredRewardTalismans`を呼んでいる箇所の直後に以下を追加:

```ts
  const currencyGainCtx: CurrencyGainTriggerContext = { card, roleFired }
  const currencyGainResult = resolvePlayTriggeredCurrencyGain(params, heldItems, currencyGainCtx, rand)
```

3. 関数の全てのreturn文(早期return含む)に`currencyGain: 0`(早期return時)または`currencyGain: currencyGainResult.totalGain`(通常return時)を追加する。**ただし**、返り値の型を`currencyGainHeldItems: HeldItem[] | null`ではなく、単純に`currencyGain: number`(常に0以上の確定値)にする方が扱いやすい。上記の型シグネチャ例の`currencyGainHeldItems: HeldItem[] | null`は誤りなので使わず、代わりに以下の型にすること:

```ts
): { wave: WaveState; deckComposition: DeckCard[]; rewardTalismanTrigger: RewardTalismanTriggerResult; currencyGain: number } {
```

早期return箇所には`currencyGain: 0`を追加し、通常のreturn文には`currencyGain: currencyGainResult.totalGain`を追加する。

4. `resolvePlayTriggeredCurrencyGain`・`CurrencyGainTriggerContext`のimportを`engine.ts`先頭に追加する。

- [ ] **Step 8: playCardの呼び出し元(applyPlayCard)を更新**

`applyPlayCard`関数を変更:

```ts
export function applyPlayCard(params: ShidasuParams, run: RunState, colIndex: number, rand: () => number = Math.random, rowIndex?: number): RunState {
  if (run.phase !== 'playing' || !run.wave) return run
  const modifier = stageModifierFor(params, run)
  const { target, scoreLock, effectiveItems, sealedRoleEffect, comboCap } = resolvePlayContext(params, run, run.wave)
  const { wave, deckComposition, rewardTalismanTrigger, currencyGain } = playCard(params, run.wave, modifier, effectiveItems, run.items, target, colIndex, run.deckComposition, rand, scoreLock, rowIndex, sealedRoleEffect, comboCap)
  const items = applyRewardTalismanTrigger(run.items, rewardTalismanTrigger)
  return resolveActionSabotage(params, { ...run, wave, deckComposition, items, currency: run.currency + currencyGain }, wave, rand)
}
```

**重要:** `playCard`の引数リストに`heldItems`(=`run.items`)を挿入する位置は、既存の`items: ItemId[]`パラメータの直後という指定に合わせて、呼び出し側の引数順序も正確に一致させること。上記の呼び出し例は`effectiveItems`(ItemId[]、既存)の直後に`run.items`(HeldItem[]、新規)を渡す想定だが、**実際の`playCard`関数の現在のパラメータ順序を必ず確認してから、対応する位置に`heldItems`引数を挿入すること**(方向性1のTask 5で`items`パラメータの位置が変わっている可能性がある)。

- [ ] **Step 9: playCard呼び出し元(applyPlayCard以外)の修正**

`engine.ts`内で`playCard(`を呼んでいる他の箇所(`applyStuckCheck`等)を検索し、新しい引数`heldItems`を渡す必要がある箇所全てに対応する。これらの箇所は`RunState`(`run.items`を持つ)にアクセスできるスコープ内にあるはずなので、`run.items`をそのまま渡す。戻り値の分割代入で`currencyGain`を使わない場合、その分割代入結果の扱い(`currency`への反映)も必要かどうか、各呼び出し元の意味を確認して判断すること(`applyStuckCheck`等でプレイヤーの明示的なプレイ操作ではない場合でも、`playCard`を経由するなら`currencyGain`が発生しうるので、無視せず反映すべきかどうか慎重に判断すること)。

- [ ] **Step 10: テストを実行し成功を確認**

Run: `npm run test -- engine.test.ts -t "プレイ中currency加算"`
Expected: PASS

- [ ] **Step 11: 全体テストスイート・ビルド・型チェック**

Run: `npm run test`
Run: `npm run build`
Run: `npm run check`

- [ ] **Step 12: コミット**

```bash
git add src/lib/game/shidasu/rewardTalismanEffects.ts src/lib/game/shidasu/rewardTalismanEffects.test.ts src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 賞金・僥倖・祝儀のプレイ中currency加算トリガーを実装"
```

---

## Task 8: prizeMoney/celebrationのdesc動的表示対応

**Files:**
- Modify: `src/lib/game/shidasu/items.ts` (`itemDesc`関数、または呼び出し側)
- Modify: `src/routes/admin/shidasu-talismans/+page.svelte` (必要であれば)
- Test: `src/lib/game/shidasu/items.test.ts`

Task 2で保留にした「`prizeMoney`/`celebration`のdescテンプレート内`{randomTarget}`が展開されない」問題に対応する。既存の`itemDesc(id, params)`関数は`params.talismans[id]`の静的な数値フィールドしか展開できず、`HeldItem.randomTarget`のようなランタイム状態は関与できない。

- [ ] **Step 1: 現状の影響範囲を確認する**

`itemDesc`関数の呼び出し元を`grep`で全て洗い出す(護符一覧表示・ショップ画面・admin画面のプレビュー等)。それぞれの呼び出し箇所が`HeldItem`(instanceId・randomTarget込み)にアクセスできる文脈かどうかを確認する。

- [ ] **Step 2: 対応方針を決定する**

以下のいずれかの方針で対応する(実装者が呼び出し元の状況を見て判断する):

**方針A(推奨)**: `itemDesc`関数のシグネチャに、オプショナルな第3引数`randomTarget?: number | string`を追加し、指定があれば`{randomTarget}`をその値で置換する。呼び出し元のうち、実際に`HeldItem`を持っている文脈(ゲーム内の護符一覧表示等)では`held.randomTarget`を渡し、`HeldItem`を持たない文脈(admin画面のプレビュー、ショップのオファー一覧で未所持の護符を表示する場合等)では引数を省略し、`{randomTarget}`はプレースホルダーのまま(または「(ランダム)」のような固定文言に置換)表示する。

具体的な実装イメージ:

```ts
export function itemDesc(id: ItemId, params: ShidasuParams, randomTarget?: number | string): string {
  const entry = params.talismans[id] as unknown as Record<string, unknown> & { desc: string }
  const context: Record<string, number | string> = { rows: params.layout.rows }
  for (const [key, value] of Object.entries(entry)) {
    if (typeof value === 'number') context[key] = value
  }
  if (randomTarget !== undefined) context.randomTarget = randomTarget
  return entry.desc.replace(/\{(\w+)\}/g, (match, key) => (key in context ? String(context[key]) : match))
}
```

`admin画面`のプレビュー列(`itemDesc(id, config)`という既存呼び出し)は変更不要(第3引数省略のままでよく、`{randomTarget}`はプレースホルダー文字列のまま表示される。これは意図的な挙動としてこのタスクでは許容する)。

**方針B**: `params.talismans.prizeMoney.desc`・`params.talismans.celebration.desc`のテンプレート文言自体から`{randomTarget}`という表現を削除し、「ランク○○」のような具体的な埋め込みを諦めて「ウェーブごとにランダムに決まるランクのカードをプレイするたび」のような、対象を明示しない一般的な説明文に変更する。実装コストが低いが、プレイヤーが実際のプレイ画面でどのランク/役が対象になっているか確認する手段が(このタスクの範囲では)無いままになる。

**このタスクでは方針Aを実施すること。** 方針Bはより簡単だが、実際のゲームプレイでプレイヤーが対象を確認できないのは体験として不十分なため。ただし、ゲーム内の護符一覧表示コンポーネント(`+page.svelte`等)側で`held.randomTarget`を`itemDesc`に渡す配線までは、既存のコンポーネント構造に大きく依存するため、**該当コンポーネントが見つかった範囲で対応し、見つけられなかった場合はDONE_WITH_CONCERNSとして報告すること**(`itemDesc`関数自体の拡張と、確認できた範囲での配線が完了していれば良しとする)。

- [ ] **Step 3: 失敗するテストを書く**

`items.test.ts`に追記:

```ts
test('itemDescはrandomTarget引数が指定されればプレースホルダーを置換する', () => {
  const desc = itemDesc('prizeMoney', DEFAULT_PARAMS, 7)
  expect(desc).toContain('7')
  expect(desc).not.toContain('{randomTarget}')
})

test('itemDescはrandomTarget引数が省略されればプレースホルダーをそのまま残す', () => {
  const desc = itemDesc('prizeMoney', DEFAULT_PARAMS)
  expect(desc).toContain('{randomTarget}')
})
```

- [ ] **Step 4: テストを実行し失敗を確認**

Run: `npm run test -- items.test.ts`
Expected: FAIL

- [ ] **Step 5: itemDescを方針A通り修正する**

上記コード例の通り`items.ts`を変更する。

- [ ] **Step 6: ゲーム内の護符一覧表示コンポーネントを検索し、可能な範囲で配線する**

`src/routes`配下で`itemDesc(`を呼んでいる箇所を`grep`で全て検索し、`HeldItem`(またはそれに相当するプロップ)にアクセスできる文脈であれば、`itemDesc(held.id, params, held.randomTarget)`のように第3引数を渡すよう変更する。`held.id !== 'prizeMoney' && held.id !== 'celebration'`の場合は`randomTarget`は`undefined`のままで問題ない(第3引数を常に`held.randomTarget`として渡しても、`{randomTarget}`を含まない他の護符のdescには影響しない)。

- [ ] **Step 7: テストを実行し成功を確認**

Run: `npm run test -- items.test.ts`
Expected: PASS

- [ ] **Step 8: 全体テストスイート・ビルド・型チェック**

Run: `npm run test`
Run: `npm run build`
Run: `npm run check`

- [ ] **Step 9: コミット**

```bash
git add src/lib/game/shidasu/items.ts src/lib/game/shidasu/items.test.ts
git commit -m "feat: itemDescにrandomTarget引数を追加し賞金・祝儀の対象表示に対応"
```

(Step 6でコンポーネント側の配線ファイルを変更した場合は、それらも`git add`に含めること。)

---

## Task 9: 最終チェック — 8種全件の統合確認とデバッグパネル反映確認

**Files:**
- Read: `src/lib/game/shidasu/rewardTalismanEffects.ts`
- Read: `src/lib/game/shidasu/engine.ts`

- [ ] **Step 1: 8件が全てTask 4-7のいずれかで実装されていることをチェックリストで確認**

| ItemId | 実装タスク |
|---|---|
| dividend | Task 5 |
| prizeMoney | Task 6(ランダム対象)+ Task 7(currency加算) |
| windfall | Task 7 |
| celebration | Task 6(ランダム対象)+ Task 7(currency加算) |
| refund | Task 4 |
| bonus | Task 5 |
| commendation | Task 5 |
| grace | Task 5(currency加算・蓄積) + Task 5 Step 8(取得時初期化) |

実際に該当コードが実在することを確認する。1件でも漏れがあれば報告し(新規実装は行わず)、BLOCKEDステータスとする。

- [ ] **Step 2: grace(恩賞)のrewardBonus初期化が実際に機能しているか確認**

Task 5 Step 8で対応した護符取得時の初期化処理(購入・福袋当選・スワップ確定等)を実際に動作確認する。可能であれば以下のような統合テストを追加する:

```ts
test('恩賞をショップで購入すると、rewardBonusが初期値nで設定される', () => {
  // 実際のbuyItem関数(またはそれに相当する関数)を使い、graceを購入した結果のHeldItemを検証する
  // 具体的な購入フローの関数名・シグネチャは実際のengine.tsを確認して使うこと
})
```

このテストが既存の購入フロー関数と整合しない場合は、無理に追加せず、コードリーディングでの確認のみで済ませてよい。

- [ ] **Step 3: デバッグパネルの新規id対応確認**

`ITEM_POOL`をそのまま参照しているデバッグパネル(`src/routes/admin/shidasu-debug/+page.svelte`、方向性1のTask 9で確認済み)が、8件を追加で自動的に扱えることを確認する(Task 3で`ITEM_POOL`に追加済みのため、追加実装は不要のはず)。

- [ ] **Step 4: npm run devで実際に動作確認**

Run: `npm run dev`(バックグラウンド起動)
1. `/admin/shidasu-talismans` にアクセスし、「グループ24: 星片獲得(方向性2)」が表示され、8件の名前・rarity・パラメータ・説明文が含まれることを確認する(`/api/admin/shidasu-config`のJSONレスポンスで確認する形でもよい、方向性1のTask 9の確認方法に倣う)。
2. 開発サーバーが起動しエラーなく応答することを確認する。
3. 確認後、開発サーバーを停止する。

- [ ] **Step 5: 問題があれば修正、無ければ完了報告**

ビルドエラー・型エラーがあれば修正してから完了とする。Task 1〜8で実装したロジック自体に重大なバグが見つかった場合は、修正を試みず詳細を報告してBLOCKEDまたはDONE_WITH_CONCERNSステータスとすること。

- [ ] **Step 6: 最終コミット(修正があった場合のみ)**

```bash
git add -A
git commit -m "fix: 方向性2護符の動作確認で見つかった不具合を修正"
```

---

## 自己レビュー用メモ(実装完了後にplan作成者が確認する事項)

- **spec coverage:** 設計docの「護符一覧(方向性非依存→方向性2扱い: 全8件)」表の8行全てがTask 4〜7でカバーされている。「還元」の秘儀・天啓・神託への影響(技術的注意点として設計docに明記)はTask 1・Task 4で対応。「恩賞」の蓄積値保持方式(rewardBonus)はTask 1・Task 5で対応。「賞金・祝儀のランダム対象決定タイミング」(instanceIdごと独立、Wave単位再抽選)はTask 6で対応。
- **placeholder scan:** 全タスクに具体的なコード・テストコードを記載。Task 8のみ、コンポーネント配線の完了可否に応じてDONE_WITH_CONCERNSを許容する旨を明記しているが、これは実装対象コンポーネントの構造が実装時点でしか確定できないためであり、丸投げではなく明確な最低ラインを示している。
- **type consistency:** `HeldItem.randomTarget?: Rank | RoleName`・`HeldItem.rewardBonus?: number`・`HeldRite/HeldRevelation/HeldOracle.sellBonus?: number`・`CurrencyGainTriggerContext`・`CurrencyGainTriggerResult`のフィールド名を全タスクで一貫させている。`playCard`の戻り値`currencyGain: number`は方向性1の`rewardTalismanTrigger`パターンとは別立てだが、「sellBonus用」と「currency用」で意味が異なるため意図的に分離している。
- **既知のリスク:** Task 7 Step 9(`playCard`呼び出し元の`heldItems`引数追加)は、方向性1のTask 5実装時に判明した「`playCard`関数のreturn文が多数ある」という構造上の複雑さに、今回は「新規引数の追加」という前方への変更が加わるため、実装時は特に慎重な洗い出しが必要。
