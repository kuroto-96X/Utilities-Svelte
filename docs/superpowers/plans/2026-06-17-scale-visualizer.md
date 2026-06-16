# スケール / コードビジュアライザー 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ルート音・スケール/コードを選択して鍵盤で構成音を確認し、音を鳴らせる音楽理論ツールを実装する。

**Architecture:** `+page.svelte` で全状態を集中管理し、`addPlayingPc`/`removePlayingPc` を子コンポーネントに prop で渡す。鍵盤タップは押下中だけ音が鳴る（pointerdown/up）。状態変更で進行ループが自動停止。

**Tech Stack:** SvelteKit 2 + Svelte 5 runes（$state/$derived/$effect/$props/$bindable）、Tailwind CSS v3、Web Audio API、Vitest、TypeScript

---

## ファイル構成

| ファイル | 新規/変更 | 役割 |
|---|---|---|
| `src/lib/scaleData.ts` | 新規 | スケール/コード/進行の定義データ |
| `src/lib/scaleData.test.ts` | 新規 | scaleData のユニットテスト |
| `src/lib/pianoLayout.ts` | 新規 | 鍵盤ウィンドウ計算アルゴリズム |
| `src/lib/pianoLayout.test.ts` | 新規 | pianoLayout のユニットテスト |
| `src/lib/diatonicChords.ts` | 新規 | ダイアトニックコード自動生成 |
| `src/lib/diatonicChords.test.ts` | 新規 | diatonicChords のユニットテスト |
| `src/lib/audioEngine.ts` | 新規 | AudioContext管理・単音再生・押下中再生 |
| `src/lib/audioEngine.test.ts` | 新規 | freqFromMidi のユニットテスト |
| `src/lib/components/PianoKeyboard.svelte` | 新規 | 鍵盤SVG本体 |
| `src/lib/components/RootSelector.svelte` | 新規 | ルート音選択ボタン |
| `src/lib/components/ScaleChordSelector.svelte` | 新規 | モード切替＋グループ選択 |
| `src/lib/components/BpmSlider.svelte` | 新規 | BPMスライダー |
| `src/lib/components/DiatonicChordPanel.svelte` | 新規 | ダイアトニックコードタップ再生 |
| `src/lib/components/ProgressionPlayer.svelte` | 新規 | コード進行ループ再生 |
| `src/lib/components/MelodyGenerator.svelte` | 新規 | ランダムメロディ生成＆再生 |
| `src/routes/scale-visualizer/+page.svelte` | 新規 | メインページ |
| `src/lib/site.ts` | 変更 | ナビゲーションに追加 |

---

## Task 1: scaleData.ts — スケール/コード/進行データ定義

**Files:**
- Create: `src/lib/scaleData.ts`
- Create: `src/lib/scaleData.test.ts`

- [ ] **Step 1: scaleData.ts を作成**

```typescript
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
```

- [ ] **Step 2: テストを書く**

```typescript
// src/lib/scaleData.test.ts
import { describe, test, expect } from 'vitest'
import { ROOTS, SCALE_GROUPS, SCALES, CHORD_GROUPS, CHORDS, PROGRESSIONS } from './scaleData'

describe('ROOTS', () => {
  test('12個のルート音がある', () => {
    expect(ROOTS).toHaveLength(12)
  })
  test('pcが0から11まで過不足なく存在する', () => {
    const pcs = ROOTS.map(r => r.pc).sort((a, b) => a - b)
    expect(pcs).toEqual([0,1,2,3,4,5,6,7,8,9,10,11])
  })
})

describe('SCALE_GROUPS / SCALES', () => {
  test('グループが3つある（基本・モード・和風その他）', () => {
    expect(SCALE_GROUPS).toHaveLength(3)
  })
  test('スケールが合計15種', () => {
    expect(SCALES).toHaveLength(15)
  })
  test('全スケールのintervalsは0から始まる', () => {
    SCALES.forEach(s => expect(s.intervals[0]).toBe(0))
  })
  test('major は [0,2,4,5,7,9,11]', () => {
    const major = SCALES.find(s => s.id === 'major')!
    expect(major.intervals).toEqual([0,2,4,5,7,9,11])
  })
})

describe('CHORD_GROUPS / CHORDS', () => {
  test('グループが3つある（トライアド・セブンス・テンション）', () => {
    expect(CHORD_GROUPS).toHaveLength(3)
  })
  test('コードが合計13種', () => {
    expect(CHORDS).toHaveLength(13)
  })
  test('全コードのintervalsは0から始まる', () => {
    CHORDS.forEach(c => expect(c.intervals[0]).toBe(0))
  })
})

describe('PROGRESSIONS', () => {
  test('5種類のプリセットがある', () => {
    expect(PROGRESSIONS).toHaveLength(5)
  })
  test('全degreesは0〜6の範囲', () => {
    PROGRESSIONS.forEach(p => {
      p.degrees.forEach(d => {
        expect(d).toBeGreaterThanOrEqual(0)
        expect(d).toBeLessThanOrEqual(6)
      })
    })
  })
})
```

- [ ] **Step 3: テストを実行して全件パスを確認**

```bash
npx vitest run src/lib/scaleData.test.ts
```

Expected: 8 tests pass

- [ ] **Step 4: コミット**

```bash
git add src/lib/scaleData.ts src/lib/scaleData.test.ts
git commit -m "feat: scaleData.tsを追加（スケール/コード/進行データ定義）"
```

---

## Task 2: pianoLayout.ts — 鍵盤ウィンドウアルゴリズム

**Files:**
- Create: `src/lib/pianoLayout.ts`
- Create: `src/lib/pianoLayout.test.ts`

- [ ] **Step 1: テストを書く**

