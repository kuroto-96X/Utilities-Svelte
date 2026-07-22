# Shidasu ボス制約の複数候補化 Phase2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `docs/superpowers/specs/2026-07-22-shidasu-boss-candidates-design.md`に基づき、ボス階級(小凶/中凶/大凶)ごとの制約を複数候補化し、ボスウェーブ突入のたびにその階級に属する候補からランダムに1つが選ばれるようにする。今回は各階級に1種類ずつ新規候補(小凶=faceLock、中凶=oddCombo、大凶=face)を追加し、既存3種とあわせて計6種にする。

**Architecture:** 各候補(ボス)の挙動(kind)はコードに紐づく固定値だが、どの階級に属するか(tier)は管理画面から変更できるデータにする、フラットなプール(`ShidasuParams.bosses`)として持つ。`RunState`に選ばれた候補の識別子`currentBossKind`を追加し、ステージ繰り上がり時にその階級に属する候補群から`rand`で1つ抽選する。

**Tech Stack:** TypeScript, Svelte 5, Vitest

---

### Task 1: 型定義・パラメータ構造の変更

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`
- Modify: `src/lib/game/shidasu/params.ts`
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Modify: `src/lib/game/shidasu/engine.test.ts`(型追従のみ)

- [ ] **Step 1: `types.ts`に`BossKind`・`BossTierKey`型を追加する**

`src/lib/game/shidasu/types.ts`の7行目、現在の内容:

```ts
export type SpreadId = 'fool' | 'moon'
```

の直後に以下を追加する:

```ts
export type SpreadId = 'fool' | 'moon'
// ボスウェーブの制約候補。挙動(kind)そのものはコードに紐づく固定値で、
// どの階級(小凶/中凶/大凶)に属するかはparams.bosses[kind].tierとして管理画面から変更できる。
// noLoop/faceLock=小凶向け(isPlayableの可否制約)、lowCombo/oddCombo=中凶向け、suit/face=大凶向け(得点ロック)
// という想定だが、実際にどの階級で抽選されるかはtierの値のみが決める。
export type BossKind = 'noLoop' | 'faceLock' | 'lowCombo' | 'oddCombo' | 'suit' | 'face'
export type BossTierKey = 'shoukyou' | 'chuukyou' | 'taikyou'
```

- [ ] **Step 2: `RunState`に`currentBossKind`フィールドを追加する**

`RunState`インターフェースの末尾(`spreadId: SpreadId`の直後)に追加する。現在の内容:

```ts
  // ラン開始時に選ばれたスプレッド。ラン全体を通して不変(タイトル画面に戻って選び直すまで固定)
  spreadId: SpreadId
}
```

を以下に置き換える:

```ts
  // ラン開始時に選ばれたスプレッド。ラン全体を通して不変(タイトル画面に戻って選び直すまで固定)
  spreadId: SpreadId
  // 現在のステージのボスウェーブで適用される候補。ステージ突入時(そのステージのウェーブ0を
  // 配る時点)にそのステージの階級(bossTierOf(stageIndex))に属する候補群からrandで1つ抽選し、
  // そのステージの3ウェーブ間(表示・実際の判定とも)固定で使い回す。titleフェーズではnull
  currentBossKind: BossKind | null
}
```

- [ ] **Step 3: `params.ts`の`bossTiers`から`chuukyou.maxCombo`を削除し、新規`bosses`セクションを追加する**

`ShidasuParams`インターフェースの`bossTiers`ブロック、現在の内容:

```ts
  // ボス階級ごとの設定。stageIndex % 3 (0=小凶,1=中凶,2=大凶)でインデックスする代わりに、
  // 読みやすさのため名前付きキーで持つ(shoukyou=小凶,chuukyou=中凶,taikyou=大凶)
  bossTiers: {
    shoukyou: { name: string }
    chuukyou: { name: string; maxCombo: number }
    taikyou: { name: string }
  }
```

を以下に置き換える(`chuukyou.maxCombo`を削除し、直後に新規`bosses`セクションを追加する):

```ts
  // ボス階級ごとの設定。stageIndex % 3 (0=小凶,1=中凶,2=大凶)でインデックスする代わりに、
  // 読みやすさのため名前付きキーで持つ(shoukyou=小凶,chuukyou=中凶,taikyou=大凶)
  bossTiers: {
    shoukyou: { name: string }
    chuukyou: { name: string }
    taikyou: { name: string }
  }
  // ボス制約の候補プール。どの階級(tier)に属するかは管理画面から変更できる。
  // 挙動そのもの(kindごとの実際のロジック)はengine.tsに固定で紐づく。
  bosses: {
    noLoop: { name: string; tier: BossTierKey; desc: string }
    faceLock: { name: string; tier: BossTierKey; desc: string }
    lowCombo: { name: string; tier: BossTierKey; desc: string; maxCombo: number }
    oddCombo: { name: string; tier: BossTierKey; desc: string }
    suit: { name: string; tier: BossTierKey; desc: string }
    face: { name: string; tier: BossTierKey; desc: string }
  }
```

`params.ts`先頭のimport文、現在`import type { Rarity } from './types'`となっている行に`BossTierKey`を追加する:

```ts
import type { Rarity, BossTierKey } from './types'
```

- [ ] **Step 4: `DEFAULT_PARAMS`から`chuukyou.maxCombo`を削除し、`bosses`のデータを追加する**

`DEFAULT_PARAMS.bossTiers`ブロック、現在の内容:

```ts
  bossTiers: {
    shoukyou: { name: '小凶' },
    chuukyou: { name: '中凶', maxCombo: 2 },
    taikyou: { name: '大凶' },
  },
```

を以下に置き換える:

```ts
  bossTiers: {
    shoukyou: { name: '小凶' },
    chuukyou: { name: '中凶' },
    taikyou: { name: '大凶' },
  },
  bosses: {
    noLoop: { name: '頑迷', tier: 'shoukyou', desc: 'A⇔Kループ禁止' },
    faceLock: { name: '偽善', tier: 'shoukyou', desc: '絵札はコンボ2以上でのみ取れる' },
    lowCombo: { name: '憤慨', tier: 'chuukyou', desc: '{maxCombo}コンボ以下で無得点', maxCombo: 2 },
    oddCombo: { name: '口論', tier: 'chuukyou', desc: 'コンボが奇数のとき無得点' },
    suit: { name: '裏切り', tier: 'taikyou', desc: '特定のスートで無得点' },
    face: { name: '詐欺', tier: 'taikyou', desc: '絵札(J・Q・K)で無得点' },
  },
```

- [ ] **Step 5: `shidasu.config.json`を`params.ts`と同期する**

`src/lib/game/shidasu/shidasu.config.json`の`"bossTiers"`セクション、現在の内容:

```json
  "bossTiers": {
    "shoukyou": { "name": "小凶" },
    "chuukyou": { "name": "中凶", "maxCombo": 2 },
    "taikyou": { "name": "大凶" }
  },
```

を以下に置き換える:

```json
  "bossTiers": {
    "shoukyou": { "name": "小凶" },
    "chuukyou": { "name": "中凶" },
    "taikyou": { "name": "大凶" }
  },
  "bosses": {
    "noLoop": { "name": "頑迷", "tier": "shoukyou", "desc": "A⇔Kループ禁止" },
    "faceLock": { "name": "偽善", "tier": "shoukyou", "desc": "絵札はコンボ2以上でのみ取れる" },
    "lowCombo": { "name": "憤慨", "tier": "chuukyou", "desc": "{maxCombo}コンボ以下で無得点", "maxCombo": 2 },
    "oddCombo": { "name": "口論", "tier": "chuukyou", "desc": "コンボが奇数のとき無得点" },
    "suit": { "name": "裏切り", "tier": "taikyou", "desc": "特定のスートで無得点" },
    "face": { "name": "詐欺", "tier": "taikyou", "desc": "絵札(J・Q・K)で無得点" }
  },
