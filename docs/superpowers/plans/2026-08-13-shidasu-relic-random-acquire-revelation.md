# 天啓「鬼」(レリックランダム獲得) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 未所持のレリックをランダムに1つ獲得する天啓「鬼」(内部ID`oni`)を実装する。これにより二十八宿28宿全ての実装が完了する。

**Architecture:** 既存の護符ランダム獲得天啓「星(subaru)」と同型のロジックを`grantRevelationReward`に追加する(天啓Phase Bパターン、RunStateレベル即時効果)。`canUseRevelation`は天啓「虚」実装時に追加済みの`relics`パラメータをそのまま利用して、未所持レリックの有無を判定する分岐を追加する。UI変更は不要。

**Tech Stack:** SvelteKit, Svelte 5 runes, TypeScript, Vitest

---

## File Structure

- `src/lib/game/shidasu/types.ts` — `RevelationId`に`'oni'`を追加
- `src/lib/game/shidasu/revelations.ts` — `REVELATION_POOL`に`'oni'`を追加
- `src/lib/game/shidasu/params.ts` / `shidasu.config.json` — `revelations.oni`のデータ追加
- `src/lib/game/shidasu/revelationEffects.ts` — `canUseRevelation`に`oni`のケースを追加
- `src/lib/game/shidasu/revelationEffects.test.ts` — `canUseRevelation`のテスト追加
- `src/lib/game/shidasu/engine.ts` — `grantRevelationReward`に`oni`のケースを追加、`RELIC_POOL`のimportを追加
- `src/lib/game/shidasu/engine.test.ts` — `useRevelation`+`grantRevelationReward`の統合テスト追加

---

### Task 1: 天啓「鬼」の型・データを追加する

**Files:**
- Modify: `src/lib/game/shidasu/types.ts:89-110`
- Modify: `src/lib/game/shidasu/revelations.ts`
- Modify: `src/lib/game/shidasu/params.ts`
- Modify: `src/lib/game/shidasu/shidasu.config.json`

- [ ] **Step 1: `types.ts`に`oni`を追加**

`src/lib/game/shidasu/types.ts`の`RevelationId`ユニオン型定義は現在以下のようになっている(末尾部分):

```ts
export type RevelationId =
  | 'kaku' | 'kou' | 'tei' | 'bou'
  | 'shin' | 'bi' | 'ki' | 'to'
  | 'gyu' | 'jo'
  | 'kyo'
  | 'aya'
  | 'shitsu'
  | 'heki'
  | 'kei'
  | 'rou'
  | 'i'
  | 'hitsu'
  | 'shi'
  | 'sei'
  | 'subaru'
  | 'ryuu'
  | 'hotori'
  | 'chou'
  | 'yoku'
  | 'mitsu'
  | 'karasu'
```

末尾の`| 'karasu'`の後に`| 'oni'`を追加する:

```ts
export type RevelationId =
  | 'kaku' | 'kou' | 'tei' | 'bou'
  | 'shin' | 'bi' | 'ki' | 'to'
  | 'gyu' | 'jo'
  | 'kyo'
  | 'aya'
  | 'shitsu'
  | 'heki'
  | 'kei'
  | 'rou'
  | 'i'
  | 'hitsu'
  | 'shi'
  | 'sei'
  | 'subaru'
  | 'ryuu'
  | 'hotori'
  | 'chou'
  | 'yoku'
  | 'mitsu'
  | 'karasu'
  | 'oni'
```

このユニオン型の直前にあるコメント(二十八宿の実装済み件数を述べているもの)を、実際の現在の文言を確認したうえで「28宿中28宿が実装済み(残りなし)」という趣旨に更新する。

- [ ] **Step 2: `revelations.ts`の`REVELATION_POOL`に`oni`を追加**

`src/lib/game/shidasu/revelations.ts`の`REVELATION_POOL`配列の末尾(`'karasu',`の後)に`'oni',`の行を追加する。配列直前のコメントに件数の記載があれば、実際の現在の文言を確認したうえで28種に更新する。

