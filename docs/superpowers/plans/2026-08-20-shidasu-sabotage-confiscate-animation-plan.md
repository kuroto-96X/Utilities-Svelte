# 妨害行動アニメーション(グループB: 没収系) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 没収系の妨害行動4個(`talismanConfiscate`・`riteConfiscate`・`revelationOracleConfiscate`・`relicConfiscate`)に発動演出(崩れ落ちるフェード)を実装する。

**Architecture:** `SabotageResult`に`confiscatedTarget`フィールドを新設し、没収系4効果関数が削除前の対象(`kind`/`id`/`idx`)を明示的に返す。`lastSabotage`経由で`PlayArea.svelte`が検知し、`confiscateFadingTarget`という一時stateに保持する(グループAの`sealFlashTarget`と同型のパターン)。実データは即座に削除されるため、各バッジ描画箇所は`confiscateFadingTarget`を使って「本来のリスト+フェード中要素」を補完してから描画する。`PlayArea`外(`+page.svelte`)の対象へは新規コールバックprops`onConfiscateFadingChange`経由で値を伝える。

**Tech Stack:** SvelteKit, Svelte 5 runes (`$state`, `$effect.pre`), TypeScript, Vitest

参照設計: `docs/superpowers/specs/2026-08-20-shidasu-sabotage-confiscate-animation-design.md`

---

### Task 1: `SabotageResult.confiscatedTarget`と`WaveState.lastSabotage.confiscatedTarget`の型追加

**Files:**
- Modify: `src/lib/game/shidasu/sabotageEffects.ts:2`(import文)
- Modify: `src/lib/game/shidasu/sabotageEffects.ts:27-38`(`SabotageResult`インターフェース)
- Modify: `src/lib/game/shidasu/types.ts:312`(`WaveState.lastSabotage`)

- [ ] **Step 1: `sabotageEffects.ts`のimportに`ItemId`を追加**

`src/lib/game/shidasu/sabotageEffects.ts`の2行目:

```ts
import type { SabotageActionId, WaveState, RunState, Card, HeldRevelationOrOracleRef, RiteId, RevelationId, RelicId, RoleName } from './types'
```

を以下に置き換える:

```ts
import type { SabotageActionId, WaveState, RunState, Card, HeldRevelationOrOracleRef, RiteId, RevelationId, RelicId, RoleName, ItemId } from './types'
```

- [ ] **Step 2: `SabotageResult`に`confiscatedTarget`を追加**

`src/lib/game/shidasu/sabotageEffects.ts`の27-38行目:

```ts
export interface SabotageResult {
  wave?: Partial<WaveState>
  run?: Partial<RunState>
  // 今回のトリガーで実際に再配布された場札の列インデックス。裏向き配布アニメーション
  // (PlayArea.svelte)が対象列を特定するために使う。wave側のCard.faceUpフラグは
  // 過去の別トリガーで裏向きのまま残っているカードとも区別が付かないため、
  // 「今回触った列」を明示的にここで伝える。tableauFullReturn/columnReturn以外は未設定でよい。
  affectedTableauCols?: number[]
  // 今回「大量放出」「少量放出」で山札から捨て札へ移動した枚数。裏向き移動アニメーション
  // (PlayArea.svelte)が対象枚数を特定するために使う。stockPurge/stockPurgeSmall以外は未設定でよい。
  purgedToDiscardCount?: number
}
```

を以下に置き換える:

```ts
export interface SabotageResult {
  wave?: Partial<WaveState>
  run?: Partial<RunState>
  // 今回のトリガーで実際に再配布された場札の列インデックス。裏向き配布アニメーション
  // (PlayArea.svelte)が対象列を特定するために使う。wave側のCard.faceUpフラグは
  // 過去の別トリガーで裏向きのまま残っているカードとも区別が付かないため、
  // 「今回触った列」を明示的にここで伝える。tableauFullReturn/columnReturn以外は未設定でよい。
  affectedTableauCols?: number[]
  // 今回「大量放出」「少量放出」で山札から捨て札へ移動した枚数。裏向き移動アニメーション
  // (PlayArea.svelte)が対象枚数を特定するために使う。stockPurge/stockPurgeSmall以外は未設定でよい。
  purgedToDiscardCount?: number
  // 今回「没収系」(talismanConfiscate/riteConfiscate/revelationOracleConfiscate/relicConfiscate)で
  // 完全に失われた対象。没収系は実データ(run.items等)を即座に削除するだけで、activeSealのような
  // 「現在の対象」を保持する仕組みを持たないため、ここで明示的に伝える。idxは配列内の位置
  // (同名の護符・秘儀・レリックを複数所持している場合の一意特定に必要)。
  confiscatedTarget?:
    | { kind: 'talisman'; id: ItemId; idx: number }
    | { kind: 'rite'; id: RiteId; idx: number }
    | { kind: 'revelationOrOracle'; ref: HeldRevelationOrOracleRef; idx: number }
    | { kind: 'relic'; id: RelicId; idx: number }
}
```

- [ ] **Step 3: `WaveState.lastSabotage`に`confiscatedTarget`を追加**

`src/lib/game/shidasu/types.ts`の312行目:

```ts
  lastSabotage?: { id: SabotageActionId; seq: number; affectedCols?: number[]; purgedToDiscardCount?: number }
```

を以下に置き換える:

```ts
  lastSabotage?: { id: SabotageActionId; seq: number; affectedCols?: number[]; purgedToDiscardCount?: number; confiscatedTarget?: { kind: 'talisman'; id: ItemId; idx: number } | { kind: 'rite'; id: RiteId; idx: number } | { kind: 'revelationOrOracle'; ref: HeldRevelationOrOracleRef; idx: number } | { kind: 'relic'; id: RelicId; idx: number } }
```

`ItemId`が`types.ts`内で未importの場合(型定義ファイル自身なので通常は同一ファイル内で定義されているはず)、以下のコマンドで確認する:

```bash
grep -n "^export type ItemId" src/lib/game/shidasu/types.ts
```

- [ ] **Step 4: 型チェックを実行**

