# 天啓 Phase B(即時報酬獲得系7個) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `docs/shidasu/shidasu-revelation-candidates.md`で採用済みの天啓候補のうちPhase B対象7個(No.13・15・16・17・18・19・23)を、新規天啓として実装する。

**Architecture:** Phase A(実装済み8個)は`wave`・`deckComposition`を書き換える効果だったが、Phase Bの7個はRunStateレベル(通貨・護符・天啓・秘儀・神託の所持リスト)を操作する効果で`wave`/`deckComposition`には触れない。`applyRevelationEffect`(revelationEffects.ts)側は全てno-opとして実装し、実際の付与ロジックは`engine.ts`の新規関数`grantRevelationReward`として実装、`useRevelation`の末尾から呼び出す。候補16(天啓回帰)・候補23(秘儀回帰)は「直前に使用した天啓/秘儀を獲得する」効果のため、`RunState`に使用履歴フィールドを新設する。

**Tech Stack:** TypeScript, Vitest, SvelteKit(既存Shidasuゲームエンジンの拡張のみ、UIコンポーネントの変更は無し)

**参照設計doc:** `docs/superpowers/specs/2026-08-09-shidasu-revelation-phase-b-design.md`

---

## 前提知識(実装者向け)

- 天啓の効果適用は2箇所に分かれている: `revelationEffects.ts`の`applyRevelationEffect`(`wave`・`deckComposition`を書き換える、列挙型`RevelationId`に対する`switch`で網羅性チェックを受ける)と、`engine.ts`の`useRevelation`(所持数の増減・通貨等のRunStateレベルの処理)。Phase Bの7個は前者を全てno-opにし、後者(`useRevelation`から呼ぶ新規関数`grantRevelationReward`)で実際の処理を行う。
- `applyRevelationEffect`の`switch`は`RevelationId`(ユニオン型)を分岐しており、TypeScriptは「全パスで値を返しているか」を確認する際にこの網羅性を考慮する。新しい`RevelationId`を型に追加したら、同じタスク内で対応する`case`(no-opでよい)も必ず追加すること(型だけ先に追加すると`npm run check`が失敗する)。
- `grantRevelationReward`は`default: return {}`を持つため網羅性チェックの対象外。新しい`RevelationId`を追加しても、対応する`case`をこの関数に追加し忘れてもコンパイルエラーにはならない(単に付与が発生しないだけ)。忘れずに追加すること。
- 天啓と神託は所持数の上限2を共有する(`run.revelations.length + run.oracles.length <= 2`)。秘儀は独立して上限3(`run.rites.length <= 3`)。護符は上限`params.items.maxItems`(既定5)で、秘儀・天啓・神託と異なり重複所持不可(同じ護符を2個持てない)。
- `useRevelation`はまず「使用した天啓自身を`run.revelations`から取り除いた後」の状態を計算する(既存の`revelations`変数)。Phase Bの付与ロジックは、この削除後の状態を基準に上限判定を行う(削除前ではない)。これにより、天啓・神託合算2/2の状態で候補16・17・18を使っても、使用分の1枠が空くため最低1件は獲得できる。
- 全てのタスクはリポジトリルート(`c:\Users\the-f\Documents\ClaudeProjects\Utilities-Svelte`)で実行する。テストは `npm test -- <ファイル名>` (vitest)で実行できる。

---

### Task 1: RunStateに使用履歴フィールドを追加する

候補16(天啓回帰)・候補23(秘儀回帰)のための土台。「直前に使用した天啓」「直近2件の秘儀使用履歴」を追跡する。

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`(`RunState`インターフェース)
- Modify: `src/lib/game/shidasu/engine.ts`(`createInitialRun`・`beginRun`・`useRevelation`・`useRite`)
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く(useRevelationが使用した天啓IDをlastUsedRevelationIdに記録する)**

`src/lib/game/shidasu/engine.test.ts`の`describe('useRevelation(所持天啓の使用、playing/shopフロー両対応)', ...)`ブロック内、最後のテストの直後に以下を追加する。

```ts
  test('使用した天啓のIDがlastUsedRevelationIdに記録される', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, revelations: ['kaku'] }
    const result = useRevelation(DEFAULT_PARAMS, run, 'kaku', null, createRng(1))
    expect(result.lastUsedRevelationId).toBe('kaku')
  })
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm test -- engine.test.ts -t "lastUsedRevelationIdに記録"`
Expected: FAIL(`RunState`に`lastUsedRevelationId`フィールドが無いため型エラーになる。または`result.lastUsedRevelationId`が`undefined`になり`toBe('kaku')`と一致せず失敗する)

- [ ] **Step 3: `RunState`に2つのフィールドを追加する**

`src/lib/game/shidasu/types.ts`の`RunState`インターフェース末尾、`shopRerollCount: number`の直後(閉じ`}`の直前)に以下を追加する。

```ts
  // 直前に使用した天啓のID(天啓回帰が参照する)。使用履歴が無ければnull。
  // 天啓回帰自身を使った場合はこのフィールドを更新しない(履歴に残さない)。これにより
  // 天啓回帰が自分自身を再取得する自己参照ループが構造的に発生しない。
  lastUsedRevelationId: RevelationId | null
  // 直近に使用した秘儀のID、新しい順で最大2件(秘儀回帰が参照する)。
  recentUsedRiteIds: RiteId[]
```

- [ ] **Step 4: `createInitialRun`・`beginRun`の初期値を追加する**

`src/lib/game/shidasu/engine.ts`の`createInitialRun`関数内、以下の行を

```ts
    cardSetOffer: [], shopRerollCount: 0,
```

以下に変更する。

```ts
    cardSetOffer: [], shopRerollCount: 0,
    lastUsedRevelationId: null, recentUsedRiteIds: [],
```

`beginRun`関数内、以下の行を

```ts
    cardSetOffer: [],
    shopRerollCount: 0,
  }
```

以下に変更する。

```ts
    cardSetOffer: [],
    shopRerollCount: 0,
    lastUsedRevelationId: null,
    recentUsedRiteIds: [],
  }
```

- [ ] **Step 5: `useRevelation`が使用した天啓IDを記録するようにする**

`src/lib/game/shidasu/engine.ts`の`useRevelation`関数内、以下の行を

```ts
  const revelations = [...run.revelations.slice(0, idx), ...run.revelations.slice(idx + 1)]
  return { ...run, wave, deckComposition, revelations, extraTableauRows }
}
```

以下に変更する。

```ts
  const revelations = [...run.revelations.slice(0, idx), ...run.revelations.slice(idx + 1)]
  return { ...run, wave, deckComposition, revelations, extraTableauRows, lastUsedRevelationId: revelationId }
}
```

- [ ] **Step 6: テストが通ることを確認する**

Run: `npm test -- engine.test.ts -t "lastUsedRevelationIdに記録"`
Expected: PASS

- [ ] **Step 7: 失敗するテストを書く(useRiteが使用した秘儀IDをrecentUsedRiteIdsの先頭に追加する、最大2件)**

`src/lib/game/shidasu/engine.test.ts`の`describe('useRite', ...)`ブロック内、最初のテスト`test('所持している秘儀を使用すると効果が適用され、所持から1個削除される', ...)`の直後に以下を追加する。

```ts
  test('使用した秘儀のIDがrecentUsedRiteIdsの先頭に追加される', () => {
    const wave = makeWave({ combo: 2, maxComboThisWave: 2 })
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), wave, rites: ['uruz'], recentUsedRiteIds: ['ingwaz'] }
    const next = useRite(DEFAULT_PARAMS, run, 'uruz', createRng(1))
    expect(next.recentUsedRiteIds).toEqual(['uruz', 'ingwaz'])
  })

  test('recentUsedRiteIdsは3件目以降を切り詰める(最大2件)', () => {
    const wave = makeWave({ combo: 2, maxComboThisWave: 2 })
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), wave, rites: ['uruz'], recentUsedRiteIds: ['ingwaz', 'eihwaz'] }
    const next = useRite(DEFAULT_PARAMS, run, 'uruz', createRng(1))
    expect(next.recentUsedRiteIds).toEqual(['uruz', 'ingwaz'])
  })
