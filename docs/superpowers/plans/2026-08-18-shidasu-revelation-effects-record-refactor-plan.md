# revelationEffects.ts applyRevelationEffect Record化リファクタ 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `src/lib/game/shidasu/revelationEffects.ts`の`applyRevelationEffect`(28ケースのswitch文)を、`Record<RevelationId, RevelationHandler>`ディスパッチへ置き換える。

**Architecture:** 統一シグネチャ`(wave, deckComposition, targetCol, params, rand) => { wave, deckComposition }`の型エイリアス`RevelationHandler`と、共有no-opハンドラ`noop`、28個のエントリからなる`REVELATION_HANDLERS`定数を追加し、`applyRevelationEffect`本体を`REVELATION_HANDLERS[revelationId](wave, deckComposition, targetCol, params, rand)`の1行に置き換える。個々の`convertXxx`・`wildifyXxx`等の実装は一切変更しない。純粋なリファクタであり挙動は一切変更しない。

**Tech Stack:** SvelteKit, Svelte 5, TypeScript, Vitest

**設計書:** `docs/superpowers/specs/2026-08-18-shidasu-revelation-effects-record-refactor-design.md`

---

## Task 1: `applyRevelationEffect`をRecordディスパッチへ置き換える

**Files:**
- Modify: `src/lib/game/shidasu/revelationEffects.ts`

- [ ] **Step 1: `RevelationHandler`型・`noop`ハンドラ・`REVELATION_HANDLERS`定数を追加する**

`src/lib/game/shidasu/revelationEffects.ts`内、`applyRevelationEffect`関数の直前(`grep -n "export function applyRevelationEffect"`で位置を特定できる。現在246行目)に以下を追加する:

```ts
type RevelationHandler = (
  wave: WaveState,
  deckComposition: DeckCard[],
  targetCol: number | null,
  params: ShidasuParams,
  rand: () => number
) => { wave: WaveState; deckComposition: DeckCard[] }

const noop: RevelationHandler = (wave, deckComposition) => ({ wave, deckComposition })

const REVELATION_HANDLERS: Record<RevelationId, RevelationHandler> = {
  kaku: (wave, deckComposition, targetCol) =>
    targetCol === null ? { wave, deckComposition } : convertColumnToSuit(wave, deckComposition, targetCol, '♠'),
  kou: (wave, deckComposition, targetCol) =>
    targetCol === null ? { wave, deckComposition } : convertColumnToSuit(wave, deckComposition, targetCol, '♥'),
  tei: (wave, deckComposition, targetCol) =>
    targetCol === null ? { wave, deckComposition } : convertColumnToSuit(wave, deckComposition, targetCol, '♦'),
  bou: (wave, deckComposition, targetCol) =>
    targetCol === null ? { wave, deckComposition } : convertColumnToSuit(wave, deckComposition, targetCol, '♣'),
  shin: (wave, deckComposition) => convertTableauSuit(wave, deckComposition, '♠', '♥'),
  bi: (wave, deckComposition) => convertTableauSuit(wave, deckComposition, '♥', '♣'),
  ki: (wave, deckComposition) => convertTableauSuit(wave, deckComposition, '♣', '♦'),
  to: (wave, deckComposition) => convertTableauSuit(wave, deckComposition, '♦', '♠'),
  gyu: (wave, deckComposition, targetCol, _params, rand) =>
    targetCol === null ? { wave, deckComposition } : convertColumnToRandomRank(wave, deckComposition, targetCol, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], rand),
  jo: (wave, deckComposition, targetCol, _params, rand) =>
    targetCol === null ? { wave, deckComposition } : convertColumnToRandomRank(wave, deckComposition, targetCol, [11, 12, 13], rand),
  kyo: noop,
  aya: (wave, deckComposition, targetCol) =>
    targetCol === null ? { wave, deckComposition } : addWildToColumnTop(wave, deckComposition, targetCol),
  shitsu: (wave, deckComposition, targetCol) =>
    targetCol === null ? { wave, deckComposition } : convertColumnChainFromLeft(wave, deckComposition, targetCol),
  heki: (wave, deckComposition) => convertTableauSuitCycle(wave, deckComposition),
  kei: (wave, deckComposition) => stairAlignTopCards(wave, deckComposition),
  rou: (wave, deckComposition) => discardColumnTops(wave, deckComposition),
  i: (wave, deckComposition, _targetCol, _params, rand) => wildifyExtremeRanks(wave, deckComposition, rand),
  hitsu: (wave, deckComposition, targetCol, _params, rand) =>
    targetCol === null ? { wave, deckComposition } : convertColumnToStair(wave, deckComposition, targetCol, rand),
  shi: (wave, deckComposition) => wildifyChainTop(wave, deckComposition),
  sei: (wave, deckComposition, _targetCol, params, rand) => wildifyRandomTableauCards(wave, deckComposition, params.revelations.sei.n, rand),
  subaru: noop,
  ryuu: noop,
  hotori: noop,
  chou: noop,
  yoku: noop,
  mitsu: noop,
  karasu: noop,
  oni: noop,
}

```

(`RevelationId`は28種のリテラル型で、`Record<RevelationId, RevelationHandler>`という型注釈により、キーが1つでも欠けているとTypeScriptがコンパイルエラーを出す。)

- [ ] **Step 2: `applyRevelationEffect`本体を置き換える**

