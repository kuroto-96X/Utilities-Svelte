# Wave生成タイミング再設計 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wave生成(`startWave`呼び出し)を「Wave開始ボタン押下時」の1箇所に統一し、配布アニメーションの誤発火を解消する。タイトル画面直後もステージ画面を経由させ、ショップ中の天啓ターゲット選択は現在のデッキ構成から都度生成する使い捨てプレビュー盤面に切り離す。

**Architecture:** `beginRun`・`enterShop`から`startWave`呼び出しを削除し、実Wave生成は既存の`finishShop`(ステージ画面の「WaveNへ進む」ボタン)のみが担う。ショップ系フェーズでの天啓ターゲット選択は、新設する`startRevelationPreview`で`run.deckComposition`から使い捨て`WaveState`を生成し、既存の天啓適用関数(`buyIndividualRevelationUse`等)をこのプレビューに対して適用した後、`deckComposition`等の永続的な変更のみ`run`に反映してプレビュー自体は片付けアニメ後に破棄する。

**Tech Stack:** SvelteKit, Svelte 5 runes, TypeScript, Vitest

---

## 前提知識(実装者が押さえておくべき既存動作)

- `startWave`(`src/lib/game/shidasu/engine.ts:108-195`)は`_stageIndex`・`_waveIndex`引数を実質使わない純粋関数で、`deckComposition`からシャッフルして`WaveState`を1つ生成する。`stageIndex`/`waveIndex`はダミー値(`0, 0`)を渡しても問題ない。
- 天啓効果(`applyRevelationEffect`、`src/lib/game/shidasu/revelationEffects.ts:108`)は`wave.tableau`と`deckComposition`の両方を変換して返す。**永続する本質的な効果は`deckComposition`側**(`deckId`をキーに変換内容が刻まれ、次回`startWave`時にそれが反映される)。`wave.tableau`側の変換は、その時点で表示している盤面への即時反映にすぎない。
- 天啓ターゲット選択には`source: 'individual'`(ショップのバラ売り即時使用)・`'pack'`(福袋中身)・`'held'`(保有天啓の使用)の3種類があるが、プレビュー化するかどうかは`source`の種類ではなく**ターゲット確定操作時の`run.phase`がショップ系フェーズ(`SHOP_FLOW_PHASES`)かどうか**で決まる。`playing`フェーズ中の`'held'`使用は今回の変更対象外(既存のまま実Waveに適用する)。
- 片付けアニメーション(`PlayArea.svelte`)は現在`wave.status === 'ended' && wave.endReason === 'target'`のときのみ発火する(609行目・722行目の2箇所)。プレビュー破棄用に`WaveEndReason`へ新しい値`'previewDismissed'`を追加し、この条件に含める。

---

### Task 1: `beginRun`をステージ画面経由に変更

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts:1021-1052`(`beginRun`関数)
- Modify: `src/lib/game/shidasu/engine.test.ts`(`beginRun`テストヘルパー・関連テスト)

現状の`beginRun`:

```ts
export function beginRun(params: ShidasuParams, seed?: number, spreadId: SpreadId = 'fool'): RunState {
  const initialExtraTableauRows = params.spreads[spreadId].initialExtraTableauRows
  const rand = createRng(seed ?? Math.floor(Math.random() * 999999) + 1)
  const initialStageStars = rollStageStars(params, rand)
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
    spreadId,
    stageStars: initialStageStars,
    currency: params.currency.initialAmount,
    oracles: [],
    shop: null,
    offerPickRemaining: 0,
    riteOffer: [],
    pendingNewRite: null,
    pendingNewRevelation: null,
    pendingNewOracle: null,
  }
}
```

- [ ] **Step 1: `engine.test.ts`内の`endedRun`ヘルパーを`beginRun`非依存に修正**

まず`engine.test.ts`で`beginRun(...).wave!`を前提に組み立てている`endedRun`ヘルパー(2190-2196行目付近)を確認する。以下のような形になっているはず:

```ts
function endedRun(overrides: Partial<RunState> = {}): RunState {
  const base = beginRun(DEFAULT_PARAMS, 1)
  return { ...base, wave: { ...base.wave!, status: 'ended', endReason: 'target' }, ...overrides }
}
```

これを、`beginRun`が将来`wave: null`を返すようになっても壊れないよう、`startWave`を直接呼ぶ形に書き換える:

```ts
function endedRun(overrides: Partial<RunState> = {}): RunState {
  const base = beginRun(DEFAULT_PARAMS, 1)
  const { wave } = startWave(DEFAULT_PARAMS, 0, 0, base.items, base.deckComposition, 1, base.extraTableauRows, base.oracleLevels)
  return { ...base, wave: { ...wave, status: 'ended', endReason: 'target' }, ...overrides }
}
```

(`startWave`は`engine.test.ts`の先頭で既にimportされているはず。されていなければimport文に追加する。)

- [ ] **Step 2: テストを実行し、Step 1のリファクタが既存テストを壊していないことを確認**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts`
Expected: 全件PASS(この時点では`beginRun`自体はまだ変更していないため、実質ノーオペのリファクタ)

