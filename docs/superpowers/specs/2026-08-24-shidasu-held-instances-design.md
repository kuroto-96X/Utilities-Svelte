# 護符・秘儀・天啓・神託のオブジェクト化(instanceId導入) 設計

## 背景・目的

`docs/shidasu/shidasu-reward-talismans-candidates.md`の報酬増加系護符検討で、「自分自身の売値を増加させる」ような、所持中に効果が個体ごとに変動する護符を実装しようとした際、`RunState.items`が`ItemId[]`という単純な文字列配列であるため、同名護符を複数所持していても個体を区別できないという制約が発覚した。

`docs/superpowers/specs/2026-08-21-shidasu-play-item-reorder-design.md`のスコープ外項目でも同様の制約(`activeSeal`が`id`のみで対象を特定するため、同名護符の封印が個体を区別できない)が既知の課題として記録されている。

本設計では、護符(`items`)・秘儀(`rites`)・天啓(`revelations`)・神託(`oracles`)の4配列を、`instanceId`を持つオブジェクト配列に変換し、個体識別を可能にする。**今回のスコープはデータ構造の移行自体に限定し、既存99個の護符・24個の秘儀・28個の天啓・10個の神託の挙動は完全に維持する**(可変効果を持つ具体的な護符の実装は別セッション)。

## 新データ構造

`src/lib/game/shidasu/types.ts`に以下の型を新設する。既存の`HeldRevelationOrOracleRef`の命名規則(`Held`接頭辞)を踏襲する。

```ts
export interface HeldItem { instanceId: number; id: ItemId }
export interface HeldRite { instanceId: number; id: RiteId }
export interface HeldRevelation { instanceId: number; id: RevelationId }
export interface HeldOracle { instanceId: number; id: RoleName }
```

`RunState`のフィールドを変更する:

```ts
items: HeldItem[]           // was: ItemId[]
rites: HeldRite[]           // was: RiteId[]
revelations: HeldRevelation[] // was: RevelationId[]
oracles: HeldOracle[]       // was: RoleName[]
nextInstanceId: number      // 新設。4配列共通の単一カウンター
```

`relics`(`{ id: RelicId; tsukumoka: boolean }[]`)は同名重複不可のため対象外、変更しない。

## instanceIdカウンター

既存の`RunState.waveGeneration`(回すカウンターで新規性を検知する既存パターン)と同じ発想で、`RunState.nextInstanceId`を単一のインクリメンタルカウンターとして持つ。4配列共通(items/rites/revelations/oracles全体で一意)にする。新規インスタンスを配列に追加する箇所(購入・福袋確定・スワップ確定など)で`nextInstanceId`を払い出し、`+1`して更新する。

`createInitialRun`(ラン開始時の初期状態生成)では`nextInstanceId: 1`から開始し、初期所持護符などがあればそれぞれ払い出す。

## 内部関数の境界方針

**原則**: `engine.ts`内の既存関数(`playCard`・`applyProtectionEarthFloor`・`resolveEffectiveItems`など、スコア計算やパッシブ効果に関わる関数)のシグネチャは変更しない。引き続き`ItemId[]`・`RiteId[]`等の単純配列を受け取る。呼び出し元(`run.items.map(h => h.id)`等)で変換してから渡す。

**例外**: 秘儀・天啓は「所持中の1つを選んで使用する」という明示的なプレイヤー操作があり、`activeSeal`のinstanceId化(後述)と組み合わせるには、使用対象の個体を関数自身が知る必要がある。以下の4関数のみ、`instanceId`を追加引数として受け取る形にシグネチャを変更する:

- `canUseRite(params, wave, instanceId, riteId)`(`riteEffects.ts`)
- `useRite(params, run, instanceId, riteId)`(`engine.ts`)
- `canUseRevelation(params, wave, instanceId, revelationId, relics)`(`revelationEffects.ts`)
- `useRevelation(params, run, instanceId, revelationId, targetCol, rand, targetRelicId)`(`engine.ts`)

これらは元々`PlayArea.svelte`のバッジ描画・クリックハンドラから、対象インスタンス1個の文脈で呼ばれている(`PlayArea.svelte:1742`など)ため、呼び出し元は既にinstanceIdを保持しており、追加の設計変更なしで対応できる。

`useRite`・`useRevelation`は、`instanceId`と`id`が両方指定された場合、`run.rites`/`run.revelations`から`instanceId`一致で対象を検索する(`findIndex(h => h.instanceId === instanceId)`)。`id`は主に呼び出し元の可読性・既存テストとの互換性のために残すが、検索キーは`instanceId`を優先する。

