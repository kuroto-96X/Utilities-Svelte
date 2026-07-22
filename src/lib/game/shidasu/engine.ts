// src/lib/game/shidasu/engine.ts
import type { Card, StageModifier, WaveState, ItemId, WaveEndReason, RunState, Suit, Rank, DeckCard, RoleName, BonusGain, ChainCardOrigin, RiteId, Rarity, RevelationId, SpreadId, BossKind, BossTierKey } from './types'
import type { ShidasuParams } from './params'
import { createRng, shuffle, shuffleInPlace, standardDeckComposition } from './deck'
import { isFace, chainContinuesPattern, evaluateChainBonus, analyzeSuitColor, countSameRankBefore, countSameRankForWildPlay, fmtMultiplier } from './patterns'
import { rollItemOffer } from './items'
import { applyDirectEffects, type DirectEffectContext } from './directEffects'
import { applyItemEffects, type ItemEffectContext } from './itemEffects'
import { applyRiteEffect, canUseRite } from './riteEffects'
import { rollRite } from './rites'
import { rollRevelationOffer } from './revelations'
import { applyRevelationEffect, canUseRevelation } from './revelationEffects'
import { rollOracleOffer, defaultOracleLevels } from './oracles'

const RANK_LABEL: Record<number, string> = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }

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
  // エワズ発動中は、そのウェーブが終わるまでランク差2(ループ越え含む)も許可する。
  // 階段パターン判定(analyzeStair)には一切影響しない。
  if (wave.ehwazActiveThisWave) {
    if (d === 2) return true
    if (d === 11 && modifier !== 'noLoop') return true
  }
  return false
}

// アルギズ発動中は列内の全カードが、それ以外は一番上のカードのみがプレイ対象になる。
// 対象カードのうち実際にisPlayableを満たす行インデックスの集合を返す(判定基準自体は変わらない)。
export function getPlayableRowsInColumn(modifier: StageModifier, wave: WaveState, colIndex: number): Set<number> {
  const col = wave.tableau[colIndex]
  const result = new Set<number>()
  if (!col || col.length === 0) return result
  if (wave.playFromAnywhereActiveThisWave) {
    col.forEach((c, ri) => {
      if (isPlayable(modifier, wave, c)) result.add(ri)
    })
  } else {
    const topIndex = col.length - 1
    if (isPlayable(modifier, wave, col[topIndex])) result.add(topIndex)
  }
  return result
}

export function getPlayableColumns(modifier: StageModifier, wave: WaveState): Set<number> {
  const result = new Set<number>()
  wave.tableau.forEach((col, i) => {
    if (getPlayableRowsInColumn(modifier, wave, i).size > 0) result.add(i)
  })
  return result
}

export function remainingCount(tableau: Card[][]): number {
  return tableau.reduce((n, c) => n + c.length, 0)
}

const MANNAZ_RARITY_WEIGHT: Record<Rarity, number> = { C: 1, U: 2, R: 4 }

// マンナズ用: 所持護符それぞれのレア度重み(コモン=1、アンコモン=2、レア=4)の合計を求める
function mannazWeightSum(items: ItemId[], params: ShidasuParams): number {
  return items.reduce((sum, id) => sum + MANNAZ_RARITY_WEIGHT[params.talismans[id].rarity], 0)
}

// デッキ構成のうち非ワイルドの1枚をランダムに選びワイルドへ変換した新しい配列を返す(候補が無ければそのまま返す)
function convertRandomCardToWild(composition: DeckCard[], rand: () => number): DeckCard[] {
  const candidates = composition.map((c, i) => i).filter(i => !composition[i].wild)
  if (candidates.length === 0) return composition
  const target = candidates[Math.floor(rand() * candidates.length)]
  return composition.map((c, i) => (i === target ? { ...c, wild: true } : c))
}

// 指定したdeckIdに一致する(まだワイルドでない)デッキ構成エントリをワイルドへ変換した新しい配列を返す。
// 該当エントリが無い(既にワイルド化済み、またはdeckIdが存在しない)場合は何もしない(静寂の護符が使用する)。
function convertCardToWildByDeckId(composition: DeckCard[], deckId: number): DeckCard[] {
  const index = composition.findIndex(c => c.deckId === deckId && !c.wild)
  if (index === -1) return composition
  return composition.map((c, i) => (i === index ? { ...c, wild: true } : c))
}

