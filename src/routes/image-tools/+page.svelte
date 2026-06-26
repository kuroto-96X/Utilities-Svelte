<script lang="ts">
  import type { PageData } from './$types'
  import ImageUploader from '$lib/components/ImageUploader.svelte'
  import ImageSettings from '$lib/components/ImageSettings.svelte'
  import ImageComparison from '$lib/components/ImageComparison.svelte'
  import { convertImage, type OutputFormat, type ConvertResult } from '$lib/image/utils/imageProcessor'
  import { downloadAllAsZip } from '$lib/image/utils/zipDownload'

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
  <!-- Ad slot top -->
  <div
    class="ad-slot ad-slot--top flex h-24 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400"
  >
    広告枠
  </div>

  <!-- Title -->
  <div>
    <h1 class="text-2xl font-bold text-slate-800">{data.title}</h1>
    <p class="mt-1 text-sm text-slate-500">{data.description}</p>
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
    <div
      class="ad-slot ad-slot--content flex h-24 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400"
    >
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
      関連:
      <a href="/image-tools/png-to-jpg" class="text-teal-600 hover:underline">PNG→JPG変換</a> /
      <a href="/image-tools/jpg-to-webp" class="text-teal-600 hover:underline">JPG→WebP変換</a> /
      <a href="/image-tools/compress-image" class="text-teal-600 hover:underline">画像圧縮</a>
    </p>
  </section>
</div>
