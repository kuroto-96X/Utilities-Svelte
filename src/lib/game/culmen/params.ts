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
  }
}

export const DEFAULT_PARAMS: CulmenParams = {
  layout: { cols: 7, rows: 5 },
  scoring: {
    basePoint: 10,
    suitBonus: 10,
    colorBonus: 5,
    stairBonus: 15,
    stairMinLen: 3,
    wildSuitBonus: 10,
    clearBonus: 200,
  },
  stages: [
    { name: 'STAGE 1', modifier: 'none', targets: [400, 750, 1300] },
    { name: 'STAGE 2', modifier: 'noLoop', targets: [600, 1100, 1900] },
    { name: 'STAGE 3', modifier: 'faceLock', targets: [800, 1500, 2600] },
  ],
  items: {
    redBonusValue: 5,
    faceBonusValue: 10,
    shieldChargesPerPick: 1,
    extraStockCount: 5,
    wildPerPick: 1,
    startCombo: 1,
    fullClearItemBonus: 300,
  },
  flow: { wavesPerStage: 3, clearDelayMs: 450 },
  ui: { comboTierThresholds: [3, 5, 8] },
}

export function loadParams(): CulmenParams {
  return culmenConfigJson as CulmenParams
}
