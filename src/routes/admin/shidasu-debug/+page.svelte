<script lang="ts">
  import { onMount } from 'svelte'
  import { loadParams } from '$lib/game/shidasu/params'
  import { startWave, playCard, drawStock, forceStockTop, triggerSabotage, createInitialRun, resolveSealedRoleEffect } from '$lib/game/shidasu/engine'
  import { SABOTAGE_POOL } from '$lib/game/shidasu/sabotage'
  import { applyRiteEffect } from '$lib/game/shidasu/riteEffects'
  import { applyRevelationEffect, revelationNeedsTarget } from '$lib/game/shidasu/revelationEffects'
  import RiteExecutePanel from './RiteExecutePanel.svelte'
  import RevelationExecutePanel from './RevelationExecutePanel.svelte'
  import RoleStatusEditor from './RoleStatusEditor.svelte'
  import { ITEM_POOL, itemDesc, itemName } from '$lib/game/shidasu/items'
  import { defaultOracleLevels } from '$lib/game/shidasu/oracles'
  import { standardDeckComposition } from '$lib/game/shidasu/deck'
  import type { WaveState, Card, ItemId, DeckCard, Suit, Rank, RiteId, RevelationId, RoleName, SabotageActionId } from '$lib/game/shidasu/types'
  import ItemChecklist from './ItemChecklist.svelte'
  import DebugStatePanel from './DebugStatePanel.svelte'
  import CardPalette from './CardPalette.svelte'
  import CardFace from '../../game/shidasu/CardFace.svelte'
  import PlayArea from '../../game/shidasu/PlayArea.svelte'
  import type { SealFlashTarget, ConfiscatedTarget } from '../../game/shidasu/PlayArea.svelte'
  import RoleStatusPanel from '../../game/shidasu/RoleStatusPanel.svelte'

  const params = loadParams()
  const TARGET = Number.MAX_SAFE_INTEGER
  const ITEMS_STORAGE_KEY = 'shidasu-debug-items'

  function loadSavedItems(): ItemId[] {
    try {
      const saved = localStorage.getItem(ITEMS_STORAGE_KEY)
      if (!saved) return []
      const parsed = JSON.parse(saved)
      return Array.isArray(parsed) ? (parsed as ItemId[]) : []
    } catch {
      return []
    }
  }

  let items = $state<ItemId[]>(loadSavedItems())
  let highlightedItemId = $state<ItemId | null>(null)
  let deckComposition = $state<DeckCard[]>(standardDeckComposition())
  let oracleLevels = $state<Record<RoleName, number>>(defaultOracleLevels())
  let wave = $state<WaveState>(startWave(params, 0, 0, items, deckComposition, undefined, 0, oracleLevels).wave)
  let lastSnapshot = $state<WaveState | null>(null)
  // PlayArea側で発動検知したsealFlashTarget(封印系妨害行動のフラッシュ演出対象)を
  // 受け取って保持する。本編(+page.svelte)と同じ仕組み。
  let sealFlashTarget = $state<SealFlashTarget | null>(null)

  let confiscateFadingTarget = $state<ConfiscatedTarget | null>(null)
  // RoleStatusPanel表示用: 現在の封印状態(役封印/天啓封印)から、役の実効レベルへの補正情報を導出する。
  let sealedRoleEffect = $derived(resolveSealedRoleEffect(wave.activeSeal))
  let flashingRoles = $derived.by((): RoleName[] => {
    if (sealFlashTarget?.kind === 'role') return sealFlashTarget.names
    if (sealFlashTarget?.kind === 'revelationOrOracle' && sealFlashTarget.ref.kind === 'oracle') return [sealFlashTarget.ref.id]
    return []
  })
  // PlayAreaのwaveKey propに渡す世代カウンタ。本編(+page.svelte)のrun.waveGenerationと
  // 同じ役割で、新しいWave生成のたびに増やす。これが無いとPlayArea内のwaveKey監視effect
  // (Wave開始時の配布アニメーション起動、dealtCellsの初期化)が一度も発火せず、dealtCellsが
  // 常に空のままになる。妨害演出等でdealAnimationActiveがtrueになった際、対象外の列まで
  // 「まだ配布されていない」扱いで非表示になってしまう不具合があったため追加した。
  let waveGeneration = $state(0)

  interface DragState {
    source: { suit: Suit; rank: Rank; wild: boolean }
    startX: number
    startY: number
    currentX: number
    currentY: number
    isDragging: boolean
    pointerId: number
  }
  let dragState = $state<DragState | null>(null)
  let dropTarget = $state<{ col: number; row: number } | 'stockTop' | null>(null)

  function newWave() {
    const result = startWave(params, 0, 0, items, deckComposition, undefined, 0, oracleLevels)
    wave = result.wave
    deckComposition = result.deckComposition
    lastSnapshot = null
    pendingDebugRevelation = null
    waveGeneration += 1
  }

  function resetDeck() {
    deckComposition = standardDeckComposition()
    // 護符の効果(永劫のワイルド追加・豊穣のランダム変換など)を
    // 発動させずに配り直すため、newWave()を再利用せずitemsに空配列を渡す
    const result = startWave(params, 0, 0, [], deckComposition, undefined, 0, oracleLevels)
    wave = result.wave
    deckComposition = result.deckComposition
    lastSnapshot = null
    pendingDebugRevelation = null
    waveGeneration += 1
  }

  function handleSetOracleLevel(roleName: RoleName, level: number) {
    const clamped = Math.max(1, Math.floor(level) || 1)
    oracleLevels = { ...oracleLevels, [roleName]: clamped }
    wave = { ...wave, oracleLevels: { ...wave.oracleLevels, [roleName]: clamped } }
    lastSnapshot = null
  }

  function handlePlayCard(colIndex: number, rowIndex: number) {
    const result = playCard(params, wave, 'none', items, TARGET, colIndex, deckComposition, Math.random, null, rowIndex)
    wave = result.wave
    deckComposition = result.deckComposition
    lastSnapshot = null
  }

  function handleDraw() {
    const result = drawStock(params, wave, items, TARGET, deckComposition, 'none')
    wave = result.wave
    deckComposition = result.deckComposition
    lastSnapshot = null
  }

  function handleTriggerSabotage(id: SabotageActionId) {
    const run = { ...createInitialRun(), items, wave }
    const next = triggerSabotage(params, run, id, Math.random)
    if (next.wave) wave = next.wave
    items = next.items
    lastSnapshot = null
  }

  function handleToggleItem(id: ItemId, checked: boolean) {
    if (checked) {
      if (!items.includes(id)) items = [...items, id]
    } else {
      items = items.filter(x => x !== id)
    }
    lastSnapshot = null
  }

  function handleSetAllItems(checked: boolean) {
    items = checked ? [...ITEM_POOL] : []
    lastSnapshot = null
  }

  function handleForceDraw(suit: Suit, rank: Rank, wild: boolean) {
    wave = forceStockTop(wave, suit, rank, wild)
    const result = drawStock(params, wave, items, TARGET, deckComposition, 'none')
    wave = result.wave
    deckComposition = result.deckComposition
    lastSnapshot = null
  }

  function onPaletteCardPointerDown(source: { suit: Suit; rank: Rank; wild: boolean }, e: PointerEvent) {
    e.preventDefault()
    dragState = {
      source,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      isDragging: false,
      pointerId: e.pointerId,
    }
  }

  function updateDropTarget(x: number, y: number) {
    const els = document.elementsFromPoint(x, y)
    for (const el of els) {
      const colEl = (el as HTMLElement).closest?.('[data-drop-col]') as HTMLElement | null
      if (colEl) {
        dropTarget = { col: Number(colEl.dataset.dropCol), row: Number(colEl.dataset.dropRow) }
        return
      }
      const stockEl = (el as HTMLElement).closest?.('[data-drop-stock]') as HTMLElement | null
      if (stockEl) {
        dropTarget = 'stockTop'
        return
      }
    }
    dropTarget = null
  }

  function applySwap(target: { col: number; row: number } | 'stockTop', source: { suit: Suit; rank: Rank; wild: boolean }) {
    if (target === 'stockTop') {
      if (wave.stock.length === 0) return
      const idx = wave.stock.length - 1
      const newCard: Card = { id: wave.stock[idx].id, deckId: wave.stock[idx].deckId, suit: source.suit, rank: source.rank, wild: source.wild }
      lastSnapshot = wave
      wave = { ...wave, stock: wave.stock.map((c, i) => (i === idx ? newCard : c)), lastGain: null }
    } else {
      const { col, row } = target
      const column = wave.tableau[col]
      if (!column?.[row]) return
      const newCard: Card = { id: column[row].id, deckId: column[row].deckId, suit: source.suit, rank: source.rank, wild: source.wild }
      lastSnapshot = wave
      wave = {
        ...wave,
        tableau: wave.tableau.map((c, ci) => (ci === col ? c.map((cc, ri) => (ri === row ? newCard : cc)) : c)),
        lastGain: null,
      }
    }
  }

  function unifySuit(suit: Suit) {
    lastSnapshot = wave
    wave = {
      ...wave,
      tableau: wave.tableau.map(col => col.map(c => (c.wild ? c : { ...c, suit }))),
      lastGain: null,
    }
  }

  function handleExecuteRite(riteId: RiteId) {
    lastSnapshot = wave
    wave = applyRiteEffect(params, wave, riteId, Math.random)
  }

  let pendingDebugRevelation = $state<RevelationId | null>(null)

  function handleExecuteRevelation(revelationId: RevelationId) {
    if (revelationNeedsTarget(revelationId)) {
      pendingDebugRevelation = revelationId
      return
    }
    lastSnapshot = wave
    const result = applyRevelationEffect(params, wave, deckComposition, revelationId, null, Math.random)
    wave = result.wave
    deckComposition = result.deckComposition
  }

  function handleTargetDebugColumn(colIndex: number) {
    if (!pendingDebugRevelation) return
    lastSnapshot = wave
    const result = applyRevelationEffect(params, wave, deckComposition, pendingDebugRevelation, colIndex, Math.random)
    wave = result.wave
    deckComposition = result.deckComposition
    pendingDebugRevelation = null
  }

  function canTargetDebugColumn(colIndex: number): boolean {
    if (!pendingDebugRevelation) return false
    if (pendingDebugRevelation === 'aya') return true
    return wave.tableau[colIndex].length > 0
  }

  function handleCancelDebugRevelationTarget() {
    pendingDebugRevelation = null
  }

  function stairifyTableau() {
    if (wave.tableau.length === 0 || wave.tableau[0].length === 0) return
    // 列優先: 列0を手前(末尾)→奥(先頭)、次に列1を手前→奥…の順に走査する
    const order: { ci: number; ri: number }[] = []
    wave.tableau.forEach((col, ci) => {
      for (let ri = col.length - 1; ri >= 0; ri--) order.push({ ci, ri })
    })
    const baseRank = wave.tableau[0][wave.tableau[0].length - 1].rank
    const newRanks = new Map<string, Rank>()
    order.forEach(({ ci, ri }, i) => {
      const rank = (((baseRank - 1 + i) % 13) + 1) as Rank
      newRanks.set(`${ci}-${ri}`, rank)
    })
    lastSnapshot = wave
    wave = {
      ...wave,
      tableau: wave.tableau.map((col, ci) => col.map((c, ri) => ({ ...c, rank: newRanks.get(`${ci}-${ri}`) as Rank }))),
      lastGain: null,
    }
  }

  function handleUndo() {
    if (!lastSnapshot) return
    wave = { ...lastSnapshot, lastGain: null }
    lastSnapshot = null
  }

  $effect(() => {
    try { localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(items)) } catch {}
  })

  onMount(() => {
    function onPointerMove(e: PointerEvent) {
      if (!dragState || e.pointerId !== dragState.pointerId) return
      const dx = e.clientX - dragState.startX
      const dy = e.clientY - dragState.startY
      const isDragging = dragState.isDragging || Math.sqrt(dx * dx + dy * dy) > 5
      dragState = { ...dragState, currentX: e.clientX, currentY: e.clientY, isDragging }
      if (isDragging) updateDropTarget(e.clientX, e.clientY)
    }
    function onPointerUp(e: PointerEvent) {
      if (!dragState || e.pointerId !== dragState.pointerId) return
      if (dragState.isDragging && dropTarget) {
        applySwap(dropTarget, dragState.source)
      }
      dragState = null
      dropTarget = null
    }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  })
