# 実装スペック: BPM音符換算ツール（note-duration）

## 1. 概要

BPMを入力すると、32分音符〜全音符までの長さを秒単位で表示するツール。
SvelteKitプロジェクト内の新規ルートとして、既存の `image-tools` / `sns-image-resize` / `id-photo` と同様の構成（共有コンポーネントを `src/lib/` に置き、ページは `src/routes/` 配下）で実装する。

### 含めるもの
- BPM入力（数値入力・スライダー・±ステッパー）
- 全音符〜32分音符（6種類）の長さをリアルタイム表示
- 各音符の記号（SVGアイコン）表示
- 通常・付点・3連符の3種類の値を、各音符行の右側に常時表示（折りたたみなし）
- 他ページ（BPMTapperなど）から `?bpm=` 付きでリンクされた場合に、そのBPMを引き継いで表示する
- 既存のad-slot枠（`ad-slot--top` / `ad-slot--in-content`）

### 含めないもの（前バージョンからの変更点）
- タップでBPMを検出するボタン・機能は実装しない（BPMTapper側の機能のため、本ツールには持たない）

---

## 2. ルーティング / ファイル構成

```
src/routes/note-duration/
  +page.svelte

src/lib/
  noteDuration.ts          # 計算ロジック（型・定数・関数）
  components/
    NoteIcon.svelte         # 音符記号（SVG）
    BpmInput.svelte         # BPM入力UI（数値・スライダー・±）
    NoteDurationTable.svelte # 音符ごとの秒数テーブル
```

> ルート名 `note-duration` は仮称です。SEOやURL設計の都合で変更して問題ありません。

---

## 3. 計算ロジック（`src/lib/noteDuration.ts`）

```ts
export type NoteId = 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth' | 'thirtysecond';

export interface NoteSymbol {
  filled: boolean;        // true: 塗り符頭 / false: 中抜き符頭
  stem: boolean;           // true: 符幹あり
  flags: 0 | 1 | 2 | 3;     // 旗の数
}

export interface NoteDuration {
  id: NoteId;
  label: string;       // 例: '4分音符'
  fraction: string;    // 例: '1/4'
  symbol: NoteSymbol;
  normalSec: number;
  dottedSec: number;
  tripletSec: number;
}

export const MIN_BPM = 20;
export const MAX_BPM = 300;
export const DEFAULT_BPM = 120;

export function clampBpm(bpm: number): number {
  if (Number.isNaN(bpm)) return DEFAULT_BPM;
  return Math.min(MAX_BPM, Math.max(MIN_BPM, bpm));
}

const NOTE_DEFS: Array<Omit<NoteDuration, 'normalSec' | 'dottedSec' | 'tripletSec'> & { mult: number }> = [
  { id: 'whole',        label: '全音符',   fraction: '1/1',  mult: 4,     symbol: { filled: false, stem: false, flags: 0 } },
  { id: 'half',         label: '2分音符',  fraction: '1/2',  mult: 2,     symbol: { filled: false, stem: true,  flags: 0 } },
  { id: 'quarter',      label: '4分音符',  fraction: '1/4',  mult: 1,     symbol: { filled: true,  stem: true,  flags: 0 } },
  { id: 'eighth',       label: '8分音符',  fraction: '1/8',  mult: 0.5,   symbol: { filled: true,  stem: true,  flags: 1 } },
  { id: 'sixteenth',    label: '16分音符', fraction: '1/16', mult: 0.25,  symbol: { filled: true,  stem: true,  flags: 2 } },
  { id: 'thirtysecond', label: '32分音符', fraction: '1/32', mult: 0.125, symbol: { filled: true,  stem: true,  flags: 3 } },
];

/**
 * BPMから各音符の長さ（秒）を計算する。
 * normalSec: 通常の音符の長さ
 * dottedSec: 付点（×1.5）
 * tripletSec: 3連符（×2/3）
 */
export function calculateNoteDurations(bpm: number): NoteDuration[] {
  const safeBpm = bpm > 0 ? bpm : DEFAULT_BPM;
  const quarterSec = 60 / safeBpm;

  return NOTE_DEFS.map(({ mult, ...rest }) => {
    const normalSec = quarterSec * mult;
    return {
      ...rest,
      normalSec,
      dottedSec: normalSec * 1.5,
      tripletSec: normalSec * (2 / 3),
    };
  });
}

export function formatSec(sec: number): string {
  return sec.toFixed(3);
}

export function formatMs(sec: number): string {
  return (sec * 1000).toFixed(1);
}
```

