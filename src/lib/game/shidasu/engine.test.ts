// src/lib/game/shidasu/engine.test.ts
import { describe, test, expect } from 'vitest'
import {
  isRed,
  isFace,
  rankLabel,
  isPlayable,
  getPlayableColumns,
  remainingCount,
  startWave,
  playCard,
  drawStock,
  chainContinuesPattern,
  isStuck,
  markStuck,
  rollItemOffer,
  ITEM_POOL,
  itemName,
  itemDesc,
  applyItemEffects,
  applyDirectEffects,
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
  analyzeSuitColor,
  analyzeStair,
  checkFlush,
  checkRoyalSet,
  countSameRankBefore,
  countSameRankForWildPlay,
  checkCompleteRun,
  evaluateChainBonus,
  stairUsesKALoop,
  forceStockTop,
  type ItemEffectContext,
  type DirectEffectContext,
} from './engine'
import type { Card, WaveState, RunState, ItemId, RoleName } from './types'
import { DEFAULT_PARAMS } from './params'
import { createRng, standardDeckComposition } from './deck'

function card(id: number, suit: Card['suit'], rank: Card['rank'], wild = false): Card {
  return { id, suit, rank, wild }
}

describe('isRed / isFace / rankLabel', () => {
  test('♥♦は赤、♠♣は黒', () => {
    expect(isRed(card(1, '♥', 5))).toBe(true)
    expect(isRed(card(2, '♦', 5))).toBe(true)
    expect(isRed(card(3, '♠', 5))).toBe(false)
    expect(isRed(card(4, '♣', 5))).toBe(false)
  })

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
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 1) // 列1(2)は取れない
    expect(next).toBe(wave)
  })

  test('コンボ1(倍率1.0)で基礎点そのまま加点される', () => {
    // 列一掃ボーナスが混ざらないよう、played対象の下にダミー札を積んで列が空にならないようにする
    const wave = baseWave({ tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]] })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0)
    expect(next.combo).toBe(1)
    expect(next.score).toBe(scoring.basePoint)
    expect(next.foundation).toEqual(card(1, '♣', 6))
    expect(next.chain).toEqual([card(1, '♣', 6)])
    expect(next.tableau[0]).toEqual([card(9, '♠', 1)])
  })

  test('lastGain.partsの先頭に基礎点の内訳が入り、コンボ1(倍率1.0)ではコンボ倍率の内訳は表示されない', () => {
    const wave = baseWave({ tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]] })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0)
    expect(next.lastGain?.parts[0]).toBe(`基礎点+${scoring.basePoint}`)
    expect(next.lastGain?.parts.some(p => p.startsWith('コンボ倍率'))).toBe(false)
  })

  test('コンボ2(倍率1+0.1=1.1)で加点される(パターン不一致の場合)', () => {
    // 1枚目を取ってコンボ1にし、2枚目(パターン不一致)を取ってコンボ2にする
    // (列一掃・全消しボーナスが混ざらないよう、played対象の下にダミー札を積んでおく)
    const wave = baseWave({
      tableau: [
        [card(9, '♠', 1), card(1, '♣', 6)],
        [card(10, '♠', 2), card(2, '♦', 9)],
      ],
    })
    const afterFirst = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0)
    // 2列目のfoundation差分を6→9にするため、一旦foundationを差し替えたウェーブで2枚目を取る
    const wave2 = {
      ...afterFirst,
      foundation: card(1, '♣', 6),
      tableau: [[card(9, '♠', 1)], [card(10, '♠', 2), card(2, '♦', 7)]],
    }
    const next = playCard(DEFAULT_PARAMS, wave2, 'none', [], 1000000, 1)
    expect(next.combo).toBe(2)
    // 6→7は階段方向+1・長さ2(既定stairMinLen=5未満でボーナスなし)、スート♣→♦で色も違う→パターンボーナス0
    expect(next.score).toBe(afterFirst.score + Math.floor(scoring.basePoint * 1.1))
    expect(next.lastGain?.parts).toContain('コンボ倍率×1.1')
  })

  test('基本ルール: 列の全カードを1コンボで空にすると列一掃ボーナスが加算される(1列目)', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 9)]],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows, 1],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0)
    expect(next.columnsEmptiedThisCombo).toBe(1)
    expect(next.score).toBe(scoring.basePoint + scoring.columnSweepBonus * 1)
    expect(next.lastGain?.parts).toContain(`列一掃+${scoring.columnSweepBonus}`)
  })

  test('基本ルール: 列が現在の連続コンボ開始時点で全カードでなければ(=既に一部消化済みなら)列一掃ボーナスは付かない', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 9)]],
      comboStreakColumnLengths: [2, 1], // 列0はコンボ開始時点で2枚残っていた(rows=5と一致しないため、全カードを1コンボで消化したことにはならない)
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0)
    expect(next.columnsEmptiedThisCombo).toBe(0)
    expect(next.lastGain?.parts.some(p => p.startsWith('列一掃'))).toBe(false)
  })

  test('寛容の護符所持時: 列一掃の条件が「残りrows-talismans.grace.m枚以下から1コンボで空に」に緩和される', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 9)]],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows - DEFAULT_PARAMS.talismans.grace.m, 1],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['grace'], 1000000, 0)
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
    const next = playCard(DEFAULT_PARAMS, wave, 'none', items, 1000000, 0)
    expect(next.lastGain?.parts.some(p => p.startsWith('列一掃'))).toBe(true)
  })

  test('同じコンボ内で2列目を空にすると列一掃ボーナスが列数倍になる', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 6), // 列1(rank7)との差を1にして取れるようにする
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 7)]],
      columnsEmptiedThisCombo: 1,
      comboStreakColumnLengths: [1, DEFAULT_PARAMS.layout.rows],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 1)
    expect(next.columnsEmptiedThisCombo).toBe(2)
    expect(next.lastGain?.parts).toContain(`列一掃+${scoring.columnSweepBonus * 2}`)
  })

  test('場札が0枚になったら全消しボーナス(clearBonus+残り山札×clearBonusPerStock)が加算されendReason=fullClear', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [card(9, '♠', 1), card(10, '♠', 2)],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 100000000, 0)
    expect(next.tableau.reduce((n, c) => n + c.length, 0)).toBe(0)
    expect(next.status).toBe('ended')
    expect(next.endReason).toBe('fullClear')
    const expectedClearBonus = scoring.clearBonus + 2 * scoring.clearBonusPerStock
    expect(next.score).toBe(scoring.basePoint + scoring.columnSweepBonus * 1 + expectedClearBonus)
  })

  test('全消し時、lastBonusGainsに全消しボーナスが別枠で入る(lastGainはプレイ得点のみ)', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [card(9, '♠', 1), card(10, '♠', 2)],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 100000000, 0)
    const expectedClearBonus = scoring.clearBonus + 2 * scoring.clearBonusPerStock
    const expectedPlayGain = scoring.basePoint + scoring.columnSweepBonus * 1
    expect(next.lastGain?.points).toBe(expectedPlayGain)
    expect(next.lastGain?.parts).not.toContain(`全消しボーナス+${expectedClearBonus}`)
    expect(next.lastBonusGains).toHaveLength(1)
    expect(next.lastBonusGains[0].label).toBe('全消しボーナス')
    expect(next.lastBonusGains[0].points).toBe(expectedClearBonus)
    expect(next.lastBonusGains[0].parts).toContain(`基礎+${scoring.clearBonus}`)
    expect(next.lastBonusGains[0].parts).toContain(`山札残数+${2 * scoring.clearBonusPerStock}`)
    expect(next.score).toBe(expectedPlayGain + expectedClearBonus)
  })

  test('流星の護符でコンボが到達値になった瞬間、lastBonusGainsに直接加算が別枠で入る', () => {
    const items: ItemId[] = ['shootingStar']
    const wave = baseWave({
      combo: DEFAULT_PARAMS.talismans.shootingStar.c - 1,
      chain: [card(20, '♥', 3), card(21, '♦', 4)],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', items, 100000000, 0)
    expect(next.combo).toBe(DEFAULT_PARAMS.talismans.shootingStar.c)
    expect(next.lastBonusGains).toHaveLength(1)
    expect(next.lastBonusGains[0].label).toBe('護符による直接加算')
    expect(next.lastBonusGains[0].points).toBe(DEFAULT_PARAMS.talismans.shootingStar.n)
    expect(next.lastBonusGains[0].parts).toContain(`流星+${DEFAULT_PARAMS.talismans.shootingStar.n}`)
    // 回帰防止: 流星の加算額がlastGainとlastBonusGainsの両方に二重計上されていないことを確認する。
    // (lastGain.points + lastBonusGainsの合計) が実際のスコア増分と一致するはず。
    const bonusTotal = next.lastBonusGains.reduce((sum, g) => sum + g.points, 0)
    expect((next.lastGain?.points ?? 0) + bonusTotal).toBe(next.score - wave.score)
  })

  test('スコアが目標に達したらendReason=targetでstatus=ended', () => {
    const wave = baseWave()
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 5, 0) // basePoint(100) >= target(5)
    expect(next.status).toBe('ended')
    expect(next.endReason).toBe('target')
  })

  test('status が playing でない場合は何もしない', () => {
    const wave = baseWave({ status: 'ended', endReason: 'target' })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0)
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
    // コンボ1: 倍率1+(1-1)*0.25=1.0 → 15*1.0=15 (割り切れる、floorの効果を見るには2枚目が必要)
    const afterFirst = playCard(oddParams, wave, 'none', [], 1000000, 0)
    const wave2 = { ...afterFirst, tableau: [[card(9, '♠', 1)], [card(10, '♠', 2), card(2, '♦', 7)]] }
    const next = playCard(oddParams, wave2, 'none', [], 1000000, 1)
    // コンボ2: 倍率1+(2-1)*0.25=1.25 → 15*1.25=18.75 → floor=18
    expect(next.score).toBe(afterFirst.score + 18)
  })

  test('カードを取るとlastDrawEffectがクリアされる', () => {
    const wave = baseWave({ lastDrawEffect: 'pattern' })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0)
    expect(next.lastDrawEffect).toBeNull()
  })

  test('プレイするとfirstPlayDoneがtrueになる(ウェーブ開始直後はfalse)', () => {
    const wave = baseWave({ tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]] })
    expect(wave.firstPlayDone).toBe(false)
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0)
    expect(next.firstPlayDone).toBe(true)
  })

  test('chainOriginにplayが追記される', () => {
    const wave = baseWave({ tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]] })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0)
    expect(next.chainOrigin).toEqual(['play'])
  })

  test('架橋の護符を持っていなければ、階段が3枚繋がっても既定のstairMinLen(5)未満のためボーナスが付かない', () => {
    const wave = baseWave({
      foundation: card(0, '♣', 5),
      chain: [card(20, '♠', 4), card(0, '♣', 5)],
      tableau: [[card(9, '♠', 1), card(1, '♦', 6)], [card(2, '♥', 2)]],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0)
    expect(next.lastGain?.parts.some(p => p.startsWith('階段'))).toBe(false)
  })

  test('架橋の護符を持っていれば、階段成立に必要な最小連続枚数がstairRelaxedMinLen(3)に緩和される', () => {
    const wave = baseWave({
      foundation: card(0, '♣', 5),
      chain: [card(20, '♠', 4), card(0, '♣', 5)],
      tableau: [[card(9, '♠', 1), card(1, '♦', 6)], [card(2, '♥', 2)]],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['bridge'], 1000000, 0)
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
    const next = playCard(DEFAULT_PARAMS, wave, 'none', items, 1000000, 0)
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
    const next = playCard(DEFAULT_PARAMS, wave, 'none', items, 1000000, 0)
    expect(next.lastGain?.parts).toContain(`同スート+${DEFAULT_PARAMS.scoring.suitBonus}`)
  })

  test('gainedチャンネルの護符(springBreeze)は♣を取った時、得点に加算される', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['springBreeze'], 1000000, 0)
    expect(next.score).toBe(scoring.basePoint + DEFAULT_PARAMS.talismans.springBreeze.n)
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
    const next = playCard(DEFAULT_PARAMS, wave, 'none', items, 1000000, 0)
    expect(next.combo).toBe(3)
    const multiplier = 1 + (3 - 1) * scoring.comboMultiplierStep
    const expectedGained = Math.floor((scoring.basePoint + DEFAULT_PARAMS.talismans.springBreeze.n) * multiplier)
    expect(next.lastGain?.points).toBe(expectedGained)
  })

  test('clearBonusチャンネルの護符(purify)は全消し時のみclearBonusに加算される', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [card(9, '♠', 1), card(10, '♠', 2)],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['purify'], 100000000, 0)
    expect(next.endReason).toBe('fullClear')
    const expectedClearBonus = scoring.clearBonus + 2 * scoring.clearBonusPerStock + DEFAULT_PARAMS.talismans.purify.n
    expect(next.score).toBe(scoring.basePoint + scoring.columnSweepBonus * 1 + expectedClearBonus)
  })

  test('複数のclearBonus護符は所持順に適用される(purify→temperanceとtemperance→purifyで結果が異なる)', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [card(9, '♠', 1), card(10, '♠', 2)],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
    })
    const order1 = playCard(DEFAULT_PARAMS, wave, 'none', ['purify', 'temperance'], 100000000, 0)
    const order2 = playCard(DEFAULT_PARAMS, wave, 'none', ['temperance', 'purify'], 100000000, 0)
    expect(order1.score).not.toBe(order2.score)
  })

  test('複数のgained護符も所持順に適用される(conscience→courageとcourage→conscienceで結果が異なる)', () => {
    const wave = baseWave({ tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]] })
    const order1 = playCard(DEFAULT_PARAMS, wave, 'none', ['conscience', 'courage'], 1000000, 0)
    const order2 = playCard(DEFAULT_PARAMS, wave, 'none', ['courage', 'conscience'], 1000000, 0)
    expect(order1.score).not.toBe(order2.score)
    expect(order1.score).toBe(Math.floor((scoring.basePoint + DEFAULT_PARAMS.talismans.conscience.n) * (1 + 1 * DEFAULT_PARAMS.talismans.courage.x)))
    expect(order2.score).toBe(Math.floor(scoring.basePoint * (1 + 1 * DEFAULT_PARAMS.talismans.courage.x) + DEFAULT_PARAMS.talismans.conscience.n))
  })

  test('同じ列を連続でプレイするとsameColumnStreakが増え、違う列なら1に戻る', () => {
    // 列0: 1回目で6(基礎rank5と隣接)を取ったあと、残る7が新foundation(6)と隣接するようにする
    const wave = baseWave({
      tableau: [[card(9, '♠', 7), card(1, '♣', 6)], [card(10, '♠', 2), card(2, '♦', 7)]],
    })
    const first = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0)
    expect(first.sameColumnStreak).toBe(1)
    expect(first.lastPlayedColumn).toBe(0)
    const second = playCard(DEFAULT_PARAMS, first, 'none', [], 1000000, 0)
    expect(second.sameColumnStreak).toBe(2)
    // 列1: 1回目で列0の6を取ったあと、列1の7が(上書き後の)foundation(6)と隣接するようにする
    const wave2 = baseWave({
      tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(10, '♠', 2), card(11, '♦', 7)]],
    })
    const thirdSetup = playCard(DEFAULT_PARAMS, wave2, 'none', [], 1000000, 0)
    const differentColumn = playCard(DEFAULT_PARAMS, { ...thirdSetup, foundation: card(1, '♣', 6) }, 'none', [], 1000000, 1)
    expect(differentColumn.sameColumnStreak).toBe(1)
    expect(differentColumn.lastPlayedColumn).toBe(1)
  })

  test('maxComboThisWaveはこれまでの最大コンボ数を保持する', () => {
    const wave = baseWave({ combo: 5, tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]], maxComboThisWave: 5 })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0)
    expect(next.combo).toBe(6)
    expect(next.maxComboThisWave).toBe(6)
    const wave2 = baseWave({ combo: 2, tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]], maxComboThisWave: 10 })
    const next2 = playCard(DEFAULT_PARAMS, wave2, 'none', [], 1000000, 0)
    expect(next2.maxComboThisWave).toBe(10) // 既存の最大値の方が大きければ維持
  })

  test('列一掃が成立するとtotalColumnsEmptiedThisWaveとcolumnSweepActiveThisWaveが更新される', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 9)]],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows, 1],
      totalColumnsEmptiedThisWave: 3,
      columnSweepActiveThisWave: false,
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0)
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
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0)
    expect(next.roleFiredThisChain).toBe(true)
  })

  test('流星: コンボ数がcに到達した瞬間、直接点が加算される', () => {
    const c = DEFAULT_PARAMS.talismans.shootingStar.c
    const wave = baseWave({
      combo: c - 1,
      tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['shootingStar'], 1000000, 0)
    expect(next.combo).toBe(c)
    // コンボ倍率(comboMultiplierStep)込みの通常獲得点 + 流星の直接加算点
    const multiplier = 1 + (c - 1) * scoring.comboMultiplierStep
    const expectedGained = Math.floor(scoring.basePoint * multiplier) + DEFAULT_PARAMS.talismans.shootingStar.n
    expect(next.score).toBe(expectedGained)
  })

  test('playCardはrand引数を省略してもデフォルト(Math.random)で動作する(既存呼び出しの後方互換性)', () => {
    const wave = baseWave({ tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]] })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0)
    expect(next.combo).toBe(1)
  })

  test('治癒: 列一掃が成立すると捨て札から最大rows枚が空いた列へ戻る', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 9)]],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows, 1],
      discardPile: [card(10, '♦', 1), card(11, '♦', 2), card(12, '♦', 3), card(13, '♦', 4), card(14, '♦', 5), card(15, '♦', 6), card(16, '♦', 7)],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['healing'], 1000000, 0, createRng(1))
    expect(next.columnsEmptiedThisCombo).toBe(1)
    expect(next.tableau[0]).toHaveLength(DEFAULT_PARAMS.layout.rows)
    expect(next.discardPile.length).toBe(7 - DEFAULT_PARAMS.layout.rows)
  })

  test('治癒: 捨て札がrows未満ならあるだけ戻す', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 9)]],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows, 1],
      discardPile: [card(10, '♦', 1), card(11, '♦', 2)],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['healing'], 1000000, 0, createRng(1))
    expect(next.tableau[0]).toHaveLength(2)
    expect(next.discardPile).toHaveLength(0)
  })

  test('治癒: 復活後の列はcomboStreakColumnLengthsが実際の復活枚数に更新される(部分復活が誤って満列扱いされるのを防ぐ)', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 9)]],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows, 1],
      discardPile: [card(10, '♦', 1), card(11, '♦', 2)], // rows未満しかない → 部分復活
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['healing'], 1000000, 0, createRng(1))
    expect(next.comboStreakColumnLengths[0]).toBe(2) // rows(古い基準)ではなく実際の復活枚数
    expect(next.comboStreakColumnLengths[1]).toBe(1) // 治癒が発動しなかった列は据え置きのまま
  })

  test('治癒: 捨て札が空なら復活は起こらない', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 9)]],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows, 1],
      discardPile: [],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['healing'], 1000000, 0, createRng(1))
    expect(next.tableau[0]).toHaveLength(0)
  })

  test('治癒を持っていなければ列一掃後も列は空のまま', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 9)]],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows, 1],
      discardPile: [card(10, '♦', 1), card(11, '♦', 2)],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, createRng(1))
    expect(next.tableau[0]).toHaveLength(0)
    expect(next.discardPile).toHaveLength(2)
  })

  test('再生: 全消し時に捨て札があれば、スコアp%を消費して場札を復活させウェーブを継続する', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
      discardPile: [card(10, '♦', 1), card(11, '♦', 2), card(12, '♦', 3)],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['regeneration'], 100000000, 0, createRng(1))
    expect(next.status).toBe('playing') // 全消し終了せず継続
    expect(next.endReason).toBeNull()
    const revivedCount = next.tableau.reduce((n, c) => n + c.length, 0)
    expect(revivedCount).toBe(3)
    expect(next.discardPile).toHaveLength(0)
    // 単一列・単一カードでも comboStreakColumnLengths=[rows] により列一掃ボーナスも同時発火する
    // (328行目の全消しテストと同じフィクスチャパターン。scoreBeforeCostにcolumnSweepBonusを含める必要がある)
    const expectedClearBonus = DEFAULT_PARAMS.scoring.clearBonus + 0 * DEFAULT_PARAMS.scoring.clearBonusPerStock
    const scoreBeforeCost = scoring.basePoint + scoring.columnSweepBonus * 1 + expectedClearBonus
    const expectedCost = Math.floor(scoreBeforeCost * DEFAULT_PARAMS.talismans.regeneration.p / 100)
    expect(next.score).toBe(scoreBeforeCost - expectedCost)
  })

  test('再生: 捨て札が無ければ通常通り全消し終了になる', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
      discardPile: [],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['regeneration'], 100000000, 0, createRng(1))
    expect(next.status).toBe('ended')
    expect(next.endReason).toBe('fullClear')
  })

  test('再生を持っていなければ通常通り全消し終了になる', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
      discardPile: [card(10, '♦', 1)],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 100000000, 0, createRng(1))
    expect(next.status).toBe('ended')
    expect(next.endReason).toBe('fullClear')
  })

  test('治癒と再生を同時所持し発動条件が重なる場合、所持順で治癒が先なら治癒が優先され再生は発動しない', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
      discardPile: [card(10, '♦', 1), card(11, '♦', 2), card(12, '♦', 3)],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['healing', 'regeneration'], 100000000, 0, createRng(1))
    // 治癒が先に列を復活させるため場札が空にならず、再生の全消し継続は発動しない
    expect(next.status).toBe('playing')
    expect(next.endReason).toBeNull()
    expect(next.tableau[0].length).toBeGreaterThan(0) // 治癒による復活
    expect(next.discardPile).toHaveLength(0) // 3枚とも治癒が使い切る(rows未満のため全部)
  })

  test('治癒と再生を同時所持し発動条件が重なる場合、所持順で再生が先なら再生が優先され場札全体が復活する', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
      discardPile: [card(10, '♦', 1), card(11, '♦', 2), card(12, '♦', 3)],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['regeneration', 'healing'], 100000000, 0, createRng(1))
    expect(next.status).toBe('playing')
    expect(next.endReason).toBeNull()
    // 再生の再配布は列0(=colIndex)から順に埋めるため、治癒の対象列も再生によって
    // 既に埋められ、治癒は追加発動しない(捨て札が使い切られていることで確認)
    expect(next.discardPile).toHaveLength(0)
    const revivedCount = next.tableau.reduce((n, c) => n + c.length, 0)
    expect(revivedCount).toBe(3)
    const expectedClearBonus = DEFAULT_PARAMS.scoring.clearBonus + 0 * DEFAULT_PARAMS.scoring.clearBonusPerStock
    const scoreBeforeCost = scoring.basePoint + scoring.columnSweepBonus * 1 + expectedClearBonus
    const expectedCost = Math.floor(scoreBeforeCost * DEFAULT_PARAMS.talismans.regeneration.p / 100)
    expect(next.score).toBe(scoreBeforeCost - expectedCost) // 再生のコスト計算式で消費されている(治癒は不発火)
  })

  test('治癒・再生の発動条件が重ならない通常の全消し(列一掃を伴わない)では、所持順に関係なく再生が発動する', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows + 1], // 列一掃条件(===rows)を満たさない
      discardPile: [card(10, '♦', 1), card(11, '♦', 2), card(12, '♦', 3)],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['healing', 'regeneration'], 100000000, 0, createRng(1))
    expect(next.status).toBe('playing')
    expect(next.endReason).toBeNull()
    const revivedCount = next.tableau.reduce((n, c) => n + c.length, 0)
    expect(revivedCount).toBe(3) // 列一掃が不成立のため治癒は無関係、再生のみが発動する
  })

  test('黄金: コンボが+1ではなく+2進む', () => {
    const wave = baseWave({ combo: 3, tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]] })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['golden'], 1000000, 0)
    expect(next.combo).toBe(5)
  })

  test('黄金を持たなければ通常通りコンボは+1', () => {
    const wave = baseWave({ combo: 3, tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]] })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0)
    expect(next.combo).toBe(4)
  })

  test('庇護: コンボ数(計算用)がc未満ならcとして計算される', () => {
    const wave = baseWave({ combo: 0, tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]] })
    // combo=0でプレイするとnewCombo=1。庇護c=3未満なので一時comboは3として計算される。
    const withProtection = playCard(DEFAULT_PARAMS, wave, 'none', ['protection'], 1000000, 0)
    const without = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0)
    expect(withProtection.score).toBeGreaterThan(without.score)
  })

  test('大地: コンボ数(計算用)に常にcが加算される', () => {
    const wave = baseWave({ combo: 5, tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]] })
    const withEarth = playCard(DEFAULT_PARAMS, wave, 'none', ['earth'], 1000000, 0)
    const without = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0)
    expect(withEarth.score).toBeGreaterThan(without.score)
    // wave.combo自体(実コンボ)は一時comboの影響を受けない
    expect(withEarth.combo).toBe(without.combo)
  })

  test('庇護・大地は所持順で一時comboに適用され、大地→庇護の順だと庇護が不発化しうる', () => {
    // combo=0でプレイ: newCombo=1。大地(c=2)が先に+2して一時combo=3。
    // 庇護(c=3)は「3 < 3」が偽なので不発化(3のまま)。
    const wave = baseWave({ combo: 0, tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]] })
    const earthThenProtection = playCard(DEFAULT_PARAMS, wave, 'none', ['earth', 'protection'], 1000000, 0)
    // 庇護→大地の順なら: newCombo=1→庇護でc=3に底上げ→大地で+2して5になる。より高スコアになるはず。
    const protectionThenEarth = playCard(DEFAULT_PARAMS, wave, 'none', ['protection', 'earth'], 1000000, 0)
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
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['sanctify'], 1000000, 0)
    expect(next.baseComboCount).toBe(1)
    // 一時comboにも+1が反映されていることを、祝福あり/なしのスコア差で確認する
    // (庇護・大地のテストと同じ手法。baseComboCountの検証だけではeffectiveComboへの
    // 反映漏れを検知できないため)。
    const withSanctify = playCard(DEFAULT_PARAMS, wave, 'none', ['sanctify'], 1000000, 0)
    const without = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0)
    expect(withSanctify.score).toBeGreaterThan(without.score)
  })

  test('祝福: 役が成立しなければbaseComboCountは変化しない', () => {
    const wave = baseWave({
      tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]],
      baseComboCount: 2,
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['sanctify'], 1000000, 0)
    expect(next.baseComboCount).toBe(2)
  })

  test('明星: 役の種類ごとのウェーブ内累積成立回数に応じて役ボーナスが倍加する', () => {
    // フラッシュが成立する組み合わせ(4スート)
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      chain: [card(20, '♥', 3), card(21, '♦', 4), card(22, '♠', 5)],
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      roleOccurrenceCountThisWave: { flush: 3 },
    })
    const withMorningStar = playCard(DEFAULT_PARAMS, wave, 'none', ['morningStar'], 1000000, 0)
    const without = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0)
    expect(withMorningStar.score).toBeGreaterThan(without.score)
  })

  test('明星: 役が成立するとroleOccurrenceCountThisWaveが+1される(今回分は倍率計算に使わない)', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      chain: [card(20, '♥', 3), card(21, '♦', 4), card(22, '♠', 5)],
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      roleOccurrenceCountThisWave: { flush: 1 },
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['morningStar'], 1000000, 0)
    expect(next.roleOccurrenceCountThisWave.flush).toBe(2)
  })

  test('roleOccurrenceCountThisWaveは明星を持たなくても役成立のたび更新される', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      chain: [card(20, '♥', 3), card(21, '♦', 4), card(22, '♠', 5)],
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      roleOccurrenceCountThisWave: { flush: 1 },
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0)
    expect(next.roleOccurrenceCountThisWave.flush).toBe(2)
  })

  test('水鏡: 役が成立すると次のプレイへ同じ役ボーナスの複製が予約される', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      chain: [card(20, '♥', 3), card(21, '♦', 4), card(22, '♠', 5)],
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['mirror'], 1000000, 0)
    expect(next.pendingRoleEcho).not.toBeNull()
    expect(next.pendingRoleEcho?.name).toBe('flush')
    expect(next.roleEchoUsedThisCombo.flush).toBe(true)
  })

  test('水鏡: 予約された複製は次のプレイで無条件に上乗せされる', () => {
    const wave = baseWave({
      tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]],
      pendingRoleEcho: { name: 'flush', amount: 999 },
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['mirror'], 1000000, 0)
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
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['mirror'], 1000000, 0)
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
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['mirror'], 1000000, 0)
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
    const withMercy = playCard(DEFAULT_PARAMS, wave, 'none', ['mercy'], 1000000, 0)
    const without = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0)
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
    const next = playCard(DEFAULT_PARAMS, wave, 'none', items, 1000000, 0)
    expect(next.lastGain?.parts).toContain(`高潔+${DEFAULT_PARAMS.talismans.nobility.n}`)
  })
})

