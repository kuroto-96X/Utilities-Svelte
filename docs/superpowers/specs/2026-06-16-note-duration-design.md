# デザイン: BPM音符換算ツール (note-duration)

## 概要

BPMを入力すると全音符〜32分音符（6種類）の長さを秒・msで表示するツール。
通常・付点・3連符の3列を常時表示。URLの `?bpm=` パラメータでBPMを受け取る。

## スコープ

**本作業で実装するもの:**
- `src/routes/note-duration/+page.svelte` — 新規ページ
- `src/lib/noteDuration.ts` — 計算ロジック・型定義
- `src/lib/components/NoteIcon.svelte` — 音符SVGアイコン
- `src/lib/components/BpmInput.svelte` — BPM入力UI
- `src/lib/components/NoteDurationTable.svelte` — 音符秒数テーブル
- `src/lib/site.ts` — `music` カテゴリにnote-durationを追加
- `src/routes/bpm-tapper/+page.svelte` — 音符換算リンクを追加

**本作業に含めないもの:**
- タップBPM検出（BPM Tapperの機能）
- note-durationから他ページへのリンク生成

---

## ファイル構成

```
src/
  routes/
    note-duration/
      +page.svelte            # ページ本体
  lib/
    noteDuration.ts           # 計算ロジック・型・定数
    components/
      NoteIcon.svelte         # 音符SVGアイコン
      BpmInput.svelte         # BPM入力UI（数値・スライダー・±）
      NoteDurationTable.svelte # 音符秒数テーブル
```

---

## 計算ロジック (`noteDuration.ts`)

```ts
export type NoteId = 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth' | 'thirtysecond'

export interface NoteSymbol {
  filled: boolean   // 塗り符頭 / 中抜き符頭
  stem: boolean     // 符幹あり/なし
  flags: 0 | 1 | 2 | 3
}

export interface NoteDuration {
  id: NoteId
  label: string     // 例: '4分音符'
  fraction: string  // 例: '1/4'
  symbol: NoteSymbol
  normalSec: number
  dottedSec: number
  tripletSec: number
}

export const MIN_BPM = 20
export const MAX_BPM = 300
export const DEFAULT_BPM = 120

export function clampBpm(bpm: number): number
export function calculateNoteDurations(bpm: number): NoteDuration[]
export function formatSec(sec: number): string   // 3桁固定小数
export function formatMs(sec: number): string    // 1桁固定小数
```

音符定義（全6種類、4分音符 = mult 1 を基準に他を係数で表現）:

| id | label | fraction | mult | filled | stem | flags |
|---|---|---|---|---|---|---|
| whole | 全音符 | 1/1 | 4 | false | false | 0 |
| half | 2分音符 | 1/2 | 2 | false | true | 0 |
| quarter | 4分音符 | 1/4 | 1 | true | true | 0 |
| eighth | 8分音符 | 1/8 | 0.5 | true | true | 1 |
| sixteenth | 16分音符 | 1/16 | 0.25 | true | true | 2 |
| thirtysecond | 32分音符 | 1/32 | 0.125 | true | true | 3 |

計算式:
- `quarterSec = 60 / bpm`
- `normalSec = quarterSec * mult`
- `dottedSec = normalSec * 1.5`
- `tripletSec = normalSec * (2/3)`
- `bpm <= 0` は `DEFAULT_BPM` にフォールバック（ゼロ除算防止）

---

## コンポーネント設計

### `NoteIcon.svelte`

Props:
- `filled: boolean` — 符頭の塗り/中抜き
- `stem: boolean` — 符幹の有無
- `flags: 0 | 1 | 2 | 3` — 旗の数
- `size: number = 24` — 表示サイズ(px)

