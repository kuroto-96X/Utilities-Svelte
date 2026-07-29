# 星パラメータ管理画面(shidasu-bosses)の本格UI化 設計

## 背景・目的

[ラン構成の再構築](./2026-07-28-shidasu-run-structure-redesign-design.md)で`bosses.ts`が全面書き換えとなり、`admin/shidasu-bosses/+page.svelte`が削除済みシンボルをimportしてビルドエラーを起こしていたため、緊急対応として`params.stars`配列を直接編集する最小限のUI(追加・削除ボタンのみの素朴なテーブル)に置き換えた経緯がある。今回はこのページを、他のshidasu管理画面(`shidasu-talismans`等)と同等の使いやすさに引き上げる。

## スコープ

対象:
- `src/routes/admin/shidasu-bosses/+page.svelte`の表示・操作性改善
- `params.ts`の`stars`型への`descTemplate`フィールド追加
- `types.ts`の`Star`型への`descTemplate`フィールド追加、`engine.ts`の`toStarRestriction`/`rollStarForSlot`でのコピー
- ゲーム画面側`starRestrictionDetail`(`src/routes/game/shidasu/+page.svelte`)を、ハードコードされたswitch文からテンプレート展開方式に変更
- `bossActualEffects.ts`の`STAR_RESTRICTION_ACTUAL_EFFECTS`文言を、変数名・関数名を使わない自然文の要約に書き換え
- 既存データ移行: `shidasu.config.json`の`stars`全エントリに`descTemplate`を追加、Wave3(`waveSlot === 3`)の全星の`targetMultiplier`・`reward`を`2`・`5`に一括更新

対象外(次セクション以降で対応):
- admin一覧ページ(`src/routes/admin/+page.svelte`)の`shidasu-bosses`・`shidasu-currency`リンク説明文の更新(現状、旧仕様「ボス候補・階級・七つの大罪の娘罪」のままになっている)
- `shidasu-currency`ページに残る`config.currency.bossBonus.shoukyou/chuukyou/taikyou`(旧BossKind仕様)フィールドの削除
- `params.ts`内の`bossTiers`・`bosses`(非推奨フィールド)自体の削除
- 他のshidasu管理画面(shidasu-talismans/rites/revelations/oracles等)の変更

## 設計

### 1. ヘッダークリックソート

テーブルヘッダーのうち「Wave」「名前」「倍率」「報酬」「制限種別」をクリック可能にし、その列で表示順を並び替える。同じ列を再クリックすると昇順⇔降順が切り替わる。デフォルトの表示順(初期状態)は`config.stars`配列の並び順のまま。

ソートは**表示用のみ**で、`config.stars`配列自体の順序は変更しない(保存時に意図しない差分が生じるのを避けるため)。実装は`$derived`で並び替え済みの配列を作り、テーブルの`{#each}`はその配列を参照する形にする。ソート状態(列・昇順/降順)はページローカルな`$state`で保持し、保存対象(`config`)には含めない。

### 2. 説明文テンプレート化

現状、星の制限ルール説明文は2箇所にハードコードされている:
- `bossActualEffects.ts`の`STAR_RESTRICTION_ACTUAL_EFFECTS`(開発者向け、実装ロジックの詳細な要約。管理画面の「実際の効果(監査用)」列に表示)
- `+page.svelte`(ゲーム画面側)の`starRestrictionDetail`関数(プレイヤー向け、UIに表示する短い説明文をswitch文で返す)

このうち`starRestrictionDetail`が返す**プレイヤー向け説明文**を、`params.stars`側で編集可能なテンプレート文字列に置き換える。

- `params.ts`の`stars`配列の各要素に`descTemplate: string`を追加する。例: `lowCombo`なら`"{maxCombo}コンボ以下で無得点"`、`noLoop`なら`"A⇔Kループ禁止"`(プレースホルダーなし)
- `types.ts`の`Star`型にも`descTemplate: string`を追加する
- `engine.ts`の`rollStarForSlot`(星選出時、`params.stars`のエントリから`Star`を組み立てる箇所)で、選ばれたエントリの`descTemplate`を`Star.descTemplate`にそのままコピーする
- テンプレートのプレースホルダー展開は、`revelations.ts`の`revelationDesc`が使っている`.replace(/\{(\w+)\}/g, ...)`パターンを踏襲する。展開対象のコンテキストは`star.restriction`のうち数値・文字列フィールド(`maxCombo`・`suit`)とする
- ゲーム画面側`starRestrictionDetail`は、`switch (star.restriction.kind)`による分岐をやめ、`star.descTemplate`をプレースホルダー展開して返すだけの実装に変更する。`restriction === null`(制限なし)のケースのみ、従来通り空文字を返す

管理画面側には、`descTemplate`を編集する入力欄と、その場で展開結果をプレビュー表示する列を追加する(`shidasu-talismans`の「説明文テンプレート」「プレビュー」列と同じパターン)。プレビューは`revelationDesc`と同様、その星の`restriction`相当のダミー値(`maxCombo`はparamsの値、`suit`は実行時に決まるため管理画面では固定のプレースホルダー文字列、例えば`"(抽選)"`のような表示にする)を使って展開する。

### 3. 行単位バリデーション表示

現状は「星名が空、lowCombo制限でmaxComboが未入力、またはいずれかのWaveスロットの星数が0件です」という1行のメッセージのみで、どの星のどの項目が問題かわからない。各セル(名前・maxCombo等)について、問題があれば該当の`<input>`に赤枠(例: `border-red-400`)を付けるようにする。全体のサマリメッセージ(Waveスロットの星数0件など、行に紐づかないエラー)は既存のまま維持する。

### 4. 新規追加時のデフォルト値変更

`addStar`関数が新しい星を追加する際のデフォルト値を、現状の`targetMultiplier: 1, reward: 0`から`targetMultiplier: 2, reward: 5`に変更する。

### 5. 既存Wave3データの一括更新(一度限りの移行操作)

管理画面に「Wave3の倍率・報酬を一括更新」ボタンを追加する。押すと、表示中の`config.stars`のうち`waveSlot === 3`の全エントリの`targetMultiplier`を`2`、`reward`を`5`に上書きする(他のフィールドは変更しない)。この操作はローカルな`config`state内での書き換えのみで、既存の「保存」ボタンを押すまでAPIへは反映されない(既存の保存フローに乗せる)。

### 6. 「実際の効果」列の要約の書き換え

`bossActualEffects.ts`の`STAR_RESTRICTION_ACTUAL_EFFECTS`の各文言を、関数名(`stageModifierFor`・`bossScoreLockFor`等)や変数名(`wave.combo`等)を使わない、プレイヤー向けではなく開発者向けだが自然文の要約に書き換える。例:
- 現状: `"stageModifierForがStageModifier "noLoop" を返し、isPlayableでランク差12(A⇔Kループ)の接続を禁止する(取得可否そのものを制限、得点には無関係)"`
- 変更後の方向性: `"A⇔Kのループ接続でのカード取得自体を禁止する(得点への影響はない)"`

## テスト方針

`engine.ts`の変更(`rollStarForSlot`での`descTemplate`コピー)は既存の`engine.test.ts`に単体テストを追加する。管理画面のUI変更(ソート・バリデーション表示・一括更新ボタン)は既存方針通り自動テスト対象外とし、ブラウザでの目視確認とする。

既存データ移行(`shidasu.config.json`への`descTemplate`追加・Wave3一括更新)は、実装計画作成時にJSON側の具体的な編集内容を洗い出す。
