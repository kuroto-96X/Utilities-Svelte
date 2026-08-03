# 白銀・果断・星霜 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 未実装だった最後の護符3個(白銀・果断・星霜)を実装し、`shidasu-gofu-candidates.md`の護符候補100個すべての実装を完了させる。

**Architecture:** 白銀はUI表示専用の変更(`CardFace.svelte`)+単純な倍算効果。果断・星霜は既存の献身・勤勉・加護と同じ「WaveStateに正本カウンタを持ちstartWave/resolveWaveEndで同期する」パターンで実装するが、トリガーが役成立ではなく秘儀/天啓/神託の使用イベント(`useRite`・`useRevelation`・`useOracle`)である点が異なる。

**Tech Stack:** SvelteKit, Svelte 5 runes, TypeScript, Vitest

---

### Task 1: 白銀の護符データとカード表示の非表示化を実装する

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`(`ItemId`に追加)
- Modify: `src/lib/game/shidasu/params.ts`(型・DEFAULT_PARAMSに追加)
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Modify: `src/lib/game/shidasu/itemGroups.ts`
- Modify: `src/lib/game/shidasu/items.ts`
- Modify: `src/lib/game/shidasu/itemActualEffects.ts`
- Modify: `src/lib/game/shidasu/cardComboEffects.ts`(倍算効果)
- Modify: `src/routes/game/shidasu/CardFace.svelte`(表示非表示化)
- Modify: `src/routes/game/shidasu/PlayArea.svelte`(itemsをCardFaceへ配線)
- Test: `src/lib/game/shidasu/cardComboEffects.test.ts`

- [ ] **Step 1: types.tsにItemIdを追加する**

`src/lib/game/shidasu/types.ts`の`ItemId`型の末尾(`| 'vow' | 'pact' | 'crimson' | 'jetBlack'`の行)に、以下を追記する。

変更前:
```ts
  | 'vow' | 'pact' | 'crimson' | 'jetBlack'
```

変更後:
```ts
  | 'vow' | 'pact' | 'crimson' | 'jetBlack'
  | 'silver'
```

- [ ] **Step 2: params.tsのShidasuParams型に追加する**

`src/lib/game/shidasu/params.ts`の`talismans`型定義、`jetBlack: { name: string; rarity: Rarity; desc: string }`の行の直後に以下を追加する。

```ts
    silver: { name: string; x: number; rarity: Rarity; desc: string }
```

- [ ] **Step 3: params.tsのDEFAULT_PARAMSに追加する**

`src/lib/game/shidasu/params.ts`の`DEFAULT_PARAMS.talismans`、`jetBlack: { name: '漆黒', ... }`の行の直後に以下を追加する。

```ts
    silver: { name: '白銀', x: 1.5, rarity: 'U', desc: '全ての札の色とスートが非表示になるが、x倍算(点数計算やコンボ継続の判定には引き続き色とスートが使われる)' },
```

- [ ] **Step 4: shidasu.config.jsonに追加する**

`src/lib/game/shidasu/shidasu.config.json`の`talismans`オブジェクト内、`jetBlack`エントリの直後に以下を追加する。

```json
    "silver": { "name": "白銀", "x": 1.5, "rarity": "U", "desc": "全ての札の色とスートが非表示になるが、x倍算(点数計算やコンボ継続の判定には引き続き色とスートが使われる)" },
```

- [ ] **Step 5: itemGroups.tsのグループ19に追加する**

`src/lib/game/shidasu/itemGroups.ts`のグループ19の行を以下のように変更する。

変更前:
```ts
  { label: 'グループ19: デメリット付き倍算・色拡張イネーブラー', ids: ['vow', 'pact', 'crimson', 'jetBlack'] },
```

変更後:
```ts
  { label: 'グループ19: デメリット付き倍算・色拡張イネーブラー', ids: ['vow', 'pact', 'crimson', 'jetBlack', 'silver'] },
```

- [ ] **Step 6: items.tsのITEM_POOLに追加する**

`src/lib/game/shidasu/items.ts`の`ITEM_POOL`配列、`'vow', 'pact', 'crimson', 'jetBlack',`の行の直後に以下を追加する。

```ts
  'silver',
```

- [ ] **Step 7: 失敗するテストを書く**

`src/lib/game/shidasu/cardComboEffects.test.ts`の末尾(`pact`のテストの直後)に、以下を追加する。

```ts
  test('silver: 常にx倍算される', () => {
    const result = applyItemEffects('gained', 100, ['silver'], ctx(), params)
    expect(result.value).toBe(100 * params.talismans.silver.x)
  })
```

- [ ] **Step 8: テストを実行して失敗を確認する**

Run: `npx vitest run src/lib/game/shidasu/cardComboEffects.test.ts`
Expected: FAIL(`silver`が`ITEM_EFFECTS`に登録されておらず倍算が発生しない)

- [ ] **Step 9: cardComboEffects.tsに白銀の倍算効果を追加する**

`src/lib/game/shidasu/cardComboEffects.ts`の`CARD_COMBO_EFFECTS`オブジェクト末尾(`pact`エントリの直後)に以下を追加する。

```ts
  silver: {
    channel: 'gained',
    effect: (v, _ctx, p) => {
      const factor = p.talismans.silver.x
      return { value: v * factor, part: multiplyPart('白銀', factor) }
    },
  },
