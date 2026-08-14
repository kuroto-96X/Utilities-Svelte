# 星の妨害行動 Phase B 実装設計

> 対象: `docs/shidasu/shidasu-star-sabotage-candidates.md`の残り10候補(Phase B)を実装する。既存の22個(先行実装11個+Phase A 11個、`sabotageEffects.ts`の`SABOTAGE_HANDLERS`にディスパッチ)に10個を追加し、合計32個にする。加えて、既に実装済みの`riteForceActivate`(秘儀強制発動)を、今回追加する`revelationOracleForceActivate`と統一した設計方針に合わせて改修する。

## 背景・目的

`docs/shidasu/shidasu-roadmap.md`項目3(星の妨害行動)は基盤+22個の実装が完了している(先行11個・Phase A 11個)。本設計では既存の`SABOTAGE_HANDLERS`ディスパッチ基盤(`sabotageEffects.ts`)をそのまま拡張し、残り10個を追加する。既存waveSlot3の星6種は全て`sabotage: {kind: 'all'}`のため、追加した候補は実装した時点で自動的に対象へ加わる(星側の変更は不要)。

## 方針(スコープ)

Phase Bで実装する10個: 護符(`talismanShuffle`)・天啓/神託(`revelationOracleConfiscate`・`revelationOracleForceActivate`)・レリック(`tsukumokaRelease`)・捨て札(`discardErase`・`discardBury`)・資産(`rewardReduce`・`currencyDrain`)・役ステータス(`roleLevelDecay`・`roleBias`)。

これに加え、**既に実装済みの`riteForceActivate`を改修する**。天啓・神託強制発動を設計する過程で「強制発動とは、プレイヤー操作を介さず通常使用と全く同じ処理(`useRite`/`useRevelation`/`useOracle`)を実行することだ」という統一方針に決めたため、Phase A時点の`riteForceActivate`(`applyRiteEffect`を直接呼び、果断・星霜・`recentUsedRiteIds`への影響を意図的にスキップしていた設計)を、この統一方針に合わせて`useRite`呼び出しへ差し替える。効果としては「秘儀強制発動でも果断・星霜が加算され、秘儀回帰の履歴にも残るようになる」という挙動変更を伴う(見た目上の強化ではなく、既存の除外を撤廃するだけ)。

10個一気に1フェーズで実装する(既存のPhase A同様、`SABOTAGE_POOL`が32件になる)。

## 効果仕様

| id | ターゲット | intervalTurns | 効果 |
|---|---|---|---|
| `talismanShuffle` | 護符 | 5 | 所持護符の並び順をランダムにシャッフルし、次の妨害発動まで護符を裏向き表示にする(何がどの順で並んでいるか見えなくなる) |
| `revelationOracleConfiscate` | 天啓・神託 | 7 | 所持している天啓または神託からランダムに1つ選び、完全に失わせる(天啓は所持から除外、神託は`run.oracles`から該当エントリを除外するのみ。`oracleLevels`は変更しない) |
| `revelationOracleForceActivate` | 天啓・神託 | 6 | 使用可能な天啓+所持神託の合算プールからランダムに1つ選び、プレイヤーの操作を介さず`useRevelation`/`useOracle`をそのまま呼んで即座に効果を発動・消費する。プールが空なら不発 |
| `tsukumokaRelease` | レリック | 6 | 付喪化済みレリックがあればランダムに1つ選び、未付喪化状態に戻す。付喪化済みレリックが無ければ不発 |
| `discardErase` | 捨て札 | 6 | チェーンのカードを捨て札に送り、捨て札全体をシャッフルしてから同じ枚数をチェーンに戻す(シャッフル後の末尾を新しい基準カードにする) |
| `discardBury` | 捨て札 | 5 | 捨て札の中身を山札に戻し混ぜ込み、同じ枚数を山札から裏向きで捨て札に移す |
| `rewardReduce` | 資産(星片) | 8 | Waveクリア時の通貨報酬を-2する。複数回発動した場合は累積してn×回数分減少する(永続、ラン終了までリセットされない) |
| `currencyDrain` | 資産(星片) | 6 | 所持通貨の20%を失わせる(端数切り捨て) |
| `roleLevelDecay` | 役ステータス | 7 | ランダムな2役を選び、`oracleLevels`を1下げる(下限1、永続的なマイナス) |
| `roleBias` | 役ステータス | 6 | 次の妨害発動まで、全役(10役)をランダムに半分(5役ずつ)に分け、一方を2倍、他方を1/2倍にする |

## 技術設計

