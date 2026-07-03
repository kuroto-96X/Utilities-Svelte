<script lang="ts">
  import { onMount, tick } from 'svelte'
  import { easyWords, hardSentences, pickQuestions } from '$lib/game/flick-typing/words'
  import { getBest, saveBest, type Difficulty } from '$lib/game/flick-typing/score'

  type Phase = 'start' | 'game' | 'result'

  // ---- スタート設定 ----
  let difficulty = $state<Difficulty>('easy')
  let count = $state<5 | 10 | 20>(10)

  // ---- ゲーム状態 ----
  let phase = $state<Phase>('start')
  let questions = $state<string[]>([])
  let currentIndex = $state(0)
  let inputValue = $state('')
  let isComposing = $state(false)
  let startTimeMs = $state<number | null>(null)
  let elapsedMs = $state(0)
  let timerHandle = $state<ReturnType<typeof setInterval> | null>(null)
  let inputEl = $state<HTMLInputElement | null>(null)

  // ---- リザルト ----
  let finalTimeMs = $state(0)
  let isNewRecord = $state(false)
  let prevBestMs = $state<number | null>(null)

  // ---- 派生値 ----
  let currentQuestion = $derived(questions[currentIndex] ?? '')
  let best = $derived(getBest(difficulty, count))

  const difficultyOptions: { value: Difficulty; label: string; sub: string }[] = [
    { value: 'easy', label: 'かんたん', sub: '単語' },
    { value: 'hard', label: 'むずかしい', sub: '文章' },
  ]

  function formatTime(ms: number): string {
    const cs = Math.floor(ms / 10)
    const centiseconds = cs % 100
    const totalSeconds = Math.floor(cs / 100)
    const seconds = totalSeconds % 60
    const minutes = Math.floor(totalSeconds / 60)
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`
  }

  function startGame() {
    const pool = difficulty === 'easy' ? easyWords : hardSentences
    questions = pickQuestions(pool, count)
    currentIndex = 0
    inputValue = ''
    isComposing = false
    startTimeMs = null
    elapsedMs = 0
    if (timerHandle) clearInterval(timerHandle)
    timerHandle = null
    phase = 'game'
    tick().then(() => inputEl?.focus())
  }

  function checkAnswer() {
    if (inputValue.trim() !== currentQuestion) return

    if (currentIndex === questions.length - 1) {
      const now = Date.now()
      finalTimeMs = startTimeMs ? now - startTimeMs : 0
      if (timerHandle) clearInterval(timerHandle)
      timerHandle = null
      prevBestMs = getBest(difficulty, count)
      isNewRecord = saveBest(difficulty, count, finalTimeMs)
      phase = 'result'
    } else {
      currentIndex++
      inputValue = ''
      tick().then(() => inputEl?.focus())
    }
  }

  function handleInput() {
    if (startTimeMs === null && inputValue.length > 0) {
      startTimeMs = Date.now()
      timerHandle = setInterval(() => {
        elapsedMs = Date.now() - (startTimeMs ?? Date.now())
      }, 10)
    }
    if (!isComposing) checkAnswer()
  }

  function handleCompositionStart() {
    isComposing = true
  }

  function handleCompositionEnd() {
    isComposing = false
    checkAnswer()
  }

  function restart() {
    startGame()
  }

  function backToStart() {
    if (timerHandle) clearInterval(timerHandle)
    timerHandle = null
    phase = 'start'
  }

  onMount(() => {
    return () => {
      if (timerHandle) clearInterval(timerHandle)
    }
  })
</script>

<svelte:head>
  <title>フリックタイピング</title>
</svelte:head>

{#if phase === 'start'}
  <div class="max-w-sm mx-auto px-4 py-8 flex flex-col gap-6">
    <h1 class="text-2xl font-bold text-teal-700 text-center">⌨️ フリックタイピング</h1>

    <div class="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
      <p class="text-xs font-bold uppercase tracking-wider text-slate-400">難易度</p>
      <div class="flex gap-2">
        {#each difficultyOptions as opt (opt.value)}
          <button
            type="button"
            class="flex-1 rounded-lg py-2 text-sm font-semibold transition-colors border"
            class:bg-teal-700={difficulty === opt.value}
            class:text-white={difficulty === opt.value}
            class:border-teal-700={difficulty === opt.value}
            class:bg-white={difficulty !== opt.value}
            class:text-slate-600={difficulty !== opt.value}
            class:border-slate-200={difficulty !== opt.value}
            onclick={() => { difficulty = opt.value }}
          >
            {opt.label}<br /><span class="text-xs font-normal opacity-70">{opt.sub}</span>
          </button>
        {/each}
      </div>
    </div>

    <div class="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
      <p class="text-xs font-bold uppercase tracking-wider text-slate-400">問題数</p>
      <div class="flex gap-2">
        {#each [5, 10, 20] as n (n)}
          <button
            type="button"
            class="flex-1 rounded-lg py-2 text-sm font-semibold transition-colors border"
            class:bg-teal-700={count === n}
            class:text-white={count === n}
            class:border-teal-700={count === n}
            class:bg-white={count !== n}
            class:text-slate-600={count !== n}
            class:border-slate-200={count !== n}
            onclick={() => { count = n as 5 | 10 | 20 }}
          >
            {n}問
          </button>
        {/each}
      </div>
    </div>

    <p class="text-center text-sm text-slate-500">
      🏆 自己ベスト: {best !== null ? formatTime(best) : '—'}
    </p>

    <button
      type="button"
      class="bg-teal-700 text-white rounded-xl py-4 text-lg font-bold transition-opacity hover:opacity-90 active:opacity-80"
      onclick={startGame}
    >
      スタート
    </button>
  </div>

{:else if phase === 'game'}
  <div class="max-w-sm mx-auto px-4 py-6 flex flex-col gap-4">
    <div class="flex justify-between items-center">
      <span class="text-sm font-semibold text-slate-500">{currentIndex + 1} / {count}</span>
      <span class="text-2xl font-bold tabular-nums text-teal-700">{formatTime(elapsedMs)}</span>
    </div>

    <div class="bg-slate-200 rounded-full h-1.5">
      <div
        class="bg-teal-700 h-1.5 rounded-full transition-all duration-150"
        style="width: {(currentIndex / count) * 100}%"
      ></div>
    </div>

    <div class="bg-white border-2 border-teal-700 rounded-2xl py-8 px-4 text-center mt-2">
      <p class="text-xs text-slate-400 mb-2">お題</p>
      <p class="text-4xl font-bold tracking-widest text-slate-800">{currentQuestion}</p>
    </div>

    <input
      bind:this={inputEl}
      bind:value={inputValue}
      oninput={handleInput}
      oncompositionstart={handleCompositionStart}
      oncompositionend={handleCompositionEnd}
      type="text"
      autocomplete="off"
      autocorrect="off"
      autocapitalize="off"
      class="border border-slate-300 rounded-xl px-4 py-3 text-lg outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-200 w-full"
      placeholder="ここに入力..."
    />

    <p class="text-center text-xs text-slate-400">
      🏆 自己ベスト: {best !== null ? formatTime(best) : '—'}
    </p>
  </div>

{:else}
  <div class="max-w-sm mx-auto px-4 py-8 flex flex-col items-center gap-5">
    <p class="text-5xl mt-4">🎉</p>
    <p class="text-sm font-semibold text-slate-500">
      クリア！ {difficulty === 'easy' ? 'かんたん' : 'むずかしい'} {count}問
    </p>
    <p class="text-5xl font-bold tabular-nums text-teal-700">{formatTime(finalTimeMs)}</p>

    {#if isNewRecord && prevBestMs !== null}
      <div class="bg-yellow-50 border border-yellow-200 rounded-xl px-6 py-3 text-sm font-semibold text-yellow-800">
        ✨ 新記録！（前回: {formatTime(prevBestMs)}）
      </div>
    {:else if isNewRecord}
      <div class="bg-yellow-50 border border-yellow-200 rounded-xl px-6 py-3 text-sm font-semibold text-yellow-800">
        ✨ 初クリア！
      </div>
    {/if}

    <div class="flex gap-3 w-full mt-2">
      <button
        type="button"
        class="flex-1 bg-slate-100 text-slate-700 rounded-xl py-3 font-semibold active:opacity-80"
        onclick={restart}
      >
        もう一度
      </button>
      <button
        type="button"
        class="flex-1 bg-teal-700 text-white rounded-xl py-3 font-semibold active:opacity-80"
        onclick={backToStart}
      >
        設定に戻る
      </button>
    </div>
  </div>
{/if}