```

- [ ] **Step 10: テストを実行して成功を確認する**

Run: `npx vitest run src/lib/game/shidasu/cardComboEffects.test.ts`
Expected: PASS(全件)

- [ ] **Step 11: itemActualEffects.tsに説明文を追加する**

`src/lib/game/shidasu/itemActualEffects.ts`の`jetBlack`エントリの直後に以下を追加する。

```ts
  silver: '獲得点に常にx倍算する。CardFace.svelte側でスート記号非表示・色をグレー統一する表示変更と対になる(スコア計算・isPlayable・コンボ継続判定には一切影響しない)',
```

- [ ] **Step 12: items.test.tsのアイテム総数を更新する**

`src/lib/game/shidasu/items.test.ts`の「96種類のアイテムが定義されている」テストを、以下のように97に更新する。

変更前:
```ts
  test('96種類のアイテムが定義されている', () => {
    expect(ITEM_POOL).toHaveLength(96)
    expect(new Set(ITEM_POOL).size).toBe(96) // 重複なし
    ITEM_POOL.forEach(id => expect(itemName(id, DEFAULT_PARAMS)).toBeTruthy())
  })
```

変更後:
```ts
  test('97種類のアイテムが定義されている', () => {
    expect(ITEM_POOL).toHaveLength(97)
    expect(new Set(ITEM_POOL).size).toBe(97) // 重複なし
    ITEM_POOL.forEach(id => expect(itemName(id, DEFAULT_PARAMS)).toBeTruthy())
  })
```

- [ ] **Step 13: CardFace.svelteに白銀の表示非表示化を実装する**

`src/routes/game/shidasu/CardFace.svelte`の現在の実装を確認する。

```svelte
<script lang="ts">
  import { rankLabel } from '$lib/game/shidasu/engine'
  import { isRed } from '$lib/game/shidasu/patterns'
  import type { Card } from '$lib/game/shidasu/types'

  let { card, covered }: { card: Card; covered: boolean } = $props()
```

これを以下のように変更する。

```svelte
<script lang="ts">
  import { rankLabel } from '$lib/game/shidasu/engine'
  import { isRed } from '$lib/game/shidasu/patterns'
  import type { Card, ItemId } from '$lib/game/shidasu/types'

  let { card, covered, items = [] }: { card: Card; covered: boolean; items?: ItemId[] } = $props()

  let hideColorAndSuit = $derived(items.includes('silver'))
```

`{:else}`ブロック(非ワイルド札の描画)内、以下の行を変更する。

変更前:
```svelte
{:else}
  {@const colorClass = isRed(card) ? 'text-red-600' : 'text-slate-900'}
```

変更後:
```svelte
{:else}
  {@const colorClass = hideColorAndSuit ? 'text-slate-900' : (isRed(card) ? 'text-red-600' : 'text-slate-900')}
```

スート記号を表示している3箇所(ランク・スート表記の`<span class="text-xs leading-none">{card.suit}</span>`が2箇所、ピップ描画内の`{card.suit}`が1箇所)を、白銀所持時は非表示にする。具体的には、ファイル内の以下3箇所を変更する。

1つ目(46-49行目付近、上部のランク・スート表記):
変更前:
```svelte
    <div class="flex items-center gap-0.5 leading-none {colorClass}">
      <span class="text-sm font-bold leading-none">{rankLabel(card)}</span>
      <span class="text-xs leading-none">{card.suit}</span>
    </div>
