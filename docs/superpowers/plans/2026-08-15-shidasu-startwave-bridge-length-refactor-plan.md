# startWave橋補正共通化リファクタ 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `src/lib/game/shidasu/engine.ts`の`startWave`にある橋の護符による長さ補正計算(2行)を、既存の`resolveBridgeAdjustedLengths`ヘルパーの呼び出しに置き換える。

**Architecture:** `startWave`内の該当2行を、前回のリファクタで`playCard`・`drawStock`向けに追加済みの`resolveBridgeAdjustedLengths`(新規追加不要)の呼び出しに置き換える。分割代入時にプロパティ名をリネームし、既存の変数名(`effectiveStairMinLenAtDeal`・`effectiveSuitColorMinLenAtDeal`)をそのまま維持することで、後続コードへの影響をゼロにする。純粋なリファクタであり挙動は一切変更しない。

**Tech Stack:** SvelteKit, Svelte 5, TypeScript, Vitest

**設計書:** `docs/superpowers/specs/2026-08-15-shidasu-startwave-bridge-length-refactor-design.md`

---

## Task 1: `startWave`内の橋補正を`resolveBridgeAdjustedLengths`に置き換える

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`(`startWave`)

- [ ] **Step 1: 該当2行を置き換える**

`src/lib/game/shidasu/engine.ts`内、`startWave`関数内の以下の行(`grep -n "const effectiveStairMinLenAtDeal"`で位置を特定できる):

```ts
  const effectiveStairMinLenAtDeal = items.includes('bridge') ? params.scoring.stairMinLen - params.talismans.bridge.m : params.scoring.stairMinLen
  const effectiveSuitColorMinLenAtDeal = items.includes('bridge') ? params.scoring.suitColorMinLen - params.talismans.bridge.m : params.scoring.suitColorMinLen
```

を以下に置き換える:

```ts
  const { effectiveStairMinLen: effectiveStairMinLenAtDeal, effectiveSuitColorMinLen: effectiveSuitColorMinLenAtDeal } = resolveBridgeAdjustedLengths(params, items)
```

(`resolveBridgeAdjustedLengths`は既に`engine.ts`内に定義済みの関数。新規追加は不要。TypeScript/JavaScriptの関数宣言は巻き上げされるため、`startWave`が`resolveBridgeAdjustedLengths`より前方に定義されていても問題なく呼び出せる。)

- [ ] **Step 2: 型チェックを実行する**

Run: `npm run check`
Expected: エラー無し

- [ ] **Step 3: テストを実行する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts`
Expected: 全件PASS(`startWave`・護符「橋」関連の既存テストを含め、無修正のまま全てグリーンになるはず。これが本リファクタの正しさの根拠)

- [ ] **Step 4: フルテストスイートを実行する**

Run: `npx vitest run`
Expected: 全件PASS

- [ ] **Step 5: ビルドを実行する**

Run: `npm run build`
Expected: 成功

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/engine.ts
git commit -m "refactor: startWaveの橋補正計算をresolveBridgeAdjustedLengthsの呼び出しに置き換える"
```

---

## 最終確認

- [ ] `npm run build`を実行し、ビルドが通ることを確認する
- [ ] `npm run check`を実行し、型エラーが無いことを確認する
- [ ] `npx vitest run`を実行し、全テストがPASSすることを確認する
- [ ] `docs/shidasu/shidasu-roadmap.md`に今回のリファクタ完了を反映する
