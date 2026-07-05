import { describe, it, expect } from 'vitest'
import { calculateRequiredNavWidthPx } from './navWidth'

describe('calculateRequiredNavWidthPx', () => {
  describe('640px(Tailwindのsmブレークポイント)の下限', () => {
    it('カテゴリーが0件でも640pxを下回らない', () => {
      expect(calculateRequiredNavWidthPx([])).toBe(640)
    })

    it('現実的なカテゴリー数(5件)の計算結果でも640pxを下回らない', () => {
      const labels = ['楽曲制作', 'プログラミング', '画像', '投資', 'ゲーム']
      // 素の計算結果は 32+130+24+80+125+50+50+65=556 で640未満のため、640に切り上げられる
      expect(calculateRequiredNavWidthPx(labels)).toBe(640)
    })
  })

  describe('計算結果が640pxを超えるケース', () => {
    // 下限(640px)の影響を受けないよう、十分に大きいカテゴリー数・文字数で検証する

    it('カテゴリーが増えるほど必要幅が増える', () => {
      const label = 'サンプルカテゴリ' // 8文字
      const fewCategories = calculateRequiredNavWidthPx(Array(6).fill(label))
      const moreCategories = calculateRequiredNavWidthPx(Array(8).fill(label))
      expect(fewCategories).toBeGreaterThan(640)
      expect(moreCategories).toBeGreaterThan(fewCategories)
    })

    it('ラベルの文字数が多いほど必要幅が増える', () => {
      const short = calculateRequiredNavWidthPx(Array(10).fill('画像')) // 2文字 x10
      const long = calculateRequiredNavWidthPx(Array(10).fill('プログラミング')) // 7文字 x10
      expect(short).toBeGreaterThan(640)
      expect(long).toBeGreaterThan(short)
    })

    it('下限に切り上げられず正しい式で算出できる', () => {
      const labels = Array(8).fill('サンプルカテゴリ') // 8文字 x8
      // 32(nav padding) + 130(logo) + 24(safety) + 8 * (8*15 + 16 + 4)
      expect(calculateRequiredNavWidthPx(labels)).toBe(32 + 130 + 24 + 8 * (8 * 15 + 16 + 4))
    })
  })
})
