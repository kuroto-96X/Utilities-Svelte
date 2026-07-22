<script lang="ts">
  import type { ShidasuParams } from '$lib/game/shidasu/params'

  let { config }: { config: ShidasuParams } = $props()
</script>

<section class="bg-white border border-slate-200 rounded-xl p-4">
  <h2 class="font-semibold text-slate-700 text-sm mb-3">ボス</h2>
  <div class="grid grid-cols-3 gap-3">
    <label class="text-xs text-slate-500">
      小凶の名前
      <input type="text" bind:value={config.bossTiers.shoukyou.name} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
    </label>
    <label class="text-xs text-slate-500">
      中凶の名前
      <input type="text" bind:value={config.bossTiers.chuukyou.name} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
    </label>
    <label class="text-xs text-slate-500">
      大凶の名前
      <input type="text" bind:value={config.bossTiers.taikyou.name} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
    </label>
  </div>
  <p class="text-xs text-slate-400 mt-3">
    各階級のボス制約候補(名前・パラメータ・説明文・階級の割り当て)は
    <a href="/admin/shidasu-bosses" class="text-teal-600 hover:underline">ボス候補パラメータ設定ページ</a>
    で編集します。
  </p>
</section>
