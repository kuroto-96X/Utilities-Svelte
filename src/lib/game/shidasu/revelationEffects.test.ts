import { describe, test, expect } from 'vitest'
import { applyRevelationEffect, canUseRevelation, revelationNeedsTarget } from './revelationEffects'
import { DEFAULT_PARAMS } from './params'
import { createRng } from './deck'
import type { Card, DeckCard, WaveState } from './types'
import { defaultOracleLevels } from './oracles'

function card(id: number, suit: Card['suit'], rank: Card['rank'], wild = false, deckId = id): Card {
  return { id, deckId, suit, rank, wild }
}

function deckCard(deckId: number, suit: DeckCard['suit'], rank: DeckCard['rank'], wild = false): DeckCard {
  return { deckId, suit, rank, wild }
}

function baseWave(overrides: Partial<WaveState> = {}): WaveState {
  return {
    tableau: [[card(1, '♠', 5)]],
    stock: [],
    foundation: card(2, '♥', 6),
    score: 100,
    combo: 2,
    chain: [card(2, '♥', 6)],
    chainOrigin: ['draw'],
    linked: false,
    columnsEmptiedThisCombo: 0,
    comboStreakColumnLengths: [1],
    dealtRows: DEFAULT_PARAMS.layout.rows,
    lastDrawEffect: null,
    status: 'playing',
    endReason: null,
    lastGain: null,
    lastBonusGains: [],
    firstPlayDone: true,
    discardPile: [],
    lastPlayedColumn: null,
    sameColumnStreak: 0,
    maxComboThisWave: 2,
    totalColumnsEmptiedThisWave: 0,
    roleFiredThisChain: false,
    drawContinueCountThisChain: 0,
    flushActiveThisCombo: false,
    columnSweepActiveThisWave: false,
    benevolenceUsedThisCombo: false,
    baseComboCount: 0,
    dedicationX: 1,
    diligenceX: 1,
    divineProtectionX: 1,
    discretionN: 10,
    frostX: 1,
    echoX: 1,
    shootingStarN: 50,
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
    oracleLevels: defaultOracleLevels(),
    ...overrides,
  }
}

