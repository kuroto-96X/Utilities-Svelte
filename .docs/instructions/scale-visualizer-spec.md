# 実装スペック: スケール／コードビジュアライザー（scale-visualizer）

## 1. 概要

ルート音とスケール／コードを選ぶと、1オクターブの鍵盤上にその構成音を表示し、タップやボタンで実際に音を鳴らせるツール。スケールモードでは作曲のヒントとして、ダイアトニックコード表示・コード進行プリセットのループ再生・ランダムメロディ生成も提供する。

### 含める機能
- ルート音選択（12音、シャープ表記）
- モード切替（スケール／コード）
- スケール15種（基本6・モード5・和風その他4、グループ表示）
- コード13種（トライアド4・セブンス3・テンション/サスペンド6、グループ表示）
- 鍵盤表示の起点切替（Cから表示／ルート音から表示）
- 鍵盤タップで単音再生
- メイン再生ボタン（スケール＝往復再生、コード＝同時再生）
- ダイアトニックコード表示・タップ再生（7音スケール限定）
- コード進行プリセット5種のループ再生（開始/停止、排他制御）
- ランダムメロディ生成（小節数・使用音符の範囲・付点/3連トグル、BPM設定）
- 上記すべての再生機能はBPMに連動したタイミングで再生される
- メロディ生成はコード進行ループを止めずに重ねて再生できる

### 含めない／既知の単純化
- 黒鍵は常にシャープ表記固定（調に応じたフラット表記には対応しない）
- 鍵盤表示は1オクターブのみ
- 拍子は4/4固定（小節数設定はこれを前提に拍数へ変換する）
- ダイアトニックコード／コード進行は7音スケール（基本・モードグループ）でのみ有効。5音・6音スケール（ペンタトニック・ブルース・ホールトーン）では非表示
- 進行ループ再生中にBPMを変更すると、その場のテンポ追従はせずループを停止する（再開時に新しいBPMが反映される）

---

## 2. ルーティング / ファイル構成

```
src/routes/scale-visualizer/
  +page.svelte

src/lib/
  noteDuration.ts            # 既存（note-duration ツールで作成済み）。BPM⇔秒変換ロジックを再利用する
  scaleData.ts                # ROOTS / SCALE_GROUPS / CHORD_GROUPS / PROGRESSIONS
  pianoLayout.ts               # 鍵盤レイアウト計算（buildKeyboardWindow）
  diatonicChords.ts            # ダイアトニックコード自動生成（romanFor 含む）
  audioEngine.ts                # AudioContext管理・単音再生
  components/
    PianoKeyboard.svelte        # 鍵盤SVG本体（タップ再生・ハイライト）
    RootSelector.svelte
    ScaleChordSelector.svelte   # グループ分けされたスケール/コード選択
    BpmSlider.svelte
    MelodyGenerator.svelte
    DiatonicChordPanel.svelte
    ProgressionPlayer.svelte
```

> ルート名 `scale-visualizer` は仮称。変更可。

---

## 3. 既存ロジックの再利用（重要）

BPM⇔秒の変換、クランプ、付点/3連の計算は `src/lib/noteDuration.ts`（note-duration ツールで作成済み）に既に実装されている。本ツールはこれを重複実装せず再利用する。

```ts
import { clampBpm, calculateNoteDurations, MIN_BPM, MAX_BPM, DEFAULT_BPM } from '$lib/noteDuration';
```

`calculateNoteDurations(bpm)` は全音符〜32分音符の6種について `{ id, label, normalSec, dottedSec, tripletSec }` を返す。本ツールのメロディ生成で使う「使用する音符の範囲（最小・最大）＋付点/3連トグル」は、この戻り値を全音符→32分音符の順から **反転（32分音符→全音符）** した配列に対して、スライダーのインデックス（0=32分音符 〜 5=全音符）でスライスし、`normalSec` / `dottedSec` / `tripletSec` を候補プールに加えることで実現する（後述7.5）。

---

## 4. データモデル（`src/lib/scaleData.ts`）

