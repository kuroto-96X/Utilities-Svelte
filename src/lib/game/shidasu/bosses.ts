// src/lib/game/shidasu/bosses.ts
import type { BossKind, BossTierKey } from './types'
import type { ShidasuParams } from './params'

export const BOSS_KINDS: BossKind[] = ['noLoop', 'faceLock', 'lowCombo', 'oddCombo', 'suit', 'face']

export function bossName(kind: BossKind, params: ShidasuParams): string {
  return params.bosses[kind].name
}

export function bossDesc(kind: BossKind, params: ShidasuParams): string {
  const entry = params.bosses[kind] as unknown as Record<string, unknown> & { desc: string }
  const context: Record<string, number> = {}
  for (const [key, value] of Object.entries(entry)) {
    if (typeof value === 'number') context[key] = value
  }
  return entry.desc.replace(/\{(\w+)\}/g, (match, key) => (key in context ? String(context[key]) : match))
}

// 指定した階級に現在割り当てられている候補の一覧を返す(管理画面の件数表示・バリデーションで使う)。
export function bossesInTier(params: ShidasuParams, tierKey: BossTierKey): BossKind[] {
  return BOSS_KINDS.filter(kind => params.bosses[kind].tier === tierKey)
}
