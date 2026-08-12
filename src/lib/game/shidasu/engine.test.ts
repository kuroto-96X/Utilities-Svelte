// src/lib/game/shidasu/engine.test.ts
import { describe, test, expect } from 'vitest'
import {
  rankLabel,
  isPlayable,
  getPlayableColumns,
  getPlayableRowsInColumn,
  remainingCount,
  startWave,
  playCard,
  drawStock,
  isStuck,
  markStuck,
  createInitialRun,
  beginRun,
  finishShop,
  resolveWaveEnd,
  continueAfterGreatMisfortune,
  stopAfterGreatMisfortune,
  waveTarget,
  stageModifierFor,
  bossScoreLockFor,
  restartRun,
  applyPlayCard,
  applyDrawStock,
  applyStuckCheck,
  forceStockTop,
  useRite,
  useRevelation,
  buyIndividualItem,
  buyIndividualRite,
  buyRelic,
  buyIndividualRevelationUse,
  buyIndividualRevelationHold,
  buyIndividualOracleUse,
  buyIndividualOracleHold,
  buyPack,
  pickPackCardSet,
  closePackCardSetSelect,
  pickPackItem,
  confirmPackItemSwap,
  cancelPackItemSwap,
  closePackItemSelect,
  pickPackRite,
  confirmPackRiteSwap,
  cancelPackRiteSwap,
  closePackRiteSelect,
  pickPackRevelationUse,
  pickPackRevelationHold,
  confirmPackRevelationSwap,
  cancelPackRevelationSwap,
  closePackRevelationSelect,
  pickPackOracleUse,
  pickPackOracleHold,
  confirmPackOracleSwap,
  cancelPackOracleSwap,
  closePackOracleSelect,
  useOracle,
  sellItem,
  sellRite,
  sellRevelation,
  sellOracle,
  reorderItems,
  skipWave,
  rerollStageStars,
  rerollShop,
  shopRerollCost,
  startRevelationPreview,
} from './engine'
import { isFace, chainContinuesPattern } from './patterns'
import type { Card, WaveState, RunState, ItemId, ShopIndividualSlot, Star, StarRestriction } from './types'
import { DEFAULT_PARAMS, type ShidasuParams } from './params'
import { createRng, standardDeckComposition } from './deck'
import { card } from './testHelpers'
import { defaultOracleLevels } from './oracles'
import { ITEM_POOL } from './items'
import { itemBuyPrice, riteBuyPrice, revelationBuyPrice, itemSellPrice, riteSellPrice, revelationSellPrice, oracleSellPrice, rollShop, relicBuyPrice } from './shop'
import { addPart, finalScoreFromScoreParts, runningTotalsFromScoreParts } from './scoreParts'

describe('isFace / rankLabel', () => {
  test('J/Q/Kはisface、それ以外はfalse', () => {
    expect(isFace(card(1, '♠', 11))).toBe(true)
    expect(isFace(card(2, '♠', 12))).toBe(true)
    expect(isFace(card(3, '♠', 13))).toBe(true)
    expect(isFace(card(4, '♠', 10))).toBe(false)
  })

  test('rankLabelはA/J/Q/K表記、ワイルドは★', () => {
    expect(rankLabel(card(1, '♠', 1))).toBe('A')
    expect(rankLabel(card(2, '♠', 11))).toBe('J')
    expect(rankLabel(card(3, '♠', 12))).toBe('Q')
    expect(rankLabel(card(4, '♠', 13))).toBe('K')
    expect(rankLabel(card(5, '♠', 7))).toBe('7')
    expect(rankLabel(card(6, '★', 0, true))).toBe('★')
  })
})

function makeWave(overrides: Partial<WaveState> = {}): WaveState {
  return {
    tableau: [],
    stock: [],
    foundation: card(0, '♠', 5),
    score: 0,
    combo: 0,
    chain: [],
    chainOrigin: [],
    linked: false,
    columnsEmptiedThisCombo: 0,
    comboStreakColumnLengths: [],
    dealtRows: DEFAULT_PARAMS.layout.rows,
    lastDrawEffect: null,
    status: 'playing',
    endReason: null,
    lastGain: null,
    firstPlayDone: false,
    discardPile: [],
    lastPlayedColumn: null,
    sameColumnStreak: 0,
    maxComboThisWave: 0,
    totalColumnsEmptiedThisWave: 0,
    roleFiredThisChain: false,
    drawContinueCountThisChain: 0,
    flushActiveThisCombo: false,
    columnSweepActiveThisWave: false,
    benevolenceUsedThisCombo: false,
    baseComboCount: 0,
    dedicationX: 1,
    diligenceX: 1,
    divineProtectionX: 1,
    discretionN: 10,
    frostX: 1,
    echoX: 1,
    shootingStarN: 50,
    roleEchoUsedThisCombo: {},
    sameRankEchoUsedThisCombo: [],
    pendingRoleEcho: null,
    roleOccurrenceCountThisWave: {},
    mercyActiveNextCombo: false,
    sweptColumnsThisCombo: [],
    regenerationUsedThisWave: false,
    resilienceUsedThisWave: false,
    comboResetShieldRemaining: 0,
    playFromAnywhereActiveThisWave: false,
    nauthizActiveThisWave: false,
    comboFrozenThisWave: false,
    sowiloActiveThisWave: false,
    sowiloBoostedRole: null,
    mannazActiveThisWave: false,
    ehwazActiveThisWave: false,
    nextPlayScoreMultiplier: 1,
    oracleLevels: defaultOracleLevels(),
    ...overrides,
  }
}

describe('isPlayable', () => {
  test('ランク差1は取れる', () => {
    const wave = makeWave({ foundation: card(1, '♠', 5) })
    expect(isPlayable('none', wave, card(2, '♣', 6))).toBe(true)
    expect(isPlayable('none', wave, card(3, '♣', 4))).toBe(true)
  })

  test('ランク差2は取れない', () => {
    const wave = makeWave({ foundation: card(1, '♠', 5) })
    expect(isPlayable('none', wave, card(2, '♣', 7))).toBe(false)
  })

  test('A-Kループは通常時のみ取れる、noLoop中は取れない', () => {
    const wave = makeWave({ foundation: card(1, '♠', 13) })
    expect(isPlayable('none', wave, card(2, '♣', 1))).toBe(true)
    expect(isPlayable('noLoop', wave, card(2, '♣', 1))).toBe(false)
  })

  test('faceLock中はコンボ2未満だと絵札を取れない', () => {
    const wave = makeWave({ foundation: card(1, '♠', 10), combo: 1 })
    expect(isPlayable('faceLock', wave, card(2, '♣', 11))).toBe(false)
    const wave2 = makeWave({ foundation: card(1, '♠', 10), combo: 2 })
    expect(isPlayable('faceLock', wave2, card(2, '♣', 11))).toBe(true)
  })

  test('faceLock中は場札(foundation)がワイルドでもコンボ不足なら絵札を拒否する', () => {
    const wave = makeWave({ foundation: card(1, '★', 0, true), combo: 0 })
    expect(isPlayable('faceLock', wave, card(2, '♣', 12))).toBe(false)
  })

  test('ワイルドの札、またはfoundationがワイルドなら基本は取れる', () => {
    const wave = makeWave({ foundation: card(1, '♠', 5) })
    expect(isPlayable('none', wave, card(2, '★', 0, true))).toBe(true)
    const wildFoundationWave = makeWave({ foundation: card(1, '★', 0, true) })
    expect(isPlayable('none', wildFoundationWave, card(2, '♣', 9))).toBe(true)
  })

  test('エワズ有効時はランク差2も取れる(ループ含む)', () => {
    const wave = makeWave({ foundation: card(1, '♠', 5), ehwazActiveThisWave: true })
    expect(isPlayable('none', wave, card(2, '♣', 7))).toBe(true)
    expect(isPlayable('none', wave, card(3, '♣', 3))).toBe(true)
  })

  test('エワズ有効時、ランク差2でのループ越え(K→2、Q→Aなど)はnoLoop中だけ取れない', () => {
    const wave = makeWave({ foundation: card(1, '♠', 13), ehwazActiveThisWave: true })
    expect(isPlayable('none', wave, card(2, '♣', 2))).toBe(true)
    expect(isPlayable('noLoop', wave, card(2, '♣', 2))).toBe(false)
  })

  test('エワズが無効ならランク差2は通常通り取れない', () => {
    const wave = makeWave({ foundation: card(1, '♠', 5) })
    expect(isPlayable('none', wave, card(2, '♣', 7))).toBe(false)
  })

  test('エワズが有効でも、階段パターンの継続判定はランク差1のみを認識する(ランク差2は継続しない)', () => {
    // card(2)を♣(黒)にして隣接する1・2枚目を黒黒にし、赤黒交互パターン(新規実装)が
    // 偶然成立してしまわないようにしている(この点を除けばスート・色は元々不成立のまま)
    const chain = [card(1, '♠', 1), card(2, '♣', 2), card(3, '♣', 3), card(4, '♦', 4)]
    const result = chainContinuesPattern(DEFAULT_PARAMS.scoring, chain, card(5, '♠', 6))
    expect(result).toBe(false)
  })

  test('アルギズ発動中(playFromAnywhereActiveThisWave)でも、ランク差等の判定基準そのものはバイパスしない(列内のどのカードが対象になるかが変わるだけ)', () => {
    const wave = makeWave({ foundation: card(1, '♠', 5), playFromAnywhereActiveThisWave: true })
    expect(isPlayable('none', wave, card(2, '♣', 7))).toBe(false) // ランク差2は通常通り取れない
    expect(isPlayable('none', wave, card(3, '♣', 6))).toBe(true) // ランク差1は通常通り取れる
  })
})

describe('isPlayable with 誓約・契り', () => {
  test('誓約所持時、チェーン最新札と異なる色のカードは取れない', () => {
    const wave = makeWave({
      foundation: card(0, '♥', 5),
      chain: [card(0, '♥', 5)],
    })
    expect(isPlayable('none', wave, card(1, '♠', 6), ['vow'])).toBe(false)
  })

  test('誓約所持時、チェーン最新札と同じ色のカードは取れる', () => {
    const wave = makeWave({
      foundation: card(0, '♥', 5),
      chain: [card(0, '♥', 5)],
    })
    expect(isPlayable('none', wave, card(1, '♦', 6), ['vow'])).toBe(true)
  })

  test('誓約所持時、チェーンが空(ウェーブ最初の1枚)なら色制約は適用されない', () => {
    const wave = makeWave({
      foundation: card(0, '♥', 5),
      chain: [],
    })
    expect(isPlayable('none', wave, card(1, '♠', 6), ['vow'])).toBe(true)
  })

  test('誓約を所持していなければ色制約は適用されない', () => {
    const wave = makeWave({
      foundation: card(0, '♥', 5),
      chain: [card(0, '♥', 5)],
    })
    expect(isPlayable('none', wave, card(1, '♠', 6), [])).toBe(true)
  })

  test('契り所持時、チェーン最新札と異なるスートのカードは取れない', () => {
    const wave = makeWave({
      foundation: card(0, '♥', 5),
      chain: [card(0, '♥', 5)],
    })
    expect(isPlayable('none', wave, card(1, '♦', 6), ['pact'])).toBe(false)
  })

  test('契り所持時、チェーン最新札と同じスートのカードは取れる', () => {
    const wave = makeWave({
      foundation: card(0, '♥', 5),
      chain: [card(0, '♥', 5)],
    })
    expect(isPlayable('none', wave, card(1, '♥', 6), ['pact'])).toBe(true)
  })

  test('誓約+紅蓮所持時、黒札のチェーンに対して赤札(紅蓮で黒扱いも可)が取れる', () => {
    const wave = makeWave({
      foundation: card(0, '♠', 5),
      chain: [card(0, '♠', 5)],
    })
    expect(isPlayable('none', wave, card(1, '♥', 6), ['vow', 'crimson'])).toBe(true)
  })
})

describe('getPlayableColumns / remainingCount', () => {
  test('各列の一番手前のカードのみ判定対象になる', () => {
    const wave = makeWave({
      foundation: card(1, '♠', 5),
      tableau: [
        [card(2, '♣', 9), card(3, '♣', 6)], // 一番手前=6 → 取れる
        [card(4, '♦', 2)],                   // 取れない
      ],
    })
    expect(getPlayableColumns('none', wave)).toEqual(new Set([0]))
  })

  test('アルギズ発動中は、一番手前だけでなく列内のどのカードが取れるかで判定する', () => {
    const wave = makeWave({
      foundation: card(1, '♠', 5),
      playFromAnywhereActiveThisWave: true,
      tableau: [
        [card(2, '♣', 6), card(3, '♣', 9)], // 手前(9)は取れないが、奥(6)はランク差1で取れる
        [card(4, '♦', 2)],                   // どちらも取れない
      ],
    })
    expect(getPlayableColumns('none', wave)).toEqual(new Set([0]))
  })

  test('remainingCountは全列の合計枚数', () => {
    const wave = makeWave({
      tableau: [[card(1, '♠', 1)], [card(2, '♠', 2), card(3, '♠', 3)]],
    })
    expect(remainingCount(wave.tableau)).toBe(3)
  })
})

describe('getPlayableRowsInColumn', () => {
  test('通常時は一番手前の行のみを判定対象にする(奥に取れるカードがあっても対象に含めない)', () => {
    const wave = makeWave({
      foundation: card(1, '♠', 5),
      tableau: [[card(2, '♣', 6), card(3, '♣', 9)]], // 奥(idx0)=6は取れる、手前(idx1)=9は取れない
    })
    expect(getPlayableRowsInColumn('none', wave, 0)).toEqual(new Set())
  })

  test('アルギズ発動中は列内の全行を判定対象にし、isPlayableを満たす行のみ返す', () => {
    const wave = makeWave({
      foundation: card(1, '♠', 5),
      playFromAnywhereActiveThisWave: true,
      tableau: [[card(2, '♣', 6), card(3, '♣', 9), card(4, '♣', 4)]], // idx0=6(取れる) idx1=9(取れない) idx2=4(取れる)
    })
    expect(getPlayableRowsInColumn('none', wave, 0)).toEqual(new Set([0, 2]))
  })

  test('空の列は空集合を返す', () => {
    const wave = makeWave({ tableau: [[]] })
    expect(getPlayableRowsInColumn('none', wave, 0)).toEqual(new Set())
  })
})

describe('startWave', () => {
  test('場札はcols×rowsの列数・枚数になる', () => {
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1)
    expect(wave.tableau).toHaveLength(DEFAULT_PARAMS.layout.cols)
    wave.tableau.forEach(col => expect(col).toHaveLength(DEFAULT_PARAMS.layout.rows))
  })

  test('comboStreakColumnLengthsは各列ともrows枚で初期化される', () => {
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1)
    expect(wave.comboStreakColumnLengths).toEqual(wave.tableau.map(() => DEFAULT_PARAMS.layout.rows))
  })

  test('山札+場札+foundationで52枚になる(アイテムなし)', () => {
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1)
    const tableauCount = wave.tableau.reduce((n, c) => n + c.length, 0)
    expect(tableauCount + wave.stock.length + 1).toBe(52)
  })

  test('初期状態: チェーンにfoundationが1枚(由来はdraw)、スコア0、コンボ0、列一掃0、演出フラグnull、捨て札は空', () => {
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1)
    expect(wave.score).toBe(0)
    expect(wave.combo).toBe(0)
    expect(wave.chain).toEqual([wave.foundation])
    expect(wave.chainOrigin).toEqual(['draw'])
    expect(wave.linked).toBe(false)
    expect(wave.columnsEmptiedThisCombo).toBe(0)
    expect(wave.lastDrawEffect).toBeNull()
    expect(wave.status).toBe('playing')
    expect(wave.discardPile).toEqual([])
  })

  test('秘儀由来の持続フラグは全てウェーブ開始時に初期化される', () => {
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1)
    expect(wave.comboResetShieldRemaining).toBe(0)
    expect(wave.playFromAnywhereActiveThisWave).toBe(false)
    expect(wave.nauthizActiveThisWave).toBe(false)
    expect(wave.comboFrozenThisWave).toBe(false)
    expect(wave.sowiloActiveThisWave).toBe(false)
    expect(wave.sowiloBoostedRole).toBeNull()
    expect(wave.mannazActiveThisWave).toBe(false)
    expect(wave.ehwazActiveThisWave).toBe(false)
  })

  test('同じシードなら同じ結果になる(決定的、アイテムを持っていても山札生成自体は変わらない)', () => {
    const a = startWave(DEFAULT_PARAMS, 0, 0, ['bridge'], standardDeckComposition(), 123)
    const b = startWave(DEFAULT_PARAMS, 0, 0, ['bridge'], standardDeckComposition(), 123)
    expect(a).toEqual(b)
  })

  test('永劫を持っていればdeckCompositionにワイルドが1枚追加され、山札構築に反映される(53枚になる)', () => {
    const { wave, deckComposition } = startWave(DEFAULT_PARAMS, 0, 0, ['eternity'], standardDeckComposition(), 1)
    expect(deckComposition).toHaveLength(53)
    const tableauCount = wave.tableau.reduce((n, c) => n + c.length, 0)
    expect(tableauCount + wave.stock.length + 1).toBe(53)
  })

  test('豊穣を持っていればdeckComposition内の1枚がワイルドに変換される(枚数は52枚のまま)', () => {
    const { deckComposition } = startWave(DEFAULT_PARAMS, 0, 0, ['abundance'], standardDeckComposition(), 1)
    expect(deckComposition).toHaveLength(52)
    expect(deckComposition.filter(c => c.wild)).toHaveLength(1)
  })

  test('豊穣はremoved:trueのカードを対象から除外する', () => {
    const composition = standardDeckComposition().map((c, i) => (i < 51 ? { ...c, removed: true } : c))
    const { deckComposition } = startWave(DEFAULT_PARAMS, 0, 0, ['abundance'], composition, 1)
    const wildEntry = deckComposition.find(c => c.wild)
    expect(wildEntry?.removed).toBe(false)
  })

  test('永劫・豊穣を複数ウェーブ保持し続けると効果が蓄積する', () => {
    const first = startWave(DEFAULT_PARAMS, 0, 0, ['eternity', 'abundance'], standardDeckComposition(), 1)
    const second = startWave(DEFAULT_PARAMS, 0, 1, ['eternity', 'abundance'], first.deckComposition, 2)
    expect(second.deckComposition).toHaveLength(54) // 標準52枚+永劫2ウェーブ分
    expect(second.deckComposition.filter(c => c.wild)).toHaveLength(4) // 永劫追加2枚+豊穣変換2枚
  })
})

describe('removed:trueのdeckComposition要素はstartWaveの山札構築から除外される', () => {
  test('removedのカードは場札・山札・foundationのどこにも現れない', () => {
    const composition = standardDeckComposition().map((c, i) => (i === 0 ? { ...c, removed: true } : c))
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, [], composition, 1)
    const dealtDeckIds = [
      ...wave.tableau.flat().map(c => c.deckId),
      ...wave.stock.map(c => c.deckId),
      wave.foundation.deckId,
    ]
    expect(dealtDeckIds).not.toContain(composition[0].deckId)
    expect(dealtDeckIds).toHaveLength(51)
  })
})

describe('剛毅(fortitude): Wave開始時、山札+場札の合計枚数に応じてbaseComboCountが加算される', () => {
  test('デッキ枚数が30枚未満なら加算なし', () => {
    const smallDeck = standardDeckComposition().slice(0, 29)
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, ['fortitude'], smallDeck, 1)
    expect(wave.baseComboCount).toBe(0)
  })

  test('デッキ枚数が30〜59枚ならbaseComboCount+1', () => {
    const midDeck = standardDeckComposition().slice(0, 40)
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, ['fortitude'], midDeck, 1)
    expect(wave.baseComboCount).toBe(1)
  })

  test('剛毅を所持していなければ加算されない', () => {
    const midDeck = standardDeckComposition().slice(0, 40)
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, [], midDeck, 1)
    expect(wave.baseComboCount).toBe(0)
  })

  test('removedのカードはデッキ枚数カウントから除外される(実質29枚なら加算なし)', () => {
    const composition = standardDeckComposition().slice(0, 40).map((c, i) => (i < 11 ? { ...c, removed: true } : c))
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, ['fortitude'], composition, 1)
    expect(wave.baseComboCount).toBe(0)
  })
})

describe('果断・星霜の基盤(startWave/resolveWaveEndでの同期)', () => {
  test('startWaveのdiscretionN・frostXのデフォルト値はそれぞれ10・1', () => {
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1)
    expect(wave.discretionN).toBe(10)
    expect(wave.frostX).toBe(1)
  })

  test('startWaveに渡した値がそのままwaveに反映される', () => {
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels(), 1, 1, 1, 30, 1.05)
    expect(wave.discretionN).toBe(30)
    expect(wave.frostX).toBe(1.05)
  })
})

describe('残響・流星の基盤(startWave/resolveWaveEndでの同期)', () => {
  test('startWaveのechoX・shootingStarNのデフォルト値はそれぞれ1・50', () => {
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1)
    expect(wave.echoX).toBe(1)
    expect(wave.shootingStarN).toBe(50)
  })

  test('startWaveに渡した値がそのままwaveに反映される', () => {
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels(), 1, 1, 1, 10, 1, 1.5, 90)
    expect(wave.echoX).toBe(1.5)
    expect(wave.shootingStarN).toBe(90)
  })

  test('resolveWaveEndでクリア成功時、wave側のechoX・shootingStarNがrunへ書き戻される', () => {
    const base = beginRun(DEFAULT_PARAMS, 1)
    const { wave } = startWave(DEFAULT_PARAMS, base.stageIndex, base.waveIndex, base.items, base.deckComposition, 1, base.extraTableauRows, base.oracleLevels)
    const run: RunState = {
      ...base,
      wave: { ...wave, echoX: 3, shootingStarN: 120, score: waveTarget(DEFAULT_PARAMS, 0, 0, base.stageStars), status: 'ended', endReason: 'target' },
    }
    const result = resolveWaveEnd(DEFAULT_PARAMS, run, createRng(5))
    expect(result.echoX).toBe(3)
    expect(result.shootingStarN).toBe(120)
  })
})

describe('果断・星霜: 秘儀/天啓/神託使用でdiscretionN・frostXが加算される', () => {
  test('秘儀使用後、discretionNが10から20になる(果断所持時)', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, ['discretion'], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, items: ['discretion'], rites: ['jera'] }
    const next = useRite(DEFAULT_PARAMS, run, 'jera', createRng(1))
    expect(next.wave!.discretionN).toBe(20)
  })

  test('果断を所持していなければdiscretionNは変化しない', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, items: [], rites: ['jera'] }
    const next = useRite(DEFAULT_PARAMS, run, 'jera', createRng(1))
    expect(next.wave!.discretionN).toBe(10)
  })

  test('秘儀使用後、frostXが1から1.01になる(星霜所持時)', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, ['frost'], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, items: ['frost'], rites: ['jera'] }
    const next = useRite(DEFAULT_PARAMS, run, 'jera', createRng(1))
    expect(next.wave!.frostX).toBeCloseTo(1.01)
  })

  test('神託使用後、discretionN・frostXが両方加算される(果断・星霜を両方所持)', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, ['discretion', 'frost'], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, items: ['discretion', 'frost'], oracles: ['flush'] }
    const next = useOracle(DEFAULT_PARAMS, run, 'flush')
    expect(next.wave!.discretionN).toBe(20)
    expect(next.wave!.frostX).toBeCloseTo(1.01)
  })

  test('天啓使用後、discretionN・frostXが加算される(果断・星霜を所持)', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, ['discretion', 'frost'], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, items: ['discretion', 'frost'], revelations: ['shin'] }
    const next = useRevelation(DEFAULT_PARAMS, run, 'shin', null, createRng(1))
    expect(next.wave!.discretionN).toBe(20)
    expect(next.wave!.frostX).toBeCloseTo(1.01)
  })
})

