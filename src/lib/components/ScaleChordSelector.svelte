<script lang="ts">
	import { SCALE_GROUPS, CHORD_GROUPS, CHORDS } from '$lib/scaleData';
	let {
		mode = $bindable(),
		scaleId = $bindable(),
		chordId = $bindable(),
		inversion = $bindable(0),
		onchange,
		onstop,
	}: { mode: 'scale' | 'chord'; scaleId: string; chordId: string; inversion?: number; onchange?: () => void; onstop?: () => void } = $props();

	const maxInversion = $derived(
		mode === 'chord' ? (CHORDS.find(c => c.id === chordId)?.intervals.length ?? 3) - 1 : 2
	);

	// ページロード時など転回形が範囲外になっている場合にルートへリセット
	$effect(() => {
		if (mode === 'chord' && inversion > maxInversion) {
			inversion = 0;
		}
	});
</script>

<div>
	<!-- モード切替タブ -->
	<div class="flex gap-1 mb-3">
		<button
			class="flex-1 py-1.5 text-sm rounded
				{mode === 'scale' ? 'bg-teal-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}"
			onclick={() => { mode = 'scale'; onchange?.(); }}
		>
			スケール
		</button>
		<button
			class="flex-1 py-1.5 text-sm rounded
				{mode === 'chord' ? 'bg-teal-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}"
			onclick={() => { mode = 'chord'; onchange?.(); }}
		>
			コード
		</button>
	</div>

	<!-- 転回形（コードモード時のみ） -->
	{#if mode === 'chord'}
		<div class="mb-3">
			<p class="text-xs text-gray-500 mb-1">転回形</p>
			<div class="flex flex-wrap gap-1">
				{#each ['ルート', '1転', '2転', '3転'] as label, i}
					{#if i <= maxInversion}
						<button
							class="px-2 py-1 text-xs rounded
								{inversion === i ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}"
							onclick={() => { inversion = i; onchange?.(); }}
						>{label}</button>
					{/if}
				{/each}
			</div>
		</div>
	{/if}

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
						onclick={() => { scaleId = item.id; onchange?.(); }}
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
						onclick={() => {
							const newMax = (CHORDS.find(c => c.id === item.id)?.intervals.length ?? 3) - 1;
							if (inversion > newMax) inversion = 0;
							chordId = item.id;
							onchange?.();
						}}
					>
						{item.label}
					</button>
				{/each}
			</div>
		{/each}
	{/if}
</div>
