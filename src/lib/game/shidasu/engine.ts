// src/lib/game/shidasu/engine.ts
import type { Card, StageModifier, WaveState, ItemId, WaveEndReason, RunState, Suit, Rank, DeckCard, RoleName, BonusGain } from './types'
import type { ShidasuParams } from './params'
import { createRng, shuffle, shuffleInPlace, standardDeckComposition } from './deck'

const RANK_LABEL: Record<number, string> = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }

export function isRed(card: Card): boolean {
  return card.suit === '♥' || card.suit === '♦'
}

export function isFace(card: Card): boolean {
  return card.rank >= 11
}

export function rankLabel(card: Card): string {
  if (card.wild) return '★'
  return RANK_LABEL[card.rank] ?? String(card.rank)
}

export function isPlayable(modifier: StageModifier, wave: WaveState, card: Card): boolean {
  // faceLockはワイルド(場札含む)より優先して評価する: ワイルド場札でも絵札はコンボ不足なら拒否する
  if (modifier === 'faceLock' && isFace(card) && wave.combo < 2) return false
  if (card.wild || wave.foundation.wild) return true
  const d = Math.abs(card.rank - wave.foundation.rank)
  if (d === 1) return true
  if (d === 12 && modifier !== 'noLoop') return true
  return false
}

export function getPlayableColumns(modifier: StageModifier, wave: WaveState): Set<number> {
  const result = new Set<number>()
  wave.tableau.forEach((col, i) => {
    const top = col[col.length - 1]
    if (top && isPlayable(modifier, wave, top)) result.add(i)
  })
  return result
}

export function remainingCount(tableau: Card[][]): number {
  return tableau.reduce((n, c) => n + c.length, 0)
}

// デッキ構成のうち非ワイルドの1枚をランダムに選びワイルドへ変換した新しい配列を返す(候補が無ければそのまま返す)
function convertRandomCardToWild(composition: DeckCard[], rand: () => number): DeckCard[] {
  const candidates = composition.map((c, i) => i).filter(i => !composition[i].wild)
  if (candidates.length === 0) return composition
  const target = candidates[Math.floor(rand() * candidates.length)]
  return composition.map((c, i) => (i === target ? { ...c, wild: true } : c))
}

// 山札(末尾が次にめくられる位置)の中から、今のチェーンが継続できる最初のカードを探し、末尾と交換する。
// 候補が無ければ何もしない(元の配列をそのまま返す)。
function arrangeNextCardForContinuation(scoring: ShidasuParams['scoring'], stock: Card[], chain: Card[], stairMinLen: number): Card[] {
  if (stock.length === 0) return stock
  const lastIndex = stock.length - 1
  for (let i = 0; i <= lastIndex; i++) {
    if (chainContinuesPattern(scoring, chain, stock[i], stairMinLen)) {
      if (i === lastIndex) return stock
      const arranged = [...stock]
      ;[arranged[i], arranged[lastIndex]] = [arranged[lastIndex], arranged[i]]
      return arranged
    }
  }
  return stock
}

export function startWave(
  params: ShidasuParams,
  _stageIndex: number,
  _waveIndex: number,
  items: ItemId[],
  deckComposition: DeckCard[],
  seed?: number
): { wave: WaveState; deckComposition: DeckCard[] } {
  const rand = createRng(seed ?? Math.floor(Math.random() * 999999) + 1)
  let idSeq = 0
  const nextId = () => ++idSeq

  let composition = deckComposition
  if (items.includes('eternity')) {
    composition = [...composition, { suit: '★', rank: 0 as Rank, wild: true }]
  }
  if (items.includes('abundance')) {
    composition = convertRandomCardToWild(composition, rand)
  }

  const deck = shuffle(composition.map(c => ({ id: nextId(), ...c })), rand)
  const { cols } = params.layout
  const rows = params.layout.rows + (items.includes('darkClouds') ? params.talismans.darkClouds.r : 0)
  const tableau: Card[][] = []
  for (let c = 0; c < cols; c++) {
    tableau.push(deck.splice(0, rows))
  }
  const foundation = deck.pop() as Card
  const stockAfterDeal = items.includes('promise')
    ? arrangeNextCardForContinuation(params.scoring, deck, [foundation], params.scoring.stairMinLen)
    : deck

  const wave: WaveState = {
    tableau,
    stock: stockAfterDeal,
    foundation,
    score: 0,
    combo: 0,
    chain: [foundation],
    chainOrigin: ['draw'],
    linked: false,
    columnsEmptiedThisCombo: 0,
    comboStreakColumnLengths: tableau.map(col => col.length),
    lastDrawEffect: null,
    status: 'playing',
    endReason: null as WaveEndReason,
    lastGain: null,
    lastBonusGains: [],
    firstPlayDone: false,
    discardPile: [],
    lastPlayedColumn: null,
    sameColumnStreak: 0,
    maxComboThisWave: 0,
    totalColumnsEmptiedThisWave: 0,
    roleFiredThisChain: false,
    drawContinueCountThisChain: 0,
    flushActiveThisCombo: false,
    columnSweepActiveThisWave: false,
    benevolenceUsedThisCombo: false,
    baseComboCount: 0,
    roleEchoUsedThisCombo: {},
    sameRankEchoUsedThisCombo: [],
    pendingRoleEcho: null,
    roleOccurrenceCountThisWave: {},
    mercyActiveNextCombo: false,
  }

  return { wave, deckComposition: composition }
}