```typescript
// src/lib/pianoLayout.test.ts
import { describe, test, expect } from 'vitest'
import { buildKeyboardWindow, WHITE_W, WHITE_H, BLACK_W, BLACK_H, TOTAL_WIDTH } from './pianoLayout'

describe('buildKeyboardWindow(0) — C基準', () => {
  const { whiteKeys, blackKeys } = buildKeyboardWindow(0)

  test('白鍵7個・黒鍵5個', () => {
    expect(whiteKeys).toHaveLength(7)
    expect(blackKeys).toHaveLength(5)
  })

  test('白鍵のpcが C,D,E,F,G,A,B の順', () => {
    expect(whiteKeys.map(k => k.pc)).toEqual([0,2,4,5,7,9,11])
  })

  test('黒鍵のpcが C#,D#,F#,G#,A# の順', () => {
    expect(blackKeys.map(k => k.pc)).toEqual([1,3,6,8,10])
  })

  test('白鍵のx座標が0から始まりWHITE_W刻みで増える', () => {
    whiteKeys.forEach((k, i) => expect(k.x).toBe(i * WHITE_W))
  })

  test('最後の白鍵右端がTOTAL_WIDTH', () => {
    const last = whiteKeys[whiteKeys.length - 1]
    expect(last.x + WHITE_W).toBe(TOTAL_WIDTH)
  })

  test('windowIndexが0〜11で全12音を網羅', () => {
    const all = [...whiteKeys, ...blackKeys].sort((a, b) => a.windowIndex - b.windowIndex)
    expect(all.map(k => k.windowIndex)).toEqual([0,1,2,3,4,5,6,7,8,9,10,11])
  })
})

describe('buildKeyboardWindow(2) — D基準', () => {
  const { whiteKeys, blackKeys } = buildKeyboardWindow(2)

  test('白鍵7個・黒鍵5個（Dから始まっても変わらない）', () => {
    expect(whiteKeys).toHaveLength(7)
    expect(blackKeys).toHaveLength(5)
  })

  test('先頭白鍵のpcはD(2)', () => {
    const sorted = whiteKeys.sort((a, b) => a.windowIndex - b.windowIndex)
    expect(sorted[0].pc).toBe(2)
  })

  test('白鍵のx座標は0から始まる', () => {
    const minX = Math.min(...whiteKeys.map(k => k.x))
    expect(minX).toBe(0)
  })
})

describe('定数', () => {
  test('TOTAL_WIDTH = 7 * WHITE_W', () => {
    expect(TOTAL_WIDTH).toBe(7 * WHITE_W)
  })
  test('WHITE_H, BLACK_H が正の数', () => {
    expect(WHITE_H).toBeGreaterThan(0)
    expect(BLACK_H).toBeGreaterThan(0)
    expect(BLACK_H).toBeLessThan(WHITE_H)
  })
})
```

- [ ] **Step 2: テストを実行してFAILを確認**

```bash
npx vitest run src/lib/pianoLayout.test.ts
```

Expected: FAIL (ファイルが存在しない)

- [ ] **Step 3: pianoLayout.ts を実装**

```typescript
// src/lib/pianoLayout.ts
type KeyType = 'white' | 'black';

const PC_INFO: Record<number, { type: KeyType; whiteIndex?: number; afterWhiteIndex?: number }> = {
  0:  { type: 'white', whiteIndex: 0 },
  1:  { type: 'black', afterWhiteIndex: 0 },
  2:  { type: 'white', whiteIndex: 1 },
  3:  { type: 'black', afterWhiteIndex: 1 },
  4:  { type: 'white', whiteIndex: 2 },
  5:  { type: 'white', whiteIndex: 3 },
  6:  { type: 'black', afterWhiteIndex: 3 },
  7:  { type: 'white', whiteIndex: 4 },
  8:  { type: 'black', afterWhiteIndex: 4 },
  9:  { type: 'white', whiteIndex: 5 },
  10: { type: 'black', afterWhiteIndex: 5 },
  11: { type: 'white', whiteIndex: 6 },
};

export const WHITE_W = 48;
export const WHITE_H = 180;
export const BLACK_W = 28;
export const BLACK_H = 112;
export const TOTAL_WIDTH = 7 * WHITE_W;

export interface LayoutKey { pc: number; windowIndex: number; x: number; }

export function buildKeyboardWindow(startSemitone: number): { whiteKeys: LayoutKey[]; blackKeys: LayoutKey[] } {
  const items = Array.from({ length: 12 }, (_, i) => {
    const s = startSemitone + i;
    const oct = Math.floor(s / 12);
    const pc = ((s % 12) + 12) % 12;
    const info = PC_INFO[pc];
    return {
      windowIndex: i,
      pc,
      type: info.type,
      absWhiteIndex: info.type === 'white' ? oct * 7 + info.whiteIndex! : null,
      absAnchorIndex: info.type === 'black' ? oct * 7 + info.afterWhiteIndex! : null,
    };
  });

  const minAbs = Math.min(...items.filter(it => it.type === 'white').map(it => it.absWhiteIndex!));

  const whiteKeys = items
    .filter(it => it.type === 'white')
    .map(it => ({ pc: it.pc, windowIndex: it.windowIndex, x: (it.absWhiteIndex! - minAbs) * WHITE_W }));

  const blackKeys = items
    .filter(it => it.type === 'black')
    .map(it => ({ pc: it.pc, windowIndex: it.windowIndex, x: (it.absAnchorIndex! - minAbs + 1) * WHITE_W - BLACK_W / 2 }));

  return { whiteKeys, blackKeys };
}
```

- [ ] **Step 4: テストを実行して全件パスを確認**

```bash
npx vitest run src/lib/pianoLayout.test.ts
```

Expected: 10 tests pass

- [ ] **Step 5: コミット**

```bash
git add src/lib/pianoLayout.ts src/lib/pianoLayout.test.ts
git commit -m "feat: pianoLayout.tsを追加（鍵盤ウィンドウ計算アルゴリズム）"
```

---

## Task 3: diatonicChords.ts — ダイアトニックコード自動生成

**Files:**
- Create: `src/lib/diatonicChords.ts`
- Create: `src/lib/diatonicChords.test.ts`

- [ ] **Step 1: テストを書く**

```typescript
// src/lib/diatonicChords.test.ts
import { describe, test, expect } from 'vitest'
import { buildDiatonicChords } from './diatonicChords'

describe('buildDiatonicChords', () => {
  test('7音以外はnullを返す（ペンタトニック）', () => {
    expect(buildDiatonicChords([0,2,4,7,9], 0)).toBeNull()
  })

  test('7音以外はnullを返す（ブルース6音）', () => {
    expect(buildDiatonicChords([0,3,5,6,7,10], 0)).toBeNull()
  })

  test('Cメジャー: I, ii, iii, IV, V, vi, vii°', () => {
    const chords = buildDiatonicChords([0,2,4,5,7,9,11], 0)!
    expect(chords).toHaveLength(7)
    expect(chords.map(c => c.roman)).toEqual(['I','ii','iii','IV','V','vi','vii°'])
  })

  test('Cメジャー: 各コードの quality', () => {
    const chords = buildDiatonicChords([0,2,4,5,7,9,11], 0)!
    expect(chords[0].quality).toBe('maj')
    expect(chords[1].quality).toBe('min')
    expect(chords[6].quality).toBe('dim')
  })

  test('Cメジャー: 各コードのrootPc', () => {
    const chords = buildDiatonicChords([0,2,4,5,7,9,11], 0)!
    expect(chords.map(c => c.rootPc)).toEqual([0,2,4,5,7,9,11])
  })

  test('Aナチュラルマイナー (rootPc=9): i, ii°, III, iv, v, VI, VII', () => {
    const chords = buildDiatonicChords([0,2,3,5,7,8,10], 9)!
    expect(chords.map(c => c.roman)).toEqual(['i','ii°','III','iv','v','VI','VII'])
  })

  test('ハーモニックマイナーでaugが出る', () => {
    // harmonic minor [0,2,3,5,7,8,11] — III度はaugmented
    const chords = buildDiatonicChords([0,2,3,5,7,8,11], 0)!
    expect(chords[2].roman).toBe('III+')
    expect(chords[2].quality).toBe('aug')
  })

  test('各コードのintervalsは3要素', () => {
    const chords = buildDiatonicChords([0,2,4,5,7,9,11], 0)!
    chords.forEach(c => expect(c.intervals).toHaveLength(3))
  })
})
```

