# Shidasu 天啓(Revelation)実装 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `docs/superpowers/specs/2026-07-21-shidasu-revelation-design.md`に基づき、アイテム種類③天啓(Revelation、二十八宿モチーフ)を12種実装し、専用の取得画面(プレビューウェーブ+秘儀併用可)と、通常プレイ中の使用UIを追加する。

**Architecture:** 秘儀(`RiteId`/`riteEffects.ts`/`rites.ts`)と同じ「型追加→パラメータ登録→効果関数追加」パターンを踏襲しつつ、天啓固有の2点を追加する: (1)効果が`WaveState`だけでなく`DeckCard[]`(デッキ構成)も永続的に書き換える、(2)専用の取得画面(`RunPhase`に`'revelationSelect'`を新設)を持ち、そこでは通常のウェーブ開始と同じロジックでプレビュー用のウェーブを配って天啓・秘儀を試せるようにする。

**Tech Stack:** TypeScript, Svelte 5, Vitest

---

### Task 1: 型定義・パラメータ登録・二十八宿参照データ

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`
- Create: `src/lib/game/shidasu/mansions.ts`
- Modify: `src/lib/game/shidasu/params.ts`
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Test: `src/lib/game/shidasu/engine.test.ts`(RunState型変更に伴う既存テストの追従のみ、新規テストはTask 3で追加)

- [ ] **Step 1: `RevelationId`型を追加する**

`src/lib/game/shidasu/types.ts`の`RiteId`型の直後(51行目付近)に追加:

```ts
// 天啓(Revelation): いつでも使用可能で、場札・デッキ構成の両方に永続的な効果を発揮する消費アイテム。
// 二十八宿のうち今回効果を実装した12種のみをメンバーとする(残り16種はmansions.tsの見た目候補にのみ存在)。
export type RevelationId =
  | 'kaku' | 'kou' | 'tei' | 'bou'
  | 'shin' | 'bi' | 'ki' | 'to'
  | 'gyu' | 'jo'
  | 'kyo'
  | 'aya'
```

- [ ] **Step 2: `RunPhase`・`RunState`を変更する**

`RunPhase`の定義(166行目付近)を以下に変更:

```ts
export type RunPhase = 'title' | 'playing' | 'itemSelect' | 'revelationSelect' | 'stageClear' | 'allClear' | 'gameOver'
```

`RunState`インターフェース(167-179行目付近)の末尾(`rites: RiteId[]`の直後)に追加:

```ts
  // 所持中の天啓(最大2、同じ種類を複数所持できる)。ウェーブを跨いで持続する(秘儀と同様)
  revelations: RevelationId[]
  // 天啓選択画面('revelationSelect'フェーズ)で提示中のオファー(3択)。それ以外のフェーズでは空配列
  revelationOffer: RevelationId[]
  // 天啓「虚」由来の、ウェーブ開始時の配布行数への永続的な追加分(暗雲護符のrと合算される)
  extraTableauRows: number
```

- [ ] **Step 3: `mansions.ts`を新規作成する**

`src/lib/game/shidasu/mansions.ts`を新規作成:

```ts
// 二十八宿(中国・日本の伝統的な天文体系)全28宿の参照データ。
// RevelationId(効果実装済み12種)とは独立しており、管理画面の「名前」<select>の
// 選択肢・読み方ラベル表示にのみ使う。将来天啓を追加する際、ここから未使用の宿を選んで割り当てる。
export interface MansionEntry {
  kanji: string
  reading: string
}

export const MANSIONS: MansionEntry[] = [
  { kanji: '角', reading: 'かく' },
  { kanji: '亢', reading: 'こう' },
  { kanji: '氐', reading: 'てい' },
  { kanji: '房', reading: 'ぼう' },
  { kanji: '心', reading: 'しん' },
  { kanji: '尾', reading: 'び' },
  { kanji: '箕', reading: 'き' },
  { kanji: '斗', reading: 'と' },
  { kanji: '牛', reading: 'ぎゅう' },
  { kanji: '女', reading: 'じょ' },
  { kanji: '虚', reading: 'きょ' },
  { kanji: '危', reading: 'き' },
  { kanji: '室', reading: 'しつ' },
  { kanji: '壁', reading: 'へき' },
  { kanji: '奎', reading: 'けい' },
  { kanji: '婁', reading: 'ろう' },
  { kanji: '胃', reading: 'い' },
  { kanji: '昴', reading: 'ぼう' },
  { kanji: '畢', reading: 'ひつ' },
  { kanji: '觜', reading: 'し' },
  { kanji: '参', reading: 'しん' },
  { kanji: '井', reading: 'せい' },
  { kanji: '鬼', reading: 'き' },
  { kanji: '柳', reading: 'りゅう' },
  { kanji: '星', reading: 'せい' },
  { kanji: '張', reading: 'ちょう' },
  { kanji: '翼', reading: 'よく' },
  { kanji: '軫', reading: 'しん' },
]
```

- [ ] **Step 4: `params.ts`に`revelations`セクションを追加する**

`ShidasuParams`インターフェースの`rites: {...}`ブロックの直後(149行目付近)に追加:

```ts
  revelations: {
    kaku: { name: string; desc: string }
    kou: { name: string; desc: string }
    tei: { name: string; desc: string }
    bou: { name: string; desc: string }
    shin: { name: string; desc: string }
    bi: { name: string; desc: string }
    ki: { name: string; desc: string }
    to: { name: string; desc: string }
    gyu: { name: string; desc: string }
    jo: { name: string; desc: string }
    kyo: { name: string; n: number; desc: string }
    aya: { name: string; desc: string }
  }
```

`DEFAULT_PARAMS.rites`ブロックの直後(302行目付近、`ehwaz`エントリの後の`},`の直後)に追加:

```ts
  revelations: {
    kaku: { name: '角', desc: '場札から選んだ1列を、全て♠に変換する(ワイルドは対象外)' },
    kou: { name: '亢', desc: '場札から選んだ1列を、全て♥に変換する(ワイルドは対象外)' },
    tei: { name: '氐', desc: '場札から選んだ1列を、全て♦に変換する(ワイルドは対象外)' },
    bou: { name: '房', desc: '場札から選んだ1列を、全て♣に変換する(ワイルドは対象外)' },
    shin: { name: '心', desc: '場札の♠を全て♥に変換する(ワイルドは対象外)' },
    bi: { name: '尾', desc: '場札の♥を全て♣に変換する(ワイルドは対象外)' },
    ki: { name: '箕', desc: '場札の♣を全て♦に変換する(ワイルドは対象外)' },
    to: { name: '斗', desc: '場札の♦を全て♠に変換する(ワイルドは対象外)' },
    gyu: { name: '牛', desc: '場札から選んだ1列を、ランクA〜10のいずれかへランダムに変換する(1枚ごとに個別抽選。ワイルドは対象外)' },
    jo: { name: '女', desc: '場札から選んだ1列を、ランクJ・Q・Kのいずれかへランダムに変換する(1枚ごとに個別抽選。ワイルドは対象外)' },
    kyo: { name: '虚', n: 1, desc: '場札に{n}行追加する(山札の上から配る)。以後のウェーブ開始時の配布行数も恒久的に{n}増える' },
    aya: { name: '危', desc: '場札から選んだ1列の一番上に、ワイルドを1枚追加する' },
  },
```

- [ ] **Step 5: `shidasu.config.json`に`revelations`セクションを追加する**

`src/lib/game/shidasu/shidasu.config.json`の`"rites"`セクションの閉じ`},`の直後(`"flow"`セクションの直前)に追加:

```json
  "revelations": {
    "kaku": { "name": "角", "desc": "場札から選んだ1列を、全て♠に変換する(ワイルドは対象外)" },
    "kou": { "name": "亢", "desc": "場札から選んだ1列を、全て♥に変換する(ワイルドは対象外)" },
    "tei": { "name": "氐", "desc": "場札から選んだ1列を、全て♦に変換する(ワイルドは対象外)" },
    "bou": { "name": "房", "desc": "場札から選んだ1列を、全て♣に変換する(ワイルドは対象外)" },
    "shin": { "name": "心", "desc": "場札の♠を全て♥に変換する(ワイルドは対象外)" },
    "bi": { "name": "尾", "desc": "場札の♥を全て♣に変換する(ワイルドは対象外)" },
    "ki": { "name": "箕", "desc": "場札の♣を全て♦に変換する(ワイルドは対象外)" },
    "to": { "name": "斗", "desc": "場札の♦を全て♠に変換する(ワイルドは対象外)" },
    "gyu": { "name": "牛", "desc": "場札から選んだ1列を、ランクA〜10のいずれかへランダムに変換する(1枚ごとに個別抽選。ワイルドは対象外)" },
    "jo": { "name": "女", "desc": "場札から選んだ1列を、ランクJ・Q・Kのいずれかへランダムに変換する(1枚ごとに個別抽選。ワイルドは対象外)" },
    "kyo": { "name": "虚", "n": 1, "desc": "場札に{n}行追加する(山札の上から配る)。以後のウェーブ開始時の配布行数も恒久的に{n}増える" },
    "aya": { "name": "危", "desc": "場札から選んだ1列の一番上に、ワイルドを1枚追加する" }
  },
