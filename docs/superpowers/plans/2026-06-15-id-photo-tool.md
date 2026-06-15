# 証明写真ツール 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SvelteKitプロジェクトに証明写真・履歴書用写真のサイズ調整とL判印刷シート生成ツールを追加する。

**Architecture:** プリセット選択 → 画像アップロード → CropEditorWithGuide でクロップ → 証明写真ダウンロード or SheetLayoutPreview でL判シート生成→ダウンロード、という1ページ完結フロー。既存の `ImageUploader.svelte`・`cropToBlob.ts` を再利用し、`PresetSelector.svelte` をSvelte 5スニペット対応で汎用化する。Canvas API で画像合成、300dpi換算のmm→px変換を共通ユーティリティで提供する。

**Tech Stack:** SvelteKit + Svelte 5 (`$state`/`$derived`/`$effect`/`{#snippet}`), svelte-easy-crop v5, Tailwind CSS v3, Vitest, Canvas API (browser)

---

## ファイルマップ

| ファイル | 種別 | 役割 |
|---|---|---|
| `src/lib/utils/mmToPx.ts` | 新規 | mm→px変換（300dpiデフォルト） |
| `src/lib/utils/mmToPx.test.ts` | 新規 | mmToPxのユニットテスト |
| `src/lib/data/idPhotoPresets.ts` | 新規 | 証明写真プリセット定数（6種類） |
| `src/lib/data/printSheetSizes.ts` | 新規 | 印刷シートサイズ定数（L判・2L判） |
| `src/lib/utils/sheetCompositor.ts` | 新規 | グリッドレイアウト計算 + Canvas合成 |
| `src/lib/utils/sheetCompositor.test.ts` | 新規 | computeGridLayoutのユニットテスト |
| `src/lib/components/PresetSelector.svelte` | 変更 | Svelte 5スニペット対応で汎用化 |
| `src/routes/sns-image-resize/+page.svelte` | 変更 | 汎用化したPresetSelectorに合わせて更新 |
| `src/lib/components/CropEditorWithGuide.svelte` | 新規 | 顔位置ガイド付きクロップUI |
| `src/lib/components/SheetLayoutPreview.svelte` | 新規 | 印刷シートの紙っぽいプレビュー |
| `src/routes/id-photo/+page.ts` | 新規 | SEOメタデータ |
| `src/routes/id-photo/+page.svelte` | 新規 | メインページ（全コンポーネント組み合わせ） |
| `src/lib/site.ts` | 変更 | 証明写真ツールをナビゲーションに追加 |

---

## Task 1: mmToPx ユーティリティ（TDD）

**Files:**
- Create: `src/lib/utils/mmToPx.ts`
- Create: `src/lib/utils/mmToPx.test.ts`

- [ ] **Step 1: テストを書く**

`src/lib/utils/mmToPx.test.ts` を新規作成:

```ts
import { describe, it, expect } from 'vitest'
import { mmToPx } from './mmToPx'

describe('mmToPx', () => {
  it('300dpiで25.4mmを300pxに変換する', () => {
    expect(mmToPx(25.4)).toBe(300)
  })

  it('300dpiで30mmを354pxに変換する', () => {
    // 30 / 25.4 * 300 = 354.33... → Math.round = 354
    expect(mmToPx(30)).toBe(354)
  })

  it('カスタムDPIを使用できる', () => {
    expect(mmToPx(25.4, 72)).toBe(72)
  })

  it('0mmは0pxを返す', () => {
    expect(mmToPx(0)).toBe(0)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```
npm run test -- --reporter=verbose
```

Expected: `mmToPx` is not defined / Cannot find module

- [ ] **Step 3: 実装する**

`src/lib/utils/mmToPx.ts` を新規作成:

```ts
export function mmToPx(mm: number, dpi = 300): number {
  return Math.round((mm / 25.4) * dpi)
}
```

- [ ] **Step 4: テストが通ることを確認**

```
npm run test -- --reporter=verbose
```

Expected: 4 tests passing for mmToPx

- [ ] **Step 5: コミット**

```bash
git add src/lib/utils/mmToPx.ts src/lib/utils/mmToPx.test.ts
git commit -m "feat: add mmToPx utility (mm to px at 300dpi)"
```

---

## Task 2: プリセットデータ定数

**Files:**
- Create: `src/lib/data/idPhotoPresets.ts`
- Create: `src/lib/data/printSheetSizes.ts`

- [ ] **Step 1: idPhotoPresets.ts を作成**

```ts
export interface IdPhotoPreset {
  id: string
  name: string
  note: string
  widthMm: number
  heightMm: number
}

