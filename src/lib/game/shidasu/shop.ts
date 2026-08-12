// src/lib/game/shidasu/shop.ts
import type { RunState, ItemId, RelicId, ShopState, ShopIndividualSlot, ShopPackSlot, ShopSlotKind } from './types'
import type { ShidasuParams } from './params'
import { ITEM_POOL } from './items'
import { RITE_POOL } from './rites'
import { REVELATION_POOL } from './revelations'
import { ORACLE_POOL } from './oracles'
import { RELIC_POOL } from './relics'
import { shuffleInPlace } from './deck'

const SHOP_SLOT_KINDS: ShopSlotKind[] = ['item', 'rite', 'revelation', 'oracle']

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

// params.shop.packCatalogをシャッフルし、先頭2件を選ぶ(均等抽選)。選ばれたエントリの
// name・priceはこの時点でShopPackSlotにスナップショットとしてコピーする。
function rollPackSlots(params: ShidasuParams, rand: () => number): ShopPackSlot[] {
  const entries = [...params.shop.packCatalog]
  shuffleInPlace(entries, rand)
  return entries.slice(0, 2).map(e => ({ packKind: e.packKind, offerCount: e.offerCount, pickCount: e.pickCount, name: e.name, price: e.price, sold: false }))
}

// 未所持のレリックからランダムに1つ選ぶ。未所持のレリックが無ければnull(ショップ画面で枠自体を非表示にする)
function rollRelicSlot(run: RunState, rand: () => number): { id: RelicId; sold: boolean } | null {
  const ownedIds = new Set(run.relics.map(r => r.id))
  const available = RELIC_POOL.filter(id => !ownedIds.has(id))
  if (available.length === 0) return null
  const id = available[Math.floor(rand() * available.length)]
  return { id, sold: false }
}

export function rollShop(params: ShidasuParams, run: RunState, rand: () => number = Math.random): ShopState {
  const usedItemIds = new Set<ItemId>()
  const individual: ShopIndividualSlot[] = [
    rollIndividualSlot(run, usedItemIds, rand),
    rollIndividualSlot(run, usedItemIds, rand),
    rollIndividualSlot(run, usedItemIds, rand),
  ]
  return { individual, packs: rollPackSlots(params, rand), relic: rollRelicSlot(run, rand) }
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

export function relicBuyPrice(params: ShidasuParams, id: RelicId): number {
  return params.relics[id].price
}
