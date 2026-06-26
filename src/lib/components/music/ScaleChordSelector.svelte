<script lang="ts">
	import { SCALE_GROUPS, CHORD_GROUPS, CHORDS } from '$lib/music/scaleData';

	const CHORD_SUFFIX: Record<string, string> = {
		maj: '', min: 'm', dim: 'dim', aug: '+',
		maj7: 'maj7', min7: 'm7', dom7: '7',
		sus2: 'sus2', sus4: 'sus4', add9: 'add9',
		maj9: 'maj9', min9: 'm9', dom9: '9',
	};

	let {
		mode = $bindable(),
		scaleId = $bindable(),
		chordId = $bindable(),
		inversion = $bindable(0),
		rootName = '',
		onchange,
		onstop,
	}: { mode: 'scale' | 'chord'; scaleId: string; chordId: string; inversion?: number; rootName?: string; onchange?: () => void; onstop?: () => void } = $props();

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
				<div class="grid grid-cols-2 sm:grid-cols-1 gap-1 mb-1">
				{#each group.items as item}
					<button
						class="w-full text-left px-2 py-1 text-sm rounded
							{scaleId === item.id
								? 'bg-teal-600 text-white'
								: 'bg-gray-700 text-gray-200 hover:bg-gray-600'}"
						onclick={() => { scaleId = item.id; onchange?.(); }}
					>
						{item.label}
					</button>
				{/each}
				</div>
			</div>
		{/each}
	{:else}
		{#each CHORD_GROUPS as group}
			<div class="mb-3">
				<p class="text-xs text-gray-500 mb-1">{group.group}</p>
				<div class="grid grid-cols-2 sm:grid-cols-1 gap-1 mb-1">
				{#each group.items as item}
					<button
						class="w-full text-left px-2 py-1 text-sm rounded
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
						<span class="flex justify-between items-center gap-2">
							<span>{item.label}</span>
							<span class="font-mono text-xs opacity-60 shrink-0">{rootName}{CHORD_SUFFIX[item.id] ?? ''}</span>
						</span>
					</button>
				{/each}
				</div>
			</div>
		{/each}
	{/if}
</div>
