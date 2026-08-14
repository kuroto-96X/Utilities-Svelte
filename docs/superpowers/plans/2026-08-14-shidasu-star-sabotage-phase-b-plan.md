# 星の妨害行動 Phase B 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 星の妨害行動候補の残り10個(Phase B)を実装し、既存の22個(先行11+Phase A 11)に追加して合計32個にする。加えて、既に実装済みの`riteForceActivate`(秘儀強制発動)を`useRite`直接呼び出し方式に改修する。

**Architecture:** 既存の`sabotageEffects.ts`の`SABOTAGE_HANDLERS: Record<SabotageActionId, Handler>`ディスパッチ基盤をそのまま拡張する。新たに`useRite`/`useRevelation`/`useOracle`(いずれも`engine.ts`定義)を`SabotageContext`へ依存性注入し(循環import回避)、強制発動系の2効果(`riteForceActivate`改修・新規`revelationOracleForceActivate`)がプレイヤーの通常使用と全く同じ処理を実行できるようにする。`activeSeal`(`WaveState`)に新バリアント`talismanHidden`・`roleBias`を追加し、`RunState`に永続フィールド`rewardPenalty`を追加する。

**Tech Stack:** SvelteKit, Svelte 5, TypeScript, Vitest

**設計書:** `docs/superpowers/specs/2026-08-14-shidasu-star-sabotage-phase-b-design.md`

---

## Task 1: SabotageContextへのuseRite/useRevelation/useOracle注入

`riteForceActivate`の改修(Task 2)・`revelationOracleForceActivate`の新規実装(Task 5)はいずれも`engine.ts`の`useRite`/`useRevelation`/`useOracle`をそのまま呼ぶ必要がある。`sabotageEffects.ts`から`engine.ts`を直接importすると、`engine.ts`が既に`sabotageEffects.ts`をimportしているため循環importになる。これを避けるため、`triggerSabotage`(呼び出し元、`engine.ts`)からこの3関数を`SabotageContext`へ値として渡す(依存性注入)。この時点では挙動は一切変わらない(純粋な配線変更)。

**Files:**
- Modify: `src/lib/game/shidasu/sabotageEffects.ts:1-20`
- Modify: `src/lib/game/shidasu/engine.ts:1148-1159`
- Modify: `src/lib/game/shidasu/sabotageEffects.test.ts`

- [ ] **Step 1: `SabotageContext`に3関数フィールドを追加する**

`src/lib/game/shidasu/sabotageEffects.ts`の先頭を以下に置き換える:

```ts
// src/lib/game/shidasu/sabotageEffects.ts
import type { SabotageActionId, WaveState, RunState, Card, HeldRevelationOrOracleRef, RiteId, RevelationId, RelicId, RoleName } from './types'
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
  // riteForceActivate・revelationOracleForceActivate用。engine.tsに定義されているが、
  // sabotageEffects.tsからengine.tsを直接importすると循環importになるため、
  // 呼び出し元(triggerSabotage)から値として注入する。
  useRite: (params: ShidasuParams, run: RunState, riteId: RiteId, rand?: () => number) => RunState
  useRevelation: (
    params: ShidasuParams, run: RunState, revelationId: RevelationId,
    targetCol: number | null, rand?: () => number, targetRelicId?: RelicId | null
  ) => RunState
  useOracle: (params: ShidasuParams, run: RunState, roleName: RoleName) => RunState
}

// wave・runへの差分(部分更新)。両方ともoptional(片方だけ、あるいはどちらも変更しない場合はキー自体を省略する)
export interface SabotageResult {
  wave?: Partial<WaveState>
  run?: Partial<RunState>
}
```

**Step 2: `triggerSabotage`が3関数を渡すように変更する**

`src/lib/game/shidasu/engine.ts:1148-1159`の`triggerSabotage`関数内、以下の行を:

```ts
  const result = applySabotageEffect(id, { params, run, wave, rand })
```

以下に置き換える:

```ts
  const result = applySabotageEffect(id, { params, run, wave, rand, useRite, useRevelation, useOracle })
```

(`useRite`・`useRevelation`・`useOracle`は同じ`engine.ts`内で既に定義済みの関数であり、追加のimportは不要。)

**Step 3: `sabotageEffects.test.ts`のctx構築を更新する**

`src/lib/game/shidasu/sabotageEffects.test.ts`全体を以下に置き換える:

```ts
import { describe, it, expect } from 'vitest'
import { applySabotageEffect } from './sabotageEffects'
import { SABOTAGE_POOL } from './sabotage'
import { createInitialRun, startWave, useRite, useRevelation, useOracle } from './engine'
import { DEFAULT_PARAMS } from './params'
import { defaultOracleLevels } from './oracles'

describe('applySabotageEffect', () => {
  it('SABOTAGE_POOL全件のidに対して、例外を投げずに結果を返す', () => {
    // createInitialRun/startWaveで実際に使われるのと同じ形の、正規のRunState/WaveStateを
    // 用意する(手組みのダミーオブジェクトだとchainSettleがresetComboFields内でparams.talismans
    // 等を参照して例外になるなど、フィールド不足による誤検出を招くため)。
    // 所持品は全て空スタートだが、対象0件のケースは各ハンドラが早期returnで{}を返す設計なので
    // 例外なく完走する(全件のディスパッチ経路が揃っているかを見るだけのテストで十分)。
    const run = createInitialRun()
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, run.items, run.deckComposition, 1, 0, defaultOracleLevels())
    for (const action of SABOTAGE_POOL) {
      expect(() =>
        applySabotageEffect(action.id, { params: DEFAULT_PARAMS, run, wave, rand: () => 0, useRite, useRevelation, useOracle })
      ).not.toThrow()
    }
  })
})
```

(件数の固定値チェックを外し、`SABOTAGE_POOL`の実際の長さに追従するようにした。件数そのものは`sabotage.test.ts`側で検証する。)

- [ ] **Step 4: 型チェックを実行する**

Run: `npm run check`
Expected: エラー無し

- [ ] **Step 5: テストを実行する**

Run: `npx vitest run src/lib/game/shidasu/sabotageEffects.test.ts src/lib/game/shidasu/engine.test.ts`
Expected: 全件PASS(既存テストに挙動変化は無いはず)

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/sabotageEffects.ts src/lib/game/shidasu/engine.ts src/lib/game/shidasu/sabotageEffects.test.ts
git commit -m "refactor: SabotageContextにuseRite/useRevelation/useOracleを注入する"
```

---

## Task 2: riteForceActivateをuseRite呼び出しに改修

Phase A時点の`riteForceActivate`は`applyRiteEffect`を直接呼び、果断・星霜の加算・`recentUsedRiteIds`の更新を意図的にスキップしていた。「強制発動はプレイヤー操作を介さず通常使用と全く同じ処理を実行する」という統一方針に合わせ、`useRite`をそのまま呼ぶ方式に変更する。挙動変化: 秘儀強制発動でも果断・星霜が加算され、秘儀回帰の履歴(`recentUsedRiteIds`)にも残るようになる。

**Files:**
- Modify: `src/lib/game/shidasu/sabotageEffects.ts`(`applyRiteForceActivate`)
- Modify: `src/lib/game/shidasu/engine.test.ts`(既存の`riteForceActivate`テストを更新)

- [ ] **Step 1: 既存テストを新しい期待値に書き換える(失敗させる)**

`src/lib/game/shidasu/engine.test.ts`内の`riteForceActivate: 使用可能な秘儀からランダムに1つ選び即座に発動して消費する`テスト(5066-5077行目付近)を、以下に置き換える:

```ts
  it('riteForceActivate: 使用可能な秘儀からランダムに1つ選び即座に発動して消費する(useRiteと同じ結果になる)', () => {
    const run = runWithWave({ items: ['discretion'], rites: ['raidho'] })
    // raidhoは場札に非絵札・非ワイルドがあれば常にcanUseRiteを満たす(dealされた標準デッキなら通常存在する)
    const beforeStockIds = run.wave!.stock.map(c => c.id).sort((a, b) => a - b)
    const beforeDiscretionN = run.wave!.discretionN
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'riteForceActivate', () => 0)
    expect(next.rites).toEqual([])
    // 秘儀の消費だけでなく、raidhoの効果(場札の非絵札・非ワイルドを山札と入れ替える)が
    // 実際にwaveへ適用されたことも確認する(riteConfiscateのようにidだけ消して効果が
    // 適用されないまま、という不具合を検出するため)
    const afterStockIds = next.wave!.stock.map(c => c.id).sort((a, b) => a - b)
    expect(afterStockIds).not.toEqual(beforeStockIds)
    // useRite経由になったため、果断(discretion)所持時は星霜Nが加算される
    expect(next.wave!.discretionN).toBeGreaterThan(beforeDiscretionN)
    // 秘儀回帰の履歴にも残る
    expect(next.recentUsedRiteIds).toEqual(['raidho'])
  })