```

変更後:
```svelte
    <div class="flex items-center gap-0.5 leading-none {colorClass}">
      <span class="text-sm font-bold leading-none">{rankLabel(card)}</span>
      {#if !hideColorAndSuit}
        <span class="text-xs leading-none">{card.suit}</span>
      {/if}
    </div>
```

2つ目(ピップ描画内、53-58行目付近):
変更前:
```svelte
      {#if card.rank <= 10}
        <div class="w-full flex-1 relative {colorClass}">
          {#each (PIP_LAYOUTS[card.rank] ?? []) as [x, y, rot], i (i)}
            <span
              class="absolute leading-none select-none"
              style="left:{x}%; top:{y}%; transform:translate(-50%,-50%){rot ? ' rotate(180deg)' : ''}; font-size:{card.rank === 1 ? 18 : card.rank <= 4 ? 11 : card.rank <= 7 ? 10 : 9}px;"
            >{card.suit}</span>
          {/each}
        </div>
```

変更後:
```svelte
      {#if card.rank <= 10}
        <div class="w-full flex-1 relative {colorClass}">
          {#if !hideColorAndSuit}
            {#each (PIP_LAYOUTS[card.rank] ?? []) as [x, y, rot], i (i)}
              <span
                class="absolute leading-none select-none"
                style="left:{x}%; top:{y}%; transform:translate(-50%,-50%){rot ? ' rotate(180deg)' : ''}; font-size:{card.rank === 1 ? 18 : card.rank <= 4 ? 11 : card.rank <= 7 ? 10 : 9}px;"
              >{card.suit}</span>
            {/each}
          {/if}
        </div>
```

3つ目(下部の回転済みランク・スート表記、65-68行目付近):
変更前:
```svelte
      <div class="rotate-180 self-end flex items-center gap-0.5 leading-none {colorClass}">
        <span class="text-sm font-bold leading-none">{rankLabel(card)}</span>
        <span class="text-xs leading-none">{card.suit}</span>
      </div>
```

変更後:
```svelte
      <div class="rotate-180 self-end flex items-center gap-0.5 leading-none {colorClass}">
        <span class="text-sm font-bold leading-none">{rankLabel(card)}</span>
        {#if !hideColorAndSuit}
          <span class="text-xs leading-none">{card.suit}</span>
        {/if}
      </div>
```

実装者は実際のファイルを開いて該当箇所を正確に特定し、上記の変更を適用すること(行番号はズレている可能性がある)。

- [ ] **Step 14: PlayArea.svelteからCardFaceにitemsを渡す**

`src/routes/game/shidasu/PlayArea.svelte`は既にトップレベルpropsとして`items: ItemId[]`を受け取っている。`<CardFace`の呼び出しは以下10箇所ある(`grep -n "<CardFace" src/routes/game/shidasu/PlayArea.svelte`で確認済み)。それぞれに`{items}`(Svelteのプロパティ名一致の省略記法)を追加する。

```
908:                <CardFace {card} covered={false} />
911:              <CardFace {card} covered={false} />
952:        <CardFace card={displayedDiscardTop} covered={false} />
962:      <CardFace card={nextCard} covered={false} />
977:              <CardFace card={entry.card} covered={false} />
1025:    <CardFace card={playingAnimation.card} covered={false} />
1050:        <CardFace card={gatherCard.card} covered={false} />
1058:      <CardFace card={cleanupAnimation.card} covered={false} />
1069:      <CardFace card={gatherCard.card} covered={false} />
1079:    <CardFace card={dealingCard.card} covered={false} />
```

例えば908行目は以下のように変更する。

変更前:
```svelte
                <CardFace {card} covered={false} />
```

変更後:
```svelte
                <CardFace {card} covered={false} {items} />
```

同様のパターンで残り9箇所すべてに`{items}`を追加する。実装後、`grep -c "{items}" src/routes/game/shidasu/PlayArea.svelte`で10箇所すべてに追加されたことを確認すること(既存の`{items}`参照が他にもある場合はその分も含まれるため、単純な件数一致では確認できない点に注意し、実際に10箇所の`<CardFace`呼び出しすべてに追加されているか目視で確認すること)。

- [ ] **Step 15: 全体テスト・型チェックを実行する**

Run: `npx vitest run`
Expected: 全件PASS

Run: `npm run check`
Expected: shidasu関連のエラー0件(他ツールの既存エラーは無関係のため無視してよい)

Run: `npm run build`
Expected: ビルド成功

- [ ] **Step 16: Commit**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/itemGroups.ts src/lib/game/shidasu/items.ts src/lib/game/shidasu/itemActualEffects.ts src/lib/game/shidasu/cardComboEffects.ts src/lib/game/shidasu/cardComboEffects.test.ts src/lib/game/shidasu/items.test.ts src/routes/game/shidasu/CardFace.svelte src/routes/game/shidasu/PlayArea.svelte
git commit -m "feat: 白銀の護符データと表示非表示化・倍算効果を実装"
```

---

### Task 2: 果断・星霜の共通基盤(WaveState/RunStateへのカウンタ追加)を実装する

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`(`ItemId`・`WaveState`・`RunState`に追加)
- Modify: `src/lib/game/shidasu/params.ts`(型・DEFAULT_PARAMSに追加)
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Modify: `src/lib/game/shidasu/itemGroups.ts`
- Modify: `src/lib/game/shidasu/items.ts`
- Modify: `src/lib/game/shidasu/itemActualEffects.ts`
- Modify: `src/lib/game/shidasu/engine.ts`(`startWave`・`createInitialRun`・`beginRun`・`resolveWaveEnd`にカウンタの初期化・同期・書き戻しを追加)
- Test: `src/lib/game/shidasu/engine.test.ts`

このタスクでは、果断・星霜の型・データ定義とWaveState/RunState間の同期基盤のみを作る。秘儀/天啓/神託使用イベントでの実際の加算ロジック、およびgained計算への反映はTask 3・4で行う。

- [ ] **Step 1: types.tsにItemIdを2種追加する**

`src/lib/game/shidasu/types.ts`のTask 1 Step 1で追加した行の直後に以下を追加する。

変更前:
```ts
  | 'silver'
```

変更後:
```ts
  | 'silver'
  | 'discretion' | 'frost'
```

「果断」の英語IDは`discretion`、「星霜」の英語IDは`frost`とする。

- [ ] **Step 2: WaveStateに累積カウンタ2個を追加する**

`src/lib/game/shidasu/types.ts`の`WaveState`インターフェース、`divineProtectionX: number`の行の直後に以下を追加する。

```ts
  // 果断・星霜用: 天啓・神託・秘儀を使用するたび永続的に加算/加算される値。
  // ラン全体で永続する値だが、playingフェーズ中の使用イベント内でのみ更新されるため
  // WaveState側に正本を持ち、startWaveでRunStateからコピー・resolveWaveEndでRunStateへ書き戻す。
  discretionN: number
  frostX: number
```

- [ ] **Step 3: RunStateに永続カウンタ2個を追加する**

`src/lib/game/shidasu/types.ts`の`RunState`インターフェース、`divineProtectionX: number`の行(献身・勤勉・加護の永続値の並び)の直後に以下を追加する。

```ts
  // 果断・星霜の累積値の永続値。WaveState側のdiscretionN/frostXの正本。
  // beginRunで初期化され(discretionN=10, frostX=1)、resolveWaveEnd成功時にwaveの値で更新される。
  discretionN: number
  frostX: number
```

- [ ] **Step 4: params.tsのShidasuParams型に2種を追加する**

`src/lib/game/shidasu/params.ts`の`talismans`型定義、Task 1 Step 2で追加した`silver`の行の直後に以下を追加する。

```ts
    discretion: { name: string; n: number; rarity: Rarity; desc: string }
    frost: { name: string; x: number; rarity: Rarity; desc: string }
```

- [ ] **Step 5: params.tsのDEFAULT_PARAMSに2種の実データを追加する**

`src/lib/game/shidasu/params.ts`の`DEFAULT_PARAMS.talismans`、Task 1 Step 3で追加した`silver`の行の直後に以下を追加する。

```ts
    discretion: { name: '果断', n: 10, rarity: 'C', desc: 'n点加算。nは{n}から開始し、この護符を所持してから天啓・神託・秘儀を使用するたびn+={n}される' },
    frost: { name: '星霜', x: 0.01, rarity: 'R', desc: 'x倍算。xは1から開始し、この護符を所持してから天啓・神託・秘儀を使用するたびx+={x}される' },
```

- [ ] **Step 6: shidasu.config.jsonに2種の実データを追加する**

`src/lib/game/shidasu/shidasu.config.json`の`talismans`オブジェクト内、Task 1 Step 4で追加した`silver`エントリの直後に以下を追加する。

```json
    "discretion": { "name": "果断", "n": 10, "rarity": "C", "desc": "n点加算。nは{n}から開始し、この護符を所持してから天啓・神託・秘儀を使用するたびn+={n}される" },
    "frost": { "name": "星霜", "x": 0.01, "rarity": "R", "desc": "x倍算。xは1から開始し、この護符を所持してから天啓・神託・秘儀を使用するたびx+={x}される" },
```

- [ ] **Step 7: itemGroups.tsに新規グループを追加する**

`src/lib/game/shidasu/itemGroups.ts`の末尾(グループ19の行の直後)に以下を追加する。

```ts
  { label: 'グループ22: 他カテゴリ依存', ids: ['discretion', 'frost'] },
```

- [ ] **Step 8: items.tsのITEM_POOLに2種を追加する**

`src/lib/game/shidasu/items.ts`の`ITEM_POOL`配列、Task 1 Step 6で追加した`'silver',`の行の直後に以下を追加する。

```ts
  'discretion', 'frost',
```

- [ ] **Step 9: startWaveでdiscretionN・frostXをRunStateからWaveStateへコピーする**

`src/lib/game/shidasu/engine.ts`の`startWave`関数シグネチャに、以下の2引数を追加する。

変更前:
```ts
export function startWave(
  params: ShidasuParams,
  _stageIndex: number,
  _waveIndex: number,
  items: ItemId[],
  deckComposition: DeckCard[],
  seed?: number,
  extraTableauRows: number = 0,
  oracleLevels: Record<RoleName, number> = defaultOracleLevels(),
  dedicationX: number = 1,
  diligenceX: number = 1,
  divineProtectionX: number = 1
): { wave: WaveState; deckComposition: DeckCard[] } {
```

変更後:
```ts
export function startWave(
  params: ShidasuParams,
  _stageIndex: number,
  _waveIndex: number,
  items: ItemId[],
  deckComposition: DeckCard[],
  seed?: number,
  extraTableauRows: number = 0,
  oracleLevels: Record<RoleName, number> = defaultOracleLevels(),
  dedicationX: number = 1,
  diligenceX: number = 1,
  divineProtectionX: number = 1,
  discretionN: number = 10,
  frostX: number = 1
): { wave: WaveState; deckComposition: DeckCard[] } {
```

同関数内、`WaveState`オブジェクトリテラル、`divineProtectionX,`の行の直後に以下を追加する。

```ts
    discretionN,
    frostX,
```

- [ ] **Step 10: startWaveの呼び出し元2箇所を更新する**

`src/lib/game/shidasu/engine.ts`内、`startWave(params, ...)`の呼び出し2箇所に`run.discretionN, run.frostX`を追加する。

変更前(1箇所目):
```ts
  const { wave } = startWave(params, 0, 0, run.items, run.deckComposition, seed, run.extraTableauRows, run.oracleLevels, run.dedicationX, run.diligenceX, run.divineProtectionX)
```

変更後:
```ts
  const { wave } = startWave(params, 0, 0, run.items, run.deckComposition, seed, run.extraTableauRows, run.oracleLevels, run.dedicationX, run.diligenceX, run.divineProtectionX, run.discretionN, run.frostX)
```

変更前(2箇所目):
```ts
  const { wave, deckComposition } = startWave(params, run.stageIndex, run.waveIndex, run.items, run.deckComposition, seed, run.extraTableauRows, run.oracleLevels, run.dedicationX, run.diligenceX, run.divineProtectionX)
```

変更後:
```ts
  const { wave, deckComposition } = startWave(params, run.stageIndex, run.waveIndex, run.items, run.deckComposition, seed, run.extraTableauRows, run.oracleLevels, run.dedicationX, run.diligenceX, run.divineProtectionX, run.discretionN, run.frostX)
```

- [ ] **Step 11: createInitialRunとbeginRunにdiscretionN・frostXの初期値を追加する**

`src/lib/game/shidasu/engine.ts`の`createInitialRun`関数、`dedicationX: 1, diligenceX: 1, divineProtectionX: 1,`の行を以下のように変更する。

変更前:
```ts
    dedicationX: 1, diligenceX: 1, divineProtectionX: 1,
```

変更後:
```ts
    dedicationX: 1, diligenceX: 1, divineProtectionX: 1,
    discretionN: 10, frostX: 1,
```

`beginRun`関数、`divineProtectionX: 1,`の行の直後に以下を追加する。

```ts
    discretionN: 10,
    frostX: 1,
```

- [ ] **Step 12: resolveWaveEndでdiscretionN・frostXをWaveStateからRunStateへ書き戻す**

`src/lib/game/shidasu/engine.ts`の`resolveWaveEnd`関数、`divineProtectionX: wave.divineProtectionX,`の行の直後に以下を追加する。

```ts
    discretionN: wave.discretionN,
    frostX: wave.frostX,
```

- [ ] **Step 13: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`で`startWave`が既にimportされていることを確認する。既存の`剛毅`のdescribeブロックの直後に、以下を追加する。

```ts
describe('果断・星霜の基盤(startWave/resolveWaveEndでの同期)', () => {
  test('startWaveのdiscretionN・frostXのデフォルト値はそれぞれ10・1', () => {
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1)
    expect(wave.discretionN).toBe(10)
    expect(wave.frostX).toBe(1)
  })

  test('startWaveに渡した値がそのままwaveに反映される', () => {
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels(), 1, 1, 1, 30, 1.05)
    expect(wave.discretionN).toBe(30)
    expect(wave.frostX).toBe(1.05)
  })
})
```

`defaultOracleLevels`が`engine.test.ts`内で既にimportされているか確認し、なければimport文に追加すること(`$lib/game/shidasu/oracles`からexportされている)。

- [ ] **Step 14: テストを実行して失敗を確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "果断・星霜の基盤"`
Expected: FAIL(`startWave`が引数を受け付けず`wave.discretionN`が`undefined`になる)

- [ ] **Step 15: テストを実行して成功を確認する**

Step 9〜12の実装が完了していれば、このテストは自動的にPASSするはずである。

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "果断・星霜の基盤"`
Expected: PASS(2件とも)

- [ ] **Step 16: 全体テスト・型チェックを実行する**

Run: `npx vitest run`
Expected: 全件PASS

Run: `npm run check`
Expected: shidasu関連のエラー0件(`discretion`/`frost`所持時のitemActualEffects説明文が無いことに起因するエラーは、Task 3・4で解消予定)

- [ ] **Step 17: Commit**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/itemGroups.ts src/lib/game/shidasu/items.ts src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 果断・星霜の基盤(WaveState/RunStateのカウンタ同期)を実装"
```

---

### Task 3: 果断・星霜の秘儀/天啓/神託使用イベントへのフックを実装する

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`(`useRite`・`useRevelation`・`useOracle`)
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`のTask 2で追加したdescribeブロックの直後に、以下を追加する。`createInitialRun()`と`startWave(...).wave`を組み合わせて`playing`フェーズの`RunState`を作る、既存の`useRite`/`useOracle`テスト(`describe('useRite', ...)`・`describe('useOracle(所持神託の消費、playingフェーズ限定)', ...)`)と同じパターンを使う。

```ts
describe('果断・星霜: 秘儀/天啓/神託使用でdiscretionN・frostXが加算される', () => {
  test('秘儀使用後、discretionNが10から20になる(果断所持時)', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, ['discretion'], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, items: ['discretion'], rites: ['raidho'] }
    const next = useRite(DEFAULT_PARAMS, run, 'raidho', createRng(1))
    expect(next.wave!.discretionN).toBe(20)
  })

  test('果断を所持していなければdiscretionNは変化しない', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, items: [], rites: ['raidho'] }
    const next = useRite(DEFAULT_PARAMS, run, 'raidho', createRng(1))
    expect(next.wave!.discretionN).toBe(10)
  })

  test('秘儀使用後、frostXが1から1.01になる(星霜所持時)', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, ['frost'], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, items: ['frost'], rites: ['raidho'] }
    const next = useRite(DEFAULT_PARAMS, run, 'raidho', createRng(1))
    expect(next.wave!.frostX).toBeCloseTo(1.01)
  })

  test('神託使用後、discretionN・frostXが両方加算される(果断・星霜を両方所持)', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, ['discretion', 'frost'], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, items: ['discretion', 'frost'], oracles: ['flush'] }
    const next = useOracle(DEFAULT_PARAMS, run, 'flush')
    expect(next.wave!.discretionN).toBe(20)
    expect(next.wave!.frostX).toBeCloseTo(1.01)
  })

  test('天啓使用後、discretionN・frostXが加算される(果断・星霜を所持)', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, ['discretion', 'frost'], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, items: ['discretion', 'frost'], revelations: ['shin'] }
    const next = useRevelation(DEFAULT_PARAMS, run, 'shin', null, createRng(1))
    expect(next.wave!.discretionN).toBe(20)
    expect(next.wave!.frostX).toBeCloseTo(1.01)
  })
})
```

`shin`天啓は`revelationNeedsTarget`(`revelationEffects.ts`)の対象外(列選択不要、`targetCol`は`null`でよい)かつ`canUseRevelation`が常に`true`を返すため、条件判定を気にせず使えるテスト用天啓として選んだ。

`useOracle`の第4テストは、Step 5で`useOracle`のシグネチャに`params`を追加した後の呼び出し形(`useOracle(DEFAULT_PARAMS, run, 'flush')`)で書いてある。Step 5を実装するまではこのテストは型エラーになる想定通りの状態である(TDDの一環としてこのまま進めてよい)。

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "果断・星霜: 秘儀"`
Expected: FAIL(`discretionN`/`frostX`が加算されず、初期値のままになる)

