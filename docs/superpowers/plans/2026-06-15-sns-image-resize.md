# SNS画像リサイズツール 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SNS各サービスの推奨サイズにクロップ・リサイズできるクライアントサイド完結型ツールを `/sns-image-resize` ページとして追加する。

**Architecture:** `+page.svelte` が全状態を所有し、PresetSelector・CropEditor・ImageUploaderの各コンポーネントはprops/callbackで繋ぐ。クロップUIはsvelte-easy-cropに委ね、出力はCanvas APIでPNGに書き出す。

**Tech Stack:** SvelteKit (adapter-static), Svelte 5 runes, svelte-easy-crop, Canvas API, Tailwind CSS, Vitest

---

## ファイルマップ

| 操作 | ファイル |
|---|---|
| 新規作成 | `src/lib/data/snsPresets.ts` |
| 新規作成 | `src/lib/utils/cropToBlob.ts` |
| 新規作成 | `src/lib/utils/cropToBlob.test.ts` |
| 新規作成 | `src/lib/components/PresetSelector.svelte` |
| 新規作成 | `src/lib/components/CropEditor.svelte` |
| 新規作成 | `src/routes/sns-image-resize/+page.ts` |
| 新規作成 | `src/routes/sns-image-resize/+page.svelte` |
| 修正 | `src/lib/site.ts` |

---

## Task 1: svelte-easy-cropのインストール

**Files:**
- (package.json, package-lock.json が更新される)

- [ ] **Step 1: インストール**

```bash
npm install svelte-easy-crop
```

Expected: `added N packages` のような出力でエラーなし。

- [ ] **Step 2: 動作確認（型が解決できることだけ確認）**

```bash
npx tsc --noEmit
```

Expected: エラーなし（既存エラーがあればスキップ可）。

- [ ] **Step 3: コミット**

```bash
git add package.json package-lock.json
git commit -m "chore: install svelte-easy-crop"
```

---

## Task 2: snsPresets.ts — プリセットデータ定義

**Files:**
- Create: `src/lib/data/snsPresets.ts`

- [ ] **Step 1: ファイルを作成**

```typescript
// src/lib/data/snsPresets.ts
export interface SnsPreset {
  id: string
  label: string
  service: string
  width: number
  height: number
}

export const snsPresets: SnsPreset[] = [
  { id: 'ig-square',   label: 'Instagram 投稿（正方形）',     service: 'Instagram', width: 1080, height: 1080 },
  { id: 'ig-portrait', label: 'Instagram 投稿（縦長）',       service: 'Instagram', width: 1080, height: 1350 },
  { id: 'ig-story',    label: 'Instagram ストーリー / リール', service: 'Instagram', width: 1080, height: 1920 },
  { id: 'x-post',      label: 'X(Twitter) 投稿画像',          service: 'X',         width: 1600, height: 900  },
  { id: 'x-header',   label: 'X(Twitter) ヘッダー画像',      service: 'X',         width: 1500, height: 500  },
  { id: 'yt-thumb',   label: 'YouTube サムネイル',            service: 'YouTube',   width: 1280, height: 720  },
  { id: 'yt-art',     label: 'YouTube チャンネルアート',      service: 'YouTube',   width: 2560, height: 1440 },
  { id: 'fb-cover',   label: 'Facebook カバー画像',           service: 'Facebook',  width: 820,  height: 312  },
  { id: 'li-post',    label: 'LinkedIn 投稿画像',             service: 'LinkedIn',  width: 1200, height: 627  },
]
```

- [ ] **Step 2: コミット**

```bash
git add src/lib/data/snsPresets.ts
git commit -m "feat: add SNS presets data"
```

---

## Task 3: cropToBlob.ts — クロップ結果をPNG Blobに変換

**Files:**
- Create: `src/lib/utils/cropToBlob.ts`
- Create: `src/lib/utils/cropToBlob.test.ts`

- [ ] **Step 1: テストを書く（失敗する状態で）**

```typescript
// src/lib/utils/cropToBlob.test.ts
import { describe, it, expect } from 'vitest'
import { buildDownloadFileName } from './cropToBlob'

describe('buildDownloadFileName', () => {
  it('presetIdに.png拡張子を付けて返す', () => {
    expect(buildDownloadFileName('ig-square')).toBe('ig-square.png')
  })

  it('ハイフンを含むpresetIdでも正しく動作する', () => {
    expect(buildDownloadFileName('yt-thumb')).toBe('yt-thumb.png')
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx vitest run src/lib/utils/cropToBlob.test.ts
```

Expected: `Cannot find module './cropToBlob'` またはエクスポートが見つからないエラー。

- [ ] **Step 3: 実装を書く**

