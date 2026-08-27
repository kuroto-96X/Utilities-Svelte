// src/lib/game/shidasu/relics.test.ts
import { describe, test, it, expect } from 'vitest'
import { RELIC_POOL, relicName, relicDesc, relicTsukumokaDesc, relicPriceMultiplier, itemMaxCapacity, riteMaxCapacity, revelationOracleMaxCapacity, relicSellBonusMultiplier, individualSlotCount, packSlotCount, packOfferCountBonus, relicRerollCostStep, relicFirstRerollFree } from './relics'
import { DEFAULT_PARAMS } from './params'
import type { RunState } from './types'

describe('relics', () => {
  test('relicNameはparams.relicsを参照する', () => {
    expect(relicName('manekiNeko', DEFAULT_PARAMS)).toBe(DEFAULT_PARAMS.relics.manekiNeko.name)
  })

  test('relicDesc/relicTsukumokaDescはプレースホルダーを実際の数値に置換して返す', () => {
    expect(relicDesc('manekiNeko', DEFAULT_PARAMS)).toBe(
      `ショップの全商品の購入価格を${DEFAULT_PARAMS.relics.manekiNeko.discountPercent}%値引きする`
    )
    expect(relicTsukumokaDesc('manekiNeko', DEFAULT_PARAMS)).toBe(
      `ショップの全商品の購入価格を${DEFAULT_PARAMS.relics.manekiNeko.tsukumokaDiscountPercent}%値引きする`
    )
  })

  test('relicDesc/relicTsukumokaDescは13候補すべてで{...}形式の未解決プレースホルダーを残さない', () => {
    for (const id of RELIC_POOL) {
      const desc = relicDesc(id, DEFAULT_PARAMS)
      const tsukumokaDesc = relicTsukumokaDesc(id, DEFAULT_PARAMS)
      expect(desc).not.toMatch(/\{\w+\}/)
      expect(tsukumokaDesc).not.toMatch(/\{\w+\}/)
    }
  })

})

describe('RELIC_POOL(第1弾13候補のうち10候補、Wave終了時報酬3種は護符へ移行)', () => {
  const expectedIds = [
    'manekiNeko', 'fukuDaruma', 'kumade',
    'manekiHoteizo', 'hamaya', 'senbazuru', 'fukuzasa',
    'kaiunKokeshi', 'engiKozuchi', 'engiSuzu',
  ] as const

  it('10候補すべてがRELIC_POOLに含まれる(placeholderは除去済み)', () => {
    for (const id of expectedIds) {
      expect(RELIC_POOL).toContain(id)
    }
    expect(RELIC_POOL).toHaveLength(10)
  })

  it('全10候補がparams.relicsに定義されている', () => {
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

describe('relicSellBonusMultiplier(開運こけし)', () => {
  it('所持していなければ倍率1', () => {
    const run = { relics: [] } as unknown as RunState
    expect(relicSellBonusMultiplier(DEFAULT_PARAMS, run)).toBe(1)
  })
  it('未付喪化なら1.25', () => {
    const run = { relics: [{ id: 'kaiunKokeshi' as const, tsukumoka: false }] } as unknown as RunState
    expect(relicSellBonusMultiplier(DEFAULT_PARAMS, run)).toBeCloseTo(1.25)
  })
  it('付喪化済みなら1.5', () => {
    const run = { relics: [{ id: 'kaiunKokeshi' as const, tsukumoka: true }] } as unknown as RunState
    expect(relicSellBonusMultiplier(DEFAULT_PARAMS, run)).toBeCloseTo(1.5)
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

describe('ショップ枠数ヘルパー', () => {
  it('individualSlotCount: レリック無しなら3', () => {
    const run = { relics: [] } as unknown as RunState
    expect(individualSlotCount(DEFAULT_PARAMS, run)).toBe(3)
  })
  it('individualSlotCount: 熊手(未付喪化)で3+1', () => {
    const run = { relics: [{ id: 'kumade' as const, tsukumoka: false }] } as unknown as RunState
    expect(individualSlotCount(DEFAULT_PARAMS, run)).toBe(4)
  })
  it('individualSlotCount: 福笹(付喪化)で3+1', () => {
    const run = { relics: [{ id: 'fukuzasa' as const, tsukumoka: true }] } as unknown as RunState
    expect(individualSlotCount(DEFAULT_PARAMS, run)).toBe(4)
  })
  it('individualSlotCount: 熊手+福笹(付喪化)両方で3+1+1', () => {
    const run = { relics: [{ id: 'kumade' as const, tsukumoka: false }, { id: 'fukuzasa' as const, tsukumoka: true }] } as unknown as RunState
    expect(individualSlotCount(DEFAULT_PARAMS, run)).toBe(5)
  })
  it('packSlotCount: レリック無しなら2', () => {
    const run = { relics: [] } as unknown as RunState
    expect(packSlotCount(DEFAULT_PARAMS, run)).toBe(2)
  })
  it('packSlotCount: 福笹(未付喪化)で2+1', () => {
    const run = { relics: [{ id: 'fukuzasa' as const, tsukumoka: false }] } as unknown as RunState
    expect(packSlotCount(DEFAULT_PARAMS, run)).toBe(3)
  })
  it('packSlotCount: 熊手(付喪化)で2+1', () => {
    const run = { relics: [{ id: 'kumade' as const, tsukumoka: true }] } as unknown as RunState
    expect(packSlotCount(DEFAULT_PARAMS, run)).toBe(3)
  })
  it('packOfferCountBonus: 縁起小槌(未付喪化)で+1', () => {
    const run = { relics: [{ id: 'engiKozuchi' as const, tsukumoka: false }] } as unknown as RunState
    expect(packOfferCountBonus(DEFAULT_PARAMS, run)).toBe(1)
  })
  it('packOfferCountBonus: 縁起小槌(付喪化)で+2', () => {
    const run = { relics: [{ id: 'engiKozuchi' as const, tsukumoka: true }] } as unknown as RunState
    expect(packOfferCountBonus(DEFAULT_PARAMS, run)).toBe(2)
  })
})

describe('relicRerollCostStep(福だるま)', () => {
  it('所持していなければparams.shop.rerollCostStepそのまま', () => {
    const run = { relics: [] } as unknown as RunState
    expect(relicRerollCostStep(DEFAULT_PARAMS, run)).toBe(DEFAULT_PARAMS.shop.rerollCostStep)
  })
  it('福だるま所持時はn減る(0未満にはならない)', () => {
    const run = { relics: [{ id: 'fukuDaruma' as const, tsukumoka: false }] } as unknown as RunState
    expect(relicRerollCostStep(DEFAULT_PARAMS, run)).toBe(Math.max(0, DEFAULT_PARAMS.shop.rerollCostStep - DEFAULT_PARAMS.relics.fukuDaruma.n))
  })
})

describe('relicFirstRerollFree(福だるま付喪化)', () => {
  it('未付喪化なら常にfalse', () => {
    const run = { relics: [{ id: 'fukuDaruma' as const, tsukumoka: false }] } as unknown as RunState
    expect(relicFirstRerollFree(run)).toBe(false)
  })
  it('付喪化済みならtrue', () => {
    const run = { relics: [{ id: 'fukuDaruma' as const, tsukumoka: true }] } as unknown as RunState
    expect(relicFirstRerollFree(run)).toBe(true)
  })
})
