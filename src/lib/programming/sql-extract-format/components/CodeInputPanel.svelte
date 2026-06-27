<script lang="ts">
  import type { SourceLanguage } from '../types'
  import { ALL_LANGUAGE_OPTIONS } from '../extractors/index'

  let {
    code = $bindable(''),
    language = $bindable<SourceLanguage>('csharp'),
  } = $props()
</script>

<div class="flex flex-col gap-3">
  <div class="flex items-center gap-3">
    <label class="text-sm font-medium text-gray-700 shrink-0">言語</label>
    <select
      class="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white"
      bind:value={language}
    >
      {#each ALL_LANGUAGE_OPTIONS as opt (opt.value)}
        <option value={opt.value} disabled={!opt.supported}>
          {opt.label}{opt.supported ? '' : '（準備中）'}
        </option>
      {/each}
    </select>
  </div>

  <textarea
    class="w-full h-56 border border-gray-300 rounded-xl px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-teal-300"
    placeholder="コードを貼り付け"
    bind:value={code}
  ></textarea>
</div>
