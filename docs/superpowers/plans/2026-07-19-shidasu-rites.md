# Shidasu 秘儀(Rite)アイテム群 追加 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** プレイ中に能動的に使用できる新アイテム種別「秘儀(Rite)」を17種実装し、専用の管理画面・プレイ画面UIを整備する。

**Architecture:** 護符(`ItemId`/`talismans`)と並行する新しいデータ系統として`RiteId`/`params.rites`を新設する。効果ロジックは新規`riteEffects.ts`に集約し、`engine.ts`の`useRite`関数から呼び出す。所持中の秘儀は`RunState.rites`(ウェーブを跨いで持続)に保持し、ウェーブ限定の持続効果(コンボリセット防止・全列プレイ可能)は`WaveState`の新規フィールドで管理する。

**Tech Stack:** TypeScript, Vitest, Svelte 5

**この計画の対象範囲について:** 全17秘儀の効果ロジック・データ・UI・管理画面を1つの計画としてまとめて実装する。各タスクの末尾で`npm run test`・`npm run check`を実行し、既存機能に影響が無いことを確認すること。

---

## 事前準備: 対象ファイルの現状

- `src/lib/game/shidasu/types.ts`: `ItemId`・`WaveState`・`RunState`等の型定義
- `src/lib/game/shidasu/params.ts`: `ShidasuParams`型定義・`DEFAULT_PARAMS`・`loadParams()`(実行時は`shidasu.config.json`を読む)
- `src/lib/game/shidasu/shidasu.config.json`: 実際に`loadParams()`が返す設定データ本体(admin画面の保存APIもここを書き換える)
- `src/lib/game/shidasu/items.ts`: 護符の`ITEM_POOL`・`itemName`・`itemDesc`(今回`rites.ts`として同型のものを新設する)
- `src/lib/game/shidasu/engine.ts`: `isPlayable`・`startWave`・`resetComboFields`(非export)・`pickItem`・`confirmItemSwap`・`createInitialRun`・`beginRun`が対象
- `src/lib/game/shidasu/patterns.ts`: `isRed`・`isFace`等の既存ヘルパー(再利用する)
- `src/lib/game/shidasu/deck.ts`: `shuffleInPlace`(再利用する)
- `src/routes/game/shidasu/PlayArea.svelte`・`src/routes/game/shidasu/+page.svelte`: プレイ画面
- `src/routes/admin/shidasu-talismans/+page.svelte`: 管理画面(今回`shidasu-rites`として同型のものを新設する)

**重要:** 各タスクは直前のタスクの結果を前提に行番号がずれるため、必ず直前のタスク完了後の実際のファイル内容を`Read`ツールで確認してから作業すること。

---

