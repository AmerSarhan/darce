<script lang="ts">
  import { settings } from "$lib/stores/settings.svelte";
  import { chat } from "$lib/stores/chat.svelte";
  import { files } from "$lib/stores/files.svelte";
  import Shimmer from "$lib/components/ui/Shimmer.svelte";
  import { generateTeaching, type TeachingContent } from "$lib/providers/teacher";

  let depthLevel = $state<"brief" | "standard" | "deep">("standard");
  let teaching = $state<TeachingContent | null>(null);
  let isLoading = $state(false);
  let expandedConcept = $state<number | null>(null);
  let quizAnswer = $state<number | null>(null);
  let quizRevealed = $state(false);
  let lastAnalyzedContent = "";
  let eli5 = $state(false);

  // Only trigger after AI finishes a new response
  let lastMsgCount = 0;
  $effect(() => {
    if (settings.gear === "ship" || chat.isStreaming) return;
    const count = chat.messages.length;
    const hasNew = count > lastMsgCount && chat.messages.some(m => m.role === "assistant");
    if (hasNew && files.activeFile && settings.hasApiKey) {
      // Don't re-analyze same content
      const key = files.activeFile.path + ":" + count;
      if (key === lastAnalyzedContent) return;
      lastAnalyzedContent = key;
      lastMsgCount = count;
      analyze();
    }
  });

  async function analyze() {
    const file = files.activeFile;
    if (!file) return;
    isLoading = true;
    quizAnswer = null;
    quizRevealed = false;
    expandedConcept = null;

    const lastMsg = chat.messages.filter(m => m.role === "assistant").at(-1);
    const actIdx = lastMsg?.content?.indexOf("Actions:\n") ?? -1;
    const actions = actIdx >= 0 ? lastMsg!.content.slice(actIdx + 9) : "Viewing file";

    teaching = await generateTeaching(file.content, file.name, actions, depthLevel, eli5);
    isLoading = false;
    eli5 = false; // reset after use
  }

  function toggleConcept(i: number) { expandedConcept = expandedConcept === i ? null : i; }
  function pickAnswer(i: number) { if (!quizRevealed) { quizAnswer = i; quizRevealed = true; } }

  const tagColors: Record<string, string> = {
    react: "text-blue-400 border-blue-800/40",
    css: "text-pink-400 border-pink-800/40",
    js: "text-yellow-400 border-yellow-800/40",
    html: "text-orange-400 border-orange-800/40",
    node: "text-green-400 border-green-800/40",
    pattern: "text-zinc-400 border-zinc-700/40",
    error: "text-red-400 border-red-800/40",
  };

  const diffDots: Record<string, string> = {
    beginner: "bg-emerald-500",
    intermediate: "bg-blue-500",
    advanced: "bg-amber-500",
  };
</script>