```

- [ ] **Step 8: テストが失敗することを確認する**

Run: `npm test -- engine.test.ts -t "recentUsedRiteIds"`
Expected: FAIL(`recentUsedRiteIds`が更新されず`undefined`のままのため`toEqual`が失敗する)

- [ ] **Step 9: `useRite`が使用した秘儀IDを記録するようにする**

`src/lib/game/shidasu/engine.ts`の`useRite`関数内、以下の行を

```ts
  const rites = [...run.rites.slice(0, idx), ...run.rites.slice(idx + 1)]
  return { ...run, wave, rites }
}
```

以下に変更する。

```ts
  const rites = [...run.rites.slice(0, idx), ...run.rites.slice(idx + 1)]
  const recentUsedRiteIds = [riteId, ...run.recentUsedRiteIds].slice(0, 2)
  return { ...run, wave, rites, recentUsedRiteIds }
}
```

- [ ] **Step 10: 全テストが通ることを確認する**

Run: `npm test -- engine.test.ts`
Expected: PASS(全テストグリーン)

- [ ] **Step 11: 型チェックを実行する**

Run: `npm run check`
Expected: エラー無し

- [ ] **Step 12: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: RunStateに天啓・秘儀の使用履歴フィールドを追加"
```

---

## Task 2〜8共通の進め方

以降のTask 2〜8は、天啓1個ずつを次の順序で実装する。

1. `RevelationId`(types.ts)にIDを1個追加
2. `REVELATION_POOL`(revelations.ts)にIDを1個追加
3. `ShidasuParams['revelations']`の型(params.ts)にエントリを1個追加
4. `DEFAULT_PARAMS.revelations`(params.ts)にエントリを1個追加
5. `shidasu.config.json`の`revelations`にエントリを1個追加
6. `REVELATION_ACTUAL_EFFECTS`(revelationActualEffects.ts)にエントリを1個追加
7. `revelationEffects.ts`の`applyRevelationEffect`にno-opの`case`を追加(`wave`・`deckComposition`をそのまま返すだけ)。`revelationNeedsTarget`には追加しない(列選択不要)
8. `engine.ts`の`grantRevelationReward`(Task 2で新規作成、以降のタスクでcaseを追加)に実際の付与ロジックを追加
9. `engine.test.ts`・`revelationEffects.test.ts`にテストを追加
10. `npm run check`でエラー無しを確認
11. コミット

型だけ先に追加してロジックを後回しにすると`applyRevelationEffect`の`switch`の網羅性チェックで`npm run check`が失敗するため、型追加とno-opケース追加は必ず同じタスク内で行う(前提知識を参照)。

---

### Task 2: 候補No.13「護符獲得」(昴・subaru)を実装する

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`(`RevelationId`)
- Modify: `src/lib/game/shidasu/revelations.ts`(`REVELATION_POOL`)
- Modify: `src/lib/game/shidasu/params.ts`(型・`DEFAULT_PARAMS`)
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Modify: `src/lib/game/shidasu/revelationActualEffects.ts`
- Modify: `src/lib/game/shidasu/revelationEffects.ts`
- Modify: `src/lib/game/shidasu/revelationEffects.test.ts`
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: `RevelationId`に`subaru`を追加する**

`src/lib/game/shidasu/types.ts`の`RevelationId`の`| 'sei'`の直後に以下を追加する。

```ts
  | 'subaru'
```

- [ ] **Step 2: `REVELATION_POOL`に`subaru`を追加する**

`src/lib/game/shidasu/revelations.ts`の`REVELATION_POOL`の`'sei',`の直後に以下を追加する。

```ts
  'subaru',
```

- [ ] **Step 3: `ShidasuParams['revelations']`の型に`subaru`を追加する**

`src/lib/game/shidasu/params.ts`の`revelations`型ブロック、`sei: { name: string; n: number; desc: string }`の直後に以下を追加する。

```ts
    subaru: { name: string; desc: string }
```

- [ ] **Step 4: `DEFAULT_PARAMS.revelations`に`subaru`を追加する**

`src/lib/game/shidasu/params.ts`の`DEFAULT_PARAMS`内、`sei: { name: '井', n: 1, desc: '...' },`の直後に以下を追加する。

```ts
    subaru: { name: '昴', desc: '護符を1つ、所持中を除いてランダムに獲得する(所持上限に達していれば何も起こらない)' },
```

- [ ] **Step 5: `shidasu.config.json`の`revelations`に`subaru`を追加する**

`src/lib/game/shidasu/shidasu.config.json`の`"sei": { ... }`の直後に以下を追加する(`sei`エントリの末尾に`,`を追加するのを忘れないこと)。

```json
    "subaru": {
      "name": "昴",
      "desc": "護符を1つ、所持中を除いてランダムに獲得する(所持上限に達していれば何も起こらない)"
    }
```

- [ ] **Step 6: `REVELATION_ACTUAL_EFFECTS`に`subaru`を追加する**

`src/lib/game/shidasu/revelationActualEffects.ts`の`sei: '...',`の直後に以下を追加する。

```ts
  subaru: 'ITEM_POOLから所持中の護符を除いてランダムに1つ選び、items.length < maxItemsなら所持に追加する(useRevelation内のgrantRevelationRewardで実施、wave/deckCompositionは変更しない)',
```

- [ ] **Step 7: `applyRevelationEffect`にno-opケースを追加する**

`src/lib/game/shidasu/revelationEffects.ts`の`applyRevelationEffect`関数の`switch`内、`case 'sei':`のcaseの直後(`}`の直前)に以下を追加する。

```ts
    case 'subaru':
      return { wave, deckComposition }
```

- [ ] **Step 8: `revelationEffects.test.ts`にno-opの検証テストを追加する**

`src/lib/game/shidasu/revelationEffects.test.ts`の`describe('revelationEffects', ...)`ブロック内、最後の`test('revelationNeedsTarget: ...')`の直前に以下を追加する。

```ts
  test('昴(subaru): wave/deckCompositionを変更しない(実際の報酬付与はengine.tsのuseRevelation側)', () => {
    const wave = baseWave()
    const deckComposition: DeckCard[] = []
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'subaru', null, createRng(1))
    expect(result.wave).toBe(wave)
    expect(result.deckComposition).toBe(deckComposition)
  })
