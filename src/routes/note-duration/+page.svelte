<script lang="ts">
  import { page } from '$app/state'
  import { calculateNoteDurations, clampBpm, DEFAULT_BPM } from '$lib/noteDuration'
  import BpmInput from '$lib/components/BpmInput.svelte'
  import NoteDurationTable from '$lib/components/NoteDurationTable.svelte'
  import NoteReverseSearch from '$lib/components/NoteReverseSearch.svelte'

  let bpm = $state(DEFAULT_BPM)
  let activeTab = $state<'bpm' | 'reverse'>('bpm')
  let reverseMs = $state('')

  $effect(() => {
    const p = page.url.searchParams.get('bpm')
    if (!p) return
    const n = parseFloat(p)
    if (!Number.isNaN(n)) bpm = clampBpm(n)
  })

  const durations = $derived(calculateNoteDurations(bpm))

  const pageTitle = $derived(
    activeTab === 'reverse'
      ? reverseMs
        ? `${reverseMs}ms → 音符 | Note Duration – 96X's Tools`
        : `ms → 音符 | Note Duration – 96X's Tools`
      : `BPM ${bpm} | Note Duration – 96X's Tools`
  )
</script>

<svelte:head>
  <title>{pageTitle}</title>
  <meta name="description" content="BPMを入力するだけで、全音符から32分音符までの長さを秒・msで自動計算。付点・3連符にも対応した楽曲制作向けツール。" />
</svelte:head>

<div class="max-w-lg mx-auto px-4 py-6 space-y-4">
  <!-- タブ切り替え -->
  <div class="flex gap-2">
    <button
      onclick={() => activeTab = 'bpm'}
      class="rounded-full px-5 py-1.5 text-sm font-medium {activeTab === 'bpm' ? 'bg-teal-600 text-white' : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'}"
    >
      BPM → 音符長
    </button>
    <button
      onclick={() => activeTab = 'reverse'}
      class="rounded-full px-5 py-1.5 text-sm font-medium {activeTab === 'reverse' ? 'bg-teal-600 text-white' : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'}"
    >
      ms → 音符
    </button>
  </div>

  <div>
    <h1 class="text-2xl font-bold text-slate-800">Note Duration</h1>
    <p class="mt-1 text-sm text-slate-500">BPMを入力すると、32分音符から全音符までの長さを表示します。</p>
  </div>

  {#if activeTab === 'bpm'}
    <BpmInput bind:bpm />

    <NoteDurationTable {durations} />

    <!-- 画面説明 -->
    <div class="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3 text-sm text-slate-600">
      <h2 class="font-semibold text-slate-700">使い方</h2>
      <p>BPM（Beats Per Minute）を入力すると、各音符の長さをミリ秒・Hzで自動計算します。DAW での遅延設定やシンセのエンベロープ調整など、楽曲制作に役立ててください。セルをクリックすると数値をコピーできます。</p>
      <h2 class="font-semibold text-slate-700">計算式</h2>
      <div class="space-y-1 font-mono text-xs bg-white border border-slate-200 rounded p-3">
        <p>1拍（4分音符） = 60 ÷ BPM （秒）</p>
        <p>各音符 = 1拍 × 倍率</p>
        <div class="pl-4 text-slate-400 space-y-0.5 mt-1">
          <p>全音符 ×4　2分音符 ×2　4分音符 ×1</p>
          <p>8分音符 ×½　16分音符 ×¼　32分音符 ×⅛　64分音符 ×1/16</p>
        </div>
        <p class="mt-1">付点 = 基本値 × 1.5</p>
        <p>3連符 = 基本値 × 2/3</p>
        <p class="mt-1">Hz = 1 ÷ 秒数</p>
      </div>
      <h2 class="font-semibold text-slate-700">表の見かた</h2>
      <ul class="space-y-1 list-disc list-inside">
        <li><span class="font-medium">通常</span>：基本の音符長さ</li>
        <li><span class="font-medium">付点</span>：音符の長さ × 1.5倍</li>
        <li><span class="font-medium">3連符</span>：音符の長さ × 2/3倍</li>
      </ul>
    </div>
  {:else}
    <NoteReverseSearch bind:currentMs={reverseMs} />
  {/if}
</div>
