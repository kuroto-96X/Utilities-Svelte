// src/lib/game/shidasu/engine.ts
import type { Card, StageModifier, WaveState, ItemId, WaveEndReason, RunState, Suit, Rank, DeckCard, RoleName, RiteId, Rarity, RevelationId, SpreadId, RunPhase, HeldRevelationOrOracleRef, HeldItem, HeldRite, HeldRevelation, HeldOracle, Star, StarRestriction, CardSetGenreId, RelicId, StarSabotage, SabotageActionId, ShopState } from './types'
import type { ShidasuParams } from './params'
import { createRng, shuffle, shuffleInPlace, standardDeckComposition, addCardsToDeckComposition, rollOffer } from './deck'
import { rollSabotage } from './sabotage'
import { isFace, chainContinuesPattern, evaluateChainBonus, countSameRankBefore, countSameRankForWildPlay, cardColors } from './patterns'
import { addPart, multiplyPart, lockPart, type ScorePart } from './scoreParts'
import { rollItemOffer, ITEM_POOL } from './items'
import { applyItemEffects, type ItemEffectContext } from './itemEffects'
import { applyRiteEffect, canUseRite } from './riteEffects'
import { rollRiteOffer } from './rites'
import { rollRevelationOffer, REVELATION_POOL } from './revelations'
import { applyRevelationEffect, canUseRevelation } from './revelationEffects'
import { rollOracleOffer, defaultOracleLevels, ORACLE_POOL } from './oracles'
import { rollCardSetOffer } from './cardSets'
import { rollShop, itemBuyPrice, itemSellPrice, riteBuyPrice, riteSellPrice, revelationBuyPrice, revelationSellPrice, oracleBuyPrice, oracleSellPrice, relicBuyPrice } from './shop'
import { itemMaxCapacity, riteMaxCapacity, revelationOracleMaxCapacity, relicWaveEndBonus, relicRerollCostStep, relicFirstRerollFree, RELIC_POOL } from './relics'
import { resetComboFields } from './waveReset'
import { applySabotageEffect } from './sabotageEffects'
import { resolvePlayTriggeredRewardTalismans, type RewardTalismanTriggerResult, type PlayTriggerContext } from './rewardTalismanEffects'

const RANK_LABEL: Record<number, string> = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }

export function rankLabel(card: Card): string {
  if (card.wild) return '★'
  return RANK_LABEL[card.rank] ?? String(card.rank)
}

export function isPlayable(modifier: StageModifier, wave: WaveState, card: Card, items: ItemId[] = []): boolean {
  // faceLockはワイルド(場札含む)より優先して評価する: ワイルド場札でも絵札はコンボ不足なら拒否する
  if (modifier === 'faceLock' && isFace(card) && wave.combo < 2) return false
  if (card.wild || wave.foundation.wild) return true
  const d = Math.abs(card.rank - wave.foundation.rank)
  const rankOk = d === 1 || (d === 12 && modifier !== 'noLoop') ||
    (wave.ehwazActiveThisWave && (d === 2 || (d === 11 && modifier !== 'noLoop')))
  if (!rankOk) return false

  // 誓約・契り: チェーンの最新実カードと色/スートが一致しなければ取れない(チェーンが空なら制約なし)
  const lastChainCard = wave.chain[wave.chain.length - 1]
  if (lastChainCard && !lastChainCard.wild) {
    if (items.includes('vow')) {
      const lastColors = cardColors(lastChainCard, items)
      const cardCol = cardColors(card, items)
      const colorMatches = (lastColors.red && cardCol.red) || (lastColors.black && cardCol.black)
      if (!colorMatches) return false
    }
    if (items.includes('pact') && !card.wild && lastChainCard.suit !== card.suit) {
      return false
    }
  }

  return true
}

// アルギズ発動中は列内の全カードが、それ以外は一番上のカードのみがプレイ対象になる。
// 対象カードのうち実際にisPlayableを満たす行インデックスの集合を返す(判定基準自体は変わらない)。
export function getPlayableRowsInColumn(modifier: StageModifier, wave: WaveState, colIndex: number, items: ItemId[] = []): Set<number> {
  const col = wave.tableau[colIndex]
  const result = new Set<number>()
  if (!col || col.length === 0) return result
  if (wave.playFromAnywhereActiveThisWave) {
    col.forEach((c, ri) => {
      if (isPlayable(modifier, wave, c, items)) result.add(ri)
    })
  } else {
    const topIndex = col.length - 1
    if (isPlayable(modifier, wave, col[topIndex], items)) result.add(topIndex)
  }
  return result
}

