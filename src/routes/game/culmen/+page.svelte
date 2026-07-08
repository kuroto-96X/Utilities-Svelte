<script lang="ts">
  import { onDestroy } from 'svelte'
  import { loadParams } from '$lib/game/culmen/params'
  import {
    createInitialRun, beginRun, applyPlayCard, applyDrawStock, applyStuckCheck,
    resolveWaveEnd, pickItem, advanceStage, restartRun,
    getPlayableColumns, remainingCount, rankLabel, isRed, itemDesc, ITEM_NAMES,
  } from '$lib/game/culmen/engine'
  import type { RunState, Card, ItemId, StageModifier } from '$lib/game/culmen/types'

  const params = loadParams()

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
  let playableColumns = $derived(wave ? getPlayableColumns(stage.modifier, wave) : new Set<number>())
  let remaining = $derived(wave ? remainingCount(wave.tableau) : 0)

  let comboTier = $derived.by(() => {
    const combo = wave?.combo ?? 0
    const [t1, t2, t3] = params.ui.comboTierThresholds
    return combo >= t3 ? 3 : combo >= t2 ? 2 : combo >= t1 ? 1 : 0
  })
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
    if (run.phase !== 'playing') return
    run = applyPlayCard(params, run, colIndex)
    afterAction()
  }

  function handleDraw() {
    if (run.phase !== 'playing') return
    run = applyDrawStock(params, run)
    afterAction()
  }

  function handlePickItem(id: ItemId) {
    run = pickItem(params, run, id)
    afterAction()
  }

  function handleAdvanceStage() {
    run = advanceStage(params, run)
    afterAction()
  }

  function handleRestart() {
    run = restartRun(params)
    afterAction()
  }
</script>

