// src/lib/game/culmen/engine.test.ts
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
  isStuck,
  markStuck,
  rollItemOffer,
  ITEM_POOL,
  UNIQUE_ITEMS,
  ITEM_NAMES,
  itemDesc,
  createInitialRun,
  beginRun,
  resolveWaveEnd,
  pickItem,
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
  checkCompleteRun,
  evaluateChainBonus,
} from './engine'
import type { Card, WaveState, RunState } from './types'
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
    shieldLeft: 0,
    chain: [],
    linked: false,
    columnsEmptiedThisCombo: 0,
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

  test('山札+場札+foundationで52枚になる(アイテムなし)', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], 1)
    const tableauCount = wave.tableau.reduce((n, c) => n + c.length, 0)
    expect(tableauCount + wave.stock.length + 1).toBe(52)
  })

  test('初期状態: スコア0、コンボ0、チェーン空、階段未成立', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], 1)
    expect(wave.score).toBe(0)
    expect(wave.combo).toBe(0)
    expect(wave.chain).toEqual([])
    expect(wave.linked).toBe(false)
    expect(wave.stairDir).toBe(0)
    expect(wave.stairLen).toBe(1)
    expect(wave.status).toBe('playing')
  })

  test('「助走」所持時はコンボがstartComboから始まる', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, ['start1'], 1)
    expect(wave.combo).toBe(DEFAULT_PARAMS.items.startCombo)
  })

  test('「コンボシールド」所持数×shieldChargesPerPick がshieldLeftになる', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, ['shield', 'shield'], 1)
    expect(wave.shieldLeft).toBe(2 * DEFAULT_PARAMS.items.shieldChargesPerPick)
  })

  test('「厚めの山札」所持数に応じて山札が増える', () => {
    const base = startWave(DEFAULT_PARAMS, 0, 0, [], 1)
    const withItem = startWave(DEFAULT_PARAMS, 0, 0, ['stock5'], 1)
    expect(withItem.stock.length).toBe(base.stock.length + DEFAULT_PARAMS.items.extraStockCount)
  })

  test('「ワイルド★」所持数に応じて山札にワイルドが混入する', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, ['wild1', 'wild1'], 1)
    const wildCount = wave.stock.filter(c => c.wild).length
    expect(wildCount).toBe(2 * DEFAULT_PARAMS.items.wildPerPick)
  })

  test('同じシードなら同じ結果になる(決定的)', () => {
    const a = startWave(DEFAULT_PARAMS, 0, 0, ['stock5', 'wild1'], 123)
    const b = startWave(DEFAULT_PARAMS, 0, 0, ['stock5', 'wild1'], 123)
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
    // 6→7は階段方向+1・長さ2(閾値3未満でボーナスなし)、スート♣→♦で色も違う→パターンボーナス0
    expect(next.score).toBe(afterFirst.score + Math.floor(scoring.basePoint * 1.1))
  })

  test('「紅の目利き」所持時、赤札の基礎点が加算される(内訳表示には出ない)', () => {
    const wave = baseWave({ tableau: [[card(9, '♠', 1), card(1, '♥', 6)], [card(2, '♦', 2)]] })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['red5'], 1000000, 0)
    expect(next.score).toBe(scoring.basePoint + DEFAULT_PARAMS.items.redBonusValue)
    expect(next.lastGain?.parts).toEqual([])
  })

  test('「宮廷の紋章」所持時、絵札の基礎点が加算される', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 4)], [card(10, '♠', 2), card(2, '♣', 11)]],
      foundation: card(0, '♣', 12),
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['face10'], 1000000, 1)
    expect(next.score).toBe(scoring.basePoint + DEFAULT_PARAMS.items.faceBonusValue)
  })

  test('列を空にすると列一掃ボーナスが加算される(1列目)', () => {
    const wave = baseWave({ tableau: [[card(1, '♣', 6)], [card(2, '♦', 9)]] })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0)
    expect(next.columnsEmptiedThisCombo).toBe(1)
    expect(next.score).toBe(scoring.basePoint + scoring.columnSweepBonus * 1)
    expect(next.lastGain?.parts).toContain(`列一掃+${scoring.columnSweepBonus}`)
  })

  test('同じコンボ内で2列目を空にすると列一掃ボーナスが列数倍になる', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 6), // 列1(rank7)との差を1にして取れるようにする
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 7)]],
      columnsEmptiedThisCombo: 1,
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 1)
    expect(next.columnsEmptiedThisCombo).toBe(2)
    expect(next.lastGain?.parts).toContain(`列一掃+${scoring.columnSweepBonus * 2}`)
  })

  test('場札が0枚になったら全消しボーナス(clearBonus+残り山札×clearBonusPerStock)が加算されendReason=fullClear', () => {
    const wave = baseWave({ tableau: [[card(1, '♣', 6)]], stock: [card(9, '♠', 1), card(10, '♠', 2)] })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 100000000, 0)
    expect(next.tableau.reduce((n, c) => n + c.length, 0)).toBe(0)
    expect(next.status).toBe('ended')
    expect(next.endReason).toBe('fullClear')
    const expectedClearBonus = scoring.clearBonus + 2 * scoring.clearBonusPerStock
    expect(next.score).toBe(scoring.basePoint + scoring.columnSweepBonus * 1 + expectedClearBonus)
  })

  test('「完全消去」所持時は全消しボーナスにさらに加算される', () => {
    const wave = baseWave({ tableau: [[card(1, '♣', 6)]], stock: [] })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['clear300'], 100000000, 0)
    const expectedClearBonus = scoring.clearBonus + 0 * scoring.clearBonusPerStock + DEFAULT_PARAMS.items.fullClearItemBonus
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
})

