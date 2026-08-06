// src/lib/game/shidasu/roles.ts
import type { RoleName } from './types'
import type { ShidasuParams } from './params'

// 常時表示エリア(RoleStatusPanel)向けの、8役それぞれの表示名・発動条件の説明文。
// 神託自体の名前・説明文(params.oracles、8卦の個別名)とは別物で、こちらは役そのものの
// 固定の説明(docs/shidasu/shidasu-current-rules.md 4.2節の内容に対応)。
export interface RoleEntry {
  name: RoleName
  label: string
  desc: string
}

export const ROLE_LIST: RoleEntry[] = [
  { name: 'suit', label: '同スート', desc: 'チェーンが3枚以上かつ全て同じスート' },
  { name: 'color', label: '同色', desc: '同スート不成立、かつチェーンが3枚以上かつ全て同じ色' },
  { name: 'stair', label: '階段', desc: 'チェーンが同方向に連続し、最小連続枚数以上' },
  { name: 'flush', label: 'フラッシュ', desc: '直近4枚で♠♥♦♣が全て揃う' },
  { name: 'royalSet', label: 'ロイヤルセット', desc: '直近3枚でJ・Q・Kが揃う' },
  { name: 'sameRank', label: '同ランク', desc: 'チェーン内に同じランクが複数出現' },
  { name: 'completeRun', label: 'コンプリートラン', desc: '13ランクが出揃った瞬間(同スートなら追加ボーナスも)' },
  { name: 'columnSweep', label: '列一掃', desc: '場札の列を最後の1枚まで取り切る' },
  { name: 'pair', label: 'ペア', desc: 'チェーン全体で同ランクの組が2組以上成立' },
  { name: 'alternating', label: '交互', desc: 'チェーンが4枚以上かつ赤黒交互に並ぶ' },
]

// 役の基礎点(神託レベルを乗算する前の値)をparams.scoringから引く。
export function roleBasePoint(params: ShidasuParams, roleName: RoleName): number {
  switch (roleName) {
    case 'suit': return params.scoring.suitBonus
    case 'color': return params.scoring.colorBonus
    case 'stair': return params.scoring.stairBonus
    case 'flush': return params.scoring.flushBonus
    case 'royalSet': return params.scoring.royalSetBonus
    case 'sameRank': return params.scoring.sameRankBonusUnit
    case 'completeRun': return params.scoring.completeRunBonus
    case 'columnSweep': return params.scoring.columnSweepBonus
    case 'pair': return params.scoring.pairBonusUnit
    case 'alternating': return params.scoring.alternatingBonus
  }
}
