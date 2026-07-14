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
    calm: { n: number }
    serenity: { x: number }
    destiny: { n: number }
    fate: { x: number }
    relief: { n: number }
    verdantGreen: { x: number }
    gem: { x: number }
    resolve: { x: number }
    grail: { x: number }
    moonlight: { x: number }
    sunlight: { x: number }
    crown: { x: number }
    cloverLeaf: { n: number }
    coin: { n: number }
    blade: { n: number }
    chalice: { n: number }
    balance: { n: number }
    harmony: { x: number }
    nobility: { n: number }
    tenacity: { x: number }
    determination: { x: number }
    cycle: { x: number }
    reincarnation: { x: number }
    majesty: { x: number }
    omen: { m: number; x: number }
    crescent: { m: number; x: number }
    blessing: { x: number }
    focus: { x: number }
    lapis: { x: number }
    jade: { n: number }
    emptyMind: { x: number }
    prologue: { n: number }
    interlude: { m: number; n: number }
    morningDew: { n: number }
    drizzle: { n: number }
    resilience: { p: number }
    gentleBreeze: { n: number }
    resonance: { x: number }
    azureSky: { x: number }
    amber: { x: number }
    composure: { n: number }
    clarity: { n: number }
    arrogance: { x: number }
    echo: { n: number }
    shootingStar: { c: number; n: number }
    naive: Record<string, never>
    intuition: { x: number }
    sincerity: { n: number }
    promise: Record<string, never>
    darkClouds: { r: number }
    regeneration: { p: number }
    benevolence: Record<string, never>
    healing: Record<string, never>
    guidance: Record<string, never>
    passion: { x: number }
    fightingSpirit: { x: number }
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
    calm: { n: 200 },
    serenity: { x: 1.5 },
    destiny: { n: 300 },
    fate: { x: 2.0 },
    relief: { n: 100 },
    verdantGreen: { x: 3 },
    gem: { x: 3 },
    resolve: { x: 3 },
    grail: { x: 3 },
    moonlight: { x: 1.5 },
    sunlight: { x: 1.5 },
    crown: { x: 0.5 },
    cloverLeaf: { n: 50 },
    coin: { n: 50 },
    blade: { n: 50 },
    chalice: { n: 50 },
    balance: { n: 200 },
    harmony: { x: 1.5 },
    nobility: { n: 200 },
    tenacity: { x: 0.1 },
    determination: { x: 0.1 },
    cycle: { x: 3 },
    reincarnation: { x: 10 },
    majesty: { x: 50 },
    omen: { m: 20, x: 1.5 },
    crescent: { m: 10, x: 3 },
    blessing: { x: 1.5 },
    focus: { x: 3 },
    lapis: { x: 2 },
    jade: { n: 200 },
    emptyMind: { x: 4 },
    prologue: { n: 500 },
    interlude: { m: 5, n: 1000 },
    morningDew: { n: 5000 },
    drizzle: { n: 50 },
    resilience: { p: 30 },
    gentleBreeze: { n: 100 },
    resonance: { x: 0.3 },
    azureSky: { x: 0.3 },
    amber: { x: 0.1 },
    composure: { n: 500 },
    clarity: { n: 500 },
    arrogance: { x: 50 },
    echo: { n: 200 },
    shootingStar: { c: 10, n: 1000 },
    naive: {},
    intuition: { x: 0.3 },
    sincerity: { n: 300 },
    promise: {},
    darkClouds: { r: 1 },
    regeneration: { p: 50 },
    benevolence: {},
    healing: {},
    guidance: {},
    passion: { x: 1.5 },
    fightingSpirit: { x: 1.3 },
  },
  flow: { wavesPerStage: 3, clearDelayMs: 450 },
  ui: { comboTierThresholds: [3, 5, 8], chainCardOffsetX: 30, chainCardsPerRow: 10 },
}

export function loadParams(): ShidasuParams {
  return shidasuConfigJson as ShidasuParams
}
