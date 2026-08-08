# 福袋のオブジェクト化 設計

## 概要

現在ハードコードされているショップの福袋パターン(`shop.ts`の`PACK_DEFINITIONS`、14パターン固定)を廃止し、`ShidasuParams`配下の「福袋カタログ」に置き換える。各福袋を「名前・種別・選択肢数・取得数・価格」を持つオブジェクトとして扱い、`/admin/shidasu-packs`から自由に追加・削除・編集できるようにする。

## 背景

`docs/shidasu/shidasu-roadmap.md`のロードマップ項目8「福袋のオブジェクト化」に基づく。現行のPACK_DEFINITIONSは護符/秘儀/天啓/カードセットの3-1・5-1・7-2パターンと神託の3-1・5-1パターンの計14件が均等抽選される固定配列で、コード変更なしに福袋の種類・出現比率・価格を調整する手段がない。

## データモデル

`ShidasuParams.shop`に`packCatalog: PackCatalogEntry[]`を新設する。

```ts
interface PackCatalogEntry {
  name: string          // 表示名(自由入力、例: "護符の福袋")
  packKind: ShopSlotKind // 'item' | 'rite' | 'revelation' | 'oracle' | 'cardSet'
  offerCount: number     // 選択肢数(自由数値。現行の3/5/7制約は撤廃)
  pickCount: number      // 取得数(自由数値。現行の1/2制約は撤廃)
  price: number          // このオブジェクト固有の価格
}
```

既存の`shop.packPrice`(kind×選択肢数の価格表、`item.threeOne`等)は廃止する。価格は各`PackCatalogEntry`が個別に持つため、価格表による間接参照は不要になる。

既存の`PackOfferCount = 3 | 5 | 7`・`PackPickCount = 1 | 2`型リテラルユニオンは、`ShopPackSlot.offerCount`・`pickCount`を含めて`number`に緩和する。`rollOffer`(`deck.ts`)や`rollItemOffer`/`rollRiteOffer`/`rollRevelationOffer`/`rollOracleOffer`/`rollCardSetOffer`はいずれも既に`count: number`を受け取る実装で、プールがcount未満の場合は全件返す既存のフォールバックがあるため、任意の数値を渡しても安全に動作する。

## 抽選方式

抽選アルゴリズム自体は現行を踏襲する。`packCatalog`配列をシャッフルし、先頭2件を重複無く選ぶ(均等抽選)。

「選択肢数が少ない福袋の出現率を上げたい」場合は、専用の重みフィールドを設けるのではなく、管理画面で同じ内容(種別・選択肢数・取得数・価格)のオブジェクトを名前だけ変えて複数行用意する運用で対応する。各オブジェクトの抽選確率は常に均等(1/カタログ件数の比率)であり、同じ性質のオブジェクトを複数用意すること自体が相対的な出現率の調整手段になる。

## ショップ側の変更

- `shop.ts`から`PACK_DEFINITIONS`定数を削除する。`rollPackSlots`は`rand`に加えて`params: ShidasuParams`を受け取るよう変更し、`params.shop.packCatalog`から2件を重複無く抽選する。`rollShop`のシグネチャを`rollShop(run, rand)`から`rollShop(params: ShidasuParams, run: RunState, rand)`(他の`buyPack`等と同じ引数順、`params`を先頭)に変更する。呼び出し元(`engine.ts`の`enterShop`・`rerollShop`)は既にスコープ内に`params`を持っているため、呼び出し箇所を`rollShop(params, next, rand)`のように追随させるだけでよい
- `ShopPackSlot`(`types.ts`)に`name: string`・`price: number`を追加する。`rollPackSlots`は選ばれた`PackCatalogEntry`の`name`・`packKind`・`offerCount`・`pickCount`・`price`をスナップショットとしてそのまま`ShopPackSlot`にコピーする。抽選後にカタログを編集しても、既に提示中のショップのオファーには影響しない(既存の福袋の中身オファーが「開封時に一度だけ確定する」設計方針と同じ考え方)
- `packPrice()`関数(`shop.ts`)を削除する。`buyPack`(`engine.ts`)は`packPrice(params, slot.packKind, slot.offerCount)`ではなく`slot.price`を直接参照するよう変更する
- ショップ画面(`+page.svelte`)の福袋表示を、`{SHOP_SLOT_KIND_LABEL[slot.packKind]}福袋 {offerCount}択{pickCount}`から`{slot.name}({slot.offerCount}択{slot.pickCount})`に変更する。購入ボタンの価格表示も`packPrice(...)`から`slot.price`に変更する

## 管理画面

新規ページ`/admin/shidasu-packs`を作成する。既存の`/admin/shidasu-oracles`等は`ORACLE_POOL`のような固定件数の集合を編集する形式(行の追加・削除UIを持たない)だが、`packCatalog`は可変長のリストであるため、行の追加・削除が可能なテーブルUIとして新規実装する。

- 列構成: 名前(テキスト入力)/アイテム種別(`item`/`rite`/`revelation`/`oracle`/`cardSet`から選ぶセレクト)/選択肢数(数値入力)/取得数(数値入力)/価格(数値入力)/削除ボタン
- テーブル下部に「追加」ボタンを置き、押すと末尾に新規の空行(既定値: 名前は空文字、種別は`item`、選択肢数3・取得数1・価格0)を追加する
- バリデーション: 名前が空、選択肢数が1未満、取得数が1未満または選択肢数を超える、価格が負のいずれかに該当する行があれば保存ボタンを無効化する(既存の`shidasu-currency`・`shidasu-oracles`と同じ`hasValidationError`パターン)
- 読み込み・保存は既存の管理画面と同じ`/api/admin/shidasu-config`エンドポイントを使う(`GET`でロード、`POST`で保存)

## 移行(初期データ)

`shidasu.config.json`・`DEFAULT_PARAMS`の`packCatalog`初期値は、現行の14パターン(護符/秘儀/天啓/トランプセット×3-1・5-1・7-2、神託×3-1・5-1)を、現行の`packPrice`の値をそのまま使って14件の`PackCatalogEntry`に変換する。名前は「護符の福袋」「秘儀の福袋」「天啓の福袋」「神託の福袋」「トランプセットの福袋」を種別ごとに用いる(選択肢数・取得数は名前に含めない、ショップ画面側で自動的に併記されるため)。これにより既定の挙動を変えずに移行し、以降は管理画面で自由に追加・調整できるようにする。

## テスト方針

- `rollPackSlots`が`params.shop.packCatalog`から重複無く2件抽選することのユニットテスト(既存の`PACK_DEFINITIONS`ベースのテストを置き換え)
- `buyPack`が`slot.price`を正しく消費し、`packPrice()`に依存しなくなったことのテスト
- `rollShop`/`rerollShop`のシグネチャ変更(`params`引数の追加)に伴う既存テストの呼び出し箇所の更新
- 管理画面(`/admin/shidasu-packs`)は既存の`shidasu-oracles`等と同様、バリデーション・保存・リロードの手動確認(自動テストは対象外、既存の管理画面群も同様の方針)

## 対象外

- 抽選確率に明示的な重みフィールドを持たせること(同一性質のオブジェクトを複数用意する運用で代替するため対象外)
- バラ売り枠(`ShopIndividualSlot`)のオブジェクト化(福袋のみが対象)
- 福袋の中身(アイテムプール自体)の管理画面編集(既存の`shidasu-talismans`等の対象。福袋カタログは「箱」の定義のみを扱う)