```

**注意:** `shidasu.config.json`の`"rites"`セクションの直後には既に`"flow"`セクションがある。`"rites"`の閉じ`},`の後、`"flow"`の前に上記を挿入すること(既存の`"flow"`の直前にカンマ区切りで追加)。

- [ ] **Step 6: RunState型変更に追従する既存テストを修正する**

`src/lib/game/shidasu/engine.test.ts`内、以下の完全なオブジェクトリテラル(6箇所、`describe('applyStuckCheck', ...)`内)を修正する。全て同一の文字列`wave, pendingNewItem: null, deckComposition: standardDeckComposition(), rites: [],`を含むため、一括置換する:

```ts
      wave, pendingNewItem: null, deckComposition: standardDeckComposition(), rites: [],
```

を以下に置き換える(全6箇所、`replace_all`で一括置換):

```ts
      wave, pendingNewItem: null, deckComposition: standardDeckComposition(), rites: [],
      revelations: [], revelationOffer: [], extraTableauRows: 0,
```

- [ ] **Step 7: 型チェックを実行し成功を確認する**

Run: `npm run check`
Expected: `engine.ts`・`engine.test.ts`・`params.ts`・`types.ts`に関連するエラーが無いこと(この時点では`engine.ts`側で`RunState`を返す関数群がまだ新フィールドを設定していないため、`createInitialRun`/`beginRun`関連で型エラーが出ることを許容する。Task 3で解消する)

- [ ] **Step 8: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/mansions.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 天啓の型定義・パラメータ・二十八宿参照データを追加"
```

---

### Task 2: 天啓の効果ロジック(`revelations.ts`・`revelationEffects.ts`)

**Files:**
- Create: `src/lib/game/shidasu/revelations.ts`
- Create: `src/lib/game/shidasu/revelationEffects.ts`
- Test: `src/lib/game/shidasu/revelationEffects.test.ts`

- [ ] **Step 1: `revelations.ts`を新規作成する**

```ts
// src/lib/game/shidasu/revelations.ts
import type { RevelationId } from './types'
import type { ShidasuParams } from './params'
import { shuffleInPlace } from './deck'

// rollRevelationOfferは重み付けなしの完全均等抽選。効果が実装済みの12種のみが対象。
export const REVELATION_POOL: RevelationId[] = [
  'kaku', 'kou', 'tei', 'bou',
  'shin', 'bi', 'ki', 'to',
  'gyu', 'jo',
  'kyo',
  'aya',
]

export function revelationName(id: RevelationId, params: ShidasuParams): string {
  return params.revelations[id].name
}

export function revelationDesc(id: RevelationId, params: ShidasuParams): string {
  const entry = params.revelations[id] as unknown as Record<string, unknown> & { desc: string }
  const context: Record<string, number> = { rows: params.layout.rows, cols: params.layout.cols }
  for (const [key, value] of Object.entries(entry)) {
    if (typeof value === 'number') context[key] = value
  }
  return entry.desc.replace(/\{(\w+)\}/g, (match, key) => (key in context ? String(context[key]) : match))
}

// 天啓プールから均等ランダムに3つ選ぶ(所持数に関わらず重複除外しない、秘儀のrollRiteと同じ方式。
// ただしrollRiteと異なり、常に3つ返す(所持上限による抽選中断は無い。上限時の「獲得」不可判定は
// 呼び出し側=engine.tsのpickRevelationFromOfferで行う))。
export function rollRevelationOffer(rand: () => number = Math.random): RevelationId[] {
  const pool = [...REVELATION_POOL]
  shuffleInPlace(pool, rand)
  return pool.slice(0, 3)
}
```

- [ ] **Step 2: 失敗するテストを書く(`revelationEffects.test.ts`)**

`src/lib/game/shidasu/revelationEffects.test.ts`を新規作成:

```ts
import { describe, test, expect } from 'vitest'
import { applyRevelationEffect, canUseRevelation, revelationNeedsTarget } from './revelationEffects'
import { DEFAULT_PARAMS } from './params'
import { createRng } from './deck'
import type { Card, DeckCard, WaveState } from './types'

function card(id: number, suit: Card['suit'], rank: Card['rank'], wild = false, deckId = id): Card {
  return { id, deckId, suit, rank, wild }
}

function deckCard(deckId: number, suit: DeckCard['suit'], rank: DeckCard['rank'], wild = false): DeckCard {
  return { deckId, suit, rank, wild }
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
    nauthizActiveThisWave: false,
    comboFrozenThisWave: false,
    sowiloActiveThisWave: false,
    sowiloBoostedRole: null,
    mannazActiveThisWave: false,
    ehwazActiveThisWave: false,
    ...overrides,
  }
}

describe('revelationEffects', () => {
  test('角: 選んだ列の非ワイルドカードが全て♠に変換され、deckCompositionにも反映される', () => {
    const wave = baseWave({ tableau: [[card(1, '♥', 3), card(2, '♦', 4), card(3, '♠', 5, true)]] })
    const deckComposition: DeckCard[] = [deckCard(1, '♥', 3), deckCard(2, '♦', 4), deckCard(3, '♠', 5, true)]
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'kaku', 0, createRng(1))
    expect(result.wave.tableau[0].map(c => c.suit)).toEqual(['♠', '♠', '♠'])
    expect(result.wave.tableau[0][2].wild).toBe(true) // ワイルドはスート変更されない
    expect(result.deckComposition.find(c => c.deckId === 1)?.suit).toBe('♠')
    expect(result.deckComposition.find(c => c.deckId === 2)?.suit).toBe('♠')
    expect(result.deckComposition.find(c => c.deckId === 3)?.suit).toBe('♠') // ワイルドのdeckCompositionエントリも変更しない
  })

  test('角: targetColがnullなら何もしない', () => {
    const wave = baseWave({ tableau: [[card(1, '♥', 3)]] })
    const deckComposition: DeckCard[] = [deckCard(1, '♥', 3)]
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'kaku', null, createRng(1))
    expect(result.wave).toBe(wave)
    expect(result.deckComposition).toBe(deckComposition)
  })

  test('心: 場札全体の♠が全て♥に変換され、deckCompositionにも反映される(他のスートは対象外)', () => {
    const wave = baseWave({
      tableau: [[card(1, '♠', 3), card(2, '♦', 4)], [card(3, '♠', 5, true)]],
    })
    const deckComposition: DeckCard[] = [deckCard(1, '♠', 3), deckCard(2, '♦', 4), deckCard(3, '♠', 5, true)]
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'shin', null, createRng(1))
    expect(result.wave.tableau[0][0].suit).toBe('♥')
    expect(result.wave.tableau[0][1].suit).toBe('♦') // ♦は対象外
    expect(result.wave.tableau[1][0].suit).toBe('♠') // ワイルドは対象外
    expect(result.deckComposition.find(c => c.deckId === 1)?.suit).toBe('♥')
    expect(result.deckComposition.find(c => c.deckId === 3)?.suit).toBe('♠')
  })

  test('牛: 選んだ列の非ワイルドカードがA〜10のいずれかへ個別ランダムに変換される', () => {
    const wave = baseWave({ tableau: [[card(1, '♠', 11), card(2, '♦', 12), card(3, '♠', 13, true)]] })
    const deckComposition: DeckCard[] = [deckCard(1, '♠', 11), deckCard(2, '♦', 12), deckCard(3, '♠', 13, true)]
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'gyu', 0, createRng(1))
    expect(result.wave.tableau[0][0].rank).toBeGreaterThanOrEqual(1)
    expect(result.wave.tableau[0][0].rank).toBeLessThanOrEqual(10)
    expect(result.wave.tableau[0][1].rank).toBeGreaterThanOrEqual(1)
    expect(result.wave.tableau[0][1].rank).toBeLessThanOrEqual(10)
    expect(result.wave.tableau[0][2].rank).toBe(13) // ワイルドは変換されない
    expect(result.deckComposition.find(c => c.deckId === 1)?.rank).toBe(result.wave.tableau[0][0].rank)
  })

  test('女: 選んだ列の非ワイルドカードがJ・Q・Kのいずれかへ個別ランダムに変換される', () => {
    const wave = baseWave({ tableau: [[card(1, '♠', 1), card(2, '♦', 2)]] })
    const deckComposition: DeckCard[] = [deckCard(1, '♠', 1), deckCard(2, '♦', 2)]
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'jo', 0, createRng(1))
    expect(result.wave.tableau[0][0].rank).toBeGreaterThanOrEqual(11)
    expect(result.wave.tableau[0][1].rank).toBeGreaterThanOrEqual(11)
  })

  test('虚: 山札の上からn行(列数×n枚)を各列の末尾に配る', () => {
    const wave = baseWave({
      tableau: [[card(1, '♠', 1)], [card(2, '♠', 2)]],
      stock: [card(10, '♦', 9), card(11, '♦', 8), card(12, '♦', 7), card(13, '♦', 6)],
    })
    const deckComposition: DeckCard[] = []
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'kyo', null, createRng(1))
    // n=1(既定)、列数2なので2枚配られ、山札は2枚残る
    expect(result.wave.tableau[0]).toHaveLength(2)
    expect(result.wave.tableau[1]).toHaveLength(2)
    expect(result.wave.stock).toHaveLength(2)
    // 山札の一番上(末尾)から順に配られる
    expect(result.wave.tableau[0][1]).toEqual(card(13, '♦', 6))
    expect(result.wave.tableau[1][1]).toEqual(card(12, '♦', 7))
  })

  test('虚: 使用条件は山札が(列数×n)枚以上であること', () => {
    const wave = baseWave({
      tableau: [[card(1, '♠', 1)], [card(2, '♠', 2)]],
      stock: [card(10, '♦', 9)],
    })
    expect(canUseRevelation(DEFAULT_PARAMS, wave, 'kyo')).toBe(false)
    const wave2 = baseWave({
      tableau: [[card(1, '♠', 1)], [card(2, '♠', 2)]],
      stock: [card(10, '♦', 9), card(11, '♦', 8)],
    })
    expect(canUseRevelation(DEFAULT_PARAMS, wave2, 'kyo')).toBe(true)
  })

  test('危: 選んだ列の一番上にワイルドが追加され、deckCompositionにも新規ワイルドエントリが1件追加される', () => {
    const wave = baseWave({ tableau: [[card(1, '♠', 1)], []] })
    const deckComposition: DeckCard[] = [deckCard(1, '♠', 1)]
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'aya', 1, createRng(1))
    expect(result.wave.tableau[1]).toHaveLength(1)
    expect(result.wave.tableau[1][0].wild).toBe(true)
    expect(result.deckComposition).toHaveLength(2)
    expect(result.deckComposition[1].wild).toBe(true)
  })

  test('revelationNeedsTarget: 列選択が必要な種類とそうでない種類を正しく区別する', () => {
    expect(revelationNeedsTarget('kaku')).toBe(true)
    expect(revelationNeedsTarget('gyu')).toBe(true)
    expect(revelationNeedsTarget('jo')).toBe(true)
    expect(revelationNeedsTarget('aya')).toBe(true)
    expect(revelationNeedsTarget('shin')).toBe(false)
    expect(revelationNeedsTarget('kyo')).toBe(false)
  })
})
```