```

- [ ] **Step 2: テストを実行し、失敗することを確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "riteForceActivate"`
Expected: FAIL(`next.wave!.discretionN`が加算されていない・`next.recentUsedRiteIds`が空のまま)

- [ ] **Step 3: `applyRiteForceActivate`を`useRite`呼び出しに書き換える**

`src/lib/game/shidasu/sabotageEffects.ts`内、以下の関数(コメント含む)を:

```ts
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
```

以下に置き換える:

```ts
// useRiteが返す完全なRunStateには変更後のwaveも含まれる(果断・星霜の加算・recentUsedRiteIds
// の更新も含めて、通常の秘儀使用と全く同じ処理をそのまま適用する)。useRiteはwave.activeSealを
// 引き継いだままの`wave`をベースに効果を適用するため、返ってきたwaveのactiveSealを明示的に
// nullで上書きする(riteForceActivateは常に封印を残さない、既存のtriggerSabotage全体の設計と同じ理由)。
// runにはused(useRiteが返す完全なRunState)をそのまま渡す。used.waveはtriggerSabotage側の
// 合成処理で最終的にnextWaveに上書きされるため無害。
function applyRiteForceActivate({ params, run, wave, rand, useRite }: SabotageContext): SabotageResult {
  const usable = run.rites.filter(riteId => canUseRite(params, wave, riteId))
  if (usable.length === 0) return {}
  const target = usable[Math.floor(rand() * usable.length)]
  const used = useRite(params, run, target, rand)
  return { wave: { ...used.wave!, activeSeal: null }, run: used }
}
```

`applyRiteEffect`のimportが不要になったため、ファイル先頭のimportを:

```ts
import { applyRiteEffect, canUseRite } from './riteEffects'
```

以下に置き換える:

```ts
import { canUseRite } from './riteEffects'
```

- [ ] **Step 4: テストを実行し、成功することを確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "riteForceActivate"`
Expected: 全件PASS

- [ ] **Step 5: 型チェックとフルテストスイートを実行する**

Run: `npm run check`
Expected: エラー無し

Run: `npx vitest run`
Expected: 全件PASS

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/sabotageEffects.ts src/lib/game/shidasu/engine.test.ts
git commit -m "fix: riteForceActivateをuseRite呼び出しに改修し、果断・星霜・秘儀回帰の履歴も通常使用と同じ処理にする"
```

---

## Task 3: talismanShuffle(護符並び替え)

護符の並び順をシャッフルし、次の妨害発動まで護符を裏向き表示にする。`activeSeal`に新バリアント`talismanHidden`を追加する。

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`(`SabotageActionId`・`activeSeal`)
- Modify: `src/lib/game/shidasu/sabotage.ts`(`SABOTAGE_POOL`)
- Modify: `src/lib/game/shidasu/sabotageEffects.ts`(`applyTalismanShuffle`・`SABOTAGE_HANDLERS`)
- Modify: `src/lib/game/shidasu/sabotage.test.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`
- Modify: `src/routes/game/shidasu/+page.svelte`(裏向き表示)

- [ ] **Step 1: `sabotage.test.ts`の件数を23件に更新する(失敗させる)**

`src/lib/game/shidasu/sabotage.test.ts`の以下の行:

```ts
  it('22件・ID重複無し・intervalTurnsが全て正の整数', () => {
    expect(SABOTAGE_POOL).toHaveLength(22)
    const ids = SABOTAGE_POOL.map(a => a.id)
    expect(new Set(ids).size).toBe(22)
```

を以下に置き換える:

```ts
  it('23件・ID重複無し・intervalTurnsが全て正の整数', () => {
    expect(SABOTAGE_POOL).toHaveLength(23)
    const ids = SABOTAGE_POOL.map(a => a.id)
    expect(new Set(ids).size).toBe(23)
```

- [ ] **Step 2: `triggerSabotage`経由のテストを追加する(失敗させる)**

`src/lib/game/shidasu/engine.test.ts`の`describe('triggerSabotage', ...)`ブロック末尾(`効果適用後、activeSealは一旦nullにリセットされてから今回の効果が反映される`テストの直後、5108行目`})`の直前)に追加する:

```ts

  it('talismanShuffle: 護符の並び順をシャッフルし、次の妨害発動までtalismanHidden封印にする', () => {
    const run = runWithWave({ items: ['bridge', 'grace', 'golden'] })
    let call = 0
    const rand = () => {
      const values = [0, 0.9, 0]
      return values[call++] ?? 0
    }
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'talismanShuffle', rand)
    // 3枚とも欠落・重複無く残っていること
    expect([...next.items].sort()).toEqual(['bridge', 'golden', 'grace'])
    // 実際に並びが変わっていること(no-op実装を弾くための検証)
    expect(next.items).not.toEqual(['bridge', 'grace', 'golden'])
    expect(next.wave!.activeSeal).toEqual({ kind: 'talismanHidden' })
  })

  it('talismanShuffle: 所持護符が0件でもactiveSealは設定される(シャッフル対象が無いだけ)', () => {
    const run = runWithWave({ items: [] })
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'talismanShuffle', () => 0)
    expect(next.items).toEqual([])
    expect(next.wave!.activeSeal).toEqual({ kind: 'talismanHidden' })
  })
```

- [ ] **Step 3: テストを実行し、失敗することを確認する**

Run: `npx vitest run src/lib/game/shidasu/sabotage.test.ts src/lib/game/shidasu/engine.test.ts -t "talismanShuffle"`
Expected: FAIL(`talismanShuffle`が存在しない)

- [ ] **Step 4: `SabotageActionId`に`talismanShuffle`を追加する**

`src/lib/game/shidasu/types.ts:7-13`の`SabotageActionId`定義:

```ts
export type SabotageActionId =
  | 'stockPurge' | 'columnReturn' | 'chainSettle' | 'comboBreather'
  | 'talismanSeal' | 'riteSeal' | 'revelationOracleSeal' | 'relicConfiscate'
  | 'tableauCardToDiscard' | 'currencyConfiscate' | 'roleSeal'
  | 'stockPurgeSmall' | 'stockShuffle' | 'tableauFullReturn' | 'tableauShuffle'
  | 'chainPartialDiscard' | 'chainShuffle' | 'comboReduce' | 'comboCap'
  | 'talismanConfiscate' | 'riteConfiscate' | 'riteForceActivate'
```

を以下に置き換える:

```ts
export type SabotageActionId =
  | 'stockPurge' | 'columnReturn' | 'chainSettle' | 'comboBreather'
  | 'talismanSeal' | 'riteSeal' | 'revelationOracleSeal' | 'relicConfiscate'
  | 'tableauCardToDiscard' | 'currencyConfiscate' | 'roleSeal'
  | 'stockPurgeSmall' | 'stockShuffle' | 'tableauFullReturn' | 'tableauShuffle'
  | 'chainPartialDiscard' | 'chainShuffle' | 'comboReduce' | 'comboCap'
  | 'talismanConfiscate' | 'riteConfiscate' | 'riteForceActivate'
  | 'talismanShuffle'
```

**Step 5: `activeSeal`に`talismanHidden`バリアントを追加する**

`src/lib/game/shidasu/types.ts:288-294`の`activeSeal`定義:

```ts
  activeSeal:
    | { kind: 'talisman'; id: ItemId }
    | { kind: 'rite'; id: RiteId }
    | { kind: 'revelationOrOracle'; ref: HeldRevelationOrOracleRef }
    | { kind: 'role'; names: RoleName[] }
    | { kind: 'comboCap'; max: number }
    | null
```

を以下に置き換える:

```ts
  activeSeal:
    | { kind: 'talisman'; id: ItemId }
    | { kind: 'rite'; id: RiteId }
    | { kind: 'revelationOrOracle'; ref: HeldRevelationOrOracleRef }
    | { kind: 'role'; names: RoleName[] }
    | { kind: 'comboCap'; max: number }
    | { kind: 'talismanHidden' }
    | null
```

- [ ] **Step 6: `SABOTAGE_POOL`にエントリを追加する**

`src/lib/game/shidasu/sabotage.ts`の`SABOTAGE_POOL`配列末尾、`riteForceActivate`のエントリの直後に追加する:

```ts
  { id: 'talismanShuffle', name: '護符並び替え', target: '護符', intervalTurns: 5, descTemplate: '所持護符の並び順をランダムにシャッフルし、次の妨害発動まで護符を裏向き表示にする' },
```

(ファイル冒頭のコメント`// 妨害行動プール。22件(...)`の件数更新は、Phase Bの全10個を追加し終えるTask 10でまとめて行う。)

