// src/lib/game/shidasu/itemEffects.test.ts
import { describe, test, expect } from 'vitest'
import { applyItemEffects } from './itemEffects'
import { DEFAULT_PARAMS } from './params'
import { card, ctx } from './testHelpers'

describe('applyItemEffects', () => {
  const params = DEFAULT_PARAMS

  test('未登録の護符は素通りし、内訳(parts)も空になる', () => {
    const result = applyItemEffects('gained', 100, ['bridge'], ctx(), params)
    expect(result.value).toBe(100)
    expect(result.parts).toEqual([])
  })

  test('複数護符は所持順(配列順)に適用され、内訳もその順で並ぶ(加算→倍算と倍算→加算で結果が変わることを確認)', () => {
    const order1 = applyItemEffects('clearBonus', 1000, ['purify', 'temperance'], ctx({ stockRemaining: 4 }), params)
    const order2 = applyItemEffects('clearBonus', 1000, ['temperance', 'purify'], ctx({ stockRemaining: 4 }), params)
    expect(order1.value).not.toBe(order2.value)
    expect(order1.value).toBe((1000 + params.talismans.purify.n) * (1 + 4 * params.talismans.temperance.x))
    expect(order2.value).toBe(1000 * (1 + 4 * params.talismans.temperance.x) + params.talismans.purify.n)
    expect(order1.parts.map(p => p.text)).toEqual([`浄化+${params.talismans.purify.n}`, `節制×${1 + 4 * params.talismans.temperance.x}`])
    expect(order2.parts.map(p => p.text)).toEqual([`節制×${1 + 4 * params.talismans.temperance.x}`, `浄化+${params.talismans.purify.n}`])
  })

  test('gainedチャンネルの護符はclearBonusチャンネル計算には適用されない', () => {
    const result = applyItemEffects('clearBonus', 1000, ['springBreeze'], ctx({ card: card(1, '♣', 5) }), params)
    expect(result.value).toBe(1000)
    expect(result.parts).toEqual([])
  })

  test('護符効果パーツにはitemIdが付与される', () => {
    const result = applyItemEffects('clearBonus', 1000, ['purify', 'temperance'], ctx({ stockRemaining: 4 }), params)
    expect(result.parts.map(p => p.itemId)).toEqual(['purify', 'temperance'])
  })
})

describe('水鏡(waterMirror): 左隣の護符の効果をもう一度発動させる', () => {
  const params = DEFAULT_PARAMS

  test('左隣が忍耐(全消しボーナスへの固定加算)の場合、忍耐の効果が2回分適用される', () => {
    const result = applyItemEffects('clearBonus', 0, ['patience', 'waterMirror'], ctx({ stockRemaining: 5 }), params)
    const perApplication = 5 * params.talismans.patience.x
    expect(result.value).toBe(perApplication * 2)
  })

  test('水鏡のエコー分パーツのitemIdは水鏡自身(waterMirror)になる', () => {
    const result = applyItemEffects('clearBonus', 0, ['patience', 'waterMirror'], ctx({ stockRemaining: 5 }), params)
    expect(result.parts.map(p => p.itemId)).toEqual(['patience', 'waterMirror'])
  })

  test('水鏡が先頭にある場合(左隣が存在しない)、何も追加されない', () => {
    const result = applyItemEffects('clearBonus', 0, ['waterMirror', 'patience'], ctx({ stockRemaining: 5 }), params)
    const perApplication = 5 * params.talismans.patience.x
    expect(result.value).toBe(perApplication)
  })

  test('水鏡を所持していなければ通常通り1回分のみ適用される', () => {
    const result = applyItemEffects('clearBonus', 0, ['patience'], ctx({ stockRemaining: 5 }), params)
    const perApplication = 5 * params.talismans.patience.x
    expect(result.value).toBe(perApplication)
  })
})