```

- [ ] **Step 6: 既存の`RunState`リテラル(6箇所)に`currentBossKind`を追加する**

`src/lib/game/shidasu/engine.test.ts`内、`describe('applyStuckCheck (不屈の護符)', ...)`ブロック内の以下の完全な文字列(6箇所、全て同一):

```ts
      oracleLevels: defaultOracleLevels(), oracleOffer: [], currentGreatMisfortuneSuit: null, spreadId: 'fool',
```

を`replace_all`で以下に一括置換する:

```ts
      oracleLevels: defaultOracleLevels(), oracleOffer: [], currentGreatMisfortuneSuit: null, spreadId: 'fool', currentBossKind: 'noLoop',
```

- [ ] **Step 7: 型チェックを実行し、想定内のエラーのみであることを確認する**

Run: `npm run check`

Expected: 以下のエラーは想定内であり許容する(このタスクでは`engine.ts`・UI・admin画面は一切変更しないため、Task 2〜5で解消する):
- `engine.ts`内で`params.bossTiers.chuukyou.maxCombo`を参照している`bossScoreLockFor`関数のエラー
- `engine.ts`の`createInitialRun`・`beginRun`・`enterRevelationSelect`が返す`RunState`リテラルに`currentBossKind`が無いことによるエラー
- `src/routes/admin/shidasu/BossTiersSection.svelte`(`config.bossTiers.chuukyou.maxCombo`参照)のエラー
- `src/routes/game/shidasu/+page.svelte`(`params.bossTiers.chuukyou.maxCombo`参照)のエラー

それ以外(`types.ts`・`params.ts`・`shidasu.config.json`・`engine.test.ts`の6箇所修正関連)にエラーが無いことを確認する。

- [ ] **Step 8: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/engine.test.ts
git commit -m "feat: ボス制約の複数候補化のための型定義とパラメータを追加"
```

---

### Task 2: engine.tsのロジック変更(候補抽選・得点ロック拡張)

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: `BossScoreLock`型に`oddCombo`・`face`を追加し、得点ロック判定を共通ヘルパーに切り出す(失敗するテストを先に書く)**

`src/lib/game/shidasu/engine.test.ts`の`describe('playCard: BossScoreLock(ボス制約による得点0)', ...)`ブロック(既存、`アルギズ`テストの近くではなく`scoreLockを省略`テストの直後付近にある)の末尾に、以下の2テストを追加する:

```ts
  test('scoreLockがkind:oddComboで、effectiveComboが奇数なら獲得点が0になる', () => {
    const oddWave = baseWave({
      foundation: card(0, '♠', 5),
      tableau: [[card(1, '♣', 6)]],
      combo: 0, // このプレイでnewCombo=1、baseComboCount=0によりeffectiveCombo=1(奇数)
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, oddWave, 'none', [], 1000000, 0, standardDeckComposition(), Math.random, { kind: 'oddCombo' })
    expect(next.score).toBe(oddWave.score)
    expect(next.lastGain?.points).toBe(0)
  })

  test('scoreLockがkind:oddComboで、effectiveComboが偶数なら通常通り得点する', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      tableau: [[card(1, '♣', 6)]],
      combo: 1, // このプレイでnewCombo=2、effectiveCombo=2(偶数)
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition(), Math.random, { kind: 'oddCombo' })
    expect(next.lastGain?.points).toBeGreaterThan(0)
  })

  test('scoreLockがkind:faceで、絵札(非ワイルド)を取ると獲得点が0になる', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 12), // Q
      tableau: [[card(1, '♠', 13)]], // K、ランク差1で取れる、かつ絵札
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition(), Math.random, { kind: 'face' })
    expect(next.score).toBe(wave.score)
    expect(next.lastGain?.points).toBe(0)
  })

  test('scoreLockがkind:faceで、絵札以外を取ると通常通り得点する', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      tableau: [[card(1, '♣', 6)]], // 絵札ではない
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition(), Math.random, { kind: 'face' })
    expect(next.lastGain?.points).toBeGreaterThan(0)
  })

  test('scoreLockがkind:faceで、ワイルドを取ると絵札扱いされず通常通り得点する', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      tableau: [[card(1, '★', 0, true)]],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition(), Math.random, { kind: 'face' })
    expect(next.lastGain?.points).toBeGreaterThan(0)
  })
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "BossScoreLock"`
Expected: FAIL(`BossScoreLock`型が`oddCombo`/`face`を受け付けない型エラー、またはロジック未実装のため)

- [ ] **Step 3: `BossScoreLock`型を拡張し、共通ヘルパー関数を追加する**

`src/lib/game/shidasu/engine.ts`の`BossScoreLock`型定義、現在の内容:

```ts
export type BossScoreLock = { kind: 'combo'; maxCombo: number } | { kind: 'suit'; suit: Suit } | null
```

を以下に置き換える:

```ts
export type BossScoreLock =
  | { kind: 'combo'; maxCombo: number }
  | { kind: 'suit'; suit: Suit }
  | { kind: 'oddCombo' }
  | { kind: 'face' }
  | null

// scoreLockの種別ごとの無得点化条件を判定する共通ヘルパー。playCard/drawStockの両方から使う。
function isBossScoreLocked(scoreLock: NonNullable<BossScoreLock>, effectiveCombo: number, card: Card): boolean {
  switch (scoreLock.kind) {
    case 'combo': return effectiveCombo <= scoreLock.maxCombo
    case 'suit': return !card.wild && card.suit === scoreLock.suit
    case 'oddCombo': return effectiveCombo % 2 === 1
    case 'face': return !card.wild && isFace(card)
  }
}

// 無得点になった際にlastGain.partsへ積むメッセージ。小凶由来はStageModifierで別途扱うため、
// ここではscoreLock(中凶・大凶)由来の2種のみ対象。
function bossScoreLockMessage(scoreLock: NonNullable<BossScoreLock>): string {
  return scoreLock.kind === 'combo' || scoreLock.kind === 'oddCombo' ? '中凶: 獲得点0' : '大凶: 獲得点0'
}
```

`playCard`関数内、現在の内容:

```ts
  if (scoreLock) {
    const locked = scoreLock.kind === 'combo' ? effectiveCombo <= scoreLock.maxCombo : (!card.wild && card.suit === scoreLock.suit)
    if (locked) {
      parts.push(scoreLock.kind === 'combo' ? '中凶: 獲得点0' : '大凶: 獲得点0')
      gained = 0
    }
  }
```

を以下に置き換える:

```ts
  if (scoreLock && isBossScoreLocked(scoreLock, effectiveCombo, card)) {
    parts.push(bossScoreLockMessage(scoreLock))
    gained = 0
  }
```

`drawStock`関数内、現在の内容:

```ts
      if (scoreLock) {
        const locked = scoreLock.kind === 'combo' ? effectiveCombo <= scoreLock.maxCombo : (!drawnCard.wild && drawnCard.suit === scoreLock.suit)
        if (locked) {
          parts.push(scoreLock.kind === 'combo' ? '中凶: 獲得点0' : '大凶: 獲得点0')
          naiveGained = 0
        }
      }
```

を以下に置き換える:

```ts
      if (scoreLock && isBossScoreLocked(scoreLock, effectiveCombo, drawnCard)) {
        parts.push(bossScoreLockMessage(scoreLock))
        naiveGained = 0
      }
```

