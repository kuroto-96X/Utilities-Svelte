<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { convert } from '$lib/hepburn/converter'
  import { VU_ENTRIES } from '$lib/hepburn/table'
  import {
    DEFAULT_SETTINGS,
    loadSettings,
    saveSettings,
    applyPreset,
    applyIndividualChange,
    saveCustomSnapshot,
    loadCustomSnapshot,
    type HepburnSettings,
    type Preset,
    type LongVowel,
    type Nasal,
    type Separator,
    type Width,
    type CaseMode,
    type VuStyle
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

  // kuromoji トークナイザー（形態素解析・漢字→かな変換用）
  type KuromojiTokenizer = {
    tokenize: (text: string) => Array<{ surface_form: string; reading: string }>
  }
  let kuromojiTokenizer = $state<KuromojiTokenizer | null>(null)
  let kuromojiStatus = $state<'loading' | 'ready' | 'error'>('loading')
  let useKanji = $state(false)

  // デバウンス用タイマー
  let autoConvertTimer: ReturnType<typeof setTimeout> | null = null
  let copyTimer: ReturnType<typeof setTimeout> | null = null

  // --- 定数 ---
  const CHAR_LIMIT = 10000
  const SAMPLE_TEXT = 'とうきょうのしんぶんしゃで働くヴィオラは しんようがある'

  // --- 派生値 ---
  const charCount = $derived(inputText.length)
  const isOverLimit = $derived(charCount > CHAR_LIMIT)
  const sampleOutput = $derived(
    convertWithSplit(SAMPLE_TEXT, settings, useKanji && kuromojiTokenizer ? kanjiToKana : undefined).output
  )

  onDestroy(() => {
    if (autoConvertTimer !== null) clearTimeout(autoConvertTimer)
    if (copyTimer !== null) clearTimeout(copyTimer)
  })

  // --- 初期化 ---
  onMount(() => {
    settings = loadSettings()
    loadKuromojiAsync()
  })

  async function loadKuromojiAsync() {
    try {
      const mod = await import('kuromoji')
      const kuromoji = mod.default ?? mod
      await new Promise<void>((resolve, reject) => {
        kuromoji.builder({ dicPath: '/kuromoji/dict' }).build((err: unknown, tokenizer: KuromojiTokenizer) => {
          if (err) { reject(err); return }
          kuromojiTokenizer = tokenizer
          kuromojiStatus = 'ready'
          resolve()
        })
      })
    } catch {
      kuromojiStatus = 'error'
    }
  }

  // 漢字→かな（カタカナ）に変換する。kuromoji のトークン reading を優先する。
  function kanjiToKana(text: string): string {
    if (!kuromojiTokenizer) return text
    return kuromojiTokenizer
      .tokenize(text)
      .map((t) => (t.reading && t.reading !== '*' ? t.reading : t.surface_form))
      .join('')
  }

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

  // スペースで区切られた各チャンクを個別に変換する。
  // PascalCase の場合は各チャンクの先頭が大文字になる。
  // 形態素解析を自動変換にも適用する。
  // 戻す場合: convertWithSplit 内の if 分岐を削除し、convert(chunk, s) のみを残す。
  function convertWithSplit(
    input: string,
    s: HepburnSettings,
    kanjiConverter?: (text: string) => string
  ): { output: string, hasUntranslatableChars: boolean } {
    const chunks = input.split(/([ 　]+)/)
    let out = ''
    let hasUntranslatable = false
    for (const chunk of chunks) {
      if (chunk === '') continue
      if (/^[ 　]+$/.test(chunk)) {
        out += s.width === 'full' ? '　'.repeat(chunk.length) : ' '.repeat(chunk.length)
      } else {
        let result: { output: string, hasUntranslatableChars: boolean }
        if (s.useParser && kuromojiTokenizer && kuromojiStatus === 'ready') {
          const segments = mergeSmallKana(kuromojiTokenizer.tokenize(chunk).map(t => t.surface_form))
          const converted = kanjiConverter ? segments.map(kanjiConverter) : segments
          result = convertSegments(converted, s)
        } else {
          result = convert(kanjiConverter ? kanjiConverter(chunk) : chunk, s)
        }
        out += result.output
        if (result.hasUntranslatableChars) hasUntranslatable = true
      }
    }
    return { output: out, hasUntranslatableChars: hasUntranslatable }
  }

  function autoConvert() {
    if (isOverLimit || !inputText) {
      outputText = ''
      hasUntranslatableChars = false
      return
    }
    const kanjiConverter = useKanji && kuromojiTokenizer ? kanjiToKana : undefined
    const result = convertWithSplit(inputText, settings, kanjiConverter)
    outputText = result.output
    hasUntranslatableChars = result.hasUntranslatableChars
    settingsChangedWarning = false
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
    if (settings.useParser && (!kuromojiTokenizer || kuromojiStatus !== 'ready')) return
    isConverting = true
    const kanjiConverter = useKanji && kuromojiTokenizer ? kanjiToKana : undefined
    const result = convertWithSplit(inputText, settings, kanjiConverter)
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

  // --- 設定変更ハンドラー ---

  function onPresetChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value as Preset
    if (value === 'custom') {
      // カスタムを選択: 保存済みスナップショットがあれば復元
      const snapshot = loadCustomSnapshot()
      settings = snapshot
        ? { ...settings, ...snapshot, preset: 'custom' }
        : applyPreset(settings, 'custom')
    } else {
      // 別プリセットに切り替え: カスタム状態なら現在値をスナップショットに保存してから切り替え
      if (settings.preset === 'custom') saveCustomSnapshot(settings)
      settings = applyPreset(settings, value)
    }
    saveSettings(settings)
    onSettingsChanged()
  }

  function onLongVowelChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value as LongVowel
    settings = applyIndividualChange(settings, 'longVowel', value)
    saveSettings(settings)
    saveCustomSnapshot(settings)
    onSettingsChanged()
  }

  function onNasalChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value as Nasal
    settings = applyIndividualChange(settings, 'nasal', value)
    saveSettings(settings)
    saveCustomSnapshot(settings)
    onSettingsChanged()
  }

  function onSeparatorChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value as Separator
    settings = applyIndividualChange(settings, 'separator', value)
    saveSettings(settings)
    saveCustomSnapshot(settings)
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

  function onUseParserChange(e: Event) {
    const value = (e.target as HTMLInputElement).checked
    settings = applyIndividualChange(settings, 'useParser', value)
    saveSettings(settings)
    onSettingsChanged()
  }

  function onVuStyleChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value as VuStyle
    settings = applyIndividualChange(settings, 'vuStyle', value)
    saveSettings(settings)
    onSettingsChanged()
  }

  function onUseKanjiChange(e: Event) {
    useKanji = (e.target as HTMLInputElement).checked
    if (inputText) settingsChangedWarning = true
  }

  function onSettingsChanged() {
    if (inputText) settingsChangedWarning = true
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
    <p>日本語をヘボン式ローマ字に変換します。</p>
    <p>入力中は自動で変換されます。「変換」ボタンを押しても同様に変換します。</p>
    <p class="text-amber-600">※変換結果は誤りを含む場合があります。出力内容は必ずご自身でご確認ください。</p>
  </div>

  <!-- 設定パネル -->
  <div class="border border-gray-200 rounded-xl mb-6 overflow-hidden">
    <!-- スマホ: アコーディオンヘッダー -->
    <button
      type="button"
      class="w-full flex justify-between items-center px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700 sm:hidden"
      onclick={() => { isSettingsPanelOpen = !isSettingsPanelOpen }}
    >
      変換ルール設定
      <span>{isSettingsPanelOpen ? '▲' : '▼'}</span>
    </button>

    <div class:hidden={!isSettingsPanelOpen} class="sm:block p-4 space-y-4">

      <!-- プリセット連動設定 -->
      <div class="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5 space-y-2.5">
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
        <hr class="border-blue-100" />
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

          <div class="flex items-center gap-2">
            <label class="text-sm text-gray-600 w-36 shrink-0">ヴ行の表記</label>
            <select
              class="border border-gray-300 rounded-lg px-2 py-1 text-sm flex-1 bg-white"
              value={settings.vuStyle}
              onchange={onVuStyleChange}
            >
              <option value="v">va / vi / vu / ve / vo</option>
              <option value="b">ba / bi / bu / be / bo</option>
              <option value="bu">bua / bui / bu / bue / buo</option>
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
          <label class="text-sm text-gray-600 w-36 shrink-0">形態素解析</label>
          <label
            class="flex items-center gap-1.5 text-sm text-gray-600"
            class:cursor-pointer={kuromojiStatus === 'ready'}
            class:opacity-50={kuromojiStatus !== 'ready'}
          >
            <input
              type="checkbox"
              checked={settings.useParser}
              disabled={kuromojiStatus !== 'ready'}
              onchange={onUseParserChange}
            />
            使用する
          </label>
        </div>

        <div class="flex items-center gap-2" class:opacity-50={!settings.useParser}>
          <label class="text-sm text-gray-600 w-36 shrink-0">単語区切り</label>
          <label
            class="flex items-center gap-1.5 text-sm text-gray-600"
            class:cursor-pointer={settings.useParser}
            class:cursor-not-allowed={!settings.useParser}
          >
            <input
              type="checkbox"
              checked={settings.pascalSpaces}
              disabled={!settings.useParser}
              onchange={onPascalSpacesChange}
            />
            スペースを入れる
          </label>
        </div>

        <div class="flex items-center gap-2">
          <label class="text-sm text-gray-600 w-36 shrink-0">漢字変換</label>
          <label
            class="flex items-center gap-1.5 text-sm text-gray-600"
            class:cursor-pointer={kuromojiStatus === 'ready'}
            class:opacity-50={kuromojiStatus !== 'ready'}
          >
            <input
              type="checkbox"
              checked={useKanji}
              disabled={kuromojiStatus !== 'ready'}
              onchange={onUseKanjiChange}
            />
            使用する
          </label>
          {#if kuromojiStatus === 'loading'}
            <span class="text-xs text-gray-400">準備中...</span>
          {:else if kuromojiStatus === 'error'}
            <span class="text-xs text-red-500">読込失敗</span>
          {/if}
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
  <div class="hidden sm:grid grid-cols-[1fr_auto_1fr] gap-4 items-center">

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
        placeholder="変換したい文を入力"
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
    <div class="flex flex-col items-center justify-center gap-2">
      <button
          type="button"
          class="px-5 py-3 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed leading-tight text-center"
          disabled={isConverting || (settings.useParser && kuromojiStatus !== 'ready')}
          onclick={handleButtonConvert}
        >
          {#if kuromojiStatus === 'loading' && settings.useParser}
            準備中...
          {:else if isConverting}
            変換中...
          {:else}
            変換
          {/if}
        </button>
    </div>

    <!-- 出力欄 -->
    <div class="flex flex-col gap-2">
      <label class="text-sm font-medium text-gray-700">出力</label>
      <textarea
        class="w-full h-48 border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 resize-y focus:outline-none"
        readonly
        placeholder="結果が表示されます"
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
        placeholder="変換したい文を入力"
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
      <button
        type="button"
        class="px-8 py-3 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed leading-tight text-center"
        disabled={isConverting || (settings.useParser && kuromojiStatus !== 'ready')}
        onclick={handleButtonConvert}
      >
        {#if kuromojiStatus === 'loading' && settings.useParser}
          準備中...
        {:else if isConverting}
          変換中...
        {:else}
          変換
        {/if}
      </button>
    </div>

    <!-- 出力欄 -->
    <div class="flex flex-col gap-2">
      <label class="text-sm font-medium text-gray-700">出力</label>
      <textarea
        class="w-full h-32 border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 resize-none focus:outline-none"
        readonly
        placeholder="結果が表示されます"
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


  <!-- 詳細説明 -->
  <div class="mt-10 pt-8 border-t border-gray-200 space-y-8">

    <!-- 変換表 -->
    <section class="space-y-4">
      <h2 class="text-base font-semibold text-gray-800">変換表（ヘボン式）</h2>

      <!-- 清音・濁音・半濁音 -->
      <div>
        <p class="text-xs font-medium text-gray-500 mb-2">清音・濁音・半濁音</p>
        <div class="overflow-x-auto">
          <table class="text-xs border-collapse whitespace-nowrap">
            <thead>
              <tr class="bg-gray-50">
                <th class="px-3 py-1.5 border border-gray-200 text-gray-500 text-left w-10"></th>
                <th class="px-3 py-1.5 border border-gray-200 text-gray-500 text-center" colspan="2">あ</th>
                <th class="px-3 py-1.5 border border-gray-200 text-gray-500 text-center" colspan="2">い</th>
                <th class="px-3 py-1.5 border border-gray-200 text-gray-500 text-center" colspan="2">う</th>
                <th class="px-3 py-1.5 border border-gray-200 text-gray-500 text-center" colspan="2">え</th>
                <th class="px-3 py-1.5 border border-gray-200 text-gray-500 text-center" colspan="2">お</th>
              </tr>
            </thead>
            <tbody>
              {#each [
                { row: 'ア', cells: [['あ','a'],['い','i'],['う','u'],['え','e'],['お','o']] },
                { row: 'カ', cells: [['か','ka'],['き','ki'],['く','ku'],['け','ke'],['こ','ko']] },
                { row: 'サ', cells: [['さ','sa'],['し','shi'],['す','su'],['せ','se'],['そ','so']] },
                { row: 'タ', cells: [['た','ta'],['ち','chi'],['つ','tsu'],['て','te'],['と','to']] },
                { row: 'ナ', cells: [['な','na'],['に','ni'],['ぬ','nu'],['ね','ne'],['の','no']] },
                { row: 'ハ', cells: [['は','ha'],['ひ','hi'],['ふ','fu'],['へ','he'],['ほ','ho']] },
                { row: 'マ', cells: [['ま','ma'],['み','mi'],['む','mu'],['め','me'],['も','mo']] },
                { row: 'ヤ', cells: [['や','ya'],['',''],['ゆ','yu'],['',''],['よ','yo']] },
                { row: 'ラ', cells: [['ら','ra'],['り','ri'],['る','ru'],['れ','re'],['ろ','ro']] },
                { row: 'ワ', cells: [['わ','wa'],['',''],['',''],['',''],['を','o']] },
                { row: 'ガ', cells: [['が','ga'],['ぎ','gi'],['ぐ','gu'],['げ','ge'],['ご','go']] },
                { row: 'ザ', cells: [['ざ','za'],['じ','ji'],['ず','zu'],['ぜ','ze'],['ぞ','zo']] },
                { row: 'ダ', cells: [['だ','da'],['ぢ','(ji)'],['づ','(zu)'],['で','de'],['ど','do']] },
                { row: 'バ', cells: [['ば','ba'],['び','bi'],['ぶ','bu'],['べ','be'],['ぼ','bo']] },
                { row: 'パ', cells: [['ぱ','pa'],['ぴ','pi'],['ぷ','pu'],['ぺ','pe'],['ぽ','po']] },
              ] as rowData}
                <tr>
                  <td class="px-2 py-1 border border-gray-200 text-gray-500">{rowData.row}</td>
                  {#each rowData.cells as [kana, romaji]}
                    {#if kana === ''}
                      <td colspan="2" class="px-2 py-1 border border-gray-200 text-center text-gray-300">—</td>
                    {:else}
                      <td class="px-2 py-1 border border-gray-200 text-center">{kana}</td>
                      <td class="px-2 py-1 border border-gray-200 text-center font-mono text-gray-600">{romaji}</td>
                    {/if}
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>

      <!-- 拗音 -->
      <div>
        <p class="text-xs font-medium text-gray-500 mb-2">拗音（複合仮名）</p>
        <div class="overflow-x-auto">
          <table class="text-xs border-collapse whitespace-nowrap">
            <thead>
              <tr class="bg-gray-50">
                <th class="px-3 py-1.5 border border-gray-200 text-gray-500 text-left"></th>
                <th class="px-3 py-1.5 border border-gray-200 text-gray-500 text-center" colspan="2">〜ゃ</th>
                <th class="px-3 py-1.5 border border-gray-200 text-gray-500 text-center" colspan="2">〜ゅ</th>
                <th class="px-3 py-1.5 border border-gray-200 text-gray-500 text-center" colspan="2">〜ょ</th>
              </tr>
            </thead>
            <tbody>
              {#each [
                { row: 'キャ', cells: [['きゃ','kya'],['きゅ','kyu'],['きょ','kyo']] },
                { row: 'シャ', cells: [['しゃ','sha'],['しゅ','shu'],['しょ','sho']] },
                { row: 'チャ', cells: [['ちゃ','cha'],['ちゅ','chu'],['ちょ','cho']] },
                { row: 'ニャ', cells: [['にゃ','nya'],['にゅ','nyu'],['にょ','nyo']] },
                { row: 'ヒャ', cells: [['ひゃ','hya'],['ひゅ','hyu'],['ひょ','hyo']] },
                { row: 'ミャ', cells: [['みゃ','mya'],['みゅ','myu'],['みょ','myo']] },
                { row: 'リャ', cells: [['りゃ','rya'],['りゅ','ryu'],['りょ','ryo']] },
                { row: 'ギャ', cells: [['ぎゃ','gya'],['ぎゅ','gyu'],['ぎょ','gyo']] },
                { row: 'ジャ', cells: [['じゃ','ja'],['じゅ','ju'],['じょ','jo']] },
                { row: 'ビャ', cells: [['びゃ','bya'],['びゅ','byu'],['びょ','byo']] },
                { row: 'ピャ', cells: [['ぴゃ','pya'],['ぴゅ','pyu'],['ぴょ','pyo']] },
              ] as rowData}
                <tr>
                  <td class="px-2 py-1 border border-gray-200 text-gray-500">{rowData.row}</td>
                  {#each rowData.cells as [kana, romaji]}
                    <td class="px-2 py-1 border border-gray-200 text-center">{kana}</td>
                    <td class="px-2 py-1 border border-gray-200 text-center font-mono text-gray-600">{romaji}</td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>

      <!-- 外来語・特殊音 -->
      <div>
        <p class="text-xs font-medium text-gray-500 mb-2">外来語・特殊音</p>
        <div class="overflow-x-auto">
          <table class="text-xs border-collapse whitespace-nowrap">
            <tbody>
              {#each [
                [['ファ','fa'],['フィ','fi'],['フェ','fe'],['フォ','fo'],['ウィ','wi']],
                [['ウェ','we'],['ウォ','wo'],['ティ','ti'],['ディ','di'],['デュ','dyu']],
                [['シェ','she'],['チェ','che'],['ジェ','je'],['ニィ','ni'],['ニェ','nye']],
                VU_ENTRIES[settings.vuStyle],
              ] as row}
                <tr>
                  {#each row as [kana, romaji]}
                    <td class="px-2 py-1 border border-gray-200 text-center">{kana}</td>
                    <td class="px-2 py-1 border border-gray-200 text-center font-mono text-gray-600">{romaji}</td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>

      <!-- 特殊 -->
      <div>
        <p class="text-xs font-medium text-gray-500 mb-2">特殊文字</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 text-sm text-gray-700">
          <div class="flex gap-2 items-baseline">
            <span class="font-mono shrink-0 text-gray-800">っ</span>
            <span>次の子音を重ねる（例: きっぷ → <span class="font-mono">kippu</span>）</span>
          </div>
          <div class="flex gap-2 items-baseline">
            <span class="font-mono shrink-0 text-gray-800">ん</span>
            <span>n（b/m/p の前は設定により m）</span>
          </div>
          <div class="flex gap-2 items-baseline">
            <span class="font-mono shrink-0 text-gray-800">ー</span>
            <span>直前の母音を延長（長音の設定による）</span>
          </div>
          <div class="flex gap-2 items-baseline">
            <span class="font-mono shrink-0 text-gray-800">を</span>
            <span>o（wa ではなく o）</span>
          </div>
          <div class="flex gap-2 items-baseline">
            <span class="font-mono shrink-0 text-gray-800">ぢ・づ</span>
            <span>じ・ず と同様（ji・zu）</span>
          </div>
          <div class="flex gap-2 items-baseline">
            <span class="font-mono shrink-0 text-gray-800">ぁぃぅぇぉ 等</span>
            <span>小書き仮名は単独使用時に大きい文字と同じ変換</span>
          </div>
        </div>
      </div>

      <p class="text-xs text-gray-400">カタカナは同じルールで変換されます。外来語・特殊音および小書き仮名フォールバックはカタカナにも適用。</p>
    </section>

    <!-- 変換ルール設定の説明 -->
    <section class="space-y-4">
      <h2 class="text-base font-semibold text-gray-800">変換ルール設定について</h2>
      <dl class="space-y-4 text-sm text-gray-700">

        <div>
          <dt class="font-medium text-gray-800">プリセット</dt>
          <dd class="mt-1 space-y-0.5 pl-3 text-gray-600">
            <p><span class="font-medium">パスポート式（デフォルト）</span> — 長音省略 / mn 使い分け / 区切りなし</p>
            <p><span class="font-medium">鉄道式</span> — マクロン（ā, ō 等）/ mn 使い分け / ハイフン（n-）</p>
            <p><span class="font-medium">道路標識式</span> — 長音省略 / 常に n / 区切りなし</p>
            <p><span class="font-medium">カスタム</span> — 下記の設定を自由に組み合わせ。別プリセットへ切り替えて再びカスタムに戻すと直前の値が復元されます。</p>
          </dd>
        </div>

        <div>
          <dt class="font-medium text-gray-800">長音の表記</dt>
          <dd class="mt-1 space-y-0.5 pl-3 text-gray-600">
            <p><span class="font-medium">表記しない</span> — おう・うう等の長音を省略。例: とうきょう → <span class="font-mono">tokyo</span></p>
            <p><span class="font-medium">マクロン</span> — 伸ばす母音の上にバーを付加。例: とうきょう → <span class="font-mono">tōkyō</span></p>
            <p><span class="font-medium">母音を重ねる</span> — 母音を繰り返す。例: とうきょう → <span class="font-mono">toukyou</span></p>
          </dd>
        </div>

        <div>
          <dt class="font-medium text-gray-800">撥音「ん」</dt>
          <dd class="mt-1 space-y-0.5 pl-3 text-gray-600">
            <p><span class="font-medium">b/m/p 前はm</span> — ん の後に b, m, p が続く場合は m に変換。例: しんぶん → <span class="font-mono">shimbun</span></p>
            <p><span class="font-medium">常に n</span> — すべて n で表記。例: しんぶん → <span class="font-mono">shinbun</span></p>
          </dd>
        </div>

        <div>
          <dt class="font-medium text-gray-800">撥音＋母音・y続く場合</dt>
          <dd class="mt-1 space-y-0.5 pl-3 text-gray-600">
            <p><span class="font-medium">何もしない</span> — 区切りを入れない。例: しんよう → <span class="font-mono">shinyou</span></p>
            <p><span class="font-medium">アポストロフィ</span> — アポストロフィで区切る。例: しんよう → <span class="font-mono">shin'you</span></p>
            <p><span class="font-medium">ハイフン</span> — ハイフンで区切る。例: しんよう → <span class="font-mono">shin-you</span></p>
          </dd>
        </div>

        <div>
          <dt class="font-medium text-gray-800">半角 / 全角</dt>
          <dd class="mt-1 pl-3 text-gray-600">
            出力文字の幅を選択します。全角ではローマ字が全角文字（Ａ, ｂ 等）で出力されます。「単語区切り」のスペースも全角スペースになります。
          </dd>
        </div>

        <div>
          <dt class="font-medium text-gray-800">アルファベット</dt>
          <dd class="mt-1 space-y-0.5 pl-3 text-gray-600">
            <p><span class="font-medium">PascalCase</span> — 形態素解析またはスペースで区切られた各単語の先頭を大文字に</p>
            <p><span class="font-medium">小文字</span> — すべて小文字</p>
            <p><span class="font-medium">大文字</span> — すべて大文字</p>
          </dd>
        </div>

        <div>
          <dt class="font-medium text-gray-800">ヴ行の表記</dt>
          <dd class="mt-1 space-y-0.5 pl-3 text-gray-600">
            <p><span class="font-medium">va / vi / vu / ve / vo</span> — v を使った標準ヘボン式表記</p>
            <p><span class="font-medium">ba / bi / bu / be / bo</span> — b に置き換える表記（実際の発音に近い）</p>
            <p><span class="font-medium">bua / bui / bu / bue / buo</span> — bu + 母音 で表す表記</p>
          </dd>
        </div>

        <div>
          <dt class="font-medium text-gray-800">形態素解析 / 単語区切り</dt>
          <dd class="mt-1 pl-3 text-gray-600">
            形態素解析（kuromoji）を使うと日本語の単語境界を自動検出し、PascalCase での先頭大文字処理や「単語区切り」のスペース挿入に反映されます。単語区切りのスペースは形態素解析が有効なときのみ機能します。
          </dd>
        </div>

        <div>
          <dt class="font-medium text-gray-800">漢字変換</dt>
          <dd class="mt-1 pl-3 text-gray-600">
            kuromoji の形態素解析で漢字を読み（カタカナ）に変換してからローマ字化します。形態素解析が有効な場合は単語ごとに変換されます。
          </dd>
        </div>

      </dl>
    </section>

    <!-- その他の仕様 -->
    <section class="space-y-3 pb-8">
      <h2 class="text-base font-semibold text-gray-800">その他の仕様</h2>
      <ul class="space-y-1.5 text-sm text-gray-600 list-disc list-inside">
        <li>文字数制限: 10,000文字。超過すると自動変換を停止します（変換ボタンは引き続き使用可）。</li>
        <li>入力中は 300ms 後に自動変換されます。IME（日本語入力）の変換確定前は変換しません。</li>
        <li>設定変更時は自動変換されません。変換ボタンを押すと最新の設定で変換されます。</li>
        <li>スペース（半角・全角とも）は文の区切りとして扱い、それぞれを独立して変換します。PascalCase では各文の先頭が大文字になります。</li>
        <li>漢字変換が無効な場合、漢字はそのまま出力されます。数字・ASCII記号は常にそのまま出力されます。</li>
        <li>変換できない文字（絵文字など）はそのまま出力され、警告が表示されます。</li>
      </ul>
    </section>

  </div>

</div>
