<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { loadDefaultJapaneseParser } from 'budoux'
  import { convert } from '$lib/hepburn/converter'
  import {
    DEFAULT_SETTINGS,
    loadSettings,
    saveSettings,
    applyPreset,
    applyIndividualChange,
    type HepburnSettings,
    type Preset,
    type LongVowel,
    type Nasal,
    type Separator,
    type Width,
    type CaseMode
  } from '$lib/hepburn/settings'

  // --- 状態 ---
  let inputText = $state('')
  let outputText = $state('')
  let settings = $state<HepburnSettings>(DEFAULT_SETTINGS)
  let hasUntranslatableChars = $state(false)
  let settingsChangedWarning = $state(false)
  let copySuccess = $state(false)
  let isConverting = $state(false)
  let isComposing = $state(false)
  let isSettingsPanelOpen = $state(false)

  // budoux パーサー
  type Parser = ReturnType<typeof loadDefaultJapaneseParser>
  let parser = $state<Parser | null>(null)
  let parserStatus = $state<'loading' | 'ready' | 'error'>('loading')

  // デバウンス用タイマー
  let autoConvertTimer: ReturnType<typeof setTimeout> | null = null
  let copyTimer: ReturnType<typeof setTimeout> | null = null

  // --- 定数 ---
  const CHAR_LIMIT = 10000
  const SAMPLE_TEXT = 'しんぶんはきんようびにとうきょうへいく'

  // --- 派生値 ---
  const charCount = $derived(inputText.length)
  const isOverLimit = $derived(charCount > CHAR_LIMIT)
  const sampleOutput = $derived(
    parser && parserStatus === 'ready'
      ? convertSegments(mergeSmallKana(parser.parse(SAMPLE_TEXT)), settings).output
      : convert(SAMPLE_TEXT, settings).output
  )

  onDestroy(() => {
    if (autoConvertTimer !== null) clearTimeout(autoConvertTimer)
    if (copyTimer !== null) clearTimeout(copyTimer)
  })

  // --- 初期化 ---
  onMount(() => {
    settings = loadSettings()
    try {
      parser = loadDefaultJapaneseParser()
      parserStatus = 'ready'
    } catch {
      parserStatus = 'error'
    }
  })

  // --- 変換処理 ---

  // 小書き仮名（ゃゅょ等）で始まるセグメントを前のセグメントに結合する。
  // BudouX が複合拍（にゅ など）の途中で分割した場合に小書き仮名が単独になるのを防ぐ。
  const SMALL_KANA_RE = /^[ぁぃぅぇぉゃゅょゎァィゥェォャュョヮ]/
  function mergeSmallKana(segments: string[]): string[] {
    const merged: string[] = []
    for (const seg of segments) {
      if (merged.length > 0 && SMALL_KANA_RE.test(seg)) {
        merged[merged.length - 1] += seg
      } else {
        merged.push(seg)
      }
    }
    return merged
  }

  // 形態素解析済みセグメントをヘボン式に変換する。
  // settings.pascalSpaces で単語区切りスペースの有無を制御する（caseMode 非依存）。
  // 全角出力時は全角スペースを使用する。
  function convertSegments(segments: string[], s: HepburnSettings): { output: string, hasUntranslatableChars: boolean } {
    const sep = s.pascalSpaces ? (s.width === 'full' ? '　' : ' ') : ''
    if (s.caseMode === 'pascal') {
      const parts = segments.map(seg => {
        const r = convert(seg, { ...s, caseMode: 'lower' })
        return {
          text: r.output.length > 0 ? r.output[0].toUpperCase() + r.output.slice(1) : '',
          hasUntranslatable: r.hasUntranslatableChars
        }
      })
      return {
        output: parts.map(p => p.text).join(sep),
        hasUntranslatableChars: parts.some(p => p.hasUntranslatable)
      }
    } else {
      const parts = segments.map(seg => convert(seg, s))
      return {
        output: parts.map(p => p.output).join(sep),
        hasUntranslatableChars: parts.some(p => p.hasUntranslatableChars)
      }
    }
  }

  function autoConvert() {
    if (isOverLimit || !inputText) {
      outputText = ''
      hasUntranslatableChars = false
      return
    }
    // 形態素解析を自動変換にも適用する。
    // 戻す場合: この if ブロックを削除し、else の処理のみを残す。
    if (parser && parserStatus === 'ready') {
      const result = convertSegments(mergeSmallKana(parser.parse(inputText)), settings)
      outputText = result.output
      hasUntranslatableChars = result.hasUntranslatableChars
      settingsChangedWarning = false
    } else {
      const result = convert(inputText, settings)
      outputText = result.output
      hasUntranslatableChars = result.hasUntranslatableChars
    }
  }

  function scheduleAutoConvert() {
    if (autoConvertTimer !== null) clearTimeout(autoConvertTimer)
    autoConvertTimer = setTimeout(autoConvert, 300)
  }

  function handleInput() {
    if (!isComposing) scheduleAutoConvert()
  }

  function handleCompositionStart() {
    isComposing = true
  }

  function handleCompositionEnd() {
    isComposing = false
    autoConvert()
  }

  function handleButtonConvert() {
    if (!parser || parserStatus !== 'ready') return
    isConverting = true
    const result = convertSegments(mergeSmallKana(parser.parse(inputText)), settings)
    outputText = result.output
    hasUntranslatableChars = result.hasUntranslatableChars
    settingsChangedWarning = false
    isConverting = false
  }

  function handleClear() {
    inputText = ''
    outputText = ''
    hasUntranslatableChars = false
    settingsChangedWarning = false
  }

  async function handleCopy() {
    if (!outputText) return
    try {
      await navigator.clipboard.writeText(outputText)
      copySuccess = true
      if (copyTimer !== null) clearTimeout(copyTimer)
      copyTimer = setTimeout(() => { copySuccess = false }, 2000)
    } catch {
      // クリップボード API が使えない場合は無視
    }
  }

  function handleRetryParser() {
    parserStatus = 'loading'
    try {
      parser = loadDefaultJapaneseParser()
      parserStatus = 'ready'
    } catch {
      parserStatus = 'error'
    }
  }

  // --- 設定変更ハンドラー ---

  function onPresetChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value as Preset
    settings = applyPreset(settings, value)
    saveSettings(settings)
    onSettingsChanged()
  }

  function onLongVowelChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value as LongVowel
    settings = applyIndividualChange(settings, 'longVowel', value)
    saveSettings(settings)
    onSettingsChanged()
  }

  function onNasalChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value as Nasal
    settings = applyIndividualChange(settings, 'nasal', value)
    saveSettings(settings)
    onSettingsChanged()
  }

  function onSeparatorChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value as Separator
    settings = applyIndividualChange(settings, 'separator', value)
    saveSettings(settings)
    onSettingsChanged()
  }

  function onWidthChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value as Width
    settings = applyIndividualChange(settings, 'width', value)
    saveSettings(settings)
    onSettingsChanged()
  }

  function onCaseModeChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value as CaseMode
    settings = applyIndividualChange(settings, 'caseMode', value)
    saveSettings(settings)
    onSettingsChanged()
  }

  function onPascalSpacesChange(e: Event) {
    const value = (e.target as HTMLInputElement).checked
    settings = applyIndividualChange(settings, 'pascalSpaces', value)
    saveSettings(settings)
    onSettingsChanged()
  }

  function onSettingsChanged() {
    if (inputText) {
      settingsChangedWarning = true
      autoConvert()
    }
  }