- [ ] **Step 2: テストを実行してFAILを確認**

```bash
npx vitest run src/lib/diatonicChords.test.ts
```

Expected: FAIL

- [ ] **Step 3: diatonicChords.ts を実装**

```typescript
// src/lib/diatonicChords.ts
const ROMAN = ['I','II','III','IV','V','VI','VII'];

function romanFor(thirdSemi: number, fifthSemi: number, idx: number): { base: string; quality: 'maj'|'min'|'dim'|'aug'|'other' } {
  let base = ROMAN[idx];
  let quality: 'maj'|'min'|'dim'|'aug'|'other' = 'other';
  if      (thirdSemi === 4 && fifthSemi === 7) quality = 'maj';
  else if (thirdSemi === 3 && fifthSemi === 7) quality = 'min';
  else if (thirdSemi === 3 && fifthSemi === 6) quality = 'dim';
  else if (thirdSemi === 4 && fifthSemi === 8) quality = 'aug';
  if (quality === 'min' || quality === 'dim') base = base.toLowerCase();
  if (quality === 'dim') base += '°';
  if (quality === 'aug') base += '+';
  return { base, quality };
}

export interface DiatonicChord {
  degreeIndex: number;
  roman: string;
  quality: string;
  rootPc: number;
  intervals: [number, number, number];
}

export function buildDiatonicChords(intervals: number[], rootPc: number): DiatonicChord[] | null {
  if (intervals.length !== 7) return null;
  const extended = [...intervals, ...intervals.map(v => v + 12)];
  return intervals.map((deg, d) => {
    const thirdSemi = extended[d + 2] - extended[d];
    const fifthSemi = extended[d + 4] - extended[d];
    const { base, quality } = romanFor(thirdSemi, fifthSemi, d);
    return {
      degreeIndex: d,
      roman: base,
      quality,
      rootPc: (rootPc + deg) % 12,
      intervals: [0, thirdSemi, fifthSemi],
    };
  });
}
```

- [ ] **Step 4: テストを実行して全件パスを確認**

```bash
npx vitest run src/lib/diatonicChords.test.ts
```

Expected: 8 tests pass

- [ ] **Step 5: コミット**

```bash
git add src/lib/diatonicChords.ts src/lib/diatonicChords.test.ts
git commit -m "feat: diatonicChords.tsを追加（ダイアトニックコード自動生成）"
```

---

## Task 4: audioEngine.ts — AudioContext管理・再生

**Files:**
- Create: `src/lib/audioEngine.ts`
- Create: `src/lib/audioEngine.test.ts`

- [ ] **Step 1: freqFromMidi のテストを書く**

```typescript
// src/lib/audioEngine.test.ts
import { describe, test, expect } from 'vitest'
import { freqFromMidi } from './audioEngine'

describe('freqFromMidi', () => {
  test('MIDI 69 は 440 Hz (A4)', () => {
    expect(freqFromMidi(69)).toBeCloseTo(440, 5)
  })
  test('MIDI 81 は 880 Hz (A5 = 1オクターブ上)', () => {
    expect(freqFromMidi(81)).toBeCloseTo(880, 5)
  })
  test('MIDI 57 は 220 Hz (A3 = 1オクターブ下)', () => {
    expect(freqFromMidi(57)).toBeCloseTo(220, 5)
  })
  test('MIDI 60 は約 261.63 Hz (C4)', () => {
    expect(freqFromMidi(60)).toBeCloseTo(261.626, 2)
  })
})
```

- [ ] **Step 2: テストを実行してFAILを確認**

```bash
npx vitest run src/lib/audioEngine.test.ts
```

Expected: FAIL

- [ ] **Step 3: audioEngine.ts を実装**

```typescript
// src/lib/audioEngine.ts
let ctx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function freqFromMidi(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function playNoteAt(audioCtx: AudioContext, midi: number, duration: number, startTime: number): void {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const attack = Math.min(0.012, duration * 0.3);
  osc.type = 'triangle';
  osc.frequency.value = freqFromMidi(midi);
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(0.2, startTime + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

export function startNote(midi: number): () => void {
  const audioCtx = getAudioContext();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = freqFromMidi(midi);
  const now = audioCtx.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.2, now + 0.012);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(now);
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    const t = audioCtx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    osc.stop(t + 0.06);
  };
}
```

- [ ] **Step 4: テストを実行して全件パスを確認**

```bash
npx vitest run src/lib/audioEngine.test.ts
```

Expected: 4 tests pass

- [ ] **Step 5: コミット**

```bash
git add src/lib/audioEngine.ts src/lib/audioEngine.test.ts
git commit -m "feat: audioEngine.tsを追加（AudioContext管理・単音再生・押下中再生）"
```

---

## Task 5: PianoKeyboard.svelte — 鍵盤SVGコンポーネント

**Files:**
- Create: `src/lib/components/PianoKeyboard.svelte`

- [ ] **Step 1: PianoKeyboard.svelte を作成**

