<script lang="ts">
  import siteConfig from '$lib/site.config.json'

  const adsEnabled = (siteConfig as { adsEnabled?: boolean }).adsEnabled ?? true
</script>

{#if adsEnabled}
  <div class="hidden sm:block fixed top-20 left-4">
    <div class="admax-ads" data-admax-id="dd3a4be55bd43292951788645b89bdad" style="display:inline-block;width:160px;height:600px;"></div>
    <script type="text/javascript">
      (admaxads = window.admaxads || []).push({admax_id: "dd3a4be55bd43292951788645b89bdad", type: "banner"});
    </script>
    <script type="text/javascript" charset="utf-8" src="https://adm.shinobi.jp/st/t.js" async></script>
  </div>
{/if}
