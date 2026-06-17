<!-- src/lib/components/DiatonicChordPanel.svelte -->
<script lang="ts">
  import type { DiatonicChord } from '$lib/diatonicChords';
  import { getAudioContext, startNoteAt } from '$lib/audioEngine';

  let {
    diatonicChords,
    addPlayingPc,
    removePlayingPc,
    stopProgression,
  }: {
    diatonicChords: DiatonicChord[];
    addPlayingPc: (pc: number) => void;
    removePlayingPc: (pc: number) => void;
    stopProgression: () => void;
  } = $props();

  let pressedDegree = $state<number | null>(null);
  let activeStopFns: Array<() => void> = [];
  let activePcs: number[] = [];

  function stopCurrentChord() {
    for (const fn of activeStopFns) fn();
    activeStopFns = [];
    for (const pc of activePcs) removePlayingPc(pc);
    activePcs = [];
  }

  function startChord(chord: DiatonicChord) {
    stopProgression();
    stopCurrentChord();
    pressedDegree = chord.degreeIndex;
    const ctx = getAudioContext();
    chord.intervals.forEach(interval => {
      const midi = 60 + chord.rootPc + interval;
      const pc = (chord.rootPc + interval) % 12;
      const stopFn = startNoteAt(ctx, midi, ctx.currentTime);
      activeStopFns.push(stopFn);
      activePcs.push(pc);
      addPlayingPc(pc);
    });
  }

  function stopChord() {
    pressedDegree = null;
    stopCurrentChord();
  }
</script>

<div>
  <p class="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">ダイアトニックコード</p>
  <div class="flex flex-wrap gap-2">
    {#each diatonicChords as chord}
      <button
        class="px-3 py-2 text-sm rounded font-mono
          {pressedDegree === chord.degreeIndex
            ? 'bg-teal-500 text-white'
            : 'bg-gray-700 hover:bg-gray-600 text-gray-200'}"
        style="touch-action: none;"
        onpointerdown={() => startChord(chord)}
        onpointerup={stopChord}
        onpointerleave={stopChord}
        onpointercancel={stopChord}
        title="{chord.roman} ({chord.quality})"
      >
        {chord.roman}
      </button>
    {/each}
  </div>
</div>
