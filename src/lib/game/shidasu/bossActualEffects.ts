import type { BossKind } from './types'

// 各ボス候補の実際の実装ロジックを、開発者向けに要約したもの(監査用)。
// 説明文テンプレート(params.bosses[kind].desc)とは独立して管理し、実装(engine.ts)を正として記述する。
export const BOSS_ACTUAL_EFFECTS: Record<BossKind, string> = {
  noLoop: 'stageModifierForがStageModifier "noLoop" を返し、isPlayableでランク差12(A⇔Kループ)の接続を禁止する(取得可否そのものを制限、得点には無関係)',
  faceLock: 'stageModifierForがStageModifier "faceLock" を返し、isPlayableでコンボ数が2未満のとき絵札(J・Q・K、ランク11以上)の取得を禁止する(ワイルドの場札はfaceLock判定より先に優先評価される)',
  lowCombo: 'bossScoreLockForが{kind:"combo", maxCombo:params.bosses.lowCombo.maxCombo}を返し、playCard/drawStockでeffectiveCombo(庇護・大地等の護符補正込みの実効コンボ数)がmaxCombo以下のとき獲得点(gained/naiveGained)を0にする。コンボ数自体(wave.combo)は通常通り進行する',
  oddCombo: 'bossScoreLockForが{kind:"oddCombo"}を返し、playCard/drawStockでeffectiveComboが奇数のとき獲得点を0にする。コンボ数自体は通常通り進行する',
  suit: 'ステージ突入時(nextBossKindがsuitを選んだ瞬間)にrollGreatMisfortuneSuitでスートを1つ確定しRunState.currentGreatMisfortuneSuitに保持する。bossScoreLockForが{kind:"suit", suit}を返し、playCard/drawStockで非ワイルドかつそのスートのカードを取ると獲得点を0にする(ワイルドは対象外)',
  face: 'bossScoreLockForが{kind:"face"}を返し、playCard/drawStockで非ワイルドかつisFace(ランク11以上)のカードを取ると獲得点を0にする(ワイルドは対象外)',
}
