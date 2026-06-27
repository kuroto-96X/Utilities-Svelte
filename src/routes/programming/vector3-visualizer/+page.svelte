<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { browser } from '$app/environment'
  import { fmt, fv, getDotInterpretation, type Tab, type ResultRow } from '$lib/programming/vector3Visualizer'

  // ── State ────────────────────────────────────────────────────────────
  let ax = $state('1'), ay = $state('0'), az = $state('0')
  let bx = $state('0'), by = $state('1'), bz = $state('0')
  let currentTab = $state<Tab>('dot')
  let lerpT = $state(0.5)
  let copiedRow = $state<string | null>(null)
  let sceneReady = $state(false)
  let copyTimer: ReturnType<typeof setTimeout> | null = null

  // Three.js refs（onMount 後にセット）
  let canvasEl: HTMLCanvasElement
  let animId = 0
  let threeRenderer: { dispose: () => void } | null = null
  let removeWindowListeners: (() => void) | null = null
  let updateArrows: ((ax: number, ay: number, az: number, bx: number, by: number, bz: number, tab: Tab, t: number) => void) | null = null
  let cleanupArrows: (() => void) | null = null

  // ── ベクトル成分（$derived）────────────────────────────────────────
  const p = (s: string) => parseFloat(s) || 0
  const vaX = $derived(p(ax))
  const vaY = $derived(p(ay))
  const vaZ = $derived(p(az))
  const vbX = $derived(p(bx))
  const vbY = $derived(p(by))
  const vbZ = $derived(p(bz))

  // ── 平面数学ヘルパー（SSR セーフ）───────────────────────────────────
  function dot3(ax: number, ay: number, az: number, bx: number, by: number, bz: number) {
    return ax * bx + ay * by + az * bz
  }
  function cross3(ax: number, ay: number, az: number, bx: number, by: number, bz: number) {
    return { x: ay * bz - az * by, y: az * bx - ax * bz, z: ax * by - ay * bx }
  }
  function mag3(x: number, y: number, z: number) {
    return Math.sqrt(x * x + y * y + z * z)
  }
  function norm3(x: number, y: number, z: number) {
    const m = mag3(x, y, z)
    return m < 1e-6 ? { x: 0, y: 0, z: 0 } : { x: x / m, y: y / m, z: z / m }
  }
  function lerp3(ax: number, ay: number, az: number, bx: number, by: number, bz: number, t: number) {
    return { x: ax + (bx - ax) * t, y: ay + (by - ay) * t, z: az + (bz - az) * t }
  }
  function angleTo3(ax: number, ay: number, az: number, bx: number, by: number, bz: number): number {
    const ma = mag3(ax, ay, az), mb = mag3(bx, by, bz)
    if (ma < 1e-6 || mb < 1e-6) return 0
    return Math.acos(Math.max(-1, Math.min(1, dot3(ax, ay, az, bx, by, bz) / (ma * mb)))) * 180 / Math.PI
  }
  function dist3(ax: number, ay: number, az: number, bx: number, by: number, bz: number): number {
    return mag3(ax - bx, ay - by, az - bz)
  }

  // ── タブ設定 ─────────────────────────────────────────────────────────
  const tabs: { id: Tab; label: string }[] = [
    { id: 'dot',    label: '内積 (Dot)' },
    { id: 'cross',  label: '外積 (Cross)' },
    { id: 'angle',  label: '角度 / 距離' },
    { id: 'lerp',   label: 'Lerp' },
    { id: 'single', label: '正規化 / 大きさ' },
  ]

  // ── 演算結果（$derived）──────────────────────────────────────────────
  const results = $derived.by((): { rows: ResultRow[]; hint: string } => {
    const [ax, ay, az] = [vaX, vaY, vaZ]
    const [bx, by, bz] = [vbX, vbY, vbZ]

    if (currentTab === 'dot') {
      const d = dot3(ax, ay, az, bx, by, bz)
      const ma = mag3(ax, ay, az), mb = mag3(bx, by, bz)
      const cosA = (ma > 1e-6 && mb > 1e-6) ? d / (ma * mb) : 0
      const angle = Math.acos(Math.max(-1, Math.min(1, cosA))) * 180 / Math.PI
      return {
        rows: [
          { label: 'Vector3.Dot(A, B)', value: fmt(d, 4).toString(), copyable: true },
          { label: '角度', value: `${fmt(angle, 1)}°`, copyable: false },
          { label: '解釈', value: getDotInterpretation(cosA), copyable: false },
        ],
        hint: 'Dot積が正→同方向寄り / 0→直角 / 負→逆方向寄り。視野角・前後判定に使える。',
      }
    }
    if (currentTab === 'cross') {
      const c = cross3(ax, ay, az, bx, by, bz)
      return {
        rows: [
          { label: 'Vector3.Cross(A, B)', value: `new Vector3${fv(c.x, c.y, c.z)}`, copyable: true },
          { label: 'magnitude', value: fmt(mag3(c.x, c.y, c.z), 4).toString(), copyable: false },
        ],
        hint: '緑の矢印が外積ベクトル（A・Bに直交）。法線・回転軸の計算に使える。',
      }
    }
    if (currentTab === 'angle') {
      return {
        rows: [
          { label: 'Vector3.Angle(A, B)',    value: `${fmt(angleTo3(ax, ay, az, bx, by, bz), 2)}f`, copyable: true },
          { label: 'Vector3.Distance(A, B)', value: `${fmt(dist3(ax, ay, az, bx, by, bz), 4)}f`,    copyable: true },
        ],
        hint: '',
      }
    }
    if (currentTab === 'lerp') {
      const l = lerp3(ax, ay, az, bx, by, bz, lerpT)
      return {
        rows: [
          { label: `Vector3.Lerp(A, B, ${fmt(lerpT, 2)}f)`, value: `new Vector3${fv(l.x, l.y, l.z)}`, copyable: true },
        ],
        hint: '緑の矢印が補間結果。t=0でA、t=1でB。スライダーで確認できる。',
      }
    }
    // single
    const mag = mag3(ax, ay, az)
    const n = norm3(ax, ay, az)
    return {
      rows: [
        { label: 'magnitude',  value: `${fmt(mag, 4)}f`, copyable: true },
        { label: 'normalized', value: `new Vector3${fv(n.x, n.y, n.z)}`, copyable: true },
      ],
      hint: '緑の矢印が正規化ベクトル（長さ1）。方向のみ使いたいときに。',
    }
  })

  // ── コピー ───────────────────────────────────────────────────────────
  async function copyRow(label: string, text: string) {
    try { await navigator.clipboard.writeText(text) } catch { return }
    if (copyTimer) clearTimeout(copyTimer)
    copiedRow = label
    copyTimer = setTimeout(() => { copiedRow = null }, 1200)
  }

  // ── Three.js（クライアント専用）──────────────────────────────────────
  onMount(async () => {
    const THREE = await import('three')

    // Renderer
    const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, alpha: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(canvasEl.clientWidth, canvasEl.clientHeight, false)
    renderer.setClearColor(0x0a0a12, 1)
    threeRenderer = renderer

    // Scene
    const scene = new THREE.Scene()

    // Grid（XZ平面）
    scene.add(new THREE.GridHelper(6, 6, 0x333366, 0x222244))

    // 軸ライン
    const makeAxisLine = (from: THREE.Vector3, to: THREE.Vector3, color: number) => {
      const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6 })
      const geo = new THREE.BufferGeometry().setFromPoints([from, to])
      return new THREE.Line(geo, mat)
    }
    scene.add(makeAxisLine(new THREE.Vector3(-3, 0, 0), new THREE.Vector3(3, 0, 0), 0xff4444))
    scene.add(makeAxisLine(new THREE.Vector3(0, -3, 0), new THREE.Vector3(0, 3, 0), 0x44ff44))
    scene.add(makeAxisLine(new THREE.Vector3(0, 0, -3), new THREE.Vector3(0, 0, 3), 0x4444ff))

    // 軸ラベル（CanvasTexture）
    const makeLabel = (text: string, color: string): THREE.Sprite => {
      const c = document.createElement('canvas')
      c.width = 64; c.height = 64
      const ctx = c.getContext('2d')!
      ctx.fillStyle = color
      ctx.font = 'bold 48px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(text, 32, 32)
      const mat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true })
      const sprite = new THREE.Sprite(mat)
      sprite.scale.set(0.4, 0.4, 1)
      return sprite
    }
    const xl = makeLabel('X', '#ff6666'); xl.position.set(3.3, 0, 0); scene.add(xl)
    const yl = makeLabel('Y', '#66ff66'); yl.position.set(0, 3.3, 0); scene.add(yl)
    const zl = makeLabel('Z', '#6666ff'); zl.position.set(0, 0, 3.3); scene.add(zl)

    // カメラ（球面座標で管理）
    const camera = new THREE.PerspectiveCamera(45, canvasEl.clientWidth / canvasEl.clientHeight, 0.1, 100)
    const sph = { theta: 0.8, phi: 1.0, r: 5 }
    const positionCamera = () => {
      camera.position.set(
        sph.r * Math.sin(sph.phi) * Math.sin(sph.theta),
        sph.r * Math.cos(sph.phi),
        sph.r * Math.sin(sph.phi) * Math.cos(sph.theta),
      )
      camera.lookAt(0, 0, 0)
    }
    positionCamera()

    // ArrowHelper 管理
    let arrowHelpers: THREE.ArrowHelper[] = []

    const disposeArrows = () => {
      for (const a of arrowHelpers) {
        scene.remove(a)
        a.line.geometry.dispose()
        ;(a.line.material as import('three').Material).dispose()
        a.cone.geometry.dispose()
        ;(a.cone.material as import('three').Material).dispose()
      }
      arrowHelpers = []
    }

    updateArrows = (ax, ay, az, bx, by, bz, tab, t) => {
      disposeArrows()

      const addArrow = (x: number, y: number, z: number, color: number) => {
        const len = Math.sqrt(x * x + y * y + z * z)
        if (len < 0.001) return
        const dir = new THREE.Vector3(x / len, y / len, z / len)
        const headLen = Math.min(0.3, len * 0.25)
        const arrow = new THREE.ArrowHelper(dir, new THREE.Vector3(0, 0, 0), len, color, headLen, 0.15)
        scene.add(arrow)
        arrowHelpers.push(arrow)
      }

      addArrow(ax, ay, az, 0x378ADD)

      if (tab !== 'single') addArrow(bx, by, bz, 0xD85A30)

      if (tab === 'cross') {
        const c = cross3(ax, ay, az, bx, by, bz)
        addArrow(c.x, c.y, c.z, 0x1D9E75)
      } else if (tab === 'lerp') {
        const l = lerp3(ax, ay, az, bx, by, bz, t)
        addArrow(l.x, l.y, l.z, 0x1D9E75)
      } else if (tab === 'single') {
        const n = norm3(ax, ay, az)
        addArrow(n.x, n.y, n.z, 0x1D9E75)
      }
    }

    cleanupArrows = disposeArrows

    // アニメーションループ
    const animate = () => {
      animId = requestAnimationFrame(animate)
      renderer.render(scene, camera)
    }
    animate()

    // ドラッグ回転
    let dragging = false, lastX = 0, lastY = 0
    const onMouseDown = (e: MouseEvent) => { dragging = true; lastX = e.clientX; lastY = e.clientY }
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging) return
      sph.theta -= (e.clientX - lastX) * 0.01
      sph.phi = Math.max(0.1, Math.min(Math.PI - 0.1, sph.phi + (e.clientY - lastY) * 0.01))
      lastX = e.clientX; lastY = e.clientY
      positionCamera()
    }
    const onMouseUp = () => { dragging = false }

    // タッチ回転（1本指）
    let lastTX = 0, lastTY = 0
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) { lastTX = e.touches[0].clientX; lastTY = e.touches[0].clientY }
    }
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      sph.theta -= (e.touches[0].clientX - lastTX) * 0.01
      sph.phi = Math.max(0.1, Math.min(Math.PI - 0.1, sph.phi + (e.touches[0].clientY - lastTY) * 0.01))
      lastTX = e.touches[0].clientX; lastTY = e.touches[0].clientY
      positionCamera()
    }

    // ズーム
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      sph.r = Math.max(2, Math.min(12, sph.r + e.deltaY * 0.01))
      positionCamera()
    }

    // リサイズ
    const onResize = () => {
      const w = canvasEl.clientWidth, h = canvasEl.clientHeight
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }

    canvasEl.addEventListener('mousedown', onMouseDown)
    canvasEl.addEventListener('touchstart', onTouchStart, { passive: true })
    canvasEl.addEventListener('touchmove', onTouchMove, { passive: true })
    canvasEl.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('resize', onResize)

    removeWindowListeners = () => {
      canvasEl.removeEventListener('mousedown', onMouseDown)
      canvasEl.removeEventListener('touchstart', onTouchStart)
      canvasEl.removeEventListener('touchmove', onTouchMove)
      canvasEl.removeEventListener('wheel', onWheel)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('resize', onResize)
    }

    sceneReady = true
  })

  onDestroy(() => {
    if (browser) cancelAnimationFrame(animId)
    cleanupArrows?.()
    threeRenderer?.dispose()
    removeWindowListeners?.()
    if (copyTimer) clearTimeout(copyTimer)
  })

  // ── リアクティブな矢印更新 ────────────────────────────────────────────
  $effect(() => {
    const ax = vaX, ay = vaY, az = vaZ
    const bx = vbX, by = vbY, bz = vbZ
    const tab = currentTab
    const t = lerpT
    if (!sceneReady) return
    updateArrows?.(ax, ay, az, bx, by, bz, tab, t)
  })
