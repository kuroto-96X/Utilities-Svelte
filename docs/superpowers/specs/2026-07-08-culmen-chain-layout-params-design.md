# Culmenのチェーン表示レイアウトのパラメータ化 設計

## 0. 背景・目的

直前の再設計(`docs/superpowers/specs/2026-07-08-culmen-chain-fan-actionbar-design.md`)で、チェーン表示の横オフセット(32px)・1行の表示枚数(13枚)をハードコードした。これらを`CulmenParams`のパラメータとして切り出し、`/admin/culmen`から調整できるようにする。

## 1. スコープ

- 対象: `src/lib/game/culmen/params.ts`・`src/lib/game/culmen/culmen.config.json`・`src/routes/game/culmen/+page.svelte`・`src/routes/admin/culmen/+page.svelte`
- 対象外: 縦オフセット(draw:20px/play:0px)・行の高さ(116px)は今回パラメータ化しない(現状のハードコード値のまま)。エンジン(`engine.ts`・`types.ts`)は変更しない。

## 2. パラメータ

`CulmenParams.ui`に以下を追加する:

```ts
ui: {
  comboTierThresholds: [number, number, number]
  chainCardOffsetX: number
  chainCardsPerRow: number
}
```

- `chainCardOffsetX`: チェーンの各カードを右にずらす幅(px)。デフォルト`32`(現行のハードコード値を踏襲)。
- `chainCardsPerRow`: 1行に表示するカードの枚数。デフォルト`13`(現行のハードコード値を踏襲)。

## 3. `+page.svelte`側の変更

現在ハードコードしている`32`(横オフセット)と`13`(`chunk(chainEntries, 13)`の第2引数)を、それぞれ`params.ui.chainCardOffsetX`・`params.ui.chainCardsPerRow`の参照に置き換える。行の高さ(116px)・縦オフセット(20px/0px)は変更しない。

## 4. `/admin/culmen`側の変更

「フロー・UI」セクションに、既存の`comboTierThresholds`と同様の通常の数値入力欄を2つ追加する:
- `横にずらす幅(chainCardOffsetX)`: `min="0" step="1"`
- `1行に表示する枚数(chainCardsPerRow)`: `min="1" step="1"`

既存の`hasValidationError`(保存ボタンを無効化する検証)に、以下を追加する:
- `chainCardsPerRow`が1未満、または`Number.isFinite`でない場合はエラー
- `chainCardOffsetX`が0未満、または`Number.isFinite`でない場合はエラー

## 5. 受け入れ基準

1. `/admin/culmen`で`横にずらす幅`・`1行に表示する枚数`を変更して保存できる
2. `chainCardsPerRow`を1未満にしようとすると保存ボタンが無効化される
3. `chainCardOffsetX`を負の値にしようとすると保存ボタンが無効化される
4. `/game/culmen`で、設定した値通りにチェーン表示の横オフセット・折り返し枚数が反映される
5. `npm run test`・`npm run build`が成功する
