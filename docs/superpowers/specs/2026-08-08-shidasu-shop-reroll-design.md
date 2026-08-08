# ショップ品ぞろえリロール機能 設計

## 概要

ショップ画面に、バラ売り3枠+福袋2枠の品ぞろえを一括で再抽選する「リロール」ボタンを追加する。売り切れ済みの枠も含めて全て新しい商品に入れ替わる。リロールには通貨(星片)を消費し、同一ショップ訪問中にリロールするたびにコストが増額する。

## 背景

現状、ショップ画面(護符・秘儀・天啓・神託・トランプセットのバラ売り3枠+福袋2枠を購入する画面)には品ぞろえを再抽選する手段が無く、一度入店した際の品揃えで固定される。既存の「リロール」ボタンはステージ画面(`showStageScreen`)にあるボスWaveの星専用のもの(`rerollStageStars`、固定コスト30)であり、ショップの品ぞろえとは無関係。

## コスト方式

- 通貨(星片)を消費する。**初回5、以降リロールするたびに+5**(1回目5、2回目10、3回目15…)
- リロール回数は`RunState.shopRerollCount`として保持し、**同一ショップ訪問中のみ有効**。次のWaveクリアで新しいショップに入る(`enterShop`)たびに0にリセットされる
- 通貨がコスト未満の場合はボタンを無効化する(既存のボスWaveリロールボタンと同じパターン)
- コスト計算式: `cost = (shopRerollCount + 1) * params.shop.rerollCostStep`(`rerollCostStep`の既定値は5)

## リロール対象

バラ売り3枠+福袋2枠を**一括で**全入れ替えする。ボタンは1つのみ。既存の`rollShop`関数(`shop.ts`)をそのまま再利用して`RunState.shop`を丸ごと差し替える。

- 売り切れ済みの枠も対象に含まれ、新しい商品に入れ替わる
- `rollShop`が持つ既存の抽選ロジック(護符は所持中・同一ショップ内重複を除外、福袋は`PACK_DEFINITIONS`から2パターンを重複無く抽選)はそのまま踏襲される
- 既に購入済みのアイテム自体(所持護符・秘儀・天啓・神託・カードセットで追加したカードなど)には一切影響しない。あくまで「まだ買っていない/売り切れの陳列」がリセットされるだけ

## 技術要素

### 型定義(`types.ts`)

`RunState`に`shopRerollCount: number`を追加(`cardSetOffer`の直後)。

### パラメータ(`params.ts`・`shidasu.config.json`)

`shop.rerollCostStep: number`を追加(既定値5)。既存の`shop.packPrice`等と同じ`shop`オブジェクト配下に置く。

### エンジン(`engine.ts`)

- `createInitialRun`・`beginRun`・`enterShop`の3箇所で`shopRerollCount: 0`を設定する(Task1で`cardSetOffer: []`を追加した3箇所と同じ)
- 新規関数`rerollShop(params: ShidasuParams, run: RunState, rand: () => number = Math.random): RunState`を追加する
  - `run.phase !== 'shop' || !run.shop`の場合は何もせず`run`をそのまま返す
  - `cost = (run.shopRerollCount + 1) * params.shop.rerollCostStep`を計算し、`run.currency < cost`なら何もせず`run`をそのまま返す
  - 成功時は`currency`から`cost`を減算し、`shop: rollShop(run, rand)`で丸ごと入れ替え、`shopRerollCount`を+1して返す

### UI(`+page.svelte`)

ショップ画面のヘッダー(見出し「ショップ」と通貨表示の隣、`+page.svelte`714行目付近の`<div class="flex items-center justify-between">`内)に「リロール({コスト})」ボタンを追加する。`handleRerollShop`ハンドラーを新設し、`rerollShop(params, run)`を呼んで`run`を更新する。ボタンは`run.currency < cost`のとき無効化する(既存のボスWaveリロールボタンの`disabled`パターンを踏襲)。

### 管理画面(`/admin/shidasu-currency`)

`shop.rerollCostStep`の価格編集欄を追加する(既存の`packPrice`等の価格パラメータと同様の入力欄・バリデーションパターン)。

## テスト

- `rerollShop`のユニットテスト(`engine.test.ts`): フェーズ外での呼び出しが無視されること、通貨不足で無視されること、成功時にcurrency減算・shop入れ替え・shopRerollCount+1が正しく行われること、コストが回数ごとに5→10→15…と増額すること
- `enterShop`(既存テスト)に`shopRerollCount`が0でリセットされることの検証を追加

## 対象外

- リロールを個別の枠(バラ売りのみ/福袋のみ)に分けて行う機能は対象外(一括リロールのみ)
- 購入済みアイテムの返金・取り消しは対象外