export function getPlayableColumns(modifier: StageModifier, wave: WaveState, items: ItemId[] = []): Set<number> {
  const result = new Set<number>()
  wave.tableau.forEach((col, i) => {
    if (getPlayableRowsInColumn(modifier, wave, i, items).size > 0) result.add(i)
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
  const candidates = composition.map((c, i) => i).filter(i => !composition[i].wild && !composition[i].removed)
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
function arrangeNextCardForContinuation(scoring: ShidasuParams['scoring'], stock: Card[], chain: Card[], stairMinLen: number, suitColorMinLen: number = scoring.suitColorMinLen, items: ItemId[] = []): Card[] {
  if (stock.length === 0) return stock
  const lastIndex = stock.length - 1
  for (let i = 0; i <= lastIndex; i++) {
    if (chainContinuesPattern(scoring, chain, stock[i], stairMinLen, suitColorMinLen, items)) {
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
  oracleLevels: Record<RoleName, number> = defaultOracleLevels(),
  dedicationX: number = 1,
  diligenceX: number = 1,
  divineProtectionX: number = 1,
  discretionN: number = 10,
  frostX: number = 1,
  echoX: number = 1,
  shootingStarN: number = 50,
  sabotage: StarSabotage = { kind: 'none' }
): { wave: WaveState; deckComposition: DeckCard[] } {
  const rand = createRng(seed ?? Math.floor(Math.random() * 999999) + 1)
  let idSeq = 0
  const nextId = () => ++idSeq

  let composition = deckComposition
  if (items.includes('eternity')) {
    // deckIdは既存エントリと重複しないよう、現在の配列長を新規idとして採番する(deckComposition
    // からエントリが削除されることは無いため、長さは単調増加でありidが枯渇・衝突することはない)
    composition = [...composition, { deckId: composition.length, suit: '★', rank: 0 as Rank, wild: true, removed: false }]
  }
  if (items.includes('abundance')) {
    composition = convertRandomCardToWild(composition, rand)
  }

  const deck = shuffle(composition.filter(c => !c.removed).map(c => ({ id: nextId(), ...c })), rand)
  const { cols } = params.layout
  const rows = params.layout.rows + extraTableauRows
  const tableau: Card[][] = []
  for (let c = 0; c < cols; c++) {
    tableau.push(deck.splice(0, rows))
  }
  const foundation = deck.pop() as Card
  const { effectiveStairMinLen: effectiveStairMinLenAtDeal, effectiveSuitColorMinLen: effectiveSuitColorMinLenAtDeal } = resolveBridgeAdjustedLengths(params, items)
  const stockAfterDeal = items.includes('promise')
    ? arrangeNextCardForContinuation(params.scoring, deck, [foundation], effectiveStairMinLenAtDeal, effectiveSuitColorMinLenAtDeal, items)
    : deck

  // 剛毅: Wave開始時、山札+場札の合計枚数(deckComposition.length、ワイルド生成後の値)が
  // n枚ごとに基礎コンボ数+1する
  const fortitudeBaseCombo = items.includes('fortitude')
    ? Math.floor(composition.filter(c => !c.removed).length / params.talismans.fortitude.n)
    : 0

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
    firstPlayDone: false,
    playCountThisWave: 0,
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
    baseComboCount: fortitudeBaseCombo,
    dedicationX,
    diligenceX,
    divineProtectionX,
    discretionN,
    frostX,
    echoX,
    shootingStarN,
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
    nextPlayScoreMultiplier: 1,
    oracleLevels,
    ...rollSabotage(params, sabotage, rand),
    activeSeal: null,
  }

  return { wave, deckComposition: composition }
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

// role封印・revelationOrOracle封印(オラクル選択時)によって、playCard/drawStockが役ボーナス・
// 神託レベルの計算をどう扱うかを表す。zeroRolesに含まれる役はレベル0(=無効)扱い、
// oracleBaselineRoleに一致する役はレベル1(封印前の基準値)扱いになる。
export type SealedRoleEffect = { zeroRoles: RoleName[]; oracleBaselineRole: RoleName | null; multipliers?: Partial<Record<RoleName, number>> }

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

function resolveBridgeAdjustedLengths(params: ShidasuParams, items: ItemId[]): { effectiveStairMinLen: number; effectiveSuitColorMinLen: number } {
  const effectiveStairMinLen = items.includes('bridge') ? params.scoring.stairMinLen - params.talismans.bridge.m : params.scoring.stairMinLen
  const effectiveSuitColorMinLen = items.includes('bridge') ? params.scoring.suitColorMinLen - params.talismans.bridge.m : params.scoring.suitColorMinLen
  return { effectiveStairMinLen, effectiveSuitColorMinLen }
}

function makeOracleLevelResolver(wave: WaveState, sealedRoleEffect: SealedRoleEffect): (name: RoleName) => number {
  return (name: RoleName): number => {
    if (sealedRoleEffect.zeroRoles.includes(name)) return 0
    if (sealedRoleEffect.oracleBaselineRole === name) return 1
    const base = wave.oracleLevels[name] ?? 1
    const mult = sealedRoleEffect.multipliers?.[name]
    return mult !== undefined ? base * mult : base
  }
}

// 庇護: effectiveComboがprotection.c未満なら底上げする。大地: effectiveComboにearth.cを加算する。
// 所持順(items配列の並び順)で順に適用する。
function applyProtectionEarthFloor(items: ItemId[], params: ShidasuParams, startingCombo: number): number {
  let effectiveCombo = startingCombo
  for (const id of items) {
    if (id === 'protection' && effectiveCombo < params.talismans.protection.c) {
      effectiveCombo = params.talismans.protection.c
    } else if (id === 'earth') {
      effectiveCombo += params.talismans.earth.c
    }
  }
  return effectiveCombo
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
  rowIndex?: number,
  sealedRoleEffect: SealedRoleEffect = { zeroRoles: [], oracleBaselineRole: null },
  comboCap: number | null = null
): { wave: WaveState; deckComposition: DeckCard[]; rewardTalismanTrigger: RewardTalismanTriggerResult } {
  const noTrigger: RewardTalismanTriggerResult = { triggeredIds: [], amounts: {} }
  if (wave.status !== 'playing') return { wave, deckComposition, rewardTalismanTrigger: noTrigger }
  const col = wave.tableau[colIndex]
  if (!col || col.length === 0) return { wave, deckComposition, rewardTalismanTrigger: noTrigger }
  const row = rowIndex ?? col.length - 1
  // アルギズ非発動中は一番上以外の行を指定しても無視する(不正なプレイを防ぐガード)
  if (row !== col.length - 1 && !wave.playFromAnywhereActiveThisWave) return { wave, deckComposition, rewardTalismanTrigger: noTrigger }
  const card = col[row]
  if (!card) return { wave, deckComposition, rewardTalismanTrigger: noTrigger }
  if (!isPlayable(modifier, wave, card, items)) return { wave, deckComposition, rewardTalismanTrigger: noTrigger }

  // 黄金: 通常のコンボ加算処理そのものを+1ではなく+2にする(他の護符には無干渉)
  // イサ(凍結)発動中は加算自体を行わない。コンボ頭打ち(妨害)発動中はcomboCapで上限クランプする
  // (注意: comboCapが制限するのは永続する状態フィールドwave.comboのみ。このプレイの得点計算に
  // 使うeffectiveCombo(下記)はnewComboを起点にbaseComboCount・庇護・大地をさらに適用した別値で、
  // comboCapの影響を受けない。妨害としては「以後のコンボ数の伸びを止める」効果に限定される)
  const newCombo = Math.min(
    comboCap ?? Infinity,
    wave.comboFrozenThisWave ? wave.combo : wave.combo + (items.includes('golden') ? 2 : 1)
  )
  let base = params.scoring.basePoint
  const parts: ScorePart[] = [addPart('基礎点', base)]

  // 鋼鉄: 前のプレイで予約された役ボーナスの遅延複製を無条件で上乗せする
  if (items.includes('mirror') && wave.pendingRoleEcho) {
    base += wave.pendingRoleEcho.amount
    parts.push(addPart(`鋼鉄(${wave.pendingRoleEcho.name})`, wave.pendingRoleEcho.amount))
  }

  const { effectiveStairMinLen, effectiveSuitColorMinLen } = resolveBridgeAdjustedLengths(params, items)
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
  // 神託: 役ごとの現在レベルをそのまま基礎点の乗数として渡す(ウェーブ開始時点で固定済み)。
  // 役封印中はzeroRolesに含まれる役を0倍、天啓・神託封印でオラクルが選ばれた場合は
  // oracleBaselineRoleに一致する役だけレベル1相当(封印前の水準)に戻す。
  const oracleLevel = makeOracleLevelResolver(wave, sealedRoleEffect)
  const chainResult = evaluateChainBonus(params.scoring, wave.chain, card, effectiveStairMinLen, roleBonusMultiplier, effectiveSuitColorMinLen, oracleLevel, items)
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
    parts.push(addPart('列一掃', sweepGain))
    roleFired.push({ name: 'columnSweep', usedWild: false, amount: sweepGain })
  }

  // 鋼鉄: 今回成立した役のうち、まだ今コンボで遅延複製を予約していないものを1つだけ、次のプレイへ予約する。
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

  // 潤沢(abundantFunds)のエッジトリガー判定用: このプレイ「前」の場札残数(wave.tableau基準)。
  // remainingBeforeRevival/remaining(プレイ後の残数、上記)と混同しないよう明示的に切り出す。
  const remainingBeforeThisPlay = remainingCount(wave.tableau)

  const newSameColumnStreak = wave.lastPlayedColumn === colIndex ? wave.sameColumnStreak + 1 : 1
  const newMaxComboThisWave = Math.max(wave.maxComboThisWave, newCombo)
  const newTotalColumnsEmptiedThisWave = wave.totalColumnsEmptiedThisWave + (sweepQualifies ? 1 : 0)
  const newColumnSweepActiveThisWave = wave.columnSweepActiveThisWave || sweepQualifies
  const newRoleFiredThisChain = wave.roleFiredThisChain || roleFired.length > 0
  const newFlushActiveThisCombo = wave.flushActiveThisCombo || roleFired.some(r => r.name === 'flush')

  // 祝福: 役成立ごとに基礎コンボ数(baseComboCount)を永続的に+1する
  const newBaseComboCount = items.includes('sanctify') && roleFired.length > 0 ? wave.baseComboCount + 1 : wave.baseComboCount

  // 流星: コンボがc(shootingStar.c)に到達した瞬間、永続加算shootingStarNをc到達のたびに蓄積する
  // (到達した同じプレイのgainedには反映されず、次のプレイから効く。果断・星霜と同じ挙動)
  const shootingStarReached = items.includes('shootingStar') && wave.combo < params.talismans.shootingStar.c && newCombo >= params.talismans.shootingStar.c
  const newShootingStarN = shootingStarReached ? wave.shootingStarN + params.talismans.shootingStar.n : wave.shootingStarN

  // 献身: フラッシュ成立のたびdedicationXにnを加算する(永続的に積み上がる)
  const newDedicationX = items.includes('dedication') && roleFired.some(r => r.name === 'flush')
    ? wave.dedicationX + params.talismans.dedication.n
    : wave.dedicationX

  // 勤勉: 同ランク成立のたびdiligenceXにnを加算する(永続的に積み上がる)
  const newDiligenceX = items.includes('diligence') && roleFired.some(r => r.name === 'sameRank')
    ? wave.diligenceX + params.talismans.diligence.n
    : wave.diligenceX

  // 加護: ロイヤルセット成立のたびdivineProtectionXにnを加算する(永続的に積み上がる)
  const newDivineProtectionX = items.includes('divineProtection') && roleFired.some(r => r.name === 'royalSet')
    ? wave.divineProtectionX + params.talismans.divineProtection.n
    : wave.divineProtectionX

  // 基礎コンボ数は計算用のコンボ数に常に加算する(このプレイで祝福により増えた分も含む)。
  // 庇護・大地: 所持順(itemsの並び順)でさらに一時comboに適用する。wave.combo(実コンボ)自体は変化しない。
  const effectiveCombo = applyProtectionEarthFloor(items, params, newCombo + newBaseComboCount)

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
    items,
  }

  const itemResult = applyItemEffects('gained', base, items, itemEffectCtx, params)
  parts.push(...itemResult.parts)

  const rewardTalismanCtx: PlayTriggerContext = {
    card,
    chain: chainIncludingThis,
    comboBefore: wave.combo,
    comboAfter: newCombo,
    remainingTableauCountBefore: remainingBeforeThisPlay,
    remainingTableauCountAfter: remaining,
    roleFired,
    sweepQualifies,
    sameColumnStreak: newSameColumnStreak,
  }
  const rewardTalismanTrigger = resolvePlayTriggeredRewardTalismans(params, items, rewardTalismanCtx)

  const discretionAdd = items.includes('discretion') ? wave.discretionN : 0
  if (discretionAdd !== 0) parts.push(addPart('果断', discretionAdd))
  const shootingStarGainedAdd = items.includes('shootingStar') ? wave.shootingStarN : 0
  if (shootingStarGainedAdd !== 0) parts.push(addPart('流星', shootingStarGainedAdd))
  // 全消しボーナス: 場札が0枚になった場合のみ、基礎値にclearBonusチャンネルの護符効果
  // (忍耐・浄化・節制)を適用した上で、通常のgained計算に加算項として合流させる。
  // 加算項は乗算項より前にpushすること(runningTotalsFromScorePartsの逐次計算と整合させるため)。
  const isFullClear = remainingBeforeRevival === 0
  let clearBonusAdd = 0
  if (isFullClear) {
    const rawClearBonus = params.scoring.clearBonus + wave.stock.length * params.scoring.clearBonusPerStock
    const clearBonusResult = applyItemEffects('clearBonus', rawClearBonus, items, itemEffectCtx, params)
    clearBonusAdd = Math.floor(clearBonusResult.value)
    parts.push(addPart('全消し基礎', params.scoring.clearBonus))
    parts.push(addPart('全消し山札残数', wave.stock.length * params.scoring.clearBonusPerStock))
    parts.push(...clearBonusResult.parts)
  }
  const comboMultiplierStep = params.scoring.comboMultiplierStep
  const multiplier = 1 + effectiveCombo * comboMultiplierStep
  if (multiplier !== 1) parts.push(multiplyPart('コンボ倍率', multiplier))
  const mannazFactor = wave.mannazActiveThisWave ? 1 + mannazWeightSum(items, params) * params.rites.mannaz.x : 1
  if (mannazFactor !== 1) parts.push(multiplyPart('マンナズ', mannazFactor))
  const dedicationFactor = items.includes('dedication') ? wave.dedicationX : 1
  if (dedicationFactor !== 1) parts.push(multiplyPart('献身', dedicationFactor))
  const diligenceFactor = items.includes('diligence') ? wave.diligenceX : 1
  if (diligenceFactor !== 1) parts.push(multiplyPart('勤勉', diligenceFactor))
  const divineProtectionFactor = items.includes('divineProtection') ? wave.divineProtectionX : 1
  if (divineProtectionFactor !== 1) parts.push(multiplyPart('加護', divineProtectionFactor))
  const frostFactor = items.includes('frost') ? wave.frostX : 1
  if (frostFactor !== 1) parts.push(multiplyPart('星霜', frostFactor))
  const echoFactor = items.includes('echo') ? wave.echoX : 1
  if (echoFactor !== 1) parts.push(multiplyPart('残響', echoFactor))
  const arroganceFactor = items.includes('arrogance') && wave.stock.length === 0 ? params.talismans.arrogance.x : 1
  if (arroganceFactor !== 1) parts.push(multiplyPart('慢心', arroganceFactor))
  const thurisazFactor = wave.nextPlayScoreMultiplier
  if (thurisazFactor !== 1) parts.push(multiplyPart('スリサズ', thurisazFactor))
  let gained = Math.floor((itemResult.value + discretionAdd + shootingStarGainedAdd + clearBonusAdd) * multiplier * mannazFactor * dedicationFactor * diligenceFactor * divineProtectionFactor * frostFactor * echoFactor * arroganceFactor * thurisazFactor)
  if (scoreLock && isBossScoreLocked(scoreLock, effectiveCombo, card)) {
    parts.length = 0
    parts.push(lockPart(bossScoreLockMessage(scoreLock)))
    gained = 0
  }

  const scoreAfterGained = wave.score + gained

  // 護符gained+コンボ倍率適用後のスコアが確定した時点で目標に達していれば、
  // 全消し判定を一切行わず、その時点のスコアで終了する。
  const targetReachedOnGained = scoreAfterGained >= target

  const newScore = scoreAfterGained

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
    dedicationX: newDedicationX,
    diligenceX: newDiligenceX,
    divineProtectionX: newDivineProtectionX,
    discretionN: wave.discretionN,
    frostX: wave.frostX,
    echoX: wave.echoX,
    shootingStarN: newShootingStarN,
    roleOccurrenceCountThisWave: newRoleOccurrenceCountThisWave,
    pendingRoleEcho: newPendingRoleEcho,
    roleEchoUsedThisCombo: newRoleEchoUsedThisCombo,
    sameRankEchoUsedThisCombo: newSameRankEchoUsedThisCombo,
    playCountThisWave: wave.playCountThisWave + 1,
    sweptColumnsThisCombo: newSweptColumnsThisCombo,
    sowiloBoostedRole: wave.sowiloBoostedRole ?? sowiloCommittedThisPlay,
    sabotageTurnsRemaining: wave.pendingSabotageId ? Math.max(0, wave.sabotageTurnsRemaining - 1) : wave.sabotageTurnsRemaining,
    nextPlayScoreMultiplier: 1,
  }

  // gained確定時点(全消しボーナス込み)で目標達成なら即座に終了する。
  if (targetReachedOnGained) {
    return { wave: { ...next, status: 'ended', endReason: 'target' }, deckComposition, rewardTalismanTrigger }
  }

  if (isFullClear) {
    let resetWave = resetComboFields(next, params)

    for (const id of items) {
      if (id === 'healing') {
        resetWave = resolveHealingRestoration(resetWave, next.sweptColumnsThisCombo, rand)
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
        // drawStock(山札からの自動継続処理)はプレイ操作ではないため、新規のプレイ中トリガー護符
        // (方向性1の14種)の判定対象にはならない。ここでは直前に計算済みのrewardTalismanTriggerを
        // そのまま引き継ぐだけで、drawStock専用の再判定は行わない。
        const drawResult = drawStock(params, resetWave, items, target, deckComposition, modifier, rand, scoreLock, sealedRoleEffect, comboCap)
        return { ...drawResult, rewardTalismanTrigger }
      }
      return { wave: resetWave, deckComposition, rewardTalismanTrigger }
    }

    return { wave: { ...resetWave, status: 'ended', endReason: 'fullClear' }, deckComposition, rewardTalismanTrigger }
  }

  if (newScore >= target) {
    return { wave: { ...next, status: 'ended', endReason: 'target' }, deckComposition, rewardTalismanTrigger }
  }

  return { wave: next, deckComposition, rewardTalismanTrigger }
}

export function drawStock(
  params: ShidasuParams,
  wave: WaveState,
  items: ItemId[],
  target: number,
  deckComposition: DeckCard[],
  modifier: StageModifier = 'none',
  rand: () => number = Math.random,
  scoreLock: BossScoreLock = null,
  sealedRoleEffect: SealedRoleEffect = { zeroRoles: [], oracleBaselineRole: null },
  comboCap: number | null = null
): { wave: WaveState; deckComposition: DeckCard[] } {
  if (wave.status !== 'playing') return { wave, deckComposition }
  if (wave.stock.length === 0) return { wave, deckComposition }

  const newStock = [...wave.stock]
  const drawnCard = newStock.pop() as Card

  const { effectiveStairMinLen, effectiveSuitColorMinLen } = resolveBridgeAdjustedLengths(params, items)
  const wouldContinue = wave.linked && chainContinuesPattern(params.scoring, wave.chain, drawnCard, effectiveStairMinLen, effectiveSuitColorMinLen, items)
  const benevolenceFires = !wouldContinue && items.includes('benevolence') && !wave.benevolenceUsedThisCombo
  const patternContinues = wouldContinue || benevolenceFires

  const scoreAfterStockEmpty = wave.score

  if (patternContinues) {
    // 誠実: パターン継続全般(同スート・同色・階段問わず)によりコンボが継続したとき、
    // wave.comboに直接+nする(naiveの有無に関わらず適用、次のプレイのeffectiveComboにも反映される)。
    // wouldContinue(実際のパターン継続)でのみ発火する。benevolenceFiresによる継続扱いは
    // 「本来リセットするところの救済」であり、パターン継続そのものの報酬である誠実の対象にはしない。
    const sincerityAdd = wouldContinue && items.includes('sincerity') ? params.talismans.sincerity.n : 0
    const newDrawContinueCount = wouldContinue ? wave.drawContinueCountThisChain + 1 : wave.drawContinueCountThisChain

    let naiveGained = 0
    let naiveParts: ScorePart[] = []
    // comboCapが制限するのはwave.comboのみで、得点計算用のeffectiveComboには影響しない(playCardの同様の注釈を参照)
    let naiveCombo = Math.min(comboCap ?? Infinity, wave.combo + sincerityAdd)
    let naiveRoleFiredThisChain = wave.roleFiredThisChain
    let naiveFlushActiveThisCombo = wave.flushActiveThisCombo
    if (wouldContinue && items.includes('naive')) {
      const newCombo = Math.min(
        comboCap ?? Infinity,
        wave.comboFrozenThisWave ? wave.combo : wave.combo + (items.includes('golden') ? 2 : 1)
      )
      let base = params.scoring.basePoint
      const parts: ScorePart[] = [addPart('基礎点', base)]
      // 神託: このパスは明星・ソウィロによる役倍率(roleBonusMultiplier)を通さない既存方針を維持しつつ、
      // 神託レベルは永続的な基礎点の一部として引き続き適用する
      const oracleLevel = makeOracleLevelResolver(wave, sealedRoleEffect)
      const chainResult = evaluateChainBonus(params.scoring, wave.chain, drawnCard, effectiveStairMinLen, undefined, effectiveSuitColorMinLen, oracleLevel, items)
      base += chainResult.bonus
      parts.push(...chainResult.parts)
      naiveRoleFiredThisChain = wave.roleFiredThisChain || chainResult.roleFired.length > 0
      naiveFlushActiveThisCombo = wave.flushActiveThisCombo || chainResult.roleFired.some(r => r.name === 'flush')
      // 基礎コンボ数は計算用のコンボ数に常に加算する(素朴パスでは祝福による基礎コンボ数の増加は発生しない)。
      const effectiveCombo = applyProtectionEarthFloor(items, params, newCombo + sincerityAdd + wave.baseComboCount)

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
        maxComboThisWave: Math.max(wave.maxComboThisWave, newCombo + sincerityAdd),
        flushActiveThisCombo: naiveFlushActiveThisCombo,
        columnSweepActiveThisWave: wave.columnSweepActiveThisWave,
        drawContinueCountThisChain: newDrawContinueCount,
        mercyActiveNextCombo: wave.mercyActiveNextCombo,
        items,
      }
      const itemResult = applyItemEffects('gained', base, items, naiveCtx, params)
      parts.push(...itemResult.parts)

      const comboMultiplierStep = params.scoring.comboMultiplierStep
      const multiplier = 1 + effectiveCombo * comboMultiplierStep
      if (multiplier !== 1) parts.push(multiplyPart('コンボ倍率', multiplier))
      const mannazFactor = wave.mannazActiveThisWave ? 1 + mannazWeightSum(items, params) * params.rites.mannaz.x : 1
      if (mannazFactor !== 1) parts.push(multiplyPart('マンナズ', mannazFactor))
      naiveGained = Math.floor(itemResult.value * multiplier * mannazFactor)
      if (scoreLock && isBossScoreLocked(scoreLock, effectiveCombo, drawnCard)) {
        parts.length = 0
        parts.push(lockPart(bossScoreLockMessage(scoreLock)))
        naiveGained = 0
      }
      naiveParts = parts
      naiveCombo = Math.min(comboCap ?? Infinity, newCombo + sincerityAdd)
    }

    const continueWave: WaveState = {
      ...wave,
      stock: items.includes('promise') ? arrangeNextCardForContinuation(params.scoring, newStock, [...wave.chain, drawnCard], effectiveStairMinLen, effectiveSuitColorMinLen, items) : newStock,
      foundation: drawnCard,
      combo: naiveCombo,
      chain: [...wave.chain, drawnCard],
      chainOrigin: [...wave.chainOrigin, 'draw'],
      linked: true,
      lastDrawEffect: drawnCard.wild ? 'wild' : 'pattern',
      lastGain: naiveParts.length > 0 ? { points: naiveGained, parts: naiveParts } : null,
      score: scoreAfterStockEmpty + naiveGained,
      drawContinueCountThisChain: newDrawContinueCount,
      benevolenceUsedThisCombo: benevolenceFires ? true : wave.benevolenceUsedThisCombo,
      maxComboThisWave: Math.max(wave.maxComboThisWave, naiveCombo),
      roleFiredThisChain: naiveRoleFiredThisChain,
      flushActiveThisCombo: naiveFlushActiveThisCombo,
      sabotageTurnsRemaining: wave.pendingSabotageId ? Math.max(0, wave.sabotageTurnsRemaining - 1) : wave.sabotageTurnsRemaining,
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

  // 沈着: リセット時、取れる場札が無ければ基礎コンボ数(baseComboCount)を永続+nする
  const composureAdd = !hasPlayableColumns && items.includes('composure') ? params.talismans.composure.n : 0
  // 冷静: リセット時、そのチェーンで役が一つも成立していなければ基礎コンボ数を永続+nする
  const clarityAdd = !wave.roleFiredThisChain && items.includes('clarity') ? params.talismans.clarity.n : 0
  // 残響: リセット時、リセット前のコンボ数×nを永続倍率echoXとして蓄積する(以後gainedに乗算)
  const echoAdd = items.includes('echo') ? wave.combo * params.talismans.echo.n : 0

  let resetWave: WaveState = {
    ...resetComboFields(wave, params, card, 'draw'),
    stock: items.includes('promise') ? arrangeNextCardForContinuation(params.scoring, newStock, [card], effectiveStairMinLen, effectiveSuitColorMinLen, items) : newStock,
    lastDrawEffect: null,
    lastGain: null,
    score: scoreAfterStockEmpty,
    baseComboCount: wave.baseComboCount + composureAdd + clarityAdd,
    echoX: wave.echoX + echoAdd,
  }

  // このリセット処理に入る時点でresetWave.score>=targetになることは通常起こらないが(他の得点増加経路で既に終了しているため)、念のための防御的チェックとして残す。
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

// 現在Waveの星(stageStars[waveIndex])が持つ制限ルールのうち、取得可否そのものを制限する
// 種類(noLoop/faceLock)のみを対象とする。得点ロック系(lowCombo/oddCombo/suit/face)は
// bossScoreLockForが別途扱う。paramsは呼び出し元との既存シグネチャ互換のため残しているが、
// 判定に使うのはrun.stageStarsのみで参照していない。
export function stageModifierFor(_params: ShidasuParams, run: RunState): StageModifier {
  const star = run.stageStars[run.waveIndex]
  if (!star || !star.restriction) return 'none'
  if (star.restriction.kind === 'noLoop') return 'noLoop'
  if (star.restriction.kind === 'faceLock') return 'faceLock'
  return 'none'
}

// 現在Waveの星が持つ制限ルールのうち、得点ロック系(lowCombo/oddCombo/suit/face)を対象とする。
// tierLabelには星の名前(旧: 階級名)をそのまま使う。noLoop/faceLockはstageModifierFor側の
// 担当であり、ここでは意図的にdefaultへ落としてnullを返す(取得可否制限と得点ロックは排他)。
// paramsは呼び出し元との既存シグネチャ互換のため残しているが、判定には使っていない。
export function bossScoreLockFor(_params: ShidasuParams, run: RunState): BossScoreLock {
  const star = run.stageStars[run.waveIndex]
  if (!star || !star.restriction) return null
  switch (star.restriction.kind) {
    case 'lowCombo': return { kind: 'combo', maxCombo: star.restriction.maxCombo, tierLabel: star.name }
    case 'oddCombo': return { kind: 'oddCombo', tierLabel: star.name }
    case 'suit': return { kind: 'suit', suit: star.restriction.suit, tierLabel: star.name }
    case 'face': return { kind: 'face', tierLabel: star.name }
    default: return null
  }
}

// ステージ基準点に、現在Waveの星が持つ倍率をかけて目標スコアを算出する。
// target(stageIndex, waveIndex) = flow.stageTargetBase × flow.stageTargetMultiplier^stageIndex × star.targetMultiplier
export function waveTarget(params: ShidasuParams, stageIndex: number, waveIndex: number, stageStars: Star[]): number {
  const base = params.flow.stageTargetBase * params.flow.stageTargetMultiplier ** stageIndex
  const star = stageStars[waveIndex]
  return Math.floor(base * (star?.targetMultiplier ?? 1))
}

const GREAT_MISFORTUNE_SUITS: Suit[] = ['♠', '♥', '♦', '♣']

// params.stars内の1エントリ(フラットなJSON表現)を、実行時に使うStarRestriction型へ変換する。
function toStarRestriction(entry: ShidasuParams['stars'][number], rand: () => number): StarRestriction {
  switch (entry.restrictionKind) {
    case 'none': return null
    case 'noLoop': return { kind: 'noLoop' }
    case 'faceLock': return { kind: 'faceLock' }
    // maxComboはlowComboのとき管理画面バリデーションで必須指定されるはずだが、
    // データ不整合時にクラッシュしないよう念のためデフォルト値2で握りつぶす。
    case 'lowCombo': return { kind: 'lowCombo', maxCombo: entry.maxCombo ?? 2 }
    case 'oddCombo': return { kind: 'oddCombo' }
    case 'suit': return { kind: 'suit', suit: GREAT_MISFORTUNE_SUITS[Math.floor(rand() * GREAT_MISFORTUNE_SUITS.length)] }
    case 'face': return { kind: 'face' }
  }
}

// 指定したwaveSlot(1/2/3)に属する候補群からrandで1つ抽選し、Star型に変換する。
// 候補が1件も無いwaveSlotは管理画面のバリデーションで基本的に発生しないが、念のため
// エントリが見つからない場合は制限ルールなしのダミー星を返す。
function rollStarForSlot(params: ShidasuParams, waveSlot: 1 | 2 | 3, rand: () => number, excludeId?: string): Star {
  const allCandidates = params.stars.filter(s => s.waveSlot === waveSlot)
  if (allCandidates.length === 0) {
    return { id: `fallback-${waveSlot}`, name: '名もなき星', waveSlot, targetMultiplier: 1, reward: 0, restriction: null, sabotage: { kind: 'none' }, descTemplate: '' }
  }
  // リロール時、候補が2件以上あれば直前と同じ星を除外して再抽選が必ず変化するようにする
  const candidates = excludeId && allCandidates.length > 1 ? allCandidates.filter(s => s.id !== excludeId) : allCandidates
  const entry = candidates[Math.floor(rand() * candidates.length)]
  return {
    id: entry.id,
    name: entry.name,
    waveSlot: entry.waveSlot,
    targetMultiplier: entry.targetMultiplier,
    reward: entry.reward,
    restriction: toStarRestriction(entry, rand),
    sabotage: entry.sabotageKind === 'all' ? { kind: 'all' } : { kind: 'none' },
    descTemplate: entry.descTemplate,
  }
}

// 新しいステージに入る際、waveSlot 1・2・3それぞれから1つずつ抽選し3Wave分をまとめて確定させる。
function rollStageStars(params: ShidasuParams, rand: () => number): Star[] {
  return [1, 2, 3].map(slot => rollStarForSlot(params, slot as 1 | 2 | 3, rand))
}

// 秘儀・天啓・神託の使用がショップ滞在中(shop本体および福袋の各中身選択画面)でも
// 行えるようにするためのフェーズ集合。useRite/useRevelationのガードで使う。
export const SHOP_FLOW_PHASES: RunPhase[] = ['shop', 'itemSelect', 'riteSelect', 'revelationSelect', 'oracleSelect', 'cardSetSelect']

// 現在のstageIndexから次のウェーブの(stageIndex, waveIndex)を算出する。
// waveIndexがwavesPerStageに達したら次のステージ(stageIndex+1・waveIndex0)へ繰り上がる。
function nextWaveLocation(params: ShidasuParams, run: RunState): { stageIndex: number; waveIndex: number } {
  const nextWaveIndex = run.waveIndex + 1
  if (nextWaveIndex >= params.flow.wavesPerStage) {
    return { stageIndex: run.stageIndex + 1, waveIndex: 0 }
  }
  return { stageIndex: run.stageIndex, waveIndex: nextWaveIndex }
}

// 次のウェーブ位置に応じたstageStarsを算出する。同じステージ内に留まる場合は現在のstageStarsを
// 維持し、新しいステージに入る場合はrollStageStarsで3Wave分をまとめて新規抽選する。
function nextStageStars(
  params: ShidasuParams,
  run: RunState,
  newLocation: { stageIndex: number; waveIndex: number },
  rand: () => number
): Star[] {
  if (newLocation.stageIndex === run.stageIndex) return run.stageStars
  return rollStageStars(params, rand)
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
    phase: 'title', stageIndex: 0, waveIndex: 0, items: [], nextInstanceId: 1, offer: [], wave: null, waveGeneration: 0, pendingNewItem: null,
    deckComposition: standardDeckComposition(), rites: [], revelations: [], relics: [], revelationOffer: [], extraTableauRows: 0,
    oracleLevels: defaultOracleLevels(), oracleOffer: [], spreadId: 'fool',
    stageStars: [], currency: 0,
    dedicationX: 1, diligenceX: 1, divineProtectionX: 1,
    discretionN: 10, frostX: 1,
    echoX: 1, shootingStarN: 50,
    oracles: [], shop: null, offerPickRemaining: 0, riteOffer: [],
    pendingNewRite: null, pendingNewRevelation: null, pendingNewOracle: null,
    cardSetOffer: [], shopRerollCount: 0,
    lastUsedRevelationId: null, recentUsedRiteIds: [], rewardPenalty: 0,
  }
}

export function beginRun(params: ShidasuParams, seed?: number, spreadId: SpreadId = 'fool'): RunState {
  const initialExtraTableauRows = params.spreads[spreadId].initialExtraTableauRows
  const rand = createRng(seed ?? Math.floor(Math.random() * 999999) + 1)
  const initialStageStars = rollStageStars(params, rand)
  return {
    ...createInitialRun(),
    phase: 'shop',
    extraTableauRows: initialExtraTableauRows,
    spreadId,
    stageStars: initialStageStars,
    currency: params.currency.initialAmount,
  }
}

export function resolveWaveEnd(params: ShidasuParams, run: RunState, rand: () => number = Math.random, seed?: number): RunState {
  const wave = run.wave
  if (!wave || wave.status !== 'ended') return run

  const target = waveTarget(params, run.stageIndex, run.waveIndex, run.stageStars)
  if (wave.score < target) {
    return { ...run, phase: 'gameOver' }
  }

  // stageStarsは常にwaveSlot 1/2/3から生成された3要素配列であり、params.flow.wavesPerStage(3)と
  // 対応している前提でwaveIndexをそのままインデックスとして使う。
  const currentStar = run.stageStars[run.waveIndex]
  const baseEarned = Math.max(0, (currentStar?.reward ?? 0) - run.rewardPenalty)
  const earned = baseEarned + relicWaveEndBonus(params, run, wave, baseEarned)
  const runWithCurrency = {
    ...run,
    currency: run.currency + earned,
    dedicationX: wave.dedicationX,
    diligenceX: wave.diligenceX,
    divineProtectionX: wave.divineProtectionX,
    discretionN: wave.discretionN,
    frostX: wave.frostX,
    echoX: wave.echoX,
    shootingStarN: wave.shootingStarN,
  }

  // 8ステージクリア(stageIndex === stagesPerRun - 1のwaveSlot 3クリア)時のみ、ショップ突入を
  // 後回しにして続行確認を挟む。それ以外は通常通りショップへ進む。
  const isFinalWaveOfRun = isBossWave(params, run.waveIndex) && run.stageIndex === params.flow.stagesPerRun - 1
  if (isFinalWaveOfRun) {
    return { ...runWithCurrency, phase: 'continueChoice' }
  }
  return enterShop(params, runWithCurrency, seed, rand)
}

// 果断・星霜: 天啓・神託・秘儀のいずれかを使用するたび、waveのdiscretionN/frostXへ永続的に加算する。
function applyDiscretionFrostBonus(params: ShidasuParams, run: RunState, wave: WaveState): WaveState {
  let next = wave
  if (run.items.some(h => h.id === 'discretion')) next = { ...next, discretionN: next.discretionN + params.talismans.discretion.n }
  if (run.items.some(h => h.id === 'frost')) next = { ...next, frostX: next.frostX + params.talismans.frost.x }
  return next
}

// 秘儀を1つ使用する。効果を適用し、所持からその秘儀を1個削除する。
// 使用条件(canUseRite)を満たさない場合、または所持していない場合は何もしない。
// instanceIdは対象の個体(封印精度・重複所持時の対象特定に使う)。呼び出し元(UI)は
// クリックされたバッジのinstanceIdをそのまま渡す。
export function useRite(params: ShidasuParams, run: RunState, instanceId: number, riteId: RiteId, rand: () => number = Math.random): RunState {
  if ((run.phase !== 'playing' && !SHOP_FLOW_PHASES.includes(run.phase)) || !run.wave || run.wave.status !== 'playing') return run
  if (!canUseRite(params, run.wave, instanceId, riteId)) return run
  const idx = run.rites.findIndex(h => h.instanceId === instanceId)
  if (idx === -1) return run
  let wave = applyRiteEffect(params, run.wave, riteId, rand)
  wave = applyDiscretionFrostBonus(params, run, wave)
  if (riteId === 'dagaz') {
    wave = { ...wave, lastStockShuffle: { seq: (run.wave.lastStockShuffle?.seq ?? 0) + 1 } }
  }
  const rites = [...run.rites.slice(0, idx), ...run.rites.slice(idx + 1)]
  const recentUsedRiteIds = [riteId, ...run.recentUsedRiteIds].slice(0, 2)
  return { ...run, wave, rites, recentUsedRiteIds }
}

// Waveクリア確定後(resolveWaveEnd)・大凶続行後(continueAfterGreatMisfortune)に呼ぶ。
// 次ウェーブ位置・ボス種別・大凶対象スートを確定し、ショップの商品構成を抽選し、
// phase: 'shop'へ遷移する。waveは直前Waveの終了状態を保持したまま変更しない。
function enterShop(params: ShidasuParams, run: RunState, _seed: number | undefined, rand: () => number): RunState {
  const newLocation = nextWaveLocation(params, run)
  const newStageStars = nextStageStars(params, run, newLocation, rand)
  const next: RunState = {
    ...run,
    phase: 'shop',
    stageIndex: newLocation.stageIndex,
    waveIndex: newLocation.waveIndex,
    stageStars: newStageStars,
    offer: [],
    pendingNewItem: null,
    revelationOffer: [],
    oracleOffer: [],
    riteOffer: [],
    offerPickRemaining: 0,
    cardSetOffer: [],
    shopRerollCount: 0,
  }
  return { ...next, shop: rollShop(params, next, rand) }
}

// ショップ系フェーズでの天啓ターゲット選択用に、現在のdeckCompositionから使い捨ての
// プレビュー盤面を生成する。stageIndex/waveIndexはstartWave内部では実質未使用のため
// ダミー値(0, 0)を渡す。生成したWaveStateは本番run.waveとは無関係な一時オブジェクトであり、
// 呼び出し元(+page.svelte)がローカルstateとして保持・破棄する。
export function startRevelationPreview(params: ShidasuParams, run: RunState, seed?: number): WaveState {
  const { wave } = startWave(params, 0, 0, run.items.map(h => h.id), run.deckComposition, seed, run.extraTableauRows, run.oracleLevels, run.dedicationX, run.diligenceX, run.divineProtectionX, run.discretionN, run.frostX, run.echoX, run.shootingStarN)
  return wave
}

// ショップを終了し、その時点のdeckComposition・extraTableauRows(ショップ滞在中の天啓「即使う」等で
// 更新されている可能性がある)から実際のウェーブを配り直してプレイ画面へ進む。「次のWaveへ」ボタンから呼ぶ。
export function finishShop(params: ShidasuParams, run: RunState, seed?: number): RunState {
  if (run.phase !== 'shop') return run
  const star = run.stageStars[run.waveIndex]
  const { wave, deckComposition } = startWave(params, run.stageIndex, run.waveIndex, run.items.map(h => h.id), run.deckComposition, seed, run.extraTableauRows, run.oracleLevels, run.dedicationX, run.diligenceX, run.divineProtectionX, run.discretionN, run.frostX, run.echoX, run.shootingStarN, star?.sabotage ?? { kind: 'none' })
  return { ...run, phase: 'playing', wave, waveGeneration: run.waveGeneration + 1, deckComposition, shop: null }
}

// wave.activeSealがtalisman封印の場合、その個体(instanceId)をitemsから除外した実効リストを
// ItemId[]で返す(playCard/drawStock等の下流関数は引き続きItemId[]のみを扱う境界)。
// playCard/drawStockへ渡すitemsをこれに差し替えることで、所持表示(run.items)自体は
// 変更せずに効果だけを無視させる。同名護符を複数所持していても、封印された個体1つだけを除外する。
function resolveEffectiveItems(items: HeldItem[], activeSeal: WaveState['activeSeal']): ItemId[] {
  const effective = activeSeal?.kind === 'talisman' ? items.filter(h => h.instanceId !== activeSeal.instanceId) : items
  return effective.map(h => h.id)
}

// wave.activeSealから、playCard/drawStockに渡すsealedRoleEffectを導出する。
// role封印は該当役のボーナスを0倍に、revelationOrOracle封印でoracleが選ばれていれば
// 該当役のレベル効果だけを1倍(封印前の基準値)に戻す。
// RoleStatusPanel.svelte(UI表示側)からも、封印中の実効レベル・得点を表示するために利用する。
export function resolveSealedRoleEffect(activeSeal: WaveState['activeSeal']): SealedRoleEffect {
  if (activeSeal?.kind === 'role') return { zeroRoles: activeSeal.names, oracleBaselineRole: null }
  if (activeSeal?.kind === 'revelationOrOracle' && activeSeal.ref.kind === 'oracle') return { zeroRoles: [], oracleBaselineRole: activeSeal.ref.id }
  if (activeSeal?.kind === 'roleBias') {
    const multipliers: Partial<Record<RoleName, number>> = {}
    for (const name of activeSeal.buffed) multipliers[name] = activeSeal.multiplier
    for (const name of activeSeal.nerfed) multipliers[name] = 1 / activeSeal.multiplier
    return { zeroRoles: [], oracleBaselineRole: null, multipliers }
  }
  return { zeroRoles: [], oracleBaselineRole: null }
}

// wave.activeSealがcomboCap封印の場合、上限値を返す。それ以外はnull(上限無し)。
// applyPlayCard/applyDrawStock/applyStuckCheckからplayCard/drawStockへ渡す。
export function resolveComboCap(activeSeal: WaveState['activeSeal']): number | null {
  return activeSeal?.kind === 'comboCap' ? activeSeal.max : null
}

// 妨害行動を1つ発動させ、効果を適用した上で次の妨害を再抽選する。
// applyPlayCard/applyDrawStock(RunState層)から、wave.sabotageTurnsRemainingが0になった時点で呼ばれる。
// 個々の効果の実装はsabotageEffects.ts(applySabotageEffect)に委譲する。
export function triggerSabotage(params: ShidasuParams, run: RunState, id: SabotageActionId, rand: () => number = Math.random): RunState {
  if (!run.wave) return run
  const wave = run.wave
  const resetWave: WaveState = { ...wave, activeSeal: null }
  const result = applySabotageEffect(id, { params, run, wave, rand, useRite, useRevelation, useOracle })
  const nextWave: WaveState = { ...resetWave, ...result.wave }
  const nextRun: RunState = { ...run, ...result.run, wave: nextWave }

  const star = nextRun.stageStars[nextRun.waveIndex]
  const rolled = rollSabotage(params, star?.sabotage ?? { kind: 'none' }, rand)
  return {
    ...nextRun,
    wave: {
      ...nextWave,
      pendingSabotageId: rolled.pendingSabotageId,
      sabotageTurnsRemaining: rolled.sabotageTurnsRemaining,
      lastSabotage: { id, seq: (wave.lastSabotage?.seq ?? 0) + 1, affectedCols: result.affectedTableauCols, purgedToDiscardCount: result.purgedToDiscardCount, confiscatedTarget: result.confiscatedTarget, forceActivatedTarget: result.forceActivatedTarget, numericChangeTarget: result.numericChangeTarget, tableauCardRemoved: result.tableauCardRemoved, redistributedAreas: result.redistributedAreas },
      lastStockShuffle: id === 'stockShuffle' ? { seq: (wave.lastStockShuffle?.seq ?? 0) + 1 } : wave.lastStockShuffle,
    },
  }
}

// ステージ画面のスキップボタンから呼ぶ。ボスWave(isBossWaveがtrueを返すwaveIndex、通常は
// wavesPerStage-1=waveSlot 3)以外のときのみ、waveIndexを1つ進める。WaveState(wave)は
// 一切生成・変更せず、報酬も発生しない。ボスWaveやphaseがshop以外のときは何もせず、
// runをそのまま返す(UIでスキップボタン自体を出さないことと合わせた二重の安全策)。
export function skipWave(params: ShidasuParams, run: RunState): RunState {
  if (run.phase !== 'shop') return run
  if (isBossWave(params, run.waveIndex)) return run
  return { ...run, waveIndex: run.waveIndex + 1 }
}

// ステージ画面のリロールボタンから呼ぶ。ボスWave(isBossWaveがtrueを返すwaveIndex、通常は
// wavesPerStage-1=waveSlot 3)がまだクリアされておらず(waveIndexがボスWave以下)
// 通貨がrerollCost以上のときのみ動作する。Wave1・2がNEXTの間でも押せる(ボスWaveのカード自体は先に
// 抽選済みで表示されているため)。通貨からrerollCostを差し引き、stageStars内のボスWaveスロットを
// 直前と異なる星にrollStarForSlotで再抽選する。それ以外の条件(ボスWaveクリア済み、通貨不足、
// phaseがshop以外)ではrunをそのまま返す。
export function rerollStageStars(params: ShidasuParams, run: RunState, rand: () => number = Math.random): RunState {
  if (run.phase !== 'shop') return run
  const bossWaveIndex = params.flow.wavesPerStage - 1
  if (run.waveIndex > bossWaveIndex) return run
  if (run.currency < params.flow.rerollCost) return run
  const newStar = rollStarForSlot(params, 3, rand, run.stageStars[bossWaveIndex]?.id)
  const stageStars = [...run.stageStars]
  stageStars[bossWaveIndex] = newStar
  return { ...run, currency: run.currency - params.flow.rerollCost, stageStars }
}

// ショップの品ぞろえ(バラ売り3枠+福袋2枠)全体を再抽選するリロールのコスト。同一ショップ訪問中の
// リロール回数(shopRerollCount)に応じて回数ごとにrerollCostStep分ずつ増額する
// (1回目はrerollCostStep、2回目は2倍、3回目は3倍…)。福だるま所持時はrerollCostStep自体が減少し、
// 付喪化済みなら同一ショップ訪問中の最初の1回(shopRerollCount===0)は無料になる。
export function shopRerollCost(params: ShidasuParams, run: RunState): number {
  if (run.shopRerollCount === 0 && relicFirstRerollFree(run)) return 0
  return (run.shopRerollCount + 1) * relicRerollCostStep(params, run)
}

// ショップ画面のリロールボタンから呼ぶ。バラ売り3枠+福袋2枠を丸ごと再抽選する(売り切れ済みの
// 枠も含めて全て新しい商品に入れ替わる、既存のrollShopをそのまま再利用)。通貨からshopRerollCost分を
// 差し引き、shopRerollCountを+1する。phaseがshop以外、shopがnull、通貨不足のいずれかの場合は
// runをそのまま返す。
export function rerollShop(params: ShidasuParams, run: RunState, rand: () => number = Math.random): RunState {
  if (run.phase !== 'shop' || !run.shop) return run
  const cost = shopRerollCost(params, run)
  if (run.currency < cost) return run
  return { ...run, currency: run.currency - cost, shop: rollShop(params, run, rand), shopRerollCount: run.shopRerollCount + 1 }
}

// バラ売り枠を1つ購入し、対象配列へ追加する共通処理。容量超過・通貨不足ならno-op(スワップは発生しない)。
// 呼び出し元は既にフェーズ・shop存在・枠のkind一致を確認済みの前提(このヘルパーはその後の
// 容量判定〜確定処理だけを担当する)。フィールドの動的キーアクセスのため戻り値をRunStateに
// キャストしている(福袋pick系・売却系リファクタのresolvePackOfferPick/sellFromArrayと同じ理由・同じパターン)。
// 新規インスタンスにはrun.nextInstanceIdを払い出し、+1する。
function buyIndividualHold<TId>(
  run: RunState,
  shop: ShopState,
  slotIndex: number,
  arrayField: 'items' | 'rites' | 'revelations' | 'oracles',
  arr: { instanceId: number; id: TId }[],
  value: TId,
  atCapacity: boolean,
  price: number
): RunState {
  if (atCapacity) return run
  if (run.currency < price) return run
  const individual = shop.individual.map((s, i) => (i === slotIndex ? { ...s, sold: true } : s))
  const held = { instanceId: run.nextInstanceId, id: value }
  return { ...run, currency: run.currency - price, [arrayField]: [...arr, held], nextInstanceId: run.nextInstanceId + 1, shop: { ...shop, individual } } as RunState
}

// バラ売り護符購入。所持上限(maxItems、招き布袋像所持時は拡張)到達時・通貨不足時・売り切れ時は何もしない(スワップは発生しない)。
export function buyIndividualItem(params: ShidasuParams, run: RunState, slotIndex: number): RunState {
  if (run.phase !== 'shop' || !run.shop) return run
  const slot = run.shop.individual[slotIndex]
  if (!slot || slot.sold || slot.kind !== 'item') return run
  const itemId = slot.id as ItemId
  return buyIndividualHold(run, run.shop, slotIndex, 'items', run.items, itemId, run.items.length >= itemMaxCapacity(params, run), itemBuyPrice(params, run, itemId))
}

// バラ売り秘儀購入。所持上限(基本3、破魔矢所持時は拡張)到達時・通貨不足時・売り切れ時は何もしない。
export function buyIndividualRite(params: ShidasuParams, run: RunState, slotIndex: number): RunState {
  if (run.phase !== 'shop' || !run.shop) return run
  const slot = run.shop.individual[slotIndex]
  if (!slot || slot.sold || slot.kind !== 'rite') return run
  const riteId = slot.id as RiteId
  return buyIndividualHold(run, run.shop, slotIndex, 'rites', run.rites, riteId, run.rites.length >= riteMaxCapacity(params, run), riteBuyPrice(params, run))
}

// レリックを1つ購入する。ショップのレリック専用枠(run.shop.relic配列)からslotIndex番目を購入する。
// 売り切れ済み・枠が無い・通貨不足のいずれかならno-op
export function buyRelic(params: ShidasuParams, run: RunState, slotIndex: number): RunState {
  if (run.phase !== 'shop' || !run.shop || !run.shop.relic) return run
  const slot = run.shop.relic[slotIndex]
  if (!slot || slot.sold) return run
  const price = relicBuyPrice(params, run, slot.id)
  if (run.currency < price) return run
  const relic = run.shop.relic.map((s, i) => (i === slotIndex ? { ...s, sold: true } : s))
  return {
    ...run,
    currency: run.currency - price,
    relics: [...run.relics, { id: slot.id, tsukumoka: false }],
    shop: { ...run.shop, relic },
  }
}

// バラ売り天啓・即使う。run.waveに即座に効果を適用する(target: colIndexが必要な天啓は
// 呼び出し元でコラム選択後に呼ばれる)。天啓・神託合算上限とは無関係に常に購入可。
// ショップ画面のバラ売りUIからは現在呼ばれず(即使うボタンは廃止・購入(温存)のみ)、
// 福袋(pack)経由の即使用でrun.waveを一時的にプレビューへ差し替えて呼ぶ用途にのみ使う
// (呼び出し元+page.svelteのhandleTargetColumn参照)。
export function buyIndividualRevelationUse(params: ShidasuParams, run: RunState, slotIndex: number, targetCol: number | null, rand: () => number = Math.random): RunState {
  if (run.phase !== 'shop' || !run.shop || !run.wave) return run
  const slot = run.shop.individual[slotIndex]
  if (!slot || slot.sold || slot.kind !== 'revelation') return run
  const revelationId = slot.id as RevelationId
  if (!canUseRevelation(params, run.wave, null, revelationId, run.relics)) return run
  const price = revelationBuyPrice(params, run)
  if (run.currency < price) return run
  const { wave, deckComposition } = applyRevelationEffect(params, run.wave, run.deckComposition, revelationId, targetCol, rand)
  const extraTableauRows = run.extraTableauRows
  const individual = run.shop.individual.map((s, i) => (i === slotIndex ? { ...s, sold: true } : s))
  return { ...run, currency: run.currency - price, wave, deckComposition, extraTableauRows, shop: { ...run.shop, individual } }
}

// バラ売り天啓・温存。天啓・神託合算上限(基本2、千羽鶴所持時は拡張)到達時はブロックする(スワップは発生しない)。
export function buyIndividualRevelationHold(params: ShidasuParams, run: RunState, slotIndex: number): RunState {
  if (run.phase !== 'shop' || !run.shop) return run
  const slot = run.shop.individual[slotIndex]
  if (!slot || slot.sold || slot.kind !== 'revelation') return run
  const revelationId = slot.id as RevelationId
  return buyIndividualHold(run, run.shop, slotIndex, 'revelations', run.revelations, revelationId, run.revelations.length + run.oracles.length >= revelationOracleMaxCapacity(params, run), revelationBuyPrice(params, run))
}

// バラ売り神託・即使う。役レベル+1をrun/wave両方に反映する(pickPackOracleUseと同じ同期が必要)。上限とは無関係に常に購入可。
export function buyIndividualOracleUse(params: ShidasuParams, run: RunState, slotIndex: number): RunState {
  if (run.phase !== 'shop' || !run.shop) return run
  const slot = run.shop.individual[slotIndex]
  if (!slot || slot.sold || slot.kind !== 'oracle') return run
  const roleName = slot.id as RoleName
  const price = oracleBuyPrice(params, run)
  if (run.currency < price) return run
  const oracleLevels = { ...run.oracleLevels, [roleName]: run.oracleLevels[roleName] + 1 }
  const wave = run.wave ? { ...run.wave, oracleLevels } : run.wave
  const individual = run.shop.individual.map((s, i) => (i === slotIndex ? { ...s, sold: true } : s))
  return { ...run, currency: run.currency - price, oracleLevels, wave, shop: { ...run.shop, individual } }
}

// バラ売り神託・温存。天啓・神託合算上限(基本2、千羽鶴所持時は拡張)到達時はブロックする。
export function buyIndividualOracleHold(params: ShidasuParams, run: RunState, slotIndex: number): RunState {
  if (run.phase !== 'shop' || !run.shop) return run
  const slot = run.shop.individual[slotIndex]
  if (!slot || slot.sold || slot.kind !== 'oracle') return run
  const roleName = slot.id as RoleName
  return buyIndividualHold(run, run.shop, slotIndex, 'oracles', run.oracles, roleName, run.revelations.length + run.oracles.length >= revelationOracleMaxCapacity(params, run), oracleBuyPrice(params, run))
}

// 福袋購入。上限とは無関係に常に成立する(通貨不足・売り切れ・shop以外のフェーズでのみブロック)。
// 購入したパターンに応じて対応する中身選択フェーズへ遷移し、offerPickRemainingをpickCountにセットする。
export function buyPack(params: ShidasuParams, run: RunState, slotIndex: number, rand: () => number = Math.random): RunState {
  if (run.phase !== 'shop' || !run.shop) return run
  const slot = run.shop.packs[slotIndex]
  if (!slot || slot.sold) return run
  if (run.currency < slot.price) return run
  const packs = run.shop.packs.map((s, i) => (i === slotIndex ? { ...s, sold: true } : s))
  const base: RunState = { ...run, currency: run.currency - slot.price, shop: { ...run.shop, packs }, offerPickRemaining: slot.pickCount }
  if (slot.packKind === 'item') return { ...base, phase: 'itemSelect', offer: rollItemOffer(run.items.map(h => h.id), rand, slot.offerCount) }
  if (slot.packKind === 'rite') return { ...base, phase: 'riteSelect', riteOffer: rollRiteOffer(rand, slot.offerCount) }
  if (slot.packKind === 'revelation') return { ...base, phase: 'revelationSelect', revelationOffer: rollRevelationOffer(rand, slot.offerCount) }
  if (slot.packKind === 'oracle') return { ...base, phase: 'oracleSelect', oracleOffer: rollOracleOffer(rand, slot.offerCount) }
  return { ...base, phase: 'cardSetSelect', cardSetOffer: rollCardSetOffer(rand, slot.offerCount) }
}

// 福袋の残り選択が1件確定した後の共通処理。オファー配列からmatchesに一致する最初の1件を除去し、
// offerPickRemainingをデクリメントし、0以下になればphase: 'shop'へ戻る。
// 所持側の更新(items/rites/revelations/oracles等)は呼び出し元がrunへ事前にマージしてから渡すこと
// (このヘルパー自身は所持側には一切関知しない)。
// オファー配列・pendingフィールドの参照はRunStateの動的キーアクセスになるため、戻り値をRunStateに
// キャストしている(呼び出し元は決まった数のパターンに限定されるため、型安全性は既存テストで担保する)。
function resolvePackOfferPick<T>(
  run: RunState,
  offerField: 'offer' | 'riteOffer' | 'revelationOffer' | 'oracleOffer' | 'cardSetOffer',
  pendingField: 'pendingNewItem' | 'pendingNewRite' | 'pendingNewRevelation' | 'pendingNewOracle' | null,
  offer: T[],
  matches: (entry: T) => boolean
): RunState {
  const idx = offer.findIndex(matches)
  const newOffer = idx === -1 ? offer : [...offer.slice(0, idx), ...offer.slice(idx + 1)]
  const offerPickRemaining = run.offerPickRemaining - 1
  const pendingUpdate = pendingField ? { [pendingField]: null } : {}
  if (offerPickRemaining <= 0) {
    return { ...run, ...pendingUpdate, phase: 'shop', [offerField]: [], offerPickRemaining: 0 } as RunState
  }
  return { ...run, ...pendingUpdate, [offerField]: newOffer, offerPickRemaining } as RunState
}

// 福袋の残りの選択を放棄してshopへ戻る共通処理。
function closePackOfferSelect(
  run: RunState,
  offerField: 'offer' | 'riteOffer' | 'revelationOffer' | 'oracleOffer' | 'cardSetOffer',
  pendingField: 'pendingNewItem' | 'pendingNewRite' | 'pendingNewRevelation' | 'pendingNewOracle' | null
): RunState {
  const pendingUpdate = pendingField ? { [pendingField]: null } : {}
  return { ...run, ...pendingUpdate, phase: 'shop', [offerField]: [], offerPickRemaining: 0 } as RunState
}

// 護符の福袋(itemSelect)から1つ選ぶ。所持上限到達時はpendingNewItemにセットしてスワップ待ちにする。
export function pickPackItem(params: ShidasuParams, run: RunState, itemId: ItemId): RunState {
  if (run.phase !== 'itemSelect' || !run.offer.includes(itemId)) return run
  if (run.items.length >= itemMaxCapacity(params, run)) {
    return { ...run, pendingNewItem: itemId }
  }
  const held = { instanceId: run.nextInstanceId, id: itemId }
  return resolvePackOfferPick({ ...run, items: [...run.items, held], nextInstanceId: run.nextInstanceId + 1 }, 'offer', 'pendingNewItem', run.offer, id => id === itemId)
}

// スワップ待ち中に既存の護符と入れ替えて確定する。oldInstanceIdは入れ替え対象の個体。
export function confirmPackItemSwap(run: RunState, oldInstanceId: number): RunState {
  if (run.phase !== 'itemSelect' || run.pendingNewItem === null) return run
  const idx = run.items.findIndex(h => h.instanceId === oldInstanceId)
  const remaining = idx === -1 ? [...run.items] : [...run.items.slice(0, idx), ...run.items.slice(idx + 1)]
  const newItemId = run.pendingNewItem
  const held = { instanceId: run.nextInstanceId, id: newItemId }
  return resolvePackOfferPick({ ...run, items: [...remaining, held], nextInstanceId: run.nextInstanceId + 1 }, 'offer', 'pendingNewItem', run.offer, id => id === newItemId)
}

export function cancelPackItemSwap(run: RunState): RunState {
  if (run.phase !== 'itemSelect') return run
  return { ...run, pendingNewItem: null }
}

// 残りの選択を放棄してshopへ戻る。
export function closePackItemSelect(run: RunState): RunState {
  if (run.phase !== 'itemSelect') return run
  return closePackOfferSelect(run, 'offer', 'pendingNewItem')
}

// 秘儀の福袋(riteSelect)から1つ選ぶ。所持上限(基本3、破魔矢所持時は拡張)到達時はpendingNewRiteにセットしてスワップ待ちにする。
export function pickPackRite(params: ShidasuParams, run: RunState, riteId: RiteId): RunState {
  if (run.phase !== 'riteSelect' || !run.riteOffer.includes(riteId)) return run
  if (run.rites.length >= riteMaxCapacity(params, run)) {
    return { ...run, pendingNewRite: riteId }
  }
  const held = { instanceId: run.nextInstanceId, id: riteId }
  return resolvePackOfferPick({ ...run, rites: [...run.rites, held], nextInstanceId: run.nextInstanceId + 1 }, 'riteOffer', 'pendingNewRite', run.riteOffer, id => id === riteId)
}

// oldInstanceIdは入れ替え対象の個体。
export function confirmPackRiteSwap(run: RunState, oldInstanceId: number): RunState {
  if (run.phase !== 'riteSelect' || run.pendingNewRite === null) return run
  const idx = run.rites.findIndex(h => h.instanceId === oldInstanceId)
  const remaining = idx === -1 ? [...run.rites] : [...run.rites.slice(0, idx), ...run.rites.slice(idx + 1)]
  const newRiteId = run.pendingNewRite
  const held = { instanceId: run.nextInstanceId, id: newRiteId }
  return resolvePackOfferPick({ ...run, rites: [...remaining, held], nextInstanceId: run.nextInstanceId + 1 }, 'riteOffer', 'pendingNewRite', run.riteOffer, id => id === newRiteId)
}

export function cancelPackRiteSwap(run: RunState): RunState {
  if (run.phase !== 'riteSelect') return run
  return { ...run, pendingNewRite: null }
}

export function closePackRiteSelect(run: RunState): RunState {
  if (run.phase !== 'riteSelect') return run
  return closePackOfferSelect(run, 'riteOffer', 'pendingNewRite')
}

// 天啓の福袋(revelationSelect)から1つ選び、その場で使用する(所持には加わらない、上限とは無関係)。
export function pickPackRevelationUse(params: ShidasuParams, run: RunState, revelationId: RevelationId, targetCol: number | null, rand: () => number = Math.random): RunState {
  if (run.phase !== 'revelationSelect' || !run.wave || !run.revelationOffer.includes(revelationId)) return run
  if (!canUseRevelation(params, run.wave, null, revelationId, run.relics)) return run
  const { wave, deckComposition } = applyRevelationEffect(params, run.wave, run.deckComposition, revelationId, targetCol, rand)
  const extraTableauRows = run.extraTableauRows
  return resolvePackOfferPick({ ...run, wave, deckComposition, extraTableauRows }, 'revelationOffer', 'pendingNewRevelation', run.revelationOffer, id => id === revelationId)
}

// 天啓の福袋から1つ選び、温存する(所持に加える)。天啓・神託合算上限(基本2、千羽鶴所持時は拡張)到達時はpendingNewRevelationにセットしスワップ待ちにする。
export function pickPackRevelationHold(params: ShidasuParams, run: RunState, revelationId: RevelationId): RunState {
  if (run.phase !== 'revelationSelect' || !run.revelationOffer.includes(revelationId)) return run
  if (run.revelations.length + run.oracles.length >= revelationOracleMaxCapacity(params, run)) {
    return { ...run, pendingNewRevelation: revelationId }
  }
  const held = { instanceId: run.nextInstanceId, id: revelationId }
  return resolvePackOfferPick({ ...run, revelations: [...run.revelations, held], nextInstanceId: run.nextInstanceId + 1 }, 'revelationOffer', 'pendingNewRevelation', run.revelationOffer, id => id === revelationId)
}

// スワップ待ち中、targetで指定した所持中の天啓または神託と入れ替えて確定する。
// targetはHeldRevelationOrOracleRef(instanceId込み)なので、対象個体をinstanceId一致で検索する。
export function confirmPackRevelationSwap(run: RunState, target: HeldRevelationOrOracleRef): RunState {
  if (run.phase !== 'revelationSelect' || run.pendingNewRevelation === null) return run
  const newId = run.pendingNewRevelation
  const held = { instanceId: run.nextInstanceId, id: newId }
  if (target.kind === 'revelation') {
    const idx = run.revelations.findIndex(h => h.instanceId === target.instanceId)
    const remaining = idx === -1 ? run.revelations : [...run.revelations.slice(0, idx), ...run.revelations.slice(idx + 1)]
    return resolvePackOfferPick({ ...run, revelations: [...remaining, held], nextInstanceId: run.nextInstanceId + 1 }, 'revelationOffer', 'pendingNewRevelation', run.revelationOffer, id => id === newId)
  }
  const idx = run.oracles.findIndex(h => h.instanceId === target.instanceId)
  const oracles = idx === -1 ? run.oracles : [...run.oracles.slice(0, idx), ...run.oracles.slice(idx + 1)]
  return resolvePackOfferPick({ ...run, oracles, revelations: [...run.revelations, held], nextInstanceId: run.nextInstanceId + 1 }, 'revelationOffer', 'pendingNewRevelation', run.revelationOffer, id => id === newId)
}

export function cancelPackRevelationSwap(run: RunState): RunState {
  if (run.phase !== 'revelationSelect') return run
  return { ...run, pendingNewRevelation: null }
}

export function closePackRevelationSelect(run: RunState): RunState {
  if (run.phase !== 'revelationSelect') return run
  return closePackOfferSelect(run, 'revelationOffer', 'pendingNewRevelation')
}

// 天啓・神託の合算所持枠(基本上限2、千羽鶴所持時は拡張)のうち、残り何枠使えるかを返す。
// 使用中の天啓自身がrunAfterRemoval.revelationsから既に取り除かれている前提(呼び出し側で保証する)。
function sharedRevelationSlotsRemaining(params: ShidasuParams, runAfterRemoval: RunState): number {
  return Math.max(0, revelationOracleMaxCapacity(params, runAfterRemoval) - (runAfterRemoval.revelations.length + runAfterRemoval.oracles.length))
}

// Phase B(即時報酬獲得系)天啓の付与ロジック。使用した天啓自身をrevelationsから取り除いた後の
// runState(runAfterRemoval)を受け取り、変化するフィールドだけを部分的に返す。対象外のIDには{}を返す
// (defaultケースがあるため、このswitchはRevelationIdに対して網羅的である必要はない)。
// wave/deckCompositionには影響しないため、applyRevelationEffect側は全てno-opになっている。
function grantRevelationReward(
  params: ShidasuParams,
  runAfterRemoval: RunState,
  revelationId: RevelationId,
  targetRelicId: RelicId | null,
  rand: () => number
): Partial<RunState> {
  switch (revelationId) {
    case 'kyo': {
      if (targetRelicId === null) return {}
      const relic = runAfterRemoval.relics.find(r => r.id === targetRelicId)
      if (!relic || relic.tsukumoka) return {}
      return { relics: runAfterRemoval.relics.map(r => (r.id === targetRelicId ? { ...r, tsukumoka: true } : r)) }
    }
    case 'subaru': {
      if (runAfterRemoval.items.length >= itemMaxCapacity(params, runAfterRemoval)) return {}
      const available = ITEM_POOL.filter(id => !runAfterRemoval.items.some(h => h.id === id))
      if (available.length === 0) return {}
      const picked = available[Math.floor(rand() * available.length)]
      const held = { instanceId: runAfterRemoval.nextInstanceId, id: picked }
      return { items: [...runAfterRemoval.items, held], nextInstanceId: runAfterRemoval.nextInstanceId + 1 }
    }
    case 'oni': {
      const ownedIds = new Set(runAfterRemoval.relics.map(r => r.id))
      const available = RELIC_POOL.filter(id => !ownedIds.has(id))
      if (available.length === 0) return {}
      const picked = available[Math.floor(rand() * available.length)]
      return { relics: [...runAfterRemoval.relics, { id: picked, tsukumoka: false }] }
    }
    case 'ryuu':
      return { currency: runAfterRemoval.currency * 2 }
    case 'hotori': {
      const target = runAfterRemoval.lastUsedRevelationId
      if (target === null) return {}
      if (sharedRevelationSlotsRemaining(params, runAfterRemoval) <= 0) return {}
      const held = { instanceId: runAfterRemoval.nextInstanceId, id: target }
      return { revelations: [...runAfterRemoval.revelations, held], nextInstanceId: runAfterRemoval.nextInstanceId + 1 }
    }
    case 'chou': {
      const slotsLeft = sharedRevelationSlotsRemaining(params, runAfterRemoval)
      if (slotsLeft === 0) return {}
      const picked = rollOffer(ORACLE_POOL, slotsLeft, rand)
      let nextId = runAfterRemoval.nextInstanceId
      const held = picked.map(id => ({ instanceId: nextId++, id }))
      return { oracles: [...runAfterRemoval.oracles, ...held], nextInstanceId: nextId }
    }
    case 'yoku': {
      const slotsLeft = sharedRevelationSlotsRemaining(params, runAfterRemoval)
      if (slotsLeft === 0) return {}
      const picked = rollOffer(REVELATION_POOL, slotsLeft, rand)
      let nextId = runAfterRemoval.nextInstanceId
      const held = picked.map(id => ({ instanceId: nextId++, id }))
      return { revelations: [...runAfterRemoval.revelations, ...held], nextInstanceId: nextId }
    }
    case 'mitsu': {
      const total = runAfterRemoval.items.reduce((sum, h) => sum + itemSellPrice(params, runAfterRemoval, h.id, h.sellBonus ?? 0), 0)
      return { currency: runAfterRemoval.currency + total }
    }
    case 'karasu': {
      // 秘儀の所持枠は基本上限3(破魔矢所持時は拡張)で、天啓・神託の合算枠(sharedRevelationSlotsRemaining)とは独立している。
      const slotsLeft = Math.max(0, riteMaxCapacity(params, runAfterRemoval) - runAfterRemoval.rites.length)
      if (slotsLeft === 0) return {}
      const picked = runAfterRemoval.recentUsedRiteIds.slice(0, slotsLeft)
      let nextId = runAfterRemoval.nextInstanceId
      const held = picked.map(id => ({ instanceId: nextId++, id }))
      return { rites: [...runAfterRemoval.rites, ...held], nextInstanceId: nextId }
    }
    default:
      return {}
  }
}

// 所持中の天啓を1つ使用する(消費される)。プレイ中・天啓選択画面のどちらでも動作し、
// フェーズは変えない(秘儀のuseRiteと同じ位置づけ)。instanceIdは対象の個体
// (封印精度・重複所持時の対象特定に使う)。呼び出し元(UI)はクリックされたバッジの
// instanceIdをそのまま渡す。
export function useRevelation(
  params: ShidasuParams,
  run: RunState,
  instanceId: number,
  revelationId: RevelationId,
  targetCol: number | null,
  rand: () => number = Math.random,
  targetRelicId: RelicId | null = null
): RunState {
  if ((run.phase !== 'playing' && !SHOP_FLOW_PHASES.includes(run.phase)) || !run.wave || run.wave.status !== 'playing') return run
  const idx = run.revelations.findIndex(h => h.instanceId === instanceId)
  if (idx === -1) return run
  if (!canUseRevelation(params, run.wave, instanceId, revelationId, run.relics)) return run
  let { wave, deckComposition } = applyRevelationEffect(params, run.wave, run.deckComposition, revelationId, targetCol, rand)
  wave = applyDiscretionFrostBonus(params, run, wave)
  const extraTableauRows = run.extraTableauRows
  const revelations = [...run.revelations.slice(0, idx), ...run.revelations.slice(idx + 1)]
  const reward = grantRevelationReward(params, { ...run, revelations }, revelationId, targetRelicId, rand)
  // 星(hotori)自身の使用は履歴に残さない(自己参照ループを防ぐ。詳細はtypes.tsのlastUsedRevelationIdコメント参照)
  const lastUsedRevelationId = revelationId === 'hotori' ? run.lastUsedRevelationId : revelationId
  return { ...run, wave, deckComposition, revelations, extraTableauRows, lastUsedRevelationId, ...reward }
}

// 神託の福袋(oracleSelect)から1つ選び、その場で使用する(役レベル+1、所持には加わらない、上限とは無関係)。
// run.oracleLevelsだけでなくwave.oracleLevelsも同期する。得点計算時にwave.oracleLevelsが参照されるため、
// 同期を怠ると効果が次のウェーブまで反映されない不整合が起きる。
export function pickPackOracleUse(run: RunState, roleName: RoleName): RunState {
  if (run.phase !== 'oracleSelect' || !run.oracleOffer.includes(roleName)) return run
  const oracleLevels = { ...run.oracleLevels, [roleName]: run.oracleLevels[roleName] + 1 }
  const wave = run.wave ? { ...run.wave, oracleLevels } : run.wave
  return resolvePackOfferPick({ ...run, oracleLevels, wave }, 'oracleOffer', 'pendingNewOracle', run.oracleOffer, role => role === roleName)
}

// 神託の福袋から1つ選び、温存する(所持に加える)。天啓・神託合算上限(基本2、千羽鶴所持時は拡張)到達時はpendingNewOracleにセットしスワップ待ちにする。
export function pickPackOracleHold(params: ShidasuParams, run: RunState, roleName: RoleName): RunState {
  if (run.phase !== 'oracleSelect' || !run.oracleOffer.includes(roleName)) return run
  if (run.revelations.length + run.oracles.length >= revelationOracleMaxCapacity(params, run)) {
    return { ...run, pendingNewOracle: roleName }
  }
  const held = { instanceId: run.nextInstanceId, id: roleName }
  return resolvePackOfferPick({ ...run, oracles: [...run.oracles, held], nextInstanceId: run.nextInstanceId + 1 }, 'oracleOffer', 'pendingNewOracle', run.oracleOffer, role => role === roleName)
}

// スワップ待ち中、targetで指定した所持中の天啓または神託と入れ替えて確定する。
export function confirmPackOracleSwap(run: RunState, target: HeldRevelationOrOracleRef): RunState {
  if (run.phase !== 'oracleSelect' || run.pendingNewOracle === null) return run
  const newRole = run.pendingNewOracle
  const held = { instanceId: run.nextInstanceId, id: newRole }
  if (target.kind === 'oracle') {
    const idx = run.oracles.findIndex(h => h.instanceId === target.instanceId)
    const remaining = idx === -1 ? run.oracles : [...run.oracles.slice(0, idx), ...run.oracles.slice(idx + 1)]
    return resolvePackOfferPick({ ...run, oracles: [...remaining, held], nextInstanceId: run.nextInstanceId + 1 }, 'oracleOffer', 'pendingNewOracle', run.oracleOffer, role => role === newRole)
  }
  const idx = run.revelations.findIndex(h => h.instanceId === target.instanceId)
  const revelations = idx === -1 ? run.revelations : [...run.revelations.slice(0, idx), ...run.revelations.slice(idx + 1)]
  return resolvePackOfferPick({ ...run, revelations, oracles: [...run.oracles, held], nextInstanceId: run.nextInstanceId + 1 }, 'oracleOffer', 'pendingNewOracle', run.oracleOffer, role => role === newRole)
}

export function cancelPackOracleSwap(run: RunState): RunState {
  if (run.phase !== 'oracleSelect') return run
  return { ...run, pendingNewOracle: null }
}

export function closePackOracleSelect(run: RunState): RunState {
  if (run.phase !== 'oracleSelect') return run
  return closePackOfferSelect(run, 'oracleOffer', 'pendingNewOracle')
}

// カードセットの福袋(cardSetSelect)から1つ選び、そのカードをdeckCompositionへ即座に追加する。
// 護符・秘儀・天啓/神託と異なり所持枠・スワップ処理は無い(選択即確定)。
// deckIdはこの時点のdeckComposition長を基準に採番する(addCardsToDeckComposition、deck.ts参照)。
export function pickPackCardSet(run: RunState, genreId: CardSetGenreId): RunState {
  if (run.phase !== 'cardSetSelect') return run
  const offer = run.cardSetOffer.find(o => o.genreId === genreId)
  if (!offer) return run
  const deckComposition = addCardsToDeckComposition(run.deckComposition, offer.cards)
  return resolvePackOfferPick({ ...run, deckComposition }, 'cardSetOffer', null, run.cardSetOffer, o => o.genreId === genreId)
}

// 残りの選択を放棄してshopへ戻る。
export function closePackCardSetSelect(run: RunState): RunState {
  if (run.phase !== 'cardSetSelect') return run
  return closePackOfferSelect(run, 'cardSetOffer', null)
}

// 所持中の神託を1つ消費する。playingフェーズでのみ呼べる(ショップ内フェーズでは呼べない)。
// run/wave両方のoracleLevelsを同期する。盤面への直接効果は無い。神託はoracleLevelsという
// 役名単位の集計値に効果が還元されるため(封印もoracleBaselineRoleという役名ベース)、
// 個体を指定する必要が無く、シグネチャは従来通りroleNameのまま(同名の先頭1個を消費する)。
export function useOracle(params: ShidasuParams, run: RunState, roleName: RoleName): RunState {
  if (run.phase !== 'playing') return run
  const idx = run.oracles.findIndex(h => h.id === roleName)
  if (idx === -1) return run
  const oracles = [...run.oracles.slice(0, idx), ...run.oracles.slice(idx + 1)]
  const oracleLevels = { ...run.oracleLevels, [roleName]: run.oracleLevels[roleName] + 1 }
  let wave = run.wave ? { ...run.wave, oracleLevels } : run.wave
  if (wave) wave = applyDiscretionFrostBonus(params, run, wave)
  return { ...run, oracles, oracleLevels, wave }
}

// 所持護符の並び順をfromIndexからtoIndexへ移動する。加算・倍算型護符の適用順(左から順に適用)を
// プレイヤーが調整できるようにするためのショップ画面向けの並べ替え操作。
// 配列内の1要素をfromIndexからtoIndexへ移動した新しい配列を返す(元の配列は変更しない)。
// プレイ中画面・デバッグ画面の護符バッジドラッグ並べ替えが共通で使う汎用ロジック。
export function moveArrayItem<T>(arr: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex) return arr
  const next = [...arr]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next
}

export function reorderItems(run: RunState, fromIndex: number, toIndex: number): RunState {
  if (fromIndex === toIndex) return run
  return { ...run, items: moveArrayItem(run.items, fromIndex, toIndex) }
}

// 所持配列から1個を売却し、通貨を得る共通処理。playing/shopフェーズでのみ呼べる。
// フィールドの動的キーアクセスのため戻り値をRunStateにキャストしている(呼び出し元は
// 決まった4パターンに限定されるため、型安全性は既存テストで担保する。福袋pick系リファクタの
// resolvePackOfferPickと同じ理由・同じパターン)。instanceIdで対象個体を一意に特定する。
function sellFromArray<T>(run: RunState, arrayField: 'items' | 'rites' | 'revelations' | 'oracles', arr: { instanceId: number; id: T }[], instanceId: number, price: number): RunState {
  if (run.phase !== 'playing' && run.phase !== 'shop') return run
  const idx = arr.findIndex(h => h.instanceId === instanceId)
  if (idx === -1) return run
  const newArr = [...arr.slice(0, idx), ...arr.slice(idx + 1)]
  return { ...run, [arrayField]: newArr, currency: run.currency + price } as RunState
}

// 所持中の護符を1個売却し、通貨を得る。playing/shopフェーズでのみ呼べる。instanceIdで対象個体を特定し、
// itemIdは価格計算(itemSellPrice)に使う。
export function sellItem(params: ShidasuParams, run: RunState, instanceId: number, itemId: ItemId): RunState {
  const held = run.items.find(h => h.instanceId === instanceId)
  return sellFromArray(run, 'items', run.items, instanceId, itemSellPrice(params, run, itemId, held?.sellBonus ?? 0))
}

// 所持中の秘儀を1個売却し、通貨を得る。playing/shopフェーズでのみ呼べる。
export function sellRite(params: ShidasuParams, run: RunState, instanceId: number, riteId: RiteId): RunState {
  return sellFromArray(run, 'rites', run.rites, instanceId, riteSellPrice(params, run))
}

// 所持中の天啓を1個売却し、通貨を得る。playing/shopフェーズでのみ呼べる。
export function sellRevelation(params: ShidasuParams, run: RunState, instanceId: number, revelationId: RevelationId): RunState {
  return sellFromArray(run, 'revelations', run.revelations, instanceId, revelationSellPrice(params, run))
}

// 所持中の神託を1個売却し、通貨を得る。playing/shopフェーズでのみ呼べる。
export function sellOracle(params: ShidasuParams, run: RunState, instanceId: number, roleName: RoleName): RunState {
  return sellFromArray(run, 'oracles', run.oracles, instanceId, oracleSellPrice(params, run))
}

// 大凶クリア後の続行確認画面('continueChoice'フェーズ)で「続ける」を選んだ場合。
// 通常のウェーブクリアと同じくショップへ進む(ステージ繰り上がり・大凶スート抽選もenterShopが担う)。
// 所持中の護符・秘儀・天啓・神託レベルはこのrunをそのまま引き継ぐため、リセットされない。
export function continueAfterGreatMisfortune(params: ShidasuParams, run: RunState, rand: () => number = Math.random, seed?: number): RunState {
  if (run.phase !== 'continueChoice') return run
  return enterShop(params, run, seed, rand)
}

// 大凶クリア後の続行確認画面で「やめる」を選んだ場合。結果画面(allClear)へ遷移する。
export function stopAfterGreatMisfortune(run: RunState): RunState {
  if (run.phase !== 'continueChoice') return run
  return { ...run, phase: 'allClear' }
}

export function restartRun(params: ShidasuParams, seed?: number): RunState {
  return beginRun(params, seed)
}

// playCard/drawStock呼び出しに必要な文脈値(目標スコア・得点ロック・実効護符・役封印効果・コンボ上限)をまとめて算出する。
// stageModifierFor(modifier)はここに含めない: applyStuckCheckがisStuck判定より前に単独で必要とするため、
// このヘルパーに含めると呼び出し元で二重計算・不自然な分離が発生する。
function resolvePlayContext(params: ShidasuParams, run: RunState, wave: WaveState) {
  return {
    target: waveTarget(params, run.stageIndex, run.waveIndex, run.stageStars),
    scoreLock: bossScoreLockFor(params, run),
    effectiveItems: resolveEffectiveItems(run.items, wave.activeSeal),
    sealedRoleEffect: resolveSealedRoleEffect(wave.activeSeal),
    comboCap: resolveComboCap(wave.activeSeal),
  }
}

// playCard/drawStock適用後、妨害発動タイミング(sabotageTurnsRemaining<=0)なら即座にtriggerSabotageを適用する。
function resolveActionSabotage(params: ShidasuParams, next: RunState, wave: WaveState, rand: () => number): RunState {
  if (wave.pendingSabotageId && wave.sabotageTurnsRemaining <= 0) {
    return triggerSabotage(params, next, wave.pendingSabotageId, rand)
  }
  return next
}

export function applyPlayCard(params: ShidasuParams, run: RunState, colIndex: number, rand: () => number = Math.random, rowIndex?: number): RunState {
  if (run.phase !== 'playing' || !run.wave) return run
  const modifier = stageModifierFor(params, run)
  const { target, scoreLock, effectiveItems, sealedRoleEffect, comboCap } = resolvePlayContext(params, run, run.wave)
  const { wave, deckComposition, rewardTalismanTrigger } = playCard(params, run.wave, modifier, effectiveItems, target, colIndex, run.deckComposition, rand, scoreLock, rowIndex, sealedRoleEffect, comboCap)
  const items = applyRewardTalismanTrigger(run.items, rewardTalismanTrigger)
  return resolveActionSabotage(params, { ...run, wave, deckComposition, items }, wave, rand)
}

// トリガーが成立した護符idについて、所持する全個体のsellBonusへ加算する(同名複数所持時は全個体に適用)。
// Task 4の契約により、triggeredIdsに含まれるidは必ずamountsにも確定値を持つ(0扱いへのフォールバック不要)。
function applyRewardTalismanTrigger(items: HeldItem[], trigger: RewardTalismanTriggerResult): HeldItem[] {
  if (trigger.triggeredIds.length === 0) return items
  return items.map(h => {
    const amount = trigger.amounts[h.id]
    if (amount === undefined) return h
    return { ...h, sellBonus: (h.sellBonus ?? 0) + amount }
  })
}

export function applyDrawStock(params: ShidasuParams, run: RunState, rand: () => number = Math.random): RunState {
  if (run.phase !== 'playing' || !run.wave) return run
  const modifier = stageModifierFor(params, run)
  const { target, scoreLock, effectiveItems, sealedRoleEffect, comboCap } = resolvePlayContext(params, run, run.wave)
  const { wave, deckComposition } = drawStock(params, run.wave, effectiveItems, target, run.deckComposition, modifier, rand, scoreLock, sealedRoleEffect, comboCap)
  return resolveActionSabotage(params, { ...run, wave, deckComposition }, wave, rand)
}

// 手詰まり判定と、手詰まり時の護符(治癒・不屈)による救済処理を行う。
// 不屈: コンボリセットしチェーンのカードを捨て札へ送った上で、スコアの一定割合を消費して
// 捨て札の約半数を山札へ戻す。その後、山札を1枚捲って(drawStockと同じロジック)手詰まりを回避する。
// ウェーブ中1回のみ発動する。発動条件を満たさなければ通常通り手詰まり終了とする。
export function applyStuckCheck(params: ShidasuParams, run: RunState, rand: () => number = Math.random): RunState {
  if (run.phase !== 'playing' || !run.wave) return run
  const modifier = stageModifierFor(params, run)
  const wave = run.wave
  if (!isStuck(modifier, wave, run.rites.map(h => h.id))) return run

  let resetWave = resetComboFields(wave, params)

  for (const { id } of run.items) {
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
    const { target: stageTarget, scoreLock, effectiveItems, sealedRoleEffect, comboCap } = resolvePlayContext(params, run, resetWave)
    const drawResult = drawStock(params, resetWave, effectiveItems, stageTarget, run.deckComposition, modifier, rand, scoreLock, sealedRoleEffect, comboCap)
    return resolveActionSabotage(params, { ...run, wave: drawResult.wave, deckComposition: drawResult.deckComposition }, drawResult.wave, rand)
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