describe('chainContinuesPattern', () => {
  test('チェーンが空なら継続不可', () => {
    expect(chainContinuesPattern(DEFAULT_PARAMS.scoring, [], card(1, '♠', 5))).toBe(false)
  })

  test('実カード3枚未満では同スートが揃っていても継続不可', () => {
    const chain = [card(1, '♠', 5)]
    expect(chainContinuesPattern(DEFAULT_PARAMS.scoring, chain, card(2, '♠', 6))).toBe(false)
  })

  test('捲った札を含めて実カード3枚以上・同スートが揃えば継続', () => {
    const chain = [card(1, '♠', 5), card(2, '♠', 6)]
    expect(chainContinuesPattern(DEFAULT_PARAMS.scoring, chain, card(3, '♠', 9))).toBe(true)
  })

  test('同スートが成立中でも、捲った札が違うスート・違う色なら継続不可', () => {
    const chain = [card(1, '♠', 5), card(2, '♠', 6)]
    expect(chainContinuesPattern(DEFAULT_PARAMS.scoring, chain, card(3, '♥', 9))).toBe(false)
  })

  test('階段が成立中で、捲った札が同方向を継続し長さがstairMinLen以上になれば継続', () => {
    const chain = [card(1, '♠', 5), card(2, '♣', 6)] // dir=+1, len=2
    expect(chainContinuesPattern(DEFAULT_PARAMS.scoring, chain, card(3, '♦', 7), 3)).toBe(true)
  })

  test('階段の長さがstairMinLen未満なら継続不可', () => {
    const chain = [card(1, '♠', 5), card(2, '♣', 6)] // dir=+1, len=2
    expect(chainContinuesPattern(DEFAULT_PARAMS.scoring, chain, card(3, '♦', 7))).toBe(false) // 既定のstairMinLen(5)未満
  })

  test('全ての条件が既に崩れていれば継続不可', () => {
    const chain = [card(1, '♠', 5), card(2, '♥', 8)] // スートも色も階段も不成立
    expect(chainContinuesPattern(DEFAULT_PARAMS.scoring, chain, card(3, '♣', 2))).toBe(false)
  })

  test('全てワイルドでも母数を満たせば継続する(比較対象の実カードが無く矛盾しないため)', () => {
    const chain = [card(1, '★', 0, true), card(2, '★', 0, true)]
    expect(chainContinuesPattern(DEFAULT_PARAMS.scoring, chain, card(3, '★', 0, true))).toBe(true)
  })

  test('階段がワイルドで橋渡しされていても、方向確立に使われて継続する', () => {
    const chain = [card(1, '♠', 5), card(2, '★', 0, true)]
    expect(chainContinuesPattern(DEFAULT_PARAMS.scoring, chain, card(3, '♦', 7), 3)).toBe(true)
  })

  test('suitColorMinLenを指定すると、その枚数で同スート継続と判定される', () => {
    const chain = [card(20, '♠', 3)]
    expect(chainContinuesPattern(DEFAULT_PARAMS.scoring, chain, card(21, '♠', 4), DEFAULT_PARAMS.scoring.stairMinLen, 2)).toBe(true)
    expect(chainContinuesPattern(DEFAULT_PARAMS.scoring, chain, card(21, '♠', 4), DEFAULT_PARAMS.scoring.stairMinLen, 3)).toBe(false)
  })
})

