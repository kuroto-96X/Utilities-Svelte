# 星の妨害行動 実装設計

> 対象: waveSlot3の星(現状は`restriction`による常時制約のみを持つ6種)に、一定ターンごとに能動的にゲーム状態を崩す「妨害行動」を追加する。妨害行動の仕組み全体(型・発動サイクル・UI)を実装し、`docs/shidasu/shidasu-star-sabotage-candidates.md`の候補33個のうち11個(各ターゲット1つずつ)を先行実装する。残り22個は別セッションで追加する。

## 背景・目的

`docs/shidasu/shidasu-roadmap.md`項目3「星の妨害行動の検討」。`Star`型には既に`sabotage`フィールドが予約されているが、現状は常に`null`で未使用。候補ブレインストーミング(`docs/shidasu/shidasu-star-sabotage-candidates.md`)で、操作対象別に11ターゲット・33候補を洗い出し済み。本設計ではこのうち各ターゲット1つずつ・計11個を実装し、仕組み全体(型定義・ターンカウント・抽選サイクル・UI表示)を作り切ることを目的とする。

## 方針(スコープ)

- 実装する11個: 山札(`stockPurge`)・場札(`columnReturn`)・チェーン(`chainSettle`)・コンボ(`comboBreather`)・護符(`talismanSeal`)・秘儀(`riteSeal`)・天啓/神託(`revelationOracleSeal`)・レリック(`relicConfiscate`)・捨て札(`tableauCardToDiscard`)・資産/星片(`currencyConfiscate`)・役ステータス(`roleSeal`)
- 既存waveSlot3の星6種(`closed-loop-planet`・`sealed-noble-planet`・`harsh-planet`・`twisted-odd-planet`・`exiling-color-planet`・`regicide-planet`)は、既存の`restriction`をそのまま維持しつつ、全て`sabotage: { kind: 'all' }`にする(実装済み11個全てが対象になる。将来候補が増えても自動的に対象へ加わる)
- 残り22候補・新規の星の追加・intervalTurnsの数値調整は本設計のスコープ外(別セッション)

## データモデル

`src/lib/game/shidasu/types.ts`に追加:

```ts
export type SabotageActionId =
  | 'stockPurge' | 'columnReturn' | 'chainSettle' | 'comboBreather'
  | 'talismanSeal' | 'riteSeal' | 'revelationOracleSeal' | 'relicConfiscate'
  | 'tableauCardToDiscard' | 'currencyConfiscate' | 'roleSeal'

// Star.sabotageの型。noneが既存デフォルト、allは実装済み全SabotageActionIdが対象
// (SABOTAGE_POOL全件を指す。将来候補が追加されても自動で対象に含まれる)、
// someは個別指定(将来、一部の候補だけを持つ星を追加する際に使う)。
export type StarSabotage =
  | { kind: 'none' }
  | { kind: 'all' }
  | { kind: 'some'; ids: SabotageActionId[] }
```

`Star.sabotage`フィールドの型を現状の`null`固定リテラルから`StarSabotage`に変更する(既存の全呼び出し箇所——`engine.ts`の`bossStarFor`相当・`params.ts`の`STAR_POOL`定義・`engine.test.ts`のテスト用星リテラル——を`sabotage: { kind: 'none' }`または`{ kind: 'all' }`に更新する)。

`WaveState`に追加:

```ts
// 妨害行動用: 次に発動する妨害の種別(星がnoneまたは候補0件ならnull)
pendingSabotageId: SabotageActionId | null
// 妨害行動用: 発動までの残りターン数(pendingSabotageIdがnullの間は0のまま)
sabotageTurnsRemaining: number
```

`src/lib/game/shidasu/sabotage.ts`(新規ファイル)に妨害行動プールを定義:

```ts
export interface SabotageActionDef {
  id: SabotageActionId
  name: string
  target: string       // 表示用ターゲット名(「山札」「場札」等)
  intervalTurns: number
  descTemplate: string // starRestrictionDetailと同様、プレイヤー向け説明文
}

export const SABOTAGE_POOL: SabotageActionDef[] = [ /* 11件、次節の表を参照 */ ]
```

## 発動ロジック