- [ ] **Step 3: `params.ts`の型定義に`oni`を追加**

`src/lib/game/shidasu/params.ts`の`revelations`型定義内、`karasu: { name: string; desc: string }`の行の直後に以下を追加する:

```ts
    oni: { name: string; desc: string }
```

- [ ] **Step 4: `params.ts`の`DEFAULT_PARAMS.revelations`に`oni`を追加**

`DEFAULT_PARAMS.revelations`オブジェクト内、`karasu: { name: '参', desc: '...' },`の行の直後に以下を追加する:

```ts
    oni: { name: '鬼', desc: '未所持のレリックの中からランダムに1つ獲得する' },
```

- [ ] **Step 5: `shidasu.config.json`に`oni`を追加**

`src/lib/game/shidasu/shidasu.config.json`内、`"revelations"`ブロック内の`"karasu"`エントリの直後に以下を追加する(JSON形式、カンマの整合性に注意):

```json
    "oni": {
      "name": "鬼",
      "desc": "未所持のレリックの中からランダムに1つ獲得する"
    }
```

(`karasu`が現在ブロック内の最後のエントリであれば、`"karasu"`エントリの末尾に付いているカンマはそのまま残し、`oni`エントリ自体には末尾カンマを付けない。実際のファイル内容を確認して調整すること。)

- [ ] **Step 6: 型チェック**

Run: `npm run check`
Expected: `oni`が`applyRevelationEffect`のswitch文で未処理でも、`default`ケースがあるためエラーにはならない(no-opとして扱われる)。エラーが出ないことを確認する。

- [ ] **Step 7: 全体テスト実行**

Run: `npm run test`
Expected: PASS(既存の`REVELATION_POOL`件数を検証するテストがあれば失敗する可能性がある。次のステップで修正する)

- [ ] **Step 8: 件数アサーションの調整**

`npm run test`の結果を確認し、`REVELATION_POOL`の長さ(27→28)や`RevelationId`の件数を検証しているテストが失敗していれば、実際の値に合わせて修正する(`Grep`で`REVELATION_POOL`を検索して該当箇所を特定すること。天啓「虚」実装時に`revelations.test.ts`の同種テストを既に27種へ更新した実績があるため、同じ箇所を再度28種へ更新することになる可能性が高い)。

- [ ] **Step 9: テスト再実行**

Run: `npm run test`
Expected: PASS

- [ ] **Step 10: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/revelations.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json
git commit -m "feat: 天啓「鬼」(レリックランダム獲得)の型・データを追加"
```

(このタスクの時点では効果ロジックは未実装(no-op)のまま。Task 2以降で実装する。)

---

### Task 2: `canUseRevelation`に未所持レリック判定を追加する

**Files:**
- Modify: `src/lib/game/shidasu/revelationEffects.ts:203-215`
- Test: `src/lib/game/shidasu/revelationEffects.test.ts`

現状の`canUseRevelation`は以下のようになっている(天啓「虚」実装時に`relics`パラメータが追加済み):

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

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/revelationEffects.test.ts`の`describe('canUseRevelation: 虚(レリック付喪化)'`ブロックの直後に、以下の新しいdescribeブロックを追記する:

```ts
describe('canUseRevelation: 鬼(レリックランダム獲得)', () => {
  const wave = baseWave({ tableau: [[card(1, '♠', 1)]] })

  test('全レリックを所持済みなら使用不可', () => {
    const relics = RELIC_POOL.map(id => ({ id, tsukumoka: false }))
    expect(canUseRevelation(DEFAULT_PARAMS, wave, 'oni', relics)).toBe(false)
  })

  test('未所持のレリックが1つ以上あれば使用可', () => {
    const relics = [{ id: 'manekiNeko' as const, tsukumoka: false }]
    expect(canUseRevelation(DEFAULT_PARAMS, wave, 'oni', relics)).toBe(true)
  })

  test('レリックを1つも所持していなければ使用可', () => {
    expect(canUseRevelation(DEFAULT_PARAMS, wave, 'oni', [])).toBe(true)
  })
})
```

