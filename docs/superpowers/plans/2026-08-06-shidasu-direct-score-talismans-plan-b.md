# 直接点護符の再設計(案B採用) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 直接点護符6個(沈着・冷静・残響・慢心・流星・誠実)を、`docs/superpowers/specs/2026-08-06-shidasu-direct-score-talismans-plan-b-design.md`で決めた「案B」効果に再実装し、`directEffects.ts`が扱う「直接点」という加点先の概念自体を廃止する。

**Architecture:** 6護符はいずれも既存の乗算・加算系護符(祝福・果断・星霜)と同じ「`WaveState`/`RunState`の永続カウンタを更新し、以後の`gained`計算に反映する」パターンに寄せる。`applyDirectEffects`とその4チャンネル(`resetDirect`・`stockEmptyDirect`・`comboMilestoneDirect`・`drawContinueDirect`)を使う護符がゼロになるため、`directEffects.ts`一式を最終タスクで削除する。

**Tech Stack:** TypeScript, SvelteKit, Vitest

---

## 実行順序についての注意

Task 3〜6は`engine.ts`の`drawStock`・`playCard`関数内の隣接コードを編集する。各タスクは自分が担当する護符のチャンネル呼び出しだけを削除し、他の護符がまだ使っているチャンネル部分(`stockEmptyResult`など)には触れない。**必ずTask 1→2→3→4→5→6→7→8の順で実行すること**(逆順や並び替えは変数の依存関係を壊す)。

---

### Task 1: 型定義・パラメータ値・テストヘルパーの追加

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`
- Modify: `src/lib/game/shidasu/params.ts`
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Modify: `src/lib/game/shidasu/engine.test.ts`
- Test: `src/lib/game/shidasu/params.test.ts`(既存ファイル、新規テストは追加しない。Step 6で確認のみ実行)

- [ ] **Step 1: `WaveState`・`RunState`に`echoX`・`shootingStarN`を追加する**

`src/lib/game/shidasu/types.ts`で、WaveState内の以下の既存コード(190-201行目付近)を探す:

```ts
  discretionN: number
  frostX: number
```

その直後に以下を追加する:

```ts
  // 残響用: コンボリセットのたびリセット前コンボ数に応じて永続的に加算される倍率(1から開始)。
  // ラン全体で永続する値だが、drawStock内でのみ更新されるためWaveState側に正本を持ち、
  // startWaveでRunStateからコピー・resolveWaveEndでRunStateへ書き戻す。
  echoX: number
  // 流星用: コンボがc(talismans.shootingStar.c)に到達するたび永続的に加算される値。
  // ラン全体で永続する値だが、playCard内でのみ更新されるためWaveState側に正本を持ち、
  // startWaveでRunStateからコピー・resolveWaveEndでRunStateへ書き戻す。
  shootingStarN: number
```

同ファイルのRunState内、以下の既存コード(314-317行目付近)を探す:

```ts
  // 果断・星霜の累積値の永続値。WaveState側のdiscretionN/frostXの正本。
  // beginRunで初期化され(discretionN=10, frostX=1)、resolveWaveEnd成功時にwaveの値で更新される。
  discretionN: number
  frostX: number
```

その直後に以下を追加する:

```ts
  // 残響・流星の累積値の永続値。WaveState側のechoX/shootingStarNの正本。
  // beginRunで初期化され(echoX=1, shootingStarN=50)、resolveWaveEnd成功時にwaveの値で更新される。
  echoX: number
  shootingStarN: number
```

- [ ] **Step 2: `engine.test.ts`の`makeWave`ヘルパーに新フィールドのデフォルト値を追加する(型エラー解消)**

`src/lib/game/shidasu/engine.test.ts`の`makeWave`関数内、以下の既存コードを探す:

```ts
    baseComboCount: 0,
    dedicationX: 1,
    diligenceX: 1,
    divineProtectionX: 1,
    discretionN: 10,
    frostX: 1,
```

直後に追加する:

```ts
    echoX: 1,
    shootingStarN: 50,
```

- [ ] **Step 3: 型チェックを実行し、他に`WaveState`/`RunState`を直接組み立てている箇所がエラーにならないか確認する**

Run: `npm run check`

Expected: `echoX`/`shootingStarN`が無いことによるエラーが出た場合は、そのファイル内の`WaveState`/`RunState`オブジェクトリテラルにも同様のデフォルト値(`echoX: 1, shootingStarN: 50,`)を追加する。すでにスプレッド(`...wave`や`...run`)経由で構築している箇所はエラーにならない。

- [ ] **Step 4: パラメータ値検証テストを新しい値に書き換える(先に失敗させる)**

`src/lib/game/shidasu/engine.test.ts`内、以下の既存コードを探す(`describe('DEFAULT_PARAMS.talismans (グループ9〜16)')`ブロック内):

```ts
    expect(DEFAULT_PARAMS.talismans.composure.n).toBe(500)
    expect(DEFAULT_PARAMS.talismans.clarity.n).toBe(500)
    expect(DEFAULT_PARAMS.talismans.arrogance.x).toBe(50)
    expect(DEFAULT_PARAMS.talismans.echo.n).toBe(200)
    expect(DEFAULT_PARAMS.talismans.shootingStar.c).toBe(10)
    expect(DEFAULT_PARAMS.talismans.shootingStar.p).toBe(10)
    expect(DEFAULT_PARAMS.talismans.intuition.x).toBe(0.3)
    expect(DEFAULT_PARAMS.talismans.sincerity.n).toBe(300)
```

以下に置き換える:

```ts
    expect(DEFAULT_PARAMS.talismans.composure.n).toBe(1)
    expect(DEFAULT_PARAMS.talismans.clarity.n).toBe(1)
    expect(DEFAULT_PARAMS.talismans.arrogance.x).toBe(1.5)
    expect(DEFAULT_PARAMS.talismans.echo.n).toBe(0.001)
    expect(DEFAULT_PARAMS.talismans.shootingStar.c).toBe(10)
    expect(DEFAULT_PARAMS.talismans.shootingStar.n).toBe(50)
    expect(DEFAULT_PARAMS.talismans.intuition.x).toBe(0.3)
    expect(DEFAULT_PARAMS.talismans.sincerity.n).toBe(1)
```

- [ ] **Step 5: テストを実行して失敗することを確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "DEFAULT_PARAMS.talismans"`

Expected: FAIL (`arrogance.x`が50ではなく1.5を期待しているため。`shootingStar.p`のアクセスは型エラーになるため、この時点ではまず型エラーで失敗する)

- [ ] **Step 6: `params.ts`の型定義とDEFAULT_PARAMSを更新する**

`src/lib/game/shidasu/params.ts`内、以下の既存コード(139-146行目付近)を探す:

```ts
    composure: { name: string; n: number; rarity: Rarity; desc: string }
    clarity: { name: string; n: number; rarity: Rarity; desc: string }
    arrogance: { name: string; x: number; rarity: Rarity; desc: string }
    echo: { name: string; n: number; rarity: Rarity; desc: string }
    shootingStar: { name: string; c: number; p: number; rarity: Rarity; desc: string }
```

以下に置き換える(`shootingStar`の`p`を`n`に変更):

```ts
    composure: { name: string; n: number; rarity: Rarity; desc: string }
    clarity: { name: string; n: number; rarity: Rarity; desc: string }
    arrogance: { name: string; x: number; rarity: Rarity; desc: string }
    echo: { name: string; n: number; rarity: Rarity; desc: string }
    shootingStar: { name: string; c: number; n: number; rarity: Rarity; desc: string }
```

同ファイル内、以下の既存コード(368-375行目付近)を探す:

```ts
    composure: { name: '沈着', n: 500, rarity: 'C', desc: '山札めくりでコンボリセットされた時、取れる場札が無ければ直接{n}点加算' },
    clarity: { name: '冷静', n: 500, rarity: 'C', desc: 'コンボリセット時、そのチェーンで役が一つも成立していなければ直接{n}点加算' },
    arrogance: { name: '慢心', x: 50, rarity: 'C', desc: '山札が無くなった時、場札の残り枚数×{x}点を直接加算' },
    echo: { name: '残響', n: 200, rarity: 'U', desc: 'コンボがリセットされる瞬間、リセット前のコンボ数×{n}点を直接加算' },
    shootingStar: { name: '流星', c: 10, p: 10, rarity: 'R', desc: 'コンボ数が{c}に到達した瞬間、獲得点を加算した後の現在スコアの{p}%を直接加算' },
```

以下に置き換える:

```ts
    composure: { name: '沈着', n: 1, rarity: 'C', desc: 'コンボリセット時、取れる場札が無ければ基礎コンボ数+{n}' },
    clarity: { name: '冷静', n: 1, rarity: 'C', desc: 'コンボリセット時、そのチェーンで役が一つも成立していなければ基礎コンボ数+{n}' },
    arrogance: { name: '慢心', x: 1.5, rarity: 'C', desc: 'カードプレイ時、山札が0枚なら獲得点を{x}倍' },
    echo: { name: '残響', n: 0.001, rarity: 'U', desc: 'コンボリセット時、リセット前のコンボ数×{n}を永続倍率として蓄積(以後の獲得点に乗算)' },
    shootingStar: { name: '流星', c: 10, n: 50, rarity: 'R', desc: 'コンボ数が{c}に到達するたび、永続加算{n}が蓄積(以後の獲得点に加算)' },
```

同ファイル内、`sincerity`の既存コードを探す:

```ts
    sincerity: { name: '誠実', n: 300, rarity: 'C', desc: '山札めくりで同色パターンによりコンボ継続した時、直接{n}点加算' },
```

以下に置き換える:

```ts
    sincerity: { name: '誠実', n: 1, rarity: 'C', desc: 'パターン継続(同スート・同色・階段いずれか)でコンボ継続時、コンボ数+{n}' },
```

- [ ] **Step 7: テストを実行してパスすることを確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "DEFAULT_PARAMS.talismans"`

Expected: PASS

- [ ] **Step 8: `shidasu.config.json`の該当6エントリを更新する**

`src/lib/game/shidasu/shidasu.config.json`内、以下の既存エントリ(557-586行目付近)を探す:

```json
    "composure": {
      "name": "沈着",
      "n": 500,
      "rarity": "C",
      "desc": "直接点\nコンボリセットで取れる場札が無いとき\n+{n}"
    },
    "clarity": {
      "name": "冷静",
      "n": 500,
      "rarity": "C",
      "desc": "直接点\n役が一つも成立していないときにコンボリセット\n+{n}"
    },
    "arrogance": {
      "name": "慢心",
      "x": 200,
      "rarity": "C",
      "desc": "直接点\n山札が無くなった\n+場札の枚数×{x}"
    },
    "echo": {
      "name": "残響",
      "n": 200,
      "rarity": "U",
      "desc": "直接点\nコンボリセット\n+(リセット前のコンボ数×{n})"
    },
    "shootingStar": {
      "name": "流星",
      "c": 10,
      "p": 10,
      "rarity": "R",
      "desc": "直接点\nコンボ数が{c}以上になった\n+現在スコアの{p}%"
    },
```

以下に置き換える:

```json
    "composure": {
      "name": "沈着",
      "n": 1,
      "rarity": "C",
      "desc": "コンボリセット時、取れる場札が無ければ\n基礎コンボ数+{n}"
    },
    "clarity": {
      "name": "冷静",
      "n": 1,
      "rarity": "C",
      "desc": "コンボリセット時、そのチェーンで役が一つも成立していなければ\n基礎コンボ数+{n}"
    },
    "arrogance": {
      "name": "慢心",
      "x": 1.5,
      "rarity": "C",
      "desc": "カードプレイ時\n山札が0枚なら獲得点を{x}倍"
    },
    "echo": {
      "name": "残響",
      "n": 0.001,
      "rarity": "U",
      "desc": "コンボリセット時\nリセット前のコンボ数×{n}を永続倍率として蓄積\n(以後の獲得点に乗算)"
    },
    "shootingStar": {
      "name": "流星",
      "c": 10,
      "n": 50,
      "rarity": "R",
      "desc": "コンボ数が{c}に到達するたび\n永続加算{n}が蓄積\n(以後の獲得点に加算)"
    },
```

同ファイル内、`sincerity`の既存エントリを探す:

```json
    "sincerity": {
      "name": "誠実",
      "n": 300,
      "rarity": "C",
      "desc": "直接点\n同色パターンによるコンボ継続\n+{n}"
    },
```

以下に置き換える:

```json
    "sincerity": {
      "name": "誠実",
      "n": 1,
      "rarity": "C",
      "desc": "パターン継続(同スート・同色・階段いずれか)で\nコンボ継続時\nコンボ数+{n}"
    },
```

- [ ] **Step 9: 型チェックと全体テストを実行する**

Run: `npm run check && npx vitest run src/lib/game/shidasu/params.test.ts`

Expected: 両方PASS

- [ ] **Step 10: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 直接点護符6個の新パラメータ(echoX・shootingStarN等)を追加"
```

---

### Task 2: RunState⇔WaveState同期配線(echoX・shootingStarN)

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`内、以下の既存ブロックを探す:

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

直後に以下を追加する:

```ts
describe('残響・流星の基盤(startWave/resolveWaveEndでの同期)', () => {
  test('startWaveのechoX・shootingStarNのデフォルト値はそれぞれ1・50', () => {
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1)
    expect(wave.echoX).toBe(1)
    expect(wave.shootingStarN).toBe(50)
  })

  test('startWaveに渡した値がそのままwaveに反映される', () => {
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels(), 1, 1, 1, 10, 1, 1.5, 90)
    expect(wave.echoX).toBe(1.5)
    expect(wave.shootingStarN).toBe(90)
  })

  test('resolveWaveEndでクリア成功時、wave側のechoX・shootingStarNがrunへ書き戻される', () => {
    const base = beginRun(DEFAULT_PARAMS, 1)
    const { wave } = startWave(DEFAULT_PARAMS, base.stageIndex, base.waveIndex, base.items, base.deckComposition, 1, base.extraTableauRows, base.oracleLevels)
    const run: RunState = {
      ...base,
      wave: { ...wave, echoX: 3, shootingStarN: 120, score: waveTarget(DEFAULT_PARAMS, 0, 0, base.stageStars), status: 'ended', endReason: 'target' },
    }
    const result = resolveWaveEnd(DEFAULT_PARAMS, run, createRng(5))
    expect(result.echoX).toBe(3)
    expect(result.shootingStarN).toBe(120)
  })
})
```

- [ ] **Step 2: テストを実行して失敗することを確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "残響・流星の基盤"`

Expected: FAIL(`startWave`が9番目・10番目の引数を受け取らず`wave.echoX`が`undefined`になる、または`resolveWaveEnd`が`echoX`を書き戻さない)

- [ ] **Step 3: `startWave`のシグネチャに`echoX`・`shootingStarN`引数を追加する**

`src/lib/game/shidasu/engine.ts`内、以下の既存コード(118-132行目付近)を探す:

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

