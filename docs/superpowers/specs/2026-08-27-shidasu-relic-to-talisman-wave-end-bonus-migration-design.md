# Wave終了時報酬レリック3件の護符化 実装設計

## 背景・目的

レリックと護符の役割を以下のように明確にすみわけする方針を確定した。

- **レリック**: Wave終了時の報酬に追加効果を持つもの
- **護符**: 売値操作、またはプレイ中即時報酬を持つもの

現状、レリック13種のうち3種(数珠・千社札・算盤)がこのすみわけ通り「Wave終了時報酬」を担っており、これ自体は問題ない。一方、護符32件(方向性1・2で実装済み)のうち5件(決算・還元・報奨・褒賞・恩賞)がWave終了時トリガーを持ち、本来レリックの領域とされていた「Waveクリア時追加報酬」に踏み込んでいる。

この非対称を解消するため、**「Wave終了時の報酬」の役割をレリックから護符へ完全移行する**。既存の護符5件(決算・還元・報奨・褒賞・恩賞)は現状維持のまま、レリック側で唯一Wave終了時報酬を担っていた数珠・千社札・算盤の3件を削除し、同等の効果を持つ護符を新規作成する。これにより「Wave終了時報酬はすべて護符が担う」という一貫した設計に統一する。

## 変更内容

### 1. レリック3件の削除

以下の3レリックを完全に削除する。

| レリック名 | RelicId | 効果 |
|---|---|---|
| 数珠 | `juzu` | Waveクリア時、`floor(そのWaveでの最大コンボ数/5)×n`を追加報酬に加算(付喪化でn=2) |
| 千社札 | `senjafuda` | Waveクリア時、`floor(そのWaveで成立した役の種類数/2)×n`を追加報酬に加算(付喪化でn=2固定) |
| 算盤 | `soroban` | Waveクリア時、`floor(((c-b-a)/(c-b))×n)`(山札消化率)を追加報酬に加算(付喪化でn=10固定) |

このプロジェクトには localStorage 等によるセーブデータ永続化機構が存在しない(ランはブラウザメモリ上の `RunState` のみで完結)ため、既存セーブとの互換性は考慮不要。過去に「暗雲」護符を削除した前例(コミット`8c81754`)と同じパターンで、型定義・`RELIC_POOL`・`params.ts`(型+DEFAULT_PARAMS)・`shidasu.config.json`・関連関数・テストから機械的に削除する。

削除により `RELIC_POOL` は13種→10種になる。レリック専用ショップ枠(`relicSlotCount`・`rollRelicSlots`)のロジック自体は変更不要(候補プールが減るだけで、既存の「全種所持済み」フォールバックと同じ挙動で自然に整合する)。

### 2. 護符3件の新規追加

削除する3レリックと同等の効果を持つ護符を新設する。既存の方向性2実装(決算・還元・報奨・褒賞・恩賞)と同じパターンで `resolveWaveEnd` 内にWave終了時トリガーとして実装し、効果は `currency`(星片)への加算とする。

| 護符名 | ItemId | トリガー・効果 | n | rarity |
|---|---|---|---|---|
| 活気 | `vigor` | Waveクリア時、`floor(そのWaveの最大コンボ数/5)×n`を星片に加算 | 2 | U |
| 瑞祝 | `zuishuku` | Waveクリア時、`floor(そのWaveで成立した役の種類数/2)×n`を星片に加算 | 2 | U |
| 市況 | `marketTrend` | Waveクリア時、`floor(((c-b-a)/(c-b))×n)`(山札消化率、a=残り山札枚数・b=初期配布枚数・c=デッキ総枚数)を星片に加算 | 10 | U |

**付喪化の扱い**: 元のレリックは「付喪化で効果が強化される2段階の強度」を持っていたが、護符システムには個体ごとの強度段階という概念自体が存在しない(全32件の既存報酬系護符は単一強度)。今回の移行では付喪化の概念を捨て、単一強度の護符に単純化する。効果の強さは付喪化後(強化後)の値に寄せる(数珠n=1→付喪化後n=2なので活気はn=2、千社札・算盤も同様に付喪化後の値を採用)。

**参照するWaveState/RunStateのフィールド**は元のレリック実装(`src/lib/game/shidasu/relics.ts`の`juzuBonus`/`senjafudaBonus`/`sorobanBonus`)からそのまま引き継ぐ。

