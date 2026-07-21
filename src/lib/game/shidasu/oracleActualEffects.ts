import type { RoleName } from './types'

// 各神託の実際の実装ロジックを、開発者向けに要約したもの(監査用)。
// 説明文テンプレート(oracles.ts の desc)とは独立して管理し、実装(engine.ts・patterns.ts)を正として記述する。
// いずれの神託も「対応する役のrun.oracleLevels(および選択直後の実ウェーブのrun.wave.oracleLevels)を
// +1する」という同一の仕組み(engine.ts pickOracleFromOffer)であり、差はどの役のレベルが上がるか、
// そのレベルが得点計算のどこで参照されるかのみ。
export const ORACLE_ACTUAL_EFFECTS: Record<RoleName, string> = {
  suit: '同スートのレベルを+1する。以後evaluateChainBonus(patterns.ts)の同スートボーナス計算で、基礎点(suitBonus)にこのレベルを乗算した額が加点される(ウェーブ開始時点のレベルで固定、ウェーブ中は不変)',
  color: '同色のレベルを+1する。以後evaluateChainBonus(patterns.ts)の同色ボーナス計算で、基礎点(colorBonus)にこのレベルを乗算した額が加点される(ウェーブ開始時点のレベルで固定、ウェーブ中は不変)',
  stair: '階段のレベルを+1する。以後evaluateChainBonus(patterns.ts)の階段ボーナス計算で、基礎点(stairBonus)にこのレベルを乗算した額が加点される(ウェーブ開始時点のレベルで固定、ウェーブ中は不変)',
  flush: 'フラッシュのレベルを+1する。以後evaluateChainBonus(patterns.ts)のフラッシュボーナス計算で、基礎点(flushBonus)にこのレベルを乗算した額が加点される(明星・ソウィロ由来のroleBonusMultiplierとも併せて乗算される)',
  royalSet: 'ロイヤルセットのレベルを+1する。以後evaluateChainBonus(patterns.ts)のロイヤルセットボーナス計算で、基礎点(royalSetBonus)にこのレベルを乗算した額が加点される(明星・ソウィロ由来のroleBonusMultiplierとも併せて乗算される)',
  sameRank: '同ランクのレベルを+1する。以後evaluateChainBonus(patterns.ts)の同ランクボーナス計算で、基礎点(sameRankBonusUnit)にこのレベルを乗算した額が加点される(明星・ソウィロ由来のroleBonusMultiplierとも併せて乗算される)',
  completeRun: 'コンプリートランのレベルを+1する。以後evaluateChainBonus(patterns.ts)のコンプリートランボーナス・コンプリートラン(同スート)ボーナスの両方の計算で、基礎点(completeRunBonus・completeRunSuitBonus)にこのレベルを乗算した額が加点される(同スート追加分も同じcompleteRunレベルを参照。明星・ソウィロ由来のroleBonusMultiplierとも併せて乗算される)',
  columnSweep: '列一掃のレベルを+1する。以後playCard(engine.ts)の列一掃加点計算で、基礎点(columnSweepBonus)にこのレベルを乗算した額が加点される(明星・ソウィロ由来のroleBonusMultiplierとも併せて乗算される)',
}
