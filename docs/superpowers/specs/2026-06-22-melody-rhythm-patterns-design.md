# メロディリズムパターン デザイン仕様

## 概要

ランダムメロディ生成に「定番のリズム型」を組み込む。チェックボックス（デフォルト ON）で有効化すると、生成時にあらかじめ定義したリズムパターンから1つをランダムに選び、そのdurationシーケンスでメロディを構築する。

## カテゴリー

音楽制作ツール（`src/lib/components/MelodyGenerator.svelte`）の機能追加。

---

## リズムパターン定義 — `src/lib/melodyRhythms.ts`（新規）

### データ構造

```typescript
interface RhythmPattern {
  id: string;
  label: string;   // 日本語名（デバッグ・将来的な表示用）
  beats: number[]; // 1小節分の拍数配列（1 = 4分音符）
}
```

`beats` の合計は必ず **4**（4/4拍子1小節）。

### 定義するパターン（10種）

| id | label | beats | 音符イメージ |
|---|---|---|---|
| `equal` | 等分4分 | [1, 1, 1, 1] | ♩♩♩♩ |
| `dotted` | 付点リズム | [1.5, 0.5, 1.5, 0.5] | ♩.♪♩.♪ |
| `march` | 行進曲 | [1, 1, 0.5, 0.5, 1] | ♩♩♪♪♩ |
| `scotch` | スコッチスナップ | [0.5, 1.5, 0.5, 1.5] | ♪♩.♪♩. |
| `synco` | シンコペ | [0.5, 1, 0.5, 0.5, 1, 0.5] | ♪♩♪♪♩♪ |
| `offbeat` | 裏拍強調 | [0.5, 1, 1, 1, 0.5] | ♪♩♩♩♪ |
| `gallop` | ギャロップ | [0.5, 0.5, 1, 0.5, 0.5, 1] | ♪♪♩♪♪♩ |
| `half` | 2分音符主体 | [2, 1, 1] | 𝅗𝅥♩♩ |
| `eighth` | 8分連打 | [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5] | ♪♪♪♪♪♪♪♪ |
| `tango` | タンゴ | [1, 1.5, 0.5, 1] | ♩♩.♪♩ |

### エクスポートする関数

```typescript
export function pickRhythmTemplate(bars: number, secPerBeat: number): number[]
```

- `bars` 小節分のduration配列（秒）を返す
- 1小節のパターンを `bars` 回タイル状に繰り返す
- 呼び出しごとにパターンをランダムに1つ選ぶ（確率は均一）

---

## MelodyGenerator.svelte への統合

### 新規 state

```typescript
let useRhythmPattern = $state(true); // デフォルト ON
```

### UI 変更

既存のチェックボックス行に追加：

```
[ ] 付点  [ ] 3連符  [✓] モチーフ反復  [✓] リズム型
```

### `generateMelody()` の分岐

```typescript
function generateMelody(): MelodyNote[] {
  const secPerBeat = 60 / bpm;
  const targetSeconds = bars * 4 * secPerBeat;
  const ivs = extendedIntervals;

  if (useRhythmPattern) {
    const durations = pickRhythmTemplate(bars, secPerBeat);
    return generateWithRhythmTemplate(ivs, rootPc, durations, maxStep, pattern);
  }

  const { pool, tripletSet } = buildDurationPool();
  return useMotifRepeat
    ? buildPhraseWithMotif(ivs, rootPc, secPerBeat, pool, tripletSet, targetSeconds, maxStep, pattern)
    : generateStructuredPhrase(ivs, rootPc, secPerBeat, pool, tripletSet, targetSeconds, maxStep, pattern);
}
```

### 新規関数 `generateWithRhythmTemplate()`

```typescript
function generateWithRhythmTemplate(
  ivs: number[], rpc: number,
  durations: number[], ms: number, pat: ContourPattern
): MelodyNote[]
```

- `durations` を先頭から順に消費してノートを生成
- 各ノートの pitch 選択は既存の `weightedDelta` / `biasRatioFor` / `moveTowardStable` をそのまま使用
- `isStrongBeat` は `durations` の累積秒数から判定（既存と同じロジック）
- `useMotifRepeat` は無視（テンプレート自体が構造を持つため）
- 音域スライダー（minNoteIdx / maxNoteIdx）は pitch 選択に影響せず、duration 選択をバイパス

---

## 変更ファイル一覧

| ファイル | 変更内容 |
|---|---|
| `src/lib/melodyRhythms.ts` | 新規作成：パターン定義 + `pickRhythmTemplate` |
| `src/lib/components/MelodyGenerator.svelte` | `useRhythmPattern` state・チェックボックス・`generateWithRhythmTemplate`・分岐追加 |

---

## 変更しないもの

- ピアノロール表示
- 履歴システム
- 音域スライダー（pitch 選択ロジックには引き続き影響する）
- コントゥア・最大度数差・付点・3連符の既存設定
