# 護符「暗雲」・天啓「虚」の削除 設計書

> 対象: 護符「暗雲」(`darkClouds`)・天啓「虚」(`kyo`)を削除する。どちらも`extraTableauRows`(場札の配布行数増加)のみを効果とする単機能アイテムで、機能が完全に重複している。

## 背景・目的

`docs/shidasu/done/shidasu-relic-candidates.md`のレリック候補検討過程(2026-08-12)で、「Wave開始時、場札に配る行数を+nする」というレリック候補「独楽」が、既存の護符「暗雲」・天啓「虚」と同じ`extraTableauRows`の仕組みを使っており機能重複することが判明した。当時は「暗雲・虚をどう扱うか(削除/再設計)は別セッションで検討したうえで、改めてレリック化を検討する」として保留し、`docs/shidasu/shidasu-roadmap.md`項目5に今後の検討課題として記録した。

本specはその保留事項を解消し、暗雲・虚を削除する。今回は削除のみを行い、新規効果の割り当て(独楽のレリック化検討など)は別セッションで行う。

## 方針

- **単純削除**: 秘儀A候補の削除(2026-08-11、同一セッション内で新効果を再設計・復元)とは異なり、今回は削除のみで完結させる。空いた「暗雲」「虚」の名前・型メンバーは再利用しない(型自体からリテラルを取り除く)。
- **セーブデータの後方互換性は考慮不要**: `/game/shidasu`にはlocalStorage等の永続化機構が無く、削除対象IDを含む既存セーブデータが存在しうる状況ではない。
- **`mansions.ts`は変更不要**: 「虚」の名前候補は`RevelationId`とは独立した表示用リスト(管理画面の名前`<select>`用)であり、削除後も将来天啓を追加する際の候補名として残り続ける(既存の「鬼」と同じ扱い)。

## 変更内容

### 護符「暗雲」(darkClouds)の削除

- `src/lib/game/shidasu/types.ts`: `ItemId`ユニオンから`'darkClouds'`を除去
- `src/lib/game/shidasu/items.ts`: `ITEM_POOL`から除去
- `src/lib/game/shidasu/itemGroups.ts`: グループ13(`['promise', 'darkClouds', 'regeneration']`)から除去
- `src/lib/game/shidasu/itemActualEffects.ts`: `darkClouds:`の監査用エントリを削除
- `src/lib/game/shidasu/params.ts`: `talismans`型定義から`darkClouds`フィールドを削除、`DEFAULT_PARAMS.talismans.darkClouds`を削除
- `src/lib/game/shidasu/shidasu.config.json`: `talismans.darkClouds`エントリを削除
- `src/lib/game/shidasu/engine.ts`: `startWave`内の`rows`計算式
  ```ts
  const rows = params.layout.rows + (items.includes('darkClouds') ? params.talismans.darkClouds.r : 0) + extraTableauRows
  ```
  を
  ```ts
  const rows = params.layout.rows + extraTableauRows
  ```
  に簡略化する。
- `src/lib/game/shidasu/engine.test.ts`:
  - 「暗雲の護符所持時: 配布行数が増えていても...(バグ回帰テスト)」テストを削除
  - 「暗雲: ウェーブ開始時、場札がrows+r枚配られる」テストを削除
  - 「暗雲を持たなければ通常通りrows枚」テストは、暗雲の有無を対比する目的が無くなるため、削除するか(baseline挙動が他の`startWave`系テストで既にカバーされていることを確認したうえで)、「護符無しなら通常通りrows枚」のような一般的な名前にリネームして残すかを実装時に判断する。他に同等のbaseline検証テストが無ければリネームして残す。
  - `DEFAULT_PARAMS.talismans.darkClouds.r`を検証している1行を削除
- `src/lib/game/shidasu/items.test.ts`:
  - 「99種類のアイテムが定義されている」テストの期待値を98に更新(テスト名も「98種類」に変更)
  - `darkClouds`を含む配列リテラルから除去(配列の長さ検証も20→19に調整)

### 天啓「虚」(kyo)の削除

