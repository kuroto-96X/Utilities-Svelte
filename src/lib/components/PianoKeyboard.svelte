<!-- src/lib/components/PianoKeyboard.svelte -->
<script lang="ts">
  import type { LayoutKey } from '$lib/pianoLayout';
  import { WHITE_W, WHITE_H, BLACK_W, BLACK_H, TOTAL_WIDTH } from '$lib/pianoLayout';
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
  }: {
    whiteKeys: LayoutKey[];
    blackKeys: LayoutKey[];
    intervals: number[];
    rootPc: number;
    playingPcs: Set<number>;
    addPlayingPc: (pc: number) => void;
    removePlayingPc: (pc: number) => void;
    totalWidth?: number;
  } = $props();

  const scalePcs = $derived(new Set(intervals.map(i => (rootPc + i) % 12)));

  const stopFns = new Map<number, () => void>();

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
        cy={WHITE_H - 12}
        r={5}
        fill="#14b8a6"
      />
    {/if}
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
        cy={BLACK_H - 10}
        r={4}
        fill="#14b8a6"
      />
    {/if}
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