export function playCard(
  params: ShidasuParams,
  wave: WaveState,
  modifier: StageModifier,
  items: ItemId[],
  target: number,
  colIndex: number,
  rand: () => number = Math.random
): WaveState {
  if (wave.status !== 'playing') return wave
  const col = wave.tableau[colIndex]
  const card = col?.[col.length - 1]
  if (!card) return wave
  if (!isPlayable(modifier, wave, card)) return wave

  // 黄金: 通常のコンボ加算処理そのものを+1ではなく+2にする(他の護符には無干渉)
  const newCombo = wave.combo + (items.includes('golden') ? 2 : 1)
  let base = params.scoring.basePoint
  const parts = [`基礎点+${base}`]

  // 水鏡: 前のプレイで予約された役ボーナスの遅延複製を無条件で上乗せする
  if (items.includes('mirror') && wave.pendingRoleEcho) {
    base += wave.pendingRoleEcho.amount
    parts.push(`水鏡(${wave.pendingRoleEcho.name})+${wave.pendingRoleEcho.amount}`)
  }

  const effectiveStairMinLen = items.includes('bridge') ? params.items.stairRelaxedMinLen : params.scoring.stairMinLen
  // 明星: 役の種類ごとのウェーブ内累積成立回数(今回成立分は含まない)に応じて役ボーナス額を倍率適用する
  const roleBonusMultiplier = (name: RoleName): number => {
    if (!items.includes('morningStar')) return 1
    const count = wave.roleOccurrenceCountThisWave[name] ?? 0
    return 1 + count * params.talismans.morningStar.x
  }
  const chainResult = evaluateChainBonus(params.scoring, wave.chain, card, effectiveStairMinLen, roleBonusMultiplier)
  base += chainResult.bonus
  parts.push(...chainResult.parts)

  const chainIncludingThis = [...wave.chain, card]

  const newTableau = wave.tableau.map((c, i) => (i === colIndex ? c.slice(0, -1) : c))
  const columnJustEmptied = newTableau[colIndex].length === 0
  const streakStartLength = wave.comboStreakColumnLengths[colIndex]
  const rows = params.layout.rows
  const sweepQualifies = columnJustEmptied && (
    items.includes('grace')
      ? streakStartLength <= rows - params.items.columnSweepRelaxCards
      : streakStartLength === rows
  )
  const newColumnsEmptied = sweepQualifies ? wave.columnsEmptiedThisCombo + 1 : wave.columnsEmptiedThisCombo
  const roleFired = [...chainResult.roleFired]
  if (sweepQualifies) {
    const sweepGain = Math.floor(params.scoring.columnSweepBonus * newColumnsEmptied * roleBonusMultiplier('columnSweep'))
    base += sweepGain
    parts.push(`列一掃+${sweepGain}`)
    roleFired.push({ name: 'columnSweep', usedWild: false, amount: sweepGain })
  }

  // 水鏡: 今回成立した役のうち、まだ今コンボで遅延複製を予約していないものを1つだけ、次のプレイへ予約する。
  // 優先順位はroleFiredの出現順(flush→royalSet→sameRank→completeRun→columnSweepの判定順)。
  let newPendingRoleEcho: WaveState['pendingRoleEcho'] = null
  let newRoleEchoUsedThisCombo = wave.roleEchoUsedThisCombo
  let newSameRankEchoUsedThisCombo = wave.sameRankEchoUsedThisCombo
  if (items.includes('mirror')) {
    for (const fired of roleFired) {
      if (fired.name === 'sameRank') {
        // sameRankは枚数段階(sameRankCount)ごとに個別カウントする必要があるため、
        // evaluateChainBonus内部と同じ関数で再計算する(既存のエクスポート済みヘルパーを再利用)。
        const sameRankCount = card.wild ? countSameRankForWildPlay(wave.chain) : countSameRankBefore(wave.chain, card.rank)
        if (!wave.sameRankEchoUsedThisCombo.includes(sameRankCount)) {
          newPendingRoleEcho = { name: 'sameRank', amount: fired.amount }
          newSameRankEchoUsedThisCombo = [...wave.sameRankEchoUsedThisCombo, sameRankCount]
          break
        }
      } else if (!wave.roleEchoUsedThisCombo[fired.name]) {
        newPendingRoleEcho = { name: fired.name, amount: fired.amount }
        newRoleEchoUsedThisCombo = { ...wave.roleEchoUsedThisCombo, [fired.name]: true }
        break
      }
    }
  }

  // 護符は所持順(itemsの並び順)で解決するのが大原則。治癒(復活対象=一掃した列)と
  // 再生(復活対象=場札全体)は、解決時に自分の復活対象が既に空でなければ発動しない。
  // 通常は独立して発動するが、最後の列を空にする一手が列一掃と全消しを同時に満たす場合のみ
  // 両者の対象が重なるため、所持順で先にある方から順に解決する。
  const remainingBeforeRevival = remainingCount(newTableau)
  const healingIndex = items.indexOf('healing')
  const regenerationIndex = items.indexOf('regeneration')
  const overlapWithHealingFirst = sweepQualifies && remainingBeforeRevival === 0
    && items.includes('healing') && items.includes('regeneration')
    && healingIndex !== -1 && regenerationIndex !== -1 && healingIndex < regenerationIndex

  // workingXxx: 再生の解決を経た状態(再生が発動しなければnewTableau等のまま)。
  let workingTableau = newTableau
  let workingDiscardPile = wave.discardPile
  let workingComboStreakColumnLengths = wave.comboStreakColumnLengths
  let regenerationRevivedNow = false

  // 再生: 重複時に治癒が所持順で先でない限り、全消し(復活対象=場札全体が空)なら先に解決する。
  const regenerationShouldAttempt = remainingBeforeRevival === 0 && items.includes('regeneration') && !overlapWithHealingFirst
  if (regenerationShouldAttempt && workingDiscardPile.length > 0) {
    const pool = [...workingDiscardPile]
    shuffleInPlace(pool, rand)
    const reviveTotal = Math.min(params.layout.cols * rows, pool.length)
    let cursor = 0
    const revivedTableau: Card[][] = []
    for (let c = 0; c < params.layout.cols; c++) {
      const take = Math.min(rows, reviveTotal - cursor)
      revivedTableau.push(take > 0 ? pool.slice(cursor, cursor + take) : [])
      cursor += Math.max(take, 0)
    }
    workingTableau = revivedTableau
    workingDiscardPile = pool.slice(reviveTotal)
    workingComboStreakColumnLengths = revivedTableau.map(col => col.length)
    regenerationRevivedNow = true
  }

  // 治癒: 復活対象(一掃した列)が、再生の再配布後も含めてまだ空であれば発動する。
  // (現在の再配布ループは「捨て札を使い切るか、全列をrows枚まで満たすか」のいずれかで
  // 終わるため、対象列だけ空のまま捨て札が残るケースは実際には発生しない。将来、再配布の
  // アルゴリズムが変わった場合に備えた安全側のチェックとして残している。)
  // healedXxx: 治癒の解決まで経た最終状態。next(戻り値)はこれを使う。
  let healedTableau = workingTableau
  let healedDiscardPile = workingDiscardPile
  let healedComboStreakColumnLengths = workingComboStreakColumnLengths
  if (sweepQualifies && items.includes('healing') && workingTableau[colIndex].length === 0 && workingDiscardPile.length > 0) {
    const pool = [...workingDiscardPile]
    shuffleInPlace(pool, rand)
    const reviveCount = Math.min(rows, pool.length)
    const revived = pool.slice(0, reviveCount)
    healedDiscardPile = pool.slice(reviveCount)
    healedTableau = workingTableau.map((c, i) => (i === colIndex ? revived : c))
    // 復活後の列は実際の枚数(revived.length)を新たな基準長として記録する。
    // 据え置いたままだと、山札切れ前の基準(rows)と比較され続け、
    // 一部しか復活しなかった列でも列一掃条件を満たしてしまう。
    healedComboStreakColumnLengths = workingComboStreakColumnLengths.map((len, i) => (i === colIndex ? revived.length : len))
  }
  const remaining = remainingCount(healedTableau)

  const newSameColumnStreak = wave.lastPlayedColumn === colIndex ? wave.sameColumnStreak + 1 : 1
  const newMaxComboThisWave = Math.max(wave.maxComboThisWave, newCombo)
  const newTotalColumnsEmptiedThisWave = wave.totalColumnsEmptiedThisWave + (sweepQualifies ? 1 : 0)
  const newColumnSweepActiveThisWave = wave.columnSweepActiveThisWave || sweepQualifies
  const newRoleFiredThisChain = wave.roleFiredThisChain || roleFired.length > 0
  const newFlushActiveThisCombo = wave.flushActiveThisCombo || roleFired.some(r => r.name === 'flush')

  // 庇護・大地・祝福: 所持順(itemsの並び順)で一時comboに順に適用する。wave.combo(実コンボ)自体は変化しない。
  let effectiveCombo = newCombo
  for (const id of items) {
    if (id === 'protection' && effectiveCombo < params.talismans.protection.c) {
      effectiveCombo = params.talismans.protection.c
    } else if (id === 'earth') {
      effectiveCombo += params.talismans.earth.c
    } else if (id === 'sanctify' && roleFired.length > 0) {
      effectiveCombo += 1
    }
  }
  const newBaseComboCount = items.includes('sanctify') && roleFired.length > 0 ? wave.baseComboCount + 1 : wave.baseComboCount

  // 明星: 今回成立した役の種類ごとに、ウェーブ内累積成立回数を+1する(今回分は次回以降に反映)
  let newRoleOccurrenceCountThisWave = wave.roleOccurrenceCountThisWave
  if (roleFired.length > 0) {
    newRoleOccurrenceCountThisWave = { ...wave.roleOccurrenceCountThisWave }
    for (const fired of roleFired) {
      newRoleOccurrenceCountThisWave[fired.name] = (newRoleOccurrenceCountThisWave[fired.name] ?? 0) + 1
    }
  }

  const itemEffectCtx: ItemEffectContext = {
    card,
    previousFoundation: wave.foundation,
    combo: effectiveCombo,
    stockRemaining: wave.stock.length,
    chain: chainIncludingThis,
    remainingTableauCount: remaining,
    chainBonus: { ...chainResult, roleFired },
    isFirstPlayOfWave: !wave.firstPlayDone,
    effectiveStairMinLen,
    sameColumnStreak: newSameColumnStreak,
    totalColumnsEmptiedThisWave: newTotalColumnsEmptiedThisWave,
    maxComboThisWave: newMaxComboThisWave,
    flushActiveThisCombo: newFlushActiveThisCombo,
    columnSweepActiveThisWave: newColumnSweepActiveThisWave,
    drawContinueCountThisChain: wave.drawContinueCountThisChain,
    mercyActiveNextCombo: wave.mercyActiveNextCombo,
  }

  const comboMultiplierStep = params.scoring.comboMultiplierStep
  const multiplier = 1 + (effectiveCombo - 1) * comboMultiplierStep
  if (multiplier !== 1) parts.push(`コンボ倍率×${fmtMultiplier(multiplier)}`)
  const rawGained = Math.floor(base * multiplier)
  const itemResult = applyItemEffects('gained', rawGained, items, itemEffectCtx, params)
  parts.push(...itemResult.parts)
  let gained = Math.floor(itemResult.value)

  const milestoneCtx: DirectEffectContext = {
    comboBeforeReset: 0,
    hasPlayableColumns: true,
    roleFiredThisChain: newRoleFiredThisChain,
    remainingTableauCount: remaining,
    combo: newCombo,
    colorHeld: false,
  }
  const milestoneResult = applyDirectEffects('comboMilestoneDirect', items, milestoneCtx, params)

  const newScore = wave.score + gained + milestoneResult.value

  const bonusGains: BonusGain[] = []
  if (milestoneResult.parts.length > 0) {
    bonusGains.push({ label: '護符による直接加算', points: milestoneResult.value, parts: milestoneResult.parts })
  }

  const next: WaveState = {
    ...wave,
    tableau: healedTableau,
    discardPile: healedDiscardPile,
    foundation: card,
    combo: newCombo,
    chain: [...wave.chain, card],
    chainOrigin: [...wave.chainOrigin, 'play'],
    linked: true,
    columnsEmptiedThisCombo: newColumnsEmptied,
    // コンボが継続する間はこのスナップショットを維持する。列の残り枚数が変化しても、
    // 次にdrawStockでコンボがリセットされるまでは更新しない(治癒で復活した列のみ例外)。
    comboStreakColumnLengths: healedComboStreakColumnLengths,
    lastDrawEffect: null,
    score: newScore,
    lastGain: { points: gained, parts },
    status: 'playing',
    endReason: null,
    firstPlayDone: true,
    lastPlayedColumn: colIndex,
    sameColumnStreak: newSameColumnStreak,
    maxComboThisWave: newMaxComboThisWave,
    totalColumnsEmptiedThisWave: newTotalColumnsEmptiedThisWave,
    roleFiredThisChain: newRoleFiredThisChain,
    flushActiveThisCombo: newFlushActiveThisCombo,
    columnSweepActiveThisWave: newColumnSweepActiveThisWave,
    baseComboCount: newBaseComboCount,
    roleOccurrenceCountThisWave: newRoleOccurrenceCountThisWave,
    pendingRoleEcho: newPendingRoleEcho,
    roleEchoUsedThisCombo: newRoleEchoUsedThisCombo,
    sameRankEchoUsedThisCombo: newSameRankEchoUsedThisCombo,
    lastBonusGains: bonusGains,
  }

  if (remainingBeforeRevival === 0) {
    const rawClearBonus = params.scoring.clearBonus + wave.stock.length * params.scoring.clearBonusPerStock
    const clearBonusResult = applyItemEffects('clearBonus', rawClearBonus, items, itemEffectCtx, params)
    const clearBonus = Math.floor(clearBonusResult.value)
    const scoreAfterClear = newScore + clearBonus
    const clearBonusGain: BonusGain = {
      label: '全消しボーナス',
      points: clearBonus,
      parts: [
        `基礎+${params.scoring.clearBonus}`,
        `山札残数+${wave.stock.length * params.scoring.clearBonusPerStock}`,
        ...clearBonusResult.parts,
      ],
    }
    const bonusGainsWithClear = [...bonusGains, clearBonusGain]

    if (regenerationRevivedNow) {
      // 再配布そのものは上で(治癒より先に)実行済み。ここではコスト計算とスコア反映のみ行う。
      const cost = Math.floor(scoreAfterClear * params.talismans.regeneration.p / 100)
      return { ...next, score: scoreAfterClear - cost, lastBonusGains: bonusGainsWithClear, status: 'playing', endReason: null }
    }

    if (remaining === 0) {
      // 治癒・再生いずれも介入しなかった(通常の全消し)
      return { ...next, score: scoreAfterClear, lastBonusGains: bonusGainsWithClear, status: 'ended', endReason: 'fullClear' }
    }
    // 治癒が介入して場が復活した場合は全消しにならず、全消しボーナスも付与しない。
    // 通常のプレイ続行として下のフローへ進む。
  }

  if (newScore >= target) {
    return { ...next, status: 'ended', endReason: 'target' }
  }

  return next
}

