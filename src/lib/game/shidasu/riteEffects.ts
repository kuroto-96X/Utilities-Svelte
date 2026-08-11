import type { Card, Rank, WaveState, RiteId } from './types'
import type { ShidasuParams } from './params'
import { shuffleInPlace } from './deck'

function pickRandom<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)]
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
    default:
      return true
  }
}

// 指定した秘儀の効果を適用した新しいWaveStateを返す。所持からの削除はengine.tsのuseRite側で行う。
export function applyRiteEffect(params: ShidasuParams, wave: WaveState, riteId: RiteId, rand: () => number): WaveState {
  switch (riteId) {
    case 'jera':
      return applyJera(wave, rand)
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
    case 'eihwaz':
      return applyEihwaz(wave, params.rites.eihwaz.n)
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
