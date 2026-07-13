// src/lib/game/shidasu/params.ts
import shidasuConfigJson from './shidasu.config.json'
import type { StageModifier } from './types'

export interface ShidasuParams {
  layout: {
    cols: number
    rows: number
  }
  scoring: {
    basePoint: number
    suitBonus: number
    colorBonus: number
    suitColorMinLen: number
    stairBonus: number
    stairMinLen: number
    clearBonus: number
    clearBonusPerStock: number
    comboMultiplierStep: number
    flushBonus: number
    royalSetBonus: number
    sameRankBonusUnit: number
    completeRunBonus: number
    completeRunSuitBonus: number
    columnSweepBonus: number
  }
  stages: Array<{
    name: string
    modifier: StageModifier
    targets: [number, number, number]
  }>
  items: {
    stairRelaxedMinLen: number
    columnSweepRelaxCards: number
    maxItems: number
  }
  talismans: {
    patience: { x: number }
    purify: { n: number }
    temperance: { x: number }
    springBreeze: { n: number }
    summerBreeze: { n: number }
    autumnBreeze: { n: number }
    winterBreeze: { n: number }
    kinship: { n: number }
    thaw: { n: number }
    dusk: { n: number }
    dawn: { n: number }
    wit: { n: number }
    courage: { x: number }
    daybreak: { c: number; x: number }
    twilight: { c: number; x: number }
    cheerful: { n: number }
    conscience: { n: number }
    morningMist: { c: number; x: number }
  }
  flow: {
    wavesPerStage: number
    clearDelayMs: number
  }
  ui: {
    comboTierThresholds: [number, number, number]
    chainCardOffsetX: number
    chainCardsPerRow: number
  }
}

export const DEFAULT_PARAMS: ShidasuParams = {
  layout: { cols: 7, rows: 5 },
  scoring: {
    basePoint: 100,
    suitBonus: 100,
    colorBonus: 50,
    suitColorMinLen: 3,
    stairBonus: 150,
    stairMinLen: 5,
    clearBonus: 2000,
    clearBonusPerStock: 50,
    comboMultiplierStep: 0.1,
    flushBonus: 300,
    royalSetBonus: 400,
    sameRankBonusUnit: 100,
    completeRunBonus: 1000,
    completeRunSuitBonus: 1000,
    columnSweepBonus: 150,
  },
  stages: [
    { name: 'STAGE 1', modifier: 'none', targets: [4000, 7500, 13000] },
    { name: 'STAGE 2', modifier: 'noLoop', targets: [6000, 11000, 19000] },
    { name: 'STAGE 3', modifier: 'faceLock', targets: [8000, 15000, 26000] },
  ],
  items: {
    stairRelaxedMinLen: 3,
    columnSweepRelaxCards: 2,
    maxItems: 5,
  },
  talismans: {
    patience: { x: 500 },
    purify: { n: 10000 },
    temperance: { x: 0.1 },
    springBreeze: { n: 100 },
    summerBreeze: { n: 100 },
    autumnBreeze: { n: 100 },
    winterBreeze: { n: 100 },
    kinship: { n: 200 },
    thaw: { n: 200 },
    dusk: { n: 100 },
    dawn: { n: 100 },
    wit: { n: 200 },
    courage: { x: 0.1 },
    daybreak: { c: 3, x: 2 },
    twilight: { c: 8, x: 2 },
    cheerful: { n: 50 },
    conscience: { n: 50 },
    morningMist: { c: 5, x: 3 },
  },
  flow: { wavesPerStage: 3, clearDelayMs: 450 },
  ui: { comboTierThresholds: [3, 5, 8], chainCardOffsetX: 30, chainCardsPerRow: 10 },
}

export function loadParams(): ShidasuParams {
  return shidasuConfigJson as ShidasuParams
}
