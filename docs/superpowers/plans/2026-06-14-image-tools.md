# 画像圧縮・リサイズ・形式変換ツール Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a client-side image conversion tool (compress/resize/format change) using Canvas API, integrated into the existing SvelteKit project with SEO-focused multi-page structure and ad slot placeholders.

**Architecture:** Three reusable Svelte components (ImageUploader, ImageSettings, ImageComparison) are assembled in `/image-tools/+page.svelte`. Utility modules handle Canvas API processing (`imageProcessor.ts`) and JSZip batch download (`zipDownload.ts`). Three SEO landing pages (`/image-tools/png-to-jpg`, `/image-tools/jpg-to-webp`, `/image-tools/compress-image`) reuse the same components with preset defaults. All processing is in-browser — no file upload to server.

**Tech Stack:** SvelteKit 2 / Svelte 5 runes (`$state`, `$derived`, `$props`, `$bindable`, `$effect`), Tailwind CSS v3, Canvas API (`canvas.toBlob()`), JSZip for batch ZIP download.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/lib/utils/imageProcessor.ts` | Canvas API resize/convert/compress logic |
| Create | `src/lib/utils/imageProcessor.test.ts` | Unit tests for pure utility functions |
| Create | `src/lib/utils/zipDownload.ts` | JSZip batch download helper |
| Create | `src/lib/components/ImageUploader.svelte` | Drag & drop + file input with validation |
| Create | `src/lib/components/ImageSettings.svelte` | Format / quality / dimensions UI |
| Create | `src/lib/components/ImageComparison.svelte` | Before/after card with download button |
| Create | `src/routes/image-tools/+page.ts` | SEO metadata (load function) |
| Create | `src/routes/image-tools/+page.svelte` | Main tool page assembling all components |
| Create | `src/routes/image-tools/png-to-jpg/+page.ts` | SEO metadata for PNG→JPG landing |
| Create | `src/routes/image-tools/png-to-jpg/+page.svelte` | PNG→JPG landing page |
| Create | `src/routes/image-tools/jpg-to-webp/+page.ts` | SEO metadata for JPG→WebP landing |
| Create | `src/routes/image-tools/jpg-to-webp/+page.svelte` | JPG→WebP landing page |
| Create | `src/routes/image-tools/compress-image/+page.ts` | SEO metadata for compression landing |
| Create | `src/routes/image-tools/compress-image/+page.svelte` | Compression landing page |
| Modify | `src/lib/site.ts` | Add image-tools to nav tools list |
| Modify | `package.json` | Add jszip dependency |

---

## Task 1: Install JSZip

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install jszip**

```bash
npm install jszip
```

- [ ] **Step 2: Verify types are available**

```bash
node -e "import('jszip').then(m => console.log('JSZip OK:', typeof m.default))"
```
Expected: `JSZip OK: function`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add jszip for batch image ZIP download"
```

---

## Task 2: imageProcessor.ts — types and pure utility functions

**Files:**
- Create: `src/lib/utils/imageProcessor.ts`
- Create: `src/lib/utils/imageProcessor.test.ts`

- [ ] **Step 1: Write failing tests for pure utility functions**

