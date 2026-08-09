import type { Card, DeckCard, Rank, Suit, WaveState, RevelationId } from './types'
import type { ShidasuParams } from './params'
import { shuffleInPlace } from './deck'

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

const SUIT_CYCLE: Record<Suit, Suit> = { '♠': '♥', '♥': '♣', '♣': '♦', '♦': '♠', '★': '★' }

// 場札全体で♠→♥→♣→♦→♠の順にスートを循環変換する。変換前のスートを基準に対応表を1回だけ引くため、
// 逐次適用によるカスケード(例: ♠→♥に変換した直後のカードがさらに♥→♣に変換される)は起きない。
function convertTableauSuitCycle(wave: WaveState, deckComposition: DeckCard[]): { wave: WaveState; deckComposition: DeckCard[] } {
  const suitByDeckId = new Map<number, Suit>()
  const tableau = wave.tableau.map(col => col.map(cardEl => {
    if (cardEl.wild) return cardEl
    const newSuit = SUIT_CYCLE[cardEl.suit]
    suitByDeckId.set(cardEl.deckId, newSuit)
    return { ...cardEl, suit: newSuit }
  }))
  const newComposition = deckComposition.map(entry => (suitByDeckId.has(entry.deckId) ? { ...entry, suit: suitByDeckId.get(entry.deckId) as Suit } : entry))
  return { wave: { ...wave, tableau }, deckComposition: newComposition }
}

// 空でない列を左から順に走査し、最初の列の一番上(末尾)のカードのランクを起点に、i番目(空列を除いた順番)の
// 空でない列の一番上のカードをbase+i(A⇔Kループ)に変換する。空の列は無視(カウントしない)。
// 一番上がワイルドの列は変換しない(ただし順番はカウントする)。
function stairAlignTopCards(wave: WaveState, deckComposition: DeckCard[]): { wave: WaveState; deckComposition: DeckCard[] } {
  const nonEmptyCols = wave.tableau.map((_, i) => i).filter(i => wave.tableau[i].length > 0)
  if (nonEmptyCols.length === 0) return { wave, deckComposition }
  const baseCol = wave.tableau[nonEmptyCols[0]]
  const baseRank = baseCol[baseCol.length - 1].rank
  const rankByDeckId = new Map<number, Rank>()
  const tableau = wave.tableau.map((col, ci) => {
    const order = nonEmptyCols.indexOf(ci)
    if (order === -1) return col
    const topCard = col[col.length - 1]
    if (topCard.wild) return col
    const newRank = (((baseRank - 1 + order) % 13) + 1) as Rank
    rankByDeckId.set(topCard.deckId, newRank)
    return [...col.slice(0, -1), { ...topCard, rank: newRank }]
  })
  const newComposition = deckComposition.map(entry => (rankByDeckId.has(entry.deckId) ? { ...entry, rank: rankByDeckId.get(entry.deckId) as Rank } : entry))
  return { wave: { ...wave, tableau }, deckComposition: newComposition }
}

// 場札の全ての列の一番上(末尾)のカード(ワイルド含む)を廃棄する。deckComposition側は削除せず
// removed:trueにする(deckIdの採番が配列長基準のため、削除すると新規カード追加時に衝突しうる)。
function discardColumnTops(wave: WaveState, deckComposition: DeckCard[]): { wave: WaveState; deckComposition: DeckCard[] } {
  const discardedDeckIds = new Set<number>()
  const tableau = wave.tableau.map(col => {
    if (col.length === 0) return col
    discardedDeckIds.add(col[col.length - 1].deckId)
    return col.slice(0, -1)
  })
  const newComposition = deckComposition.map(entry => (discardedDeckIds.has(entry.deckId) ? { ...entry, removed: true } : entry))
  return { wave: { ...wave, tableau }, deckComposition: newComposition }
}

// 場札の非ワイルド実カードから最大ランク・最小ランクをそれぞれ1枚(該当が複数あればランダムに1枚)選んでワイルド化する。
function wildifyExtremeRanks(wave: WaveState, deckComposition: DeckCard[], rand: () => number): { wave: WaveState; deckComposition: DeckCard[] } {
  const realCards = wave.tableau.flat().filter(c => !c.wild)
  if (realCards.length === 0) return { wave, deckComposition }
  const maxRank = Math.max(...realCards.map(c => c.rank))
  const minRank = Math.min(...realCards.map(c => c.rank))
  const maxCandidates = realCards.filter(c => c.rank === maxRank)
  const target1 = pickRandom(maxCandidates, rand)
  // maxRank === minRank(場札の実カードが全て同ランク等)の場合、target1自身がminCandidatesに
  // 再度含まれてしまうと同じカードが二重に選ばれるため、target1のdeckIdを候補から除外する
  const minCandidates = realCards.filter(c => c.rank === minRank && c.deckId !== target1.deckId)
  const target2 = minCandidates.length > 0 ? pickRandom(minCandidates, rand) : null
  const targetDeckIds = new Set([target1.deckId, ...(target2 ? [target2.deckId] : [])])
  const tableau = wave.tableau.map(col => col.map(cardEl => (targetDeckIds.has(cardEl.deckId) ? { ...cardEl, wild: true } : cardEl)))
  const newComposition = deckComposition.map(entry => (targetDeckIds.has(entry.deckId) ? { ...entry, wild: true } : entry))
  return { wave: { ...wave, tableau }, deckComposition: newComposition }
}

