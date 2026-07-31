# bossTiers・bosses非推奨フィールドの削除 設計

## 背景・目的

[ラン構成の再構築](./2026-07-28-shidasu-run-structure-redesign-design.md)で、旧「小凶/中凶/大凶」の階級制(`BossKind`ベース)を廃止し、Wave単位の新概念「星」(`stars`フィールド)に移行した。この際、`params.ts`内の`bossTiers`・`bosses`フィールドは「非推奨: starsフィールドへの移行に伴い廃止予定。移行完了後(UI・管理画面の置き換えが終わったら)削除すること」というコメント付きで一時的に維持されていた。

[星パラメータ管理画面の本格UI化](./2026-07-29-shidasu-bosses-admin-ui-design.md)でUI・管理画面側の移行が完了したため、今回`bossTiers`・`bosses`および関連する`BossKind`・`BossTierKey`型を削除する。

## スコープ

対象:
- `types.ts`の`BossKind`型・`BossTierKey`型の削除
- `params.ts`の`ShidasuParams`型定義から`bossTiers`・`bosses`フィールドを削除、`DEFAULT_PARAMS`の該当データを削除
- `shidasu.config.json`から`bossTiers`・`bosses`のJSONデータを削除
- `engine.test.ts`で`tierLabel`引数に`DEFAULT_PARAMS.bossTiers.xxx.name`を使っている12箇所を、固定のテスト用文字列に置き換え
- `BossTiersSection.svelte`をファイルごと削除、`admin/shidasu/+page.svelte`からのimport・使用箇所を削除
- `JsonPanel.svelte`の`bossTiers`関連バリデーションロジック・エラーメッセージ文言を削除

対象外(維持する):
- `bosses.ts`(`starsInSlot`のみを持つ星ユーティリティファイル。ファイル名は`bosses`だが中身は既に星ベース)
- `sinDaughters.ts`(`SIN_DAUGHTERS`。星パラメータ管理画面の名前入力補完に現役で使用中)
- `shidasu-bosses`というURLパス・ディレクトリ名自体(星パラメータ設定ページとして現役)

## 現状調査で判明したこと

- `engine.ts`本体は既に`star.name`を`tierLabel`(`ScoreLock`型の表示用文字列フィールド)として使うよう移行済みで、`bossTiers`・`bosses`への依存は残っていない。削除してもゲームロジックへの実害はない
- `bossTiers`・`bosses`を実際に使っているのは、型定義・データ定義そのものを除くと「`engine.test.ts`のテストコード」「`BossTiersSection.svelte`(小凶/中凶/大凶の名前編集UI)」「`JsonPanel.svelte`(JSON直接編集時の必須項目バリデーション)」の3箇所のみ

## 設計

### 型定義の削除

`types.ts`から`BossKind`型・`BossTierKey`型を削除する。`params.ts`の`import type { Rarity, BossTierKey } from './types'`から`BossTierKey`を除く。

### `params.ts`・`shidasu.config.json`のフィールド削除

`ShidasuParams`型定義・`DEFAULT_PARAMS`実データ・`shidasu.config.json`の3箇所全てから`bossTiers`・`bosses`を削除する。3者は常に同じ構造を保つ既存の運用ルールに従う。

### `engine.test.ts`のテスト修正

`{ kind: 'combo', maxCombo: 3, tierLabel: DEFAULT_PARAMS.bossTiers.chuukyou.name }`のような箇所(12箇所)を、`DEFAULT_PARAMS`への依存を持たない固定文字列に置き換える。例: `tierLabel: 'test-tier'`。`tierLabel`はテストの検証対象(アサーション)には使われておらず、単に`ScoreLock`型を満たすためのダミー値であるため、置き換えによるテスト結果への影響はない。

### `BossTiersSection.svelte`の削除

ファイルを削除する。`admin/shidasu/+page.svelte`から以下を削除する:
- `import BossTiersSection from './BossTiersSection.svelte'`
- `<BossTiersSection {config} />`の呼び出し

セクションの削除により、`admin/shidasu`メイン設定ページの構成は「レイアウト・スコアリング・役ボーナス・スプレッド・アイテム・フロー/UI」のみになる。

### `JsonPanel.svelte`のバリデーション修正

`isValidShidasuParams`関数内の`bossTiers`・`shoukyou`・`chuukyou`・`taikyou`関連のチェックを削除する。エラーメッセージ`'必須項目(layout/scoring/bossTiers/spreads/items/flow/ui)が不足しています'`から`bossTiers`を除いた文言に更新する。

## テスト方針

`engine.test.ts`の修正は既存テストの置き換えのみで、新規テストの追加は不要(型削除・データ削除自体はコンパイルエラーの有無で検証される)。`BossTiersSection.svelte`・`JsonPanel.svelte`の変更はUIの見た目に関わるため、既存方針通りブラウザでの目視確認とする。

確認項目:
- `npm run build`・`npm run check`でエラーが出ないこと(型削除に伴う参照漏れがないこと)
- `npx vitest run`で既存テストが全件PASSすること
- `/admin/shidasu`のメイン設定ページから「ボス」セクションが消えていること、他のセクションの表示・保存が正常に動作すること
- `/admin/shidasu`のJSON直接編集パネルで、`bossTiers`を含まない現在の設定データが正しく読み込み・適用できること
- `/game/shidasu`でラン全体を通してプレイし、Wave3の制限ルール(旧ボス相当)が引き続き正常に機能すること(表示・スコアロジックともに影響がないこと)
