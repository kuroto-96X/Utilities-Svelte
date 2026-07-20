import type { Card, Rank, Suit, WaveState, RiteId } from './types'
import type { ShidasuParams } from './params'
import { isRed, isFace } from './patterns'
import { shuffleInPlace } from './deck'

function pickRandom<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)]
}

function applyRaidho(wave: WaveState, rand: () => number): WaveState {
  const nonEmptyCols = wave.tableau.map((_, i) => i).filter(i => wave.tableau[i].length > 0)
  if (nonEmptyCols.length === 0) return wave
  const ci = pickRandom(nonEmptyCols, rand)
  const col = wave.tableau[ci]
  const baseRank = col[0].rank
  const dir = rand() < 0.5 ? 1 : -1
  const newCol = col.map((c, i) => ({ ...c, rank: (((baseRank - 1 + dir * i) % 13 + 13) % 13 + 1) as Rank }))
  return { ...wave, tableau: wave.tableau.map((c, i) => (i === ci ? newCol : c)) }
}

function applyJera(wave: WaveState, rand: () => number): WaveState {
  const tableau = wave.tableau.map(col => {
    if (col.length === 0) return col
    const dir = rand() < 0.5 ? 1 : -1
    return [...col].sort((a, b) => dir * (a.rank - b.rank))
  })
  return { ...wave, tableau }
}

function applyWunjo(wave: WaveState, rand: () => number): WaveState {
  const realCards = wave.tableau.flat().filter(c => !c.wild)
  const redCount = realCards.filter(isRed).length
  const blackCount = realCards.length - redCount
  const toRed = redCount === blackCount ? rand() < 0.5 : redCount > blackCount
  const suits: Suit[] = toRed ? ['♥', '♦'] : ['♠', '♣']
  const tableau = wave.tableau.map(col => col.map(c => (c.wild ? c : { ...c, suit: pickRandom(suits, rand) })))
  return { ...wave, tableau }
}

function applyOthala(wave: WaveState, rand: () => number): WaveState {
  const realCards = wave.tableau.flat().filter(c => !c.wild)
  const suits: Suit[] = ['♠', '♥', '♦', '♣']
  const counts = suits.map(s => realCards.filter(c => c.suit === s).length)
  const maxCount = Math.max(...counts)
  const candidates = suits.filter((_, i) => counts[i] === maxCount)
  const target = pickRandom(candidates, rand)
  const tableau = wave.tableau.map(col => col.map(c => (c.wild ? c : { ...c, suit: target })))
  return { ...wave, tableau }
}

function applyPerthro(wave: WaveState): WaveState {
  if (wave.chain.length === 0) return wave
  const chain = [...wave.chain]
  chain[chain.length - 1] = { ...chain[chain.length - 1], wild: true }
  return { ...wave, chain, foundation: chain[chain.length - 1] }
}

function applyUruz(wave: WaveState, n: number): WaveState {
  const combo = wave.combo + n
  return { ...wave, combo, maxComboThisWave: Math.max(wave.maxComboThisWave, combo) }
}

function applyIngwaz(wave: WaveState, n: number): WaveState {
  return { ...wave, baseComboCount: wave.baseComboCount + n }
}

function applyGebo(wave: WaveState, rand: () => number): WaveState {
  const cols = wave.tableau.length
  if (wave.discardPile.length < cols) return wave
  const pool = [...wave.discardPile]
  shuffleInPlace(pool, rand)
  const picked = pool.slice(0, cols)
  const remaining = pool.slice(cols)
  const tableau = wave.tableau.map((col, i) => [...col, picked[i]])
  return { ...wave, tableau, discardPile: remaining }
}

function applyFehu(wave: WaveState): WaveState {
  const cols = wave.tableau.length
  if (wave.stock.length <= cols) return wave
  const stock = [...wave.stock]
  const picked: Card[] = []
  for (let i = 0; i < cols; i++) picked.push(stock.pop() as Card)
  const tableau = wave.tableau.map((col, i) => [...col, picked[i]])
  return { ...wave, tableau, stock }
}

function applyDagaz(wave: WaveState, rand: () => number): WaveState {
  const stock = [...wave.stock, ...wave.discardPile]
  shuffleInPlace(stock, rand)
  return { ...wave, stock, discardPile: [] }
}

function applyAlgiz(wave: WaveState): WaveState {
  return { ...wave, playFromAnywhereActiveThisWave: true }
}

function applyTiwaz(wave: WaveState, rand: () => number): WaveState {
  if (wave.chain.length < 2) return wave
  const realCards = wave.chain.filter(c => !c.wild)
  if (realCards.length === 0) return wave
  const suits: Suit[] = ['♠', '♥', '♦', '♣']
  const counts = suits.map(s => realCards.filter(c => c.suit === s).length)
  const maxCount = Math.max(...counts)
  const candidates = suits.filter((_, i) => counts[i] === maxCount)
  const target = pickRandom(candidates, rand)
  const chain = wave.chain.map(c => (c.wild ? c : { ...c, suit: target }))
  return { ...wave, chain, foundation: chain[chain.length - 1] }
}

function applyLaguz(wave: WaveState, rand: () => number): WaveState {
  if (wave.chain.length < 2) return wave
  const realCards = wave.chain.filter(c => !c.wild)
  if (realCards.length === 0) return wave
  const redCount = realCards.filter(isRed).length
  const blackCount = realCards.length - redCount
  const toRed = redCount === blackCount ? rand() < 0.5 : redCount > blackCount
  const suits: Suit[] = toRed ? ['♥', '♦'] : ['♠', '♣']
  const chain = wave.chain.map(c => (c.wild ? c : { ...c, suit: pickRandom(suits, rand) }))
  return { ...wave, chain, foundation: chain[chain.length - 1] }
}