```ts
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
    { id: 'major', label: '長調（メジャー）', intervals: [0,2,4,5,7,9,11] },
    { id: 'minor', label: '短調（マイナー）', intervals: [0,2,3,5,7,8,10] },
    { id: 'majorPenta', label: 'メジャーペンタトニック', intervals: [0,2,4,7,9] },
    { id: 'minorPenta', label: 'マイナーペンタトニック', intervals: [0,3,5,7,10] },
    { id: 'blues', label: 'ブルース', intervals: [0,3,5,6,7,10] },
    { id: 'harmonicMinor', label: 'ハーモニックマイナー', intervals: [0,2,3,5,7,8,11] },
  ]},
  { group: 'モード', items: [
    { id: 'dorian', label: 'ドリアン', intervals: [0,2,3,5,7,9,10] },
    { id: 'phrygian', label: 'フリジアン', intervals: [0,1,3,5,7,8,10] },
    { id: 'lydian', label: 'リディアン', intervals: [0,2,4,6,7,9,11] },
    { id: 'mixolydian', label: 'ミクソリディアン', intervals: [0,2,4,5,7,9,10] },
    { id: 'locrian', label: 'ロクリアン', intervals: [0,1,3,5,6,8,10] },
  ]},
  { group: '和風・その他', items: [
    { id: 'ritsu', label: '律音階', intervals: [0,2,5,7,9] },
    { id: 'miyakobushi', label: '都節音階', intervals: [0,1,5,7,8] },
    { id: 'ryukyu', label: '琉球音階（沖縄）', intervals: [0,4,5,7,11] },
    { id: 'wholeTone', label: 'ホールトーン', intervals: [0,2,4,6,8,10] },
  ]},
];
export const SCALES = SCALE_GROUPS.flatMap(g => g.items);

export const CHORD_GROUPS: Group[] = [
  { group: 'トライアド', items: [
    { id: 'maj', label: 'メジャー', intervals: [0,4,7] },
    { id: 'min', label: 'マイナー', intervals: [0,3,7] },
    { id: 'dim', label: 'ディミニッシュ', intervals: [0,3,6] },
    { id: 'aug', label: 'オーグメント', intervals: [0,4,8] },
  ]},
  { group: 'セブンス', items: [
    { id: 'maj7', label: 'メジャー7th', intervals: [0,4,7,11] },
    { id: 'min7', label: 'マイナー7th', intervals: [0,3,7,10] },
    { id: 'dom7', label: 'ドミナント7th', intervals: [0,4,7,10] },
  ]},
  { group: 'テンション・サスペンド', items: [
    { id: 'sus2', label: 'sus2', intervals: [0,2,7] },
    { id: 'sus4', label: 'sus4', intervals: [0,5,7] },
    { id: 'add9', label: 'add9', intervals: [0,2,4,7] },
    { id: 'maj9', label: 'メジャー9th', intervals: [0,2,4,7,11] },
    { id: 'min9', label: 'マイナー9th', intervals: [0,2,3,7,10] },
    { id: 'dom9', label: 'ドミナント9th', intervals: [0,2,4,7,10] },
  ]},
];
export const CHORDS = CHORD_GROUPS.flatMap(g => g.items);

export interface Progression { id: string; label: string; degrees: number[]; }
export const PROGRESSIONS: Progression[] = [
  { id: 'kingRoad', label: '王道進行（IV-V-iii-vi）', degrees: [3,4,2,5] },
  { id: 'canon', label: 'カノン進行', degrees: [0,4,5,2,3,0,3,4] },
  { id: 'axis', label: 'ポップパンク（I-V-vi-IV）', degrees: [0,4,5,3] },
  { id: 'fifties', label: '50年代進行（I-vi-IV-V）', degrees: [0,5,3,4] },
  { id: 'twoFiveOne', label: 'ジャズ ii-V-I', degrees: [1,4,0] },
];
```

`PROGRESSIONS.degrees` は7音スケールのダイアトニックコード配列（後述5.）のインデックス（0=I 〜 6=VII）を指す。7音スケール以外が選択されている間はコード進行・ダイアトニックコードのUIごと非表示にする。

---

## 5. 鍵盤レイアウトアルゴリズム（`src/lib/pianoLayout.ts`）

鍵盤は常に12音（1オクターブ）を表示するが、「ルート音から表示」を選んだ場合は表示開始位置（半音オフセット）をルート音のpitch classにずらす。白鍵・黒鍵の形と並びは実際のピアノの物理配置をそのまま使うため、開始位置をずらしても各鍵盤本来の白黒・形状は変わらない（抽象的な並べ替えではなく「窓をスライドさせる」実装にする）。

