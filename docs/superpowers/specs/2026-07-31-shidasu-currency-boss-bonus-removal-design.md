# currency.bossBonus未使用フィールドの削除 設計

## 背景・目的

[bossTiers・bosses非推奨フィールドの削除](./2026-07-30-shidasu-boss-tiers-removal-design.md)を実施した際、`shidasu-currency`管理画面にある`currency.bossBonus`(小凶/中凶/大凶ごとのボーナス額)は今回スコープ外として対象外にしていた。

改めて調査した結果、`currency.bossBonus`は`engine.ts`のWave報酬計算(`resolveWaveEnd`)から一切参照されておらず、ゲームロジックに何の影響も与えていない死んだフィールドだと判明した。実際のWave報酬は`params.currency.waveClearAmount + currentStar.reward`(starsフィールドの`reward`)で計算されており、旧ボス階級システム(`BossKind`)の廃止時に置き換え漏れとして取り残されていたものである。

管理画面上は入力・保存ができてしまうため、値を変更しても実際のゲームには反映されないという混乱を招く状態になっている。これを解消するため、`currency.bossBonus`を削除する。

## スコープ

対象:
- `params.ts`の`ShidasuParams`型から`currency.bossBonus`フィールドを削除、`DEFAULT_PARAMS`の該当データを削除
- `shidasu.config.json`から`currency.bossBonus`データを削除
- `admin/shidasu-currency/+page.svelte`から、`bossBonus`の入力UI(小凶/中凶/大凶の3項目)・バリデーションチェック(3行)を削除。あわせて「ボスボーナスはWaveクリア時の獲得数に加算されます」という実態と異なる説明文も削除する
- `admin/+page.svelte`(admin一覧ページ)の`shidasu-currency`リンクの説明文から「ボス階級別ボーナス」の記述を除く

対象外(維持する):
- `currency.name`・`symbol`・`initialAmount`・`waveClearAmount`(現役)
- `currency.waveClearAmount`と星の`reward`によるWave報酬計算ロジック自体(変更不要、既に正しく動作している)

## 設計

3ファイル(`params.ts`・`shidasu.config.json`・`shidasu-currency/+page.svelte`)から`bossBonus`関連を削除する。3者は常に同じ構造を保つ既存の運用ルールに従う。

`admin/shidasu-currency/+page.svelte`の変更点:
- `hasValidationError`内の`bossBonus.shoukyou`/`chuukyou`/`taikyou`のNumber.isFiniteチェック3行を削除
- 「小凶/中凶/大凶ボスボーナス」の3項目の`<label>`+`<input>`ブロック(グリッド全体)を削除
- 直下の説明文`<p>`(「ボスボーナスはWaveクリア時の獲得数に加算されます...」)を削除

`admin/+page.svelte`の変更点:
- `shidasu-currency`リンクの説明文を「通貨(星片)の名称・記号、初期所持数、Waveクリア獲得数、ボス階級別ボーナスの編集」から「通貨(星片)の名称・記号、初期所持数、Waveクリア獲得数の編集」に変更

## テスト方針

型削除・データ削除はコンパイルエラーの有無で検証される。既存のvitestテストに`bossBonus`への依存はないため、新規テスト追加は不要。UIの変更はブラウザでの目視確認とする。

確認項目:
- `npm run build`・`npm run check`でエラーが出ないこと
- `npx vitest run`で既存テストが全件PASSすること
- `/admin/shidasu-currency`から「小凶/中凶/大凶ボスボーナス」の入力欄・説明文が消えていること、他の項目の表示・保存・バリデーションが正常に動作すること
- `/admin`一覧ページの`shidasu-currency`説明文が更新されていること