{#snippet cardFace(card: Card, covered: boolean)}
  {#if card.wild}
    <div
      class="relative w-full rounded-md border select-none flex items-end justify-center pb-1"
      style="aspect-ratio: 2 / 3; background:#EDE4FF; color:#6D28D9; border-color:#A78BFA;"
    >
      <div class="absolute top-0.5 left-1 font-black" style="font-size:13px;">★</div>
      {#if !covered}<span class="text-base font-bold">★</span>{/if}
    </div>
  {:else}
    <div
      class="relative w-full rounded-md border select-none"
      style="aspect-ratio: 2 / 3; background:{covered ? '#E9E2D0' : '#FBF7EC'}; color:{isRed(card) ? '#C7402D' : '#15181D'}; border-color:#B8AE98;"
    >
      <div class="absolute top-0.5 left-1 flex items-baseline gap-0.5 leading-none">
        <span class="font-black" style="font-size:13px;">{rankLabel(card)}</span>
        <span class="font-bold" style="font-size:10px;">{card.suit}</span>
      </div>
      {#if !covered}
        <div class="absolute inset-0 flex items-end justify-center pb-1 text-base font-bold">{card.suit}</div>
      {/if}
    </div>
  {/if}
{/snippet}

<div
  class="w-full flex flex-col bg-emerald-950 text-amber-50 mx-auto"
  style="user-select:none; max-width:480px;"
>

{#if run.phase === 'title'}
  <div class="flex flex-col items-center justify-center flex-1 gap-6 text-center px-6">
    <div>
      <div class="text-xs tracking-widest text-emerald-300/70 mb-2">SOLITAIRE ROGUE</div>
      <h1 class="text-4xl font-black text-amber-50">登頂ソリティア -Culmen-</h1>
      <p class="text-emerald-100/70 text-sm mt-3 leading-relaxed">
        ランクの±1を連鎖で取ってスコアを稼ぐ<br />
        同スート・同色・階段(同方向3枚以上)で<br />
        ボーナスが乗る。場札を全消しすると<br />
        大きく加点され、3ウェーブ突破で<br />
        ステージクリア。
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
          {wave.score} <span class="text-sm text-emerald-300/70">/ {target}</span>
        </div>
      </div>
      <div class="text-right transition-transform origin-bottom-right {comboScale[comboTier]}">
        <div class="text-xs text-emerald-300/70 tracking-widest">COMBO</div>
        <div class="text-3xl font-black italic tabular-nums leading-none {comboColor[comboTier]}">×{wave.combo}</div>
      </div>
    </div>
    <div class="mt-1 h-1.5 rounded-full bg-emerald-900 overflow-hidden">
      <div class="h-full bg-gradient-to-r from-yellow-500 to-yellow-300 transition-all duration-300" style="width:{Math.min(100, (wave.score / target) * 100)}%"></div>
    </div>
    {#if wave.lastGain}
      <div class="text-right text-sm h-5">
        <span class="text-yellow-300 font-black">+{wave.lastGain.points}</span>
        {#if wave.lastGain.parts.length > 0}
          <span class="text-emerald-200 text-xs ml-2">{wave.lastGain.parts.join(' ')}</span>
        {/if}
      </div>
    {:else}
      <div class="h-5"></div>
    {/if}
  </div>

  <div class="px-3 pt-1">
    <div class="grid gap-1" style="grid-template-columns: repeat({params.layout.cols}, minmax(0, 1fr));">
      {#each wave.tableau as col, ci (ci)}
        <div class="relative" style="min-height: 10.5rem;">
          {#each col as card, ri (card.id)}
            {@const isTop = ri === col.length - 1}
            <div class="absolute left-0 right-0" style="top:{ri * 18}px; z-index:{ri};">
              {#if isTop}
                <button
                  type="button"
                  onclick={() => handlePlayCard(ci)}
                  class="w-full text-left {playableColumns.has(ci) ? 'ring-2 ring-yellow-300 shadow-lg -translate-y-0.5' : ''} transition-transform"
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
    {#if playableColumns.size === 0 && wave.stock.length > 0 && remaining > 0}
      <div class="text-center text-emerald-300/80 text-xs mt-16 animate-pulse">取れる札がない → 山札をめくろう</div>
    {/if}
  </div>

  <div class="px-4 flex items-center gap-1 overflow-x-auto" style="min-height: 2.6rem;">
    {#each wave.chain as c, i (c.id)}
      <div
        class="flex-none rounded border text-center font-black leading-none flex flex-col items-center justify-center"
        style="width:24px; height:34px; font-size:11px; background:{c.wild ? '#EDE4FF' : '#FBF7EC'}; color:{c.wild ? '#6D28D9' : isRed(c) ? '#C7402D' : '#15181D'}; border-color:{c.wild ? '#A78BFA' : '#B8AE98'}; opacity:{!wave.linked && i === wave.chain.length - 1 ? 0.55 : 1};"
      >
        <div>{rankLabel(c)}</div>
        <div style="font-size:9px;">{c.suit}</div>
      </div>
    {/each}
    {#if wave.chain.length === 0}
      <div class="text-emerald-300/50 text-xs">取った札がここに並ぶ → 同スート/同色/階段でボーナス</div>
    {/if}
  </div>

  <div class="px-4 pb-5 pt-2 flex items-center gap-4">
    <button
      onclick={handleDraw}
      disabled={wave.stock.length === 0}
      style="aspect-ratio: 2 / 3;"
      class="w-16 rounded-lg border-2 flex flex-col items-center justify-center font-black active:scale-95 transition-transform {wave.stock.length > 0 ? 'bg-emerald-700 border-emerald-500 text-amber-50' : 'bg-emerald-900 border-emerald-800 text-emerald-700'}"
    >
      <div class="text-xs">山札</div>
      <div class="text-lg tabular-nums">{wave.stock.length}</div>
    </button>
    <div class="w-16">
      {@render cardFace(wave.foundation, false)}
    </div>
    <div class="flex-1 flex flex-wrap gap-1 justify-end">
      {#if wave.shieldLeft > 0}
        <span class="text-xs bg-sky-900 text-sky-200 border border-sky-600 rounded px-1.5 py-0.5">盾×{wave.shieldLeft}</span>
      {/if}
      {#each [...new Set(run.items)] as id (id)}
        {@const n = run.items.filter(x => x === id).length}
        <span class="text-xs bg-emerald-900 text-yellow-200/90 border border-yellow-600/40 rounded px-1.5 py-0.5">
          {ITEM_NAMES[id]}{n > 1 ? `×${n}` : ''}
        </span>
      {/each}
    </div>
  </div>
{/if}

{#if run.phase === 'itemSelect'}
  <div class="fixed inset-0 z-50 bg-emerald-950/90 backdrop-blur-sm flex items-center justify-center p-6">
    <div class="w-full max-w-sm flex flex-col items-center text-center">
      <div class="text-yellow-300 text-xs tracking-widest mb-1">WAVE {run.waveIndex + 1} CLEAR</div>
      <div class="text-2xl font-black text-amber-50 mb-4">{run.wave?.score ?? 0} 点</div>
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
      </div>
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