export function drawStock(
  params: ShidasuParams,
  wave: WaveState,
  items: ItemId[],
  deckComposition: DeckCard[],
  modifier: StageModifier = 'none',
  rand: () => number = Math.random
): { wave: WaveState; deckComposition: DeckCard[] } {
  if (wave.status !== 'playing') return { wave, deckComposition }
  if (wave.stock.length === 0) return { wave, deckComposition }

  const newStock = [...wave.stock]
  const drawnCard = newStock.pop() as Card

  const effectiveStairMinLen = items.includes('bridge') ? params.items.stairRelaxedMinLen : params.scoring.stairMinLen
  const wouldContinue = wave.linked && chainContinuesPattern(params.scoring, wave.chain, drawnCard, effectiveStairMinLen)
  const benevolenceFires = !wouldContinue && items.includes('benevolence') && !wave.benevolenceUsedThisCombo
  const patternContinues = wouldContinue || benevolenceFires

  let scoreAfterStockEmpty = wave.score
  let stockEmptyResult: { value: number; parts: string[] } = { value: 0, parts: [] }
  if (newStock.length === 0) {
    const stockEmptyCtx: DirectEffectContext = {
      comboBeforeReset: 0,
      hasPlayableColumns: true,
      roleFiredThisChain: false,
      remainingTableauCount: remainingCount(wave.tableau),
      combo: wave.combo,
      colorHeld: false,
    }
    stockEmptyResult = applyDirectEffects('stockEmptyDirect', items, stockEmptyCtx, params)
    scoreAfterStockEmpty += stockEmptyResult.value
  }

  if (patternContinues) {
    const { colorHeld, suitHeld } = analyzeSuitColor([...wave.chain, drawnCard])
    const drawContinueCtx: DirectEffectContext = {
      comboBeforeReset: 0,
      hasPlayableColumns: true,
      roleFiredThisChain: false,
      remainingTableauCount: remainingCount(wave.tableau),
      combo: wave.combo,
      colorHeld: colorHeld && !suitHeld,
    }
    // 誠実(drawContinueDirect)はwouldContinue(実際のパターン継続)でのみ発火する。
    // benevolenceFiresによる継続扱いは「本来リセットするところの救済」であり、
    // パターン継続そのものの報酬である誠実の対象にはしない。
    const drawContinueResult = wouldContinue
      ? applyDirectEffects('drawContinueDirect', items, drawContinueCtx, params)
      : { value: 0, parts: [] }
    const directGain = drawContinueResult.value
    const newDrawContinueCount = wouldContinue ? wave.drawContinueCountThisChain + 1 : wave.drawContinueCountThisChain

    let naiveGained = 0
    let naiveParts: string[] = []
    let naiveCombo = wave.combo
    let naiveRoleFiredThisChain = wave.roleFiredThisChain
    let naiveFlushActiveThisCombo = wave.flushActiveThisCombo
    if (wouldContinue && items.includes('naive')) {
      const newCombo = wave.combo + (items.includes('golden') ? 2 : 1)
      let base = params.scoring.basePoint
      const parts = [`基礎点+${base}`]
      const chainResult = evaluateChainBonus(params.scoring, wave.chain, drawnCard, effectiveStairMinLen)
      base += chainResult.bonus
      parts.push(...chainResult.parts)
      naiveRoleFiredThisChain = wave.roleFiredThisChain || chainResult.roleFired.length > 0
      naiveFlushActiveThisCombo = wave.flushActiveThisCombo || chainResult.roleFired.some(r => r.name === 'flush')
      let effectiveCombo = newCombo
      for (const id of items) {
        if (id === 'protection' && effectiveCombo < params.talismans.protection.c) {
          effectiveCombo = params.talismans.protection.c
        } else if (id === 'earth') {
          effectiveCombo += params.talismans.earth.c
        }
      }

      const naiveCtx: ItemEffectContext = {
        card: drawnCard,
        previousFoundation: wave.foundation,
        combo: effectiveCombo,
        stockRemaining: newStock.length,
        chain: [...wave.chain, drawnCard],
        remainingTableauCount: remainingCount(wave.tableau),
        chainBonus: chainResult,
        isFirstPlayOfWave: !wave.firstPlayDone,
        effectiveStairMinLen,
        sameColumnStreak: wave.sameColumnStreak,
        totalColumnsEmptiedThisWave: wave.totalColumnsEmptiedThisWave,
        maxComboThisWave: Math.max(wave.maxComboThisWave, newCombo),
        flushActiveThisCombo: naiveFlushActiveThisCombo,
        columnSweepActiveThisWave: wave.columnSweepActiveThisWave,
        drawContinueCountThisChain: newDrawContinueCount,
        mercyActiveNextCombo: wave.mercyActiveNextCombo,
      }
      const comboMultiplierStep = params.scoring.comboMultiplierStep
      const multiplier = 1 + (effectiveCombo - 1) * comboMultiplierStep
      if (multiplier !== 1) parts.push(`コンボ倍率×${fmtMultiplier(multiplier)}`)
      const rawGained = Math.floor(base * multiplier)
      const itemResult = applyItemEffects('gained', rawGained, items, naiveCtx, params)
      parts.push(...itemResult.parts)
      naiveGained = Math.floor(itemResult.value)
      naiveParts = parts
      naiveCombo = newCombo
    }

    const patternContinueBonusGains: BonusGain[] = []
    if (stockEmptyResult.parts.length > 0) {
      patternContinueBonusGains.push({ label: '護符による直接加算', points: stockEmptyResult.value, parts: stockEmptyResult.parts })
    }
    if (drawContinueResult.parts.length > 0) {
      patternContinueBonusGains.push({ label: '護符による直接加算', points: drawContinueResult.value, parts: drawContinueResult.parts })
    }

    return {
      wave: {
        ...wave,
        stock: items.includes('promise') ? arrangeNextCardForContinuation(params.scoring, newStock, [...wave.chain, drawnCard], effectiveStairMinLen) : newStock,
        foundation: drawnCard,
        combo: naiveCombo,
        chain: [...wave.chain, drawnCard],
        chainOrigin: [...wave.chainOrigin, 'draw'],
        linked: true,
        lastDrawEffect: drawnCard.wild ? 'wild' : 'pattern',
        lastGain: naiveGained > 0 ? { points: naiveGained, parts: naiveParts } : null,
        score: scoreAfterStockEmpty + directGain + naiveGained,
        drawContinueCountThisChain: newDrawContinueCount,
        benevolenceUsedThisCombo: benevolenceFires ? true : wave.benevolenceUsedThisCombo,
        maxComboThisWave: Math.max(wave.maxComboThisWave, naiveCombo),
        roleFiredThisChain: naiveRoleFiredThisChain,
        flushActiveThisCombo: naiveFlushActiveThisCombo,
        lastBonusGains: patternContinueBonusGains,
      },
      deckComposition,
    }
  }

  // combo: 0 を明示するのは、faceLock(絵札はコンボ2以上でのみ取得可)を正しく評価するため。
  // ここはリセット後の状態を先読みして判定しており、実際にリセットが起きた後のcomboは常に0になる。
  const hasPlayableColumns = getPlayableColumns(modifier, { ...wave, foundation: drawnCard, combo: 0 }).size > 0
  const silenceFires = !hasPlayableColumns && items.includes('silence')
  const card = silenceFires ? { ...drawnCard, wild: true } : drawnCard
  const newDeckComposition = silenceFires ? convertRandomCardToWild(deckComposition, rand) : deckComposition

  const resetCtx: DirectEffectContext = {
    comboBeforeReset: wave.combo,
    hasPlayableColumns,
    roleFiredThisChain: wave.roleFiredThisChain,
    remainingTableauCount: remainingCount(wave.tableau),
    combo: wave.combo,
    colorHeld: false,
  }
  const resetResult = applyDirectEffects('resetDirect', items, resetCtx, params)
  const resetDirectGain = resetResult.value

  const resetBonusGains: BonusGain[] = []
  if (stockEmptyResult.parts.length > 0) {
    resetBonusGains.push({ label: '護符による直接加算', points: stockEmptyResult.value, parts: stockEmptyResult.parts })
  }
  if (resetResult.parts.length > 0) {
    resetBonusGains.push({ label: '護符による直接加算', points: resetDirectGain, parts: resetResult.parts })
  }

  return {
    wave: {
      ...wave,
      stock: items.includes('promise') ? arrangeNextCardForContinuation(params.scoring, newStock, [card], effectiveStairMinLen) : newStock,
      foundation: card,
      combo: items.includes('sanctify') ? wave.baseComboCount : 0,
      chain: [card],
      chainOrigin: ['draw'],
      linked: false,
      columnsEmptiedThisCombo: 0,
      comboStreakColumnLengths: wave.tableau.map(col => col.length),
      lastDrawEffect: null,
      lastGain: null,
      discardPile: [...wave.discardPile, ...wave.chain],
      score: scoreAfterStockEmpty + resetDirectGain,
      roleFiredThisChain: false,
      drawContinueCountThisChain: 0,
      flushActiveThisCombo: false,
      sameColumnStreak: 0,
      lastPlayedColumn: null,
      benevolenceUsedThisCombo: false,
      roleEchoUsedThisCombo: {},
      sameRankEchoUsedThisCombo: [],
      pendingRoleEcho: null,
      mercyActiveNextCombo: wave.combo <= params.talismans.mercy.c,
      lastBonusGains: resetBonusGains,
    },
    deckComposition: newDeckComposition,
  }
}

export function isStuck(modifier: StageModifier, wave: WaveState): boolean {
  const remaining = remainingCount(wave.tableau)
  if (remaining === 0) return false
  if (wave.stock.length > 0) return false
  return getPlayableColumns(modifier, wave).size === 0
}

export function markStuck(wave: WaveState): WaveState {
  if (wave.status !== 'playing') return wave
  return { ...wave, status: 'ended', endReason: 'stuck' }
}

export interface ItemEffectContext {
  card: Card
  previousFoundation: Card
  combo: number
  stockRemaining: number
  // 今回プレイしたカード(card)を含むチェーン全体(chainBefore + card)
  chain: Card[]
  // このプレイ後の場札総残数
  remainingTableauCount: number
  // このプレイで成立したパターン/役ボーナスの内訳(evaluateChainBonusの戻り値。列一掃も合流済み)
  chainBonus: ChainBonusResult
  // このプレイがウェーブ開始後の最初のプレイかどうか(山札めくりでは変化しない)
  isFirstPlayOfWave: boolean
  // 護符(架橋等)による緩和を反映した、現在有効な階段成立の最小連続枚数
  effectiveStairMinLen: number
  // 微風・共鳴用: このプレイ後の同一列連続回数
  sameColumnStreak: number
  // 蒼穹用: このプレイ後のウェーブ内列一掃累計回数
  totalColumnsEmptiedThisWave: number
  // 琥珀用: このプレイ後のウェーブ内最大到達コンボ数
  maxComboThisWave: number
  // 情熱用: このプレイ後、現在のコンボ中にフラッシュが成立しているか
  flushActiveThisCombo: boolean
  // 闘志用: このプレイ後、このウェーブ中に列一掃が発生しているか
  columnSweepActiveThisWave: boolean
  // 直感用: 現在のチェーン中に山札めくりでコンボ継続した回数
  drawContinueCountThisChain: number
  // 慈悲用: 次のコンボの間、倍率xを適用中か
  mercyActiveNextCombo: boolean
}

