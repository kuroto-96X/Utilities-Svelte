import type { ItemId } from './types'

export interface ItemGroup {
  label: string
  ids: ItemId[]
}

export const ITEM_GROUPS: ItemGroup[] = [
  { label: '初期実装', ids: ['bridge', 'grace'] },
  { label: 'グループ1: 全消しボーナス', ids: ['patience', 'purify', 'temperance'] },
  { label: 'グループ2: カード単体の属性', ids: ['springBreeze', 'summerBreeze', 'autumnBreeze', 'winterBreeze', 'kinship', 'thaw', 'dusk', 'dawn', 'wit'] },
  { label: 'グループ3: 現在のコンボ数判定', ids: ['courage', 'daybreak', 'twilight', 'cheerful', 'conscience', 'morningMist'] },
  { label: 'グループ4: チェーン全体の属性', ids: ['calm', 'serenity', 'destiny', 'fate', 'relief', 'verdantGreen', 'gem', 'resolve', 'grail', 'moonlight', 'sunlight', 'crown', 'cloverLeaf', 'coin', 'blade', 'chalice', 'balance', 'harmony', 'nobility', 'tenacity', 'determination', 'cycle', 'reincarnation', 'majesty'] },
  { label: 'グループ5: 場札・山札の残り枚数', ids: ['omen', 'crescent'] },
  { label: 'グループ6: 役・パターン成立状況', ids: ['blessing', 'focus', 'lapis', 'jade', 'emptyMind'] },
  { label: 'グループ7: コンボ内の位置', ids: ['prologue', 'interlude', 'morningDew'] },
  { label: 'グループ8: 無条件固定加算', ids: ['drizzle'] },
  { label: '永続デッキ・捨て札系', ids: ['eternity', 'abundance', 'silence', 'resilience'] },
  { label: 'グループ9: 列選択の連続性', ids: ['gentleBreeze', 'resonance'] },
  { label: 'グループ10: ウェーブ内累積state', ids: ['azureSky', 'amber'] },
  { label: 'グループ11: イベント発生時の直接点', ids: ['composure', 'clarity', 'arrogance', 'echo', 'shootingStar'] },
  { label: 'グループ12: 山札めくり関連', ids: ['naive', 'intuition', 'sincerity'] },
  { label: 'グループ13: 資源操作(残り)', ids: ['promise', 'darkClouds', 'regeneration'] },
  { label: 'グループ14: 保護・救済', ids: ['benevolence', 'healing'] },
  { label: 'グループ15: 情報表示', ids: ['guidance'] },
  { label: 'グループ16: 持続効果', ids: ['passion', 'fightingSpirit'] },
  { label: 'グループ17: コアパラメータ書き換え', ids: ['sanctify', 'protection', 'earth', 'golden', 'morningStar', 'mercy', 'mirror', 'deadline'] },
  { label: 'グループ18: 判定ロジック内部干渉', ids: ['dedication', 'diligence', 'divineProtection', 'fortitude', 'waterMirror'] },
  { label: 'グループ19: デメリット付き倍算・色拡張イネーブラー', ids: ['vow', 'pact', 'crimson', 'jetBlack', 'silver'] },
  { label: 'グループ22: 他カテゴリ依存', ids: ['discretion', 'frost'] },
]