Run: `npm run check`
Expected: エラーなし(型追加のみで、既存コードはこれらの新規フィールドを参照していないため何も壊れない)

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/sabotageEffects.ts src/lib/game/shidasu/types.ts
git commit -m "feat: SabotageResultとWaveState.lastSabotageにconfiscatedTargetを追加する"
```

---

### Task 2: 没収系4効果関数がconfiscatedTargetを返すよう修正する

**Files:**
- Modify: `src/lib/game/shidasu/sabotageEffects.ts`(`applyTalismanConfiscate`・`applyRiteConfiscate`・`applyRelicConfiscate`・`applyRevelationOracleConfiscate`)
- Modify: `src/lib/game/shidasu/engine.ts:1153`(`triggerSabotage`の`lastSabotage`組み立て)
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の既存の没収系テスト(`talismanConfiscate`・`riteConfiscate`・`relicConfiscate`・`revelationOracleConfiscate`)が定義されているのと同じ`describe`ブロック内(`describe('triggerSabotage', ...)`、`runWithWave`ヘルパーが使えるスコープ)に、以下のテストを追記する。既存の`it('talismanConfiscate: 所持護符からランダムに1つ選び完全に失う', ...)`(5109行目付近)の直後に追加すること:

```ts
  it('talismanConfiscate: lastSabotage.confiscatedTargetに没収した護符のid・idxを設定する', () => {
    const run = runWithWave({ items: ['bridge', 'grace'] })
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'talismanConfiscate', () => 0)
    expect(next.wave!.lastSabotage?.confiscatedTarget).toEqual({ kind: 'talisman', id: 'bridge', idx: 0 })
  })

  it('talismanConfiscate: 所持護符が0件ならconfiscatedTargetは設定されない', () => {
    const run = runWithWave({ items: [] })
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'talismanConfiscate', () => 0)
    expect(next.wave!.lastSabotage?.confiscatedTarget).toBeUndefined()
  })

  it('riteConfiscate: lastSabotage.confiscatedTargetに没収した秘儀のid・idxを設定する', () => {
    const run = runWithWave({ rites: ['gebo', 'fehu'] })
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'riteConfiscate', () => 0)
    expect(next.wave!.lastSabotage?.confiscatedTarget).toEqual({ kind: 'rite', id: 'gebo', idx: 0 })
  })

  it('relicConfiscate: lastSabotage.confiscatedTargetに没収したレリックのid・idxを設定する', () => {
    const run = runWithWave({ relics: [{ id: 'manekiNeko', tsukumoka: false }, { id: 'juzu', tsukumoka: false }] })
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'relicConfiscate', () => 0)
    expect(next.wave!.lastSabotage?.confiscatedTarget).toEqual({ kind: 'relic', id: 'manekiNeko', idx: 0 })
  })

  it('revelationOracleConfiscate: 天啓が選ばれた場合、confiscatedTargetにref.kind=revelationとidxを設定する', () => {
    const run = runWithWave({ revelations: ['kaku'], oracles: ['pair'] })
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'revelationOracleConfiscate', () => 0)
    expect(next.wave!.lastSabotage?.confiscatedTarget).toEqual({ kind: 'revelationOrOracle', ref: { kind: 'revelation', id: 'kaku' }, idx: 0 })
  })

  it('revelationOracleConfiscate: 神託が選ばれた場合、confiscatedTargetにref.kind=oracleとidxを設定する', () => {
    const run = runWithWave({ revelations: [], oracles: ['pair'] })
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'revelationOracleConfiscate', () => 0)
    expect(next.wave!.lastSabotage?.confiscatedTarget).toEqual({ kind: 'revelationOrOracle', ref: { kind: 'oracle', id: 'pair' }, idx: 0 })
  })

  it('revelationOracleConfiscate: 天啓・神託とも0件ならconfiscatedTargetは設定されない', () => {
    const run = runWithWave({ revelations: [], oracles: [] })
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'revelationOracleConfiscate', () => 0)
    expect(next.wave!.lastSabotage?.confiscatedTarget).toBeUndefined()
  })
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm test -- engine.test.ts -t "confiscatedTarget"`
Expected: FAIL(`confiscatedTarget`が`undefined`のまま、7件とも失敗)

- [ ] **Step 3: `applyTalismanConfiscate`を修正**

`src/lib/game/shidasu/sabotageEffects.ts`の`applyTalismanConfiscate`関数:

```ts
function applyTalismanConfiscate({ run, rand }: SabotageContext): SabotageResult {
  if (run.items.length === 0) return {}
  const idx = Math.floor(rand() * run.items.length)
  return { run: { items: [...run.items.slice(0, idx), ...run.items.slice(idx + 1)] } }
}
```

を以下に置き換える:

```ts
function applyTalismanConfiscate({ run, rand }: SabotageContext): SabotageResult {
  if (run.items.length === 0) return {}
  const idx = Math.floor(rand() * run.items.length)
  const id = run.items[idx]
  return { run: { items: [...run.items.slice(0, idx), ...run.items.slice(idx + 1)] }, confiscatedTarget: { kind: 'talisman', id, idx } }
}
```

- [ ] **Step 4: `applyRiteConfiscate`を修正**

`src/lib/game/shidasu/sabotageEffects.ts`の`applyRiteConfiscate`関数:

```ts
function applyRiteConfiscate({ run, rand }: SabotageContext): SabotageResult {
  if (run.rites.length === 0) return {}
  const idx = Math.floor(rand() * run.rites.length)
  return { run: { rites: [...run.rites.slice(0, idx), ...run.rites.slice(idx + 1)] } }
}
```

を以下に置き換える:

```ts
function applyRiteConfiscate({ run, rand }: SabotageContext): SabotageResult {
  if (run.rites.length === 0) return {}
  const idx = Math.floor(rand() * run.rites.length)
  const id = run.rites[idx]
  return { run: { rites: [...run.rites.slice(0, idx), ...run.rites.slice(idx + 1)] }, confiscatedTarget: { kind: 'rite', id, idx } }
}
```

- [ ] **Step 5: `applyRelicConfiscate`を修正**

`src/lib/game/shidasu/sabotageEffects.ts`の`applyRelicConfiscate`関数:

```ts
function applyRelicConfiscate({ run, rand }: SabotageContext): SabotageResult {
  if (run.relics.length === 0) return {}
  const idx = Math.floor(rand() * run.relics.length)
  return { run: { relics: [...run.relics.slice(0, idx), ...run.relics.slice(idx + 1)] } }
}
```

を以下に置き換える:

```ts
function applyRelicConfiscate({ run, rand }: SabotageContext): SabotageResult {
  if (run.relics.length === 0) return {}
  const idx = Math.floor(rand() * run.relics.length)
  const id = run.relics[idx].id
  return { run: { relics: [...run.relics.slice(0, idx), ...run.relics.slice(idx + 1)] }, confiscatedTarget: { kind: 'relic', id, idx } }
}
```

- [ ] **Step 6: `applyRevelationOracleConfiscate`を修正**

`src/lib/game/shidasu/sabotageEffects.ts`の`applyRevelationOracleConfiscate`関数の現在の内容を確認する:

```bash
grep -n "function applyRevelationOracleConfiscate" -A 20 src/lib/game/shidasu/sabotageEffects.ts
```

現在の実装(`if (ref.kind === 'revelation') { ... } else { ... }`という分岐、既存コメント「神託を没収してもoracleLevelsは変更しない」を含む)を、天啓側・神託側それぞれで実際の配列内`idx`を求め直し`confiscatedTarget`を追加する形に置き換える:

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
    return {
      run: { revelations: [...run.revelations.slice(0, idx), ...run.revelations.slice(idx + 1)] },
      confiscatedTarget: { kind: 'revelationOrOracle', ref, idx },
    }
  }
  // 神託を没収してもoracleLevelsは変更しない: run.oraclesに温存中の神託はまだuseOracleで
  // 消費していないためoracleLevelsに未反映であり、没収してもそこに減らすべき実績が無い
  const idx = run.oracles.indexOf(ref.id)
  return {
    run: { oracles: [...run.oracles.slice(0, idx), ...run.oracles.slice(idx + 1)] },
    confiscatedTarget: { kind: 'revelationOrOracle', ref, idx },
  }
}
```

