# 実装スペック: ゴルフソリティア・ローグライク「登頂ソリティア -Culmen-」

## 0. 前提

- 対象プロジェクト: 96xtools.dev (SvelteKit + adapter-static + TypeScript + Tailwind CSS、Cloudflare Pages)
- ゲーム名は **「登頂ソリティア -Culmen-」**(表示名)。フォルダ名・URLスラッグ・変数名などコード上の識別子はすべて `culmen` を使う
  - 検討経緯: 当初「Catena」(ラテン語で「鎖・連鎖」)を軸に検討したが、Steamに同名かつ近ジャンル(カード主体のローグライト・デッキ構築)の未発売タイトルが存在し、スペルを変えた「Katena」も将来Steamで販売する可能性を考えると紛らわしいため回避。最終的に「Culmen」(ラテン語で「頂点・到達点」)を採用。Steam上で完全一致・紛らわしい既存タイトルがないことを確認済み
  - 日本語タイトル「登頂ソリティア」を併記することで、サイト内の他ツール(「ソリティア」「フリックタイピング」)と同様にジャンルが一目で伝わるようにする
- 最初の正は元原稿の React プロトタイプ `golf-rogue-prototype.jsx`(添付ファイル)。本スペックと矛盾する場合は本スペックを優先し、記載のない細部はプロトタイプに従う
- 既存プロジェクトの Svelte バージョン・コーディング規約・admin 運用のレイアウト規約に従うこと
- 既存の「ソリティア」(`src/routes/game/solitaire/`, `src/lib/game/solitaire/`)・「フリックタイピング」の実装規約を踏襲する。ディレクトリは **単数形 `game`**(`games` ではない)

## 1. ファイル構成

以下のファイルを作成する。

```
src/lib/game/culmen/params.ts          … パラメータ型定義・スキーマ・DEFAULT_PARAMS・読み書きユーティリティ
src/lib/game/culmen/culmen.config.json … 現在のパラメータ値(リポジトリにコミットする実データ)
src/lib/game/culmen/engine.ts          … ゲームロジック(純粋関数中心、UIから分離)
src/lib/game/culmen/types.ts           … Card / GameState などの型定義
src/routes/game/culmen/+page.svelte    … ゲーム本体ページ
src/routes/admin/culmen/+page.svelte   … パラメータ調整ページ(adminページ配下、既存の /admin/animation と同じレイアウト規約)
```

- ルーティングのパス(`/game/culmen`)はサイト既存のゲーム/ツール配置規約に合わせる。admin ページも既存規約通り `/admin/culmen` に置く(`/admin/game/culmen` のようなネストはしない。`/admin/menu`・`/admin/animation` と同列)
- `engine.ts` は「状態 + アクション → 新状態」の純粋関数で構成し、UIから分離する(将来のスコアランキング連携・ノーリプレイ検証の見据えを妨げない)

## 2. パラメータ仕様

### 2.1 型定義(params.ts)

```ts
export interface CulmenParams {
  layout: {
    cols: number;            // 場札の列数
    rows: number;            // 1列あたりの枚数
  };
  scoring: {
    basePoint: number;       // 1枚あたりの基礎点
    suitBonus: number;       // 同スートボーナス(基礎点に加算)
    colorBonus: number;      // 同色ボーナス(同スートと同時付与は優先せず排他)
    stairBonus: number;      // 階段継続1枚ごとのボーナス
    stairMinLen: number;     // 階段成立に必要な連続枚数
    wildSuitBonus: number;   // ワイルド直後の無条件スートボーナス
    clearBonus: number;      // 場札全消しボーナス
  };
  stages: Array<{
    name: string;                    // 例 "STAGE 1"
    modifier: "none" | "noLoop" | "faceLock";
    targets: [number, number, number]; // ウェーブ1〜3の目標スコア
  }>;
  items: {
    redBonusValue: number;     // 「紅の目利き」: ♥♦の基礎点加算
    faceBonusValue: number;    // 「宮廷の紋章」: J/Q/Kの基礎点加算
    shieldChargesPerPick: number; // 「コンボシールド」1回獲得あたりのウェーブごとの発動回数
    extraStockCount: number;   // 「厚めの山札」1回獲得あたりの山札追加枚数
    wildPerPick: number;       // 「ワイルド★」1回獲得あたりの札ウェーブ混入枚数
    startCombo: number;        // 「助走」: コンボの初期値/リセット後の値
    fullClearItemBonus: number; // 「完全消去」: 全消しボーナスへの加算
  };
  flow: {
    wavesPerStage: number;     // 1ステージのウェーブ数(既定3)
    clearDelayMs: number;      // 目標達成から遷移までの演出待ち時間
  };
  ui: {
    comboTierThresholds: [number, number, number]; // コンボ演出が派手になる閾値(小→大)
  };
}

export const DEFAULT_PARAMS: CulmenParams = { ... }; // 2.2の値
export function loadParams(): CulmenParams;   // culmen.config.json を静的importして返す
```