### アーキテクチャ上の注意: `SabotageContext`への`useRite`/`useRevelation`/`useOracle`注入

`riteForceActivate`の改修・`revelationOracleForceActivate`はいずれも、`engine.ts`で定義されている`useRite`・`useRevelation`・`useOracle`をそのまま呼び出す必要がある。しかし`sabotageEffects.ts`から`engine.ts`を直接importすると、`engine.ts`が既に`sabotageEffects.ts`をimportしているため循環importになる。

これを避けるため、`SabotageContext`にこの3関数を**呼び出し側(`engine.ts`のtriggerSabotage)から渡す**形にする(依存性注入)。`sabotageEffects.ts`は`engine.ts`を一切importしない。

```ts
export interface SabotageContext {
  params: ShidasuParams
  run: RunState
  wave: WaveState
  rand: () => number
  useRite: (params: ShidasuParams, run: RunState, riteId: RiteId, rand?: () => number) => RunState
  useRevelation: (
    params: ShidasuParams, run: RunState, revelationId: RevelationId,
    targetCol: number | null, rand?: () => number, targetRelicId?: RelicId | null
  ) => RunState
  useOracle: (params: ShidasuParams, run: RunState, roleName: RoleName) => RunState
}
```

`triggerSabotage`側(`engine.ts`、同一ファイル内に`useRite`/`useRevelation`/`useOracle`が定義済みなのでimport不要):

```ts
const result = applySabotageEffect(id, { params, run, wave, rand, useRite, useRevelation, useOracle })
```

`sabotageEffects.test.ts`(既存)は`engine.ts`から`createInitialRun`・`startWave`に加えて`useRite`・`useRevelation`・`useOracle`もimportし、実際の関数をそのままctxへ渡す(モック不要、既存のテスト方針を踏襲)。

### `useRite`/`useRevelation`/`useOracle`が返す完全な`RunState`と`SabotageResult`の合成

これら3関数はいずれも完全な`RunState`(`wave`フィールドを含む)を返す。`SabotageResult`は`{wave?: Partial<WaveState>; run?: Partial<RunState>}`という部分更新の形なので、以下の方針で分配する。

- `wave`には、返ってきた`RunState.wave`(非null、`triggerSabotage`の実行時点で`run.wave`は必ず非nullなので保証される)をそのまま渡しつつ、`activeSeal: null`で明示的に上書きする(既存の`riteForceActivate`と同じ理由: `useXxx`系関数が内部で呼ぶ`applyXxxEffect`は元の`wave`をスプレッドするため、リセット前の`activeSeal`を引き継いでしまう)
- `run`には、返ってきた`RunState`全体をそのまま渡す(`Partial<RunState>`は完全なオブジェクトも受け入れられる)。`run`に含まれる`wave`フィールドは`triggerSabotage`の合成処理(`nextRun = {...run, ...result.run, wave: nextWave}`)で最終的に`nextWave`に上書きされるため無害。この方式にすることで、`grantRevelationReward`が動的に返す報酬(通貨・アイテム付与など天啓の種類によって異なるフィールド)を個別に列挙する必要が無くなり、将来`useXxx`系関数の挙動が変わっても自動的に追従する

```ts
// riteForceActivate改修後
function applyRiteForceActivate({ params, run, wave, rand, useRite }: SabotageContext): SabotageResult {
  const usable = run.rites.filter(riteId => canUseRite(params, wave, riteId))
  if (usable.length === 0) return {}
  const target = usable[Math.floor(rand() * usable.length)]
  const used = useRite(params, run, target, rand)
  return { wave: { ...used.wave!, activeSeal: null }, run: used }
}
```

```ts
// revelationOracleForceActivate新規
function applyRevelationOracleForceActivate({ params, run, wave, rand, useRevelation, useOracle }: SabotageContext): SabotageResult {
  const usableRevelations = run.revelations.filter(id => canUseRevelation(params, wave, id, run.relics))
  const pool: HeldRevelationOrOracleRef[] = [
    ...usableRevelations.map(id => ({ kind: 'revelation' as const, id })),
    ...run.oracles.map(id => ({ kind: 'oracle' as const, id })),
  ]
  if (pool.length === 0) return {}
  const ref = pool[Math.floor(rand() * pool.length)]
  if (ref.kind === 'oracle') {
    const used = useOracle(params, run, ref.id)
    return { wave: { ...used.wave!, activeSeal: null }, run: used }
  }
  const targetCol = revelationNeedsTarget(ref.id) ? Math.floor(rand() * wave.tableau.length) : null
  const used = useRevelation(params, run, ref.id, targetCol, rand)
  return { wave: { ...used.wave!, activeSeal: null }, run: used }
}
```