// 山札(末尾が次にめくられる位置)の中から、今のチェーンが継続できる最初のカードを探し、末尾と交換する。
// 候補が無ければ何もしない(元の配列をそのまま返す)。
function arrangeNextCardForContinuation(scoring: ShidasuParams['scoring'], stock: Card[], chain: Card[], stairMinLen: number, suitColorMinLen: number = scoring.suitColorMinLen): Card[] {
  if (stock.length === 0) return stock
  const lastIndex = stock.length - 1
  for (let i = 0; i <= lastIndex; i++) {
    if (chainContinuesPattern(scoring, chain, stock[i], stairMinLen, suitColorMinLen)) {
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
  seed?: number,
  extraTableauRows: number = 0,
  oracleLevels: Record<RoleName, number> = defaultOracleLevels()
): { wave: WaveState; deckComposition: DeckCard[] } {
  const rand = createRng(seed ?? Math.floor(Math.random() * 999999) + 1)
  let idSeq = 0
  const nextId = () => ++idSeq

  let composition = deckComposition
  if (items.includes('eternity')) {
    // deckIdは既存エントリと重複しないよう、現在の配列長を新規idとして採番する(deckComposition
    // からエントリが削除されることは無いため、長さは単調増加でありidが枯渇・衝突することはない)
    composition = [...composition, { deckId: composition.length, suit: '★', rank: 0 as Rank, wild: true }]
  }
  if (items.includes('abundance')) {
    composition = convertRandomCardToWild(composition, rand)
  }

  const deck = shuffle(composition.map(c => ({ id: nextId(), ...c })), rand)
  const { cols } = params.layout
  const rows = params.layout.rows + (items.includes('darkClouds') ? params.talismans.darkClouds.r : 0) + extraTableauRows
  const tableau: Card[][] = []
  for (let c = 0; c < cols; c++) {
    tableau.push(deck.splice(0, rows))
  }
  const foundation = deck.pop() as Card
  const effectiveStairMinLenAtDeal = items.includes('bridge') ? params.scoring.stairMinLen - params.talismans.bridge.m : params.scoring.stairMinLen
  const effectiveSuitColorMinLenAtDeal = items.includes('bridge') ? params.scoring.suitColorMinLen - params.talismans.bridge.m : params.scoring.suitColorMinLen
  const stockAfterDeal = items.includes('promise')
    ? arrangeNextCardForContinuation(params.scoring, deck, [foundation], effectiveStairMinLenAtDeal, effectiveSuitColorMinLenAtDeal)
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
    dealtRows: rows,
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
    sweptColumnsThisCombo: [],
    regenerationUsedThisWave: false,
    resilienceUsedThisWave: false,
    comboResetShieldRemaining: 0,
    playFromAnywhereActiveThisWave: false,
    nauthizActiveThisWave: false,
    comboFrozenThisWave: false,
    sowiloActiveThisWave: false,
    sowiloBoostedRole: null,
    mannazActiveThisWave: false,
    ehwazActiveThisWave: false,
    oracleLevels,
  }

  return { wave, deckComposition: composition }
}

// コンボリセット時に共通で初期化するフィールドをまとめて返す(治癒・再生・不屈の解決は含まない)。
// newFoundation/newOriginを省略した場合はfoundationを変更せず、chainは[wave.foundation]・
// chainOriginは現在の末尾要素のみを残す(全消し・手詰まり時に使う。まだ新しいカードを引いていないため)。
// 通常のdrawStockリセットでは、新しく引いたカードとその起源('draw')を明示的に渡す。
function resetComboFields(
  wave: WaveState,
  params: ShidasuParams,
  newFoundation: Card = wave.foundation,
  newOrigin: ChainCardOrigin = wave.chainOrigin[wave.chainOrigin.length - 1]
): WaveState {
  // エイワズ(秘儀)によるコンボリセット防止。newFoundationが新しく引かれたカード(通常のdrawStock
  // リセット時)であればチェーンを継続扱いで延長し、全消し・手詰まりのリサイクル時(newFoundation省略、
  // wave.foundationと同一)はチェーン・コンボ状態をそのまま保持する。いずれもresetDirect系護符
  // (沈着・冷静・残響等)の判定はこの関数の外側(呼び出し元)で既に行われているため、シールドが
  // 防ぐのはコンボ・チェーンの状態変化のみである。
  if (wave.comboResetShieldRemaining > 0) {
    const isNewCard = newFoundation.id !== wave.foundation.id
    return {
      ...wave,
      foundation: newFoundation,
      chain: isNewCard ? [...wave.chain, newFoundation] : wave.chain,
      chainOrigin: isNewCard ? [...wave.chainOrigin, newOrigin] : wave.chainOrigin,
      linked: true,
      comboResetShieldRemaining: wave.comboResetShieldRemaining - 1,
    }
  }

  // 新chainに引き継がれるカード(newFoundation)は捨て札へ重複して送らない。chain内の位置ではなく
  // IDの一致で除外するため、chain末尾が必ずfoundationと一致するという不変条件に依存しない。
  // 通常のdrawStockリセットではnewFoundationが新規に引いたカードでchainに含まれないため何も除去されず、
  // 全消し・手詰まりのリサイクル時のみ該当カードが除外される。
  const chainToDiscard = wave.chain.filter(c => c.id !== newFoundation.id)
  // イサ(凍結)がナウジズより優先。凍結中はcomboを一切変更しない。
  // 基礎コンボ数(baseComboCount)はリセット処理では一切参照しない(得点計算時に常に加算される別枠の値のため)。
  const comboAfterReset = wave.comboFrozenThisWave
    ? wave.combo
    : wave.nauthizActiveThisWave
      ? Math.floor(wave.combo / 2)
      : 0
  return {
    ...wave,
    foundation: newFoundation,
    combo: comboAfterReset,
    chain: [newFoundation],
    chainOrigin: [newOrigin],
    linked: false,
    columnsEmptiedThisCombo: 0,
    comboStreakColumnLengths: wave.tableau.map(col => col.length),
    discardPile: [...wave.discardPile, ...chainToDiscard],
    drawContinueCountThisChain: 0,
    flushActiveThisCombo: false,
    sameColumnStreak: 0,
    lastPlayedColumn: null,
    benevolenceUsedThisCombo: false,
    roleEchoUsedThisCombo: {},
    sameRankEchoUsedThisCombo: [],
    pendingRoleEcho: null,
    mercyActiveNextCombo: wave.combo <= params.talismans.mercy.c,
    sweptColumnsThisCombo: [],
    roleFiredThisChain: false,
  }
}

// 治癒: コンボリセット直前に列一掃していた列を、コンボ開始時点の枚数を上限に捨て札から復活させる。
// resetWaveはresetComboFields適用後(discardPileにチェーンの札が加わった後)の状態を渡すこと。
// sweptColumnsはリセット直前(resetComboFields呼び出し前)のwave.sweptColumnsThisComboを渡す。
// 捨て札は1回だけシャッフルし、列一掃した順(sweptColumnsの並び順)に在庫が尽きるまで割り振る。
function resolveHealingRestoration(
  resetWave: WaveState,
  sweptColumns: { colIndex: number; startLength: number }[],
  rand: () => number
): WaveState {
  if (sweptColumns.length === 0 || resetWave.discardPile.length === 0) return resetWave

  const pool = [...resetWave.discardPile]
  shuffleInPlace(pool, rand)
  let cursor = 0
  const tableau = resetWave.tableau.map(col => [...col])
  const comboStreakColumnLengths = [...resetWave.comboStreakColumnLengths]

  for (const { colIndex, startLength } of sweptColumns) {
    if (tableau[colIndex].length !== 0) continue
    const available = pool.length - cursor
    if (available <= 0) break
    const take = Math.min(startLength, available)
    tableau[colIndex] = pool.slice(cursor, cursor + take)
    comboStreakColumnLengths[colIndex] = take
    cursor += take
  }

  return {
    ...resetWave,
    tableau,
    discardPile: pool.slice(cursor),
    comboStreakColumnLengths,
  }
}

// 中凶・大凶ボスウェーブによる得点ロック。isPlayable(取得可否)には一切影響せず、
// 獲得点(基礎点・チェーンボーナス・列一掃ボーナス等を含めた総額)だけを0にする。
// 既存のStageModifier(取得を禁止する型)とは別の仕組みとして扱う。
export type BossScoreLock =
  | { kind: 'combo'; maxCombo: number; tierLabel: string }
  | { kind: 'suit'; suit: Suit; tierLabel: string }
  | { kind: 'oddCombo'; tierLabel: string }
  | { kind: 'face'; tierLabel: string }
  | null

// scoreLockの種別ごとの無得点化条件を判定する共通ヘルパー。playCard/drawStockの両方から使う。
function isBossScoreLocked(scoreLock: NonNullable<BossScoreLock>, effectiveCombo: number, card: Card): boolean {
  switch (scoreLock.kind) {
    case 'combo': return effectiveCombo <= scoreLock.maxCombo
    case 'suit': return !card.wild && card.suit === scoreLock.suit
    case 'oddCombo': return effectiveCombo % 2 === 1
    case 'face': return !card.wild && isFace(card)
    default: {
      // 網羅性チェック: BossScoreLockに新しいkindが追加されコンパイル時に更新漏れがあれば、
      // ここで型エラーになる(値をnever型に代入できないため)。
      const _exhaustive: never = scoreLock
      return _exhaustive
    }
  }
}

// 無得点になった際にlastGain.partsへ積むメッセージ。scoreLockが構築された時点(bossScoreLockFor)で
// 確定した実際の階級名(tierLabel)をそのまま使う。kindからtierを再導出しない
// (kindとtierの対応はparams.bosses[kind].tierとして管理画面から変更できるため、
// ここで再導出すると階級再割り当てに追従できなくなる)。
function bossScoreLockMessage(scoreLock: NonNullable<BossScoreLock>): string {
  return `${scoreLock.tierLabel}: 獲得点0`
}

export function playCard(
  params: ShidasuParams,
  wave: WaveState,
  modifier: StageModifier,
  items: ItemId[],
  target: number,
  colIndex: number,
  deckComposition: DeckCard[],
  rand: () => number = Math.random,
  scoreLock: BossScoreLock = null,
  rowIndex?: number
): { wave: WaveState; deckComposition: DeckCard[] } {
  if (wave.status !== 'playing') return { wave, deckComposition }
  const col = wave.tableau[colIndex]
  if (!col || col.length === 0) return { wave, deckComposition }
  const row = rowIndex ?? col.length - 1
  // アルギズ非発動中は一番上以外の行を指定しても無視する(不正なプレイを防ぐガード)
  if (row !== col.length - 1 && !wave.playFromAnywhereActiveThisWave) return { wave, deckComposition }
  const card = col[row]
  if (!card) return { wave, deckComposition }
  if (!isPlayable(modifier, wave, card)) return { wave, deckComposition }

  // 黄金: 通常のコンボ加算処理そのものを+1ではなく+2にする(他の護符には無干渉)
  // イサ(凍結)発動中は加算自体を行わない
  const newCombo = wave.comboFrozenThisWave ? wave.combo : wave.combo + (items.includes('golden') ? 2 : 1)
  let base = params.scoring.basePoint
  const parts = [`基礎点+${base}`]

  // 水鏡: 前のプレイで予約された役ボーナスの遅延複製を無条件で上乗せする
  if (items.includes('mirror') && wave.pendingRoleEcho) {
    base += wave.pendingRoleEcho.amount
    parts.push(`水鏡(${wave.pendingRoleEcho.name})+${wave.pendingRoleEcho.amount}`)
  }

  const effectiveStairMinLen = items.includes('bridge') ? params.scoring.stairMinLen - params.talismans.bridge.m : params.scoring.stairMinLen
  const effectiveSuitColorMinLen = items.includes('bridge') ? params.scoring.suitColorMinLen - params.talismans.bridge.m : params.scoring.suitColorMinLen
  // 明星: 役の種類ごとのウェーブ内累積成立回数(今回成立分は含まない)に応じて役ボーナス額を倍率適用する
  // ソウィロ: 発動後に初めて成立が確定した役をこのプレイ内で記憶し(sowiloCommittedThisPlay)、
  // その役をx倍にする。以後のプレイではsowiloBoostedRoleが確定済みのため同じ役だけがx倍になる。
  let sowiloCommittedThisPlay: RoleName | null = null
  const roleBonusMultiplier = (name: RoleName): number => {
    let factor = 1
    if (items.includes('morningStar')) {
      const count = wave.roleOccurrenceCountThisWave[name] ?? 0
      factor *= 1 + count * params.talismans.morningStar.x
    }
    if (wave.sowiloActiveThisWave) {
      if (wave.sowiloBoostedRole === name || sowiloCommittedThisPlay === name) {
        factor *= params.rites.sowilo.x
      } else if (wave.sowiloBoostedRole === null && sowiloCommittedThisPlay === null) {
        sowiloCommittedThisPlay = name
        factor *= params.rites.sowilo.x
      }
    }
    return factor
  }
  // 神託: 役ごとの現在レベルをそのまま基礎点の乗数として渡す(ウェーブ開始時点で固定済み)
  const oracleLevel = (name: RoleName): number => wave.oracleLevels[name] ?? 1
  const chainResult = evaluateChainBonus(params.scoring, wave.chain, card, effectiveStairMinLen, roleBonusMultiplier, effectiveSuitColorMinLen, oracleLevel)
  base += chainResult.bonus
  parts.push(...chainResult.parts)

  const chainIncludingThis = [...wave.chain, card]

  const newTableau = wave.tableau.map((c, i) => (i === colIndex ? [...c.slice(0, row), ...c.slice(row + 1)] : c))
  const columnJustEmptied = newTableau[colIndex].length === 0
  const streakStartLength = wave.comboStreakColumnLengths[colIndex]
  const rows = wave.dealtRows
  const sweepQualifies = columnJustEmptied && (
    items.includes('grace')
      ? streakStartLength <= rows - params.talismans.grace.m
      : streakStartLength === rows
  )
  const newColumnsEmptied = sweepQualifies ? wave.columnsEmptiedThisCombo + 1 : wave.columnsEmptiedThisCombo
  const newSweptColumnsThisCombo = sweepQualifies
    ? [...wave.sweptColumnsThisCombo, { colIndex, startLength: streakStartLength }]
    : wave.sweptColumnsThisCombo
  const roleFired = [...chainResult.roleFired]
  if (sweepQualifies) {
    const sweepGain = Math.floor(params.scoring.columnSweepBonus * oracleLevel('columnSweep') * newColumnsEmptied * roleBonusMultiplier('columnSweep'))
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

  // 治癒・再生の解決はコンボリセット時(全消し・手詰まり・drawStockのパターン不継続)に
  // 共通処理として行う。プレイ時点では場札の除去のみを反映し、ここでは復活処理を行わない。
  // remainingBeforeRevivalは全消し判定に、remainingは各護符コンテキストの残枚数に使う。
  const remainingBeforeRevival = remainingCount(newTableau)
  const remaining = remainingBeforeRevival

  const newSameColumnStreak = wave.lastPlayedColumn === colIndex ? wave.sameColumnStreak + 1 : 1
  const newMaxComboThisWave = Math.max(wave.maxComboThisWave, newCombo)
  const newTotalColumnsEmptiedThisWave = wave.totalColumnsEmptiedThisWave + (sweepQualifies ? 1 : 0)
  const newColumnSweepActiveThisWave = wave.columnSweepActiveThisWave || sweepQualifies
  const newRoleFiredThisChain = wave.roleFiredThisChain || roleFired.length > 0
  const newFlushActiveThisCombo = wave.flushActiveThisCombo || roleFired.some(r => r.name === 'flush')

  // 祝福: 役成立ごとに基礎コンボ数(baseComboCount)を永続的に+1する
  const newBaseComboCount = items.includes('sanctify') && roleFired.length > 0 ? wave.baseComboCount + 1 : wave.baseComboCount

  // 基礎コンボ数は計算用のコンボ数に常に加算する(このプレイで祝福により増えた分も含む)。
  // 庇護・大地: 所持順(itemsの並び順)でさらに一時comboに適用する。wave.combo(実コンボ)自体は変化しない。
  let effectiveCombo = newCombo + newBaseComboCount
  for (const id of items) {
    if (id === 'protection' && effectiveCombo < params.talismans.protection.c) {
      effectiveCombo = params.talismans.protection.c
    } else if (id === 'earth') {
      effectiveCombo += params.talismans.earth.c
    }
  }

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
    isPlayAction: true,
    playCountInChain: wave.chainOrigin.filter(o => o === 'play').length + 1,
    effectiveStairMinLen,
    effectiveSuitColorMinLen,
    sameColumnStreak: newSameColumnStreak,
    totalColumnsEmptiedThisWave: newTotalColumnsEmptiedThisWave,
    maxComboThisWave: newMaxComboThisWave,
    flushActiveThisCombo: newFlushActiveThisCombo,
    columnSweepActiveThisWave: newColumnSweepActiveThisWave,
    drawContinueCountThisChain: wave.drawContinueCountThisChain,
    mercyActiveNextCombo: wave.mercyActiveNextCombo,
  }

  const itemResult = applyItemEffects('gained', base, items, itemEffectCtx, params)
  parts.push(...itemResult.parts)

  const comboMultiplierStep = params.scoring.comboMultiplierStep
  const multiplier = 1 + effectiveCombo * comboMultiplierStep
  if (multiplier !== 1) parts.push(`コンボ倍率×${fmtMultiplier(multiplier)}`)
  const mannazFactor = wave.mannazActiveThisWave ? 1 + mannazWeightSum(items, params) * params.rites.mannaz.x : 1
  if (mannazFactor !== 1) parts.push(`マンナズ×${fmtMultiplier(mannazFactor)}`)
  let gained = Math.floor(itemResult.value * multiplier * mannazFactor)
  if (scoreLock && isBossScoreLocked(scoreLock, effectiveCombo, card)) {
    parts.push(bossScoreLockMessage(scoreLock))
    gained = 0
  }

  const scoreAfterGained = wave.score + gained

  // 護符gained+コンボ倍率適用後のスコアが確定した時点で目標に達していれば、
  // コンボ到達時の直接加算(流星等)や全消し判定を一切行わず、その時点のスコアで終了する。
  const targetReachedOnGained = scoreAfterGained >= target

  const milestoneCtx: DirectEffectContext = {
    comboBeforeReset: 0,
    hasPlayableColumns: true,
    roleFiredThisChain: newRoleFiredThisChain,
    remainingTableauCount: remaining,
    combo: newCombo,
    colorHeld: false,
    previousCombo: wave.combo,
    scoreAfterGained,
  }
  const milestoneResult = targetReachedOnGained
    ? { value: 0, parts: [] as string[] }
    : applyDirectEffects('comboMilestoneDirect', items, milestoneCtx, params)

  const newScore = scoreAfterGained + milestoneResult.value

  const bonusGains: BonusGain[] = []
  if (milestoneResult.parts.length > 0) {
    bonusGains.push({ label: '護符による直接加算', points: milestoneResult.value, parts: milestoneResult.parts })
  }

  const next: WaveState = {
    ...wave,
    tableau: newTableau,
    discardPile: wave.discardPile,
    foundation: card,
    combo: newCombo,
    chain: [...wave.chain, card],
    chainOrigin: [...wave.chainOrigin, 'play'],
    linked: true,
    columnsEmptiedThisCombo: newColumnsEmptied,
    // コンボが継続する間はこのスナップショットを維持する。列の残り枚数が変化しても、
    // 次にdrawStockでコンボがリセットされるまでは更新しない。
    comboStreakColumnLengths: wave.comboStreakColumnLengths,
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
    sweptColumnsThisCombo: newSweptColumnsThisCombo,
    sowiloBoostedRole: wave.sowiloBoostedRole ?? sowiloCommittedThisPlay,
  }

  // gained確定時点で目標達成なら、コンボ到達直接加算・全消し判定等を行わず即座に終了する。
  if (targetReachedOnGained) {
    return { wave: { ...next, status: 'ended', endReason: 'target' }, deckComposition }
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
    const waveAfterClearBonus: WaveState = { ...next, score: scoreAfterClear, lastBonusGains: bonusGainsWithClear }

    if (scoreAfterClear >= target) {
      return { wave: { ...waveAfterClearBonus, status: 'ended', endReason: 'target' }, deckComposition }
    }

    let resetWave = resetComboFields(waveAfterClearBonus, params)

    for (const id of items) {
      if (id === 'healing') {
        resetWave = resolveHealingRestoration(resetWave, waveAfterClearBonus.sweptColumnsThisCombo, rand)
      } else if (
        id === 'regeneration' &&
        remainingCount(resetWave.tableau) === 0 &&
        !resetWave.regenerationUsedThisWave &&
        resetWave.stock.length > 0
      ) {
        const cost = Math.floor(resetWave.score * params.talismans.regeneration.p / 100)
        const pool = [...resetWave.discardPile]
        shuffleInPlace(pool, rand)
        const reviveTotal = Math.min(params.layout.cols * rows, pool.length)
        let cursor = 0
        const revivedTableau: Card[][] = []
        for (let c = 0; c < params.layout.cols; c++) {
          const take = Math.min(rows, reviveTotal - cursor)
          revivedTableau.push(take > 0 ? pool.slice(cursor, cursor + take) : [])
          cursor += Math.max(take, 0)
        }
        resetWave = {
          ...resetWave,
          tableau: revivedTableau,
          discardPile: pool.slice(reviveTotal),
          comboStreakColumnLengths: revivedTableau.map(col => col.length),
          score: resetWave.score - cost,
          regenerationUsedThisWave: true,
        }
      }
    }

    if (remainingCount(resetWave.tableau) > 0) {
      if (resetWave.stock.length > 0) {
        return drawStock(params, resetWave, items, target, deckComposition, modifier, rand)
      }
      return { wave: resetWave, deckComposition }
    }

    return { wave: { ...resetWave, status: 'ended', endReason: 'fullClear' }, deckComposition }
  }

  if (newScore >= target) {
    return { wave: { ...next, status: 'ended', endReason: 'target' }, deckComposition }
  }

  return { wave: next, deckComposition }
}

export function drawStock(
  params: ShidasuParams,
  wave: WaveState,
  items: ItemId[],
  target: number,
  deckComposition: DeckCard[],
  modifier: StageModifier = 'none',
  rand: () => number = Math.random,
  scoreLock: BossScoreLock = null
): { wave: WaveState; deckComposition: DeckCard[] } {
  if (wave.status !== 'playing') return { wave, deckComposition }
  if (wave.stock.length === 0) return { wave, deckComposition }

  const newStock = [...wave.stock]
  const drawnCard = newStock.pop() as Card

  const effectiveStairMinLen = items.includes('bridge') ? params.scoring.stairMinLen - params.talismans.bridge.m : params.scoring.stairMinLen
  const effectiveSuitColorMinLen = items.includes('bridge') ? params.scoring.suitColorMinLen - params.talismans.bridge.m : params.scoring.suitColorMinLen
  const wouldContinue = wave.linked && chainContinuesPattern(params.scoring, wave.chain, drawnCard, effectiveStairMinLen, effectiveSuitColorMinLen)
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
      previousCombo: wave.combo,
      scoreAfterGained: wave.score,
    }
    stockEmptyResult = applyDirectEffects('stockEmptyDirect', items, stockEmptyCtx, params)
    scoreAfterStockEmpty += stockEmptyResult.value
  }

  // 山札切れ時の直接加算だけで目標に達したら、以降の得点計算を行わず即座に終了する。
  if (scoreAfterStockEmpty >= target) {
    // この分岐で発生する得点は慢心等の直接加算のみ。lastGain/lastBonusGainsを更新しないと
    // 直前プレイの古い内訳が残ってしまうため、他の即時終了箇所と同様に新しい値を明示的に設定する。
    const stockEmptyBonusGains: BonusGain[] =
      stockEmptyResult.parts.length > 0
        ? [{ label: '護符による直接加算', points: stockEmptyResult.value, parts: stockEmptyResult.parts }]
        : []
    return {
      wave: {
        ...wave,
        stock: newStock,
        score: scoreAfterStockEmpty,
        lastGain: null,
        lastBonusGains: stockEmptyBonusGains,
        status: 'ended',
        endReason: 'target',
      },
      deckComposition,
    }
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
      previousCombo: wave.combo,
      scoreAfterGained: wave.score,
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
      const newCombo = wave.comboFrozenThisWave ? wave.combo : wave.combo + (items.includes('golden') ? 2 : 1)
      let base = params.scoring.basePoint
      const parts = [`基礎点+${base}`]
      // 神託: このパスは明星・ソウィロによる役倍率(roleBonusMultiplier)を通さない既存方針を維持しつつ、
      // 神託レベルは永続的な基礎点の一部として引き続き適用する
      const oracleLevel = (name: RoleName): number => wave.oracleLevels[name] ?? 1
      const chainResult = evaluateChainBonus(params.scoring, wave.chain, drawnCard, effectiveStairMinLen, undefined, effectiveSuitColorMinLen, oracleLevel)
      base += chainResult.bonus
      parts.push(...chainResult.parts)
      naiveRoleFiredThisChain = wave.roleFiredThisChain || chainResult.roleFired.length > 0
      naiveFlushActiveThisCombo = wave.flushActiveThisCombo || chainResult.roleFired.some(r => r.name === 'flush')
      // 基礎コンボ数は計算用のコンボ数に常に加算する(素朴パスでは祝福による基礎コンボ数の増加は発生しない)。
      let effectiveCombo = newCombo + wave.baseComboCount
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
        isPlayAction: false,
        playCountInChain: wave.chainOrigin.filter(o => o === 'play').length,
        effectiveStairMinLen,
        effectiveSuitColorMinLen,
        sameColumnStreak: wave.sameColumnStreak,
        totalColumnsEmptiedThisWave: wave.totalColumnsEmptiedThisWave,
        maxComboThisWave: Math.max(wave.maxComboThisWave, newCombo),
        flushActiveThisCombo: naiveFlushActiveThisCombo,
        columnSweepActiveThisWave: wave.columnSweepActiveThisWave,
        drawContinueCountThisChain: newDrawContinueCount,
        mercyActiveNextCombo: wave.mercyActiveNextCombo,
      }
      const itemResult = applyItemEffects('gained', base, items, naiveCtx, params)
      parts.push(...itemResult.parts)

      const comboMultiplierStep = params.scoring.comboMultiplierStep
      const multiplier = 1 + effectiveCombo * comboMultiplierStep
      if (multiplier !== 1) parts.push(`コンボ倍率×${fmtMultiplier(multiplier)}`)
      const mannazFactor = wave.mannazActiveThisWave ? 1 + mannazWeightSum(items, params) * params.rites.mannaz.x : 1
      if (mannazFactor !== 1) parts.push(`マンナズ×${fmtMultiplier(mannazFactor)}`)
      naiveGained = Math.floor(itemResult.value * multiplier * mannazFactor)
      if (scoreLock && isBossScoreLocked(scoreLock, effectiveCombo, drawnCard)) {
        parts.push(bossScoreLockMessage(scoreLock))
        naiveGained = 0
      }
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

    const continueWave: WaveState = {
      ...wave,
      stock: items.includes('promise') ? arrangeNextCardForContinuation(params.scoring, newStock, [...wave.chain, drawnCard], effectiveStairMinLen, effectiveSuitColorMinLen) : newStock,
      foundation: drawnCard,
      combo: naiveCombo,
      chain: [...wave.chain, drawnCard],
      chainOrigin: [...wave.chainOrigin, 'draw'],
      linked: true,
      lastDrawEffect: drawnCard.wild ? 'wild' : 'pattern',
      lastGain: naiveParts.length > 0 ? { points: naiveGained, parts: naiveParts } : null,
      score: scoreAfterStockEmpty + directGain + naiveGained,
      drawContinueCountThisChain: newDrawContinueCount,
      benevolenceUsedThisCombo: benevolenceFires ? true : wave.benevolenceUsedThisCombo,
      maxComboThisWave: Math.max(wave.maxComboThisWave, naiveCombo),
      roleFiredThisChain: naiveRoleFiredThisChain,
      flushActiveThisCombo: naiveFlushActiveThisCombo,
      lastBonusGains: patternContinueBonusGains,
    }

    // パターン継続分のスコア確定後、目標に達していれば即座に終了する。
    if (continueWave.score >= target) {
      return { wave: { ...continueWave, status: 'ended', endReason: 'target' }, deckComposition }
    }

    return { wave: continueWave, deckComposition }
  }

  // combo: 0 を明示するのは、faceLock(絵札はコンボ2以上でのみ取得可)を正しく評価するため。
  // ここはリセット後の状態を先読みして判定しており、実際にリセットが起きた後のcomboは常に0になる。
  const hasPlayableColumns = getPlayableColumns(modifier, { ...wave, foundation: drawnCard, combo: 0 }).size > 0
  const silenceFires = !hasPlayableColumns && items.includes('silence')
  const card = silenceFires ? { ...drawnCard, wild: true } : drawnCard
  const newDeckComposition = silenceFires ? convertCardToWildByDeckId(deckComposition, drawnCard.deckId) : deckComposition

  const resetCtx: DirectEffectContext = {
    comboBeforeReset: wave.combo,
    hasPlayableColumns,
    roleFiredThisChain: wave.roleFiredThisChain,
    remainingTableauCount: remainingCount(wave.tableau),
    combo: wave.combo,
    colorHeld: false,
    previousCombo: wave.combo,
    scoreAfterGained: wave.score,
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

  let resetWave: WaveState = {
    ...resetComboFields(wave, params, card, 'draw'),
    stock: items.includes('promise') ? arrangeNextCardForContinuation(params.scoring, newStock, [card], effectiveStairMinLen, effectiveSuitColorMinLen) : newStock,
    lastDrawEffect: null,
    lastGain: null,
    score: scoreAfterStockEmpty + resetDirectGain,
    lastBonusGains: resetBonusGains,
  }

  // コンボリセット時の直接加算だけで目標に達していれば、治癒等の後続処理を行わず即座に終了する。
  if (resetWave.score >= target) {
    return { wave: { ...resetWave, status: 'ended', endReason: 'target' }, deckComposition: newDeckComposition }
  }

  if (items.includes('healing')) {
    resetWave = resolveHealingRestoration(resetWave, wave.sweptColumnsThisCombo, rand)
  }

  return {
    wave: resetWave,
    deckComposition: newDeckComposition,
  }
}