---

## 4. コンポーネント仕様

### 4.1 `NoteIcon.svelte`（音符記号）

Unicode音楽記号（U+1D100台）はフォント依存で環境によって表示が崩れるため、**SVGで自前描画**する。`currentColor` でテーマカラーに追従させる。

**Props**

| prop | 型 | 説明 |
|---|---|---|
| `filled` | `boolean` | 符頭を塗りにするか中抜きにするか |
| `stem` | `boolean` | 符幹（縦線）を描くか |
| `flags` | `0 \| 1 \| 2 \| 3` | 旗の数（8分=1, 16分=2, 32分=3） |
| `size` | `number`（任意, デフォルト24） | 表示サイズ(px) |

**構造の指針**（viewBox `0 0 24 24` を想定）
- 符頭: 楕円（`ellipse`）を約-20度回転、`filled` の真偽で `fill="currentColor"` か `stroke="currentColor" fill="none"` を切り替え
- 符幹: 符頭の右端から上方向への縦線（`stem=false` の場合は描画しない＝全音符）
- 旗: 符幹の先端から右に伸びる曲線パスを `flags` の数だけ縦に並べて描画

**実装例（8分音符: filled + stem + 1 flag）**
```html
<svg viewBox="0 0 24 24" width={size} height={size} xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="8" cy="17" rx="4" ry="3" transform="rotate(-20 8 17)"
    fill={filled ? 'currentColor' : 'none'}
    stroke={filled ? 'none' : 'currentColor'} stroke-width="1.5" />
  {#if stem}
    <line x1="11.5" y1="15" x2="11.5" y2="3" stroke="currentColor" stroke-width="1.5" />
  {/if}
  {#each Array(flags) as _, i}
    <path d={`M11.5 ${3 + i * 3} C16 ${4 + i * 3}, 17 ${8 + i * 3}, 14 ${11 + i * 3}`}
      stroke="currentColor" stroke-width="1.5" fill="none" />
  {/each}
</svg>
```

全音符（`stem=false`）は符幹を描かず、符頭のみ（中抜き）で表現する。

---

### 4.2 `BpmInput.svelte`（BPM入力UI）

数値入力・スライダー・±ボタンの3点セット。タップ検出は持たない。

**Props / バインディング**

| prop | 型 | 説明 |
|---|---|---|
| `bpm` | `number`（`bind:bpm` で双方向） | 現在のBPM |
| `min` | `number`（デフォルト `MIN_BPM`） | 下限 |
| `max` | `number`（デフォルト `MAX_BPM`） | 上限 |

**挙動**
- 数値入力欄はタイピング中はクランプしない（途中入力を妨げない）。`blur` 時に `clampBpm()` で範囲内に補正する。
- ±ボタン・スライダーは常に `clampBpm()` を通す。
- ゼロ除算防止のため、計算側 (`calculateNoteDurations`) は `bpm <= 0` を `DEFAULT_BPM` にフォールバックする。

---

### 4.3 `NoteDurationTable.svelte`（音符ごとの秒数テーブル）

**重要: 通常・付点・3連は折りたたみにせず、常に同時表示する。**

レイアウトはテーブル形式を推奨（各音符1行、列は左から「音符記号＋名称」「通常」「付点」「3連」）。

```
| 音符              | 通常      | 付点      | 3連       |
|-------------------|-----------|-----------|-----------|
| ♩ 全音符 (1/1)     | 2.000s    | 3.000s    | 1.333s    |
| ♩ 2分音符 (1/2)    | 1.000s    | 1.500s    | 0.667s    |
| ♩ 4分音符 (1/4)    | 0.500s    | 0.750s    | 0.333s    |
| ♩ 8分音符 (1/8)    | 0.250s    | 0.375s    | 0.167s    |
| ♩ 16分音符 (1/16)  | 0.125s    | 0.188s    | 0.083s    |
| ♩ 32分音符 (1/32)  | 0.063s    | 0.094s    | 0.042s    |
```
（上表はBPM=120の場合の例。♩は説明用の仮表記で、実際は `NoteIcon` を使用する）

