# 妨害行動アニメーション実装(グループB: 没収系) 設計

> 対象: 妨害行動32個のうち未実装だった27個を5グループに分類した(詳細は`docs/shidasu/shidasu-star-sabotage-candidates.md`「演出(アニメーション)の実装状況」を参照)うち、グループB「没収系」4個(`talismanConfiscate`・`riteConfiscate`・`revelationOracleConfiscate`・`relicConfiscate`)に発動演出を実装する。グループA「封印系」(`docs/superpowers/specs/2026-08-20-shidasu-sabotage-seal-animation-design.md`)で確立したパターンを踏襲しつつ、「対象が完全に消える」という没収系特有の課題に対応する。

## 背景・目的

没収系は、対象(護符・秘儀・天啓・神託・レリックのいずれか1つ)を完全に失わせる妨害行動。対象UI要素が消える瞬間、一瞬光ってから下に落ちながら暗くフェードアウトする「崩れ落ちる」演出を追加する(ビジュアルコンパニオンでのモックアップ比較により決定済み、2026-08-20)。

グループAの封印系とは以下の点で技術的に異なる:

- 封印系は`wave.activeSeal`という単一フィールドで「現在封印中の対象」を表現していたが、没収系はそもそも封印状態を持たず、対象を`run.items`/`run.rites`/`run.revelations`/`run.oracles`/`run.relics`から直接削除するだけ。「今回何を没収したか」を伝える仕組みが存在しない。
- 実データ(`run.items`等)は`triggerSabotage`実行と同時に即座に削除されるため、UI側がそのまま`run`を参照すると、フェードアニメーションが始まる前に対象が消えてしまう(CLAUDE.mdの「移動アニメーション実装時の注意」に類する問題だが、今回は逆方向 — 削除**前**の状態をアニメーション完了まで表示し続ける必要がある)。

## 対象UI要素の整理

没収系の対象UI要素は、封印系とは異なる(封印系は「使用不可になる」演出のため秘儀/天啓ボタンが対象だったが、没収系は「バッジ表示が消える」演出のため、天啓・神託はバッジ側が対象になる)。

| 没収タイプ(`SabotageActionId`) | 対象UI要素 |
|---|---|
| `talismanConfiscate`(護符没収) | `itemBadges`スニペット(`+page.svelte`)の護符バッジ |
| `riteConfiscate`(秘儀没収) | `PlayArea.svelte`内の秘儀ボタン |
| `revelationOracleConfiscate`(天啓・神託没収、天啓が対象) | `itemBadges`スニペットの天啓バッジ |
| `revelationOracleConfiscate`(天啓・神託没収、神託が対象) | `itemBadges`スニペットの神託バッジ |
| `relicConfiscate`(レリック没収) | `itemBadges`スニペットのレリックバッジ |

`RoleStatusPanel`(役ステータス表示)は対象外。神託没収は所持神託バッジが消える演出であり、`RoleStatusPanel`は`oracleLevels`(累積レベル、`useOracle`で消費した実績)を表示するもので、未消費の所持神託とは別物のため行自体は消えない。

グループAと同様、対象は`itemBadges`スニペット(プレイ中の常設表示)のみとし、ショップ画面の所持一覧は対象外とする(没収は`playing`フェーズ中のみ発動するため)。

## 技術設計

### A. 対象特定の仕組み(`SabotageResult.confiscatedTarget`)

`sabotageEffects.ts`の`SabotageResult`インターフェースに、没収した対象を明示的に伝える`confiscatedTarget`フィールドを追加する:

```ts
export interface SabotageResult {
  wave?: Partial<WaveState>
  run?: Partial<RunState>
  affectedTableauCols?: number[]
  purgedToDiscardCount?: number
  // 今回「没収系」(talismanConfiscate/riteConfiscate/revelationOracleConfiscate/relicConfiscate)で
  // 完全に失われた対象。没収系は実データ(run.items等)を即座に削除するだけで、activeSealのような
  // 「現在の対象」を保持する仕組みを持たないため、ここで明示的に伝える。idxは配列内の位置
  // (同名の護符・秘儀・レリックを複数所持している場合の一意特定に必要。talismanは常にidxを
  // 含めるが、バッジ表示側はSetで集約されているため実際には使わない)。
  confiscatedTarget?:
    | { kind: 'talisman'; id: ItemId; idx: number }
    | { kind: 'rite'; id: RiteId; idx: number }
    | { kind: 'revelationOrOracle'; ref: HeldRevelationOrOracleRef; idx: number }
    | { kind: 'relic'; id: RelicId; idx: number }
}
```

4つの没収系効果関数を、削除前に対象情報を`confiscatedTarget`として返すよう変更する:

