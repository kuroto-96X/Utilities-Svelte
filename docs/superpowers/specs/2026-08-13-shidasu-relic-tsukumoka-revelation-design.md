# 天啓「虚」(レリック付喪化) 設計書

> 対象: 所持レリックを「付喪化」させる天啓を新規実装する。`docs/superpowers/specs/2026-08-12-shidasu-relic-system-design.md`で「付喪化のトリガーとなる天啓の実装は本設計のスコープ外(別セッションで検討)」として保留されていた事項を実施する。

## 背景・目的

レリックシステム(2026-08-12実装)は、所持レリック個体ごとに`tsukumoka: boolean`(付喪化状態)を持つが、これをtrueにする手段(トリガー)が一切実装されていなかった。当時の設計で「将来実装する天啓が、所持レリックの中からプレイヤーが選んだ1つを付喪化させる(ランダムでも一括でもなく、選択式)」という方針だけが決められ、実装は先送りされていた。

本specはこのトリガーとなる天啓を実装する。名前は「虚(きょ)」を採用する。二十八宿のうち、本セッションの別作業(護符「暗雲」・天啓「虚」の機能重複削除、2026-08-13)で一度削除された名前だが、今回は全く別の効果として再利用する。

## 方針

- **効果分類**: 天啓Phase B(`docs/superpowers/specs/2026-08-09-shidasu-revelation-phase-b-design.md`)と同じ、RunStateレベルの即時効果として実装する。`wave`・`deckComposition`は変更しない(`applyRevelationEffect`側はno-op)。実処理は`engine.ts`の`grantRevelationReward`で行う。
- **対象選択方式**: 先行spec通り「選択式」を採用する。ランダム選出・一括付喪化は行わない。
- **既存の列選択機構とは独立させる**: 天啓の対象選択には既に`pendingRevelationTarget`(場札列選択・場札プレビュー)という仕組みがあるが、これは場札変更を伴う天啓専用に密結合している。「所持レリックから選ぶ」という性質の異なる対象を無理に同じ仕組みに統合すると複雑化するため(YAGNI)、新しい独立した選択状態・UIを追加する。
- **数値パラメータ無し**: 単純な選択式のON/OFF効果であり、`n`のような数値パラメータは持たない。

## 効果仕様

- 名前: 虚(きょ)
- 効果説明文: 「所持レリックの中から選んだ1つを付喪化させる(既に付喪化済みのレリックは選べない)」
- 使用条件(`canUseRevelation`): 未付喪化(`tsukumoka === false`)の所持レリックが1つ以上あれば使用可。0個なら使用不可。
- 効果: 選択されたレリック(`RelicId`で識別、`RunState.relics`は重複を持たないため`id`だけで一意に特定できる)の`tsukumoka`を`true`に更新する。選択が無効(対象なし・既に付喪化済み・存在しない)な場合は何もしない。

## データ・ロジック変更

### 型・データ

- `src/lib/game/shidasu/types.ts`: `RevelationId`に`'kyo'`を再追加(削除前と同じ位置に戻す)。
- `src/lib/game/shidasu/revelations.ts`: `REVELATION_POOL`に`'kyo'`を再追加。
- `src/lib/game/shidasu/params.ts` / `shidasu.config.json`: `revelations.kyo = { name: '虚', desc: '所持レリックの中から選んだ1つを付喪化させる(既に付喪化済みのレリックは選べない)' }`(数値パラメータ無し、`hotori`/`ryuu`等と同じ形)。

### `revelationEffects.ts`

- `applyRevelationEffect`: `kyo`のケースは追加せず、`default`(no-op、`{ wave, deckComposition }`をそのまま返す)に委ねる。Phase B系(`subaru`等)と同じパターン。
- `canUseRevelation`: `kyo`のケースを追加する。ただしこの関数は現状`wave: WaveState`のみを受け取り`RunState.relics`にアクセスできないため、シグネチャ変更が必要になる(詳細は「実装上の注意」参照)。

### `engine.ts`

- `useRevelation`関数に新しい引数`targetRelicId: RelicId | null`を追加する(既存の`targetCol: number | null`とは独立したパラメータ)。
- `grantRevelationReward`関数にも`targetRelicId`を渡すよう引数を追加し、`kyo`のケースを新設する:
  ```ts
  case 'kyo': {
    if (targetRelicId === null) return {}
    const relic = runAfterRemoval.relics.find(r => r.id === targetRelicId)
    if (!relic || relic.tsukumoka) return {}
    return { relics: runAfterRemoval.relics.map(r => r.id === targetRelicId ? { ...r, tsukumoka: true } : r) }
  }
  ```
