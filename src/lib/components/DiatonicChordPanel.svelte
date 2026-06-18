<!-- src/lib/components/DiatonicChordPanel.svelte -->
<script lang="ts">
  import type { DiatonicChord } from '$lib/diatonicChords';
  import { NOTE_NAMES, applyInversion } from '$lib/scaleData';
  import { getAudioContext, startNoteAt } from '$lib/audioEngine';

  let {
    diatonicChords,
    inversion = 0,
    addPlayingPc,
    removePlayingPc,
    addPlayingMidi,
    removePlayingMidi,
    stopProgression,
  }: {
    diatonicChords: DiatonicChord[];
    inversion?: number;
    addPlayingPc: (pc: number) => void;
    removePlayingPc: (pc: number) => void;
    addPlayingMidi?: (midi: number) => void;
    removePlayingMidi?: (midi: number) => void;
    stopProgression: () => void;
  } = $props();

  let pressedDegree = $state<number | null>(null);
  let activeStopFns: Array<() => void> = [];
  let activePcs: number[] = [];
  let activeMidis: number[] = [];

  function chordName(chord: DiatonicChord): string {
    const root = NOTE_NAMES[chord.rootPc];
    switch (chord.quality) {
      case 'min': return root + 'm';
      case 'dim': return root + 'dim';
      case 'aug': return root + '+';
      default: return root;
    }
  }

  function stopCurrentChord() {
    for (const fn of activeStopFns) fn();
    activeStopFns = [];
    for (const pc of activePcs) removePlayingPc(pc);
    activePcs = [];
    for (const midi of activeMidis) removePlayingMidi?.(midi);
    activeMidis = [];
  }

  function startChord(chord: DiatonicChord) {
    stopProgression();
    stopCurrentChord();
    pressedDegree = chord.degreeIndex;
    const ctx = getAudioContext();
    applyInversion(chord.intervals, inversion).forEach(interval => {
      const midi = 60 + chord.rootPc + interval;
      const pc = (chord.rootPc + interval) % 12;
      const stopFn = startNoteAt(ctx, midi, ctx.currentTime);
      activeStopFns.push(stopFn);
      activePcs.push(pc);
      activeMidis.push(midi);
      addPlayingPc(pc);
      addPlayingMidi?.(midi);
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
        class="px-3 py-2 rounded font-mono leading-tight
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
        <span class="block text-sm">{chord.roman}</span>
        <span class="block text-xs opacity-60">{chordName(chord)}</span>
      </button>
    {/each}
  </div>
</div>
