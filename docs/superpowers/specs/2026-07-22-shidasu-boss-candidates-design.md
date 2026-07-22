# Shidasu ボス制約の複数候補化 設計 — Phase 2

## 0. 背景・目的

`docs/shidasu/shidasu-roadmap.md`項目4「ステージ構成の検討」で構想されていた、ボス階級(小凶/中凶/大凶)ごとの制約を複数候補化し、ボスウェーブ突入のたびにランダムで選ばれるようにする機能を実装する。ロードマップの構想メモは以下のフェーズに分割して進めており、今回はPhase 2を対象とする。

- Phase 1(実装済み): 9ウェーブ(3ステージ×3ウェーブ)構成のコア変更。ボス階級ごとの制約は各1種類固定
- **Phase 2(今回)**: ボス制約の複数候補化・ランダム選出
- Phase 3(実装済み): 「ラン」の複数選択・ラン固有の特殊ルール(「スプレッド」機能)
- Phase 4(未着手、ロードマップ項目5のゲーム内通貨実装後): ボスクリア時の特別報酬

本ドキュメントはPhase 2のみを対象とする。今回は各階級に1種類ずつ新規候補を追加し(各階級1→2種類)、将来さらに追加できるデータモデルにする。「まずは1つずつ増やす」という方針のもと、最終的に各階級5個以上を用意する構想はあるが、今回のスコープは各階級+1のみとする。

## 1. 今回追加する新規候補

| 階級 | kind(内部識別子) | 挙動 |
|---|---|---|
| 小凶 | `faceLock` | 絵札はコンボ2以上でのみ取れる(既存の`StageModifier`型に元々実装済みだが、Phase 1でどのボス階級にも割り当てられておらず現状は到達不能だったものを再利用する) |
| 中凶 | `oddCombo` | コンボ数が奇数のとき獲得点が0になる(コンボ数自体は進行する) |
| 大凶 | `face` | 絵札(J・Q・K)の非ワイルドカードを取ると獲得点が0になる(ワイルドは対象外) |

既存の3候補(`noLoop`=小凶、`lowCombo`=中凶、`suit`=大凶)とあわせて計6候補になる。

## 2. 用語・命名モチーフ

各候補(ボス)の名前は、七つの大罪(傲慢・嫉妬・憤怒・怠惰・強欲・暴食・色欲)にそれぞれ紐づく「派生悪徳(娘罪)」という中世カトリック神学の体系から命名する。既存の命名体系(秘儀=ルーン文字、天啓=二十八宿、神託=八卦、スプレッド=大アルカナ)に並ぶ新しい体系となる。

| kind | ボス名 | 由来 |
|---|---|---|
| `noLoop` | 頑迷 | 傲慢の娘罪 |
| `faceLock` | 偽善 | 傲慢の娘罪 |
| `lowCombo` | 憤慨 | 憤怒の娘罪 |
| `oddCombo` | 口論 | 憤怒の娘罪 |
| `suit` | 裏切り | 強欲の娘罪 |
| `face` | 詐欺 | 強欲の娘罪 |

将来候補を追加する際も、同じ七つの大罪の娘罪体系から命名する。

## 3. データモデル

各候補の**具体的な挙動(kind)はコードに紐づく固定値**(新しい挙動を追加するには実装が必要)だが、**どの階級(小凶/中凶/大凶)に属するかは管理画面から変更できるデータ**として持つ。既存の護符・秘儀・天啓と同様、フラットなプール形式で管理する。

```ts
type BossKind = 'noLoop' | 'faceLock' | 'lowCombo' | 'oddCombo' | 'suit' | 'face'
type BossTierKey = 'shoukyou' | 'chuukyou' | 'taikyou'

interface BossEntry {
  name: string          // ボス名(管理画面で編集可能、七つの大罪の娘罪から選ぶ)
  tier: BossTierKey      // どの階級に属するか(管理画面で変更可能)
  desc: string           // 説明文テンプレート({maxCombo}等のプレースホルダーを含められる)
  maxCombo?: number      // lowComboのみ使用
}

// ShidasuParamsに追加
bosses: Record<BossKind, BossEntry>
```

`bossTiers`(階級そのものの表示名)は現状の`{shoukyou:{name}, chuukyou:{name}, taikyou:{name}}`のまま維持する(`chuukyou.maxCombo`は`bosses.lowCombo.maxCombo`へ移動する)。

`RunState`の`currentBossCandidateIndex`(固定2択を前提にしたインデックス)ではなく、実際に選ばれた候補の識別子そのものを保持する`currentBossKind: BossKind | null`を追加する(可変長プールに対応するため)。

## 4. ロジックの変更点

ボスウェーブの挙動は`run.currentBossKind`の**値そのもの**によって決まり、それがどの階級に割り当てられているか(`bosses[kind].tier`)には依存しない。階級への割り当ては「次にどの候補を抽選できるか」のみを左右する。

