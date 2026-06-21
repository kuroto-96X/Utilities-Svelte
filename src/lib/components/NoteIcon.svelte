<script lang="ts">
  let {
    filled,
    stem,
    flags,
    size = 24,
  }: {
    filled: boolean
    stem: boolean
    flags: 0 | 1 | 2 | 3 | 4
    size?: number
  } = $props()
</script>

<svg
  viewBox="0 0 24 24"
  width={size}
  height={size}
  xmlns="http://www.w3.org/2000/svg"
  aria-hidden="true"
>
  <ellipse
    cx="8" cy="17" rx="4" ry="3"
    transform="rotate(-20 8 17)"
    fill={filled ? 'currentColor' : 'none'}
    stroke={filled ? 'none' : 'currentColor'}
    stroke-width="1.5"
  />
  {#if stem}
    <line x1="11.5" y1="15" x2="11.5" y2="3" stroke="currentColor" stroke-width="1.5" />
  {/if}
  {#each Array(flags) as _, i}
    <path
      d={`M11.5 ${3 + i * 3} C16 ${4 + i * 3}, 17 ${8 + i * 3}, 14 ${11 + i * 3}`}
      stroke="currentColor"
      stroke-width="1.5"
      fill="none"
    />
  {/each}
</svg>

<style>
  svg {
    display: inline-block;
    vertical-align: middle;
  }
</style>
