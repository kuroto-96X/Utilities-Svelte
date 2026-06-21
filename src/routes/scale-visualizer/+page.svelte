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

  // モバイルアコーディオン
  let bpmOpen = $state(false);
  let rootOpen = $state(false);
  let scaleOpen = $state(false);

  function openAccordion(id: 'bpm' | 'root' | 'scale') {
    bpmOpen = id === 'bpm' ? !bpmOpen : false;
    rootOpen = id === 'root' ? !rootOpen : false;
    scaleOpen = id === 'scale' ? !scaleOpen : false;
  }
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

  // モード切替など「停止のみ」の操作
  function stopPlay() {
    progressionStopCount += 1;
    playId++;
    stopAllCurrentNotes();
    playingPcs = new Set();
    playingMidis = new Set();
    playingChordName = '';
  }

  // 他コンポーネントの再生開始時に左サイドバーのスケール/コード再生を停止する
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
      // コード：全音を同時に鳴らし、全音符の長さで自動停止
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

<div class="min-h-screen bg-gray-900 text-gray-100 p-4">
  <div class="ad-slot--top"></div>

  <!-- スマホ用: sticky bar -->
  <div class="sm:hidden sticky top-0 z-40 bg-gray-900/95 backdrop-blur-sm border-b border-gray-700 -mx-4 px-4 py-2 mb-3">
    <div class="flex gap-2 text-xs">
      <button
        class="px-2 py-1 rounded {rootOpen ? 'bg-teal-700 text-white' : 'bg-gray-800 text-gray-300'}"
        onclick={() => openAccordion('root')}
      >{NOTE_NAMES[root.pc]}</button>
      <button
        class="px-2 py-1 rounded flex-1 text-left {scaleOpen ? 'bg-teal-700 text-white' : 'bg-gray-800 text-gray-300'} truncate"
        onclick={() => openAccordion('scale')}
      >{currentModeName}</button>
      <button
        class="px-2 py-1 rounded {bpmOpen ? 'bg-teal-700 text-white' : 'bg-gray-800 text-gray-300'}"
        onclick={() => openAccordion('bpm')}
      >BPM {bpm}</button>
    </div>
  </div>

  <h1 class="text-2xl font-bold mb-1">Scale / Chord Visualizer</h1>
  <p class="text-xs text-yellow-400 mb-4">⚠ このページでは音が鳴ります。音量にご注意ください。</p>

  <div class="flex flex-col sm:flex-row gap-4">
    <!-- デスクトップ用サイドバー -->
    <div class="hidden sm:block sm:w-52 flex-shrink-0 space-y-4">
      <BpmSlider bind:bpm />
      <RootSelector bind:rootId onchange={playMain} />
      <ScaleChordSelector bind:mode bind:scaleId bind:chordId bind:inversion rootName={NOTE_NAMES[root.pc]} onchange={playMain} onstop={stopPlay} />
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
      </div>

      <!-- スマホ用アコーディオン -->
      <div class="sm:hidden space-y-1">
        <!-- BPM -->
        <div class="border border-gray-700 rounded-lg overflow-hidden">
          <button
            class="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-300 bg-gray-800 hover:bg-gray-700"
            onclick={() => openAccordion('bpm')}
          >
            <span>BPM {bpm}</span>
            <span class="text-gray-500">{bpmOpen ? '▲' : '▼'}</span>
          </button>
          {#if bpmOpen}
            <div class="px-3 pb-3 pt-2 bg-gray-800/50">
              <BpmSlider bind:bpm />
            </div>
          {/if}
        </div>
        <!-- ルート音 -->
        <div class="border border-gray-700 rounded-lg overflow-hidden">
          <button
            class="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-300 bg-gray-800 hover:bg-gray-700"
            onclick={() => openAccordion('root')}
          >
            <span>ルート音: {NOTE_NAMES[root.pc]}</span>
            <span class="text-gray-500">{rootOpen ? '▲' : '▼'}</span>
          </button>
          {#if rootOpen}
            <div class="px-3 pb-3 pt-2 bg-gray-800/50">
              <RootSelector bind:rootId onchange={playMain} />
            </div>
          {/if}
        </div>
        <!-- スケール/コード -->
        <div class="border border-gray-700 rounded-lg overflow-hidden">
          <button
            class="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-300 bg-gray-800 hover:bg-gray-700"
            onclick={() => openAccordion('scale')}
          >
            <span>{mode === 'scale' ? 'スケール' : 'コード'}: {currentModeName}</span>
            <span class="text-gray-500">{scaleOpen ? '▲' : '▼'}</span>
          </button>
          {#if scaleOpen}
            <div class="px-3 pb-3 pt-2 bg-gray-800/50">
              <ScaleChordSelector bind:mode bind:scaleId bind:chordId bind:inversion rootName={NOTE_NAMES[root.pc]} onchange={playMain} onstop={stopPlay} />
            </div>
          {/if}
        </div>
      </div>

      <div class="ad-slot--in-content"></div>

      <!-- 作曲のヒント -->
      <div class="border-t border-gray-700 pt-4 space-y-4">
        <h2 class="text-xs font-semibold text-gray-400 uppercase tracking-wide">作曲のヒント</h2>

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
        <MelodyGenerator
          intervals={currentIntervals}
          rootPc={root.pc}
          scaleName={currentScaleName}
          {bpm} {addPlayingPc} {removePlayingPc} {addPlayingMidi} {removePlayingMidi}
          onplay={stopMainPlay}
          startSemitone={keyboardStartSemitone}
          {octaves}
        />
        {#if diatonicChords}
          <ProgressionPlayer
            {diatonicChords} {bpm} {inversion} {addPlayingPc} {removePlayingPc} {addPlayingMidi} {removePlayingMidi}
            {setPlayingChordName}
            stopCount={progressionStopCount}
            onplay={stopMainPlay}
          />
        {/if}
      </div>
    </div>
  </div>

  <!-- 説明文 -->
  <div class="mt-8 max-w-2xl mx-auto space-y-4 text-sm text-gray-400 border-t border-gray-700 pt-6">
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