### Task 1: 型定義・データ基盤(`RiteId`・`runes.ts`・WaveState/RunStateフィールド)

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`
- Create: `src/lib/game/shidasu/runes.ts`
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: `RiteId`型を追加する**

`types.ts`の`ItemId`型定義の直後(`export interface Card {`の手前)に、以下を追加する:

```ts
// 秘儀(Rite): プレイ中に能動的に使用する消費アイテム。エルダー・フサルク(北欧ルーン文字)の
// うち今回効果を実装した17種のみをメンバーとする(残り7種はruneName.tsの見た目候補にのみ存在し、
// 効果が実装されて初めてここに追加する)。
export type RiteId =
  | 'raidho' | 'jera' | 'wunjo' | 'othala' | 'perthro'
  | 'uruz' | 'ingwaz'
  | 'gebo' | 'fehu' | 'dagaz'
  | 'algiz' | 'tiwaz' | 'laguz'
  | 'eihwaz' | 'ansuz' | 'kenaz' | 'thurisaz'
```

- [ ] **Step 2: `WaveState`・`RunState`にフィールドを追加する**

`WaveState`インターフェース末尾(`resilienceUsedThisWave: boolean`の直後)に以下を追加する:

```ts
  // エイワズ用: コンボリセットを防ぐ残り回数(0なら通常通りリセットする)
  comboResetShieldRemaining: number
  // アルギズ用: そのウェーブが終わるまで、isPlayable判定をバイパスして全列からプレイ可能にするか
  playFromAnywhereActiveThisWave: boolean
```

`RunState`インターフェースの`deckComposition: DeckCard[]`の直後に以下を追加する:

```ts
  // 所持中の秘儀(最大3、同じ種類を複数所持できる)。ウェーブを跨いで持続する(護符と同様)
  rites: RiteId[]
```

- [ ] **Step 3: `runes.ts`を新規作成する**

`src/lib/game/shidasu/runes.ts`を以下の内容で新規作成する。エルダー・フサルク全24文字の参照データで、`RiteId`とは独立している(管理画面の名前`<select>`の選択肢・読み方ラベル表示にのみ使う)。

```ts
// エルダー・フサルク(北欧ルーン文字)全24文字の参照データ。
// RiteId(効果実装済み17種)とは独立しており、管理画面の「名前」<select>の
// 選択肢・読み方ラベル表示にのみ使う。将来秘儀を追加する際、ここから未使用のグリフを選んで割り当てる。
export interface RuneEntry {
  glyph: string
  reading: string
}

export const RUNES: RuneEntry[] = [
  { glyph: 'ᚠ', reading: 'フェフ' },
  { glyph: 'ᚢ', reading: 'ウルズ' },
  { glyph: 'ᚦ', reading: 'スリサズ' },
  { glyph: 'ᚨ', reading: 'アンスズ' },
  { glyph: 'ᚱ', reading: 'ライドー' },
  { glyph: 'ᚲ', reading: 'ケナズ' },
  { glyph: 'ᚷ', reading: 'ゲボ' },
  { glyph: 'ᚹ', reading: 'ウンヨー' },
  { glyph: 'ᚺ', reading: 'ハガラズ' },
  { glyph: 'ᚾ', reading: 'ナウジズ' },
  { glyph: 'ᛁ', reading: 'イサ' },
  { glyph: 'ᛃ', reading: 'イェラ' },
  { glyph: 'ᛇ', reading: 'エイワズ' },
  { glyph: 'ᛈ', reading: 'ペルスロ' },
  { glyph: 'ᛉ', reading: 'アルギズ' },
  { glyph: 'ᛋ', reading: 'ソウィロ' },
  { glyph: 'ᛏ', reading: 'ティワズ' },
  { glyph: 'ᛒ', reading: 'ベルカナ' },
  { glyph: 'ᛖ', reading: 'エワズ' },
  { glyph: 'ᛗ', reading: 'マンナズ' },
  { glyph: 'ᛚ', reading: 'ラグズ' },
  { glyph: 'ᛜ', reading: 'イングズ' },
  { glyph: 'ᛞ', reading: 'ダガズ' },
  { glyph: 'ᛟ', reading: 'オセラ' },
]
```

- [ ] **Step 4: `startWave`で新規フィールドを初期化する**

`engine.ts`の`startWave`関数内、`wave`オブジェクトリテラルの`resilienceUsedThisWave: false,`の直後に以下を追加する:

```ts
    comboResetShieldRemaining: 0,
    playFromAnywhereActiveThisWave: false,
```

- [ ] **Step 5: `createInitialRun`・`beginRun`で`rites`を初期化する**

`engine.ts`の`createInitialRun`関数を以下に変更する:

```ts
export function createInitialRun(): RunState {
  return { phase: 'title', stageIndex: 0, waveIndex: 0, items: [], offer: [], wave: null, pendingNewItem: null, deckComposition: standardDeckComposition(), rites: [] }
}
```

`beginRun`関数の戻り値オブジェクトに`rites: [],`を追加する(`pendingNewItem: null, deckComposition,`の直後):

```ts
export function beginRun(params: ShidasuParams, seed?: number): RunState {
  const { wave, deckComposition } = startWave(params, 0, 0, [], standardDeckComposition(), seed)
  return {
    phase: 'playing',
    stageIndex: 0,
    waveIndex: 0,
    items: [],
    offer: [],
    wave,
    pendingNewItem: null,
    deckComposition,
    rites: [],
  }
}
```

- [ ] **Step 6: テストフィクスチャを更新する**

`engine.test.ts`の`makeWave`関数内、`resilienceUsedThisWave: false,`の直後(`...overrides,`の手前)に以下を追加する:

```ts
    comboResetShieldRemaining: 0,
    playFromAnywhereActiveThisWave: false,
```

`engine.test.ts`内で`RunState = {`という完全なオブジェクトリテラル(`...beginRun(...)`のスプレッドを使わない直書きのもの、`applyStuckCheck`のテスト群に6箇所ある)をすべて`grep`で確認し、各オブジェクトに`rites: [],`を追加する(`deckComposition: standardDeckComposition(),`の直後が自然)。`{ ...beginRun(DEFAULT_PARAMS, 1), ... }`のようにスプレッドを使っている箇所は、Step5で`beginRun`が`rites: []`を返すようになるため変更不要。

- [ ] **Step 7: テスト実行・型チェック**

```bash
npm run test
npm run check
```

Expected: 全テスト成功(挙動変更はまだ無いため既存テストはすべてそのまま通る)。

- [ ] **Step 8: コミット**

現在のブランチは`feat`です。プロジェクトのCLAUDE.md規約により、`feat`ブランチではユーザーへの確認なしでコミットしてよい規約になっています。コミットメッセージは日本語で書いてください。

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/runes.ts src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 秘儀(Rite)用のRiteId型・runes.ts・WaveState/RunStateフィールドを追加"
```

---

### Task 2: `params.ts`・`shidasu.config.json`への`rites`セクション追加

**Files:**
- Modify: `src/lib/game/shidasu/params.ts`
- Modify: `src/lib/game/shidasu/shidasu.config.json`

- [ ] **Step 1: `ShidasuParams`型に`rites`を追加する**

`params.ts`の`ShidasuParams`インターフェース内、`talismans: { ... }`ブロックの直後(`}`の後)に、以下を追加する:

```ts
  rites: {
    raidho: { name: string; desc: string }
    jera: { name: string; desc: string }
    wunjo: { name: string; desc: string }
    othala: { name: string; desc: string }
    perthro: { name: string; desc: string }
    uruz: { name: string; n: number; desc: string }
    ingwaz: { name: string; n: number; desc: string }
    gebo: { name: string; desc: string }
    fehu: { name: string; desc: string }
    dagaz: { name: string; desc: string }
    algiz: { name: string; desc: string }
    tiwaz: { name: string; desc: string }
    laguz: { name: string; desc: string }
    eihwaz: { name: string; n: number; desc: string }
    ansuz: { name: string; n: number; desc: string }
    kenaz: { name: string; desc: string }
    thurisaz: { name: string; desc: string }
  }
```

- [ ] **Step 2: `DEFAULT_PARAMS`に`rites`のデータを追加する**

`params.ts`の`DEFAULT_PARAMS`オブジェクト内、`talismans: { ... }`ブロックの直後(そのブロックを閉じる`},`の後)に、以下を追加する:

```ts
  rites: {
    raidho: { name: 'ᚱ', desc: '場札のランダムな1列を階段に変換する(最下段起点、昇順/降順はランダム)' },
    jera: { name: 'ᛃ', desc: '場札の各列をそれぞれソートする(列ごとに昇順/降順はランダム)' },
    wunjo: { name: 'ᚹ', desc: '場札を一番多い色に統一変換する(変換後のスートはカードごとにランダム)' },
    othala: { name: 'ᛟ', desc: '場札を一番多いスートに統一変換する' },
    perthro: { name: 'ᛈ', desc: '現在のチェーンの一番上のカードをワイルドに変換する' },
    uruz: { name: 'ᚢ', n: 3, desc: '現在のコンボ数に+{n}する' },
    ingwaz: { name: 'ᛜ', n: 2, desc: '基礎コンボ数に+{n}する' },
    gebo: { name: 'ᚷ', desc: '捨て札からランダムに、場札の各列へ1枚ずつ配置する(捨て札が列数未満なら使用不可)' },
    fehu: { name: 'ᚠ', desc: '山札の上から、場札の各列へ1枚ずつ配置する(山札の残りが列数以下なら使用不可)' },
    dagaz: { name: 'ᛞ', desc: '捨て札を山札に加えてシャッフルする' },
    algiz: { name: 'ᛉ', desc: 'そのウェーブが終わるまで、場札のどの列からでもカードをプレイできるようになる' },
    tiwaz: { name: 'ᛏ', desc: '現在のチェーンのカードを、チェーン内で一番多いスートに統一変換する(チェーンが2枚以上のときのみ使用可)' },
    laguz: { name: 'ᛚ', desc: '現在のチェーンのカードを、チェーン内で一番多い色に統一変換する(変換後のスートはカードごとにランダム。チェーンが2枚以上のときのみ使用可)' },
    eihwaz: { name: 'ᛇ', n: 3, desc: 'コンボリセットを{n}回防ぐ' },
    ansuz: { name: 'ᚨ', n: 3, desc: '場札の中からランダムに{n}枚をワイルドに変換する' },
    kenaz: { name: 'ᚲ', desc: '場札のJ・Q・K以外のカードを、ランダムにJ・Q・Kのいずれかへ変換する(スートは維持)' },
    thurisaz: { name: 'ᚦ', desc: '場札のJ・Q・Kのカードを、ランダムにJ・Q・K以外のランクへ変換する(スートは維持)' },
  },
```

- [ ] **Step 3: `shidasu.config.json`にも同じ`rites`データを追加する**

`loadParams()`は`DEFAULT_PARAMS`ではなく`shidasu.config.json`を実際に読み込むため、このJSONファイルにも同じ`rites`セクションを追加しないと実行時に`params.rites`が`undefined`になる。`shidasu.config.json`を`Read`で開き、末尾の`"talismans": { ... }`ブロックの直後(トップレベルの`}`の手前)に、Step2と同じ内容をJSON形式(`name`/`n`/`desc`のみ、TypeScriptの型注釈は書かない)で追加する:

```json
  "rites": {
    "raidho": { "name": "ᚱ", "desc": "場札のランダムな1列を階段に変換する(最下段起点、昇順/降順はランダム)" },
    "jera": { "name": "ᛃ", "desc": "場札の各列をそれぞれソートする(列ごとに昇順/降順はランダム)" },
    "wunjo": { "name": "ᚹ", "desc": "場札を一番多い色に統一変換する(変換後のスートはカードごとにランダム)" },
    "othala": { "name": "ᛟ", "desc": "場札を一番多いスートに統一変換する" },
    "perthro": { "name": "ᛈ", "desc": "現在のチェーンの一番上のカードをワイルドに変換する" },
    "uruz": { "name": "ᚢ", "n": 3, "desc": "現在のコンボ数に+{n}する" },
    "ingwaz": { "name": "ᛜ", "n": 2, "desc": "基礎コンボ数に+{n}する" },
    "gebo": { "name": "ᚷ", "desc": "捨て札からランダムに、場札の各列へ1枚ずつ配置する(捨て札が列数未満なら使用不可)" },
    "fehu": { "name": "ᚠ", "desc": "山札の上から、場札の各列へ1枚ずつ配置する(山札の残りが列数以下なら使用不可)" },
    "dagaz": { "name": "ᛞ", "desc": "捨て札を山札に加えてシャッフルする" },
    "algiz": { "name": "ᛉ", "desc": "そのウェーブが終わるまで、場札のどの列からでもカードをプレイできるようになる" },
    "tiwaz": { "name": "ᛏ", "desc": "現在のチェーンのカードを、チェーン内で一番多いスートに統一変換する(チェーンが2枚以上のときのみ使用可)" },
    "laguz": { "name": "ᛚ", "desc": "現在のチェーンのカードを、チェーン内で一番多い色に統一変換する(変換後のスートはカードごとにランダム。チェーンが2枚以上のときのみ使用可)" },
    "eihwaz": { "name": "ᛇ", "n": 3, "desc": "コンボリセットを{n}回防ぐ" },
    "ansuz": { "name": "ᚨ", "n": 3, "desc": "場札の中からランダムに{n}枚をワイルドに変換する" },
    "kenaz": { "name": "ᚲ", "desc": "場札のJ・Q・K以外のカードを、ランダムにJ・Q・Kのいずれかへ変換する(スートは維持)" },
    "thurisaz": { "name": "ᚦ", "desc": "場札のJ・Q・Kのカードを、ランダムにJ・Q・K以外のランクへ変換する(スートは維持)" }
  }
```

**注意:** JSONの直前の`"talismans"`ブロックを閉じる`}`の直後にはカンマ(`,`)を追加すること。`"rites"`ブロックはJSONオブジェクトの最後のプロパティになるはずなので、その閉じ`}`の後にはカンマを付けないこと(既存の`"talismans"`が最後のプロパティだった場合、これを変更する形になる)。

- [ ] **Step 4: 型チェック**

```bash
npm run check
```

Expected: `params.ts`・`shidasu.config.json`関連のエラーが無いこと。他の既存無関係エラーは無視してよい。

- [ ] **Step 5: `params.test.ts`を確認する**

`src/lib/game/shidasu/params.test.ts`を`Read`で確認し、`DEFAULT_PARAMS`や`talismans`のキー一覧を網羅的に検証しているテストが無いか確認する。もしあれば、同様に`rites`の17キーも検証するテストと矛盾しないか確認し、矛盾する場合のみテストを更新する(既存テストの内容次第では変更不要な場合もある)。

- [ ] **Step 6: テスト実行**

```bash
npm run test
```

Expected: 全テスト成功。

- [ ] **Step 7: コミット**

```bash
git add src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json
git commit -m "feat: 秘儀17種のパラメータ・説明文をparams.ts/shidasu.config.jsonに追加"
```

---

### Task 3: `riteEffects.ts`実装(17効果 + `canUseRite`)

**Files:**
- Create: `src/lib/game/shidasu/riteEffects.ts`
- Create: `src/lib/game/shidasu/riteEffects.test.ts`

- [ ] **Step 1: `riteEffects.ts`を新規作成する**

`src/lib/game/shidasu/riteEffects.ts`を以下の内容で新規作成する。

```ts
import type { Card, Rank, Suit, WaveState, RiteId } from './types'
import type { ShidasuParams } from './params'
import { isRed, isFace } from './patterns'
import { shuffleInPlace } from './deck'

function pickRandom<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)]
}

function applyRaidho(wave: WaveState, rand: () => number): WaveState {
  const nonEmptyCols = wave.tableau.map((_, i) => i).filter(i => wave.tableau[i].length > 0)
  if (nonEmptyCols.length === 0) return wave
  const ci = pickRandom(nonEmptyCols, rand)
  const col = wave.tableau[ci]
  const baseRank = col[0].rank
  const dir = rand() < 0.5 ? 1 : -1
  const newCol = col.map((c, i) => ({ ...c, rank: (((baseRank - 1 + dir * i) % 13 + 13) % 13 + 1) as Rank }))
  return { ...wave, tableau: wave.tableau.map((c, i) => (i === ci ? newCol : c)) }
}

function applyJera(wave: WaveState, rand: () => number): WaveState {
  const tableau = wave.tableau.map(col => {
    if (col.length === 0) return col
    const dir = rand() < 0.5 ? 1 : -1
    return [...col].sort((a, b) => dir * (a.rank - b.rank))
  })
  return { ...wave, tableau }
}

function applyWunjo(wave: WaveState, rand: () => number): WaveState {
  const realCards = wave.tableau.flat().filter(c => !c.wild)
  const redCount = realCards.filter(isRed).length
  const blackCount = realCards.length - redCount
  const toRed = redCount === blackCount ? rand() < 0.5 : redCount > blackCount
  const suits: Suit[] = toRed ? ['♥', '♦'] : ['♠', '♣']
  const tableau = wave.tableau.map(col => col.map(c => (c.wild ? c : { ...c, suit: pickRandom(suits, rand) })))
  return { ...wave, tableau }
}

function applyOthala(wave: WaveState, rand: () => number): WaveState {
  const realCards = wave.tableau.flat().filter(c => !c.wild)
  const suits: Suit[] = ['♠', '♥', '♦', '♣']
  const counts = suits.map(s => realCards.filter(c => c.suit === s).length)
  const maxCount = Math.max(...counts)
  const candidates = suits.filter((_, i) => counts[i] === maxCount)
  const target = pickRandom(candidates, rand)
  const tableau = wave.tableau.map(col => col.map(c => (c.wild ? c : { ...c, suit: target })))
  return { ...wave, tableau }
}

function applyPerthro(wave: WaveState): WaveState {
  if (wave.chain.length === 0) return wave
  const chain = [...wave.chain]
  chain[chain.length - 1] = { ...chain[chain.length - 1], wild: true }
  return { ...wave, chain, foundation: chain[chain.length - 1] }
}

function applyUruz(wave: WaveState, n: number): WaveState {
  const combo = wave.combo + n
  return { ...wave, combo, maxComboThisWave: Math.max(wave.maxComboThisWave, combo) }
}

function applyIngwaz(wave: WaveState, n: number): WaveState {
  return { ...wave, baseComboCount: wave.baseComboCount + n }
}

function applyGebo(wave: WaveState, cols: number, rand: () => number): WaveState {
  if (wave.discardPile.length < cols) return wave
  const pool = [...wave.discardPile]
  shuffleInPlace(pool, rand)
  const picked = pool.slice(0, cols)
  const remaining = pool.slice(cols)
  const tableau = wave.tableau.map((col, i) => [...col, picked[i]])
  return { ...wave, tableau, discardPile: remaining }
}

function applyFehu(wave: WaveState, cols: number): WaveState {
  if (wave.stock.length <= cols) return wave
  const stock = [...wave.stock]
  const picked: Card[] = []
  for (let i = 0; i < cols; i++) picked.push(stock.pop() as Card)
  const tableau = wave.tableau.map((col, i) => [...col, picked[i]])
  return { ...wave, tableau, stock }
}

function applyDagaz(wave: WaveState, rand: () => number): WaveState {
  const stock = [...wave.stock, ...wave.discardPile]
  shuffleInPlace(stock, rand)
  return { ...wave, stock, discardPile: [] }
}

function applyAlgiz(wave: WaveState): WaveState {
  return { ...wave, playFromAnywhereActiveThisWave: true }
}

function applyTiwaz(wave: WaveState, rand: () => number): WaveState {
  if (wave.chain.length < 2) return wave
  const realCards = wave.chain.filter(c => !c.wild)
  if (realCards.length === 0) return wave
  const suits: Suit[] = ['♠', '♥', '♦', '♣']
  const counts = suits.map(s => realCards.filter(c => c.suit === s).length)
  const maxCount = Math.max(...counts)
  const candidates = suits.filter((_, i) => counts[i] === maxCount)
  const target = pickRandom(candidates, rand)
  const chain = wave.chain.map(c => (c.wild ? c : { ...c, suit: target }))
  return { ...wave, chain, foundation: chain[chain.length - 1] }
}

function applyLaguz(wave: WaveState, rand: () => number): WaveState {
  if (wave.chain.length < 2) return wave
  const realCards = wave.chain.filter(c => !c.wild)
  if (realCards.length === 0) return wave
  const redCount = realCards.filter(isRed).length
  const blackCount = realCards.length - redCount
  const toRed = redCount === blackCount ? rand() < 0.5 : redCount > blackCount
  const suits: Suit[] = toRed ? ['♥', '♦'] : ['♠', '♣']
  const chain = wave.chain.map(c => (c.wild ? c : { ...c, suit: pickRandom(suits, rand) }))
  return { ...wave, chain, foundation: chain[chain.length - 1] }
}

function applyEihwaz(wave: WaveState, n: number): WaveState {
  return { ...wave, comboResetShieldRemaining: wave.comboResetShieldRemaining + n }
}

function applyAnsuz(wave: WaveState, n: number, rand: () => number): WaveState {
  const positions: { ci: number; ri: number }[] = []
  wave.tableau.forEach((col, ci) => col.forEach((c, ri) => { if (!c.wild) positions.push({ ci, ri }) }))
  shuffleInPlace(positions, rand)
  const targetKeys = new Set(positions.slice(0, n).map(p => `${p.ci}-${p.ri}`))
  const tableau = wave.tableau.map((col, ci) => col.map((c, ri) => (targetKeys.has(`${ci}-${ri}`) ? { ...c, wild: true } : c)))
  return { ...wave, tableau }
}

function applyKenaz(wave: WaveState, rand: () => number): WaveState {
  const faceRanks: Rank[] = [11, 12, 13]
  const tableau = wave.tableau.map(col =>
    col.map(c => (!c.wild && !isFace(c) ? { ...c, rank: pickRandom(faceRanks, rand) } : c))
  )
  return { ...wave, tableau }
}

function applyThurisaz(wave: WaveState, rand: () => number): WaveState {
  const nonFaceRanks: Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  const tableau = wave.tableau.map(col =>
    col.map(c => (!c.wild && isFace(c) ? { ...c, rank: pickRandom(nonFaceRanks, rand) } : c))
  )
  return { ...wave, tableau }
}

// 秘儀が現在の盤面状態で使用可能か判定する(捨て札・山札の枚数不足、チェーン長不足などの条件)。
// UIのボタンdisabled判定に使う。
export function canUseRite(params: ShidasuParams, wave: WaveState, riteId: RiteId): boolean {
  const cols = params.layout.cols
  switch (riteId) {
    case 'gebo':
      return wave.discardPile.length >= cols
    case 'fehu':
      return wave.stock.length > cols
    case 'tiwaz':
    case 'laguz':
      return wave.chain.length >= 2
    default:
      return true
  }
}

// 指定した秘儀の効果を適用した新しいWaveStateを返す。所持からの削除はengine.tsのuseRite側で行う。
export function applyRiteEffect(params: ShidasuParams, wave: WaveState, riteId: RiteId, rand: () => number): WaveState {
  const cols = params.layout.cols
  switch (riteId) {
    case 'raidho':
      return applyRaidho(wave, rand)
    case 'jera':
      return applyJera(wave, rand)
    case 'wunjo':
      return applyWunjo(wave, rand)
    case 'othala':
      return applyOthala(wave, rand)
    case 'perthro':
      return applyPerthro(wave)
    case 'uruz':
      return applyUruz(wave, params.rites.uruz.n)
    case 'ingwaz':
      return applyIngwaz(wave, params.rites.ingwaz.n)
    case 'gebo':
      return applyGebo(wave, cols, rand)
    case 'fehu':
      return applyFehu(wave, cols)
    case 'dagaz':
      return applyDagaz(wave, rand)
    case 'algiz':
      return applyAlgiz(wave)
    case 'tiwaz':
      return applyTiwaz(wave, rand)
    case 'laguz':
      return applyLaguz(wave, rand)
    case 'eihwaz':
      return applyEihwaz(wave, params.rites.eihwaz.n)
    case 'ansuz':
      return applyAnsuz(wave, params.rites.ansuz.n, rand)
    case 'kenaz':
      return applyKenaz(wave, rand)
    case 'thurisaz':
      return applyThurisaz(wave, rand)
  }
}
```

- [ ] **Step 2: テストを作成する**

`src/lib/game/shidasu/riteEffects.test.ts`を以下の内容で新規作成する。既存の`engine.test.ts`のカード生成ヘルパーと同じパターン(`card(id, suit, rank, wild)`)を使う。

```ts
import { describe, test, expect } from 'vitest'
import { applyRiteEffect, canUseRite } from './riteEffects'
import { DEFAULT_PARAMS } from './params'
import { createRng } from './deck'
import type { Card, WaveState } from './types'

function card(id: number, suit: Card['suit'], rank: Card['rank'], wild = false): Card {
  return { id, suit, rank, wild }
}

function baseWave(overrides: Partial<WaveState> = {}): WaveState {
  return {
    tableau: [[card(1, '♠', 5)]],
    stock: [],
    foundation: card(2, '♥', 6),
    score: 100,
    combo: 2,
    chain: [card(2, '♥', 6)],
    chainOrigin: ['draw'],
    linked: false,
    columnsEmptiedThisCombo: 0,
    comboStreakColumnLengths: [1],
    lastDrawEffect: null,
    status: 'playing',
    endReason: null,
    lastGain: null,
    lastBonusGains: [],
    firstPlayDone: true,
    discardPile: [],
    lastPlayedColumn: null,
    sameColumnStreak: 0,
    maxComboThisWave: 2,
    totalColumnsEmptiedThisWave: 0,
    roleFiredThisChain: false,
    drawContinueCountThisChain: 0,
    flushActiveThisCombo: false,
    columnSweepActiveThisWave: false,
    benevolenceUsedThisCombo: false,
    baseComboCount: 0,
    roleEchoUsedThisCombo: {},
    sameRankEchoUsedThisCombo: [],
    pendingRoleEcho: null,
    roleOccurrenceCountThisWave: {},
    mercyActiveNextCombo: false,
    sweptColumnsThisCombo: [],
    regenerationUsedThisWave: false,
    resilienceUsedThisWave: false,
    comboResetShieldRemaining: 0,
    playFromAnywhereActiveThisWave: false,
    ...overrides,
  }
}

describe('riteEffects', () => {
  test('ライドー: ランダムな1列が最下段起点の階段になる', () => {
    const wave = baseWave({ tableau: [[card(1, '♠', 5), card(2, '♦', 9), card(3, '♣', 2)]] })
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'raidho', createRng(1))
    const ranks = next.tableau[0].map(c => c.rank)
    // 最下段(index0)がbaseRank(5)のまま、以後は+1か-1のどちらかで一貫している
    expect(ranks[0]).toBe(5)
    const diff1 = ((ranks[1] - ranks[0] + 12) % 13 + 13) % 13
    expect([1, 12]).toContain(diff1 === 0 ? 13 : diff1)
  })

  test('イェラ: 各列がソートされる', () => {
    const wave = baseWave({ tableau: [[card(1, '♠', 9), card(2, '♦', 2), card(3, '♣', 5)]] })
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'jera', createRng(1))
    const ranks = next.tableau[0].map(c => c.rank)
    const isAscending = ranks[0] <= ranks[1] && ranks[1] <= ranks[2]
    const isDescending = ranks[0] >= ranks[1] && ranks[1] >= ranks[2]
    expect(isAscending || isDescending).toBe(true)
  })

  test('ウンヨー: 場札が一番多い色に統一される(ワイルドは対象外)', () => {
    const wave = baseWave({
      tableau: [[card(1, '♥', 3), card(2, '♦', 4), card(3, '♠', 5, true)]],
    })
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'wunjo', createRng(1))
    expect(next.tableau[0][0].suit === '♥' || next.tableau[0][0].suit === '♦').toBe(true)
    expect(next.tableau[0][1].suit === '♥' || next.tableau[0][1].suit === '♦').toBe(true)
    expect(next.tableau[0][2].wild).toBe(true) // ワイルドは変化しない
  })

  test('オセラ: 場札が一番多いスートに統一される', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 3), card(2, '♣', 4), card(3, '♦', 5)]],
    })
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'othala', createRng(1))
    expect(next.tableau[0].every(c => c.suit === '♣')).toBe(true)
  })

  test('ペルスロ: チェーン先頭(foundation)がワイルドになる', () => {
    const wave = baseWave({ chain: [card(2, '♥', 6)], foundation: card(2, '♥', 6) })
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'perthro', createRng(1))
    expect(next.foundation.wild).toBe(true)
    expect(next.chain[next.chain.length - 1].wild).toBe(true)
  })

  test('ウルズ: 現在のコンボ数にnが加算される', () => {
    const wave = baseWave({ combo: 2, maxComboThisWave: 2 })
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'uruz', createRng(1))
    expect(next.combo).toBe(2 + DEFAULT_PARAMS.rites.uruz.n)
    expect(next.maxComboThisWave).toBe(next.combo)
  })

  test('イングズ: 基礎コンボ数にnが加算される(現在のコンボ数は変わらない)', () => {
    const wave = baseWave({ combo: 2, baseComboCount: 0 })
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'ingwaz', createRng(1))
    expect(next.baseComboCount).toBe(DEFAULT_PARAMS.rites.ingwaz.n)
    expect(next.combo).toBe(2)
  })

  test('ゲボ: 捨て札が列数未満なら使用不可', () => {
    const wave = baseWave({ tableau: [[card(1, '♠', 5)], [card(2, '♦', 5)]], discardPile: [card(10, '♣', 1)] })
    expect(canUseRite(DEFAULT_PARAMS, wave, 'gebo')).toBe(false)
  })

  test('ゲボ: 捨て札から各列に1枚ずつ配置される', () => {
    const wave = baseWave({
      tableau: [[card(1, '♠', 5)], [card(2, '♦', 5)]],
      discardPile: [card(10, '♣', 1), card(11, '♣', 2), card(12, '♣', 3)],
    })
    expect(canUseRite(DEFAULT_PARAMS, wave, 'gebo')).toBe(true)
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'gebo', createRng(1))
    expect(next.tableau[0]).toHaveLength(2)
    expect(next.tableau[1]).toHaveLength(2)
    expect(next.discardPile).toHaveLength(1)
  })

  test('フェフ: 山札の残りが列数以下なら使用不可', () => {
    const wave = baseWave({ tableau: [[card(1, '♠', 5)], [card(2, '♦', 5)]], stock: [card(20, '♣', 1), card(21, '♣', 2)] })
    expect(canUseRite(DEFAULT_PARAMS, wave, 'fehu')).toBe(false)
  })

  test('フェフ: 山札の上から各列に1枚ずつ配置される', () => {
    const wave = baseWave({
      tableau: [[card(1, '♠', 5)], [card(2, '♦', 5)]],
      stock: [card(20, '♣', 1), card(21, '♣', 2), card(22, '♣', 3)],
    })
    expect(canUseRite(DEFAULT_PARAMS, wave, 'fehu')).toBe(true)
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'fehu', createRng(1))
    expect(next.tableau[0]).toHaveLength(2)
    expect(next.tableau[1]).toHaveLength(2)
    expect(next.stock).toHaveLength(1)
  })

  test('ダガズ: 捨て札が山札に加わりシャッフルされる', () => {
    const wave = baseWave({ stock: [card(20, '♣', 1)], discardPile: [card(10, '♦', 2), card(11, '♦', 3)] })
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'dagaz', createRng(1))
    expect(next.stock).toHaveLength(3)
    expect(next.discardPile).toHaveLength(0)
  })

  test('アルギズ: playFromAnywhereActiveThisWaveがtrueになる', () => {
    const wave = baseWave()
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'algiz', createRng(1))
    expect(next.playFromAnywhereActiveThisWave).toBe(true)
  })

  test('ティワズ: チェーンが2枚未満なら使用不可', () => {
    const wave = baseWave({ chain: [card(2, '♥', 6)] })
    expect(canUseRite(DEFAULT_PARAMS, wave, 'tiwaz')).toBe(false)
    expect(canUseRite(DEFAULT_PARAMS, wave, 'laguz')).toBe(false)
  })

  test('ティワズ: チェーンが一番多いスートに統一される', () => {
    const wave = baseWave({ chain: [card(1, '♣', 1), card(2, '♣', 2), card(3, '♦', 3)], foundation: card(3, '♦', 3) })
    expect(canUseRite(DEFAULT_PARAMS, wave, 'tiwaz')).toBe(true)
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'tiwaz', createRng(1))
    expect(next.chain.every(c => c.suit === '♣')).toBe(true)
    expect(next.foundation.suit).toBe('♣')
  })

  test('ラグズ: チェーンが一番多い色に統一される', () => {
    const wave = baseWave({ chain: [card(1, '♥', 1), card(2, '♦', 2), card(3, '♠', 3)], foundation: card(3, '♠', 3) })
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'laguz', createRng(1))
    expect(next.chain.every(c => c.suit === '♥' || c.suit === '♦')).toBe(true)
    expect(next.foundation.suit === '♥' || next.foundation.suit === '♦').toBe(true)
  })

  test('エイワズ: コンボリセット防止残り回数にnが加算される', () => {
    const wave = baseWave({ comboResetShieldRemaining: 1 })
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'eihwaz', createRng(1))
    expect(next.comboResetShieldRemaining).toBe(1 + DEFAULT_PARAMS.rites.eihwaz.n)
  })

  test('アンスズ: 場札のn枚がランダムにワイルドになる', () => {
    const wave = baseWave({ tableau: [[card(1, '♠', 5), card(2, '♦', 6), card(3, '♣', 7), card(4, '♥', 8)]] })
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'ansuz', createRng(1))
    const wildCount = next.tableau[0].filter(c => c.wild).length
    expect(wildCount).toBe(Math.min(DEFAULT_PARAMS.rites.ansuz.n, 4))
  })

  test('ケナズ: JQK以外のカードがJQKのいずれかに変換される(スート維持)', () => {
    const wave = baseWave({ tableau: [[card(1, '♠', 5), card(2, '♦', 13)]] })
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'kenaz', createRng(1))
    expect(next.tableau[0][0].rank).toBeGreaterThanOrEqual(11)
    expect(next.tableau[0][0].suit).toBe('♠')
    expect(next.tableau[0][1].rank).toBe(13) // 元々JQKだったカードは変化しない
  })

  test('スリサズ: JQKのカードがJQK以外に変換される(スート維持)', () => {
    const wave = baseWave({ tableau: [[card(1, '♠', 5), card(2, '♦', 13)]] })
    const next = applyRiteEffect(DEFAULT_PARAMS, wave, 'thurisaz', createRng(1))
    expect(next.tableau[0][1].rank).toBeLessThanOrEqual(10)
    expect(next.tableau[0][1].suit).toBe('♦')
    expect(next.tableau[0][0].rank).toBe(5) // 元々JQK以外だったカードは変化しない
  })
})
```

- [ ] **Step 3: テスト実行**

```bash
npm run test riteEffects
```

Expected: 全テスト成功。もし乱数の巡り合わせでテストが偶然通ってしまっている(本質的な検証になっていない)箇所があれば、アサーションを見直すこと。

- [ ] **Step 4: 型チェック**

```bash
npm run check
```

Expected: `riteEffects.ts`関連のエラーなし。

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/riteEffects.ts src/lib/game/shidasu/riteEffects.test.ts
git commit -m "feat: 秘儀17種の効果ロジック(riteEffects.ts)を追加"
```

---

### Task 4: `rites.ts`・`engine.ts`統合(`useRite`・コンボリセット防止・全列プレイ可能・取得ロジック)

**Files:**
- Create: `src/lib/game/shidasu/rites.ts`
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: `rites.ts`を新規作成する**

`src/lib/game/shidasu/rites.ts`を、`items.ts`の`ITEM_POOL`/`itemName`/`itemDesc`と同型の構成で新規作成する。

```ts
// src/lib/game/shidasu/rites.ts
import type { RiteId } from './types'
import type { ShidasuParams } from './params'

// rollRiteは重み付けなしの完全均等抽選。効果が実装済みの17種のみが対象。
export const RITE_POOL: RiteId[] = [
  'raidho', 'jera', 'wunjo', 'othala', 'perthro',
  'uruz', 'ingwaz',
  'gebo', 'fehu', 'dagaz',
  'algiz', 'tiwaz', 'laguz',
  'eihwaz', 'ansuz', 'kenaz', 'thurisaz',
]

export function riteName(id: RiteId, params: ShidasuParams): string {
  return params.rites[id].name
}

export function riteDesc(id: RiteId, params: ShidasuParams): string {
  const entry = params.rites[id] as unknown as Record<string, unknown> & { desc: string }
  const context: Record<string, number> = { rows: params.layout.rows, cols: params.layout.cols }
  for (const [key, value] of Object.entries(entry)) {
    if (typeof value === 'number') context[key] = value
  }
  return entry.desc.replace(/\{(\w+)\}/g, (match, key) => (key in context ? String(context[key]) : match))
}

// 所持数が上限(3)未満なら、RITE_POOLから1つを均等ランダムに抽選する(既に所持している種類も除外しない)。
// 上限に達していればnullを返す。
export function rollRite(currentRites: RiteId[], rand: () => number = Math.random): RiteId | null {
  if (currentRites.length >= 3) return null
  return RITE_POOL[Math.floor(rand() * RITE_POOL.length)]
}
```

- [ ] **Step 2: `isPlayable`にアルギズのバイパスを追加する**

`engine.ts`の`isPlayable`関数を以下に変更する:

```ts
export function isPlayable(modifier: StageModifier, wave: WaveState, card: Card): boolean {
  // アルギズ発動中は、そのウェーブが終わるまであらゆる場札がプレイ可能になる(最優先で判定)
  if (wave.playFromAnywhereActiveThisWave) return true
  // faceLockはワイルド(場札含む)より優先して評価する: ワイルド場札でも絵札はコンボ不足なら拒否する
  if (modifier === 'faceLock' && isFace(card) && wave.combo < 2) return false
  if (card.wild || wave.foundation.wild) return true
  const d = Math.abs(card.rank - wave.foundation.rank)
  if (d === 1) return true
  if (d === 12 && modifier !== 'noLoop') return true
  return false
}
```

- [ ] **Step 3: `resetComboFields`にエイワズのシールドを組み込む**

`engine.ts`の`resetComboFields`関数を以下に変更する。シールド残り回数が1以上あれば、通常のリセット処理を行わず「本来リセットになるはずだったチェーンを、継続扱いとして維持する」形にし、シールド残り回数を1減らす。

```ts
function resetComboFields(
  wave: WaveState,
  params: ShidasuParams,
  items: ItemId[],
  newFoundation: Card = wave.foundation,
  newOrigin: ChainCardOrigin = wave.chainOrigin[wave.chainOrigin.length - 1]
): WaveState {
  // エイワズ(秘儀)によるコンボリセット防止。newFoundationが新しく引かれたカード(通常のdrawStock
  // リセット時)であればチェーンを継続扱いで延長し、全消し・手詰まりのリサイクル時(newFoundation省略、
  // wave.foundationと同一)はチェーン・コンボ状態をそのまま保持する。いずれもresetDirect系護符
  // (沈着・冷静・残響等)の判定はこの関数の外側(呼び出し元)で既に行われているため、シールドが
  // 防ぐのはコンボ・チェーンの状態変化のみである。
  if (wave.comboResetShieldRemaining > 0) {
    const isNewCard = newFoundation.id !== wave.foundation.id
    return {
      ...wave,
      foundation: newFoundation,
      chain: isNewCard ? [...wave.chain, newFoundation] : wave.chain,
      chainOrigin: isNewCard ? [...wave.chainOrigin, newOrigin] : wave.chainOrigin,
      linked: true,
      comboResetShieldRemaining: wave.comboResetShieldRemaining - 1,
    }
  }

  // 新chainに引き継がれるカード(newFoundation)は捨て札へ重複して送らない。chain内の位置ではなく
  // IDの一致で除外するため、chain末尾が必ずfoundationと一致するという不変条件に依存しない。
  // 通常のdrawStockリセットではnewFoundationが新規に引いたカードでchainに含まれないため何も除去されず、
  // 全消し・手詰まりのリサイクル時のみ該当カードが除外される。
  const chainToDiscard = wave.chain.filter(c => c.id !== newFoundation.id)
  return {
    ...wave,
    foundation: newFoundation,
    combo: items.includes('sanctify') ? wave.baseComboCount : 0,
    chain: [newFoundation],
    chainOrigin: [newOrigin],
    linked: false,
    columnsEmptiedThisCombo: 0,
    comboStreakColumnLengths: wave.tableau.map(col => col.length),
    discardPile: [...wave.discardPile, ...chainToDiscard],
    drawContinueCountThisChain: 0,
    flushActiveThisCombo: false,
    sameColumnStreak: 0,
    lastPlayedColumn: null,
    benevolenceUsedThisCombo: false,
    roleEchoUsedThisCombo: {},
    sameRankEchoUsedThisCombo: [],
    pendingRoleEcho: null,
    mercyActiveNextCombo: wave.combo <= params.talismans.mercy.c,
    sweptColumnsThisCombo: [],
    roleFiredThisChain: false,
  }
}
```

- [ ] **Step 4: `useRite`関数を追加する**

`engine.ts`に、`pickItem`関数の直前に以下の新規関数を追加する。ファイル冒頭のimportに`applyRiteEffect, canUseRite`(`./riteEffects`から)・`RiteId`(`./types`のimportに追加)を含める必要がある。

まず、`engine.ts`冒頭の`import type { ... } from './types'`の行に`RiteId`を追加する(既存の型リストの末尾に追加):

```ts
import type { Card, StageModifier, WaveState, ItemId, WaveEndReason, RunState, Suit, Rank, DeckCard, RoleName, BonusGain, ChainCardOrigin, RiteId } from './types'
```

`engine.ts`冒頭のimport群に以下を追加する(`import { applyItemEffects, type ItemEffectContext } from './itemEffects'`の直後):

```ts
import { applyRiteEffect, canUseRite } from './riteEffects'
```

次に、`pickItem`関数の直前に以下を追加する:

```ts
// 秘儀を1つ使用する。効果を適用し、所持からその秘儀を1個削除する。
// 使用条件(canUseRite)を満たさない場合、または所持していない場合は何もしない。
export function useRite(params: ShidasuParams, run: RunState, riteId: RiteId, rand: () => number = Math.random): RunState {
  if (run.phase !== 'playing' || !run.wave || run.wave.status !== 'playing') return run
  if (!canUseRite(params, run.wave, riteId)) return run
  const idx = run.rites.indexOf(riteId)
  if (idx === -1) return run
  const wave = applyRiteEffect(params, run.wave, riteId, rand)
  const rites = [...run.rites.slice(0, idx), ...run.rites.slice(idx + 1)]
  return { ...run, wave, rites }
}

```

- [ ] **Step 5: `pickItem`・`confirmItemSwap`に秘儀取得ロジックを追加する**

`engine.ts`冒頭のimportに`rollRite`(`./rites`から)を追加する:

```ts
import { rollRite } from './rites'
```

`pickItem`関数を以下に変更する(`rand`引数を新規追加し、`newItems`確定後に秘儀ロールを挟む):

```ts
export function pickItem(params: ShidasuParams, run: RunState, itemId: ItemId, seed?: number, rand: () => number = Math.random): RunState {
  if (run.phase !== 'itemSelect') return run
  if (run.items.length >= params.items.maxItems) {
    return { ...run, pendingNewItem: itemId }
  }
  const newItems = [...run.items, itemId]
  const rolledRite = rollRite(run.rites, rand)
  const newRites = rolledRite ? [...run.rites, rolledRite] : run.rites
  const newWaveIndex = run.waveIndex + 1
  const { wave, deckComposition } = startWave(params, run.stageIndex, newWaveIndex, newItems, run.deckComposition, seed)
  return {
    ...run,
    phase: 'playing',
    items: newItems,
    rites: newRites,
    waveIndex: newWaveIndex,
    offer: [],
    pendingNewItem: null,
    wave,
    deckComposition,
  }
}
```

`confirmItemSwap`関数を同様に変更する:

```ts
export function confirmItemSwap(params: ShidasuParams, run: RunState, oldItemId: ItemId, seed?: number, rand: () => number = Math.random): RunState {
  if (run.phase !== 'itemSelect' || run.pendingNewItem === null) return run
  const idx = run.items.indexOf(oldItemId)
  const remaining = idx === -1 ? [...run.items] : [...run.items.slice(0, idx), ...run.items.slice(idx + 1)]
  const newItems = [...remaining, run.pendingNewItem]
  const rolledRite = rollRite(run.rites, rand)
  const newRites = rolledRite ? [...run.rites, rolledRite] : run.rites
  const newWaveIndex = run.waveIndex + 1
  const { wave, deckComposition } = startWave(params, run.stageIndex, newWaveIndex, newItems, run.deckComposition, seed)
  return {
    ...run,
    phase: 'playing',
    items: newItems,
    rites: newRites,
    waveIndex: newWaveIndex,
    offer: [],
    pendingNewItem: null,
    wave,
    deckComposition,
  }
}
```

- [ ] **Step 6: `useRite`のテストを追加する**

`engine.test.ts`に、既存の`describe('applyStuckCheck (不屈の護符)', ...)`ブロックの直後に、以下の新規`describe`ブロックを追加する。

```ts
describe('useRite', () => {
  test('所持している秘儀を使用すると効果が適用され、所持から1個削除される', () => {
    const wave = makeWave({ combo: 2, maxComboThisWave: 2 })
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), wave, rites: ['uruz'] }
    const next = useRite(DEFAULT_PARAMS, run, 'uruz', createRng(1))
    expect(next.wave!.combo).toBe(2 + DEFAULT_PARAMS.rites.uruz.n)
    expect(next.rites).toEqual([])
  })

  test('所持していない秘儀は使用できない(何も起こらない)', () => {
    const wave = makeWave({ combo: 2 })
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), wave, rites: [] }
    const next = useRite(DEFAULT_PARAMS, run, 'uruz', createRng(1))
    expect(next).toEqual(run)
  })

  test('使用条件を満たさない秘儀(チェーン2枚未満のティワズ)は使用できない', () => {
    const wave = makeWave({ chain: [card(1, '♣', 5)], chainOrigin: ['draw'] })
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), wave, rites: ['tiwaz'] }
    const next = useRite(DEFAULT_PARAMS, run, 'tiwaz', createRng(1))
    expect(next.rites).toEqual(['tiwaz']) // 消費されない
  })

  test('同じ秘儀を複数所持している場合、1個だけ消費される', () => {
    const wave = makeWave({ combo: 2, maxComboThisWave: 2 })
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), wave, rites: ['uruz', 'uruz'] }
    const next = useRite(DEFAULT_PARAMS, run, 'uruz', createRng(1))
    expect(next.rites).toEqual(['uruz'])
  })
})

