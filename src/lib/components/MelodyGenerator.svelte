<!-- src/lib/components/MelodyGenerator.svelte -->
<script lang="ts">
  import { calculateNoteDurations } from '$lib/noteDuration';
  import { NOTE_NAMES } from '$lib/scaleData';
  import { getAudioContext, startNoteAt } from '$lib/audioEngine';

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
  let currentNoteIdx = $state<number | null>(null);

  interface MelodyNote { interval: number; pc: number; duration: number; }
  let cachedMelody = $state<MelodyNote[] | null>(null);

  interface RollNote { midi: number; pc: number; start: number; end: number; }
  const rollNotes = $derived.by((): RollNote[] | null => {
    if (!cachedMelody) return null;
    let cum = 0;
    return cachedMelody.map(note => {
      const start = cum;
      cum += note.duration;
      return {
        midi: 60 + rootPc + note.interval,
        pc: note.pc,
        start,
        end: cum,
      };
    });
  });

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
    currentNoteIdx = null;
    const ctx = getAudioContext();
    let activeStopFn: (() => void) | null = null;
    let activePc: number | null = null;
    let stepIdx = 0;

    function playNextNote() {
      activeStopFn?.();
      if (activePc !== null) removePlayingPc(activePc);
      activeStopFn = null;
      activePc = null;

      if (stepIdx >= seq.length) {
        isPlaying = false;
        currentNoteIdx = null;
        return;
      }

      currentNoteIdx = stepIdx;
      const note = seq[stepIdx];
      const midi = 60 + rootPc + note.interval;
      const pc = note.pc;

      const stopFn = startNoteAt(ctx, midi, ctx.currentTime);
      activeStopFn = stopFn;
      activePc = pc;
      addPlayingPc(pc);

      stepIdx++;
      setTimeout(playNextNote, note.duration * 1000);
    }

    playNextNote();
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

<div class="border border-gray-700 rounded-lg p-3">
  <div class="flex flex-col md:flex-row gap-4 items-start">

    <!-- 左列: タイトル・設定・ボタン・チップ -->
    <div class="flex-1 min-w-0 space-y-3">
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

      <!-- ボタン + ノートチップ（ボタン右に並ぶ） -->
      <div class="flex flex-wrap items-center gap-2">
        <button
          class="px-3 py-1.5 text-sm rounded bg-teal-600 hover:bg-teal-500 text-white disabled:opacity-50 flex-shrink-0"
          onclick={handleGenerate}
          disabled={isPlaying}
        >
          🎲 生成 & 再生
        </button>
        {#if cachedMelody}
          <button
            class="px-3 py-1.5 text-sm rounded bg-gray-700 hover:bg-gray-600 text-gray-200 disabled:opacity-50 flex-shrink-0"
            onclick={handleReplay}
            disabled={isPlaying}
          >
            ▶ 再生
          </button>
          {#each cachedMelody as note, i}
            <span class="px-1.5 py-0.5 text-xs rounded font-mono
              {currentNoteIdx === i ? 'bg-teal-500 text-white' : 'bg-gray-700 text-gray-300'}">
              {NOTE_NAMES[note.pc]}{i === cachedMelody.length - 1 ? ' 🏠' : ''}
            </span>
          {/each}
        {/if}
      </div>
    </div>

    <!-- 右列: ピアノロール（上から表示） -->
    {#if rollNotes && rollNotes.length > 0}
      {@const midiValues = rollNotes.map(n => n.midi)}
      {@const minMidi = Math.min(...midiValues)}
      {@const maxMidi = Math.max(...midiValues)}
      {@const totalDur = rollNotes[rollNotes.length - 1].end}
      {@const ROW_H = 14}
      {@const LABEL_W = 26}
      {@const rollW = Math.max(totalDur * 80, 200)}
      {@const pitchRange = maxMidi - minMidi + 1}
      <div class="overflow-x-auto flex-shrink-0">
        <svg width={rollW + LABEL_W} height={pitchRange * ROW_H} style="display: block;">
          <!-- 行背景 -->
          {#each Array.from({length: pitchRange}, (_, i) => maxMidi - i) as midi, rowIdx}
            {@const pc = ((midi % 12) + 12) % 12}
            {@const isBlack = [1,3,6,8,10].includes(pc)}
            <rect x={0} y={rowIdx * ROW_H} width={LABEL_W + rollW} height={ROW_H}
              fill={isBlack ? '#1a1f2e' : '#111827'} />
            <text x={LABEL_W - 3} y={rowIdx * ROW_H + ROW_H - 3}
              text-anchor="end" font-size="9" fill="#6b7280" font-family="monospace">
              {NOTE_NAMES[pc]}
            </text>
          {/each}
          <!-- 行境界線 -->
          {#each Array.from({length: pitchRange + 1}, (_, i) => i * ROW_H) as y}
            <line x1={LABEL_W} y1={y} x2={LABEL_W + rollW} y2={y} stroke="#1f2937" stroke-width="1" />
          {/each}
          <!-- ノート矩形 -->
          {#each rollNotes as rn, i}
            {@const rowIdx = maxMidi - rn.midi}
            {@const x = LABEL_W + (rn.start / totalDur) * rollW}
            {@const w = ((rn.end - rn.start) / totalDur) * rollW}
            <rect
              x={x + 1} y={rowIdx * ROW_H + 1}
              width={Math.max(w - 2, 1)} height={ROW_H - 2}
              fill={currentNoteIdx === i ? '#5eead4' : '#14b8a6'}
              rx={2}
              opacity={currentNoteIdx === i ? 1 : 0.8}
            />
          {/each}
        </svg>
      </div>
    {/if}

  </div>
</div>
