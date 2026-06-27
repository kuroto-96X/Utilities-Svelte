<script lang="ts">
  import { extractors } from '$lib/programming/sql-extract-format/extractors/index'
  import { scoreAndSort } from '$lib/programming/sql-extract-format/sqlDetector'
  import { placeholderize } from '$lib/programming/sql-extract-format/placeholderizer'
  import { formatSql } from '$lib/programming/sql-extract-format/formatEngine'
  import { alignSelectColumns } from '$lib/programming/sql-extract-format/alignFormatter'
  import CodeInputPanel from '$lib/programming/sql-extract-format/components/CodeInputPanel.svelte'
  import CandidateList from '$lib/programming/sql-extract-format/components/CandidateList.svelte'
  import FormatOptionsPanel from '$lib/programming/sql-extract-format/components/FormatOptionsPanel.svelte'
  import FormattedSqlOutput from '$lib/programming/sql-extract-format/components/FormattedSqlOutput.svelte'
  import type { SourceLanguage, SqlDialect, FormatMode } from '$lib/programming/sql-extract-format/types'

  let code = $state('')
  let language = $state<SourceLanguage>('csharp')
  let selectedId = $state<string | null>(null)
  let dialect = $state<SqlDialect>('sql')
  let mode = $state<FormatMode>('breakline')

  const candidates = $derived.by(() => {
    if (!code.trim()) return []
    const extractor = extractors[language]
    if (!extractor) return []
    return scoreAndSort(extractor.extract(code))
  })

  // 候補が1件かつスコア 1 以上なら自動選択
  $effect(() => {
    const list = candidates
    if (list.length === 1 && list[0].sqlScore >= 1) {
      selectedId = list[0].id
    } else if (list.length === 0) {
      selectedId = null
    }
  })

  // 候補リストが変わったとき選択が無効になったら解除
  $effect(() => {
    const ids = candidates.map(c => c.id)
    if (selectedId !== null && !ids.includes(selectedId)) {
      selectedId = null
    }
  })

  const formatResult = $derived.by(() => {
    const selected = candidates.find(c => c.id === selectedId)
    if (!selected) return null
    const placeholderResult = placeholderize(selected.rawJoined)
    let formatted = formatSql(placeholderResult.text, dialect)
    if (mode === 'align') formatted = alignSelectColumns(formatted)
    return { formatted, placeholders: placeholderResult.placeholders }
  })
</script>

<svelte:head>
  <title>SQL抽出・整形 — Utilities</title>
</svelte:head>

<div class="max-w-4xl mx-auto sm:px-4 py-6">
  <div class="bg-white sm:rounded-xl sm:border sm:border-slate-200 sm:shadow-sm p-3 sm:p-6 flex flex-col gap-6">

    <div>
      <h1 class="text-2xl font-bold text-gray-800 mb-2">SQL抽出・整形</h1>
      <div class="text-sm text-gray-600 space-y-1">
        <p>プログラムコードに埋め込まれた SQL を貼り付けると、文字列連結を結合し整形します。</p>
        <p>補間式（<span class="font-mono">{'{userId}'}</span> など）はプレースホルダーに変換されます。</p>
        <p class="text-amber-600">※正規表現ベースの簡易抽出のため、複雑なコードでは抽出が正確でない場合があります。</p>
      </div>
    </div>

    <!-- コード入力 -->
    <section>
      <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">① コードを貼り付け</h2>
      <CodeInputPanel bind:code bind:language />
    </section>

    <!-- 候補一覧 -->
    {#if candidates.length > 0 || code.trim()}
      <section>
        <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">② SQL 候補を選択</h2>
        <CandidateList {candidates} bind:selectedId />
      </section>
    {/if}

    <!-- 整形オプション -->
    {#if selectedId !== null}
      <section>
        <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">③ 整形オプション</h2>
        <FormatOptionsPanel bind:dialect bind:mode />
      </section>

      <!-- 整形結果 -->
      <section>
        <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">④ 整形結果</h2>
        <FormattedSqlOutput
          formatted={formatResult?.formatted ?? null}
          placeholders={formatResult?.placeholders ?? []}
        />
      </section>
    {/if}

  </div>
</div>