// 各ステージの最終ウェーブ(ボスウェーブ)かどうかを返す。
export function isBossWave(params: ShidasuParams, waveIndex: number): boolean {
  return waveIndex === params.flow.wavesPerStage - 1
}

// stageIndexから、そのステージのボス階級を返す(0=小凶,1=中凶,2=大凶)。stageIndexは
// 無制限に増加するため、3で割った余りで階級を決定する(3ステージごとに小凶→中凶→大凶を繰り返す)。
export function bossTierOf(stageIndex: number): 0 | 1 | 2 {
  return (stageIndex % 3) as 0 | 1 | 2
}

// そのウェーブで適用されるisPlayable用の修飾子を返す(currentBossKindがnoLoop/faceLockの
// ボスウェーブでのみ有効。中凶・大凶相当のkindはisPlayableの可否には影響しないため、
// ここでは扱わない=bossScoreLockForを使う)。
export function stageModifierFor(params: ShidasuParams, run: RunState): StageModifier {
  if (!isBossWave(params, run.waveIndex)) return 'none'
  if (run.currentBossKind === 'noLoop') return 'noLoop'
  if (run.currentBossKind === 'faceLock') return 'faceLock'
  return 'none'
}

// そのウェーブで適用される得点ロックを返す。currentBossKindの値そのものが挙動を決める。
// suitで対象スートが未確定(currentGreatMisfortuneSuitがnull)の場合はロック無しとして扱う
// (実際にはsuitが選ばれた瞬間に必ず確定させるため、通常はnullにならない)。
export function bossScoreLockFor(params: ShidasuParams, run: RunState): BossScoreLock {
  if (!isBossWave(params, run.waveIndex)) return null
  const tierLabelFor = (bossKind: BossKind) => params.bossTiers[params.bosses[bossKind].tier].name
  switch (run.currentBossKind) {
    case 'lowCombo': return { kind: 'combo', maxCombo: params.bosses.lowCombo.maxCombo, tierLabel: tierLabelFor('lowCombo') }
    case 'oddCombo': return { kind: 'oddCombo', tierLabel: tierLabelFor('oddCombo') }
    case 'suit': return run.currentGreatMisfortuneSuit ? { kind: 'suit', suit: run.currentGreatMisfortuneSuit, tierLabel: tierLabelFor('suit') } : null
    case 'face': return { kind: 'face', tierLabel: tierLabelFor('face') }
    default: return null
  }
}