// 選んだ列を、先頭カードのランクを起点に階段状のランク(A⇔Kループ)へ再配置する。方向(昇順/降順)は使用ごとにランダム。
// 秘儀「雷光(raidho)」と同じアルゴリズムだが、deckCompositionにも書き込んで効果を永続化する点が異なる。
// 他の天啓関数と異なり、ワイルドカードもスキップせずランク変換の対象にする(秘儀「雷光」の挙動に合わせるため意図的な仕様。skip忘れではない)。
function convertColumnToStair(wave: WaveState, deckComposition: DeckCard[], colIndex: number, rand: () => number): { wave: WaveState; deckComposition: DeckCard[] } {
  const col = wave.tableau[colIndex]
  if (!col || col.length === 0) return { wave, deckComposition }
  const baseRank = col[0].rank
  const dir = rand() < 0.5 ? 1 : -1
  const rankByDeckId = new Map<number, Rank>()
  const newCol = col.map((cardEl, i) => {
    const newRank = (((baseRank - 1 + dir * i) % 13 + 13) % 13 + 1) as Rank
    rankByDeckId.set(cardEl.deckId, newRank)
    return { ...cardEl, rank: newRank }
  })
  const tableau = wave.tableau.map((c, i) => (i === colIndex ? newCol : c))
  const newComposition = deckComposition.map(entry => (rankByDeckId.has(entry.deckId) ? { ...entry, rank: rankByDeckId.get(entry.deckId) as Rank } : entry))
  return { wave: { ...wave, tableau }, deckComposition: newComposition }
}

// チェーンの末尾1枚をワイルド化する。秘儀「対話(perthro)」と同じ効果だが、deckCompositionにも
// 書き込んで永続化する点が異なる。チェーンが空の場合は何もしない。
function wildifyChainTop(wave: WaveState, deckComposition: DeckCard[]): { wave: WaveState; deckComposition: DeckCard[] } {
  if (wave.chain.length === 0) return { wave, deckComposition }
  const chain = [...wave.chain]
  const target = chain[chain.length - 1]
  chain[chain.length - 1] = { ...target, wild: true }
  const newComposition = deckComposition.map(entry => (entry.deckId === target.deckId && !entry.wild ? { ...entry, wild: true } : entry))
  return { wave: { ...wave, chain, foundation: chain[chain.length - 1] }, deckComposition: newComposition }
}

// 場札の非ワイルド実カードからランダムにn枚選んでワイルド化する。秘儀「賜物(ansuz)」と同じ方式
// (盤面上の位置(列・行)を2次元でランダム抽選する)だが、deckCompositionにも書き込んで永続化する点が異なる。
function wildifyRandomTableauCards(wave: WaveState, deckComposition: DeckCard[], n: number, rand: () => number): { wave: WaveState; deckComposition: DeckCard[] } {
  const positions: { ci: number; ri: number }[] = []
  wave.tableau.forEach((col, ci) => col.forEach((c, ri) => { if (!c.wild) positions.push({ ci, ri }) }))
  shuffleInPlace(positions, rand)
  const picked = positions.slice(0, n)
  const targetKeys = new Set(picked.map(p => `${p.ci}-${p.ri}`))
  const targetDeckIds = new Set(picked.map(p => wave.tableau[p.ci][p.ri].deckId))
  const tableau = wave.tableau.map((col, ci) => col.map((c, ri) => (targetKeys.has(`${ci}-${ri}`) ? { ...c, wild: true } : c)))
  const newComposition = deckComposition.map(entry => (targetDeckIds.has(entry.deckId) ? { ...entry, wild: true } : entry))
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
    case 'hitsu':
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
    case 'heki':
      return convertTableauSuitCycle(wave, deckComposition)
    case 'kei':
      return stairAlignTopCards(wave, deckComposition)
    case 'rou':
      return discardColumnTops(wave, deckComposition)
    case 'i':
      return wildifyExtremeRanks(wave, deckComposition, rand)
    case 'hitsu':
      return targetCol === null ? { wave, deckComposition } : convertColumnToStair(wave, deckComposition, targetCol, rand)
    case 'shi':
      return wildifyChainTop(wave, deckComposition)
    case 'sei':
      return wildifyRandomTableauCards(wave, deckComposition, params.revelations.sei.n, rand)
    case 'subaru':
      return { wave, deckComposition }
    case 'ryuu':
      return { wave, deckComposition }
    case 'hotori':
      return { wave, deckComposition }
    case 'chou':
      return { wave, deckComposition }
    case 'yoku':
      return { wave, deckComposition }
    case 'mitsu':
      return { wave, deckComposition }
  }
}
