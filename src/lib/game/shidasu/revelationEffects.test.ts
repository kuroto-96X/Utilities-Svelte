import { describe, test, expect } from 'vitest'
import { applyRevelationEffect, revelationNeedsTarget, canUseRevelation } from './revelationEffects'
import { DEFAULT_PARAMS } from './params'
import { createRng } from './deck'
import type { Card, DeckCard, WaveState, RelicId } from './types'
import { defaultOracleLevels } from './oracles'

function card(id: number, suit: Card['suit'], rank: Card['rank'], wild = false, deckId = id): Card {
  return { id, deckId, suit, rank, wild }
}

function deckCard(deckId: number, suit: DeckCard['suit'], rank: DeckCard['rank'], wild = false, removed = false): DeckCard {
  return { deckId, suit, rank, wild, removed }
}

function baseWave(overrides: Partial<WaveState> = {}): WaveState {
  return {
    tableau: [[card(1, '♠', 5)]],
    stock: [],
    foundation: card(2, '♥', 6),
    score: 100,
    combo: 2,
    chain: [card(2, '♥', 6)],
    chainOrigin: ['draw'],
    linked: false,
    columnsEmptiedThisCombo: 0,
    comboStreakColumnLengths: [1],
    dealtRows: DEFAULT_PARAMS.layout.rows,
    lastDrawEffect: null,
    status: 'playing',
    endReason: null,
    lastGain: null,
    firstPlayDone: true,
    discardPile: [],
    lastPlayedColumn: null,
    sameColumnStreak: 0,
    maxComboThisWave: 2,
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

describe('revelationEffects', () => {
  test('角: 選んだ列の非ワイルドカードが全て♠に変換され、deckCompositionにも反映される', () => {
    const wave = baseWave({ tableau: [[card(1, '♥', 3), card(2, '♦', 4), card(3, '♠', 5, true)]] })
    const deckComposition: DeckCard[] = [deckCard(1, '♥', 3), deckCard(2, '♦', 4), deckCard(3, '♠', 5, true)]
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'kaku', 0, createRng(1))
    expect(result.wave.tableau[0].map(c => c.suit)).toEqual(['♠', '♠', '♠'])
    expect(result.wave.tableau[0][2].wild).toBe(true) // ワイルドはスート変更されない
    expect(result.deckComposition.find(c => c.deckId === 1)?.suit).toBe('♠')
    expect(result.deckComposition.find(c => c.deckId === 2)?.suit).toBe('♠')
    expect(result.deckComposition.find(c => c.deckId === 3)?.suit).toBe('♠') // ワイルドのdeckCompositionエントリも変更しない
  })

  test('角: targetColがnullなら何もしない', () => {
    const wave = baseWave({ tableau: [[card(1, '♥', 3)]] })
    const deckComposition: DeckCard[] = [deckCard(1, '♥', 3)]
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'kaku', null, createRng(1))
    expect(result.wave).toBe(wave)
    expect(result.deckComposition).toBe(deckComposition)
  })

  test('心: 場札全体の♠が全て♥に変換され、deckCompositionにも反映される(他のスートは対象外)', () => {
    const wave = baseWave({
      tableau: [[card(1, '♠', 3), card(2, '♦', 4)], [card(3, '♠', 5, true)]],
    })
    const deckComposition: DeckCard[] = [deckCard(1, '♠', 3), deckCard(2, '♦', 4), deckCard(3, '♠', 5, true)]
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'shin', null, createRng(1))
    expect(result.wave.tableau[0][0].suit).toBe('♥')
    expect(result.wave.tableau[0][1].suit).toBe('♦') // ♦は対象外
    expect(result.wave.tableau[1][0].suit).toBe('♠') // ワイルドは対象外
    expect(result.deckComposition.find(c => c.deckId === 1)?.suit).toBe('♥')
    expect(result.deckComposition.find(c => c.deckId === 3)?.suit).toBe('♠')
  })

  test('牛: 選んだ列の非ワイルドカードがA〜10のいずれかへ個別ランダムに変換される', () => {
    const wave = baseWave({ tableau: [[card(1, '♠', 11), card(2, '♦', 12), card(3, '♠', 13, true)]] })
    const deckComposition: DeckCard[] = [deckCard(1, '♠', 11), deckCard(2, '♦', 12), deckCard(3, '♠', 13, true)]
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'gyu', 0, createRng(1))
    expect(result.wave.tableau[0][0].rank).toBeGreaterThanOrEqual(1)
    expect(result.wave.tableau[0][0].rank).toBeLessThanOrEqual(10)
    expect(result.wave.tableau[0][1].rank).toBeGreaterThanOrEqual(1)
    expect(result.wave.tableau[0][1].rank).toBeLessThanOrEqual(10)
    expect(result.wave.tableau[0][2].rank).toBe(13) // ワイルドは変換されない
    expect(result.deckComposition.find(c => c.deckId === 1)?.rank).toBe(result.wave.tableau[0][0].rank)
  })

  test('女: 選んだ列の非ワイルドカードがJ・Q・Kのいずれかへ個別ランダムに変換される', () => {
    const wave = baseWave({ tableau: [[card(1, '♠', 1), card(2, '♦', 2)]] })
    const deckComposition: DeckCard[] = [deckCard(1, '♠', 1), deckCard(2, '♦', 2)]
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'jo', 0, createRng(1))
    expect(result.wave.tableau[0][0].rank).toBeGreaterThanOrEqual(11)
    expect(result.wave.tableau[0][1].rank).toBeGreaterThanOrEqual(11)
  })

  test('危: 選んだ列の一番上にワイルドが追加され、deckCompositionにも新規ワイルドエントリが1件追加される', () => {
    const wave = baseWave({ tableau: [[card(1, '♠', 1)], []] })
    const deckComposition: DeckCard[] = [deckCard(1, '♠', 1)]
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'aya', 1, createRng(1))
    expect(result.wave.tableau[1]).toHaveLength(1)
    expect(result.wave.tableau[1][0].wild).toBe(true)
    expect(result.deckComposition).toHaveLength(2)
    expect(result.deckComposition[1].wild).toBe(true)
  })

  test('室: 選んだ列の各カードが1つ左の列の同じ位置のランク+1に変換され、deckCompositionにも反映される', () => {
    const wave = baseWave({
      tableau: [
        [card(1, '♠', 5), card(2, '♠', 13)],
        [card(3, '♥', 1), card(4, '♥', 2, true)],
      ],
    })
    const deckComposition: DeckCard[] = [
      deckCard(1, '♠', 5), deckCard(2, '♠', 13), deckCard(3, '♥', 1), deckCard(4, '♥', 2, true),
    ]
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'shitsu', 1, createRng(1))
    expect(result.wave.tableau[1][0].rank).toBe(6) // 左列位置0(rank5)+1
    expect(result.wave.tableau[1][1].wild).toBe(true) // 選択列側がワイルドならスキップ
    expect(result.wave.tableau[1][1].rank).toBe(2) // 変換されず元のまま
    expect(result.deckComposition.find(c => c.deckId === 3)?.rank).toBe(6)
  })

  test('室: 左端の列を選んだ場合は右端の列を参照する(A⇔Kループ)', () => {
    const wave = baseWave({
      tableau: [
        [card(1, '♠', 5)],
        [card(2, '♥', 1)],
        [card(3, '♦', 13)],
      ],
    })
    const deckComposition: DeckCard[] = [deckCard(1, '♠', 5), deckCard(2, '♥', 1), deckCard(3, '♦', 13)]
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'shitsu', 0, createRng(1))
    expect(result.wave.tableau[0][0].rank).toBe(1) // 右端列(rank13)+1 = ループで1
  })

  test('室: 参照列の方が短い場合、はみ出した位置は変換されない', () => {
    const wave = baseWave({
      tableau: [
        [card(1, '♠', 5)],
        [card(2, '♥', 1), card(3, '♥', 2)],
      ],
    })
    const deckComposition: DeckCard[] = [deckCard(1, '♠', 5), deckCard(2, '♥', 1), deckCard(3, '♥', 2)]
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'shitsu', 1, createRng(1))
    expect(result.wave.tableau[1][0].rank).toBe(6) // 位置0は左列(rank5)+1
    expect(result.wave.tableau[1][1].rank).toBe(2) // 位置1は左列に対応するカードが無いため変換されない
  })

  test('壁: 場札全体で♠→♥→♣→♦→♠と循環変換され、deckCompositionにも反映される(カスケードしない)', () => {
    const wave = baseWave({
      tableau: [[card(1, '♠', 3), card(2, '♥', 4), card(3, '♣', 5), card(4, '♦', 6), card(5, '♠', 7, true)]],
    })
    const deckComposition: DeckCard[] = [
      deckCard(1, '♠', 3), deckCard(2, '♥', 4), deckCard(3, '♣', 5), deckCard(4, '♦', 6), deckCard(5, '♠', 7, true),
    ]
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'heki', null, createRng(1))
    expect(result.wave.tableau[0].map(c => c.suit)).toEqual(['♥', '♣', '♦', '♠', '♠'])
    expect(result.wave.tableau[0][4].wild).toBe(true) // ワイルドは対象外
    expect(result.deckComposition.find(c => c.deckId === 1)?.suit).toBe('♥')
    expect(result.deckComposition.find(c => c.deckId === 4)?.suit).toBe('♠')
    expect(result.deckComposition.find(c => c.deckId === 5)?.suit).toBe('♠') // ワイルドのエントリは変更しない
  })

  test('奎: 空でない列を左から順に、先頭列の一番上のランクを起点とした階段状に各列の一番上が変換される(空列は無視、ワイルド列は変換されないが順番はカウントする)', () => {
    const wave = baseWave({
      tableau: [
        [card(1, '♠', 5), card(2, '♠', 6)], // 一番上(末尾)はrank6
        [], // 空列は無視される
        [card(3, '♥', 9)], // 一番上
        [card(4, '♦', 1, true)], // ワイルドは変換しない(ただし順番はカウントする)
        [card(5, '♣', 3)], // ワイルド列の次: base+3のはずになる(ワイルド列がカウントされていることの検証)
      ],
    })
    const deckComposition: DeckCard[] = [
      deckCard(1, '♠', 5), deckCard(2, '♠', 6), deckCard(3, '♥', 9), deckCard(4, '♦', 1, true), deckCard(5, '♣', 3),
    ]
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'kei', null, createRng(1))
    expect(result.wave.tableau[0][1].rank).toBe(6) // 起点(base)はそのまま
    expect(result.wave.tableau[2][0].rank).toBe(7) // 2番目の空でない列 → base+1
    expect(result.wave.tableau[3][0].wild).toBe(true)
    expect(result.wave.tableau[3][0].rank).toBe(1) // ワイルドは変換されない
    expect(result.wave.tableau[4][0].rank).toBe(9) // ワイルド列も順番にカウントされるため base+3 = 6+3-13ループ無し=9
    expect(result.deckComposition.find(c => c.deckId === 3)?.rank).toBe(7)
    expect(result.deckComposition.find(c => c.deckId === 5)?.rank).toBe(9)
  })

  test('婁: 場札の全ての列の一番上のカード(ワイルド含む)が廃棄され、wave.tableauから取り除かれdeckCompositionがremoved:trueになる', () => {
    const wave = baseWave({
      tableau: [
        [card(1, '♠', 5), card(2, '♠', 6)],
        [],
        [card(3, '♥', 9, true)],
      ],
    })
    const deckComposition: DeckCard[] = [
      deckCard(1, '♠', 5), deckCard(2, '♠', 6), deckCard(3, '♥', 9, true),
    ]
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'rou', null, createRng(1))
    expect(result.wave.tableau[0]).toEqual([card(1, '♠', 5)]) // 一番上(rank6)が廃棄され1枚だけ残る
    expect(result.wave.tableau[1]).toEqual([]) // 空列はそのまま
    expect(result.wave.tableau[2]).toEqual([]) // ワイルドも廃棄される
    expect(result.deckComposition.find(c => c.deckId === 2)?.removed).toBe(true)
    expect(result.deckComposition.find(c => c.deckId === 3)?.removed).toBe(true)
    expect(result.deckComposition.find(c => c.deckId === 1)?.removed).toBe(false)
    expect(result.deckComposition).toHaveLength(3) // 削除ではなくフラグなので要素数は変わらない
  })

  test('胃: 場札の最大ランクと最小ランクのカードがそれぞれ1枚ずつワイルド化される', () => {
    const wave = baseWave({
      tableau: [[card(1, '♠', 3), card(2, '♥', 13), card(3, '♦', 1)]],
    })
    const deckComposition: DeckCard[] = [deckCard(1, '♠', 3), deckCard(2, '♥', 13), deckCard(3, '♦', 1)]
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'i', null, createRng(1))
    const wildCards = result.wave.tableau[0].filter(c => c.wild)
    expect(wildCards.map(c => c.rank).sort()).toEqual([1, 13])
    expect(result.wave.tableau[0].find(c => c.rank === 3)?.wild).toBe(false) // 中間ランクは対象外
    const wildDeckIds = result.deckComposition.filter(c => c.wild).map(c => c.deckId).sort()
    expect(wildDeckIds).toEqual([2, 3])
  })

  test('胃: 実カードが1枚しかない場合は1枚だけワイルド化される(最大=最小)', () => {
    const wave = baseWave({ tableau: [[card(1, '♠', 7)]] })
    const deckComposition: DeckCard[] = [deckCard(1, '♠', 7)]
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'i', null, createRng(1))
    expect(result.wave.tableau[0].filter(c => c.wild)).toHaveLength(1)
  })

  test('胃: 最大ランクの該当が複数ある場合はランダムに1枚だけ選ばれる', () => {
    const wave = baseWave({ tableau: [[card(1, '♠', 13), card(2, '♥', 13), card(3, '♦', 1)]] })
    const deckComposition: DeckCard[] = [deckCard(1, '♠', 13), deckCard(2, '♥', 13), deckCard(3, '♦', 1)]
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'i', null, createRng(1))
    const wildCards = result.wave.tableau[0].filter(c => c.wild)
    expect(wildCards).toHaveLength(2) // 最大ランク側1枚+最小ランク側1枚
    expect(wildCards.some(c => c.rank === 1)).toBe(true)
  })

  test('胃: 実カードが全て同ランクで複数枚ある場合、異なる2枚がワイルド化される(同じカードの二重選出を防ぐ)', () => {
    const wave = baseWave({ tableau: [[card(1, '♠', 7), card(2, '♥', 7), card(3, '♦', 7)]] })
    const deckComposition: DeckCard[] = [deckCard(1, '♠', 7), deckCard(2, '♥', 7), deckCard(3, '♦', 7)]
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'i', null, createRng(5))
    const wildCards = result.wave.tableau[0].filter(c => c.wild)
    expect(wildCards).toHaveLength(2) // target1とtarget2は異なる2枚のカード
    const wildDeckIds = new Set(wildCards.map(c => c.deckId))
    expect(wildDeckIds.size).toBe(2) // 同じdeckIdが2回選ばれていない(重複無し)
  })

  test('畢: 選んだ列が先頭カード起点の階段状ランクに再配置され、deckCompositionにも反映される', () => {
    const wave = baseWave({ tableau: [[card(1, '♠', 5), card(2, '♥', 6), card(3, '♦', 7)]] })
    const deckComposition: DeckCard[] = [deckCard(1, '♠', 5), deckCard(2, '♥', 6), deckCard(3, '♦', 7)]
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'hitsu', 0, createRng(1))
    const ranks = result.wave.tableau[0].map(c => c.rank)
    expect(ranks[0]).toBe(5) // 起点は先頭カードのランク
    const ascending = ranks[1] === 6
    const descending = ranks[1] === 4
    expect(ascending || descending).toBe(true)
    expect(ranks[2]).toBe(ascending ? 7 : 3)
    expect(result.deckComposition.find(c => c.deckId === 1)?.rank).toBe(5)
  })

  test('畢: targetColがnullなら何もしない', () => {
    const wave = baseWave({ tableau: [[card(1, '♠', 5)]] })
    const deckComposition: DeckCard[] = [deckCard(1, '♠', 5)]
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'hitsu', null, createRng(1))
    expect(result.wave).toBe(wave)
    expect(result.deckComposition).toBe(deckComposition)
  })

  test('觜: チェーン末尾1枚がワイルド化され、foundationも更新され、deckCompositionにも反映される', () => {
    const wave = baseWave({ chain: [card(1, '♠', 5), card(2, '♥', 6)], foundation: card(2, '♥', 6) })
    const deckComposition: DeckCard[] = [deckCard(1, '♠', 5), deckCard(2, '♥', 6)]
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'shi', null, createRng(1))
    expect(result.wave.chain[1].wild).toBe(true)
    expect(result.wave.chain[0].wild).toBe(false)
    expect(result.wave.foundation.wild).toBe(true)
    expect(result.deckComposition.find(c => c.deckId === 2)?.wild).toBe(true)
    expect(result.deckComposition.find(c => c.deckId === 1)?.wild).toBe(false)
  })

  test('觜: チェーンが空なら何もしない', () => {
    const wave = baseWave({ chain: [] })
    const deckComposition: DeckCard[] = []
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'shi', null, createRng(1))
    expect(result.wave).toBe(wave)
    expect(result.deckComposition).toBe(deckComposition)
  })

  test('井: 場札の非ワイルド実カードから1枚(n=1)がランダムでワイルド化され、deckCompositionにも反映される', () => {
    const wave = baseWave({ tableau: [[card(1, '♠', 5), card(2, '♥', 6, true)], [card(3, '♦', 7)]] })
    const deckComposition: DeckCard[] = [deckCard(1, '♠', 5), deckCard(2, '♥', 6, true), deckCard(3, '♦', 7)]
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'sei', null, createRng(1))
    const wildCount = result.wave.tableau.flat().filter(c => c.wild).length
    expect(wildCount).toBe(2) // 元から居た1枚(deckId2) + 新たに変換された1枚
    const newlyWildDeckIds = result.deckComposition.filter(c => c.wild).map(c => c.deckId)
    expect(newlyWildDeckIds).toContain(2)
    expect(newlyWildDeckIds).toHaveLength(2)
  })

  test('井: 非ワイルド実カードが無ければ何も変換されない', () => {
    const wave = baseWave({ tableau: [[card(1, '♠', 5, true)]] })
    const deckComposition: DeckCard[] = [deckCard(1, '♠', 5, true)]
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'sei', null, createRng(1))
    expect(result.wave.tableau[0][0].wild).toBe(true)
    expect(result.deckComposition[0].wild).toBe(true)
  })

  test('昴(subaru): wave/deckCompositionを変更しない(実際の報酬付与はengine.tsのuseRevelation側)', () => {
    const wave = baseWave()
    const deckComposition: DeckCard[] = []
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'subaru', null, createRng(1))
    expect(result.wave).toBe(wave)
    expect(result.deckComposition).toBe(deckComposition)
  })

  test('柳(ryuu): wave/deckCompositionを変更しない(実際の報酬付与はengine.tsのuseRevelation側)', () => {
    const wave = baseWave()
    const deckComposition: DeckCard[] = []
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'ryuu', null, createRng(1))
    expect(result.wave).toBe(wave)
    expect(result.deckComposition).toBe(deckComposition)
  })

  test('星(hotori): wave/deckCompositionを変更しない(実際の報酬付与はengine.tsのuseRevelation側)', () => {
    const wave = baseWave()
    const deckComposition: DeckCard[] = []
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'hotori', null, createRng(1))
    expect(result.wave).toBe(wave)
    expect(result.deckComposition).toBe(deckComposition)
  })

  test('張(chou): wave/deckCompositionを変更しない(実際の報酬付与はengine.tsのuseRevelation側)', () => {
    const wave = baseWave()
    const deckComposition: DeckCard[] = []
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'chou', null, createRng(1))
    expect(result.wave).toBe(wave)
    expect(result.deckComposition).toBe(deckComposition)
  })

  test('翼(yoku): wave/deckCompositionを変更しない(実際の報酬付与はengine.tsのuseRevelation側)', () => {
    const wave = baseWave()
    const deckComposition: DeckCard[] = []
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'yoku', null, createRng(1))
    expect(result.wave).toBe(wave)
    expect(result.deckComposition).toBe(deckComposition)
  })

  test('軫(mitsu): wave/deckCompositionを変更しない(実際の報酬付与はengine.tsのuseRevelation側)', () => {
    const wave = baseWave()
    const deckComposition: DeckCard[] = []
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'mitsu', null, createRng(1))
    expect(result.wave).toBe(wave)
    expect(result.deckComposition).toBe(deckComposition)
  })

  test('参(karasu): wave/deckCompositionを変更しない(実際の報酬付与はengine.tsのuseRevelation側)', () => {
    const wave = baseWave()
    const deckComposition: DeckCard[] = []
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'karasu', null, createRng(1))
    expect(result.wave).toBe(wave)
    expect(result.deckComposition).toBe(deckComposition)
  })

  test('revelationNeedsTarget: 列選択が必要な種類とそうでない種類を正しく区別する', () => {
    expect(revelationNeedsTarget('kaku')).toBe(true)
    expect(revelationNeedsTarget('gyu')).toBe(true)
    expect(revelationNeedsTarget('jo')).toBe(true)
    expect(revelationNeedsTarget('aya')).toBe(true)
    expect(revelationNeedsTarget('shitsu')).toBe(true)
    expect(revelationNeedsTarget('hitsu')).toBe(true)
    expect(revelationNeedsTarget('shin')).toBe(false)
  })
})

describe('canUseRevelation: 虚(レリック付喪化)', () => {
  const wave = baseWave({ tableau: [[card(1, '♠', 1)]] })

  test('所持レリックが0件なら使用不可', () => {
    expect(canUseRevelation(DEFAULT_PARAMS, wave, 'kyo', [])).toBe(false)
  })

  test('所持レリックが全て付喪化済みなら使用不可', () => {
    const relics = [{ id: 'manekiNeko' as const, tsukumoka: true }]
    expect(canUseRevelation(DEFAULT_PARAMS, wave, 'kyo', relics)).toBe(false)
  })

  test('未付喪化の所持レリックが1件以上あれば使用可', () => {
    const relics = [
      { id: 'manekiNeko' as const, tsukumoka: true },
      { id: 'kumade' as const, tsukumoka: false },
    ]
    expect(canUseRevelation(DEFAULT_PARAMS, wave, 'kyo', relics)).toBe(true)
  })

  test('虚以外の天啓は、レリックの所持状況に関わらず使用可', () => {
    expect(canUseRevelation(DEFAULT_PARAMS, wave, 'kaku', [])).toBe(true)
  })
})
