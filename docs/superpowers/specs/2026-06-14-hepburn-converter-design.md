# ヘボン式ローマ字変換ツール 設計ドキュメント

**日付**: 2026-06-14（最終更新: 2026-06-14）
**ルート**: `/hepburn-converter`
**アーキテクチャ**: B（ロジック分離 + 単一ページ）

---

## 1. ファイル構成

```
src/
  lib/
    hepburn/
      normalizer.ts     # 半角カナ → 全角カナ正規化（NFKC）
      table.ts          # かな → ローマ字変換テーブル・VuStyle 型・VU_ENTRIES
      converter.ts      # 変換ロジック本体
      settings.ts       # 型定義・デフォルト値・プリセット・LocalStorage
  routes/
    +layout.svelte      # ヘッダーナビ（全ページ共通）
    +page.svelte        # ツール一覧ページ
    hepburn-converter/
      +page.svelte      # ヘボン式変換ツール UI全体

scripts/
  copy-kuromoji-dict.js  # postinstall: kuromoji 辞書を static/kuromoji/dict/ にコピー

static/
  kuromoji/dict/         # kuromoji 辞書ファイル（.gitignore 対象）
```

---

## 2. 変換ロジック

### normalizer.ts
- `String.prototype.normalize('NFKC')` で半角カナを全角カナに変換
- 濁点・半濁点が分離した2文字（`ｶ` + `ﾞ`）も NFKC で自動結合

### table.ts

```ts
export type VuStyle = 'v' | 'b' | 'bu'

export const VU_ENTRIES: Record<VuStyle, [string, string][]> = {
  v:  [['ヴ','vu'], ['ヴァ','va'], ['ヴィ','vi'], ['ヴェ','ve'], ['ヴォ','vo']],
  b:  [['ヴ','bu'], ['ヴァ','ba'], ['ヴィ','bi'], ['ヴェ','be'], ['ヴォ','bo']],
  bu: [['ヴ','bu'], ['ヴァ','bua'],['ヴィ','bui'],['ヴェ','bue'],['ヴォ','buo']],
}

export const TABLE: Map<string, string>  // ヴ行を除いた全かな
```

- 複合拍（きゃ・しゃ・ちゃ・じゃ等）を2文字キーで先に定義
- 単拍（か・き・く等）を1文字キーで後に定義
- ひらがな・カタカナ両方を収録
- ヴ行は `VU_ENTRIES` を別管理し、`converter.ts` で設定に応じて動的に合成

### converter.ts

**シグネチャ**:
```ts
type ConvertResult = { output: string; hasUntranslatableChars: boolean }

convert(input: string, settings: HepburnSettings): ConvertResult
```

**アルゴリズム**:
1. `normalize(input)` で半角カナを正規化
2. `new Map([...TABLE, ...VU_ENTRIES[settings.vuStyle]])` で変換テーブルを合成
3. 入力を1文字ずつ走査（複合拍は2文字先読みで優先マッチ）
4. ひらがな・カタカナの処理：
   - `っ/ッ` → 次の拍の子音を重ねる
   - `ー` → 前の母音を長音ルールで処理（省略 / マクロン / 重ねる）
   - `ん/ン` → 次の文字に応じてm/nを選択、母音・y続く場合は区切り挿入
   - その他 → テーブルで2文字優先、次いで1文字マッチ
5. ASCII英字・数字・記号・漢字・日本語句読点 → そのまま出力
6. 上記以外（絵文字・特殊記号等）→ そのまま出力 + `hasUntranslatableChars = true`
7. 大文字・小文字変換を最後に適用（PascalCase は先頭のみ大文字化）
8. 全角出力設定の場合、半角英字を全角英字に変換

**長音処理**:
- `omit`: 長音符・重複母音を省略
- `macron`: ā/ō 等マクロン付き母音を付加
- `double`: おう→ou、ー→前の母音を繰り返す

### +page.svelte の変換パイプライン

**`convertWithSplit(input, settings, kanjiConverter?)`**:
1. スペース（半角・全角）でチャンクに分割
2. スペースはそのまま出力（全角設定時は全角スペース）
3. 各チャンクに対して：
   - `settings.useParser && kuromojiStatus === 'ready'` なら kuromoji でトークナイズ → 形態素ごとに分割
   - 各セグメントに `kanjiConverter` があれば適用（漢字→かな変換）
   - `convertSegments()` で各セグメントをヘボン式に変換
   - `useParser` が無効または kuromoji 未ロードなら `convert()` を直接呼び出す

