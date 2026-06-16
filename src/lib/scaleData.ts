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

export interface Progression { id: string; label: string; degrees: number[]; }
export const PROGRESSIONS: Progression[] = [
  { id: 'kingRoad',   label: '王道進行（IV-V-iii-vi）',   degrees: [3,4,2,5] },
  { id: 'canon',      label: 'カノン進行',                 degrees: [0,4,5,2,3,0,3,4] },
  { id: 'axis',       label: 'ポップパンク（I-V-vi-IV）',  degrees: [0,4,5,3] },
  { id: 'fifties',    label: '50年代進行（I-vi-IV-V）',    degrees: [0,5,3,4] },
  { id: 'twoFiveOne', label: 'ジャズ ii-V-I',              degrees: [1,4,0] },
];
