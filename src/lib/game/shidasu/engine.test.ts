// src/lib/game/shidasu/engine.test.ts
import { describe, test, expect } from 'vitest'
import {
  rankLabel,
  isPlayable,
  getPlayableColumns,
  remainingCount,
  startWave,
  playCard,
  drawStock,
  isStuck,
  markStuck,
  createInitialRun,
  beginRun,
  resolveWaveEnd,
  pickItem,
  confirmItemSwap,
  cancelItemSwap,
  skipItemSelect,
  advanceStage,
  restartRun,
  applyPlayCard,
  applyDrawStock,
  applyStuckCheck,
  forceStockTop,
  useRite,
  useRevelation,
  useRevelationFromOffer,
  pickRevelationFromOffer,
  skipRevelationSelect,
  pickOracleFromOffer,
  skipOracleSelect,
} from './engine'
import { ITEM_POOL } from './items'
import { isFace, chainContinuesPattern } from './patterns'
import type { Card, WaveState, RunState, ItemId } from './types'
import { DEFAULT_PARAMS } from './params'
import { createRng, standardDeckComposition } from './deck'
import { card } from './testHelpers'
import { defaultOracleLevels } from './oracles'

describe('isFace / rankLabel', () => {
  test('J/Q/Kはisface、それ以外はfalse', () => {
    expect(isFace(card(1, '♠', 11))).toBe(true)
    expect(isFace(card(2, '♠', 12))).toBe(true)
    expect(isFace(card(3, '♠', 13))).toBe(true)
    expect(isFace(card(4, '♠', 10))).toBe(false)
  })

  test('rankLabelはA/J/Q/K表記、ワイルドは★', () => {
    expect(rankLabel(card(1, '♠', 1))).toBe('A')
    expect(rankLabel(card(2, '♠', 11))).toBe('J')
    expect(rankLabel(card(3, '♠', 12))).toBe('Q')
    expect(rankLabel(card(4, '♠', 13))).toBe('K')
    expect(rankLabel(card(5, '♠', 7))).toBe('7')
    expect(rankLabel(card(6, '★', 0, true))).toBe('★')
  })
})

function makeWave(overrides: Partial<WaveState> = {}): WaveState {
  return {
    tableau: [],
    stock: [],
    foundation: card(0, '♠', 5),
    score: 0,
    combo: 0,
    chain: [],
    chainOrigin: [],
    linked: false,
    columnsEmptiedThisCombo: 0,
    comboStreakColumnLengths: [],
    lastDrawEffect: null,
    status: 'playing',
    endReason: null,
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
    oracleLevels: defaultOracleLevels(),
    ...overrides,
  }
}

describe('isPlayable', () => {
  test('ランク差1は取れる', () => {
    const wave = makeWave({ foundation: card(1, '♠', 5) })
    expect(isPlayable('none', wave, card(2, '♣', 6))).toBe(true)
    expect(isPlayable('none', wave, card(3, '♣', 4))).toBe(true)
  })

  test('ランク差2は取れない', () => {
    const wave = makeWave({ foundation: card(1, '♠', 5) })
    expect(isPlayable('none', wave, card(2, '♣', 7))).toBe(false)
  })

  test('A-Kループは通常時のみ取れる、noLoop中は取れない', () => {
    const wave = makeWave({ foundation: card(1, '♠', 13) })
    expect(isPlayable('none', wave, card(2, '♣', 1))).toBe(true)
    expect(isPlayable('noLoop', wave, card(2, '♣', 1))).toBe(false)
  })

  test('faceLock中はコンボ2未満だと絵札を取れない', () => {
    const wave = makeWave({ foundation: card(1, '♠', 10), combo: 1 })
    expect(isPlayable('faceLock', wave, card(2, '♣', 11))).toBe(false)
    const wave2 = makeWave({ foundation: card(1, '♠', 10), combo: 2 })
    expect(isPlayable('faceLock', wave2, card(2, '♣', 11))).toBe(true)
  })

  test('faceLock中は場札(foundation)がワイルドでもコンボ不足なら絵札を拒否する', () => {
    const wave = makeWave({ foundation: card(1, '★', 0, true), combo: 0 })
    expect(isPlayable('faceLock', wave, card(2, '♣', 12))).toBe(false)
  })

  test('ワイルドの札、またはfoundationがワイルドなら基本は取れる', () => {
    const wave = makeWave({ foundation: card(1, '♠', 5) })
    expect(isPlayable('none', wave, card(2, '★', 0, true))).toBe(true)
    const wildFoundationWave = makeWave({ foundation: card(1, '★', 0, true) })
    expect(isPlayable('none', wildFoundationWave, card(2, '♣', 9))).toBe(true)
  })

  test('エワズ有効時はランク差2も取れる(ループ含む)', () => {
    const wave = makeWave({ foundation: card(1, '♠', 5), ehwazActiveThisWave: true })
    expect(isPlayable('none', wave, card(2, '♣', 7))).toBe(true)
    expect(isPlayable('none', wave, card(3, '♣', 3))).toBe(true)
  })

  test('エワズ有効時、ランク差2でのループ越え(K→2、Q→Aなど)はnoLoop中だけ取れない', () => {
    const wave = makeWave({ foundation: card(1, '♠', 13), ehwazActiveThisWave: true })
    expect(isPlayable('none', wave, card(2, '♣', 2))).toBe(true)
    expect(isPlayable('noLoop', wave, card(2, '♣', 2))).toBe(false)
  })

  test('エワズが無効ならランク差2は通常通り取れない', () => {
    const wave = makeWave({ foundation: card(1, '♠', 5) })
    expect(isPlayable('none', wave, card(2, '♣', 7))).toBe(false)
  })

  test('エワズが有効でも、階段パターンの継続判定はランク差1のみを認識する(ランク差2は継続しない)', () => {
    const chain = [card(1, '♠', 1), card(2, '♥', 2), card(3, '♣', 3), card(4, '♦', 4)]
    const result = chainContinuesPattern(DEFAULT_PARAMS.scoring, chain, card(5, '♠', 6))
    expect(result).toBe(false)
  })
})

describe('getPlayableColumns / remainingCount', () => {
  test('各列の一番手前のカードのみ判定対象になる', () => {
    const wave = makeWave({
      foundation: card(1, '♠', 5),
      tableau: [
        [card(2, '♣', 9), card(3, '♣', 6)], // 一番手前=6 → 取れる
        [card(4, '♦', 2)],                   // 取れない
      ],
    })
    expect(getPlayableColumns('none', wave)).toEqual(new Set([0]))
  })

  test('remainingCountは全列の合計枚数', () => {
    const wave = makeWave({
      tableau: [[card(1, '♠', 1)], [card(2, '♠', 2), card(3, '♠', 3)]],
    })
    expect(remainingCount(wave.tableau)).toBe(3)
  })
})

describe('startWave', () => {
  test('場札はcols×rowsの列数・枚数になる', () => {
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1)
    expect(wave.tableau).toHaveLength(DEFAULT_PARAMS.layout.cols)
    wave.tableau.forEach(col => expect(col).toHaveLength(DEFAULT_PARAMS.layout.rows))
  })

  test('comboStreakColumnLengthsは各列ともrows枚で初期化される', () => {
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1)
    expect(wave.comboStreakColumnLengths).toEqual(wave.tableau.map(() => DEFAULT_PARAMS.layout.rows))
  })

  test('山札+場札+foundationで52枚になる(アイテムなし)', () => {
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1)
    const tableauCount = wave.tableau.reduce((n, c) => n + c.length, 0)
    expect(tableauCount + wave.stock.length + 1).toBe(52)
  })

  test('初期状態: チェーンにfoundationが1枚(由来はdraw)、スコア0、コンボ0、列一掃0、演出フラグnull、捨て札は空', () => {
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1)
    expect(wave.score).toBe(0)
    expect(wave.combo).toBe(0)
    expect(wave.chain).toEqual([wave.foundation])
    expect(wave.chainOrigin).toEqual(['draw'])
    expect(wave.linked).toBe(false)
    expect(wave.columnsEmptiedThisCombo).toBe(0)
    expect(wave.lastDrawEffect).toBeNull()
    expect(wave.status).toBe('playing')
    expect(wave.discardPile).toEqual([])
  })

  test('秘儀由来の持続フラグは全てウェーブ開始時に初期化される', () => {
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1)
    expect(wave.comboResetShieldRemaining).toBe(0)
    expect(wave.playFromAnywhereActiveThisWave).toBe(false)
    expect(wave.nauthizActiveThisWave).toBe(false)
    expect(wave.comboFrozenThisWave).toBe(false)
    expect(wave.sowiloActiveThisWave).toBe(false)
    expect(wave.sowiloBoostedRole).toBeNull()
    expect(wave.mannazActiveThisWave).toBe(false)
    expect(wave.ehwazActiveThisWave).toBe(false)
  })

  test('同じシードなら同じ結果になる(決定的、アイテムを持っていても山札生成自体は変わらない)', () => {
    const a = startWave(DEFAULT_PARAMS, 0, 0, ['bridge'], standardDeckComposition(), 123)
    const b = startWave(DEFAULT_PARAMS, 0, 0, ['bridge'], standardDeckComposition(), 123)
    expect(a).toEqual(b)
  })

  test('永劫を持っていればdeckCompositionにワイルドが1枚追加され、山札構築に反映される(53枚になる)', () => {
    const { wave, deckComposition } = startWave(DEFAULT_PARAMS, 0, 0, ['eternity'], standardDeckComposition(), 1)
    expect(deckComposition).toHaveLength(53)
    const tableauCount = wave.tableau.reduce((n, c) => n + c.length, 0)
    expect(tableauCount + wave.stock.length + 1).toBe(53)
  })

  test('豊穣を持っていればdeckComposition内の1枚がワイルドに変換される(枚数は52枚のまま)', () => {
    const { deckComposition } = startWave(DEFAULT_PARAMS, 0, 0, ['abundance'], standardDeckComposition(), 1)
    expect(deckComposition).toHaveLength(52)
    expect(deckComposition.filter(c => c.wild)).toHaveLength(1)
  })

  test('永劫・豊穣を複数ウェーブ保持し続けると効果が蓄積する', () => {
    const first = startWave(DEFAULT_PARAMS, 0, 0, ['eternity', 'abundance'], standardDeckComposition(), 1)
    const second = startWave(DEFAULT_PARAMS, 0, 1, ['eternity', 'abundance'], first.deckComposition, 2)
    expect(second.deckComposition).toHaveLength(54) // 標準52枚+永劫2ウェーブ分
    expect(second.deckComposition.filter(c => c.wild)).toHaveLength(4) // 永劫追加2枚+豊穣変換2枚
  })
})

