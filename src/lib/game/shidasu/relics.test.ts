// src/lib/game/shidasu/relics.test.ts
import { describe, test, it, expect } from 'vitest'
import { RELIC_POOL, relicName, relicDesc, relicTsukumokaDesc, relicPriceMultiplier } from './relics'
import { DEFAULT_PARAMS } from './params'
import type { RunState } from './types'

describe('relics', () => {
  test('relicName/relicDesc/relicTsukumokaDescはparams.relicsを参照する', () => {
    expect(relicName('manekiNeko', DEFAULT_PARAMS)).toBe(DEFAULT_PARAMS.relics.manekiNeko.name)
    expect(relicDesc('manekiNeko', DEFAULT_PARAMS)).toBe(DEFAULT_PARAMS.relics.manekiNeko.desc)
    expect(relicTsukumokaDesc('manekiNeko', DEFAULT_PARAMS)).toBe(DEFAULT_PARAMS.relics.manekiNeko.tsukumokaDesc)
  })
})

describe('RELIC_POOL(第1弾13候補)', () => {
  const expectedIds = [
    'manekiNeko', 'fukuDaruma', 'kumade', 'juzu',
    'manekiHoteizo', 'hamaya', 'senbazuru', 'fukuzasa',
    'kaiunKokeshi', 'engiKozuchi', 'engiSuzu', 'senjafuda', 'soroban',
  ] as const

  it('13候補すべてがRELIC_POOLに含まれる(placeholderは除去済み)', () => {
    for (const id of expectedIds) {
      expect(RELIC_POOL).toContain(id)
    }
    expect(RELIC_POOL).not.toContain('placeholder')
    expect(RELIC_POOL).toHaveLength(13)
  })

  it('全13候補がparams.relicsに定義されている', () => {
    for (const id of expectedIds) {
      expect(DEFAULT_PARAMS.relics[id]).toBeDefined()
      expect(DEFAULT_PARAMS.relics[id].name.length).toBeGreaterThan(0)
      expect(DEFAULT_PARAMS.relics[id].price).toBeGreaterThan(0)
    }
  })
})

describe('relicPriceMultiplier(招き猫)', () => {
  const baseRun = { relics: [] } as unknown as RunState

  it('招き猫を所持していなければ倍率1', () => {
    expect(relicPriceMultiplier(DEFAULT_PARAMS, baseRun)).toBe(1)
  })

  it('招き猫(未付喪化)所持時は(100-25)/100=0.75', () => {
    const run = { relics: [{ id: 'manekiNeko' as const, tsukumoka: false }] } as unknown as RunState
    expect(relicPriceMultiplier(DEFAULT_PARAMS, run)).toBeCloseTo(0.75)
  })

  it('招き猫(付喪化済み)所持時は(100-50)/100=0.5', () => {
    const run = { relics: [{ id: 'manekiNeko' as const, tsukumoka: true }] } as unknown as RunState
    expect(relicPriceMultiplier(DEFAULT_PARAMS, run)).toBeCloseTo(0.5)
  })
})
