export interface RhythmPattern {
  id: string;
  label: string;
  notation: string;
  beats: number[]; // 1 = 4分音符、合計は必ず4
}

export const RHYTHM_PATTERNS: RhythmPattern[] = [
  // 1音
  { id: 'whole',      label: '全音符',           notation: '○',                 beats: [4] },
  // 2音
  { id: 'halves',     label: '2分×2',           notation: '𝅗𝅥𝅗𝅥',             beats: [2, 2] },
  // 3音
  { id: 'half',       label: '2分音符主体',      notation: '𝅗𝅥♩♩',             beats: [2, 1, 1] },
  { id: 'hemiola',    label: 'ヘミオラ',         notation: '♩.♩.♩',            beats: [1.5, 1.5, 1] },
  // 4音
  { id: 'equal',      label: '等分4分',         notation: '♩♩♩♩',             beats: [1, 1, 1, 1] },
  { id: 'dotted',     label: '付点リズム',       notation: '♩.♪♩.♪',           beats: [1.5, 0.5, 1.5, 0.5] },
  { id: 'scotch',     label: 'スコッチスナップ', notation: '♪♩.♪♩.',           beats: [0.5, 1.5, 0.5, 1.5] },
  { id: 'tango',      label: 'タンゴ',           notation: '♩♩.♪♩',            beats: [1, 1.5, 0.5, 1] },
  // 5音
  { id: 'march',      label: '行進曲',           notation: '♩♩♪♪♩',            beats: [1, 1, 0.5, 0.5, 1] },
  { id: 'habanera',   label: 'ハバネラ',         notation: '♩♪♪♩♩',            beats: [1, 0.5, 0.5, 1, 1] },
  { id: 'offbeat',    label: '裏拍強調',         notation: '♪♩♩♩♪',            beats: [0.5, 1, 1, 1, 0.5] },
  { id: 'clave',      label: 'クラーベ',         notation: '♪♩♪♩♩',            beats: [0.5, 1, 0.5, 1, 1] },
  { id: 'frontload',  label: '前半集中',         notation: '♪♪♪♪𝅗𝅥',           beats: [0.5, 0.5, 0.5, 0.5, 2] },
  { id: 'backload',   label: '後半集中',         notation: '𝅗𝅥♪♪♪♪',           beats: [2, 0.5, 0.5, 0.5, 0.5] },
  // 6音
  { id: 'rock',       label: 'ロック',           notation: '♩♪♪♩♪♪',           beats: [1, 0.5, 0.5, 1, 0.5, 0.5] },
  { id: 'gallop',     label: 'ギャロップ',       notation: '♪♪♩♪♪♩',           beats: [0.5, 0.5, 1, 0.5, 0.5, 1] },
  { id: 'synco',      label: 'シンコペ',         notation: '♪♩♪♪♩♪',           beats: [0.5, 1, 0.5, 0.5, 1, 0.5] },
  // 8音
  { id: 'eighth',     label: '8分連打',          notation: '♪♪♪♪♪♪♪♪',         beats: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5] },
  { id: 'dot8th',     label: '付点8分連打',      notation: '♪.♬♪.♬♪.♬♪.♬',    beats: [0.75, 0.25, 0.75, 0.25, 0.75, 0.25, 0.75, 0.25] },
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
