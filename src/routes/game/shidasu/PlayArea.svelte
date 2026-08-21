<script module lang="ts">
  // list(本来のリスト、既に削除済み)にfadingId(フェード中の要素のid)を補完した配列を返す。
  // fadingId未指定の場合はlistをそのまま返す。挿入位置はidx(没収前の元の位置)。
  // +page.svelte・デバッグ画面(shidasu-debug)からもimportして使うため、moduleスクリプトで
  // exportする(通常のインスタンススクリプト内のexport functionはコンポーネントのプロパティとして
  // コンパイルされ、他ファイルから名前付きimportできないため)。
  //
  // 秘儀・天啓・神託のパルス演出(pressPulseTarget)での使い方について: これらは使用と同時に
  // 所持リストから即座に消費されるため、idxを持たないpressPulseTarget(グループBの
  // confiscatedTargetと違いidxを持たない型)向けには、常にlist.length(末尾)を渡して補完する。
  // 既知の制限が2つある: (1) list.includes()で「消費済みか」を呼び出し側が判定しているため、
  // 同名の秘儀/天啓/神託を複数所持している場合、実際に消費されたインスタンスではなく残っている
  // 別の同名インスタンスがパルスすることがある(見た目は同じボタンなので実害は小さい)。
  // (2) 没収フェードとパルスフェードを同時にwithFadingIdへ二重適用する箇所(神託バッジ)では、
  // 外側呼び出しの挿入位置(list.length)が内側呼び出し後の配列長ではなく元のlist.lengthを
  // 参照しているため、両方が同時に発生した場合に挿入順序が意図とわずかにズレうる。
  export function withFadingId<T>(list: T[], fadingId: T | undefined, idx: number): T[] {
    if (fadingId === undefined) return list
    const pos = Math.min(idx, list.length)
    return [...list.slice(0, pos), fadingId, ...list.slice(pos)]
  }

  // numericChangeTargetのkindに応じて、ポップアップに表示するテキストを算出する。
  // roleBiasは対象役ごとに強化/減衰いずれかでテキストが変わるため、呼び出し側が
  // 対象のroleNameを渡して判定する(コンボ・通貨・役レベルは単一の値なのでroleName不要)。
  // +page.svelte・デバッグ画面からもimportして使うため、moduleスクリプトでexportする
  // (通常のインスタンススクリプト内のexport functionは他ファイルから名前付きimport
  // できないため、withFadingIdと同じ理由でこちらに配置する)。
  export function numericChangePopupText(target: NonNullable<Exclude<WaveState['lastSabotage'], undefined>['numericChangeTarget']>, roleName?: RoleName): string {
    if (target.kind === 'combo' || target.kind === 'currency') return `−${target.amount}`
    if (target.kind === 'roleLevel') return `−${target.amount}`
    if (target.kind === 'roleBias') {
      if (roleName && target.buffed.includes(roleName)) return '×2'
      if (roleName && target.nerfed.includes(roleName)) return '×0.5'
      return ''
    }
    return '付喪化解除'
  }
</script>

