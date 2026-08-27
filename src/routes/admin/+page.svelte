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
    <a href="/admin/shidasu" class="flex items-center gap-3 px-4 py-4 hover:bg-slate-50 transition-colors group">
      <div class="flex-1">
        <p class="text-sm font-semibold text-slate-700 group-hover:text-teal-700">星詠みソリティア -Shidasu- 設定</p>
        <p class="text-xs text-slate-400 mt-0.5">スコアリング・ステージ・アイテムなどのパラメータ調整</p>
      </div>
      <span class="text-slate-300 group-hover:text-teal-600 transition-colors">→</span>
    </a>
    <a href="/admin/shidasu-debug" class="flex items-center gap-3 px-4 py-4 hover:bg-slate-50 transition-colors group">
      <div class="flex-1">
        <p class="text-sm font-semibold text-slate-700 group-hover:text-teal-700">星詠みソリティア -Shidasu- デバッグサンドボックス</p>
        <p class="text-xs text-slate-400 mt-0.5">護符の付与/削除・場札/山札のカード入れ替えで効果を検証</p>
      </div>
      <span class="text-slate-300 group-hover:text-teal-600 transition-colors">→</span>
    </a>
    <a href="/admin/shidasu-talismans" class="flex items-center gap-3 px-4 py-4 hover:bg-slate-50 transition-colors group">
      <div class="flex-1">
        <p class="text-sm font-semibold text-slate-700 group-hover:text-teal-700">星詠みソリティア -Shidasu- 護符パラメータ設定</p>
        <p class="text-xs text-slate-400 mt-0.5">護符ごとの名前・数値パラメータ・効果説明文プレビューを1行ずつ編集</p>
      </div>
      <span class="text-slate-300 group-hover:text-teal-600 transition-colors">→</span>
    </a>
    <a href="/admin/shidasu-rites" class="flex items-center gap-3 px-4 py-4 hover:bg-slate-50 transition-colors group">
      <div class="flex-1">
        <p class="text-sm font-semibold text-slate-700 group-hover:text-teal-700">星詠みソリティア -Shidasu- 秘儀パラメータ設定</p>
        <p class="text-xs text-slate-400 mt-0.5">秘儀ごとの名前(ルーン文字)・数値パラメータ・効果説明文プレビューを1行ずつ編集</p>
      </div>
      <span class="text-slate-300 group-hover:text-teal-600 transition-colors">→</span>
    </a>
    <a href="/admin/shidasu-revelations" class="flex items-center gap-3 px-4 py-4 hover:bg-slate-50 transition-colors group">
      <div class="flex-1">
        <p class="text-sm font-semibold text-slate-700 group-hover:text-teal-700">星詠みソリティア -Shidasu- 天啓パラメータ設定</p>
        <p class="text-xs text-slate-400 mt-0.5">天啓ごとの名前(二十八宿)・数値パラメータ・効果説明文プレビューを1行ずつ編集</p>
      </div>
      <span class="text-slate-300 group-hover:text-teal-600 transition-colors">→</span>
    </a>
    <a href="/admin/shidasu-oracles" class="flex items-center gap-3 px-4 py-4 hover:bg-slate-50 transition-colors group">
      <div class="flex-1">
        <p class="text-sm font-semibold text-slate-700 group-hover:text-teal-700">星詠みソリティア -Shidasu- 神託パラメータ設定</p>
        <p class="text-xs text-slate-400 mt-0.5">神託ごとの名前(八卦)・説明文テンプレート・プレビューを1行ずつ編集</p>
      </div>
      <span class="text-slate-300 group-hover:text-teal-600 transition-colors">→</span>
    </a>
    <a href="/admin/shidasu-bosses" class="flex items-center gap-3 px-4 py-4 hover:bg-slate-50 transition-colors group">
      <div class="flex-1">
        <p class="text-sm font-semibold text-slate-700 group-hover:text-teal-700">星詠みソリティア -Shidasu- 星パラメータ設定</p>
        <p class="text-xs text-slate-400 mt-0.5">星ごとの名前・Wave所属・目標倍率・報酬・制限ルール・説明文テンプレートを1行ずつ編集</p>
      </div>
      <span class="text-slate-300 group-hover:text-teal-600 transition-colors">→</span>
    </a>
    <a href="/admin/shidasu-currency" class="flex items-center gap-3 px-4 py-4 hover:bg-slate-50 transition-colors group">
      <div class="flex-1">
        <p class="text-sm font-semibold text-slate-700 group-hover:text-teal-700">星詠みソリティア -Shidasu- 通貨設定</p>
        <p class="text-xs text-slate-400 mt-0.5">通貨(星片)の名称・記号、初期所持数、Waveクリア獲得数の編集</p>
      </div>
      <span class="text-slate-300 group-hover:text-teal-600 transition-colors">→</span>
    </a>
    <a href="/admin/shidasu-packs" class="flex items-center gap-3 px-4 py-4 hover:bg-slate-50 transition-colors group">
      <div class="flex-1">
        <p class="text-sm font-semibold text-slate-700 group-hover:text-teal-700">星詠みソリティア -Shidasu- 福袋カタログ設定</p>
        <p class="text-xs text-slate-400 mt-0.5">福袋(名前・種別・選択肢数・取得数・価格)の追加・削除・編集</p>
      </div>
      <span class="text-slate-300 group-hover:text-teal-600 transition-colors">→</span>
    </a>
    <a href="/admin/shidasu-relics" class="flex items-center gap-3 px-4 py-4 hover:bg-slate-50 transition-colors group">
      <div class="flex-1">
        <p class="text-sm font-semibold text-slate-700 group-hover:text-teal-700">星詠みソリティア -Shidasu- レリックパラメータ設定</p>
        <p class="text-xs text-slate-400 mt-0.5">レリックごとの名前・価格・数値パラメータ・効果説明文(付喪化前後)を1行ずつ編集</p>
      </div>
      <span class="text-slate-300 group-hover:text-teal-600 transition-colors">→</span>
    </a>
    <a href="/admin/shidasu-sabotage" class="flex items-center gap-3 px-4 py-4 hover:bg-slate-50 transition-colors group">
      <div class="flex-1">
        <p class="text-sm font-semibold text-slate-700 group-hover:text-teal-700">星詠みソリティア -Shidasu- 妨害行動設定</p>
        <p class="text-xs text-slate-400 mt-0.5">妨害行動32種の表示名・発動間隔ターン数・効果説明文を1行ずつ編集</p>
      </div>
      <span class="text-slate-300 group-hover:text-teal-600 transition-colors">→</span>
    </a>
    <a href="/admin/shidasu-spreads" class="flex items-center gap-3 px-4 py-4 hover:bg-slate-50 transition-colors group">
      <div class="flex-1">
        <p class="text-sm font-semibold text-slate-700 group-hover:text-teal-700">星詠みソリティア -Shidasu- スプレッド設定</p>
        <p class="text-xs text-slate-400 mt-0.5">fool・moon・popeの初期条件・目標スコア・ショップ制限を編集</p>
      </div>
      <span class="text-slate-300 group-hover:text-teal-600 transition-colors">→</span>
    </a>
  </div>
</div>