```

- [ ] **Step 9: 失敗するテストを書く(engine.test.ts側)**

`src/lib/game/shidasu/engine.test.ts`の`describe('useRevelation(所持天啓の使用、playing/shopフロー両対応)', ...)`ブロックの直後に以下を追加する。

```ts
describe('useRevelation: 昴(subaru・護符獲得)', () => {
  test('護符を1つランダムに獲得し、所持中の護符は選ばれない', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, revelations: ['subaru'], items: ['discretion', 'frost'] }
    const result = useRevelation(DEFAULT_PARAMS, run, 'subaru', null, createRng(1))
    expect(result.items).toHaveLength(3)
    expect(result.items.slice(0, 2)).toEqual(['discretion', 'frost'])
    expect(result.items[2]).not.toBe('discretion')
    expect(result.items[2]).not.toBe('frost')
  })

  test('護符の所持上限に達していれば何も獲得しない', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const fiveItems: ItemId[] = ITEM_POOL.slice(0, DEFAULT_PARAMS.items.maxItems)
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, revelations: ['subaru'], items: fiveItems }
    const result = useRevelation(DEFAULT_PARAMS, run, 'subaru', null, createRng(1))
    expect(result.items).toEqual(fiveItems)
  })
})
```

- [ ] **Step 10: テストが失敗することを確認する**

Run: `npm test -- engine.test.ts -t "昴"`
Expected: FAIL(`'subaru'`はまだ`grantRevelationReward`に対応するcaseが無い関数自体が存在しないため、`items`が変化せず失敗する)

- [ ] **Step 11: `grantRevelationReward`関数を新規作成し、`useRevelation`から呼び出す**

`src/lib/game/shidasu/engine.ts`の`export function useRevelation(`の直前に以下の関数を追加する。

```ts
// Phase B(即時報酬獲得系)天啓の付与ロジック。使用した天啓自身をrevelationsから取り除いた後の
// runState(runAfterRemoval)を受け取り、変化するフィールドだけを部分的に返す。対象外のIDには{}を返す
// (defaultケースがあるため、このswitchはRevelationIdに対して網羅的である必要はない)。
// wave/deckCompositionには影響しないため、applyRevelationEffect側は全てno-opになっている。
function grantRevelationReward(
  params: ShidasuParams,
  runAfterRemoval: RunState,
  revelationId: RevelationId,
  rand: () => number
): Partial<RunState> {
  switch (revelationId) {
    case 'subaru': {
      if (runAfterRemoval.items.length >= params.items.maxItems) return {}
      const available = ITEM_POOL.filter(id => !runAfterRemoval.items.includes(id))
      if (available.length === 0) return {}
      const picked = available[Math.floor(rand() * available.length)]
      return { items: [...runAfterRemoval.items, picked] }
    }
    default:
      return {}
  }
}
```

`useRevelation`関数内、以下の行を

```ts
  const revelations = [...run.revelations.slice(0, idx), ...run.revelations.slice(idx + 1)]
  return { ...run, wave, deckComposition, revelations, extraTableauRows, lastUsedRevelationId: revelationId }
}
```

以下に変更する。

```ts
  const revelations = [...run.revelations.slice(0, idx), ...run.revelations.slice(idx + 1)]
  const reward = grantRevelationReward(params, { ...run, revelations }, revelationId, rand)
  return { ...run, wave, deckComposition, revelations, extraTableauRows, lastUsedRevelationId: revelationId, ...reward }
}
```

`src/lib/game/shidasu/engine.ts`冒頭のimport文のうち、`./items`からのimportを以下のように変更する(`ITEM_POOL`を追加する)。

```ts
import { rollItemOffer, ITEM_POOL } from './items'
```

- [ ] **Step 12: テストが通ることを確認する**

Run: `npm test -- engine.test.ts revelationEffects.test.ts`
Expected: PASS(全テストグリーン)

- [ ] **Step 13: 型チェックを実行する**

Run: `npm run check`
Expected: エラー無し

- [ ] **Step 14: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/revelations.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/revelationActualEffects.ts src/lib/game/shidasu/revelationEffects.ts src/lib/game/shidasu/revelationEffects.test.ts src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 天啓「昴」(護符獲得)を実装"
```

---

### Task 3: 候補No.15「星片倍化」(柳・ryuu)を実装する

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`(`RevelationId`)
- Modify: `src/lib/game/shidasu/revelations.ts`(`REVELATION_POOL`)
- Modify: `src/lib/game/shidasu/params.ts`(型・`DEFAULT_PARAMS`)
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Modify: `src/lib/game/shidasu/revelationActualEffects.ts`
- Modify: `src/lib/game/shidasu/revelationEffects.ts`
- Modify: `src/lib/game/shidasu/revelationEffects.test.ts`
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: `RevelationId`に`ryuu`を追加する**

`src/lib/game/shidasu/types.ts`の`RevelationId`の`| 'subaru'`の直後に以下を追加する。

```ts
  | 'ryuu'
```

- [ ] **Step 2: `REVELATION_POOL`に`ryuu`を追加する**

`src/lib/game/shidasu/revelations.ts`の`REVELATION_POOL`の`'subaru',`の直後に以下を追加する。

```ts
  'ryuu',
```

- [ ] **Step 3: `ShidasuParams['revelations']`の型に`ryuu`を追加する**

`src/lib/game/shidasu/params.ts`の`revelations`型ブロック、`subaru: { name: string; desc: string }`の直後に以下を追加する。

```ts
    ryuu: { name: string; desc: string }
```

- [ ] **Step 4: `DEFAULT_PARAMS.revelations`に`ryuu`を追加する**

`src/lib/game/shidasu/params.ts`の`DEFAULT_PARAMS`内、`subaru: { name: '昴', desc: '...' },`の直後に以下を追加する。

```ts
    ryuu: { name: '柳', desc: '現在所持している星片を倍にする' },
```

- [ ] **Step 5: `shidasu.config.json`の`revelations`に`ryuu`を追加する**

`src/lib/game/shidasu/shidasu.config.json`の`"subaru": { ... }`の直後に以下を追加する(`subaru`エントリの末尾に`,`を追加するのを忘れないこと)。

```json
    "ryuu": {
      "name": "柳",
      "desc": "現在所持している星片を倍にする"
    }
```

- [ ] **Step 6: `REVELATION_ACTUAL_EFFECTS`に`ryuu`を追加する**

`src/lib/game/shidasu/revelationActualEffects.ts`の`subaru: '...',`の直後に以下を追加する。

```ts
  ryuu: 'run.currencyを2倍にする(useRevelation内のgrantRevelationRewardで実施、wave/deckCompositionは変更しない)',
```

- [ ] **Step 7: `applyRevelationEffect`にno-opケースを追加する**

`src/lib/game/shidasu/revelationEffects.ts`の`applyRevelationEffect`関数の`switch`内、`case 'subaru':`のcaseの直後に以下を追加する。

```ts
    case 'ryuu':
      return { wave, deckComposition }
```

- [ ] **Step 8: `revelationEffects.test.ts`にno-opの検証テストを追加する**

```ts
  test('柳(ryuu): wave/deckCompositionを変更しない(実際の報酬付与はengine.tsのuseRevelation側)', () => {
    const wave = baseWave()
    const deckComposition: DeckCard[] = []
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'ryuu', null, createRng(1))
    expect(result.wave).toBe(wave)
    expect(result.deckComposition).toBe(deckComposition)
  })
