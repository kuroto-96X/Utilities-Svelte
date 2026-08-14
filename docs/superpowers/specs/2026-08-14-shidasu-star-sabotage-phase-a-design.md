# 星の妨害行動 Phase A 実装設計

> 対象: `docs/shidasu/shidasu-star-sabotage-candidates.md`の候補33個のうち、先行実装済みの11個(各ターゲット1つずつ、`docs/superpowers/specs/2026-08-13-shidasu-star-sabotage-design.md`で実装済み)に続き、残り22個のうち11個(Phase A)を実装する。レリック封印は不採用のため候補から除外した。残り10個(Phase B)は別セッション。

## 背景・目的

`docs/shidasu/shidasu-roadmap.md`項目3(星の妨害行動)は既に基盤+11個の実装が完了している。本設計ではその基盤(`SABOTAGE_POOL`・`triggerSabotage`・ターンカウント・封印の仕組み)をそのまま再利用し、新たに11個の妨害行動を追加する。既存waveSlot3の星6種は全て`sabotage: {kind: 'all'}`のため、追加した候補は実装した時点で自動的に対象へ加わる(星側の変更は不要)。

## 方針(スコープ)

Phase Aで実装する11個: 山札(`stockPurgeSmall`・`stockShuffle`)・場札(`tableauFullReturn`・`tableauShuffle`)・チェーン(`chainPartialDiscard`・`chainShuffle`)・コンボ(`comboReduce`・`comboCap`)・護符(`talismanConfiscate`)・秘儀(`riteConfiscate`・`riteForceActivate`)。

Phase B(別セッション、本設計のスコープ外): 護符並び替え・天啓/神託没収・天啓/神託強制発動・付喪化解除・捨て札消去・捨て札埋没・報酬減少・通貨強制消費・役減衰・役偏重。

レリック封印(候補一覧の「レリック没収」とは別枠、「次の妨害発動まで効果を無効化する」という一時封印版)は、レリックの効果がゲームプレイに直接影響しないため一時封印しても体感できる変化が薄いという理由で不採用。以後の候補一覧・実装対象から除外する。

## 効果仕様

| id | ターゲット | intervalTurns | 効果 |
|---|---|---|---|
| `stockPurgeSmall` | 山札 | 4 | 山札の上から2枚を捨て札に置く |
| `stockShuffle` | 山札 | 5 | 山札の順序をランダムに並び替える(枚数不変) |
| `tableauFullReturn` | 場札 | 8 | 場札全体+山札をまとめてシャッフルし、各列同じ枚数で再配布する |
| `tableauShuffle` | 場札 | 6 | 場札の中身を列をまたいでランダムに再配置する(山札には触れない、各列の枚数は維持) |
| `chainPartialDiscard` | チェーン | 5 | チェーンの先頭(最古)から2枚を捨て札に送る(コンボはそのまま維持) |
| `chainShuffle` | チェーン | 6 | チェーン(と対応する履歴)をシャッフルし、シャッフル後の末尾を新しい基準カードにする |
| `comboReduce` | コンボ | 5 | コンボ数を3減らす(0未満にはしない) |
| `comboCap` | コンボ | 6 | 発動時点のコンボ数を上限として、次の妨害発動まで以後の増加を止める |
| `talismanConfiscate` | 護符 | 7 | 所持護符を1つランダムに選び、完全に失わせる |
| `riteConfiscate` | 秘儀 | 6 | 所持秘儀を1つランダムに選び、効果を発動させずに消費させる |
| `riteForceActivate` | 秘儀 | 6 | 使用可能(`canUseRite`を満たす)な秘儀からランダムに1つ選び、プレイヤーの操作を介さず即座に効果を発動させて消費する。使用可能な秘儀が無ければ不発(何も起きない) |

## 技術設計

### `chainPartialDiscard`(チェーン部分放棄)

`wave.chain`の先頭から2枚(ただし`chain.length - 1`を超えない、常に末尾=基準カードは残す)を`discardPile`へ移す。`chainOrigin`も同じ位置を対応して除去する。`combo`・`foundation`は変更しない。

### `chainShuffle`(チェーン入れ替え)

`chain`と`chainOrigin`に同一の permutation を適用してシャッフルする(`shuffleInPlace`の対象を`{card, origin}`のペア配列にしてまとめてシャッフルし、シャッフル後に2つの配列へ分離する)。シャッフル後の`chain`の末尾を新しい`wave.foundation`とする(取得可能なランクが変わりうる、意図的な強めの妨害)。