- [ ] **Step 3: useRiteにdiscretion・frostの加算ロジックを実装する**

`src/lib/game/shidasu/engine.ts`の`useRite`関数を以下のように変更する。

変更前:
```ts
export function useRite(params: ShidasuParams, run: RunState, riteId: RiteId, rand: () => number = Math.random): RunState {
  if ((run.phase !== 'playing' && !SHOP_FLOW_PHASES.includes(run.phase)) || !run.wave || run.wave.status !== 'playing') return run
  if (!canUseRite(params, run.wave, riteId)) return run
  const idx = run.rites.indexOf(riteId)
  if (idx === -1) return run
  const wave = applyRiteEffect(params, run.wave, riteId, rand, run.items)
  const rites = [...run.rites.slice(0, idx), ...run.rites.slice(idx + 1)]
  return { ...run, wave, rites }
}
```

変更後:
```ts
export function useRite(params: ShidasuParams, run: RunState, riteId: RiteId, rand: () => number = Math.random): RunState {
  if ((run.phase !== 'playing' && !SHOP_FLOW_PHASES.includes(run.phase)) || !run.wave || run.wave.status !== 'playing') return run
  if (!canUseRite(params, run.wave, riteId)) return run
  const idx = run.rites.indexOf(riteId)
  if (idx === -1) return run
  let wave = applyRiteEffect(params, run.wave, riteId, rand, run.items)
  // 果断・星霜: 天啓・神託・秘儀のいずれかを使用するたび永続的に加算する
  if (run.items.includes('discretion')) wave = { ...wave, discretionN: wave.discretionN + params.talismans.discretion.n }
  if (run.items.includes('frost')) wave = { ...wave, frostX: wave.frostX + params.talismans.frost.x }
  const rites = [...run.rites.slice(0, idx), ...run.rites.slice(idx + 1)]
  return { ...run, wave, rites }
}
```