```ts
type KeyType = 'white' | 'black';

const PC_INFO: Record<number, { type: KeyType; whiteIndex?: number; afterWhiteIndex?: number }> = {
  0: { type: 'white', whiteIndex: 0 },
  1: { type: 'black', afterWhiteIndex: 0 },
  2: { type: 'white', whiteIndex: 1 },
  3: { type: 'black', afterWhiteIndex: 1 },
  4: { type: 'white', whiteIndex: 2 },
  5: { type: 'white', whiteIndex: 3 },
  6: { type: 'black', afterWhiteIndex: 3 },
  7: { type: 'white', whiteIndex: 4 },
  8: { type: 'black', afterWhiteIndex: 4 },
  9: { type: 'white', whiteIndex: 5 },
  10: { type: 'black', afterWhiteIndex: 5 },
  11: { type: 'white', whiteIndex: 6 },
};

export const WHITE_W = 48, WHITE_H = 180, BLACK_W = 28, BLACK_H = 112;
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

  const whiteKeys = items.filter(it => it.type === 'white')
    .map(it => ({ pc: it.pc, windowIndex: it.windowIndex, x: (it.absWhiteIndex! - minAbs) * WHITE_W }));

  const blackKeys = items.filter(it => it.type === 'black')
    .map(it => ({ pc: it.pc, windowIndex: it.windowIndex, x: (it.absAnchorIndex! - minAbs + 1) * WHITE_W - BLACK_W / 2 }));

  return { whiteKeys, blackKeys };
}
```

呼び出し側: `buildKeyboardWindow(anchorToRoot ? root.pc : 0)`。どちらのモードでも常に7白鍵+5黒鍵になる（12連続半音には必ずこの構成が含まれるため）。

**鍵盤タップ時の再生音程**は `windowIndex`（0〜11、表示上の左から右の位置）を使い `midi = 60 + windowIndex` とする。これにより「ルート音から表示」で窓がずれていても、左から右へタップした音が必ず音程的に上行する（pcそのもの基準で計算すると窓の先頭がオクターブを跨ぐ場合に音程が逆転するため）。

---

## 6. ダイアトニックコード自動生成（`src/lib/diatonicChords.ts`）

7音スケールに対して「スケール内で3度ずつ積む」方式で各scale degreeの三和音を導出する。

```ts
function romanFor(thirdSemi: number, fifthSemi: number, idx: number) {
  const ROMAN = ['I','II','III','IV','V','VI','VII'];
  let base = ROMAN[idx];
  let quality: 'maj'|'min'|'dim'|'aug'|'other' = 'other';
  if (thirdSemi === 4 && fifthSemi === 7) quality = 'maj';
  else if (thirdSemi === 3 && fifthSemi === 7) quality = 'min';
  else if (thirdSemi === 3 && fifthSemi === 6) quality = 'dim';
  else if (thirdSemi === 4 && fifthSemi === 8) quality = 'aug';
  if (quality === 'min' || quality === 'dim') base = base.toLowerCase();
  if (quality === 'dim') base += '°';
  if (quality === 'aug') base += '+';
  return { base, quality };
}

export interface DiatonicChord {
  degreeIndex: number; roman: string; quality: string; rootPc: number; intervals: [number, number, number];
}

export function buildDiatonicChords(intervals: number[], rootPc: number): DiatonicChord[] | null {
  if (intervals.length !== 7) return null;
  const extended = [...intervals, ...intervals.map(v => v + 12)];
  return intervals.map((deg, d) => {
    const thirdSemi = extended[d + 2] - extended[d];
    const fifthSemi = extended[d + 4] - extended[d];
    const { base, quality } = romanFor(thirdSemi, fifthSemi, d);
    return { degreeIndex: d, roman: base, quality, rootPc: (rootPc + deg) % 12, intervals: [0, thirdSemi, fifthSemi] };
  });
}
```

検証済み: Cメジャーで `I, ii, iii, IV, V, vi, vii°`、Aマイナーで `i, ii°, III, iv, v, VI, VII` を正しく返す。7音以外のスケール（ペンタトニック・ブルース・ホールトーン）では `null` を返し、呼び出し側はダイアトニックコード／コード進行UIを非表示にする。

---

## 7. 再生機能とタイミング仕様

すべて `src/lib/audioEngine.ts` の共通関数を使う。

```ts
let ctx: AudioContext | null = null;
export function getAudioContext(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
export function freqFromMidi(midi: number) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}
export function playNoteAt(audioCtx: AudioContext, midi: number, duration: number, startTime: number) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const attack = Math.min(0.012, duration * 0.3); // 短い音価でもアタックがdurationを超えないようにする
  osc.type = 'triangle';
  osc.frequency.value = freqFromMidi(midi);
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(0.2, startTime + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}
```

ブラウザのポリシー上、`AudioContext` の生成・resumeはユーザー操作（クリック/タップ）のハンドラ内で行うこと。

