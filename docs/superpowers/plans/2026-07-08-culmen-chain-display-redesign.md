# Culmen チェーン重ね表示・山札由来アンカー導入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Culmenのチェーン表示を、山札由来の札を基準線・場からプレイした札を少し上にずらした1本の連続した重なりに変更し、あわせてウェーブ開始時のfoundation・コンボリセット時の捲り札を`chain`の起点として組み込む。

**Architecture:** `WaveState`に`chainOrigin: ('play'|'draw')[]`を新設し、`chain`と対で各カードの由来を追跡する。`startWave`はfoundationを、`drawStock`のリセット分岐は捲った札を、それぞれ`chain`/`chainOrigin`の起点として設定する。UI側(`+page.svelte`)はこの`chainOrigin`を見て縦位置を切り替えつつ、全カードを横10pxずつずらした1本の重なりとして描画する。

**Tech Stack:** SvelteKit(Svelte 5 runes) / TypeScript / Vitest / Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-07-08-culmen-chain-display-redesign-design.md`

---

## 事前確認

- [ ] **Step 1: 作業ブランチを確認する**

```bash
git branch --show-current
```

Expected: `feat`(または `feat-*`)。

---

### Task 1: `chainOrigin`の型追加とstartWaveへの組み込み

**Files:**
- Modify: `src/lib/game/culmen/types.ts`
- Modify: `src/lib/game/culmen/engine.ts`
- Modify: `src/lib/game/culmen/engine.test.ts`

- [ ] **Step 1: 型を追加する**

`src/lib/game/culmen/types.ts` に以下を追加する。`DrawEffect`の直後に`ChainCardOrigin`を追加し、`WaveState`の`chain: Card[]`の直後に`chainOrigin: ChainCardOrigin[]`を追加する:

```ts
export type DrawEffect = 'wild' | 'shield' | 'pattern' | null
export type ChainCardOrigin = 'play' | 'draw'

export interface WaveState {
  tableau: Card[][]
  stock: Card[]
  foundation: Card
  score: number
  combo: number
  shieldLeft: number
  chain: Card[]
  chainOrigin: ChainCardOrigin[]
  linked: boolean
  columnsEmptiedThisCombo: number
  lastDrawEffect: DrawEffect
  status: WaveStatus
  endReason: WaveEndReason
  lastGain: ScoreGain | null
}
```

- [ ] **Step 2: テストヘルパー`makeWave`を更新する**

`src/lib/game/culmen/engine.test.ts` の`makeWave`関数(72行目付近)の`chain: [],`の直後に`chainOrigin: [],`を追加する:

```ts
function makeWave(overrides: Partial<WaveState> = {}): WaveState {
  return {
    tableau: [],
    stock: [],
    foundation: card(0, '♠', 5),
    score: 0,
    combo: 0,
    shieldLeft: 0,
    chain: [],
    chainOrigin: [],
    linked: false,
    columnsEmptiedThisCombo: 0,
    lastDrawEffect: null,
    status: 'playing',
    endReason: null,
    lastGain: null,
    ...overrides,
  }
}
```

- [ ] **Step 3: 失敗するテストを書く**

`describe('startWave', ...)`内の「初期状態」テスト(162行目付近)を以下に置き換える:

```ts
  test('初期状態: チェーンにfoundationが1枚(由来はdraw)、スコア0、コンボ0、列一掃0、演出フラグnull', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], 1)
    expect(wave.score).toBe(0)
    expect(wave.combo).toBe(0)
    expect(wave.chain).toEqual([wave.foundation])
    expect(wave.chainOrigin).toEqual(['draw'])
    expect(wave.linked).toBe(false)
    expect(wave.columnsEmptiedThisCombo).toBe(0)
    expect(wave.lastDrawEffect).toBeNull()
    expect(wave.status).toBe('playing')
  })