export const idPhotoPresets: IdPhotoPreset[] = [
  { id: 'resume',        name: '履歴書用',           widthMm: 30, heightMm: 40, note: '一般的な履歴書サイズ' },
  { id: 'general-small', name: '証明写真（一般・小）', widthMm: 24, heightMm: 30, note: '各種申請書類向け' },
  { id: 'general-large', name: '証明写真（一般・大）', widthMm: 35, heightMm: 45, note: '各種申請書類向け' },
  { id: 'passport',      name: 'パスポート用',        widthMm: 35, heightMm: 45, note: 'パスポート申請向け' },
  { id: 'my-number',     name: 'マイナンバーカード用', widthMm: 35, heightMm: 45, note: 'マイナンバーカード申請向け' },
  { id: 'license',       name: '運転免許証用',        widthMm: 24, heightMm: 30, note: '運転免許証更新向け' },
]
```

- [ ] **Step 2: printSheetSizes.ts を作成**

```ts
export interface PrintSheetSize {
  id: string
  label: string
  widthMm: number
  heightMm: number
}

export const printSheetSizes: PrintSheetSize[] = [
  { id: 'l',  label: 'L判',  widthMm: 89,  heightMm: 127 },
  { id: '2l', label: '2L判', widthMm: 127, heightMm: 178 },
]
```

- [ ] **Step 3: コミット**

```bash
git add src/lib/data/idPhotoPresets.ts src/lib/data/printSheetSizes.ts
git commit -m "feat: add id-photo and print sheet size presets"
```

---

## Task 3: sheetCompositor（TDD）

**Files:**
- Create: `src/lib/utils/sheetCompositor.ts`
- Create: `src/lib/utils/sheetCompositor.test.ts`

- [ ] **Step 1: テストを書く**

`src/lib/utils/sheetCompositor.test.ts` を新規作成:

```ts
import { describe, it, expect } from 'vitest'
import { computeGridLayout } from './sheetCompositor'

