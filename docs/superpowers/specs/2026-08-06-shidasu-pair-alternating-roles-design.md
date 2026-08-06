# ペア役・交互パターンの追加 設計

## 背景・目的

`docs/shidasu/shidasu-role-candidates.md`で洗い出した新規役・パターン候補のうち、以下の2つを実装対象として採用する。

- **ペア**(候補一覧の中難易度候補): チェーン全体で異なるランクの同ランク組がいくつあるかを見る役。候補一覧の内容から得点・発動条件を変更して採用する
- **交互**(新規): チェーン内の実カードが赤黒交互に4枚以上並ぶことを判定する、既存の同スート・同色・階段に並ぶ第4のパターン

## ペア

### 成立条件・得点

チェーン全体の実カード(ワイルド除く)をランクごとに集計し、2枚以上あるランクの数(組数)を数える。**組数が2以上のときのみ**成立し、`組数 × 50`点(神託レベルを乗算)を加点する。組数が0または1の間は一切加点しない(既存の「同ランク」役とは別枠の累積型役)。

例: チェーン内に♠5・♥5・♣9・♦9・♠3の5枚がある場合、ランク5(2枚)・ランク9(2枚)の2組が成立するため、`2 × 50 = 100`点(神託レベル1倍なら100点)。

### 実装方針

`src/lib/game/shidasu/patterns.ts`の`evaluateChainBonus`内、既存の`countSameRankBefore`(今回出したカードと同ランクの枚数)とは別に、チェーン全体を対象とする新規判定ロジックを追加する。

**ワイルドの扱い**: 既存の同ランク役(`countSameRankBefore`)は「今回出したカードとの1対1比較」のため、チェーン内の全ワイルドをそのランクに加算しても矛盾しない。ペアは複数ランクを同時集計するため同じ発想をそのまま持ち込むと、1枚のワイルドが複数の組に同時所属する矛盾が生じる。これを避けるため、**チェーン内のワイルドは常に「今回プレイしたカードのランク」の一部としてのみ扱い、他のランクの集計には一切算入しない**。

```
1. chainBefore(今回のカードを含まない、これまでのチェーン)の実カードをランクごとに集計する
2. 今回プレイしたカードのランクについては、実カード枚数 + チェーン内ワイルド枚数 + 1(今回のカード自身)で枚数を決める
3. それ以外のランクは実カードのみの枚数をそのまま使う
4. 2枚以上あるランクの数(pairCount)を数える
5. pairCount >= 2 なら、pairCount * scoring.pairBonusUnit * oracleLevel('pair') を加点し、パーツを積む
6. roleFiredに { name: 'pair', usedWild: (今回のカードのランクの集計にワイルドが1枚以上含まれるか), amount } を積む
```

**ワイルド自身をプレイした場合**: 既存の同ランク役(`countSameRankForWildPlay`)は、ワイルド自身をプレイした際「チェーン内で既に発生している同ランクの最大枚数(既存ワイルドの代役分を含む)に+1枚した数(まだ発生していなければ2枚)」で発生させる、という設計になっている。ペアもこれと一貫性を持たせ、上記の手順2を「今回プレイしたカードのランク」ではなく「`chainBefore`の実カードのうち最も枚数が多いランク」に読み替える。すなわち、最大枚数の実ランクに`チェーン内ワイルド枚数(今回出したワイルド自身を含む)`を加算し、実ランクが1種類も無ければ「2枚」を基準値として扱う(`countSameRankForWildPlay`と同じ`Math.max(maxRealRankCount + wildCount, 1) + 1`の考え方)。それ以外のランクは実カードのみの枚数をそのまま使う。

例: チェーン内に♠5(実)・♥9(実)・ワイルド1枚があり、今回♣5をプレイした場合、ランク5は実カード2枚+ワイルド1枚=3枚(組成立)、ランク9は実カード1枚のみ(組不成立)となり、pairCount=1(2組未満のため加点なし)。

例(ワイルド自身プレイ): チェーン内に♠5・♣5(実カード2枚、同ランク)・♥9(実カード1枚)があり、今回ワイルドをプレイした場合、最大枚数のランクは5(2枚)のため、ランク5は2枚+ワイルド1枚(今回出した分)=3枚(組成立)、ランク9は実カード1枚のみ(組不成立)となり、pairCount=1(2組未満のため加点なし)。

### 型・パラメータへの影響

- `src/lib/game/shidasu/types.ts`: `RoleName`に`'pair'`を追加
- `src/lib/game/shidasu/roles.ts`: `ROLE_LIST`に`{ name: 'pair', label: 'ペア', desc: 'チェーン全体で同ランクの組が2組以上成立' }`を追加。`roleBasePoint`のswitch文に`case 'pair': return params.scoring.pairBonusUnit`を追加
- `src/lib/game/shidasu/params.ts`: `scoring`型に`pairBonusUnit: number`を追加、`shidasu.config.json`に実値(50)を追加
- `src/lib/game/shidasu/oracleActualEffects.ts`: `ORACLE_ACTUAL_EFFECTS`に`pair`のエントリを追加
- `src/lib/game/shidasu/oracles.ts`: `defaultOracleLevels()`に`pair: 1`を追加。**`ORACLE_POOL`への追加は今回のスコープ外**(神託として実際に入手できるようにするのは別セッション)
- `src/lib/game/shidasu/params.ts`: `oracles`型に`pair: { name: string; desc: string }`を追加(`ORACLE_POOL`に入れなくても、`oracleLevels`の型・初期値としては必要)