// 護符の内訳表示用に倍率を丸めて整形する(浮動小数の誤差で末尾が長くなるのを防ぐ)
function fmtMultiplier(n: number): string {
  return String(Math.round(n * 100) / 100)
}

type ItemEffect = (value: number, ctx: ItemEffectContext, params: ShidasuParams) => { value: number; part: string | null }

function chainHasNoFace(chain: Card[]): boolean {
  return chain.every(c => c.wild || !isFace(c))
}
function chainIsFaceOnly(chain: Card[]): boolean {
  return chain.every(c => c.wild || isFace(c))
}

function chainSuitExclusive(chain: Card[], suit: Suit): boolean {
  return chain.every(c => c.wild || c.suit === suit)
}

function chainColorExclusive(chain: Card[], red: boolean): boolean {
  return chain.every(c => c.wild || isRed(c) === red)
}

function countSuitInChain(chain: Card[], suit: Suit): number {
  const real = chain.filter(c => !c.wild && c.suit === suit).length
  const wild = chain.filter(c => c.wild).length
  return real + wild
}

function countRankInChain(chain: Card[], rank: Card['rank']): number {
  const real = chain.filter(c => !c.wild && c.rank === rank).length
  const wild = chain.filter(c => c.wild).length
  return real + wild
}

// 赤黒の差(diff)をワイルドで埋めて同数にできるかを判定する。
// ワイルドをwildToRed/wildToBlackに振り分けてrealRed+wildToRed = realBlack+wildToBlackを
// 満たすには、wildToRed-wildToBlack = diffかつwildToRed+wildToBlack = wildCountを共に
// 満たす非負整数解が要る。これはdiff<=wildCountに加えて、両者の差(wildCount-diff)が
// 偶数である場合のみ整数解になる(そうでなければワイルドを半端に割ることになり不可能)。
// (wildCount-diff)の偶奇は合計枚数(realRed+realBlack+wildCount)の偶奇と一致するため、
// 後者で判定する。
function redBlackBalanced(chain: Card[]): boolean {
  const realRed = chain.filter(c => !c.wild && isRed(c)).length
  const realBlack = chain.filter(c => !c.wild && !isRed(c)).length
  const wildCount = chain.filter(c => c.wild).length
  const diff = Math.abs(realRed - realBlack)
  const totalIsEven = (realRed + realBlack + wildCount) % 2 === 0
  return diff <= wildCount && totalIsEven
}

const ITEM_EFFECTS: Partial<Record<ItemId, { channel: 'gained' | 'clearBonus'; effect: ItemEffect }>> = {
  patience: {
    channel: 'clearBonus',
    effect: (v, ctx, p) => {
      const add = ctx.stockRemaining * p.talismans.patience.x
      return { value: v + add, part: `忍耐+${add}` }
    },
  },
  purify: {
    channel: 'clearBonus',
    effect: (v, _ctx, p) => ({ value: v + p.talismans.purify.n, part: `浄化+${p.talismans.purify.n}` }),
  },
  temperance: {
    channel: 'clearBonus',
    effect: (v, ctx, p) => {
      const factor = 1 + ctx.stockRemaining * p.talismans.temperance.x
      return { value: v * factor, part: `節制×${fmtMultiplier(factor)}` }
    },
  },
  springBreeze: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.card.suit === '♣'
        ? { value: v + p.talismans.springBreeze.n, part: `春風+${p.talismans.springBreeze.n}` }
        : { value: v, part: null },
  },
  summerBreeze: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.card.suit === '♦'
        ? { value: v + p.talismans.summerBreeze.n, part: `夏風+${p.talismans.summerBreeze.n}` }
        : { value: v, part: null },
  },
  autumnBreeze: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.card.suit === '♥'
        ? { value: v + p.talismans.autumnBreeze.n, part: `秋風+${p.talismans.autumnBreeze.n}` }
        : { value: v, part: null },
  },
  winterBreeze: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.card.suit === '♠'
        ? { value: v + p.talismans.winterBreeze.n, part: `冬風+${p.talismans.winterBreeze.n}` }
        : { value: v, part: null },
  },
  kinship: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.card.suit === '♥' && ctx.previousFoundation.suit !== '♥'
        ? { value: v + p.talismans.kinship.n, part: `友愛+${p.talismans.kinship.n}` }
        : { value: v, part: null },
  },
  thaw: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.previousFoundation.suit === '♠' && ctx.card.suit !== '♠'
        ? { value: v + p.talismans.thaw.n, part: `雪解+${p.talismans.thaw.n}` }
        : { value: v, part: null },
  },
  dusk: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      isRed(ctx.previousFoundation) && !isRed(ctx.card)
        ? { value: v + p.talismans.dusk.n, part: `宵闇+${p.talismans.dusk.n}` }
        : { value: v, part: null },
  },
  dawn: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      !isRed(ctx.previousFoundation) && isRed(ctx.card)
        ? { value: v + p.talismans.dawn.n, part: `払暁+${p.talismans.dawn.n}` }
        : { value: v, part: null },
  },
  wit: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.card.wild ? { value: v + p.talismans.wit.n, part: `機知+${p.talismans.wit.n}` } : { value: v, part: null },
  },
  courage: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const factor = 1 + ctx.combo * p.talismans.courage.x
      return { value: v * factor, part: `勇気×${fmtMultiplier(factor)}` }
    },
  },
  daybreak: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.combo <= p.talismans.daybreak.c
        ? { value: v * p.talismans.daybreak.x, part: `暁×${fmtMultiplier(p.talismans.daybreak.x)}` }
        : { value: v, part: null },
  },
  twilight: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.combo >= p.talismans.twilight.c
        ? { value: v * p.talismans.twilight.x, part: `黄昏×${fmtMultiplier(p.talismans.twilight.x)}` }
        : { value: v, part: null },
  },
  cheerful: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.combo % 2 === 0
        ? { value: v + p.talismans.cheerful.n, part: `快活+${p.talismans.cheerful.n}` }
        : { value: v, part: null },
  },
  conscience: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.combo % 2 !== 0
        ? { value: v + p.talismans.conscience.n, part: `良心+${p.talismans.conscience.n}` }
        : { value: v, part: null },
  },
  morningMist: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const factor = ctx.combo < p.talismans.morningMist.c ? 1 / p.talismans.morningMist.x : p.talismans.morningMist.x
      return { value: v * factor, part: `朝霧×${fmtMultiplier(factor)}` }
    },
  },
  calm: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      chainHasNoFace(ctx.chain) ? { value: v + p.talismans.calm.n, part: `平穏+${p.talismans.calm.n}` } : { value: v, part: null },
  },
  serenity: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!chainHasNoFace(ctx.chain)) return { value: v, part: null }
      const factor = p.talismans.serenity.x
      return { value: v * factor, part: `安寧×${fmtMultiplier(factor)}` }
    },
  },
  destiny: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      chainIsFaceOnly(ctx.chain) ? { value: v + p.talismans.destiny.n, part: `運命+${p.talismans.destiny.n}` } : { value: v, part: null },
  },
  fate: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!chainIsFaceOnly(ctx.chain)) return { value: v, part: null }
      const factor = p.talismans.fate.x
      return { value: v * factor, part: `宿命×${fmtMultiplier(factor)}` }
    },
  },
  relief: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.card.wild || (ctx.card.rank >= 1 && ctx.card.rank <= 10)
        ? { value: v + p.talismans.relief.n, part: `安堵+${p.talismans.relief.n}` }
        : { value: v, part: null },
  },
  verdantGreen: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!chainSuitExclusive(ctx.chain, '♣')) return { value: v, part: null }
      const factor = p.talismans.verdantGreen.x
      return { value: v * factor, part: `深緑×${fmtMultiplier(factor)}` }
    },
  },
  gem: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!chainSuitExclusive(ctx.chain, '♦')) return { value: v, part: null }
      const factor = p.talismans.gem.x
      return { value: v * factor, part: `宝石×${fmtMultiplier(factor)}` }
    },
  },
  resolve: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!chainSuitExclusive(ctx.chain, '♠')) return { value: v, part: null }
      const factor = p.talismans.resolve.x
      return { value: v * factor, part: `真剣×${fmtMultiplier(factor)}` }
    },
  },
  grail: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!chainSuitExclusive(ctx.chain, '♥')) return { value: v, part: null }
      const factor = p.talismans.grail.x
      return { value: v * factor, part: `聖杯×${fmtMultiplier(factor)}` }
    },
  },
  moonlight: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!chainColorExclusive(ctx.chain, false)) return { value: v, part: null }
      const factor = p.talismans.moonlight.x
      return { value: v * factor, part: `月光×${fmtMultiplier(factor)}` }
    },
  },
  sunlight: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!chainColorExclusive(ctx.chain, true)) return { value: v, part: null }
      const factor = p.talismans.sunlight.x
      return { value: v * factor, part: `陽光×${fmtMultiplier(factor)}` }
    },
  },
  crown: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const count = countRankInChain(ctx.chain, 13)
      if (count === 0) return { value: v, part: null }
      const factor = 1 + count * p.talismans.crown.x
      return { value: v * factor, part: `王冠×${fmtMultiplier(factor)}` }
    },
  },
  cloverLeaf: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const count = countSuitInChain(ctx.chain, '♣')
      if (count === 0) return { value: v, part: null }
      const add = count * p.talismans.cloverLeaf.n
      return { value: v + add, part: `青葉+${add}` }
    },
  },
  coin: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const count = countSuitInChain(ctx.chain, '♦')
      if (count === 0) return { value: v, part: null }
      const add = count * p.talismans.coin.n
      return { value: v + add, part: `硬貨+${add}` }
    },
  },
  blade: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const count = countSuitInChain(ctx.chain, '♠')
      if (count === 0) return { value: v, part: null }
      const add = count * p.talismans.blade.n
      return { value: v + add, part: `武器+${add}` }
    },
  },
  chalice: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const count = countSuitInChain(ctx.chain, '♥')
      if (count === 0) return { value: v, part: null }
      const add = count * p.talismans.chalice.n
      return { value: v + add, part: `献杯+${add}` }
    },
  },
  balance: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      redBlackBalanced(ctx.chain) ? { value: v + p.talismans.balance.n, part: `均衡+${p.talismans.balance.n}` } : { value: v, part: null },
  },
  harmony: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!redBlackBalanced(ctx.chain)) return { value: v, part: null }
      const factor = p.talismans.harmony.x
      return { value: v * factor, part: `調和×${fmtMultiplier(factor)}` }
    },
  },
  nobility: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const { suitHeld } = analyzeSuitColor(ctx.chain)
      if (ctx.chain.length < p.scoring.suitColorMinLen || !suitHeld) return { value: v, part: null }
      return { value: v + p.talismans.nobility.n, part: `高潔+${p.talismans.nobility.n}` }
    },
  },
  tenacity: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const { suitHeld } = analyzeSuitColor(ctx.chain)
      if (ctx.chain.length < p.scoring.suitColorMinLen || !suitHeld) return { value: v, part: null }
      const factor = 1 + ctx.chain.length * p.talismans.tenacity.x
      return { value: v * factor, part: `執念×${fmtMultiplier(factor)}` }
    },
  },
  determination: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const stairInfo = analyzeStair(ctx.chain)
      if (!stairInfo.held || stairInfo.dir === 0 || stairInfo.len < ctx.effectiveStairMinLen) return { value: v, part: null }
      const factor = 1 + stairInfo.len * p.talismans.determination.x
      return { value: v * factor, part: `覚悟×${fmtMultiplier(factor)}` }
    },
  },
  cycle: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const matches = (c: Card, rank: Card['rank']) => c.wild || c.rank === rank
      const kToA = matches(ctx.previousFoundation, 13) && matches(ctx.card, 1)
      const aToK = matches(ctx.previousFoundation, 1) && matches(ctx.card, 13)
      if (!kToA && !aToK) return { value: v, part: null }
      const factor = p.talismans.cycle.x
      return { value: v * factor, part: `循環×${fmtMultiplier(factor)}` }
    },
  },
  reincarnation: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const stairInfo = analyzeStair(ctx.chain)
      const completeRunFired = ctx.chainBonus.roleFired.some(r => r.name === 'completeRun')
      if (!completeRunFired || !stairInfo.held || stairInfo.dir === 0 || !stairUsesKALoop(ctx.chain)) return { value: v, part: null }
      const factor = p.talismans.reincarnation.x
      return { value: v * factor, part: `輪廻×${fmtMultiplier(factor)}` }
    },
  },
  majesty: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const stairInfo = analyzeStair(ctx.chain)
      const { suitHeld } = analyzeSuitColor(ctx.chain)
      const completeRunFired = ctx.chainBonus.roleFired.some(r => r.name === 'completeRun')
      if (!completeRunFired || !stairInfo.held || stairInfo.dir === 0 || !suitHeld) return { value: v, part: null }
      const factor = p.talismans.majesty.x
      return { value: v * factor, part: `威光×${fmtMultiplier(factor)}` }
    },
  },
  omen: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.remainingTableauCount > p.talismans.omen.m) return { value: v, part: null }
      const factor = p.talismans.omen.x
      return { value: v * factor, part: `兆し×${fmtMultiplier(factor)}` }
    },
  },
  crescent: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.remainingTableauCount > p.talismans.crescent.m) return { value: v, part: null }
      const factor = p.talismans.crescent.x
      return { value: v * factor, part: `三日月×${fmtMultiplier(factor)}` }
    },
  },
  blessing: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.chainBonus.roleFired.length === 0) return { value: v, part: null }
      const factor = p.talismans.blessing.x
      return { value: v * factor, part: `恩寵×${fmtMultiplier(factor)}` }
    },
  },
  focus: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!ctx.chainBonus.roleFired.some(r => r.name === 'sameRank')) return { value: v, part: null }
      const factor = p.talismans.focus.x
      return { value: v * factor, part: `集中×${fmtMultiplier(factor)}` }
    },
  },
  lapis: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.chainBonus.roleFired.length < 2) return { value: v, part: null }
      const factor = p.talismans.lapis.x
      return { value: v * factor, part: `瑠璃×${fmtMultiplier(factor)}` }
    },
  },
  jade: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.chainBonus.roleFired.some(r => r.usedWild)
        ? { value: v + p.talismans.jade.n, part: `翡翠+${p.talismans.jade.n}` }
        : { value: v, part: null },
  },
  emptyMind: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.chainBonus.patternFired || ctx.chainBonus.roleFired.length > 0) return { value: v, part: null }
      const factor = p.talismans.emptyMind.x
      return { value: v * factor, part: `無心×${fmtMultiplier(factor)}` }
    },
  },
  prologue: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.combo === 1 ? { value: v + p.talismans.prologue.n, part: `序章+${p.talismans.prologue.n}` } : { value: v, part: null },
  },
  interlude: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.combo % p.talismans.interlude.m === 0
        ? { value: v + p.talismans.interlude.n, part: `幕間+${p.talismans.interlude.n}` }
        : { value: v, part: null },
  },
  morningDew: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.isFirstPlayOfWave ? { value: v + p.talismans.morningDew.n, part: `朝露+${p.talismans.morningDew.n}` } : { value: v, part: null },
  },
  drizzle: {
    channel: 'gained',
    effect: (v, _ctx, p) => ({ value: v + p.talismans.drizzle.n, part: `小雨+${p.talismans.drizzle.n}` }),
  },
  gentleBreeze: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.sameColumnStreak < 2) return { value: v, part: null }
      const add = ctx.sameColumnStreak * p.talismans.gentleBreeze.n
      return { value: v + add, part: `微風+${add}` }
    },
  },
  resonance: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.sameColumnStreak < 2) return { value: v, part: null }
      const factor = 1 + ctx.sameColumnStreak * p.talismans.resonance.x
      return { value: v * factor, part: `共鳴×${fmtMultiplier(factor)}` }
    },
  },
  azureSky: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.totalColumnsEmptiedThisWave === 0) return { value: v, part: null }
      const factor = 1 + ctx.totalColumnsEmptiedThisWave * p.talismans.azureSky.x
      return { value: v * factor, part: `蒼穹×${fmtMultiplier(factor)}` }
    },
  },
  amber: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.maxComboThisWave === 0) return { value: v, part: null }
      const factor = 1 + ctx.maxComboThisWave * p.talismans.amber.x
      return { value: v * factor, part: `琥珀×${fmtMultiplier(factor)}` }
    },
  },
  passion: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.flushActiveThisCombo
        ? { value: v * p.talismans.passion.x, part: `情熱×${fmtMultiplier(p.talismans.passion.x)}` }
        : { value: v, part: null },
  },
  fightingSpirit: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.columnSweepActiveThisWave
        ? { value: v * p.talismans.fightingSpirit.x, part: `闘志×${fmtMultiplier(p.talismans.fightingSpirit.x)}` }
        : { value: v, part: null },
  },
  intuition: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.drawContinueCountThisChain === 0) return { value: v, part: null }
      const factor = 1 + ctx.drawContinueCountThisChain * p.talismans.intuition.x
      return { value: v * factor, part: `直感×${fmtMultiplier(factor)}` }
    },
  },
  mercy: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.mercyActiveNextCombo
        ? { value: v * p.talismans.mercy.x, part: `慈悲×${fmtMultiplier(p.talismans.mercy.x)}` }
        : { value: v, part: null },
  },
  deadline: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.stockRemaining === 0) return { value: v, part: null }
      const add = ctx.stockRemaining * p.talismans.deadline.n
      return { value: v + add, part: `刻限+${add}` }
    },
  },
}