同ファイル内、以下のブロック(`grep -n "export function applyRevelationEffect"`で位置を特定できる):

```ts
export function applyRevelationEffect(
  params: ShidasuParams,
  wave: WaveState,
  deckComposition: DeckCard[],
  revelationId: RevelationId,
  targetCol: number | null,
  rand: () => number
): { wave: WaveState; deckComposition: DeckCard[] } {
  switch (revelationId) {
    case 'kaku':
      return targetCol === null ? { wave, deckComposition } : convertColumnToSuit(wave, deckComposition, targetCol, '♠')
    case 'kou':
      return targetCol === null ? { wave, deckComposition } : convertColumnToSuit(wave, deckComposition, targetCol, '♥')
    case 'tei':
      return targetCol === null ? { wave, deckComposition } : convertColumnToSuit(wave, deckComposition, targetCol, '♦')
    case 'bou':
      return targetCol === null ? { wave, deckComposition } : convertColumnToSuit(wave, deckComposition, targetCol, '♣')
    case 'shin':
      return convertTableauSuit(wave, deckComposition, '♠', '♥')
    case 'bi':
      return convertTableauSuit(wave, deckComposition, '♥', '♣')
    case 'ki':
      return convertTableauSuit(wave, deckComposition, '♣', '♦')
    case 'to':
      return convertTableauSuit(wave, deckComposition, '♦', '♠')
    case 'gyu':
      return targetCol === null ? { wave, deckComposition } : convertColumnToRandomRank(wave, deckComposition, targetCol, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], rand)
    case 'jo':
      return targetCol === null ? { wave, deckComposition } : convertColumnToRandomRank(wave, deckComposition, targetCol, [11, 12, 13], rand)
    case 'kyo':
      return { wave, deckComposition }
    case 'aya':
      return targetCol === null ? { wave, deckComposition } : addWildToColumnTop(wave, deckComposition, targetCol)
    case 'shitsu':
      return targetCol === null ? { wave, deckComposition } : convertColumnChainFromLeft(wave, deckComposition, targetCol)
    case 'heki':
      return convertTableauSuitCycle(wave, deckComposition)
    case 'kei':
      return stairAlignTopCards(wave, deckComposition)
    case 'rou':
      return discardColumnTops(wave, deckComposition)
    case 'i':
      return wildifyExtremeRanks(wave, deckComposition, rand)
    case 'hitsu':
      return targetCol === null ? { wave, deckComposition } : convertColumnToStair(wave, deckComposition, targetCol, rand)
    case 'shi':
      return wildifyChainTop(wave, deckComposition)
    case 'sei':
      return wildifyRandomTableauCards(wave, deckComposition, params.revelations.sei.n, rand)
    case 'subaru':
      return { wave, deckComposition }
    case 'ryuu':
      return { wave, deckComposition }
    case 'hotori':
      return { wave, deckComposition }
    case 'chou':
      return { wave, deckComposition }
    case 'yoku':
      return { wave, deckComposition }
    case 'mitsu':
      return { wave, deckComposition }
    case 'karasu':
      return { wave, deckComposition }
    case 'oni':
      return { wave, deckComposition }
  }
}
```

を以下に置き換える:

```ts
export function applyRevelationEffect(
  params: ShidasuParams,
  wave: WaveState,
  deckComposition: DeckCard[],
  revelationId: RevelationId,
  targetCol: number | null,
  rand: () => number
): { wave: WaveState; deckComposition: DeckCard[] } {
  return REVELATION_HANDLERS[revelationId](wave, deckComposition, targetCol, params, rand)
}
```

- [ ] **Step 3: `revelationNeedsTarget`・`canUseRevelation`はそのまま維持する(変更しない)**

`revelationNeedsTarget`関数・`canUseRevelation`関数(いずれも`applyRevelationEffect`の直前にある)は、今回のRecord化の対象外とする。このステップでは何もコードを変更しない(確認のみ)。

- [ ] **Step 4: 型チェックを実行する**

Run: `npm run check`
Expected: shidasu関連のエラー無し(プロジェクト全体には`solitaire`・`hepburn-converter`・`vector3-visualizer`など今回の変更と無関係な既存の型エラーが約55件存在するが、それらは無視してよい)

- [ ] **Step 5: テストを実行する**

Run: `npx vitest run src/lib/game/shidasu/revelationEffects.test.ts src/lib/game/shidasu/engine.test.ts`
Expected: 全件PASS(天啓使用関連の既存テストを含め、無修正のまま全てグリーンになるはず。これが本リファクタの正しさの根拠)

- [ ] **Step 6: フルテストスイートを実行する**

Run: `npx vitest run`
Expected: 全件PASS

- [ ] **Step 7: ビルドを実行する**

Run: `npm run build`
Expected: 成功

- [ ] **Step 8: コミット**

```bash
git add src/lib/game/shidasu/revelationEffects.ts
git commit -m "refactor: revelationEffects.tsのapplyRevelationEffectをswitchからRecordディスパッチへ置き換える"
```

---

## 最終確認

- [ ] `npm run build`を実行し、ビルドが通ることを確認する
- [ ] `npm run check`を実行し、型エラーが無いことを確認する
- [ ] `npx vitest run`を実行し、全テストがPASSすることを確認する
- [ ] `docs/shidasu/shidasu-roadmap.md`に今回のリファクタ完了を反映する
