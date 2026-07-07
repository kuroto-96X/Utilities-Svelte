// src/lib/game/culmen/engine.test.ts
import { describe, test, expect } from 'vitest'
import {
  isRed,
  isFace,
  rankLabel,
  evaluatePattern,
  isPlayable,
  getPlayableColumns,
  remainingCount,
  startWave,
  playCard,
  drawStock,
} from './engine'
import type { Card, WaveState } from './types'
import { DEFAULT_PARAMS } from './params'

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

describe('evaluatePattern', () => {
  const scoring = DEFAULT_PARAMS.scoring

  test('直前の札がない場合はボーナス0', () => {
    const result = evaluatePattern(scoring, null, false, card(1, '♠', 5), 0, 1)
    expect(result).toEqual({ bonus: 0, parts: [], newStairDir: 0, newStairLen: 1 })
  })

  test('同スートはsuitBonusが付く', () => {
    const prev = card(1, '♠', 5)
    const result = evaluatePattern(scoring, prev, false, card(2, '♠', 6), 0, 1)
    expect(result.bonus).toBe(10)
    expect(result.parts).toEqual(['同スート+10'])
  })

  test('スート違いだが同色はcolorBonusが付く', () => {
    const prev = card(1, '♥', 5)
    const result = evaluatePattern(scoring, prev, false, card(2, '♦', 6), 0, 1)
    expect(result.bonus).toBe(5)
    expect(result.parts).toEqual(['同色+5'])
  })

  test('スートも色も違う場合はボーナス0(階段も不成立なら)', () => {
    const prev = card(1, '♠', 5)
    const result = evaluatePattern(scoring, prev, false, card(2, '♥', 3), 0, 1)
    expect(result.bonus).toBe(0)
    expect(result.parts).toEqual([])
  })

  test('5→6→7で3枚目に階段ボーナスが付く', () => {
    // 1枚目→2枚目: 5→6 (方向+1、長さ2、閾値3未満なのでボーナスなし)
    const step1 = evaluatePattern(scoring, card(1, '♠', 5), false, card(2, '♣', 6), 0, 1)
    expect(step1.newStairDir).toBe(1)
    expect(step1.newStairLen).toBe(2)
    expect(step1.parts.some(p => p.startsWith('階段'))).toBe(false)
    // 2枚目→3枚目: 6→7 (方向維持、長さ3、閾値到達でボーナス)
    const step2 = evaluatePattern(scoring, card(2, '♣', 6), false, card(3, '♦', 7), step1.newStairDir, step1.newStairLen)
    expect(step2.newStairLen).toBe(3)
    expect(step2.bonus).toBe(15)
    expect(step2.parts).toContain('階段3 +15')
  })

  test('5→6→5では階段は成立しない(方向反転で長さ2に戻る)', () => {
    const step1 = evaluatePattern(scoring, card(1, '♠', 5), false, card(2, '♣', 6), 0, 1)
    const step2 = evaluatePattern(scoring, card(2, '♣', 6), false, card(3, '♦', 5), step1.newStairDir, step1.newStairLen)
    expect(step2.newStairDir).toBe(-1)
    expect(step2.newStairLen).toBe(2)
    expect(step2.parts.some(p => p.startsWith('階段'))).toBe(false)
  })

  test('K→A→2はループ跨ぎで階段継続と判定される', () => {
    // K(13)→A(1): 差-12は+1に正規化
    const step1 = evaluatePattern(scoring, card(1, '♠', 13), false, card(2, '♣', 1), 0, 1)
    expect(step1.newStairDir).toBe(1)
    expect(step1.newStairLen).toBe(2)
    // A(1)→2: 差+1、方向維持で長さ3、ボーナス発生
    const step2 = evaluatePattern(scoring, card(2, '♣', 1), false, card(3, '♦', 2), step1.newStairDir, step1.newStairLen)
    expect(step2.newStairLen).toBe(3)
    expect(step2.bonus).toBe(15)
  })

  test('ワイルド直後はwildSuitBonusが無条件で付く', () => {
    const result = evaluatePattern(scoring, card(1, '★', 0, true), true, card(2, '♠', 9), 0, 1)
    expect(result.bonus).toBe(10)
    expect(result.parts).toEqual(['★同スート+10'])
    expect(result.newStairDir).toBe(0)
    expect(result.newStairLen).toBe(1)
  })

  test('ワイルド直後でも進行中の階段があれば延長・ボーナスも加算される', () => {
    // 進行中の階段: 方向+1、長さ2の状態でワイルドをまたいで次の札が来た場合
    const result = evaluatePattern(scoring, card(1, '★', 0, true), true, card(2, '♠', 9), 1, 2)
    expect(result.newStairDir).toBe(1)
    expect(result.newStairLen).toBe(3)
    expect(result.bonus).toBe(10 + 15) // wildSuitBonus + stairBonus
    expect(result.parts).toEqual(['★同スート+10', '階段3 +15'])
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
    stairDir: 0,
    stairLen: 1,
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
  function baseWave(overrides: Partial<WaveState> = {}): WaveState {
    return makeWave({
      foundation: card(0, '♠', 5),
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      ...overrides,
    })
  }

  test('取れない列を指定した場合は何も変わらない', () => {
    const wave = baseWave()
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000, 1) // 列1(2)は取れない
    expect(next).toBe(wave)
  })

  test('基本点×コンボで加点され、場札とチェーンが更新される', () => {
    const wave = baseWave()
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000, 0)
    expect(next.combo).toBe(1)
    expect(next.score).toBe(DEFAULT_PARAMS.scoring.basePoint * 1)
    expect(next.foundation).toEqual(card(1, '♣', 6))
    expect(next.chain).toEqual([card(1, '♣', 6)])
    expect(next.tableau[0]).toEqual([])
  })

  test('「紅の目利き」所持時、赤札の基礎点が加算される(内訳表示には出ない)', () => {
    const wave = baseWave({ tableau: [[card(1, '♥', 6)], [card(2, '♦', 2)]] })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['red5'], 1000, 0)
    expect(next.score).toBe(DEFAULT_PARAMS.scoring.basePoint + DEFAULT_PARAMS.items.redBonusValue)
    expect(next.lastGain?.parts).toEqual([])
  })

  test('「宮廷の紋章」所持時、絵札の基礎点が加算される', () => {
    const wave = baseWave({ tableau: [[card(1, '♣', 4)], [card(2, '♣', 11)]], foundation: card(0, '♣', 12) })
    // rank差 12→11 = 1 なので取れる
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['face10'], 1000, 1)
    expect(next.score).toBe(DEFAULT_PARAMS.scoring.basePoint + DEFAULT_PARAMS.items.faceBonusValue)
  })

  test('場札が0枚になったら全消しボーナスが加算されendReason=fullClear', () => {
    const wave = baseWave({ tableau: [[card(1, '♣', 6)]] })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 100000, 0)
    expect(next.tableau.reduce((n, c) => n + c.length, 0)).toBe(0)
    expect(next.status).toBe('ended')
    expect(next.endReason).toBe('fullClear')
    expect(next.score).toBe(DEFAULT_PARAMS.scoring.basePoint + DEFAULT_PARAMS.scoring.clearBonus)
  })

  test('「完全消去」所持時は全消しボーナスにさらに加算される', () => {
    const wave = baseWave({ tableau: [[card(1, '♣', 6)]] })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['clear300'], 100000, 0)
    expect(next.score).toBe(
      DEFAULT_PARAMS.scoring.basePoint + DEFAULT_PARAMS.scoring.clearBonus + DEFAULT_PARAMS.items.fullClearItemBonus
    )
  })

  test('スコアが目標に達したらendReason=targetでstatus=ended', () => {
    const wave = baseWave()
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 5, 0) // basePoint(10) >= target(5)
    expect(next.status).toBe('ended')
    expect(next.endReason).toBe('target')
  })

  test('status が playing でない場合は何もしない', () => {
    const wave = baseWave({ status: 'ended', endReason: 'target' })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000, 0)
    expect(next).toBe(wave)
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