describe('computeGridLayout', () => {
  it('L判6面で2列3行のレイアウトを返す', () => {
    // L判: 89mm×127mm → 1051×1500px at 300dpi
    // 履歴書用: 30mm×40mm → 354×472px
    // maxCols=floor(1051/354)=2, cols=2, rows=ceil(6/2)=3
    const layout = computeGridLayout(1051, 1500, 354, 472, 6)
    expect(layout.cols).toBe(2)
    expect(layout.rows).toBe(3)
    expect(layout.positions).toHaveLength(6)
  })

  it('L判4面で2列2行のレイアウトを返す', () => {
    const layout = computeGridLayout(1051, 1500, 354, 472, 4)
    expect(layout.cols).toBe(2)
    expect(layout.rows).toBe(2)
    expect(layout.positions).toHaveLength(4)
  })

  it('1枚目のx座標はmarginXに等しい', () => {
    // marginX = (1051 - 2*354) / (2+1) = 343/3 ≈ 114.33
    const layout = computeGridLayout(1051, 1500, 354, 472, 6)
    expect(layout.positions[0].x).toBeCloseTo(343 / 3, 0)
  })

  it('1枚目のy座標はmarginYに等しい', () => {
    // marginY = (1500 - 3*472) / (3+1) = 84/4 = 21
    const layout = computeGridLayout(1051, 1500, 354, 472, 6)
    expect(layout.positions[0].y).toBeCloseTo(21, 0)
  })

  it('シートに収まらない枚数でエラーを投げる', () => {
    // count=7: rows=ceil(7/2)=4 > maxRows=floor(1500/472)=3 → エラー
    expect(() => computeGridLayout(1051, 1500, 354, 472, 7)).toThrow()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```
npm run test -- --reporter=verbose
```

Expected: `computeGridLayout` is not defined

- [ ] **Step 3: computeGridLayout を実装**

`src/lib/utils/sheetCompositor.ts` を新規作成（`computeGridLayout` のみ先に実装）:

```ts
export interface GridLayout {
  cols: number
  rows: number
  marginX: number
  marginY: number
  positions: Array<{ x: number; y: number }>
}

export function computeGridLayout(
  sheetWidthPx: number,
  sheetHeightPx: number,
  photoWidthPx: number,
  photoHeightPx: number,
  count: number
): GridLayout {
  const maxCols = Math.floor(sheetWidthPx / photoWidthPx)
  const maxRows = Math.floor(sheetHeightPx / photoHeightPx)
  const cols = Math.min(maxCols, count)
  const rows = Math.ceil(count / cols)

  if (rows > maxRows) {
    throw new Error(`${count}枚はシートに収まりません`)
  }

  const marginX = (sheetWidthPx - cols * photoWidthPx) / (cols + 1)
  const marginY = (sheetHeightPx - rows * photoHeightPx) / (rows + 1)

  const positions: Array<{ x: number; y: number }> = []
  for (let i = 0; i < count; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    positions.push({
      x: marginX * (col + 1) + photoWidthPx * col,
      y: marginY * (row + 1) + photoHeightPx * row,
    })
  }

  return { cols, rows, marginX, marginY, positions }
}
```

- [ ] **Step 4: テストが通ることを確認**

```
npm run test -- --reporter=verbose
```

Expected: 5 tests passing for computeGridLayout

- [ ] **Step 5: compositeSheet を追記**

`src/lib/utils/sheetCompositor.ts` の末尾に追加:

```ts
export async function compositeSheet(
  photoBlobUrl: string,
  sheetWidthPx: number,
  sheetHeightPx: number,
  photoWidthPx: number,
  photoHeightPx: number,
  count: number
): Promise<Blob> {
  const layout = computeGridLayout(sheetWidthPx, sheetHeightPx, photoWidthPx, photoHeightPx, count)
  const img = await loadImage(photoBlobUrl)

  const canvas = document.createElement('canvas')
  canvas.width = sheetWidthPx
  canvas.height = sheetHeightPx
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, sheetWidthPx, sheetHeightPx)

  for (const { x, y } of layout.positions) {
    ctx.drawImage(img, x, y, photoWidthPx, photoHeightPx)
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('canvas.toBlob が null を返しました'))
    }, 'image/png')
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}
```

- [ ] **Step 6: コミット**

```bash
git add src/lib/utils/sheetCompositor.ts src/lib/utils/sheetCompositor.test.ts
git commit -m "feat: add sheetCompositor with grid layout and canvas composite"
```

---

## Task 4: PresetSelector 汎用化 + sns-image-resize 更新

**Files:**
- Modify: `src/lib/components/PresetSelector.svelte`
- Modify: `src/routes/sns-image-resize/+page.svelte`

- [ ] **Step 1: PresetSelector.svelte をスニペット対応に書き換え**

`src/lib/components/PresetSelector.svelte` を以下の内容で完全に置き換える:

```svelte
<script lang="ts" generics="T extends { id: string }">
  import type { Snippet } from 'svelte'

  interface Props {
    presets: T[]
    selected: T | null
    onselect: (preset: T) => void
    children: Snippet<[T]>
  }

  let { presets, selected, onselect, children }: Props = $props()
</script>

<div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
  {#each presets as preset (preset.id)}
    <button
      type="button"
      class="rounded-lg border-2 p-3 text-left transition-colors {selected?.id === preset.id
        ? 'border-teal-500 bg-teal-50'
        : 'border-slate-200 hover:border-slate-300'}"
      onclick={() => onselect(preset)}
    >
      {@render children(preset)}
    </button>
  {/each}
</div>
```

- [ ] **Step 2: sns-image-resize/+page.svelte のPresetSelector呼び出しを更新**

`src/routes/sns-image-resize/+page.svelte` 内の `<PresetSelector ... />` の部分を以下に書き換える（他の部分は変更しない）:

変更前:
```svelte
<PresetSelector presets={snsPresets} selected={selectedPreset} onselect={handlePresetSelect} />
```

変更後:
```svelte
<PresetSelector presets={snsPresets} selected={selectedPreset} onselect={handlePresetSelect}>
  {#snippet children(preset)}
    <p class="text-xs font-medium text-slate-500">{preset.service}</p>
    <p class="text-sm font-semibold text-slate-800 mt-0.5 leading-tight">{preset.label}</p>
    <p class="text-xs text-slate-400 mt-1">{preset.width} × {preset.height}</p>
  {/snippet}
</PresetSelector>
```

- [ ] **Step 3: ビルドが通ることを確認**

```
npm run build
```

Expected: Build succeeds with no TypeScript errors. sns-image-resize の表示が壊れていないことをブラウザ（http://localhost:5173/sns-image-resize）で目視確認する。

- [ ] **Step 4: コミット**

```bash
git add src/lib/components/PresetSelector.svelte src/routes/sns-image-resize/+page.svelte
git commit -m "refactor: generalize PresetSelector with Svelte 5 snippet"
```

---

## Task 5: CropEditorWithGuide コンポーネント

**Files:**
- Create: `src/lib/components/CropEditorWithGuide.svelte`

- [ ] **Step 1: CropEditorWithGuide.svelte を作成**

```svelte
<!-- src/lib/components/CropEditorWithGuide.svelte -->
<script lang="ts">
  import Cropper from 'svelte-easy-crop'
  import type { IdPhotoPreset } from '$lib/data/idPhotoPresets'
  import type { PixelCrop } from '$lib/utils/cropToBlob'
  import type { OnCropCompleteEvent } from 'svelte-easy-crop'

  interface Props {
    imageFile: File
    preset: IdPhotoPreset
    oncropcomplete: (pixels: PixelCrop) => void
  }

  let { imageFile, preset, oncropcomplete }: Props = $props()

  let imageSrc = $state('')
  let crop = $state({ x: 0, y: 0 })
  let zoom = $state(1)
  let aspect = $derived(preset.widthMm / preset.heightMm)

  $effect(() => {
    const url = URL.createObjectURL(imageFile)
    imageSrc = url
    zoom = 1
    crop = { x: 0, y: 0 }
    return () => URL.revokeObjectURL(url)
  })

  function handleCropComplete(e: OnCropCompleteEvent) {
    oncropcomplete(e.pixels)
  }
</script>

<div class="space-y-4">
  <div class="relative h-80 w-full overflow-hidden rounded-xl bg-slate-900">
    {#if imageSrc}
      <Cropper
        image={imageSrc}
        bind:crop
        bind:zoom
        {aspect}
        oncropcomplete={handleCropComplete}
      />
      <!-- 顔位置ガイド（横線 + 楕円）-->
      <div class="pointer-events-none absolute inset-0">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <ellipse
            cx="50%"
            cy="50%"
            rx="30%"
            ry="35%"
            fill="none"
            stroke="rgba(52,211,153,0.7)"
            stroke-width="1.5"
            stroke-dasharray="6 3"
          />
          <line x1="0" y1="15%" x2="100%" y2="15%" stroke="rgba(52,211,153,0.8)" stroke-width="1.5" />
          <text x="4" y="13%" fill="rgba(52,211,153,0.95)" font-size="11" font-family="sans-serif">頭頂</text>
          <line x1="0" y1="85%" x2="100%" y2="85%" stroke="rgba(52,211,153,0.8)" stroke-width="1.5" />
          <text x="4" y="97%" fill="rgba(52,211,153,0.95)" font-size="11" font-family="sans-serif">あご</text>
        </svg>
      </div>
    {/if}
  </div>

  <div class="flex items-center gap-3">
    <span class="shrink-0 text-sm text-slate-600">ズーム</span>
    <input
      type="range"
      min="1"
      max="3"
      step="0.01"
      bind:value={zoom}
      class="w-full accent-teal-600"
    />
  </div>
</div>
```

- [ ] **Step 2: コミット**

```bash
git add src/lib/components/CropEditorWithGuide.svelte
git commit -m "feat: add CropEditorWithGuide with face position guide overlay"
```

---

## Task 6: SheetLayoutPreview コンポーネント

**Files:**
- Create: `src/lib/components/SheetLayoutPreview.svelte`

- [ ] **Step 1: SheetLayoutPreview.svelte を作成**

```svelte
<!-- src/lib/components/SheetLayoutPreview.svelte -->
<script lang="ts">
  import type { IdPhotoPreset } from '$lib/data/idPhotoPresets'
  import type { PrintSheetSize } from '$lib/data/printSheetSizes'
  import type { PixelCrop } from '$lib/utils/cropToBlob'
  import { printSheetSizes } from '$lib/data/printSheetSizes'
  import { mmToPx } from '$lib/utils/mmToPx'

  interface Props {
    imageFile: File | null
    croppedAreaPixels: PixelCrop | null
    preset: IdPhotoPreset | null
    onsheetchange: (sheet: PrintSheetSize, count: number) => void
  }

  let { imageFile, croppedAreaPixels, preset, onsheetchange }: Props = $props()

  let selectedSheetId = $state('l')
  let selectedCount = $state(6)

  let selectedSheet = $derived(
    printSheetSizes.find((s) => s.id === selectedSheetId) ?? printSheetSizes[0]
  )

  // 300dpiでのシート・写真サイズ(px)を30%スケールでプレビュー表示
  const PREVIEW_SCALE = 0.3
  let sheetW = $derived(mmToPx(selectedSheet.widthMm) * PREVIEW_SCALE)
  let sheetH = $derived(mmToPx(selectedSheet.heightMm) * PREVIEW_SCALE)
  let cellW = $derived(preset ? mmToPx(preset.widthMm) * PREVIEW_SCALE : 0)
  let cellH = $derived(preset ? mmToPx(preset.heightMm) * PREVIEW_SCALE : 0)

  // グリッド計算（プレビュー用。sheetCompositorと同じロジック）
  let cols = $derived(cellW > 0 ? Math.min(Math.floor(sheetW / cellW), selectedCount) : 0)
  let rows = $derived(cols > 0 ? Math.ceil(selectedCount / cols) : 0)
  let marginX = $derived(cols > 0 ? (sheetW - cols * cellW) / (cols + 1) : 0)
  let marginY = $derived(rows > 0 ? (sheetH - rows * cellH) / (rows + 1) : 0)

  let imageSrc = $state('')
  $effect(() => {
    if (!imageFile) { imageSrc = ''; return }
    const url = URL.createObjectURL(imageFile)
    imageSrc = url
    return () => URL.revokeObjectURL(url)
  })

  $effect(() => {
    onsheetchange(selectedSheet, selectedCount)
  })
</script>

<div class="space-y-4">
  <!-- シートサイズ・枚数の選択 -->
  <div class="flex flex-wrap gap-4">
    <label class="flex flex-col gap-1 text-sm text-slate-600">
      シートサイズ
      <select bind:value={selectedSheetId} class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
        {#each printSheetSizes as sheet (sheet.id)}
          <option value={sheet.id}>{sheet.label}（{sheet.widthMm}×{sheet.heightMm}mm）</option>
        {/each}
      </select>
    </label>
    <label class="flex flex-col gap-1 text-sm text-slate-600">
      枚数
      <select bind:value={selectedCount} class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
        <option value={4}>4枚</option>
        <option value={6}>6枚</option>
      </select>
    </label>
  </div>

  <!-- 紙っぽいプレビュー -->
  <div class="overflow-x-auto">
    <div
      class="relative mx-auto rounded-sm border border-slate-300 bg-white shadow-md"
      style="width:{sheetW}px; height:{sheetH}px; flex-shrink:0;"
    >
      {#if preset && cols > 0}
        {#each Array(selectedCount).fill(0) as _, i (i)}
          {@const col = i % cols}
          {@const row = Math.floor(i / cols)}
          {@const x = marginX * (col + 1) + cellW * col}
          {@const y = marginY * (row + 1) + cellH * row}
          <div
            class="absolute overflow-hidden bg-slate-200"
            style="left:{x}px; top:{y}px; width:{cellW}px; height:{cellH}px;"
          >
            {#if imageSrc}
              <img src={imageSrc} alt="証明写真" class="h-full w-full object-cover" />
            {/if}
          </div>
        {/each}
      {:else}
        <div class="flex h-full items-center justify-center text-xs text-slate-400">
          用途を選択すると<br />プレビューが表示されます
        </div>
      {/if}
    </div>
  </div>

  {#if preset}
    <p class="text-center text-xs text-slate-500">
      {selectedSheet.label}（{selectedSheet.widthMm}×{selectedSheet.heightMm}mm） / {selectedCount}面
    </p>
  {/if}
</div>
```

- [ ] **Step 2: コミット**

```bash
git add src/lib/components/SheetLayoutPreview.svelte
git commit -m "feat: add SheetLayoutPreview with paper-like grid preview"
```

---

## Task 7: id-photo ルートページ

**Files:**
- Create: `src/routes/id-photo/+page.ts`
- Create: `src/routes/id-photo/+page.svelte`

- [ ] **Step 1: +page.ts を作成**

```ts
// src/routes/id-photo/+page.ts
export function load() {
  return {
    title: '証明写真サイズ無料調整ツール - 履歴書・パスポート対応 | 96X\'s Tools',
    description:
      '履歴書用(30×40mm)・パスポート用(35×45mm)など証明写真を無料でサイズ調整。コンビニ印刷対応のL判シートも作成できます。すべてブラウザ内で処理し、サーバーへの送信は一切ありません。',
  }
}
```

- [ ] **Step 2: +page.svelte を作成**

```svelte
<!-- src/routes/id-photo/+page.svelte -->
<script lang="ts">
  import type { PageData } from './$types'
  import ImageUploader from '$lib/components/ImageUploader.svelte'
  import PresetSelector from '$lib/components/PresetSelector.svelte'
  import CropEditorWithGuide from '$lib/components/CropEditorWithGuide.svelte'
  import SheetLayoutPreview from '$lib/components/SheetLayoutPreview.svelte'
  import { idPhotoPresets, type IdPhotoPreset } from '$lib/data/idPhotoPresets'
  import { printSheetSizes, type PrintSheetSize } from '$lib/data/printSheetSizes'
  import { cropToBlob, type PixelCrop } from '$lib/utils/cropToBlob'
  import { compositeSheet } from '$lib/utils/sheetCompositor'
  import { mmToPx } from '$lib/utils/mmToPx'

  let { data }: { data: PageData } = $props()

  let selectedPreset = $state<IdPhotoPreset | null>(null)
  let imageFile = $state<File | null>(null)
  let croppedAreaPixels = $state<PixelCrop | null>(null)
  let selectedSheet = $state<PrintSheetSize>(printSheetSizes[0])
  let selectedCount = $state(6)
  let isDownloadingPhoto = $state(false)
  let isDownloadingSheet = $state(false)
  let downloadError = $state('')

  function handlePresetSelect(preset: IdPhotoPreset) {
    selectedPreset = preset
    croppedAreaPixels = null
  }

  function handleFiles(files: File[]) {
    imageFile = files[0] ?? null
    croppedAreaPixels = null
  }

  function handleCropComplete(pixels: PixelCrop) {
    croppedAreaPixels = pixels
  }

  function handleSheetChange(sheet: PrintSheetSize, count: number) {
    selectedSheet = sheet
    selectedCount = count
  }

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleDownloadPhoto() {
    if (!imageFile || !selectedPreset || !croppedAreaPixels) return
    isDownloadingPhoto = true
    downloadError = ''
    try {
      const w = mmToPx(selectedPreset.widthMm)
      const h = mmToPx(selectedPreset.heightMm)
      const blob = await cropToBlob(imageFile, croppedAreaPixels, w, h)
      triggerDownload(blob, `id-photo-${selectedPreset.id}.png`)
    } catch {
      downloadError = '証明写真のダウンロードに失敗しました。'
    } finally {
      isDownloadingPhoto = false
    }
  }

  async function handleDownloadSheet() {
    if (!imageFile || !selectedPreset || !croppedAreaPixels) return
    isDownloadingSheet = true
    downloadError = ''
    try {
      const photoW = mmToPx(selectedPreset.widthMm)
      const photoH = mmToPx(selectedPreset.heightMm)
      const sheetW = mmToPx(selectedSheet.widthMm)
      const sheetH = mmToPx(selectedSheet.heightMm)
      const photoBlob = await cropToBlob(imageFile, croppedAreaPixels, photoW, photoH)
      const photoBlobUrl = URL.createObjectURL(photoBlob)
      try {
        const sheetBlob = await compositeSheet(photoBlobUrl, sheetW, sheetH, photoW, photoH, selectedCount)
        triggerDownload(sheetBlob, `id-photo-sheet-${selectedSheet.id}-${selectedCount}up.png`)
      } finally {
        URL.revokeObjectURL(photoBlobUrl)
      }
    } catch {
      downloadError = '印刷シートのダウンロードに失敗しました。'
    } finally {
      isDownloadingSheet = false
    }
  }

  let canDownload = $derived(!!imageFile && !!selectedPreset && !!croppedAreaPixels)
  let photoLabel = $derived(
    selectedPreset
      ? `証明写真のみ保存（${mmToPx(selectedPreset.widthMm)} × ${mmToPx(selectedPreset.heightMm)}px / ${selectedPreset.widthMm}×${selectedPreset.heightMm}mm）`
      : '証明写真のみ保存'
  )
  let sheetLabel = $derived(`印刷シート保存（${selectedSheet.label} ${selectedCount}面）`)
</script>

<svelte:head>
  <title>{data.title}</title>
  <meta name="description" content={data.description} />
</svelte:head>

<div class="max-w-4xl mx-auto px-4 py-8 space-y-6">
  <!-- 広告枠 top -->
  <div class="ad-slot ad-slot--top flex h-24 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">
    広告枠
  </div>

  <!-- タイトル -->
  <div>
    <h1 class="text-2xl font-bold text-slate-800">{data.title}</h1>
    <p class="mt-1 text-sm text-slate-500">{data.description}</p>
    <p class="mt-1 text-xs font-medium text-teal-700">🔒 画像はサーバーに送信されません。すべてブラウザ内で処理します。</p>
  </div>

  <!-- 1. 用途プリセット選択 -->
  <section class="space-y-2">
    <h2 class="text-sm font-semibold text-slate-600">1. 用途を選ぶ</h2>
    <PresetSelector presets={idPhotoPresets} selected={selectedPreset} onselect={handlePresetSelect}>
      {#snippet children(preset)}
        <p class="text-xs font-medium text-slate-500">{preset.note}</p>
        <p class="mt-0.5 text-sm font-semibold leading-tight text-slate-800">{preset.name}</p>
        <p class="mt-1 text-xs text-slate-400">{preset.heightMm} × {preset.widthMm} mm</p>
      {/snippet}
    </PresetSelector>
  </section>

  <!-- 2. 画像アップロード -->
  <section class="space-y-2">
    <h2 class="text-sm font-semibold text-slate-600">2. 画像をアップロード</h2>
    <ImageUploader onfiles={handleFiles} />
  </section>

  <!-- 3. クロップ編集（画像とプリセット両方が揃った場合のみ表示） -->
  {#if imageFile && selectedPreset}
    <section class="space-y-2">
      <h2 class="text-sm font-semibold text-slate-600">3. クロップ位置を調整</h2>
      {#key selectedPreset.id}
        <CropEditorWithGuide {imageFile} preset={selectedPreset} oncropcomplete={handleCropComplete} />
      {/key}
    </section>
  {/if}

  <!-- 4. 印刷シートレイアウト -->
  <section class="space-y-2">
    <h2 class="text-sm font-semibold text-slate-600">4. 印刷シートを設定</h2>
    <SheetLayoutPreview
      {imageFile}
      {croppedAreaPixels}
      preset={selectedPreset}
      onsheetchange={handleSheetChange}
    />
  </section>

  <!-- ダウンロードボタン -->
  {#if imageFile && selectedPreset}
    <div class="space-y-3">
      <button
        type="button"
        class="w-full rounded-xl bg-teal-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!canDownload || isDownloadingPhoto}
        onclick={handleDownloadPhoto}
      >
        {isDownloadingPhoto ? '処理中...' : photoLabel}
      </button>
      <button
        type="button"
        class="w-full rounded-xl bg-sky-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!canDownload || isDownloadingSheet}
        onclick={handleDownloadSheet}
      >
        {isDownloadingSheet ? '処理中...' : sheetLabel}
      </button>
      {#if downloadError}
        <p class="text-sm text-red-500">{downloadError}</p>
      {/if}
    </div>
  {/if}

  <!-- 広告枠 in-content -->
  <div class="ad-slot ad-slot--in-content flex h-24 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">
    広告枠
  </div>

  <!-- SEO説明文 + 内部リンク -->
  <section class="rounded-xl border border-slate-100 bg-slate-50 p-5 space-y-3 text-sm text-slate-600">
    <h2 class="font-semibold text-slate-700">証明写真のサイズと印刷方法について</h2>
    <p>
      履歴書用写真の正しいサイズは縦40mm×横30mmが一般的です。パスポート申請やマイナンバーカード申請には縦45mm×横35mmの規格が使われます。本ツールで証明写真のサイズ調整・クロップを行った後、L判シートにまとめてコンビニのマルチコピー機で印刷できます。ファミリーマートやローソンでは「Lサイズ写真プリント」を選択するだけで、自宅で撮影した証明写真を手軽に印刷可能です。すべての処理はブラウザ内で完結するため、写真データをサーバーに送信することはありません。
    </p>
    <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
      <span>他のツールもどうぞ:</span>
      <a href="/image-tools" class="text-teal-700 underline hover:text-teal-800">画像圧縮・変換ツール</a>
      <a href="/sns-image-resize" class="text-teal-700 underline hover:text-teal-800">SNS画像リサイズツール</a>
    </div>
  </section>
</div>
```

- [ ] **Step 3: コミット**

```bash
git add src/routes/id-photo/+page.ts src/routes/id-photo/+page.svelte
git commit -m "feat: add id-photo page with crop, sheet preview, and download"
```

---

## Task 8: ナビゲーション追加

**Files:**
- Modify: `src/lib/site.ts`

- [ ] **Step 1: site.ts に証明写真ツールを追加**

`src/lib/site.ts` の `tools` 配列の末尾（`sns-image-resize` エントリの後）に以下を追加:

```ts
{
  href: '/id-photo',
  label: '証明写真(開発中)',
  description: '証明写真・履歴書用写真のサイズ調整とコンビニ印刷用シート作成ツール',
  visible: true,
},
```

追加後の `tools` 配列末尾はこうなる（`as const` の前）:

```ts
    {
      href: '/sns-image-resize',
      label: 'SNS画像リサイズ(開発中)',
      description: 'SNS各サービスの推奨サイズにワンクリックでリサイズ・クロップするツール',
      visible: true,
    },
    {
      href: '/id-photo',
      label: '証明写真(開発中)',
      description: '証明写真・履歴書用写真のサイズ調整とコンビニ印刷用シート作成ツール',
      visible: true,
    },
  ],
} as const
```

- [ ] **Step 2: コミット**

```bash
git add src/lib/site.ts
git commit -m "feat: add id-photo to site navigation"
```

---

## Task 9: ビルド & 動作確認

- [ ] **Step 1: テストをすべて実行**

```
npm run test
```

Expected: All tests pass (mmToPx × 4, computeGridLayout × 5, 既存テスト含む)

- [ ] **Step 2: ビルドが通ることを確認**

```
npm run build
```

Expected: Build succeeds with no TypeScript errors

- [ ] **Step 3: 開発サーバーで動作確認**

```
npm run dev
```

ブラウザで http://localhost:5173/id-photo を開いて以下を確認:
- ナビゲーションに「証明写真(開発中)」が表示される
- 用途プリセットが6種類カード表示される
- プリセット選択後にアップロードエリアが表示される
- 画像アップロード後にクロップエディタ（顔ガイド付き）が表示される
- クロップ完了後に「証明写真のみ保存」「印刷シート保存」ボタンが有効になる
- 各ダウンロードボタンでPNGファイルがダウンロードされる
- sns-image-resize （http://localhost:5173/sns-image-resize）が引き続き正常動作する

- [ ] **Step 4: 問題があれば修正してコミット**

TypeScriptエラー・表示崩れがあれば修正し:

```bash
git add -A
git commit -m "fix: resolve build issues in id-photo tool"
```
