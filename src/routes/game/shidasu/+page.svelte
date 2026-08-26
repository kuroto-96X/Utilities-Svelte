<script lang="ts">
  import { onDestroy } from 'svelte'
  import { loadParams } from '$lib/game/shidasu/params'
  import type { ShidasuParams } from '$lib/game/shidasu/params'
  import {
    createInitialRun, beginRun, applyPlayCard, applyDrawStock, applyStuckCheck,
    resolveWaveEnd, continueAfterGreatMisfortune, stopAfterGreatMisfortune, startWave, forceStockTop, useRite,
    useRevelation,
    SHOP_FLOW_PHASES, startRevelationPreview,
    waveTarget, stageModifierFor, isBossWave, skipWave, rerollStageStars, rerollShop, shopRerollCost,
    finishShop, buyIndividualItem, buyIndividualRite, buyIndividualRevelationUse, buyIndividualRevelationHold,
    buyIndividualOracleUse, buyIndividualOracleHold, buyPack, buyRelic,
    pickPackItem, confirmPackItemSwap, cancelPackItemSwap, closePackItemSelect,
    pickPackRite, confirmPackRiteSwap, cancelPackRiteSwap, closePackRiteSelect,
    pickPackCardSet, closePackCardSetSelect,
    pickPackRevelationUse, pickPackRevelationHold, confirmPackRevelationSwap, cancelPackRevelationSwap, closePackRevelationSelect,
    pickPackOracleUse, pickPackOracleHold, confirmPackOracleSwap, cancelPackOracleSwap, closePackOracleSelect,
    useOracle, sellItem, sellRite, sellRevelation, sellOracle, reorderItems,
    resolveSealedRoleEffect,
  } from '$lib/game/shidasu/engine'
  import { itemDesc, itemName } from '$lib/game/shidasu/items'
  import { ROLE_LIST } from '$lib/game/shidasu/roles'
  import { riteName, riteDesc } from '$lib/game/shidasu/rites'
  import { relicName, relicDesc, relicTsukumokaDesc, itemMaxCapacity, riteMaxCapacity, revelationOracleMaxCapacity } from '$lib/game/shidasu/relics'
  import { revelationDesc, revelationName } from '$lib/game/shidasu/revelations'
  import { revelationNeedsTarget, canUseRevelation } from '$lib/game/shidasu/revelationEffects'
  import { oracleName, oracleDesc } from '$lib/game/shidasu/oracles'
  import { standardDeckComposition } from '$lib/game/shidasu/deck'
  import {
    itemBuyPrice, itemSellPrice, riteBuyPrice, riteSellPrice, revelationBuyPrice, revelationSellPrice,
    oracleBuyPrice, oracleSellPrice, relicBuyPrice,
  } from '$lib/game/shidasu/shop'
  import type { RunState, ItemId, Suit, Rank, RiteId, RevelationId, RoleName, SpreadId, HeldRevelationOrOracleRef, PlayCardResult, Star, WaveState, CardSetGenreId, ShopSlotKind, RelicId, HeldItem } from '$lib/game/shidasu/types'
  import DebugPanel from './DebugPanel.svelte'
  import PlayArea from './PlayArea.svelte'
  import type { SealFlashTarget, ConfiscatedTarget, PressPulseTarget, NumericChangeTarget } from './PlayArea.svelte'
  import { withFadingId, numericChangePopupText } from './PlayArea.svelte'
  import RoleStatusPanel from './RoleStatusPanel.svelte'
  import CardFace from './CardFace.svelte'
  import { CARD_SET_GENRE_NAMES } from '$lib/game/shidasu/cardSets'
  import { sabotageActionName } from '$lib/game/shidasu/sabotage'

  const params = loadParams()

  // 星のrestrictionから、プレイヤー向けの効果説明文(1行)を返す。制限なしの場合は空文字。
  // descTemplateのプレースホルダー({maxCombo}等)は、restriction内の数値・文字列フィールドで
  // 展開する(revelations.tsのrevelationDescと同じ.replace(/\{(\w+)\}/g, ...)方式)。
  function starRestrictionDetail(star: Star): string {
    if (!star.restriction || !star.descTemplate) return ''
    const context: Record<string, string> = {}
    for (const [key, value] of Object.entries(star.restriction)) {
      if (key === 'kind') continue
      if (typeof value === 'number' || typeof value === 'string') context[key] = String(value)
    }
    return star.descTemplate.replace(/\{(\w+)\}/g, (match, key) => (key in context ? context[key] : match))
  }

  // itemDesc呼び出し用に、HeldItem.randomTarget(Rank | RoleName)をdescテンプレートの{randomTarget}に
  // 埋め込める形へ変換する。celebrationのrandomTargetはRoleNameなので、そのまま埋め込むと英語の役名
  // (例: 'flush')が表示されてしまうため、ROLE_LIST(roles.ts)のlabelで日本語に変換する。
  // prizeMoney等、RankをそのままRoleではない他の護符はrandomTargetがundefinedのまま(itemDesc側で無視される)。
  function heldItemRandomTargetLabel(held: HeldItem): number | string | undefined {
    if (held.randomTarget === undefined) return undefined
    if (held.id === 'celebration') {
      return ROLE_LIST.find(r => r.name === held.randomTarget)?.label ?? String(held.randomTarget)
    }
    return held.randomTarget
  }

  // 次に発動する妨害の名前+残りターン数を1行で返す。妨害が無い(pendingSabotageIdがnull)場合は空文字。
  function sabotageDetail(wave: WaveState | null): string {
    if (!wave || !wave.pendingSabotageId) return ''
    return `次の妨害: ${sabotageActionName(wave.pendingSabotageId, params)}(あと${wave.sabotageTurnsRemaining}ターン)`
  }

  // バラ売り枠の種類表示用ラベル(カードセットは福袋限定のためバラ売りには出現しない)
  const SHOP_SLOT_KIND_LABEL: Record<ShopSlotKind, string> = {
    item: '護符', rite: '秘儀', revelation: '天啓', oracle: '神託', cardSet: 'トランプセット',
  }

  // タイトル画面の高さをプレイ画面に揃えるための計測専用ダミーウェーブ(実際のゲームには使わない)
  const measurementWave = startWave(params, 0, 0, [], standardDeckComposition(), 1).wave
  let measuredPlayHeight = $state(0)

  let run = $state<RunState>(createInitialRun())
  let highlightedItemId = $state<ItemId | null>(null)

  // ショップ画面の「次のWaveへ」を押した後、ステージ画面を表示するかどうかのフラグ。
  // run.phaseとは独立したUI制御用のローカルstate。
  let showStageScreen = $state(false)

  let previousPhaseForStageScreen = run.phase
  $effect(() => {
    // title→shop遷移(handleStartWithSpreadでbeginRun直後にshowStageScreen=trueをセットする)
    // ではこのリセットを走らせない。title除外がないと、セット直後にこのeffectが
    // 「shopフェーズになった」と検知してshowStageScreenを即falseへ戻してしまい、
    // ステージ画面が一切表示されなくなる。
    if (run.phase === 'shop' && previousPhaseForStageScreen !== 'shop' && previousPhaseForStageScreen !== 'title') {
      showStageScreen = false
    }
    previousPhaseForStageScreen = run.phase
  })

  // ウェーブ終了系のタイマーは常にこの1本にまとめ、次の予約前に必ず前の分をキャンセルする
  // (手詰まりチェックと目標達成遅延を別々のタイマーで管理すると、片方が発火しないまま
  //  もう片方も発火してresolveWaveEndが二重に走り、アイテム選択肢が無言ですり替わるため)
  let pendingTimer: ReturnType<typeof setTimeout> | null = null

  function clearPendingTimer() {
    if (pendingTimer) clearTimeout(pendingTimer)
    pendingTimer = null
  }

  onDestroy(clearPendingTimer)

  let target = $derived(waveTarget(params, run.stageIndex, run.waveIndex, run.stageStars))
  let wave = $derived(run.wave)
  // RoleStatusPanel表示用: 現在の封印状態(役封印/天啓封印)から、役の実効レベルへの
  // 補正情報を導出する。triggerSabotage内部の同名処理と同じロジックをengine.tsから再利用。
  let sealedRoleEffect = $derived(resolveSealedRoleEffect(wave?.activeSeal ?? null))

  // PlayArea側で発動検知したsealFlashTarget(封印系妨害行動のフラッシュ演出対象)を
  // 受け取って保持する。itemBadges(護符バッジ)・RoleStatusPanel(役ステータス)は
  // PlayAreaの外側にあるため、コールバックprops経由で値を受け渡す。
  let sealFlashTarget = $state<SealFlashTarget | null>(null)

  // PlayArea側で発動検知したtalismanShuffleFlashActive(護符並び替え妨害行動の
  // 全護符バッジ一斉フラッシュ演出フラグ)を受け取って保持する。itemBadgesは
  // PlayAreaの外側にあるため、コールバックprops経由で値を受け渡す。
  let talismanShuffleFlashActive = $state(false)

  // PlayArea側で発動検知したconfiscateFadingTarget(没収系妨害行動のフェード演出対象)を
  // 受け取って保持する。itemBadges(護符・天啓・神託・レリックバッジ)はPlayAreaの外側に
  // あるため、コールバックprops経由で値を受け渡す。
  let confiscateFadingTarget = $state<ConfiscatedTarget | null>(null)

  // PlayArea側で発動検知したpressPulseTarget(強制発動系妨害行動・秘儀/天啓の通常クリック発動に
  // 共通のパルス演出対象)を受け取って保持する。神託「使」ボタンはPlayAreaの外側にあるため、
  // コールバックprops経由で値を受け渡す。神託の通常クリック発動時は、+page.svelte側で
  // 直接このstateを更新する(handleUseOracle参照)。
  let pressPulseTarget = $state<PressPulseTarget | null>(null)
  // handleUseOracleが積むクリア用タイマー。pendingTimer(ウェーブ終了系タイマー専用、他用途との
  // 混用禁止)とは別に管理し、コンポーネント破棄時にクリアする。
  let pressPulseTimer: ReturnType<typeof setTimeout> | null = null
  onDestroy(() => { if (pressPulseTimer) clearTimeout(pressPulseTimer) })

  // pressPulseTargetのkind絞り込みは、.some()のコールバック内(アロー関数のクロージャ)には
  // 伝播しないため、あらかじめプリミティブ値として取り出しておく
  // (PlayArea.svelteのpulseRiteInstanceId/pulseRevelationInstanceIdと同じ理由・同じパターン)。
  let oraclePulseInstanceId = $derived(pressPulseTarget?.kind === 'revelationOrOracle' && pressPulseTarget.ref.kind === 'oracle' ? pressPulseTarget.ref.instanceId : undefined)

  // PlayArea側で発動検知したnumericPopupTarget(数値変化系妨害行動のシェイク+ポップアップ
  // 演出対象)を受け取って保持する。通貨表示(stageRow)・RoleStatusPanel・レリックバッジは
  // PlayAreaの外側にあるため、コールバックprops経由で値を受け渡す。
  let numericPopupTarget = $state<NumericChangeTarget | null>(null)

  let flashingRoles = $derived.by((): RoleName[] => {
    if (sealFlashTarget?.kind === 'role') return sealFlashTarget.names
    if (sealFlashTarget?.kind === 'revelationOrOracle' && sealFlashTarget.ref.kind === 'oracle') return [sealFlashTarget.ref.id]
    return []
  })

  // 妨害行動「数値変化系」(roleLevelDecay・roleBias)発動時、RoleStatusPanelの対象役に
  // シェイク+ポップアップ演出を適用するための算出。役ごとに表示テキストが異なるため
  // (roleLevelDecayは全対象で「−1」固定、roleBiasは強化/減衰で「×2」/「×0.5」)、
  // 単純な役名配列ではなく{ name, text }の配列として渡す。
  let shakingRoles = $derived.by((): { name: RoleName; text: string }[] => {
    const popup = numericPopupTarget
    if (popup?.kind === 'roleLevel') {
      return popup.names.map(name => ({ name, text: numericChangePopupText(popup, name) }))
    }
    if (popup?.kind === 'roleBias') {
      return [...popup.buffed, ...popup.nerfed].map(name => ({ name, text: numericChangePopupText(popup, name) }))
    }
    return []
  })
  let currentModifier = $derived(stageModifierFor(params, run))

  // 現在Waveの星(制限ルール)の情報を返す。stageStarsが未確定(title等)の場合は空表示。
  let upcomingBossInfo = $derived.by(() => {
    const star = run.stageStars[run.waveIndex]
    if (!star) return { label: '', detail: '' }
    return { label: star.name, detail: starRestrictionDetail(star) }
  })

  function scheduleStuckCheck() {
    clearPendingTimer()
    pendingTimer = setTimeout(() => {
      pendingTimer = null
      const checked = applyStuckCheck(params, run)
      // 不屈の護符による復活はstatusが'playing'のまま(手詰まりだけ解消される)ため、
      // ここは必ず無条件でrunへ反映すること。「status==='ended'の時だけ反映」に戻すと、
      // 復活結果(捨て札→山札・スコア消費)が画面に一切反映されず実質操作不能になる。
      run = checked
      if (checked.wave?.status === 'ended') {
        run = resolveWaveEnd(params, checked)
      }
    }, 600)
  }

  function afterAction() {
    clearPendingTimer()
    if (run.wave?.status === 'ended') {
      if (run.wave.endReason === 'target') {
        // 片付けアニメーション完了(PlayArea側のonCleanupDone経由でhandleCleanupDoneが
        // 呼ばれるまで)を待ってからresolveWaveEndを呼ぶため、ここでは何もしない。
        return
      }
      pendingTimer = setTimeout(() => {
        pendingTimer = null
        run = resolveWaveEnd(params, run)
      }, 0)
      return
    }
    scheduleStuckCheck()
  }

  // PlayArea側の片付けアニメーション(場札・チェーン・捨て札を山札へ戻す演出)が
  // 完了した後に呼ばれる。endReason==='target'のときのafterAction()から委譲される。
  function handleCleanupDone() {
    run = resolveWaveEnd(params, run)
  }

  // 天啓プレビュー盤面の片付けアニメーション(PlayArea側のonCleanupDone経由)が
  // 完了した後に呼ばれる。resolveWaveEndは呼ばず、プレビューstateを破棄するだけで
  // ショップ画面表示に戻る(run自体は既にhandleTargetColumnで更新済み)。
  function handleRevelationPreviewCleanupDone() {
    revelationPreviewWave = null
  }

  const SPREAD_IDS: SpreadId[] = ['fool', 'moon']

  function handleStartWithSpread(spreadId: SpreadId) {
    run = beginRun(params, undefined, spreadId)
    showStageScreen = true
  }

  function handlePlayCard(colIndex: number, rowIndex: number): PlayCardResult | void {
    if (run.phase !== 'playing' || run.wave?.status !== 'playing') return
    run = applyPlayCard(params, run, colIndex, undefined, rowIndex)
    return { lastGain: run.wave?.lastGain ?? null }
  }

  // PlayArea側の得点内訳アニメーション(パーツ拡大→移動→SCOREへの飛び込み)が完了した後に
  // 呼ばれる。afterAction()をここに遅らせることで、Wave終了処理(画面遷移)が
  // アニメーション完了前に割り込むのを防ぐ。
  function handleScoreRevealDone() {
    afterAction()
  }

  function handleUseRite(instanceId: number, riteId: RiteId) {
    run = useRite(params, run, instanceId, riteId)
    if (run.phase === 'playing') afterAction()
  }

  // 天啓プレビュー盤面(revelationPreviewWave)に対してfnを適用する共通処理。run.waveを
  // 一時的にプレビューへすり替えてfnを呼び出し、結果からwave以外(deckComposition・
  // currency・shop・revelations等の永続的な変更)を本番runへ反映する。本番run.wave自体は
  // 変更しない(直前Waveのended状態のまま維持する)。呼び出し元は返り値(適用後のプレビュー
  // wave、効果が無効化された場合はnullになりうる)を見て、revelationPreviewWaveをどう
  // 更新するか(そのまま/終了扱い/破棄)を判断する。呼び出し元は事前にrevelationPreviewWaveが
  // 非nullであることを確認済みである前提で、ここでは改めてチェックしない。
  function applyToRevelationPreview(fn: (runForPreview: RunState) => RunState): WaveState | null {
    const runForPreview = { ...run, wave: revelationPreviewWave }
    const resultRun = fn(runForPreview)
    run = { ...resultRun, wave: run.wave }
    return resultRun.wave
  }

  function handleDraw() {
    if (run.phase !== 'playing' || run.wave?.status !== 'playing') return
    run = applyDrawStock(params, run)
    afterAction()
  }

  function handleContinueAfterGreatMisfortune() {
    // continueAfterGreatMisfortuneはphaseを'itemSelect'にするだけでrun.waveは
    // 大凶撃破時のまま(status:'ended')なので、afterAction()を呼ぶとresolveWaveEndが
    // 同じ「終了済みウェーブ」を再評価し、'continueChoice'へ巻き戻ってしまう
    // (ショップフェーズ中の操作がafterAction()を呼ばないのと同じ理由:
    //  waveの手詰まりチェック・終了判定はプレイ中フェーズのみが対象のため)。
    run = continueAfterGreatMisfortune(params, run)
  }

  function handleStopAfterGreatMisfortune() {
    run = stopAfterGreatMisfortune(run)
  }

  function handleBackToTitle() {
    run = createInitialRun()
  }

  function handleForceDraw(suit: Suit, rank: Rank, wild: boolean) {
    if (!run.wave) return
    run = { ...run, wave: forceStockTop(run.wave, suit, rank, wild) }
    handleDraw()
  }

  function handleSkipWave() {
    run = skipWave(params, run)
  }

  function handleRerollStageStars() {
    run = rerollStageStars(params, run)
  }

  function handleRerollShop() {
    run = rerollShop(params, run)
  }

  function handleProceedToWave() {
    run = finishShop(params, run)
    showStageScreen = false
  }

  const handleBuyIndividualItem = bindParamsRunAction(buyIndividualItem)
  const handleBuyIndividualRite = bindParamsRunAction(buyIndividualRite)
  const handleBuyRelic = bindParamsRunAction(buyRelic)
  const handleBuyIndividualRevelationHold = bindParamsRunAction(buyIndividualRevelationHold)
  const handleBuyIndividualOracleUse = bindParamsRunAction(buyIndividualOracleUse)
  const handleBuyIndividualOracleHold = bindParamsRunAction(buyIndividualOracleHold)

  function handleBuyPack(slotIndex: number) {
    run = buyPack(params, run, slotIndex)
    // 天啓福袋の場合、候補一覧を見せている段階から一貫してプレビュー盤面(配布アニメ付き)を
    // 使う。プレビューを開始しないと、候補の「使用」ボタンでターゲットが必要な天啓を選ぶまで
    // run.wave(直前Waveのended状態)がそのまま見えてしまい紛らわしいため。
    if (run.phase === 'revelationSelect') {
      beginRevelationPreview()
    }
  }

  // 「run = xxxFn(run, arg)」または「run = xxxFn(params, run, arg)」だけで完結する
  // (追加の副作用呼び出しが無い)ハンドラを生成する薄いファクトリ。天啓関連の一部ハンドラ
  // (syncRevelationPreviewWithPhase()の追加呼び出しや列選択判定を伴うもの)は対象外で、
  // 個別関数のまま残す。
  function bindRunAction<TArg>(fn: (run: RunState, arg: TArg) => RunState): (arg: TArg) => void {
    return (arg: TArg) => { run = fn(run, arg) }
  }
  function bindRunActionNoArg(fn: (run: RunState) => RunState): () => void {
    return () => { run = fn(run) }
  }
  function bindParamsRunAction<TArg>(fn: (params: ShidasuParams, run: RunState, arg: TArg) => RunState): (arg: TArg) => void {
    return (arg: TArg) => { run = fn(params, run, arg) }
  }

  const handlePickPackItem = bindParamsRunAction(pickPackItem)
  const handleConfirmPackItemSwap = bindParamsRunAction(confirmPackItemSwap)
  const handleCancelPackItemSwap = bindRunActionNoArg(cancelPackItemSwap)
  const handleClosePackItemSelect = bindRunActionNoArg(closePackItemSelect)

  const handlePickPackRite = bindParamsRunAction(pickPackRite)
  const handleConfirmPackRiteSwap = bindRunAction(confirmPackRiteSwap)
  const handleCancelPackRiteSwap = bindRunActionNoArg(cancelPackRiteSwap)
  const handleClosePackRiteSelect = bindRunActionNoArg(closePackRiteSelect)

  const handlePickPackCardSet = bindRunAction(pickPackCardSet)
  const handleClosePackCardSetSelect = bindRunActionNoArg(closePackCardSetSelect)

  // revelationSelectフェーズを離れた(=福袋での天啓選択が完了しshopへ戻った)場合、
  // handleBuyPackで開始したプレビューに片付けアニメーションを発火させる。完了後は
  // handleRevelationPreviewCleanupDone経由でnullになる(handleTargetColumnでの
  // コラム確定時と同じ経路)。まだrevelationSelectのまま(複数選択の途中)、または
  // 既にended状態(片付けアニメ発火済み)なら何もしない。
  function syncRevelationPreviewWithPhase() {
    if (run.phase !== 'revelationSelect' && revelationPreviewWave && revelationPreviewWave.status !== 'ended') {
      revelationPreviewWave = { ...revelationPreviewWave, status: 'ended', endReason: 'previewDismissed' }
    }
  }

  function handlePickPackRevelationHold(revelationId: RevelationId) {
    run = pickPackRevelationHold(params, run, revelationId)
    syncRevelationPreviewWithPhase()
  }
  function handleConfirmPackRevelationSwap(target: HeldRevelationOrOracleRef) {
    run = confirmPackRevelationSwap(run, target)
    syncRevelationPreviewWithPhase()
  }
  const handleCancelPackRevelationSwap = bindRunActionNoArg(cancelPackRevelationSwap)
  function handleClosePackRevelationSelect() {
    run = closePackRevelationSelect(run)
    syncRevelationPreviewWithPhase()
  }

  const handlePickPackOracleUse = bindRunAction(pickPackOracleUse)
  const handlePickPackOracleHold = bindParamsRunAction(pickPackOracleHold)
  const handleConfirmPackOracleSwap = bindRunAction(confirmPackOracleSwap)
  const handleCancelPackOracleSwap = bindRunActionNoArg(cancelPackOracleSwap)
  const handleClosePackOracleSelect = bindRunActionNoArg(closePackOracleSelect)

  function handleUseOracle(instanceId: number, roleName: RoleName) {
    if (pressPulseTimer) clearTimeout(pressPulseTimer)
    pressPulseTarget = { kind: 'revelationOrOracle', ref: { kind: 'oracle', instanceId, id: roleName } }
    pressPulseTimer = setTimeout(() => {
      pressPulseTimer = null
      pressPulseTarget = null
    }, 500)
    run = useOracle(params, run, roleName)
  }

  let draggingItemIndex = $state<number | null>(null)
  let dragPointerX = $state(0)
  let dragPointerY = $state(0)

  function handleItemPointerDown(index: number, e: PointerEvent) {
    draggingItemIndex = index
    dragPointerX = e.clientX
    dragPointerY = e.clientY
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  function handleItemPointerMove(e: PointerEvent) {
    if (draggingItemIndex === null) return
    dragPointerX = e.clientX
    dragPointerY = e.clientY

    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-item-index]')
    if (!el) return
    const targetIndex = Number(el.dataset.itemIndex)
    if (Number.isNaN(targetIndex) || targetIndex === draggingItemIndex) return

    run = reorderItems(run, draggingItemIndex, targetIndex)
    draggingItemIndex = targetIndex
  }

  function handleItemPointerUp() {
    draggingItemIndex = null
  }

  function handleSellItem(instanceId: number, itemId: ItemId) {
    run = sellItem(params, run, instanceId, itemId)
  }
  function handleSellRite(instanceId: number, riteId: RiteId) {
    run = sellRite(params, run, instanceId, riteId)
  }
  function handleSellRevelation(instanceId: number, revelationId: RevelationId) {
    run = sellRevelation(params, run, instanceId, revelationId)
  }
  function handleSellOracle(instanceId: number, roleName: RoleName) {
    run = sellOracle(params, run, instanceId, roleName)
  }

  // sourceが'individual'/'pack'(ショップでの購入・福袋の中身選択)はwaveの進行に関与しないため
  // afterAction()を呼ばない。'held'(保有天啓をプレイ中に使用)のみwave進行に影響するため必要。
  let pendingRevelationTarget = $state<
    | { revelationId: RevelationId; source: 'individual'; slotIndex: number }
    | { revelationId: RevelationId; source: 'pack' }
    | { revelationId: RevelationId; source: 'held'; instanceId: number }
    | null
  >(null)

  // 天啓「虚」使用時、付喪化させるレリックを選ぶオーバーレイの表示状態
  let pendingRelicTarget = $state<{ instanceId: number; revelationId: RevelationId } | null>(null)

  // ショップ系フェーズでの天啓ターゲット選択用の使い捨てプレビュー盤面。非nullの間、
  // pendingRevelationTargetのコラム選択はrun.waveではなくこちらを対象に行う。
  // playingフェーズ中の保有天啓使用(source: 'held')ではセットされない。
  let revelationPreviewWave = $state<WaveState | null>(null)
  let revelationPreviewSeq = 0
  let revelationPreviewWaveKey = $state('')

  function beginRevelationPreview() {
    revelationPreviewWave = startRevelationPreview(params, run)
    revelationPreviewWaveKey = `revelation-preview-${++revelationPreviewSeq}`
  }

  function handlePickPackRevelationUse(revelationId: RevelationId) {
    if (revelationNeedsTarget(revelationId)) {
      // pack(福袋)はhandleBuyPack時点で既にプレビューを開始済みなので、ここで
      // beginRevelationPreview()を呼び直さない。呼び直すと場札が再シャッフルされ、
      // 福袋を開いた時点でユーザーに見せていた盤面と食い違ってしまう。
      pendingRevelationTarget = { revelationId, source: 'pack' }
      return
    }
    if (revelationPreviewWave) {
      // ターゲット不要な天啓もプレビュー盤面に対して適用する。run.waveへ直接適用すると、
      // 本番の直前Wave(ended状態)のデータが意図せず書き換わり、その変化を本番PlayAreaが
      // 検知して片付けアニメーションが誤って再生されてしまう不具合があった。
      const previewResultWave = applyToRevelationPreview((runForPreview) =>
        pickPackRevelationUse(params, runForPreview, revelationId, null)
      )
      if (!previewResultWave) {
        revelationPreviewWave = null
      } else if (run.phase === 'revelationSelect') {
        revelationPreviewWave = previewResultWave
      } else {
        revelationPreviewWave = { ...previewResultWave, status: 'ended', endReason: 'previewDismissed' }
      }
      return
    }
    run = pickPackRevelationUse(params, run, revelationId, null)
    syncRevelationPreviewWithPhase()
  }

  function handleUseRevelationClick(instanceId: number, revelationId: RevelationId) {
    if (revelationId === 'kyo') {
      pendingRelicTarget = { instanceId, revelationId }
      return
    }
    if (revelationNeedsTarget(revelationId)) {
      pendingRevelationTarget = { revelationId, source: 'held', instanceId }
      // 既にプレビュー表示中(天啓福袋選択中)なら再生成しない。再生成すると場札が
      // 意図せず再シャッフルされ、ユーザーに見せていた盤面と食い違ってしまう
      // (福袋の「使用」ボタンで踏んだのと同種の問題)。
      if (SHOP_FLOW_PHASES.includes(run.phase) && !revelationPreviewWave) {
        beginRevelationPreview()
      }
      return
    }
    if (revelationPreviewWave) {
      // プレビュー表示中の即時適用天啓(コラム選択不要)は、プレビュー盤面に対して
      // 適用する。片付けアニメーションは発火させない(秘儀の即時使用と同様)。
      const previewResultWave = applyToRevelationPreview((runForPreview) =>
        useRevelation(params, runForPreview, instanceId, revelationId, null)
      )
      if (previewResultWave) {
        revelationPreviewWave = previewResultWave
      }
      return
    }
    run = useRevelation(params, run, instanceId, revelationId, null)
    if (run.phase === 'playing') afterAction()
  }

  function handleConfirmRelicTarget(relicId: RelicId) {
    if (!pendingRelicTarget) return
    const { instanceId, revelationId } = pendingRelicTarget
    pendingRelicTarget = null
    run = useRevelation(params, run, instanceId, revelationId, null, Math.random, relicId)
    if (run.phase === 'playing') afterAction()
  }

  function handleCancelRelicTarget() {
    pendingRelicTarget = null
  }

  function handleCancelRevelationTarget() {
    pendingRevelationTarget = null
    // キャンセル時は天啓効果を一切適用していないため、片付けアニメーションを経由せず
    // 即座にプレビューを破棄してよい(handleTargetColumnでの確定時のみ、適用結果を
    // 見せてから片付けアニメーション経由で破棄する)。
    revelationPreviewWave = null
  }

  function handleTargetColumn(colIndex: number) {
    if (!pendingRevelationTarget) return
    const target = pendingRevelationTarget
    pendingRevelationTarget = null

    if (revelationPreviewWave) {
      // プレビュー盤面に対して既存の天啓適用関数を流用する。run.waveを一時的に
      // プレビューへすり替えて呼び出し、結果からwave以外(deckComposition・currency・
      // shop・revelations等の永続的な変更)のみ本番runへ反映する。プレビューは使い捨て
      // であり、本番run.waveへ反映すると通常のショップ/プレイ画面にプレビュー内容が
      // 漏れてしまうため、wave自体は呼び出し前のrun.wave(直前Waveのended状態)のまま
      // 変更しない。
      const previewResultWave = applyToRevelationPreview((runForPreview) => {
        if (target.source === 'individual') {
          return buyIndividualRevelationUse(params, runForPreview, target.slotIndex, colIndex)
        }
        if (target.source === 'pack') {
          return pickPackRevelationUse(params, runForPreview, target.revelationId, colIndex)
        }
        return useRevelation(params, runForPreview, target.instanceId, target.revelationId, colIndex)
      })
      if (!previewResultWave) {
        revelationPreviewWave = null
      } else if (target.source === 'held' || run.phase === 'revelationSelect') {
        // 所持天啓の使用(held)は福袋選択そのものではないため、コラム確定してもプレビューは
        // 終了させない(即時反映のみ、秘儀・コラム不要天啓のプレビュー内使用と同様)。
        // 福袋選択(pack)は、選択後もofferPickRemainingが残っていればresolvePackRevelationPick
        // がphaseをrevelationSelectのまま維持する(=複数選択の途中)ため、この場合もプレビューを
        // 終了させない。選び終えてphaseがshopへ戻った場合のみ、次のelse節で終了させる。
        revelationPreviewWave = previewResultWave
      } else {
        revelationPreviewWave = { ...previewResultWave, status: 'ended', endReason: 'previewDismissed' }
      }
      return
    }

    if (target.source === 'individual') {
      run = buyIndividualRevelationUse(params, run, target.slotIndex, colIndex)
    } else if (target.source === 'pack') {
      run = pickPackRevelationUse(params, run, target.revelationId, colIndex)
    } else {
      run = useRevelation(params, run, target.instanceId, target.revelationId, colIndex)
      if (run.phase === 'playing') afterAction()
    }
  }

  function canTargetRevelationColumn(colIndex: number): boolean {
    const targetWave = revelationPreviewWave ?? wave
    if (!targetWave || !pendingRevelationTarget) return false
    if (pendingRevelationTarget.revelationId === 'aya') return true
    return targetWave.tableau[colIndex].length > 0
  }