- [ ] **Step 3: コミット**

```bash
git add src/lib/game/shidasu/engine.test.ts
git commit -m "test: endedRunヘルパーをbeginRun非依存にリファクタ"
```

- [ ] **Step 4: `beginRun`のテストを新仕様のアサーションに書き換える(失敗させる)**

`engine.test.ts`内で`beginRunはplayingフェーズでステージ0・ウェーブ0から始まる`テスト(2118行目付近)を以下に書き換える:

```ts
test('beginRunはshopフェーズでステージ0・ウェーブ0から始まり、waveは未生成', () => {
  const run = beginRun(DEFAULT_PARAMS, 1)
  expect(run.phase).toBe('shop')
  expect(run.stageIndex).toBe(0)
  expect(run.waveIndex).toBe(0)
  expect(run.wave).toBeNull()
  expect(run.shop).toBeNull()
})
```

`beginRunはspreadIdを省略するとfoolになり...場札は通常の行数で配られる`(2127行目付近)・`spreadId=moonを指定すると...場札は通常より1行少なく配られる`(2134行目付近)の2件は、`run.wave!.tableau`を直接参照しているため、`finishShop`経由でWaveを生成してから検証するよう書き換える:

```ts
test('beginRunはspreadIdを省略するとfoolになり、finishShop後の場札は通常の行数で配られる', () => {
  const run = beginRun(DEFAULT_PARAMS, 1)
  const started = finishShop(DEFAULT_PARAMS, { ...run, shop: rollShop(run, () => 0.5) }, 1)
  expect(started.wave!.tableau[0].length).toBe(DEFAULT_PARAMS.layout.rows)
})

test('spreadId=moonを指定すると、finishShop後の場札は通常より1行少なく配られる', () => {
  const run = beginRun(DEFAULT_PARAMS, 1, 'moon')
  const started = finishShop(DEFAULT_PARAMS, { ...run, shop: rollShop(run, () => 0.5) }, 1)
  expect(started.wave!.tableau[0].length).toBe(DEFAULT_PARAMS.layout.rows - 1)
})
```

(`finishShop`は`run.phase !== 'shop'`をガードにしているだけで`run.shop`の非nullは要求していないため、`shop: rollShop(...)`を挟まなくても動く可能性が高い。実装時に`finishShop`の実コードを確認し、`shop`セットが不要ならそのまま`finishShop(DEFAULT_PARAMS, run, 1)`でよい。`rollShop`のimportが未済みなら追加する。)