**`kanjiToKana(text)`**:
- kuromoji の `tokenize()` でトークナイズ
- 各トークンの `reading`（カタカナ読み）を使用。`reading` がない場合は `surface_form` をそのまま使用
- 全トークンを結合して返す

**適用順序（変換ボタン / 自動変換 共通）**:
1. 形態素解析（kuromoji）でセグメント分割
2. 漢字変換（kuromoji `reading`）で各セグメントをかなに変換
3. ヘボン式変換

---

## 3. 設定（settings.ts）

### 型定義

```ts
type LongVowel = 'omit' | 'macron' | 'double'
type Nasal     = 'mn' | 'n'
type Separator = 'none' | 'apostrophe' | 'hyphen'
type Width     = 'half' | 'full'
type CaseMode  = 'lower' | 'upper' | 'pascal'
type Preset    = 'passport' | 'railway' | 'road' | 'custom'
type VuStyle   = 'v' | 'b' | 'bu'

type HepburnSettings = {
  preset: Preset
  longVowel: LongVowel
  nasal: Nasal
  separator: Separator
  width: Width
  caseMode: CaseMode
  pascalSpaces: boolean  // 形態素解析ON時のみ有効
  useParser: boolean     // 形態素解析を使用するか
  vuStyle: VuStyle       // ヴ行の変換スタイル
}
```

**デフォルト値**（= パスポート式プリセット相当）:

```ts
const DEFAULT_SETTINGS: HepburnSettings = {
  preset: 'passport',
  longVowel: 'omit',
  nasal: 'mn',
  separator: 'none',
  width: 'half',
  caseMode: 'pascal',
  pascalSpaces: false,
  useParser: true,
  vuStyle: 'bu',
}
```

### プリセット

プリセットが変更する設定キー: `longVowel`, `nasal`, `separator`, `vuStyle`

| プリセット | longVowel | nasal | separator | vuStyle |
|---|---|---|---|---|
| passport（デフォルト） | omit | mn | none | bu |
| railway | macron | mn | hyphen | v |
| road | omit | n | none | v |
| custom | （現在値） | （現在値） | （現在値） | （現在値） |

- 上記4キーのいずれかを個別変更 → `preset` を自動的に `'custom'` に更新
- `caseMode` / `pascalSpaces` / `useParser` の変更は `preset` に影響しない
- プリセット選択時 → 対応する4キーを一括上書き

### カスタムスナップショット

- `'custom'` 選択中に `longVowel` / `nasal` / `separator` を変更 → `hepburn-custom-snapshot` に保存
  - ※ `vuStyle` はスナップショット対象外
- 別プリセットへ切り替え後に再び `'custom'` へ戻す → スナップショットを復元

### LocalStorage

- キー: `hepburn-settings`
- 保存対象: `HepburnSettings` 全体
- ページロード時に復元（パース失敗時はデフォルト値を使用）
- 入力・出力テキストは保存しない

### セッションのみの状態（LocalStorage 非対象）

- `useKanji: boolean` — 漢字変換を使用するか（デフォルト: false）

---

## 4. kuromoji 初期化

```ts
async function loadKuromojiAsync() {
  try {
    const mod = await import('kuromoji')
    const kuromoji = mod.default ?? mod
    await new Promise<void>((resolve, reject) => {
      kuromoji.builder({ dicPath: '/kuromoji/dict' }).build((err, tokenizer) => {
        if (err) { reject(err); return }
        kuromojiTokenizer = tokenizer
        kuromojiStatus = 'ready'
        resolve()
      })
    })
  } catch {
    kuromojiStatus = 'error'
  }
}
```

- `onMount` で呼び出す
- 辞書は `static/kuromoji/dict/` から配信
- Vite dev サーバーは `.gz` ファイルに `Content-Encoding: gzip` を付与して二重展開が起きるため、`enforce: 'pre'` の Vite プラグイン（`kuromojiDictRawPlugin`）で `/kuromoji/dict/*` を横取りし `application/octet-stream` で返す
- kuromoji の Vite エイリアス: `node_modules/kuromoji/build/kuromoji.js`（browserify済みバンドル）を直接参照することで `BrowserDictionaryLoader` を使用

**kuromoji ロード状態** (`kuromojiStatus`):

| 状態 | 意味 |
|---|---|
| `'loading'` | ロード中 |
| `'ready'` | 利用可能 |
| `'error'` | ロード失敗（再試行なし） |

---

## 5. UI・変換トリガー

### 変換トリガー

