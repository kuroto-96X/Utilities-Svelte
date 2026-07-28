<script lang="ts">
  import type { Snippet } from 'svelte'
  import { onDestroy, tick } from 'svelte'
  import { getPlayableColumns, isPlayable, remainingCount } from '$lib/game/shidasu/engine'
  import type { WaveState, StageModifier, ItemId, RiteId, RevelationId, Card, PlayCardResult, ScoreGain, BonusGain } from '$lib/game/shidasu/types'
  import type { ShidasuParams } from '$lib/game/shidasu/params'
  import { canUseRite } from '$lib/game/shidasu/riteEffects'
  import { riteDesc } from '$lib/game/shidasu/rites'
  import { canUseRevelation } from '$lib/game/shidasu/revelationEffects'
  import { revelationDesc } from '$lib/game/shidasu/revelations'
  import { nextChainSlotPosition } from '$lib/game/shidasu/chainLayout'
  import { runningTotalsFromScoreParts, type ScorePart } from '$lib/game/shidasu/scoreParts'
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
    onScoreRevealDone, waveKey, onCleanupDone,
  }: {
    wave: WaveState
    params: ShidasuParams
    modifier: StageModifier
    target: number
    items: ItemId[]
    onPlayCard: (colIndex: number, rowIndex: number) => PlayCardResult | void
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
    onScoreRevealDone?: () => void
    waveKey?: string
    onCleanupDone?: () => void
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
    clearTimeout(scoreRevealTimer)
    clearTimeout(cleanupTimer)
  })

  const PART_FLYIN_CENTER_MS = 300
  const PART_FLYIN_MOVE_MS = 260
  const PART_FLYIN_SCALE = 2
  // 拡大表示(partFlyInのtext-sm=14px相当)から内訳行(text-xs=12px相当)へ着地する際、
  // 見た目の文字サイズが一致するようスケールを逆算する(14px * 0.857 ≒ 12px)。
  const PART_FLYIN_LAND_SCALE = 12 / 14
  const TOTAL_PULSE_SCALE = 2.6
  const TOTAL_PULSE_MS = 300
  const SCORE_NUMBER_PULSE_SCALE = 1.3
  const SCORE_NUMBER_PULSE_MS = 200
  const SCORE_FLY_UP_MS = 200
  const SCORE_FLY_TO_SCORE_MS = 250
  const SCORE_FLY_UP_DISTANCE_PX = 40
  const SCORE_FLY_UP_SCALE = 1.5

  interface ScoreRevealState {
    parts: ScorePart[]
    runningTotals: number[]
    revealedCount: number
    totalGain: number
    totalScale: number
    totalTransitionMs: number
    flyPhase: 'none' | 'up' | 'toScore'
    flyLeft: number
    flyTop: number
    flyScale: number
    flyTransitionMs: number
  }

  interface PartFlyInState {
    text: string
    phase: 'center' | 'toRow'
    left: number
    top: number
    scale: number
    transitionMs: number
  }

  let scoreReveal = $state<ScoreRevealState | null>(null)
  let partFlyIn = $state<PartFlyInState | null>(null)
  let displayedScore = $state(wave.score)
  let previousWaveKey = waveKey
  $effect(() => {
    if (waveKey === undefined || waveKey === previousWaveKey) return
    previousWaveKey = waveKey
    displayedScore = wave.score
    cleanedUpColumns = new Set()
    chainCleanedUp = false
  })
  let scoreNumberEl: HTMLDivElement | undefined = $state()
  let scoreNumberScale = $state(1)
  let scoreNumberTransitionMs = $state(0)
  let totalGainEl: HTMLSpanElement | undefined = $state()
  let breakdownRowEl: HTMLSpanElement | undefined = $state()
  let noPlayableHintEl: HTMLDivElement | undefined = $state()
  let stockButtonEl: HTMLButtonElement | undefined = $state()
  let discardPileEl: HTMLDivElement | undefined = $state()

  const CLEANUP_GATHER_MS = 37
  const CLEANUP_MOVE_MS = 50

  interface CleanupCardPosition {
    card: Card
    startLeft: number
    startTop: number
    left: number
    top: number
  }

  interface CleanupAnimation {
    kind: 'column' | 'chain' | 'discard'
    columnIndex: number
    card: Card
    phase: 'gather' | 'move'
    left: number
    top: number
    transitionMs: number
    gatherCards: CleanupCardPosition[]
  }

  let cleanupAnimation = $state<CleanupAnimation | null>(null)
  let cleanedUpColumns = $state<Set<number>>(new Set())
  let chainCleanedUp = $state(false)
  // UI表示には使わない内部処理専用のキューのため、意図的に$stateにしていない。
  let cleanupQueue: { kind: 'column' | 'chain' | 'discard'; columnIndex: number; card: Card }[] = []
  let cleanupTimer: ReturnType<typeof setTimeout> | undefined

  // Waveクリア確定後、場札の各列(左から右)→チェーン→捨て札の順に、
  // 各カード群を1山にまとめて山札へ移動させるアニメーションを開始する。
  function startCleanupAnimation() {
    cleanedUpColumns = new Set()
    chainCleanedUp = false
    const columnItems = wave.tableau
      .map((col, ci) => ({ columnIndex: ci, card: col[col.length - 1] }))
      .filter((entry): entry is { columnIndex: number; card: Card } => entry.card !== undefined)
      .map(entry => ({ kind: 'column' as const, columnIndex: entry.columnIndex, card: entry.card }))
    const chainItems = wave.chain.length > 0
      ? [{ kind: 'chain' as const, columnIndex: -1, card: wave.chain[wave.chain.length - 1] }]
      : []
    const discardItems = wave.discardPile.length > 0
      ? [{ kind: 'discard' as const, columnIndex: -1, card: wave.discardPile[wave.discardPile.length - 1] }]
      : []
    cleanupQueue = [...columnItems, ...chainItems, ...discardItems]
    processNextCleanupItem()
  }

  function processNextCleanupItem() {
    const item = cleanupQueue.shift()
    if (!item) {
      cleanupAnimation = null
      onCleanupDone?.()
      return
    }
    startCleanupItem(item)
  }

  function startCleanupItem(item: { kind: 'column' | 'chain' | 'discard'; columnIndex: number; card: Card }) {
    let fromEl: HTMLElement | null = null
    if (item.kind === 'column') {
      const col = wave.tableau[item.columnIndex]
      fromEl = tableauEl?.querySelector<HTMLElement>(`[data-drop-col="${item.columnIndex}"][data-drop-row="${col.length - 1}"]`) ?? null
    } else if (item.kind === 'chain') {
      fromEl = chainAreaEl ?? null
    } else {
      fromEl = discardPileEl ?? null
    }
    if (!fromEl || !stockButtonEl) {
      // 座標が取得できない(要素未マウント等)場合は、このアイテムをスキップして次へ進む。
      // stockButtonEl自体が無い場合はキュー内の全アイテムがこの分岐に入り同期的な
      // 再帰呼び出しで一気に消化されるが、キューの長さは場札の列数+チェーン+捨て札の
      // 最大10個未満に収まるため、スタックオーバーフローの実害はない。
      processNextCleanupItem()
      return
    }
    const fromRect = fromEl.getBoundingClientRect()
    const toRect = stockButtonEl.getBoundingClientRect()
    const gatherLeft = fromRect.left + fromRect.width / 2
    const gatherTop = fromRect.top + fromRect.height / 2

    let gatherCards: CleanupCardPosition[] = []
    if (item.kind === 'column' && tableauEl) {
      const col = wave.tableau[item.columnIndex]
      gatherCards = col
        .map((card, ri) => {
          const cardEl = tableauEl?.querySelector<HTMLElement>(`[data-drop-col="${item.columnIndex}"][data-drop-row="${ri}"]`)
          if (!cardEl) return null
          const cardRect = cardEl.getBoundingClientRect()
          return {
            card,
            startLeft: cardRect.left + cardRect.width / 2,
            startTop: cardRect.top + cardRect.height / 2,
            left: cardRect.left + cardRect.width / 2,
            top: cardRect.top + cardRect.height / 2,
          }
        })
        .filter((entry): entry is CleanupCardPosition => entry !== null)
    }

    cleanupAnimation = {
      kind: item.kind,
      columnIndex: item.columnIndex,
      card: item.card,
      phase: 'gather',
      left: gatherLeft,
      top: gatherTop,
      transitionMs: 0,
      gatherCards,
    }
    function scheduleMoveToStock() {
      cleanupTimer = setTimeout(() => {
        if (!cleanupAnimation) return
        // 単一オーバーレイへの切り替え(gatherCards:[]によりDOM要素が新規マウントされる)と
        // 同時に山札の位置・transitionを設定すると、要素がいきなり最終位置に出現してしまい
        // トランジションが発生しない(ワープしてしまう)。そのため、まず現在の集約位置のまま
        // transitionMs:0で単一オーバーレイに切り替え、2段rAF後に山札の位置へtransitionMs付きで
        // 変更する(既存のplayingAnimationのワープ処理と同じ理由・同じ手法)。
        cleanupAnimation = {
          ...cleanupAnimation,
          phase: 'move',
          left: gatherLeft,
          top: gatherTop,
          transitionMs: 0,
          gatherCards: [],
        }
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (!cleanupAnimation) return
            cleanupAnimation = {
              ...cleanupAnimation,
              left: toRect.left + toRect.width / 2,
              top: toRect.top + toRect.height / 2,
              transitionMs: CLEANUP_MOVE_MS,
            }
          })
        })
        if (item.kind === 'column') {
          cleanedUpColumns = new Set([...cleanedUpColumns, item.columnIndex])
        } else if (item.kind === 'chain') {
          chainCleanedUp = true
        }
        cleanupTimer = setTimeout(processNextCleanupItem, CLEANUP_MOVE_MS)
      }, CLEANUP_GATHER_MS)
    }

    if (gatherCards.length > 0) {
      // gatherCardsの初期位置(各カードの現在位置)をtransitionMs:0で表示した直後、
      // 2段rAFで一番上のカードの位置(gatherLeft/gatherTop)へ全カード同時に移動させる。
      // 1段のrAFだけだと同一フレーム内でスタイル変更がバッチ処理されtransitionが
      // 発生しないブラウザがある(既存の他アニメーションと同じ理由)。
      // moveフェーズへの切り替えタイマーは、rAFの内側(実際に移動アニメーションが
      // 開始した直後)でセットすることで、集約アニメーションが完了しきってから
      // moveフェーズへ切り替わるようにする。
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!cleanupAnimation) return
          cleanupAnimation = {
            ...cleanupAnimation,
            gatherCards: cleanupAnimation.gatherCards.map(c => ({ ...c, left: gatherLeft, top: gatherTop })),
            transitionMs: CLEANUP_GATHER_MS,
          }
          scheduleMoveToStock()
        })
      })
    } else {
      scheduleMoveToStock()
    }
  }

  let scoreRevealTimer: ReturnType<typeof setTimeout> | undefined

  let previousDisplayedScore = displayedScore
  $effect(() => {
    const current = displayedScore
    if (current === previousDisplayedScore) return
    previousDisplayedScore = current
    scoreNumberScale = SCORE_NUMBER_PULSE_SCALE
    scoreNumberTransitionMs = 0
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scoreNumberScale = 1
        scoreNumberTransitionMs = SCORE_NUMBER_PULSE_MS
      })
    })
  })

  function startScoreReveal(lastGain: ScoreGain | null, lastBonusGains: BonusGain[]) {
    const allParts = [...(lastGain?.parts ?? []), ...lastBonusGains.flatMap(g => g.parts)]
    if (allParts.length === 0) {
      displayedScore = wave.score
      onScoreRevealDone?.()
      if (wave.status === 'ended' && wave.endReason === 'target') startCleanupAnimation()
      return
    }
    const runningTotals = runningTotalsFromScoreParts(allParts)
    const totalGain = (lastGain?.points ?? 0) + lastBonusGains.reduce((sum, g) => sum + g.points, 0)
    clearTimeout(scoreRevealTimer)
    scoreReveal = {
      parts: allParts,
      runningTotals,
      revealedCount: 0,
      totalGain,
      totalScale: 1,
      totalTransitionMs: 0,
      flyPhase: 'none',
      flyLeft: 0,
      flyTop: 0,
      flyScale: 1,
      flyTransitionMs: 0,
    }
    // 内訳行(breakdownRowEl)がDOMに描画されるのを待ってから、1つ目のパーツの拡大表示を開始する。
    // 直前のscoreReveal代入だけではSvelteの描画がまだ反映されていない可能性があるため、
    // tick()で描画反映を待つ(既存のカード移動アニメ・SCORE飛び込みアニメと同じ考え方)。
    tick().then(() => startPartFlyIn(0))
  }

  // index番目のパーツを、画面中央に拡大表示してから内訳行(breakdownRowEl)へ移動させる。
  function startPartFlyIn(index: number) {
    const part = scoreReveal?.parts[index]
    if (!scoreReveal || !part || !breakdownRowEl || !noPlayableHintEl) {
      if (scoreReveal) landPart(index)
      return
    }
    const hintRect = noPlayableHintEl.getBoundingClientRect()
    partFlyIn = {
      text: part.text,
      phase: 'center',
      left: hintRect.left + hintRect.width / 2,
      top: hintRect.top + hintRect.height / 2,
      scale: PART_FLYIN_SCALE,
      transitionMs: 0,
    }
    scoreRevealTimer = setTimeout(() => {
      if (!partFlyIn || !breakdownRowEl || !scoreReveal) return
      const rowRect = breakdownRowEl.getBoundingClientRect()
      const landX = scoreReveal.revealedCount === 0 ? rowRect.left : rowRect.right
      partFlyIn = {
        ...partFlyIn,
        phase: 'toRow',
        left: landX,
        top: rowRect.top + rowRect.height / 2,
        scale: PART_FLYIN_LAND_SCALE,
        transitionMs: PART_FLYIN_MOVE_MS,
      }
      scoreRevealTimer = setTimeout(() => landPart(index), PART_FLYIN_MOVE_MS)
    }, PART_FLYIN_CENTER_MS)
  }

  // index番目のパーツを内訳行に確定表示し、合計値の強調(パルス)を行う。
  // 次のパーツがあれば続けてstartPartFlyInを呼び、無ければSCOREへの飛び込み演出へ進む。
  function landPart(index: number) {
    if (!scoreReveal) return
    partFlyIn = null
    scoreReveal = { ...scoreReveal, revealedCount: index + 1, totalScale: TOTAL_PULSE_SCALE, totalTransitionMs: 0 }
    // transitionMs:0でのスタイル変更をブラウザが実際に描画へ反映してから次のtransitionを開始するために
    // 2段rAFが必要。1段のrAFだけだと同一フレーム内でスタイル変更がバッチ処理され、
    // 拡大→元のサイズへの戻りがtransitionせず一瞬で切り替わってしまうブラウザがある。
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!scoreReveal) return
        scoreReveal = { ...scoreReveal, totalScale: 1, totalTransitionMs: TOTAL_PULSE_MS }
      })
    })
    if (index + 1 < scoreReveal.parts.length) {
      startPartFlyIn(index + 1)
    } else {
      startScoreFly()
    }
  }

  function startScoreFly() {
    if (!scoreReveal || !totalGainEl || !scoreNumberEl) {
      finishScoreReveal()
      return
    }
    const fromRect = totalGainEl.getBoundingClientRect()
    const toRect = scoreNumberEl.getBoundingClientRect()
    scoreReveal = { ...scoreReveal, flyPhase: 'up', flyLeft: fromRect.left, flyTop: fromRect.top, flyScale: 1, flyTransitionMs: 0 }
    // transitionMs:0でのスタイル変更をブラウザが実際に描画へ反映してから次のtransitionを開始するために
    // 2段rAFが必要。1段のrAFだけだと同一フレーム内でスタイル変更がバッチ処理され、transitionが
    // 発生しないブラウザがある(カード移動アニメのワープ処理と同じ理由)。
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!scoreReveal) return
        scoreReveal = {
          ...scoreReveal,
          flyLeft: fromRect.left,
          flyTop: fromRect.top - SCORE_FLY_UP_DISTANCE_PX,
          flyScale: SCORE_FLY_UP_SCALE,
          flyTransitionMs: SCORE_FLY_UP_MS,
        }
      })
    })
    scoreRevealTimer = setTimeout(() => {
      if (!scoreReveal) return
      scoreReveal = { ...scoreReveal, flyPhase: 'toScore', flyLeft: toRect.left, flyTop: toRect.top, flyScale: 1, flyTransitionMs: SCORE_FLY_TO_SCORE_MS }
      scoreRevealTimer = setTimeout(finishScoreReveal, SCORE_FLY_TO_SCORE_MS)
    }, SCORE_FLY_UP_MS)
  }

  function finishScoreReveal() {
    displayedScore = wave.score
    scoreReveal = null
    onScoreRevealDone?.()
    if (wave.status === 'ended' && wave.endReason === 'target') startCleanupAnimation()
  }

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
      left: cardRect.left, top: cardRect.top,
      transitionMs: 0,
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!playingAnimation) return
        playingAnimation = { ...playingAnimation, top: -100, transitionMs: ANIMATION_UP_MS }
      })
    })

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
      const result = onPlayCard(colIndex, rowIndex)
      if (result) startScoreReveal(result.lastGain, result.lastBonusGains)
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
  let progressBarLightPercent = $derived.by(() => {
    const finalScore = scoreReveal ? displayedScore + scoreReveal.totalGain : displayedScore
    return Math.min(100, (finalScore / target) * 100)
  })
  let progressBarDarkPercent = $derived.by(() => {
    const revealTotal = scoreReveal
      ? (scoreReveal.revealedCount === 0 ? 0 : Math.round(scoreReveal.runningTotals[scoreReveal.revealedCount - 1]))
      : 0
    return Math.min(100, ((displayedScore + revealTotal) / target) * 100)
  })