### 7.1 鍵盤タップ（単音）
固定0.4秒、即時再生。BPMに連動しない（探索用のプレビュー再生のため）。

### 7.2 メイン再生ボタン
- **コードモード**: 全構成音を同時再生。`duration = (60 / bpm) * 2`（2分音符）。
- **スケールモード（往復）**: ルート→上行→トップ音→下行→ルートの順。トップ音を2回連続再生しないよう、配列は `[...intervals, ...intervals.slice(0, -1).reverse()]` とする。各音の間隔 `SPACING = (60 / bpm) * 0.5`（8分音符）、各音の鳴動時間は `SPACING * 0.85`。

### 7.3 ダイアトニックコードタップ
そのコードの全音を同時再生。`duration = (60 / bpm) * 2`（2分音符）。

### 7.4 コード進行プリセットのループ再生
1ステップ＝1コードを2分音符分のスペーシングで進行し、`prog.degrees` を周期的に繰り返す。

```ts
const STEP_SPACING = (60 / bpm) * 2;     // 2分音符
const CHORD_DURATION = STEP_SPACING * 0.9;
```

実装は再帰的な `setTimeout` をスケジュールし、`{ active: boolean; progId: string | null; timeoutId }` を保持するrefで停止可能にする。停止条件は以下の通り、いずれかが発生したら自動停止する。
- 同じプリセットを再タップ（トグルでオフ）
- 別プリセットをタップ（切り替え）
- ルート音／スケール／モード／BPMの変更
- メイン再生ボタンやダイアトニックコードタップを実行（※メロディ生成では停止しない、7.5参照）

同時に複数のプリセットはループさせない（排他制御）。

### 7.5 ランダムメロディ生成

**重要: このアクションはコード進行ループを停止しない。** ループ再生中にメロディを生成すると、両方が同時に鳴る（作曲時に「進行をループさせながらメロディのアイデアを探す」使い方を想定しているため）。

入力:
- `bars`: 1 / 2 / 4 / 8（小節数、4/4拍子前提）
- `minNoteIdx` / `maxNoteIdx`: 0〜5（32分音符〜全音符のインデックス範囲、両端含む）
- `useDotted` / `useTriplet`: チェックボックス

```ts
// note-duration.ts の並び（全音符→32分音符）を反転して使う
const NOTE_VALUES_ASC = [...calculateNoteDurations(bpm)].reverse(); // index0=32分音符 ... index5=全音符

function buildDurationPool(minIdx: number, maxIdx: number, useDotted: boolean, useTriplet: boolean): number[] {
  const slice = NOTE_VALUES_ASC.slice(minIdx, maxIdx + 1);
  const pool: number[] = [];
  slice.forEach(nv => {
    pool.push(nv.normalSec);
    if (useDotted) pool.push(nv.dottedSec);
    if (useTriplet) pool.push(nv.tripletSec);
  });
  return pool;
}

function generateMelody(/* ...current settings... */) {
  const pool = buildDurationPool(minNoteIdx, maxNoteIdx, useDotted, useTriplet);
  const secPerBeat = 60 / bpm;
  const targetSeconds = Math.max(secPerBeat, bars * 4 * secPerBeat - secPerBeat); // 最後の1拍はルート音の着地に予約

  const seq: { interval: number; pc: number; duration: number }[] = [];
  let cumulative = 0;
  let guard = 0;
  while (cumulative < targetSeconds && guard < 300) {
    guard++;
    const deg = intervals[Math.floor(Math.random() * intervals.length)];
    const octShift = Math.random() < 0.25 ? 12 : 0;
    const duration = pool[Math.floor(Math.random() * pool.length)];
    seq.push({ interval: deg + octShift, pc: (rootPc + deg) % 12, duration });
    cumulative += duration;
  }
  seq.push({ interval: 0, pc: rootPc, duration: secPerBeat }); // 最後はルートに着地
  return seq;
}
```

ガード変数 `guard` は理論上発生しない無限ループを防ぐための安全装置。生成結果はチップ表示し、再生ボタンで同じフレーズを再再生できるようにする（再生のたびに生成し直さない）。

---

## 8. 同時再生時のハイライト方式（加算/減算方式・重要）

進行ループとメロディ生成を同時に鳴らせるようにしたため、「現在再生中のpitch class集合」は **置き換え（replace）ではなく加算/減算（add/remove）** で管理する。

```ts
// NG: 他の再生源の発光を消してしまう
setPlayingPcs(new Set([pc]));

// OK: この音の分だけ追加・削除する
function addPlayingPc(pc: number) { playingPcs = new Set(playingPcs).add(pc); }
function removePlayingPc(pc: number) { const s = new Set(playingPcs); s.delete(pc); playingPcs = s; }
```