**注意:** 既存実装の神託側コメント文言は、実際にファイルを開いて確認した既存コードのコメントをそのまま維持すること(上記は再現した内容であり、実際のコメント文言と一字一句異なる場合は既存の文言を優先する)。

- [ ] **Step 7: `triggerSabotage`が`confiscatedTarget`を`lastSabotage`へ含めるよう修正**

`src/lib/game/shidasu/engine.ts`の`triggerSabotage`関数内、`lastSabotage`の組み立て部分(1153行目):

```ts
      lastSabotage: { id, seq: (wave.lastSabotage?.seq ?? 0) + 1, affectedCols: result.affectedTableauCols, purgedToDiscardCount: result.purgedToDiscardCount },
```

を以下に置き換える:

```ts
      lastSabotage: { id, seq: (wave.lastSabotage?.seq ?? 0) + 1, affectedCols: result.affectedTableauCols, purgedToDiscardCount: result.purgedToDiscardCount, confiscatedTarget: result.confiscatedTarget },
```

- [ ] **Step 8: テストを実行して成功を確認**

Run: `npm test -- engine.test.ts -t "confiscatedTarget"`
Expected: PASS(7件すべて)

- [ ] **Step 9: 型チェックとフルテストを実行**

Run: `npm run check`
Run: `npm test -- engine.test.ts`
Expected: どちらもエラーなし

- [ ] **Step 10: コミット**

```bash
git add src/lib/game/shidasu/sabotageEffects.ts src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 没収系4種の効果関数がconfiscatedTargetを返すようにする"
```

---

### Task 3: PlayArea.svelteにconfiscateFadingTarget状態と検知ロジックを追加する

**Files:**
- Modify: `src/routes/game/shidasu/PlayArea.svelte`(`SealFlashTarget`型定義の直後、状態・関数追加)
- Modify: `src/routes/game/shidasu/PlayArea.svelte`(`anyAnimationActive`)
- Modify: `src/routes/game/shidasu/PlayArea.svelte`(`$effect.pre`、`lastSabotage`検知ブロック)
- Modify: `src/routes/game/shidasu/PlayArea.svelte`(props定義、`onConfiscateFadingChange`追加)
- Modify: `src/routes/game/shidasu/sabotageAnimations.css`(新規keyframes追加)

- [ ] **Step 1: `sabotageAnimations.css`に崩れ落ちるフェードのkeyframesを追加**

`src/routes/game/shidasu/sabotageAnimations.css`の末尾に以下を追記する(既存の`shidasu-seal-flash`定義は変更しない):

```css

/* 妨害行動「没収系」発動時、対象UI要素(護符バッジ・秘儀ボタン・天啓/神託バッジ・
   レリックバッジ)が完全に消える瞬間の演出。一瞬光ってから、下に落ちながら暗く
   フェードアウトする。forwardsを指定し、アニメーション終了後もopacity:0の状態を
   維持する(500ms後にconfiscateFadingTargetがnullになりDOMから除去されるまでの
   一瞬のちらつきを防ぐ)。 */
@keyframes shidasu-confiscate-fade {
  0% { transform: translateY(0); opacity: 1; filter: brightness(1); }
  30% { transform: translateY(-6px); filter: brightness(2); }
  100% { transform: translateY(20px); opacity: 0; filter: brightness(0.5); }
}

.shidasu-confiscate-fade {
  animation: shidasu-confiscate-fade 0.5s ease-in forwards;
}
```

- [ ] **Step 2: `ConfiscatedTarget`型・状態・トリガー関数を追加**

`src/routes/game/shidasu/PlayArea.svelte`の`startSealFlashAnimation`関数(グループAで実装済み、`export type SealFlashTarget = ...`定義の後に続けて定義されている)の直後、`startStockShuffleAnimation`関数の直前に以下を挿入する。挿入位置を実ファイルで確認するには:

```bash
grep -n "function startSealFlashAnimation\|function startStockShuffleAnimation" src/routes/game/shidasu/PlayArea.svelte
```

以下を追加する:

```ts

  // 妨害行動「没収系」(talismanConfiscate・riteConfiscate・revelationOracleConfiscate・
  // relicConfiscate)発動時の崩れ落ちるフェード演出用。lastSabotage.confiscatedTargetと
  // 同じ型をそのまま再利用する。+page.svelte側からも同じ型をimportして使うため、exportする。
  export type ConfiscatedTarget = Exclude<WaveState['lastSabotage'], undefined>['confiscatedTarget']

  let confiscateFadingTarget = $state<ConfiscatedTarget | null>(null)
  let confiscateFadingActive = $state(false)

  // confiscateFadingActiveは関数の先頭で同期的にtrueへ切り替える(CLAUDE.mdの「移動アニメーション
  // 実装時の注意」・discardPurgeActive/sealFlashActiveと同じ原則)。実データ(run.items等)は
  // triggerSabotage実行と同時に削除済みのため、confiscateFadingTargetは「削除される直前の対象」
  // を一時的に保持し、各バッジ描画箇所がこれを見て「本来のリスト+フェード中要素」を補完する。
  // 500ms後に演出を終了しconfiscateFadingTargetをnullへ戻すと、補完されていた要素も自然に消える。
  function startConfiscateFadeAnimation(target: NonNullable<ConfiscatedTarget>) {
    confiscateFadingActive = true
    confiscateFadingTarget = target
    onConfiscateFadingChange?.(target)
    const timer = setTimeout(() => {
      confiscateFadingActive = false
      confiscateFadingTarget = null
      onConfiscateFadingChange?.(null)
    }, 500)
    dealTimers.push(timer)
  }

  // list(本来のリスト、既に削除済み)にfadingId(フェード中の要素のid)を補完した配列を返す。
  // fadingId未指定の場合はlistをそのまま返す。挿入位置はidx(没収前の元の位置)。
  // +page.svelte・デバッグ画面(shidasu-debug)からもimportして使うため、exportする。
  export function withFadingId<T>(list: T[], fadingId: T | undefined, idx: number): T[] {
    if (fadingId === undefined) return list
    const pos = Math.min(idx, list.length)
    return [...list.slice(0, pos), fadingId, ...list.slice(pos)]
  }
```

- [ ] **Step 3: `anyAnimationActive`に`confiscateFadingActive`を含める**

`anyAnimationActive`の`$derived`定義を探す:

```bash
grep -n "let anyAnimationActive = \$derived" src/routes/game/shidasu/PlayArea.svelte
```

現在の内容:

```ts
  let anyAnimationActive = $derived(playingAnimation !== null || scoreReveal !== null || cleanupAnimation !== null || chainResetAnimation !== null || dealAnimationActive || sabotageRedistributeAnimation !== null || sabotageAnimatingColumns.size > 0 || flippingCards.length > 0 || discardPurgeActive || stockShuffleActive || sealFlashActive)
```

を以下に置き換える:

```ts
  let anyAnimationActive = $derived(playingAnimation !== null || scoreReveal !== null || cleanupAnimation !== null || chainResetAnimation !== null || dealAnimationActive || sabotageRedistributeAnimation !== null || sabotageAnimatingColumns.size > 0 || flippingCards.length > 0 || discardPurgeActive || stockShuffleActive || sealFlashActive || confiscateFadingActive)
```

- [ ] **Step 4: `$effect.pre`で没収系4種の発動を検知する**

既存の`lastSabotage`検知ブロックを探す:

```bash
grep -n "let previousSabotageSeq" src/routes/game/shidasu/PlayArea.svelte
```

現在の内容(グループA実装後の状態):

```ts
  let previousSabotageSeq = wave.lastSabotage?.seq ?? 0
  $effect.pre(() => {
    const current = wave.lastSabotage
    if (!current || current.seq === previousSabotageSeq) return
    previousSabotageSeq = current.seq
    if ((current.id === 'tableauFullReturn' || current.id === 'columnReturn') && current.affectedCols) {
      startSabotageRedistributeAnimation(current.affectedCols)
    } else if ((current.id === 'stockPurge' || current.id === 'stockPurgeSmall') && current.purgedToDiscardCount) {
      startStockPurgeAnimation(current.purgedToDiscardCount)
    } else if (current.id === 'talismanSeal' || current.id === 'riteSeal' || current.id === 'revelationOracleSeal' || current.id === 'roleSeal' || current.id === 'comboCap') {
      if (wave.activeSeal && wave.activeSeal.kind !== 'talismanHidden' && wave.activeSeal.kind !== 'roleBias') {
        startSealFlashAnimation(wave.activeSeal)
      }
    }
  })
```

を以下に置き換える(既存の3つの分岐はそのまま残し、4つ目の`else if`を追加する):

```ts
  let previousSabotageSeq = wave.lastSabotage?.seq ?? 0
  $effect.pre(() => {
    const current = wave.lastSabotage
    if (!current || current.seq === previousSabotageSeq) return
    previousSabotageSeq = current.seq
    if ((current.id === 'tableauFullReturn' || current.id === 'columnReturn') && current.affectedCols) {
      startSabotageRedistributeAnimation(current.affectedCols)
    } else if ((current.id === 'stockPurge' || current.id === 'stockPurgeSmall') && current.purgedToDiscardCount) {
      startStockPurgeAnimation(current.purgedToDiscardCount)
    } else if (current.id === 'talismanSeal' || current.id === 'riteSeal' || current.id === 'revelationOracleSeal' || current.id === 'roleSeal' || current.id === 'comboCap') {
      if (wave.activeSeal && wave.activeSeal.kind !== 'talismanHidden' && wave.activeSeal.kind !== 'roleBias') {
        startSealFlashAnimation(wave.activeSeal)
      }
    } else if (current.id === 'talismanConfiscate' || current.id === 'riteConfiscate' || current.id === 'revelationOracleConfiscate' || current.id === 'relicConfiscate') {
      if (current.confiscatedTarget) {
        startConfiscateFadeAnimation(current.confiscatedTarget)
      }
    }
  })
```

- [ ] **Step 5: `onConfiscateFadingChange`コールバックpropsを追加**

props定義の分割代入部分(`onSealFlashChange`が定義されている行)を探す:

```bash
grep -n "onScoreRevealDone, waveKey, onCleanupDone, onSealFlashChange," src/routes/game/shidasu/PlayArea.svelte
```

この行を以下に置き換える:

```ts
    onScoreRevealDone, waveKey, onCleanupDone, onSealFlashChange, onConfiscateFadingChange,
```

型定義部分(`onSealFlashChange?: (target: SealFlashTarget | null) => void`が定義されている行)を探す:

```bash
grep -n "onSealFlashChange?: (target: SealFlashTarget | null) => void" src/routes/game/shidasu/PlayArea.svelte
```

この行の直後に追加する:

```ts
    onConfiscateFadingChange?: (target: ConfiscatedTarget | null) => void
```

- [ ] **Step 6: 型チェックを実行**

Run: `npm run check`
Expected: エラーなし

- [ ] **Step 7: コミット**

```bash
git add src/routes/game/shidasu/PlayArea.svelte src/routes/game/shidasu/sabotageAnimations.css
git commit -m "feat: PlayAreaに没収系妨害行動のフェード演出状態と検知ロジックを追加する"
```