- [ ] **Step 4: テストを実行し成功を確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "BossScoreLock"`
Expected: PASS(既存6件+新規5件)

- [ ] **Step 5: 候補抽選ロジックのテストを先に書く**

`src/lib/game/shidasu/engine.test.ts`の`./engine`からのimport文、現在の内容:

```ts
import {
  rankLabel,
  isPlayable,
  getPlayableColumns,
  getPlayableRowsInColumn,
  remainingCount,
  startWave,
  playCard,
  drawStock,
  isStuck,
  markStuck,
  createInitialRun,
  beginRun,
  resolveWaveEnd,
  pickItem,
  confirmItemSwap,
  cancelItemSwap,
  skipItemSelect,
  continueAfterGreatMisfortune,
  stopAfterGreatMisfortune,
  waveTarget,
  restartRun,
  applyPlayCard,
  applyDrawStock,
  applyStuckCheck,
  forceStockTop,
  useRite,
  useRevelation,
  useRevelationFromOffer,
  pickRevelationFromOffer,
  skipRevelationSelect,
  pickOracleFromOffer,
  skipOracleSelect,
} from './engine'
```

の`waveTarget,`の行を以下に置き換える(`stageModifierFor`・`bossScoreLockFor`を追加する):

```ts
  waveTarget,
  stageModifierFor,
  bossScoreLockFor,
```

`engine.test.ts`の現在の内容:

```ts
import { DEFAULT_PARAMS } from './params'
```

を以下に置き換える(`ShidasuParams`型を追加する。後続のテストで`const customParams: ShidasuParams = {...}`という型注釈を使うため):

```ts
import { DEFAULT_PARAMS, type ShidasuParams } from './params'
```

`describe('createInitialRun / beginRun', ...)`ブロックの末尾(既存の5テストの後)に以下を追加する:

```ts
  test('beginRunのcurrentBossKindは、ステージ0(小凶)に属する候補からランダムに選ばれる', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    expect(['noLoop', 'faceLock']).toContain(run.currentBossKind)
  })
```

`describe('pickItem / continueAfterGreatMisfortune / restartRun', ...)`ブロック内、既存の`'小凶(stageIndex0)の3ウェーブ目クリア後、pickItemでstageIndex1・waveIndex0へ繰り上がる'`テストの直後に以下を追加する:

```ts
  test('小凶(stageIndex0)クリア後、次のcurrentBossKindは中凶に属する候補(lowCombo/oddCombo)からランダムに選ばれる', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'itemSelect', stageIndex: 0, waveIndex: 2, offer: ['bridge'] }
    const next = pickItem(DEFAULT_PARAMS, run, 'bridge', 2, createRng(3))
    expect(['lowCombo', 'oddCombo']).toContain(next.currentBossKind)
  })

  test('中凶(stageIndex1)クリア後、次のcurrentBossKindは大凶に属する候補(suit/face)からランダムに選ばれ、suitの場合のみcurrentGreatMisfortuneSuitが確定する', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'itemSelect', stageIndex: 1, waveIndex: 2, offer: ['bridge'] }
    const next = pickItem(DEFAULT_PARAMS, run, 'bridge', 2, createRng(3))
    expect(['suit', 'face']).toContain(next.currentBossKind)
    if (next.currentBossKind === 'suit') {
      expect(next.currentGreatMisfortuneSuit).not.toBeNull()
    } else {
      expect(next.currentGreatMisfortuneSuit).toBeNull()
    }
  })

  test('同じステージ内(waveIndexが進むだけ)ではcurrentBossKindが維持される', () => {
    const started = beginRun(DEFAULT_PARAMS, 1)
    const run: RunState = { ...started, phase: 'itemSelect', waveIndex: 0, offer: ['bridge'] }
    const next = pickItem(DEFAULT_PARAMS, run, 'bridge', 2)
    expect(next.currentBossKind).toBe(started.currentBossKind)
  })

  test('候補プールが1件のみの階級では、必ずその1件が選ばれる(フィルタが正しく機能する)', () => {
    const customParams: ShidasuParams = {
      ...DEFAULT_PARAMS,
      bosses: {
        ...DEFAULT_PARAMS.bosses,
        oddCombo: { ...DEFAULT_PARAMS.bosses.oddCombo, tier: 'shoukyou' }, // 中凶からoddComboを一時的に除外
      },
    }
    const run: RunState = { ...beginRun(customParams, 1), phase: 'itemSelect', stageIndex: 0, waveIndex: 2, offer: ['bridge'] }
    const next = pickItem(customParams, run, 'bridge', 2, createRng(3))
    expect(next.currentBossKind).toBe('lowCombo') // 中凶の候補がlowComboのみになったため必ずこれが選ばれる
  })
```

新規の`describe('stageModifierFor / bossScoreLockFor', ...)`ブロックを`describe('pickItem / continueAfterGreatMisfortune / restartRun', ...)`ブロックの直前に追加し、直接的な単体テストを書く:

```ts
describe('stageModifierFor / bossScoreLockFor', () => {
  function runWith(overrides: Partial<RunState>): RunState {
    return { ...beginRun(DEFAULT_PARAMS, 1), waveIndex: 2, ...overrides }
  }

  test('currentBossKindがnoLoopのボスウェーブではnoLoopが返る', () => {
    const run = runWith({ currentBossKind: 'noLoop' })
    expect(stageModifierFor(DEFAULT_PARAMS, run)).toBe('noLoop')
  })

  test('currentBossKindがfaceLockのボスウェーブではfaceLockが返る', () => {
    const run = runWith({ currentBossKind: 'faceLock' })
    expect(stageModifierFor(DEFAULT_PARAMS, run)).toBe('faceLock')
  })

  test('ボスウェーブでなければcurrentBossKindに関わらずnoneが返る', () => {
    const run = runWith({ currentBossKind: 'noLoop', waveIndex: 0 })
    expect(stageModifierFor(DEFAULT_PARAMS, run)).toBe('none')
  })

  test('currentBossKindがlowComboならkind:comboのscoreLockが返る', () => {
    const run = runWith({ currentBossKind: 'lowCombo' })
    expect(bossScoreLockFor(DEFAULT_PARAMS, run)).toEqual({ kind: 'combo', maxCombo: DEFAULT_PARAMS.bosses.lowCombo.maxCombo })
  })

  test('currentBossKindがoddComboならkind:oddComboのscoreLockが返る', () => {
    const run = runWith({ currentBossKind: 'oddCombo' })
    expect(bossScoreLockFor(DEFAULT_PARAMS, run)).toEqual({ kind: 'oddCombo' })
  })

  test('currentBossKindがsuitかつcurrentGreatMisfortuneSuitが確定していればkind:suitのscoreLockが返る', () => {
    const run = runWith({ currentBossKind: 'suit', currentGreatMisfortuneSuit: '♠' })
    expect(bossScoreLockFor(DEFAULT_PARAMS, run)).toEqual({ kind: 'suit', suit: '♠' })
  })

  test('currentBossKindがfaceならkind:faceのscoreLockが返る', () => {
    const run = runWith({ currentBossKind: 'face' })
    expect(bossScoreLockFor(DEFAULT_PARAMS, run)).toEqual({ kind: 'face' })
  })
})
```

- [ ] **Step 6: テストを実行し失敗を確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "stageModifierFor"`
Expected: FAIL(`stageModifierFor`/`bossScoreLockFor`がまだ`currentBossKind`ベースになっていないため)

- [ ] **Step 7: `stageModifierFor`・`bossScoreLockFor`を`currentBossKind`ベースに書き換える**

現在の内容:

```ts
// そのウェーブで適用されるisPlayable用の修飾子を返す(小凶ボスウェーブ=noLoop、それ以外=none)。
// 中凶・大凶の制約はisPlayableの可否には影響しないため、ここでは扱わない(bossScoreLockForを使う)。
export function stageModifierFor(params: ShidasuParams, run: RunState): StageModifier {
  if (isBossWave(params, run.waveIndex) && bossTierOf(run.stageIndex) === 0) return 'noLoop'
  return 'none'
}

// そのウェーブで適用される得点ロックを返す(中凶=nコンボ以下無得点、大凶=対象スート無得点)。
// 大凶で対象スートが未確定(currentGreatMisfortuneSuitがnull)の場合はロック無しとして扱う
// (実際には大凶ステージ突入時に必ず確定させるため、通常はnullにならない)。
export function bossScoreLockFor(params: ShidasuParams, run: RunState): BossScoreLock {
  if (!isBossWave(params, run.waveIndex)) return null
  const tier = bossTierOf(run.stageIndex)
  if (tier === 1) return { kind: 'combo', maxCombo: params.bossTiers.chuukyou.maxCombo }
  if (tier === 2 && run.currentGreatMisfortuneSuit) return { kind: 'suit', suit: run.currentGreatMisfortuneSuit }
  return null
}
```

を以下に置き換える(挙動は`run.currentBossKind`の値そのものが決め、現在どの階級に割り当てられているかには依存しない):

```ts
// そのウェーブで適用されるisPlayable用の修飾子を返す(currentBossKindがnoLoop/faceLockの
// ボスウェーブでのみ有効。中凶・大凶相当のkindはisPlayableの可否には影響しないため、
// ここでは扱わない=bossScoreLockForを使う)。
export function stageModifierFor(params: ShidasuParams, run: RunState): StageModifier {
  if (!isBossWave(params, run.waveIndex)) return 'none'
  if (run.currentBossKind === 'noLoop') return 'noLoop'
  if (run.currentBossKind === 'faceLock') return 'faceLock'
  return 'none'
}

// そのウェーブで適用される得点ロックを返す。currentBossKindの値そのものが挙動を決める。
// suitで対象スートが未確定(currentGreatMisfortuneSuitがnull)の場合はロック無しとして扱う
// (実際にはsuitが選ばれた瞬間に必ず確定させるため、通常はnullにならない)。
export function bossScoreLockFor(params: ShidasuParams, run: RunState): BossScoreLock {
  if (!isBossWave(params, run.waveIndex)) return null
  switch (run.currentBossKind) {
    case 'lowCombo': return { kind: 'combo', maxCombo: params.bosses.lowCombo.maxCombo }
    case 'oddCombo': return { kind: 'oddCombo' }
    case 'suit': return run.currentGreatMisfortuneSuit ? { kind: 'suit', suit: run.currentGreatMisfortuneSuit } : null
    case 'face': return { kind: 'face' }
    default: return null
  }
}
```

- [ ] **Step 8: 候補抽選ロジック(`rollBossKindForStage`・`nextBossKind`)を追加し、`nextGreatMisfortuneSuit`を書き換える**

現在の内容:

```ts
const GREAT_MISFORTUNE_SUITS: Suit[] = ['♠', '♥', '♦', '♣']

// 大凶ステージの対象スートを、既存のrand(シード連動PRNG)を使って抽選する。
// 将来「ラン開始時にシードを指定してステージ構成を再現する」機能に対応できるよう、
// Math.random()を直接使わずこの関数経由で必ずrandを通すこと。
function rollGreatMisfortuneSuit(rand: () => number): Suit {
  return GREAT_MISFORTUNE_SUITS[Math.floor(rand() * GREAT_MISFORTUNE_SUITS.length)]
}

// 現在のstageIndexから次のウェーブの(stageIndex, waveIndex)を算出する。
// waveIndexがwavesPerStageに達したら次のステージ(stageIndex+1・waveIndex0)へ繰り上がる。
function nextWaveLocation(params: ShidasuParams, run: RunState): { stageIndex: number; waveIndex: number } {
  const nextWaveIndex = run.waveIndex + 1
  if (nextWaveIndex >= params.flow.wavesPerStage) {
    return { stageIndex: run.stageIndex + 1, waveIndex: 0 }
  }
  return { stageIndex: run.stageIndex, waveIndex: nextWaveIndex }
}

// 次のウェーブ位置に応じたcurrentGreatMisfortuneSuitを算出する。同じステージ内に留まる場合は
// 現在の値を維持し、新しいステージに入る場合は小凶・中凶ならnullに、大凶ならrandで新規抽選する。
function nextGreatMisfortuneSuit(
  run: RunState,
  newLocation: { stageIndex: number; waveIndex: number },
  rand: () => number
): Suit | null {
  if (newLocation.stageIndex === run.stageIndex) return run.currentGreatMisfortuneSuit
  return bossTierOf(newLocation.stageIndex) === 2 ? rollGreatMisfortuneSuit(rand) : null
}
```

を以下に置き換える:

```ts
const GREAT_MISFORTUNE_SUITS: Suit[] = ['♠', '♥', '♦', '♣']
const BOSS_TIER_KEYS: BossTierKey[] = ['shoukyou', 'chuukyou', 'taikyou']
const BOSS_KINDS: BossKind[] = ['noLoop', 'faceLock', 'lowCombo', 'oddCombo', 'suit', 'face']

// 大凶ステージの対象スートを、既存のrand(シード連動PRNG)を使って抽選する。
// 将来「ラン開始時にシードを指定してステージ構成を再現する」機能に対応できるよう、
// Math.random()を直接使わずこの関数経由で必ずrandを通すこと。
function rollGreatMisfortuneSuit(rand: () => number): Suit {
  return GREAT_MISFORTUNE_SUITS[Math.floor(rand() * GREAT_MISFORTUNE_SUITS.length)]
}

// stageIndexが属する階級(bossTierOf)に現在割り当てられている候補群の中から、randで1つ抽選する。
// 候補が1件も無い階級は管理画面のバリデーションで基本的に発生しないが、念のためnullを返す。
function rollBossKindForStage(params: ShidasuParams, stageIndex: number, rand: () => number): BossKind | null {
  const tierKey = BOSS_TIER_KEYS[bossTierOf(stageIndex)]
  const candidates = BOSS_KINDS.filter(kind => params.bosses[kind].tier === tierKey)
  if (candidates.length === 0) return null
  return candidates[Math.floor(rand() * candidates.length)]
}

// 現在のstageIndexから次のウェーブの(stageIndex, waveIndex)を算出する。
// waveIndexがwavesPerStageに達したら次のステージ(stageIndex+1・waveIndex0)へ繰り上がる。
function nextWaveLocation(params: ShidasuParams, run: RunState): { stageIndex: number; waveIndex: number } {
  const nextWaveIndex = run.waveIndex + 1
  if (nextWaveIndex >= params.flow.wavesPerStage) {
    return { stageIndex: run.stageIndex + 1, waveIndex: 0 }
  }
  return { stageIndex: run.stageIndex, waveIndex: nextWaveIndex }
}

// 次のウェーブ位置に応じたcurrentBossKindを算出する。同じステージ内に留まる場合は現在の値を
// 維持し、新しいステージに入る場合はそのステージの階級に属する候補群からrandで新規抽選する。
function nextBossKind(
  params: ShidasuParams,
  run: RunState,
  newLocation: { stageIndex: number; waveIndex: number },
  rand: () => number
): BossKind | null {
  if (newLocation.stageIndex === run.stageIndex) return run.currentBossKind
  return rollBossKindForStage(params, newLocation.stageIndex, rand)
}

// 次のウェーブ位置・次のcurrentBossKindに応じたcurrentGreatMisfortuneSuitを算出する。
// 同じステージ内に留まる場合は現在の値を維持し、新しいステージに入る場合はnewBossKindが
// 'suit'のときのみrandで新規抽選し、それ以外はnullにする。
function nextGreatMisfortuneSuit(
  run: RunState,
  newLocation: { stageIndex: number; waveIndex: number },
  newBossKind: BossKind | null,
  rand: () => number
): Suit | null {
  if (newLocation.stageIndex === run.stageIndex) return run.currentGreatMisfortuneSuit
  return newBossKind === 'suit' ? rollGreatMisfortuneSuit(rand) : null
}
```

