# 天啓「虚」(レリック付喪化) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 所持レリックを選択して付喪化させる天啓「虚」を実装する。

**Architecture:** 天啓Phase B(RunStateレベル即時効果)パターンを踏襲し、`applyRevelationEffect`はno-op、実処理は`grantRevelationReward`に追加する。既存の場札列選択機構(`pendingRevelationTarget`)とは独立した、レリック専用の新しい選択状態・UIを`+page.svelte`に追加する。`canUseRevelation`は`relics`パラメータを追加して拡張する(既存のPlayArea propパターンに合わせ、`RunState`全体ではなく`relics`配列のみを渡す)。

**Tech Stack:** SvelteKit, Svelte 5 runes, TypeScript, Vitest

---

## File Structure

- `src/lib/game/shidasu/types.ts` — `RevelationId`に`'kyo'`を再追加
- `src/lib/game/shidasu/revelations.ts` — `REVELATION_POOL`に`'kyo'`を再追加
- `src/lib/game/shidasu/params.ts` / `shidasu.config.json` — `revelations.kyo`のデータ追加
- `src/lib/game/shidasu/revelationEffects.ts` — `canUseRevelation`に`relics`パラメータを追加、`kyo`のケースを実装
- `src/lib/game/shidasu/revelationEffects.test.ts` — `canUseRevelation`のテスト追加
- `src/lib/game/shidasu/engine.ts` — `useRevelation`・`grantRevelationReward`に`targetRelicId`パラメータを追加、`canUseRevelation`呼び出し3箇所を更新
- `src/lib/game/shidasu/engine.test.ts` — `useRevelation`+`grantRevelationReward`の統合テスト追加
- `src/routes/game/shidasu/PlayArea.svelte` — `canUseRevelation`呼び出しに`relics`propを渡す、新しい`relics`propを追加
- `src/routes/game/shidasu/+page.svelte` — 新しい選択状態`pendingRelicTargetRevelationId`、レリック選択UI、`handleUseRevelationClick`の分岐追加

---

### Task 1: 天啓「虚」の型・データを追加する

**Files:**
- Modify: `src/lib/game/shidasu/types.ts:87-93`
- Modify: `src/lib/game/shidasu/revelations.ts:9-11`
- Modify: `src/lib/game/shidasu/params.ts:209`, `params.ts:478`
- Modify: `src/lib/game/shidasu/shidasu.config.json`(`"revelations"`ブロック内)

- [ ] **Step 1: `types.ts`に`kyo`を再追加**

`src/lib/game/shidasu/types.ts`の`RevelationId`ユニオン型定義は現在以下のようになっている:

```ts
// 天啓(Revelation): いつでも使用可能で、場札・デッキ構成の両方に永続的な効果を発揮する消費アイテム。
// 二十八宿のうち今回効果を実装した26種のみをメンバーとする(残り2種はmansions.tsの見た目候補にのみ存在)。
export type RevelationId =
  | 'kaku' | 'kou' | 'tei' | 'bou'
  | 'shin' | 'bi' | 'ki' | 'to'
  | 'gyu' | 'jo'
  | 'aya'
  | 'shitsu'
  ...(以下続く)
```

`| 'gyu' | 'jo'`の行の直後に`| 'kyo'`の行を追加し、コメントの件数を「26種」→「27種」、「残り2種」→「残り1種」に更新する:

```ts
// 天啓(Revelation): いつでも使用可能で、場札・デッキ構成の両方に永続的な効果を発揮する消費アイテム。
// 二十八宿のうち今回効果を実装した27種のみをメンバーとする(残り1種はmansions.tsの見た目候補にのみ存在)。
export type RevelationId =
  | 'kaku' | 'kou' | 'tei' | 'bou'
  | 'shin' | 'bi' | 'ki' | 'to'
  | 'gyu' | 'jo'
  | 'kyo'
  | 'aya'
  | 'shitsu'
  ...(以下続く)
```

- [ ] **Step 2: `revelations.ts`の`REVELATION_POOL`に`kyo`を再追加**

`src/lib/game/shidasu/revelations.ts`の`REVELATION_POOL`配列とその直前のコメントを確認し、削除前と同じ位置(`jo`の直後)に`'kyo',`の行を追加する。コメントに件数(26→27)の記載があれば更新する。

- [ ] **Step 3: `params.ts`の型定義に`kyo`を再追加**

