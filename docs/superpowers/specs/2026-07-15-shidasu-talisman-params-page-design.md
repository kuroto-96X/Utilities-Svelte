# Shidasu 護符パラメータ設定ページの設計

## 0. 背景・目的

現在、護符(87種類)のパラメータは `/admin/shidasu` ページ内の6セクション(グループ1〜3、グループ4〜8、永続デッキ系、グループ9〜16、グループ17)に分散して表示されている。護符の名前(`ITEM_NAMES`)・ゲーム中に表示される効果説明文(`itemDesc()`)はコード側にハードコードされており、設定画面からは編集できない。

本specは、護符に関するパラメータ(数値パラメータ・名前)を独立した設定ページに集約し、各護符ごとに1行で表示・編集できるようにする設計を定める。あわせて、ゲーム中に表示される効果説明文をその場でプレビュー表示できるようにする(説明文自体の編集は将来のテンプレート化タスクに先送りする)。

## 1. 全体アーキテクチャ

**ルート**: `src/routes/admin/shidasu-talismans/+page.svelte`(新規)

既存の `/admin/shidasu` ページと同じ `/api/admin/shidasu-config` エンドポイント(GET/POST)を使って `ShidasuParams` 全体を読み書きする。護符パラメータ専用の別APIは設けない。

`/admin/shidasu` ページからは、護符関連の6セクション(グループ1〜3、グループ4〜8、永続デッキ系、グループ9〜16、グループ17、合計87項目分の入力欄)を削除する。レイアウト・スコアリング・ステージ・アイテム共通設定・フロー/UI・JSON入出力のセクションはそのまま残す。

## 2. データモデルの変更

**`src/lib/game/shidasu/params.ts`**:

- `ShidasuParams['talismans']` の各エントリに `name: string` を追加する(例: `patience: { name: string; x: number }`、`naive: { name: string }`)
- 現在 `talismans` にエントリが存在しない5項目(`bridge`・`grace`・`eternity`・`abundance`・`silence`)を、`{ name: string }` のみのエントリとして新規追加する。これにより `ITEM_POOL` の87項目全てが `talismans` オブジェクトでカバーされる
- `DEFAULT_PARAMS.talismans` の全87エントリに、既存の `ITEM_NAMES`(`engine.ts`)の値をそのまま転記した `name` を追加する

**`src/lib/game/shidasu/shidasu.config.json`**(実行時設定ファイル):

- 同様に全87エントリに `name` を追加し、`bridge`・`grace`・`eternity`・`abundance`・`silence` の5エントリを新規追加する。値は既存 `ITEM_NAMES` からの転記(数値のズレは発生しない、純粋な追記)

**`src/lib/game/shidasu/engine.ts`**:

- `export const ITEM_NAMES: Record<ItemId, string> = {...}` を削除する
- 代わりに `itemDesc` と同じ形の関数を追加する:
  ```ts
  export function itemName(id: ItemId, params: ShidasuParams): string {
    return params.talismans[id].name
  }
  ```

**呼び出し側の更新**(`ITEM_NAMES[id]` → `itemName(id, params)`):
- `src/routes/game/shidasu/+page.svelte`(3箇所)
- `src/routes/admin/shidasu-debug/DebugStatePanel.svelte`(1箇所)
- `src/routes/admin/shidasu-debug/ItemChecklist.svelte`(1箇所)

いずれのファイルも既に `params`(または `loadParams()` の戻り値)をスコープ内に持っているため、追加の引数受け渡しは不要。

## 3. グループ分けデータの共有

`src/routes/admin/shidasu-debug/itemGroups.ts`(87項目・19グループの分類データ、`ITEM_POOL` との整合性をテストで担保済み)を `src/lib/game/shidasu/itemGroups.ts` に移動する。

- `src/routes/admin/shidasu-debug/ItemChecklist.svelte` と `itemGroups.test.ts` のimportパスを新しい場所に更新する
- 新しい `/admin/shidasu-talismans` ページも同じ `itemGroups.ts` をimportして使う
- グループの追加・変更が必要になった場合、この1ファイルを直せば両画面に反映される

## 4. 新ページのレイアウト

`ITEM_GROUPS` の19グループごとにテーブルを分けて表示する(グループ見出し + テーブル、を19回繰り返す)。各テーブルの行は1護符に対応し、列は以下の3つ:

1. **護符名**: テキスト入力。`talismans[id].name` に双方向バインド
2. **パラメータ**: その護符が持つ0〜2個の数値パラメータ(`x`/`n`/`c`/`m`/`p`/`r`)を、キー名のラベル付きで横に並べて表示する数値入力。既存 `/admin/shidasu` の護符セクションと同じ `<input type="number">` スタイル(ラベル+step等の既存の刻み幅設定)をそのまま踏襲する。パラメータを持たない護符(`Record<string, never>` だった項目、および今回追加するbridge/grace/eternity/abundance/silence)はこの列が空になる
3. **説明文プレビュー**: 読み取り専用のテキスト表示。`itemDesc(id, params)` をその場で(同じ行の護符名・パラメータ編集に応じてリアクティブに)計算して表示する。入力欄ではない。テンプレート化・編集可能化は今回のスコープ外(将来タスク)

ページ上部には既存ページ同様「リロード」「保存」ボタンを置き、保存は `/api/admin/shidasu-config` への POST で `ShidasuParams` 全体を書き込む。新ページ独自のJSON入出力パネルは設けない。

バリデーションは既存ページの `hasValidationError` に準じ、最低限「護符名が空でないこと」を追加でチェックする(空の場合は保存ボタンを無効化)。

## 5. スコープ外

- 説明文(`itemDesc`)のテンプレート化・編集可能化(プレースホルダーで護符自身のパラメータ値を埋め込む仕組み) — 将来の別タスクとして先送り
- 護符の新規追加・削除(既存87種類の名前・パラメータ編集のみ)
- `/admin/shidasu` 側のJSON入出力パネルの変更(そのまま残す。護符パラメータもこのJSONに含まれ続けるため、一括編集の手段としては引き続き機能する)

## 6. 受け入れ基準

1. `/admin` から `/admin/shidasu-talismans` に遷移でき、87護符が19グループに分かれてテーブル表示される
2. 各行で護符名を編集すると、同じ行の説明文プレビューが即座に更新される(名前が説明文に含まれる項目がある場合)
3. 各行のパラメータ数値を編集すると、同じ行の説明文プレビューが即座に更新される
4. 保存すると `/api/admin/shidasu-config` 経由で設定ファイルが更新され、リロード後も内容が保持される
5. `/admin/shidasu` から護符関連の6セクションが削除され、それ以外のセクションは従来通り動作する
6. 実際のゲーム画面(`/game/shidasu`)・デバッグサンドボックス(`/admin/shidasu-debug`)で、護符名が `itemName(id, params)` 経由で正しく表示される(表示上の変化なし、内部実装のみ変更)
7. `npm run test`・`npm run build`・`npm run check` が成功する