// ラン開始からの通しウェーブ番号(1始まり)から目標スコアを算出する。
// target(n) = waveTargetBase × waveTargetMultiplier^(n-1)
export function waveTarget(params: ShidasuParams, stageIndex: number, waveIndex: number, spreadId: SpreadId = 'fool'): number {
  const overallWaveNumber = stageIndex * params.flow.wavesPerStage + waveIndex + 1
  const spread = params.spreads[spreadId]
  return Math.floor(spread.waveTargetBase * spread.waveTargetMultiplier ** (overallWaveNumber - 1))
}

const GREAT_MISFORTUNE_SUITS: Suit[] = ['♠', '♥', '♦', '♣']
const BOSS_TIER_KEYS: BossTierKey[] = ['shoukyou', 'chuukyou', 'taikyou']
const BOSS_KINDS: BossKind[] = ['noLoop', 'faceLock', 'lowCombo', 'oddCombo', 'suit', 'face']

// 大凶ステージの対象スートを、既存のrand(シード連動PRNG)を使って抽選する。
// 将来「ラン開始時にシードを指定してステージ構成を再現する」機能に対応できるよう、
// Math.random()を直接使わずこの関数経由で必ずrandを通すこと。
function rollGreatMisfortuneSuit(rand: () => number): Suit {
  return GREAT_MISFORTUNE_SUITS[Math.floor(rand() * GREAT_MISFORTUNE_SUITS.length)]
}