```

Run: `npx vitest run src/lib/game/culmen/engine.test.ts`
Expected: FAIL(`wave.chain`が`[]`のまま、`wave.chainOrigin`が`undefined`)

- [ ] **Step 4: `startWave`を実装する**

`src/lib/game/culmen/engine.ts`の`startWave`の戻り値(89行目付近)を以下に置き換える(`chain: [],`を`chain: [foundation],`に変更し、その直後に`chainOrigin: ['draw'],`を追加する):

```ts
  return {
    tableau,
    stock: deck,
    foundation,
    score: 0,
    combo: hasStart1 ? params.items.startCombo : 0,
    shieldLeft: shieldCount * params.items.shieldChargesPerPick,
    chain: [foundation],
    chainOrigin: ['draw'],
    linked: false,
    columnsEmptiedThisCombo: 0,
    lastDrawEffect: null,
    status: 'playing',
    endReason: null as WaveEndReason,
    lastGain: null,
  }
```

- [ ] **Step 5: テストが通ることを確認する**

Run: `npx vitest run src/lib/game/culmen/engine.test.ts`
Expected: FAIL(他の多数のテストが型エラー・`chainOrigin`未定義で落ちる可能性がある。ここでは追加した「初期状態」テストだけがPASSしていればよい。他の失敗はTask 2で解消するため、この時点では許容する)

実際には、`makeWave`に`chainOrigin: []`を追加済みなので他のテストの型エラーは起きないはずだが、`drawStock`のリセット系テスト(`next.chain).toEqual([])`を検証しているもの)はこの時点でまだ**PASSしている**(`drawStock`はまだ変更していないため)。Task 1完了時点でのテスト実行結果を確認し、「初期状態」テストがPASSし、かつ他のテストの失敗が増えていないことを確認する。

- [ ] **Step 6: 型チェックを実行する**

Run: `npm run check`
Expected: culmen関連のエラーなし

- [ ] **Step 7: コミット**

```bash
git add src/lib/game/culmen/types.ts src/lib/game/culmen/engine.ts src/lib/game/culmen/engine.test.ts
git commit -m "feat: CulmenのWaveStateにchainOriginを追加しstartWaveでfoundationをチェーン起点にする"
```

## Context

`chainOrigin`は`chain`と同じ長さを保つ配列で、各カードが場からのプレイ(`'play'`)か山札からの捲り(`'draw'`)かを表す。このタスクでは型定義と`startWave`のみを変更する。`playCard`/`drawStock`側の`chainOrigin`追記ロジックはまだ実装しない(Task 2で対応)。`playCard`/`drawStock`は`{ ...wave, ... }`のスプレッド構文で新しい`WaveState`を作っているため、`chainOrigin`フィールド自体は型エラーなくそのまま引き継がれる(値の更新ロジックが無いだけ)。

---

### Task 2: `playCard`・`drawStock`の`chainOrigin`追記ロジック

**Files:**
- Modify: `src/lib/game/culmen/engine.ts`
- Modify: `src/lib/game/culmen/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`describe('playCard', ...)`内、末尾(「カードを取るとlastDrawEffectがクリアされる」テストの直後)に追記する:

```ts
  test('chainOriginにplayが追記される', () => {
    const wave = baseWave({ tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]] })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0)
    expect(next.chainOrigin).toEqual(['play'])
  })
```

`describe('drawStock', ...)`内の以下3つのテストを、次の内容に置き換える(捲った札1枚が新しい起点になることを検証する内容に変更):

置き換え対象1「通常時(継続条件なし): コンボ・チェーン・列一掃カウントがリセットされる」を以下に置き換える:

```ts
  test('通常時(継続条件なし): コンボ・チェーン・列一掃カウントがリセットされ、捲った札1枚が新しい起点になる', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 9)],
      combo: 3,
      shieldLeft: 0,
      chain: [card(2, '♣', 1)],
      chainOrigin: ['play'],
      linked: true,
      columnsEmptiedThisCombo: 2,
    })
    const next = drawStock(DEFAULT_PARAMS, wave, [])
    expect(next.foundation).toEqual(card(1, '♠', 9))
    expect(next.combo).toBe(0)
    expect(next.chain).toEqual([card(1, '♠', 9)])
    expect(next.chainOrigin).toEqual(['draw'])
    expect(next.linked).toBe(false)
    expect(next.columnsEmptiedThisCombo).toBe(0)
    expect(next.lastDrawEffect).toBeNull()
    expect(next.stock).toEqual([])
  })
```