`src/lib/game/shidasu/params.ts`の`revelations`型定義内、`jo: { name: string; desc: string }`の行の直後に以下を追加する:

```ts
    kyo: { name: string; desc: string }
```

- [ ] **Step 4: `params.ts`の`DEFAULT_PARAMS.revelations`に`kyo`を再追加**

`DEFAULT_PARAMS.revelations`オブジェクト内、`jo: { name: '女', desc: '...' },`の行の直後に以下を追加する:

```ts
    kyo: { name: '虚', desc: '所持レリックの中から選んだ1つを付喪化させる(既に付喪化済みのレリックは選べない)' },
```

- [ ] **Step 5: `shidasu.config.json`に`kyo`を再追加**

`src/lib/game/shidasu/shidasu.config.json`の`"revelations"`ブロック内、`"jo"`エントリの直後に以下を追加する(JSON形式、カンマの整合性に注意):

```json
    "kyo": {
      "name": "虚",
      "desc": "所持レリックの中から選んだ1つを付喪化させる(既に付喪化済みのレリックは選べない)"
    },
```

- [ ] **Step 6: 型チェック**

Run: `npm run check`
Expected: `kyo`が`applyRevelationEffect`のswitch文で未処理のままでも、`default`ケースがある限りエラーにはならない(no-opとして扱われる)。エラーが出ないことを確認する。

- [ ] **Step 7: 全体テスト実行**

Run: `npm run test`
Expected: PASS(既存の`REVELATION_POOL`件数を検証するテストがあれば失敗する可能性がある。次のステップで修正する)

- [ ] **Step 8: 件数アサーションの調整**

`npm run test`の結果を確認し、`REVELATION_POOL`の長さ(26→27)や`RevelationId`の件数を検証しているテストが失敗していれば、実際の値に合わせて修正する(`Grep`で`REVELATION_POOL`を検索し、`revelations.test.ts`等の該当箇所を特定する)。

- [ ] **Step 9: テスト再実行**

Run: `npm run test`
Expected: PASS

- [ ] **Step 10: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/revelations.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json
git commit -m "feat: 天啓「虚」(レリック付喪化)の型・データを追加"
```

(このタスクの時点では効果ロジックは未実装(no-op)のまま。Task 2以降で実装する。)

---

### Task 2: `canUseRevelation`にレリック判定ロジックを追加する

**Files:**
- Modify: `src/lib/game/shidasu/revelationEffects.ts:219-227`
- Modify: `src/lib/game/shidasu/engine.ts`(`canUseRevelation`呼び出し3箇所)
- Modify: `src/routes/game/shidasu/PlayArea.svelte`(`canUseRevelation`呼び出し1箇所、propの追加)
- Test: `src/lib/game/shidasu/revelationEffects.test.ts`

現状の`canUseRevelation`は以下のようになっている:

```ts
export function canUseRevelation(_params: ShidasuParams, _wave: WaveState, _revelationId: RevelationId): boolean {
  return true
}
```

これに`relics`パラメータを追加し、`kyo`のケースで「未付喪化の所持レリックが1つ以上あるか」を判定するようにする。`RunState`全体ではなく`relics`配列のみを受け取る(`PlayArea.svelte`が現在`items`/`rites`/`revelations`のような狭いpropのみを受け取っており、`RunState`全体を渡すパターンではないため、既存の設計に合わせる)。

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/revelationEffects.test.ts`の`canUseRevelation`関連テスト(`describe('canUseRevelation'`を検索して既存のテストの近くに配置する)に以下を追記する:

```ts
describe('canUseRevelation: 虚(レリック付喪化)', () => {
  const wave = baseWave({ tableau: [[card(1, '♠', 1)]] })

  it('所持レリックが0件なら使用不可', () => {
    expect(canUseRevelation(DEFAULT_PARAMS, wave, 'kyo', [])).toBe(false)
  })

  it('所持レリックが全て付喪化済みなら使用不可', () => {
    const relics = [{ id: 'manekiNeko' as const, tsukumoka: true }]
    expect(canUseRevelation(DEFAULT_PARAMS, wave, 'kyo', relics)).toBe(false)
  })

  it('未付喪化の所持レリックが1件以上あれば使用可', () => {
    const relics = [
      { id: 'manekiNeko' as const, tsukumoka: true },
      { id: 'kumade' as const, tsukumoka: false },
    ]
    expect(canUseRevelation(DEFAULT_PARAMS, wave, 'kyo', relics)).toBe(true)
  })

  it('虚以外の天啓は、レリックの所持状況に関わらず使用可', () => {
    expect(canUseRevelation(DEFAULT_PARAMS, wave, 'kaku', [])).toBe(true)
  })
})
```