- [ ] **Step 3: テストを実行し失敗を確認する**

Run: `npm run test -- revelationEffects`
Expected: FAIL(`./revelationEffects`モジュールが存在しない)

- [ ] **Step 4: `revelationEffects.ts`を実装する**

`src/lib/game/shidasu/revelationEffects.ts`を新規作成:

```ts
import type { Card, DeckCard, Rank, Suit, WaveState, RevelationId } from './types'
import type { ShidasuParams } from './params'

function pickRandom<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)]
}

// 指定した列の非ワイルドカードを全て対象スートへ変換し、wave・deckComposition両方に反映する。
function convertColumnToSuit(wave: WaveState, deckComposition: DeckCard[], colIndex: number, suit: Suit): { wave: WaveState; deckComposition: DeckCard[] } {
  const col = wave.tableau[colIndex]
  if (!col) return { wave, deckComposition }
  const targetDeckIds = new Set(col.filter(c => !c.wild).map(c => c.deckId))
  const tableau = wave.tableau.map((c, i) => (i === colIndex ? c.map(cardEl => (cardEl.wild ? cardEl : { ...cardEl, suit })) : c))
  const newComposition = deckComposition.map(entry => (targetDeckIds.has(entry.deckId) ? { ...entry, suit } : entry))
  return { wave: { ...wave, tableau }, deckComposition: newComposition }
}

// 場札全体の指定スートの非ワイルドカードを全て別のスートへ変換し、wave・deckComposition両方に反映する。
function convertTableauSuit(wave: WaveState, deckComposition: DeckCard[], from: Suit, to: Suit): { wave: WaveState; deckComposition: DeckCard[] } {
  const targetDeckIds = new Set(wave.tableau.flat().filter(c => !c.wild && c.suit === from).map(c => c.deckId))
  const tableau = wave.tableau.map(col => col.map(cardEl => (!cardEl.wild && cardEl.suit === from ? { ...cardEl, suit: to } : cardEl)))
  const newComposition = deckComposition.map(entry => (targetDeckIds.has(entry.deckId) ? { ...entry, suit: to } : entry))
  return { wave: { ...wave, tableau }, deckComposition: newComposition }
}

// 指定した列の非ワイルドカードを、候補ランクの中からカードごとに個別ランダムで変換する。
function convertColumnToRandomRank(wave: WaveState, deckComposition: DeckCard[], colIndex: number, candidateRanks: Rank[], rand: () => number): { wave: WaveState; deckComposition: DeckCard[] } {
  const col = wave.tableau[colIndex]
  if (!col) return { wave, deckComposition }
  const rankByDeckId = new Map<number, Rank>()
  const newCol = col.map(cardEl => {
    if (cardEl.wild) return cardEl
    const rank = pickRandom(candidateRanks, rand)
    rankByDeckId.set(cardEl.deckId, rank)
    return { ...cardEl, rank }
  })
  const tableau = wave.tableau.map((c, i) => (i === colIndex ? newCol : c))
  const newComposition = deckComposition.map(entry => (rankByDeckId.has(entry.deckId) ? { ...entry, rank: rankByDeckId.get(entry.deckId) as Rank } : entry))
  return { wave: { ...wave, tableau }, deckComposition: newComposition }
}

// 山札の上からn行(列数×n枚)を各列の末尾に1枚ずつ配る(フェフ秘儀のn行版)。deckCompositionは変更しない
// (山札の中身を並べ替えるだけのため)。
function expandTableauRows(wave: WaveState, n: number): WaveState {
  const cols = wave.tableau.length
  const stock = [...wave.stock]
  const tableau = wave.tableau.map(col => [...col])
  for (let r = 0; r < n; r++) {
    for (let i = 0; i < cols; i++) {
      const drawn = stock.pop()
      if (!drawn) break
      tableau[i].push(drawn)
    }
  }
  return { ...wave, tableau, stock }
}

// 場に存在する全カードのidの最大値+1を返す(新規カード生成時の一時id採番用)。
function nextWaveCardId(wave: WaveState): number {
  const allIds = [
    ...wave.tableau.flat().map(c => c.id),
    ...wave.stock.map(c => c.id),
    ...wave.chain.map(c => c.id),
    ...wave.discardPile.map(c => c.id),
  ]
  return (allIds.length > 0 ? Math.max(...allIds) : 0) + 1
}

// 選んだ列の一番上にワイルドを1枚追加する。deckCompositionにも新規ワイルドエントリを1件追加する
// (永劫護符と同じ要領。deckIdは配列長を採番して衝突を回避する)。
function addWildToColumnTop(wave: WaveState, deckComposition: DeckCard[], colIndex: number): { wave: WaveState; deckComposition: DeckCard[] } {
  if (!wave.tableau[colIndex]) return { wave, deckComposition }
  const newDeckId = deckComposition.length
  const newComposition: DeckCard[] = [...deckComposition, { deckId: newDeckId, suit: '★', rank: 0 as Rank, wild: true }]
  const newCard: Card = { id: nextWaveCardId(wave), deckId: newDeckId, suit: '★', rank: 0 as Rank, wild: true }
  const tableau = wave.tableau.map((c, i) => (i === colIndex ? [...c, newCard] : c))
  return { wave: { ...wave, tableau }, deckComposition: newComposition }
}

// 天啓が現在の盤面状態で使用可能か判定する(場札拡張の山札枚数不足のみ判定対象)。
export function canUseRevelation(params: ShidasuParams, wave: WaveState, revelationId: RevelationId): boolean {
  switch (revelationId) {
    case 'kyo':
      return wave.stock.length >= wave.tableau.length * params.revelations.kyo.n
    default:
      return true
  }
}

// 列選択(targetCol)が必要な天啓かどうかを返す。
export function revelationNeedsTarget(revelationId: RevelationId): boolean {
  switch (revelationId) {
    case 'kaku':
    case 'kou':
    case 'tei':
    case 'bou':
    case 'gyu':
    case 'jo':
    case 'aya':
      return true
    default:
      return false
  }
}

// 指定した天啓の効果を適用した新しいwave・deckCompositionを返す。所持からの削除・extraTableauRowsの
// 加算はengine.ts側で行う。targetColは列選択が不要な天啓では無視される。
export function applyRevelationEffect(
  params: ShidasuParams,
  wave: WaveState,
  deckComposition: DeckCard[],
  revelationId: RevelationId,
  targetCol: number | null,
  rand: () => number
): { wave: WaveState; deckComposition: DeckCard[] } {
  switch (revelationId) {
    case 'kaku':
      return targetCol === null ? { wave, deckComposition } : convertColumnToSuit(wave, deckComposition, targetCol, '♠')
    case 'kou':
      return targetCol === null ? { wave, deckComposition } : convertColumnToSuit(wave, deckComposition, targetCol, '♥')
    case 'tei':
      return targetCol === null ? { wave, deckComposition } : convertColumnToSuit(wave, deckComposition, targetCol, '♦')
    case 'bou':
      return targetCol === null ? { wave, deckComposition } : convertColumnToSuit(wave, deckComposition, targetCol, '♣')
    case 'shin':
      return convertTableauSuit(wave, deckComposition, '♠', '♥')
    case 'bi':
      return convertTableauSuit(wave, deckComposition, '♥', '♣')
    case 'ki':
      return convertTableauSuit(wave, deckComposition, '♣', '♦')
    case 'to':
      return convertTableauSuit(wave, deckComposition, '♦', '♠')
    case 'gyu':
      return targetCol === null ? { wave, deckComposition } : convertColumnToRandomRank(wave, deckComposition, targetCol, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], rand)
    case 'jo':
      return targetCol === null ? { wave, deckComposition } : convertColumnToRandomRank(wave, deckComposition, targetCol, [11, 12, 13], rand)
    case 'kyo':
      return { wave: expandTableauRows(wave, params.revelations.kyo.n), deckComposition }
    case 'aya':
      return targetCol === null ? { wave, deckComposition } : addWildToColumnTop(wave, deckComposition, targetCol)
  }
}
```

