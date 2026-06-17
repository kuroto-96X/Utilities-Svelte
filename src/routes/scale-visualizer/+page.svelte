<!-- src/routes/scale-visualizer/+page.svelte -->
<script lang="ts">
  import { untrack } from 'svelte';
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
  import ProgressionPlayer from '$lib/components/ProgressionPlayer.svelte';
  import MelodyGenerator from '$lib/components/MelodyGenerator.svelte';

  let rootId = $state('C');
  let mode = $state<'scale' | 'chord'>('scale');
  let scaleId = $state('major');
  let chordId = $state('maj');
  let bpm = $state(DEFAULT_BPM);
  let anchorToRoot = $state(false);
  let octaves = $state(1);
  let playingPcs = $state(new Set<number>());
  let progressionStopCount = $state(0);
  let playId = 0;

  const root = $derived(ROOTS.find(r => r.id === rootId)!);
  const currentIntervals = $derived(
    mode === 'scale'
      ? SCALES.find(s => s.id === scaleId)!.intervals
      : CHORDS.find(c => c.id === chordId)!.intervals
  );
  const diatonicChords = $derived(buildDiatonicChords(currentIntervals, root.pc));
  const keyboard = $derived(buildKeyboardWindow(anchorToRoot ? root.pc : 0, octaves));

  function addPlayingPc(pc: number) { playingPcs = new Set(playingPcs).add(pc); }
  function removePlayingPc(pc: number) { const s = new Set(playingPcs); s.delete(pc); playingPcs = s; }

  $effect(() => {
    rootId; scaleId; chordId; mode; bpm;
    untrack(() => { progressionStopCount += 1; });
  });

  function playMain() {
    progressionStopCount += 1;
    playId++;
    const myId = playId;
    playingPcs = new Set();

    const ctx = getAudioContext();
    const now = ctx.currentTime;

    if (mode === 'chord') {
      const duration = (60 / bpm) * 2;
      currentIntervals.forEach(interval => {
        const midi = 60 + root.pc + interval;
        const pc = (root.pc + interval) % 12;
        playNoteAt(ctx, midi, duration, now);
        addPlayingPc(pc);
        setTimeout(() => { if (playId === myId) removePlayingPc(pc); }, duration * 1000);
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
        setTimeout(() => { if (playId === myId) addPlayingPc(pc); }, i * SPACING * 1000);
        setTimeout(() => { if (playId === myId) removePlayingPc(pc); }, (i * SPACING + duration) * 1000);
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
      <button
        class="w-full px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm rounded font-medium"
        onclick={playMain}
      >
        ▶ 再生
      </button>
      <BpmSlider bind:bpm />
      <RootSelector bind:rootId onchange={playMain} />
      <ScaleChordSelector bind:mode bind:scaleId bind:chordId onchange={playMain} />
    </div>

    <!-- メインエリア -->
    <div class="flex-1 min-w-0 space-y-4">
      <!-- 鍵盤エリア -->
      <div class="space-y-2">
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-1 text-xs">
            <span class="text-gray-400">オクターブ</span>
            {#each [1, 2, 3] as o}
              <button
                class="px-2 py-1 rounded {octaves === o ? 'bg-teal-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}"
                onclick={() => (octaves = o)}
              >{o}</button>
            {/each}
          </div>
          <div class="flex items-center gap-1 text-xs">
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
        <div class="overflow-x-auto flex justify-center">
          <PianoKeyboard
            whiteKeys={keyboard.whiteKeys}
            blackKeys={keyboard.blackKeys}
            totalWidth={keyboard.totalWidth}
            intervals={currentIntervals}
            rootPc={root.pc}
            {playingPcs}
            {addPlayingPc}
            {removePlayingPc}
          />
        </div>
      </div>

      <div class="ad-slot--in-content"></div>

      {#if diatonicChords}
        <DiatonicChordPanel
          {diatonicChords} {bpm} {addPlayingPc} {removePlayingPc}
          stopProgression={() => { progressionStopCount += 1; }}
        />
        <ProgressionPlayer
          {diatonicChords} {bpm} {addPlayingPc} {removePlayingPc}
          stopCount={progressionStopCount}
        />
      {/if}
      <MelodyGenerator
        intervals={currentIntervals}
        rootPc={root.pc}
        {bpm} {addPlayingPc} {removePlayingPc}
      />
    </div>
  </div>
</div>