export function applyItemEffects(
  channel: 'gained' | 'clearBonus',
  baseValue: number,
  items: ItemId[],
  ctx: ItemEffectContext,
  params: ShidasuParams
): { value: number; parts: string[] } {
  const parts: string[] = []
  const value = items.reduce((v, id) => {
    const entry = ITEM_EFFECTS[id]
    if (!entry || entry.channel !== channel) return v
    const result = entry.effect(v, ctx, params)
    if (result.part) parts.push(result.part)
    return result.value
  }, baseValue)
  return { value, parts }
}

export type DirectChannel = 'resetDirect' | 'stockEmptyDirect' | 'comboMilestoneDirect' | 'drawContinueDirect'

export interface DirectEffectContext {
  comboBeforeReset: number
  hasPlayableColumns: boolean
  roleFiredThisChain: boolean
  remainingTableauCount: number
  combo: number
  colorHeld: boolean
}

type DirectEffect = (ctx: DirectEffectContext, params: ShidasuParams) => number

const DIRECT_EFFECTS: Partial<Record<ItemId, { channel: DirectChannel; effect: DirectEffect }>> = {
  composure: {
    channel: 'resetDirect',
    effect: (ctx, p) => (ctx.hasPlayableColumns ? 0 : p.talismans.composure.n),
  },
  clarity: {
    channel: 'resetDirect',
    effect: (ctx, p) => (ctx.roleFiredThisChain ? 0 : p.talismans.clarity.n),
  },
  echo: {
    channel: 'resetDirect',
    effect: (ctx, p) => ctx.comboBeforeReset * p.talismans.echo.n,
  },
  arrogance: {
    channel: 'stockEmptyDirect',
    effect: (ctx, p) => ctx.remainingTableauCount * p.talismans.arrogance.x,
  },
  shootingStar: {
    channel: 'comboMilestoneDirect',
    effect: (ctx, p) => (ctx.combo === p.talismans.shootingStar.c ? p.talismans.shootingStar.n : 0),
  },
  sincerity: {
    channel: 'drawContinueDirect',
    effect: (ctx, p) => (ctx.colorHeld ? p.talismans.sincerity.n : 0),
  },
}

export function applyDirectEffects(
  channel: DirectChannel,
  items: ItemId[],
  ctx: DirectEffectContext,
  params: ShidasuParams
): { value: number; parts: string[] } {
  const parts: string[] = []
  const value = items.reduce((total, id) => {
    const entry = DIRECT_EFFECTS[id]
    if (!entry || entry.channel !== channel) return total
    const amount = entry.effect(ctx, params)
    if (amount !== 0) parts.push(`${itemName(id, params)}+${amount}`)
    return total + amount
  }, 0)
  return { value, parts }
}

// rollItemOfferは重み付けなしの完全均等抽選(レアリティによる出現率差は未実装)。
// docs/shidasu-gofu-candidates.mdのC/U/Rレアリティ区分は検討用の分類であり、抽選確率には反映されていない。
export const ITEM_POOL: ItemId[] = [
  'bridge', 'grace',
  'patience', 'purify', 'temperance',
  'springBreeze', 'summerBreeze', 'autumnBreeze', 'winterBreeze',
  'kinship', 'thaw', 'dusk', 'dawn', 'wit',
  'courage', 'daybreak', 'twilight', 'cheerful', 'conscience', 'morningMist',
  'calm', 'serenity', 'destiny', 'fate', 'relief',
  'verdantGreen', 'gem', 'resolve', 'grail', 'moonlight', 'sunlight',
  'crown', 'cloverLeaf', 'coin', 'blade', 'chalice', 'balance', 'harmony',
  'nobility', 'tenacity', 'determination', 'cycle', 'reincarnation', 'majesty',
  'omen', 'crescent',
  'blessing', 'focus', 'lapis', 'jade', 'emptyMind',
  'prologue', 'interlude', 'morningDew',
  'drizzle',
  'eternity', 'abundance', 'silence', 'resilience',
  'gentleBreeze', 'resonance',
  'azureSky', 'amber',
  'composure', 'clarity', 'arrogance', 'echo', 'shootingStar',
  'naive', 'intuition', 'sincerity',
  'promise', 'darkClouds', 'regeneration',
  'benevolence', 'healing',
  'guidance',
  'passion', 'fightingSpirit',
  'sanctify', 'protection', 'earth', 'golden',
  'morningStar', 'mercy', 'mirror', 'deadline',
]