- [ ] **Step 9: `createInitialRun`・`beginRun`・`enterRevelationSelect`を`currentBossKind`に対応させる**

現在の内容:

```ts
export function createInitialRun(): RunState {
  return {
    phase: 'title', stageIndex: 0, waveIndex: 0, items: [], offer: [], wave: null, pendingNewItem: null,
    deckComposition: standardDeckComposition(), rites: [], revelations: [], revelationOffer: [], extraTableauRows: 0,
    oracleLevels: defaultOracleLevels(), oracleOffer: [], currentGreatMisfortuneSuit: null, spreadId: 'fool',
  }
}

export function beginRun(params: ShidasuParams, seed?: number, spreadId: SpreadId = 'fool'): RunState {
  const initialExtraTableauRows = params.spreads[spreadId].initialExtraTableauRows
  const { wave, deckComposition } = startWave(params, 0, 0, [], standardDeckComposition(), seed, initialExtraTableauRows, defaultOracleLevels())
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
    extraTableauRows: initialExtraTableauRows,
    oracleLevels: defaultOracleLevels(),
    oracleOffer: [],
    currentGreatMisfortuneSuit: null,
    spreadId,
  }
}
```

を以下に置き換える:

```ts
export function createInitialRun(): RunState {
  return {
    phase: 'title', stageIndex: 0, waveIndex: 0, items: [], offer: [], wave: null, pendingNewItem: null,
    deckComposition: standardDeckComposition(), rites: [], revelations: [], revelationOffer: [], extraTableauRows: 0,
    oracleLevels: defaultOracleLevels(), oracleOffer: [], currentGreatMisfortuneSuit: null, spreadId: 'fool',
    currentBossKind: null,
  }
}

export function beginRun(params: ShidasuParams, seed?: number, spreadId: SpreadId = 'fool'): RunState {
  const initialExtraTableauRows = params.spreads[spreadId].initialExtraTableauRows
  const rand = createRng(seed ?? Math.floor(Math.random() * 999999) + 1)
  const initialBossKind = rollBossKindForStage(params, 0, rand)
  const { wave, deckComposition } = startWave(params, 0, 0, [], standardDeckComposition(), seed, initialExtraTableauRows, defaultOracleLevels())
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
    extraTableauRows: initialExtraTableauRows,
    oracleLevels: defaultOracleLevels(),
    oracleOffer: [],
    currentGreatMisfortuneSuit: null,
    spreadId,
    currentBossKind: initialBossKind,
  }
}
```

**注意:** `beginRun`が独自に`createRng(seed ?? ...)`を呼ぶのは、`startWave`に渡す前に`currentBossKind`の初期抽選をしておく必要があるため。`startWave`は同じ`seed`から内部で別のシード連動PRNGインスタンスを生成するため、この2つの`rand`系列は独立しており(生成元のシード値が同じでも、それぞれが別々の`createRng`呼び出しであるため)、互いの結果に影響しない。ステージ0は必ず小凶(shoukyou)階級であり`suit`候補は選ばれ得ないため、`currentGreatMisfortuneSuit`は既存通り`null`で固定してよい。

`enterRevelationSelect`関数、現在の内容:

```ts
function enterRevelationSelect(
  params: ShidasuParams,
  run: RunState,
  newItems: ItemId[],
  newRites: RiteId[],
  seed: number | undefined,
  rand: () => number
): RunState {
  const newLocation = nextWaveLocation(params, run)
  const newGreatMisfortuneSuit = nextGreatMisfortuneSuit(run, newLocation, rand)
  const { wave, deckComposition } = startWave(params, newLocation.stageIndex, newLocation.waveIndex, newItems, run.deckComposition, seed, run.extraTableauRows, run.oracleLevels)
  return {
    ...run,
    phase: 'revelationSelect',
    items: newItems,
    rites: newRites,
    stageIndex: newLocation.stageIndex,
    waveIndex: newLocation.waveIndex,
    currentGreatMisfortuneSuit: newGreatMisfortuneSuit,
    offer: [],
    pendingNewItem: null,
    wave,
    deckComposition,
    revelationOffer: rollRevelationOffer(rand),
  }
}
```

を以下に置き換える:

```ts
function enterRevelationSelect(
  params: ShidasuParams,
  run: RunState,
  newItems: ItemId[],
  newRites: RiteId[],
  seed: number | undefined,
  rand: () => number
): RunState {
  const newLocation = nextWaveLocation(params, run)
  const newBossKind = nextBossKind(params, run, newLocation, rand)
  const newGreatMisfortuneSuit = nextGreatMisfortuneSuit(run, newLocation, newBossKind, rand)
  const { wave, deckComposition } = startWave(params, newLocation.stageIndex, newLocation.waveIndex, newItems, run.deckComposition, seed, run.extraTableauRows, run.oracleLevels)
  return {
    ...run,
    phase: 'revelationSelect',
    items: newItems,
    rites: newRites,
    stageIndex: newLocation.stageIndex,
    waveIndex: newLocation.waveIndex,
    currentGreatMisfortuneSuit: newGreatMisfortuneSuit,
    currentBossKind: newBossKind,
    offer: [],
    pendingNewItem: null,
    wave,
    deckComposition,
    revelationOffer: rollRevelationOffer(rand),
  }
}
```

- [ ] **Step 10: テストを実行し成功を確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts`
Expected: PASS(全件)

- [ ] **Step 11: 型チェック・全体テストを実行する**

Run: `npm run check`
Expected: `engine.ts`・`engine.test.ts`のエラーは解消していること。`src/routes/admin/shidasu/BossTiersSection.svelte`・`src/routes/game/shidasu/+page.svelte`のエラーはTask 4〜5で解消するため許容する。

Run: `npm run test`
Expected: 全件PASS

- [ ] **Step 12: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: ボスウェーブの候補抽選ロジックと得点ロック種別(oddCombo/face)を追加"
```

---

### Task 3: 参照データ・監査用テキストの新規作成

**Files:**
- Create: `src/lib/game/shidasu/bosses.ts`
- Create: `src/lib/game/shidasu/sinDaughters.ts`
- Create: `src/lib/game/shidasu/bossActualEffects.ts`

- [ ] **Step 1: `bosses.ts`を新規作成する**

`src/lib/game/shidasu/bosses.ts`を新規作成(`rites.ts`の`riteName`/`riteDesc`と同じパターン):