---

### Task 4: 秘儀ボタンにフェード演出を適用する

**Files:**
- Modify: `src/routes/game/shidasu/PlayArea.svelte`(秘儀ボタンブロック)

- [ ] **Step 1: 秘儀ボタンブロックに`displayedRites`とフェード判定を追加**

秘儀ボタンブロックの現在の内容を確認する:

```bash
grep -n "{#if rites.length > 0}" -A 15 src/routes/game/shidasu/PlayArea.svelte
```

現在の内容(グループA実装後の状態):

```svelte
{#if rites.length > 0}
  <div class="px-4 pb-4 flex items-center gap-2">
    {#each rites as riteId, i (i)}
      {@const usable = canUseRite(params, wave, riteId) && !anyAnimationActive && !disableRites}
      {@const flashing = sealFlashTarget?.kind === 'rite' && sealFlashTarget.id === riteId}
      <button
        type="button"
        onclick={() => onUseRite?.(riteId)}
        disabled={!usable}
        title={riteDesc(riteId, params)}
        style="font-family: 'ShidasuRunic', sans-serif;"
        class="w-10 h-10 rounded-lg border-2 flex items-center justify-center text-xl font-black transition-transform active:scale-95 {flashing ? 'shidasu-seal-flash' : ''} {usable ? 'bg-fuchsia-900 border-fuchsia-500 text-fuchsia-100 hover:bg-fuchsia-800' : 'bg-slate-800 border-slate-700 text-slate-600 cursor-not-allowed'}"
      >{params.rites[riteId].name}</button>
    {/each}
  </div>
{/if}
```

を以下に置き換える(`displayedRites`の算出、`riteFading`判定、`fading`時の`disabled`・クラス適用を追加):

```svelte
{#if rites.length > 0 || (confiscateFadingTarget?.kind === 'rite')}
  <div class="px-4 pb-4 flex items-center gap-2">
    {@const riteFading = confiscateFadingTarget?.kind === 'rite' ? confiscateFadingTarget : undefined}
    {@const displayedRites = withFadingId(rites, riteFading?.id, riteFading?.idx ?? 0)}
    {#each displayedRites as riteId, i (i)}
      {@const fading = riteFading !== undefined && i === riteFading.idx}
      {@const usable = !fading && canUseRite(params, wave, riteId) && !anyAnimationActive && !disableRites}
      {@const flashing = sealFlashTarget?.kind === 'rite' && sealFlashTarget.id === riteId}
      <button
        type="button"
        onclick={() => onUseRite?.(riteId)}
        disabled={!usable}
        title={riteDesc(riteId, params)}
        style="font-family: 'ShidasuRunic', sans-serif;"
        class="w-10 h-10 rounded-lg border-2 flex items-center justify-center text-xl font-black transition-transform active:scale-95 {fading ? 'shidasu-confiscate-fade' : ''} {flashing ? 'shidasu-seal-flash' : ''} {usable ? 'bg-fuchsia-900 border-fuchsia-500 text-fuchsia-100 hover:bg-fuchsia-800' : 'bg-slate-800 border-slate-700 text-slate-600 cursor-not-allowed'}"
      >{params.rites[riteId].name}</button>
    {/each}
  </div>
{/if}
```

`{#if rites.length > 0 || (confiscateFadingTarget?.kind === 'rite')}`という条件変更が必要な理由: 所持秘儀が没収によりちょうど0件になった瞬間(`rites.length === 0`)でも、フェード中の最後の1つは表示し続ける必要があるため。`fading`判定は`i === riteFading.idx`(挿入位置と一致するインデックス)で行う。

- [ ] **Step 2: 型チェックとビルドを実行**

Run: `npm run check`
Run: `npm run build`
Expected: どちらもエラーなし

- [ ] **Step 3: コミット**

```bash
git add src/routes/game/shidasu/PlayArea.svelte
git commit -m "feat: 秘儀ボタンに没収発動時のフェード演出を適用する"
```

---

### Task 5: +page.svelteでconfiscateFadingTargetを受け取り、護符・天啓・神託・レリックバッジに反映する

**Files:**
- Modify: `src/routes/game/shidasu/+page.svelte`(状態宣言、import)
- Modify: `src/routes/game/shidasu/+page.svelte`(`itemBadges`スニペット)
- Modify: `src/routes/game/shidasu/+page.svelte`(`<PlayArea>`呼び出し)

**注意:** このタスクを開始する前に、Task 3・4の変更(コミット済み)により`+page.svelte`側の`<PlayArea>`呼び出しや`itemBadges`スニペットの正確な行番号がズレている可能性は低い(`+page.svelte`自体は今回まだ変更していないため)が、念のため以下のコマンドで実際の行番号を確認してから作業すること:

```bash
grep -n "import type { SealFlashTarget }\|let sealFlashTarget\|{#snippet itemBadges()}\|onSealFlashChange=" src/routes/game/shidasu/+page.svelte
```

- [ ] **Step 1: `ConfiscatedTarget`型のimportと`confiscateFadingTarget`用の`$state`を追加**

`import type { SealFlashTarget } from './PlayArea.svelte'`の行(現在35行目)を以下に置き換える:

```ts
  import type { SealFlashTarget, ConfiscatedTarget } from './PlayArea.svelte'
  import { withFadingId } from './PlayArea.svelte'
```

`let sealFlashTarget = $state<SealFlashTarget | null>(null)`の行(現在113行目)の直後に追加する:

```ts

  // PlayArea側で発動検知したconfiscateFadingTarget(没収系妨害行動のフェード演出対象)を
  // 受け取って保持する。itemBadges(護符・天啓・神託・レリックバッジ)はPlayAreaの外側に
  // あるため、コールバックprops経由で値を受け渡す。
  let confiscateFadingTarget = $state<ConfiscatedTarget | null>(null)
```

- [ ] **Step 2: `<PlayArea>`呼び出しに`onConfiscateFadingChange`を渡す**

本編用`<PlayArea>`呼び出し(`onSealFlashChange={(target) => { sealFlashTarget = target }}`を含む行、現在697行目)の直後に追加する:

```svelte
    onConfiscateFadingChange={(target) => { confiscateFadingTarget = target }}
```