```typescript
// src/lib/utils/cropToBlob.ts
export interface PixelCrop {
  x: number
  y: number
  width: number
  height: number
}

export function buildDownloadFileName(presetId: string): string {
  return `${presetId}.png`
}

export async function cropToBlob(
  imageFile: File,
  pixelCrop: PixelCrop,
  outputWidth: number,
  outputHeight: number
): Promise<Blob> {
  const src = URL.createObjectURL(imageFile)
  try {
    const image = await loadImage(src)
    const canvas = document.createElement('canvas')
    canvas.width = outputWidth
    canvas.height = outputHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      outputWidth,
      outputHeight
    )
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error('canvas.toBlob が null を返しました'))
      }, 'image/png')
    })
  } finally {
    URL.revokeObjectURL(src)
  }
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

- [ ] **Step 4: テストが通ることを確認**

```bash
npx vitest run src/lib/utils/cropToBlob.test.ts
```

Expected: `2 tests passed`

- [ ] **Step 5: コミット**

```bash
git add src/lib/utils/cropToBlob.ts src/lib/utils/cropToBlob.test.ts
git commit -m "feat: add cropToBlob utility"
```

---

## Task 4: PresetSelector.svelte — プリセット選択カードグリッド

**Files:**
- Create: `src/lib/components/PresetSelector.svelte`

- [ ] **Step 1: コンポーネントを作成**

```svelte
<!-- src/lib/components/PresetSelector.svelte -->
<script lang="ts">
  import type { SnsPreset } from '$lib/data/snsPresets'

  interface Props {
    presets: SnsPreset[]
    selected: SnsPreset | null
    onselect: (preset: SnsPreset) => void
  }

  let { presets, selected, onselect }: Props = $props()
</script>

