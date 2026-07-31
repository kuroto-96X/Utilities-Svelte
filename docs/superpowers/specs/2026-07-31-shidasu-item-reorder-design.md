# 星詠みソリティア -Shidasu- 護符の並べ替えUI 設計

## 背景・目的

`docs/shidasu/shidasu-roadmap.md`の「画面表示項目の検討」で挙げている課題。`docs/shidasu-gofu-candidates.md`の型の凡例で「加算・倍算型の護符が複数ある場合、適用順はプレイヤーの護符の並べ方に依存する(左から順に適用)」と定義されているが、現状プレイヤーが所持護符の並び順を変更する手段が無い(`+page.svelte`の`itemBadges`は`[...new Set(run.items)]`で単純な一覧表示のみ)。

ショップ画面(`docs/superpowers/specs/2026-07-23-shidasu-shop-design.md`で実装済み)の「所持品(売却可)」セクションに、護符の並べ替え機能を追加する。

## スコープ

対象:
- ショップ画面の「所持品」セクションを「所持護符(並べ替え・売却可)」と「その他の所持品(秘儀・天啓・神託、売却可)」の2セクションに分離する
- 「所持護符」セクションのみ、ドラッグ&ドロップで並べ替え可能にする。PC・スマホ両対応のため、HTML5 Drag and Drop APIではなくpointerイベント(`pointerdown`/`pointermove`/`pointerup`/`pointercancel`)による自前実装とする
- `engine.ts`に並べ替え用の純粋関数`reorderItems`を追加する
- 並べ替え結果(`run.items`配列の順序)を、プレイ中の常設バッジ表示(`itemBadges`)にもそのまま反映させる

対象外:
- 秘儀・天啓・神託の並べ替え(効果が適用順に依存しないため対象外)
- ショップ画面以外での並べ替え操作(プレイ中画面のitemBadgesは表示専用のまま、ドラッグ不可)

## 設計

### `engine.ts`への追加

```ts
export function reorderItems(run: RunState, fromIndex: number, toIndex: number): RunState {
  if (fromIndex === toIndex) return run
  const items = [...run.items]
  const [moved] = items.splice(fromIndex, 1)
  items.splice(toIndex, 0, moved)
  return { ...run, items }
}
```

`fromIndex`の要素を取り除き、`toIndex`の位置に挿入する。既存の`run.items`は「1種1個まで」ルールにより配列内に重複が発生しないため、インデックスベースの操作で安全に扱える。

### `+page.svelte`のショップ画面UI

現状の「所持品(売却可)」セクション(752-770行目)を以下の2セクションに分離する。

**所持護符セクション:** `run.items`を`{#each run.items as itemId, i (itemId)}`でループし、各護符バッジに`onpointerdown`を付与してドラッグを開始する。ドラッグ中は`$state`変数(例: `draggingItemIndex`)でドラッグ元インデックスを保持し、ドラッグ中の要素を`position: fixed`でポインタ位置に追従させる。`pointermove`で他の護符バッジの矩形(`getBoundingClientRect`)と重なりを判定し、重なったタイミングで`reorderItems`を呼んで即座に並び替える(既存の`run.items`をそのまま更新するシンプルな即時入れ替え方式。ドラッグ終了を待たずに配列順序が変わる)。`pointerup`/`pointercancel`でドラッグ状態を終了する。売却ボタンは既存の`handleSellItem`のまま維持する。

**その他の所持品セクション:** 秘儀・天啓・神託の表示・操作(759-768行目相当)は変更せず、そのまま維持する。

### `itemBadges`への影響

`itemBadges`スニペット(500-509行目)は`run.items`配列を`[...new Set(run.items)]`で参照しているが、`run.items`自体に重複が無い(1種1個ルール)ため実質的に`run.items`をそのまま使っているのと同じであり、コード変更は不要。`reorderItems`で`run.items`の順序が変わればバッジの表示順も自動的に追従する。

## テスト方針

`engine.test.ts`に`reorderItems`の単体テストを追加する。

- 3要素の配列で、先頭の要素を末尾に移動すると、残り2要素の相対順序が保たれたまま並び替わること
- 末尾の要素を先頭に移動する場合も同様に検証する
- `fromIndex === toIndex`の場合、`run`が変更されず同じ内容を返すこと(参照が同じである必要はなく、内容が変わらないことを検証する)

ドラッグ操作自体のUIはブラウザでの目視確認とする。確認項目:
- ショップ画面で護符バッジをドラッグし、他の護符バッジの位置まで動かすと順序が入れ替わること
- 並べ替え後、プレイ中画面の常設バッジ表示(itemBadges)の順序も並べ替え後の順序になっていること
- 秘儀・天啓・神託はドラッグできず、従来通り売却・使用ボタンのみが機能すること
- スマホ相当のタッチ操作(ブラウザの開発者ツールでタッチエミュレーションを有効にして確認)でも並べ替えができること
