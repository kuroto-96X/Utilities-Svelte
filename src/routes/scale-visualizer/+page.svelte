<!-- src/routes/scale-visualizer/+page.svelte -->
<script lang="ts">
  import { untrack } from 'svelte';
  import { browser } from '$app/environment';
  import { page } from '$app/state';
  import { ROOTS, SCALES, CHORDS, NOTE_NAMES, applyInversion } from '$lib/scaleData';
  import { buildKeyboardWindow } from '$lib/pianoLayout';
  import { buildDiatonicChords } from '$lib/diatonicChords';
  import { DEFAULT_BPM, clampBpm } from '$lib/noteDuration';
  import { getAudioContext, startNoteAt } from '$lib/audioEngine';
  import RootSelector from '$lib/components/RootSelector.svelte';
  import ScaleChordSelector from '$lib/components/ScaleChordSelector.svelte';
  import PianoKeyboard from '$lib/components/PianoKeyboard.svelte';
  import BpmSlider from '$lib/components/BpmSlider.svelte';
  import DiatonicChordPanel from '$lib/components/DiatonicChordPanel.svelte';
  import ProgressionPlayer from '$lib/components/ProgressionPlayer.svelte';
  import MelodyGenerator from '$lib/components/MelodyGenerator.svelte';

  const STORAGE_KEY = 'scaleVisualizer';

  function loadSaved(): Record<string, unknown> {
    if (!browser) return {};
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'); } catch { return {}; }
  }

  const saved = loadSaved();

  let rootId = $state(typeof saved.rootId === 'string' ? saved.rootId : 'C');
  let mode = $state<'scale' | 'chord'>(saved.mode === 'chord' ? 'chord' : 'scale');
  let scaleId = $state(typeof saved.scaleId === 'string' ? saved.scaleId : 'major');
  let chordId = $state(typeof saved.chordId === 'string' ? saved.chordId : 'maj');
  let bpm = $state(typeof saved.bpm === 'number' ? clampBpm(saved.bpm) : DEFAULT_BPM);

  $effect(() => {
    const p = page.url.searchParams.get('bpm');
    if (!p) return;
    const n = parseFloat(p);
    if (!Number.isNaN(n)) bpm = clampBpm(n);
  });

  let anchorToRoot = $state(typeof saved.anchorToRoot === 'boolean' ? saved.anchorToRoot : true);
  let octaves = $state(typeof saved.octaves === 'number' && [1, 2, 3].includes(saved.octaves as number) ? saved.octaves as number : 2);
  let playingPcs = $state(new Set<number>());
  let playingMidis = $state(new Set<number>());
  let inversion = $state(typeof saved.inversion === 'number' ? saved.inversion : 0);

  $effect(() => {
    if (!browser) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ rootId, mode, scaleId, chordId, bpm, anchorToRoot, octaves, inversion }));
  });
  let playingChordName = $state('');

  const CHORD_SUFFIX: Record<string, string> = {
    maj: '', min: 'm', dim: 'dim', aug: '+',
    maj7: 'maj7', min7: 'm7', dom7: '7',
    sus2: 'sus2', sus4: 'sus4', add9: 'add9',
    maj9: 'maj9', min9: 'm9', dom9: '9',
  };

  function setPlayingChordName(name: string) { playingChordName = name; }
  let progressionStopCount = $state(0);
  let melodyStopCount = $state(0);
  const isAnyPlaying = $derived(playingPcs.size > 0);

  function stopAll() {
    stopPlay();
    melodyStopCount += 1;
  }

  let playId = 0;
  let currentPlayStopFns: Array<() => void> = [];

  const root = $derived(ROOTS.find(r => r.id === rootId)!);
  const currentIntervals = $derived(
    mode === 'scale'
      ? SCALES.find(s => s.id === scaleId)!.intervals
      : CHORDS.find(c => c.id === chordId)!.intervals
  );
  const currentModeName = $derived(
    mode === 'scale'
      ? (SCALES.find(s => s.id === scaleId)?.label ?? scaleId)
      : (CHORDS.find(c => c.id === chordId)?.label ?? chordId)
  );
  const currentScaleName = $derived(
    mode === 'scale' ? (SCALES.find(s => s.id === scaleId)?.label ?? '') : ''
  );
  const diatonicChords = $derived(buildDiatonicChords(currentIntervals, root.pc));

  // スマホ用: BPM/ルート/スケール設定のアコーディオン
  let controlsOpen = $state(false);

  // スマホ用: 鍵盤が画面外に出たらスティッキーバーを表示
  let keyboardVisible = $state(true);
  let keyboardSentinel = $state<HTMLDivElement | null>(null);

  $effect(() => {
    if (!browser || !keyboardSentinel) return;
    const obs = new IntersectionObserver(
      ([entry]) => { keyboardVisible = entry.isIntersecting; },
      { threshold: 0 }
    );
    obs.observe(keyboardSentinel);
    return () => obs.disconnect();
  });

  const keyboardStartSemitone = $derived(anchorToRoot ? (root.pc - 9 + 12) % 12 - 3 : -3);
  const keyboard = $derived(buildKeyboardWindow(keyboardStartSemitone, octaves));

  function addPlayingPc(pc: number) { playingPcs = new Set(playingPcs).add(pc); }
  function removePlayingPc(pc: number) { const s = new Set(playingPcs); s.delete(pc); playingPcs = s; }
  function addPlayingMidi(midi: number) { playingMidis = new Set(playingMidis).add(midi); }
  function removePlayingMidi(midi: number) { const s = new Set(playingMidis); s.delete(midi); playingMidis = s; }

  function stopAllCurrentNotes() {
    for (const fn of currentPlayStopFns) fn();
    currentPlayStopFns = [];
  }

  function stopPlay() {
    progressionStopCount += 1;
    playId++;
    stopAllCurrentNotes();
    playingPcs = new Set();
    playingMidis = new Set();
    playingChordName = '';
  }

  function stopMainPlay() {
    playId++;
    stopAllCurrentNotes();
    playingPcs = new Set();
    playingMidis = new Set();
    playingChordName = '';
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
    const base = 57 + ((root.pc - 9 + 12) % 12);

    if (mode === 'chord') {
      applyInversion(currentIntervals, inversion).forEach(interval => {
        const midi = base + interval;
        const pc = (root.pc + interval) % 12;
        const stopFn = startNoteAt(ctx, midi, ctx.currentTime);
        currentPlayStopFns.push(stopFn);
        addPlayingPc(pc);
        addPlayingMidi(midi);
      });
      playingChordName = NOTE_NAMES[root.pc] + (CHORD_SUFFIX[chordId] ?? chordId);
      const wholeDuration = (60 / bpm) * 2;
      setTimeout(() => {
        if (playId !== myId) return;
        stopAllCurrentNotes();
        playingPcs = new Set();
        playingMidis = new Set();
        playingChordName = '';
      }, wholeDuration * 1000);
    } else {
      const seq = [...currentIntervals, ...currentIntervals.slice(0, -1).reverse()];
      const SPACING = (60 / bpm) * 0.5;
      let activeStopFn: (() => void) | null = null;
      let activePc: number | null = null;
      let activeMidi: number | null = null;

      function playScaleStep(stepIdx: number) {
        activeStopFn?.();
        if (activePc !== null) removePlayingPc(activePc);
        if (activeMidi !== null) removePlayingMidi(activeMidi);
        activeStopFn = null;
        activePc = null;
        activeMidi = null;

        if (playId !== myId) return;
        if (stepIdx >= seq.length) return;

        const interval = seq[stepIdx];
        const midi = base + interval;
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

<!-- 鍵盤エリアのスニペット（desktop Panel 2 / mobile Panel 3 共通） -->
{#snippet keyboardPanel()}
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
      >A基準</button>
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
      startSemitone={keyboardStartSemitone}
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
      {#if playingChordName}
        <span class="text-orange-400 mr-2 font-bold">{playingChordName}</span>
      {/if}
      <span class="text-teal-400">
        {[...playingPcs].sort((a, b) => a - b).map(pc => NOTE_NAMES[pc]).join(' · ')}
      </span>
    {/if}
  </div>
  <!-- 停止ボタン -->
  <div class="flex justify-center">
    <button
      class="px-4 py-1 text-xs rounded {isAnyPlaying ? 'bg-red-700 text-white hover:bg-red-600 cursor-pointer' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}"
      disabled={!isAnyPlaying}
      onclick={stopAll}
    >⏹ 停止</button>
  </div>
{/snippet}

<!-- ページ全体 -->
<div class="bg-gray-900 text-gray-100 min-h-screen sm:min-h-0 sm:h-full sm:overflow-hidden sm:flex sm:flex-col p-4 sm:p-0">
  <div class="ad-slot--top"></div>

  <!-- スマホ用: 鍵盤スクロールアウト時のみ表示する fixed sticky bar -->
  {#if !keyboardVisible}
    <div class="sm:hidden fixed top-12 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur-sm border-b border-gray-700 px-4 pt-1 pb-0.5">
      <div class="overflow-x-auto flex justify-center">
        <PianoKeyboard
          whiteKeys={keyboard.whiteKeys}
          blackKeys={keyboard.blackKeys}
          totalWidth={keyboard.totalWidth}
          intervals={currentIntervals}
          rootPc={root.pc}
          startSemitone={keyboardStartSemitone}
          {playingPcs}
          {playingMidis}
          {addPlayingPc}
          {removePlayingPc}
          {addPlayingMidi}
          {removePlayingMidi}
        />
      </div>
      <div class="text-center font-mono text-xs min-h-[1.25rem]">
        {#if playingPcs.size > 0}
          {#if playingChordName}
            <span class="text-orange-400 mr-1 font-bold">{playingChordName}</span>
          {/if}
          <span class="text-teal-400">
            {[...playingPcs].sort((a, b) => a - b).map(pc => NOTE_NAMES[pc]).join(' · ')}
          </span>
        {/if}
      </div>
      <div class="flex items-center justify-between pb-0.5">
        <div class="text-[11px] text-gray-400">
          <span class="font-mono text-gray-200">BPM {bpm}</span>
          <span class="text-gray-600 mx-1">·</span>
          <span class="font-mono">{NOTE_NAMES[root.pc]}</span>
          <span class="text-gray-600 mx-1">·</span>
          <span>{currentModeName}</span>
        </div>
        <button
          class="px-2 py-0.5 text-[11px] rounded ml-2 {isAnyPlaying ? 'bg-red-700 text-white hover:bg-red-600 cursor-pointer' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}"
          disabled={!isAnyPlaying}
          onclick={stopAll}
        >⏹ 停止</button>
      </div>
    </div>
  {/if}

  <!-- タイトル（モバイルのみ。デスクトップはサイドバー内に表示） -->
  <div class="sm:hidden">
    <h1 class="text-2xl font-bold mb-1">Scale / Chord Visualizer</h1>
    <p class="text-xs text-yellow-400 mb-4">⚠ このページでは音が鳴ります。音量にご注意ください。</p>
  </div>

  <!-- 3パネルエリア: モバイル=縦積み、デスクトップ=横並び -->
  <div class="sm:flex-1 sm:min-h-0 sm:flex sm:flex-row sm:overflow-hidden">

    <!-- Panel 1: サイドバー（デスクトップのみ・独立スクロール） -->
    <aside class="hidden sm:flex sm:flex-col sm:w-52 sm:flex-shrink-0 sm:overflow-y-auto sm:border-r sm:border-gray-700 sm:p-4 sm:space-y-4">
      <div>
        <h1 class="text-base font-bold text-gray-100 leading-snug">Scale / Chord Visualizer</h1>
        <p class="text-[11px] text-yellow-400 mt-0.5">⚠ 音が鳴ります。音量にご注意ください。</p>
      </div>
      <BpmSlider bind:bpm />
      <RootSelector bind:rootId onchange={playMain} />
      <ScaleChordSelector bind:mode bind:scaleId bind:chordId bind:inversion rootName={NOTE_NAMES[root.pc]} onchange={playMain} onstop={stopPlay} />
    </aside>

    <!-- 右列: Panel 2（鍵盤）+ Panel 3（操作）を縦に並べる -->
    <div class="sm:flex-1 sm:min-w-0 sm:flex sm:flex-col sm:overflow-hidden">

    <!-- Panel 2: 鍵盤エリア（デスクトップのみ・スクロールなし） -->
    <div class="hidden sm:flex sm:flex-col sm:flex-shrink-0 sm:border-b sm:border-gray-700 sm:p-4 sm:space-y-2">
      {@render keyboardPanel()}
    </div>

    <!-- Panel 3: 操作エリア（モバイル全体 / デスクトップ右列下段・独立スクロール） -->
    <div class="sm:flex-1 sm:min-h-0 sm:overflow-y-auto sm:p-4 space-y-4">

      <!-- モバイル専用: 鍵盤セクション（センチネル込み） -->
      <div class="sm:hidden space-y-2">
        <div bind:this={keyboardSentinel} style="height:1px;"></div>
        {@render keyboardPanel()}
      </div>

      <!-- モバイル専用: BPM/ルート/スケール設定アコーディオン -->
      <div class="sm:hidden border border-gray-700 rounded-lg px-3">
        <button
          class="w-full flex items-center justify-between text-xs text-gray-300 py-2"
          onclick={() => (controlsOpen = !controlsOpen)}
        >
          <span class="flex gap-2">
            <span class="font-mono">{NOTE_NAMES[root.pc]}</span>
            <span class="text-gray-400 truncate max-w-[160px]">{currentModeName}</span>
            <span class="text-gray-400">BPM {bpm}</span>
          </span>
          <span class="text-gray-500 ml-2">{controlsOpen ? '▲' : '▼'}</span>
        </button>
        {#if controlsOpen}
          <div class="border-t border-gray-700 pt-3 pb-3 space-y-3">
            <BpmSlider bind:bpm />
            <RootSelector bind:rootId onchange={playMain} />
            <ScaleChordSelector bind:mode bind:scaleId bind:chordId bind:inversion rootName={NOTE_NAMES[root.pc]} onchange={playMain} onstop={stopPlay} />
          </div>
        {/if}
      </div>

      <div class="ad-slot--in-content"></div>

      <!-- ダイアトニックコード -->
      {#if diatonicChords}
        <DiatonicChordPanel
          {diatonicChords}
          {inversion}
          {addPlayingPc}
          {removePlayingPc}
          {addPlayingMidi}
          {removePlayingMidi}
          {setPlayingChordName}
          stopProgression={() => { progressionStopCount += 1; }}
          onplay={stopMainPlay}
        />
      {/if}

      <!-- ランダムメロディ生成 -->
      <MelodyGenerator
        intervals={currentIntervals}
        rootPc={root.pc}
        scaleName={currentScaleName}
        {bpm} {addPlayingPc} {removePlayingPc} {addPlayingMidi} {removePlayingMidi}
        onplay={stopMainPlay}
        startSemitone={keyboardStartSemitone}
        {octaves}
        stopCount={melodyStopCount}
      />

      <!-- コード進行プリセット -->
      {#if diatonicChords}
        <div class="border-t border-gray-700 pt-4">
          <ProgressionPlayer
            {diatonicChords} {bpm} {inversion} {addPlayingPc} {removePlayingPc} {addPlayingMidi} {removePlayingMidi}
            {setPlayingChordName}
            stopCount={progressionStopCount}
            onplay={stopMainPlay}
          />
        </div>
      {/if}

      <!-- 説明文 -->
      <div class="mt-4 space-y-4 text-sm text-gray-400 border-t border-gray-700 pt-6">
        <div>
          <h2 class="text-gray-200 font-semibold mb-1">使い方</h2>
          <p>ルート音とスケール（またはコード）を選ぶと、鍵盤上に構成音が表示され構成音を再生します。BPMスライダーで再生速度を調整してください。</p>
        </div>
        <div>
          <h2 class="text-gray-200 font-semibold mb-1">鍵盤表示</h2>
          <p>「A基準」はA3を左端に固定した表示、「ルート基準」は選択中のルート音を左端に合わせた表示です。オクターブボタンで表示範囲を変更できます。鍵盤をクリック・タップして音を鳴らすこともできます。</p>
        </div>
        <div>
          <h2 class="text-gray-200 font-semibold mb-1">ダイアトニックコード</h2>
          <p>選択中のスケールから導かれる7つのコードを表示します。ボタンを押している間、コードが鳴ります。「転回形」ボタンでコードの積み方を変更できます。</p>
        </div>
        <div>
          <h2 class="text-gray-200 font-semibold mb-1">コード進行プリセット</h2>
          <p>定番のコード進行をワンクリックで再生できます。「スムーズベース（転回形）」をオンにすると、ベース音が滑らかに移動するよう各コードに転回形を適用します。</p>
        </div>
        <div>
          <h2 class="text-gray-200 font-semibold mb-1">ランダムメロディ生成</h2>
          <p>スケールの構成音を使ってランダムなメロディを生成・再生します。小節数、フレーズの輪郭（アーチ・上昇・下降・谷型）などを設定できます。</p>
        </div>
      </div>

    </div>
    </div><!-- /右列 -->
  </div>
</div>
