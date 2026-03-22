import { project } from "$lib/stores/project.svelte";
import { files } from "$lib/stores/files.svelte";
import { terminal } from "$lib/stores/terminal.svelte";
import type { FileEntry } from "$lib/types";

/**
 * Build context about the current project state.
 * Kept concise — every token here costs money and adds latency.
 */
export function buildProjectContext(): string {
  const parts: string[] = [];

  if (!project.path) {
    return "[No project open — user needs to open a folder first]";
  }

  parts.push(`Project: ${project.name} (${project.path})`);

  // File tree — compact format
  if (project.files.length > 0) {
    parts.push("Files:");
    parts.push(renderTree(project.files, 0));
  } else {
    parts.push("(empty directory)");
  }

  // Currently open file — include content for context
  if (files.activeFile) {
    const f = files.activeFile;
    const lineCount = f.content.split("\n").length;
    parts.push(`\nOpen file: ${f.path} (${lineCount} lines)`);
    // Only include content if it's not too large
    if (lineCount <= 150) {
      parts.push("```" + (f.language || ""));
      parts.push(f.content);
      parts.push("```");
    } else {
      // Include first and last sections
      const lines = f.content.split("\n");
      parts.push("```" + (f.language || ""));
      parts.push(lines.slice(0, 80).join("\n"));
      parts.push(`\n... (${lineCount - 120} lines omitted) ...\n`);
      parts.push(lines.slice(-40).join("\n"));
      parts.push("```");
    }
  }

  // Other open tabs
  const otherFiles = files.openFiles.filter((_, i) => i !== files.activeIndex);
  if (otherFiles.length > 0) {
    parts.push(`\nAlso open: ${otherFiles.map(f => f.path).join(", ")}`);
  }

  // Recent terminal output (last few lines for context)
  const recentTerminal = terminal.lines.slice(-5);
  if (recentTerminal.length > 0) {
    parts.push("\nRecent terminal:");
    for (const l of recentTerminal) {
      parts.push(`  ${l.stream === "stderr" ? "ERR: " : ""}${l.text}`);
    }
  }

  return parts.join("\n");
}

function renderTree(entries: FileEntry[], depth: number): string {
  const lines: string[] = [];
  const indent = "  ".repeat(depth);
  for (const entry of entries) {
    if (entry.is_dir) {
      lines.push(`${indent}${entry.name}/`);
      if (entry.children && depth < 3) {
        lines.push(renderTree(entry.children, depth + 1));
      }
    } else {
      lines.push(`${indent}${entry.name}`);
    }
  }
  return lines.join("\n");
}
