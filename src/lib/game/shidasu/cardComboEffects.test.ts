// src/lib/game/shidasu/cardComboEffects.test.ts
import { describe, test, expect } from 'vitest'
import { applyItemEffects } from './itemEffects'
import { DEFAULT_PARAMS } from './params'
import { card, ctx } from './testHelpers'

describe('applyItemEffects (グループ2+3: カード単体属性・コンボ数系)', () => {
  const params = DEFAULT_PARAMS

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
})