{#if settings.gear !== "ship"}
  <div class="border-t border-zinc-800/50 bg-zinc-950/80 flex flex-col overflow-hidden" style="min-height: 130px; max-height: 260px;">
    <!-- Header -->
    <div class="px-3 py-1.5 flex items-center justify-between border-b border-zinc-800/30 flex-shrink-0">
      <div class="flex items-center gap-2">
        <span class="text-[10px] font-medium uppercase tracking-widest {settings.gear === 'learn' ? 'text-emerald-500' : 'text-blue-500'}">
          {settings.gear === "learn" ? "learn" : "understand"}
        </span>
        {#if isLoading}
          <div class="shimmer w-1.5 h-1.5 rounded-full"></div>
        {:else if teaching}
          <span class="text-[10px] text-zinc-600">{teaching.concepts.length} patterns</span>
        {/if}
      </div>
      <div class="flex items-center gap-0.5">
        {#each ["brief", "standard", "deep"] as d}
          <button onclick={() => { depthLevel = d as any; lastAnalyzedContent = ""; analyze(); }}
            class="px-1.5 py-0.5 text-[9px] rounded transition-colors
              {depthLevel === d ? 'bg-zinc-800 text-zinc-300' : 'text-zinc-600 hover:text-zinc-400'}">
            {d}
          </button>
        {/each}
        <button onclick={() => { depthLevel = "brief"; lastAnalyzedContent = ""; eli5 = true; analyze(); }}
          class="px-1.5 py-0.5 text-[9px] rounded transition-colors ml-1
            {eli5 ? 'bg-amber-900/30 text-amber-400 border border-amber-800/30' : 'text-zinc-600 hover:text-amber-400'}">
          ELI5
        </button>
      </div>
    </div>

    <!-- Body -->
    <div class="flex-1 overflow-auto px-3 py-2 space-y-2">
      {#if isLoading}
        <div class="space-y-2 pt-1">
          <Shimmer height="h-3" width="w-3/4" />
          <Shimmer height="h-6" width="w-full" rounded="rounded" />
          <Shimmer height="h-6" width="w-full" rounded="rounded" />
          <Shimmer height="h-6" width="w-5/6" rounded="rounded" />
        </div>
      {:else if !teaching}
        <p class="text-[11px] text-zinc-600 pt-1">
          Build something first. Explanations appear after Darce writes code.
        </p>
      {:else}
        <!-- Summary -->
        <p class="text-[11px] text-zinc-500 leading-relaxed">{teaching.summary}</p>

        <!-- Concepts -->
        {#each teaching.concepts as c, i}
          <button onclick={() => toggleConcept(i)}
            class="w-full text-left group">
            <div class="flex items-center gap-2 px-2 py-1.5 rounded bg-zinc-800/30 border border-zinc-800/40 hover:border-zinc-700/50 transition-colors">
              <div class="w-1 h-1 rounded-full flex-shrink-0 {diffDots[c.difficulty] || diffDots.beginner}"></div>
              <span class="text-[11px] text-zinc-300 font-medium flex-1">{c.name}</span>
              <span class="text-[9px] px-1 py-0.5 rounded border {tagColors[c.tag] || tagColors.pattern}">{c.tag}</span>
              <span class="text-[9px] text-zinc-600 transition-transform duration-75 {expandedConcept === i ? 'rotate-90' : ''}">&rsaquo;</span>
            </div>
            {#if expandedConcept !== i}
              <p class="text-[10px] text-zinc-600 px-2 pt-0.5 leading-relaxed">{c.oneLiner}</p>
            {/if}
          </button>

          {#if expandedConcept === i}
            <div class="ml-3 pl-2.5 border-l border-zinc-800/50 space-y-1 animate-in fade-in py-0.5">
              <p class="text-[11px] text-zinc-400 leading-relaxed">{c.explanation}</p>
              {#if c.example}
                <pre class="text-[10px] bg-zinc-900/80 border border-zinc-800/30 rounded p-2 text-zinc-500 font-mono overflow-x-auto leading-relaxed">{c.example}</pre>
              {/if}
            </div>
          {/if}
        {/each}

        <!-- Quiz (Learn mode only) -->
        {#if teaching.quiz && settings.gear === "learn"}
          <div class="rounded border border-zinc-800/40 bg-zinc-900/50 p-2.5 space-y-2 mt-1">
            <p class="text-[9px] font-medium text-zinc-500 uppercase tracking-widest">Check understanding</p>
            <p class="text-[11px] text-zinc-300 leading-relaxed">{teaching.quiz.question}</p>
            <div class="space-y-1">
              {#each teaching.quiz.options as opt, i}
                <button onclick={() => pickAnswer(i)}
                  class="w-full text-left px-2 py-1 rounded text-[11px] border transition-all
                    {quizRevealed
                      ? i === teaching.quiz?.correctIndex
                        ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-400'
                        : i === quizAnswer
                          ? 'bg-red-950/20 border-red-800/40 text-red-400 line-through opacity-60'
                          : 'border-zinc-800/20 text-zinc-600'
                      : 'border-zinc-800/30 text-zinc-400 hover:border-zinc-700/50 hover:text-zinc-300'}">
                  <span class="font-mono text-[9px] text-zinc-600 mr-1.5">{String.fromCharCode(65 + i)}</span>{opt}
                </button>
              {/each}
            </div>
            {#if quizRevealed && teaching.quiz}
              <div class="animate-in fade-in pt-0.5">
                <p class="text-[10px] {quizAnswer === teaching.quiz.correctIndex ? 'text-emerald-500' : 'text-amber-500'} font-medium">
                  {quizAnswer === teaching.quiz.correctIndex ? "Correct" : "Incorrect"}
                </p>
                <p class="text-[10px] text-zinc-500 leading-relaxed">{teaching.quiz.explanation}</p>
              </div>
            {/if}
          </div>
        {/if}
      {/if}
    </div>
  </div>
{/if}
