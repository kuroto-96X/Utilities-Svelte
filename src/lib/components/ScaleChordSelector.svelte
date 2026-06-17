<script lang="ts">
	import { SCALE_GROUPS, CHORD_GROUPS } from '$lib/scaleData';
	let {
		mode = $bindable(),
		scaleId = $bindable(),
		chordId = $bindable(),
		onchange,
	}: { mode: 'scale' | 'chord'; scaleId: string; chordId: string; onchange?: () => void } = $props();
</script>

<div>
	<!-- モード切替タブ -->
	<div class="flex gap-1 mb-3">
		<button
			class="flex-1 py-1.5 text-sm rounded
				{mode === 'scale' ? 'bg-teal-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}"
			onclick={() => { if (mode !== 'scale') { mode = 'scale'; onchange?.(); } }}
		>
			スケール
		</button>
		<button
			class="flex-1 py-1.5 text-sm rounded
				{mode === 'chord' ? 'bg-teal-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}"
			onclick={() => { if (mode !== 'chord') { mode = 'chord'; onchange?.(); } }}
		>
			コード
		</button>
	</div>

	<!-- スケールリスト -->
	{#if mode === 'scale'}
		{#each SCALE_GROUPS as group}
			<div class="mb-3">
				<p class="text-xs text-gray-500 mb-1">{group.group}</p>
				{#each group.items as item}
					<button
						class="w-full text-left px-2 py-1 text-sm rounded mb-0.5
							{scaleId === item.id
								? 'bg-teal-600 text-white'
								: 'bg-gray-700 text-gray-200 hover:bg-gray-600'}"
						onclick={() => { if (scaleId !== item.id) { scaleId = item.id; onchange?.(); } }}
					>
						{item.label}
					</button>
				{/each}
			</div>
		{/each}
	{:else}
		{#each CHORD_GROUPS as group}
			<div class="mb-3">
				<p class="text-xs text-gray-500 mb-1">{group.group}</p>
				{#each group.items as item}
					<button
						class="w-full text-left px-2 py-1 text-sm rounded mb-0.5
							{chordId === item.id
								? 'bg-teal-600 text-white'
								: 'bg-gray-700 text-gray-200 hover:bg-gray-600'}"
						onclick={() => { if (chordId !== item.id) { chordId = item.id; onchange?.(); } }}
					>
						{item.label}
					</button>
				{/each}
			</div>
		{/each}
	{/if}
</div>
