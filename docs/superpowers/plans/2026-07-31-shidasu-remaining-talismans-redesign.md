# 未実装護符(グループ18〜22)の再設計 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 未実装だった護符5種(献身・勤勉・加護・剛毅・新規「水鏡」)を新規実装し、既存護符`mirror`の表示名を「水鏡」から「鋼鉄」へ変更する。

**Architecture:** 献身・勤勉・加護は「役成立ごとに永続的に積み上がる倍率カウンタ」という共通の型を持つため、`WaveState`にカウンタ3個を追加し、Wave開始時に`RunState`からコピー、Waveクリア確定時(`resolveWaveEnd`)に`RunState`へ書き戻す方式(`oracleLevels`と似ているが、更新は`playCard`内のみで完結するため`RunState`側の同時更新は不要)で実装する。剛毅は`startWave`内で完結する単発計算。新規「水鏡」は`itemEffects.ts`の`applyItemEffects`のreduceロジックにインデックス参照を追加して実装する。

**Tech Stack:** SvelteKit, TypeScript, Vitest

---

### Task 1: 既存護符`mirror`の表示名を「水鏡」から「鋼鉄」へ変更

**Files:**
- Modify: `src/lib/game/shidasu/params.ts:370`
- Modify: `src/lib/game/shidasu/shidasu.config.json:678-683`(`mirror`エントリの`name`)

- [ ] **Step 1: params.tsのDEFAULT_PARAMSでmirrorの名前を変更する**

`src/lib/game/shidasu/params.ts`370行目、以下のように変更する。

変更前:
```ts
    mirror: { name: '水鏡', rarity: 'R', desc: '役が成立するたび(コンボ中1回、同ランクは枚数ごとに1回)、次のプレイで同じ役ボーナスを追加でもう一度加算する' },
```

変更後:
```ts
    mirror: { name: '鋼鉄', rarity: 'R', desc: '役が成立するたび(コンボ中1回、同ランクは枚数ごとに1回)、次のプレイで同じ役ボーナスを追加でもう一度加算する' },
```

- [ ] **Step 2: shidasu.config.jsonでmirrorの名前を変更する**

`src/lib/game/shidasu/shidasu.config.json`の`mirror`エントリ(682行目付近)、`"name": "水鏡"`を`"name": "鋼鉄"`に変更する。

- [ ] **Step 3: 型チェック・テストを実行する**

Run: `npm run check`
Expected: エラーなし(`name`は文字列型のため型エラーは発生しない)

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "水鏡"`
Expected: 既存の4件(`mirror`の効果テスト)はテスト名に「水鏡」と書かれたままだがロジック自体は変更していないためPASSする

- [ ] **Step 4: Commit**

```bash
git add src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json
git commit -m "feat: 護符mirrorの表示名を水鏡から鋼鉄に変更"
```

---

### Task 2: 献身・勤勉・加護の共通基盤(WaveState/RunStateへのカウンタ追加)と献身の実装

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`(`WaveState`・`RunState`にフィールド追加、`ItemId`に新規3種追加)
- Modify: `src/lib/game/shidasu/params.ts`(`ShidasuParams.talismans`型・`DEFAULT_PARAMS`に3種追加)
- Modify: `src/lib/game/shidasu/shidasu.config.json`(`talismans`に3種追加)
- Modify: `src/lib/game/shidasu/itemGroups.ts`(グループ18に3種追加)
- Modify: `src/lib/game/shidasu/items.ts`(ITEM_POOL相当の一覧に3種追加)
- Modify: `src/lib/game/shidasu/itemActualEffects.ts`(効果の実際の説明文に3種追加)
- Modify: `src/lib/game/shidasu/engine.ts`(`startWave`・`resolveWaveEnd`・`playCard`に累積カウンタの初期化・同期・加算ロジックを追加)
- Test: `src/lib/game/shidasu/engine.test.ts`

このタスクでは3種すべての型・データ定義の土台を作った上で、献身(フラッシュ用カウンタ)のみを先に動作させる。勤勉・加護はTask 3・4で同じ基盤に乗せる。

- [ ] **Step 1: types.tsにItemIdを3種追加する**

`src/lib/game/shidasu/types.ts`の`ItemId`型の末尾(63行目付近、`| 'morningStar' | 'mercy' | 'mirror' | 'deadline'`の行)に、以下を追記する。

変更前:
```ts
  | 'morningStar' | 'mercy' | 'mirror' | 'deadline'
```

変更後:
```ts
  | 'morningStar' | 'mercy' | 'mirror' | 'deadline'
  | 'dedication' | 'diligence' | 'divineProtection'
```

`protection`は既存の「庇護」で使用済みのため、「加護」の新規IDは`divineProtection`とする。

- [ ] **Step 2: WaveStateに累積カウンタ3個を追加する**

`src/lib/game/shidasu/types.ts`の`WaveState`インターフェース、`baseComboCount: number`の行の直後(185行目付近、水鏡用フィールドの直前)に以下を追加する。

```ts
  // 献身・勤勉・加護用: 護符ごとの累積倍率(xは1から開始、対象役が成立するたびx+=nされる)。
  // ラン全体で永続する値だが、playCard内でのみ更新されるためWaveState側に正本を持ち、
  // startWaveでRunStateからコピー・resolveWaveEndでRunStateへ書き戻す。
  dedicationX: number
  diligenceX: number
  divineProtectionX: number
```

