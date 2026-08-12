// src/lib/game/shidasu/shop.test.ts
import { describe, test, expect } from 'vitest'
import { rollShop, itemBuyPrice, itemSellPrice, riteBuyPrice, riteSellPrice, revelationBuyPrice, revelationSellPrice, oracleBuyPrice, oracleSellPrice, relicBuyPrice } from './shop'
import { DEFAULT_PARAMS } from './params'
import { createInitialRun } from './engine'
import { createRng } from './deck'
import { ITEM_POOL } from './items'
import { RITE_POOL } from './rites'
import { REVELATION_POOL } from './revelations'
import { ORACLE_POOL } from './oracles'
import { RELIC_POOL } from './relics'

describe('rollShop', () => {
  test('バラ売り3枠・福袋2枠を返す', () => {
    const shop = rollShop(DEFAULT_PARAMS, createInitialRun(), createRng(1))
    expect(shop.individual).toHaveLength(3)
    expect(shop.packs).toHaveLength(2)
    shop.individual.forEach(slot => expect(slot.sold).toBe(false))
    shop.packs.forEach(slot => expect(slot.sold).toBe(false))
  })

  test('バラ売り枠のitem種別idはITEM_POOLに含まれ、rite/revelation/oracleも各プールに含まれる', () => {
    const shop = rollShop(DEFAULT_PARAMS, createInitialRun(), createRng(3))
    shop.individual.forEach(slot => {
      if (slot.kind === 'item') expect(ITEM_POOL).toContain(slot.id)
      if (slot.kind === 'rite') expect(RITE_POOL).toContain(slot.id)
      if (slot.kind === 'revelation') expect(REVELATION_POOL).toContain(slot.id)
      if (slot.kind === 'oracle') expect(ORACLE_POOL).toContain(slot.id)
    })
  })

  test('バラ売りitem枠は所持中の護符を候補から除外する', () => {
    const run = { ...createInitialRun(), items: ITEM_POOL.slice(0, ITEM_POOL.length - 1) as typeof ITEM_POOL }
    const shop = rollShop(DEFAULT_PARAMS, run, createRng(1))
    const itemSlots = shop.individual.filter(s => s.kind === 'item')
    itemSlots.forEach(s => expect(run.items).not.toContain(s.id))
  })

  test('バラ売りitem枠は同一ショップ内で重複しない', () => {
    // 何度か抽選し、item種別の枠が複数あるケースでidが重複していないことを確認する
    for (let seed = 1; seed <= 20; seed++) {
      const shop = rollShop(DEFAULT_PARAMS, createInitialRun(), createRng(seed))
      const itemIds = shop.individual.filter(s => s.kind === 'item').map(s => s.id)
      expect(new Set(itemIds).size).toBe(itemIds.length)
    }
  })

  test('福袋2枠はpackCatalogのエントリから重複なく選ばれ、name・priceがコピーされる', () => {
    const shop = rollShop(DEFAULT_PARAMS, createInitialRun(), createRng(1))
    const keys = shop.packs.map(p => `${p.packKind}-${p.offerCount}-${p.pickCount}`)
    expect(new Set(keys).size).toBe(2)
    shop.packs.forEach(p => {
      const entry = DEFAULT_PARAMS.shop.packCatalog.find(e => e.packKind === p.packKind && e.offerCount === p.offerCount && e.pickCount === p.pickCount)
      expect(entry).toBeDefined()
      expect(p.name).toBe(entry!.name)
      expect(p.price).toBe(entry!.price)
    })
  })

  test('レリック枠は未所持のレリックから1つ選ばれる', () => {
    const shop = rollShop(DEFAULT_PARAMS, createInitialRun(), createRng(1))
    expect(shop.relic).not.toBeNull()
    expect(RELIC_POOL).toContain(shop.relic!.id)
    expect(shop.relic!.sold).toBe(false)
  })

  test('全レリックを所持していればレリック枠はnull', () => {
    const run = { ...createInitialRun(), relics: RELIC_POOL.map(id => ({ id, tsukumoka: false })) }
    const shop = rollShop(DEFAULT_PARAMS, run, createRng(1))
    expect(shop.relic).toBeNull()
  })

  test('packCatalogにcardSetの3-1・5-1・7-2パターンが含まれる', () => {
    const cardSetEntries = DEFAULT_PARAMS.shop.packCatalog.filter(e => e.packKind === 'cardSet')
    expect(cardSetEntries).toHaveLength(3)
    expect(cardSetEntries.some(e => e.offerCount === 3 && e.pickCount === 1)).toBe(true)
    expect(cardSetEntries.some(e => e.offerCount === 5 && e.pickCount === 1)).toBe(true)
    expect(cardSetEntries.some(e => e.offerCount === 7 && e.pickCount === 2)).toBe(true)
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

  test('レリックの価格', () => {
    expect(relicBuyPrice(DEFAULT_PARAMS, 'maneki-neko')).toBe(25)
  })
})
