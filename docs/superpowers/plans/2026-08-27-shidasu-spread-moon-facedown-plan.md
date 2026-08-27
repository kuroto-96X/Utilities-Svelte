# 月スプレッドの効果変更(上半分裏向き配布) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** スプレッド「月」の効果を「場札が常に1行少ない」から「場札が常に1行多いが、配られた場札の上半分(端数切捨て)の行が裏向きになる」へ変更する。

**Architecture:** `startWave`(`engine.ts`)に`spreadId`引数を追加し、配布直後に`spreadId === 'moon'`の場合だけ各列の先頭側`Math.floor(rows / 2)`枚に既存の`Card.faceUp = false`フラグを設定する。表示側(`PlayArea.svelte`)は既存の`isTop`判定ロジックがそのまま効くため変更不要。`initialExtraTableauRows`を`-1`から`1`に変更するのは設定ファイル(`params.ts`・`shidasu.config.json`)のみの変更。

**Tech Stack:** TypeScript, SvelteKit, Vitest

---

### Task 1: `initialExtraTableauRows`を`-1`から`1`へ変更し、`desc`を更新する

**Files:**
- Modify: `src/lib/game/shidasu/params.ts:342`
- Modify: `src/lib/game/shidasu/shidasu.config.json:119-127`
- Test: `src/lib/game/shidasu/params.test.ts`

- [ ] **Step 1: 既存のmoonスプレッド関連テストを確認する**

`src/lib/game/shidasu/params.test.ts`を開き、`spreads.moon`や`initialExtraTableauRows`を直接アサートしているテストがあるか確認する。以下のコマンドで検索する。

Run: `grep -n "moon" src/lib/game/shidasu/params.test.ts`

もし`initialExtraTableauRows`が`-1`であることをアサートするテストがあれば、そのテストを`1`を期待する内容に書き換える(Step 2の変更後に合わせる)。無ければこのステップは完了。

- [ ] **Step 2: `params.ts`の`DEFAULT_PARAMS.spreads.moon`を変更する**

`src/lib/game/shidasu/params.ts:342`の現在の内容:

```ts
    moon: { name: '月', desc: '場札は常に1行少ない状態で始まる', initialExtraTableauRows: -1, waveTargetBase: 2000, waveTargetMultiplier: 1.5, initialOracleLevel: 1, bannedShopKinds: [] },
```

これを以下に変更する:

```ts
    moon: { name: '月', desc: '場札が常に1行多い状態で始まる。Wave開始時に配られる場札の上半分(端数切捨て)の行は裏向きになる。', initialExtraTableauRows: 1, waveTargetBase: 2000, waveTargetMultiplier: 1.5, initialOracleLevel: 1, bannedShopKinds: [] },
```

- [ ] **Step 3: `shidasu.config.json`の`spreads.moon`を変更する**

`src/lib/game/shidasu/shidasu.config.json:119-127`の現在の内容:

```json
    "moon": {
      "name": "月",
      "desc": "場札は常に1行少ない状態で始まる",
      "initialExtraTableauRows": -1,
      "waveTargetBase": 2000,
      "waveTargetMultiplier": 1.5,
      "initialOracleLevel": 1,
      "bannedShopKinds": []
    },
```

これを以下に変更する:

```json
    "moon": {
      "name": "月",
      "desc": "場札が常に1行多い状態で始まる。Wave開始時に配られる場札の上半分(端数切捨て)の行は裏向きになる。",
      "initialExtraTableauRows": 1,
      "waveTargetBase": 2000,
      "waveTargetMultiplier": 1.5,
      "initialOracleLevel": 1,
      "bannedShopKinds": []
    },
```

- [ ] **Step 4: 型チェックとテストを実行する**

Run: `npm run check`
Expected: shidasu関連の新規エラーなし(既存の無関係ファイル由来のエラー・警告のみ)

