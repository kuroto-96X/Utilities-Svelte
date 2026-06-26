<script lang="ts">
  import type { OutputFormat } from '$lib/image/utils/imageProcessor'

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
