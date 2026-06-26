<!-- src/lib/components/CropEditorWithGuide.svelte -->
<script lang="ts">
  import Cropper from 'svelte-easy-crop'
  import type { IdPhotoPreset } from '$lib/image/data/idPhotoPresets'
  import type { PixelCrop } from '$lib/image/utils/cropToBlob'
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
