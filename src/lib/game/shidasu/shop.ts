// src/lib/game/shidasu/shop.ts
import type { RunState, ItemId, RoleName, ShopState, ShopIndividualSlot, ShopPackSlot, ShopSlotKind, PackOfferCount } from './types'
import type { ShidasuParams } from './params'
import { ITEM_POOL } from './items'
import { RITE_POOL } from './rites'
import { REVELATION_POOL } from './revelations'
import { ORACLE_POOL } from './oracles'
import { shuffleInPlace } from './deck'

const SHOP_SLOT_KINDS: ShopSlotKind[] = ['item', 'rite', 'revelation', 'oracle']

interface PackDefinition {
  packKind: ShopSlotKind
  offerCount: PackOfferCount
  pickCount: 1 | 2
}

// 護符/秘儀/天啓は3-1・5-1・7-2の3パターン、神託は3-1・5-1の2パターン(7-2は無し)。計11パターン。
export const PACK_DEFINITIONS: PackDefinition[] = [
  { packKind: 'item', offerCount: 3, pickCount: 1 },
  { packKind: 'item', offerCount: 5, pickCount: 1 },
  { packKind: 'item', offerCount: 7, pickCount: 2 },
  { packKind: 'rite', offerCount: 3, pickCount: 1 },
  { packKind: 'rite', offerCount: 5, pickCount: 1 },
  { packKind: 'rite', offerCount: 7, pickCount: 2 },
  { packKind: 'revelation', offerCount: 3, pickCount: 1 },
  { packKind: 'revelation', offerCount: 5, pickCount: 1 },
  { packKind: 'revelation', offerCount: 7, pickCount: 2 },
  { packKind: 'oracle', offerCount: 3, pickCount: 1 },
  { packKind: 'oracle', offerCount: 5, pickCount: 1 },
]

function poolFor(kind: ShopSlotKind): readonly string[] {
  if (kind === 'item') return ITEM_POOL
  if (kind === 'rite') return RITE_POOL
  if (kind === 'revelation') return REVELATION_POOL
  return ORACLE_POOL
}

// 護符のみ「所持中」「同一ショップ内の他のバラ売り枠」を除外する。秘儀・天啓・神託は重複所持が
// 許容される仕様のため除外しない。除外後の候補が尽きた場合(87種のプールでは実質起こり得ないが)は
// プール全体にフォールバックしてクラッシュを避ける。
function rollIndividualSlot(run: RunState, usedItemIds: Set<ItemId>, rand: () => number): ShopIndividualSlot {
  const kind = SHOP_SLOT_KINDS[Math.floor(rand() * SHOP_SLOT_KINDS.length)]
  if (kind === 'item') {
    const available = ITEM_POOL.filter(id => !run.items.includes(id) && !usedItemIds.has(id))
    const pool = available.length > 0 ? available : ITEM_POOL
    const id = pool[Math.floor(rand() * pool.length)]
    usedItemIds.add(id)
    return { kind, id, sold: false }
  }
  const pool = poolFor(kind)
  const id = pool[Math.floor(rand() * pool.length)]
  return { kind, id, sold: false }
}

function rollPackSlots(rand: () => number): ShopPackSlot[] {
  const defs = [...PACK_DEFINITIONS]
  shuffleInPlace(defs, rand)
  return defs.slice(0, 2).map(d => ({ packKind: d.packKind, offerCount: d.offerCount, pickCount: d.pickCount, sold: false }))
}

export function rollShop(run: RunState, rand: () => number = Math.random): ShopState {
  const usedItemIds = new Set<ItemId>()
  const individual: ShopIndividualSlot[] = [
    rollIndividualSlot(run, usedItemIds, rand),
    rollIndividualSlot(run, usedItemIds, rand),
    rollIndividualSlot(run, usedItemIds, rand),
  ]
  return { individual, packs: rollPackSlots(rand) }
}

export function itemBuyPrice(params: ShidasuParams, id: ItemId): number {
  return params.shop.itemPrice[params.talismans[id].rarity].buy
}

export function itemSellPrice(params: ShidasuParams, id: ItemId): number {
  return params.shop.itemPrice[params.talismans[id].rarity].sell
}

export function riteBuyPrice(params: ShidasuParams): number {
  return params.shop.ritePrice.buy
}

export function riteSellPrice(params: ShidasuParams): number {
  return params.shop.ritePrice.sell
}

export function revelationBuyPrice(params: ShidasuParams): number {
  return params.shop.revelationPrice.buy
}

export function revelationSellPrice(params: ShidasuParams): number {
  return params.shop.revelationPrice.sell
}

export function oracleBuyPrice(params: ShidasuParams): number {
  return params.shop.oraclePrice.buy
}

export function oracleSellPrice(params: ShidasuParams): number {
  return params.shop.oraclePrice.sell
}

// 福袋の価格。神託はsevenTwoパターンが存在しないため、rollPackSlots/PACK_DEFINITIONSの制約により
// packKind==='oracle'のときofferCountは3か5にしかならない前提でテーブル参照する。
export function packPrice(params: ShidasuParams, packKind: ShopSlotKind, offerCount: PackOfferCount): number {
  const key = offerCount === 3 ? 'threeOne' : offerCount === 5 ? 'fiveOne' : 'sevenTwo'
  const table = params.shop.packPrice[packKind] as unknown as Record<string, number>
  return table[key]
}