```

- [ ] **Step 9: 失敗するテストを書く(engine.test.ts側)**

`src/lib/game/shidasu/engine.test.ts`の`describe('useRevelation: 昴(subaru・護符獲得)', ...)`ブロックの直後に以下を追加する。

```ts
describe('useRevelation: 柳(ryuu・星片倍化)', () => {
  test('所持している星片が倍になる', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, revelations: ['ryuu'], currency: 30 }
    const result = useRevelation(DEFAULT_PARAMS, run, 'ryuu', null, createRng(1))
    expect(result.currency).toBe(60)
  })

  test('星片が0の場合は0のまま', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, revelations: ['ryuu'], currency: 0 }
    const result = useRevelation(DEFAULT_PARAMS, run, 'ryuu', null, createRng(1))
    expect(result.currency).toBe(0)
  })
})
```

- [ ] **Step 10: テストが失敗することを確認する**

Run: `npm test -- engine.test.ts -t "柳"`
Expected: FAIL(`'ryuu'`はまだ`grantRevelationReward`に対応するcaseが無いため`currency`が変化せず失敗する)

- [ ] **Step 11: `grantRevelationReward`に`ryuu`のcaseを追加する**

`src/lib/game/shidasu/engine.ts`の`grantRevelationReward`関数の`switch`内、`case 'subaru': { ... }`の直後に以下を追加する。

```ts
    case 'ryuu':
      return { currency: runAfterRemoval.currency * 2 }
```

- [ ] **Step 12: テストが通ることを確認する**

Run: `npm test -- engine.test.ts revelationEffects.test.ts`
Expected: PASS

- [ ] **Step 13: 型チェックを実行する**

Run: `npm run check`
Expected: エラー無し

- [ ] **Step 14: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/revelations.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/revelationActualEffects.ts src/lib/game/shidasu/revelationEffects.ts src/lib/game/shidasu/revelationEffects.test.ts src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 天啓「柳」(星片倍化)を実装"
```

---

### Task 4: 候補No.16「天啓回帰」(星・hotori)を実装する

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`(`RevelationId`)
- Modify: `src/lib/game/shidasu/revelations.ts`(`REVELATION_POOL`)
- Modify: `src/lib/game/shidasu/params.ts`(型・`DEFAULT_PARAMS`)
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Modify: `src/lib/game/shidasu/revelationActualEffects.ts`
- Modify: `src/lib/game/shidasu/revelationEffects.ts`
- Modify: `src/lib/game/shidasu/revelationEffects.test.ts`
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: `RevelationId`に`hotori`を追加する**

`src/lib/game/shidasu/types.ts`の`RevelationId`の`| 'ryuu'`の直後に以下を追加する。

```ts
  | 'hotori'
```

- [ ] **Step 2: `REVELATION_POOL`に`hotori`を追加する**

`src/lib/game/shidasu/revelations.ts`の`REVELATION_POOL`の`'ryuu',`の直後に以下を追加する。

```ts
  'hotori',
```

- [ ] **Step 3: `ShidasuParams['revelations']`の型に`hotori`を追加する**

`src/lib/game/shidasu/params.ts`の`revelations`型ブロック、`ryuu: { name: string; desc: string }`の直後に以下を追加する。

```ts
    hotori: { name: string; desc: string }
```

- [ ] **Step 4: `DEFAULT_PARAMS.revelations`に`hotori`を追加する**

`src/lib/game/shidasu/params.ts`の`DEFAULT_PARAMS`内、`ryuu: { name: '柳', desc: '...' },`の直後に以下を追加する。

```ts
    hotori: { name: '星', desc: '直前に使用した天啓を1つ獲得する(直前の使用が無い、または天啓・神託の所持枠が空いていなければ何も起こらない)' },
```

- [ ] **Step 5: `shidasu.config.json`の`revelations`に`hotori`を追加する**

`src/lib/game/shidasu/shidasu.config.json`の`"ryuu": { ... }`の直後に以下を追加する(`ryuu`エントリの末尾に`,`を追加するのを忘れないこと)。

```json
    "hotori": {
      "name": "星",
      "desc": "直前に使用した天啓を1つ獲得する(直前の使用が無い、または天啓・神託の所持枠が空いていなければ何も起こらない)"
    }
```

- [ ] **Step 6: `REVELATION_ACTUAL_EFFECTS`に`hotori`を追加する**

`src/lib/game/shidasu/revelationActualEffects.ts`の`ryuu: '...',`の直後に以下を追加する。

```ts
  hotori: 'run.lastUsedRevelationId(候補16自身を使った場合は更新されない)を読み、revelations+oraclesの合算枚数(使用中の天啓自身を取り除いた後)が上限2未満なら追加する。履歴が無ければ何もしない',
```

- [ ] **Step 7: `applyRevelationEffect`にno-opケースを追加する**

`src/lib/game/shidasu/revelationEffects.ts`の`applyRevelationEffect`関数の`switch`内、`case 'ryuu':`のcaseの直後に以下を追加する。

```ts
    case 'hotori':
      return { wave, deckComposition }
```

- [ ] **Step 8: `revelationEffects.test.ts`にno-opの検証テストを追加する**

```ts
  test('星(hotori): wave/deckCompositionを変更しない(実際の報酬付与はengine.tsのuseRevelation側)', () => {
    const wave = baseWave()
    const deckComposition: DeckCard[] = []
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'hotori', null, createRng(1))
    expect(result.wave).toBe(wave)
    expect(result.deckComposition).toBe(deckComposition)
  })
```

- [ ] **Step 9: 失敗するテストを書く(engine.test.ts側)**

`src/lib/game/shidasu/engine.test.ts`の`describe('useRevelation: 柳(ryuu・星片倍化)', ...)`ブロックの直後に以下を追加する。

```ts
describe('useRevelation: 星(hotori・天啓回帰)', () => {
  test('直前に使用した天啓を1つ獲得する', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, revelations: ['hotori'], lastUsedRevelationId: 'kaku' }
    const result = useRevelation(DEFAULT_PARAMS, run, 'hotori', null, createRng(1))
    expect(result.revelations).toEqual(['kaku'])
  })

  test('使用履歴が無ければ何も獲得しない', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, revelations: ['hotori'], lastUsedRevelationId: null }
    const result = useRevelation(DEFAULT_PARAMS, run, 'hotori', null, createRng(1))
    expect(result.revelations).toEqual([])
  })

  test('候補16自身を使用してもlastUsedRevelationIdは更新されない(履歴に残らない)', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, revelations: ['hotori'], lastUsedRevelationId: 'kaku' }
    const result = useRevelation(DEFAULT_PARAMS, run, 'hotori', null, createRng(1))
    expect(result.lastUsedRevelationId).toBe('kaku')
  })

  test('候補16を連続で使用しても自己参照しない', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, revelations: ['hotori', 'hotori'], lastUsedRevelationId: 'kaku' }
    const first = useRevelation(DEFAULT_PARAMS, run, 'hotori', null, createRng(1))
    expect(first.lastUsedRevelationId).toBe('kaku')
    expect(first.revelations).toEqual(['hotori', 'kaku'])
    const second = useRevelation(DEFAULT_PARAMS, first, 'hotori', null, createRng(1))
    expect(second.revelations).toEqual(['kaku', 'kaku'])
  })
})
```

- [ ] **Step 10: テストが失敗することを確認する**

Run: `npm test -- engine.test.ts -t "星"`
Expected: FAIL(`'hotori'`はまだ`grantRevelationReward`に対応するcaseが無いため`revelations`が変化せず失敗する。また`lastUsedRevelationId`の自己参照除外もまだ実装されていないため、3番目のテストは「候補16自身を使ったのに`lastUsedRevelationId`が`'hotori'`に上書きされてしまう」形で失敗する)

- [ ] **Step 11: `grantRevelationReward`に`hotori`のcaseを追加し、`useRevelation`の自己参照除外を実装する**

`src/lib/game/shidasu/engine.ts`の`grantRevelationReward`関数の`switch`内、`case 'ryuu':`のcaseの直後に以下を追加する。

```ts
    case 'hotori': {
      const target = runAfterRemoval.lastUsedRevelationId
      if (target === null) return {}
      const slotsLeft = 2 - (runAfterRemoval.revelations.length + runAfterRemoval.oracles.length)
      if (slotsLeft <= 0) return {}
      return { revelations: [...runAfterRemoval.revelations, target] }
    }
