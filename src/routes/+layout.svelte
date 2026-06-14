<script lang="ts">
  import '../app.css'
  import favicon from '$lib/assets/favicon.svg'
  import { page } from '$app/stores'

  let { children } = $props()
</script>

<svelte:head>
  <link rel="icon" href="{favicon}" />
</svelte:head>

<div class="min-h-screen flex flex-col">
  <header class="border-b border-gray-200 bg-white sticky top-0 z-10">
    <nav class="max-w-4xl mx-auto px-4 py-2 flex items-center gap-6">
      <a href="/" class="font-bold text-gray-800 mr-2">Utilities</a>
      <a
        href="/bpm-tapper"
        class="text-sm font-medium transition-colors"
        class:text-blue-600={($page.url.pathname as string) === '/bpm-tapper'}
        class:text-gray-500={($page.url.pathname as string) !== '/bpm-tapper'}
      >
        BPM Tapper
      </a>
      <a
        href="/hepburn-converter"
        class="text-sm font-medium transition-colors"
        class:text-blue-600={($page.url.pathname as string) === '/hepburn-converter'}
        class:text-gray-500={($page.url.pathname as string) !== '/hepburn-converter'}
      >
        ヘボン式変換
      </a>
    </nav>
  </header>

  <main class="flex-1">
    {@render children()}
  </main>
</div>
