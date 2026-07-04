<script lang="ts">
  import siteConfig from '$lib/site.config.json'

  const adsEnabled = (siteConfig as { adsEnabled?: boolean }).adsEnabled ?? true
</script>

{#if adsEnabled}
  <div class="hidden sm:block fixed top-20 right-4">
    <div class="admax-ads" data-admax-id="6ad394d0af0dc87e305be228ab209d78" style="display:inline-block;width:160px;height:600px;"></div>
    <script type="text/javascript">
      (admaxads = window.admaxads || []).push({admax_id: "6ad394d0af0dc87e305be228ab209d78", type: "banner"});
    </script>
    <script type="text/javascript" charset="utf-8" src="https://adm.shinobi.jp/st/t.js" async></script>
  </div>
{/if}
