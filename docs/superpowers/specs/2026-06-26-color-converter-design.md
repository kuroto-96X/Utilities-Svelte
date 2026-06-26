# Color32 / Color 変換ツール 設計ドキュメント

## 概要

Unity 開発者向けの色形式変換ツール。`Color32`・`Color`（float）・HEX の3形式を相互変換し、変換結果をワンクリックでコピーできる単一ページツール。

- **ルート**: `src/routes/color-converter/`
- **URL**: `/color-converter`
- **カテゴリー**: `programming`（`src/lib/site.ts`）
- **ライブラリ依存**: なし（純粋な計算のみ）

---

## アーキテクチャ

### 新規ファイル

| ファイル | 役割 |
|---|---|
| `src/lib/colorConverter.ts` | 変換ロジック・ヘルパー関数 |
| `src/lib/colorConverter.test.ts` | ユニットテスト |
| `src/routes/color-converter/+page.svelte` | UI（状態管理・描画） |

### 既存ファイルの変更

| ファイル | 変更内容 |
|---|---|
| `src/lib/site.ts` | `programming` カテゴリーに `/color-converter` エントリー追加 |
| `src/lib/site.config.json` | `toolDevStatus: true`、`toolVisibility: true` で追加 |

---

## 状態管理

```ts
let r = $state(255)  // 0–255
let g = $state(128)  // 0–255
let b = $state(0)    // 0–255
let a = $state(255)  // 0–255
let activeTab = $state<'color32' | 'float' | 'hex'>('color32')
let copiedRow = $state<string | null>(null)  // コピーフィードバック用
```

すべての入力は `r/g/b/a` を経由し、変換結果は `$derived` で自動再計算する。

---

## UIレイアウト

### タブ行 + カラーピッカー

タブ行（Color32 / Color (float) / HEX）とカラーピッカーを同じ行に配置する。タブ群とピッカーは縦区切り線で視覚的に分離し、ピッカーの下には仕切り線を引かない。

ピッカーの横位置は右側のテキストボックス列（幅 64px）と揃える。タブ行・コンテンツ行ともに `flex:1 + gap:12px + width:64px` の同一 flex 構成にする。

### 入力エリア

- **左列（`flex:1`）**: R/G/B/A それぞれのラベル＋スライダー（各行 32px）
- **右列（64px）**: 各スライダーと同行に対応するテキストボックス

スライダーと数値入力欄は双方向で状態を更新する。

### カラーピッカー

`<input type="color">` を使用。クリックで OS ネイティブのカラーピッカーを開く。ピッカーは RGB のみ反映し、A（アルファ）は変更しない。

### プレビュー

枠なし、タイトル「プレビュー」の下に2つの色見本を並べる。

- **アルファあり**: チェッカー背景に `rgba(r, g, b, a/255)` を重ねる
- **アルファなし**: `rgb(r, g, b)` の単色

### 変換結果

5フォーマットを縦に並べる。各行にコピーボタンを配置し、コピー成功時は 1200ms だけチェックマークに変わる。

| ラベル | 出力例 |
|---|---|
| Color32 | `new Color32(255, 128, 0, 255)` |
| Color (float) | `new Color(1.000f, 0.502f, 0.000f, 1.000f)` |
| HEX #RRGGBBAA | `#FF8000FF` |
| HEX #RRGGBB | `#FF8000` |
| HTML rgba() | `rgba(255, 128, 0, 1.00)` |

---

## タブ別の入力欄

全タブ共通でR/G/B/Aスライダー（内部値 0–255）と右列テキストボックスを表示する。タブによってテキストボックスの表示・入力形式のみ異なる。スライダーの `min/max` は常に 0/255 で固定。

### Color32 タブ

- R/G/B/A テキストボックス: 整数 0–255 を直接入力

### Color (float) タブ

- R/G/B/A テキストボックス: 小数 0.000–1.000（step=0.001）を表示・入力
- 入力変更時は `Math.round(floatInput * 255)` で内部値に変換
- スライダー変更時は `(internalValue / 255).toFixed(3)` でテキストボックスに反映

### HEX タブ

- R/G/B/A スライダー＋テキストボックス（整数 0–255）はそのまま表示
- 加えてHEXテキスト入力欄（`#RRGGBBAA` 形式、8桁）を表示
- 6桁入力時は末尾に `FF` を自動補完して処理
- 8桁以外はリアルタイムで無視（状態を更新しない）
- カラーピッカーは RGB のみ反映（A は変更しない）

---

## 変換ロジック（`src/lib/colorConverter.ts`）

```ts
export function clamp(n: number, min: number, max: number): number
export function toHex2(n: number): string        // 0–255 → "FF"
export function fStr(n: number): string          // 0–255 → "1.000f"
export function parseHex(hex: string): { r: number; g: number; b: number; a: number } | null
  // "#RRGGBBAA" または "RRGGBB" を受け取り、6桁の場合は a=255 で返す
  // 不正入力は null を返す

export function formatColor32(r: number, g: number, b: number, a: number): string
export function formatColorFloat(r: number, g: number, b: number, a: number): string
export function formatHex8(r: number, g: number, b: number, a: number): string
export function formatHex6(r: number, g: number, b: number): string
export function formatRgba(r: number, g: number, b: number, a: number): string
```

---

## テスト方針（`src/lib/colorConverter.test.ts`）

- `toHex2`: 0, 255, 128 など境界値
- `parseHex`: 6桁・8桁・不正入力・`#` あり/なし
- `formatColorFloat`: 丸め誤差が表示に出ないこと（`toFixed(3)` で固定）
- `fStr`: 0 → `"0.000f"`、255 → `"1.000f"`、128 → `"0.502f"`

---

## ページメタ情報

```html
<svelte:head>
  <title>Color32 / Color 変換 | Unity カラーコンバーター | 96xtools</title>
  <meta name="description" content="Unity の Color32・Color・HEX を相互変換。new Color32()・new Color()・#RRGGBBAA をリアルタイムで変換してコピーできる無料ツール。" />
</svelte:head>
```

---

## 注意事項

- `<input type="color">` はアルファを扱えないため、A は常に数値入力欄（スライダー）で管理する
- float 変換の浮動小数点誤差は `toFixed()` で丸めて表示する
- HEX テキスト入力欄は 6桁・8桁以外の入力をリアルタイムで無視し、状態を更新しない
