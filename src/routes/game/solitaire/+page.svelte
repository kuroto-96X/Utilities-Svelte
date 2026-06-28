<!-- src/routes/game/solitaire/+page.svelte -->
<script lang="ts">
  import { onMount, tick } from 'svelte'
  import { cubicOut } from 'svelte/easing'
  import type { GameState, Move, Card } from '$lib/game/solitaire/types'
  import {
    dealInitial, drawFromStock, moveCards,
    undo, getHints, canAutoComplete, autoCompleteStep, getAutoCompleteMove, isVictory
  } from '$lib/game/solitaire/engine'

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
  const _init: GameState = (_sg && !isVictory(_sg)) ? _sg : dealInitial(1)
  const _sets = loadSavedSettings(_init.seed, _init.drawMode)

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

  // ---- LocalStorage自動保存 ----
  $effect(() => {
    try { localStorage.setItem('solitaire-game', JSON.stringify({ state })) } catch {}
  })
  $effect(() => {
    try { localStorage.setItem('solitaire-settings', JSON.stringify({ useSeed, seedInput, pendingMode })) } catch {}
  })

  // ---- タイマー ----
  let timerInterval: ReturnType<typeof setInterval> | null = null
  let gameStarted = $state(false)

  function startTimer() {
    if (timerInterval) return
    timerInterval = setInterval(() => {
      state = { ...state, elapsed: state.elapsed + 1 }
    }, 1000)
  }
  function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null }
  }

  // ---- オートコンプリート ----
  async function startAutoComplete() {
    autoCompleting = true
    while (autoCompleting) {
      const move = getAutoCompleteMove(state)
      if (!move || !autoCompleting) break

      const foundIdx = move.to.index
      const toEl = document.querySelector(`[data-pile="foundation"][data-pile-index="${foundIdx}"]`)
      if (!toEl) break

      let fromX = 0, fromY = 0
      if (move.from.pile === 'waste') {
        const r = document.querySelector('[data-waste]')?.getBoundingClientRect()
        fromX = r?.left ?? 0; fromY = r?.top ?? 0
      } else {
        const col = state.tableau[move.from.index]
        const r = document.querySelector(`[data-pile="tableau"][data-pile-index="${move.from.index}"]`)?.getBoundingClientRect()
        fromX = r?.left ?? 0
        fromY = (r?.top ?? 0) + (col.length - 1) * 28
      }

      const card = move.from.pile === 'waste'
        ? state.waste[state.waste.length - 1]
        : state.tableau[move.from.index][state.tableau[move.from.index].length - 1]

      const prevScore = state.score
      state = autoCompleteStep(state)
      const delta = state.score - prevScore

      await startFlyAnimation(card, fromX, fromY, toEl, false, { pile: 'foundation', index: foundIdx }, 70)

      if (delta > 0) triggerScoreEffects(delta, toEl)
      if (!autoCompleting) break

      if (isVictory(state)) {
        stopTimer()
        clearRank = saveToTop10(state.score, state.elapsed, state.drawMode, state.seed)
        showVictory = true
        launchConfetti()
        autoCompleting = false
        return
      }
    }
    autoCompleting = false
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
      const toEl = document.querySelector('[data-waste]')
      const fromRect = (e.currentTarget as Element).getBoundingClientRect()
      state = drawFromStock(state)
      selected = null
      if (toEl) await startFlyAnimation(card, fromRect.left, fromRect.top, toEl, true, 'waste')
    } else {
      state = drawFromStock(state)
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
    const toEl = document.querySelector(`[data-pile="foundation"][data-pile-index="${foundIdx}"]`)
    const card = pile === 'waste'
      ? state.waste[state.waste.length - 1]
      : state.tableau[pileIndex][state.tableau[pileIndex].length - 1]
    const prevScore = state.score
    state = moveCards(state, hint)
    const delta = state.score - prevScore
    selected = null
    showHints = false
    const fromRect = (e.currentTarget as Element).getBoundingClientRect()
    if (toEl) await startFlyAnimation(card, fromRect.left, fromRect.top, toEl, false, { pile: 'foundation', index: foundIdx })
    if (delta > 0 && toEl) triggerScoreEffects(delta, toEl)
    checkAfterMove()
  }

  function cardBg(rank: number): string {
    if (rank === 13) return 'bg-amber-50'
    if (rank === 12) return 'bg-rose-50'
    if (rank === 11) return 'bg-indigo-50'
    return 'bg-white'
  }

  function handleHint() {
    if (showHints && hints.length > 0) {
      hintIndex = (hintIndex + 1) % hints.length
      return
    }
    const h = getHints(state)
    if (h.length === 0) return
    hints = h
    showHints = true
    hintIndex = 0
  }

  function handleUndo() {
    state = undo(state)
    selected = null; showHints = false
  }

  function loadSavedGame(): GameState | null {
    try {
      const saved = localStorage.getItem('solitaire-game')
      if (!saved) return null
      const parsed = JSON.parse(saved) as { state?: GameState }
      return parsed?.state ?? null
    } catch {
      return null
    }
  }

  function loadSavedSettings(defaultSeed: number, defaultDrawMode: 1 | 3): { useSeed: boolean; seedInput: string; pendingMode: 1 | 3 } {
    try {
      const saved = localStorage.getItem('solitaire-settings')
      if (saved) {
        const p = JSON.parse(saved)
        return {
          useSeed: typeof p.useSeed === 'boolean' ? p.useSeed : false,
          seedInput: typeof p.seedInput === 'string' ? p.seedInput : String(defaultSeed),
          pendingMode: (p.pendingMode === 1 || p.pendingMode === 3) ? p.pendingMode as 1 | 3 : defaultDrawMode,
        }
      }
    } catch {}
    return { useSeed: false, seedInput: String(defaultSeed), pendingMode: defaultDrawMode }
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

  function triggerScoreEffects(delta: number, destEl: Element | null) {
    if (delta <= 0 || !destEl) return
    const rect = destEl.getBoundingClientRect()
    const fid = _effectId++
    floatScores = [...floatScores, { id: fid, delta, x: rect.left + rect.width / 2, y: rect.top + 10 }]
    setTimeout(() => { floatScores = floatScores.filter(f => f.id !== fid) }, 1100)
    const gid = _effectId++
    glowEffects = [...glowEffects, { id: gid, x: rect.left, y: rect.top, w: rect.width, h: rect.height }]
    setTimeout(() => { glowEffects = glowEffects.filter(g => g.id !== gid) }, 650)
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

  function checkAfterMove() {
    if (isVictory(state)) {
      stopTimer()
      clearRank = saveToTop10(state.score, state.elapsed, state.drawMode, state.seed)
      showVictory = true
      launchConfetti()
      return
    }
    if (!autoCompleting && canAutoComplete(state)) startAutoComplete()
  }

  function debugTriggerClear() {
    stopTimer()
    const suits = ['spades', 'hearts', 'diamonds', 'clubs'] as const
    const foundation = suits.map(suit =>
      Array.from({ length: 13 }, (_, i) => ({ suit, rank: (i + 1) as Card['rank'], faceUp: true }))
    )
    state = { ...state, foundation, tableau: [[], [], [], [], [], [], []], stock: [], waste: [], history: [] }
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
            state = next
            triggerScoreEffects(next.score - prevScore, getDestEl(dropTarget.pile, dropTarget.index))
            selected = null
            showHints = false
            checkAfterMove()
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
      <div class="w-full flex-1 flex items-center justify-center gap-1 {SUIT_COLOR[card.suit]}">
        <span class="text-2xl font-bold leading-none">{rankLabel(card.rank)}</span>
        <span class="text-xl leading-none">{SUIT_SYMBOL[card.suit]}</span>
      </div>
      <div class="rotate-180 self-end leading-none {SUIT_COLOR[card.suit]}">
        <div class="text-sm font-bold leading-none">{rankLabel(card.rank)}</div>
        <div class="text-xs leading-none">{SUIT_SYMBOL[card.suit]}</div>
      </div>
    {/if}
  </div>
{/snippet}

<div class="max-w-[560px] mx-auto px-4 py-4 flex flex-col gap-4">

  <!-- 設定行 -->
  <div class="flex items-center gap-2 flex-wrap">
    <span class="text-xs font-bold text-slate-500">DRAW</span>
    <div class="flex gap-1">
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
    <button onclick={() => newGame()}
      class="px-2 py-1 text-xs rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50">
      ↺ 新ゲーム
    </button>
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
  </div>

  <!-- ゲーム情報行 -->
  <div class="flex items-center gap-3 flex-wrap">
    <span class="text-sm text-amber-600 font-mono">⏱ {formatTime(state.elapsed)}</span>
    {#key state.score}<span class="text-sm text-emerald-600 font-mono score-bounce">🏆 {state.score}pt</span>{/key}
    <span class="text-xs text-slate-400 font-mono">DRAW:{state.drawMode} / seed:{state.seed}</span>
    <div class="ml-auto flex items-center gap-2">
      <button onclick={handleUndo} disabled={state.history.length === 0}
        class="px-2 py-1 text-xs rounded border border-slate-300 bg-white text-slate-600 disabled:opacity-40 hover:bg-slate-50">
        ↩ アンドゥ
      </button>
      <button onclick={handleHint}
        class="px-2 py-1 text-xs rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50">
        💡 ヒント
      </button>
    </div>
  </div>

  {#if import.meta.env.DEV}
    <div class="flex items-center gap-2 px-1">
      <span class="text-xs font-bold text-orange-400">DEV</span>
      <button
        onclick={debugTriggerClear}
        class="px-2 py-1 text-xs rounded border border-orange-300 bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors"
      >クリア演出テスト</button>
    </div>
  {/if}

  <!-- ゲームエリア -->
  <div class="bg-green-800 rounded-xl p-4 select-none" style="min-height: 520px;"
    class:pointer-events-none={isVictory(state)}>

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
        class:opacity-40={dragInfo?.isDragging && dragInfo?.pile === 'waste'}
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
        >
          {#if flyingToFoundation(i)}
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
            <button
              onpointerdown={(e) => onCardPointerDown(e, 'tableau', colIdx, cardIdx)}
              onclick={() => handleCardClick('tableau', colIdx, cardIdx)}
              ondblclick={(e) => card.faceUp ? handleDoubleClick(e, 'tableau', colIdx, cardIdx) : undefined}
              class="absolute left-0 right-0 rounded-lg transition-all"
              style="top: {cardIdx * 28}px; height: {cardIdx >= col.length - 2 ? 98 : 46}px; z-index: {cardIdx + 1}; opacity: {dragInfo?.isDragging && dragInfo.pile === 'tableau' && dragInfo.pileIndex === colIdx && cardIdx >= col.length - dragInfo.count ? 0.4 : 1};"
              class:ring-2={
                (hint?.from.pile === 'tableau' && hint?.from.index === colIdx && cardIdx >= col.length - hint.count) ||
                (isSelected('tableau', colIdx) && cardIdx >= col.length - (selected?.count ?? 0))
              }
              class:ring-yellow-400={hint?.from.pile === 'tableau' && hint?.from.index === colIdx && cardIdx >= col.length - hint.count && !isSelected('tableau', colIdx)}
              class:ring-blue-400={isSelected('tableau', colIdx) && cardIdx >= col.length - (selected?.count ?? 0)}
              class:-translate-y-1={isSelected('tableau', colIdx) && cardIdx >= col.length - (selected?.count ?? 0)}
            >
              {#if card.faceUp}
                <div class="absolute inset-0" in:flipIn={{ duration: 200 }}>
                  {@render cardFace(card, cardIdx >= col.length - 2)}
                </div>
              {:else}
                <div class="absolute inset-0 rounded-lg border border-indigo-500/50" style="{CARD_BACK_STYLE}"></div>
              {/if}
            </button>
          {/each}
        </div>
      {/each}
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
        <p class="text-slate-500 mb-1">タイム: <span class="font-mono font-bold text-slate-700">{formatTime(state.elapsed)}</span></p>
        <p class="text-slate-500 mb-1">スコア: <span class="font-bold text-emerald-600">{state.score} pt</span></p>
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
  <div class="float-score" style="left:{fs.x}px; top:{fs.y}px;">+{fs.delta}</div>
{/each}

{#each glowEffects as g (g.id)}
  <div class="glow-ring" style="left:{g.x}px; top:{g.y}px; width:{g.w}px; height:{g.h}px;"></div>
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

@keyframes scoreBounce {
  0%   { transform: scale(1.65); color: #f59e0b; }
  60%  { transform: scale(0.92); }
  100% { transform: scale(1); }
}
.score-bounce {
  display: inline-block;
  animation: scoreBounce 0.45s ease-out;
}

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