- [ ] **Step 7: `applyTalismanShuffle`を実装し`SABOTAGE_HANDLERS`に登録する**

`src/lib/game/shidasu/sabotageEffects.ts`の`applyRiteForceActivate`関数の直後に追加する:

```ts

function applyTalismanShuffle({ run, rand }: SabotageContext): SabotageResult {
  const items = [...run.items]
  shuffleInPlace(items, rand)
  return { run: { items }, wave: { activeSeal: { kind: 'talismanHidden' } } }
}
```

`SABOTAGE_HANDLERS`の`riteForceActivate: applyRiteForceActivate,`の直後に追加する:

```ts
  talismanShuffle: applyTalismanShuffle,
```

- [ ] **Step 8: テストを実行し、成功することを確認する**

Run: `npx vitest run src/lib/game/shidasu/sabotage.test.ts src/lib/game/shidasu/engine.test.ts src/lib/game/shidasu/sabotageEffects.test.ts`
Expected: 全件PASS

- [ ] **Step 9: UI側に裏向き表示を追加する**

`src/routes/game/shidasu/+page.svelte`の`itemBadges`スニペット(588-597行目付近):

```svelte
{#snippet itemBadges()}
  <div class="flex-1 flex flex-col gap-1 items-end">
    <div class="flex flex-wrap gap-1 justify-end">
      {#each [...new Set(run.items)] as id (id)}
        {@const n = run.items.filter(x => x === id).length}
        <span class="text-xs bg-emerald-900 text-yellow-200/90 border border-yellow-600/40 rounded px-1.5 py-0.5 {highlightedItemId === id ? 'ring-2 ring-yellow-400' : ''}" title={itemDesc(id, params)}>
          {itemName(id, params)}{n > 1 ? `×${n}` : ''}
        </span>
      {/each}
    </div>
```

を以下に置き換える:

```svelte
{#snippet itemBadges()}
  <div class="flex-1 flex flex-col gap-1 items-end">
    <div class="flex flex-wrap gap-1 justify-end">
      {#each [...new Set(run.items)] as id (id)}
        {@const n = run.items.filter(x => x === id).length}
        {@const talismanHidden = wave?.activeSeal?.kind === 'talismanHidden'}
        <span class="text-xs bg-emerald-900 text-yellow-200/90 border border-yellow-600/40 rounded px-1.5 py-0.5 {highlightedItemId === id ? 'ring-2 ring-yellow-400' : ''}" title={talismanHidden ? '護符並び替え: 次の妨害発動まで内容が見えない' : itemDesc(id, params)}>
          {talismanHidden ? '？？？' : itemName(id, params)}{n > 1 ? `×${n}` : ''}
        </span>
      {/each}
    </div>
```

(`wave`は同ファイル103行目で`let wave = $derived(run.wave)`として既に定義済み。所持護符の並べ替え・売却UI(913-933行目、ショップ画面用)は`wave`が存在しないshopフェーズで表示されるため対象外とする。)

- [ ] **Step 10: 開発サーバーで目視確認する**

Run: `npm run dev`

ブラウザで `http://localhost:5173/game/shidasu` を開き、護符を複数所持した状態でプレイを進め、`talismanShuffle`(または任意の妨害、`DebugPanel`があれば強制発動)が発動した際に護符バッジが「？？？」表示になることを確認する。次の妨害が発動すると通常表示に戻ることも確認する。

- [ ] **Step 11: 型チェックを実行する**

Run: `npm run check`
Expected: エラー無し

- [ ] **Step 12: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/sabotage.ts src/lib/game/shidasu/sabotageEffects.ts src/lib/game/shidasu/sabotage.test.ts src/lib/game/shidasu/engine.test.ts src/routes/game/shidasu/+page.svelte
git commit -m "feat: 星の妨害行動に護符並び替え(talismanShuffle)を追加"
```

---

## Task 4: revelationOracleConfiscate(天啓・神託没収)

所持している天啓または神託からランダムに1つ選び、完全に失わせる。神託が対象になった場合も`oracleLevels`は変更しない(`run.oracles`に温存中の神託はまだ`useOracle`で消費していないため、`oracleLevels`に反映されていない)。

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`(`SabotageActionId`)
- Modify: `src/lib/game/shidasu/sabotage.ts`(`SABOTAGE_POOL`)
- Modify: `src/lib/game/shidasu/sabotageEffects.ts`(`applyRevelationOracleConfiscate`・`SABOTAGE_HANDLERS`)
- Modify: `src/lib/game/shidasu/sabotage.test.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: `sabotage.test.ts`の件数を24件に更新する**

`src/lib/game/shidasu/sabotage.test.ts`の`23件`を`24件`に(件数の文言・`toHaveLength(23)`→`toHaveLength(24)`・`.size).toBe(23)`→`.size).toBe(24)`)更新する。

- [ ] **Step 2: `triggerSabotage`経由のテストを追加する(失敗させる)**

`src/lib/game/shidasu/engine.test.ts`の`talismanShuffle`テストの直後に追加する:

```ts

  it('revelationOracleConfiscate: 所持天啓・神託からランダムに1つ選び完全に失わせる(天啓が選ばれた場合)', () => {
    const run = runWithWave({ revelations: ['kaku'], oracles: ['pair'] })
    // rand()=0固定でMath.floor(rand()*pool.length)は常に0番目(天啓kaku)を選ぶ
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'revelationOracleConfiscate', () => 0)
    expect(next.revelations).toEqual([])
    expect(next.oracles).toEqual(['pair'])
  })

  it('revelationOracleConfiscate: 神託が選ばれた場合、oracleLevelsは変更しない', () => {
    const run = runWithWave({ revelations: [], oracles: ['pair'] })
    const beforeLevel = run.oracleLevels.pair
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'revelationOracleConfiscate', () => 0)
    expect(next.oracles).toEqual([])
    expect(next.oracleLevels.pair).toBe(beforeLevel)
  })

  it('revelationOracleConfiscate: 天啓・神託とも0件なら何も起きない', () => {
    const run = runWithWave({ revelations: [], oracles: [] })
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'revelationOracleConfiscate', () => 0)
    expect(next.revelations).toEqual([])
    expect(next.oracles).toEqual([])
  })
```

- [ ] **Step 3: テストを実行し、失敗することを確認する**

Run: `npx vitest run src/lib/game/shidasu/sabotage.test.ts src/lib/game/shidasu/engine.test.ts -t "revelationOracleConfiscate"`
Expected: FAIL(`revelationOracleConfiscate`が存在しない)

- [ ] **Step 4: `SabotageActionId`に追加する**

`src/lib/game/shidasu/types.ts`の`SabotageActionId`定義末尾`| 'talismanShuffle'`を以下に置き換える:

```ts
  | 'talismanShuffle' | 'revelationOracleConfiscate'
```

- [ ] **Step 5: `SABOTAGE_POOL`にエントリを追加する**

`src/lib/game/shidasu/sabotage.ts`の`talismanShuffle`エントリの直後に追加する:

```ts
  { id: 'revelationOracleConfiscate', name: '天啓・神託没収', target: '天啓・神託', intervalTurns: 7, descTemplate: '所持している天啓または神託からランダムに1つ選び、完全に失わせる' },
```

- [ ] **Step 6: `applyRevelationOracleConfiscate`を実装し登録する**

`src/lib/game/shidasu/sabotageEffects.ts`の`applyTalismanShuffle`関数の直後に追加する:

```ts

function applyRevelationOracleConfiscate({ run, rand }: SabotageContext): SabotageResult {
  const pool: HeldRevelationOrOracleRef[] = [
    ...run.revelations.map(id => ({ kind: 'revelation' as const, id })),
    ...run.oracles.map(id => ({ kind: 'oracle' as const, id })),
  ]
  if (pool.length === 0) return {}
  const ref = pool[Math.floor(rand() * pool.length)]
  if (ref.kind === 'revelation') {
    const idx = run.revelations.indexOf(ref.id)
    return { run: { revelations: [...run.revelations.slice(0, idx), ...run.revelations.slice(idx + 1)] } }
  }
  const idx = run.oracles.indexOf(ref.id)
  return { run: { oracles: [...run.oracles.slice(0, idx), ...run.oracles.slice(idx + 1)] } }
}
```

`SABOTAGE_HANDLERS`の`talismanShuffle: applyTalismanShuffle,`の直後に追加する:

```ts
  revelationOracleConfiscate: applyRevelationOracleConfiscate,
