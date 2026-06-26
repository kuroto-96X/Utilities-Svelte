<!-- src/routes/image/id-photo/+page.svelte -->
<script lang="ts">
  import type { PageData } from './$types'
  import ImageUploader from '$lib/components/image/ImageUploader.svelte'
  import PresetSelector from '$lib/components/image/PresetSelector.svelte'
  import CropEditorWithGuide from '$lib/components/image/CropEditorWithGuide.svelte'
  import SheetLayoutPreview from '$lib/components/image/SheetLayoutPreview.svelte'
  import { idPhotoPresets, type IdPhotoPreset } from '$lib/image/data/idPhotoPresets'
  import { printSheetSizes, type PrintSheetSize } from '$lib/image/data/printSheetSizes'
  import { cropToBlob, type PixelCrop } from '$lib/image/utils/cropToBlob'
  import { compositeSheet } from '$lib/image/utils/sheetCompositor'
  import { mmToPx } from '$lib/image/utils/mmToPx'

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
        <p class="mt-0.5 text-sm font-semibold leading-tight text-slate-800">{preset.label}</p>
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
      <a href="/image/image-tools" class="text-teal-700 underline hover:text-teal-800">画像圧縮・変換ツール</a>
      <a href="/image/sns-image-resize" class="text-teal-700 underline hover:text-teal-800">SNS画像リサイズツール</a>
    </div>
  </section>
</div>