```svelte
<!-- src/lib/components/PianoKeyboard.svelte -->
<script lang="ts">
  import type { LayoutKey } from '$lib/pianoLayout';
  import { WHITE_W, WHITE_H, BLACK_W, BLACK_H, TOTAL_WIDTH } from '$lib/pianoLayout';
  import { startNote } from '$lib/audioEngine';

  let {
    whiteKeys,
    blackKeys,
    intervals,
    rootPc,
    playingPcs,
    addPlayingPc,
    removePlayingPc,
  }: {
    whiteKeys: LayoutKey[];
    blackKeys: LayoutKey[];
    intervals: number[];
    rootPc: number;
    playingPcs: Set<number>;
    addPlayingPc: (pc: number) => void;
    removePlayingPc: (pc: number) => void;
  } = $props();

  const scalePcs = $derived(new Set(intervals.map(i => (rootPc + i) % 12)));

  const stopFns = new Map<number, () => void>();

  function handlePointerDown(key: LayoutKey) {
    addPlayingPc(key.pc);
    const stop = startNote(60 + key.windowIndex);
    stopFns.set(key.windowIndex, stop);
  }

  function handlePointerUp(key: LayoutKey) {
    const stop = stopFns.get(key.windowIndex);
    if (stop) { stop(); stopFns.delete(key.windowIndex); }
    removePlayingPc(key.pc);
  }
</script>

<svg
  viewBox="0 0 {TOTAL_WIDTH} {WHITE_H}"
  width={TOTAL_WIDTH}
  height={WHITE_H}
  style="touch-action: none; user-select: none; display: block;"
>
  <!-- 白鍵ベース -->
  {#each whiteKeys as key (key.windowIndex)}
    {@const inScale = scalePcs.has(key.pc)}
    {@const isRoot = key.pc === rootPc}
    <rect
      x={key.x} y={0}
      width={WHITE_W - 1} height={WHITE_H}
      fill="#f9fafb"
      stroke={inScale ? '#14b8a6' : '#d1d5db'}
      stroke-width={inScale ? 2 : 1}
      opacity={inScale ? 1 : 0.32}
      rx={2}
    />
    {#if isRoot}
      <circle
        cx={key.x + (WHITE_W - 1) / 2}
        cy={WHITE_H - 12}
        r={5}
        fill="#14b8a6"
      />
    {/if}
  {/each}

  <!-- 黒鍵ベース -->
  {#each blackKeys as key (key.windowIndex)}
    {@const inScale = scalePcs.has(key.pc)}
    {@const isRoot = key.pc === rootPc}
    <rect
      x={key.x} y={0}
      width={BLACK_W} height={BLACK_H}
      fill="#111827"
      stroke={inScale ? '#14b8a6' : '#374151'}
      stroke-width={inScale ? 2 : 1}
      opacity={inScale ? 1 : 0.32}
      rx={2}
    />
    {#if isRoot}
      <circle
        cx={key.x + BLACK_W / 2}
        cy={BLACK_H - 10}
        r={4}
        fill="#14b8a6"
      />
    {/if}
  {/each}

  <!-- アクティブリング（最前面・opacity影響を受けない） -->
  {#each whiteKeys as key (key.windowIndex)}
    {#if playingPcs.has(key.pc)}
      <rect
        x={key.x + 2} y={2}
        width={WHITE_W - 5} height={WHITE_H - 4}
        fill="none"
        stroke="#14b8a6"
        stroke-width={3}
        rx={2}
      />
    {/if}
  {/each}
  {#each blackKeys as key (key.windowIndex)}
    {#if playingPcs.has(key.pc)}
      <rect
        x={key.x + 2} y={2}
        width={BLACK_W - 4} height={BLACK_H - 4}
        fill="none"
        stroke="#14b8a6"
        stroke-width={3}
        rx={2}
      />
    {/if}
  {/each}

  <!-- ポインターターゲット（透明）白鍵→黒鍵の順で黒鍵が前面 -->
  {#each whiteKeys as key (key.windowIndex)}
    <rect
      x={key.x} y={0}
      width={WHITE_W} height={WHITE_H}
      fill="transparent"
      style="cursor: pointer;"
      onpointerdown={() => handlePointerDown(key)}
      onpointerup={() => handlePointerUp(key)}
      onpointerleave={() => handlePointerUp(key)}
    />
  {/each}
  {#each blackKeys as key (key.windowIndex)}
    <rect
      x={key.x} y={0}
      width={BLACK_W} height={BLACK_H}
      fill="transparent"
      style="cursor: pointer;"
      onpointerdown={() => handlePointerDown(key)}
      onpointerup={() => handlePointerUp(key)}
      onpointerleave={() => handlePointerUp(key)}
    />
  {/each}
</svg>
```

- [ ] **Step 2: コミット**

```bash
git add src/lib/components/PianoKeyboard.svelte
git commit -m "feat: PianoKeyboard.svelteを追加（鍵盤SVGコンポーネント）"
```

---

## Task 6: RootSelector.svelte と ScaleChordSelector.svelte

**Files:**
- Create: `src/lib/components/RootSelector.svelte`
- Create: `src/lib/components/ScaleChordSelector.svelte`

- [ ] **Step 1: RootSelector.svelte を作成**

```svelte
<!-- src/lib/components/RootSelector.svelte -->
<script lang="ts">
  import { ROOTS } from '$lib/scaleData';
  let { rootId = $bindable() }: { rootId: string } = $props();
</script>

<div>
  <p class="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">ルート音</p>
  <div class="grid grid-cols-3 gap-1">
    {#each ROOTS as root}
      <button
        class="py-1 text-sm rounded font-mono
          {rootId === root.id
            ? 'bg-teal-600 text-white'
            : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}"
        onclick={() => (rootId = root.id)}
      >
        {root.id}
      </button>
    {/each}
  </div>
</div>
```

- [ ] **Step 2: ScaleChordSelector.svelte を作成**

```svelte
<!-- src/lib/components/ScaleChordSelector.svelte -->
<script lang="ts">
  import { SCALE_GROUPS, CHORD_GROUPS } from '$lib/scaleData';
  let {
    mode = $bindable(),
    scaleId = $bindable(),
    chordId = $bindable(),
  }: { mode: 'scale' | 'chord'; scaleId: string; chordId: string } = $props();
</script>

<div>
  <!-- モード切替タブ -->
  <div class="flex gap-1 mb-3">
    <button
      class="flex-1 py-1.5 text-sm rounded
        {mode === 'scale' ? 'bg-teal-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}"
      onclick={() => (mode = 'scale')}
    >スケール</button>
    <button
      class="flex-1 py-1.5 text-sm rounded
        {mode === 'chord' ? 'bg-teal-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}"
      onclick={() => (mode = 'chord')}
    >コード</button>
  </div>

  <!-- スケールリスト -->
  {#if mode === 'scale'}
    {#each SCALE_GROUPS as group}
      <div class="mb-3">
        <p class="text-xs text-gray-500 mb-1">{group.group}</p>
        {#each group.items as item}
          <button
            class="w-full text-left px-2 py-1 text-sm rounded mb-0.5
              {scaleId === item.id
                ? 'bg-teal-600 text-white'
                : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}"
            onclick={() => (scaleId = item.id)}
          >
            {item.label}
          </button>
        {/each}
      </div>
    {/each}
  {:else}
    {#each CHORD_GROUPS as group}
      <div class="mb-3">
        <p class="text-xs text-gray-500 mb-1">{group.group}</p>
        {#each group.items as item}
          <button
            class="w-full text-left px-2 py-1 text-sm rounded mb-0.5
              {chordId === item.id
                ? 'bg-teal-600 text-white'
                : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}"
            onclick={() => (chordId = item.id)}
          >
            {item.label}
          </button>
        {/each}
      </div>
    {/each}
  {/if}
</div>
```

- [ ] **Step 3: コミット**

