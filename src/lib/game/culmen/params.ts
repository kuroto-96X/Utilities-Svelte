// src/lib/game/culmen/params.ts
import culmenConfigJson from './culmen.config.json'
import type { StageModifier } from './types'

export interface CulmenParams {
  layout: {
    cols: number
    rows: number
  }
  scoring: {
    basePoint: number
    suitBonus: number
    colorBonus: number
    stairBonus: number
    stairMinLen: number
    wildSuitBonus: number
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
    redBonusValue: number
    faceBonusValue: number
    shieldChargesPerPick: number
    extraStockCount: number
    wildPerPick: number
    startCombo: number
    fullClearItemBonus: number
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

export const DEFAULT_PARAMS: CulmenParams = {
  layout: { cols: 7, rows: 5 },
  scoring: {
    basePoint: 100,
    suitBonus: 100,
    colorBonus: 50,
    stairBonus: 150,
    stairMinLen: 3,
    wildSuitBonus: 100,
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
    redBonusValue: 50,
    faceBonusValue: 100,
    shieldChargesPerPick: 1,
    extraStockCount: 5,
    wildPerPick: 1,
    startCombo: 1,
    fullClearItemBonus: 3000,
  },
  flow: { wavesPerStage: 3, clearDelayMs: 450 },
  ui: { comboTierThresholds: [3, 5, 8], chainCardOffsetX: 30, chainCardsPerRow: 10 },
}

export function loadParams(): CulmenParams {
  return culmenConfigJson as CulmenParams
}
