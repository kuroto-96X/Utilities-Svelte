import { describe, test, expect } from 'vitest'
import { applyRiteEffect, canUseRite } from './riteEffects'
import { DEFAULT_PARAMS } from './params'
import { createRng } from './deck'
import type { Card, WaveState } from './types'

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
    ...overrides,
  }
}

describe('riteEffects', () => {
  test('ライドー: ランダムな1列が最下段起点の階段になる', () => {
    const wave = baseWave({ tableau: [[card(1, '♠', 5), card(2, '♦', 9), card(3, '♣', 2)]] })
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'raidho', createRng(1))
    const ranks = next.tableau[0].map(c => c.rank)
    expect(ranks[0]).toBe(5)
    // 各段の差は循環で+1(昇順)または+12=-1(降順)。列全体で方向が一貫していることを検証する。
    const step = (a: number, b: number) => ((b - a) % 13 + 13) % 13
    const dir = step(ranks[0], ranks[1])
    expect([1, 12]).toContain(dir)
    for (let i = 1; i < ranks.length; i++) {
      expect(step(ranks[i - 1], ranks[i])).toBe(dir)
    }
  })

  test('イェラ: 各列がソートされる', () => {
    const wave = baseWave({ tableau: [[card(1, '♠', 9), card(2, '♦', 2), card(3, '♣', 5)]] })
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'jera', createRng(1))
    const ranks = next.tableau[0].map(c => c.rank)
    const isAscending = ranks[0] <= ranks[1] && ranks[1] <= ranks[2]
    const isDescending = ranks[0] >= ranks[1] && ranks[1] >= ranks[2]
    expect(isAscending || isDescending).toBe(true)
  })

  test('ウンヨー: 場札が一番多い色に統一される(ワイルドは対象外)', () => {
    const wave = baseWave({
      tableau: [[card(1, '♥', 3), card(2, '♦', 4), card(3, '♠', 5, true)]],
    })
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'wunjo', createRng(1))
    expect(next.tableau[0][0].suit === '♥' || next.tableau[0][0].suit === '♦').toBe(true)
    expect(next.tableau[0][1].suit === '♥' || next.tableau[0][1].suit === '♦').toBe(true)
    expect(next.tableau[0][2].wild).toBe(true)
  })

  test('オセラ: 場札が一番多いスートに統一される', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 3), card(2, '♣', 4), card(3, '♦', 5)]],
    })
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'othala', createRng(1))
    expect(next.tableau[0].every(c => c.suit === '♣')).toBe(true)
  })

  test('ペルスロ: チェーン先頭(foundation)がワイルドになる', () => {
    const wave = baseWave({ chain: [card(2, '♥', 6)], foundation: card(2, '♥', 6) })
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'perthro', createRng(1))
    expect(next.foundation.wild).toBe(true)
    expect(next.chain[next.chain.length - 1].wild).toBe(true)
  })

  test('ウルズ: 現在のコンボ数にnが加算される', () => {
    const wave = baseWave({ combo: 2, maxComboThisWave: 2 })
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'uruz', createRng(1))
    expect(next.combo).toBe(2 + DEFAULT_PARAMS.rites.uruz.n)
    expect(next.maxComboThisWave).toBe(next.combo)
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

  test('ティワズ: チェーンが2枚未満なら使用不可', () => {
    const wave = baseWave({ chain: [card(2, '♥', 6)] })
    expect(canUseRite(DEFAULT_PARAMS, wave, 'tiwaz')).toBe(false)
    expect(canUseRite(DEFAULT_PARAMS, wave, 'laguz')).toBe(false)
  })

  test('ティワズ: チェーンが一番多いスートに統一される', () => {
    const wave = baseWave({ chain: [card(1, '♣', 1), card(2, '♣', 2), card(3, '♦', 3)], foundation: card(3, '♦', 3) })
    expect(canUseRite(DEFAULT_PARAMS, wave, 'tiwaz')).toBe(true)
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'tiwaz', createRng(1))
    expect(next.chain.every(c => c.suit === '♣')).toBe(true)
    expect(next.foundation.suit).toBe('♣')
  })

  test('ラグズ: チェーンが一番多い色に統一される', () => {
    const wave = baseWave({ chain: [card(1, '♥', 1), card(2, '♦', 2), card(3, '♠', 3)], foundation: card(3, '♠', 3) })
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'laguz', createRng(1))
    expect(next.chain.every(c => c.suit === '♥' || c.suit === '♦')).toBe(true)
    expect(next.foundation.suit === '♥' || next.foundation.suit === '♦').toBe(true)
  })

  test('エイワズ: コンボリセット防止残り回数にnが加算される', () => {
    const wave = baseWave({ comboResetShieldRemaining: 1 })
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'eihwaz', createRng(1))
    expect(next.comboResetShieldRemaining).toBe(1 + DEFAULT_PARAMS.rites.eihwaz.n)
  })

  test('アンスズ: 場札のn枚がランダムにワイルドになる', () => {
    const wave = baseWave({ tableau: [[card(1, '♠', 5), card(2, '♦', 6), card(3, '♣', 7), card(4, '♥', 8)]] })
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'ansuz', createRng(1))
    const wildCount = next.tableau[0].filter(c => c.wild).length
    expect(wildCount).toBe(Math.min(DEFAULT_PARAMS.rites.ansuz.n, 4))
  })

  test('ケナズ: JQK以外のカードがJQKのいずれかに変換される(スート維持)', () => {
    const wave = baseWave({ tableau: [[card(1, '♠', 5), card(2, '♦', 13)]] })
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'kenaz', createRng(1))
    expect(next.tableau[0][0].rank).toBeGreaterThanOrEqual(11)
    expect(next.tableau[0][0].suit).toBe('♠')
    expect(next.tableau[0][1].rank).toBe(13)
  })

  test('スリサズ: JQKのカードがJQK以外に変換される(スート維持)', () => {
    const wave = baseWave({ tableau: [[card(1, '♠', 5), card(2, '♦', 13)]] })
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'thurisaz', createRng(1))
    expect(next.tableau[0][1].rank).toBeLessThanOrEqual(10)
    expect(next.tableau[0][1].suit).toBe('♦')
    expect(next.tableau[0][0].rank).toBe(5)
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
})