- [ ] **Step 5: テストを実行し、Step 4で書き換えたテストが失敗することを確認**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "beginRun"`
Expected: FAIL(`run.phase`が`'playing'`のまま、`run.wave`が非nullのため)

- [ ] **Step 6: `beginRun`の実装を変更**

```ts
export function beginRun(params: ShidasuParams, seed?: number, spreadId: SpreadId = 'fool'): RunState {
  const initialExtraTableauRows = params.spreads[spreadId].initialExtraTableauRows
  const rand = createRng(seed ?? Math.floor(Math.random() * 999999) + 1)
  const initialStageStars = rollStageStars(params, rand)
  return {
    phase: 'shop',
    stageIndex: 0,
    waveIndex: 0,
    items: [],
    offer: [],
    wave: null,
    pendingNewItem: null,
    deckComposition: standardDeckComposition(),
    rites: [],
    revelations: [],
    revelationOffer: [],
    extraTableauRows: initialExtraTableauRows,
    oracleLevels: defaultOracleLevels(),
    oracleOffer: [],
    spreadId,
    stageStars: initialStageStars,
    currency: params.currency.initialAmount,
    oracles: [],
    shop: null,
    offerPickRemaining: 0,
    riteOffer: [],
    pendingNewRite: null,
    pendingNewRevelation: null,
    pendingNewOracle: null,
  }
}
```

- [ ] **Step 7: テストを実行し、全件PASSすることを確認**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts`
Expected: PASS(Step 1のリファクタで先に守った他のテストも含め全件通ること)

- [ ] **Step 8: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: beginRunをshopフェーズ・Wave未生成で終わるよう変更"
```

---

### Task 2: `enterShop`から次Wave事前生成を削除

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts:1093-1113`(`enterShop`関数)
- Modify: `src/lib/game/shidasu/engine.test.ts`

現状の`enterShop`:

```ts
function enterShop(params: ShidasuParams, run: RunState, seed: number | undefined, rand: () => number): RunState {
  const newLocation = nextWaveLocation(params, run)
  const newStageStars = nextStageStars(params, run, newLocation, rand)
  const { wave, deckComposition } = startWave(params, newLocation.stageIndex, newLocation.waveIndex, run.items, run.deckComposition, seed, run.extraTableauRows, run.oracleLevels)
  const next: RunState = {
    ...run,
    phase: 'shop',
    stageIndex: newLocation.stageIndex,
    waveIndex: newLocation.waveIndex,
    stageStars: newStageStars,
    offer: [],
    pendingNewItem: null,
    wave,
    deckComposition,
    revelationOffer: [],
    oracleOffer: [],
    riteOffer: [],
    offerPickRemaining: 0,
  }
  return { ...next, shop: rollShop(next, rand) }
}
```

- [ ] **Step 1: 「ショップ突入時、次のウェーブ位置・ボス種別・プレビューウェーブが確定する」テスト(2207行目付近)を新仕様に書き換える**

現状このテストは`result.wave`が新規生成された`status: 'playing'`のWaveであることを検証しているはず。以下のように、`run.wave`が変更されず直前Waveのまま保持されることを検証するテストに書き換える:

```ts
test('ショップ突入時、次のウェーブ位置・stageStarsは確定するが、waveは直前Waveの状態のまま変更されない', () => {
  const run = endedRun({ waveIndex: 0 })
  const previousWave = run.wave
  const result = resolveWaveEnd(DEFAULT_PARAMS, run, () => 0.5, 1)
  expect(result.phase).toBe('shop')
  expect(result.waveIndex).toBe(1)
  expect(result.wave).toBe(previousWave)
  expect(result.shop).not.toBeNull()
})
```

(既存テストが`waveIndex`や`stageStars`について他にも検証していた場合は、その内容を維持しつつ`wave`関連のアサーションのみ上記のように差し替える。実装時に既存テストの全文を確認すること。)

- [ ] **Step 2: テストを実行し失敗することを確認**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "ショップ突入"`
Expected: FAIL(`result.wave`が新規生成されたWaveになっており、`previousWave`と異なるため)

- [ ] **Step 3: `enterShop`の実装を変更**

```ts
function enterShop(params: ShidasuParams, run: RunState, seed: number | undefined, rand: () => number): RunState {
  const newLocation = nextWaveLocation(params, run)
  const newStageStars = nextStageStars(params, run, newLocation, rand)
  const next: RunState = {
    ...run,
    phase: 'shop',
    stageIndex: newLocation.stageIndex,
    waveIndex: newLocation.waveIndex,
    stageStars: newStageStars,
    offer: [],
    pendingNewItem: null,
    revelationOffer: [],
    oracleOffer: [],
    riteOffer: [],
    offerPickRemaining: 0,
  }
  return { ...next, shop: rollShop(next, rand) }
}
```

(`seed`引数は`startWave`呼び出しの削除により未使用になるが、`enterShop`のシグネチャ自体は呼び出し元`resolveWaveEnd`との整合のため変更しない。TypeScriptの未使用引数警告が出る場合は`_seed`にリネームするか、既存のlint設定に従う。)

- [ ] **Step 4: テストを実行し、全件PASSすることを確認**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: enterShopから次Wave事前生成を削除しwaveを保持"
```

