<script lang="ts">
	import { ROOTS } from '$lib/scaleData';
	let { rootId = $bindable(), onchange }: { rootId: string; onchange?: () => void } = $props();
</script>

<div>
	<p class="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">ルート音</p>
	<div class="grid grid-cols-4 gap-1">
		{#each ROOTS as root}
			<button
				class="aspect-square text-sm rounded font-mono
					{rootId === root.id
						? 'bg-teal-600 text-white'
						: 'bg-gray-700 text-gray-200 hover:bg-gray-600'}"
				onclick={() => { rootId = root.id; onchange?.(); }}
			>
				{root.id}
			</button>
		{/each}
	</div>
</div>