- `useRevelation`を呼んでいる他の箇所(`buyIndividualRevelationUse`・`pickPackRevelationUse`)は、Phase B系天啓が元々これらの経路(バラ売り即使う・福袋即使う)からは`grantRevelationReward`を呼ばない(`applyRevelationEffect`のno-opのみが実行される)既存の仕様と同じであるため、変更不要。虚も同様に、これらの経路から使っても何も起きない(既存のPhase B天啓と同じ挙動)。

### 実装上の注意: `canUseRevelation`のシグネチャ

現状の`canUseRevelation(params, wave, revelationId)`は`RunState`を受け取らないため、「所持レリックに未付喪化のものがあるか」を判定できない。以下のいずれかの対応が実装時に必要:

- (推奨)`canUseRevelation`に`run: RunState`を追加する(呼び出し元は`engine.ts`内の数箇所、`+page.svelte`内のボタン活性化判定の数箇所)。
- 代替案: `kyo`専用の判定を`canUseRevelation`とは別の小さなヘルパー関数(例: `canUseKyo(run: RunState): boolean`)として切り出し、UI側の該当箇所でのみ呼び分ける。

どちらを採るかは実装計画(plan)作成時に、既存の`canUseRevelation`呼び出し箇所の数と影響範囲を確認した上で決定する。

## UI設計

### 新しい選択状態

`src/routes/game/shidasu/+page.svelte`に新規`$state`を追加する:

```ts
let pendingRelicTargetRevelationId = $state<RevelationId | null>(null)
```

### フロー

1. 所持天啓一覧で「虚」をクリックする(`handleUseRevelationClick`内で`revelationId === 'kyo'`のケースとして新規分岐、既存の`revelationNeedsTarget`(列選択要否)とは別に判定する)。
2. 場札プレビュー(`revelationPreviewWave`・`beginRevelationPreview`)は起動しない(場札に一切変更が無いため不要)。
3. `pendingRelicTargetRevelationId = 'kyo'`をセットし、所持レリック一覧を表示する小さなオーバーレイ/パネルを出す。未付喪化のレリックのみクリック可能(バッジのdisabled表示、または未付喪化のもののみ一覧に出す)。付喪化済みのレリックには★マークが既に付いている(既存仕様)。
4. レリックをクリックして確定 → `useRevelation(params, run, 'kyo', null, targetRelicId)`を呼び、`pendingRelicTargetRevelationId = null`にする。
5. キャンセルボタンで`pendingRelicTargetRevelationId = null`にして中断できる。

### ボタン活性化

所持天啓一覧の「虚」使用ボタンは、`canUseRevelation`(または上記の代替ヘルパー)の判定結果に応じてdisabled表示にする(既存の他天啓と同じパターン)。

## テスト

- `revelationEffects.ts`: `canUseRevelation`が未付喪化レリックの有無を正しく判定することを検証するテストを追加する(レリック0件・全て付喪化済み・1件以上未付喪化の3パターン)。
- `engine.ts`: `useRevelation`+`grantRevelationReward`の統合テストとして、以下を検証する:
  - 未付喪化レリックを対象に指定 → 該当エントリの`tsukumoka`が`true`になり、他のエントリは変化しないこと
  - 対象未指定(`targetRelicId: null`) → 何も変化しないこと
  - 既に付喪化済みのレリックを対象に指定 → 何も変化しないこと(誤操作防止)
  - 所持していないレリックIDを対象に指定 → 何も変化しないこと
- `npm run build`・`npm run check`・`npm run test`が全て通ることを確認する。
- `npm run dev`で`/game/shidasu`から実際にラン・ショップを進めてレリックを購入し、天啓「虚」を購入(温存)した状態を作った上で、虚の使用→レリック選択→付喪化(★マーク表示・tsukumokaDescへの切り替わり)までの一連の流れを目視確認する。`/admin/shidasu-debug`は`WaveState`ベースのサンドボックスで`RunState`・レリックの仕組みを持たないため、本機能の動作確認には使えない(先行セッションで確認済み)。

## スコープ外

- レリック個別候補(招き猫・数珠など13種)の付喪化後の数値バランス調整(既存の実装のまま)
- 天啓「鬼」(二十八宿のうち唯一まだ割り当てられていない宿)の実装
- 複数レリックを一度に付喪化させる効果、またはランダム付喪化効果(先行spec・本specとも選択式1つのみと明記)
