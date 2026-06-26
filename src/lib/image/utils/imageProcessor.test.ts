import { describe, it, expect } from 'vitest'
import { isSupported, getOutputFileName, calcReduction } from './imageProcessor'

describe('isSupported', () => {
  it('accepts JPEG', () => {
    const f = new File([], 'a.jpg', { type: 'image/jpeg' })
    expect(isSupported(f)).toBe(true)
  })
  it('accepts PNG', () => {
    const f = new File([], 'a.png', { type: 'image/png' })
    expect(isSupported(f)).toBe(true)
  })
  it('accepts WebP', () => {
    const f = new File([], 'a.webp', { type: 'image/webp' })
    expect(isSupported(f)).toBe(true)
  })
  it('accepts GIF', () => {
    const f = new File([], 'a.gif', { type: 'image/gif' })
    expect(isSupported(f)).toBe(true)
  })
  it('rejects PDF', () => {
    const f = new File([], 'a.pdf', { type: 'application/pdf' })
    expect(isSupported(f)).toBe(false)
  })
  it('rejects plain text', () => {
    const f = new File([], 'a.txt', { type: 'text/plain' })
    expect(isSupported(f)).toBe(false)
  })
})

describe('getOutputFileName', () => {
  it('replaces extension with jpg for JPEG format', () => {
    expect(getOutputFileName('photo.png', 'image/jpeg')).toBe('photo.jpg')
  })
  it('replaces extension with png for PNG format', () => {
    expect(getOutputFileName('photo.jpg', 'image/png')).toBe('photo.png')
  })
  it('replaces extension with webp for WebP format', () => {
    expect(getOutputFileName('photo.jpeg', 'image/webp')).toBe('photo.webp')
  })
  it('handles filenames with dots in the name', () => {
    expect(getOutputFileName('my.photo.gif', 'image/jpeg')).toBe('my.photo.jpg')
  })
})

describe('calcReduction', () => {
  it('returns 50 when converted is half original', () => {
    expect(calcReduction(1000, 500)).toBe(50)
  })
  it('returns 0 when sizes are equal', () => {
    expect(calcReduction(1000, 1000)).toBe(0)
  })
  it('returns negative when converted is larger', () => {
    expect(calcReduction(500, 1000)).toBe(-100)
  })
  it('rounds to nearest integer', () => {
    expect(calcReduction(1000, 333)).toBe(67)
  })
})