describe('playCard', () => {
  const scoring = DEFAULT_PARAMS.scoring

  function baseWave(overrides: Partial<WaveState> = {}): WaveState {
    return makeWave({
      foundation: card(0, '♠', 5),
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      ...overrides,
    })
  }

  test('取れない列を指定した場合は何も変わらない', () => {
    const wave = baseWave()
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 1, standardDeckComposition()) // 列1(2)は取れない
    expect(next).toBe(wave)
  })

  test('コンボ1(倍率1+0.1=1.1)で加点される', () => {
    // 列一掃ボーナスが混ざらないよう、played対象の下にダミー札を積んで列が空にならないようにする
    const wave = baseWave({ tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]] })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(next.combo).toBe(1)
    expect(next.score).toBe(Math.floor(scoring.basePoint * 1.1))
    expect(next.foundation).toEqual(card(1, '♣', 6))
    expect(next.chain).toEqual([card(1, '♣', 6)])
    expect(next.tableau[0]).toEqual([card(9, '♠', 1)])
  })

  test('lastGain.partsの先頭に基礎点の内訳が入り、コンボ1(倍率1.1)でもコンボ倍率の内訳が表示される', () => {
    const wave = baseWave({ tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]] })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(next.lastGain?.parts[0]).toBe(`基礎点+${scoring.basePoint}`)
    expect(next.lastGain?.parts).toContain('コンボ倍率×1.1')
  })

  test('コンボ2(倍率1+0.2=1.2)で加点される(パターン不一致の場合)', () => {
    // 1枚目を取ってコンボ1にし、2枚目(パターン不一致)を取ってコンボ2にする
    // (列一掃・全消しボーナスが混ざらないよう、played対象の下にダミー札を積んでおく)
    const wave = baseWave({
      tableau: [
        [card(9, '♠', 1), card(1, '♣', 6)],
        [card(10, '♠', 2), card(2, '♦', 9)],
      ],
    })
    const { wave: afterFirst } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    // 2列目のfoundation差分を6→9にするため、一旦foundationを差し替えたウェーブで2枚目を取る
    const wave2 = {
      ...afterFirst,
      foundation: card(1, '♣', 6),
      tableau: [[card(9, '♠', 1)], [card(10, '♠', 2), card(2, '♦', 7)]],
    }
    const { wave: next } = playCard(DEFAULT_PARAMS, wave2, 'none', [], 1000000, 1, standardDeckComposition())
    expect(next.combo).toBe(2)
    // 6→7は階段方向+1・長さ2(既定stairMinLen=5未満でボーナスなし)、スート♣→♦で色も違う→パターンボーナス0
    expect(next.score).toBe(afterFirst.score + Math.floor(scoring.basePoint * 1.2))
    expect(next.lastGain?.parts).toContain('コンボ倍率×1.2')
  })

  test('基本ルール: 列の全カードを1コンボで空にすると列一掃ボーナスが加算される(1列目)', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 9)]],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows, 1],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(next.columnsEmptiedThisCombo).toBe(1)
    expect(next.score).toBe(Math.floor((scoring.basePoint + scoring.columnSweepBonus * 1) * 1.1))
    expect(next.lastGain?.parts).toContain(`列一掃+${scoring.columnSweepBonus}`)
  })

  test('基本ルール: 列が現在の連続コンボ開始時点で全カードでなければ(=既に一部消化済みなら)列一掃ボーナスは付かない', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 9)]],
      comboStreakColumnLengths: [2, 1], // 列0はコンボ開始時点で2枚残っていた(rows=5と一致しないため、全カードを1コンボで消化したことにはならない)
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(next.columnsEmptiedThisCombo).toBe(0)
    expect(next.lastGain?.parts.some(p => p.startsWith('列一掃'))).toBe(false)
  })

  test('寛容の護符所持時: 列一掃の条件が「残りrows-talismans.grace.m枚以下から1コンボで空に」に緩和される', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 9)]],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows - DEFAULT_PARAMS.talismans.grace.m, 1],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['grace'], 1000000, 0, standardDeckComposition())
    expect(next.columnsEmptiedThisCombo).toBe(1)
    expect(next.lastGain?.parts).toContain(`列一掃+${scoring.columnSweepBonus}`)
  })

  test('寛容の護符: 列一掃ボーナスに必要な枚数がtalismans.grace.m枚緩和される', () => {
    const items: ItemId[] = ['grace']
    const relaxedLen = DEFAULT_PARAMS.layout.rows - DEFAULT_PARAMS.talismans.grace.m
    const wave = baseWave({
      foundation: card(0, '♠', 6),
      tableau: [[card(1, '♣', 7)]],
      comboStreakColumnLengths: [relaxedLen],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', items, 1000000, 0, standardDeckComposition())
    expect(next.lastGain?.parts.some(p => p.startsWith('列一掃'))).toBe(true)
  })

  test('同じコンボ内で2列目を空にすると列一掃ボーナスが列数倍になる', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 6), // 列1(rank7)との差を1にして取れるようにする
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 7)]],
      columnsEmptiedThisCombo: 1,
      comboStreakColumnLengths: [1, DEFAULT_PARAMS.layout.rows],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 1, standardDeckComposition())
    expect(next.columnsEmptiedThisCombo).toBe(2)
    expect(next.lastGain?.parts).toContain(`列一掃+${scoring.columnSweepBonus * 2}`)
  })

  test('場札が0枚になったら全消しボーナス(clearBonus+残り山札×clearBonusPerStock)が加算されendReason=fullClear', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [card(9, '♠', 1), card(10, '♠', 2)],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 100000000, 0, standardDeckComposition())
    expect(next.tableau.reduce((n, c) => n + c.length, 0)).toBe(0)
    expect(next.status).toBe('ended')
    expect(next.endReason).toBe('fullClear')
    const expectedClearBonus = scoring.clearBonus + 2 * scoring.clearBonusPerStock
    expect(next.score).toBe(Math.floor((scoring.basePoint + scoring.columnSweepBonus * 1) * 1.1) + expectedClearBonus)
  })

  test('全消し時、lastBonusGainsに全消しボーナスが別枠で入る(lastGainはプレイ得点のみ)', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [card(9, '♠', 1), card(10, '♠', 2)],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 100000000, 0, standardDeckComposition())
    const expectedClearBonus = scoring.clearBonus + 2 * scoring.clearBonusPerStock
    const expectedPlayGain = Math.floor((scoring.basePoint + scoring.columnSweepBonus * 1) * 1.1)
    expect(next.lastGain?.points).toBe(expectedPlayGain)
    expect(next.lastGain?.parts).not.toContain(`全消しボーナス+${expectedClearBonus}`)
    expect(next.lastBonusGains).toHaveLength(1)
    expect(next.lastBonusGains[0].label).toBe('全消しボーナス')
    expect(next.lastBonusGains[0].points).toBe(expectedClearBonus)
    expect(next.lastBonusGains[0].parts).toContain(`基礎+${scoring.clearBonus}`)
    expect(next.lastBonusGains[0].parts).toContain(`山札残数+${2 * scoring.clearBonusPerStock}`)
    expect(next.score).toBe(expectedPlayGain + expectedClearBonus)
  })

  test('流星の護符: コンボが閾値に到達した瞬間、獲得点加算後のスコアのp%がlastBonusGainsに別枠で入る', () => {
    const items: ItemId[] = ['shootingStar']
    const wave = baseWave({
      score: 5000,
      combo: DEFAULT_PARAMS.talismans.shootingStar.c - 1,
      chain: [card(20, '♥', 3), card(21, '♦', 4)],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', items, 100000000, 0, standardDeckComposition())
    expect(next.combo).toBe(DEFAULT_PARAMS.talismans.shootingStar.c)
    const scoreAfterGained = wave.score + (next.lastGain?.points ?? 0)
    const expectedBonus = Math.floor(scoreAfterGained * DEFAULT_PARAMS.talismans.shootingStar.p / 100)
    expect(next.lastBonusGains).toHaveLength(1)
    expect(next.lastBonusGains[0].label).toBe('護符による直接加算')
    expect(next.lastBonusGains[0].points).toBe(expectedBonus)
    expect(next.lastBonusGains[0].parts).toContain(`流星+${expectedBonus}`)
    // 回帰防止: 流星の加算額がlastGainとlastBonusGainsの両方に二重計上されていないことを確認する。
    const bonusTotal = next.lastBonusGains.reduce((sum, g) => sum + g.points, 0)
    expect((next.lastGain?.points ?? 0) + bonusTotal).toBe(next.score - wave.score)
  })

  test('流星の護符: 黄金と併用しコンボが閾値をまたいでジャンプしても発動する', () => {
    const items: ItemId[] = ['shootingStar', 'golden']
    const c = DEFAULT_PARAMS.talismans.shootingStar.c
    const wave = baseWave({
      score: 5000,
      combo: c - 1, // 黄金の+2適用でc+1へジャンプし、cをちょうど踏まない
      chain: [card(20, '♥', 3), card(21, '♦', 4)],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', items, 100000000, 0, standardDeckComposition())
    expect(next.combo).toBe(c + 1)
    expect(next.lastBonusGains.some(g => g.parts.some(p => p.startsWith('流星')))).toBe(true)
  })

  test('流星の護符: 既に閾値以上の状態が続いている間は再発動しない', () => {
    const items: ItemId[] = ['shootingStar']
    const c = DEFAULT_PARAMS.talismans.shootingStar.c
    const wave = baseWave({
      score: 5000,
      combo: c, // 既に閾値以上
      chain: [card(20, '♥', 3), card(21, '♦', 4)],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', items, 100000000, 0, standardDeckComposition())
    expect(next.combo).toBe(c + 1)
    expect(next.lastBonusGains.some(g => g.parts.some(p => p.startsWith('流星')))).toBe(false)
  })

  test('スコアが目標に達したらendReason=targetでstatus=ended', () => {
    const wave = baseWave()
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 5, 0, standardDeckComposition()) // basePoint(100) >= target(5)
    expect(next.status).toBe('ended')
    expect(next.endReason).toBe('target')
  })

  test('status が playing でない場合は何もしない', () => {
    const wave = baseWave({ status: 'ended', endReason: 'target' })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(next).toBe(wave)
  })

  test('端数が出る設定でもfloorで切り捨てられる(保険の確認)', () => {
    const oddParams: typeof DEFAULT_PARAMS = {
      ...DEFAULT_PARAMS,
      scoring: { ...DEFAULT_PARAMS.scoring, basePoint: 15, comboMultiplierStep: 0.25 },
    }
    // 列一掃・全消しボーナスが混ざらないよう、played対象の下にダミー札を積んでおく
    const wave = baseWave({
      tableau: [
        [card(9, '♠', 1), card(1, '♣', 6)],
        [card(10, '♠', 2), card(2, '♦', 2)],
      ],
    })
    // コンボ1: 倍率1+1*0.25=1.25 → 15*1.25=18.75 → floor=18
    const { wave: afterFirst } = playCard(oddParams, wave, 'none', [], 1000000, 0, standardDeckComposition())
    const wave2 = { ...afterFirst, tableau: [[card(9, '♠', 1)], [card(10, '♠', 2), card(2, '♦', 7)]] }
    const { wave: next } = playCard(oddParams, wave2, 'none', [], 1000000, 1, standardDeckComposition())
    // コンボ2: 倍率1+2*0.25=1.5 → 15*1.5=22.5 → floor=22
    expect(next.score).toBe(afterFirst.score + 22)
  })

  test('カードを取るとlastDrawEffectがクリアされる', () => {
    const wave = baseWave({ lastDrawEffect: 'pattern' })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(next.lastDrawEffect).toBeNull()
  })

  test('プレイするとfirstPlayDoneがtrueになる(ウェーブ開始直後はfalse)', () => {
    const wave = baseWave({ tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]] })
    expect(wave.firstPlayDone).toBe(false)
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(next.firstPlayDone).toBe(true)
  })

  test('chainOriginにplayが追記される', () => {
    const wave = baseWave({ tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]] })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(next.chainOrigin).toEqual(['play'])
  })

  test('架橋の護符を持っていなければ、階段が3枚繋がっても既定のstairMinLen(5)未満のためボーナスが付かない', () => {
    const wave = baseWave({
      foundation: card(0, '♣', 5),
      chain: [card(20, '♠', 4), card(0, '♣', 5)],
      tableau: [[card(9, '♠', 1), card(1, '♦', 6)], [card(2, '♥', 2)]],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(next.lastGain?.parts.some(p => p.startsWith('階段'))).toBe(false)
  })

  test('架橋の護符を持っていれば、階段成立に必要な最小連続枚数がstairRelaxedMinLen(3)に緩和される', () => {
    const wave = baseWave({
      foundation: card(0, '♣', 5),
      chain: [card(20, '♠', 4), card(0, '♣', 5)],
      tableau: [[card(9, '♠', 1), card(1, '♦', 6)], [card(2, '♥', 2)]],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['bridge'], 1000000, 0, standardDeckComposition())
    expect(next.lastGain?.parts).toContain(`階段3 +${scoring.stairBonus}`)
  })

  test('架橋の護符: 階段成立に必要な枚数がm枚緩和される(既定m=2で5→3)', () => {
    const items: ItemId[] = ['bridge']
    // チェーン[3,4]に5を継ぎ足して3枚の階段(3,4,5)にする。foundationをrank6にすることで
    // rank5のカード(foundationとの差1)が取得可能になる。既定のstairMinLen(5)では
    // 3枚では不成立だが、架橋によりm=2緩和され3枚で成立するはず。
    const wave = baseWave({
      foundation: card(0, '♠', 6),
      chain: [card(20, '♣', 3), card(21, '♦', 4)],
      tableau: [[card(1, '♥', 5)], [card(2, '♦', 2)]],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', items, 1000000, 0, standardDeckComposition())
    expect(next.lastGain?.parts.some(p => p.startsWith('階段'))).toBe(true)
  })

  test('架橋の護符: 同スート成立に必要な枚数もm枚緩和される(既定m=2で3→1)', () => {
    const items: ItemId[] = ['bridge']
    // evaluateChainBonusはchainBefore(プレイ前のチェーン)が空だと即bonus=0を返すため、
    // チェーンには既に1枚(基準カードと同スート)を入れておく。このプレイでchainIncludingThis
    // が2枚になり、effectiveSuitColorMinLen(3-2=1)なら2>=1で成立、既定値(3)なら2>=3で不成立。
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      chain: [card(0, '♠', 5)],
      tableau: [[card(1, '♠', 6)], [card(2, '♦', 2)]],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', items, 1000000, 0, standardDeckComposition())
    expect(next.lastGain?.parts).toContain(`同スート+${DEFAULT_PARAMS.scoring.suitBonus}`)
  })

  test('gainedチャンネルの護符(springBreeze)は♣を取った時、得点に加算される', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['springBreeze'], 1000000, 0, standardDeckComposition())
    expect(next.score).toBe(Math.floor((scoring.basePoint + DEFAULT_PARAMS.talismans.springBreeze.n) * 1.1))
  })

  test('コンボ倍率は護符のgained加算効果にも適用される(最後に一括適用)', () => {
    // 春風(springBreeze)は♣を取ったときn点の固定加算。コンボ2→3(倍率1+2*step)の状態でプレイし、
    // 固定加算分にもコンボ倍率がかかっていることを確認する(先にコンボ倍率だけ適用して後から加算する旧実装ではNG)。
    const items: ItemId[] = ['springBreeze']
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      combo: 2,
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', items, 1000000, 0, standardDeckComposition())
    expect(next.combo).toBe(3)
    const multiplier = 1 + 3 * scoring.comboMultiplierStep
    const expectedGained = Math.floor((scoring.basePoint + DEFAULT_PARAMS.talismans.springBreeze.n) * multiplier)
    expect(next.lastGain?.points).toBe(expectedGained)
  })

  test('clearBonusチャンネルの護符(purify)は全消し時のみclearBonusに加算される', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [card(9, '♠', 1), card(10, '♠', 2)],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['purify'], 100000000, 0, standardDeckComposition())
    expect(next.endReason).toBe('fullClear')
    const expectedClearBonus = scoring.clearBonus + 2 * scoring.clearBonusPerStock + DEFAULT_PARAMS.talismans.purify.n
    expect(next.score).toBe(Math.floor((scoring.basePoint + scoring.columnSweepBonus * 1) * 1.1) + expectedClearBonus)
  })

  test('複数のclearBonus護符は所持順に適用される(purify→temperanceとtemperance→purifyで結果が異なる)', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [card(9, '♠', 1), card(10, '♠', 2)],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
    })
    const { wave: order1 } = playCard(DEFAULT_PARAMS, wave, 'none', ['purify', 'temperance'], 100000000, 0, standardDeckComposition())
    const { wave: order2 } = playCard(DEFAULT_PARAMS, wave, 'none', ['temperance', 'purify'], 100000000, 0, standardDeckComposition())
    expect(order1.score).not.toBe(order2.score)
  })

  test('複数のgained護符も所持順に適用される(conscience→courageとcourage→conscienceで結果が異なる)', () => {
    const wave = baseWave({ tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]] })
    const { wave: order1 } = playCard(DEFAULT_PARAMS, wave, 'none', ['conscience', 'courage'], 1000000, 0, standardDeckComposition())
    const { wave: order2 } = playCard(DEFAULT_PARAMS, wave, 'none', ['courage', 'conscience'], 1000000, 0, standardDeckComposition())
    expect(order1.score).not.toBe(order2.score)
    const comboMultiplier = 1 + 1 * scoring.comboMultiplierStep
    expect(order1.score).toBe(Math.floor((scoring.basePoint + DEFAULT_PARAMS.talismans.conscience.n) * (1 + 1 * DEFAULT_PARAMS.talismans.courage.x) * comboMultiplier))
    expect(order2.score).toBe(Math.floor((scoring.basePoint * (1 + 1 * DEFAULT_PARAMS.talismans.courage.x) + DEFAULT_PARAMS.talismans.conscience.n) * comboMultiplier))
  })

  test('同じ列を連続でプレイするとsameColumnStreakが増え、違う列なら1に戻る', () => {
    // 列0: 1回目で6(基礎rank5と隣接)を取ったあと、残る7が新foundation(6)と隣接するようにする
    const wave = baseWave({
      tableau: [[card(9, '♠', 7), card(1, '♣', 6)], [card(10, '♠', 2), card(2, '♦', 7)]],
    })
    const { wave: first } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(first.sameColumnStreak).toBe(1)
    expect(first.lastPlayedColumn).toBe(0)
    const { wave: second } = playCard(DEFAULT_PARAMS, first, 'none', [], 1000000, 0, standardDeckComposition())
    expect(second.sameColumnStreak).toBe(2)
    // 列1: 1回目で列0の6を取ったあと、列1の7が(上書き後の)foundation(6)と隣接するようにする
    const wave2 = baseWave({
      tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(10, '♠', 2), card(11, '♦', 7)]],
    })
    const { wave: thirdSetup } = playCard(DEFAULT_PARAMS, wave2, 'none', [], 1000000, 0, standardDeckComposition())
    const { wave: differentColumn } = playCard(DEFAULT_PARAMS, { ...thirdSetup, foundation: card(1, '♣', 6) }, 'none', [], 1000000, 1, standardDeckComposition())
    expect(differentColumn.sameColumnStreak).toBe(1)
    expect(differentColumn.lastPlayedColumn).toBe(1)
  })

  test('maxComboThisWaveはこれまでの最大コンボ数を保持する', () => {
    const wave = baseWave({ combo: 5, tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]], maxComboThisWave: 5 })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(next.combo).toBe(6)
    expect(next.maxComboThisWave).toBe(6)
    const wave2 = baseWave({ combo: 2, tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]], maxComboThisWave: 10 })
    const { wave: next2 } = playCard(DEFAULT_PARAMS, wave2, 'none', [], 1000000, 0, standardDeckComposition())
    expect(next2.maxComboThisWave).toBe(10) // 既存の最大値の方が大きければ維持
  })

  test('列一掃が成立するとtotalColumnsEmptiedThisWaveとcolumnSweepActiveThisWaveが更新される', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 9)]],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows, 1],
      totalColumnsEmptiedThisWave: 3,
      columnSweepActiveThisWave: false,
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(next.totalColumnsEmptiedThisWave).toBe(4)
    expect(next.columnSweepActiveThisWave).toBe(true)
  })

  test('役ボーナスが成立するとroleFiredThisChainがtrueになり、フラッシュならflushActiveThisComboもtrueになる', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 1),
      chain: [card(20, '♥', 11), card(21, '♦', 12)], // ロイヤル役成立目前(J,Q)
      tableau: [[card(1, '♣', 13)], [card(2, '♦', 2)]],
      roleFiredThisChain: false,
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(next.roleFiredThisChain).toBe(true)
  })

  test('playCardはrand引数を省略してもデフォルト(Math.random)で動作する(既存呼び出しの後方互換性)', () => {
    const wave = baseWave({ tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]] })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(next.combo).toBe(1)
  })

  test('治癒: 列一掃した列は、そのコンボが継続している間はまだ復活しない(コンボリセット時に初めて効く)', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 9)]],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows, 1],
      discardPile: [card(10, '♦', 1), card(11, '♦', 2), card(12, '♦', 3)],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['healing'], 1000000, 0, standardDeckComposition(), createRng(1))
    expect(next.tableau[0]).toHaveLength(0) // まだ復活しない
    expect(next.sweptColumnsThisCombo).toEqual([{ colIndex: 0, startLength: DEFAULT_PARAMS.layout.rows }])
  })

  test('治癒: 通常のコンボリセット(drawStockでパターン不継続)時に、列一掃した列がコンボ開始時の枚数を上限に復活する', () => {
    const afterSweep = makeWave({
      foundation: card(1, '♣', 6),
      tableau: [[], [card(2, '♦', 9)]],
      stock: [card(20, '♦', 1)], // 赤札で色継続もせず、差5でパターン不継続
      chain: [card(0, '♠', 5), card(1, '♣', 6)],
      linked: true,
      sweptColumnsThisCombo: [{ colIndex: 0, startLength: DEFAULT_PARAMS.layout.rows }],
      discardPile: [],
    })
    const result = drawStock(DEFAULT_PARAMS, afterSweep, ['healing'], 1000000, standardDeckComposition())
    // discardPileにはコンボリセットでチェーンの2枚が加わってから復活に使われる
    expect(result.wave.tableau[0].length).toBe(Math.min(2, DEFAULT_PARAMS.layout.rows))
    expect(result.wave.sweptColumnsThisCombo).toEqual([])
  })

  test('治癒: コンボ開始時の枚数を上限に復活し、それ以上は復活しない', () => {
    const afterSweep = makeWave({
      foundation: card(1, '♣', 6),
      tableau: [[], [card(2, '♦', 9)]],
      stock: [card(20, '♠', 1)],
      chain: [card(1, '♣', 6)],
      linked: true,
      sweptColumnsThisCombo: [{ colIndex: 0, startLength: 2 }],
      discardPile: [card(30, '♦', 1), card(31, '♦', 2), card(32, '♦', 3), card(33, '♦', 4)],
    })
    const result = drawStock(DEFAULT_PARAMS, afterSweep, ['healing'], 1000000, standardDeckComposition())
    expect(result.wave.tableau[0]).toHaveLength(2) // startLength=2が上限
    expect(result.wave.discardPile).toHaveLength(4 + 1 - 2) // 元4枚+チェーン1枚 - 復活2枚
  })

  test('治癒を持っていなければ、コンボリセット時も列は空のまま', () => {
    const afterSweep = makeWave({
      foundation: card(1, '♣', 6),
      tableau: [[], [card(2, '♦', 9)]],
      stock: [card(20, '♠', 1)],
      chain: [card(1, '♣', 6)],
      linked: true,
      sweptColumnsThisCombo: [{ colIndex: 0, startLength: 2 }],
      discardPile: [card(30, '♦', 1)],
    })
    const result = drawStock(DEFAULT_PARAMS, afterSweep, [], 1000000, standardDeckComposition())
    expect(result.wave.tableau[0]).toHaveLength(0)
  })

  test('再生: 全消し時に山札が残っていれば、スコアp%消費して場札を復活させ、その後山札を1枚捲る', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [card(20, '♠', 9)], // 差3、継続しない(パターン不成立)想定
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
      discardPile: [card(10, '♦', 1), card(11, '♦', 2), card(12, '♦', 3)],
    })
    const result = playCard(DEFAULT_PARAMS, wave, 'none', ['regeneration'], 100000000, 0, standardDeckComposition(), createRng(1))
    expect(result.wave.status).toBe('playing')
    expect(result.wave.endReason).toBeNull()
    expect(result.wave.regenerationUsedThisWave).toBe(true)
    // 山札を1枚捲った後なのでstockは0枚(元々1枚だけだった)
    expect(result.wave.stock).toHaveLength(0)
  })

  test('再生: 山札が0枚の全消しでは発動しない(通常の全消し終了になる)', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
      discardPile: [card(10, '♦', 1), card(11, '♦', 2), card(12, '♦', 3)],
    })
    const result = playCard(DEFAULT_PARAMS, wave, 'none', ['regeneration'], 100000000, 0, standardDeckComposition(), createRng(1))
    expect(result.wave.status).toBe('ended')
    expect(result.wave.endReason).toBe('fullClear')
    expect(result.wave.regenerationUsedThisWave).toBe(false)
  })

  test('再生: 捨て札が無ければ通常通り全消し終了になる', () => {
    // 全消し時に走るコンボリセットでは、直前にプレイした札(chain末尾=foundation)は
    // 新chainへ引き継がれ捨て札へは移らない(重複防止)。よって開始時discardPileが空なら
    // 復活対象が無く、再生は場札を復活できずそのまま全消し終了になる。
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [card(20, '♠', 9)],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
      discardPile: [],
    })
    const result = playCard(DEFAULT_PARAMS, wave, 'none', ['regeneration'], 100000000, 0, standardDeckComposition(), createRng(1))
    expect(result.wave.status).toBe('ended')
    expect(result.wave.endReason).toBe('fullClear')
  })

  test('再生: ウェーブ中2回目は発動しない(regenerationUsedThisWaveがtrueなら通常の全消し終了)', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [card(20, '♠', 9)],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
      discardPile: [card(10, '♦', 1)],
      regenerationUsedThisWave: true,
    })
    const result = playCard(DEFAULT_PARAMS, wave, 'none', ['regeneration'], 100000000, 0, standardDeckComposition(), createRng(1))
    expect(result.wave.status).toBe('ended')
    expect(result.wave.endReason).toBe('fullClear')
  })

  test('治癒と再生を同時所持し、所持順で治癒が先なら治癒が優先され再生は発動しない', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [card(20, '♠', 9)],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
      discardPile: [card(10, '♦', 1), card(11, '♦', 2), card(12, '♦', 3)],
    })
    const result = playCard(DEFAULT_PARAMS, wave, 'none', ['healing', 'regeneration'], 100000000, 0, standardDeckComposition(), createRng(1))
    expect(result.wave.status).toBe('playing')
    expect(result.wave.regenerationUsedThisWave).toBe(false) // 治癒が先に場札を埋めたため再生は不発動
  })

  test('治癒と再生を同時所持し、所持順で再生が先なら再生が優先され場札全体が復活する', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [card(20, '♠', 9)],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
      discardPile: [card(10, '♦', 1), card(11, '♦', 2), card(12, '♦', 3)],
    })
    const result = playCard(DEFAULT_PARAMS, wave, 'none', ['regeneration', 'healing'], 100000000, 0, standardDeckComposition(), createRng(1))
    expect(result.wave.status).toBe('playing')
    expect(result.wave.regenerationUsedThisWave).toBe(true)
  })

  test('全消し後に治癒・再生で復活する際、最後にプレイしたカードが場札と捨て札に重複・消失しない', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [card(20, '♠', 9)],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
      discardPile: [card(10, '♦', 1), card(11, '♦', 2), card(12, '♦', 3)],
    })
    const initialCardCount = wave.tableau.reduce((n, c) => n + c.length, 0) + wave.stock.length + wave.discardPile.length
    const result = playCard(DEFAULT_PARAMS, wave, 'none', ['regeneration'], 100000000, 0, standardDeckComposition(), createRng(1))
    const allCardIds = [
      ...result.wave.tableau.flat().map(c => c.id),
      ...result.wave.discardPile.map(c => c.id),
      ...result.wave.stock.map(c => c.id),
      ...(result.wave.tableau.flat().some(c => c.id === result.wave.chain[0]?.id) ? [] : [result.wave.chain[0].id]),
    ]
    expect(allCardIds.length).toBe(initialCardCount) // 消失していないこと
    expect(new Set(allCardIds).size).toBe(allCardIds.length) // 重複していないこと
  })

  test('黄金: コンボが+1ではなく+2進む', () => {
    const wave = baseWave({ combo: 3, tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]] })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['golden'], 1000000, 0, standardDeckComposition())
    expect(next.combo).toBe(5)
  })

  test('黄金を持たなければ通常通りコンボは+1', () => {
    const wave = baseWave({ combo: 3, tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]] })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(next.combo).toBe(4)
  })

  test('庇護: コンボ数(計算用)がc未満ならcとして計算される', () => {
    const wave = baseWave({ combo: 0, tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]] })
    // combo=0でプレイするとnewCombo=1。庇護c=3未満なので一時comboは3として計算される。
    const { wave: withProtection } = playCard(DEFAULT_PARAMS, wave, 'none', ['protection'], 1000000, 0, standardDeckComposition())
    const { wave: without } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(withProtection.score).toBeGreaterThan(without.score)
  })

  test('大地: コンボ数(計算用)に常にcが加算される', () => {
    const wave = baseWave({ combo: 5, tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]] })
    const { wave: withEarth } = playCard(DEFAULT_PARAMS, wave, 'none', ['earth'], 1000000, 0, standardDeckComposition())
    const { wave: without } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(withEarth.score).toBeGreaterThan(without.score)
    // wave.combo自体(実コンボ)は一時comboの影響を受けない
    expect(withEarth.combo).toBe(without.combo)
  })

  test('庇護・大地は所持順で一時comboに適用され、大地→庇護の順だと庇護が不発化しうる', () => {
    // combo=0でプレイ: newCombo=1。大地(c=2)が先に+2して一時combo=3。
    // 庇護(c=3)は「3 < 3」が偽なので不発化(3のまま)。
    const wave = baseWave({ combo: 0, tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]] })
    const { wave: earthThenProtection } = playCard(DEFAULT_PARAMS, wave, 'none', ['earth', 'protection'], 1000000, 0, standardDeckComposition())
    // 庇護→大地の順なら: newCombo=1→庇護でc=3に底上げ→大地で+2して5になる。より高スコアになるはず。
    const { wave: protectionThenEarth } = playCard(DEFAULT_PARAMS, wave, 'none', ['protection', 'earth'], 1000000, 0, standardDeckComposition())
    expect(protectionThenEarth.score).toBeGreaterThan(earthThenProtection.score)
  })

  test('祝福: 役が成立するとbaseComboCountが+1され、一時comboにも反映される', () => {
    // フラッシュ成立(4スート)する組み合わせでプレイする
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      chain: [card(20, '♥', 3), card(21, '♦', 4), card(22, '♠', 5)],
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      baseComboCount: 0,
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['sanctify'], 1000000, 0, standardDeckComposition())
    expect(next.baseComboCount).toBe(1)
    // 一時comboにも+1が反映されていることを、祝福あり/なしのスコア差で確認する
    // (庇護・大地のテストと同じ手法。baseComboCountの検証だけではeffectiveComboへの
    // 反映漏れを検知できないため)。
    const { wave: withSanctify } = playCard(DEFAULT_PARAMS, wave, 'none', ['sanctify'], 1000000, 0, standardDeckComposition())
    const { wave: without } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(withSanctify.score).toBeGreaterThan(without.score)
  })

  test('祝福: 役が成立しなければbaseComboCountは変化しない', () => {
    const wave = baseWave({
      tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]],
      baseComboCount: 2,
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['sanctify'], 1000000, 0, standardDeckComposition())
    expect(next.baseComboCount).toBe(2)
  })

  test('基礎コンボ数(baseComboCount)は所持護符に関わらず常に得点計算のコンボ数に加算される', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]],
      baseComboCount: 3,
    })
    const { wave: withBase } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    const { wave: without } = playCard(DEFAULT_PARAMS, { ...wave, baseComboCount: 0 }, 'none', [], 1000000, 0, standardDeckComposition())
    expect(withBase.score).toBeGreaterThan(without.score)
    // baseComboCount自体はプレイ後も変化しない(役成立時の祝福以外では増減しない)
    expect(withBase.baseComboCount).toBe(3)
  })

  test('明星: 役の種類ごとのウェーブ内累積成立回数に応じて役ボーナスが倍加する', () => {
    // フラッシュが成立する組み合わせ(4スート)
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      chain: [card(20, '♥', 3), card(21, '♦', 4), card(22, '♠', 5)],
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      roleOccurrenceCountThisWave: { flush: 3 },
    })
    const { wave: withMorningStar } = playCard(DEFAULT_PARAMS, wave, 'none', ['morningStar'], 1000000, 0, standardDeckComposition())
    const { wave: without } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(withMorningStar.score).toBeGreaterThan(without.score)
  })

  test('明星: 役が成立するとroleOccurrenceCountThisWaveが+1される(今回分は倍率計算に使わない)', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      chain: [card(20, '♥', 3), card(21, '♦', 4), card(22, '♠', 5)],
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      roleOccurrenceCountThisWave: { flush: 1 },
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['morningStar'], 1000000, 0, standardDeckComposition())
    expect(next.roleOccurrenceCountThisWave.flush).toBe(2)
  })

  test('roleOccurrenceCountThisWaveは明星を持たなくても役成立のたび更新される', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      chain: [card(20, '♥', 3), card(21, '♦', 4), card(22, '♠', 5)],
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      roleOccurrenceCountThisWave: { flush: 1 },
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(next.roleOccurrenceCountThisWave.flush).toBe(2)
  })

  test('ソウィロ: 発動後に初めて成立した役(このプレイ自体)がx倍になり、役の種類が記憶される', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      chain: [card(20, '♥', 3), card(21, '♦', 4), card(22, '♠', 5)],
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      sowiloActiveThisWave: true,
    })
    const { wave: withSowilo } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    const { wave: without } = playCard(DEFAULT_PARAMS, { ...wave, sowiloActiveThisWave: false }, 'none', [], 1000000, 0, standardDeckComposition())
    expect(withSowilo.score).toBeGreaterThan(without.score)
    expect(withSowilo.sowiloBoostedRole).toBe('flush')
  })

  test('ソウィロ: 一度確定した役は、次のプレイでも同じ役だけがx倍のまま維持される', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      tableau: [[card(1, '♣', 9)], [card(2, '♦', 2)]],
      sowiloActiveThisWave: true,
      sowiloBoostedRole: 'flush',
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(next.sowiloBoostedRole).toBe('flush')
  })

  test('ソウィロ: completeRunがコミット初回のプレイで同スート追加ボーナスも同じプレイ内でx倍になる', () => {
    // ランク11・12を末尾以外に配置し、ロイヤルセット(J,Q,K)が誤って同時成立しないようにする。
    // 全13ランクを単一スート(♠)で揃えることでcompleteRun成立時にsuitHeld=trueとなり、
    // 「コンプリートラン」本体ボーナスと「コンプリートラン(同スート)」追加ボーナスの2つが
    // 同一プレイ内でroleBonusMultiplier('completeRun')を2回呼び出す状況を再現する。
    const ranksInChainOrder = [11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const chainBefore = ranksInChainOrder.map((rank, i) => card(i + 1, '♠', rank as Card['rank']))
    const wave = baseWave({
      // foundationはchainとは独立したフィールドであり、isPlayable判定(プレイする札とのランク差)にのみ使う。
      // プレイする13のカードがランク差1で取れるよう、ランク12にしておく(chain内の要素との一致は不要)。
      foundation: card(99, '♠', 12),
      chain: chainBefore,
      tableau: [[card(90, '♠', 13)], [card(91, '♦', 2)]],
      sowiloActiveThisWave: true,
      sowiloBoostedRole: null,
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(next.lastGain?.parts).toContain(`コンプリートラン+${scoring.completeRunBonus * DEFAULT_PARAMS.rites.sowilo.x}`)
    expect(next.lastGain?.parts).toContain(`コンプリートラン(同スート)+${scoring.completeRunSuitBonus * DEFAULT_PARAMS.rites.sowilo.x}`)
    expect(next.sowiloBoostedRole).toBe('completeRun')
  })

  test('水鏡: 役が成立すると次のプレイへ同じ役ボーナスの複製が予約される', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      chain: [card(20, '♥', 3), card(21, '♦', 4), card(22, '♠', 5)],
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['mirror'], 1000000, 0, standardDeckComposition())
    expect(next.pendingRoleEcho).not.toBeNull()
    expect(next.pendingRoleEcho?.name).toBe('flush')
    expect(next.roleEchoUsedThisCombo.flush).toBe(true)
  })

  test('水鏡: 予約された複製は次のプレイで無条件に上乗せされる', () => {
    const wave = baseWave({
      tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]],
      pendingRoleEcho: { name: 'flush', amount: 999 },
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['mirror'], 1000000, 0, standardDeckComposition())
    expect(next.score).toBeGreaterThanOrEqual(999)
    expect(next.pendingRoleEcho).toBeNull()
  })

  test('水鏡: 同じ役はコンボ中1回しか予約されない', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      chain: [card(20, '♥', 3), card(21, '♦', 4), card(22, '♠', 5)],
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      roleEchoUsedThisCombo: { flush: true },
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['mirror'], 1000000, 0, standardDeckComposition())
    expect(next.pendingRoleEcho).toBeNull()
  })

  test('水鏡: 同ランクは枚数段階(sameRankCount)ごとに個別予約できる(段階1使用済みでも段階2は予約可能)', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 6),
      chain: [card(10, '♠', 7), card(11, '♣', 7)], // 同ランク(7)が既に2枚チェーンに存在
      tableau: [[card(1, '♦', 7)], [card(2, '♦', 2)]],
      sameRankEchoUsedThisCombo: [1], // 段階1(sameRankCount=1)は既に使用済み
    })
    // 今回のプレイでsameRankCount=2が成立する(段階1とは別枠なので予約可能なはず)
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['mirror'], 1000000, 0, standardDeckComposition())
    expect(next.pendingRoleEcho).not.toBeNull()
    expect(next.pendingRoleEcho?.name).toBe('sameRank')
    expect(next.sameRankEchoUsedThisCombo).toContain(2)
  })

  test('慈悲: playCardを通した実際のプレイでもmercyActiveNextComboの倍率が適用される', () => {
    // applyItemEffectsを直接呼ぶ単体テストだけでなく、playCardのitemEffectCtx構築を経由する
    // 統合経路でも慈悲が発動することを確認する(itemEffectCtxオブジェクトリテラルへの
    // フィールド追加漏れは単体テストでは検知できないため)。
    const wave = baseWave({
      tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]],
      mercyActiveNextCombo: true,
    })
    const { wave: withMercy } = playCard(DEFAULT_PARAMS, wave, 'none', ['mercy'], 1000000, 0, standardDeckComposition())
    const { wave: without } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(withMercy.score).toBeGreaterThan(without.score)
  })

  test('高潔の護符: effectiveSuitColorMinLen経由で同スート判定される(将来架橋対応の土台)', () => {
    // ctx.effectiveSuitColorMinLenが正しく渡っていることを、既定値(3枚)でのみ確認する回帰テスト。
    const items: ItemId[] = ['nobility']
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      chain: [card(20, '♠', 3), card(21, '♠', 4)],
      tableau: [[card(1, '♠', 6)], [card(2, '♦', 2)]],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', items, 1000000, 0, standardDeckComposition())
    expect(next.lastGain?.parts).toContain(`高潔+${DEFAULT_PARAMS.talismans.nobility.n}`)
  })

  // playCard/drawStockのitemEffectCtx.playCountInChain計算式そのものを外部から観測して
  // 検証するテストは、現時点(このタスクの範囲)では書けない。消費側の護符(序章・幕間)が
  // まだctx.comboのみを見ておりisPlayAction/playCountInChainを読んでいないため、計算式が
  // 正しくても壊れていてもlastGain等の出力は変化しない。フィールドの型・配線の確認は
  // 上のdescribe('applyItemEffects (グループ7: コンボ内位置系)')内のctx()往復テストで行う。
  // 計算式自体の実質的な検証は、Task 8/9で序章・幕間がこれらのフィールドを消費するように
  // なった時点で、その挙動テストが担うことになる。

  test('護符gainedの時点で目標スコアに達したら、コンボ到達直接加算(流星等)は適用されずその時点でendReason=targetとなる', () => {
    const items: ItemId[] = ['shootingStar']
    const wave = baseWave({
      score: 0,
      combo: DEFAULT_PARAMS.talismans.shootingStar.c - 1,
      chain: [card(20, '♥', 3), card(21, '♦', 4)],
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', items, scoring.basePoint, 0, standardDeckComposition())
    expect(next.status).toBe('ended')
    expect(next.endReason).toBe('target')
    expect(next.lastBonusGains).toEqual([]) // 流星の直接加算は行われていない
  })

  test('イサ: comboFrozenThisWave中はplayCardでもコンボ数が変わらない', () => {
    const wave = baseWave({ combo: 3, comboFrozenThisWave: true })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(next.combo).toBe(3)
  })

  test('マンナズ: 所持護符のレア度重み合計に応じて得点が倍算される', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]],
      mannazActiveThisWave: true,
    })
    const items: ItemId[] = ['bridge']
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', items, 1000000, 0, standardDeckComposition())
    const weight: Record<'C' | 'U' | 'R', number> = { C: 1, U: 2, R: 4 }
    const weightSum = items.reduce((sum, id) => sum + weight[DEFAULT_PARAMS.talismans[id].rarity], 0)
    const mannazFactor = 1 + weightSum * DEFAULT_PARAMS.rites.mannaz.x
    const comboMultiplier = 1 + 1 * scoring.comboMultiplierStep
    expect(next.score).toBe(Math.floor(scoring.basePoint * comboMultiplier * mannazFactor))
  })

  test('マンナズ: コンボ倍率とも正しく乗算合成される(上書きしない)', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 3),
      tableau: [[card(9, '♠', 1), card(1, '♣', 4)], [card(2, '♦', 2)]],
      combo: 3,
      mannazActiveThisWave: true,
    })
    const items: ItemId[] = ['bridge']
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', items, 1000000, 0, standardDeckComposition())
    const weight: Record<'C' | 'U' | 'R', number> = { C: 1, U: 2, R: 4 }
    const weightSum = items.reduce((sum, id) => sum + weight[DEFAULT_PARAMS.talismans[id].rarity], 0)
    const mannazFactor = 1 + weightSum * DEFAULT_PARAMS.rites.mannaz.x
    const comboMultiplier = 1 + (wave.combo + 1) * scoring.comboMultiplierStep // newCombo=combo+1
    expect(next.score).toBe(Math.floor(scoring.basePoint * comboMultiplier * mannazFactor))
  })

  test('マンナズが無効なら得点は通常通り(倍算されない)', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['bridge'], 1000000, 0, standardDeckComposition())
    expect(next.score).toBe(Math.floor(scoring.basePoint * 1.1))
  })
})

