// src/lib/game/shidasu/items.ts
import type { ItemId } from './types'
import type { ShidasuParams } from './params'
import { rollOffer } from './deck'

// rollItemOfferは重み付けなしの完全均等抽選(レアリティによる出現率差は未実装)。
// docs/shidasu/done/shidasu-gofu-candidates.mdのC/U/Rレアリティ区分は検討用の分類であり、抽選確率には反映されていない。
export const ITEM_POOL: ItemId[] = [
  'bridge', 'grace',
  'patience', 'purify', 'temperance',
  'springBreeze', 'summerBreeze', 'autumnBreeze', 'winterBreeze',
  'kinship', 'thaw', 'dusk', 'dawn', 'wit',
  'courage', 'daybreak', 'twilight', 'cheerful', 'conscience', 'morningMist',
  'calm', 'serenity', 'destiny', 'fate', 'relief',
  'verdantGreen', 'gem', 'resolve', 'grail', 'moonlight', 'sunlight',
  'crown', 'cloverLeaf', 'coin', 'blade', 'chalice', 'balance', 'harmony',
  'nobility', 'tenacity', 'determination', 'cycle', 'reincarnation', 'majesty',
  'omen', 'crescent',
  'blessing', 'focus', 'lapis', 'jade', 'emptyMind',
  'prologue', 'interlude', 'morningDew',
  'drizzle',
  'eternity', 'abundance', 'silence', 'resilience',
  'gentleBreeze', 'resonance',
  'azureSky', 'amber',
  'composure', 'clarity', 'arrogance', 'echo', 'shootingStar',
  'naive', 'intuition', 'sincerity',
  'promise', 'regeneration',
  'benevolence', 'healing',
  'guidance',
  'passion', 'fightingSpirit',
  'sanctify', 'protection', 'earth', 'golden',
  'morningStar', 'mercy', 'mirror', 'deadline',
  'dedication', 'diligence', 'divineProtection',
  'fortitude',
  'waterMirror',
  'vow', 'pact', 'crimson', 'jetBlack',
  'silver',
  'discretion', 'frost',
]

export function itemName(id: ItemId, params: ShidasuParams): string {
  return params.talismans[id].name
}

export function itemDesc(id: ItemId, params: ShidasuParams): string {
  const entry = params.talismans[id] as unknown as Record<string, unknown> & { desc: string }
  const context: Record<string, number> = { rows: params.layout.rows }
  for (const [key, value] of Object.entries(entry)) {
    if (typeof value === 'number') context[key] = value
  }
  return entry.desc.replace(/\{(\w+)\}/g, (match, key) => (key in context ? String(context[key]) : match))
}

export function rollItemOffer(items: ItemId[], rand: () => number = Math.random, count = 3): ItemId[] {
  const available = ITEM_POOL.filter(id => !items.includes(id))
  return rollOffer(available, count, rand)
}
