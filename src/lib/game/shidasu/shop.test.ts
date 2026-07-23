// src/lib/game/shidasu/shop.test.ts
import { describe, test, expect } from 'vitest'
import { rollShop, itemBuyPrice, itemSellPrice, riteBuyPrice, riteSellPrice, revelationBuyPrice, revelationSellPrice, oracleBuyPrice, oracleSellPrice, packPrice, PACK_DEFINITIONS } from './shop'
import { DEFAULT_PARAMS } from './params'
import { createInitialRun } from './engine'
import { createRng } from './deck'
import { ITEM_POOL } from './items'
import { RITE_POOL } from './rites'
import { REVELATION_POOL } from './revelations'
import { ORACLE_POOL } from './oracles'

describe('rollShop', () => {
  test('バラ売り3枠・福袋2枠を返す', () => {
    const shop = rollShop(createInitialRun(), createRng(1))
    expect(shop.individual).toHaveLength(3)
    expect(shop.packs).toHaveLength(2)
    shop.individual.forEach(slot => expect(slot.sold).toBe(false))
    shop.packs.forEach(slot => expect(slot.sold).toBe(false))
  })

  test('バラ売り枠のitem種別idはITEM_POOLに含まれ、rite/revelation/oracleも各プールに含まれる', () => {
    const shop = rollShop(createInitialRun(), createRng(3))
    shop.individual.forEach(slot => {
      if (slot.kind === 'item') expect(ITEM_POOL).toContain(slot.id)
      if (slot.kind === 'rite') expect(RITE_POOL).toContain(slot.id)
      if (slot.kind === 'revelation') expect(REVELATION_POOL).toContain(slot.id)
      if (slot.kind === 'oracle') expect(ORACLE_POOL).toContain(slot.id)
    })
  })

  test('バラ売りitem枠は所持中の護符を候補から除外する', () => {
    const run = { ...createInitialRun(), items: ITEM_POOL.slice(0, ITEM_POOL.length - 1) as typeof ITEM_POOL }
    const shop = rollShop(run, createRng(1))
    const itemSlots = shop.individual.filter(s => s.kind === 'item')
    itemSlots.forEach(s => expect(run.items).not.toContain(s.id))
  })

  test('バラ売りitem枠は同一ショップ内で重複しない', () => {
    // 何度か抽選し、item種別の枠が複数あるケースでidが重複していないことを確認する
    for (let seed = 1; seed <= 20; seed++) {
      const shop = rollShop(createInitialRun(), createRng(seed))
      const itemIds = shop.individual.filter(s => s.kind === 'item').map(s => s.id)
      expect(new Set(itemIds).size).toBe(itemIds.length)
    }
  })

  test('福袋2枠はPACK_DEFINITIONSのパターンから重複なく選ばれる', () => {
    const shop = rollShop(createInitialRun(), createRng(1))
    const keys = shop.packs.map(p => `${p.packKind}-${p.offerCount}-${p.pickCount}`)
    expect(new Set(keys).size).toBe(2)
    shop.packs.forEach(p => {
      expect(PACK_DEFINITIONS.some(d => d.packKind === p.packKind && d.offerCount === p.offerCount && d.pickCount === p.pickCount)).toBe(true)
    })
  })
})

describe('価格関数', () => {
  test('itemBuyPrice/itemSellPriceはレアリティ別価格表を参照する', () => {
    const rarityC = ITEM_POOL.find(id => DEFAULT_PARAMS.talismans[id].rarity === 'C')!
    const rarityR = ITEM_POOL.find(id => DEFAULT_PARAMS.talismans[id].rarity === 'R')!
    expect(itemBuyPrice(DEFAULT_PARAMS, rarityC)).toBe(8)
    expect(itemSellPrice(DEFAULT_PARAMS, rarityC)).toBe(4)
    expect(itemBuyPrice(DEFAULT_PARAMS, rarityR)).toBe(30)
    expect(itemSellPrice(DEFAULT_PARAMS, rarityR)).toBe(15)
  })

  test('rite/revelation/oracleの価格', () => {
    expect(riteBuyPrice(DEFAULT_PARAMS)).toBe(12)
    expect(riteSellPrice(DEFAULT_PARAMS)).toBe(6)
    expect(revelationBuyPrice(DEFAULT_PARAMS)).toBe(18)
    expect(revelationSellPrice(DEFAULT_PARAMS)).toBe(9)
    expect(oracleBuyPrice(DEFAULT_PARAMS)).toBe(15)
    expect(oracleSellPrice(DEFAULT_PARAMS)).toBe(7)
  })

  test('packPriceはkind×offerCountの組み合わせで価格表を参照する', () => {
    expect(packPrice(DEFAULT_PARAMS, 'item', 3)).toBe(20)
    expect(packPrice(DEFAULT_PARAMS, 'item', 5)).toBe(30)
    expect(packPrice(DEFAULT_PARAMS, 'item', 7)).toBe(50)
    expect(packPrice(DEFAULT_PARAMS, 'revelation', 3)).toBe(25)
    expect(packPrice(DEFAULT_PARAMS, 'revelation', 5)).toBe(38)
    expect(packPrice(DEFAULT_PARAMS, 'revelation', 7)).toBe(63)
    expect(packPrice(DEFAULT_PARAMS, 'oracle', 3)).toBe(22)
    expect(packPrice(DEFAULT_PARAMS, 'oracle', 5)).toBe(33)
  })
})