- **初期抽選**: `startWave`の呼び出し元(該当Waveの星を`stageStars[waveIndex]`から特定できる箇所)で、星の`sabotage`設定を見て初期の妨害を抽選し、`wave.pendingSabotageId`・`wave.sabotageTurnsRemaining`(選ばれた候補の`intervalTurns`)を設定する。`sabotage.kind === 'none'`、または対象候補が0件の場合は`pendingSabotageId: null`・`sabotageTurnsRemaining: 0`のままにする。
- **ターンカウント**: `playCard`・`drawStock`(いずれも`WaveState`層の純粋関数)側で、獲得点(gained)計算が発生するたびに`sabotageTurnsRemaining`を1減らす。既存のターン定義通り、`playCard`は常に該当し、`drawStock`は「パターン継続中かつ素朴(naive)所持時」のみ該当する。`pendingSabotageId`が`null`の場合は何もしない。
- **発動トリガー**: `playCard`・`drawStock`はカウントダウンのみを行い、実際の効果適用はしない(多くの候補が`items`・`rites`・`revelations`・`relics`・`currency`など`RunState`レベルの状態を必要とするため、`WaveState`層だけでは完結しない)。`applyPlayCard`・`applyDrawStock`(`RunState`層のラッパー関数、`engine.ts`)側で、`playCard`/`drawStock`呼び出し後に`wave.sabotageTurnsRemaining <= 0 && wave.pendingSabotageId !== null`を確認し、該当すれば新関数`triggerSabotage(params, run, wave.pendingSabotageId, rand)`を呼んで効果を適用した新しい`RunState`を得る。この関数は天啓Phase B(即時報酬獲得系)で確立した「`WaveState`層は素通し、`RunState`層の別関数が実処理を行う」という既存パターンを踏襲する。
- **再抽選**: `triggerSabotage`は効果適用後、対象の星の`sabotage`設定から次の妨害を再抽選し、`pendingSabotageId`・`sabotageTurnsRemaining`を設定し直す。抽選は毎回候補全体から一様ランダムに行い、直前と同じ妨害が連続する可能性もある。
- **他の呼び出し元への波及**: `applyStuckCheck`(手詰まり救済処理)も内部で`drawStock`を呼ぶため、同様に`sabotageTurnsRemaining`が0になりうる。実装時に`applyPlayCard`/`applyDrawStock`と同じトリガーチェックを追加するか検討する。

## 11個の効果仕様

| id | ターゲット | intervalTurns(初期値) | 効果 |
|---|---|---|---|
| `stockPurge` | 山札 | 6 | 山札の上から5枚を捨て札に置く |
| `columnReturn` | 場札 | 6 | ランダムに選んだ1列を山札に戻し、シャッフル後同じ列に裏向きで再配布する |
| `chainSettle` | チェーン | 8 | チェーンのカードを全て捨て札に送り、山札から1枚めくって新しいチェーンにする。コンボも0にする |
| `comboBreather` | コンボ | 5 | チェーンのカードはそのまま、コンボ数だけ0にする |
| `talismanSeal` | 護符 | 5 | 所持護符を1つランダムに選び、次の妨害発動まで効果を無効化する |
| `riteSeal` | 秘儀 | 5 | 所持秘儀を1つランダムに選び、次の妨害発動まで使用を禁止する |
| `revelationOracleSeal` | 天啓・神託 | 5 | 天啓または神託からランダムに1つ選び、次の妨害まで使用禁止にする(天啓は使用不可、神託は対応する役のレベル効果の適用を止める) |
| `relicConfiscate` | レリック | 7 | 所持レリックを1つランダムに選び、完全に失わせる |
| `tableauCardToDiscard` | 捨て札 | 4 | 場札からランダムに1枚選び捨て札に送る |
| `currencyConfiscate` | 資産(星片) | 6 | 所持する星片を固定5減らす(所持量が5未満なら0にする) |
| `roleSeal` | 役ステータス | 6 | ランダムな2役を選び、次の妨害発動までそれらのボーナスを無効化する |

intervalTurnsは初期値の目安(効果が強い・永続的なものほど長め)。`SABOTAGE_POOL`のリテラル値として持たせ、数値調整は`SABOTAGE_POOL`の値を直接編集する(`STAR_POOL`と同じ管理方針、`shidasu.config.json`側の別テーブルには分離しない)。

