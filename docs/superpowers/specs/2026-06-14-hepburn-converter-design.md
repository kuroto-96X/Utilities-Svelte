# ヘボン式ローマ字変換ツール 設計ドキュメント

**日付**: 2026-06-14  
**ルート**: `/hepburn-converter`  
**アーキテクチャ**: B（ロジック分離 + 単一ページ）

---

## 1. ファイル構成

```
src/
  lib/
    hepburn/
      normalizer.ts     # 半角カナ → 全角カナ正規化（NFKC）
      table.ts          # かな → ローマ字変換テーブル（Map<string, string>）
      converter.ts      # 変換ロジック本体
      settings.ts       # 型定義・デフォルト値・プリセット・LocalStorage
  routes/
    +layout.svelte      # ヘッダーナビ追加（全ページ共通）
    +page.svelte        # ツール一覧ページ（作り直し）
    bpm-tapper/
      +page.svelte      # 既存（変更なし）
    hepburn-converter/
      +page.svelte      # ヘボン式変換ツール UI全体
```

---

## 2. 変換ロジック

### normalizer.ts
- `String.prototype.normalize('NFKC')` で半角カナを全角カナに変換
- 濁点・半濁点が分離した2文字（`ｶ` + `ﾞ`）も NFKC で自動結合

### table.ts
- `Map<string, string>` でかな→ローマ字テーブルを定義
- 複合拍（きゃ・しゃ・ちゃ・じゃ等）を2文字キーで先に定義
- 単拍（か・き・く等）を1文字キーで後に定義
- ひらがな・カタカナ両方を収録

### converter.ts

**シグネチャ**:
```ts
type ConvertResult = { output: string; hasUntranslatableChars: boolean }

convert(
  input: string,
  settings: HepburnSettings,
  wordBoundaries?: number[]   // budoux のセグメント先頭インデックス
): ConvertResult
```

**アルゴリズム**:
1. 入力を1文字ずつ走査（複合拍は2文字先読みで優先マッチ）
2. 半角カナ → normalizer で正規化してから処理
3. ひらがな・カタカナの処理：
   - `っ/ッ` → 次の文字の子音を重ねる
   - `ー` → 前の母音を長音ルールで処理（省略 / マクロン / 重ねる）
   - `ん/ン` → 次の文字に応じてm/nを選択、母音・y続く場合は区切り挿入
   - その他 → テーブルで2文字優先、次いで1文字マッチ
4. 漢字・絵文字・記号 → そのまま出力、`hasUntranslatableChars = true`
5. 半角英字 → ヘボン式に正規化（si→shi, ti→chi, tu→tsu, hu→fu, zi→ji 等）
6. 大文字・小文字変換を最後に適用
   - PascalCase かつ自動変換モード（`wordBoundaries` が未指定）: 出力全体の先頭のみ大文字化
   - PascalCase かつボタン変換モード（`wordBoundaries` にインデックス配列を渡す）: 各インデックス位置の文字を大文字化
7. 全角出力設定の場合、半角英字を全角英字に変換

**長音処理詳細**:
- `omit`（表記しない）: 長音符・重複母音を短母音1つに
- `macron`（マクロン）: a→ā, i→ī, u→ū, e→ē, o→ō
- `double`（重ねる）: おう→ou, おお→oo, ー→前の母音を繰り返す

---

## 3. 設定（settings.ts）

### 型定義

```ts
type LongVowel = 'omit' | 'macron' | 'double'
type Nasal    = 'mn' | 'n'
type Separator = 'none' | 'apostrophe' | 'hyphen'
type Width    = 'half' | 'full'
type CaseMode = 'lower' | 'upper' | 'pascal'
type Preset   = 'passport' | 'railway' | 'road' | 'custom'

type HepburnSettings = {
  preset: Preset
  longVowel: LongVowel
  nasal: Nasal
  separator: Separator
  width: Width
  caseMode: CaseMode
  pascalSpaces: boolean   // PascalCase時のボタン変換でスペースを入れるか
}
```

### プリセット

| プリセット | longVowel | nasal | separator |
|---|---|---|---|
| passport（デフォルト） | omit | mn | none |
| railway | macron | mn | hyphen |
| road | omit | n | none |
| custom | （現在値） | （現在値） | （現在値） |

- 個別設定変更時 → `preset` を `'custom'` に自動更新
- プリセット選択時 → 対応する個別設定値を一括上書き

