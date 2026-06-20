# Smooth Bass Playback Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** スムーズベース再生を共通転回形から独立させ、既知の3プリセットをループ境界まで滑らかに再生する。

**Architecture:** 再生用インターバルの選択を `scaleData.ts` の純粋関数へ集約し、Svelteコンポーネントはその結果をWeb Audioへ渡すだけにする。プリセット固有のオクターブ補正は既存データ構造を維持し、ループ境界に問題がある3進行だけを調整する。

**Tech Stack:** Svelte 5、TypeScript、Vitest、Playwright、Web Audio API

---

## 変更ファイル

- `src/lib/scaleData.ts`: ボイシング解決関数と3プリセットの補正値
- `src/lib/scaleData.test.ts`: ボイシング規則・データ整合性・最低音列の回帰テスト
- `src/lib/components/ProgressionPlayer.svelte`: 共通ボイシング解決関数を使った再生

### Task 1: ボイシング解決規則をテスト駆動で追加する

**Files:**
- Modify: `src/lib/scaleData.ts:58-73`
- Test: `src/lib/scaleData.test.ts`

- [ ] **Step 1: 失敗する単体テストを書く**

`src/lib/scaleData.test.ts` のimportへ `resolveProgressionVoicing` を追加し、次のテストを追加する。

```ts
describe('resolveProgressionVoicing', () => {
  test('スムーズONでは補正未指定でも共通転回形を無視してルート形にする', () => {
    expect(resolveProgressionVoicing([0, 4, 7], null, true, 2)).toEqual([0, 4, 7])
  })

  test('スムーズONでは各構成音へプリセットのオクターブ補正を適用する', () => {
    expect(resolveProgressionVoicing([0, 4, 7], [12, 0, 0], true, 0)).toEqual([12, 4, 7])
  })

  test('スムーズOFFでは共通転回形を適用する', () => {
    expect(resolveProgressionVoicing([0, 4, 7], null, false, 1)).toEqual([4, 7, 12])
  })

  test('入力配列を変更しない', () => {
    const intervals = [0, 4, 7]
    const smooth = [12, 0, 0]
    resolveProgressionVoicing(intervals, smooth, true, 0)
    expect(intervals).toEqual([0, 4, 7])
    expect(smooth).toEqual([12, 0, 0])
  })
})
```

- [ ] **Step 2: テストが期待どおりREDになることを確認する**

Run: `npm.cmd test -- --run src/lib/scaleData.test.ts`

Expected: `resolveProgressionVoicing` がexportされていないためFAIL。

- [ ] **Step 3: 最小実装を追加する**

`applyInversion` の直後へ追加する。

```ts
export function resolveProgressionVoicing(
  intervals: number[],
  smoothVoicing: number[] | null,
  useSmoothedBass: boolean,
  inversion: number,
): number[] {
  if (!useSmoothedBass) return applyInversion(intervals, inversion)
  return intervals.map((interval, i) => interval + (smoothVoicing?.[i] ?? 0))
}
```

- [ ] **Step 4: 単体テストがGREENになることを確認する**

Run: `npm.cmd test -- --run src/lib/scaleData.test.ts`

Expected: `src/lib/scaleData.test.ts` の全テストがPASS。

- [ ] **Step 5: 変更をコミットする**

```powershell
git add -- src/lib/scaleData.ts src/lib/scaleData.test.ts
git commit -m "test: スムーズベースのボイシング規則を追加"
```

### Task 2: コード進行再生を共通解決関数へ統一する

**Files:**
- Modify: `src/lib/components/ProgressionPlayer.svelte:4,138-184`
- Test: `src/lib/scaleData.test.ts`

- [ ] **Step 1: Task 1の回帰テストを再実行する**

Run: `npm.cmd test -- --run src/lib/scaleData.test.ts`

Expected: 共通転回形から独立するボイシング規則がPASS。

- [ ] **Step 2: importを共通解決関数へ切り替える**

```ts
import {
  PROGRESSIONS,
  CHROMATIC_PROGRESSIONS,
  TENSION_PROGRESSIONS,
  NOTE_NAMES,
  resolveProgressionVoicing,
} from '$lib/scaleData';
```

- [ ] **Step 3: クロマティック進行の二重分岐を共通関数へ置き換える**

```ts
resolveProgressionVoicing(
  step.intervals,
  prog.smoothVoicings[activeStepIndex],
  useSmoothedBass,
  inversion,
).forEach(interval => {
  const midi = chordRootMidi + interval;
  const pc = ((chordRoot + interval) % 12 + 12) % 12;
  const stopFn = startNoteAt(ctx, midi, ctx.currentTime);
  activeChordStopFns.push(stopFn);
  activeChordPcs.push(pc);
  activeChordMidis.push(midi);
  addPlayingPc(pc);
  addPlayingMidi?.(midi);
});
```

- [ ] **Step 4: ダイアトニック進行の二重分岐を共通関数へ置き換える**

```ts
resolveProgressionVoicing(
  chord.intervals,
  prog.smoothVoicings[activeStepIndex],
  useSmoothedBass,
  inversion,
).forEach(interval => {
  const midi = chordRootMidi + interval;
  const pc = ((chord.rootPc + interval) % 12 + 12) % 12;
  const stopFn = startNoteAt(ctx, midi, ctx.currentTime);
  activeChordStopFns.push(stopFn);
  activeChordPcs.push(pc);
  activeChordMidis.push(midi);
  addPlayingPc(pc);
  addPlayingMidi?.(midi);
});
```