```bash
git add src/lib/components/RootSelector.svelte src/lib/components/ScaleChordSelector.svelte
git commit -m "feat: RootSelectorとScaleChordSelectorコンポーネントを追加"
```

---

## Task 7: BpmSlider.svelte — BPMスライダー

**Files:**
- Create: `src/lib/components/BpmSlider.svelte`

- [ ] **Step 1: BpmSlider.svelte を作成**

```svelte
<!-- src/lib/components/BpmSlider.svelte -->
<script lang="ts">
  import { MIN_BPM, MAX_BPM, clampBpm } from '$lib/noteDuration';
  let { bpm = $bindable() }: { bpm: number } = $props();

  const sliderPercent = $derived(((bpm - MIN_BPM) / (MAX_BPM - MIN_BPM)) * 100);
</script>

<div class="flex items-center gap-3">
  <span class="text-xs text-gray-400 w-8 flex-shrink-0">BPM</span>
  <input
    type="range"
    min={MIN_BPM}
    max={MAX_BPM}
    value={bpm}
    oninput={(e) => (bpm = clampBpm(Number((e.target as HTMLInputElement).value)))}
    class="flex-1 h-2 rounded-full appearance-none cursor-pointer slider-custom"
    style="background: linear-gradient(to right, #14b8a6 0%, #14b8a6 {sliderPercent}%, #4b5563 {sliderPercent}%, #4b5563 100%)"
  />
  <span class="text-sm font-mono w-10 text-right flex-shrink-0">{bpm}</span>
</div>

<style>
  .slider-custom::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #14b8a6;
    cursor: pointer;
  }
  .slider-custom::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #14b8a6;
    cursor: pointer;
    border: none;
  }
</style>
```

- [ ] **Step 2: コミット**

```bash
git add src/lib/components/BpmSlider.svelte
git commit -m "feat: BpmSliderコンポーネントを追加"
```

---

## Task 8: +page.svelte — メインページ（状態管理＋メイン再生）

**Files:**
- Create: `src/routes/scale-visualizer/+page.svelte`

- [ ] **Step 1: ディレクトリを作成して +page.svelte を実装**

```svelte
<!-- src/routes/scale-visualizer/+page.svelte -->
<script lang="ts">
  import { ROOTS, SCALES, CHORDS } from '$lib/scaleData';
  import { buildKeyboardWindow } from '$lib/pianoLayout';
  import { buildDiatonicChords } from '$lib/diatonicChords';
  import { DEFAULT_BPM } from '$lib/noteDuration';
  import { getAudioContext, playNoteAt } from '$lib/audioEngine';
  import RootSelector from '$lib/components/RootSelector.svelte';
  import ScaleChordSelector from '$lib/components/ScaleChordSelector.svelte';
  import PianoKeyboard from '$lib/components/PianoKeyboard.svelte';
  import BpmSlider from '$lib/components/BpmSlider.svelte';

  let rootId = $state('C');
  let mode = $state<'scale' | 'chord'>('scale');
  let scaleId = $state('major');
  let chordId = $state('maj');
  let bpm = $state(DEFAULT_BPM);
  let anchorToRoot = $state(false);
  let playingPcs = $state(new Set<number>());

  let progressionPlayerRef: { stop: () => void } | null = null;

  const root = $derived(ROOTS.find(r => r.id === rootId)!);
  const currentIntervals = $derived(
    mode === 'scale'
      ? SCALES.find(s => s.id === scaleId)!.intervals
      : CHORDS.find(c => c.id === chordId)!.intervals
  );
  const diatonicChords = $derived(buildDiatonicChords(currentIntervals, root.pc));
  const keyboard = $derived(buildKeyboardWindow(anchorToRoot ? root.pc : 0));

  function addPlayingPc(pc: number) { playingPcs = new Set(playingPcs).add(pc); }
  function removePlayingPc(pc: number) { const s = new Set(playingPcs); s.delete(pc); playingPcs = s; }

  $effect(() => {
    rootId; scaleId; chordId; mode; bpm;
    progressionPlayerRef?.stop();
  });

  function playMain() {
    progressionPlayerRef?.stop();
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    if (mode === 'chord') {
      const duration = (60 / bpm) * 2;
      currentIntervals.forEach(interval => {
        const midi = 60 + root.pc + interval;
        const pc = (root.pc + interval) % 12;
        playNoteAt(ctx, midi, duration, now);
        addPlayingPc(pc);
        setTimeout(() => removePlayingPc(pc), duration * 1000);
      });
    } else {
      const seq = [...currentIntervals, ...currentIntervals.slice(0, -1).reverse()];
      const SPACING = (60 / bpm) * 0.5;
      const duration = SPACING * 0.85;
      seq.forEach((interval, i) => {
        const midi = 60 + root.pc + interval;
        const pc = (root.pc + interval) % 12;
        const startTime = now + i * SPACING;
        playNoteAt(ctx, midi, duration, startTime);
        setTimeout(() => addPlayingPc(pc), i * SPACING * 1000);
        setTimeout(() => removePlayingPc(pc), (i * SPACING + duration) * 1000);
      });
    }
  }
</script>

<div class="min-h-screen bg-gray-900 text-gray-100 p-4">
  <div class="ad-slot--top"></div>
  <h1 class="text-2xl font-bold mb-4">スケール / コードビジュアライザー</h1>

  <div class="flex flex-col md:flex-row gap-4">
    <!-- 左サイドバー -->
    <div class="md:w-52 flex-shrink-0 space-y-4">
      <RootSelector bind:rootId />
      <ScaleChordSelector bind:mode bind:scaleId bind:chordId />
    </div>

    <!-- メインエリア -->
    <div class="flex-1 min-w-0 space-y-4">
      <!-- 鍵盤 -->
      <div class="overflow-x-auto">
        <PianoKeyboard
          whiteKeys={keyboard.whiteKeys}
          blackKeys={keyboard.blackKeys}
          intervals={currentIntervals}
          rootPc={root.pc}
          {playingPcs}
          {addPlayingPc}
          {removePlayingPc}
        />
      </div>

      <!-- コントロール行 -->
      <div class="flex flex-wrap items-center gap-3">
        <button
          class="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm rounded font-medium flex-shrink-0"
          onclick={playMain}
        >
          ▶ {mode === 'scale' ? 'スケール往復' : 'コード再生'}
        </button>
        <div class="flex-1 min-w-40">
          <BpmSlider bind:bpm />
        </div>
        <div class="flex items-center gap-1 text-xs flex-shrink-0">
          <button
            class="px-2 py-1 rounded {!anchorToRoot ? 'bg-teal-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}"
            onclick={() => (anchorToRoot = false)}
          >C基準</button>
          <button
            class="px-2 py-1 rounded {anchorToRoot ? 'bg-teal-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}"
            onclick={() => (anchorToRoot = true)}
          >ルート基準</button>
        </div>
      </div>

      <div class="ad-slot--in-content"></div>

      <!-- 以降のTaskで追加するコンポーネントのプレースホルダー -->
      <!-- DiatonicChordPanel, ProgressionPlayer, MelodyGenerator -->
    </div>
  </div>
</div>
```

