<script lang="ts">
  let { direction = "horizontal", onresize }: {
    direction?: "horizontal" | "vertical";
    onresize: (delta: number) => void;
  } = $props();

  let isDragging = $state(false);
  let startPos = 0;

  function onpointerdown(e: PointerEvent) {
    isDragging = true;
    startPos = direction === "horizontal" ? e.clientX : e.clientY;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onpointermove(e: PointerEvent) {
    if (!isDragging) return;
    const current = direction === "horizontal" ? e.clientX : e.clientY;
    const delta = current - startPos;
    startPos = current;
    onresize(delta);
  }

  function onpointerup() {
    isDragging = false;
  }
</script>

<div {onpointerdown} {onpointermove} {onpointerup}
  class="flex-shrink-0 {direction === 'horizontal' ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'}
    bg-zinc-800 hover:bg-accent/50 transition-colors duration-150
    {isDragging ? 'bg-accent/70' : ''}"
  role="separator"
  aria-orientation={direction}></div>