export function itemName(id: ItemId, params: ShidasuParams): string {
  return params.talismans[id].name
}

export function itemDesc(id: ItemId, params: ShidasuParams): string {
  switch (id) {
    case 'bridge': return `階段成立に必要な最小連続枚数を${params.scoring.stairMinLen}→${params.items.stairRelaxedMinLen}枚に緩和`
    case 'grace': {
      const relaxed = params.layout.rows - params.items.columnSweepRelaxCards
      return `列一掃ボーナスの条件を「列の全${params.layout.rows}枚を1コンボで空に」→「残り${relaxed}枚から1コンボで空に」に緩和`
    }
    case 'patience': return `全消しボーナスに残り山札枚数×${params.talismans.patience.x}点を加算`
    case 'purify': return `全消しボーナスに${params.talismans.purify.n}点を加算`
    case 'temperance': return `全消しボーナスを残り山札枚数×${params.talismans.temperance.x}分だけ倍加`
    case 'springBreeze': return `クラブ(♣)を取ったとき、${params.talismans.springBreeze.n}点加算`
    case 'summerBreeze': return `ダイヤ(♦)を取ったとき、${params.talismans.summerBreeze.n}点加算`
    case 'autumnBreeze': return `ハート(♥)を取ったとき、${params.talismans.autumnBreeze.n}点加算`
    case 'winterBreeze': return `スペード(♠)を取ったとき、${params.talismans.winterBreeze.n}点加算`
    case 'kinship': return `他のスートからハート(♥)を取ったとき、${params.talismans.kinship.n}点加算`
    case 'thaw': return `スペード(♠)から別のスートを取ったとき、${params.talismans.thaw.n}点加算`
    case 'dusk': return `赤から黒に変わったとき、${params.talismans.dusk.n}点加算`
    case 'dawn': return `黒から赤に変わったとき、${params.talismans.dawn.n}点加算`
    case 'wit': return `ワイルドを取ったとき、${params.talismans.wit.n}点加算`
    case 'courage': return `コンボ数×${params.talismans.courage.x}分、獲得点を倍加`
    case 'daybreak': return `コンボ数が${params.talismans.daybreak.c}以下のとき、獲得点を${params.talismans.daybreak.x}倍`
    case 'twilight': return `コンボ数が${params.talismans.twilight.c}以上のとき、獲得点を${params.talismans.twilight.x}倍`
    case 'cheerful': return `コンボ数が偶数のとき、${params.talismans.cheerful.n}点加算`
    case 'conscience': return `コンボ数が奇数のとき、${params.talismans.conscience.n}点加算`
    case 'morningMist': return `コンボ数が${params.talismans.morningMist.c}未満のとき獲得点を1/${params.talismans.morningMist.x}に、${params.talismans.morningMist.c}以上のとき${params.talismans.morningMist.x}倍に`
    case 'calm': return `コンボ内にJQKが無いとき、${params.talismans.calm.n}点加算`
    case 'serenity': return `コンボ内にJQKが無いとき、獲得点を${params.talismans.serenity.x}倍`
    case 'destiny': return `コンボ内がJQKのみのとき、${params.talismans.destiny.n}点加算`
    case 'fate': return `コンボ内がJQKのみのとき、獲得点を${params.talismans.fate.x}倍`
    case 'relief': return `取得したカード1枚のランクが1〜10のとき、${params.talismans.relief.n}点加算`
    case 'verdantGreen': return `コンボがクラブ(♣)専有のとき、獲得点を${params.talismans.verdantGreen.x}倍`
    case 'gem': return `コンボがダイヤ(♦)専有のとき、獲得点を${params.talismans.gem.x}倍`
    case 'resolve': return `コンボがスペード(♠)専有のとき、獲得点を${params.talismans.resolve.x}倍`
    case 'grail': return `コンボがハート(♥)専有のとき、獲得点を${params.talismans.grail.x}倍`
    case 'moonlight': return `コンボが黒専有のとき、獲得点を${params.talismans.moonlight.x}倍`
    case 'sunlight': return `コンボが赤専有のとき、獲得点を${params.talismans.sunlight.x}倍`
    case 'crown': return `コンボ内のK枚数×${params.talismans.crown.x}分、獲得点を倍加`
    case 'cloverLeaf': return `コンボ内のクラブ(♣)枚数×${params.talismans.cloverLeaf.n}点を加算`
    case 'coin': return `コンボ内のダイヤ(♦)枚数×${params.talismans.coin.n}点を加算`
    case 'blade': return `コンボ内のスペード(♠)枚数×${params.talismans.blade.n}点を加算`
    case 'chalice': return `コンボ内のハート(♥)枚数×${params.talismans.chalice.n}点を加算`
    case 'balance': return `コンボ内の赤黒枚数が同数のとき、${params.talismans.balance.n}点加算`
    case 'harmony': return `コンボ内の赤黒枚数が同数のとき、獲得点を${params.talismans.harmony.x}倍`
    case 'nobility': return `同スートパターン成立時、${params.talismans.nobility.n}点加算`
    case 'tenacity': return `同スートパターン成立時、コンボ内枚数×${params.talismans.tenacity.x}分、獲得点を倍加`
    case 'determination': return `階段成立時、階段の長さ×${params.talismans.determination.x}分、獲得点を倍加`
    case 'cycle': return `KからA、またはAからKを取ったとき、獲得点を${params.talismans.cycle.x}倍`
    case 'reincarnation': return `コンプリートラン(全ランク階段)にK↔Aループが含まれるとき、獲得点を${params.talismans.reincarnation.x}倍`
    case 'majesty': return `同スートかつ全ランク階段を達成したとき、獲得点を${params.talismans.majesty.x}倍`
    case 'omen': return `場札の残り枚数が${params.talismans.omen.m}枚以下のとき、獲得点を${params.talismans.omen.x}倍`
    case 'crescent': return `場札の残り枚数が${params.talismans.crescent.m}枚以下のとき、獲得点を${params.talismans.crescent.x}倍`
    case 'blessing': return `役が成立したとき、獲得点を${params.talismans.blessing.x}倍`
    case 'focus': return `同ランクの役が含まれるとき、獲得点を${params.talismans.focus.x}倍`
    case 'lapis': return `2種類以上の役ボーナスが同時に発生したとき、獲得点を${params.talismans.lapis.x}倍`
    case 'jade': return `役の成立にワイルドが使われたとき、${params.talismans.jade.n}点加算`
    case 'emptyMind': return `役・パターンがどちらも無いとき、獲得点を${params.talismans.emptyMind.x}倍`
    case 'prologue': return `コンボ1枚目のとき、${params.talismans.prologue.n}点加算`
    case 'interlude': return `コンボが${params.talismans.interlude.m}枚目に達するたび、${params.talismans.interlude.n}点加算`
    case 'morningDew': return `ウェーブで最初にプレイしたカードのとき、${params.talismans.morningDew.n}点加算`
    case 'drizzle': return `場札を取るたび、${params.talismans.drizzle.n}点加算`
    case 'eternity': return `ウェーブ開始時、山札にワイルドを1枚追加(以後のウェーブにも引き継がれる)`
    case 'abundance': return `ウェーブ開始時、デッキ内の1枚がランダムにワイルドへ変換される(以後のウェーブにも引き継がれる)`
    case 'silence': return `山札めくりで取れる場札が無いままコンボがリセットされた時、めくった札をワイルドに変換する(デッキにも永続的に反映)`
    case 'resilience': return `山札が無く場札も取れない手詰まり時、スコアの${params.talismans.resilience.p}%を消費して捨て札の半数を山札に戻す`
    case 'gentleBreeze': return `同じ列を連続でプレイしたとき(2回目以降)、連続回数×${params.talismans.gentleBreeze.n}点加算`
    case 'resonance': return `同じ列を連続でプレイしたとき(2回目以降)、連続回数×${params.talismans.resonance.x}分獲得点を倍加`
    case 'azureSky': return `ウェーブ内で列一掃した累計回数×${params.talismans.azureSky.x}分、獲得点を倍加`
    case 'amber': return `ウェーブ内の最大到達コンボ数×${params.talismans.amber.x}分、獲得点を倍加`
    case 'composure': return `山札めくりでコンボリセットされた時、取れる場札が無ければ直接${params.talismans.composure.n}点加算`
    case 'clarity': return `コンボリセット時、そのチェーンで役が一つも成立していなければ直接${params.talismans.clarity.n}点加算`
    case 'arrogance': return `山札が無くなった時、場札の残り枚数×${params.talismans.arrogance.x}点を直接加算`
    case 'echo': return `コンボがリセットされる瞬間、リセット前のコンボ数×${params.talismans.echo.n}点を直接加算`
    case 'shootingStar': return `コンボ数が${params.talismans.shootingStar.c}に到達した瞬間、直接${params.talismans.shootingStar.n}点加算`
    case 'naive': return `山札めくりがパターン継続だった場合、通常のプレイと同様に得点計算する(コンボ数も加算)`
    case 'intuition': return `(素朴と組み合わせて機能)現在のチェーン中に山札めくりでコンボ継続した回数×${params.talismans.intuition.x}分、獲得点を倍加`
    case 'sincerity': return `山札めくりで同色パターンによりコンボ継続した時、直接${params.talismans.sincerity.n}点加算`
    case 'promise': return `山札の次のカードが、今のコンボが継続できるカードになる`
    case 'darkClouds': return `ウェーブ開始時、場札が${params.talismans.darkClouds.r}行多く配られる`
    case 'regeneration': return `全消し時、スコアの${params.talismans.regeneration.p}%を消費して捨て札から場札を復活させる(復活すればウェーブ継続)`
    case 'benevolence': return `コンボごとに1回、コンボリセットを無効化する`
    case 'healing': return `列一掃時、捨て札から最大${params.layout.rows}枚を空いた列へ戻す`
    case 'guidance': return `山札の次のカードが見えるようになる`
    case 'passion': return `このコンボ中にフラッシュが成立していれば、獲得点を${params.talismans.passion.x}倍`
    case 'fightingSpirit': return `このウェーブ中に列一掃が発生していれば、獲得点を${params.talismans.fightingSpirit.x}倍`
    case 'sanctify': return `役を揃えるたび基礎コンボ数+1。コンボリセット時、0ではなく基礎コンボ数から再開する`
    case 'protection': return `コンボ数(計算用)が${params.talismans.protection.c}未満のとき、${params.talismans.protection.c}として計算する`
    case 'earth': return `コンボ数(計算用)に常に${params.talismans.earth.c}を加算する`
    case 'golden': return `コンボが1回進むたびに、通常の+1ではなく+2進む`
    case 'morningStar': return `役ボーナスの額を、その役のウェーブ内累積成立回数×${params.talismans.morningStar.x}分だけ倍加`
    case 'mercy': return `コンボ数が${params.talismans.mercy.c}以下でリセットされたとき、次のコンボの間、獲得点を${params.talismans.mercy.x}倍`
    case 'mirror': return `役が成立するたび(コンボ中1回、同ランクは枚数ごとに1回)、次のプレイで同じ役ボーナスを追加でもう一度加算する`
    case 'deadline': return `カードを取るたび、山札の残り枚数×${params.talismans.deadline.n}点加算`
  }
}

