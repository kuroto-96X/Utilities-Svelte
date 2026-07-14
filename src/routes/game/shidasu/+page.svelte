<script lang="ts">
  import { onDestroy } from 'svelte'
  import { loadParams } from '$lib/game/shidasu/params'
  import {
    createInitialRun, beginRun, applyPlayCard, applyDrawStock, applyStuckCheck,
    resolveWaveEnd, pickItem, confirmItemSwap, cancelItemSwap, skipItemSelect,
    advanceStage, restartRun, startWave, forceStockTop,
    getPlayableColumns, remainingCount, rankLabel, isRed, itemDesc, ITEM_NAMES,
  } from '$lib/game/shidasu/engine'
  import { standardDeckComposition } from '$lib/game/shidasu/deck'
  import type { RunState, Card, ItemId, StageModifier, WaveState, Suit, Rank } from '$lib/game/shidasu/types'
  import DebugPanel from './DebugPanel.svelte'

  const params = loadParams()

  // ソリティアと同じカードデザイン(角丸・白背景・中央ピップ/面札記号)用の定数
  const PIP_LAYOUTS: Record<number, [number, number, boolean][]> = {
    1:  [[50, 50, false]],
    2:  [[50, 18, false], [50, 82, true]],
    3:  [[50, 14, false], [50, 50, false], [50, 86, true]],
    4:  [[25, 18, false], [75, 18, false], [25, 82, true], [75, 82, true]],
    5:  [[25, 18, false], [75, 18, false], [50, 50, false], [25, 82, true], [75, 82, true]],
    6:  [[25, 15, false], [75, 15, false], [25, 50, false], [75, 50, false], [25, 85, true], [75, 85, true]],
    7:  [[25, 13, false], [75, 13, false], [50, 30, false], [25, 52, false], [75, 52, false], [25, 85, true], [75, 85, true]],
    8:  [[25, 11, false], [75, 11, false], [50, 28, false], [25, 50, false], [75, 50, false], [50, 72, true], [25, 89, true], [75, 89, true]],
    9:  [[25, 9, false], [75, 9, false], [25, 35, false], [75, 35, false], [50, 50, false], [25, 65, true], [75, 65, true], [25, 91, true], [75, 91, true]],
    10: [[25, 9, false], [75, 9, false], [50, 26, false], [25, 37, false], [75, 37, false], [25, 63, true], [75, 63, true], [50, 74, true], [25, 91, true], [75, 91, true]],
  }
  const FACE_CHAR: Record<number, string> = { 11: '♞', 12: '♛', 13: '♚' }

  function chunk<T>(arr: T[], size: number): T[][] {
    const result: T[][] = []
    for (let i = 0; i < arr.length; i += size) {
      result.push(arr.slice(i, i + size))
    }
    return result
  }

  // タイトル画面の高さをプレイ画面に揃えるための計測専用ダミーウェーブ(実際のゲームには使わない)
  const measurementWave = startWave(params, 0, 0, [], standardDeckComposition(), 1).wave
  let measuredPlayHeight = $state(0)

  let run = $state<RunState>(createInitialRun())
  // ウェーブ終了系のタイマーは常にこの1本にまとめ、次の予約前に必ず前の分をキャンセルする
  // (手詰まりチェックと目標達成遅延を別々のタイマーで管理すると、片方が発火しないまま
  //  もう片方も発火してresolveWaveEndが二重に走り、アイテム選択肢が無言ですり替わるため)
  let pendingTimer: ReturnType<typeof setTimeout> | null = null

  function clearPendingTimer() {
    if (pendingTimer) clearTimeout(pendingTimer)
    pendingTimer = null
  }

  onDestroy(clearPendingTimer)

  let stage = $derived(params.stages[run.stageIndex])
  let target = $derived(stage.targets[run.waveIndex])
  let wave = $derived(run.wave)

  const comboColor = ['text-emerald-100', 'text-yellow-300', 'text-orange-400', 'text-rose-400']
  const comboScale = ['scale-100', 'scale-105', 'scale-110', 'scale-125']

  function modifierLabel(modifier: StageModifier): string {
    if (modifier === 'noLoop') return 'A-Kループ禁止'
    if (modifier === 'faceLock') return '絵札はコンボ2以上でのみ取れる'
    return '制約なし'
  }

  function scheduleStuckCheck() {
    clearPendingTimer()
    pendingTimer = setTimeout(() => {
      pendingTimer = null
      const checked = applyStuckCheck(params, run)
      // 不屈の護符による復活はstatusが'playing'のまま(手詰まりだけ解消される)ため、
      // ここは必ず無条件でrunへ反映すること。「status==='ended'の時だけ反映」に戻すと、
      // 復活結果(捨て札→山札・スコア消費)が画面に一切反映されず実質操作不能になる。
      run = checked
      if (checked.wave?.status === 'ended') {
        run = resolveWaveEnd(params, checked)
      }
    }, 600)
  }

  function afterAction() {
    clearPendingTimer()
    if (run.wave?.status === 'ended') {
      const delay = run.wave.endReason === 'target' ? params.flow.clearDelayMs : 0
      pendingTimer = setTimeout(() => {
        pendingTimer = null
        run = resolveWaveEnd(params, run)
      }, delay)
      return
    }
    scheduleStuckCheck()
  }

  function startGame() {
    run = beginRun(params)
    afterAction()
  }

  function handlePlayCard(colIndex: number) {
    if (run.phase !== 'playing' || run.wave?.status !== 'playing') return
    run = applyPlayCard(params, run, colIndex)
    afterAction()
  }

  function handleDraw() {
    if (run.phase !== 'playing' || run.wave?.status !== 'playing') return
    run = applyDrawStock(params, run)
    afterAction()
  }

  function handlePickItem(id: ItemId) {
    run = pickItem(params, run, id)
    if (run.phase === 'itemSelect') return // 上限到達時: 交換対象選択待ちのため、まだウェーブは進んでいない
    afterAction()
  }

  function handleSkipItem() {
    run = skipItemSelect(params, run)
    afterAction()
  }

  function handleConfirmSwap(oldItemId: ItemId) {
    run = confirmItemSwap(params, run, oldItemId)
    afterAction()
  }

  function handleCancelSwap() {
    run = cancelItemSwap(run)
  }

  function handleAdvanceStage() {
    run = advanceStage(params, run)
    afterAction()
  }

  function handleRestart() {
    run = restartRun(params)
    afterAction()
  }

  function handleForceDraw(suit: Suit, rank: Rank, wild: boolean) {
    if (!run.wave) return
    run = { ...run, wave: forceStockTop(run.wave, suit, rank, wild) }
    handleDraw()
  }
