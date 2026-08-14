# triggerSabotage 個別関数化リファクタ 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `triggerSabotage`(22ケース・約190行のswitch文)を、既存の`applyRiteEffect`/`applyRevelationEffect`と同じパターンで個別関数+Recordマップ方式に切り出す純粋なリファクタ。ゲームの挙動は一切変更しない。

**Architecture:** 新規ファイル`sabotageEffects.ts`に22個の効果関数と`Record<SabotageActionId, Handler>`ディスパッチテーブルを実装する。既存の`triggerSabotage`(`engine.ts`)が内部で使っている`resetComboFields`は、新規ファイルとの循環import(`engine.ts`⇄`sabotageEffects.ts`)を避けるため、先に第3のファイル`waveReset.ts`へ切り出す。

**Tech Stack:** SvelteKit, TypeScript, Vitest

**設計書:** `docs/superpowers/specs/2026-08-14-shidasu-sabotage-effects-refactor-design.md`

---

## 全体の前提知識

- このリファクタは**挙動を一切変えない**。正しさの根拠は、既存の`triggerSabotage`経由のテスト(`src/lib/game/shidasu/engine.test.ts`の`describe('triggerSabotage', ...)`ブロック、既存の妨害トリガー統合テスト等、合計939件)が**無修正のまま**全てグリーンであり続けることである。
- `src/lib/game/shidasu/engine.ts`: `resetComboFields`(236〜293行目、非export)、`triggerSabotage`(1208〜1389行目付近、22ケースのswitch文)。
- `src/lib/game/shidasu/riteEffects.ts`: `applyRiteEffect`・`canUseRite`(共にexport済み)。
- `src/lib/game/shidasu/deck.ts`: `shuffleInPlace`・`rollOffer`(共にexport済み)。
- `src/lib/game/shidasu/oracles.ts`: `ORACLE_POOL`(export済み)。
- 循環importに注意: `engine.ts`は最終的に`sabotageEffects.ts`をimportする(`applySabotageEffect`を使うため)。もし`sabotageEffects.ts`側が`engine.ts`から何かをimportし返すと循環importになる。これを避けるため、Task 1で`resetComboFields`を独立ファイル`waveReset.ts`に先出しし、`engine.ts`・`sabotageEffects.ts`の両方がそこから読み込む形にする。

---

### Task 1: resetComboFieldsをwaveReset.tsに切り出す

**Files:**
- Create: `src/lib/game/shidasu/waveReset.ts`
- Modify: `src/lib/game/shidasu/engine.ts`

- [ ] **Step 1: waveReset.tsを新規作成し、resetComboFieldsをそのまま移植する**

`src/lib/game/shidasu/waveReset.ts`を新規作成:

```ts
// src/lib/game/shidasu/waveReset.ts
import type { Card, ChainCardOrigin, WaveState } from './types'
import type { ShidasuParams } from './params'

// エイワズ(秘儀)によるコンボリセット防止。newFoundationが新しく引かれたカード(通常のdrawStock
// リセット時)であればチェーンを継続扱いで延長し、全消し・手詰まりのリサイクル時(newFoundation省略、
// wave.foundationと同一)はチェーン・コンボ状態をそのまま保持する。いずれもresetDirect系護符
// (沈着・冷静・残響等)の判定はこの関数の外側(呼び出し元)で既に行われているため、シールドが
// 防ぐのはコンボ・チェーンの状態変化のみである。
export function resetComboFields(
  wave: WaveState,
  params: ShidasuParams,
  newFoundation: Card = wave.foundation,
  newOrigin: ChainCardOrigin = wave.chainOrigin[wave.chainOrigin.length - 1]
): WaveState {
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
  // イサ(凍結)がナウジズより優先。凍結中はcomboを一切変更しない。
  // 基礎コンボ数(baseComboCount)はリセット処理では一切参照しない(得点計算時に常に加算される別枠の値のため)。
  const comboAfterReset = wave.comboFrozenThisWave
    ? wave.combo
    : wave.nauthizActiveThisWave
      ? Math.floor(wave.combo / 2)
      : 0
  return {
    ...wave,
    foundation: newFoundation,
    combo: comboAfterReset,
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

(このコードは`engine.ts`236〜293行目の`resetComboFields`関数定義を一字一句そのまま`export`付きで移しただけで、ロジックの変更は無い。)

- [ ] **Step 2: engine.ts側の定義を削除し、importに差し替える**

`src/lib/game/shidasu/engine.ts`の236〜293行目(`function resetComboFields( ... ) { ... }`の定義全体、Step 1でコピーした範囲)を削除する。

`src/lib/game/shidasu/engine.ts`冒頭のimport群(4〜17行目付近)に追加:

```ts
import { resetComboFields } from './waveReset'
```

(`engine.ts`内の`resetComboFields`の呼び出し箇所(675行目・876行目・1234行目・1238行目・1987行目付近)はコードを変更しない。関数名・シグネチャが同一なので、importに差し替えるだけで動く。)

- [ ] **Step 3: ビルド・型チェック・テストを確認する**

Run: `npm run check`
Expected: エラー無し

Run: `npx vitest run src/lib/game/shidasu`
Expected: 全テストPASS(939件、無修正のまま)

- [ ] **Step 4: コミット**

```bash
git add src/lib/game/shidasu/waveReset.ts src/lib/game/shidasu/engine.ts
git commit -m "refactor: resetComboFieldsをwaveReset.tsに切り出す"
```

---

### Task 2: sabotageEffects.ts新規作成(22個の効果関数+Recordディスパッチ)

**Files:**
- Create: `src/lib/game/shidasu/sabotageEffects.ts`
- Test: `src/lib/game/shidasu/sabotageEffects.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/sabotageEffects.test.ts`を新規作成(`SABOTAGE_HANDLERS`が`SabotageActionId`22種全てを網羅していることだけを検証する軽量なテスト。個別効果の正しさは既存の`triggerSabotage`経由のテストが保証するため、ここでは重複させない):

```ts
import { describe, it, expect } from 'vitest'
import { applySabotageEffect } from './sabotageEffects'
import { SABOTAGE_POOL } from './sabotage'
import { createInitialRun, startWave } from './engine'
import { DEFAULT_PARAMS } from './params'
import { defaultOracleLevels } from './oracles'

