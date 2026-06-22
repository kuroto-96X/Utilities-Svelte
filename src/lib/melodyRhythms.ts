export interface RhythmPattern {
  id: string;
  label: string;
  beats: number[]; // 1 = 4分音符、合計は必ず4
}

export const RHYTHM_PATTERNS: RhythmPattern[] = [
  { id: 'equal',   label: '等分4分',         beats: [1, 1, 1, 1] },
  { id: 'dotted',  label: '付点リズム',       beats: [1.5, 0.5, 1.5, 0.5] },
  { id: 'march',   label: '行進曲',           beats: [1, 1, 0.5, 0.5, 1] },
  { id: 'scotch',  label: 'スコッチスナップ', beats: [0.5, 1.5, 0.5, 1.5] },
  { id: 'synco',   label: 'シンコペ',         beats: [0.5, 1, 0.5, 0.5, 1, 0.5] },
  { id: 'offbeat', label: '裏拍強調',         beats: [0.5, 1, 1, 1, 0.5] },
  { id: 'gallop',  label: 'ギャロップ',       beats: [0.5, 0.5, 1, 0.5, 0.5, 1] },
  { id: 'half',    label: '2分音符主体',      beats: [2, 1, 1] },
  { id: 'eighth',  label: '8分連打',          beats: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5] },
  { id: 'tango',   label: 'タンゴ',           beats: [1, 1.5, 0.5, 1] },
  { id: 'habanera',   label: 'ハバネラ',       beats: [1, 0.5, 0.5, 1, 1] },
  { id: 'dot8th',     label: '付点8分連打',    beats: [0.75, 0.25, 0.75, 0.25, 0.75, 0.25, 0.75, 0.25] },
  { id: 'whole',      label: '全音符',         beats: [4] },
  { id: 'halves',     label: '2分×2',         beats: [2, 2] },
  { id: 'frontload',  label: '前半集中',       beats: [0.5, 0.5, 0.5, 0.5, 2] },
  { id: 'backload',   label: '後半集中',       beats: [2, 0.5, 0.5, 0.5, 0.5] },
  { id: 'hemiola',    label: 'ヘミオラ',       beats: [1.5, 1.5, 1] },
  { id: 'clave',      label: 'クラーベ',       beats: [0.5, 1, 0.5, 1, 1] },
  { id: 'rock',       label: 'ロック',         beats: [1, 0.5, 0.5, 1, 0.5, 0.5] },
]

export function pickRhythmTemplate(bars: number, secPerBeat: number, patternId?: string): number[] {
  const pattern = patternId
    ? (RHYTHM_PATTERNS.find(p => p.id === patternId) ?? RHYTHM_PATTERNS[Math.floor(Math.random() * RHYTHM_PATTERNS.length)])
    : RHYTHM_PATTERNS[Math.floor(Math.random() * RHYTHM_PATTERNS.length)]
  const oneMeasure = pattern.beats.map(b => b * secPerBeat)
  const result: number[] = []
  for (let i = 0; i < bars; i++) {
    result.push(...oneMeasure)
  }
  return result
}
