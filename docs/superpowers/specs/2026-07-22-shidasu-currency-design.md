# 星詠みソリティア -Shidasu- ゲーム内通貨基盤 設計

## 背景・スコープ

`docs/shidasu/shidasu-roadmap.md`の5番目の項目「ゲーム内通貨を定義して、ウェーブ終了ごとにショップでアイテム購入の検討」の前半部分を実装する。

今回実装するのは以下の範囲のみ:

- 通貨の単位(名称・記号)の定義
- ラン開始時の初期所持数、Waveクリアごとの獲得数、ボスクリア時のボーナスの実装
- それらの数値を編集できる専用の管理画面

**通貨の使用(ショップ画面・護符購入など)は対象外。** 次のステップとして別途ブレインストーミングする。

## 1. 通貨の基本定義

- 名称: **星片**(せいへん)、表示記号: **☆**
- コード上の識別子: `starShard`(実装上の命名規則に使う。表示名・記号自体は`params.currency.name`/`params.currency.symbol`として設定可能にする)
- ラン単位で管理する値。このプロジェクトにはセーブ機構が無く、周回(ラン)をまたいだ永続化は行わない。護符・秘儀・天啓と同様、ランが終われば消える
- `RunState.currency: number`として追加。`continueChoice`(大凶クリア後の続行確認)を挟んでもリセットされず、そのまま引き継がれる。リセットされるのは`beginRun`(新しいラン開始)のときのみ

## 2. 設定パラメータ(`src/lib/game/shidasu/params.ts`)

`ShidasuParams`インターフェースに`currency`ブロックを追加する。

```ts
currency: {
  name: string          // "星片"
  symbol: string        // "☆"
  initialAmount: number // ラン開始時の初期所持数
  waveClearAmount: number // 通常のWaveクリアで得られる基礎獲得数(ボスWaveも含め毎回付与される)
  bossBonus: {
    shoukyou: number // 小凶ボスクリア時、waveClearAmountに追加で加算されるボーナス
    chuukyou: number // 中凶ボスクリア時
    taikyou: number  // 大凶ボスクリア時
  }
}
```

`DEFAULT_PARAMS.currency`のデフォルト値:

```ts
currency: {
  name: '星片',
  symbol: '☆',
  initialAmount: 5,
  waveClearAmount: 5,
  bossBonus: { shoukyou: 5, chuukyou: 10, taikyou: 15 },
}
```

ウェーブ番号や連続クリア数による変動は行わない(固定値方式)。`src/lib/game/shidasu/shidasu.config.json`にも同じ内容を反映する。

## 3. 型定義(`src/lib/game/shidasu/types.ts`)

`RunState`に`currency: number`フィールドを追加する。

## 4. 付与ロジック(`src/lib/game/shidasu/engine.ts`)

`resolveWaveEnd`はWave成功判定(`wave.score >= target`)を1箇所で行っている関数であり、成功時にのみ`itemSelect`または`continueChoice`へ分岐する。ここに付与処理を集約する。

- 失敗(`gameOver`に遷移する場合)は付与しない
- 成功時:
  ```
  earned = params.currency.waveClearAmount
         + (isBossWave(params, run.waveIndex) ? params.currency.bossBonus[BOSS_TIER_KEYS[bossTierOf(run.stageIndex)]] : 0)
  ```
  を`run.currency`に加算してから、既存の`itemSelect`/`continueChoice`分岐処理を行う
- `beginRun`: `currency: params.currency.initialAmount`で初期化する
- `createInitialRun`(タイトル画面用の空状態): `currency: 0`で初期化する

## 5. 管理画面

- 新規ページ`src/routes/admin/shidasu-currency/+page.svelte`を追加する
- 既存の護符/秘儀/天啓/神託/ボス設定ページと同じboilerplate構成(`loadConfig`/`save`/リロード/トースト通知、`/api/admin/shidasu-config`経由でJSON全体を読み書き)に倣う
- テーブル形式ではなく、項目数が少ないためシンプルなフォーム形式にする: 名称・記号・初期所持数・Waveクリア時獲得数・ボス階級別ボーナス3種(小凶/中凶/大凶)の入力欄
- 数値項目は`Number.isFinite`かつ0以上でバリデーションする(既存ページのバリデーションパターンに倣う)
- `src/routes/admin/+page.svelte`の一覧にリンクカードを追加する(「星詠みソリティア -Shidasu- 通貨設定」)

## 6. プレイ中UI表示

`src/routes/game/shidasu/+page.svelte`のスコア表示(`{run.wave?.score ?? 0} 点`が表示されている箇所)の近くに、`☆{run.currency}`のような常時表示を追加する。ショップは未実装だが、付与ロジックが正しく動作しているかをプレイ中に目で確認できるようにするため、表示だけ先行して入れる。

## 7. テスト方針

`src/lib/game/shidasu/engine.test.ts`に以下のケースを追加する:

- `beginRun`直後、`run.currency`が`params.currency.initialAmount`になっている
- 通常Wave(ボスWave以外)クリアで`run.currency`が`waveClearAmount`分増える
- 小凶/中凶/大凶それぞれのボスWaveクリアで`run.currency`が`waveClearAmount + bossBonus[該当階級]`分増える
- Wave失敗(`gameOver`に遷移するケース)では`run.currency`が増えない
- 大凶クリア後の`continueChoice`を経ても`run.currency`が保持される(リセットされない)

## 対象外(次ステップ)

- ショップ画面の実装
- ☆の消費ロジック(護符購入など)
- ラン間での通貨の永続化(セーブ機構自体が現状無いため対象外)
