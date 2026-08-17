# riteEffects.ts applyRiteEffect Record化リファクタ 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `src/lib/game/shidasu/riteEffects.ts`の`applyRiteEffect`(24ケースのswitch文)を、`Record<RiteId, RiteHandler>`ディスパッチへ置き換える。

**Architecture:** 統一シグネチャ`(wave, params, rand) => WaveState`の型エイリアス`RiteHandler`と、24個の既存`applyXxx`関数それぞれを薄くラップする`RITE_HANDLERS`定数を追加し、`applyRiteEffect`本体を`RITE_HANDLERS[riteId](wave, params, rand)`の1行に置き換える。個々の`applyXxx`関数の実装は一切変更しない。純粋なリファクタであり挙動は一切変更しない。

**Tech Stack:** SvelteKit, Svelte 5, TypeScript, Vitest

**設計書:** `docs/superpowers/specs/2026-08-18-shidasu-rite-effects-record-refactor-design.md`

---

## Task 1: `applyRiteEffect`をRecordディスパッチへ置き換える

**Files:**
- Modify: `src/lib/game/shidasu/riteEffects.ts`

- [ ] **Step 1: `RiteHandler`型と`RITE_HANDLERS`定数を追加する**

`src/lib/game/shidasu/riteEffects.ts`内、`applyRiteEffect`関数の直前(`grep -n "export function applyRiteEffect"`で位置を特定できる。現在256行目)に以下を追加する:

```ts
type RiteHandler = (wave: WaveState, params: ShidasuParams, rand: () => number) => WaveState

const RITE_HANDLERS: Record<RiteId, RiteHandler> = {
  raidho: (wave, _params, rand) => applyRaidho(wave, rand),
  jera: (wave, _params, rand) => applyJera(wave, rand),
  wunjo: (wave, _params, rand) => applyWunjo(wave, rand),
  othala: (wave, _params, rand) => applyOthala(wave, rand),
  perthro: (wave) => applyPerthro(wave),
  uruz: (wave, params) => applyUruz(wave, params.rites.uruz.n),
  ingwaz: (wave, params) => applyIngwaz(wave, params.rites.ingwaz.n),
  gebo: (wave, _params, rand) => applyGebo(wave, rand),
  fehu: (wave) => applyFehu(wave),
  dagaz: (wave, _params, rand) => applyDagaz(wave, rand),
  algiz: (wave) => applyAlgiz(wave),
  tiwaz: (wave) => applyTiwaz(wave),
  laguz: (wave, _params, rand) => applyLaguz(wave, rand),
  eihwaz: (wave, params) => applyEihwaz(wave, params.rites.eihwaz.n),
  ansuz: (wave) => applyAnsuz(wave),
  kenaz: (wave, _params, rand) => applyKenaz(wave, rand),
  thurisaz: (wave, params) => applyThurisaz(wave, params.rites.thurisaz.x),
  hagalaz: (wave, _params, rand) => applyHagalaz(wave, rand),
  nauthiz: (wave) => applyNauthiz(wave),
  isa: (wave) => applyIsa(wave),
  sowilo: (wave) => applySowilo(wave),
  berkano: (wave, params) => applyBerkano(wave, params.rites.berkano.x),
  mannaz: (wave) => applyMannaz(wave),
  ehwaz: (wave) => applyEhwaz(wave),
}

```

(`RiteId`は24種のリテラル型で、`Record<RiteId, RiteHandler>`という型注釈により、キーが1つでも欠けているとTypeScriptがコンパイルエラーを出す。)

- [ ] **Step 2: `applyRiteEffect`本体を置き換える**

同ファイル内、以下のブロック(`grep -n "export function applyRiteEffect"`で位置を特定できる):

```ts
export function applyRiteEffect(params: ShidasuParams, wave: WaveState, riteId: RiteId, rand: () => number): WaveState {
  switch (riteId) {
    case 'raidho':
      return applyRaidho(wave, rand)
    case 'jera':
      return applyJera(wave, rand)
    case 'wunjo':
      return applyWunjo(wave, rand)
    case 'othala':
      return applyOthala(wave, rand)
    case 'perthro':
      return applyPerthro(wave)
    case 'uruz':
      return applyUruz(wave, params.rites.uruz.n)
    case 'ingwaz':
      return applyIngwaz(wave, params.rites.ingwaz.n)
    case 'gebo':
      return applyGebo(wave, rand)
    case 'fehu':
      return applyFehu(wave)
    case 'dagaz':
      return applyDagaz(wave, rand)
    case 'algiz':
      return applyAlgiz(wave)
    case 'tiwaz':
      return applyTiwaz(wave)
    case 'laguz':
      return applyLaguz(wave, rand)
    case 'eihwaz':
      return applyEihwaz(wave, params.rites.eihwaz.n)
    case 'ansuz':
      return applyAnsuz(wave)
    case 'kenaz':
      return applyKenaz(wave, rand)
    case 'thurisaz':
      return applyThurisaz(wave, params.rites.thurisaz.x)
    case 'hagalaz':
      return applyHagalaz(wave, rand)
    case 'nauthiz':
      return applyNauthiz(wave)
    case 'isa':
      return applyIsa(wave)
    case 'sowilo':
      return applySowilo(wave)
    case 'berkano':
      return applyBerkano(wave, params.rites.berkano.x)
    case 'mannaz':
      return applyMannaz(wave)
    case 'ehwaz':
      return applyEhwaz(wave)
  }
}
```

を以下に置き換える:

```ts
export function applyRiteEffect(params: ShidasuParams, wave: WaveState, riteId: RiteId, rand: () => number): WaveState {
  return RITE_HANDLERS[riteId](wave, params, rand)
}
```

- [ ] **Step 3: `canUseRite`のswitch文はそのまま維持する(変更しない)**

`canUseRite`関数(`applyRiteEffect`の直前、`grep -n "export function canUseRite"`で位置を特定できる)は、24ケース中7ケースのみ条件チェックがあり残りは`default: true`という非対称な形のため、今回のRecord化の対象外とする。このステップでは何もコードを変更しない(確認のみ)。

- [ ] **Step 4: 型チェックを実行する**

Run: `npm run check`
Expected: エラー無し

- [ ] **Step 5: テストを実行する**

Run: `npx vitest run src/lib/game/shidasu/riteEffects.test.ts src/lib/game/shidasu/engine.test.ts`
Expected: 全件PASS(秘儀使用関連の既存テストを含め、無修正のまま全てグリーンになるはず。これが本リファクタの正しさの根拠)

- [ ] **Step 6: フルテストスイートを実行する**

Run: `npx vitest run`
Expected: 全件PASS

- [ ] **Step 7: ビルドを実行する**

Run: `npm run build`
Expected: 成功

- [ ] **Step 8: コミット**

```bash
git add src/lib/game/shidasu/riteEffects.ts
git commit -m "refactor: riteEffects.tsのapplyRiteEffectをswitchからRecordディスパッチへ置き換える"
```

---

## 最終確認

- [ ] `npm run build`を実行し、ビルドが通ることを確認する
- [ ] `npm run check`を実行し、型エラーが無いことを確認する
- [ ] `npx vitest run`を実行し、全テストがPASSすることを確認する
- [ ] `docs/shidasu/shidasu-roadmap.md`に今回のリファクタ完了を反映する
