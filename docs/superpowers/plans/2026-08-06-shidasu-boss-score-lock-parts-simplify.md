# 惑星ロック時の得点内訳を単一パーツ化する Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shidasuの惑星(BossScoreLock)による無得点化が発動した場合、得点内訳アニメーションで惑星ロックのパーツ1件のみが最初かつ唯一のパーツとして表示されるようにする(それまでに積んだ基礎点・パターン/役ボーナス・護符効果等のパーツを表示しない)。

**Architecture:** `playCard`・`drawStock`(素朴の護符所持時のパターン継続再現パス)の両方で、`scoreLock`成立を判定して`gained`を0にする箇所に`parts.length = 0`を追加し、その後の`lockPart`のみを唯一の要素にする。UI側(`PlayArea.svelte`)は`wave.lastGain.parts`をそのまま順番表示する既存の仕組みのため変更不要。

**Tech Stack:** SvelteKit, Svelte 5 runes, TypeScript, Vitest

---

### Task 1: playCard・drawStockの惑星ロック発動時にpartsを単一パーツ化する

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く(playCard側)**

`src/lib/game/shidasu/engine.test.ts`の`describe('playCard: BossScoreLock(ボス制約による得点0)', ...)`ブロック内(1432行目付近)、最初のテスト`'scoreLockがkind:comboで、effectiveComboがmaxCombo以下なら獲得点が0になる'`の直後に以下を追加する。

```ts
    test('scoreLockが成立した場合、lastGain.partsは惑星ロックパーツ1件のみになる(基礎点等の他パーツは含まれない)', () => {
      const wave = baseWave({
        foundation: card(0, '♠', 5),
        tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
        combo: 1, // このプレイでnewCombo=2、baseComboCount=0によりeffectiveCombo=2
      })
      const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition(), Math.random, { kind: 'combo', maxCombo: 2, tierLabel: 'test-tier' })
      expect(next.lastGain?.parts).toHaveLength(1)
      expect(next.lastGain?.parts[0]).toEqual({ label: 'test-tier: 獲得点0', kind: 'lock', amount: 0, text: 'test-tier: 獲得点0' })
    })
```

- [ ] **Step 2: 失敗するテストを書く(drawStock側)**

同ファイルの`describe`ブロック(3487行目付近)、`'素朴+scoreLock(kind:combo): パターン継続めくりでeffectiveComboがmaxCombo以下ならlastGainは残るが得点は0になる'`テストの直後に以下を追加する。

```ts
  test('素朴+scoreLock(kind:combo): 惑星ロックが成立した場合、lastGain.partsは惑星ロックパーツ1件のみになる', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 9)],
      combo: 2, // このめくりでnewCombo=3、baseComboCount=0によりeffectiveCombo=3
      chain: [card(2, '♠', 4), card(3, '♠', 5)],
      linked: true,
      score: 0,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['naive'], 1000000, standardDeckComposition(), 'none', Math.random, { kind: 'combo', maxCombo: 3, tierLabel: 'test-tier' })
    expect(next.lastGain?.parts).toHaveLength(1)
    expect(next.lastGain?.parts[0]).toEqual({ label: 'test-tier: 獲得点0', kind: 'lock', amount: 0, text: 'test-tier: 獲得点0' })
  })
```

- [ ] **Step 3: テストを実行して失敗を確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "惑星ロックパーツ1件のみ"`
Expected: FAIL(現状は`parts`に基礎点・パターンボーナス等の複数パーツが含まれているため、`toHaveLength(1)`が満たされない)

- [ ] **Step 4: playCard内でscoreLock成立時にpartsをクリアする**

`src/lib/game/shidasu/engine.ts`558行目付近を以下のように変更する。

変更前:
```ts
  if (scoreLock && isBossScoreLocked(scoreLock, effectiveCombo, card)) {
    parts.push(lockPart(bossScoreLockMessage(scoreLock)))
    gained = 0
  }
```

変更後:
```ts
  if (scoreLock && isBossScoreLocked(scoreLock, effectiveCombo, card)) {
    parts.length = 0
    parts.push(lockPart(bossScoreLockMessage(scoreLock)))
    gained = 0
  }
```

- [ ] **Step 5: drawStock内でscoreLock成立時にpartsをクリアする**

`src/lib/game/shidasu/engine.ts`847行目付近を以下のように変更する。

変更前:
```ts
      naiveGained = Math.floor(itemResult.value * multiplier * mannazFactor)
      if (scoreLock && isBossScoreLocked(scoreLock, effectiveCombo, drawnCard)) {
        parts.push(lockPart(bossScoreLockMessage(scoreLock)))
        naiveGained = 0
      }
```

変更後:
```ts
      naiveGained = Math.floor(itemResult.value * multiplier * mannazFactor)
      if (scoreLock && isBossScoreLocked(scoreLock, effectiveCombo, drawnCard)) {
        parts.length = 0
        parts.push(lockPart(bossScoreLockMessage(scoreLock)))
        naiveGained = 0
      }
```

実際の変更前コードは、事前に`grep -n "parts.push(lockPart" src/lib/game/shidasu/engine.ts`で正確な行番号を再確認してから変更すること(計画書作成時点から多少ズレている可能性があるため、実物を確認して整合させる)。

- [ ] **Step 6: テストを実行して成功を確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "惑星ロックパーツ1件のみ"`
Expected: PASS(2件とも)

- [ ] **Step 7: 全体テストを実行する**

Run: `npx vitest run`
Expected: 全件PASS(既存の`BossScoreLock`関連テストは`lastGain.points`のみを検証しており`.parts`の中身までは見ていないため、影響を受けない)

Run: `npm run check`
Expected: shidasu関連のエラー0件

- [ ] **Step 8: Commit**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 惑星ロック時の得点内訳を惑星パーツ1件のみに単一化"
```

---

### Task 2: 統合確認

**Files:** なし(確認のみ)

- [ ] **Step 1: 全テストを実行する**

Run: `npx vitest run`
Expected: 全ファイルPASS

- [ ] **Step 2: ビルドを実行する**

Run: `npm run build`
Expected: ビルド成功

- [ ] **Step 3: 型チェックを実行する**

Run: `npm run check`
Expected: shidasu関連のエラー0件(他ツールの既存エラーは無関係のため無視してよい)

- [ ] **Step 4: 開発サーバーで目視確認する**

Run: `npm run dev`

確認項目:
- `/admin/shidasu-debug`または`/game/shidasu`で惑星(ボス)の制約が有効なウェーブを作り、無得点になるプレイを行う
- 得点内訳アニメーションで、惑星ロックのパーツ(例:「◯◯: 獲得点0」)のみが表示され、基礎点やパターンボーナス等の他パーツが表示されないことを確認する
- 惑星ロックが発動しない通常のプレイでは、従来通り基礎点・パターン・護符効果等のパーツが順番に表示されることを確認する(regressionが無いことの確認)
