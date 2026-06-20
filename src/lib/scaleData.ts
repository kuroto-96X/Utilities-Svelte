// src/lib/scaleData.ts
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export interface RootNote { id: string; pc: number; }
export const ROOTS: RootNote[] = [
  { id: 'C', pc: 0 }, { id: 'C#', pc: 1 }, { id: 'D', pc: 2 }, { id: 'D#', pc: 3 },
  { id: 'E', pc: 4 }, { id: 'F', pc: 5 }, { id: 'F#', pc: 6 }, { id: 'G', pc: 7 },
  { id: 'G#', pc: 8 }, { id: 'A', pc: 9 }, { id: 'A#', pc: 10 }, { id: 'B', pc: 11 },
];

export interface ScaleOrChord { id: string; label: string; intervals: number[]; }
export interface Group { group: string; items: ScaleOrChord[]; }

export const SCALE_GROUPS: Group[] = [
  { group: '基本', items: [
    { id: 'major',        label: '長調（メジャー）',        intervals: [0,2,4,5,7,9,11] },
    { id: 'minor',        label: '短調（マイナー）',        intervals: [0,2,3,5,7,8,10] },
    { id: 'majorPenta',   label: 'メジャーペンタトニック',  intervals: [0,2,4,7,9] },
    { id: 'minorPenta',   label: 'マイナーペンタトニック',  intervals: [0,3,5,7,10] },
    { id: 'blues',        label: 'ブルース',                intervals: [0,3,5,6,7,10] },
    { id: 'harmonicMinor',label: 'ハーモニックマイナー',    intervals: [0,2,3,5,7,8,11] },
  ]},
  { group: 'モード', items: [
    { id: 'dorian',      label: 'ドリアン',      intervals: [0,2,3,5,7,9,10] },
    { id: 'phrygian',    label: 'フリジアン',    intervals: [0,1,3,5,7,8,10] },
    { id: 'lydian',      label: 'リディアン',    intervals: [0,2,4,6,7,9,11] },
    { id: 'mixolydian',  label: 'ミクソリディアン', intervals: [0,2,4,5,7,9,10] },
    { id: 'locrian',     label: 'ロクリアン',    intervals: [0,1,3,5,6,8,10] },
  ]},
  { group: '和風・その他', items: [
    { id: 'ritsu',      label: '律音階',          intervals: [0,2,5,7,9] },
    { id: 'miyakobushi',label: '都節音階',        intervals: [0,1,5,7,8] },
    { id: 'ryukyu',     label: '琉球音階（沖縄）', intervals: [0,4,5,7,11] },
    { id: 'wholeTone',  label: 'ホールトーン',    intervals: [0,2,4,6,8,10] },
  ]},
];
export const SCALES: ScaleOrChord[] = SCALE_GROUPS.flatMap(g => g.items);

export const CHORD_GROUPS: Group[] = [
  { group: 'トライアド', items: [
    { id: 'maj', label: 'メジャー',     intervals: [0,4,7] },
    { id: 'min', label: 'マイナー',     intervals: [0,3,7] },
    { id: 'dim', label: 'ディミニッシュ', intervals: [0,3,6] },
    { id: 'aug', label: 'オーグメント', intervals: [0,4,8] },
  ]},
  { group: 'セブンス', items: [
    { id: 'maj7', label: 'メジャー7th',   intervals: [0,4,7,11] },
    { id: 'min7', label: 'マイナー7th',   intervals: [0,3,7,10] },
    { id: 'dom7', label: 'ドミナント7th', intervals: [0,4,7,10] },
  ]},
  { group: 'テンション・サスペンド', items: [
    { id: 'sus2', label: 'sus2',          intervals: [0,2,7] },
    { id: 'sus4', label: 'sus4',          intervals: [0,5,7] },
    { id: 'add9', label: 'add9',          intervals: [0,2,4,7] },
    { id: 'maj9', label: 'メジャー9th',   intervals: [0,2,4,7,11] },
    { id: 'min9', label: 'マイナー9th',   intervals: [0,2,3,7,10] },
    { id: 'dom9', label: 'ドミナント9th', intervals: [0,2,4,7,10] },
  ]},
];
export const CHORDS: ScaleOrChord[] = CHORD_GROUPS.flatMap(g => g.items);

/**
 * 転回形を適用する。inv=1: 第1転回形（最低音=3度）、inv=2: 第2転回形（最低音=5度）など。
 * コードの音数を超えるinvはコードサイズ-1にクランプされる。
 */
export function applyInversion(intervals: number[], inv: number): number[] {
  if (inv === 0) return [...intervals];
  const sorted = [...intervals].sort((a, b) => a - b);
  const count = Math.min(inv, sorted.length - 1);
  for (let i = 0; i < count; i++) sorted[i] += 12;
  return sorted.sort((a, b) => a - b);
}

