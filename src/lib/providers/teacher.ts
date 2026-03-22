/**
 * Teacher — analyzes code and generates structured teaching content.
 * Uses Rust backend for reliable non-streaming calls.
 */
import { tauriInvoke } from "$lib/utils/ipc";
import { settings } from "$lib/stores/settings.svelte";

export interface TeachingContent {
  summary: string;
  concepts: ConceptCard[];
  quiz?: QuizQuestion;
}

export interface ConceptCard {
  name: string;
  tag: string;
  oneLiner: string;
  explanation: string;
  example?: string;
  difficulty: "beginner" | "intermediate" | "advanced";
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export async function generateTeaching(
  code: string,
  fileName: string,
  actionsSummary: string,
  depth: "brief" | "standard" | "deep",
  isEli5 = false,
): Promise<TeachingContent> {
  const depthMap = {
    brief: "Cover 2-3 key concepts. One sentence explanations only. No fluff.",
    standard: "Cover 3-5 concepts. Practical explanations — what it does, when to use it, common mistakes.",
    deep: "Cover 4-6 concepts in depth. Include code examples, gotchas, and why this pattern was chosen over alternatives.",
  };

  const tone = isEli5
    ? "Explain like I'm 5 years old. Use simple analogies, everyday comparisons, no jargon. Make it fun and easy to understand. Like explaining to a smart kid."
    : "Be direct, technical, no filler.";

  // Keep code short — only first 1500 chars for speed
  const codeSnippet = code.slice(0, 1500);

  const prompt = `Analyze this ${fileName} file. ${tone} ${depthMap[depth]}

\`\`\`
${codeSnippet}
\`\`\`

JSON only, no markdown wrapping:
{"summary":"one sentence","concepts":[{"name":"Name","tag":"react|css|js|html|node|pattern","oneLiner":"short","explanation":"detail","difficulty":"beginner|intermediate|advanced"}],"quiz":{"question":"q about this code","options":["a","b","c","d"],"correctIndex":0,"explanation":"why"}}`;

  // Try fast models in order
  const models = ["google/gemini-2.5-flash", "openai/gpt-4.1-mini"];

  for (const model of models) {
    try {
      console.log("[Teacher] Trying", model, "for:", fileName);
      const t0 = performance.now();

      const result = await tauriInvoke<string>("simple_chat", {
        apiKey: settings.activeKey,
        model,
        prompt,
      });

      console.log("[Teacher]", model, "responded in", Math.round(performance.now() - t0), "ms, length:", result.length);

      if (!result || result.trim().length < 10) {
        console.warn("[Teacher]", model, "returned empty, trying next");
        continue;
      }

      let jsonStr = result.trim();
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
      }
      const startIdx = jsonStr.indexOf("{");
      const endIdx = jsonStr.lastIndexOf("}");
      if (startIdx >= 0 && endIdx > startIdx) {
        jsonStr = jsonStr.slice(startIdx, endIdx + 1);
      }

      const parsed = JSON.parse(jsonStr) as TeachingContent;
      console.log("[Teacher] Success with", model, "-", parsed.concepts?.length, "concepts");
      return parsed;
    } catch (e) {
      console.warn("[Teacher]", model, "failed:", e);
      continue;
    }
  }

  // All models failed
  {
    console.error("[Teacher] All models failed for:", fileName);
    return {
      summary: `Could not analyze ${fileName}`,
      concepts: [{
        name: "Analysis Failed",
        tag: "error",
        oneLiner: "All models returned empty or failed.",
        explanation: "Try again or check your API key has credits.",
        difficulty: "beginner",
      }],
    };
  }
}