// stageIndexが属する階級(bossTierOf)に現在割り当てられている候補群の中から、randで1つ抽選する。
// 候補が1件も無い階級は管理画面のバリデーションで基本的に発生しないが、念のためnullを返す。
function rollBossKindForStage(params: ShidasuParams, stageIndex: number, rand: () => number): BossKind | null {
  const tierKey = BOSS_TIER_KEYS[bossTierOf(stageIndex)]
  const candidates = BOSS_KINDS.filter(kind => params.bosses[kind].tier === tierKey)
  if (candidates.length === 0) return null
  return candidates[Math.floor(rand() * candidates.length)]
}

// 現在のstageIndexから次のウェーブの(stageIndex, waveIndex)を算出する。
// waveIndexがwavesPerStageに達したら次のステージ(stageIndex+1・waveIndex0)へ繰り上がる。
function nextWaveLocation(params: ShidasuParams, run: RunState): { stageIndex: number; waveIndex: number } {
  const nextWaveIndex = run.waveIndex + 1
  if (nextWaveIndex >= params.flow.wavesPerStage) {
    return { stageIndex: run.stageIndex + 1, waveIndex: 0 }
  }
  return { stageIndex: run.stageIndex, waveIndex: nextWaveIndex }
}

// 次のウェーブ位置に応じたcurrentBossKindを算出する。同じステージ内に留まる場合は現在の値を
// 維持し、新しいステージに入る場合はそのステージの階級に属する候補群からrandで新規抽選する。
function nextBossKind(
  params: ShidasuParams,
  run: RunState,
  newLocation: { stageIndex: number; waveIndex: number },
  rand: () => number
): BossKind | null {
  if (newLocation.stageIndex === run.stageIndex) return run.currentBossKind
  return rollBossKindForStage(params, newLocation.stageIndex, rand)
}