## 交互

### 成立条件・得点

チェーン内の実カード(ワイルド除く)を順に見て、隣接する実カード同士の色が常に異なる(赤黒交互)状態が、実カード4枚以上続いていれば成立する。ワイルドは実カードの並びから除外して(位置を飛ばして)判定する(既存の`analyzeStair`のワイルド跨ぎと同じ考え方)。既存の同スート・同色・階段パターンと同様、チェーンが伸びる限り毎プレイ再判定される常時判定型のパターン。

得点は`80`点(神託レベルを乗算)。既存パターンの得点感覚(同色50・同スート100・階段150)の中で、同色と同スートの中間に位置づける。

### 実装方針

`src/lib/game/shidasu/patterns.ts`に新規関数`analyzeAlternatingColor(chain: Card[], items: ItemId[] = []): { held: boolean }`を追加する。既存の`analyzeSuitColor`と同じ引数パターンを踏襲し、`cardColors`(紅蓮・漆黒の拡張色解釈)を使って判定する。

```
1. chainから実カード(ワイルド除く)を抽出
2. 実カードが4枚未満ならheld: false
3. 隣接する実カード同士(cardColorsで求めた色)が、どちらの色とも一致しない(=交互になっている)かを順に確認
4. 全て交互ならheld: true
```

`evaluateChainBonus`内、既存の同スート・同色パターン判定の直後に、`chainIncludingThis.length >= alternatingMinLen(既定4)`かつ`analyzeAlternatingColor`が`held`の場合、`scoring.alternatingBonus * oracleLevel('alternating')`を加点する。`patternFired = true`・`patternFiredCount += 1`も既存パターンと同様に更新する。

### 型・パラメータへの影響

- `src/lib/game/shidasu/types.ts`: `RoleName`に`'alternating'`を追加
- `src/lib/game/shidasu/roles.ts`: `ROLE_LIST`に`{ name: 'alternating', label: '交互', desc: 'チェーンが4枚以上かつ赤黒交互に並ぶ' }`を追加。`roleBasePoint`のswitch文に`case 'alternating': return params.scoring.alternatingBonus`を追加
- `src/lib/game/shidasu/params.ts`: `scoring`型に`alternatingBonus: number`・`alternatingMinLen: number`を追加、`shidasu.config.json`に実値(80・4)を追加
- `src/lib/game/shidasu/oracleActualEffects.ts`: `ORACLE_ACTUAL_EFFECTS`に`alternating`のエントリを追加
- `src/lib/game/shidasu/oracles.ts`: `defaultOracleLevels()`に`alternating: 1`を追加。**`ORACLE_POOL`への追加は今回のスコープ外**
- `src/lib/game/shidasu/params.ts`: `oracles`型に`alternating: { name: string; desc: string }`を追加

## 神託(ORACLE_POOL)対応の扱い

`RoleName`を拡張し`oracleLevels`・`roleOccurrenceCountThisWave`(明星の役成立回数カウント)・`sowiloBoostedRole`(ソウィロ秘儀)の対象にはペア・交互を含める(型`Record<RoleName, ...>`が自動的に両方をカバーするため、明星・ソウィロは追加実装なしで両方に対応する)。

一方、`ORACLE_POOL`(実際に神託として抽選・購入できる対象のリスト、現在8種類均等抽選で固定)への追加は今回のスコープ外とする。既存コメント「8役すべてが対象(将来の追加余地なし)」を今回のタイミングでは崩さず、`docs/shidasu/shidasu-role-candidates.md`および本ドキュメントに「ペア・交互に対応した神託の追加」を今後の検討事項として記録するに留める。

## テスト方針

- `patterns.ts`の`evaluateChainBonus`: ペア(組数0/1/2/3のケース、ワイルドを含むケース)・交互(3枚では不成立、4枚で成立、5枚以上での継続、ワイルドを挟んだケース、同色が続いた場合の不成立)のテストケースを追加する
- `roles.ts`の`roleBasePoint`: `pair`・`alternating`のケースを追加
- 既存の`ROLE_LIST`・`ORACLE_ACTUAL_EFFECTS`を全件チェックする既存テスト(存在する場合)は、新規2件を含めて更新する

## 除外・非対象

- `ORACLE_POOL`への追加(神託として実際に入手可能にする作業)は今回のスコープ外。別途ブレインストーミングで対応する
- `docs/shidasu/shidasu-role-candidates.md`に残る他の候補(両採り・すべて黒/すべて赤・ミニフラッシュ・ミニロイヤル・ストレートフラッシュ・色ストレート・レインボー・ストレート・フルハウス・グランドスラム・総取り)は本ドキュメントの対象外。引き続き未採用のまま候補一覧に残す
