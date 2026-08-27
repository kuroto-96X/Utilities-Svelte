# スプレッド専用admin設定ページ 実装設計

## 背景・目的

`ShidasuParams.spreads`(愚者・月・教皇の3種、`SpreadConfig`型)を管理画面から編集できるようにする。現状、他の護符・秘儀・天啓・神託・レリック・妨害行動・福袋・星・通貨は全て専用のadmin設定ページ(`/admin/shidasu-talismans`等)を持っているが、スプレッドだけは編集手段が無い(`DEFAULT_PARAMS.spreads`を直接コード編集する以外に方法がない)状態になっている。

## 変更内容

### 1. 新規ページ `/admin/shidasu-spreads`

既存の`/admin/shidasu-sabotage`・`/admin/shidasu-relics`と同じ「単一テーブル型」の構成を踏襲する。`SpreadId`の一覧(`fool`・`moon`・`pope`)を行としてループし、以下の7列を編集可能にする。

| 列 | フィールド名 | 入力形式 |
|---|---|---|
| ID | (`SpreadId`のキー自体) | 読み取り専用テキスト |
| 名称 | `name` | text input |
| 説明文 | `desc` | textarea |
| 初期行数オフセット | `initialExtraTableauRows` | number input(`step="any"`) |
| 目標スコア基礎値 | `waveTargetBase` | number input(`step="any"`) |
| 目標スコア倍率 | `waveTargetMultiplier` | number input(`step="any"`) |
| 神託初期レベル | `initialOracleLevel` | number input(`step="any"`) |
| ショップ非販売種別 | `bannedShopKinds` | チェックボックス5個(`item`/`rite`/`revelation`/`oracle`/`cardSet`) |

`bannedShopKinds`はチェックボックスがチェックされた種別を配列として`SpreadConfig.bannedShopKinds`に反映する(例: `item`と`oracle`をチェックすると`['item', 'oracle']`になる)。

### 2. `SPREAD_IDS`一覧の共有化

現状、スプレッドのID一覧(`['fool', 'moon', 'pope']`)は`src/routes/game/shidasu/+page.svelte`内にのみハードコードされたローカル定数`SPREAD_IDS`として存在する(ゲーム側のスプレッド選択画面がこれをループして描画している)。今回の管理画面でも同じ一覧が必要になるため、`src/lib/game/shidasu/params.ts`に`SPREAD_IDS: SpreadId[]`という公開定数として切り出し、ゲーム側(`+page.svelte`)・admin側の両方から参照する単一の情報源にする。

**配置場所の判断根拠**: このプロジェクトでは`ITEM_POOL`(`items.ts`)・`RELIC_POOL`(`relics.ts`)・`RITE_POOL`(`rites.ts`)・`REVELATION_POOL`(`revelations.ts`)・`ORACLE_POOL`(`oracles.ts`)・`SABOTAGE_POOL`(`sabotage.ts`)のように、各ドメインの「IDの一覧」はドメイン専用ファイルに`XXX_POOL`という命名で置く慣習がある。ただしスプレッドは現状ロジック関数を持たない純粋なデータ(`SpreadConfig`のセットのみ)であり、専用ファイル(`spreads.ts`)を新設するほどの実体が無いため、今回は既に`DEFAULT_PARAMS.spreads`の定義がある`params.ts`に`SPREAD_IDS`定数を追加する。命名は`XXX_POOL`ではなく`SPREAD_IDS`のままとする(既存の`+page.svelte`のローカル定数名をそのまま公開定数に格上げする形のため、名称変更によるコードベース内の混乱を避ける)。

新規スプレッドを追加する際、この定数1箇所を更新するだけでゲーム画面・admin画面の両方に反映されるようになる。

### 3. データの読み書き

新規APIエンドポイントは追加しない。既存の`/api/admin/shidasu-config`(GET/POSTで`shidasu.config.json`全体を読み書きする、`vite.config.ts`の`jsonFileApiPlugin`)をそのまま使う。ページ側の実装は`config.spreads[id]`のプロパティを編集し、保存時は`config`オブジェクト全体をPOSTする(他の設定画面と同じ、部分更新ではなく全体上書き)。

### 4. バリデーション

既存の設定画面(`shidasu-talismans`・`shidasu-sabotage`)と同じパターンを踏襲する。以下のいずれかに該当する場合、保存ボタンを無効化する:

- `name`または`desc`が空文字(トリム後)
- `initialExtraTableauRows`・`waveTargetBase`・`waveTargetMultiplier`・`initialOracleLevel`のいずれかが`Number.isFinite`でない

`bannedShopKinds`はチェックボックスUIのため常に有効な配列になり、バリデーション対象に含めない。

### 5. `/admin/+page.svelte`へのリンク追加

管理ページ一覧の末尾(既存の「妨害行動設定」エントリの後)に、新規ページへのリンクを既存と同じ`<a>`ブロックの形式で追加する。タイトルは「星詠みソリティア -Shidasu- スプレッド設定」、説明文は「fool・moon・popeの初期条件・目標スコア・ショップ制限を編集」のような内容にする。

## テスト方針

このプロジェクトのadmin画面(`+page.svelte`)は、他の既存設定ページ(`shidasu-talismans`・`shidasu-sabotage`等)にもユニットテストが存在しないため、本実装でも新規に自動テストは追加しない。実装完了後、プロジェクトCLAUDE.mdの完了前チェック(`npm run build`・`npm run check`・`npm run dev`でのブラウザ動作確認)で担保する。`npm run dev`での確認時は、実際に3種のスプレッドの値を編集・保存し、`/game/shidasu`のスプレッド選択画面の説明文が更新後の内容に反映されることも確認する。

## スコープ外

- `SpreadConfig`型自体へのフィールド追加・変更(今回は既存7フィールドの編集UIを提供するのみ)
- 新規スプレッドの追加(名称候補・固有ルールの検討は`docs/shidasu/shidasu-spread-candidates.md`を参照、別セッションで扱う)
- `bannedShopKinds`以外の配列・オブジェクト型フィールドの汎用UIパターン化(今回はスプレッド専用のチェックボックス実装に留める)
