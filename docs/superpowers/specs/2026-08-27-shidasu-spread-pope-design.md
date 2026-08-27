# 新規スプレッド「教皇」実装設計

## 背景・目的

Shidasuロードマップ項目3「スプレッドの追加検討」(`docs/shidasu/shidasu-spread-candidates.md`)の名称候補・固有ルールの方向性(「神託」軸)を踏まえ、最初の新規スプレッドとして「教皇」を実装する。

「教皇」のルール: **神託の初期レベルをLにし、ショップで神託が販売されない**。既に授けられた強い神託の知恵(高い初期レベル)を持つ代わりに、外部(ショップ)からの新規補充を断つ、というモチーフ(伝統・教義・既に授けられた知恵)に沿った固有ルール。

現状実装済みのスプレッドは`fool`(愚者、特殊ルールなし)・`moon`(月、場札が常に1行少ない)の2種のみ。「教皇」が3種目となる。

## 変更内容

### 1. `ShidasuParams.spreads`の型をRecordにリファクタ

現状`spreads: { fool: {...}; moon: {...} }`という固定2キーのオブジェクト型になっている(`src/lib/game/shidasu/params.ts`)。新規スプレッド追加のたびに型定義自体の拡張が必要な設計であり、他の抱符・秘儀・天啓・神託・レリック(いずれも`Record<XxxId, {...}>`形式)と非対称になっている。今回の実装に合わせて`Record<SpreadId, SpreadConfig>`形式にリファクタする。

```ts
interface SpreadConfig {
  name: string
  desc: string
  initialExtraTableauRows: number
  waveTargetBase: number
  waveTargetMultiplier: number
  initialOracleLevel: number
  bannedShopKinds: ShopSlotKind[]
}
```

`initialOracleLevel`・`bannedShopKinds`は今回新設するフィールド(詳細は下記2・3)。既存の`fool`・`moon`にはこれらのデフォルト値(`initialOracleLevel: 1`、`bannedShopKinds: []`)を設定し、挙動を変えない。

### 2. `initialOracleLevel`(神託の初期レベル)

`RunState.oracleLevels: Record<RoleName, number>`(全10役の現在レベル、初期値1・上限なし)を、ラン開始時にスプレッドの`initialOracleLevel`値で全役一律に上書きする。

- 適用箇所: `beginRun`関数(`src/lib/game/shidasu/engine.ts`)。既存の`initialExtraTableauRows`の適用と同じ並びで、`createInitialRun()`が返す`oracleLevels`(`defaultOracleLevels()`=全役1)を、`initialOracleLevel`の値で全役上書きする処理を追加する。
- 適用範囲: 全10役(`flush`/`royalSet`/`sameRank`/`completeRun`/`columnSweep`/`suit`/`color`/`stair`/`pair`/`alternating`)一律に同じ値を適用する(役ごとの個別値は持たせない)。
- `fool`・`moon`は`initialOracleLevel: 1`(現状と同じ挙動)、`pope`は`initialOracleLevel: 5`。

### 3. `bannedShopKinds`(ショップで販売しない種別)

スプレッドごとに、ショップのバラ売り枠・福袋カタログの両方から除外する`ShopSlotKind`のリストを持たせる汎用的な仕組みを導入する。

- 適用箇所: `src/lib/game/shidasu/shop.ts`
  - `rollIndividualSlot`: バラ売り枠の抽選対象種別`SHOP_SLOT_KINDS`(`['item', 'rite', 'revelation', 'oracle']`)から、現在のランのスプレッドが持つ`bannedShopKinds`に含まれる種別を除外してから抽選する。
  - `rollPackSlots`: `params.shop.packCatalog`から、`packKind`が`bannedShopKinds`に含まれるエントリを除外してから抽選する。
