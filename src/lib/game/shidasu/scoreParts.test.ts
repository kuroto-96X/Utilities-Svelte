import { describe, it, expect } from 'vitest'
import { addPart, multiplyPart, lockPart, fmtMultiplier, runningTotalsFromScoreParts, finalScoreFromScoreParts } from './scoreParts'

describe('fmtMultiplier', () => {
  it('小数第2位までに丸めて文字列化する', () => {
    expect(fmtMultiplier(1.5)).toBe('1.5')
    expect(fmtMultiplier(1.23456)).toBe('1.23')
  })
})

describe('addPart / multiplyPart / lockPart', () => {
  it('addPartはkind=addとtextを生成する', () => {
    expect(addPart('基礎点', 10)).toEqual({ label: '基礎点', kind: 'add', amount: 10, text: '基礎点+10' })
  })

  it('addPartはcardIdsを渡すとScorePart.cardIdsに反映する', () => {
    expect(addPart('同スート', 50, [1, 2, 3])).toEqual({ label: '同スート', kind: 'add', amount: 50, text: '同スート+50', cardIds: [1, 2, 3] })
  })

  it('addPartはcardIdsを省略するとcardIdsがundefinedになる', () => {
    expect(addPart('基礎点', 10).cardIds).toBeUndefined()
  })

  it('multiplyPartはkind=multiplyとtextを生成する', () => {
    expect(multiplyPart('コンボ倍率', 1.5)).toEqual({ label: 'コンボ倍率', kind: 'multiply', amount: 1.5, text: 'コンボ倍率×1.5' })
  })

  it('lockPartはkind=lockでamountが0、textはlabelそのまま', () => {
    expect(lockPart('小凶: 獲得点0')).toEqual({ label: '小凶: 獲得点0', kind: 'lock', amount: 0, text: '小凶: 獲得点0' })
  })
})

describe('runningTotalsFromScoreParts', () => {
  it('加算のみなら各ステップの累計を返す', () => {
    const parts = [addPart('基礎点', 10), addPart('同スート', 50)]
    expect(runningTotalsFromScoreParts(parts)).toEqual([10, 60])
  })

  it('乗算は直前の累計に掛け算する', () => {
    const parts = [addPart('基礎点', 100), multiplyPart('コンボ倍率', 1.5)]
    expect(runningTotalsFromScoreParts(parts)).toEqual([100, 150])
  })

  it('lockはそれ以降の累計を0にする', () => {
    const parts = [addPart('基礎点', 100), multiplyPart('コンボ倍率', 1.5), lockPart('ロック')]
    expect(runningTotalsFromScoreParts(parts)).toEqual([100, 150, 0])
  })

  it('空配列なら空配列を返す', () => {
    expect(runningTotalsFromScoreParts([])).toEqual([])
  })
})

describe('finalScoreFromScoreParts', () => {
  it('最終ステップの値に床関数を適用して返す', () => {
    const parts = [addPart('基礎点', 10), multiplyPart('コンボ倍率', 1.35)]
    expect(finalScoreFromScoreParts(parts)).toBe(Math.floor(13.5))
  })

  it('空配列なら0を返す', () => {
    expect(finalScoreFromScoreParts([])).toBe(0)
  })
})