- [ ] **Step 5: テストを実行し成功を確認する**

Run: `npm run test -- revelationEffects`
Expected: PASS

- [ ] **Step 6: 型チェックを実行する**

Run: `npm run check`
Expected: `revelations.ts`・`revelationEffects.ts`・`revelationEffects.test.ts`にエラーが無いこと

- [ ] **Step 7: コミット**

```bash
git add src/lib/game/shidasu/revelations.ts src/lib/game/shidasu/revelationEffects.ts src/lib/game/shidasu/revelationEffects.test.ts
git commit -m "feat: 天啓12種の効果ロジック(revelations.ts・revelationEffects.ts)を追加"
```

---

### Task 3: `engine.ts` — 天啓選択フェーズと状態遷移

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: `startWave`に`extraTableauRows`引数を追加する**

`src/lib/game/shidasu/engine.ts`の`startWave`関数シグネチャ(89-96行目付近):

```ts
export function startWave(
  params: ShidasuParams,
  _stageIndex: number,
  _waveIndex: number,
  items: ItemId[],
  deckComposition: DeckCard[],
  seed?: number
): { wave: WaveState; deckComposition: DeckCard[] } {
```

を以下に置き換える(**末尾に新しい省略可能引数を追加する。既存の呼び出し箇所とテストは無変更のまま動作し続ける**):

```ts
export function startWave(
  params: ShidasuParams,
  _stageIndex: number,
  _waveIndex: number,
  items: ItemId[],
  deckComposition: DeckCard[],
  seed?: number,
  extraTableauRows: number = 0
): { wave: WaveState; deckComposition: DeckCard[] } {
```

同関数内の配布行数計算(113行目付近):

```ts
  const rows = params.layout.rows + (items.includes('darkClouds') ? params.talismans.darkClouds.r : 0)
```

を以下に置き換える:

```ts
  const rows = params.layout.rows + (items.includes('darkClouds') ? params.talismans.darkClouds.r : 0) + extraTableauRows
```

- [ ] **Step 2: `useRite`のフェーズガードを拡張する**

`useRite`関数(857行目付近):

```ts
export function useRite(params: ShidasuParams, run: RunState, riteId: RiteId, rand: () => number = Math.random): RunState {
  if (run.phase !== 'playing' || !run.wave || run.wave.status !== 'playing') return run
```

を以下に置き換える:

```ts
export function useRite(params: ShidasuParams, run: RunState, riteId: RiteId, rand: () => number = Math.random): RunState {
  if ((run.phase !== 'playing' && run.phase !== 'revelationSelect') || !run.wave || run.wave.status !== 'playing') return run
```

- [ ] **Step 3: `createInitialRun`・`beginRun`に新フィールドを追加する**

`createInitialRun`関数(818行目付近):

```ts
export function createInitialRun(): RunState {
  return { phase: 'title', stageIndex: 0, waveIndex: 0, items: [], offer: [], wave: null, pendingNewItem: null, deckComposition: standardDeckComposition(), rites: [] }
}
```

を以下に置き換える:

```ts
export function createInitialRun(): RunState {
  return {
    phase: 'title', stageIndex: 0, waveIndex: 0, items: [], offer: [], wave: null, pendingNewItem: null,
    deckComposition: standardDeckComposition(), rites: [], revelations: [], revelationOffer: [], extraTableauRows: 0,
  }
}
```

`beginRun`関数(822-835行目付近):

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

を以下に置き換える:

```ts
export function beginRun(params: ShidasuParams, seed?: number): RunState {
  const { wave, deckComposition } = startWave(params, 0, 0, [], standardDeckComposition(), seed, 0)
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
    revelations: [],
    revelationOffer: [],
    extraTableauRows: 0,
  }
}
```

- [ ] **Step 4: `pickItem`・`confirmItemSwap`・`skipItemSelect`を、天啓選択画面へ遷移するよう変更する**

`import { rollRite } from './rites'`の直後(engine.ts先頭のimport群、11行目付近)に追加:

```ts
import { rollRevelationOffer } from './revelations'
```

`pickItem`関数の直前(867行目付近)に、新しい非公開ヘルパー関数を追加する:

```ts
// 護符選択解決後、天啓選択画面(プレビュー用ウェーブ)へ遷移する共通処理。
// この時点でのdeckComposition・extraTableauRowsから、通常のウェーブ開始と同じロジックで
// プレビュー用のウェーブを配る(天啓・秘儀のターゲットとして使うためだけの仮のウェーブで、
// 天啓選択画面を終えると改めて実際のウェーブを配り直す。詳細はfinishRevelationSelect)。
function enterRevelationSelect(
  params: ShidasuParams,
  run: RunState,
  newItems: ItemId[],
  newRites: RiteId[],
  newWaveIndex: number,
  seed: number | undefined,
  rand: () => number
): RunState {
  const { wave, deckComposition } = startWave(params, run.stageIndex, newWaveIndex, newItems, run.deckComposition, seed, run.extraTableauRows)
  return {
    ...run,
    phase: 'revelationSelect',
    items: newItems,
    rites: newRites,
    waveIndex: newWaveIndex,
    offer: [],
    pendingNewItem: null,
    wave,
    deckComposition,
    revelationOffer: rollRevelationOffer(rand),
  }
}

// 天啓選択画面を終了し、その時点のdeckComposition・extraTableauRowsから実際のウェーブを
// 新しく配り直してプレイ画面へ進む。
function finishRevelationSelect(params: ShidasuParams, run: RunState, seed?: number): RunState {
  const { wave, deckComposition } = startWave(params, run.stageIndex, run.waveIndex, run.items, run.deckComposition, seed, run.extraTableauRows)
  return {
    ...run,
    phase: 'playing',
    wave,
    deckComposition,
    revelationOffer: [],
  }
}
```

既存の`pickItem`関数(867-888行目付近):

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

を以下に置き換える:

```ts
export function pickItem(params: ShidasuParams, run: RunState, itemId: ItemId, seed?: number, rand: () => number = Math.random): RunState {
  if (run.phase !== 'itemSelect') return run
  if (run.items.length >= params.items.maxItems) {
    return { ...run, pendingNewItem: itemId }
  }
  const newItems = [...run.items, itemId]
  const rolledRite = rollRite(run.rites, rand)
  const newRites = rolledRite ? [...run.rites, rolledRite] : run.rites
  return enterRevelationSelect(params, run, newItems, newRites, run.waveIndex + 1, seed, rand)
}
```

既存の`confirmItemSwap`関数(890-910行目付近):

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

を以下に置き換える:

```ts
export function confirmItemSwap(params: ShidasuParams, run: RunState, oldItemId: ItemId, seed?: number, rand: () => number = Math.random): RunState {
  if (run.phase !== 'itemSelect' || run.pendingNewItem === null) return run
  const idx = run.items.indexOf(oldItemId)
  const remaining = idx === -1 ? [...run.items] : [...run.items.slice(0, idx), ...run.items.slice(idx + 1)]
  const newItems = [...remaining, run.pendingNewItem]
  const rolledRite = rollRite(run.rites, rand)
  const newRites = rolledRite ? [...run.rites, rolledRite] : run.rites
  return enterRevelationSelect(params, run, newItems, newRites, run.waveIndex + 1, seed, rand)
}
```

既存の`skipItemSelect`関数(917-930行目付近):

```ts
export function skipItemSelect(params: ShidasuParams, run: RunState, seed?: number): RunState {
  if (run.phase !== 'itemSelect') return run
  const newWaveIndex = run.waveIndex + 1
  const { wave, deckComposition } = startWave(params, run.stageIndex, newWaveIndex, run.items, run.deckComposition, seed)
  return {
    ...run,
    phase: 'playing',
    waveIndex: newWaveIndex,
    offer: [],
    pendingNewItem: null,
    wave,
    deckComposition,
  }
}
```