- [ ] **Step 4: useRevelationにdiscretion・frostの加算ロジックを実装する**

`src/lib/game/shidasu/engine.ts`の`useRevelation`関数を以下のように変更する。

変更前:
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
  if (!canUseRevelation(params, run.wave, revelationId)) return run
  const { wave, deckComposition } = applyRevelationEffect(params, run.wave, run.deckComposition, revelationId, targetCol, rand)
  const extraTableauRows = revelationId === 'kyo' ? run.extraTableauRows + params.revelations.kyo.n : run.extraTableauRows
  const revelations = [...run.revelations.slice(0, idx), ...run.revelations.slice(idx + 1)]
  return { ...run, wave, deckComposition, revelations, extraTableauRows }
}
```

変更後:
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
  if (!canUseRevelation(params, run.wave, revelationId)) return run
  let { wave, deckComposition } = applyRevelationEffect(params, run.wave, run.deckComposition, revelationId, targetCol, rand)
  // 果断・星霜: 天啓・神託・秘儀のいずれかを使用するたび永続的に加算する
  if (run.items.includes('discretion')) wave = { ...wave, discretionN: wave.discretionN + params.talismans.discretion.n }
  if (run.items.includes('frost')) wave = { ...wave, frostX: wave.frostX + params.talismans.frost.x }
  const extraTableauRows = revelationId === 'kyo' ? run.extraTableauRows + params.revelations.kyo.n : run.extraTableauRows
  const revelations = [...run.revelations.slice(0, idx), ...run.revelations.slice(idx + 1)]
  return { ...run, wave, deckComposition, revelations, extraTableauRows }
}
```

