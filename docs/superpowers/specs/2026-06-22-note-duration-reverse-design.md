# Note Duration 逆引き実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 既存の NoteDuration ページにタブを追加し、ms を入力すると近いBPM＋音符の組み合わせを返す逆引き機能を実装する。

**Architecture:** 既存の `/note-duration` ページ上部にタブUIを追加し、「BPM → 音符長」（既存）と「ms → 音符」（新規）を切り替える。逆引きロジックは `noteDuration.ts` に `findNearestNotes()` 関数として追加し、UIは新規コンポーネント `NoteReverseSearch.svelte` に分離する。

**Tech Stack:** SvelteKit 2 / Svelte 5 (runes)、TypeScript、Tailwind CSS

---

## 機能仕様

### 入力

| 項目 | 詳細 |
|---|---|
| ms入力 | 正の数値（小数可）。0以下・空は結果なし |
| BPM範囲 | min: 20〜max: 300（既存の MIN_BPM / MAX_BPM と同じ）。デフォルトは全範囲 |
| 付点を含める | チェックボックス、デフォルト ON |
| 3連符を含める | チェックボックス、デフォルト OFF |
| 表示モード | 「上位N件」か「誤差X%以内」をラジオボタンで切り替え |
| 上位N件 | デフォルト 10（1〜50） |
| 誤差X% | デフォルト 5（0.1〜50） |

### 検索アルゴリズム

1. BPM範囲の各整数値（bpmMin〜bpmMax）と、有効な音符バリアント（通常7種、付点7種※、3連符7種※）の全組み合わせを列挙
   - ※チェックボックスの状態に応じて含める
2. 各組み合わせで `durationMs = (60 / bpm) * mult * variantFactor * 1000` を計算
3. `diffMs = |targetMs - durationMs|` を算出
4. `diffPct = (diffMs / targetMs) * 100` を算出
5. `diffMs` 昇順でソート
6. 表示モードに応じてフィルタ
   - 上位N件モード: 先頭N件を返す
   - 誤差X%モード: `diffPct <= tolerancePct` の全件を返す

### 結果の表示

各行に以下を表示：

| 列 | 内容 |
|---|---|
| BPM | 整数値 |
| 音符名 | 例：「付点4分音符」「8分音符（3連符）」 |
| 実際のms | 小数点1桁 |
| 差分 | `+1.8ms` / `−183.0ms` 形式（ゼロは `0.0ms`）|

結果が0件のときは「該当する音符が見つかりませんでした」を表示。

---

## データ型

```ts
// noteDuration.ts に追加

export type NoteVariant = 'normal' | 'dotted' | 'triplet'

export interface NoteMatch {
  bpm: number
  noteId: NoteId
  label: string       // 例: "付点4分音符"
  variant: NoteVariant
  durationMs: number
  diffMs: number      // 絶対値
  diffPct: number     // 0〜100
}

export interface FindNearestNotesOptions {
  bpmMin?: number         // default: MIN_BPM (20)
  bpmMax?: number         // default: MAX_BPM (300)
  includeDotted?: boolean // default: true
  includeTriplet?: boolean // default: false
  topN?: number           // 上位N件モードの件数 (default: 10)
  tolerancePct?: number   // 誤差X%モードの閾値 (default: 5)
  mode: 'topN' | 'tolerance'
}

export function findNearestNotes(targetMs: number, options: FindNearestNotesOptions): NoteMatch[]
```

---

## ファイル構成

| ファイル | 変更種別 | 内容 |
|---|---|---|
| `src/lib/noteDuration.ts` | 修正 | `NoteVariant`, `NoteMatch`, `FindNearestNotesOptions` 型と `findNearestNotes()` 関数を追加 |
| `src/lib/components/NoteReverseSearch.svelte` | 新規 | 逆引きUIコンポーネント（入力フォーム＋結果リスト） |
| `src/routes/note-duration/+page.svelte` | 修正 | タブ切り替えUIを追加し、タブごとに既存テーブルと `NoteReverseSearch` を切り替える |

---

## UIレイアウト（逆引きタブ）

```
[ BPM → 音符長 ] [ ms → 音符 ]   ← タブ

ms入力: [         433.0        ] ms

BPM範囲: [ 20 ] 〜 [ 300 ]

含める音符: ✅ 付点   ☐ 3連符

表示方法: ◉ 上位 [ 10 ] 件   ○ 誤差 [ 5 ] % 以内

──────────────────────────────────
BPM    音符名          実際のms    差分
138    付点4分音符     434.8ms    +1.8ms
...
──────────────────────────────────
```

タブ・フォームのスタイルは既存 NoteDuration ページ（白背景・slate カラー）に合わせる。

---

## ナビゲーション

既存ページ (`/note-duration`) にタブを追加するため、ナビゲーションへの追加は不要。
