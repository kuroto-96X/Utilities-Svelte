<!-- src/lib/components/ProgressionPlayer.svelte -->
<script lang="ts">
  import type { DiatonicChord } from '$lib/diatonicChords';
  import { PROGRESSIONS, CHROMATIC_PROGRESSIONS, TENSION_PROGRESSIONS, NOTE_NAMES, applyInversion } from '$lib/scaleData';
  import type { Progression, ChromaticProgression } from '$lib/scaleData';
  import { getAudioContext, startNoteAt } from '$lib/audioEngine';

  let {
    diatonicChords,
    bpm,
    inversion = 0,
    addPlayingPc,
    removePlayingPc,
    addPlayingMidi,
    removePlayingMidi,
    setPlayingChordName,
    stopCount = 0,
    onplay,
  }: {
    diatonicChords: DiatonicChord[];
    bpm: number;
    inversion?: number;
    addPlayingPc: (pc: number) => void;
    removePlayingPc: (pc: number) => void;
    addPlayingMidi?: (midi: number) => void;
    removePlayingMidi?: (midi: number) => void;
    setPlayingChordName?: (name: string) => void;
    stopCount?: number;
    onplay?: () => void;
  } = $props();

  type AnyProg = Progression | ChromaticProgression;

  function isChromatic(p: AnyProg): p is ChromaticProgression {
    return 'steps' in p;
  }

  // ---- コード名ヘルパー ----

  function qualitySuffix(intervals: number[]): string {
    const has = (n: number) => intervals.includes(n);
    if (has(9)  && has(6) && has(3))                              return 'dim7';
    if (has(11) && has(7) && has(4))                              return 'maj7';
    if (has(10) && has(7) && has(4))                              return '7';
    if (has(2)  && has(3) && has(7) && has(10))                   return 'm9';
    if (has(10) && has(7) && has(3))                              return 'm7';
    if (has(6)  && has(3))                                        return 'dim';
    if (has(5)  && has(7) && !has(3) && !has(4))                  return 'sus4';
    if (has(2)  && has(4) && has(7)  && !has(10))                 return 'add9';
    if (has(2)  && has(7) && !has(3) && !has(4) && !has(10))      return 'sus2';
    if (has(7)  && has(3))                                        return 'm';
    return '';
  }

  function chordNameForDegree(degree: number): string {
    const chord = diatonicChords[degree];
    if (!chord) return '?';
    const root = NOTE_NAMES[chord.rootPc];
    switch (chord.quality) {
      case 'min': return root + 'm';
      case 'dim': return root + 'dim';
      case 'aug': return root + '+';
      default:    return root;
    }
  }

  function chromaticChordNames(prog: ChromaticProgression): string {
    const keyRoot = diatonicChords[0]?.rootPc ?? 0;
    return prog.steps.map(s => {
      const rootPc = ((keyRoot + s.semitone) % 12 + 12) % 12;
      return NOTE_NAMES[rootPc] + qualitySuffix(s.intervals);
    }).join(' → ');
  }

  function progChordNames(prog: AnyProg): string[] {
    const keyRoot = diatonicChords[0]?.rootPc ?? 0;
    return isChromatic(prog)
      ? prog.steps.map(s => {
          const rootPc = ((keyRoot + s.semitone) % 12 + 12) % 12;
          return NOTE_NAMES[rootPc] + qualitySuffix(s.intervals);
        })
      : prog.degrees.map(d => chordNameForDegree(d));
  }

  // ---- 再生ロジック ----

  let useSmoothedBass = $state(false);
  let activeProgId = $state<string | null>(null);
  let activeStepIndex = $state(-1);
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let activeChordStopFns: Array<() => void> = [];
  let activeChordPcs: number[] = [];
  let activeChordMidis: number[] = [];

  function stopCurrentChord() {
    for (const fn of activeChordStopFns) fn();
    activeChordStopFns = [];
    for (const pc of activeChordPcs) removePlayingPc(pc);
    activeChordPcs = [];
    for (const midi of activeChordMidis) removePlayingMidi?.(midi);
    activeChordMidis = [];
  }

  function stopInternal() {
    activeProgId = null;
    activeStepIndex = -1;
    if (timeoutId !== null) { clearTimeout(timeoutId); timeoutId = null; }
    stopCurrentChord();
    setPlayingChordName?.('');
  }

  $effect(() => {
    stopCount;
    stopInternal();
  });

  function playStep(progId: string, prog: AnyProg, stepIndex: number) {
    if (activeProgId !== progId) return;

    const ctx = getAudioContext();
    const STEP_SPACING = (60 / bpm) * 2;

    const stepsLen = isChromatic(prog) ? prog.steps.length : prog.degrees.length;
    activeStepIndex = stepIndex % stepsLen;

    stopCurrentChord();

    const tonicPc = diatonicChords[0]?.rootPc ?? 0;
    const tonicMidi = 57 + ((tonicPc - 9 + 12) % 12);

    if (isChromatic(prog)) {
      const step = prog.steps[activeStepIndex];
      const keyRoot = ((diatonicChords[0]?.rootPc ?? 0) + 120);
      const chordRoot = (keyRoot + step.semitone) % 12;
      const baseRoot = 57 + ((chordRoot - 9 + 12) % 12);
      const chordRootMidi = baseRoot < tonicMidi ? baseRoot + 12 : baseRoot;
      setPlayingChordName?.(NOTE_NAMES[chordRoot] + qualitySuffix(step.intervals));
      const smoothVoicing = useSmoothedBass ? prog.smoothVoicings[activeStepIndex] : null;
      if (smoothVoicing) {
        step.intervals.forEach((interval, i) => {
          const midi = chordRootMidi + interval + (smoothVoicing[i] ?? 0);
          const pc = ((chordRoot + interval) % 12 + 12) % 12;
          const stopFn = startNoteAt(ctx, midi, ctx.currentTime);
          activeChordStopFns.push(stopFn);
          activeChordPcs.push(pc);
          activeChordMidis.push(midi);
          addPlayingPc(pc);
          addPlayingMidi?.(midi);
        });
      } else {
        applyInversion(step.intervals, inversion).forEach(interval => {
          const midi = chordRootMidi + interval;
          const pc = (chordRoot + interval) % 12;
          const stopFn = startNoteAt(ctx, midi, ctx.currentTime);
          activeChordStopFns.push(stopFn);
          activeChordPcs.push(pc);
          activeChordMidis.push(midi);
          addPlayingPc(pc);
          addPlayingMidi?.(midi);
        });
      }
    } else {
      const degree = prog.degrees[activeStepIndex];
      setPlayingChordName?.(chordNameForDegree(degree));
      const chord = diatonicChords[degree];
      if (chord) {
        const baseRoot = 57 + ((chord.rootPc - 9 + 12) % 12);
        const chordRootMidi = baseRoot < tonicMidi ? baseRoot + 12 : baseRoot;
        const smoothVoicing = useSmoothedBass ? prog.smoothVoicings[activeStepIndex] : null;
        if (smoothVoicing) {
          chord.intervals.forEach((interval, i) => {
            const midi = chordRootMidi + interval + (smoothVoicing[i] ?? 0);
            const pc = ((chord.rootPc + interval) % 12 + 12) % 12;
            const stopFn = startNoteAt(ctx, midi, ctx.currentTime);
            activeChordStopFns.push(stopFn);
            activeChordPcs.push(pc);
            activeChordMidis.push(midi);
            addPlayingPc(pc);
            addPlayingMidi?.(midi);
          });
        } else {
          applyInversion(chord.intervals, inversion).forEach(interval => {
            const midi = chordRootMidi + interval;
            const pc = (chord.rootPc + interval) % 12;
            const stopFn = startNoteAt(ctx, midi, ctx.currentTime);
            activeChordStopFns.push(stopFn);
            activeChordPcs.push(pc);
            activeChordMidis.push(midi);
            addPlayingPc(pc);
            addPlayingMidi?.(midi);
          });
        }
      }
    }

    timeoutId = setTimeout(() => {
      playStep(progId, prog, stepIndex + 1);
    }, STEP_SPACING * 1000);
  }

  function toggleProgression(prog: AnyProg) {
    if (activeProgId === prog.id) {
      stopInternal();
    } else {
      onplay?.();
      stopInternal();
      activeProgId = prog.id;
      playStep(prog.id, prog, 0);
    }
  }
