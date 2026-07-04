<script lang="ts">
  import siteConfig from '$lib/site.config.json'

  const adsEnabled = (siteConfig as { adsEnabled?: boolean }).adsEnabled ?? true
</script>

{#if adsEnabled}
  <div class="hidden sm:flex sm:justify-center">
    <div class="admax-ads" data-admax-id="cf791649e9fcf5651a3fd3f50faa8366" style="display:inline-block;width:728px;height:90px;"></div>
    <script type="text/javascript">
      (admaxads = window.admaxads || []).push({admax_id: "cf791649e9fcf5651a3fd3f50faa8366", type: "banner"});
    </script>
    <script type="text/javascript" charset="utf-8" src="https://adm.shinobi.jp/st/t.js" async></script>
  </div>
{/if}