describe('applySabotageEffect', () => {
  it('SABOTAGE_POOLの22件全てのidに対して、例外を投げずに結果を返す', () => {
    // createInitialRun/startWaveで実際に使われるのと同じ形の、正規のRunState/WaveStateを
    // 用意する(手組みのダミーオブジェクトだとchainSettleがresetComboFields内でparams.talismans
    // 等を参照して例外になるなど、フィールド不足による誤検出を招くため)。
    // 所持品は全て空スタートだが、対象0件のケースは各ハンドラが早期returnで{}を返す設計なので
    // 例外なく完走する(22件全てのディスパッチ経路が揃っているかを見るだけのテストで十分)。
    const run = createInitialRun()
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, run.items, run.deckComposition, 1, 0, defaultOracleLevels())
    for (const action of SABOTAGE_POOL) {
      expect(() => applySabotageEffect(action.id, { params: DEFAULT_PARAMS, run, wave, rand: () => 0 })).not.toThrow()
    }
  })
})
```

(`run.deckComposition`は`createInitialRun()`が内部で`standardDeckComposition()`を使って既に設定済みのため、このテストコードで`standardDeckComposition`を直接importする必要はない。)

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npx vitest run src/lib/game/shidasu/sabotageEffects.test.ts`
Expected: FAIL(`./sabotageEffects`モジュールが存在しない)

- [ ] **Step 3: sabotageEffects.tsを実装する**

`src/lib/game/shidasu/sabotageEffects.ts`を新規作成:

```ts
// src/lib/game/shidasu/sabotageEffects.ts
import type { SabotageActionId, WaveState, RunState, Card, HeldRevelationOrOracleRef } from './types'
import type { ShidasuParams } from './params'
import { shuffleInPlace, rollOffer } from './deck'
import { ORACLE_POOL } from './oracles'
import { applyRiteEffect, canUseRite } from './riteEffects'
import { resetComboFields } from './waveReset'

export interface SabotageContext {
  params: ShidasuParams
  run: RunState
  wave: WaveState
  rand: () => number
}

// wave・runへの差分(部分更新)。両方ともoptional(片方だけ、あるいはどちらも変更しない場合はキー自体を省略する)
export interface SabotageResult {
  wave?: Partial<WaveState>
  run?: Partial<RunState>
}

function applyStockPurge({ wave }: SabotageContext): SabotageResult {
  const n = Math.min(5, wave.stock.length)
  const purged = wave.stock.slice(wave.stock.length - n)
  return { wave: { stock: wave.stock.slice(0, wave.stock.length - n), discardPile: [...wave.discardPile, ...purged] } }
}

function applyColumnReturn({ wave, rand }: SabotageContext): SabotageResult {
  const colIndex = Math.floor(rand() * wave.tableau.length)
  const col = wave.tableau[colIndex]
  const pool = [...wave.stock, ...col]
  shuffleInPlace(pool, rand)
  const newCol = pool.slice(0, col.length)
  const newStock = pool.slice(col.length)
  const tableau = wave.tableau.map((c, i) => (i === colIndex ? newCol : c))
  return { wave: { tableau, stock: newStock } }
}

// chainSettle: 既存のtriggerSabotageは`nextWave`(activeSeal既にnullリセット済み)を起点に
// resetComboFieldsを呼んでいたが、この関数は`wave`(リセット前、活性のactiveSealを保持している
// 可能性がある)を受け取る。resetComboFieldsは`...wave`をスプレッドするため、そのままだと古い
// activeSealが結果へ紛れ込む。明示的に`activeSeal: null`で上書きすることで、triggerSabotage側の
// ベース(resetWave)に依存せず、この関数単体で正しい結果を返せるようにする。
function applyChainSettle({ params, wave, rand }: SabotageContext): SabotageResult {
  if (wave.stock.length === 0) {
    return { wave: { ...resetComboFields(wave, params), activeSeal: null } }
  }
  const stock = [...wave.stock]
  const drawn = stock.pop() as Card
  return { wave: { ...resetComboFields(wave, params, drawn, 'draw'), activeSeal: null, stock } }
}

function applyComboBreather(_ctx: SabotageContext): SabotageResult {
  return { wave: { combo: 0 } }
}

function applyTalismanSeal({ run, rand }: SabotageContext): SabotageResult {
  if (run.items.length === 0) return {}
  const target = run.items[Math.floor(rand() * run.items.length)]
  return { wave: { activeSeal: { kind: 'talisman', id: target } } }
}

function applyRiteSeal({ run, rand }: SabotageContext): SabotageResult {
  if (run.rites.length === 0) return {}
  const target = run.rites[Math.floor(rand() * run.rites.length)]
  return { wave: { activeSeal: { kind: 'rite', id: target } } }
}

function applyRevelationOracleSeal({ run, rand }: SabotageContext): SabotageResult {
  const pool: HeldRevelationOrOracleRef[] = [
    ...run.revelations.map(refId => ({ kind: 'revelation' as const, id: refId })),
    ...run.oracles.map(refId => ({ kind: 'oracle' as const, id: refId })),
  ]
  if (pool.length === 0) return {}
  const ref = pool[Math.floor(rand() * pool.length)]
  return { wave: { activeSeal: { kind: 'revelationOrOracle', ref } } }
}

function applyRelicConfiscate({ run, rand }: SabotageContext): SabotageResult {
  if (run.relics.length === 0) return {}
  const idx = Math.floor(rand() * run.relics.length)
  return { run: { relics: [...run.relics.slice(0, idx), ...run.relics.slice(idx + 1)] } }
}

function applyTableauCardToDiscard({ wave, rand }: SabotageContext): SabotageResult {
  const positions: { ci: number; ri: number }[] = []
  wave.tableau.forEach((col, ci) => col.forEach((_c, ri) => positions.push({ ci, ri })))
  if (positions.length === 0) return {}
  const pick = positions[Math.floor(rand() * positions.length)]
  const card = wave.tableau[pick.ci][pick.ri]
  const tableau = wave.tableau.map((col, ci) => (ci === pick.ci ? [...col.slice(0, pick.ri), ...col.slice(pick.ri + 1)] : col))
  return { wave: { tableau, discardPile: [...wave.discardPile, card] } }
}

function applyCurrencyConfiscate({ run }: SabotageContext): SabotageResult {
  return { run: { currency: Math.max(0, run.currency - 5) } }
}

function applyRoleSeal({ rand }: SabotageContext): SabotageResult {
  const names = rollOffer(ORACLE_POOL, 2, rand)
  return { wave: { activeSeal: { kind: 'role', names } } }
}

function applyStockPurgeSmall({ wave }: SabotageContext): SabotageResult {
  const n = Math.min(2, wave.stock.length)
  const purged = wave.stock.slice(wave.stock.length - n)
  return { wave: { stock: wave.stock.slice(0, wave.stock.length - n), discardPile: [...wave.discardPile, ...purged] } }
}

function applyStockShuffle({ wave, rand }: SabotageContext): SabotageResult {
  const stock = [...wave.stock]
  shuffleInPlace(stock, rand)
  return { wave: { stock } }
}

function applyTableauFullReturn({ wave, rand }: SabotageContext): SabotageResult {
  const counts = wave.tableau.map(col => col.length)
  const pool = [...wave.stock, ...wave.tableau.flat()]
  shuffleInPlace(pool, rand)
  let cursor = 0
  const tableau = counts.map(n => {
    const slice = pool.slice(cursor, cursor + n)
    cursor += n
    return slice
  })
  return { wave: { tableau, stock: pool.slice(cursor) } }
}

function applyTableauShuffle({ wave, rand }: SabotageContext): SabotageResult {
  const counts = wave.tableau.map(col => col.length)
  const pool = wave.tableau.flat()
  shuffleInPlace(pool, rand)
  let cursor = 0
  const tableau = counts.map(n => {
    const slice = pool.slice(cursor, cursor + n)
    cursor += n
    return slice
  })
  return { wave: { tableau } }
}

function applyChainPartialDiscard({ wave }: SabotageContext): SabotageResult {
  const removeCount = Math.min(2, Math.max(0, wave.chain.length - 1))
  const removed = wave.chain.slice(0, removeCount)
  return {
    wave: {
      chain: wave.chain.slice(removeCount),
      chainOrigin: wave.chainOrigin.slice(removeCount),
      discardPile: [...wave.discardPile, ...removed],
    },
  }
}

function applyComboReduce({ wave }: SabotageContext): SabotageResult {
  return { wave: { combo: Math.max(0, wave.combo - 3) } }
}

function applyTalismanConfiscate({ run, rand }: SabotageContext): SabotageResult {
  if (run.items.length === 0) return {}
  const idx = Math.floor(rand() * run.items.length)
  return { run: { items: [...run.items.slice(0, idx), ...run.items.slice(idx + 1)] } }
}

function applyRiteConfiscate({ run, rand }: SabotageContext): SabotageResult {
  if (run.rites.length === 0) return {}
  const idx = Math.floor(rand() * run.rites.length)
  return { run: { rites: [...run.rites.slice(0, idx), ...run.rites.slice(idx + 1)] } }
}

function applyChainShuffle({ wave, rand }: SabotageContext): SabotageResult {
  const indices = wave.chain.map((_c, i) => i)
  shuffleInPlace(indices, rand)
  const chain = indices.map(i => wave.chain[i])
  const chainOrigin = indices.map(i => wave.chainOrigin[i])
  return { wave: { chain, chainOrigin, foundation: chain[chain.length - 1] } }
}

function applyComboCap({ wave }: SabotageContext): SabotageResult {
  return { wave: { activeSeal: { kind: 'comboCap', max: wave.combo } } }
}

// 既存のtriggerSabotage実装と同じ理由で、applyRiteEffectが返すactivatedWaveは元のwave.activeSeal
// を引き継ぐため、明示的に`activeSeal: null`で上書きする(riteForceActivateは常に封印を残さない)。
function applyRiteForceActivate({ params, run, wave, rand }: SabotageContext): SabotageResult {
  const usable = run.rites.filter(riteId => canUseRite(params, wave, riteId))
  if (usable.length === 0) return {}
  const target = usable[Math.floor(rand() * usable.length)]
  const activatedWave = applyRiteEffect(params, wave, target, rand)
  const idx = run.rites.indexOf(target)
  return {
    wave: { ...activatedWave, activeSeal: null },
    run: { rites: [...run.rites.slice(0, idx), ...run.rites.slice(idx + 1)] },
  }
}

const SABOTAGE_HANDLERS: Record<SabotageActionId, (ctx: SabotageContext) => SabotageResult> = {
  stockPurge: applyStockPurge,
  columnReturn: applyColumnReturn,
  chainSettle: applyChainSettle,
  comboBreather: applyComboBreather,
  talismanSeal: applyTalismanSeal,
  riteSeal: applyRiteSeal,
  revelationOracleSeal: applyRevelationOracleSeal,
  relicConfiscate: applyRelicConfiscate,
  tableauCardToDiscard: applyTableauCardToDiscard,
  currencyConfiscate: applyCurrencyConfiscate,
  roleSeal: applyRoleSeal,
  stockPurgeSmall: applyStockPurgeSmall,
  stockShuffle: applyStockShuffle,
  tableauFullReturn: applyTableauFullReturn,
  tableauShuffle: applyTableauShuffle,
  chainPartialDiscard: applyChainPartialDiscard,
  chainShuffle: applyChainShuffle,
  comboReduce: applyComboReduce,
  comboCap: applyComboCap,
  talismanConfiscate: applyTalismanConfiscate,
  riteConfiscate: applyRiteConfiscate,
  riteForceActivate: applyRiteForceActivate,
}

export function applySabotageEffect(id: SabotageActionId, ctx: SabotageContext): SabotageResult {
  return SABOTAGE_HANDLERS[id](ctx)
}
```