- `fool`・`moon`は`bannedShopKinds: []`(現状と同じ挙動、全種別が抽選対象)、`pope`は`bannedShopKinds: ['oracle']`(神託のバラ売り枠・「神託の福袋」の両方が対象外になる)。
- この仕組みは今回「教皇」専用ではなく汎用的に実装するため、将来他のスプレッドで別の種別(例えば`item`や`rite`)を禁止する場合にも同じフィールドで対応できる。

### 4. 天啓「張」経由の神託獲得は許容(仕様として明記)

天啓「張」(`chou`)はショップを介さず神託を最大2つ直接付与する効果を持つ(`grantRevelationReward`の`chou`ケース)。「教皇」スプレッドで神託がショップ非販売になっても、天啓「張」自体は天啓のバラ売り・福袋経由で入手・使用可能なため、この経路での神託獲得は引き続き可能になる。

これは意図的に許容する仕様とする。「ショップで神託が販売されない」はショップ経由の入手のみを禁止するものであり、神託を完全に入手不可能にするものではない。コード変更は行わない。

### 5. 新規スプレッド「教皇」の追加

- `src/lib/game/shidasu/types.ts`: `SpreadId`型に`'pope'`を追加。
- `src/lib/game/shidasu/params.ts`: `DEFAULT_PARAMS.spreads.pope`を追加:
  ```ts
  pope: {
    name: '教皇',
    desc: '神託の初期レベルが5になるが、ショップで神託が販売されない',
    initialExtraTableauRows: 0,
    waveTargetBase: 2000,
    waveTargetMultiplier: 1.5,
    initialOracleLevel: 5,
    bannedShopKinds: ['oracle'],
  }
  ```
  **注記:** `desc`はプレースホルダー展開の仕組みを持たない固定文言として表示される(`src/routes/game/shidasu/+page.svelte`が`params.spreads[spreadId].desc`をそのまま表示するのみで、`itemDesc`のような`{変数名}`置換関数を経由しない)。そのため`initialOracleLevel`の値をここに直接書く(admin画面で`initialOracleLevel`を変更した場合、`desc`の文言は自動追従しないため手動で合わせる必要がある)。
- `src/lib/game/shidasu/shidasu.config.json`: 上記と同内容を追加。
- `src/routes/game/shidasu/+page.svelte`: `SPREAD_IDS`配列に`'pope'`を追加(スプレッド選択UIに自動反映される、既存の`fool`/`moon`と同じ描画ロジックを流用)。

### admin画面での調整

`initialOracleLevel`・`bannedShopKinds`は`params.spreads`配下の新規フィールドのため、既存の`/api/admin/shidasu-config`(設定JSON全体を読み書きするAPI)から編集可能になる。専用のスプレッド設定UI(`/admin/shidasu-spreads`のような画面)は現状存在しないため、本実装のスコープには含めない(将来必要になれば別途検討)。

## テスト方針

TDDで進める。

- `beginRun`が`spreadId: 'pope'`を指定した場合に`oracleLevels`が全役5になることを検証するテスト
- `beginRun`が`spreadId: 'fool'`(既定)の場合に`oracleLevels`が現状通り全役1のままであることを検証する既存テストが壊れていないことを確認
- `rollShop`(または`rollIndividualSlot`/`rollPackSlots`単体)が、`spreadId: 'pope'`のランでは`oracle`種別のバラ売り枠・「神託の福袋」を一切生成しないことを検証するテスト(複数シードで確認し、確率的な見落としを防ぐ)
- `rollShop`が`spreadId: 'fool'`のランでは現状通り`oracle`種別が出現しうることを検証する既存テストが壊れていないことを確認

## スコープ外

- 神託の初期レベル`L`を役ごとに個別値にする仕組み(今回は全役一律のみ)
- 天啓「張」自体をスプレッドごとに無効化する仕組み(今回は許容する仕様として明記するのみ)
- 専用のスプレッド設定admin画面の新設
- 「教皇」以外の新規スプレッド候補(`docs/shidasu/shidasu-spread-candidates.md`に記録済みの他の名称候補・軸)の検討・実装
