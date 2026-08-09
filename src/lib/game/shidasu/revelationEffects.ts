import type { Card, DeckCard, Rank, Suit, WaveState, RevelationId } from './types'
import type { ShidasuParams } from './params'

function pickRandom<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)]
}

// 指定した列の非ワイルドカードを全て対象スートへ変換し、wave・deckComposition両方に反映する。
function convertColumnToSuit(wave: WaveState, deckComposition: DeckCard[], colIndex: number, suit: Suit): { wave: WaveState; deckComposition: DeckCard[] } {
  const col = wave.tableau[colIndex]
  if (!col) return { wave, deckComposition }
  const targetDeckIds = new Set(col.filter(c => !c.wild).map(c => c.deckId))
  const tableau = wave.tableau.map((c, i) => (i === colIndex ? c.map(cardEl => (cardEl.wild ? cardEl : { ...cardEl, suit })) : c))
  const newComposition = deckComposition.map(entry => (targetDeckIds.has(entry.deckId) ? { ...entry, suit } : entry))
  return { wave: { ...wave, tableau }, deckComposition: newComposition }
}

// 場札全体の指定スートの非ワイルドカードを全て別のスートへ変換し、wave・deckComposition両方に反映する。
function convertTableauSuit(wave: WaveState, deckComposition: DeckCard[], from: Suit, to: Suit): { wave: WaveState; deckComposition: DeckCard[] } {
  const targetDeckIds = new Set(wave.tableau.flat().filter(c => !c.wild && c.suit === from).map(c => c.deckId))
  const tableau = wave.tableau.map(col => col.map(cardEl => (!cardEl.wild && cardEl.suit === from ? { ...cardEl, suit: to } : cardEl)))
  const newComposition = deckComposition.map(entry => (targetDeckIds.has(entry.deckId) ? { ...entry, suit: to } : entry))
  return { wave: { ...wave, tableau }, deckComposition: newComposition }
}

// 指定した列の非ワイルドカードを、候補ランクの中からカードごとに個別ランダムで変換する。
function convertColumnToRandomRank(wave: WaveState, deckComposition: DeckCard[], colIndex: number, candidateRanks: Rank[], rand: () => number): { wave: WaveState; deckComposition: DeckCard[] } {
  const col = wave.tableau[colIndex]
  if (!col) return { wave, deckComposition }
  const rankByDeckId = new Map<number, Rank>()
  const newCol = col.map(cardEl => {
    if (cardEl.wild) return cardEl
    const rank = pickRandom(candidateRanks, rand)
    rankByDeckId.set(cardEl.deckId, rank)
    return { ...cardEl, rank }
  })
  const tableau = wave.tableau.map((c, i) => (i === colIndex ? newCol : c))
  const newComposition = deckComposition.map(entry => (rankByDeckId.has(entry.deckId) ? { ...entry, rank: rankByDeckId.get(entry.deckId) as Rank } : entry))
  return { wave: { ...wave, tableau }, deckComposition: newComposition }
}

// 山札の上からn行(列数×n枚)を各列の末尾に1枚ずつ配る(フェフ秘儀のn行版)。deckCompositionは変更しない
// (山札の中身を並べ替えるだけのため)。
function expandTableauRows(wave: WaveState, n: number): WaveState {
  const cols = wave.tableau.length
  const stock = [...wave.stock]
  const tableau = wave.tableau.map(col => [...col])
  for (let r = 0; r < n; r++) {
    for (let i = 0; i < cols; i++) {
      const drawn = stock.pop()
      if (!drawn) break
      tableau[i].push(drawn)
    }
  }
  return { ...wave, tableau, stock }
}

// 場に存在する全カードのidの最大値+1を返す(新規カード生成時の一時id採番用)。
function nextWaveCardId(wave: WaveState): number {
  const allIds = [
    ...wave.tableau.flat().map(c => c.id),
    ...wave.stock.map(c => c.id),
    ...wave.chain.map(c => c.id),
    ...wave.discardPile.map(c => c.id),
  ]
  return (allIds.length > 0 ? Math.max(...allIds) : 0) + 1
}

// 選んだ列の一番上にワイルドを1枚追加する。deckCompositionにも新規ワイルドエントリを1件追加する
// (永劫護符と同じ要領。deckIdは配列長を採番して衝突を回避する)。
function addWildToColumnTop(wave: WaveState, deckComposition: DeckCard[], colIndex: number): { wave: WaveState; deckComposition: DeckCard[] } {
  if (!wave.tableau[colIndex]) return { wave, deckComposition }
  const newDeckId = deckComposition.length
  const newComposition: DeckCard[] = [...deckComposition, { deckId: newDeckId, suit: '★', rank: 0 as Rank, wild: true, removed: false }]
  const newCard: Card = { id: nextWaveCardId(wave), deckId: newDeckId, suit: '★', rank: 0 as Rank, wild: true }
  const tableau = wave.tableau.map((c, i) => (i === colIndex ? [...c, newCard] : c))
  return { wave: { ...wave, tableau }, deckComposition: newComposition }
}

