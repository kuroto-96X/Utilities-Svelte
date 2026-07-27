<script lang="ts">
  import type { Snippet } from 'svelte'
  import { onDestroy } from 'svelte'
  import { getPlayableColumns, isPlayable, remainingCount } from '$lib/game/shidasu/engine'
  import type { WaveState, StageModifier, ItemId, RiteId, RevelationId, Card } from '$lib/game/shidasu/types'
  import type { ShidasuParams } from '$lib/game/shidasu/params'
  import { canUseRite } from '$lib/game/shidasu/riteEffects'
  import { riteDesc } from '$lib/game/shidasu/rites'
  import { canUseRevelation } from '$lib/game/shidasu/revelationEffects'
  import { revelationDesc } from '$lib/game/shidasu/revelations'
  import { nextChainSlotPosition } from '$lib/game/shidasu/chainLayout'
  import CardFace from './CardFace.svelte'
  import SuitCountPanel from './SuitCountPanel.svelte'

  let {
    wave, params, modifier, target, items, onPlayCard, onDraw, dropTarget = null, headerExtra, extraFooter,
    rites = [], onUseRite,
    revelations = [], onUseRevelationClick,
    showScoreAndCombo = true,
    allowDraw = true,
    columnTargetMode = false,
    canTargetColumn = () => true,
    onTargetColumn,
    chainAreaExtra,
  }: {
    wave: WaveState
    params: ShidasuParams
    modifier: StageModifier
    target: number
    items: ItemId[]
    onPlayCard: (colIndex: number, rowIndex: number) => void
    onDraw: () => void
    dropTarget?: { col: number; row: number } | 'stockTop' | null
    headerExtra?: Snippet
    extraFooter?: Snippet
    rites?: RiteId[]
    onUseRite?: (riteId: RiteId) => void
    revelations?: RevelationId[]
    onUseRevelationClick?: (revelationId: RevelationId) => void
    showScoreAndCombo?: boolean
    allowDraw?: boolean
    columnTargetMode?: boolean
    canTargetColumn?: (colIndex: number) => boolean
    onTargetColumn?: (colIndex: number) => void
    chainAreaExtra?: Snippet
  } = $props()

  let tableauEl: HTMLDivElement | undefined = $state()
  let chainAreaEl: HTMLDivElement | undefined = $state()

  interface PlayingAnimation {
    card: Card
    colIndex: number
    rowIndex: number
    phase: 'up' | 'warp' | 'left'
    left: number
    top: number
    transitionMs: number
  }

  let playingAnimation = $state<PlayingAnimation | null>(null)

  const ANIMATION_UP_MS = 150
  const ANIMATION_LEFT_MS = 200

  let animationTimer1: ReturnType<typeof setTimeout> | undefined
  let animationTimer2: ReturnType<typeof setTimeout> | undefined

  onDestroy(() => {
    clearTimeout(animationTimer1)
    clearTimeout(animationTimer2)
  })

  function startPlayCardAnimation(colIndex: number, rowIndex: number, card: Card) {
    if (playingAnimation) return
    clearTimeout(animationTimer1)
    clearTimeout(animationTimer2)
    if (!tableauEl || !chainAreaEl) {
      onPlayCard(colIndex, rowIndex)
      return
    }
    const cardEl = tableauEl.querySelector<HTMLElement>(`[data-drop-col="${colIndex}"][data-drop-row="${rowIndex}"]`)
    if (!cardEl) {
      onPlayCard(colIndex, rowIndex)
      return
    }
    const cardRect = cardEl.getBoundingClientRect()
    const chainRect = chainAreaEl.getBoundingClientRect()
    const slot = nextChainSlotPosition(wave.chain.length, params.ui.chainCardOffsetX, params.ui.chainCardsPerRow)
    const targetLeft = chainRect.left + slot.left
    const targetTop = chainRect.top + slot.top
    const warpLeft = chainRect.right + 200

    playingAnimation = {
      card, colIndex, rowIndex,
      phase: 'up',
      left: cardRect.left, top: -100,
      transitionMs: ANIMATION_UP_MS,
    }

    animationTimer1 = setTimeout(() => {
      if (!playingAnimation) return
      playingAnimation = { ...playingAnimation, phase: 'warp', left: warpLeft, top: targetTop, transitionMs: 0 }
      // transitionMs:0でのスタイル変更をブラウザが実際に描画へ反映してから次のtransitionを開始するために2段rAFが必要。
      // 1段のrAFだけだと同一フレーム内でスタイル変更がバッチ処理され、ワープにならずtransitionしてしまうブラウザがある。
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!playingAnimation) return
          playingAnimation = { ...playingAnimation, phase: 'left', left: targetLeft, top: targetTop, transitionMs: ANIMATION_LEFT_MS }
        })
      })
    }, ANIMATION_UP_MS)

    animationTimer2 = setTimeout(() => {
      playingAnimation = null
      onPlayCard(colIndex, rowIndex)
    }, ANIMATION_UP_MS + ANIMATION_LEFT_MS)
  }

  function chunk<T>(arr: T[], size: number): T[][] {
    const result: T[][] = []
    for (let i = 0; i < arr.length; i += size) {
      result.push(arr.slice(i, i + size))
    }
    return result
  }

  const comboColor = ['text-emerald-100', 'text-yellow-300', 'text-orange-400', 'text-rose-400']
  const comboScale = ['scale-100', 'scale-105', 'scale-110', 'scale-125']

  let playableCols = $derived(getPlayableColumns(modifier, wave))
  let remainingCards = $derived(remainingCount(wave.tableau))
  let displayComboTier = $derived.by(() => {
    const [t1, t2, t3] = params.ui.comboTierThresholds
    return wave.combo >= t3 ? 3 : wave.combo >= t2 ? 2 : wave.combo >= t1 ? 1 : 0
  })
  let chainEntries = $derived(wave.chain.map((c, i) => ({ card: c, origin: wave.chainOrigin[i] })))
  let chainRows = $derived(chunk(chainEntries, params.ui.chainCardsPerRow))