describe('stairUsesKALoop', () => {
  test('実カード同士が隣接してK→A(13→1)を跨ぐ場合はtrue', () => {
    const chain = [card(1, '♠', 12), card(2, '♠', 13), card(3, '♠', 1), card(4, '♠', 2)]
    expect(stairUsesKALoop(chain)).toBe(true)
  })

  test('ワイルドで橋渡しされた区間の内側でK→Aを跨ぐ場合もtrue', () => {
    const chain = [card(1, '♠', 12), card(2, '★', 0, true), card(3, '★', 0, true), card(4, '♠', 2)]
    expect(stairUsesKALoop(chain)).toBe(true)
  })

  test('境界を跨がない階段はfalse', () => {
    const chain = [card(1, '♠', 3), card(2, '♠', 4), card(3, '♠', 5)]
    expect(stairUsesKALoop(chain)).toBe(false)
  })

  test('階段が成立していなければfalse', () => {
    const chain = [card(1, '♠', 3), card(2, '♠', 9)]
    expect(stairUsesKALoop(chain)).toBe(false)
  })

  test('実カードが2枚未満なら比較対象が無く都合よくtrueとみなす', () => {
    expect(stairUsesKALoop([card(1, '★', 0, true), card(2, '★', 0, true)])).toBe(true)
  })
})

describe('evaluateChainBonus (patternFired/roleFired)', () => {
  const scoring = DEFAULT_PARAMS.scoring

  test('同スートパターン成立時はpatternFired=trueになる', () => {
    const result = evaluateChainBonus(scoring, [card(1, '♠', 3), card(2, '♠', 5)], card(3, '♠', 9))
    expect(result.patternFired).toBe(true)
    expect(result.roleFired).toEqual([])
  })

  test('フラッシュ成立時、実カードだけで4スート揃っていればusedWild=false', () => {
    const chainBefore = [card(1, '♠', 1), card(2, '♥', 2), card(3, '♦', 3)]
    const result = evaluateChainBonus(scoring, chainBefore, card(4, '♣', 4))
    const flush = result.roleFired.find(r => r.name === 'flush')
    expect(flush?.usedWild).toBe(false)
  })

  test('フラッシュ成立時、ワイルドで穴埋めしていればusedWild=true', () => {
    const chainBefore = [card(1, '♠', 1), card(2, '★', 0, true), card(3, '♦', 3)]
    const result = evaluateChainBonus(scoring, chainBefore, card(4, '♣', 4))
    const flush = result.roleFired.find(r => r.name === 'flush')
    expect(flush?.usedWild).toBe(true)
  })

  test('ロイヤルセット成立時、実カードだけで揃っていればusedWild=false', () => {
    const chainBefore = [card(1, '♠', 11), card(2, '♥', 12)]
    const result = evaluateChainBonus(scoring, chainBefore, card(3, '♦', 13))
    const royalSet = result.roleFired.find(r => r.name === 'royalSet')
    expect(royalSet?.usedWild).toBe(false)
  })

  test('ロイヤルセット成立時、ワイルドで穴埋めしていればusedWild=true', () => {
    const chainBefore = [card(1, '♠', 11), card(2, '★', 0, true)]
    const result = evaluateChainBonus(scoring, chainBefore, card(3, '♦', 13))
    const royalSet = result.roleFired.find(r => r.name === 'royalSet')
    expect(royalSet?.usedWild).toBe(true)
  })

  test('同ランクボーナス成立時、チェーンにワイルドが無ければusedWild=false', () => {
    const chainBefore = [card(1, '♠', 5), card(2, '♥', 5)]
    const result = evaluateChainBonus(scoring, chainBefore, card(3, '♦', 5))
    const sameRank = result.roleFired.find(r => r.name === 'sameRank')
    expect(sameRank?.usedWild).toBe(false)
  })

  test('同ランクボーナス成立時、実カードだけで既に成立していてもチェーンにワイルドがあればusedWild=true(加点量に無条件で寄与するため)', () => {
    const chainBefore = [card(1, '♠', 5), card(2, '★', 0, true)]
    const result = evaluateChainBonus(scoring, chainBefore, card(3, '♦', 5))
    const sameRank = result.roleFired.find(r => r.name === 'sameRank')
    expect(sameRank?.usedWild).toBe(true)
  })

  test('コンプリートラン成立時、実カードだけで全ランク揃っていればusedWild=false', () => {
    const chainBefore = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((r, i) => card(i + 1, '♠', r as Card['rank']))
    const result = evaluateChainBonus(scoring, chainBefore, card(20, '♦', 13))
    const completeRun = result.roleFired.find(r => r.name === 'completeRun')
    expect(completeRun?.usedWild).toBe(false)
  })

  test('コンプリートラン成立時、ワイルドで穴埋めしていればusedWild=true', () => {
    const chainBefore = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((r, i) => card(i + 1, '♠', r as Card['rank'])).concat(card(12, '★', 0, true))
    const result = evaluateChainBonus(scoring, chainBefore, card(20, '♦', 13))
    const completeRun = result.roleFired.find(r => r.name === 'completeRun')
    expect(completeRun?.usedWild).toBe(true)
  })

  test('役もパターンも成立しなければpatternFired=false・roleFired=[]', () => {
    const result = evaluateChainBonus(scoring, [card(1, '♠', 2)], card(2, '♥', 9))
    expect(result.patternFired).toBe(false)
    expect(result.roleFired).toEqual([])
  })
})

describe('drawStock', () => {
  test('山札が空なら何もしない', () => {
    const wave = makeWave({ stock: [] })
    const composition = standardDeckComposition()
    expect(drawStock(DEFAULT_PARAMS, wave, [], composition).wave).toBe(wave)
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
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], standardDeckComposition())
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
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], standardDeckComposition())
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
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], standardDeckComposition())
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
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], standardDeckComposition())
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
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['bridge'], standardDeckComposition()) // stairRelaxedMinLen=3
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
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], standardDeckComposition())
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
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], standardDeckComposition())
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
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], standardDeckComposition())
    expect(next.lastGain).toBeNull()
  })

  test('リセット時、直前のチェーンが捨て札に追加される', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      chain: [card(2, '♥', 5), card(3, '♥', 6)],
      linked: true,
      discardPile: [card(9, '♦', 1)],
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], standardDeckComposition())
    expect(next.discardPile).toEqual([card(9, '♦', 1), card(2, '♥', 5), card(3, '♥', 6)])
  })

  test('パターン継続時は捨て札に何も追加されない', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 9)],
      chain: [card(2, '♠', 4), card(3, '♠', 5)],
      linked: true,
      discardPile: [],
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], standardDeckComposition())
    expect(next.discardPile).toEqual([])
  })

  test('静寂: リセット時に取れる場札が無ければ、めくった札がそのウェーブ内でワイルド化し、deckCompositionも1枚ワイルドに変換される', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      tableau: [[card(2, '♠', 2)]], // foundation想定rank9との差が大きく取れない
      chain: [card(3, '♥', 5)],
      linked: true,
    })
    const composition = standardDeckComposition()
    const { wave: next, deckComposition } = drawStock(DEFAULT_PARAMS, wave, ['silence'], composition, 'none', createRng(1))
    expect(next.foundation.wild).toBe(true)
    expect(next.chain).toEqual([{ ...card(1, '♣', 9), wild: true }])
    expect(deckComposition.filter(c => c.wild)).toHaveLength(1)
  })

  test('静寂を持っていても取れる場札があれば発動しない', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      tableau: [[card(2, '♣', 8)]], // 差1、取れる
      chain: [card(3, '♥', 5)],
      linked: true,
    })
    const composition = standardDeckComposition()
    const { wave: next, deckComposition } = drawStock(DEFAULT_PARAMS, wave, ['silence'], composition, 'none', createRng(1))
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
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['silence'], composition, 'faceLock', createRng(1))
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
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['composure'], standardDeckComposition())
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
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['clarity'], standardDeckComposition())
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
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['clarity'], standardDeckComposition())
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
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['echo'], standardDeckComposition())
    expect(next.score).toBe(100 + 4 * DEFAULT_PARAMS.talismans.echo.n)
  })

  test('リセット時、roleFiredThisChainがfalseに戻る', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      chain: [card(3, '♥', 5)],
      linked: true,
      roleFiredThisChain: true,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], standardDeckComposition())
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
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['arrogance'], standardDeckComposition())
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
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['sincerity'], standardDeckComposition())
    expect(next.linked).toBe(true)
    expect(next.score).toBe(100 + DEFAULT_PARAMS.talismans.sincerity.n)
    expect(next.drawContinueCountThisChain).toBe(1)
  })

  test('パターン継続めくりが同スートパターンで成立した場合、誠実は発動しない(同色専用)', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 6)],
      chain: [card(2, '♠', 4), card(3, '♠', 5)], // 同スート成立中
      linked: true,
      score: 100,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['sincerity'], standardDeckComposition())
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
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['benevolence'], standardDeckComposition())
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
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['benevolence'], standardDeckComposition())
    expect(next.combo).toBe(0)
  })

  test('祝福: コンボリセット時、wave.comboは0ではなくbaseComboCountになる', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      tableau: [[card(2, '♣', 8)]],
      chain: [card(3, '♥', 5)],
      linked: true,
      baseComboCount: 4,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['sanctify'], standardDeckComposition())
    expect(next.combo).toBe(4)
  })

  test('祝福を持たなければコンボリセット時は通常通り0になる', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      tableau: [[card(2, '♣', 8)]],
      chain: [card(3, '♥', 5)],
      linked: true,
      baseComboCount: 4,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], standardDeckComposition())
    expect(next.combo).toBe(0)
  })

  test('慈悲: コンボ数がc以下でリセットされるとmercyActiveNextComboがtrueになる', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      chain: [card(3, '♥', 5)],
      linked: true,
      combo: DEFAULT_PARAMS.talismans.mercy.c,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['mercy'], standardDeckComposition())
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
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['mercy'], standardDeckComposition())
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
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, items, standardDeckComposition(), 'none')
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
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, items, standardDeckComposition(), 'none')
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
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, items, standardDeckComposition(), 'none')
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
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, items, standardDeckComposition(), 'none')
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

describe('applyItemEffects', () => {
  const params = DEFAULT_PARAMS

  function ctx(overrides: Partial<ItemEffectContext> = {}): ItemEffectContext {
    return {
      card: card(1, '♠', 5),
      previousFoundation: card(2, '♣', 4),
      combo: 1,
      stockRemaining: 0,
      chain: [card(2, '♣', 4), card(1, '♠', 5)],
      remainingTableauCount: 10,
      chainBonus: { bonus: 0, parts: [], patternFired: false, patternFiredCount: 0, roleFired: [] },
      isFirstPlayOfWave: false,
      effectiveStairMinLen: params.scoring.stairMinLen,
      effectiveSuitColorMinLen: params.scoring.suitColorMinLen,
      sameColumnStreak: 1,
      totalColumnsEmptiedThisWave: 0,
      maxComboThisWave: 1,
      flushActiveThisCombo: false,
      columnSweepActiveThisWave: false,
      drawContinueCountThisChain: 0,
      mercyActiveNextCombo: false,
      ...overrides,
    }
  }

  test('未登録の護符は素通りし、内訳(parts)も空になる', () => {
    const result = applyItemEffects('gained', 100, ['bridge'], ctx(), params)
    expect(result.value).toBe(100)
    expect(result.parts).toEqual([])
  })

  test('patience: clearBonusチャンネルで残り山札数×xを加算し、内訳に「忍耐+n」が入る', () => {
    const result = applyItemEffects('clearBonus', 1000, ['patience'], ctx({ stockRemaining: 4 }), params)
    const add = 4 * params.talismans.patience.x
    expect(result.value).toBe(1000 + add)
    expect(result.parts).toEqual([`忍耐+${add}`])
  })

  test('purify: clearBonusチャンネルでnを加算し、内訳に「浄化+n」が入る', () => {
    const result = applyItemEffects('clearBonus', 1000, ['purify'], ctx(), params)
    expect(result.value).toBe(1000 + params.talismans.purify.n)
    expect(result.parts).toEqual([`浄化+${params.talismans.purify.n}`])
  })

  test('temperance: clearBonusチャンネルで残り山札数×x分倍算し、内訳に「節制×倍率」が入る', () => {
    const result = applyItemEffects('clearBonus', 1000, ['temperance'], ctx({ stockRemaining: 4 }), params)
    const factor = 1 + 4 * params.talismans.temperance.x
    expect(result.value).toBe(1000 * factor)
    expect(result.parts).toEqual([`節制×${factor}`])
  })

  test('springBreeze: ♣を取った時のみgainedにnを加算し、内訳に「春風+n」が入る', () => {
    const withClub = applyItemEffects('gained', 100, ['springBreeze'], ctx({ card: card(1, '♣', 5) }), params)
    expect(withClub.value).toBe(100 + params.talismans.springBreeze.n)
    expect(withClub.parts).toEqual([`春風+${params.talismans.springBreeze.n}`])
    const withoutClub = applyItemEffects('gained', 100, ['springBreeze'], ctx({ card: card(1, '♥', 5) }), params)
    expect(withoutClub.value).toBe(100)
    expect(withoutClub.parts).toEqual([])
  })

  test('summerBreeze: ♦を取った時のみgainedにnを加算', () => {
    const result = applyItemEffects('gained', 100, ['summerBreeze'], ctx({ card: card(1, '♦', 5) }), params)
    expect(result.value).toBe(100 + params.talismans.summerBreeze.n)
  })

  test('autumnBreeze: ♥を取った時のみgainedにnを加算', () => {
    const result = applyItemEffects('gained', 100, ['autumnBreeze'], ctx({ card: card(1, '♥', 5) }), params)
    expect(result.value).toBe(100 + params.talismans.autumnBreeze.n)
  })

  test('winterBreeze: ♠を取った時のみgainedにnを加算', () => {
    const result = applyItemEffects('gained', 100, ['winterBreeze'], ctx({ card: card(1, '♠', 5) }), params)
    expect(result.value).toBe(100 + params.talismans.winterBreeze.n)
  })

  test('kinship: 直前が♥以外から今回♥を取った時のみnを加算', () => {
    const triggered = applyItemEffects('gained', 100, ['kinship'], ctx({ previousFoundation: card(2, '♣', 4), card: card(1, '♥', 5) }), params)
    expect(triggered.value).toBe(100 + params.talismans.kinship.n)
    const notTriggered = applyItemEffects('gained', 100, ['kinship'], ctx({ previousFoundation: card(2, '♥', 4), card: card(1, '♥', 5) }), params)
    expect(notTriggered.value).toBe(100)
  })

  test('thaw: 直前が♠から今回♠以外を取った時のみnを加算', () => {
    const triggered = applyItemEffects('gained', 100, ['thaw'], ctx({ previousFoundation: card(2, '♠', 4), card: card(1, '♥', 5) }), params)
    expect(triggered.value).toBe(100 + params.talismans.thaw.n)
    const notTriggered = applyItemEffects('gained', 100, ['thaw'], ctx({ previousFoundation: card(2, '♠', 4), card: card(1, '♠', 6) }), params)
    expect(notTriggered.value).toBe(100)
  })

  test('dusk: 直前が赤から今回黒を取った時のみnを加算', () => {
    const triggered = applyItemEffects('gained', 100, ['dusk'], ctx({ previousFoundation: card(2, '♥', 4), card: card(1, '♠', 5) }), params)
    expect(triggered.value).toBe(100 + params.talismans.dusk.n)
    const notTriggered = applyItemEffects('gained', 100, ['dusk'], ctx({ previousFoundation: card(2, '♠', 4), card: card(1, '♣', 5) }), params)
    expect(notTriggered.value).toBe(100)
  })

  test('dawn: 直前が黒から今回赤を取った時のみnを加算', () => {
    const triggered = applyItemEffects('gained', 100, ['dawn'], ctx({ previousFoundation: card(2, '♠', 4), card: card(1, '♥', 5) }), params)
    expect(triggered.value).toBe(100 + params.talismans.dawn.n)
    const notTriggered = applyItemEffects('gained', 100, ['dawn'], ctx({ previousFoundation: card(2, '♥', 4), card: card(1, '♦', 5) }), params)
    expect(notTriggered.value).toBe(100)
  })

  test('wit: ワイルドを取った時のみnを加算', () => {
    const triggered = applyItemEffects('gained', 100, ['wit'], ctx({ card: card(1, '★', 0, true) }), params)
    expect(triggered.value).toBe(100 + params.talismans.wit.n)
    const notTriggered = applyItemEffects('gained', 100, ['wit'], ctx({ card: card(1, '♠', 5) }), params)
    expect(notTriggered.value).toBe(100)
  })

  test('courage: コンボ数×xで倍算し、内訳に「勇気×倍率」が入る', () => {
    const result = applyItemEffects('gained', 100, ['courage'], ctx({ combo: 5 }), params)
    const factor = 1 + 5 * params.talismans.courage.x
    expect(result.value).toBe(100 * factor)
    expect(result.parts).toEqual([`勇気×${factor}`])
  })

  test('daybreak: コンボ数がc以下の時のみx倍', () => {
    const triggered = applyItemEffects('gained', 100, ['daybreak'], ctx({ combo: params.talismans.daybreak.c }), params)
    expect(triggered.value).toBe(100 * params.talismans.daybreak.x)
    const notTriggered = applyItemEffects('gained', 100, ['daybreak'], ctx({ combo: params.talismans.daybreak.c + 1 }), params)
    expect(notTriggered.value).toBe(100)
  })

  test('twilight: コンボ数がc以上の時のみx倍', () => {
    const triggered = applyItemEffects('gained', 100, ['twilight'], ctx({ combo: params.talismans.twilight.c }), params)
    expect(triggered.value).toBe(100 * params.talismans.twilight.x)
    const notTriggered = applyItemEffects('gained', 100, ['twilight'], ctx({ combo: params.talismans.twilight.c - 1 }), params)
    expect(notTriggered.value).toBe(100)
  })

  test('cheerful: コンボ数が偶数の時のみnを加算', () => {
    const triggered = applyItemEffects('gained', 100, ['cheerful'], ctx({ combo: 4 }), params)
    expect(triggered.value).toBe(100 + params.talismans.cheerful.n)
    const notTriggered = applyItemEffects('gained', 100, ['cheerful'], ctx({ combo: 5 }), params)
    expect(notTriggered.value).toBe(100)
  })

  test('conscience: コンボ数が奇数の時のみnを加算', () => {
    const triggered = applyItemEffects('gained', 100, ['conscience'], ctx({ combo: 5 }), params)
    expect(triggered.value).toBe(100 + params.talismans.conscience.n)
    const notTriggered = applyItemEffects('gained', 100, ['conscience'], ctx({ combo: 4 }), params)
    expect(notTriggered.value).toBe(100)
  })

  test('morningMist: コンボ数がc未満なら1/x倍、c以上ならx倍で、内訳に「朝霧×倍率」が入る', () => {
    const below = applyItemEffects('gained', 100, ['morningMist'], ctx({ combo: params.talismans.morningMist.c - 1 }), params)
    const belowFactor = 1 / params.talismans.morningMist.x
    expect(below.value).toBe(100 * belowFactor)
    expect(below.parts).toEqual([`朝霧×${Math.round(belowFactor * 100) / 100}`])
    const aboveOrEqual = applyItemEffects('gained', 100, ['morningMist'], ctx({ combo: params.talismans.morningMist.c }), params)
    expect(aboveOrEqual.value).toBe(100 * params.talismans.morningMist.x)
    expect(aboveOrEqual.parts).toEqual([`朝霧×${params.talismans.morningMist.x}`])
  })

  test('複数護符は所持順(配列順)に適用され、内訳もその順で並ぶ(加算→倍算と倍算→加算で結果が変わることを確認)', () => {
    const order1 = applyItemEffects('clearBonus', 1000, ['purify', 'temperance'], ctx({ stockRemaining: 4 }), params)
    const order2 = applyItemEffects('clearBonus', 1000, ['temperance', 'purify'], ctx({ stockRemaining: 4 }), params)
    expect(order1.value).not.toBe(order2.value)
    expect(order1.value).toBe((1000 + params.talismans.purify.n) * (1 + 4 * params.talismans.temperance.x))
    expect(order2.value).toBe(1000 * (1 + 4 * params.talismans.temperance.x) + params.talismans.purify.n)
    expect(order1.parts).toEqual([`浄化+${params.talismans.purify.n}`, `節制×${1 + 4 * params.talismans.temperance.x}`])
    expect(order2.parts).toEqual([`節制×${1 + 4 * params.talismans.temperance.x}`, `浄化+${params.talismans.purify.n}`])
  })

  test('gainedチャンネルの護符はclearBonusチャンネル計算には適用されない', () => {
    const result = applyItemEffects('clearBonus', 1000, ['springBreeze'], ctx({ card: card(1, '♣', 5) }), params)
    expect(result.value).toBe(1000)
    expect(result.parts).toEqual([])
  })
})