describe('drawStock', () => {
  test('山札が空なら何もしない', () => {
    const wave = makeWave({ stock: [] })
    const composition = standardDeckComposition()
    expect(drawStock(DEFAULT_PARAMS, wave, [], 1000000, composition).wave).toBe(wave)
  })

  test('コンボリセット時の直接加算護符でスコアが目標に達したら、その時点でendReason=targetとなりウェーブが終了する', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)], // 差4、パターン不継続
      chain: [card(3, '♥', 5)],
      linked: true,
      score: 100,
    })
    const result = drawStock(DEFAULT_PARAMS, wave, ['composure'], 100 + 1, standardDeckComposition())
    expect(result.wave.status).toBe('ended')
    expect(result.wave.endReason).toBe('target')
  })

  test('通常時(継続条件なし): コンボ・チェーン・列一掃カウント・comboStreakColumnLengthsがリセットされ、捲った札1枚が新しい起点になる', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 9)],
      combo: 3,
      chain: [card(2, '♣', 1)],
      chainOrigin: ['play'],
      linked: true,
      columnsEmptiedThisCombo: 2,
      tableau: [[card(3, '♣', 2)], [card(4, '♦', 8), card(5, '♥', 9)]],
      comboStreakColumnLengths: [0, 1],
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], 1000000, standardDeckComposition())
    expect(next.foundation).toEqual(card(1, '♠', 9))
    expect(next.combo).toBe(0)
    expect(next.chain).toEqual([card(1, '♠', 9)])
    expect(next.chainOrigin).toEqual(['draw'])
    expect(next.linked).toBe(false)
    expect(next.columnsEmptiedThisCombo).toBe(0)
    expect(next.comboStreakColumnLengths).toEqual([1, 2])
    expect(next.lastDrawEffect).toBeNull()
    expect(next.stock).toEqual([])
  })

  test('ワイルドがめくれた場合(継続中のパターンが無い): コンボがリセットされ、ワイルド1枚が新しい起点になる', () => {
    const wave = makeWave({
      stock: [card(1, '★', 0, true)],
      combo: 3,
      chain: [card(2, '♣', 5)], // 実カード1枚のみ、パターン不成立
      chainOrigin: ['play'],
      linked: true,
      comboStreakColumnLengths: [4, 2],
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], 1000000, standardDeckComposition())
    expect(next.combo).toBe(0)
    expect(next.chain).toEqual([card(1, '★', 0, true)])
    expect(next.chainOrigin).toEqual(['draw'])
    expect(next.linked).toBe(false)
    expect(next.lastDrawEffect).toBeNull()
  })

  test('ワイルドがめくれた場合(継続中のパターンがある): コンボが継続し、lastDrawEffectはwild', () => {
    const wave = makeWave({
      stock: [card(1, '★', 0, true)],
      combo: 3,
      chain: [card(2, '♠', 5), card(3, '♠', 6), card(4, '♠', 7)], // 実カード3枚・同スート継続中
      chainOrigin: ['play', 'play', 'play'],
      linked: true,
      comboStreakColumnLengths: [4, 2],
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], 1000000, standardDeckComposition())
    expect(next.combo).toBe(3)
    expect(next.chain).toEqual([card(2, '♠', 5), card(3, '♠', 6), card(4, '♠', 7), card(1, '★', 0, true)])
    expect(next.chainOrigin).toEqual(['play', 'play', 'play', 'draw'])
    expect(next.linked).toBe(true)
    expect(next.lastDrawEffect).toBe('wild')
    expect(next.comboStreakColumnLengths).toEqual([4, 2])
  })

  test('パターンに合う札ならアイテム無しで特殊継続しlastDrawEffectはpattern', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 9)], // 同スート継続(捲った後で実カード3枚)
      combo: 2,
      chain: [card(2, '♠', 4), card(3, '♠', 5)],
      chainOrigin: ['play', 'play'],
      linked: true,
      comboStreakColumnLengths: [3, 2],
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], 1000000, standardDeckComposition())
    expect(next.combo).toBe(2)
    expect(next.chain).toEqual([card(2, '♠', 4), card(3, '♠', 5), card(1, '♠', 9)])
    expect(next.chainOrigin).toEqual(['play', 'play', 'draw'])
    expect(next.linked).toBe(true)
    expect(next.lastDrawEffect).toBe('pattern')
    expect(next.score).toBe(wave.score) // 得点は付かない
    expect(next.comboStreakColumnLengths).toEqual([3, 2])
  })

  test('架橋の護符所持時は、山札めくりの階段パターン継続判定にもstairRelaxedMinLenが使われる', () => {
    const wave = makeWave({
      stock: [card(1, '♦', 7)], // 階段継続: 5→6→7(長さ3)
      combo: 2,
      chain: [card(2, '♠', 5), card(3, '♣', 6)], // dir=+1, len=2
      chainOrigin: ['play', 'play'],
      linked: true,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['bridge'], 1000000, standardDeckComposition()) // stairRelaxedMinLen=3
    expect(next.combo).toBe(2)
    expect(next.lastDrawEffect).toBe('pattern')
    expect(next.chain).toEqual([card(2, '♠', 5), card(3, '♣', 6), card(1, '♦', 7)])
  })

  test('架橋の護符を持っていなければ、同じ階段(長さ3)ではdrawStockのパターン継続は成立しない(既定stairMinLen(5)未満)', () => {
    const wave = makeWave({
      stock: [card(1, '♦', 7)],
      combo: 2,
      chain: [card(2, '♠', 5), card(3, '♣', 6)],
      chainOrigin: ['play', 'play'],
      linked: true,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], 1000000, standardDeckComposition())
    expect(next.combo).toBe(0) // リセットされる
    expect(next.lastDrawEffect).toBeNull()
  })

  test('パターンに合わなければ通常通りリセットし、捲った札1枚が新しい起点になる', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)], // 同スートでも階段でもない
      combo: 2,
      chain: [card(2, '♥', 5)],
      chainOrigin: ['play'],
      linked: true,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], 1000000, standardDeckComposition())
    expect(next.combo).toBe(0)
    expect(next.chain).toEqual([card(1, '♣', 9)])
    expect(next.chainOrigin).toEqual(['draw'])
    expect(next.linked).toBe(false)
    expect(next.lastDrawEffect).toBeNull()
  })

  test('山札を引くとlastGainがクリアされる(得点は山札からは発生しないため)', () => {
    const wave = makeWave({
      stock: [card(1, '★', 0, true)],
      lastGain: { points: 100, parts: ['同スート+100'] },
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], 1000000, standardDeckComposition())
    expect(next.lastGain).toBeNull()
  })

  test('リセット時、直前のチェーンが捨て札に追加される', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      chain: [card(2, '♥', 5), card(3, '♥', 6)],
      linked: true,
      discardPile: [card(9, '♦', 1)],
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], 1000000, standardDeckComposition())
    expect(next.discardPile).toEqual([card(9, '♦', 1), card(2, '♥', 5), card(3, '♥', 6)])
  })

  test('パターン継続時は捨て札に何も追加されない', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 9)],
      chain: [card(2, '♠', 4), card(3, '♠', 5)],
      linked: true,
      discardPile: [],
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], 1000000, standardDeckComposition())
    expect(next.discardPile).toEqual([])
  })

  test('静寂: リセット時に取れる場札が無ければ、めくった札がそのウェーブ内でワイルド化し、deckComposition内の同じdeckIdのエントリだけがワイルドに変換される(ランダムではない)', () => {
    // standardDeckComposition()内で♣9はdeckId=47(♠13枚+♥13枚+♦13枚+♣内rank9で0始まり8番目)。
    // 引いた札に同じdeckId=47を明示的に持たせ、実際にそのエントリだけが変換されることを検証する。
    const wave = makeWave({
      stock: [card(1, '♣', 9, false, 47)],
      tableau: [[card(2, '♠', 2)]], // foundation想定rank9との差が大きく取れない
      chain: [card(3, '♥', 5)],
      linked: true,
    })
    const composition = standardDeckComposition()
    expect(composition[47]).toEqual({ deckId: 47, suit: '♣', rank: 9, wild: false })
    const { wave: next, deckComposition } = drawStock(DEFAULT_PARAMS, wave, ['silence'], 1000000, composition, 'none', createRng(1))
    expect(next.foundation.wild).toBe(true)
    expect(next.chain).toEqual([{ ...card(1, '♣', 9, false, 47), wild: true }])
    const wildEntries = deckComposition.filter(c => c.wild)
    expect(wildEntries).toEqual([{ deckId: 47, suit: '♣', rank: 9, wild: true }])
  })

  test('静寂を持っていても取れる場札があれば発動しない', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      tableau: [[card(2, '♣', 8)]], // 差1、取れる
      chain: [card(3, '♥', 5)],
      linked: true,
    })
    const composition = standardDeckComposition()
    const { wave: next, deckComposition } = drawStock(DEFAULT_PARAMS, wave, ['silence'], 1000000, composition, 'none', createRng(1))
    expect(next.foundation.wild).toBe(false)
    expect(deckComposition.filter(c => c.wild)).toHaveLength(0)
  })

  test('静寂: faceLockステージでは、リセット前のコンボ数に関わらずリセット後のcombo=0を基準に取れる場札を判定する(絵札は取れないため発動する)', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 13)], // King(絵札)、ランク差1でfaceLockが無ければ取れる
      tableau: [[card(2, '♠', 12)]], // Queen(絵札)
      chain: [card(3, '♥', 5)],
      combo: 3, // リセット前のコンボ数(この値をそのまま参照すると誤ってfaceLockを通過してしまう)
      linked: true,
    })
    const composition = standardDeckComposition()
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['silence'], 1000000, composition, 'faceLock', createRng(1))
    expect(next.foundation.wild).toBe(true)
  })

  test('沈着: リセット時に取れる場札が無ければ直接点が加算される', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      tableau: [[card(2, '♠', 2)]], // 差が大きく取れない
      chain: [card(3, '♥', 5)],
      linked: true,
      score: 100,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['composure'], 1000000, standardDeckComposition())
    expect(next.score).toBe(100 + DEFAULT_PARAMS.talismans.composure.n)
  })

  test('冷静: リセットされるチェーンで役が一つも成立していなければ直接点が加算される', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      tableau: [[card(2, '♣', 8)]],
      chain: [card(3, '♥', 5)],
      linked: true,
      roleFiredThisChain: false,
      score: 100,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['clarity'], 1000000, standardDeckComposition())
    expect(next.score).toBe(100 + DEFAULT_PARAMS.talismans.clarity.n)
  })

  test('冷静: 役が成立していたチェーンのリセットでは発動しない', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      tableau: [[card(2, '♣', 8)]],
      chain: [card(3, '♥', 5)],
      linked: true,
      roleFiredThisChain: true,
      score: 100,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['clarity'], 1000000, standardDeckComposition())
    expect(next.score).toBe(100)
  })

  test('残響: リセット時、リセット前のコンボ数×nが直接加算される', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      tableau: [[card(2, '♣', 8)]],
      chain: [card(3, '♥', 5)],
      linked: true,
      combo: 4,
      score: 100,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['echo'], 1000000, standardDeckComposition())
    expect(next.score).toBe(100 + 4 * DEFAULT_PARAMS.talismans.echo.n)
  })

  test('リセット時、roleFiredThisChainがfalseに戻る', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      chain: [card(3, '♥', 5)],
      linked: true,
      roleFiredThisChain: true,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], 1000000, standardDeckComposition())
    expect(next.roleFiredThisChain).toBe(false)
  })

  test('慢心: 山札が0枚になった瞬間、場札残数×xが直接加算される', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      tableau: [[card(2, '♣', 8)], [card(4, '♦', 5)]],
      chain: [card(3, '♥', 1)],
      linked: false,
      score: 100,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['arrogance'], 1000000, standardDeckComposition())
    expect(next.stock).toHaveLength(0)
    expect(next.score).toBe(100 + 2 * DEFAULT_PARAMS.talismans.arrogance.x)
  })

  test('誠実: パターン継続めくりが同色パターンで成立すると直接点が加算される', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 6)], // 黒(色継続)
      chain: [card(2, '♣', 4), card(3, '♠', 5)], // 黒2枚、同色成立中
      linked: true,
      combo: 2,
      score: 100,
      drawContinueCountThisChain: 0,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['sincerity'], 1000000, standardDeckComposition())
    expect(next.linked).toBe(true)
    expect(next.score).toBe(100 + DEFAULT_PARAMS.talismans.sincerity.n)
    expect(next.drawContinueCountThisChain).toBe(1)
  })

  test('慢心(山札切れ直接加算)でスコアが目標に達したら即座にendReason=targetとなり、lastBonusGainsに慢心の加算が反映される(古い内訳が残らない)', () => {
    const x = DEFAULT_PARAMS.talismans.arrogance.x
    const wave = makeWave({
      stock: [card(1, '♣', 9)], // 最後の1枚。引くと山札0枚になり慢心が発動
      tableau: [[card(2, '♣', 8)], [card(4, '♦', 5)]], // 残数2 → 慢心+2x
      chain: [card(3, '♥', 1)],
      linked: false,
      score: 100,
      lastGain: { points: 888, parts: ['古い内訳'] },
      lastBonusGains: [{ label: '古い', points: 999, parts: ['古い'] }],
    })
    const result = drawStock(DEFAULT_PARAMS, wave, ['arrogance'], 100 + 2 * x, standardDeckComposition())
    expect(result.wave.stock).toHaveLength(0)
    expect(result.wave.status).toBe('ended')
    expect(result.wave.endReason).toBe('target')
    expect(result.wave.score).toBe(100 + 2 * x)
    // 直前プレイの古い内訳が残らず、慢心の加算がlastBonusGainsに正しく反映される
    expect(result.wave.lastGain).toBeNull()
    expect(result.wave.lastBonusGains).toHaveLength(1)
    const gain = result.wave.lastBonusGains[0]
    expect(gain?.points).toBe(2 * x)
    expect(gain?.parts).toContain(`慢心+${2 * x}`)
  })

  test('誠実(パターン継続時の直接加算)でスコアが目標に達したら即座にendReason=targetとなりウェーブが終了する', () => {
    const n = DEFAULT_PARAMS.talismans.sincerity.n
    const wave = makeWave({
      stock: [card(1, '♠', 6)], // 黒(色継続)。引くとパターン継続する
      chain: [card(2, '♣', 4), card(3, '♠', 5)], // 黒2枚、同色成立中
      linked: true,
      combo: 2,
      score: 100,
    })
    const result = drawStock(DEFAULT_PARAMS, wave, ['sincerity'], 100 + n, standardDeckComposition())
    expect(result.wave.linked).toBe(true)
    expect(result.wave.score).toBe(100 + n)
    expect(result.wave.status).toBe('ended')
    expect(result.wave.endReason).toBe('target')
  })

  test('パターン継続めくりが同スートパターンで成立した場合、誠実は発動しない(同色専用)', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 6)],
      chain: [card(2, '♠', 4), card(3, '♠', 5)], // 同スート成立中
      linked: true,
      score: 100,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['sincerity'], 1000000, standardDeckComposition())
    expect(next.score).toBe(100)
  })

  test('博愛: コンボごとに1回だけリセットを無効化し、パターン継続と同じ扱いになる', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)], // 同スートでも階段でもなく本来リセットする
      chain: [card(2, '♥', 5)],
      linked: true,
      combo: 2,
      benevolenceUsedThisCombo: false,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['benevolence'], 1000000, standardDeckComposition())
    expect(next.combo).toBe(2) // リセットされず維持
    expect(next.linked).toBe(true)
    expect(next.chain).toEqual([card(2, '♥', 5), card(1, '♣', 9)])
    expect(next.benevolenceUsedThisCombo).toBe(true)
  })

  test('博愛: 既に今のコンボで使っていれば通常通りリセットされる', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      chain: [card(2, '♥', 5)],
      linked: true,
      combo: 2,
      benevolenceUsedThisCombo: true,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['benevolence'], 1000000, standardDeckComposition())
    expect(next.combo).toBe(0)
  })

  test('祝福を持っていても、コンボリセット時にwave.comboは0になる(baseComboCount自体は保持される)', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      tableau: [[card(2, '♣', 8)]],
      chain: [card(3, '♥', 5)],
      linked: true,
      baseComboCount: 4,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['sanctify'], 1000000, standardDeckComposition())
    expect(next.combo).toBe(0)
    expect(next.baseComboCount).toBe(4)
  })

  test('祝福を持たなければコンボリセット時は通常通り0になる', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      tableau: [[card(2, '♣', 8)]],
      chain: [card(3, '♥', 5)],
      linked: true,
      baseComboCount: 4,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], 1000000, standardDeckComposition())
    expect(next.combo).toBe(0)
  })

  test('ナウジズ: コンボリセット時、floor(直前コンボ/2)から再開する(baseComboCountは無関係)', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      tableau: [[card(2, '♣', 8)]],
      chain: [card(3, '♥', 5)],
      linked: true,
      combo: 7,
      baseComboCount: 1,
      nauthizActiveThisWave: true,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], 1000000, standardDeckComposition())
    expect(next.combo).toBe(3) // floor(7/2)
    expect(next.baseComboCount).toBe(1) // 変化しない
  })

  test('イサ: comboFrozenThisWave中はコンボリセットが起きても値が変わらない', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      tableau: [[card(2, '♣', 8)]],
      chain: [card(3, '♥', 5)],
      linked: true,
      combo: 7,
      comboFrozenThisWave: true,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], 1000000, standardDeckComposition())
    expect(next.combo).toBe(7)
  })

  test('イサはナウジズより優先される(両方有効でも凍結が勝つ)', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      tableau: [[card(2, '♣', 8)]],
      chain: [card(3, '♥', 5)],
      linked: true,
      combo: 7,
      baseComboCount: 1,
      comboFrozenThisWave: true,
      nauthizActiveThisWave: true,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], 1000000, standardDeckComposition())
    expect(next.combo).toBe(7)
  })

  test('イサ: comboFrozenThisWave中は素朴パスでもコンボ数が変わらない', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 9)],
      combo: 5,
      chain: [card(2, '♠', 4), card(3, '♠', 5)],
      linked: true,
      comboFrozenThisWave: true,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['naive'], 1000000, standardDeckComposition())
    expect(next.combo).toBe(5)
  })

  test('慈悲: コンボ数がc以下でリセットされるとmercyActiveNextComboがtrueになる', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      chain: [card(3, '♥', 5)],
      linked: true,
      combo: DEFAULT_PARAMS.talismans.mercy.c,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['mercy'], 1000000, standardDeckComposition())
    expect(next.mercyActiveNextCombo).toBe(true)
  })

  test('慈悲: コンボ数がcより大きい状態でリセットされるとmercyActiveNextComboはfalseになる', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      chain: [card(3, '♥', 5)],
      linked: true,
      combo: DEFAULT_PARAMS.talismans.mercy.c + 5,
      mercyActiveNextCombo: true,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['mercy'], 1000000, standardDeckComposition())
    expect(next.mercyActiveNextCombo).toBe(false)
  })

  test('慢心の護符: 山札が尽きた瞬間、lastBonusGainsに直接加算が別枠で入る', () => {
    const items: ItemId[] = ['arrogance']
    const wave = makeWave({
      foundation: card(0, '♠', 5),
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      stock: [card(9, '♠', 9)],
      chain: [card(0, '♠', 5)],
      linked: false,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, items, 1000000, standardDeckComposition(), 'none')
    const remainingTableau = 2
    const expected = remainingTableau * DEFAULT_PARAMS.talismans.arrogance.x
    expect(next.lastBonusGains.some(g => g.label === '護符による直接加算' && g.parts.includes(`慢心+${expected}`))).toBe(true)
    // 回帰防止: lastGainとlastBonusGainsの合計が実際のスコア増分と一致することを確認する(二重計上防止)。
    const bonusTotal = next.lastBonusGains.reduce((sum, g) => sum + g.points, 0)
    expect((next.lastGain?.points ?? 0) + bonusTotal).toBe(next.score - wave.score)
  })

  test('沈着・冷静の護符: コンボリセット時、lastBonusGainsに直接加算がまとめて別枠で入る', () => {
    const items: ItemId[] = ['composure', 'clarity']
    const wave = makeWave({
      foundation: card(0, '♠', 5),
      // 新しいfoundationになるdrawnCard(rank9)との差が1でも12でもないため、
      // drawStockのリセット分岐でhasPlayableColumns=falseになる(沈着の発火条件)
      tableau: [[card(1, '♣', 6)]],
      stock: [card(9, '♠', 9)],
      chain: [card(0, '♠', 5)],
      linked: false,
      roleFiredThisChain: false,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, items, 1000000, standardDeckComposition(), 'none')
    const entry = next.lastBonusGains.find(g => g.label === '護符による直接加算')
    expect(entry).toBeDefined()
    expect(entry?.parts).toContain(`沈着+${DEFAULT_PARAMS.talismans.composure.n}`)
    expect(entry?.parts).toContain(`冷静+${DEFAULT_PARAMS.talismans.clarity.n}`)
    // 回帰防止: lastGainとlastBonusGainsの合計が実際のスコア増分と一致することを確認する(二重計上防止)。
    const bonusTotal = next.lastBonusGains.reduce((sum, g) => sum + g.points, 0)
    expect((next.lastGain?.points ?? 0) + bonusTotal).toBe(next.score - wave.score)
  })

  test('誠実の護符: 山札めくりで同色(同スートではない)パターン継続した時、lastBonusGainsに直接加算が別枠で入る', () => {
    const items: ItemId[] = ['sincerity']
    // sincerityはctx.colorHeld(=colorHeld && !suitHeld、つまり「同色だが同スートではない」)でのみ
    // 発火する。チェーンを赤2スート(♥・♦)混在にして、同スートは崩しつつ同色は保つ。
    const wave = makeWave({
      foundation: card(0, '♥', 3),
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      stock: [card(9, '♦', 7)],
      chain: [card(20, '♥', 3), card(21, '♦', 9), card(22, '♥', 2)],
      linked: true,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, items, 1000000, standardDeckComposition(), 'none')
    expect(next.lastDrawEffect).toBe('pattern')
    expect(next.lastBonusGains.some(g => g.label === '護符による直接加算' && g.parts.includes(`誠実+${DEFAULT_PARAMS.talismans.sincerity.n}`))).toBe(true)
    // 回帰防止: lastGainとlastBonusGainsの合計が実際のスコア増分と一致することを確認する(二重計上防止)。
    const bonusTotal = next.lastBonusGains.reduce((sum, g) => sum + g.points, 0)
    expect((next.lastGain?.points ?? 0) + bonusTotal).toBe(next.score - wave.score)
  })

  test('素朴+誠実を併用してもlastGain(山札めくり得点)とlastBonusGains(誠実の直接加算)が二重計上されない', () => {
    // Task 3で発見された二重計上バグ(直接加算の値がlastGainの元になる変数にも混入する)は、
    // naive(素朴)による山札めくり得点計算パスを通さないと検知できない回帰テストになるため、
    // 単体のsincerityテストとは別に、naiveを併用したケースを検証する。
    const items: ItemId[] = ['naive', 'sincerity']
    const wave = makeWave({
      foundation: card(0, '♥', 3),
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      stock: [card(9, '♦', 7)],
      chain: [card(20, '♥', 3), card(21, '♦', 9), card(22, '♥', 2)],
      linked: true,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, items, 1000000, standardDeckComposition(), 'none')
    expect(next.lastDrawEffect).toBe('pattern')
    // naiveによる山札めくり得点計算が実際に発生している(lastGainがnullでない)ことを確認した上で、
    // 誠実の直接加算がlastBonusGainsにも別枠で入っていることを確認する。
    expect(next.lastGain).not.toBeNull()
    expect(next.lastGain?.points).toBeGreaterThan(0)
    expect(next.lastBonusGains.some(g => g.label === '護符による直接加算' && g.parts.includes(`誠実+${DEFAULT_PARAMS.talismans.sincerity.n}`))).toBe(true)
    const bonusTotal = next.lastBonusGains.reduce((sum, g) => sum + g.points, 0)
    expect((next.lastGain?.points ?? 0) + bonusTotal).toBe(next.score - wave.score)
  })
})

describe('isStuck', () => {
  test('場札が残っていて山札が空、かつ取れる札が無いなら手詰まり', () => {
    const wave = makeWave({
      foundation: card(0, '♠', 5),
      stock: [],
      tableau: [[card(1, '♣', 9)]], // 差4、取れない
    })
    expect(isStuck('none', wave)).toBe(true)
  })

  test('取れる札があれば手詰まりではない', () => {
    const wave = makeWave({
      foundation: card(0, '♠', 5),
      stock: [],
      tableau: [[card(1, '♣', 6)]],
    })
    expect(isStuck('none', wave)).toBe(false)
  })

  test('山札が残っていれば手詰まりではない', () => {
    const wave = makeWave({
      foundation: card(0, '♠', 5),
      stock: [card(2, '♦', 1)],
      tableau: [[card(1, '♣', 9)]],
    })
    expect(isStuck('none', wave)).toBe(false)
  })

  test('場札が0枚なら手詰まりではない(全消し扱い)', () => {
    const wave = makeWave({ stock: [], tableau: [] })
    expect(isStuck('none', wave)).toBe(false)
  })

  test('ダガズを所持していて捨て札があれば、山札が復活できるため手詰まりではない', () => {
    const wave = makeWave({
      foundation: card(0, '♠', 5),
      stock: [],
      tableau: [[card(1, '♣', 9)]], // 差4、取れない
      discardPile: [card(2, '♦', 3)],
    })
    expect(isStuck('none', wave, ['dagaz'])).toBe(false)
  })

  test('ダガズを所持していても捨て札が無ければ手詰まりのまま', () => {
    const wave = makeWave({
      foundation: card(0, '♠', 5),
      stock: [],
      tableau: [[card(1, '♣', 9)]],
      discardPile: [],
    })
    expect(isStuck('none', wave, ['dagaz'])).toBe(true)
  })
})

describe('markStuck', () => {
  test('playing中のウェーブをended/stuckにする', () => {
    const wave = makeWave({ status: 'playing' })
    const next = markStuck(wave)
    expect(next.status).toBe('ended')
    expect(next.endReason).toBe('stuck')
  })

  test('既にendedなら変化しない', () => {
    const wave = makeWave({ status: 'ended', endReason: 'target' })
    expect(markStuck(wave)).toBe(wave)
  })
})

describe('DEFAULT_PARAMS.talismans (グループ4〜8)', () => {
  test('35個分の既定値が正しく設定されている', () => {
    expect(DEFAULT_PARAMS.talismans.calm.n).toBe(200)
    expect(DEFAULT_PARAMS.talismans.serenity.x).toBe(1.5)
    expect(DEFAULT_PARAMS.talismans.destiny.n).toBe(300)
    expect(DEFAULT_PARAMS.talismans.fate.x).toBe(2.0)
    expect(DEFAULT_PARAMS.talismans.relief.n).toBe(100)
    expect(DEFAULT_PARAMS.talismans.verdantGreen.x).toBe(3)
    expect(DEFAULT_PARAMS.talismans.gem.x).toBe(3)
    expect(DEFAULT_PARAMS.talismans.resolve.x).toBe(3)
    expect(DEFAULT_PARAMS.talismans.grail.x).toBe(3)
    expect(DEFAULT_PARAMS.talismans.moonlight.x).toBe(1.5)
    expect(DEFAULT_PARAMS.talismans.sunlight.x).toBe(1.5)
    expect(DEFAULT_PARAMS.talismans.crown.x).toBe(0.5)
    expect(DEFAULT_PARAMS.talismans.cloverLeaf.n).toBe(50)
    expect(DEFAULT_PARAMS.talismans.coin.n).toBe(50)
    expect(DEFAULT_PARAMS.talismans.blade.n).toBe(50)
    expect(DEFAULT_PARAMS.talismans.chalice.n).toBe(50)
    expect(DEFAULT_PARAMS.talismans.balance.n).toBe(200)
    expect(DEFAULT_PARAMS.talismans.harmony.x).toBe(1.5)
    expect(DEFAULT_PARAMS.talismans.nobility.n).toBe(200)
    expect(DEFAULT_PARAMS.talismans.tenacity.x).toBe(0.1)
    expect(DEFAULT_PARAMS.talismans.determination.x).toBe(0.1)
    expect(DEFAULT_PARAMS.talismans.cycle.x).toBe(3)
    expect(DEFAULT_PARAMS.talismans.reincarnation.x).toBe(10)
    expect(DEFAULT_PARAMS.talismans.majesty.x).toBe(50)
    expect(DEFAULT_PARAMS.talismans.omen.m).toBe(20)
    expect(DEFAULT_PARAMS.talismans.omen.x).toBe(1.5)
    expect(DEFAULT_PARAMS.talismans.crescent.m).toBe(10)
    expect(DEFAULT_PARAMS.talismans.crescent.x).toBe(3)
    expect(DEFAULT_PARAMS.talismans.blessing.x).toBe(1.5)
    expect(DEFAULT_PARAMS.talismans.focus.x).toBe(3)
    expect(DEFAULT_PARAMS.talismans.lapis.x).toBe(2)
    expect(DEFAULT_PARAMS.talismans.jade.n).toBe(200)
    expect(DEFAULT_PARAMS.talismans.emptyMind.x).toBe(4)
    expect(DEFAULT_PARAMS.talismans.prologue.n).toBe(500)
    expect(DEFAULT_PARAMS.talismans.interlude.m).toBe(5)
    expect(DEFAULT_PARAMS.talismans.interlude.n).toBe(1000)
    expect(DEFAULT_PARAMS.talismans.morningDew.n).toBe(5000)
    expect(DEFAULT_PARAMS.talismans.drizzle.n).toBe(50)
  })
})

describe('DEFAULT_PARAMS.talismans.resilience', () => {
  test('既定値が設定されている', () => {
    expect(DEFAULT_PARAMS.talismans.resilience.p).toBe(30)
  })
})

describe('DEFAULT_PARAMS.talismans (グループ9〜16)', () => {
  test('既定値が正しく設定されている', () => {
    expect(DEFAULT_PARAMS.talismans.gentleBreeze.n).toBe(100)
    expect(DEFAULT_PARAMS.talismans.resonance.x).toBe(0.3)
    expect(DEFAULT_PARAMS.talismans.azureSky.x).toBe(0.3)
    expect(DEFAULT_PARAMS.talismans.amber.x).toBe(0.1)
    expect(DEFAULT_PARAMS.talismans.composure.n).toBe(500)
    expect(DEFAULT_PARAMS.talismans.clarity.n).toBe(500)
    expect(DEFAULT_PARAMS.talismans.arrogance.x).toBe(50)
    expect(DEFAULT_PARAMS.talismans.echo.n).toBe(200)
    expect(DEFAULT_PARAMS.talismans.shootingStar.c).toBe(10)
    expect(DEFAULT_PARAMS.talismans.shootingStar.p).toBe(10)
    expect(DEFAULT_PARAMS.talismans.intuition.x).toBe(0.3)
    expect(DEFAULT_PARAMS.talismans.sincerity.n).toBe(300)
    expect(DEFAULT_PARAMS.talismans.darkClouds.r).toBe(1)
    expect(DEFAULT_PARAMS.talismans.regeneration.p).toBe(50)
    expect(DEFAULT_PARAMS.talismans.passion.x).toBe(1.5)
    expect(DEFAULT_PARAMS.talismans.fightingSpirit.x).toBe(1.3)
  })
})

describe('DEFAULT_PARAMS.talismans (グループ17)', () => {
  test('既定値が正しく設定されている', () => {
    expect(DEFAULT_PARAMS.talismans.protection.c).toBe(3)
    expect(DEFAULT_PARAMS.talismans.earth.c).toBe(2)
    expect(DEFAULT_PARAMS.talismans.morningStar.x).toBe(0.2)
    expect(DEFAULT_PARAMS.talismans.mercy.c).toBe(3)
    expect(DEFAULT_PARAMS.talismans.mercy.x).toBe(1.5)
    expect(DEFAULT_PARAMS.talismans.deadline.n).toBe(10)
  })
})

describe('createInitialRun / beginRun', () => {
  test('createInitialRunはtitleフェーズでwave=null、pendingNewItemはnull', () => {
    const run = createInitialRun()
    expect(run.phase).toBe('title')
    expect(run.wave).toBeNull()
    expect(run.items).toEqual([])
    expect(run.pendingNewItem).toBeNull()
  })

  test('beginRunはplayingフェーズでステージ0・ウェーブ0から始まる、pendingNewItemはnull', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    expect(run.phase).toBe('playing')
    expect(run.stageIndex).toBe(0)
    expect(run.waveIndex).toBe(0)
    expect(run.wave).not.toBeNull()
    expect(run.pendingNewItem).toBeNull()
  })
})

describe('resolveWaveEnd', () => {
  function endedRun(overrides: Partial<RunState>, waveScore: number): RunState {
    const run = beginRun(DEFAULT_PARAMS, 1)
    return {
      ...run,
      ...overrides,
      wave: { ...run.wave!, score: waveScore, status: 'ended', endReason: 'target' },
    }
  }

  test('目標未達ならgameOverになる', () => {
    const run = endedRun({}, 0)
    const next = resolveWaveEnd(DEFAULT_PARAMS, run)
    expect(next.phase).toBe('gameOver')
  })

  test('ウェーブ1・2クリアならitemSelectになりofferにプール内の未所持アイテムが入る', () => {
    const run = endedRun({ waveIndex: 0 }, DEFAULT_PARAMS.stages[0].targets[0])
    const next = resolveWaveEnd(DEFAULT_PARAMS, run, createRng(5))
    expect(next.phase).toBe('itemSelect')
    expect(next.offer).toHaveLength(3)
    next.offer.forEach(id => expect(ITEM_POOL).toContain(id))
    expect(new Set(next.offer).size).toBe(3) // 重複なし
  })

  test('最終ウェーブクリア・次ステージありならstageClearになる', () => {
    const run = endedRun({ waveIndex: 2 }, DEFAULT_PARAMS.stages[0].targets[2])
    const next = resolveWaveEnd(DEFAULT_PARAMS, run)
    expect(next.phase).toBe('stageClear')
  })

  test('最終ステージの最終ウェーブクリアならallClearになる', () => {
    const lastStage = DEFAULT_PARAMS.stages.length - 1
    const run = endedRun({ waveIndex: 2, stageIndex: lastStage }, DEFAULT_PARAMS.stages[lastStage].targets[2])
    const next = resolveWaveEnd(DEFAULT_PARAMS, run)
    expect(next.phase).toBe('allClear')
  })
})

describe('pickItem / advanceStage / restartRun', () => {
  test('pickItemでアイテムが追加され次ウェーブが始まる(revelationSelectフェーズを経由する)', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'itemSelect', waveIndex: 0, offer: ['bridge'] }
    const next = pickItem(DEFAULT_PARAMS, run, 'bridge', 2)
    expect(next.phase).toBe('revelationSelect')
    expect(next.items).toEqual(['bridge'])
    expect(next.waveIndex).toBe(1)
  })

  test('advanceStageで次ステージのウェーブ0から始まる', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'stageClear', stageIndex: 0 }
    const next = advanceStage(DEFAULT_PARAMS, run, 2)
    expect(next.phase).toBe('playing')
    expect(next.stageIndex).toBe(1)
    expect(next.waveIndex).toBe(0)
  })

  test('restartRunでステージ0・ウェーブ0・アイテムなしに戻る', () => {
    const next = restartRun(DEFAULT_PARAMS, 1)
    expect(next.phase).toBe('playing')
    expect(next.stageIndex).toBe(0)
    expect(next.waveIndex).toBe(0)
    expect(next.items).toEqual([])
  })
})