Run: `npm test -- params.test.ts`
Expected: 全件PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json
git commit -m "$(cat <<'EOF'
feat: 月スプレッドのinitialExtraTableauRowsを-1から1へ変更

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `startWave`に`spreadId`引数を追加し、月スプレッドの裏向き配布ロジックを実装する

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts:123-161` (関数シグネチャと配布ループ)
- Modify: `src/lib/game/shidasu/engine.ts:1197` (`startRevelationPreview`内の呼び出し)
- Modify: `src/lib/game/shidasu/engine.ts:1229` (`finishShop`内の呼び出し)
- Modify: `src/lib/game/shidasu/types.ts:170-174` (`Card.faceUp`のコメント)
- Test: `src/lib/game/shidasu/engine.test.ts`

このタスクの前提として、`SpreadId`型は既に`src/lib/game/shidasu/engine.ts:2`でimport済み(`import type { ... SpreadId, ... } from './types'`)。追加のimportは不要。

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の`describe('startWave', ...)`ブロック内(347行目付近の既存テスト群の直後、388行目「同じシードなら同じ結果になる」テストの前あたり)に、以下のテストを追加する。

```ts
  test('spreadId: moonのとき、各列の先頭Math.floor(rows/2)枚がfaceUp:falseになる(奥側=先頭側が裏向き)', () => {
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 1, defaultOracleLevels(), 1, 1, 1, 10, 1, 1, 50, { kind: 'none' }, 'moon')
    const rows = DEFAULT_PARAMS.layout.rows + 1
    const hiddenCount = Math.floor(rows / 2)
    wave.tableau.forEach(col => {
      expect(col).toHaveLength(rows)
      col.forEach((card, i) => {
        if (i < hiddenCount) {
          expect(card.faceUp).toBe(false)
        } else {
          expect(card.faceUp).not.toBe(false)
        }
      })
    })
  })

  test('spreadId: moon以外(fool)のとき、全カードのfaceUpは未設定のまま(裏向き配布は適用されない)', () => {
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels(), 1, 1, 1, 10, 1, 1, 50, { kind: 'none' }, 'fool')
    wave.tableau.forEach(col => {
      col.forEach(card => expect(card.faceUp).not.toBe(false))
    })
  })

  test('spreadId省略時(デフォルト)は、fool相当で全カードのfaceUpが未設定のまま', () => {
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1)
    wave.tableau.forEach(col => {
      col.forEach(card => expect(card.faceUp).not.toBe(false))
    })
  })
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm test -- engine.test.ts -t "spreadId"`
Expected: FAIL — `startWave`が16番目の引数`spreadId`を受け取らない、または`faceUp`が常に未設定のため最初のテスト(`moon`のとき裏向きになる)が失敗する

- [ ] **Step 3: `startWave`の関数シグネチャに`spreadId`引数を追加する**

`src/lib/game/shidasu/engine.ts:123-140`の現在の内容:

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
  frostX: number = 1,
  echoX: number = 1,
  shootingStarN: number = 50,
  sabotage: StarSabotage = { kind: 'none' }
): { wave: WaveState; deckComposition: DeckCard[] } {
```

これを以下に変更する(末尾に`spreadId`引数を追加):

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
  frostX: number = 1,
  echoX: number = 1,
  shootingStarN: number = 50,
  sabotage: StarSabotage = { kind: 'none' },
  spreadId: SpreadId = 'fool'
): { wave: WaveState; deckComposition: DeckCard[] } {
```

- [ ] **Step 4: 配布ループの直後に月スプレッドの裏向き付与ロジックを追加する**

`src/lib/game/shidasu/engine.ts:156-161`の現在の内容:

```ts
  const { cols } = params.layout
  const rows = params.layout.rows + extraTableauRows
  const tableau: Card[][] = []
  for (let c = 0; c < cols; c++) {
    tableau.push(deck.splice(0, rows))
  }
```

これを以下に変更する:

```ts
  const { cols } = params.layout
  const rows = params.layout.rows + extraTableauRows
  const tableau: Card[][] = []
  for (let c = 0; c < cols; c++) {
    tableau.push(deck.splice(0, rows))
  }
  // 月: 配られた場札のうち奥側(各列の先頭側、操作可能な手前=末尾側とは反対)の
  // floor(rows/2)枚を裏向きにする。表示側(PlayArea.svelte)のisTop判定は末尾側を
  // 指すため、この裏向き行が操作可能な一番手前になることはない。
  if (spreadId === 'moon') {
    const hiddenCount = Math.floor(rows / 2)
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < hiddenCount; r++) {
        tableau[c][r] = { ...tableau[c][r], faceUp: false }
      }
    }
  }
```

- [ ] **Step 5: `startRevelationPreview`の呼び出しに`run.spreadId`を渡す**

`src/lib/game/shidasu/engine.ts:1197`の現在の内容:

```ts
  const { wave } = startWave(params, 0, 0, run.items.map(h => h.id), run.deckComposition, seed, run.extraTableauRows, run.oracleLevels, run.dedicationX, run.diligenceX, run.divineProtectionX, run.discretionN, run.frostX, run.echoX, run.shootingStarN)
```

これを以下に変更する:

```ts
  const { wave } = startWave(params, 0, 0, run.items.map(h => h.id), run.deckComposition, seed, run.extraTableauRows, run.oracleLevels, run.dedicationX, run.diligenceX, run.divineProtectionX, run.discretionN, run.frostX, run.echoX, run.shootingStarN, { kind: 'none' }, run.spreadId)
