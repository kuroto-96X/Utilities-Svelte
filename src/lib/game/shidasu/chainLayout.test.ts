import { describe, it, expect } from 'vitest'
import { nextChainSlotPosition } from './chainLayout'

describe('nextChainSlotPosition', () => {
  it('チェーンが空のとき、1行目の先頭(0,0)を返す', () => {
    const pos = nextChainSlotPosition(0, 30, 10)
    expect(pos).toEqual({ row: 0, col: 0, left: 0, top: 0 })
  })

  it('チェーンに3枚あるとき、4枚目の位置(row0, col3)を返す', () => {
    const pos = nextChainSlotPosition(3, 30, 10)
    expect(pos).toEqual({ row: 0, col: 3, left: 90, top: 0 })
  })

  it('1行の上限(chainCardsPerRow)に達したら次の行に折り返す', () => {
    const pos = nextChainSlotPosition(10, 30, 10)
    expect(pos).toEqual({ row: 1, col: 0, left: 0, top: 0 })
  })

  it('2行目の途中の位置を正しく計算する', () => {
    const pos = nextChainSlotPosition(12, 30, 10)
    expect(pos).toEqual({ row: 1, col: 2, left: 60, top: 0 })
  })
})