describe('エイワズ(コンボリセット防止)とdrawStock/applyStuckCheckの統合', () => {
  test('シールド残り回数が1以上のとき、drawStockの通常コンボリセットが防がれチェーンが継続扱いになる', () => {
    const wave = makeWave({
      stock: [card(20, '♠', 1)], // 差4、通常ならパターン不継続でリセットされる
      chain: [card(0, '♠', 5)],
      chainOrigin: ['draw'],
      linked: true,
      combo: 3,
      comboResetShieldRemaining: 1,
    })
    const result = drawStock(DEFAULT_PARAMS, wave, [], 1000000, standardDeckComposition())
    expect(result.wave.status).toBe('playing')
    expect(result.wave.combo).toBe(3) // リセットされず維持
    expect(result.wave.chain).toHaveLength(2) // 新しいカードがチェーンに追加された
    expect(result.wave.comboResetShieldRemaining).toBe(0) // 1回分消費
  })

  test('シールド残り回数が0なら通常通りコンボリセットされる', () => {
    const wave = makeWave({
      stock: [card(20, '♠', 1)],
      chain: [card(0, '♠', 5)],
      chainOrigin: ['draw'],
      linked: true,
      combo: 3,
      comboResetShieldRemaining: 0,
    })
    const result = drawStock(DEFAULT_PARAMS, wave, [], 1000000, standardDeckComposition())
    expect(result.wave.combo).toBe(0)
    expect(result.wave.chain).toHaveLength(1)
  })
})
```

このテストブロックを追加する前に、`engine.test.ts`冒頭のimportに`useRite`・`RunState`・`RiteId`(型のみ)が含まれているか確認し、無ければ追加すること。また`card`ヘルパー・`makeWave`ヘルパー・`beginRun`・`drawStock`・`standardDeckComposition`・`createRng`が既にimportされていることを確認すること(既存テストで使われているはずなので追加不要の可能性が高いが、`Read`で確認すること)。

- [ ] **Step 7: テスト実行・型チェック**

```bash
npm run test
npm run check
```

Expected: 全テスト成功。型エラーなし。

- [ ] **Step 8: コミット**

```bash
git add src/lib/game/shidasu/rites.ts src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: useRite・コンボリセット防止・全列プレイ可能・秘儀取得ロジックをengine.tsに統合"
```

---

### Task 5: ルーン文字用Webフォントの同梱

**Files:**
- Create: `static/fonts/NotoSansRunic-Regular.woff2`
- Modify: `src/app.css`

- [ ] **Step 1: フォントファイルをダウンロードする**

```bash
mkdir -p static/fonts
curl -s -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" "https://fonts.googleapis.com/css2?family=Noto+Sans+Runic&display=swap" -o /tmp/notosansrunic.css
cat /tmp/notosansrunic.css
```

Expected: `@font-face { ... src: url(https://fonts.gstatic.com/...woff2) format('woff2'); ... }`という内容のCSSが出力される。

- [ ] **Step 2: 実際のフォントURLを抽出してダウンロードする**

```bash
FONT_URL=$(grep -o 'https://fonts.gstatic.com/[^)]*\.woff2' /tmp/notosansrunic.css | head -1)
echo "$FONT_URL"
curl -s -o static/fonts/NotoSansRunic-Regular.woff2 "$FONT_URL"
ls -la static/fonts/NotoSansRunic-Regular.woff2
```

Expected: `static/fonts/NotoSansRunic-Regular.woff2`が作成され、数十KB程度のファイルサイズになる(Runic専用フォントのため、他スクリプトのフォントより大幅に小さい)。

もしネットワークアクセスが制限されておりダウンロードできない場合は、その旨を報告してBLOCKEDとして中断すること(自己判断でこの手順を省略しない)。

- [ ] **Step 3: `@font-face`を追加する**

`src/app.css`の末尾に以下を追加する:

```css
@font-face {
  font-family: 'ShidasuRunic';
  src: url('/fonts/NotoSansRunic-Regular.woff2') format('woff2');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
```

- [ ] **Step 4: ビルド確認**

```bash
npm run build
```

Expected: ビルド成功。`dist/fonts/NotoSansRunic-Regular.woff2`(または相当するパス)が出力に含まれることを確認する。

- [ ] **Step 5: コミット**

```bash
git add static/fonts/NotoSansRunic-Regular.woff2 src/app.css
git commit -m "feat: ルーン文字表示用にNoto Sans Runicを同梱"
```

---

### Task 6: プレイ画面(PlayArea・+page.svelte)への秘儀UI統合

**Files:**
- Modify: `src/routes/game/shidasu/PlayArea.svelte`
- Modify: `src/routes/game/shidasu/+page.svelte`

- [ ] **Step 1: `PlayArea.svelte`にpropsを追加する**

`src/routes/game/shidasu/PlayArea.svelte`を`Read`で確認する。冒頭のimportに以下を追加する:

```ts
  import { canUseRite } from '$lib/game/shidasu/riteEffects'
  import { riteDesc } from '$lib/game/shidasu/rites'
  import type { RiteId } from '$lib/game/shidasu/types'
```

`let { ... } = $props()`の分割代入に、`rites`・`onUseRite`を追加する(既存の`dropTarget = null, headerExtra, extraFooter,`の直後):

```ts
  let {
    wave, params, modifier, target, items, onPlayCard, onDraw, dropTarget = null, headerExtra, extraFooter,
    rites = [], onUseRite,
  }: {
    wave: WaveState
    params: ShidasuParams
    modifier: StageModifier
    target: number
    items: ItemId[]
    onPlayCard: (colIndex: number) => void
    onDraw: () => void
    dropTarget?: { col: number; row: number } | 'stockTop' | null
    headerExtra?: Snippet
    extraFooter?: Snippet
    rites?: RiteId[]
    onUseRite?: (riteId: RiteId) => void
  } = $props()
```

- [ ] **Step 2: 秘儀ボタン列を追加する**

既存の山札ボタン・チェーン表示を含む`<div class="px-4 pb-5 pt-2 flex items-start gap-4">...</div>`ブロックの直後(`</div>`の後、ファイル末尾の`{/if}`より前)に、以下を追加する:

```svelte
{#if rites.length > 0}
  <div class="px-4 pb-4 flex items-center gap-2">
    {#each rites as riteId, i (i)}
      {@const usable = canUseRite(params, wave, riteId)}
      <button
        type="button"
        onclick={() => onUseRite?.(riteId)}
        disabled={!usable}
        title={riteDesc(riteId, params)}
        style="font-family: 'ShidasuRunic', sans-serif;"
        class="w-10 h-10 rounded-lg border-2 flex items-center justify-center text-xl font-black transition-transform active:scale-95 {usable ? 'bg-fuchsia-900 border-fuchsia-500 text-fuchsia-100 hover:bg-fuchsia-800' : 'bg-slate-800 border-slate-700 text-slate-600 cursor-not-allowed'}"
      >{params.rites[riteId].name}</button>
    {/each}
  </div>
{/if}
```

- [ ] **Step 3: `+page.svelte`から秘儀を配線する**

`src/routes/game/shidasu/+page.svelte`を`Read`で確認する。冒頭のimportに`useRite`を追加し(既存の`applyPlayCard, applyDrawStock, applyStuckCheck,`等が並ぶimport文に追加)、`RiteId`型のimportも追加する:

```ts
  import type { RunState, ItemId, StageModifier, Suit, Rank, RiteId } from '$lib/game/shidasu/types'
```

`handlePlayCard`関数の直後に、以下の新規関数を追加する:

```ts
  function handleUseRite(riteId: RiteId) {
    if (run.phase !== 'playing' || run.wave?.status !== 'playing') return
    run = useRite(params, run, riteId)
  }
```

2箇所ある`<PlayArea ... />`呼び出し(`measurementWave`用と実際の表示用)の両方に、`rites={run.rites}`と`onUseRite={handleUseRite}`を追加する:

```svelte
<PlayArea wave={measurementWave} {params} modifier={stage.modifier} {target} items={run.items} onPlayCard={handlePlayCard} onDraw={handleDraw} headerExtra={stageRow} extraFooter={itemBadges} rites={run.rites} onUseRite={handleUseRite} />
```

```svelte
<PlayArea {wave} {params} modifier={stage.modifier} {target} items={run.items} onPlayCard={handlePlayCard} onDraw={handleDraw} headerExtra={stageRow} extraFooter={itemBadges} rites={run.rites} onUseRite={handleUseRite} />
```

- [ ] **Step 4: 型チェック・ビルド**

```bash
npm run check
npm run build
```

Expected: エラーなし・ビルド成功。

- [ ] **Step 5: `npm run dev`で動作確認する**

```bash
npm run dev
```

`/game/shidasu`を開き、ゲームを開始し、以下を確認する(所持秘儀は取得次第表示されるため、何度かウェーブをクリアして護符を取得し、秘儀が自然に付与されるまで進める。時間がかかる場合はブラウザのdevtoolsで`run.rites`相当のログを仕込む等、時間内で確認できる範囲でよい):
- 秘儀ボタンが表示され、マウスオーバーで効果テキストが表示される
- クリックで効果が発動し、所持から1個減る
- 条件を満たさない秘儀(チェーン2枚未満のティワズ等)はボタンがdisabledになる
- コンソールエラーが出ていないこと

- [ ] **Step 6: コミット**

```bash
git add src/routes/game/shidasu/PlayArea.svelte src/routes/game/shidasu/+page.svelte
git commit -m "feat: プレイ画面に秘儀の使用ボタン列を追加"
```

---

### Task 7: 管理画面(`/admin/shidasu-rites`)新設

**Files:**
- Create: `src/routes/admin/shidasu-rites/+page.svelte`
- Modify: `src/routes/admin/+page.svelte`

- [ ] **Step 1: `/admin/shidasu-talismans/+page.svelte`を`Read`で確認する**

既存の構成(`loadConfig`・`save`・バリデーション・テーブル)を把握する。

- [ ] **Step 2: `/admin/shidasu-rites/+page.svelte`を新規作成する**

以下の内容で新規作成する。護符の管理画面とほぼ同じ構成だが、レア度列が無く、名前列が`runes.ts`からの`<select>`になる。

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { DEFAULT_PARAMS, type ShidasuParams } from '$lib/game/shidasu/params'
  import { riteDesc } from '$lib/game/shidasu/rites'
  import { RUNES } from '$lib/game/shidasu/runes'
  import { RITE_POOL } from '$lib/game/shidasu/rites'
  import type { RiteId } from '$lib/game/shidasu/types'

  let config = $state<ShidasuParams | null>(null)
  let error = $state<string | null>(null)
  let flash = $state<string | null>(null)
  let flashTimer: ReturnType<typeof setTimeout> | null = null

  function showToast(message: string) {
    if (flashTimer) clearTimeout(flashTimer)
    flash = message
    flashTimer = setTimeout(() => { flash = null }, 2000)
  }

  type RiteEntry = { name: string; desc: string } & Record<string, number | string>

  function riteEntry(id: RiteId): RiteEntry {
    return config!.rites[id] as unknown as RiteEntry
  }

  function riteParamKeys(id: RiteId): string[] {
    return Object.keys(riteEntry(id)).filter(key => key !== 'name' && key !== 'desc')
  }

  let hasValidationError = $derived.by(() => {
    if (!config) return false
    return RITE_POOL.some(id => {
      const entry = riteEntry(id)
      if (!entry.name.trim()) return true
      if (!entry.desc.trim()) return true
      return riteParamKeys(id).some(key => !Number.isFinite(entry[key] as number))
    })
  })

  async function loadConfig(toast = false) {
    try {
      const res = await fetch('/api/admin/shidasu-config')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      config = await res.json() as ShidasuParams
      error = null
      if (toast) showToast('リロードしました')
    } catch {
      error = 'Shidasu設定APIに接続できません。npm run dev で起動してください。'
      if (!config) config = JSON.parse(JSON.stringify(DEFAULT_PARAMS))
    }
  }

  async function save() {
    if (!config) return
    try {
      const res = await fetch('/api/admin/shidasu-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      showToast('保存しました(反映には再ビルド・再デプロイが必要です)')
    } catch {
      error = '保存に失敗しました'
    }
  }

  onMount(() => loadConfig())
  onDestroy(() => {
    if (flashTimer) clearTimeout(flashTimer)
  })
</script>

<svelte:head>
  <title>Shidasu 秘儀パラメータ設定</title>
</svelte:head>

<div class="max-w-5xl mx-auto px-4 py-8">
  <a href="/admin" class="text-xs text-slate-400 hover:text-teal-600 mb-4 inline-block">← 管理ページ一覧</a>

  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold text-slate-800">星詠みソリティア -Shidasu- 秘儀パラメータ設定</h1>
    <div class="flex gap-2">
      <button onclick={() => loadConfig(true)} class="text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
        リロード
      </button>
      {#if hasValidationError}
        <p class="text-xs text-red-600 self-center">秘儀名・説明文テンプレートが空、またはパラメータが未入力の項目があります</p>
      {/if}
      <button
        onclick={save}
        disabled={hasValidationError || !config}
        class="text-sm px-3 py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        保存
      </button>
    </div>
  </div>

  {#if error}
    <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
  {/if}

  {#if config}
    <section class="bg-white border border-slate-200 rounded-xl p-4">
      <div class="overflow-x-auto">
        <table class="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
          <thead>
            <tr class="bg-slate-50 text-slate-500">
              <th class="px-2 py-1.5 text-left" style="width:9rem;">名前</th>
              <th class="px-2 py-1.5 text-left" style="width:11rem;">パラメータ</th>
              <th class="px-2 py-1.5 text-left" style="width:16rem;">説明文テンプレート</th>
              <th class="px-2 py-1.5 text-left" style="width:16rem;">プレビュー</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            {#each RITE_POOL as id (id)}
              {@const entry = riteEntry(id)}
              <tr>
                <td class="px-2 py-1.5 align-top">
                  <select bind:value={entry.name} class="w-full border border-slate-200 rounded px-1.5 py-0.5">
                    {#each RUNES as rune (rune.glyph)}
                      <option value={rune.glyph}>{rune.glyph} {rune.reading}</option>
                    {/each}
                  </select>
                </td>
                <td class="px-2 py-1.5 align-top">
                  <div class="flex flex-wrap gap-1.5">
                    {#each riteParamKeys(id) as key (key)}
                      <label class="flex items-center gap-1 text-[11px] text-slate-500">
                        {key}
                        <input type="number" step="any" bind:value={entry[key]} class="w-16 border border-slate-200 rounded px-1 py-0.5" />
                      </label>
                    {/each}
                    {#if riteParamKeys(id).length === 0}
                      <span class="text-slate-300">-</span>
                    {/if}
                  </div>
                </td>
                <td class="px-2 py-1.5 align-top">
                  <textarea
                    bind:value={entry.desc}
                    rows="3"
                    class="w-full border border-slate-200 rounded px-1.5 py-0.5 font-mono text-[11px] resize-y"
                  ></textarea>
                </td>
                <td class="px-2 py-1.5 align-top text-slate-500">{riteDesc(id, config)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  {:else if !error}
    <p class="text-slate-500 text-sm">読み込み中...</p>
  {/if}
</div>

{#if flash}
  <div class="fixed bottom-6 right-6 bg-slate-800 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-50">
    {flash}
  </div>
{/if}
```

- [ ] **Step 3: `/admin`一覧ページにリンクを追加する**

`src/routes/admin/+page.svelte`を`Read`で確認し、`/admin/shidasu-talismans`へのリンクカードがどう書かれているか確認する。その直後に、同様の形式で`/admin/shidasu-rites`へのリンクカードを追加する(リンクテキストは「星詠みソリティア -Shidasu- 秘儀パラメータ設定」などその画面の見出しと対応する文言にする)。

- [ ] **Step 4: 型チェック・ビルド**

```bash
npm run check
npm run build
```

Expected: エラーなし・ビルド成功。

- [ ] **Step 5: `npm run dev`で動作確認する**

```bash
npm run dev
```

`/admin/shidasu-rites`を開き、以下を確認する:
- 17種の秘儀が表示される
- 名前列がルーン文字の`<select>`になっており、選択肢にカタカナ読みが表示される
- パラメータ・説明文テンプレート・プレビューが編集でき、保存・リロードが機能する
- コンソールエラーが出ていないこと

- [ ] **Step 6: コミット**

```bash
git add src/routes/admin/shidasu-rites/+page.svelte src/routes/admin/+page.svelte
git commit -m "feat: 秘儀パラメータ設定画面(/admin/shidasu-rites)を新設"
```

---

### Task 8: 最終検証・ブラウザ動作確認

**Files:** なし(検証のみ)

- [ ] **Step 1: 全体テスト・型チェック・ビルド**

```bash
npm run test
npm run check
npm run build
```

Expected: すべて成功(型チェックの既存無関係エラーは除く)。

- [ ] **Step 2: ブラウザで一通り確認する**

`npm run dev`を起動し、以下を確認する:
- `/admin/shidasu-rites`: 17秘儀が表示され、保存・リロードが機能する
- `/game/shidasu`: ゲームを開始し、何ウェーブか進めて秘儀を取得し、実際に使用してみる(可能な範囲で複数種類、特にライドー・イェラのような盤面変換系と、エイワズ・アルギズのような持続効果系を1つずつ試す)
- コンソールエラーが出ていないこと

- [ ] **Step 3: 開発サーバーを停止する**

## Self-Review 結果

- **spec coverage:** spec section1(基本ルール)→Task1・Task4、section2(命名・モチーフ)→Task1・Task2、section2.1(Webフォント)→Task5、section3(17秘儀候補)→Task2・Task3、section3.1(コンボリセット防止の適用範囲)→Task4 Step3、section4.1(プレイ画面UI)→Task6、section4.2(管理画面)→Task7、section5(データ構造)→Task1・Task2・Task3・Task4、受け入れ基準1〜8→Task1〜Task8でそれぞれ充足。
- **placeholder scan:** 全タスクで変更対象の完全なコードを記載済み。Webフォントのダウンロードのみ、バイナリファイルの性質上コマンド実行によって取得する形とした(URLは実行時に動的抽出するが、コマンド自体は完全に具体的)。
- **type consistency:** `RiteId`(17種)・`riteEffects.ts`の関数名・`params.rites`のキー名・`RITE_POOL`の並び順を全タスクを通して一貫させた。`useRite`・`canUseRite`・`applyRiteEffect`・`riteName`・`riteDesc`・`rollRite`の関数シグネチャもTask3・Task4・Task6・Task7で一致させた。