// 次のウェーブ位置・次のcurrentBossKindに応じたcurrentGreatMisfortuneSuitを算出する。
// 同じステージ内に留まる場合は現在の値を維持し、新しいステージに入る場合はnewBossKindが
// 'suit'のときのみrandで新規抽選し、それ以外はnullにする。
function nextGreatMisfortuneSuit(
  run: RunState,
  newLocation: { stageIndex: number; waveIndex: number },
  newBossKind: BossKind | null,
  rand: () => number
): Suit | null {
  if (newLocation.stageIndex === run.stageIndex) return run.currentGreatMisfortuneSuit
  return newBossKind === 'suit' ? rollGreatMisfortuneSuit(rand) : null
}

export function isStuck(modifier: StageModifier, wave: WaveState, rites: RiteId[] = []): boolean {
  const remaining = remainingCount(wave.tableau)
  if (remaining === 0) return false
  if (wave.stock.length > 0) return false
  if (getPlayableColumns(modifier, wave).size > 0) return false
  // ダガズ(山札と捨て札を合流してシャッフルし新しい山札にする秘儀)を所持しており、
  // 捨て札が実際にあれば、使用すれば山札が復活するため手詰まりとしない
  if (rites.includes('dagaz') && wave.discardPile.length > 0) return false
  return true
}

export function markStuck(wave: WaveState): WaveState {
  if (wave.status !== 'playing') return wave
  return { ...wave, status: 'ended', endReason: 'stuck' }
}

export function createInitialRun(): RunState {
  return {
    phase: 'title', stageIndex: 0, waveIndex: 0, items: [], offer: [], wave: null, pendingNewItem: null,
    deckComposition: standardDeckComposition(), rites: [], revelations: [], revelationOffer: [], extraTableauRows: 0,
    oracleLevels: defaultOracleLevels(), oracleOffer: [], currentGreatMisfortuneSuit: null, spreadId: 'fool',
    currentBossKind: null,
  }
}

export function beginRun(params: ShidasuParams, seed?: number, spreadId: SpreadId = 'fool'): RunState {
  const initialExtraTableauRows = params.spreads[spreadId].initialExtraTableauRows
  const rand = createRng(seed ?? Math.floor(Math.random() * 999999) + 1)
  const initialBossKind = rollBossKindForStage(params, 0, rand)
  const { wave, deckComposition } = startWave(params, 0, 0, [], standardDeckComposition(), seed, initialExtraTableauRows, defaultOracleLevels())
  return {
    phase: 'playing',
    stageIndex: 0,
    waveIndex: 0,
    items: [],
    offer: [],
    wave,
    pendingNewItem: null,
    deckComposition,
    rites: [],
    revelations: [],
    revelationOffer: [],
    extraTableauRows: initialExtraTableauRows,
    oracleLevels: defaultOracleLevels(),
    oracleOffer: [],
    currentGreatMisfortuneSuit: null,
    spreadId,
    currentBossKind: initialBossKind,
  }
}