<script lang="ts">
  import type { Snippet } from 'svelte'
  import { onDestroy, tick } from 'svelte'
  import { getPlayableColumns, isPlayable, remainingCount } from '$lib/game/shidasu/engine'
  import type { WaveState, StageModifier, ItemId, RiteId, RevelationId, RelicId, Card, PlayCardResult, ScoreGain, RoleName } from '$lib/game/shidasu/types'
  import type { ShidasuParams } from '$lib/game/shidasu/params'
  import { canUseRite } from '$lib/game/shidasu/riteEffects'
  import { riteDesc } from '$lib/game/shidasu/rites'
  import { canUseRevelation } from '$lib/game/shidasu/revelationEffects'
  import { revelationDesc } from '$lib/game/shidasu/revelations'
  import { nextChainSlotPosition } from '$lib/game/shidasu/chainLayout'
  import { runningTotalsFromScoreParts, type ScorePart } from '$lib/game/shidasu/scoreParts'
  import CardFace from './CardFace.svelte'
  import SuitCountPanel from './SuitCountPanel.svelte'
  import { CARD_BACK_STYLE } from './cardBackStyle'
  import './sabotageAnimations.css'

  let {
    wave, params, modifier, target, items, onPlayCard, onDraw, dropTarget = null, headerExtra, extraFooter,
    rites = [], onUseRite, disableRites = false,
    revelations = [], onUseRevelationClick,
    relics = [],
    showScoreAndCombo = true,
    allowDraw = true,
    columnTargetMode = false,
    canTargetColumn = () => true,
    onTargetColumn,
    chainAreaExtra,
    onScoreRevealDone, waveKey, onCleanupDone, onSealFlashChange, onConfiscateFadingChange, onPressPulseChange, onNumericPopupChange, onTalismanShuffleFlashChange,
    onScorePartHighlight,
  }: {
    wave: WaveState
    params: ShidasuParams
    modifier: StageModifier
    target: number
    items: ItemId[]
    onPlayCard: (colIndex: number, rowIndex: number) => PlayCardResult | void
    onDraw: () => void
    dropTarget?: { col: number; row: number } | 'stockTop' | null
    headerExtra?: Snippet
    extraFooter?: Snippet
    rites?: RiteId[]
    onUseRite?: (riteId: RiteId) => void
    disableRites?: boolean
    revelations?: RevelationId[]
    onUseRevelationClick?: (revelationId: RevelationId) => void
    relics?: { id: RelicId; tsukumoka: boolean }[]
    showScoreAndCombo?: boolean
    allowDraw?: boolean
    columnTargetMode?: boolean
    canTargetColumn?: (colIndex: number) => boolean
    onTargetColumn?: (colIndex: number) => void
    chainAreaExtra?: Snippet
    onScoreRevealDone?: () => void
    waveKey?: string
    onCleanupDone?: () => void
    onSealFlashChange?: (target: SealFlashTarget | null) => void
    onConfiscateFadingChange?: (target: ConfiscatedTarget | null) => void
    onPressPulseChange?: (target: PressPulseTarget | null) => void
    onNumericPopupChange?: (target: NumericChangeTarget | null) => void
    onTalismanShuffleFlashChange?: (active: boolean) => void
    onScorePartHighlight?: (itemId: ItemId | null) => void
  } = $props()

  let tableauEl: HTMLDivElement | undefined = $state()
  let chainAreaEl: HTMLDivElement | undefined = $state()

  interface PlayingAnimation {
    card: Card
    colIndex: number
    rowIndex: number
    phase: 'up' | 'warp' | 'left'
    left: number
    top: number
    transitionMs: number
  }

  let playingAnimation = $state<PlayingAnimation | null>(null)

  const ANIMATION_UP_MS = 150
  const ANIMATION_LEFT_MS = 200

  let animationTimer1: ReturnType<typeof setTimeout> | undefined
  let animationTimer2: ReturnType<typeof setTimeout> | undefined

  onDestroy(() => {
    clearTimeout(animationTimer1)
    clearTimeout(animationTimer2)
    clearTimeout(scoreRevealTimer)
    clearTimeout(cleanupTimer)
    clearTimeout(chainResetTimer)
    dealTimers.forEach(clearTimeout)
  })

  const PART_FLYIN_CENTER_MS = 300
  const PART_FLYIN_MOVE_MS = 260
  const PART_FLYIN_SCALE = 2
  // 拡大表示(partFlyInのtext-sm=14px相当)から内訳行(text-xs=12px相当)へ着地する際、
  // 見た目の文字サイズが一致するようスケールを逆算する(14px * 0.857 ≒ 12px)。
  const PART_FLYIN_LAND_SCALE = 12 / 14
  const TOTAL_PULSE_SCALE = 2.6
  const TOTAL_PULSE_MS = 300
  const SCORE_NUMBER_PULSE_SCALE = 1.3
  const SCORE_NUMBER_PULSE_MS = 200
  const SCORE_FLY_UP_MS = 200
  const SCORE_FLY_TO_SCORE_MS = 250
  const SCORE_FLY_UP_DISTANCE_PX = 40
  const SCORE_FLY_UP_SCALE = 1.5

  interface ScoreRevealState {
    parts: ScorePart[]
    runningTotals: number[]
    revealedCount: number
    totalGain: number
    totalScale: number
    totalTransitionMs: number
    flyPhase: 'none' | 'up' | 'toScore'
    flyLeft: number
    flyTop: number
    flyScale: number
    flyTransitionMs: number
  }

  interface PartFlyInState {
    text: string
    cardIds: number[]
    phase: 'center' | 'toRow'
    left: number
    top: number
    scale: number
    transitionMs: number
  }

  let scoreReveal = $state<ScoreRevealState | null>(null)
  let partFlyIn = $state<PartFlyInState | null>(null)
  let highlightedCardIds = $derived(new Set(partFlyIn?.cardIds ?? []))
  let displayedScore = $state(wave.score)
  // 捨て札常設UIの表示用スナップショット。wave.discardPileを直接参照すると、
  // チェーンリセットアニメーション実行中でもengine側は既に移動後の内容に
  // 更新済みのため、アニメーションが完了する前から移動後のカードが見えてしまう。
  // そのため、アニメーション開始前の内容をここに固定し、アニメーション完了時に
  // 最新のwave.discardPileへ同期し直す。
  let displayedDiscardTop = $state(wave.discardPile[wave.discardPile.length - 1] as Card | undefined)
  let previousWaveKey = waveKey
  $effect(() => {
    if (waveKey === undefined || waveKey === previousWaveKey) return
    previousWaveKey = waveKey
    displayedScore = wave.score
    cleanedUpColumns = new Set()
    chainCleanedUp = false
  })
  $effect(() => {
    if (waveKey === undefined || waveKey === previousDealWaveKey) return
    previousDealWaveKey = waveKey
    startDealAnimation()
  })
  // 天啓プレビュー破棄(endReason==='previewDismissed')を直接検知して片付けアニメーションを
  // 発火させる。通常のカードプレイ(target)によるWave終了はstartScoreReveal/finishScoreReveal
  // 経由で既に片付けアニメが発火するため対象外にする(waveKeyはプレビュー破棄時に変化しない
  // ためwaveKey監視では検知できず、この$effectが無いと片付けアニメが永遠に発火しなかった)。
  let previousPreviewDismissed = wave.status === 'ended' && wave.endReason === 'previewDismissed'
  $effect(() => {
    const isPreviewDismissed = wave.status === 'ended' && wave.endReason === 'previewDismissed'
    if (isPreviewDismissed === previousPreviewDismissed) return
    previousPreviewDismissed = isPreviewDismissed
    if (isPreviewDismissed && cleanupAnimation === null) {
      startCleanupAnimation()
    }
  })
  let scoreNumberEl: HTMLDivElement | undefined = $state()
  let scoreNumberScale = $state(1)
  let scoreNumberTransitionMs = $state(0)
  let totalGainEl: HTMLSpanElement | undefined = $state()
  let breakdownRowEl: HTMLSpanElement | undefined = $state()
  let noPlayableHintEl: HTMLDivElement | undefined = $state()
  let stockButtonEl: HTMLButtonElement | undefined = $state()
  let discardPileEl: HTMLDivElement | undefined = $state()

  const CLEANUP_GATHER_MS = 75
  const CLEANUP_MOVE_MS = 75

  // 複数カードを1山にまとめてから1点へ移動させる、gather→moveの2フェーズ
  // アニメーション共通の座標付きカード型。cleanupAnimation(Waveクリア後の片付け)・
  // chainResetAnimation(チェーンリセット時の捨て札移動)の両方で使う。
  interface GatherMoveCardPosition {
    card: Card
    left: number
    top: number
  }

  interface CleanupAnimation {
    kind: 'column' | 'chain' | 'discard'
    columnIndex: number
    card: Card
    phase: 'gather' | 'move'
    left: number
    top: number
    transitionMs: number
    gatherCards: GatherMoveCardPosition[]
  }

  interface ChainResetAnimation {
    phase: 'gather' | 'move'
    left: number
    top: number
    transitionMs: number
    gatherCards: GatherMoveCardPosition[]
  }

  // 配布アニメーション中、1枚のカードが山札から場札のマス目へ飛んでいく状態。
  interface DealingCard {
    card: Card
    colIndex: number
    rowIndex: number
    left: number
    top: number
    transitionMs: number
    faceUp: boolean
  }

  // 「複数カードを1山にまとめてから移動先へ移動させる」gather→moveの2フェーズ
  // アニメーションの共通制御ロジック。cleanupAnimation・chainResetAnimation両方から
  // 呼ばれる。呼び出し元は現在の$state値の読み取り・更新(get/set)と、gather対象カード・
  // 移動先座標・完了時コールバックを渡す。
  //
  // 実装上の注意点(いずれも過去の実装で踏んだ罠):
  // - 対象カードが2枚以上のときのみ「まとめる」動きを見せ、gatherフェーズの待機
  //   (GATHER_MSぶんのsetTimeout)を挟む。1枚だけの場合はまとめても見た目上動きが
  //   ないため、待機せず直接moveフェーズへ進む。
  // - transitionMs:0で位置を固定した直後、transitionMs付きで実際の移動を開始する
  //   際は必ず2段のrequestAnimationFrameを挟む。1段だけだと同一フレーム内で
  //   スタイル変更がバッチ処理され、transitionが発生しない(ワープする)ブラウザがある。
  // - moveフェーズでもgatherCardsは空にせず、代表カード(一番上に見えていたカード)を
  //   1件だけ残した配列にする。空にするとDOM要素が新規マウントされ、そのタイミングで
  //   最終位置とtransitionを同時に設定すると同様にワープする。
  function runGatherAndMoveAnimation<T extends { phase: 'gather' | 'move'; left: number; top: number; transitionMs: number; gatherCards: GatherMoveCardPosition[] }>(params: {
    getAnimation: () => T | null
    setAnimation: (next: T | null) => void
    setTimer: (timer: ReturnType<typeof setTimeout> | undefined) => void
    gatherCards: GatherMoveCardPosition[]
    representativeCard: Card
    gatherLeft: number
    gatherTop: number
    getMoveTarget: () => { left: number; top: number } | null
    gatherMs: number
    moveMs: number
    // moveフェーズへの切り替えと同時(移動開始時点)に呼ばれる。移動完了を待たずに
    // 更新したい状態(例: 元の位置の要素を隠すフラグ)があればここで行う。
    onMoveStart?: () => void
    onComplete: () => void
  }) {
    const { getAnimation, setAnimation, setTimer, gatherCards, representativeCard, gatherLeft, gatherTop, getMoveTarget, gatherMs, moveMs, onMoveStart, onComplete } = params

    function moveToTarget() {
      const current = getAnimation()
      const moveTarget = getMoveTarget()
      if (!current || !moveTarget) return
      setAnimation({
        ...current,
        phase: 'move',
        left: gatherLeft,
        top: gatherTop,
        transitionMs: 0,
        gatherCards: [{ card: representativeCard, left: gatherLeft, top: gatherTop }],
      })
      onMoveStart?.()
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const c = getAnimation()
          if (!c) return
          setAnimation({
            ...c,
            gatherCards: c.gatherCards.map(card => ({ ...card, left: moveTarget.left, top: moveTarget.top })),
            transitionMs: moveMs,
          })
        })
      })
      setTimer(setTimeout(() => {
        setAnimation(null)
        onComplete()
      }, moveMs))
    }

    if (gatherCards.length > 1) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const current = getAnimation()
          if (!current) return
          setAnimation({
            ...current,
            gatherCards: current.gatherCards.map(card => ({ ...card, left: gatherLeft, top: gatherTop })),
            transitionMs: gatherMs,
          })
          setTimer(setTimeout(moveToTarget, gatherMs))
        })
      })
    } else {
      moveToTarget()
    }
  }

  let cleanupAnimation = $state<CleanupAnimation | null>(null)
  let cleanedUpColumns = $state<Set<number>>(new Set())
  let chainCleanedUp = $state(false)
  // UI表示には使わない内部処理専用のキューのため、意図的に$stateにしていない。
  let cleanupQueue: { kind: 'column' | 'chain' | 'discard'; columnIndex: number; card: Card }[] = []
  let cleanupTimer: ReturnType<typeof setTimeout> | undefined
  let chainResetAnimation = $state<ChainResetAnimation | null>(null)
  let chainResetTimer: ReturnType<typeof setTimeout> | undefined

  // discardErase・discardBury発動時の「収束→再配布」演出用。ChainResetAnimationと
  // 同じgather/moveの2フェーズ構成をrunGatherAndMoveAnimationで共有する。
  let discardRedistributeAnimation = $state<ChainResetAnimation | null>(null)
  let discardRedistributeTimer: ReturnType<typeof setTimeout> | undefined

  // 収束完了後、1点から複数の終点(自分自身の位置+別エリア)へ順番に飛ばすカードの状態。
  // destinationで終点を区別する('primary'=集約先と同じエリアへ戻る分、'secondary'=別エリアへ
  // 移動する分)。
  interface DiscardRedistributeCard {
    card: Card
    left: number
    top: number
    transitionMs: number
    destination: 'primary' | 'secondary'
  }
  let discardRedistributeCards = $state<DiscardRedistributeCard[]>([])

  // discardErase・discardBury発動中、チェーンエリアの常設表示(wave.chainを直接
  // 参照する描画)が再配布完了前の新しい内容を先出ししないようにする同期ガードフラグ
  // (CLAUDE.md「移動アニメーション実装時の注意」・chainResetAnimationと同じ原則)。
  let chainAreaHiddenForRedistribute = $state(false)

  interface SabotageRedistributeAnimation {
    phase: 'gather' | 'move'
    left: number
    top: number
    transitionMs: number
    gatherCards: GatherMoveCardPosition[]
  }
  let sabotageRedistributeAnimation = $state<SabotageRedistributeAnimation | null>(null)
  let sabotageRedistributeTimer: ReturnType<typeof setTimeout> | undefined
  // 「総戻し」「一列戻し」発動により再収束・再配布中の列インデックス。この間、対象列の
  // 本物の場札描画(既に妨害後のデータになっている)を隠し、代わりにアニメーション用の
  // オーバーレイを表示する。
  let sabotageAnimatingColumns = $state<Set<number>>(new Set())
  interface FlippingCard {
    colIndex: number
    rowIndex: number
    card: Card
    revealed: boolean
    rotation: number
    transitionMs: number
  }
  let flippingCards = $state<FlippingCard[]>([])

  // 「大量放出」「少量放出」発動時、山札から捨て札へ飛んでいくカードの状態。
  // 捨て札は常に1枚しか表示しないため、複数枚が同時に飛んでいても着地順に処理する。
  interface DiscardPurgeCard {
    card: Card
    left: number
    top: number
    transitionMs: number
  }
  let discardPurgeCards = $state<DiscardPurgeCard[]>([])
  // 大量放出・少量放出で移動したカードが通常(表向き)の場合のフリップ状態。捨て札は
  // 常に1箇所しか無いため、複数列を扱うflippingCards配列とは別に単純なstateで持つ。
  interface DiscardFlip {
    card: Card
    revealed: boolean
    rotation: number
    transitionMs: number
  }
  let discardFlip = $state<DiscardFlip | null>(null)
  // startStockPurgeAnimation開始から完了(据え置き確定 or フリップ完了)までを覆う同期フラグ。
  // discardPurgeCards/discardFlipへの実際の書き込みはsetTimeout内(1枚目でも0ms遅延=次の
  // マクロタスク)で行われるため、これらだけをガードに使うと、$effect.pre内で
  // startStockPurgeAnimationを呼んだ直後・まだ何も配列に積まれていない一瞬の間に
  // displayedDiscardTop追従effectが素通りし、移動後のカードが一瞬先出しされてしまう
  // (CLAUDE.md「移動アニメーション実装時の注意」に該当する不具合)。この関数の先頭で
  // 同期的にtrueへ切り替えることで、その隙間を無くす。
  let discardPurgeActive = $state(false)

  // 山札シャッフル演出(揺れアニメーション)用の状態。stockShuffle/dagaz発動時、
  // 山札ボタンを短時間rotateさせるだけの装飾的な演出であり、データ(枚数・faceUp)
  // には一切影響しない。stockShuffleActiveは関数先頭で同期的にtrueへ切り替えることで、
  // 演出中は他の操作(山札引き・秘儀/天啓使用等)をanyAnimationActive経由でブロックする。
  let stockShuffleRotation = $state(0)
  let stockShuffleTransitionMs = $state(0)
  let stockShuffleActive = $state(false)

  // 「総入れ替え」(tableauShuffle)発動時、場札全体が一瞬裏向き表示に切り替わり
  // シェイクする演出用フラグ。trueの間、場札の各カードはfaceUpを無視して強制的に
  // 裏向き表示にする(実データのwave.tableauはこの時点で既にシャッフル後の内容に
  // 更新済みのため、実データを直接参照すると新配置が先出しされてしまう。CLAUDE.mdの
  // 「移動アニメーション実装時の注意」に基づく同期ガードフラグ)。
  let tableauShuffleActive = $state(false)

  // 「チェーン入れ替え」(chainShuffle)発動時、チェーンエリア全体がその場でシェイクする
  // 演出用フラグ。山札攪拌(stockShuffleActive)と同じ「その場で軽く揺れるだけ」の
  // 軽量パターン。
  let chainShuffleActive = $state(false)
  let chainShuffleRotation = $state(0)
  let chainShuffleTransitionMs = $state(0)

  // 妨害行動「封印系」(talismanSeal・riteSeal・revelationOracleSeal・roleSeal・comboCap)
  // 発動時のフラッシュ+シェイク演出用。wave.activeSealのうち、今回の対象5種類
  // (talismanHidden・roleBiasは対象外)。activeSeal自体の型をそのまま再利用し、
  // 型の重複定義を避ける。+page.svelte側からも同じ型をimportして使うため、exportする。
  export type SealFlashTarget = Exclude<WaveState['activeSeal'], { kind: 'talismanHidden' } | { kind: 'roleBias'; buffed: RoleName[]; nerfed: RoleName[]; multiplier: number } | null>

  let sealFlashTarget = $state<SealFlashTarget | null>(null)
  let sealFlashActive = $state(false)

  // 妨害行動「talismanShuffle」(護符並び替え)発動時、所持護符バッジ全てが同時に
  // フラッシュ+シェイクする演出用。対象は常に「全護符」固定のため、sealFlashTarget
  // のような対象識別情報は持たず、boolean一つのみで表現する。既存の封印系5種
  // (talismanSeal等)とは別の仕組み(単一対象へのsealFlashTarget)なので独立させている。
  let talismanShuffleFlashActive = $state(false)

  // sealFlashActiveは関数の先頭で同期的にtrueへ切り替える(CLAUDE.mdの「移動アニメーション
  // 実装時の注意」・discardPurgeActive/stockShuffleActiveと同じ原則)。500ms後に演出を終了し、
  // sealFlashTargetをnullへ戻す(対象要素は以後、常設表示側の判定に切り替わる)。
  function startSealFlashAnimation(target: SealFlashTarget) {
    sealFlashActive = true
    sealFlashTarget = target
    onSealFlashChange?.(target)
    const timer = setTimeout(() => {
      sealFlashActive = false
      sealFlashTarget = null
      onSealFlashChange?.(null)
    }, 500)
    dealTimers.push(timer)
  }

  // 妨害行動「talismanShuffle」(護符並び替え)発動時、全護符バッジのフラッシュ+シェイクを
  // 起動する。startSealFlashAnimationと同じ500ms持続だが、対象を持たないため
  // 引数無しで呼び出せる。
  function startTalismanShuffleFlashAnimation() {
    talismanShuffleFlashActive = true
    onTalismanShuffleFlashChange?.(true)
    const timer = setTimeout(() => {
      talismanShuffleFlashActive = false
      onTalismanShuffleFlashChange?.(false)
    }, 500)
    dealTimers.push(timer)
  }

  // 妨害行動「没収系」(talismanConfiscate・riteConfiscate・revelationOracleConfiscate・
  // relicConfiscate)発動時の崩れ落ちるフェード演出用。lastSabotage.confiscatedTargetと
  // 同じ型をそのまま再利用する。+page.svelte側からも同じ型をimportして使うため、exportする。
  export type ConfiscatedTarget = Exclude<WaveState['lastSabotage'], undefined>['confiscatedTarget']

  let confiscateFadingTarget = $state<ConfiscatedTarget | null>(null)
  let confiscateFadingActive = $state(false)

  // confiscateFadingActiveは関数の先頭で同期的にtrueへ切り替える(CLAUDE.mdの「移動アニメーション
  // 実装時の注意」・discardPurgeActive/sealFlashActiveと同じ原則)。実データ(run.items等)は
  // triggerSabotage実行と同時に削除済みのため、confiscateFadingTargetは「削除される直前の対象」
  // を一時的に保持し、各バッジ描画箇所がこれを見て「本来のリスト+フェード中要素」を補完する。
  // 500ms後に演出を終了しconfiscateFadingTargetをnullへ戻すと、補完されていた要素も自然に消える。
  function startConfiscateFadeAnimation(target: NonNullable<ConfiscatedTarget>) {
    confiscateFadingActive = true
    confiscateFadingTarget = target
    onConfiscateFadingChange?.(target)
    const timer = setTimeout(() => {
      confiscateFadingActive = false
      confiscateFadingTarget = null
      onConfiscateFadingChange?.(null)
    }, 500)
    dealTimers.push(timer)
  }

  // 妨害行動「強制発動系」(riteForceActivate・revelationOracleForceActivate)発動時、および
  // 秘儀・天啓・神託の通常クリック発動時に共通適用する自動プレス+パルス演出用。
  // lastSabotage.forceActivatedTargetと同じ型をそのまま再利用する。+page.svelte側からも
  // 同じ型をimportして使うため、exportする。
  export type PressPulseTarget = Exclude<WaveState['lastSabotage'], undefined>['forceActivatedTarget']

  let pressPulseTarget = $state<PressPulseTarget | null>(null)
  let pressPulseActive = $state(false)

  // pressPulseActiveは関数の先頭で同期的にtrueへ切り替える(CLAUDE.mdの「移動アニメーション
  // 実装時の注意」・sealFlashActive/confiscateFadingActiveと同じ原則)。ただしこのstate自体は
  // anyAnimationActiveには含めない(通常クリック発動は効果が同期的に即座へ適用されるため、
  // パルス演出=装飾の完了を待ってから次の操作を許可する必要が無い)。
  function startPressPulseAnimation(target: NonNullable<PressPulseTarget>) {
    pressPulseActive = true
    pressPulseTarget = target
    onPressPulseChange?.(target)
    const timer = setTimeout(() => {
      pressPulseActive = false
      pressPulseTarget = null
      onPressPulseChange?.(null)
    }, 500)
    dealTimers.push(timer)
  }

  // 妨害行動「数値変化系」(comboBreather・comboReduce・currencyConfiscate・currencyDrain・
  // roleLevelDecay・roleBias・tsukumokaRelease)発動時のシェイク+ポップアップ演出用。
  // lastSabotage.numericChangeTargetと同じ型をそのまま再利用する。+page.svelte側からも
  // 同じ型をimportして使うため、exportする。
  export type NumericChangeTarget = Exclude<WaveState['lastSabotage'], undefined>['numericChangeTarget']

  let numericPopupTarget = $state<NumericChangeTarget | null>(null)
  let numericPopupActive = $state(false)

  // numericPopupActiveは関数の先頭で同期的にtrueへ切り替える(CLAUDE.mdの「移動アニメーション
  // 実装時の注意」・sealFlashActive等と同じ原則)。ただしこのstate自体はanyAnimationActiveには
  // 含めない(効果は同期的に即座へ適用されるため、演出=装飾の完了を待つ必要が無い、
  // pressPulseActiveと同じ理由)。
  function startNumericPopupAnimation(target: NonNullable<NumericChangeTarget>) {
    numericPopupActive = true
    numericPopupTarget = target
    onNumericPopupChange?.(target)
    const timer = setTimeout(() => {
      numericPopupActive = false
      numericPopupTarget = null
      onNumericPopupChange?.(null)
    }, 500)
    dealTimers.push(timer)
  }

  // 「山札攪拌」(stockShuffle妨害行動・dagaz秘儀)・「チェーン入れ替え」(chainShuffle妨害行動)
  // 発動時、対象要素が短く左右に回転シェイクする軽量演出の共通ロジック。対象ごとに
  // 別々の$stateを持つため(要素自体が別のDOM位置にあるため単一stateで共用できない)、
  // setter群を引数で受け取るパラメータ化で重複を避ける。
  function startShakeAnimation(setActive: (v: boolean) => void, setRotation: (v: number) => void, setTransitionMs: (v: number) => void) {
    setActive(true)
    const steps = [-8, 8, -5, 5, 0]
    steps.forEach((deg, i) => {
      const timer = setTimeout(() => {
        setRotation(deg)
        setTransitionMs(60)
        if (i === steps.length - 1) {
          const doneTimer = setTimeout(() => {
            setActive(false)
          }, 60)
          dealTimers.push(doneTimer)
        }
      }, i * 60)
      dealTimers.push(timer)
    })
  }

  function startStockShuffleAnimation() {
    startShakeAnimation(v => (stockShuffleActive = v), v => (stockShuffleRotation = v), v => (stockShuffleTransitionMs = v))
  }

  // 「チェーン入れ替え」(chainShuffle)発動時、チェーンエリアが短く左右にシェイクする。
  // startStockShuffleAnimationと同じstartShakeAnimationを対象要素だけ変えて適用する。
  function startChainShuffleAnimation() {
    startShakeAnimation(v => (chainShuffleActive = v), v => (chainShuffleRotation = v), v => (chainShuffleTransitionMs = v))
  }

  // 「総入れ替え」(tableauShuffle)発動時、場札全体を一瞬裏向き+シェイク表示にしてから
  // 新しい配置(実データは既に更新済み)を反映する。startStockShuffleAnimationと同様の
  // 「回転で揺れる」動きではなく、CSS(shidasu-numeric-shakeの左右シェイク)を場札全体の
  // ラッパー要素に適用する。
  function startTableauShuffleAnimation() {
    tableauShuffleActive = true
    const timer = setTimeout(() => {
      tableauShuffleActive = false
    }, 400)
    dealTimers.push(timer)
  }

  const FLIP_HALF_MS = 100
  let dealingCards = $state<DealingCard[]>([])
  // 着地済み(実表示に切り替え済み)のマス目を"col-row"形式の文字列で追跡する。
  // 配布アニメーション進行中は、このSetに含まれないマス目を非表示にする。
  let dealtCells = $state<Set<string>>(new Set())
  let dealAnimationActive = $derived(dealingCards.length > 0)
  // いずれかのアニメーション(カードプレイ・得点演出・清算・チェーンリセット・配布)が進行中かどうか。
  // 進行中は操作(カードプレイ・山札引き・秘儀/天啓使用)を無効化する。
  let anyAnimationActive = $derived(playingAnimation !== null || scoreReveal !== null || cleanupAnimation !== null || chainResetAnimation !== null || dealAnimationActive || sabotageRedistributeAnimation !== null || sabotageAnimatingColumns.size > 0 || flippingCards.length > 0 || discardPurgeActive || stockShuffleActive || sealFlashActive || confiscateFadingActive || discardRedistributeAnimation !== null || chainAreaHiddenForRedistribute || tableauShuffleActive || chainShuffleActive)
  let dealTimers: ReturnType<typeof setTimeout>[] = []
  // 初期値をundefinedにしておくことで、マウント直後(ゲーム開始直後の最初のWave)にも
  // 「waveKeyが変化した」と判定され配布アニメーションが発火する。他のprevious系変数
  // (previousWaveKey等)は「変化検知後の差分リセット」用途のため初期値をwaveKeyにしているが、
  // こちらは初回から必ず配布演出を見せたいため、あえて挙動を変えている。
  let previousDealWaveKey: string | undefined = undefined

  const DEAL_INTERVAL_MS = 30
  const DEAL_MOVE_MS = 150
  // Cardオブジェクトそのものをスナップショットとして保持する(IDだけでなく)。
  // wave.discardPileから該当カードを引き直す設計だと、治癒(healing)護符の発動時に
  // discardPile全体がシャッフルされ一部が場札へ復元されるため、末尾N件がリセット対象と
  // 一致しなくなりアニメーションが無音でスキップされる不具合があった。リセット直前の
  // wave.chainから直接Cardを保持しておけば、discardPileの並び順に一切依存しない。
  let previousChainCards: Card[] = wave.chain
  let previousChainWaveKey = waveKey

  // $effect.preを使う理由: 山札を捲った際のチェーンリセットは、捲ったカードの追加と
  // リセットによる短縮がengine側で1回のwave更新にまとめて起きるため、通常の$effect
  // (DOM更新後に発火)では旧チェーンのカードDOM要素が既に消えており座標を取得できない。
  // $effect.preはDOM更新前(旧チェーンがまだ描画されている状態)に発火するため、
  // ここで対象カードのDOM要素から座標を記録してからstartChainResetAnimationへ渡す。
  $effect.pre(() => {
    const currentChainCards = wave.chain
    // waveKeyの変化(新Wave境界)を自前で追跡する。既存のwaveKey監視effect
    // (前方のブロック)が同じフレームでpreviousWaveKeyを先に更新してしまうため、
    // このeffect内でwaveKey !== previousWaveKeyを見ても新Wave境界を検知できない。
    if (waveKey !== previousChainWaveKey) {
      previousChainWaveKey = waveKey
      previousChainCards = currentChainCards
      return
    }
    // 通常のプレイ・山札捲りによるチェーン延長は、previousChainCardsの末尾に
    // 1件追加しただけの配列と一致する(先頭からの並びが変わらない)。
    // それ以外の変化(チェーンが短くなる、または同じ長さでも中身が入れ替わる)は
    // すべてリセットとみなす。長さの比較だけでは「1枚→1枚」のリセットを
    // 検知できないため、先頭からの一致を見る。
    const isExtension = currentChainCards.length === previousChainCards.length + 1
      && previousChainCards.every((card, i) => card.id === currentChainCards[i].id)
    // 「現在のチェーンに含まれないカード」のみをresetCards(=今回消えたカード)とする。
    // 修正前は「現在のチェーンの末尾カードidと不一致」で判定していたため、
    // chainPartialDiscard(先頭のみ除去、残りは維持)発動時に、まだ場に残っている
    // カードまで誤って「消えた」扱いになる不具合があった。例: previousChainCards=[A,B,C,D]で
    // 先頭2枚(A,B)が除去されcurrentChainCards=[C,D]になった場合、修正前は
    // resetCards=[A,B,C]（Cを誤検知）だったが、修正後はresetCards=[A,B]（正しい）になる。
    const resetCards = isExtension
      ? []
      : previousChainCards.filter(card => !currentChainCards.some(c => c.id === card.id))
    previousChainCards = currentChainCards
    if (resetCards.length === 0) return
    startChainResetAnimation(resetCards)
  })

  let previousSabotageSeq = wave.lastSabotage?.seq ?? 0
  $effect.pre(() => {
    const current = wave.lastSabotage
    if (!current || current.seq === previousSabotageSeq) return
    previousSabotageSeq = current.seq
    if ((current.id === 'tableauFullReturn' || current.id === 'columnReturn') && current.affectedCols) {
      startSabotageRedistributeAnimation(current.affectedCols)
    } else if ((current.id === 'stockPurge' || current.id === 'stockPurgeSmall') && current.purgedToDiscardCount) {
      startStockPurgeAnimation(current.purgedToDiscardCount)
    } else if (current.id === 'talismanSeal' || current.id === 'riteSeal' || current.id === 'revelationOracleSeal' || current.id === 'roleSeal' || current.id === 'comboCap') {
      if (wave.activeSeal && wave.activeSeal.kind !== 'talismanHidden' && wave.activeSeal.kind !== 'roleBias') {
        startSealFlashAnimation(wave.activeSeal)
      }
    } else if (current.id === 'talismanConfiscate' || current.id === 'riteConfiscate' || current.id === 'revelationOracleConfiscate' || current.id === 'relicConfiscate') {
      if (current.confiscatedTarget) {
        startConfiscateFadeAnimation(current.confiscatedTarget)
      }
    } else if (current.id === 'riteForceActivate' || current.id === 'revelationOracleForceActivate') {
      if (current.forceActivatedTarget) {
        startPressPulseAnimation(current.forceActivatedTarget)
      }
    } else if (current.id === 'comboBreather' || current.id === 'comboReduce' || current.id === 'currencyConfiscate' || current.id === 'currencyDrain' || current.id === 'roleLevelDecay' || current.id === 'roleBias' || current.id === 'tsukumokaRelease') {
      if (current.numericChangeTarget) {
        startNumericPopupAnimation(current.numericChangeTarget)
      }
    } else if (current.id === 'tableauCardToDiscard') {
      if (current.tableauCardRemoved) {
        startTableauCardToDiscardAnimation(current.tableauCardRemoved)
      }
    } else if (current.id === 'discardErase' || current.id === 'discardBury') {
      if (current.redistributedAreas) {
        startDiscardRedistributeAnimation(current.redistributedAreas)
      }
    } else if (current.id === 'tableauShuffle') {
      startTableauShuffleAnimation()
    } else if (current.id === 'chainShuffle') {
      startChainShuffleAnimation()
    } else if (current.id === 'talismanShuffle') {
      startTalismanShuffleFlashAnimation()
    }
  })

  // 山札シャッフル演出(stockShuffle/dagaz)のトリガー検知。lastSabotageとは別の
  // 発動経路(useRite)からも更新されるため、専用のseq追跡変数で検知する。
  let previousStockShuffleSeq = wave.lastStockShuffle?.seq ?? 0
  $effect.pre(() => {
    const current = wave.lastStockShuffle
    if (!current || current.seq === previousStockShuffleSeq) return
    previousStockShuffleSeq = current.seq
    startStockShuffleAnimation()
  })

  // chainResetAnimationが実行されていない間は、捨て札常設UIの表示を
  // 常に最新のwave.discardPileへ追従させる(アニメーション中のみ、
  // 上のeffect.preでの検知とstartChainResetAnimation側の更新で固定される)。
  $effect(() => {
    if (chainResetAnimation !== null || discardPurgeActive) return
    displayedDiscardTop = wave.discardPile[wave.discardPile.length - 1]
  })

  // Waveクリア確定後、場札の各列(左から右)→チェーン→捨て札の順に、
  // 各カード群を1山にまとめて山札へ移動させるアニメーションを開始する。
  function startCleanupAnimation() {
    cleanedUpColumns = new Set()
    chainCleanedUp = false
    const columnItems = wave.tableau
      .map((col, ci) => ({ columnIndex: ci, card: col[col.length - 1] }))
      .filter((entry): entry is { columnIndex: number; card: Card } => entry.card !== undefined)
      .map(entry => ({ kind: 'column' as const, columnIndex: entry.columnIndex, card: entry.card }))
    const chainItems = wave.chain.length > 0
      ? [{ kind: 'chain' as const, columnIndex: -1, card: wave.chain[wave.chain.length - 1] }]
      : []
    const discardItems = wave.discardPile.length > 0
      ? [{ kind: 'discard' as const, columnIndex: -1, card: wave.discardPile[wave.discardPile.length - 1] }]
      : []
    cleanupQueue = [...columnItems, ...chainItems, ...discardItems]
    processNextCleanupItem()
  }

  function processNextCleanupItem() {
    const item = cleanupQueue.shift()
    if (!item) {
      cleanupAnimation = null
      onCleanupDone?.()
      return
    }
    startCleanupItem(item)
  }

  // 配布アニメーションで着地したカードが列の一番上だった場合に呼ぶ。裏面のまま真横まで
  // 回転させ(見た目上不可視になった瞬間にrevealedをtrueへ切り替えて表向きの中身に差し替え)、
  // 続けて正面まで回転させて表向き表示を完了する。完了後はdealtCellsへ登録し、以後は
  // 通常の場札描画(既存のfaceUp={card.faceUp !== false || isTop}ルール)にそのまま委ねる。
  function startFlipReveal(colIndex: number, rowIndex: number, card: Card) {
    flippingCards = [...flippingCards, { colIndex, rowIndex, card, revealed: false, rotation: 0, transitionMs: 0 }]

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        flippingCards = flippingCards.map(f =>
          f.colIndex === colIndex && f.rowIndex === rowIndex ? { ...f, rotation: 90, transitionMs: FLIP_HALF_MS } : f
        )
      })
    })

    const timer1 = setTimeout(() => {
      flippingCards = flippingCards.map(f =>
        f.colIndex === colIndex && f.rowIndex === rowIndex ? { ...f, revealed: true, rotation: 90, transitionMs: 0 } : f
      )
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          flippingCards = flippingCards.map(f =>
            f.colIndex === colIndex && f.rowIndex === rowIndex ? { ...f, rotation: 0, transitionMs: FLIP_HALF_MS } : f
          )
        })
      })
      const timer2 = setTimeout(() => {
        flippingCards = flippingCards.filter(f => !(f.colIndex === colIndex && f.rowIndex === rowIndex))
        dealtCells = new Set([...dealtCells, `${colIndex}-${rowIndex}`])
      }, FLIP_HALF_MS)
      dealTimers.push(timer2)
    }, FLIP_HALF_MS)
    dealTimers.push(timer1)
  }

  // 大量放出・少量放出で捨て札へ移動したカードが通常(表向き)の場合に呼ぶ。捨て札位置で
  // 裏面のまま真横まで回転させ、真横で不可視になった瞬間にrevealedをtrueへ切り替えて
  // 表向きの中身に差し替え、続けて正面まで回転させる。startFlipRevealの捨て札専用版
  // (捨て札は常に1箇所しか無いため、複数列を扱うflippingCards配列ではなく単一の
  // discardFlip stateで実装する)。完了後はdisplayedDiscardTopを更新し、以後は
  // 通常の捨て札表示(既存のfaceUp={displayedDiscardTop.faceUp !== false}ルール)に
  // そのまま委ねる。
  function startDiscardFlipReveal(card: Card) {
    discardFlip = { card, revealed: false, rotation: 0, transitionMs: 0 }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        discardFlip = discardFlip ? { ...discardFlip, rotation: 90, transitionMs: FLIP_HALF_MS } : null
      })
    })

    const timer1 = setTimeout(() => {
      discardFlip = discardFlip ? { ...discardFlip, revealed: true, rotation: 90, transitionMs: 0 } : null
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          discardFlip = discardFlip ? { ...discardFlip, rotation: 0, transitionMs: FLIP_HALF_MS } : null
        })
      })
      const timer2 = setTimeout(() => {
        discardFlip = null
        displayedDiscardTop = card
        discardPurgeActive = false
      }, FLIP_HALF_MS)
      dealTimers.push(timer2)
    }, FLIP_HALF_MS)
    dealTimers.push(timer1)
  }

  // 「大量放出」「少量放出」発動時、山札から捨て札へcount枚を裏向きで個別に飛ばす。
  // 最後の1枚が着地したら、移動したカードのfaceUp(sabotageEffects.ts側で捨て札の
  // 現在の状態を継承して確定済み)を見て、フリップ演出(表向き)するか裏向きのまま
  // 据え置くかを決める。
  function startStockPurgeAnimation(count: number) {
    if (count <= 0 || !stockButtonEl || !discardPileEl) return
    discardPurgeActive = true
    const fromRect = stockButtonEl.getBoundingClientRect()
    const fromLeft = fromRect.left + fromRect.width / 2
    const fromTop = fromRect.top + fromRect.height / 2
    const toRect = discardPileEl.getBoundingClientRect()
    const toLeft = toRect.left + toRect.width / 2
    const toTop = toRect.top + toRect.height / 2

    const purged = wave.discardPile.slice(wave.discardPile.length - count)

    purged.forEach((card, index) => {
      const timer = setTimeout(() => {
        discardPurgeCards = [...discardPurgeCards, { card, left: fromLeft, top: fromTop, transitionMs: 0 }]

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            discardPurgeCards = discardPurgeCards.map(d => (d.card.id === card.id ? { ...d, left: toLeft, top: toTop, transitionMs: DEAL_MOVE_MS } : d))
          })
        })

        const landTimer = setTimeout(() => {
          discardPurgeCards = discardPurgeCards.filter(d => d.card.id !== card.id)
          if (index === purged.length - 1) {
            if (card.faceUp === false) {
              displayedDiscardTop = card
              discardPurgeActive = false
            } else {
              startDiscardFlipReveal(card)
            }
          }
        }, DEAL_MOVE_MS)
        dealTimers.push(landTimer)
      }, index * DEAL_INTERVAL_MS)
      dealTimers.push(timer)
    })
  }

  // 「一枚没収」(tableauCardToDiscard)発動時、場札の該当マス目から捨て札へ1枚を
  // 個別移動させる。startStockPurgeAnimationとほぼ同じ構造だが、起点が山札ボタン固定
  // ではなく場札の該当マス目である点、および常に1枚のみ(複数枚の時間差処理が不要)な
  // 点が異なる。場札のカードは常に表向き(faceUp: true)のため、着地後は必ず
  // フリップ演出(startDiscardFlipReveal)を行う。
  function startTableauCardToDiscardAnimation(removed: { colIndex: number; rowIndex: number; card: Card }) {
    if (!tableauEl || !discardPileEl) return
    const fromEl = tableauEl.querySelector<HTMLElement>(`[data-drop-col="${removed.colIndex}"][data-drop-row="${removed.rowIndex}"]`)
    if (!fromEl) return
    discardPurgeActive = true
    const fromRect = fromEl.getBoundingClientRect()
    const fromLeft = fromRect.left + fromRect.width / 2
    const fromTop = fromRect.top + fromRect.height / 2
    const toRect = discardPileEl.getBoundingClientRect()
    const toLeft = toRect.left + toRect.width / 2
    const toTop = toRect.top + toRect.height / 2

    const card = removed.card
    discardPurgeCards = [...discardPurgeCards, { card, left: fromLeft, top: fromTop, transitionMs: 0 }]

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        discardPurgeCards = discardPurgeCards.map(d => (d.card.id === card.id ? { ...d, left: toLeft, top: toTop, transitionMs: DEAL_MOVE_MS } : d))
      })
    })

    const landTimer = setTimeout(() => {
      discardPurgeCards = discardPurgeCards.filter(d => d.card.id !== card.id)
      startDiscardFlipReveal(card)
    }, DEAL_MOVE_MS)
    dealTimers.push(landTimer)
  }

  // 「総戻し」「一列戻し」発動時、対象列のカードを山札の位置へ収束させるアニメーションを
  // 開始する。完了後、startSabotageDealAnimationへ引き継ぐ。
  function startSabotageRedistributeAnimation(affectedCols: number[]) {
    if (affectedCols.length === 0 || !tableauEl || !stockButtonEl) return

    const gatherCards: GatherMoveCardPosition[] = []
    affectedCols.forEach(ci => {
      const col = wave.tableau[ci]
      col.forEach((card, ri) => {
        const cardEl = tableauEl?.querySelector<HTMLElement>(`[data-drop-col="${ci}"][data-drop-row="${ri}"]`)
        if (!cardEl) return
        const cardRect = cardEl.getBoundingClientRect()
        gatherCards.push({ card, left: cardRect.left + cardRect.width / 2, top: cardRect.top + cardRect.height / 2 })
      })
    })
    if (gatherCards.length === 0) return

    sabotageAnimatingColumns = new Set(affectedCols)

    const firstCardEl = tableauEl.querySelector<HTMLElement>(`[data-drop-col="${affectedCols[0]}"][data-drop-row="0"]`)
    const gatherRect = (firstCardEl ?? tableauEl).getBoundingClientRect()
    const gatherLeft = gatherRect.left + gatherRect.width / 2
    const gatherTop = gatherRect.top + gatherRect.height / 2

    sabotageRedistributeAnimation = {
      phase: 'gather',
      left: gatherLeft,
      top: gatherTop,
      transitionMs: 0,
      gatherCards,
    }

    runGatherAndMoveAnimation({
      getAnimation: () => sabotageRedistributeAnimation,
      setAnimation: next => { sabotageRedistributeAnimation = next },
      setTimer: timer => { sabotageRedistributeTimer = timer },
      gatherCards,
      representativeCard: gatherCards[0].card,
      gatherLeft,
      gatherTop,
      getMoveTarget: () => {
        if (!stockButtonEl) return null
        const rect = stockButtonEl.getBoundingClientRect()
        return { left: rect.left + rect.width / 2, top: rect.top + rect.height / 2 }
      },
      gatherMs: CLEANUP_GATHER_MS,
      moveMs: CLEANUP_MOVE_MS,
      onComplete: () => startSabotageDealAnimation(affectedCols),
    })
  }

  // 収束アニメーション完了後、対象列のみへカードを裏向きで配り直す。配布順序は
  // 対象列内でrow=0から順に、複数列がある場合は列をまたいでrow単位で揃える
  // (startDealAnimationと同じ考え方)。着地したカードがその列の一番上であれば
  // フリップ演出(startFlipReveal)を、そうでなければ即座にdealtCellsへ登録する。
  function startSabotageDealAnimation(affectedCols: number[]) {
    // 対象列を「未配布」扱いに戻す(isNotYetDealtの判定に使うdealtCellsから除去)。
    dealtCells = new Set([...dealtCells].filter(key => !affectedCols.includes(Number(key.split('-')[0]))))
    // sabotageAnimatingColumnsによる列全体の非表示は収束フェーズ専用。配布フェーズが
    // 始まった時点でクリアし、以後は1枚ずつ着地するたびにdealtCellsへ登録される
    // isNotYetDealt判定に表示制御を委ねる(このクリアを配布完了まで遅らせると、
    // 対象列が全カード着地するまで丸ごと非表示のままになり、対象列数・枚数が多い
    // 総戻しほど「配布完了まで何も見えない」不具合が顕著になっていた)。
    sabotageAnimatingColumns = new Set()

    if (!stockButtonEl) return
    const fromRect = stockButtonEl.getBoundingClientRect()
    const fromLeft = fromRect.left + fromRect.width / 2
    const fromTop = fromRect.top + fromRect.height / 2

    const maxRows = Math.max(0, ...affectedCols.map(ci => wave.tableau[ci].length))
    const order: { card: Card; colIndex: number; rowIndex: number }[] = []
    for (let ri = 0; ri < maxRows; ri++) {
      for (const ci of affectedCols) {
        const card = wave.tableau[ci][ri]
        if (card) order.push({ card, colIndex: ci, rowIndex: ri })
      }
    }

    order.forEach((entry, index) => {
      const timer = setTimeout(() => {
        const isTopOfColumn = entry.rowIndex === wave.tableau[entry.colIndex].length - 1
        dealOneCard(entry, fromLeft, fromTop, false, landedEntry => {
          if (isTopOfColumn) {
            startFlipReveal(landedEntry.colIndex, landedEntry.rowIndex, landedEntry.card)
          } else {
            dealtCells = new Set([...dealtCells, `${landedEntry.colIndex}-${landedEntry.rowIndex}`])
          }
        })
      }, index * DEAL_INTERVAL_MS)
      dealTimers.push(timer)
    })
  }

  // 新Wave開始時、山札の位置から場札の各マス目へカードを配るアニメーションを開始する。
  // 配布順序はrow=0を全列左→右に1枚ずつ、次にrow=1を全列左→右…という順。
  function startDealAnimation() {
    dealTimers.forEach(clearTimeout)
    dealTimers = []
    dealingCards = []
    dealtCells = new Set()

    if (!stockButtonEl) return
    const fromRect = stockButtonEl.getBoundingClientRect()
    const fromLeft = fromRect.left + fromRect.width / 2
    const fromTop = fromRect.top + fromRect.height / 2

    const maxRows = Math.max(0, ...wave.tableau.map(col => col.length))
    const order: { card: Card; colIndex: number; rowIndex: number }[] = []
    for (let ri = 0; ri < maxRows; ri++) {
      for (let ci = 0; ci < wave.tableau.length; ci++) {
        const card = wave.tableau[ci][ri]
        if (card) order.push({ card, colIndex: ci, rowIndex: ri })
      }
    }

    order.forEach((entry, index) => {
      const timer = setTimeout(() => {
        dealOneCard(entry, fromLeft, fromTop)
      }, index * DEAL_INTERVAL_MS)
      dealTimers.push(timer)
    })
  }

  // 1枚のカードを山札の位置からマス目の位置へ移動させ、着地したらdealtCellsに登録して
  // 実表示へ切り替える。複数枚が時間差で同時並行するため、dealingCardsは配列で管理する。
  // faceUpは配布中の表示に使う(通常配布は常にtrue、妨害再配布はfalse)。onLandedは
  // 着地時にdealtCells登録の代わりに独自処理をしたい呼び出し元(妨害再配布)向けのフック。
  function dealOneCard(
    entry: { card: Card; colIndex: number; rowIndex: number },
    fromLeft: number,
    fromTop: number,
    faceUp: boolean = true,
    onLanded?: (entry: { card: Card; colIndex: number; rowIndex: number }) => void
  ) {
    if (!tableauEl) return
    const targetEl = tableauEl.querySelector<HTMLElement>(`[data-drop-col="${entry.colIndex}"][data-drop-row="${entry.rowIndex}"]`)
    if (!targetEl) return
    const targetRect = targetEl.getBoundingClientRect()
    const targetLeft = targetRect.left + targetRect.width / 2
    const targetTop = targetRect.top + targetRect.height / 2

    dealingCards = [
      ...dealingCards,
      { card: entry.card, colIndex: entry.colIndex, rowIndex: entry.rowIndex, left: fromLeft, top: fromTop, transitionMs: 0, faceUp },
    ]

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        dealingCards = dealingCards.map(d =>
          d.colIndex === entry.colIndex && d.rowIndex === entry.rowIndex
            ? { ...d, left: targetLeft, top: targetTop, transitionMs: DEAL_MOVE_MS }
            : d
        )
      })
    })

    const timer = setTimeout(() => {
      dealingCards = dealingCards.filter(d => !(d.colIndex === entry.colIndex && d.rowIndex === entry.rowIndex))
      if (onLanded) {
        onLanded(entry)
      } else {
        dealtCells = new Set([...dealtCells, `${entry.colIndex}-${entry.rowIndex}`])
      }
    }, DEAL_MOVE_MS)
    dealTimers.push(timer)
  }

  // チェーンリセット発生時、旧チェーンのカード(次チェーンに引き継がれる1枚を除く)を
  // 1山にまとめてから捨て札の位置へ移動させるアニメーションを開始する。
  // resetCardsはリセット直前のwave.chainのうち、次チェーンへ引き継がれなかったカード一覧。
  // wave.discardPileから該当カードを引き直さず、渡されたCardオブジェクトをそのまま使う。
  // (治癒護符発動時、discardPile全体がシャッフルされ末尾N件がリセット対象と一致しなくなる
  // ケースがあるため、discardPileの並び順には一切依存しない設計にしている)
  function startChainResetAnimation(resetCards: Card[]) {
    if (!chainAreaEl || !discardPileEl) return
    const cardEntries = resetCards
      .map(card => {
        const cardEl = chainAreaEl?.querySelector<HTMLElement>(`[data-chain-card-id="${card.id}"]`)
        return cardEl ? { card, el: cardEl } : null
      })
      .filter((entry): entry is { card: Card; el: HTMLElement } => entry !== null)
    if (cardEntries.length === 0) return

    // 集約先・代表カードの基準は「一番上に見えていたカード」= resetCardsの末尾
    // (wave.chainは先頭が最も古く、末尾が最新=最前面に描画されるカードのため)。
    const topEntry = cardEntries[cardEntries.length - 1]
    const gatherLeft = topEntry.el.getBoundingClientRect().left + topEntry.el.getBoundingClientRect().width / 2
    const gatherTop = topEntry.el.getBoundingClientRect().top + topEntry.el.getBoundingClientRect().height / 2

    const gatherCards: GatherMoveCardPosition[] = cardEntries.map(entry => {
      const rect = entry.el.getBoundingClientRect()
      return {
        card: entry.card,
        left: rect.left + rect.width / 2,
        top: rect.top + rect.height / 2,
      }
    })

    chainResetAnimation = {
      phase: 'gather',
      left: gatherLeft,
      top: gatherTop,
      transitionMs: 0,
      gatherCards,
    }

    runGatherAndMoveAnimation({
      getAnimation: () => chainResetAnimation,
      setAnimation: next => { chainResetAnimation = next },
      setTimer: timer => { chainResetTimer = timer },
      gatherCards,
      representativeCard: topEntry.card,
      gatherLeft,
      gatherTop,
      getMoveTarget: () => {
        if (!discardPileEl) return null
        const toRect = discardPileEl.getBoundingClientRect()
        return { left: toRect.left + toRect.width / 2, top: toRect.top + toRect.height / 2 }
      },
      gatherMs: CLEANUP_GATHER_MS,
      moveMs: CLEANUP_MOVE_MS,
      // chainResetAnimationがnullに戻ると同時に、後述のeffectが
      // displayedDiscardTopを最新のwave.discardPileへ自動的に同期する。
      onComplete: () => {},
    })
  }

  // 「捨て札消去」(discardErase)・「捨て札埋没」(discardBury)発動時、対象2エリアの
  // 全カードを1点に集約してから、新しい内容(wave.chain/wave.discardPile/wave.stock)を
  // 元に再配布するアニメーションを開始する。
  //
  // discardErase(kind: 'chainAndDiscard'): 集約先=chainAreaEl中心。収束元は現在の
  //   wave.discardPile全カード(discardPileElから)+現在のwave.chain全カード
  //   (chainAreaElの各data-chain-card-idから)。再配布はwave.chainの枚数分を
  //   chainAreaElへ('primary')、残りをdiscardPileElへ('secondary')。
  // discardBury(kind: 'stockAndDiscard'): 集約先=discardPileEl中心。収束元は
  //   wave.discardPile全カード(discardPileElから)。wave.stockは個別カード表示を
  //   持たないため、収束元としてはstockButtonElの位置を使う(実際に集めるカード表示は
  //   discardPile分のみ)。再配布はwave.discardPileの枚数分をdiscardPileElへ
  //   ('primary'、常にfaceUp: falseで着地)、残りはstockButtonEl位置へ移動して消える
  //   ('secondary'、山札は個別表示が無いため到着後はフェードせず即座に消す)。
  function startDiscardRedistributeAnimation(areas: { kind: 'chainAndDiscard' } | { kind: 'stockAndDiscard' }) {
    if (!chainAreaEl || !discardPileEl || !stockButtonEl) return
    chainAreaHiddenForRedistribute = true

    const gatherCards: GatherMoveCardPosition[] = []

    if (areas.kind === 'chainAndDiscard') {
      wave.chain.forEach(card => {
        const el = chainAreaEl?.querySelector<HTMLElement>(`[data-chain-card-id="${card.id}"]`)
        if (!el) return
        const rect = el.getBoundingClientRect()
        gatherCards.push({ card, left: rect.left + rect.width / 2, top: rect.top + rect.height / 2 })
      })
      const discardRect = discardPileEl.getBoundingClientRect()
      wave.discardPile.forEach(card => {
        gatherCards.push({ card, left: discardRect.left + discardRect.width / 2, top: discardRect.top + discardRect.height / 2 })
      })
    } else {
      const discardRect = discardPileEl.getBoundingClientRect()
      wave.discardPile.forEach(card => {
        gatherCards.push({ card, left: discardRect.left + discardRect.width / 2, top: discardRect.top + discardRect.height / 2 })
      })
    }
    if (gatherCards.length === 0) return
    const representativeCard = gatherCards[0].card

    const gatherTargetRect = areas.kind === 'chainAndDiscard' ? chainAreaEl.getBoundingClientRect() : discardPileEl.getBoundingClientRect()
    const gatherLeft = gatherTargetRect.left + gatherTargetRect.width / 2
    const gatherTop = gatherTargetRect.top + gatherTargetRect.height / 2

    discardRedistributeAnimation = {
      phase: 'gather',
      left: gatherLeft,
      top: gatherTop,
      transitionMs: 0,
      gatherCards,
    }

    runGatherAndMoveAnimation({
      getAnimation: () => discardRedistributeAnimation,
      setAnimation: next => { discardRedistributeAnimation = next },
      setTimer: timer => { discardRedistributeTimer = timer },
      gatherCards,
      representativeCard,
      gatherLeft,
      gatherTop,
      getMoveTarget: () => ({ left: gatherLeft, top: gatherTop }),
      gatherMs: CLEANUP_GATHER_MS,
      moveMs: CLEANUP_MOVE_MS,
      onComplete: () => startDiscardRedistributeDeal(areas, gatherLeft, gatherTop),
    })
  }

  // 収束完了後、集約ポイントから新しい内容(wave.chain/wave.discardPile)へ1枚ずつ
  // 再配布する。primaryは集約先と同じエリアへ(discardEraseならchainAreaEl、
  // discardBuryならdiscardPileEl)、secondaryは別エリアへ飛ばす。
  function startDiscardRedistributeDeal(areas: { kind: 'chainAndDiscard' } | { kind: 'stockAndDiscard' }, fromLeft: number, fromTop: number) {
    if (!chainAreaEl || !discardPileEl || !stockButtonEl) return

    const primaryCards = areas.kind === 'chainAndDiscard' ? wave.chain : wave.discardPile
    const secondaryCards = areas.kind === 'chainAndDiscard' ? wave.discardPile : []
    const primaryRect = areas.kind === 'chainAndDiscard' ? chainAreaEl.getBoundingClientRect() : discardPileEl.getBoundingClientRect()
    const primaryLeft = primaryRect.left + primaryRect.width / 2
    const primaryTop = primaryRect.top + primaryRect.height / 2
    const secondaryRect = areas.kind === 'chainAndDiscard' ? discardPileEl.getBoundingClientRect() : stockButtonEl.getBoundingClientRect()
    const secondaryLeft = secondaryRect.left + secondaryRect.width / 2
    const secondaryTop = secondaryRect.top + secondaryRect.height / 2

    const order: { card: Card; destination: 'primary' | 'secondary'; toLeft: number; toTop: number }[] = [
      ...primaryCards.map(card => ({ card, destination: 'primary' as const, toLeft: primaryLeft, toTop: primaryTop })),
      ...secondaryCards.map(card => ({ card, destination: 'secondary' as const, toLeft: secondaryLeft, toTop: secondaryTop })),
    ]

    if (order.length === 0) {
      chainAreaHiddenForRedistribute = false
      return
    }

    order.forEach((entry, index) => {
      const timer = setTimeout(() => {
        discardRedistributeCards = [...discardRedistributeCards, { card: entry.card, left: fromLeft, top: fromTop, transitionMs: 0, destination: entry.destination }]

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            discardRedistributeCards = discardRedistributeCards.map(d => (d.card.id === entry.card.id ? { ...d, left: entry.toLeft, top: entry.toTop, transitionMs: DEAL_MOVE_MS } : d))
          })
        })

        const landTimer = setTimeout(() => {
          discardRedistributeCards = discardRedistributeCards.filter(d => d.card.id !== entry.card.id)
          if (index === order.length - 1) {
            chainAreaHiddenForRedistribute = false
          }
        }, DEAL_MOVE_MS)
        dealTimers.push(landTimer)
      }, index * DEAL_INTERVAL_MS)
      dealTimers.push(timer)
    })
  }

  function startCleanupItem(item: { kind: 'column' | 'chain' | 'discard'; columnIndex: number; card: Card }) {
    let fromEl: HTMLElement | null = null
    if (item.kind === 'column') {
      const col = wave.tableau[item.columnIndex]
      fromEl = tableauEl?.querySelector<HTMLElement>(`[data-drop-col="${item.columnIndex}"][data-drop-row="${col.length - 1}"]`) ?? null
    } else if (item.kind === 'chain') {
      // チェーンエリア全体の中心ではなく、一番上に見えているカード(チェーンの末尾要素)の
      // 位置でまとめる。チェーンエリアが横に長い場合、中心とはずれた位置になるため。
      const topCard = wave.chain[wave.chain.length - 1]
      fromEl = (topCard && chainAreaEl?.querySelector<HTMLElement>(`[data-chain-card-id="${topCard.id}"]`)) ?? chainAreaEl ?? null
    } else {
      fromEl = discardPileEl ?? null
    }
    if (!fromEl || !stockButtonEl) {
      // 座標が取得できない(要素未マウント等)場合は、このアイテムをスキップして次へ進む。
      // stockButtonEl自体が無い場合はキュー内の全アイテムがこの分岐に入り同期的な
      // 再帰呼び出しで一気に消化されるが、キューの長さは場札の列数+チェーン+捨て札の
      // 最大10個未満に収まるため、スタックオーバーフローの実害はない。
      processNextCleanupItem()
      return
    }
    const fromRect = fromEl.getBoundingClientRect()
    const gatherLeft = fromRect.left + fromRect.width / 2
    const gatherTop = fromRect.top + fromRect.height / 2

    let gatherCards: GatherMoveCardPosition[] = []
    if (item.kind === 'column' && tableauEl) {
      const col = wave.tableau[item.columnIndex]
      gatherCards = col
        .map((card, ri) => {
          const cardEl = tableauEl?.querySelector<HTMLElement>(`[data-drop-col="${item.columnIndex}"][data-drop-row="${ri}"]`)
          if (!cardEl) return null
          const cardRect = cardEl.getBoundingClientRect()
          return {
            card,
            left: cardRect.left + cardRect.width / 2,
            top: cardRect.top + cardRect.height / 2,
          }
        })
        .filter((entry): entry is GatherMoveCardPosition => entry !== null)
    } else if (item.kind === 'chain' && chainAreaEl) {
      gatherCards = wave.chain
        .map(card => {
          const cardEl = chainAreaEl?.querySelector<HTMLElement>(`[data-chain-card-id="${card.id}"]`)
          if (!cardEl) return null
          const cardRect = cardEl.getBoundingClientRect()
          return {
            card,
            left: cardRect.left + cardRect.width / 2,
            top: cardRect.top + cardRect.height / 2,
          }
        })
        .filter((entry): entry is GatherMoveCardPosition => entry !== null)
    }

    cleanupAnimation = {
      kind: item.kind,
      columnIndex: item.columnIndex,
      card: item.card,
      phase: 'gather',
      left: gatherLeft,
      top: gatherTop,
      transitionMs: 0,
      gatherCards,
    }

    runGatherAndMoveAnimation({
      getAnimation: () => cleanupAnimation,
      setAnimation: next => { cleanupAnimation = next },
      setTimer: timer => { cleanupTimer = timer },
      gatherCards,
      representativeCard: item.card,
      gatherLeft,
      gatherTop,
      getMoveTarget: () => {
        if (!stockButtonEl) return null
        const rect = stockButtonEl.getBoundingClientRect()
        return { left: rect.left + rect.width / 2, top: rect.top + rect.height / 2 }
      },
      gatherMs: CLEANUP_GATHER_MS,
      moveMs: CLEANUP_MOVE_MS,
      onMoveStart: () => {
        if (item.kind === 'column') {
          cleanedUpColumns = new Set([...cleanedUpColumns, item.columnIndex])
        } else if (item.kind === 'chain') {
          chainCleanedUp = true
        }
      },
      onComplete: processNextCleanupItem,
    })
  }

  let scoreRevealTimer: ReturnType<typeof setTimeout> | undefined

  let previousDisplayedScore = displayedScore
  $effect(() => {
    const current = displayedScore
    if (current === previousDisplayedScore) return
    previousDisplayedScore = current
    scoreNumberScale = SCORE_NUMBER_PULSE_SCALE
    scoreNumberTransitionMs = 0
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scoreNumberScale = 1
        scoreNumberTransitionMs = SCORE_NUMBER_PULSE_MS
      })
    })
  })

  function startScoreReveal(lastGain: ScoreGain | null) {
    const allParts = lastGain?.parts ?? []
    if (allParts.length === 0) {
      displayedScore = wave.score
      onScoreRevealDone?.()
      if (wave.status === 'ended' && wave.endReason === 'target') startCleanupAnimation()
      return
    }
    const runningTotals = runningTotalsFromScoreParts(allParts)
    const totalGain = lastGain?.points ?? 0
    clearTimeout(scoreRevealTimer)
    scoreReveal = {
      parts: allParts,
      runningTotals,
      revealedCount: 0,
      totalGain,
      totalScale: 1,
      totalTransitionMs: 0,
      flyPhase: 'none',
      flyLeft: 0,
      flyTop: 0,
      flyScale: 1,
      flyTransitionMs: 0,
    }
    // 内訳行(breakdownRowEl)がDOMに描画されるのを待ってから、1つ目のパーツの拡大表示を開始する。
    // 直前のscoreReveal代入だけではSvelteの描画がまだ反映されていない可能性があるため、
    // tick()で描画反映を待つ(既存のカード移動アニメ・SCORE飛び込みアニメと同じ考え方)。
    tick().then(() => startPartFlyIn(0))
  }

  // index番目のパーツを、画面中央に拡大表示してから内訳行(breakdownRowEl)へ移動させる。
  function startPartFlyIn(index: number) {
    const part = scoreReveal?.parts[index]
    if (!scoreReveal || !part || !breakdownRowEl || !noPlayableHintEl) {
      if (scoreReveal) landPart(index)
      return
    }
    onScorePartHighlight?.(part.itemId ?? null)
    const hintRect = noPlayableHintEl.getBoundingClientRect()
    partFlyIn = {
      text: part.text,
      cardIds: part.cardIds ?? [],
      phase: 'center',
      left: hintRect.left + hintRect.width / 2,
      top: hintRect.top + hintRect.height / 2,
      scale: PART_FLYIN_SCALE,
      transitionMs: 0,
    }
    scoreRevealTimer = setTimeout(() => {
      if (!partFlyIn || !breakdownRowEl || !scoreReveal) return
      const rowRect = breakdownRowEl.getBoundingClientRect()
      const landX = scoreReveal.revealedCount === 0 ? rowRect.left : rowRect.right
      partFlyIn = {
        ...partFlyIn,
        phase: 'toRow',
        left: landX,
        top: rowRect.top + rowRect.height / 2,
        scale: PART_FLYIN_LAND_SCALE,
        transitionMs: PART_FLYIN_MOVE_MS,
      }
      scoreRevealTimer = setTimeout(() => landPart(index), PART_FLYIN_MOVE_MS)
    }, PART_FLYIN_CENTER_MS)
  }

  // index番目のパーツを内訳行に確定表示し、合計値の強調(パルス)を行う。
  // 次のパーツがあれば続けてstartPartFlyInを呼び、無ければSCOREへの飛び込み演出へ進む。
  function landPart(index: number) {
    if (!scoreReveal) return
    partFlyIn = null
    onScorePartHighlight?.(null)
    scoreReveal = { ...scoreReveal, revealedCount: index + 1, totalScale: TOTAL_PULSE_SCALE, totalTransitionMs: 0 }
    // transitionMs:0でのスタイル変更をブラウザが実際に描画へ反映してから次のtransitionを開始するために
    // 2段rAFが必要。1段のrAFだけだと同一フレーム内でスタイル変更がバッチ処理され、
    // 拡大→元のサイズへの戻りがtransitionせず一瞬で切り替わってしまうブラウザがある。
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!scoreReveal) return
        scoreReveal = { ...scoreReveal, totalScale: 1, totalTransitionMs: TOTAL_PULSE_MS }
      })
    })
    if (index + 1 < scoreReveal.parts.length) {
      startPartFlyIn(index + 1)
    } else {
      startScoreFly()
    }
  }

  function startScoreFly() {
    if (!scoreReveal || !totalGainEl || !scoreNumberEl) {
      finishScoreReveal()
      return
    }
    const fromRect = totalGainEl.getBoundingClientRect()
    const toRect = scoreNumberEl.getBoundingClientRect()
    scoreReveal = { ...scoreReveal, flyPhase: 'up', flyLeft: fromRect.left, flyTop: fromRect.top, flyScale: 1, flyTransitionMs: 0 }
    // transitionMs:0でのスタイル変更をブラウザが実際に描画へ反映してから次のtransitionを開始するために
    // 2段rAFが必要。1段のrAFだけだと同一フレーム内でスタイル変更がバッチ処理され、transitionが
    // 発生しないブラウザがある(カード移動アニメのワープ処理と同じ理由)。
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!scoreReveal) return
        scoreReveal = {
          ...scoreReveal,
          flyLeft: fromRect.left,
          flyTop: fromRect.top - SCORE_FLY_UP_DISTANCE_PX,
          flyScale: SCORE_FLY_UP_SCALE,
          flyTransitionMs: SCORE_FLY_UP_MS,
        }
      })
    })
    scoreRevealTimer = setTimeout(() => {
      if (!scoreReveal) return
      scoreReveal = { ...scoreReveal, flyPhase: 'toScore', flyLeft: toRect.left, flyTop: toRect.top, flyScale: 1, flyTransitionMs: SCORE_FLY_TO_SCORE_MS }
      scoreRevealTimer = setTimeout(finishScoreReveal, SCORE_FLY_TO_SCORE_MS)
    }, SCORE_FLY_UP_MS)
  }

  function finishScoreReveal() {
    displayedScore = wave.score
    scoreReveal = null
    onScoreRevealDone?.()
    if (wave.status === 'ended' && wave.endReason === 'target') startCleanupAnimation()
  }

  function startPlayCardAnimation(colIndex: number, rowIndex: number, card: Card) {
    if (playingAnimation) return
    clearTimeout(animationTimer1)
    clearTimeout(animationTimer2)
    if (!tableauEl || !chainAreaEl) {
      onPlayCard(colIndex, rowIndex)
      return
    }
    const cardEl = tableauEl.querySelector<HTMLElement>(`[data-drop-col="${colIndex}"][data-drop-row="${rowIndex}"]`)
    if (!cardEl) {
      onPlayCard(colIndex, rowIndex)
      return
    }
    const cardRect = cardEl.getBoundingClientRect()
    const chainRect = chainAreaEl.getBoundingClientRect()
    const slot = nextChainSlotPosition(wave.chain.length, params.ui.chainCardOffsetX, params.ui.chainCardsPerRow)
    const targetLeft = chainRect.left + slot.left
    const targetTop = chainRect.top + slot.top
    const warpLeft = chainRect.right + 200

    playingAnimation = {
      card, colIndex, rowIndex,
      phase: 'up',
      left: cardRect.left, top: cardRect.top,
      transitionMs: 0,
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!playingAnimation) return
        playingAnimation = { ...playingAnimation, top: -100, transitionMs: ANIMATION_UP_MS }
      })
    })

    animationTimer1 = setTimeout(() => {
      if (!playingAnimation) return
      playingAnimation = { ...playingAnimation, phase: 'warp', left: warpLeft, top: targetTop, transitionMs: 0 }
      // transitionMs:0でのスタイル変更をブラウザが実際に描画へ反映してから次のtransitionを開始するために2段rAFが必要。
      // 1段のrAFだけだと同一フレーム内でスタイル変更がバッチ処理され、ワープにならずtransitionしてしまうブラウザがある。
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!playingAnimation) return
          playingAnimation = { ...playingAnimation, phase: 'left', left: targetLeft, top: targetTop, transitionMs: ANIMATION_LEFT_MS }
        })
      })
    }, ANIMATION_UP_MS)

    animationTimer2 = setTimeout(() => {
      playingAnimation = null
      const result = onPlayCard(colIndex, rowIndex)
      if (result) startScoreReveal(result.lastGain)
    }, ANIMATION_UP_MS + ANIMATION_LEFT_MS)
  }

  function chunk<T>(arr: T[], size: number): T[][] {
    const result: T[][] = []
    for (let i = 0; i < arr.length; i += size) {
      result.push(arr.slice(i, i + size))
    }
    return result
  }

  const comboColor = ['text-emerald-100', 'text-yellow-300', 'text-orange-400', 'text-rose-400']
  const comboScale = ['scale-100', 'scale-105', 'scale-110', 'scale-125']

  let playableCols = $derived(getPlayableColumns(modifier, wave, items))
  let remainingCards = $derived(remainingCount(wave.tableau))
  let displayComboTier = $derived.by(() => {
    const [t1, t2, t3] = params.ui.comboTierThresholds
    return wave.combo >= t3 ? 3 : wave.combo >= t2 ? 2 : wave.combo >= t1 ? 1 : 0
  })
  let chainEntries = $derived(wave.chain.map((c, i) => ({ card: c, origin: wave.chainOrigin[i] })))
  let chainRows = $derived(chunk(chainEntries, params.ui.chainCardsPerRow))
  let progressBarLightPercent = $derived.by(() => {
    const finalScore = scoreReveal ? displayedScore + scoreReveal.totalGain : displayedScore
    return Math.min(100, (finalScore / target) * 100)
  })
  let progressBarDarkPercent = $derived.by(() => {
    const revealTotal = scoreReveal
      ? (scoreReveal.revealedCount === 0 ? 0 : Math.round(scoreReveal.runningTotals[scoreReveal.revealedCount - 1]))
      : 0
    return Math.min(100, ((displayedScore + revealTotal) / target) * 100)
  })