- [ ] **Step 2: ビルドが通ることを確認**

```bash
npm run build
```

Expected: ビルドエラーなし

- [ ] **Step 3: 開発サーバーで動作確認**

```bash
npm run dev
```

http://localhost:5173/scale-visualizer を開いて確認：
- 左サイドバーにルート音グリッドとスケール/コードリストが表示される
- 鍵盤SVGが表示され、Cメジャーのスケール音（白鍵）がティール枠でハイライトされている
- 非構成音がグレーアウトしている
- 鍵盤を押すと音が鳴り（押している間）、離すと止まる
- C音（ルート）の下にティールの丸マーカーが表示される
- 「スケール往復」ボタンを押すと上行・下行でスケールが鳴る
- BPMスライダーが動作し、「ルート基準」切替で鍵盤の窓がずれる

- [ ] **Step 4: コミット**

```bash
git add src/routes/scale-visualizer/+page.svelte
git commit -m "feat: スケールビジュアライザーのメインページを追加"
```

---

## Task 9: DiatonicChordPanel.svelte — ダイアトニックコードタップ再生

**Files:**
- Create: `src/lib/components/DiatonicChordPanel.svelte`
- Modify: `src/routes/scale-visualizer/+page.svelte`

- [ ] **Step 1: DiatonicChordPanel.svelte を作成**

```svelte
<!-- src/lib/components/DiatonicChordPanel.svelte -->
<script lang="ts">
  import type { DiatonicChord } from '$lib/diatonicChords';
  import { getAudioContext, playNoteAt } from '$lib/audioEngine';

  let {
    diatonicChords,
    bpm,
    addPlayingPc,
    removePlayingPc,
    stopProgression,
  }: {
    diatonicChords: DiatonicChord[];
    bpm: number;
    addPlayingPc: (pc: number) => void;
    removePlayingPc: (pc: number) => void;
    stopProgression: () => void;
  } = $props();

  function playChord(chord: DiatonicChord) {
    stopProgression();
    const ctx = getAudioContext();
    const duration = (60 / bpm) * 2;
    const now = ctx.currentTime;
    chord.intervals.forEach(interval => {
      const midi = 60 + chord.rootPc + interval;
      const pc = (chord.rootPc + interval) % 12;
      playNoteAt(ctx, midi, duration, now);
      addPlayingPc(pc);
      setTimeout(() => removePlayingPc(pc), duration * 1000);
    });
  }
</script>

<div>
  <p class="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">ダイアトニックコード</p>
  <div class="flex flex-wrap gap-2">
    {#each diatonicChords as chord}
      <button
        class="px-3 py-2 text-sm rounded bg-gray-700 hover:bg-gray-600 text-gray-200 font-mono"
        onclick={() => playChord(chord)}
        title="{chord.roman} ({chord.quality})"
      >
        {chord.roman}
      </button>
    {/each}
  </div>
</div>
```

- [ ] **Step 2: +page.svelte に DiatonicChordPanel を組み込む**

`src/routes/scale-visualizer/+page.svelte` の `<script>` 内に追加：
```svelte
import DiatonicChordPanel from '$lib/components/DiatonicChordPanel.svelte';
```

テンプレートの `<!-- DiatonicChordPanel ... -->` コメントを以下に置き換え：
```svelte
{#if diatonicChords}
  <DiatonicChordPanel
    {diatonicChords}
    {bpm}
    {addPlayingPc}
    {removePlayingPc}
    stopProgression={() => progressionPlayerRef?.stop()}
  />
{/if}
```

- [ ] **Step 3: 動作確認**

http://localhost:5173/scale-visualizer で確認：
- 長調・短調など7音スケール選択時にダイアトニックコードボタン（I, ii, iii...）が表示される
- ペンタトニック選択時はパネルが非表示になる
- コードボタンをタップすると3音が同時に鳴る（約1秒）

- [ ] **Step 4: コミット**

```bash
git add src/lib/components/DiatonicChordPanel.svelte src/routes/scale-visualizer/+page.svelte
git commit -m "feat: DiatonicChordPanelを追加（ダイアトニックコードタップ再生）"
```

---

## Task 10: ProgressionPlayer.svelte — コード進行ループ再生

**Files:**
- Create: `src/lib/components/ProgressionPlayer.svelte`
- Modify: `src/routes/scale-visualizer/+page.svelte`

- [ ] **Step 1: ProgressionPlayer.svelte を作成**

```svelte
<!-- src/lib/components/ProgressionPlayer.svelte -->
<script lang="ts">
  import type { DiatonicChord } from '$lib/diatonicChords';
  import { PROGRESSIONS } from '$lib/scaleData';
  import { getAudioContext, playNoteAt } from '$lib/audioEngine';

  let {
    diatonicChords,
    bpm,
    addPlayingPc,
    removePlayingPc,
  }: {
    diatonicChords: DiatonicChord[];
    bpm: number;
    addPlayingPc: (pc: number) => void;
    removePlayingPc: (pc: number) => void;
  } = $props();

  let activeProgId = $state<string | null>(null);
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  export function stop() {
    activeProgId = null;
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  }

  function playStep(progId: string, degrees: number[], stepIndex: number) {
    if (activeProgId !== progId) return;

    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const STEP_SPACING = (60 / bpm) * 2;
    const CHORD_DURATION = STEP_SPACING * 0.9;

    const degree = degrees[stepIndex % degrees.length];
    const chord = diatonicChords[degree];
    if (chord) {
      chord.intervals.forEach(interval => {
        const midi = 60 + chord.rootPc + interval;
        const pc = (chord.rootPc + interval) % 12;
        playNoteAt(ctx, midi, CHORD_DURATION, now);
        addPlayingPc(pc);
        setTimeout(() => removePlayingPc(pc), CHORD_DURATION * 1000);
      });
    }

    timeoutId = setTimeout(() => {
      playStep(progId, degrees, stepIndex + 1);
    }, STEP_SPACING * 1000);
  }

  function toggleProgression(prog: (typeof PROGRESSIONS)[number]) {
    if (activeProgId === prog.id) {
      stop();
    } else {
      stop();
      activeProgId = prog.id;
      playStep(prog.id, prog.degrees, 0);
    }
  }
</script>

<div>
  <p class="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">コード進行プリセット</p>
  <div class="space-y-1">
    {#each PROGRESSIONS as prog}
      <button
        class="w-full text-left px-3 py-2 text-sm rounded
          {activeProgId === prog.id
            ? 'bg-teal-600 text-white'
            : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}"
        onclick={() => toggleProgression(prog)}
      >
        {activeProgId === prog.id ? '⏹ ' : '▶ '}{prog.label}
      </button>
    {/each}
  </div>
</div>
```

