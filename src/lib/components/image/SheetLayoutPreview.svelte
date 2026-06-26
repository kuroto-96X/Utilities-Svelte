<!-- src/lib/components/SheetLayoutPreview.svelte -->
<script lang="ts">
  import type { IdPhotoPreset } from '$lib/image/data/idPhotoPresets'
  import type { PrintSheetSize } from '$lib/image/data/printSheetSizes'
  import type { PixelCrop } from '$lib/image/utils/cropToBlob'
  import { printSheetSizes } from '$lib/image/data/printSheetSizes'
  import { mmToPx } from '$lib/image/utils/mmToPx'

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