置き換え対象2「パターンに合わずシールドも無ければ通常通りリセットする」を以下に置き換える:

```ts
  test('パターンに合わずシールドも無ければ通常通りリセットし、捲った札1枚が新しい起点になる', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)], // 同スートでも階段でもない
      combo: 2,
      shieldLeft: 0,
      chain: [card(2, '♥', 5)],
      chainOrigin: ['play'],
      linked: true,
    })
    const next = drawStock(DEFAULT_PARAMS, wave, [])
    expect(next.combo).toBe(0)
    expect(next.chain).toEqual([card(1, '♣', 9)])
    expect(next.chainOrigin).toEqual(['draw'])
    expect(next.linked).toBe(false)
    expect(next.lastDrawEffect).toBeNull()
  })
```

置き換え対象3「コンボがbaseCombo以下ならシールドがあっても消費せずリセットする(パターン不一致の場合)」を以下に置き換える:

```ts
  test('コンボがbaseCombo以下ならシールドがあっても消費せずリセットする(パターン不一致の場合)', () => {
    const wave = makeWave({ stock: [card(1, '♣', 9)], combo: 0, shieldLeft: 2, chain: [], chainOrigin: [], linked: false })
    const next = drawStock(DEFAULT_PARAMS, wave, [])
    expect(next.shieldLeft).toBe(2)
    expect(next.combo).toBe(0)
    expect(next.chain).toEqual([card(1, '♣', 9)])
    expect(next.chainOrigin).toEqual(['draw'])
  })
```

また、以下3つの既存テストに`chainOrigin`の入力・検証を追加する(既存の内容はそのまま、`chainOrigin`関連の行のみ追加):

「ワイルドがめくれた場合: コンボは変わらずチェーンに追加され、lastDrawEffectはwild」を以下に置き換える:

```ts
  test('ワイルドがめくれた場合: コンボは変わらずチェーンに追加され、lastDrawEffectはwild', () => {
    const wave = makeWave({
      stock: [card(1, '★', 0, true)],
      combo: 3,
      chain: [card(2, '♣', 5)],
      chainOrigin: ['play'],
      linked: true,
    })
    const next = drawStock(DEFAULT_PARAMS, wave, [])
    expect(next.combo).toBe(3)
    expect(next.chain).toEqual([card(2, '♣', 5), card(1, '★', 0, true)])
    expect(next.chainOrigin).toEqual(['play', 'draw'])
    expect(next.linked).toBe(true)
    expect(next.lastDrawEffect).toBe('wild')
  })
```

「シールド発動時: コンボ維持・shieldLeft減少・得点は付かずチェーンに加わり、lastDrawEffectはshield」を以下に置き換える:

```ts
  test('シールド発動時: コンボ維持・shieldLeft減少・得点は付かずチェーンに加わり、lastDrawEffectはshield', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)], // チェーン継続条件を満たさない札にしてシールド発動だけを検証
      combo: 2,
      shieldLeft: 1,
      chain: [card(2, '♥', 5)],
      chainOrigin: ['play'],
      linked: true,
    })
    const next = drawStock(DEFAULT_PARAMS, wave, [])
    expect(next.combo).toBe(2)
    expect(next.shieldLeft).toBe(0)
    expect(next.chain).toEqual([card(2, '♥', 5), card(1, '♣', 9)])
    expect(next.chainOrigin).toEqual(['play', 'draw'])
    expect(next.lastDrawEffect).toBe('shield')
  })
```

「シールドが無くても、パターンに合う札ならアイテム無しで特殊継続しlastDrawEffectはpattern」を以下に置き換える:

```ts
  test('シールドが無くても、パターンに合う札ならアイテム無しで特殊継続しlastDrawEffectはpattern', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 9)], // 同スート継続
      combo: 2,
      shieldLeft: 0,
      chain: [card(2, '♠', 5)],
      chainOrigin: ['play'],
      linked: true,
    })
    const next = drawStock(DEFAULT_PARAMS, wave, [])
    expect(next.combo).toBe(2)
    expect(next.chain).toEqual([card(2, '♠', 5), card(1, '♠', 9)])
    expect(next.chainOrigin).toEqual(['play', 'draw'])
    expect(next.linked).toBe(true)
    expect(next.lastDrawEffect).toBe('pattern')
    expect(next.score).toBe(wave.score) // 得点は付かない
  })
```

Run: `npx vitest run src/lib/game/culmen/engine.test.ts`
Expected: FAIL(`chainOrigin`が追記されない・リセット分岐で`chain`が空のままになる)

- [ ] **Step 2: `playCard`を修正する**

`src/lib/game/culmen/engine.ts`の`playCard`内、`next: WaveState = { ... }`(145行目付近)の`chain: [...wave.chain, card],`の直後に`chainOrigin: [...wave.chainOrigin, 'play'],`を追加する:

```ts
  const next: WaveState = {
    ...wave,
    tableau: newTableau,
    foundation: card,
    combo: newCombo,
    chain: [...wave.chain, card],
    chainOrigin: [...wave.chainOrigin, 'play'],
    linked: true,
    columnsEmptiedThisCombo: newColumnsEmptied,
    lastDrawEffect: null,
    score: newScore,
    lastGain: { points: gained, parts },
    status: 'playing',
    endReason: null,
  }
```

- [ ] **Step 3: `drawStock`を修正する**

`src/lib/game/culmen/engine.ts`の`drawStock`全体(173行目付近)を以下に置き換える:

```ts
export function drawStock(params: CulmenParams, wave: WaveState, items: ItemId[]): WaveState {
  if (wave.status !== 'playing') return wave
  if (wave.stock.length === 0) return wave

  const newStock = [...wave.stock]
  const card = newStock.pop() as Card

  if (card.wild) {
    return {
      ...wave,
      stock: newStock,
      foundation: card,
      chain: [...wave.chain, card],
      chainOrigin: [...wave.chainOrigin, 'draw'],
      linked: true,
      lastDrawEffect: 'wild',
      lastGain: null,
    }
  }

  const baseCombo = items.includes('start1') ? params.items.startCombo : 0
  const canShieldProtect = wave.combo > baseCombo && wave.shieldLeft > 0
  const patternContinues = wave.linked && chainContinuesPattern(params.scoring, wave.chain, card)

  if (canShieldProtect || patternContinues) {
    return {
      ...wave,
      stock: newStock,
      foundation: card,
      shieldLeft: canShieldProtect ? wave.shieldLeft - 1 : wave.shieldLeft,
      chain: [...wave.chain, card],
      chainOrigin: [...wave.chainOrigin, 'draw'],
      linked: true,
      lastDrawEffect: canShieldProtect ? 'shield' : 'pattern',
      lastGain: null,
    }
  }

  return {
    ...wave,
    stock: newStock,
    foundation: card,
    combo: baseCombo,
    chain: [card],
    chainOrigin: ['draw'],
    linked: false,
    columnsEmptiedThisCombo: 0,
    lastDrawEffect: null,
    lastGain: null,
  }
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run src/lib/game/culmen/engine.test.ts`
Expected: PASS(全テスト)

- [ ] **Step 5: 全体テストスイートと型チェックを実行する**

Run: `npm run test`
Expected: 全ファイルPASS

