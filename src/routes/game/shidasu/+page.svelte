<script lang="ts">
  import { onDestroy } from 'svelte'
  import { loadParams } from '$lib/game/shidasu/params'
  import {
    createInitialRun, beginRun, applyPlayCard, applyDrawStock, applyStuckCheck,
    resolveWaveEnd, continueAfterGreatMisfortune, stopAfterGreatMisfortune, startWave, forceStockTop, useRite,
    useRevelation,
    SHOP_FLOW_PHASES, startRevelationPreview,
    waveTarget, stageModifierFor, isBossWave, skipWave, rerollStageStars,
    finishShop, buyIndividualItem, buyIndividualRite, buyIndividualRevelationUse, buyIndividualRevelationHold,
    buyIndividualOracleUse, buyIndividualOracleHold, buyPack,
    pickPackItem, confirmPackItemSwap, cancelPackItemSwap, closePackItemSelect,
    pickPackRite, confirmPackRiteSwap, cancelPackRiteSwap, closePackRiteSelect,
    pickPackRevelationUse, pickPackRevelationHold, confirmPackRevelationSwap, cancelPackRevelationSwap, closePackRevelationSelect,
    pickPackOracleUse, pickPackOracleHold, confirmPackOracleSwap, cancelPackOracleSwap, closePackOracleSelect,
    useOracle, sellItem, sellRite, sellRevelation, sellOracle,
  } from '$lib/game/shidasu/engine'
  import { itemDesc, itemName } from '$lib/game/shidasu/items'
  import { riteName, riteDesc } from '$lib/game/shidasu/rites'
  import { revelationDesc, revelationName } from '$lib/game/shidasu/revelations'
  import { revelationNeedsTarget, canUseRevelation } from '$lib/game/shidasu/revelationEffects'
  import { oracleName, oracleDesc } from '$lib/game/shidasu/oracles'
  import { standardDeckComposition } from '$lib/game/shidasu/deck'
  import {
    itemBuyPrice, itemSellPrice, riteBuyPrice, riteSellPrice, revelationBuyPrice, revelationSellPrice,
    oracleBuyPrice, oracleSellPrice, packPrice,
  } from '$lib/game/shidasu/shop'
  import type { RunState, ItemId, Suit, Rank, RiteId, RevelationId, RoleName, SpreadId, HeldRevelationOrOracleRef, ShopSlotKind, PlayCardResult, Star, WaveState } from '$lib/game/shidasu/types'
  import DebugPanel from './DebugPanel.svelte'
  import PlayArea from './PlayArea.svelte'
  import RoleStatusPanel from './RoleStatusPanel.svelte'

  const params = loadParams()

  // 星のrestrictionから、プレイヤー向けの効果説明文(1行)を返す。制限なしの場合は空文字。
  function starRestrictionDetail(star: Star): string {
    if (!star.restriction) return ''
    switch (star.restriction.kind) {
      case 'suit': return `${star.restriction.suit}で無得点`
      case 'noLoop': return 'A⇔Kループ禁止'
      case 'faceLock': return '絵札はコンボ2以上でのみ取得可'
      case 'lowCombo': return `${star.restriction.maxCombo}コンボ以下で無得点`
      case 'oddCombo': return 'コンボが奇数のとき無得点'
      case 'face': return '絵札(J・Q・K)で無得点'
    }
  }

  const SHOP_SLOT_KIND_LABEL: Record<ShopSlotKind, string> = {
    item: '護符', rite: '秘儀', revelation: '天啓', oracle: '神託',
  }

  // タイトル画面の高さをプレイ画面に揃えるための計測専用ダミーウェーブ(実際のゲームには使わない)
  const measurementWave = startWave(params, 0, 0, [], standardDeckComposition(), 1).wave
  let measuredPlayHeight = $state(0)

  let run = $state<RunState>(createInitialRun())

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
    return { lastGain: run.wave?.lastGain ?? null, lastBonusGains: run.wave?.lastBonusGains ?? [] }
  }

  // PlayArea側の得点内訳アニメーション(パーツ拡大→移動→SCOREへの飛び込み)が完了した後に
  // 呼ばれる。afterAction()をここに遅らせることで、Wave終了処理(画面遷移)が
  // アニメーション完了前に割り込むのを防ぐ。
  function handleScoreRevealDone() {
    afterAction()
  }

  function handleUseRite(riteId: RiteId) {
    run = useRite(params, run, riteId)
    if (run.phase === 'playing') afterAction()
  }

  // 天啓プレビュー表示中、所持秘儀を使用した際に呼ぶ。run.waveを一時的にプレビューへ
  // すり替えてuseRiteを適用し、結果のwaveをプレビューへ反映する(秘儀は即時適用でコラム
  // 選択が無いため、片付けアニメーションは発火させない)。本番runにはwave以外の変更
  // (秘儀の所持数減少)のみ反映する。revelationPreviewWaveがnullの間は何もしない。
  function handleUseRiteInPreview(riteId: RiteId) {
    if (!revelationPreviewWave) return
    const runForPreview = { ...run, wave: revelationPreviewWave }
    const resultRun = useRite(params, runForPreview, riteId)
    const previewResultWave = resultRun.wave
    run = { ...resultRun, wave: run.wave }
    if (previewResultWave) {
      revelationPreviewWave = previewResultWave
    }
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

  function handleProceedToWave() {
    run = finishShop(params, run)
    showStageScreen = false
  }

  function handleBuyIndividualItem(slotIndex: number) {
    run = buyIndividualItem(params, run, slotIndex)
  }

  function handleBuyIndividualRite(slotIndex: number) {
    run = buyIndividualRite(params, run, slotIndex)
  }

  function handleBuyIndividualRevelationHold(slotIndex: number) {
    run = buyIndividualRevelationHold(params, run, slotIndex)
  }

  function handleBuyIndividualOracleUse(slotIndex: number) {
    run = buyIndividualOracleUse(params, run, slotIndex)
  }

  function handleBuyIndividualOracleHold(slotIndex: number) {
    run = buyIndividualOracleHold(params, run, slotIndex)
  }

  function handleBuyPack(slotIndex: number) {
    run = buyPack(params, run, slotIndex)
    // 天啓福袋の場合、候補一覧を見せている段階から一貫してプレビュー盤面(配布アニメ付き)を
    // 使う。プレビューを開始しないと、候補の「使用」ボタンでターゲットが必要な天啓を選ぶまで
    // run.wave(直前Waveのended状態)がそのまま見えてしまい紛らわしいため。
    if (run.phase === 'revelationSelect') {
      beginRevelationPreview()
    }
  }

  function handlePickPackItem(itemId: ItemId) {
    run = pickPackItem(params, run, itemId)
  }
  function handleConfirmPackItemSwap(oldItemId: ItemId) {
    run = confirmPackItemSwap(run, oldItemId)
  }
  function handleCancelPackItemSwap() {
    run = cancelPackItemSwap(run)
  }
  function handleClosePackItemSelect() {
    run = closePackItemSelect(run)
  }

  function handlePickPackRite(riteId: RiteId) {
    run = pickPackRite(run, riteId)
  }
  function handleConfirmPackRiteSwap(oldRiteId: RiteId) {
    run = confirmPackRiteSwap(run, oldRiteId)
  }
  function handleCancelPackRiteSwap() {
    run = cancelPackRiteSwap(run)
  }
  function handleClosePackRiteSelect() {
    run = closePackRiteSelect(run)
  }

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
    run = pickPackRevelationHold(run, revelationId)
    syncRevelationPreviewWithPhase()
  }
  function handleConfirmPackRevelationSwap(target: HeldRevelationOrOracleRef) {
    run = confirmPackRevelationSwap(run, target)
    syncRevelationPreviewWithPhase()
  }
  function handleCancelPackRevelationSwap() {
    run = cancelPackRevelationSwap(run)
  }
  function handleClosePackRevelationSelect() {
    run = closePackRevelationSelect(run)
    syncRevelationPreviewWithPhase()
  }

  function handlePickPackOracleUse(roleName: RoleName) {
    run = pickPackOracleUse(run, roleName)
  }
  function handlePickPackOracleHold(roleName: RoleName) {
    run = pickPackOracleHold(run, roleName)
  }
  function handleConfirmPackOracleSwap(target: HeldRevelationOrOracleRef) {
    run = confirmPackOracleSwap(run, target)
  }
  function handleCancelPackOracleSwap() {
    run = cancelPackOracleSwap(run)
  }
  function handleClosePackOracleSelect() {
    run = closePackOracleSelect(run)
  }

  function handleUseOracle(roleName: RoleName) {
    run = useOracle(run, roleName)
  }

  function handleSellItem(itemId: ItemId) {
    run = sellItem(params, run, itemId)
  }
  function handleSellRite(riteId: RiteId) {
    run = sellRite(params, run, riteId)
  }
  function handleSellRevelation(revelationId: RevelationId) {
    run = sellRevelation(params, run, revelationId)
  }
  function handleSellOracle(roleName: RoleName) {
    run = sellOracle(params, run, roleName)
  }

  // sourceが'individual'/'pack'(ショップでの購入・福袋の中身選択)はwaveの進行に関与しないため
  // afterAction()を呼ばない。'held'(保有天啓をプレイ中に使用)のみwave進行に影響するため必要。
  let pendingRevelationTarget = $state<
    | { revelationId: RevelationId; source: 'individual'; slotIndex: number }
    | { revelationId: RevelationId; source: 'pack' }
    | { revelationId: RevelationId; source: 'held' }
    | null
  >(null)

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
    run = pickPackRevelationUse(params, run, revelationId, null)
    syncRevelationPreviewWithPhase()
  }

  function handleUseRevelationClick(revelationId: RevelationId) {
    if (revelationNeedsTarget(revelationId)) {
      pendingRevelationTarget = { revelationId, source: 'held' }
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
      const runForPreview = { ...run, wave: revelationPreviewWave }
      const resultRun = useRevelation(params, runForPreview, revelationId, null)
      const previewResultWave = resultRun.wave
      run = { ...resultRun, wave: run.wave }
      if (previewResultWave) {
        revelationPreviewWave = previewResultWave
      }
      return
    }
    run = useRevelation(params, run, revelationId, null)
    if (run.phase === 'playing') afterAction()
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
      const runForPreview = { ...run, wave: revelationPreviewWave }
      let resultRun: RunState
      if (target.source === 'individual') {
        resultRun = buyIndividualRevelationUse(params, runForPreview, target.slotIndex, colIndex)
      } else if (target.source === 'pack') {
        resultRun = pickPackRevelationUse(params, runForPreview, target.revelationId, colIndex)
      } else {
        resultRun = useRevelation(params, runForPreview, target.revelationId, colIndex)
      }
      const previewResultWave = resultRun.wave
      run = { ...resultRun, wave: run.wave }
      revelationPreviewWave = previewResultWave
        ? { ...previewResultWave, status: 'ended', endReason: 'previewDismissed' }
        : null
      return
    }

    if (target.source === 'individual') {
      run = buyIndividualRevelationUse(params, run, target.slotIndex, colIndex)
    } else if (target.source === 'pack') {
      run = pickPackRevelationUse(params, run, target.revelationId, colIndex)
    } else {
      run = useRevelation(params, run, target.revelationId, colIndex)
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
  <div class="flex items-center justify-between text-xs">
    <span class="flex items-center gap-2">
      <span class="text-emerald-200/90 font-bold">{params.spreads[run.spreadId].name}</span>
      <span class="flex gap-1">
        {#each [0, 1, 2] as w (w)}
          <span class="w-2 h-2 rounded-full {w < run.waveIndex ? 'bg-yellow-400' : w === run.waveIndex ? 'bg-yellow-400 animate-pulse' : 'bg-emerald-800'}"></span>
        {/each}
      </span>
      <span class="text-yellow-300 font-bold">{params.currency.symbol}{run.currency}</span>
    </span>
    {#if isBossWave(params, run.waveIndex)}
      <span class="font-black text-rose-400">{upcomingBossInfo.label}({upcomingBossInfo.detail})</span>
    {:else}
      <span class="text-emerald-300/80">次: {upcomingBossInfo.label}({upcomingBossInfo.detail})</span>
    {/if}
  </div>
{/snippet}

{#snippet itemBadges()}
  <div class="flex-1 flex flex-col gap-1 items-end">
    <div class="flex flex-wrap gap-1 justify-end">
      {#each [...new Set(run.items)] as id (id)}
        {@const n = run.items.filter(x => x === id).length}
        <span class="text-xs bg-emerald-900 text-yellow-200/90 border border-yellow-600/40 rounded px-1.5 py-0.5" title={itemDesc(id, params)}>
          {itemName(id, params)}{n > 1 ? `×${n}` : ''}
        </span>
      {/each}
    </div>
    {#if run.revelations.length > 0}
      <div class="flex flex-wrap gap-1 justify-end">
        {#each run.revelations as id, i (i)}
          <span class="text-xs bg-indigo-900 text-indigo-200/90 border border-indigo-600/40 rounded px-1.5 py-0.5 flex items-center gap-1" title={revelationDesc(id, params)}>
            {revelationName(id, params)}
            <button onclick={() => handleSellRevelation(id)} class="text-indigo-300/70 underline">売</button>
          </span>
        {/each}
      </div>
    {/if}
    {#if run.oracles.length > 0}
      <div class="flex flex-wrap gap-1 justify-end">
        {#each run.oracles as roleName, i (i)}
          <span class="text-xs bg-purple-900 text-purple-200/90 border border-purple-600/40 rounded px-1.5 py-0.5 flex items-center gap-1" title={oracleDesc(roleName, params)}>
            {oracleName(roleName, params)}
            <button onclick={() => handleUseOracle(roleName)} class="text-purple-300/70 underline">使</button>
            <button onclick={() => handleSellOracle(roleName)} class="text-purple-300/70 underline">売</button>
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
        {#each run.revelations as id (id)}
          <button onclick={() => handleConfirmPackRevelationSwap({ kind: 'revelation', id })} class="text-left bg-emerald-900/80 border border-yellow-500/40 rounded-lg px-2 py-1.5 text-emerald-100">{revelationName(id, params)}</button>
        {/each}
        {#each run.oracles as roleName (roleName)}
          <button onclick={() => handleConfirmPackRevelationSwap({ kind: 'oracle', id: roleName })} class="text-left bg-emerald-900/80 border border-yellow-500/40 rounded-lg px-2 py-1.5 text-emerald-100">{oracleName(roleName, params)}</button>
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
                disabled={run.revelations.length + run.oracles.length >= 2}
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
    <PlayArea wave={measurementWave} {params} modifier={currentModifier} {target} items={run.items} onPlayCard={handlePlayCard} onDraw={handleDraw} headerExtra={stageRow} extraFooter={itemBadges} rites={run.rites} onUseRite={handleUseRite} />
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
    {wave} {params} modifier={currentModifier} {target} items={run.items}
    onPlayCard={handlePlayCard} onDraw={handleDraw}
    onScoreRevealDone={handleScoreRevealDone}
    onCleanupDone={handleCleanupDone}
    waveKey={`wave-${run.waveGeneration}`}
    headerExtra={stageRow} extraFooter={itemBadges}
    rites={run.rites} onUseRite={handleUseRite}
    revelations={run.revelations} onUseRevelationClick={handleUseRevelationClick}
    columnTargetMode={pendingRevelationTarget !== null}
    canTargetColumn={canTargetRevelationColumn}
    onTargetColumn={handleTargetColumn}
    chainAreaExtra={pendingRevelationTarget ? revelationTargetPrompt : undefined}
  />
  <RoleStatusPanel {params} oracleLevels={run.oracleLevels} />
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
        wave={revelationPreviewWave} {params} modifier={currentModifier} target={0} items={run.items}
        onPlayCard={() => {}} onDraw={() => {}}
        showScoreAndCombo={false} allowDraw={false}
        onCleanupDone={handleRevelationPreviewCleanupDone}
        waveKey={revelationPreviewWaveKey}
        headerExtra={stageRow}
        rites={run.rites} onUseRite={handleUseRiteInPreview}
        revelations={run.revelations} onUseRevelationClick={handleUseRevelationClick}
        columnTargetMode={true}
        canTargetColumn={canTargetRevelationColumn}
        onTargetColumn={handleTargetColumn}
        chainAreaExtra={revelationSelectExtra}
      />
    </div>
  </div>
{/if}

{#if run.phase === 'shop' && run.shop && !pendingRevelationTarget && !revelationPreviewWave && !showStageScreen}
  <div class="fixed inset-0 z-50 bg-emerald-950/90 backdrop-blur-sm flex items-center justify-center p-6">
    <div class="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-bold text-slate-800">ショップ</h2>
        <p class="text-sm text-teal-700 font-semibold">{params.currency.symbol}{run.currency}</p>
      </div>

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
                <button onclick={() => handleBuyIndividualItem(i)} disabled={run.items.length >= params.items.maxItems || run.currency < itemBuyPrice(params, slot.id as ItemId)} class="w-full px-2 py-1 rounded bg-teal-600 text-white disabled:opacity-40 disabled:cursor-not-allowed">
                  購入({itemBuyPrice(params, slot.id as ItemId)})
                </button>
              {:else if slot.kind === 'rite'}
                <button onclick={() => handleBuyIndividualRite(i)} disabled={run.rites.length >= 3 || run.currency < riteBuyPrice(params)} class="w-full px-2 py-1 rounded bg-teal-600 text-white disabled:opacity-40 disabled:cursor-not-allowed">
                  購入({riteBuyPrice(params)})
                </button>
              {:else if slot.kind === 'revelation'}
                <button onclick={() => handleBuyIndividualRevelationHold(i)} disabled={run.revelations.length + run.oracles.length >= 2 || run.currency < revelationBuyPrice(params)} class="w-full px-2 py-1 rounded bg-slate-500 text-white disabled:opacity-40 disabled:cursor-not-allowed">
                  購入({revelationBuyPrice(params)})
                </button>
              {:else if slot.kind === 'oracle'}
                <button onclick={() => handleBuyIndividualOracleUse(i)} disabled={run.currency < oracleBuyPrice(params)} class="w-full px-2 py-1 rounded bg-teal-600 text-white disabled:opacity-40 disabled:cursor-not-allowed">
                  購入&使用({oracleBuyPrice(params)})
                </button>
                <button onclick={() => handleBuyIndividualOracleHold(i)} disabled={run.revelations.length + run.oracles.length >= 2 || run.currency < oracleBuyPrice(params)} class="w-full px-2 py-1 rounded bg-slate-500 text-white disabled:opacity-40 disabled:cursor-not-allowed">
                  購入({oracleBuyPrice(params)})
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
              <p class="font-semibold text-slate-800">{SHOP_SLOT_KIND_LABEL[slot.packKind]}福袋 {slot.offerCount}択{slot.pickCount}</p>
              {#if slot.sold}
                <p class="text-slate-400">売り切れ</p>
              {:else}
                <button onclick={() => handleBuyPack(i)} disabled={run.currency < packPrice(params, slot.packKind, slot.offerCount)} class="w-full px-2 py-1 rounded bg-teal-600 text-white disabled:opacity-40 disabled:cursor-not-allowed">
                  購入({packPrice(params, slot.packKind, slot.offerCount)})
                </button>
              {/if}
            </div>
          {/each}
        </div>
      </div>

      <div class="space-y-2">
        <p class="text-xs text-slate-500">所持品(売却可)</p>
        <div class="flex flex-wrap gap-1">
          {#each run.items as itemId}
            <button onclick={() => handleSellItem(itemId)} class="text-xs text-slate-800 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">{itemName(itemId, params)} 売({itemSellPrice(params, itemId)})</button>
          {/each}
          {#each run.rites as riteId}
            <button onclick={() => handleUseRite(riteId)} class="text-xs text-slate-800 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">{riteName(riteId, params)} 使用</button>
            <button onclick={() => handleSellRite(riteId)} class="text-xs text-slate-800 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">{riteName(riteId, params)} 売({riteSellPrice(params)})</button>
          {/each}
          {#each run.revelations as revelationId}
            <button onclick={() => handleUseRevelationClick(revelationId)} class="text-xs text-slate-800 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">{revelationName(revelationId, params)} 使用</button>
            <button onclick={() => handleSellRevelation(revelationId)} class="text-xs text-slate-800 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">{revelationName(revelationId, params)} 売({revelationSellPrice(params)})</button>
          {/each}
          {#each run.oracles as roleName}
            <button onclick={() => handleSellOracle(roleName)} class="text-xs text-slate-800 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">{oracleName(roleName, params)} 売({oracleSellPrice(params)})</button>
          {/each}
        </div>
      </div>

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
          {#each run.rites as riteId}
            <button onclick={() => handleConfirmPackRiteSwap(riteId)} class="w-full text-left px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm">{riteId}</button>
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
        <div class="text-emerald-100/70 text-sm mb-4">護符は最大{params.items.maxItems}個まで。入れ替える護符を選ぶ</div>
        <div class="flex flex-col gap-3 w-full">
          {#each run.items as id, i (i)}
            <button
              onclick={() => handleConfirmPackItemSwap(id)}
              class="text-left bg-emerald-900/80 border border-yellow-500/40 rounded-xl px-4 py-3 active:scale-[0.98] transition-transform"
            >
              <div class="font-black text-yellow-300">{itemName(id, params)}</div>
              <div class="text-xs text-emerald-100/80 mt-0.5">{itemDesc(id, params)}</div>
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
          {#each run.revelations as id (id)}
            <button
              onclick={() => handleConfirmPackOracleSwap({ kind: 'revelation', id })}
              class="text-left bg-emerald-900/80 border border-yellow-500/40 rounded-xl px-4 py-3 active:scale-[0.98] transition-transform"
            >{revelationName(id, params)}</button>
          {/each}
          {#each run.oracles as roleName (roleName)}
            <button
              onclick={() => handleConfirmPackOracleSwap({ kind: 'oracle', id: roleName })}
              class="text-left bg-emerald-900/80 border border-yellow-500/40 rounded-xl px-4 py-3 active:scale-[0.98] transition-transform"
            >{oracleName(roleName, params)}</button>
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
                <button onclick={() => handlePickPackOracleHold(roleName)} disabled={run.revelations.length + run.oracles.length >= 2} class="flex-1 bg-slate-700 text-white rounded px-2 py-1 active:scale-95 transition-transform disabled:opacity-30 disabled:cursor-not-allowed">温存</button>
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