describe('護符所持上限・交換(maxItems / confirmItemSwap / cancelItemSwap / skipItemSelect)', () => {
  function fullItemsRun(overrides: Partial<RunState> = {}): RunState {
    return {
      ...beginRun(DEFAULT_PARAMS, 1),
      phase: 'itemSelect',
      // maxItems(5)ちょうどの所持状態を作るための検証用フィクスチャ。
      // 実プレイでは護符プールが2種類しか無いため実際にこの状態には到達しないが、
      // pickItem/confirmItemSwapの上限判定・入れ替えロジック自体は所持数のみで動くため検証できる。
      items: ['bridge', 'grace', 'bridge', 'grace', 'bridge'],
      offer: ['grace'],
      pendingNewItem: null,
      ...overrides,
    }
  }

  test('所持数がmaxItems未満ならpickItemで即座に反映される(従来通り)。以後はrevelationSelectフェーズへ進む', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'itemSelect', items: ['bridge'], offer: ['grace'] }
    const next = pickItem(DEFAULT_PARAMS, run, 'grace', 2)
    expect(next.phase).toBe('revelationSelect')
    expect(next.items).toEqual(['bridge', 'grace'])
    expect(next.pendingNewItem).toBeNull()
  })

  test('所持数がmaxItems以上ならpickItemはウェーブを進めずpendingNewItemをセットするのみ', () => {
    const run = fullItemsRun()
    const next = pickItem(DEFAULT_PARAMS, run, 'grace', 2)
    expect(next.phase).toBe('itemSelect')
    expect(next.items).toEqual(run.items)
    expect(next.offer).toEqual(run.offer)
    expect(next.pendingNewItem).toBe('grace')
    expect(next.waveIndex).toBe(run.waveIndex)
  })

  test('confirmItemSwapで指定した護符が1つ入れ替わり次ウェーブへ進む(revelationSelectフェーズを経由する)', () => {
    const run = fullItemsRun({ pendingNewItem: 'grace' })
    // run.items = ['bridge', 'grace', 'bridge', 'grace', 'bridge'] (先頭のbridgeが入れ替え対象)
    const next = confirmItemSwap(DEFAULT_PARAMS, run, 'bridge', 3)
    expect(next.phase).toBe('revelationSelect')
    expect(next.items).toEqual(['grace', 'bridge', 'grace', 'bridge', 'grace'])
    expect(next.pendingNewItem).toBeNull()
    expect(next.waveIndex).toBe(run.waveIndex + 1)
  })

  test('pendingNewItemが無い状態でconfirmItemSwapを呼んでも何も起きない', () => {
    const run = fullItemsRun({ pendingNewItem: null })
    const next = confirmItemSwap(DEFAULT_PARAMS, run, 'bridge', 3)
    expect(next).toBe(run)
  })

  test('cancelItemSwapでpendingNewItemがnullに戻り、フェーズ・オファー・所持アイテムは変わらない', () => {
    const run = fullItemsRun({ pendingNewItem: 'grace' })
    const next = cancelItemSwap(run)
    expect(next.pendingNewItem).toBeNull()
    expect(next.phase).toBe('itemSelect')
    expect(next.offer).toEqual(run.offer)
    expect(next.items).toEqual(run.items)
  })

  test('skipItemSelectは護符を追加せずウェーブを進める(revelationSelectフェーズを経由する)', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'itemSelect', items: ['bridge'], offer: ['grace'] }
    const next = skipItemSelect(DEFAULT_PARAMS, run, 2)
    expect(next.phase).toBe('revelationSelect')
    expect(next.items).toEqual(['bridge'])
    expect(next.waveIndex).toBe(run.waveIndex + 1)
    expect(next.pendingNewItem).toBeNull()
  })

  test('phaseがitemSelect以外ならconfirmItemSwap/cancelItemSwap/skipItemSelectは何もしない', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'playing' }
    expect(confirmItemSwap(DEFAULT_PARAMS, run, 'bridge')).toBe(run)
    expect(cancelItemSwap(run)).toBe(run)
    expect(skipItemSelect(DEFAULT_PARAMS, run)).toBe(run)
  })
})

