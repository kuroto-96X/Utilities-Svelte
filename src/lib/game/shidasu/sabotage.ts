// src/lib/game/shidasu/sabotage.ts
import type { SabotageActionId, StarSabotage } from './types'

export interface SabotageActionDef {
  id: SabotageActionId
  name: string
  target: string
  intervalTurns: number
  descTemplate: string
}

// 妨害行動プール。22件(11ターゲット×先行実装11個+Phase A追加11個)。詳細はdocs/shidasu/shidasu-star-sabotage-candidates.mdを参照。
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
  { id: 'stockPurgeSmall', name: '少量放出', target: '山札', intervalTurns: 4, descTemplate: '山札の上から2枚を捨て札に置く' },
  { id: 'stockShuffle', name: '山札攪拌', target: '山札', intervalTurns: 5, descTemplate: '山札の順序をランダムに並び替える(枚数は変わらない)' },
  { id: 'tableauFullReturn', name: '総戻し', target: '場札', intervalTurns: 8, descTemplate: '場札全体を山札に戻し、シャッフル後同じ配分で再配布する' },
  { id: 'tableauShuffle', name: '総入れ替え', target: '場札', intervalTurns: 6, descTemplate: '場札の中身を列をまたいでランダムに再配置する(山札には触れない)' },
  { id: 'chainPartialDiscard', name: 'チェーン部分放棄', target: 'チェーン', intervalTurns: 5, descTemplate: 'チェーンの先頭(最古)から2枚を捨て札に送る(コンボはそのまま維持)' },
  { id: 'chainShuffle', name: 'チェーン入れ替え', target: 'チェーン', intervalTurns: 6, descTemplate: 'チェーンをシャッフルし、新しい末尾を基準カードにする' },
  { id: 'comboReduce', name: 'コンボ削減', target: 'コンボ', intervalTurns: 5, descTemplate: 'コンボ数を3減らす(0未満にはしない)' },
  { id: 'comboCap', name: 'コンボ頭打ち', target: 'コンボ', intervalTurns: 6, descTemplate: '発動時点のコンボ数を上限として、次の妨害発動まで増加を止める' },
  { id: 'talismanConfiscate', name: '護符没収', target: '護符', intervalTurns: 7, descTemplate: '所持護符を1つ選び、完全に失わせる' },
  { id: 'riteConfiscate', name: '秘儀没収', target: '秘儀', intervalTurns: 6, descTemplate: '所持秘儀を1つ選び、効果を発動させずに消費させる' },
  { id: 'riteForceActivate', name: '秘儀強制発動', target: '秘儀', intervalTurns: 6, descTemplate: '使用可能な秘儀を1つ選び、即座に効果を発動させて消費する' },
  { id: 'talismanShuffle', name: '護符並び替え', target: '護符', intervalTurns: 5, descTemplate: '所持護符の並び順をランダムにシャッフルし、次の妨害発動まで護符を裏向き表示にする' },
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
