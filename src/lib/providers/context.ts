import { project } from "$lib/stores/project.svelte";
import { files } from "$lib/stores/files.svelte";
import { terminal } from "$lib/stores/terminal.svelte";
import { processes } from "$lib/stores/processes.svelte";
import { tauriInvoke } from "$lib/utils/ipc";
import type { FileEntry } from "$lib/types";

/**
 * Load .darce project files (instructions + memory).
 * These are optional — returns empty strings if files don't exist.
 */
export async function loadDarceFiles(projectRoot: string): Promise<{ instructions: string; memory: string }> {
  let instructions = "";
  let memory = "";
  try {
    instructions = await tauriInvoke<string>("read_file", { projectRoot, filePath: ".darce/instructions.md" });
  } catch { /* file doesn't exist, that's fine */ }
  try {
    memory = await tauriInvoke<string>("read_file", { projectRoot, filePath: ".darce/memory.md" });
  } catch { /* file doesn't exist, that's fine */ }
  return { instructions, memory };
}

/**
 * Build a lean context string sent with every user message to the AI.
 * Every token here costs money and adds latency — keep it minimal.
 * The agent reads files via tools (read_file / search_files) when it needs more.
 */
export function buildProjectContext(): string {
  if (!project.path) {
    return "[No project open]";
  }

  const parts: string[] = [];

  // 1. Project identity
  parts.push(`Project: ${project.name} (${project.path})`);

  // 2. Compact file tree — flat paths, max 3 levels deep, max 60 entries
  if (project.files.length > 0) {
    const treePaths = collectPaths(project.files, "", 0);
    const capped = treePaths.slice(0, 60);
    const grouped = groupByDirectory(capped);
    parts.push("Files:");
    parts.push(grouped);
    if (treePaths.length > 60) {
      parts.push(`(${treePaths.length - 60} more files not shown)`);
    }
  } else {
    parts.push("(empty directory)");
  }

  // 3. Active open file — name + line count only, NOT content
  if (files.activeFile) {
    const f = files.activeFile;
    const lineCount = f.content.split("\n").length;
    parts.push(`Open: ${f.path} (${lineCount} lines)`);
  }

  // 4. Other open tabs — names only
  const otherFiles = files.openFiles.filter((_, i) => i !== files.activeIndex);
  if (otherFiles.length > 0) {
    parts.push(`Also open: ${otherFiles.map((f) => f.name).join(", ")}`);
  }

  // 5. Recent terminal — last 3 lines only
  const recentLines = terminal.lines.slice(-3);
  if (recentLines.length > 0) {
    parts.push("Recent terminal:");
    for (const l of recentLines) {
      parts.push(`  ${l.stream === "stderr" ? "ERR: " : ""}${l.text}`);
    }
  }

  // 6. Running background processes
  const running = [...processes.processes.values()].filter(
    (p) => p.status === "running"
  );
  if (running.length > 0) {
    parts.push(
      `Running: ${running.map((p) => `${p.command} (${p.id})`).join(", ")}`
    );
  }

  return parts.join("\n");
}

/**
 * Recursively collect relative file paths from the tree, up to maxDepth levels.
 * Directories are traversed but not emitted as entries.
 */
function collectPaths(
  entries: FileEntry[],
  prefix: string,
  depth: number
): string[] {
  if (depth >= 3) return [];
  const result: string[] = [];
  for (const entry of entries) {
    const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.is_dir) {
      if (entry.children && entry.children.length > 0) {
        result.push(...collectPaths(entry.children, fullPath, depth + 1));
      }
    } else {
      result.push(fullPath);
    }
  }
  return result;
}

/**
 * Group a flat list of relative paths by their parent directory.
 * Each directory's files are emitted as a comma-separated line.
 *
 * Example output:
 *   src/App.tsx, src/main.ts, src/app.css
 *   src/components/Button.tsx, src/components/Modal.tsx
 *   package.json, tsconfig.json, vite.config.ts
 */
function groupByDirectory(paths: string[]): string {
  const groups = new Map<string, string[]>();

  for (const p of paths) {
    const lastSlash = p.lastIndexOf("/");
    const dir = lastSlash >= 0 ? p.slice(0, lastSlash) : "";
    if (!groups.has(dir)) groups.set(dir, []);
    groups.get(dir)!.push(p);
  }

  // Emit root-level files last so src/ tree appears first
  const dirs = [...groups.keys()].sort((a, b) => {
    if (a === "" && b !== "") return 1;
    if (b === "" && a !== "") return -1;
    return a.localeCompare(b);
  });

  return dirs.map((dir) => groups.get(dir)!.join(", ")).join("\n");
}
