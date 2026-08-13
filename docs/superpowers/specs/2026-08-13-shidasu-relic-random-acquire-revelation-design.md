# 天啓「鬼」(レリックランダム獲得) 設計書

> 対象: 未所持のレリックをランダムに1つ獲得する天啓を新規実装する。名前は二十八宿のうち唯一未割当だった「鬼(き)」を使う。これを実装すると二十八宿28宿全てが実装完了となる。

## 背景・目的

天啓は二十八宿28宿中27宿まで実装済みで、「鬼」のみが`mansions.ts`に見た目候補として温存されたまま長らく未定になっていた。2026-08-13の天啓「虚」(レリック付喪化)実装により、レリックシステムに関する機能(付喪化トリガー)は揃ったが、「レリックを増やす」天啓はまだ存在しない(現状レリックの入手経路はショップ購入のみ)。

既存の護符ランダム獲得天啓「星(subaru)」と同じ設計思想で、レリック版の「未所持のものをランダムに1つ獲得する」効果を実装する。

## 方針

- **既存の「星」と同じ設計**: `grantRevelationReward`内の`subaru`ケース(未所持護符からランダムに1つ獲得)とほぼ同一のロジックをレリック向けに実装する。
- **効果分類**: 天啓Phase B(RunStateレベル即時効果)。`wave`・`deckComposition`は変更しない(`applyRevelationEffect`側はno-op)。
- **数値パラメータ無し**: 単純な即時効果であり、`n`のような数値パラメータは持たない。
- **UIは変更不要**: 列選択もレリック選択(天啓「虚」で追加した仕組み)も不要な、完全な即時効果。既存の天啓使用フローにそのまま乗る。

## 効果仕様

- 名前: 鬼(き)
- 内部ID: `oni`(二十八宿「鬼」の読みは"ki"だが、既存の天啓「箕」が`RevelationId`の`'ki'`を使用済みのため、衝突を避けて`'oni'`とする)
- 効果説明文: 「未所持のレリックの中からランダムに1つ獲得する」
- 使用条件(`canUseRevelation`): 未所持のレリック(`RELIC_POOL`のうち`RunState.relics`に含まれないもの)が1つ以上あれば使用可。全レリック(現在13種)を所持済みなら使用不可。
- 効果: `RELIC_POOL`から未所持のものをフィルタし、ランダムに1つ選んで`{ id: 選ばれたID, tsukumoka: false }`として`run.relics`に追加する。既存の「星」の護符版ロジックと同型。

## データ・ロジック変更

### 型・データ

- `src/lib/game/shidasu/types.ts`: `RevelationId`に`'oni'`を追加(`RELIC_POOL`未割当宿の位置、`kaku`〜`karasu`の並びの末尾に追加する)。件数コメントを「27種」→「28種」、「残り1宿(鬼)」の記述を削除する(全28宿実装完了になるため)。
- `src/lib/game/shidasu/revelations.ts`: `REVELATION_POOL`に`'oni'`を追加。
- `src/lib/game/shidasu/params.ts` / `shidasu.config.json`: `revelations.oni = { name: '鬼', desc: '未所持のレリックの中からランダムに1つ獲得する' }`(数値パラメータ無し、`subaru`/`ryuu`等と同じ形)。

### `revelationEffects.ts`

- `applyRevelationEffect`: `oni`のケースは追加せず、`default`(no-op)に委ねる。
- `canUseRevelation`: `oni`のケースを追加する。天啓「虚」実装時に`relics`パラメータが既に追加されているため、そのまま利用できる:
  ```ts
  if (revelationId === 'oni') {
    const ownedIds = new Set(relics.map(r => r.id))
    return RELIC_POOL.some(id => !ownedIds.has(id))
  }
  ```

### `engine.ts`

- `grantRevelationReward`に`oni`のケースを追加する(`subaru`ケースと対になる位置に配置する):
  ```ts
  case 'oni': {
    const ownedIds = new Set(runAfterRemoval.relics.map(r => r.id))
    const available = RELIC_POOL.filter(id => !ownedIds.has(id))
    if (available.length === 0) return {}
    const picked = available[Math.floor(rand() * available.length)]
    return { relics: [...runAfterRemoval.relics, { id: picked, tsukumoka: false }] }
  }
  ```
- `RELIC_POOL`のimportが`engine.ts`冒頭に無ければ追加する(既存の`relics.ts`からのimportを確認する)。

## テスト

- `revelationEffects.ts`: `canUseRevelation`が「未所持レリックの有無」を正しく判定することを検証するテストを追加する(全所持済み・未所持あり・レリック0件所持の3パターン)。
- `engine.ts`: `useRevelation`+`grantRevelationReward`の統合テストとして、以下を検証する:
  - 未所持レリックが複数ある状態で使用 → `run.relics`に1件追加され、追加されたエントリが`tsukumoka: false`であること
  - 全レリックを所持済みの状態で使用 → 何も変化しないこと(`canUseRevelation`が使用不可を返すため、そもそも効果適用まで到達しないことも合わせて確認する)
- `npm run build`・`npm run check`・`npm run test`が全て通ることを確認する。
- `npm run dev`で実際にラン・ショップを進めて天啓「鬼」を入手し、使用してレリックが1つ増えること、既存の所持レリックバッジに正しく追加表示されることを目視確認する。**注意**: 実プレイで「天啓「鬼」を所持した状態」まで到達するには運が絡み時間がかかることがある(直近の天啓「虚」実装時、実プレイでの到達を試みたサブエージェントが長時間を要した実績あり)。目視確認時は、`+page.svelte`の`run`初期化部分を一時的に`beginRun`+`startWave`+目的の`revelations`/`relics`を注入した状態に差し替え、確認後に完全に元へ戻す(`git checkout --`等で差分ゼロを確認する)方式を推奨する。

## スコープ外

- レリック個別候補の追加(現状13種のまま)
- 天啓「鬼」以外の残タスク(このタスクで二十八宿は全て実装完了となるため、今後天啓の新規追加は無い想定。将来的な拡張が必要になった場合は別途モチーフ・体系から再検討する)
