# 設計ドキュメント: スケール／コードビジュアライザー（scale-visualizer）

## 1. 概要

ルート音とスケール／コードを選ぶと、1オクターブの鍵盤上に構成音をハイライト表示し、タップや各種ボタンで実際に音を鳴らせるツール。スケールモードではダイアトニックコード表示・コード進行プリセットのループ再生・ランダムメロディ生成も提供する。

---

## 2. ルーティング / ファイル構成

```
src/routes/scale-visualizer/
  +page.svelte

src/lib/
  noteDuration.ts            # 既存（再利用）
  scaleData.ts
  pianoLayout.ts
  diatonicChords.ts
  audioEngine.ts
  components/
    PianoKeyboard.svelte
    RootSelector.svelte
    ScaleChordSelector.svelte
    BpmSlider.svelte
    MelodyGenerator.svelte
    DiatonicChordPanel.svelte
    ProgressionPlayer.svelte
```

---

## 3. ページレイアウト

左サイドバー＋メインエリアの2カラム構成。スマホでは縦積みに折り返す（md ブレークポイントで切り替え）。

```
┌──────────────────────────────────────────────┐
│ h1: スケール / コードビジュアライザー            │
├────────────────┬─────────────────────────────┤
│ RootSelector   │ PianoKeyboard（SVG鍵盤）      │
│ （ルート12音）  │                             │
│                │ ▶ 再生  BPM━━●━  C基準 ⟷ ルート基準 │
│ ScaleChord     │                             │
│ Selector       │ DiatonicChordPanel           │
│ （スケール/    │ （7音スケール時のみ）           │
│  コード選択）   │                             │
│                │ ProgressionPlayer            │
│                │ MelodyGenerator              │
└────────────────┴─────────────────────────────┘
```

---

## 4. データモデル（`src/lib/scaleData.ts`）

スペック（`.docs/instructions/scale-visualizer-spec.md` §4）の定義をそのまま実装する。

- `NOTE_NAMES`: 12音シャープ表記
- `ROOTS`: `{ id, pc }` 12個
- `SCALE_GROUPS`: 基本6・モード5・和風その他4（計15種）
- `CHORD_GROUPS`: トライアド4・セブンス3・テンション/サスペンド6（計13種）
- `PROGRESSIONS`: 5種（王道・カノン・ポップパンク・50年代・ジャズii-V-I）

`SCALES` / `CHORDS` はそれぞれ `flatMap` で全アイテムを1配列に展開したヘルパーを `export`。

---

## 5. 鍵盤レイアウト（`src/lib/pianoLayout.ts`）

スペック §5 のアルゴリズムをそのまま実装する。

```ts
export const WHITE_W = 48, WHITE_H = 180, BLACK_W = 28, BLACK_H = 112;
export const TOTAL_WIDTH = 7 * WHITE_W;  // 336px

export interface LayoutKey { pc: number; windowIndex: number; x: number; }
export function buildKeyboardWindow(startSemitone: number): { whiteKeys: LayoutKey[]; blackKeys: LayoutKey[] }
```

- `startSemitone = 0`（C基準）or `root.pc`（ルート基準）で呼び出す
- `windowIndex`（0〜11、左→右）で MIDI 番号を計算：`midi = 60 + windowIndex`

---

## 6. ダイアトニックコード（`src/lib/diatonicChords.ts`）

スペック §6 のアルゴリズムをそのまま実装する。

```ts
export interface DiatonicChord {
  degreeIndex: number; roman: string; quality: string; rootPc: number; intervals: [number, number, number];
}
export function buildDiatonicChords(intervals: number[], rootPc: number): DiatonicChord[] | null
```

- 7音スケール以外は `null` を返す → 呼び出し側でダイアトニックコード／コード進行UIを非表示

---

## 7. オーディオエンジン（`src/lib/audioEngine.ts`）

スペック §7 の関数に加え、**鍵盤タップ用の「押している間だけ鳴る」API** を追加する。

```ts
export function getAudioContext(): AudioContext
export function freqFromMidi(midi: number): number
export function playNoteAt(ctx: AudioContext, midi: number, duration: number, startTime: number): void

// 鍵盤タップ用（押している間鳴らし続ける）
export function startNote(midi: number): () => void  // 停止関数を返す
```

`startNote` の実装：
- `getAudioContext()` を呼んで AudioContext を取得・resume
- オシレーター（triangle）＋ゲインノードを作成
- アタック後に一定音量でサステイン
- 返した停止関数が呼ばれたらリリースして `osc.stop()`

---

## 8. 状態管理（`+page.svelte` 集中）

```ts
let rootId = $state('C')
let mode = $state<'scale' | 'chord'>('scale')
let scaleId = $state('major')
let chordId = $state('maj')
let bpm = $state(DEFAULT_BPM)
let anchorToRoot = $state(false)
let playingPcs = $state(new Set<number>())

function addPlayingPc(pc: number) { playingPcs = new Set(playingPcs).add(pc) }
function removePlayingPc(pc: number) { const s = new Set(playingPcs); s.delete(pc); playingPcs = s }

const root = $derived(ROOTS.find(r => r.id === rootId)!)
const currentIntervals = $derived(/* mode に応じて scaleId or chordId から取得 */)
const diatonicChords = $derived(buildDiatonicChords(currentIntervals, root.pc))
const keyboard = $derived(buildKeyboardWindow(anchorToRoot ? root.pc : 0))
```