```

- [ ] **Step 7: テストを実行し、成功することを確認する**

Run: `npx vitest run src/lib/game/shidasu/sabotage.test.ts src/lib/game/shidasu/engine.test.ts src/lib/game/shidasu/sabotageEffects.test.ts`
Expected: 全件PASS

- [ ] **Step 8: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/sabotage.ts src/lib/game/shidasu/sabotageEffects.ts src/lib/game/shidasu/sabotage.test.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 星の妨害行動に天啓・神託没収(revelationOracleConfiscate)を追加"
```

---

## Task 5: revelationOracleForceActivate(天啓・神託強制発動)

使用可能な天啓+所持神託の合算プールからランダムに1つ選び、プレイヤーの操作を介さず`useRevelation`/`useOracle`をそのまま呼んで即座に効果を発動・消費する。

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`(`SabotageActionId`)
- Modify: `src/lib/game/shidasu/sabotage.ts`(`SABOTAGE_POOL`)
- Modify: `src/lib/game/shidasu/sabotageEffects.ts`(`applyRevelationOracleForceActivate`・`SABOTAGE_HANDLERS`・import)
- Modify: `src/lib/game/shidasu/sabotage.test.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: `sabotage.test.ts`の件数を25件に更新する**

`24件`を`25件`に(`toHaveLength(24)`→`(25)`・`.size).toBe(24)`→`(25)`)更新する。

- [ ] **Step 2: `triggerSabotage`経由のテストを追加する(失敗させる)**

`src/lib/game/shidasu/engine.test.ts`の`revelationOracleConfiscate`テストの直後に追加する:

```ts

  it('revelationOracleForceActivate: 神託が選ばれた場合、useOracleと同じ結果(oracleLevels加算・oraclesから除外)になる', () => {
    const run = runWithWave({ revelations: [], oracles: ['pair'] })
    const beforeLevel = run.oracleLevels.pair
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'revelationOracleForceActivate', () => 0)
    expect(next.oracles).toEqual([])
    expect(next.oracleLevels.pair).toBe(beforeLevel + 1)
    expect(next.wave!.oracleLevels.pair).toBe(beforeLevel + 1)
  })

  it('revelationOracleForceActivate: 列選択を要する天啓が選ばれた場合、ランダムな列に効果を適用する', () => {
    const run = runWithWave({ revelations: ['kaku'], oracles: [] })
    const before = run.wave!.tableau.map(col => col.map(c => c.suit))
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'revelationOracleForceActivate', () => 0)
    expect(next.revelations).toEqual([])
    const after = next.wave!.tableau.map(col => col.map(c => c.suit))
    // kaku(列を♠化)の効果が実際に場札へ適用されていること(idだけ消して効果無し、を弾く)
    expect(after).not.toEqual(before)
  })

  it('revelationOracleForceActivate: 使用可能な天啓も所持神託も無ければ何も起きない', () => {
    const run = runWithWave({ revelations: [], oracles: [] })
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'revelationOracleForceActivate', () => 0)
    expect(next.revelations).toEqual([])
    expect(next.oracles).toEqual([])
    expect(next.wave!.activeSeal).toBeNull()
  })
```

- [ ] **Step 3: テストを実行し、失敗することを確認する**

Run: `npx vitest run src/lib/game/shidasu/sabotage.test.ts src/lib/game/shidasu/engine.test.ts -t "revelationOracleForceActivate"`
Expected: FAIL(`revelationOracleForceActivate`が存在しない)

- [ ] **Step 4: `SabotageActionId`に追加する**

`src/lib/game/shidasu/types.ts`の`| 'talismanShuffle' | 'revelationOracleConfiscate'`を以下に置き換える:

```ts
  | 'talismanShuffle' | 'revelationOracleConfiscate' | 'revelationOracleForceActivate'
```

- [ ] **Step 5: `SABOTAGE_POOL`にエントリを追加する**

`src/lib/game/shidasu/sabotage.ts`の`revelationOracleConfiscate`エントリの直後に追加する:

```ts
  { id: 'revelationOracleForceActivate', name: '天啓・神託強制発動', target: '天啓・神託', intervalTurns: 6, descTemplate: '使用可能な天啓または所持神託からランダムに1つ選び、即座に効果を発動させて消費する' },
```

- [ ] **Step 6: `canUseRevelation`・`revelationNeedsTarget`をimportする**

`src/lib/game/shidasu/sabotageEffects.ts`先頭のimport群、`import { canUseRite } from './riteEffects'`の直後に追加する:

```ts
import { canUseRevelation, revelationNeedsTarget } from './revelationEffects'
```

- [ ] **Step 7: `applyRevelationOracleForceActivate`を実装し登録する**

`applyRevelationOracleConfiscate`関数の直後に追加する:

```ts

// useRevelation/useOracleが返す完全なRunStateをそのままrunへ渡す(applyRiteForceActivateと同じ理由:
// grantRevelationReward等が天啓の種類によって動的に返す報酬フィールドを個別に列挙せずに済む)。
function applyRevelationOracleForceActivate({ params, run, wave, rand, useRevelation, useOracle }: SabotageContext): SabotageResult {
  const usableRevelations = run.revelations.filter(id => canUseRevelation(params, wave, id, run.relics))
  const pool: HeldRevelationOrOracleRef[] = [
    ...usableRevelations.map(id => ({ kind: 'revelation' as const, id })),
    ...run.oracles.map(id => ({ kind: 'oracle' as const, id })),
  ]
  if (pool.length === 0) return {}
  const ref = pool[Math.floor(rand() * pool.length)]
  if (ref.kind === 'oracle') {
    const used = useOracle(params, run, ref.id)
    return { wave: { ...used.wave!, activeSeal: null }, run: used }
  }
  const targetCol = revelationNeedsTarget(ref.id) ? Math.floor(rand() * wave.tableau.length) : null
  const used = useRevelation(params, run, ref.id, targetCol, rand)
  return { wave: { ...used.wave!, activeSeal: null }, run: used }
}
```

`SABOTAGE_HANDLERS`の`revelationOracleConfiscate: applyRevelationOracleConfiscate,`の直後に追加する:

```ts
  revelationOracleForceActivate: applyRevelationOracleForceActivate,
```

- [ ] **Step 8: テストを実行し、成功することを確認する**

Run: `npx vitest run src/lib/game/shidasu/sabotage.test.ts src/lib/game/shidasu/engine.test.ts src/lib/game/shidasu/sabotageEffects.test.ts`
Expected: 全件PASS

- [ ] **Step 9: 型チェックを実行する**

Run: `npm run check`
Expected: エラー無し

- [ ] **Step 10: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/sabotage.ts src/lib/game/shidasu/sabotageEffects.ts src/lib/game/shidasu/sabotage.test.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 星の妨害行動に天啓・神託強制発動(revelationOracleForceActivate)を追加"
```

---

## Task 6: tsukumokaRelease(付喪化解除)

付喪化済みレリックがあればランダムに1つ選び、未付喪化状態に戻す。

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`(`SabotageActionId`)
- Modify: `src/lib/game/shidasu/sabotage.ts`(`SABOTAGE_POOL`)
- Modify: `src/lib/game/shidasu/sabotageEffects.ts`(`applyTsukumokaRelease`・`SABOTAGE_HANDLERS`)
- Modify: `src/lib/game/shidasu/sabotage.test.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: `sabotage.test.ts`の件数を26件に更新する**

`25件`を`26件`に更新する。

- [ ] **Step 2: `triggerSabotage`経由のテストを追加する(失敗させる)**

`src/lib/game/shidasu/engine.test.ts`の`revelationOracleForceActivate`テストの直後に追加する:

```ts

  it('tsukumokaRelease: 付喪化済みレリックがあればランダムに1つ選び未付喪化に戻す', () => {
    const run = runWithWave({ relics: [{ id: 'kumade', tsukumoka: true }, { id: 'fukuzasa', tsukumoka: false }] })
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'tsukumokaRelease', () => 0)
    expect(next.relics).toEqual([{ id: 'kumade', tsukumoka: false }, { id: 'fukuzasa', tsukumoka: false }])
  })

  it('tsukumokaRelease: 付喪化済みレリックが無ければ何も起きない', () => {
    const run = runWithWave({ relics: [{ id: 'fukuzasa', tsukumoka: false }] })
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'tsukumokaRelease', () => 0)
    expect(next.relics).toEqual([{ id: 'fukuzasa', tsukumoka: false }])
  })
```

- [ ] **Step 3: テストを実行し、失敗することを確認する**

Run: `npx vitest run src/lib/game/shidasu/sabotage.test.ts src/lib/game/shidasu/engine.test.ts -t "tsukumokaRelease"`
Expected: FAIL(`tsukumokaRelease`が存在しない)

- [ ] **Step 4: `SabotageActionId`に追加する**

`| 'talismanShuffle' | 'revelationOracleConfiscate' | 'revelationOracleForceActivate'`を以下に置き換える:

```ts
  | 'talismanShuffle' | 'revelationOracleConfiscate' | 'revelationOracleForceActivate' | 'tsukumokaRelease'