```ts
export function stageModifierFor(params, run): StageModifier {
  if (!isBossWave(params, run.waveIndex)) return 'none'
  if (run.currentBossKind === 'noLoop') return 'noLoop'
  if (run.currentBossKind === 'faceLock') return 'faceLock'
  return 'none'
}

export function bossScoreLockFor(params, run): BossScoreLock {
  if (!isBossWave(params, run.waveIndex)) return null
  switch (run.currentBossKind) {
    case 'lowCombo': return { kind: 'combo', maxCombo: params.bosses.lowCombo.maxCombo }
    case 'oddCombo': return { kind: 'oddCombo' }
    case 'suit': return run.currentGreatMisfortuneSuit ? { kind: 'suit', suit: run.currentGreatMisfortuneSuit } : null
    case 'face': return { kind: 'face' }
    default: return null
  }
}
```

`BossScoreLock`型に`{kind:'oddCombo'}`・`{kind:'face'}`を追加し、`playCard`/`drawStock`の得点ロック判定に対応する分岐を追加する(`oddCombo`=`effectiveCombo % 2 === 1`なら無得点、`face`=`!card.wild && isFace(card)`なら無得点)。

ステージが繰り上がる瞬間(既存の`nextWaveLocation`/`nextGreatMisfortuneSuit`と同じタイミング)に、新しい階級に属する候補群から`rand`で1つを抽選する。

```ts
function nextBossKind(params: ShidasuParams, run: RunState, newLocation: {...}, rand: () => number): BossKind | null {
  if (newLocation.stageIndex === run.stageIndex) return run.currentBossKind // 同じステージ内では維持
  const tierKey = bossTierKeyOf(newLocation.stageIndex) // 'shoukyou' | 'chuukyou' | 'taikyou'
  const candidates = (Object.keys(params.bosses) as BossKind[]).filter(kind => params.bosses[kind].tier === tierKey)
  if (candidates.length === 0) return null // 管理画面のバリデーションで基本的に発生しない
  return candidates[Math.floor(rand() * candidates.length)]
}
```

大凶に対応する`kind`(`suit`)が選ばれた場合のみ、既存の対象スート抽選(`rollGreatMisfortuneSuit`)を行う。`suit`以外が選ばれた場合は`currentGreatMisfortuneSuit`を`null`のままにする。

`beginRun`もラン開始時点(ステージ0=小凶)の候補抽選を同じロジックで行う。

## 5. UI表示の変更

常時表示エリア(`upcomingBossInfo`)は、`run.currentBossKind`から`params.bosses[kind]`を引いて、ボス名(`name`)と説明文(`desc`、`{maxCombo}`等をテンプレート置換したもの)を表示する。`suit`候補のみ、実際に抽選された対象スートをコード側で追加表示する(既存の挙動を維持)。

## 6. 管理画面

新規ページ `/admin/shidasu-bosses` を作成する。既存の`/admin/shidasu-rites`と同じ表形式パターン(名前・パラメータ・説明文テンプレート・プレビュー・実際の効果(監査用))を踏襲し、以下の点を追加する。

- 「階級」列を追加し、`<select>`で小凶/中凶/大凶を切り替えられるようにする(`entry.tier`にバインド)
- ページ上部に、階級ごとの現在の件数(例:「小凶: 2件 / 中凶: 2件 / 大凶: 2件」)を表示する
- いずれかの階級が0件になった場合、保存をブロックする(既存の`hasValidationError`と同様のバリデーション)
- 「実際の効果(監査用)」列用に新規`bossActualEffects.ts`を作成し、既存の`riteActualEffects.ts`等と同じ形式で各`kind`の実際の挙動を記述する

`/admin/shidasu`の`BossTiersSection.svelte`は、階級そのものの表示名(小凶/中凶/大凶の`name`)を編集するセクションとして引き続き残す。`chuukyou.maxCombo`欄のみ削除する(`bosses.lowCombo.maxCombo`へ移動したため、新規ページ側で編集する)。

## 7. スコープ外(Phase 2の対象外)

- 各階級5個以上への拡充(今回は各階級2個のみ。将来的な追加は同じ命名体系・データモデルを使って段階的に行う)
- ボス制約の候補プールが空になった場合の実行時フォールバック処理(管理画面のバリデーションで防ぐため、ランタイムでの防御的処理は最小限に留める)

## 8. 受け入れ基準

1. 小凶ボスウェーブ突入時、`noLoop`(頑迷)・`faceLock`(偽善)のいずれかが`rand`でランダムに選ばれ、そのステージの3ウェーブ間固定で使われる
2. 中凶ボスウェーブ突入時、`lowCombo`(憤慨)・`oddCombo`(口論)のいずれかがランダムに選ばれる。`oddCombo`が選ばれた場合、コンボ数が奇数のプレイは獲得点が0になる(コンボ自体は進行する)
3. 大凶ボスウェーブ突入時、`suit`(裏切り)・`face`(詐欺)のいずれかがランダムに選ばれる。`suit`が選ばれた場合のみ、対象スートが別途抽選される。`face`が選ばれた場合、絵札(非ワイルド)を取ると獲得点が0になる
4. 常時表示エリアに、選ばれたボスの名前(例:「偽善」)と説明文が表示される
5. `/admin/shidasu-bosses`で各ボスの階級・名前・パラメータ・説明文を編集でき、階級ごとの件数が表示される。いずれかの階級が0件になると保存がブロックされる
6. 既存のテスト・機能(護符・秘儀・天啓・神託、スプレッド選択等)に回帰がない