describe('drawStock', () => {
  test('山札が空なら何もしない', () => {
    const wave = makeWave({ stock: [] })
    expect(drawStock(DEFAULT_PARAMS, wave, [])).toBe(wave)
  })

  test('通常時(コンボがbaseCombo以下、またはシールドなし): コンボ・チェーンがリセットされる', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 9)],
      combo: 3,
      shieldLeft: 0,
      chain: [card(2, '♣', 1)],
      linked: true,
      stairDir: 1,
      stairLen: 2,
    })
    const next = drawStock(DEFAULT_PARAMS, wave, [])
    expect(next.foundation).toEqual(card(1, '♠', 9))
    expect(next.combo).toBe(0)
    expect(next.chain).toEqual([])
    expect(next.linked).toBe(false)
    expect(next.stairDir).toBe(0)
    expect(next.stairLen).toBe(1)
    expect(next.stock).toEqual([])
  })

  test('「助走」所持時のリセット後コンボはstartComboになる', () => {
    const wave = makeWave({ stock: [card(1, '♠', 9)], combo: 3, shieldLeft: 0 })
    const next = drawStock(DEFAULT_PARAMS, wave, ['start1'])
    expect(next.combo).toBe(DEFAULT_PARAMS.items.startCombo)
  })

  test('ワイルドがめくれた場合: コンボは変わらずチェーンに追加される', () => {
    const wave = makeWave({
      stock: [card(1, '★', 0, true)],
      combo: 3,
      chain: [card(2, '♣', 5)],
      linked: true,
    })
    const next = drawStock(DEFAULT_PARAMS, wave, [])
    expect(next.combo).toBe(3)
    expect(next.chain).toEqual([card(2, '♣', 5), card(1, '★', 0, true)])
    expect(next.linked).toBe(true)
  })

  test('シールド発動時: コンボ維持・shieldLeft減少・得点は付かずチェーンに加わる', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 6)],
      combo: 2,
      shieldLeft: 1,
      chain: [card(2, '♣', 5)],
      linked: true,
      stairDir: 0,
      stairLen: 1,
    })
    const next = drawStock(DEFAULT_PARAMS, wave, [])
    expect(next.combo).toBe(2)
    expect(next.shieldLeft).toBe(0)
    expect(next.chain).toEqual([card(2, '♣', 5), card(1, '♣', 6)])
    expect(next.stairDir).toBe(1) // 5→6 で階段開始
    expect(next.stairLen).toBe(2)
  })

  test('コンボがbaseCombo以下ならシールドがあっても消費せずリセットする', () => {
    const wave = makeWave({ stock: [card(1, '♣', 6)], combo: 0, shieldLeft: 2 })
    const next = drawStock(DEFAULT_PARAMS, wave, [])
    expect(next.shieldLeft).toBe(2)
    expect(next.combo).toBe(0)
    expect(next.chain).toEqual([])
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

describe('rollItemOffer', () => {
  test('3種類を返す', () => {
    const offer = rollItemOffer([], createRng(1))
    expect(offer).toHaveLength(3)
    expect(new Set(offer).size).toBe(3)
  })

  test('取得済みのユニークアイテムは候補から除外される', () => {
    const owned = UNIQUE_ITEMS.slice(0, 3) // 4種のうち3種を所持済みにする
    const offer = rollItemOffer(owned, createRng(1))
    offer.forEach(id => expect(owned.includes(id)).toBe(false))
  })

  test('重複取得可能なアイテムは所持済みでも候補に残る', () => {
    const rand = createRng(2)
    const offer = rollItemOffer(['shield', 'shield', 'stock5'], rand)
    expect(offer.length).toBe(3)
  })
})

describe('ITEM_POOL / ITEM_NAMES / itemDesc', () => {
  test('7種類のアイテムが定義されている', () => {
    expect(ITEM_POOL).toHaveLength(7)
    ITEM_POOL.forEach(id => expect(ITEM_NAMES[id]).toBeTruthy())
  })

  test('itemDescはパラメータの数値を埋め込んだ説明文を返す', () => {
    expect(itemDesc('red5', DEFAULT_PARAMS)).toContain(String(DEFAULT_PARAMS.items.redBonusValue))
    expect(itemDesc('clear300', DEFAULT_PARAMS)).toContain(String(DEFAULT_PARAMS.items.fullClearItemBonus))
  })
})

describe('createInitialRun / beginRun', () => {
  test('createInitialRunはtitleフェーズでwave=null', () => {
    const run = createInitialRun()
    expect(run.phase).toBe('title')
    expect(run.wave).toBeNull()
    expect(run.items).toEqual([])
  })

  test('beginRunはplayingフェーズでステージ0・ウェーブ0から始まる', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    expect(run.phase).toBe('playing')
    expect(run.stageIndex).toBe(0)
    expect(run.waveIndex).toBe(0)
    expect(run.wave).not.toBeNull()
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

  test('ウェーブ1・2クリアならitemSelectになりofferが3件入る', () => {
    const run = endedRun({ waveIndex: 0 }, DEFAULT_PARAMS.stages[0].targets[0])
    const next = resolveWaveEnd(DEFAULT_PARAMS, run, createRng(5))
    expect(next.phase).toBe('itemSelect')
    expect(next.offer).toHaveLength(3)
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
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'itemSelect', waveIndex: 0, offer: ['shield', 'stock5', 'wild1'] }
    const next = pickItem(DEFAULT_PARAMS, run, 'shield', 2)
    expect(next.phase).toBe('playing')
    expect(next.items).toEqual(['shield'])
    expect(next.waveIndex).toBe(1)
    expect(next.wave?.shieldLeft).toBe(DEFAULT_PARAMS.items.shieldChargesPerPick)
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

  test('方向確立前にワイルドが来ても継続扱いにはならない(まだheld/未確立のまま)', () => {
    const chain = [card(1, '♠', 5), card(2, '★', 0, true), card(3, '♣', 9)]
    expect(analyzeStair(chain)).toEqual({ held: true, dir: 0, len: 1 })
  })

  test('方向確立後のワイルドは実際の差を問わず長さ+1で延長する', () => {
    const chain = [card(1, '♠', 5), card(2, '♣', 6), card(3, '★', 0, true), card(4, '♦', 9)]
    // 5→6で dir=1,len=2。ワイルドを挟んで9が来ても無条件でlen+1=3
    expect(analyzeStair(chain)).toEqual({ held: true, dir: 1, len: 3 })
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
})

describe('countSameRankBefore', () => {
  test('同ランクが無ければ0', () => {
    expect(countSameRankBefore([card(1, '♠', 5), card(2, '♥', 6)], 7)).toBe(0)
  })

  test('同ランクが3枚あれば3を返す', () => {
    const cards = [card(1, '♠', 5), card(2, '♥', 5), card(3, '♦', 5)]
    expect(countSameRankBefore(cards, 5)).toBe(3)
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
})

describe('evaluateChainBonus', () => {
  const scoring = DEFAULT_PARAMS.scoring

  test('コンボ1枚目(chainBefore空)はボーナス0', () => {
    const result = evaluateChainBonus(scoring, [], card(1, '♠', 5))
    expect(result).toEqual({ bonus: 0, parts: [] })
  })

  test('同スートが継続していればsuitBonusが付く', () => {
    const chainBefore = [card(1, '♠', 5)]
    const result = evaluateChainBonus(scoring, chainBefore, card(2, '♠', 6))
    expect(result.bonus).toBe(scoring.suitBonus)
    expect(result.parts).toEqual([`同スート+${scoring.suitBonus}`])
  })

  test('コンボ中に一度スートが崩れたら、以降同スートが来てもsuitBonusは付かない', () => {
    const chainBefore = [card(1, '♠', 5), card(2, '♥', 6), card(3, '♠', 7)] // 1枚目→2枚目でスート崩壊済み、3枚目は直前(2枚目...)
    const result = evaluateChainBonus(scoring, chainBefore, card(4, '♠', 8))
    expect(result.parts.some(p => p.startsWith('同スート'))).toBe(false)
  })

  test('ワイルド直後はwildSuitBonusのみ(同スート・同色は付かない)', () => {
    const chainBefore = [card(1, '★', 0, true)]
    const result = evaluateChainBonus(scoring, chainBefore, card(2, '♠', 9))
    expect(result.bonus).toBe(scoring.wildSuitBonus)
    expect(result.parts).toEqual([`★同スート+${scoring.wildSuitBonus}`])
  })

  test('階段が一貫して続いていればstairMinLen以上でstairBonusが付く', () => {
    const chainBefore = [card(1, '♠', 5), card(2, '♣', 6)]
    const result = evaluateChainBonus(scoring, chainBefore, card(3, '♦', 7))
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