```ts
// src/lib/game/shidasu/bosses.ts
import type { BossKind, BossTierKey } from './types'
import type { ShidasuParams } from './params'

export const BOSS_KINDS: BossKind[] = ['noLoop', 'faceLock', 'lowCombo', 'oddCombo', 'suit', 'face']

export function bossName(kind: BossKind, params: ShidasuParams): string {
  return params.bosses[kind].name
}

export function bossDesc(kind: BossKind, params: ShidasuParams): string {
  const entry = params.bosses[kind] as unknown as Record<string, unknown> & { desc: string }
  const context: Record<string, number> = {}
  for (const [key, value] of Object.entries(entry)) {
    if (typeof value === 'number') context[key] = value
  }
  return entry.desc.replace(/\{(\w+)\}/g, (match, key) => (key in context ? String(context[key]) : match))
}

// 指定した階級に現在割り当てられている候補の一覧を返す(管理画面の件数表示・バリデーションで使う)。
export function bossesInTier(params: ShidasuParams, tierKey: BossTierKey): BossKind[] {
  return BOSS_KINDS.filter(kind => params.bosses[kind].tier === tierKey)
}
```

- [ ] **Step 2: `sinDaughters.ts`を新規作成する**

`src/lib/game/shidasu/sinDaughters.ts`を新規作成(`runes.ts`と同じパターン。管理画面の「名前」`<select>`の選択肢としてのみ使う参照データ):

```ts
// src/lib/game/shidasu/sinDaughters.ts
// 七つの大罪(傲慢・嫉妬・憤怒・怠惰・強欲・暴食・色欲)にそれぞれ紐づく「派生悪徳(娘罪)」の参照データ。
// BossKind(実装済み6種)とは独立しており、管理画面の「名前」<select>の選択肢・由来ラベル表示にのみ使う。
// 将来ボス候補を追加する際、ここから未使用の名前を選んで割り当てる。
export interface SinDaughterEntry {
  name: string
  parentSin: string
}

export const SIN_DAUGHTERS: SinDaughterEntry[] = [
  { name: '頑迷', parentSin: '傲慢' },
  { name: '偽善', parentSin: '傲慢' },
  { name: '虚栄', parentSin: '傲慢' },
  { name: '高慢', parentSin: '傲慢' },
  { name: '不遜', parentSin: '傲慢' },
  { name: '妬み', parentSin: '嫉妬' },
  { name: '憎悪', parentSin: '嫉妬' },
  { name: '中傷', parentSin: '嫉妬' },
  { name: '冷笑', parentSin: '嫉妬' },
  { name: '憤慨', parentSin: '憤怒' },
  { name: '口論', parentSin: '憤怒' },
  { name: '侮辱', parentSin: '憤怒' },
  { name: '激昂', parentSin: '憤怒' },
  { name: '無気力', parentSin: '怠惰' },
  { name: '怠慢', parentSin: '怠惰' },
  { name: '逃避', parentSin: '怠惰' },
  { name: '絶望', parentSin: '怠惰' },
  { name: '裏切り', parentSin: '強欲' },
  { name: '詐欺', parentSin: '強欲' },
  { name: '強奪', parentSin: '強欲' },
  { name: '独占欲', parentSin: '強欲' },
  { name: '浪費', parentSin: '暴食' },
  { name: '貪食', parentSin: '暴食' },
  { name: '放埓', parentSin: '暴食' },
  { name: '過食', parentSin: '暴食' },
  { name: '誘惑', parentSin: '色欲' },
  { name: '耽溺', parentSin: '色欲' },
  { name: '執着', parentSin: '色欲' },
  { name: '淫蕩', parentSin: '色欲' },
]
```

- [ ] **Step 3: `bossActualEffects.ts`を新規作成する**

`src/lib/game/shidasu/bossActualEffects.ts`を新規作成(`riteActualEffects.ts`と同じパターン):

```ts
// src/lib/game/shidasu/bossActualEffects.ts
import type { BossKind } from './types'

// 各ボス候補の実際の実装ロジックを、開発者向けに要約したもの(監査用)。
// 説明文テンプレート(params.bosses[kind].desc)とは独立して管理し、実装(engine.ts)を正として記述する。
export const BOSS_ACTUAL_EFFECTS: Record<BossKind, string> = {
  noLoop: 'stageModifierForがStageModifier "noLoop" を返し、isPlayableでランク差12(A⇔Kループ)の接続を禁止する(取得可否そのものを制限、得点には無関係)',
  faceLock: 'stageModifierForがStageModifier "faceLock" を返し、isPlayableでコンボ数が2未満のとき絵札(J・Q・K、ランク11以上)の取得を禁止する(ワイルドの場札はfaceLock判定より先に優先評価される)',
  lowCombo: 'bossScoreLockForが{kind:"combo", maxCombo:params.bosses.lowCombo.maxCombo}を返し、playCard/drawStockでeffectiveCombo(庇護・大地等の護符補正込みの実効コンボ数)がmaxCombo以下のとき獲得点(gained/naiveGained)を0にする。コンボ数自体(wave.combo)は通常通り進行する',
  oddCombo: 'bossScoreLockForが{kind:"oddCombo"}を返し、playCard/drawStockでeffectiveComboが奇数のとき獲得点を0にする。コンボ数自体は通常通り進行する',
  suit: 'ステージ突入時(nextBossKindがsuitを選んだ瞬間)にrollGreatMisfortuneSuitでスートを1つ確定しRunState.currentGreatMisfortuneSuitに保持する。bossScoreLockForが{kind:"suit", suit}を返し、playCard/drawStockで非ワイルドかつそのスートのカードを取ると獲得点を0にする(ワイルドは対象外)',
  face: 'bossScoreLockForが{kind:"face"}を返し、playCard/drawStockで非ワイルドかつisFace(ランク11以上)のカードを取ると獲得点を0にする(ワイルドは対象外)',
}
```

- [ ] **Step 4: 型チェックを実行する**

Run: `npm run check`
Expected: 新規3ファイルにエラー無し(Task 2完了時点の既存許容エラーのみ残存)

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/bosses.ts src/lib/game/shidasu/sinDaughters.ts src/lib/game/shidasu/bossActualEffects.ts
git commit -m "feat: ボス候補の参照データ(bosses.ts・sinDaughters.ts)と監査用テキストを追加"
```

---

### Task 4: +page.svelteのUI変更(常時表示)

**Files:**
- Modify: `src/routes/game/shidasu/+page.svelte`

- [ ] **Step 1: importを更新する(`bossTierOf`を削除し`bossDesc`を追加)**

`src/routes/game/shidasu/+page.svelte`の`$lib/game/shidasu/engine`からのimport文、現在の内容:

```ts
    waveTarget, stageModifierFor, bossTierOf, isBossWave,
```

を以下に置き換える(`bossTierOf`はこのファイル内でこの後書き換える`upcomingBossInfo`でしか使われておらず、Step 2の変更後は完全に不要になるため削除する):

```ts
    waveTarget, stageModifierFor, isBossWave,
```

`$lib/game/shidasu/bosses`から`bossDesc`を新規importする行を追加する:

```ts
  import { bossDesc } from '$lib/game/shidasu/bosses'
```

- [ ] **Step 2: `upcomingBossInfo`を`currentBossKind`ベースに書き換える**

現在の内容:

```ts
  // 現在のステージのボス(小凶→中凶→大凶)の情報を返す。ステージ内の3ウェーブは
  // 常に同じボス階級を共有し、ボスウェーブ(3ウェーブ目)でのみ実際に制約が発動する
  // (どちらの表示にするかはstageRow側のisBossWave分岐が担い、ここでは扱わない)。
  let upcomingBossInfo = $derived.by(() => {
    const tier = bossTierOf(run.stageIndex)
    if (tier === 0) return { label: params.bossTiers.shoukyou.name, detail: 'A⇔Kループ禁止' }
    if (tier === 1) return { label: params.bossTiers.chuukyou.name, detail: `${params.bossTiers.chuukyou.maxCombo}コンボ以下で無得点` }
    return { label: params.bossTiers.taikyou.name, detail: run.currentGreatMisfortuneSuit ? `${run.currentGreatMisfortuneSuit}で無得点` : '対象スート未確定' }
  })
