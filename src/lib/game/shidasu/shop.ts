// src/lib/game/shidasu/shop.ts
import type { RunState, ItemId, RelicId, ShopState, ShopIndividualSlot, ShopPackSlot, ShopSlotKind } from './types'
import type { ShidasuParams } from './params'
import { ITEM_POOL } from './items'
import { RITE_POOL } from './rites'
import { REVELATION_POOL } from './revelations'
import { ORACLE_POOL } from './oracles'
import { RELIC_POOL, relicPriceMultiplier, relicSellBonusMultiplier, individualSlotCount, packSlotCount, packOfferCountBonus } from './relics'
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

// params.shop.packCatalogをシャッフルし、先頭packSlotCount(params, run)件を選ぶ(均等抽選)。選ばれたエントリの
// name・priceはこの時点でShopPackSlotにスナップショットとしてコピーする(招き猫所持時は割引後の価格をスナップショットする)。
// offerCountは縁起小槌所持時のボーナス分を加算してスナップショットする。
function rollPackSlots(params: ShidasuParams, run: RunState, rand: () => number): ShopPackSlot[] {
  const entries = [...params.shop.packCatalog]
  shuffleInPlace(entries, rand)
  const multiplier = relicPriceMultiplier(params, run)
  const offerBonus = packOfferCountBonus(params, run)
  return entries.slice(0, packSlotCount(params, run)).map(e => ({ packKind: e.packKind, offerCount: e.offerCount + offerBonus, pickCount: e.pickCount, name: e.name, price: Math.round(e.price * multiplier), sold: false }))
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
  const individualCount = individualSlotCount(params, run)
  const individual: ShopIndividualSlot[] = Array.from({ length: individualCount }, () => rollIndividualSlot(run, usedItemIds, rand))
  return { individual, packs: rollPackSlots(params, run, rand), relic: rollRelicSlot(run, rand) }
}

export function itemBuyPrice(params: ShidasuParams, run: RunState, id: ItemId): number {
  return Math.round(params.shop.itemPrice[params.talismans[id].rarity].buy * relicPriceMultiplier(params, run))
}

export function itemSellPrice(params: ShidasuParams, run: RunState, id: ItemId): number {
  return Math.round(params.shop.itemPrice[params.talismans[id].rarity].sell * relicSellBonusMultiplier(params, run))
}

export function riteBuyPrice(params: ShidasuParams, run: RunState): number {
  return Math.round(params.shop.ritePrice.buy * relicPriceMultiplier(params, run))
}

export function riteSellPrice(params: ShidasuParams, run: RunState): number {
  return Math.round(params.shop.ritePrice.sell * relicSellBonusMultiplier(params, run))
}

export function revelationBuyPrice(params: ShidasuParams, run: RunState): number {
  return Math.round(params.shop.revelationPrice.buy * relicPriceMultiplier(params, run))
}

export function revelationSellPrice(params: ShidasuParams, run: RunState): number {
  return Math.round(params.shop.revelationPrice.sell * relicSellBonusMultiplier(params, run))
}

export function oracleBuyPrice(params: ShidasuParams, run: RunState): number {
  return Math.round(params.shop.oraclePrice.buy * relicPriceMultiplier(params, run))
}

export function oracleSellPrice(params: ShidasuParams, run: RunState): number {
  return Math.round(params.shop.oraclePrice.sell * relicSellBonusMultiplier(params, run))
}

export function relicBuyPrice(params: ShidasuParams, run: RunState, id: RelicId): number {
  return Math.round(params.relics[id].price * relicPriceMultiplier(params, run))
}
