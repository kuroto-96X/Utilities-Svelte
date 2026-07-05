<script lang="ts">
  import { onMount, tick } from 'svelte'
  import { easyWords, generatePool, pickQuestions, type WordPart } from '$lib/game/flick-typing/words'
  import {
    getBest,
    saveBest,
    getHistory,
    addHistory,
    type Difficulty,
    type PlayRecord,
  } from '$lib/game/flick-typing/score'

  type Phase = 'start' | 'game' | 'result'

  // ---- スタート設定 ----
  let difficulty = $state<Difficulty>('easy')
  let count = $state<5 | 10 | 20>(10)
  let seedInput = $state('')

  // ---- ゲーム状態 ----
  let phase = $state<Phase>('start')
  let questions = $state<string[]>([])
  let questionParts = $state<WordPart[][][]>([])
  let currentIndex = $state(0)
  let currentSeed = $state(0)
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

  // ---- 履歴 ----
  let history = $state<PlayRecord[]>([])

  // ---- 派生値 ----
  let currentQuestion = $derived(questions[currentIndex] ?? '')
  let best = $derived(getBest(difficulty, count))
  let matchedLength = $derived.by(() => {
    let i = 0
    while (
      i < inputValue.length &&
      i < currentQuestion.length &&
      inputValue[i] === currentQuestion[i]
    ) { i++ }
    return i
  })
  let hasError = $derived(inputValue.length > matchedLength && !/^[a-zA-ZＡ-Ｚａ-ｚ]$/.test(inputValue[matchedLength] ?? ''))

  let currentParts = $derived(questionParts[currentIndex] ?? null)

  type DisplayChar = { char: string; matched: boolean; isNext: boolean; isError: boolean }
  type DisplayPart =
    | { type: 'ruby'; kanji: string; furigana: DisplayChar[]; complete: boolean }
    | { type: 'plain'; chars: DisplayChar[] }

  let displayParts = $derived.by((): DisplayPart[][] | null => {
    if (currentParts === null) return null
    const result: DisplayPart[][] = []
    let pos = 0
    for (const group of currentParts) {
      const groupResult: DisplayPart[] = []
      for (const part of group) {
        const partReading = part.type === 'ruby' ? part.reading : part.text
        const partLen = partReading.length
        const chars: DisplayChar[] = partReading.split('').map((char, i) => {
          const charPos = pos + i
          return {
            char,
            matched: charPos < matchedLength,
            isNext: charPos === matchedLength,
            isError: hasError && charPos === matchedLength,
          }
        })
        if (part.type === 'ruby') {
          groupResult.push({
            type: 'ruby',
            kanji: part.kanji,
            furigana: chars,
            complete: matchedLength >= pos + partLen,
          })
        } else {
          groupResult.push({ type: 'plain', chars })
        }
        pos += partLen
      }
      result.push(groupResult)
    }
    return result
  })

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

  function formatDate(ts: number): string {
    const d = new Date(ts)
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
  }

  function startGame() {
    if (difficulty === 'hard') {
      const parsed = seedInput.trim() ? parseInt(seedInput.trim(), 10) : undefined
      const validSeed = parsed !== undefined && !isNaN(parsed) ? (parsed >>> 0) : undefined
      const { questions: generated, seed } = generatePool(500, validSeed)
      const picked = pickQuestions(generated, count)
      questions = picked.map((q) => q.reading)
      questionParts = picked.map((q) => q.wordGroups)
      currentSeed = seed
    } else {
      questions = pickQuestions(easyWords, count)
      questionParts = []
      currentSeed = 0
    }
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
      addHistory({
        difficulty,
        count,
        timeMs: finalTimeMs,
        seed: difficulty === 'hard' ? currentSeed : undefined,
        playedAt: now,
        isPersonalBest: isNewRecord,
      })
      history = getHistory()
      phase = 'result'
    } else {
      currentIndex++
      inputValue = ''
      tick().then(() => inputEl?.focus())
    }
  }

  let shaking = $state(false)
  let shakeTimer: ReturnType<typeof setTimeout> | null = null

  function triggerShake() {
    if (shakeTimer) clearTimeout(shakeTimer)
    shaking = false
    requestAnimationFrame(() => {
      shaking = true
      shakeTimer = setTimeout(() => { shaking = false }, 300)
    })
  }

  function handleInput() {
    if (startTimeMs === null && inputValue.length > 0) {
      startTimeMs = Date.now()
      timerHandle = setInterval(() => {
        elapsedMs = Date.now() - (startTimeMs ?? Date.now())
      }, 10)
    }
    if (!isComposing) checkAnswer()
    if (hasError) triggerShake()
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
    history = getHistory()
    phase = 'start'
  }

  async function copySeed() {
    try {
      await navigator.clipboard.writeText(String(currentSeed))
    } catch {
      // clipboard API が利用できない場合は無視
    }
  }

  onMount(() => {
    history = getHistory()
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
    <h1 class="text-2xl font-bold text-teal-700 text-center">📱 フリックタイピング</h1>

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

    {#if difficulty === 'hard'}
      <div class="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
        <p class="text-xs font-bold uppercase tracking-wider text-slate-400">シード（省略でランダム）</p>
        <input
          type="text"
          inputmode="numeric"
          bind:value={seedInput}
          placeholder="省略でランダム"
          class="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 w-full outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-200"
        />
      </div>
    {/if}

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

    {#if history.length > 0}
      <div class="flex flex-col gap-2">
        <p class="text-xs font-bold uppercase tracking-wider text-slate-400">プレイ履歴</p>
        <div class="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          {#each history.slice(0, 10) as record}
            <div class="flex items-center gap-2 px-3 py-2 text-xs text-slate-500">
              <span class="w-3 text-yellow-500">{record.isPersonalBest ? '★' : ''}</span>
              <span class="w-14 shrink-0">
                {record.difficulty === 'easy' ? 'かんたん' : 'むずかしい'}
              </span>
              <span class="w-8 shrink-0">{record.count}問</span>
              <span class="font-mono tabular-nums">{formatTime(record.timeMs)}</span>
              {#if record.seed !== undefined}
                <button
                  type="button"
                  class="text-teal-600 underline truncate max-w-24"
                  onclick={() => { seedInput = String(record.seed); difficulty = 'hard' }}
                >
                  seed:{record.seed}
                </button>
              {/if}
              <span class="ml-auto shrink-0">{formatDate(record.playedAt)}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>

{:else if phase === 'game'}
  <div class="max-w-sm mx-auto px-4 py-6 flex flex-col gap-4">
    <div class="flex justify-between items-center">
      <button
        type="button"
        class="text-sm text-slate-400 active:opacity-60"
        onclick={backToStart}
      >← 戻る</button>
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
      {#if displayParts !== null}
        <p class="text-4xl font-bold tracking-widest text-slate-800 leading-loose">
          {#each displayParts as group}<span class="inline-block whitespace-nowrap">{#each group as dp}{#if dp.type === 'ruby'}<ruby class={dp.complete ? 'text-teal-700' : 'text-slate-300'}>{dp.kanji}<rt style="font-size:0.55em;">{#each dp.furigana as fc}<span class={fc.isError ? 'text-red-500 underline underline-offset-2' : fc.matched ? 'text-teal-700' : fc.isNext ? 'text-slate-800' : 'text-slate-300'}>{fc.char}</span>{/each}</rt></ruby>{:else}{#each dp.chars as pc}<span class={pc.isError ? 'text-red-500 underline underline-offset-4' : pc.matched ? 'text-teal-700' : pc.isNext ? 'text-slate-800' : 'text-slate-300'}>{pc.char}</span>{/each}{/if}{/each}</span>{/each}
        </p>
      {:else}
        <p class="text-4xl font-bold tracking-widest text-slate-800">
          <span class="text-teal-700">{currentQuestion.slice(0, matchedLength)}</span><!--
          --><span class={hasError ? 'text-red-500 underline underline-offset-4' : ''}>{currentQuestion[matchedLength] ?? ''}</span><!--
          --><span class="text-slate-300">{currentQuestion.slice(matchedLength + 1)}</span>
        </p>
      {/if}
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
      class:animate-shake-sm={shaking}
      class={hasError
        ? 'border border-red-400 bg-red-50 rounded-xl px-4 py-3 text-lg outline-none focus:ring-0 w-full'
        : 'border border-slate-300 rounded-xl px-4 py-3 text-lg outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-200 w-full'}
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

    {#if difficulty === 'hard'}
      <div class="flex items-center gap-2 text-sm text-slate-500">
        <span>シード: {currentSeed}</span>
        <button
          type="button"
          onclick={copySeed}
          class="text-teal-600 active:opacity-70"
          title="シードをコピー"
        >
          📋
        </button>
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

<style>
  @keyframes shake-sm {
    0%, 100% { transform: translateX(0); }
    20%       { transform: translateX(-5px); }
    40%       { transform: translateX(5px); }
    60%       { transform: translateX(-3px); }
    80%       { transform: translateX(3px); }
  }
  .animate-shake-sm {
    animation: shake-sm 0.3s ease-in-out;
  }
</style>
