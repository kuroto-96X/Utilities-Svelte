// src/lib/game/culmen/engine.test.ts
import { describe, test, expect } from 'vitest'
import { isRed, isFace, rankLabel, evaluatePattern } from './engine'
import type { Card } from './types'
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