Create `src/lib/utils/imageProcessor.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { isSupported, getOutputFileName, calcReduction } from './imageProcessor'

describe('isSupported', () => {
  it('accepts JPEG', () => {
    const f = new File([], 'a.jpg', { type: 'image/jpeg' })
    expect(isSupported(f)).toBe(true)
  })
  it('accepts PNG', () => {
    const f = new File([], 'a.png', { type: 'image/png' })
    expect(isSupported(f)).toBe(true)
  })
  it('accepts WebP', () => {
    const f = new File([], 'a.webp', { type: 'image/webp' })
    expect(isSupported(f)).toBe(true)
  })
  it('accepts GIF', () => {
    const f = new File([], 'a.gif', { type: 'image/gif' })
    expect(isSupported(f)).toBe(true)
  })
  it('rejects PDF', () => {
    const f = new File([], 'a.pdf', { type: 'application/pdf' })
    expect(isSupported(f)).toBe(false)
  })
  it('rejects plain text', () => {
    const f = new File([], 'a.txt', { type: 'text/plain' })
    expect(isSupported(f)).toBe(false)
  })
})

describe('getOutputFileName', () => {
  it('replaces extension with jpg for JPEG format', () => {
    expect(getOutputFileName('photo.png', 'image/jpeg')).toBe('photo.jpg')
  })
  it('replaces extension with png for PNG format', () => {
    expect(getOutputFileName('photo.jpg', 'image/png')).toBe('photo.png')
  })
  it('replaces extension with webp for WebP format', () => {
    expect(getOutputFileName('photo.jpeg', 'image/webp')).toBe('photo.webp')
  })
  it('handles filenames with dots in the name', () => {
    expect(getOutputFileName('my.photo.gif', 'image/jpeg')).toBe('my.photo.jpg')
  })
})

describe('calcReduction', () => {
  it('returns 50 when converted is half original', () => {
    expect(calcReduction(1000, 500)).toBe(50)
  })
  it('returns 0 when sizes are equal', () => {
    expect(calcReduction(1000, 1000)).toBe(0)
  })
  it('returns negative when converted is larger', () => {
    expect(calcReduction(500, 1000)).toBe(-100)
  })
  it('rounds to nearest integer', () => {
    expect(calcReduction(1000, 333)).toBe(67)
  })
})
```

- [ ] **Step 2: Run tests — expect them to fail**

```bash
npm test -- imageProcessor
```
Expected: FAIL — `isSupported`, `getOutputFileName`, `calcReduction` not exported

- [ ] **Step 3: Create imageProcessor.ts with types and pure functions**

Create `src/lib/utils/imageProcessor.ts`:

```typescript
export type OutputFormat = 'image/jpeg' | 'image/png' | 'image/webp'

export interface ConvertOptions {
  format: OutputFormat
  quality: number        // 10–100; ignored for PNG
  width?: number         // target width in px; undefined = use source
  height?: number        // target height in px; undefined = use source
  keepAspectRatio: boolean
  noResize: boolean      // when true, skip resize entirely
}

export interface ConvertResult {
  blob: Blob
  objectUrl: string      // caller must revoke when done
  originalSize: number
  convertedSize: number
  reductionPercent: number
  fileName: string
  originalFile: File
}

const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

const FORMAT_EXT: Record<OutputFormat, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export function isSupported(file: File): boolean {
  return SUPPORTED_TYPES.includes(file.type)
}

export function getOutputFileName(originalName: string, format: OutputFormat): string {
  const base = originalName.replace(/\.[^.]+$/, '')
  return `${base}.${FORMAT_EXT[format]}`
}

export function calcReduction(originalSize: number, convertedSize: number): number {
  return Math.round((1 - convertedSize / originalSize) * 100)
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
      img.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

function calcDimensions(
  srcW: number,
  srcH: number,
  opts: ConvertOptions
): { w: number; h: number } {
  if (opts.noResize || (!opts.width && !opts.height)) {
    return { w: srcW, h: srcH }
  }
  if (!opts.keepAspectRatio) {
    return { w: opts.width ?? srcW, h: opts.height ?? srcH }
  }
  const ratio = srcW / srcH
  if (opts.width && !opts.height) {
    return { w: opts.width, h: Math.round(opts.width / ratio) }
  }
  if (opts.height && !opts.width) {
    return { w: Math.round(opts.height * ratio), h: opts.height }
  }
  // Both provided — fit by width
  return { w: opts.width!, h: Math.round(opts.width! / ratio) }
}

export async function convertImage(file: File, opts: ConvertOptions): Promise<ConvertResult> {
  if (!isSupported(file)) {
    throw new Error(`非対応の形式です: ${file.type || file.name}`)
  }

  const img = await loadImage(file)
  const { w, h } = calcDimensions(img.naturalWidth, img.naturalHeight, opts)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, w, h)

  const quality = opts.format === 'image/png' ? undefined : opts.quality / 100

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('変換に失敗しました'))),
      opts.format,
      quality
    )
  })

  return {
    blob,
    objectUrl: URL.createObjectURL(blob),
    originalSize: file.size,
    convertedSize: blob.size,
    reductionPercent: calcReduction(file.size, blob.size),
    fileName: getOutputFileName(file.name, opts.format),
    originalFile: file,
  }
}
```