**Props**

| prop | 型 |
|---|---|
| `durations` | `NoteDuration[]`（親から `calculateNoteDurations(bpm)` の結果を渡す） |

**各セルの表示形式**
- 秒数を主表示: `formatSec(value)` + `"s"`（例: `0.500s`）
- ms表示を補助で小さく併記してよい: `formatMs(value)` + `"ms"`（任意。秒数表示は必須、ms併記は推奨だが必須ではない）

**レスポンシブ対応**
- 狭い画面でも通常・付点・3連の3列は省略・非表示にしない。列幅を縮める／フォントサイズを小さくする／横スクロールにする等で対応し、情報を隠さないこと。

---

## 5. 他ページからのBPM引き継ぎ

本ツールはタップ検出機能を持たず、リンクを「作る」側ではなく「受け取る」側になる。BPMTapperなど他のページ・ツールが、検出/設定したBPMを `?bpm=` 付きのURLで本ツールにリンクし、本ツールはそれを読み取って初期表示に反映する。

**契約（コントラクト）**
- パラメータ名: `bpm`
- 値: 数値（整数または小数）。例: `/note-duration?bpm=128`
- 本ツール側は値を `clampBpm()` で20〜300に補正してから使用する
- 本ツールから他ページへリンクを作る実装は不要（リンク作成は呼び出し元のページの責務）

**実装（ページマウント時にクエリを読み取る）**

```ts
import { page } from '$app/stores';
import { onMount } from 'svelte';
import { clampBpm, DEFAULT_BPM } from '$lib/noteDuration';

let bpm = DEFAULT_BPM;

onMount(() => {
  const param = $page.url.searchParams.get('bpm');
  if (param) {
    const parsed = parseFloat(param);
    if (!Number.isNaN(parsed)) {
      bpm = clampBpm(parsed);
    }
  }
});
```

> **前提・要確認事項**: BPMTapper（または他のツール）からリンクする際のパラメータ名が `bpm` で揃っていることを確認してください。名称が異なる場合は、リンク元側か本ツールのどちらかを合わせる必要があります。

---

## 6. ページ構成（`+page.svelte`）

```
<svelte:head>
  <title>BPM音符換算ツール｜32分音符〜全音符の秒数を計算</title>
  <meta name="description" content="BPMを入力するだけで、全音符から32分音符までの長さを秒・msで自動計算。付点・3連符にも対応した楽曲制作向けツール。" />
</svelte:head>

<div class="ad-slot ad-slot--top"></div>

<h1>BPM音符換算ツール</h1>
<p>BPMを入力すると、32分音符から全音符までの長さを表示します。</p>

<BpmInput bind:bpm />

<div class="ad-slot ad-slot--in-content"></div>

<NoteDurationTable durations={calculateNoteDurations(bpm)} />
```

GA4のページビュー計測は既存の `+layout.svelte` の `afterNavigate` フックで全ルート共通対応済みのため、本ページ単体での追加実装は不要。

---

## 7. 受け入れ条件（チェックリスト）

- [ ] BPM入力（数値入力・スライダー・±ボタン）でテーブルがリアルタイムに更新される
- [ ] タップでBPMを検出するボタン・機能は実装されていない
- [ ] 本ツールから他ページへのリンク（BPMTapperへのリンクなど）は実装されていない
- [ ] URLに `?bpm=` が付いている場合、ページ読み込み時にその値が初期表示される
- [ ] 全音符・2分音符・4分音符・8分音符・16分音符・32分音符の6種類が表示される
- [ ] 各音符行にSVGの音符記号（符頭・符幹・旗）が表示される
- [ ] 通常・付点・3連符の3種類の秒数が、各音符行の右側に**常時**表示される（クリックや展開操作なしで見える）
- [ ] BPMが20〜300にクランプされ、0や負の値でも計算が破綻しない（ゼロ除算なし）
- [ ] `ad-slot--top` / `ad-slot--in-content` が配置されている
- [ ] 既存のGA4計測がこのルートでも機能している