- [ ] **Step 2: +page.svelte に ProgressionPlayer を組み込む**

`<script>` に追加：
```svelte
import ProgressionPlayer from '$lib/components/ProgressionPlayer.svelte';
```

`{#if diatonicChords}` ブロック内の DiatonicChordPanel の後に追加：
```svelte
<ProgressionPlayer
  bind:this={progressionPlayerRef}
  {diatonicChords}
  {bpm}
  {addPlayingPc}
  {removePlayingPc}
/>
```

- [ ] **Step 3: 動作確認**

http://localhost:5173/scale-visualizer で確認：
- 7音スケール選択時にコード進行プリセットが表示される
- 「▶ 王道進行」ボタンをクリックすると進行ループが始まり、各コードが2拍ずつ鳴る
- 再クリックで⏹になりループが止まる
- 別のプリセットをクリックすると切り替わる
- ルート音・スケール・BPMを変更するとループが自動停止する

- [ ] **Step 4: コミット**

```bash
git add src/lib/components/ProgressionPlayer.svelte src/routes/scale-visualizer/+page.svelte
git commit -m "feat: ProgressionPlayerを追加（コード進行ループ再生）"
```

---

## Task 11: MelodyGenerator.svelte — ランダムメロディ生成

**Files:**
- Create: `src/lib/components/MelodyGenerator.svelte`
- Modify: `src/routes/scale-visualizer/+page.svelte`

- [ ] **Step 1: MelodyGenerator.svelte を作成**

```svelte
<!-- src/lib/components/MelodyGenerator.svelte -->
<script lang="ts">
  import { calculateNoteDurations } from '$lib/noteDuration';
  import { NOTE_NAMES } from '$lib/scaleData';
  import { getAudioContext, playNoteAt } from '$lib/audioEngine';

  let {
    intervals,
    rootPc,
    bpm,
    addPlayingPc,
    removePlayingPc,
  }: {
    intervals: number[];
    rootPc: number;
    bpm: number;
    addPlayingPc: (pc: number) => void;
    removePlayingPc: (pc: number) => void;
  } = $props();

  const NOTE_LABELS = ['32分', '16分', '8分', '4分', '2分', '全'];
  const BARS_OPTIONS = [1, 2, 4, 8];

  let bars = $state(2);
  let minNoteIdx = $state(1); // 16分音符
  let maxNoteIdx = $state(3); // 4分音符
  let useDotted = $state(false);
  let useTriplet = $state(false);
  let isPlaying = $state(false);

  interface MelodyNote { interval: number; pc: number; duration: number; }
  let cachedMelody = $state<MelodyNote[] | null>(null);

  function buildDurationPool(): number[] {
    const noteDurations = calculateNoteDurations(bpm);
    const ascDurations = [...noteDurations].reverse(); // index0=32分, index5=全音符
    const slice = ascDurations.slice(minNoteIdx, maxNoteIdx + 1);
    const pool: number[] = [];
    slice.forEach(nv => {
      pool.push(nv.normalSec);
      if (useDotted) pool.push(nv.dottedSec);
      if (useTriplet) pool.push(nv.tripletSec);
    });
    return pool.length > 0 ? pool : [ascDurations[2].normalSec];
  }

  function generateMelody(): MelodyNote[] {
    const pool = buildDurationPool();
    const secPerBeat = 60 / bpm;
    const targetSeconds = Math.max(secPerBeat, bars * 4 * secPerBeat - secPerBeat);
    const seq: MelodyNote[] = [];
    let cumulative = 0;
    let guard = 0;
    while (cumulative < targetSeconds && guard < 300) {
      guard++;
      const deg = intervals[Math.floor(Math.random() * intervals.length)];
      const octShift = Math.random() < 0.25 ? 12 : 0;
      const duration = pool[Math.floor(Math.random() * pool.length)];
      const pc = (rootPc + deg) % 12;
      seq.push({ interval: deg + octShift, pc, duration });
      cumulative += duration;
    }
    seq.push({ interval: 0, pc: rootPc % 12, duration: secPerBeat });
    return seq;
  }

  function playMelodySeq(seq: MelodyNote[]) {
    if (isPlaying) return;
    isPlaying = true;
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    let startTime = now;
    let totalDuration = 0;
    seq.forEach(note => {
      const midi = 60 + rootPc + note.interval;
      const pc = note.pc;
      const dur = note.duration * 0.9;
      playNoteAt(ctx, midi, dur, startTime);
      const t = (startTime - now) * 1000;
      setTimeout(() => addPlayingPc(pc), t);
      setTimeout(() => removePlayingPc(pc), t + dur * 1000);
      startTime += note.duration;
      totalDuration += note.duration;
    });
    setTimeout(() => { isPlaying = false; }, totalDuration * 1000 + 200);
  }

  function handleGenerate() {
    const seq = generateMelody();
    cachedMelody = seq;
    playMelodySeq(seq);
  }

  function handleReplay() {
    if (cachedMelody) playMelodySeq(cachedMelody);
  }

  const minLabel = $derived(NOTE_LABELS[minNoteIdx]);
  const maxLabel = $derived(NOTE_LABELS[maxNoteIdx]);
</script>

<div class="border border-gray-700 rounded-lg p-3 space-y-3">
  <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide">ランダムメロディ生成</p>

  <!-- 設定行 -->
  <div class="flex flex-wrap gap-3 items-center">
    <!-- 小節数 -->
    <div class="flex items-center gap-1">
      <span class="text-xs text-gray-400">小節数</span>
      <div class="flex gap-1">
        {#each BARS_OPTIONS as b}
          <button
            class="px-2 py-0.5 text-xs rounded
              {bars === b ? 'bg-teal-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}"
            onclick={() => (bars = b)}
          >{b}</button>
        {/each}
      </div>
    </div>

    <!-- 音符範囲 -->
    <div class="flex items-center gap-2">
      <span class="text-xs text-gray-400">最短</span>
      <input
        type="range" min={0} max={maxNoteIdx} value={minNoteIdx}
        oninput={(e) => (minNoteIdx = Number((e.target as HTMLInputElement).value))}
        class="w-20 h-1.5 rounded-full appearance-none cursor-pointer bg-gray-600"
      />
      <span class="text-xs text-gray-300 w-6">{minLabel}</span>
      <span class="text-xs text-gray-400">最長</span>
      <input
        type="range" min={minNoteIdx} max={5} value={maxNoteIdx}
        oninput={(e) => (maxNoteIdx = Number((e.target as HTMLInputElement).value))}
        class="w-20 h-1.5 rounded-full appearance-none cursor-pointer bg-gray-600"
      />
      <span class="text-xs text-gray-300 w-6">{maxLabel}</span>
    </div>

    <!-- 付点/3連 -->
    <div class="flex gap-2 text-xs">
      <label class="flex items-center gap-1 text-gray-300 cursor-pointer">
        <input type="checkbox" bind:checked={useDotted} class="accent-teal-500" />
        付点
      </label>
      <label class="flex items-center gap-1 text-gray-300 cursor-pointer">
        <input type="checkbox" bind:checked={useTriplet} class="accent-teal-500" />
        3連符
      </label>
    </div>
  </div>

  <!-- 操作ボタン -->
  <div class="flex gap-2">
    <button
      class="px-3 py-1.5 text-sm rounded bg-teal-600 hover:bg-teal-500 text-white disabled:opacity-50"
      onclick={handleGenerate}
      disabled={isPlaying}
    >
      🎲 生成 & 再生
    </button>
    {#if cachedMelody}
      <button
        class="px-3 py-1.5 text-sm rounded bg-gray-700 hover:bg-gray-600 text-gray-200 disabled:opacity-50"
        onclick={handleReplay}
        disabled={isPlaying}
      >
        ▶ 再生
      </button>
    {/if}
  </div>

  <!-- 生成結果チップ -->
  {#if cachedMelody}
    <div class="flex flex-wrap gap-1">
      {#each cachedMelody as note, i}
        <span class="px-1.5 py-0.5 text-xs rounded bg-gray-700 text-gray-300 font-mono">
          {NOTE_NAMES[note.pc]}{i === cachedMelody.length - 1 ? ' 🏠' : ''}
        </span>
      {/each}
    </div>
  {/if}
</div>
```