---

### Task 3: `finishShop`の回帰確認テストを追加

**Files:**
- Modify: `src/lib/game/shidasu/engine.test.ts`

`finishShop`は現状ノーテストのため、Task 1・2の変更後にこの関数だけが唯一のWave生成経路になることを踏まえ、明示的な回帰テストを追加する。

- [ ] **Step 1: `finishShop`のテストを追加**

`engine.test.ts`内、`rerollStageStars`describeブロックの直後あたりに新しいdescribeブロックを追加する:

```ts
describe('finishShop', () => {
  test('phaseがshopのとき、waveが新規生成されplayingへ遷移する', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const shopRun = { ...run, shop: rollShop(run, () => 0.5) }
    const result = finishShop(DEFAULT_PARAMS, shopRun, 1)
    expect(result.phase).toBe('playing')
    expect(result.wave).not.toBeNull()
    expect(result.wave!.status).toBe('playing')
    expect(result.shop).toBeNull()
  })

  test('phaseがshop以外のとき、何も変化しない', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'playing' }
    const result = finishShop(DEFAULT_PARAMS, run, 1)
    expect(result).toEqual(run)
  })
})
```

(`rollShop`が`engine.test.ts`内で未importなら`$lib/game/shidasu/shop`または`engine.ts`のre-exportからimportを追加する。既存のショップ関連テストのimport元を確認して揃えること。)

- [ ] **Step 2: テストを実行しPASSすることを確認**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "finishShop"`
Expected: PASS(`finishShop`自体は今回変更していないため、既存実装のままテストが通ることを確認する)

- [ ] **Step 3: コミット**

```bash
git add src/lib/game/shidasu/engine.test.ts
git commit -m "test: finishShopの回帰確認テストを追加"
```

---

### Task 4: `WaveEndReason`に`previewDismissed`を追加

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`(`WaveEndReason`型定義箇所)

- [ ] **Step 1: `WaveEndReason`型を確認し、`previewDismissed`を追加**

`types.ts`内で`WaveEndReason`の定義を検索する(`export type WaveEndReason = ...`)。現状の値に`'previewDismissed'`を追加する。例えば現状が以下のような形であれば:

```ts
export type WaveEndReason = 'target' | 'stuck' | 'greatMisfortune' | null
```

以下のように変更する:

```ts
export type WaveEndReason = 'target' | 'stuck' | 'greatMisfortune' | 'previewDismissed' | null
```

(実際のunion内容は実装時に`types.ts`を読んで確認すること。上記は例示。)

- [ ] **Step 2: 型チェックを実行し、この値を網羅していないswitch文がないか確認**

Run: `npm run check`
Expected: `WaveEndReason`の値を`switch`で網羅的に扱っている箇所があれば、`previewDismissed`未対応のエラーが出る可能性がある。出た場合は該当箇所を確認し、`previewDismissed`はUI専用の一時的な値であり`resolveWaveEnd`等のゲームロジック側では現れない前提であることを踏まえ、`default`ケースで無害に処理されるようにする(必要であれば該当箇所を修正、対応不要なら次のStepへ)。

- [ ] **Step 3: コミット**

```bash
git add src/lib/game/shidasu/types.ts
git commit -m "feat: WaveEndReasonに天啓プレビュー破棄用のpreviewDismissedを追加"
```

(Step 2で追加修正が発生した場合は、そのファイルも`git add`に含める。)

---

### Task 5: 天啓プレビュー生成関数`startRevelationPreview`を追加

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: `SHOP_FLOW_PHASES`を`export`に変更**

`engine.ts`内の以下の行(968行目付近)を:

```ts
const SHOP_FLOW_PHASES: RunPhase[] = ['shop', 'itemSelect', 'riteSelect', 'revelationSelect', 'oracleSelect']
```

以下に変更する:

```ts
export const SHOP_FLOW_PHASES: RunPhase[] = ['shop', 'itemSelect', 'riteSelect', 'revelationSelect', 'oracleSelect']
```

- [ ] **Step 2: `startRevelationPreview`のテストを先に書く**

`engine.test.ts`に新しいdescribeブロックを追加する:

```ts
describe('startRevelationPreview', () => {
  test('run.deckCompositionから場札を配ったWaveStateを生成する(本番run.waveには影響しない)', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const originalWave = run.wave
    const preview = startRevelationPreview(DEFAULT_PARAMS, run, 1)
    expect(preview.status).toBe('playing')
    expect(preview.tableau.length).toBe(DEFAULT_PARAMS.layout.cols)
    expect(run.wave).toBe(originalWave)
  })
})
```

- [ ] **Step 3: テストを実行し失敗することを確認(関数未定義)**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "startRevelationPreview"`
Expected: FAIL(`startRevelationPreview is not defined`)

- [ ] **Step 4: `startRevelationPreview`を実装**

`enterShop`関数の直後あたりに追加する:

```ts
// ショップ系フェーズでの天啓ターゲット選択用に、現在のdeckCompositionから使い捨ての
// プレビュー盤面を生成する。stageIndex/waveIndexはstartWave内部では実質未使用のため
// ダミー値(0, 0)を渡す。生成したWaveStateは本番run.waveとは無関係な一時オブジェクトであり、
// 呼び出し元(+page.svelte)がローカルstateとして保持・破棄する。
export function startRevelationPreview(params: ShidasuParams, run: RunState, seed?: number): WaveState {
  const { wave } = startWave(params, 0, 0, run.items, run.deckComposition, seed, run.extraTableauRows, run.oracleLevels)
  return wave
}
```

- [ ] **Step 5: テストを実行し、PASSすることを確認**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts`
Expected: 全件PASS

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 天啓プレビュー用のstartRevelationPreview関数を追加"
```

---

### Task 6: `PlayArea.svelte`の片付けアニメ発火条件を拡張

**Files:**
- Modify: `src/routes/game/shidasu/PlayArea.svelte:609, 722`

- [ ] **Step 1: 該当2箇所の条件式を確認・変更**

`PlayArea.svelte`の609行目・722行目付近にある`wave.status === 'ended' && wave.endReason === 'target'`という条件式を、それぞれ以下に変更する:

```ts
if (wave.status === 'ended' && (wave.endReason === 'target' || wave.endReason === 'previewDismissed')) startCleanupAnimation()
```

(実際の周辺コードの書き方に合わせて、条件式部分のみを変更すること。2箇所とも同様の変更を行う。)

- [ ] **Step 2: 型チェック・既存テストを実行**

Run: `npm run check`
Run: `npx vitest run src/lib/game/shidasu/`
Expected: いずれもエラーなし(この時点ではまだ`previewDismissed`を実際にセットする呼び出し元がないため、動作確認はTask 8完了後にブラウザで行う)

- [ ] **Step 3: コミット**

```bash
git add src/routes/game/shidasu/PlayArea.svelte
git commit -m "feat: 片付けアニメーションの発火条件にpreviewDismissedを追加"
```

---

### Task 7: タイトル→ステージ画面の遷移配線

**Files:**
- Modify: `src/routes/game/shidasu/+page.svelte`

- [ ] **Step 1: `handleStartWithSpread`を変更**

現状(132-135行目):

```ts
function handleStartWithSpread(spreadId: SpreadId) {
  run = beginRun(params, undefined, spreadId)
  afterAction()
}
```

以下に変更する:

```ts
function handleStartWithSpread(spreadId: SpreadId) {
  run = beginRun(params, undefined, spreadId)
  showStageScreen = true
}
```

(`afterAction()`は`run.wave`が存在する前提の手詰まりチェック等を行う関数だが、`beginRun`後は`wave: null`になるため呼ぶ必要がなくなる。)

- [ ] **Step 2: ステージ画面の表示条件から`run.shop`の非null判定を除く**

790行目付近の以下の条件:

```svelte
{#if run.phase === 'shop' && run.shop && !pendingRevelationTarget && showStageScreen}
```

を以下に変更する:

```svelte
{#if run.phase === 'shop' && !pendingRevelationTarget && showStageScreen}
```

(ショップ画面本体、529行目の`{#if run.phase === 'shop' && run.shop && !pendingRevelationTarget && !showStageScreen}`は`run.shop`判定を維持したまま変更しない。ラン開始直後は`shop: null`のためショップ画面自体は表示されず、ステージ画面のみが表示される。)

- [ ] **Step 3: ステージ画面内の`baseTarget`計算・Wave一覧表示が`run.shop`なしでも問題なく動くか確認**

ステージ画面のマークアップ(790行目以降)は`run.stageIndex`・`run.stageStars`・`run.currency`・`run.waveIndex`のみを参照しており`run.shop`を直接使っていないはず。実装時にコードを読んで確認し、`run.shop`への参照が残っていた場合は削除または代替対応を行う。

- [ ] **Step 4: ビルド・型チェックを実行**

Run: `npm run build`
Run: `npm run check`
Expected: shidasu関連のエラーなし

- [ ] **Step 5: コミット**

```bash
git add src/routes/game/shidasu/+page.svelte
git commit -m "feat: タイトル画面直後にステージ画面を表示するよう変更"
```

---

### Task 8: 天啓プレビューのフルフロー実装

**Files:**
- Modify: `src/routes/game/shidasu/+page.svelte`

このタスクは相互に依存するstate・ハンドラ・描画ブロックをまとめて変更する必要があるため、1タスクとして扱う。

- [ ] **Step 1: import文に`SHOP_FLOW_PHASES`・`startRevelationPreview`を追加**

`+page.svelte`冒頭のengine.tsからのimport文に以下を追加する:

```ts
import {
  createInitialRun, beginRun, applyPlayCard, applyDrawStock, applyStuckCheck,
  resolveWaveEnd, continueAfterGreatMisfortune, stopAfterGreatMisfortune, startWave, forceStockTop, useRite,
  useRevelation,
  waveTarget, stageModifierFor, isBossWave, skipWave, rerollStageStars,
  finishShop, buyIndividualItem, buyIndividualRite, buyIndividualRevelationUse, buyIndividualRevelationHold,
  buyIndividualOracleUse, buyIndividualOracleHold, buyPack,
  pickPackItem, confirmPackItemSwap, cancelPackItemSwap, closePackItemSelect,
  pickPackRite, confirmPackRiteSwap, cancelPackRiteSwap, closePackRiteSelect,
  pickPackRevelationUse, pickPackRevelationHold, confirmPackRevelationSwap, cancelPackRevelationSwap, closePackRevelationSelect,
  pickPackOracleUse, pickPackOracleHold, confirmPackOracleSwap, cancelPackOracleSwap, closePackOracleSelect,
  useOracle, sellItem, sellRite, sellRevelation, sellOracle,
  SHOP_FLOW_PHASES, startRevelationPreview,
} from '$lib/game/shidasu/engine'
```

`import type { ... } from '$lib/game/shidasu/types'`に`WaveState`が含まれていなければ追加する。

- [ ] **Step 2: 天啓プレビュー用のローカルstateを追加**

`let pendingRevelationTarget = $state<...>(null)`の直前あたりに追加する:

```ts
// ショップ系フェーズでの天啓ターゲット選択用の使い捨てプレビュー盤面。非nullの間、
// pendingRevelationTargetのコラム選択はrun.waveではなくこちらを対象に行う。
// playingフェーズ中の保有天啓使用(source: 'held')ではセットされない。
let revelationPreviewWave = $state<WaveState | null>(null)
let revelationPreviewSeq = 0
let revelationPreviewWaveKey = $state('')

function beginRevelationPreview() {
  revelationPreviewWave = startRevelationPreview(params, run)
  revelationPreviewWaveKey = `revelation-preview-${++revelationPreviewSeq}`
}
```

- [ ] **Step 3: 天啓使用系ハンドラを変更しプレビュー生成トリガーを追加**

既存の3関数(306-329行目付近)を以下に変更する:

```ts
function handleBuyIndividualRevelationUse(slotIndex: number, revelationId: RevelationId) {
  if (revelationNeedsTarget(revelationId)) {
    pendingRevelationTarget = { revelationId, source: 'individual', slotIndex }
    beginRevelationPreview()
    return
  }
  run = buyIndividualRevelationUse(params, run, slotIndex, null)
}

function handlePickPackRevelationUse(revelationId: RevelationId) {
  if (revelationNeedsTarget(revelationId)) {
    pendingRevelationTarget = { revelationId, source: 'pack' }
    beginRevelationPreview()
    return
  }
  run = pickPackRevelationUse(params, run, revelationId, null)
}

function handleUseRevelationClick(revelationId: RevelationId) {
  if (revelationNeedsTarget(revelationId)) {
    pendingRevelationTarget = { revelationId, source: 'held' }
    if (SHOP_FLOW_PHASES.includes(run.phase)) {
      beginRevelationPreview()
    }
    return
  }
  run = useRevelation(params, run, revelationId, null)
  if (run.phase === 'playing') afterAction()
}
```

- [ ] **Step 4: `handleCancelRevelationTarget`を変更**

既存(331-333行目付近):

```ts
function handleCancelRevelationTarget() {
  pendingRevelationTarget = null
}
```

以下に変更する:

```ts
function handleCancelRevelationTarget() {
  pendingRevelationTarget = null
  revelationPreviewWave = null
}
```

- [ ] **Step 5: `handleTargetColumn`をプレビュー分岐対応に変更**

既存(335-347行目付近):

```ts
function handleTargetColumn(colIndex: number) {
  if (!pendingRevelationTarget) return
  const target = pendingRevelationTarget
  pendingRevelationTarget = null
  if (target.source === 'individual') {
    run = buyIndividualRevelationUse(params, run, target.slotIndex, colIndex)
  } else if (target.source === 'pack') {
    run = pickPackRevelationUse(params, run, target.revelationId, colIndex)
  } else {
    run = useRevelation(params, run, target.revelationId, colIndex)
    if (run.phase === 'playing') afterAction()
  }
}
```

以下に変更する:

```ts
function handleTargetColumn(colIndex: number) {
  if (!pendingRevelationTarget) return
  const target = pendingRevelationTarget
  pendingRevelationTarget = null

  if (revelationPreviewWave) {
    // プレビュー盤面に対して既存の天啓適用関数を流用する。run.waveを一時的に
    // プレビューへすり替えて呼び出し、結果からwave以外(deckComposition・currency・
    // shop・revelations等の永続的な変更)のみ本番runへ反映する。wave自体は
    // 呼び出し前のrun.wave(直前Waveのended状態)のまま変更しない。
    const runForPreview = { ...run, wave: revelationPreviewWave }
    let resultRun: RunState
    if (target.source === 'individual') {
      resultRun = buyIndividualRevelationUse(params, runForPreview, target.slotIndex, colIndex)
    } else if (target.source === 'pack') {
      resultRun = pickPackRevelationUse(params, runForPreview, target.revelationId, colIndex)
    } else {
      resultRun = useRevelation(params, runForPreview, target.revelationId, colIndex)
    }
    const previewResultWave = resultRun.wave
    run = { ...resultRun, wave: run.wave }
    revelationPreviewWave = previewResultWave
      ? { ...previewResultWave, status: 'ended', endReason: 'previewDismissed' }
      : null
    return
  }

  if (target.source === 'individual') {
    run = buyIndividualRevelationUse(params, run, target.slotIndex, colIndex)
  } else if (target.source === 'pack') {
    run = pickPackRevelationUse(params, run, target.revelationId, colIndex)
  } else {
    run = useRevelation(params, run, target.revelationId, colIndex)
    if (run.phase === 'playing') afterAction()
  }
}
```

- [ ] **Step 6: `canTargetRevelationColumn`をプレビュー参照対応に変更**

既存(349-353行目付近):

```ts
function canTargetRevelationColumn(colIndex: number): boolean {
  if (!wave || !pendingRevelationTarget) return false
  if (pendingRevelationTarget.revelationId === 'aya') return true
  return wave.tableau[colIndex].length > 0
}
```

以下に変更する:

```ts
function canTargetRevelationColumn(colIndex: number): boolean {
  const targetWave = revelationPreviewWave ?? wave
  if (!targetWave || !pendingRevelationTarget) return false
  if (pendingRevelationTarget.revelationId === 'aya') return true
  return targetWave.tableau[colIndex].length > 0
}
```

- [ ] **Step 7: プレビュー片付け完了ハンドラを追加**

`handleCleanupDone`(126-128行目付近)の直後に追加する:

```ts
// 天啓プレビュー盤面の片付けアニメーション(PlayArea側のonCleanupDone経由)が
// 完了した後に呼ばれる。resolveWaveEndは呼ばず、プレビューstateを破棄するだけで
// ショップ画面表示に戻る(run自体は既にhandleTargetColumnで更新済み)。
function handleRevelationPreviewCleanupDone() {
  revelationPreviewWave = null
}
```

- [ ] **Step 8: プレビュー用`PlayArea`描画ブロックを追加**

既存の`{:else if wave && run.phase === 'revelationSelect'}`ブロック(498-510行目付近)の直前に、新しいブロックを追加する:

```svelte
{#if revelationPreviewWave}
  <PlayArea
    wave={revelationPreviewWave} {params} modifier={currentModifier} target={0} items={run.items}
    onPlayCard={() => {}} onDraw={() => {}}
    showScoreAndCombo={false} allowDraw={false}
    onCleanupDone={handleRevelationPreviewCleanupDone}
    waveKey={revelationPreviewWaveKey}
    headerExtra={stageRow}
    columnTargetMode={true}
    canTargetColumn={canTargetRevelationColumn}
    onTargetColumn={handleTargetColumn}
    chainAreaExtra={revelationSelectExtra}
  />
{:else if wave && run.phase === 'revelationSelect'}
```

(`currentModifier`・`target`が既存コード内でどう定義されているか実装時に確認し、他のPlayArea呼び出し箇所と同じ変数を使う。`modifier`は本来Wave固有のステージ制限だが、プレビュー用途では表示上ほぼ影響しないため、既存の`currentModifier`をそのまま流用してよい。)

- [ ] **Step 9: ビルド・型チェックを実行**

Run: `npm run build`
Run: `npm run check`
Expected: shidasu関連のエラーなし

- [ ] **Step 10: コミット**

```bash
git add src/routes/game/shidasu/+page.svelte
git commit -m "feat: ショップ系フェーズの天啓ターゲット選択を専用プレビュー盤面に切り離す"
```

---

### Task 9: 統合確認

**Files:** なし(確認のみ)

- [ ] **Step 1: 自動テスト全件実行**

Run: `npx vitest run`
Expected: 全件PASS

- [ ] **Step 2: ビルド・型チェック**

Run: `npm run build`
Run: `npm run check`
Expected: shidasu関連のエラーなし

- [ ] **Step 3: 開発サーバーを起動しブラウザで一連のフローを確認**

Run: `npm run dev`

以下を目視確認する:
1. タイトル画面でスプレッド選択 → ショップを経由せず直接ステージ画面が表示される
2. ステージ画面で「Wave1へ進む」→ 配布アニメーションが再生されプレイ画面になる
3. Waveクリア → 片付けアニメーション再生 → 片付け後の状態のままショップ画面が開く(配布アニメが裏で誤発火しない)
4. ショップ画面でバラ売り天啓(コラム選択が必要なもの、例: 甲・乙等)を使用 → プレビュー盤面が配布アニメ付きで表示される
5. プレビュー盤面でコラムを選択 → 片付けアニメーションが再生されプレビューが消え、ショップ画面に戻る
6. ショップ画面から「次のWaveへ」→ ステージ画面 → 「WaveNへ進む」→ 配布アニメーション再生
7. プレイ中に保有天啓(コラム選択が必要なもの)を使用 → 従来通り実Wave上でそのまま動作する(プレビューを経由しない)
8. 既存の配布アニメーション・片付けアニメーション以外の演出(得点内訳・チェーンリセット等)に影響が出ていないこと

- [ ] **Step 4: 問題があれば修正、なければ完了**

問題が見つかった場合は該当箇所を修正し、Step 1からやり直す。
