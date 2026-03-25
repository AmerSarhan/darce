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
  let revealedConcepts = $state<Set<number>>(new Set());
  let summaryRevealed = $state(false);
  let quizRevealed2 = $state(false);

  // Only trigger after AI finishes a new response
  let lastMsgCount = 0;
  let lastFilePath = "";

  // Trigger on new AI messages
  $effect(() => {
    if (settings.gear === "ship" || chat.isStreaming) return;
    const count = chat.messages.length;
    const hasNew = count > lastMsgCount && chat.messages.some(m => m.role === "assistant");
    if (hasNew && files.activeFile && settings.hasApiKey) {
      const key = files.activeFile.path + ":" + count;
      if (key === lastAnalyzedContent) return;
      lastAnalyzedContent = key;
      lastMsgCount = count;
      analyze();
    }
  });

  // Trigger on file switch — smooth transition to new file's analysis
  $effect(() => {
    if (settings.gear === "ship" || !files.activeFile || !settings.hasApiKey) return;
    const currentPath = files.activeFile.path;
    if (currentPath !== lastFilePath && lastFilePath !== "") {
      // File changed — fade out old content, analyze new file
      teaching = null;
      summaryRevealed = false;
      revealedConcepts = new Set();
      quizRevealed2 = false;
      lastAnalyzedContent = "";
      analyze();
    }
    lastFilePath = currentPath;
  });

  async function analyze() {
    const file = files.activeFile;
    if (!file) return;
    isLoading = true;
    quizAnswer = null;
    quizRevealed = false;
    quizRevealed2 = false;
    expandedConcept = null;
    revealedConcepts = new Set();
    summaryRevealed = false;

    const lastMsg = chat.messages.filter(m => m.role === "assistant").at(-1);
    const actIdx = lastMsg?.content?.indexOf("Actions:\n") ?? -1;
    const actions = actIdx >= 0 ? lastMsg!.content.slice(actIdx + 9) : "Viewing file";

    teaching = await generateTeaching(file.content, file.name, actions, depthLevel, eli5);
    isLoading = false;
    eli5 = false;

    // Stagger reveal: summary → concepts one by one → quiz
    await new Promise(r => setTimeout(r, 100));
    summaryRevealed = true;

    if (teaching?.concepts) {
      for (let i = 0; i < teaching.concepts.length; i++) {
        await new Promise(r => setTimeout(r, 60));
        revealedConcepts = new Set([...revealedConcepts, i]);
      }
    }

    await new Promise(r => setTimeout(r, 150));
    quizRevealed2 = true;
  }

  function toggleConcept(i: number) { expandedConcept = expandedConcept === i ? null : i; }
  function pickAnswer(i: number) { if (!quizRevealed) { quizAnswer = i; quizRevealed = true; } }

  const tagColors: Record<string, string> = {
    react: "text-blue-400 bg-blue-500/10",
    css: "text-pink-400 bg-pink-500/10",
    js: "text-yellow-400 bg-yellow-500/10",
    ts: "text-blue-300 bg-blue-400/10",
    html: "text-orange-400 bg-orange-500/10",
    node: "text-green-400 bg-green-500/10",
    pattern: "text-purple-400 bg-purple-500/10",
    error: "text-red-400 bg-red-500/10",
  };

  const diffColors: Record<string, string> = {
    beginner: "bg-emerald-400 shadow-emerald-400/30",
    intermediate: "bg-blue-400 shadow-blue-400/30",
    advanced: "bg-amber-400 shadow-amber-400/30",
  };
</script>