(`baseWave`・`card`ヘルパーは既存のテストファイル内で定義されているものをそのまま使うこと。`RelicId`のimportが無ければ追加する。)

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test -- revelationEffects.test.ts`
Expected: FAIL(引数の数が合わずTypeScriptの型エラー、または常に`true`を返すため「使用不可」を期待するテストが失敗する)

- [ ] **Step 3: `canUseRevelation`を実装**

`src/lib/game/shidasu/revelationEffects.ts`の`canUseRevelation`関数を以下に置き換える(`RelicId`のimportが無ければファイル冒頭に追加する):

```ts
// 天啓が現在の盤面状態で使用可能か判定する。虚(レリック付喪化)のみ、未付喪化の所持レリックが
// 1つ以上あるかを判定する(それ以外は常に使用可)。
export function canUseRevelation(
  _params: ShidasuParams,
  _wave: WaveState,
  revelationId: RevelationId,
  relics: { id: RelicId; tsukumoka: boolean }[] = []
): boolean {
  if (revelationId === 'kyo') {
    return relics.some(r => !r.tsukumoka)
  }
  return true
}
```

(`relics`にデフォルト値`[]`を与えることで、`kyo`以外の呼び出し元で`relics`を省略してもコンパイルが通るようにする。ただし後続のTask 4で全呼び出し元に`relics`を明示的に渡すよう統一するため、デフォルト値は移行期間の互換性のためだけに使う。)

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm run test -- revelationEffects.test.ts`
Expected: PASS

- [ ] **Step 5: `engine.ts`の`canUseRevelation`呼び出し3箇所を更新**

`src/lib/game/shidasu/engine.ts`内、`Grep`で`canUseRevelation(params, run.wave, revelationId)`を検索し、3箇所(`buyIndividualRevelationUse`・`pickPackRevelationUse`・`useRevelation`)すべてを以下に置き換える:

```ts
  if (!canUseRevelation(params, run.wave, revelationId, run.relics)) return run
```

- [ ] **Step 6: `PlayArea.svelte`に`relics`propを追加**

`src/routes/game/shidasu/PlayArea.svelte`のprops宣言(16-53行目付近)に`relics`propを追加する。現在の

```ts
  let {
    wave, params, modifier, target, items, onPlayCard, onDraw, dropTarget = null, headerExtra, extraFooter,
    rites = [], onUseRite,
    revelations = [], onUseRevelationClick,
    ...
  }: {
    wave: WaveState
    params: ShidasuParams
    modifier: StageModifier
    target: number
    items: ItemId[]
    onPlayCard: (colIndex: number, rowIndex: number) => PlayCardResult | void
    onDraw: () => void
    dropTarget?: { col: number; row: number } | 'stockTop' | null
    headerExtra?: Snippet
    extraFooter?: Snippet
    rites?: RiteId[]
    onUseRite?: (riteId: RiteId) => void
    revelations?: RevelationId[]
    onUseRevelationClick?: (revelationId: RevelationId) => void
    ...
  } = $props()
```

を、`revelations`関連の行の直後に`relics`を追加する形に変更する:

```ts
  let {
    wave, params, modifier, target, items, onPlayCard, onDraw, dropTarget = null, headerExtra, extraFooter,
    rites = [], onUseRite,
    revelations = [], onUseRevelationClick,
    relics = [],
    ...
  }: {
    wave: WaveState
    params: ShidasuParams
    modifier: StageModifier
    target: number
    items: ItemId[]
    onPlayCard: (colIndex: number, rowIndex: number) => PlayCardResult | void
    onDraw: () => void
    dropTarget?: { col: number; row: number } | 'stockTop' | null
    headerExtra?: Snippet
    extraFooter?: Snippet
    rites?: RiteId[]
    onUseRite?: (riteId: RiteId) => void
    revelations?: RevelationId[]
    onUseRevelationClick?: (revelationId: RevelationId) => void
    relics?: { id: RelicId; tsukumoka: boolean }[]
    ...
  } = $props()
```