```

- [ ] **Step 5: `SABOTAGE_POOL`にエントリを追加する**

`revelationOracleForceActivate`エントリの直後に追加する:

```ts
  { id: 'tsukumokaRelease', name: '付喪化解除', target: 'レリック', intervalTurns: 6, descTemplate: '付喪化済みレリックがあればランダムに1つ選び、未付喪化状態に戻す' },
```

- [ ] **Step 6: `applyTsukumokaRelease`を実装し登録する**

`applyRevelationOracleForceActivate`関数の直後に追加する:

```ts

function applyTsukumokaRelease({ run, rand }: SabotageContext): SabotageResult {
  const tsukumokaRelics = run.relics.filter(r => r.tsukumoka)
  if (tsukumokaRelics.length === 0) return {}
  const target = tsukumokaRelics[Math.floor(rand() * tsukumokaRelics.length)]
  const relics = run.relics.map(r => (r.id === target.id ? { ...r, tsukumoka: false } : r))
  return { run: { relics } }
}
```

`SABOTAGE_HANDLERS`の`revelationOracleForceActivate: applyRevelationOracleForceActivate,`の直後に追加する:

```ts
  tsukumokaRelease: applyTsukumokaRelease,
```

- [ ] **Step 7: テストを実行し、成功することを確認する**

Run: `npx vitest run src/lib/game/shidasu/sabotage.test.ts src/lib/game/shidasu/engine.test.ts src/lib/game/shidasu/sabotageEffects.test.ts`
Expected: 全件PASS

- [ ] **Step 8: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/sabotage.ts src/lib/game/shidasu/sabotageEffects.ts src/lib/game/shidasu/sabotage.test.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 星の妨害行動に付喪化解除(tsukumokaRelease)を追加"
```

---

## Task 7: discardErase・discardBury(捨て札消去・捨て札埋没)

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`(`SabotageActionId`)
- Modify: `src/lib/game/shidasu/sabotage.ts`(`SABOTAGE_POOL`)
- Modify: `src/lib/game/shidasu/sabotageEffects.ts`(`applyDiscardErase`・`applyDiscardBury`・`SABOTAGE_HANDLERS`)
- Modify: `src/lib/game/shidasu/sabotage.test.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: `sabotage.test.ts`の件数を28件に更新する**

`26件`を`28件`に更新する。

- [ ] **Step 2: `triggerSabotage`経由のテストを追加する(失敗させる)**

`src/lib/game/shidasu/engine.test.ts`の`tsukumokaRelease`テストの直後に追加する:

```ts

  it('discardErase: チェーンを捨て札に送り、捨て札全体をシャッフルしてから同じ枚数をチェーンに戻す', () => {
    const chain: Card[] = [
      { id: 1, deckId: 1, suit: '♠', rank: 1, wild: false },
      { id: 2, deckId: 2, suit: '♥', rank: 2, wild: false },
    ]
    const discardPile: Card[] = [
      { id: 3, deckId: 3, suit: '♦', rank: 3, wild: false },
      { id: 4, deckId: 4, suit: '♣', rank: 4, wild: false },
    ]
    const run = runWithWave({}, { chain, chainOrigin: ['draw', 'play'], discardPile, foundation: chain[1] })
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'discardErase', () => 0)
    // チェーン・捨て札の合計4枚が欠落・重複無く保たれていること
    expect(next.wave!.chain).toHaveLength(2)
    expect(next.wave!.discardPile).toHaveLength(2)
    const allIds = [...next.wave!.chain, ...next.wave!.discardPile].map(c => c.id).sort()
    expect(allIds).toEqual([1, 2, 3, 4])
    // 再構成後のchainOriginは全て'draw'扱いになる
    expect(next.wave!.chainOrigin).toEqual(['draw', 'draw'])
    // 新しい末尾が基準カードになる
    const newLast = next.wave!.chain[next.wave!.chain.length - 1]
    expect(next.wave!.foundation.id).toBe(newLast.id)
  })

  it('discardBury: 捨て札を山札に混ぜ込み、同じ枚数を山札から捨て札に移す(場札・チェーンは不変)', () => {
    const stock: Card[] = [
      { id: 1, deckId: 1, suit: '♠', rank: 1, wild: false },
      { id: 2, deckId: 2, suit: '♥', rank: 2, wild: false },
      { id: 3, deckId: 3, suit: '♦', rank: 3, wild: false },
    ]
    const discardPile: Card[] = [{ id: 4, deckId: 4, suit: '♣', rank: 4, wild: false }]
    const run = runWithWave({}, { stock, discardPile })
    const beforeTableau = run.wave!.tableau
    const beforeChain = run.wave!.chain
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'discardBury', () => 0)
    expect(next.wave!.discardPile).toHaveLength(1)
    expect(next.wave!.stock).toHaveLength(3)
    const allIds = [...next.wave!.stock, ...next.wave!.discardPile].map(c => c.id).sort()
    expect(allIds).toEqual([1, 2, 3, 4])
    expect(next.wave!.tableau).toBe(beforeTableau)
    expect(next.wave!.chain).toBe(beforeChain)
  })
```

- [ ] **Step 3: テストを実行し、失敗することを確認する**

Run: `npx vitest run src/lib/game/shidasu/sabotage.test.ts src/lib/game/shidasu/engine.test.ts -t "discard"`
Expected: FAIL(`discardErase`・`discardBury`が存在しない)

- [ ] **Step 4: `SabotageActionId`に追加する**

`| 'talismanShuffle' | 'revelationOracleConfiscate' | 'revelationOracleForceActivate' | 'tsukumokaRelease'`を以下に置き換える:

```ts
  | 'talismanShuffle' | 'revelationOracleConfiscate' | 'revelationOracleForceActivate' | 'tsukumokaRelease'
  | 'discardErase' | 'discardBury'
```

- [ ] **Step 5: `SABOTAGE_POOL`にエントリを追加する**

`tsukumokaRelease`エントリの直後に追加する:

```ts
  { id: 'discardErase', name: '捨て札消去', target: '捨て札', intervalTurns: 6, descTemplate: 'チェーンのカードを捨て札に送り、捨て札全体をシャッフルしてから同じ枚数をチェーンに戻す' },
  { id: 'discardBury', name: '捨て札埋没', target: '捨て札', intervalTurns: 5, descTemplate: '捨て札の中身を山札に戻し混ぜ込み、同じ枚数を山札から裏向きで捨て札に移す' },
```

- [ ] **Step 6: `applyDiscardErase`・`applyDiscardBury`を実装し登録する**

`applyTsukumokaRelease`関数の直後に追加する:

```ts

function applyDiscardErase({ wave, rand }: SabotageContext): SabotageResult {
  const chainCount = wave.chain.length
  const pool = [...wave.discardPile, ...wave.chain]
  shuffleInPlace(pool, rand)
  const chain = pool.slice(0, chainCount)
  const discardPile = pool.slice(chainCount)
  const chainOrigin = chain.map(() => 'draw' as const)
  return { wave: { chain, chainOrigin, discardPile, foundation: chain[chain.length - 1] } }
}

function applyDiscardBury({ wave, rand }: SabotageContext): SabotageResult {
  const n = wave.discardPile.length
  const pool = [...wave.stock, ...wave.discardPile]
  shuffleInPlace(pool, rand)
  const discardPile = pool.slice(0, n)
  const stock = pool.slice(n)
  return { wave: { stock, discardPile } }
}
```

`SABOTAGE_HANDLERS`の`tsukumokaRelease: applyTsukumokaRelease,`の直後に追加する:

```ts
  discardErase: applyDiscardErase,
  discardBury: applyDiscardBury,
```

- [ ] **Step 7: テストを実行し、成功することを確認する**

Run: `npx vitest run src/lib/game/shidasu/sabotage.test.ts src/lib/game/shidasu/engine.test.ts src/lib/game/shidasu/sabotageEffects.test.ts`
Expected: 全件PASS

