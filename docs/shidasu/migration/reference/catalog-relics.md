# レリック(Relic)全件カタログ

Godot移植フェーズ1向けの資料。対象は`src/lib/game/shidasu/`配下。

- 型定義(正本): `types.ts`の`RelicId`(10件)
- 抽選プール: `relics.ts`の`RELIC_POOL`(10件、`types.ts`の`RelicId`と完全一致)
- 実データ: `shidasu.config.json`の`relics`セクション(10件)
- ロジック: `relics.ts`(価格・所持上限・スロット数などへの副作用計算)

件数は`RelicId`ユニオン型10件・`RELIC_POOL`10件・`shidasu.config.json`の`relics`セクション10件で完全一致を確認済み。

## 共通仕様

- レリックは**所持数に上限が無く、同じidを重複所持できない**(`RunState.relics: { id: RelicId; tsukumoka: boolean }[]`、`types.ts`)。
- 個体ごとに「付喪化」(進化)状態(`tsukumoka: boolean`)を持ち、付喪化すると`tsukumokaDesc`の内容に効果が上方修正される。
- 付喪化させる手段(天啓等)は現状未実装のため、`tsukumoka`は常に`false`(コード上の型・分岐は存在するが、実際のプレイでは発火しない)。ただし妨害行動`tsukumokaRelease`(付喪化解除、`catalog-sabotage.md`参照)は付喪化済みレリックを非付喪化に戻す効果を持つため、将来付喪化手段が実装された場合に備えて残されている。
- 表示名は`relicName(id, params)` → `params.relics[id].name`、効果説明文は`relicDesc(id, params)` → `params.relics[id].desc`内の`{placeholder}`を同エントリの数値フィールドで置換して生成する(`relicPlaceholderContext`)。付喪化時は`relicTsukumokaDesc`/`tsukumokaDesc`を同様に使う。
- ショップとの関わり: レリック自体はショップの「レリック専用枠」(`ShopState.relic`)で提示され、購入すると`run.relics`に追加される。専用枠の提示数は基本1枠(`relicSlotCount`、縁起鈴で増加)。

以下、`RelicId`の宣言順(`types.ts`)に全10件を記載する。

---

### 1. `manekiNeko`(招き猫)

- **効果(自然文)**: ショップの全商品(バラ売り枠・福袋の両方)の購入価格を`discountPercent`%値引きする。付喪化時は`tsukumokaDiscountPercent`%値引きに上方修正される。
- **数値**: `price: 25`, `discountPercent: 25`, `tsukumokaDiscountPercent: 50`
- **関連パラメータ名**: `params.relics.manekiNeko.discountPercent` / `tsukumokaDiscountPercent`
- **実装関数**: `relicPriceMultiplier(params, run)` — `run.relics`から`manekiNeko`を検索し、所持していれば`(100 - percent) / 100`を返す(未所持なら`1`=無変化)。この倍率はショップの購入価格計算箇所(`shop.ts`側)に乗算される。
- **依存State**: `RunState.relics`(所持判定)。ショップの購入価格計算に恒久的に影響する。リロールコストには影響しない。

---

### 2. `fukuDaruma`(福だるま)

- **効果(自然文)**: ショップのリロールコストの刻み幅を`n`減らす。付喪化時はさらに「同一ショップ訪問中の最初の1回のリロールが無料になる」効果が追加される(刻み幅の減少自体は付喪化しても変わらない)。
- **数値**: `price: 20`, `n: 2`
- **関連パラメータ名**: `params.relics.fukuDaruma.n`、`params.shop.rerollCostStep`(基準値)
- **実装関数**:
  - `relicRerollCostStep(params, run)` — 所持していれば`Math.max(0, params.shop.rerollCostStep - params.relics.fukuDaruma.n)`を返す(0未満にはしない)。未所持なら`params.shop.rerollCostStep`をそのまま返す。
  - `relicFirstRerollFree(run)` — 付喪化済み(`tsukumoka === true`)なら`true`を返す(それ以外`false`)。
- **依存State**: `RunState.relics`。ショップのリロールコスト計算(`shopRerollCount`と組み合わせて使われる想定)に恒久的に影響する。

