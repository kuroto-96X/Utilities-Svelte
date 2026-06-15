<!-- src/lib/components/CropEditor.svelte -->
<script lang="ts">
  import Cropper from 'svelte-easy-crop'
  import type { SnsPreset } from '$lib/data/snsPresets'
  import type { PixelCrop } from '$lib/utils/cropToBlob'
  import type { OnCropCompleteEvent } from 'svelte-easy-crop'

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