各再生関数（7.1〜7.5）は音の開始時に対象pcを `addPlayingPc`、音価が終わるタイミングで `removePlayingPc` をスケジュールする。進行ループを手動停止した際も、全体を一括クリアしない（鳴っている最中の他の音源のハイライトを誤って消さないため）。各ステップは自分の発光を自分で後始末する。

---

## 9. 鍵盤の視覚表現

- 白鍵・黒鍵とも地色は常に保持する（スケール外だからといって色を塗り替えない）
- スケール外（非構成音）の鍵は不透明度を下げてグレーアウトする（`opacity: 0.32` 程度）。構成音は不透明度1のまま
- ルート音のみ、小さな塗り色の円マーカー（リング付き）を鍵の下部に重ねる。構成音（ルート以外）にはマーカーを付けない
- 現在再生中（`playingPcs` に含まれる）の鍵は、上記のグレーアウト/マーカーとは別レイヤーで、鍵の輪郭に色付きの枠線（アクティブリング）を重ねる。グレーアウトの不透明度に影響されないよう、ハイライト枠は不透明度1の別グループとして描画する

---

## 10. UIコンポーネント構成案（Svelte）

| コンポーネント | 役割 | 主なprops |
|---|---|---|
| `RootSelector.svelte` | 12音のルート選択 | `bind:rootId` |
| `ScaleChordSelector.svelte` | モード切替＋グループ分けされたスケール/コード選択 | `bind:mode`, `bind:scaleId`, `bind:chordId` |
| `PianoKeyboard.svelte` | 鍵盤SVG、タップ再生、グレーアウト/マーカー/アクティブリング描画 | `intervals`, `rootPc`, `anchorToRoot`, `playingPcs`, `on:keyTap` |
| `BpmSlider.svelte` | BPMスライダー（20〜300） | `bind:bpm` |
| `MelodyGenerator.svelte` | 小節数・音符範囲スライダー・付点/3連チェックボックス・生成ボタン・結果表示 | `intervals`, `rootPc`, `bpm` |
| `DiatonicChordPanel.svelte` | 7音スケール時のみ表示、ダイアトニックコードのタップ再生 | `intervals`, `rootPc`, `bpm` |
| `ProgressionPlayer.svelte` | コード進行プリセットのループ再生UI | `diatonicChords`, `bpm` |

`playingPcs` は親（`+page.svelte`）で一元管理し、`addPlayingPc`/`removePlayingPc` を子コンポーネントに渡すか、Svelteのストアとして共有する。

---

## 11. 受け入れ条件（チェックリスト）

- [ ] ルート音12種、モード（スケール/コード）、スケール15種／コード13種をグループ表示で選択できる
- [ ] 「Cから表示」「ルート音から表示」の切替で鍵盤の窓が正しくスライドし、白黒鍵の形状は崩れない
- [ ] 鍵盤タップで単音が鳴り、表示位置に応じて左から右へ音程が上行する
- [ ] スケール外の鍵はグレーアウトされ、地色（白黒）自体は変化しない
- [ ] ルート音にのみ識別用マーカーが表示される
- [ ] メイン再生ボタンは、スケールでは往復（上行して下行）、コードでは同時再生になる
- [ ] 7音スケール選択時のみダイアトニックコードとコード進行プリセットが表示され、タップ/トグルで再生できる
- [ ] コード進行ループは1つだけ排他的に再生され、ルート/スケール/モード/BPM変更で自動停止する
- [ ] ランダムメロディ生成は小節数・音符範囲・付点/3連の設定を反映し、コード進行ループを止めずに重ねて再生できる
- [ ] 複数の再生源が重なっても、互いのキーボードハイライトを消し合わない（加算/減算方式）
- [ ] BPMスライダーの値が、上記すべてのタイミングに反映される（鍵盤タップ単音を除く）
- [ ] `noteDuration.ts` のBPMクランプ・秒数計算ロジックを重複実装していない

---

## 12. 前提・既知の制約

- 拍子は4/4固定。他拍子への対応は未実装
- 黒鍵はシャープ表記固定（調にあわせたフラット表記は未対応）
- 進行ループ再生中のBPM変更はループを止める仕様（動的テンポ追従は未対応）
- ビジュアルデザイン（配色・フォント等）はプロトタイプのピアノ／木目調デザインを参考にしてよいが必須ではない。プロジェクトの既存デザインに合わせて調整可
