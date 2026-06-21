<script lang="ts">
  import { browser } from '$app/environment'
  import { findNearestNotes, NOTE_SYMBOLS } from '$lib/noteDuration'
  import type { NoteMatch } from '$lib/noteDuration'
  import RangeSlider from '$lib/components/RangeSlider.svelte'
  import NoteIcon from '$lib/components/NoteIcon.svelte'

  const STORAGE_KEY = 'note-reverse-search'

  function loadPrefs(): Record<string, unknown> {
    if (!browser) return {}
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : {}
    } catch {
      return {}
    }
  }

  const prefs = loadPrefs()

  let targetMs = $state<string>((prefs.targetMs as string) ?? '1000')
  let bpmMin = $state<number>((prefs.bpmMin as number) ?? 20)
  let bpmMax = $state<number>((prefs.bpmMax as number) ?? 300)
  let includeDotted = $state<boolean>((prefs.includeDotted as boolean) ?? true)
  let includeTriplet = $state<boolean>((prefs.includeTriplet as boolean) ?? false)
  let mode = $state<'topN' | 'tolerance'>((prefs.mode as 'topN' | 'tolerance') ?? 'topN')
  let topN = $state<number>((prefs.topN as number) ?? 10)
  let tolerancePct = $state<number>((prefs.tolerancePct as number) ?? 5)

  $effect(() => {
    if (!browser) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      targetMs, bpmMin, bpmMax, includeDotted, includeTriplet, mode, topN, tolerancePct,
    }))
  })

  const results = $derived.by((): NoteMatch[] => {
    const ms = parseFloat(targetMs)
    if (!isFinite(ms) || ms <= 0) return []
    return findNearestNotes(ms, {
      bpmMin,
      bpmMax,
      includeDotted,
      includeTriplet,
      mode,
      topN,
      tolerancePct,
    })
  })

  const isValidInput = $derived.by(() => {
    const ms = parseFloat(targetMs)
    return isFinite(ms) && ms > 0
  })

  function formatDiff(diffMs: number, durationMs: number): string {
    if (diffMs < 0.05) return '0.0ms'
    const ms = parseFloat(targetMs)
    const sign = durationMs >= ms ? '+' : '−'
    return `${sign}${diffMs.toFixed(1)}ms`
  }

  function formatDuration(durationMs: number): string {
    return `${durationMs.toFixed(1)}ms`
  }
</script>