</script>

{#snippet stageRow()}
  {@const currencyNumericPopup = numericPopupTarget?.kind === 'currency' ? numericPopupTarget : undefined}
  <div class="flex items-center justify-between text-xs">
    <span class="flex items-center gap-2">
      <span class="text-emerald-200/90 font-bold">{params.spreads[run.spreadId].name}</span>
      <span class="flex gap-1">
        {#each [0, 1, 2] as w (w)}
          <span class="w-2 h-2 rounded-full {w < run.waveIndex ? 'bg-yellow-400' : w === run.waveIndex ? 'bg-yellow-400 animate-pulse' : 'bg-emerald-800'}"></span>
        {/each}
      </span>
      <span class="relative text-yellow-300 font-bold {currencyNumericPopup ? 'shidasu-numeric-shake' : ''}">
        {params.currency.symbol}{run.currency}
        {#if currencyNumericPopup}<span class="shidasu-numeric-popup">{numericChangePopupText(currencyNumericPopup)}</span>{/if}
      </span>
    </span>
    {#if isBossWave(params, run.waveIndex)}
      <span class="flex flex-col items-end">
        <span class="font-black text-rose-400">{upcomingBossInfo.label}({upcomingBossInfo.detail})</span>
        {#if sabotageDetail(wave)}
          <span class="text-rose-300/80 text-[10px]">{sabotageDetail(wave)}</span>
        {/if}
      </span>
    {:else}
      <span class="text-emerald-300/80">次: {upcomingBossInfo.label}({upcomingBossInfo.detail})</span>
    {/if}
  </div>
{/snippet}

{#snippet itemBadges(anyAnimationActive: boolean)}
  {@const talismanFading = confiscateFadingTarget?.kind === 'talisman' ? { instanceId: -1, id: confiscateFadingTarget.id, idx: confiscateFadingTarget.idx } : undefined}
  {@const displayedItems = withFadingId(run.items, talismanFading, talismanFading?.idx ?? 0)}
  <div class="flex-1 flex flex-col gap-1 items-end">
    <div class="flex flex-wrap gap-1 justify-end">
      {#each displayedItems as h, i (i)}
        {@const itemId = h.id}
        {@const talismanHidden = wave?.activeSeal?.kind === 'talismanHidden'}
        {@const talismanSealed = wave?.activeSeal?.kind === 'talisman' && wave.activeSeal.instanceId === h.instanceId}
        {@const talismanFlashing = sealFlashTarget?.kind === 'talisman' && sealFlashTarget.instanceId === h.instanceId}
        {@const talismanShuffleFlashing = talismanShuffleFlashActive && talismanHidden}
        {@const talismanConfiscateFading = talismanFading !== undefined && i === talismanFading.idx}
        <span
          role="button"
          tabindex="0"
          data-item-index={i}
          onpointerdown={(e) => !anyAnimationActive && !talismanConfiscateFading && handleItemPointerDown(i, e)}
          onpointermove={handleItemPointerMove}
          onpointerup={handleItemPointerUp}
          onpointercancel={handleItemPointerUp}
          class="text-xs rounded px-1.5 py-0.5 touch-none select-none {anyAnimationActive || talismanConfiscateFading ? '' : 'cursor-grab'} {draggingItemIndex === i ? 'ring-2 ring-teal-400' : ''} {highlightedItemId === itemId ? 'ring-2 ring-yellow-400' : ''} {talismanConfiscateFading ? 'shidasu-confiscate-fade' : ''} {talismanFlashing || talismanShuffleFlashing ? 'shidasu-seal-flash' : ''} {talismanHidden || talismanSealed ? 'border' : 'bg-emerald-900 text-yellow-200/90 border border-yellow-600/40'}"
          style={talismanHidden || talismanSealed ? 'background:#1c1917; color:#78350f; border-color: rgba(217,119,6,0.5); background-image: repeating-linear-gradient(45deg,transparent,transparent 5px,rgba(217,119,6,0.35) 5px,rgba(217,119,6,0.35) 6px);' : ''}
          title={talismanHidden ? '護符並び替え: 次の妨害発動まで内容が見えない' : talismanSealed ? '護符封印: 次の妨害発動まで効果が無効' : itemDesc(itemId, params, heldItemRandomTargetLabel(h))}
        >
          {talismanHidden ? '？？？' : itemName(itemId, params)}
        </span>
      {/each}
    </div>
    {#if run.revelations.length > 0 || confiscateFadingTarget?.kind === 'revelationOrOracle' && confiscateFadingTarget.ref.kind === 'revelation'}
      {@const revelationOrOracleFading = confiscateFadingTarget?.kind === 'revelationOrOracle' ? confiscateFadingTarget : undefined}
      {@const revelationFading = revelationOrOracleFading?.ref.kind === 'revelation' ? { idx: revelationOrOracleFading.idx, instanceId: revelationOrOracleFading.ref.instanceId, id: revelationOrOracleFading.ref.id } : undefined}
      {@const displayedRevelations = withFadingId(run.revelations, revelationFading, revelationFading?.idx ?? 0)}
      <div class="flex flex-wrap gap-1 justify-end">
        {#each displayedRevelations as h, i (i)}
          {@const fading = revelationFading !== undefined && i === revelationFading.idx}
          <span class="text-xs bg-indigo-900 text-indigo-200/90 border border-indigo-600/40 rounded px-1.5 py-0.5 flex items-center gap-1 {fading ? 'shidasu-confiscate-fade' : ''}" title={revelationDesc(h.id, params)}>
            {revelationName(h.id, params)}
            <button onclick={() => handleSellRevelation(h.instanceId, h.id)} class="text-indigo-300/70 underline">売</button>
          </span>
        {/each}
      </div>
    {/if}
    {#if run.oracles.length > 0 || confiscateFadingTarget?.kind === 'revelationOrOracle' && confiscateFadingTarget.ref.kind === 'oracle' || pressPulseTarget?.kind === 'revelationOrOracle' && pressPulseTarget.ref.kind === 'oracle' && !run.oracles.some(h => h.instanceId === oraclePulseInstanceId)}
      {@const revelationOrOracleFading = confiscateFadingTarget?.kind === 'revelationOrOracle' ? confiscateFadingTarget : undefined}
      {@const oracleFading = revelationOrOracleFading?.ref.kind === 'oracle' ? { idx: revelationOrOracleFading.idx, instanceId: revelationOrOracleFading.ref.instanceId, id: revelationOrOracleFading.ref.id } : undefined}
      {@const oraclePulseFading = pressPulseTarget?.kind === 'revelationOrOracle' && pressPulseTarget.ref.kind === 'oracle' && !run.oracles.some(h => h.instanceId === oraclePulseInstanceId) ? { instanceId: pressPulseTarget.ref.instanceId, id: pressPulseTarget.ref.id } : undefined}
      {@const displayedOracles = withFadingId(withFadingId(run.oracles, oracleFading, oracleFading?.idx ?? 0), oraclePulseFading, run.oracles.length)}
      <div class="flex flex-wrap gap-1 justify-end">
        {#each displayedOracles as h, i (i)}
          {@const fading = oracleFading !== undefined && i === oracleFading.idx}
          {@const oraclePulsing = pressPulseTarget?.kind === 'revelationOrOracle' && pressPulseTarget.ref.kind === 'oracle' && pressPulseTarget.ref.instanceId === h.instanceId}
          <span class="text-xs bg-purple-900 text-purple-200/90 border border-purple-600/40 rounded px-1.5 py-0.5 flex items-center gap-1 {fading ? 'shidasu-confiscate-fade' : ''}" title={oracleDesc(h.id, params)}>
            {oracleName(h.id, params)}
            <button onclick={() => handleUseOracle(h.instanceId, h.id)} class="text-purple-300/70 underline {oraclePulsing ? 'shidasu-press-pulse' : ''}">使</button>
            <button onclick={() => handleSellOracle(h.instanceId, h.id)} class="text-purple-300/70 underline">売</button>
          </span>
        {/each}
      </div>
    {/if}
    {#if run.relics.length > 0 || confiscateFadingTarget?.kind === 'relic'}
      {@const relicFading = confiscateFadingTarget?.kind === 'relic' ? confiscateFadingTarget : undefined}
      {@const relicFadingPos = relicFading ? Math.min(relicFading.idx, run.relics.length) : -1}
      {@const displayedRelics = relicFading
        ? [...run.relics.slice(0, relicFadingPos), { id: relicFading.id, tsukumoka: false }, ...run.relics.slice(relicFadingPos)]
        : run.relics}
      <div class="flex flex-wrap gap-1 justify-end">
        {#each displayedRelics as relic, i (i)}
          {@const fading = relicFading !== undefined && i === relicFadingPos}
          {@const relicShaking = numericPopupTarget?.kind === 'tsukumoka' && numericPopupTarget.relicId === relic.id ? numericPopupTarget : undefined}
          <span class="relative text-xs bg-amber-900 text-amber-200/90 border border-amber-600/40 rounded px-1.5 py-0.5 {fading ? 'shidasu-confiscate-fade' : ''} {relicShaking ? 'shidasu-numeric-shake' : ''}" title={relic.tsukumoka ? relicTsukumokaDesc(relic.id, params) : relicDesc(relic.id, params)}>
            {relicName(relic.id, params)}{relic.tsukumoka ? ' ★' : ''}
            {#if relicShaking}<span class="shidasu-numeric-popup">{numericChangePopupText(relicShaking)}</span>{/if}
          </span>
        {/each}
      </div>
    {/if}
  </div>
{/snippet}

{#snippet revelationTargetPrompt()}
  <div class="text-xs w-full">
    <div class="text-yellow-300 font-black mb-2">列を選んでください</div>
    <button onclick={handleCancelRevelationTarget} class="text-emerald-300/70 underline">キャンセル</button>
  </div>
{/snippet}

{#snippet revelationSelectExtra()}
  {#if pendingRevelationTarget}
    {@render revelationTargetPrompt()}
  {:else if run.pendingNewRevelation}
    <div class="text-xs w-full">
      <div class="text-yellow-300 font-black mb-2">天啓・神託は合計2個まで。入れ替える対象を選んでください</div>
      <div class="flex flex-col gap-1.5">
        {#each run.revelations as h (h.instanceId)}
          <button onclick={() => handleConfirmPackRevelationSwap({ kind: 'revelation', instanceId: h.instanceId, id: h.id })} class="text-left bg-emerald-900/80 border border-yellow-500/40 rounded-lg px-2 py-1.5 text-emerald-100">{revelationName(h.id, params)}</button>
        {/each}
        {#each run.oracles as h (h.instanceId)}
          <button onclick={() => handleConfirmPackRevelationSwap({ kind: 'oracle', instanceId: h.instanceId, id: h.id })} class="text-left bg-emerald-900/80 border border-yellow-500/40 rounded-lg px-2 py-1.5 text-emerald-100">{oracleName(h.id, params)}</button>
        {/each}
      </div>
      <button onclick={handleCancelPackRevelationSwap} class="mt-2 text-emerald-300/70 underline">キャンセル</button>
    </div>
  {:else}
    <div class="text-xs w-full">
      <div class="text-emerald-300/70 mb-2">天啓福袋・残り{run.offerPickRemaining}個選べます</div>
      <div class="flex flex-col gap-1.5">
        {#each run.revelationOffer as id (id)}
          <div class="bg-emerald-900/80 border border-yellow-500/40 rounded-lg px-2 py-1.5 text-left">
            <div class="font-black text-yellow-300">{revelationName(id, params)}</div>
            <div class="text-emerald-100/80 text-[11px] mt-0.5">{revelationDesc(id, params)}</div>
            <div class="flex gap-1.5 mt-1.5">
              <button
                onclick={() => handlePickPackRevelationUse(id)}
                class="flex-1 bg-indigo-700 text-white rounded px-2 py-1 active:scale-95 transition-transform"
              >使用</button>
              <button
                onclick={() => handlePickPackRevelationHold(id)}
                disabled={run.revelations.length + run.oracles.length >= revelationOracleMaxCapacity(params, run)}
                class="flex-1 bg-slate-700 text-white rounded px-2 py-1 active:scale-95 transition-transform disabled:opacity-30 disabled:cursor-not-allowed"
              >温存</button>
            </div>
          </div>
        {/each}
      </div>
      <button onclick={handleClosePackRevelationSelect} class="mt-2 text-emerald-300/70 underline">選択を終える</button>
    </div>
  {/if}
{/snippet}

<div
  class="w-full flex flex-col bg-emerald-950 text-amber-50 mx-auto"
  style="user-select:none; max-width:480px; position:relative;"
>

{#if run.phase === 'title'}
  <!-- プレイ画面と同じ高さになるよう、画面外に隠して1度描画し実測する -->
  <div
    style="position:absolute; top:0; left:0; width:100%; visibility:hidden; pointer-events:none; z-index:-1;"
    aria-hidden="true"
    bind:offsetHeight={measuredPlayHeight}
  >
    <PlayArea wave={measurementWave} {params} modifier={currentModifier} {target} items={run.items.map(h => h.id)} onPlayCard={handlePlayCard} onDraw={handleDraw} headerExtra={stageRow} extraFooter={itemBadges} rites={run.rites} onUseRite={handleUseRite} />
  </div>
  <div class="flex flex-col items-center justify-center gap-6 text-center px-6" style="min-height:{measuredPlayHeight}px;">
    <div>
      <div class="text-xs tracking-widest text-emerald-300/70 mb-2">SOLITAIRE ROGUE</div>
      <h1 class="text-4xl font-black text-amber-50">星詠みソリティア -Shidasu-</h1>
      <p class="text-emerald-100/70 text-sm mt-3 leading-relaxed">
        ランクの±1を連鎖で取ってスコアを稼ぐ<br />
        同スート・同色(3枚以上)・階段(同方向<br />
        5枚以上)でボーナスが乗る。場札を<br />
        全消しすると大きく加点され、3ウェーブ<br />
        突破でステージクリア。
      </p>
    </div>
    <div class="flex flex-col gap-3 w-full max-w-xs">
      {#each SPREAD_IDS as spreadId (spreadId)}
        <button
          onclick={() => handleStartWithSpread(spreadId)}
          class="text-left bg-emerald-900/80 border border-yellow-500/40 rounded-xl px-4 py-3 active:scale-[0.98] transition-transform"
        >
          <div class="font-black text-yellow-300 text-lg">{params.spreads[spreadId].name}</div>
          <div class="text-xs text-emerald-100/80 mt-0.5">{params.spreads[spreadId].desc}</div>
        </button>
      {/each}
    </div>
  </div>

{:else if wave}
  <PlayArea
    {wave} {params} modifier={currentModifier} {target} items={run.items.map(h => h.id)}
    onPlayCard={handlePlayCard} onDraw={handleDraw}
    onScoreRevealDone={handleScoreRevealDone}
    onCleanupDone={handleCleanupDone}
    onSealFlashChange={(target) => { sealFlashTarget = target }}
    onConfiscateFadingChange={(target) => { confiscateFadingTarget = target }}
    onPressPulseChange={(target) => { pressPulseTarget = target }}
    onNumericPopupChange={(target) => { numericPopupTarget = target }}
    onTalismanShuffleFlashChange={(active) => { talismanShuffleFlashActive = active }}
    waveKey={`wave-${run.waveGeneration}`}
    headerExtra={stageRow} extraFooter={itemBadges}
    rites={run.rites} onUseRite={handleUseRite}
    revelations={run.revelations} onUseRevelationClick={handleUseRevelationClick}
    relics={run.relics}
    columnTargetMode={pendingRevelationTarget !== null}
    canTargetColumn={canTargetRevelationColumn}
    onTargetColumn={handleTargetColumn}
    chainAreaExtra={pendingRevelationTarget ? revelationTargetPrompt : undefined}
    onScorePartHighlight={id => (highlightedItemId = id)}
  />
  <RoleStatusPanel {params} oracleLevels={run.oracleLevels} {sealedRoleEffect} {flashingRoles} {shakingRoles} />
{/if}

{#if revelationPreviewWave}
  <!-- 本番PlayArea({:else if wave}側)を常にマウントしたまま、オーバーレイとして重ねる。
       {:else if}チェーンで切り替える形にすると、プレビュー表示中は本番PlayAreaがアンマウント
       され、プレビュー破棄時の再マウントでwaveKey監視の初回配布アニメーションが誤発火する
       (previousDealWaveKeyの初期値がundefinedのため、マウント直後は必ず発火する設計)。 -->
  <div class="fixed inset-0 z-50 bg-emerald-950 overflow-y-auto">
    <div class="w-full mx-auto" style="max-width:480px;">
      {#if pendingRevelationTarget}
        <div class="px-4 pt-3 pb-1 text-xs bg-indigo-950/80 border-b border-indigo-500/40">
          <div class="font-black text-yellow-300">{revelationName(pendingRevelationTarget.revelationId, params)}</div>
          <div class="text-emerald-100/80 mt-0.5">{revelationDesc(pendingRevelationTarget.revelationId, params)}</div>
        </div>
      {/if}
      <PlayArea
        wave={revelationPreviewWave} {params} modifier={currentModifier} target={0} items={run.items.map(h => h.id)}
        onPlayCard={() => {}} onDraw={() => {}}
        showScoreAndCombo={false} allowDraw={false}
        onCleanupDone={handleRevelationPreviewCleanupDone}
        waveKey={revelationPreviewWaveKey}
        headerExtra={stageRow}
        rites={run.rites} disableRites={true}
        revelations={run.revelations} onUseRevelationClick={handleUseRevelationClick}
        relics={run.relics}
        columnTargetMode={true}
        canTargetColumn={canTargetRevelationColumn}
        onTargetColumn={handleTargetColumn}
        chainAreaExtra={revelationSelectExtra}
      />
    </div>
  </div>
{/if}

{#if pendingRelicTarget}
  <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
    <div class="bg-slate-900 border border-slate-700 rounded-lg p-4 max-w-md w-full space-y-3">
      <p class="text-sm font-bold text-slate-200">付喪化させるレリックを選んでください</p>
      {#if run.relics.filter(r => !r.tsukumoka).length === 0}
        <p class="text-xs text-slate-400">付喪化できるレリックがありません。</p>
      {:else}
        <div class="flex flex-wrap gap-2">
          {#each run.relics.filter(r => !r.tsukumoka) as relic (relic.id)}
            <button
              type="button"
              onclick={() => handleConfirmRelicTarget(relic.id)}
              class="text-xs bg-amber-900 text-amber-200/90 border border-amber-600/40 rounded px-2 py-1 hover:bg-amber-800"
              title={relicDesc(relic.id, params)}
            >
              {relicName(relic.id, params)}
            </button>
          {/each}
        </div>
      {/if}
      <button
        type="button"
        onclick={handleCancelRelicTarget}
        class="text-xs px-3 py-1.5 rounded border border-slate-600 text-slate-300 hover:bg-slate-800"
      >
        キャンセル
      </button>
    </div>
  </div>
{/if}

{#if run.phase === 'shop' && run.shop && !pendingRevelationTarget && !revelationPreviewWave && !showStageScreen && !pendingRelicTarget}
  <div class="fixed inset-0 z-50 bg-emerald-950/90 backdrop-blur-sm flex items-center justify-center p-6">
    <div class="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-bold text-slate-800">ショップ</h2>
        <p class="text-sm text-teal-700 font-semibold">{params.currency.symbol}{run.currency}</p>
      </div>

      <button
        onclick={handleRerollShop}
        disabled={run.currency < shopRerollCost(params, run)}
        class="w-full px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
      >
        リロール({shopRerollCost(params, run)})
      </button>

      <div class="space-y-2">
        <p class="text-xs text-slate-500">バラ売り</p>
        <div class="grid grid-cols-3 gap-2">
          {#each run.shop.individual as slot, i}
            <div class="border border-slate-200 rounded-lg p-2 text-xs space-y-1">
              <p class="font-semibold text-slate-800">
                {#if slot.kind === 'item'}
                  {itemName(slot.id as ItemId, params)}
                {:else if slot.kind === 'rite'}
                  {riteName(slot.id as RiteId, params)}
                {:else if slot.kind === 'revelation'}
                  {revelationName(slot.id as RevelationId, params)}
                {:else if slot.kind === 'oracle'}
                  {oracleName(slot.id as RoleName, params)}
                {/if}
                <span class="text-[10px] text-slate-400">({SHOP_SLOT_KIND_LABEL[slot.kind]})</span>
              </p>
              <p class="text-[11px] text-slate-500">
                {#if slot.kind === 'item'}
                  {itemDesc(slot.id as ItemId, params)}
                {:else if slot.kind === 'rite'}
                  {riteDesc(slot.id as RiteId, params)}
                {:else if slot.kind === 'revelation'}
                  {revelationDesc(slot.id as RevelationId, params)}
                {:else if slot.kind === 'oracle'}
                  {oracleDesc(slot.id as RoleName, params)}
                {/if}
              </p>
              {#if slot.sold}
                <p class="text-slate-400">売り切れ</p>
              {:else if slot.kind === 'item'}
                <button onclick={() => handleBuyIndividualItem(i)} disabled={run.items.length >= itemMaxCapacity(params, run) || run.currency < itemBuyPrice(params, run, slot.id as ItemId)} class="w-full px-2 py-1 rounded bg-teal-600 text-white disabled:opacity-40 disabled:cursor-not-allowed">
                  購入({itemBuyPrice(params, run, slot.id as ItemId)})
                </button>
              {:else if slot.kind === 'rite'}
                <button onclick={() => handleBuyIndividualRite(i)} disabled={run.rites.length >= riteMaxCapacity(params, run) || run.currency < riteBuyPrice(params, run)} class="w-full px-2 py-1 rounded bg-teal-600 text-white disabled:opacity-40 disabled:cursor-not-allowed">
                  購入({riteBuyPrice(params, run)})
                </button>
              {:else if slot.kind === 'revelation'}
                <button onclick={() => handleBuyIndividualRevelationHold(i)} disabled={run.revelations.length + run.oracles.length >= revelationOracleMaxCapacity(params, run) || run.currency < revelationBuyPrice(params, run)} class="w-full px-2 py-1 rounded bg-slate-500 text-white disabled:opacity-40 disabled:cursor-not-allowed">
                  購入({revelationBuyPrice(params, run)})
                </button>
              {:else if slot.kind === 'oracle'}
                <button onclick={() => handleBuyIndividualOracleUse(i)} disabled={run.currency < oracleBuyPrice(params, run)} class="w-full px-2 py-1 rounded bg-teal-600 text-white disabled:opacity-40 disabled:cursor-not-allowed">
                  購入&使用({oracleBuyPrice(params, run)})
                </button>
                <button onclick={() => handleBuyIndividualOracleHold(i)} disabled={run.revelations.length + run.oracles.length >= revelationOracleMaxCapacity(params, run) || run.currency < oracleBuyPrice(params, run)} class="w-full px-2 py-1 rounded bg-slate-500 text-white disabled:opacity-40 disabled:cursor-not-allowed">
                  購入({oracleBuyPrice(params, run)})
                </button>
              {/if}
            </div>
          {/each}
        </div>
      </div>

      <div class="space-y-2">
        <p class="text-xs text-slate-500">福袋</p>
        <div class="grid grid-cols-2 gap-2">
          {#each run.shop.packs as slot, i}
            <div class="border border-slate-200 rounded-lg p-2 text-xs space-y-1">
              <p class="font-semibold text-slate-800">{slot.name}({slot.offerCount}択{slot.pickCount})</p>
              {#if slot.sold}
                <p class="text-slate-400">売り切れ</p>
              {:else}
                <button onclick={() => handleBuyPack(i)} disabled={run.currency < slot.price} class="w-full px-2 py-1 rounded bg-teal-600 text-white disabled:opacity-40 disabled:cursor-not-allowed">
                  購入({slot.price})
                </button>
              {/if}
            </div>
          {/each}
        </div>
      </div>

      {#if run.shop.relic && run.shop.relic.length > 0}
        <div class="space-y-2">
          <p class="text-xs text-slate-500">レリック</p>
          <div class="grid grid-cols-3 gap-2">
            {#each run.shop.relic as slot, i (i)}
              <div class="border border-slate-200 rounded-lg p-2 text-xs space-y-1">
                <p class="font-semibold text-slate-800">{relicName(slot.id, params)}</p>
                <p class="text-[11px] text-slate-500">{relicDesc(slot.id, params)}</p>
                {#if slot.sold}
                  <p class="text-slate-400">売り切れ</p>
                {:else}
                  <button onclick={() => handleBuyRelic(i)} disabled={run.currency < relicBuyPrice(params, run, slot.id)} class="w-full px-2 py-1 rounded bg-teal-600 text-white disabled:opacity-40 disabled:cursor-not-allowed">
                    購入({relicBuyPrice(params, run, slot.id)})
                  </button>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <div class="space-y-2">
        <p class="text-xs text-slate-500">所持護符(ドラッグで並べ替え・売却可)</p>
        <div class="flex flex-wrap gap-1">
          {#each run.items as h, i (h.instanceId)}
            {@const itemId = h.id}
            {@const talismanHidden = wave?.activeSeal?.kind === 'talismanHidden'}
            <div
              role="button"
              tabindex="0"
              data-item-index={i}
              title={talismanHidden ? '護符並び替え: 次の妨害発動まで内容が見えない' : itemDesc(itemId, params, heldItemRandomTargetLabel(h))}
              onpointerdown={(e) => handleItemPointerDown(i, e)}
              onpointermove={handleItemPointerMove}
              onpointerup={handleItemPointerUp}
              onpointercancel={handleItemPointerUp}
              class="flex items-center gap-1 text-xs px-2 py-1 rounded border touch-none select-none {talismanHidden ? '' : (draggingItemIndex === i ? 'border-teal-500 bg-teal-50 shadow-md text-slate-800' : 'border-slate-200 bg-white cursor-grab text-slate-800')}"
              style={talismanHidden ? 'background:#1c1917; color:#78350f; border-color: rgba(217,119,6,0.5); background-image: repeating-linear-gradient(45deg,transparent,transparent 5px,rgba(217,119,6,0.35) 5px,rgba(217,119,6,0.35) 6px);' : ''}
            >
              <span>{talismanHidden ? '？？？' : itemName(itemId, params)}</span>
              <button onpointerdown={(e) => e.stopPropagation()} onclick={() => handleSellItem(h.instanceId, itemId)} class="{talismanHidden ? '' : 'text-slate-400 hover:text-slate-700'}">売({talismanHidden ? '？' : itemSellPrice(params, run, itemId)})</button>
            </div>
          {/each}
        </div>
      </div>

      <div class="space-y-2">
        <p class="text-xs text-slate-500">その他の所持品(売却可)</p>
        <div class="flex flex-wrap gap-1">
          {#each run.rites as h (h.instanceId)}
            <button title={riteDesc(h.id, params)} onclick={() => handleUseRite(h.instanceId, h.id)} class="text-xs text-slate-800 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">{riteName(h.id, params)} 使用</button>
            <button title={riteDesc(h.id, params)} onclick={() => handleSellRite(h.instanceId, h.id)} class="text-xs text-slate-800 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">{riteName(h.id, params)} 売({riteSellPrice(params, run)})</button>
          {/each}
          {#each run.revelations as h (h.instanceId)}
            <button title={revelationDesc(h.id, params)} onclick={() => handleUseRevelationClick(h.instanceId, h.id)} class="text-xs text-slate-800 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">{revelationName(h.id, params)} 使用</button>
            <button title={revelationDesc(h.id, params)} onclick={() => handleSellRevelation(h.instanceId, h.id)} class="text-xs text-slate-800 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">{revelationName(h.id, params)} 売({revelationSellPrice(params, run)})</button>
          {/each}
          {#each run.oracles as h (h.instanceId)}
            <button title={oracleDesc(h.id, params)} onclick={() => handleSellOracle(h.instanceId, h.id)} class="text-xs text-slate-800 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">{oracleName(h.id, params)} 売({oracleSellPrice(params, run)})</button>
          {/each}
        </div>
      </div>

      {#if run.relics.length > 0}
        <div class="space-y-2">
          <p class="text-xs text-slate-500">所持レリック(売却不可)</p>
          <div class="flex flex-wrap gap-1">
            {#each run.relics as relic, i (i)}
              <span class="text-xs bg-amber-900 text-amber-200/90 border border-amber-600/40 rounded px-1.5 py-0.5" title={relic.tsukumoka ? relicTsukumokaDesc(relic.id, params) : relicDesc(relic.id, params)}>
                {relicName(relic.id, params)}{relic.tsukumoka ? ' ★' : ''}
              </span>
            {/each}
          </div>
        </div>
      {/if}

      <button onclick={() => { showStageScreen = true }} class="w-full px-4 py-2 rounded-lg bg-teal-700 text-white font-semibold">次のWaveへ</button>
    </div>
  </div>
{:else if run.phase === 'riteSelect'}
  <div class="fixed inset-0 z-50 bg-emerald-950/90 backdrop-blur-sm flex items-center justify-center p-6">
    <div class="bg-white rounded-2xl p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto space-y-3">
      <h2 class="text-lg font-bold text-slate-800">秘儀福袋(残り{run.offerPickRemaining}個選べます)</h2>
      {#if run.pendingNewRite}
        <p class="text-sm text-slate-600">所持枠が満杯です。入れ替える秘儀を選んでください。</p>
        <div class="space-y-1">
          {#each run.rites as h (h.instanceId)}
            <button onclick={() => handleConfirmPackRiteSwap(h.instanceId)} class="w-full text-left px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm">{h.id}</button>
          {/each}
        </div>
        <button onclick={handleCancelPackRiteSwap} class="text-xs text-slate-500 underline">キャンセル</button>
      {:else}
        <div class="space-y-1">
          {#each run.riteOffer as riteId}
            <button onclick={() => handlePickPackRite(riteId)} class="w-full text-left px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm">{riteId}</button>
          {/each}
        </div>
        <button onclick={handleClosePackRiteSelect} class="text-xs text-slate-500 underline">選択を終える</button>
      {/if}
    </div>
  </div>
{:else if run.phase === 'cardSetSelect'}
  <div class="fixed inset-0 z-50 bg-emerald-950/90 backdrop-blur-sm flex items-center justify-center p-6">
    <div class="bg-white rounded-2xl p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto space-y-3">
      <h2 class="text-lg font-bold text-slate-800">トランプセット福袋(残り{run.offerPickRemaining}個選べます)</h2>
      <div class="space-y-2">
        {#each run.cardSetOffer as offer (offer.genreId)}
          <button onclick={() => handlePickPackCardSet(offer.genreId)} class="w-full text-left px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm space-y-1">
            <div class="font-semibold text-slate-700">{CARD_SET_GENRE_NAMES[offer.genreId]}</div>
            <div class="flex flex-wrap gap-1">
              {#each offer.cards as c, i (i)}
                <div class="w-8">
                  <CardFace card={{ id: i, deckId: i, suit: c.suit, rank: c.rank, wild: c.wild }} covered={false} />
                </div>
              {/each}
            </div>
          </button>
        {/each}
      </div>
      <button onclick={handleClosePackCardSetSelect} class="text-xs text-slate-500 underline">選択を終える</button>
    </div>
  </div>
{:else if run.phase === 'itemSelect'}
  <div class="fixed inset-0 z-50 bg-emerald-950/90 backdrop-blur-sm flex items-center justify-center p-6">
    <div class="w-full max-w-sm flex flex-col items-center text-center">
      <div class="text-yellow-300 text-xs tracking-widest mb-1">護符福袋</div>
      <div class="text-emerald-100/70 text-sm mb-4">残り{run.offerPickRemaining}個選べます</div>
      {#if run.pendingNewItem === null}
        <div class="flex flex-col gap-3 w-full">
          {#each run.offer as id (id)}
            <button
              onclick={() => handlePickPackItem(id)}
              class="text-left bg-emerald-900/80 border border-yellow-500/40 rounded-xl px-4 py-3 active:scale-[0.98] transition-transform"
            >
              <div class="font-black text-yellow-300">{itemName(id, params)}</div>
              <div class="text-xs text-emerald-100/80 mt-0.5">{itemDesc(id, params)}</div>
            </button>
          {/each}
          <button
            onclick={handleClosePackItemSelect}
            class="text-center text-emerald-200/70 border border-emerald-700/60 rounded-xl px-4 py-2 active:scale-[0.98] transition-transform"
          >
            選択を終える
          </button>
        </div>
      {:else}
        <div class="text-emerald-100/70 text-sm mb-4">護符は最大{itemMaxCapacity(params, run)}個まで。入れ替える護符を選ぶ</div>
        <div class="flex flex-col gap-3 w-full">
          {#each run.items as h (h.instanceId)}
            <button
              onclick={() => handleConfirmPackItemSwap(h.instanceId)}
              class="text-left bg-emerald-900/80 border border-yellow-500/40 rounded-xl px-4 py-3 active:scale-[0.98] transition-transform"
            >
              <div class="font-black text-yellow-300">{itemName(h.id, params)}</div>
              <div class="text-xs text-emerald-100/80 mt-0.5">{itemDesc(h.id, params, heldItemRandomTargetLabel(h))}</div>
            </button>
          {/each}
          <button
            onclick={handleCancelPackItemSwap}
            class="text-center text-emerald-200/70 border border-emerald-700/60 rounded-xl px-4 py-2 active:scale-[0.98] transition-transform"
          >
            戻る
          </button>
        </div>
      {/if}
    </div>
  </div>
{:else if run.phase === 'oracleSelect'}
  <div class="fixed inset-0 z-50 bg-emerald-950/90 backdrop-blur-sm flex items-center justify-center p-6">
    <div class="w-full max-w-sm flex flex-col items-center text-center">
      <div class="text-yellow-300 text-xs tracking-widest mb-1">神託福袋</div>
      <div class="text-emerald-100/70 text-sm mb-4">残り{run.offerPickRemaining}個選べます</div>
      {#if run.pendingNewOracle}
        <div class="text-emerald-100/70 text-sm mb-4">天啓・神託は合計2個まで。入れ替える対象を選ぶ</div>
        <div class="flex flex-col gap-3 w-full">
          {#each run.revelations as h (h.instanceId)}
            <button
              onclick={() => handleConfirmPackOracleSwap({ kind: 'revelation', instanceId: h.instanceId, id: h.id })}
              class="text-left bg-emerald-900/80 border border-yellow-500/40 rounded-xl px-4 py-3 active:scale-[0.98] transition-transform"
            >{revelationName(h.id, params)}</button>
          {/each}
          {#each run.oracles as h (h.instanceId)}
            <button
              onclick={() => handleConfirmPackOracleSwap({ kind: 'oracle', instanceId: h.instanceId, id: h.id })}
              class="text-left bg-emerald-900/80 border border-yellow-500/40 rounded-xl px-4 py-3 active:scale-[0.98] transition-transform"
            >{oracleName(h.id, params)}</button>
          {/each}
          <button
            onclick={handleCancelPackOracleSwap}
            class="text-center text-emerald-200/70 border border-emerald-700/60 rounded-xl px-4 py-2 active:scale-[0.98] transition-transform"
          >
            戻る
          </button>
        </div>
      {:else}
        <div class="flex flex-col gap-3 w-full">
          {#each run.oracleOffer as roleName (roleName)}
            <div class="bg-emerald-900/80 border border-yellow-500/40 rounded-xl px-4 py-3 text-left">
              <div class="font-black text-yellow-300">{oracleName(roleName, params)}</div>
              <div class="text-xs text-emerald-100/80 mt-0.5">{oracleDesc(roleName, params)}</div>
              <div class="flex gap-2 mt-2">
                <button onclick={() => handlePickPackOracleUse(roleName)} class="flex-1 bg-indigo-700 text-white rounded px-2 py-1 active:scale-95 transition-transform">即使う</button>
                <button onclick={() => handlePickPackOracleHold(roleName)} disabled={run.revelations.length + run.oracles.length >= revelationOracleMaxCapacity(params, run)} class="flex-1 bg-slate-700 text-white rounded px-2 py-1 active:scale-95 transition-transform disabled:opacity-30 disabled:cursor-not-allowed">温存</button>
              </div>
            </div>
          {/each}
          <button
            onclick={handleClosePackOracleSelect}
            class="text-center text-emerald-200/70 border border-emerald-700/60 rounded-xl px-4 py-2 active:scale-[0.98] transition-transform"
          >
            選択を終える
          </button>
        </div>
      {/if}
    </div>
  </div>
{:else if run.phase === 'continueChoice'}
  <div class="fixed inset-0 z-50 bg-emerald-950/90 backdrop-blur-sm flex items-center justify-center p-6">
    <div class="w-full max-w-sm flex flex-col items-center text-center">
      <div class="text-yellow-300 text-xs tracking-widest mb-2">ステージ突破!</div>
      <div class="text-2xl font-black text-amber-50 mb-6">続けますか?</div>
      <div class="flex flex-col gap-3 w-full">
        <button onclick={handleContinueAfterGreatMisfortune} class="px-10 py-3 rounded-full bg-yellow-400 text-emerald-950 font-black active:scale-95 transition-transform">
          続ける
        </button>
        <button onclick={handleStopAfterGreatMisfortune} class="px-10 py-3 rounded-full border border-emerald-700/60 text-emerald-200/70 font-black active:scale-95 transition-transform">
          やめる
        </button>
      </div>
    </div>
  </div>
{:else if run.phase === 'allClear'}
  <div class="fixed inset-0 z-50 bg-emerald-950/90 backdrop-blur-sm flex items-center justify-center p-6">
    <div class="w-full max-w-sm flex flex-col items-center text-center">
      <div class="text-3xl font-black text-yellow-300 mb-2">結果</div>
      <div class="text-2xl font-black text-amber-50 mb-1">{run.wave?.score ?? 0} 点</div>
      <div class="text-emerald-100/80 text-sm mb-6">お疲れ様でした</div>
      <button onclick={handleBackToTitle} class="px-10 py-3 rounded-full bg-yellow-400 text-emerald-950 font-black active:scale-95">
        タイトルへ戻る
      </button>
    </div>
  </div>
{:else if run.phase === 'gameOver'}
  <div class="fixed inset-0 z-50 bg-emerald-950/90 backdrop-blur-sm flex items-center justify-center p-6">
    <div class="w-full max-w-sm flex flex-col items-center text-center">
      <div class="text-rose-400 text-xs tracking-widest mb-2">GAME OVER</div>
      <div class="text-2xl font-black text-amber-50 mb-1">{run.wave?.score ?? 0} / {target}</div>
      <div class="text-emerald-100/70 text-sm mb-6">目標スコアに届かなかった</div>
      <button onclick={handleBackToTitle} class="px-10 py-3 rounded-full bg-yellow-400 text-emerald-950 font-black active:scale-95">
        タイトルへ戻る
      </button>
    </div>
  </div>
{/if}

{#if run.phase === 'shop' && !pendingRevelationTarget && !revelationPreviewWave && showStageScreen}
  {@const baseTarget = Math.floor(params.flow.stageTargetBase * params.flow.stageTargetMultiplier ** run.stageIndex)}
  <div class="fixed inset-0 z-50 bg-emerald-950/90 backdrop-blur-sm flex items-center justify-center p-6">
    <div class="bg-white rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-bold text-slate-800">ステージ {run.stageIndex + 1}</h2>
        <p class="text-sm text-teal-700 font-semibold">{params.currency.symbol}{run.currency}</p>
      </div>
      <p class="text-xs text-slate-400">ベース目標点数 {baseTarget}</p>

      <div class="space-y-2">
        {#each run.stageStars as star, i (star.id)}
          {@const isCleared = i < run.waveIndex}
          {@const isNext = i === run.waveIndex}
          {@const isBoss = isBossWave(params, i)}
          {@const waveTargetValue = waveTarget(params, run.stageIndex, i, run.stageStars)}
          <div
            class="border-2 rounded-xl p-3 {isNext ? 'border-teal-500 bg-teal-50' : 'border-slate-200 bg-white'} {isCleared ? 'opacity-60' : ''}"
          >
            <div class="flex items-center justify-between">
              <div>
                <div class="text-[11px] {isNext ? 'text-teal-700 font-bold' : 'text-slate-400'}">
                  WAVE {i + 1}{#if isCleared}・クリア済み{:else if isNext && isBoss}・必須{:else if isNext}・NEXT{/if}
                </div>
                <div class="font-bold text-slate-800">{star.name}</div>
                <div class="text-[11px] text-slate-500 mt-0.5">{starRestrictionDetail(star) || '制限なし'}</div>
              </div>
              <div class="text-right text-[11px] text-slate-600">
                目標 {waveTargetValue}<br />報酬 +{star.reward}
              </div>
            </div>
            {#if isNext && !isBoss}
              <div class="flex gap-2 mt-2">
                <button onclick={handleSkipWave} class="flex-1 px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs">スキップ</button>
              </div>
            {:else if isBoss && !isCleared}
              <div class="flex gap-2 mt-2">
                <button
                  onclick={handleRerollStageStars}
                  disabled={run.currency < params.flow.rerollCost}
                  class="flex-1 px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  リロール({params.flow.rerollCost})
                </button>
              </div>
            {/if}
          </div>
        {/each}
      </div>

      <button onclick={handleProceedToWave} class="w-full px-4 py-2 rounded-lg bg-teal-600 text-white font-semibold">
        Wave{run.waveIndex + 1}へ進む
      </button>
    </div>
  </div>
{/if}

</div>

{#if import.meta.env.DEV && wave}
  <div class="w-full mx-auto" style="max-width:480px;">
    <DebugPanel {wave} onForceDraw={handleForceDraw} />
  </div>
{/if}
