// src/lib/game/shidasu/relics.test.ts
import { describe, test, it, expect } from 'vitest'
import { RELIC_POOL, relicName, relicDesc, relicTsukumokaDesc, relicPriceMultiplier, itemMaxCapacity, riteMaxCapacity, revelationOracleMaxCapacity } from './relics'
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

describe('所持上限ヘルパー', () => {
  it('itemMaxCapacity: 招き布袋像なしならparams.items.maxItemsそのまま', () => {
    const run = { relics: [] } as unknown as RunState
    expect(itemMaxCapacity(DEFAULT_PARAMS, run)).toBe(DEFAULT_PARAMS.items.maxItems)
  })
  it('itemMaxCapacity: 招き布袋像(未付喪化)で+1', () => {
    const run = { relics: [{ id: 'manekiHoteizo' as const, tsukumoka: false }] } as unknown as RunState
    expect(itemMaxCapacity(DEFAULT_PARAMS, run)).toBe(DEFAULT_PARAMS.items.maxItems + 1)
  })
  it('itemMaxCapacity: 招き布袋像(付喪化)で+2', () => {
    const run = { relics: [{ id: 'manekiHoteizo' as const, tsukumoka: true }] } as unknown as RunState
    expect(itemMaxCapacity(DEFAULT_PARAMS, run)).toBe(DEFAULT_PARAMS.items.maxItems + 2)
  })
  it('riteMaxCapacity: 破魔矢なしなら3', () => {
    const run = { relics: [] } as unknown as RunState
    expect(riteMaxCapacity(DEFAULT_PARAMS, run)).toBe(3)
  })
  it('riteMaxCapacity: 破魔矢(付喪化)で3+2', () => {
    const run = { relics: [{ id: 'hamaya' as const, tsukumoka: true }] } as unknown as RunState
    expect(riteMaxCapacity(DEFAULT_PARAMS, run)).toBe(5)
  })
  it('revelationOracleMaxCapacity: 千羽鶴なしなら2', () => {
    const run = { relics: [] } as unknown as RunState
    expect(revelationOracleMaxCapacity(DEFAULT_PARAMS, run)).toBe(2)
  })
  it('revelationOracleMaxCapacity: 千羽鶴(付喪化)で2+2', () => {
    const run = { relics: [{ id: 'senbazuru' as const, tsukumoka: true }] } as unknown as RunState
    expect(revelationOracleMaxCapacity(DEFAULT_PARAMS, run)).toBe(4)
  })
})
