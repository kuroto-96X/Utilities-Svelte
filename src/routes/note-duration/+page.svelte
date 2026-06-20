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
  <title>BPM Note Duration Calculator</title>
  <meta name="description" content="BPMを入力するだけで、全音符から32分音符までの長さを秒・msで自動計算。付点・3連符にも対応した楽曲制作向けツール。" />
</svelte:head>

<div class="max-w-lg mx-auto px-4 py-6 space-y-4">
  <div>
    <h1 class="text-2xl font-bold text-slate-800">BPM Note Duration Calculator</h1>
    <p class="mt-1 text-sm text-slate-500">BPMを入力すると、32分音符から全音符までの長さを表示します。</p>
  </div>

  <BpmInput bind:bpm />

  <NoteDurationTable {durations} />

  <!-- 画面説明 -->
  <div class="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3 text-sm text-slate-600">
    <h2 class="font-semibold text-slate-700">使い方</h2>
    <p>BPM（Beats Per Minute）を入力すると、各音符の長さを秒・ミリ秒で自動計算します。DAW での遅延設定やシンセのエンベロープ調整など、楽曲制作に役立ててください。</p>
    <h2 class="font-semibold text-slate-700">表の見かた</h2>
    <ul class="space-y-1 list-disc list-inside">
      <li><span class="font-medium">通常</span>：基本の音符長さ</li>
      <li><span class="font-medium">付点</span>：音符の長さ × 1.5倍</li>
      <li><span class="font-medium">3連符</span>：音符の長さ × 2/3倍</li>
    </ul>
  </div>
</div>
