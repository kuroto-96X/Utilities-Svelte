# 星詠みソリティア -Shidasu- ショップ画面 設計

## 背景・スコープ

`docs/shidasu/shidasu-roadmap.md`の5番目の項目「ゲーム内通貨を定義して、ウェーブ終了ごとにショップでアイテム購入の検討」の後半部分を実装する。前半(通貨基盤)は`docs/superpowers/specs/2026-07-22-shidasu-currency-design.md`で実装済み。

現状、護符・秘儀・天啓・神託は以下の経路でのみ入手できる。

- 護符: Waveクリア時の3択提示(`itemSelect`)
- 秘儀: 護符選択と同時に自動で1個抽選(`rollRite`)
- 天啓: 護符選択後の3択提示(`revelationSelect`)
- 神託: 天啓選択後の3択提示(`oracleSelect`、選ぶと即座に該当役のレベル+1。所持の概念なし)

これらをすべて廃止し、Waveクリア後は必ずショップ画面(`shop`フェーズ)を経由して、通貨(星片)でアイテムを購入する形に一本化する。

## 1. 全体フロー

```
Wave成功 → 通貨付与
  → (大凶クリア時のみ continueChoice で続行確認。続けるなら↓へ。既存仕様のまま変更なし)
  → shop突入:
      次ウェーブの位置・ボス種別を決定し、プレビュー用ウェーブを配る
      (現行の enterRevelationSelect が担っていた処理を shop 突入時点に前倒しする)
  → shop画面:
      バラ売り3枠 + 福袋2枠を表示。好きな順・好きな回数、枠が尽きるまで購入できる
      - バラ売り購入 → 即座に所持へ(神託・天啓のみ「即使う/温存」を選択)
      - 福袋購入 → 中身選択画面(3/5/7択、1/2個選ぶ)へ遷移 → 選択完了で shop に戻る
      - 所持品(護符・秘儀・天啓・神託)はいつでも売却できる(shop画面・プレイ中どちらでも)
  → 「次のWaveへ」ボタン →
      天啓効果を反映した deckComposition で実際のウェーブを配り直し(現行の finishRevelationSelect 相当)
      → playing
```

Wave失敗時(`gameOver`)はショップを経由しない(既存通り)。

## 2. 型定義・データ構造(`types.ts`)

### RunPhase

`'shop'`と`'riteSelect'`(福袋の秘儀パック用の選択画面)を追加する。

```
RunPhase = 'title' | 'playing' | 'shop' | 'itemSelect' | 'riteSelect' | 'revelationSelect' | 'oracleSelect' | 'continueChoice' | 'allClear' | 'gameOver'
```

`itemSelect`・`revelationSelect`・`oracleSelect`は「福袋の中身選択画面」として引き続き使うが、役割が「Waveクリア時の自動オファー」から「福袋購入時のオファー」に変わる。

### RunState 追加フィールド

- `oracles: RoleName[]` — 温存中(未使用)の神託。`revelations`と合算で所持上限2を共有する。同じ役を複数所持できる
- `shop: ShopState | null` — ショップ来訪中のみ非nullの状態。ショップ突入時にセットし、「次のWaveへ」で`playing`に遷移する際にnullへ戻す
- `offerPickRemaining: number` — 福袋の中身選択画面で、あと何個選べば選択完了になるか(3-1/5-1パターンは1、7-2パターンは2からスタートし、1つ選ぶごとに減算)

### ShopState

```ts
interface ShopIndividualSlot {
  kind: 'item' | 'rite' | 'revelation' | 'oracle'
  id: string // ItemId | RiteId | RevelationId | RoleName
  sold: boolean
}
interface ShopPackSlot {
  packKind: 'item' | 'rite' | 'revelation' | 'oracle'
  offerCount: 3 | 5 | 7
  pickCount: 1 | 2
  sold: boolean
}
interface ShopState {
  individual: ShopIndividualSlot[] // 3枠、shop突入時に確定・以後固定
  packs: ShopPackSlot[]            // 2枠、shop突入時に確定・以後固定
}
```

`individual`・`packs`の中身(何が並ぶか)はshop突入時に一度だけ抽選し、そのWave滞在中は再抽選しない。購入すると対応する要素の`sold`を`true`にするだけで、配列自体は入れ替えない(表示側で売り切れ状態を出す)。

## 3. 商品構成・抽選ロジック

- バラ売り3枠: 枠ごとに独立して「護符/秘儀/天啓/神託」のいずれかを均等抽選し、さらにそのカテゴリ内から具体的な1種をランダムに1つ確定する(カテゴリの重複はあり得る)
- 福袋2枠: 11種類のパックタイプ(護符・秘儀・天啓は3-1・5-1・7-2の3パターンずつ、神託は3-1・5-1の2パターン)からランダムに2つを重複なく選出する
- 各カテゴリの抽選プールは既存の`ITEM_POOL`/`RITE_POOL`/`REVELATION_POOL`/`ORACLE_POOL`をそのまま使う。オファー数(3/5/7)を引数に取れるよう、既存の`rollItemOffer`/`rollRevelationOffer`/`rollOracleOffer`と新設する`rollRiteOffer`を、共通の`rollOffer<T>(pool: T[], count: number, rand): T[]`ヘルパー(`deck.ts`の`shuffleInPlace`を使う軽量関数)経由にリファクタリングする