### `comboReduce`(コンボ削減)

`combo: Math.max(0, wave.combo - 3)`。他のフィールドは変更しない。

### `comboCap`(コンボ頭打ち)

`WaveState.activeSeal`に新しいバリアントを追加する:

```ts
activeSeal:
  | { kind: 'talisman'; id: ItemId }
  | { kind: 'rite'; id: RiteId }
  | { kind: 'revelationOrOracle'; ref: HeldRevelationOrOracleRef }
  | { kind: 'role'; names: RoleName[] }
  | { kind: 'comboCap'; max: number }
  | null
```

`triggerSabotage`の`comboCap`ケースでは、`activeSeal: { kind: 'comboCap', max: wave.combo }`(発動時点のコンボ数をそのまま上限にする)を設定する。既存の`activeSeal`は他の全ての妨害発動時と同様、`triggerSabotage`冒頭で必ず`null`にリセットしてから設定し直される(1件しか同時に存在しない、という既存の設計をそのまま踏襲する)。

`playCard`・`drawStock`に新しいパラメータ`comboCap: number | null = null`を追加し、コンボを加算する箇所(`playCard`の`newCombo`計算、`drawStock`のnaive分岐の`newCombo`計算)で、加算後の値をこの上限でクランプする(`Math.min(comboCap ?? Infinity, 加算後の値)`。既存の`comboFrozenThisWave`によるイサ(秘儀)の完全凍結が優先されるため、凍結中は`comboCap`の判定自体に到達しない)。

`applyPlayCard`・`applyDrawStock`・`applyStuckCheck`側に、既存の`resolveEffectiveItems`・`resolveSealedRoleEffect`と同じパターンで`resolveComboCap(activeSeal: WaveState['activeSeal']): number | null`ヘルパーを追加し(`activeSeal?.kind === 'comboCap' ? activeSeal.max : null`)、3箇所の呼び出しに`comboCap`を渡す。

### `talismanConfiscate`(護符没収)・`riteConfiscate`(秘儀没収)

既存の`relicConfiscate`(Task 6で実装済み)と全く同じパターン。対象の配列(`run.items`・`run.rites`)からランダムに1つ選び、`RunState`から取り除く。所持0件なら何もしない。

### `riteForceActivate`(秘儀強制発動)

`run.rites`を`canUseRite(params, wave, riteId)`でフィルタし、候補が無ければ何もしない。候補があればランダムに1つ選び、`applyRiteEffect(params, wave, riteId, rand)`を呼んでその場で効果を適用した`WaveState`を得た上で、`run.rites`から該当1個を取り除く(`useRite`が行っている「効果適用+所持から削除」と同じ処理を、プレイヤー操作を介さず`triggerSabotage`内で行う)。`useRite`が追加で行っている果断・星霜の加算(`discretion`・`frost`護符)、`recentUsedRiteIds`の更新は本効果では対象外とする(妨害由来の強制発動であり、プレイヤーの能動的な秘儀使用としては扱わない)。

### `stockPurgeSmall`・`stockShuffle`・`tableauFullReturn`・`tableauShuffle`

いずれも既存の`stockPurge`・`columnReturn`と同型のロジック(配列の取り出し・`shuffleInPlace`・再構成)を、対象範囲(枚数・列数)だけ変えて実装する。新規のヘルパー関数追加は不要。

## テスト

- `sabotage.ts`: `SABOTAGE_POOL`が22件(既存11+今回11)になったことを検証するテストを更新する。
- `engine.ts`: `triggerSabotage`に11個の新規`case`を追加し、それぞれの効果を検証するテストを追加する(既存11個のテストと同じ形式)。
- `comboCap`は、`activeSeal`設定の検証に加え、実際に`playCard`/`drawStock`へ`comboCap`を渡した際にコンボ加算がクランプされることを検証する統合テストを追加する。
- `chainShuffle`は、シャッフル後`chain`の末尾と`wave.foundation`が一致することを検証する。
- `riteForceActivate`は、(a)使用可能な秘儀がある場合に効果が適用され所持から削除されること、(b)使用可能な秘儀が無い場合(例: 秘儀所持0件、または全て`canUseRite`を満たさない状況)に何も起きないこと、の両方を検証する。

## スコープ外

- Phase B(残り10個)の実装
- UIへの追加表示(既存の「次の妨害: {name}(あとNターン)」表示をそのまま使う。新規効果ごとの専用UIは追加しない)
- `intervalTurns`・効果の数値バランス調整(既定値のまま実装し、実プレイフィードバックは別途)
