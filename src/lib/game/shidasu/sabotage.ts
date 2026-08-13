// src/lib/game/shidasu/sabotage.ts
import type { SabotageActionId, StarSabotage } from './types'

export interface SabotageActionDef {
  id: SabotageActionId
  name: string
  target: string
  intervalTurns: number
  descTemplate: string
}

// 妨害行動プール。11件(各操作対象1個ずつ)。詳細はdocs/shidasu/shidasu-star-sabotage-candidates.mdを参照。
// intervalTurnsは初期値の目安(効果が強い・永続的なものほど長め)。数値調整はこの配列を直接編集する。
export const SABOTAGE_POOL: SabotageActionDef[] = [
  { id: 'stockPurge', name: '大量放出', target: '山札', intervalTurns: 6, descTemplate: '山札の上から5枚を捨て札に置く' },
  { id: 'columnReturn', name: '一列戻し', target: '場札', intervalTurns: 6, descTemplate: 'ランダムな1列を山札に戻し、シャッフル後同じ列に裏向きで再配布する' },
  { id: 'chainSettle', name: '強制清算', target: 'チェーン', intervalTurns: 8, descTemplate: 'チェーンを全て捨て札に送り、山札から1枚めくって新しいチェーンにする。コンボも0にする' },
  { id: 'comboBreather', name: '強制小休止', target: 'コンボ', intervalTurns: 5, descTemplate: 'チェーンはそのまま、コンボ数だけ0にする' },
  { id: 'talismanSeal', name: '護符封印', target: '護符', intervalTurns: 5, descTemplate: '所持護符を1つ選び、次の妨害発動まで効果を無効化する' },
  { id: 'riteSeal', name: '秘儀封印', target: '秘儀', intervalTurns: 5, descTemplate: '所持秘儀を1つ選び、次の妨害発動まで使用を禁止する' },
  { id: 'revelationOracleSeal', name: '天啓・神託封印', target: '天啓・神託', intervalTurns: 5, descTemplate: '天啓または神託を1つ選び、次の妨害発動まで使用禁止にする' },
  { id: 'relicConfiscate', name: 'レリック没収', target: 'レリック', intervalTurns: 7, descTemplate: '所持レリックを1つ選び、完全に失わせる' },
  { id: 'tableauCardToDiscard', name: '一枚没収', target: '捨て札', intervalTurns: 4, descTemplate: '場札からランダムに1枚選び捨て札に送る' },
  { id: 'currencyConfiscate', name: '通貨没収', target: '資産(星片)', intervalTurns: 6, descTemplate: '所持する星片を5減らす' },
  { id: 'roleSeal', name: '役封印', target: '役ステータス', intervalTurns: 6, descTemplate: 'ランダムな2役を選び、次の妨害発動までそれらのボーナスを無効化する' },
]

export function eligibleSabotageIds(sabotage: StarSabotage): SabotageActionId[] {
  switch (sabotage.kind) {
    case 'none': return []
    case 'all': return SABOTAGE_POOL.map(a => a.id)
    case 'some': return sabotage.ids
  }
}

export function rollSabotage(sabotage: StarSabotage, rand: () => number): { pendingSabotageId: SabotageActionId | null; sabotageTurnsRemaining: number } {
  const ids = eligibleSabotageIds(sabotage)
  if (ids.length === 0) return { pendingSabotageId: null, sabotageTurnsRemaining: 0 }
  const id = ids[Math.floor(rand() * ids.length)]
  const def = SABOTAGE_POOL.find(a => a.id === id)!
  return { pendingSabotageId: id, sabotageTurnsRemaining: def.intervalTurns }
}