```

を以下に置き換える:

```ts
  // 現在のステージで選ばれているボス候補(currentBossKind)の情報を返す。ステージ内の3ウェーブは
  // 常に同じ候補を共有し、ボスウェーブ(3ウェーブ目)でのみ実際に制約が発動する
  // (どちらの表示にするかはstageRow側のisBossWave分岐が担い、ここでは扱わない)。
  let upcomingBossInfo = $derived.by(() => {
    const kind = run.currentBossKind
    if (!kind) return { label: '', detail: '' }
    if (kind === 'suit') {
      const detail = run.currentGreatMisfortuneSuit ? `${run.currentGreatMisfortuneSuit}で無得点` : '対象スート未確定'
      return { label: params.bosses.suit.name, detail }
    }
    return { label: params.bosses[kind].name, detail: bossDesc(kind, params) }
  })
```

- [ ] **Step 3: 型チェックを実行する**

Run: `npm run check`
Expected: `+page.svelte`にエラーが無いこと(`src/routes/admin/shidasu/BossTiersSection.svelte`のエラーはTask 5で解消するため許容する)

- [ ] **Step 4: コミット**

```bash
git add src/routes/game/shidasu/+page.svelte
git commit -m "feat: 常時表示エリアが選ばれたボス候補の名前・説明文を表示するよう変更"
```

---

### Task 5: 管理画面の更新

**Files:**
- Create: `src/routes/admin/shidasu-bosses/+page.svelte`
- Modify: `src/routes/admin/shidasu/BossTiersSection.svelte`
- Modify: `src/routes/admin/+page.svelte`
- Modify: `src/routes/admin/shidasu/+page.svelte`

- [ ] **Step 1: `BossTiersSection.svelte`から`maxCombo`欄を削除する**

`src/routes/admin/shidasu/BossTiersSection.svelte`の現在の内容:

```svelte
<section class="bg-white border border-slate-200 rounded-xl p-4">
  <h2 class="font-semibold text-slate-700 text-sm mb-3">ボス</h2>
  <div class="grid grid-cols-3 gap-3">
    <label class="text-xs text-slate-500">
      小凶の名前
      <input type="text" bind:value={config.bossTiers.shoukyou.name} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
    </label>
    <label class="text-xs text-slate-500">
      中凶の名前
      <input type="text" bind:value={config.bossTiers.chuukyou.name} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
    </label>
    <label class="text-xs text-slate-500">
      大凶の名前
      <input type="text" bind:value={config.bossTiers.taikyou.name} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
    </label>
    <label class="text-xs text-slate-500 col-span-3">
      中凶: n以下のコンボで無得点(maxCombo)
      <input type="number" min="0" step="1" bind:value={config.bossTiers.chuukyou.maxCombo} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
    </label>
  </div>
</section>
```

を以下に置き換える(`maxCombo`欄を削除し、代わりに新規管理画面への案内リンクを追加する):

```svelte
<section class="bg-white border border-slate-200 rounded-xl p-4">
  <h2 class="font-semibold text-slate-700 text-sm mb-3">ボス</h2>
  <div class="grid grid-cols-3 gap-3">
    <label class="text-xs text-slate-500">
      小凶の名前
      <input type="text" bind:value={config.bossTiers.shoukyou.name} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
    </label>
    <label class="text-xs text-slate-500">
      中凶の名前
      <input type="text" bind:value={config.bossTiers.chuukyou.name} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
    </label>
    <label class="text-xs text-slate-500">
      大凶の名前
      <input type="text" bind:value={config.bossTiers.taikyou.name} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
    </label>
  </div>
  <p class="text-xs text-slate-400 mt-3">
    各階級のボス制約候補(名前・パラメータ・説明文・階級の割り当て)は
    <a href="/admin/shidasu-bosses" class="text-teal-600 hover:underline">ボス候補パラメータ設定ページ</a>
    で編集します。
  </p>
</section>
```

- [ ] **Step 2: `/admin/shidasu-bosses`ページを新規作成する**

`src/routes/admin/shidasu-bosses/+page.svelte`を新規作成(`/admin/shidasu-rites`の表形式パターンを踏襲し、「階級」列・階級ごとの件数表示・0件バリデーションを追加する):

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { DEFAULT_PARAMS, type ShidasuParams } from '$lib/game/shidasu/params'
  import { bossDesc, bossesInTier, BOSS_KINDS } from '$lib/game/shidasu/bosses'
  import { SIN_DAUGHTERS } from '$lib/game/shidasu/sinDaughters'
  import { BOSS_ACTUAL_EFFECTS } from '$lib/game/shidasu/bossActualEffects'
  import type { BossKind, BossTierKey } from '$lib/game/shidasu/types'

  let config = $state<ShidasuParams | null>(null)
  let error = $state<string | null>(null)
  let flash = $state<string | null>(null)
  let flashTimer: ReturnType<typeof setTimeout> | null = null

  function showToast(message: string) {
    if (flashTimer) clearTimeout(flashTimer)
    flash = message
    flashTimer = setTimeout(() => { flash = null }, 2000)
  }

  const TIER_LABELS: Record<BossTierKey, string> = { shoukyou: '小凶', chuukyou: '中凶', taikyou: '大凶' }
  const TIER_OPTIONS: BossTierKey[] = ['shoukyou', 'chuukyou', 'taikyou']

  type BossEntry = { name: string; tier: BossTierKey; desc: string } & Record<string, number | string>

  function bossEntry(kind: BossKind): BossEntry {
    return config!.bosses[kind] as unknown as BossEntry
  }

  function bossParamKeys(kind: BossKind): string[] {
    return Object.keys(bossEntry(kind)).filter(key => key !== 'name' && key !== 'desc' && key !== 'tier')
  }

  let tierCounts = $derived.by(() => {
    if (!config) return { shoukyou: 0, chuukyou: 0, taikyou: 0 }
    return {
      shoukyou: bossesInTier(config, 'shoukyou').length,
      chuukyou: bossesInTier(config, 'chuukyou').length,
      taikyou: bossesInTier(config, 'taikyou').length,
    }
  })

  let hasValidationError = $derived.by(() => {
    if (!config) return false
    if (tierCounts.shoukyou === 0 || tierCounts.chuukyou === 0 || tierCounts.taikyou === 0) return true
    return BOSS_KINDS.some(kind => {
      const entry = bossEntry(kind)
      if (!entry.name.trim()) return true
      if (!entry.desc.trim()) return true
      return bossParamKeys(kind).some(key => !Number.isFinite(entry[key] as number))
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
  <title>Shidasu ボス候補パラメータ設定</title>
</svelte:head>

<div class="max-w-5xl mx-auto px-4 py-8">
  <a href="/admin" class="text-xs text-slate-400 hover:text-teal-600 mb-4 inline-block">← 管理ページ一覧</a>

  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold text-slate-800">星詠みソリティア -Shidasu- ボス候補パラメータ設定</h1>
    <div class="flex gap-2">
      <button onclick={() => loadConfig(true)} class="text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
        リロード
      </button>
      {#if hasValidationError}
        <p class="text-xs text-red-600 self-center">ボス名・説明文が空、パラメータが未入力、またはいずれかの階級の候補数が0件です</p>
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
    <div class="flex gap-4 mb-4 text-xs text-slate-500">
      <span class={tierCounts.shoukyou === 0 ? 'text-red-600 font-bold' : ''}>小凶: {tierCounts.shoukyou}件</span>
      <span class={tierCounts.chuukyou === 0 ? 'text-red-600 font-bold' : ''}>中凶: {tierCounts.chuukyou}件</span>
      <span class={tierCounts.taikyou === 0 ? 'text-red-600 font-bold' : ''}>大凶: {tierCounts.taikyou}件</span>
    </div>

    <section class="bg-white border border-slate-200 rounded-xl p-4">
      <div class="overflow-x-auto">
        <table class="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
          <thead>
            <tr class="bg-slate-50 text-slate-500">
              <th class="px-2 py-1.5 text-left" style="width:6rem;">階級</th>
              <th class="px-2 py-1.5 text-left" style="width:9rem;">名前</th>
              <th class="px-2 py-1.5 text-left" style="width:9rem;">パラメータ</th>
              <th class="px-2 py-1.5 text-left" style="width:14rem;">説明文テンプレート</th>
              <th class="px-2 py-1.5 text-left" style="width:14rem;">プレビュー</th>
              <th class="px-2 py-1.5 text-left" style="width:20rem;">実際の効果(監査用)</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            {#each BOSS_KINDS as kind (kind)}
              {@const entry = bossEntry(kind)}
              <tr>
                <td class="px-2 py-1.5 align-top">
                  <select bind:value={entry.tier} class="w-full border border-slate-200 rounded px-1.5 py-0.5">
                    {#each TIER_OPTIONS as tierKey (tierKey)}
                      <option value={tierKey}>{TIER_LABELS[tierKey]}</option>
                    {/each}
                  </select>
                </td>
                <td class="px-2 py-1.5 align-top">
                  <select bind:value={entry.name} class="w-full border border-slate-200 rounded px-1.5 py-0.5">
                    {#each SIN_DAUGHTERS as daughter (daughter.name)}
                      <option value={daughter.name}>{daughter.name}({daughter.parentSin})</option>
                    {/each}
                  </select>
                </td>
                <td class="px-2 py-1.5 align-top">
                  <div class="flex flex-wrap gap-1.5">
                    {#each bossParamKeys(kind) as key (key)}
                      <label class="flex items-center gap-1 text-[11px] text-slate-500">
                        {key}
                        <input type="number" step="any" bind:value={entry[key]} class="w-16 border border-slate-200 rounded px-1 py-0.5" />
                      </label>
                    {/each}
                    {#if bossParamKeys(kind).length === 0}
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
                <td class="px-2 py-1.5 align-top text-slate-500">{bossDesc(kind, config)}</td>
                <td class="px-2 py-1.5 align-top text-slate-500">{BOSS_ACTUAL_EFFECTS[kind]}</td>
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

- [ ] **Step 3: `/admin/+page.svelte`に新規ページへのリンクを追加する**

現在の内容(`/admin/shidasu-oracles`の項目、末尾):

```svelte
    <a href="/admin/shidasu-oracles" class="flex items-center gap-3 px-4 py-4 hover:bg-slate-50 transition-colors group">
      <div class="flex-1">
        <p class="text-sm font-semibold text-slate-700 group-hover:text-teal-700">星詠みソリティア -Shidasu- 神託パラメータ設定</p>
        <p class="text-xs text-slate-400 mt-0.5">神託ごとの名前(八卦)・説明文テンプレート・プレビューを1行ずつ編集</p>
      </div>
      <span class="text-slate-300 group-hover:text-teal-600 transition-colors">→</span>
    </a>
  </div>