```ts
function applyTalismanConfiscate({ run, rand }: SabotageContext): SabotageResult {
  if (run.items.length === 0) return {}
  const idx = Math.floor(rand() * run.items.length)
  const id = run.items[idx]
  return { run: { items: [...run.items.slice(0, idx), ...run.items.slice(idx + 1)] }, confiscatedTarget: { kind: 'talisman', id, idx } }
}

function applyRiteConfiscate({ run, rand }: SabotageContext): SabotageResult {
  if (run.rites.length === 0) return {}
  const idx = Math.floor(rand() * run.rites.length)
  const id = run.rites[idx]
  return { run: { rites: [...run.rites.slice(0, idx), ...run.rites.slice(idx + 1)] }, confiscatedTarget: { kind: 'rite', id, idx } }
}

function applyRelicConfiscate({ run, rand }: SabotageContext): SabotageResult {
  if (run.relics.length === 0) return {}
  const idx = Math.floor(rand() * run.relics.length)
  const id = run.relics[idx].id
  return { run: { relics: [...run.relics.slice(0, idx), ...run.relics.slice(idx + 1)] }, confiscatedTarget: { kind: 'relic', id, idx } }
}
```

`applyRevelationOracleConfiscate`は既存実装がプール(天啓+神託を1つにまとめた配列)から対象を選んでいるため、天啓側・神託側それぞれの実際の配列内`idx`を求め直す:

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
    return {
      run: { revelations: [...run.revelations.slice(0, idx), ...run.revelations.slice(idx + 1)] },
      confiscatedTarget: { kind: 'revelationOrOracle', ref, idx },
    }
  }
  const idx = run.oracles.indexOf(ref.id)
  return {
    run: { oracles: [...run.oracles.slice(0, idx), ...run.oracles.slice(idx + 1)] },
    confiscatedTarget: { kind: 'revelationOrOracle', ref, idx },
  }
}
```

`triggerSabotage`(`engine.ts`)は、`lastSabotage`に`confiscatedTarget`もそのまま含める(既存の`affectedCols`・`purgedToDiscardCount`と同じ扱い):

```ts
lastSabotage: {
  id, seq: (wave.lastSabotage?.seq ?? 0) + 1,
  affectedCols: result.affectedTableauCols,
  purgedToDiscardCount: result.purgedToDiscardCount,
  confiscatedTarget: result.confiscatedTarget,
},
```

`WaveState.lastSabotage`の型定義にも`confiscatedTarget`を追加する。

### B. フェード中要素の表示継続

実データ(`run.items`等)は`triggerSabotage`実行と同時に削除されるため、UI側は「削除される直前の対象」を一時的に保持し、フェードアニメーション完了まで表示し続ける必要がある。

グループAの`sealFlashTarget`と同様のstateを、今回は`confiscateFadingTarget`として`PlayArea.svelte`に持たせる:

```ts
export type ConfiscatedTarget = Exclude<WaveState['lastSabotage'], undefined>['confiscatedTarget']

let confiscateFadingTarget = $state<ConfiscatedTarget | null>(null)
let confiscateFadingActive = $state(false)

function startConfiscateFadeAnimation(target: NonNullable<ConfiscatedTarget>) {
  confiscateFadingActive = true
  confiscateFadingTarget = target
  onConfiscateFadingChange?.(target)
  const timer = setTimeout(() => {
    confiscateFadingActive = false
    confiscateFadingTarget = null
    onConfiscateFadingChange?.(null)
  }, 500)
  dealTimers.push(timer)
}
```

`confiscateFadingActive`は関数先頭で同期的に`true`にする(CLAUDE.mdの「移動アニメーション実装時の注意」・既存の`discardPurgeActive`/`sealFlashActive`と同じ原則)。`anyAnimationActive`に含め、演出中は他の操作をブロックする。

各バッジ描画箇所(護符・秘儀・天啓・神託・レリック)は、「本来のリスト(既に削除済み)」に「フェード中の要素」を補完してから描画する必要がある。対象タイプごとにリストの要素型が異なる(`talisman`/`rite`/`revelation`/`oracle`は`id`がそのままリストの要素型と一致する単純な配列だが、`relic`は`{ id: RelicId; tsukumoka: boolean }`というオブジェクト配列)ため、単純な配列型(`talisman`/`rite`/`revelation`/`oracle`)向けの共通ヘルパーを1つ作り、`relic`のみ専用のインライン処理を書く。

```ts
// list(本来のリスト、既に削除済み)にfadingId(フェード中の要素のid)を補完した配列を返す。
// fadingId未指定の場合はlistをそのまま返す。挿入位置はidx(没収前の元の位置)。
function withFadingId<T>(list: T[], fadingId: T | undefined, idx: number): T[] {
  if (fadingId === undefined) return list
  const pos = Math.min(idx, list.length)
  return [...list.slice(0, pos), fadingId, ...list.slice(pos)]
}
```

護符バッジ(`itemBadges`スニペット、`+page.svelte`)での使用例:

```svelte
{@const talismanFading = confiscateFadingTarget?.kind === 'talisman' ? confiscateFadingTarget : undefined}
{@const displayedItems = withFadingId(run.items, talismanFading?.id, talismanFading?.idx ?? 0)}
```

天啓・神託も同じ形(`confiscatedTarget.kind === 'revelationOrOracle' && confiscatedTarget.ref.kind === 'revelation'|'oracle'`で判定し、`ref.id`を`withFadingId`に渡す)で対応する。

レリックは要素型が`{ id: RelicId; tsukumoka: boolean }`のため、`withFadingId`は使わず専用のインライン処理を書く。没収前の`tsukumoka`状態は`confiscatedTarget`に含まれていないため、フェード中は`tsukumoka: false`固定で表示する(没収演出は500ms程度と短く、星表示の有無が一瞬違って見えても実害は小さいと判断する):

```svelte
{@const relicFading = confiscateFadingTarget?.kind === 'relic' ? confiscateFadingTarget : undefined}
{@const displayedRelics = relicFading
  ? [...run.relics.slice(0, Math.min(relicFading.idx, run.relics.length)), { id: relicFading.id, tsukumoka: false }, ...run.relics.slice(Math.min(relicFading.idx, run.relics.length))]
  : run.relics}