以下に置き換える:

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
  shootingStarN: number = 50
): { wave: WaveState; deckComposition: DeckCard[] } {
```

同関数内、以下の既存コード(196-200行目付近、WaveStateオブジェクト構築部分)を探す:

```ts
    dedicationX,
    diligenceX,
    divineProtectionX,
    discretionN,
    frostX,
```

直後に追加する:

```ts
    echoX,
    shootingStarN,
```

- [ ] **Step 4: `startWave`の呼び出し元2箇所に`echoX`・`shootingStarN`を渡す**

`src/lib/game/shidasu/engine.ts`内、以下の既存コードを探す:

```ts
  const { wave } = startWave(params, 0, 0, run.items, run.deckComposition, seed, run.extraTableauRows, run.oracleLevels, run.dedicationX, run.diligenceX, run.divineProtectionX, run.discretionN, run.frostX)
```

以下に置き換える:

```ts
  const { wave } = startWave(params, 0, 0, run.items, run.deckComposition, seed, run.extraTableauRows, run.oracleLevels, run.dedicationX, run.diligenceX, run.divineProtectionX, run.discretionN, run.frostX, run.echoX, run.shootingStarN)
```

続けて、以下の既存コードを探す:

```ts
  const { wave, deckComposition } = startWave(params, run.stageIndex, run.waveIndex, run.items, run.deckComposition, seed, run.extraTableauRows, run.oracleLevels, run.dedicationX, run.diligenceX, run.divineProtectionX, run.discretionN, run.frostX)
```

以下に置き換える:

```ts
  const { wave, deckComposition } = startWave(params, run.stageIndex, run.waveIndex, run.items, run.deckComposition, seed, run.extraTableauRows, run.oracleLevels, run.dedicationX, run.diligenceX, run.divineProtectionX, run.discretionN, run.frostX, run.echoX, run.shootingStarN)
```

- [ ] **Step 5: `createInitialRun`・`beginRun`に初期値を追加する**

`src/lib/game/shidasu/engine.ts`内、`createInitialRun`関数の以下の既存コードを探す:

```ts
    dedicationX: 1, diligenceX: 1, divineProtectionX: 1,
    discretionN: 10, frostX: 1,
```

以下に置き換える:

```ts
    dedicationX: 1, diligenceX: 1, divineProtectionX: 1,
    discretionN: 10, frostX: 1,
    echoX: 1, shootingStarN: 50,
```

`beginRun`関数内、以下の既存コードを探す:

```ts
    dedicationX: 1,
    diligenceX: 1,
    divineProtectionX: 1,
    discretionN: 10,
    frostX: 1,
```

直後に追加する:

```ts
    echoX: 1,
    shootingStarN: 50,
```

- [ ] **Step 6: `resolveWaveEnd`でRunStateへ書き戻す**

`src/lib/game/shidasu/engine.ts`内、以下の既存コード(`resolveWaveEnd`関数内)を探す:

```ts
  const runWithCurrency = {
    ...run,
    currency: run.currency + earned,
    dedicationX: wave.dedicationX,
    diligenceX: wave.diligenceX,
    divineProtectionX: wave.divineProtectionX,
    discretionN: wave.discretionN,
    frostX: wave.frostX,
  }
```

以下に置き換える:

```ts
  const runWithCurrency = {
    ...run,
    currency: run.currency + earned,
    dedicationX: wave.dedicationX,
    diligenceX: wave.diligenceX,
    divineProtectionX: wave.divineProtectionX,
    discretionN: wave.discretionN,
    frostX: wave.frostX,
    echoX: wave.echoX,
    shootingStarN: wave.shootingStarN,
  }
```

- [ ] **Step 7: テストを実行してパスすることを確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "残響・流星の基盤"`

Expected: PASS

- [ ] **Step 8: 型チェックを実行する**

Run: `npm run check`

Expected: エラーなし

- [ ] **Step 9: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: echoX・shootingStarNのRunState/WaveState同期を配線"
```

---

### Task 3: 沈着・冷静・残響の実装(resetDirectチャンネルの置換)

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`内、以下の既存テスト3つを探す:

```ts
  test('沈着: リセット時に取れる場札が無ければ直接点が加算される', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      tableau: [[card(2, '♠', 2)]], // 差が大きく取れない
      chain: [card(3, '♥', 5)],
      linked: true,
      score: 100,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['composure'], 1000000, standardDeckComposition())
    expect(next.score).toBe(100 + DEFAULT_PARAMS.talismans.composure.n)
  })

  test('冷静: リセットされるチェーンで役が一つも成立していなければ直接点が加算される', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      tableau: [[card(2, '♣', 8)]],
      chain: [card(3, '♥', 5)],
      linked: true,
      roleFiredThisChain: false,
      score: 100,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['clarity'], 1000000, standardDeckComposition())
    expect(next.score).toBe(100 + DEFAULT_PARAMS.talismans.clarity.n)
  })

  test('冷静: 役が成立していたチェーンのリセットでは発動しない', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      tableau: [[card(2, '♣', 8)]],
      chain: [card(3, '♥', 5)],
      linked: true,
      roleFiredThisChain: true,
      score: 100,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['clarity'], 1000000, standardDeckComposition())
    expect(next.score).toBe(100)
  })

  test('残響: リセット時、リセット前のコンボ数×nが直接加算される', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      tableau: [[card(2, '♣', 8)]],
      chain: [card(3, '♥', 5)],
      linked: true,
      combo: 4,
      score: 100,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['echo'], 1000000, standardDeckComposition())
    expect(next.score).toBe(100 + 4 * DEFAULT_PARAMS.talismans.echo.n)
  })
```

以下に置き換える:

```ts
  test('沈着: リセット時に取れる場札が無ければbaseComboCountが+nされる', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      tableau: [[card(2, '♠', 2)]], // 差が大きく取れない
      chain: [card(3, '♥', 5)],
      linked: true,
      score: 100,
      baseComboCount: 0,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['composure'], 1000000, standardDeckComposition())
    expect(next.score).toBe(100)
    expect(next.baseComboCount).toBe(DEFAULT_PARAMS.talismans.composure.n)
  })

  test('冷静: リセットされるチェーンで役が一つも成立していなければbaseComboCountが+nされる', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      tableau: [[card(2, '♣', 8)]],
      chain: [card(3, '♥', 5)],
      linked: true,
      roleFiredThisChain: false,
      score: 100,
      baseComboCount: 0,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['clarity'], 1000000, standardDeckComposition())
    expect(next.baseComboCount).toBe(DEFAULT_PARAMS.talismans.clarity.n)
  })

  test('冷静: 役が成立していたチェーンのリセットでは発動しない', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      tableau: [[card(2, '♣', 8)]],
      chain: [card(3, '♥', 5)],
      linked: true,
      roleFiredThisChain: true,
      score: 100,
      baseComboCount: 0,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['clarity'], 1000000, standardDeckComposition())
    expect(next.baseComboCount).toBe(0)
  })

  test('残響: リセット時、リセット前のコンボ数×nがechoXに永続加算される', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      tableau: [[card(2, '♣', 8)]],
      chain: [card(3, '♥', 5)],
      linked: true,
      combo: 4,
      score: 100,
      echoX: 1,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['echo'], 1000000, standardDeckComposition())
    expect(next.score).toBe(100)
    expect(next.echoX).toBeCloseTo(1 + 4 * DEFAULT_PARAMS.talismans.echo.n)
  })

  test('沈着・冷静: 両方の条件が同時に成立すればbaseComboCountに両方分加算される', () => {
    const items: ItemId[] = ['composure', 'clarity']
    const wave = makeWave({
      foundation: card(0, '♠', 5),
      tableau: [[card(1, '♣', 6)]],
      stock: [card(9, '♠', 9)],
      chain: [card(0, '♠', 5)],
      linked: false,
      roleFiredThisChain: false,
      baseComboCount: 0,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, items, 1000000, standardDeckComposition(), 'none')
    expect(next.baseComboCount).toBe(DEFAULT_PARAMS.talismans.composure.n + DEFAULT_PARAMS.talismans.clarity.n)
  })

  test('残響: 獲得点にechoXが乗算される', () => {
    const wave = makeWave({
      foundation: card(0, '♠', 5),
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      echoX: 2,
      comboFrozenThisWave: true, // コンボ倍率をかけず単純倍算のみを検証するため固定
    })
    const withoutEcho = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    const withEcho = playCard(DEFAULT_PARAMS, wave, 'none', ['echo'], 1000000, 0, standardDeckComposition())
    expect(withEcho.wave.score).toBe(withoutEcho.wave.score * 2)
  })
```

続けて、以下の既存テストを探す:

```ts
  test('沈着・冷静の護符: コンボリセット時、lastBonusGainsに直接加算がまとめて別枠で入る', () => {
    const items: ItemId[] = ['composure', 'clarity']
    const wave = makeWave({
      foundation: card(0, '♠', 5),
      // 新しいfoundationになるdrawnCard(rank9)との差が1でも12でもないため、
      // drawStockのリセット分岐でhasPlayableColumns=falseになる(沈着の発火条件)
      tableau: [[card(1, '♣', 6)]],
      stock: [card(9, '♠', 9)],
      chain: [card(0, '♠', 5)],
      linked: false,
      roleFiredThisChain: false,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, items, 1000000, standardDeckComposition(), 'none')
    const entry = next.lastBonusGains.find(g => g.label === '護符による直接加算')
    expect(entry).toBeDefined()
    expect(entry?.parts.map(p => p.text)).toContain(`沈着+${DEFAULT_PARAMS.talismans.composure.n}`)
    expect(entry?.parts.map(p => p.text)).toContain(`冷静+${DEFAULT_PARAMS.talismans.clarity.n}`)
    // 回帰防止: lastGainとlastBonusGainsの合計が実際のスコア増分と一致することを確認する(二重計上防止)。
    const bonusTotal = next.lastBonusGains.reduce((sum, g) => sum + g.points, 0)
    expect((next.lastGain?.points ?? 0) + bonusTotal).toBe(next.score - wave.score)
  })
```

このテスト全体を削除する(直前の「沈着・冷静: 両方の条件が同時に成立すれば...」テストが同じ内容を新効果でカバーしている)。

- [ ] **Step 2: テストを実行して失敗することを確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "沈着|冷静|残響"`

Expected: FAIL(`baseComboCount`/`echoX`が変化しない、`score`が旧効果通り増えている)

- [ ] **Step 3: `playCard`のgained計算にechoFactorを追加する**

`src/lib/game/shidasu/engine.ts`内、以下の既存コード(`playCard`関数内)を探す:

```ts
  const discretionAdd = items.includes('discretion') ? wave.discretionN : 0
  if (discretionAdd !== 0) parts.push(addPart('果断', discretionAdd))
  const frostFactor = items.includes('frost') ? wave.frostX : 1
  if (frostFactor !== 1) parts.push(multiplyPart('星霜', frostFactor))
  let gained = Math.floor((itemResult.value + discretionAdd) * multiplier * mannazFactor * dedicationFactor * diligenceFactor * divineProtectionFactor * frostFactor)
```

以下に置き換える:

```ts
  const discretionAdd = items.includes('discretion') ? wave.discretionN : 0
  if (discretionAdd !== 0) parts.push(addPart('果断', discretionAdd))
  const frostFactor = items.includes('frost') ? wave.frostX : 1
  if (frostFactor !== 1) parts.push(multiplyPart('星霜', frostFactor))
  const echoFactor = items.includes('echo') ? wave.echoX : 1
  if (echoFactor !== 1) parts.push(multiplyPart('残響', echoFactor))
  let gained = Math.floor((itemResult.value + discretionAdd) * multiplier * mannazFactor * dedicationFactor * diligenceFactor * divineProtectionFactor * frostFactor * echoFactor)
```

同関数内、`next`オブジェクト構築部分にある以下の既存コードを探す:

```ts
    discretionN: wave.discretionN,
    frostX: wave.frostX,
```

直後に追加する:

```ts
    echoX: wave.echoX,
```

- [ ] **Step 4: `drawStock`のコンボリセット処理を書き換える**

`src/lib/game/shidasu/engine.ts`内、以下の既存コード(`drawStock`関数内)を探す:

```ts
  const hasPlayableColumns = getPlayableColumns(modifier, { ...wave, foundation: drawnCard, combo: 0 }).size > 0
  const silenceFires = !hasPlayableColumns && items.includes('silence')
  const card = silenceFires ? { ...drawnCard, wild: true } : drawnCard
  const newDeckComposition = silenceFires ? convertCardToWildByDeckId(deckComposition, drawnCard.deckId) : deckComposition

  const resetCtx: DirectEffectContext = {
    comboBeforeReset: wave.combo,
    hasPlayableColumns,
    roleFiredThisChain: wave.roleFiredThisChain,
    remainingTableauCount: remainingCount(wave.tableau),
    combo: wave.combo,
    colorHeld: false,
    previousCombo: wave.combo,
    scoreAfterGained: wave.score,
  }
  const resetResult = applyDirectEffects('resetDirect', items, resetCtx, params)
  const resetDirectGain = resetResult.value

  const resetBonusGains: BonusGain[] = []
  if (stockEmptyResult.parts.length > 0) {
    resetBonusGains.push({ label: '護符による直接加算', points: stockEmptyResult.value, parts: stockEmptyResult.parts })
  }
  if (resetResult.parts.length > 0) {
    resetBonusGains.push({ label: '護符による直接加算', points: resetDirectGain, parts: resetResult.parts })
  }

  let resetWave: WaveState = {
    ...resetComboFields(wave, params, card, 'draw'),
    stock: items.includes('promise') ? arrangeNextCardForContinuation(params.scoring, newStock, [card], effectiveStairMinLen, effectiveSuitColorMinLen, items) : newStock,
    lastDrawEffect: null,
    lastGain: null,
    score: scoreAfterStockEmpty + resetDirectGain,
    lastBonusGains: resetBonusGains,
  }
```

以下に置き換える:

```ts
  const hasPlayableColumns = getPlayableColumns(modifier, { ...wave, foundation: drawnCard, combo: 0 }).size > 0
  const silenceFires = !hasPlayableColumns && items.includes('silence')
  const card = silenceFires ? { ...drawnCard, wild: true } : drawnCard
  const newDeckComposition = silenceFires ? convertCardToWildByDeckId(deckComposition, drawnCard.deckId) : deckComposition

  // 沈着: リセット時、取れる場札が無ければ基礎コンボ数(baseComboCount)を永続+nする
  const composureAdd = !hasPlayableColumns && items.includes('composure') ? params.talismans.composure.n : 0
  // 冷静: リセット時、そのチェーンで役が一つも成立していなければ基礎コンボ数を永続+nする
  const clarityAdd = !wave.roleFiredThisChain && items.includes('clarity') ? params.talismans.clarity.n : 0
  // 残響: リセット時、リセット前のコンボ数×nを永続倍率echoXとして蓄積する(以後gainedに乗算)
  const echoAdd = items.includes('echo') ? wave.combo * params.talismans.echo.n : 0

  const resetBonusGains: BonusGain[] = []
  if (stockEmptyResult.parts.length > 0) {
    resetBonusGains.push({ label: '護符による直接加算', points: stockEmptyResult.value, parts: stockEmptyResult.parts })
  }

  let resetWave: WaveState = {
    ...resetComboFields(wave, params, card, 'draw'),
    stock: items.includes('promise') ? arrangeNextCardForContinuation(params.scoring, newStock, [card], effectiveStairMinLen, effectiveSuitColorMinLen, items) : newStock,
    lastDrawEffect: null,
    lastGain: null,
    score: scoreAfterStockEmpty,
    lastBonusGains: resetBonusGains,
    baseComboCount: wave.baseComboCount + composureAdd + clarityAdd,
    echoX: wave.echoX + echoAdd,
  }
```

(`stockEmptyResult`はTask 4でまだ削除しないため、`resetBonusGains`の`stockEmptyResult.parts`チェックはそのまま残す。)

- [ ] **Step 5: テストを実行してパスすることを確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "沈着|冷静|残響"`

Expected: PASS

- [ ] **Step 6: 全テストスイートを実行し、他のテストを壊していないか確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts`

Expected: 沈着・冷静・残響以外のテストは全てPASS(慢心・流星・誠実関連のテストはまだ次タスク以降で書き換えるため、この時点では引き続きPASSしているはず)

- [ ] **Step 7: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 沈着・冷静・残響をbaseComboCount/echoX強化型に再実装"
```

---

### Task 4: 慢心の実装(stockEmptyDirectチャンネルの置換、山札切れ早期終了ブロック削除)

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`内、以下の既存テストを探す:

```ts
  test('慢心: 山札が0枚になった瞬間、場札残数×xが直接加算される', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      tableau: [[card(2, '♣', 8)], [card(4, '♦', 5)]],
      chain: [card(3, '♥', 1)],
      linked: false,
      score: 100,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['arrogance'], 1000000, standardDeckComposition())
    expect(next.stock).toHaveLength(0)
    expect(next.score).toBe(100 + 2 * DEFAULT_PARAMS.talismans.arrogance.x)
  })
