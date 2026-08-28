// src/lib/game/shidasu/params.ts
import shidasuConfigJson from './shidasu.config.json'
import type { Rarity, PackCatalogEntry, SabotageActionId, SpreadId, SpreadConfig } from './types'

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
    // 妨害行動の割り当て種別。noneは妨害無し、allはSABOTAGE_POOL全件が対象になる。
    // 現状'some'相当の個別指定はサポートしない(将来拡張用にengine.ts側の型は対応済み)。
    sabotageKind: 'none' | 'all'
  }[]
  // スプレッド(ラン開始時に選ぶ固有ルールセット)ごとの設定。目標スコアは
  // engine.tsのwaveTarget()が flow.stageTargetBase × flow.stageTargetMultiplier^stageIndex × star.targetMultiplier
  // で算出した値に、spreads[id].targetScoreMultiplierを掛けて調整する。
  // ウェーブ開始時の配布行数への初期オフセット(initialExtraTableauRows)をスプレッドごとに持つ。
  spreads: Record<SpreadId, SpreadConfig>
  items: {
    maxItems: number
  }
  currency: {
    name: string
    symbol: string
    initialAmount: number
  }
  shop: {
    itemPrice: Record<Rarity, { buy: number; sell: number }>
    ritePrice: { buy: number; sell: number }
    revelationPrice: { buy: number; sell: number }
    oraclePrice: { buy: number; sell: number }
    // 福袋のカタログ。管理画面(/admin/shidasu-packs)で自由に追加・削除・編集できる可変長リスト
    packCatalog: PackCatalogEntry[]
    // ショップの品ぞろえ全体(バラ売り3枠+福袋2枠)を再抽選するリロールのコスト刻み幅。
    // 1回目はrerollCostStep、2回目は2倍、3回目は3倍…と、同一ショップ訪問中のリロール回数に応じて増額する
    rerollCostStep: number
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
    shootingStar: { name: string; c: number; n: number; rarity: Rarity; desc: string }
    naive: { name: string; rarity: Rarity; desc: string }
    intuition: { name: string; x: number; rarity: Rarity; desc: string }
    sincerity: { name: string; n: number; rarity: Rarity; desc: string }
    promise: { name: string; rarity: Rarity; desc: string }
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
    exchange: { name: string; n: number; rarity: Rarity; desc: string }
    koban: { name: string; c: number; n: number; rarity: Rarity; desc: string }
    senryo: { name: string; c: number; n: number; rarity: Rarity; desc: string }
    manryo: { name: string; c: number; n: number; rarity: Rarity; desc: string }
    harvest: { name: string; n: number; rarity: Rarity; desc: string }
    settlement: { name: string; c: number; n: number; rarity: Rarity; desc: string }
    hiddenTreasure: { name: string; n: number; rarity: Rarity; desc: string }
    greatestTreasure: { name: string; n: number; rarity: Rarity; desc: string }
    heirloom: { name: string; n: number; rarity: Rarity; desc: string }
    treasury: { name: string; n: number; rarity: Rarity; desc: string }
    boom: { name: string; n: number; rarity: Rarity; desc: string }
    abundantFunds: { name: string; m: number; n: number; rarity: Rarity; desc: string }
    savings: { name: string; n: number; rarity: Rarity; desc: string }
    bigCatch: { name: string; n: number; rarity: Rarity; desc: string }
    grains: { name: string; n: number; rarity: Rarity; desc: string }
    liveliness: { name: string; m: number; n: number; rarity: Rarity; desc: string }
    prosperity: { name: string; m: number; n: number; rarity: Rarity; desc: string }
    heavenlyBlessing: { name: string; m: number; n: number; rarity: Rarity; desc: string }
    mizuho: { name: string; m: number; n: number; rarity: Rarity; desc: string }
    bountifulYear: { name: string; n: number; rarity: Rarity; desc: string }
    profit: { name: string; n: number; rarity: Rarity; desc: string }
    bounty: { name: string; n: number; rarity: Rarity; desc: string }
    perk: { name: string; n: number; rarity: Rarity; desc: string }
    nestEgg: { name: string; n: number; rarity: Rarity; desc: string }
    dividend: { name: string; n: number; rarity: Rarity; desc: string }
    prizeMoney: { name: string; n: number; rarity: Rarity; desc: string }
    windfall: { name: string; p: number; n: number; rarity: Rarity; desc: string }
    celebration: { name: string; n: number; rarity: Rarity; desc: string }
    refund: { name: string; n: number; rarity: Rarity; desc: string }
    bonus: { name: string; n: number; rarity: Rarity; desc: string }
    commendation: { name: string; l: number; n: number; rarity: Rarity; desc: string }
    favor: { name: string; n: number; a: number; rarity: Rarity; desc: string }
    vigor: { name: string; n: number; rarity: Rarity; desc: string }
    zuishuku: { name: string; n: number; rarity: Rarity; desc: string }
    marketTrend: { name: string; n: number; rarity: Rarity; desc: string }
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
    ansuz: { name: string; desc: string }
    kenaz: { name: string; desc: string }
    thurisaz: { name: string; x: number; desc: string }
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
    kyo: { name: string; desc: string }
    aya: { name: string; desc: string }
    shitsu: { name: string; desc: string }
    heki: { name: string; desc: string }
    kei: { name: string; desc: string }
    rou: { name: string; desc: string }
    i: { name: string; desc: string }
    hitsu: { name: string; desc: string }
    shi: { name: string; desc: string }
    sei: { name: string; n: number; desc: string }
    subaru: { name: string; desc: string }
    ryuu: { name: string; desc: string }
    hotori: { name: string; desc: string }
    chou: { name: string; desc: string }
    yoku: { name: string; desc: string }
    mitsu: { name: string; desc: string }
    karasu: { name: string; desc: string }
    oni: { name: string; desc: string }
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
  relics: {
    manekiNeko: { name: string; desc: string; tsukumokaDesc: string; price: number; discountPercent: number; tsukumokaDiscountPercent: number }
    fukuDaruma: { name: string; desc: string; tsukumokaDesc: string; price: number; n: number }
    kumade: { name: string; desc: string; tsukumokaDesc: string; price: number; n: number }
    manekiHoteizo: { name: string; desc: string; tsukumokaDesc: string; price: number; n: number; tsukumokaN: number }
    hamaya: { name: string; desc: string; tsukumokaDesc: string; price: number; n: number; tsukumokaN: number }
    senbazuru: { name: string; desc: string; tsukumokaDesc: string; price: number; n: number; tsukumokaN: number }
    fukuzasa: { name: string; desc: string; tsukumokaDesc: string; price: number; n: number }
    kaiunKokeshi: { name: string; desc: string; tsukumokaDesc: string; price: number; sellBonusPercent: number; tsukumokaSellBonusPercent: number }
    engiKozuchi: { name: string; desc: string; tsukumokaDesc: string; price: number; n: number; tsukumokaN: number }
    engiSuzu: { name: string; desc: string; tsukumokaDesc: string; price: number; n: number; tsukumokaN: number }
  }
  // 妨害行動32種の可変フィールド。idは固定(SabotageActionId、sabotage.tsのSABOTAGE_POOLで列挙)。
  // targetは対象カテゴリのラベル(admin画面では読み取り専用表示、編集対象は name/intervalTurns/descTemplate)。
  sabotageActions: Record<SabotageActionId, { name: string; target: string; intervalTurns: number; descTemplate: string }>
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
    { id: 'ordinary-moon', name: '普通の衛星', waveSlot: 1, targetMultiplier: 1, reward: 3, restrictionKind: 'none', descTemplate: '', sabotageKind: 'none' },
    { id: 'slightly-bigger-moon', name: '少し大きな衛星', waveSlot: 2, targetMultiplier: 1.5, reward: 4, restrictionKind: 'none', descTemplate: '', sabotageKind: 'none' },
    { id: 'closed-loop-planet', name: '循環の閉じた荒廃惑星', waveSlot: 3, targetMultiplier: 2, reward: 5, restrictionKind: 'noLoop', descTemplate: 'A⇔Kループ禁止', sabotageKind: 'all' },
    { id: 'sealed-noble-planet', name: '高貴なる封印の惑星', waveSlot: 3, targetMultiplier: 2, reward: 5, restrictionKind: 'faceLock', descTemplate: '絵札はコンボ2以上でのみ取得可', sabotageKind: 'all' },
    { id: 'harsh-planet', name: '弱き者を拒む峻厳な惑星', waveSlot: 3, targetMultiplier: 2, reward: 5, restrictionKind: 'lowCombo', maxCombo: 2, descTemplate: '{maxCombo}コンボ以下で無得点', sabotageKind: 'all' },
    { id: 'twisted-odd-planet', name: '奇数を忌む歪んだ惑星', waveSlot: 3, targetMultiplier: 2, reward: 5, restrictionKind: 'oddCombo', descTemplate: 'コンボが奇数のとき無得点', sabotageKind: 'all' },
    { id: 'exiling-color-planet', name: '排斥の色殺す惑星', waveSlot: 3, targetMultiplier: 2, reward: 5, restrictionKind: 'suit', descTemplate: '{suit}で無得点', sabotageKind: 'all' },
    { id: 'regicide-planet', name: '王侯を打ち滅ぼす惑星', waveSlot: 3, targetMultiplier: 2, reward: 5, restrictionKind: 'face', descTemplate: '絵札(J・Q・K)で無得点', sabotageKind: 'all' },
  ],
  spreads: {
    fool: { name: '愚者', desc: '特殊ルールなし', initialExtraTableauRows: 0, deckMultiplier: 1, tableauRowMultiplier: 1, targetScoreMultiplier: 1, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 0, initialItemCapacityBonus: 0, excludedRanks: [], unifyBlackRedSuits: false, randomizeDeck: false },
    moon: { name: '月', desc: '場札が常に1行多い状態で始まる。Wave開始時に配られる場札の上半分(端数切捨て)の行は裏向きになる。', initialExtraTableauRows: 1, deckMultiplier: 1, tableauRowMultiplier: 1, targetScoreMultiplier: 1, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 0, initialItemCapacityBonus: 0, excludedRanks: [], unifyBlackRedSuits: false, randomizeDeck: false },
    pope: { name: '教皇', desc: '神託の初期レベルが5になるが、ショップで神託が販売されない', initialExtraTableauRows: 0, deckMultiplier: 1, tableauRowMultiplier: 1, targetScoreMultiplier: 1, initialOracleLevel: 5, bannedShopKinds: ['oracle'], initialCurrencyBonus: 0, initialItemCapacityBonus: 0, excludedRanks: [], unifyBlackRedSuits: false, randomizeDeck: false },
    empress: { name: '女帝', desc: '初期所持金が10多い状態で始まる', initialExtraTableauRows: 0, deckMultiplier: 1, tableauRowMultiplier: 1, targetScoreMultiplier: 1, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 10, initialItemCapacityBonus: 0, excludedRanks: [], unifyBlackRedSuits: false, randomizeDeck: false },
    magician: { name: '魔術師', desc: '護符の所持スロットが1多いが、場札は1行少ない状態で始まる', initialExtraTableauRows: -1, deckMultiplier: 1, tableauRowMultiplier: 1, targetScoreMultiplier: 1, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 0, initialItemCapacityBonus: 1, excludedRanks: [], unifyBlackRedSuits: false, randomizeDeck: false },
    justice: { name: '正義', desc: '初期デッキから絵札(J・Q・K)が除外された状態で始まる', initialExtraTableauRows: 0, deckMultiplier: 1, tableauRowMultiplier: 1, targetScoreMultiplier: 1, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 0, initialItemCapacityBonus: 0, excludedRanks: [11, 12, 13], unifyBlackRedSuits: false, randomizeDeck: false },
    lovers: { name: '恋人', desc: '初期デッキの黒スート(♠♣)・赤スート(♥♦)が、それぞれランダムにどちらか一方へ統一された状態で始まる', initialExtraTableauRows: 0, deckMultiplier: 1, tableauRowMultiplier: 1, targetScoreMultiplier: 1, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 0, initialItemCapacityBonus: 0, excludedRanks: [], unifyBlackRedSuits: true, randomizeDeck: false },
    emperor: { name: '皇帝', desc: '初期デッキの枚数・場札の配布行数・目標スコアが全て2倍になるが、護符の所持スロットが1減った状態で始まる', initialExtraTableauRows: 0, deckMultiplier: 2, tableauRowMultiplier: 2, targetScoreMultiplier: 2, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 0, initialItemCapacityBonus: -1, excludedRanks: [], unifyBlackRedSuits: false, randomizeDeck: false },
    wheelOfFortune: { name: '運命の輪', desc: '初期デッキ52枚それぞれのランク・スートが完全ランダムに再抽選された状態で始まる', initialExtraTableauRows: 0, deckMultiplier: 1, tableauRowMultiplier: 1, targetScoreMultiplier: 1, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 0, initialItemCapacityBonus: 0, excludedRanks: [], unifyBlackRedSuits: false, randomizeDeck: true },
  },
  items: {
    maxItems: 5,
  },
  currency: {
    name: '星片',
    symbol: '☆',
    initialAmount: 5,
  },
  shop: {
    itemPrice: { C: { buy: 8, sell: 4 }, U: { buy: 16, sell: 8 }, R: { buy: 30, sell: 15 } },
    ritePrice: { buy: 12, sell: 6 },
    revelationPrice: { buy: 18, sell: 9 },
    oraclePrice: { buy: 15, sell: 7 },
    packCatalog: [
      { name: '護符の福袋', packKind: 'item', offerCount: 3, pickCount: 1, price: 20 },
      { name: '護符の福袋', packKind: 'item', offerCount: 5, pickCount: 1, price: 30 },
      { name: '護符の福袋', packKind: 'item', offerCount: 7, pickCount: 2, price: 50 },
      { name: '秘儀の福袋', packKind: 'rite', offerCount: 3, pickCount: 1, price: 20 },
      { name: '秘儀の福袋', packKind: 'rite', offerCount: 5, pickCount: 1, price: 30 },
      { name: '秘儀の福袋', packKind: 'rite', offerCount: 7, pickCount: 2, price: 50 },
      { name: '天啓の福袋', packKind: 'revelation', offerCount: 3, pickCount: 1, price: 25 },
      { name: '天啓の福袋', packKind: 'revelation', offerCount: 5, pickCount: 1, price: 38 },
      { name: '天啓の福袋', packKind: 'revelation', offerCount: 7, pickCount: 2, price: 63 },
      { name: '神託の福袋', packKind: 'oracle', offerCount: 3, pickCount: 1, price: 22 },
      { name: '神託の福袋', packKind: 'oracle', offerCount: 5, pickCount: 1, price: 33 },
      { name: 'トランプセットの福袋', packKind: 'cardSet', offerCount: 3, pickCount: 1, price: 20 },
      { name: 'トランプセットの福袋', packKind: 'cardSet', offerCount: 5, pickCount: 1, price: 30 },
      { name: 'トランプセットの福袋', packKind: 'cardSet', offerCount: 7, pickCount: 2, price: 50 },
    ],
    rerollCostStep: 5,
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
    composure: { name: '沈着', n: 1, rarity: 'C', desc: 'コンボリセット時、取れる場札が無ければ基礎コンボ数+{n}' },
    clarity: { name: '冷静', n: 1, rarity: 'C', desc: 'コンボリセット時、そのチェーンで役が一つも成立していなければ基礎コンボ数+{n}' },
    arrogance: { name: '慢心', x: 1.5, rarity: 'C', desc: 'カードプレイ時、山札が0枚なら獲得点を{x}倍' },
    echo: { name: '残響', n: 0.001, rarity: 'U', desc: 'コンボリセット時、リセット前のコンボ数×{n}を永続倍率として蓄積(以後の獲得点に乗算)' },
    shootingStar: { name: '流星', c: 10, n: 50, rarity: 'R', desc: 'コンボ数が{c}に到達するたび、永続加算{n}が蓄積(以後の獲得点に加算)' },
    naive: { name: '素朴', rarity: 'C', desc: '山札めくりがパターン継続だった場合、通常のプレイと同様に得点計算する(コンボ数も加算)' },
    intuition: { name: '直感', x: 0.3, rarity: 'U', desc: '(素朴と組み合わせて機能)現在のチェーン中に山札めくりでコンボ継続した回数×{x}分、獲得点を倍加' },
    sincerity: { name: '誠実', n: 1, rarity: 'C', desc: 'パターン継続(同スート・同色・階段いずれか)でコンボ継続時、コンボ数+{n}' },
    promise: { name: '約束', rarity: 'R', desc: '山札の次のカードが、今のコンボが継続できるカードになる' },
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
    exchange: { name: '両替', n: 2, rarity: 'C', desc: '秘儀・天啓・神託を使用するたび、この護符の売値に{n}を加算する' },
    koban: { name: '小判', c: 3, n: 1, rarity: 'C', desc: 'コンボ数が{c}に到達した瞬間、この護符の売値に{n}を加算する' },
    senryo: { name: '千両', c: 6, n: 3, rarity: 'U', desc: 'コンボ数が{c}に到達した瞬間、この護符の売値に{n}を加算する' },
    manryo: { name: '万両', c: 10, n: 4, rarity: 'R', desc: 'コンボ数が{c}に到達した瞬間、この護符の売値に{n}を加算する' },
    harvest: { name: '豊作', n: 5, rarity: 'C', desc: '全消しを達成するたび、この護符の売値に{n}を加算する' },
    settlement: { name: '決算', c: 15, n: 5, rarity: 'U', desc: 'カードプレイ{c}回以下でウェーブをクリアするたび、この護符の売値に{n}を加算する' },
    hiddenTreasure: { name: '秘宝', n: 5, rarity: 'C', desc: '♠のAをプレイするたび、この護符の売値に{n}を加算する' },
    greatestTreasure: { name: '至宝', n: 5, rarity: 'C', desc: '♥のKをプレイするたび、この護符の売値に{n}を加算する' },
    heirloom: { name: '家宝', n: 5, rarity: 'C', desc: '♦のJをプレイするたび、この護符の売値に{n}を加算する' },
    treasury: { name: '宝庫', n: 5, rarity: 'C', desc: '♣のQをプレイするたび、この護符の売値に{n}を加算する' },
    boom: { name: '好況', n: 2, rarity: 'C', desc: 'フラッシュが成立するたび、この護符の売値に{n}を加算する' },
    abundantFunds: { name: '潤沢', m: 10, n: 5, rarity: 'C', desc: '場札の残り枚数が{m}枚以下になった瞬間、この護符の売値に{n}を加算する' },
    savings: { name: '蓄財', n: 1, rarity: 'C', desc: '同じ列を連続でプレイするたび(2回目以降)、連続回数×{n}を売値に加算する' },
    bigCatch: { name: '大漁', n: 3, rarity: 'C', desc: '列一掃を達成するたび、この護符の売値に{n}を加算する' },
    grains: { name: '五穀', n: 2, rarity: 'C', desc: 'ワイルドをプレイするたび、この護符の売値に{n}を加算する' },
    liveliness: { name: '活況', m: 6, n: 3, rarity: 'C', desc: '同スートが成立し、かつチェーンが{m}枚以上のとき、この護符の売値に{n}を加算する' },
    prosperity: { name: '盛況', m: 6, n: 3, rarity: 'C', desc: '同色が成立し、かつチェーンが{m}枚以上のとき、この護符の売値に{n}を加算する' },
    heavenlyBlessing: { name: '天恵', m: 6, n: 4, rarity: 'C', desc: '階段が成立し、かつチェーンが{m}枚以上のとき、この護符の売値に{n}を加算する' },
    mizuho: { name: '瑞穂', m: 6, n: 4, rarity: 'C', desc: '交互が成立し、かつチェーンが{m}枚以上のとき、この護符の売値に{n}を加算する' },
    bountifulYear: { name: '豊年', n: 2, rarity: 'C', desc: 'ロイヤルセットが成立するたび、この護符の売値に{n}を加算する' },
    profit: { name: '利得', n: 2, rarity: 'C', desc: '同ランクが成立するたび、この護符の売値に{n}を加算する' },
    bounty: { name: '収穫', n: 10, rarity: 'R', desc: 'コンプリートランが成立するたび、この護符の売値に{n}を加算する' },
    perk: { name: '役得', n: 2, rarity: 'C', desc: 'ペアが成立するたび、この護符の売値に{n}を加算する' },
    nestEgg: { name: '儲蓄', n: 2, rarity: 'C', desc: '他の護符を売却するたび、この護符の売値に{n}を加算する' },
    dividend: { name: '配当', n: 5, rarity: 'C', desc: '星の妨害行動が発動するたび、星片に{n}を加算する' },
    prizeMoney: { name: '賞金', n: 2, rarity: 'C', desc: 'ランク{randomTarget}のカードをプレイするたび、星片に{n}を加算する(対象ランクはウェーブごとにランダムに決まる)' },
    windfall: { name: '僥倖', p: 25, n: 2, rarity: 'U', desc: 'J・Q・Kのいずれかをプレイしたとき、{p}%の確率で星片に{n}を加算する' },
    celebration: { name: '祝儀', n: 2, rarity: 'C', desc: '役「{randomTarget}」が成立するたび、星片に{n}を加算する(対象の役はウェーブごとにランダムに決まる)' },
    refund: { name: '還元', n: 1, rarity: 'U', desc: 'ウェーブ終了時、所持している護符・秘儀・天啓・神託すべての売値に{n}を加算する' },
    bonus: { name: '報奨', n: 3, rarity: 'C', desc: 'ウェーブ終了時、星片に{n}を加算する' },
    commendation: { name: '褒賞', l: 7, n: 1, rarity: 'U', desc: 'ウェーブ終了時、デッキにあるランク{l}のカード1枚につき星片に{n}を加算する' },
    favor: { name: '恩賞', n: 2, a: 1, rarity: 'R', desc: 'ウェーブ終了時、星片に加算する(ステージクリアごとに加算量が{a}ずつ増加して蓄積する)' },
    vigor: { name: '活気', n: 2, rarity: 'U', desc: 'ウェーブ終了時、そのウェーブでの最大コンボ数に応じて星片に加算する(floor(最大コンボ数/5)×{n})' },
    zuishuku: { name: '瑞祝', n: 2, rarity: 'U', desc: 'ウェーブ終了時、そのウェーブで成立した役の種類数に応じて星片に加算する(floor(役の種類数/2)×{n})' },
    marketTrend: { name: '市況', n: 10, rarity: 'U', desc: 'ウェーブ終了時、山札の消費割合に応じて星片に加算する(floor(((c-b-a)/(c-b))×{n})、a=残り山札枚数,b=初期配布枚数,c=デッキ総枚数)' },
  },
  rites: {
    raidho: { name: 'ᚱ', desc: '場札の絵札とワイルドはそのままに、非絵札を山札に戻してシャッフルし、元の位置に配り直す' },
    jera: { name: 'ᛃ', desc: '場札の各列をそれぞれソートする(列ごとに昇順/降順はランダム)' },
    wunjo: { name: 'ᚹ', desc: '場札の全カードを捨て札に合流させてシャッフルし、各列の枚数を維持したまま配り直す(山札は変更しない)' },
    othala: { name: 'ᛟ', desc: '山札で一番多く残っているランクのカードをすべて場札に加え、場札全体をシャッフルして配り直す' },
    perthro: { name: 'ᛈ', desc: '各列を、ウェーブ開始時の枚数になるまで山札から補充する(不足している列が無ければ使用不可)' },
    uruz: { name: 'ᚢ', n: 3, desc: '現在のコンボ数に+{n}する' },
    ingwaz: { name: 'ᛜ', n: 2, desc: '基礎コンボ数に+{n}する' },
    gebo: { name: 'ᚷ', desc: '捨て札からランダムに、場札の各列へ1枚ずつ配置する(捨て札が列数未満なら使用不可)' },
    fehu: { name: 'ᚠ', desc: '山札の上から、場札の各列へ1枚ずつ配置する(山札の残りが列数以下なら使用不可)' },
    dagaz: { name: 'ᛞ', desc: '捨て札を山札に加えてシャッフルする' },
    algiz: { name: 'ᛉ', desc: 'そのウェーブが終わるまで、場札は一番上のカードだけでなく全てのカードがプレイ対象になる(プレイできるかどうかの判定基準は変わらない)' },
    tiwaz: { name: 'ᛏ', desc: '場札の全列の並び順を上下逆にする' },
    laguz: { name: 'ᛚ', desc: '0枚になっている列を1つ選び、ウェーブ開始時の枚数になるまで山札から補充する(0枚の列が無ければ使用不可)' },
    eihwaz: { name: 'ᛇ', n: 3, desc: 'コンボリセットを{n}回防ぐ' },
    ansuz: { name: 'ᚨ', desc: 'チェーンを捨て札に送り、山札から1枚めくって新しいチェーンにする(コンボ数は変わらない)' },
    kenaz: { name: 'ᚲ', desc: '場札を山札に合流させ、多いスート順にまとめて配り直す(残りは新しい山札になる)' },
    thurisaz: { name: 'ᚦ', x: 1.5, desc: '次に出すカード1枚の獲得点に×{x}する' },
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
    kyo: { name: '虚', desc: '所持レリックの中から選んだ1つを付喪化させる(既に付喪化済みのレリックは選べない)' },
    aya: { name: '危', desc: '場札から選んだ1列の一番上に、ワイルドを1枚追加する' },
    shitsu: { name: '室', desc: '場札から選んだ1列の各カードを、1つ左の列の同じ位置のカードのランク+1に変換する(左列がワイルドの位置・左列の枚数が足りない位置は対象外)。左端の列を選んだ場合は右端の列を参照する' },
    heki: { name: '壁', desc: '場札全体で♠→♥→♣→♦→♠の順にスートを循環変換する(ワイルドは対象外)' },
    kei: { name: '奎', desc: '空でない列を左から順に、一番左の列の一番上のカードのランクを起点とした階段状のランクに、各列の一番上のカードを変換する(空の列は無視。ワイルドは対象外)' },
    rou: { name: '婁', desc: '場札の全ての列の一番上のカードを廃棄する(デッキから永久に取り除く。ワイルドも対象)' },
    i: { name: '胃', desc: '場札の中からランクが最大のカードと最小のカードをそれぞれ1枚(該当が複数あればランダムに1枚)選んでワイルド化する' },
    hitsu: { name: '畢', desc: '場札から選んだ1列を、先頭のカードを起点とした階段状のランクに再配置する(昇順・降順はランダム)' },
    shi: { name: '觜', desc: '現在のチェーンの一番上のカードをワイルド化する' },
    sei: { name: '井', n: 1, desc: '場札の中からランダムに{n}枚選んでワイルド化する' },
    subaru: { name: '昴', desc: '護符を1つ、所持中を除いてランダムに獲得する(所持上限に達していれば何も起こらない)' },
    ryuu: { name: '柳', desc: '現在所持している星片を倍にする' },
    hotori: { name: '星', desc: '直前に使用した天啓を1つ獲得する(直前の使用が無い、または天啓・神託の所持枠が空いていなければ何も起こらない)' },
    chou: { name: '張', desc: '神託を最大2つランダムに獲得する(天啓・神託の所持枠の空き数までに制限される)' },
    yoku: { name: '翼', desc: '天啓を最大2つランダムに獲得する(天啓・神託の所持枠の空き数までに制限される)' },
    mitsu: { name: '軫', desc: '所持している護符の売値の合計を星片として獲得する' },
    karasu: { name: '参', desc: '直近に使用した秘儀を最大2つ獲得する(秘儀の所持枠の空き数までに制限される)' },
    oni: { name: '鬼', desc: '未所持のレリックの中からランダムに1つ獲得する' },
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
  relics: {
    manekiNeko: { name: '招き猫', desc: 'ショップの全商品の購入価格を{discountPercent}%値引きする', tsukumokaDesc: 'ショップの全商品の購入価格を{tsukumokaDiscountPercent}%値引きする', price: 25, discountPercent: 25, tsukumokaDiscountPercent: 50 },
    fukuDaruma: { name: '福だるま', desc: 'ショップのリロールコストの刻み幅を{n}減らす', tsukumokaDesc: 'ショップのリロールコストの刻み幅を{n}減らし、同一ショップ訪問中の最初の1回のリロールを無料にする', price: 20, n: 2 },
    kumade: { name: '熊手', desc: 'ショップのバラ売り枠を{n}枠増やす', tsukumokaDesc: 'ショップのバラ売り枠を{n}枠、福袋枠も{n}枠増やす', price: 25, n: 1 },
    manekiHoteizo: { name: '招き布袋像', desc: '護符の所持上限を{n}増やす', tsukumokaDesc: '護符の所持上限を{n}増やし、さらに{tsukumokaN}増やす', price: 30, n: 1, tsukumokaN: 1 },
    hamaya: { name: '破魔矢', desc: '秘儀の所持上限を{n}増やす', tsukumokaDesc: '秘儀の所持上限を{n}増やし、さらに{tsukumokaN}増やす', price: 30, n: 1, tsukumokaN: 1 },
    senbazuru: { name: '千羽鶴', desc: '天啓・神託(合算)の所持上限を{n}増やす', tsukumokaDesc: '天啓・神託(合算)の所持上限を{n}増やし、さらに{tsukumokaN}増やす', price: 30, n: 1, tsukumokaN: 1 },
    fukuzasa: { name: '福笹', desc: '福袋の枠を{n}枠増やす', tsukumokaDesc: '福袋の枠を{n}枠、バラ売り枠も{n}枚増やす', price: 25, n: 1 },
    kaiunKokeshi: { name: '開運こけし', desc: '護符・秘儀・天啓・神託の売却価格を{sellBonusPercent}%上乗せする', tsukumokaDesc: '護符・秘儀・天啓・神託の売却価格を{tsukumokaSellBonusPercent}%上乗せする', price: 20, sellBonusPercent: 25, tsukumokaSellBonusPercent: 50 },
    engiKozuchi: { name: '縁起小槌', desc: '福袋の選択肢数を全ジャンル{n}増やす', tsukumokaDesc: '福袋の選択肢数を全ジャンル{n}増やし、さらに{tsukumokaN}増やす', price: 25, n: 1, tsukumokaN: 1 },
    engiSuzu: { name: '縁起鈴', desc: 'レリック専用枠の提示数を{n}増やす', tsukumokaDesc: 'レリック専用枠の提示数を{n}増やし、さらに{tsukumokaN}増やす', price: 35, n: 1, tsukumokaN: 1 },
  },
  sabotageActions: {
    stockPurge: { name: '大量放出', target: '山札', intervalTurns: 6, descTemplate: '山札の上から5枚を捨て札に置く' },
    columnReturn: { name: '一列戻し', target: '場札', intervalTurns: 6, descTemplate: 'ランダムな1列を山札に戻し、シャッフル後同じ列に裏向きで再配布する' },
    chainSettle: { name: '強制清算', target: 'チェーン', intervalTurns: 8, descTemplate: 'チェーンを全て捨て札に送り、山札から1枚めくって新しいチェーンにする。コンボも0にする' },
    comboBreather: { name: '強制小休止', target: 'コンボ', intervalTurns: 5, descTemplate: 'チェーンはそのまま、コンボ数だけ0にする' },
    talismanSeal: { name: '護符封印', target: '護符', intervalTurns: 5, descTemplate: '所持護符を1つ選び、次の妨害発動まで効果を無効化する' },
    riteSeal: { name: '秘儀封印', target: '秘儀', intervalTurns: 5, descTemplate: '所持秘儀を1つ選び、次の妨害発動まで使用を禁止する' },
    revelationOracleSeal: { name: '天啓・神託封印', target: '天啓・神託', intervalTurns: 5, descTemplate: '天啓または神託を1つ選び、次の妨害発動まで使用禁止にする' },
    relicConfiscate: { name: 'レリック没収', target: 'レリック', intervalTurns: 7, descTemplate: '所持レリックを1つ選び、完全に失わせる' },
    tableauCardToDiscard: { name: '一枚没収', target: '捨て札', intervalTurns: 4, descTemplate: '場札からランダムに1枚選び捨て札に送る' },
    currencyConfiscate: { name: '通貨没収', target: '資産(星片)', intervalTurns: 6, descTemplate: '所持する星片を5減らす' },
    roleSeal: { name: '役封印', target: '役ステータス', intervalTurns: 6, descTemplate: 'ランダムな2役を選び、次の妨害発動までそれらのボーナスを無効化する' },
    stockPurgeSmall: { name: '少量放出', target: '山札', intervalTurns: 4, descTemplate: '山札の上から2枚を捨て札に置く' },
    stockShuffle: { name: '山札攪拌', target: '山札', intervalTurns: 5, descTemplate: '山札の順序をランダムに並び替える(枚数は変わらない)' },
    tableauFullReturn: { name: '総戻し', target: '場札', intervalTurns: 8, descTemplate: '場札全体を山札に戻し、シャッフル後同じ配分で再配布する' },
    tableauShuffle: { name: '総入れ替え', target: '場札', intervalTurns: 6, descTemplate: '場札の中身を列をまたいでランダムに再配置する(山札には触れない)' },
    chainPartialDiscard: { name: 'チェーン部分放棄', target: 'チェーン', intervalTurns: 5, descTemplate: 'チェーンの先頭(最古)から2枚を捨て札に送る(コンボはそのまま維持)' },
    chainShuffle: { name: 'チェーン入れ替え', target: 'チェーン', intervalTurns: 6, descTemplate: 'チェーンをシャッフルし、新しい末尾を基準カードにする' },
    comboReduce: { name: 'コンボ削減', target: 'コンボ', intervalTurns: 5, descTemplate: 'コンボ数を3減らす(0未満にはしない)' },
    comboCap: { name: 'コンボ頭打ち', target: 'コンボ', intervalTurns: 6, descTemplate: '発動時点のコンボ数を上限として、次の妨害発動まで増加を止める' },
    talismanConfiscate: { name: '護符没収', target: '護符', intervalTurns: 7, descTemplate: '所持護符を1つ選び、完全に失わせる' },
    riteConfiscate: { name: '秘儀没収', target: '秘儀', intervalTurns: 6, descTemplate: '所持秘儀を1つ選び、効果を発動させずに消費させる' },
    riteForceActivate: { name: '秘儀強制発動', target: '秘儀', intervalTurns: 6, descTemplate: '使用可能な秘儀を1つ選び、即座に効果を発動させて消費する' },
    talismanShuffle: { name: '護符並び替え', target: '護符', intervalTurns: 5, descTemplate: '所持護符の並び順をランダムにシャッフルし、次の妨害発動まで護符を裏向き表示にする' },
    revelationOracleConfiscate: { name: '天啓・神託没収', target: '天啓・神託', intervalTurns: 7, descTemplate: '所持している天啓または神託からランダムに1つ選び、完全に失わせる' },
    revelationOracleForceActivate: { name: '天啓・神託強制発動', target: '天啓・神託', intervalTurns: 6, descTemplate: '使用可能な天啓または所持神託からランダムに1つ選び、即座に効果を発動させて消費する' },
    tsukumokaRelease: { name: '付喪化解除', target: 'レリック', intervalTurns: 6, descTemplate: '付喪化済みレリックがあればランダムに1つ選び、未付喪化状態に戻す' },
    discardErase: { name: '捨て札消去', target: '捨て札', intervalTurns: 6, descTemplate: 'チェーンのカードを捨て札に送り、捨て札全体をシャッフルしてから同じ枚数をチェーンに戻す' },
    discardBury: { name: '捨て札埋没', target: '捨て札', intervalTurns: 5, descTemplate: '捨て札の中身を山札に戻し混ぜ込み、同じ枚数を山札から裏向きで捨て札に移す' },
    rewardReduce: { name: '報酬減少', target: '資産(星片)', intervalTurns: 8, descTemplate: 'Waveクリア時の通貨報酬を-2する(複数回発動した場合は累積する)' },
    currencyDrain: { name: '通貨強制消費', target: '資産(星片)', intervalTurns: 6, descTemplate: '所持通貨の20%を失わせる' },
    roleLevelDecay: { name: '役減衰', target: '役ステータス', intervalTurns: 7, descTemplate: 'ランダムな2役を選び、oracleLevelを1下げる(下限1、永続的なマイナス)' },
    roleBias: { name: '役偏重', target: '役ステータス', intervalTurns: 6, descTemplate: '次の妨害発動まで、全役を半分ずつ2グループに分け、一方を2倍、他方を1/2倍にする' },
  },
  flow: { wavesPerStage: 3, clearDelayMs: 450, stageTargetBase: 2000, stageTargetMultiplier: 1.8, stagesPerRun: 8, rerollCost: 30 },
  ui: { comboTierThresholds: [3, 5, 8], chainCardOffsetX: 30, chainCardsPerRow: 10 },
}

// スプレッドのID一覧。ゲーム側のスプレッド選択画面・admin側の設定ページの両方から参照する
// 単一の情報源。新規スプレッドを追加する際はここに追記すれば両画面に自動反映される。
export const SPREAD_IDS: SpreadId[] = ['fool', 'moon', 'pope', 'empress', 'magician', 'justice', 'lovers', 'emperor', 'wheelOfFortune']

export function loadParams(): ShidasuParams {
  // ui.comboTierThresholds(タプル型)とJSON側の推論型(number[])が構造的に一致しないため、
  // 単純な`as ShidasuParams`ではTS2352エラーになる。unknownを経由して型チェックを迂回する
  // (既存の relics.ts 等でも同様のパターンを使用)。
  return shidasuConfigJson as unknown as ShidasuParams
}