(既存の他のprop宣言行はそのまま残し、`relics`関連の2行のみを追記する。`RelicId`のimportが無ければ`import type { ... } from '$lib/game/shidasu/types'`の型リストに追加する。)

- [ ] **Step 7: `PlayArea.svelte`の`canUseRevelation`呼び出しを更新**

`src/routes/game/shidasu/PlayArea.svelte:1015`の

```ts
      {@const usable = canUseRevelation(params, wave, revelationId) && playingAnimation === null && scoreReveal === null && cleanupAnimation === null && chainResetAnimation === null && !dealAnimationActive}
```

を以下に置き換える:

```ts
      {@const usable = canUseRevelation(params, wave, revelationId, relics) && playingAnimation === null && scoreReveal === null && cleanupAnimation === null && chainResetAnimation === null && !dealAnimationActive}
```

- [ ] **Step 8: `+page.svelte`から`PlayArea`への`relics`propを渡す**

`src/routes/game/shidasu/+page.svelte`内で`<PlayArea`が呼ばれている箇所(`Grep`で`<PlayArea`を検索、複数箇所ある可能性がある)に`relics={run.relics}`を追加する。既存の`revelations={run.revelations}`のような行の近くに追加すること。

- [ ] **Step 9: 型チェック**

Run: `npm run check`
Expected: PASS

- [ ] **Step 10: 全体テスト実行**

Run: `npm run test`
Expected: PASS

- [ ] **Step 11: コミット**

```bash
git add src/lib/game/shidasu/revelationEffects.ts src/lib/game/shidasu/revelationEffects.test.ts src/lib/game/shidasu/engine.ts src/routes/game/shidasu/PlayArea.svelte src/routes/game/shidasu/+page.svelte
git commit -m "feat: canUseRevelationにレリック未付喪化判定を追加"
```

---

### Task 3: `useRevelation`・`grantRevelationReward`に付喪化ロジックを実装する

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`(`useRevelation`関数、`grantRevelationReward`関数)
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`内で`describe('useRevelation'`または`grantRevelationReward`関連のテストブロックを検索し、既存の`subaru`/`hotori`等のテストのセットアップパターン(`beginRun`または類似のヘルパーで`RunState`を組み立て、`phase: 'playing'`かつ`wave`が生成された状態にしてから`useRevelation`を呼ぶ)を確認したうえで、以下のテストを追記する:

```ts
describe('useRevelation: 虚(レリック付喪化)', () => {
  it('targetRelicIdで指定した未付喪化レリックが付喪化される', () => {
    const params = DEFAULT_PARAMS
    let run = beginRun(params, 1)
    run = {
      ...run,
      revelations: ['kyo'],
      relics: [
        { id: 'manekiNeko', tsukumoka: false },
        { id: 'kumade', tsukumoka: false },
      ],
    }
    const next = useRevelation(params, run, 'kyo', null, Math.random, 'kumade')
    expect(next.relics).toEqual([
      { id: 'manekiNeko', tsukumoka: false },
      { id: 'kumade', tsukumoka: true },
    ])
    expect(next.revelations).toEqual([])
  })

  it('targetRelicIdが未指定(null)なら何も変化しない', () => {
    const params = DEFAULT_PARAMS
    let run = beginRun(params, 1)
    run = {
      ...run,
      revelations: ['kyo'],
      relics: [{ id: 'manekiNeko', tsukumoka: false }],
    }
    const next = useRevelation(params, run, 'kyo', null, Math.random, null)
    expect(next.relics).toEqual([{ id: 'manekiNeko', tsukumoka: false }])
    // 虚自体は消費される(使用は成立している。対象選択が空振りしただけ)
    expect(next.revelations).toEqual([])
  })

  it('既に付喪化済みのレリックを指定しても何も変化しない', () => {
    const params = DEFAULT_PARAMS
    let run = beginRun(params, 1)
    run = {
      ...run,
      revelations: ['kyo'],
      relics: [{ id: 'manekiNeko', tsukumoka: true }],
    }
    const next = useRevelation(params, run, 'kyo', null, Math.random, 'manekiNeko')
    expect(next.relics).toEqual([{ id: 'manekiNeko', tsukumoka: true }])
  })

  it('所持していないレリックIDを指定しても何も変化しない', () => {
    const params = DEFAULT_PARAMS
    let run = beginRun(params, 1)
    run = {
      ...run,
      revelations: ['kyo'],
      relics: [{ id: 'manekiNeko', tsukumoka: false }],
    }
    const next = useRevelation(params, run, 'kyo', null, Math.random, 'kumade')
    expect(next.relics).toEqual([{ id: 'manekiNeko', tsukumoka: false }])
  })
})
```