describe('果断・星霜: gained計算への反映', () => {
  test('果断所持時、獲得点にdiscretionNが加算される', () => {
    const wave = makeWave({
      foundation: card(0, '♠', 5),
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      discretionN: 30,
      comboFrozenThisWave: true, // コンボ倍率をかけず単純加算のみを検証するため固定
    })
    const withoutDiscretion = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    const withDiscretion = playCard(DEFAULT_PARAMS, wave, 'none', ['discretion'], 1000000, 0, standardDeckComposition())
    expect(withDiscretion.wave.score).toBe(withoutDiscretion.wave.score + 30)
  })

  test('星霜所持時、獲得点にfrostXが倍算される', () => {
    const wave = makeWave({
      foundation: card(0, '♠', 5),
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      frostX: 1.5,
      comboFrozenThisWave: true, // コンボ倍率をかけず単純倍算のみを検証するため固定
    })
    const withoutFrost = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    const withFrost = playCard(DEFAULT_PARAMS, wave, 'none', ['frost'], 1000000, 0, standardDeckComposition())
    expect(withFrost.wave.score).toBe(Math.floor(withoutFrost.wave.score * 1.5))
  })

  test('回帰防止: discretionAdd等の加算項が乗算項より前にpartsへpushされ、runningTotalsFromScorePartsの最終値がlastGain.pointsと一致する', () => {
    // 献身(dedicationX)のような「果断より前にpushされていた乗算項」と果断(discretionAdd)を同時に有効化し、
    // 加算項が乗算項より後にpushされていると仮合計の途中値がズレる状況を再現する
    const wave = makeWave({
      foundation: card(0, '♠', 5),
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      discretionN: 30,
      dedicationX: 2,
      comboFrozenThisWave: false,
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['discretion', 'dedication'], 1000000, 0, standardDeckComposition())
    expect(next.lastGain).not.toBeNull()
    const totals = runningTotalsFromScoreParts(next.lastGain!.parts)
    expect(Math.floor(totals[totals.length - 1])).toBe(next.lastGain!.points)
  })
})

describe('playCard', () => {
  const scoring = DEFAULT_PARAMS.scoring

  function baseWave(overrides: Partial<WaveState> = {}): WaveState {
    return makeWave({
      foundation: card(0, '♠', 5),
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      ...overrides,
    })
  }

  test('取れない列を指定した場合は何も変わらない', () => {
    const wave = baseWave()
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 1, standardDeckComposition()) // 列1(2)は取れない
    expect(next).toBe(wave)
  })

  test('アルギズ発動中は、rowIndexを指定して列の途中のカードをプレイでき、上に乗っていたカードは繰り下がって残る', () => {
    const wave = baseWave({
      playFromAnywhereActiveThisWave: true,
      tableau: [[card(1, '♣', 6), card(9, '♠', 1)], [card(2, '♦', 2)]], // idx0=6(取れる) idx1=1(取れない、これが一番上)
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition(), Math.random, null, 0)
    expect(next.foundation).toEqual(card(1, '♣', 6))
    expect(next.tableau[0]).toEqual([card(9, '♠', 1)])
  })

  test('アルギズ非発動中は、rowIndexで一番上以外(取れるランクのカード)を指定しても無視され何も変わらない', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6), card(9, '♠', 10)], [card(2, '♦', 2)]], // idx0=6(奥、ランク的には取れる) idx1=10(一番上、ランク差5で取れない)
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition(), Math.random, null, 0)
    expect(next).toBe(wave)
  })

  test('コンボ1(倍率1+0.1=1.1)で加点される', () => {
    // 列一掃ボーナスが混ざらないよう、played対象の下にダミー札を積んで列が空にならないようにする
    const wave = baseWave({ tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]] })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(next.combo).toBe(1)
    expect(next.score).toBe(Math.floor(scoring.basePoint * 1.1))
    expect(next.foundation).toEqual(card(1, '♣', 6))
    expect(next.chain).toEqual([card(1, '♣', 6)])
    expect(next.tableau[0]).toEqual([card(9, '♠', 1)])
  })

  test('lastGain.partsの先頭に基礎点の内訳が入り、コンボ1(倍率1.1)でもコンボ倍率の内訳が表示される', () => {
    const wave = baseWave({ tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]] })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(next.lastGain?.parts[0].text).toBe(`基礎点+${scoring.basePoint}`)
    expect(next.lastGain?.parts.map(p => p.text)).toContain('コンボ倍率×1.1')
  })

  test('lastGain.partsから再計算した仮合計は、実際に付与されたlastGain.pointsと一致する(パターン成立あり)', () => {
    const wave = baseWave({ tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]] })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(next.lastGain).not.toBeNull()
    expect(finalScoreFromScoreParts(next.lastGain!.parts)).toBe(next.lastGain!.points)
  })

  test('lastGain.partsから再計算した仮合計は、護符を複数所持している場合も実際のlastGain.pointsと一致する', () => {
    const wave = baseWave({
      tableau: [
        [card(9, '♠', 1), card(1, '♣', 6)],
        [card(2, '♦', 2)],
      ],
      combo: 3,
    })
    const items: ItemId[] = ['springBreeze', 'courage', 'calm']
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', items, 1000000, 0, standardDeckComposition())
    expect(next.lastGain).not.toBeNull()
    expect(finalScoreFromScoreParts(next.lastGain!.parts)).toBe(next.lastGain!.points)
  })

  test('lastGain.partsから再計算した仮合計は、ボス得点ロック発動時(実際の得点0)も一致する', () => {
    // ボス得点ロック発動によってlastGain.pointsが0になる状況を作る
    const wave = makeWave({
      stock: [card(1, '♠', 9)],
      combo: 2, // このめくりでnewCombo=3、baseComboCount=0によりeffectiveCombo=3
      chain: [card(2, '♠', 4), card(3, '♠', 5)],
      linked: true,
      score: 0,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['naive'], 1000000, standardDeckComposition(), 'none', Math.random, { kind: 'combo', maxCombo: 3, tierLabel: 'test-tier' })
    // ボス得点ロック発動により、lastGain.pointsが0になっている状況
    expect(next.lastGain).not.toBeNull()
    expect(next.lastGain!.points).toBe(0)
    // この0の状態でも、partsから再計算した仮合計が一致することを検証
    expect(finalScoreFromScoreParts(next.lastGain!.parts)).toBe(next.lastGain!.points)
  })

  test('コンボ2(倍率1+0.2=1.2)で加点される(パターン不一致の場合)', () => {
    // 1枚目を取ってコンボ1にし、2枚目(パターン不一致)を取ってコンボ2にする
    // (列一掃・全消しボーナスが混ざらないよう、played対象の下にダミー札を積んでおく)
    const wave = baseWave({
      tableau: [
        [card(9, '♠', 1), card(1, '♣', 6)],
        [card(10, '♠', 2), card(2, '♦', 9)],
      ],
    })
    const { wave: afterFirst } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    // 2列目のfoundation差分を6→9にするため、一旦foundationを差し替えたウェーブで2枚目を取る
    const wave2 = {
      ...afterFirst,
      foundation: card(1, '♣', 6),
      tableau: [[card(9, '♠', 1)], [card(10, '♠', 2), card(2, '♦', 7)]],
    }
    const { wave: next } = playCard(DEFAULT_PARAMS, wave2, 'none', [], 1000000, 1, standardDeckComposition())
    expect(next.combo).toBe(2)
    // 6→7は階段方向+1・長さ2(既定stairMinLen=5未満でボーナスなし)、スート♣→♦で色も違う→パターンボーナス0
    expect(next.score).toBe(afterFirst.score + Math.floor(scoring.basePoint * 1.2))
    expect(next.lastGain?.parts.map(p => p.text)).toContain('コンボ倍率×1.2')
  })

  test('基本ルール: 列の全カードを1コンボで空にすると列一掃ボーナスが加算される(1列目)', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 9)]],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows, 1],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(next.columnsEmptiedThisCombo).toBe(1)
    expect(next.score).toBe(Math.floor((scoring.basePoint + scoring.columnSweepBonus * 1) * 1.1))
    expect(next.lastGain?.parts.map(p => p.text)).toContain(`列一掃+${scoring.columnSweepBonus}`)
  })

  test('基本ルール: 列が現在の連続コンボ開始時点で全カードでなければ(=既に一部消化済みなら)列一掃ボーナスは付かない', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 9)]],
      comboStreakColumnLengths: [2, 1], // 列0はコンボ開始時点で2枚残っていた(rows=5と一致しないため、全カードを1コンボで消化したことにはならない)
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(next.columnsEmptiedThisCombo).toBe(0)
    expect(next.lastGain?.parts.some(p => p.text.startsWith('列一掃'))).toBe(false)
  })

  test('寛容の護符所持時: 列一掃の条件が「残りrows-talismans.grace.m枚以下から1コンボで空に」に緩和される', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 9)]],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows - DEFAULT_PARAMS.talismans.grace.m, 1],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['grace'], 1000000, 0, standardDeckComposition())
    expect(next.columnsEmptiedThisCombo).toBe(1)
    expect(next.lastGain?.parts.map(p => p.text)).toContain(`列一掃+${scoring.columnSweepBonus}`)
  })

  test('寛容の護符: 列一掃ボーナスに必要な枚数がtalismans.grace.m枚緩和される', () => {
    const items: ItemId[] = ['grace']
    const relaxedLen = DEFAULT_PARAMS.layout.rows - DEFAULT_PARAMS.talismans.grace.m
    const wave = baseWave({
      foundation: card(0, '♠', 6),
      tableau: [[card(1, '♣', 7)]],
      comboStreakColumnLengths: [relaxedLen],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', items, 1000000, 0, standardDeckComposition())
    expect(next.lastGain?.parts.some(p => p.text.startsWith('列一掃'))).toBe(true)
  })

  test('暗雲の護符所持時: 配布行数が増えていても、その行数分を1コンボで空にすれば列一掃ボーナスが成立する(バグ回帰テスト)', () => {
    const items: ItemId[] = ['darkClouds']
    const dealtRows = DEFAULT_PARAMS.layout.rows + DEFAULT_PARAMS.talismans.darkClouds.r
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 9)]],
      comboStreakColumnLengths: [dealtRows, 1],
      dealtRows,
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', items, 1000000, 0, standardDeckComposition())
    expect(next.columnsEmptiedThisCombo).toBe(1)
    expect(next.lastGain?.parts.map(p => p.text)).toContain(`列一掃+${scoring.columnSweepBonus}`)
  })

  test('同じコンボ内で2列目を空にすると列一掃ボーナスが列数倍になる', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 6), // 列1(rank7)との差を1にして取れるようにする
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 7)]],
      columnsEmptiedThisCombo: 1,
      comboStreakColumnLengths: [1, DEFAULT_PARAMS.layout.rows],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 1, standardDeckComposition())
    expect(next.columnsEmptiedThisCombo).toBe(2)
    expect(next.lastGain?.parts.map(p => p.text)).toContain(`列一掃+${scoring.columnSweepBonus * 2}`)
  })

  test('場札が0枚になったら全消しボーナス(clearBonus+残り山札×clearBonusPerStock)がgained計算に統合され、コンボ倍率もかかった上でendReason=fullClear', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [card(9, '♠', 1), card(10, '♠', 2)],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 100000000, 0, standardDeckComposition())
    expect(next.tableau.reduce((n, c) => n + c.length, 0)).toBe(0)
    expect(next.status).toBe('ended')
    expect(next.endReason).toBe('fullClear')
    const expectedClearBonus = scoring.clearBonus + 2 * scoring.clearBonusPerStock
    const expectedScore = Math.floor((scoring.basePoint + scoring.columnSweepBonus * 1 + expectedClearBonus) * 1.1)
    expect(next.score).toBe(expectedScore)
  })

  test('全消し時、全消しボーナスがlastGain.partsに統合され、コンボ倍率込みの1つの獲得点として扱われる', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [card(9, '♠', 1), card(10, '♠', 2)],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 100000000, 0, standardDeckComposition())
    const expectedClearBonus = scoring.clearBonus + 2 * scoring.clearBonusPerStock
    const expectedScore = Math.floor((scoring.basePoint + scoring.columnSweepBonus * 1 + expectedClearBonus) * 1.1)
    expect(next.lastGain?.points).toBe(expectedScore)
    expect(next.lastGain?.parts.map(p => p.text)).toContain(`全消し基礎+${scoring.clearBonus}`)
    expect(next.lastGain?.parts.map(p => p.text)).toContain(`全消し山札残数+${2 * scoring.clearBonusPerStock}`)
    expect(next.score).toBe(expectedScore)
  })

  test('流星: コンボが閾値に到達した瞬間、shootingStarNが永続加算される(この時点のgainedにはまだ反映されない)', () => {
    const items: ItemId[] = ['shootingStar']
    const wave = baseWave({
      score: 5000,
      combo: DEFAULT_PARAMS.talismans.shootingStar.c - 1,
      shootingStarN: 50,
      chain: [card(20, '♥', 3), card(21, '♦', 4)],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', items, 100000000, 0, standardDeckComposition())
    expect(next.combo).toBe(DEFAULT_PARAMS.talismans.shootingStar.c)
    expect(next.shootingStarN).toBe(50 + DEFAULT_PARAMS.talismans.shootingStar.n)
    // gainedへの加算はプレイ開始時点のshootingStarN(50)のみが反映され、
    // このプレイ内で新たに加算された分(合計100)はまだ反映されない。
    expect(next.lastGain?.parts.some(p => p.text === '流星+50')).toBe(true)
    expect(next.lastGain?.parts.some(p => p.text === `流星+${50 + DEFAULT_PARAMS.talismans.shootingStar.n}`)).toBe(false)
  })

  test('流星: 黄金と併用しコンボが閾値をまたいでジャンプしても発動する', () => {
    const items: ItemId[] = ['shootingStar', 'golden']
    const c = DEFAULT_PARAMS.talismans.shootingStar.c
    const wave = baseWave({
      score: 5000,
      combo: c - 1, // 黄金の+2適用でc+1へジャンプし、cをちょうど踏まない
      shootingStarN: 50,
      chain: [card(20, '♥', 3), card(21, '♦', 4)],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', items, 100000000, 0, standardDeckComposition())
    expect(next.combo).toBe(c + 1)
    expect(next.shootingStarN).toBe(50 + DEFAULT_PARAMS.talismans.shootingStar.n)
  })

  test('流星: 既に閾値以上の状態が続いている間は再発動しない', () => {
    const items: ItemId[] = ['shootingStar']
    const c = DEFAULT_PARAMS.talismans.shootingStar.c
    const wave = baseWave({
      score: 5000,
      combo: c, // 既に閾値以上
      shootingStarN: 50,
      chain: [card(20, '♥', 3), card(21, '♦', 4)],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', items, 100000000, 0, standardDeckComposition())
    expect(next.combo).toBe(c + 1)
    expect(next.shootingStarN).toBe(50)
  })

  test('流星: 蓄積されたshootingStarNは次のプレイのgainedに加算される', () => {
    const wave = makeWave({
      foundation: card(0, '♠', 5),
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      shootingStarN: 80,
      comboFrozenThisWave: true,
    })
    const withoutShootingStar = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    const withShootingStar = playCard(DEFAULT_PARAMS, wave, 'none', ['shootingStar'], 1000000, 0, standardDeckComposition())
    expect(withShootingStar.wave.score).toBe(withoutShootingStar.wave.score + 80)
  })

  test('スコアが目標に達したらendReason=targetでstatus=ended', () => {
    const wave = baseWave()
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 5, 0, standardDeckComposition()) // basePoint(100) >= target(5)
    expect(next.status).toBe('ended')
    expect(next.endReason).toBe('target')
  })

  test('status が playing でない場合は何もしない', () => {
    const wave = baseWave({ status: 'ended', endReason: 'target' })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(next).toBe(wave)
  })

  test('端数が出る設定でもfloorで切り捨てられる(保険の確認)', () => {
    const oddParams: typeof DEFAULT_PARAMS = {
      ...DEFAULT_PARAMS,
      scoring: { ...DEFAULT_PARAMS.scoring, basePoint: 15, comboMultiplierStep: 0.25 },
    }
    // 列一掃・全消しボーナスが混ざらないよう、played対象の下にダミー札を積んでおく
    const wave = baseWave({
      tableau: [
        [card(9, '♠', 1), card(1, '♣', 6)],
        [card(10, '♠', 2), card(2, '♦', 2)],
      ],
    })
    // コンボ1: 倍率1+1*0.25=1.25 → 15*1.25=18.75 → floor=18
    const { wave: afterFirst } = playCard(oddParams, wave, 'none', [], 1000000, 0, standardDeckComposition())
    const wave2 = { ...afterFirst, tableau: [[card(9, '♠', 1)], [card(10, '♠', 2), card(2, '♦', 7)]] }
    const { wave: next } = playCard(oddParams, wave2, 'none', [], 1000000, 1, standardDeckComposition())
    // コンボ2: 倍率1+2*0.25=1.5 → 15*1.5=22.5 → floor=22
    expect(next.score).toBe(afterFirst.score + 22)
  })

  test('カードを取るとlastDrawEffectがクリアされる', () => {
    const wave = baseWave({ lastDrawEffect: 'pattern' })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(next.lastDrawEffect).toBeNull()
  })

  test('プレイするとfirstPlayDoneがtrueになる(ウェーブ開始直後はfalse)', () => {
    const wave = baseWave({ tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]] })
    expect(wave.firstPlayDone).toBe(false)
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(next.firstPlayDone).toBe(true)
  })

  test('chainOriginにplayが追記される', () => {
    const wave = baseWave({ tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]] })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(next.chainOrigin).toEqual(['play'])
  })

  test('架橋の護符を持っていなければ、階段が3枚繋がっても既定のstairMinLen(5)未満のためボーナスが付かない', () => {
    const wave = baseWave({
      foundation: card(0, '♣', 5),
      chain: [card(20, '♠', 4), card(0, '♣', 5)],
      tableau: [[card(9, '♠', 1), card(1, '♦', 6)], [card(2, '♥', 2)]],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(next.lastGain?.parts.some(p => p.text.startsWith('階段'))).toBe(false)
  })

  test('架橋の護符を持っていれば、階段成立に必要な最小連続枚数がstairRelaxedMinLen(3)に緩和される', () => {
    const wave = baseWave({
      foundation: card(0, '♣', 5),
      chain: [card(20, '♠', 4), card(0, '♣', 5)],
      tableau: [[card(9, '♠', 1), card(1, '♦', 6)], [card(2, '♥', 2)]],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['bridge'], 1000000, 0, standardDeckComposition())
    expect(next.lastGain?.parts.map(p => p.text)).toContain(`階段3 +${scoring.stairBonus}`)
  })

  test('架橋の護符: 階段成立に必要な枚数がm枚緩和される(既定m=2で5→3)', () => {
    const items: ItemId[] = ['bridge']
    // チェーン[3,4]に5を継ぎ足して3枚の階段(3,4,5)にする。foundationをrank6にすることで
    // rank5のカード(foundationとの差1)が取得可能になる。既定のstairMinLen(5)では
    // 3枚では不成立だが、架橋によりm=2緩和され3枚で成立するはず。
    const wave = baseWave({
      foundation: card(0, '♠', 6),
      chain: [card(20, '♣', 3), card(21, '♦', 4)],
      tableau: [[card(1, '♥', 5)], [card(2, '♦', 2)]],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', items, 1000000, 0, standardDeckComposition())
    expect(next.lastGain?.parts.some(p => p.text.startsWith('階段'))).toBe(true)
  })

  test('架橋の護符: 同スート成立に必要な枚数もm枚緩和される(既定m=2で3→1)', () => {
    const items: ItemId[] = ['bridge']
    // evaluateChainBonusはchainBefore(プレイ前のチェーン)が空だと即bonus=0を返すため、
    // チェーンには既に1枚(基準カードと同スート)を入れておく。このプレイでchainIncludingThis
    // が2枚になり、effectiveSuitColorMinLen(3-2=1)なら2>=1で成立、既定値(3)なら2>=3で不成立。
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      chain: [card(0, '♠', 5)],
      tableau: [[card(1, '♠', 6)], [card(2, '♦', 2)]],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', items, 1000000, 0, standardDeckComposition())
    expect(next.lastGain?.parts.map(p => p.text)).toContain(`同スート+${DEFAULT_PARAMS.scoring.suitBonus}`)
  })

  test('gainedチャンネルの護符(springBreeze)は♣を取った時、得点に加算される', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['springBreeze'], 1000000, 0, standardDeckComposition())
    expect(next.score).toBe(Math.floor((scoring.basePoint + DEFAULT_PARAMS.talismans.springBreeze.n) * 1.1))
  })

  test('コンボ倍率は護符のgained加算効果にも適用される(最後に一括適用)', () => {
    // 春風(springBreeze)は♣を取ったときn点の固定加算。コンボ2→3(倍率1+2*step)の状態でプレイし、
    // 固定加算分にもコンボ倍率がかかっていることを確認する(先にコンボ倍率だけ適用して後から加算する旧実装ではNG)。
    const items: ItemId[] = ['springBreeze']
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      combo: 2,
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', items, 1000000, 0, standardDeckComposition())
    expect(next.combo).toBe(3)
    const multiplier = 1 + 3 * scoring.comboMultiplierStep
    const expectedGained = Math.floor((scoring.basePoint + DEFAULT_PARAMS.talismans.springBreeze.n) * multiplier)
    expect(next.lastGain?.points).toBe(expectedGained)
  })

  test('clearBonusチャンネルの護符(purify)は全消し時のみgained計算内の全消しボーナスに加算され、コンボ倍率もかかる', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [card(9, '♠', 1), card(10, '♠', 2)],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['purify'], 100000000, 0, standardDeckComposition())
    expect(next.endReason).toBe('fullClear')
    const expectedClearBonus = scoring.clearBonus + 2 * scoring.clearBonusPerStock + DEFAULT_PARAMS.talismans.purify.n
    const expectedScore = Math.floor((scoring.basePoint + scoring.columnSweepBonus * 1 + expectedClearBonus) * 1.1)
    expect(next.score).toBe(expectedScore)
  })

  test('全消しボーナスにもコンボ倍率がかかる(基礎点等と同じ乗算チェーンの内側にある)', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      combo: 4, // このプレイでnewCombo=5、effectiveCombo=5、コンボ倍率=1+5*0.1=1.5
      tableau: [[card(1, '♣', 6)]],
      stock: [card(9, '♠', 1)],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 100000000, 0, standardDeckComposition())
    expect(next.endReason).toBe('fullClear')
    const expectedClearBonus = scoring.clearBonus + 1 * scoring.clearBonusPerStock
    const multiplier = 1 + 5 * scoring.comboMultiplierStep
    const expectedScore = Math.floor((scoring.basePoint + scoring.columnSweepBonus * 1 + expectedClearBonus) * multiplier)
    expect(next.score).toBe(expectedScore)
  })

  test('ボス得点ロック成立時、全消しボーナスも含めてgainedが0になる', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      combo: 1, // このプレイでnewCombo=2、effectiveCombo=2
      tableau: [[card(1, '♣', 6)]],
      stock: [card(9, '♠', 1)],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 100000000, 0, standardDeckComposition(), Math.random, { kind: 'combo', maxCombo: 2, tierLabel: 'test-tier' })
    expect(next.endReason).toBe('fullClear')
    expect(next.lastGain?.points).toBe(0)
    expect(next.score).toBe(wave.score)
  })

  test('clearBonusチャンネルの護符(purify)は、全消しにならない通常プレイでは発動しない', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]], // ダミー列を残し全消しにならないようにする
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['purify'], 1000000, 0, standardDeckComposition())
    expect(next.endReason).not.toBe('fullClear')
    expect(next.lastGain?.parts.map(p => p.text)).not.toContain('全消し基礎+' + scoring.clearBonus)
    const multiplier = 1 + 1 * scoring.comboMultiplierStep
    expect(next.lastGain?.points).toBe(Math.floor(scoring.basePoint * multiplier))
  })

  test('全消し時、clearBonusチャンネルの護符(purify)と独立した乗算護符(frost)を組み合わせても正しい順序で計算される', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [card(9, '♠', 1), card(10, '♠', 2)],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
      frostX: 1.5,
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['purify', 'frost'], 100000000, 0, standardDeckComposition())
    expect(next.endReason).toBe('fullClear')
    const expectedClearBonus = scoring.clearBonus + 2 * scoring.clearBonusPerStock + DEFAULT_PARAMS.talismans.purify.n
    const expectedScore = Math.floor((scoring.basePoint + scoring.columnSweepBonus * 1 + expectedClearBonus) * 1.1 * 1.5)
    expect(next.score).toBe(expectedScore)
  })

  test('複数のclearBonus護符は所持順に適用される(purify→temperanceとtemperance→purifyで結果が異なる)', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [card(9, '♠', 1), card(10, '♠', 2)],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
    })
    const { wave: order1 } = playCard(DEFAULT_PARAMS, wave, 'none', ['purify', 'temperance'], 100000000, 0, standardDeckComposition())
    const { wave: order2 } = playCard(DEFAULT_PARAMS, wave, 'none', ['temperance', 'purify'], 100000000, 0, standardDeckComposition())
    expect(order1.score).not.toBe(order2.score)
  })

  test('複数のgained護符も所持順に適用される(conscience→courageとcourage→conscienceで結果が異なる)', () => {
    const wave = baseWave({ tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]] })
    const { wave: order1 } = playCard(DEFAULT_PARAMS, wave, 'none', ['conscience', 'courage'], 1000000, 0, standardDeckComposition())
    const { wave: order2 } = playCard(DEFAULT_PARAMS, wave, 'none', ['courage', 'conscience'], 1000000, 0, standardDeckComposition())
    expect(order1.score).not.toBe(order2.score)
    const comboMultiplier = 1 + 1 * scoring.comboMultiplierStep
    expect(order1.score).toBe(Math.floor((scoring.basePoint + DEFAULT_PARAMS.talismans.conscience.n) * (1 + 1 * DEFAULT_PARAMS.talismans.courage.x) * comboMultiplier))
    expect(order2.score).toBe(Math.floor((scoring.basePoint * (1 + 1 * DEFAULT_PARAMS.talismans.courage.x) + DEFAULT_PARAMS.talismans.conscience.n) * comboMultiplier))
  })

  test('同じ列を連続でプレイするとsameColumnStreakが増え、違う列なら1に戻る', () => {
    // 列0: 1回目で6(基礎rank5と隣接)を取ったあと、残る7が新foundation(6)と隣接するようにする
    const wave = baseWave({
      tableau: [[card(9, '♠', 7), card(1, '♣', 6)], [card(10, '♠', 2), card(2, '♦', 7)]],
    })
    const { wave: first } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(first.sameColumnStreak).toBe(1)
    expect(first.lastPlayedColumn).toBe(0)
    const { wave: second } = playCard(DEFAULT_PARAMS, first, 'none', [], 1000000, 0, standardDeckComposition())
    expect(second.sameColumnStreak).toBe(2)
    // 列1: 1回目で列0の6を取ったあと、列1の7が(上書き後の)foundation(6)と隣接するようにする
    const wave2 = baseWave({
      tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(10, '♠', 2), card(11, '♦', 7)]],
    })
    const { wave: thirdSetup } = playCard(DEFAULT_PARAMS, wave2, 'none', [], 1000000, 0, standardDeckComposition())
    const { wave: differentColumn } = playCard(DEFAULT_PARAMS, { ...thirdSetup, foundation: card(1, '♣', 6) }, 'none', [], 1000000, 1, standardDeckComposition())
    expect(differentColumn.sameColumnStreak).toBe(1)
    expect(differentColumn.lastPlayedColumn).toBe(1)
  })

  test('maxComboThisWaveはこれまでの最大コンボ数を保持する', () => {
    const wave = baseWave({ combo: 5, tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]], maxComboThisWave: 5 })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(next.combo).toBe(6)
    expect(next.maxComboThisWave).toBe(6)
    const wave2 = baseWave({ combo: 2, tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]], maxComboThisWave: 10 })
    const { wave: next2 } = playCard(DEFAULT_PARAMS, wave2, 'none', [], 1000000, 0, standardDeckComposition())
    expect(next2.maxComboThisWave).toBe(10) // 既存の最大値の方が大きければ維持
  })

  test('列一掃が成立するとtotalColumnsEmptiedThisWaveとcolumnSweepActiveThisWaveが更新される', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 9)]],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows, 1],
      totalColumnsEmptiedThisWave: 3,
      columnSweepActiveThisWave: false,
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(next.totalColumnsEmptiedThisWave).toBe(4)
    expect(next.columnSweepActiveThisWave).toBe(true)
  })

  test('役ボーナスが成立するとroleFiredThisChainがtrueになり、フラッシュならflushActiveThisComboもtrueになる', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 1),
      chain: [card(20, '♥', 11), card(21, '♦', 12)], // ロイヤル役成立目前(J,Q)
      tableau: [[card(1, '♣', 13)], [card(2, '♦', 2)]],
      roleFiredThisChain: false,
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(next.roleFiredThisChain).toBe(true)
  })

  test('playCardはrand引数を省略してもデフォルト(Math.random)で動作する(既存呼び出しの後方互換性)', () => {
    const wave = baseWave({ tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]] })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(next.combo).toBe(1)
  })

  test('治癒: 列一掃した列は、そのコンボが継続している間はまだ復活しない(コンボリセット時に初めて効く)', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 9)]],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows, 1],
      discardPile: [card(10, '♦', 1), card(11, '♦', 2), card(12, '♦', 3)],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['healing'], 1000000, 0, standardDeckComposition(), createRng(1))
    expect(next.tableau[0]).toHaveLength(0) // まだ復活しない
    expect(next.sweptColumnsThisCombo).toEqual([{ colIndex: 0, startLength: DEFAULT_PARAMS.layout.rows }])
  })

  test('治癒: 通常のコンボリセット(drawStockでパターン不継続)時に、列一掃した列がコンボ開始時の枚数を上限に復活する', () => {
    const afterSweep = makeWave({
      foundation: card(1, '♣', 6),
      tableau: [[], [card(2, '♦', 9)]],
      stock: [card(20, '♦', 1)], // 赤札で色継続もせず、差5でパターン不継続
      chain: [card(0, '♠', 5), card(1, '♣', 6)],
      linked: true,
      sweptColumnsThisCombo: [{ colIndex: 0, startLength: DEFAULT_PARAMS.layout.rows }],
      discardPile: [],
    })
    const result = drawStock(DEFAULT_PARAMS, afterSweep, ['healing'], 1000000, standardDeckComposition())
    // discardPileにはコンボリセットでチェーンの2枚が加わってから復活に使われる
    expect(result.wave.tableau[0].length).toBe(Math.min(2, DEFAULT_PARAMS.layout.rows))
    expect(result.wave.sweptColumnsThisCombo).toEqual([])
  })

  test('治癒: コンボ開始時の枚数を上限に復活し、それ以上は復活しない', () => {
    const afterSweep = makeWave({
      foundation: card(1, '♣', 6),
      tableau: [[], [card(2, '♦', 9)]],
      stock: [card(20, '♠', 1)],
      chain: [card(1, '♣', 6)],
      linked: true,
      sweptColumnsThisCombo: [{ colIndex: 0, startLength: 2 }],
      discardPile: [card(30, '♦', 1), card(31, '♦', 2), card(32, '♦', 3), card(33, '♦', 4)],
    })
    const result = drawStock(DEFAULT_PARAMS, afterSweep, ['healing'], 1000000, standardDeckComposition())
    expect(result.wave.tableau[0]).toHaveLength(2) // startLength=2が上限
    expect(result.wave.discardPile).toHaveLength(4 + 1 - 2) // 元4枚+チェーン1枚 - 復活2枚
  })

  test('治癒を持っていなければ、コンボリセット時も列は空のまま', () => {
    const afterSweep = makeWave({
      foundation: card(1, '♣', 6),
      tableau: [[], [card(2, '♦', 9)]],
      stock: [card(20, '♠', 1)],
      chain: [card(1, '♣', 6)],
      linked: true,
      sweptColumnsThisCombo: [{ colIndex: 0, startLength: 2 }],
      discardPile: [card(30, '♦', 1)],
    })
    const result = drawStock(DEFAULT_PARAMS, afterSweep, [], 1000000, standardDeckComposition())
    expect(result.wave.tableau[0]).toHaveLength(0)
  })

  test('再生: 全消し時に山札が残っていれば、スコアp%消費して場札を復活させ、その後山札を1枚捲る', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [card(20, '♠', 9)], // 差3、継続しない(パターン不成立)想定
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
      discardPile: [card(10, '♦', 1), card(11, '♦', 2), card(12, '♦', 3)],
    })
    const result = playCard(DEFAULT_PARAMS, wave, 'none', ['regeneration'], 100000000, 0, standardDeckComposition(), createRng(1))
    expect(result.wave.status).toBe('playing')
    expect(result.wave.endReason).toBeNull()
    expect(result.wave.regenerationUsedThisWave).toBe(true)
    // 山札を1枚捲った後なのでstockは0枚(元々1枚だけだった)
    expect(result.wave.stock).toHaveLength(0)
  })

  test('再生: 山札が0枚の全消しでは発動しない(通常の全消し終了になる)', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
      discardPile: [card(10, '♦', 1), card(11, '♦', 2), card(12, '♦', 3)],
    })
    const result = playCard(DEFAULT_PARAMS, wave, 'none', ['regeneration'], 100000000, 0, standardDeckComposition(), createRng(1))
    expect(result.wave.status).toBe('ended')
    expect(result.wave.endReason).toBe('fullClear')
    expect(result.wave.regenerationUsedThisWave).toBe(false)
  })

  test('再生: 捨て札が無ければ通常通り全消し終了になる', () => {
    // 全消し時に走るコンボリセットでは、直前にプレイした札(chain末尾=foundation)は
    // 新chainへ引き継がれ捨て札へは移らない(重複防止)。よって開始時discardPileが空なら
    // 復活対象が無く、再生は場札を復活できずそのまま全消し終了になる。
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [card(20, '♠', 9)],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
      discardPile: [],
    })
    const result = playCard(DEFAULT_PARAMS, wave, 'none', ['regeneration'], 100000000, 0, standardDeckComposition(), createRng(1))
    expect(result.wave.status).toBe('ended')
    expect(result.wave.endReason).toBe('fullClear')
  })

  test('再生: ウェーブ中2回目は発動しない(regenerationUsedThisWaveがtrueなら通常の全消し終了)', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [card(20, '♠', 9)],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
      discardPile: [card(10, '♦', 1)],
      regenerationUsedThisWave: true,
    })
    const result = playCard(DEFAULT_PARAMS, wave, 'none', ['regeneration'], 100000000, 0, standardDeckComposition(), createRng(1))
    expect(result.wave.status).toBe('ended')
    expect(result.wave.endReason).toBe('fullClear')
  })

  test('治癒と再生を同時所持し、所持順で治癒が先なら治癒が優先され再生は発動しない', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [card(20, '♠', 9)],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
      discardPile: [card(10, '♦', 1), card(11, '♦', 2), card(12, '♦', 3)],
    })
    const result = playCard(DEFAULT_PARAMS, wave, 'none', ['healing', 'regeneration'], 100000000, 0, standardDeckComposition(), createRng(1))
    expect(result.wave.status).toBe('playing')
    expect(result.wave.regenerationUsedThisWave).toBe(false) // 治癒が先に場札を埋めたため再生は不発動
  })

  test('治癒と再生を同時所持し、所持順で再生が先なら再生が優先され場札全体が復活する', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [card(20, '♠', 9)],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
      discardPile: [card(10, '♦', 1), card(11, '♦', 2), card(12, '♦', 3)],
    })
    const result = playCard(DEFAULT_PARAMS, wave, 'none', ['regeneration', 'healing'], 100000000, 0, standardDeckComposition(), createRng(1))
    expect(result.wave.status).toBe('playing')
    expect(result.wave.regenerationUsedThisWave).toBe(true)
  })

  test('全消し後に治癒・再生で復活する際、最後にプレイしたカードが場札と捨て札に重複・消失しない', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [card(20, '♠', 9)],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
      discardPile: [card(10, '♦', 1), card(11, '♦', 2), card(12, '♦', 3)],
    })
    const initialCardCount = wave.tableau.reduce((n, c) => n + c.length, 0) + wave.stock.length + wave.discardPile.length
    const result = playCard(DEFAULT_PARAMS, wave, 'none', ['regeneration'], 100000000, 0, standardDeckComposition(), createRng(1))
    const allCardIds = [
      ...result.wave.tableau.flat().map(c => c.id),
      ...result.wave.discardPile.map(c => c.id),
      ...result.wave.stock.map(c => c.id),
      ...(result.wave.tableau.flat().some(c => c.id === result.wave.chain[0]?.id) ? [] : [result.wave.chain[0].id]),
    ]
    expect(allCardIds.length).toBe(initialCardCount) // 消失していないこと
    expect(new Set(allCardIds).size).toBe(allCardIds.length) // 重複していないこと
  })

  test('黄金: コンボが+1ではなく+2進む', () => {
    const wave = baseWave({ combo: 3, tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]] })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['golden'], 1000000, 0, standardDeckComposition())
    expect(next.combo).toBe(5)
  })

  test('黄金を持たなければ通常通りコンボは+1', () => {
    const wave = baseWave({ combo: 3, tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]] })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(next.combo).toBe(4)
  })

  test('庇護: コンボ数(計算用)がc未満ならcとして計算される', () => {
    const wave = baseWave({ combo: 0, tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]] })
    // combo=0でプレイするとnewCombo=1。庇護c=3未満なので一時comboは3として計算される。
    const { wave: withProtection } = playCard(DEFAULT_PARAMS, wave, 'none', ['protection'], 1000000, 0, standardDeckComposition())
    const { wave: without } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(withProtection.score).toBeGreaterThan(without.score)
  })

  test('大地: コンボ数(計算用)に常にcが加算される', () => {
    const wave = baseWave({ combo: 5, tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]] })
    const { wave: withEarth } = playCard(DEFAULT_PARAMS, wave, 'none', ['earth'], 1000000, 0, standardDeckComposition())
    const { wave: without } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(withEarth.score).toBeGreaterThan(without.score)
    // wave.combo自体(実コンボ)は一時comboの影響を受けない
    expect(withEarth.combo).toBe(without.combo)
  })

  test('庇護・大地は所持順で一時comboに適用され、大地→庇護の順だと庇護が不発化しうる', () => {
    // combo=0でプレイ: newCombo=1。大地(c=2)が先に+2して一時combo=3。
    // 庇護(c=3)は「3 < 3」が偽なので不発化(3のまま)。
    const wave = baseWave({ combo: 0, tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]] })
    const { wave: earthThenProtection } = playCard(DEFAULT_PARAMS, wave, 'none', ['earth', 'protection'], 1000000, 0, standardDeckComposition())
    // 庇護→大地の順なら: newCombo=1→庇護でc=3に底上げ→大地で+2して5になる。より高スコアになるはず。
    const { wave: protectionThenEarth } = playCard(DEFAULT_PARAMS, wave, 'none', ['protection', 'earth'], 1000000, 0, standardDeckComposition())
    expect(protectionThenEarth.score).toBeGreaterThan(earthThenProtection.score)
  })

  test('祝福: 役が成立するとbaseComboCountが+1され、一時comboにも反映される', () => {
    // フラッシュ成立(4スート)する組み合わせでプレイする
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      chain: [card(20, '♥', 3), card(21, '♦', 4), card(22, '♠', 5)],
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      baseComboCount: 0,
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['sanctify'], 1000000, 0, standardDeckComposition())
    expect(next.baseComboCount).toBe(1)
    // 一時comboにも+1が反映されていることを、祝福あり/なしのスコア差で確認する
    // (庇護・大地のテストと同じ手法。baseComboCountの検証だけではeffectiveComboへの
    // 反映漏れを検知できないため)。
    const { wave: withSanctify } = playCard(DEFAULT_PARAMS, wave, 'none', ['sanctify'], 1000000, 0, standardDeckComposition())
    const { wave: without } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(withSanctify.score).toBeGreaterThan(without.score)
  })

  test('祝福: 役が成立しなければbaseComboCountは変化しない', () => {
    const wave = baseWave({
      tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]],
      baseComboCount: 2,
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['sanctify'], 1000000, 0, standardDeckComposition())
    expect(next.baseComboCount).toBe(2)
  })

  test('基礎コンボ数(baseComboCount)は所持護符に関わらず常に得点計算のコンボ数に加算される', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]],
      baseComboCount: 3,
    })
    const { wave: withBase } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    const { wave: without } = playCard(DEFAULT_PARAMS, { ...wave, baseComboCount: 0 }, 'none', [], 1000000, 0, standardDeckComposition())
    expect(withBase.score).toBeGreaterThan(without.score)
    // baseComboCount自体はプレイ後も変化しない(役成立時の祝福以外では増減しない)
    expect(withBase.baseComboCount).toBe(3)
  })

  test('明星: 役の種類ごとのウェーブ内累積成立回数に応じて役ボーナスが倍加する', () => {
    // フラッシュが成立する組み合わせ(4スート)
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      chain: [card(20, '♥', 3), card(21, '♦', 4), card(22, '♠', 5)],
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      roleOccurrenceCountThisWave: { flush: 3 },
    })
    const { wave: withMorningStar } = playCard(DEFAULT_PARAMS, wave, 'none', ['morningStar'], 1000000, 0, standardDeckComposition())
    const { wave: without } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(withMorningStar.score).toBeGreaterThan(without.score)
  })

  test('明星: 役が成立するとroleOccurrenceCountThisWaveが+1される(今回分は倍率計算に使わない)', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      chain: [card(20, '♥', 3), card(21, '♦', 4), card(22, '♠', 5)],
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      roleOccurrenceCountThisWave: { flush: 1 },
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['morningStar'], 1000000, 0, standardDeckComposition())
    expect(next.roleOccurrenceCountThisWave.flush).toBe(2)
  })

  test('roleOccurrenceCountThisWaveは明星を持たなくても役成立のたび更新される', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      chain: [card(20, '♥', 3), card(21, '♦', 4), card(22, '♠', 5)],
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      roleOccurrenceCountThisWave: { flush: 1 },
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(next.roleOccurrenceCountThisWave.flush).toBe(2)
  })

  test('ソウィロ: 発動後に初めて成立した役(このプレイ自体)がx倍になり、役の種類が記憶される', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      chain: [card(20, '♥', 3), card(21, '♦', 4), card(22, '♠', 5)],
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      sowiloActiveThisWave: true,
    })
    const { wave: withSowilo } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    const { wave: without } = playCard(DEFAULT_PARAMS, { ...wave, sowiloActiveThisWave: false }, 'none', [], 1000000, 0, standardDeckComposition())
    expect(withSowilo.score).toBeGreaterThan(without.score)
    expect(withSowilo.sowiloBoostedRole).toBe('flush')
  })

  test('ソウィロ: 一度確定した役は、次のプレイでも同じ役だけがx倍のまま維持される', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      tableau: [[card(1, '♣', 9)], [card(2, '♦', 2)]],
      sowiloActiveThisWave: true,
      sowiloBoostedRole: 'flush',
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(next.sowiloBoostedRole).toBe('flush')
  })

  test('ソウィロ: completeRunがコミット初回のプレイで同スート追加ボーナスも同じプレイ内でx倍になる', () => {
    // ランク11・12を末尾以外に配置し、ロイヤルセット(J,Q,K)が誤って同時成立しないようにする。
    // 全13ランクを単一スート(♠)で揃えることでcompleteRun成立時にsuitHeld=trueとなり、
    // 「コンプリートラン」本体ボーナスと「コンプリートラン(同スート)」追加ボーナスの2つが
    // 同一プレイ内でroleBonusMultiplier('completeRun')を2回呼び出す状況を再現する。
    const ranksInChainOrder = [11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const chainBefore = ranksInChainOrder.map((rank, i) => card(i + 1, '♠', rank as Card['rank']))
    const wave = baseWave({
      // foundationはchainとは独立したフィールドであり、isPlayable判定(プレイする札とのランク差)にのみ使う。
      // プレイする13のカードがランク差1で取れるよう、ランク12にしておく(chain内の要素との一致は不要)。
      foundation: card(99, '♠', 12),
      chain: chainBefore,
      tableau: [[card(90, '♠', 13)], [card(91, '♦', 2)]],
      sowiloActiveThisWave: true,
      sowiloBoostedRole: null,
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(next.lastGain?.parts.map(p => p.text)).toContain(`コンプリートラン+${scoring.completeRunBonus * DEFAULT_PARAMS.rites.sowilo.x}`)
    expect(next.lastGain?.parts.map(p => p.text)).toContain(`コンプリートラン(同スート)+${scoring.completeRunSuitBonus * DEFAULT_PARAMS.rites.sowilo.x}`)
    expect(next.sowiloBoostedRole).toBe('completeRun')
  })

  test('鋼鉄: 役が成立すると次のプレイへ同じ役ボーナスの複製が予約される', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      chain: [card(20, '♥', 3), card(21, '♦', 4), card(22, '♠', 5)],
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['mirror'], 1000000, 0, standardDeckComposition())
    expect(next.pendingRoleEcho).not.toBeNull()
    expect(next.pendingRoleEcho?.name).toBe('flush')
    expect(next.roleEchoUsedThisCombo.flush).toBe(true)
  })

  test('鋼鉄: 予約された複製は次のプレイで無条件に上乗せされる', () => {
    const wave = baseWave({
      tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]],
      pendingRoleEcho: { name: 'flush', amount: 999 },
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['mirror'], 1000000, 0, standardDeckComposition())
    expect(next.score).toBeGreaterThanOrEqual(999)
    expect(next.pendingRoleEcho).toBeNull()
  })

  test('鋼鉄: 同じ役はコンボ中1回しか予約されない', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      chain: [card(20, '♥', 3), card(21, '♦', 4), card(22, '♠', 5)],
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      roleEchoUsedThisCombo: { flush: true },
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['mirror'], 1000000, 0, standardDeckComposition())
    expect(next.pendingRoleEcho).toBeNull()
  })

  test('鋼鉄: 同ランクは枚数段階(sameRankCount)ごとに個別予約できる(段階1使用済みでも段階2は予約可能)', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 6),
      chain: [card(10, '♠', 7), card(11, '♣', 7)], // 同ランク(7)が既に2枚チェーンに存在
      tableau: [[card(1, '♦', 7)], [card(2, '♦', 2)]],
      sameRankEchoUsedThisCombo: [1], // 段階1(sameRankCount=1)は既に使用済み
    })
    // 今回のプレイでsameRankCount=2が成立する(段階1とは別枠なので予約可能なはず)
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['mirror'], 1000000, 0, standardDeckComposition())
    expect(next.pendingRoleEcho).not.toBeNull()
    expect(next.pendingRoleEcho?.name).toBe('sameRank')
    expect(next.sameRankEchoUsedThisCombo).toContain(2)
  })

  test('慈悲: playCardを通した実際のプレイでもmercyActiveNextComboの倍率が適用される', () => {
    // applyItemEffectsを直接呼ぶ単体テストだけでなく、playCardのitemEffectCtx構築を経由する
    // 統合経路でも慈悲が発動することを確認する(itemEffectCtxオブジェクトリテラルへの
    // フィールド追加漏れは単体テストでは検知できないため)。
    const wave = baseWave({
      tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]],
      mercyActiveNextCombo: true,
    })
    const { wave: withMercy } = playCard(DEFAULT_PARAMS, wave, 'none', ['mercy'], 1000000, 0, standardDeckComposition())
    const { wave: without } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(withMercy.score).toBeGreaterThan(without.score)
  })

  test('高潔の護符: effectiveSuitColorMinLen経由で同スート判定される(将来架橋対応の土台)', () => {
    // ctx.effectiveSuitColorMinLenが正しく渡っていることを、既定値(3枚)でのみ確認する回帰テスト。
    const items: ItemId[] = ['nobility']
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      chain: [card(20, '♠', 3), card(21, '♠', 4)],
      tableau: [[card(1, '♠', 6)], [card(2, '♦', 2)]],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', items, 1000000, 0, standardDeckComposition())
    expect(next.lastGain?.parts.map(p => p.text)).toContain(`高潔+${DEFAULT_PARAMS.talismans.nobility.n}`)
  })

  // playCard/drawStockのitemEffectCtx.playCountInChain計算式そのものを外部から観測して
  // 検証するテストは、現時点(このタスクの範囲)では書けない。消費側の護符(序章・幕間)が
  // まだctx.comboのみを見ておりisPlayAction/playCountInChainを読んでいないため、計算式が
  // 正しくても壊れていてもlastGain等の出力は変化しない。フィールドの型・配線の確認は
  // 上のdescribe('applyItemEffects (グループ7: コンボ内位置系)')内のctx()往復テストで行う。
  // 計算式自体の実質的な検証は、Task 8/9で序章・幕間がこれらのフィールドを消費するように
  // なった時点で、その挙動テストが担うことになる。

  test('護符gainedの時点で目標スコアに達した場合でも、コンボ到達によるshootingStarNの蓄積は行われる(蓄積は得点確定と独立)', () => {
    const items: ItemId[] = ['shootingStar']
    const wave = baseWave({
      score: 0,
      combo: DEFAULT_PARAMS.talismans.shootingStar.c - 1,
      shootingStarN: 50,
      chain: [card(20, '♥', 3), card(21, '♦', 4)],
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', items, scoring.basePoint, 0, standardDeckComposition())
    expect(next.status).toBe('ended')
    expect(next.endReason).toBe('target')
    expect(next.shootingStarN).toBe(50 + DEFAULT_PARAMS.talismans.shootingStar.n)
  })

  test('イサ: comboFrozenThisWave中はplayCardでもコンボ数が変わらない', () => {
    const wave = baseWave({ combo: 3, comboFrozenThisWave: true })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(next.combo).toBe(3)
  })

  test('マンナズ: 所持護符のレア度重み合計に応じて得点が倍算される', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]],
      mannazActiveThisWave: true,
    })
    const items: ItemId[] = ['bridge']
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', items, 1000000, 0, standardDeckComposition())
    const weight: Record<'C' | 'U' | 'R', number> = { C: 1, U: 2, R: 4 }
    const weightSum = items.reduce((sum, id) => sum + weight[DEFAULT_PARAMS.talismans[id].rarity], 0)
    const mannazFactor = 1 + weightSum * DEFAULT_PARAMS.rites.mannaz.x
    const comboMultiplier = 1 + 1 * scoring.comboMultiplierStep
    expect(next.score).toBe(Math.floor(scoring.basePoint * comboMultiplier * mannazFactor))
  })

  test('マンナズ: コンボ倍率とも正しく乗算合成される(上書きしない)', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 3),
      tableau: [[card(9, '♠', 1), card(1, '♣', 4)], [card(2, '♦', 2)]],
      combo: 3,
      mannazActiveThisWave: true,
    })
    const items: ItemId[] = ['bridge']
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', items, 1000000, 0, standardDeckComposition())
    const weight: Record<'C' | 'U' | 'R', number> = { C: 1, U: 2, R: 4 }
    const weightSum = items.reduce((sum, id) => sum + weight[DEFAULT_PARAMS.talismans[id].rarity], 0)
    const mannazFactor = 1 + weightSum * DEFAULT_PARAMS.rites.mannaz.x
    const comboMultiplier = 1 + (wave.combo + 1) * scoring.comboMultiplierStep // newCombo=combo+1
    expect(next.score).toBe(Math.floor(scoring.basePoint * comboMultiplier * mannazFactor))
  })

  test('マンナズが無効なら得点は通常通り(倍算されない)', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['bridge'], 1000000, 0, standardDeckComposition())
    expect(next.score).toBe(Math.floor(scoring.basePoint * 1.1))
  })

  test('スリサズ: nextPlayScoreMultiplierが1でなければ得点に乗算され、プレイ後は1にリセットされる', () => {
    const wave = baseWave({
      tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]],
      nextPlayScoreMultiplier: 1.5,
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    const comboMultiplier = 1 + 1 * scoring.comboMultiplierStep
    expect(next.score).toBe(Math.floor(scoring.basePoint * comboMultiplier * 1.5))
    expect(next.nextPlayScoreMultiplier).toBe(1)
  })

  test('スリサズ未発動時(nextPlayScoreMultiplierが既定1)は得点に影響しない', () => {
    const wave = baseWave({ tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]] })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    const comboMultiplier = 1 + 1 * scoring.comboMultiplierStep
    expect(next.score).toBe(Math.floor(scoring.basePoint * comboMultiplier))
  })

  test('慢心: playCard時、山札が0枚ならgainedがx倍になる', () => {
    const wave = baseWave({
      stock: [],
      comboFrozenThisWave: true, // コンボ倍率をかけず単純倍算のみを検証するため固定
    })
    const withoutArrogance = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    const withArrogance = playCard(DEFAULT_PARAMS, wave, 'none', ['arrogance'], 1000000, 0, standardDeckComposition())
    expect(withArrogance.wave.score).toBe(Math.floor(withoutArrogance.wave.score * DEFAULT_PARAMS.talismans.arrogance.x))
  })

  test('慢心: 山札が1枚以上残っていればgainedは変化しない', () => {
    const wave = baseWave({
      stock: [card(9, '♠', 9)],
      comboFrozenThisWave: true,
    })
    const withoutArrogance = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    const withArrogance = playCard(DEFAULT_PARAMS, wave, 'none', ['arrogance'], 1000000, 0, standardDeckComposition())
    expect(withArrogance.wave.score).toBe(withoutArrogance.wave.score)
  })

  describe('playCard: BossScoreLock(ボス制約による得点0)', () => {
    test('scoreLockがkind:comboで、effectiveComboがmaxCombo以下なら獲得点が0になる', () => {
      // 列を単一にすると全消しボーナス(clearBonus)が別枠で加算され score の比較が崩れるため、
      // 他のテストと同様にダミー列を残して全消しにならないようにする
      const wave = baseWave({
        foundation: card(0, '♠', 5),
        tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
        combo: 1, // このプレイでnewCombo=2、baseComboCount=0によりeffectiveCombo=2
      })
      const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition(), Math.random, { kind: 'combo', maxCombo: 2, tierLabel: 'test-tier' })
      expect(next.score).toBe(wave.score)
      expect(next.lastGain?.points).toBe(0)
    })

    test('scoreLockが成立した場合、lastGain.partsは惑星ロックパーツ1件のみになる(基礎点等の他パーツは含まれない)', () => {
      const wave = baseWave({
        foundation: card(0, '♠', 5),
        tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
        combo: 1, // このプレイでnewCombo=2、baseComboCount=0によりeffectiveCombo=2
      })
      const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition(), Math.random, { kind: 'combo', maxCombo: 2, tierLabel: 'test-tier' })
      expect(next.lastGain?.parts).toHaveLength(1)
      expect(next.lastGain?.parts[0]).toEqual({ label: 'test-tier: 獲得点0', kind: 'lock', amount: 0, text: 'test-tier: 獲得点0' })
    })

    test('scoreLockがkind:comboで、effectiveComboがmaxComboを超えるなら通常通り得点する', () => {
      const wave = baseWave({
        foundation: card(0, '♠', 5),
        tableau: [[card(1, '♣', 6)]],
        combo: 2, // このプレイでnewCombo=3、effectiveCombo=3 > maxCombo(2)
      })
      const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition(), Math.random, { kind: 'combo', maxCombo: 2, tierLabel: 'test-tier' })
      expect(next.lastGain?.points).toBeGreaterThan(0)
    })

    test('scoreLockがkind:suitで、対象スートのカードを取ると獲得点が0になる', () => {
      // 列を単一にすると全消しボーナス(clearBonus)が別枠で加算され score の比較が崩れるため、
      // 他のテストと同様にダミー列を残して全消しにならないようにする
      const wave = baseWave({
        foundation: card(0, '♠', 5),
        tableau: [[card(1, '♠', 6)], [card(2, '♦', 2)]],
      })
      const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition(), Math.random, { kind: 'suit', suit: '♠', tierLabel: 'test-tier' })
      expect(next.score).toBe(wave.score)
      expect(next.lastGain?.points).toBe(0)
    })

    test('scoreLockがkind:suitで、対象外のスートのカードを取ると通常通り得点する', () => {
      const wave = baseWave({
        foundation: card(0, '♠', 5),
        tableau: [[card(1, '♥', 6)]],
      })
      const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition(), Math.random, { kind: 'suit', suit: '♠', tierLabel: 'test-tier' })
      expect(next.lastGain?.points).toBeGreaterThan(0)
    })

    test('scoreLockがkind:suitで、ワイルドを取ると対象スートと一致していても通常通り得点する', () => {
      const wave = baseWave({
        foundation: card(0, '♠', 5),
        tableau: [[card(1, '★', 0, true)]],
      })
      const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition(), Math.random, { kind: 'suit', suit: '♠', tierLabel: 'test-tier' })
      expect(next.lastGain?.points).toBeGreaterThan(0)
    })

    test('scoreLockを省略(未指定)すると通常通り得点する(既存の呼び出し箇所は無変更のまま動作する)', () => {
      const wave = baseWave({
        foundation: card(0, '♠', 5),
        tableau: [[card(1, '♣', 6)]],
      })
      const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
      expect(next.lastGain?.points).toBeGreaterThan(0)
    })

    test('scoreLockがkind:oddComboで、effectiveComboが奇数なら獲得点が0になる', () => {
      // 列を単一にすると全消しボーナス(clearBonus)が別枠で加算されscoreの比較が崩れるため、
      // 他のロック系テストと同様にダミー列を残して全消しにならないようにする(計画のスニペットの
      // tableauは単一列だったが、既存のcombo/suitロックテストと同じ2列パターンに合わせて修正した)
      const oddWave = baseWave({
        foundation: card(0, '♠', 5),
        tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
        combo: 0, // このプレイでnewCombo=1、baseComboCount=0によりeffectiveCombo=1(奇数)
      })
      const { wave: next } = playCard(DEFAULT_PARAMS, oddWave, 'none', [], 1000000, 0, standardDeckComposition(), Math.random, { kind: 'oddCombo', tierLabel: 'test-tier' })
      expect(next.score).toBe(oddWave.score)
      expect(next.lastGain?.points).toBe(0)
    })

    test('scoreLockがkind:oddComboで、effectiveComboが偶数なら通常通り得点する', () => {
      const wave = baseWave({
        foundation: card(0, '♠', 5),
        tableau: [[card(1, '♣', 6)]],
        combo: 1, // このプレイでnewCombo=2、effectiveCombo=2(偶数)
      })
      const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition(), Math.random, { kind: 'oddCombo', tierLabel: 'test-tier' })
      expect(next.lastGain?.points).toBeGreaterThan(0)
    })

    test('scoreLockがkind:faceで、絵札(非ワイルド)を取ると獲得点が0になる', () => {
      // 列を単一にすると全消しボーナス(clearBonus)が別枠で加算されscoreの比較が崩れるため、
      // 他のロック系テストと同様にダミー列を残して全消しにならないようにする(計画のスニペットの
      // tableauは単一列だったが、既存のcombo/suitロックテストと同じ2列パターンに合わせて修正した)
      const wave = baseWave({
        foundation: card(0, '♠', 12), // Q
        tableau: [[card(1, '♠', 13)], [card(2, '♦', 2)]], // K、ランク差1で取れる、かつ絵札
      })
      const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition(), Math.random, { kind: 'face', tierLabel: 'test-tier' })
      expect(next.score).toBe(wave.score)
      expect(next.lastGain?.points).toBe(0)
    })

    test('scoreLockがkind:faceで、絵札以外を取ると通常通り得点する', () => {
      const wave = baseWave({
        foundation: card(0, '♠', 5),
        tableau: [[card(1, '♣', 6)]], // 絵札ではない
      })
      const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition(), Math.random, { kind: 'face', tierLabel: 'test-tier' })
      expect(next.lastGain?.points).toBeGreaterThan(0)
    })

    test('scoreLockがkind:faceで、ワイルドを取ると絵札扱いされず通常通り得点する', () => {
      const wave = baseWave({
        foundation: card(0, '♠', 5),
        tableau: [[card(1, '★', 0, true)]],
      })
      const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition(), Math.random, { kind: 'face', tierLabel: 'test-tier' })
      expect(next.lastGain?.points).toBeGreaterThan(0)
    })
  })
})