```

`useRevelation`関数内、以下の行を

```ts
  const revelations = [...run.revelations.slice(0, idx), ...run.revelations.slice(idx + 1)]
  const reward = grantRevelationReward(params, { ...run, revelations }, revelationId, rand)
  return { ...run, wave, deckComposition, revelations, extraTableauRows, lastUsedRevelationId: revelationId, ...reward }
}
```

以下に変更する(`lastUsedRevelationId`を候補16自身の場合は更新しないようにする)。

```ts
  const revelations = [...run.revelations.slice(0, idx), ...run.revelations.slice(idx + 1)]
  const reward = grantRevelationReward(params, { ...run, revelations }, revelationId, rand)
  const lastUsedRevelationId = revelationId === 'hotori' ? run.lastUsedRevelationId : revelationId
  return { ...run, wave, deckComposition, revelations, extraTableauRows, lastUsedRevelationId, ...reward }
}
```

- [ ] **Step 12: テストが通ることを確認する**

Run: `npm test -- engine.test.ts revelationEffects.test.ts`
Expected: PASS(全テストグリーン)

- [ ] **Step 13: 型チェックを実行する**

Run: `npm run check`
Expected: エラー無し

- [ ] **Step 14: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/revelations.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/revelationActualEffects.ts src/lib/game/shidasu/revelationEffects.ts src/lib/game/shidasu/revelationEffects.test.ts src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 天啓「星」(天啓回帰)を実装"
```

---

### Task 5: 候補No.17「神託獲得」(張・chou)を実装する

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`(`RevelationId`)
- Modify: `src/lib/game/shidasu/revelations.ts`(`REVELATION_POOL`)
- Modify: `src/lib/game/shidasu/params.ts`(型・`DEFAULT_PARAMS`)
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Modify: `src/lib/game/shidasu/revelationActualEffects.ts`
- Modify: `src/lib/game/shidasu/revelationEffects.ts`
- Modify: `src/lib/game/shidasu/revelationEffects.test.ts`
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: `RevelationId`に`chou`を追加する**

`src/lib/game/shidasu/types.ts`の`RevelationId`の`| 'hotori'`の直後に以下を追加する。

```ts
  | 'chou'
```

- [ ] **Step 2: `REVELATION_POOL`に`chou`を追加する**

`src/lib/game/shidasu/revelations.ts`の`REVELATION_POOL`の`'hotori',`の直後に以下を追加する。

```ts
  'chou',
```

- [ ] **Step 3: `ShidasuParams['revelations']`の型に`chou`を追加する**

`src/lib/game/shidasu/params.ts`の`revelations`型ブロック、`hotori: { name: string; desc: string }`の直後に以下を追加する。

```ts
    chou: { name: string; desc: string }
```

- [ ] **Step 4: `DEFAULT_PARAMS.revelations`に`chou`を追加する**

`src/lib/game/shidasu/params.ts`の`DEFAULT_PARAMS`内、`hotori: { name: '星', desc: '...' },`の直後に以下を追加する。

```ts
    chou: { name: '張', desc: '神託を最大2つランダムに獲得する(天啓・神託の所持枠の空き数までに制限される)' },
```

- [ ] **Step 5: `shidasu.config.json`の`revelations`に`chou`を追加する**

`src/lib/game/shidasu/shidasu.config.json`の`"hotori": { ... }`の直後に以下を追加する(`hotori`エントリの末尾に`,`を追加するのを忘れないこと)。

```json
    "chou": {
      "name": "張",
      "desc": "神託を最大2つランダムに獲得する(天啓・神託の所持枠の空き数までに制限される)"
    }
```

- [ ] **Step 6: `REVELATION_ACTUAL_EFFECTS`に`chou`を追加する**

`src/lib/game/shidasu/revelationActualEffects.ts`の`hotori: '...',`の直後に以下を追加する。

```ts
  chou: 'ORACLE_POOLからrollOfferで2つ抽選し、revelations+oraclesの合算枚数(使用中の天啓自身を取り除いた後)の残り枠数までoraclesに追加する',
```

- [ ] **Step 7: `applyRevelationEffect`にno-opケースを追加する**

`src/lib/game/shidasu/revelationEffects.ts`の`applyRevelationEffect`関数の`switch`内、`case 'hotori':`のcaseの直後に以下を追加する。

```ts
    case 'chou':
      return { wave, deckComposition }
```

- [ ] **Step 8: `revelationEffects.test.ts`にno-opの検証テストを追加する**

```ts
  test('張(chou): wave/deckCompositionを変更しない(実際の報酬付与はengine.tsのuseRevelation側)', () => {
    const wave = baseWave()
    const deckComposition: DeckCard[] = []
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'chou', null, createRng(1))
    expect(result.wave).toBe(wave)
    expect(result.deckComposition).toBe(deckComposition)
  })
```

- [ ] **Step 9: 失敗するテストを書く(engine.test.ts側)**

`src/lib/game/shidasu/engine.test.ts`の`describe('useRevelation: 星(hotori・天啓回帰)', ...)`ブロックの直後に以下を追加する。

```ts
describe('useRevelation: 張(chou・神託獲得)', () => {
  test('他に天啓・神託を所持していなければ神託を2つ獲得する', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, revelations: ['chou'] }
    const result = useRevelation(DEFAULT_PARAMS, run, 'chou', null, createRng(1))
    expect(result.oracles).toHaveLength(2)
    expect(new Set(result.oracles).size).toBe(2)
  })

  test('他に天啓・神託を1つ所持していれば神託を1つだけ獲得する(合算上限2)', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, revelations: ['chou'], oracles: ['flush'] }
    const result = useRevelation(DEFAULT_PARAMS, run, 'chou', null, createRng(1))
    expect(result.oracles).toHaveLength(2)
    expect(result.oracles[0]).toBe('flush')
  })
})
```

- [ ] **Step 10: テストが失敗することを確認する**

Run: `npm test -- engine.test.ts -t "張"`
Expected: FAIL(`'chou'`はまだ`grantRevelationReward`に対応するcaseが無いため`oracles`が変化せず失敗する)

- [ ] **Step 11: `grantRevelationReward`に`chou`のcaseを追加する**

`src/lib/game/shidasu/engine.ts`の`grantRevelationReward`関数の`switch`内、`case 'hotori': { ... }`の直後に以下を追加する。

```ts
    case 'chou': {
      const slotsLeft = Math.max(0, 2 - (runAfterRemoval.revelations.length + runAfterRemoval.oracles.length))
      if (slotsLeft === 0) return {}
      return { oracles: [...runAfterRemoval.oracles, ...rollOffer(ORACLE_POOL, slotsLeft, rand)] }
    }