- [ ] **Step 2: +page.svelte に MelodyGenerator を組み込む**

`<script>` に追加：
```svelte
import MelodyGenerator from '$lib/components/MelodyGenerator.svelte';
```

`{#if diatonicChords}` ブロックの後（外側）に追加：
```svelte
<MelodyGenerator
  intervals={currentIntervals}
  rootPc={root.pc}
  {bpm}
  {addPlayingPc}
  {removePlayingPc}
/>
```

- [ ] **Step 3: 動作確認**

http://localhost:5173/scale-visualizer で確認：
- メロディ生成パネルが表示される
- 「🎲 生成 & 再生」ボタンをクリックするとランダムなメロディが鳴り、音符チップが表示される
- コード進行ループ中に生成してもループが止まらず、メロディが重なって鳴る
- 「▶ 再生」ボタンで同じフレーズが再再生される
- 小節数・音符範囲・付点/3連設定が反映される

- [ ] **Step 4: コミット**

```bash
git add src/lib/components/MelodyGenerator.svelte src/routes/scale-visualizer/+page.svelte
git commit -m "feat: MelodyGeneratorを追加（ランダムメロディ生成と再生）"
```

---

## Task 12: site.ts 更新・最終ビルド確認・コミット

**Files:**
- Modify: `src/lib/site.ts`

- [ ] **Step 1: site.ts にナビゲーションエントリを追加**

`src/lib/site.ts` の `tools` 配列の `/note-duration` エントリの直後に以下を追加：

```typescript
{
  href: "/scale-visualizer",
  label: "スケールビジュアライザー(開発中)",
  description: "スケール・コードを鍵盤で確認し、コード進行やメロディを試せるツール",
  visible: true,
  category: 'music',
},
```

- [ ] **Step 2: ビルドが通ることを確認**

```bash
npm run build
```

Expected: エラーなし

- [ ] **Step 3: 開発サーバーで全体動作確認**

```bash
npm run dev
```

以下の受け入れ条件を確認：
- [ ] ルート音12種・スケール15種・コード13種がグループ表示で選択できる
- [ ] 「C基準」「ルート基準」切替で鍵盤ウィンドウが正しくスライドし、白黒鍵の形状は崩れない
- [ ] 鍵盤を押すと音が鳴り、離すと止まる。左から右へ音程が上行する
- [ ] スケール外の鍵がグレーアウトし、地色（白黒）自体は変化しない
- [ ] ルート音のみ下部にティールの丸マーカーが表示される
- [ ] スケール往復再生・コード同時再生が正しく動作する
- [ ] 7音スケール選択時のみダイアトニックコードとコード進行プリセットが表示される
- [ ] コード進行ループが1つだけ排他的に再生され、ルート/スケール/モード/BPM変更で自動停止する
- [ ] メロディ生成がコード進行ループを止めずに重なって再生できる
- [ ] 複数の再生源が重なっても、鍵盤のハイライトが互いを消し合わない
- [ ] トップナビゲーションに「スケールビジュアライザー(開発中)」が表示される
- [ ] `noteDuration.ts` のBPMクランプ・秒数計算を重複実装していない（`calculateNoteDurations` を import して使っている）

- [ ] **Step 4: コミット**

```bash
git add src/lib/site.ts
git commit -m "feat: スケールビジュアライザーをナビゲーションに追加"
```

---

## 全テストの最終確認

- [ ] **Step 1: 全ユニットテストを実行**

```bash
npx vitest run
```

Expected: scaleData (8), pianoLayout (10), diatonicChords (8), audioEngine (4) — 合計30件以上がpass

---

## 自己レビューチェックリスト

### スペックカバレッジ確認
- ルート12種 → Task 1 (scaleData) + Task 6 (RootSelector) ✓
- スケール15種 / コード13種グループ表示 → Task 1 + Task 6 (ScaleChordSelector) ✓
- 鍵盤窓スライド（C基準/ルート基準） → Task 2 (pianoLayout) + Task 8 (+page) ✓
- 鍵盤タップ「押下中再生」→ Task 4 (startNote) + Task 5 (PianoKeyboard) ✓
- グレーアウト（非構成音 opacity 0.32） → Task 5 ✓
- ルート音マーカー → Task 5 ✓
- アクティブリング（別レイヤー） → Task 5 ✓
- メイン再生（スケール往復/コード同時） → Task 8 ✓
- ダイアトニックコード表示＆タップ → Task 3 + Task 9 ✓
- コード進行ループ・排他制御・自動停止 → Task 10 ✓
- ランダムメロディ生成（ループを止めない） → Task 11 ✓
- 加算/減算ハイライト方式 → Task 8 (addPlayingPc/removePlayingPc) ✓
- noteDuration.ts の再利用 → Task 7 (BpmSlider), Task 11 (calculateNoteDurations) ✓
- サイトナビゲーション追加 → Task 12 ✓