`addPlayingPc` / `removePlayingPc` は各再生コンポーネントに prop として渡す。

---

## 9. コンポーネント設計

### `RootSelector.svelte`
- `bind:rootId`
- 12音をボタングリッド表示

### `ScaleChordSelector.svelte`
- `bind:mode`, `bind:scaleId`, `bind:chordId`
- モード切替タブ（スケール/コード）
- グループ見出し付きのリスト

### `PianoKeyboard.svelte`
- Props: `whiteKeys`, `blackKeys`, `intervals`, `rootPc`, `playingPcs`, `addPlayingPc`, `removePlayingPc`
- SVG描画（viewBox `0 0 336 180`）
- 白鍵→黒鍵の順でレンダリング（黒鍵が前面）
- 視覚スタイル（後述§10）
- 鍵盤タップ: `onpointerdown` → `startNote(midi)`、`onpointerup`/`onpointerleave` → 停止関数呼び出し

### `BpmSlider.svelte`
- `bind:bpm`（MIN_BPM〜MAX_BPM）
- 既存 BpmInput.svelte（note-duration用）を参考に、スライダー専用コンポーネントとして実装

### `DiatonicChordPanel.svelte`
- Props: `diatonicChords`, `bpm`, `addPlayingPc`, `removePlayingPc`
- 7和音をボタン表示（ローマ数字 + コード名）
- タップで2分音符の同時再生

### `ProgressionPlayer.svelte`
- Props: `diatonicChords`, `bpm`, `addPlayingPc`, `removePlayingPc`, `onProgressionStart`, `onProgressionStop`
- 5プリセットをボタン表示（トグル再生）
- 再帰 setTimeout でループ
- ルート/スケール/BPM変更時に自動停止（親が `$effect` で監視し停止命令を送る）

### `MelodyGenerator.svelte`
- Props: `intervals`, `rootPc`, `bpm`, `addPlayingPc`, `removePlayingPc`
- 小節数（1/2/4/8）・音符範囲スライダー・付点/3連チェックボックス
- 生成結果をキャッシュ → 再生ボタンで同じフレーズを再再生

---

## 10. 鍵盤の視覚スタイル（クリーン＆モダン、ティール配色）

| 状態 | 白鍵 | 黒鍵 |
|---|---|---|
| 非構成音 | `fill: #f9fafb; opacity: 0.32` | `fill: #111827; opacity: 0.32` |
| 構成音（非ルート） | `fill: #f9fafb; stroke: #14b8a6; stroke-width: 2` | `fill: #111827; stroke: #14b8a6; stroke-width: 2` |
| ルート音 | 構成音と同様 + 下部にティール丸マーカー（r=5） | 同様 + マーカー |
| 再生中（アクティブリング） | 別 `<rect>` でティール枠線を重ねる（opacity 1） | 別 `<rect>` でティール枠線を重ねる |

アクティブリングは独立した SVG グループとして最前面に描画し、グレーアウトの opacity 影響を受けない。

---

## 11. 再生タイミング仕様

スペック §7 の仕様をそのまま採用。変更点のみ記載：

**§7.1 鍵盤タップ（変更）**
- 旧: `playNoteAt(ctx, midi, 0.4, ctx.currentTime)`
- 新: `startNote(midi)` → pointer up/leave で停止。BPMに連動しない。

その他（§7.2〜7.5）はスペック通り。

---

## 12. 進行ループの自動停止

`+page.svelte` で `$effect` を使い、ルート/スケール/モード/BPM の変更を検知してループ停止を発火する。

```ts
$effect(() => {
  rootId; scaleId; chordId; mode; bpm;  // 依存関係を宣言
  progressionPlayerRef?.stop();
})
```

`ProgressionPlayer.svelte` は `bind:this={progressionPlayerRef}` で参照を渡す（または stop 関数を callback で受け取る）。

---

## 13. 同時再生時のハイライト（加算/減算方式）

スペック §8 の通り。各再生源は自分が発光させた pc を自分で後始末する。進行ループの手動停止時も一括クリアしない。

---

## 14. `site.ts` への追加

```ts
{ href: "/scale-visualizer", label: "スケールビジュアライザー(開発中)", description: "スケール・コードを鍵盤で確認し、コード進行やメロディを試せるツール", visible: true, category: 'music' }
```

---

## 15. 受け入れ条件

スペック §11 の全チェックリストを満たすこと。加えて：

- [ ] 鍵盤キーを押している間だけ音が鳴り、離すと止まる
- [ ] ページレイアウトが左サイドバー＋メインエリアの2カラム（スマホでは縦積み）
- [ ] 非構成音がグレーアウトし、地色（白/黒）自体は変化しない
- [ ] アクティブリングが opacity の影響を受けず常に視認できる