- `saveParams()` や `resetParams()` のようなクライアント側書き込みAPIは持たない(2.3参照)。パラメータの変更経路は admin ページ経由の一本化とする

### 2.2 既定値

| パラメータ | 既定値 |
|---|---|
| layout.cols / rows | 7 / 5 |
| scoring.basePoint | 10 |
| scoring.suitBonus | 10 |
| scoring.colorBonus | 5 |
| scoring.stairBonus | 15 |
| scoring.stairMinLen | 3 |
| scoring.wildSuitBonus | 10 |
| scoring.clearBonus | 200 |
| stages[0] | name "STAGE 1", modifier "none", targets [400, 750, 1300] |
| stages[1] | name "STAGE 2", modifier "noLoop", targets [600, 1100, 1900] |
| stages[2] | name "STAGE 3", modifier "faceLock", targets [800, 1500, 2600] |
| items.redBonusValue | 5 |
| items.faceBonusValue | 10 |
| items.shieldChargesPerPick | 1 |
| items.extraStockCount | 5 |
| items.wildPerPick | 1 |
| items.startCombo | 1 |
| items.fullClearItemBonus | 300 |
| flow.wavesPerStage | 3 |
| flow.clearDelayMs | 450 |
| ui.comboTierThresholds | [3, 5, 8] |

### 2.3 パラメータの永続化(既存の anim-config 方式を踏襲)

localStorage は使用しない。既存の `/admin/animation`(`src/lib/game/solitaire/anim.config.json` + `vite.config.ts` のミドルウェア)と同じ方式に統一する。

- `vite.config.ts` に `culmenConfigApiPlugin()` を追加する。実装は既存の `animConfigApiPlugin()` と同じ形で、対象パスのみ差し替える:
  - 監視・読み書き対象: `src/lib/game/culmen/culmen.config.json`
  - エンドポイント: `/api/admin/culmen-config`(GET でファイル内容を返却、POSTでファイルに書き込み)
  - `server.watch.ignored` にも `**/culmen.config.json` を追加し、保存時のHMR再マウントを防ぐ
- `/admin/culmen` ページは `/api/admin/culmen-config` にGET/POSTしてパラメータを編集する。UI・バリデーション・保存導線は `/admin/animation` の実装パターンを踏襲する(数値レンジ検証、リロード/保存ボタン、トースト通知)
- ゲーム本体ページ(`src/routes/game/culmen/+page.svelte`)は `culmen.config.json` を **静的import** して使用する(`import culmenConfigJson from '$lib/game/culmen/culmen.config.json'` の形)。adapter-static のビルド時にこの値がそのまま焼き込まれるため、admin での変更を本番に反映するには変更のコミット・再ビルド・再デプロイが必要(既存の `/admin/menu` の運用と同じ)
- `culmen.config.json` の初期内容は `DEFAULT_PARAMS` と同一の値でリポジトリにコミットしておく

## 3. ゲームルール仕様

### 3.1 基本要件

- 52枚の標準トランプ(ジョーカーなし)を毎ウェーブシャッフルして使用
- 場札: `cols × rows` 枚を列ごとに配置し、**全て表向き**。取れるのは各列の一番手前(最後に置かれた札)のみ
- 山札: 1枚が場札配布後の山札から1枚めくって初期札とする
- 山札: 残り全部(アイテム「厚めの山札」で加算あり。追加分は新しいランダムランクを複製)

