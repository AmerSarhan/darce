/**
 * Teacher — analyzes code and generates structured teaching content.
 * Uses frontend HTTP plugin directly for speed (no Rust round-trip).
 */
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
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

  // Use fastest cheap models — direct HTTP call (no Rust round-trip)
  const models = [
    "mistralai/codestral-2508",
    "morph/morph-v3-fast",
    "meta-llama/llama-4-scout",
  ];

  for (const model of models) {
    try {
      console.log("[Teacher] Trying", model, "for:", fileName);
      const t0 = performance.now();

      const response = await tauriFetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${settings.activeKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://darce.dev",
          "X-OpenRouter-Title": "Darce",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          max_tokens: 1200,
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        console.warn("[Teacher]", model, "HTTP", response.status);
        continue;
      }

      const json = await response.json();
      const result = json.choices?.[0]?.message?.content || "";

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

      // Fix truncated JSON — close any open arrays/objects
      let parsed: TeachingContent;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        // Try to repair: close open strings, arrays, objects
        let repaired = jsonStr
          .replace(/,\s*$/, "")      // trailing comma
          .replace(/,\s*([}\]])/g, "$1"); // comma before close
        // Count open brackets and close them
        const opens = (repaired.match(/\[/g) || []).length;
        const closes = (repaired.match(/\]/g) || []).length;
        for (let i = 0; i < opens - closes; i++) repaired += "]";
        const openBraces = (repaired.match(/\{/g) || []).length;
        const closeBraces = (repaired.match(/\}/g) || []).length;
        for (let i = 0; i < openBraces - closeBraces; i++) repaired += "}";
        parsed = JSON.parse(repaired);
      }
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
