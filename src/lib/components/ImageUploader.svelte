<script lang="ts">
  import { isSupported } from '$lib/image/utils/imageProcessor'

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