export function resolveProgressionVoicing(
  intervals: number[],
  smoothVoicing: number[] | null,
  useSmoothedBass: boolean,
  inversion: number,
): number[] {
  if (!useSmoothedBass) return applyInversion(intervals, inversion)
  return intervals.map((interval, i) => interval + (smoothVoicing?.[i] ?? 0))
}

export interface Progression { id: string; label: string; degrees: number[]; smoothVoicings: (number[] | null)[]; }
export const PROGRESSIONS: Progression[] = [
  { id: 'kingRoad',     label: '王道進行（IV-V-iii-vi）',           degrees: [3,4,2,5],         smoothVoicings: [null, null, [12,0,0], null] },
  { id: 'canon',        label: 'カノン進行（I-V-vi-iii-IV-I-IV-V）', degrees: [0,4,5,2,3,0,3,4], smoothVoicings: [[12,12,12], [12,0,0], null, [12,0,0], null, [12,0,0], null, null] },
  { id: 'axis',         label: 'ポップパンク（I-V-vi-IV）',          degrees: [0,4,5,3],         smoothVoicings: [[12,12,12], [12,0,0], null, [12,0,0]] },
  { id: 'fifties',      label: '50年代進行（I-vi-IV-V）',            degrees: [0,5,3,4],         smoothVoicings: [null, [0,0,-12], null, null] },
  { id: 'twoFiveOne',   label: 'ジャズ（ii-V-I）',                   degrees: [1,4,0],           smoothVoicings: [[12,12,12], [12,0,0], [12,12,12]] },
  { id: 'basicLoop',    label: '基本循環（I-IV-I-V）',               degrees: [0,3,0,4],         smoothVoicings: [[12,12,12], null, [12,0,0], [0,0,-12]] },
  { id: 'letItBe',      label: 'Let It Be系（vi-IV-I-V）',           degrees: [5,3,0,4],         smoothVoicings: [null, [12,0,0], [12,12,0], null] },
  { id: 'minorAnthem',  label: 'マイナーアンセム（i-VI-III-VII）',   degrees: [0,5,2,6],         smoothVoicings: [[12,12,12], [12,0,0], [12,12,0], null] },
  { id: 'rockLoop',     label: 'ロック往復（I-V-IV-V）',             degrees: [0,4,3,4],         smoothVoicings: [[12,12,12], [12,0,0], [12,0,0], null] },
  { id: 'jazzCircle',   label: 'ジャズ循環（I-vi-ii-V）',            degrees: [0,5,1,4],         smoothVoicings: [null, [0,0,-12], [12,0,0], null] },
];

// クロマティック（スケール外の音を含む）進行
export interface ChromaticStep {
  semitone: number;    // キールートからの半音オフセット
  intervals: number[]; // コードの構成音（ルートからの半音）
  name: string;        // 理論的なコード名（表示用）
}

export interface ChromaticProgression {
  id: string;
  label: string;
  steps: ChromaticStep[];
  smoothVoicings: (number[] | null)[];
}