</div>
```

を以下に置き換える(`/admin/shidasu-oracles`の項目の直後に新規項目を追加する):

```svelte
    <a href="/admin/shidasu-oracles" class="flex items-center gap-3 px-4 py-4 hover:bg-slate-50 transition-colors group">
      <div class="flex-1">
        <p class="text-sm font-semibold text-slate-700 group-hover:text-teal-700">星詠みソリティア -Shidasu- 神託パラメータ設定</p>
        <p class="text-xs text-slate-400 mt-0.5">神託ごとの名前(八卦)・説明文テンプレート・プレビューを1行ずつ編集</p>
      </div>
      <span class="text-slate-300 group-hover:text-teal-600 transition-colors">→</span>
    </a>
    <a href="/admin/shidasu-bosses" class="flex items-center gap-3 px-4 py-4 hover:bg-slate-50 transition-colors group">
      <div class="flex-1">
        <p class="text-sm font-semibold text-slate-700 group-hover:text-teal-700">星詠みソリティア -Shidasu- ボス候補パラメータ設定</p>
        <p class="text-xs text-slate-400 mt-0.5">ボス候補ごとの名前(七つの大罪の娘罪)・所属階級・パラメータ・説明文テンプレートを1行ずつ編集</p>
      </div>
      <span class="text-slate-300 group-hover:text-teal-600 transition-colors">→</span>
    </a>
  </div>
</div>
```

- [ ] **Step 4: 型チェック・ビルドを実行する**

Run: `npm run check`
Expected: shidasu関連ファイルにエラー無し

Run: `npm run build`
Expected: 成功

- [ ] **Step 5: コミット**

```bash
git add src/routes/admin/shidasu-bosses/+page.svelte src/routes/admin/shidasu/BossTiersSection.svelte src/routes/admin/+page.svelte
git commit -m "feat: ボス候補専用の管理画面(/admin/shidasu-bosses)を追加"
```

---

### Task 6: 最終確認・ブラウザ動作確認

**Files:** (テスト・動作確認のみ、コード変更なし)

- [ ] **Step 1: 全体テスト・型チェック・ビルドを実行する**

Run: `npm run test` — Expected: 全件PASS
Run: `npm run check` — Expected: shidasu関連ファイルにエラー無し
Run: `npm run build` — Expected: 成功

- [ ] **Step 2: `npm run dev`でブラウザ動作確認する**

`npm run dev`で開発サーバーを起動し、`/game/shidasu`を開いて以下を確認する:

1. ゲームを開始し、小凶ボスウェーブ(3ウェーブ目)に到達したとき、常時表示エリアに「頑迷(A⇔Kループ禁止)」または「偽善(絵札はコンボ2以上でのみ取れる)」のいずれかが表示される
2. 「偽善」が選ばれた場合、実際にコンボ2未満で絵札が取れないことを確認する(既存のfaceLock挙動が正しく再有効化されていること)
3. 中凶ボスウェーブで「憤慨」または「口論」のいずれかが表示され、「口論」が選ばれた場合、コンボが奇数のプレイで獲得点が0になることを確認する
4. 大凶ボスウェーブで「裏切り」または「詐欺」のいずれかが表示され、「裏切り」なら対象スートが、「詐欺」なら絵札を取ると獲得点が0になることを確認する
5. 同じステージ内(1〜3ウェーブ目)は選ばれたボス候補が変わらないことを確認する
6. コンソールエラーが出ていないことを確認する

- [ ] **Step 3: `/admin/shidasu-bosses`の動作確認**

`/admin/shidasu-bosses`を開き、6件のボス候補が階級・名前・パラメータ・説明文テンプレート・プレビュー・実際の効果の列で表示され、階級の`<select>`を変更できることを確認する。階級ごとの件数表示が正しく更新されることを確認する。いずれかの階級を全て別の階級に変更して0件にした場合、保存ボタンが無効化されバリデーションメッセージが表示されることを確認する(確認後、必ず元の割り当てに戻すこと)。

`/admin/shidasu`の「ボス」セクションから`maxCombo`欄が消え、新規ページへの案内リンクが表示されることを確認する。

- [ ] **Step 4: 問題があれば修正し、再度Step 1〜3を実行する**

- [ ] **Step 5: 最終コミット(修正があった場合のみ)**

```bash
git add -A
git commit -m "fix: ボス候補複数化機能のブラウザ動作確認で見つかった問題を修正"
```
