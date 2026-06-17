<!-- src/lib/components/MelodyGenerator.svelte -->
<script lang="ts">
  import { calculateNoteDurations } from '$lib/noteDuration';
  import { NOTE_NAMES } from '$lib/scaleData';
  import { getAudioContext, playNoteAt } from '$lib/audioEngine';

  let {
    intervals,
    rootPc,
    bpm,
    addPlayingPc,
    removePlayingPc,
  }: {
    intervals: number[];
    rootPc: number;
    bpm: number;
    addPlayingPc: (pc: number) => void;
    removePlayingPc: (pc: number) => void;
  } = $props();

  const NOTE_LABELS = ['32分', '16分', '8分', '4分', '2分', '全'];
  const BARS_OPTIONS = [1, 2, 4, 8];

  let bars = $state(2);
  let minNoteIdx = $state(1); // 16分音符
  let maxNoteIdx = $state(3); // 4分音符
  let useDotted = $state(false);
  let useTriplet = $state(false);
  let isPlaying = $state(false);

  interface MelodyNote { interval: number; pc: number; duration: number; }
  let cachedMelody = $state<MelodyNote[] | null>(null);

  function buildDurationPool(): number[] {
    const noteDurations = calculateNoteDurations(bpm);
    const ascDurations = [...noteDurations].reverse(); // index0=32分, index5=全音符
    const slice = ascDurations.slice(minNoteIdx, maxNoteIdx + 1);
    const pool: number[] = [];
    slice.forEach(nv => {
      pool.push(nv.normalSec);
      if (useDotted) pool.push(nv.dottedSec);
      if (useTriplet) pool.push(nv.tripletSec);
    });
    return pool.length > 0 ? pool : [ascDurations[2].normalSec];
  }

  function generateMelody(): MelodyNote[] {
    const pool = buildDurationPool();
    const secPerBeat = 60 / bpm;
    const targetSeconds = Math.max(secPerBeat, bars * 4 * secPerBeat - secPerBeat);
    const seq: MelodyNote[] = [];
    let cumulative = 0;
    let guard = 0;
    while (cumulative < targetSeconds && guard < 300) {
      guard++;
      const deg = intervals[Math.floor(Math.random() * intervals.length)];
      const octShift = Math.random() < 0.25 ? 12 : 0;
      const duration = pool[Math.floor(Math.random() * pool.length)];
      const pc = (rootPc + deg) % 12;
      seq.push({ interval: deg + octShift, pc, duration });
      cumulative += duration;
    }
    seq.push({ interval: 0, pc: rootPc % 12, duration: secPerBeat });
    return seq;
  }

  function playMelodySeq(seq: MelodyNote[]) {
    if (isPlaying) return;
    isPlaying = true;
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    let startTime = now;
    let totalDuration = 0;
    seq.forEach(note => {
      const midi = 60 + rootPc + note.interval;
      const pc = note.pc;
      const dur = note.duration * 0.9;
      playNoteAt(ctx, midi, dur, startTime);
      const t = (startTime - now) * 1000;
      setTimeout(() => addPlayingPc(pc), t);
      setTimeout(() => removePlayingPc(pc), t + dur * 1000);
      startTime += note.duration;
      totalDuration += note.duration;
    });
    setTimeout(() => { isPlaying = false; }, totalDuration * 1000 + 200);
  }

  function handleGenerate() {
    const seq = generateMelody();
    cachedMelody = seq;
    playMelodySeq(seq);
  }

  function handleReplay() {
    if (cachedMelody) playMelodySeq(cachedMelody);
  }

  const minLabel = $derived(NOTE_LABELS[minNoteIdx]);
  const maxLabel = $derived(NOTE_LABELS[maxNoteIdx]);
</script>

<div class="border border-gray-700 rounded-lg p-3 space-y-3">
  <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide">ランダムメロディ生成</p>

  <!-- 設定行 -->
  <div class="flex flex-wrap gap-3 items-center">
    <!-- 小節数 -->
    <div class="flex items-center gap-1">
      <span class="text-xs text-gray-400">小節数</span>
      <div class="flex gap-1">
        {#each BARS_OPTIONS as b}
          <button
            class="px-2 py-0.5 text-xs rounded
              {bars === b ? 'bg-teal-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}"
            onclick={() => (bars = b)}
          >{b}</button>
        {/each}
      </div>
    </div>

    <!-- 音符範囲 -->
    <div class="flex items-center gap-2">
      <span class="text-xs text-gray-400">最短</span>
      <input
        type="range" min={0} max={maxNoteIdx} value={minNoteIdx}
        oninput={(e) => (minNoteIdx = Number((e.target as HTMLInputElement).value))}
        class="w-20 h-1.5 rounded-full appearance-none cursor-pointer bg-gray-600"
      />
      <span class="text-xs text-gray-300 w-6">{minLabel}</span>
      <span class="text-xs text-gray-400">最長</span>
      <input
        type="range" min={minNoteIdx} max={5} value={maxNoteIdx}
        oninput={(e) => (maxNoteIdx = Number((e.target as HTMLInputElement).value))}
        class="w-20 h-1.5 rounded-full appearance-none cursor-pointer bg-gray-600"
      />
      <span class="text-xs text-gray-300 w-6">{maxLabel}</span>
    </div>

    <!-- 付点/3連 -->
    <div class="flex gap-2 text-xs">
      <label class="flex items-center gap-1 text-gray-300 cursor-pointer">
        <input type="checkbox" bind:checked={useDotted} class="accent-teal-500" />
        付点
      </label>
      <label class="flex items-center gap-1 text-gray-300 cursor-pointer">
        <input type="checkbox" bind:checked={useTriplet} class="accent-teal-500" />
        3連符
      </label>
    </div>
  </div>

  <!-- 操作ボタン -->
  <div class="flex gap-2">
    <button
      class="px-3 py-1.5 text-sm rounded bg-teal-600 hover:bg-teal-500 text-white disabled:opacity-50"
      onclick={handleGenerate}
      disabled={isPlaying}
    >
      🎲 生成 & 再生
    </button>
    {#if cachedMelody}
      <button
        class="px-3 py-1.5 text-sm rounded bg-gray-700 hover:bg-gray-600 text-gray-200 disabled:opacity-50"
        onclick={handleReplay}
        disabled={isPlaying}
      >
        ▶ 再生
      </button>
    {/if}
  </div>

  <!-- 生成結果チップ -->
  {#if cachedMelody}
    <div class="flex flex-wrap gap-1">
      {#each cachedMelody as note, i}
        <span class="px-1.5 py-0.5 text-xs rounded bg-gray-700 text-gray-300 font-mono">
          {NOTE_NAMES[note.pc]}{i === cachedMelody.length - 1 ? ' 🏠' : ''}
        </span>
      {/each}
    </div>
  {/if}
</div>
