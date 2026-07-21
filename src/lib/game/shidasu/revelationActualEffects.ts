import type { RevelationId } from './types'

// 各天啓の実際の実装ロジックを、開発者向けに要約したもの(監査用)。
// 説明文テンプレート(revelations.ts の desc)とは独立して管理し、実装(revelationEffects.ts)を正として記述する。
// パラメータは実際の数値ではなく、paramsのキー名(nなど)のまま一般化して書く。
export const REVELATION_ACTUAL_EFFECTS: Record<RevelationId, string> = {
  kaku: '選んだ列の非ワイルドカードを全て♠に変換し、deckCompositionの対応する枠も同じスートに書き換える(ワイルドは対象外)',
  kou: '選んだ列の非ワイルドカードを全て♥に変換し、deckCompositionの対応する枠も同じスートに書き換える(ワイルドは対象外)',
  tei: '選んだ列の非ワイルドカードを全て♦に変換し、deckCompositionの対応する枠も同じスートに書き換える(ワイルドは対象外)',
  bou: '選んだ列の非ワイルドカードを全て♣に変換し、deckCompositionの対応する枠も同じスートに書き換える(ワイルドは対象外)',
  shin: '場札全体の非ワイルド♠を全て♥に変換し、deckCompositionの対応する枠も書き換える(♠以外・ワイルドは対象外)',
  bi: '場札全体の非ワイルド♥を全て♣に変換し、deckCompositionの対応する枠も書き換える(♥以外・ワイルドは対象外)',
  ki: '場札全体の非ワイルド♣を全て♦に変換し、deckCompositionの対応する枠も書き換える(♣以外・ワイルドは対象外)',
  to: '場札全体の非ワイルド♦を全て♠に変換し、deckCompositionの対応する枠も書き換える(♦以外・ワイルドは対象外)',
  gyu: '選んだ列の非ワイルドカードを、1枚ごとに個別抽選でA〜10のいずれかのランクへ変換し、deckCompositionの対応する枠も同じランクに書き換える(ワイルドは対象外)',
  jo: '選んだ列の非ワイルドカードを、1枚ごとに個別抽選でJ・Q・Kのいずれかのランクへ変換し、deckCompositionの対応する枠も同じランクに書き換える(ワイルドは対象外)',
  kyo: '山札の上からn行(列数×n枚)を各列の末尾に配る(deckCompositionは変更せず、山札の並べ替えのみ)。使用条件(canUseRevelation)は山札が列数×n枚以上であること。engine.ts側でrun.extraTableauRowsにもnを恒久的に加算し、以後のウェーブ開始時の配布行数(startWave)にも反映する',
  aya: '選んだ列の一番上にワイルドを1枚追加し、deckCompositionにも新規ワイルドエントリを1件追加する(deckIdは配列長を採番して衝突を回避)',
}
