# 妨害行動アニメーション(talismanShuffle) 設計

## 背景・目的

Shidasuの星の妨害行動32個すべてに専用アニメーションを設定する取り組み。グループA(封印系)・B(没収系)・C(強制発動系)・D(カード移動系)・E(数値変化系)の実装が完了し、31個に発動演出が揃った。

ドキュメント更新時の再集計で、`talismanShuffle`(護符並び替え)だけがいずれのグループにも属さず発動演出が未実装のまま残っていることが判明した。これは見落としではなく、グループA(封印系)の設計時に明示的にスコープ外とされていたもの(`docs/superpowers/specs/2026-08-20-shidasu-sabotage-seal-animation-design.md`24行目「`talismanHidden`(護符並び替え)の演出は対象外(データ・表示とも実装済み)」)。本設計はこの最後の1個に発動演出を追加する。

## 現状の実装

`talismanShuffle`(`src/lib/game/shidasu/sabotageEffects.ts`の`applyTalismanShuffle`)は、所持護符(`run.items`)の並び順をシャッフルし、`wave.activeSeal`に`{ kind: 'talismanHidden' }`を設定する。次の妨害発動まで、この`activeSeal`が保持される。

常設表示は既に実装済み(2026-08-14・2026-08-18):
- `+page.svelte`の`itemBadges`スニペット(プレイ中の常設バッジ表示)・ショップ画面の護符並べ替えUIの両方で、`wave?.activeSeal?.kind === 'talismanHidden'`のとき、護符バッジが斜めストライプ背景に切り替わり、表示名が「？？？」に、ショップ側は売却額も「？」に隠れる。
- スタイルは既存の`talismanSeal`(護符封印)の常設表示(`talismanSealed`)と同じCSS(斜めストライプ、茶色系)を共用している。

**無いもの**: 発動の瞬間を示す演出(フラッシュ・シェイク等)。他の封印系5種(`talismanSeal`・`riteSeal`・`revelationOracleSeal`・`roleSeal`・`comboCap`)は`sealFlashTarget`という仕組みで対象がフラッシュ+シェイクしてから常設表示に切り替わるが、`talismanShuffle`にはこれが無く、常設表示にいきなり切り替わる。

## 対象の違いと演出方針

既存の封印系5種は「単一対象」(例: 護符封印なら選ばれた1つの護符)へのフラッシュだが、`talismanShuffle`は「所持護符すべて」が対象(並び順自体がシャッフルされ、表示名も一括で隠れる)。この違いにより、既存の`SealFlashTarget`型(単一対象を指す`activeSeal`のunion)をそのまま使うことができない。

演出方針: 所持護符バッジ**全て**が同時にフラッシュ+シェイクする(既存の`shidasu-seal-flash`CSSをそのまま複数バッジへ同時適用する)。単一対象への適用と見た目のCSSは完全に共用しつつ、トリガーの構造だけを「対象1件」から「真偽値のみ」に単純化する。

対象は`itemBadges`スニペット(プレイ中の常設バッジ表示)のみとする。ショップ画面の護符並べ替えUIは、既存のグループA設計時の判断(封印は`playing`フェーズ中のみ発動するため、ショップ画面表示中に該当状態になることは実質無い)と同じ理由で対象外とする。

## 技術設計

### 新規state: `talismanShuffleFlashActive`

`PlayArea.svelte`に、`sealFlashActive`とは別の新規`$state<boolean>`を追加する。対象を持たない(常に「全護符」固定のため)、単純なboolean一つで表現する。

```ts
// 妨害行動「talismanShuffle」(護符並び替え)発動時、所持護符バッジ全てが同時に
// フラッシュ+シェイクする演出用。対象は常に「全護符」固定のため、sealFlashTarget
// のような対象識別情報は持たず、boolean一つのみで表現する。
let talismanShuffleFlashActive = $state(false)

function startTalismanShuffleFlashAnimation() {
  talismanShuffleFlashActive = true
  onTalismanShuffleFlashChange?.(true)
  const timer = setTimeout(() => {
    talismanShuffleFlashActive = false
    onTalismanShuffleFlashChange?.(false)
  }, 500)
  dealTimers.push(timer)
}
```