</script>

{#snippet cardFace(card: Card, covered: boolean)}
  {#if card.wild}
    <div
      class="relative w-full rounded-lg border p-1 flex flex-col items-start overflow-hidden select-none"
      style="aspect-ratio: 2 / 3; background:#EDE4FF; border-color:#A78BFA; color:#6D28D9;"
    >
      <div class="flex items-center gap-0.5 leading-none">
        <span class="text-sm font-bold leading-none">{rankLabel(card)}</span>
      </div>
      {#if !covered}
        <div class="w-full flex-1 flex items-center justify-center">
          <span class="leading-none" style="font-size:26px;">{rankLabel(card)}</span>
        </div>
        <div class="rotate-180 self-end flex items-center gap-0.5 leading-none">
          <span class="text-sm font-bold leading-none">{rankLabel(card)}</span>
        </div>
      {/if}
    </div>
  {:else}
    {@const colorClass = isRed(card) ? 'text-red-600' : 'text-slate-900'}
    <div
      class="relative w-full rounded-lg border border-indigo-500/50 p-1 flex flex-col items-start overflow-hidden bg-white select-none"
      style="aspect-ratio: 2 / 3;"
    >
      <div class="flex items-center gap-0.5 leading-none {colorClass}">
        <span class="text-sm font-bold leading-none">{rankLabel(card)}</span>
        <span class="text-xs leading-none">{card.suit}</span>
      </div>
      {#if !covered}
        {#if card.rank <= 10}
          <div class="w-full flex-1 relative {colorClass}">
            {#each (PIP_LAYOUTS[card.rank] ?? []) as [x, y, rot], i (i)}
              <span
                class="absolute leading-none select-none"
                style="left:{x}%; top:{y}%; transform:translate(-50%,-50%){rot ? ' rotate(180deg)' : ''}; font-size:{card.rank === 1 ? 18 : card.rank <= 4 ? 11 : card.rank <= 7 ? 10 : 9}px;"
              >{card.suit}</span>
            {/each}
          </div>
        {:else}
          <div class="w-full flex-1 flex items-center justify-center {colorClass}">
            <span class="leading-none" style="font-size:26px;">{FACE_CHAR[card.rank]}</span>
          </div>
        {/if}
        <div class="rotate-180 self-end flex items-center gap-0.5 leading-none {colorClass}">
          <span class="text-sm font-bold leading-none">{rankLabel(card)}</span>
          <span class="text-xs leading-none">{card.suit}</span>
        </div>
      {/if}
    </div>
  {/if}
{/snippet}

{#snippet playArea(displayWave: WaveState)}
  {@const playableCols = getPlayableColumns(stage.modifier, displayWave)}
  {@const remainingCards = remainingCount(displayWave.tableau)}
  {@const displayComboTier = (() => {
    const [t1, t2, t3] = params.ui.comboTierThresholds
    return displayWave.combo >= t3 ? 3 : displayWave.combo >= t2 ? 2 : displayWave.combo >= t1 ? 1 : 0
  })()}
  {@const chainEntries = displayWave.chain.map((c, i) => ({ card: c, origin: displayWave.chainOrigin[i] }))}
  {@const chainRows = chunk(chainEntries, params.ui.chainCardsPerRow)}
  <div class="px-4 pt-3">
    <div class="flex items-center justify-between text-xs">
      <div class="flex items-center gap-2">
        <span class="font-black text-amber-50">{stage.name}</span>
        <span class="flex gap-1">
          {#each [0, 1, 2] as w (w)}
            <span class="w-2 h-2 rounded-full {w < run.waveIndex ? 'bg-yellow-400' : w === run.waveIndex ? 'bg-yellow-400 animate-pulse' : 'bg-emerald-800'}"></span>
          {/each}
        </span>
      </div>
      <span class="text-emerald-300/80">{modifierLabel(stage.modifier)}</span>
    </div>

    <div class="mt-2 flex items-end justify-between">
      <div>
        <div class="text-xs text-emerald-300/70 tracking-widest">SCORE / TARGET</div>
        <div class="text-xl font-black text-amber-50 tabular-nums">
          {displayWave.score} <span class="text-sm text-emerald-300/70">/ {target}</span>
        </div>
      </div>
      <div class="text-right transition-transform origin-bottom-right {comboScale[displayComboTier]}">
        <div class="text-xs text-emerald-300/70 tracking-widest">COMBO</div>
        <div class="text-3xl font-black italic tabular-nums leading-none {comboColor[displayComboTier]}">×{displayWave.combo}</div>
      </div>
    </div>
    <div class="mt-1 h-1.5 rounded-full bg-emerald-900 overflow-hidden">
      <div class="h-full bg-gradient-to-r from-yellow-500 to-yellow-300 transition-all duration-300" style="width:{Math.min(100, (displayWave.score / target) * 100)}%"></div>
    </div>
    {#if displayWave.lastGain}
      <div class="text-right text-sm h-5">
        <span class="text-yellow-300 font-black">+{displayWave.lastGain.points}</span>
        {#if displayWave.lastGain.parts.length > 0}
          <span class="text-emerald-200 text-xs ml-2">{displayWave.lastGain.parts.join(' ')}</span>
        {/if}
      </div>
    {:else}
      <div class="h-5"></div>
    {/if}
  </div>

  <div class="px-3 pt-1">
    <div class="grid gap-1" style="grid-template-columns: repeat({params.layout.cols}, minmax(0, 1fr));">
      {#each displayWave.tableau as col, ci (ci)}
        <div class="relative" style="min-height: 10.5rem;">
          {#each col as card, ri (card.id)}
            {@const isTop = ri === col.length - 1}
            <div class="absolute left-0 right-0" style="top:{ri * 18}px; z-index:{ri};">
              {#if isTop}
                <button
                  type="button"
                  onclick={() => handlePlayCard(ci)}
                  class="w-full text-left {playableCols.has(ci) ? 'ring-2 ring-yellow-300 shadow-lg -translate-y-0.5' : ''} transition-transform"
                >
                  {@render cardFace(card, false)}
                </button>
              {:else}
                {@render cardFace(card, true)}
              {/if}
            </div>
          {/each}
        </div>
      {/each}
    </div>
    <div
      class="text-center text-emerald-300/80 text-xs mt-16 animate-pulse {playableCols.size === 0 && displayWave.stock.length > 0 && remainingCards > 0 ? '' : 'invisible'}"
    >取れる札がない → 山札をめくろう</div>
  </div>

  <div class="px-4 text-center text-yellow-300 text-xs font-black animate-pulse mb-1 {displayWave.lastDrawEffect === 'pattern' ? '' : 'invisible'}">✦ パターン継続! ✦</div>

  <div class="px-4 pb-5 pt-2 flex items-start gap-4">
    <button
      onclick={handleDraw}
      disabled={displayWave.stock.length === 0}
      style="aspect-ratio: 2 / 3; margin-top:20px;"
      class="w-16 shrink-0 rounded-lg border-2 flex flex-col items-center justify-center font-black active:scale-95 transition-transform {displayWave.stock.length > 0 ? 'bg-emerald-700 border-emerald-500 text-amber-50' : 'bg-emerald-900 border-emerald-800 text-emerald-700'}"
    >
      <div class="text-xs">山札</div>
      <div class="text-lg tabular-nums">{displayWave.stock.length}</div>
    </button>
    <div class="overflow-x-auto min-w-0">
      {#each chainRows as row, ri (ri)}
        <div class="relative" style="height:116px; width:{64 + (row.length - 1) * params.ui.chainCardOffsetX}px;">
          {#each row as entry, j (entry.card.id)}
            <div
              class="absolute"
              style="left:{j * params.ui.chainCardOffsetX}px; top:{entry.origin === 'draw' ? 20 : 0}px; z-index:{j + 1}; width:64px;"
            >
              {@render cardFace(entry.card, false)}
            </div>
          {/each}
        </div>
      {/each}
    </div>
    <div class="flex-1 flex flex-wrap gap-1 justify-end">
      {#each [...new Set(run.items)] as id (id)}
        {@const n = run.items.filter(x => x === id).length}
        <span class="text-xs bg-emerald-900 text-yellow-200/90 border border-yellow-600/40 rounded px-1.5 py-0.5">
          {ITEM_NAMES[id]}{n > 1 ? `×${n}` : ''}
        </span>
      {/each}
    </div>
  </div>
{/snippet}

<div
  class="w-full flex flex-col bg-emerald-950 text-amber-50 mx-auto"
  style="user-select:none; max-width:480px; position:relative;"
>

{#if run.phase === 'title'}
  <!-- プレイ画面と同じ高さになるよう、画面外に隠して1度描画し実測する -->
  <div
    style="position:absolute; top:0; left:0; width:100%; visibility:hidden; pointer-events:none; z-index:-1;"
    aria-hidden="true"
    bind:offsetHeight={measuredPlayHeight}
  >
    {@render playArea(measurementWave)}
  </div>
  <div class="flex flex-col items-center justify-center gap-6 text-center px-6" style="min-height:{measuredPlayHeight}px;">
    <div>
      <div class="text-xs tracking-widest text-emerald-300/70 mb-2">SOLITAIRE ROGUE</div>
      <h1 class="text-4xl font-black text-amber-50">星詠みソリティア -Shidasu-</h1>
      <p class="text-emerald-100/70 text-sm mt-3 leading-relaxed">
        ランクの±1を連鎖で取ってスコアを稼ぐ<br />
        同スート・同色(3枚以上)・階段(同方向<br />
        5枚以上)でボーナスが乗る。場札を<br />
        全消しすると大きく加点され、3ウェーブ<br />
        突破でステージクリア。
      </p>
    </div>
    <button
      onclick={startGame}
      class="px-10 py-3 rounded-full bg-yellow-400 text-emerald-950 font-black text-lg active:scale-95 transition-transform"
    >
      はじめる
    </button>
  </div>

{:else if wave}
  {@render playArea(wave)}
{/if}

{#if run.phase === 'itemSelect'}
  <div class="fixed inset-0 z-50 bg-emerald-950/90 backdrop-blur-sm flex items-center justify-center p-6">
    <div class="w-full max-w-sm flex flex-col items-center text-center">
      <div class="text-yellow-300 text-xs tracking-widest mb-1">WAVE {run.waveIndex + 1} CLEAR</div>
      <div class="text-2xl font-black text-amber-50 mb-4">{run.wave?.score ?? 0} 点</div>
      {#if run.pendingNewItem === null}
        <div class="text-emerald-100/70 text-sm mb-4">アイテムを1つ選ぶ</div>
        <div class="flex flex-col gap-3 w-full">
          {#each run.offer as id (id)}
            <button
              onclick={() => handlePickItem(id)}
              class="text-left bg-emerald-900/80 border border-yellow-500/40 rounded-xl px-4 py-3 active:scale-[0.98] transition-transform"
            >
              <div class="font-black text-yellow-300">{ITEM_NAMES[id]}</div>
              <div class="text-xs text-emerald-100/80 mt-0.5">{itemDesc(id, params)}</div>
            </button>
          {/each}
          <button
            onclick={handleSkipItem}
            class="text-center text-emerald-200/70 border border-emerald-700/60 rounded-xl px-4 py-2 active:scale-[0.98] transition-transform"
          >
            取得しない
          </button>
        </div>
      {:else}
        <div class="text-emerald-100/70 text-sm mb-4">護符は最大{params.items.maxItems}個まで。入れ替える護符を選ぶ</div>
        <div class="flex flex-col gap-3 w-full">
          {#each run.items as id, i (i)}
            <button
              onclick={() => handleConfirmSwap(id)}
              class="text-left bg-emerald-900/80 border border-yellow-500/40 rounded-xl px-4 py-3 active:scale-[0.98] transition-transform"
            >
              <div class="font-black text-yellow-300">{ITEM_NAMES[id]}</div>
              <div class="text-xs text-emerald-100/80 mt-0.5">{itemDesc(id, params)}</div>
            </button>
          {/each}
          <button
            onclick={handleCancelSwap}
            class="text-center text-emerald-200/70 border border-emerald-700/60 rounded-xl px-4 py-2 active:scale-[0.98] transition-transform"
          >
            戻る
          </button>
        </div>
      {/if}
    </div>
  </div>
{:else if run.phase === 'stageClear'}
  <div class="fixed inset-0 z-50 bg-emerald-950/90 backdrop-blur-sm flex items-center justify-center p-6">
    <div class="w-full max-w-sm flex flex-col items-center text-center">
      <div class="text-yellow-300 text-xs tracking-widest mb-2">STAGE CLEAR</div>
      <div class="text-3xl font-black text-amber-50 mb-4">{stage.name} 突破!</div>
      <div class="bg-emerald-900/80 border border-emerald-500/40 rounded-xl px-4 py-3 mb-5 text-sm">
        <div class="text-emerald-300/80 text-xs mb-1">次のステージの制約</div>
        <div class="font-bold text-amber-50">{modifierLabel(params.stages[run.stageIndex + 1].modifier)}</div>
      </div>
      <button onclick={handleAdvanceStage} class="px-10 py-3 rounded-full bg-yellow-400 text-emerald-950 font-black active:scale-95 transition-transform">
        次のステージへ
      </button>
    </div>
  </div>
{:else if run.phase === 'allClear'}
  <div class="fixed inset-0 z-50 bg-emerald-950/90 backdrop-blur-sm flex items-center justify-center p-6">
    <div class="w-full max-w-sm flex flex-col items-center text-center">
      <div class="text-3xl font-black text-yellow-300 mb-2">全ステージクリア!</div>
      <div class="text-emerald-100/80 text-sm mb-6">全ての山を制覇した</div>
      <button onclick={handleRestart} class="px-10 py-3 rounded-full bg-yellow-400 text-emerald-950 font-black active:scale-95">
        もう一度
      </button>
    </div>
  </div>
{:else if run.phase === 'gameOver'}
  <div class="fixed inset-0 z-50 bg-emerald-950/90 backdrop-blur-sm flex items-center justify-center p-6">
    <div class="w-full max-w-sm flex flex-col items-center text-center">
      <div class="text-rose-400 text-xs tracking-widest mb-2">GAME OVER</div>
      <div class="text-2xl font-black text-amber-50 mb-1">{run.wave?.score ?? 0} / {target}</div>
      <div class="text-emerald-100/70 text-sm mb-6">目標スコアに届かなかった</div>
      <button onclick={handleRestart} class="px-10 py-3 rounded-full bg-yellow-400 text-emerald-950 font-black active:scale-95">
        最初から
      </button>
    </div>
  </div>
{/if}

</div>

{#if import.meta.env.DEV && wave}
  <div class="w-full mx-auto" style="max-width:480px;">
    <DebugPanel {wave} onForceDraw={handleForceDraw} />
  </div>
{/if}