describe('drawStock', () => {
  test('山札が空なら何もしない', () => {
    const wave = makeWave({ stock: [] })
    const composition = standardDeckComposition()
    expect(drawStock(DEFAULT_PARAMS, wave, [], 1000000, composition).wave).toBe(wave)
  })

  test('コンボリセット時、沈着はもう直接加算しないためスコアで目標に達することはない(baseComboCountの強化に置き換わったため)', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)], // 差4、パターン不継続
      chain: [card(3, '♥', 5)],
      linked: true,
      score: 100,
      baseComboCount: 0,
    })
    const result = drawStock(DEFAULT_PARAMS, wave, ['composure'], 100 + 1, standardDeckComposition())
    expect(result.wave.status).toBe('playing')
    expect(result.wave.score).toBe(100)
    expect(result.wave.baseComboCount).toBe(DEFAULT_PARAMS.talismans.composure.n)
  })

  test('通常時(継続条件なし): コンボ・チェーン・列一掃カウント・comboStreakColumnLengthsがリセットされ、捲った札1枚が新しい起点になる', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 9)],
      combo: 3,
      chain: [card(2, '♣', 1)],
      chainOrigin: ['play'],
      linked: true,
      columnsEmptiedThisCombo: 2,
      tableau: [[card(3, '♣', 2)], [card(4, '♦', 8), card(5, '♥', 9)]],
      comboStreakColumnLengths: [0, 1],
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], 1000000, standardDeckComposition())
    expect(next.foundation).toEqual(card(1, '♠', 9))
    expect(next.combo).toBe(0)
    expect(next.chain).toEqual([card(1, '♠', 9)])
    expect(next.chainOrigin).toEqual(['draw'])
    expect(next.linked).toBe(false)
    expect(next.columnsEmptiedThisCombo).toBe(0)
    expect(next.comboStreakColumnLengths).toEqual([1, 2])
    expect(next.lastDrawEffect).toBeNull()
    expect(next.stock).toEqual([])
  })

  test('ワイルドがめくれた場合(継続中のパターンが無い): コンボがリセットされ、ワイルド1枚が新しい起点になる', () => {
    const wave = makeWave({
      stock: [card(1, '★', 0, true)],
      combo: 3,
      chain: [card(2, '♣', 5)], // 実カード1枚のみ、パターン不成立
      chainOrigin: ['play'],
      linked: true,
      comboStreakColumnLengths: [4, 2],
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], 1000000, standardDeckComposition())
    expect(next.combo).toBe(0)
    expect(next.chain).toEqual([card(1, '★', 0, true)])
    expect(next.chainOrigin).toEqual(['draw'])
    expect(next.linked).toBe(false)
    expect(next.lastDrawEffect).toBeNull()
  })

  test('ワイルドがめくれた場合(継続中のパターンがある): コンボが継続し、lastDrawEffectはwild', () => {
    const wave = makeWave({
      stock: [card(1, '★', 0, true)],
      combo: 3,
      chain: [card(2, '♠', 5), card(3, '♠', 6), card(4, '♠', 7)], // 実カード3枚・同スート継続中
      chainOrigin: ['play', 'play', 'play'],
      linked: true,
      comboStreakColumnLengths: [4, 2],
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], 1000000, standardDeckComposition())
    expect(next.combo).toBe(3)
    expect(next.chain).toEqual([card(2, '♠', 5), card(3, '♠', 6), card(4, '♠', 7), card(1, '★', 0, true)])
    expect(next.chainOrigin).toEqual(['play', 'play', 'play', 'draw'])
    expect(next.linked).toBe(true)
    expect(next.lastDrawEffect).toBe('wild')
    expect(next.comboStreakColumnLengths).toEqual([4, 2])
  })

  test('パターンに合う札ならアイテム無しで特殊継続しlastDrawEffectはpattern', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 9)], // 同スート継続(捲った後で実カード3枚)
      combo: 2,
      chain: [card(2, '♠', 4), card(3, '♠', 5)],
      chainOrigin: ['play', 'play'],
      linked: true,
      comboStreakColumnLengths: [3, 2],
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], 1000000, standardDeckComposition())
    expect(next.combo).toBe(2)
    expect(next.chain).toEqual([card(2, '♠', 4), card(3, '♠', 5), card(1, '♠', 9)])
    expect(next.chainOrigin).toEqual(['play', 'play', 'draw'])
    expect(next.linked).toBe(true)
    expect(next.lastDrawEffect).toBe('pattern')
    expect(next.score).toBe(wave.score) // 得点は付かない
    expect(next.comboStreakColumnLengths).toEqual([3, 2])
  })

  test('架橋の護符所持時は、山札めくりの階段パターン継続判定にもstairRelaxedMinLenが使われる', () => {
    const wave = makeWave({
      stock: [card(1, '♦', 7)], // 階段継続: 5→6→7(長さ3)
      combo: 2,
      chain: [card(2, '♠', 5), card(3, '♣', 6)], // dir=+1, len=2
      chainOrigin: ['play', 'play'],
      linked: true,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['bridge'], 1000000, standardDeckComposition()) // stairRelaxedMinLen=3
    expect(next.combo).toBe(2)
    expect(next.lastDrawEffect).toBe('pattern')
    expect(next.chain).toEqual([card(2, '♠', 5), card(3, '♣', 6), card(1, '♦', 7)])
  })

  test('架橋の護符を持っていなければ、同じ階段(長さ3)ではdrawStockのパターン継続は成立しない(既定stairMinLen(5)未満)', () => {
    const wave = makeWave({
      stock: [card(1, '♦', 7)],
      combo: 2,
      chain: [card(2, '♠', 5), card(3, '♣', 6)],
      chainOrigin: ['play', 'play'],
      linked: true,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], 1000000, standardDeckComposition())
    expect(next.combo).toBe(0) // リセットされる
    expect(next.lastDrawEffect).toBeNull()
  })

  test('パターンに合わなければ通常通りリセットし、捲った札1枚が新しい起点になる', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)], // 同スートでも階段でもない
      combo: 2,
      chain: [card(2, '♥', 5)],
      chainOrigin: ['play'],
      linked: true,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], 1000000, standardDeckComposition())
    expect(next.combo).toBe(0)
    expect(next.chain).toEqual([card(1, '♣', 9)])
    expect(next.chainOrigin).toEqual(['draw'])
    expect(next.linked).toBe(false)
    expect(next.lastDrawEffect).toBeNull()
  })

  test('山札を引くとlastGainがクリアされる(得点は山札からは発生しないため)', () => {
    const wave = makeWave({
      stock: [card(1, '★', 0, true)],
      lastGain: { points: 100, parts: [addPart('同スート', 100)] },
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], 1000000, standardDeckComposition())
    expect(next.lastGain).toBeNull()
  })

  test('リセット時、直前のチェーンが捨て札に追加される', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      chain: [card(2, '♥', 5), card(3, '♥', 6)],
      linked: true,
      discardPile: [card(9, '♦', 1)],
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], 1000000, standardDeckComposition())
    expect(next.discardPile).toEqual([card(9, '♦', 1), card(2, '♥', 5), card(3, '♥', 6)])
  })

  test('パターン継続時は捨て札に何も追加されない', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 9)],
      chain: [card(2, '♠', 4), card(3, '♠', 5)],
      linked: true,
      discardPile: [],
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], 1000000, standardDeckComposition())
    expect(next.discardPile).toEqual([])
  })

  test('静寂: リセット時に取れる場札が無ければ、めくった札がそのウェーブ内でワイルド化し、deckComposition内の同じdeckIdのエントリだけがワイルドに変換される(ランダムではない)', () => {
    // standardDeckComposition()内で♣9はdeckId=47(♠13枚+♥13枚+♦13枚+♣内rank9で0始まり8番目)。
    // 引いた札に同じdeckId=47を明示的に持たせ、実際にそのエントリだけが変換されることを検証する。
    const wave = makeWave({
      stock: [card(1, '♣', 9, false, 47)],
      tableau: [[card(2, '♠', 2)]], // foundation想定rank9との差が大きく取れない
      chain: [card(3, '♥', 5)],
      linked: true,
    })
    const composition = standardDeckComposition()
    expect(composition[47]).toEqual({ deckId: 47, suit: '♣', rank: 9, wild: false, removed: false })
    const { wave: next, deckComposition } = drawStock(DEFAULT_PARAMS, wave, ['silence'], 1000000, composition, 'none', createRng(1))
    expect(next.foundation.wild).toBe(true)
    expect(next.chain).toEqual([{ ...card(1, '♣', 9, false, 47), wild: true }])
    const wildEntries = deckComposition.filter(c => c.wild)
    expect(wildEntries).toEqual([{ deckId: 47, suit: '♣', rank: 9, wild: true, removed: false }])
  })

  test('静寂を持っていても取れる場札があれば発動しない', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      tableau: [[card(2, '♣', 8)]], // 差1、取れる
      chain: [card(3, '♥', 5)],
      linked: true,
    })
    const composition = standardDeckComposition()
    const { wave: next, deckComposition } = drawStock(DEFAULT_PARAMS, wave, ['silence'], 1000000, composition, 'none', createRng(1))
    expect(next.foundation.wild).toBe(false)
    expect(deckComposition.filter(c => c.wild)).toHaveLength(0)
  })

  test('静寂: faceLockステージでは、リセット前のコンボ数に関わらずリセット後のcombo=0を基準に取れる場札を判定する(絵札は取れないため発動する)', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 13)], // King(絵札)、ランク差1でfaceLockが無ければ取れる
      tableau: [[card(2, '♠', 12)]], // Queen(絵札)
      chain: [card(3, '♥', 5)],
      combo: 3, // リセット前のコンボ数(この値をそのまま参照すると誤ってfaceLockを通過してしまう)
      linked: true,
    })
    const composition = standardDeckComposition()
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['silence'], 1000000, composition, 'faceLock', createRng(1))
    expect(next.foundation.wild).toBe(true)
  })

  test('沈着: リセット時に取れる場札が無ければbaseComboCountが+nされる', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      tableau: [[card(2, '♠', 2)]], // 差が大きく取れない
      chain: [card(3, '♥', 5)],
      linked: true,
      score: 100,
      baseComboCount: 0,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['composure'], 1000000, standardDeckComposition())
    expect(next.score).toBe(100)
    expect(next.baseComboCount).toBe(DEFAULT_PARAMS.talismans.composure.n)
  })

  test('冷静: リセットされるチェーンで役が一つも成立していなければbaseComboCountが+nされる', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      tableau: [[card(2, '♣', 8)]],
      chain: [card(3, '♥', 5)],
      linked: true,
      roleFiredThisChain: false,
      score: 100,
      baseComboCount: 0,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['clarity'], 1000000, standardDeckComposition())
    expect(next.baseComboCount).toBe(DEFAULT_PARAMS.talismans.clarity.n)
  })

  test('冷静: 役が成立していたチェーンのリセットでは発動しない', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      tableau: [[card(2, '♣', 8)]],
      chain: [card(3, '♥', 5)],
      linked: true,
      roleFiredThisChain: true,
      score: 100,
      baseComboCount: 0,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['clarity'], 1000000, standardDeckComposition())
    expect(next.baseComboCount).toBe(0)
  })

  test('残響: リセット時、リセット前のコンボ数×nがechoXに永続加算される', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      tableau: [[card(2, '♣', 8)]],
      chain: [card(3, '♥', 5)],
      linked: true,
      combo: 4,
      score: 100,
      echoX: 1,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['echo'], 1000000, standardDeckComposition())
    expect(next.score).toBe(100)
    expect(next.echoX).toBeCloseTo(1 + 4 * DEFAULT_PARAMS.talismans.echo.n)
  })

  test('沈着・冷静: 両方の条件が同時に成立すればbaseComboCountに両方分加算される', () => {
    const items: ItemId[] = ['composure', 'clarity']
    const wave = makeWave({
      foundation: card(0, '♠', 5),
      tableau: [[card(1, '♣', 6)]],
      stock: [card(9, '♠', 9)],
      chain: [card(0, '♠', 5)],
      linked: false,
      roleFiredThisChain: false,
      baseComboCount: 0,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, items, 1000000, standardDeckComposition(), 'none')
    expect(next.baseComboCount).toBe(DEFAULT_PARAMS.talismans.composure.n + DEFAULT_PARAMS.talismans.clarity.n)
  })

  test('沈着・冷静・残響: リセット時に3つ同時発動しても、baseComboCountとechoXがそれぞれ独立に加算される(scoreは不変)', () => {
    const items: ItemId[] = ['composure', 'clarity', 'echo']
    const wave = makeWave({
      foundation: card(0, '♠', 5),
      tableau: [[card(1, '♣', 6)]],
      stock: [card(9, '♠', 9)],
      chain: [card(0, '♠', 5)],
      linked: false,
      roleFiredThisChain: false,
      combo: 3,
      score: 100,
      baseComboCount: 2,
      echoX: 1.5,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, items, 1000000, standardDeckComposition(), 'none')
    expect(next.baseComboCount).toBe(wave.baseComboCount + DEFAULT_PARAMS.talismans.composure.n + DEFAULT_PARAMS.talismans.clarity.n)
    expect(next.echoX).toBeCloseTo(wave.echoX + wave.combo * DEFAULT_PARAMS.talismans.echo.n)
    expect(next.score).toBe(wave.score)
  })

  test('残響: 獲得点にechoXが乗算される', () => {
    const wave = makeWave({
      foundation: card(0, '♠', 5),
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      echoX: 2,
      comboFrozenThisWave: true, // コンボ倍率をかけず単純倍算のみを検証するため固定
    })
    const withoutEcho = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    const withEcho = playCard(DEFAULT_PARAMS, wave, 'none', ['echo'], 1000000, 0, standardDeckComposition())
    expect(withEcho.wave.score).toBe(withoutEcho.wave.score * 2)
  })

  test('リセット時、roleFiredThisChainがfalseに戻る', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      chain: [card(3, '♥', 5)],
      linked: true,
      roleFiredThisChain: true,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], 1000000, standardDeckComposition())
    expect(next.roleFiredThisChain).toBe(false)
  })

  test('慢心: 山札が0枚になっても、drawStockのスコアは変化しない(直接加算は廃止)', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      tableau: [[card(2, '♣', 8)], [card(4, '♦', 5)]],
      chain: [card(3, '♥', 1)],
      linked: false,
      score: 100,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['arrogance'], 1000000, standardDeckComposition())
    expect(next.stock).toHaveLength(0)
    expect(next.score).toBe(100)
  })

  test('慢心・流星・残響: 3つ同時に有効な場合、gainedは(base+shootingStarN)にechoXとarrogance.xを乗算した値になる', () => {
    const wave = makeWave({
      foundation: card(0, '♠', 5),
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      stock: [], // 慢心: 山札0枚で発動
      comboFrozenThisWave: true, // コンボ倍率をかけず単純な加算・乗算のみを検証するため固定
      echoX: 2,
      shootingStarN: 80,
    })
    const withoutItems = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    const withItems = playCard(DEFAULT_PARAMS, wave, 'none', ['arrogance', 'shootingStar', 'echo'], 1000000, 0, standardDeckComposition())
    const expectedGained = Math.floor((withoutItems.wave.score + wave.shootingStarN) * wave.echoX * DEFAULT_PARAMS.talismans.arrogance.x)
    expect(withItems.wave.score).toBe(expectedGained)
  })

  test('誠実: パターン継続(同色)でコンボが直接+nされる', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 6)], // 黒(色継続)
      chain: [card(2, '♣', 4), card(3, '♠', 5)], // 黒2枚、同色成立中
      linked: true,
      combo: 2,
      score: 100,
      drawContinueCountThisChain: 0,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['sincerity'], 1000000, standardDeckComposition())
    expect(next.linked).toBe(true)
    expect(next.score).toBe(100)
    expect(next.combo).toBe(2 + DEFAULT_PARAMS.talismans.sincerity.n)
    expect(next.drawContinueCountThisChain).toBe(1)
  })

  test('誠実: パターン継続(同スート)でも発動する(同色限定ではなくなった)', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 6)],
      chain: [card(2, '♠', 4), card(3, '♠', 5)], // 同スート成立中
      linked: true,
      combo: 2,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['sincerity'], 1000000, standardDeckComposition())
    expect(next.combo).toBe(2 + DEFAULT_PARAMS.talismans.sincerity.n)
  })

  test('誠実: パターン継続(階段、架橋併用で短い階段でも判定)でも発動する', () => {
    const wave = makeWave({
      stock: [card(1, '♦', 7)], // 階段継続: 5→6→7(長さ3)
      combo: 2,
      chain: [card(2, '♠', 5), card(3, '♣', 6)],
      chainOrigin: ['play', 'play'],
      linked: true,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['bridge', 'sincerity'], 1000000, standardDeckComposition())
    expect(next.combo).toBe(2 + DEFAULT_PARAMS.talismans.sincerity.n)
  })

  test('博愛: コンボごとに1回だけリセットを無効化し、パターン継続と同じ扱いになる', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)], // 同スートでも階段でもなく本来リセットする
      chain: [card(2, '♥', 5)],
      linked: true,
      combo: 2,
      benevolenceUsedThisCombo: false,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['benevolence'], 1000000, standardDeckComposition())
    expect(next.combo).toBe(2) // リセットされず維持
    expect(next.linked).toBe(true)
    expect(next.chain).toEqual([card(2, '♥', 5), card(1, '♣', 9)])
    expect(next.benevolenceUsedThisCombo).toBe(true)
  })

  test('誠実: 博愛による救済継続では発動しない(コンボは+nされない)', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)], // 同スートでも階段でもなく本来リセットする
      chain: [card(2, '♥', 5)],
      linked: true,
      combo: 2,
      benevolenceUsedThisCombo: false,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['benevolence', 'sincerity'], 1000000, standardDeckComposition())
    expect(next.combo).toBe(2) // 博愛による救済継続であり、誠実分は加算されない
    expect(next.linked).toBe(true)
    expect(next.benevolenceUsedThisCombo).toBe(true)
  })

  test('博愛: 既に今のコンボで使っていれば通常通りリセットされる', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      chain: [card(2, '♥', 5)],
      linked: true,
      combo: 2,
      benevolenceUsedThisCombo: true,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['benevolence'], 1000000, standardDeckComposition())
    expect(next.combo).toBe(0)
  })

  test('祝福を持っていても、コンボリセット時にwave.comboは0になる(baseComboCount自体は保持される)', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      tableau: [[card(2, '♣', 8)]],
      chain: [card(3, '♥', 5)],
      linked: true,
      baseComboCount: 4,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['sanctify'], 1000000, standardDeckComposition())
    expect(next.combo).toBe(0)
    expect(next.baseComboCount).toBe(4)
  })

  test('祝福を持たなければコンボリセット時は通常通り0になる', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      tableau: [[card(2, '♣', 8)]],
      chain: [card(3, '♥', 5)],
      linked: true,
      baseComboCount: 4,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], 1000000, standardDeckComposition())
    expect(next.combo).toBe(0)
  })

  test('ナウジズ: コンボリセット時、floor(直前コンボ/2)から再開する(baseComboCountは無関係)', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      tableau: [[card(2, '♣', 8)]],
      chain: [card(3, '♥', 5)],
      linked: true,
      combo: 7,
      baseComboCount: 1,
      nauthizActiveThisWave: true,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], 1000000, standardDeckComposition())
    expect(next.combo).toBe(3) // floor(7/2)
    expect(next.baseComboCount).toBe(1) // 変化しない
  })

  test('イサ: comboFrozenThisWave中はコンボリセットが起きても値が変わらない', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      tableau: [[card(2, '♣', 8)]],
      chain: [card(3, '♥', 5)],
      linked: true,
      combo: 7,
      comboFrozenThisWave: true,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], 1000000, standardDeckComposition())
    expect(next.combo).toBe(7)
  })

  test('イサはナウジズより優先される(両方有効でも凍結が勝つ)', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      tableau: [[card(2, '♣', 8)]],
      chain: [card(3, '♥', 5)],
      linked: true,
      combo: 7,
      baseComboCount: 1,
      comboFrozenThisWave: true,
      nauthizActiveThisWave: true,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], 1000000, standardDeckComposition())
    expect(next.combo).toBe(7)
  })

  test('イサ: comboFrozenThisWave中は素朴パスでもコンボ数が変わらない', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 9)],
      combo: 5,
      chain: [card(2, '♠', 4), card(3, '♠', 5)],
      linked: true,
      comboFrozenThisWave: true,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['naive'], 1000000, standardDeckComposition())
    expect(next.combo).toBe(5)
  })

  test('慈悲: コンボ数がc以下でリセットされるとmercyActiveNextComboがtrueになる', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      chain: [card(3, '♥', 5)],
      linked: true,
      combo: DEFAULT_PARAMS.talismans.mercy.c,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['mercy'], 1000000, standardDeckComposition())
    expect(next.mercyActiveNextCombo).toBe(true)
  })

  test('慈悲: コンボ数がcより大きい状態でリセットされるとmercyActiveNextComboはfalseになる', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      chain: [card(3, '♥', 5)],
      linked: true,
      combo: DEFAULT_PARAMS.talismans.mercy.c + 5,
      mercyActiveNextCombo: true,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['mercy'], 1000000, standardDeckComposition())
    expect(next.mercyActiveNextCombo).toBe(false)
  })

  test('誠実: 素朴を併用すると、そのめくりのgained計算にも誠実によるコンボ上昇が反映される', () => {
    const items: ItemId[] = ['naive', 'sincerity']
    const wave = makeWave({
      foundation: card(0, '♥', 3),
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      stock: [card(9, '♦', 7)],
      chain: [card(20, '♥', 3), card(21, '♦', 9), card(22, '♥', 2)],
      linked: true,
    })
    const withoutSincerity = drawStock(DEFAULT_PARAMS, wave, ['naive'], 1000000, standardDeckComposition(), 'none')
    const withSincerity = drawStock(DEFAULT_PARAMS, wave, items, 1000000, standardDeckComposition(), 'none')
    expect(withSincerity.wave.lastDrawEffect).toBe('pattern')
    expect(withSincerity.wave.combo).toBe(withoutSincerity.wave.combo + DEFAULT_PARAMS.talismans.sincerity.n)
    expect(withSincerity.wave.lastGain?.points ?? 0).toBeGreaterThan(withoutSincerity.wave.lastGain?.points ?? 0)
  })

  test('誠実: 素朴を持たなくても、パターン継続のたびコンボは押し上げられる(得点計算は発生しない)', () => {
    const wave = makeWave({
      foundation: card(0, '♥', 3),
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      stock: [card(9, '♦', 7)],
      chain: [card(20, '♥', 3), card(21, '♦', 9), card(22, '♥', 2)],
      linked: true,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['sincerity'], 1000000, standardDeckComposition(), 'none')
    expect(next.lastDrawEffect).toBe('pattern')
    expect(next.lastGain).toBeNull()
    expect(next.combo).toBe(wave.combo + DEFAULT_PARAMS.talismans.sincerity.n)
  })
})