describe('applyPlayCard / applyDrawStock / applyStuckCheck', () => {
  test('applyPlayCardはrun.waveを更新する', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const col0 = run.wave!.tableau[0]
    const before = col0.length
    const next = applyPlayCard(DEFAULT_PARAMS, run, 0)
    expect(next.wave!.tableau[0].length).toBeLessThanOrEqual(before)
  })

  test('applyDrawStockはrun.wave.stockを減らす', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const before = run.wave!.stock.length
    const next = applyDrawStock(DEFAULT_PARAMS, run)
    expect(next.wave!.stock.length).toBe(before - 1)
  })

  test('applyStuckCheckは手詰まりでなければ何もしない', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const next = applyStuckCheck(DEFAULT_PARAMS, run)
    expect(next.wave!.status).toBe('playing')
  })

  test('phaseがplaying以外なら何もしない', () => {
    const run: RunState = { ...createInitialRun() }
    expect(applyPlayCard(DEFAULT_PARAMS, run, 0)).toBe(run)
    expect(applyDrawStock(DEFAULT_PARAMS, run)).toBe(run)
    expect(applyStuckCheck(DEFAULT_PARAMS, run)).toBe(run)
  })
})

describe('applyStuckCheck (不屈の護符)', () => {
  test('不屈を持ち捨て札があれば、手詰まり時にスコア消費して山札へ約半数戻し、その後山札を1枚捲って手詰まりを回避する', () => {
    const wave = makeWave({
      tableau: [[card(1, '♠', 5)]],
      stock: [],
      foundation: card(0, '♣', 1), // 差が4で取れない
      chain: [card(0, '♣', 1)],
      score: 1000,
      discardPile: [card(10, '♦', 2), card(11, '♦', 3), card(12, '♦', 4), card(13, '♦', 5)],
    })
    const run: RunState = {
      phase: 'playing', stageIndex: 0, waveIndex: 0, items: ['resilience'], offer: [],
      wave, pendingNewItem: null, deckComposition: standardDeckComposition(), rites: [],
      revelations: [], revelationOffer: [], extraTableauRows: 0,
      oracleLevels: defaultOracleLevels(), oracleOffer: [],
    }
    const next = applyStuckCheck(DEFAULT_PARAMS, run, createRng(1))
    expect(next.wave!.status).toBe('playing') // 手詰まりが解消されている
    expect(next.wave!.score).toBe(700) // 1000 - 30%
    expect(next.wave!.resilienceUsedThisWave).toBe(true)
    // 4枚の半数=2枚が山札へ、そのうち1枚は自動でめくられるため最終的なstockは1枚
    expect(next.wave!.stock).toHaveLength(1)
    // 捨て札4枚のうち2枚を山札へ戻した残り2枚に、自動めくりでパターン継続せずリセットされた
    // 直前のfoundation(1枚)が捨て札へ加わり、計3枚になる
    expect(next.wave!.discardPile).toHaveLength(3)
  })

  test('不屈を持っていても捨て札が無ければ通常通り手詰まりになる', () => {
    const wave = makeWave({
      tableau: [[card(1, '♠', 5)]],
      stock: [],
      foundation: card(0, '♣', 1),
      score: 1000,
      discardPile: [],
    })
    const run: RunState = {
      phase: 'playing', stageIndex: 0, waveIndex: 0, items: ['resilience'], offer: [],
      wave, pendingNewItem: null, deckComposition: standardDeckComposition(), rites: [],
      revelations: [], revelationOffer: [], extraTableauRows: 0,
      oracleLevels: defaultOracleLevels(), oracleOffer: [],
    }
    const next = applyStuckCheck(DEFAULT_PARAMS, run)
    expect(next.wave!.status).toBe('ended')
    expect(next.wave!.endReason).toBe('stuck')
  })

  test('不屈を持っていなければ捨て札があっても通常通り手詰まりになる', () => {
    const wave = makeWave({
      tableau: [[card(1, '♠', 5)]],
      stock: [],
      foundation: card(0, '♣', 1),
      score: 1000,
      discardPile: [card(10, '♦', 2), card(11, '♦', 3)],
    })
    const run: RunState = {
      phase: 'playing', stageIndex: 0, waveIndex: 0, items: [], offer: [],
      wave, pendingNewItem: null, deckComposition: standardDeckComposition(), rites: [],
      revelations: [], revelationOffer: [], extraTableauRows: 0,
      oracleLevels: defaultOracleLevels(), oracleOffer: [],
    }
    const next = applyStuckCheck(DEFAULT_PARAMS, run)
    expect(next.wave!.status).toBe('ended')
    expect(next.wave!.endReason).toBe('stuck')
  })

  test('不屈: ウェーブ中2回目は発動しない(resilienceUsedThisWaveがtrueなら通常通り手詰まりになる)', () => {
    const wave = makeWave({
      tableau: [[card(1, '♠', 5)]],
      stock: [],
      foundation: card(0, '♣', 1),
      score: 1000,
      discardPile: [card(10, '♦', 2), card(11, '♦', 3)],
      resilienceUsedThisWave: true,
    })
    const run: RunState = {
      phase: 'playing', stageIndex: 0, waveIndex: 0, items: ['resilience'], offer: [],
      wave, pendingNewItem: null, deckComposition: standardDeckComposition(), rites: [],
      revelations: [], revelationOffer: [], extraTableauRows: 0,
      oracleLevels: defaultOracleLevels(), oracleOffer: [],
    }
    const next = applyStuckCheck(DEFAULT_PARAMS, run)
    expect(next.wave!.status).toBe('ended')
    expect(next.wave!.endReason).toBe('stuck')
  })

  test('治癒と不屈を同時所持: 手詰まり直前に列一掃していた列も、不屈による復活と合わせて処理される', () => {
    const wave = makeWave({
      tableau: [[card(1, '♠', 5)], []],
      stock: [],
      foundation: card(0, '♣', 1),
      chain: [card(0, '♣', 1)],
      score: 1000,
      sweptColumnsThisCombo: [{ colIndex: 1, startLength: 2 }],
      discardPile: [card(10, '♦', 2), card(11, '♦', 3), card(12, '♦', 4), card(13, '♦', 5)],
    })
    const run: RunState = {
      phase: 'playing', stageIndex: 0, waveIndex: 0, items: ['healing', 'resilience'], offer: [],
      wave, pendingNewItem: null, deckComposition: standardDeckComposition(), rites: [],
      revelations: [], revelationOffer: [], extraTableauRows: 0,
      oracleLevels: defaultOracleLevels(), oracleOffer: [],
    }
    const next = applyStuckCheck(DEFAULT_PARAMS, run, createRng(1))
    expect(next.wave!.tableau[1].length).toBeGreaterThan(0) // 治癒によって列1が復活している
  })

  test('治癒のみ所持(不屈なし): 手詰まり直前に列一掃していた列は復活するが、山札には戻らないため手詰まりのまま終了する', () => {
    const wave = makeWave({
      tableau: [[card(1, '♠', 5)], []],
      stock: [],
      foundation: card(0, '♣', 1),
      chain: [card(0, '♣', 1)],
      score: 1000,
      sweptColumnsThisCombo: [{ colIndex: 1, startLength: 2 }],
      discardPile: [card(10, '♦', 2), card(11, '♦', 3), card(12, '♦', 4), card(13, '♦', 5)],
    })
    const run: RunState = {
      phase: 'playing', stageIndex: 0, waveIndex: 0, items: ['healing'], offer: [],
      wave, pendingNewItem: null, deckComposition: standardDeckComposition(), rites: [],
      revelations: [], revelationOffer: [], extraTableauRows: 0,
      oracleLevels: defaultOracleLevels(), oracleOffer: [],
    }
    const next = applyStuckCheck(DEFAULT_PARAMS, run, createRng(1))
    expect(next.wave!.tableau[1].length).toBeGreaterThan(0) // 治癒によって列1は復活している
    expect(next.wave!.status).toBe('ended') // しかし山札には戻っていないため手詰まりのまま終了
    expect(next.wave!.endReason).toBe('stuck')
  })
})

