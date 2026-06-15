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
