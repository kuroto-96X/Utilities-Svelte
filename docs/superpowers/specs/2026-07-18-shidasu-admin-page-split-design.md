# Shidasu admin/shidasu ページ分割 設計

## 0. 背景・目的

`src/routes/admin/shidasu/+page.svelte`(381行)は、Shidasuの一般設定(レイアウト・スコアリング・役ボーナス・ステージ・アイテム・フロー/UI・JSON入出力)を編集する単一の管理画面コンポーネントで、ロジック(バリデーション・保存/読込・JSON処理)約130行に対しマークアップが大半を占める。

先行するエンジン層のリファクタリング(`engine.ts`/`itemEffects.ts`の分割)と同じ目的で、今後この設定画面に手を入れる際にファイル全体を読まなくても該当セクションだけ見ればよい状態にする。**挙動は一切変更しない、純粋なリファクタリング**であることが最重要の制約。

## 1. ファイル構成

```
src/routes/admin/shidasu/
  +page.svelte            (config読込・保存・リセット・バリデーション・トースト管理。各セクションを組み合わせるシェルに縮小)
  ScaledNumberInput.svelte (現行の`scaledNumberInput`スニペットをコンポーネント化した、点数系パラメータ用の入力欄)
  LayoutSection.svelte    (config.layout: cols/rows)
  ScoringSection.svelte   (config.scoring: basePoint〜comboMultiplierStep)
  RoleBonusSection.svelte (config.scoring: flushBonus〜columnSweepBonus)
  StagesSection.svelte    (config.stagesのテーブル。追加/削除/編集も内包)
  ItemsSection.svelte     (config.items.maxItems)
  FlowUiSection.svelte    (config.flow + config.ui)
  JsonPanel.svelte        (JSON表示・貼り付け適用。jsonText/jsonErrorはこのコンポーネント内で自己完結)
```

`+page.svelte`は381行→150行程度に縮小見込み。

`scaledNumberInput`は現在Svelte snippetとして定義されているが、Scoring・RoleBonus・Stagesの3ファイルから使う必要があるため、通常のコンポーネント(`ScaledNumberInput.svelte`)に変換する(snippetはファイルをまたいだ再利用がしづらいため)。`value`/`onChange`という現行と同じpropsを持ち、表示上の`/10`変換・入力時の`*10`変換ロジックは一切変更しない。

## 2. propsの設計

各セクションコンポーネントは`config: ShidasuParams`をpropとして受け取り、`config.layout.cols`のように**直接ネストしたプロパティをミューテーションする**形にする(Svelte5の`$state`はディープリアクティブなプロキシのため、参照を渡せば子コンポーネント内での直接変更が親に反映される)。これにより、現行の`setScoring`/`setTarget`のような汎用セッター関数は不要になり、各セクションが自分の担当範囲を直接編集する形にシンプル化される。

`StagesSection`は`addStage`/`removeStage`のロジックも内包し、`config.stages`を直接push/spliceする。

`JsonPanel`だけは例外で、JSON貼り付け適用時に`config`オブジェクト自体を丸ごと差し替える必要があるため(`config = parsed`という再代入)、`config`(現在値表示用)に加えて`onApply: (newConfig: ShidasuParams) => void`というコールバックpropを受け取る。`+page.svelte`側は`onApply`内で`config = newConfig`への再代入とトースト表示を行う。

`jsonText`/`jsonError`のstateは`+page.svelte`から`JsonPanel.svelte`内部のローカルstateに移す(このコンポーネント以外から参照されないため)。`openJsonPanel`/`applyJson`の関数も`JsonPanel.svelte`内に移動する。

## 3. 検証方針

1. 各セクションへの切り出しはマークアップのコピー+propsの配線のみで、入力欄のロジック(バリデーション条件・保存/読込のAPI呼び出し)は一切変更しない
2. `npm run check`で型エラーがないことを確認する
3. `npm run dev`で実際に`/admin/shidasu`を開き、各セクションの値を編集→保存→リロードして値が保持されること、JSON表示→編集→貼り付け適用が動作すること、ステージ追加/削除が動作することを確認する
4. `npm run build`が成功することを確認する

## 4. スコープ外

- バリデーションロジック(`hasValidationError`・`targetsNotAscending`・`isValidShidasuParams`)の別モジュールへの切り出し(このページ専用のロジックであり、分離の効果が薄いため)
- `admin/shidasu-talismans`・`admin/shidasu-debug`など他の管理画面への追加変更
- 保存/読込APIエンドポイント(`/api/admin/shidasu-config`)側の変更

## 5. 受け入れ基準

1. `src/routes/admin/shidasu/+page.svelte`が、config読込・保存・リセット・バリデーション・トースト管理・各セクションの組み合わせのみを含む状態になっている(150行程度)
2. レイアウト・スコアリング・役ボーナス・ステージ・アイテム・フロー/UIの各セクションが、対応する新規コンポーネントに移動している
3. `ScaledNumberInput.svelte`が3ファイル(Scoring・RoleBonus・Stages)から共通して使われている
4. `JsonPanel.svelte`が`jsonText`/`jsonError`のstateとJSON表示・適用ロジックを自己完結して持ち、`onApply`コールバック経由で親の`config`を更新している
5. `npm run check`・`npm run build`が成功する
6. `/admin/shidasu`の実際の動作(各セクションの編集・保存・リロード・JSON表示/適用・ステージ追加/削除)が分割前と変化していない