</script>

<svelte:head>
  <title>Vector3 演算ビジュアライザー | Unity 3Dベクター計算 | 96xtools</title>
  <meta name="description" content="UnityのVector3演算（内積・外積・角度・Lerp・正規化）をリアルタイムで計算・3D表示。結果のコードをワンクリックコピー。" />
</svelte:head>

<div class="ad-slot--top"></div>

<div class="max-w-2xl mx-auto px-4 py-6">
  <h1 class="text-xl font-bold text-slate-900">Vector3 演算ビジュアライザー</h1>
  <p class="text-sm text-slate-500 mt-1">Unity の Vector3 演算をリアルタイムで3D表示</p>

  <!-- タブ -->
  <div class="mt-6 flex border-b border-slate-200 flex-wrap">
    {#each tabs as tab}
      {@const isActive = currentTab === tab.id}
      <button
        type="button"
        onclick={() => { currentTab = tab.id }}
        class="px-3 py-2.5 text-sm border-b-2 transition-colors"
        class:font-semibold={isActive}
        class:text-teal-700={isActive}
        class:border-teal-700={isActive}
        class:text-slate-500={!isActive}
        class:border-transparent={!isActive}
      >
        {tab.label}
      </button>
    {/each}
  </div>

  <!-- ベクトル入力 -->
  <div class="mt-4 flex flex-col gap-3">
    <!-- Vector A -->
    <div>
      <p class="text-xs font-bold text-slate-500 mb-1.5">Vector A</p>
      <div class="flex gap-2">
        <div class="flex-1">
          <label class="text-[10px] text-slate-400 font-bold block mb-0.5">X</label>
          <input type="number" step="0.1" value={ax}
            oninput={(e) => ax = (e.target as HTMLInputElement).value}
            class="w-full bg-slate-50 border border-slate-200 rounded-md text-center text-sm font-mono h-9 focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
        <div class="flex-1">
          <label class="text-[10px] text-slate-400 font-bold block mb-0.5">Y</label>
          <input type="number" step="0.1" value={ay}
            oninput={(e) => ay = (e.target as HTMLInputElement).value}
            class="w-full bg-slate-50 border border-slate-200 rounded-md text-center text-sm font-mono h-9 focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
        <div class="flex-1">
          <label class="text-[10px] text-slate-400 font-bold block mb-0.5">Z</label>
          <input type="number" step="0.1" value={az}
            oninput={(e) => az = (e.target as HTMLInputElement).value}
            class="w-full bg-slate-50 border border-slate-200 rounded-md text-center text-sm font-mono h-9 focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
      </div>
    </div>

    <!-- Vector B（single タブでは非表示） -->
    {#if currentTab !== 'single'}
      <div>
        <p class="text-xs font-bold text-slate-500 mb-1.5">Vector B</p>
        <div class="flex gap-2">
          <div class="flex-1">
            <label class="text-[10px] text-slate-400 font-bold block mb-0.5">X</label>
            <input type="number" step="0.1" value={bx}
              oninput={(e) => bx = (e.target as HTMLInputElement).value}
              class="w-full bg-slate-50 border border-slate-200 rounded-md text-center text-sm font-mono h-9 focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <div class="flex-1">
            <label class="text-[10px] text-slate-400 font-bold block mb-0.5">Y</label>
            <input type="number" step="0.1" value={by}
              oninput={(e) => by = (e.target as HTMLInputElement).value}
              class="w-full bg-slate-50 border border-slate-200 rounded-md text-center text-sm font-mono h-9 focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <div class="flex-1">
            <label class="text-[10px] text-slate-400 font-bold block mb-0.5">Z</label>
            <input type="number" step="0.1" value={bz}
              oninput={(e) => bz = (e.target as HTMLInputElement).value}
              class="w-full bg-slate-50 border border-slate-200 rounded-md text-center text-sm font-mono h-9 focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
        </div>
      </div>
    {/if}

    <!-- Lerp スライダー（lerp タブのみ） -->
    {#if currentTab === 'lerp'}
      <div class="flex items-center gap-3">
        <label class="text-xs font-bold text-slate-500 shrink-0">t</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          bind:value={lerpT}
          class="flex-1 accent-teal-600"
        />
        <span class="text-xs font-mono text-slate-700 w-8 text-right shrink-0">{lerpT.toFixed(2)}</span>
      </div>
    {/if}
  </div>

  <!-- Three.js キャンバス -->
  <div class="mt-4 relative rounded-lg overflow-hidden">
    <canvas
      bind:this={canvasEl}
      class="w-full block"
      style="height: 260px; background: #0a0a12;"
    ></canvas>
    <span class="absolute bottom-2 right-3 text-[10px] text-slate-400 pointer-events-none select-none">
      ドラッグ: 回転　スクロール: ズーム
    </span>
  </div>

  <div class="ad-slot--in-content mt-4"></div>

  <!-- 演算結果 -->
  <div class="mt-6">
    <p class="text-xs font-bold text-slate-700 mb-2">演算結果</p>
    <div class="flex flex-col gap-1.5">
      {#each results.rows as row (row.label)}
        <div class="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
          <div class="min-w-0">
            <p class="text-[10px] font-semibold text-slate-400 mb-0.5">{row.label}</p>
            <p class="text-xs font-mono text-slate-900 truncate">{row.value}</p>
          </div>
          {#if row.copyable}
            <button
              type="button"
              onclick={() => copyRow(row.label, row.value)}
              class="shrink-0 ml-3 text-xs font-semibold px-2.5 py-1 rounded transition-colors"
              class:bg-emerald-100={copiedRow === row.label}
              class:text-emerald-700={copiedRow === row.label}
              class:bg-sky-100={copiedRow !== row.label}
              class:text-sky-700={copiedRow !== row.label}
            >
              {copiedRow === row.label ? '✓' : 'コピー'}
            </button>
          {/if}
        </div>
      {/each}
    </div>
    {#if results.hint}
      <p class="text-[12px] text-slate-400 mt-2">{results.hint}</p>
    {/if}
  </div>
</div>
