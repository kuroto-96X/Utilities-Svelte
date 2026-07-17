# Shidasu 護符パラメータ管理画面: レア度編集・説明文テンプレート編集 設計

## 0. 背景・目的

`/admin/shidasu-talismans`(護符パラメータ管理画面)に、以下2つの編集機能を追加する。

1. 各護符にレア度(C/U/R)を持たせ、管理画面から編集できるようにする
2. 各護符の説明文を、パラメータ変数名を含むテンプレートとして管理画面から編集できるようにする(編集内容はプレビューで確認できる)

`/admin/shidasu-debug`(デバッグサンドボックス)の改善(`docs/superpowers/specs/2026-07-17-shidasu-debug-sandbox-improvements-design.md`)とは独立したスコープであり、本specには含めない。

## 1. レア度

### 1.1 データモデル

`src/lib/game/shidasu/params.ts`の`ShidasuParams`型定義内、`talismans`の各護符エントリに`rarity: 'C' | 'U' | 'R'`フィールドを追加する。既存の`name`・数値パラメータ(`n`/`m`/`x`/`c`/`p`/`r`等)と同じ階層に並ぶ。

`DEFAULT_PARAMS`(および`src/lib/game/shidasu/shidasu.config.json`)の90護符全てに初期値を設定する。初期値は`docs/shidasu-gofu-candidates.md`に記載済みのC/U/R分類を移行元とし、護符名が一致する項目はその分類をそのまま使う。ドキュメント側に対応する項目が見当たらない・名前が変わっている等で対応が不明確な護符は`'C'`をデフォルト値とする。

### 1.2 管理画面

`/admin/shidasu-talismans`のテーブルに「レア度」カラムを追加する(護符名カラムの隣、パラメータカラムより前)。`<select>`要素で`C`/`U`/`R`のいずれかを選択する形にし、既存の護符名・パラメータの編集と同様に`config`(`$state`)を直接`bind:value`で書き換える。

既存の保存フロー(`save()`関数、`POST /api/admin/shidasu-config`)・バリデーション(`hasValidationError`)はそのまま利用する。`rarity`は`<select>`による選択のため、空文字・不正値になり得ず、既存の護符名の空文字チェックのような追加バリデーションは不要。

### 1.3 スコープ外

- `rollItemOffer`(護符の抽選ロジック)の変更。現在の完全均等抽選のまま変更しない。レア度に応じた重み付け抽選は将来の別タスクとする。

## 2. 説明文テンプレート

### 2.1 現状の問題

`src/lib/game/shidasu/engine.ts`の`itemDesc(id, params)`関数は、90護符分の説明文が全て`switch`文にハードコードされたテンプレートリテラルで構成されている。管理画面から編集できるようにするには、この文言をデータ化(`shidasu.config.json`に保存される文字列テンプレート)する必要がある。

90ケースのうち88ケースは、その護符自身が持つ数値パラメータ(`n`/`m`/`x`/`c`/`p`等)への参照のみ、または固定文言(パラメータ参照なし)で構成されている。残り2ケース(「架橋」「寬容」)のみ、他ケースにない計算式(引き算)と護符自身のパラメータ以外の値(`params.scoring.stairMinLen`等)への参照を含んでいる。

### 2.2 データモデル

`ShidasuParams`の`talismans`の各護符エントリに`desc: string`フィールドを追加する。値は`{パラメータ名}`という形のプレースホルダーを含む文字列テンプレート(例: `"クラブ(♣)を取ったとき、{n}点加算"`)。

`DEFAULT_PARAMS`/`shidasu.config.json`の90護符全てに、現行の`itemDesc`の出力文言と同等になるようテンプレートを設定する。「架橋」「寛容」の2護符のみ、計算結果表示(階段○→○枚、のような前後比較)をやめ、緩和量のみを示す文言に簡素化する(例: 架橋は「階段・同スート・同色の成立に必要な枚数を{m}枚緩和」)。

### 2.3 `itemDesc`の実装変更

`src/lib/game/shidasu/engine.ts`の`itemDesc`関数を、90ケースの`switch`文から、単純なプレースホルダー置換処理に置き換える。

```ts
export function itemDesc(id: ItemId, params: ShidasuParams): string {
  const entry = params.talismans[id] as unknown as Record<string, unknown> & { desc: string }
  const context: Record<string, number> = { rows: params.layout.rows }
  for (const [key, value] of Object.entries(entry)) {
    if (typeof value === 'number') context[key] = value
  }
  return entry.desc.replace(/\{(\w+)\}/g, (match, key) => (key in context ? String(context[key]) : match))
}
```

置換対象(`context`)は、その護符自身の数値パラメータに加えて、`{rows}`(=`params.layout.rows`)を常に含める。「列一掃」(healing)の説明文が唯一、護符自身のパラメータではなく場の行数(`layout.rows`)を参照するため。

テンプレート中に未知のプレースホルダー(存在しないパラメータ名、タイプミス等)が含まれていた場合、その`{xxx}`部分はそのまま出力に残す(置換せずクラッシュもしない)。管理画面での入力ミスに対して安全側に倒す。

### 2.4 管理画面

`/admin/shidasu-talismans`の現在の「説明文プレビュー」カラム(読み取り専用、`itemDesc(id, config)`の出力をそのまま表示)を、以下2つに分割する。

- **説明文テンプレート**(編集可能): テキストエリアで`entry.desc`を`bind:value`編集する。護符名の入力欄と同様、空文字は不可(既存の`hasValidationError`のバリデーション対象に追加する)
- **プレビュー**(読み取り専用): 編集中の`config`の値を使って、2.3の置換ロジックと同じ計算をクライアント側で行い、実際にゲーム中に表示される文言をリアルタイムに表示する

### 2.5 スコープ外

- テンプレート内での四則演算・条件分岐など、単純なプレースホルダー置換を超える表現力のサポート
- プレースホルダー名の存在チェック(バリデーション)。未知のプレースホルダーはそのまま表示される許容できる失敗モードとする

## 3. 受け入れ基準

1. `/admin/shidasu-talismans`の各護符行に「レア度」列があり、C/U/Rを選択・保存できる
2. `DEFAULT_PARAMS`の90護符全てに`rarity`初期値が設定されている(`docs/shidasu-gofu-candidates.md`の分類を移行したもの、対応不明は`C`)
3. `rollItemOffer`の抽選ロジック・確率は変更されていない
4. `/admin/shidasu-talismans`の各護符行に、編集可能な「説明文テンプレート」欄と、置換済みの実文言を表示する「プレビュー」欄がある
5. 説明文テンプレートを編集すると、プレビューがリアルタイムに更新される
6. `itemDesc(id, params)`が、`switch`文ではなくテンプレート置換によって、既存とほぼ同じ文言を返す(「架橋」「寛容」のみ簡素化された文言になる)
7. 説明文テンプレートが空文字の場合、護符名が空の場合と同様に保存がブロックされる
8. `npm run test`・`npm run build`・`npm run check`が成功する