**注意:** 天啓プレビュー用の`<PlayArea>`呼び出し(`disableRites={true}`を渡している方)には追加不要。没収系妨害行動は`playing`フェーズ中のみ発動するため。

- [ ] **Step 3: `itemBadges`スニペットに`withFadingId`ヘルパーと各バッジへのフェード適用を追加**

`itemBadges`スニペットの現在の内容(552-600行目):

```svelte
{#snippet itemBadges()}
  <div class="flex-1 flex flex-col gap-1 items-end">
    <div class="flex flex-wrap gap-1 justify-end">
      {#each [...new Set(run.items)] as id (id)}
        {@const n = run.items.filter(x => x === id).length}
        {@const talismanHidden = wave?.activeSeal?.kind === 'talismanHidden'}
        {@const talismanSealed = wave?.activeSeal?.kind === 'talisman' && wave.activeSeal.id === id}
        {@const talismanFlashing = sealFlashTarget?.kind === 'talisman' && sealFlashTarget.id === id}
        <span
          class="text-xs rounded px-1.5 py-0.5 {highlightedItemId === id ? 'ring-2 ring-yellow-400' : ''} {talismanFlashing ? 'shidasu-seal-flash' : ''} {talismanHidden || talismanSealed ? 'border' : 'bg-emerald-900 text-yellow-200/90 border border-yellow-600/40'}"
          style={talismanHidden || talismanSealed ? 'background:#1c1917; color:#78350f; border-color: rgba(217,119,6,0.5); background-image: repeating-linear-gradient(45deg,transparent,transparent 5px,rgba(217,119,6,0.35) 5px,rgba(217,119,6,0.35) 6px);' : ''}
          title={talismanHidden ? '護符並び替え: 次の妨害発動まで内容が見えない' : talismanSealed ? '護符封印: 次の妨害発動まで効果が無効' : itemDesc(id, params)}
        >
          {talismanHidden ? '？？？' : itemName(id, params)}{n > 1 ? `×${n}` : ''}
        </span>
      {/each}
    </div>
    {#if run.revelations.length > 0}
      <div class="flex flex-wrap gap-1 justify-end">
        {#each run.revelations as id, i (i)}
          <span class="text-xs bg-indigo-900 text-indigo-200/90 border border-indigo-600/40 rounded px-1.5 py-0.5 flex items-center gap-1" title={revelationDesc(id, params)}>
            {revelationName(id, params)}
            <button onclick={() => handleSellRevelation(id)} class="text-indigo-300/70 underline">売</button>
          </span>
        {/each}
      </div>
    {/if}
    {#if run.oracles.length > 0}
      <div class="flex flex-wrap gap-1 justify-end">
        {#each run.oracles as roleName, i (i)}
          <span class="text-xs bg-purple-900 text-purple-200/90 border border-purple-600/40 rounded px-1.5 py-0.5 flex items-center gap-1" title={oracleDesc(roleName, params)}>
            {oracleName(roleName, params)}
            <button onclick={() => handleUseOracle(roleName)} class="text-purple-300/70 underline">使</button>
            <button onclick={() => handleSellOracle(roleName)} class="text-purple-300/70 underline">売</button>
          </span>
        {/each}
      </div>
    {/if}
    {#if run.relics.length > 0}
      <div class="flex flex-wrap gap-1 justify-end">
        {#each run.relics as relic, i (i)}
          <span class="text-xs bg-amber-900 text-amber-200/90 border border-amber-600/40 rounded px-1.5 py-0.5" title={relic.tsukumoka ? relicTsukumokaDesc(relic.id, params) : relicDesc(relic.id, params)}>
            {relicName(relic.id, params)}{relic.tsukumoka ? ' ★' : ''}
          </span>
        {/each}
      </div>
    {/if}
  </div>
{/snippet}
```

を以下に置き換える(護符バッジは`talismanFading`を`Set`集約の対象配列に補完し、天啓・神託は`withFadingId`、レリックは専用インライン処理を追加):