```

`src/lib/game/shidasu/engine.ts`冒頭のimport文のうち、`./oracles`からのimportを以下のように変更する(`ORACLE_POOL`を追加する)。

```ts
import { rollOracleOffer, defaultOracleLevels, ORACLE_POOL } from './oracles'
```

`./deck`からのimportを以下のように変更する(`rollOffer`を追加する)。

```ts
import { createRng, shuffle, shuffleInPlace, standardDeckComposition, addCardsToDeckComposition, rollOffer } from './deck'
```

- [ ] **Step 12: テストが通ることを確認する**

Run: `npm test -- engine.test.ts revelationEffects.test.ts`
Expected: PASS

- [ ] **Step 13: 型チェックを実行する**

Run: `npm run check`
Expected: エラー無し

- [ ] **Step 14: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/revelations.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/revelationActualEffects.ts src/lib/game/shidasu/revelationEffects.ts src/lib/game/shidasu/revelationEffects.test.ts src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 天啓「張」(神託獲得)を実装"
```

---

### Task 6: 候補No.18「天啓連続獲得」(翼・yoku)を実装する

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`(`RevelationId`)
- Modify: `src/lib/game/shidasu/revelations.ts`(`REVELATION_POOL`)
- Modify: `src/lib/game/shidasu/params.ts`(型・`DEFAULT_PARAMS`)
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Modify: `src/lib/game/shidasu/revelationActualEffects.ts`
- Modify: `src/lib/game/shidasu/revelationEffects.ts`
- Modify: `src/lib/game/shidasu/revelationEffects.test.ts`
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: `RevelationId`に`yoku`を追加する**

`src/lib/game/shidasu/types.ts`の`RevelationId`の`| 'chou'`の直後に以下を追加する。

```ts
  | 'yoku'
```

- [ ] **Step 2: `REVELATION_POOL`に`yoku`を追加する**

`src/lib/game/shidasu/revelations.ts`の`REVELATION_POOL`の`'chou',`の直後に以下を追加する。

```ts
  'yoku',
```

- [ ] **Step 3: `ShidasuParams['revelations']`の型に`yoku`を追加する**

`src/lib/game/shidasu/params.ts`の`revelations`型ブロック、`chou: { name: string; desc: string }`の直後に以下を追加する。

```ts
    yoku: { name: string; desc: string }
```

- [ ] **Step 4: `DEFAULT_PARAMS.revelations`に`yoku`を追加する**

`src/lib/game/shidasu/params.ts`の`DEFAULT_PARAMS`内、`chou: { name: '張', desc: '...' },`の直後に以下を追加する。

```ts
    yoku: { name: '翼', desc: '天啓を最大2つランダムに獲得する(天啓・神託の所持枠の空き数までに制限される)' },
```

- [ ] **Step 5: `shidasu.config.json`の`revelations`に`yoku`を追加する**

`src/lib/game/shidasu/shidasu.config.json`の`"chou": { ... }`の直後に以下を追加する(`chou`エントリの末尾に`,`を追加するのを忘れないこと)。

```json
    "yoku": {
      "name": "翼",
      "desc": "天啓を最大2つランダムに獲得する(天啓・神託の所持枠の空き数までに制限される)"
    }
```

- [ ] **Step 6: `REVELATION_ACTUAL_EFFECTS`に`yoku`を追加する**

`src/lib/game/shidasu/revelationActualEffects.ts`の`chou: '...',`の直後に以下を追加する。

```ts
  yoku: 'REVELATION_POOLからrollOfferで2つ抽選し、revelations+oraclesの合算枚数(使用中の天啓自身を取り除いた後)の残り枠数までrevelationsに追加する',
```

- [ ] **Step 7: `applyRevelationEffect`にno-opケースを追加する**

`src/lib/game/shidasu/revelationEffects.ts`の`applyRevelationEffect`関数の`switch`内、`case 'chou':`のcaseの直後に以下を追加する。

```ts
    case 'yoku':
      return { wave, deckComposition }
```

- [ ] **Step 8: `revelationEffects.test.ts`にno-opの検証テストを追加する**

```ts
  test('翼(yoku): wave/deckCompositionを変更しない(実際の報酬付与はengine.tsのuseRevelation側)', () => {
    const wave = baseWave()
    const deckComposition: DeckCard[] = []
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'yoku', null, createRng(1))
    expect(result.wave).toBe(wave)
    expect(result.deckComposition).toBe(deckComposition)
  })
```

- [ ] **Step 9: 失敗するテストを書く(engine.test.ts側)**

`src/lib/game/shidasu/engine.test.ts`の`describe('useRevelation: 張(chou・神託獲得)', ...)`ブロックの直後に以下を追加する。

```ts
describe('useRevelation: 翼(yoku・天啓連続獲得)', () => {
  test('他に天啓・神託を所持していなければ天啓を2つ獲得する', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, revelations: ['yoku'] }
    const result = useRevelation(DEFAULT_PARAMS, run, 'yoku', null, createRng(1))
    expect(result.revelations).toHaveLength(2)
  })

  test('他に天啓・神託を1つ所持していれば天啓を1つだけ獲得する(合算上限2)', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, revelations: ['yoku'], oracles: ['flush'] }
    const result = useRevelation(DEFAULT_PARAMS, run, 'yoku', null, createRng(1))
    expect(result.revelations).toHaveLength(1)
    expect(result.oracles).toEqual(['flush'])
  })
})
```

- [ ] **Step 10: テストが失敗することを確認する**

Run: `npm test -- engine.test.ts -t "翼"`
Expected: FAIL(`'yoku'`はまだ`grantRevelationReward`に対応するcaseが無いため`revelations`が1件(自身を取り除いただけ)のまま変化せず失敗する)

- [ ] **Step 11: `grantRevelationReward`に`yoku`のcaseを追加する**

`src/lib/game/shidasu/engine.ts`の`grantRevelationReward`関数の`switch`内、`case 'chou': { ... }`の直後に以下を追加する。

```ts
    case 'yoku': {
      const slotsLeft = Math.max(0, 2 - (runAfterRemoval.revelations.length + runAfterRemoval.oracles.length))
      if (slotsLeft === 0) return {}
      return { revelations: [...runAfterRemoval.revelations, ...rollOffer(REVELATION_POOL, slotsLeft, rand)] }
    }
```

`src/lib/game/shidasu/engine.ts`冒頭のimport文のうち、`./revelations`からのimportを以下のように変更する(`REVELATION_POOL`を追加する)。

```ts
import { rollRevelationOffer, REVELATION_POOL } from './revelations'
```

- [ ] **Step 12: テストが通ることを確認する**

Run: `npm test -- engine.test.ts revelationEffects.test.ts`
Expected: PASS

- [ ] **Step 13: 型チェックを実行する**

Run: `npm run check`
Expected: エラー無し

- [ ] **Step 14: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/revelations.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/revelationActualEffects.ts src/lib/game/shidasu/revelationEffects.ts src/lib/game/shidasu/revelationEffects.test.ts src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 天啓「翼」(天啓連続獲得)を実装"
```

---

