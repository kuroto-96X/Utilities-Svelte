<!-- src/lib/components/ProgressionPlayer.svelte -->
<script lang="ts">
  import type { DiatonicChord } from '$lib/diatonicChords';
  import { PROGRESSIONS } from '$lib/scaleData';
  import { NOTE_NAMES } from '$lib/scaleData';
  import { getAudioContext, startNoteAt } from '$lib/audioEngine';

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
  let activeChordStopFns: Array<() => void> = [];
  let activeChordPcs: number[] = [];

  function chordNameForDegree(degree: number): string {
    const chord = diatonicChords[degree];
    if (!chord) return '?';
    const root = NOTE_NAMES[chord.rootPc];
    switch (chord.quality) {
      case 'min': return root + 'm';
      case 'dim': return root + 'dim';
      case 'aug': return root + '+';
      default: return root;
    }
  }

  function stopCurrentChord() {
    for (const fn of activeChordStopFns) fn();
    activeChordStopFns = [];
    for (const pc of activeChordPcs) removePlayingPc(pc);
    activeChordPcs = [];
  }

  function stopInternal() {
    activeProgId = null;
    if (timeoutId !== null) { clearTimeout(timeoutId); timeoutId = null; }
    stopCurrentChord();
  }

  $effect(() => {
    stopCount;
    stopInternal();
  });

  function playStep(progId: string, degrees: number[], stepIndex: number) {
    if (activeProgId !== progId) return;

    const ctx = getAudioContext();
    const STEP_SPACING = (60 / bpm) * 2;

    stopCurrentChord();

    const degree = degrees[stepIndex % degrees.length];
    const chord = diatonicChords[degree];
    if (chord) {
      chord.intervals.forEach(interval => {
        const midi = 60 + chord.rootPc + interval;
        const pc = (chord.rootPc + interval) % 12;
        const stopFn = startNoteAt(ctx, midi, ctx.currentTime);
        activeChordStopFns.push(stopFn);
        activeChordPcs.push(pc);
        addPlayingPc(pc);
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
        <span class="block">{activeProgId === prog.id ? '⏹ ' : '▶ '}{prog.label}</span>
        <span class="block text-xs opacity-60 font-mono mt-0.5">
          {prog.degrees.map(d => chordNameForDegree(d)).join(' → ')}
        </span>
      </button>
    {/each}
  </div>
</div>