```

このテストを削除し、以下に置き換える:

```ts
  test('慢心: 山札が0枚になっても、drawStockのスコアは変化しない(直接加算は廃止)', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      tableau: [[card(2, '♣', 8)], [card(4, '♦', 5)]],
      chain: [card(3, '♥', 1)],
      linked: false,
      score: 100,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['arrogance'], 1000000, standardDeckComposition())
    expect(next.stock).toHaveLength(0)
    expect(next.score).toBe(100)
  })
```

続けて、以下の既存テストを探す:

```ts
  test('慢心(山札切れ直接加算)でスコアが目標に達したら即座にendReason=targetとなり、lastBonusGainsに慢心の加算が反映される(古い内訳が残らない)', () => {
    const x = DEFAULT_PARAMS.talismans.arrogance.x
    const wave = makeWave({
      stock: [card(1, '♣', 9)], // 最後の1枚。引くと山札0枚になり慢心が発動
      tableau: [[card(2, '♣', 8)], [card(4, '♦', 5)]], // 残数2 → 慢心+2x
      chain: [card(3, '♥', 1)],
      linked: false,
      score: 100,
      lastGain: { points: 888, parts: [{ label: '古い内訳', kind: 'add', amount: 0, text: '古い内訳' }] },
      lastBonusGains: [{ label: '古い', points: 999, parts: [{ label: '古い', kind: 'add', amount: 0, text: '古い' }] }],
    })
    const result = drawStock(DEFAULT_PARAMS, wave, ['arrogance'], 100 + 2 * x, standardDeckComposition())
    expect(result.wave.stock).toHaveLength(0)
    expect(result.wave.status).toBe('ended')
    expect(result.wave.endReason).toBe('target')
    expect(result.wave.score).toBe(100 + 2 * x)
    // 直前プレイの古い内訳が残らず、慢心の加算がlastBonusGainsに正しく反映される
    expect(result.wave.lastGain).toBeNull()
    expect(result.wave.lastBonusGains).toHaveLength(1)
    const gain = result.wave.lastBonusGains[0]
    expect(gain?.points).toBe(2 * x)
    expect(gain?.parts.map(p => p.text)).toContain(`慢心+${2 * x}`)
  })
