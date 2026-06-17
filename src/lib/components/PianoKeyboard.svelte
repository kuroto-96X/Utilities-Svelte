<!-- src/lib/components/PianoKeyboard.svelte -->
<script lang="ts">
  import type { LayoutKey } from '$lib/pianoLayout';
  import { WHITE_W, WHITE_H, BLACK_W, BLACK_H, TOTAL_WIDTH } from '$lib/pianoLayout';
  import { NOTE_NAMES } from '$lib/scaleData';
  import { startNote } from '$lib/audioEngine';

  let {
    whiteKeys,
    blackKeys,
    intervals,
    rootPc,
    playingPcs,
    addPlayingPc,
    removePlayingPc,
    totalWidth = TOTAL_WIDTH,
    startSemitone = 0,
  }: {
    whiteKeys: LayoutKey[];
    blackKeys: LayoutKey[];
    intervals: number[];
    rootPc: number;
    playingPcs: Set<number>;
    addPlayingPc: (pc: number) => void;
    removePlayingPc: (pc: number) => void;
    totalWidth?: number;
    startSemitone?: number;
  } = $props();

  const scalePcs = $derived(new Set(intervals.map(i => (rootPc + i) % 12)));

  const stopFns = new Map<number, () => void>();

  function keyOctave(windowIndex: number): number {
    return Math.floor((60 + startSemitone + windowIndex) / 12) - 1;
  }

  function handlePointerDown(key: LayoutKey) {
    addPlayingPc(key.pc);
    const stop = startNote(60 + key.windowIndex);
    stopFns.set(key.windowIndex, stop);
  }

  function handlePointerUp(key: LayoutKey) {
    const stop = stopFns.get(key.windowIndex);
    if (stop) { stop(); stopFns.delete(key.windowIndex); }
    removePlayingPc(key.pc);
  }
</script>

<svg
  viewBox="0 0 {totalWidth} {WHITE_H}"
  width={totalWidth}
  height={WHITE_H}
  style="touch-action: none; user-select: none; display: block;"
>
  <!-- 白鍵ベース -->
  {#each whiteKeys as key (key.windowIndex)}
    {@const inScale = scalePcs.has(key.pc)}
    {@const isRoot = key.pc === rootPc}
    <rect
      x={key.x} y={0}
      width={WHITE_W - 1} height={WHITE_H}
      fill="#f9fafb"
      stroke={inScale ? '#14b8a6' : '#d1d5db'}
      stroke-width={inScale ? 2 : 1}
      opacity={inScale ? 1 : 0.32}
      rx={2}
    />
    {#if isRoot}
      <circle
        cx={key.x + (WHITE_W - 1) / 2}
        cy={WHITE_H - 20}
        r={5}
        fill="#14b8a6"
      />
    {/if}
    <text
      x={key.x + (WHITE_W - 1) / 2}
      y={WHITE_H - 6}
      text-anchor="middle"
      font-size="10"
      fill="#374151"
      font-family="monospace"
      pointer-events="none"
    >{NOTE_NAMES[key.pc]}{keyOctave(key.windowIndex)}</text>
  {/each}

  <!-- 黒鍵ベース -->
  {#each blackKeys as key (key.windowIndex)}
    {@const inScale = scalePcs.has(key.pc)}
    {@const isRoot = key.pc === rootPc}
    <rect
      x={key.x} y={0}
      width={BLACK_W} height={BLACK_H}
      fill="#111827"
      stroke={inScale ? '#14b8a6' : '#374151'}
      stroke-width={inScale ? 2 : 1}
      opacity={inScale ? 1 : 0.32}
      rx={2}
    />
    {#if isRoot}
      <circle
        cx={key.x + BLACK_W / 2}
        cy={BLACK_H - 18}
        r={4}
        fill="#14b8a6"
      />
    {/if}
    <text
      x={key.x + BLACK_W / 2}
      y={BLACK_H - 6}
      text-anchor="middle"
      font-size="8"
      fill={inScale ? '#99f6e4' : '#9ca3af'}
      font-family="monospace"
      pointer-events="none"
    >{NOTE_NAMES[key.pc]}</text>
  {/each}

  <!-- アクティブリング（最前面・opacity影響を受けない） -->
  {#each whiteKeys as key (key.windowIndex)}
    {#if playingPcs.has(key.pc)}
      <rect
        x={key.x + 2} y={2}
        width={WHITE_W - 5} height={WHITE_H - 4}
        fill="none"
        stroke="#14b8a6"
        stroke-width={3}
        rx={2}
      />
    {/if}
  {/each}
  {#each blackKeys as key (key.windowIndex)}
    {#if playingPcs.has(key.pc)}
      <rect
        x={key.x + 2} y={2}
        width={BLACK_W - 4} height={BLACK_H - 4}
        fill="none"
        stroke="#14b8a6"
        stroke-width={3}
        rx={2}
      />
    {/if}
  {/each}

  <!-- オクターブ区切り -->
  {#each Array.from({length: Math.round(totalWidth / TOTAL_WIDTH) - 1}, (_, i) => (i + 1) * TOTAL_WIDTH) as x}
    <line x1={x} y1={0} x2={x} y2={WHITE_H}
      stroke={playingPcs.size > 0 ? '#f59e0b' : '#6b7280'}
      stroke-width="2" />
  {/each}

  <!-- ポインターターゲット（透明）白鍵→黒鍵の順で黒鍵が前面 -->
  {#each whiteKeys as key (key.windowIndex)}
    <rect
      x={key.x} y={0}
      width={WHITE_W} height={WHITE_H}
      fill="transparent"
      style="cursor: pointer;"
      onpointerdown={() => handlePointerDown(key)}
      onpointerup={() => handlePointerUp(key)}
      onpointerleave={() => handlePointerUp(key)}
    />
  {/each}
  {#each blackKeys as key (key.windowIndex)}
    <rect
      x={key.x} y={0}
      width={BLACK_W} height={BLACK_H}
      fill="transparent"
      style="cursor: pointer;"
      onpointerdown={() => handlePointerDown(key)}
      onpointerup={() => handlePointerUp(key)}
      onpointerleave={() => handlePointerUp(key)}
    />
  {/each}
</svg>