### Task 7: 候補No.19「護符換金」(軫・mitsu)を実装する

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`(`RevelationId`)
- Modify: `src/lib/game/shidasu/revelations.ts`(`REVELATION_POOL`)
- Modify: `src/lib/game/shidasu/params.ts`(型・`DEFAULT_PARAMS`)
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Modify: `src/lib/game/shidasu/revelationActualEffects.ts`
- Modify: `src/lib/game/shidasu/revelationEffects.ts`
- Modify: `src/lib/game/shidasu/revelationEffects.test.ts`
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: `RevelationId`に`mitsu`を追加する**

`src/lib/game/shidasu/types.ts`の`RevelationId`の`| 'yoku'`の直後に以下を追加する。

```ts
  | 'mitsu'
```

- [ ] **Step 2: `REVELATION_POOL`に`mitsu`を追加する**

`src/lib/game/shidasu/revelations.ts`の`REVELATION_POOL`の`'yoku',`の直後に以下を追加する。

```ts
  'mitsu',
```

- [ ] **Step 3: `ShidasuParams['revelations']`の型に`mitsu`を追加する**

`src/lib/game/shidasu/params.ts`の`revelations`型ブロック、`yoku: { name: string; desc: string }`の直後に以下を追加する。

```ts
    mitsu: { name: string; desc: string }
```

- [ ] **Step 4: `DEFAULT_PARAMS.revelations`に`mitsu`を追加する**

`src/lib/game/shidasu/params.ts`の`DEFAULT_PARAMS`内、`yoku: { name: '翼', desc: '...' },`の直後に以下を追加する。

```ts
    mitsu: { name: '軫', desc: '所持している護符の売値の合計を星片として獲得する' },
```

- [ ] **Step 5: `shidasu.config.json`の`revelations`に`mitsu`を追加する**

`src/lib/game/shidasu/shidasu.config.json`の`"yoku": { ... }`の直後に以下を追加する(`yoku`エントリの末尾に`,`を追加するのを忘れないこと)。

```json
    "mitsu": {
      "name": "軫",
      "desc": "所持している護符の売値の合計を星片として獲得する"
    }
```

- [ ] **Step 6: `REVELATION_ACTUAL_EFFECTS`に`mitsu`を追加する**

`src/lib/game/shidasu/revelationActualEffects.ts`の`yoku: '...',`の直後に以下を追加する。

```ts
  mitsu: '所持する各護符のitemSellPrice(params, id)を合計し、currencyに加算する',
```

- [ ] **Step 7: `applyRevelationEffect`にno-opケースを追加する**

`src/lib/game/shidasu/revelationEffects.ts`の`applyRevelationEffect`関数の`switch`内、`case 'yoku':`のcaseの直後に以下を追加する。

```ts
    case 'mitsu':
      return { wave, deckComposition }
```

- [ ] **Step 8: `revelationEffects.test.ts`にno-opの検証テストを追加する**

```ts
  test('軫(mitsu): wave/deckCompositionを変更しない(実際の報酬付与はengine.tsのuseRevelation側)', () => {
    const wave = baseWave()
    const deckComposition: DeckCard[] = []
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'mitsu', null, createRng(1))
    expect(result.wave).toBe(wave)
    expect(result.deckComposition).toBe(deckComposition)
  })
```

- [ ] **Step 9: 失敗するテストを書く(engine.test.ts側)**

`src/lib/game/shidasu/engine.test.ts`の`describe('useRevelation: 翼(yoku・天啓連続獲得)', ...)`ブロックの直後に以下を追加する。

```ts
describe('useRevelation: 軫(mitsu・護符換金)', () => {
  test('所持護符の売値合計が星片に加算される', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, revelations: ['mitsu'], items: ['discretion', 'frost'], currency: 10 }
    const expectedTotal = itemSellPrice(DEFAULT_PARAMS, 'discretion') + itemSellPrice(DEFAULT_PARAMS, 'frost')
    const result = useRevelation(DEFAULT_PARAMS, run, 'mitsu', null, createRng(1))
    expect(result.currency).toBe(10 + expectedTotal)
  })

  test('護符を所持していなければ星片は変化しない', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, revelations: ['mitsu'], items: [], currency: 10 }
    const result = useRevelation(DEFAULT_PARAMS, run, 'mitsu', null, createRng(1))
    expect(result.currency).toBe(10)
  })
})
```

- [ ] **Step 10: テストが失敗することを確認する**

Run: `npm test -- engine.test.ts -t "軫"`
Expected: FAIL(`'mitsu'`はまだ`grantRevelationReward`に対応するcaseが無いため`currency`が変化せず失敗する)

- [ ] **Step 11: `grantRevelationReward`に`mitsu`のcaseを追加する**

`src/lib/game/shidasu/engine.ts`の`grantRevelationReward`関数の`switch`内、`case 'yoku': { ... }`の直後に以下を追加する。

```ts
    case 'mitsu': {
      const total = runAfterRemoval.items.reduce((sum, id) => sum + itemSellPrice(params, id), 0)
      return { currency: runAfterRemoval.currency + total }
    }
```

- [ ] **Step 12: テストが通ることを確認する**

Run: `npm test -- engine.test.ts revelationEffects.test.ts`
Expected: PASS

- [ ] **Step 13: 型チェックを実行する**

Run: `npm run check`
Expected: エラー無し

- [ ] **Step 14: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/revelations.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/revelationActualEffects.ts src/lib/game/shidasu/revelationEffects.ts src/lib/game/shidasu/revelationEffects.test.ts src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 天啓「軫」(護符換金)を実装"
```

---

### Task 8: 候補No.23「秘儀回帰」(参・karasu)を実装する

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`(`RevelationId`)
- Modify: `src/lib/game/shidasu/revelations.ts`(`REVELATION_POOL`)
- Modify: `src/lib/game/shidasu/params.ts`(型・`DEFAULT_PARAMS`)
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Modify: `src/lib/game/shidasu/revelationActualEffects.ts`
- Modify: `src/lib/game/shidasu/revelationEffects.ts`
- Modify: `src/lib/game/shidasu/revelationEffects.test.ts`
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: `RevelationId`に`karasu`を追加する**

`src/lib/game/shidasu/types.ts`の`RevelationId`の`| 'mitsu'`の直後に以下を追加する。

```ts
  | 'karasu'
```

- [ ] **Step 2: `REVELATION_POOL`に`karasu`を追加する**

`src/lib/game/shidasu/revelations.ts`の`REVELATION_POOL`の`'mitsu',`の直後に以下を追加する。

```ts
  'karasu',
```

- [ ] **Step 3: `ShidasuParams['revelations']`の型に`karasu`を追加する**

`src/lib/game/shidasu/params.ts`の`revelations`型ブロック、`mitsu: { name: string; desc: string }`の直後に以下を追加する。

```ts
    karasu: { name: string; desc: string }
```

- [ ] **Step 4: `DEFAULT_PARAMS.revelations`に`karasu`を追加する**

`src/lib/game/shidasu/params.ts`の`DEFAULT_PARAMS`内、`mitsu: { name: '軫', desc: '...' },`の直後に以下を追加する。

```ts
    karasu: { name: '参', desc: '直近に使用した秘儀を最大2つ獲得する(秘儀の所持枠の空き数までに制限される)' },