describe('isStuck', () => {
  test('場札が残っていて山札が空、かつ取れる札が無いなら手詰まり', () => {
    const wave = makeWave({
      foundation: card(0, '♠', 5),
      stock: [],
      tableau: [[card(1, '♣', 9)]], // 差4、取れない
    })
    expect(isStuck('none', wave)).toBe(true)
  })

  test('取れる札があれば手詰まりではない', () => {
    const wave = makeWave({
      foundation: card(0, '♠', 5),
      stock: [],
      tableau: [[card(1, '♣', 6)]],
    })
    expect(isStuck('none', wave)).toBe(false)
  })

  test('山札が残っていれば手詰まりではない', () => {
    const wave = makeWave({
      foundation: card(0, '♠', 5),
      stock: [card(2, '♦', 1)],
      tableau: [[card(1, '♣', 9)]],
    })
    expect(isStuck('none', wave)).toBe(false)
  })

  test('場札が0枚なら手詰まりではない(全消し扱い)', () => {
    const wave = makeWave({ stock: [], tableau: [] })
    expect(isStuck('none', wave)).toBe(false)
  })

  test('ダガズを所持していて捨て札があれば、山札が復活できるため手詰まりではない', () => {
    const wave = makeWave({
      foundation: card(0, '♠', 5),
      stock: [],
      tableau: [[card(1, '♣', 9)]], // 差4、取れない
      discardPile: [card(2, '♦', 3)],
    })
    expect(isStuck('none', wave, ['dagaz'])).toBe(false)
  })

  test('ダガズを所持していても捨て札が無ければ手詰まりのまま', () => {
    const wave = makeWave({
      foundation: card(0, '♠', 5),
      stock: [],
      tableau: [[card(1, '♣', 9)]],
      discardPile: [],
    })
    expect(isStuck('none', wave, ['dagaz'])).toBe(true)
  })
})

describe('markStuck', () => {
  test('playing中のウェーブをended/stuckにする', () => {
    const wave = makeWave({ status: 'playing' })
    const next = markStuck(wave)
    expect(next.status).toBe('ended')
    expect(next.endReason).toBe('stuck')
  })

  test('既にendedなら変化しない', () => {
    const wave = makeWave({ status: 'ended', endReason: 'target' })
    expect(markStuck(wave)).toBe(wave)
  })
})