describe('useRite', () => {
  test('所持している秘儀を使用すると効果が適用され、所持から1個削除される', () => {
    const wave = makeWave({ combo: 2, maxComboThisWave: 2 })
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), wave, rites: ['uruz'] }
    const next = useRite(DEFAULT_PARAMS, run, 'uruz', createRng(1))
    expect(next.wave!.combo).toBe(2 + DEFAULT_PARAMS.rites.uruz.n)
    expect(next.rites).toEqual([])
  })

  test('所持していない秘儀は使用できない(何も起こらない)', () => {
    const wave = makeWave({ combo: 2 })
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), wave, rites: [] }
    const next = useRite(DEFAULT_PARAMS, run, 'uruz', createRng(1))
    expect(next).toEqual(run)
  })

  test('使用条件を満たさない秘儀(チェーン2枚未満のティワズ)は使用できない', () => {
    const wave = makeWave({ chain: [card(1, '♣', 5)], chainOrigin: ['draw'] })
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), wave, rites: ['tiwaz'] }
    const next = useRite(DEFAULT_PARAMS, run, 'tiwaz', createRng(1))
    expect(next.rites).toEqual(['tiwaz'])
  })

  test('同じ秘儀を複数所持している場合、1個だけ消費される', () => {
    const wave = makeWave({ combo: 2, maxComboThisWave: 2 })
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), wave, rites: ['uruz', 'uruz'] }
    const next = useRite(DEFAULT_PARAMS, run, 'uruz', createRng(1))
    expect(next.rites).toEqual(['uruz'])
  })
})