describe('revelationEffects', () => {
  test('角: 選んだ列の非ワイルドカードが全て♠に変換され、deckCompositionにも反映される', () => {
    const wave = baseWave({ tableau: [[card(1, '♥', 3), card(2, '♦', 4), card(3, '♠', 5, true)]] })
    const deckComposition: DeckCard[] = [deckCard(1, '♥', 3), deckCard(2, '♦', 4), deckCard(3, '♠', 5, true)]
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'kaku', 0, createRng(1))
    expect(result.wave.tableau[0].map(c => c.suit)).toEqual(['♠', '♠', '♠'])
    expect(result.wave.tableau[0][2].wild).toBe(true) // ワイルドはスート変更されない
    expect(result.deckComposition.find(c => c.deckId === 1)?.suit).toBe('♠')
    expect(result.deckComposition.find(c => c.deckId === 2)?.suit).toBe('♠')
    expect(result.deckComposition.find(c => c.deckId === 3)?.suit).toBe('♠') // ワイルドのdeckCompositionエントリも変更しない
  })

  test('角: targetColがnullなら何もしない', () => {
    const wave = baseWave({ tableau: [[card(1, '♥', 3)]] })
    const deckComposition: DeckCard[] = [deckCard(1, '♥', 3)]
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'kaku', null, createRng(1))
    expect(result.wave).toBe(wave)
    expect(result.deckComposition).toBe(deckComposition)
  })

  test('心: 場札全体の♠が全て♥に変換され、deckCompositionにも反映される(他のスートは対象外)', () => {
    const wave = baseWave({
      tableau: [[card(1, '♠', 3), card(2, '♦', 4)], [card(3, '♠', 5, true)]],
    })
    const deckComposition: DeckCard[] = [deckCard(1, '♠', 3), deckCard(2, '♦', 4), deckCard(3, '♠', 5, true)]
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'shin', null, createRng(1))
    expect(result.wave.tableau[0][0].suit).toBe('♥')
    expect(result.wave.tableau[0][1].suit).toBe('♦') // ♦は対象外
    expect(result.wave.tableau[1][0].suit).toBe('♠') // ワイルドは対象外
    expect(result.deckComposition.find(c => c.deckId === 1)?.suit).toBe('♥')
    expect(result.deckComposition.find(c => c.deckId === 3)?.suit).toBe('♠')
  })

  test('牛: 選んだ列の非ワイルドカードがA〜10のいずれかへ個別ランダムに変換される', () => {
    const wave = baseWave({ tableau: [[card(1, '♠', 11), card(2, '♦', 12), card(3, '♠', 13, true)]] })
    const deckComposition: DeckCard[] = [deckCard(1, '♠', 11), deckCard(2, '♦', 12), deckCard(3, '♠', 13, true)]
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'gyu', 0, createRng(1))
    expect(result.wave.tableau[0][0].rank).toBeGreaterThanOrEqual(1)
    expect(result.wave.tableau[0][0].rank).toBeLessThanOrEqual(10)
    expect(result.wave.tableau[0][1].rank).toBeGreaterThanOrEqual(1)
    expect(result.wave.tableau[0][1].rank).toBeLessThanOrEqual(10)
    expect(result.wave.tableau[0][2].rank).toBe(13) // ワイルドは変換されない
    expect(result.deckComposition.find(c => c.deckId === 1)?.rank).toBe(result.wave.tableau[0][0].rank)
  })

  test('女: 選んだ列の非ワイルドカードがJ・Q・Kのいずれかへ個別ランダムに変換される', () => {
    const wave = baseWave({ tableau: [[card(1, '♠', 1), card(2, '♦', 2)]] })
    const deckComposition: DeckCard[] = [deckCard(1, '♠', 1), deckCard(2, '♦', 2)]
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'jo', 0, createRng(1))
    expect(result.wave.tableau[0][0].rank).toBeGreaterThanOrEqual(11)
    expect(result.wave.tableau[0][1].rank).toBeGreaterThanOrEqual(11)
  })

  test('虚: 山札の上からn行(列数×n枚)を各列の末尾に配る', () => {
    const wave = baseWave({
      tableau: [[card(1, '♠', 1)], [card(2, '♠', 2)]],
      stock: [card(10, '♦', 9), card(11, '♦', 8), card(12, '♦', 7), card(13, '♦', 6)],
    })
    const deckComposition: DeckCard[] = []
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'kyo', null, createRng(1))
    // n=1(既定)、列数2なので2枚配られ、山札は2枚残る
    expect(result.wave.tableau[0]).toHaveLength(2)
    expect(result.wave.tableau[1]).toHaveLength(2)
    expect(result.wave.stock).toHaveLength(2)
    // 山札の一番上(末尾)から順に配られる
    expect(result.wave.tableau[0][1]).toEqual(card(13, '♦', 6))
    expect(result.wave.tableau[1][1]).toEqual(card(12, '♦', 7))
  })

  test('虚: 使用条件は山札が(列数×n)枚以上であること', () => {
    const wave = baseWave({
      tableau: [[card(1, '♠', 1)], [card(2, '♠', 2)]],
      stock: [card(10, '♦', 9)],
    })
    expect(canUseRevelation(DEFAULT_PARAMS, wave, 'kyo')).toBe(false)
    const wave2 = baseWave({
      tableau: [[card(1, '♠', 1)], [card(2, '♠', 2)]],
      stock: [card(10, '♦', 9), card(11, '♦', 8)],
    })
    expect(canUseRevelation(DEFAULT_PARAMS, wave2, 'kyo')).toBe(true)
  })

  test('危: 選んだ列の一番上にワイルドが追加され、deckCompositionにも新規ワイルドエントリが1件追加される', () => {
    const wave = baseWave({ tableau: [[card(1, '♠', 1)], []] })
    const deckComposition: DeckCard[] = [deckCard(1, '♠', 1)]
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'aya', 1, createRng(1))
    expect(result.wave.tableau[1]).toHaveLength(1)
    expect(result.wave.tableau[1][0].wild).toBe(true)
    expect(result.deckComposition).toHaveLength(2)
    expect(result.deckComposition[1].wild).toBe(true)
  })

  test('revelationNeedsTarget: 列選択が必要な種類とそうでない種類を正しく区別する', () => {
    expect(revelationNeedsTarget('kaku')).toBe(true)
    expect(revelationNeedsTarget('gyu')).toBe(true)
    expect(revelationNeedsTarget('jo')).toBe(true)
    expect(revelationNeedsTarget('aya')).toBe(true)
    expect(revelationNeedsTarget('shin')).toBe(false)
    expect(revelationNeedsTarget('kyo')).toBe(false)
  })
})