function shuffleItems(list: ItemId[], rand: () => number): ItemId[] {
  const arr = [...list]
  shuffleInPlace(arr, rand)
  return arr
}

export function rollItemOffer(items: ItemId[], rand: () => number = Math.random): ItemId[] {
  const available = ITEM_POOL.filter(id => !items.includes(id))
  return shuffleItems(available, rand).slice(0, 3)
}

export function createInitialRun(): RunState {
  return { phase: 'title', stageIndex: 0, waveIndex: 0, items: [], offer: [], wave: null, pendingNewItem: null, deckComposition: standardDeckComposition() }
}

export function beginRun(params: ShidasuParams, seed?: number): RunState {
  const { wave, deckComposition } = startWave(params, 0, 0, [], standardDeckComposition(), seed)
  return {
    phase: 'playing',
    stageIndex: 0,
    waveIndex: 0,
    items: [],
    offer: [],
    wave,
    pendingNewItem: null,
    deckComposition,
  }
}

export function resolveWaveEnd(params: ShidasuParams, run: RunState, rand: () => number = Math.random): RunState {
  const wave = run.wave
  if (!wave || wave.status !== 'ended') return run

  const target = params.stages[run.stageIndex].targets[run.waveIndex]
  if (wave.score < target) {
    return { ...run, phase: 'gameOver' }
  }

  const isLastWave = run.waveIndex === params.flow.wavesPerStage - 1
  const isLastStage = run.stageIndex === params.stages.length - 1

  if (isLastWave) {
    return { ...run, phase: isLastStage ? 'allClear' : 'stageClear' }
  }
  return { ...run, phase: 'itemSelect', offer: rollItemOffer(run.items, rand), pendingNewItem: null }
}

export function pickItem(params: ShidasuParams, run: RunState, itemId: ItemId, seed?: number): RunState {
  if (run.phase !== 'itemSelect') return run
  if (run.items.length >= params.items.maxItems) {
    return { ...run, pendingNewItem: itemId }
  }
  const newItems = [...run.items, itemId]
  const newWaveIndex = run.waveIndex + 1
  const { wave, deckComposition } = startWave(params, run.stageIndex, newWaveIndex, newItems, run.deckComposition, seed)
  return {
    ...run,
    phase: 'playing',
    items: newItems,
    waveIndex: newWaveIndex,
    offer: [],
    pendingNewItem: null,
    wave,
    deckComposition,
  }
}

export function confirmItemSwap(params: ShidasuParams, run: RunState, oldItemId: ItemId, seed?: number): RunState {
  if (run.phase !== 'itemSelect' || run.pendingNewItem === null) return run
  const idx = run.items.indexOf(oldItemId)
  const remaining = idx === -1 ? [...run.items] : [...run.items.slice(0, idx), ...run.items.slice(idx + 1)]
  const newItems = [...remaining, run.pendingNewItem]
  const newWaveIndex = run.waveIndex + 1
  const { wave, deckComposition } = startWave(params, run.stageIndex, newWaveIndex, newItems, run.deckComposition, seed)
  return {
    ...run,
    phase: 'playing',
    items: newItems,
    waveIndex: newWaveIndex,
    offer: [],
    pendingNewItem: null,
    wave,
    deckComposition,
  }
}

export function cancelItemSwap(run: RunState): RunState {
  if (run.phase !== 'itemSelect') return run
  return { ...run, pendingNewItem: null }
}

export function skipItemSelect(params: ShidasuParams, run: RunState, seed?: number): RunState {
  if (run.phase !== 'itemSelect') return run
  const newWaveIndex = run.waveIndex + 1
  const { wave, deckComposition } = startWave(params, run.stageIndex, newWaveIndex, run.items, run.deckComposition, seed)
  return {
    ...run,
    phase: 'playing',
    waveIndex: newWaveIndex,
    offer: [],
    pendingNewItem: null,
    wave,
    deckComposition,
  }
}

export function advanceStage(params: ShidasuParams, run: RunState, seed?: number): RunState {
  if (run.phase !== 'stageClear') return run
  const newStageIndex = run.stageIndex + 1
  const { wave, deckComposition } = startWave(params, newStageIndex, 0, run.items, run.deckComposition, seed)
  return {
    ...run,
    phase: 'playing',
    stageIndex: newStageIndex,
    waveIndex: 0,
    wave,
    deckComposition,
  }
}

export function restartRun(params: ShidasuParams, seed?: number): RunState {
  return beginRun(params, seed)
}

// runがプレイ中でwaveを持つ場合のみfnを適用し、そうでなければrunをそのまま返す
function withActiveWave(run: RunState, fn: (wave: WaveState) => WaveState): RunState {
  if (run.phase !== 'playing' || !run.wave) return run
  return { ...run, wave: fn(run.wave) }
}

export function applyPlayCard(params: ShidasuParams, run: RunState, colIndex: number, rand: () => number = Math.random): RunState {
  return withActiveWave(run, wave => {
    const stage = params.stages[run.stageIndex]
    const target = stage.targets[run.waveIndex]
    return playCard(params, wave, stage.modifier, run.items, target, colIndex, rand)
  })
}

export function applyDrawStock(params: ShidasuParams, run: RunState, rand: () => number = Math.random): RunState {
  if (run.phase !== 'playing' || !run.wave) return run
  const modifier = params.stages[run.stageIndex].modifier
  const { wave, deckComposition } = drawStock(params, run.wave, run.items, run.deckComposition, modifier, rand)
  return { ...run, wave, deckComposition }
}

// 不屈の護符: 捨て札があれば約半数をランダムに山札へ戻しスコアを消費する。
// 発動条件を満たさない場合は元のwaveと同一の参照をそのまま返す(呼び出し元のapplyStuckCheckが
// この参照の同一性を「発動したかどうか」の判定に使っているため、契約として維持すること)。
function tryResilienceRevive(params: ShidasuParams, wave: WaveState, items: ItemId[], rand: () => number): WaveState {
  if (wave.status !== 'playing' || !items.includes('resilience') || wave.discardPile.length === 0) return wave
  const pool = [...wave.discardPile]
  shuffleInPlace(pool, rand)
  const reviveCount = Math.max(1, Math.ceil(pool.length / 2))
  const revived = pool.slice(0, reviveCount)
  const remaining = pool.slice(reviveCount)
  const cost = Math.floor(wave.score * params.talismans.resilience.p / 100)
  return {
    ...wave,
    score: wave.score - cost,
    stock: [...wave.stock, ...revived],
    discardPile: remaining,
  }
}

export function applyStuckCheck(params: ShidasuParams, run: RunState, rand: () => number = Math.random): RunState {
  return withActiveWave(run, wave => {
    const modifier = params.stages[run.stageIndex].modifier
    if (!isStuck(modifier, wave)) return wave
    const revived = tryResilienceRevive(params, wave, run.items, rand)
    // 復活が発動した場合、stockに最低1枚は戻っているため手詰まりは解消済み(isStuckの再判定は不要)
    if (revived !== wave) return revived
    return markStuck(wave)
  })
}

export interface SuitColorAnalysis {
  suitHeld: boolean
  colorHeld: boolean
}

export function analyzeSuitColor(chain: Card[]): SuitColorAnalysis {
  const realCards = chain.filter(c => !c.wild)
  if (realCards.length === 0) return { suitHeld: true, colorHeld: true }
  const first = realCards[0]
  return {
    suitHeld: realCards.every(c => c.suit === first.suit),
    colorHeld: realCards.every(c => isRed(c) === isRed(first)),
  }
}

export interface StairAnalysis {
  held: boolean
  dir: -1 | 0 | 1
  len: number
}

// rankをdir方向にsteps回分ずらした値を返す(1〜13の循環、K⇔Aのループも跨ぐ)
function stepRank(rank: number, dir: -1 | 1, steps: number): number {
  const zeroBased = rank - 1
  const shifted = ((zeroBased + dir * steps) % 13 + 13) % 13
  return shifted + 1
}

export function analyzeStair(chain: Card[]): StairAnalysis {
  if (chain.length === 0) return { held: true, dir: 0, len: 1 }

  const realPositions = chain
    .map((c, i) => ({ card: c, index: i }))
    .filter(p => !p.card.wild)

  if (realPositions.length === 0) {
    // 実カードが1枚も無い場合、比較対象が無く矛盾しないため都合よく一直線とみなす
    return { held: true, dir: chain.length >= 2 ? 1 : 0, len: chain.length }
  }
  if (realPositions.length === 1) {
    // 方向を確立する相手(2つ目の実カード)が無いため未確立のまま
    return { held: true, dir: 0, len: 1 }
  }

  let dir: -1 | 0 | 1 = 0
  for (let k = 1; k < realPositions.length; k++) {
    const prev = realPositions[k - 1]
    const curr = realPositions[k]
    const gap = curr.index - prev.index // 間にあるワイルド枚数+1

    const matchesAscending = stepRank(prev.card.rank, 1, gap) === curr.card.rank
    const matchesDescending = stepRank(prev.card.rank, -1, gap) === curr.card.rank

    if (dir === 0) {
      if (matchesAscending) dir = 1
      else if (matchesDescending) dir = -1
      else return { held: false, dir: 0, len: 1 }
    } else if (!(dir === 1 ? matchesAscending : matchesDescending)) {
      return { held: false, dir: 0, len: 1 }
    }
  }
  return { held: true, dir, len: chain.length }
}

