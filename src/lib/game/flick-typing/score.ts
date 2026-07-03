export type Difficulty = 'easy' | 'hard'

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