- `src/lib/game/shidasu/types.ts`: `RevelationId`ユニオンから`'kyo'`を除去
- `src/lib/game/shidasu/revelations.ts`: `REVELATION_POOL`から除去
- `src/lib/game/shidasu/revelationActualEffects.ts`: `kyo:`の監査用エントリを削除
- `src/lib/game/shidasu/params.ts`: `revelations`型定義から`kyo`フィールドを削除、`DEFAULT_PARAMS.revelations.kyo`を削除
- `src/lib/game/shidasu/shidasu.config.json`: `revelations.kyo`エントリを削除
- `src/lib/game/shidasu/revelationEffects.ts`:
  - `canUseRevelation`内の`case 'kyo':`を削除
  - 効果適用スイッチ内の`case 'kyo':`を削除
- `src/lib/game/shidasu/engine.ts`: 以下3箇所の`extraTableauRows`計算
  ```ts
  const extraTableauRows = revelationId === 'kyo' ? run.extraTableauRows + params.revelations.kyo.n : run.extraTableauRows
  ```
  を`run.extraTableauRows`を直接参照する形に簡略化する(`kyo`削除後は型エラーになるため必須の変更)。対象は`buyIndividualRevelationUse`・`pickPackRevelationUse`・秘儀/天啓/神託使用本体(`useRevelation`相当)の3箇所。
- `src/lib/game/shidasu/revelationEffects.test.ts`:
  - 「虚: 山札の上からn行(列数×n枚)を各列の末尾に配る」テストを削除
  - 「虚: 使用条件は山札が(列数×n)枚以上であること」テストを削除
  - `revelationNeedsTarget`の一覧検証内、`expect(revelationNeedsTarget('kyo')).toBe(false)`の1行を削除

### ドキュメント更新

- `docs/shidasu/shidasu-roadmap.md`
  - 項目1「護符の効果の検討」: 「合計で１５０枚になるようにする(現状100枚、残り50枚を新規検討)。」→「合計で１５０枚になるようにする(現状98枚、残り52枚を新規検討)。」(暗雲削除分に加え、既存の陳腐化(実際は既に99枚だった)もあわせて修正)
  - 項目2「天啓の追加の検討」: 「モチーフの二十八宿は28宿中27宿が実装済み」→「28宿中26宿が実装済み」
  - 項目5「レリックの追加の検討」内の「今後の検討課題」に、暗雲・虚の削除が完了した旨と、独楽のレリック化検討が再開可能になった旨を追記
  - 項目5メモ内、項目3への相互参照で残っていた旧タイトル「項目5「レリックの実装」」を現在のタイトル「項目5「レリックの追加の検討」」に訂正(前回リネーム時の漏れ)
  - 「完了済み(履歴)」の末尾に新規エントリを追加: 暗雲・虚を削除した経緯(独楽レリック候補検討で判明した機能重複の解消)・件数変化(護符98種・天啓26宿)を記録
- `docs/shidasu/shidasu-current-rules.md`
  - 7.1護符: 「現在**99種**実装済み」→「現在**98種**実装済み」
  - 7.3天啓: 「全28宿中**27宿**が効果実装済み」→「全28宿中**26宿**が効果実装済み」

## テスト

- 既存テストのうち、削除対象アイテムの効果を直接検証しているテスト(前掲)は削除する。
- 件数アサーション(`ITEM_POOL`長・`REVELATION_POOL`長・関連する数値チェック)は新しい件数に更新する。
- `npm run build`・`npm run check`・`npm run test`が全て通ることを確認する。
- `npm run dev`でショップ・護符選択・天啓選択画面に暗雲・虚が一切出現しないことを目視確認する。

## スコープ外

- 独楽のレリック化検討(本削除の後続タスクとして別セッションで扱う)
- `docs/shidasu/shidasu-glossary.md`の陳腐化修正(天啓の宿数が既に別の理由で不正確(12宿表記)であり、本specとは無関係な既存の問題のため対象外)
- 暗雲・虚の代替効果の新規設計(今回は単純削除のみ)