(`RELIC_POOL`のimportが`revelationEffects.test.ts`に無ければ`$lib/game/shidasu/relics`から追加する。ファイル内は`test(...)`で統一されているため`test`を使うこと。)

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test -- revelationEffects.test.ts`
Expected: FAIL(「全レリックを所持済みなら使用不可」のテストが、現状常に`true`を返す実装のため失敗する)

- [ ] **Step 3: `canUseRevelation`に`oni`のケースを追加**

`src/lib/game/shidasu/revelationEffects.ts`の`canUseRevelation`関数を以下に置き換える(`RELIC_POOL`のimportをファイル冒頭に追加する):

```ts
// 天啓が現在の盤面状態で使用可能か判定する。虚(レリック付喪化)は未付喪化の所持レリックが
// 1つ以上あるか、鬼(レリックランダム獲得)は未所持のレリックが1つ以上あるかを判定する
// (それ以外は常に使用可)。
export function canUseRevelation(
  _params: ShidasuParams,
  _wave: WaveState,
  revelationId: RevelationId,
  relics: { id: RelicId; tsukumoka: boolean }[] = []
): boolean {
  if (revelationId === 'kyo') {
    return relics.some(r => !r.tsukumoka)
  }
  if (revelationId === 'oni') {
    const ownedIds = new Set(relics.map(r => r.id))
    return RELIC_POOL.some(id => !ownedIds.has(id))
  }
  return true
}
```

`src/lib/game/shidasu/revelationEffects.ts`冒頭のimport文(現在`import type { Card, DeckCard, Rank, Suit, WaveState, RevelationId, RelicId } from './types'`の直後にある想定)に以下を追加する:

```ts
import { RELIC_POOL } from './relics'
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm run test -- revelationEffects.test.ts`
Expected: PASS

- [ ] **Step 5: 型チェック**

Run: `npm run check`
Expected: PASS

- [ ] **Step 6: 全体テスト実行**

Run: `npm run test`
Expected: PASS

- [ ] **Step 7: コミット**

```bash
git add src/lib/game/shidasu/revelationEffects.ts src/lib/game/shidasu/revelationEffects.test.ts
git commit -m "feat: canUseRevelationに未所持レリック判定(鬼)を追加"
```

---

### Task 3: `grantRevelationReward`にレリック獲得ロジックを実装する

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`(`grantRevelationReward`関数、import文)
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`内で`describe('useRevelation: 虚(レリック付喪化)'`ブロックを検索し、その直後に以下の新しいdescribeブロックを追記する(セットアップパターンは同ブロック内の既存テストを踏襲すること):

```ts
describe('useRevelation: 鬼(レリックランダム獲得)', () => {
  test('未所持レリックが複数ある状態で使用すると1つ獲得する(tsukumoka: falseで追加)', () => {
    const params = DEFAULT_PARAMS
    let run = createInitialRun()
    const { wave } = startWave(params, 0, 0, [], run.deckComposition, 1)
    run = {
      ...run,
      phase: 'playing',
      wave,
      revelations: ['oni'],
      relics: [],
    }
    const next = useRevelation(params, run, 'oni', null, () => 0)
    expect(next.relics).toHaveLength(1)
    expect(next.relics[0].tsukumoka).toBe(false)
    expect(RELIC_POOL).toContain(next.relics[0].id)
    expect(next.revelations).toEqual([])
  })

  test('全レリックを所持済みの状態では使用しても何も変化しない', () => {
    const params = DEFAULT_PARAMS
    let run = createInitialRun()
    const { wave } = startWave(params, 0, 0, [], run.deckComposition, 1)
    run = {
      ...run,
      phase: 'playing',
      wave,
      revelations: ['oni'],
      relics: RELIC_POOL.map(id => ({ id, tsukumoka: false })),
    }
    const next = useRevelation(params, run, 'oni', null, () => 0)
    expect(next.relics).toEqual(run.relics)
    // canUseRevelationが使用不可を返すため、天啓自体も消費されない
    expect(next.revelations).toEqual(['oni'])
  })
})
```

(`createInitialRun`・`startWave`が実際のテストファイル内でのimport名・使い方と異なる場合、直前の「虚」テストブロックの実際のセットアップコードをそのまま踏襲すること。`RELIC_POOL`のimportが`engine.test.ts`に無ければ`$lib/game/shidasu/relics`から追加する。)

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test -- engine.test.ts -t "鬼(レリックランダム獲得)"`
Expected: FAIL(`grantRevelationReward`に`oni`のケースが無いため`relics`が変化しない)

- [ ] **Step 3: `engine.ts`に`RELIC_POOL`のimportを追加**

`src/lib/game/shidasu/engine.ts`冒頭のimport文、現在の

```ts
import { itemMaxCapacity, riteMaxCapacity, revelationOracleMaxCapacity, relicWaveEndBonus, relicRerollCostStep, relicFirstRerollFree } from './relics'
```

を以下に置き換える:

```ts
import { itemMaxCapacity, riteMaxCapacity, revelationOracleMaxCapacity, relicWaveEndBonus, relicRerollCostStep, relicFirstRerollFree, RELIC_POOL } from './relics'
```

- [ ] **Step 4: `grantRevelationReward`に`oni`のケースを追加**

`src/lib/game/shidasu/engine.ts`の`grantRevelationReward`関数内、`case 'subaru': { ... }`ブロックの直後に以下を追加する:

```ts
    case 'oni': {
      const ownedIds = new Set(runAfterRemoval.relics.map(r => r.id))
      const available = RELIC_POOL.filter(id => !ownedIds.has(id))
      if (available.length === 0) return {}
      const picked = available[Math.floor(rand() * available.length)]
      return { relics: [...runAfterRemoval.relics, { id: picked, tsukumoka: false }] }
    }
```

(既存の`subaru`ケースの直後、`ryuu`ケースの手前に配置する。既存のswitch文の他のケースは一切変更しない。)

- [ ] **Step 5: 型チェック**

Run: `npm run check`
Expected: PASS

- [ ] **Step 6: テストを実行して成功を確認**

Run: `npm run test -- engine.test.ts -t "鬼(レリックランダム獲得)"`
Expected: PASS

- [ ] **Step 7: 全体テスト実行**

Run: `npm run test`
Expected: PASS

- [ ] **Step 8: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 天啓「鬼」のレリックランダム獲得ロジックを実装"
```

---

### Task 4: ドキュメント更新と最終確認

**Files:**
- Modify: `docs/shidasu/shidasu-roadmap.md`
- Modify: `docs/shidasu/shidasu-current-rules.md`

- [ ] **Step 1: `shidasu-roadmap.md`項目2の件数記述を修正**

`docs/shidasu/shidasu-roadmap.md`の項目2「天啓の追加の検討」の実際の現在の文言を確認したうえで、二十八宿の実装済み件数を「27宿」→「28宿(全て実装完了)」に更新し、「残り1宿(鬼)は`mansions.ts`に温存済み」という記述を削除する(鬼を実装したことで温存対象が無くなるため)。

- [ ] **Step 2: `shidasu-roadmap.md`の完了済み履歴に新規エントリを追加**

`docs/shidasu/shidasu-roadmap.md`の「完了済み(履歴)」セクション末尾に以下を追加する:

```
- **天啓「鬼」(レリックランダム獲得)の実装**: 二十八宿のうち唯一未割当だった「鬼」を、2026-08-13に未所持のレリックをランダムに1つ獲得する効果として実装した。既存の護符ランダム獲得天啓「星」と同型のロジック(`grantRevelationReward`の`oni`ケース)。これにより二十八宿28宿全ての実装が完了した。詳細は`docs/superpowers/specs/2026-08-13-shidasu-relic-random-acquire-revelation-design.md`を参照。
```

- [ ] **Step 3: `shidasu-current-rules.md`の件数記述を修正**

`docs/shidasu/shidasu-current-rules.md`の7.3天啓セクションの実際の現在の文言を確認したうえで、「全28宿中27宿が効果実装済み」→「全28宿全て効果実装済み」に更新し、「残り1宿(鬼)は`mansions.ts`に見た目候補として温存されている(未定)」という記述を削除する。

- [ ] **Step 4: 全体ビルド・型チェック・テストの最終確認**

Run: `npm run build`
Expected: PASS

Run: `npm run check`
Expected: PASS

Run: `npm run test`
Expected: PASS(全テストグリーン)

- [ ] **Step 5: 開発サーバーでの目視確認**

Run: `npm run dev`

実プレイで天啓「鬼」を所持した状態まで到達するには運が絡み時間がかかることがある(直近の天啓「虚」実装時、実プレイでの到達を試みた際に長時間を要した実績あり)。効率的に確認するため、`src/routes/game/shidasu/+page.svelte`の`run`初期化部分(`let run = $state<RunState>(createInitialRun())`)を一時的に以下のようなデバッグ用コードに差し替える:

```ts
  let run = $state<RunState>(
    (() => {
      const r = beginRun(params, 1)
      const { wave } = startWave(params, 0, 0, [], r.deckComposition, 1)
      return {
        ...r,
        phase: 'shop',
        wave,
        shop: { individual: [], packs: [], relic: [] },
        relics: [],
        revelations: ['oni'],
      }
    })()
  )
```

(`beginRun`・`startWave`は既に`+page.svelte`にimport済みのはず。無ければ追加する。)

`http://localhost:5173/game/shidasu`で以下を確認する:
1. ショップ画面が表示され、所持天啓「鬼」の使用ボタンが表示される
2. 使用ボタンをクリックし、レリックが1つ増えること(所持レリックバッジに新しいレリックが追加表示される)を確認する
3. レイアウト崩れが無いことを確認する

確認後、デバッグ用コードを`git checkout -- src/routes/game/shidasu/+page.svelte`で完全に元に戻し、`git status`で差分ゼロを確認する。開発サーバーのプロセスも終了すること。

- [ ] **Step 6: コミット**

```bash
git add docs/shidasu/shidasu-roadmap.md docs/shidasu/shidasu-current-rules.md
git commit -m "docs: 天啓「鬼」実装(二十八宿28宿完了)をroadmap・現行ルールへ反映"
```

---

## Self-Review メモ(執筆時点で実施済み)

- **spec網羅性:** specの「効果仕様」→Task1・Task3、「データ・ロジック変更」の型・データ→Task1、`revelationEffects.ts`/`engine.ts`の変更→Task2・Task3、「テスト」節の各パターン(全所持済み・未所持あり・0件所持、正常系・全所持済み時の未変化)→Task2・Task3のテストコードに反映、「スコープ外」に記載の通りUI変更・レリック個別候補追加は対象外(本プランでも一切触れていない)。ドキュメント更新はTask4で対応(specのテスト節に記載の目視確認手順も含む)。
- **プレースホルダー無し確認:** 全ステップに実コード・実コマンドを記載。Task1 Step1・Task4 Step1/Step3のような「実際の現在の文言を確認したうえで更新する」という指示は、既存ドキュメントの正確な文言がタスク実行時点で分からないための実務的な手順であり、プレースホルダーではない。
- **型の一貫性:** `oni`という同一のIDをTask1〜4の全ステップで一貫して使用。`RELIC_POOL`のimportパターンをTask2(`revelationEffects.ts`)・Task3(`engine.ts`)で統一。`grantRevelationReward`の`oni`ケースは、specに書かれた`subaru`ケースと対になる実装(`available.length === 0`ガード、`Math.floor(rand() * available.length)`による抽選)を完全に踏襲。
- **既存パターンとの整合性:** `canUseRevelation`のシグネチャ(`relics`パラメータ)は天啓「虚」実装時に既に確立済みのものをそのまま再利用しており、シグネチャ変更は発生しない(Task2は関数内にif分岐を1つ追加するのみ)。`useRevelation`の呼び出し引数順序(`targetCol`, `rand`)も変更しない(`oni`は列選択・レリック選択のどちらも不要なため、`targetCol: null`のみで足りる)。