SVG描画 (`viewBox="0 0 24 24"`):
1. 符頭: `<ellipse cx="8" cy="17" rx="4" ry="3" transform="rotate(-20 8 17)">` — `filled` で塗り/中抜きを切り替え
2. 符幹: `stem=true` のとき `<line x1="11.5" y1="15" x2="11.5" y2="3">`
3. 旗: `flags` の数だけ符幹先端から右に伸びる曲線パスを縦に並べる

---

### `BpmInput.svelte`

Props (bind可能):
- `bpm: number`
- `min: number = MIN_BPM`
- `max: number = MAX_BPM`

UI: 数値入力 + スライダー + −/＋ボタンの3点セット

挙動:
- 数値入力欄: タイピング中はクランプしない。`blur` 時に `clampBpm()` で補正
- スライダー・±ボタン: 操作のたびに `clampBpm()` を通す

---

### `NoteDurationTable.svelte`

Props:
- `durations: NoteDuration[]`

テーブル構造:
```
| 音符             | 通常      | 付点      | 3連       |
|-----------------|-----------|-----------|-----------|
| [SVG] 全音符 1/1  | 2.000s    | 3.000s    | 1.333s    |
| ...             | ...       | ...       | ...       |
```

- 主表示: `formatSec(value) + "s"` 
- 補助表示: `formatMs(value) + "ms"` を小さく併記（任意、推奨）
- レスポンシブ: `overflow-x-auto` で横スクロール対応。3列は省略しない。

---

## ページ構成 (`+page.svelte`)

```
<svelte:head>
  <title>BPM音符換算ツール｜32分音符〜全音符の秒数を計算</title>
  <meta name="description" content="..." />
</svelte:head>

<div class="ad-slot ad-slot--top ...">広告枠</div>

<h1>BPM音符換算ツール</h1>
<p>BPMを入力すると、32分音符から全音符までの長さを表示します。</p>

<BpmInput bind:bpm />

<div class="ad-slot ad-slot--in-content ...">広告枠</div>

<NoteDurationTable durations={calculateNoteDurations(bpm)} />
```

### URL `?bpm=` パラメータ処理（Svelte 5対応）

スペックの `onMount` + `$app/stores` パターンはSvelte 5では非推奨。
このプロジェクトは `$app/state` を使用しているため以下に置き換える:

```ts
import { page } from '$app/state'
import { clampBpm, DEFAULT_BPM } from '$lib/noteDuration'

let bpm = $state(DEFAULT_BPM)

$effect(() => {
  const p = page.url.searchParams.get('bpm')
  if (!p) return
  const n = parseFloat(p)
  if (!Number.isNaN(n)) bpm = clampBpm(n)
})
```

---

## BPM Tapperへのリンク追加

`src/routes/bpm-tapper/+page.svelte` の説明文セクションに追加:

```html
<a href="/note-duration?bpm={mainBpm !== null ? Math.round(mainBpm) : DEFAULT_BPM}">
  音符換算で開く →
</a>
```

---

## site.ts への登録

```ts
{
  href: "/note-duration",
  label: "BPM音符換算(開発中)",
  description: "BPMから全音符〜32分音符の長さを秒・msで計算するツール",
  visible: true,
  category: 'music',
},
```

---

## 受け入れ条件

- [ ] BPM入力（数値・スライダー・±）でテーブルがリアルタイムに更新される
- [ ] 全音符〜32分音符の6行が表示される
- [ ] 各音符行にSVG音符記号が表示される（符頭・符幹・旗が正しい種類ごとに描画される）
- [ ] 通常・付点・3連の3列が常時表示される（折りたたみなし）
- [ ] BPMが20〜300にクランプされ、0・負値・NaNでも計算が破綻しない
- [ ] `?bpm=` 付きURLでページを開くとその値が初期BPMになる
- [ ] `ad-slot--top` / `ad-slot--in-content` が配置されている
- [ ] `site.ts` に登録され、ナビゲーションに表示される
- [ ] BPM Tapperに「音符換算で開く」リンクが表示される
- [ ] `npm run build` が通る
