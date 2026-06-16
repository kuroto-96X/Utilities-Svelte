<script lang="ts">
  import { page } from '$app/state'
  import { calculateNoteDurations, clampBpm, DEFAULT_BPM } from '$lib/noteDuration'
  import BpmInput from '$lib/components/BpmInput.svelte'
  import NoteDurationTable from '$lib/components/NoteDurationTable.svelte'

  let bpm = $state(DEFAULT_BPM)

  $effect(() => {
    const p = page.url.searchParams.get('bpm')
    if (!p) return
    const n = parseFloat(p)
    if (!Number.isNaN(n)) bpm = clampBpm(n)
  })

  const durations = $derived(calculateNoteDurations(bpm))
</script>

<svelte:head>
  <title>BPM音符換算ツール｜32分音符〜全音符の秒数を計算</title>
  <meta name="description" content="BPMを入力するだけで、全音符から32分音符までの長さを秒・msで自動計算。付点・3連符にも対応した楽曲制作向けツール。" />
</svelte:head>

<div class="max-w-lg mx-auto px-4 py-6 space-y-4">
  <!-- 広告枠 top -->
  <div class="ad-slot ad-slot--top flex h-24 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">
    広告枠
  </div>

  <div>
    <h1 class="text-2xl font-bold text-slate-800">BPM音符換算ツール</h1>
    <p class="mt-1 text-sm text-slate-500">BPMを入力すると、32分音符から全音符までの長さを表示します。</p>
  </div>

  <BpmInput bind:bpm />

  <!-- 広告枠 in-content -->
  <div class="ad-slot ad-slot--in-content flex h-24 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">
    広告枠
  </div>

  <NoteDurationTable {durations} />
</div>
