<script lang="ts">
  let {
    height = "h-4",
    width = "w-full",
    rounded = "rounded-md",
    text = "",
    duration = 2,
    spread = 2,
  }: {
    height?: string;
    width?: string;
    rounded?: string;
    text?: string;
    duration?: number;
    spread?: number;
  } = $props();
</script>

{#if text}
  <!-- Text shimmer — animated gradient sweeping across text -->
  <span
    class="text-shimmer inline-block"
    style="--shimmer-duration: {duration}s; --shimmer-spread: {spread};"
  >{text}</span>
{:else}
  <!-- Block shimmer — animated bar -->
  <div class="block-shimmer {height} {width} {rounded}" aria-hidden="true"></div>
{/if}

<style>
  .text-shimmer {
    background: linear-gradient(
      90deg,
      rgba(161, 161, 170, 0.3) 0%,
      rgba(161, 161, 170, 0.3) 40%,
      rgba(228, 228, 231, 0.9) 50%,
      rgba(161, 161, 170, 0.3) 60%,
      rgba(161, 161, 170, 0.3) 100%
    );
    background-size: calc(100% * var(--shimmer-spread, 2)) 100%;
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: text-shimmer-sweep calc(var(--shimmer-duration, 2) * 1s) linear infinite;
  }

  @keyframes text-shimmer-sweep {
    0% { background-position: 100% 0; }
    100% { background-position: -100% 0; }
  }

  .block-shimmer {
    position: relative;
    overflow: hidden;
    background: rgba(39, 39, 42, 0.5);
  }
  .block-shimmer::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(63, 63, 70, 0.4) 40%,
      rgba(82, 82, 91, 0.6) 50%,
      rgba(63, 63, 70, 0.4) 60%,
      transparent 100%
    );
    animation: block-shimmer-sweep 1.2s ease-in-out infinite;
    will-change: transform;
  }

  @keyframes block-shimmer-sweep {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
</style>