- [ ] **Step 5: 型検査と単体テストを実行する**

Run: `npm.cmd run check`

Expected: エラー0件。既存のPianoKeyboard a11y警告以外に新しい警告がない。

Run: `npm.cmd test -- --run src/lib/scaleData.test.ts`

Expected: 全テストPASS。

- [ ] **Step 6: 変更をコミットする**

```powershell
git add -- src/lib/components/ProgressionPlayer.svelte
git commit -m "fix: スムーズベースを共通転回形から独立"
```

### Task 3: ループ境界を修正して全体検証する

**Files:**
- Modify: `src/lib/scaleData.ts:79-85`
- Test: `src/lib/scaleData.test.ts`

- [ ] **Step 1: データ整合性と最低音列の失敗テストを書く**

`src/lib/scaleData.test.ts` のimportへ `CHROMATIC_PROGRESSIONS`、`TENSION_PROGRESSIONS` を追加し、次を追加する。

```ts
describe('smoothVoicings', () => {
  test('全プリセットで進行とボイシングのステップ数が一致する', () => {
    PROGRESSIONS.forEach(p => expect(p.smoothVoicings).toHaveLength(p.degrees.length))
    ;[...CHROMATIC_PROGRESSIONS, ...TENSION_PROGRESSIONS].forEach(p => {
      expect(p.smoothVoicings).toHaveLength(p.steps.length)
    })
  })

  test.each([
    ['basicLoop', [60, 65, 64, 62]],
    ['fifties', [60, 64, 65, 62]],
    ['jazzCircle', [60, 64, 65, 62]],
  ])('%sはループ境界を含め最大5半音以内で動く', (id, expectedBass) => {
    const majorRoots = [0, 2, 4, 5, 7, 9, 11]
    const majorIntervals = [
      [0, 4, 7], [0, 3, 7], [0, 3, 7], [0, 4, 7],
      [0, 4, 7], [0, 3, 7], [0, 3, 6],
    ]
    const progression = PROGRESSIONS.find(p => p.id === id)!
    const bass = progression.degrees.map((degree, i) => {
      const rootMidi = 60 + majorRoots[degree]
      const voiced = resolveProgressionVoicing(
        majorIntervals[degree],
        progression.smoothVoicings[i],
        true,
        0,
      )
      return Math.min(...voiced.map(interval => rootMidi + interval))
    })
    const looped = [...bass, bass[0]]
    const maxMove = Math.max(...looped.slice(1).map((midi, i) => Math.abs(midi - looped[i])))

    expect(bass).toEqual(expectedBass)
    expect(maxMove).toBeLessThanOrEqual(5)
  })
})
```

- [ ] **Step 2: テストが期待どおりREDになることを確認する**

Run: `npm.cmd test -- --run src/lib/scaleData.test.ts`

Expected: 3進行の最低音列が現行データと異なるためFAIL。

- [ ] **Step 3: 3プリセットのボイシングデータを修正する**

```ts
{ id: 'fifties',    label: '50年代進行（I-vi-IV-V）', degrees: [0,5,3,4], smoothVoicings: [null, [0,0,-12], null, [0,0,-12]] },
{ id: 'basicLoop',  label: '基本循環（I-IV-I-V）',    degrees: [0,3,0,4], smoothVoicings: [[0,0,0], null, [12,0,0], [0,0,-12]] },
{ id: 'jazzCircle', label: 'ジャズ循環（I-vi-ii-V）', degrees: [0,5,1,4], smoothVoicings: [null, [0,0,-12], [12,0,0], [0,0,-12]] },
```

- [ ] **Step 4: 対象テストと全テストをGREENにする**

Run: `npm.cmd test -- --run src/lib/scaleData.test.ts`

Expected: 対象テストが全てPASS。

Run: `npm.cmd test -- --run`

Expected: 全テストPASS、失敗0件。

- [ ] **Step 5: 型検査とビルドを実行する**

Run: `npm.cmd run check`

Expected: エラー0件。

Run: `npm.cmd run build`

Expected: exit code 0で静的ビルド成功。

- [ ] **Step 6: ブラウザで実Web Audio入力を確認する**

Run: `npm.cmd run dev -- --host 127.0.0.1`

Playwrightで `AudioContext` のoscillator開始周波数を記録し、次を確認する。

- Cメジャー＋スムーズONで、共通転回形が「ルート」「1転」のどちらでも王道進行のMIDI列が同一。
- 基本循環の最低音が `C4 → F4 → E4 → D4 → C4`。
- 50年代進行とジャズ循環の最低音が `C4 → E4 → F4 → D4 → C4`。

- [ ] **Step 7: 差分を確認してコミットする**

Run: `git diff --check`

Expected: 出力なし。

```powershell
git add -- src/lib/scaleData.ts src/lib/scaleData.test.ts
git commit -m "fix: コード進行のループ境界を滑らかに調整"
```

- [ ] **Step 8: 最終状態を確認する**

Run: `git status --short`

Expected: 作業ツリーに未コミット差分なし。