<div class="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
  <!-- ms input -->
  <div class="flex items-center gap-3">
    <label for="target-ms" class="text-sm font-medium text-slate-600 whitespace-nowrap">ms入力:</label>
    <div class="flex items-center gap-2">
      <input
        id="target-ms"
        type="number"
        min="0"
        step="0.1"
        placeholder="1000"
        bind:value={targetMs}
        class="w-40 text-2xl font-semibold text-center border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent text-slate-800 tabular-nums"
      />
      <span class="text-lg font-medium text-slate-500">ms</span>
    </div>
  </div>

  <!-- BPM range -->
  <div class="flex items-center gap-2">
    <span class="text-sm font-medium text-slate-600 whitespace-nowrap">BPM範囲:</span>
    <RangeSlider min={20} max={300} bind:low={bpmMin} bind:high={bpmMax} showLabels={false} />
    <span class="text-sm font-mono text-slate-700 whitespace-nowrap">{bpmMin} ~ {bpmMax}</span>
  </div>

  <!-- Checkboxes -->
  <div class="flex items-center gap-5">
    <span class="text-sm font-medium text-slate-600 whitespace-nowrap">含める音符:</span>
    <label class="flex items-center gap-1.5 cursor-pointer select-none">
      <input
        type="checkbox"
        bind:checked={includeDotted}
        class="w-4 h-4 accent-teal-500 cursor-pointer"
      />
      <span class="text-sm text-slate-700">付点</span>
    </label>
    <label class="flex items-center gap-1.5 cursor-pointer select-none">
      <input
        type="checkbox"
        bind:checked={includeTriplet}
        class="w-4 h-4 accent-teal-500 cursor-pointer"
      />
      <span class="text-sm text-slate-700">3連符</span>
    </label>
  </div>

  <!-- Mode radios -->
  <div class="flex flex-wrap items-center gap-4">
    <span class="text-sm font-medium text-slate-600 whitespace-nowrap">表示方法:</span>
    <label class="flex items-center gap-1.5 cursor-pointer select-none">
      <input
        type="radio"
        name="mode"
        value="topN"
        bind:group={mode}
        class="w-4 h-4 accent-teal-500 cursor-pointer"
      />
      <span class="text-sm text-slate-700">上位</span>
      <input
        type="number"
        min="1"
        max="50"
        bind:value={topN}
        disabled={mode !== 'topN'}
        class="w-16 text-sm text-center border border-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent text-slate-800 tabular-nums disabled:opacity-40 disabled:cursor-not-allowed"
      />
      <span class="text-sm text-slate-700">件</span>
    </label>
    <label class="flex items-center gap-1.5 cursor-pointer select-none">
      <input
        type="radio"
        name="mode"
        value="tolerance"
        bind:group={mode}
        class="w-4 h-4 accent-teal-500 cursor-pointer"
      />
      <span class="text-sm text-slate-700">誤差</span>
      <input
        type="number"
        min="0"
        max="100"
        step="0.1"
        bind:value={tolerancePct}
        disabled={mode !== 'tolerance'}
        class="w-16 text-sm text-center border border-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent text-slate-800 tabular-nums disabled:opacity-40 disabled:cursor-not-allowed"
      />
      <span class="text-sm text-slate-700">% 以内</span>
    </label>
  </div>

  <!-- Results -->
  {#if targetMs !== '' && isValidInput}
    <div class="border-t border-slate-200 pt-4">
      {#if results.length === 0}
        <p class="text-sm text-slate-500 text-center py-4">該当する音符が見つかりませんでした</p>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-slate-200">
                <th scope="col" class="py-2 pr-3 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">BPM</th>
                <th scope="col" class="py-2 px-2 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">音符名</th>
                <th scope="col" class="py-2 px-2 text-right text-xs font-semibold text-slate-500 whitespace-nowrap">実際のms</th>
                <th scope="col" class="py-2 pl-2 text-right text-xs font-semibold text-slate-500 whitespace-nowrap">差分</th>
              </tr>
            </thead>
            <tbody>
              {#each results as match (match.bpm + '-' + match.noteId + '-' + match.variant)}
                <tr class="border-b border-slate-100 odd:bg-slate-50 hover:bg-teal-50 transition-colors">
                  <td class="py-1.5 pr-3 font-mono font-semibold text-slate-800 whitespace-nowrap">{match.bpm}</td>
                  <td class="py-1.5 px-2 text-slate-700 whitespace-nowrap">
                    <div class="flex items-center gap-1">
                      <span class="text-slate-600 shrink-0">
                        <NoteIcon
                          filled={NOTE_SYMBOLS[match.noteId].filled}
                          stem={NOTE_SYMBOLS[match.noteId].stem}
                          flags={NOTE_SYMBOLS[match.noteId].flags}
                          size={16}
                        />
                      </span>
                      {match.label}
                    </div>
                  </td>
                  <td class="py-1.5 px-2 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">{formatDuration(match.durationMs)}</td>
                  <td class="py-1.5 pl-2 text-right font-mono tabular-nums whitespace-nowrap {match.diffMs < 0.05 ? 'text-teal-600 font-semibold' : 'text-slate-500'}">
                    {formatDiff(match.diffMs, match.durationMs)}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  {:else if targetMs !== ''}
    <div class="border-t border-slate-200 pt-4">
      <p class="text-sm text-slate-400 text-center py-4">0より大きい値を入力してください</p>
    </div>
  {/if}
</div>
