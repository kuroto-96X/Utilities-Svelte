import { describe, test, expect } from 'vitest'
import { applyRiteEffect, canUseRite } from './riteEffects'
import { DEFAULT_PARAMS } from './params'
import { createRng } from './deck'
import type { Card, WaveState } from './types'
import { defaultOracleLevels } from './oracles'

function card(id: number, suit: Card['suit'], rank: Card['rank'], wild = false, deckId = id): Card {
  return { id, deckId, suit, rank, wild }
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
    nextPlayScoreMultiplier: 1,
    oracleLevels: defaultOracleLevels(),
    ...overrides,
  }
}

describe('riteEffects', () => {
  test('ライドー: 絵札とワイルドはそのままに、非絵札だけ山札と入れ替えて配り直す', () => {
    const wave = baseWave({
      tableau: [[card(1, '♠', 11), card(2, '♦', 5, true), card(3, '♣', 5)]],
      stock: [card(10, '♥', 7), card(11, '♥', 8)],
    })
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'raidho', createRng(1))
    expect(next.tableau[0][0]).toEqual(wave.tableau[0][0])
    expect(next.tableau[0][1]).toEqual(wave.tableau[0][1])
    expect(next.tableau[0]).toHaveLength(3)
    expect(next.stock).toHaveLength(2)
    const allIds = [...next.tableau.flat(), ...next.stock].map(c => c.id).sort((a, b) => a - b)
    expect(allIds).toEqual([1, 2, 3, 10, 11])
  })

  test('ライドー: 非絵札が場に無ければ何もしない', () => {
    const wave = baseWave({
      tableau: [[card(1, '♠', 11), card(2, '♦', 5, true)]],
      stock: [card(10, '♥', 7)],
    })
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'raidho', createRng(1))
    expect(next).toEqual(wave)
  })

  test('ウンヨー: 場札を捨て札に合流→シャッフル→各列の元の枚数を維持して配り直す(山札は不変)', () => {
    const wave = baseWave({
      tableau: [[card(1, '♠', 5), card(2, '♦', 9)], [card(3, '♣', 2)]],
      discardPile: [card(10, '♥', 4), card(11, '♥', 7)],
      stock: [card(20, '♠', 3)],
    })
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'wunjo', createRng(1))
    expect(next.tableau[0]).toHaveLength(2)
    expect(next.tableau[1]).toHaveLength(1)
    expect(next.stock).toEqual(wave.stock)
    const allIds = [...next.tableau.flat(), ...next.discardPile].map(c => c.id).sort((a, b) => a - b)
    expect(allIds).toEqual([1, 2, 3, 10, 11])
  })

  test('オセラ: 山札で最多のランクを場札に合流し、列数を変えずラウンドロビンで配り直す', () => {
    const wave = baseWave({
      tableau: [[card(1, '♠', 5)], [card(2, '♦', 5)]],
      stock: [card(10, '♥', 7), card(11, '♣', 7), card(12, '♠', 7), card(13, '♦', 3)],
    })
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'othala', createRng(1))
    expect(next.stock).toHaveLength(1)
    expect(next.stock[0].id).toBe(13)
    expect(next.tableau).toHaveLength(2)
    const tableauIds = next.tableau.flat().map(c => c.id).sort((a, b) => a - b)
    expect(tableauIds).toEqual([1, 2, 10, 11, 12])
  })

  test('オセラ: 山札が空なら何もしない', () => {
    const wave = baseWave({ tableau: [[card(1, '♠', 5)]], stock: [] })
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'othala', createRng(1))
    expect(next).toEqual(wave)
  })

  test('イェラ: 各列がソートされる', () => {
    const wave = baseWave({ tableau: [[card(1, '♠', 9), card(2, '♦', 2), card(3, '♣', 5)]] })
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'jera', createRng(1))
    const ranks = next.tableau[0].map(c => c.rank)
    const isAscending = ranks[0] <= ranks[1] && ranks[1] <= ranks[2]
    const isDescending = ranks[0] >= ranks[1] && ranks[1] >= ranks[2]
    expect(isAscending || isDescending).toBe(true)
  })

  test('ウルズ: 現在のコンボ数にnが加算される', () => {
    const wave = baseWave({ combo: 2, maxComboThisWave: 2 })
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'uruz', createRng(1))
    expect(next.combo).toBe(2 + DEFAULT_PARAMS.rites.uruz.n)
    expect(next.maxComboThisWave).toBe(next.combo)
  })

  test('イサ発動中はウルズを使ってもコンボ数が変わらない', () => {
    const wave = baseWave({ combo: 2, maxComboThisWave: 2, comboFrozenThisWave: true })
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'uruz', createRng(1))
    expect(next.combo).toBe(2)
  })

  test('イングズ: 基礎コンボ数にnが加算される(現在のコンボ数は変わらない)', () => {
    const wave = baseWave({ combo: 2, baseComboCount: 0 })
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'ingwaz', createRng(1))
    expect(next.baseComboCount).toBe(DEFAULT_PARAMS.rites.ingwaz.n)
    expect(next.combo).toBe(2)
  })

  test('ゲボ: 捨て札が列数未満なら使用不可', () => {
    const wave = baseWave({ tableau: [[card(1, '♠', 5)], [card(2, '♦', 5)]], discardPile: [card(10, '♣', 1)] })
    expect(canUseRite(DEFAULT_PARAMS, wave, 'gebo')).toBe(false)
  })

  test('ゲボ: 捨て札から各列に1枚ずつ配置される', () => {
    const wave = baseWave({
      tableau: [[card(1, '♠', 5)], [card(2, '♦', 5)]],
      discardPile: [card(10, '♣', 1), card(11, '♣', 2), card(12, '♣', 3)],
    })
    expect(canUseRite(DEFAULT_PARAMS, wave, 'gebo')).toBe(true)
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'gebo', createRng(1))
    expect(next.tableau[0]).toHaveLength(2)
    expect(next.tableau[1]).toHaveLength(2)
    expect(next.discardPile).toHaveLength(1)
  })

  test('フェフ: 山札の残りが列数以下なら使用不可', () => {
    const wave = baseWave({ tableau: [[card(1, '♠', 5)], [card(2, '♦', 5)]], stock: [card(20, '♣', 1), card(21, '♣', 2)] })
    expect(canUseRite(DEFAULT_PARAMS, wave, 'fehu')).toBe(false)
  })

  test('フェフ: 山札の上から各列に1枚ずつ配置される', () => {
    const wave = baseWave({
      tableau: [[card(1, '♠', 5)], [card(2, '♦', 5)]],
      stock: [card(20, '♣', 1), card(21, '♣', 2), card(22, '♣', 3)],
    })
    expect(canUseRite(DEFAULT_PARAMS, wave, 'fehu')).toBe(true)
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'fehu', createRng(1))
    expect(next.tableau[0]).toHaveLength(2)
    expect(next.tableau[1]).toHaveLength(2)
    expect(next.stock).toHaveLength(1)
  })

  test('ダガズ: 捨て札が山札に加わりシャッフルされる', () => {
    const wave = baseWave({ stock: [card(20, '♣', 1)], discardPile: [card(10, '♦', 2), card(11, '♦', 3)] })
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'dagaz', createRng(1))
    expect(next.stock).toHaveLength(3)
    expect(next.discardPile).toHaveLength(0)
  })

  test('アルギズ: playFromAnywhereActiveThisWaveがtrueになる', () => {
    const wave = baseWave()
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'algiz', createRng(1))
    expect(next.playFromAnywhereActiveThisWave).toBe(true)
  })

  test('エイワズ: コンボリセット防止残り回数にnが加算される', () => {
    const wave = baseWave({ comboResetShieldRemaining: 1 })
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'eihwaz', createRng(1))
    expect(next.comboResetShieldRemaining).toBe(1 + DEFAULT_PARAMS.rites.eihwaz.n)
  })

  test('ハガラズ: 場札と山札が合流・シャッフルされ、各列の枚数を維持したまま配り直される', () => {
    const wave = baseWave({
      tableau: [[card(1, '♠', 5), card(2, '♦', 9)], [card(3, '♣', 2)]],
      stock: [card(10, '♥', 4), card(11, '♥', 7), card(12, '♠', 1)],
    })
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'hagalaz', createRng(1))
    expect(next.tableau[0]).toHaveLength(2)
    expect(next.tableau[1]).toHaveLength(1)
    expect(next.stock).toHaveLength(3)
    const allIds = [...next.tableau.flat(), ...next.stock].map(c => c.id).sort((a, b) => a - b)
    expect(allIds).toEqual([1, 2, 3, 10, 11, 12])
    expect(next.foundation).toEqual(wave.foundation)
    expect(next.combo).toBe(wave.combo)
  })

  test('ナウジズ: nauthizActiveThisWaveがtrueになる', () => {
    const wave = baseWave()
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'nauthiz', createRng(1))
    expect(next.nauthizActiveThisWave).toBe(true)
  })

  test('イサ: comboFrozenThisWaveがtrueになる', () => {
    const wave = baseWave()
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'isa', createRng(1))
    expect(next.comboFrozenThisWave).toBe(true)
  })

  test('ソウィロ: sowiloActiveThisWaveがtrueになりsowiloBoostedRoleはまだnull', () => {
    const wave = baseWave()
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'sowilo', createRng(1))
    expect(next.sowiloActiveThisWave).toBe(true)
    expect(next.sowiloBoostedRole).toBeNull()
  })

  test('ベルカナ: 現在のコンボ数がx倍になる(切り捨て)', () => {
    const wave = baseWave({ combo: 5, maxComboThisWave: 5 })
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'berkano', createRng(1))
    expect(next.combo).toBe(Math.floor(5 * DEFAULT_PARAMS.rites.berkano.x))
    expect(next.maxComboThisWave).toBe(next.combo)
  })

  test('イサ発動中はベルカナを使ってもコンボ数が変わらない', () => {
    const wave = baseWave({ combo: 2, maxComboThisWave: 2, comboFrozenThisWave: true })
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'berkano', createRng(1))
    expect(next.combo).toBe(2)
  })

  test('マンナズ: mannazActiveThisWaveがtrueになる', () => {
    const wave = baseWave()
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'mannaz', createRng(1))
    expect(next.mannazActiveThisWave).toBe(true)
  })

  test('エワズ: ehwazActiveThisWaveがtrueになる', () => {
    const wave = baseWave()
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'ehwaz', createRng(1))
    expect(next.ehwazActiveThisWave).toBe(true)
  })
})