```

このテストを削除する(山札切れによる早期終了ロジック自体を削除するため、対応するテストは不要になる)。

続けて、以下の既存テストを探す:

```ts
  test('慢心の護符: 山札が尽きた瞬間、lastBonusGainsに直接加算が別枠で入る', () => {
    const items: ItemId[] = ['arrogance']
    const wave = makeWave({
      foundation: card(0, '♠', 5),
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      stock: [card(9, '♠', 9)],
      chain: [card(0, '♠', 5)],
      linked: false,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, items, 1000000, standardDeckComposition(), 'none')
    const remainingTableau = 2
    const expected = remainingTableau * DEFAULT_PARAMS.talismans.arrogance.x
    expect(next.lastBonusGains.some(g => g.label === '護符による直接加算' && g.parts.map(p => p.text).includes(`慢心+${expected}`))).toBe(true)
    // 回帰防止: lastGainとlastBonusGainsの合計が実際のスコア増分と一致することを確認する(二重計上防止)。
    const bonusTotal = next.lastBonusGains.reduce((sum, g) => sum + g.points, 0)
    expect((next.lastGain?.points ?? 0) + bonusTotal).toBe(next.score - wave.score)
  })
```

このテストを削除し、以下に置き換える(`describe('playCard'`ブロック内、他の護符テストの近くに配置する):

```ts
  test('慢心: playCard時、山札が0枚ならgainedがx倍になる', () => {
    const wave = baseWave({
      stock: [],
      comboFrozenThisWave: true, // コンボ倍率をかけず単純倍算のみを検証するため固定
    })
    const withoutArrogance = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    const withArrogance = playCard(DEFAULT_PARAMS, wave, 'none', ['arrogance'], 1000000, 0, standardDeckComposition())
    expect(withArrogance.wave.score).toBe(Math.floor(withoutArrogance.wave.score * DEFAULT_PARAMS.talismans.arrogance.x))
  })

  test('慢心: 山札が1枚以上残っていればgainedは変化しない', () => {
    const wave = baseWave({
      stock: [card(9, '♠', 9)],
      comboFrozenThisWave: true,
    })
    const withoutArrogance = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    const withArrogance = playCard(DEFAULT_PARAMS, wave, 'none', ['arrogance'], 1000000, 0, standardDeckComposition())
    expect(withArrogance.wave.score).toBe(withoutArrogance.wave.score)
  })
```

- [ ] **Step 2: テストを実行して失敗することを確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "慢心"`

Expected: FAIL(旧ロジックがまだ動いているため)

- [ ] **Step 3: `drawStock`から山札切れ早期終了ブロックを削除する**

`src/lib/game/shidasu/engine.ts`内、以下の既存コード(`drawStock`関数内)を探す:

```ts
  let scoreAfterStockEmpty = wave.score
  let stockEmptyResult: { value: number; parts: ScorePart[] } = { value: 0, parts: [] }
  if (newStock.length === 0) {
    const stockEmptyCtx: DirectEffectContext = {
      comboBeforeReset: 0,
      hasPlayableColumns: true,
      roleFiredThisChain: false,
      remainingTableauCount: remainingCount(wave.tableau),
      combo: wave.combo,
      colorHeld: false,
      previousCombo: wave.combo,
      scoreAfterGained: wave.score,
    }
    stockEmptyResult = applyDirectEffects('stockEmptyDirect', items, stockEmptyCtx, params)
    scoreAfterStockEmpty += stockEmptyResult.value
  }

  // 山札切れ時の直接加算だけで目標に達したら、以降の得点計算を行わず即座に終了する。
  if (scoreAfterStockEmpty >= target) {
    // この分岐で発生する得点は慢心等の直接加算のみ。lastGain/lastBonusGainsを更新しないと
    // 直前プレイの古い内訳が残ってしまうため、他の即時終了箇所と同様に新しい値を明示的に設定する。
    const stockEmptyBonusGains: BonusGain[] =
      stockEmptyResult.parts.length > 0
        ? [{ label: '護符による直接加算', points: stockEmptyResult.value, parts: stockEmptyResult.parts }]
        : []
    return {
      wave: {
        ...wave,
        stock: newStock,
        score: scoreAfterStockEmpty,
        lastGain: null,
        lastBonusGains: stockEmptyBonusGains,
        status: 'ended',
        endReason: 'target',
      },
      deckComposition,
    }
  }
```

以下に置き換える:

```ts
  const scoreAfterStockEmpty = wave.score
```

同関数内、Task 3で書いた以下のコード(`resetBonusGains`構築部分)を探す:

```ts
  const resetBonusGains: BonusGain[] = []
  if (stockEmptyResult.parts.length > 0) {
    resetBonusGains.push({ label: '護符による直接加算', points: stockEmptyResult.value, parts: stockEmptyResult.parts })
  }
```

以下に置き換える:

```ts
  const resetBonusGains: BonusGain[] = []
```

同関数内、以下の既存コード(`patternContinues`ブロック内の`patternContinueBonusGains`構築部分)を探す:

```ts
    const patternContinueBonusGains: BonusGain[] = []
    if (stockEmptyResult.parts.length > 0) {
      patternContinueBonusGains.push({ label: '護符による直接加算', points: stockEmptyResult.value, parts: stockEmptyResult.parts })
    }
    if (drawContinueResult.parts.length > 0) {
      patternContinueBonusGains.push({ label: '護符による直接加算', points: drawContinueResult.value, parts: drawContinueResult.parts })
    }
```

以下に置き換える(`drawContinueResult`はTask 6で削除するため、ここでは`stockEmptyResult`チェックのみ削除する):

```ts
    const patternContinueBonusGains: BonusGain[] = []
    if (drawContinueResult.parts.length > 0) {
      patternContinueBonusGains.push({ label: '護符による直接加算', points: drawContinueResult.value, parts: drawContinueResult.parts })
    }
```

- [ ] **Step 4: `playCard`のgained計算に慢心の条件付き倍率を追加する**

`src/lib/game/shidasu/engine.ts`内、Task 3で追加した以下のコードを探す:

```ts
  const echoFactor = items.includes('echo') ? wave.echoX : 1
  if (echoFactor !== 1) parts.push(multiplyPart('残響', echoFactor))
  let gained = Math.floor((itemResult.value + discretionAdd) * multiplier * mannazFactor * dedicationFactor * diligenceFactor * divineProtectionFactor * frostFactor * echoFactor)
```

以下に置き換える:

```ts
  const echoFactor = items.includes('echo') ? wave.echoX : 1
  if (echoFactor !== 1) parts.push(multiplyPart('残響', echoFactor))
  const arroganceFactor = items.includes('arrogance') && wave.stock.length === 0 ? params.talismans.arrogance.x : 1
  if (arroganceFactor !== 1) parts.push(multiplyPart('慢心', arroganceFactor))
  let gained = Math.floor((itemResult.value + discretionAdd) * multiplier * mannazFactor * dedicationFactor * diligenceFactor * divineProtectionFactor * frostFactor * echoFactor * arroganceFactor)
```

- [ ] **Step 5: テストを実行してパスすることを確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "慢心"`

Expected: PASS

- [ ] **Step 6: 全体テストを実行する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts`

Expected: 慢心・沈着・冷静・残響関連は全てPASS(流星・誠実はまだ未着手)

- [ ] **Step 7: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 慢心をplayCard時の条件付き倍率型に再実装"
```

---

### Task 5: 流星の実装(comboMilestoneDirectチャンネルの置換)

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`内、以下の既存テスト3つを探す:

```ts
  test('流星の護符: コンボが閾値に到達した瞬間、獲得点加算後のスコアのp%がlastBonusGainsに別枠で入る', () => {
    const items: ItemId[] = ['shootingStar']
    const wave = baseWave({
      score: 5000,
      combo: DEFAULT_PARAMS.talismans.shootingStar.c - 1,
      chain: [card(20, '♥', 3), card(21, '♦', 4)],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', items, 100000000, 0, standardDeckComposition())
    expect(next.combo).toBe(DEFAULT_PARAMS.talismans.shootingStar.c)
    const scoreAfterGained = wave.score + (next.lastGain?.points ?? 0)
    const expectedBonus = Math.floor(scoreAfterGained * DEFAULT_PARAMS.talismans.shootingStar.p / 100)
    expect(next.lastBonusGains).toHaveLength(1)
    expect(next.lastBonusGains[0].label).toBe('護符による直接加算')
    expect(next.lastBonusGains[0].points).toBe(expectedBonus)
    expect(next.lastBonusGains[0].parts.map(p => p.text)).toContain(`流星+${expectedBonus}`)
    // 回帰防止: 流星の加算額がlastGainとlastBonusGainsの両方に二重計上されていないことを確認する。
    const bonusTotal = next.lastBonusGains.reduce((sum, g) => sum + g.points, 0)
    expect((next.lastGain?.points ?? 0) + bonusTotal).toBe(next.score - wave.score)
  })

  test('流星の護符: 黄金と併用しコンボが閾値をまたいでジャンプしても発動する', () => {
    const items: ItemId[] = ['shootingStar', 'golden']
    const c = DEFAULT_PARAMS.talismans.shootingStar.c
    const wave = baseWave({
      score: 5000,
      combo: c - 1, // 黄金の+2適用でc+1へジャンプし、cをちょうど踏まない
      chain: [card(20, '♥', 3), card(21, '♦', 4)],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', items, 100000000, 0, standardDeckComposition())
    expect(next.combo).toBe(c + 1)
    expect(next.lastBonusGains.some(g => g.parts.some(p => p.text.startsWith('流星')))).toBe(true)
  })

  test('流星の護符: 既に閾値以上の状態が続いている間は再発動しない', () => {
    const items: ItemId[] = ['shootingStar']
    const c = DEFAULT_PARAMS.talismans.shootingStar.c
    const wave = baseWave({
      score: 5000,
      combo: c, // 既に閾値以上
      chain: [card(20, '♥', 3), card(21, '♦', 4)],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', items, 100000000, 0, standardDeckComposition())
    expect(next.combo).toBe(c + 1)
    expect(next.lastBonusGains.some(g => g.parts.some(p => p.text.startsWith('流星')))).toBe(false)
  })
```

以下に置き換える:

```ts
  test('流星: コンボが閾値に到達した瞬間、shootingStarNが永続加算される(この時点のgainedにはまだ反映されない)', () => {
    const items: ItemId[] = ['shootingStar']
    const wave = baseWave({
      score: 5000,
      combo: DEFAULT_PARAMS.talismans.shootingStar.c - 1,
      shootingStarN: 50,
      chain: [card(20, '♥', 3), card(21, '♦', 4)],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', items, 100000000, 0, standardDeckComposition())
    expect(next.combo).toBe(DEFAULT_PARAMS.talismans.shootingStar.c)
    expect(next.shootingStarN).toBe(50 + DEFAULT_PARAMS.talismans.shootingStar.n)
    expect(next.lastGain?.parts.some(p => p.text.startsWith('流星'))).toBe(false)
  })

  test('流星: 黄金と併用しコンボが閾値をまたいでジャンプしても発動する', () => {
    const items: ItemId[] = ['shootingStar', 'golden']
    const c = DEFAULT_PARAMS.talismans.shootingStar.c
    const wave = baseWave({
      score: 5000,
      combo: c - 1, // 黄金の+2適用でc+1へジャンプし、cをちょうど踏まない
      shootingStarN: 50,
      chain: [card(20, '♥', 3), card(21, '♦', 4)],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', items, 100000000, 0, standardDeckComposition())
    expect(next.combo).toBe(c + 1)
    expect(next.shootingStarN).toBe(50 + DEFAULT_PARAMS.talismans.shootingStar.n)
  })

  test('流星: 既に閾値以上の状態が続いている間は再発動しない', () => {
    const items: ItemId[] = ['shootingStar']
    const c = DEFAULT_PARAMS.talismans.shootingStar.c
    const wave = baseWave({
      score: 5000,
      combo: c, // 既に閾値以上
      shootingStarN: 50,
      chain: [card(20, '♥', 3), card(21, '♦', 4)],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', items, 100000000, 0, standardDeckComposition())
    expect(next.combo).toBe(c + 1)
    expect(next.shootingStarN).toBe(50)
  })

  test('流星: 蓄積されたshootingStarNは次のプレイのgainedに加算される', () => {
    const wave = makeWave({
      foundation: card(0, '♠', 5),
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      shootingStarN: 80,
      comboFrozenThisWave: true,
    })
    const withoutShootingStar = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    const withShootingStar = playCard(DEFAULT_PARAMS, wave, 'none', ['shootingStar'], 1000000, 0, standardDeckComposition())
    expect(withShootingStar.wave.score).toBe(withoutShootingStar.wave.score + 80)
  })
```

続けて、以下の既存テストを探す:

```ts
  test('護符gainedの時点で目標スコアに達したら、コンボ到達直接加算(流星等)は適用されずその時点でendReason=targetとなる', () => {
    const items: ItemId[] = ['shootingStar']
    const wave = baseWave({
      score: 0,
      combo: DEFAULT_PARAMS.talismans.shootingStar.c - 1,
      chain: [card(20, '♥', 3), card(21, '♦', 4)],
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', items, scoring.basePoint, 0, standardDeckComposition())
    expect(next.status).toBe('ended')
    expect(next.endReason).toBe('target')
    expect(next.lastBonusGains).toEqual([]) // 流星の直接加算は行われていない
  })
```

以下に置き換える(コンボ到達によるshootingStarN蓄積は、gained確定時点でのtarget到達判定とは独立して行われる仕様に変わるため、検証内容を差し替える):

```ts
  test('護符gainedの時点で目標スコアに達した場合でも、コンボ到達によるshootingStarNの蓄積は行われる(蓄積は得点確定と独立)', () => {
    const items: ItemId[] = ['shootingStar']
    const wave = baseWave({
      score: 0,
      combo: DEFAULT_PARAMS.talismans.shootingStar.c - 1,
      shootingStarN: 50,
      chain: [card(20, '♥', 3), card(21, '♦', 4)],
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', items, scoring.basePoint, 0, standardDeckComposition())
    expect(next.status).toBe('ended')
    expect(next.endReason).toBe('target')
    expect(next.shootingStarN).toBe(50 + DEFAULT_PARAMS.talismans.shootingStar.n)
  })
```

- [ ] **Step 2: テストを実行して失敗することを確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "流星"`

Expected: FAIL(`shootingStarN`が変化しない、旧効果の`lastBonusGains`検証が失敗する)

- [ ] **Step 3: `playCard`のgained計算にshootingStarNの蓄積・加算を追加する**

`src/lib/game/shidasu/engine.ts`内、以下の既存コード(477-478行目付近、祝福のbaseComboCount計算の直後)を探す:

```ts
  // 祝福: 役成立ごとに基礎コンボ数(baseComboCount)を永続的に+1する
  const newBaseComboCount = items.includes('sanctify') && roleFired.length > 0 ? wave.baseComboCount + 1 : wave.baseComboCount
```

直後に追加する:

```ts

  // 流星: コンボがc(shootingStar.c)に到達した瞬間、永続加算shootingStarNをc到達のたびに蓄積する
  // (到達した同じプレイのgainedには反映されず、次のプレイから効く。果断・星霜と同じ挙動)
  const shootingStarReached = items.includes('shootingStar') && wave.combo < params.talismans.shootingStar.c && newCombo >= params.talismans.shootingStar.c
  const newShootingStarN = shootingStarReached ? wave.shootingStarN + params.talismans.shootingStar.n : wave.shootingStarN
```

同関数内、Task 4で変更した以下のコードを探す:

```ts
  const discretionAdd = items.includes('discretion') ? wave.discretionN : 0
  if (discretionAdd !== 0) parts.push(addPart('果断', discretionAdd))
  const frostFactor = items.includes('frost') ? wave.frostX : 1
```

以下に置き換える:

```ts
  const discretionAdd = items.includes('discretion') ? wave.discretionN : 0
  if (discretionAdd !== 0) parts.push(addPart('果断', discretionAdd))
  const shootingStarGainedAdd = items.includes('shootingStar') ? wave.shootingStarN : 0
  if (shootingStarGainedAdd !== 0) parts.push(addPart('流星', shootingStarGainedAdd))
  const frostFactor = items.includes('frost') ? wave.frostX : 1
```

続けて、以下の既存コード(gained計算式)を探す:

```ts
  let gained = Math.floor((itemResult.value + discretionAdd) * multiplier * mannazFactor * dedicationFactor * diligenceFactor * divineProtectionFactor * frostFactor * echoFactor * arroganceFactor)
```

以下に置き換える:

```ts
  let gained = Math.floor((itemResult.value + discretionAdd + shootingStarGainedAdd) * multiplier * mannazFactor * dedicationFactor * diligenceFactor * divineProtectionFactor * frostFactor * echoFactor * arroganceFactor)
```

同関数内、`next`オブジェクト構築部分にある以下の既存コード(Task 3で追加した`echoX: wave.echoX,`の直後)を探す:

```ts
    echoX: wave.echoX,
```

以下に置き換える:

```ts
    echoX: wave.echoX,
    shootingStarN: newShootingStarN,
```

- [ ] **Step 4: `comboMilestoneDirect`の呼び出しと関連コードを削除する**

`src/lib/game/shidasu/engine.ts`内、以下の既存コード(`playCard`関数内)を探す:

```ts
  const scoreAfterGained = wave.score + gained

  // 護符gained+コンボ倍率適用後のスコアが確定した時点で目標に達していれば、
  // コンボ到達時の直接加算(流星等)や全消し判定を一切行わず、その時点のスコアで終了する。
  const targetReachedOnGained = scoreAfterGained >= target

  const milestoneCtx: DirectEffectContext = {
    comboBeforeReset: 0,
    hasPlayableColumns: true,
    roleFiredThisChain: newRoleFiredThisChain,
    remainingTableauCount: remaining,
    combo: newCombo,
    colorHeld: false,
    previousCombo: wave.combo,
    scoreAfterGained,
  }
  const milestoneResult = targetReachedOnGained
    ? { value: 0, parts: [] as ScorePart[] }
    : applyDirectEffects('comboMilestoneDirect', items, milestoneCtx, params)

  const newScore = scoreAfterGained + milestoneResult.value

  const bonusGains: BonusGain[] = []
  if (milestoneResult.parts.length > 0) {
    bonusGains.push({ label: '護符による直接加算', points: milestoneResult.value, parts: milestoneResult.parts })
  }
```

以下に置き換える:

```ts
  const scoreAfterGained = wave.score + gained

  // 護符gained+コンボ倍率適用後のスコアが確定した時点で目標に達していれば、
  // 全消し判定を一切行わず、その時点のスコアで終了する。
  const targetReachedOnGained = scoreAfterGained >= target

  const newScore = scoreAfterGained

  const bonusGains: BonusGain[] = []
```

- [ ] **Step 5: テストを実行してパスすることを確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "流星"`

Expected: PASS

- [ ] **Step 6: 全体テストを実行する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts`

Expected: 流星・沈着・冷静・残響・慢心関連は全てPASS(誠実はまだ未着手)

- [ ] **Step 7: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 流星をshootingStarN累積型に再実装"
```

---

### Task 6: 誠実の実装(drawContinueDirectチャンネルの置換、トリガー拡張)

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`内、以下の既存テストを探す:

```ts
  test('誠実: パターン継続めくりが同色パターンで成立すると直接点が加算される', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 6)], // 黒(色継続)
      chain: [card(2, '♣', 4), card(3, '♠', 5)], // 黒2枚、同色成立中
      linked: true,
      combo: 2,
      score: 100,
      drawContinueCountThisChain: 0,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['sincerity'], 1000000, standardDeckComposition())
    expect(next.linked).toBe(true)
    expect(next.score).toBe(100 + DEFAULT_PARAMS.talismans.sincerity.n)
    expect(next.drawContinueCountThisChain).toBe(1)
  })