`500ms`はグループA(`sealFlashActive`)と同じ持続時間で統一する。

### 検知: `$effect.pre`への分岐追加

既存の`lastSabotage`検知ブロックに、`talismanShuffle`用の分岐を追加する。既存の封印系5種の分岐とは別の`else if`にする(対象特定が不要なため、`wave.activeSeal`のガード条件も異なる):

```ts
} else if (current.id === 'talismanShuffle') {
  startTalismanShuffleFlashAnimation()
}
```

既存の封印系5種の分岐(`talismanSeal`等)は変更しない。`current.id === 'talismanShuffle'`は`lastSabotage.id`から直接判定できるため、`wave.activeSeal`の中身を見る必要はない(`applyTalismanShuffle`は必ず`activeSeal`を`talismanHidden`に設定するため、発動時は確実に対応する状態になっている)。

### コールバックprops: `onTalismanShuffleFlashChange`

`PlayArea`外(`+page.svelte`)の`itemBadges`スニペットへ値を伝えるため、既存の`onSealFlashChange`と同じパターンでコールバックpropsを追加する:

```ts
onTalismanShuffleFlashChange?: (active: boolean) => void
```

`+page.svelte`側は`talismanShuffleFlashActive`という`$state<boolean>`を持ち、`<PlayArea>`呼び出しに`onTalismanShuffleFlashChange={(active) => { talismanShuffleFlashActive = active }}`を追加する。

### UI適用: `itemBadges`スニペット

`+page.svelte`の`itemBadges`スニペット内、各護符バッジの`{@const talismanHidden = wave?.activeSeal?.kind === 'talismanHidden'}`の直後に、以下を追加する:

```ts
{@const talismanShuffleFlashing = talismanShuffleFlashActive && talismanHidden}
```

`class`属性の`{talismanFlashing ? 'shidasu-seal-flash' : ''}`の隣に`{talismanShuffleFlashing ? 'shidasu-seal-flash' : ''}`を追加する(結果として、バッジは`talismanFlashing`または`talismanShuffleFlashing`のいずれかが真ならフラッシュする)。`talismanHidden`を条件に含めるのは、`talismanShuffleFlashActive`が500ms持続する間に別の妨害(封印解除等)が挟まって`activeSeal`が変わるケースへの安全策(実際にはほぼ起こらないが、既存の他の`xxxActive`フラグと同様、表示側でも対応する状態を再確認する)。

## 先出し防止の確認(CLAUDE.md「移動アニメーション実装時の注意」)

`talismanShuffle`は要素が消えたり移動したりする演出ではなく、既存の`talismanHidden`常設表示(斜めストライプ・「？？？」表示)へフラッシュを重ねるだけの演出のため、「移動先の常設UI要素が完了前の状態を先出しする」問題は該当しない。`wave.activeSeal`が`triggerSabotage`実行時点で既に`talismanHidden`に更新済みであっても、常設表示自体は既にその値を直接参照する設計(先出し対策は不要な種類の表示)であり、今回追加するフラッシュは単なる装飾の上乗せに留まる。

## テスト方針

- 既存の`applyTalismanShuffle`のロジック自体は変更しない(既にテスト済み)。今回の変更は`PlayArea.svelte`側の検知・演出のみで、`SabotageResult`・`lastSabotage`に新規フィールドを追加する必要は無い(`current.id`の判定のみで発動できるため)。
- デバッグ画面(`/admin/shidasu-debug`)で「護符並び替え」ボタンを発動し、所持護符バッジ全体が同時にフラッシュ+シェイクすることを目視確認する。デバッグ画面には既に護符所持チェックリスト機能があるため、事前に複数護符を所持させてから確認する。

## スコープ外

- ショップ画面の護符並べ替えUI(既存の`talismanHidden`表示制約と同じ理由で対象外)。
- `applyTalismanShuffle`自体のロジック変更(スコープ外、変更不要)。