</script>

<svelte:head>
  <title>ヘボン式変換 — Utilities</title>
</svelte:head>

<div class="max-w-4xl mx-auto px-4 py-6">

  <!-- タイトル -->
  <h1 class="text-2xl font-bold text-gray-800 mb-3">ヘボン式ローマ字変換</h1>

  <!-- 説明文・注意文 -->
  <div class="text-sm text-gray-600 space-y-1 mb-5">
    <p>ひらがな・カタカナ・半角カナをヘボン式ローマ字に変換します。漢字はそのまま出力されます。</p>
    <p>入力中は自動で変換されます（形態素解析による単語区切り）。「変換」ボタンを押しても同様に変換します。形態素解析の準備前は単語区切りなしで変換されます。</p>
    <p class="text-amber-600">変換結果は誤りを含む場合があります。出力内容は必ずご自身でご確認ください。</p>
  </div>

  <!-- 設定パネル -->
  <div class="border border-gray-200 rounded-xl mb-6 overflow-hidden">
    <!-- スマホ: アコーディオンヘッダー -->
    <button
      type="button"
      class="w-full flex justify-between items-center px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700 sm:hidden"
      onclick={() => { isSettingsPanelOpen = !isSettingsPanelOpen }}
    >
      ヘボン式ルール設定
      <span>{isSettingsPanelOpen ? '▲' : '▼'}</span>
    </button>

    <div class:hidden={!isSettingsPanelOpen} class="sm:block p-4 space-y-4">

      <!-- プリセット連動設定 -->
      <div class="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5 space-y-2.5">
        <p class="text-xs text-blue-500 font-medium">プリセット連動</p>
        <div class="flex flex-wrap items-center gap-3">
          <label class="text-sm text-gray-600 w-28 shrink-0">プリセット</label>
          <select
            class="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white"
            value={settings.preset}
            onchange={onPresetChange}
          >
            <option value="passport">パスポート式（デフォルト）</option>
            <option value="railway">鉄道式</option>
            <option value="road">道路標識式</option>
            <option value="custom">カスタム</option>
          </select>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">

          <div class="flex items-center gap-2">
            <label class="text-sm text-gray-600 w-36 shrink-0">長音の表記</label>
            <select
              class="border border-gray-300 rounded-lg px-2 py-1 text-sm flex-1 bg-white"
              value={settings.longVowel}
              onchange={onLongVowelChange}
            >
              <option value="omit">表記しない</option>
              <option value="macron">マクロン（ā, ī, ū, ē, ō）</option>
              <option value="double">母音を重ねる</option>
            </select>
          </div>

          <div class="flex items-center gap-2">
            <label class="text-sm text-gray-600 w-36 shrink-0">撥音「ん」</label>
            <select
              class="border border-gray-300 rounded-lg px-2 py-1 text-sm flex-1 bg-white"
              value={settings.nasal}
              onchange={onNasalChange}
            >
              <option value="mn">b/m/p前はm、それ以外はn</option>
              <option value="n">常にn</option>
            </select>
          </div>

          <div class="flex items-center gap-2">
            <label class="text-sm text-gray-600 w-36 shrink-0">撥音＋母音・y続く場合</label>
            <select
              class="border border-gray-300 rounded-lg px-2 py-1 text-sm flex-1 bg-white"
              value={settings.separator}
              onchange={onSeparatorChange}
            >
              <option value="none">何もしない</option>
              <option value="apostrophe">アポストロフィ（n'）</option>
              <option value="hyphen">ハイフン（n-）</option>
            </select>
          </div>

        </div>
      </div>

      <!-- その他の設定 -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">

        <div class="flex items-center gap-2">
          <label class="text-sm text-gray-600 w-36 shrink-0">半角/全角</label>
          <select
            class="border border-gray-300 rounded-lg px-2 py-1 text-sm flex-1"
            value={settings.width}
            onchange={onWidthChange}
          >
            <option value="half">半角</option>
            <option value="full">全角</option>
          </select>
        </div>

        <div class="flex items-center gap-2">
          <label class="text-sm text-gray-600 w-36 shrink-0">アルファベット</label>
          <select
            class="border border-gray-300 rounded-lg px-2 py-1 text-sm flex-1"
            value={settings.caseMode}
            onchange={onCaseModeChange}
          >
            <option value="pascal">PascalCase</option>
            <option value="lower">小文字</option>
            <option value="upper">大文字</option>
          </select>
        </div>

        <div class="flex items-center gap-2">
          <label class="text-sm text-gray-600 w-36 shrink-0">単語区切り</label>
          <label class="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.pascalSpaces}
              onchange={onPascalSpacesChange}
            />
            スペースを入れる
          </label>
        </div>

      </div>

      <!-- 変換例 -->
      <div class="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-600">
        <span class="font-medium">変換例：</span>
        {SAMPLE_TEXT} → <span class="font-mono text-gray-800">{sampleOutput}</span>
      </div>
    </div>
  </div>

  <!-- PC: 入力 / ボタン / 出力 横並び -->
  <div class="hidden sm:grid grid-cols-[1fr_auto_1fr] gap-4 items-start">

    <!-- 入力欄 -->
    <div class="flex flex-col gap-2">
      <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
        <label class="text-sm font-medium text-gray-700">入力</label>
        {#if settingsChangedWarning}
          <span class="text-xs text-blue-600">設定変更済み — 変換ボタンで再変換</span>
        {/if}
        {#if hasUntranslatableChars}
          <span class="text-xs text-amber-600">変換できない文字が含まれています</span>
        {/if}
      </div>
      <textarea
        class="w-full h-48 border border-gray-300 rounded-xl px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-300"
        placeholder="ひらがな・カタカナ・半角カナを入力..."
        bind:value={inputText}
        oninput={handleInput}
        oncompositionstart={handleCompositionStart}
        oncompositionend={handleCompositionEnd}
      ></textarea>
      <div class="flex items-center justify-between text-xs text-gray-400">
        <span class:text-amber-500={isOverLimit}>{charCount.toLocaleString()}文字</span>
        <button
          type="button"
          class="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600"
          onclick={handleClear}
        >クリア</button>
      </div>
      {#if isOverLimit}
        <p class="text-xs text-amber-600">文字数が多いため、自動変換を停止しました</p>
      {/if}
    </div>

    <!-- 変換ボタン -->
    <div class="flex flex-col items-center justify-center pt-8 gap-2">
      {#if parserStatus === 'error'}
        <p class="text-xs text-red-500 text-center mb-1">形態素解析の<br/>読み込みに<br/>失敗しました</p>
        <button
          type="button"
          class="px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-200"
          onclick={handleRetryParser}
        >再試行</button>
      {:else}
        <button
          type="button"
          class="px-5 py-3 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed leading-tight text-center"
          disabled={parserStatus !== 'ready' || isConverting}
          onclick={handleButtonConvert}
        >
          {#if parserStatus === 'loading'}
            準備中...
          {:else if isConverting}
            変換中...
          {:else}
            変換 →<br/><span class="text-xs font-normal opacity-80">（形態素解析）</span>
          {/if}
        </button>
      {/if}
    </div>

    <!-- 出力欄 -->
    <div class="flex flex-col gap-2">
      <label class="text-sm font-medium text-gray-700">出力</label>
      <textarea
        class="w-full h-48 border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 resize-y focus:outline-none"
        readonly
        value={outputText}
      ></textarea>
      <div class="flex justify-end">
        <button
          type="button"
          class="px-3 py-1 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 text-gray-600"
          onclick={handleCopy}
        >
          {copySuccess ? 'コピーしました ✓' : 'コピー'}
        </button>
      </div>
    </div>

  </div>

  <!-- スマホ: 縦並び -->
  <div class="sm:hidden flex flex-col gap-4">

    <!-- 入力欄 -->
    <div class="flex flex-col gap-2">
      <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
        <label class="text-sm font-medium text-gray-700">入力</label>
        {#if settingsChangedWarning}
          <span class="text-xs text-blue-600">設定変更済み — 変換ボタンで再変換</span>
        {/if}
        {#if hasUntranslatableChars}
          <span class="text-xs text-amber-600">変換できない文字が含まれています</span>
        {/if}
      </div>
      <textarea
        class="w-full h-32 border border-gray-300 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
        placeholder="ひらがな・カタカナ・半角カナを入力..."
        bind:value={inputText}
        oninput={handleInput}
        oncompositionstart={handleCompositionStart}
        oncompositionend={handleCompositionEnd}
      ></textarea>
      <div class="flex items-center justify-between text-xs text-gray-400">
        <span class:text-amber-500={isOverLimit}>{charCount.toLocaleString()}文字</span>
        <button
          type="button"
          class="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600"
          onclick={handleClear}
        >クリア</button>
      </div>
      {#if isOverLimit}
        <p class="text-xs text-amber-600">文字数が多いため、自動変換を停止しました</p>
      {/if}
    </div>

    <!-- 変換ボタン -->
    <div class="flex justify-center">
      {#if parserStatus === 'error'}
        <div class="flex flex-col items-center gap-2">
          <p class="text-sm text-red-500">形態素解析の読み込みに失敗しました</p>
          <button
            type="button"
            class="px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-200"
            onclick={handleRetryParser}
          >再試行</button>
        </div>
      {:else}
        <button
          type="button"
          class="px-8 py-3 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed leading-tight text-center"
          disabled={parserStatus !== 'ready' || isConverting}
          onclick={handleButtonConvert}
        >
          {#if parserStatus === 'loading'}
            準備中...
          {:else if isConverting}
            変換中...
          {:else}
            変換 →<br/><span class="text-xs font-normal opacity-80">（形態素解析）</span>
          {/if}
        </button>
      {/if}
    </div>

    <!-- 出力欄 -->
    <div class="flex flex-col gap-2">
      <label class="text-sm font-medium text-gray-700">出力</label>
      <textarea
        class="w-full h-32 border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 resize-none focus:outline-none"
        readonly
        value={outputText}
      ></textarea>
      <div class="flex justify-end">
        <button
          type="button"
          class="px-3 py-1 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 text-gray-600"
          onclick={handleCopy}
        >
          {copySuccess ? 'コピーしました ✓' : 'コピー'}
        </button>
      </div>
    </div>

  </div>


</div>
