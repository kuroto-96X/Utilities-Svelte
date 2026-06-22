# メロディリズムパターン実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ランダムメロディ生成に10種のリズムパターンを追加し、チェックボックスで有効化するとそのdurationシーケンスでメロディを構築する。

**Architecture:** 純粋なリズムロジックを `src/lib/melodyRhythms.ts` に独立モジュールとして定義し、`MelodyGenerator.svelte` からインポートして使用する。リズムパターン有効時は既存のdurationプール・モチーフ反復をバイパスし、テンプレートのduration配列をそのまま使用してpitch選択ロジックのみ流用する。

**Tech Stack:** TypeScript, Svelte 5 runes (`$state`), Vitest

---

## ファイル構成

| ファイル | 変更内容 |
|---|---|
| `src/lib/melodyRhythms.ts` | 新規作成：`RhythmPattern`型・10パターン定義・`pickRhythmTemplate()` |
| `src/lib/melodyRhythms.test.ts` | 新規作成：上記モジュールのユニットテスト |
| `src/lib/components/MelodyGenerator.svelte` | import追加・`useRhythmPattern` state・`generateWithRhythmTemplate()`・`generateMelody()`分岐・チェックボックスUI |

---

### Task 1: `src/lib/melodyRhythms.ts` を作成する

**Files:**
- Create: `src/lib/melodyRhythms.ts`
- Create: `src/lib/melodyRhythms.test.ts`

- [ ] **Step 1: テストファイルを書く**

`src/lib/melodyRhythms.test.ts` を新規作成：

```typescript
import { describe, expect, test } from 'vitest'
import { RHYTHM_PATTERNS, pickRhythmTemplate } from './melodyRhythms'

describe('RHYTHM_PATTERNS', () => {
  test('パターン数が10', () => {
    expect(RHYTHM_PATTERNS).toHaveLength(10)
  })

  test('全パターンのbeats合計が4になる', () => {
    for (const pat of RHYTHM_PATTERNS) {
      const sum = pat.beats.reduce((s, b) => s + b, 0)
      expect(sum).toBeCloseTo(4, 10)
    }
  })

  test('各パターンにid/label/beatsがある', () => {
    for (const pat of RHYTHM_PATTERNS) {
      expect(typeof pat.id).toBe('string')
      expect(typeof pat.label).toBe('string')
      expect(Array.isArray(pat.beats)).toBe(true)
      expect(pat.beats.length).toBeGreaterThan(0)
    }
  })
})

describe('pickRhythmTemplate', () => {
  const secPerBeat = 0.5 // 120bpm

  test('正の数のみを返す', () => {
    const durations = pickRhythmTemplate(1, secPerBeat)
    for (const d of durations) {
      expect(d).toBeGreaterThan(0)
    }
  })

  test('1小節: 合計秒数が4 * secPerBeat', () => {
    const durations = pickRhythmTemplate(1, secPerBeat)
    const total = durations.reduce((s, d) => s + d, 0)
    expect(total).toBeCloseTo(4 * secPerBeat, 10)
  })

  test('2小節: 合計秒数が2 * 4 * secPerBeat', () => {
    const durations = pickRhythmTemplate(2, secPerBeat)
    const total = durations.reduce((s, d) => s + d, 0)
    expect(total).toBeCloseTo(2 * 4 * secPerBeat, 10)
  })

  test('4小節: 合計秒数が4 * 4 * secPerBeat', () => {
    const durations = pickRhythmTemplate(4, secPerBeat)
    const total = durations.reduce((s, d) => s + d, 0)
    expect(total).toBeCloseTo(4 * 4 * secPerBeat, 10)
  })

  test('異なるBPMでも合計秒数が正しい', () => {
    const secPerBeat90 = 60 / 90
    const durations = pickRhythmTemplate(2, secPerBeat90)
    const total = durations.reduce((s, d) => s + d, 0)
    expect(total).toBeCloseTo(2 * 4 * secPerBeat90, 10)
  })
})
```

- [ ] **Step 2: テストを実行してFAILを確認**

