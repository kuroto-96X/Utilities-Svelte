<!-- src/lib/components/DiatonicChordPanel.svelte -->
<script lang="ts">
  import type { DiatonicChord } from '$lib/diatonicChords';
  import { getAudioContext, playNoteAt } from '$lib/audioEngine';

  let {
    diatonicChords,
    bpm,
    addPlayingPc,
    removePlayingPc,
    stopProgression,
  }: {
    diatonicChords: DiatonicChord[];
    bpm: number;
    addPlayingPc: (pc: number) => void;
    removePlayingPc: (pc: number) => void;
    stopProgression: () => void;
  } = $props();

  function playChord(chord: DiatonicChord) {
    stopProgression();
    const ctx = getAudioContext();
    const duration = (60 / bpm) * 2;
    const now = ctx.currentTime;
    chord.intervals.forEach(interval => {
      const midi = 60 + chord.rootPc + interval;
      const pc = (chord.rootPc + interval) % 12;
      playNoteAt(ctx, midi, duration, now);
      addPlayingPc(pc);
      setTimeout(() => removePlayingPc(pc), duration * 1000);
    });
  }
</script>

<div>
  <p class="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">ダイアトニックコード</p>
  <div class="flex flex-wrap gap-2">
    {#each diatonicChords as chord}
      <button
        class="px-3 py-2 text-sm rounded bg-gray-700 hover:bg-gray-600 text-gray-200 font-mono"
        onclick={() => playChord(chord)}
        title="{chord.roman} ({chord.quality})"
      >
        {chord.roman}
      </button>
    {/each}
  </div>
</div>
