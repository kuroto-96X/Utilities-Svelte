<script lang="ts">
  import type { ShidasuParams } from '$lib/game/shidasu/params'
  import type { RoleName } from '$lib/game/shidasu/types'
  import { ROLE_LIST, roleBasePoint } from '$lib/game/shidasu/roles'

  let { params, oracleLevels, onSetLevel }: {
    params: ShidasuParams
    oracleLevels: Record<RoleName, number>
    onSetLevel: (roleName: RoleName, level: number) => void
  } = $props()
</script>

<div class="space-y-1">
  <h2 class="text-sm font-bold text-slate-700 sticky top-0 bg-slate-50">役ステータス(レベル調整可)</h2>
  {#each ROLE_LIST as role (role.name)}
    {@const level = oracleLevels[role.name]}
    {@const score = roleBasePoint(params, role.name) * level}
    <div class="flex items-center justify-between gap-2 text-xs">
      <span class="font-semibold text-slate-700">{role.label}</span>
      <div class="flex items-center gap-1.5 shrink-0">
        <input
          type="number"
          min="1"
          step="1"
          value={level}
          onchange={(e) => onSetLevel(role.name, Number((e.currentTarget as HTMLInputElement).value))}
          class="w-14 border border-slate-200 rounded px-1 py-0.5"
        />
        <span class="text-slate-400">{score}点</span>
      </div>
    </div>
  {/each}
</div>