```bash
npx vitest run src/lib/melodyRhythms.test.ts
```

Expected: FAIL with "Cannot find module './melodyRhythms'"

- [ ] **Step 3: `src/lib/melodyRhythms.ts` を実装する**

```typescript
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
]

export function pickRhythmTemplate(bars: number, secPerBeat: number): number[] {
  const pattern = RHYTHM_PATTERNS[Math.floor(Math.random() * RHYTHM_PATTERNS.length)]
  const oneMeasure = pattern.beats.map(b => b * secPerBeat)
  const result: number[] = []
  for (let i = 0; i < bars; i++) {
    result.push(...oneMeasure)
  }
  return result
}
```

- [ ] **Step 4: テストを実行してPASSを確認**

```bash
npx vitest run src/lib/melodyRhythms.test.ts
```

Expected: PASS (全9件)

- [ ] **Step 5: コミット**

```bash
git add src/lib/melodyRhythms.ts src/lib/melodyRhythms.test.ts
git commit -m "feat: メロディリズムパターンモジュールを追加"
```

---

### Task 2: `MelodyGenerator.svelte` にリズムパターン機能を統合する

**Files:**
- Modify: `src/lib/components/MelodyGenerator.svelte`

#### 変更点の全体像（変更箇所ごとに手順を分ける）

---

- [ ] **Step 1: import を追加する（ファイル先頭部分）**