- [ ] **Step 3: RunStateに永続カウンタ3個を追加する**

`src/lib/game/shidasu/types.ts`の`RunState`インターフェース、`currency: number`の行の直後(291行目付近)に以下を追加する。

```ts
  // 献身・勤勉・加護の累積倍率の永続値。WaveState側のdedicationX等の正本。
  // beginRunで1に初期化され、resolveWaveEnd成功時にwaveの値で更新される。
  dedicationX: number
  diligenceX: number
  divineProtectionX: number
```

- [ ] **Step 4: params.tsのShidasuParams型に3種を追加する**

`src/lib/game/shidasu/params.ts`の`talismans`型定義、`mirror: { name: string; rarity: Rarity; desc: string }`の行の直後(158行目付近)に以下を追加する。

```ts
    dedication: { name: string; n: number; rarity: Rarity; desc: string }
    diligence: { name: string; n: number; rarity: Rarity; desc: string }
    divineProtection: { name: string; n: number; rarity: Rarity; desc: string }
```

- [ ] **Step 5: params.tsのDEFAULT_PARAMSに3種の実データを追加する**

`src/lib/game/shidasu/params.ts`の`DEFAULT_PARAMS.talismans`、`mirror: { name: '鋼鉄', ... }`の行の直後(370行目付近)に以下を追加する。

```ts
    dedication: { name: '献身', n: 0.01, rarity: 'R', desc: 'x倍算。xは1から開始し、この護符を所持してからフラッシュが成立するたびx+={n}される' },
    diligence: { name: '勤勉', n: 0.01, rarity: 'R', desc: 'x倍算。xは1から開始し、この護符を所持してから同ランクが成立するたびx+={n}される' },
    divineProtection: { name: '加護', n: 0.01, rarity: 'R', desc: 'x倍算。xは1から開始し、この護符を所持してからロイヤルセットが成立するたびx+={n}される' },
```

- [ ] **Step 6: shidasu.config.jsonに3種の実データを追加する**

`src/lib/game/shidasu/shidasu.config.json`の`talismans`オブジェクト内、`mirror`エントリの直後に以下を追加する(既存の`mirror`エントリの直後、カンマ区切りに注意)。

```json
      "dedication": { "name": "献身", "n": 0.01, "rarity": "R", "desc": "x倍算。xは1から開始し、この護符を所持してからフラッシュが成立するたびx+={n}される" },
      "diligence": { "name": "勤勉", "n": 0.01, "rarity": "R", "desc": "x倍算。xは1から開始し、この護符を所持してから同ランクが成立するたびx+={n}される" },
      "divineProtection": { "name": "加護", "n": 0.01, "rarity": "R", "desc": "x倍算。xは1から開始し、この護符を所持してからロイヤルセットが成立するたびx+={n}される" },
```

- [ ] **Step 7: itemGroups.tsのグループ18に3種を追加する**

`src/lib/game/shidasu/itemGroups.ts`27行目、`{ label: 'グループ17: コアパラメータ書き換え', ids: [...] }`の行の直後に以下を追加する。

```ts
  { label: 'グループ18: 判定ロジック内部干渉', ids: ['dedication', 'diligence', 'divineProtection'] },
```

- [ ] **Step 8: items.tsのITEM_POOLに3種を追加する**

`src/lib/game/shidasu/items.ts`の`ITEM_POOL`配列(32行目付近、`'morningStar', 'mercy', 'mirror', 'deadline',`の行)の直後に以下を追加する。

```ts
  'dedication', 'diligence', 'divineProtection',
```

- [ ] **Step 9: startWaveでdedicationX等をRunStateからWaveStateへコピーする**