```

以下に置き換える:

```ts
  test('誠実: パターン継続(同色)でコンボが直接+nされる', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 6)], // 黒(色継続)
      chain: [card(2, '♣', 4), card(3, '♠', 5)], // 黒2枚、同色成立中
      linked: true,
      combo: 2,
      score: 100,
      drawContinueCountThisChain: 0,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['sincerity'], 1000000, standardDeckComposition())
    expect(next.linked).toBe(true)
    expect(next.score).toBe(100)
    expect(next.combo).toBe(2 + DEFAULT_PARAMS.talismans.sincerity.n)
    expect(next.drawContinueCountThisChain).toBe(1)
  })

  test('誠実: パターン継続(同スート)でも発動する(同色限定ではなくなった)', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 6)],
      chain: [card(2, '♠', 4), card(3, '♠', 5)], // 同スート成立中
      linked: true,
      combo: 2,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['sincerity'], 1000000, standardDeckComposition())
    expect(next.combo).toBe(2 + DEFAULT_PARAMS.talismans.sincerity.n)
  })

  test('誠実: パターン継続(階段、架橋併用で短い階段でも判定)でも発動する', () => {
    const wave = makeWave({
      stock: [card(1, '♦', 7)], // 階段継続: 5→6→7(長さ3)
      combo: 2,
      chain: [card(2, '♠', 5), card(3, '♣', 6)],
      chainOrigin: ['play', 'play'],
      linked: true,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['bridge', 'sincerity'], 1000000, standardDeckComposition())
    expect(next.combo).toBe(2 + DEFAULT_PARAMS.talismans.sincerity.n)
  })
```

続けて、以下の既存テストを探す:

```ts
  test('誠実(パターン継続時の直接加算)でスコアが目標に達したら即座にendReason=targetとなりウェーブが終了する', () => {
    const n = DEFAULT_PARAMS.talismans.sincerity.n
    const wave = makeWave({
      stock: [card(1, '♠', 6)], // 黒(色継続)。引くとパターン継続する
      chain: [card(2, '♣', 4), card(3, '♠', 5)], // 黒2枚、同色成立中
      linked: true,
      combo: 2,
      score: 100,
    })
    const result = drawStock(DEFAULT_PARAMS, wave, ['sincerity'], 100 + n, standardDeckComposition())
    expect(result.wave.linked).toBe(true)
    expect(result.wave.score).toBe(100 + n)
    expect(result.wave.status).toBe('ended')
    expect(result.wave.endReason).toBe('target')
  })
```

このテストを削除する(誠実は直接スコアを増やさなくなったため、「誠実だけでtargetに達する」というシナリオ自体が成立しなくなる)。

続けて、以下の既存テストを探す:

```ts
  test('パターン継続めくりが同スートパターンで成立した場合、誠実は発動しない(同色専用)', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 6)],
      chain: [card(2, '♠', 4), card(3, '♠', 5)], // 同スート成立中
      linked: true,
      score: 100,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['sincerity'], 1000000, standardDeckComposition())
    expect(next.score).toBe(100)
  })