// 階段のチェーンが13→1、または1→13の境界を跨いだか(ワイルドで橋渡しされた区間内の越境も検出する)
export function stairUsesKALoop(chain: Card[]): boolean {
  const analysis = analyzeStair(chain)
  if (!analysis.held || analysis.dir === 0) return false
  const realPositions = chain.map((c, i) => ({ card: c, index: i })).filter(p => !p.card.wild)
  if (realPositions.length < 2) return true
  for (let k = 1; k < realPositions.length; k++) {
    const prev = realPositions[k - 1]
    const curr = realPositions[k]
    const gap = curr.index - prev.index
    if (analysis.dir === 1 && prev.card.rank + gap > 13) return true
    if (analysis.dir === -1 && prev.card.rank - gap < 1) return true
  }
  return false
}

const ALL_SUITS_REAL: Suit[] = ['♠', '♥', '♦', '♣']

// checkFlush/checkRoyalSet/checkCompleteRunは、いずれもワイルド1枚につき不足分を1つ埋めたものとして扱う。
// ただし現時点ではワイルドカードを山札に供給する手段が無いため(既存のワイルド供給アイテムは削除済み)、
// この緩和ルールは実際のプレイでは発動しない。将来ワイルド供給アイテムが追加された際に機能する先行実装。
export function checkFlush(chainIncludingThis: Card[]): boolean {
  if (chainIncludingThis.length < 4) return false
  const last4 = chainIncludingThis.slice(-4)
  const wildCount = last4.filter(c => c.wild).length
  const suitsPresent = new Set(last4.filter(c => !c.wild).map(c => c.suit))
  const missingSuits = ALL_SUITS_REAL.filter(s => !suitsPresent.has(s)).length
  return missingSuits <= wildCount
}

export function checkRoyalSet(chainIncludingThis: Card[]): boolean {
  if (chainIncludingThis.length < 3) return false
  const last3 = chainIncludingThis.slice(-3)
  const wildCount = last3.filter(c => c.wild).length
  const ranksPresent = new Set(last3.filter(c => !c.wild).map(c => c.rank))
  const requiredRanks: Card['rank'][] = [11, 12, 13]
  const missingRanks = requiredRanks.filter(r => !ranksPresent.has(r)).length
  return missingRanks <= wildCount
}

export function countSameRankBefore(chainBefore: Card[], rank: Card['rank']): number {
  const realMatches = chainBefore.filter(c => !c.wild && c.rank === rank).length
  const wildCount = chainBefore.filter(c => c.wild).length
  return realMatches + wildCount
}

// ワイルド自身をプレイした場合の同ランクボーナス判定用: チェーン内で既に発生している
// 同ランクの最大枚数(既存ワイルドの代役分を含む)に+1枚した数で発生させる(まだ発生していなければ2枚)
export function countSameRankForWildPlay(chainBefore: Card[]): number {
  const realRankCounts = new Map<Card['rank'], number>()
  for (const c of chainBefore) {
    if (!c.wild) realRankCounts.set(c.rank, (realRankCounts.get(c.rank) ?? 0) + 1)
  }
  const maxRealRankCount = realRankCounts.size === 0 ? 0 : Math.max(...realRankCounts.values())
  const wildCountInChain = chainBefore.filter(c => c.wild).length
  return Math.max(maxRealRankCount + wildCountInChain, 1) + 1
}

export function checkCompleteRun(chainBefore: Card[], chainIncludingThis: Card[]): boolean {
  const distinctRealBefore = new Set(chainBefore.filter(c => !c.wild).map(c => c.rank)).size
  const wildCountBefore = chainBefore.filter(c => c.wild).length
  const distinctRealNow = new Set(chainIncludingThis.filter(c => !c.wild).map(c => c.rank)).size
  const wildCountNow = chainIncludingThis.filter(c => c.wild).length

  const distinctBefore = Math.min(13, distinctRealBefore + wildCountBefore)
  const distinctNow = Math.min(13, distinctRealNow + wildCountNow)
  return distinctBefore < 13 && distinctNow >= 13
}

export interface ChainBonusResult {
  bonus: number
  parts: string[]
  // 同スート/同色/階段のいずれかの「パターンボーナス」が成立したか
  patternFired: boolean
  // 成立した「役ボーナス」の一覧。usedWildの意味はrole名によって異なる:
  // flush/royalSet/completeRunは「実カードだけでは成立せずワイルドの穴埋めが必須だったか」(必要性ベース)。
  // sameRankは同ランクボーナスの加点量自体がワイルド枚数を無条件に含むため、
  // 「チェーンにワイルドが1枚でも存在すれば常にtrue」(寄与ベース)になる。
  // amountはこの役が実際に加算した点数(roleBonusMultiplier適用後、completeRunは同スート追加分を含む)。
  // 明星(倍率適用)・水鏡(遅延複製)が参照する。
  roleFired: { name: RoleName; usedWild: boolean; amount: number }[]
}

export function evaluateChainBonus(
  scoring: ShidasuParams['scoring'],
  chainBefore: Card[],
  card: Card,
  stairMinLen: number = scoring.stairMinLen,
  roleBonusMultiplier: (name: RoleName) => number = () => 1
): ChainBonusResult {
  if (chainBefore.length === 0) {
    return { bonus: 0, parts: [], patternFired: false, roleFired: [] }
  }

  let bonus = 0
  const parts: string[] = []
  let patternFired = false
  const roleFired: { name: RoleName; usedWild: boolean; amount: number }[] = []

  const chainIncludingThis = [...chainBefore, card]

  const { suitHeld, colorHeld } = analyzeSuitColor(chainIncludingThis)
  if (chainIncludingThis.length >= scoring.suitColorMinLen) {
    if (suitHeld) {
      bonus += scoring.suitBonus
      parts.push(`同スート+${scoring.suitBonus}`)
      patternFired = true
    } else if (colorHeld) {
      bonus += scoring.colorBonus
      parts.push(`同色+${scoring.colorBonus}`)
      patternFired = true
    }
  }

  const stairInfo = analyzeStair(chainIncludingThis)
  if (stairInfo.held && stairInfo.len >= stairMinLen) {
    bonus += scoring.stairBonus
    parts.push(`階段${stairInfo.len} +${scoring.stairBonus}`)
    patternFired = true
  }

  if (checkFlush(chainIncludingThis)) {
    const flushGain = Math.floor(scoring.flushBonus * roleBonusMultiplier('flush'))
    bonus += flushGain
    parts.push(`フラッシュ+${flushGain}`)
    const last4 = chainIncludingThis.slice(-4)
    const realSuits = new Set(last4.filter(c => !c.wild).map(c => c.suit))
    const flushUsedWild = ALL_SUITS_REAL.some(s => !realSuits.has(s))
    roleFired.push({ name: 'flush', usedWild: flushUsedWild, amount: flushGain })
  }

  if (checkRoyalSet(chainIncludingThis)) {
    const royalSetGain = Math.floor(scoring.royalSetBonus * roleBonusMultiplier('royalSet'))
    bonus += royalSetGain
    parts.push(`ロイヤル+${royalSetGain}`)
    const last3 = chainIncludingThis.slice(-3)
    const realRanks = new Set(last3.filter(c => !c.wild).map(c => c.rank))
    const requiredRanks: Card['rank'][] = [11, 12, 13]
    const royalSetUsedWild = requiredRanks.some(r => !realRanks.has(r))
    roleFired.push({ name: 'royalSet', usedWild: royalSetUsedWild, amount: royalSetGain })
  }

  const sameRankCount = card.wild ? countSameRankForWildPlay(chainBefore) : countSameRankBefore(chainBefore, card.rank)
  if (sameRankCount > 0) {
    const sameRankGain = Math.floor(scoring.sameRankBonusUnit * sameRankCount * roleBonusMultiplier('sameRank'))
    bonus += sameRankGain
    parts.push(`同ランク+${sameRankGain}`)
    const sameRankUsedWild = card.wild || chainBefore.some(c => c.wild)
    roleFired.push({ name: 'sameRank', usedWild: sameRankUsedWild, amount: sameRankGain })
  }

  if (checkCompleteRun(chainBefore, chainIncludingThis)) {
    const completeRunGain = Math.floor(scoring.completeRunBonus * roleBonusMultiplier('completeRun'))
    bonus += completeRunGain
    parts.push(`コンプリートラン+${completeRunGain}`)
    const distinctRealNow = new Set(chainIncludingThis.filter(c => !c.wild).map(c => c.rank)).size
    const wildCountNow = chainIncludingThis.filter(c => c.wild).length
    const completeRunUsedWild = distinctRealNow < 13 && wildCountNow > 0
    // completeRunのみ、同スート追加ボーナスの有無を確定させてからroleFiredにpushする
    // (他の役は単一の加点のみだが、completeRunは同スート追加分も合算してamountに含めるため)。
    let completeRunTotalGain = completeRunGain
    if (suitHeld) {
      const completeRunSuitGain = Math.floor(scoring.completeRunSuitBonus * roleBonusMultiplier('completeRun'))
      bonus += completeRunSuitGain
      parts.push(`コンプリートラン(同スート)+${completeRunSuitGain}`)
      completeRunTotalGain += completeRunSuitGain
    }
    roleFired.push({ name: 'completeRun', usedWild: completeRunUsedWild, amount: completeRunTotalGain })
  }

  return { bonus, parts, patternFired, roleFired }
}

export function chainContinuesPattern(
  scoring: ShidasuParams['scoring'],
  chain: Card[],
  card: Card,
  stairMinLen: number = scoring.stairMinLen
): boolean {
  const chainIncludingThis = [...chain, card]

  const { suitHeld, colorHeld } = analyzeSuitColor(chainIncludingThis)
  if (chainIncludingThis.length >= scoring.suitColorMinLen && (suitHeld || colorHeld)) return true

  const stairInfo = analyzeStair(chainIncludingThis)
  if (stairInfo.held && stairInfo.dir !== 0 && stairInfo.len >= stairMinLen) return true

  return false
}

let debugCardIdSeq = 900000

// デバッグパネル専用: 山札の一番上(次にめくられる札)を指定カードに差し替える。
// idは既存デッキ(最大でも数百枚程度)と衝突しないよう90万番台から発番する。
export function forceStockTop(wave: WaveState, suit: Suit, rank: Rank, wild: boolean): WaveState {
  const card: Card = { id: ++debugCardIdSeq, suit, rank, wild }
  const newStock = wave.stock.length === 0 ? [card] : [...wave.stock.slice(0, -1), card]
  return { ...wave, stock: newStock }
}