`canUseRevelation`(`revelationEffects.ts`)・`revelationNeedsTarget`(`revelationEffects.ts`)を新規importする。

### `talismanShuffle`(護符並び替え)

`run.items`を`shuffleInPlace`でシャッフルし、`activeSeal`に新しいバリアント`{ kind: 'talismanHidden' }`を設定する(既存の`talisman`/`rite`/`revelationOrOracle`/`role`/`comboCap`と同様、1件のみ同時に存在できる既存の`activeSeal`の仕組みをそのまま使う)。

```ts
activeSeal:
  | { kind: 'talisman'; id: ItemId }
  | { kind: 'rite'; id: RiteId }
  | { kind: 'revelationOrOracle'; ref: HeldRevelationOrOracleRef }
  | { kind: 'role'; names: RoleName[] }
  | { kind: 'comboCap'; max: number }
  | { kind: 'talismanHidden' }
  | { kind: 'roleBias'; buffed: RoleName[]; nerfed: RoleName[]; multiplier: number }
  | null
```

```ts
function applyTalismanShuffle({ run, rand }: SabotageContext): SabotageResult {
  const items = [...run.items]
  shuffleInPlace(items, rand)
  return { run: { items }, wave: { activeSeal: { kind: 'talismanHidden' } } }
}
```

**UI変更**: `src/routes/game/shidasu/+page.svelte`内、`run.items`を`itemName(id, params)`で表示している箇所(バッジ一覧・所持品詳細一覧など、複数箇所)で、`wave?.activeSeal?.kind === 'talismanHidden'`のときは名称の代わりに固定のプレースホルダ(例:「？？？」)を表示する。並び順自体は既存の描画ロジック(配列 or Setの反復順)がそのまま`run.items`の順序に従うため、シャッフル自体は追加のUI変更なしで反映される。

既存の`talismanSeal`(護符封印)・`riteSeal`・`revelationOracleSeal`には現状、封印中の対象を強調するUI(グレーアウト等)が無い(バックエンドの状態変化のみ)。今回`talismanHidden`にだけ専用UI(裏向き表示)を追加するのは、この効果が視覚的な変化なしでは体感できない(スコアへの直接影響が無い)ためであり、既存の封印系UIを遡って追加する対応は本設計のスコープ外。

### `revelationOracleConfiscate`(天啓・神託没収)

```ts
function applyRevelationOracleConfiscate({ run, rand }: SabotageContext): SabotageResult {
  const pool: HeldRevelationOrOracleRef[] = [
    ...run.revelations.map(id => ({ kind: 'revelation' as const, id })),
    ...run.oracles.map(id => ({ kind: 'oracle' as const, id })),
  ]
  if (pool.length === 0) return {}
  const ref = pool[Math.floor(rand() * pool.length)]
  if (ref.kind === 'revelation') {
    const idx = run.revelations.indexOf(ref.id)
    return { run: { revelations: [...run.revelations.slice(0, idx), ...run.revelations.slice(idx + 1)] } }
  }
  const idx = run.oracles.indexOf(ref.id)
  return { run: { oracles: [...run.oracles.slice(0, idx), ...run.oracles.slice(idx + 1)] } }
}
```

神託が対象になった場合も`oracleLevels`は変更しない(`run.oracles`に温存中の神託は`useOracle`で消費するまで`oracleLevels`に反映されていないため、没収してもまだ加算されていないレベルを減らす理由が無い)。

### `tsukumokaRelease`(付喪化解除)

```ts
function applyTsukumokaRelease({ run, rand }: SabotageContext): SabotageResult {
  const tsukumokaRelics = run.relics.filter(r => r.tsukumoka)
  if (tsukumokaRelics.length === 0) return {}
  const target = tsukumokaRelics[Math.floor(rand() * tsukumokaRelics.length)]
  const relics = run.relics.map(r => (r.id === target.id ? { ...r, tsukumoka: false } : r))
  return { run: { relics } }
}
```

### `discardErase`(捨て札消去)

```ts
function applyDiscardErase({ wave, rand }: SabotageContext): SabotageResult {
  const chainCount = wave.chain.length
  const pool = [...wave.discardPile, ...wave.chain]
  shuffleInPlace(pool, rand)
  const chain = pool.slice(0, chainCount)
  const discardPile = pool.slice(chainCount)
  const chainOrigin = chain.map(() => 'draw' as const)
  return { wave: { chain, chainOrigin, discardPile, foundation: chain[chain.length - 1] } }
}
```