Run: `npm run check`
Expected: culmen関連のエラーなし

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/culmen/engine.ts src/lib/game/culmen/engine.test.ts
git commit -m "feat: CulmenのplayCard・drawStockでchainOriginを追記し、リセット時の捲り札を新しい起点にする"
```

## Context

このタスクで、`wave.chain`は`status: 'playing'`の間ずっと1枚以上を保持し続けるという不変条件が完成する(`startWave`はTask 1で対応済み、`playCard`は常に追記のみ、`drawStock`の全分岐が`chain`を空にしなくなる)。この不変条件はTask 3のUI実装で「チェーンが空の場合」の分岐を削除する根拠になる。

`evaluateChainBonus`・`chainContinuesPattern`・`analyzeSuitColor`・`analyzeStair`・各役判定関数は一切変更しない。これらは`Card[]`を受け取って判定するだけなので、`wave.chain`に何が入っているか(起点の扱いが変わったこと)の影響は自動的に反映される。

**このタスク完了後の重要な確認事項(次のTask 4の受け入れ基準にも記載):** ウェーブ開始直後、場から1枚目をプレイした際、`wave.chain`が`[foundation]`(1枚)になっているため、`evaluateChainBonus`の早期リターン(`chainBefore.length === 0`)が発動しなくなり、foundationとスート/色/階段が一致していれば対応するボーナスが加算されるようになる。これは意図した挙動変更であり、バグではない。

---

### Task 3: チェーン表示の重ね表示化(UI)

**Files:**
- Modify: `src/routes/game/culmen/+page.svelte`

- [ ] **Step 1: 現在のチェーン表示を確認する**

`src/routes/game/culmen/+page.svelte`の`playArea`スニペット内、以下の既存ブロック(249〜262行目付近)を確認する:

```svelte
  <div class="px-4 flex items-center gap-1 overflow-x-auto" style="min-height: 2.6rem;">
    {#each displayWave.chain as c, i (c.id)}
      <div
        class="flex-none rounded border text-center font-black leading-none flex flex-col items-center justify-center"
        style="width:24px; height:34px; font-size:11px; background:{c.wild ? '#EDE4FF' : '#FBF7EC'}; color:{c.wild ? '#6D28D9' : isRed(c) ? '#C7402D' : '#15181D'}; border-color:{c.wild ? '#A78BFA' : '#B8AE98'}; opacity:{!displayWave.linked && i === displayWave.chain.length - 1 ? 0.55 : 1};"
      >
        <div>{rankLabel(c)}</div>
        <div style="font-size:9px;">{c.suit}</div>
      </div>
    {/each}
    {#if displayWave.chain.length === 0}
      <div class="text-emerald-300/50 text-xs">取った札がここに並ぶ → 同スート/同色/階段でボーナス</div>
    {/if}
  </div>
```

- [ ] **Step 2: 重ね表示に置き換える**

上記ブロックを以下に置き換える:

```svelte
  <div class="px-4 overflow-x-auto" style="min-height: 2.6rem;">
    <div class="relative" style="height:40px; width:{24 + (displayWave.chain.length - 1) * 10}px;">
      {#each displayWave.chain as c, i (c.id)}
        {@const isLastUnlinked = !displayWave.linked && i === displayWave.chain.length - 1}
        <div
          class="absolute rounded border text-center font-black leading-none flex flex-col items-center justify-center"
          style="left:{i * 10}px; top:{displayWave.chainOrigin[i] === 'draw' ? 6 : 0}px; z-index:{i + 1}; width:24px; height:34px; font-size:11px; background:{c.wild ? '#EDE4FF' : '#FBF7EC'}; color:{c.wild ? '#6D28D9' : isRed(c) ? '#C7402D' : '#15181D'}; border-color:{c.wild ? '#A78BFA' : '#B8AE98'}; opacity:{isLastUnlinked ? 0.55 : 1}; box-shadow:1px 0 3px rgba(0,0,0,.35);"
        >
          <div>{rankLabel(c)}</div>
          <div style="font-size:9px;">{c.suit}</div>
        </div>
      {/each}
    </div>
  </div>
```

「取った札がここに並ぶ→…」のプレースホルダー分岐は完全に削除する(Task 2完了時点で`wave.chain`が空になることは無くなったため、この分岐は到達不能になる)。

- [ ] **Step 3: Lintと型チェックを実行する**

Run: `npx eslint src/routes/game/culmen/`
Expected: エラーなし

Run: `npm run check`
Expected: culmen関連のエラーなし

- [ ] **Step 4: 全体テストスイートを実行する**

Run: `npm run test`
Expected: 全ファイルPASS

- [ ] **Step 5: 開発サーバーで動作確認する**

Run: `npm run dev`(既に起動中でなければ)

ブラウザで`/game/culmen`を開き、以下を確認する:
- ウェーブ開始直後、チェーン表示エリアに最初の場札(foundation)が1枚、基準線(下がった位置)に薄く(半透明で)表示されている
- 場から1枚プレイすると、その札がチェーンに追加され、少し上にずれた位置・不透明で表示される(直前の1枚がプレイと繋がったため`linked`がtrueになり、薄い表示が解除される)
- さらに場からプレイを続けると、各札が10pxずつ右にずれて重なって表示される
- 山札を捲ってパターン継続した場合、その捲った札は基準線(下がった位置)に表示される
- 山札を捲ってコンボがリセットされた場合、直前までの札が消え、新しく捲った1枚だけが基準線に薄く表示される
- コンソールエラーが出ていない

- [ ] **Step 6: コミット**

```bash
git add src/routes/game/culmen/+page.svelte
git commit -m "feat: Culmenのチェーン表示を山札由来・場由来で縦位置を変えた重ね表示に変更"
```

---

### Task 4: 最終検証

**Files:** なし(検証のみ)

- [ ] **Step 1: 全テストを実行する**

Run: `npm run test`
Expected: 全ファイルPASS

- [ ] **Step 2: 型チェック・Lintを実行する**

Run: `npm run check && npx eslint src/lib/game/culmen/ src/routes/game/culmen/`
Expected: culmen関連のエラーなし

- [ ] **Step 3: 本番ビルドを実行する**

Run: `npm run build`
Expected: ビルド成功

- [ ] **Step 4: 開発サーバーで受け入れ基準を一通り確認する**

Run: `npm run dev`

`docs/superpowers/specs/2026-07-08-culmen-chain-display-redesign-design.md`の「6. 受け入れ基準」を上から順に確認する:
1. ウェーブ開始直後、`wave.chain`が`[foundation]`(1枚)、`wave.chainOrigin`が`['draw']`になっている(Task 1のテストで検証済み。開発者ツールのコンソールで`document.querySelector`等を使わず、DebugPanel(開発時のみ表示)の「内部状態」セクションで`chain`の中身を目視確認してもよい)
2. ウェーブ開始直後、場から1枚目をプレイした際、foundationとスート/色/階段が一致していればボーナスが加算される(実際にプレイして内訳表示を確認)
3. まだ場から1枚もプレイしていない状態で山札を捲った場合、必ずリセット扱いになる(実際に試して確認)
4. コンボが途切れて山札をリセット扱いで捲った場合、`wave.chain`がその捲った札1枚だけになる(表示上、直前までの札が消えて1枚だけ表示されることで確認)
5. チェーン表示が全カード1本の重なりとして表示され、山札由来は基準線・場からプレイした札は少し上にずれる
6. 表示上、区切り線やグループ分けが無く、連続した重なりとして見える
7. `npm run test`・`npm run build`が成功する(Step 1・3で確認済み)

- [ ] **Step 5: 最終コミット(検証中に見つかった不具合を修正した場合のみ)**

```bash
git add -A
git commit -m "fix: チェーン重ね表示の最終検証で見つかった不具合を修正"
```

---

## 自己レビュー結果

- **スペック網羅性**: 2節(データモデル)→Task 1、3節(エンジン変更・スコア影響)→Task 1・2、3.5節(chainが空にならない不変条件)→Task 2のContext、4節(表示変更)→Task 3、5節(テストへの影響)→Task 1・2、6節(受け入れ基準)→Task 4、で対応済み。
- **プレースホルダー**: なし。全タスクに実コードを記載。
- **型・関数名の一貫性**: `ChainCardOrigin`(Task 1)→`WaveState.chainOrigin`(Task 1)→`playCard`/`drawStock`での追記(Task 2)→`+page.svelte`での`chainOrigin[i]`参照(Task 3)まで、フィールド名・型が一貫していることを確認済み。`makeWave`ヘルパーの`chainOrigin: []`デフォルトも、Task 1で追加した時点でTask 2以降のテストがそのまま利用できることを確認済み。
