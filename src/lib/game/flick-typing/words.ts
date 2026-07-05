import { type SlotKey, type WordPart, patterns, adjectives, nouns, subjects, locations, verbPhrases } from './templates'

export type { WordPart }

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

export type GeneratedQuestion = {
  parts: WordPart[]
  reading: string
}

export function pickQuestions<T>(pool: T[], count: number): T[] {
  const copy = [...pool]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, count)
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
): { questions: GeneratedQuestion[]; seed: number } {
  const actualSeed = seed ?? ((Math.random() * 0xffffffff) >>> 0)
  const rand = mulberry32(actualSeed)
  const pickWord = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)]

  const slotMap: Record<SlotKey, WordPart[][]> = {
    adj: adjectives,
    noun: nouns,
    subject: subjects,
    location: locations,
    verb: verbPhrases,
  }

  const generated = new Map<string, GeneratedQuestion>()
  const maxAttempts = count * 10

  for (let i = 0; i < maxAttempts && generated.size < count; i++) {
    const pattern = pickWord(patterns)
    const parts: WordPart[] = []

    for (const part of pattern) {
      if (part.type === 'slot') {
        parts.push(...pickWord(slotMap[part.key]))
      } else {
        parts.push(part)
      }
    }

    const reading = parts.map((p) => (p.type === 'ruby' ? p.reading : p.text)).join('')
    if (!generated.has(reading)) {
      generated.set(reading, { parts, reading })
    }
  }

  return { questions: [...generated.values()], seed: actualSeed }
}
