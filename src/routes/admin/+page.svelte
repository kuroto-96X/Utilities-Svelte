<svelte:head>
  <title>管理ページ</title>
</svelte:head>

<div class="max-w-lg mx-auto px-4 py-8">
  <h1 class="text-2xl font-bold text-slate-800 mb-6">管理ページ</h1>

  <div class="border border-slate-200 rounded-lg divide-y divide-slate-100">
    <a href="/admin/menu" class="flex items-center gap-3 px-4 py-4 hover:bg-slate-50 transition-colors group">
      <div class="flex-1">
        <p class="text-sm font-semibold text-slate-700 group-hover:text-teal-700">メニュー設定</p>
        <p class="text-xs text-slate-400 mt-0.5">ツールの表示・非表示、ラベル・開発中フラグの編集</p>
      </div>
      <span class="text-slate-300 group-hover:text-teal-600 transition-colors">→</span>
    </a>
    <a href="/admin/animation" class="flex items-center gap-3 px-4 py-4 hover:bg-slate-50 transition-colors group">
      <div class="flex-1">
        <p class="text-sm font-semibold text-slate-700 group-hover:text-teal-700">アニメーション設定</p>
        <p class="text-xs text-slate-400 mt-0.5">ゲームのアニメーション値の調整</p>
      </div>
      <span class="text-slate-300 group-hover:text-teal-600 transition-colors">→</span>
    </a>
    <a href="/admin/culmen" class="flex items-center gap-3 px-4 py-4 hover:bg-slate-50 transition-colors group">
      <div class="flex-1">
        <p class="text-sm font-semibold text-slate-700 group-hover:text-teal-700">登頂ソリティア -Culmen- 設定</p>
        <p class="text-xs text-slate-400 mt-0.5">スコアリング・ステージ・アイテムなどのパラメータ調整</p>
      </div>
      <span class="text-slate-300 group-hover:text-teal-600 transition-colors">→</span>
    </a>
  </div>
</div>
