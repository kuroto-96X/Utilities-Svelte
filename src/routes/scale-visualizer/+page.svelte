<!-- src/routes/scale-visualizer/+page.svelte -->
<script lang="ts">
  import { untrack } from 'svelte';
  import { ROOTS, SCALES, CHORDS, NOTE_NAMES, applyInversion } from '$lib/scaleData';
  import { buildKeyboardWindow } from '$lib/pianoLayout';
  import { buildDiatonicChords } from '$lib/diatonicChords';
  import { DEFAULT_BPM } from '$lib/noteDuration';
  import { getAudioContext, startNoteAt } from '$lib/audioEngine';
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
  let playingMidis = $state(new Set<number>());
  let inversion = $state(0);
  let progressionStopCount = $state(0);
  let playId = 0;
  let currentPlayStopFns: Array<() => void> = [];

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
  function addPlayingMidi(midi: number) { playingMidis = new Set(playingMidis).add(midi); }
  function removePlayingMidi(midi: number) { const s = new Set(playingMidis); s.delete(midi); playingMidis = s; }

  function stopAllCurrentNotes() {
    for (const fn of currentPlayStopFns) fn();
    currentPlayStopFns = [];
  }

  // モード切替など「停止のみ」の操作
  function stopPlay() {
    progressionStopCount += 1;
    playId++;
    stopAllCurrentNotes();
    playingPcs = new Set();
    playingMidis = new Set();
  }

  $effect(() => {
    rootId; scaleId; chordId; mode; bpm;
    untrack(() => { progressionStopCount += 1; });
  });

  function playMain() {
    progressionStopCount += 1;
    playId++;
    const myId = playId;

    stopAllCurrentNotes();
    playingPcs = new Set();
    playingMidis = new Set();

    const ctx = getAudioContext();

    if (mode === 'chord') {
      // コード：全音を同時に鳴らし、全音符の長さで自動停止
      applyInversion(currentIntervals, inversion).forEach(interval => {
        const midi = 60 + root.pc + interval;
        const pc = (root.pc + interval) % 12;
        const stopFn = startNoteAt(ctx, midi, ctx.currentTime);
        currentPlayStopFns.push(stopFn);
        addPlayingPc(pc);
        addPlayingMidi(midi);
      });
      const wholeDuration = (60 / bpm) * 2;
      setTimeout(() => {
        if (playId !== myId) return;
        stopAllCurrentNotes();
        playingPcs = new Set();
        playingMidis = new Set();
      }, wholeDuration * 1000);
    } else {
      // スケール：各音を次の音が始まるまで持続
      const seq = [...currentIntervals, ...currentIntervals.slice(0, -1).reverse()];
      const SPACING = (60 / bpm) * 0.5;
      let activeStopFn: (() => void) | null = null;
      let activePc: number | null = null;
      let activeMidi: number | null = null;

      function playScaleStep(stepIdx: number) {
        // 前の音を停止
        activeStopFn?.();
        if (activePc !== null) removePlayingPc(activePc);
        if (activeMidi !== null) removePlayingMidi(activeMidi);
        activeStopFn = null;
        activePc = null;
        activeMidi = null;

        if (playId !== myId) return; // 別の再生が始まったらキャンセル
        if (stepIdx >= seq.length) return; // 終了

        const interval = seq[stepIdx];
        const midi = 60 + root.pc + interval;
        const pc = (root.pc + interval) % 12;

        const stopFn = startNoteAt(ctx, midi, ctx.currentTime);
        activeStopFn = stopFn;
        activePc = pc;
        activeMidi = midi;
        currentPlayStopFns.push(stopFn);
        addPlayingPc(pc);
        addPlayingMidi(midi);

        setTimeout(() => playScaleStep(stepIdx + 1), SPACING * 1000);
      }

      playScaleStep(0);
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
      <ScaleChordSelector bind:mode bind:scaleId bind:chordId onchange={playMain} onstop={stopPlay} />
    </div>

    <!-- メインエリア -->
    <div class="flex-1 min-w-0 space-y-4">
      <!-- 鍵盤エリア -->
      <div class="space-y-2">
        <div class="flex flex-wrap items-center justify-center gap-3">
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
          <div class="flex items-center gap-1 text-xs">
            <span class="text-gray-400">転回形</span>
            {#each ['ルート', '1転', '2転', '3転'] as label, i}
              <button
                class="px-2 py-1 rounded {inversion === i ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}"
                onclick={() => (inversion = i)}
              >{label}</button>
            {/each}
          </div>
        </div>
        <div class="overflow-x-auto flex justify-center">
          <PianoKeyboard
            whiteKeys={keyboard.whiteKeys}
            blackKeys={keyboard.blackKeys}
            totalWidth={keyboard.totalWidth}
            intervals={currentIntervals}
            rootPc={root.pc}
            startSemitone={anchorToRoot ? root.pc : 0}
            {playingPcs}
            {playingMidis}
            {addPlayingPc}
            {removePlayingPc}
            {addPlayingMidi}
            {removePlayingMidi}
          />
        </div>
        <!-- 再生中の音の表示 -->
        <div class="text-center font-mono text-sm min-h-[1.5rem]">
          {#if playingPcs.size > 0}
            <span class="text-teal-400">
              {[...playingPcs].sort((a, b) => a - b).map(pc => NOTE_NAMES[pc]).join(' · ')}
            </span>
          {/if}
        </div>
      </div>

      <div class="ad-slot--in-content"></div>

      {#if diatonicChords}
        <DiatonicChordPanel
          {diatonicChords}
          {inversion}
          {addPlayingPc}
          {removePlayingPc}
          {addPlayingMidi}
          {removePlayingMidi}
          stopProgression={() => { progressionStopCount += 1; }}
        />
      {/if}
      <MelodyGenerator
        intervals={currentIntervals}
        rootPc={root.pc}
        {bpm} {addPlayingPc} {removePlayingPc} {addPlayingMidi} {removePlayingMidi}
      />
      {#if diatonicChords}
        <ProgressionPlayer
          {diatonicChords} {bpm} {inversion} {addPlayingPc} {removePlayingPc} {addPlayingMidi} {removePlayingMidi}
          stopCount={progressionStopCount}
        />
      {/if}
    </div>
  </div>
</div>
