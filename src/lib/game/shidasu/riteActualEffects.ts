import type { RiteId } from './types'

// 各秘儀の実際の実装ロジックを、開発者向けに要約したもの(監査用)。
// 説明文テンプレート(rites.ts の desc)とは独立して管理し、実装(riteEffects.ts)を正として記述する。
// パラメータは実際の数値ではなく、paramsのキー名(nなど)のまま一般化して書く。
export const RITE_ACTUAL_EFFECTS: Record<RiteId, string> = {
  jera: '場札の各列を、列ごとにランダムな方向(昇順/降順)でランク順にソートする(空の列は対象外。ワイルドを含む全カードが対象)',
  uruz: '現在のコンボ数に+nし、ウェーブ内最大コンボ数もそれに追従して更新する(イサのcomboFrozenThisWave中は変化しない)',
  ingwaz: '基礎コンボ数に+nする(現在のコンボ数自体は変えない)',
  gebo: '捨て札をシャッフルし、場札の列数ぶんを各列の一番上に1枚ずつ配置する(捨て札が列数未満なら何もしない)',
  fehu: '山札の上から場札の列数ぶんを取り出し、各列の一番上に1枚ずつ配置する(山札の残りが列数以下なら何もしない)',
  dagaz: '山札と捨て札をすべて合わせてシャッフルし、新しい山札にする(捨て札は空になる)',
  algiz: 'そのウェーブが終わるまでplayFromAnywhereActiveThisWaveをtrueにする。各列で一番上のカードだけでなく列内の全カードがプレイ対象になる(isPlayable判定自体は変わらず、個々のカードのランク差等で可否が決まる)',
  eihwaz: 'コンボリセット防止残り回数(comboResetShieldRemaining)に+nする',
  hagalaz: '場札の全カードと山札の残りを合流させシャッフルし、各列の現在の枚数を維持したまま先頭から配り直す(余りは新しい山札にする。foundation・chain・comboは変更しない)',
  nauthiz: 'nauthizActiveThisWaveをtrueにする。以後resetComboFieldsの通常リセットで、comboFrozenThisWaveがfalseの場合に限り、combo再開値をfloor(リセット直前のcombo/2)にする(baseComboCountは参照しない)',
  isa: 'comboFrozenThisWaveをtrueにする。以後resetComboFieldsの通常リセット・playCardのコンボ加算・drawStockの素朴(naive)分岐のコンボ加算を全て無効化し、wave.comboを変化させない(ナウジズより優先)',
  sowilo: 'sowiloActiveThisWaveをtrueにする(sowiloBoostedRoleはnullのまま)。以後playCard内のroleBonusMultiplierで、sowiloBoostedRoleが未確定なら最初に成立した役をその場でx倍しつつ記憶し、確定済みならその役が成立するたび常にx倍する(drawStockの素朴(naive)分岐には明星と同様に適用されない)',
  berkano: '現在のコンボ数をfloor(combo×x)にする(uruzの乗算版)。maxComboThisWaveも追従更新する(イサのcomboFrozenThisWave中は変化しない)',
  mannaz: 'mannazActiveThisWaveをtrueにする。以後playCard・drawStockの素朴(naive)分岐の得点計算で、コンボ倍率と併せて1+(所持護符のレア度重み合計(C=1/U=2/R=4))×xの係数をgainedに掛ける',
  ehwaz: 'ehwazActiveThisWaveをtrueにする。以後isPlayableで、既存のd===1/d===12(ループ)に加えd===2/d===11(ループ、noLoop時は不可)も許可する。analyzeStair(階段パターン判定)には一切影響しない',
}
