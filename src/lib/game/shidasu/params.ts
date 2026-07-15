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
    bridge: { name: string }
    grace: { name: string }
    patience: { name: string; x: number }
    purify: { name: string; n: number }
    temperance: { name: string; x: number }
    springBreeze: { name: string; n: number }
    summerBreeze: { name: string; n: number }
    autumnBreeze: { name: string; n: number }
    winterBreeze: { name: string; n: number }
    kinship: { name: string; n: number }
    thaw: { name: string; n: number }
    dusk: { name: string; n: number }
    dawn: { name: string; n: number }
    wit: { name: string; n: number }
    courage: { name: string; x: number }
    daybreak: { name: string; c: number; x: number }
    twilight: { name: string; c: number; x: number }
    cheerful: { name: string; n: number }
    conscience: { name: string; n: number }
    morningMist: { name: string; c: number; x: number }
    calm: { name: string; n: number }
    serenity: { name: string; x: number }
    destiny: { name: string; n: number }
    fate: { name: string; x: number }
    relief: { name: string; n: number }
    verdantGreen: { name: string; x: number }
    gem: { name: string; x: number }
    resolve: { name: string; x: number }
    grail: { name: string; x: number }
    moonlight: { name: string; x: number }
    sunlight: { name: string; x: number }
    crown: { name: string; x: number }
    cloverLeaf: { name: string; n: number }
    coin: { name: string; n: number }
    blade: { name: string; n: number }
    chalice: { name: string; n: number }
    balance: { name: string; n: number }
    harmony: { name: string; x: number }
    nobility: { name: string; n: number }
    tenacity: { name: string; x: number }
    determination: { name: string; x: number }
    cycle: { name: string; x: number }
    reincarnation: { name: string; x: number }
    majesty: { name: string; x: number }
    omen: { name: string; m: number; x: number }
    crescent: { name: string; m: number; x: number }
    blessing: { name: string; x: number }
    focus: { name: string; x: number }
    lapis: { name: string; x: number }
    jade: { name: string; n: number }
    emptyMind: { name: string; x: number }
    prologue: { name: string; n: number }
    interlude: { name: string; m: number; n: number }
    morningDew: { name: string; n: number }
    drizzle: { name: string; n: number }
    eternity: { name: string }
    abundance: { name: string }
    silence: { name: string }
    resilience: { name: string; p: number }
    gentleBreeze: { name: string; n: number }
    resonance: { name: string; x: number }
    azureSky: { name: string; x: number }
    amber: { name: string; x: number }
    composure: { name: string; n: number }
    clarity: { name: string; n: number }
    arrogance: { name: string; x: number }
    echo: { name: string; n: number }
    shootingStar: { name: string; c: number; n: number }
    naive: { name: string }
    intuition: { name: string; x: number }
    sincerity: { name: string; n: number }
    promise: { name: string }
    darkClouds: { name: string; r: number }
    regeneration: { name: string; p: number }
    benevolence: { name: string }
    healing: { name: string }
    guidance: { name: string }
    passion: { name: string; x: number }
    fightingSpirit: { name: string; x: number }
    sanctify: { name: string }
    protection: { name: string; c: number }
    earth: { name: string; c: number }
    golden: { name: string }
    morningStar: { name: string; x: number }
    mercy: { name: string; c: number; x: number }
    mirror: { name: string }
    deadline: { name: string; n: number }
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
    bridge: { name: '架橋' },
    grace: { name: '寛容' },
    patience: { name: '忍耐', x: 500 },
    purify: { name: '浄化', n: 10000 },
    temperance: { name: '節制', x: 0.1 },
    springBreeze: { name: '春風', n: 100 },
    summerBreeze: { name: '夏風', n: 100 },
    autumnBreeze: { name: '秋風', n: 100 },
    winterBreeze: { name: '冬風', n: 100 },
    kinship: { name: '友愛', n: 200 },
    thaw: { name: '雪解', n: 200 },
    dusk: { name: '宵闇', n: 100 },
    dawn: { name: '払暁', n: 100 },
    wit: { name: '機知', n: 200 },
    courage: { name: '勇気', x: 0.1 },
    daybreak: { name: '暁', c: 3, x: 2 },
    twilight: { name: '黄昏', c: 8, x: 2 },
    cheerful: { name: '快活', n: 50 },
    conscience: { name: '良心', n: 50 },
    morningMist: { name: '朝霧', c: 5, x: 3 },
    calm: { name: '平穏', n: 200 },
    serenity: { name: '安寧', x: 1.5 },
    destiny: { name: '運命', n: 300 },
    fate: { name: '宿命', x: 2.0 },
    relief: { name: '安堵', n: 100 },
    verdantGreen: { name: '深緑', x: 3 },
    gem: { name: '宝石', x: 3 },
    resolve: { name: '真剣', x: 3 },
    grail: { name: '聖杯', x: 3 },
    moonlight: { name: '月光', x: 1.5 },
    sunlight: { name: '陽光', x: 1.5 },
    crown: { name: '王冠', x: 0.5 },
    cloverLeaf: { name: '青葉', n: 50 },
    coin: { name: '硬貨', n: 50 },
    blade: { name: '武器', n: 50 },
    chalice: { name: '献杯', n: 50 },
    balance: { name: '均衡', n: 200 },
    harmony: { name: '調和', x: 1.5 },
    nobility: { name: '高潔', n: 200 },
    tenacity: { name: '執念', x: 0.1 },
    determination: { name: '覚悟', x: 0.1 },
    cycle: { name: '循環', x: 3 },
    reincarnation: { name: '輪廻', x: 10 },
    majesty: { name: '威光', x: 50 },
    omen: { name: '兆し', m: 20, x: 1.5 },
    crescent: { name: '三日月', m: 10, x: 3 },
    blessing: { name: '恩寵', x: 1.5 },
    focus: { name: '集中', x: 3 },
    lapis: { name: '瑠璃', x: 2 },
    jade: { name: '翡翠', n: 200 },
    emptyMind: { name: '無心', x: 4 },
    prologue: { name: '序章', n: 500 },
    interlude: { name: '幕間', m: 5, n: 1000 },
    morningDew: { name: '朝露', n: 5000 },
    drizzle: { name: '小雨', n: 50 },
    eternity: { name: '永劫' },
    abundance: { name: '豊穣' },
    silence: { name: '静寂' },
    resilience: { name: '不屈', p: 30 },
    gentleBreeze: { name: '微風', n: 100 },
    resonance: { name: '共鳴', x: 0.3 },
    azureSky: { name: '蒼穹', x: 0.3 },
    amber: { name: '琥珀', x: 0.1 },
    composure: { name: '沈着', n: 500 },
    clarity: { name: '冷静', n: 500 },
    arrogance: { name: '慢心', x: 50 },
    echo: { name: '残響', n: 200 },
    shootingStar: { name: '流星', c: 10, n: 1000 },
    naive: { name: '素朴' },
    intuition: { name: '直感', x: 0.3 },
    sincerity: { name: '誠実', n: 300 },
    promise: { name: '約束' },
    darkClouds: { name: '暗雲', r: 1 },
    regeneration: { name: '再生', p: 50 },
    benevolence: { name: '博愛' },
    healing: { name: '治癒' },
    guidance: { name: '導き' },
    passion: { name: '情熱', x: 1.5 },
    fightingSpirit: { name: '闘志', x: 1.3 },
    sanctify: { name: '祝福' },
    protection: { name: '庇護', c: 3 },
    earth: { name: '大地', c: 2 },
    golden: { name: '黄金' },
    morningStar: { name: '明星', x: 0.2 },
    mercy: { name: '慈悲', c: 3, x: 1.5 },
    mirror: { name: '水鏡' },
    deadline: { name: '刻限', n: 10 },
  },
  flow: { wavesPerStage: 3, clearDelayMs: 450 },
  ui: { comboTierThresholds: [3, 5, 8], chainCardOffsetX: 30, chainCardsPerRow: 10 },
}

export function loadParams(): ShidasuParams {
  return shidasuConfigJson as ShidasuParams
}