- [ ] **Step 8: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/sabotage.ts src/lib/game/shidasu/sabotageEffects.ts src/lib/game/shidasu/sabotage.test.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 星の妨害行動に捨て札消去(discardErase)・捨て札埋没(discardBury)を追加"
```

---

## Task 8: rewardReduce(報酬減少)

Waveクリア時の通貨報酬を-2する(累積・永続)。`RunState`に新フィールド`rewardPenalty`を追加し、`resolveWaveEnd`の報酬計算を変更する。

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`(`SabotageActionId`・`RunState.rewardPenalty`)
- Modify: `src/lib/game/shidasu/sabotage.ts`(`SABOTAGE_POOL`)
- Modify: `src/lib/game/shidasu/engine.ts`(`createInitialRun`・`beginRun`・`resolveWaveEnd`)
- Modify: `src/lib/game/shidasu/sabotageEffects.ts`(`applyRewardReduce`・`SABOTAGE_HANDLERS`)
- Modify: `src/lib/game/shidasu/sabotage.test.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: `sabotage.test.ts`の件数を29件に更新する**

`28件`を`29件`に更新する。

- [ ] **Step 2: `resolveWaveEnd`・`triggerSabotage`経由のテストを追加する(失敗させる)**

`src/lib/game/shidasu/engine.test.ts`の`resolveWaveEnd`describeブロック内、`数珠所持時、星のrewardに追加報酬が加算される`テスト(2706-2717行目付近)の直後に追加する:

```ts

  test('rewardPenaltyが設定されていれば、星のrewardから減算される(レリックボーナスは減算後の額を基準にしても変わらない)', () => {
    const rewardStar: Star = { id: 'reward-star', name: '報酬の星', waveSlot: 3, targetMultiplier: 1, reward: 20, restriction: null, sabotage: { kind: 'none' }, descTemplate: '' }
    const stageStars = [noRewardStar, noRewardStar, rewardStar]
    const run = endedRun({ waveIndex: 2, stageStars, rewardPenalty: 6 }, waveTarget(DEFAULT_PARAMS, 0, 2, stageStars))
    const next = resolveWaveEnd(DEFAULT_PARAMS, run, createRng(5))
    expect(next.currency).toBe(run.currency + (20 - 6))
  })

  test('rewardPenaltyが星のreward以上でも、通貨が減ることは無い(下限0)', () => {
    const rewardStar: Star = { id: 'reward-star', name: '報酬の星', waveSlot: 3, targetMultiplier: 1, reward: 5, restriction: null, sabotage: { kind: 'none' }, descTemplate: '' }
    const stageStars = [noRewardStar, noRewardStar, rewardStar]
    const run = endedRun({ waveIndex: 2, stageStars, rewardPenalty: 999 }, waveTarget(DEFAULT_PARAMS, 0, 2, stageStars))
    const next = resolveWaveEnd(DEFAULT_PARAMS, run, createRng(5))
    expect(next.currency).toBe(run.currency)
  })
```

`describe('triggerSabotage', ...)`ブロック内、`discardBury`テストの直後に追加する:

```ts

  it('rewardReduce: rewardPenaltyを2加算する(累積)', () => {
    const run = runWithWave({ rewardPenalty: 3 })
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'rewardReduce', () => 0)
    expect(next.rewardPenalty).toBe(5)
  })
```

- [ ] **Step 3: テストを実行し、失敗することを確認する**

Run: `npx vitest run src/lib/game/shidasu/sabotage.test.ts src/lib/game/shidasu/engine.test.ts -t "rewardPenalty|rewardReduce"`
Expected: FAIL(`rewardPenalty`フィールド・`rewardReduce`が存在しない)

- [ ] **Step 4: `RunState`に`rewardPenalty`を追加する**

`src/lib/game/shidasu/types.ts:447-450`の以下:

```ts
  // 直近に使用した秘儀のID、新しい順で最大2件(秘儀回帰が参照する)。
  recentUsedRiteIds: RiteId[]
}
```

を以下に置き換える:

```ts
  // 直近に使用した秘儀のID、新しい順で最大2件(秘儀回帰が参照する)。
  recentUsedRiteIds: RiteId[]
  // 妨害「報酬減少」用: Waveクリア報酬から減算する累積量。beginRunで0に初期化され、
  // rewardReduce発動のたびに加算される。ラン終了までリセットされない(永続的なマイナス)。
  rewardPenalty: number
}
```

- [ ] **Step 5: `SabotageActionId`に追加する**

```ts
  | 'talismanShuffle' | 'revelationOracleConfiscate' | 'revelationOracleForceActivate' | 'tsukumokaRelease'
  | 'discardErase' | 'discardBury'
```

を以下に置き換える:

```ts
  | 'talismanShuffle' | 'revelationOracleConfiscate' | 'revelationOracleForceActivate' | 'tsukumokaRelease'
  | 'discardErase' | 'discardBury' | 'rewardReduce'
```

- [ ] **Step 6: `createInitialRun`・`beginRun`に初期化を追加する**

`src/lib/game/shidasu/engine.ts`の`createInitialRun`内、`lastUsedRevelationId: null, recentUsedRiteIds: [],`を以下に置き換える:

```ts
    lastUsedRevelationId: null, recentUsedRiteIds: [], rewardPenalty: 0,
```

`beginRun`内、`recentUsedRiteIds: [],`(末尾、`}`の直前)を以下に置き換える:

```ts
    recentUsedRiteIds: [],
    rewardPenalty: 0,
```

- [ ] **Step 7: `resolveWaveEnd`の報酬計算を変更する**

`src/lib/game/shidasu/engine.ts:1039-1041`:

```ts
  const currentStar = run.stageStars[run.waveIndex]
  const baseEarned = currentStar?.reward ?? 0
  const earned = baseEarned + relicWaveEndBonus(params, run, wave, baseEarned)
```

を以下に置き換える:

```ts
  const currentStar = run.stageStars[run.waveIndex]
  const baseEarned = Math.max(0, (currentStar?.reward ?? 0) - run.rewardPenalty)
  const earned = baseEarned + relicWaveEndBonus(params, run, wave, baseEarned)
```

- [ ] **Step 8: `SABOTAGE_POOL`にエントリを追加する**

`discardBury`エントリの直後に追加する:

```ts
  { id: 'rewardReduce', name: '報酬減少', target: '資産(星片)', intervalTurns: 8, descTemplate: 'Waveクリア時の通貨報酬を-2する(複数回発動した場合は累積する)' },
```

- [ ] **Step 9: `applyRewardReduce`を実装し登録する**

`applyDiscardBury`関数の直後に追加する:

```ts

function applyRewardReduce({ run }: SabotageContext): SabotageResult {
  return { run: { rewardPenalty: run.rewardPenalty + 2 } }
}
```

`SABOTAGE_HANDLERS`の`discardBury: applyDiscardBury,`の直後に追加する:

```ts
  rewardReduce: applyRewardReduce,
```

- [ ] **Step 10: テストを実行し、成功することを確認する**

Run: `npx vitest run src/lib/game/shidasu/sabotage.test.ts src/lib/game/shidasu/engine.test.ts src/lib/game/shidasu/sabotageEffects.test.ts`
Expected: 全件PASS

- [ ] **Step 11: 型チェックを実行する**

Run: `npm run check`
Expected: エラー無し(`RunState`リテラルを直接組み立てている既存テスト等で`rewardPenalty`が不足しエラーになる場合は、該当箇所に`rewardPenalty: 0`を追加する)

- [ ] **Step 12: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/sabotage.ts src/lib/game/shidasu/engine.ts src/lib/game/shidasu/sabotageEffects.ts src/lib/game/shidasu/sabotage.test.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 星の妨害行動に報酬減少(rewardReduce)を追加"
```

---

## Task 9: currencyDrain・roleLevelDecay(通貨強制消費・役減衰)

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`(`SabotageActionId`)
- Modify: `src/lib/game/shidasu/sabotage.ts`(`SABOTAGE_POOL`)
- Modify: `src/lib/game/shidasu/sabotageEffects.ts`(`applyCurrencyDrain`・`applyRoleLevelDecay`・`SABOTAGE_HANDLERS`)
- Modify: `src/lib/game/shidasu/sabotage.test.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: `sabotage.test.ts`の件数を31件に更新する**

`29件`を`31件`に更新する。

- [ ] **Step 2: `triggerSabotage`経由のテストを追加する(失敗させる)**

`src/lib/game/shidasu/engine.test.ts`の`rewardReduce`テストの直後に追加する:

```ts

  it('currencyDrain: 所持通貨の20%を失う(端数切り捨て)', () => {
    const run = runWithWave({ currency: 47 })
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'currencyDrain', () => 0)
    expect(next.currency).toBe(37) // 47 - floor(47*0.2)=47-9=38... floor(9.4)=9
  })

  it('currencyDrain: 通貨が0未満にはならない', () => {
    const run = runWithWave({ currency: 0 })
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'currencyDrain', () => 0)
    expect(next.currency).toBe(0)
  })

  it('roleLevelDecay: ランダムな2役のoracleLevelsを1下げる(run・wave両方に反映)', () => {
    // どの2役が選ばれてもテストが成立するよう、rand()の具体的な返り値には依存せず、
    // 「全役3からスタートし、変化した役はちょうど2つ・それぞれ2になる」ことだけを検証する
    // (shuffleInPlaceの正確な並び替え結果を手計算で決め打ちすると、実装の細部が変わった際に
    // 無関係な失敗を招きやすいため)。
    const oracleLevels = Object.fromEntries(Object.keys(defaultOracleLevels()).map(name => [name, 3])) as Record<RoleName, number>
    const run = runWithWave({ oracleLevels })
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'roleLevelDecay', () => 0)
    const changedNames = (Object.keys(oracleLevels) as RoleName[]).filter(name => next.oracleLevels[name] !== oracleLevels[name])
    expect(changedNames).toHaveLength(2)
    for (const name of changedNames) {
      expect(next.oracleLevels[name]).toBe(2)
      expect(next.wave!.oracleLevels[name]).toBe(2)
    }
  })

  it('roleLevelDecay: 下限1を下回らない', () => {
    const run = runWithWave() // 全役デフォルト1(defaultOracleLevels())
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'roleLevelDecay', () => 0)
    for (const level of Object.values(next.oracleLevels)) {
      expect(level).toBeGreaterThanOrEqual(1)
    }
  })
```

- [ ] **Step 3: テストを実行し、失敗することを確認する**

Run: `npx vitest run src/lib/game/shidasu/sabotage.test.ts src/lib/game/shidasu/engine.test.ts -t "currencyDrain|roleLevelDecay"`
Expected: FAIL(`currencyDrain`・`roleLevelDecay`が存在しない)

- [ ] **Step 4: `SabotageActionId`に追加する**

```ts
  | 'discardErase' | 'discardBury' | 'rewardReduce'
```

を以下に置き換える:

```ts
  | 'discardErase' | 'discardBury' | 'rewardReduce' | 'currencyDrain' | 'roleLevelDecay'
```

- [ ] **Step 5: `SABOTAGE_POOL`にエントリを追加する**

`rewardReduce`エントリの直後に追加する:

```ts
  { id: 'currencyDrain', name: '通貨強制消費', target: '資産(星片)', intervalTurns: 6, descTemplate: '所持通貨の20%を失わせる' },
  { id: 'roleLevelDecay', name: '役減衰', target: '役ステータス', intervalTurns: 7, descTemplate: 'ランダムな2役を選び、oracleLevelを1下げる(下限1、永続的なマイナス)' },
```

- [ ] **Step 6: `applyCurrencyDrain`・`applyRoleLevelDecay`を実装し登録する**

`applyRewardReduce`関数の直後に追加する:

```ts

function applyCurrencyDrain({ run }: SabotageContext): SabotageResult {
  const loss = Math.floor(run.currency * 0.2)
  return { run: { currency: Math.max(0, run.currency - loss) } }
}

function applyRoleLevelDecay({ run, rand }: SabotageContext): SabotageResult {
  const names = rollOffer(ORACLE_POOL, 2, rand)
  const oracleLevels = { ...run.oracleLevels }
  for (const name of names) oracleLevels[name] = Math.max(1, oracleLevels[name] - 1)
  return { run: { oracleLevels }, wave: { oracleLevels } }
}
```

`SABOTAGE_HANDLERS`の`rewardReduce: applyRewardReduce,`の直後に追加する:

```ts
  currencyDrain: applyCurrencyDrain,
  roleLevelDecay: applyRoleLevelDecay,
```

- [ ] **Step 7: テストを実行し、成功することを確認する**

Run: `npx vitest run src/lib/game/shidasu/sabotage.test.ts src/lib/game/shidasu/engine.test.ts src/lib/game/shidasu/sabotageEffects.test.ts`
Expected: 全件PASS

- [ ] **Step 8: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/sabotage.ts src/lib/game/shidasu/sabotageEffects.ts src/lib/game/shidasu/sabotage.test.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 星の妨害行動に通貨強制消費(currencyDrain)・役減衰(roleLevelDecay)を追加"
```

---

## Task 10: roleBias(役偏重)

次の妨害発動まで、全役(10役)をランダムに半分(5役ずつ)に分け、一方を2倍、他方を1/2倍にする。`SealedRoleEffect`を拡張し、`activeSeal`に新バリアント`roleBias`を追加する。

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`(`SabotageActionId`・`activeSeal`)
- Modify: `src/lib/game/shidasu/engine.ts`(`SealedRoleEffect`・`resolveSealedRoleEffect`・`playCard`・`drawStock`)
- Modify: `src/lib/game/shidasu/sabotage.ts`(`SABOTAGE_POOL`)
- Modify: `src/lib/game/shidasu/sabotageEffects.ts`(`applyRoleBias`・`SABOTAGE_HANDLERS`)
- Modify: `src/lib/game/shidasu/sabotage.test.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`
- Modify: `src/routes/game/shidasu/RoleStatusPanel.svelte`

- [ ] **Step 1: `sabotage.test.ts`の件数を32件に更新する**

`31件`を`32件`に更新する。

- [ ] **Step 2: `resolveSealedRoleEffect`・`playCard`・`triggerSabotage`経由のテストを追加する(失敗させる)**

`src/lib/game/shidasu/engine.test.ts`の`describe('役封印のoracleLevelへの反映(playCard)', ...)`ブロック(4820-4833行目付近)の直後に追加する:

```ts

describe('役偏重(roleBias)のoracleLevelへの反映(playCard)', () => {
  test('sealedRoleEffect.multipliersに含まれる役は基礎点にその倍率が乗算される(buffed側)', () => {
    const wave = makeWave({
      foundation: card(0, '♠', 1),
      chain: [card(20, '♥', 11), card(21, '♦', 12)],
      tableau: [[card(1, '♣', 13)], [card(2, '♦', 2)]],
    })
    const baseline = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition(), () => 0.5)
    const buffed = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition(), () => 0.5, null, undefined, { zeroRoles: [], oracleBaselineRole: null, multipliers: { royalSet: 2 } })
    expect(buffed.wave.score).toBeGreaterThan(baseline.wave.score)
  })

  test('sealedRoleEffect.multipliersに含まれる役は基礎点にその倍率が乗算される(nerfed側)', () => {
    const wave = makeWave({
      foundation: card(0, '♠', 1),
      chain: [card(20, '♥', 11), card(21, '♦', 12)],
      tableau: [[card(1, '♣', 13)], [card(2, '♦', 2)]],
    })
    const baseline = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition(), () => 0.5)
    const nerfed = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition(), () => 0.5, null, undefined, { zeroRoles: [], oracleBaselineRole: null, multipliers: { royalSet: 0.5 } })
    expect(nerfed.wave.score).toBeLessThan(baseline.wave.score)
  })
})
```

`describe('triggerSabotage', ...)`ブロック内、`roleLevelDecay`テストの直後に追加する:

```ts

  it('roleBias: 10役をランダムに5役ずつ2グループへ分け、buffedを2倍・nerfedを0.5倍のactiveSealにする', () => {
    const run = runWithWave()
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'roleBias', () => 0)
    const seal = next.wave!.activeSeal
    expect(seal?.kind).toBe('roleBias')
    if (seal?.kind !== 'roleBias') throw new Error('unreachable')
    expect(seal.buffed).toHaveLength(5)
    expect(seal.nerfed).toHaveLength(5)
    expect(seal.multiplier).toBe(2)
    // 重複・欠落無く10役全てがどちらかに属していること
    expect([...seal.buffed, ...seal.nerfed].sort()).toEqual(
      ['alternating', 'color', 'columnSweep', 'completeRun', 'flush', 'pair', 'royalSet', 'sameRank', 'stair', 'suit'].sort()
    )
  })
```

- [ ] **Step 3: テストを実行し、失敗することを確認する**

Run: `npx vitest run src/lib/game/shidasu/sabotage.test.ts src/lib/game/shidasu/engine.test.ts -t "roleBias"`
Expected: FAIL(`multipliers`フィールド・`roleBias`が存在しない)

- [ ] **Step 4: `SabotageActionId`・`activeSeal`に追加する**

`src/lib/game/shidasu/types.ts`の以下:

```ts
  | 'discardErase' | 'discardBury' | 'rewardReduce' | 'currencyDrain' | 'roleLevelDecay'
```

を以下に置き換える:

```ts
  | 'discardErase' | 'discardBury' | 'rewardReduce' | 'currencyDrain' | 'roleLevelDecay' | 'roleBias'
```

同ファイル6行目のコメント`// 妨害行動の識別子。22個実装済み(SABOTAGE_POOLに全件登録済み)。詳細は...`も、これでPhase Bの10個が揃うため`// 妨害行動の識別子。32個実装済み(SABOTAGE_POOLに全件登録済み)。詳細は...`に更新する。

`activeSeal`定義:

```ts
    | { kind: 'comboCap'; max: number }
    | { kind: 'talismanHidden' }
    | null
```

を以下に置き換える:

```ts
    | { kind: 'comboCap'; max: number }
    | { kind: 'talismanHidden' }
    | { kind: 'roleBias'; buffed: RoleName[]; nerfed: RoleName[]; multiplier: number }
    | null
```

- [ ] **Step 5: `SealedRoleEffect`に`multipliers`を追加する**

`src/lib/game/shidasu/engine.ts:282`の以下:

```ts
export type SealedRoleEffect = { zeroRoles: RoleName[]; oracleBaselineRole: RoleName | null }
```

を以下に置き換える:

```ts
export type SealedRoleEffect = { zeroRoles: RoleName[]; oracleBaselineRole: RoleName | null; multipliers?: Partial<Record<RoleName, number>> }
```

- [ ] **Step 6: `resolveSealedRoleEffect`に`roleBias`分岐を追加する**

`src/lib/game/shidasu/engine.ts:1133-1137`:

```ts
export function resolveSealedRoleEffect(activeSeal: WaveState['activeSeal']): SealedRoleEffect {
  if (activeSeal?.kind === 'role') return { zeroRoles: activeSeal.names, oracleBaselineRole: null }
  if (activeSeal?.kind === 'revelationOrOracle' && activeSeal.ref.kind === 'oracle') return { zeroRoles: [], oracleBaselineRole: activeSeal.ref.id }
  return { zeroRoles: [], oracleBaselineRole: null }
}
```

を以下に置き換える:

```ts
export function resolveSealedRoleEffect(activeSeal: WaveState['activeSeal']): SealedRoleEffect {
  if (activeSeal?.kind === 'role') return { zeroRoles: activeSeal.names, oracleBaselineRole: null }
  if (activeSeal?.kind === 'revelationOrOracle' && activeSeal.ref.kind === 'oracle') return { zeroRoles: [], oracleBaselineRole: activeSeal.ref.id }
  if (activeSeal?.kind === 'roleBias') {
    const multipliers: Partial<Record<RoleName, number>> = {}
    for (const name of activeSeal.buffed) multipliers[name] = activeSeal.multiplier
    for (const name of activeSeal.nerfed) multipliers[name] = 1 / activeSeal.multiplier
    return { zeroRoles: [], oracleBaselineRole: null, multipliers }
  }
  return { zeroRoles: [], oracleBaselineRole: null }
}
```

- [ ] **Step 7: `playCard`・`drawStock`の`oracleLevel`クロージャに掛け算ロジックを追加する**

`src/lib/game/shidasu/engine.ts:375-379`(`playCard`内):

```ts
  const oracleLevel = (name: RoleName): number => {
    if (sealedRoleEffect.zeroRoles.includes(name)) return 0
    if (sealedRoleEffect.oracleBaselineRole === name) return 1
    return wave.oracleLevels[name] ?? 1
  }
```

を以下に置き換える:

```ts
  const oracleLevel = (name: RoleName): number => {
    if (sealedRoleEffect.zeroRoles.includes(name)) return 0
    if (sealedRoleEffect.oracleBaselineRole === name) return 1
    const base = wave.oracleLevels[name] ?? 1
    const mult = sealedRoleEffect.multipliers?.[name]
    return mult !== undefined ? base * mult : base
  }
```

`src/lib/game/shidasu/engine.ts:713-717`(`drawStock`内)も同様に:

```ts
      const oracleLevel = (name: RoleName): number => {
        if (sealedRoleEffect.zeroRoles.includes(name)) return 0
        if (sealedRoleEffect.oracleBaselineRole === name) return 1
        return wave.oracleLevels[name] ?? 1
      }
```

を以下に置き換える:

```ts
      const oracleLevel = (name: RoleName): number => {
        if (sealedRoleEffect.zeroRoles.includes(name)) return 0
        if (sealedRoleEffect.oracleBaselineRole === name) return 1
        const base = wave.oracleLevels[name] ?? 1
        const mult = sealedRoleEffect.multipliers?.[name]
        return mult !== undefined ? base * mult : base
      }
```

- [ ] **Step 8: `SABOTAGE_POOL`にエントリを追加する**

`src/lib/game/shidasu/sabotage.ts`の`roleLevelDecay`エントリの直後に追加する:

```ts
  { id: 'roleBias', name: '役偏重', target: '役ステータス', intervalTurns: 6, descTemplate: '次の妨害発動まで、全役を半分ずつ2グループに分け、一方を2倍、他方を1/2倍にする' },
```

これでPhase Bの10個全てが揃うため、ファイル冒頭のコメント行:

```ts
// 妨害行動プール。22件(11ターゲット×先行実装11個+Phase A追加11個)。詳細はdocs/shidasu/shidasu-star-sabotage-candidates.mdを参照。
```

を以下に置き換える:

```ts
// 妨害行動プール。32件(先行実装11個+Phase A 11個+Phase B 10個)。詳細はdocs/shidasu/shidasu-star-sabotage-candidates.mdを参照。
```

- [ ] **Step 9: `applyRoleBias`を実装し登録する**

`src/lib/game/shidasu/sabotageEffects.ts`の`applyRoleLevelDecay`関数の直後に追加する:

```ts

function applyRoleBias({ rand }: SabotageContext): SabotageResult {
  const shuffled = [...ORACLE_POOL]
  shuffleInPlace(shuffled, rand)
  const half = Math.floor(shuffled.length / 2)
  const buffed = shuffled.slice(0, half)
  const nerfed = shuffled.slice(half)
  return { wave: { activeSeal: { kind: 'roleBias', buffed, nerfed, multiplier: 2 } } }
}
```

`SABOTAGE_HANDLERS`の`roleLevelDecay: applyRoleLevelDecay,`の直後に追加する:

```ts
  roleBias: applyRoleBias,
```

- [ ] **Step 10: テストを実行し、成功することを確認する**

Run: `npx vitest run`
Expected: 全件PASS

- [ ] **Step 11: 型チェックを実行する**

Run: `npm run check`
Expected: エラー無し

- [ ] **Step 12: `RoleStatusPanel.svelte`の実効レベル計算に`multipliers`を反映する**

`src/routes/game/shidasu/RoleStatusPanel.svelte`は`resolveSealedRoleEffect`の結果(実効レベル)を表示に使っているが、`effectiveLevel`関数(16-20行目)は`zeroRoles`/`oracleBaselineRole`しか見ておらず、今回追加した`multipliers`を無視したままだと`roleBias`発動中の実効レベル・得点表示が実際のスコアリングと食い違う。以下の行:

```ts
  function effectiveLevel(roleName: RoleName, storedLevel: number): number {
    if (sealedRoleEffect.zeroRoles.includes(roleName)) return 0
    if (sealedRoleEffect.oracleBaselineRole === roleName) return 1
    return storedLevel
  }
```

を以下に置き換える:

```ts
  function effectiveLevel(roleName: RoleName, storedLevel: number): number {
    if (sealedRoleEffect.zeroRoles.includes(roleName)) return 0
    if (sealedRoleEffect.oracleBaselineRole === roleName) return 1
    const mult = sealedRoleEffect.multipliers?.[roleName]
    return mult !== undefined ? storedLevel * mult : storedLevel
  }
```

(`sealed`判定(30行目`{@const sealed = level !== storedLevel}`)は`level !== storedLevel`のままで良い。倍率適用によって`level`が`storedLevel`と異なる値になれば自動的に強調表示される。)

- [ ] **Step 13: 開発サーバーで目視確認する**

Run: `npm run dev`

ブラウザで `http://localhost:5173/game/shidasu` を開き、`roleBias`が発動した状態でプレイし、`RoleStatusPanel`の実効レベル・得点表示が2倍/0.5倍を正しく反映していることを確認する。

- [ ] **Step 14: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/engine.ts src/lib/game/shidasu/sabotage.ts src/lib/game/shidasu/sabotageEffects.ts src/lib/game/shidasu/sabotage.test.ts src/lib/game/shidasu/engine.test.ts src/routes/game/shidasu/RoleStatusPanel.svelte
git commit -m "feat: 星の妨害行動に役偏重(roleBias)を追加"
```

---

## 最終確認

全10タスク完了後:

- [ ] `npm run build` を実行し、ビルドが通ることを確認する
- [ ] `npm run check` を実行し、型エラーが無いことを確認する
- [ ] `npx vitest run` を実行し、全テストがPASSすることを確認する(`SABOTAGE_POOL`が32件になっていること)
- [ ] `npm run dev` でブラウザから一通りプレイし、Phase Bの10効果(特に`talismanShuffle`の裏向き表示・`roleBias`のRoleStatusPanel表示)に画面崩れが無いことを確認する
- [ ] `docs/shidasu/shidasu-roadmap.md`・`docs/shidasu/shidasu-star-sabotage-candidates.md`に実装完了を反映する(該当箇所があれば更新する)
