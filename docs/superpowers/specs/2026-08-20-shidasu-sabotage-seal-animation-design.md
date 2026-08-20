# 妨害行動アニメーション実装(グループA: 封印系) 設計

> 対象: 妨害行動32個のうち未実装だった27個を5グループに分類した(詳細は`docs/shidasu/shidasu-star-sabotage-candidates.md`「演出(アニメーション)の実装状況」を参照)うち、グループA「封印系」9個(`talismanSeal`・`riteSeal`・`revelationOracleSeal`・`roleSeal`・`comboCap`)に発動演出と、封印中の常設表示を実装する。

## 背景・目的

封印系の妨害行動は、発動すると対象1つ(護符・秘儀・天啓・神託・役2つ・コンボ上限のいずれか)が「次の妨害発動まで無効化される」効果を持つ。しかし現状のUI実装を調査した結果、封印中であることを視覚的に伝える常設表示は対象によってバラつきがあることが判明した:

| 封印種別(`activeSeal.kind`) | 現状の常設表示 |
|---|---|
| `talisman`(護符封印) | **なし**。バッジは通常表示のまま、効果だけ内部的に無効化される |
| `rite`(秘儀封印) | 秘儀ボタンが`canUseRite`経由で`usable=false`となりグレーアウト(他の理由での使用不可と見分けがつかない) |
| `revelationOrOracle`・`ref.kind==='revelation'`(天啓封印) | 天啓ボタンが同様にグレーアウト |
| `revelationOrOracle`・`ref.kind==='oracle'`(神託封印) | `RoleStatusPanel`で対象役の実効Lvが赤字表示になる |
| `role`(役封印) | `RoleStatusPanel`で対象役が赤字+実効Lv0表示 |
| `comboCap`(コンボ頭打ち) | **なし**。コンボ数表示は変化せず、上限到達時に増えなくなるだけ |

今回の実装では、常設表示が無い`talisman`・`comboCap`について常設表示を新設し、あわせて全5種類の封印に共通の「発動瞬間の演出」(フラッシュ+シェイク)を追加する。

## 方針(スコープ)

- 対象は封印系5種類(`talisman`・`rite`・`revelationOrOracle`[天啓/神託どちらも]・`role`・`comboCap`)のactiveSeal、および対応する妨害行動5個(`talismanSeal`・`riteSeal`・`revelationOracleSeal`・`roleSeal`・`comboCap`)。
- 没収系(`talismanConfiscate`等)・強制発動系・カード移動系・数値変化系は別グループとして対象外。
- `talismanHidden`(護符並び替え)の演出は対象外(データ・表示とも実装済み)。

## 常設表示の新設

### talismanSeal(護符封印)

対象護符のバッジに、既存の`talismanHidden`(護符並び替え)で使っている斜めストライプ背景をそのまま適用する。名前は隠さず表示したまま、背景だけ「無効化中」の見た目に切り替える。

`+page.svelte`の`itemBadges`スニペット(540-554行目)で、`talismanHidden`判定の隣に`talismanSealed`判定を追加する:

```svelte
{@const talismanSealed = wave?.activeSeal?.kind === 'talisman' && wave.activeSeal.id === id}
```

`talismanHidden`と`talismanSealed`は`activeSeal`が同時に1つしか存在しない(`triggerSabotage`が発動直前に必ず`null`へリセットしてから設定し直す設計、`types.ts`のコメント参照)ため、両方が同時にtrueになることはない。スタイルは`talismanHidden`用と同じ斜めストライプCSS(茶色系)を`talismanSealed`でも流用する(表示名は隠さない点のみ異なる)。

### comboCap(コンボ頭打ち)

`PlayArea.svelte`のコンボ数表示(1170-1173行目)を、上限中は「現在値/上限値」の分数形式に変更し、枠色を赤系にする。

```svelte
{@const comboCapMax = wave.activeSeal?.kind === 'comboCap' ? wave.activeSeal.max : null}
```

既存の`comboColor`/`comboScale`配列によるtier別の色・拡大は維持しつつ、`comboCapMax !== null`のときは追加で赤系のクラス(例: `text-rose-400`をtier色より優先)と`/{comboCapMax}`の表示を加える。

