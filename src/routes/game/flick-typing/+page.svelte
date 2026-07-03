<script>
  import { site } from '$lib/site';

  const tool = site.tools.find(t => t.href === '/game/flick-typing');
</script>

<svelte:head>
  <title>{tool?.label}</title>
</svelte:head>

<div class="container">
  <h1>{tool?.label}</h1>
  <p>{tool?.description}</p>
  <p class="dev-notice">このゲームは現在開発中です。</p>
</div>

<style>
  .container {
    padding: 2rem;
    max-width: 800px;
    margin: 0 auto;
  }

  .dev-notice {
    color: #666;
    font-style: italic;
  }
</style>
