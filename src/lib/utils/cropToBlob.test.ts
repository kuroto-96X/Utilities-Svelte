import { describe, it, expect } from 'vitest'
import { buildDownloadFileName } from './cropToBlob'

describe('buildDownloadFileName', () => {
  it('presetIdに.png拡張子を付けて返す', () => {
    expect(buildDownloadFileName('ig-square')).toBe('ig-square.png')
  })

  it('ハイフンを含むpresetIdでも正しく動作する', () => {
    expect(buildDownloadFileName('yt-thumb')).toBe('yt-thumb.png')
  })
})