---

### 3. `kumade`(熊手)

- **効果(自然文)**: ショップのバラ売り枠を`n`枠増やす。付喪化時はさらに福袋枠も`n`枠増える(バラ売り枠の増加分と合わせて両方が増える)。
- **数値**: `price: 25`, `n: 1`
- **関連パラメータ名**: `params.relics.kumade.n`
- **実装関数**:
  - `individualSlotCount(params, run)` — 基本値3に、所持していれば`params.relics.kumade.n`を加算する。
  - `packSlotCount(params, run)` — 基本値2に、**付喪化していれば**`params.relics.kumade.n`を加算する(福笹の効果と対になる仕組み。熊手・福笹は同時所持可能で両方の加算が合算される)。
- **依存State**: `RunState.relics`。ショップのバラ売り枠数・(付喪化時は)福袋枠数に恒久的に影響する。

---

### 4. `manekiHoteizo`(招き布袋像)

- **効果(自然文)**: 護符の所持上限を`n`増やす。付喪化時はさらに`tsukumokaN`増える(合計で`n + tsukumokaN`増加)。
- **数値**: `price: 30`, `n: 1`, `tsukumokaN: 1`
- **関連パラメータ名**: `params.relics.manekiHoteizo.n` / `tsukumokaN`、`params.items.maxItems`(基準値)
- **実装関数**: `itemMaxCapacity(params, run)` — `params.items.maxItems + スプレッド由来オフセット(魔術師は+1等) + relicBonus(run, 'manekiHoteizo', n, tsukumokaN)`。`relicBonus`ヘルパーは未所持なら0、所持していれば`n`(付喪化ならさらに`tsukumokaN`を加算)を返す共通ロジック。
- **依存State**: `RunState.relics`、`RunState.spreadId`(スプレッドの`initialItemCapacityBonus`と合算)。ショップの価格計算には影響しない(所持上限のみ)。

---

### 5. `hamaya`(破魔矢)

- **効果(自然文)**: 秘儀の所持上限(基本値3)を`n`増やす。付喪化時はさらに`tsukumokaN`増える。
- **数値**: `price: 30`, `n: 1`, `tsukumokaN: 1`
- **関連パラメータ名**: `params.relics.hamaya.n` / `tsukumokaN`
- **実装関数**: `riteMaxCapacity(params, run)` — `3 + relicBonus(run, 'hamaya', n, tsukumokaN)`。
- **依存State**: `RunState.relics`。秘儀所持上限(`RunState.rites`の実効上限)に恒久的に影響する。

---

### 6. `senbazuru`(千羽鶴)

- **効果(自然文)**: 天啓・神託(合算)の所持上限(基本値2)を`n`増やす。付喪化時はさらに`tsukumokaN`増える。
- **数値**: `price: 30`, `n: 1`, `tsukumokaN: 1`
- **関連パラメータ名**: `params.relics.senbazuru.n` / `tsukumokaN`
- **実装関数**: `revelationOracleMaxCapacity(params, run)` — `2 + relicBonus(run, 'senbazuru', n, tsukumokaN)`。天啓(`RunState.revelations`)と神託(`RunState.oracles`)は合算枠を共有するため、この関数の返り値が両者合計の上限になる。
- **依存State**: `RunState.relics`。天啓・神託の合算所持上限に恒久的に影響する。

---

### 7. `fukuzasa`(福笹)

- **効果(自然文)**: 福袋の枠を`n`枠増やす。付喪化時はさらにバラ売り枠も`n`枚増える(熊手と対になる仕組み)。
- **数値**: `price: 25`, `n: 1`
- **関連パラメータ名**: `params.relics.fukuzasa.n`
- **実装関数**:
  - `packSlotCount(params, run)` — 基本値2に、所持していれば`params.relics.fukuzasa.n`を加算する。
  - `individualSlotCount(params, run)` — 基本値3に、**付喪化していれば**`params.relics.fukuzasa.n`を加算する(熊手の`kumade.n`加算とは独立に合算)。