- 活気: `wave.maxComboThisWave`
- 瑞祝: `wave.roleOccurrenceCountThisWave`(`Object.values(...).filter(count => (count ?? 0) > 0).length`で役の種類数を算出)
- 市況: `wave.stock.length`(a)・`wave.dealtRows × params.layout.cols`(b)・`run.deckComposition.filter(c => !c.removed).length`(c)。`denominator = c - b`が0以下の場合は0を返す(元のレリック実装と同じガード)。

これらのフィールドは既存の護符プレイ中トリガー(`rewardTalismanEffects.ts`の`PlayTriggerContext`)には含まれていないが、今回はWave終了時トリガーとして`resolveWaveEnd`関数内に直接実装するため、`wave`・`run`から問題なくアクセスできる。

**実装場所**: `resolveWaveEnd`関数内、既存の報奨(`bonus`)・褒賞(`commendation`)・恩賞(`favor`)の判定コードに続けて、同じ位置に3件分の判定を追加する。`currency`の合算式に加算し、`runWithCurrency`の`currency`計算に含める。

### 3. 影響範囲

- `src/lib/game/shidasu/types.ts`: `RelicId`型から3件削除、`ItemId`型に3件追加
- `src/lib/game/shidasu/relics.ts`: `RELIC_POOL`から3件削除、`juzuBonus`/`senjafudaBonus`/`sorobanBonus`関数と`relicWaveEndBonus`内の呼び出しを削除
- `src/lib/game/shidasu/items.ts`: `ITEM_POOL`に3件追加(130件→133件)
- `src/lib/game/shidasu/itemGroups.ts`: 新規グループとして3件を追加(方向性1「グループ23」・方向性2「グループ24」に続く新グループ、例: 「グループ25: Wave終了時報酬(レリックからの移行)」)
- `src/lib/game/shidasu/itemActualEffects.ts`: 3件分の実装ロジック要約を追加
- `src/lib/game/shidasu/params.ts`: `relics`型定義・DEFAULT_PARAMSから3件削除、`talismans`型定義・DEFAULT_PARAMSに3件追加
- `src/lib/game/shidasu/shidasu.config.json`: `relics`セクションから3件削除、`talismans`セクションに3件追加
- `src/lib/game/shidasu/engine.ts`: `resolveWaveEnd`関数に3件分のトリガー判定を追加
- テストファイル(`relics.test.ts`・`engine.test.ts`・`items.test.ts`・`itemGroups.test.ts`・`params.test.ts`等): 削除・追加それぞれの検証テスト、既存の件数アサーション(`RELIC_POOL`件数・`ITEM_POOL`件数)の更新
- `src/routes/admin/shidasu-relics/+page.svelte`・`src/routes/admin/shidasu-talismans/+page.svelte`: `RELIC_POOL`/`ITEM_GROUPS`を動的に参照する汎用UIのため、コード変更は不要(削除・追加すれば自動的に反映される)

### 4. ドキュメント更新

- `docs/shidasu/shidasu-reward-talismans-candidates.md`: 新規護符3件(活気・瑞祝・市況)を実装済みとして追記し、レリックからの移行という経緯を記録する
- `docs/shidasu/done/shidasu-relic-candidates.md`: 数珠・千社札・算盤が護符へ移行し削除された経緯を追記する

## テスト方針

既存の方向性1・2の実装と同じくTDDで進める。

- レリック削除: `RELIC_POOL`の件数変化・該当IDが存在しないことを確認するテスト、既存の`relics.test.ts`内の数珠・千社札・算盤関連テストを削除
- 護符追加: `resolveWaveEnd`内の3件それぞれについて、Wave終了時に正しい計算式でcurrencyが加算されることを検証するテスト(既存の報奨・褒賞・恩賞のテストパターンを踏襲)。特に市況(`marketTrend`)は元の算盤実装にあった`denominator <= 0`のガード条件も引き継いでテストする

## スコープ外

- 方向性3(秘儀・天啓・神託使用時にキャッシュバック)の検討・実装は対象外
- 護符とレリックのすみわけルール自体の一般化・ドキュメント化(今後の新規追加時の指針としての明文化)は、必要であれば別途検討する