export function resolveWaveEnd(params: ShidasuParams, run: RunState, rand: () => number = Math.random): RunState {
  const wave = run.wave
  if (!wave || wave.status !== 'ended') return run

  const target = waveTarget(params, run.stageIndex, run.waveIndex, run.spreadId)
  if (wave.score < target) {
    return { ...run, phase: 'gameOver' }
  }

  // 大凶(各サイクルの最終ウェーブ)クリア時のみ、護符等の選択を後回しにして続行確認を挟む。
  // それ以外(小凶・中凶のボスウェーブを含む通常のウェーブクリア)は、すべて同じitemSelectへ進む。
  if (isBossWave(params, run.waveIndex) && bossTierOf(run.stageIndex) === 2) {
    return { ...run, phase: 'continueChoice' }
  }
  return { ...run, phase: 'itemSelect', offer: rollItemOffer(run.items, rand), pendingNewItem: null }
}

// 秘儀を1つ使用する。効果を適用し、所持からその秘儀を1個削除する。
// 使用条件(canUseRite)を満たさない場合、または所持していない場合は何もしない。
export function useRite(params: ShidasuParams, run: RunState, riteId: RiteId, rand: () => number = Math.random): RunState {
  if ((run.phase !== 'playing' && run.phase !== 'revelationSelect') || !run.wave || run.wave.status !== 'playing') return run
  if (!canUseRite(params, run.wave, riteId)) return run
  const idx = run.rites.indexOf(riteId)
  if (idx === -1) return run
  const wave = applyRiteEffect(params, run.wave, riteId, rand)
  const rites = [...run.rites.slice(0, idx), ...run.rites.slice(idx + 1)]
  return { ...run, wave, rites }
}

// 護符選択解決後、天啓選択画面(プレビュー用ウェーブ)へ遷移する共通処理。
// この時点でのdeckComposition・extraTableauRowsから、通常のウェーブ開始と同じロジックで
// プレビュー用のウェーブを配る(天啓・秘儀のターゲットとして使うためだけの仮のウェーブで、
// 天啓選択画面を終えると改めて実際のウェーブを配り直す。詳細はfinishRevelationSelect)。
function enterRevelationSelect(
  params: ShidasuParams,
  run: RunState,
  newItems: ItemId[],
  newRites: RiteId[],
  seed: number | undefined,
  rand: () => number
): RunState {
  const newLocation = nextWaveLocation(params, run)
  const newBossKind = nextBossKind(params, run, newLocation, rand)
  const newGreatMisfortuneSuit = nextGreatMisfortuneSuit(run, newLocation, newBossKind, rand)
  const { wave, deckComposition } = startWave(params, newLocation.stageIndex, newLocation.waveIndex, newItems, run.deckComposition, seed, run.extraTableauRows, run.oracleLevels)
  return {
    ...run,
    phase: 'revelationSelect',
    items: newItems,
    rites: newRites,
    stageIndex: newLocation.stageIndex,
    waveIndex: newLocation.waveIndex,
    currentGreatMisfortuneSuit: newGreatMisfortuneSuit,
    currentBossKind: newBossKind,
    offer: [],
    pendingNewItem: null,
    wave,
    deckComposition,
    revelationOffer: rollRevelationOffer(rand),
  }
}

// 天啓選択画面を終了し、その時点のdeckComposition・extraTableauRowsから実際のウェーブを
// 新しく配り直してプレイ画面へ進む。
function finishRevelationSelect(params: ShidasuParams, run: RunState, seed?: number, rand: () => number = Math.random): RunState {
  const { wave, deckComposition } = startWave(params, run.stageIndex, run.waveIndex, run.items, run.deckComposition, seed, run.extraTableauRows, run.oracleLevels)
  return {
    ...run,
    phase: 'oracleSelect',
    wave,
    deckComposition,
    revelationOffer: [],
    oracleOffer: rollOracleOffer(rand),
  }
}

export function pickItem(params: ShidasuParams, run: RunState, itemId: ItemId, seed?: number, rand: () => number = Math.random): RunState {
  if (run.phase !== 'itemSelect') return run
  if (run.items.length >= params.items.maxItems) {
    return { ...run, pendingNewItem: itemId }
  }
  const newItems = [...run.items, itemId]
  const rolledRite = rollRite(run.rites, rand)
  const newRites = rolledRite ? [...run.rites, rolledRite] : run.rites
  return enterRevelationSelect(params, run, newItems, newRites, seed, rand)
}

export function confirmItemSwap(params: ShidasuParams, run: RunState, oldItemId: ItemId, seed?: number, rand: () => number = Math.random): RunState {
  if (run.phase !== 'itemSelect' || run.pendingNewItem === null) return run
  const idx = run.items.indexOf(oldItemId)
  const remaining = idx === -1 ? [...run.items] : [...run.items.slice(0, idx), ...run.items.slice(idx + 1)]
  const newItems = [...remaining, run.pendingNewItem]
  const rolledRite = rollRite(run.rites, rand)
  const newRites = rolledRite ? [...run.rites, rolledRite] : run.rites
  return enterRevelationSelect(params, run, newItems, newRites, seed, rand)
}

export function cancelItemSwap(run: RunState): RunState {
  if (run.phase !== 'itemSelect') return run
  return { ...run, pendingNewItem: null }
}

export function skipItemSelect(params: ShidasuParams, run: RunState, seed?: number, rand: () => number = Math.random): RunState {
  if (run.phase !== 'itemSelect') return run
  return enterRevelationSelect(params, run, run.items, run.rites, seed, rand)
}

// 所持中の天啓を1つ使用する(消費される)。プレイ中・天啓選択画面のどちらでも動作し、
// フェーズは変えない(秘儀のuseRiteと同じ位置づけ)。
export function useRevelation(
  params: ShidasuParams,
  run: RunState,
  revelationId: RevelationId,
  targetCol: number | null,
  rand: () => number = Math.random
): RunState {
  if ((run.phase !== 'playing' && run.phase !== 'revelationSelect') || !run.wave || run.wave.status !== 'playing') return run
  const idx = run.revelations.indexOf(revelationId)
  if (idx === -1) return run
  if (!canUseRevelation(params, run.wave, revelationId)) return run
  const { wave, deckComposition } = applyRevelationEffect(params, run.wave, run.deckComposition, revelationId, targetCol, rand)
  const extraTableauRows = revelationId === 'kyo' ? run.extraTableauRows + params.revelations.kyo.n : run.extraTableauRows
  const revelations = [...run.revelations.slice(0, idx), ...run.revelations.slice(idx + 1)]
  return { ...run, wave, deckComposition, revelations, extraTableauRows }
}

// 天啓選択画面のオファーから選んだものをその場で使用する(所持には加わらない)。
// 使用後、実際のウェーブを配り直してプレイ画面へ進む。
export function useRevelationFromOffer(
  params: ShidasuParams,
  run: RunState,
  revelationId: RevelationId,
  targetCol: number | null,
  seed?: number,
  rand: () => number = Math.random
): RunState {
  if (run.phase !== 'revelationSelect' || !run.wave) return run
  if (!run.revelationOffer.includes(revelationId)) return run
  if (!canUseRevelation(params, run.wave, revelationId)) return run
  const { wave, deckComposition } = applyRevelationEffect(params, run.wave, run.deckComposition, revelationId, targetCol, rand)
  const extraTableauRows = revelationId === 'kyo' ? run.extraTableauRows + params.revelations.kyo.n : run.extraTableauRows
  return finishRevelationSelect(params, { ...run, deckComposition, extraTableauRows }, seed, rand)
}