- [ ] **Step 4: Run tests — expect them to pass**

```bash
npm test -- imageProcessor
```
Expected: all 13 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/imageProcessor.ts src/lib/utils/imageProcessor.test.ts
git commit -m "feat: add imageProcessor utility with Canvas API conversion logic"
```

---

## Task 3: zipDownload.ts

**Files:**
- Create: `src/lib/utils/zipDownload.ts`

- [ ] **Step 1: Create zipDownload.ts**

```typescript
import JSZip from 'jszip'
import type { ConvertResult } from './imageProcessor'

export async function downloadAllAsZip(results: ConvertResult[]): Promise<void> {
  const zip = new JSZip()
  for (const result of results) {
    zip.file(result.fileName, result.blob)
  }
  const zipBlob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(zipBlob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'converted-images.zip'
  a.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/utils/zipDownload.ts
git commit -m "feat: add zipDownload utility using JSZip"
```

---

## Task 4: ImageUploader.svelte

**Files:**
- Create: `src/lib/components/ImageUploader.svelte`

- [ ] **Step 1: Create ImageUploader.svelte**

```svelte
<script lang="ts">
  import { isSupported } from '$lib/utils/imageProcessor'

  interface Props {
    onfiles: (files: File[]) => void
  }

  let { onfiles }: Props = $props()

  let isDragOver = $state(false)
  let error = $state('')
  let inputEl: HTMLInputElement

  function processFiles(fileList: FileList | File[]) {
    const arr = Array.from(fileList)
    const invalid = arr.filter((f) => !isSupported(f))
    if (invalid.length > 0) {
      error = `非対応のファイル形式です: ${invalid.map((f) => f.name).join(', ')}`
      return
    }
    error = ''
    onfiles(arr)
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    isDragOver = false
    if (e.dataTransfer?.files) processFiles(e.dataTransfer.files)
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault()
    isDragOver = true
  }

  function handleChange(e: Event) {
    const el = e.currentTarget as HTMLInputElement
    if (el.files) processFiles(el.files)
  }
</script>

<div>
  <div
    class="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-10 text-center transition-colors cursor-pointer"
    class:border-teal-500={isDragOver}
    class:bg-teal-50={isDragOver}
    class:border-slate-300={!isDragOver}
    ondrop={handleDrop}
    ondragover={handleDragOver}
    ondragleave={() => (isDragOver = false)}
    onclick={() => inputEl.click()}
    role="button"
    tabindex="0"
    onkeydown={(e) => e.key === 'Enter' && inputEl.click()}
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="h-12 w-12 text-slate-400"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.5"
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
    <p class="text-slate-600">ここに画像をドラッグ&ドロップ</p>
    <p class="text-sm text-slate-400">または</p>
    <button
      type="button"
      class="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors"
      onclick={(e) => { e.stopPropagation(); inputEl.click() }}
    >
      ファイルを選択
    </button>
    <p class="text-xs text-slate-400">対応形式: JPEG, PNG, WebP, GIF(入力のみ) — 複数ファイル可</p>
  </div>

  {#if error}
    <p class="mt-2 text-sm text-red-500">{error}</p>
  {/if}

  <input
    bind:this={inputEl}
    type="file"
    accept="image/jpeg,image/png,image/webp,image/gif"
    multiple
    class="hidden"
    onchange={handleChange}
  />
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/ImageUploader.svelte
git commit -m "feat: add ImageUploader component with drag & drop support"
```

---

## Task 5: ImageSettings.svelte

**Files:**
- Create: `src/lib/components/ImageSettings.svelte`

- [ ] **Step 1: Create ImageSettings.svelte**

```svelte
<script lang="ts">
  import type { OutputFormat } from '$lib/utils/imageProcessor'

  interface Props {
    format: OutputFormat
    quality: number
    width: number | undefined
    height: number | undefined
    keepAspectRatio: boolean
    noResize: boolean
  }

  let {
    format = $bindable(),
    quality = $bindable(),
    width = $bindable(),
    height = $bindable(),
    keepAspectRatio = $bindable(),
    noResize = $bindable(),
  }: Props = $props()
</script>

<div class="rounded-xl border border-slate-200 bg-white p-5">
  <h2 class="mb-4 text-sm font-semibold text-slate-700">変換設定</h2>

  <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
    <!-- Output format -->
    <div class="flex flex-col gap-1.5">
      <label class="text-xs font-medium text-slate-600" for="format">出力形式</label>
      <select
        id="format"
        bind:value={format}
        class="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
      >
        <option value="image/jpeg">JPEG</option>
        <option value="image/png">PNG</option>
        <option value="image/webp">WebP</option>
      </select>
    </div>

    <!-- Quality slider -->
    <div class="flex flex-col gap-1.5" class:opacity-40={format === 'image/png'}>
      <label class="text-xs font-medium text-slate-600" for="quality">
        品質: {quality}
      </label>
      <input
        id="quality"
        type="range"
        min="10"
        max="100"
        step="1"
        bind:value={quality}
        disabled={format === 'image/png'}
        class="accent-teal-600"
      />
      <div class="flex justify-between text-xs text-slate-400">
        <span>低 (10)</span>
        <span>高 (100)</span>
      </div>
    </div>

    <!-- Resize -->
    <div class="flex flex-col gap-2">
      <span class="text-xs font-medium text-slate-600">リサイズ</span>
      <label class="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" bind:checked={noResize} class="accent-teal-600" />
        リサイズしない（元のサイズを維持）
      </label>
      <div class="flex items-center gap-2" class:opacity-40={noResize}>
        <input
          type="number"
          placeholder="幅 (px)"
          bind:value={width}
          disabled={noResize}
          min="1"
          class="w-24 rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
        <span class="text-slate-400">×</span>
        <input
          type="number"
          placeholder="高さ (px)"
          bind:value={height}
          disabled={noResize}
          min="1"
          class="w-24 rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>
      <label
        class="flex items-center gap-2 text-sm text-slate-700"
        class:opacity-40={noResize}
      >
        <input
          type="checkbox"
          bind:checked={keepAspectRatio}
          disabled={noResize}
          class="accent-teal-600"
        />
        アスペクト比を固定
      </label>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/ImageSettings.svelte
git commit -m "feat: add ImageSettings component for format/quality/resize controls"
```

---

## Task 6: ImageComparison.svelte

**Files:**
- Create: `src/lib/components/ImageComparison.svelte`

- [ ] **Step 1: Create ImageComparison.svelte**

```svelte
<script lang="ts">
  import type { ConvertResult } from '$lib/utils/imageProcessor'

  interface Props {
    result: ConvertResult
  }

  let { result }: Props = $props()

  let originalUrl = $state('')

  $effect(() => {
    const url = URL.createObjectURL(result.originalFile)
    originalUrl = url
    return () => URL.revokeObjectURL(url)
  })

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  }

  function download() {
    const a = document.createElement('a')
    a.href = result.objectUrl
    a.download = result.fileName
    a.click()
  }

  const reductionColor = $derived(
    result.reductionPercent > 0 ? 'text-green-600' : 'text-orange-500'
  )
</script>

<div class="rounded-xl border border-slate-200 bg-white p-4">
  <p class="mb-3 truncate text-sm font-medium text-slate-700">{result.originalFile.name}</p>

  <div class="grid grid-cols-2 gap-4">
    <div class="space-y-2">
      <p class="text-xs font-medium text-slate-500">変換前</p>
      {#if originalUrl}
        <img
          src={originalUrl}
          alt="変換前"
          class="h-36 w-full rounded-lg object-contain bg-slate-50"
        />
      {/if}
      <p class="text-xs text-slate-600">{formatSize(result.originalSize)}</p>
    </div>

    <div class="space-y-2">
      <p class="text-xs font-medium text-slate-500">変換後</p>
      <img
        src={result.objectUrl}
        alt="変換後"
        class="h-36 w-full rounded-lg object-contain bg-slate-50"
      />
      <p class="text-xs text-slate-600">
        {formatSize(result.convertedSize)}
        <span class="{reductionColor} font-medium">
          ({result.reductionPercent > 0 ? '-' : '+'}{Math.abs(result.reductionPercent)}%)
        </span>
      </p>
    </div>
  </div>

  <button
    onclick={download}
    class="mt-3 w-full rounded-lg bg-teal-600 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors"
  >
    {result.fileName} をダウンロード
  </button>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/ImageComparison.svelte
git commit -m "feat: add ImageComparison component for before/after preview"
```

---

## Task 7: image-tools/+page.ts (SEO metadata)

**Files:**
- Create: `src/routes/image-tools/+page.ts`

- [ ] **Step 1: Create +page.ts**

```typescript
export function load() {
  return {
    title: '画像圧縮・リサイズ・形式変換 - 無料オンラインツール',
    description:
      'JPG・PNG・WebP画像をブラウザ上で圧縮・リサイズ・形式変換できる無料ツールです。ファイルはサーバーに送信されず、すべてお使いのデバイス内で処理されます。',
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/image-tools/+page.ts
git commit -m "feat: add SEO metadata load function for image-tools main page"
```

---

## Task 8: image-tools/+page.svelte (main page)

**Files:**
- Create: `src/routes/image-tools/+page.svelte`

- [ ] **Step 1: Create +page.svelte**

```svelte
<script lang="ts">
  import type { PageData } from './$types'
  import ImageUploader from '$lib/components/ImageUploader.svelte'
  import ImageSettings from '$lib/components/ImageSettings.svelte'
  import ImageComparison from '$lib/components/ImageComparison.svelte'
  import { convertImage, type OutputFormat, type ConvertResult } from '$lib/utils/imageProcessor'
  import { downloadAllAsZip } from '$lib/utils/zipDownload'

  let { data }: { data: PageData } = $props()

  let format = $state<OutputFormat>('image/jpeg')
  let quality = $state(80)
  let width = $state<number | undefined>(undefined)
  let height = $state<number | undefined>(undefined)
  let keepAspectRatio = $state(true)
  let noResize = $state(true)

  let files = $state<File[]>([])
  let results = $state<ConvertResult[]>([])
  let isProcessing = $state(false)
  let processError = $state('')

  function handleFiles(incoming: File[]) {
    files = incoming
    results.forEach((r) => URL.revokeObjectURL(r.objectUrl))
    results = []
    processError = ''
  }

  async function handleConvert() {
    if (files.length === 0) return
    isProcessing = true
    processError = ''
    results.forEach((r) => URL.revokeObjectURL(r.objectUrl))
    results = []
    try {
      const next: ConvertResult[] = []
      for (const file of files) {
        next.push(await convertImage(file, { format, quality, width, height, keepAspectRatio, noResize }))
      }
      results = next
    } catch (e) {
      processError = e instanceof Error ? e.message : '変換に失敗しました'
    } finally {
      isProcessing = false
    }
  }
</script>

<svelte:head>
  <title>{data.title}</title>
  <meta name="description" content={data.description} />
</svelte:head>

<div class="max-w-4xl mx-auto px-4 py-8 space-y-6">
  <!-- Ad slot top -->
  <div class="ad-slot ad-slot--top flex h-24 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">
    広告枠
  </div>

  <!-- Title -->
  <div>
    <h1 class="text-2xl font-bold text-slate-800">{data.title}</h1>
    <p class="mt-1 text-sm text-slate-500">
      {data.description}
    </p>
  </div>

  <!-- Uploader -->
  <ImageUploader onfiles={handleFiles} />

  <!-- Settings + convert button -->
  {#if files.length > 0}
    <ImageSettings
      bind:format
      bind:quality
      bind:width
      bind:height
      bind:keepAspectRatio
      bind:noResize
    />

    <div class="flex items-center gap-3">
      <button
        onclick={handleConvert}
        disabled={isProcessing}
        class="rounded-lg bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50 transition-colors"
      >
        {#if isProcessing}
          変換中...
        {:else}
          変換する ({files.length}ファイル)
        {/if}
      </button>
      {#if isProcessing}
        <span class="text-sm text-slate-500 animate-pulse">処理中です。しばらくお待ちください…</span>
      {/if}
    </div>
  {/if}

  {#if processError}
    <p class="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{processError}</p>
  {/if}

  <!-- Results -->
  {#if results.length > 0}
    <div class="space-y-4">
      {#each results as result (result.fileName)}
        <ImageComparison {result} />
      {/each}
    </div>

    {#if results.length > 1}
      <button
        onclick={() => downloadAllAsZip(results)}
        class="w-full rounded-lg border border-teal-600 py-2.5 text-sm font-semibold text-teal-600 hover:bg-teal-50 transition-colors"
      >
        すべてZIPでダウンロード ({results.length}ファイル)
      </button>
    {/if}

    <!-- Ad slot after results -->
    <div class="ad-slot ad-slot--content flex h-24 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">
      広告枠
    </div>
  {/if}

  <!-- SEO text -->
  <section class="rounded-xl border border-slate-100 bg-white p-5">
    <h2 class="mb-2 text-base font-semibold text-slate-700">このツールについて</h2>
    <p class="text-sm leading-relaxed text-slate-600">
      画像圧縮・リサイズ・形式変換ツールは、JPEG・PNG・WebP・GIF形式の画像ファイルをブラウザ上で変換できる無料ツールです。
      変換処理はすべてお使いのデバイス内のブラウザで完結し、画像データがサーバーに送信されることはありません。
      複数ファイルを同時に処理でき、まとめてZIPでダウンロードすることも可能です。
      品質スライダーで圧縮率を細かく調整でき、幅・高さを指定してリサイズすることもできます。
      アスペクト比固定オプションをオンにすれば、縦横比を維持したままサイズ変更が行えます。
    </p>
    <p class="mt-2 text-sm text-slate-500">
      関連: <a href="/image-tools/png-to-jpg" class="text-teal-600 hover:underline">PNG→JPG変換</a> /
      <a href="/image-tools/jpg-to-webp" class="text-teal-600 hover:underline">JPG→WebP変換</a> /
      <a href="/image-tools/compress-image" class="text-teal-600 hover:underline">画像圧縮</a>
    </p>
  </section>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/image-tools/+page.svelte src/routes/image-tools/+page.ts
git commit -m "feat: add image-tools main page with full conversion UI"
```

---

## Task 9: Update site.ts navigation

**Files:**
- Modify: `src/lib/site.ts`

- [ ] **Step 1: Add image-tools to the tools array**

In `src/lib/site.ts`, add the following entry to the `tools` array (after the existing hepburn-converter entry):

```typescript
{
  href: "/image-tools",
  label: "画像変換(開発中)",
  description: "画像の圧縮・リサイズ・形式変換ツール",
},
```

The full `tools` array becomes:
```typescript
tools: [
  {
    href: "/bpm-tapper",
    label: "BPM Tapper",
    description: "タップしてBPMを計測するツール",
  },
  {
    href: "/hepburn-converter",
    label: "ヘボン式変換",
    description: "日本語をヘボン式ローマ字に変換するツール",
  },
  {
    href: "/image-tools",
    label: "画像変換(開発中)",
    description: "画像の圧縮・リサイズ・形式変換ツール",
  },
],
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/site.ts
git commit -m "feat: add image-tools to site navigation"
```

---

## Task 10: SEO landing pages

**Files:**
- Create: `src/routes/image-tools/png-to-jpg/+page.ts`
- Create: `src/routes/image-tools/png-to-jpg/+page.svelte`
- Create: `src/routes/image-tools/jpg-to-webp/+page.ts`
- Create: `src/routes/image-tools/jpg-to-webp/+page.svelte`
- Create: `src/routes/image-tools/compress-image/+page.ts`
- Create: `src/routes/image-tools/compress-image/+page.svelte`

- [ ] **Step 1: Create png-to-jpg/+page.ts**

```typescript
export function load() {
  return {
    title: 'PNGをJPGに変換 - 無料オンラインツール',
    description:
      'PNG画像をJPG(JPEG)形式に変換できる無料のオンラインツール。品質やサイズも自由に調整できます。ファイルはサーバーに送信されません。',
    defaultFormat: 'image/jpeg' as const,
    seoText: `PNGをJPGに変換するツールは、透過を含まないPNG画像をJPEG形式に変換したいときに便利です。
JPEGは写真や複雑な色彩の画像に適しており、PNGより大幅にファイルサイズを削減できます。
品質スライダーで圧縮率を調整でき、80前後が品質とサイズのバランスに優れています。
処理はすべてブラウザ内で完結するため、画像データがサーバーに送信されることはありません。`,
  }
}
```

- [ ] **Step 2: Create png-to-jpg/+page.svelte**

```svelte
<script lang="ts">
  import type { PageData } from './$types'
  import ImageUploader from '$lib/components/ImageUploader.svelte'
  import ImageSettings from '$lib/components/ImageSettings.svelte'
  import ImageComparison from '$lib/components/ImageComparison.svelte'
  import { convertImage, type OutputFormat, type ConvertResult } from '$lib/utils/imageProcessor'
  import { downloadAllAsZip } from '$lib/utils/zipDownload'

  let { data }: { data: PageData } = $props()

  let format = $state<OutputFormat>(data.defaultFormat)
  let quality = $state(80)
  let width = $state<number | undefined>(undefined)
  let height = $state<number | undefined>(undefined)
  let keepAspectRatio = $state(true)
  let noResize = $state(true)

  let files = $state<File[]>([])
  let results = $state<ConvertResult[]>([])
  let isProcessing = $state(false)
  let processError = $state('')

  function handleFiles(incoming: File[]) {
    files = incoming
    results.forEach((r) => URL.revokeObjectURL(r.objectUrl))
    results = []
    processError = ''
  }

  async function handleConvert() {
    if (files.length === 0) return
    isProcessing = true
    processError = ''
    results.forEach((r) => URL.revokeObjectURL(r.objectUrl))
    results = []
    try {
      const next: ConvertResult[] = []
      for (const file of files) {
        next.push(await convertImage(file, { format, quality, width, height, keepAspectRatio, noResize }))
      }
      results = next
    } catch (e) {
      processError = e instanceof Error ? e.message : '変換に失敗しました'
    } finally {
      isProcessing = false
    }
  }
</script>

<svelte:head>
  <title>{data.title}</title>
  <meta name="description" content={data.description} />
</svelte:head>

<div class="max-w-4xl mx-auto px-4 py-8 space-y-6">
  <div class="ad-slot ad-slot--top flex h-24 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">
    広告枠
  </div>

  <div>
    <h1 class="text-2xl font-bold text-slate-800">{data.title}</h1>
    <p class="mt-1 text-sm text-slate-500">{data.description}</p>
  </div>

  <ImageUploader onfiles={handleFiles} />

  {#if files.length > 0}
    <ImageSettings bind:format bind:quality bind:width bind:height bind:keepAspectRatio bind:noResize />
    <div class="flex items-center gap-3">
      <button
        onclick={handleConvert}
        disabled={isProcessing}
        class="rounded-lg bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50 transition-colors"
      >
        {isProcessing ? '変換中...' : `変換する (${files.length}ファイル)`}
      </button>
      {#if isProcessing}
        <span class="text-sm text-slate-500 animate-pulse">処理中です…</span>
      {/if}
    </div>
  {/if}

  {#if processError}
    <p class="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{processError}</p>
  {/if}

  {#if results.length > 0}
    <div class="space-y-4">
      {#each results as result (result.fileName)}
        <ImageComparison {result} />
      {/each}
    </div>
    {#if results.length > 1}
      <button
        onclick={() => downloadAllAsZip(results)}
        class="w-full rounded-lg border border-teal-600 py-2.5 text-sm font-semibold text-teal-600 hover:bg-teal-50 transition-colors"
      >
        すべてZIPでダウンロード
      </button>
    {/if}
    <div class="ad-slot ad-slot--content flex h-24 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">
      広告枠
    </div>
  {/if}

  <section class="rounded-xl border border-slate-100 bg-white p-5">
    <h2 class="mb-2 text-base font-semibold text-slate-700">PNGをJPGに変換する方法</h2>
    <p class="text-sm leading-relaxed text-slate-600 whitespace-pre-line">{data.seoText}</p>
    <p class="mt-2 text-sm text-slate-500">
      <a href="/image-tools" class="text-teal-600 hover:underline">汎用画像変換ツールはこちら</a>
    </p>
  </section>
</div>
```

- [ ] **Step 3: Create jpg-to-webp/+page.ts**

```typescript
export function load() {
  return {
    title: 'JPGをWebPに変換 - 無料オンラインツール',
    description:
      'JPEG画像をWebP形式に変換できる無料のオンラインツール。WebPはJPEGより高圧縮で画質を維持できます。ファイルはサーバーに送信されません。',
    defaultFormat: 'image/webp' as const,
    seoText: `WebPはGoogleが開発した次世代画像形式で、同等の画質を保ちながらJPEGよりも25〜35%程度ファイルサイズを削減できます。
ウェブページの表示速度改善やCore Web Vitals対策に効果的です。
主要なブラウザはすべてWebPに対応しており、ウェブ用の画像はWebPへの変換が推奨されています。
このツールではJPGをWebPに変換しながら、品質やサイズを自由に調整することができます。`,
  }
}
```

- [ ] **Step 4: Create jpg-to-webp/+page.svelte**

`jpg-to-webp/+page.svelte` は `png-to-jpg/+page.svelte` と同一の構造です。ファイルを丸ごとコピーして `src/routes/image-tools/jpg-to-webp/+page.svelte` に保存してください（内容を変える必要はありません — `data.defaultFormat` と `data.title` はページの `load()` から来ます）。

- [ ] **Step 5: Create compress-image/+page.ts**

```typescript
export function load() {
  return {
    title: '画像を圧縮 - 無料オンラインツール',
    description:
      'JPG・PNG・WebP画像のファイルサイズをブラウザ上で圧縮できる無料ツール。品質スライダーで圧縮率を自由に調整できます。',
    defaultFormat: 'image/jpeg' as const,
    seoText: `画像圧縮ツールを使うと、ウェブサイトやSNSにアップロードするための軽量な画像を手軽に作成できます。
品質スライダーを下げるほどファイルサイズは小さくなりますが、画質も低下します。一般的には70〜85の範囲が品質とサイズのバランスに優れています。
PNG形式は可逆圧縮のため、JPEGやWebPと比べてファイルサイズが大きくなりがちです。写真の圧縮にはJPEGまたはWebPが適しています。
処理はすべてブラウザ内で完結し、画像データがサーバーに送信されることはありません。`,
  }
}
```

- [ ] **Step 6: Create compress-image/+page.svelte**

`compress-image/+page.svelte` も `png-to-jpg/+page.svelte` と同一の構造で構いません。ファイルをコピーして `src/routes/image-tools/compress-image/+page.svelte` に保存してください。

- [ ] **Step 7: Commit**

```bash
git add src/routes/image-tools/png-to-jpg/ src/routes/image-tools/jpg-to-webp/ src/routes/image-tools/compress-image/
git commit -m "feat: add SEO landing pages for png-to-jpg, jpg-to-webp, compress-image"
```

---

## Task 11: Build verification

**Files:** none (verification only)

- [ ] **Step 1: Run tests**

```bash
npm test
```
Expected: all tests PASS (including the 13 imageProcessor tests from Task 2)

- [ ] **Step 2: Run build**

```bash
npm run build
```
Expected: exits 0, no TypeScript errors, no Svelte component errors

- [ ] **Step 3: Start dev server**

```bash
npm run dev
```
Open `http://localhost:5173`

- [ ] **Step 4: Manual smoke test**

Check each of these in the browser:
1. **Navigation**: "画像変換(開発中)" link appears in the top nav
2. **Main page** (`/image-tools`): drag or select a JPEG/PNG image → Settings panel appears → click "変換する" → comparison card shows before/after with file sizes → download button works
3. **Multiple files**: select 2+ images → convert → ZIP download button appears and produces a valid ZIP
4. **PNG quality slider**: select PNG format → quality slider is greyed out
5. **No resize option**: uncheck "リサイズしない" → width/height inputs enable
6. **Error handling**: drop a `.pdf` file → error message appears
7. **Landing pages** (`/image-tools/png-to-jpg`, `/image-tools/jpg-to-webp`, `/image-tools/compress-image`): each loads with correct title, default format pre-selected
8. **Mobile layout**: narrow the window to ~375px → settings grid stacks to 1 column, no overflow

If any check fails, fix before marking complete.