```

- [ ] **Step 5: `shidasu.config.json`の`revelations`に`karasu`を追加する**

`src/lib/game/shidasu/shidasu.config.json`の`"mitsu": { ... }`の直後に以下を追加する(`mitsu`エントリの末尾に`,`を追加するのを忘れないこと)。

```json
    "karasu": {
      "name": "参",
      "desc": "直近に使用した秘儀を最大2つ獲得する(秘儀の所持枠の空き数までに制限される)"
    }
```

- [ ] **Step 6: `REVELATION_ACTUAL_EFFECTS`に`karasu`を追加する**

`src/lib/game/shidasu/revelationActualEffects.ts`の`mitsu: '...',`の直後に以下を追加する。

```ts
  karasu: 'recentUsedRiteIds(最大2件、新しい順)を先頭からrites.lengthの残り枠数(上限3)まで所持に追加する',
```

- [ ] **Step 7: `applyRevelationEffect`にno-opケースを追加する**

`src/lib/game/shidasu/revelationEffects.ts`の`applyRevelationEffect`関数の`switch`内、`case 'mitsu':`のcaseの直後に以下を追加する。

```ts
    case 'karasu':
      return { wave, deckComposition }
```

- [ ] **Step 8: `revelationEffects.test.ts`にno-opの検証テストを追加する**

```ts
  test('参(karasu): wave/deckCompositionを変更しない(実際の報酬付与はengine.tsのuseRevelation側)', () => {
    const wave = baseWave()
    const deckComposition: DeckCard[] = []
    const result = applyRevelationEffect(DEFAULT_PARAMS, wave, deckComposition, 'karasu', null, createRng(1))
    expect(result.wave).toBe(wave)
    expect(result.deckComposition).toBe(deckComposition)
  })
```

- [ ] **Step 9: 失敗するテストを書く(engine.test.ts側)**

`src/lib/game/shidasu/engine.test.ts`の`describe('useRevelation: 軫(mitsu・護符換金)', ...)`ブロックの直後に以下を追加する。

```ts
describe('useRevelation: 参(karasu・秘儀回帰)', () => {
  test('直近に使用した秘儀を最大2つ獲得する', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, revelations: ['karasu'], recentUsedRiteIds: ['uruz', 'ingwaz'] }
    const result = useRevelation(DEFAULT_PARAMS, run, 'karasu', null, createRng(1))
    expect(result.rites).toEqual(['uruz', 'ingwaz'])
  })

  test('秘儀の所持上限(3)を超える分は獲得しない', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, revelations: ['karasu'], rites: ['eihwaz', 'ansuz'], recentUsedRiteIds: ['uruz', 'ingwaz'] }
    const result = useRevelation(DEFAULT_PARAMS, run, 'karasu', null, createRng(1))
    expect(result.rites).toEqual(['eihwaz', 'ansuz', 'uruz'])
  })

  test('使用履歴が無ければ何も獲得しない', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, revelations: ['karasu'], recentUsedRiteIds: [] }
    const result = useRevelation(DEFAULT_PARAMS, run, 'karasu', null, createRng(1))
    expect(result.rites).toEqual([])
  })
})
```

- [ ] **Step 10: テストが失敗することを確認する**

Run: `npm test -- engine.test.ts -t "参"`
Expected: FAIL(`'karasu'`はまだ`grantRevelationReward`に対応するcaseが無いため`rites`が変化せず失敗する)

- [ ] **Step 11: `grantRevelationReward`に`karasu`のcaseを追加する**

`src/lib/game/shidasu/engine.ts`の`grantRevelationReward`関数の`switch`内、`case 'mitsu': { ... }`の直後に以下を追加する。

```ts
    case 'karasu': {
      const slotsLeft = Math.max(0, 3 - runAfterRemoval.rites.length)
      if (slotsLeft === 0) return {}
      return { rites: [...runAfterRemoval.rites, ...runAfterRemoval.recentUsedRiteIds.slice(0, slotsLeft)] }
    }
```

- [ ] **Step 12: テストが通ることを確認する**

Run: `npm test -- engine.test.ts revelationEffects.test.ts`
Expected: PASS(全テストグリーン)

- [ ] **Step 13: 型チェックを実行する**

Run: `npm run check`
Expected: エラー無し

- [ ] **Step 14: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/revelations.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/revelationActualEffects.ts src/lib/game/shidasu/revelationEffects.ts src/lib/game/shidasu/revelationEffects.test.ts src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 天啓「参」(秘儀回帰)を実装"
```

---

### Task 9: 最終確認

**Files:** なし(検証のみ)、必要なら件数コメント修正

- [ ] **Step 1: 件数コメントを最新化する**

`src/lib/game/shidasu/types.ts`の以下の行を

```ts
// 二十八宿のうち今回効果を実装した20種のみをメンバーとする(残り8種はmansions.tsの見た目候補にのみ存在)。
```

以下に変更する(20種→27種、残り8種→残り1種)。

```ts
// 二十八宿のうち今回効果を実装した27種のみをメンバーとする(残り1種はmansions.tsの見た目候補にのみ存在)。
```

`src/lib/game/shidasu/revelations.ts`の以下の行を

```ts
// rollRevelationOfferは重み付けなしの完全均等抽選。効果が実装済みの20種のみが対象。
```

以下に変更する。

```ts
// rollRevelationOfferは重み付けなしの完全均等抽選。効果が実装済みの27種のみが対象。
```

`src/lib/game/shidasu/mansions.ts`の以下の行を

```ts
// RevelationId(効果実装済み20種)とは独立しており、管理画面の「名前」<select>の
```

以下に変更する。

```ts
// RevelationId(効果実装済み27種)とは独立しており、管理画面の「名前」<select>の
```

`src/lib/game/shidasu/revelations.test.ts`の以下の行を

```ts
  test('プール(20種)を超えるcountを指定してもプール全件までしか返らない', () => {
    const offer = rollRevelationOffer(createRng(1), 25)
```

以下に変更する(プールが27種になったため、超過を検証するcountも27を超える値に変更する)。

```ts
  test('プール(27種)を超えるcountを指定してもプール全件までしか返らない', () => {
    const offer = rollRevelationOffer(createRng(1), 30)
```

- [ ] **Step 2: 全テストスイートを実行する**

Run: `npm test`
Expected: 全テストグリーン(Phase B関連の新規テストに加え、既存の全テストも壊れていないこと)

- [ ] **Step 3: 型チェックを実行する**

Run: `npm run check`
Expected: エラー無し

- [ ] **Step 4: ビルドを実行する**

Run: `npm run build`
Expected: ビルド成功

- [ ] **Step 5: 開発サーバーで動作確認する**

Run: `npm run dev`

以下をブラウザ、または`curl`で`/api/admin/shidasu-config`を確認する。

- `http://localhost:5173/admin/shidasu-revelations` を開き、表の最下部に新規7行(昴・柳・星・張・翼・軫・参)が追加され、名前ドロップダウン・説明文プレビュー・監査用の実際の効果列が正しく表示されること
- `/admin/shidasu-debug`などデバッグ画面から新規天啓7個をそれぞれ実際に使用し、護符・通貨・天啓・秘儀・神託の所持数が設計通りに変化すること。特に「星」(天啓回帰)を連続で使っても自己参照が起きないこと、「参」(秘儀回帰)が直近使用秘儀を正しく再取得すること

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/revelations.ts src/lib/game/shidasu/mansions.ts src/lib/game/shidasu/revelations.test.ts
git commit -m "docs: 天啓の件数コメントを27種に更新"
```
