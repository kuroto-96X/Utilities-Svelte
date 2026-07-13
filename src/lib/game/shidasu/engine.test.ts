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
  ITEM_NAMES,
  itemDesc,
  applyItemEffects,
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
  forceStockTop,
} from './engine'
import type { Card, WaveState, RunState, ItemId } from './types'
import { DEFAULT_PARAMS } from './params'
import { createRng } from './deck'

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
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], 1)
    expect(wave.tableau).toHaveLength(DEFAULT_PARAMS.layout.cols)
    wave.tableau.forEach(col => expect(col).toHaveLength(DEFAULT_PARAMS.layout.rows))
  })

  test('comboStreakColumnLengthsは各列ともrows枚で初期化される', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], 1)
    expect(wave.comboStreakColumnLengths).toEqual(wave.tableau.map(() => DEFAULT_PARAMS.layout.rows))
  })

  test('山札+場札+foundationで52枚になる(アイテムなし)', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], 1)
    const tableauCount = wave.tableau.reduce((n, c) => n + c.length, 0)
    expect(tableauCount + wave.stock.length + 1).toBe(52)
  })

  test('初期状態: チェーンにfoundationが1枚(由来はdraw)、スコア0、コンボ0、列一掃0、演出フラグnull', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], 1)
    expect(wave.score).toBe(0)
    expect(wave.combo).toBe(0)
    expect(wave.chain).toEqual([wave.foundation])
    expect(wave.chainOrigin).toEqual(['draw'])
    expect(wave.linked).toBe(false)
    expect(wave.columnsEmptiedThisCombo).toBe(0)
    expect(wave.lastDrawEffect).toBeNull()
    expect(wave.status).toBe('playing')
  })

  test('同じシードなら同じ結果になる(決定的、アイテムを持っていても山札生成自体は変わらない)', () => {
    const a = startWave(DEFAULT_PARAMS, 0, 0, ['bridge'], 123)
    const b = startWave(DEFAULT_PARAMS, 0, 0, ['bridge'], 123)
    expect(a).toEqual(b)
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

  test('寛容の護符所持時: 列一掃の条件が「残りrows-columnSweepRelaxCards枚以下から1コンボで空に」に緩和される', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 9)]],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows - DEFAULT_PARAMS.items.columnSweepRelaxCards, 1],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['grace'], 1000000, 0)
    expect(next.columnsEmptiedThisCombo).toBe(1)
    expect(next.lastGain?.parts).toContain(`列一掃+${scoring.columnSweepBonus}`)
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

  test('gainedチャンネルの護符(springBreeze)は♣を取った時、得点に加算される', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['springBreeze'], 1000000, 0)
    expect(next.score).toBe(scoring.basePoint + DEFAULT_PARAMS.talismans.springBreeze.n)
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
})

