export type NoteId = 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth' | 'thirtysecond' | 'sixtyfourth'

export interface NoteSymbol {
  filled: boolean
  stem: boolean
  flags: 0 | 1 | 2 | 3 | 4
}

export interface NoteDuration {
  id: NoteId
  label: string
  fraction: string
  symbol: NoteSymbol
  normalSec: number
  dottedSec: number
  tripletSec: number
}

export const MIN_BPM = 20
export const MAX_BPM = 300
export const DEFAULT_BPM = 120

export function clampBpm(bpm: number): number {
  if (Number.isNaN(bpm)) return DEFAULT_BPM
  return Math.min(MAX_BPM, Math.max(MIN_BPM, bpm))
}

const NOTE_DEFS: Array<Omit<NoteDuration, 'normalSec' | 'dottedSec' | 'tripletSec'> & { mult: number }> = [
  { id: 'whole',        label: '全音符',   fraction: '1/1',  mult: 4,     symbol: { filled: false, stem: false, flags: 0 } },
  { id: 'half',         label: '2分音符',  fraction: '1/2',  mult: 2,     symbol: { filled: false, stem: true,  flags: 0 } },
  { id: 'quarter',      label: '4分音符',  fraction: '1/4',  mult: 1,     symbol: { filled: true,  stem: true,  flags: 0 } },
  { id: 'eighth',       label: '8分音符',  fraction: '1/8',  mult: 0.5,   symbol: { filled: true,  stem: true,  flags: 1 } },
  { id: 'sixteenth',    label: '16分音符', fraction: '1/16', mult: 0.25,  symbol: { filled: true,  stem: true,  flags: 2 } },
  { id: 'thirtysecond',  label: '32分音符', fraction: '1/32', mult: 0.125,  symbol: { filled: true,  stem: true,  flags: 3 } },
  { id: 'sixtyfourth',  label: '64分音符', fraction: '1/64', mult: 0.0625, symbol: { filled: true,  stem: true,  flags: 4 } },
]

/** bpm は clampBpm() で検証済みの値を渡すこと。bpm <= 0 の場合は DEFAULT_BPM にフォールバックするが、これは最終防衛ラインであり主要な検証パスではない。 */
export function calculateNoteDurations(bpm: number): NoteDuration[] {
  const safeBpm = bpm > 0 ? bpm : DEFAULT_BPM
  const quarterSec = 60 / safeBpm
  return NOTE_DEFS.map(({ mult, ...rest }) => {
    const normalSec = quarterSec * mult
    return {
      ...rest,
      normalSec,
      dottedSec: normalSec * 1.5,
      tripletSec: normalSec * (2 / 3),
    }
  })
}

export function formatSec(sec: number): string {
  return sec.toFixed(3)
}

export function formatMs(sec: number): string {
  return (sec * 1000).toFixed(1)
}

export function formatMsLarge(sec: number): string {
  const ms = sec * 1000
  return Number.isInteger(ms) ? String(ms) : ms.toFixed(1).replace(/\.0$/, '')
}

export function formatHzSmall(sec: number): string {
  return (1 / sec).toFixed(2)
}

export type NoteVariant = 'normal' | 'dotted' | 'triplet'

export interface NoteMatch {
  bpm: number
  noteId: NoteId
  label: string
  variant: NoteVariant
  durationMs: number
  diffMs: number
  diffPct: number
}

export interface FindNearestNotesOptions {
  bpmMin?: number
  bpmMax?: number
  includeDotted?: boolean
  includeTriplet?: boolean
  topN?: number
  tolerancePct?: number
  mode: 'topN' | 'tolerance'
}

export function findNearestNotes(targetMs: number, options: FindNearestNotesOptions): NoteMatch[] {
  if (targetMs <= 0) return []

  const {
    bpmMin = MIN_BPM,
    bpmMax = MAX_BPM,
    includeDotted = true,
    includeTriplet = false,
    topN = 10,
    tolerancePct = 5,
    mode,
  } = options

  type VariantDef = { variant: NoteVariant; factor: number; prefix: string; suffix: string }
  const variants: VariantDef[] = [
    { variant: 'normal',  factor: 1,       prefix: '',     suffix: '' },
    ...(includeDotted  ? [{ variant: 'dotted'  as NoteVariant, factor: 1.5,   prefix: '付点', suffix: '' }]         : []),
    ...(includeTriplet ? [{ variant: 'triplet' as NoteVariant, factor: 2 / 3, prefix: '',     suffix: '（3連符）' }] : []),
  ]

  const results: NoteMatch[] = []

  const safeMin = Math.max(MIN_BPM, Math.floor(bpmMin ?? MIN_BPM))
  const safeMax = Math.min(MAX_BPM, Math.floor(bpmMax ?? MAX_BPM))

  for (let bpm = safeMin; bpm <= safeMax; bpm++) {
    const quarterMs = (60 / bpm) * 1000
    for (const noteDef of NOTE_DEFS) {
      for (const { variant, factor, prefix, suffix } of variants) {
        const durationMs = quarterMs * noteDef.mult * factor
        const diffMs = Math.abs(targetMs - durationMs)
        const diffPct = (diffMs / targetMs) * 100
        results.push({
          bpm,
          noteId: noteDef.id,
          label: `${prefix}${noteDef.label}${suffix}`,
          variant,
          durationMs,
          diffMs,
          diffPct,
        })
      }
    }
  }

  results.sort((a, b) => a.diffMs - b.diffMs)

  if (mode === 'topN') {
    return results.slice(0, Math.max(1, topN ?? 10))
  }
  return results.filter(r => r.diffPct <= (tolerancePct ?? 5))
}