- [ ] **Step 5: useOracleにparams引数を追加し、discretion・frostの加算ロジックを実装する**

`useOracle`は現在`params: ShidasuParams`を引数に取っていないため、`params.talismans.discretion.n`のような値を参照できるようシグネチャに追加する。`src/lib/game/shidasu/engine.ts`の`useOracle`関数を以下のように変更する。

変更前:
```ts
export function useOracle(run: RunState, roleName: RoleName): RunState {
  if (run.phase !== 'playing') return run
  const idx = run.oracles.indexOf(roleName)
  if (idx === -1) return run
  const oracles = [...run.oracles.slice(0, idx), ...run.oracles.slice(idx + 1)]
  const oracleLevels = { ...run.oracleLevels, [roleName]: run.oracleLevels[roleName] + 1 }
  const wave = run.wave ? { ...run.wave, oracleLevels } : run.wave
  return { ...run, oracles, oracleLevels, wave }
}
```

変更後:
```ts
export function useOracle(params: ShidasuParams, run: RunState, roleName: RoleName): RunState {
  if (run.phase !== 'playing') return run
  const idx = run.oracles.indexOf(roleName)
  if (idx === -1) return run
  const oracles = [...run.oracles.slice(0, idx), ...run.oracles.slice(idx + 1)]
  const oracleLevels = { ...run.oracleLevels, [roleName]: run.oracleLevels[roleName] + 1 }
  let wave = run.wave ? { ...run.wave, oracleLevels } : run.wave
  // 果断・星霜: 天啓・神託・秘儀のいずれかを使用するたび永続的に加算する
  if (wave) {
    if (run.items.includes('discretion')) wave = { ...wave, discretionN: wave.discretionN + params.talismans.discretion.n }
    if (run.items.includes('frost')) wave = { ...wave, frostX: wave.frostX + params.talismans.frost.x }
  }
  return { ...run, oracles, oracleLevels, wave }
}
```