describe('drawStock', () => {
  test('山札が空なら何もしない', () => {
    const wave = makeWave({ stock: [] })
    expect(drawStock(DEFAULT_PARAMS, wave, [])).toBe(wave)
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
    const next = drawStock(DEFAULT_PARAMS, wave, [])
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
    const next = drawStock(DEFAULT_PARAMS, wave, [])
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
    const next = drawStock(DEFAULT_PARAMS, wave, [])
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
    const next = drawStock(DEFAULT_PARAMS, wave, [])
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
    const next = drawStock(DEFAULT_PARAMS, wave, ['bridge']) // stairRelaxedMinLen=3
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
    const next = drawStock(DEFAULT_PARAMS, wave, [])
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
    const next = drawStock(DEFAULT_PARAMS, wave, [])
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
    const next = drawStock(DEFAULT_PARAMS, wave, [])
    expect(next.lastGain).toBeNull()
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

  function ctx(overrides: Partial<{ card: Card; previousFoundation: Card; combo: number; stockRemaining: number }> = {}) {
    return {
      card: card(1, '♠', 5),
      previousFoundation: card(2, '♣', 4),
      combo: 1,
      stockRemaining: 0,
      ...overrides,
    }
  }

  test('未登録の護符は素通りする', () => {
    expect(applyItemEffects('gained', 100, ['bridge'], ctx(), params)).toBe(100)
  })

  test('patience: clearBonusチャンネルで残り山札数×xを加算', () => {
    const result = applyItemEffects('clearBonus', 1000, ['patience'], ctx({ stockRemaining: 4 }), params)
    expect(result).toBe(1000 + 4 * params.talismans.patience.x)
  })

  test('purify: clearBonusチャンネルでnを加算', () => {
    const result = applyItemEffects('clearBonus', 1000, ['purify'], ctx(), params)
    expect(result).toBe(1000 + params.talismans.purify.n)
  })

  test('temperance: clearBonusチャンネルで残り山札数×x分倍算', () => {
    const result = applyItemEffects('clearBonus', 1000, ['temperance'], ctx({ stockRemaining: 4 }), params)
    expect(result).toBe(1000 * (1 + 4 * params.talismans.temperance.x))
  })

  test('springBreeze: ♣を取った時のみgainedにnを加算', () => {
    const withClub = applyItemEffects('gained', 100, ['springBreeze'], ctx({ card: card(1, '♣', 5) }), params)
    expect(withClub).toBe(100 + params.talismans.springBreeze.n)
    const withoutClub = applyItemEffects('gained', 100, ['springBreeze'], ctx({ card: card(1, '♥', 5) }), params)
    expect(withoutClub).toBe(100)
  })

  test('summerBreeze: ♦を取った時のみgainedにnを加算', () => {
    const result = applyItemEffects('gained', 100, ['summerBreeze'], ctx({ card: card(1, '♦', 5) }), params)
    expect(result).toBe(100 + params.talismans.summerBreeze.n)
  })

  test('autumnBreeze: ♥を取った時のみgainedにnを加算', () => {
    const result = applyItemEffects('gained', 100, ['autumnBreeze'], ctx({ card: card(1, '♥', 5) }), params)
    expect(result).toBe(100 + params.talismans.autumnBreeze.n)
  })

  test('winterBreeze: ♠を取った時のみgainedにnを加算', () => {
    const result = applyItemEffects('gained', 100, ['winterBreeze'], ctx({ card: card(1, '♠', 5) }), params)
    expect(result).toBe(100 + params.talismans.winterBreeze.n)
  })

  test('kinship: 直前が♥以外から今回♥を取った時のみnを加算', () => {
    const triggered = applyItemEffects('gained', 100, ['kinship'], ctx({ previousFoundation: card(2, '♣', 4), card: card(1, '♥', 5) }), params)
    expect(triggered).toBe(100 + params.talismans.kinship.n)
    const notTriggered = applyItemEffects('gained', 100, ['kinship'], ctx({ previousFoundation: card(2, '♥', 4), card: card(1, '♥', 5) }), params)
    expect(notTriggered).toBe(100)
  })

  test('thaw: 直前が♠から今回♠以外を取った時のみnを加算', () => {
    const triggered = applyItemEffects('gained', 100, ['thaw'], ctx({ previousFoundation: card(2, '♠', 4), card: card(1, '♥', 5) }), params)
    expect(triggered).toBe(100 + params.talismans.thaw.n)
    const notTriggered = applyItemEffects('gained', 100, ['thaw'], ctx({ previousFoundation: card(2, '♠', 4), card: card(1, '♠', 6) }), params)
    expect(notTriggered).toBe(100)
  })

  test('dusk: 直前が赤から今回黒を取った時のみnを加算', () => {
    const triggered = applyItemEffects('gained', 100, ['dusk'], ctx({ previousFoundation: card(2, '♥', 4), card: card(1, '♠', 5) }), params)
    expect(triggered).toBe(100 + params.talismans.dusk.n)
    const notTriggered = applyItemEffects('gained', 100, ['dusk'], ctx({ previousFoundation: card(2, '♠', 4), card: card(1, '♣', 5) }), params)
    expect(notTriggered).toBe(100)
  })

  test('dawn: 直前が黒から今回赤を取った時のみnを加算', () => {
    const triggered = applyItemEffects('gained', 100, ['dawn'], ctx({ previousFoundation: card(2, '♠', 4), card: card(1, '♥', 5) }), params)
    expect(triggered).toBe(100 + params.talismans.dawn.n)
    const notTriggered = applyItemEffects('gained', 100, ['dawn'], ctx({ previousFoundation: card(2, '♥', 4), card: card(1, '♦', 5) }), params)
    expect(notTriggered).toBe(100)
  })

  test('wit: ワイルドを取った時のみnを加算', () => {
    const triggered = applyItemEffects('gained', 100, ['wit'], ctx({ card: card(1, '★', 0, true) }), params)
    expect(triggered).toBe(100 + params.talismans.wit.n)
    const notTriggered = applyItemEffects('gained', 100, ['wit'], ctx({ card: card(1, '♠', 5) }), params)
    expect(notTriggered).toBe(100)
  })

  test('courage: コンボ数×xで倍算', () => {
    const result = applyItemEffects('gained', 100, ['courage'], ctx({ combo: 5 }), params)
    expect(result).toBe(100 * (1 + 5 * params.talismans.courage.x))
  })

  test('daybreak: コンボ数がc以下の時のみx倍', () => {
    const triggered = applyItemEffects('gained', 100, ['daybreak'], ctx({ combo: params.talismans.daybreak.c }), params)
    expect(triggered).toBe(100 * params.talismans.daybreak.x)
    const notTriggered = applyItemEffects('gained', 100, ['daybreak'], ctx({ combo: params.talismans.daybreak.c + 1 }), params)
    expect(notTriggered).toBe(100)
  })

  test('twilight: コンボ数がc以上の時のみx倍', () => {
    const triggered = applyItemEffects('gained', 100, ['twilight'], ctx({ combo: params.talismans.twilight.c }), params)
    expect(triggered).toBe(100 * params.talismans.twilight.x)
    const notTriggered = applyItemEffects('gained', 100, ['twilight'], ctx({ combo: params.talismans.twilight.c - 1 }), params)
    expect(notTriggered).toBe(100)
  })

  test('cheerful: コンボ数が偶数の時のみnを加算', () => {
    const triggered = applyItemEffects('gained', 100, ['cheerful'], ctx({ combo: 4 }), params)
    expect(triggered).toBe(100 + params.talismans.cheerful.n)
    const notTriggered = applyItemEffects('gained', 100, ['cheerful'], ctx({ combo: 5 }), params)
    expect(notTriggered).toBe(100)
  })

  test('conscience: コンボ数が奇数の時のみnを加算', () => {
    const triggered = applyItemEffects('gained', 100, ['conscience'], ctx({ combo: 5 }), params)
    expect(triggered).toBe(100 + params.talismans.conscience.n)
    const notTriggered = applyItemEffects('gained', 100, ['conscience'], ctx({ combo: 4 }), params)
    expect(notTriggered).toBe(100)
  })

  test('morningMist: コンボ数がc未満なら1/x倍、c以上ならx倍', () => {
    const below = applyItemEffects('gained', 100, ['morningMist'], ctx({ combo: params.talismans.morningMist.c - 1 }), params)
    expect(below).toBe(100 / params.talismans.morningMist.x)
    const aboveOrEqual = applyItemEffects('gained', 100, ['morningMist'], ctx({ combo: params.talismans.morningMist.c }), params)
    expect(aboveOrEqual).toBe(100 * params.talismans.morningMist.x)
  })

  test('複数護符は所持順(配列順)に適用される(加算→倍算と倍算→加算で結果が変わることを確認)', () => {
    const order1 = applyItemEffects('clearBonus', 1000, ['purify', 'temperance'], ctx({ stockRemaining: 4 }), params)
    const order2 = applyItemEffects('clearBonus', 1000, ['temperance', 'purify'], ctx({ stockRemaining: 4 }), params)
    expect(order1).not.toBe(order2)
    expect(order1).toBe((1000 + params.talismans.purify.n) * (1 + 4 * params.talismans.temperance.x))
    expect(order2).toBe(1000 * (1 + 4 * params.talismans.temperance.x) + params.talismans.purify.n)
  })

  test('gainedチャンネルの護符はclearBonusチャンネル計算には適用されない', () => {
    const result = applyItemEffects('clearBonus', 1000, ['springBreeze'], ctx({ card: card(1, '♣', 5) }), params)
    expect(result).toBe(1000)
  })
})

describe('rollItemOffer', () => {
  test('未所持のアイテムを全て返す(プールの上限は3件だが、実際のプール数がそれ以下ならそのまま返す)', () => {
    const offer = rollItemOffer([], createRng(1))
    expect([...offer].sort()).toEqual(['bridge', 'grace'])
  })

  test('既に持っているアイテムは種類を問わず候補から除外される', () => {
    const offer = rollItemOffer(['bridge'], createRng(1))
    expect(offer).toEqual(['grace'])
  })

  test('全て持っていれば候補は空になる', () => {
    const offer = rollItemOffer(['bridge', 'grace'], createRng(1))
    expect(offer).toEqual([])
  })
})

describe('ITEM_POOL / ITEM_NAMES / itemDesc', () => {
  test('2種類のアイテムが定義されている', () => {
    expect(ITEM_POOL).toHaveLength(2)
    ITEM_POOL.forEach(id => expect(ITEM_NAMES[id]).toBeTruthy())
  })

  test('itemDescはパラメータの数値を埋め込んだ説明文を返す', () => {
    expect(itemDesc('bridge', DEFAULT_PARAMS)).toContain(String(DEFAULT_PARAMS.scoring.stairMinLen))
    expect(itemDesc('bridge', DEFAULT_PARAMS)).toContain(String(DEFAULT_PARAMS.items.stairRelaxedMinLen))
    expect(itemDesc('grace', DEFAULT_PARAMS)).toContain(String(DEFAULT_PARAMS.layout.rows))
    expect(itemDesc('grace', DEFAULT_PARAMS)).toContain(String(DEFAULT_PARAMS.layout.rows - DEFAULT_PARAMS.items.columnSweepRelaxCards))
  })

  test('新規追加した18個の護符も名前と説明文を持つ', () => {
    const newIds: ItemId[] = [
      'patience', 'purify', 'temperance',
      'springBreeze', 'summerBreeze', 'autumnBreeze', 'winterBreeze',
      'kinship', 'thaw', 'dusk', 'dawn', 'wit',
      'courage', 'daybreak', 'twilight', 'cheerful', 'conscience', 'morningMist',
    ]
    newIds.forEach(id => {
      expect(ITEM_NAMES[id]).toBeTruthy()
      expect(itemDesc(id, DEFAULT_PARAMS)).toBeTruthy()
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
    expect(next.offer).toHaveLength(2)
    expect([...next.offer].sort()).toEqual(['bridge', 'grace'])
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
    expect(result).toEqual({ bonus: 0, parts: [] })
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
