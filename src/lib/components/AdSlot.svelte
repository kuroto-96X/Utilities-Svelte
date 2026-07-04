<script lang="ts">
  import siteConfig from '$lib/site.config.json'

  const adsEnabled = (siteConfig as { adsEnabled?: boolean }).adsEnabled ?? true
</script>

{#if adsEnabled}
  <div class="mt-4">
    <p class="text-[10px] text-slate-400 text-center mb-1">スポンサーリンク</p>
    <div class="hidden sm:flex sm:justify-center">
      <script src="https://adm.shinobi.jp/s/ffea59a79b77bc4160ffc29d36cc7305"></script>
    </div>
    <div class="flex justify-center sm:hidden">
      <script src="https://adm.shinobi.jp/s/09107acc80b232772e6dd49af94b902f"></script>
    </div>
  </div>
{/if}