<div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
  {#each presets as preset (preset.id)}
    <button
      type="button"
      class="rounded-lg border-2 p-3 text-left transition-colors"
      class:border-teal-500={selected?.id === preset.id}
      class:bg-teal-50={selected?.id === preset.id}
      class:border-slate-200={selected?.id !== preset.id}
      class:hover:border-slate-300={selected?.id !== preset.id}
      onclick={() => onselect(preset)}
    >
      <p class="text-xs font-medium text-slate-500">{preset.service}</p>
      <p class="text-sm font-semibold text-slate-800 mt-0.5 leading-tight">{preset.label}</p>
      <p class="text-xs text-slate-400 mt-1">{preset.width} × {preset.height}</p>
    </button>
  {/each}
</div>
```

- [ ] **Step 2: ビルドエラーがないことを確認**

```bash
npx tsc --noEmit
```

Expected: エラーなし（または既存のエラーのみ）。

- [ ] **Step 3: コミット**

```bash
git add src/lib/components/PresetSelector.svelte
git commit -m "feat: add PresetSelector component"
```

---

## Task 5: CropEditor.svelte — svelte-easy-cropラッパー

**Files:**
- Create: `src/lib/components/CropEditor.svelte`

- [ ] **Step 1: コンポーネントを作成**

```svelte
<!-- src/lib/components/CropEditor.svelte -->
<script lang="ts">
  import Cropper from 'svelte-easy-crop'
  import type { SnsPreset } from '$lib/data/snsPresets'
  import type { PixelCrop } from '$lib/utils/cropToBlob'

  interface Props {
    imageFile: File
    preset: SnsPreset
    oncropcomplete: (pixels: PixelCrop) => void
  }

  let { imageFile, preset, oncropcomplete }: Props = $props()

  let imageSrc = $state('')
  let crop = $state({ x: 0, y: 0 })
  let zoom = $state(1)
  let aspect = $derived(preset.width / preset.height)

  $effect(() => {
    const url = URL.createObjectURL(imageFile)
    imageSrc = url
    return () => URL.revokeObjectURL(url)
  })

  function handleCropComplete(e: CustomEvent<{ pixels: PixelCrop }>) {
    oncropcomplete(e.detail.pixels)
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
        on:cropcomplete={handleCropComplete}
      />
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

- [ ] **Step 2: ビルドエラーがないことを確認**

```bash
npx tsc --noEmit
```

Expected: エラーなし（svelte-easy-cropの型定義が欠けていた場合は次Taskに進んで実機確認する）。

- [ ] **Step 3: コミット**

```bash
git add src/lib/components/CropEditor.svelte
git commit -m "feat: add CropEditor component with svelte-easy-crop"
```

---

## Task 6: ルーティング — +page.ts と +page.svelte の作成

**Files:**
- Create: `src/routes/sns-image-resize/+page.ts`
- Create: `src/routes/sns-image-resize/+page.svelte`

- [ ] **Step 1: +page.ts を作成（SEOメタデータ）**

```typescript
// src/routes/sns-image-resize/+page.ts
export function load() {
  return {
    title: 'SNS画像サイズ変換 - Instagram・X・YouTube対応の無料ツール',
    description:
      'InstagramやX(Twitter)、YouTubeなど主要SNSの推奨画像サイズに、ワンクリックでリサイズ・クロップできる無料ツール。ファイルはサーバーに送信されず、すべてブラウザ内で処理されます。',
  }
}
```

- [ ] **Step 2: +page.svelte を作成**

```svelte
<!-- src/routes/sns-image-resize/+page.svelte -->
<script lang="ts">
  import type { PageData } from './$types'
  import ImageUploader from '$lib/components/ImageUploader.svelte'
  import PresetSelector from '$lib/components/PresetSelector.svelte'
  import CropEditor from '$lib/components/CropEditor.svelte'
  import { snsPresets, type SnsPreset } from '$lib/data/snsPresets'
  import { cropToBlob, buildDownloadFileName, type PixelCrop } from '$lib/utils/cropToBlob'

  let { data }: { data: PageData } = $props()

  let selectedPreset = $state<SnsPreset | null>(null)
  let imageFile = $state<File | null>(null)
  let croppedAreaPixels = $state<PixelCrop | null>(null)
  let isDownloading = $state(false)

  function handleFiles(files: File[]) {
    imageFile = files[0] ?? null
    croppedAreaPixels = null
  }

  function handlePresetSelect(preset: SnsPreset) {
    selectedPreset = preset
    croppedAreaPixels = null
  }

  function handleCropComplete(pixels: PixelCrop) {
    croppedAreaPixels = pixels
  }

  async function handleDownload() {
    if (!imageFile || !selectedPreset || !croppedAreaPixels) return
    isDownloading = true
    try {
      const blob = await cropToBlob(
        imageFile,
        croppedAreaPixels,
        selectedPreset.width,
        selectedPreset.height
      )
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = buildDownloadFileName(selectedPreset.id)
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      isDownloading = false
    }
  }

  let canDownload = $derived(!!imageFile && !!selectedPreset && !!croppedAreaPixels && !isDownloading)
  let downloadLabel = $derived(
    selectedPreset
      ? `ダウンロード(${selectedPreset.width} × ${selectedPreset.height} PNG)`
      : 'ダウンロード'
  )
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
    <p class="mt-1 text-xs text-teal-700 font-medium">🔒 画像はサーバーに送信されません。すべてブラウザ内で処理します。</p>
  </div>

  <!-- プリセット選択 -->
  <section class="space-y-2">
    <h2 class="text-sm font-semibold text-slate-600">1. サイズを選ぶ</h2>
    <PresetSelector presets={snsPresets} selected={selectedPreset} onselect={handlePresetSelect} />
  </section>

  <!-- 画像アップロード -->
  <section class="space-y-2">
    <h2 class="text-sm font-semibold text-slate-600">2. 画像をアップロード</h2>
    <ImageUploader onfiles={handleFiles} />
  </section>

  <!-- クロップ編集（画像とプリセット両方が揃った場合のみ表示） -->
  {#if imageFile && selectedPreset}
    <section class="space-y-2">
      <h2 class="text-sm font-semibold text-slate-600">3. クロップ位置を調整</h2>
      {#key selectedPreset.id}
        <CropEditor {imageFile} preset={selectedPreset} oncropcomplete={handleCropComplete} />
      {/key}
    </section>
  {/if}

  <!-- ダウンロードボタン -->
  {#if imageFile && selectedPreset}
    <button
      type="button"
      class="w-full rounded-xl bg-teal-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
      disabled={!canDownload}
      onclick={handleDownload}
    >
      {isDownloading ? '処理中...' : downloadLabel}
    </button>
  {/if}

  <!-- 広告枠 in-content -->
  <div class="ad-slot ad-slot--in-content flex h-24 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">
    広告枠
  </div>

  <!-- SEO説明文 + 内部リンク -->
  <section class="rounded-xl border border-slate-100 bg-slate-50 p-5 space-y-3 text-sm text-slate-600">
    <h2 class="font-semibold text-slate-700">対応SNSプラットフォームと推奨サイズについて</h2>
    <p>
      このツールでは、Instagram（投稿・ストーリー・リール）、X(Twitter)（投稿・ヘッダー）、YouTube（サムネイル・チャンネルアート）、Facebook（カバー画像）、LinkedIn（投稿画像）など、主要SNSの推奨サイズを収録しています。
      プリセットを選ぶだけでアスペクト比が自動的にセットされ、クロップ位置を調整してダウンロードするだけで最適なサイズの画像が完成します。
    </p>
    <p>
      すべての処理はブラウザ内で完結するため、アップロードによるプライバシーのリスクがありません。
    </p>
    <p>
      画像のファイルサイズを圧縮したい場合や形式を変換したい場合は、
      <a href="/image-tools" class="text-teal-700 underline hover:text-teal-800">画像圧縮・変換ツール</a>もご利用ください。
    </p>
  </section>
</div>
```

- [ ] **Step 3: ビルドが通ることを確認**

```bash
npm run build
```

Expected: `✓ built in` メッセージでエラーなし。

- [ ] **Step 4: コミット**

```bash
git add src/routes/sns-image-resize/
git commit -m "feat: add sns-image-resize page"
```

---

## Task 7: site.ts — ナビゲーションにツールを追加

**Files:**
- Modify: `src/lib/site.ts`

- [ ] **Step 1: site.ts を修正してツールを追加**

`src/lib/site.ts` の `tools` 配列の末尾（`} as const` の直前）に以下を追加:

```typescript
    {
      href: "/sns-image-resize",
      label: "SNS画像リサイズ(開発中)",
      description: "SNS各サービスの推奨サイズにワンクリックでリサイズ・クロップするツール",
      visible: true,
    },
```

変更後の `tools` 配列全体（確認用）:

```typescript
  tools: [
    {
      href: "/bpm-tapper",
      label: "BPM Tapper",
      description: "タップしてBPMを計測するツール",
      visible: true,
    },
    {
      href: "/hepburn-converter",
      label: "ヘボン式変換",
      description: "日本語をヘボン式ローマ字に変換するツール",
      visible: true,
    },
    {
      href: "/image-tools",
      label: "画像変換(開発中)",
      description: "画像の圧縮・リサイズ・形式変換ツール",
      visible: false,
    },
    {
      href: "/sns-image-resize",
      label: "SNS画像リサイズ(開発中)",
      description: "SNS各サービスの推奨サイズにワンクリックでリサイズ・クロップするツール",
      visible: true,
    },
  ],
```

- [ ] **Step 2: ビルドが通ることを確認**

```bash
npm run build
```

Expected: エラーなし。

- [ ] **Step 3: コミット**

```bash
git add src/lib/site.ts
git commit -m "feat: add SNS image resize to navigation"
```

---

## Task 8: 動作確認（開発サーバー）

- [ ] **Step 1: 開発サーバーを起動**

```bash
npm run dev
```

- [ ] **Step 2: 動作確認チェックリスト**

ブラウザで `http://localhost:5173/sns-image-resize` を開き、以下を確認:

1. **ナビゲーション**: ヘッダーに「SNS画像リサイズ(開発中)」リンクが表示される
2. **プリセット選択**: 9枚のカードが2〜3列グリッドで表示される。クリックでハイライトが切り替わる
3. **アップロード**: ドラッグ&ドロップまたは「ファイルを選択」で画像を読み込める（JPEG/PNG/WebP）
4. **クロップUI**: プリセット選択 + 画像アップロード後にクロップエリアが表示され、ドラッグで位置を変えられる
5. **ズームスライダー**: スライダー操作でクロップの拡大縮小ができる
6. **プリセット切り替え**: プリセットを変えるとアスペクト比が変わり、クロップ枠がリセットされる
7. **ダウンロード**: ボタンを押すとPNGがダウンロードされる。ファイル名は `ig-square.png` 等
8. **SEO説明文**: ページ末尾に説明文と「画像圧縮・変換ツール」への内部リンクがある
9. **広告枠**: 上部・本文中に「広告枠」プレースホルダーが2つある

- [ ] **Step 3: 全テストが通ることを確認**

```bash
npx vitest run
```

Expected: 全テストPASS。

---

## トラブルシューティング

**`svelte-easy-crop` の型エラーが出る場合:**
`svelte-easy-crop` がSvelte 5向けの型を持っていない場合、`CropEditor.svelte` の先頭に追加:

```svelte
<!-- @ts-ignore -->
```
または `src/app.d.ts` にモジュール宣言を追加:
```typescript
declare module 'svelte-easy-crop' {
  import type { SvelteComponent } from 'svelte'
  export default class Cropper extends SvelteComponent<{
    image: string
    crop?: { x: number; y: number }
    zoom?: number
    aspect?: number
    cropShape?: 'rect' | 'round'
    showGrid?: boolean
    minZoom?: number
    maxZoom?: number
  }> {}
}
```

**`on:cropcomplete` が型エラーになる場合（Svelte 5のレガシーイベント構文）:**
`CropEditor.svelte` の Cropper コンポーネント呼び出しを以下に変更:

```svelte
<Cropper
  image={imageSrc}
  bind:crop
  bind:zoom
  {aspect}
  oncropcomplete={(e: CustomEvent<{ pixels: PixelCrop }>) => oncropcomplete(e.detail.pixels)}
/>
```