describe('DEFAULT_PARAMS.talismans (グループ4〜8)', () => {
  test('35個分の既定値が正しく設定されている', () => {
    expect(DEFAULT_PARAMS.talismans.calm.n).toBe(200)
    expect(DEFAULT_PARAMS.talismans.serenity.x).toBe(1.5)
    expect(DEFAULT_PARAMS.talismans.destiny.n).toBe(300)
    expect(DEFAULT_PARAMS.talismans.fate.x).toBe(2.0)
    expect(DEFAULT_PARAMS.talismans.relief.n).toBe(100)
    expect(DEFAULT_PARAMS.talismans.verdantGreen.x).toBe(3)
    expect(DEFAULT_PARAMS.talismans.gem.x).toBe(3)
    expect(DEFAULT_PARAMS.talismans.resolve.x).toBe(3)
    expect(DEFAULT_PARAMS.talismans.grail.x).toBe(3)
    expect(DEFAULT_PARAMS.talismans.moonlight.x).toBe(1.5)
    expect(DEFAULT_PARAMS.talismans.sunlight.x).toBe(1.5)
    expect(DEFAULT_PARAMS.talismans.crown.x).toBe(0.5)
    expect(DEFAULT_PARAMS.talismans.cloverLeaf.n).toBe(50)
    expect(DEFAULT_PARAMS.talismans.coin.n).toBe(50)
    expect(DEFAULT_PARAMS.talismans.blade.n).toBe(50)
    expect(DEFAULT_PARAMS.talismans.chalice.n).toBe(50)
    expect(DEFAULT_PARAMS.talismans.balance.n).toBe(200)
    expect(DEFAULT_PARAMS.talismans.harmony.x).toBe(1.5)
    expect(DEFAULT_PARAMS.talismans.nobility.n).toBe(200)
    expect(DEFAULT_PARAMS.talismans.tenacity.x).toBe(0.1)
    expect(DEFAULT_PARAMS.talismans.determination.x).toBe(0.1)
    expect(DEFAULT_PARAMS.talismans.cycle.x).toBe(3)
    expect(DEFAULT_PARAMS.talismans.reincarnation.x).toBe(10)
    expect(DEFAULT_PARAMS.talismans.majesty.x).toBe(50)
    expect(DEFAULT_PARAMS.talismans.omen.m).toBe(20)
    expect(DEFAULT_PARAMS.talismans.omen.x).toBe(1.5)
    expect(DEFAULT_PARAMS.talismans.crescent.m).toBe(10)
    expect(DEFAULT_PARAMS.talismans.crescent.x).toBe(3)
    expect(DEFAULT_PARAMS.talismans.blessing.x).toBe(1.5)
    expect(DEFAULT_PARAMS.talismans.focus.x).toBe(3)
    expect(DEFAULT_PARAMS.talismans.lapis.x).toBe(2)
    expect(DEFAULT_PARAMS.talismans.jade.n).toBe(200)
    expect(DEFAULT_PARAMS.talismans.emptyMind.x).toBe(4)
    expect(DEFAULT_PARAMS.talismans.prologue.n).toBe(500)
    expect(DEFAULT_PARAMS.talismans.interlude.m).toBe(5)
    expect(DEFAULT_PARAMS.talismans.interlude.n).toBe(1000)
    expect(DEFAULT_PARAMS.talismans.morningDew.n).toBe(5000)
    expect(DEFAULT_PARAMS.talismans.drizzle.n).toBe(50)
  })
})

describe('DEFAULT_PARAMS.talismans.resilience', () => {
  test('既定値が設定されている', () => {
    expect(DEFAULT_PARAMS.talismans.resilience.p).toBe(30)
  })
})

describe('DEFAULT_PARAMS.talismans (グループ9〜16)', () => {
  test('既定値が正しく設定されている', () => {
    expect(DEFAULT_PARAMS.talismans.gentleBreeze.n).toBe(100)
    expect(DEFAULT_PARAMS.talismans.resonance.x).toBe(0.3)
    expect(DEFAULT_PARAMS.talismans.azureSky.x).toBe(0.3)
    expect(DEFAULT_PARAMS.talismans.amber.x).toBe(0.1)
    expect(DEFAULT_PARAMS.talismans.composure.n).toBe(1)
    expect(DEFAULT_PARAMS.talismans.clarity.n).toBe(1)
    expect(DEFAULT_PARAMS.talismans.arrogance.x).toBe(1.5)
    expect(DEFAULT_PARAMS.talismans.echo.n).toBe(0.001)
    expect(DEFAULT_PARAMS.talismans.shootingStar.c).toBe(10)
    expect(DEFAULT_PARAMS.talismans.shootingStar.n).toBe(50)
    expect(DEFAULT_PARAMS.talismans.intuition.x).toBe(0.3)
    expect(DEFAULT_PARAMS.talismans.sincerity.n).toBe(1)
    expect(DEFAULT_PARAMS.talismans.darkClouds.r).toBe(1)
    expect(DEFAULT_PARAMS.talismans.regeneration.p).toBe(50)
    expect(DEFAULT_PARAMS.talismans.passion.x).toBe(1.5)
    expect(DEFAULT_PARAMS.talismans.fightingSpirit.x).toBe(1.3)
  })
})

describe('DEFAULT_PARAMS.talismans (グループ17)', () => {
  test('既定値が正しく設定されている', () => {
    expect(DEFAULT_PARAMS.talismans.protection.c).toBe(3)
    expect(DEFAULT_PARAMS.talismans.earth.c).toBe(2)
    expect(DEFAULT_PARAMS.talismans.morningStar.x).toBe(0.2)
    expect(DEFAULT_PARAMS.talismans.mercy.c).toBe(3)
    expect(DEFAULT_PARAMS.talismans.mercy.x).toBe(1.5)
    expect(DEFAULT_PARAMS.talismans.deadline.n).toBe(10)
  })
})

describe('createInitialRun / beginRun', () => {
  test('createInitialRunはtitleフェーズでwave=null、pendingNewItemはnull', () => {
    const run = createInitialRun()
    expect(run.phase).toBe('title')
    expect(run.wave).toBeNull()
    expect(run.items).toEqual([])
    expect(run.pendingNewItem).toBeNull()
  })

  test('createInitialRunのspreadIdは既定でfool', () => {
    const run = createInitialRun()
    expect(run.spreadId).toBe('fool')
  })

  test('beginRunはshopフェーズでステージ0・ウェーブ0から始まり、waveは未生成', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    expect(run.phase).toBe('shop')
    expect(run.stageIndex).toBe(0)
    expect(run.waveIndex).toBe(0)
    expect(run.wave).toBeNull()
    expect(run.shop).toBeNull()
  })

  test('beginRunはspreadIdを省略するとfoolになり、finishShop後の場札は通常の行数で配られる', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const started = finishShop(DEFAULT_PARAMS, run, 1)
    expect(run.spreadId).toBe('fool')
    expect(run.extraTableauRows).toBe(0)
    started.wave!.tableau.forEach(col => expect(col).toHaveLength(DEFAULT_PARAMS.layout.rows))
  })

  test('spreadId=moonを指定すると、finishShop後の場札は通常より1行少なく配られる', () => {
    const run = beginRun(DEFAULT_PARAMS, 1, 'moon')
    const started = finishShop(DEFAULT_PARAMS, run, 1)
    expect(run.spreadId).toBe('moon')
    expect(run.extraTableauRows).toBe(-1)
    started.wave!.tableau.forEach(col => expect(col).toHaveLength(DEFAULT_PARAMS.layout.rows - 1))
  })

  test('waveTargetはflow.stageTargetBase・stageTargetMultiplierとstageStarsの倍率を参照する', () => {
    const custom = {
      ...DEFAULT_PARAMS,
      flow: { ...DEFAULT_PARAMS.flow, stageTargetBase: 1000, stageTargetMultiplier: 2 },
    }
    const stars: Star[] = [
      { id: 's1', name: 'star1', waveSlot: 1, targetMultiplier: 1, reward: 0, restriction: null, sabotage: null, descTemplate: '' },
      { id: 's2', name: 'star2', waveSlot: 2, targetMultiplier: 1.5, reward: 0, restriction: null, sabotage: null, descTemplate: '' },
      { id: 's3', name: 'star3', waveSlot: 3, targetMultiplier: 2, reward: 0, restriction: null, sabotage: null, descTemplate: '' },
    ]
    expect(waveTarget(custom, 0, 0, stars)).toBe(1000) // 1000 × 2^0 × 1
    expect(waveTarget(custom, 0, 1, stars)).toBe(1500) // 1000 × 2^0 × 1.5
    expect(waveTarget(custom, 1, 0, stars)).toBe(2000) // 1000 × 2^1 × 1
  })

  test('beginRunのstageStarsは、waveSlot 1・2・3それぞれから1件ずつ確定した3要素配列になる', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    expect(run.stageStars).toHaveLength(3)
    expect(run.stageStars[0].waveSlot).toBe(1)
    expect(run.stageStars[1].waveSlot).toBe(2)
    expect(run.stageStars[2].waveSlot).toBe(3)
  })

  test('選出されたstar.descTemplateはparams.stars側のdescTemplateと一致する', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    for (const star of run.stageStars) {
      const sourceEntry = DEFAULT_PARAMS.stars.find(s => s.id === star.id)
      expect(sourceEntry).toBeDefined()
      expect(star.descTemplate).toBe(sourceEntry!.descTemplate)
    }
  })

  test('createInitialRunはショップ用フィールドを初期値で持つ', () => {
    const run = createInitialRun()
    expect(run.oracles).toEqual([])
    expect(run.shop).toBeNull()
    expect(run.offerPickRemaining).toBe(0)
    expect(run.riteOffer).toEqual([])
    expect(run.pendingNewRite).toBeNull()
    expect(run.pendingNewRevelation).toBeNull()
    expect(run.pendingNewOracle).toBeNull()
  })

  test('beginRunはショップ用フィールドを初期値で持つ', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    expect(run.oracles).toEqual([])
    expect(run.shop).toBeNull()
    expect(run.offerPickRemaining).toBe(0)
    expect(run.riteOffer).toEqual([])
    expect(run.pendingNewRite).toBeNull()
    expect(run.pendingNewRevelation).toBeNull()
    expect(run.pendingNewOracle).toBeNull()
  })
})

describe('トランプセット福袋の購入・選択フロー', () => {
  test('buyPackでcardSet福袋を購入すると、cardSetSelectフェーズへ遷移しcardSetOfferが確定する', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'shop', currency: 100, shop: { individual: [], packs: [{ packKind: 'cardSet', offerCount: 3, pickCount: 1, name: 'トランプセットの福袋', price: 20, sold: false }] } }
    const result = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    expect(result.phase).toBe('cardSetSelect')
    expect(result.cardSetOffer).toHaveLength(3)
    expect(result.offerPickRemaining).toBe(1)
  })

  test('buyPackでcardSet福袋を購入すると通貨が価格分減る', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'shop', currency: 100, shop: { individual: [], packs: [{ packKind: 'cardSet', offerCount: 3, pickCount: 1, name: 'トランプセットの福袋', price: 20, sold: false }] } }
    const result = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    expect(result.currency).toBe(100 - 20)
  })

  test('pickPackCardSetで選んだジャンルのカードがdeckCompositionに追加される', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'cardSetSelect', offerPickRemaining: 1, cardSetOffer: [{ genreId: 'wildCard', cards: [{ suit: '★', rank: 0, wild: true }] }] }
    const result = pickPackCardSet(run, 'wildCard')
    expect(result.deckComposition).toHaveLength(53)
    expect(result.deckComposition[52].wild).toBe(true)
  })

  test('pickPackCardSetで選択後、offerPickRemainingが0ならshopフェーズへ戻る', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'cardSetSelect', offerPickRemaining: 1, cardSetOffer: [{ genreId: 'wildCard', cards: [{ suit: '★', rank: 0, wild: true }] }] }
    const result = pickPackCardSet(run, 'wildCard')
    expect(result.phase).toBe('shop')
    expect(result.cardSetOffer).toEqual([])
  })

  test('pickPackCardSetで選択後、offerPickRemainingが残っていればcardSetSelectのまま残りオファーを保持する', () => {
    const run: RunState = {
      ...beginRun(DEFAULT_PARAMS, 1),
      phase: 'cardSetSelect',
      offerPickRemaining: 2,
      cardSetOffer: [
        { genreId: 'wildCard', cards: [{ suit: '★', rank: 0, wild: true }] },
        { genreId: 'royal', cards: [{ suit: '♠', rank: 11, wild: false }, { suit: '♠', rank: 12, wild: false }, { suit: '♠', rank: 13, wild: false }] },
      ],
    }
    const result = pickPackCardSet(run, 'wildCard')
    expect(result.phase).toBe('cardSetSelect')
    expect(result.offerPickRemaining).toBe(1)
    expect(result.cardSetOffer).toHaveLength(1)
    expect(result.cardSetOffer[0].genreId).toBe('royal')
    expect(result.deckComposition).toHaveLength(53)
  })

  test('pickPackCardSetで追加されたカードのdeckIdは既存の続きから採番される', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'cardSetSelect', offerPickRemaining: 1, cardSetOffer: [{ genreId: 'flush', cards: [{ suit: '♠', rank: 1, wild: false }, { suit: '♥', rank: 2, wild: false }, { suit: '♦', rank: 3, wild: false }, { suit: '♣', rank: 4, wild: false }] }] }
    const result = pickPackCardSet(run, 'flush')
    const addedIds = result.deckComposition.slice(52).map(c => c.deckId)
    expect(addedIds).toEqual([52, 53, 54, 55])
  })

  test('cardSetSelectフェーズ以外でpickPackCardSetを呼んでも何も起きない', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'shop' }
    const result = pickPackCardSet(run, 'wildCard')
    expect(result).toBe(run)
  })

  test('closePackCardSetSelectで残りの選択を放棄しshopフェーズへ戻る', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'cardSetSelect', offerPickRemaining: 1, cardSetOffer: [{ genreId: 'wildCard', cards: [{ suit: '★', rank: 0, wild: true }] }] }
    const result = closePackCardSetSelect(run)
    expect(result.phase).toBe('shop')
    expect(result.cardSetOffer).toEqual([])
    expect(result.offerPickRemaining).toBe(0)
    expect(result.deckComposition).toHaveLength(52)
  })
})

describe('resolveWaveEnd', () => {
  const noRewardStar: Star = { id: 'no-reward-star', name: '無報酬の星', waveSlot: 1, targetMultiplier: 1, reward: 0, restriction: null, sabotage: null, descTemplate: '' }

  function endedRun(overrides: Partial<RunState>, waveScore: number): RunState {
    const base = beginRun(DEFAULT_PARAMS, 1)
    const run = { ...base, ...overrides }
    const { wave } = startWave(DEFAULT_PARAMS, run.stageIndex, run.waveIndex, run.items, run.deckComposition, 1, run.extraTableauRows, run.oracleLevels)
    return {
      ...run,
      wave: { ...wave, score: waveScore, status: 'ended', endReason: 'target' },
    }
  }

  test('目標スコア以上でクリアした場合、ショップ画面(shop)へ遷移しバラ売り3枠・福袋2枠が確定する', () => {
    const run = endedRun({ waveIndex: 0 }, waveTarget(DEFAULT_PARAMS, 0, 0, beginRun(DEFAULT_PARAMS, 1).stageStars))
    const result = resolveWaveEnd(DEFAULT_PARAMS, run, createRng(5))
    expect(result.phase).toBe('shop')
    expect(result.shop).not.toBeNull()
    expect(result.shop!.individual).toHaveLength(3)
    expect(result.shop!.packs).toHaveLength(2)
  })

  test('ショップ突入時、次のウェーブ位置・stageStarsは確定するが、waveは直前Waveの状態のまま変更されない', () => {
    const run = endedRun({ waveIndex: 0 }, waveTarget(DEFAULT_PARAMS, 0, 0, beginRun(DEFAULT_PARAMS, 1).stageStars))
    const previousWave = run.wave
    const result = resolveWaveEnd(DEFAULT_PARAMS, run, createRng(5))
    expect(result.phase).toBe('shop')
    expect(result.waveIndex).toBe(run.waveIndex + 1)
    expect(result.wave).toBe(previousWave)
    expect(result.shop).not.toBeNull()
  })

  test('目標スコア未達の場合はgameOverへ遷移しshopはnullのまま', () => {
    const run = endedRun({}, 0)
    const result = resolveWaveEnd(DEFAULT_PARAMS, run, createRng(5))
    expect(result.phase).toBe('gameOver')
    expect(result.shop).toBeNull()
  })

  test('最終ステージのボスWaveクリア時はcontinueChoiceへ遷移しshopはnullのまま', () => {
    const finalStageIndex = DEFAULT_PARAMS.flow.stagesPerRun - 1
    const stageStars = beginRun(DEFAULT_PARAMS, 1).stageStars
    const run = endedRun(
      { waveIndex: DEFAULT_PARAMS.flow.wavesPerStage - 1, stageIndex: finalStageIndex },
      waveTarget(DEFAULT_PARAMS, finalStageIndex, DEFAULT_PARAMS.flow.wavesPerStage - 1, stageStars),
    )
    const result = resolveWaveEnd(DEFAULT_PARAMS, run, createRng(5))
    expect(result.phase).toBe('continueChoice')
    expect(result.shop).toBeNull()
  })

  test('新しいショップに入るたび、shopRerollCountは0にリセットされる', () => {
    const run = endedRun({ waveIndex: 0, shopRerollCount: 3 }, waveTarget(DEFAULT_PARAMS, 0, 0, beginRun(DEFAULT_PARAMS, 1).stageStars))
    const result = resolveWaveEnd(DEFAULT_PARAMS, run, createRng(5))
    expect(result.shopRerollCount).toBe(0)
  })

  test('beginRun直後、currencyは初期所持数になる', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    expect(run.currency).toBe(DEFAULT_PARAMS.currency.initialAmount)
  })

  test('目標未達(gameOver)ではcurrencyは増えない', () => {
    const run = endedRun({}, 0)
    const next = resolveWaveEnd(DEFAULT_PARAMS, run)
    expect(next.currency).toBe(run.currency)
  })

  test('報酬なしの星のWaveクリアではcurrencyが増えない', () => {
    const run = endedRun(
      { waveIndex: 0, stageStars: [noRewardStar, noRewardStar, noRewardStar] },
      waveTarget(DEFAULT_PARAMS, 0, 0, [noRewardStar, noRewardStar, noRewardStar]),
    )
    const next = resolveWaveEnd(DEFAULT_PARAMS, run, createRng(5))
    expect(next.currency).toBe(run.currency)
  })

  test('星にrewardが設定されていればreward分だけ増える', () => {
    const rewardStar: Star = { id: 'reward-star', name: '報酬の星', waveSlot: 3, targetMultiplier: 1, reward: 20, restriction: null, sabotage: null, descTemplate: '' }
    const stageStars = [noRewardStar, noRewardStar, rewardStar]
    const run = endedRun({ waveIndex: 2, stageStars }, waveTarget(DEFAULT_PARAMS, 0, 2, stageStars))
    const next = resolveWaveEnd(DEFAULT_PARAMS, run, createRng(5))
    expect(next.currency).toBe(run.currency + 20)
  })
})

describe('stageModifierFor / bossScoreLockFor', () => {
  function runWith(overrides: Partial<RunState>): RunState {
    return { ...beginRun(DEFAULT_PARAMS, 1), waveIndex: 2, ...overrides }
  }

  function starWith(restriction: StarRestriction): Star {
    return { id: 'test-star', name: 'テスト星', waveSlot: 3, targetMultiplier: 1, reward: 0, restriction, sabotage: null, descTemplate: '' }
  }

  test('制限ルールがnoLoopならnoLoopが返る', () => {
    const run = runWith({ stageStars: [starWith(null), starWith(null), starWith({ kind: 'noLoop' })], waveIndex: 2 })
    expect(stageModifierFor(DEFAULT_PARAMS, run)).toBe('noLoop')
  })

  test('制限ルールがfaceLockならfaceLockが返る', () => {
    const run = runWith({ stageStars: [starWith(null), starWith(null), starWith({ kind: 'faceLock' })], waveIndex: 2 })
    expect(stageModifierFor(DEFAULT_PARAMS, run)).toBe('faceLock')
  })

  test('現在Waveの星に制限ルールが無ければnoneが返る', () => {
    const run = runWith({ stageStars: [starWith(null), starWith(null), starWith({ kind: 'noLoop' })], waveIndex: 0 })
    expect(stageModifierFor(DEFAULT_PARAMS, run)).toBe('none')
  })

  test('制限ルールがlowComboならkind:comboのscoreLockが返る', () => {
    const run = runWith({ stageStars: [starWith(null), starWith(null), starWith({ kind: 'lowCombo', maxCombo: 2 })], waveIndex: 2 })
    expect(bossScoreLockFor(DEFAULT_PARAMS, run)).toEqual({ kind: 'combo', maxCombo: 2, tierLabel: 'テスト星' })
  })

  test('制限ルールがoddComboならkind:oddComboのscoreLockが返る', () => {
    const run = runWith({ stageStars: [starWith(null), starWith(null), starWith({ kind: 'oddCombo' })], waveIndex: 2 })
    expect(bossScoreLockFor(DEFAULT_PARAMS, run)).toEqual({ kind: 'oddCombo', tierLabel: 'テスト星' })
  })

  test('制限ルールがsuitならkind:suitのscoreLockが返る', () => {
    const run = runWith({ stageStars: [starWith(null), starWith(null), starWith({ kind: 'suit', suit: '♠' })], waveIndex: 2 })
    expect(bossScoreLockFor(DEFAULT_PARAMS, run)).toEqual({ kind: 'suit', suit: '♠', tierLabel: 'テスト星' })
  })

  test('制限ルールがfaceならkind:faceのscoreLockが返る', () => {
    const run = runWith({ stageStars: [starWith(null), starWith(null), starWith({ kind: 'face' })], waveIndex: 2 })
    expect(bossScoreLockFor(DEFAULT_PARAMS, run)).toEqual({ kind: 'face', tierLabel: 'テスト星' })
  })
})

describe('skipWave', () => {
  test('waveIndexが0(waveSlot 1)のとき、waveIndexが1つ進む', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'shop', waveIndex: 0 }
    const result = skipWave(DEFAULT_PARAMS, run)
    expect(result.waveIndex).toBe(1)
    expect(result.phase).toBe('shop')
  })

  test('waveIndexが1(waveSlot 2)のとき、waveIndexが1つ進む', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'shop', waveIndex: 1 }
    const result = skipWave(DEFAULT_PARAMS, run)
    expect(result.waveIndex).toBe(2)
  })

  test('waveIndexが2(waveSlot 3)のとき、何も変化しない', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'shop', waveIndex: 2 }
    const result = skipWave(DEFAULT_PARAMS, run)
    expect(result.waveIndex).toBe(2)
    expect(result).toEqual(run)
  })

  test('phaseがshop以外のとき、何も変化しない', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'playing', waveIndex: 0 }
    const result = skipWave(DEFAULT_PARAMS, run)
    expect(result).toEqual(run)
  })

  test('waveのWaveStateには影響しない(生成・変更しない)', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'shop', waveIndex: 0 }
    const result = skipWave(DEFAULT_PARAMS, run)
    expect(result.wave).toBe(run.wave)
  })
})

describe('rerollStageStars', () => {
  function shopRunAtWave3(currency: number): RunState {
    return { ...beginRun(DEFAULT_PARAMS, 1), phase: 'shop', waveIndex: 2, currency }
  }

  test('通貨がrerollCost以上のとき、通貨が減りstageStars[2]が再抽選される', () => {
    const run = shopRunAtWave3(100)
    const originalStar = run.stageStars[2]
    const result = rerollStageStars(DEFAULT_PARAMS, run, () => 0.9)
    expect(result.currency).toBe(100 - DEFAULT_PARAMS.flow.rerollCost)
    expect(result.stageStars[0]).toBe(run.stageStars[0])
    expect(result.stageStars[1]).toBe(run.stageStars[1])
    expect(result.stageStars[2]).not.toBe(originalStar)
  })

  test('通貨がrerollCost未満のとき、何も変化しない', () => {
    const run = shopRunAtWave3(DEFAULT_PARAMS.flow.rerollCost - 1)
    const result = rerollStageStars(DEFAULT_PARAMS, run, () => 0.9)
    expect(result).toEqual(run)
  })

  test('waveIndexが0(Wave1がNEXT)のときも、Wave3(stageStars[2])が再抽選される', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'shop', waveIndex: 0, currency: 100 }
    const originalStar = run.stageStars[2]
    const result = rerollStageStars(DEFAULT_PARAMS, run, () => 0.9)
    expect(result.currency).toBe(100 - DEFAULT_PARAMS.flow.rerollCost)
    expect(result.stageStars[2]).not.toBe(originalStar)
  })

  test('waveIndexが3(Wave3クリア済み)のとき、何も変化しない', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'shop', waveIndex: 3, currency: 100 }
    const result = rerollStageStars(DEFAULT_PARAMS, run, () => 0.9)
    expect(result).toEqual(run)
  })

  test('候補が複数あるwaveSlotでは、リロール後の星が直前と異なる(重複除外)', () => {
    const run = shopRunAtWave3(1000)
    let current = run
    for (let i = 0; i < 20; i++) {
      const before = current.stageStars[2]
      current = rerollStageStars(DEFAULT_PARAMS, current, () => 0.5)
      expect(current.stageStars[2]).not.toBe(before)
    }
  })

  test('phaseがshop以外のとき、何も変化しない', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'playing', waveIndex: 2, currency: 100 }
    const result = rerollStageStars(DEFAULT_PARAMS, run, () => 0.9)
    expect(result).toEqual(run)
  })
})

describe('shopRerollCost', () => {
  test('shopRerollCountが0のとき、rerollCostStepそのままの値になる', () => {
    const run = { ...beginRun(DEFAULT_PARAMS, 1), shopRerollCount: 0 }
    expect(shopRerollCost(DEFAULT_PARAMS, run)).toBe(DEFAULT_PARAMS.shop.rerollCostStep)
  })

  test('shopRerollCountが増えるたびに、rerollCostStep×(回数+1)になる', () => {
    const run = { ...beginRun(DEFAULT_PARAMS, 1), shopRerollCount: 2 }
    expect(shopRerollCost(DEFAULT_PARAMS, run)).toBe(DEFAULT_PARAMS.shop.rerollCostStep * 3)
  })
})

describe('rerollShop', () => {
  function shopRun(currency: number, shopRerollCount = 0): RunState {
    const base = shopStateAfterWaveClear()
    return { ...base, currency, shopRerollCount }
  }

  // enterShopはmodule非公開のため、resolveWaveEndを経由してshopが確定したRunStateを用意する
  function shopStateAfterWaveClear(): RunState {
    const begun = beginRun(DEFAULT_PARAMS, 1)
    const { wave } = startWave(DEFAULT_PARAMS, begun.stageIndex, begun.waveIndex, begun.items, begun.deckComposition, 1, begun.extraTableauRows, begun.oracleLevels)
    const ended: RunState = { ...begun, wave: { ...wave, score: waveTarget(DEFAULT_PARAMS, 0, 0, begun.stageStars), status: 'ended', endReason: 'target' } }
    return resolveWaveEnd(DEFAULT_PARAMS, ended, createRng(5))
  }

  test('コスト以上の通貨があるとき、通貨が減りshopが入れ替わりshopRerollCountが1増える', () => {
    const run = shopRun(100)
    const originalShop = run.shop
    const result = rerollShop(DEFAULT_PARAMS, run, () => 0.9)
    expect(result.currency).toBe(100 - DEFAULT_PARAMS.shop.rerollCostStep)
    expect(result.shop).not.toBe(originalShop)
    expect(result.shop!.individual).toHaveLength(3)
    expect(result.shop!.packs).toHaveLength(2)
    expect(result.shopRerollCount).toBe(1)
  })

  test('通貨がコスト未満のとき、何も変化しない', () => {
    const run = shopRun(DEFAULT_PARAMS.shop.rerollCostStep - 1)
    const result = rerollShop(DEFAULT_PARAMS, run, () => 0.9)
    expect(result).toEqual(run)
  })

  test('リロールを繰り返すたびにコストが増額する(1回目5、2回目10、3回目15)', () => {
    let current = shopRun(1000)
    expect(shopRerollCost(DEFAULT_PARAMS, current)).toBe(DEFAULT_PARAMS.shop.rerollCostStep)
    current = rerollShop(DEFAULT_PARAMS, current, () => 0.9)
    expect(current.currency).toBe(1000 - DEFAULT_PARAMS.shop.rerollCostStep)
    expect(shopRerollCost(DEFAULT_PARAMS, current)).toBe(DEFAULT_PARAMS.shop.rerollCostStep * 2)
    const currencyBeforeSecond = current.currency
    current = rerollShop(DEFAULT_PARAMS, current, () => 0.9)
    expect(current.currency).toBe(currencyBeforeSecond - DEFAULT_PARAMS.shop.rerollCostStep * 2)
    expect(shopRerollCost(DEFAULT_PARAMS, current)).toBe(DEFAULT_PARAMS.shop.rerollCostStep * 3)
  })

  test('phaseがshop以外のとき、何も変化しない', () => {
    const run: RunState = { ...shopRun(100), phase: 'playing' }
    const result = rerollShop(DEFAULT_PARAMS, run, () => 0.9)
    expect(result).toEqual(run)
  })

  test('shopがnull(ラン開始直後でまだ品ぞろえが確定していない状態)のとき、何も変化しない', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    expect(run.shop).toBeNull()
    const result = rerollShop(DEFAULT_PARAMS, run, () => 0.9)
    expect(result).toEqual(run)
  })
})