## 4. 価格・売却額

管理画面(`/admin/shidasu-currency`)で編集できる、固定額のテーブルとして持つ。

| カテゴリ | 価格の単位 | 購入額(たたき台) | 売却額(たたき台) |
|---|---|---|---|
| 護符 C | レアリティ別 | 8 | 4 |
| 護符 U | レアリティ別 | 16 | 8 |
| 護符 R | レアリティ別 | 30 | 15 |
| 秘儀 | カテゴリ一律 | 12 | 6 |
| 天啓 | カテゴリ一律 | 18 | 9 |
| 神託 | カテゴリ一律 | 15 | 7 |

福袋の価格はカテゴリ×パターン(3-1/5-1/7-2)の組み合わせごとに設定する(11種類のパックそれぞれに個別の購入額を持たせる)。

| カテゴリ | 3択1個 | 5択1個 | 7択2個 |
|---|---|---|---|
| 護符 | 20 | 30 | 50 |
| 秘儀 | 20 | 30 | 50 |
| 天啓 | 25 | 38 | 63 |
| 神託 | 22 | 33 | - |

売却額は今回はすべて「購入額に対する固定額」で管理する。ただし将来、状態に応じて売却額が変動する護符(例: 効果発動回数で変わる等)を実装する余地を残すため、売却額の参照は「アイテムIDから売却額を返す関数」を1枚挟む形にし、今回はテーブル参照のみを実装する(呼び出し側は関数の中身を意識しない)。

## 5. 所持枠・上限とスワップUI

- 護符: 上限5、1種1個(既存通り)
- 秘儀: 上限3、同種複数可(既存通り)
- 天啓・神託: 合算で上限2、同一枠を共有。神託は同種複数可
- バラ売り購入時、対象カテゴリ(天啓・神託は合算枠)が上限に達していれば、その枠は購入不可(ボタン無効化)として表示する。ただし神託は「即使う」を選べば所持を経由しないため、上限に関わらず常に購入可能
- 福袋購入は上限に関わらず常に可能。福袋の中身選択後、獲得しようとする対象カテゴリが上限に達している場合のみ、既存の護符入れ替えUI(`confirmItemSwap`/`cancelItemSwap`)と同じパターンで「所持中のどれと入れ替えるか」を選ぶ画面を表示し、選んだ瞬間に入れ替えが完了する(先に売却してから買い直す、という二度手間を避ける)。秘儀は秘儀同士、天啓・神託は合算枠内のどれとでも入れ替え可能(天啓を神託に置き換える、なども可)
- 天啓・神託は、福袋経由でも上限に関わらず「獲得せず即使用」を選べる(この場合スワップ判定自体を経由しない)

## 6. 神託の所持化

- 神託は`RoleName`をIDとして扱う既存方式のまま、`run.oracles: RoleName[]`に温存分を保持する
- バラ売り購入・福袋の中身選択いずれも、神託は「即使う(現行`pickOracleFromOffer`と同じ、役レベル+1して消費)」か「温存する(`run.oracles`に追加)」かを選べる
- 温存した神託をプレイ中に使うための新規関数`useOracle(run, roleName)`を追加する。天啓の`useRevelation`と同じ位置づけ(`playing`フェーズでいつでも呼べる)で、実行すると対応する役のレベル+1・`run.oracles`から1個消費する。天啓と異なり盤面への効果適用(`applyRevelationEffect`相当)は無く、`oracleLevels`の更新のみで完結する
- 天啓の「即使う」は今後、場札以外(所持金など)に影響する効果が追加される想定のため、既存の`useRevelationFromOffer`の仕組み(`targetCol`指定込み)をそのまま維持し、購入時のオファー画面でも同じ関数を使う

## 7. フェーズ遷移の詳細(プレビューウェーブの扱い)

現行の`enterRevelationSelect`は「次のステージ/ウェーブ位置とボス種別の決定」と「天啓ターゲット用のプレビューウェーブの配布」を1つの関数で行っている。ショップ導入後は以下のように役割を分割する。

- shop突入時(Wave成功確定時、または大凶continueChoiceで続行を選んだ時): 現行`enterRevelationSelect`と同じ処理(次ウェーブ位置決定・ボス種別決定・プレビューウェーブ配布)を行い、`phase: 'shop'`にする
- shop画面滞在中、天啓・神託を「即使う」で消費した場合は、このプレビューウェーブ・`deckComposition`に対して効果を適用する(現行`useRevelationFromOffer`と同じロジックをshop・各選択画面から共通で呼べるようにする)
- 「次のWaveへ」ボタン押下時: 現行`finishRevelationSelect`と同じ処理(蓄積した`deckComposition`・`extraTableauRows`で実際のウェーブを配り直す)を行い、`phase: 'playing'`、`shop: null`にする