`src/lib/game/shidasu/engine.ts`の`startWave`関数シグネチャ(108-117行目)に、以下の3引数を追加する。

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
  oracleLevels: Record<RoleName, number> = defaultOracleLevels()
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
  divineProtectionX: number = 1
): { wave: WaveState; deckComposition: DeckCard[] } {
```

同関数内、`WaveState`オブジェクトリテラル(146-174行目付近)、`baseComboCount: 0,`の行の直後に以下を追加する。

```ts
    dedicationX,
    diligenceX,
    divineProtectionX,
```

- [ ] **Step 10: startWaveの呼び出し元2箇所を更新する**

`src/lib/game/shidasu/engine.ts`1118行目・1126行目、`startWave(params, ...)`の呼び出しに`run.dedicationX, run.diligenceX, run.divineProtectionX`を追加する。

変更前(1118行目):
```ts
  const { wave } = startWave(params, 0, 0, run.items, run.deckComposition, seed, run.extraTableauRows, run.oracleLevels)
```

変更後:
```ts
  const { wave } = startWave(params, 0, 0, run.items, run.deckComposition, seed, run.extraTableauRows, run.oracleLevels, run.dedicationX, run.diligenceX, run.divineProtectionX)
```

変更前(1126行目):
```ts
  const { wave, deckComposition } = startWave(params, run.stageIndex, run.waveIndex, run.items, run.deckComposition, seed, run.extraTableauRows, run.oracleLevels)
```

変更後:
```ts
  const { wave, deckComposition } = startWave(params, run.stageIndex, run.waveIndex, run.items, run.deckComposition, seed, run.extraTableauRows, run.oracleLevels, run.dedicationX, run.diligenceX, run.divineProtectionX)
```

- [ ] **Step 11: createInitialRunとbeginRunにdedicationX等の初期値を追加する**

`src/lib/game/shidasu/engine.ts`の`createInitialRun`関数(1011-1020行目)、`currency: 0,`の行の直後に以下を追加する。

変更前:
```ts
export function createInitialRun(): RunState {
  return {
    phase: 'title', stageIndex: 0, waveIndex: 0, items: [], offer: [], wave: null, waveGeneration: 0, pendingNewItem: null,
    deckComposition: standardDeckComposition(), rites: [], revelations: [], revelationOffer: [], extraTableauRows: 0,
    oracleLevels: defaultOracleLevels(), oracleOffer: [], spreadId: 'fool',
    stageStars: [], currency: 0,
    oracles: [], shop: null, offerPickRemaining: 0, riteOffer: [],
    pendingNewRite: null, pendingNewRevelation: null, pendingNewOracle: null,
  }
}
```

変更後:
```ts
export function createInitialRun(): RunState {
  return {
    phase: 'title', stageIndex: 0, waveIndex: 0, items: [], offer: [], wave: null, waveGeneration: 0, pendingNewItem: null,
    deckComposition: standardDeckComposition(), rites: [], revelations: [], revelationOffer: [], extraTableauRows: 0,
    oracleLevels: defaultOracleLevels(), oracleOffer: [], spreadId: 'fool',
    stageStars: [], currency: 0,
    dedicationX: 1, diligenceX: 1, divineProtectionX: 1,
    oracles: [], shop: null, offerPickRemaining: 0, riteOffer: [],
    pendingNewRite: null, pendingNewRevelation: null, pendingNewOracle: null,
  }
}
```

`beginRun`関数(1022-1053行目)、`currency: params.currency.initialAmount,`の行の直後に以下を追加する。

```ts
    dedicationX: 1,
    diligenceX: 1,
    divineProtectionX: 1,
```

- [ ] **Step 12: resolveWaveEndでdedicationX等をWaveStateからRunStateへ書き戻す**

`src/lib/game/shidasu/engine.ts`の`resolveWaveEnd`関数(1055-1068行目)、`const runWithCurrency = { ...run, currency: run.currency + earned }`の行を以下のように変更する。

変更前:
```ts
  const currentStar = run.stageStars[run.waveIndex]
  const earned = params.currency.waveClearAmount + (currentStar?.reward ?? 0)
  const runWithCurrency = { ...run, currency: run.currency + earned }
```

変更後:
```ts
  const currentStar = run.stageStars[run.waveIndex]
  const earned = params.currency.waveClearAmount + (currentStar?.reward ?? 0)
  const runWithCurrency = {
    ...run,
    currency: run.currency + earned,
    dedicationX: wave.dedicationX,
    diligenceX: wave.diligenceX,
    divineProtectionX: wave.divineProtectionX,
  }
```

- [ ] **Step 13: playCard内でdedicationXをフラッシュ成立時に加算する**

まず失敗するテストを書く。`makeWave`ヘルパー(93-140行目付近)の返り値オブジェクトに、`baseComboCount: 0,`の行の直後、以下の3行を追加する(オーバーライド機構は`{ ...base, ...overrides }`ではなく個別フィールド列挙なので、単純にデフォルト値を持つフィールドとして追加する。実際の`makeWave`の実装を読み、`overrides`の適用方法に合わせること)。

```ts
    dedicationX: 1,
    diligenceX: 1,
    divineProtectionX: 1,
```

`src/lib/game/shidasu/engine.test.ts`の`describe('sellItem / ...')`ブロックの直前(3020行目付近)に以下を追加する。フラッシュは`checkFlush`(`patterns.ts:99`)により「直近4枚が4スート全て揃う」ことで成立する。`chain`に♠♥♦の3枚を積んだ状態で、場札から♣を取ることでフラッシュを成立させる。

```ts
describe('献身(dedication): フラッシュ成立ごとにdedicationXが積み上がりx倍算', () => {
  test('フラッシュ成立プレイの直後、dedicationXが0.01加算される', () => {
    const wave = makeWave({
      foundation: card(0, '♠', 1),
      chain: [card(0, '♠', 1), card(20, '♥', 2), card(21, '♦', 3)],
      tableau: [[card(1, '♣', 4)], [card(2, '♦', 2)]],
      dedicationX: 1,
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['dedication'], 1000000, 0, standardDeckComposition())
    expect(next.dedicationX).toBeCloseTo(1 + DEFAULT_PARAMS.talismans.dedication.n)
  })

  test('献身を所持していなければdedicationXは変化しない', () => {
    const wave = makeWave({
      foundation: card(0, '♠', 1),
      chain: [card(0, '♠', 1), card(20, '♥', 2), card(21, '♦', 3)],
      tableau: [[card(1, '♣', 4)], [card(2, '♦', 2)]],
      dedicationX: 1,
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(next.dedicationX).toBe(1)
  })

  test('フラッシュが成立しないプレイではdedicationXは変化しない', () => {
    const wave = makeWave({
      foundation: card(0, '♠', 1),
      chain: [card(0, '♠', 1)],
      tableau: [[card(1, '♠', 4)], [card(2, '♦', 2)]],
      dedicationX: 1,
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['dedication'], 1000000, 0, standardDeckComposition())
    expect(next.dedicationX).toBe(1)
  })
})
```

- [ ] **Step 14: テストを実行して失敗を確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "献身"`
Expected: FAIL(`WaveState`に`dedicationX`が存在せず型エラー、または実行時に`next.dedicationX`が`undefined`になりアサーション失敗)

- [ ] **Step 15: playCard内にdedicationXの加算ロジックとgained計算への反映を実装する**

`src/lib/game/shidasu/engine.ts`の`playCard`関数内、`roleFired`が確定した後(453行目の祝福処理付近、`newBaseComboCount`の直後)に以下を追加する。

```ts
  // 献身: フラッシュ成立のたびdedicationXにnを加算する(永続的に積み上がる)
  const newDedicationX = items.includes('dedication') && roleFired.some(r => r.name === 'flush')
    ? wave.dedicationX + params.talismans.dedication.n
    : wave.dedicationX
```

`gained`の計算箇所(504行目付近、`let gained = Math.floor(itemResult.value * multiplier * mannazFactor)`)を以下のように変更する。

変更前:
```ts
  const mannazFactor = wave.mannazActiveThisWave ? 1 + mannazWeightSum(items, params) * params.rites.mannaz.x : 1
  if (mannazFactor !== 1) parts.push(multiplyPart('マンナズ', mannazFactor))
  let gained = Math.floor(itemResult.value * multiplier * mannazFactor)
```

変更後:
```ts
  const mannazFactor = wave.mannazActiveThisWave ? 1 + mannazWeightSum(items, params) * params.rites.mannaz.x : 1
  if (mannazFactor !== 1) parts.push(multiplyPart('マンナズ', mannazFactor))
  const dedicationFactor = items.includes('dedication') ? wave.dedicationX : 1
  if (dedicationFactor !== 1) parts.push(multiplyPart('献身', dedicationFactor))
  let gained = Math.floor(itemResult.value * multiplier * mannazFactor * dedicationFactor)
```

`playCard`関数の返り値である新しい`WaveState`オブジェクト(`newWave`のようなローカル変数、`baseComboCount: newBaseComboCount,`を含む箇所)に、以下を追加する。

```ts
    dedicationX: newDedicationX,
```

(この時点では`diligenceX`・`divineProtectionX`は`wave.diligenceX`・`wave.divineProtectionX`をそのまま引き継ぐ形にする。Task 3・4で加算ロジックを追加する)

- [ ] **Step 16: テストを実行して成功を確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "献身"`
Expected: PASS(3件とも)

- [ ] **Step 17: 全体テスト・型チェックを実行する**

Run: `npx vitest run`
Expected: 全件PASS

Run: `npm run check`
Expected: shidasu関連のエラー0件

- [ ] **Step 18: Commit**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/itemGroups.ts src/lib/game/shidasu/items.ts src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 献身・勤勉・加護の基盤とdedication(献身)の効果を実装"
```

---

### Task 3: 勤勉(diligence)の実装

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Test: `src/lib/game/shidasu/engine.test.ts`

Task 2で作った基盤(`WaveState.diligenceX`・`RunState.diligenceX`・`startWave`引数・`resolveWaveEnd`書き戻し)は既に用意済み。`playCard`内の加算ロジックのみを追加する。

- [ ] **Step 1: 失敗するテストを書く**

`engine.test.ts`の献身のdescribeブロックの直後に、以下を追加する。同ランクは`countSameRankBefore`(`patterns.ts:118`)により「チェーン内に既に同じランクが1枚以上ある」ことで成立する。`chain`にランク7のカードを1枚積んだ状態で、場札からランク7のカードを取ることで同ランクを成立させる。

```ts
describe('勤勉(diligence): 同ランク成立ごとにdiligenceXが積み上がりx倍算', () => {
  test('同ランク成立プレイの直後、diligenceXが0.01加算される', () => {
    const wave = makeWave({
      foundation: card(0, '♠', 1),
      chain: [card(0, '♠', 1), card(20, '♥', 7)],
      tableau: [[card(1, '♦', 7)], [card(2, '♦', 2)]],
      diligenceX: 1,
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['diligence'], 1000000, 0, standardDeckComposition())
    expect(next.diligenceX).toBeCloseTo(1 + DEFAULT_PARAMS.talismans.diligence.n)
  })

  test('勤勉を所持していなければdiligenceXは変化しない', () => {
    const wave = makeWave({
      foundation: card(0, '♠', 1),
      chain: [card(0, '♠', 1), card(20, '♥', 7)],
      tableau: [[card(1, '♦', 7)], [card(2, '♦', 2)]],
      diligenceX: 1,
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(next.diligenceX).toBe(1)
  })

  test('同ランクが成立しないプレイではdiligenceXは変化しない', () => {
    const wave = makeWave({
      foundation: card(0, '♠', 1),
      chain: [card(0, '♠', 1)],
      tableau: [[card(1, '♦', 9)], [card(2, '♦', 2)]],
      diligenceX: 1,
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['diligence'], 1000000, 0, standardDeckComposition())
    expect(next.diligenceX).toBe(1)
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "勤勉"`
Expected: FAIL(`next.diligenceX`が常に`wave.diligenceX`のまま変化しない)

- [ ] **Step 3: playCard内にdiligenceXの加算ロジックを実装する**

`src/lib/game/shidasu/engine.ts`のTask 2 Step 16で追加した`newDedicationX`の直後に以下を追加する。

```ts
  // 勤勉: 同ランク成立のたびdiligenceXにnを加算する(永続的に積み上がる)
  const newDiligenceX = items.includes('diligence') && roleFired.some(r => r.name === 'sameRank')
    ? wave.diligenceX + params.talismans.diligence.n
    : wave.diligenceX
```

`gained`計算箇所の`dedicationFactor`の直後に以下を追加する。

```ts
  const diligenceFactor = items.includes('diligence') ? wave.diligenceX : 1
  if (diligenceFactor !== 1) parts.push(multiplyPart('勤勉', diligenceFactor))
```

`gained`の計算式に`diligenceFactor`を掛け合わせるよう変更する。

変更前:
```ts
  let gained = Math.floor(itemResult.value * multiplier * mannazFactor * dedicationFactor)
```

変更後:
```ts
  let gained = Math.floor(itemResult.value * multiplier * mannazFactor * dedicationFactor * diligenceFactor)
```

`WaveState`の返り値オブジェクトの`dedicationX: newDedicationX,`の直後に以下を追加する。

```ts
    diligenceX: newDiligenceX,
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "勤勉"`
Expected: PASS

- [ ] **Step 5: 全体テスト・型チェックを実行する**

Run: `npx vitest run`
Expected: 全件PASS

Run: `npm run check`
Expected: shidasu関連のエラー0件

- [ ] **Step 6: Commit**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 勤勉(diligence)の効果を実装"
```

---

### Task 4: 加護(divineProtection)の実装

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`engine.test.ts`の勤勉のdescribeブロックの直後に、以下を追加する。ロイヤルセットは`checkRoyalSet`(`patterns.ts:108`)により「直近3枚がJ・Q・K」で成立する。`chain`にJ・Qの2枚を積んだ状態で、場札からKを取ることでロイヤルセットを成立させる。

```ts
describe('加護(divineProtection): ロイヤルセット成立ごとにdivineProtectionXが積み上がりx倍算', () => {
  test('ロイヤルセット成立プレイの直後、divineProtectionXが0.01加算される', () => {
    const wave = makeWave({
      foundation: card(0, '♠', 1),
      chain: [card(20, '♥', 11), card(21, '♦', 12)],
      tableau: [[card(1, '♣', 13)], [card(2, '♦', 2)]],
      divineProtectionX: 1,
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['divineProtection'], 1000000, 0, standardDeckComposition())
    expect(next.divineProtectionX).toBeCloseTo(1 + DEFAULT_PARAMS.talismans.divineProtection.n)
  })

  test('加護を所持していなければdivineProtectionXは変化しない', () => {
    const wave = makeWave({
      foundation: card(0, '♠', 1),
      chain: [card(20, '♥', 11), card(21, '♦', 12)],
      tableau: [[card(1, '♣', 13)], [card(2, '♦', 2)]],
      divineProtectionX: 1,
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(next.divineProtectionX).toBe(1)
  })

  test('ロイヤルセットが成立しないプレイではdivineProtectionXは変化しない', () => {
    const wave = makeWave({
      foundation: card(0, '♠', 1),
      chain: [card(0, '♠', 1)],
      tableau: [[card(1, '♦', 9)], [card(2, '♦', 2)]],
      divineProtectionX: 1,
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['divineProtection'], 1000000, 0, standardDeckComposition())
    expect(next.divineProtectionX).toBe(1)
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "加護"`
Expected: FAIL(`next.divineProtectionX`が常に`wave.divineProtectionX`のまま変化しない)

- [ ] **Step 3: playCard内にdivineProtectionXの加算ロジックを実装する**

`src/lib/game/shidasu/engine.ts`のTask 3で追加した`newDiligenceX`の直後に以下を追加する。

```ts
  // 加護: ロイヤルセット成立のたびdivineProtectionXにnを加算する(永続的に積み上がる)
  const newDivineProtectionX = items.includes('divineProtection') && roleFired.some(r => r.name === 'royalSet')
    ? wave.divineProtectionX + params.talismans.divineProtection.n
    : wave.divineProtectionX
```

`diligenceFactor`の直後に以下を追加する。

```ts
  const divineProtectionFactor = items.includes('divineProtection') ? wave.divineProtectionX : 1
  if (divineProtectionFactor !== 1) parts.push(multiplyPart('加護', divineProtectionFactor))
```

`gained`の計算式を以下のように変更する。

変更前:
```ts
  let gained = Math.floor(itemResult.value * multiplier * mannazFactor * dedicationFactor * diligenceFactor)
```

変更後:
```ts
  let gained = Math.floor(itemResult.value * multiplier * mannazFactor * dedicationFactor * diligenceFactor * divineProtectionFactor)
```

`WaveState`の返り値オブジェクトの`diligenceX: newDiligenceX,`の直後に以下を追加する。

```ts
    divineProtectionX: newDivineProtectionX,
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "加護"`
Expected: PASS

- [ ] **Step 5: 全体テスト・型チェックを実行する**

Run: `npx vitest run`
Expected: 全件PASS

Run: `npm run check`
Expected: shidasu関連のエラー0件

- [ ] **Step 6: Commit**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 加護(divineProtection)の効果を実装"
```

---

### Task 5: 剛毅(fortitude)の実装

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`(`ItemId`に追加)
- Modify: `src/lib/game/shidasu/params.ts`(型・DEFAULT_PARAMSに追加)
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Modify: `src/lib/game/shidasu/itemGroups.ts`
- Modify: `src/lib/game/shidasu/items.ts`
- Modify: `src/lib/game/shidasu/engine.ts`(`startWave`)
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: types.tsにItemIdを追加する**

`src/lib/game/shidasu/types.ts`のTask 2 Step 1で追加した行を以下のように変更する。

変更前:
```ts
  | 'dedication' | 'diligence' | 'divineProtection'
```

変更後:
```ts
  | 'dedication' | 'diligence' | 'divineProtection'
  | 'fortitude'
```

- [ ] **Step 2: params.tsのShidasuParams型に追加する**

`src/lib/game/shidasu/params.ts`のTask 2 Step 4で追加した`divineProtection`の行の直後に以下を追加する。

```ts
    fortitude: { name: string; n: number; rarity: Rarity; desc: string }
```

- [ ] **Step 3: params.tsのDEFAULT_PARAMSに追加する**

`src/lib/game/shidasu/params.ts`のTask 2 Step 5で追加した`divineProtection`の行の直後に以下を追加する。

```ts
    fortitude: { name: '剛毅', n: 30, rarity: 'R', desc: 'Wave開始時、山札と場札の合計枚数が{n}枚ごとに基礎コンボ数+1される' },
```

- [ ] **Step 4: shidasu.config.jsonに追加する**

`src/lib/game/shidasu/shidasu.config.json`のTask 2 Step 6で追加した`divineProtection`エントリの直後に以下を追加する。

```json
      "fortitude": { "name": "剛毅", "n": 30, "rarity": "R", "desc": "Wave開始時、山札と場札の合計枚数が{n}枚ごとに基礎コンボ数+1される" },
```

- [ ] **Step 5: itemGroups.tsのグループ18に追加する**

`src/lib/game/shidasu/itemGroups.ts`のTask 2 Step 7で追加したグループ18の行を以下のように変更する。

変更前:
```ts
  { label: 'グループ18: 判定ロジック内部干渉', ids: ['dedication', 'diligence', 'divineProtection'] },
```

変更後:
```ts
  { label: 'グループ18: 判定ロジック内部干渉', ids: ['dedication', 'diligence', 'divineProtection', 'fortitude'] },
```

- [ ] **Step 6: items.tsのITEM_POOLに追加する**

`src/lib/game/shidasu/items.ts`のTask 2 Step 8で追加した行の直後に以下を追加する。

```ts
  'fortitude',
```

- [ ] **Step 7: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`で`startWave`の既存テスト(`describe('startWave'`または類似)を探し、その直後に以下を追加する。

```ts
describe('剛毅(fortitude): Wave開始時、山札+場札の合計枚数に応じてbaseComboCountが加算される', () => {
  test('デッキ枚数が30枚未満なら加算なし', () => {
    const smallDeck = standardDeckComposition().slice(0, 29)
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, ['fortitude'], smallDeck, 1)
    expect(wave.baseComboCount).toBe(0)
  })

  test('デッキ枚数が30〜59枚ならbaseComboCount+1', () => {
    const midDeck = standardDeckComposition().slice(0, 40)
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, ['fortitude'], midDeck, 1)
    expect(wave.baseComboCount).toBe(1)
  })

  test('剛毅を所持していなければ加算されない', () => {
    const midDeck = standardDeckComposition().slice(0, 40)
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, [], midDeck, 1)
    expect(wave.baseComboCount).toBe(0)
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "剛毅"`
Expected: FAIL(`baseComboCount`が常に0のまま)

- [ ] **Step 3: startWaveに剛毅の計算ロジックを実装する**

`src/lib/game/shidasu/engine.ts`の`startWave`関数内、`WaveState`オブジェクトリテラルを構築する直前(146行目`const wave: WaveState = {`の直前)に以下を追加する。

```ts
  // 剛毅: Wave開始時、山札+場札の合計枚数(deckComposition.length、ワイルド生成後の値)が
  // n枚ごとに基礎コンボ数+1する
  const fortitudeBaseCombo = items.includes('fortitude')
    ? Math.floor(composition.length / params.talismans.fortitude.n)
    : 0
```

`WaveState`オブジェクトリテラル内、`baseComboCount: 0,`の行を以下のように変更する。

変更前:
```ts
    baseComboCount: 0,
```

変更後:
```ts
    baseComboCount: fortitudeBaseCombo,
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "剛毅"`
Expected: PASS

- [ ] **Step 5: 全体テスト・型チェックを実行する**

Run: `npx vitest run`
Expected: 全件PASS

Run: `npm run check`
Expected: shidasu関連のエラー0件

- [ ] **Step 6: Commit**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/itemGroups.ts src/lib/game/shidasu/items.ts src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 剛毅(fortitude)の効果を実装"
```

---

### Task 6: 新規護符「水鏡」(waterMirror、左隣護符の効果を追加でもう1回発動)の実装

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`(`ItemId`に追加)
- Modify: `src/lib/game/shidasu/params.ts`(型・DEFAULT_PARAMSに追加)
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Modify: `src/lib/game/shidasu/itemGroups.ts`
- Modify: `src/lib/game/shidasu/items.ts`
- Modify: `src/lib/game/shidasu/itemEffects.ts`(`applyItemEffects`のreduceロジック変更)
- Test: `src/lib/game/shidasu/itemEffects.test.ts`(存在しなければ`engine.test.ts`に追加)

- [ ] **Step 1: types.tsにItemIdを追加する**

`src/lib/game/shidasu/types.ts`のTask 5 Step 1で追加した行を以下のように変更する。

変更前:
```ts
  | 'fortitude'
```

変更後:
```ts
  | 'fortitude'
  | 'waterMirror'
```

- [ ] **Step 2: params.tsのShidasuParams型に追加する**

`src/lib/game/shidasu/params.ts`のTask 5 Step 2で追加した`fortitude`の行の直後に以下を追加する。

```ts
    waterMirror: { name: string; rarity: Rarity; desc: string }
```

- [ ] **Step 3: params.tsのDEFAULT_PARAMSに追加する**

`src/lib/game/shidasu/params.ts`のTask 5 Step 3で追加した`fortitude`の行の直後に以下を追加する。

```ts
    waterMirror: { name: '水鏡', rarity: 'R', desc: '護符の並び順で自分の左隣にある護符の効果を、追加でもう一度発動させる(自分が先頭の場合は何も起きない)' },
```

- [ ] **Step 4: shidasu.config.jsonに追加する**

`src/lib/game/shidasu/shidasu.config.json`のTask 5 Step 4で追加した`fortitude`エントリの直後に以下を追加する。

```json
      "waterMirror": { "name": "水鏡", "rarity": "R", "desc": "護符の並び順で自分の左隣にある護符の効果を、追加でもう一度発動させる(自分が先頭の場合は何も起きない)" },
```

- [ ] **Step 5: itemGroups.tsのグループ18に追加する**

`src/lib/game/shidasu/itemGroups.ts`のTask 5 Step 5で追加したグループ18の行を以下のように変更する。

変更前:
```ts
  { label: 'グループ18: 判定ロジック内部干渉', ids: ['dedication', 'diligence', 'divineProtection', 'fortitude'] },
```

変更後:
```ts
  { label: 'グループ18: 判定ロジック内部干渉', ids: ['dedication', 'diligence', 'divineProtection', 'fortitude', 'waterMirror'] },
```

- [ ] **Step 6: items.tsのITEM_POOLに追加する**

`src/lib/game/shidasu/items.ts`のTask 5 Step 6で追加した行の直後に以下を追加する。

```ts
  'waterMirror',
```

- [ ] **Step 7: 失敗するテストを書く**

`src/lib/game/shidasu/itemEffects.ts`の現在の実装を確認する。

```ts
export function applyItemEffects(
  channel: 'gained' | 'clearBonus',
  baseValue: number,
  items: ItemId[],
  ctx: ItemEffectContext,
  params: ShidasuParams
): { value: number; parts: ScorePart[] } {
  const parts: ScorePart[] = []
  const value = items.reduce((v, id) => {
    const entry = ITEM_EFFECTS[id]
    if (!entry || entry.channel !== channel) return v
    const result = entry.effect(v, ctx, params)
    if (result.part) parts.push(result.part)
    return result.value
  }, baseValue)
  return { value, parts }
}
```

`src/lib/game/shidasu/itemEffects.ts`は`engine.ts`から`applyItemEffects`をre-exportしていないため、`itemEffects.test.ts`という新規テストファイルを作成し、直接`./itemEffects`からimportする。`clearBonusEffects.ts`の`patience`(忍耐)は「全消しボーナスに残り山札枚数×x点加算」で、`DEFAULT_PARAMS.talismans.patience.x`は500(`params.ts:287`)。`ctx.stockRemaining`を5に設定すれば1回あたり2500点の加算になり、水鏡ありなら2回分で5000点加算になる。

`src/lib/game/shidasu/itemEffects.test.ts`を新規作成し、以下の内容を書く。

```ts
// src/lib/game/shidasu/itemEffects.test.ts
import { describe, test, expect } from 'vitest'
import { applyItemEffects, type ItemEffectContext } from './itemEffects'
import { DEFAULT_PARAMS } from './params'
import { card } from './testHelpers'

function makeCtx(overrides: Partial<ItemEffectContext> = {}): ItemEffectContext {
  return {
    card: card(1, '♠', 1),
    previousFoundation: card(0, '♠', 1),
    combo: 0,
    stockRemaining: 0,
    chain: [],
    remainingTableauCount: 0,
    chainBonus: { bonus: 0, parts: [], patternFired: false, patternFiredCount: 0, roleFired: [] },
    isFirstPlayOfWave: false,
    isPlayAction: true,
    playCountInChain: 1,
    effectiveStairMinLen: DEFAULT_PARAMS.scoring.stairMinLen,
    effectiveSuitColorMinLen: DEFAULT_PARAMS.scoring.suitColorMinLen,
    sameColumnStreak: 1,
    totalColumnsEmptiedThisWave: 0,
    maxComboThisWave: 0,
    flushActiveThisCombo: false,
    columnSweepActiveThisWave: false,
    drawContinueCountThisChain: 0,
    mercyActiveNextCombo: false,
    ...overrides,
  }
}

describe('水鏡(waterMirror): 左隣の護符の効果をもう一度発動させる', () => {
  test('左隣が忍耐(全消しボーナスへの固定加算)の場合、忍耐の効果が2回分適用される', () => {
    const ctx = makeCtx({ stockRemaining: 5 })
    const result = applyItemEffects('clearBonus', 0, ['patience', 'waterMirror'], ctx, DEFAULT_PARAMS)
    const perApplication = 5 * DEFAULT_PARAMS.talismans.patience.x
    expect(result.value).toBe(perApplication * 2)
  })

  test('水鏡が先頭にある場合(左隣が存在しない)、何も追加されない', () => {
    const ctx = makeCtx({ stockRemaining: 5 })
    const result = applyItemEffects('clearBonus', 0, ['waterMirror', 'patience'], ctx, DEFAULT_PARAMS)
    const perApplication = 5 * DEFAULT_PARAMS.talismans.patience.x
    expect(result.value).toBe(perApplication)
  })

  test('水鏡を所持していなければ通常通り1回分のみ適用される', () => {
    const ctx = makeCtx({ stockRemaining: 5 })
    const result = applyItemEffects('clearBonus', 0, ['patience'], ctx, DEFAULT_PARAMS)
    const perApplication = 5 * DEFAULT_PARAMS.talismans.patience.x
    expect(result.value).toBe(perApplication)
  })
})
```

- [ ] **Step 8: テストを実行して失敗を確認する**

Run: `npx vitest run src/lib/game/shidasu/itemEffects.test.ts`
Expected: FAIL(`waterMirror`は`ITEM_EFFECTS`に登録されておらず何も起きないため、1回目のテストの`result.value`が`perApplication`のまま2倍にならない)

- [ ] **Step 9: itemEffects.tsのapplyItemEffectsをインデックス走査に変更する**

`src/lib/game/shidasu/itemEffects.ts`の`applyItemEffects`関数を以下のように変更する。

変更前:
```ts
export function applyItemEffects(
  channel: 'gained' | 'clearBonus',
  baseValue: number,
  items: ItemId[],
  ctx: ItemEffectContext,
  params: ShidasuParams
): { value: number; parts: ScorePart[] } {
  const parts: ScorePart[] = []
  const value = items.reduce((v, id) => {
    const entry = ITEM_EFFECTS[id]
    if (!entry || entry.channel !== channel) return v
    const result = entry.effect(v, ctx, params)
    if (result.part) parts.push(result.part)
    return result.value
  }, baseValue)
  return { value, parts }
}
```

変更後:
```ts
export function applyItemEffects(
  channel: 'gained' | 'clearBonus',
  baseValue: number,
  items: ItemId[],
  ctx: ItemEffectContext,
  params: ShidasuParams
): { value: number; parts: ScorePart[] } {
  const parts: ScorePart[] = []
  let value = baseValue
  for (let i = 0; i < items.length; i++) {
    const id = items[i]
    const entry = ITEM_EFFECTS[id]
    if (entry && entry.channel === channel) {
      const result = entry.effect(value, ctx, params)
      if (result.part) parts.push(result.part)
      value = result.value
    }
    // 水鏡: 自分の左隣(i-1番目)の護符の効果を、追加でもう一度この時点の値に適用する
    if (id === 'waterMirror' && i > 0) {
      const leftId = items[i - 1]
      const leftEntry = ITEM_EFFECTS[leftId]
      if (leftEntry && leftEntry.channel === channel) {
        const echoResult = leftEntry.effect(value, ctx, params)
        if (echoResult.part) parts.push(echoResult.part)
        value = echoResult.value
      }
    }
  }
  return { value, parts }
}
```

- [ ] **Step 10: テストを実行して成功を確認する**

Run: `npx vitest run src/lib/game/shidasu/itemEffects.test.ts`
Expected: PASS(3件とも)

- [ ] **Step 11: 全体テスト・型チェックを実行する**

Run: `npx vitest run`
Expected: 全件PASS

Run: `npm run check`
Expected: shidasu関連のエラー0件

- [ ] **Step 12: Commit**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/itemGroups.ts src/lib/game/shidasu/items.ts src/lib/game/shidasu/itemEffects.ts src/lib/game/shidasu/itemEffects.test.ts
git commit -m "feat: 新規護符 水鏡(waterMirror、左隣護符の効果を追加発動)を実装"
```

---

### Task 7: 統合確認

**Files:** なし(確認のみ)

- [ ] **Step 1: 全護符数の整合性を確認する**

Run: `grep -c "^  | '" src/lib/game/shidasu/types.ts` の代わりに、実装した5護符すべてが`items.ts`のITEM_POOL・`itemGroups.ts`・`params.ts`(型・DEFAULT_PARAMS)・`shidasu.config.json`の4箇所すべてに存在することを目視確認する。

```bash
grep -n "dedication\|diligence\|divineProtection\|fortitude\|waterMirror" src/lib/game/shidasu/items.ts src/lib/game/shidasu/itemGroups.ts
```

Expected: 5護符すべてが両ファイルに出現する

- [ ] **Step 2: 全テストを実行する**

Run: `npx vitest run`
Expected: 全ファイルPASS

- [ ] **Step 3: ビルドを実行する**

Run: `npm run build`
Expected: ビルド成功

- [ ] **Step 4: 型チェックを実行する**

Run: `npm run check`
Expected: shidasu関連のエラー0件(他ツールの既存エラーは無関係のため無視してよい)

- [ ] **Step 5: 開発サーバーでブラウザ確認する**

Run: `npm run dev`
確認項目:
- `/admin/shidasu-debug`で献身・勤勉・加護・剛毅・水鏡(新)・鋼鉄(旧mirror)を付与し、それぞれ意図通りに動作すること(献身・勤勉・加護は対象役成立で倍率が積み上がる、剛毅はWave開始時にbaseComboCountが増える、水鏡は左隣護符の効果が2倍になる、鋼鉄は旧水鏡と同じ遅延コピー効果になっている)
- `/admin/shidasu-bosses`または`/admin/shidasu`の護符管理画面で5護符の名前・説明文が正しく表示・編集できること

---
