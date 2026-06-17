<!-- src/routes/scale-visualizer/+page.svelte -->
<script lang="ts">
  import { ROOTS, SCALES, CHORDS } from '$lib/scaleData';
  import { buildKeyboardWindow } from '$lib/pianoLayout';
  import { buildDiatonicChords } from '$lib/diatonicChords';
  import { DEFAULT_BPM } from '$lib/noteDuration';
  import { getAudioContext, playNoteAt } from '$lib/audioEngine';
  import RootSelector from '$lib/components/RootSelector.svelte';
  import ScaleChordSelector from '$lib/components/ScaleChordSelector.svelte';
  import PianoKeyboard from '$lib/components/PianoKeyboard.svelte';
  import BpmSlider from '$lib/components/BpmSlider.svelte';
  import DiatonicChordPanel from '$lib/components/DiatonicChordPanel.svelte';

  let rootId = $state('C');
  let mode = $state<'scale' | 'chord'>('scale');
  let scaleId = $state('major');
  let chordId = $state('maj');
  let bpm = $state(DEFAULT_BPM);
  let anchorToRoot = $state(false);
  let playingPcs = $state(new Set<number>());

  let progressionPlayerRef: { stop: () => void } | null = null;

  const root = $derived(ROOTS.find(r => r.id === rootId)!);
  const currentIntervals = $derived(
    mode === 'scale'
      ? SCALES.find(s => s.id === scaleId)!.intervals
      : CHORDS.find(c => c.id === chordId)!.intervals
  );
  const diatonicChords = $derived(buildDiatonicChords(currentIntervals, root.pc));
  const keyboard = $derived(buildKeyboardWindow(anchorToRoot ? root.pc : 0));

  function addPlayingPc(pc: number) { playingPcs = new Set(playingPcs).add(pc); }
  function removePlayingPc(pc: number) { const s = new Set(playingPcs); s.delete(pc); playingPcs = s; }

  $effect(() => {
    rootId; scaleId; chordId; mode; bpm;
    progressionPlayerRef?.stop();
  });

  function playMain() {
    progressionPlayerRef?.stop();
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    if (mode === 'chord') {
      const duration = (60 / bpm) * 2;
      currentIntervals.forEach(interval => {
        const midi = 60 + root.pc + interval;
        const pc = (root.pc + interval) % 12;
        playNoteAt(ctx, midi, duration, now);
        addPlayingPc(pc);
        setTimeout(() => removePlayingPc(pc), duration * 1000);
      });
    } else {
      const seq = [...currentIntervals, ...currentIntervals.slice(0, -1).reverse()];
      const SPACING = (60 / bpm) * 0.5;
      const duration = SPACING * 0.85;
      seq.forEach((interval, i) => {
        const midi = 60 + root.pc + interval;
        const pc = (root.pc + interval) % 12;
        const startTime = now + i * SPACING;
        playNoteAt(ctx, midi, duration, startTime);
        setTimeout(() => addPlayingPc(pc), i * SPACING * 1000);
        setTimeout(() => removePlayingPc(pc), (i * SPACING + duration) * 1000);
      });
    }
  }
</script>

<div class="min-h-screen bg-gray-900 text-gray-100 p-4">
  <div class="ad-slot--top"></div>
  <h1 class="text-2xl font-bold mb-4">スケール / コードビジュアライザー</h1>

  <div class="flex flex-col md:flex-row gap-4">
    <!-- 左サイドバー -->
    <div class="md:w-52 flex-shrink-0 space-y-4">
      <RootSelector bind:rootId />
      <ScaleChordSelector bind:mode bind:scaleId bind:chordId />
    </div>

    <!-- メインエリア -->
    <div class="flex-1 min-w-0 space-y-4">
      <!-- 鍵盤 -->
      <div class="overflow-x-auto">
        <PianoKeyboard
          whiteKeys={keyboard.whiteKeys}
          blackKeys={keyboard.blackKeys}
          intervals={currentIntervals}
          rootPc={root.pc}
          {playingPcs}
          {addPlayingPc}
          {removePlayingPc}
        />
      </div>

      <!-- コントロール行 -->
      <div class="flex flex-wrap items-center gap-3">
        <button
          class="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm rounded font-medium flex-shrink-0"
          onclick={playMain}
        >
          ▶ {mode === 'scale' ? 'スケール往復' : 'コード再生'}
        </button>
        <div class="flex-1 min-w-40">
          <BpmSlider bind:bpm />
        </div>
        <div class="flex items-center gap-1 text-xs flex-shrink-0">
          <button
            class="px-2 py-1 rounded {!anchorToRoot ? 'bg-teal-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}"
            onclick={() => (anchorToRoot = false)}
          >C基準</button>
          <button
            class="px-2 py-1 rounded {anchorToRoot ? 'bg-teal-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}"
            onclick={() => (anchorToRoot = true)}
          >ルート基準</button>
        </div>
      </div>

      <div class="ad-slot--in-content"></div>

      {#if diatonicChords}
        <DiatonicChordPanel
          {diatonicChords}
          {bpm}
          {addPlayingPc}
          {removePlayingPc}
          stopProgression={() => progressionPlayerRef?.stop()}
        />
      {/if}
      <!-- ProgressionPlayer, MelodyGenerator -->
    </div>
  </div>
</div>
