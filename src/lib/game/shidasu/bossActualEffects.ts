// src/lib/game/shidasu/bossActualEffects.ts

// 各制限ルール種別の実際の挙動を、開発者向けに要約したもの(監査用)。
// params.stars内のrestrictionKindと対応する。実装(engine.ts)を正として記述する。
export const STAR_RESTRICTION_ACTUAL_EFFECTS: Record<'noLoop' | 'faceLock' | 'lowCombo' | 'oddCombo' | 'suit' | 'face', string> = {
  noLoop: 'A⇔Kのループ接続でのカード取得自体を禁止する(得点への影響はない)',
  faceLock: 'コンボ数が2未満のとき絵札(J・Q・K)の取得自体を禁止する(ワイルドの場札はこの制限より先に取得可能と判定される)',
  lowCombo: '実効コンボ数(護符補正込み)が指定コンボ数以下のとき、そのプレイの獲得点を0にする(コンボ数自体は通常通り進行する)',
  oddCombo: '実効コンボ数(護符補正込み)が奇数のとき、そのプレイの獲得点を0にする(コンボ数自体は通常通り進行する)',
  suit: '星が選出された時点でスートを1つランダムに確定し、以後そのスートの非ワイルドカードを取ると獲得点を0にする(ワイルドは対象外)',
  face: '非ワイルドの絵札(J・Q・K)を取ると獲得点を0にする(ワイルドは対象外)',
}