### 3.2 札の取り合いルール

- 場札とランクの差 ±1 の場札(各列の一番手前)がタッチで取れる。スートは不問
- A〜K はループ扱いで ±1 とみなす(Stage modifier "noLoop" 中は禁止)
- modifier "faceLock" 中は J/Q/K は現在コンボが 2 以上のときのみ取れる
- 取った札は場札になる

### 3.3 コンボとチェーン

- 札を取るたびにコンボ +1。獲得点 = 基礎点(ボーナス込み) × 取った直後のコンボ数
- 山札をめくる(タップ)と場札が山札の1枚に置き換わり、原則コンボは `items.startCombo` 未所持なら 0 にリセット(チェーン(下記)も消える)
- **チェーン**: 現在のコンボ中に取った札を、取った順に画面上部へ小型カードで横並び表示する(横スクロール可)

### 3.4 パターンボーナス(基礎点に加算するコンボ倍率対象)

直前にチェーンへ加わった札(=比較対象)と比較して判定する。

1. 同スート: `suitBonus` を加算
2. 同色(スート違い): `colorBonus` を加算。1と2は排他でスート優先
3. 階段: ランク差 ±1 の方向(+1/-1)が `stairMinLen` 枚以上同方向で続く場合、成立中は取るたびに `stairBonus` を加算。A〜K ループもまたいで方向は継続扱う(差 +12 は -1、差 -12 は +1 に正規化して判定)。方向が反転したら長さ2から数え直す

### 3.5 山札めくりでコンボが継続する場合の特殊処理

- **シールド発動時(通常ルールだったらコンボ維持)**: めくった札もチェーン末尾に加える(**得点は付かない**)。パターン判定にも参加し、直前チェーン札と同方向±1なら階段を継続・延長する。次に場から取る札は、そのめくった札と通常比較に戻る
- **ワイルド★がめくれた時**: コンボ維持しチェーン末尾に★として加える。**ワイルド直後に取った札は無条件でチェーン継続**:
  - `wildSuitBonus` を加算(表示は「★同スート」)
  - 階段が成立・進行中(方向が確定済み)なら、めくった札のランクが同じ方向継続の長さ +1、成立枚数以上なら `stairBonus` を加算
  - その次の札からは直前の実カードとの通常比較に戻る

### 3.6 ウェーブの終了

以下のいずれかで即座にウェーブ終了判定を行う。

1. **目標達成**: スコアが目標以上になった瞬間、`clearDelayMs` 待ってウェーブクリア
2. **全消し**: 場札が 0 枚になったら `clearBonus`(+「完全消去」所持なら `fullClearItemBonus`)を加算して目標判定
3. **手詰まり**: 山札 0 かつ取れる場札がない → その時点のスコアで目標判定

目標未達で 2 または 3 に到達した場合はゲームオーバー(ランを終了し最初からやり直し)。

### 3.7 ラン構造とアイテム

- 1ラン = `stages` 配列の全ステージを、各ステージ `wavesPerStage` ウェーブ。ウェーブごとに目標スコアは `stages[i].targets` を使用。スコアはウェーブごとにリセット
- ウェーブ1・2クリア後: アイテム3枚(1つ選ぶ)。ウェーブ3クリア後: ステージクリア画面(次ステージの modifier を事前表示)。最終ステージのウェーブ3クリアで全クリア
- アイテム一覧(効果値は全て params 参照):

| id | 名称 | 効果 | 重複取得 |
|---|---|---|---|
| red5 | 紅の目利き | ♥♦の基礎点 +redBonusValue | 不可 |
| face10 | 宮廷の紋章 | J/Q/Kの基礎点 +faceBonusValue | 不可 |
| shield | コンボシールド | 山札めくりのコンボリセットを毎ウェーブ shieldChargesPerPick 回無効 | 可(回数加算) |
| stock5 | 厚めの山札 | 山札 +extraStockCount 枚 | 可(枚数加算) |
| wild1 | ワイルド★ | 毎ウェーブ山札に★を wildPerPick 枚混入 | 可(枚数加算) |
| start1 | 助走 | コンボが startCombo からスタート(リセット後も) | 不可 |
| clear300 | 完全消去 | 全消しボーナス +fullClearItemBonus | 不可 |

