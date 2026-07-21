<script lang="ts">
  import type { ShidasuParams } from '$lib/game/shidasu/params'
  import type { RoleName } from '$lib/game/shidasu/types'
  import { ROLE_LIST, roleBasePoint } from '$lib/game/shidasu/roles'

  let { params, oracleLevels }: {
    params: ShidasuParams
    oracleLevels: Record<RoleName, number>
  } = $props()
</script>

<div class="px-4 pb-4">
  <div class="bg-emerald-900/50 border border-emerald-800 rounded-lg p-3 space-y-1.5">
    <div class="text-xs font-bold text-emerald-300/70 tracking-widest mb-1">役ステータス</div>
    {#each ROLE_LIST as role (role.name)}
      {@const level = oracleLevels[role.name]}
      {@const score = roleBasePoint(params, role.name) * level}
      <div class="flex items-center justify-between text-xs gap-2">
        <div class="flex items-center gap-1.5 min-w-0">
          <span class="font-black text-amber-50 shrink-0">{role.label}</span>
          <span class="text-emerald-300/60 truncate">{role.desc}</span>
        </div>
        <div class="shrink-0 text-right">
          <span class="text-yellow-300 font-bold">Lv.{level}</span>
          <span class="text-emerald-100/80 ml-1">{score}点</span>
        </div>
      </div>
    {/each}
  </div>
</div>
