<!-- src/routes/game/solitaire/+page.svelte -->
<script lang="ts">
  import { onMount, tick } from 'svelte'
  import { cubicOut } from 'svelte/easing'
  import type { GameState, Move, Card } from '$lib/game/solitaire/types'
  import {
    dealInitial, drawFromStock, moveCards,
    undo, getHints, canAutoComplete, autoCompleteStep, getAutoCompleteMove, isVictory
  } from '$lib/game/solitaire/engine'
  import animConfigJson from '$lib/game/solitaire/anim.config.json'
  import type { AnimConfigFile, AnimSize } from '$lib/game/solitaire/anim.config.schema'

  const animFile = animConfigJson as AnimConfigFile

  function cfgForSize(size: AnimSize) {
    return {
      slamDrop:     animFile.slamDrop[size],
      screenShake:  animFile.screenShake[size],
      impactBounce: animFile.impactBounce[size],
      sparkle:      animFile.sparkle[size],
      scoreDelta:   animFile.scoreDelta[size],
    }
  }
  // 通常は medium。組み札への投下時のみ performSlamDrop 内で large に差し替える
  let cfg = cfgForSize('medium')

  // ---- TOP10スコア型 ----
  interface ScoreEntry {
    score: number
    elapsed: number
    drawMode: 1 | 3
    date: string
    seed?: number
  }

  // ---- ドラッグ型 ----
  interface DragInfo {
    pile: 'tableau' | 'waste' | 'foundation'
    pileIndex: number
    cardIndex: number | undefined
    count: number
    startX: number
    startY: number
    currentX: number
    currentY: number
    isDragging: boolean
    pointerId: number
  }

  // ---- フライングカード型 ----
  interface FlyCard {
    card: Card
    fromX: number
    fromY: number
    toX: number
    toY: number
    flip: boolean
    dest: 'waste' | { pile: 'foundation'; index: number }
    moving: boolean
    duration: number
  }

  // ---- エフェクト型 ----
  interface FloatScore { id: number; delta: number; x: number; y: number }
  interface GlowEffect { id: number; x: number; y: number; w: number; h: number }
  interface ConfettiParticle {
    x: number; y: number; vx: number; vy: number
    rotation: number; rotSpeed: number
    color: string; w: number; h: number; life: number
  }

  // ---- 状態 ----
  // loadSavedGame / loadSavedSettings / loadTop10 は関数宣言のためホイスト済み
  const _sg = loadSavedGame()
  const _init: GameState = (_sg && !isVictory(_sg.state)) ? _sg.state : dealInitial(1)
  const _sets = loadSavedSettings(_init.seed, _init.drawMode)
  const _initUndo = (_sg && !isVictory(_sg.state)) ? (_sg.undoCount ?? 0) : 0
  const _initHint = (_sg && !isVictory(_sg.state)) ? (_sg.hintCount ?? 0) : 0

  let state = $state<GameState>(_init)
  let seedInput = $state(_sets.seedInput)
  let useSeed = $state(_sets.useSeed)
  let selected = $state<{ pile: 'tableau' | 'waste' | 'foundation'; index: number; count: number } | null>(null)
  let hints = $state<Move[]>([])
  let hintIndex = $state(0)
  let showHints = $state(false)
  let showVictory = $state(false)
  let autoCompleting = $state(false)
  let pendingMode = $state<1 | 3>(_sets.pendingMode)
  let animEnabled = $state(_sets.animEnabled)
  let dragInfo = $state<DragInfo | null>(null)
  let dropTarget = $state<{ pile: 'tableau' | 'foundation'; index: number } | null>(null)
  let flyCard = $state<FlyCard | null>(null)
  let top10 = $state<ScoreEntry[]>(loadTop10())
  let clearRank = $state(0)
  let floatScores = $state<FloatScore[]>([])
  let glowEffects = $state<GlowEffect[]>([])
  let _effectId = 0
  const CONFETTI_COLORS = ['#f43f5e','#f97316','#eab308','#22c55e','#3b82f6','#a855f7','#ec4899','#06b6d4','#fbbf24']
  let confettiCanvas: HTMLCanvasElement | null = null
  interface Sparkle { id: number; x: number; y: number; dx: number; dy: number; color: string; size: number; delay: number; char: string }
  let sparkles = $state<Sparkle[]>([])
  const SPARK_COLORS = ['#fbbf24','#fde68a','#f59e0b','#ffffff','#fb7185','#67e8f9','#c4b5fd','#86efac']
  const SPARK_CHARS  = ['✦','✧','✶','★','✺','✸']
  let timerPulseId = $state(0)
  let timerPulseType = $state<'small' | 'large'>('small')
  let prevWasteFan = $state<Card[]>([])
  let undoCount = $state(_initUndo)
  let hintCount = $state(_initHint)
  interface ClearBreakdown {
    baseScore: number; timeBonus: number
    undoCount: number; undoPenalty: number
    hintCount: number; hintPenalty: number
    subtotal: number; draw3Mult: number; finalScore: number
  }
  let clearBreakdown = $state<ClearBreakdown | null>(null)
  let scoreDeltas = $state<{id: number; delta: number; x: number; y: number}[]>([])
  interface SlamAnim {
    id: string
    cards: Card[]; fromX: number; fromY: number; toX: number; toY: number
    sourcePile: 'tableau' | 'waste' | 'foundation'; sourcePileIndex: number; sourceCount: number
    hideSource: boolean
    hideDestFoundIdx: number  // -1 = 非表示なし；0-3 = その foundation の最上位カードを隠す
    playing: boolean
  }
  let slamAnims = $state<SlamAnim[]>([])
  let gameEl: HTMLElement | null = null

  // ---- LocalStorage自動保存 ----
  $effect(() => {
    try { localStorage.setItem('solitaire-game', JSON.stringify({ state: { ...state, history: [] }, undoCount, hintCount })) } catch {}
  })
  $effect(() => {
    try { localStorage.setItem('solitaire-settings', JSON.stringify({ useSeed, seedInput, pendingMode, animEnabled })) } catch {}
  })


  // ---- タイマー ----
  let timerInterval: ReturnType<typeof setInterval> | null = null
  let gameStarted = $state(false)

  function startTimer() {
    if (timerInterval) return
    timerInterval = setInterval(() => {
      const newElapsed = state.elapsed + 1
      state = { ...state, elapsed: newElapsed }
      if (newElapsed % 60 === 0) { timerPulseType = 'large'; timerPulseId += 1 }
      else if (newElapsed % 30 === 0) { timerPulseType = 'small'; timerPulseId += 1 }
    }, 1000)
  }
  function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null }
  }

  // ---- オートコンプリート ----
  async function startAutoComplete() {
    autoCompleting = true
    const STAGGER_MS = 80
    const animPromises: Promise<void>[] = []

    // 総移動枚数を事前カウント（isLast を確実に判定するため）
    let totalMoves = 0
    let countState: GameState = state as GameState
    while (getAutoCompleteMove(countState) !== null) {
      countState = autoCompleteStep(countState)
      totalMoves++
    }
    let movesDone = 0

    while (autoCompleting) {
      const move = getAutoCompleteMove(state)
      if (!move) break

      // state 更新前に位置とカードを取得
      const card = move.from.pile === 'waste'
        ? state.waste[state.waste.length - 1]
        : state.tableau[move.from.index][state.tableau[move.from.index].length - 1]

      let fromX = 0, fromY = 0
      if (move.from.pile === 'waste') {
        const el = document.querySelector('[data-waste]')
        if (el) { const r = el.getBoundingClientRect(); fromX = r.left; fromY = r.top }
      } else {
        const el = document.querySelector(`[data-pile="tableau"][data-pile-index="${move.from.index}"]`)
        if (el) {
          const r = el.getBoundingClientRect()
          fromX = r.left
          fromY = r.top + (state.tableau[move.from.index].length - 1) * 28
        }
      }
      const toEl = getDestEl('foundation', move.to.index)
      const toRect = toEl?.getBoundingClientRect()
      const toX = toRect?.left ?? 0
      const toY = toRect?.top ?? 0

      const prevScore = state.score
      state = autoCompleteStep(state) // 即時反映（元カードがDOMから消える）
      const delta = state.score - prevScore
      movesDone++
      const isLast = movesDone === totalMoves

      // fire-and-forget でアニメーション開始
      animPromises.push(fireAutoSlamAnim(card, fromX, fromY, toX, toY, move.to.index, delta, isLast))

      await new Promise<void>(r => setTimeout(r, STAGGER_MS))
    }

    // 全アニメーション完了後に後処理
    await Promise.all(animPromises)
    showHints = false; selected = null
    autoCompleting = false
    checkAfterMove()
  }

  // ---- ゲーム操作 ----
  function newGame(mode: 1 | 3 = pendingMode) {
    stopTimer()
    const parsed = parseInt(seedInput, 10)
    const seed = useSeed && Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
    state = dealInitial(mode, seed)
    seedInput = String(state.seed)
    selected = null; hints = []; showHints = false; hintIndex = 0
    showVictory = false; autoCompleting = false; gameStarted = false; clearRank = 0
    flyCard = null
    floatScores = []
    glowEffects = []
    scoreDeltas = []
    undoCount = 0; hintCount = 0; clearBreakdown = null
  }

  function ensureStarted() {
    if (!gameStarted) { gameStarted = true; startTimer() }
  }

  async function startFlyAnimation(
    card: Card,
    fromX: number,
    fromY: number,
    toEl: Element,
    flip: boolean,
    dest: 'waste' | { pile: 'foundation'; index: number },
    duration = 175
  ) {
    const toRect = toEl.getBoundingClientRect()
    flyCard = { card, fromX, fromY, toX: toRect.left, toY: toRect.top, flip, dest, moving: false, duration }
    await tick()
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (flyCard) flyCard = { ...flyCard, moving: true }
      })
    })
    await new Promise<void>(r => setTimeout(r, duration + 25))
    flyCard = null
  }

  function flyingToWaste(): boolean {
    return flyCard !== null && flyCard.dest === 'waste'
  }

  function flyingToFoundation(i: number): boolean {
    return flyCard !== null && flyCard.dest !== 'waste' && (flyCard.dest as { pile: 'foundation'; index: number }).index === i
  }

  async function handleStockClick(e: MouseEvent) {
    if (isVictory(state)) return
    ensureStarted()
    showHints = false
    if (state.stock.length > 0) {
      const card = { ...state.stock[state.stock.length - 1], faceUp: true }
      const fromRect = (e.currentTarget as Element).getBoundingClientRect()
      prevWasteFan = state.waste.slice(-3)
      state = drawFromStock(state)
      selected = null
      await tick()
      const toEl = document.querySelector('[data-waste]')
      if (toEl) await startFlyAnimation(card, fromRect.left, fromRect.top, toEl, true, 'waste')
    } else {
      const prevScore = state.score
      state = drawFromStock(state)
      triggerScoreDisplayEffect(state.score - prevScore)
      selected = null
    }
    checkAfterMove()
  }

  function handleCardClick(
    pile: 'tableau' | 'waste' | 'foundation',
    pileIndex: number,
    cardIndex?: number
  ) {
    if (isVictory(state)) return
    ensureStarted()
    showHints = false

    if (selected === null) {
      if (pile === 'waste' && state.waste.length > 0) {
        selected = { pile: 'waste', index: 0, count: 1 }
      } else if (pile === 'tableau' && cardIndex !== undefined) {
        const col = state.tableau[pileIndex]
        if (col[cardIndex]?.faceUp) {
          selected = { pile: 'tableau', index: pileIndex, count: col.length - cardIndex }
        }
      } else if (pile === 'foundation' && state.foundation[pileIndex].length > 0) {
        selected = { pile: 'foundation', index: pileIndex, count: 1 }
      }
      return
    }

    if (pile === selected.pile && pileIndex === selected.index) {
      selected = null
      return
    }

    const move: Move = {
      from: { pile: selected.pile, index: selected.index },
      to: { pile, index: pileIndex },
      count: selected.count,
    }
    const prevScore = state.score
    const next = moveCards(state, move)
    if (next !== state) {
      state = next
      triggerScoreEffects(state.score - prevScore, getDestEl(move.to.pile, move.to.index))
      triggerScoreDisplayEffect(state.score - prevScore)
      checkAfterMove()
    }
    selected = null
  }

  async function handleDoubleClick(
    e: MouseEvent,
    pile: 'tableau' | 'waste',
    pileIndex: number,
    cardIndex?: number
  ) {
    if (isVictory(state)) return
    ensureStarted()
    const hint = getHints(state).find(h =>
      h.from.pile === pile &&
      h.from.index === pileIndex &&
      h.to.pile === 'foundation' &&
      (pile !== 'tableau' || (cardIndex !== undefined && cardIndex === state.tableau[pileIndex].length - 1))
    )
    if (!hint) return
    const foundIdx = hint.to.index
    const prevScore = state.score
    const next = moveCards(state, hint)
    selected = null
    showHints = false
    // performSlamDrop が fromX/fromY を DOM から計算するため currentX/currentY は不要
    const di: DragInfo = {
      pile,
      pileIndex,
      cardIndex: cardIndex ?? (pile === 'tableau' ? state.tableau[pileIndex].length - 1 : undefined),
      count: 1,
      startX: 0, startY: 0, currentX: 0, currentY: 0,
      isDragging: false,
      pointerId: -1,
    }
    await performSlamDrop(di, { pile: 'foundation', index: foundIdx }, next, prevScore)
  }

  function cardBg(rank: number): string {
    if (rank === 13) return 'bg-amber-50'
    if (rank === 12) return 'bg-rose-50'
    if (rank === 11) return 'bg-indigo-50'
    return 'bg-white'
  }

  function handleHint() {
    hintCount += 1
    if (showHints && hints.length > 0) {
      hintIndex = (hintIndex + 1) % hints.length
      return
    }
    const h = getHints(state)
    if (h.length === 0) { hintCount -= 1; return }
    hints = h
    showHints = true
    hintIndex = 0
  }

  function handleUndo() {
    if (state.history.length === 0) return
    undoCount += 1
    state = undo(state)
    selected = null; showHints = false
  }

  function loadSavedGame(): { state: GameState; undoCount: number; hintCount: number } | null {
    try {
      const saved = localStorage.getItem('solitaire-game')
      if (!saved) return null
      const parsed = JSON.parse(saved) as { state?: GameState; undoCount?: number; hintCount?: number }
      const s = parsed?.state
      if (!s) return null
      return { state: { ...s, history: [] }, undoCount: parsed.undoCount ?? 0, hintCount: parsed.hintCount ?? 0 }
    } catch {
      return null
    }
  }

  function loadSavedSettings(defaultSeed: number, defaultDrawMode: 1 | 3): { useSeed: boolean; seedInput: string; pendingMode: 1 | 3; animEnabled: boolean } {
    try {
      const saved = localStorage.getItem('solitaire-settings')
      if (saved) {
        const p = JSON.parse(saved)
        return {
          useSeed: typeof p.useSeed === 'boolean' ? p.useSeed : false,
          seedInput: typeof p.seedInput === 'string' ? p.seedInput : String(defaultSeed),
          pendingMode: (p.pendingMode === 1 || p.pendingMode === 3) ? p.pendingMode as 1 | 3 : defaultDrawMode,
          animEnabled: typeof p.animEnabled === 'boolean' ? p.animEnabled : true,
        }
      }
    } catch {}
    return { useSeed: false, seedInput: String(defaultSeed), pendingMode: defaultDrawMode, animEnabled: true }
  }

  function loadTop10(): ScoreEntry[] {
    try {
      return JSON.parse(localStorage.getItem('solitaire-top10') ?? '[]') as ScoreEntry[]
    } catch {
      return []
    }
  }

  function saveToTop10(score: number, elapsed: number, drawMode: 1 | 3, seed: number): number {
    if (score === 0 && elapsed === 0) return 0
    const entries = loadTop10()
    const newEntry: ScoreEntry = {
      score,
      elapsed,
      drawMode,
      date: new Date().toISOString().slice(0, 10),
      seed,
    }
    entries.push(newEntry)
    entries.sort((a, b) => b.score - a.score || a.elapsed - b.elapsed)
    const ranked = entries.slice(0, 10)
    const rank = ranked.findIndex(e => e === newEntry) + 1
    localStorage.setItem('solitaire-top10', JSON.stringify(ranked))
    top10 = ranked
    return rank > 0 ? rank : 0
  }

  function getDestEl(pile: 'tableau' | 'foundation', index: number): Element | null {
    return document.querySelector(`[data-pile="${pile}"][data-pile-index="${index}"]`)
  }

  function triggerImpactBounce(cx: number, cy: number) {
    const c = cfg.impactBounce

    // 組み札・捨て札: 各要素の中心からの距離で delay を決定
    const singleEls: Element[] = [...document.querySelectorAll('[data-pile="foundation"]')]
    const wasteEl = document.querySelector('[data-waste]')
    if (wasteEl) singleEls.push(wasteEl)

    singleEls.forEach(el => {
      const r = el.getBoundingClientRect()
      const dist = Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy)
      if (dist < c.minDistPx || dist > c.maxDistPx) return
      const factor = 1 - dist / c.maxDistPx
      const maxScale = +(factor * c.singleMaxScale).toFixed(3)
      if (maxScale < 0.01) return
      el.animate([
        { transform: 'scale(1)' },
        { transform: `scale(${(1 + maxScale).toFixed(3)})` },
        { transform: `scale(${(1 + maxScale * 0.1).toFixed(3)})` },
        { transform: 'scale(1)' },
      ], { duration: 400, delay: Math.round(dist * c.delayFactor), easing: 'ease-out', fill: 'none' })
    })

    // タブロー: 各カードの実際の画面位置から距離を計算→真の円形リップル
    document.querySelectorAll('[data-pile="tableau"]').forEach(colEl => {
      const cardEls = colEl.querySelectorAll('[data-card-idx]')
      const total = cardEls.length
      if (total === 0) return

      cardEls.forEach(cardEl => {
        const cardIdx = parseInt((cardEl as HTMLElement).dataset.cardIdx ?? '0')
        const r = cardEl.getBoundingClientRect()
        const dist = Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy)
        if (dist < c.minDistPx || dist > c.maxDistPx) return
        const factor = 1 - dist / c.maxDistPx
        const depthFactor = (cardIdx + 1) / total
        const maxScale = +(factor * depthFactor * c.tableauMaxScale).toFixed(3)
        if (maxScale < 0.01) return
        const duration = c.tableauDurationMinMs + Math.round(depthFactor * c.tableauDurationRangeMs)
        cardEl.animate([
          { transform: 'scale(1)' },
          { transform: `scale(${(1 + maxScale).toFixed(3)})` },
          { transform: `scale(${(1 + maxScale * 0.08).toFixed(3)})` },
          { transform: 'scale(1)' },
        ], { duration, delay: Math.round(dist * c.delayFactor), easing: 'ease-out', fill: 'none', composite: 'add' })
      })
    })
  }

  function triggerScreenShake(amplify = 1, customCfg?: typeof animFile.screenShake['large']) {
    if (!gameEl) return
    const c = customCfg ?? cfg.screenShake
    const keyframes: Keyframe[] = [
      { transform: 'translate(0,0) rotate(0deg)' },
      ...c.frames.map(f => ({ transform: `translate(${f.x * amplify}px,${f.y * amplify}px) rotate(${f.rotateDeg * amplify}deg)` })),
      { transform: 'translate(0,0) rotate(0deg)' },
    ]
    gameEl.animate(keyframes, { duration: c.durationMs, easing: 'ease-out', fill: 'none' })
  }

  async function performSlamDrop(
    di: DragInfo,
    dt: { pile: 'tableau' | 'foundation'; index: number },
    next: GameState,
    prevScore: number
  ) {
    cfg = cfgForSize(
      dt.pile === 'foundation' ? 'large' :
      di.count >= 5            ? 'large' :
      di.count >= 2            ? 'medium' :
                                 'small'
    )
    if (!animEnabled) {
      state = next
      showHints = false; selected = null
      cfg = cfgForSize('medium')
      checkAfterMove()
      return
    }
    const cards = di.pile === 'waste'
      ? state.waste.slice(-1)
      : di.pile === 'foundation'
      ? [state.foundation[di.pileIndex].at(-1)!]
      : state.tableau[di.pileIndex].slice(state.tableau[di.pileIndex].length - di.count)

    const toEl = getDestEl(dt.pile, dt.index)
    if (!toEl) {
      state = next; showHints = false; selected = null
      triggerScoreEffects(next.score - prevScore, null)
      triggerScoreDisplayEffect(next.score - prevScore)
      checkAfterMove()
      return
    }
    const toRect = toEl.getBoundingClientRect()
    const toX = toRect.left
    const toY = toRect.top + (dt.pile === 'tableau' ? state.tableau[dt.index].length * 28 : 0)

    let fromX = di.currentX - 32, fromY = di.currentY - 20
    if (di.pile === 'waste') {
      const el = document.querySelector('[data-waste]')
      if (el) { const r = el.getBoundingClientRect(); fromX = r.left; fromY = r.top }
    } else if (di.pile === 'foundation') {
      const el = document.querySelector(`[data-pile="foundation"][data-pile-index="${di.pileIndex}"]`)
      if (el) { const r = el.getBoundingClientRect(); fromX = r.left; fromY = r.top }
    } else {
      const el = document.querySelector(`[data-pile="tableau"][data-pile-index="${di.pileIndex}"]`)
      if (el) { const r = el.getBoundingClientRect(); fromX = r.left; fromY = r.top + (di.cardIndex ?? 0) * 28 }
    }

    const animId = `slam-${_effectId++}`
    slamAnims = [...slamAnims, {
      id: animId, cards, fromX, fromY, toX, toY,
      sourcePile: di.pile, sourcePileIndex: di.pileIndex, sourceCount: di.count,
      hideSource: true, hideDestFoundIdx: -1, playing: false,
    }]
    await tick()
    await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())))
    slamAnims = slamAnims.map(a => a.id === animId ? { ...a, playing: true } : a)
    await new Promise<void>(r => requestAnimationFrame(() => r()))

    const ghostEl = document.querySelector(`[data-ghost-id="${animId}"]`)
    if (ghostEl) {
      const sc = cfg.slamDrop
      const tx = toX - fromX
      const ty = toY - fromY
      ghostEl.animate([
        { transform: 'translate(0,0) scale(1) rotate(0deg)',                                                                                                                     offset: 0,        easing: 'cubic-bezier(0.2,0,0.4,1)' },
        { transform: `translate(${tx*0.02}px,${ty*0.02}px) scale(${sc.peakScale}) rotate(${sc.peakRotateDeg}deg) translateY(${sc.peakLiftPx}px)`,                               offset: sc.peakAt, easing: 'cubic-bezier(0.8,0,1,1)' },
        { transform: `translate(${tx*0.99}px,${ty*0.99}px) scale(${sc.landScale}) rotate(${sc.landRotateDeg}deg)`,                                                              offset: sc.landAt, easing: 'ease-out' },
        { transform: `translate(${tx}px,${ty}px) scale(1) rotate(0deg)`,                                                                                                        offset: 1 },
      ], { duration: sc.durationMs, easing: 'linear', fill: 'forwards' })
    }

    // 着地タイミング: durationMs * landAt
    await new Promise<void>(r => setTimeout(r, Math.round(cfg.slamDrop.durationMs * cfg.slamDrop.landAt)))
    triggerScreenShake()
    triggerImpactBounce(toX + 32, toY + 49)
    triggerScoreEffects(next.score - prevScore, getDestEl(dt.pile, dt.index))
    triggerScoreDisplayEffect(next.score - prevScore)

    // アニメーション完了まで待機 (残り時間 = duration * (1 - landAt))
    await new Promise<void>(r => setTimeout(r, Math.round(cfg.slamDrop.durationMs * (1 - cfg.slamDrop.landAt)) + 10))
    slamAnims = slamAnims.filter(a => a.id !== animId)
    state = next
    showHints = false; selected = null
    cfg = cfgForSize('medium')
    checkAfterMove()
  }

  // オートコンプリート用: 1枚を fire-and-forget でスラム投下
  async function fireFinaleAnim(
    card: Card, fromX: number, fromY: number,
    toX: number, toY: number,
    foundIdx: number, delta: number
  ): Promise<void> {
    const fc = animFile.finale['large']
    const sc = animFile.slamDrop['large']
    const spinDeg = fc.spinRotations * 360
    const totalDuration = fc.spinDurationMs + fc.holdDurationMs + sc.durationMs
    const spinEnd   = fc.spinDurationMs / totalDuration
    const holdEnd   = (fc.spinDurationMs + fc.holdDurationMs) / totalDuration
    const slamRange = 1 - holdEnd
    const landOffset = holdEnd + slamRange * sc.landAt

    const animId = `fin-${_effectId++}`
    slamAnims = [...slamAnims, {
      id: animId, cards: [card], fromX, fromY, toX, toY,
      sourcePile: 'waste', sourcePileIndex: -1, sourceCount: 0,
      hideSource: false, hideDestFoundIdx: foundIdx, playing: false,
    }]
    await tick()
    await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())))
    slamAnims = slamAnims.map(a => a.id === animId ? { ...a, playing: true } : a)
    await new Promise<void>(r => requestAnimationFrame(() => r()))

    const ghostEl = document.querySelector(`[data-ghost-id="${animId}"]`)
    if (ghostEl) {
      const tx = toX - fromX
      const ty = toY - fromY
      // slam中は移動方向と逆側に傾く（右移動→左傾き、左移動→右傾き）
      const slamTilt = tx >= 0 ? sc.peakRotateDeg : -sc.peakRotateDeg
      ghostEl.animate([
        { offset: 0,          transform: 'translate(0px,0px) translateY(0px) scale(1) rotate(0deg)',                                                                                           easing: 'cubic-bezier(0.2,0,0.4,1)' },
        { offset: spinEnd,    transform: `translate(${tx*0.02}px,${ty*0.02}px) translateY(${sc.peakLiftPx}px) scale(${fc.spinPeakScale}) rotate(${spinDeg}deg)`,                               easing: 'ease-in-out' },
        { offset: holdEnd,    transform: `translate(${tx*0.02}px,${ty*0.02}px) translateY(${sc.peakLiftPx}px) scale(${fc.spinPeakScale}) rotate(${spinDeg}deg)`,                               easing: 'cubic-bezier(0.8,0,1,1)' },
        { offset: landOffset, transform: `translate(${tx*0.99}px,${ty*0.99}px) translateY(0px) scale(${sc.landScale}) rotate(${spinDeg + slamTilt}deg)`,                                   easing: 'ease-out' },
        { offset: 1,          transform: `translate(${tx}px,${ty}px) translateY(0px) scale(1) rotate(${spinDeg}deg)` },
      ], { duration: totalDuration, easing: 'linear', fill: 'forwards' })
    }

    const landTimeMs = Math.round(totalDuration * landOffset)
    await new Promise<void>(r => setTimeout(r, landTimeMs))

    // 衝撃バウンス（large設定で）
    const savedCfg = cfg
    cfg = cfgForSize('large')
    triggerImpactBounce(toX + 32, toY + 49)
    cfg = savedCfg

    // 最大シェイク（large設定 × amplify、shakeCount回）
    const shakeCfg = animFile.screenShake['large']
    for (let i = 0; i < fc.shakeCount; i++) {
      setTimeout(() => triggerScreenShake(fc.shakeAmplify, shakeCfg), i * fc.shakeIntervalMs)
    }

    if (delta > 0) triggerScoreEffects(delta, getDestEl('foundation', foundIdx))
    triggerScoreDisplayEffect(delta)

    await new Promise<void>(r => setTimeout(r, Math.round(totalDuration * (1 - landOffset)) + 10))
    slamAnims = slamAnims.filter(a => a.id !== animId)
  }

  async function fireAutoSlamAnim(
    card: Card, fromX: number, fromY: number,
    toX: number, toY: number,
    foundIdx: number, delta: number,
    isLast: boolean
  ): Promise<void> {
    if (isLast) return fireFinaleAnim(card, fromX, fromY, toX, toY, foundIdx, delta)
    const sc = animFile.slamDrop['small']
    const animId = `as-${_effectId++}`
    slamAnims = [...slamAnims, {
      id: animId, cards: [card], fromX, fromY, toX, toY,
      sourcePile: 'waste', sourcePileIndex: -1, sourceCount: 0,
      hideSource: false, hideDestFoundIdx: foundIdx, playing: false,
    }]
    await tick()
    await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())))
    slamAnims = slamAnims.map(a => a.id === animId ? { ...a, playing: true } : a)
    await new Promise<void>(r => requestAnimationFrame(() => r()))

    const ghostEl = document.querySelector(`[data-ghost-id="${animId}"]`)
    if (ghostEl) {
      const tx = toX - fromX
      const ty = toY - fromY
      ghostEl.animate([
        { transform: 'translate(0,0) scale(1) rotate(0deg)',                                                                                                                    offset: 0,        easing: 'cubic-bezier(0.2,0,0.4,1)' },
        { transform: `translate(${tx*0.02}px,${ty*0.02}px) scale(${sc.peakScale}) rotate(${sc.peakRotateDeg}deg) translateY(${sc.peakLiftPx}px)`,                              offset: sc.peakAt, easing: 'cubic-bezier(0.8,0,1,1)' },
        { transform: `translate(${tx*0.99}px,${ty*0.99}px) scale(${sc.landScale}) rotate(${sc.landRotateDeg}deg)`,                                                             offset: sc.landAt, easing: 'ease-out' },
        { transform: `translate(${tx}px,${ty}px) scale(1) rotate(0deg)`,                                                                                                       offset: 1 },
      ], { duration: sc.durationMs, easing: 'linear', fill: 'forwards' })
    }

    await new Promise<void>(r => setTimeout(r, Math.round(sc.durationMs * sc.landAt)))
    if (delta > 0) triggerScoreEffects(delta, getDestEl('foundation', foundIdx))
    triggerScoreDisplayEffect(delta)

    await new Promise<void>(r => setTimeout(r, Math.round(sc.durationMs * (1 - sc.landAt)) + 10))
    slamAnims = slamAnims.filter(a => a.id !== animId)
  }

  function triggerSparkles(cx: number, cy: number) {
    const { count, radiusPx, durationMs } = cfg.sparkle
    const batch: Sparkle[] = []
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4
      const dist  = radiusPx * (0.5 + Math.random() * 0.5)
      batch.push({
        id:    _effectId++,
        x:     cx, y: cy,
        dx:    Math.cos(angle) * dist,
        dy:    Math.sin(angle) * dist,
        color: SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)],
        size:  10 + Math.random() * 11,
        delay: Math.floor(Math.random() * 80),
        char:  SPARK_CHARS[Math.floor(Math.random() * SPARK_CHARS.length)],
      })
    }
    sparkles = [...sparkles, ...batch]
    const ids = new Set(batch.map(s => s.id))
    setTimeout(() => { sparkles = sparkles.filter(s => !ids.has(s.id)) }, durationMs + 200)
  }

  function triggerScoreDisplayEffect(delta: number) {
    if (delta === 0) return
    const el = document.querySelector('[data-score-display]')
    if (!el) return
    const rect = el.getBoundingClientRect()
    const id = _effectId++
    scoreDeltas = [...scoreDeltas, { id, delta, x: rect.left + rect.width / 2, y: rect.top }]
    setTimeout(() => { scoreDeltas = scoreDeltas.filter(s => s.id !== id) }, cfg.scoreDelta.durationMs)
  }

  function triggerScoreEffects(delta: number, destEl: Element | null) {
    if (delta <= 0 || !destEl) return
    const rect = destEl.getBoundingClientRect()
    const fid = _effectId++
    floatScores = [...floatScores, { id: fid, delta, x: rect.left + rect.width / 2, y: rect.top + 10 }]
    setTimeout(() => { floatScores = floatScores.filter(f => f.id !== fid) }, cfg.scoreDelta.durationMs)
    const gid = _effectId++
    glowEffects = [...glowEffects, { id: gid, x: rect.left, y: rect.top, w: rect.width, h: rect.height }]
    setTimeout(() => { glowEffects = glowEffects.filter(g => g.id !== gid) }, 650)
    triggerSparkles(rect.left + rect.width / 2, rect.top + rect.height / 2)
  }

  function createCrackerBurst(ox: number, oy: number, vxMin: number, vxMax: number, vyMin: number, vyMax: number, count: number): ConfettiParticle[] {
    const out: ConfettiParticle[] = []
    for (let i = 0; i < count; i++) {
      out.push({
        x: ox + (Math.random() - 0.5) * 20,
        y: oy + (Math.random() - 0.5) * 5,
        vx: vxMin + Math.random() * (vxMax - vxMin),
        vy: vyMin + Math.random() * (vyMax - vyMin),
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.3,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        w: 7 + Math.random() * 9,
        h: 3 + Math.random() * 5,
        life: 180 + Math.random() * 80,
      })
    }
    return out
  }

  async function launchConfetti() {
    await tick()
    if (!confettiCanvas) return
    const ctx = confettiCanvas.getContext('2d')
    if (!ctx) return
    const W = window.innerWidth, H = window.innerHeight
    confettiCanvas.width = W
    confettiCanvas.height = H

    const bursts: ConfettiParticle[] = [
      // 下からのクラッカー（上向き）
      ...createCrackerBurst(W * 0.05, H * 0.92, -2, 14, -22, -6, 40),
      ...createCrackerBurst(W * 0.95, H * 0.92, -14, 2, -22, -6, 40),
      ...createCrackerBurst(W * 0.5,  H * 0.98, -10, 10, -24, -8, 35),
      // 上からのクラッカー（下向き）
      ...createCrackerBurst(W * 0.05, H * 0.08, -2, 14, 6, 22, 40),
      ...createCrackerBurst(W * 0.95, H * 0.08, -14, 2, 6, 22, 40),
      ...createCrackerBurst(W * 0.5,  H * 0.02, -10, 10, 8, 24, 35),
    ]

    // 降り注ぐ紙吹雪（モーダル表示中に連続生成）
    const snow: ConfettiParticle[] = []

    function renderFrame() {
      if (!confettiCanvas) return
      ctx.clearRect(0, 0, W, H)

      if (showVictory) {
        for (let i = 0; i < 2; i++) {
          snow.push({
            x: Math.random() * W,
            y: -15,
            vx: (Math.random() - 0.5) * 2.5,
            vy: 2 + Math.random() * 2.5,
            rotation: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 0.15,
            color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
            w: 7 + Math.random() * 8,
            h: 3 + Math.random() * 5,
            life: 999,
          })
        }
      }

      let alive = 0

      for (const p of bursts) {
        if (p.life <= 0) continue
        alive++
        p.vy += 0.38
        p.vx *= 0.992
        p.x += p.vx
        p.y += p.vy
        p.rotation += p.rotSpeed
        p.life--
        ctx.save()
        ctx.globalAlpha = Math.min(1, p.life / 45)
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
      }

      for (let i = snow.length - 1; i >= 0; i--) {
        const p = snow[i]
        if (p.y > H + 20) { snow.splice(i, 1); continue }
        alive++
        p.vy += 0.06
        p.vx += (Math.random() - 0.5) * 0.1
        p.x += p.vx
        p.y += p.vy
        p.rotation += p.rotSpeed
        ctx.save()
        ctx.globalAlpha = 0.9
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
      }

      if (alive > 0 || showVictory) requestAnimationFrame(renderFrame)
    }
    requestAnimationFrame(renderFrame)
  }

  function computeClearBreakdown(): ClearBreakdown {
    const timeBonus = Math.max(0, 3000 - state.elapsed * 10)
    const uPenalty = undoCount * 50
    const hPenalty = hintCount * 20
    const subtotal = Math.max(0, state.score + timeBonus - uPenalty - hPenalty)
    const draw3Mult = state.drawMode === 3 ? 1.5 : 1
    return {
      baseScore: state.score, timeBonus,
      undoCount, undoPenalty: uPenalty,
      hintCount, hintPenalty: hPenalty,
      subtotal, draw3Mult,
      finalScore: Math.floor(subtotal * draw3Mult),
    }
  }

  function checkAfterMove() {
    if (isVictory(state)) {
      stopTimer()
      const bd = computeClearBreakdown()
      clearBreakdown = bd
      clearRank = saveToTop10(bd.finalScore, state.elapsed, state.drawMode, state.seed)
      showVictory = true
      launchConfetti()
      return
    }
    if (!autoCompleting && canAutoComplete(state)) startAutoComplete()
  }

  function debugTriggerAutoComplete() {
    stopTimer()
    showVictory = false
    autoCompleting = false
    const suits = ['spades', 'hearts', 'diamonds', 'clubs'] as const
    const foundation = suits.map(suit =>
      Array.from({ length: 12 }, (_, i) => ({ suit, rank: (i + 1) as Card['rank'], faceUp: true }))
    )
    const tableau: Card[][] = [
      [{ suit: 'spades',   rank: 13, faceUp: true }],
      [{ suit: 'hearts',   rank: 13, faceUp: true }],
      [{ suit: 'diamonds', rank: 13, faceUp: true }],
      [{ suit: 'clubs',    rank: 13, faceUp: true }],
      [], [], [],
    ]
    state = { ...state, foundation, tableau, stock: [], waste: [], history: [] }
    gameStarted = true
    checkAfterMove()
  }

  function debugTriggerClear() {
    stopTimer()
    const suits = ['spades', 'hearts', 'diamonds', 'clubs'] as const
    const foundation = suits.map(suit =>
      Array.from({ length: 13 }, (_, i) => ({ suit, rank: (i + 1) as Card['rank'], faceUp: true }))
    )
    state = { ...state, foundation, tableau: [[], [], [], [], [], [], []], stock: [], waste: [], history: [] }
    const bd = computeClearBreakdown()
    clearBreakdown = bd
    clearRank = 0
    showVictory = true
    launchConfetti()
  }

  // ---- ドラッグ操作 ----
  function getDragCards(): import('$lib/game/solitaire/types').Card[] {
    if (!dragInfo) return []
    if (dragInfo.pile === 'waste') return state.waste.slice(-1)
    if (dragInfo.pile === 'foundation') return [state.foundation[dragInfo.pileIndex].at(-1)!]
    const col = state.tableau[dragInfo.pileIndex]
    return col.slice(col.length - dragInfo.count)
  }

  function updateDropTarget(x: number, y: number) {
    if (!dragInfo) return
    const els = document.elementsFromPoint(x, y)
    for (const el of els) {
      const target = (el as HTMLElement).closest?.('[data-pile]') as HTMLElement | null
      if (!target) continue
      const pile = target.dataset.pile as 'tableau' | 'foundation'
      const index = parseInt(target.dataset.pileIndex ?? '0')
      const move: Move = {
        from: { pile: dragInfo.pile, index: dragInfo.pileIndex },
        to: { pile, index },
        count: dragInfo.count,
      }
      if (moveCards(state, move) !== state) {
        dropTarget = { pile, index }
      } else {
        dropTarget = null
      }
      return
    }
    dropTarget = null
  }

  function onCardPointerDown(
    e: PointerEvent,
    pile: 'tableau' | 'waste' | 'foundation',
    pileIndex: number,
    cardIndex?: number
  ) {
    if (isVictory(state)) return
    e.preventDefault()
    let count = 1
    if (pile === 'tableau') {
      if (cardIndex === undefined) return
      const col = state.tableau[pileIndex]
      if (!col[cardIndex]?.faceUp) return
      count = col.length - cardIndex
    } else if (pile === 'waste') {
      if (state.waste.length === 0) return
    } else {
      if (state.foundation[pileIndex].length === 0) return
    }
    dragInfo = {
      pile,
      pileIndex,
      cardIndex,
      count,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      isDragging: false,
      pointerId: e.pointerId,
    }
  }

  // ---- 表示ヘルパー ----
  function rankLabel(rank: number): string {
    if (rank === 1) return 'A'
    if (rank === 11) return 'J'
    if (rank === 12) return 'Q'
    if (rank === 13) return 'K'
    return String(rank)
  }

  const SUIT_SYMBOL: Record<string, string> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' }
  const SUIT_COLOR: Record<string, string> = { spades: 'text-slate-900', hearts: 'text-red-600', diamonds: 'text-red-600', clubs: 'text-slate-900' }
  const FOUNDATION_SUIT = ['spades', 'hearts', 'diamonds', 'clubs'] as const

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

  function formatTime(s: number): string {
    return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`
  }

  function currentHint(): Move | null {
    if (!showHints || hints.length === 0) return null
    return hints[hintIndex % hints.length]
  }

  function isSelected(pile: 'tableau' | 'waste' | 'foundation', index: number): boolean {
    return selected?.pile === pile && selected?.index === index
  }

  // ---- カードビジュアル ----
  const CARD_BACK_STYLE =
    'background:#0f172a;' +
    'background-image:' +
    'repeating-linear-gradient(0deg,transparent,transparent 7px,rgba(99,102,241,0.25) 7px,rgba(99,102,241,0.25) 8px),' +
    'repeating-linear-gradient(90deg,transparent,transparent 7px,rgba(99,102,241,0.25) 7px,rgba(99,102,241,0.25) 8px);'

  function flipIn(_: Element, { duration = 220 }: { duration?: number } = {}) {
    return {
      duration,
      easing: cubicOut,
      css: (t: number) => `transform: perspective(600px) rotateY(${(1 - t) * 90}deg); opacity: ${t};`,
    }
  }

  function stockLayers(): number {
    if (state.stock.length === 0) return 0
    if (state.stock.length === 1) return 1
    if (state.stock.length <= 20) return 2
    return 3
  }

  onMount(() => {
    function onPointerMove(e: PointerEvent) {
      if (!dragInfo || e.pointerId !== dragInfo.pointerId) return
      dragInfo = { ...dragInfo, currentX: e.clientX, currentY: e.clientY }
      const dx = e.clientX - dragInfo.startX
      const dy = e.clientY - dragInfo.startY
      if (!dragInfo.isDragging && Math.sqrt(dx * dx + dy * dy) > 5) {
        dragInfo = { ...dragInfo, isDragging: true }
      }
      if (dragInfo.isDragging) updateDropTarget(e.clientX, e.clientY)
    }

    function onPointerUp(e: PointerEvent) {
      if (!dragInfo || e.pointerId !== dragInfo.pointerId) return
      if (dragInfo.isDragging) {
        if (dropTarget) {
          const move: Move = {
            from: { pile: dragInfo.pile, index: dragInfo.pileIndex },
            to: { pile: dropTarget.pile, index: dropTarget.index },
            count: dragInfo.count,
          }
          const prevScore = state.score
          const next = moveCards(state, move)
          if (next !== state) {
            const di = { ...dragInfo }
            const dt = { ...dropTarget }
            dragInfo = null
            dropTarget = null
            performSlamDrop(di, dt, next, prevScore)
            return
          }
        }
      } else {
        handleCardClick(dragInfo.pile, dragInfo.pileIndex, dragInfo.cardIndex)
      }
      dragInfo = null
      dropTarget = null
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      stopTimer()
      autoCompleting = false
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  })
</script>

{#snippet cardFace(card: Card, full: boolean)}
  <div class="absolute inset-0 rounded-lg border border-indigo-500/50 p-1 flex flex-col items-start overflow-hidden bg-white">
    <div class="leading-none {SUIT_COLOR[card.suit]}">
      <div class="text-sm font-bold leading-none">{rankLabel(card.rank)}</div>
      <div class="text-xs leading-none">{SUIT_SYMBOL[card.suit]}</div>
    </div>
    {#if full}
      {#if card.rank <= 10}
        <div class="w-full flex-1 relative {SUIT_COLOR[card.suit]}">
          {#each (PIP_LAYOUTS[card.rank] ?? []) as [x, y, rot], i (i)}
            <span
              class="absolute leading-none select-none"
              style="left:{x}%; top:{y}%; transform:translate(-50%,-50%){rot ? ' rotate(180deg)' : ''}; font-size:{card.rank === 1 ? 18 : card.rank <= 4 ? 11 : card.rank <= 7 ? 10 : 9}px;"
            >{SUIT_SYMBOL[card.suit]}</span>
          {/each}
        </div>
      {:else}
        <div class="w-full flex-1 flex items-center justify-center {SUIT_COLOR[card.suit]}">
          <span class="leading-none" style="font-size:26px;">{FACE_CHAR[card.rank]}</span>
        </div>
      {/if}
      <div class="rotate-180 self-end leading-none {SUIT_COLOR[card.suit]}">
        <div class="text-sm font-bold leading-none">{rankLabel(card.rank)}</div>
        <div class="text-xs leading-none">{SUIT_SYMBOL[card.suit]}</div>
      </div>
    {/if}
  </div>
{/snippet}

<div class="max-w-[560px] mx-auto px-4 py-4 flex flex-col gap-4">

  <!-- 行1: 設定行 -->
  <div class="flex items-center gap-2 flex-wrap">
    <button onclick={() => newGame()}
      class="px-2 py-1 text-xs rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50">
      ↺ 新ゲーム
    </button>
    <div class="flex items-center gap-1">
      <span class="text-xs font-bold text-slate-500">DRAW</span>
      {#each [1, 3] as mode (mode)}
        <button
          onclick={() => { pendingMode = mode as 1 | 3 }}
          class="px-3 py-1 text-xs rounded border transition-colors"
          class:bg-teal-600={pendingMode === mode}
          class:text-white={pendingMode === mode}
          class:border-teal-600={pendingMode === mode}
          class:bg-white={pendingMode !== mode}
          class:text-slate-600={pendingMode !== mode}
          class:border-slate-300={pendingMode !== mode}
        >{mode}枚</button>
      {/each}
    </div>
    <label class="flex items-center gap-1 cursor-pointer select-none">
      <input type="checkbox" bind:checked={useSeed} class="cursor-pointer" />
      <span class="text-xs text-slate-400">seed:</span>
    </label>
    <input
      type="text"
      inputmode="numeric"
      bind:value={seedInput}
      disabled={!useSeed}
      placeholder="指定なし"
      class="w-20 px-1.5 py-1 text-xs rounded border font-mono transition-colors"
      class:border-slate-300={useSeed}
      class:text-slate-600={useSeed}
      class:bg-white={useSeed}
      class:border-slate-200={!useSeed}
      class:text-slate-300={!useSeed}
      class:bg-slate-50={!useSeed}
    />
    {#if import.meta.env.DEV}
      <button
        onclick={debugTriggerAutoComplete}
        class="ml-auto px-2 py-1 text-xs rounded border border-purple-300 bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors"
      >ACテスト</button>
      <button
        onclick={debugTriggerClear}
        class="px-2 py-1 text-xs rounded border border-orange-300 bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors"
      >クリア演出テスト</button>
    {/if}
  </div>

  <!-- ゲームエリア -->
  <div bind:this={gameEl} class="bg-green-800 rounded-xl p-4 pb-10 select-none relative" style="min-height: 520px;"
    class:pointer-events-none={isVictory(state)}>

    <!-- スコア・ボタン行 -->
    <div class="flex items-start justify-between mb-3">
      <!-- 左: 得点・タイマー・タイムボーナス -->
      <div class="flex items-center gap-3">
        <span data-score-display class="inline-block">{#key state.score}<span class="text-sm text-emerald-300 font-mono score-bounce">🏆 {state.score}pt</span>{/key}</span>
        {#key timerPulseId}<span class="text-sm text-amber-300 font-mono"
          class:timer-small={timerPulseId > 0 && timerPulseType === 'small'}
          class:timer-large={timerPulseId > 0 && timerPulseType === 'large'}
        >⏱ {formatTime(state.elapsed)}</span>{/key}
        <span class="text-xs text-teal-300 font-mono">+{Math.max(0, 3000 - state.elapsed * 10)}pt ▲</span>
      </div>
      <!-- 右: アンドゥ・ヒント（各ボタンの上に回数表示） -->
      <div class="flex items-end gap-2">
        <div class="flex flex-col items-center gap-0.5">
          <span class="text-xs text-green-300/70 font-mono leading-none">{undoCount}回 <span class="text-red-300">(-{undoCount * 50}pt)</span></span>
          <button onclick={handleUndo} disabled={state.history.length === 0}
            class="px-2 py-1 text-xs rounded border border-green-600 bg-green-700 text-green-100 disabled:opacity-40 hover:bg-green-600 transition-colors">
            ↩ アンドゥ
          </button>
        </div>
        <div class="flex flex-col items-center gap-0.5">
          <span class="text-xs text-green-300/70 font-mono leading-none">{hintCount}回 <span class="text-red-300">(-{hintCount * 20}pt)</span></span>
          <button onclick={handleHint}
            class="px-2 py-1 text-xs rounded border border-green-600 bg-green-700 text-green-100 hover:bg-green-600 transition-colors">
            💡 ヒント
          </button>
        </div>
      </div>
    </div>

    <!-- 上段: 山札・捨て札・組札 -->
    <div class="flex gap-2 mb-4">
      <!-- 山札 -->
      <button
        onclick={(e) => handleStockClick(e)}
        class="w-16 h-[98px] rounded-lg border-2 border-green-600 bg-green-900 relative hover:bg-green-700 transition-colors flex items-center justify-center overflow-hidden"
      >
        {#if state.stock.length > 0}
          {#each { length: stockLayers() } as _, i}
            <div
              class="absolute w-14 h-[90px] rounded-md border border-indigo-500/50"
              style="{CARD_BACK_STYLE} top:{(stockLayers() - 1 - i) * 2}px; left:{(stockLayers() - 1 - i) * 2}px;"
            ></div>
          {/each}
        {:else}
          <span class="text-green-500 text-lg relative z-10">↺</span>
        {/if}
      </button>

      <!-- 捨て札 -->
      {#if state.drawMode === 3}
        {@const _fan = flyingToWaste() ? prevWasteFan : state.waste.slice(-3)}
        <div class="relative h-[98px] flex-shrink-0" style="width:64px; overflow:visible;">
          {#if _fan.length === 0}
            <div class="absolute w-16 inset-y-0 rounded-lg border-2 border-green-600 bg-green-900"></div>
          {:else}
            {#each _fan as card, i}
              {@const isTop = i === _fan.length - 1}
              {#if isTop}
                <button
                  data-waste
                  onpointerdown={(e) => onCardPointerDown(e, 'waste', 0)}
                  onclick={() => handleCardClick('waste', 0)}
                  ondblclick={(e) => handleDoubleClick(e, 'waste', 0)}
                  class="absolute w-16 h-[98px] rounded-lg border-2 transition-colors overflow-hidden"
                  style="left:{i * 16}px; z-index:{i + 2};"
                  class:border-yellow-400={currentHint()?.from.pile === 'waste'}
                  class:ring-2={isSelected('waste', 0)}
                  class:ring-blue-400={isSelected('waste', 0)}
                  class:border-green-600={currentHint()?.from.pile !== 'waste' && !isSelected('waste', 0)}
                  class:opacity-40={(dragInfo?.isDragging && dragInfo?.pile === 'waste') || slamAnims.some(a => a.hideSource && a.sourcePile === 'waste')}
                >
                  {@render cardFace(card, true)}
                </button>
              {:else}
                <div
                  class="absolute w-16 h-[98px] rounded-lg border border-slate-300 overflow-hidden pointer-events-none"
                  style="left:{i * 16}px; z-index:{i + 2};"
                >
                  {@render cardFace(card, true)}
                </div>
              {/if}
            {/each}
          {/if}
        </div>
      {:else}
        <button
          data-waste
          onpointerdown={(e) => onCardPointerDown(e, 'waste', 0)}
          onclick={() => handleCardClick('waste', 0)}
          ondblclick={(e) => state.waste.length > 0 ? handleDoubleClick(e, 'waste', 0) : undefined}
          class="w-16 h-[98px] rounded-lg border-2 transition-colors relative overflow-hidden"
          class:border-yellow-400={currentHint()?.from.pile === 'waste'}
          class:ring-2={isSelected('waste', 0)}
          class:ring-blue-400={isSelected('waste', 0)}
          class:border-green-600={currentHint()?.from.pile !== 'waste' && !isSelected('waste', 0)}
          class:bg-green-900={state.waste.length === 0}
          class:opacity-40={(dragInfo?.isDragging && dragInfo?.pile === 'waste') || slamAnims.some(a => a.hideSource && a.sourcePile === 'waste')}
        >
          {#if state.waste.length > 0}
            {#if flyingToWaste()}
              {#if state.waste.length >= 2}
                <div class="absolute inset-0">
                  {@render cardFace(state.waste[state.waste.length - 2], true)}
                </div>
              {/if}
            {:else}
              <div class="absolute inset-0">
                {@render cardFace(state.waste[state.waste.length - 1], true)}
              </div>
            {/if}
          {/if}
        </button>
      {/if}

      <div class="flex-1"></div>

      <!-- 組札 4つ -->
      {#each FOUNDATION_SUIT as suit, i (suit)}
        <button
          onpointerdown={(e) => onCardPointerDown(e, 'foundation', i)}
          onclick={() => handleCardClick('foundation', i)}
          data-pile="foundation"
          data-pile-index={i}
          class="w-16 h-[98px] rounded-lg border-2 transition-colors relative overflow-hidden"
          class:ring-2={isSelected('foundation', i) || (currentHint()?.from.pile === 'foundation' && currentHint()?.from.index === i)}
          class:ring-blue-400={isSelected('foundation', i)}
          class:ring-yellow-400={currentHint()?.from.pile === 'foundation' && currentHint()?.from.index === i && !isSelected('foundation', i)}
          class:border-blue-400={dropTarget?.pile === 'foundation' && dropTarget?.index === i}
          class:border-dashed={dropTarget?.pile === 'foundation' && dropTarget?.index === i}
          class:border-green-600={!isSelected('foundation', i) && !(currentHint()?.from.pile === 'foundation' && currentHint()?.from.index === i) && !(dropTarget?.pile === 'foundation' && dropTarget?.index === i)}
          class:bg-green-700={state.foundation[i].length === 0}
          class:bg-white={state.foundation[i].length > 0}
          class:opacity-40={(dragInfo?.isDragging && dragInfo?.pile === 'foundation' && dragInfo?.pileIndex === i) || slamAnims.some(a => a.hideSource && a.sourcePile === 'foundation' && a.sourcePileIndex === i)}
        >
          {#if flyingToFoundation(i) || slamAnims.some(a => a.hideDestFoundIdx === i)}
            {#if state.foundation[i].length >= 2}
              <div class="absolute inset-0">
                {@render cardFace(state.foundation[i][state.foundation[i].length - 2], true)}
              </div>
            {:else}
              <div class="absolute inset-0 flex items-center justify-center">
                <span class="text-green-500 text-2xl opacity-60">{SUIT_SYMBOL[suit]}</span>
              </div>
            {/if}
          {:else if state.foundation[i].length === 0}
            <div class="absolute inset-0 flex items-center justify-center">
              <span class="text-green-500 text-2xl opacity-60">{SUIT_SYMBOL[suit]}</span>
            </div>
          {:else}
            <div class="absolute inset-0">
              {@render cardFace(state.foundation[i][state.foundation[i].length - 1], true)}
            </div>
          {/if}
        </button>
      {/each}

    </div>

    <!-- タブロー 7列 -->
    <div class="flex gap-2">
      {#each state.tableau as col, colIdx (colIdx)}
        <div
          class="w-16 shrink-0 relative"
          data-pile="tableau"
          data-pile-index={colIdx}
          style="min-height: {Math.max(98, col.length * 28 + 70)}px;"
        >
          <!-- 空列クリック領域 -->
          <button
            onclick={() => { if (selected !== null) handleCardClick('tableau', colIdx) }}
            class="absolute inset-x-0 top-0 h-[98px] rounded-lg border-2 z-0 transition-colors"
            class:border-blue-400={dropTarget?.pile === 'tableau' && dropTarget?.index === colIdx}
            class:border-dashed={dropTarget?.pile === 'tableau' && dropTarget?.index === colIdx}
            class:border-green-600={!(dropTarget?.pile === 'tableau' && dropTarget?.index === colIdx)}
            class:border-dotted={!(dropTarget?.pile === 'tableau' && dropTarget?.index === colIdx)}
            aria-label="列{colIdx + 1}"
          ></button>
          <!-- カード -->
          {#each col as card, cardIdx (cardIdx)}
            {@const hint = currentHint()}
            {@const isHoverTarget = dropTarget?.pile === 'tableau' && dropTarget?.index === colIdx}
            <button
              data-card-idx={cardIdx}
              onpointerdown={(e) => onCardPointerDown(e, 'tableau', colIdx, cardIdx)}
              onclick={() => handleCardClick('tableau', colIdx, cardIdx)}
              ondblclick={(e) => card.faceUp ? handleDoubleClick(e, 'tableau', colIdx, cardIdx) : undefined}
              class="absolute left-0 right-0 rounded-lg transition-all"
              style="top: {cardIdx * 28}px; height: 98px; z-index: {cardIdx + 1}; opacity: {(dragInfo?.isDragging && dragInfo.pile === 'tableau' && dragInfo.pileIndex === colIdx && cardIdx >= col.length - dragInfo.count) || slamAnims.some(a => a.hideSource && a.sourcePile === 'tableau' && a.sourcePileIndex === colIdx && cardIdx >= col.length - a.sourceCount) ? 0.4 : 1};"
              class:ring-2={
                (hint?.from.pile === 'tableau' && hint?.from.index === colIdx && cardIdx >= col.length - hint.count) ||
                (isSelected('tableau', colIdx) && cardIdx >= col.length - (selected?.count ?? 0))
              }
              class:ring-yellow-400={hint?.from.pile === 'tableau' && hint?.from.index === colIdx && cardIdx >= col.length - hint.count && !isSelected('tableau', colIdx)}
              class:ring-blue-400={isSelected('tableau', colIdx) && cardIdx >= col.length - (selected?.count ?? 0)}
              class:-translate-y-1={
                (isSelected('tableau', colIdx) && cardIdx >= col.length - (selected?.count ?? 0)) ||
                (isHoverTarget && cardIdx === col.length - 1)
              }
            >
              {#if card.faceUp}
                <div class="absolute inset-0" in:flipIn={{ duration: 200 }}>
                  {@render cardFace(card, true)}
                </div>
              {:else}
                <div class="absolute inset-0 rounded-lg border border-indigo-500/50" style="{CARD_BACK_STYLE}"></div>
              {/if}
              {#if isHoverTarget}
                <div class="absolute inset-0 rounded-lg bg-blue-400/30 pointer-events-none"></div>
              {/if}
            </button>
          {/each}
        </div>
      {/each}
    </div>

    <!-- DRAW・SEED表示（左下） -->
    <div class="absolute bottom-3 left-4">
      <span class="text-xs text-green-400/60 font-mono">DRAW:{state.drawMode} / seed:{state.seed}</span>
    </div>

    <!-- アニメーション切り替え（右下） -->
    <div class="absolute bottom-3 right-4 flex items-center gap-1.5">
      <input type="checkbox" id="anim-toggle" bind:checked={animEnabled} class="w-3.5 h-3.5 accent-green-400 cursor-pointer" />
      <label for="anim-toggle" class="text-xs text-green-400/60 font-mono select-none cursor-pointer">ANIM</label>
    </div>
  </div>

  <!-- TOP10スコア -->
  <div class="mt-2 border border-slate-200 rounded-lg overflow-hidden">
    <div class="bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">🏆 TOP 10</div>
    {#if top10.length === 0}
      <p class="text-xs text-slate-400 px-3 py-3">まだ記録がありません。クリアして登録しよう！</p>
    {:else}
      <table class="w-full text-xs">
        <thead>
          <tr class="bg-slate-50 border-b border-slate-200">
            <th class="px-2 py-1 text-left text-slate-500 font-medium">#</th>
            <th class="px-2 py-1 text-right text-slate-500 font-medium">スコア</th>
            <th class="px-2 py-1 text-right text-slate-500 font-medium">タイム</th>
            <th class="px-2 py-1 text-center text-slate-500 font-medium">ドロー</th>
            <th class="px-2 py-1 text-right text-slate-500 font-medium">日付</th>
            <th class="px-2 py-1 text-right text-slate-500 font-medium">シード</th>
          </tr>
        </thead>
        <tbody>
          {#each top10 as entry, i (i)}
            <tr
              class="border-b border-slate-100 last:border-0"
              class:bg-amber-50={i + 1 === clearRank}
            >
              <td class="px-2 py-1.5 font-mono text-slate-600">{i + 1}</td>
              <td class="px-2 py-1.5 text-right font-mono font-bold text-emerald-600">{entry.score}pt</td>
              <td class="px-2 py-1.5 text-right font-mono text-slate-600">{formatTime(entry.elapsed)}</td>
              <td class="px-2 py-1.5 text-center text-slate-500">{entry.drawMode}枚</td>
              <td class="px-2 py-1.5 text-right text-slate-500">{entry.date.slice(5).replace('-', '/')}</td>
              <td class="px-2 py-1.5 text-right font-mono text-slate-400">{entry.seed ?? '-'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>

  <!-- 説明文 -->
  <div class="mt-4 space-y-3 text-sm text-slate-600">
    <div class="border border-slate-200 rounded-lg p-4">
      <h3 class="font-bold text-slate-700 mb-2">遊び方</h3>
      <ul class="space-y-1 text-xs text-slate-500 leading-relaxed">
        <li>カードをドラッグ、またはタップして移動先をタップすることで移動できます。</li>
        <li>タブローは赤黒交互・降順に重ねられます。空列にはKのみ置けます。</li>
        <li>組み札（右上4列）にA→Kの順で同スートのカードを積んでクリアです。</li>
        <li>山札をタップするとカードをめくれます。ヒントボタンで移動可能な手を確認できます。</li>
        <li>全カードが表向きになると自動でクリアアニメーションが始まります。</li>
        <li>タブローの最上段カードはダブルタップで組み札に直接移動できます。</li>
      </ul>
    </div>
    <div class="border border-amber-200 bg-amber-50 rounded-lg p-4">
      <h3 class="font-bold text-amber-700 mb-1">このページについて</h3>
      <p class="text-xs text-amber-600 leading-relaxed">
        このソリティアはゲーム制作や演出（アニメーション・エフェクト）の試作を目的として作成した画面です。
        カードの投下アニメーション・衝撃波エフェクト・スコア演出などの動きを実際に動かしながら調整するために使用しています。
      </p>
    </div>
  </div>

  <!-- フライングカード -->
  {#if flyCard}
    <div
      class="pointer-events-none fixed z-[500] w-16 h-[98px] overflow-hidden rounded-lg"
      style="left:{flyCard.moving ? flyCard.toX : flyCard.fromX}px; top:{flyCard.moving ? flyCard.toY : flyCard.fromY}px; transition: left {flyCard.duration}ms cubic-bezier(0.4,0,0.2,1), top {flyCard.duration}ms cubic-bezier(0.4,0,0.2,1);"
    >
      {#if flyCard.flip}
        <div
          class="absolute inset-0 rounded-lg border border-indigo-500/50"
          style="{CARD_BACK_STYLE} transition: transform {Math.round(flyCard.duration/2)}ms linear; transform: perspective(600px) rotateY({flyCard.moving ? 90 : 0}deg);"
        ></div>
        <div
          class="absolute inset-0"
          style="transition: transform {Math.round(flyCard.duration/2)}ms linear {Math.round(flyCard.duration/2)}ms; transform: perspective(600px) rotateY({flyCard.moving ? 0 : -90}deg);"
        >
          {@render cardFace(flyCard.card, true)}
        </div>
      {:else}
        <div class="absolute inset-0">
          {@render cardFace(flyCard.card, true)}
        </div>
      {/if}
    </div>
  {/if}

  <!-- ドラッグゴースト -->
  {#each slamAnims as anim (anim.id)}
    <div
      data-ghost-id={anim.id}
      class="pointer-events-none fixed z-[300]"
      style="left:{anim.fromX}px; top:{anim.fromY}px; width:64px; height:{(anim.cards.length - 1) * 28 + 98}px; filter: drop-shadow(0 16px 32px rgba(0,0,0,0.7)) drop-shadow(0 0 12px rgba(251,191,36,0.5));"
    >
      {#each anim.cards as card, i (i)}
        <div class="absolute w-16 rounded-lg border border-slate-200 overflow-hidden"
          style="top:{i*28}px; height:98px;">
          {@render cardFace(card, true)}
        </div>
      {/each}
    </div>
  {/each}

  {#if dragInfo?.isDragging}
    <div
      class="pointer-events-none fixed z-[200]"
      style="left:{dragInfo.currentX - 32}px; top:{dragInfo.currentY - 20}px;"
    >
      {#each getDragCards() as card, i (i)}
        <div
          class="absolute w-16 rounded-lg border border-slate-200 shadow-2xl overflow-hidden"
          style="top:{i * 28}px; height:{i === getDragCards().length - 1 ? 98 : 46}px; opacity:0.9;"
        >
          {@render cardFace(card, i === getDragCards().length - 1)}
        </div>
      {/each}
    </div>
  {/if}

  <!-- 勝利モーダル -->
  {#if showVictory}
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-[900]"
      onclick={() => showVictory = false}>
      <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center relative"
        onclick={(e) => e.stopPropagation()}>
        <button
          onclick={() => showVictory = false}
          class="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors text-xl leading-none"
        >×</button>
        <div class="text-5xl mb-4">🎉</div>
        <h2 class="text-2xl font-bold text-slate-800 mb-2">クリア！</h2>
        {#if clearRank > 0}
          <p class="text-amber-500 font-bold text-lg mb-2">🏆 {clearRank}位入り！</p>
        {/if}
        <p class="text-slate-500 mb-3">タイム: <span class="font-mono font-bold text-slate-700">{formatTime(state.elapsed)}</span></p>

        {#if clearBreakdown}
          {@const bd = clearBreakdown}
          <table class="w-full text-sm mb-4 border border-slate-200 rounded-lg overflow-hidden">
            <tbody>
              <tr class="border-b border-slate-100">
                <td class="px-3 py-1.5 text-left text-slate-500">ゲームスコア</td>
                <td class="px-3 py-1.5 text-right font-mono text-slate-700">+{bd.baseScore}pt</td>
              </tr>
              <tr class="border-b border-slate-100">
                <td class="px-3 py-1.5 text-left text-slate-500">タイムボーナス</td>
                <td class="px-3 py-1.5 text-right font-mono text-teal-600">+{bd.timeBonus}pt</td>
              </tr>
              {#if bd.undoCount > 0}
                <tr class="border-b border-slate-100">
                  <td class="px-3 py-1.5 text-left text-slate-500">↩ アンドゥ {bd.undoCount}回</td>
                  <td class="px-3 py-1.5 text-right font-mono text-red-400">-{bd.undoPenalty}pt</td>
                </tr>
              {/if}
              {#if bd.hintCount > 0}
                <tr class="border-b border-slate-100">
                  <td class="px-3 py-1.5 text-left text-slate-500">💡 ヒント {bd.hintCount}回</td>
                  <td class="px-3 py-1.5 text-right font-mono text-red-400">-{bd.hintPenalty}pt</td>
                </tr>
              {/if}
              {#if bd.draw3Mult > 1}
                <tr class="border-b border-slate-100">
                  <td class="px-3 py-1.5 text-left text-slate-500">DRAW3ボーナス</td>
                  <td class="px-3 py-1.5 text-right font-mono text-purple-500">×{bd.draw3Mult}</td>
                </tr>
              {/if}
              <tr class="bg-slate-50">
                <td class="px-3 py-2 text-left font-bold text-slate-700">最終スコア</td>
                <td class="px-3 py-2 text-right font-mono font-bold text-emerald-600 text-base">{bd.finalScore}pt</td>
              </tr>
            </tbody>
          </table>
        {/if}

        <p class="text-slate-400 text-xs mb-6">シード: <span class="font-mono">{state.seed}</span></p>
        <button
          onclick={() => newGame()}
          class="w-full py-3 rounded-xl bg-teal-600 text-white font-bold text-lg hover:bg-teal-700 transition-colors"
        >
          もう一度
        </button>
      </div>
    </div>
  {/if}
</div>

{#each floatScores as fs (fs.id)}
  <div class="float-score" style="left:{fs.x}px; top:{fs.y}px; animation-duration:{cfg.scoreDelta.durationMs}ms;">+{fs.delta}</div>
{/each}

{#each scoreDeltas as sd (sd.id)}
  <div class="score-delta {sd.delta > 0 ? 'score-delta-pos' : 'score-delta-neg'}" style="left:{sd.x}px; top:{sd.y}px; animation-duration:{cfg.scoreDelta.durationMs}ms;">{sd.delta > 0 ? '+' : ''}{sd.delta}</div>
{/each}

{#each glowEffects as g (g.id)}
  <div class="glow-ring" style="left:{g.x}px; top:{g.y}px; width:{g.w}px; height:{g.h}px;"></div>
{/each}

{#each sparkles as s (s.id)}
  <span class="sparkle-particle" style="left:{s.x}px; top:{s.y}px; --dx:{s.dx}px; --dy:{s.dy}px; color:{s.color}; font-size:{s.size}px; animation-delay:{s.delay}ms; animation-duration:{cfg.sparkle.durationMs}ms;">{s.char}</span>
{/each}

{#if showVictory}
  <canvas bind:this={confettiCanvas} class="fixed inset-0 pointer-events-none z-[800]"></canvas>
{/if}

<style>
@keyframes floatUp {
  0%   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1.3); }
  20%  { opacity: 1; transform: translateX(-50%) translateY(-12px) scale(1); }
  100% { opacity: 0; transform: translateX(-50%) translateY(-55px) scale(0.85); }
}
.float-score {
  position: fixed;
  pointer-events: none;
  z-index: 600;
  font-weight: 800;
  font-size: 1.1rem;
  color: #f59e0b;
  text-shadow: 0 0 8px rgba(251,191,36,0.8), 0 1px 3px rgba(0,0,0,0.4);
  animation: floatUp 1.1s ease-out forwards;
  white-space: nowrap;
}

@keyframes sparkleShoot {
  0%   { transform: translate(-50%, -50%) translate(0px, 0px)             scale(1.5) rotate(0deg);   opacity: 1; }
  65%  { opacity: 1; }
  100% { transform: translate(-50%, -50%) translate(var(--dx), var(--dy)) scale(0.1) rotate(300deg); opacity: 0; }
}
.sparkle-particle {
  position: fixed;
  pointer-events: none;
  z-index: 700;
  line-height: 1;
  animation: sparkleShoot 0.78s ease-out forwards;
  text-shadow: 0 0 8px currentColor, 0 0 16px currentColor;
}

.score-delta {
  position: fixed;
  pointer-events: none;
  z-index: 600;
  font-weight: 800;
  font-size: 0.85rem;
  animation: floatUp 1.1s ease-out forwards;
  white-space: nowrap;
}
.score-delta-pos {
  color: #34d399;
  text-shadow: 0 0 8px rgba(52,211,153,0.8), 0 1px 3px rgba(0,0,0,0.4);
}
.score-delta-neg {
  color: #f87171;
  text-shadow: 0 0 8px rgba(248,113,113,0.8), 0 1px 3px rgba(0,0,0,0.4);
}

@keyframes scoreBounce {
  0%   { transform: scale(1.65); color: #f59e0b; }
  60%  { transform: scale(0.92); }
  100% { transform: scale(1); }
}
.score-bounce {
  display: inline-block;
  animation: scoreBounce 0.45s ease-out;
}

@keyframes timerPulseSmall {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.25); color: #f97316; }
  100% { transform: scale(1); }
}
@keyframes timerPulseLarge {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.55); color: #ef4444; }
  100% { transform: scale(1); }
}
.timer-small { display: inline-block; animation: timerPulseSmall 0.4s ease-out; }
.timer-large { display: inline-block; animation: timerPulseLarge 0.65s ease-out; }

@keyframes glowPulse {
  0%   { box-shadow: 0 0 0 3px #fbbf24, 0 0 20px 8px rgba(251,191,36,0.65); opacity: 1; }
  100% { box-shadow: 0 0 0 0 rgba(251,191,36,0), 0 0 0 0 rgba(251,191,36,0); opacity: 0; }
}
.glow-ring {
  position: fixed;
  pointer-events: none;
  z-index: 550;
  border-radius: 0.5rem;
  animation: glowPulse 0.65s ease-out forwards;
}
</style>
