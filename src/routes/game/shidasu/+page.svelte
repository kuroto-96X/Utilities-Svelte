<script lang="ts">
  import { onDestroy } from 'svelte'
  import { loadParams } from '$lib/game/shidasu/params'
  import {
    createInitialRun, beginRun, applyPlayCard, applyDrawStock, applyStuckCheck,
    resolveWaveEnd, pickItem, confirmItemSwap, cancelItemSwap, skipItemSelect,
    continueAfterGreatMisfortune, stopAfterGreatMisfortune, startWave, forceStockTop, useRite,
    useRevelation, useRevelationFromOffer, pickRevelationFromOffer, skipRevelationSelect,
    pickOracleFromOffer, skipOracleSelect,
    waveTarget, stageModifierFor, bossTierOf, isBossWave,
  } from '$lib/game/shidasu/engine'
  import { itemDesc, itemName } from '$lib/game/shidasu/items'
  import { revelationDesc, revelationName } from '$lib/game/shidasu/revelations'
  import { revelationNeedsTarget } from '$lib/game/shidasu/revelationEffects'
  import { oracleName, oracleDesc } from '$lib/game/shidasu/oracles'
  import { standardDeckComposition } from '$lib/game/shidasu/deck'
  import type { RunState, ItemId, Suit, Rank, RiteId, RevelationId, RoleName } from '$lib/game/shidasu/types'
  import DebugPanel from './DebugPanel.svelte'
  import PlayArea from './PlayArea.svelte'
  import RoleStatusPanel from './RoleStatusPanel.svelte'

  const params = loadParams()

  // タイトル画面の高さをプレイ画面に揃えるための計測専用ダミーウェーブ(実際のゲームには使わない)
  const measurementWave = startWave(params, 0, 0, [], standardDeckComposition(), 1).wave
  let measuredPlayHeight = $state(0)

  let run = $state<RunState>(createInitialRun())
  // ウェーブ終了系のタイマーは常にこの1本にまとめ、次の予約前に必ず前の分をキャンセルする
  // (手詰まりチェックと目標達成遅延を別々のタイマーで管理すると、片方が発火しないまま
  //  もう片方も発火してresolveWaveEndが二重に走り、アイテム選択肢が無言ですり替わるため)
  let pendingTimer: ReturnType<typeof setTimeout> | null = null

  function clearPendingTimer() {
    if (pendingTimer) clearTimeout(pendingTimer)
    pendingTimer = null
  }

  onDestroy(clearPendingTimer)

  let target = $derived(waveTarget(params, run.stageIndex, run.waveIndex))
  let wave = $derived(run.wave)
  let currentModifier = $derived(stageModifierFor(params, run))

  // 現在のステージのボス(小凶→中凶→大凶)の情報を返す。ステージ内の3ウェーブは
  // 常に同じボス階級を共有し、ボスウェーブ(3ウェーブ目)でのみ実際に制約が発動する
  // (どちらの表示にするかはstageRow側のisBossWave分岐が担い、ここでは扱わない)。
  let upcomingBossInfo = $derived.by(() => {
    const tier = bossTierOf(run.stageIndex)
    if (tier === 0) return { label: params.bossTiers.shoukyou.name, detail: 'A⇔Kループ禁止' }
    if (tier === 1) return { label: params.bossTiers.chuukyou.name, detail: `${params.bossTiers.chuukyou.maxCombo}コンボ以下で無得点` }
    return { label: params.bossTiers.taikyou.name, detail: run.currentGreatMisfortuneSuit ? `${run.currentGreatMisfortuneSuit}で無得点` : '対象スート未確定' }
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
      const delay = run.wave.endReason === 'target' ? params.flow.clearDelayMs : 0
      pendingTimer = setTimeout(() => {
        pendingTimer = null
        run = resolveWaveEnd(params, run)
      }, delay)
      return
    }
    scheduleStuckCheck()
  }

  function startGame() {
    run = beginRun(params)
    afterAction()
  }

  function handlePlayCard(colIndex: number) {
    if (run.phase !== 'playing' || run.wave?.status !== 'playing') return
    run = applyPlayCard(params, run, colIndex)
    afterAction()
  }

  function handleUseRite(riteId: RiteId) {
    if ((run.phase !== 'playing' && run.phase !== 'revelationSelect') || run.wave?.status !== 'playing') return
    run = useRite(params, run, riteId)
    afterAction()
  }

  function handleDraw() {
    if (run.phase !== 'playing' || run.wave?.status !== 'playing') return
    run = applyDrawStock(params, run)
    afterAction()
  }

  function handlePickItem(id: ItemId) {
    run = pickItem(params, run, id)
    if (run.phase === 'itemSelect') return // 上限到達時: 交換対象選択待ちのため、まだウェーブは進んでいない
    afterAction()
  }

  function handleSkipItem() {
    run = skipItemSelect(params, run)
    afterAction()
  }

  function handleConfirmSwap(oldItemId: ItemId) {
    run = confirmItemSwap(params, run, oldItemId)
    afterAction()
  }

  function handleCancelSwap() {
    run = cancelItemSwap(run)
  }

  function handleContinueAfterGreatMisfortune() {
    // continueAfterGreatMisfortuneはphaseを'itemSelect'にするだけでrun.waveは
    // 大凶撃破時のまま(status:'ended')なので、afterAction()を呼ぶとresolveWaveEndが
    // 同じ「終了済みウェーブ」を再評価し、'continueChoice'へ巻き戻ってしまう
    // (handlePickItemが上限到達時にafterAction()を呼ばないのと同じ理由)。
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

  let pendingRevelationTarget = $state<{ revelationId: RevelationId; source: 'offer' | 'held' } | null>(null)

  function revelationHandlerFor(source: 'offer' | 'held') {
    return (revelationId: RevelationId) => {
      if (revelationNeedsTarget(revelationId)) {
        pendingRevelationTarget = { revelationId, source }
        return
      }
      if (source === 'offer') {
        run = useRevelationFromOffer(params, run, revelationId, null)
        afterAction()
      } else {
        run = useRevelation(params, run, revelationId, null)
        if (run.phase === 'playing') afterAction()
      }
    }
  }

  const handleRevelationOfferUse = revelationHandlerFor('offer')
  const handleUseRevelationClick = revelationHandlerFor('held')

  function handleRevelationOfferAcquire(revelationId: RevelationId) {
    run = pickRevelationFromOffer(params, run, revelationId)
    afterAction()
  }

  function handleSkipRevelationSelect() {
    run = skipRevelationSelect(params, run)
    afterAction()
  }

  function handleCancelRevelationTarget() {
    pendingRevelationTarget = null
  }

  function handleTargetColumn(colIndex: number) {
    if (!pendingRevelationTarget) return
    const { revelationId, source } = pendingRevelationTarget
    pendingRevelationTarget = null
    if (source === 'offer') {
      run = useRevelationFromOffer(params, run, revelationId, colIndex)
      afterAction()
    } else {
      run = useRevelation(params, run, revelationId, colIndex)
      if (run.phase === 'playing') afterAction()
    }
  }

  function canTargetRevelationColumn(colIndex: number): boolean {
    if (!wave || !pendingRevelationTarget) return false
    if (pendingRevelationTarget.revelationId === 'aya') return true
    return wave.tableau[colIndex].length > 0
  }

  function handlePickOracle(roleName: RoleName) {
    run = pickOracleFromOffer(run, roleName)
    afterAction()
  }

  function handleSkipOracleSelect() {
    run = skipOracleSelect(run)
    afterAction()
  }
</script>

{#snippet stageRow()}
  <div class="flex items-center justify-between text-xs">
    <span class="flex gap-1">
      {#each [0, 1, 2] as w (w)}
        <span class="w-2 h-2 rounded-full {w < run.waveIndex ? 'bg-yellow-400' : w === run.waveIndex ? 'bg-yellow-400 animate-pulse' : 'bg-emerald-800'}"></span>
      {/each}
    </span>
    {#if isBossWave(params, run.waveIndex)}
      <span class="font-black text-rose-400">{upcomingBossInfo.label}({upcomingBossInfo.detail})</span>
    {:else}
      <span class="text-emerald-300/80">次: {upcomingBossInfo.label}({upcomingBossInfo.detail})</span>
    {/if}
  </div>
{/snippet}

{#snippet itemBadges()}
  <div class="flex-1 flex flex-wrap gap-1 justify-end">
    {#each [...new Set(run.items)] as id (id)}
      {@const n = run.items.filter(x => x === id).length}
      <span class="text-xs bg-emerald-900 text-yellow-200/90 border border-yellow-600/40 rounded px-1.5 py-0.5" title={itemDesc(id, params)}>
        {itemName(id, params)}{n > 1 ? `×${n}` : ''}
      </span>
    {/each}
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
  {:else}
    <div class="text-xs w-full">
      <div class="text-emerald-300/70 mb-2">天啓を1つ選ぶ</div>
      <div class="flex flex-col gap-1.5">
        {#each run.revelationOffer as id (id)}
          <div class="bg-emerald-900/80 border border-yellow-500/40 rounded-lg px-2 py-1.5 text-left">
            <div class="font-black text-yellow-300">{revelationName(id, params)}</div>
            <div class="text-emerald-100/80 text-[11px] mt-0.5">{revelationDesc(id, params)}</div>
            <div class="flex gap-1.5 mt-1.5">
              <button
                onclick={() => handleRevelationOfferUse(id)}
                class="flex-1 bg-indigo-700 text-white rounded px-2 py-1 active:scale-95 transition-transform"
              >使用</button>
              <button
                onclick={() => handleRevelationOfferAcquire(id)}
                disabled={run.revelations.length >= 2}
                class="flex-1 bg-slate-700 text-white rounded px-2 py-1 active:scale-95 transition-transform disabled:opacity-30 disabled:cursor-not-allowed"
              >獲得</button>
            </div>
          </div>
        {/each}
      </div>
      <button onclick={handleSkipRevelationSelect} class="mt-2 text-emerald-300/70 underline">使用・獲得しない</button>
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
    <button
      onclick={startGame}
      class="px-10 py-3 rounded-full bg-yellow-400 text-emerald-950 font-black text-lg active:scale-95 transition-transform"
    >
      はじめる
    </button>
  </div>

{:else if wave && run.phase === 'revelationSelect'}
  <PlayArea
    {wave} {params} modifier={currentModifier} {target} items={run.items}
    onPlayCard={() => {}} onDraw={() => {}}
    showScoreAndCombo={false} allowDraw={false}
    headerExtra={stageRow}
    rites={run.rites} onUseRite={handleUseRite}
    revelations={run.revelations} onUseRevelationClick={handleUseRevelationClick}
    columnTargetMode={pendingRevelationTarget !== null}
    canTargetColumn={canTargetRevelationColumn}
    onTargetColumn={handleTargetColumn}
    chainAreaExtra={revelationSelectExtra}
  />
{:else if wave}
  <PlayArea
    {wave} {params} modifier={currentModifier} {target} items={run.items}
    onPlayCard={handlePlayCard} onDraw={handleDraw}
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

{#if run.phase === 'itemSelect'}
  <div class="fixed inset-0 z-50 bg-emerald-950/90 backdrop-blur-sm flex items-center justify-center p-6">
    <div class="w-full max-w-sm flex flex-col items-center text-center">
      <div class="text-yellow-300 text-xs tracking-widest mb-1">WAVE {run.waveIndex + 1} CLEAR</div>
      <div class="text-2xl font-black text-amber-50 mb-4">{run.wave?.score ?? 0} 点</div>
      {#if run.pendingNewItem === null}
        <div class="text-emerald-100/70 text-sm mb-4">アイテムを1つ選ぶ</div>
        <div class="flex flex-col gap-3 w-full">
          {#each run.offer as id (id)}
            <button
              onclick={() => handlePickItem(id)}
              class="text-left bg-emerald-900/80 border border-yellow-500/40 rounded-xl px-4 py-3 active:scale-[0.98] transition-transform"
            >
              <div class="font-black text-yellow-300">{itemName(id, params)}</div>
              <div class="text-xs text-emerald-100/80 mt-0.5">{itemDesc(id, params)}</div>
            </button>
          {/each}
          <button
            onclick={handleSkipItem}
            class="text-center text-emerald-200/70 border border-emerald-700/60 rounded-xl px-4 py-2 active:scale-[0.98] transition-transform"
          >
            取得しない
          </button>
        </div>
      {:else}
        <div class="text-emerald-100/70 text-sm mb-4">護符は最大{params.items.maxItems}個まで。入れ替える護符を選ぶ</div>
        <div class="flex flex-col gap-3 w-full">
          {#each run.items as id, i (i)}
            <button
              onclick={() => handleConfirmSwap(id)}
              class="text-left bg-emerald-900/80 border border-yellow-500/40 rounded-xl px-4 py-3 active:scale-[0.98] transition-transform"
            >
              <div class="font-black text-yellow-300">{itemName(id, params)}</div>
              <div class="text-xs text-emerald-100/80 mt-0.5">{itemDesc(id, params)}</div>
            </button>
          {/each}
          <button
            onclick={handleCancelSwap}
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
      <div class="text-yellow-300 text-xs tracking-widest mb-1">ORACLE</div>
      <div class="text-emerald-100/70 text-sm mb-4">神託を1つ選ぶ</div>
      <div class="flex flex-col gap-3 w-full">
        {#each run.oracleOffer as roleName (roleName)}
          <button
            onclick={() => handlePickOracle(roleName)}
            class="text-left bg-emerald-900/80 border border-yellow-500/40 rounded-xl px-4 py-3 active:scale-[0.98] transition-transform"
          >
            <div class="font-black text-yellow-300">{oracleName(roleName, params)}</div>
            <div class="text-xs text-emerald-100/80 mt-0.5">{oracleDesc(roleName, params)}</div>
          </button>
        {/each}
        <button
          onclick={handleSkipOracleSelect}
          class="text-center text-emerald-200/70 border border-emerald-700/60 rounded-xl px-4 py-2 active:scale-[0.98] transition-transform"
        >
          選ばない
        </button>
      </div>
    </div>
  </div>
{:else if run.phase === 'continueChoice'}
  <div class="fixed inset-0 z-50 bg-emerald-950/90 backdrop-blur-sm flex items-center justify-center p-6">
    <div class="w-full max-w-sm flex flex-col items-center text-center">
      <div class="text-yellow-300 text-xs tracking-widest mb-2">{params.bossTiers.taikyou.name} 撃破!</div>
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

</div>

{#if import.meta.env.DEV && wave}
  <div class="w-full mx-auto" style="max-width:480px;">
    <DebugPanel {wave} onForceDraw={handleForceDraw} />
  </div>
{/if}
