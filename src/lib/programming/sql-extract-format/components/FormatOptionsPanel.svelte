<script lang="ts">
  import type { SqlDialect, FormatMode } from '../types'

  let {
    dialect = $bindable<SqlDialect>('sql'),
    mode = $bindable<FormatMode>('breakline'),
  } = $props()

  const dialects: { value: SqlDialect; label: string }[] = [
    { value: 'sql',        label: '汎用 SQL' },
    { value: 'tsql',       label: 'SQL Server (T-SQL)' },
    { value: 'mysql',      label: 'MySQL' },
    { value: 'postgresql', label: 'PostgreSQL' },
    { value: 'plsql',      label: 'Oracle (PL/SQL)' },
  ]

  const modes: { value: FormatMode; label: string }[] = [
    { value: 'breakline', label: '改行' },
    { value: 'align',     label: '整列' },
  ]
</script>

<div class="flex flex-wrap gap-4 items-center">
  <div class="flex items-center gap-2">
    <label class="text-sm font-medium text-gray-700 shrink-0">方言</label>
    <select
      class="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white"
      bind:value={dialect}
    >
      {#each dialects as d (d.value)}
        <option value={d.value}>{d.label}</option>
      {/each}
    </select>
  </div>

  <div class="flex items-center gap-2">
    <label class="text-sm font-medium text-gray-700 shrink-0">整形モード</label>
    <div class="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
      {#each modes as m (m.value)}
        <button
          type="button"
          class="px-3 py-1.5 transition-colors"
          class:bg-teal-600={mode === m.value}
          class:text-white={mode === m.value}
          class:text-gray-600={mode !== m.value}
          class:hover:bg-gray-50={mode !== m.value}
          onclick={() => { mode = m.value }}
        >
          {m.label}
        </button>
      {/each}
    </div>
  </div>
</div>