```svelte
{#snippet itemBadges()}
  <div class="flex-1 flex flex-col gap-1 items-end">
    <div class="flex flex-wrap gap-1 justify-end">
      {@const talismanFading = confiscateFadingTarget?.kind === 'talisman' ? confiscateFadingTarget : undefined}
      {@const displayedItemIds = [...new Set(talismanFading ? [...run.items.slice(0, Math.min(talismanFading.idx, run.items.length)), talismanFading.id, ...run.items.slice(Math.min(talismanFading.idx, run.items.length))] : run.items)]}
      {#each displayedItemIds as id (id)}
        {@const n = run.items.filter(x => x === id).length}
        {@const talismanHidden = wave?.activeSeal?.kind === 'talismanHidden'}
        {@const talismanSealed = wave?.activeSeal?.kind === 'talisman' && wave.activeSeal.id === id}
        {@const talismanFlashing = sealFlashTarget?.kind === 'talisman' && sealFlashTarget.id === id}
        {@const talismanConfiscateFading = talismanFading?.id === id && n === 0}
        <span
          class="text-xs rounded px-1.5 py-0.5 {highlightedItemId === id ? 'ring-2 ring-yellow-400' : ''} {talismanConfiscateFading ? 'shidasu-confiscate-fade' : ''} {talismanFlashing ? 'shidasu-seal-flash' : ''} {talismanHidden || talismanSealed ? 'border' : 'bg-emerald-900 text-yellow-200/90 border border-yellow-600/40'}"
          style={talismanHidden || talismanSealed ? 'background:#1c1917; color:#78350f; border-color: rgba(217,119,6,0.5); background-image: repeating-linear-gradient(45deg,transparent,transparent 5px,rgba(217,119,6,0.35) 5px,rgba(217,119,6,0.35) 6px);' : ''}
          title={talismanHidden ? '護符並び替え: 次の妨害発動まで内容が見えない' : talismanSealed ? '護符封印: 次の妨害発動まで効果が無効' : itemDesc(id, params)}
        >
          {talismanHidden ? '？？？' : itemName(id, params)}{n > 1 ? `×${n}` : ''}
        </span>
      {/each}
    </div>
    {#if run.revelations.length > 0 || confiscateFadingTarget?.kind === 'revelationOrOracle' && confiscateFadingTarget.ref.kind === 'revelation'}
      <div class="flex flex-wrap gap-1 justify-end">
        {@const revelationFading = confiscateFadingTarget?.kind === 'revelationOrOracle' && confiscateFadingTarget.ref.kind === 'revelation' ? confiscateFadingTarget : undefined}
        {@const displayedRevelations = withFadingId(run.revelations, revelationFading?.ref.id, revelationFading?.idx ?? 0)}
        {#each displayedRevelations as id, i (i)}
          {@const fading = revelationFading !== undefined && i === revelationFading.idx}
          <span class="text-xs bg-indigo-900 text-indigo-200/90 border border-indigo-600/40 rounded px-1.5 py-0.5 flex items-center gap-1 {fading ? 'shidasu-confiscate-fade' : ''}" title={revelationDesc(id, params)}>
            {revelationName(id, params)}
            <button onclick={() => handleSellRevelation(id)} class="text-indigo-300/70 underline">売</button>
          </span>
        {/each}
      </div>
    {/if}
    {#if run.oracles.length > 0 || confiscateFadingTarget?.kind === 'revelationOrOracle' && confiscateFadingTarget.ref.kind === 'oracle'}
      <div class="flex flex-wrap gap-1 justify-end">
        {@const oracleFading = confiscateFadingTarget?.kind === 'revelationOrOracle' && confiscateFadingTarget.ref.kind === 'oracle' ? confiscateFadingTarget : undefined}
        {@const displayedOracles = withFadingId(run.oracles, oracleFading?.ref.id, oracleFading?.idx ?? 0)}
        {#each displayedOracles as roleName, i (i)}
          {@const fading = oracleFading !== undefined && i === oracleFading.idx}
          <span class="text-xs bg-purple-900 text-purple-200/90 border border-purple-600/40 rounded px-1.5 py-0.5 flex items-center gap-1 {fading ? 'shidasu-confiscate-fade' : ''}" title={oracleDesc(roleName, params)}>
            {oracleName(roleName, params)}
            <button onclick={() => handleUseOracle(roleName)} class="text-purple-300/70 underline">使</button>
            <button onclick={() => handleSellOracle(roleName)} class="text-purple-300/70 underline">売</button>
          </span>
        {/each}
      </div>
    {/if}
    {#if run.relics.length > 0 || confiscateFadingTarget?.kind === 'relic'}
      <div class="flex flex-wrap gap-1 justify-end">
        {@const relicFading = confiscateFadingTarget?.kind === 'relic' ? confiscateFadingTarget : undefined}
        {@const relicFadingPos = relicFading ? Math.min(relicFading.idx, run.relics.length) : -1}
        {@const displayedRelics = relicFading
          ? [...run.relics.slice(0, relicFadingPos), { id: relicFading.id, tsukumoka: false }, ...run.relics.slice(relicFadingPos)]
          : run.relics}
        {#each displayedRelics as relic, i (i)}
          {@const fading = relicFading !== undefined && i === relicFadingPos}
          <span class="text-xs bg-amber-900 text-amber-200/90 border border-amber-600/40 rounded px-1.5 py-0.5 {fading ? 'shidasu-confiscate-fade' : ''}" title={relic.tsukumoka ? relicTsukumokaDesc(relic.id, params) : relicDesc(relic.id, params)}>
            {relicName(relic.id, params)}{relic.tsukumoka ? ' ★' : ''}
          </span>
        {/each}
      </div>
    {/if}
  </div>
{/snippet}
```

**注意(護符バッジの補完ロジックについて):** 護符バッジは`Set`で集約表示されるため、`talismanConfiscateFading`の判定は「フェード中の対象idと一致し、かつ実際の所持数`n`が0(=このidはもう`run.items`には存在せず、フェード中の要素だけでこのバッジが表示されている)」で行う。護符が複数所持されていて1つだけ没収された場合(`n`が1以上残っている)は、バッジの表示数`×n`が減るだけでフェード演出は不要(視覚的には「×2」が「×1」に変わるだけで、バッジ自体は消えない)。

天啓・神託は、Task 3で`PlayArea.svelte`から`export`した`withFadingId`関数をそのまま`import`して使う(重複定義を避けるため、`+page.svelte`側で同名の関数を新規定義しない)。

この関数を追加する具体的な位置を確認する:

```bash
grep -n "{#snippet itemBadges()}" src/routes/game/shidasu/+page.svelte
```

- [ ] **Step 4: 型チェックとビルドを実行**

Run: `npm run check`
Run: `npm run build`
Expected: どちらもエラーなし

- [ ] **Step 5: コミット**

```bash
git add src/routes/game/shidasu/+page.svelte
git commit -m "feat: 護符・天啓・神託・レリックバッジに没収発動時のフェード演出を実装する"
```

---

### Task 6: デバッグ画面に護符没収の演出確認機能を追加する

**Files:**
- Modify: `src/routes/admin/shidasu-debug/+page.svelte`

グループA実装時、デバッグ画面(`/admin/shidasu-debug`)が本編(`+page.svelte`)とは別の独自`itemBadges`スニペット・`<PlayArea>`呼び出しを持っており、封印系の演出確認ができない問題が発生した経緯がある(`77104f4`でデバッグ画面にも`sealFlashTarget`配線・`RoleStatusPanel`表示を追加済み)。

デバッグ画面には現状、秘儀所持(`rites`props)・天啓所持(`revelations`)・神託所持(`oracles`)・レリック所持(`relics`)を`PlayArea`へ渡す仕組みが無く、`itemBadges`スニペット(298-313行目)も護符バッジのみを表示する独自実装になっている。そのため`riteConfiscate`・`revelationOracleConfiscate`・`relicConfiscate`はデバッグ画面では目視確認できない(コードレビュー・エンジンテストでの確認に留める)。今回は`talismanConfiscate`(護符没収)のみ、デバッグ画面で確認できるようにする。

- [ ] **Step 1: `ConfiscatedTarget`型のimportと`confiscateFadingTarget`用の`$state`を追加**

`src/routes/admin/shidasu-debug/+page.svelte`の20行目:

```ts
  import type { SealFlashTarget } from '../../game/shidasu/PlayArea.svelte'
```

を以下に置き換える(デバッグ画面の`itemBadges`は護符バッジのみで`Set`集約のインライン処理で対応するため、`withFadingId`のimportは不要):

```ts
  import type { SealFlashTarget, ConfiscatedTarget } from '../../game/shidasu/PlayArea.svelte'
```

`let sealFlashTarget = $state<SealFlashTarget | null>(null)`の行を探す:

```bash
grep -n "let sealFlashTarget = \$state" src/routes/admin/shidasu-debug/+page.svelte
```

その行の直後に追加する:

```ts

  let confiscateFadingTarget = $state<ConfiscatedTarget | null>(null)
```

- [ ] **Step 2: `<PlayArea>`呼び出しに`onConfiscateFadingChange`を追加**

`src/routes/admin/shidasu-debug/+page.svelte`354行目(`onSealFlashChange={(target) => { sealFlashTarget = target }}`)の直後に追加する:

```svelte
          onConfiscateFadingChange={(target) => { confiscateFadingTarget = target }}
```

- [ ] **Step 3: `itemBadges`スニペットに護符没収のフェード対応を追加**

`src/routes/admin/shidasu-debug/+page.svelte`の298-313行目:

```svelte
{#snippet itemBadges()}
  <div class="flex-1 flex flex-wrap gap-1 justify-end">
    {#each [...new Set(items)] as id (id)}
      {@const n = items.filter(x => x === id).length}
      {@const talismanSealed = wave.activeSeal?.kind === 'talisman' && wave.activeSeal.id === id}
      {@const talismanFlashing = sealFlashTarget?.kind === 'talisman' && sealFlashTarget.id === id}
      <span
        class="text-xs rounded px-1.5 py-0.5 {highlightedItemId === id ? 'ring-2 ring-yellow-400' : ''} {talismanFlashing ? 'shidasu-seal-flash' : ''} {talismanSealed ? 'border' : 'bg-emerald-900 text-yellow-200/90 border border-yellow-600/40'}"
        style={talismanSealed ? 'background:#1c1917; color:#78350f; border-color: rgba(217,119,6,0.5); background-image: repeating-linear-gradient(45deg,transparent,transparent 5px,rgba(217,119,6,0.35) 5px,rgba(217,119,6,0.35) 6px);' : ''}
        title={talismanSealed ? '護符封印: 次の妨害発動まで効果が無効' : itemDesc(id, params)}
      >
        {itemName(id, params)}{n > 1 ? `×${n}` : ''}
      </span>
    {/each}
  </div>
{/snippet}
```

を以下に置き換える(Task 5の護符バッジと同じ`talismanFading`・`talismanConfiscateFading`ロジックを適用):

```svelte
{#snippet itemBadges()}
  <div class="flex-1 flex flex-wrap gap-1 justify-end">
    {@const talismanFading = confiscateFadingTarget?.kind === 'talisman' ? confiscateFadingTarget : undefined}
    {@const displayedItemIds = [...new Set(talismanFading ? [...items.slice(0, Math.min(talismanFading.idx, items.length)), talismanFading.id, ...items.slice(Math.min(talismanFading.idx, items.length))] : items)]}
    {#each displayedItemIds as id (id)}
      {@const n = items.filter(x => x === id).length}
      {@const talismanSealed = wave.activeSeal?.kind === 'talisman' && wave.activeSeal.id === id}
      {@const talismanFlashing = sealFlashTarget?.kind === 'talisman' && sealFlashTarget.id === id}
      {@const talismanConfiscateFading = talismanFading?.id === id && n === 0}
      <span
        class="text-xs rounded px-1.5 py-0.5 {highlightedItemId === id ? 'ring-2 ring-yellow-400' : ''} {talismanConfiscateFading ? 'shidasu-confiscate-fade' : ''} {talismanFlashing ? 'shidasu-seal-flash' : ''} {talismanSealed ? 'border' : 'bg-emerald-900 text-yellow-200/90 border border-yellow-600/40'}"
        style={talismanSealed ? 'background:#1c1917; color:#78350f; border-color: rgba(217,119,6,0.5); background-image: repeating-linear-gradient(45deg,transparent,transparent 5px,rgba(217,119,6,0.35) 5px,rgba(217,119,6,0.35) 6px);' : ''}
        title={talismanSealed ? '護符封印: 次の妨害発動まで効果が無効' : itemDesc(id, params)}
      >
        {itemName(id, params)}{n > 1 ? `×${n}` : ''}
      </span>
    {/each}
  </div>
{/snippet}
```

`items`(デバッグ画面の所持護符state、`ItemId[]`型)は`run.items`ではなくデバッグ画面独自の`$state`変数であり、`+page.svelte`側の`talismanFading`ロジックと同じ考え方をそのまま適用できる。

- [ ] **Step 4: 型チェックとビルドを実行**

Run: `npm run check`
Run: `npm run build`
Expected: どちらもエラーなし

- [ ] **Step 5: コミット**

```bash
git add src/routes/admin/shidasu-debug/+page.svelte
git commit -m "feat: デバッグ画面に護符没収の演出確認機能を追加する"
```

---

### Task 7: デバッグ画面での動作確認

**Files:** なし(コード変更を伴わない確認タスク)

- [ ] **Step 1: 開発サーバーを起動**

Run: `npm run dev`

- [ ] **Step 2: `/admin/shidasu-debug`で各没収系妨害行動を発動して目視確認する**

ブラウザで`http://localhost:5173/admin/shidasu-debug`を開き、以下を確認する(Playwrightのadhocスクリプトを使う場合は`.superpowers/`配下に作成し、確認後に削除する):

- **talismanConfiscate**(護符没収): 護符を2つ以上所持した状態(ItemChecklistのチェックボックスで護符を選択)で発動する。対象護符バッジが崩れ落ちるフェードで消えることを確認する。さらに同名護符を複数個(例えば同じ護符を2つ)所持した状態でも発動し、`×n`表示が`×(n-1)`に減るだけでバッジ自体は消えない(フェード演出が発生しない)ことを確認する
- 演出中(約500ms)は他の操作(カードプレイ・山札引き)がブロックされ、完了後は正常に操作できることを確認する
- 演出完了後、対象が実際にリストから消えている(データとしても正しく没収されている)ことを確認する
- **riteConfiscate**・**relicConfiscate**・**revelationOracleConfiscate**: デバッグ画面には秘儀・レリック・天啓・神託の所持手段が無いため目視確認はできない。Task 1〜2で追加したエンジンレベルのテスト(`confiscatedTarget`の正確性)と、Task 4・5のコード品質レビューで正しさを担保する

- [ ] **Step 3: 型チェック・ビルド・既存テストの最終確認**

Run: `npm run check`
Run: `npm run build`
Run: `npm test -- engine.test.ts`
Expected: いずれもエラーなし