</script>

<div>
  <div class="flex items-center justify-between mb-2">
    <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide">コード進行プリセット</p>
    <label class="flex items-center gap-1 text-xs text-gray-300 cursor-pointer">
      <input type="checkbox" bind:checked={useSmoothedBass} class="accent-teal-500" />
      スムーズベース（転回形）
    </label>
  </div>

  <div class="flex flex-col md:flex-row gap-4">
    <!-- ダイアトニック -->
    <div class="flex-1 min-w-0">
      <p class="text-xs text-gray-500 mb-1">ダイアトニック</p>
      <div class="space-y-1">
        {#each PROGRESSIONS as prog}
          {@const names = progChordNames(prog)}
          {@const activeIdx = activeProgId === prog.id ? activeStepIndex : -1}
          <button
            class="w-full text-left px-3 py-2 text-sm rounded
              {activeProgId === prog.id
                ? 'bg-teal-600 text-white'
                : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}"
            onclick={() => toggleProgression(prog)}
          >
            <span class="block">{activeProgId === prog.id ? '⏹ ' : '▶ '}{prog.label}</span>
            <span class="block text-xs font-mono mt-0.5">
              {#each names as name, i}
                {#if i > 0}<span class="opacity-40"> → </span>{/if}
                <span class="{activeIdx === i ? 'text-orange-400' : 'opacity-60'}">{name}</span>
              {/each}
            </span>
          </button>
        {/each}
      </div>
    </div>

    <!-- クロマティック -->
    <div class="flex-1 min-w-0">
      <p class="text-xs text-gray-500 mb-1">クロマティック</p>
      <div class="space-y-1">
        {#each CHROMATIC_PROGRESSIONS as prog}
          {@const names = progChordNames(prog)}
          {@const activeIdx = activeProgId === prog.id ? activeStepIndex : -1}
          <button
            class="w-full text-left px-3 py-2 text-sm rounded
              {activeProgId === prog.id
                ? 'bg-orange-600 text-white'
                : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}"
            onclick={() => toggleProgression(prog)}
          >
            <span class="block">{activeProgId === prog.id ? '⏹ ' : '▶ '}{prog.label}</span>
            <span class="block text-xs font-mono mt-0.5">
              {#each names as name, i}
                {#if i > 0}<span class="opacity-40"> → </span>{/if}
                <span class="{activeIdx === i ? 'text-orange-400' : 'opacity-60'}">{name}</span>
              {/each}
            </span>
          </button>
        {/each}
      </div>
    </div>

    <!-- テンション解決 -->
    <div class="flex-1 min-w-0">
      <p class="text-xs text-gray-500 mb-1">テンション解決</p>
      <div class="space-y-1">
        {#each TENSION_PROGRESSIONS as prog}
          {@const names = progChordNames(prog)}
          {@const activeIdx = activeProgId === prog.id ? activeStepIndex : -1}
          <button
            class="w-full text-left px-3 py-2 text-sm rounded
              {activeProgId === prog.id
                ? 'bg-violet-600 text-white'
                : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}"
            onclick={() => toggleProgression(prog)}
          >
            <span class="block">{activeProgId === prog.id ? '⏹ ' : '▶ '}{prog.label}</span>
            <span class="block text-xs font-mono mt-0.5">
              {#each names as name, i}
                {#if i > 0}<span class="opacity-40"> → </span>{/if}
                <span class="{activeIdx === i ? 'text-orange-400' : 'opacity-60'}">{name}</span>
              {/each}
            </span>
          </button>
        {/each}
      </div>
    </div>
  </div>
</div>
