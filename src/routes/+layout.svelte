<script lang="ts">
  import '../app.css'
  import favicon from '$lib/assets/favicon.svg'
  import { page } from '$app/stores'

  let { children } = $props()
</script>

<svelte:head>
  <link rel="icon" href="{favicon}" />
</svelte:head>

<div class="gradient-bg flex flex-col">
  <header class="sticky top-0 z-10 border-b border-teal-700/10 bg-white/65 backdrop-blur-md">
    <nav class="max-w-4xl mx-auto px-4 py-2.5 flex items-center gap-6">
      <a
        href="/"
        class="font-extrabold text-lg tracking-tight mr-2 bg-gradient-to-r from-teal-700 to-sky-600 bg-clip-text text-transparent"
      >
        Utilities
      </a>
      <a
        href="/bpm-tapper"
        class="text-sm font-medium transition-colors"
        class:text-teal-700={($page.url.pathname as string) === '/bpm-tapper'}
        class:font-semibold={($page.url.pathname as string) === '/bpm-tapper'}
        class:text-slate-500={($page.url.pathname as string) !== '/bpm-tapper'}
      >
        BPM Tapper
      </a>
      <a
        href="/hepburn-converter"
        class="text-sm font-medium transition-colors"
        class:text-teal-700={($page.url.pathname as string) === '/hepburn-converter'}
        class:font-semibold={($page.url.pathname as string) === '/hepburn-converter'}
        class:text-slate-500={($page.url.pathname as string) !== '/hepburn-converter'}
      >
        ヘボン式変換
      </a>
    </nav>
  </header>

  <main class="flex-1">
    {@render children()}
  </main>

  <footer class="border-t border-teal-700/10 bg-white/50 backdrop-blur-md">
    <div class="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div
          class="w-7 h-7 rounded-full bg-gradient-to-br from-teal-700 to-sky-600 flex items-center justify-center text-white text-xs font-bold select-none"
          aria-hidden="true"
        >96</div>
        <div>
          <p class="text-sm font-bold text-slate-800">96X</p>
          <a
            href="https://x.com/96X_SBRB"
            target="_blank"
            rel="noopener noreferrer"
            class="text-xs text-sky-600 hover:underline"
          >@96X_SBRB</a>
        </div>
      </div>
      <p class="text-xs text-slate-400">個人開発ツール集</p>
    </div>
  </footer>
</div>