function applyEihwaz(wave: WaveState, n: number): WaveState {
  return { ...wave, comboResetShieldRemaining: wave.comboResetShieldRemaining + n }
}

function applyAnsuz(wave: WaveState, n: number, rand: () => number): WaveState {
  const positions: { ci: number; ri: number }[] = []
  wave.tableau.forEach((col, ci) => col.forEach((c, ri) => { if (!c.wild) positions.push({ ci, ri }) }))
  shuffleInPlace(positions, rand)
  const targetKeys = new Set(positions.slice(0, n).map(p => `${p.ci}-${p.ri}`))
  const tableau = wave.tableau.map((col, ci) => col.map((c, ri) => (targetKeys.has(`${ci}-${ri}`) ? { ...c, wild: true } : c)))
  return { ...wave, tableau }
}

function applyKenaz(wave: WaveState, rand: () => number): WaveState {
  const faceRanks: Rank[] = [11, 12, 13]
  const tableau = wave.tableau.map(col =>
    col.map(c => (!c.wild && !isFace(c) ? { ...c, rank: pickRandom(faceRanks, rand) } : c))
  )
  return { ...wave, tableau }
}

function applyThurisaz(wave: WaveState, rand: () => number): WaveState {
  const nonFaceRanks: Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  const tableau = wave.tableau.map(col =>
    col.map(c => (!c.wild && isFace(c) ? { ...c, rank: pickRandom(nonFaceRanks, rand) } : c))
  )
  return { ...wave, tableau }
}

function applyHagalaz(wave: WaveState, rand: () => number): WaveState {
  const pool = [...wave.tableau.flat(), ...wave.stock]
  shuffleInPlace(pool, rand)
  let cursor = 0
  const tableau = wave.tableau.map(col => {
    const take = col.length
    const newCol = pool.slice(cursor, cursor + take)
    cursor += take
    return newCol
  })
  const stock = pool.slice(cursor)
  return { ...wave, tableau, stock }
}

function applyNauthiz(wave: WaveState): WaveState {
  return { ...wave, nauthizActiveThisWave: true }
}

function applyIsa(wave: WaveState): WaveState {
  return { ...wave, comboFrozenThisWave: true }
}

function applySowilo(wave: WaveState): WaveState {
  return { ...wave, sowiloActiveThisWave: true }
}

function applyBerkano(wave: WaveState, x: number): WaveState {
  const combo = Math.floor(wave.combo * x)
  return { ...wave, combo, maxComboThisWave: Math.max(wave.maxComboThisWave, combo) }
}

function applyMannaz(wave: WaveState): WaveState {
  return { ...wave, mannazActiveThisWave: true }
}

function applyEhwaz(wave: WaveState): WaveState {
  return { ...wave, ehwazActiveThisWave: true }
}

// 秘儀が現在の盤面状態で使用可能か判定する(捨て札・山札の枚数不足、チェーン長不足などの条件)。
// UIのボタンdisabled判定に使う。
export function canUseRite(_params: ShidasuParams, wave: WaveState, riteId: RiteId): boolean {
  const cols = wave.tableau.length
  switch (riteId) {
    case 'gebo':
      return wave.discardPile.length >= cols
    case 'fehu':
      return wave.stock.length > cols
    case 'tiwaz':
    case 'laguz':
      return wave.chain.length >= 2
    default:
      return true
  }
}

// 指定した秘儀の効果を適用した新しいWaveStateを返す。所持からの削除はengine.tsのuseRite側で行う。
export function applyRiteEffect(params: ShidasuParams, wave: WaveState, riteId: RiteId, rand: () => number): WaveState {
  switch (riteId) {
    case 'raidho':
      return applyRaidho(wave, rand)
    case 'jera':
      return applyJera(wave, rand)
    case 'wunjo':
      return applyWunjo(wave, rand)
    case 'othala':
      return applyOthala(wave, rand)
    case 'perthro':
      return applyPerthro(wave)
    case 'uruz':
      return applyUruz(wave, params.rites.uruz.n)
    case 'ingwaz':
      return applyIngwaz(wave, params.rites.ingwaz.n)
    case 'gebo':
      return applyGebo(wave, rand)
    case 'fehu':
      return applyFehu(wave)
    case 'dagaz':
      return applyDagaz(wave, rand)
    case 'algiz':
      return applyAlgiz(wave)
    case 'tiwaz':
      return applyTiwaz(wave, rand)
    case 'laguz':
      return applyLaguz(wave, rand)
    case 'eihwaz':
      return applyEihwaz(wave, params.rites.eihwaz.n)
    case 'ansuz':
      return applyAnsuz(wave, params.rites.ansuz.n, rand)
    case 'kenaz':
      return applyKenaz(wave, rand)
    case 'thurisaz':
      return applyThurisaz(wave, rand)
    case 'hagalaz':
      return applyHagalaz(wave, rand)
    case 'nauthiz':
      return applyNauthiz(wave)
    case 'isa':
      return applyIsa(wave)
    case 'sowilo':
      return applySowilo(wave)
    case 'berkano':
      return applyBerkano(wave, params.rites.berkano.x)
    case 'mannaz':
      return applyMannaz(wave)
    case 'ehwaz':
      return applyEhwaz(wave)
  }
}