```

このテストを削除する(上のStep 1で追加した「誠実: パターン継続(同スート)でも発動する」が同シナリオを新仕様で検証している)。

続けて、以下の既存テストを探す:

```ts
  test('誠実の護符: 山札めくりで同色(同スートではない)パターン継続した時、lastBonusGainsに直接加算が別枠で入る', () => {
    const items: ItemId[] = ['sincerity']
    // sincerityはctx.colorHeld(=colorHeld && !suitHeld、つまり「同色だが同スートではない」)でのみ
    // 発火する。チェーンを赤2スート(♥・♦)混在にして、同スートは崩しつつ同色は保つ。
    const wave = makeWave({
      foundation: card(0, '♥', 3),
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      stock: [card(9, '♦', 7)],
      chain: [card(20, '♥', 3), card(21, '♦', 9), card(22, '♥', 2)],
      linked: true,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, items, 1000000, standardDeckComposition(), 'none')
    expect(next.lastDrawEffect).toBe('pattern')
    expect(next.lastBonusGains.some(g => g.label === '護符による直接加算' && g.parts.map(p => p.text).includes(`誠実+${DEFAULT_PARAMS.talismans.sincerity.n}`))).toBe(true)
    // 回帰防止: lastGainとlastBonusGainsの合計が実際のスコア増分と一致することを確認する(二重計上防止)。
    const bonusTotal = next.lastBonusGains.reduce((sum, g) => sum + g.points, 0)
    expect((next.lastGain?.points ?? 0) + bonusTotal).toBe(next.score - wave.score)
  })

  test('素朴+誠実を併用してもlastGain(山札めくり得点)とlastBonusGains(誠実の直接加算)が二重計上されない', () => {
    // Task 3で発見された二重計上バグ(直接加算の値がlastGainの元になる変数にも混入する)は、
    // naive(素朴)による山札めくり得点計算パスを通さないと検知できない回帰テストになるため、
    // 単体のsincerityテストとは別に、naiveを併用したケースを検証する。
    const items: ItemId[] = ['naive', 'sincerity']
    const wave = makeWave({
      foundation: card(0, '♥', 3),
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      stock: [card(9, '♦', 7)],
      chain: [card(20, '♥', 3), card(21, '♦', 9), card(22, '♥', 2)],
      linked: true,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, items, 1000000, standardDeckComposition(), 'none')
    expect(next.lastDrawEffect).toBe('pattern')
    // naiveによる山札めくり得点計算が実際に発生している(lastGainがnullでない)ことを確認した上で、
    // 誠実の直接加算がlastBonusGainsにも別枠で入っていることを確認する。
    expect(next.lastGain).not.toBeNull()
    expect(next.lastGain?.points).toBeGreaterThan(0)
    expect(next.lastBonusGains.some(g => g.label === '護符による直接加算' && g.parts.map(p => p.text).includes(`誠実+${DEFAULT_PARAMS.talismans.sincerity.n}`))).toBe(true)
    const bonusTotal = next.lastBonusGains.reduce((sum, g) => sum + g.points, 0)
    expect((next.lastGain?.points ?? 0) + bonusTotal).toBe(next.score - wave.score)
  })
```

両方を削除し、以下に置き換える:

```ts
  test('誠実: 素朴を併用すると、そのめくりのgained計算にも誠実によるコンボ上昇が反映される', () => {
    const items: ItemId[] = ['naive', 'sincerity']
    const wave = makeWave({
      foundation: card(0, '♥', 3),
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      stock: [card(9, '♦', 7)],
      chain: [card(20, '♥', 3), card(21, '♦', 9), card(22, '♥', 2)],
      linked: true,
    })
    const withoutSincerity = drawStock(DEFAULT_PARAMS, wave, ['naive'], 1000000, standardDeckComposition(), 'none')
    const withSincerity = drawStock(DEFAULT_PARAMS, wave, items, 1000000, standardDeckComposition(), 'none')
    expect(withSincerity.wave.lastDrawEffect).toBe('pattern')
    expect(withSincerity.wave.combo).toBe(withoutSincerity.wave.combo + DEFAULT_PARAMS.talismans.sincerity.n)
    expect(withSincerity.wave.lastGain?.points ?? 0).toBeGreaterThan(withoutSincerity.wave.lastGain?.points ?? 0)
  })

  test('誠実: 素朴を持たなくても、パターン継続のたびコンボは押し上げられる(得点計算は発生しない)', () => {
    const wave = makeWave({
      foundation: card(0, '♥', 3),
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      stock: [card(9, '♦', 7)],
      chain: [card(20, '♥', 3), card(21, '♦', 9), card(22, '♥', 2)],
      linked: true,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['sincerity'], 1000000, standardDeckComposition(), 'none')
    expect(next.lastDrawEffect).toBe('pattern')
    expect(next.lastGain).toBeNull()
    expect(next.combo).toBe(wave.combo + DEFAULT_PARAMS.talismans.sincerity.n)
  })
```

- [ ] **Step 2: テストを実行して失敗することを確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "誠実"`

Expected: FAIL(旧効果のまま`combo`が変化しない、または同スート・階段で発動しない)

- [ ] **Step 3: `drawStock`のパターン継続処理を書き換える**

`src/lib/game/shidasu/engine.ts`内、以下の既存コード(`drawStock`関数内、`patternContinues`ブロックの先頭)を探す:

```ts
  if (patternContinues) {
    const { colorHeld, suitHeld } = analyzeSuitColor([...wave.chain, drawnCard], items)
    const drawContinueCtx: DirectEffectContext = {
      comboBeforeReset: 0,
      hasPlayableColumns: true,
      roleFiredThisChain: false,
      remainingTableauCount: remainingCount(wave.tableau),
      combo: wave.combo,
      colorHeld: colorHeld && !suitHeld,
      previousCombo: wave.combo,
      scoreAfterGained: wave.score,
    }
    // 誠実(drawContinueDirect)はwouldContinue(実際のパターン継続)でのみ発火する。
    // benevolenceFiresによる継続扱いは「本来リセットするところの救済」であり、
    // パターン継続そのものの報酬である誠実の対象にはしない。
    const drawContinueResult = wouldContinue
      ? applyDirectEffects('drawContinueDirect', items, drawContinueCtx, params)
      : { value: 0, parts: [] as ScorePart[] }
    const directGain = drawContinueResult.value
    const newDrawContinueCount = wouldContinue ? wave.drawContinueCountThisChain + 1 : wave.drawContinueCountThisChain
```

以下に置き換える:

```ts
  if (patternContinues) {
    // 誠実: パターン継続全般(同スート・同色・階段問わず)によりコンボが継続したとき、
    // wave.comboに直接+nする(naiveの有無に関わらず適用、次のプレイのeffectiveComboにも反映される)。
    // wouldContinue(実際のパターン継続)でのみ発火する。benevolenceFiresによる継続扱いは
    // 「本来リセットするところの救済」であり、パターン継続そのものの報酬である誠実の対象にはしない。
    const sincerityAdd = wouldContinue && items.includes('sincerity') ? params.talismans.sincerity.n : 0
    const newDrawContinueCount = wouldContinue ? wave.drawContinueCountThisChain + 1 : wave.drawContinueCountThisChain
```

同ブロック内、以下の既存コード(`naiveCombo`初期化)を探す:

```ts
    let naiveGained = 0
    let naiveParts: ScorePart[] = []
    let naiveCombo = wave.combo
```

以下に置き換える:

```ts
    let naiveGained = 0
    let naiveParts: ScorePart[] = []
    let naiveCombo = wave.combo + sincerityAdd
```

同ブロック内、以下の既存コード(`effectiveCombo`計算、naiveブロック内)を探す:

```ts
      // 基礎コンボ数は計算用のコンボ数に常に加算する(素朴パスでは祝福による基礎コンボ数の増加は発生しない)。
      let effectiveCombo = newCombo + wave.baseComboCount
```

以下に置き換える:

```ts
      // 基礎コンボ数は計算用のコンボ数に常に加算する(素朴パスでは祝福による基礎コンボ数の増加は発生しない)。
      let effectiveCombo = newCombo + sincerityAdd + wave.baseComboCount
```

同ブロック内、以下の既存コード(`naiveCombo`更新)を探す:

```ts
      naiveParts = parts
      naiveCombo = newCombo
    }
```

以下に置き換える:

```ts
      naiveParts = parts
      naiveCombo = newCombo + sincerityAdd
    }
```

- [ ] **Step 4: `directGain`の参照を削除し、`continueWave`のscoreを単純化する**

`src/lib/game/shidasu/engine.ts`内、Task 4で変更済みの以下のコード(`patternContinueBonusGains`構築部分)を探す:

```ts
    const patternContinueBonusGains: BonusGain[] = []
    if (drawContinueResult.parts.length > 0) {
      patternContinueBonusGains.push({ label: '護符による直接加算', points: drawContinueResult.value, parts: drawContinueResult.parts })
    }
```

以下に置き換える:

```ts
    const patternContinueBonusGains: BonusGain[] = []
```

同ブロック内、以下の既存コード(`continueWave`構築部分)を探す:

```ts
    const continueWave: WaveState = {
      ...wave,
      stock: items.includes('promise') ? arrangeNextCardForContinuation(params.scoring, newStock, [...wave.chain, drawnCard], effectiveStairMinLen, effectiveSuitColorMinLen, items) : newStock,
      foundation: drawnCard,
      combo: naiveCombo,
      chain: [...wave.chain, drawnCard],
      chainOrigin: [...wave.chainOrigin, 'draw'],
      linked: true,
      lastDrawEffect: drawnCard.wild ? 'wild' : 'pattern',
      lastGain: naiveParts.length > 0 ? { points: naiveGained, parts: naiveParts } : null,
      score: scoreAfterStockEmpty + directGain + naiveGained,
      drawContinueCountThisChain: newDrawContinueCount,
      benevolenceUsedThisCombo: benevolenceFires ? true : wave.benevolenceUsedThisCombo,
      maxComboThisWave: Math.max(wave.maxComboThisWave, naiveCombo),
      roleFiredThisChain: naiveRoleFiredThisChain,
      flushActiveThisCombo: naiveFlushActiveThisCombo,
      lastBonusGains: patternContinueBonusGains,
    }
```

以下に置き換える(`score`計算から`directGain`を削除):

```ts
    const continueWave: WaveState = {
      ...wave,
      stock: items.includes('promise') ? arrangeNextCardForContinuation(params.scoring, newStock, [...wave.chain, drawnCard], effectiveStairMinLen, effectiveSuitColorMinLen, items) : newStock,
      foundation: drawnCard,
      combo: naiveCombo,
      chain: [...wave.chain, drawnCard],
      chainOrigin: [...wave.chainOrigin, 'draw'],
      linked: true,
      lastDrawEffect: drawnCard.wild ? 'wild' : 'pattern',
      lastGain: naiveParts.length > 0 ? { points: naiveGained, parts: naiveParts } : null,
      score: scoreAfterStockEmpty + naiveGained,
      drawContinueCountThisChain: newDrawContinueCount,
      benevolenceUsedThisCombo: benevolenceFires ? true : wave.benevolenceUsedThisCombo,
      maxComboThisWave: Math.max(wave.maxComboThisWave, naiveCombo),
      roleFiredThisChain: naiveRoleFiredThisChain,
      flushActiveThisCombo: naiveFlushActiveThisCombo,
      lastBonusGains: patternContinueBonusGains,
    }
```

- [ ] **Step 5: 不要になった`analyzeSuitColor`のimportを削除する**

`src/lib/game/shidasu/engine.ts`の先頭、以下の既存importを探す:

```ts
import { isFace, chainContinuesPattern, evaluateChainBonus, analyzeSuitColor, countSameRankBefore, countSameRankForWildPlay, cardColors } from './patterns'
```

以下に置き換える(`analyzeSuitColor`を削除。誠実が唯一の使用箇所だったため):

```ts
import { isFace, chainContinuesPattern, evaluateChainBonus, countSameRankBefore, countSameRankForWildPlay, cardColors } from './patterns'
```

- [ ] **Step 6: テストを実行してパスすることを確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "誠実"`

Expected: PASS

- [ ] **Step 7: 型チェックと全体テストを実行する**

Run: `npm run check && npx vitest run src/lib/game/shidasu/engine.test.ts`

Expected: 両方PASS(この時点で6護符すべての新効果が実装され、旧`applyDirectEffects`呼び出しはengine.ts内から完全に消えている)

- [ ] **Step 8: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 誠実をコンボ直接押し上げ型に再実装し、トリガーをパターン継続全般に拡張"
```

---

### Task 7: `directEffects.ts`一式の削除

**Files:**
- Delete: `src/lib/game/shidasu/directEffects.ts`
- Delete: `src/lib/game/shidasu/directEffects.test.ts`
- Modify: `src/lib/game/shidasu/testHelpers.ts`
- Modify: `src/lib/game/shidasu/engine.ts`

- [ ] **Step 1: engine.ts内に`applyDirectEffects`・`DirectEffectContext`の参照が残っていないことを確認する**

Run: `grep -n "applyDirectEffects\|DirectEffectContext\|DirectChannel" src/lib/game/shidasu/engine.ts`

Expected: 何も出力されない(Task 3〜6で全ての呼び出し箇所を削除済みのため)。もし出力がある場合、その箇所を先に削除してから次のステップに進む。

- [ ] **Step 2: `directEffects.ts`・`directEffects.test.ts`を削除する**

```bash
rm src/lib/game/shidasu/directEffects.ts src/lib/game/shidasu/directEffects.test.ts
```

- [ ] **Step 3: `engine.ts`先頭のimport文を削除する**

`src/lib/game/shidasu/engine.ts`の先頭、以下の既存importを探す:

```ts
import { applyDirectEffects, type DirectEffectContext } from './directEffects'
```

この行を削除する。

- [ ] **Step 4: `testHelpers.ts`から`directCtx`ヘルパーを削除する**

`src/lib/game/shidasu/testHelpers.ts`の内容を以下に置き換える:

```ts
// src/lib/game/shidasu/testHelpers.ts
import type { Card } from './types'
import type { ItemEffectContext } from './itemEffects'
import { DEFAULT_PARAMS } from './params'

export function card(id: number, suit: Card['suit'], rank: Card['rank'], wild = false, deckId = id): Card {
  return { id, deckId, suit, rank, wild }
}

export function ctx(overrides: Partial<ItemEffectContext> = {}, params = DEFAULT_PARAMS): ItemEffectContext {
  return {
    card: card(1, '♠', 5),
    previousFoundation: card(2, '♣', 4),
    combo: 1,
    stockRemaining: 0,
    chain: [card(2, '♣', 4), card(1, '♠', 5)],
    remainingTableauCount: 10,
    chainBonus: { bonus: 0, parts: [], patternFired: false, patternFiredCount: 0, roleFired: [] },
    isFirstPlayOfWave: false,
    isPlayAction: true,
    playCountInChain: 1,
    effectiveStairMinLen: params.scoring.stairMinLen,
    effectiveSuitColorMinLen: params.scoring.suitColorMinLen,
    sameColumnStreak: 1,
    totalColumnsEmptiedThisWave: 0,
    maxComboThisWave: 1,
    flushActiveThisCombo: false,
    columnSweepActiveThisWave: false,
    drawContinueCountThisChain: 0,
    mercyActiveNextCombo: false,
    items: [],
    ...overrides,
  }
}
```

- [ ] **Step 5: 型チェックとテスト全体を実行する**

Run: `npm run check && npx vitest run src/lib/game/shidasu`

Expected: 両方PASS(`directCtx`を参照していたテストは全てTask 3〜6で書き換え済みのはず)

- [ ] **Step 6: コミット**

```bash
git add -A src/lib/game/shidasu/directEffects.ts src/lib/game/shidasu/directEffects.test.ts src/lib/game/shidasu/testHelpers.ts src/lib/game/shidasu/engine.ts
git commit -m "refactor: 直接点護符の廃止に伴いdirectEffects.ts一式を削除"
```

---

### Task 8: `itemActualEffects.ts`の説明文更新

**Files:**
- Modify: `src/lib/game/shidasu/itemActualEffects.ts`

- [ ] **Step 1: 該当6エントリの説明文を新効果に合わせて書き換える**

`src/lib/game/shidasu/itemActualEffects.ts`内、以下の既存コードを探す:

```ts
  // グループ11: イベント発生時の直接点
  composure: 'drawStockの通常コンボリセット時、リセット後にプレイ可能な列が無ければ、直接nを加算する',
  clarity: 'drawStockの通常コンボリセット時、そのチェーン中に役が一度も成立していなければ、直接nを加算する',
  arrogance: '山札を引いた結果、山札が0枚になった瞬間、場札残り枚数×xを直接加算する',
  echo: 'drawStockの通常コンボリセット時、リセット前のコンボ数×nを直接加算する(全消し・手詰まりによるリセットは対象外)',
  shootingStar: '獲得点加算後のコンボ数が初めてc以上に達した瞬間、その時点のスコア×p%を直接加算する',
```

以下に置き換える:

```ts
  // グループ11: イベント発生時のbaseComboCount/echoX/shootingStarN強化
  composure: 'drawStockの通常コンボリセット時、リセット後にプレイ可能な列が無ければ、baseComboCountに永続でnを加算する',
  clarity: 'drawStockの通常コンボリセット時、そのチェーン中に役が一度も成立していなければ、baseComboCountに永続でnを加算する',
  arrogance: 'playCardの獲得点計算時、山札が0枚なら獲得点をx倍にする',
  echo: 'drawStockの通常コンボリセット時、リセット前のコンボ数×nを永続倍率echoXとして蓄積し、以後の獲得点に乗算する(全消し・手詰まりによるリセットは対象外)',
  shootingStar: 'コンボ数が初めてc以上に達するたび、永続加算shootingStarNにnを蓄積し、以後の獲得点に加算する(到達した同じプレイの獲得点には反映されない)',
```

同ファイル内、以下の既存コードを探す:

```ts
  sincerity: '山札めくりでパターンが継続し、かつ同色だが同スートではない場合、直接nを加算する(博愛による救済継続では発動しない)',
```

以下に置き換える:

```ts
  sincerity: '山札めくりでパターンが実際に継続する場合(同スート・同色・階段いずれでも、博愛による救済継続を除く)、wave.comboに直接nを加算する(naiveの有無に関わらず適用され、次のプレイのeffectiveComboに反映される)',
```

- [ ] **Step 2: 型チェックを実行する**

Run: `npm run check`

Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/lib/game/shidasu/itemActualEffects.ts
git commit -m "docs: 直接点護符6個のitemActualEffects説明文を新効果に更新"
```

---

## 全タスク完了後の確認

- [ ] `npm run build`を実行し、ビルドが通ることを確認する
- [ ] `npm run check`を実行し、型エラーが無いことを確認する
- [ ] `npx vitest run`でリポジトリ全体のテストスイートを実行し、全てPASSすることを確認する
- [ ] `npm run dev`で開発サーバーを起動し、`/admin/shidasu-debug`から沈着・冷静・残響・慢心・流星・誠実の6護符を実際に所持した状態でプレイし、想定通りの効果(baseComboCount変化・echoX/shootingStarN蓄積・慢心の倍率・誠実のコンボ押し上げ)が発生することを目視確認する