</script>

<div class="px-4 pt-3">
  {#if headerExtra}
    {@render headerExtra()}
  {/if}
  {#if showScoreAndCombo}
    <div class="mt-2 flex items-end justify-between">
      <div>
        <div class="text-xs text-emerald-300/70 tracking-widest">SCORE / TARGET</div>
        <div
          bind:this={scoreNumberEl}
          class="text-xl font-black text-amber-50 tabular-nums ease-out"
          style="transform: scale({scoreNumberScale}); transition-property: transform; transition-duration:{scoreNumberTransitionMs}ms;"
        >
          {displayedScore} <span class="text-sm text-emerald-300/70">/ {target}</span>
        </div>
      </div>
      <div class="text-right transition-transform origin-bottom-right {comboScale[displayComboTier]}">
        <div class="text-xs text-emerald-300/70 tracking-widest">COMBO</div>
        <div class="text-3xl font-black italic tabular-nums leading-none {comboColor[displayComboTier]}">
          {wave.combo}{#if wave.baseComboCount > 0}<span class="text-lg not-italic ml-1 text-emerald-300/80">+{wave.baseComboCount}</span>{/if}
        </div>
      </div>
    </div>
  {/if}
  <div class="mt-1 h-1.5 rounded-full bg-emerald-900 overflow-hidden relative">
    <div class="absolute inset-y-0 left-0 h-full bg-yellow-300/30 transition-all duration-300" style="width:{progressBarLightPercent}%"></div>
    <div class="absolute inset-y-0 left-0 h-full bg-gradient-to-r from-yellow-500 to-yellow-300" style="width:{progressBarDarkPercent}%"></div>
  </div>
  {#if scoreReveal}
    {@const isLastLanded = scoreReveal.revealedCount === scoreReveal.parts.length}
    {@const currentTotal = scoreReveal.revealedCount === 0
      ? 0
      : isLastLanded
        ? Math.floor(scoreReveal.runningTotals[scoreReveal.revealedCount - 1])
        : Math.round(scoreReveal.runningTotals[scoreReveal.revealedCount - 1])}
    <div class="flex items-center justify-between text-sm h-5">
      <span bind:this={breakdownRowEl} class="text-emerald-200 text-xs">{scoreReveal.parts.slice(0, scoreReveal.revealedCount).map(p => p.text).join(' ')}</span>
      <span
        bind:this={totalGainEl}
        class="text-yellow-300 font-black inline-block ease-out"
        style="transform: scale({scoreReveal.totalScale}); transition-property: transform; transition-duration:{scoreReveal.totalTransitionMs}ms;"
      >+{currentTotal}</span>
    </div>
  {:else if wave.lastGain || wave.lastBonusGains.length > 0}
    {@const totalPoints = (wave.lastGain?.points ?? 0) + wave.lastBonusGains.reduce((sum, g) => sum + g.points, 0)}
    {@const allParts = [...(wave.lastGain?.parts ?? []), ...wave.lastBonusGains.flatMap(g => g.parts)]}
    <div class="flex items-center justify-between text-sm h-5">
      {#if allParts.length > 0}
        <span class="text-emerald-200 text-xs">{allParts.map(p => p.text).join(' ')}</span>
      {:else}
        <span></span>
      {/if}
      <span class="text-yellow-300 font-black">+{totalPoints}</span>
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
          {@const isExposedByAnimation = playingAnimation !== null && playingAnimation.colIndex === ci && ri === col.length - 2}
          {@const isSelectable = columnTargetMode ? isTop : (isTop || wave.playFromAnywhereActiveThisWave)}
          {@const isAnimatingThisCard = playingAnimation?.colIndex === ci && playingAnimation?.rowIndex === ri}
          {@const isCleaningUpThisColumn = (cleanupAnimation?.kind === 'column' && cleanupAnimation.columnIndex === ci) || cleanedUpColumns.has(ci)}
          <div
            class="absolute left-0 right-0 {dropTarget && dropTarget !== 'stockTop' && dropTarget.col === ci && dropTarget.row === ri ? 'ring-4 ring-sky-400 rounded-lg' : ''} {isAnimatingThisCard || isCleaningUpThisColumn ? 'invisible' : ''}"
            style="top:{ri * 18}px; z-index:{ri};"
            data-drop-col={ci}
            data-drop-row={ri}
          >
            {#if isSelectable}
              {@const isTargetable = columnTargetMode && canTargetColumn(ci)}
              {@const isCardPlayable = !columnTargetMode && wave.status === 'playing' && isPlayable(modifier, wave, card)}
              <button
                type="button"
                disabled={playingAnimation !== null || scoreReveal !== null || cleanupAnimation !== null}
                onclick={() => (columnTargetMode ? (isTargetable && onTargetColumn?.(ci)) : (isCardPlayable && startPlayCardAnimation(ci, ri, card)))}
                class="block w-full text-left {columnTargetMode ? (isTargetable ? 'ring-2 ring-fuchsia-400 shadow-lg -translate-y-0.5' : '') : (isCardPlayable && playingAnimation === null && scoreReveal === null && cleanupAnimation === null ? 'ring-2 ring-yellow-300 shadow-lg -translate-y-0.5' : '')} transition-transform disabled:cursor-not-allowed"
              >
                <CardFace {card} covered={false} />
              </button>
            {:else}
              <CardFace {card} covered={!isExposedByAnimation} />
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
    bind:this={noPlayableHintEl}
    class="text-center text-emerald-300/80 text-xs mt-16 animate-pulse {playableCols.size === 0 && wave.stock.length > 0 && remainingCards > 0 && scoreReveal === null && partFlyIn === null ? '' : 'invisible'}"
  >取れる札がない → 山札をめくろう</div>
</div>

<div class="px-4 text-center text-yellow-300 text-xs font-black animate-pulse mb-1 {wave.lastDrawEffect === 'pattern' ? '' : 'invisible'}">✦ パターン継続! ✦</div>

<div class="px-4 pb-5 pt-2 flex items-start gap-4">
  <div class="flex flex-col items-center gap-1" style="margin-top:20px;">
    <button
      type="button"
      onclick={onDraw}
      disabled={wave.stock.length === 0 || !allowDraw || playingAnimation !== null || scoreReveal !== null || cleanupAnimation !== null}
      data-drop-stock
      bind:this={stockButtonEl}
      style="aspect-ratio: 2 / 3;"
      class="w-16 shrink-0 rounded-lg border-2 flex flex-col items-center justify-center font-black active:scale-95 transition-transform {dropTarget === 'stockTop' ? 'ring-4 ring-sky-400' : ''} {wave.stock.length > 0 ? 'bg-emerald-700 border-emerald-500 text-amber-50' : 'bg-emerald-900 border-emerald-800 text-emerald-700'}"
    >
      <div class="text-xs">山札</div>
      <div class="text-lg tabular-nums">{wave.stock.length}</div>
    </button>
    {#if wave.discardPile.length > 0 && cleanupAnimation?.kind !== 'discard'}
      <div bind:this={discardPileEl} class="w-16">
        <CardFace card={wave.discardPile[wave.discardPile.length - 1]} covered={false} />
      </div>
    {/if}
  </div>
  {#if items.includes('guidance') && wave.stock.length > 0}
    {@const nextCard = wave.stock[wave.stock.length - 1]}
    <div class="flex flex-col items-center justify-center" style="margin-top:20px;">
      <div class="text-[10px] text-emerald-300/70 mb-1">次の札</div>
      <CardFace card={nextCard} covered={false} />
    </div>
  {/if}
  <div bind:this={chainAreaEl} class="overflow-x-auto min-w-0 {cleanupAnimation?.kind === 'chain' || chainCleanedUp ? 'invisible' : ''}">
    {#if chainAreaExtra}
      {@render chainAreaExtra()}
    {:else}
      {#each chainRows as row, ri (ri)}
        <div class="relative" style="height:116px; width:{64 + (row.length - 1) * params.ui.chainCardOffsetX}px;">
          {#each row as entry, j (entry.card.id)}
            <div
              class="absolute"
              data-chain-card-id={entry.card.id}
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
      {@const usable = canUseRite(params, wave, riteId) && playingAnimation === null && scoreReveal === null && cleanupAnimation === null}
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
      {@const usable = canUseRevelation(params, wave, revelationId) && playingAnimation === null && scoreReveal === null && cleanupAnimation === null}
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

{#if scoreReveal && scoreReveal.flyPhase !== 'none'}
  <div
    class="fixed pointer-events-none z-[100] ease-out text-yellow-300 font-black text-lg"
    style="left:{scoreReveal.flyLeft}px; top:{scoreReveal.flyTop}px; transform: scale({scoreReveal.flyScale}); transition-property: left, top, transform; transition-duration:{scoreReveal.flyTransitionMs}ms;"
  >+{scoreReveal.totalGain}</div>
{/if}

{#if partFlyIn}
  <div
    class="fixed pointer-events-none z-[110] ease-out text-emerald-200 text-sm font-bold"
    style="left:{partFlyIn.left}px; top:{partFlyIn.top}px; transform: translate({partFlyIn.phase === 'center' ? '-50%' : '0%'}, -50%) scale({partFlyIn.scale}); transition-property: left, top, transform; transition-duration:{partFlyIn.transitionMs}ms;"
  >{partFlyIn.text}</div>
{/if}

{#if cleanupAnimation}
  {#if cleanupAnimation.gatherCards.length > 0}
    {#each cleanupAnimation.gatherCards as gatherCard (gatherCard.card.id)}
      <div
        class="fixed pointer-events-none z-[100] ease-out"
        style="left:{gatherCard.left}px; top:{gatherCard.top}px; width:64px; transform: translate(-50%, -50%); transition-property: left, top; transition-duration:{cleanupAnimation.transitionMs}ms;"
      >
        <CardFace card={gatherCard.card} covered={false} />
      </div>
    {/each}
  {:else}
    <div
      class="fixed pointer-events-none z-[100] ease-out"
      style="left:{cleanupAnimation.left}px; top:{cleanupAnimation.top}px; width:64px; transform: translate(-50%, -50%); transition-property: left, top; transition-duration:{cleanupAnimation.transitionMs}ms;"
    >
      <CardFace card={cleanupAnimation.card} covered={false} />
    </div>
  {/if}
{/if}
