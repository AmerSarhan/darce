<script lang="ts">
  let { height = "h-4", width = "w-full", rounded = "rounded-md" }: {
    height?: string; width?: string; rounded?: string;
  } = $props();
</script>

<div class="shimmer {height} {width} {rounded}" aria-hidden="true"></div>