## 8. 購入・売却ロジック(`engine.ts`)

新規に追加する主な関数(名称は実装時に調整可):

- `enterShop(params, run, seed, rand)`: Wave成功確定後・大凶続行後に呼ぶ。上記7の「shop突入時」処理を行い、`ShopState`(バラ売り3枠・福袋2枠)を抽選する
- `buyIndividual(params, run, slotIndex)`: バラ売り購入。対象カテゴリが上限に達している場合は何もしない(呼び出し側でボタンを無効化する想定)。神託・天啓は「即使う/温存」の選択を挟む
- `buyPack(params, run, slotIndex, rand)`: 福袋購入。上限チェックは行わず常に成立する。対応するカテゴリの`riteSelect`/`itemSelect`/`revelationSelect`/`oracleSelect`フェーズへ遷移し、`offerCount`分のオファーを抽選、`offerPickRemaining`を`pickCount`にセットする
- 各カテゴリの選択確定関数(`pickItem`/`pickRite`/`pickRevelationFromOffer`/`pickOracleFromOffer`等)は、選んだ対象が上限到達中なら5節のスワップ待ち状態にする(福袋由来の場合のみ発生。バラ売りは購入不可のため到達しない)。獲得が確定したら、福袋由来の場合`offerPickRemaining`を1減らし、0になるまでは同じフェーズに留まって残りのオファーから選ばせ、0になったら`phase: 'shop'`へ戻す
- `sellItem(params, run, itemId)` / `sellRite(...)` / `sellRevelation(...)` / `sellOracle(...)`: 所持品を売却し、対応する売却額を`run.currency`に加算する。`playing`・`shop`どちらのフェーズでも呼べる
- `useOracle(params, run, roleName)`: 6節参照

既存の`pickItem`からは`rollRite`の自動抽選呼び出しを削除する。`rollRite`自体は「秘儀オファーを1つ返す」用途としてショップ側の抽選(`rollRiteOffer`)から引き続き使う。

## 9. 管理画面

`/admin/shidasu-currency`ページを拡張し、通貨の基本設定(既存)に加えて以下を編集できるようにする。新規ページは作らない。

- 護符レアリティ別(C/U/R)の購入額・売却額
- 秘儀・天啓・神託カテゴリ別の購入額・売却額
- 福袋のカテゴリ×パターン別(護符/秘儀/天啓の3択1個・5択1個・7択2個、神託の3択1個・5択1個)の購入額、計11項目

## 10. UI/画面構成

- 新規`shop`フェーズ画面: 既存の全画面オーバーレイパターン(`fixed inset-0 z-50 bg-emerald-950/90 ...`)を踏襲。バラ売り3枠+福袋2枠をカード状に並べ、購入済みは売り切れ表示にする。所持品一覧と売却ボタンも同画面に置く。「次のWaveへ」ボタンで確定
- 新規`riteSelect`フェーズ画面: 既存の`itemSelect`/`oracleSelect`と同じリストボタンパターンを流用
- 既存`itemSelect`/`revelationSelect`/`oracleSelect`画面: 「アイテムを1つ選ぶ」等の文言は維持しつつ、5択・7択2個パターンに対応するため「選択済み数/必要数」の表示を追加し、7択2個の場合は1個選んでも画面を閉じず、残りのオファーから続けて選ばせる
- プレイ中画面: 天啓・神託の合算所持枠の表示、および所持品売却ボタンを追加する

## 11. テスト方針

`engine.test.ts`に以下を追加する。

- `resolveWaveEnd`成功時、`phase`が`'shop'`になり`shop`にバラ売り3枠・福袋2枠が入っている
- バラ売り購入で通貨が減り、対象カテゴリが所持へ追加される
- カテゴリ上限到達時、バラ売り購入(神託以外)がブロックされる/スワップ待ちになる
- 神託はカテゴリ上限に関わらず購入でき、「即使う」でレベル+1、「温存」で`run.oracles`に追加される
- 福袋購入 → 選択画面遷移 → オファー数・選択数(3-1/5-1/7-2)通りに動作し、選び終えたら`shop`に戻る
- 天啓・神託合算枠の上限判定(片方が1個所持でもう片方が1個所持の状態で合計2に達したら両方ブロック)
- 所持品の売却で通貨が増え、所持から削除される
- 「次のWaveへ」で`playing`に遷移し、`shop`が`null`に戻り、蓄積した天啓効果を反映したウェーブが配られる
- 秘儀の自動抽選(`rollRite`のpickItem内呼び出し)が発生しないこと

## 対象外(今回のスコープ外)

- 護符以外(秘儀・天啓・神託)の個別種類ごとの価格差別化(将来必要になれば別途検討)
- 変動売却額を実際に持つ護符の実装(仕組みの土台だけ作る)
- ラン間での所持品・通貨の永続化(既存通りセーブ機構自体が無いため対象外)
