<script lang="ts">
  import siteConfig from '$lib/site.config.json'

  const adsEnabled = (siteConfig as { adsEnabled?: boolean }).adsEnabled ?? true
</script>

{#if adsEnabled}
  <div class="hidden sm:block">
    <script type="text/javascript">
      (admaxads = window.admaxads || []).push({admax_id: "3d1c39d315c6f0ce03951ff6bc2e34f6", type: "action"});
    </script>
    <script type="text/javascript" charset="utf-8" src="https://adm.shinobi.jp/st/t.js" async></script>
  </div>
{/if}
