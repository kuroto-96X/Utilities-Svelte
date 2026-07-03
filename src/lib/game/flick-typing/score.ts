export type Difficulty = 'easy' | 'hard'

export type PlayRecord = {
  difficulty: Difficulty
  count: number
  timeMs: number
  seed?: number
  playedAt: number
  isPersonalBest: boolean
}

function storageKey(difficulty: Difficulty, count: number): string {
  return `flick-typing:best:${difficulty}:${count}`
}

export function getBest(difficulty: Difficulty, count: number): number | null {
  try {
    const raw = localStorage.getItem(storageKey(difficulty, count))
    if (raw === null) return null
    const n = Number(raw)
    return isNaN(n) ? null : n
  } catch {
    return null
  }
}

export function saveBest(difficulty: Difficulty, count: number, timeMs: number): boolean {
  const current = getBest(difficulty, count)
  if (current !== null && timeMs >= current) return false
  try {
    localStorage.setItem(storageKey(difficulty, count), String(timeMs))
  } catch {
    // ストレージ満杯等は無視
  }
  return true
}

const HISTORY_KEY = 'flick-typing:history'
const HISTORY_MAX = 20

export function getHistory(): PlayRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (raw === null) return []
    return JSON.parse(raw) as PlayRecord[]
  } catch {
    return []
  }
}

export function addHistory(record: PlayRecord): void {
  const history = getHistory()
  const updated = [record, ...history].slice(0, HISTORY_MAX)
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
  } catch {
    // ストレージ満杯等は無視
  }
}