- **依存State**: `RunState.relics`。ショップの福袋枠数・(付喪化時は)バラ売り枠数に恒久的に影響する。熊手と同時所持でそれぞれの加算が合算される。

---

### 8. `kaiunKokeshi`(開運こけし)

- **効果(自然文)**: 護符・秘儀・天啓・神託の売却価格を`sellBonusPercent`%上乗せする。付喪化時は`tsukumokaSellBonusPercent`%上乗せに上方修正される。
- **数値**: `price: 20`, `sellBonusPercent: 25`, `tsukumokaSellBonusPercent: 50`
- **関連パラメータ名**: `params.relics.kaiunKokeshi.sellBonusPercent` / `tsukumokaSellBonusPercent`
- **実装関数**: `relicSellBonusMultiplier(params, run)` — 所持していれば`(100 + percent) / 100`を返す(未所持なら`1`)。この倍率は各種アイテムの売却価格計算箇所に乗算される想定。
- **依存State**: `RunState.relics`。ショップでの売却価格計算に恒久的に影響する(購入価格には影響しない)。

---

### 9. `engiKozuchi`(縁起小槌)

- **効果(自然文)**: 福袋の選択肢数(offerCount)を全ジャンル`n`増やす。付喪化時はさらに`tsukumokaN`増える。
- **数値**: `price: 25`, `n: 1`, `tsukumokaN: 1`
- **関連パラメータ名**: `params.relics.engiKozuchi.n` / `tsukumokaN`
- **実装関数**: `packOfferCountBonus(params, run)` — `relicBonus(run, 'engiKozuchi', n, tsukumokaN)`をそのまま返す(未所持なら0)。福袋を開けた際の`offerCount`(選択肢の提示数)に加算される。
- **依存State**: `RunState.relics`。福袋の中身選択画面での選択肢数に恒久的に影響する(価格自体には影響しない)。

---

### 10. `engiSuzu`(縁起鈴)

- **効果(自然文)**: レリック専用枠の提示数(基本1枠)を`n`増やす。付喪化時はさらに`tsukumokaN`増える。
- **数値**: `price: 35`, `n: 1`, `tsukumokaN: 1`
- **関連パラメータ名**: `params.relics.engiSuzu.n` / `tsukumokaN`
- **実装関数**: `relicSlotCount(params, run)` — `1 + relicBonus(run, 'engiSuzu', n, tsukumokaN)`。ショップ訪問時に生成されるレリック専用枠(`ShopState.relic`)の配列長を決める。
- **依存State**: `RunState.relics`。ショップのレリック専用枠数に恒久的に影響する(自己参照的にレリックの出現数を増やす)。

---

## 補足: レリックが影響するショップ経済パラメータの一覧

| 関数(`relics.ts`) | 対象 | 基準値 | 影響するレリック |
|---|---|---|---|
| `relicPriceMultiplier` | 全商品の購入価格倍率 | 1(無変化) | `manekiNeko` |
| `relicSellBonusMultiplier` | 全所持品の売却価格倍率 | 1(無変化) | `kaiunKokeshi` |
| `itemMaxCapacity` | 護符所持上限 | `params.items.maxItems` | `manekiHoteizo`(+スプレッド補正) |
| `riteMaxCapacity` | 秘儀所持上限 | 3 | `hamaya` |
| `revelationOracleMaxCapacity` | 天啓・神託合算所持上限 | 2 | `senbazuru` |
| `individualSlotCount` | バラ売り枠数 | 3 | `kumade`(常時)、`fukuzasa`(付喪化時) |
| `packSlotCount` | 福袋枠数 | 2 | `fukuzasa`(常時)、`kumade`(付喪化時) |
| `packOfferCountBonus` | 福袋の選択肢数(offerCount)への加算 | 0 | `engiKozuchi` |
| `relicSlotCount` | レリック専用枠の提示数 | 1 | `engiSuzu` |
| `relicRerollCostStep` | リロールコストの刻み幅 | `params.shop.rerollCostStep` | `fukuDaruma` |
| `relicFirstRerollFree` | 初回リロール無料化 | false | `fukuDaruma`(付喪化時のみ) |