- [ ] **Step 4: テストを実行しパスすることを確認する**

Run: `npx vitest run src/lib/game/shidasu/sabotageEffects.test.ts`
Expected: PASS

Run: `npm run check`
Expected: エラー無し(この時点では`sabotageEffects.ts`はまだ`engine.ts`から使われていないため、`engine.ts`側の変更は無い)

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/sabotageEffects.ts src/lib/game/shidasu/sabotageEffects.test.ts
git commit -m "refactor: 妨害行動22個の効果をsabotageEffects.tsへ個別関数として切り出す"
```

---

### Task 3: engine.tsのtriggerSabotageを新実装に置き換える

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`

- [ ] **Step 1: triggerSabotageを置き換える**

`src/lib/game/shidasu/engine.ts`冒頭のimport群に追加:

```ts
import { applySabotageEffect } from './sabotageEffects'
```

`src/lib/game/shidasu/engine.ts`の`triggerSabotage`関数(22ケースのswitch文を含む全体、`export function triggerSabotage(...) { ... }`から対応する閉じ`}`まで)を、以下に丸ごと置き換える:

```ts
// 妨害行動を1つ発動させ、効果を適用した上で次の妨害を再抽選する。
// applyPlayCard/applyDrawStock(RunState層)から、wave.sabotageTurnsRemainingが0になった時点で呼ばれる。
// 個々の効果の実装はsabotageEffects.ts(applySabotageEffect)に委譲する。
export function triggerSabotage(params: ShidasuParams, run: RunState, id: SabotageActionId, rand: () => number = Math.random): RunState {
  if (!run.wave) return run
  const wave = run.wave
  const resetWave: WaveState = { ...wave, activeSeal: null }
  const result = applySabotageEffect(id, { params, run, wave, rand })
  const nextWave: WaveState = { ...resetWave, ...result.wave }
  const nextRun: RunState = { ...run, ...result.run, wave: nextWave }

  const star = nextRun.stageStars[nextRun.waveIndex]
  const rolled = rollSabotage(star?.sabotage ?? { kind: 'none' }, rand)
  return { ...nextRun, wave: { ...nextRun.wave, pendingSabotageId: rolled.pendingSabotageId, sabotageTurnsRemaining: rolled.sabotageTurnsRemaining } }
}
```