`chainOrigin`は再構成後の全カードを一律`'draw'`扱いにする(捨て札由来のカードには元の由来情報が意味を持たないため。`chainOrigin`の唯一の用途はプレイ回数ベースのボーナス計算であり、`'play'`扱いにして誤って加点対象を増やすことを避ける)。`chainShuffle`(Phase A実装済み)と同様、シャッフル後の末尾を新しい`foundation`にする。

### `discardBury`(捨て札埋没)

```ts
function applyDiscardBury({ wave, rand }: SabotageContext): SabotageResult {
  const n = wave.discardPile.length
  const pool = [...wave.stock, ...wave.discardPile]
  shuffleInPlace(pool, rand)
  const discardPile = pool.slice(0, n)
  const stock = pool.slice(n)
  return { wave: { stock, discardPile } }
}
```

場札・チェーンには触れない。

### `rewardReduce`(報酬減少)

`RunState`に新フィールド`rewardPenalty: number`(累積、初期値0)を追加する。

**`types.ts`**: `RunState`に`rewardPenalty: number`を追加(`recentUsedRiteIds`の直後)。

**`engine.ts`**: `createInitialRun`・`beginRun`の初期化箇所(`recentUsedRiteIds: []`と同じ場所)に`rewardPenalty: 0`を追加する。`resolveWaveEnd`(1028-1061行目)の報酬計算を変更する:

```ts
const currentStar = run.stageStars[run.waveIndex]
const baseEarned = Math.max(0, (currentStar?.reward ?? 0) - run.rewardPenalty)
const earned = baseEarned + relicWaveEndBonus(params, run, wave, baseEarned)
```

(レリックボーナスは減算後の`baseEarned`を基準にする既存の計算順序をそのまま維持する。ペナルティは星本体の報酬にのみ作用し、レリックボーナス自体は目減りしない。)

**`sabotageEffects.ts`**:

```ts
function applyRewardReduce({ run }: SabotageContext): SabotageResult {
  return { run: { rewardPenalty: run.rewardPenalty + 2 } }
}
```

### `currencyDrain`(通貨強制消費)

```ts
function applyCurrencyDrain({ run }: SabotageContext): SabotageResult {
  const loss = Math.floor(run.currency * 0.2)
  return { run: { currency: Math.max(0, run.currency - loss) } }
}
```

### `roleLevelDecay`(役減衰)

```ts
function applyRoleLevelDecay({ run, rand }: SabotageContext): SabotageResult {
  const names = rollOffer(ORACLE_POOL, 2, rand)
  const oracleLevels = { ...run.oracleLevels }
  for (const name of names) oracleLevels[name] = Math.max(1, oracleLevels[name] - 1)
  return { run: { oracleLevels }, wave: { oracleLevels } }
}
```

`run.oracleLevels`と`wave.oracleLevels`の両方を同期する(`useOracle`と同じ理由: `wave.oracleLevels`は得点計算がウェーブ中に直接参照するコピーであり、永続的な変更を即座に反映させるにはこちらも更新する必要がある)。

### `roleBias`(役偏重)

`SealedRoleEffect`(`engine.ts`)を拡張し、`activeSeal`に新バリアント`roleBias`を追加する(`talismanShuffle`の節に記載した型定義を参照)。

```ts
export type SealedRoleEffect = {
  zeroRoles: RoleName[]
  oracleBaselineRole: RoleName | null
  multipliers?: Partial<Record<RoleName, number>>
}
```

`resolveSealedRoleEffect`に分岐を追加する:

```ts
export function resolveSealedRoleEffect(activeSeal: WaveState['activeSeal']): SealedRoleEffect {
  if (activeSeal?.kind === 'role') return { zeroRoles: activeSeal.names, oracleBaselineRole: null }
  if (activeSeal?.kind === 'revelationOrOracle' && activeSeal.ref.kind === 'oracle') return { zeroRoles: [], oracleBaselineRole: activeSeal.ref.id }
  if (activeSeal?.kind === 'roleBias') {
    const multipliers: Partial<Record<RoleName, number>> = {}
    for (const name of activeSeal.buffed) multipliers[name] = activeSeal.multiplier
    for (const name of activeSeal.nerfed) multipliers[name] = 1 / activeSeal.multiplier
    return { zeroRoles: [], oracleBaselineRole: null, multipliers }
  }
  return { zeroRoles: [], oracleBaselineRole: null }
}
```

`playCard`(375行目付近)・`drawStock`(713行目付近)の`oracleLevel`クロージャに掛け算ロジックを追加する:

```ts
const oracleLevel = (name: RoleName): number => {
  if (sealedRoleEffect.zeroRoles.includes(name)) return 0
  if (sealedRoleEffect.oracleBaselineRole === name) return 1
  const base = wave.oracleLevels[name] ?? 1
  const mult = sealedRoleEffect.multipliers?.[name]
  return mult !== undefined ? base * mult : base
}
```

(既存の`zeroRoles`・`oracleBaselineRole`のどちらにも該当しない場合のみ`multipliers`を見る。3つの仕組みは元々別々の`activeSeal`バリアントから導出されるため、同時に複数が非空になることは無い。)

`sabotageEffects.ts`側:

```ts
function applyRoleBias({ rand }: SabotageContext): SabotageResult {
  const shuffled = [...ORACLE_POOL]
  shuffleInPlace(shuffled, rand)
  const half = Math.floor(shuffled.length / 2)
  const buffed = shuffled.slice(0, half)
  const nerfed = shuffled.slice(half)
  return { wave: { activeSeal: { kind: 'roleBias', buffed, nerfed, multiplier: 2 } } }
}
```

`ORACLE_POOL`は10役なので`buffed`5役・`nerfed`5役に均等分割される。

## `SABOTAGE_POOL`・`SabotageActionId`の更新

`types.ts`の`SabotageActionId`に10個追加する:

```ts
export type SabotageActionId =
  | 'stockPurge' | 'columnReturn' | 'chainSettle' | 'comboBreather'
  | 'talismanSeal' | 'riteSeal' | 'revelationOracleSeal' | 'relicConfiscate'
  | 'tableauCardToDiscard' | 'currencyConfiscate' | 'roleSeal'
  | 'stockPurgeSmall' | 'stockShuffle' | 'tableauFullReturn' | 'tableauShuffle'
  | 'chainPartialDiscard' | 'chainShuffle' | 'comboReduce' | 'comboCap'
  | 'talismanConfiscate' | 'riteConfiscate' | 'riteForceActivate'
  | 'talismanShuffle' | 'revelationOracleConfiscate' | 'revelationOracleForceActivate'
  | 'tsukumokaRelease' | 'discardErase' | 'discardBury'
  | 'rewardReduce' | 'currencyDrain' | 'roleLevelDecay' | 'roleBias'
```

`sabotage.ts`の`SABOTAGE_POOL`に10エントリを追加する(名前・target・descTemplateは「効果仕様」の表の通り)。

## テスト

- `sabotage.ts`: `SABOTAGE_POOL`が32件になったことを検証するテストを更新する。
- `sabotageEffects.test.ts`: 既存の「32件全てのidに対して例外を投げない」テストを、追加後の`SABOTAGE_POOL`(32件)に対して実行されるよう確認する(コード変更は不要、対象一覧が自動的に32件になる)。`useRite`・`useRevelation`・`useOracle`をctxに渡す変更に合わせてテストのctx構築を更新する。
- `engine.ts`: `triggerSabotage`経由で10個の新規効果 + `riteForceActivate`改修後の挙動、それぞれを検証するテストを追加・更新する(既存パターンと同じ形式)。
  - `revelationOracleForceActivate`: (a)対象天啓が列選択を要する場合に効果が適用されること、(b)対象が神託の場合に`useOracle`と同じ結果(`oracleLevels`加算・`oracles`から除外)になること、(c)使用可能な天啓も所持神託も無い場合に何も起きないこと
  - `riteForceActivate`(改修後): `useRite`と同じ結果(果断・星霜の加算、`recentUsedRiteIds`の更新を含む)になることを検証するテストに更新する
  - `roleBias`: `activeSeal`設定の検証に加え、`playCard`/`drawStock`経由で実際にスコアが2倍・0.5倍になることを検証する統合テストを追加する
  - `discardErase`: 再構成後の`chain`の末尾と`wave.foundation`が一致すること、`chainOrigin`が全て`'draw'`になることを検証する
  - `rewardReduce`: `resolveWaveEnd`経由で報酬が正しく減算されること(複数回発動時の累積を含む)を検証する
- `types.test.ts`等が無ければ、`RunState`の型変更(`rewardPenalty`)に伴う既存テストのフィクスチャ更新が必要な場合は個別に対応する。

## スコープ外

- 既存の`talismanSeal`・`riteSeal`・`revelationOracleSeal`への遡及的なUI追加(グレーアウト等)
- `intervalTurns`・効果の数値パラメータ(n=2、20%、倍率2倍など)のバランス調整。既定値のまま実装し、実プレイフィードバックは別途
- レリック封印(既存候補一覧の通り不採用)