describe('finishShop', () => {
  test('phaseがshopのとき、waveが新規生成されplayingへ遷移する', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const shopRun = { ...run, shop: rollShop(DEFAULT_PARAMS, run, () => 0.5) }
    const result = finishShop(DEFAULT_PARAMS, shopRun, 1)
    expect(result.phase).toBe('playing')
    expect(result.wave).not.toBeNull()
    expect(result.wave!.status).toBe('playing')
    expect(result.shop).toBeNull()
  })

  test('phaseがshop以外のとき、何も変化しない', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'playing' }
    const result = finishShop(DEFAULT_PARAMS, run, 1)
    expect(result).toEqual(run)
  })

  test('waveGenerationがWave生成のたびに1ずつ増える(waveKeyの配布アニメ発火キーとして使う)', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    expect(run.waveGeneration).toBe(0)
    const shopRun = { ...run, shop: rollShop(DEFAULT_PARAMS, run, () => 0.5) }
    const started = finishShop(DEFAULT_PARAMS, shopRun, 1)
    expect(started.waveGeneration).toBe(1)
    const secondShopRun = { ...started, phase: 'shop' as const, shop: rollShop(DEFAULT_PARAMS, started, () => 0.5) }
    const startedAgain = finishShop(DEFAULT_PARAMS, secondShopRun, 2)
    expect(startedAgain.waveGeneration).toBe(2)
  })
})

describe('startRevelationPreview', () => {
  test('run.deckCompositionから場札を配ったWaveStateを生成する(本番run.waveには影響しない)', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const originalWave = run.wave
    const preview = startRevelationPreview(DEFAULT_PARAMS, run, 1)
    expect(preview.status).toBe('playing')
    expect(preview.tableau.length).toBe(DEFAULT_PARAMS.layout.cols)
    expect(run.wave).toBe(originalWave)
  })
})

describe('pickItem / continueAfterGreatMisfortune / restartRun', () => {
  test('continueAfterGreatMisfortuneはcontinueChoiceからshopへ遷移する', () => {
    const run: RunState = { ...createInitialRun(), phase: 'continueChoice', stageIndex: 2, waveIndex: 2, wave: startWave(DEFAULT_PARAMS, 2, 2, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave }
    const result = continueAfterGreatMisfortune(DEFAULT_PARAMS, run, createRng(3))
    expect(result.phase).toBe('shop')
    expect(result.shop).not.toBeNull()
  })

  test('continueChoice以外のフェーズでは何もしない', () => {
    const run = { ...createInitialRun(), phase: 'playing' as const }
    expect(continueAfterGreatMisfortune(DEFAULT_PARAMS, run, createRng(3))).toBe(run)
  })

  test('stopAfterGreatMisfortuneでallClearへ進む', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'continueChoice' }
    const next = stopAfterGreatMisfortune(run)
    expect(next.phase).toBe('allClear')
  })

  test('restartRunでステージ0・ウェーブ0・アイテムなしに戻る', () => {
    const next = restartRun(DEFAULT_PARAMS, 1)
    expect(next.phase).toBe('shop')
    expect(next.stageIndex).toBe(0)
    expect(next.waveIndex).toBe(0)
    expect(next.items).toEqual([])
  })
})

describe('buyIndividualItem(バラ売り護符購入)', () => {
  function shopRun(individual: ShopIndividualSlot[], overrides: Partial<RunState> = {}): RunState {
    return {
      ...createInitialRun(),
      phase: 'shop',
      currency: 999,
      wave: startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave,
      shop: { individual, packs: [] },
      ...overrides,
    }
  }

  test('購入すると所持に追加され通貨が減り、該当枠がsold済みになる', () => {
    const itemId = ITEM_POOL.find(id => DEFAULT_PARAMS.talismans[id].rarity === 'C')!
    const run = shopRun([{ kind: 'item', id: itemId, sold: false }])
    const price = itemBuyPrice(DEFAULT_PARAMS, run, itemId)
    const result = buyIndividualItem(DEFAULT_PARAMS, run, 0)
    expect(result.items).toEqual([itemId])
    expect(result.currency).toBe(999 - price)
    expect(result.shop!.individual[0].sold).toBe(true)
  })

  test('所持上限(maxItems)到達時は購入できない(ブロック、スワップは発生しない)', () => {
    const itemId = ITEM_POOL[0]
    const fullItems = ITEM_POOL.slice(0, DEFAULT_PARAMS.items.maxItems)
    const run = shopRun([{ kind: 'item', id: itemId, sold: false }], { items: fullItems })
    const result = buyIndividualItem(DEFAULT_PARAMS, run, 0)
    expect(result).toBe(run)
  })

  test('通貨が不足していれば購入できない', () => {
    const itemId = ITEM_POOL.find(id => DEFAULT_PARAMS.talismans[id].rarity === 'R')!
    const run = shopRun([{ kind: 'item', id: itemId, sold: false }], { currency: 0 })
    const result = buyIndividualItem(DEFAULT_PARAMS, run, 0)
    expect(result).toBe(run)
  })

  test('既にsold済みの枠は購入できない', () => {
    const itemId = ITEM_POOL[0]
    const run = shopRun([{ kind: 'item', id: itemId, sold: true }])
    const result = buyIndividualItem(DEFAULT_PARAMS, run, 0)
    expect(result).toBe(run)
  })

  test('shopフェーズ以外では何もしない', () => {
    const itemId = ITEM_POOL[0]
    const run = { ...shopRun([{ kind: 'item', id: itemId, sold: false }]), phase: 'playing' as const }
    expect(buyIndividualItem(DEFAULT_PARAMS, run, 0)).toBe(run)
  })

  test('招き布袋像所持時は所持上限(maxItems)が拡張され、通常なら上限到達の状態でも購入できる', () => {
    const fullItems = ITEM_POOL.slice(0, DEFAULT_PARAMS.items.maxItems)
    const newItemId = ITEM_POOL.find(id => !fullItems.includes(id))!
    const run = shopRun([{ kind: 'item', id: newItemId, sold: false }], {
      items: fullItems,
      relics: [{ id: 'manekiHoteizo', tsukumoka: false }],
    })
    const result = buyIndividualItem(DEFAULT_PARAMS, run, 0)
    expect(result.items).toEqual([...fullItems, newItemId])
    expect(result.shop!.individual[0].sold).toBe(true)
  })
})

describe('buyIndividualRite(バラ売り秘儀購入)', () => {
  test('購入すると所持に追加され通貨が減る', () => {
    const run: RunState = {
      ...createInitialRun(), phase: 'shop', currency: 999,
      shop: { individual: [{ kind: 'rite', id: 'jera', sold: false }], packs: [] },
    }
    const result = buyIndividualRite(DEFAULT_PARAMS, run, 0)
    expect(result.rites).toEqual(['jera'])
    expect(result.currency).toBe(999 - riteBuyPrice(DEFAULT_PARAMS, run))
    expect(result.shop!.individual[0].sold).toBe(true)
  })

  test('所持上限3到達時は購入できない', () => {
    const run: RunState = {
      ...createInitialRun(), phase: 'shop', currency: 999, rites: ['jera', 'uruz', 'ingwaz'],
      shop: { individual: [{ kind: 'rite', id: 'gebo', sold: false }], packs: [] },
    }
    expect(buyIndividualRite(DEFAULT_PARAMS, run, 0)).toBe(run)
  })
})

describe('buyRelic(レリック購入)', () => {
  test('購入すると所持に追加され通貨が減る', () => {
    const run: RunState = {
      ...createInitialRun(), phase: 'shop', currency: 999,
      shop: { individual: [], packs: [], relic: { id: 'manekiNeko', sold: false } },
    }
    const result = buyRelic(DEFAULT_PARAMS, run)
    expect(result.relics).toEqual([{ id: 'manekiNeko', tsukumoka: false }])
    expect(result.currency).toBe(999 - relicBuyPrice(DEFAULT_PARAMS, run, 'manekiNeko'))
    expect(result.shop!.relic!.sold).toBe(true)
  })

  test('レリック枠がnullなら購入できない', () => {
    const run: RunState = {
      ...createInitialRun(), phase: 'shop', currency: 999,
      shop: { individual: [], packs: [], relic: null },
    }
    expect(buyRelic(DEFAULT_PARAMS, run)).toBe(run)
  })

  test('売り切れ済みなら購入できない', () => {
    const run: RunState = {
      ...createInitialRun(), phase: 'shop', currency: 999,
      shop: { individual: [], packs: [], relic: { id: 'manekiNeko', sold: true } },
    }
    expect(buyRelic(DEFAULT_PARAMS, run)).toBe(run)
  })

  test('通貨が足りなければ購入できない', () => {
    const run: RunState = {
      ...createInitialRun(), phase: 'shop', currency: 0,
      shop: { individual: [], packs: [], relic: { id: 'manekiNeko', sold: false } },
    }
    expect(buyRelic(DEFAULT_PARAMS, run)).toBe(run)
  })
})

describe('buyIndividualRevelationUse(バラ売り天啓・即使う)', () => {
  test('購入すると即座にプレビューウェーブへ効果が適用され、所持には加わらない', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = {
      ...createInitialRun(), phase: 'shop', currency: 999, wave,
      shop: { individual: [{ kind: 'revelation', id: 'kaku', sold: false }], packs: [] },
    }
    const result = buyIndividualRevelationUse(DEFAULT_PARAMS, run, 0, null)
    expect(result.revelations).toEqual([])
    expect(result.currency).toBe(999 - revelationBuyPrice(DEFAULT_PARAMS, run))
    expect(result.shop!.individual[0].sold).toBe(true)
  })

  test('上限とは無関係に(天啓・神託合算枠が満杯でも)購入できる', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = {
      ...createInitialRun(), phase: 'shop', currency: 999, wave, revelations: ['kaku', 'kou'],
      shop: { individual: [{ kind: 'revelation', id: 'tei', sold: false }], packs: [] },
    }
    const result = buyIndividualRevelationUse(DEFAULT_PARAMS, run, 0, null)
    expect(result.shop!.individual[0].sold).toBe(true)
  })
})

describe('buyIndividualRevelationHold(バラ売り天啓・温存)', () => {
  test('購入すると所持に追加される', () => {
    const run: RunState = {
      ...createInitialRun(), phase: 'shop', currency: 999,
      shop: { individual: [{ kind: 'revelation', id: 'kaku', sold: false }], packs: [] },
    }
    const result = buyIndividualRevelationHold(DEFAULT_PARAMS, run, 0)
    expect(result.revelations).toEqual(['kaku'])
    expect(result.currency).toBe(999 - revelationBuyPrice(DEFAULT_PARAMS, run))
  })

  test('天啓・神託合算上限2到達時は購入できない(片方1個ずつで合計2でもブロック)', () => {
    const run: RunState = {
      ...createInitialRun(), phase: 'shop', currency: 999, revelations: ['kaku'], oracles: ['flush'],
      shop: { individual: [{ kind: 'revelation', id: 'kou', sold: false }], packs: [] },
    }
    expect(buyIndividualRevelationHold(DEFAULT_PARAMS, run, 0)).toBe(run)
  })
})

describe('buyIndividualOracleUse / buyIndividualOracleHold(バラ売り神託)', () => {
  test('即使うは役レベルを+1し、run/waveの両方に反映される(上限無関係)', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = {
      ...createInitialRun(), phase: 'shop', currency: 999, wave, revelations: ['kaku'], oracles: ['flush'],
      shop: { individual: [{ kind: 'oracle', id: 'flush', sold: false }], packs: [] },
    }
    const result = buyIndividualOracleUse(DEFAULT_PARAMS, run, 0)
    expect(result.oracleLevels.flush).toBe(defaultOracleLevels().flush + 1)
    expect(result.wave!.oracleLevels.flush).toBe(defaultOracleLevels().flush + 1)
    expect(result.oracles).toEqual(['flush'])
  })

  test('温存は所持に追加され、合算上限2到達時はブロックされる', () => {
    const run: RunState = {
      ...createInitialRun(), phase: 'shop', currency: 999,
      shop: { individual: [{ kind: 'oracle', id: 'flush', sold: false }], packs: [] },
    }
    const result = buyIndividualOracleHold(DEFAULT_PARAMS, run, 0)
    expect(result.oracles).toEqual(['flush'])

    const fullRun: RunState = {
      ...createInitialRun(), phase: 'shop', currency: 999, revelations: ['kaku', 'kou'],
      shop: { individual: [{ kind: 'oracle', id: 'stair', sold: false }], packs: [] },
    }
    expect(buyIndividualOracleHold(DEFAULT_PARAMS, fullRun, 0)).toBe(fullRun)
  })
})

describe('buyPack / pickPackItem(護符の福袋)', () => {
  function shopRunWithItemPack(overrides: Partial<RunState> = {}): RunState {
    return {
      ...createInitialRun(),
      phase: 'shop',
      currency: 999,
      shop: { individual: [], packs: [{ packKind: 'item', offerCount: 3, pickCount: 1, name: '護符の福袋', price: 20, sold: false }] },
      ...overrides,
    }
  }

  test('buyPackは通貨を減らし、itemSelectフェーズへ遷移してoffer件数分の候補を提示する', () => {
    const run = shopRunWithItemPack()
    const result = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    expect(result.currency).toBe(999 - 20)
    expect(result.phase).toBe('itemSelect')
    expect(result.offer).toHaveLength(3)
    expect(result.offerPickRemaining).toBe(1)
    expect(result.shop!.packs[0].sold).toBe(true)
  })

  test('通貨不足なら購入できない', () => {
    const run = shopRunWithItemPack({ currency: 0 })
    expect(buyPack(DEFAULT_PARAMS, run, 0, createRng(1))).toBe(run)
  })

  test('所持上限に達していても福袋は購入できる(上限は中身選択の確定時のみ判定)', () => {
    const run = shopRunWithItemPack({ items: ITEM_POOL.slice(0, DEFAULT_PARAMS.items.maxItems) })
    const result = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    expect(result.phase).toBe('itemSelect')
  })

  test('pickPackItemで選ぶと所持に追加され、offerPickRemainingが0ならshopへ戻る(7-2パターンでは1個選んでも閉じない)', () => {
    const run = shopRunWithItemPack()
    const opened = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    const picked = pickPackItem(DEFAULT_PARAMS, opened, opened.offer[0])
    expect(picked.items).toEqual([opened.offer[0]])
    expect(picked.phase).toBe('shop')
    expect(picked.offerPickRemaining).toBe(0)
  })

  test('所持上限到達時にpickPackItemを呼ぶとpendingNewItemにセットされ、確定しない', () => {
    const fullItems = ITEM_POOL.slice(0, DEFAULT_PARAMS.items.maxItems)
    const run = shopRunWithItemPack({ items: fullItems })
    const opened = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    const newItemId = opened.offer[0]
    const picked = pickPackItem(DEFAULT_PARAMS, opened, newItemId)
    expect(picked.pendingNewItem).toBe(newItemId)
    expect(picked.items).toEqual(fullItems)
    expect(picked.phase).toBe('itemSelect')
  })

  test('confirmPackItemSwapで入れ替えが確定し、offerPickRemainingが減る', () => {
    const fullItems = ITEM_POOL.slice(0, DEFAULT_PARAMS.items.maxItems)
    const run = shopRunWithItemPack({ items: fullItems })
    const opened = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    const newItemId = opened.offer[0]
    const picked = pickPackItem(DEFAULT_PARAMS, opened, newItemId)
    const confirmed = confirmPackItemSwap(picked, fullItems[0])
    expect(confirmed.items).toContain(newItemId)
    expect(confirmed.items).not.toContain(fullItems[0])
    expect(confirmed.items).toHaveLength(fullItems.length)
    expect(confirmed.pendingNewItem).toBeNull()
    expect(confirmed.phase).toBe('shop')
  })

  test('cancelPackItemSwapでpendingNewItemがクリアされ、所持は変化しない', () => {
    const fullItems = ITEM_POOL.slice(0, DEFAULT_PARAMS.items.maxItems)
    const run = shopRunWithItemPack({ items: fullItems })
    const opened = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    const picked = pickPackItem(DEFAULT_PARAMS, opened, opened.offer[0])
    const cancelled = cancelPackItemSwap(picked)
    expect(cancelled.pendingNewItem).toBeNull()
    expect(cancelled.items).toEqual(fullItems)
  })

  test('closePackItemSelectで残り選択を放棄してshopへ戻る', () => {
    const run = shopRunWithItemPack()
    const opened = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    const closed = closePackItemSelect(opened)
    expect(closed.phase).toBe('shop')
    expect(closed.offer).toEqual([])
    expect(closed.offerPickRemaining).toBe(0)
  })

  test('7-2パターンでは1個選んだ後もitemSelectのままで、2個目を選んでshopへ戻る', () => {
    const packRun: RunState = {
      ...createInitialRun(), phase: 'shop', currency: 999,
      shop: { individual: [], packs: [{ packKind: 'item', offerCount: 7, pickCount: 2, name: '護符の福袋', price: 50, sold: false }] },
    }
    const opened = buyPack(DEFAULT_PARAMS, packRun, 0, createRng(1))
    expect(opened.offer).toHaveLength(7)
    const firstPick = pickPackItem(DEFAULT_PARAMS, opened, opened.offer[0])
    expect(firstPick.phase).toBe('itemSelect')
    expect(firstPick.offerPickRemaining).toBe(1)
    const secondPick = pickPackItem(DEFAULT_PARAMS, firstPick, firstPick.offer[0])
    expect(secondPick.phase).toBe('shop')
    expect(secondPick.items).toHaveLength(2)
  })
})

describe('buyPack / pickPackRite(秘儀の福袋)', () => {
  function shopRunWithRitePack(overrides: Partial<RunState> = {}): RunState {
    return {
      ...createInitialRun(),
      phase: 'shop',
      currency: 999,
      shop: { individual: [], packs: [{ packKind: 'rite', offerCount: 3, pickCount: 1, name: '秘儀の福袋', price: 20, sold: false }] },
      ...overrides,
    }
  }

  test('buyPackでriteSelectへ遷移し候補が提示される', () => {
    const run = shopRunWithRitePack()
    const result = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    expect(result.phase).toBe('riteSelect')
    expect(result.riteOffer).toHaveLength(3)
    expect(result.offerPickRemaining).toBe(1)
  })

  test('pickPackRiteで選ぶと所持に追加されshopへ戻る', () => {
    const run = shopRunWithRitePack()
    const opened = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    const picked = pickPackRite(DEFAULT_PARAMS, opened, opened.riteOffer[0])
    expect(picked.rites).toEqual([opened.riteOffer[0]])
    expect(picked.phase).toBe('shop')
  })

  test('所持上限3到達時はpendingNewRiteにセットされスワップ待ちになる', () => {
    const run = shopRunWithRitePack({ rites: ['jera', 'uruz', 'ingwaz'] })
    const opened = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    const newRiteId = opened.riteOffer[0]
    const picked = pickPackRite(DEFAULT_PARAMS, opened, newRiteId)
    expect(picked.pendingNewRite).toBe(newRiteId)
    expect(picked.rites).toEqual(['jera', 'uruz', 'ingwaz'])
  })

  test('confirmPackRiteSwapで入れ替えが確定する', () => {
    const run = shopRunWithRitePack({ rites: ['jera', 'uruz', 'ingwaz'] })
    const opened = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    const newRiteId = opened.riteOffer[0]
    const picked = pickPackRite(DEFAULT_PARAMS, opened, newRiteId)
    const confirmed = confirmPackRiteSwap(picked, 'jera')
    expect(confirmed.rites).toContain(newRiteId)
    expect(confirmed.rites).not.toContain('jera')
    expect(confirmed.rites).toHaveLength(3)
    expect(confirmed.pendingNewRite).toBeNull()
  })

  test('cancelPackRiteSwapでpendingNewRiteがクリアされる', () => {
    const run = shopRunWithRitePack({ rites: ['jera', 'uruz', 'ingwaz'] })
    const opened = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    const picked = pickPackRite(DEFAULT_PARAMS, opened, opened.riteOffer[0])
    const cancelled = cancelPackRiteSwap(picked)
    expect(cancelled.pendingNewRite).toBeNull()
    expect(cancelled.rites).toEqual(['jera', 'uruz', 'ingwaz'])
  })

  test('closePackRiteSelectで残り選択を放棄してshopへ戻る', () => {
    const run = shopRunWithRitePack()
    const opened = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    const closed = closePackRiteSelect(opened)
    expect(closed.phase).toBe('shop')
    expect(closed.riteOffer).toEqual([])
  })

  test('秘儀の福袋購入では秘儀の自動抽選(rollRite)が発生しない(福袋外の護符購入等でrollRiteが呼ばれていた旧仕様の撤廃確認)', () => {
    const run = shopRunWithRitePack()
    const opened = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    const picked = pickPackRite(DEFAULT_PARAMS, opened, opened.riteOffer[0])
    expect(picked.rites).toHaveLength(1)
  })
})

describe('applyPlayCard / applyDrawStock / applyStuckCheck', () => {
  test('applyPlayCardはrun.waveを更新する', () => {
    const run = finishShop(DEFAULT_PARAMS, beginRun(DEFAULT_PARAMS, 1), 1)
    const col0 = run.wave!.tableau[0]
    const before = col0.length
    const next = applyPlayCard(DEFAULT_PARAMS, run, 0)
    expect(next.wave!.tableau[0].length).toBeLessThanOrEqual(before)
  })

  test('applyDrawStockはrun.wave.stockを減らす', () => {
    const run = finishShop(DEFAULT_PARAMS, beginRun(DEFAULT_PARAMS, 1), 1)
    const before = run.wave!.stock.length
    const next = applyDrawStock(DEFAULT_PARAMS, run)
    expect(next.wave!.stock.length).toBe(before - 1)
  })

  test('applyStuckCheckは手詰まりでなければ何もしない', () => {
    const run = finishShop(DEFAULT_PARAMS, beginRun(DEFAULT_PARAMS, 1), 1)
    const next = applyStuckCheck(DEFAULT_PARAMS, run)
    expect(next.wave!.status).toBe('playing')
  })

  test('phaseがplaying以外なら何もしない', () => {
    const run: RunState = { ...createInitialRun() }
    expect(applyPlayCard(DEFAULT_PARAMS, run, 0)).toBe(run)
    expect(applyDrawStock(DEFAULT_PARAMS, run)).toBe(run)
    expect(applyStuckCheck(DEFAULT_PARAMS, run)).toBe(run)
  })
})

describe('applyStuckCheck (不屈の護符)', () => {
  test('不屈を持ち捨て札があれば、手詰まり時にスコア消費して山札へ約半数戻し、その後山札を1枚捲って手詰まりを回避する', () => {
    const wave = makeWave({
      tableau: [[card(1, '♠', 5)]],
      stock: [],
      foundation: card(0, '♣', 1), // 差が4で取れない
      chain: [card(0, '♣', 1)],
      score: 1000,
      discardPile: [card(10, '♦', 2), card(11, '♦', 3), card(12, '♦', 4), card(13, '♦', 5)],
    })
    const run: RunState = {
      phase: 'playing', stageIndex: 0, waveIndex: 0, items: ['resilience'], offer: [],
      wave, waveGeneration: 1, pendingNewItem: null, deckComposition: standardDeckComposition(), rites: [],
      revelations: [], relics: [], revelationOffer: [], extraTableauRows: 0,
      oracleLevels: defaultOracleLevels(), oracleOffer: [], spreadId: 'fool', stageStars: [],
      currency: DEFAULT_PARAMS.currency.initialAmount,
      dedicationX: 1, diligenceX: 1, divineProtectionX: 1, discretionN: 10, frostX: 1,
      echoX: 1, shootingStarN: 50,
      oracles: [], shop: null, offerPickRemaining: 0, riteOffer: [],
      pendingNewRite: null, pendingNewRevelation: null, pendingNewOracle: null,
      cardSetOffer: [], shopRerollCount: 0,
      lastUsedRevelationId: null, recentUsedRiteIds: [],
    }
    const next = applyStuckCheck(DEFAULT_PARAMS, run, createRng(1))
    expect(next.wave!.status).toBe('playing') // 手詰まりが解消されている
    expect(next.wave!.score).toBe(700) // 1000 - 30%
    expect(next.wave!.resilienceUsedThisWave).toBe(true)
    // 4枚の半数=2枚が山札へ、そのうち1枚は自動でめくられるため最終的なstockは1枚
    expect(next.wave!.stock).toHaveLength(1)
    // 捨て札4枚のうち2枚を山札へ戻した残り2枚に、自動めくりでパターン継続せずリセットされた
    // 直前のfoundation(1枚)が捨て札へ加わり、計3枚になる
    expect(next.wave!.discardPile).toHaveLength(3)
  })

  test('不屈を持っていても捨て札が無ければ通常通り手詰まりになる', () => {
    const wave = makeWave({
      tableau: [[card(1, '♠', 5)]],
      stock: [],
      foundation: card(0, '♣', 1),
      score: 1000,
      discardPile: [],
    })
    const run: RunState = {
      phase: 'playing', stageIndex: 0, waveIndex: 0, items: ['resilience'], offer: [],
      wave, waveGeneration: 1, pendingNewItem: null, deckComposition: standardDeckComposition(), rites: [],
      revelations: [], relics: [], revelationOffer: [], extraTableauRows: 0,
      oracleLevels: defaultOracleLevels(), oracleOffer: [], spreadId: 'fool', stageStars: [],
      currency: DEFAULT_PARAMS.currency.initialAmount,
      dedicationX: 1, diligenceX: 1, divineProtectionX: 1, discretionN: 10, frostX: 1,
      echoX: 1, shootingStarN: 50,
      oracles: [], shop: null, offerPickRemaining: 0, riteOffer: [],
      pendingNewRite: null, pendingNewRevelation: null, pendingNewOracle: null,
      cardSetOffer: [], shopRerollCount: 0,
      lastUsedRevelationId: null, recentUsedRiteIds: [],
    }
    const next = applyStuckCheck(DEFAULT_PARAMS, run)
    expect(next.wave!.status).toBe('ended')
    expect(next.wave!.endReason).toBe('stuck')
  })

  test('不屈を持っていなければ捨て札があっても通常通り手詰まりになる', () => {
    const wave = makeWave({
      tableau: [[card(1, '♠', 5)]],
      stock: [],
      foundation: card(0, '♣', 1),
      score: 1000,
      discardPile: [card(10, '♦', 2), card(11, '♦', 3)],
    })
    const run: RunState = {
      phase: 'playing', stageIndex: 0, waveIndex: 0, items: [], offer: [],
      wave, waveGeneration: 1, pendingNewItem: null, deckComposition: standardDeckComposition(), rites: [],
      revelations: [], relics: [], revelationOffer: [], extraTableauRows: 0,
      oracleLevels: defaultOracleLevels(), oracleOffer: [], spreadId: 'fool', stageStars: [],
      currency: DEFAULT_PARAMS.currency.initialAmount,
      dedicationX: 1, diligenceX: 1, divineProtectionX: 1, discretionN: 10, frostX: 1,
      echoX: 1, shootingStarN: 50,
      oracles: [], shop: null, offerPickRemaining: 0, riteOffer: [],
      pendingNewRite: null, pendingNewRevelation: null, pendingNewOracle: null,
      cardSetOffer: [], shopRerollCount: 0,
      lastUsedRevelationId: null, recentUsedRiteIds: [],
    }
    const next = applyStuckCheck(DEFAULT_PARAMS, run)
    expect(next.wave!.status).toBe('ended')
    expect(next.wave!.endReason).toBe('stuck')
  })

  test('不屈: ウェーブ中2回目は発動しない(resilienceUsedThisWaveがtrueなら通常通り手詰まりになる)', () => {
    const wave = makeWave({
      tableau: [[card(1, '♠', 5)]],
      stock: [],
      foundation: card(0, '♣', 1),
      score: 1000,
      discardPile: [card(10, '♦', 2), card(11, '♦', 3)],
      resilienceUsedThisWave: true,
    })
    const run: RunState = {
      phase: 'playing', stageIndex: 0, waveIndex: 0, items: ['resilience'], offer: [],
      wave, waveGeneration: 1, pendingNewItem: null, deckComposition: standardDeckComposition(), rites: [],
      revelations: [], relics: [], revelationOffer: [], extraTableauRows: 0,
      oracleLevels: defaultOracleLevels(), oracleOffer: [], spreadId: 'fool', stageStars: [],
      currency: DEFAULT_PARAMS.currency.initialAmount,
      dedicationX: 1, diligenceX: 1, divineProtectionX: 1, discretionN: 10, frostX: 1,
      echoX: 1, shootingStarN: 50,
      oracles: [], shop: null, offerPickRemaining: 0, riteOffer: [],
      pendingNewRite: null, pendingNewRevelation: null, pendingNewOracle: null,
      cardSetOffer: [], shopRerollCount: 0,
      lastUsedRevelationId: null, recentUsedRiteIds: [],
    }
    const next = applyStuckCheck(DEFAULT_PARAMS, run)
    expect(next.wave!.status).toBe('ended')
    expect(next.wave!.endReason).toBe('stuck')
  })

  test('治癒と不屈を同時所持: 手詰まり直前に列一掃していた列も、不屈による復活と合わせて処理される', () => {
    const wave = makeWave({
      tableau: [[card(1, '♠', 5)], []],
      stock: [],
      foundation: card(0, '♣', 1),
      chain: [card(0, '♣', 1)],
      score: 1000,
      sweptColumnsThisCombo: [{ colIndex: 1, startLength: 2 }],
      discardPile: [card(10, '♦', 2), card(11, '♦', 3), card(12, '♦', 4), card(13, '♦', 5)],
    })
    const run: RunState = {
      phase: 'playing', stageIndex: 0, waveIndex: 0, items: ['healing', 'resilience'], offer: [],
      wave, waveGeneration: 1, pendingNewItem: null, deckComposition: standardDeckComposition(), rites: [],
      revelations: [], relics: [], revelationOffer: [], extraTableauRows: 0,
      oracleLevels: defaultOracleLevels(), oracleOffer: [], spreadId: 'fool', stageStars: [],
      currency: DEFAULT_PARAMS.currency.initialAmount,
      dedicationX: 1, diligenceX: 1, divineProtectionX: 1, discretionN: 10, frostX: 1,
      echoX: 1, shootingStarN: 50,
      oracles: [], shop: null, offerPickRemaining: 0, riteOffer: [],
      pendingNewRite: null, pendingNewRevelation: null, pendingNewOracle: null,
      cardSetOffer: [], shopRerollCount: 0,
      lastUsedRevelationId: null, recentUsedRiteIds: [],
    }
    const next = applyStuckCheck(DEFAULT_PARAMS, run, createRng(1))
    expect(next.wave!.tableau[1].length).toBeGreaterThan(0) // 治癒によって列1が復活している
  })

  test('治癒のみ所持(不屈なし): 手詰まり直前に列一掃していた列は復活するが、山札には戻らないため手詰まりのまま終了する', () => {
    const wave = makeWave({
      tableau: [[card(1, '♠', 5)], []],
      stock: [],
      foundation: card(0, '♣', 1),
      chain: [card(0, '♣', 1)],
      score: 1000,
      sweptColumnsThisCombo: [{ colIndex: 1, startLength: 2 }],
      discardPile: [card(10, '♦', 2), card(11, '♦', 3), card(12, '♦', 4), card(13, '♦', 5)],
    })
    const run: RunState = {
      phase: 'playing', stageIndex: 0, waveIndex: 0, items: ['healing'], offer: [],
      wave, waveGeneration: 1, pendingNewItem: null, deckComposition: standardDeckComposition(), rites: [],
      revelations: [], relics: [], revelationOffer: [], extraTableauRows: 0,
      oracleLevels: defaultOracleLevels(), oracleOffer: [], spreadId: 'fool', stageStars: [],
      currency: DEFAULT_PARAMS.currency.initialAmount,
      dedicationX: 1, diligenceX: 1, divineProtectionX: 1, discretionN: 10, frostX: 1,
      echoX: 1, shootingStarN: 50,
      oracles: [], shop: null, offerPickRemaining: 0, riteOffer: [],
      pendingNewRite: null, pendingNewRevelation: null, pendingNewOracle: null,
      cardSetOffer: [], shopRerollCount: 0,
      lastUsedRevelationId: null, recentUsedRiteIds: [],
    }
    const next = applyStuckCheck(DEFAULT_PARAMS, run, createRng(1))
    expect(next.wave!.tableau[1].length).toBeGreaterThan(0) // 治癒によって列1は復活している
    expect(next.wave!.status).toBe('ended') // しかし山札には戻っていないため手詰まりのまま終了
    expect(next.wave!.endReason).toBe('stuck')
  })
})