describe('エイワズ(コンボリセット防止)とdrawStock/applyStuckCheckの統合', () => {
  test('シールド残り回数が1以上のとき、drawStockの通常コンボリセットが防がれチェーンが継続扱いになる', () => {
    const wave = makeWave({
      stock: [card(20, '♠', 1)],
      chain: [card(0, '♠', 5)],
      chainOrigin: ['draw'],
      linked: true,
      combo: 3,
      comboResetShieldRemaining: 1,
    })
    const result = drawStock(DEFAULT_PARAMS, wave, [], 1000000, standardDeckComposition())
    expect(result.wave.status).toBe('playing')
    expect(result.wave.combo).toBe(3)
    expect(result.wave.chain).toHaveLength(2)
    expect(result.wave.comboResetShieldRemaining).toBe(0)
  })

  test('シールド残り回数が0なら通常通りコンボリセットされる', () => {
    const wave = makeWave({
      stock: [card(20, '♠', 1)],
      chain: [card(0, '♠', 5)],
      chainOrigin: ['draw'],
      linked: true,
      combo: 3,
      comboResetShieldRemaining: 0,
    })
    const result = drawStock(DEFAULT_PARAMS, wave, [], 1000000, standardDeckComposition())
    expect(result.wave.combo).toBe(0)
    expect(result.wave.chain).toHaveLength(1)
  })

  test('手詰まり時、シールドが1以上ならコンボリセットが防がれ、カードの総数が保存される', () => {
    const wave = makeWave({
      tableau: [[card(1, '♠', 8)]], // 場札はあるが取れない(手詰まり)
      stock: [],
      foundation: card(0, '♠', 2),
      discardPile: [card(10, '♥', 4), card(11, '♦', 9)],
      chain: [card(0, '♠', 2), card(5, '♠', 3)],
      chainOrigin: ['draw', 'play'],
      combo: 4,
      comboResetShieldRemaining: 1,
      score: 1000,
    })
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), items: [], wave }
    const next = applyStuckCheck(DEFAULT_PARAMS, run, createRng(1))
    const totalCards = (w: WaveState) =>
      w.tableau.reduce((n, col) => n + col.length, 0) + w.stock.length + w.chain.length + w.discardPile.length
    expect(totalCards(next.wave!)).toBe(totalCards(wave))
    expect(next.wave!.combo).toBe(4) // シールドでコンボ維持(リセットされない)
    expect(next.wave!.comboResetShieldRemaining).toBe(0) // シールド1回分消費
  })

  test('全消し時、シールドが1以上ならコンボリセットが防がれ、カードの総数が保存される', () => {
    // baseWaveはplayCackのdescribe内にスコープされ本ブロックからは参照できないため、
    // 同等のfoundation(♠5)を持つmakeWaveを直接使う。プレイする場札♣6はfoundation♠5と差1で取得可能。
    const wave = makeWave({
      foundation: card(0, '♠', 5),
      tableau: [[card(1, '♣', 6)]],
      stock: [card(20, '♠', 9)],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
      discardPile: [card(10, '♦', 1), card(11, '♦', 2)],
      combo: 4,
      comboResetShieldRemaining: 1,
    })
    const initialTotal =
      wave.tableau.reduce((n, col) => n + col.length, 0) + wave.stock.length + wave.chain.length + wave.discardPile.length
    const result = playCard(DEFAULT_PARAMS, wave, 'none', [], 100000000, 0, standardDeckComposition(), createRng(1))
    const totalCards = (w: WaveState) =>
      w.tableau.reduce((n, col) => n + col.length, 0) + w.stock.length + w.chain.length + w.discardPile.length
    expect(totalCards(result.wave)).toBe(initialTotal)
    // プレイでcombo4→5に進んだ後、全消しでもシールドによりリセットされず維持される
    expect(result.wave.combo).toBe(5)
  })
})

describe('forceStockTop', () => {
  test('山札の一番上(末尾)が指定カードに置き換わる', () => {
    const wave = makeWave({ stock: [card(1, '♠', 2), card(2, '♣', 3)] })
    const next = forceStockTop(wave, '♥', 9, false)
    expect(next.stock).toHaveLength(2)
    expect(next.stock[0]).toEqual(card(1, '♠', 2))
    expect(next.stock[1].suit).toBe('♥')
    expect(next.stock[1].rank).toBe(9)
    expect(next.stock[1].wild).toBe(false)
  })

  test('山札が空の場合は指定カード1枚だけの山札になる', () => {
    const wave = makeWave({ stock: [] })
    const next = forceStockTop(wave, '★', 0, true)
    expect(next.stock).toHaveLength(1)
    expect(next.stock[0].suit).toBe('★')
    expect(next.stock[0].wild).toBe(true)
  })

  test('stock以外のWaveStateフィールドは変化しない', () => {
    const wave = makeWave({ stock: [card(1, '♠', 2)], score: 500, combo: 3 })
    const next = forceStockTop(wave, '♦', 5, false)
    expect(next.score).toBe(500)
    expect(next.combo).toBe(3)
    expect(next.chain).toEqual(wave.chain)
  })

  test('呼び出すたびに異なるidが振られる', () => {
    const wave = makeWave({ stock: [card(1, '♠', 2)] })
    const next1 = forceStockTop(wave, '♦', 5, false)
    const next2 = forceStockTop(wave, '♦', 5, false)
    expect(next1.stock[0].id).not.toBe(next2.stock[0].id)
  })
})