</script>

<div class="px-4 pt-3">
  {#if headerExtra}
    {@render headerExtra()}
  {/if}
  {#if showScoreAndCombo}
    <div class="mt-2 flex items-end justify-between">
      <div>
        <div class="text-xs text-emerald-300/70 tracking-widest">SCORE / TARGET</div>
        <div class="text-xl font-black text-amber-50 tabular-nums">
          {wave.score} <span class="text-sm text-emerald-300/70">/ {target}</span>
        </div>
      </div>
      <div class="text-right transition-transform origin-bottom-right {comboScale[displayComboTier]}">
        <div class="text-xs text-emerald-300/70 tracking-widest">COMBO</div>
        <div class="text-3xl font-black italic tabular-nums leading-none {comboColor[displayComboTier]}">
          ×{wave.combo}{#if wave.baseComboCount > 0}<span class="text-lg not-italic ml-1 text-emerald-300/80">+{wave.baseComboCount}</span>{/if}
        </div>
      </div>
    </div>
  {/if}
  <div class="mt-1 h-1.5 rounded-full bg-emerald-900 overflow-hidden">
    <div class="h-full bg-gradient-to-r from-yellow-500 to-yellow-300 transition-all duration-300" style="width:{Math.min(100, (wave.score / target) * 100)}%"></div>
  </div>
  {#if wave.lastGain || wave.lastBonusGains.length > 0}
    {@const totalPoints = (wave.lastGain?.points ?? 0) + wave.lastBonusGains.reduce((sum, g) => sum + g.points, 0)}
    {@const allParts = [...(wave.lastGain?.parts ?? []), ...wave.lastBonusGains.flatMap(g => g.parts)]}
    <div class="text-right text-sm h-5">
      <span class="text-yellow-300 font-black">+{totalPoints}</span>
      {#if allParts.length > 0}
        <span class="text-emerald-200 text-xs ml-2">{allParts.join(' ')}</span>
      {/if}
    </div>
  {:else}
    <div class="h-5"></div>
  {/if}
</div>

<SuitCountPanel {wave} />

<div class="px-3 pt-1">
  <div bind:this={tableauEl} class="grid gap-1" style="grid-template-columns: repeat({params.layout.cols}, minmax(0, 1fr));">
    {#each wave.tableau as col, ci (ci)}
      <div class="relative" style="min-height: 10.5rem;">
        {#each col as card, ri (card.id)}
          {@const isTop = ri === col.length - 1}
          {@const isSelectable = columnTargetMode ? isTop : (isTop || wave.playFromAnywhereActiveThisWave)}
          {@const isAnimatingThisCard = playingAnimation?.colIndex === ci && playingAnimation?.rowIndex === ri}
          <div
            class="absolute left-0 right-0 {dropTarget && dropTarget !== 'stockTop' && dropTarget.col === ci && dropTarget.row === ri ? 'ring-4 ring-sky-400 rounded-lg' : ''} {isAnimatingThisCard ? 'invisible' : ''}"
            style="top:{ri * 18}px; z-index:{ri};"
            data-drop-col={ci}
            data-drop-row={ri}
          >
            {#if isSelectable}
              {@const isTargetable = columnTargetMode && canTargetColumn(ci)}
              {@const isCardPlayable = !columnTargetMode && isPlayable(modifier, wave, card)}
              <button
                type="button"
                disabled={playingAnimation !== null}
                onclick={() => (columnTargetMode ? (isTargetable && onTargetColumn?.(ci)) : startPlayCardAnimation(ci, ri, card))}
                class="w-full text-left {columnTargetMode ? (isTargetable ? 'ring-2 ring-fuchsia-400 shadow-lg -translate-y-0.5' : '') : (isCardPlayable ? 'ring-2 ring-yellow-300 shadow-lg -translate-y-0.5' : '')} transition-transform disabled:cursor-not-allowed"
              >
                <CardFace {card} covered={false} />
              </button>
            {:else}
              <CardFace {card} covered={true} />
            {/if}
          </div>
        {/each}
        {#if col.length === 0 && columnTargetMode}
          {@const isTargetable = canTargetColumn(ci)}
          <button
            type="button"
            onclick={() => isTargetable && onTargetColumn?.(ci)}
            aria-label="空の列{ci + 1}"
            class="absolute left-0 right-0 top-0 w-full rounded-lg border-2 border-dashed {isTargetable ? 'border-fuchsia-400' : 'border-transparent'}"
            style="aspect-ratio: 2 / 3;"
          ></button>
        {/if}
      </div>
    {/each}
  </div>
  <div
    class="text-center text-emerald-300/80 text-xs mt-16 animate-pulse {playableCols.size === 0 && wave.stock.length > 0 && remainingCards > 0 ? '' : 'invisible'}"
  >取れる札がない → 山札をめくろう</div>
</div>

<div class="px-4 text-center text-yellow-300 text-xs font-black animate-pulse mb-1 {wave.lastDrawEffect === 'pattern' ? '' : 'invisible'}">✦ パターン継続! ✦</div>

<div class="px-4 pb-5 pt-2 flex items-start gap-4">
  <button
    type="button"
    onclick={onDraw}
    disabled={wave.stock.length === 0 || !allowDraw || playingAnimation !== null}
    data-drop-stock
    style="aspect-ratio: 2 / 3; margin-top:20px;"
    class="w-16 shrink-0 rounded-lg border-2 flex flex-col items-center justify-center font-black active:scale-95 transition-transform {dropTarget === 'stockTop' ? 'ring-4 ring-sky-400' : ''} {wave.stock.length > 0 ? 'bg-emerald-700 border-emerald-500 text-amber-50' : 'bg-emerald-900 border-emerald-800 text-emerald-700'}"
  >
    <div class="text-xs">山札</div>
    <div class="text-lg tabular-nums">{wave.stock.length}</div>
  </button>
  {#if items.includes('guidance') && wave.stock.length > 0}
    {@const nextCard = wave.stock[wave.stock.length - 1]}
    <div class="flex flex-col items-center justify-center" style="margin-top:20px;">
      <div class="text-[10px] text-emerald-300/70 mb-1">次の札</div>
      <CardFace card={nextCard} covered={false} />
    </div>
  {/if}
  <div bind:this={chainAreaEl} class="overflow-x-auto min-w-0">
    {#if chainAreaExtra}
      {@render chainAreaExtra()}
    {:else}
      {#each chainRows as row, ri (ri)}
        <div class="relative" style="height:116px; width:{64 + (row.length - 1) * params.ui.chainCardOffsetX}px;">
          {#each row as entry, j (entry.card.id)}
            <div
              class="absolute"
              style="left:{j * params.ui.chainCardOffsetX}px; top:{entry.origin === 'draw' ? 20 : 0}px; z-index:{j + 1}; width:64px;"
            >
              <CardFace card={entry.card} covered={false} />
            </div>
          {/each}
        </div>
      {/each}
    {/if}
  </div>
  {#if extraFooter}
    {@render extraFooter()}
  {/if}
</div>

{#if rites.length > 0}
  <div class="px-4 pb-4 flex items-center gap-2">
    {#each rites as riteId, i (i)}
      {@const usable = canUseRite(params, wave, riteId) && playingAnimation === null}
      <button
        type="button"
        onclick={() => onUseRite?.(riteId)}
        disabled={!usable}
        title={riteDesc(riteId, params)}
        style="font-family: 'ShidasuRunic', sans-serif;"
        class="w-10 h-10 rounded-lg border-2 flex items-center justify-center text-xl font-black transition-transform active:scale-95 {usable ? 'bg-fuchsia-900 border-fuchsia-500 text-fuchsia-100 hover:bg-fuchsia-800' : 'bg-slate-800 border-slate-700 text-slate-600 cursor-not-allowed'}"
      >{params.rites[riteId].name}</button>
    {/each}
  </div>
{/if}

{#if revelations.length > 0}
  <div class="px-4 pb-4 flex items-center gap-2">
    {#each revelations as revelationId, i (i)}
      {@const usable = canUseRevelation(params, wave, revelationId) && playingAnimation === null}
      <button
        type="button"
        onclick={() => onUseRevelationClick?.(revelationId)}
        disabled={!usable}
        title={revelationDesc(revelationId, params)}
        class="w-10 h-10 rounded-lg border-2 flex items-center justify-center text-lg font-black transition-transform active:scale-95 {usable ? 'bg-indigo-900 border-indigo-500 text-indigo-100 hover:bg-indigo-800' : 'bg-slate-800 border-slate-700 text-slate-600 cursor-not-allowed'}"
      >{params.revelations[revelationId].name}</button>
    {/each}
  </div>
{/if}

{#if playingAnimation}
  <div
    class="fixed pointer-events-none z-[100] ease-out"
    style="left:{playingAnimation.left}px; top:{playingAnimation.top}px; width:64px; transition-property:left,top; transition-duration:{playingAnimation.transitionMs}ms;"
  >
    <CardFace card={playingAnimation.card} covered={false} />
  </div>
{/if}
