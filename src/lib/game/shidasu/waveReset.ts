// src/lib/game/shidasu/waveReset.ts
import type { Card, ChainCardOrigin, WaveState } from './types'
import type { ShidasuParams } from './params'

// コンボリセット時に共通で初期化するフィールドをまとめて返す(治癒・再生・不屈の解決は含まない)。
// newFoundation/newOriginを省略した場合はfoundationを変更せず、chainは[wave.foundation]・
// chainOriginは現在の末尾要素のみを残す(全消し・手詰まり時に使う。まだ新しいカードを引いていないため)。
// 通常のdrawStockリセットでは、新しく引いたカードとその起源('draw')を明示的に渡す。
export function resetComboFields(
  wave: WaveState,
  params: ShidasuParams,
  newFoundation: Card = wave.foundation,
  newOrigin: ChainCardOrigin = wave.chainOrigin[wave.chainOrigin.length - 1]
): WaveState {
  // エイワズ(秘儀)によるコンボリセット防止。newFoundationが新しく引かれたカード(通常のdrawStock
  // リセット時)であればチェーンを継続扱いで延長し、全消し・手詰まりのリサイクル時(newFoundation省略、
  // wave.foundationと同一)はチェーン・コンボ状態をそのまま保持する。いずれもresetDirect系護符
  // (沈着・冷静・残響等)の判定はこの関数の外側(呼び出し元)で既に行われているため、シールドが
  // 防ぐのはコンボ・チェーンの状態変化のみである。
  if (wave.comboResetShieldRemaining > 0) {
    const isNewCard = newFoundation.id !== wave.foundation.id
    return {
      ...wave,
      foundation: newFoundation,
      chain: isNewCard ? [...wave.chain, newFoundation] : wave.chain,
      chainOrigin: isNewCard ? [...wave.chainOrigin, newOrigin] : wave.chainOrigin,
      linked: true,
      comboResetShieldRemaining: wave.comboResetShieldRemaining - 1,
    }
  }

  // 新chainに引き継がれるカード(newFoundation)は捨て札へ重複して送らない。chain内の位置ではなく
  // IDの一致で除外するため、chain末尾が必ずfoundationと一致するという不変条件に依存しない。
  // 通常のdrawStockリセットではnewFoundationが新規に引いたカードでchainに含まれないため何も除去されず、
  // 全消し・手詰まりのリサイクル時のみ該当カードが除外される。
  const chainToDiscard = wave.chain.filter(c => c.id !== newFoundation.id)
  // イサ(凍結)がナウジズより優先。凍結中はcomboを一切変更しない。
  // 基礎コンボ数(baseComboCount)はリセット処理では一切参照しない(得点計算時に常に加算される別枠の値のため)。
  const comboAfterReset = wave.comboFrozenThisWave
    ? wave.combo
    : wave.nauthizActiveThisWave
      ? Math.floor(wave.combo / 2)
      : 0
  return {
    ...wave,
    foundation: newFoundation,
    combo: comboAfterReset,
    chain: [newFoundation],
    chainOrigin: [newOrigin],
    linked: false,
    columnsEmptiedThisCombo: 0,
    comboStreakColumnLengths: wave.tableau.map(col => col.length),
    discardPile: [...wave.discardPile, ...chainToDiscard],
    drawContinueCountThisChain: 0,
    flushActiveThisCombo: false,
    sameColumnStreak: 0,
    lastPlayedColumn: null,
    benevolenceUsedThisCombo: false,
    roleEchoUsedThisCombo: {},
    sameRankEchoUsedThisCombo: [],
    pendingRoleEcho: null,
    mercyActiveNextCombo: wave.combo <= params.talismans.mercy.c,
    sweptColumnsThisCombo: [],
    roleFiredThisChain: false,
  }
}
