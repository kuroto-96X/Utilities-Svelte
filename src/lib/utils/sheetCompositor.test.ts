import { describe, it, expect } from 'vitest'
import { computeGridLayout } from './sheetCompositor'

describe('computeGridLayout', () => {
  it('L判6面で2列3行のレイアウトを返す', () => {
    // L判: 89mm×127mm → 1051×1500px at 300dpi
    // 履歴書用: 30mm×40mm → 354×472px
    // maxCols=floor(1051/354)=2, cols=2, rows=ceil(6/2)=3
    const layout = computeGridLayout(1051, 1500, 354, 472, 6)
    expect(layout.cols).toBe(2)
    expect(layout.rows).toBe(3)
    expect(layout.positions).toHaveLength(6)
  })

  it('L判4面で2列2行のレイアウトを返す', () => {
    const layout = computeGridLayout(1051, 1500, 354, 472, 4)
    expect(layout.cols).toBe(2)
    expect(layout.rows).toBe(2)
    expect(layout.positions).toHaveLength(4)
  })

  it('1枚目のx座標はmarginXに等しい', () => {
    // marginX = (1051 - 2*354) / (2+1) = 343/3 ≈ 114.33
    const layout = computeGridLayout(1051, 1500, 354, 472, 6)
    expect(layout.positions[0].x).toBeCloseTo(343 / 3, 0)
  })

  it('1枚目のy座標はmarginYに等しい', () => {
    // marginY = (1500 - 3*472) / (3+1) = 84/4 = 21
    const layout = computeGridLayout(1051, 1500, 354, 472, 6)
    expect(layout.positions[0].y).toBeCloseTo(21, 0)
  })

  it('シートに収まらない枚数でエラーを投げる', () => {
    // count=7: rows=ceil(7/2)=4 > maxRows=floor(1500/472)=3 → エラー
    expect(() => computeGridLayout(1051, 1500, 354, 472, 7)).toThrow()
  })
})
