<!-- src/lib/components/ProgressionPlayer.svelte -->
<script lang="ts">
  import type { DiatonicChord } from '$lib/diatonicChords';
  import { PROGRESSIONS } from '$lib/scaleData';
  import { getAudioContext, playNoteAt } from '$lib/audioEngine';

  let {
    diatonicChords,
    bpm,
    addPlayingPc,
    removePlayingPc,
    stopCount = 0,
  }: {
    diatonicChords: DiatonicChord[];
    bpm: number;
    addPlayingPc: (pc: number) => void;
    removePlayingPc: (pc: number) => void;
    stopCount?: number;
  } = $props();

  let activeProgId = $state<string | null>(null);
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  function stopInternal() {
    activeProgId = null;
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  }

  // stopCount が変化したら停止
  $effect(() => {
    stopCount;
    stopInternal();
  });

  function playStep(progId: string, degrees: number[], stepIndex: number) {
    if (activeProgId !== progId) return;

    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const STEP_SPACING = (60 / bpm) * 2;
    const CHORD_DURATION = STEP_SPACING * 0.9;

    const degree = degrees[stepIndex % degrees.length];
    const chord = diatonicChords[degree];
    if (chord) {
      chord.intervals.forEach(interval => {
        const midi = 60 + chord.rootPc + interval;
        const pc = (chord.rootPc + interval) % 12;
        playNoteAt(ctx, midi, CHORD_DURATION, now);
        addPlayingPc(pc);
        setTimeout(() => removePlayingPc(pc), CHORD_DURATION * 1000);
      });
    }

    timeoutId = setTimeout(() => {
      playStep(progId, degrees, stepIndex + 1);
    }, STEP_SPACING * 1000);
  }

  function toggleProgression(prog: (typeof PROGRESSIONS)[number]) {
    if (activeProgId === prog.id) {
      stopInternal();
    } else {
      stopInternal();
      activeProgId = prog.id;
      playStep(prog.id, prog.degrees, 0);
    }
  }
</script>

<div>
  <p class="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">コード進行プリセット</p>
  <div class="space-y-1">
    {#each PROGRESSIONS as prog}
      <button
        class="w-full text-left px-3 py-2 text-sm rounded
          {activeProgId === prog.id
            ? 'bg-teal-600 text-white'
            : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}"
        onclick={() => toggleProgression(prog)}
      >
        {activeProgId === prog.id ? '⏹ ' : '▶ '}{prog.label}
      </button>
    {/each}
  </div>
</div>