describe('rollItemOffer', () => {
  test('未所持のアイテムの中から最大3件返す(プール数が3件を超える場合)', () => {
    const offer = rollItemOffer([], createRng(1))
    expect(offer).toHaveLength(3)
    offer.forEach(id => expect(ITEM_POOL).toContain(id))
    expect(new Set(offer).size).toBe(3) // 重複なし
  })

  test('既に持っているアイテムは種類を問わず候補から除外される', () => {
    const owned = ITEM_POOL.slice(0, ITEM_POOL.length - 1) // 1個だけ未所持にする
    const remaining = ITEM_POOL[ITEM_POOL.length - 1]
    const offer = rollItemOffer(owned, createRng(1))
    expect(offer).toEqual([remaining])
  })

  test('全て持っていれば候補は空になる', () => {
    const offer = rollItemOffer([...ITEM_POOL], createRng(1))
    expect(offer).toEqual([])
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
    expect(DEFAULT_PARAMS.talismans.shootingStar.n).toBe(1000)
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

describe('ITEM_POOL / itemName / itemDesc', () => {
  test('87種類のアイテムが定義されている', () => {
    expect(ITEM_POOL).toHaveLength(87)
    expect(new Set(ITEM_POOL).size).toBe(87) // 重複なし
    ITEM_POOL.forEach(id => expect(itemName(id, DEFAULT_PARAMS)).toBeTruthy())
  })

  test('グループ9〜16の残り20個も名前と説明文を持つ', () => {
    const newIds: ItemId[] = [
      'gentleBreeze', 'resonance',
      'azureSky', 'amber',
      'composure', 'clarity', 'arrogance', 'echo', 'shootingStar',
      'naive', 'intuition', 'sincerity',
      'promise', 'darkClouds', 'regeneration',
      'benevolence', 'healing',
      'guidance',
      'passion', 'fightingSpirit',
    ]
    expect(newIds).toHaveLength(20)
    newIds.forEach(id => {
      expect(itemName(id, DEFAULT_PARAMS)).toBeTruthy()
      expect(itemDesc(id, DEFAULT_PARAMS)).toBeTruthy()
    })
  })

  test('グループ17の8個も名前と説明文を持つ', () => {
    const newIds: ItemId[] = [
      'sanctify', 'protection', 'earth', 'golden',
      'morningStar', 'mercy', 'mirror', 'deadline',
    ]
    expect(newIds).toHaveLength(8)
    newIds.forEach(id => {
      expect(itemName(id, DEFAULT_PARAMS)).toBeTruthy()
      expect(itemDesc(id, DEFAULT_PARAMS)).toBeTruthy()
    })
  })

  test('itemDescはパラメータの数値を埋め込んだ説明文を返す', () => {
    expect(itemDesc('bridge', DEFAULT_PARAMS)).toContain(String(DEFAULT_PARAMS.scoring.stairMinLen))
    expect(itemDesc('bridge', DEFAULT_PARAMS)).toContain(String(DEFAULT_PARAMS.scoring.stairMinLen - DEFAULT_PARAMS.talismans.bridge.m))
    expect(itemDesc('grace', DEFAULT_PARAMS)).toContain(String(DEFAULT_PARAMS.layout.rows))
    expect(itemDesc('grace', DEFAULT_PARAMS)).toContain(String(DEFAULT_PARAMS.layout.rows - DEFAULT_PARAMS.talismans.grace.m))
  })

  test('新規追加した18個の護符も名前と説明文を持つ', () => {
    const newIds: ItemId[] = [
      'patience', 'purify', 'temperance',
      'springBreeze', 'summerBreeze', 'autumnBreeze', 'winterBreeze',
      'kinship', 'thaw', 'dusk', 'dawn', 'wit',
      'courage', 'daybreak', 'twilight', 'cheerful', 'conscience', 'morningMist',
    ]
    newIds.forEach(id => {
      expect(itemName(id, DEFAULT_PARAMS)).toBeTruthy()
      expect(itemDesc(id, DEFAULT_PARAMS)).toBeTruthy()
    })
  })

  test('新規追加した35個(グループ4〜8)の護符も名前と説明文を持つ', () => {
    const newIds: ItemId[] = [
      'calm', 'serenity', 'destiny', 'fate', 'relief',
      'verdantGreen', 'gem', 'resolve', 'grail', 'moonlight', 'sunlight',
      'crown', 'cloverLeaf', 'coin', 'blade', 'chalice', 'balance', 'harmony',
      'nobility', 'tenacity', 'determination', 'cycle', 'reincarnation', 'majesty',
      'omen', 'crescent',
      'blessing', 'focus', 'lapis', 'jade', 'emptyMind',
      'prologue', 'interlude', 'morningDew',
      'drizzle',
    ]
    expect(newIds).toHaveLength(35)
    newIds.forEach(id => {
      expect(itemName(id, DEFAULT_PARAMS)).toBeTruthy()
      expect(itemDesc(id, DEFAULT_PARAMS)).toBeTruthy()
    })
  })

  test('永劫・豊穣・静寂・不屈も名前と説明文を持つ', () => {
    const newIds: ItemId[] = ['eternity', 'abundance', 'silence', 'resilience']
    newIds.forEach(id => {
      expect(itemName(id, DEFAULT_PARAMS)).toBeTruthy()
      expect(itemDesc(id, DEFAULT_PARAMS)).toBeTruthy()
    })
  })

  test('bridge・grace・eternity・abundance・silenceもtalismansにnameエントリを持つ', () => {
    const ids: ItemId[] = ['bridge', 'grace', 'eternity', 'abundance', 'silence']
    ids.forEach(id => {
      expect(DEFAULT_PARAMS.talismans[id].name).toBeTruthy()
    })
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
  test('pickItemでアイテムが追加され次ウェーブが始まる', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'itemSelect', waveIndex: 0, offer: ['bridge'] }
    const next = pickItem(DEFAULT_PARAMS, run, 'bridge', 2)
    expect(next.phase).toBe('playing')
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

  test('所持数がmaxItems未満ならpickItemで即座に反映される(従来通り)', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'itemSelect', items: ['bridge'], offer: ['grace'] }
    const next = pickItem(DEFAULT_PARAMS, run, 'grace', 2)
    expect(next.phase).toBe('playing')
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

  test('confirmItemSwapで指定した護符が1つ入れ替わり次ウェーブへ進む', () => {
    const run = fullItemsRun({ pendingNewItem: 'grace' })
    // run.items = ['bridge', 'grace', 'bridge', 'grace', 'bridge'] (先頭のbridgeが入れ替え対象)
    const next = confirmItemSwap(DEFAULT_PARAMS, run, 'bridge', 3)
    expect(next.phase).toBe('playing')
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

  test('skipItemSelectは護符を追加せずウェーブを進める', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'itemSelect', items: ['bridge'], offer: ['grace'] }
    const next = skipItemSelect(DEFAULT_PARAMS, run, 2)
    expect(next.phase).toBe('playing')
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
  test('不屈を持ち捨て札があれば、手詰まり時にスコア消費して山札へ約半数戻し手詰まりを回避する', () => {
    const wave = makeWave({
      tableau: [[card(1, '♠', 5)]],
      stock: [],
      foundation: card(0, '♣', 1), // 差が4で取れない
      score: 1000,
      discardPile: [card(10, '♦', 2), card(11, '♦', 3), card(12, '♦', 4), card(13, '♦', 5)],
    })
    const run: RunState = {
      phase: 'playing', stageIndex: 0, waveIndex: 0, items: ['resilience'], offer: [],
      wave, pendingNewItem: null, deckComposition: standardDeckComposition(),
    }
    const next = applyStuckCheck(DEFAULT_PARAMS, run, createRng(1))
    expect(next.wave!.status).toBe('playing') // 手詰まりが解消されている
    expect(next.wave!.score).toBe(700) // 1000 - 30%
    expect(next.wave!.stock).toHaveLength(2) // 4枚の半数
    expect(next.wave!.discardPile).toHaveLength(2)
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
      wave, pendingNewItem: null, deckComposition: standardDeckComposition(),
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
      wave, pendingNewItem: null, deckComposition: standardDeckComposition(),
    }
    const next = applyStuckCheck(DEFAULT_PARAMS, run)
    expect(next.wave!.status).toBe('ended')
    expect(next.wave!.endReason).toBe('stuck')
  })
})

describe('analyzeSuitColor', () => {
  test('空のチェーンは両方true', () => {
    expect(analyzeSuitColor([])).toEqual({ suitHeld: true, colorHeld: true })
  })

  test('実カード1枚だけなら両方true', () => {
    expect(analyzeSuitColor([card(1, '♠', 5)])).toEqual({ suitHeld: true, colorHeld: true })
  })

  test('全て同じスートならsuitHeld/colorHeldともtrue', () => {
    const chain = [card(1, '♠', 5), card(2, '♠', 6), card(3, '♠', 7)]
    expect(analyzeSuitColor(chain)).toEqual({ suitHeld: true, colorHeld: true })
  })

  test('スートは違うが同色ならcolorHeldのみtrue', () => {
    const chain = [card(1, '♥', 5), card(2, '♦', 6), card(3, '♥', 7)]
    expect(analyzeSuitColor(chain)).toEqual({ suitHeld: false, colorHeld: true })
  })

  test('色も違う札が混ざるとcolorHeldもfalse', () => {
    const chain = [card(1, '♥', 5), card(2, '♠', 6)]
    expect(analyzeSuitColor(chain)).toEqual({ suitHeld: false, colorHeld: false })
  })

  test('一度崩れたら後で同じスートに戻ってもtrueには戻らない', () => {
    const chain = [card(1, '♠', 5), card(2, '♥', 6), card(3, '♠', 7)]
    expect(analyzeSuitColor(chain).suitHeld).toBe(false)
  })

  test('ワイルドは無視して実カードのみで判定する', () => {
    const chain = [card(1, '♠', 5), card(2, '★', 0, true), card(3, '♠', 9)]
    expect(analyzeSuitColor(chain)).toEqual({ suitHeld: true, colorHeld: true })
  })
})

describe('analyzeStair', () => {
  test('空のチェーンはheld:true, dir:0, len:1', () => {
    expect(analyzeStair([])).toEqual({ held: true, dir: 0, len: 1 })
  })

  test('実カード1枚だけならheld:true, dir:0, len:1', () => {
    expect(analyzeStair([card(1, '♠', 5)])).toEqual({ held: true, dir: 0, len: 1 })
  })

  test('5→6→7で方向+1・長さ3が保持される', () => {
    const chain = [card(1, '♠', 5), card(2, '♣', 6), card(3, '♦', 7)]
    expect(analyzeStair(chain)).toEqual({ held: true, dir: 1, len: 3 })
  })

  test('7→6→5で方向-1・長さ3が保持される', () => {
    const chain = [card(1, '♠', 7), card(2, '♣', 6), card(3, '♦', 5)]
    expect(analyzeStair(chain)).toEqual({ held: true, dir: -1, len: 3 })
  })

  test('5→6→5は方向反転でheld:falseになり、その後は復活しない', () => {
    const chain = [card(1, '♠', 5), card(2, '♣', 6), card(3, '♦', 5), card(4, '♣', 6)]
    expect(analyzeStair(chain).held).toBe(false)
  })

  test('差が±1でない場合はheld:false', () => {
    const chain = [card(1, '♠', 5), card(2, '♣', 8)]
    expect(analyzeStair(chain)).toEqual({ held: false, dir: 0, len: 1 })
  })

  test('K→A→2はループ跨ぎで継続する', () => {
    const chain = [card(1, '♠', 13), card(2, '♣', 1), card(3, '♦', 2)]
    expect(analyzeStair(chain)).toEqual({ held: true, dir: 1, len: 3 })
  })

  test('実カード2枚をワイルド1枚が橋渡しし、差がちょうど埋まれば方向確立に使われる', () => {
    const chain = [card(1, '♠', 5), card(2, '★', 0, true), card(3, '♣', 7)]
    // 5→7の差2をワイルド1枚(6扱い)で埋め、方向+1・長さ3で成立する
    expect(analyzeStair(chain)).toEqual({ held: true, dir: 1, len: 3 })
  })

  test('ワイルドで埋めても差が合わなければheld:false', () => {
    const chain = [card(1, '♠', 5), card(2, '★', 0, true), card(3, '♣', 9)]
    // 5→9の差4に対しワイルドは1枚(1ステップ分)しか無く埋めきれないため不成立
    expect(analyzeStair(chain)).toEqual({ held: false, dir: 0, len: 1 })
  })

  test('ワイルドを挟んだK⇔Aループ跨ぎも方向確立に使われる', () => {
    const chain = [card(1, '♠', 13), card(2, '★', 0, true), card(3, '♣', 2)]
    // K→2の間をワイルド(A扱い)1枚で埋め、ループ跨ぎで方向+1・長さ3が成立する
    expect(analyzeStair(chain)).toEqual({ held: true, dir: 1, len: 3 })
  })

  test('方向確立後、実際の差が合わないワイルド越しの札は継続しない', () => {
    const chain = [card(1, '♠', 5), card(2, '♣', 6), card(3, '★', 0, true), card(4, '♦', 9)]
    // 5→6でdir=1確立。6→9の差3をワイルド1枚(1ステップ分)では埋めきれないため不成立
    expect(analyzeStair(chain)).toEqual({ held: false, dir: 0, len: 1 })
  })

  test('方向確立後、ワイルド越しでも差が正しく埋まれば継続する', () => {
    const chain = [card(1, '♠', 5), card(2, '♣', 6), card(3, '★', 0, true), card(4, '♦', 8)]
    // 5→6でdir=1確立。6→8の差2をワイルド1枚(7扱い)で埋め、長さ4で継続する
    expect(analyzeStair(chain)).toEqual({ held: true, dir: 1, len: 4 })
  })

  test('全てワイルド(2枚以上)の場合は都合よく一直線とみなされる', () => {
    const chain = [card(1, '★', 0, true), card(2, '★', 0, true), card(3, '★', 0, true)]
    expect(analyzeStair(chain)).toEqual({ held: true, dir: 1, len: 3 })
  })

  test('ワイルド1枚のみ(実カード無し)ではheld:true, dir:0, len:1', () => {
    expect(analyzeStair([card(1, '★', 0, true)])).toEqual({ held: true, dir: 0, len: 1 })
  })
})

describe('checkFlush', () => {
  test('直近4枚が4スート全部なら成立(順不同)', () => {
    const cards = [card(1, '♦', 3), card(2, '♠', 5), card(3, '♣', 9), card(4, '♥', 2)]
    expect(checkFlush(cards)).toBe(true)
  })

  test('4枚未満なら不成立', () => {
    expect(checkFlush([card(1, '♠', 5), card(2, '♥', 6), card(3, '♦', 7)])).toBe(false)
  })

  test('直近4枚にスートの重複があれば不成立', () => {
    const cards = [card(1, '♠', 3), card(2, '♠', 5), card(3, '♣', 9), card(4, '♥', 2)]
    expect(checkFlush(cards)).toBe(false)
  })

  test('5枚以上でも直近4枚だけで判定する', () => {
    const cards = [card(1, '♠', 1), card(2, '♠', 2), card(3, '♦', 3), card(4, '♠', 5), card(5, '♥', 9), card(6, '♣', 2)]
    // 直近4枚(3,4,5,6番目)が♦♠♥♣で揃っている
    expect(checkFlush(cards)).toBe(true)
  })

  test('ワイルドが1枚あれば不足スート1つを埋めたものとして成立する', () => {
    const cards = [card(1, '♦', 3), card(2, '♠', 5), card(3, '★', 0, true), card(4, '♥', 2)]
    // 実スートは♦♠♥の3種類、ワイルド1枚が残り1種類(♣)を埋める
    expect(checkFlush(cards)).toBe(true)
  })

  test('不足スート数がワイルド枚数を上回れば不成立', () => {
    const cards = [card(1, '♦', 3), card(2, '♦', 5), card(3, '★', 0, true), card(4, '♥', 2)]
    // 実スートは♦♥の2種類(♦が重複)、不足は♠♣の2つに対しワイルドは1枚のみ
    expect(checkFlush(cards)).toBe(false)
  })
})

describe('checkRoyalSet', () => {
  test('直近3枚がJ・Q・K全部なら成立(順不同)', () => {
    const cards = [card(1, '♠', 13), card(2, '♥', 11), card(3, '♦', 12)]
    expect(checkRoyalSet(cards)).toBe(true)
  })

  test('3枚未満なら不成立', () => {
    expect(checkRoyalSet([card(1, '♠', 11), card(2, '♥', 12)])).toBe(false)
  })

  test('J/Q/K以外が混ざれば不成立', () => {
    const cards = [card(1, '♠', 13), card(2, '♥', 11), card(3, '♦', 5)]
    expect(checkRoyalSet(cards)).toBe(false)
  })

  test('ワイルドが1枚あれば不足するJ/Q/Kのうち1つを埋めたものとして成立する', () => {
    const cards = [card(1, '♠', 13), card(2, '★', 0, true), card(3, '♦', 12)]
    // 実ランクはK・Qの2種類、ワイルド1枚が残り1種類(J)を埋める
    expect(checkRoyalSet(cards)).toBe(true)
  })

  test('不足ランク数がワイルド枚数を上回れば不成立', () => {
    const cards = [card(1, '♠', 13), card(2, '★', 0, true), card(3, '♦', 5)]
    // 実ランクはKのみ、不足はQ・Jの2つに対しワイルドは1枚のみ
    expect(checkRoyalSet(cards)).toBe(false)
  })
})

describe('countSameRankBefore', () => {
  test('同ランクが無ければ0', () => {
    expect(countSameRankBefore([card(1, '♠', 5), card(2, '♥', 6)], 7)).toBe(0)
  })

  test('同ランクの実カードが3枚あれば3を返す', () => {
    const cards = [card(1, '♠', 5), card(2, '♥', 5), card(3, '♦', 5)]
    expect(countSameRankBefore(cards, 5)).toBe(3)
  })

  test('ワイルドはランクを問わず加算される', () => {
    const cards = [card(1, '♠', 5), card(2, '♥', 5), card(3, '★', 0, true)]
    expect(countSameRankBefore(cards, 5)).toBe(3) // 実カード2枚+ワイルド1枚
  })

  test('指定ランクと無関係な実カードが混ざっていても、ワイルドの枚数分は必ず加算される', () => {
    const cards = [card(1, '♠', 9), card(2, '★', 0, true), card(3, '★', 0, true)]
    expect(countSameRankBefore(cards, 5)).toBe(2) // 実カード0枚(9はランク不一致)+ワイルド2枚
  })
})

describe('countSameRankForWildPlay', () => {
  test('同ランクの重複が無ければ2を返す(既発生の最大枚数1+1)', () => {
    const cards = [card(1, '♠', 5), card(2, '♥', 3), card(3, '♦', 7)]
    expect(countSameRankForWildPlay(cards)).toBe(2)
  })

  test('既に同ランクが2枚あるランクが存在すれば、その枚数+1を返す', () => {
    const cards = [card(1, '♠', 5), card(2, '♥', 5), card(3, '♦', 3), card(4, '♣', 3)]
    expect(countSameRankForWildPlay(cards)).toBe(3)
  })

  test('チェーン内の既存ワイルドは最大枚数の算出に加算される', () => {
    const cards = [card(1, '♠', 5), card(2, '♥', 5), card(3, '★', 0, true)]
    // 実カードの最大重複は5の2枚、既存ワイルド1枚を加えて3、+1で4
    expect(countSameRankForWildPlay(cards)).toBe(4)
  })

  test('チェーンが空でも2を返す(下限)', () => {
    expect(countSameRankForWildPlay([])).toBe(2)
  })
})

describe('checkCompleteRun', () => {
  test('13ランク揃う直前(12種)ではfalse', () => {
    const before = Array.from({ length: 12 }, (_, i) => card(i + 1, '♠', (i + 1) as Card['rank']))
    expect(checkCompleteRun(before.slice(0, 11), before)).toBe(false)
  })

  test('13種類目が揃った瞬間にtrue', () => {
    const before = Array.from({ length: 12 }, (_, i) => card(i + 1, '♠', (i + 1) as Card['rank']))
    const now = [...before, card(13, '♥', 13)]
    expect(checkCompleteRun(before, now)).toBe(true)
  })

  test('既に13種揃った後に重複が増えても再度trueにはならない(呼び出し側でbefore/nowの差分を見る想定)', () => {
    const all13 = Array.from({ length: 13 }, (_, i) => card(i + 1, '♠', (i + 1) as Card['rank']))
    const withDup = [...all13, card(14, '♥', 5)]
    expect(checkCompleteRun(all13, withDup)).toBe(false)
  })

  test('ワイルド1枚が未出現ランク1つを埋め、実12種+ワイルド1枚で13種扱いになる', () => {
    const before = [
      ...Array.from({ length: 11 }, (_, i) => card(i + 1, '♠', (i + 1) as Card['rank'])),
      card(90, '★', 0, true),
    ] // 実11種+ワイルド1枚 = 12種扱い(まだ13種未満)
    const now = [...before, card(13, '♥', 12)] // 実12種目を追加 = 12種+ワイルド1枚 = 13種扱い
    expect(checkCompleteRun(before, now)).toBe(true)
  })

  test('ワイルドが無ければ実11種+実1種=実12種のままで13種に届かない', () => {
    const before = Array.from({ length: 11 }, (_, i) => card(i + 1, '♠', (i + 1) as Card['rank']))
    const now = [...before, card(13, '♥', 12)]
    expect(checkCompleteRun(before, now)).toBe(false)
  })
})

describe('evaluateChainBonus', () => {
  const scoring = DEFAULT_PARAMS.scoring

  test('コンボ1枚目(chainBefore空)はボーナス0', () => {
    const result = evaluateChainBonus(scoring, [], card(1, '♠', 5))
    expect(result).toEqual({ bonus: 0, parts: [], patternFired: false, patternFiredCount: 0, roleFired: [] })
  })

  test('実カード2枚(3枚未満)ではまだ同スートボーナスは付かない', () => {
    const chainBefore = [card(1, '♠', 5)]
    const result = evaluateChainBonus(scoring, chainBefore, card(2, '♠', 6))
    expect(result.parts.some(p => p.startsWith('同スート'))).toBe(false)
  })

  test('実カード3枚以上になった瞬間から同スートボーナスが付く', () => {
    const chainBefore = [card(1, '♠', 5), card(2, '♠', 6)]
    const result = evaluateChainBonus(scoring, chainBefore, card(3, '♠', 7))
    expect(result.bonus).toBe(scoring.suitBonus)
    expect(result.parts).toEqual([`同スート+${scoring.suitBonus}`])
  })

  test('新たに加えたカード自身がワイルドの場合も母数に含める(3枚以上なら同スートボーナスが付く)', () => {
    const chainBefore = [card(1, '♠', 5), card(2, '♠', 7)] // 実カード2枚、同スート
    const result = evaluateChainBonus(scoring, chainBefore, card(3, '★', 0, true))
    // ワイルド自身も母数に含めるため、実カード2枚+ワイルド1枚=3枚として同スートボーナスが成立する
    // (ワイルドをプレイすると同ランクボーナスも同時に発生するため、部分一致で検証する)
    expect(result.parts).toContain(`同スート+${scoring.suitBonus}`)
  })

  test('3枚全てワイルドでも母数を満たせば都合よく同スートボーナスが成立する', () => {
    const chainBefore = [card(1, '★', 0, true), card(2, '★', 0, true)]
    const result = evaluateChainBonus(scoring, chainBefore, card(3, '★', 0, true))
    expect(result.parts).toContain(`同スート+${scoring.suitBonus}`)
  })

  test('コンボ中に一度スートが崩れたら、以降同スートが来てもsuitBonusは付かない', () => {
    const chainBefore = [card(1, '♠', 5), card(2, '♥', 6), card(3, '♠', 7)] // 1枚目→2枚目でスート崩壊済み、3枚目は直前(2枚目...)
    const result = evaluateChainBonus(scoring, chainBefore, card(4, '♠', 8))
    expect(result.parts.some(p => p.startsWith('同スート'))).toBe(false)
  })

  test('基本ルールでは階段は既定のstairMinLen(5)未満だとstairBonusが付かない', () => {
    const chainBefore = [card(1, '♠', 5), card(2, '♣', 6)]
    const result = evaluateChainBonus(scoring, chainBefore, card(3, '♦', 7))
    // 5→6→7で長さ3、既定のstairMinLen(5)未満のためstairBonusは付かない
    expect(result.parts.some(p => p.startsWith('階段'))).toBe(false)
  })

  test('階段が既定のstairMinLen(5)以上続けばstairBonusが付く', () => {
    const chainBefore = [card(1, '♠', 3), card(2, '♣', 4), card(3, '♦', 5), card(4, '♠', 6)]
    const result = evaluateChainBonus(scoring, chainBefore, card(5, '♣', 7))
    expect(result.parts).toContain(`階段5 +${scoring.stairBonus}`)
  })

  test('stairMinLenを明示的に指定すると(架橋の護符相当)その値で判定される', () => {
    const chainBefore = [card(1, '♠', 5), card(2, '♣', 6)]
    const result = evaluateChainBonus(scoring, chainBefore, card(3, '♦', 7), 3)
    expect(result.parts).toContain(`階段3 +${scoring.stairBonus}`)
  })

  test('ワイルドで橋渡しされた階段もstairBonusの対象になる', () => {
    const chainBefore = [card(1, '♠', 5), card(2, '★', 0, true)]
    const result = evaluateChainBonus(scoring, chainBefore, card(3, '♦', 7), 3)
    // 5→(ワイルド=6扱い)→7で長さ3、stairMinLen=3(架橋の護符相当)で成立
    expect(result.parts).toContain(`階段3 +${scoring.stairBonus}`)
  })

  test('直近4枚で4スート揃うとflushBonusが付く', () => {
    const chainBefore = [card(1, '♦', 3), card(2, '♠', 5), card(3, '♣', 9)]
    const result = evaluateChainBonus(scoring, chainBefore, card(4, '♥', 2))
    expect(result.parts).toContain(`フラッシュ+${scoring.flushBonus}`)
  })

  test('直近3枚でJQK揃うとroyalSetBonusが付く', () => {
    const chainBefore = [card(1, '♠', 13), card(2, '♥', 11)]
    const result = evaluateChainBonus(scoring, chainBefore, card(3, '♦', 12))
    expect(result.parts).toContain(`ロイヤル+${scoring.royalSetBonus}`)
  })

  test('同ランクが既に2枚あれば sameRankBonusUnit×2 が付く', () => {
    const chainBefore = [card(1, '♠', 5), card(2, '♥', 5)]
    const result = evaluateChainBonus(scoring, chainBefore, card(3, '♦', 5))
    expect(result.parts).toContain(`同ランク+${scoring.sameRankBonusUnit * 2}`)
  })

  test('チェーン内にワイルドが含まれる場合、同ランクボーナスにワイルドの枚数分も加算される', () => {
    const chainBefore = [card(1, '♠', 5), card(2, '★', 0, true)]
    const result = evaluateChainBonus(scoring, chainBefore, card(3, '♥', 5))
    // 実カード1枚(5)+ワイルド1枚 = 2枚扱い
    expect(result.parts).toContain(`同ランク+${scoring.sameRankBonusUnit * 2}`)
  })

  test('ワイルド自身をプレイした場合、既発生の最大同ランク数+1枚として同ランクボーナスが発生する', () => {
    const chainBefore = [card(1, '♠', 5), card(2, '♥', 5), card(3, '♦', 3), card(4, '♣', 3)]
    // 5が2枚・3が2枚 → 既発生の最大枚数は2、ワイルドは2+1=3枚分として発生
    const result = evaluateChainBonus(scoring, chainBefore, card(5, '★', 0, true))
    expect(result.parts).toContain(`同ランク+${scoring.sameRankBonusUnit * 3}`)
  })

  test('チェーン内に同ランクの重複が無い状態でワイルドをプレイすると2枚分として発生する', () => {
    const chainBefore = [card(1, '♠', 5), card(2, '♥', 3), card(3, '♦', 7)] // 全て異なるランク
    const result = evaluateChainBonus(scoring, chainBefore, card(4, '★', 0, true))
    expect(result.parts).toContain(`同ランク+${scoring.sameRankBonusUnit * 2}`)
  })

  test('13ランクが揃った瞬間にcompleteRunBonusが付く(同スートでなければ追加ボーナスなし)', () => {
    const chainBefore = Array.from({ length: 12 }, (_, i) => card(i + 1, i % 2 === 0 ? '♠' : '♥', (i + 1) as Card['rank']))
    const result = evaluateChainBonus(scoring, chainBefore, card(13, '♦', 13))
    expect(result.parts).toContain(`コンプリートラン+${scoring.completeRunBonus}`)
    expect(result.parts.some(p => p.includes('コンプリートラン(同スート)'))).toBe(false)
  })

  test('13ランクが全て同じスートで揃うとcompleteRunSuitBonusも追加で付く', () => {
    const chainBefore = Array.from({ length: 12 }, (_, i) => card(i + 1, '♠', (i + 1) as Card['rank']))
    const result = evaluateChainBonus(scoring, chainBefore, card(13, '♠', 13))
    expect(result.parts).toContain(`コンプリートラン+${scoring.completeRunBonus}`)
    expect(result.parts).toContain(`コンプリートラン(同スート)+${scoring.completeRunSuitBonus}`)
  })

  test('roleFiredの各要素は実際の加点額(amount)を持つ', () => {
    const chainBefore = [card(1, '♥', 9), card(2, '♦', 10), card(3, '♣', 11)]
    const result = evaluateChainBonus(DEFAULT_PARAMS.scoring, chainBefore, card(4, '♠', 12))
    const flushEntry = result.roleFired.find(r => r.name === 'flush')
    expect(flushEntry).toBeDefined()
    expect(flushEntry?.amount).toBe(DEFAULT_PARAMS.scoring.flushBonus)
  })

  test('roleBonusMultiplierを渡すと役ボーナスの額に倍率がかかる(パターンボーナスには影響しない)', () => {
    const chainBefore = [card(1, '♥', 9), card(2, '♦', 10), card(3, '♣', 11)]
    const multiplier = (name: RoleName) => (name === 'flush' ? 2 : 1)
    const result = evaluateChainBonus(DEFAULT_PARAMS.scoring, chainBefore, card(4, '♠', 12), DEFAULT_PARAMS.scoring.stairMinLen, multiplier)
    const flushEntry = result.roleFired.find(r => r.name === 'flush')
    expect(flushEntry?.amount).toBe(DEFAULT_PARAMS.scoring.flushBonus * 2)
    expect(result.bonus).toBe(DEFAULT_PARAMS.scoring.flushBonus * 2)
  })

  test('roleBonusMultiplierを省略すると常に等倍(既存挙動と同じ)', () => {
    const chainBefore = [card(1, '♣', 5), card(2, '♣', 6)]
    const withoutMultiplier = evaluateChainBonus(DEFAULT_PARAMS.scoring, chainBefore, card(3, '♣', 5))
    const withIdentityMultiplier = evaluateChainBonus(DEFAULT_PARAMS.scoring, chainBefore, card(3, '♣', 5), DEFAULT_PARAMS.scoring.stairMinLen, () => 1)
    expect(withoutMultiplier).toEqual(withIdentityMultiplier)
  })

  test('suitColorMinLenを指定すると、その枚数で同スートボーナスが成立する', () => {
    // 実カード2枚(同スート)のみ。既定のsuitColorMinLen(3)では不成立だが、2を渡すと成立する。
    const chainBefore = [card(20, '♠', 3)]
    const result = evaluateChainBonus(DEFAULT_PARAMS.scoring, chainBefore, card(21, '♠', 4), undefined, undefined, 2)
    expect(result.parts).toContain(`同スート+${DEFAULT_PARAMS.scoring.suitBonus}`)
  })

  test('同スート・階段が同時成立すると、patternFiredCountが2になる', () => {
    // 実カード3枚を同スート(♠)かつ連続ランク(3,4,5)にして、同スートと階段の両方を成立させる。
    // stairMinLenを3に指定して3枚でも階段ボーナスが成立するようにする。
    const chainBefore = [card(20, '♠', 3), card(21, '♠', 4)]
    const result = evaluateChainBonus(DEFAULT_PARAMS.scoring, chainBefore, card(22, '♠', 5), 3)
    expect(result.parts).toContain(`同スート+${DEFAULT_PARAMS.scoring.suitBonus}`)
    expect(result.parts.some(p => p.startsWith('階段'))).toBe(true)
    expect(result.patternFiredCount).toBe(2)
  })

  test('パターンボーナスが1種類も成立しなければpatternFiredCountは0', () => {
    const chainBefore = [card(20, '♠', 3)]
    const result = evaluateChainBonus(DEFAULT_PARAMS.scoring, chainBefore, card(21, '♦', 9))
    expect(result.patternFiredCount).toBe(0)
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

describe('applyItemEffects (グループ4-a: 絵札条件系)', () => {
  const params = DEFAULT_PARAMS
  function ctx(overrides: Partial<ItemEffectContext> = {}): ItemEffectContext {
    return {
      card: card(1, '♠', 5),
      previousFoundation: card(2, '♣', 4),
      combo: 1,
      stockRemaining: 0,
      chain: [card(2, '♣', 4), card(1, '♠', 5)],
      remainingTableauCount: 10,
      chainBonus: { bonus: 0, parts: [], patternFired: false, patternFiredCount: 0, roleFired: [] },
      isFirstPlayOfWave: false,
      effectiveStairMinLen: params.scoring.stairMinLen,
      effectiveSuitColorMinLen: params.scoring.suitColorMinLen,
      sameColumnStreak: 1,
      totalColumnsEmptiedThisWave: 0,
      maxComboThisWave: 1,
      flushActiveThisCombo: false,
      columnSweepActiveThisWave: false,
      drawContinueCountThisChain: 0,
      mercyActiveNextCombo: false,
      ...overrides,
    }
  }

  test('平穏: チェーンにJQKが無ければ加算、絵札が混ざれば不発動', () => {
    const fired = applyItemEffects('gained', 100, ['calm'], ctx({ chain: [card(1, '♠', 5), card(2, '♦', 8)] }), params)
    expect(fired.value).toBe(100 + params.talismans.calm.n)
    const notFired = applyItemEffects('gained', 100, ['calm'], ctx({ chain: [card(1, '♠', 5), card(2, '♦', 12)] }), params)
    expect(notFired.value).toBe(100)
  })

  test('安寧: チェーンにJQKが無ければ倍算', () => {
    const result = applyItemEffects('gained', 100, ['serenity'], ctx({ chain: [card(1, '♠', 5), card(2, '♦', 8)] }), params)
    expect(result.value).toBe(100 * params.talismans.serenity.x)
  })

  test('運命: チェーンがJQKのみなら加算、非絵札が混ざれば不発動', () => {
    const fired = applyItemEffects('gained', 100, ['destiny'], ctx({ chain: [card(1, '♠', 11), card(2, '♦', 13)] }), params)
    expect(fired.value).toBe(100 + params.talismans.destiny.n)
    const notFired = applyItemEffects('gained', 100, ['destiny'], ctx({ chain: [card(1, '♠', 11), card(2, '♦', 5)] }), params)
    expect(notFired.value).toBe(100)
  })

  test('宿命: チェーンがJQKのみなら倍算', () => {
    const result = applyItemEffects('gained', 100, ['fate'], ctx({ chain: [card(1, '♠', 11), card(2, '♦', 13)] }), params)
    expect(result.value).toBe(100 * params.talismans.fate.x)
  })

  test('安堵: 取得したカードのランクが1〜10なら加算、ワイルドなら都合よく発動、絵札なら不発動', () => {
    const numberCard = applyItemEffects('gained', 100, ['relief'], ctx({ card: card(1, '♠', 7) }), params)
    expect(numberCard.value).toBe(100 + params.talismans.relief.n)
    const wildCard = applyItemEffects('gained', 100, ['relief'], ctx({ card: card(1, '★', 0, true) }), params)
    expect(wildCard.value).toBe(100 + params.talismans.relief.n)
    const faceCard = applyItemEffects('gained', 100, ['relief'], ctx({ card: card(1, '♠', 12) }), params)
    expect(faceCard.value).toBe(100)
  })
})

describe('applyItemEffects (グループ4-b: スート/色専有系)', () => {
  const params = DEFAULT_PARAMS
  function ctx(overrides: Partial<ItemEffectContext> = {}): ItemEffectContext {
    return {
      card: card(1, '♠', 5),
      previousFoundation: card(2, '♣', 4),
      combo: 1,
      stockRemaining: 0,
      chain: [card(2, '♣', 4), card(1, '♠', 5)],
      remainingTableauCount: 10,
      chainBonus: { bonus: 0, parts: [], patternFired: false, patternFiredCount: 0, roleFired: [] },
      isFirstPlayOfWave: false,
      effectiveStairMinLen: params.scoring.stairMinLen,
      effectiveSuitColorMinLen: params.scoring.suitColorMinLen,
      sameColumnStreak: 1,
      totalColumnsEmptiedThisWave: 0,
      maxComboThisWave: 1,
      flushActiveThisCombo: false,
      columnSweepActiveThisWave: false,
      drawContinueCountThisChain: 0,
      mercyActiveNextCombo: false,
      ...overrides,
    }
  }

  test('深緑: ♣専有チェーンで倍算、他スートが混ざれば不発動、全ワイルドでも都合よく発動', () => {
    const pure = applyItemEffects('gained', 100, ['verdantGreen'], ctx({ chain: [card(1, '♣', 3), card(2, '♣', 5)] }), params)
    expect(pure.value).toBe(100 * params.talismans.verdantGreen.x)
    const mixed = applyItemEffects('gained', 100, ['verdantGreen'], ctx({ chain: [card(1, '♣', 3), card(2, '♦', 5)] }), params)
    expect(mixed.value).toBe(100)
    const allWild = applyItemEffects('gained', 100, ['verdantGreen'], ctx({ chain: [card(1, '★', 0, true), card(2, '★', 0, true)] }), params)
    expect(allWild.value).toBe(100 * params.talismans.verdantGreen.x)
  })

  test('宝石: ♦専有チェーンで倍算', () => {
    const result = applyItemEffects('gained', 100, ['gem'], ctx({ chain: [card(1, '♦', 3), card(2, '♦', 5)] }), params)
    expect(result.value).toBe(100 * params.talismans.gem.x)
  })

  test('真剣: ♠専有チェーンで倍算', () => {
    const result = applyItemEffects('gained', 100, ['resolve'], ctx({ chain: [card(1, '♠', 3), card(2, '♠', 5)] }), params)
    expect(result.value).toBe(100 * params.talismans.resolve.x)
  })

  test('聖杯: ♥専有チェーンで倍算', () => {
    const result = applyItemEffects('gained', 100, ['grail'], ctx({ chain: [card(1, '♥', 3), card(2, '♥', 5)] }), params)
    expect(result.value).toBe(100 * params.talismans.grail.x)
  })

  test('月光: 黒専有チェーンで倍算、赤が混ざれば不発動', () => {
    const pure = applyItemEffects('gained', 100, ['moonlight'], ctx({ chain: [card(1, '♠', 3), card(2, '♣', 5)] }), params)
    expect(pure.value).toBe(100 * params.talismans.moonlight.x)
    const mixed = applyItemEffects('gained', 100, ['moonlight'], ctx({ chain: [card(1, '♠', 3), card(2, '♥', 5)] }), params)
    expect(mixed.value).toBe(100)
  })

  test('陽光: 赤専有チェーンで倍算', () => {
    const result = applyItemEffects('gained', 100, ['sunlight'], ctx({ chain: [card(1, '♥', 3), card(2, '♦', 5)] }), params)
    expect(result.value).toBe(100 * params.talismans.sunlight.x)
  })
})

describe('applyItemEffects (グループ4-c: 枚数カウント系)', () => {
  const params = DEFAULT_PARAMS
  function ctx(overrides: Partial<ItemEffectContext> = {}): ItemEffectContext {
    return {
      card: card(1, '♠', 5),
      previousFoundation: card(2, '♣', 4),
      combo: 1,
      stockRemaining: 0,
      chain: [card(2, '♣', 4), card(1, '♠', 5)],
      remainingTableauCount: 10,
      chainBonus: { bonus: 0, parts: [], patternFired: false, patternFiredCount: 0, roleFired: [] },
      isFirstPlayOfWave: false,
      effectiveStairMinLen: params.scoring.stairMinLen,
      effectiveSuitColorMinLen: params.scoring.suitColorMinLen,
      sameColumnStreak: 1,
      totalColumnsEmptiedThisWave: 0,
      maxComboThisWave: 1,
      flushActiveThisCombo: false,
      columnSweepActiveThisWave: false,
      drawContinueCountThisChain: 0,
      mercyActiveNextCombo: false,
      ...overrides,
    }
  }

  test('王冠: チェーン内のK枚数(ワイルド込み)×xで倍算、K無しなら不発動', () => {
    const chain = [card(1, '♠', 13), card(2, '♦', 13), card(3, '★', 0, true)]
    const result = applyItemEffects('gained', 100, ['crown'], ctx({ chain }), params)
    expect(result.value).toBe(100 * (1 + 3 * params.talismans.crown.x))
    const noKing = applyItemEffects('gained', 100, ['crown'], ctx({ chain: [card(1, '♠', 5)] }), params)
    expect(noKing.value).toBe(100)
  })

  test('青葉: チェーン内の♣枚数(ワイルド込み)×nで加算', () => {
    const chain = [card(1, '♣', 3), card(2, '♣', 5), card(3, '★', 0, true)]
    const result = applyItemEffects('gained', 100, ['cloverLeaf'], ctx({ chain }), params)
    expect(result.value).toBe(100 + 3 * params.talismans.cloverLeaf.n)
  })

  test('硬貨: チェーン内の♦枚数×nで加算', () => {
    const chain = [card(1, '♦', 3), card(2, '♦', 5)]
    const result = applyItemEffects('gained', 100, ['coin'], ctx({ chain }), params)
    expect(result.value).toBe(100 + 2 * params.talismans.coin.n)
  })

  test('武器: チェーン内の♠枚数×nで加算', () => {
    const chain = [card(1, '♠', 3), card(2, '♠', 5)]
    const result = applyItemEffects('gained', 100, ['blade'], ctx({ chain }), params)
    expect(result.value).toBe(100 + 2 * params.talismans.blade.n)
  })

  test('献杯: チェーン内の♥枚数×nで加算', () => {
    const chain = [card(1, '♥', 3), card(2, '♥', 5)]
    const result = applyItemEffects('gained', 100, ['chalice'], ctx({ chain }), params)
    expect(result.value).toBe(100 + 2 * params.talismans.chalice.n)
  })

  test('均衡: 赤黒枚数が同数(ワイルドで調整可)なら加算', () => {
    const balanced = applyItemEffects('gained', 100, ['balance'], ctx({ chain: [card(1, '♠', 3), card(2, '♥', 5)] }), params)
    expect(balanced.value).toBe(100 + params.talismans.balance.n)
    const adjustedByWild = applyItemEffects('gained', 100, ['balance'], ctx({ chain: [card(1, '♠', 3), card(2, '♥', 4), card(3, '♠', 5), card(4, '★', 0, true)] }), params)
    expect(adjustedByWild.value).toBe(100 + params.talismans.balance.n)
    const unbalanced = applyItemEffects('gained', 100, ['balance'], ctx({ chain: [card(1, '♠', 3), card(2, '♠', 4), card(3, '♥', 5)] }), params)
    expect(unbalanced.value).toBe(100)
  })

  test('均衡: 合計枚数が奇数だとワイルドをどう振り分けても同数にできないため不発動', () => {
    const singleWild = applyItemEffects('gained', 100, ['balance'], ctx({ chain: [card(1, '★', 0, true)] }), params)
    expect(singleWild.value).toBe(100)
    const oddTotal = applyItemEffects('gained', 100, ['balance'], ctx({ chain: [card(1, '♠', 3), card(2, '★', 0, true), card(3, '★', 0, true)] }), params)
    expect(oddTotal.value).toBe(100)
  })

  test('調和: 赤黒枚数が同数なら倍算', () => {
    const result = applyItemEffects('gained', 100, ['harmony'], ctx({ chain: [card(1, '♠', 3), card(2, '♥', 5)] }), params)
    expect(result.value).toBe(100 * params.talismans.harmony.x)
  })
})

describe('applyItemEffects (グループ4-d: 既存フラグ再利用・KAループ系)', () => {
  const params = DEFAULT_PARAMS
  function ctx(overrides: Partial<ItemEffectContext> = {}): ItemEffectContext {
    return {
      card: card(1, '♠', 5),
      previousFoundation: card(2, '♣', 4),
      combo: 1,
      stockRemaining: 0,
      chain: [card(2, '♣', 4), card(1, '♠', 5)],
      remainingTableauCount: 10,
      chainBonus: { bonus: 0, parts: [], patternFired: false, patternFiredCount: 0, roleFired: [] },
      isFirstPlayOfWave: false,
      effectiveStairMinLen: params.scoring.stairMinLen,
      effectiveSuitColorMinLen: params.scoring.suitColorMinLen,
      sameColumnStreak: 1,
      totalColumnsEmptiedThisWave: 0,
      maxComboThisWave: 1,
      flushActiveThisCombo: false,
      columnSweepActiveThisWave: false,
      drawContinueCountThisChain: 0,
      mercyActiveNextCombo: false,
      ...overrides,
    }
  }

  test('高潔: 同スートパターン成立時(3枚以上・同スート)に加算', () => {
    const chain = [card(1, '♠', 3), card(2, '♠', 5), card(3, '♠', 9)]
    const fired = applyItemEffects('gained', 100, ['nobility'], ctx({ chain }), params)
    expect(fired.value).toBe(100 + params.talismans.nobility.n)
    const tooShort = applyItemEffects('gained', 100, ['nobility'], ctx({ chain: chain.slice(0, 2) }), params)
    expect(tooShort.value).toBe(100)
  })

  test('執念: 同スートパターン成立時、チェーン長×xで倍算', () => {
    const chain = [card(1, '♠', 3), card(2, '♠', 5), card(3, '♠', 9)]
    const result = applyItemEffects('gained', 100, ['tenacity'], ctx({ chain }), params)
    expect(result.value).toBe(100 * (1 + chain.length * params.talismans.tenacity.x))
  })

  test('覚悟: 階段成立時(effectiveStairMinLen以上)、階段長×xで倍算', () => {
    const chain = [card(1, '♠', 3), card(2, '♦', 4), card(3, '♥', 5), card(4, '♣', 6), card(5, '♠', 7)]
    const result = applyItemEffects('gained', 100, ['determination'], ctx({ chain, effectiveStairMinLen: 5 }), params)
    expect(result.value).toBe(100 * (1 + 5 * params.talismans.determination.x))
  })

  test('覚悟: 階段の長さがeffectiveStairMinLen未満、または階段が崩れていれば不発動', () => {
    const tooShort = [card(1, '♠', 3), card(2, '♦', 4), card(3, '♥', 5)]
    const tooShortResult = applyItemEffects('gained', 100, ['determination'], ctx({ chain: tooShort, effectiveStairMinLen: 5 }), params)
    expect(tooShortResult.value).toBe(100)
    const broken = [card(1, '♠', 3), card(2, '♦', 9), card(3, '♥', 5), card(4, '♣', 6), card(5, '♠', 7)]
    const brokenResult = applyItemEffects('gained', 100, ['determination'], ctx({ chain: broken, effectiveStairMinLen: 5 }), params)
    expect(brokenResult.value).toBe(100)
  })

  test('循環: K→A、A→Kの遷移で倍算し、ワイルドが絡む場合も都合よく成立する', () => {
    const kToA = applyItemEffects('gained', 100, ['cycle'], ctx({ previousFoundation: card(1, '♠', 13), card: card(2, '♦', 1) }), params)
    expect(kToA.value).toBe(100 * params.talismans.cycle.x)
    const wildAsA = applyItemEffects('gained', 100, ['cycle'], ctx({ previousFoundation: card(1, '♠', 13), card: card(2, '★', 0, true) }), params)
    expect(wildAsA.value).toBe(100 * params.talismans.cycle.x)
    const notFired = applyItemEffects('gained', 100, ['cycle'], ctx({ previousFoundation: card(1, '♠', 7), card: card(2, '♦', 8) }), params)
    expect(notFired.value).toBe(100)
  })

  const kaLoopChain: Card[] = [8, 9, 10, 11, 12, 13, 1, 2, 3, 4, 5, 6, 7].map((r, i) => card(i + 1, '♠', r as Card['rank']))
  const completeRunRoleFired = { bonus: 0, parts: [], patternFired: false, patternFiredCount: 0, roleFired: [{ name: 'completeRun' as const, usedWild: false, amount: 0 }] }

  test('輪廻: コンプリートラン成立かつ階段成立かつK↔Aループを跨ぐ場合に倍算', () => {
    const fired = applyItemEffects('gained', 100, ['reincarnation'], ctx({ chain: kaLoopChain, chainBonus: completeRunRoleFired }), params)
    expect(fired.value).toBe(100 * params.talismans.reincarnation.x)
    const noLoopChain = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((r, i) => card(i + 1, '♠', r as Card['rank']))
    const notFired = applyItemEffects('gained', 100, ['reincarnation'], ctx({ chain: noLoopChain, chainBonus: completeRunRoleFired }), params)
    expect(notFired.value).toBe(100)
  })

  test('威光: コンプリートラン成立かつ階段成立かつ同スート専有の場合に倍算', () => {
    const fired = applyItemEffects('gained', 100, ['majesty'], ctx({ chain: kaLoopChain, chainBonus: completeRunRoleFired }), params)
    expect(fired.value).toBe(100 * params.talismans.majesty.x)
    const mixedSuitChain = kaLoopChain.map((c, i) => (i === 0 ? { ...c, suit: '♦' as const } : c))
    const notFired = applyItemEffects('gained', 100, ['majesty'], ctx({ chain: mixedSuitChain, chainBonus: completeRunRoleFired }), params)
    expect(notFired.value).toBe(100)
  })
})

describe('applyItemEffects (グループ5: 場札残数系)', () => {
  const params = DEFAULT_PARAMS
  function ctx(overrides: Partial<ItemEffectContext> = {}): ItemEffectContext {
    return {
      card: card(1, '♠', 5),
      previousFoundation: card(2, '♣', 4),
      combo: 1,
      stockRemaining: 0,
      chain: [card(2, '♣', 4), card(1, '♠', 5)],
      remainingTableauCount: 10,
      chainBonus: { bonus: 0, parts: [], patternFired: false, patternFiredCount: 0, roleFired: [] },
      isFirstPlayOfWave: false,
      effectiveStairMinLen: params.scoring.stairMinLen,
      effectiveSuitColorMinLen: params.scoring.suitColorMinLen,
      sameColumnStreak: 1,
      totalColumnsEmptiedThisWave: 0,
      maxComboThisWave: 1,
      flushActiveThisCombo: false,
      columnSweepActiveThisWave: false,
      drawContinueCountThisChain: 0,
      mercyActiveNextCombo: false,
      ...overrides,
    }
  }

  test('兆し: 場札残数がm以下なら倍算、超えていれば不発動', () => {
    const fired = applyItemEffects('gained', 100, ['omen'], ctx({ remainingTableauCount: params.talismans.omen.m }), params)
    expect(fired.value).toBe(100 * params.talismans.omen.x)
    const notFired = applyItemEffects('gained', 100, ['omen'], ctx({ remainingTableauCount: params.talismans.omen.m + 1 }), params)
    expect(notFired.value).toBe(100)
  })

  test('三日月: 場札残数がm以下なら倍算', () => {
    const result = applyItemEffects('gained', 100, ['crescent'], ctx({ remainingTableauCount: params.talismans.crescent.m }), params)
    expect(result.value).toBe(100 * params.talismans.crescent.x)
  })
})

describe('applyItemEffects (グループ6: 役・パターン成立状況系)', () => {
  const params = DEFAULT_PARAMS
  function ctx(overrides: Partial<ItemEffectContext> = {}): ItemEffectContext {
    return {
      card: card(1, '♠', 5),
      previousFoundation: card(2, '♣', 4),
      combo: 1,
      stockRemaining: 0,
      chain: [card(2, '♣', 4), card(1, '♠', 5)],
      remainingTableauCount: 10,
      chainBonus: { bonus: 0, parts: [], patternFired: false, patternFiredCount: 0, roleFired: [] },
      isFirstPlayOfWave: false,
      effectiveStairMinLen: params.scoring.stairMinLen,
      effectiveSuitColorMinLen: params.scoring.suitColorMinLen,
      sameColumnStreak: 1,
      totalColumnsEmptiedThisWave: 0,
      maxComboThisWave: 1,
      flushActiveThisCombo: false,
      columnSweepActiveThisWave: false,
      drawContinueCountThisChain: 0,
      mercyActiveNextCombo: false,
      ...overrides,
    }
  }

  test('恩寵: いずれかの役ボーナスが成立していれば倍算', () => {
    const chainBonus = { bonus: 0, parts: [], patternFired: false, patternFiredCount: 0, roleFired: [{ name: 'flush' as const, usedWild: false, amount: 0 }] }
    const fired = applyItemEffects('gained', 100, ['blessing'], ctx({ chainBonus }), params)
    expect(fired.value).toBe(100 * params.talismans.blessing.x)
    const notFired = applyItemEffects('gained', 100, ['blessing'], ctx(), params)
    expect(notFired.value).toBe(100)
  })

  test('集中: 同ランクによる役が含まれていれば倍算', () => {
    const chainBonus = { bonus: 0, parts: [], patternFired: false, patternFiredCount: 0, roleFired: [{ name: 'sameRank' as const, usedWild: false, amount: 0 }] }
    const fired = applyItemEffects('gained', 100, ['focus'], ctx({ chainBonus }), params)
    expect(fired.value).toBe(100 * params.talismans.focus.x)
    const otherRole = { bonus: 0, parts: [], patternFired: false, patternFiredCount: 0, roleFired: [{ name: 'flush' as const, usedWild: false, amount: 0 }] }
    const notFired = applyItemEffects('gained', 100, ['focus'], ctx({ chainBonus: otherRole }), params)
    expect(notFired.value).toBe(100)
  })

  test('瑠璃: 役ボーナス2種類以上の同時発生でも倍算(従来の役のみパターンでも成立)', () => {
    const chainBonus = {
      bonus: 0, parts: [], patternFired: false, patternFiredCount: 0,
      roleFired: [{ name: 'flush' as const, usedWild: false, amount: 0 }, { name: 'sameRank' as const, usedWild: false, amount: 0 }],
    }
    const fired = applyItemEffects('gained', 100, ['lapis'], ctx({ chainBonus }), params)
    expect(fired.value).toBe(100 * params.talismans.lapis.x)
  })

  test('瑠璃: 役ボーナス1種類のみでは発動しない', () => {
    const singleRole = { bonus: 0, parts: [], patternFired: false, patternFiredCount: 0, roleFired: [{ name: 'flush' as const, usedWild: false, amount: 0 }] }
    const notFired = applyItemEffects('gained', 100, ['lapis'], ctx({ chainBonus: singleRole }), params)
    expect(notFired.value).toBe(100)
  })

  test('瑠璃: 役ボーナス1種類+パターンボーナス1種類の組み合わせでも倍算', () => {
    const roleAndPattern = {
      bonus: 0, parts: [], patternFired: true, patternFiredCount: 1,
      roleFired: [{ name: 'flush' as const, usedWild: false, amount: 0 }],
    }
    const fired = applyItemEffects('gained', 100, ['lapis'], ctx({ chainBonus: roleAndPattern }), params)
    expect(fired.value).toBe(100 * params.talismans.lapis.x)
  })

  test('瑠璃: パターンボーナス2種類(同スート+階段)の組み合わせのみでも倍算', () => {
    const bothPatterns = { bonus: 0, parts: [], patternFired: true, patternFiredCount: 2, roleFired: [] }
    const fired = applyItemEffects('gained', 100, ['lapis'], ctx({ chainBonus: bothPatterns }), params)
    expect(fired.value).toBe(100 * params.talismans.lapis.x)
  })

  test('瑠璃: パターンボーナス1種類のみでは発動しない', () => {
    const singlePattern = { bonus: 0, parts: [], patternFired: true, patternFiredCount: 1, roleFired: [] }
    const notFired = applyItemEffects('gained', 100, ['lapis'], ctx({ chainBonus: singlePattern }), params)
    expect(notFired.value).toBe(100)
  })

  test('翡翠: 役の成立にワイルドが使われていれば加算', () => {
    const chainBonus = { bonus: 0, parts: [], patternFired: false, patternFiredCount: 0, roleFired: [{ name: 'flush' as const, usedWild: true, amount: 0 }] }
    const fired = applyItemEffects('gained', 100, ['jade'], ctx({ chainBonus }), params)
    expect(fired.value).toBe(100 + params.talismans.jade.n)
    const withoutWild = { bonus: 0, parts: [], patternFired: false, patternFiredCount: 0, roleFired: [{ name: 'flush' as const, usedWild: false, amount: 0 }] }
    const notFired = applyItemEffects('gained', 100, ['jade'], ctx({ chainBonus: withoutWild }), params)
    expect(notFired.value).toBe(100)
  })

  test('無心: 役もパターンも無ければ倍算', () => {
    const fired = applyItemEffects('gained', 100, ['emptyMind'], ctx(), params)
    expect(fired.value).toBe(100 * params.talismans.emptyMind.x)
    const withPattern = { bonus: 0, parts: [], patternFired: true, patternFiredCount: 1, roleFired: [] }
    const notFired = applyItemEffects('gained', 100, ['emptyMind'], ctx({ chainBonus: withPattern }), params)
    expect(notFired.value).toBe(100)
  })
})

describe('applyItemEffects (グループ7: コンボ内位置系)', () => {
  const params = DEFAULT_PARAMS
  function ctx(overrides: Partial<ItemEffectContext> = {}): ItemEffectContext {
    return {
      card: card(1, '♠', 5),
      previousFoundation: card(2, '♣', 4),
      combo: 1,
      stockRemaining: 0,
      chain: [card(2, '♣', 4), card(1, '♠', 5)],
      remainingTableauCount: 10,
      chainBonus: { bonus: 0, parts: [], patternFired: false, patternFiredCount: 0, roleFired: [] },
      isFirstPlayOfWave: false,
      effectiveStairMinLen: params.scoring.stairMinLen,
      effectiveSuitColorMinLen: params.scoring.suitColorMinLen,
      sameColumnStreak: 1,
      totalColumnsEmptiedThisWave: 0,
      maxComboThisWave: 1,
      flushActiveThisCombo: false,
      columnSweepActiveThisWave: false,
      drawContinueCountThisChain: 0,
      mercyActiveNextCombo: false,
      ...overrides,
    }
  }

  test('序章: コンボ1枚目のみ加算', () => {
    const fired = applyItemEffects('gained', 100, ['prologue'], ctx({ combo: 1 }), params)
    expect(fired.value).toBe(100 + params.talismans.prologue.n)
    const notFired = applyItemEffects('gained', 100, ['prologue'], ctx({ combo: 2 }), params)
    expect(notFired.value).toBe(100)
  })

  test('幕間: コンボがm枚目に達するたび加算', () => {
    const m = params.talismans.interlude.m
    const fired = applyItemEffects('gained', 100, ['interlude'], ctx({ combo: m * 2 }), params)
    expect(fired.value).toBe(100 + params.talismans.interlude.n)
    const notFired = applyItemEffects('gained', 100, ['interlude'], ctx({ combo: m + 1 }), params)
    expect(notFired.value).toBe(100)
  })

  test('朝露: ウェーブで最初にプレイしたカードのみ加算', () => {
    const fired = applyItemEffects('gained', 100, ['morningDew'], ctx({ isFirstPlayOfWave: true }), params)
    expect(fired.value).toBe(100 + params.talismans.morningDew.n)
    const notFired = applyItemEffects('gained', 100, ['morningDew'], ctx({ isFirstPlayOfWave: false }), params)
    expect(notFired.value).toBe(100)
  })
})

describe('applyItemEffects (グループ8: 無条件固定加算)', () => {
  const params = DEFAULT_PARAMS
  function ctx(overrides: Partial<ItemEffectContext> = {}): ItemEffectContext {
    return {
      card: card(1, '♠', 5),
      previousFoundation: card(2, '♣', 4),
      combo: 1,
      stockRemaining: 0,
      chain: [card(2, '♣', 4), card(1, '♠', 5)],
      remainingTableauCount: 10,
      chainBonus: { bonus: 0, parts: [], patternFired: false, patternFiredCount: 0, roleFired: [] },
      isFirstPlayOfWave: false,
      effectiveStairMinLen: params.scoring.stairMinLen,
      effectiveSuitColorMinLen: params.scoring.suitColorMinLen,
      sameColumnStreak: 1,
      totalColumnsEmptiedThisWave: 0,
      maxComboThisWave: 1,
      flushActiveThisCombo: false,
      columnSweepActiveThisWave: false,
      drawContinueCountThisChain: 0,
      mercyActiveNextCombo: false,
      ...overrides,
    }
  }

  test('小雨: 常にn点加算', () => {
    const result = applyItemEffects('gained', 100, ['drizzle'], ctx(), params)
    expect(result.value).toBe(100 + params.talismans.drizzle.n)
  })
})

describe('applyDirectEffects', () => {
  const params = DEFAULT_PARAMS

  function directCtx(overrides: Partial<DirectEffectContext> = {}): DirectEffectContext {
    return {
      comboBeforeReset: 0,
      hasPlayableColumns: true,
      roleFiredThisChain: false,
      remainingTableauCount: 10,
      combo: 1,
      colorHeld: false,
      ...overrides,
    }
  }

  test('未登録の護符は素通りする', () => {
    const result = applyDirectEffects('resetDirect', ['bridge'], directCtx(), params)
    expect(result.value).toBe(0)
  })

  test('沈着: 取れる場札が無ければresetDirectで加算', () => {
    const fired = applyDirectEffects('resetDirect', ['composure'], directCtx({ hasPlayableColumns: false }), params)
    expect(fired.value).toBe(params.talismans.composure.n)
    const notFired = applyDirectEffects('resetDirect', ['composure'], directCtx({ hasPlayableColumns: true }), params)
    expect(notFired.value).toBe(0)
  })

  test('冷静: 役が一つも成立していなければresetDirectで加算', () => {
    const fired = applyDirectEffects('resetDirect', ['clarity'], directCtx({ roleFiredThisChain: false }), params)
    expect(fired.value).toBe(params.talismans.clarity.n)
    const notFired = applyDirectEffects('resetDirect', ['clarity'], directCtx({ roleFiredThisChain: true }), params)
    expect(notFired.value).toBe(0)
  })

  test('残響: resetDirectでリセット前のコンボ数×nを加算', () => {
    const result = applyDirectEffects('resetDirect', ['echo'], directCtx({ comboBeforeReset: 5 }), params)
    expect(result.value).toBe(5 * params.talismans.echo.n)
  })

  test('沈着・冷静・残響は同時に発火しうる(合算される)', () => {
    const result = applyDirectEffects('resetDirect', ['composure', 'clarity', 'echo'], directCtx({ hasPlayableColumns: false, roleFiredThisChain: false, comboBeforeReset: 2 }), params)
    expect(result.value).toBe(params.talismans.composure.n + params.talismans.clarity.n + 2 * params.talismans.echo.n)
  })

  test('慢心: stockEmptyDirectで場札残数×xを加算', () => {
    const result = applyDirectEffects('stockEmptyDirect', ['arrogance'], directCtx({ remainingTableauCount: 7 }), params)
    expect(result.value).toBe(7 * params.talismans.arrogance.x)
  })

  test('流星: comboMilestoneDirectでコンボ数がちょうどcの時のみ加算', () => {
    const fired = applyDirectEffects('comboMilestoneDirect', ['shootingStar'], directCtx({ combo: params.talismans.shootingStar.c }), params)
    expect(fired.value).toBe(params.talismans.shootingStar.n)
    const notFired = applyDirectEffects('comboMilestoneDirect', ['shootingStar'], directCtx({ combo: params.talismans.shootingStar.c + 1 }), params)
    expect(notFired.value).toBe(0)
  })

  test('誠実: drawContinueDirectで同色パターン継続の時のみ加算', () => {
    const fired = applyDirectEffects('drawContinueDirect', ['sincerity'], directCtx({ colorHeld: true }), params)
    expect(fired.value).toBe(params.talismans.sincerity.n)
    const notFired = applyDirectEffects('drawContinueDirect', ['sincerity'], directCtx({ colorHeld: false }), params)
    expect(notFired.value).toBe(0)
  })

  test('gainedチャンネルの護符はdirectチャンネルには影響しない', () => {
    const result = applyDirectEffects('resetDirect', ['courage'], directCtx(), params)
    expect(result.value).toBe(0)
  })
})

describe('applyItemEffects (グループ9: 列選択の連続性)', () => {
  const params = DEFAULT_PARAMS
  function ctx(overrides: Partial<ItemEffectContext> = {}): ItemEffectContext {
    return {
      card: card(1, '♠', 5),
      previousFoundation: card(2, '♣', 4),
      combo: 1,
      stockRemaining: 0,
      chain: [card(2, '♣', 4), card(1, '♠', 5)],
      remainingTableauCount: 10,
      chainBonus: { bonus: 0, parts: [], patternFired: false, patternFiredCount: 0, roleFired: [] },
      isFirstPlayOfWave: false,
      effectiveStairMinLen: params.scoring.stairMinLen,
      effectiveSuitColorMinLen: params.scoring.suitColorMinLen,
      sameColumnStreak: 1,
      totalColumnsEmptiedThisWave: 0,
      maxComboThisWave: 1,
      flushActiveThisCombo: false,
      columnSweepActiveThisWave: false,
      drawContinueCountThisChain: 0,
      mercyActiveNextCombo: false,
      ...overrides,
    }
  }

  test('微風: 同一列連続2回目以降のみ、連続回数×nを加算', () => {
    const notFired = applyItemEffects('gained', 100, ['gentleBreeze'], ctx({ sameColumnStreak: 1 }), params)
    expect(notFired.value).toBe(100)
    const fired = applyItemEffects('gained', 100, ['gentleBreeze'], ctx({ sameColumnStreak: 3 }), params)
    expect(fired.value).toBe(100 + 3 * params.talismans.gentleBreeze.n)
  })

  test('共鳴: 同一列連続2回目以降のみ、連続回数×xで倍算', () => {
    const notFired = applyItemEffects('gained', 100, ['resonance'], ctx({ sameColumnStreak: 1 }), params)
    expect(notFired.value).toBe(100)
    const fired = applyItemEffects('gained', 100, ['resonance'], ctx({ sameColumnStreak: 3 }), params)
    expect(fired.value).toBe(100 * (1 + 3 * params.talismans.resonance.x))
  })
})

describe('applyItemEffects (グループ10: ウェーブ内累積state)', () => {
  const params = DEFAULT_PARAMS
  function ctx(overrides: Partial<ItemEffectContext> = {}): ItemEffectContext {
    return {
      card: card(1, '♠', 5),
      previousFoundation: card(2, '♣', 4),
      combo: 1,
      stockRemaining: 0,
      chain: [card(2, '♣', 4), card(1, '♠', 5)],
      remainingTableauCount: 10,
      chainBonus: { bonus: 0, parts: [], patternFired: false, patternFiredCount: 0, roleFired: [] },
      isFirstPlayOfWave: false,
      effectiveStairMinLen: params.scoring.stairMinLen,
      effectiveSuitColorMinLen: params.scoring.suitColorMinLen,
      sameColumnStreak: 1,
      totalColumnsEmptiedThisWave: 0,
      maxComboThisWave: 1,
      flushActiveThisCombo: false,
      columnSweepActiveThisWave: false,
      drawContinueCountThisChain: 0,
      mercyActiveNextCombo: false,
      ...overrides,
    }
  }

  test('蒼穹: ウェーブ内列一掃累計回数×xで倍算', () => {
    const result = applyItemEffects('gained', 100, ['azureSky'], ctx({ totalColumnsEmptiedThisWave: 4 }), params)
    expect(result.value).toBe(100 * (1 + 4 * params.talismans.azureSky.x))
  })

  test('琥珀: ウェーブ内最大到達コンボ数×xで倍算', () => {
    const result = applyItemEffects('gained', 100, ['amber'], ctx({ maxComboThisWave: 8 }), params)
    expect(result.value).toBe(100 * (1 + 8 * params.talismans.amber.x))
  })
})

describe('applyItemEffects (グループ16: 持続効果)', () => {
  const params = DEFAULT_PARAMS
  function ctx(overrides: Partial<ItemEffectContext> = {}): ItemEffectContext {
    return {
      card: card(1, '♠', 5),
      previousFoundation: card(2, '♣', 4),
      combo: 1,
      stockRemaining: 0,
      chain: [card(2, '♣', 4), card(1, '♠', 5)],
      remainingTableauCount: 10,
      chainBonus: { bonus: 0, parts: [], patternFired: false, patternFiredCount: 0, roleFired: [] },
      isFirstPlayOfWave: false,
      effectiveStairMinLen: params.scoring.stairMinLen,
      effectiveSuitColorMinLen: params.scoring.suitColorMinLen,
      sameColumnStreak: 1,
      totalColumnsEmptiedThisWave: 0,
      maxComboThisWave: 1,
      flushActiveThisCombo: false,
      columnSweepActiveThisWave: false,
      drawContinueCountThisChain: 0,
      mercyActiveNextCombo: false,
      ...overrides,
    }
  }

  test('情熱: フラッシュ成立中フラグが立っていれば倍算', () => {
    const fired = applyItemEffects('gained', 100, ['passion'], ctx({ flushActiveThisCombo: true }), params)
    expect(fired.value).toBe(100 * params.talismans.passion.x)
    const notFired = applyItemEffects('gained', 100, ['passion'], ctx({ flushActiveThisCombo: false }), params)
    expect(notFired.value).toBe(100)
  })

  test('闘志: 列一掃発生済みフラグが立っていれば倍算', () => {
    const fired = applyItemEffects('gained', 100, ['fightingSpirit'], ctx({ columnSweepActiveThisWave: true }), params)
    expect(fired.value).toBe(100 * params.talismans.fightingSpirit.x)
    const notFired = applyItemEffects('gained', 100, ['fightingSpirit'], ctx({ columnSweepActiveThisWave: false }), params)
    expect(notFired.value).toBe(100)
  })

  test('慈悲: mercyActiveNextComboが立っていれば倍算', () => {
    const fired = applyItemEffects('gained', 100, ['mercy'], ctx({ mercyActiveNextCombo: true }), params)
    expect(fired.value).toBe(100 * params.talismans.mercy.x)
    const notFired = applyItemEffects('gained', 100, ['mercy'], ctx({ mercyActiveNextCombo: false }), params)
    expect(notFired.value).toBe(100)
  })
})

describe('applyItemEffects (グループ12: 直感)', () => {
  const params = DEFAULT_PARAMS
  function ctx(overrides: Partial<ItemEffectContext> = {}): ItemEffectContext {
    return {
      card: card(1, '♠', 5),
      previousFoundation: card(2, '♣', 4),
      combo: 1,
      stockRemaining: 0,
      chain: [card(2, '♣', 4), card(1, '♠', 5)],
      remainingTableauCount: 10,
      chainBonus: { bonus: 0, parts: [], patternFired: false, patternFiredCount: 0, roleFired: [] },
      isFirstPlayOfWave: false,
      effectiveStairMinLen: params.scoring.stairMinLen,
      effectiveSuitColorMinLen: params.scoring.suitColorMinLen,
      sameColumnStreak: 1,
      totalColumnsEmptiedThisWave: 0,
      maxComboThisWave: 1,
      flushActiveThisCombo: false,
      columnSweepActiveThisWave: false,
      drawContinueCountThisChain: 0,
      mercyActiveNextCombo: false,
      ...overrides,
    }
  }

  test('直感: drawContinueCountThisChainが0より大きい時のみ、その回数×xで倍算', () => {
    const notFired = applyItemEffects('gained', 100, ['intuition'], ctx({ drawContinueCountThisChain: 0 }), params)
    expect(notFired.value).toBe(100)
    const fired = applyItemEffects('gained', 100, ['intuition'], ctx({ drawContinueCountThisChain: 3 }), params)
    expect(fired.value).toBe(100 * (1 + 3 * params.talismans.intuition.x))
  })
})

describe('applyItemEffects (グループ17: 刻限)', () => {
  const params = DEFAULT_PARAMS
  function ctx(overrides: Partial<ItemEffectContext> = {}): ItemEffectContext {
    return {
      card: card(1, '♠', 5),
      previousFoundation: card(2, '♣', 4),
      combo: 1,
      stockRemaining: 0,
      chain: [card(2, '♣', 4), card(1, '♠', 5)],
      remainingTableauCount: 10,
      chainBonus: { bonus: 0, parts: [], patternFired: false, patternFiredCount: 0, roleFired: [] },
      isFirstPlayOfWave: false,
      effectiveStairMinLen: params.scoring.stairMinLen,
      effectiveSuitColorMinLen: params.scoring.suitColorMinLen,
      sameColumnStreak: 1,
      totalColumnsEmptiedThisWave: 0,
      maxComboThisWave: 1,
      flushActiveThisCombo: false,
      columnSweepActiveThisWave: false,
      drawContinueCountThisChain: 0,
      mercyActiveNextCombo: false,
      ...overrides,
    }
  }

  test('刻限: 山札残り枚数×nを加算', () => {
    const notFired = applyItemEffects('gained', 100, ['deadline'], ctx({ stockRemaining: 0 }), params)
    expect(notFired.value).toBe(100)
    const fired = applyItemEffects('gained', 100, ['deadline'], ctx({ stockRemaining: 5 }), params)
    expect(fired.value).toBe(100 + 5 * params.talismans.deadline.n)
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
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['naive'], standardDeckComposition())
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
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], standardDeckComposition())
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
    const withoutIntuition = drawStock(DEFAULT_PARAMS, wave, ['naive'], standardDeckComposition())
    const withIntuition = drawStock(DEFAULT_PARAMS, wave, ['naive', 'intuition'], standardDeckComposition())
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
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['naive'], standardDeckComposition())
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
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['naive', 'golden'], standardDeckComposition())
    expect(next.combo).toBe(4)
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
    const earthThenProtection = drawStock(DEFAULT_PARAMS, wave, ['naive', 'earth', 'protection'], standardDeckComposition())
    const protectionThenEarth = drawStock(DEFAULT_PARAMS, wave, ['naive', 'protection', 'earth'], standardDeckComposition())
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
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, items, standardDeckComposition())
    expect(next.combo).toBe(3)
    const multiplier = 1 + (3 - 1) * DEFAULT_PARAMS.scoring.comboMultiplierStep
    const base = DEFAULT_PARAMS.scoring.basePoint + DEFAULT_PARAMS.scoring.suitBonus
    const expectedGained = Math.floor((base + DEFAULT_PARAMS.talismans.springBreeze.n) * multiplier)
    expect(next.lastGain?.points).toBe(expectedGained)
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
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['promise'], standardDeckComposition())
    expect(next.stock[next.stock.length - 1]).toEqual(card(2, '♠', 6))
  })

  test('約束を持たなければ山札の並び順は変わらない(既存挙動)', () => {
    const wave = makeWave({
      stock: [card(2, '♠', 6), card(1, '♦', 1), card(3, '♣', 2)],
      chain: [card(9, '♠', 4), card(10, '♠', 5)],
      linked: true,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], standardDeckComposition())
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

describe('applyDirectEffects', () => {
  test('発動した護符の内訳(parts)を護符名付きで返す', () => {
    const ctx: DirectEffectContext = {
      comboBeforeReset: 3,
      hasPlayableColumns: false,
      roleFiredThisChain: false,
      remainingTableauCount: 0,
      combo: 0,
      colorHeld: false,
    }
    const result = applyDirectEffects('resetDirect', ['composure'], ctx, DEFAULT_PARAMS)
    expect(result.value).toBe(DEFAULT_PARAMS.talismans.composure.n)
    expect(result.parts).toContain(`沈着+${DEFAULT_PARAMS.talismans.composure.n}`)
  })

  test('発動しなかった護符はpartsに含まれない', () => {
    const ctx: DirectEffectContext = {
      comboBeforeReset: 3,
      hasPlayableColumns: true, // composureは不発火条件
      roleFiredThisChain: true, // clarityは不発火条件
      remainingTableauCount: 0,
      combo: 0,
      colorHeld: false,
    }
    const result = applyDirectEffects('resetDirect', ['composure', 'clarity'], ctx, DEFAULT_PARAMS)
    expect(result.value).toBe(0)
    expect(result.parts).toEqual([])
  })

  test('該当チャンネルの護符を複数所持していれば両方partsに含まれる', () => {
    const ctx: DirectEffectContext = {
      comboBeforeReset: 2,
      hasPlayableColumns: false,
      roleFiredThisChain: false,
      remainingTableauCount: 0,
      combo: 0,
      colorHeld: false,
    }
    const result = applyDirectEffects('resetDirect', ['composure', 'clarity'], ctx, DEFAULT_PARAMS)
    expect(result.value).toBe(DEFAULT_PARAMS.talismans.composure.n + DEFAULT_PARAMS.talismans.clarity.n)
    expect(result.parts).toContain(`沈着+${DEFAULT_PARAMS.talismans.composure.n}`)
    expect(result.parts).toContain(`冷静+${DEFAULT_PARAMS.talismans.clarity.n}`)
  })
})