</script>

{#snippet itemBadges()}
  {@const talismanFading = confiscateFadingTarget?.kind === 'talisman' ? confiscateFadingTarget : undefined}
  {@const displayedItemIds = [...new Set(talismanFading ? [...items.slice(0, Math.min(talismanFading.idx, items.length)), talismanFading.id, ...items.slice(Math.min(talismanFading.idx, items.length))] : items)]}
  <div class="flex-1 flex flex-wrap gap-1 justify-end">
    {#each displayedItemIds as id (id)}
      {@const n = items.filter(x => x === id).length}
      {@const talismanSealed = wave.activeSeal?.kind === 'talisman' && wave.activeSeal.id === id}
      {@const talismanFlashing = sealFlashTarget?.kind === 'talisman' && sealFlashTarget.id === id}
      {@const talismanConfiscateFading = talismanFading?.id === id && n === 0}
      <span
        class="text-xs rounded px-1.5 py-0.5 {highlightedItemId === id ? 'ring-2 ring-yellow-400' : ''} {talismanConfiscateFading ? 'shidasu-confiscate-fade' : ''} {talismanFlashing ? 'shidasu-seal-flash' : ''} {talismanSealed ? 'border' : 'bg-emerald-900 text-yellow-200/90 border border-yellow-600/40'}"
        style={talismanSealed ? 'background:#1c1917; color:#78350f; border-color: rgba(217,119,6,0.5); background-image: repeating-linear-gradient(45deg,transparent,transparent 5px,rgba(217,119,6,0.35) 5px,rgba(217,119,6,0.35) 6px);' : ''}
        title={talismanSealed ? '護符封印: 次の妨害発動まで効果が無効' : itemDesc(id, params)}
      >
        {itemName(id, params)}{n > 1 ? `×${n}` : ''}
      </span>
    {/each}
  </div>
{/snippet}

<svelte:head>
  <title>Shidasu デバッグサンドボックス</title>
</svelte:head>

<div class="bg-slate-50 px-4 py-4">
  <div class="flex items-center justify-between mb-3">
    <h1 class="text-lg font-bold text-slate-800">Shidasu デバッグサンドボックス</h1>
    <div class="flex items-center gap-2">
      <button type="button" onclick={stairifyTableau} class="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm font-bold">場札を階段にする</button>
      <button type="button" onclick={handleUndo} disabled={!lastSnapshot} class="px-3 py-1.5 rounded text-sm font-bold {lastSnapshot ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-400'}">元に戻す</button>
      <button type="button" onclick={newWave} class="px-3 py-1.5 rounded bg-teal-600 text-white text-sm font-bold">新しいウェーブ</button>
      <button type="button" onclick={resetDeck} class="px-3 py-1.5 rounded bg-rose-600 text-white text-sm font-bold">デッキリセット</button>
    </div>
  </div>

  <div class="overflow-x-auto">
    <div class="grid gap-4 items-start" style="grid-template-columns: minmax(420px, 1fr) minmax(480px, 1.4fr) minmax(260px, 0.8fr) minmax(260px, 0.8fr);">
      <CardPalette onCardPointerDown={onPaletteCardPointerDown} onUnifySuit={unifySuit} />
      <div class="bg-emerald-950 rounded-lg p-3 flex flex-col" style="max-height: 70vh;">
        <div class="p-2 border rounded space-y-1">
          <p class="text-xs text-slate-500">星の妨害行動を直接発動(デバッグ用)</p>
          <div class="flex flex-wrap gap-1">
            {#each SABOTAGE_POOL as def (def.id)}
              <button
                type="button"
                onclick={() => handleTriggerSabotage(def.id)}
                class="text-xs px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100"
              >{def.name}</button>
            {/each}
          </div>
        </div>
        <PlayArea
          {wave} {params} modifier={'none'} target={TARGET} {items} onPlayCard={handlePlayCard} onDraw={handleDraw} {dropTarget}
          waveKey={`wave-${waveGeneration}`}
          extraFooter={itemBadges}
          columnTargetMode={pendingDebugRevelation !== null}
          canTargetColumn={canTargetDebugColumn}
          onTargetColumn={handleTargetDebugColumn}
          onScorePartHighlight={id => (highlightedItemId = id)}
          onSealFlashChange={(target) => { sealFlashTarget = target }}
          onConfiscateFadingChange={(target) => { confiscateFadingTarget = target }}
        />
        <RoleStatusPanel {params} oracleLevels={oracleLevels} {sealedRoleEffect} {flashingRoles} />
        <div class="mt-4 flex-1 min-h-0 overflow-y-auto">
          <DebugStatePanel {wave} {items} onForceDraw={handleForceDraw} />
        </div>
      </div>
      <ItemChecklist {items} onToggle={handleToggleItem} onSetAll={handleSetAllItems} />
      <div class="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
        <RiteExecutePanel onExecute={handleExecuteRite} />
        <RevelationExecutePanel
          onExecute={handleExecuteRevelation}
          pendingRevelationId={pendingDebugRevelation}
          onCancelTarget={handleCancelDebugRevelationTarget}
        />
        <RoleStatusEditor {params} {oracleLevels} onSetLevel={handleSetOracleLevel} />
      </div>
    </div>
  </div>

  {#if dragState?.isDragging}
    <div class="fixed pointer-events-none z-50" style="left:{dragState.currentX - 32}px; top:{dragState.currentY - 48}px; width:64px;">
      <CardFace card={{ id: -1, deckId: -1, suit: dragState.source.suit, rank: dragState.source.rank, wild: dragState.source.wild }} covered={false} />
    </div>
  {/if}
</div>