describe('useRite', () => {
  test('所持している秘儀を使用すると効果が適用され、所持から1個削除される', () => {
    const wave = makeWave({ combo: 2, maxComboThisWave: 2 })
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), wave, rites: ['uruz'] }
    const next = useRite(DEFAULT_PARAMS, run, 'uruz', createRng(1))
    expect(next.wave!.combo).toBe(2 + DEFAULT_PARAMS.rites.uruz.n)
    expect(next.rites).toEqual([])
  })

  test('使用した秘儀のIDがrecentUsedRiteIdsの先頭に追加される', () => {
    const wave = makeWave({ combo: 2, maxComboThisWave: 2 })
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), wave, rites: ['uruz'], recentUsedRiteIds: ['ingwaz'] }
    const next = useRite(DEFAULT_PARAMS, run, 'uruz', createRng(1))
    expect(next.recentUsedRiteIds).toEqual(['uruz', 'ingwaz'])
  })

  test('recentUsedRiteIdsは3件目以降を切り詰める(最大2件)', () => {
    const wave = makeWave({ combo: 2, maxComboThisWave: 2 })
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), wave, rites: ['uruz'], recentUsedRiteIds: ['ingwaz', 'eihwaz'] }
    const next = useRite(DEFAULT_PARAMS, run, 'uruz', createRng(1))
    expect(next.recentUsedRiteIds).toEqual(['uruz', 'ingwaz'])
  })

  test('所持していない秘儀は使用できない(何も起こらない)', () => {
    const wave = makeWave({ combo: 2 })
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), wave, rites: [] }
    const next = useRite(DEFAULT_PARAMS, run, 'uruz', createRng(1))
    expect(next).toEqual(run)
  })

  test('使用条件を満たさない秘儀(捨て札が列数未満のゲボ)は使用できない', () => {
    const wave = makeWave({ tableau: [[card(1, '♣', 5)], [card(2, '♦', 6)]], discardPile: [] })
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), wave, rites: ['gebo'] }
    const next = useRite(DEFAULT_PARAMS, run, 'gebo', createRng(1))
    expect(next.rites).toEqual(['gebo'])
  })

  test('同じ秘儀を複数所持している場合、1個だけ消費される', () => {
    const wave = makeWave({ combo: 2, maxComboThisWave: 2 })
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), wave, rites: ['uruz', 'uruz'] }
    const next = useRite(DEFAULT_PARAMS, run, 'uruz', createRng(1))
    expect(next.rites).toEqual(['uruz'])
  })

  test('shopフェーズでも使用できる(SHOP_FLOW_PHASESに含まれるため)', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'shop', wave, rites: ['jera'] }
    const result = useRite(DEFAULT_PARAMS, run, 'jera', createRng(1))
    expect(result.rites).toEqual([])
  })

  test('riteSelectフェーズでも使用できる', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'riteSelect', wave, rites: ['jera'] }
    const result = useRite(DEFAULT_PARAMS, run, 'jera', createRng(1))
    expect(result.rites).toEqual([])
  })
})

describe('reorderItems(所持護符の並べ替え)', () => {
  test('fromIndexの要素をtoIndexへ移動し、残りの要素の相対順序は保たれる', () => {
    const run: RunState = { ...createInitialRun(), items: ['bridge', 'grace', 'eternity'] }
    const result = reorderItems(run, 0, 2)
    expect(result.items).toEqual(['grace', 'eternity', 'bridge'])
  })

  test('末尾の要素を先頭へ移動できる', () => {
    const run: RunState = { ...createInitialRun(), items: ['bridge', 'grace', 'eternity'] }
    const result = reorderItems(run, 2, 0)
    expect(result.items).toEqual(['eternity', 'bridge', 'grace'])
  })

  test('fromIndexとtoIndexが同じ場合、itemsの内容は変化しない', () => {
    const run: RunState = { ...createInitialRun(), items: ['bridge', 'grace'] }
    const result = reorderItems(run, 1, 1)
    expect(result.items).toEqual(['bridge', 'grace'])
  })
})

describe('献身(dedication): フラッシュ成立ごとにdedicationXが積み上がりx倍算', () => {
  test('フラッシュ成立プレイの直後、dedicationXが0.01加算される', () => {
    // フラッシュが成立する組み合わせ(直近4枚が4スート: ♥3,♦4,♠5,♣6)
    const wave = makeWave({
      foundation: card(0, '♠', 5),
      chain: [card(20, '♥', 3), card(21, '♦', 4), card(22, '♠', 5)],
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      dedicationX: 1,
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['dedication'], 1000000, 0, standardDeckComposition())
    expect(next.dedicationX).toBeCloseTo(1 + DEFAULT_PARAMS.talismans.dedication.n)
  })

  test('献身を所持していなければdedicationXは変化しない', () => {
    const wave = makeWave({
      foundation: card(0, '♠', 5),
      chain: [card(20, '♥', 3), card(21, '♦', 4), card(22, '♠', 5)],
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      dedicationX: 1,
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(next.dedicationX).toBe(1)
  })

  test('フラッシュが成立しないプレイではdedicationXは変化しない', () => {
    const wave = makeWave({
      foundation: card(0, '♠', 5),
      chain: [card(0, '♠', 5)],
      tableau: [[card(1, '♠', 6)], [card(2, '♦', 2)]],
      dedicationX: 1,
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['dedication'], 1000000, 0, standardDeckComposition())
    expect(next.dedicationX).toBe(1)
  })
})

describe('勤勉(diligence): 同ランク成立ごとにdiligenceXが積み上がりx倍算', () => {
  test('同ランク成立プレイの直後、diligenceXが0.01加算される', () => {
    // 同ランクが成立する組み合わせ(chain内に既にrank7が1枚あり、取得カードもrank7。
    // foundationはrank6でランク差1のため取得カード♦7はisPlayableを満たす)
    const wave = makeWave({
      foundation: card(0, '♠', 6),
      chain: [card(0, '♠', 6), card(20, '♥', 7)],
      tableau: [[card(1, '♦', 7)], [card(2, '♦', 2)]],
      diligenceX: 1,
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['diligence'], 1000000, 0, standardDeckComposition())
    expect(next.diligenceX).toBeCloseTo(1 + DEFAULT_PARAMS.talismans.diligence.n)
  })

  test('勤勉を所持していなければdiligenceXは変化しない', () => {
    const wave = makeWave({
      foundation: card(0, '♠', 6),
      chain: [card(0, '♠', 6), card(20, '♥', 7)],
      tableau: [[card(1, '♦', 7)], [card(2, '♦', 2)]],
      diligenceX: 1,
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(next.diligenceX).toBe(1)
  })

  test('同ランクが成立しないプレイではdiligenceXは変化しない', () => {
    const wave = makeWave({
      foundation: card(0, '♠', 6),
      chain: [card(0, '♠', 6)],
      tableau: [[card(1, '♦', 7)], [card(2, '♦', 2)]],
      diligenceX: 1,
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['diligence'], 1000000, 0, standardDeckComposition())
    expect(next.diligenceX).toBe(1)
  })
})

describe('加護(divineProtection): ロイヤルセット成立ごとにdivineProtectionXが積み上がりx倍算', () => {
  test('ロイヤルセット成立プレイの直後、divineProtectionXが0.01加算される', () => {
    // chainにJ・Qを積み、tableauからKを取ることでロイヤルセットを成立させる。
    // foundationはA(1)にすることで取得カードK(13)とのランク差12となりisPlayableを満たす。
    const wave = makeWave({
      foundation: card(0, '♠', 1),
      chain: [card(20, '♥', 11), card(21, '♦', 12)],
      tableau: [[card(1, '♣', 13)], [card(2, '♦', 2)]],
      divineProtectionX: 1,
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['divineProtection'], 1000000, 0, standardDeckComposition())
    expect(next.divineProtectionX).toBeCloseTo(1 + DEFAULT_PARAMS.talismans.divineProtection.n)
  })

  test('加護を所持していなければdivineProtectionXは変化しない', () => {
    const wave = makeWave({
      foundation: card(0, '♠', 1),
      chain: [card(20, '♥', 11), card(21, '♦', 12)],
      tableau: [[card(1, '♣', 13)], [card(2, '♦', 2)]],
      divineProtectionX: 1,
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(next.divineProtectionX).toBe(1)
  })

  test('ロイヤルセットが成立しないプレイではdivineProtectionXは変化しない', () => {
    const wave = makeWave({
      foundation: card(0, '♠', 6),
      chain: [card(0, '♠', 6)],
      tableau: [[card(1, '♦', 7)], [card(2, '♦', 2)]],
      divineProtectionX: 1,
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['divineProtection'], 1000000, 0, standardDeckComposition())
    expect(next.divineProtectionX).toBe(1)
  })
})

describe('sellItem / sellRite / sellRevelation / sellOracle(所持品売却)', () => {
  test('sellItemは所持から削除し、売却額分だけ通貨が増える(playing/shopどちらでも可)', () => {
    const itemId = ITEM_POOL.find(id => DEFAULT_PARAMS.talismans[id].rarity === 'U')!
    const playingRun: RunState = { ...createInitialRun(), phase: 'playing', currency: 10, items: [itemId] }
    const result = sellItem(DEFAULT_PARAMS, playingRun, itemId)
    expect(result.items).toEqual([])
    expect(result.currency).toBe(10 + itemSellPrice(DEFAULT_PARAMS, playingRun, itemId))

    const shopRun: RunState = { ...createInitialRun(), phase: 'shop', currency: 10, items: [itemId] }
    expect(sellItem(DEFAULT_PARAMS, shopRun, itemId).items).toEqual([])
  })

  test('所持していないアイテムは売却できない', () => {
    const run: RunState = { ...createInitialRun(), phase: 'playing', currency: 10, items: [] }
    expect(sellItem(DEFAULT_PARAMS, run, 'bridge')).toBe(run)
  })

  test('sellRiteは所持から削除し通貨が増える', () => {
    const run: RunState = { ...createInitialRun(), phase: 'playing', currency: 10, rites: ['jera'] }
    const result = sellRite(DEFAULT_PARAMS, run, 'jera')
    expect(result.rites).toEqual([])
    expect(result.currency).toBe(10 + riteSellPrice(DEFAULT_PARAMS, run))
  })

  test('sellRevelationは所持から削除し通貨が増える', () => {
    const run: RunState = { ...createInitialRun(), phase: 'playing', currency: 10, revelations: ['kaku'] }
    const result = sellRevelation(DEFAULT_PARAMS, run, 'kaku')
    expect(result.revelations).toEqual([])
    expect(result.currency).toBe(10 + revelationSellPrice(DEFAULT_PARAMS, run))
  })

  test('sellOracleは所持から削除し通貨が増える', () => {
    const run: RunState = { ...createInitialRun(), phase: 'playing', currency: 10, oracles: ['flush'] }
    const result = sellOracle(DEFAULT_PARAMS, run, 'flush')
    expect(result.oracles).toEqual([])
    expect(result.currency).toBe(10 + oracleSellPrice(DEFAULT_PARAMS, run))
  })

  test('playing/shop以外のフェーズでは売却できない', () => {
    const run: RunState = { ...createInitialRun(), phase: 'itemSelect', currency: 10, items: ['bridge'] }
    expect(sellItem(DEFAULT_PARAMS, run, 'bridge')).toBe(run)
  })
})

describe('エイワズ(コンボリセット防止)とdrawStock/applyStuckCheckの統合', () => {
  test('シールド残り回数が1以上のとき、drawStockの通常コンボリセットが防がれチェーンが継続扱いになる', () => {
    const wave = makeWave({
      stock: [card(20, '♠', 1)],
      chain: [card(0, '♠', 5)],
      chainOrigin: ['draw'],
      linked: true,
      combo: 3,
      comboResetShieldRemaining: 1,
    })
    const result = drawStock(DEFAULT_PARAMS, wave, [], 1000000, standardDeckComposition())
    expect(result.wave.status).toBe('playing')
    expect(result.wave.combo).toBe(3)
    expect(result.wave.chain).toHaveLength(2)
    expect(result.wave.comboResetShieldRemaining).toBe(0)
  })

  test('シールド残り回数が0なら通常通りコンボリセットされる', () => {
    const wave = makeWave({
      stock: [card(20, '♠', 1)],
      chain: [card(0, '♠', 5)],
      chainOrigin: ['draw'],
      linked: true,
      combo: 3,
      comboResetShieldRemaining: 0,
    })
    const result = drawStock(DEFAULT_PARAMS, wave, [], 1000000, standardDeckComposition())
    expect(result.wave.combo).toBe(0)
    expect(result.wave.chain).toHaveLength(1)
  })

  test('手詰まり時、シールドが1以上ならコンボリセットが防がれ、カードの総数が保存される', () => {
    const wave = makeWave({
      tableau: [[card(1, '♠', 8)]], // 場札はあるが取れない(手詰まり)
      stock: [],
      foundation: card(0, '♠', 2),
      discardPile: [card(10, '♥', 4), card(11, '♦', 9)],
      chain: [card(0, '♠', 2), card(5, '♠', 3)],
      chainOrigin: ['draw', 'play'],
      combo: 4,
      comboResetShieldRemaining: 1,
      score: 1000,
    })
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'playing', items: [], wave }
    const next = applyStuckCheck(DEFAULT_PARAMS, run, createRng(1))
    const totalCards = (w: WaveState) =>
      w.tableau.reduce((n, col) => n + col.length, 0) + w.stock.length + w.chain.length + w.discardPile.length
    expect(totalCards(next.wave!)).toBe(totalCards(wave))
    expect(next.wave!.combo).toBe(4) // シールドでコンボ維持(リセットされない)
    expect(next.wave!.comboResetShieldRemaining).toBe(0) // シールド1回分消費
  })

  test('全消し時、シールドが1以上ならコンボリセットが防がれ、カードの総数が保存される', () => {
    // baseWaveはplayCackのdescribe内にスコープされ本ブロックからは参照できないため、
    // 同等のfoundation(♠5)を持つmakeWaveを直接使う。プレイする場札♣6はfoundation♠5と差1で取得可能。
    const wave = makeWave({
      foundation: card(0, '♠', 5),
      tableau: [[card(1, '♣', 6)]],
      stock: [card(20, '♠', 9)],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
      discardPile: [card(10, '♦', 1), card(11, '♦', 2)],
      combo: 4,
      comboResetShieldRemaining: 1,
    })
    const initialTotal =
      wave.tableau.reduce((n, col) => n + col.length, 0) + wave.stock.length + wave.chain.length + wave.discardPile.length
    const result = playCard(DEFAULT_PARAMS, wave, 'none', [], 100000000, 0, standardDeckComposition(), createRng(1))
    const totalCards = (w: WaveState) =>
      w.tableau.reduce((n, col) => n + col.length, 0) + w.stock.length + w.chain.length + w.discardPile.length
    expect(totalCards(result.wave)).toBe(initialTotal)
    // プレイでcombo4→5に進んだ後、全消しでもシールドによりリセットされず維持される
    expect(result.wave.combo).toBe(5)
  })
})

describe('forceStockTop', () => {
  test('山札の一番上(末尾)が指定カードに置き換わる', () => {
    const wave = makeWave({ stock: [card(1, '♠', 2), card(2, '♣', 3)] })
    const next = forceStockTop(wave, '♥', 9, false)
    expect(next.stock).toHaveLength(2)
    expect(next.stock[0]).toEqual(card(1, '♠', 2))
    expect(next.stock[1].suit).toBe('♥')
    expect(next.stock[1].rank).toBe(9)
    expect(next.stock[1].wild).toBe(false)
  })

  test('山札が空の場合は指定カード1枚だけの山札になる', () => {
    const wave = makeWave({ stock: [] })
    const next = forceStockTop(wave, '★', 0, true)
    expect(next.stock).toHaveLength(1)
    expect(next.stock[0].suit).toBe('★')
    expect(next.stock[0].wild).toBe(true)
  })

  test('stock以外のWaveStateフィールドは変化しない', () => {
    const wave = makeWave({ stock: [card(1, '♠', 2)], score: 500, combo: 3 })
    const next = forceStockTop(wave, '♦', 5, false)
    expect(next.score).toBe(500)
    expect(next.combo).toBe(3)
    expect(next.chain).toEqual(wave.chain)
  })

  test('呼び出すたびに異なるidが振られる', () => {
    const wave = makeWave({ stock: [card(1, '♠', 2)] })
    const next1 = forceStockTop(wave, '♦', 5, false)
    const next2 = forceStockTop(wave, '♦', 5, false)
    expect(next1.stock[0].id).not.toBe(next2.stock[0].id)
  })
})

describe('drawStock (素朴の得点ルール変更)', () => {
  test('素朴: パターン継続めくりが通常プレイと同じ得点計算になり、コンボ数も加算される', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 9)], // 同スート継続(捲った後で実カード3枚)
      combo: 2,
      chain: [card(2, '♠', 4), card(3, '♠', 5)],
      linked: true,
      score: 0,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['naive'], 1000000, standardDeckComposition())
    expect(next.combo).toBe(3) // 通常プレイと同様にコンボが加算される
    expect(next.score).toBeGreaterThan(0) // 得点が発生する(通常は0のまま)
  })

  test('素朴+scoreLock(kind:combo): パターン継続めくりでeffectiveComboがmaxCombo以下ならlastGainは残るが得点は0になる', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 9)],
      combo: 2, // このめくりでnewCombo=3、baseComboCount=0によりeffectiveCombo=3
      chain: [card(2, '♠', 4), card(3, '♠', 5)],
      linked: true,
      score: 0,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['naive'], 1000000, standardDeckComposition(), 'none', Math.random, { kind: 'combo', maxCombo: 3, tierLabel: 'test-tier' })
    expect(next.combo).toBe(3) // コンボ自体は通常通り進行する
    expect(next.score).toBe(0) // 得点はロックされる
    expect(next.lastGain).not.toBeNull() // メッセージは欠落しない
    expect(next.lastGain?.points).toBe(0)
    expect(next.lastGain?.parts.map(p => p.text)).toContain('test-tier: 獲得点0')
  })

  test('素朴+scoreLock(kind:combo): 惑星ロックが成立した場合、lastGain.partsは惑星ロックパーツ1件のみになる', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 9)],
      combo: 2, // このめくりでnewCombo=3、baseComboCount=0によりeffectiveCombo=3
      chain: [card(2, '♠', 4), card(3, '♠', 5)],
      linked: true,
      score: 0,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['naive'], 1000000, standardDeckComposition(), 'none', Math.random, { kind: 'combo', maxCombo: 3, tierLabel: 'test-tier' })
    expect(next.lastGain?.parts).toHaveLength(1)
    expect(next.lastGain?.parts[0]).toEqual({ label: 'test-tier: 獲得点0', kind: 'lock', amount: 0, text: 'test-tier: 獲得点0' })
  })

  test('素朴を持たない場合は、パターン継続めくりで得点もコンボ加算も発生しない(既存挙動)', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 9)],
      combo: 2,
      chain: [card(2, '♠', 4), card(3, '♠', 5)],
      linked: true,
      score: 0,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], 1000000, standardDeckComposition())
    expect(next.combo).toBe(2) // 据え置き
    expect(next.score).toBe(0)
  })

  test('素朴+直感: パターン継続めくりの得点計算に直感の倍率が適用される', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 9)],
      combo: 2,
      chain: [card(2, '♠', 4), card(3, '♠', 5)],
      linked: true,
      score: 0,
      drawContinueCountThisChain: 2,
    })
    const withoutIntuition = drawStock(DEFAULT_PARAMS, wave, ['naive'], 1000000, standardDeckComposition())
    const withIntuition = drawStock(DEFAULT_PARAMS, wave, ['naive', 'intuition'], 1000000, standardDeckComposition())
    expect(withIntuition.wave.score).toBeGreaterThan(withoutIntuition.wave.score)
  })

  test('素朴: パターン継続めくりで役が成立すると、roleFiredThisChain/flushActiveThisComboがwaveに反映される', () => {
    const wave = makeWave({
      // 階段継続(3,4,5,6 → 7で継続、stairMinLen=5を満たす)かつ、末尾4枚が4スート
      // 揃うためcheckFlushも成立する組み合わせ。
      stock: [card(5, '♠', 7)],
      combo: 4,
      chain: [card(1, '♠', 3), card(2, '♥', 4), card(3, '♦', 5), card(4, '♣', 6)],
      linked: true,
      roleFiredThisChain: false,
      flushActiveThisCombo: false,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['naive'], 1000000, standardDeckComposition())
    expect(next.roleFiredThisChain).toBe(true)
    expect(next.flushActiveThisCombo).toBe(true)
  })

  test('黄金: 素朴パスでもコンボが+2進む', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 9)],
      combo: 2,
      chain: [card(2, '♠', 4), card(3, '♠', 5)],
      linked: true,
      score: 0,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['naive', 'golden'], 1000000, standardDeckComposition())
    expect(next.combo).toBe(4)
  })

  test('マンナズ: 素朴パス(drawStockの継続得点計算)でも得点が倍算される', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 9)],
      combo: 2,
      chain: [card(2, '♠', 4), card(3, '♠', 5)],
      linked: true,
      score: 0,
      mannazActiveThisWave: true,
    })
    const items: ItemId[] = ['naive', 'bridge']
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, items, 1000000, standardDeckComposition())
    const weight: Record<'C' | 'U' | 'R', number> = { C: 1, U: 2, R: 4 }
    const weightSum = items.reduce((sum, id) => sum + weight[DEFAULT_PARAMS.talismans[id].rarity], 0)
    const mannazFactor = 1 + weightSum * DEFAULT_PARAMS.rites.mannaz.x
    const newCombo = wave.combo + 1 // golden未所持
    const comboMultiplier = 1 + newCombo * DEFAULT_PARAMS.scoring.comboMultiplierStep
    // chain[♠4,♠5]+drawn♠9で同スート継続(3枚)成立、同スートボーナスが基礎点に加算される
    const base = DEFAULT_PARAMS.scoring.basePoint + DEFAULT_PARAMS.scoring.suitBonus
    expect(next.score).toBe(wave.score + Math.floor(base * comboMultiplier * mannazFactor))
  })

  test('基礎コンボ数(baseComboCount)は素朴パスの得点計算にも常に加算される', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 9)],
      combo: 2,
      chain: [card(2, '♠', 4), card(3, '♠', 5)],
      linked: true,
      score: 0,
      baseComboCount: 5,
    })
    const { wave: withBase } = drawStock(DEFAULT_PARAMS, wave, ['naive'], 1000000, standardDeckComposition())
    const { wave: without } = drawStock(DEFAULT_PARAMS, { ...wave, baseComboCount: 0 }, ['naive'], 1000000, standardDeckComposition())
    expect(withBase.score).toBeGreaterThan(without.score)
  })

  test('庇護・大地: 素朴パスでも所持順で一時comboに適用される', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 9)],
      combo: 0,
      chain: [card(2, '♠', 4), card(3, '♠', 5)],
      linked: true,
      score: 0,
    })
    // combo=0で継続めくり: newCombo=1。大地(c=2)が先なら一時combo=3(庇護c=3未満は満たさず不発化)。
    // 庇護が先なら一時combo=3に底上げ後、大地で+2して5になり、より高スコアになるはず。
    const earthThenProtection = drawStock(DEFAULT_PARAMS, wave, ['naive', 'earth', 'protection'], 1000000, standardDeckComposition())
    const protectionThenEarth = drawStock(DEFAULT_PARAMS, wave, ['naive', 'protection', 'earth'], 1000000, standardDeckComposition())
    expect(protectionThenEarth.wave.score).toBeGreaterThan(earthThenProtection.wave.score)
  })

  test('素朴(naive)のスコアリングでも、コンボ倍率は護符のgained加算効果に最後に適用される', () => {
    // 春風(springBreeze)は♣を取ったときn点の固定加算。同スート継続(♣×3、suitColorMinLen=3)でめくり、
    // コンボ2→3(倍率1+2*step)の状態で発火させ、固定加算分にもコンボ倍率がかかっていることを
    // 確認する(先にコンボ倍率だけ適用して後から加算する旧実装ではNG)。
    // 同スート継続によりevaluateChainBonusのsuitBonus(+100)も基礎点に乗るため、
    // 期待値はbasePoint+suitBonusを基準に計算する。
    const items: ItemId[] = ['naive', 'springBreeze']
    const wave = makeWave({
      stock: [card(1, '♣', 9)], // 同スート継続(捲った後で実カード3枚、♣)
      combo: 2,
      chain: [card(2, '♣', 4), card(3, '♣', 5)],
      linked: true,
      score: 0,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, items, 1000000, standardDeckComposition())
    expect(next.combo).toBe(3)
    const multiplier = 1 + 3 * DEFAULT_PARAMS.scoring.comboMultiplierStep
    const base = DEFAULT_PARAMS.scoring.basePoint + DEFAULT_PARAMS.scoring.suitBonus
    const expectedGained = Math.floor((base + DEFAULT_PARAMS.talismans.springBreeze.n) * multiplier)
    expect(next.lastGain?.points).toBe(expectedGained)
  })

  test('序章は山札めくり(素朴)の獲得点計算では発動しない(isPlayActionガード)', () => {
    // combo:0にすることで、naive分岐が見るnaiveCtx.combo(=effectiveCombo=newCombo)が
    // ちょうど1になる状況を作る。これは旧実装(ctx.combo===1で発動)なら誤って発動して
    // しまう値である。また、chainOriginを['play', 'draw']にすることでplayCountInChain
    // (=wave.chainOriginのうち'play'の数)もちょうど1にしている。つまりこの状況は
    // 「プレイなら序章の発動条件をどちらの基準で見ても満たす」状況だが、実際には
    // 山札めくり(素朴)でありisPlayAction===falseであるため、そのガードにより
    // 発動しないことを確認する。
    const items: ItemId[] = ['prologue', 'naive']
    const wave = makeWave({
      stock: [card(1, '♠', 9)], // 同スート継続(捲った後で実カード3枚)
      combo: 0,
      chain: [card(2, '♠', 4), card(3, '♠', 5)],
      chainOrigin: ['play', 'draw'],
      linked: true,
      score: 0,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, items, 1000000, standardDeckComposition())
    expect(next.lastDrawEffect).toBe('pattern')
    expect(next.lastGain?.parts.some(p => p.text.startsWith('序章'))).toBe(false)
  })

  test('幕間は山札めくり(素朴)の獲得点計算では発動しない(isPlayActionガード)', () => {
    // chainOriginに'play'をm個並べておくことで、naive分岐が見るnaiveCtx.playCountInChain
    // (=wave.chainOriginのうち'play'の数、素朴では+1されない)がちょうどmになる状況を作る。
    // これは新実装の判定式(ctx.isPlayAction && ctx.playCountInChain === m)のうち、
    // playCountInChain === mの側だけを見れば誤って発動してしまう境界値である。
    // 実際には山札めくり(素朴)でありisPlayAction===falseであるため、
    // isPlayActionガードのみがここでの不発火を防いでいることを確認する
    // (ガードを外すとこのテストはFAILすることを確認済み)。
    const m = DEFAULT_PARAMS.talismans.interlude.m
    const items: ItemId[] = ['interlude', 'naive']
    const wave = makeWave({
      stock: [card(1, '♠', 9)], // 同スート継続(捲った後で実カード3枚)
      combo: 0,
      chain: [card(2, '♠', 4), card(3, '♠', 5)],
      chainOrigin: [...Array(m).fill('play' as const), 'draw'],
      linked: true,
      score: 0,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, items, 1000000, standardDeckComposition())
    expect(next.lastDrawEffect).toBe('pattern')
    expect(next.lastGain?.parts.some(p => p.text.startsWith('幕間'))).toBe(false)
  })
})

describe('約束・暗雲', () => {
  test('約束: startWaveの山札構築後、継続可能なカードが山札の次(末尾)に来る', () => {
    // 継続条件を満たすカードが山札のどこかにあれば、末尾(次にめくられる位置)に来ることを、
    // 複数シードで試して「並べ替えありのほうが継続確率が実際に上がる」ことを確認する簡易テスト。
    //
    // 注: DEFAULT_PARAMSのままだとsuitColorMinLen=3・stairMinLen=5であり、ウェーブ開始直後の
    // chainは[foundation]のみ(長さ1)なので、そこにどんなカードを1枚足しても長さ2にしかならず、
    // chainContinuesPatternの条件(長さ3以上/5以上)を構造上絶対に満たせない(常にcontinueCount=0になる)。
    // これは約束の実装不備ではなく、「継続」概念そのものがウェーブ開始直後には成立し得ないため。
    // そのためこのテストではsuitColorMinLenを2に緩めたパラメータを使い、
    // 「継続可能なカードが山札にあれば末尾に来る」という約束の実装意図そのものを検証する。
    // 単に発生回数を数えるだけでは、並べ替えロジックをno-opにすり替えても偶然
    // (末尾のカードがたまたま継続可能)パスしてしまう可能性がある。そのため各シードごとに
    // 「山札全体に継続可能なカードが1枚でもあれば、末尾のカードも継続可能である」という
    // 含意そのものを検証する(no-opだと、この含意が偽になるシードが高確率で出現するはず)。
    const relaxedParams = {
      ...DEFAULT_PARAMS,
      scoring: { ...DEFAULT_PARAMS.scoring, suitColorMinLen: 2 },
    }
    let anyContinuesCount = 0
    const trials = 30
    for (let seed = 1; seed <= trials; seed++) {
      const { wave } = startWave(relaxedParams, 0, 0, ['promise'], standardDeckComposition(), seed)
      if (wave.stock.length === 0) continue
      const nextCard = wave.stock[wave.stock.length - 1]
      const anyContinues = wave.stock.some(c => chainContinuesPattern(relaxedParams.scoring, wave.chain, c))
      if (anyContinues) {
        anyContinuesCount++
        expect(chainContinuesPattern(relaxedParams.scoring, wave.chain, nextCard)).toBe(true)
      }
    }
    expect(anyContinuesCount).toBeGreaterThan(0)
  })

  test('約束: drawStockの後、末尾ではない位置にあった継続可能なカードが末尾に並べ替えられる', () => {
    const wave = makeWave({
      // card(3,♣,2)を引いた後のchainは黒3枚継続中になる。継続可能なcard(2,♠,6)は
      // 末尾ではない位置にあり、並べ替え無しなら継続不可のcard(1,♦,1)が末尾に残る。
      stock: [card(2, '♠', 6), card(1, '♦', 1), card(3, '♣', 2)],
      chain: [card(9, '♠', 4), card(10, '♠', 5)], // 黒2枚継続中
      linked: true,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['promise'], 1000000, standardDeckComposition())
    expect(next.stock[next.stock.length - 1]).toEqual(card(2, '♠', 6))
  })

  test('約束を持たなければ山札の並び順は変わらない(既存挙動)', () => {
    const wave = makeWave({
      stock: [card(2, '♠', 6), card(1, '♦', 1), card(3, '♣', 2)],
      chain: [card(9, '♠', 4), card(10, '♠', 5)],
      linked: true,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], 1000000, standardDeckComposition())
    expect(next.stock).toEqual([card(2, '♠', 6), card(1, '♦', 1)])
  })

  test('暗雲: ウェーブ開始時、場札がrows+r枚配られる', () => {
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, ['darkClouds'], standardDeckComposition(), 1)
    const expectedRows = DEFAULT_PARAMS.layout.rows + DEFAULT_PARAMS.talismans.darkClouds.r
    wave.tableau.forEach(col => expect(col).toHaveLength(expectedRows))
  })

  test('暗雲を持たなければ通常通りrows枚', () => {
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1)
    wave.tableau.forEach(col => expect(col).toHaveLength(DEFAULT_PARAMS.layout.rows))
  })
})