export const CHROMATIC_PROGRESSIONS: ChromaticProgression[] = [
  // 3.1 セカンダリードミナント
  {
    id: 'secDom1',
    label: 'セカンダリードミナント（I-V7/V-V-I）',
    steps: [
      { semitone: 0, intervals: [0,4,7],    name: 'I' },
      { semitone: 2, intervals: [0,4,7,10], name: 'V7/V' },
      { semitone: 7, intervals: [0,4,7],    name: 'V' },
      { semitone: 0, intervals: [0,4,7],    name: 'I' },
    ],
    smoothVoicings: [null, null, [0,0,-12], null],
  },
  {
    id: 'secDom2',
    label: 'ブルース進行（I-V7/IV-IV-V7-I）',
    steps: [
      { semitone: 0, intervals: [0,4,7],    name: 'I' },
      { semitone: 0, intervals: [0,4,7,10], name: 'V7/IV' },
      { semitone: 5, intervals: [0,4,7],    name: 'IV' },
      { semitone: 7, intervals: [0,4,7,10], name: 'V7' },
      { semitone: 0, intervals: [0,4,7],    name: 'I' },
    ],
    smoothVoicings: [[12,12,12], [12,12,12,12], [12,0,0], [12,0,0,0], [12,12,12]],
  },
  // 3.2 借用和音
  {
    id: 'borrowedBVII',
    label: '借用bVII（I-bVII-IV）',
    steps: [
      { semitone: 0,  intervals: [0,4,7], name: 'I' },
      { semitone: 10, intervals: [0,4,7], name: 'bVII' },
      { semitone: 5,  intervals: [0,4,7], name: 'IV' },
    ],
    smoothVoicings: [[12,12,12], [0,0,0], [12,0,0]],
  },
  {
    id: 'borrowedIV',
    label: '借用iv（I-iv-I）',
    steps: [
      { semitone: 0, intervals: [0,4,7], name: 'I' },
      { semitone: 5, intervals: [0,3,7], name: 'iv' },
      { semitone: 0, intervals: [0,4,7], name: 'I' },
    ],
    smoothVoicings: [[0,0,0], [0,0,-12], [0,0,0]],
  },
  {
    id: 'borrowedBVI',
    label: 'クロマティックアッセント（vi-bVI-bVII-I）',
    steps: [
      { semitone: 9,  intervals: [0,3,7], name: 'vi' },
      { semitone: 8,  intervals: [0,4,7], name: 'bVI' },
      { semitone: 10, intervals: [0,4,7], name: 'bVII' },
      { semitone: 0,  intervals: [0,4,7], name: 'I' },
    ],
    smoothVoicings: [null, null, null, [12,12,12]],
  },
  // 3.3 トライトーン代理
  {
    id: 'tritone',
    label: 'トライトーン代理（ii7-bII7-Imaj7）',
    steps: [
      { semitone: 2, intervals: [0,3,7,10], name: 'ii7' },
      { semitone: 1, intervals: [0,4,7,10], name: 'bII7' },
      { semitone: 0, intervals: [0,4,7,11], name: 'Imaj7' },
    ],
    smoothVoicings: [null, null, null],
  },
  // 3.4 パッシングディミニッシュ
  {
    id: 'passingDim',
    label: 'パッシングディミニッシュ（I-#I°7-ii-V-I）',
    steps: [
      { semitone: 0, intervals: [0,4,7],    name: 'I' },
      { semitone: 1, intervals: [0,3,6,9],  name: '#I°7' },
      { semitone: 2, intervals: [0,3,7],    name: 'ii' },
      { semitone: 7, intervals: [0,4,7,10], name: 'V7' },
      { semitone: 0, intervals: [0,4,7],    name: 'I' },
    ],
    smoothVoicings: [null, null, null, [0,0,-12], null],
  },
  // 3.5 ナポリの6度
  {
    id: 'neapolitan',
    label: 'ナポリの6度（i-iv-bII-V-i）',
    steps: [
      { semitone: 0, intervals: [0,3,7], name: 'i' },
      { semitone: 5, intervals: [0,3,7], name: 'iv' },
      { semitone: 1, intervals: [0,4,7], name: 'bII' },
      { semitone: 7, intervals: [0,4,7], name: 'V' },
      { semitone: 0, intervals: [0,3,7], name: 'i' },
    ],
    smoothVoicings: [[12,12,12], [12,12,0], [12,12,12], [12,0,0], [12,12,12]],
  },
];

// テンション解決系（同一ルート・コード質のみ変化）
export const TENSION_PROGRESSIONS: ChromaticProgression[] = [
  {
    id: 'sus4ToMaj',
    label: 'sus4 → メジャー',
    steps: [
      { semitone: 0, intervals: [0,5,7],       name: 'sus4' },
      { semitone: 0, intervals: [0,4,7],       name: 'I' },
    ],
    smoothVoicings: [null, null],
  },
  {
    id: 'sus2ToMaj',
    label: 'sus2 → メジャー',
    steps: [
      { semitone: 0, intervals: [0,2,7],       name: 'sus2' },
      { semitone: 0, intervals: [0,4,7],       name: 'I' },
    ],
    smoothVoicings: [null, null],
  },
  {
    id: 'sus4Sus2ToMaj',
    label: 'sus4 → sus2 → メジャー',
    steps: [
      { semitone: 0, intervals: [0,5,7],       name: 'sus4' },
      { semitone: 0, intervals: [0,2,7],       name: 'sus2' },
      { semitone: 0, intervals: [0,4,7],       name: 'I' },
    ],
    smoothVoicings: [null, null, null],
  },
  {
    id: 'add9ToMaj',
    label: 'add9 → メジャー',
    steps: [
      { semitone: 0, intervals: [0,2,4,7],     name: 'add9' },
      { semitone: 0, intervals: [0,4,7],       name: 'I' },
    ],
    smoothVoicings: [null, null],
  },
  {
    id: 'minTension',
    label: 'マイナー → m7 → m9（テンション積み）',
    steps: [
      { semitone: 0, intervals: [0,3,7],       name: 'im' },
      { semitone: 0, intervals: [0,3,7,10],    name: 'im7' },
      { semitone: 0, intervals: [0,2,3,7,10],  name: 'im9' },
    ],
    smoothVoicings: [null, null, null],
  },
];
