# 証明写真・履歴書用写真サイズ調整ツール — 設計ドキュメント

**日付**: 2026-06-15  
**ステータス**: 承認済み

---

## 概要

SvelteKit プロジェクトに証明写真ツールを追加する。クライアントサイド完結で、プリセット選択 → 画像アップロード → クロップ → 証明写真/印刷シートダウンロードまでを1ページで完結させる。

---

## アーキテクチャ & ファイル構成

### 新規ファイル

```
src/routes/id-photo/
  +page.svelte          # メインページ
  +page.ts              # SEOメタデータ

src/lib/
  data/
    idPhotoPresets.ts   # 証明写真プリセット定数（mm単位）
    printSheetSizes.ts  # L判・2L判サイズ定数（mm単位）
  components/
    CropEditorWithGuide.svelte   # 顔位置ガイド付きクロップUI
    SheetLayoutPreview.svelte    # 印刷シートプレビュー
  utils/
    mmToPx.ts           # mm→px変換ユーティリティ
    sheetCompositor.ts  # シート合成（Canvas API）
```

### 既存ファイルの変更

| ファイル | 変更内容 |
|---|---|
| `src/lib/components/PresetSelector.svelte` | Svelte 5 スニペット対応で汎用化（後方互換維持） |
| `src/lib/site.ts` | `{ href: '/id-photo', label: '証明写真(開発中)', visible: true }` を追加 |

### 変更しないファイル

- `CropEditor.svelte` — sns-image-resize 専用のまま維持
- `src/lib/utils/cropToBlob.ts` — 証明写真ページでそのまま再利用
- `ImageUploader.svelte` — そのまま再利用

---

## データ層

### `IdPhotoPreset` 型

```ts
export interface IdPhotoPreset {
  id: string
  name: string       // 表示名（例: "履歴書用"）
  note: string       // 備考（例: "一般的な履歴書サイズ"）
  widthMm: number    // 横サイズ mm
  heightMm: number   // 縦サイズ mm
}
```

### プリセット一覧（`idPhotoPresets.ts`）

| id | name | widthMm | heightMm | note |
|---|---|---|---|---|
| `resume` | 履歴書用 | 30 | 40 | 一般的な履歴書サイズ |
| `general-small` | 証明写真（一般・小） | 24 | 30 | 各種申請書類向け |
| `general-large` | 証明写真（一般・大） | 35 | 45 | 各種申請書類向け |
| `passport` | パスポート用 | 35 | 45 | 顔ガイド表示あり |
| `my-number` | マイナンバーカード用 | 35 | 45 | パスポート用に準じる |
| `license` | 運転免許証用 | 24 | 30 | 証明写真（一般・小）に準じる |

### `PrintSheetSize` 型（`printSheetSizes.ts`）

```ts
export interface PrintSheetSize {
  id: string
  label: string     // 例: "L判"
  widthMm: number
  heightMm: number
}
```

L判(89×127mm)・2L判(127×178mm)の2種類。

---

## コンポーネント設計

### `PresetSelector.svelte`（汎用化）

```svelte
<script lang="ts" generics="T extends { id: string }">
  interface Props {
    presets: T[]
    selected: T | null
    onselect: (preset: T) => void
    children: Snippet<[T]>
  }
</script>
```

グリッドレイアウトと選択状態管理のみを担い、カード内容は呼び出し元スニペットで定義。`sns-image-resize/+page.svelte` も `{#snippet}` を使う形に合わせて同時に更新する（破壊的変更のため、実装ステップで両方まとめて変更すること）。

---

### `CropEditorWithGuide.svelte`

`svelte-easy-crop` の上に SVG オーバーレイ（`pointer-events: none`）を重ねる。

**ガイド内容（横線 + 楕円の両方）:**
- 楕円: 枠内60%幅、頭頂15%〜あご85%の範囲（緑・破線）
- 横線: 頭頂15%・あご85%の位置に「頭頂」「あご」ラベル付き（緑・実線）

**Props:**
```ts
interface Props {
  imageFile: File
  preset: IdPhotoPreset
  oncropcomplete: (pixels: PixelCrop) => void
}
```