を以下に置き換える(**シグネチャ末尾に`rand`引数を追加する**):

```ts
export function skipItemSelect(params: ShidasuParams, run: RunState, seed?: number, rand: () => number = Math.random): RunState {
  if (run.phase !== 'itemSelect') return run
  return enterRevelationSelect(params, run, run.items, run.rites, run.waveIndex + 1, seed, rand)
}
```

- [ ] **Step 5: `advanceStage`に`extraTableauRows`を渡す**

`advanceStage`関数(932-944行目付近):

```ts
export function advanceStage(params: ShidasuParams, run: RunState, seed?: number): RunState {
  if (run.phase !== 'stageClear') return run
  const newStageIndex = run.stageIndex + 1
  const { wave, deckComposition } = startWave(params, newStageIndex, 0, run.items, run.deckComposition, seed)
```

を以下に置き換える:

```ts
export function advanceStage(params: ShidasuParams, run: RunState, seed?: number): RunState {
  if (run.phase !== 'stageClear') return run
  const newStageIndex = run.stageIndex + 1
  const { wave, deckComposition } = startWave(params, newStageIndex, 0, run.items, run.deckComposition, seed, run.extraTableauRows)
```

- [ ] **Step 6: 天啓選択画面用の新規関数を追加する**

`import { applyRiteEffect, canUseRite } from './riteEffects'`の直後(engine.ts先頭のimport群)に追加:

```ts
import { applyRevelationEffect, canUseRevelation } from './revelationEffects'
```

`skipItemSelect`関数の直後(engine.ts、Step 4で変更した箇所のすぐ後)に追加:

```ts
// 所持中の天啓を1つ使用する(消費される)。プレイ中・天啓選択画面のどちらでも動作し、
// フェーズは変えない(秘儀のuseRiteと同じ位置づけ)。
export function useRevelation(
  params: ShidasuParams,
  run: RunState,
  revelationId: RevelationId,
  targetCol: number | null,
  rand: () => number = Math.random
): RunState {
  if ((run.phase !== 'playing' && run.phase !== 'revelationSelect') || !run.wave || run.wave.status !== 'playing') return run
  const idx = run.revelations.indexOf(revelationId)
  if (idx === -1) return run
  if (!canUseRevelation(params, run.wave, revelationId)) return run
  const { wave, deckComposition } = applyRevelationEffect(params, run.wave, run.deckComposition, revelationId, targetCol, rand)
  const extraTableauRows = revelationId === 'kyo' ? run.extraTableauRows + params.revelations.kyo.n : run.extraTableauRows
  const revelations = [...run.revelations.slice(0, idx), ...run.revelations.slice(idx + 1)]
  return { ...run, wave, deckComposition, revelations, extraTableauRows }
}

// 天啓選択画面のオファーから選んだものをその場で使用する(所持には加わらない)。
// 使用後、実際のウェーブを配り直してプレイ画面へ進む。
export function useRevelationFromOffer(
  params: ShidasuParams,
  run: RunState,
  revelationId: RevelationId,
  targetCol: number | null,
  seed?: number,
  rand: () => number = Math.random
): RunState {
  if (run.phase !== 'revelationSelect' || !run.wave) return run
  if (!run.revelationOffer.includes(revelationId)) return run
  if (!canUseRevelation(params, run.wave, revelationId)) return run
  const { wave, deckComposition } = applyRevelationEffect(params, run.wave, run.deckComposition, revelationId, targetCol, rand)
  const extraTableauRows = revelationId === 'kyo' ? run.extraTableauRows + params.revelations.kyo.n : run.extraTableauRows
  return finishRevelationSelect(params, { ...run, deckComposition, extraTableauRows }, seed)
}

// 天啓選択画面のオファーから選んだものを所持へ加える(所持上限2に達している間は何もしない)。
// 実際のウェーブを配り直してプレイ画面へ進む。
export function pickRevelationFromOffer(params: ShidasuParams, run: RunState, revelationId: RevelationId, seed?: number): RunState {
  if (run.phase !== 'revelationSelect') return run
  if (!run.revelationOffer.includes(revelationId)) return run
  if (run.revelations.length >= 2) return run
  const revelations = [...run.revelations, revelationId]
  return finishRevelationSelect(params, { ...run, revelations }, seed)
}

// 天啓を使用・獲得せずに天啓選択画面を終了する。
export function skipRevelationSelect(params: ShidasuParams, run: RunState, seed?: number): RunState {
  if (run.phase !== 'revelationSelect') return run
  return finishRevelationSelect(params, run, seed)
}
```

- [ ] **Step 7: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の末尾に、新しい`describe`ブロックを追加する:

```ts
describe('天啓選択フェーズ', () => {
  test('護符選択(pickItem)を解決すると、revelationSelectフェーズへ遷移しrevelationOfferが3件セットされる', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const itemSelectRun: RunState = { ...run, phase: 'itemSelect', offer: ['bridge', 'grace'] }
    const next = pickItem(DEFAULT_PARAMS, itemSelectRun, 'bridge', 2, createRng(1))
    expect(next.phase).toBe('revelationSelect')
    expect(next.revelationOffer).toHaveLength(3)
    expect(next.items).toContain('bridge')
    expect(next.wave).not.toBeNull()
  })

  test('skipItemSelectを解決してもrevelationSelectフェーズへ遷移する', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const itemSelectRun: RunState = { ...run, phase: 'itemSelect', offer: ['bridge'] }
    const next = skipItemSelect(DEFAULT_PARAMS, itemSelectRun, 2, createRng(1))
    expect(next.phase).toBe('revelationSelect')
    expect(next.revelationOffer).toHaveLength(3)
  })

  test('useRevelationFromOffer: 対象選択不要な天啓(心)を使用すると、実際のウェーブが配られplayingへ遷移する。所持には加わらない', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const revSelectRun: RunState = { ...run, phase: 'revelationSelect', revelationOffer: ['shin', 'kou', 'tei'] }
    const next = useRevelationFromOffer(DEFAULT_PARAMS, revSelectRun, 'shin', null, 3)
    expect(next.phase).toBe('playing')
    expect(next.revelations).toEqual([])
    expect(next.revelationOffer).toEqual([])
  })

  test('useRevelationFromOffer: オファーに含まれない天啓は無視される', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const revSelectRun: RunState = { ...run, phase: 'revelationSelect', revelationOffer: ['shin', 'kou', 'tei'] }
    const next = useRevelationFromOffer(DEFAULT_PARAMS, revSelectRun, 'bi', null, 3)
    expect(next).toBe(revSelectRun)
  })

  test('pickRevelationFromOffer: オファーから獲得すると所持に加わり、revelationSelectを終了してplayingへ遷移する', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const revSelectRun: RunState = { ...run, phase: 'revelationSelect', revelationOffer: ['shin', 'kou', 'tei'] }
    const next = pickRevelationFromOffer(DEFAULT_PARAMS, revSelectRun, 'shin', 3)
    expect(next.phase).toBe('playing')
    expect(next.revelations).toEqual(['shin'])
  })

  test('pickRevelationFromOffer: 所持数が上限2の間は何もしない', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const revSelectRun: RunState = { ...run, phase: 'revelationSelect', revelationOffer: ['shin', 'kou', 'tei'], revelations: ['bi', 'ki'] }
    const next = pickRevelationFromOffer(DEFAULT_PARAMS, revSelectRun, 'shin', 3)
    expect(next).toBe(revSelectRun)
  })

  test('skipRevelationSelect: 何も選ばず終了すると、実際のウェーブが配られplayingへ遷移する', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const revSelectRun: RunState = { ...run, phase: 'revelationSelect', revelationOffer: ['shin', 'kou', 'tei'] }
    const next = skipRevelationSelect(DEFAULT_PARAMS, revSelectRun, 3)
    expect(next.phase).toBe('playing')
  })

  test('useRevelation: 所持中の天啓を使用すると1個消費され、revelationSelect中でもplaying中でもフェーズは変わらない', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const playingRun: RunState = { ...run, revelations: ['shin', 'shin'] }
    const next = useRevelation(DEFAULT_PARAMS, playingRun, 'shin', null)
    expect(next.phase).toBe('playing')
    expect(next.revelations).toEqual(['shin'])

    const revSelectRun: RunState = { ...run, phase: 'revelationSelect', revelations: ['bi'] }
    const next2 = useRevelation(DEFAULT_PARAMS, revSelectRun, 'bi', null)
    expect(next2.phase).toBe('revelationSelect')
    expect(next2.revelations).toEqual([])
  })

  test('useRevelation: 所持していない天啓は無視される', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const next = useRevelation(DEFAULT_PARAMS, run, 'shin', null)
    expect(next).toBe(run)
  })

  test('虚(kyo)を使用すると、extraTableauRowsが恒久的に増え、以後のstartWaveの配布行数に反映される', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    // beginRunで配られた直後のウェーブは山札が十分残っているため、canUseRevelation('kyo')の
    // 「山札が(列数×n)枚以上」という条件を素の状態のまま満たす。
    const playingRun: RunState = { ...run, revelations: ['kyo'] }
    const next = useRevelation(DEFAULT_PARAMS, playingRun, 'kyo', null)
    expect(next.extraTableauRows).toBe(DEFAULT_PARAMS.revelations.kyo.n)
    const { wave } = startWave(DEFAULT_PARAMS, 0, 1, next.items, next.deckComposition, 5, next.extraTableauRows)
    wave.tableau.forEach(col => expect(col).toHaveLength(DEFAULT_PARAMS.layout.rows + next.extraTableauRows))
  })

  test('useRite: revelationSelectフェーズ中でも秘儀を使用できる', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const revSelectRun: RunState = { ...run, phase: 'revelationSelect', rites: ['uruz'] }
    const next = useRite(DEFAULT_PARAMS, revSelectRun, 'uruz', createRng(1))
    expect(next.rites).toEqual([])
    expect(next.phase).toBe('revelationSelect')
  })
})
```