```

- [ ] **Step 6: `finishShop`の呼び出しに`run.spreadId`を渡す**

`src/lib/game/shidasu/engine.ts:1229`の現在の内容:

```ts
  const { wave, deckComposition } = startWave(params, run.stageIndex, run.waveIndex, items.map(h => h.id), run.deckComposition, baseSeed, run.extraTableauRows, run.oracleLevels, run.dedicationX, run.diligenceX, run.divineProtectionX, run.discretionN, run.frostX, run.echoX, run.shootingStarN, star?.sabotage ?? { kind: 'none' })
```

これを以下に変更する:

```ts
  const { wave, deckComposition } = startWave(params, run.stageIndex, run.waveIndex, items.map(h => h.id), run.deckComposition, baseSeed, run.extraTableauRows, run.oracleLevels, run.dedicationX, run.diligenceX, run.divineProtectionX, run.discretionN, run.frostX, run.echoX, run.shootingStarN, star?.sabotage ?? { kind: 'none' }, run.spreadId)
```

- [ ] **Step 7: `Card.faceUp`のコメントを更新する**

`src/lib/game/shidasu/types.ts:170-174`の現在の内容:

```ts
  // カードが表向きかどうか。undefinedは表向き扱い(既存の全カード生成箇所は変更不要)。
  // falseは「総戻し」「一列戻し」「捨て札埋没」の3妨害行動でのみ設定される。表示側
  // (PlayArea.svelte)が、場札の列の一番上かどうかを都度判定して裏向き表示を決める
  // ため、エンジン側でこの値をtrueへ書き戻す処理は存在しない。
  faceUp?: boolean
```

これを以下に変更する:

```ts
  // カードが表向きかどうか。undefinedは表向き扱い(既存の全カード生成箇所は変更不要)。
  // falseは「総戻し」「一列戻し」「捨て札埋没」の3妨害行動、および月スプレッドの
  // Wave開始時配布(startWaveが各列の奥側floor(rows/2)枚に設定)で使われる。表示側
  // (PlayArea.svelte)が、場札の列の一番上かどうかを都度判定して裏向き表示を決める
  // ため、エンジン側でこの値をtrueへ書き戻す処理は存在しない。
  faceUp?: boolean
```

- [ ] **Step 8: テストが通ることを確認する**

Run: `npm test -- engine.test.ts -t "spreadId"`
Expected: PASS (3件とも)

Run: `npm test -- engine.test.ts`
Expected: 全件PASS(既存テストも含め、`startWave`の引数追加はデフォルト値`'fool'`があるため既存呼び出しは影響を受けない)

- [ ] **Step 9: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/types.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: startWaveにspreadId引数を追加し、月スプレッドの上半分裏向き配布を実装

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: 全体テスト・ビルド確認とブラウザでの動作確認

**Files:**
- なし(確認のみ)

- [ ] **Step 1: 全テストスイートを実行する**

Run: `npm test`
Expected: 全ファイル・全テストPASS(Task 1・2で追加したテストを含む)

- [ ] **Step 2: ビルドを確認する**

Run: `npm run build`
Expected: 成功

- [ ] **Step 3: 型チェックを確認する**

Run: `npm run check`
Expected: shidasu関連の新規エラーなし(既存の無関係ファイル由来のエラー・警告のみ、Task 1のStep 4で確認した件数から増えていないこと)

- [ ] **Step 4: 開発サーバーでブラウザ動作確認する**

Run: `npm run dev`

ブラウザで `http://localhost:5173/game/shidasu` を開き、以下を確認する。

1. スプレッド選択画面で「月」の説明文が「場札が常に1行多い状態で始まる。Wave開始時に配られる場札の上半分(端数切捨て)の行は裏向きになる。」に更新されていること
2. 「月」を選んでランを開始し、最初のWaveの場札を見る。各列の枚数が通常より1行多いこと(`params.layout.rows`が5ならデフォルトで6行、うち`Math.floor(6/2)=3`行が裏向き表示になっていること)
3. 裏向きのカードがある列で、一番手前(操作可能な位置)のカードは常に表向きで見えること
4. 裏向きカードのある列からカードをプレイして列を縮めていくと、これまで裏向きだったカードが一番手前になった瞬間に表向き表示へ切り替わること
5. 「愚者」を選んでランを開始し、従来通り場札が全て表向きで配られること(回帰確認)

問題があれば修正し、Step 1〜3を再実行してから次に進む。

- [ ] **Step 5: `shidasu.config.json`が意図しない差分を持っていないか確認する**

ブラウザでのショップ操作等により`shidasu.config.json`が保存APIを通じて書き換わっていないか確認する。

Run: `git status`
Run: `git diff src/lib/game/shidasu/shidasu.config.json`

Task 1で行った`moon`エントリの変更以外の差分があれば(フォーマットの再整形等)、以下で復元してからTask 1の変更のみを再度適用する。

```bash
git diff src/lib/game/shidasu/shidasu.config.json
```

差分がTask 1の内容と一致していることを確認できたら、このタスクは追加のコミットなしで完了(Task 1で既にコミット済みのため)。
