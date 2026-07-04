<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import {
    animConfigSchema,
    DEFAULT_ANIM_CONFIG_FILE,
    type AnimConfigFile,
    type AnimSize,
    type NumberField,
    type ArrayField,
  } from '$lib/game/solitaire/anim.config.schema'

  // ─── State ───────────────────────────────────────────────
  let config = $state<AnimConfigFile | null>(null)
  let selectedSizes = $state<Record<string, AnimSize>>({})

  function getSizeFor(sectionKey: string): AnimSize {
    return selectedSizes[sectionKey] ?? 'medium'
  }
  let error = $state<string | null>(null)
  let flash = $state<string | null>(null)
  let flashTimer: ReturnType<typeof setTimeout> | null = null

  // collapsed sections: keyed by section name, true = collapsed
  let collapsed = $state<Record<string, boolean>>({})

  // preview element refs
  let previewEl = $state<HTMLElement | null>(null)
  let srcCardEl = $state<HTMLElement | null>(null)
  let dstCardEl = $state<HTMLElement | null>(null)

  // ─── Derived ─────────────────────────────────────────────
  let cfg = $derived.by(() => {
    const base = config ?? DEFAULT_ANIM_CONFIG_FILE
    return {
      slamDrop:        base.slamDrop[getSizeFor('slamDrop')],
      screenShake:     base.screenShake[getSizeFor('screenShake')],
      impactBounce:    base.impactBounce[getSizeFor('impactBounce')],
      sparkle:         base.sparkle[getSizeFor('sparkle')],
      scoreDelta:      base.scoreDelta[getSizeFor('scoreDelta')],
      finale:          base.finale[getSizeFor('finale')],
      confettiCracker: base.confettiCracker[getSizeFor('confettiCracker')],
      confettiSnow:    base.confettiSnow[getSizeFor('confettiSnow')],
    }
  })

  // validation: collect out-of-range fields (check all three sizes)
  let hasValidationError = $derived.by(() => {
    if (!config) return false
    const sizes: AnimSize[] = ['large', 'medium', 'small']
    for (const [sectionKey, section] of Object.entries(animConfigSchema)) {
      if (section.flat) {
        // フラットセクション: サイズなしで直接検証
        for (const [fieldKey, fieldSchema] of Object.entries(section.fields)) {
          if (fieldSchema.type === 'number') {
            const val = (config as unknown as Record<string, Record<string, number>>)[sectionKey]?.[fieldKey]
            if (val === undefined) continue
            if (val < fieldSchema.min || val > fieldSchema.max) return true
          }
        }
      } else {
        for (const size of sizes) {
          for (const [fieldKey, fieldSchema] of Object.entries(section.fields)) {
            if (fieldSchema.type === 'number') {
              const val = (config as unknown as Record<string, Record<string, Record<string, number>>>)[sectionKey]?.[size]?.[fieldKey]
              if (val === undefined) continue
              if (val < fieldSchema.min || val > fieldSchema.max) return true
            } else if (fieldSchema.type === 'array') {
              const arr = (config as unknown as Record<string, Record<string, Record<string, Array<Record<string, number>>>>>)[sectionKey]?.[size]?.[fieldKey]
              if (!Array.isArray(arr)) continue
              for (const row of arr) {
                for (const [colKey, colSchema] of Object.entries(fieldSchema.columns)) {
                  const v = row[colKey]
                  if (v === undefined) continue
                  if (v < colSchema.min || v > colSchema.max) return true
                }
              }
            }
          }
        }
      }
    }
    return false
  })

  // ─── Helpers ─────────────────────────────────────────────
  function showToast(message: string) {
    if (flashTimer) clearTimeout(flashTimer)
    flash = message
    flashTimer = setTimeout(() => { flash = null }, 2000)
  }

  function isOutOfRange(value: number, field: NumberField): boolean {
    return value < field.min || value > field.max
  }

  function getNumberValue(sectionKey: string, fieldKey: string): number {
    if (!config) return 0
    const size = getSizeFor(sectionKey)
    return (config as unknown as Record<string, Record<string, Record<string, number>>>)[sectionKey]?.[size]?.[fieldKey] ?? 0
  }

  function setNumberValue(sectionKey: string, fieldKey: string, value: number) {
    if (!config) return
    if (Number.isNaN(value)) return
    const size = getSizeFor(sectionKey)
    ;(config as unknown as Record<string, Record<string, Record<string, number>>>)[sectionKey][size][fieldKey] = value
  }

  function getArrayValue(sectionKey: string, fieldKey: string): Array<Record<string, number>> {
    if (!config) return []
    const size = getSizeFor(sectionKey)
    return (config as unknown as Record<string, Record<string, Record<string, Array<Record<string, number>>>>>)[sectionKey]?.[size]?.[fieldKey] ?? []
  }

  function setArrayCell(sectionKey: string, fieldKey: string, rowIndex: number, colKey: string, value: number) {
    if (!config) return
    if (Number.isNaN(value)) return
    const size = getSizeFor(sectionKey)
    const arr = (config as unknown as Record<string, Record<string, Record<string, Array<Record<string, number>>>>>)[sectionKey][size][fieldKey]
    arr[rowIndex][colKey] = value
  }

  function addArrayRow(sectionKey: string, fieldKey: string, schema: ArrayField) {
    if (!config) return
    const size = getSizeFor(sectionKey)
    const arr = (config as unknown as Record<string, Record<string, Record<string, Array<Record<string, number>>>>>)[sectionKey][size][fieldKey]
    const newRow: Record<string, number> = {}
    for (const colKey of Object.keys(schema.columns)) newRow[colKey] = 0
    arr.push(newRow)
  }

  function removeArrayRow(sectionKey: string, fieldKey: string, rowIndex: number) {
    if (!config) return
    const size = getSizeFor(sectionKey)
    const arr = (config as unknown as Record<string, Record<string, Record<string, Array<Record<string, number>>>>>)[sectionKey][size][fieldKey]
    if (arr.length <= 1) return
    arr.splice(rowIndex, 1)
  }

  function getFlatNumberValue(sectionKey: string, fieldKey: string): number {
    if (!config) return 0
    return (config as unknown as Record<string, Record<string, number>>)[sectionKey]?.[fieldKey] ?? 0
  }

  function setFlatNumberValue(sectionKey: string, fieldKey: string, value: number) {
    if (!config) return
    if (Number.isNaN(value)) return
    ;(config as unknown as Record<string, Record<string, number>>)[sectionKey][fieldKey] = value
  }

  function resetSection(sectionKey: string) {
    if (!config) return
    const defaults = DEFAULT_ANIM_CONFIG_FILE as Record<string, Record<string, unknown>>
    const configSection = config as Record<string, Record<string, unknown>>
    const section = animConfigSchema[sectionKey]
    if (section?.flat) {
      configSection[sectionKey] = JSON.parse(JSON.stringify(defaults[sectionKey]))
    } else {
      const size = getSizeFor(sectionKey)
      configSection[sectionKey][size] = JSON.parse(JSON.stringify((defaults[sectionKey] as Record<string, unknown>)[size]))
    }
  }

  // ─── API ─────────────────────────────────────────────────
  async function loadConfig(toast = false) {
    try {
      const res = await fetch('/api/admin/anim-config')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      config = await res.json() as AnimConfigFile
      error = null
      if (toast) showToast('リロードしました')
    } catch {
      error = 'アニメーション設定APIに接続できません。npm run dev で起動してください。'
      // Fall back to default so UI is still usable
      if (!config) config = JSON.parse(JSON.stringify(DEFAULT_ANIM_CONFIG_FILE))
    }
  }

  async function save() {
    if (!config) return
    try {
      const res = await fetch('/api/admin/anim-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      showToast('保存しました')
    } catch {
      error = '保存に失敗しました'
    }
  }

  // Load on mount
  onMount(() => loadConfig())

  onDestroy(() => {
    if (flashTimer) clearTimeout(flashTimer)
  })

  // ─── Preview animations ──────────────────────────────────
  const SPARK_COLORS = ['#f59e0b', '#ef4444', '#8b5cf6', '#10b981', '#3b82f6', '#f97316', '#ec4899']
  const SPARK_CHARS  = ['★', '✦', '♦', '•', '◆', '✸']

  function previewSlamDrop() {
    if (!srcCardEl || !dstCardEl) return
    const srcEl = srcCardEl
    const dstEl = dstCardEl
    const src = srcEl.getBoundingClientRect()
    const dst = dstEl.getBoundingClientRect()
    const sc = cfg.slamDrop
    const tx = dst.left - src.left
    const ty = dst.top - src.top
    srcEl.animate([
      { transform: 'translate(0,0) scale(1) rotate(0deg)', offset: 0, easing: 'cubic-bezier(0.2,0,0.4,1)' },
      { transform: `translate(${tx * 0.02}px,${ty * 0.02}px) scale(${sc.peakScale}) rotate(${sc.peakRotateDeg}deg) translateY(${sc.peakLiftPx}px)`, offset: sc.peakAt, easing: 'cubic-bezier(0.8,0,1,1)' },
      { transform: `translate(${tx * 0.99}px,${ty * 0.99}px) scale(${sc.landScale}) rotate(${sc.landRotateDeg}deg)`, offset: sc.landAt, easing: 'ease-out' },
      { transform: `translate(${tx}px,${ty}px) scale(1) rotate(0deg)`, offset: 1 },
    ], { duration: sc.durationMs, easing: 'linear', fill: 'none' })
  }

  function previewScreenShake() {
    if (!previewEl) return
    const c = cfg.screenShake
    previewEl.animate([
      { transform: 'translate(0,0) rotate(0deg)' },
      ...c.frames.map(f => ({ transform: `translate(${f.x}px,${f.y}px) rotate(${f.rotateDeg}deg)` })),
      { transform: 'translate(0,0) rotate(0deg)' },
    ], { duration: c.durationMs, easing: 'ease-out', fill: 'none' })
  }

  function previewImpactBounce() {
    if (!dstCardEl) return
    const c = cfg.impactBounce
    dstCardEl.animate([
      { transform: 'scale(1)' },
      { transform: `scale(${1 + c.singleMaxScale})` },
      { transform: `scale(${1 + c.singleMaxScale * 0.1})` },
      { transform: 'scale(1)' },
    ], { duration: 400, easing: 'ease-out', fill: 'none' })
  }

  function previewSparkle() {
    if (!previewEl) return
    const el = previewEl
    const { count, radiusPx, durationMs } = cfg.sparkle
    const rect = el.getBoundingClientRect()
    const cx = rect.width / 2
    const cy = rect.height / 2
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4
      const dist = radiusPx * (0.5 + Math.random() * 0.5)
      const dx = Math.cos(angle) * dist
      const dy = Math.sin(angle) * dist
      const span = document.createElement('span')
      span.textContent = SPARK_CHARS[Math.floor(Math.random() * SPARK_CHARS.length)]
      span.style.cssText = `position:absolute; left:${cx}px; top:${cy}px; color:${SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)]}; font-size:${10 + Math.random() * 11}px; pointer-events:none; z-index:10;`
      el.appendChild(span)
      const anim = span.animate([
        { transform: 'translate(-50%,-50%) scale(0)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1)`, opacity: 1, offset: 0.3 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.5)`, opacity: 0, offset: 1 },
      ], { duration: durationMs, delay: Math.floor(Math.random() * 80), easing: 'ease-out', fill: 'none' })
      anim.onfinish = () => span.remove()
    }
  }

  function previewScoreDelta() {
    if (!previewEl) return
    const el = previewEl
    const { durationMs } = cfg.scoreDelta
    const span = document.createElement('div')
    span.textContent = '+100'
    span.style.cssText = `position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); font-size:1.25rem; font-weight:bold; color:#10b981; pointer-events:none; z-index:10;`
    el.appendChild(span)
    const anim = span.animate([
      { opacity: 1, transform: 'translate(-50%,-50%) translateY(0)' },
      { opacity: 0, transform: 'translate(-50%,-50%) translateY(-40px)' },
    ], { duration: durationMs, easing: 'ease-out', fill: 'none' })
    anim.onfinish = () => span.remove()
  }

  async function previewFinale() {
    if (!srcCardEl || !dstCardEl || !previewEl) return
    const srcEl = srcCardEl
    const dstEl = dstCardEl
    const fc = cfg.finale
    const sc = cfg.slamDrop
    const src = srcEl.getBoundingClientRect()
    const dst = dstEl.getBoundingClientRect()
    const tx = dst.left - src.left
    const ty = dst.top - src.top

    const spinDeg = fc.spinRotations * 360
    const totalDuration = fc.spinDurationMs + fc.holdDurationMs + sc.durationMs
    const spinEnd   = fc.spinDurationMs / totalDuration
    const holdEnd   = (fc.spinDurationMs + fc.holdDurationMs) / totalDuration
    const slamRange = 1 - holdEnd
    const landOffset = holdEnd + slamRange * sc.landAt
    const slamTilt = tx >= 0 ? sc.peakRotateDeg : -sc.peakRotateDeg

    const anim = srcEl.animate([
      { transform: 'translate(0,0) translateY(0px) scale(1) rotate(0deg)',                                                                            offset: 0,          easing: 'cubic-bezier(0.2,0,0.4,1)' },
      { transform: `translate(${tx*0.02}px,${ty*0.02}px) translateY(${sc.peakLiftPx}px) scale(${fc.spinPeakScale}) rotate(${spinDeg}deg)`,           offset: spinEnd,    easing: 'ease-in-out' },
      { transform: `translate(${tx*0.02}px,${ty*0.02}px) translateY(${sc.peakLiftPx}px) scale(${fc.spinPeakScale}) rotate(${spinDeg}deg)`,           offset: holdEnd,    easing: 'cubic-bezier(0.8,0,1,1)' },
      { transform: `translate(${tx*0.99}px,${ty*0.99}px) translateY(0px) scale(${sc.landScale}) rotate(${spinDeg + slamTilt}deg)`,                  offset: landOffset, easing: 'ease-out' },
      { transform: `translate(${tx}px,${ty}px) translateY(0px) scale(1) rotate(${spinDeg}deg)`,                                                      offset: 1 },
    ], { duration: totalDuration, easing: 'linear', fill: 'none' })

    await new Promise<void>(resolve => { anim.onfinish = () => resolve() })
    previewImpactBounce()
    for (let i = 0; i < fc.shakeCount; i++) {
      if (i > 0) await new Promise<void>(r => setTimeout(r, fc.shakeIntervalMs))
      previewScreenShake()
    }
  }

  const CONFETTI_COLORS = ['#f43f5e','#f97316','#eab308','#22c55e','#3b82f6','#a855f7','#ec4899','#06b6d4','#fbbf24']
  interface ConfettiParticle { x: number; y: number; vx: number; vy: number; rotation: number; rotSpeed: number; color: string; w: number; h: number; life: number }

  // directionDeg: 0=上, 90=右, 180=下, 270=左（時計回り）
  function createCrackerBurst(ox: number, oy: number, directionDeg: number, speed: number, spreadDeg: number, count: number): ConfettiParticle[] {
    return Array.from({ length: count }, () => {
      const angleDeg = directionDeg + (Math.random() - 0.5) * spreadDeg
      const angleRad = angleDeg * Math.PI / 180
      const s = speed * (0.4 + Math.random() * 0.6)
      return {
        x: ox + (Math.random() - 0.5) * 20,
        y: oy + (Math.random() - 0.5) * 5,
        vx: s * Math.sin(angleRad),
        vy: -s * Math.cos(angleRad),
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.3,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        w: 7 + Math.random() * 9, h: 3 + Math.random() * 5,
        life: 180 + Math.random() * 80,
      }
    })
  }

  function runConfettiPreview(withCrackers: boolean, withSnow: boolean) {
    const { count: bc, speed: spd, spreadDeg: spread } = cfg.confettiCracker
    const sr = cfg.confettiSnow.rate
    const canvas = document.createElement('canvas')
    const W = window.innerWidth, H = window.innerHeight
    canvas.width = W; canvas.height = H
    canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;'
    document.body.appendChild(canvas)
    const ctx = canvas.getContext('2d')!

    const bursts: ConfettiParticle[] = withCrackers ? [
      ...createCrackerBurst(W * 0.05, H * 0.92,  23, spd, spread, bc),
      ...createCrackerBurst(W * 0.95, H * 0.92, 337, spd, spread, bc),
      ...createCrackerBurst(W * 0.5,  H * 0.98,   0, spd, spread, bc),
      ...createCrackerBurst(W * 0.05, H * 0.08, 157, spd, spread, bc),
      ...createCrackerBurst(W * 0.95, H * 0.08, 203, spd, spread, bc),
      ...createCrackerBurst(W * 0.5,  H * 0.02, 180, spd, spread, bc),
    ] : []
    const snow: ConfettiParticle[] = []
    const snowEndMs = withSnow ? Date.now() + 3000 : 0

    function renderFrame() {
      ctx.clearRect(0, 0, W, H)
      const snowActive = withSnow && Date.now() < snowEndMs
      if (snowActive) {
        for (let i = 0; i < sr; i++) {
          snow.push({ x: Math.random() * W, y: -15, vx: (Math.random() - 0.5) * 2.5, vy: 2 + Math.random() * 2.5,
            rotation: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 0.15,
            color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
            w: 7 + Math.random() * 8, h: 3 + Math.random() * 5, life: 999 })
        }
      }
      let alive = 0
      for (const p of bursts) {
        if (p.life <= 0) continue
        alive++
        p.vy += 0.38; p.vx *= 0.992; p.x += p.vx; p.y += p.vy; p.rotation += p.rotSpeed; p.life--
        ctx.save(); ctx.globalAlpha = Math.min(1, p.life / 45)
        ctx.translate(p.x, p.y); ctx.rotate(p.rotation)
        ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore()
      }
      for (let i = snow.length - 1; i >= 0; i--) {
        const p = snow[i]
        if (p.y > H + 20) { snow.splice(i, 1); continue }
        alive++
        p.vy += 0.06; p.vx += (Math.random() - 0.5) * 0.1; p.x += p.vx; p.y += p.vy; p.rotation += p.rotSpeed
        ctx.save(); ctx.globalAlpha = 0.9
        ctx.translate(p.x, p.y); ctx.rotate(p.rotation)
        ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore()
      }
      if (alive > 0 || snowActive) requestAnimationFrame(renderFrame)
      else canvas.remove()
    }
    requestAnimationFrame(renderFrame)
  }

  const previewCracker  = () => runConfettiPreview(true,  false)
  const previewSnow     = () => runConfettiPreview(false, true)
  const previewConfetti = () => runConfettiPreview(true,  true)
</script>

<!-- ========================================================
     MAIN LAYOUT
     ======================================================== -->
<div class="px-4 py-8 max-w-7xl mx-auto">

  <a href="/admin" class="text-xs text-slate-400 hover:text-teal-600 mb-4 inline-block">← 管理ページ一覧</a>

  <!-- Header -->
  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold text-slate-800">アニメーション設定</h1>
    <div class="flex gap-2">
      <button
        onclick={() => loadConfig(true)}
        class="text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
      >
        リロード
      </button>
      {#if hasValidationError}
        <p class="text-xs text-red-600 self-center">入力値が範囲外です</p>
      {/if}
      <button
        onclick={save}
        disabled={hasValidationError || !config}
        class="text-sm px-3 py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        保存
      </button>
    </div>
  </div>

  <!-- Error banner -->
  {#if error}
    <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
      {error}
    </div>
  {/if}

  <!-- Two-column body -->
  <div class="lg:grid lg:grid-cols-2 lg:gap-6">

    <!-- ── Left: Settings panel ── -->
    <div class="space-y-4 overflow-y-auto">
      {#if config}
        {#each Object.entries(animConfigSchema) as [sectionKey, section], si (sectionKey)}
          {#if si > 0}
            <hr class="border-slate-200" />
          {/if}

          <div class="bg-white border border-slate-200 rounded-xl shadow-sm">
            <!-- Section header (collapsible) -->
            <button
              onclick={() => { collapsed[sectionKey] = !collapsed[sectionKey] }}
              class="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 rounded-xl transition-colors"
            >
              <span class="font-semibold text-slate-700 text-sm">{section.label}</span>
              <span class="text-slate-400 text-xs">{collapsed[sectionKey] ? '▸' : '▾'}</span>
            </button>

            {#if !collapsed[sectionKey]}
              <div class="px-4 pb-4 space-y-3 border-t border-slate-100">

                {#if !section.flat}
                <!-- Size tabs -->
                <div class="flex gap-1 mb-3 pt-3">
                  {#each (['large', 'medium', 'small'] as AnimSize[]) as size}
                    <button
                      onclick={() => { selectedSizes[sectionKey] = size }}
                      class="text-xs px-2.5 py-1 rounded-md border transition-colors {getSizeFor(sectionKey) === size ? 'bg-teal-600 text-white border-teal-600' : 'border-slate-200 text-slate-500 hover:border-slate-300'}"
                    >
                      {size === 'large' ? '大' : size === 'medium' ? '中' : '小'}
                    </button>
                  {/each}
                </div>
                {/if}

                {#each Object.entries(section.fields) as [fieldKey, fieldSchema] (fieldKey)}

                  {#if fieldSchema.type === 'number'}
                    <!-- Number field -->
                    {@const val = section.flat ? getFlatNumberValue(sectionKey, fieldKey) : getNumberValue(sectionKey, fieldKey)}
                    {@const outOfRange = isOutOfRange(val, fieldSchema)}
                    <div class="flex items-center gap-2 pt-2">
                      <span class="text-xs text-slate-500 w-28 shrink-0">{fieldSchema.label}</span>
                      <input
                        type="range"
                        min={fieldSchema.min}
                        max={fieldSchema.max}
                        step={fieldSchema.step}
                        value={val}
                        oninput={(e) => section.flat
                          ? setFlatNumberValue(sectionKey, fieldKey, parseFloat((e.target as HTMLInputElement).value))
                          : setNumberValue(sectionKey, fieldKey, parseFloat((e.target as HTMLInputElement).value))}
                        class="flex-1 h-1.5 accent-teal-600 cursor-pointer"
                      />
                      <input
                        type="number"
                        min={fieldSchema.min}
                        max={fieldSchema.max}
                        step={fieldSchema.step}
                        value={val}
                        oninput={(e) => section.flat
                          ? setFlatNumberValue(sectionKey, fieldKey, parseFloat((e.target as HTMLInputElement).value))
                          : setNumberValue(sectionKey, fieldKey, parseFloat((e.target as HTMLInputElement).value))}
                        class="w-20 text-xs text-right border rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 {outOfRange ? 'border-red-400 bg-red-50 ring-red-400' : 'border-slate-200 focus:ring-teal-400'}"
                      />
                      {#if fieldSchema.unit}
                        <span class="text-xs text-slate-400 w-8 shrink-0">{fieldSchema.unit}</span>
                      {:else}
                        <span class="w-8 shrink-0"></span>
                      {/if}
                    </div>

                  {:else if fieldSchema.type === 'array'}
                    <!-- Array field (table) -->
                    {@const rows = getArrayValue(sectionKey, fieldKey)}
                    <div class="pt-3">
                      <p class="text-xs font-medium text-slate-500 mb-2">{fieldSchema.label}</p>
                      <div class="overflow-x-auto">
                        <table class="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
                          <thead>
                            <tr class="bg-slate-50 text-slate-500">
                              <th class="px-2 py-1.5 text-left font-medium w-6">#</th>
                              {#each Object.entries(fieldSchema.columns) as [colKey, colSchema] (colKey)}
                                <th class="px-2 py-1.5 text-center font-medium">
                                  {colSchema.label}
                                  {#if colSchema.unit}
                                    <span class="text-slate-400">({colSchema.unit})</span>
                                  {/if}
                                </th>
                              {/each}
                              <th class="px-2 py-1.5 w-8"></th>
                            </tr>
                          </thead>
                          <tbody class="divide-y divide-slate-100">
                            {#each rows as row, ri (ri)}
                              <tr class="hover:bg-slate-50">
                                <td class="px-2 py-1 text-slate-400 text-center">{ri}</td>
                                {#each Object.entries(fieldSchema.columns) as [colKey, colSchema] (colKey)}
                                  {@const cv = row[colKey] ?? 0}
                                  {@const cellOOR = cv < colSchema.min || cv > colSchema.max}
                                  <td class="px-1 py-1">
                                    <input
                                      type="number"
                                      min={colSchema.min}
                                      max={colSchema.max}
                                      step={colSchema.step}
                                      value={cv}
                                      oninput={(e) => setArrayCell(sectionKey, fieldKey, ri, colKey, parseFloat((e.target as HTMLInputElement).value))}
                                      class="w-full text-xs text-center border rounded px-1 py-0.5 focus:outline-none focus:ring-1 {cellOOR ? 'border-red-400 bg-red-50 ring-red-400' : 'border-slate-200 focus:ring-teal-400'}"
                                    />
                                  </td>
                                {/each}
                                <td class="px-1 py-1 text-center">
                                  <button
                                    onclick={() => removeArrayRow(sectionKey, fieldKey, ri)}
                                    disabled={rows.length <= 1}
                                    class="text-slate-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-1"
                                    title="行を削除"
                                  >×</button>
                                </td>
                              </tr>
                            {/each}
                          </tbody>
                        </table>
                      </div>
                      <button
                        onclick={() => addArrayRow(sectionKey, fieldKey, fieldSchema)}
                        class="mt-2 text-xs px-3 py-1 rounded border border-dashed border-slate-300 text-slate-500 hover:border-teal-400 hover:text-teal-600 transition-colors"
                      >
                        + 行追加
                      </button>
                    </div>
                  {/if}

                {/each}

                <!-- Reset section button -->
                <div class="pt-2 flex justify-end">
                  <button
                    onclick={() => resetSection(sectionKey)}
                    class="text-xs px-3 py-1 rounded border border-slate-200 text-slate-400 hover:border-amber-400 hover:text-amber-600 transition-colors"
                  >
                    {section.flat ? '' : (getSizeFor(sectionKey) === 'large' ? '大' : getSizeFor(sectionKey) === 'medium' ? '中' : '小') + 'を'}デフォルトに戻す
                  </button>
                </div>

              </div>
            {/if}
          </div>
        {/each}

      {:else if !error}
        <p class="text-slate-500 text-sm">読み込み中...</p>
      {/if}
    </div>

    <!-- ── Right: Preview area ── -->
    <div class="mt-6 lg:mt-0 lg:sticky lg:top-4 self-start">
      <h2 class="text-sm font-semibold text-slate-600 mb-3">プレビュー</h2>

      <!-- Preview frame -->
      <div
        bind:this={previewEl}
        id="preview-wrapper"
        class="relative rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 overflow-hidden"
        style="min-height: 280px; height: 280px;"
      >
        <!-- Src card (top-left) -->
        <div
          bind:this={srcCardEl}
          id="preview-card-src"
          class="absolute top-24 left-16 w-12 h-16 bg-green-600 rounded-md flex items-center justify-center text-white text-xs font-bold shadow-md select-none"
        >
          ♠A
        </div>
        <!-- Dst card (bottom-right) -->
        <div
          bind:this={dstCardEl}
          id="preview-card-dst"
          class="absolute bottom-4 right-4 w-12 h-16 bg-green-700 rounded-md flex items-center justify-center text-white text-xs font-bold shadow-md select-none"
        >
          ♠2
        </div>
      </div>

      <!-- Play buttons -->
      <div class="mt-4 flex flex-wrap gap-2">
        <button
          onclick={previewSlamDrop}
          class="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
        >
          ▶ SlamDrop
        </button>
        <button
          onclick={previewScreenShake}
          class="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
        >
          ▶ ScreenShake
        </button>
        <button
          onclick={previewImpactBounce}
          class="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
        >
          ▶ ImpactBounce
        </button>
        <button
          onclick={previewSparkle}
          class="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
        >
          ▶ Sparkle
        </button>
        <button
          onclick={previewScoreDelta}
          class="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
        >
          ▶ ScoreDelta
        </button>
        <button
          onclick={previewFinale}
          class="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
        >
          ▶ Finale
        </button>
        <button
          onclick={previewCracker}
          class="text-xs px-3 py-1.5 rounded-lg bg-pink-500 text-white hover:bg-pink-600 transition-colors"
        >
          🎉 Cracker
        </button>
        <button
          onclick={previewSnow}
          class="text-xs px-3 py-1.5 rounded-lg bg-pink-500 text-white hover:bg-pink-600 transition-colors"
        >
          ❄️ Snow
        </button>
        <button
          onclick={previewConfetti}
          class="text-xs px-3 py-1.5 rounded-lg bg-pink-500 text-white hover:bg-pink-600 transition-colors"
        >
          🎊 Both
        </button>
      </div>
    </div>

  </div><!-- end two-col -->
</div>

<!-- Toast -->
{#if flash}
  <div class="fixed bottom-6 right-6 bg-slate-800 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-50">
    {flash}
  </div>
{/if}
