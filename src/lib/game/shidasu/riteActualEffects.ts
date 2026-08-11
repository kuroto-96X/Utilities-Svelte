import type { RiteId } from './types'

// 各秘儀の実際の実装ロジックを、開発者向けに要約したもの(監査用)。
// 説明文テンプレート(rites.ts の desc)とは独立して管理し、実装(riteEffects.ts)を正として記述する。
// パラメータは実際の数値ではなく、paramsのキー名(nなど)のまま一般化して書く。
export const RITE_ACTUAL_EFFECTS: Record<RiteId, string> = {
  raidho: '場札内の非ワイルド・非絵札(J/Q/K以外)カードの位置一覧を記録し、それらのカードを山札と合流させてシャッフルしたうえで、同じ位置に配り直す(絵札・ワイルドは移動しない。あぶれた分は新しい山札になる)',
  jera: '場札の各列を、列ごとにランダムな方向(昇順/降順)でランク順にソートする(空の列は対象外。ワイルドを含む全カードが対象)',
  wunjo: '場札の全カードを捨て札に合流させてシャッフルし、各列の現在の枚数を維持したまま先頭から配り直す(あぶれた分は新しい捨て札になる。山札は変更しない)',
  othala: '山札内で残り枚数が最も多いランク(同数なら候補からランダム)を選び、そのランクの山札カードをすべて場札に合流させる。場札全体をシャッフルし、列数を変えずに列インデックスのラウンドロビンで配り直す(山札に対象ランクが無ければ何もしない)',
  perthro: '各列について、現在の枚数がdealtRows未満の分だけ山札の上から補充する(山札が不足すれば補充できる分だけ補充する)',
  uruz: '現在のコンボ数に+nし、ウェーブ内最大コンボ数もそれに追従して更新する(イサのcomboFrozenThisWave中は変化しない)',
  ingwaz: '基礎コンボ数に+nする(現在のコンボ数自体は変えない)',
  gebo: '捨て札をシャッフルし、場札の列数ぶんを各列の一番上に1枚ずつ配置する(捨て札が列数未満なら何もしない)',
  fehu: '山札の上から場札の列数ぶんを取り出し、各列の一番上に1枚ずつ配置する(山札の残りが列数以下なら何もしない)',
  dagaz: '山札と捨て札をすべて合わせてシャッフルし、新しい山札にする(捨て札は空になる)',
  algiz: 'そのウェーブが終わるまでplayFromAnywhereActiveThisWaveをtrueにする。各列で一番上のカードだけでなく列内の全カードがプレイ対象になる(isPlayable判定自体は変わらず、個々のカードのランク差等で可否が決まる)',
  tiwaz: '場札の全列について、配列の並び順を反転させる(一番上と一番下が入れ替わる)',
  laguz: '場札の中でcol.length===0の列をランダムに1つ選び、山札の上からdealtRows枚まで補充する(0枚の列が無ければ何もしない)',
  eihwaz: 'コンボリセット防止残り回数(comboResetShieldRemaining)に+nする',
  ansuz: 'チェーンの全カードをdiscardPileへ送り、山札から1枚drawしてchain・foundationを差し替える。combo・maxComboThisWave・baseComboCountは変更しない(山札が空なら何もしない)',
  kenaz: '場札と山札を合流させ、スートごとに枚数を集計してグループ化し、枚数の多いスート順(スート内はシャッフル)に並べた配り札の列を作る。各列の現在の枚数を維持したまま先頭から配り直す(あぶれた分は新しい山札になる)',
  thurisaz: 'nextPlayScoreMultiplierをxにする。直後のplayCard1回のみ、gained計算に追加でx倍する乗算ファクターとして作用し、そのプレイの完了時にnextPlayScoreMultiplierは1にリセットされる',
  hagalaz: '場札の全カードと山札の残りを合流させシャッフルし、各列の現在の枚数を維持したまま先頭から配り直す(余りは新しい山札にする。foundation・chain・comboは変更しない)',
  nauthiz: 'nauthizActiveThisWaveをtrueにする。以後resetComboFieldsの通常リセットで、comboFrozenThisWaveがfalseの場合に限り、combo再開値をfloor(リセット直前のcombo/2)にする(baseComboCountは参照しない)',
  isa: 'comboFrozenThisWaveをtrueにする。以後resetComboFieldsの通常リセット・playCardのコンボ加算・drawStockの素朴(naive)分岐のコンボ加算を全て無効化し、wave.comboを変化させない(ナウジズより優先)',
  sowilo: 'sowiloActiveThisWaveをtrueにする(sowiloBoostedRoleはnullのまま)。以後playCard内のroleBonusMultiplierで、sowiloBoostedRoleが未確定なら最初に成立した役をその場でx倍しつつ記憶し、確定済みならその役が成立するたび常にx倍する(drawStockの素朴(naive)分岐には明星と同様に適用されない)',
  berkano: '現在のコンボ数をfloor(combo×x)にする(uruzの乗算版)。maxComboThisWaveも追従更新する(イサのcomboFrozenThisWave中は変化しない)',
  mannaz: 'mannazActiveThisWaveをtrueにする。以後playCard・drawStockの素朴(naive)分岐の得点計算で、コンボ倍率と併せて1+(所持護符のレア度重み合計(C=1/U=2/R=4))×xの係数をgainedに掛ける',
  ehwaz: 'ehwazActiveThisWaveをtrueにする。以後isPlayableで、既存のd===1/d===12(ループ)に加えd===2/d===11(ループ、noLoop時は不可)も許可する。analyzeStair(階段パターン判定)には一切影響しない',
}