[MelodyGenerator.svelte:4](src/lib/components/MelodyGenerator.svelte#L4) の `import { calculateNoteDurations }...` の直後に以下を追加する。

```svelte
  import { browser } from '$app/environment';
  import { calculateNoteDurations } from '$lib/noteDuration';
  import { pickRhythmTemplate } from '$lib/melodyRhythms';
  import { NOTE_NAMES } from '$lib/scaleData';
```

（`import { pickRhythmTemplate } from '$lib/melodyRhythms';` の1行を追加）

- [ ] **Step 2: `useRhythmPattern` の state を追加する**

[MelodyGenerator.svelte:59](src/lib/components/MelodyGenerator.svelte#L59) の `let useMotifRepeat = $state(true);` の直後に追記する：

```typescript
  let useMotifRepeat = $state(true);
  let useRhythmPattern = $state(true);
```

- [ ] **Step 3: `generateWithRhythmTemplate()` 関数を追加する**

[MelodyGenerator.svelte:315](src/lib/components/MelodyGenerator.svelte#L315) の `buildPhraseWithMotif` 関数の終わり（`}` の直後、`generateMelody` 関数の前）に以下を挿入する：

```typescript
  function generateWithRhythmTemplate(
    ivs: number[], rpc: number,
    durations: number[], ms: number, pat: ContourPattern
  ): MelodyNote[] {
    const stableIndices = getStableIndices(ivs);
    const secPerBeat = 60 / bpm;
    const totalDur = durations.reduce((s, d) => s + d, 0);
    const seq: MelodyNote[] = [];
    let cumulative = 0;
    let currentIdx = pickStartIndex(ivs.length, pat);

    for (const duration of durations) {
      const strong = isStrongBeat(cumulative, secPerBeat);
      const progress = totalDur > 0 ? cumulative / totalDur : 0;

      if (strong && Math.random() < 0.6) {
        currentIdx = moveTowardStable(currentIdx, stableIndices, ms);
      } else {
        const biasRatio = biasRatioFor(pat, progress);
        const delta = weightedDelta(ms, biasRatio);
        const raw = currentIdx + delta;
        const last = ivs.length - 1;
        if (raw < 0) {
          currentIdx = Math.min(last, -raw);
        } else if (raw > last) {
          currentIdx = Math.max(0, 2 * last - raw);
        } else {
          currentIdx = raw;
        }
      }

      seq.push({
        degreeIndex: currentIdx,
        interval: ivs[currentIdx],
        pc: (rpc + ivs[currentIdx]) % 12,
        duration,
      });
      cumulative += duration;
    }
    return seq;
  }
```

- [ ] **Step 4: `generateMelody()` に分岐を追加する**

[MelodyGenerator.svelte:317](src/lib/components/MelodyGenerator.svelte#L317) の既存 `generateMelody()` 関数全体を以下で置き換える：

```typescript
  function generateMelody(): MelodyNote[] {
    const secPerBeat = 60 / bpm;
    const ivs = extendedIntervals;

    if (useRhythmPattern) {
      const durations = pickRhythmTemplate(bars, secPerBeat);
      return generateWithRhythmTemplate(ivs, rootPc, durations, maxStep, pattern);
    }

    const { pool, tripletSet } = buildDurationPool();
    const targetSeconds = bars * 4 * secPerBeat;
    return useMotifRepeat
      ? buildPhraseWithMotif(ivs, rootPc, secPerBeat, pool, tripletSet, targetSeconds, maxStep, pattern)
      : generateStructuredPhrase(ivs, rootPc, secPerBeat, pool, tripletSet, targetSeconds, maxStep, pattern);
  }
```

（既存の `generateMelody` は `const { pool, tripletSet }...` から始まるので、その前に `useRhythmPattern` の分岐ブロックを差し込み、既存コードを `else` ブランチとして残す形。上記で関数全体を置き換えること）

- [ ] **Step 5: チェックボックスUIを追加する**

[MelodyGenerator.svelte:490](src/lib/components/MelodyGenerator.svelte#L490) のチェックボックス行（`<div class="flex gap-3 text-xs">`）内の末尾に `リズム型` チェックボックスを追加する。

既存のチェックボックスブロック：

```svelte
      <!-- チェックボックス -->
      <div class="flex gap-3 text-xs">
        <label class="flex items-center gap-1 text-gray-300 cursor-pointer">
          <input type="checkbox" bind:checked={useDotted} class="accent-teal-500" />
          付点
        </label>
        <label class="flex items-center gap-1 text-gray-300 cursor-pointer">
          <input type="checkbox" bind:checked={useTriplet} class="accent-teal-500" />
          3連符
        </label>
        <label class="flex items-center gap-1 text-gray-300 cursor-pointer">
          <input type="checkbox" bind:checked={useMotifRepeat} class="accent-teal-500" />
          モチーフ反復
        </label>
      </div>
```

を以下に置き換える：

```svelte
      <!-- チェックボックス -->
      <div class="flex gap-3 text-xs">
        <label class="flex items-center gap-1 text-gray-300 cursor-pointer">
          <input type="checkbox" bind:checked={useDotted} class="accent-teal-500" />
          付点
        </label>
        <label class="flex items-center gap-1 text-gray-300 cursor-pointer">
          <input type="checkbox" bind:checked={useTriplet} class="accent-teal-500" />
          3連符
        </label>
        <label class="flex items-center gap-1 text-gray-300 cursor-pointer">
          <input type="checkbox" bind:checked={useMotifRepeat} class="accent-teal-500" />
          モチーフ反復
        </label>
        <label class="flex items-center gap-1 text-gray-300 cursor-pointer">
          <input type="checkbox" bind:checked={useRhythmPattern} class="accent-teal-500" />
          リズム型
        </label>
      </div>
```

- [ ] **Step 6: ビルドを通す**

```bash
npm run build
```

Expected: エラーなし。TypeScript型エラーや未使用変数があれば修正する。

- [ ] **Step 7: テストスイート全体を実行する**

```bash
npx vitest run
```

Expected: 全テストPASS（新規追加した9件を含む）

- [ ] **Step 8: 動作確認**

```bash
npm run dev
```

`http://localhost:5173/melody-generator`（またはBPM Tapperページのメロディ生成セクション）を開いて確認：

1. チェックボックスに「リズム型」が追加されており、デフォルトでチェック済みであること
2. 「生成 & 再生」を押すとメロディが生成・再生されること
3. 「リズム型」チェックを外して生成すると、従来通りのランダムdurationで動くこと（付点・3連符・モチーフ反復が引き続き機能すること）

- [ ] **Step 9: コミット**

```bash
git add src/lib/components/MelodyGenerator.svelte
git commit -m "feat: メロディ生成にリズムパターン機能を追加"
```