- 3枚の抽選: プール7種類から、ユニーク済取得済みのものを除外してランダムに3種(重複なし)提示

## 4. UI仕様

プロトタイプの画面構成を踏襲する(カードレイアウト・スマホファースト、最大幅480px中央寄せ)。

- ヘッダー: ステージ名、ウェーブ進捗ドット(3個)、modifier 表示、SCORE/TARGET、目標に対する進捗バー、コンボ表示(閾値 `comboTierThresholds` 超過で段階的に色・スケールが派手になる)
- 獲得点フィードブロック: 獲得直後に「+120 同スート+10 階段3 +15」のように内訳付きで表示
- 場札: グリッド表示。列は縦にずらしセットで重ねる、隠す。札左上コーナーのランク+スートが見えること。取れる札は黄色リングでハイライト
- チェーン列: 画面上部直下、パターン連結を行っている場合は末尾の札を半透明に
- 操作バー: 山札(残枚数表示・タップでめくる)、場札、所持アイテムのバッジ(シールド残数含む)
- オーバーレイ: ウェーブクリア&アイテム3枚 / ステージクリア / 全クリア / ゲームオーバー
- **重要**: カードの寸法・配色は Tailwind の任意値クラス(`aspect-[2/3]` 等)に依存せず、インラインスタイルまたはプロジェクトのバンドル済みCSSで指定すること(プロトタイプで任意値クラス一発失敗によりカード背景が潰れ黒スートが背景と同化し視認不良が発生した経緯があるため)
- カード配色の基準: 白 #FBF7EC、黒スート #15181D、赤スート #C7402D、ワイルド白 #EDE4FF/文字 #6D28D9、背景ダークで emerald-950 系

## 5. adminパラメータ調整ページ(/admin/culmen)

- 既存の `/admin/menu`・`/admin/animation` 配下のレイアウト規約に合わせる
- 2.1 の全パラメータをフォームで編集できる:
  - 数値は `<input type="number">`(step=1、負値不可のものは min=0)
  - `stages` は行(ステージ)×列(name / modifier / target1〜3)のテーブル形式。modifier は select("none" / "noLoop" / "faceLock")。ステージの追加・削除が可能にする(最低1ステージ)
  - `comboTierThresholds` は3つの数値個別
- 操作ボタン:
  - 「保存」: バリデーション(数値であること、targets が昇順でなくても警告表示)の上 `/api/admin/culmen-config` へPOST
  - 「デフォルトに戻す」: 確認ダイアログ後 `DEFAULT_PARAMS` でフォームを再描画し、保存操作で反映
  - 「JSONエクスポート/インポート」: 現在値を textarea で表示・貼り付け適用(端末間でのパラメータ共有用)
- 保存後、ゲームページは次のラン開始時から新パラメータを反映する旨を画面に明記する

## 6. 受け入れ基準

1. `/admin/culmen` で `basePoint` を変更して保存 → ゲームを最初からやり直すと獲得点に反映される(devサーバー上、再ビルド後)
2. `culmen.config.json` が既定値のままの状態で `npm run build` → 本番相当ビルドで DEFAULT_PARAMS 通りに正常動作する
3. 階段判定: 「5→6→7」で3枚目に階段ボーナスが付く。「5→6→5」では付かない。「K→A→2」(ループまたぎ)で付く。"noLoop" ステージでは K→A 自体が取れない
4. シールド発動でめくった札がチェーンに並び、得点は付かず、その札を起点にパターン判定が継続する
5. ワイルドがめくれた直後の獲得札に `wildSuitBonus` が付き、進行中の階段が方向維持で延長される
6. スコアが目標に達した瞬間(全消し・手詰まりを含む)にウェーブクリアへ遷移する
7. 手詰まり(山札0・取れる札なし)で自動的に終了判定が走る
8. ステージ数・ウェーブ目標を admin で増減してもラン進行が破綻しない
9. スマホ幅(375px)で場札7列が崩れず、黒スートのカードが暗背景でも明瞭に読める
10. `npm run build` が通り、`npm run dev` でゲーム画面・adminページの双方が崩れなく表示される