`useOracle`は神託が「使う」というアクションを持つが、封印対象(後述)が役名(`RoleName`)単位の集計効果であるため、`useOracle(params, run, roleName)`のシグネチャ自体は変更しない(内部で`run.oracles`から`id === roleName`の最初の1件を`findIndex`で探して消費する、という既存`indexOf`と同じ選び方を維持)。

## 共通ヘルパーの一般化

`buyIndividualHold<T>`・`sellFromArray<T>`(`engine.ts`)は、4配列すべてが`{ instanceId, id }`という共通形状になることで、より一般化した実装に置き換えられる。

```ts
function buyIndividualHold<TId>(
  run: RunState,
  shop: ShopState,
  slotIndex: number,
  arrayField: 'items' | 'rites' | 'revelations' | 'oracles',
  arr: { instanceId: number; id: TId }[],
  value: TId,
  atCapacity: boolean,
  price: number
): RunState {
  if (atCapacity) return run
  if (run.currency < price) return run
  const individual = shop.individual.map((s, i) => (i === slotIndex ? { ...s, sold: true } : s))
  const held = { instanceId: run.nextInstanceId, id: value }
  return {
    ...run,
    currency: run.currency - price,
    [arrayField]: [...arr, held],
    nextInstanceId: run.nextInstanceId + 1,
    shop: { ...shop, individual },
  } as RunState
}

function sellFromArray<T>(
  run: RunState,
  arrayField: 'items' | 'rites' | 'revelations' | 'oracles',
  arr: { instanceId: number; id: T }[],
  instanceId: number,
  price: number
): RunState {
  if (run.phase !== 'playing' && run.phase !== 'shop') return run
  const idx = arr.findIndex(h => h.instanceId === instanceId)
  if (idx === -1) return run
  const newArr = [...arr.slice(0, idx), ...arr.slice(idx + 1)]
  return { ...run, [arrayField]: newArr, currency: run.currency + price } as RunState
}
```

`sellFromArray`の第4引数が`id: T`から`instanceId: number`に変わる点が既存呼び出し箇所への波及になる(`sellItem`・`sellRite`等の公開関数側で`instanceId`を受け取るようにシグネチャ変更が必要)。

## `activeSeal`のinstanceId化

`WaveState.activeSeal`の判別可能unionのうち、以下3ケースを`id`ベースから`instanceId`ベースに変更する(一貫性を優先し、`revelationOrOracle`の`oracle`側も含める):

```ts
| { kind: 'talisman'; instanceId: number; id: ItemId }
| { kind: 'rite'; instanceId: number; id: RiteId }
| { kind: 'revelationOrOracle'; ref: HeldRevelationOrOracleRef }
```

`HeldRevelationOrOracleRef`自体を拡張する:

```ts
export type HeldRevelationOrOracleRef =
  | { kind: 'revelation'; instanceId: number; id: RevelationId }
  | { kind: 'oracle'; instanceId: number; id: RoleName }
```

`id`フィールドは表示名の解決(`revelationName(id, params)`等、既存コード)やテストの可読性のために残し、封印対象の一致判定は`instanceId`で行う。

**`resolveEffectiveItems`**(`engine.ts:1107`)は`id`ベースの完全一致フィルタ(`items.filter(id => id !== activeSeal.id)`)から、`items: HeldItem[]`を受け取り`instanceId`不一致でフィルタする形に変更する:

```ts
function resolveEffectiveItems(items: HeldItem[], activeSeal: WaveState['activeSeal']): ItemId[] {
  const filtered = activeSeal?.kind === 'talisman' ? items.filter(h => h.instanceId !== activeSeal.instanceId) : items
  return filtered.map(h => h.id)
}
```

呼び出し元(`engine.ts:1701`の`resolveEffectiveItems(run.items, wave.activeSeal)`)は、`run.items`が既に`HeldItem[]`になっているためそのまま渡せる。戻り値は引き続き`ItemId[]`(スコア計算関数の境界は変更しない)。

**`resolveSealedRoleEffect`**(`engine.ts:1116`、role封印・oracle封印から`SealedRoleEffect`を導出する関数)は、`oracleBaselineRole`の値として引き続き`activeSeal.ref.id`(`RoleName`)を使う。`oracleLevels`が役名単位の集計値である以上、効果適用自体は役名ベースのままで変わらない。`instanceId`は「どの所持インスタンスが封印の起点になったか」をUI側で一意に特定するために持たせるものであり、スコア計算のロジックには影響しない。

**`sabotageEffects.ts`の封印対象抽選ロジック**(`activeSeal`を新規に設定する箇所、`kind: 'talisman'`等を生成しているコード)は、対象プールを`run.items`(`HeldItem[]`)などから直接ランダム選択する形に変更し、選ばれた`HeldItem`の`instanceId`と`id`の両方を`activeSeal`にセットする。

