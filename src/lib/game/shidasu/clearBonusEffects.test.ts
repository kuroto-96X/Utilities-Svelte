// src/lib/game/shidasu/clearBonusEffects.test.ts
import { describe, test, expect } from 'vitest'
import { applyItemEffects } from './itemEffects'
import { DEFAULT_PARAMS } from './params'
import { ctx } from './testHelpers'

describe('applyItemEffects (グループ1: 全消しボーナス系)', () => {
  const params = DEFAULT_PARAMS

  test('patience: clearBonusチャンネルで残り山札数×xを加算し、内訳に「忍耐+n」が入る', () => {
    const result = applyItemEffects('clearBonus', 1000, ['patience'], ctx({ stockRemaining: 4 }), params)
    const add = 4 * params.talismans.patience.x
    expect(result.value).toBe(1000 + add)
    expect(result.parts.map(p => p.text)).toEqual([`忍耐+${add}`])
  })

  test('purify: clearBonusチャンネルでnを加算し、内訳に「浄化+n」が入る', () => {
    const result = applyItemEffects('clearBonus', 1000, ['purify'], ctx(), params)
    expect(result.value).toBe(1000 + params.talismans.purify.n)
    expect(result.parts.map(p => p.text)).toEqual([`浄化+${params.talismans.purify.n}`])
  })

  test('temperance: clearBonusチャンネルで残り山札数×x分倍算し、内訳に「節制×倍率」が入る', () => {
    const result = applyItemEffects('clearBonus', 1000, ['temperance'], ctx({ stockRemaining: 4 }), params)
    const factor = 1 + 4 * params.talismans.temperance.x
    expect(result.value).toBe(1000 * factor)
    expect(result.parts.map(p => p.text)).toEqual([`節制×${factor}`])
  })
})