## 発動演出: フラッシュ+シェイク

対象1つが白く光りながら短時間(約500ms)左右に揺れてから、上記の常設表示(または既存のグレーアウト・`RoleStatusPanel`の赤字表示)に切り替わる。

### CSS定義

新規ファイル `src/routes/game/shidasu/sabotageAnimations.css` を作成し、`@keyframes shidasu-seal-flash`を定義する。クラス名・keyframes名とも`shidasu-`接頭辞を付け、他ページ(Solitaire等)のグローバルCSSとの衝突を避ける。

```css
@keyframes shidasu-seal-flash {
  0% { transform: translateX(0); filter: brightness(1); }
  15% { transform: translateX(-4px); filter: brightness(2.2); }
  30% { transform: translateX(4px); }
  45% { transform: translateX(-3px); }
  60% { transform: translateX(3px); }
  100% { transform: translateX(0); filter: brightness(1); }
}

.shidasu-seal-flash {
  animation: shidasu-seal-flash 0.5s ease-out;
}
```

`PlayArea.svelte`の`<script>`内で`import './sabotageAnimations.css'`する。Viteのグローバル(非scoped) CSSとしてバンドルに含まれるため、`+page.svelte`側でPlayAreaを利用している限り、`+page.svelte`側の要素(`itemBadges`・`RoleStatusPanel`)でも同じクラス名で参照できる。

### 対象特定とstate設計

`PlayArea.svelte`に、現在フラッシュ対象を保持する`$state`を追加する:

```ts
// wave.activeSealのうち、今回のグループA対象5種類(talismanHidden・roleBiasは除く)。
// activeSeal自体の型をそのまま再利用し、型の重複定義を避ける。
type SealFlashTarget = Exclude<WaveState['activeSeal'], { kind: 'talismanHidden' } | { kind: 'roleBias'; buffed: RoleName[]; nerfed: RoleName[]; multiplier: number } | null>

let sealFlashTarget = $state<SealFlashTarget | null>(null)
let sealFlashActive = $state(false)

function startSealFlashAnimation(target: SealFlashTarget) {
  sealFlashActive = true
  sealFlashTarget = target
  const timer = setTimeout(() => {
    sealFlashActive = false
    sealFlashTarget = null
  }, 500)
  dealTimers.push(timer)
}
```

`sealFlashActive`は関数の先頭で同期的に`true`にする(CLAUDE.mdの「移動アニメーション実装時の注意」・既存の`discardPurgeActive`/`stockShuffleActive`と同じ原則)。`anyAnimationActive`に`sealFlashActive`を追加し、演出中は他の操作(カードプレイ・山札引き・秘儀/天啓使用)をブロックする。

`sealFlashTarget`の型は`WaveState['activeSeal']`のうち`talismanHidden`を除いた5種類とほぼ同じ構造(`kind`と対象識別情報)。`+page.svelte`側の要素も同じ`sealFlashTarget`をpropsとして受け取り、判定に使う(下記「検知の配置」参照)。

各UI要素側の判定例(秘儀ボタン、`PlayArea.svelte`内):

```svelte
{@const flashing = sealFlashTarget?.kind === 'rite' && sealFlashTarget.id === riteId}
```

```svelte
class="... {flashing ? 'shidasu-seal-flash' : ''} ..."
```

護符バッジ側(`+page.svelte`、`itemBadges`スニペット):

```svelte
{@const talismanFlashing = sealFlashTarget?.kind === 'talisman' && sealFlashTarget.id === id}
```

コンボ表示側(`PlayArea.svelte`、対象は単一なのでidの一致判定は不要):

```svelte
{@const comboCapFlashing = sealFlashTarget?.kind === 'comboCap'}
```

`RoleStatusPanel.svelte`側は、対象の役名リストを`flashingRoles: RoleName[]`のようなpropsで受け取り、`flashingRoles.includes(role.name)`で判定する(`role`封印は`names`が複数、`revelationOrOracle`のoracle対象は単一役なので、`RoleStatusPanel`側では両方とも「フラッシュ対象の役名配列」に正規化して渡す)。

