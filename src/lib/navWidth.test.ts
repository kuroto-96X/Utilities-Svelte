import { describe, it, expect } from 'vitest'
import { calculateRequiredNavWidthPx } from './navWidth'

describe('calculateRequiredNavWidthPx', () => {
  it('カテゴリーが0件でもロゴ分の基準幅を返す', () => {
    expect(calculateRequiredNavWidthPx([])).toBe(32 + 130 + 24)
  })

  it('カテゴリーが増えるほど必要幅が増える', () => {
    const oneCategory = calculateRequiredNavWidthPx(['楽曲制作'])
    const twoCategories = calculateRequiredNavWidthPx(['楽曲制作', 'プログラミング'])
    expect(twoCategories).toBeGreaterThan(oneCategory)
  })

  it('ラベルの文字数が多いほど必要幅が増える', () => {
    const short = calculateRequiredNavWidthPx(['画像'])
    const long = calculateRequiredNavWidthPx(['プログラミング'])
    expect(long).toBeGreaterThan(short)
  })

  it('実際の5カテゴリー全表示時の必要幅を計算できる', () => {
    const labels = ['楽曲制作', 'プログラミング', '画像', '投資', 'ゲーム']
    // 32(nav padding) + 130(logo) + 24(safety) + 各ボタン(文字数*15 + 16 + 4)の合計
    // 楽曲制作(4): 60+16+4=80 / プログラミング(7): 105+16+4=125
    // 画像(2): 30+16+4=50 / 投資(2): 50 / ゲーム(3): 45+16+4=65
    expect(calculateRequiredNavWidthPx(labels)).toBe(32 + 130 + 24 + 80 + 125 + 50 + 50 + 65)
  })
})