- [ ] **Step 8: テストを実行し失敗を確認する**

Run: `npm run test -- engine`
Expected: FAIL(`useRevelation`等が未定義、`revelationSelect`フェーズが未対応)

- [ ] **Step 9: テストを実行し成功を確認する**

Step 1〜6の実装後、再実行する。

Run: `npm run test -- engine`
Expected: PASS

- [ ] **Step 10: 型チェック・全体テストを実行する**

Run: `npm run check`
Run: `npm run test`
Expected: いずれもエラー無し・全件PASS

- [ ] **Step 11: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 天啓選択フェーズ(revelationSelect)と関連する状態遷移をengine.tsに追加"
```

---

### Task 4: `PlayArea.svelte` — 天啓ボタン列・取得画面向けプロパティ

**Files:**
- Modify: `src/routes/game/shidasu/PlayArea.svelte`

- [ ] **Step 1: import・propsを追加する**

`src/routes/game/shidasu/PlayArea.svelte`のimport群(1-8行目付近):

```ts
  import type { Snippet } from 'svelte'
  import { getPlayableColumns, remainingCount } from '$lib/game/shidasu/engine'
  import type { WaveState, StageModifier, ItemId, RiteId } from '$lib/game/shidasu/types'
  import type { ShidasuParams } from '$lib/game/shidasu/params'
  import { canUseRite } from '$lib/game/shidasu/riteEffects'
  import { riteDesc } from '$lib/game/shidasu/rites'
  import CardFace from './CardFace.svelte'
```

を以下に置き換える:

```ts
  import type { Snippet } from 'svelte'
  import { getPlayableColumns, remainingCount } from '$lib/game/shidasu/engine'
  import type { WaveState, StageModifier, ItemId, RiteId, RevelationId } from '$lib/game/shidasu/types'
  import type { ShidasuParams } from '$lib/game/shidasu/params'
  import { canUseRite } from '$lib/game/shidasu/riteEffects'
  import { riteDesc } from '$lib/game/shidasu/rites'
  import { canUseRevelation } from '$lib/game/shidasu/revelationEffects'
  import { revelationDesc } from '$lib/game/shidasu/revelations'
  import CardFace from './CardFace.svelte'
```

props定義(10-26行目付近):

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

を以下に置き換える:

```ts
  let {
    wave, params, modifier, target, items, onPlayCard, onDraw, dropTarget = null, headerExtra, extraFooter,
    rites = [], onUseRite,
    revelations = [], onUseRevelationClick,
    showScoreAndCombo = true,
    allowDraw = true,
    columnTargetMode = false,
    canTargetColumn = () => true,
    onTargetColumn,
    chainAreaExtra,
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
    revelations?: RevelationId[]
    onUseRevelationClick?: (revelationId: RevelationId) => void
    showScoreAndCombo?: boolean
    allowDraw?: boolean
    columnTargetMode?: boolean
    canTargetColumn?: (colIndex: number) => boolean
    onTargetColumn?: (colIndex: number) => void
    chainAreaExtra?: Snippet
  } = $props()
