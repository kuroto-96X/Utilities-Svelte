export interface RhythmPattern {
  id: string;
  label: string;
  description: string;
  beats: number[]; // 1 = 4分音符、合計は必ず4
}

export const RHYTHM_PATTERNS: RhythmPattern[] = [
  { id: 'equal',      label: '等分4分',         description: '4拍均等に刻む',          beats: [1, 1, 1, 1] },
  { id: 'dotted',     label: '付点リズム',       description: '長短が交互に続く跳ねたリズム',  beats: [1.5, 0.5, 1.5, 0.5] },
  { id: 'march',      label: '行進曲',           description: '行進曲風の力強いリズム',  beats: [1, 1, 0.5, 0.5, 1] },
  { id: 'scotch',     label: 'スコッチスナップ', description: '短長が交互に続く鋭いリズム', beats: [0.5, 1.5, 0.5, 1.5] },
  { id: 'synco',      label: 'シンコペ',         description: '裏拍を強調したシンコペーション', beats: [0.5, 1, 0.5, 0.5, 1, 0.5] },
  { id: 'offbeat',    label: '裏拍強調',         description: '裏から始まり裏で締めるリズム', beats: [0.5, 1, 1, 1, 0.5] },
  { id: 'gallop',     label: 'ギャロップ',       description: '短短長の繰り返しで疾走感', beats: [0.5, 0.5, 1, 0.5, 0.5, 1] },
  { id: 'half',       label: '2分音符主体',      description: 'ゆったりした長い音符中心', beats: [2, 1, 1] },
  { id: 'eighth',     label: '8分連打',          description: '均等な8分音符を連打',     beats: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5] },
  { id: 'tango',      label: 'タンゴ',           description: 'タンゴ特有の情熱的なリズム', beats: [1, 1.5, 0.5, 1] },
  { id: 'habanera',   label: 'ハバネラ',         description: 'タンゴの源流となるラテン系リズム', beats: [1, 0.5, 0.5, 1, 1] },
  { id: 'dot8th',     label: '付点8分連打',      description: '付点8分+16分を繰り返す切れのあるリズム', beats: [0.75, 0.25, 0.75, 0.25, 0.75, 0.25, 0.75, 0.25] },
  { id: 'whole',      label: '全音符',           description: '1小節を1音で埋める',      beats: [4] },
  { id: 'halves',     label: '2分×2',           description: '2拍ずつの長音2つ',       beats: [2, 2] },
  { id: 'frontload',  label: '前半集中',         description: '細かく始まり長音で締める', beats: [0.5, 0.5, 0.5, 0.5, 2] },
  { id: 'backload',   label: '後半集中',         description: '長音から細かく展開する',  beats: [2, 0.5, 0.5, 0.5, 0.5] },
  { id: 'hemiola',    label: 'ヘミオラ',         description: '3拍子感を4拍子に重ねる', beats: [1.5, 1.5, 1] },
  { id: 'clave',      label: 'クラーベ',         description: 'サルサ/アフロキューバン系リズム', beats: [0.5, 1, 0.5, 1, 1] },
  { id: 'rock',       label: 'ロック',           description: 'ロック/ブルース系の力強いリズム', beats: [1, 0.5, 0.5, 1, 0.5, 0.5] },
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
