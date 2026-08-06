// src/lib/game/shidasu/params.ts
import shidasuConfigJson from './shidasu.config.json'
import type { Rarity } from './types'

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
    pairBonusUnit: number
    alternatingBonus: number
    alternatingMinLen: number
  }
  // Wave単位の新概念「星」の定義一覧。waveSlot(1/2/3)が一致する星の中からランダムに1つ選ばれる。
  // idは一意な文字列(管理画面での編集・参照に使う)。
  stars: {
    id: string
    name: string
    waveSlot: 1 | 2 | 3
    targetMultiplier: number
    reward: number
    restrictionKind: 'none' | 'noLoop' | 'faceLock' | 'lowCombo' | 'oddCombo' | 'suit' | 'face'
    maxCombo?: number
    // restrictionKindに対応するプレイヤー向け説明文テンプレート。{maxCombo}のような
    // プレースホルダーを含められる({(\w+)}パターンで展開、revelationDescと同じ方式)。
    // restrictionKind==='none'のときは空文字にする。
    descTemplate: string
  }[]
  // スプレッド(ラン開始時に選ぶ固有ルールセット)ごとの設定。目標スコア算出式
  // target(n) = waveTargetBase × waveTargetMultiplier^(n-1) の基礎値・倍率(nは通しウェーブ番号、1始まり)と、
  // ウェーブ開始時の配布行数への初期オフセット(initialExtraTableauRows)をスプレッドごとに持つ。
  // 暗雲護符・虚の天啓によるextraTableauRowsの加算は、この初期値を起点に通常通り行われる。
  spreads: {
    fool: { name: string; desc: string; initialExtraTableauRows: number; waveTargetBase: number; waveTargetMultiplier: number }
    moon: { name: string; desc: string; initialExtraTableauRows: number; waveTargetBase: number; waveTargetMultiplier: number }
  }
  items: {
    maxItems: number
  }
  currency: {
    name: string
    symbol: string
    initialAmount: number
    waveClearAmount: number
  }
  shop: {
    itemPrice: Record<Rarity, { buy: number; sell: number }>
    ritePrice: { buy: number; sell: number }
    revelationPrice: { buy: number; sell: number }
    oraclePrice: { buy: number; sell: number }
    // 護符/秘儀/天啓は3-1・5-1・7-2の3パターン、神託は3-1・5-1のみ(7-2は無し)
    packPrice: {
      item: { threeOne: number; fiveOne: number; sevenTwo: number }
      rite: { threeOne: number; fiveOne: number; sevenTwo: number }
      revelation: { threeOne: number; fiveOne: number; sevenTwo: number }
      oracle: { threeOne: number; fiveOne: number }
    }
  }
  talismans: {
    bridge: { name: string; m: number; rarity: Rarity; desc: string }
    grace: { name: string; m: number; rarity: Rarity; desc: string }
    patience: { name: string; x: number; rarity: Rarity; desc: string }
    purify: { name: string; n: number; rarity: Rarity; desc: string }
    temperance: { name: string; x: number; rarity: Rarity; desc: string }
    springBreeze: { name: string; n: number; rarity: Rarity; desc: string }
    summerBreeze: { name: string; n: number; rarity: Rarity; desc: string }
    autumnBreeze: { name: string; n: number; rarity: Rarity; desc: string }
    winterBreeze: { name: string; n: number; rarity: Rarity; desc: string }
    kinship: { name: string; n: number; rarity: Rarity; desc: string }
    thaw: { name: string; n: number; rarity: Rarity; desc: string }
    dusk: { name: string; n: number; rarity: Rarity; desc: string }
    dawn: { name: string; n: number; rarity: Rarity; desc: string }
    wit: { name: string; n: number; rarity: Rarity; desc: string }
    courage: { name: string; x: number; rarity: Rarity; desc: string }
    daybreak: { name: string; c: number; x: number; rarity: Rarity; desc: string }
    twilight: { name: string; c: number; x: number; rarity: Rarity; desc: string }
    cheerful: { name: string; n: number; rarity: Rarity; desc: string }
    conscience: { name: string; n: number; rarity: Rarity; desc: string }
    morningMist: { name: string; c: number; x: number; rarity: Rarity; desc: string }
    calm: { name: string; n: number; rarity: Rarity; desc: string }
    serenity: { name: string; x: number; rarity: Rarity; desc: string }
    destiny: { name: string; n: number; rarity: Rarity; desc: string }
    fate: { name: string; x: number; rarity: Rarity; desc: string }
    relief: { name: string; n: number; rarity: Rarity; desc: string }
    verdantGreen: { name: string; x: number; rarity: Rarity; desc: string }
    gem: { name: string; x: number; rarity: Rarity; desc: string }
    resolve: { name: string; x: number; rarity: Rarity; desc: string }
    grail: { name: string; x: number; rarity: Rarity; desc: string }
    moonlight: { name: string; x: number; rarity: Rarity; desc: string }
    sunlight: { name: string; x: number; rarity: Rarity; desc: string }
    crown: { name: string; x: number; rarity: Rarity; desc: string }
    cloverLeaf: { name: string; n: number; rarity: Rarity; desc: string }
    coin: { name: string; n: number; rarity: Rarity; desc: string }
    blade: { name: string; n: number; rarity: Rarity; desc: string }
    chalice: { name: string; n: number; rarity: Rarity; desc: string }
    balance: { name: string; n: number; rarity: Rarity; desc: string }
    harmony: { name: string; x: number; rarity: Rarity; desc: string }
    nobility: { name: string; n: number; rarity: Rarity; desc: string }
    tenacity: { name: string; x: number; rarity: Rarity; desc: string }
    determination: { name: string; x: number; rarity: Rarity; desc: string }
    cycle: { name: string; x: number; rarity: Rarity; desc: string }
    reincarnation: { name: string; x: number; rarity: Rarity; desc: string }
    majesty: { name: string; x: number; rarity: Rarity; desc: string }
    omen: { name: string; m: number; x: number; rarity: Rarity; desc: string }
    crescent: { name: string; m: number; x: number; rarity: Rarity; desc: string }
    blessing: { name: string; x: number; rarity: Rarity; desc: string }
    focus: { name: string; x: number; rarity: Rarity; desc: string }
    lapis: { name: string; x: number; rarity: Rarity; desc: string }
    jade: { name: string; n: number; rarity: Rarity; desc: string }
    emptyMind: { name: string; x: number; rarity: Rarity; desc: string }
    prologue: { name: string; n: number; rarity: Rarity; desc: string }
    interlude: { name: string; m: number; n: number; rarity: Rarity; desc: string }
    morningDew: { name: string; n: number; rarity: Rarity; desc: string }
    drizzle: { name: string; n: number; rarity: Rarity; desc: string }
    eternity: { name: string; rarity: Rarity; desc: string }
    abundance: { name: string; rarity: Rarity; desc: string }
    silence: { name: string; rarity: Rarity; desc: string }
    resilience: { name: string; p: number; rarity: Rarity; desc: string }
    gentleBreeze: { name: string; n: number; rarity: Rarity; desc: string }
    resonance: { name: string; x: number; rarity: Rarity; desc: string }
    azureSky: { name: string; x: number; rarity: Rarity; desc: string }
    amber: { name: string; x: number; rarity: Rarity; desc: string }
    composure: { name: string; n: number; rarity: Rarity; desc: string }
    clarity: { name: string; n: number; rarity: Rarity; desc: string }
    arrogance: { name: string; x: number; rarity: Rarity; desc: string }
    echo: { name: string; n: number; rarity: Rarity; desc: string }
    shootingStar: { name: string; c: number; p: number; rarity: Rarity; desc: string }
    naive: { name: string; rarity: Rarity; desc: string }
    intuition: { name: string; x: number; rarity: Rarity; desc: string }
    sincerity: { name: string; n: number; rarity: Rarity; desc: string }
    promise: { name: string; rarity: Rarity; desc: string }
    darkClouds: { name: string; r: number; rarity: Rarity; desc: string }
    regeneration: { name: string; p: number; rarity: Rarity; desc: string }
    benevolence: { name: string; rarity: Rarity; desc: string }
    healing: { name: string; rarity: Rarity; desc: string }
    guidance: { name: string; rarity: Rarity; desc: string }
    passion: { name: string; x: number; rarity: Rarity; desc: string }
    fightingSpirit: { name: string; x: number; rarity: Rarity; desc: string }
    sanctify: { name: string; rarity: Rarity; desc: string }
    protection: { name: string; c: number; rarity: Rarity; desc: string }
    earth: { name: string; c: number; rarity: Rarity; desc: string }
    golden: { name: string; rarity: Rarity; desc: string }
    morningStar: { name: string; x: number; rarity: Rarity; desc: string }
    mercy: { name: string; c: number; x: number; rarity: Rarity; desc: string }
    mirror: { name: string; rarity: Rarity; desc: string }
    deadline: { name: string; n: number; rarity: Rarity; desc: string }
    dedication: { name: string; n: number; rarity: Rarity; desc: string }
    diligence: { name: string; n: number; rarity: Rarity; desc: string }
    divineProtection: { name: string; n: number; rarity: Rarity; desc: string }
    fortitude: { name: string; n: number; rarity: Rarity; desc: string }
    waterMirror: { name: string; rarity: Rarity; desc: string }
    vow: { name: string; x: number; rarity: Rarity; desc: string }
    pact: { name: string; x: number; rarity: Rarity; desc: string }
    crimson: { name: string; rarity: Rarity; desc: string }
    jetBlack: { name: string; rarity: Rarity; desc: string }
    silver: { name: string; x: number; rarity: Rarity; desc: string }
    discretion: { name: string; n: number; rarity: Rarity; desc: string }
    frost: { name: string; x: number; rarity: Rarity; desc: string }
  }
  rites: {
    raidho: { name: string; desc: string }
    jera: { name: string; desc: string }
    wunjo: { name: string; desc: string }
    othala: { name: string; desc: string }
    perthro: { name: string; desc: string }
    uruz: { name: string; n: number; desc: string }
    ingwaz: { name: string; n: number; desc: string }
    gebo: { name: string; desc: string }
    fehu: { name: string; desc: string }
    dagaz: { name: string; desc: string }
    algiz: { name: string; desc: string }
    tiwaz: { name: string; desc: string }
    laguz: { name: string; desc: string }
    eihwaz: { name: string; n: number; desc: string }
    ansuz: { name: string; n: number; desc: string }
    kenaz: { name: string; desc: string }
    thurisaz: { name: string; desc: string }
    hagalaz: { name: string; desc: string }
    nauthiz: { name: string; desc: string }
    isa: { name: string; desc: string }
    sowilo: { name: string; x: number; desc: string }
    berkano: { name: string; x: number; desc: string }
    mannaz: { name: string; x: number; desc: string }
    ehwaz: { name: string; desc: string }
  }
  revelations: {
    kaku: { name: string; desc: string }
    kou: { name: string; desc: string }
    tei: { name: string; desc: string }
    bou: { name: string; desc: string }
    shin: { name: string; desc: string }
    bi: { name: string; desc: string }
    ki: { name: string; desc: string }
    to: { name: string; desc: string }
    gyu: { name: string; desc: string }
    jo: { name: string; desc: string }
    kyo: { name: string; n: number; desc: string }
    aya: { name: string; desc: string }
  }
  oracles: {
    completeRun: { name: string; desc: string }
    royalSet: { name: string; desc: string }
    flush: { name: string; desc: string }
    stair: { name: string; desc: string }
    color: { name: string; desc: string }
    suit: { name: string; desc: string }
    columnSweep: { name: string; desc: string }
    sameRank: { name: string; desc: string }
    pair: { name: string; desc: string }
    alternating: { name: string; desc: string }
  }
  flow: {
    wavesPerStage: number
    clearDelayMs: number
    // ステージ基準点。target(stageIndex, waveIndex) = flow.stageTargetBase × flow.stageTargetMultiplier^stageIndex
    // × stageStars[waveIndex].targetMultiplier で算出する。
    stageTargetBase: number
    stageTargetMultiplier: number
    // このステージ数をクリアするとラン全体のクリアとなり、続行確認(continueChoice)を挟む。
    stagesPerRun: number
    // ステージ画面でWave3(waveSlot 3)の星をリロールする際に消費する固定コスト。
    rerollCost: number
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
    pairBonusUnit: 50,
    alternatingBonus: 80,
    alternatingMinLen: 4,
  },
  stars: [
    { id: 'ordinary-moon', name: '普通の衛星', waveSlot: 1, targetMultiplier: 1, reward: 3, restrictionKind: 'none', descTemplate: '' },
    { id: 'slightly-bigger-moon', name: '少し大きな衛星', waveSlot: 2, targetMultiplier: 1.5, reward: 4, restrictionKind: 'none', descTemplate: '' },
    { id: 'closed-loop-planet', name: '循環の閉じた荒廃惑星', waveSlot: 3, targetMultiplier: 2, reward: 5, restrictionKind: 'noLoop', descTemplate: 'A⇔Kループ禁止' },
    { id: 'sealed-noble-planet', name: '高貴なる封印の惑星', waveSlot: 3, targetMultiplier: 2, reward: 5, restrictionKind: 'faceLock', descTemplate: '絵札はコンボ2以上でのみ取得可' },
    { id: 'harsh-planet', name: '弱き者を拒む峻厳な惑星', waveSlot: 3, targetMultiplier: 2, reward: 5, restrictionKind: 'lowCombo', maxCombo: 2, descTemplate: '{maxCombo}コンボ以下で無得点' },
    { id: 'twisted-odd-planet', name: '奇数を忌む歪んだ惑星', waveSlot: 3, targetMultiplier: 2, reward: 5, restrictionKind: 'oddCombo', descTemplate: 'コンボが奇数のとき無得点' },
    { id: 'exiling-color-planet', name: '排斥の色殺す惑星', waveSlot: 3, targetMultiplier: 2, reward: 5, restrictionKind: 'suit', descTemplate: '{suit}で無得点' },
    { id: 'regicide-planet', name: '王侯を打ち滅ぼす惑星', waveSlot: 3, targetMultiplier: 2, reward: 5, restrictionKind: 'face', descTemplate: '絵札(J・Q・K)で無得点' },
  ],
  spreads: {
    fool: { name: '愚者', desc: '特殊ルールなし', initialExtraTableauRows: 0, waveTargetBase: 2000, waveTargetMultiplier: 1.5 },
    moon: { name: '月', desc: '場札は常に1行少ない状態で始まる(護符・天啓による行数変動は通常通り発生する)', initialExtraTableauRows: -1, waveTargetBase: 2000, waveTargetMultiplier: 1.5 },
  },
  items: {
    maxItems: 5,
  },
  currency: {
    name: '星片',
    symbol: '☆',
    initialAmount: 5,
    waveClearAmount: 5,
  },
  shop: {
    itemPrice: { C: { buy: 8, sell: 4 }, U: { buy: 16, sell: 8 }, R: { buy: 30, sell: 15 } },
    ritePrice: { buy: 12, sell: 6 },
    revelationPrice: { buy: 18, sell: 9 },
    oraclePrice: { buy: 15, sell: 7 },
    packPrice: {
      item: { threeOne: 20, fiveOne: 30, sevenTwo: 50 },
      rite: { threeOne: 20, fiveOne: 30, sevenTwo: 50 },
      revelation: { threeOne: 25, fiveOne: 38, sevenTwo: 63 },
      oracle: { threeOne: 22, fiveOne: 33 },
    },
  },
  talismans: {
    bridge: { name: '架橋', m: 2, rarity: 'C', desc: '階段・同スート・同色の成立に必要な枚数を{m}枚緩和' },
    grace: { name: '寛容', m: 2, rarity: 'C', desc: '列一掃ボーナスに必要な枚数を{m}枚緩和' },
    patience: { name: '忍耐', x: 500, rarity: 'C', desc: '全消しボーナスに残り山札枚数×{x}点を加算' },
    purify: { name: '浄化', n: 10000, rarity: 'C', desc: '全消しボーナスに{n}点を加算' },
    temperance: { name: '節制', x: 0.1, rarity: 'U', desc: '全消しボーナスを残り山札枚数×{x}分だけ倍加' },
    springBreeze: { name: '春風', n: 100, rarity: 'C', desc: 'クラブ(♣)を取ったとき、{n}点加算' },
    summerBreeze: { name: '夏風', n: 100, rarity: 'C', desc: 'ダイヤ(♦)を取ったとき、{n}点加算' },
    autumnBreeze: { name: '秋風', n: 100, rarity: 'C', desc: 'ハート(♥)を取ったとき、{n}点加算' },
    winterBreeze: { name: '冬風', n: 100, rarity: 'C', desc: 'スペード(♠)を取ったとき、{n}点加算' },
    kinship: { name: '友愛', n: 200, rarity: 'C', desc: '他のスートからハート(♥)を取ったとき、{n}点加算' },
    thaw: { name: '雪解', n: 200, rarity: 'C', desc: 'スペード(♠)から別のスートを取ったとき、{n}点加算' },
    dusk: { name: '宵闇', n: 100, rarity: 'C', desc: '赤から黒に変わったとき、{n}点加算' },
    dawn: { name: '払暁', n: 100, rarity: 'C', desc: '黒から赤に変わったとき、{n}点加算' },
    wit: { name: '機知', n: 200, rarity: 'C', desc: 'ワイルドを取ったとき、{n}点加算' },
    courage: { name: '勇気', x: 0.1, rarity: 'R', desc: 'コンボ数×{x}分、獲得点を倍加' },
    daybreak: { name: '暁', c: 3, x: 2, rarity: 'C', desc: 'コンボ数が{c}以下のとき、獲得点を{x}倍' },
    twilight: { name: '黄昏', c: 8, x: 2, rarity: 'C', desc: 'コンボ数が{c}以上のとき、獲得点を{x}倍' },
    cheerful: { name: '快活', n: 50, rarity: 'C', desc: 'コンボ数が偶数のとき、{n}点加算' },
    conscience: { name: '良心', n: 50, rarity: 'C', desc: 'コンボ数が奇数のとき、{n}点加算' },
    morningMist: { name: '朝霧', c: 5, x: 3, rarity: 'C', desc: 'コンボ数が{c}未満のとき獲得点を1/{x}に、{c}以上のとき{x}倍に' },
    calm: { name: '平穏', n: 200, rarity: 'C', desc: 'コンボ内にJQKが無いとき、{n}点加算' },
    serenity: { name: '安寧', x: 1.5, rarity: 'U', desc: 'コンボ内にJQKが無いとき、獲得点を{x}倍' },
    destiny: { name: '運命', n: 300, rarity: 'C', desc: 'コンボ内がJQKのみのとき、{n}点加算' },
    fate: { name: '宿命', x: 2.0, rarity: 'U', desc: 'コンボ内がJQKのみのとき、獲得点を{x}倍' },
    relief: { name: '安堵', n: 100, rarity: 'C', desc: '取得したカード1枚のランクが1〜10のとき、{n}点加算' },
    verdantGreen: { name: '深緑', x: 3, rarity: 'C', desc: 'コンボがクラブ(♣)専有のとき、獲得点を{x}倍' },
    gem: { name: '宝石', x: 3, rarity: 'C', desc: 'コンボがダイヤ(♦)専有のとき、獲得点を{x}倍' },
    resolve: { name: '真剣', x: 3, rarity: 'C', desc: 'コンボがスペード(♠)専有のとき、獲得点を{x}倍' },
    grail: { name: '聖杯', x: 3, rarity: 'C', desc: 'コンボがハート(♥)専有のとき、獲得点を{x}倍' },
    moonlight: { name: '月光', x: 1.5, rarity: 'U', desc: 'コンボが黒専有のとき、獲得点を{x}倍' },
    sunlight: { name: '陽光', x: 1.5, rarity: 'U', desc: 'コンボが赤専有のとき、獲得点を{x}倍' },
    crown: { name: '王冠', x: 0.5, rarity: 'C', desc: 'コンボ内のK枚数×{x}分、獲得点を倍加' },
    cloverLeaf: { name: '青葉', n: 50, rarity: 'C', desc: 'コンボ内のクラブ(♣)枚数×{n}点を加算' },
    coin: { name: '硬貨', n: 50, rarity: 'C', desc: 'コンボ内のダイヤ(♦)枚数×{n}点を加算' },
    blade: { name: '武器', n: 50, rarity: 'C', desc: 'コンボ内のスペード(♠)枚数×{n}点を加算' },
    chalice: { name: '献杯', n: 50, rarity: 'C', desc: 'コンボ内のハート(♥)枚数×{n}点を加算' },
    balance: { name: '均衡', n: 200, rarity: 'C', desc: 'コンボ内の赤黒枚数が同数のとき、{n}点加算' },
    harmony: { name: '調和', x: 1.5, rarity: 'C', desc: 'コンボ内の赤黒枚数が同数のとき、獲得点を{x}倍' },
    nobility: { name: '高潔', n: 200, rarity: 'C', desc: '同スートパターン成立時、{n}点加算' },
    tenacity: { name: '執念', x: 0.1, rarity: 'R', desc: '同スートパターン成立時、コンボ内枚数×{x}分、獲得点を倍加' },
    determination: { name: '覚悟', x: 0.1, rarity: 'R', desc: '階段成立時、階段の長さ×{x}分、獲得点を倍加' },
    cycle: { name: '循環', x: 3, rarity: 'C', desc: 'KからA、またはAからKを取ったとき、獲得点を{x}倍' },
    reincarnation: { name: '輪廻', x: 10, rarity: 'U', desc: 'コンプリートラン(全ランク階段)にK↔Aループが含まれるとき、獲得点を{x}倍' },
    majesty: { name: '威光', x: 50, rarity: 'U', desc: '同スートかつ全ランク階段を達成したとき、獲得点を{x}倍' },
    omen: { name: '兆し', m: 20, x: 1.5, rarity: 'U', desc: '場札の残り枚数が{m}枚以下のとき、獲得点を{x}倍' },
    crescent: { name: '三日月', m: 10, x: 3, rarity: 'U', desc: '場札の残り枚数が{m}枚以下のとき、獲得点を{x}倍' },
    blessing: { name: '恩寵', x: 1.5, rarity: 'U', desc: '役が成立したとき、獲得点を{x}倍' },
    focus: { name: '集中', x: 3, rarity: 'U', desc: '同ランクの役が含まれるとき、獲得点を{x}倍' },
    lapis: { name: '瑠璃', x: 2, rarity: 'R', desc: '役ボーナス・パターンボーナス(同スート/同色・階段)をあわせて2種類以上成立したとき、獲得点を{x}倍' },
    jade: { name: '翡翠', n: 200, rarity: 'U', desc: '役の成立にワイルドが使われたとき、{n}点加算' },
    emptyMind: { name: '無心', x: 4, rarity: 'U', desc: '役・パターンがどちらも無いとき、獲得点を{x}倍' },
    prologue: { name: '序章', n: 500, rarity: 'C', desc: 'チェーン内でプレイ1枚目のとき、{n}点加算' },
    interlude: { name: '幕間', m: 5, n: 1000, rarity: 'C', desc: 'チェーン内でプレイちょうど{m}枚目のとき、{n}点加算' },
    morningDew: { name: '朝露', n: 5000, rarity: 'C', desc: 'ウェーブで最初にプレイしたカードのとき、{n}点加算' },
    drizzle: { name: '小雨', n: 50, rarity: 'C', desc: '場札を取るたび、{n}点加算' },
    eternity: { name: '永劫', rarity: 'U', desc: 'ウェーブ開始時、山札にワイルドを1枚追加(以後のウェーブにも引き継がれる)' },
    abundance: { name: '豊穣', rarity: 'U', desc: 'ウェーブ開始時、デッキ内の1枚がランダムにワイルドへ変換される(以後のウェーブにも引き継がれる)' },
    silence: { name: '静寂', rarity: 'U', desc: '山札めくりで取れる場札が無いままコンボがリセットされた時、めくった札をワイルドに変換する(デッキにも永続的に反映)' },
    resilience: { name: '不屈', p: 30, rarity: 'U', desc: '山札が無く場札も取れない手詰まり時、スコアの{p}%を消費して捨て札の半数を山札に戻す' },
    gentleBreeze: { name: '微風', n: 100, rarity: 'C', desc: '同じ列を連続でプレイしたとき(2回目以降)、連続回数×{n}点加算' },
    resonance: { name: '共鳴', x: 0.3, rarity: 'U', desc: '同じ列を連続でプレイしたとき(2回目以降)、連続回数×{x}分獲得点を倍加' },
    azureSky: { name: '蒼穹', x: 0.3, rarity: 'U', desc: 'ウェーブ内で列一掃した累計回数×{x}分、獲得点を倍加' },
    amber: { name: '琥珀', x: 0.1, rarity: 'R', desc: 'ウェーブ内の最大到達コンボ数×{x}分、獲得点を倍加' },
    composure: { name: '沈着', n: 500, rarity: 'C', desc: '山札めくりでコンボリセットされた時、取れる場札が無ければ直接{n}点加算' },
    clarity: { name: '冷静', n: 500, rarity: 'C', desc: 'コンボリセット時、そのチェーンで役が一つも成立していなければ直接{n}点加算' },
    arrogance: { name: '慢心', x: 50, rarity: 'C', desc: '山札が無くなった時、場札の残り枚数×{x}点を直接加算' },
    echo: { name: '残響', n: 200, rarity: 'U', desc: 'コンボがリセットされる瞬間、リセット前のコンボ数×{n}点を直接加算' },
    shootingStar: { name: '流星', c: 10, p: 10, rarity: 'R', desc: 'コンボ数が{c}に到達した瞬間、獲得点を加算した後の現在スコアの{p}%を直接加算' },
    naive: { name: '素朴', rarity: 'C', desc: '山札めくりがパターン継続だった場合、通常のプレイと同様に得点計算する(コンボ数も加算)' },
    intuition: { name: '直感', x: 0.3, rarity: 'U', desc: '(素朴と組み合わせて機能)現在のチェーン中に山札めくりでコンボ継続した回数×{x}分、獲得点を倍加' },
    sincerity: { name: '誠実', n: 300, rarity: 'C', desc: '山札めくりで同色パターンによりコンボ継続した時、直接{n}点加算' },
    promise: { name: '約束', rarity: 'R', desc: '山札の次のカードが、今のコンボが継続できるカードになる' },
    darkClouds: { name: '暗雲', r: 1, rarity: 'U', desc: 'ウェーブ開始時、場札が{r}行多く配られる' },
    regeneration: { name: '再生', p: 50, rarity: 'R', desc: '全消し時、スコアの{p}%を消費して捨て札から場札を復活させる(復活すればウェーブ継続)' },
    benevolence: { name: '博愛', rarity: 'R', desc: 'コンボごとに1回、コンボリセットを無効化する' },
    healing: { name: '治癒', rarity: 'U', desc: '列一掃時、捨て札から最大{rows}枚を空いた列へ戻す' },
    guidance: { name: '導き', rarity: 'U', desc: '山札の次のカードが見えるようになる' },
    passion: { name: '情熱', x: 1.5, rarity: 'U', desc: 'このコンボ中にフラッシュが成立していれば、獲得点を{x}倍' },
    fightingSpirit: { name: '闘志', x: 1.3, rarity: 'U', desc: 'このウェーブ中に列一掃が発生していれば、獲得点を{x}倍' },
    sanctify: { name: '祝福', rarity: 'R', desc: '役を揃えるたび基礎コンボ数+1。基礎コンボ数はコンボ数(計算用)に常に加算される' },
    protection: { name: '庇護', c: 3, rarity: 'U', desc: 'コンボ数(計算用)が{c}未満のとき、{c}として計算する' },
    earth: { name: '大地', c: 2, rarity: 'R', desc: 'コンボ数(計算用)に常に{c}を加算する' },
    golden: { name: '黄金', rarity: 'R', desc: 'コンボが1回進むたびに、通常の+1ではなく+2進む' },
    morningStar: { name: '明星', x: 0.2, rarity: 'R', desc: '役ボーナスの額を、その役のウェーブ内累積成立回数×{x}分だけ倍加' },
    mercy: { name: '慈悲', c: 3, x: 1.5, rarity: 'U', desc: 'コンボ数が{c}以下でリセットされたとき、次のコンボの間、獲得点を{x}倍' },
    mirror: { name: '鋼鉄', rarity: 'R', desc: '役が成立するたび(コンボ中1回、同ランクは枚数ごとに1回)、次のプレイで同じ役ボーナスを追加でもう一度加算する' },
    deadline: { name: '刻限', n: 10, rarity: 'U', desc: 'カードを取るたび、山札の残り枚数×{n}点加算' },
    dedication: { name: '献身', n: 0.01, rarity: 'R', desc: 'x倍算。xは1から開始し、この護符を所持してからフラッシュが成立するたびx+={n}される' },
    diligence: { name: '勤勉', n: 0.01, rarity: 'R', desc: 'x倍算。xは1から開始し、この護符を所持してから同ランクが成立するたびx+={n}される' },
    divineProtection: { name: '加護', n: 0.01, rarity: 'R', desc: 'x倍算。xは1から開始し、この護符を所持してからロイヤルセットが成立するたびx+={n}される' },
    fortitude: { name: '剛毅', n: 30, rarity: 'R', desc: 'Wave開始時、山札と場札の合計枚数が{n}枚ごとに基礎コンボ数+1される' },
    waterMirror: { name: '水鏡', rarity: 'R', desc: '護符の並び順で自分の左隣にある護符の効果を、追加でもう一度発動させる(自分が先頭の場合は何も起きない)' },
    vow: { name: '誓約', x: 2, rarity: 'U', desc: 'コンボ内の札と同じ色の札しか取れなくなるが、x倍算' },
    pact: { name: '契り', x: 3, rarity: 'R', desc: 'コンボ内の札と同じスートの札しか取れなくなるが、x倍算' },
    crimson: { name: '紅蓮', rarity: 'U', desc: '全ての札が赤の札としても扱われる' },
    jetBlack: { name: '漆黒', rarity: 'U', desc: '全ての札が黒の札としても扱われる' },
    silver: { name: '白銀', x: 1.5, rarity: 'U', desc: '全ての札の色とスートが非表示になるが、x倍算(点数計算やコンボ継続の判定には引き続き色とスートが使われる)' },
    discretion: { name: '果断', n: 10, rarity: 'C', desc: 'n点加算。nは{n}から開始し、この護符を所持してから天啓・神託・秘儀を使用するたびn+={n}される' },
    frost: { name: '星霜', x: 0.01, rarity: 'R', desc: 'x倍算。xは1から開始し、この護符を所持してから天啓・神託・秘儀を使用するたびx+={x}される' },
  },
  rites: {
    raidho: { name: 'ᚱ', desc: '場札のランダムな1列を階段に変換する(最下段起点、昇順/降順はランダム)' },
    jera: { name: 'ᛃ', desc: '場札の各列をそれぞれソートする(列ごとに昇順/降順はランダム)' },
    wunjo: { name: 'ᚹ', desc: '場札を一番多い色に統一変換する(変換後のスートはカードごとにランダム)' },
    othala: { name: 'ᛟ', desc: '場札を一番多いスートに統一変換する' },
    perthro: { name: 'ᛈ', desc: '現在のチェーンの一番上のカードをワイルドに変換する' },
    uruz: { name: 'ᚢ', n: 3, desc: '現在のコンボ数に+{n}する' },
    ingwaz: { name: 'ᛜ', n: 2, desc: '基礎コンボ数に+{n}する' },
    gebo: { name: 'ᚷ', desc: '捨て札からランダムに、場札の各列へ1枚ずつ配置する(捨て札が列数未満なら使用不可)' },
    fehu: { name: 'ᚠ', desc: '山札の上から、場札の各列へ1枚ずつ配置する(山札の残りが列数以下なら使用不可)' },
    dagaz: { name: 'ᛞ', desc: '捨て札を山札に加えてシャッフルする' },
    algiz: { name: 'ᛉ', desc: 'そのウェーブが終わるまで、場札は一番上のカードだけでなく全てのカードがプレイ対象になる(プレイできるかどうかの判定基準は変わらない)' },
    tiwaz: { name: 'ᛏ', desc: '現在のチェーンのカードを、チェーン内で一番多いスートに統一変換する(チェーンが2枚以上のときのみ使用可)' },
    laguz: { name: 'ᛚ', desc: '現在のチェーンのカードを、チェーン内で一番多い色に統一変換する(変換後のスートはカードごとにランダム。チェーンが2枚以上のときのみ使用可)' },
    eihwaz: { name: 'ᛇ', n: 3, desc: 'コンボリセットを{n}回防ぐ' },
    ansuz: { name: 'ᚨ', n: 3, desc: '場札の中からランダムに{n}枚をワイルドに変換する' },
    kenaz: { name: 'ᚲ', desc: '場札のJ・Q・K以外のカードを、ランダムにJ・Q・Kのいずれかへ変換する(スートは維持)' },
    thurisaz: { name: 'ᚦ', desc: '場札のJ・Q・Kのカードを、ランダムにJ・Q・K以外のランクへ変換する(スートは維持)' },
    hagalaz: { name: 'ᚺ', desc: '場札と山札の残りを全て合流させ、シャッフルして配り直す' },
    nauthiz: { name: 'ᚾ', desc: 'そのウェーブが終わるまで、コンボリセット時の再開値を直前のコンボ数の半分にする' },
    isa: { name: 'ᛁ', desc: 'そのウェーブが終わるまで、コンボ数を今の値のまま増減しなくする' },
    sowilo: { name: 'ᛋ', x: 2, desc: '発動後に初めて成立した役の種類を記憶し、そのウェーブが終わるまでその役のボーナスを{x}倍にする' },
    berkano: { name: 'ᛒ', x: 2, desc: '現在のコンボ数を{x}倍にする(端数切り捨て)' },
    mannaz: { name: 'ᛗ', x: 0.1, desc: 'そのウェーブが終わるまで、得点計算時に所持護符のレア度重み(コモン=1、アンコモン=2、レア=4)の合計×{x}を1に加えた係数を掛ける' },
    ehwaz: { name: 'ᛖ', desc: 'そのウェーブが終わるまで、場札の許容ランク差を2差まで拡張する(ループを跨ぐK→2、Q→Aなども対象)' },
  },
  revelations: {
    kaku: { name: '角', desc: '場札から選んだ1列を、全て♠に変換する(ワイルドは対象外)' },
    kou: { name: '亢', desc: '場札から選んだ1列を、全て♥に変換する(ワイルドは対象外)' },
    tei: { name: '氐', desc: '場札から選んだ1列を、全て♦に変換する(ワイルドは対象外)' },
    bou: { name: '房', desc: '場札から選んだ1列を、全て♣に変換する(ワイルドは対象外)' },
    shin: { name: '心', desc: '場札の♠を全て♥に変換する(ワイルドは対象外)' },
    bi: { name: '尾', desc: '場札の♥を全て♣に変換する(ワイルドは対象外)' },
    ki: { name: '箕', desc: '場札の♣を全て♦に変換する(ワイルドは対象外)' },
    to: { name: '斗', desc: '場札の♦を全て♠に変換する(ワイルドは対象外)' },
    gyu: { name: '牛', desc: '場札から選んだ1列を、ランクA〜10のいずれかへランダムに変換する(1枚ごとに個別抽選。ワイルドは対象外)' },
    jo: { name: '女', desc: '場札から選んだ1列を、ランクJ・Q・Kのいずれかへランダムに変換する(1枚ごとに個別抽選。ワイルドは対象外)' },
    kyo: { name: '虚', n: 1, desc: '場札に{n}行追加する(山札の上から配る)。以後のウェーブ開始時の配布行数も恒久的に{n}増える' },
    aya: { name: '危', desc: '場札から選んだ1列の一番上に、ワイルドを1枚追加する' },
  },
  oracles: {
    completeRun: { name: '乾為天', desc: 'コンプリートラン　レベル+1' },
    royalSet: { name: '兌為沢', desc: 'ロイヤルセット　レベル+1' },
    flush: { name: '離為火', desc: 'フラッシュ　レベル+1' },
    stair: { name: '震為雷', desc: '階段　レベル+1' },
    color: { name: '巽為風', desc: '同色　レベル+1' },
    suit: { name: '坎為水', desc: '同スート　レベル+1' },
    columnSweep: { name: '艮為山', desc: '列一掃　レベル+1' },
    sameRank: { name: '坤為地', desc: '同ランク　レベル+1' },
    pair: { name: '沢山咸', desc: 'ペア　レベル+1' },
    alternating: { name: '水火既済', desc: '交互　レベル+1' },
  },
  flow: { wavesPerStage: 3, clearDelayMs: 450, stageTargetBase: 2000, stageTargetMultiplier: 1.8, stagesPerRun: 8, rerollCost: 30 },
  ui: { comboTierThresholds: [3, 5, 8], chainCardOffsetX: 30, chainCardsPerRow: 10 },
}

export function loadParams(): ShidasuParams {
  return shidasuConfigJson as ShidasuParams
}