describe('天啓の福袋(revelationSelect)', () => {
  function shopRunWithRevelationPack(overrides: Partial<RunState> = {}): RunState {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    return {
      ...createInitialRun(),
      phase: 'shop',
      currency: 999,
      wave,
      shop: { individual: [], packs: [{ packKind: 'revelation', offerCount: 3, pickCount: 1, name: '天啓の福袋', price: 25, sold: false }] },
      ...overrides,
    }
  }

  test('buyPackでrevelationSelectへ遷移し候補が提示される', () => {
    const run = shopRunWithRevelationPack()
    const result = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    expect(result.phase).toBe('revelationSelect')
    expect(result.revelationOffer).toHaveLength(3)
  })

  test('pickPackRevelationUseで即使うと、プレビューウェーブに効果が適用され所持には加わらない', () => {
    const run = shopRunWithRevelationPack()
    const opened = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    const target = opened.revelationOffer.includes('kaku') ? 'kaku' : opened.revelationOffer[0]
    const result = pickPackRevelationUse(DEFAULT_PARAMS, opened, target, null, createRng(2))
    expect(result.revelations).toEqual([])
    expect(result.phase).toBe('shop')
  })

  test('pickPackRevelationHoldで温存すると所持に追加される', () => {
    const run = shopRunWithRevelationPack()
    const opened = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    const result = pickPackRevelationHold(DEFAULT_PARAMS, opened, opened.revelationOffer[0])
    expect(result.revelations).toEqual([opened.revelationOffer[0]])
    expect(result.phase).toBe('shop')
  })

  test('温存時、天啓・神託合算上限2到達時はpendingNewRevelationにセットされスワップ待ちになる', () => {
    const run = shopRunWithRevelationPack({ revelations: ['kaku'], oracles: ['flush'] })
    const opened = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    const target = opened.revelationOffer[0]
    const result = pickPackRevelationHold(DEFAULT_PARAMS, opened, target)
    expect(result.pendingNewRevelation).toBe(target)
    expect(result.revelations).toEqual(['kaku'])
  })

  test('confirmPackRevelationSwapで所持中の天啓と入れ替えできる', () => {
    const run = shopRunWithRevelationPack({ revelations: ['kaku'], oracles: ['flush'] })
    const opened = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    const target = opened.revelationOffer[0]
    const picked = pickPackRevelationHold(DEFAULT_PARAMS, opened, target)
    const confirmed = confirmPackRevelationSwap(picked, { kind: 'revelation', id: 'kaku' })
    expect(confirmed.revelations).toEqual([target])
    expect(confirmed.oracles).toEqual(['flush'])
    expect(confirmed.pendingNewRevelation).toBeNull()
  })

  test('confirmPackRevelationSwapで所持中の神託と入れ替えできる(合算枠のため神託側も対象になる)', () => {
    const run = shopRunWithRevelationPack({ revelations: ['kaku'], oracles: ['flush'] })
    const opened = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    const target = opened.revelationOffer[0]
    const picked = pickPackRevelationHold(DEFAULT_PARAMS, opened, target)
    const confirmed = confirmPackRevelationSwap(picked, { kind: 'oracle', id: 'flush' })
    expect(confirmed.revelations).toEqual(['kaku', target])
    expect(confirmed.oracles).toEqual([])
  })

  test('cancelPackRevelationSwapでpendingNewRevelationがクリアされる', () => {
    const run = shopRunWithRevelationPack({ revelations: ['kaku'], oracles: ['flush'] })
    const opened = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    const picked = pickPackRevelationHold(DEFAULT_PARAMS, opened, opened.revelationOffer[0])
    const cancelled = cancelPackRevelationSwap(picked)
    expect(cancelled.pendingNewRevelation).toBeNull()
  })

  test('closePackRevelationSelectで残り選択を放棄してshopへ戻る', () => {
    const run = shopRunWithRevelationPack()
    const opened = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    const closed = closePackRevelationSelect(opened)
    expect(closed.phase).toBe('shop')
    expect(closed.revelationOffer).toEqual([])
  })
})

describe('useRevelation(所持天啓の使用、playing/shopフロー両対応)', () => {
  test('playingフェーズで使用でき、所持から1個減る', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, revelations: ['kaku'] }
    const result = useRevelation(DEFAULT_PARAMS, run, 'kaku', null, createRng(1))
    expect(result.revelations).toEqual([])
  })

  test('shopフェーズでも使用できる(SHOP_FLOW_PHASESに含まれるため)', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'shop', wave, revelations: ['kaku'] }
    const result = useRevelation(DEFAULT_PARAMS, run, 'kaku', null, createRng(1))
    expect(result.revelations).toEqual([])
  })

  test('使用した天啓のIDがlastUsedRevelationIdに記録される', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, revelations: ['kaku'] }
    const result = useRevelation(DEFAULT_PARAMS, run, 'kaku', null, createRng(1))
    expect(result.lastUsedRevelationId).toBe('kaku')
  })
})

describe('useRevelation: 昴(subaru・護符獲得)', () => {
  test('護符を1つランダムに獲得し、所持中の護符は選ばれない', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, revelations: ['subaru'], items: ['discretion', 'frost'] }
    const result = useRevelation(DEFAULT_PARAMS, run, 'subaru', null, createRng(1))
    expect(result.items).toHaveLength(3)
    expect(result.items.slice(0, 2)).toEqual(['discretion', 'frost'])
    expect(result.items[2]).not.toBe('discretion')
    expect(result.items[2]).not.toBe('frost')
  })

  test('護符の所持上限に達していれば何も獲得しない', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const fiveItems: ItemId[] = ITEM_POOL.slice(0, DEFAULT_PARAMS.items.maxItems)
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, revelations: ['subaru'], items: fiveItems }
    const result = useRevelation(DEFAULT_PARAMS, run, 'subaru', null, createRng(1))
    expect(result.items).toEqual(fiveItems)
  })
})

describe('useRevelation: 柳(ryuu・星片倍化)', () => {
  test('所持している星片が倍になる', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, revelations: ['ryuu'], currency: 30 }
    const result = useRevelation(DEFAULT_PARAMS, run, 'ryuu', null, createRng(1))
    expect(result.currency).toBe(60)
  })

  test('星片が0の場合は0のまま', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, revelations: ['ryuu'], currency: 0 }
    const result = useRevelation(DEFAULT_PARAMS, run, 'ryuu', null, createRng(1))
    expect(result.currency).toBe(0)
  })
})

describe('useRevelation: 星(hotori・天啓回帰)', () => {
  test('直前に使用した天啓を1つ獲得する', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, revelations: ['hotori'], lastUsedRevelationId: 'kaku' }
    const result = useRevelation(DEFAULT_PARAMS, run, 'hotori', null, createRng(1))
    expect(result.revelations).toEqual(['kaku'])
  })

  test('使用履歴が無ければ何も獲得しない', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, revelations: ['hotori'], lastUsedRevelationId: null }
    const result = useRevelation(DEFAULT_PARAMS, run, 'hotori', null, createRng(1))
    expect(result.revelations).toEqual([])
  })

  test('hotori自身を使用してもlastUsedRevelationIdは更新されない(履歴に残らない)', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, revelations: ['hotori'], lastUsedRevelationId: 'kaku' }
    const result = useRevelation(DEFAULT_PARAMS, run, 'hotori', null, createRng(1))
    expect(result.lastUsedRevelationId).toBe('kaku')
  })

  test('hotoriを連続で使用しても自己参照しない', () => {
    // このテストが守っている不変条件: useRevelationの自己参照除外(lastUsedRevelationIdの
    // 更新スキップ)が無ければ、1回目の使用でlastUsedRevelationIdが'hotori'になり、
    // 2回目の使用がその'hotori'自身を再取得してしまう(無限に自己複製し続ける)。
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, revelations: ['hotori', 'hotori'], lastUsedRevelationId: 'kaku' }
    const first = useRevelation(DEFAULT_PARAMS, run, 'hotori', null, createRng(1))
    expect(first.lastUsedRevelationId).toBe('kaku')
    expect(first.revelations).toEqual(['hotori', 'kaku'])
    const second = useRevelation(DEFAULT_PARAMS, first, 'hotori', null, createRng(1))
    expect(second.revelations).toEqual(['kaku', 'kaku'])
  })

  test('合算上限2到達時は通常なら獲得できないが、千羽鶴所持時は枠が拡張され獲得できる', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const baseRun: RunState = { ...createInitialRun(), phase: 'playing', wave, revelations: ['hotori'], oracles: ['flush', 'stair'], lastUsedRevelationId: 'kaku' }
    const blocked = useRevelation(DEFAULT_PARAMS, baseRun, 'hotori', null, createRng(1))
    expect(blocked.revelations).toEqual([])

    const runWithRelic: RunState = { ...baseRun, relics: [{ id: 'senbazuru', tsukumoka: false }] }
    const extended = useRevelation(DEFAULT_PARAMS, runWithRelic, 'hotori', null, createRng(1))
    expect(extended.revelations).toEqual(['kaku'])
  })
})

describe('useRevelation: 張(chou・神託獲得)', () => {
  test('他に天啓・神託を所持していなければ神託を2つ獲得する', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, revelations: ['chou'] }
    const result = useRevelation(DEFAULT_PARAMS, run, 'chou', null, createRng(1))
    expect(result.oracles).toHaveLength(2)
    expect(new Set(result.oracles).size).toBe(2)
  })

  test('他に天啓・神託を1つ所持していれば神託を1つだけ獲得する(合算上限2)', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, revelations: ['chou'], oracles: ['flush'] }
    const result = useRevelation(DEFAULT_PARAMS, run, 'chou', null, createRng(1))
    expect(result.oracles).toHaveLength(2)
    expect(result.oracles[0]).toBe('flush')
  })

  test('千羽鶴所持時は合算上限が拡張され、通常なら1つしか獲得できない状況でも2つ獲得できる', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = {
      ...createInitialRun(),
      phase: 'playing',
      wave,
      revelations: ['chou'],
      oracles: ['flush'],
      relics: [{ id: 'senbazuru', tsukumoka: false }],
    }
    const result = useRevelation(DEFAULT_PARAMS, run, 'chou', null, createRng(1))
    expect(result.oracles).toHaveLength(3)
    expect(result.oracles[0]).toBe('flush')
  })
})

describe('useRevelation: 翼(yoku・天啓連続獲得)', () => {
  test('他に天啓・神託を所持していなければ天啓を2つ獲得する', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, revelations: ['yoku'] }
    const result = useRevelation(DEFAULT_PARAMS, run, 'yoku', null, createRng(1))
    expect(result.revelations).toHaveLength(2)
  })

  test('他に天啓・神託を1つ所持していれば天啓を1つだけ獲得する(合算上限2)', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, revelations: ['yoku'], oracles: ['flush'] }
    const result = useRevelation(DEFAULT_PARAMS, run, 'yoku', null, createRng(1))
    expect(result.revelations).toHaveLength(1)
    expect(result.oracles).toEqual(['flush'])
  })

  test('千羽鶴所持時は合算上限が拡張され、通常なら1つしか獲得できない状況でも2つ獲得できる', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = {
      ...createInitialRun(),
      phase: 'playing',
      wave,
      revelations: ['yoku'],
      oracles: ['flush'],
      relics: [{ id: 'senbazuru', tsukumoka: false }],
    }
    const result = useRevelation(DEFAULT_PARAMS, run, 'yoku', null, createRng(1))
    expect(result.revelations).toHaveLength(2)
    expect(result.oracles).toEqual(['flush'])
  })
})

describe('useRevelation: 軫(mitsu・護符換金)', () => {
  test('所持護符の売値合計が星片に加算される', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, revelations: ['mitsu'], items: ['discretion', 'frost'], currency: 10 }
    const expectedTotal = itemSellPrice(DEFAULT_PARAMS, run, 'discretion') + itemSellPrice(DEFAULT_PARAMS, run, 'frost')
    const result = useRevelation(DEFAULT_PARAMS, run, 'mitsu', null, createRng(1))
    expect(result.currency).toBe(10 + expectedTotal)
    expect(result.items).toEqual(['discretion', 'frost']) // 護符は消費されない(換金であり売却ではない)
  })

  test('護符を所持していなければ星片は変化しない', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, revelations: ['mitsu'], items: [], currency: 10 }
    const result = useRevelation(DEFAULT_PARAMS, run, 'mitsu', null, createRng(1))
    expect(result.currency).toBe(10)
  })
})

describe('useRevelation: 参(karasu・秘儀回帰)', () => {
  test('直近に使用した秘儀を最大2つ獲得する', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, revelations: ['karasu'], recentUsedRiteIds: ['uruz', 'ingwaz'] }
    const result = useRevelation(DEFAULT_PARAMS, run, 'karasu', null, createRng(1))
    expect(result.rites).toEqual(['uruz', 'ingwaz'])
  })

  test('秘儀の所持上限(3)を超える分は獲得しない', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, revelations: ['karasu'], rites: ['eihwaz', 'jera'], recentUsedRiteIds: ['uruz', 'ingwaz'] }
    const result = useRevelation(DEFAULT_PARAMS, run, 'karasu', null, createRng(1))
    expect(result.rites).toEqual(['eihwaz', 'jera', 'uruz'])
  })

  test('使用履歴が無ければ何も獲得しない', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, revelations: ['karasu'], recentUsedRiteIds: [] }
    const result = useRevelation(DEFAULT_PARAMS, run, 'karasu', null, createRng(1))
    expect(result.rites).toEqual([])
  })

  test('破魔矢所持時は秘儀の所持上限が拡張され、通常なら上限超過で切り捨てられる分も獲得できる', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = {
      ...createInitialRun(),
      phase: 'playing',
      wave,
      revelations: ['karasu'],
      rites: ['eihwaz', 'jera'],
      recentUsedRiteIds: ['uruz', 'ingwaz'],
      relics: [{ id: 'hamaya', tsukumoka: false }],
    }
    const result = useRevelation(DEFAULT_PARAMS, run, 'karasu', null, createRng(1))
    expect(result.rites).toEqual(['eihwaz', 'jera', 'uruz', 'ingwaz'])
  })
})

describe('神託の福袋(oracleSelect)', () => {
  function shopRunWithOraclePack(overrides: Partial<RunState> = {}): RunState {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    return {
      ...createInitialRun(),
      phase: 'shop',
      currency: 999,
      wave,
      shop: { individual: [], packs: [{ packKind: 'oracle', offerCount: 3, pickCount: 1, name: '神託の福袋', price: 22, sold: false }] },
      ...overrides,
    }
  }

  test('buyPackでoracleSelectへ遷移し候補が提示される', () => {
    const run = shopRunWithOraclePack()
    const result = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    expect(result.phase).toBe('oracleSelect')
    expect(result.oracleOffer).toHaveLength(3)
  })

  test('pickPackOracleUseで即使うと役レベルが+1され、run/wave両方に反映される', () => {
    const run = shopRunWithOraclePack()
    const opened = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    const role = opened.oracleOffer[0]
    const before = opened.oracleLevels[role]
    const result = pickPackOracleUse(opened, role)
    expect(result.oracleLevels[role]).toBe(before + 1)
    expect(result.wave!.oracleLevels[role]).toBe(before + 1)
    expect(result.oracles).toEqual([])
    expect(result.phase).toBe('shop')
  })

  test('pickPackOracleHoldで温存すると所持に追加される', () => {
    const run = shopRunWithOraclePack()
    const opened = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    const role = opened.oracleOffer[0]
    const result = pickPackOracleHold(DEFAULT_PARAMS, opened, role)
    expect(result.oracles).toEqual([role])
  })

  test('温存時、天啓・神託合算上限2到達時はpendingNewOracleにセットされスワップ待ちになる', () => {
    const run = shopRunWithOraclePack({ revelations: ['kaku'], oracles: ['flush'] })
    const opened = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    const role = opened.oracleOffer.includes('stair') ? 'stair' : opened.oracleOffer[0]
    const result = pickPackOracleHold(DEFAULT_PARAMS, opened, role)
    expect(result.pendingNewOracle).toBe(role)
  })

  test('confirmPackOracleSwapで所持中の天啓と入れ替えできる(合算枠のため天啓側も対象になる)', () => {
    const run = shopRunWithOraclePack({ revelations: ['kaku'], oracles: ['flush'] })
    const opened = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    const role = opened.oracleOffer[0]
    const picked = pickPackOracleHold(DEFAULT_PARAMS, opened, role)
    const confirmed = confirmPackOracleSwap(picked, { kind: 'revelation', id: 'kaku' })
    expect(confirmed.oracles).toEqual(['flush', role])
    expect(confirmed.revelations).toEqual([])
    expect(confirmed.pendingNewOracle).toBeNull()
  })

  test('confirmPackOracleSwapで所持中の神託と入れ替えできる', () => {
    const run = shopRunWithOraclePack({ revelations: ['kaku'], oracles: ['flush'] })
    const opened = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    const role = opened.oracleOffer[0]
    const picked = pickPackOracleHold(DEFAULT_PARAMS, opened, role)
    const confirmed = confirmPackOracleSwap(picked, { kind: 'oracle', id: 'flush' })
    expect(confirmed.oracles).toEqual([role])
    expect(confirmed.revelations).toEqual(['kaku'])
    expect(confirmed.pendingNewOracle).toBeNull()
  })

  test('cancelPackOracleSwapでpendingNewOracleがクリアされる', () => {
    const run = shopRunWithOraclePack({ revelations: ['kaku'], oracles: ['flush'] })
    const opened = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    const picked = pickPackOracleHold(DEFAULT_PARAMS, opened, opened.oracleOffer[0])
    const cancelled = cancelPackOracleSwap(picked)
    expect(cancelled.pendingNewOracle).toBeNull()
  })

  test('closePackOracleSelectで残り選択を放棄してshopへ戻る', () => {
    const run = shopRunWithOraclePack()
    const opened = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    const closed = closePackOracleSelect(opened)
    expect(closed.phase).toBe('shop')
    expect(closed.oracleOffer).toEqual([])
  })
})

describe('useOracle(所持神託の消費、playingフェーズ限定)', () => {
  test('playingフェーズで使用でき、役レベルが+1されrun/wave両方に反映される', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, oracles: ['flush'] }
    const before = run.oracleLevels.flush
    const result = useOracle(DEFAULT_PARAMS, run, 'flush')
    expect(result.oracleLevels.flush).toBe(before + 1)
    expect(result.wave!.oracleLevels.flush).toBe(before + 1)
    expect(result.oracles).toEqual([])
  })

  test('所持していない神託は使用できない', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, oracles: [] }
    expect(useOracle(DEFAULT_PARAMS, run, 'flush')).toBe(run)
  })

  test('shopフェーズでは使用できない(spec §6の通りplayingフェーズ限定)', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'shop', wave, oracles: ['flush'] }
    expect(useOracle(DEFAULT_PARAMS, run, 'flush')).toBe(run)
  })
})
