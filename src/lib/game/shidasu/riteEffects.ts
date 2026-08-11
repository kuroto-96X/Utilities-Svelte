import type { Card, Rank, Suit, WaveState, RiteId } from './types'
import type { ShidasuParams } from './params'
import { shuffleInPlace } from './deck'
import { isFace } from './patterns'

function pickRandom<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)]
}

function applyRaidho(wave: WaveState, rand: () => number): WaveState {
  const positions: { ci: number; ri: number }[] = []
  wave.tableau.forEach((col, ci) => col.forEach((c, ri) => {
    if (!c.wild && !isFace(c)) positions.push({ ci, ri })
  }))
  if (positions.length === 0) return wave
  const picked = positions.map(p => wave.tableau[p.ci][p.ri])
  const pool = [...wave.stock, ...picked]
  shuffleInPlace(pool, rand)
  const refill = pool.slice(0, positions.length)
  const stock = pool.slice(positions.length)
  const tableau = wave.tableau.map(col => [...col])
  positions.forEach((p, i) => { tableau[p.ci][p.ri] = refill[i] })
  return { ...wave, tableau, stock }
}

function applyWunjo(wave: WaveState, rand: () => number): WaveState {
  const pool = [...wave.tableau.flat(), ...wave.discardPile]
  shuffleInPlace(pool, rand)
  let cursor = 0
  const tableau = wave.tableau.map(col => {
    const take = col.length
    const newCol = pool.slice(cursor, cursor + take)
    cursor += take
    return newCol
  })
  const discardPile = pool.slice(cursor)
  return { ...wave, tableau, discardPile }
}

function applyOthala(wave: WaveState, rand: () => number): WaveState {
  const rankCounts = new Map<Rank, number>()
  wave.stock.forEach(c => rankCounts.set(c.rank, (rankCounts.get(c.rank) ?? 0) + 1))
  if (rankCounts.size === 0) return wave
  const maxCount = Math.max(...rankCounts.values())
  const candidates = [...rankCounts.entries()].filter(([, count]) => count === maxCount).map(([rank]) => rank)
  const targetRank = pickRandom(candidates, rand)
  const drawn = wave.stock.filter(c => c.rank === targetRank)
  const stock = wave.stock.filter(c => c.rank !== targetRank)
  const cols = wave.tableau.length
  const pool = [...wave.tableau.flat(), ...drawn]
  shuffleInPlace(pool, rand)
  const tableau: Card[][] = Array.from({ length: cols }, () => [])
  pool.forEach((c, i) => { tableau[i % cols].push(c) })
  return { ...wave, tableau, stock }
}

function applyPerthro(wave: WaveState): WaveState {
  const stock = [...wave.stock]
  const tableau = wave.tableau.map(col => {
    const need = Math.max(0, wave.dealtRows - col.length)
    const picked: Card[] = []
    for (let i = 0; i < need && stock.length > 0; i++) picked.push(stock.pop() as Card)
    return [...col, ...picked]
  })
  return { ...wave, tableau, stock }
}

function applyTiwaz(wave: WaveState): WaveState {
  const tableau = wave.tableau.map(col => [...col].reverse())
  return { ...wave, tableau }
}

function applyLaguz(wave: WaveState, rand: () => number): WaveState {
  const emptyCols = wave.tableau.map((_, i) => i).filter(i => wave.tableau[i].length === 0)
  if (emptyCols.length === 0) return wave
  const ci = pickRandom(emptyCols, rand)
  const stock = [...wave.stock]
  const picked: Card[] = []
  for (let i = 0; i < wave.dealtRows && stock.length > 0; i++) picked.push(stock.pop() as Card)
  const tableau = wave.tableau.map((col, i) => (i === ci ? picked : col))
  return { ...wave, tableau, stock }
}

function applyAnsuz(wave: WaveState): WaveState {
  if (wave.stock.length === 0) return wave
  const stock = [...wave.stock]
  const drawn = stock.pop() as Card
  return {
    ...wave,
    stock,
    chain: [drawn],
    chainOrigin: ['draw'],
    foundation: drawn,
    linked: false,
    discardPile: [...wave.discardPile, ...wave.chain],
    columnsEmptiedThisCombo: 0,
    comboStreakColumnLengths: wave.tableau.map(col => col.length),
    drawContinueCountThisChain: 0,
    roleFiredThisChain: false,
    flushActiveThisCombo: false,
    sameColumnStreak: 0,
    lastPlayedColumn: null,
  }
}

function applyKenaz(wave: WaveState, rand: () => number): WaveState {
  const pool = [...wave.stock, ...wave.tableau.flat()]
  const suits: Suit[] = ['♠', '♥', '♦', '♣', '★']
  const groups = new Map<Suit, Card[]>(suits.map(s => [s, []]))
  pool.forEach(c => groups.get(c.suit)!.push(c))
  const ordered = suits
    .filter(s => groups.get(s)!.length > 0)
    .sort((a, b) => groups.get(b)!.length - groups.get(a)!.length)
  const dealSequence: Card[] = []
  ordered.forEach(s => {
    const group = [...groups.get(s)!]
    shuffleInPlace(group, rand)
    dealSequence.push(...group)
  })
  let cursor = 0
  const tableau = wave.tableau.map(col => {
    const take = col.length
    const newCol = dealSequence.slice(cursor, cursor + take)
    cursor += take
    return newCol
  })
  const stock = dealSequence.slice(cursor)
  return { ...wave, tableau, stock }
}

function applyThurisaz(wave: WaveState, x: number): WaveState {
  return { ...wave, nextPlayScoreMultiplier: x }
}

function applyJera(wave: WaveState, rand: () => number): WaveState {
  const tableau = wave.tableau.map(col => {
    if (col.length === 0) return col
    const dir = rand() < 0.5 ? 1 : -1
    return [...col].sort((a, b) => dir * (a.rank - b.rank))
  })
  return { ...wave, tableau }
}

function applyUruz(wave: WaveState, n: number): WaveState {
  if (wave.comboFrozenThisWave) return wave
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

function applyEihwaz(wave: WaveState, n: number): WaveState {
  return { ...wave, comboResetShieldRemaining: wave.comboResetShieldRemaining + n }
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
  if (wave.comboFrozenThisWave) return wave
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
    case 'perthro':
      return wave.stock.length > 0 && wave.tableau.some(col => col.length < wave.dealtRows)
    case 'laguz':
      return wave.stock.length > 0 && wave.tableau.some(col => col.length === 0)
    case 'ansuz':
      return wave.stock.length > 0
    case 'othala':
      return wave.stock.length > 0
    case 'raidho':
      return wave.tableau.some(col => col.some(c => !c.wild && !isFace(c)))
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
      return applyTiwaz(wave)
    case 'laguz':
      return applyLaguz(wave, rand)
    case 'eihwaz':
      return applyEihwaz(wave, params.rites.eihwaz.n)
    case 'ansuz':
      return applyAnsuz(wave)
    case 'kenaz':
      return applyKenaz(wave, rand)
    case 'thurisaz':
      return applyThurisaz(wave, params.rites.thurisaz.x)
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
