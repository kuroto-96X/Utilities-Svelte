<script lang="ts">
  import type { ConvertResult } from '$lib/image/utils/imageProcessor'

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
