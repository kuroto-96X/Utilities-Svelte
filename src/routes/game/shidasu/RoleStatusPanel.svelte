<script lang="ts">
  import type { ShidasuParams } from '$lib/game/shidasu/params'
  import type { RoleName } from '$lib/game/shidasu/types'
  import type { SealedRoleEffect } from '$lib/game/shidasu/engine'
  import { ROLE_LIST, roleBasePoint } from '$lib/game/shidasu/roles'

  let { params, oracleLevels, sealedRoleEffect = { zeroRoles: [], oracleBaselineRole: null } }: {
    params: ShidasuParams
    oracleLevels: Record<RoleName, number>
    sealedRoleEffect?: SealedRoleEffect
  } = $props()

  // 妨害「役封印」「天啓封印(対象がoracleの場合)」中は、run.oracleLevelsそのものは
  // 書き換わらないまま実際のスコアリングだけが変化する。表示が実態と食い違わないよう、
  // ここでも同じ実効レベルを算出して使う(実際の適用ロジックはengine.tsのresolveSealedRoleEffect)。
  function effectiveLevel(roleName: RoleName, storedLevel: number): number {
    if (sealedRoleEffect.zeroRoles.includes(roleName)) return 0
    if (sealedRoleEffect.oracleBaselineRole === roleName) return 1
    const mult = sealedRoleEffect.multipliers?.[roleName]
    return mult !== undefined ? storedLevel * mult : storedLevel
  }
</script>

<div class="px-4 pb-4">
  <div class="bg-emerald-900/50 border border-emerald-800 rounded-lg p-3 space-y-1.5">
    <div class="text-xs font-bold text-emerald-300/70 tracking-widest mb-1">役ステータス</div>
    {#each ROLE_LIST as role (role.name)}
      {@const storedLevel = oracleLevels[role.name]}
      {@const level = effectiveLevel(role.name, storedLevel)}
      {@const score = roleBasePoint(params, role.name) * level}
      {@const sealed = level !== storedLevel}
      <div class="flex items-center justify-between text-xs gap-2">
        <div class="flex items-center gap-1.5 min-w-0">
          <span class="font-black text-amber-50 shrink-0">{role.label}</span>
          <span class="text-emerald-300/60 truncate">{role.desc}</span>
        </div>
        <div class="shrink-0 text-right">
          <span class="font-bold {sealed ? 'text-rose-400' : 'text-yellow-300'}">Lv.{level}</span>
          <span class="ml-1 {sealed ? 'text-rose-300' : 'text-emerald-100/80'}">{score}点</span>
        </div>
      </div>
    {/each}
  </div>
</div>