`useOracle`の呼び出し元は以下の3箇所(`grep -rn "useOracle(" src/`で確認済み)。それぞれ第1引数に`params`を渡すよう更新する。

1. `src/routes/game/shidasu/+page.svelte:324`付近、`run = useOracle(run, roleName)`を`run = useOracle(params, run, roleName)`に変更する(このファイルには既に`params`という変数がスコープ内に存在する)。
2. `src/lib/game/shidasu/engine.test.ts`の`describe('useOracle(所持神託の消費、playingフェーズ限定)', ...)`ブロック内、`useOracle(run, 'flush')`という呼び出しが3箇所ある。すべて`useOracle(DEFAULT_PARAMS, run, 'flush')`に変更する。

- [ ] **Step 6: テストを実行して成功を確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "果断・星霜: 秘儀"`
Expected: PASS(4件とも)

- [ ] **Step 7: 全体テスト・型チェックを実行する**

Run: `npx vitest run`
Expected: 全件PASS(`useOracle`のシグネチャ変更に伴い、既存の`useOracle`呼び出しテストが型エラーになっている場合は全て修正すること)

Run: `npm run check`
Expected: shidasu関連のエラー0件

- [ ] **Step 8: Commit**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts src/routes/game/shidasu/+page.svelte
git commit -m "feat: 秘儀/天啓/神託使用イベントに果断・星霜の加算ロジックを実装"
```

---

### Task 4: 果断・星霜のgained計算への反映とitemActualEffects説明文を実装する

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`(`playCard`内のgained計算)
- Modify: `src/lib/game/shidasu/itemActualEffects.ts`
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`のTask 3で追加したdescribeブロックの直後に、以下を追加する。

```ts
describe('果断・星霜: gained計算への反映', () => {
  test('果断所持時、getた点にdiscretionNが加算される', () => {
    const wave = makeWave({
      foundation: card(0, '♠', 5),
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      discretionN: 30,
    })
    const withoutDiscretion = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    const withDiscretion = playCard(DEFAULT_PARAMS, wave, 'none', ['discretion'], 1000000, 0, standardDeckComposition())
    expect(withDiscretion.wave.score).toBe(withoutDiscretion.wave.score + 30)
  })

  test('星霜所持時、獲得点にfrostXが倍算される', () => {
    const wave = makeWave({
      foundation: card(0, '♠', 5),
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      frostX: 1.5,
    })
    const withoutFrost = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    const withFrost = playCard(DEFAULT_PARAMS, wave, 'none', ['frost'], 1000000, 0, standardDeckComposition())
    expect(withFrost.wave.score).toBe(Math.floor(withoutFrost.wave.score * 1.5))
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "果断・星霜: gained計算"`
Expected: FAIL(`discretionN`/`frostX`がgained計算に反映されていない)

- [ ] **Step 3: playCard内にdiscretion・frostのgained計算反映を実装する**

`src/lib/game/shidasu/engine.ts`の`playCard`関数内、`divineProtectionFactor`計算の直後(gained計算式の直前)に以下を追加する。