### 検知の配置

封印系の発動は`triggerSabotage`経由で、既存の`wave.lastSabotage`(`id`・`seq`)で検知できる。対象がPlayArea内外にまたがるため、検知ロジックを2箇所に配置する。

**`PlayArea.svelte`内(既存の`$effect.pre`を拡張)**: `riteSeal`・`comboCap`、および`revelationOracleSeal`のうち天啓が対象のケースは`PlayArea.svelte`内で完結するため、既存の`lastSabotage`検知ブロック(444-448行目付近)に分岐を追加する:

```ts
} else if (current.id === 'talismanSeal' || current.id === 'riteSeal' || current.id === 'revelationOracleSeal' || current.id === 'roleSeal' || current.id === 'comboCap') {
  if (wave.activeSeal && wave.activeSeal.kind !== 'talismanHidden' && wave.activeSeal.kind !== 'roleBias') {
    startSealFlashAnimation(wave.activeSeal)
  }
}
```

`current.id`がこの5種類のいずれかであれば、`applySabotageEffect`の実装上`wave.activeSeal`は必ず対応する`kind`(`talisman`/`rite`/`revelationOrOracle`/`role`/`comboCap`のいずれか)になる。`kind !== 'talismanHidden' && kind !== 'roleBias'`のガードは、TypeScriptの型を`SealFlashTarget`へ絞り込むためのものであり、実行時にこの2つのkindになることは無い(`talismanHidden`は`talismanShuffle`、`roleBias`は`roleBias`という別の妨害行動でのみ設定されるため)。

`talismanSeal`・`roleSeal`・oracle対象の`revelationOracleSeal`はPlayArea外の要素だが、`sealFlashTarget`のstate自体はPlayArea内に置き、PlayAreaから`+page.svelte`側へ`sealFlashTarget`をコールバックまたはbindable propsで公開する(`+page.svelte`側の`itemBadges`・`RoleStatusPanel`はPlayAreaの子ではなく兄弟/props経由の関係にあるため)。

具体的には、`PlayArea.svelte`に`onSealFlashChange?: (target: SealFlashTarget | null) => void`のようなコールバックpropsを追加し、`sealFlashTarget`が変化するたびに`+page.svelte`側の対応する`$state`に反映する形にする(既存のコールバックpropsパターン`onCleanupDone`等に倣う)。`+page.svelte`側はこれを受けて`itemBadges`・`RoleStatusPanel`に渡す。

## テスト

- **常設表示**: `talismanSeal`発動後、対象護符バッジに斜めストライプが適用されること、`comboCap`発動後にコンボ表示が「現在値/上限値」形式になることを、既存のengine.tsテスト(`activeSeal`の値そのもの)に加えて、コンポーネントレベルでは`npm run dev`+ブラウザでの目視確認とする(このプロジェクトはコンポーネントレベルの自動テストを持たない)。
- **発動演出**: `/admin/shidasu-debug`のデバッグ発動ボタンで各封印系妨害行動を発動し、対象要素がフラッシュ+シェイクしてから常設表示(またはグレーアウト・赤字表示)に切り替わることを目視確認する。
  - `talismanSeal`: 対象護符バッジがフラッシュ→斜めストライプに切り替わる
  - `riteSeal`・天啓対象の`revelationOracleSeal`: 対象ボタンがフラッシュ→グレーアウトに切り替わる
  - `roleSeal`・神託対象の`revelationOracleSeal`: `RoleStatusPanel`の対象行がフラッシュ→赤字表示に切り替わる
  - `comboCap`: コンボ表示がフラッシュ→「現在値/上限値」表示に切り替わる
  - 演出中(約500ms)は他の操作(カードプレイ・山札引き・秘儀/天啓使用)がブロックされ、完了後は正常に操作できることを確認する
- `npm run build`・`npm run check`が通ることを確認する。

## スコープ外

- 没収系・強制発動系・カード移動系・数値変化系(グループB〜E)の演出実装
- `talismanHidden`(護符並び替え)関連の変更
