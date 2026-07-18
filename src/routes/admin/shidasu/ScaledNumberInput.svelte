<script lang="ts">
  let { value, onChange }: { value: number; onChange: (v: number) => void } = $props()
</script>

<div class="mt-1 flex items-center gap-1">
  <input
    type="number"
    min="0"
    step="1"
    value={value / 10}
    oninput={(e) => onChange(Number((e.target as HTMLInputElement).value) * 10)}
    class="w-full border border-slate-200 rounded px-2 py-1 text-sm"
  />
  <span class="text-slate-400 font-mono text-sm select-none" title="点数系パラメータは常に10の倍数">0</span>
</div>
