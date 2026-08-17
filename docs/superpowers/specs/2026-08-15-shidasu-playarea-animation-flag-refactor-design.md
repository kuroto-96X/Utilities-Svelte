# PlayArea.svelteアニメーション中判定共通化リファクタ 設計

> 対象: `src/routes/game/shidasu/PlayArea.svelte`にある「いずれかのアニメーションが進行中か」を判定する論理式の重複を、単一の`$derived`変数に集約する。純粋なリファクタであり、ゲームの挙動は一切変更しない。

## 背景・目的

これまでのセッションで4回、`engine.ts`・`shop.ts`・`+page.svelte`にあった機械的重複を共通ヘルパー・ファクトリに切り出すリファクタを実施した(福袋pick系→売却・価格・ハンドラ系→バラ売り購入系→コア進行系)。今回はそれらとは別ファイルの`PlayArea.svelte`(1090行)を対象とする。

`PlayArea.svelte`には5つのアニメーション状態(`playingAnimation`・`scoreReveal`・`cleanupAnimation`・`chainResetAnimation`・`dealAnimationActive`)があり、「いずれかが進行中かどうか」を判定する論理式が、通常形・否定形の違いはありつつも同じ内容のまま5箇所にインラインで書かれている。

## 方針(スコープ)

`PlayArea.svelte`単体で完結する変更。5つのアニメーション状態変数が全て宣言済みになる位置に`$derived`変数を1つ追加し、5箇所の重複したインライン論理式をこの変数の参照に置き換える。`+page.svelte`や他コンポーネントへの影響は無い。

## 技術設計

`dealAnimationActive`(`let dealAnimationActive = $derived(dealingCards.length > 0)`)の直後に、以下の`$derived`変数を追加する:

```ts
// いずれかのアニメーション(カードプレイ・得点演出・清算・チェーンリセット・配布)が進行中かどうか。
// 進行中は操作(カードプレイ・山札引き・秘儀/天啓使用)を無効化する。
let anyAnimationActive = $derived(playingAnimation !== null || scoreReveal !== null || cleanupAnimation !== null || chainResetAnimation !== null || dealAnimationActive)
```

以下5箇所の重複箇所を置き換える:

1. カード枠の`disabled`属性(913行目): `playingAnimation !== null || scoreReveal !== null || cleanupAnimation !== null || chainResetAnimation !== null || dealAnimationActive` → `anyAnimationActive`
2. カード枠のハイライト表示条件(915行目、否定形): `playingAnimation === null && scoreReveal === null && cleanupAnimation === null && chainResetAnimation === null && !dealAnimationActive` → `!anyAnimationActive`
3. 山札引きボタンの`disabled`属性(950行目): `playingAnimation !== null || scoreReveal !== null || cleanupAnimation !== null || chainResetAnimation !== null || dealAnimationActive` → `anyAnimationActive`
4. 秘儀の使用可否判定(1001行目、否定形): `playingAnimation === null && scoreReveal === null && cleanupAnimation === null && chainResetAnimation === null && !dealAnimationActive` → `!anyAnimationActive`
5. 天啓の使用可否判定(1017行目、否定形): 同上

いずれも既存の論理式をそのまま単一変数の参照に置き換えるだけで、`disabled=...||...`の他の条件(`wave.stock.length === 0 || !allowDraw`等)や、`&&`で組み合わされる他の条件(`canUseRite(...)`等)は変更しない。

## テスト

- `PlayArea.svelte`はUIコンポーネントのため、直接のユニットテストは存在しない(既存の慣習と同じ)。型チェック(`npm run check`)で構文・型の正しさを検証する。
- UIの目視確認として、`npm run dev`でカードプレイ中・山札引き演出中・清算演出中・チェーンリセット演出中・配布演出中それぞれについて、カード枠・山札引きボタン・秘儀/天啓ボタンが正しく無効化される(かつ演出終了後に正しく再度有効化される)ことを確認する。

## スコープ外

- `drawStock`のnaiveパス(playCardのスコア計算パイプラインを部分的に再実装している箇所)の重複解消。乗数の適用範囲が微妙に異なり、抽出には既存テストでの厳重な固め打ちが必要なため見送る
- `+page.svelte`の天啓プレビュー用「run.waveを一時差し替えて効果適用→戻す」パターン(3ハンドラで重複)の共通化。プレビュー継続/終了の分岐条件が呼び出し元ごとに微妙に異なり、慎重な検討が必要なため見送る
- 挙動・UIの変更(本リファクタは純粋なリファクタであり、ゲームの挙動は一切変更しない)