**封印系(`talismanSeal`・`riteSeal`・`revelationOracleSeal`相当)の「次の妨害発動まで」の実装**: 妨害の発動サイクルは常に1つ(`pendingSabotageId`)しか同時に走らないため、封印状態も常に最大1件しか存在しない。`RunState`に単一フィールドを追加する:

```ts
// 妨害「封印系」用: 現在封印中の対象(無ければnull)。triggerSabotageが新しい妨害を
// 発動させる直前に必ずnullへリセットしてから、今回の効果がseal系ならここに設定し直す
activeSeal:
  | { kind: 'talisman'; id: ItemId }
  | { kind: 'rite'; id: RiteId }
  | { kind: 'revelationOrOracle'; ref: HeldRevelationOrOracleRef }
  | null
```

`applyPlayCard`・`applyDrawStock`は、`playCard`/`drawStock`へ渡す`items`を`run.items.filter(id => !(activeSeal?.kind === 'talisman' && activeSeal.id === id))`のように実効リストへ差し替えて渡す(`run.items`自体からは削除しない。所持表示は維持したまま効果だけ無視する)。秘儀の使用可否(`canUseRite`)・天啓/神託の使用可否(`canUseRevelation`/`useOracle`呼び出し元)も同様に、呼び出し前に`activeSeal`を確認して除外する。

## UI表示

`src/routes/game/shidasu/+page.svelte`の既存の星情報表示(星名+`starRestrictionDetail`の1行)に、妨害用の行を追加する。

- `wave.pendingSabotageId`が`null`でなければ、`SABOTAGE_POOL`から対応する`name`を引き、「次の妨害: {name}(あと{sabotageTurnsRemaining}ターン)」の形式で種類・残りターン数を両方表示する
- `pendingSabotageId`が`null`(星が`sabotage: { kind: 'none' }`)の場合はこの行自体を表示しない
- 表示スタイルは既存の`starRestrictionDetail`表示行(`text-[11px] text-slate-500`)に揃える

## 既存6星への適用

`params.ts`の`STAR_POOL`定義のうち、waveSlot3の6件(`closed-loop-planet`・`sealed-noble-planet`・`harsh-planet`・`twisted-odd-planet`・`exiling-color-planet`・`regicide-planet`)全てに`sabotage: { kind: 'all' }`を設定する。waveSlot1・2の2件(`ordinary-moon`・`slightly-bigger-moon`)は`sabotage: { kind: 'none' }`のまま変更しない。

## テスト

- `sabotage.ts`: `SABOTAGE_POOL`が11件・IDの重複無し・`intervalTurns`が全て正の整数であることを検証するテストを追加する。
- `engine.ts`: 以下の統合テストを追加する。
  - `startWave`相当の初期化で、`sabotage: { kind: 'all' }`の星の場合`pendingSabotageId`が`SABOTAGE_POOL`のいずれかに設定され、`sabotage: { kind: 'none' }`の星の場合`null`のままであること
  - `applyPlayCard`を`sabotageTurnsRemaining`回連続で呼ぶと、最後の呼び出しで該当する妨害効果が適用され、`pendingSabotageId`・`sabotageTurnsRemaining`が再設定されること(11種それぞれについて、効果適用後の状態を個別に検証)
  - `drawStock`のnaiveパス以外(素朴非所持、またはパターン非継続)では`sabotageTurnsRemaining`が減らないこと
- `npm run build`・`npm run check`・`npm run test`が全て通ることを確認する。
- `npm run dev`で実際にWave3(waveSlot3)の星が出るまで進め、UIに次の妨害・残りターン数が表示されること、規定ターン数プレイすると実際に効果が発動し表示が更新されることを目視確認する。

## スコープ外

- 候補一覧の残り22個(各ターゲットの2〜3番目の候補)の実装
- waveSlot3以外の星への妨害行動の追加、新規の星の追加
- intervalTurns・効果の数値バランス調整(既定値のまま実装し、実プレイフィードバックは別途)
- `SABOTAGE_POOL`の管理画面(`/admin/shidasu-packs`相当)の新設