| トリガー | 処理 |
|---|---|
| 半角文字入力 | デバウンス 300ms 後に自動変換 |
| IME確定（`compositionend`） | 即時自動変換 |
| 「変換」ボタン押下 | 同様に変換（kuromoji 未ロード時は useParser / useKanji を無効扱い） |
| 設定変更 | 自動変換しない。変換例（サンプル）のみリアルタイム更新 |
| 10,000文字超 | 自動変換を停止（ボタン変換は可能） |

### 設定変更警告

- 入力がある状態で設定変更 → `settingsChangedWarning = true`
- 「設定変更済み — 変換ボタンで再変換」を表示
- 自動変換実行時 / ボタン変換後にフラグをリセット

### 変換ボタンの状態

- 常に活性（disabled なし）
- kuromoji 未ロード / エラー時は `useParser` / `useKanji` を無効扱いで変換を実行
- isConverting 中のみ disabled

### kuromoji 依存の設定 UI

- `kuromojiStatus !== 'ready'` の間は 形態素解析 / 漢字変換 チェックボックスを `disabled` にし、チェックなし状態で表示
- 単語区切りは `!useParser || kuromojiStatus !== 'ready'` で `disabled`
- 各行に「準備中...」「読込失敗」ラベルを表示（形態素解析・漢字変換とも）

### 変換例（サンプル）

- サンプルテキスト: `'とうきょうのしんぶんしゃで働くヴィオラは しんようがある'`
- `$derived` で全設定変化（`settings`, `useKanji`, `kuromojiTokenizer`）に即座に追従

### PascalCase と単語区切り

| モード | 動作 |
|---|---|
| 自動変換 | `convertSegments` でセグメント先頭を大文字化。スペース挿入は `pascalSpaces` に従う |
| ボタン変換 | 同上 |
| 形態素解析 OFF | `convert()` を直接呼び出し、出力全体の先頭のみ大文字化 |

単語区切りスペース（`pascalSpaces`）: 形態素解析が有効なときのみ機能。全角設定時は全角スペース。

### その他UI要素

- 文字数カウンター（入力欄下部）
- クリアボタン（入力欄下部）
- コピーボタン（Clipboard API、成功時「コピーしました ✓」表示）
- 設定パネル内変換例（リアルタイム更新）
- スマホ: 設定パネルをアコーディオンで折りたたみ（デフォルト折りたたみ）

---

## 6. 設定パネル構成

### ブルーボックス（プリセット連動）

| 設定項目 | 型 | 選択肢 |
|---|---|---|
| プリセット | Preset | passport / railway / road / custom |
| 長音の表記 | LongVowel | omit / macron / double |
| 撥音「ん」 | Nasal | mn / n |
| 撥音＋母音・y続く場合 | Separator | none / apostrophe / hyphen |
| ヴ行の表記 | VuStyle | v / b / bu |

### その他の設定（プリセット非連動）

| 設定項目 | 型 | 備考 |
|---|---|---|
| 半角/全角 | Width | half / full |
| アルファベット | CaseMode | lower / upper / pascal |
| 形態素解析 | boolean | kuromoji 未ロード時は disabled |
| 単語区切り | boolean | 形態素解析 ON かつ kuromoji ready 時のみ有効 |
| 漢字変換 | boolean（セッション限り） | kuromoji 未ロード時は disabled |

---

## 7. PC / スマホ レイアウト

### PC（横並び）

1. タイトル
2. 説明文・注意文
3. 設定パネル（常時展開）
4. 入力欄 ／ 変換ボタン ／ 出力欄（横並び）
5. 詳細説明（変換表・設定説明・その他仕様）

### スマホ（縦並び）

1. タイトル
2. 説明文・注意文
3. 設定パネル（アコーディオン、デフォルト折りたたみ）
4. 入力欄 + 文字数カウンター + クリアボタン
5. 変換ボタン
6. 出力欄 + コピーボタン
7. 詳細説明

---

## 8. 警告メッセージ一覧

| 条件 | メッセージ | 表示箇所 |
|---|---|---|
| 変換不可文字が含まれる | 「変換できない文字が含まれています」 | 入力欄ラベル横 |
| 10,000文字超 | 「文字数が多いため、自動変換を停止しました」 | 入力欄下部 |
| 設定変更後・未変換 | 「設定変更済み — 変換ボタンで再変換」 | 入力欄ラベル横 |
| kuromoji 読み込み失敗 | 「読込失敗」 | 形態素解析・漢字変換の行 |
| kuromoji 読み込み中 | 「準備中...」 | 形態素解析・漢字変換の行 |
