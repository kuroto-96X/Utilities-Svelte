import { patterns, adjectives, nouns, subjects, locations, verbPhrases } from './templates'

export const easyWords: string[] = [
  'ねこ', 'いぬ', 'くま', 'さる', 'しか', 'ぞう', 'とら', 'へび',
  'かも', 'つる', 'はな', 'もも', 'なし', 'かき', 'くり', 'まつ',
  'うめ', 'かぜ', 'あめ', 'ゆき', 'そら', 'つき', 'ほし', 'やま',
  'かわ', 'うみ', 'もり', 'はる', 'なつ', 'あき', 'ふゆ', 'しろ',
  'くろ', 'あお', 'あか', 'みず', 'てら', 'みち', 'はし', 'ふね',
  'くも', 'たけ', 'かに', 'えび', 'たこ', 'いか', 'なみ', 'いわ',
  'きつね', 'うさぎ', 'たぬき', 'いるか', 'りんご', 'ぶどう', 'すいか',
  'いちご', 'みかん', 'さくら', 'もみじ', 'ひかり', 'きのこ', 'くるま',
  'にわとり', 'とんぼ', 'ほたる', 'ちょう', 'まりも',
  'ひまわり', 'こうもり', 'かたつむり',
]

export function pickQuestions(pool: string[], count: number): string[] {
  const arr = [...pool]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.slice(0, Math.min(count, arr.length))
}

function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function generatePool(
  count: number,
  seed?: number,
): { sentences: string[]; seed: number } {
  const actualSeed = seed ?? ((Math.random() * 0xffffffff) >>> 0)
  const rand = mulberry32(actualSeed)

  const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)]

  const generated = new Set<string>()
  const maxAttempts = count * 10

  for (let i = 0; i < maxAttempts && generated.size < count; i++) {
    const pattern = pick(patterns)
    const sentence = pattern
      .replace(/\{adj\}/g, pick(adjectives))
      .replace(/\{noun\}/g, pick(nouns))
      .replace(/\{subject\}/g, pick(subjects))
      .replace(/\{location\}/g, pick(locations))
      .replace(/\{verb\}/g, pick(verbPhrases))
    generated.add(sentence)
  }

  return { sentences: [...generated], seed: actualSeed }
}