{#if settings.gear !== "ship"}
  <div class="learn-panel border-t border-zinc-800/50 bg-zinc-950/95 flex flex-col overflow-hidden" style="min-height: 130px; max-height: 300px;">
    <!-- Header -->
    <div class="px-3 py-1.5 flex items-center justify-between border-b border-zinc-800/30 flex-shrink-0">
      <div class="flex items-center gap-2">
        {#if isLoading}
          <Shimmer text={settings.gear === "learn" ? "Learning..." : "Analyzing..."} duration={1.5} spread={2} />
        {:else if teaching}
          <span class="text-[10px] font-semibold uppercase tracking-widest {settings.gear === 'learn' ? 'text-emerald-400' : 'text-blue-400'}">
            {teaching.concepts.length} concepts
          </span>
        {:else}
          <span class="text-[10px] font-medium uppercase tracking-widest text-zinc-600">
            {settings.gear === "learn" ? "learn" : "understand"}
          </span>
        {/if}
      </div>
      <div class="flex items-center gap-0.5">
        {#each ["brief", "standard", "deep"] as d}
          <button onclick={() => { depthLevel = d as any; lastAnalyzedContent = ""; analyze(); }}
            class="px-2 py-0.5 text-[9px] rounded-full transition-all duration-100
              {depthLevel === d
                ? 'bg-zinc-700/80 text-zinc-100 shadow-sm shadow-zinc-900/50'
                : 'text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/40'}">
            {d}
          </button>
        {/each}
        <button onclick={() => { depthLevel = "brief"; lastAnalyzedContent = ""; eli5 = true; analyze(); }}
          class="px-2 py-0.5 text-[9px] rounded-full transition-all duration-100 ml-0.5
            {eli5 ? 'bg-amber-500/20 text-amber-300 shadow-sm shadow-amber-900/30' : 'text-zinc-600 hover:text-amber-400'}">
          ELI5
        </button>
      </div>
    </div>

    <!-- Body -->
    <div class="flex-1 overflow-auto px-3 py-2.5 space-y-2 chat-scroll">
      {#if isLoading}
        <!-- Elegant loading with text shimmer -->
        <div class="flex flex-col items-center justify-center py-6 gap-3">
          <div class="flex gap-1.5">
            <Shimmer width="w-24" height="h-2.5" rounded="rounded-full" />
            <Shimmer width="w-16" height="h-2.5" rounded="rounded-full" />
          </div>
          <Shimmer width="w-full" height="h-8" rounded="rounded-lg" />
          <Shimmer width="w-full" height="h-8" rounded="rounded-lg" />
          <Shimmer width="w-3/4" height="h-8" rounded="rounded-lg" />
        </div>
      {:else if !teaching}
        <!-- Empty state -->
        <div class="flex flex-col items-center justify-center py-8 gap-2">
          <div class="w-8 h-8 rounded-full bg-zinc-800/50 flex items-center justify-center">
            <span class="text-[14px] opacity-60">{settings.gear === "learn" ? "🧠" : "💡"}</span>
          </div>
          <p class="text-[11px] text-zinc-600 text-center leading-relaxed">
            Ask Darce to build something.<br/>Concepts appear after code is written.
          </p>
        </div>
      {:else}
        <!-- Summary -->
        {#if summaryRevealed}
          <div class="concept-reveal">
            <p class="text-[11px] text-zinc-400 leading-relaxed">{teaching.summary}</p>
          </div>
        {/if}

        <!-- Concepts — stagger reveal -->
        {#each teaching.concepts as c, i}
          {#if revealedConcepts.has(i)}
            <div class="concept-reveal">
              <button onclick={() => toggleConcept(i)} class="w-full text-left group">
                <div class="flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-100
                  {expandedConcept === i
                    ? 'bg-zinc-800/70 shadow-sm shadow-zinc-900/30'
                    : 'bg-zinc-800/20 hover:bg-zinc-800/50'}">
                  <!-- Difficulty dot with glow -->
                  <div class="w-2 h-2 rounded-full flex-shrink-0 shadow-sm {diffColors[c.difficulty] || diffColors.beginner}"></div>
                  <!-- Name -->
                  <span class="text-[11px] text-zinc-200 font-medium flex-1 leading-tight">{c.name}</span>
                  <!-- Tag -->
                  <span class="text-[8px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wider
                    {tagColors[c.tag] || tagColors.pattern}">{c.tag}</span>
                  <!-- Chevron -->
                  <svg class="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 transition-all duration-100 flex-shrink-0
                    {expandedConcept === i ? 'rotate-90 text-zinc-400' : ''}"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path d="M9 5l7 7-7 7"/>
                  </svg>
                </div>
                {#if expandedConcept !== i}
                  <p class="text-[10px] text-zinc-600 px-2.5 pt-1 leading-relaxed">{c.oneLiner}</p>
                {/if}
              </button>

              {#if expandedConcept === i}
                <div class="expand-reveal ml-4 pl-3 border-l-2 border-zinc-700/50 space-y-2 py-2">
                  <p class="text-[11px] text-zinc-300 leading-relaxed">{c.explanation}</p>
                  {#if c.example}
                    <pre class="text-[10px] bg-zinc-900 border border-zinc-800/40 rounded-md p-2.5 text-zinc-400 font-mono overflow-x-auto leading-relaxed">{c.example}</pre>
                  {/if}
                </div>
              {/if}
            </div>
          {/if}
        {/each}

        <!-- Quiz -->
        {#if teaching.quiz && settings.gear === "learn" && quizRevealed2}
          <div class="concept-reveal mt-1">
            <div class="rounded-lg border border-emerald-800/30 bg-gradient-to-b from-emerald-950/20 to-transparent p-3 space-y-2.5">
              <p class="text-[10px] font-semibold text-emerald-400/80 uppercase tracking-widest">Quick check</p>
              <p class="text-[11px] text-zinc-100 leading-relaxed">{teaching.quiz.question}</p>
              <div class="space-y-1">
                {#each teaching.quiz.options as opt, i}
                  <button onclick={() => pickAnswer(i)}
                    class="w-full text-left px-2.5 py-1.5 rounded-md text-[11px] transition-all duration-100
                      {quizRevealed
                        ? i === teaching.quiz?.correctIndex
                          ? 'bg-emerald-500/15 text-emerald-300 shadow-sm shadow-emerald-900/20'
                          : i === quizAnswer
                            ? 'bg-red-500/10 text-red-400/50 line-through'
                            : 'text-zinc-700'
                        : 'text-zinc-300 hover:bg-zinc-800/50 active:scale-[0.99]'}">
                    <span class="font-mono text-[9px] text-zinc-500 mr-2">{String.fromCharCode(65 + i)}</span>{opt}
                  </button>
                {/each}
              </div>
              {#if quizRevealed && teaching.quiz}
                <div class="expand-reveal pt-1">
                  <p class="text-[11px] font-semibold {quizAnswer === teaching.quiz.correctIndex ? 'text-emerald-400' : 'text-amber-400'}">
                    {quizAnswer === teaching.quiz.correctIndex ? "Correct!" : "Not quite"}
                  </p>
                  <p class="text-[10px] text-zinc-400 leading-relaxed mt-0.5">{teaching.quiz.explanation}</p>
                </div>
              {/if}
            </div>
          </div>
        {/if}
      {/if}
    </div>
  </div>
{/if}

<style>
  /* Stagger-in animation for concepts */
  .concept-reveal {
    animation: concept-in 200ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
    opacity: 0;
    transform: translateY(6px);
  }
  @keyframes concept-in {
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Expand animation for concept details */
  .expand-reveal {
    animation: expand-in 150ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
    opacity: 0;
    transform: translateY(-4px);
  }
  @keyframes expand-in {
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .learn-panel {
    backdrop-filter: blur(8px);
  }
</style>
