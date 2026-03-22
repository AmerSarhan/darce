export function getFileName(filePath: string): string {
  const parts = filePath.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || filePath;
}

export function getFileExtension(filePath: string): string {
  const name = getFileName(filePath);
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1) : "";
}

export function getLanguageFromPath(filePath: string): string {
  const ext = getFileExtension(filePath);
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescriptreact",
    js: "javascript", jsx: "javascriptreact",
    json: "json", md: "markdown", css: "css",
    html: "html", svelte: "svelte", rs: "rust",
    py: "python", go: "go", sql: "sql",
    yaml: "yaml", yml: "yaml", toml: "toml",
    sh: "shell", bash: "shell",
  };
  return map[ext] || "plaintext";
}