(`beginRun(params, 1)`が実際のシグネチャと異なる場合、既存の`useRevelation`テストで使われているセットアップパターンをそのまま踏襲すること。`phase`が`'playing'`または`SHOP_FLOW_PHASES`のいずれかである必要がある点、`run.wave`が`null`でなく`status: 'playing'`である必要がある点に注意する。)

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test -- engine.test.ts -t "虚(レリック付喪化)"`
Expected: FAIL(`useRevelation`が5引数目`targetRelicId`を受け取らずTypeScriptの型エラー、または`grantRevelationReward`に`kyo`のケースが無いため`relics`が変化しない)

- [ ] **Step 3: `useRevelation`に`targetRelicId`引数を追加**

**重要な設計判断**: `Grep`で`useRevelation(`を検索すると、`engine.test.ts`内に`useRevelation(DEFAULT_PARAMS, run, 'someId', null, createRng(1))`という形で、第5引数に`rand`を明示的に渡している既存の呼び出しが約25箇所ある。もし`targetRelicId`を`targetCol`の直後(第5引数)に挿入すると、これら全ての既存呼び出しで`createRng(1)`が誤って`targetRelicId`の位置にずれ込み、型エラーになる(修正には25箇所以上の機械的な変更が必要になる)。これを避けるため、`targetRelicId`は`rand`より**後ろ**(末尾)に追加する。

`src/lib/game/shidasu/engine.ts`の`useRevelation`関数の現在のシグネチャ:

```ts
export function useRevelation(
  params: ShidasuParams,
  run: RunState,
  revelationId: RevelationId,
  targetCol: number | null,
  rand: () => number = Math.random
): RunState {
  if ((run.phase !== 'playing' && !SHOP_FLOW_PHASES.includes(run.phase)) || !run.wave || run.wave.status !== 'playing') return run
  const idx = run.revelations.indexOf(revelationId)
  if (idx === -1) return run
  if (!canUseRevelation(params, run.wave, revelationId, run.relics)) return run
  let { wave, deckComposition } = applyRevelationEffect(params, run.wave, run.deckComposition, revelationId, targetCol, rand)
  // 果断・星霜: 天啓・神託・秘儀のいずれかを使用するたび永続的に加算する
  if (run.items.includes('discretion')) wave = { ...wave, discretionN: wave.discretionN + params.talismans.discretion.n }
  if (run.items.includes('frost')) wave = { ...wave, frostX: wave.frostX + params.talismans.frost.x }
  const extraTableauRows = run.extraTableauRows
  const revelations = [...run.revelations.slice(0, idx), ...run.revelations.slice(idx + 1)]
  const reward = grantRevelationReward(params, { ...run, revelations }, revelationId, rand)
  // 星(hotori)自身の使用は履歴に残さない(自己参照ループを防ぐ。詳細はtypes.tsのlastUsedRevelationIdコメント参照)
  const lastUsedRevelationId = revelationId === 'hotori' ? run.lastUsedRevelationId : revelationId
  return { ...run, wave, deckComposition, revelations, extraTableauRows, lastUsedRevelationId, ...reward }
}
```

を以下に置き換える(`targetRelicId`パラメータを`rand`の直後・末尾に追加し、`grantRevelationReward`の呼び出しに渡す):

```ts
export function useRevelation(
  params: ShidasuParams,
  run: RunState,
  revelationId: RevelationId,
  targetCol: number | null,
  rand: () => number = Math.random,
  targetRelicId: RelicId | null = null
): RunState {
  if ((run.phase !== 'playing' && !SHOP_FLOW_PHASES.includes(run.phase)) || !run.wave || run.wave.status !== 'playing') return run
  const idx = run.revelations.indexOf(revelationId)
  if (idx === -1) return run
  if (!canUseRevelation(params, run.wave, revelationId, run.relics)) return run
  let { wave, deckComposition } = applyRevelationEffect(params, run.wave, run.deckComposition, revelationId, targetCol, rand)
  // 果断・星霜: 天啓・神託・秘儀のいずれかを使用するたび永続的に加算する
  if (run.items.includes('discretion')) wave = { ...wave, discretionN: wave.discretionN + params.talismans.discretion.n }
  if (run.items.includes('frost')) wave = { ...wave, frostX: wave.frostX + params.talismans.frost.x }
  const extraTableauRows = run.extraTableauRows
  const revelations = [...run.revelations.slice(0, idx), ...run.revelations.slice(idx + 1)]
  const reward = grantRevelationReward(params, { ...run, revelations }, revelationId, targetRelicId, rand)
  // 星(hotori)自身の使用は履歴に残さない(自己参照ループを防ぐ。詳細はtypes.tsのlastUsedRevelationIdコメント参照)
  const lastUsedRevelationId = revelationId === 'hotori' ? run.lastUsedRevelationId : revelationId
  return { ...run, wave, deckComposition, revelations, extraTableauRows, lastUsedRevelationId, ...reward }
}
```

この配置により、`engine.test.ts`内の既存25箇所の呼び出し(`useRevelation(DEFAULT_PARAMS, run, 'id', null, createRng(1))`)は`targetRelicId`を省略した形のまま(デフォルト値`null`が適用される)引き続き正しく動作し、変更不要になる。`RelicId`のimportが`engine.ts`冒頭に無ければ追加する。

- [ ] **Step 4: `grantRevelationReward`に`targetRelicId`引数と`kyo`のケースを追加**

`src/lib/game/shidasu/engine.ts`の`grantRevelationReward`関数の現在のシグネチャ:

```ts
function grantRevelationReward(
  params: ShidasuParams,
  runAfterRemoval: RunState,
  revelationId: RevelationId,
  rand: () => number
): Partial<RunState> {
  switch (revelationId) {
    case 'subaru': {
      ...
```

を以下に置き換える(`targetRelicId`パラメータを追加し、`switch`文に`kyo`のケースを追加する):

```ts
function grantRevelationReward(
  params: ShidasuParams,
  runAfterRemoval: RunState,
  revelationId: RevelationId,
  targetRelicId: RelicId | null,
  rand: () => number
): Partial<RunState> {
  switch (revelationId) {
    case 'kyo': {
      if (targetRelicId === null) return {}
      const relic = runAfterRemoval.relics.find(r => r.id === targetRelicId)
      if (!relic || relic.tsukumoka) return {}
      return { relics: runAfterRemoval.relics.map(r => (r.id === targetRelicId ? { ...r, tsukumoka: true } : r)) }
    }
    case 'subaru': {
      ...
```

(`case 'subaru':`以降の既存コードはそのまま残す。`kyo`のケースを`switch`文の先頭に追加するだけでよい。)

- [ ] **Step 5: 呼び出し元の引数を確認**

`Grep`で`grantRevelationReward(`を検索し、`useRevelation`内の呼び出し(Step 3で既に`targetRelicId`を渡す形に更新済み)以外に呼び出し箇所が無いことを確認する。

- [ ] **Step 6: 型チェック**

Run: `npm run check`
Expected: PASS

- [ ] **Step 7: テストを実行して成功を確認**

Run: `npm run test -- engine.test.ts -t "虚(レリック付喪化)"`
Expected: PASS

- [ ] **Step 8: 全体テスト実行**

Run: `npm run test`
Expected: PASS(`targetRelicId`を末尾に追加したため、既存の`useRevelation`呼び出し箇所(`engine.test.ts`内の約25箇所、`+page.svelte`内の4箇所)はいずれも変更不要のはずだが、念のため全体を実行して確認する)

- [ ] **Step 9: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 天啓「虚」のレリック付喪化ロジックを実装"
```

---

### Task 4: UI(レリック選択フロー)を実装する

**Files:**
- Modify: `src/routes/game/shidasu/+page.svelte`

- [ ] **Step 1: 既存の`handleUseRevelationClick`と関連コードを確認する**

`src/routes/game/shidasu/+page.svelte`内の以下の既存コードを確認する(実際の行番号は変動している可能性があるため`Grep`で該当箇所を特定すること):

```ts
  function handleUseRevelationClick(revelationId: RevelationId) {
    if (revelationNeedsTarget(revelationId)) {
      pendingRevelationTarget = { revelationId, source: 'held' }
      if (SHOP_FLOW_PHASES.includes(run.phase) && !revelationPreviewWave) {
        beginRevelationPreview()
      }
      return
    }
    if (revelationPreviewWave) {
      const runForPreview = { ...run, wave: revelationPreviewWave }
      const resultRun = useRevelation(params, runForPreview, revelationId, null)
      const previewResultWave = resultRun.wave
      run = { ...resultRun, wave: run.wave }
      if (previewResultWave) {
        revelationPreviewWave = previewResultWave
      }
      return
    }
    run = useRevelation(params, run, revelationId, null)
    if (run.phase === 'playing') afterAction()
  }
```

- [ ] **Step 2: 新しい`$state`を追加する**

既存の`pendingRevelationTarget`の`$state`宣言の近くに、以下を追加する:

```ts
  let pendingRelicTargetRevelationId = $state<RevelationId | null>(null)
```

`RelicId`のimportが無ければ、`+page.svelte`冒頭の型importに追加する。

- [ ] **Step 3: `handleUseRevelationClick`に`kyo`の分岐を追加**

Step 1で確認した`handleUseRevelationClick`関数を以下に置き換える(先頭に`kyo`専用の分岐を追加する):

```ts
  function handleUseRevelationClick(revelationId: RevelationId) {
    if (revelationId === 'kyo') {
      pendingRelicTargetRevelationId = 'kyo'
      return
    }
    if (revelationNeedsTarget(revelationId)) {
      pendingRevelationTarget = { revelationId, source: 'held' }
      if (SHOP_FLOW_PHASES.includes(run.phase) && !revelationPreviewWave) {
        beginRevelationPreview()
      }
      return
    }
    if (revelationPreviewWave) {
      const runForPreview = { ...run, wave: revelationPreviewWave }
      const resultRun = useRevelation(params, runForPreview, revelationId, null)
      const previewResultWave = resultRun.wave
      run = { ...resultRun, wave: run.wave }
      if (previewResultWave) {
        revelationPreviewWave = previewResultWave
      }
      return
    }
    run = useRevelation(params, run, revelationId, null)
    if (run.phase === 'playing') afterAction()
  }
```

- [ ] **Step 4: レリック選択確定・キャンセルのハンドラを追加**

`handleUseRevelationClick`関数の直後に、以下2つの関数を追加する:

```ts
  function handleConfirmRelicTarget(relicId: RelicId) {
    if (!pendingRelicTargetRevelationId) return
    const revelationId = pendingRelicTargetRevelationId
    pendingRelicTargetRevelationId = null
    run = useRevelation(params, run, revelationId, null, Math.random, relicId)
    if (run.phase === 'playing') afterAction()
  }

  function handleCancelRelicTarget() {
    pendingRelicTargetRevelationId = null
  }
```

(`targetRelicId`は`useRevelation`の第6引数(`rand`の後)にあるため、`rand`をデフォルト値と同じ`Math.random`として明示的に渡す必要がある。)

(`afterAction`は既存の関数で、他の天啓使用ハンドラ(`handleUseRevelationClick`内)と同じタイミングで呼ばれているものをそのまま踏襲する。実際の関数名・呼び出しタイミングが異なる場合は、既存パターンに合わせて調整すること。)

- [ ] **Step 5: レリック選択UIを追加する**

`+page.svelte`のテンプレート部分で、既存の`{#if pendingRevelationTarget}`ブロック(場札列選択のオーバーレイ)の直後に、以下のレリック選択オーバーレイを追加する:

```svelte
{#if pendingRelicTargetRevelationId}
  <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
    <div class="bg-slate-900 border border-slate-700 rounded-lg p-4 max-w-md w-full space-y-3">
      <p class="text-sm font-bold text-slate-200">付喪化させるレリックを選んでください</p>
      {#if run.relics.filter(r => !r.tsukumoka).length === 0}
        <p class="text-xs text-slate-400">付喪化できるレリックがありません。</p>
      {:else}
        <div class="flex flex-wrap gap-2">
          {#each run.relics.filter(r => !r.tsukumoka) as relic (relic.id)}
            <button
              type="button"
              onclick={() => handleConfirmRelicTarget(relic.id)}
              class="text-xs bg-amber-900 text-amber-200/90 border border-amber-600/40 rounded px-2 py-1 hover:bg-amber-800"
              title={relicDesc(relic.id, params)}
            >
              {relicName(relic.id, params)}
            </button>
          {/each}
        </div>
      {/if}
      <button
        type="button"
        onclick={handleCancelRelicTarget}
        class="text-xs px-3 py-1.5 rounded border border-slate-600 text-slate-300 hover:bg-slate-800"
      >
        キャンセル
      </button>
    </div>
  </div>
{/if}
```

(`relicName`・`relicDesc`は既存のimportにあるため追加不要。既存のレリックバッジ表示(`run.relics`を`{#each}`しているUI箇所、`bg-amber-900 text-amber-200/90 border border-amber-600/40`のクラス)と同じ配色パターンを踏襲している。)

- [ ] **Step 6: `PlayArea`への`relics` propが渡っていることを再確認**

Task 2 Step 8で追加した`relics={run.relics}`が`<PlayArea`呼び出し箇所に正しく残っていることを確認する(このタスクでは追加作業不要、確認のみ)。

- [ ] **Step 7: 型チェック**

Run: `npm run check`
Expected: PASS

- [ ] **Step 8: ビルド確認**

Run: `npm run build`
Expected: PASS

- [ ] **Step 9: 全体テスト実行**

Run: `npm run test`
Expected: PASS

- [ ] **Step 10: 開発サーバーでの動作確認**

Run: `npm run dev`

`http://localhost:5173/game/shidasu`で以下を確認する:
1. ラン開始→ショップでレリックを1つ購入する
2. ショップで天啓「虚」が出現するまでリロールするか、福袋から獲得する(購入・温存)
3. プレイ画面またはショップ画面で所持天啓「虚」をクリックする
4. レリック選択オーバーレイが表示され、所持している未付喪化レリックがボタンとして一覧表示されることを確認する
5. レリックを選んでクリックし、オーバーレイが閉じ、そのレリックのバッジに★マークが付き、tooltipの説明文が`tsukumokaDesc`に切り替わることを確認する
6. 全レリックが付喪化済みの状態で「虚」を使おうとした場合、ボタンがdisabled(使用不可)になっていることを確認する
7. レイアウト崩れが無いことを確認する

確認後、開発サーバーのプロセスを終了すること。

- [ ] **Step 11: コミット**

```bash
git add src/routes/game/shidasu/+page.svelte
git commit -m "feat: 天啓「虚」のレリック選択UIを実装"
```

---

## Self-Review メモ(執筆時点で実施済み)

- **spec網羅性:** specの「効果仕様」→Task1・Task3、「データ・ロジック変更」の型・データ→Task1、`revelationEffects.ts`/`engine.ts`の変更→Task2・Task3、「実装上の注意」(`canUseRevelation`のシグネチャ)→Task2で「`relics`配列を追加する」方式に決定して反映、「UI設計」→Task4、「テスト」節の4パターン(未指定・付喪化済み・未所持・正常系)→Task3のテストコードに全て反映。
- **プレースホルダー無し確認:** 全ステップに実コード・実コマンドを記載。Task2 Step5・Task3 Step5のような「`Grep`で該当箇所を検索する」という指示は、既存コードの正確な行番号がタスク実行時点でずれている可能性があるための実務的な手順であり、プレースホルダーではない。
- **型の一貫性:** `targetRelicId: RelicId | null`という型・パラメータ名を`useRevelation`(Task3 Step3)と`grantRevelationReward`(Task3 Step4)で統一。`relics: { id: RelicId; tsukumoka: boolean }[]`という型を`canUseRevelation`(Task2 Step3)・`PlayArea.svelte`のprops(Task2 Step6)で統一(既存の`RunState.relics`の型定義と同一)。`pendingRelicTargetRevelationId`という変数名をTask4内で一貫して使用。
- **`canUseRevelation`のシグネチャ変更の影響範囲:** 呼び出し箇所は`engine.ts`3箇所(Task2 Step5)・`PlayArea.svelte`1箇所(Task2 Step7)の計4箇所のみであることを事前調査済み。全て本プランのタスク内でカバーしている。
- **`useRevelation`のシグネチャ変更の影響範囲:** 事前調査で`engine.test.ts`内に`rand`(第5引数)を明示的に渡す既存呼び出しが約25箇所あることを確認した。`targetRelicId`を第5引数(`targetCol`と`rand`の間)に挿入すると全て型エラーになるため、`rand`より後ろ(第6引数、デフォルト値`null`)に配置する設計に変更し、既存呼び出しへの影響をゼロにした(Task3 Step3で詳細に説明済み)。