describe('drawStock (素朴の得点ルール変更)', () => {
  test('素朴: パターン継続めくりが通常プレイと同じ得点計算になり、コンボ数も加算される', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 9)], // 同スート継続(捲った後で実カード3枚)
      combo: 2,
      chain: [card(2, '♠', 4), card(3, '♠', 5)],
      linked: true,
      score: 0,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['naive'], 1000000, standardDeckComposition())
    expect(next.combo).toBe(3) // 通常プレイと同様にコンボが加算される
    expect(next.score).toBeGreaterThan(0) // 得点が発生する(通常は0のまま)
  })

  test('素朴を持たない場合は、パターン継続めくりで得点もコンボ加算も発生しない(既存挙動)', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 9)],
      combo: 2,
      chain: [card(2, '♠', 4), card(3, '♠', 5)],
      linked: true,
      score: 0,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], 1000000, standardDeckComposition())
    expect(next.combo).toBe(2) // 据え置き
    expect(next.score).toBe(0)
  })

  test('素朴+直感: パターン継続めくりの得点計算に直感の倍率が適用される', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 9)],
      combo: 2,
      chain: [card(2, '♠', 4), card(3, '♠', 5)],
      linked: true,
      score: 0,
      drawContinueCountThisChain: 2,
    })
    const withoutIntuition = drawStock(DEFAULT_PARAMS, wave, ['naive'], 1000000, standardDeckComposition())
    const withIntuition = drawStock(DEFAULT_PARAMS, wave, ['naive', 'intuition'], 1000000, standardDeckComposition())
    expect(withIntuition.wave.score).toBeGreaterThan(withoutIntuition.wave.score)
  })

  test('素朴: パターン継続めくりで役が成立すると、roleFiredThisChain/flushActiveThisComboがwaveに反映される', () => {
    const wave = makeWave({
      // 階段継続(3,4,5,6 → 7で継続、stairMinLen=5を満たす)かつ、末尾4枚が4スート
      // 揃うためcheckFlushも成立する組み合わせ。
      stock: [card(5, '♠', 7)],
      combo: 4,
      chain: [card(1, '♠', 3), card(2, '♥', 4), card(3, '♦', 5), card(4, '♣', 6)],
      linked: true,
      roleFiredThisChain: false,
      flushActiveThisCombo: false,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['naive'], 1000000, standardDeckComposition())
    expect(next.roleFiredThisChain).toBe(true)
    expect(next.flushActiveThisCombo).toBe(true)
  })

  test('黄金: 素朴パスでもコンボが+2進む', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 9)],
      combo: 2,
      chain: [card(2, '♠', 4), card(3, '♠', 5)],
      linked: true,
      score: 0,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['naive', 'golden'], 1000000, standardDeckComposition())
    expect(next.combo).toBe(4)
  })

  test('マンナズ: 素朴パス(drawStockの継続得点計算)でも得点が倍算される', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 9)],
      combo: 2,
      chain: [card(2, '♠', 4), card(3, '♠', 5)],
      linked: true,
      score: 0,
      mannazActiveThisWave: true,
    })
    const items: ItemId[] = ['naive', 'bridge']
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, items, 1000000, standardDeckComposition())
    const weight: Record<'C' | 'U' | 'R', number> = { C: 1, U: 2, R: 4 }
    const weightSum = items.reduce((sum, id) => sum + weight[DEFAULT_PARAMS.talismans[id].rarity], 0)
    const mannazFactor = 1 + weightSum * DEFAULT_PARAMS.rites.mannaz.x
    const newCombo = wave.combo + 1 // golden未所持
    const comboMultiplier = 1 + newCombo * DEFAULT_PARAMS.scoring.comboMultiplierStep
    // chain[♠4,♠5]+drawn♠9で同スート継続(3枚)成立、同スートボーナスが基礎点に加算される
    const base = DEFAULT_PARAMS.scoring.basePoint + DEFAULT_PARAMS.scoring.suitBonus
    expect(next.score).toBe(wave.score + Math.floor(base * comboMultiplier * mannazFactor))
  })

  test('基礎コンボ数(baseComboCount)は素朴パスの得点計算にも常に加算される', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 9)],
      combo: 2,
      chain: [card(2, '♠', 4), card(3, '♠', 5)],
      linked: true,
      score: 0,
      baseComboCount: 5,
    })
    const { wave: withBase } = drawStock(DEFAULT_PARAMS, wave, ['naive'], 1000000, standardDeckComposition())
    const { wave: without } = drawStock(DEFAULT_PARAMS, { ...wave, baseComboCount: 0 }, ['naive'], 1000000, standardDeckComposition())
    expect(withBase.score).toBeGreaterThan(without.score)
  })

  test('庇護・大地: 素朴パスでも所持順で一時comboに適用される', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 9)],
      combo: 0,
      chain: [card(2, '♠', 4), card(3, '♠', 5)],
      linked: true,
      score: 0,
    })
    // combo=0で継続めくり: newCombo=1。大地(c=2)が先なら一時combo=3(庇護c=3未満は満たさず不発化)。
    // 庇護が先なら一時combo=3に底上げ後、大地で+2して5になり、より高スコアになるはず。
    const earthThenProtection = drawStock(DEFAULT_PARAMS, wave, ['naive', 'earth', 'protection'], 1000000, standardDeckComposition())
    const protectionThenEarth = drawStock(DEFAULT_PARAMS, wave, ['naive', 'protection', 'earth'], 1000000, standardDeckComposition())
    expect(protectionThenEarth.wave.score).toBeGreaterThan(earthThenProtection.wave.score)
  })

  test('素朴(naive)のスコアリングでも、コンボ倍率は護符のgained加算効果に最後に適用される', () => {
    // 春風(springBreeze)は♣を取ったときn点の固定加算。同スート継続(♣×3、suitColorMinLen=3)でめくり、
    // コンボ2→3(倍率1+2*step)の状態で発火させ、固定加算分にもコンボ倍率がかかっていることを
    // 確認する(先にコンボ倍率だけ適用して後から加算する旧実装ではNG)。
    // 同スート継続によりevaluateChainBonusのsuitBonus(+100)も基礎点に乗るため、
    // 期待値はbasePoint+suitBonusを基準に計算する。
    const items: ItemId[] = ['naive', 'springBreeze']
    const wave = makeWave({
      stock: [card(1, '♣', 9)], // 同スート継続(捲った後で実カード3枚、♣)
      combo: 2,
      chain: [card(2, '♣', 4), card(3, '♣', 5)],
      linked: true,
      score: 0,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, items, 1000000, standardDeckComposition())
    expect(next.combo).toBe(3)
    const multiplier = 1 + 3 * DEFAULT_PARAMS.scoring.comboMultiplierStep
    const base = DEFAULT_PARAMS.scoring.basePoint + DEFAULT_PARAMS.scoring.suitBonus
    const expectedGained = Math.floor((base + DEFAULT_PARAMS.talismans.springBreeze.n) * multiplier)
    expect(next.lastGain?.points).toBe(expectedGained)
  })

  test('序章は山札めくり(素朴)の獲得点計算では発動しない(isPlayActionガード)', () => {
    // combo:0にすることで、naive分岐が見るnaiveCtx.combo(=effectiveCombo=newCombo)が
    // ちょうど1になる状況を作る。これは旧実装(ctx.combo===1で発動)なら誤って発動して
    // しまう値である。また、chainOriginを['play', 'draw']にすることでplayCountInChain
    // (=wave.chainOriginのうち'play'の数)もちょうど1にしている。つまりこの状況は
    // 「プレイなら序章の発動条件をどちらの基準で見ても満たす」状況だが、実際には
    // 山札めくり(素朴)でありisPlayAction===falseであるため、そのガードにより
    // 発動しないことを確認する。
    const items: ItemId[] = ['prologue', 'naive']
    const wave = makeWave({
      stock: [card(1, '♠', 9)], // 同スート継続(捲った後で実カード3枚)
      combo: 0,
      chain: [card(2, '♠', 4), card(3, '♠', 5)],
      chainOrigin: ['play', 'draw'],
      linked: true,
      score: 0,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, items, 1000000, standardDeckComposition())
    expect(next.lastDrawEffect).toBe('pattern')
    expect(next.lastGain?.parts.some(p => p.startsWith('序章'))).toBe(false)
  })

  test('幕間は山札めくり(素朴)の獲得点計算では発動しない(isPlayActionガード)', () => {
    // chainOriginに'play'をm個並べておくことで、naive分岐が見るnaiveCtx.playCountInChain
    // (=wave.chainOriginのうち'play'の数、素朴では+1されない)がちょうどmになる状況を作る。
    // これは新実装の判定式(ctx.isPlayAction && ctx.playCountInChain === m)のうち、
    // playCountInChain === mの側だけを見れば誤って発動してしまう境界値である。
    // 実際には山札めくり(素朴)でありisPlayAction===falseであるため、
    // isPlayActionガードのみがここでの不発火を防いでいることを確認する
    // (ガードを外すとこのテストはFAILすることを確認済み)。
    const m = DEFAULT_PARAMS.talismans.interlude.m
    const items: ItemId[] = ['interlude', 'naive']
    const wave = makeWave({
      stock: [card(1, '♠', 9)], // 同スート継続(捲った後で実カード3枚)
      combo: 0,
      chain: [card(2, '♠', 4), card(3, '♠', 5)],
      chainOrigin: [...Array(m).fill('play' as const), 'draw'],
      linked: true,
      score: 0,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, items, 1000000, standardDeckComposition())
    expect(next.lastDrawEffect).toBe('pattern')
    expect(next.lastGain?.parts.some(p => p.startsWith('幕間'))).toBe(false)
  })
})

describe('約束・暗雲', () => {
  test('約束: startWaveの山札構築後、継続可能なカードが山札の次(末尾)に来る', () => {
    // 継続条件を満たすカードが山札のどこかにあれば、末尾(次にめくられる位置)に来ることを、
    // 複数シードで試して「並べ替えありのほうが継続確率が実際に上がる」ことを確認する簡易テスト。
    //
    // 注: DEFAULT_PARAMSのままだとsuitColorMinLen=3・stairMinLen=5であり、ウェーブ開始直後の
    // chainは[foundation]のみ(長さ1)なので、そこにどんなカードを1枚足しても長さ2にしかならず、
    // chainContinuesPatternの条件(長さ3以上/5以上)を構造上絶対に満たせない(常にcontinueCount=0になる)。
    // これは約束の実装不備ではなく、「継続」概念そのものがウェーブ開始直後には成立し得ないため。
    // そのためこのテストではsuitColorMinLenを2に緩めたパラメータを使い、
    // 「継続可能なカードが山札にあれば末尾に来る」という約束の実装意図そのものを検証する。
    // 単に発生回数を数えるだけでは、並べ替えロジックをno-opにすり替えても偶然
    // (末尾のカードがたまたま継続可能)パスしてしまう可能性がある。そのため各シードごとに
    // 「山札全体に継続可能なカードが1枚でもあれば、末尾のカードも継続可能である」という
    // 含意そのものを検証する(no-opだと、この含意が偽になるシードが高確率で出現するはず)。
    const relaxedParams = {
      ...DEFAULT_PARAMS,
      scoring: { ...DEFAULT_PARAMS.scoring, suitColorMinLen: 2 },
    }
    let anyContinuesCount = 0
    const trials = 30
    for (let seed = 1; seed <= trials; seed++) {
      const { wave } = startWave(relaxedParams, 0, 0, ['promise'], standardDeckComposition(), seed)
      if (wave.stock.length === 0) continue
      const nextCard = wave.stock[wave.stock.length - 1]
      const anyContinues = wave.stock.some(c => chainContinuesPattern(relaxedParams.scoring, wave.chain, c))
      if (anyContinues) {
        anyContinuesCount++
        expect(chainContinuesPattern(relaxedParams.scoring, wave.chain, nextCard)).toBe(true)
      }
    }
    expect(anyContinuesCount).toBeGreaterThan(0)
  })

  test('約束: drawStockの後、末尾ではない位置にあった継続可能なカードが末尾に並べ替えられる', () => {
    const wave = makeWave({
      // card(3,♣,2)を引いた後のchainは黒3枚継続中になる。継続可能なcard(2,♠,6)は
      // 末尾ではない位置にあり、並べ替え無しなら継続不可のcard(1,♦,1)が末尾に残る。
      stock: [card(2, '♠', 6), card(1, '♦', 1), card(3, '♣', 2)],
      chain: [card(9, '♠', 4), card(10, '♠', 5)], // 黒2枚継続中
      linked: true,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['promise'], 1000000, standardDeckComposition())
    expect(next.stock[next.stock.length - 1]).toEqual(card(2, '♠', 6))
  })

  test('約束を持たなければ山札の並び順は変わらない(既存挙動)', () => {
    const wave = makeWave({
      stock: [card(2, '♠', 6), card(1, '♦', 1), card(3, '♣', 2)],
      chain: [card(9, '♠', 4), card(10, '♠', 5)],
      linked: true,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], 1000000, standardDeckComposition())
    expect(next.stock).toEqual([card(2, '♠', 6), card(1, '♦', 1)])
  })

  test('暗雲: ウェーブ開始時、場札がrows+r枚配られる', () => {
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, ['darkClouds'], standardDeckComposition(), 1)
    const expectedRows = DEFAULT_PARAMS.layout.rows + DEFAULT_PARAMS.talismans.darkClouds.r
    wave.tableau.forEach(col => expect(col).toHaveLength(expectedRows))
  })

  test('暗雲を持たなければ通常通りrows枚', () => {
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1)
    wave.tableau.forEach(col => expect(col).toHaveLength(DEFAULT_PARAMS.layout.rows))
  })
})

describe('天啓選択フェーズ', () => {
  test('護符選択(pickItem)を解決すると、revelationSelectフェーズへ遷移しrevelationOfferが3件セットされる', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const itemSelectRun: RunState = { ...run, phase: 'itemSelect', offer: ['bridge', 'grace'] }
    const next = pickItem(DEFAULT_PARAMS, itemSelectRun, 'bridge', 2, createRng(1))
    expect(next.phase).toBe('revelationSelect')
    expect(next.revelationOffer).toHaveLength(3)
    expect(next.items).toContain('bridge')
    expect(next.wave).not.toBeNull()
  })

  test('skipItemSelectを解決してもrevelationSelectフェーズへ遷移する', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const itemSelectRun: RunState = { ...run, phase: 'itemSelect', offer: ['bridge'] }
    const next = skipItemSelect(DEFAULT_PARAMS, itemSelectRun, 2, createRng(1))
    expect(next.phase).toBe('revelationSelect')
    expect(next.revelationOffer).toHaveLength(3)
  })

  test('useRevelationFromOffer: 対象選択不要な天啓(心)を使用すると、実際のウェーブが配られoracleSelectへ遷移する。所持には加わらない', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const revSelectRun: RunState = { ...run, phase: 'revelationSelect', revelationOffer: ['shin', 'kou', 'tei'] }
    const next = useRevelationFromOffer(DEFAULT_PARAMS, revSelectRun, 'shin', null, 3)
    expect(next.phase).toBe('oracleSelect')
    expect(next.revelations).toEqual([])
    expect(next.revelationOffer).toEqual([])
  })

  test('useRevelationFromOffer: オファーに含まれない天啓は無視される', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const revSelectRun: RunState = { ...run, phase: 'revelationSelect', revelationOffer: ['shin', 'kou', 'tei'] }
    const next = useRevelationFromOffer(DEFAULT_PARAMS, revSelectRun, 'bi', null, 3)
    expect(next).toBe(revSelectRun)
  })

  test('pickRevelationFromOffer: オファーから獲得すると所持に加わり、revelationSelectを終了してoracleSelectへ遷移する', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const revSelectRun: RunState = { ...run, phase: 'revelationSelect', revelationOffer: ['shin', 'kou', 'tei'] }
    const next = pickRevelationFromOffer(DEFAULT_PARAMS, revSelectRun, 'shin', 3)
    expect(next.phase).toBe('oracleSelect')
    expect(next.revelations).toEqual(['shin'])
  })

  test('pickRevelationFromOffer: 所持数が上限2の間は何もしない', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const revSelectRun: RunState = { ...run, phase: 'revelationSelect', revelationOffer: ['shin', 'kou', 'tei'], revelations: ['bi', 'ki'] }
    const next = pickRevelationFromOffer(DEFAULT_PARAMS, revSelectRun, 'shin', 3)
    expect(next).toBe(revSelectRun)
  })

  test('skipRevelationSelect: 何も選ばず終了すると、実際のウェーブが配られoracleSelectへ遷移する', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const revSelectRun: RunState = { ...run, phase: 'revelationSelect', revelationOffer: ['shin', 'kou', 'tei'] }
    const next = skipRevelationSelect(DEFAULT_PARAMS, revSelectRun, 3)
    expect(next.phase).toBe('oracleSelect')
  })

  test('useRevelation: 所持中の天啓を使用すると1個消費され、revelationSelect中でもplaying中でもフェーズは変わらない', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const playingRun: RunState = { ...run, revelations: ['shin', 'shin'] }
    const next = useRevelation(DEFAULT_PARAMS, playingRun, 'shin', null)
    expect(next.phase).toBe('playing')
    expect(next.revelations).toEqual(['shin'])

    const revSelectRun: RunState = { ...run, phase: 'revelationSelect', revelations: ['bi'] }
    const next2 = useRevelation(DEFAULT_PARAMS, revSelectRun, 'bi', null)
    expect(next2.phase).toBe('revelationSelect')
    expect(next2.revelations).toEqual([])
  })

  test('useRevelation: 所持していない天啓は無視される', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const next = useRevelation(DEFAULT_PARAMS, run, 'shin', null)
    expect(next).toBe(run)
  })

  test('虚(kyo)を使用すると、extraTableauRowsが恒久的に増え、以後のstartWaveの配布行数に反映される', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    // beginRunで配られた直後のウェーブは山札が十分残っているため、canUseRevelation('kyo')の
    // 「山札が(列数×n)枚以上」という条件を素の状態のまま満たす。
    const playingRun: RunState = { ...run, revelations: ['kyo'] }
    const next = useRevelation(DEFAULT_PARAMS, playingRun, 'kyo', null)
    expect(next.extraTableauRows).toBe(DEFAULT_PARAMS.revelations.kyo.n)
    const { wave } = startWave(DEFAULT_PARAMS, 0, 1, next.items, next.deckComposition, 5, next.extraTableauRows)
    wave.tableau.forEach(col => expect(col).toHaveLength(DEFAULT_PARAMS.layout.rows + next.extraTableauRows))
  })

  test('useRite: revelationSelectフェーズ中でも秘儀を使用できる', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const revSelectRun: RunState = { ...run, phase: 'revelationSelect', rites: ['uruz'] }
    const next = useRite(DEFAULT_PARAMS, revSelectRun, 'uruz', createRng(1))
    expect(next.rites).toEqual([])
    expect(next.phase).toBe('revelationSelect')
  })
})

describe('神託選択フェーズ', () => {
  test('天啓選択画面を終了すると、oracleSelectフェーズへ遷移しoracleOfferが3件セットされる', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const revSelectRun: RunState = { ...run, phase: 'revelationSelect', revelationOffer: ['shin', 'kou', 'tei'] }
    const next = skipRevelationSelect(DEFAULT_PARAMS, revSelectRun, 3, createRng(1))
    expect(next.phase).toBe('oracleSelect')
    expect(next.oracleOffer).toHaveLength(3)
    expect(next.wave).not.toBeNull()
  })

  test('pickOracleFromOffer: オファーから選ぶと対応する役のレベルが+1され、即座にplayingへ遷移する', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const oracleSelectRun: RunState = { ...run, phase: 'oracleSelect', oracleOffer: ['suit', 'color', 'stair'] }
    const next = pickOracleFromOffer(oracleSelectRun, 'suit')
    expect(next.phase).toBe('playing')
    expect(next.oracleLevels.suit).toBe(2)
    expect(next.oracleLevels.color).toBe(1)
    expect(next.oracleOffer).toEqual([])
  })

  test('pickOracleFromOffer: 既に配られている実ウェーブ(wave.oracleLevels)にも即座に反映される(次のウェーブまで遅延しない)', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const oracleSelectRun: RunState = { ...run, phase: 'oracleSelect', oracleOffer: ['suit', 'color', 'stair'] }
    const next = pickOracleFromOffer(oracleSelectRun, 'suit')
    expect(next.wave).not.toBeNull()
    expect(next.wave?.oracleLevels.suit).toBe(2)
    expect(next.wave?.oracleLevels.color).toBe(1)
  })

  test('pickOracleFromOffer: オファーに含まれない役は無視される', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const oracleSelectRun: RunState = { ...run, phase: 'oracleSelect', oracleOffer: ['suit', 'color', 'stair'] }
    const next = pickOracleFromOffer(oracleSelectRun, 'flush')
    expect(next).toBe(oracleSelectRun)
  })

  test('pickOracleFromOffer: 同じ役を複数回選ぶとレベルが積み上がる', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const oracleSelectRun: RunState = { ...run, phase: 'oracleSelect', oracleOffer: ['suit', 'color', 'stair'], oracleLevels: { ...run.oracleLevels, suit: 3 } }
    const next = pickOracleFromOffer(oracleSelectRun, 'suit')
    expect(next.oracleLevels.suit).toBe(4)
  })

  test('skipOracleSelect: 何も選ばず終了すると、レベルを変えずplayingへ遷移する', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const oracleSelectRun: RunState = { ...run, phase: 'oracleSelect', oracleOffer: ['suit', 'color', 'stair'] }
    const next = skipOracleSelect(oracleSelectRun)
    expect(next.phase).toBe('playing')
    expect(next.oracleLevels).toEqual(run.oracleLevels)
  })

  test('神託のレベルは新しいウェーブに引き継がれ、得点計算に反映される', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const oracleSelectRun: RunState = { ...run, phase: 'oracleSelect', oracleOffer: ['suit', 'color', 'stair'] }
    const afterPick = pickOracleFromOffer(oracleSelectRun, 'suit')
    expect(afterPick.oracleLevels.suit).toBe(2)
    const { wave } = startWave(DEFAULT_PARAMS, 0, 1, afterPick.items, afterPick.deckComposition, 5, afterPick.extraTableauRows, afterPick.oracleLevels)
    expect(wave.oracleLevels.suit).toBe(2)
  })
})