- [ ] **Step 2: 既存テストスイート全体を実行し、無修正のまま全てグリーンであることを確認する**

Run: `npx vitest run src/lib/game/shidasu`
Expected: 全テストPASS(939件、`engine.test.ts`の`triggerSabotage`関連テストを含め1件も変更していない状態で通ること。これが本リファクタの正しさの根拠)

Run: `npx vitest run`
Expected: 全体(1282件+今回追加した1件)PASS

Run: `npm run check`
Expected: エラー無し

Run: `npm run build`
Expected: エラー無し

- [ ] **Step 3: 開発サーバーで軽く動作確認する**

Run: `npm run dev`

`/game/shidasu`を開き、通常のプレイ操作(カードをクリックする、山札をめくる)が問題なく行えることを確認する(挙動が変わっていないことの簡易確認。妨害行動自体の網羅的な動作確認は前回のセッションで既に実施済みのため、ここでは基本操作が壊れていないことのみ確認すれば十分)。

- [ ] **Step 4: コミット**

```bash
git add src/lib/game/shidasu/engine.ts
git commit -m "refactor: triggerSabotageをsabotageEffects.ts経由のディスパッチに置き換える"
```

---

## 自己レビュー(スペック網羅性チェック)

- 設計書の「新規ファイル: sabotageEffects.ts」「engine.ts側の変更」「resetComboFieldsのexport」は全てTask 1〜3でカバーしている
- 22個全ての効果関数を実装した(設計書の命名規則`apply` + PascalCase(id)と一致)
- `chainSettle`・`riteForceActivate`について、設計書で触れていた「`activeSeal`の明示的な上書きが必要」という注意点をコード中のコメントとして残した
- 循環import回避のための`waveReset.ts`切り出しは設計書には無かった実装上の必要事項だが、Task 1として明示的に追加した
- テストは「既存テストスイートの無修正グリーン」を正しさの根拠とする方針を各タスクで一貫させた

## スコープ外

- Phase B(残り10個)の実装
- 個別`applyXxx`関数への直接ユニットテストの追加