// 選択列の各位置iのカードを、1つ左の列の同じ位置iのカードのランク+1(A⇔Kループ)に変換する。
// 左端の列を選んだ場合は右端の列を参照する。参照列側がワイルド・存在しない位置(参照列の方が短い場合)はスキップする。
function convertColumnChainFromLeft(wave: WaveState, deckComposition: DeckCard[], colIndex: number): { wave: WaveState; deckComposition: DeckCard[] } {
  const col = wave.tableau[colIndex]
  if (!col) return { wave, deckComposition }
  const cols = wave.tableau.length
  const refIndex = colIndex === 0 ? cols - 1 : colIndex - 1
  const refCol = wave.tableau[refIndex]
  const rankByDeckId = new Map<number, Rank>()
  const newCol = col.map((cardEl, i) => {
    if (cardEl.wild) return cardEl
    const refCard = refCol?.[i]
    if (!refCard || refCard.wild) return cardEl
    const newRank = (refCard.rank === 13 ? 1 : refCard.rank + 1) as Rank
    rankByDeckId.set(cardEl.deckId, newRank)
    return { ...cardEl, rank: newRank }
  })
  const tableau = wave.tableau.map((c, i) => (i === colIndex ? newCol : c))
  const newComposition = deckComposition.map(entry => (rankByDeckId.has(entry.deckId) ? { ...entry, rank: rankByDeckId.get(entry.deckId) as Rank } : entry))
  return { wave: { ...wave, tableau }, deckComposition: newComposition }
}

// 天啓が現在の盤面状態で使用可能か判定する(場札拡張の山札枚数不足のみ判定対象)。
export function canUseRevelation(params: ShidasuParams, wave: WaveState, revelationId: RevelationId): boolean {
  switch (revelationId) {
    case 'kyo':
      return wave.stock.length >= wave.tableau.length * params.revelations.kyo.n
    default:
      return true
  }
}

// 列選択(targetCol)が必要な天啓かどうかを返す。
export function revelationNeedsTarget(revelationId: RevelationId): boolean {
  switch (revelationId) {
    case 'kaku':
    case 'kou':
    case 'tei':
    case 'bou':
    case 'gyu':
    case 'jo':
    case 'aya':
    case 'shitsu':
      return true
    default:
      return false
  }
}

// 指定した天啓の効果を適用した新しいwave・deckCompositionを返す。所持からの削除・extraTableauRowsの
// 加算はengine.ts側で行う。targetColは列選択が不要な天啓では無視される。
export function applyRevelationEffect(
  params: ShidasuParams,
  wave: WaveState,
  deckComposition: DeckCard[],
  revelationId: RevelationId,
  targetCol: number | null,
  rand: () => number
): { wave: WaveState; deckComposition: DeckCard[] } {
  switch (revelationId) {
    case 'kaku':
      return targetCol === null ? { wave, deckComposition } : convertColumnToSuit(wave, deckComposition, targetCol, '♠')
    case 'kou':
      return targetCol === null ? { wave, deckComposition } : convertColumnToSuit(wave, deckComposition, targetCol, '♥')
    case 'tei':
      return targetCol === null ? { wave, deckComposition } : convertColumnToSuit(wave, deckComposition, targetCol, '♦')
    case 'bou':
      return targetCol === null ? { wave, deckComposition } : convertColumnToSuit(wave, deckComposition, targetCol, '♣')
    case 'shin':
      return convertTableauSuit(wave, deckComposition, '♠', '♥')
    case 'bi':
      return convertTableauSuit(wave, deckComposition, '♥', '♣')
    case 'ki':
      return convertTableauSuit(wave, deckComposition, '♣', '♦')
    case 'to':
      return convertTableauSuit(wave, deckComposition, '♦', '♠')
    case 'gyu':
      return targetCol === null ? { wave, deckComposition } : convertColumnToRandomRank(wave, deckComposition, targetCol, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], rand)
    case 'jo':
      return targetCol === null ? { wave, deckComposition } : convertColumnToRandomRank(wave, deckComposition, targetCol, [11, 12, 13], rand)
    case 'kyo':
      return { wave: expandTableauRows(wave, params.revelations.kyo.n), deckComposition }
    case 'aya':
      return targetCol === null ? { wave, deckComposition } : addWildToColumnTop(wave, deckComposition, targetCol)
    case 'shitsu':
      return targetCol === null ? { wave, deckComposition } : convertColumnChainFromLeft(wave, deckComposition, targetCol)
  }
}