### LocalStorage
- キー: `hepburn-settings`
- 保存対象: `HepburnSettings` 全体
- ページロード時に復元（パース失敗時はデフォルト値を使用）
- 入力・出力テキストは保存しない

---

## 4. UI・変換トリガー

### 変換トリガー

| トリガー | 処理 |
|---|---|
| 半角文字入力 | デバウンス 300ms 後に自動変換 |
| IME確定（`compositionend`） | 即時自動変換 |
| 「変換」ボタン押下 | budoux で単語境界を取得してから変換 |
| 設定変更 | 自動変換を再実行 + 警告フラグをセット |
| 10,000文字超 | 自動変換を停止（ボタン変換は可能）+ 警告表示 |

### 設定変更警告
- 入力がある状態で設定変更 → `settingsChangedWarning = true`
- 「設定が変更されました。変換ボタンを押して再変換してください」を表示
- 自動変換実行時 or 変換ボタン押下後にフラグをリセット

### budoux の初期化

```ts
import { loadDefaultJapaneseParser } from 'budoux'

let parser = $state<ReturnType<typeof loadDefaultJapaneseParser> | null>(null)
let parserStatus = $state<'loading' | 'ready' | 'error'>('loading')

onMount(() => {
  try {
    parser = loadDefaultJapaneseParser()
    parserStatus = 'ready'
  } catch {
    parserStatus = 'error'
  }
})
```

ボタン変換時: `parser.parse(inputText)` でセグメント文字列配列を取得し、各セグメントの累積文字数から先頭インデックスを計算して `convert()` に `wordBoundaries` として渡す。

### 「変換」ボタンの状態

| 状態 | 表示 | 操作 |
|---|---|---|
| loading | 「準備中...」 | disabled |
| ready | 「変換」「（形態素解析）」 | enabled |
| error | エラーメッセージ + 「再試行」ボタン | disabled |

### その他UI要素
- 文字数カウンター（入力欄下部）
- クリアボタン（入力欄下部）
- コピーボタン（Clipboard API、成功時トースト「コピーしました」）
- 設定パネル内サンプル変換結果（リアルタイム更新）
  - サンプル文: 「しんぶんはきんようびにとうきょうへいく」
- スマホ: 設定パネルをアコーディオンで折りたたみ（デフォルト折りたたみ）

### PascalCase スペース設定
- 自動変換: 常にスペースなし（`wordBoundaries = []` で渡す）
- ボタン変換: `pascalSpaces` 設定に従う（スペースあり/なし選択可能）

---

## 5. ナビゲーション・トップページ

### `+layout.svelte`
全ページ共通のヘッダーナビバーを追加。現在アクティブなページをハイライト。

```
[ Utilities ]  BPM Tapper  ヘボン式変換
```

スタイルはBPM Tapperの既存テイスト（白背景・ボーダー区切り）に合わせる。

### `+page.svelte`（トップページ）
ツール一覧カード形式のランディングページ。

```
Utilities

┌─────────────────┐  ┌─────────────────┐
│   BPM Tapper    │  │  ヘボン式変換   │
│ BPMを計測する   │  │ 日本語をヘボン  │
│ ツール          │  │ 式ローマ字に    │
│                 │  │ 変換するツール  │
└─────────────────┘  └─────────────────┘
```

---

## 6. PC / スマホ レイアウト

### PC（横並び）
1. タイトル
2. 説明文・注意文エリア
3. ヘボン式ルール設定パネル（プリセット・個別設定5項目・変換例）
4. 入力欄 ／ 変換ボタン ／ 出力欄（横並び）
   - 左: 入力欄 + 文字数カウンター + クリアボタン
   - 中央: 変換ボタン
   - 右: 出力欄 + コピーボタン
5. 警告メッセージエリア（変換不可文字がある場合のみ）

### スマホ（縦並び）
1. タイトル
2. 説明文・注意文エリア
3. 設定パネル（アコーディオン、デフォルト折りたたみ）
4. 入力欄（高さ抑制）+ 文字数カウンター + クリアボタン
5. 変換ボタン
6. 出力欄（高さ抑制）+ コピーボタン
7. 警告メッセージエリア

---

## 7. 警告メッセージ一覧

| 条件 | メッセージ |
|---|---|
| 変換不可文字が含まれる | 「変換できない文字が含まれています」 |
| 10,000文字超 | 「文字数が多いため、自動変換を停止しました」 |
| 設定変更後・未変換 | 「設定が変更されました。変換ボタンを押して再変換してください」 |
| budoux 読み込み失敗 | 「形態素解析の読み込みに失敗しました」 |