アスペクト比は `preset.widthMm / preset.heightMm` から算出。

---

### `SheetLayoutPreview.svelte`

**UI:**
- シートサイズ（L判/2L判）のセレクト
- 面数（4面/6面）のセレクト
- L判縦横比をキープした「白い用紙」div に `<img>` をグリッド配置
- 選択変更でリアクティブ更新

**Props:**
```ts
interface Props {
  imageFile: File | null
  croppedAreaPixels: PixelCrop | null
  preset: IdPhotoPreset | null
  onsheetchange: (sheet: PrintSheetSize, count: number) => void
}
```

プレビューは `imageFile` を `<img>` + CSS `object-fit: cover` / `object-position` で近似表示する。`cropToBlob()` はダウンロード時のみ呼び出す。

---

### `sheetCompositor.ts`

```ts
export async function compositeSheet(
  photoBlobUrl: string,
  sheetWidthPx: number,
  sheetHeightPx: number,
  photoWidthPx: number,
  photoHeightPx: number,
  count: number
): Promise<Blob>
```

Canvas 上に写真をグリッド配置し、余白を均等計算して PNG Blob を返す。300dpi 前提で mm→px 変換済みのサイズを受け取る。

---

## ページ設計（`+page.svelte`）

### 状態変数

```ts
let selectedPreset = $state<IdPhotoPreset | null>(null)
let imageFile = $state<File | null>(null)
let croppedAreaPixels = $state<PixelCrop | null>(null)
let selectedSheet = $state<PrintSheetSize>(printSheetSizes[0])  // デフォルト: L判
let selectedCount = $state<number>(6)
// photoBlobUrl は持たない。SheetLayoutPreview は imageFile + croppedAreaPixels を受け取り CSS で近似表示する
```

### データフロー

```
プリセット選択     → aspect比が CropEditorWithGuide に反映
画像アップロード   → imageFile 更新
クロップ完了       → croppedAreaPixels 更新
シート選択変更     → SheetLayoutPreview がリアクティブ更新

「証明写真ダウンロード」  → cropToBlob(mmToPx後のpxサイズ) → PNG保存
「印刷シートダウンロード」 → cropToBlob() → compositeSheet() → PNG保存
```

**cropToBlob はダウンロード時のみ呼び出す。**  
SheetLayoutPreview のプレビューは CSS `object-fit: cover` + `object-position` でオリジナル画像を近似表示し、重い Canvas 処理をリアルタイム実行しない。

### UIセクション順序

1. 広告枠 top（`ad-slot ad-slot--top`）
2. タイトル・説明文（「サーバーに送信されません」訴求）
3. プリセット選択カード（`PresetSelector` + スニペット）
4. 画像アップロード（`ImageUploader`）
5. クロップ編集（画像+プリセット選択後のみ表示、`CropEditorWithGuide`）
6. シートレイアウト選択 + プレビュー（`SheetLayoutPreview`）
7. ダウンロードボタン×2
   - `証明写真のみ保存（354 × 472px / 30×40mm）`（pxはmmToPxで動的計算）
   - `印刷シート保存（L判 6面）`
8. 広告枠 in-content（`ad-slot ad-slot--in-content`）
9. SEO説明文 + 他ツールへの内部リンク

---

## SEO

- `+page.ts` で title・meta description を設定
  - title: `証明写真サイズ無料調整ツール - 履歴書・パスポート対応 | 96X's Tools`
  - description: `履歴書用(30×40mm)・パスポート用(35×45mm)など証明写真を無料でサイズ調整。コンビニ印刷対応のL判シートも作成できます。すべてブラウザ内で処理し、サーバーへの送信は一切ありません。`
- ページ下部に200〜400字のSEO説明文（履歴書・パスポート・コンビニ印刷の検索意図をカバー）
- 画像圧縮ツール・SNS画像リサイズツールへの内部リンクを設置

---

## 視覚的決定事項（ブレスト時に確定）

- 顔位置ガイド: **横線 + 楕円（両方）**
- 印刷シートプレビュー: **紙っぽいプレビュー**（白い用紙の上に写真グリッド）
- PresetSelector 共通化: **Svelte 5 スニペットベース**（案A）
