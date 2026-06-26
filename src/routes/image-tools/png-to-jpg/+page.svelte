<script lang="ts">
  import type { PageData } from './$types'
  import ImageUploader from '$lib/components/image/ImageUploader.svelte'
  import ImageSettings from '$lib/components/image/ImageSettings.svelte'
  import ImageComparison from '$lib/components/image/ImageComparison.svelte'
  import { convertImage, type OutputFormat, type ConvertResult } from '$lib/image/utils/imageProcessor'
  import { downloadAllAsZip } from '$lib/image/utils/zipDownload'

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
        next.push(
          await convertImage(file, { format, quality, width, height, keepAspectRatio, noResize })
        )
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
  <div
    class="ad-slot ad-slot--top flex h-24 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400"
  >
    広告枠
  </div>

  <div>
    <h1 class="text-2xl font-bold text-slate-800">{data.title}</h1>
    <p class="mt-1 text-sm text-slate-500">{data.description}</p>
  </div>

  <ImageUploader onfiles={handleFiles} />

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
        すべてZIPでダウンロード ({results.length}ファイル)
      </button>
    {/if}
    <div
      class="ad-slot ad-slot--content flex h-24 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400"
    >
      広告枠
    </div>
  {/if}

  <section class="rounded-xl border border-slate-100 bg-white p-5">
    <h2 class="mb-2 text-base font-semibold text-slate-700">PNGをJPGに変換する方法</h2>
    <p class="text-sm leading-relaxed text-slate-600">{data.seoText}</p>
    <p class="mt-2 text-sm text-slate-500">
      <a href="/image-tools" class="text-teal-600 hover:underline">汎用画像変換ツールはこちら</a>
    </p>
  </section>
</div>