```

- [ ] **Step 2: SCORE/TARGET・COMBO表示を条件付きにする**

テンプレート内、SCORE/TARGET・COMBOの表示ブロック(53-64行目付近):

```svelte
  <div class="mt-2 flex items-end justify-between">
    <div>
      <div class="text-xs text-emerald-300/70 tracking-widest">SCORE / TARGET</div>
      <div class="text-xl font-black text-amber-50 tabular-nums">
        {wave.score} <span class="text-sm text-emerald-300/70">/ {target}</span>
      </div>
    </div>
    <div class="text-right transition-transform origin-bottom-right {comboScale[displayComboTier]}">
      <div class="text-xs text-emerald-300/70 tracking-widest">COMBO</div>
      <div class="text-3xl font-black italic tabular-nums leading-none {comboColor[displayComboTier]}">
        ×{wave.combo}{#if wave.baseComboCount > 0}<span class="text-lg not-italic ml-1 text-emerald-300/80">+{wave.baseComboCount}</span>{/if}
      </div>
    </div>
  </div>
```

を以下に置き換える(全体を`{#if showScoreAndCombo}`で囲む):

```svelte
  {#if showScoreAndCombo}
    <div class="mt-2 flex items-end justify-between">
      <div>
        <div class="text-xs text-emerald-300/70 tracking-widest">SCORE / TARGET</div>
        <div class="text-xl font-black text-amber-50 tabular-nums">
          {wave.score} <span class="text-sm text-emerald-300/70">/ {target}</span>
        </div>
      </div>
      <div class="text-right transition-transform origin-bottom-right {comboScale[displayComboTier]}">
        <div class="text-xs text-emerald-300/70 tracking-widest">COMBO</div>
        <div class="text-3xl font-black italic tabular-nums leading-none {comboColor[displayComboTier]}">
          ×{wave.combo}{#if wave.baseComboCount > 0}<span class="text-lg not-italic ml-1 text-emerald-300/80">+{wave.baseComboCount}</span>{/if}
        </div>
      </div>
    </div>
  {/if}
```

- [ ] **Step 3: 列クリックの挙動をターゲティングモード対応にする**

場札の列クリック部分(96-107行目付近):

```svelte
            {#if isTop}
              <button
                type="button"
                onclick={() => onPlayCard(ci)}
                class="w-full text-left {playableCols.has(ci) ? 'ring-2 ring-yellow-300 shadow-lg -translate-y-0.5' : ''} transition-transform"
              >
                <CardFace {card} covered={false} />
              </button>
            {:else}
              <CardFace {card} covered={true} />
            {/if}
```

を以下に置き換える:

```svelte
            {#if isTop}
              {@const isTargetable = columnTargetMode && canTargetColumn(ci)}
              <button
                type="button"
                onclick={() => (columnTargetMode ? (isTargetable && onTargetColumn?.(ci)) : onPlayCard(ci))}
                class="w-full text-left {columnTargetMode ? (isTargetable ? 'ring-2 ring-fuchsia-400 shadow-lg -translate-y-0.5' : '') : (playableCols.has(ci) ? 'ring-2 ring-yellow-300 shadow-lg -translate-y-0.5' : '')} transition-transform"
              >
                <CardFace {card} covered={false} />
              </button>
            {:else}
              <CardFace {card} covered={true} />
            {/if}
```

**注意:** `columnTargetMode`が真のとき、ワイルド追加(危)のように空列も対象になり得る天啓のために、空列自体もクリック可能にする必要がある。空列は現状`{#each col as card...}`のループ対象が無いため描画されず、クリック領域も存在しない。この対応はTask 6(+page.svelte側)で、`chainAreaExtra`内の案内文で「空列は列見出し部分をクリック」のような複雑な対応をせず、**今回実装する列選択系天啓のうち空列を対象にできるのは危のみであり、危は取得画面のプレビューウェーブでは通常5行が配られているため実運用上ほぼ空列が発生しない**ことから、空列のクリック対応は本タスクのスコープ外とする(場札の列が偶然全て無くなった場合のみ危が使えない状態になり得るが、これは受け入れる)。

- [ ] **Step 4: チェーン表示エリアを差し替え可能にする**

チェーン表示部分(138-151行目付近):

```svelte
  <div class="overflow-x-auto min-w-0">
    {#each chainRows as row, ri (ri)}
      <div class="relative" style="height:116px; width:{64 + (row.length - 1) * params.ui.chainCardOffsetX}px;">
        {#each row as entry, j (entry.card.id)}
          <div
            class="absolute"
            style="left:{j * params.ui.chainCardOffsetX}px; top:{entry.origin === 'draw' ? 20 : 0}px; z-index:{j + 1}; width:64px;"
          >
            <CardFace card={entry.card} covered={false} />
          </div>
        {/each}
      </div>
    {/each}
  </div>
```

を以下に置き換える:

```svelte
  <div class="overflow-x-auto min-w-0">
    {#if chainAreaExtra}
      {@render chainAreaExtra()}
    {:else}
      {#each chainRows as row, ri (ri)}
        <div class="relative" style="height:116px; width:{64 + (row.length - 1) * params.ui.chainCardOffsetX}px;">
          {#each row as entry, j (entry.card.id)}
            <div
              class="absolute"
              style="left:{j * params.ui.chainCardOffsetX}px; top:{entry.origin === 'draw' ? 20 : 0}px; z-index:{j + 1}; width:64px;"
            >
              <CardFace card={entry.card} covered={false} />
            </div>
          {/each}
        </div>
      {/each}
    {/if}
  </div>
```

- [ ] **Step 5: 山札ボタンを`allowDraw`対応にする**

山札ボタン(119-130行目付近):

```svelte
  <button
    type="button"
    onclick={onDraw}
    disabled={wave.stock.length === 0}
    data-drop-stock
    style="aspect-ratio: 2 / 3; margin-top:20px;"
    class="w-16 shrink-0 rounded-lg border-2 flex flex-col items-center justify-center font-black active:scale-95 transition-transform {dropTarget === 'stockTop' ? 'ring-4 ring-sky-400' : ''} {wave.stock.length > 0 ? 'bg-emerald-700 border-emerald-500 text-amber-50' : 'bg-emerald-900 border-emerald-800 text-emerald-700'}"
  >
```

を以下に置き換える:

```svelte
  <button
    type="button"
    onclick={onDraw}
    disabled={wave.stock.length === 0 || !allowDraw}
    data-drop-stock
    style="aspect-ratio: 2 / 3; margin-top:20px;"
    class="w-16 shrink-0 rounded-lg border-2 flex flex-col items-center justify-center font-black active:scale-95 transition-transform {dropTarget === 'stockTop' ? 'ring-4 ring-sky-400' : ''} {wave.stock.length > 0 ? 'bg-emerald-700 border-emerald-500 text-amber-50' : 'bg-emerald-900 border-emerald-800 text-emerald-700'}"
  >
```

- [ ] **Step 6: 天啓ボタン列を追加する**

既存の秘儀ボタン列(157-171行目付近)の直後に追加:

```svelte
{#if revelations.length > 0}
  <div class="px-4 pb-4 flex items-center gap-2">
    {#each revelations as revelationId, i (i)}
      {@const usable = canUseRevelation(params, wave, revelationId)}
      <button
        type="button"
        onclick={() => onUseRevelationClick?.(revelationId)}
        disabled={!usable}
        title={revelationDesc(revelationId, params)}
        class="w-10 h-10 rounded-lg border-2 flex items-center justify-center text-lg font-black transition-transform active:scale-95 {usable ? 'bg-indigo-900 border-indigo-500 text-indigo-100 hover:bg-indigo-800' : 'bg-slate-800 border-slate-700 text-slate-600 cursor-not-allowed'}"
      >{params.revelations[revelationId].name}</button>
    {/each}
  </div>
{/if}
```

- [ ] **Step 7: 型チェックを実行する**

Run: `npm run check`
Expected: `PlayArea.svelte`にエラーが無いこと

- [ ] **Step 8: コミット**

```bash
git add src/routes/game/shidasu/PlayArea.svelte
git commit -m "feat: PlayAreaに天啓ボタン列・取得画面向けプロパティを追加"
```

---

### Task 5: `+page.svelte` — 天啓選択画面のUI・操作

**Files:**
- Modify: `src/routes/game/shidasu/+page.svelte`

- [ ] **Step 1: importを追加する**

`src/routes/game/shidasu/+page.svelte`のimport群(1-14行目付近):

```ts
  import { onDestroy } from 'svelte'
  import { loadParams } from '$lib/game/shidasu/params'
  import {
    createInitialRun, beginRun, applyPlayCard, applyDrawStock, applyStuckCheck,
    resolveWaveEnd, pickItem, confirmItemSwap, cancelItemSwap, skipItemSelect,
    advanceStage, restartRun, startWave, forceStockTop, useRite,
  } from '$lib/game/shidasu/engine'
  import { itemDesc, itemName } from '$lib/game/shidasu/items'
  import { standardDeckComposition } from '$lib/game/shidasu/deck'
  import type { RunState, ItemId, StageModifier, Suit, Rank, RiteId } from '$lib/game/shidasu/types'
  import DebugPanel from './DebugPanel.svelte'
  import PlayArea from './PlayArea.svelte'
```

を以下に置き換える:

```ts
  import { onDestroy } from 'svelte'
  import { loadParams } from '$lib/game/shidasu/params'
  import {
    createInitialRun, beginRun, applyPlayCard, applyDrawStock, applyStuckCheck,
    resolveWaveEnd, pickItem, confirmItemSwap, cancelItemSwap, skipItemSelect,
    advanceStage, restartRun, startWave, forceStockTop, useRite,
    useRevelation, useRevelationFromOffer, pickRevelationFromOffer, skipRevelationSelect,
  } from '$lib/game/shidasu/engine'
  import { itemDesc, itemName } from '$lib/game/shidasu/items'
  import { revelationDesc, revelationName } from '$lib/game/shidasu/revelations'
  import { revelationNeedsTarget } from '$lib/game/shidasu/revelationEffects'
  import { standardDeckComposition } from '$lib/game/shidasu/deck'
  import type { RunState, ItemId, StageModifier, Suit, Rank, RiteId, RevelationId } from '$lib/game/shidasu/types'
  import DebugPanel from './DebugPanel.svelte'
  import PlayArea from './PlayArea.svelte'
```

- [ ] **Step 2: ターゲティング状態とハンドラを追加する**

`handleForceDraw`関数の直後(script末尾、125-129行目付近)に追加:

```ts
  let pendingRevelationTarget = $state<{ revelationId: RevelationId; source: 'offer' | 'held' } | null>(null)

  function revelationHandlerFor(source: 'offer' | 'held') {
    return (revelationId: RevelationId) => {
      if (revelationNeedsTarget(revelationId)) {
        pendingRevelationTarget = { revelationId, source }
        return
      }
      if (source === 'offer') {
        run = useRevelationFromOffer(params, run, revelationId, null)
        afterAction()
      } else {
        run = useRevelation(params, run, revelationId, null)
        if (run.phase === 'playing') afterAction()
      }
    }
  }

  const handleRevelationOfferUse = revelationHandlerFor('offer')
  const handleUseRevelationClick = revelationHandlerFor('held')

  function handleRevelationOfferAcquire(revelationId: RevelationId) {
    run = pickRevelationFromOffer(params, run, revelationId)
    afterAction()
  }

  function handleSkipRevelationSelect() {
    run = skipRevelationSelect(params, run)
    afterAction()
  }

  function handleCancelRevelationTarget() {
    pendingRevelationTarget = null
  }

  function handleTargetColumn(colIndex: number) {
    if (!pendingRevelationTarget) return
    const { revelationId, source } = pendingRevelationTarget
    pendingRevelationTarget = null
    if (source === 'offer') {
      run = useRevelationFromOffer(params, run, revelationId, colIndex)
      afterAction()
    } else {
      run = useRevelation(params, run, revelationId, colIndex)
      if (run.phase === 'playing') afterAction()
    }
  }

  function canTargetRevelationColumn(colIndex: number): boolean {
    if (!wave || !pendingRevelationTarget) return false
    if (pendingRevelationTarget.revelationId === 'aya') return true
    return wave.tableau[colIndex].length > 0
  }
```

- [ ] **Step 3: 天啓選択画面用のスニペットを追加する**

`{#snippet itemBadges()}...{/snippet}`ブロックの直後(146-155行目付近)に追加:

```svelte
{#snippet revelationSelectExtra()}
  <div class="text-xs w-full">
    {#if pendingRevelationTarget}
      <div class="text-yellow-300 font-black mb-2">列を選んでください</div>
      <button onclick={handleCancelRevelationTarget} class="text-emerald-300/70 underline">キャンセル</button>
    {:else}
      <div class="text-emerald-300/70 mb-2">天啓を1つ選ぶ</div>
      <div class="flex flex-col gap-1.5">
        {#each run.revelationOffer as id (id)}
          <div class="bg-emerald-900/80 border border-yellow-500/40 rounded-lg px-2 py-1.5 text-left">
            <div class="font-black text-yellow-300">{revelationName(id, params)}</div>
            <div class="text-emerald-100/80 text-[11px] mt-0.5">{revelationDesc(id, params)}</div>
            <div class="flex gap-1.5 mt-1.5">
              <button
                onclick={() => handleRevelationOfferUse(id)}
                class="flex-1 bg-indigo-700 text-white rounded px-2 py-1 active:scale-95 transition-transform"
              >使用</button>
              <button
                onclick={() => handleRevelationOfferAcquire(id)}
                disabled={run.revelations.length >= 2}
                class="flex-1 bg-slate-700 text-white rounded px-2 py-1 active:scale-95 transition-transform disabled:opacity-30 disabled:cursor-not-allowed"
              >獲得</button>
            </div>
          </div>
        {/each}
      </div>
      <button onclick={handleSkipRevelationSelect} class="mt-2 text-emerald-300/70 underline">使用・獲得しない</button>
    {/if}
  </div>
{/snippet}
```

- [ ] **Step 4: `PlayArea`の描画を`revelationSelect`フェーズ対応にする**

既存の描画箇所(191-193行目付近):

```svelte
{:else if wave}
  <PlayArea {wave} {params} modifier={stage.modifier} {target} items={run.items} onPlayCard={handlePlayCard} onDraw={handleDraw} headerExtra={stageRow} extraFooter={itemBadges} rites={run.rites} onUseRite={handleUseRite} />
{/if}
```

を以下に置き換える:

```svelte
{:else if wave && run.phase === 'revelationSelect'}
  <PlayArea
    {wave} {params} modifier={stage.modifier} {target} items={run.items}
    onPlayCard={() => {}} onDraw={() => {}}
    showScoreAndCombo={false} allowDraw={false}
    headerExtra={stageRow}
    rites={run.rites} onUseRite={handleUseRite}
    revelations={run.revelations} onUseRevelationClick={handleUseRevelationClick}
    columnTargetMode={pendingRevelationTarget !== null}
    canTargetColumn={canTargetRevelationColumn}
    onTargetColumn={handleTargetColumn}
    chainAreaExtra={revelationSelectExtra}
  />
{:else if wave}
  <PlayArea {wave} {params} modifier={stage.modifier} {target} items={run.items} onPlayCard={handlePlayCard} onDraw={handleDraw} headerExtra={stageRow} extraFooter={itemBadges} rites={run.rites} onUseRite={handleUseRite} revelations={run.revelations} onUseRevelationClick={handleUseRevelationClick} />
{/if}
```

- [ ] **Step 5: 型チェックを実行する**

Run: `npm run check`
Expected: `+page.svelte`にエラーが無いこと

- [ ] **Step 6: コミット**

```bash
git add src/routes/game/shidasu/+page.svelte
git commit -m "feat: 天啓選択画面のUI・操作を+page.svelteに追加"
```

---

### Task 6: 管理画面 `/admin/shidasu-revelations`

**Files:**
- Create: `src/routes/admin/shidasu-revelations/+page.svelte`
- Modify: `src/routes/admin/+page.svelte`

- [ ] **Step 1: 管理画面を新規作成する**

`src/routes/admin/shidasu-revelations/+page.svelte`を新規作成:

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { DEFAULT_PARAMS, type ShidasuParams } from '$lib/game/shidasu/params'
  import { revelationDesc } from '$lib/game/shidasu/revelations'
  import { MANSIONS } from '$lib/game/shidasu/mansions'
  import { REVELATION_POOL } from '$lib/game/shidasu/revelations'
  import type { RevelationId } from '$lib/game/shidasu/types'

  let config = $state<ShidasuParams | null>(null)
  let error = $state<string | null>(null)
  let flash = $state<string | null>(null)
  let flashTimer: ReturnType<typeof setTimeout> | null = null

  function showToast(message: string) {
    if (flashTimer) clearTimeout(flashTimer)
    flash = message
    flashTimer = setTimeout(() => { flash = null }, 2000)
  }

  type RevelationEntry = { name: string; desc: string } & Record<string, number | string>

  function revelationEntry(id: RevelationId): RevelationEntry {
    return config!.revelations[id] as unknown as RevelationEntry
  }

  function revelationParamKeys(id: RevelationId): string[] {
    return Object.keys(revelationEntry(id)).filter(key => key !== 'name' && key !== 'desc')
  }

  let hasValidationError = $derived.by(() => {
    if (!config) return false
    return REVELATION_POOL.some(id => {
      const entry = revelationEntry(id)
      if (!entry.name.trim()) return true
      if (!entry.desc.trim()) return true
      return revelationParamKeys(id).some(key => !Number.isFinite(entry[key] as number))
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
  <title>Shidasu 天啓パラメータ設定</title>
</svelte:head>

<div class="max-w-5xl mx-auto px-4 py-8">
  <a href="/admin" class="text-xs text-slate-400 hover:text-teal-600 mb-4 inline-block">← 管理ページ一覧</a>

  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold text-slate-800">星詠みソリティア -Shidasu- 天啓パラメータ設定</h1>
    <div class="flex gap-2">
      <button onclick={() => loadConfig(true)} class="text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
        リロード
      </button>
      {#if hasValidationError}
        <p class="text-xs text-red-600 self-center">天啓名・説明文テンプレートが空、またはパラメータが未入力の項目があります</p>
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
              <th class="px-2 py-1.5 text-left" style="width:20rem;">説明文テンプレート</th>
              <th class="px-2 py-1.5 text-left" style="width:20rem;">プレビュー</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            {#each REVELATION_POOL as id (id)}
              {@const entry = revelationEntry(id)}
              <tr>
                <td class="px-2 py-1.5 align-top">
                  <select bind:value={entry.name} class="w-full border border-slate-200 rounded px-1.5 py-0.5">
                    {#each MANSIONS as mansion (mansion.kanji)}
                      <option value={mansion.kanji}>{mansion.kanji} {mansion.reading}</option>
                    {/each}
                  </select>
                </td>
                <td class="px-2 py-1.5 align-top">
                  <div class="flex flex-wrap gap-1.5">
                    {#each revelationParamKeys(id) as key (key)}
                      <label class="flex items-center gap-1 text-[11px] text-slate-500">
                        {key}
                        <input type="number" step="any" bind:value={entry[key]} class="w-16 border border-slate-200 rounded px-1 py-0.5" />
                      </label>
                    {/each}
                    {#if revelationParamKeys(id).length === 0}
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
                <td class="px-2 py-1.5 align-top text-slate-500">{revelationDesc(id, config)}</td>
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

- [ ] **Step 2: 管理ページ一覧にリンクを追加する**

`src/routes/admin/+page.svelte`の秘儀パラメータ設定リンクの直後(44-48行目付近、既存の`<a href="/admin/shidasu-rites">...</a>`ブロックの直後)に追加:

```svelte
    <a href="/admin/shidasu-revelations" class="flex items-center gap-3 px-4 py-4 hover:bg-slate-50 transition-colors group">
      <div class="flex-1">
        <p class="text-sm font-semibold text-slate-700 group-hover:text-teal-700">星詠みソリティア -Shidasu- 天啓パラメータ設定</p>
        <p class="text-xs text-slate-400 mt-0.5">天啓ごとの名前(二十八宿)・数値パラメータ・効果説明文プレビューを1行ずつ編集</p>
      </div>
      <span class="text-slate-300 group-hover:text-teal-600 transition-colors">→</span>
    </a>
```

- [ ] **Step 3: 型チェック・ビルドを実行する**

Run: `npm run check`
Run: `npm run build`
Expected: いずれも成功

- [ ] **Step 4: コミット**

```bash
git add src/routes/admin/shidasu-revelations/+page.svelte src/routes/admin/+page.svelte
git commit -m "feat: 天啓パラメータ設定画面(/admin/shidasu-revelations)を追加"
```

---

### Task 7: 最終確認・ブラウザ動作確認

**Files:** (テスト・動作確認のみ、コード変更なし)

- [ ] **Step 1: 全体テスト・型チェック・ビルドを実行する**

Run: `npm run test`
Expected: 全件PASS

Run: `npm run check`
Expected: shidasu関連ファイルにエラー無し

Run: `npm run build`
Expected: 成功

- [ ] **Step 2: `npm run dev`でブラウザ動作確認する**

`npm run dev`で開発サーバーを起動し、`/game/shidasu`を開いて以下を確認する:

1. ゲームを開始し、1ウェーブ目をクリアする(目標スコアに到達するまでプレイする、またはデバッグ用に低い目標スコアで確認してもよい)
2. 護符選択画面(WAVE CLEAR)で1つ選ぶと、天啓選択画面に遷移することを確認する
3. 天啓選択画面で、SCORE/TARGET・COMBOが非表示になっており、場札・山札が表示されていることを確認する
4. オファーされた天啓のうち、列選択が必要なもの(角・亢・氐・房のいずれか)の「使用」を押すと「列を選んでください」表示に変わり、場札の列をクリックすると即座にその列が対象スートに変換されることを確認する
5. 別のウェーブクリアで、列選択が不要な天啓(心・尾・箕・斗のいずれか)の「使用」を押すと即座に場札全体が変換されることを確認する
6. 「獲得」を押すと画面が終了し、次のウェーブが始まった後、通常のプレイ画面に天啓ボタンが表示され、押すと同様に効果が発動することを確認する(列選択が必要なものは同様のターゲティングモードになる)
7. 天啓選択画面で秘儀ボタンを押すと効果が発動し、画面終了後の実際のウェーブには秘儀の効果(コンボ変化等)が引き継がれていないことを確認する
8. コンソールエラーが出ていないことを確認する

- [ ] **Step 3: `/admin/shidasu-revelations`の動作確認**

`/admin/shidasu-revelations`を開き、12件の天啓が表示され、名前の`<select>`が28宿から選べること、説明文編集・プレビューが機能することを確認する。

- [ ] **Step 4: 問題があれば修正し、再度Step 1〜3を実行する**

- [ ] **Step 5: 最終コミット(修正があった場合のみ)**

```bash
git add -A
git commit -m "fix: 天啓機能のブラウザ動作確認で見つかった問題を修正"
```