```

秘儀ボタン(`PlayArea.svelte`内、`{#if rites.length > 0}`ブロック)も同様に`withFadingId`で対応する。秘儀ボタンは`rites`(親から渡されるprops、`run.rites`相当)をそのままループしているため、`+page.svelte`側とは異なり`PlayArea.svelte`内で完結する:

```svelte
{@const riteFading = confiscateFadingTarget?.kind === 'rite' ? confiscateFadingTarget : undefined}
{@const displayedRites = withFadingId(rites, riteFading?.id, riteFading?.idx ?? 0)}
```

`{#each displayedRites as riteId, i (i)}`に切り替え、フェード中の要素は`disabled`固定(クリックできても`onUseRite`は既に配列から消えているIDのため実質何も起きない。念のため`fading`判定時は`onclick`を無効化する)にしてフェードクラスを適用する。

補完された要素には、対応する`confiscateFadingTarget`との一致判定(`kind`+`id`+`idx`)で`fading`フラグを立て、`shidasu-confiscate-fade`クラスを適用する。フェードアニメーション終了(500ms後、`confiscateFadingTarget`が`null`に戻るタイミング)と同時に、補完されていた要素も自然にリストから消える。

### C. CSS(崩れ落ちるフェード)

`sabotageAnimations.css`に新規keyframesを追加する:

```css
@keyframes shidasu-confiscate-fade {
  0% { transform: translateY(0); opacity: 1; filter: brightness(1); }
  30% { transform: translateY(-6px); filter: brightness(2); }
  100% { transform: translateY(20px); opacity: 0; filter: brightness(0.5); }
}

.shidasu-confiscate-fade {
  animation: shidasu-confiscate-fade 0.5s ease-in forwards;
}
```

`forwards`を指定し、アニメーション終了後もopacity:0の状態を維持する(500ms後に`confiscateFadingTarget`がnullになりDOMから除去されるまでの一瞬のちらつきを防ぐ)。

### D. 検知の配置

グループAと同じ`$effect.pre`パターンを使う。検知自体は`PlayArea.svelte`内の既存`lastSabotage`検知ブロックに分岐を追加し、`startConfiscateFadeAnimation`を呼ぶ。`riteConfiscate`(秘儀ボタン)は`PlayArea.svelte`内で完結するためこれで十分だが、`talismanConfiscate`・`revelationOracleConfiscate`・`relicConfiscate`(`+page.svelte`側の`itemBadges`が対象)は、グループAで確立した`onSealFlashChange`と同様のコールバックprops(`onConfiscateFadingChange`)経由で`confiscateFadingTarget`の値を`+page.svelte`側へ伝える。

```ts
} else if (current.id === 'talismanConfiscate' || current.id === 'riteConfiscate' || current.id === 'revelationOracleConfiscate' || current.id === 'relicConfiscate') {
  if (current.confiscatedTarget) {
    startConfiscateFadeAnimation(current.confiscatedTarget)
  }
}
```

対象プールが空(所持数0件)で没収が発動しなかった場合、効果関数は`{}`を返す(`confiscatedTarget`が未設定)ため、このガードで演出をスキップする。

## テスト

- **`confiscatedTarget`の設定**: `triggerSabotage`が没収系4種発動時に`lastSabotage.confiscatedTarget`へ正しい`kind`/`id`/`idx`を設定することをエンジンレベルのテストで確認する。対象プールが空の場合は`confiscatedTarget`が`undefined`のままであることも確認する。
- **アニメーション**: `/admin/shidasu-debug`のデバッグ発動ボタンで目視確認する(グループAの実装時、本編とデバッグ画面で`itemBadges`・封印演出配線が別実装だったため確認できない問題が発生した経緯があり、デバッグ画面側にも同様の`confiscateFadingTarget`配線を追加する)。
  - 各没収系妨害行動を発動し、対象バッジ/ボタンが崩れ落ちるフェードで消えることを確認する
  - フェード中(約500ms)は他の操作がブロックされ、完了後は正常に操作できることを確認する
  - 同名の護符・秘儀・レリックを複数所持している状態で発動し、対象の1つだけが正しく消えることを確認する
- `npm run build`・`npm run check`が通ることを確認する。

## スコープ外

- `talismanConfiscate`・`relicConfiscate`のショップ画面所持一覧への演出適用
- グループC(強制発動系)・グループD(カード移動系)・グループE(数値変化系)の演出実装