// 天啓選択画面のオファーから選んだものを所持へ加える(所持上限2に達している間は何もしない)。
// 実際のウェーブを配り直してプレイ画面へ進む。
export function pickRevelationFromOffer(params: ShidasuParams, run: RunState, revelationId: RevelationId, seed?: number, rand: () => number = Math.random): RunState {
  if (run.phase !== 'revelationSelect') return run
  if (!run.revelationOffer.includes(revelationId)) return run
  if (run.revelations.length >= 2) return run
  const revelations = [...run.revelations, revelationId]
  return finishRevelationSelect(params, { ...run, revelations }, seed, rand)
}

// 天啓を使用・獲得せずに天啓選択画面を終了する。
export function skipRevelationSelect(params: ShidasuParams, run: RunState, seed?: number, rand: () => number = Math.random): RunState {
  if (run.phase !== 'revelationSelect') return run
  return finishRevelationSelect(params, run, seed, rand)
}

// 神託選択画面のオファーから1つ選ぶと、対応する役のレベルが+1され、即座にplayingへ遷移する。
// 天啓と異なり所持・ウェーブ再配布の概念は無く、実ウェーブは変更しない。paramsに依存する処理が
// 無いため(useRevelationFromOffer等と異なりparamsを使う効果適用が無い)、引数に含めない。
// 既に配られている実ウェーブ(finishRevelationSelectで確定済み)のwave.oracleLevelsは
// デッキ内容と違い「配布時に固定される値」ではなく、得点計算の都度参照される値のため、
// run.oracleLevels側だけでなくwave.oracleLevels側も同じ新しい値に更新する。これを怠ると、
// 常時表示エリア(run.oracleLevels参照)ではレベルが上がって見えるのに、選んだそのウェーブの
// 実際のプレイ(wave.oracleLevels参照)には反映されない(次のウェーブまで効果が遅延する)
// 不整合が起きる。
export function pickOracleFromOffer(run: RunState, roleName: RoleName): RunState {
  if (run.phase !== 'oracleSelect') return run
  if (!run.oracleOffer.includes(roleName)) return run
  const oracleLevels = { ...run.oracleLevels, [roleName]: run.oracleLevels[roleName] + 1 }
  const wave = run.wave ? { ...run.wave, oracleLevels } : run.wave
  return { ...run, phase: 'playing', oracleLevels, oracleOffer: [], wave }
}

// 神託を選ばずに神託選択画面を終了する。
export function skipOracleSelect(run: RunState): RunState {
  if (run.phase !== 'oracleSelect') return run
  return { ...run, phase: 'playing', oracleOffer: [] }
}

// 大凶クリア後の続行確認画面('continueChoice'フェーズ)で「続ける」を選んだ場合。
// 通常のウェーブクリアと同じくitemSelectへ進む(以後のステージ繰り上がり・大凶スート抽選は
// pickItem等が呼ぶenterRevelationSelectが担う)。所持中の護符・秘儀・天啓・神託レベルは
// このrunをそのまま引き継ぐため、リセットされない。
export function continueAfterGreatMisfortune(params: ShidasuParams, run: RunState, rand: () => number = Math.random): RunState {
  if (run.phase !== 'continueChoice') return run
  return { ...run, phase: 'itemSelect', offer: rollItemOffer(run.items, rand), pendingNewItem: null }
}

// 大凶クリア後の続行確認画面で「やめる」を選んだ場合。結果画面(allClear)へ遷移する。
export function stopAfterGreatMisfortune(run: RunState): RunState {
  if (run.phase !== 'continueChoice') return run
  return { ...run, phase: 'allClear' }
}

export function restartRun(params: ShidasuParams, seed?: number): RunState {
  return beginRun(params, seed)
}

export function applyPlayCard(params: ShidasuParams, run: RunState, colIndex: number, rand: () => number = Math.random, rowIndex?: number): RunState {
  if (run.phase !== 'playing' || !run.wave) return run
  const target = waveTarget(params, run.stageIndex, run.waveIndex, run.spreadId)
  const modifier = stageModifierFor(params, run)
  const scoreLock = bossScoreLockFor(params, run)
  const { wave, deckComposition } = playCard(params, run.wave, modifier, run.items, target, colIndex, run.deckComposition, rand, scoreLock, rowIndex)
  return { ...run, wave, deckComposition }
}

export function applyDrawStock(params: ShidasuParams, run: RunState, rand: () => number = Math.random): RunState {
  if (run.phase !== 'playing' || !run.wave) return run
  const target = waveTarget(params, run.stageIndex, run.waveIndex, run.spreadId)
  const modifier = stageModifierFor(params, run)
  const scoreLock = bossScoreLockFor(params, run)
  const { wave, deckComposition } = drawStock(params, run.wave, run.items, target, run.deckComposition, modifier, rand, scoreLock)
  return { ...run, wave, deckComposition }
}

// 手詰まり判定と、手詰まり時の護符(治癒・不屈)による救済処理を行う。
// 不屈: コンボリセットしチェーンのカードを捨て札へ送った上で、スコアの一定割合を消費して
// 捨て札の約半数を山札へ戻す。その後、山札を1枚捲って(drawStockと同じロジック)手詰まりを回避する。
// ウェーブ中1回のみ発動する。発動条件を満たさなければ通常通り手詰まり終了とする。
export function applyStuckCheck(params: ShidasuParams, run: RunState, rand: () => number = Math.random): RunState {
  if (run.phase !== 'playing' || !run.wave) return run
  const modifier = stageModifierFor(params, run)
  const wave = run.wave
  if (!isStuck(modifier, wave, run.rites)) return run

  let resetWave = resetComboFields(wave, params)

  for (const id of run.items) {
    if (id === 'healing') {
      resetWave = resolveHealingRestoration(resetWave, wave.sweptColumnsThisCombo, rand)
    } else if (id === 'resilience' && resetWave.discardPile.length > 0 && !resetWave.resilienceUsedThisWave) {
      const pool = [...resetWave.discardPile]
      shuffleInPlace(pool, rand)
      const reviveCount = Math.max(1, Math.ceil(pool.length / 2))
      const revived = pool.slice(0, reviveCount)
      const cost = Math.floor(resetWave.score * params.talismans.resilience.p / 100)
      resetWave = {
        ...resetWave,
        score: resetWave.score - cost,
        stock: [...resetWave.stock, ...revived],
        discardPile: pool.slice(reviveCount),
        resilienceUsedThisWave: true,
      }
    }
  }

  if (resetWave.stock.length > 0) {
    const stageTarget = waveTarget(params, run.stageIndex, run.waveIndex, run.spreadId)
    const scoreLock = bossScoreLockFor(params, run)
    const drawResult = drawStock(params, resetWave, run.items, stageTarget, run.deckComposition, modifier, rand, scoreLock)
    return { ...run, wave: drawResult.wave, deckComposition: drawResult.deckComposition }
  }

  return { ...run, wave: markStuck(resetWave) }
}

let debugCardIdSeq = 900000

// デバッグパネル専用: 山札の一番上(次にめくられる札)を指定カードに差し替える。
// idは既存デッキ(最大でも数百枚程度)と衝突しないよう90万番台から発番する。
export function forceStockTop(wave: WaveState, suit: Suit, rank: Rank, wild: boolean): WaveState {
  // deckComposition由来ではない合成カードのため、実在しない値(-1)をdeckIdとして設定する
  const card: Card = { id: ++debugCardIdSeq, deckId: -1, suit, rank, wild }
  const newStock = wave.stock.length === 0 ? [card] : [...wave.stock.slice(0, -1), card]
  return { ...wave, stock: newStock }
}