```ts
  const discretionAdd = items.includes('discretion') ? wave.discretionN : 0
  if (discretionAdd !== 0) parts.push(addPart('果断', discretionAdd))
  const frostFactor = items.includes('frost') ? wave.frostX : 1
  if (frostFactor !== 1) parts.push(multiplyPart('星霜', frostFactor))
```

`gained`の計算式を以下のように変更する。

変更前:
```ts
  let gained = Math.floor(itemResult.value * multiplier * mannazFactor * dedicationFactor * diligenceFactor * divineProtectionFactor)
```

変更後:
```ts
  let gained = Math.floor((itemResult.value + discretionAdd) * multiplier * mannazFactor * dedicationFactor * diligenceFactor * divineProtectionFactor * frostFactor)
```

果断は「n点加算」のため、`itemResult.value`(護符効果適用済みの取得点)に加算してから残りの倍率を掛ける形にする(献身等の既存の倍率のみのパターンとは異なる)。Step 1のテストは基礎点100・コンボ0(倍率1)というシンプルな条件のため、`Math.floor`のタイミングによる丸め誤差は発生せず、上記の計算式でそのままテストが成立する。

`WaveState`の返り値オブジェクトの`divineProtectionX: newDivineProtectionX,`の行の直後に以下を追加する(discretionN・frostXは`useRite`/`useRevelation`/`useOracle`側で更新される値であり、`playCard`内では変更しないため、そのまま`wave`の値を引き継ぐ)。

```ts
    discretionN: wave.discretionN,
    frostX: wave.frostX,
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "果断・星霜: gained計算"`
Expected: PASS(2件とも)

- [ ] **Step 5: itemActualEffects.tsに果断・星霜の説明文を追加する**

`src/lib/game/shidasu/itemActualEffects.ts`のTask 1 Step 11で追加した`silver`の行の直後に以下を追加する。

```ts
  discretion: '所持中、天啓・神託・秘儀のいずれかを使用するたび永続的にdiscretionXにnを加算する(10から開始)。playCardのgained計算時にdiscretionN分を加算する',
  frost: '所持中、天啓・神託・秘儀のいずれかを使用するたび永続的にfrostXにxを加算する(1から開始)。playCardのgained計算時にfrostXを乗算する',
```

- [ ] **Step 6: 全体テスト・型チェックを実行する**

Run: `npx vitest run`
Expected: 全件PASS

Run: `npm run check`
Expected: shidasu関連のエラー0件

Run: `npm run build`
Expected: ビルド成功

- [ ] **Step 7: Commit**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/itemActualEffects.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 果断・星霜のgained計算反映を実装"
```

---

### Task 5: 統合確認

**Files:** なし(確認のみ)

- [ ] **Step 1: 全護符数の整合性を確認する**

```bash
grep -n "silver\|discretion\|frost" src/lib/game/shidasu/items.ts src/lib/game/shidasu/itemGroups.ts
```

Expected: 3護符すべてが両ファイルに出現する

- [ ] **Step 2: shidasu-gofu-candidates.mdの実装状況を更新する**

`docs/shidasu/shidasu-gofu-candidates.md`のグループ19見出し(261行目付近)・白銀の行・グループ22見出し(277行目付近)・果断/星霜の行を、実装完了を反映して更新する。グループ19の見出しを「【誓約・契り・白銀は実装済み: 2026-08-03】」のように更新し、白銀の行の備考に実装済みの旨(x=1.5、CardFace.svelteでの表示変更)を追記する。グループ22の見出しを「該当カテゴリ自体が未実装のため後回し確定」から「【実装済み: 2026-08-03】」に変更し、果断・星霜の行の備考にn=10/+10の線形増加への変更(旧文書の倍増方式からの変更)・x=0.01・実装済みの旨を追記する。

集計セクション(288行目付近のレアリティ分布)も、変更があれば更新する(今回はレアリティ自体の変更はないため、実装状況の注記のみでよい)。

- [ ] **Step 3: 全テストを実行する**

Run: `npx vitest run`
Expected: 全ファイルPASS

- [ ] **Step 4: ビルドを実行する**

Run: `npm run build`
Expected: ビルド成功

- [ ] **Step 5: 型チェックを実行する**

Run: `npm run check`
Expected: shidasu関連のエラー0件(他ツールの既存エラーは無関係のため無視してよい)

- [ ] **Step 6: 開発サーバーでブラウザ確認する**

Run: `npm run dev`
確認項目:
- `/admin/shidasu-debug`で白銀を付与し、場札のカードのスート記号が非表示・色がグレー統一されて表示されること
- `/admin/shidasu-debug`で果断・星霜を付与し、秘儀・天啓・神託を使用するたびに効果が積み上がること(デバッグパネルの内部状態表示、またはスコア内訳で確認)
- `/admin/shidasu-talismans`で白銀・果断・星霜の名前・説明文が正しく表示・編集できること

- [ ] **Step 7: Commit**

```bash
git add docs/shidasu/shidasu-gofu-candidates.md
git commit -m "docs: shidasu-gofu-candidates.mdに白銀・果断・星霜の実装完了を反映"
```

---