## `confiscatedTarget`・`forceActivatedTarget`の扱い

`confiscatedTarget`(`{ kind: 'talisman'; id: ItemId; idx: number }`等、没収系妨害行動のUIフェード演出に使う)は、**現状の`idx`ベースのまま変更しない**。`idx`は「削除時点の配列内位置」であり、オブジェクト化後もそのまま同じ意味で機能する。

`forceActivatedTarget`(`{ kind: 'rite'; id: RiteId }`等、強制発動系妨害行動の演出対象)は、`useRite`・`useRevelation`が`instanceId`対応になることに伴い、実際に選ばれたインスタンスの`instanceId`を含める形に拡張する(`{ kind: 'rite'; instanceId: number; id: RiteId }`)。これは演出精度が上がるだけで、既存の発動ロジック自体(「封印されていない秘儀・天啓からランダムに1つ選んで強制使用する」)は変更しない。

## UI層への影響

- **`PlayArea.svelte`**: 護符バッジの`data-item-index`ベースのドラッグ&ドロップ(`2026-08-21-shidasu-play-item-reorder-design.md`で実装済み)は、`run.items[i].id`で表示名を解決し、`run.items[i].instanceId`をkey・ドラッグ対象識別に使う形に変更する。`SealFlashTarget`型(`Exclude<WaveState['activeSeal'], ...>`)は`activeSeal`の型変更にそのまま追従する。
- **`src/routes/game/shidasu/+page.svelte`**: 秘儀・天啓・神託の一覧描画、購入・売却・使用ハンドラの呼び出しが`instanceId`を扱う形に変わる。
- **`src/routes/admin/shidasu-debug/+page.svelte`**: デバッグ画面の護符バッジ表示・ドラッグ並べ替え(直近セッションで実装済み)も同様に`instanceId`対応が必要。
- **`RiteChecklist.svelte`・`RevelationChecklist.svelte`・`OracleChecklist.svelte`・`RiteExecutePanel.svelte`・`RevelationExecutePanel.svelte`**: 所持一覧の描画・選択が`instanceId`ベースになる。

## 移行時の挙動維持について

以下を確認済み・確認方針とする:

- **並び順**: `items`等の配列の並び順そのものは移行前後で変わらない(要素が`ItemId`から`{ instanceId, id }`に変わるだけで、配列操作(追加・削除・並べ替え)のロジックは同じ位置に対して行う)。`waterMirror`(水鏡)護符のような「左隣の護符」に依存する効果は影響を受けない。
- **既存の封印挙動**: 現状「同名護符すべてに封印スタイルを適用する」という`id`一致ベースの挙動から、「封印された個体1つだけに適用する」という`instanceId`一致ベースの挙動に**変わる**。これは`2026-08-21`のspecで「将来的な改善」として明記されていた変更であり、今回のオブジェクト化の主目的の一つでもあるため、意図した挙動変更として扱う(「挙動を完全に維持する」という大方針の例外)。
- それ以外のスコア計算・報酬計算・ショップ価格計算などのロジックは、`ItemId[]`等への変換を経て呼ばれるため、既存のテストがそのまま通ることを確認の基準とする。

## テスト方針

- 既存の`engine.test.ts`・`shop.test.ts`・`sabotageEffects.test.ts`・`riteEffects.test.ts`・`revelationEffects.test.ts`は、`RunState`のfixture生成部分(`items: ['xxx']`のような直接配列リテラル)を`items: [{ instanceId: 1, id: 'xxx' }]`のような形に更新する必要がある。既存のテストケース自体(期待値)は変更しない。
- `instanceId`の一意性・カウンターのインクリメントを検証する新規テストを追加する(購入・福袋確定のたびに異なる`instanceId`が払い出されること)。
- 封印挙動の変更(同名全部→個体1つ)を検証する既存テストがあれば、新しい挙動に合わせて更新する。無ければ新規に1ケース追加する(同名護符を2個所持し、片方だけ封印された状態で、封印されていない方の効果は通常通り適用され、封印された方だけ除外されることを確認)。

## スコープ外

- 具体的な可変効果護符の実装(`docs/shidasu/shidasu-reward-talismans-candidates.md`で検討した報酬増加系22候補など)。今回はデータ構造の移行のみ。
- レリック(`relics`)のオブジェクト化(同名重複不可のため対象外、現状の`{ id, tsukumoka }`のまま)。
- `oracleLevels`の集計方式自体の見直し(個体ごとのレベル管理への変更などは行わない。役名単位の集計のまま)。