</script>

<div class="px-4 pt-3">
  {#if headerExtra}
    {@render headerExtra()}
  {/if}
  {#if showScoreAndCombo}
    {@const comboCapMax = wave.activeSeal?.kind === 'comboCap' ? wave.activeSeal.max : null}
    {@const comboCapFlashing = sealFlashTarget?.kind === 'comboCap'}
    {@const comboNumericPopup = numericPopupTarget?.kind === 'combo' ? numericPopupTarget : undefined}
    <div class="mt-2 flex items-end justify-between">
      <div>
        <div class="text-xs text-emerald-300/70 tracking-widest">SCORE / TARGET</div>
        <div
          bind:this={scoreNumberEl}
          class="text-xl font-black text-amber-50 tabular-nums ease-out"
          style="transform: scale({scoreNumberScale}); transition-property: transform; transition-duration:{scoreNumberTransitionMs}ms;"
        >
          {displayedScore} <span class="text-sm text-emerald-300/70">/ {target}</span>
        </div>
      </div>
      <div class="text-right transition-transform origin-bottom-right {comboScale[displayComboTier]}">
        <div class="text-xs text-emerald-300/70 tracking-widest">COMBO</div>
        <div class="relative text-3xl font-black italic tabular-nums leading-none {comboCapFlashing ? 'shidasu-seal-flash' : ''} {comboNumericPopup ? 'shidasu-numeric-shake' : ''} {comboCapMax !== null ? 'text-rose-400' : comboColor[displayComboTier]}">
          {wave.combo}{#if wave.baseComboCount > 0}<span class="text-lg not-italic ml-1 text-emerald-300/80">+{wave.baseComboCount}</span>{/if}{#if comboCapMax !== null}<span class="text-lg not-italic ml-1 text-rose-300">/{comboCapMax}</span>{/if}
          {#if comboNumericPopup}<span class="shidasu-numeric-popup">{numericChangePopupText(comboNumericPopup)}</span>{/if}
        </div>
      </div>
    </div>
  {/if}
  <div class="mt-1 h-1.5 rounded-full bg-emerald-900 overflow-hidden relative">
    <div class="absolute inset-y-0 left-0 h-full bg-yellow-300/30 transition-all duration-300" style="width:{progressBarLightPercent}%"></div>
    <div class="absolute inset-y-0 left-0 h-full bg-gradient-to-r from-yellow-500 to-yellow-300" style="width:{progressBarDarkPercent}%"></div>
  </div>
  {#if scoreReveal}
    {@const isLastLanded = scoreReveal.revealedCount === scoreReveal.parts.length}
    {@const currentTotal = scoreReveal.revealedCount === 0
      ? 0
      : isLastLanded
        ? Math.floor(scoreReveal.runningTotals[scoreReveal.revealedCount - 1])
        : Math.round(scoreReveal.runningTotals[scoreReveal.revealedCount - 1])}
    <div class="flex items-center justify-between text-sm h-5">
      <span bind:this={breakdownRowEl} class="text-emerald-200 text-xs">{scoreReveal.parts.slice(0, scoreReveal.revealedCount).map(p => p.text).join(' ')}</span>
      <span
        bind:this={totalGainEl}
        class="text-yellow-300 font-black inline-block ease-out"
        style="transform: scale({scoreReveal.totalScale}); transition-property: transform; transition-duration:{scoreReveal.totalTransitionMs}ms;"
      >+{currentTotal}</span>
    </div>
  {:else if wave.lastGain}
    {@const totalPoints = wave.lastGain?.points ?? 0}
    {@const allParts = wave.lastGain?.parts ?? []}
    <div class="flex items-center justify-between text-sm h-5">
      {#if allParts.length > 0}
        <span class="text-emerald-200 text-xs">{allParts.map(p => p.text).join(' ')}</span>
      {:else}
        <span></span>
      {/if}
      <span class="text-yellow-300 font-black">+{totalPoints}</span>
    </div>
  {:else}
    <div class="h-5"></div>
  {/if}
</div>

<SuitCountPanel {wave} />

<div class="px-3 pt-1">
  <div bind:this={tableauEl} class="grid gap-1 {tableauShuffleActive ? 'shidasu-numeric-shake' : ''}" style="grid-template-columns: repeat({params.layout.cols}, minmax(0, 1fr));">
    {#each wave.tableau as col, ci (ci)}
      <div class="relative" style="min-height: 10.5rem;">
        {#each col as card, ri (card.id)}
          {@const isTop = ri === col.length - 1}
          {@const isSelectable = columnTargetMode ? isTop : (isTop || wave.playFromAnywhereActiveThisWave)}
          {@const isAnimatingThisCard = playingAnimation?.colIndex === ci && playingAnimation?.rowIndex === ri}
          {@const isCleaningUpThisColumn = (cleanupAnimation?.kind === 'column' && cleanupAnimation.columnIndex === ci) || cleanedUpColumns.has(ci)}
          {@const isNotYetDealt = dealAnimationActive && !dealtCells.has(`${ci}-${ri}`)}
          {@const isHiddenForSabotageRedistribute = sabotageAnimatingColumns.has(ci)}
          {@const flippingHere = flippingCards.find(f => f.colIndex === ci && f.rowIndex === ri)}
          {@const displayFaceUp = !tableauShuffleActive && (card.faceUp !== false || isTop)}
          <div
            class="absolute left-0 right-0 {dropTarget && dropTarget !== 'stockTop' && dropTarget.col === ci && dropTarget.row === ri ? 'ring-4 ring-sky-400 rounded-lg' : ''} {isAnimatingThisCard || isCleaningUpThisColumn || isNotYetDealt || isHiddenForSabotageRedistribute || flippingHere ? 'invisible' : ''}"
            style="top:{ri * 18}px; z-index:{ri};"
            data-drop-col={ci}
            data-drop-row={ri}
          >
            {#if isSelectable}
              {@const isTargetable = columnTargetMode && canTargetColumn(ci)}
              {@const isCardPlayable = !columnTargetMode && wave.status === 'playing' && isPlayable(modifier, wave, card, items)}
              <button
                type="button"
                disabled={anyAnimationActive}
                onclick={() => (columnTargetMode ? (isTargetable && onTargetColumn?.(ci)) : (isCardPlayable && startPlayCardAnimation(ci, ri, card)))}
                class="block w-full text-left {columnTargetMode ? (isTargetable ? 'ring-2 ring-fuchsia-400 shadow-lg -translate-y-0.5' : '') : (isCardPlayable && !anyAnimationActive ? 'ring-2 ring-yellow-300 shadow-lg -translate-y-0.5' : '')} transition-transform disabled:cursor-not-allowed"
              >
                <CardFace {card} covered={false} faceUp={displayFaceUp} {items} />
              </button>
            {:else}
              <CardFace {card} covered={false} faceUp={displayFaceUp} {items} />
            {/if}
          </div>
        {/each}
        {#if col.length === 0 && columnTargetMode}
          {@const isTargetable = canTargetColumn(ci)}
          <button
            type="button"
            onclick={() => isTargetable && onTargetColumn?.(ci)}
            aria-label="空の列{ci + 1}"
            class="absolute left-0 right-0 top-0 w-full rounded-lg border-2 border-dashed {isTargetable ? 'border-fuchsia-400' : 'border-transparent'}"
            style="aspect-ratio: 2 / 3;"
          ></button>
        {/if}
      </div>
    {/each}
  </div>
  <div
    bind:this={noPlayableHintEl}
    class="text-center text-emerald-300/80 text-xs mt-16 animate-pulse {playableCols.size === 0 && wave.stock.length > 0 && remainingCards > 0 && scoreReveal === null && partFlyIn === null ? '' : 'invisible'}"
  >取れる札がない → 山札をめくろう</div>
</div>

<div class="px-4 text-center text-yellow-300 text-xs font-black animate-pulse mb-1 {wave.lastDrawEffect === 'pattern' ? '' : 'invisible'}">✦ パターン継続! ✦</div>

<div class="px-4 pb-5 pt-2 flex items-start gap-4">
  <div class="flex flex-col items-center gap-1" style="margin-top:20px;">
    <button
      type="button"
      onclick={onDraw}
      disabled={wave.stock.length === 0 || !allowDraw || anyAnimationActive}
      data-drop-stock
      bind:this={stockButtonEl}
      style="aspect-ratio: 2 / 3; transform: rotate({stockShuffleRotation}deg); transition-property: transform; transition-duration:{stockShuffleTransitionMs}ms; {wave.stock.length > 0 ? CARD_BACK_STYLE : ''}"
      class="w-16 shrink-0 rounded-lg border-2 flex flex-col items-center justify-center font-black active:scale-95 transition-transform {dropTarget === 'stockTop' ? 'ring-4 ring-sky-400' : ''} {wave.stock.length > 0 ? 'border-indigo-500/50 text-amber-50' : 'bg-emerald-900 border-emerald-800 text-emerald-700'}"
    >
      <div class="text-xs">山札</div>
      <div class="text-lg tabular-nums">{wave.stock.length}</div>
    </button>
    <div bind:this={discardPileEl} class="w-16 {cleanupAnimation?.kind === 'discard' || discardPurgeActive ? 'invisible' : ''}">
      {#if displayedDiscardTop}
        <CardFace card={displayedDiscardTop} covered={false} faceUp={displayedDiscardTop.faceUp !== false} {items} />
      {:else}
        <div class="w-full rounded-lg border-2 border-dashed border-emerald-800 flex items-center justify-center text-[10px] text-emerald-700" style="aspect-ratio: 2 / 3;">捨て札</div>
      {/if}
    </div>
  </div>
  {#if items.includes('guidance') && wave.stock.length > 0}
    {@const nextCard = wave.stock[wave.stock.length - 1]}
    <div class="flex flex-col items-center justify-center" style="margin-top:20px;">
      <div class="text-[10px] text-emerald-300/70 mb-1">次の札</div>
      <CardFace card={nextCard} covered={false} {items} />
    </div>
  {/if}
  <div bind:this={chainAreaEl} class="overflow-x-auto min-w-0 {cleanupAnimation?.kind === 'chain' || chainCleanedUp || chainResetAnimation !== null || dealAnimationActive || chainAreaHiddenForRedistribute ? 'invisible' : ''}" style="transform: rotate({chainShuffleRotation}deg); transition-property: transform; transition-duration:{chainShuffleTransitionMs}ms;">
    {#if chainAreaExtra}
      {@render chainAreaExtra()}
    {:else}
      {#each chainRows as row, ri (ri)}
        <div class="relative" style="height:116px; width:{64 + (row.length - 1) * params.ui.chainCardOffsetX}px;">
          {#each row as entry, j (entry.card.id)}
            <div
              class="absolute rounded-lg {highlightedCardIds.has(entry.card.id) ? 'ring-4 ring-yellow-400' : ''}"
              data-chain-card-id={entry.card.id}
              style="left:{j * params.ui.chainCardOffsetX}px; top:{entry.origin === 'draw' ? 20 : 0}px; z-index:{j + 1}; width:64px;"
            >
              <CardFace card={entry.card} covered={false} {items} />
            </div>
          {/each}
        </div>
      {/each}
    {/if}
  </div>
  {#if extraFooter}
    {@render extraFooter()}
  {/if}
</div>

{#if rites.length > 0 || (confiscateFadingTarget?.kind === 'rite') || (pressPulseTarget?.kind === 'rite' && !rites.includes(pressPulseTarget.id))}
  {@const riteFading = confiscateFadingTarget?.kind === 'rite' ? confiscateFadingTarget : undefined}
  {@const ritePulseFading = pressPulseTarget?.kind === 'rite' && !rites.includes(pressPulseTarget.id) ? pressPulseTarget : undefined}
  {@const displayedRites = withFadingId(withFadingId(rites, riteFading?.id, riteFading?.idx ?? 0), ritePulseFading?.id, rites.length)}
  <div class="px-4 pb-4 flex items-center gap-2">
    {#each displayedRites as riteId, i (i)}
      {@const fading = riteFading !== undefined && i === riteFading.idx}
      {@const usable = !fading && canUseRite(params, wave, riteId) && !anyAnimationActive && !disableRites}
      {@const flashing = sealFlashTarget?.kind === 'rite' && sealFlashTarget.id === riteId}
      {@const pulsing = pressPulseTarget?.kind === 'rite' && pressPulseTarget.id === riteId}
      <button
        type="button"
        onclick={() => { startPressPulseAnimation({ kind: 'rite', id: riteId }); onUseRite?.(riteId) }}
        disabled={!usable}
        title={riteDesc(riteId, params)}
        style="font-family: 'ShidasuRunic', sans-serif;"
        class="w-10 h-10 rounded-lg border-2 flex items-center justify-center text-xl font-black transition-transform active:scale-95 {fading ? 'shidasu-confiscate-fade' : ''} {flashing ? 'shidasu-seal-flash' : ''} {pulsing ? 'shidasu-press-pulse' : ''} {usable ? 'bg-fuchsia-900 border-fuchsia-500 text-fuchsia-100 hover:bg-fuchsia-800' : 'bg-slate-800 border-slate-700 text-slate-600 cursor-not-allowed'}"
      >{params.rites[riteId].name}</button>
    {/each}
  </div>
{/if}

{#if revelations.length > 0 || (pressPulseTarget?.kind === 'revelationOrOracle' && pressPulseTarget.ref.kind === 'revelation' && !revelations.includes(pressPulseTarget.ref.id))}
  {@const revelationPulseFading = pressPulseTarget?.kind === 'revelationOrOracle' && pressPulseTarget.ref.kind === 'revelation' && !revelations.includes(pressPulseTarget.ref.id) ? pressPulseTarget.ref.id : undefined}
  {@const displayedRevelations = withFadingId(revelations, revelationPulseFading, revelations.length)}
  <div class="px-4 pb-4 flex items-center gap-2">
    {#each displayedRevelations as revelationId, i (i)}
      {@const usable = canUseRevelation(params, wave, revelationId, relics) && !anyAnimationActive}
      {@const flashing = sealFlashTarget?.kind === 'revelationOrOracle' && sealFlashTarget.ref.kind === 'revelation' && sealFlashTarget.ref.id === revelationId}
      {@const pulsing = pressPulseTarget?.kind === 'revelationOrOracle' && pressPulseTarget.ref.kind === 'revelation' && pressPulseTarget.ref.id === revelationId}
      <button
        type="button"
        onclick={() => { startPressPulseAnimation({ kind: 'revelationOrOracle', ref: { kind: 'revelation', id: revelationId } }); onUseRevelationClick?.(revelationId) }}
        disabled={!usable}
        title={revelationDesc(revelationId, params)}
        class="w-10 h-10 rounded-lg border-2 flex items-center justify-center text-lg font-black transition-transform active:scale-95 {flashing ? 'shidasu-seal-flash' : ''} {pulsing ? 'shidasu-press-pulse' : ''} {usable ? 'bg-indigo-900 border-indigo-500 text-indigo-100 hover:bg-indigo-800' : 'bg-slate-800 border-slate-700 text-slate-600 cursor-not-allowed'}"
      >{params.revelations[revelationId].name}</button>
    {/each}
  </div>
{/if}

{#if playingAnimation}
  <div
    class="fixed pointer-events-none z-[100] ease-out"
    style="left:{playingAnimation.left}px; top:{playingAnimation.top}px; width:64px; transition-property:left,top; transition-duration:{playingAnimation.transitionMs}ms;"
  >
    <CardFace card={playingAnimation.card} covered={false} {items} />
  </div>
{/if}

{#if scoreReveal && scoreReveal.flyPhase !== 'none'}
  <div
    class="fixed pointer-events-none z-[100] ease-out text-yellow-300 font-black text-lg"
    style="left:{scoreReveal.flyLeft}px; top:{scoreReveal.flyTop}px; transform: scale({scoreReveal.flyScale}); transition-property: left, top, transform; transition-duration:{scoreReveal.flyTransitionMs}ms;"
  >+{scoreReveal.totalGain}</div>
{/if}

{#if partFlyIn}
  <div
    class="fixed pointer-events-none z-[110] ease-out text-emerald-200 text-sm font-bold"
    style="left:{partFlyIn.left}px; top:{partFlyIn.top}px; transform: translate({partFlyIn.phase === 'center' ? '-50%' : '0%'}, -50%) scale({partFlyIn.scale}); transition-property: left, top, transform; transition-duration:{partFlyIn.transitionMs}ms;"
  >{partFlyIn.text}</div>
{/if}

{#if cleanupAnimation}
  {#if cleanupAnimation.gatherCards.length > 0}
    {#each cleanupAnimation.gatherCards as gatherCard (gatherCard.card.id)}
      <div
        class="fixed pointer-events-none z-[100] ease-out"
        style="left:{gatherCard.left}px; top:{gatherCard.top}px; width:64px; transform: translate(-50%, -50%); transition-property: left, top; transition-duration:{cleanupAnimation.transitionMs}ms;"
      >
        <CardFace card={gatherCard.card} covered={false} {items} />
      </div>
    {/each}
  {:else}
    <div
      class="fixed pointer-events-none z-[100] ease-out"
      style="left:{cleanupAnimation.left}px; top:{cleanupAnimation.top}px; width:64px; transform: translate(-50%, -50%); transition-property: left, top; transition-duration:{cleanupAnimation.transitionMs}ms;"
    >
      <CardFace card={cleanupAnimation.card} covered={false} {items} />
    </div>
  {/if}
{/if}

{#if chainResetAnimation}
  {#each chainResetAnimation.gatherCards as gatherCard (gatherCard.card.id)}
    <div
      class="fixed pointer-events-none z-[100] ease-out"
      style="left:{gatherCard.left}px; top:{gatherCard.top}px; width:64px; transform: translate(-50%, -50%); transition-property: left, top; transition-duration:{chainResetAnimation.transitionMs}ms;"
    >
      <CardFace card={gatherCard.card} covered={false} {items} />
    </div>
  {/each}
{/if}

{#if discardRedistributeAnimation}
  {#each discardRedistributeAnimation.gatherCards as gatherCard (gatherCard.card.id)}
    <div
      class="fixed pointer-events-none z-[100] ease-out"
      style="left:{gatherCard.left}px; top:{gatherCard.top}px; width:64px; transform: translate(-50%, -50%); transition-property: left, top; transition-duration:{discardRedistributeAnimation.transitionMs}ms;"
    >
      <CardFace card={gatherCard.card} covered={false} faceUp={false} {items} />
    </div>
  {/each}
{/if}

{#each discardRedistributeCards as moveCard (moveCard.card.id)}
  <div
    class="fixed pointer-events-none z-[100] ease-out"
    style="left:{moveCard.left}px; top:{moveCard.top}px; width:64px; transform: translate(-50%, -50%); transition-property: left, top; transition-duration:{moveCard.transitionMs}ms;"
  >
    <CardFace card={moveCard.card} covered={false} faceUp={false} {items} />
  </div>
{/each}

{#if sabotageRedistributeAnimation}
  {#each sabotageRedistributeAnimation.gatherCards as gatherCard, i (i)}
    <div
      class="fixed pointer-events-none z-[100] ease-out"
      style="left:{sabotageRedistributeAnimation.left}px; top:{sabotageRedistributeAnimation.top}px; width:64px; transform: translate(-50%, -50%); transition-property: left, top; transition-duration:{sabotageRedistributeAnimation.transitionMs}ms;"
    >
      <CardFace card={gatherCard.card} covered={false} faceUp={false} {items} />
    </div>
  {/each}
{/if}

{#each flippingCards as flippingCard (`${flippingCard.colIndex}-${flippingCard.rowIndex}`)}
  {@const cellEl = tableauEl?.querySelector(`[data-drop-col="${flippingCard.colIndex}"][data-drop-row="${flippingCard.rowIndex}"]`)}
  {@const cellRect = cellEl?.getBoundingClientRect()}
  {#if cellRect}
    <div
      class="fixed pointer-events-none z-[100] ease-out"
      style="left:{cellRect.left}px; top:{cellRect.top}px; width:{cellRect.width}px; transform: perspective(600px) rotateY({flippingCard.rotation}deg); transition-property: transform; transition-duration:{flippingCard.transitionMs}ms;"
    >
      <CardFace card={flippingCard.card} covered={false} faceUp={flippingCard.revealed} items={[]} />
    </div>
  {/if}
{/each}

{#each dealingCards as dealingCard (`${dealingCard.colIndex}-${dealingCard.rowIndex}`)}
  <div
    class="fixed pointer-events-none z-[100] ease-out"
    style="left:{dealingCard.left}px; top:{dealingCard.top}px; width:64px; transform: translate(-50%, -50%); transition-property: left, top; transition-duration:{dealingCard.transitionMs}ms;"
  >
    <CardFace card={dealingCard.card} covered={false} faceUp={dealingCard.faceUp} {items} />
  </div>
{/each}

{#each discardPurgeCards as purgeCard (purgeCard.card.id)}
  <div
    class="fixed pointer-events-none z-[100] ease-out"
    style="left:{purgeCard.left}px; top:{purgeCard.top}px; width:64px; transform: translate(-50%, -50%); transition-property: left, top; transition-duration:{purgeCard.transitionMs}ms;"
  >
    <CardFace card={purgeCard.card} covered={false} faceUp={false} items={[]} />
  </div>
{/each}

{#if discardFlip}
  {@const pileRect = discardPileEl?.getBoundingClientRect()}
  {#if pileRect}
    <div
      class="fixed pointer-events-none z-[100] ease-out"
      style="left:{pileRect.left}px; top:{pileRect.top}px; width:{pileRect.width}px; transform: perspective(600px) rotateY({discardFlip.rotation}deg); transition-property: transform; transition-duration:{discardFlip.transitionMs}ms;"
    >
      <CardFace card={discardFlip.card} covered={false} faceUp={discardFlip.revealed} items={[]} />
    </div>
  {/if}
{/if}
