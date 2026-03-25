import type { OpenFile } from "$lib/types";
import { getFileName, getLanguageFromPath } from "$lib/utils/paths";

export interface LineHighlight {
  path: string;
  lines: number[];
  type: "added" | "modified";
}

class FilesStore {
  openFiles = $state<OpenFile[]>([]);
  activeIndex = $state(0);
  activeFile = $derived(this.openFiles[this.activeIndex] ?? null);

  /** Tracks line ranges to highlight in the editor after agent edits. */
  highlightLines = $state<LineHighlight[]>([]);

  /** Add a line highlight for a file, auto-clears after 4 seconds. */
  addHighlight(path: string, lines: number[], type: "added" | "modified" = "modified") {
    this.highlightLines = [...this.highlightLines, { path, lines, type }];
    setTimeout(() => {
      this.highlightLines = this.highlightLines.filter(h => h.path !== path);
    }, 4000);
  }

  /** Open a file or update its content if already open */
  open(path: string, content: string) {
    const existing = this.openFiles.findIndex((f) => f.path === path);
    if (existing >= 0) {
      // Update content if it changed (AI edited the file)
      if (this.openFiles[existing].content !== content) {
        this.openFiles[existing].content = content;
        this.openFiles[existing].isDirty = false;
        // Trigger reactivity by reassigning array
        this.openFiles = [...this.openFiles];
      }
      this.activeIndex = existing;
      return;
    }
    this.openFiles = [...this.openFiles, {
      path,
      name: getFileName(path),
      content,
      language: getLanguageFromPath(path),
      isDirty: false,
    }];
    this.activeIndex = this.openFiles.length - 1;
  }

  close(index: number) {
    this.openFiles = this.openFiles.filter((_, i) => i !== index);
    if (this.activeIndex >= this.openFiles.length) {
      this.activeIndex = Math.max(0, this.openFiles.length - 1);
    }
  }

  setActive(index: number) {
    this.activeIndex = index;
  }

  updateContent(index: number, content: string) {
    if (this.openFiles[index]) {
      this.openFiles[index].content = content;
      this.openFiles[index].isDirty = true;
      this.openFiles = [...this.openFiles];
    }
  }

  /** Mark file as saved (not dirty) */
  markSaved(index: number) {
    if (this.openFiles[index]) {
      this.openFiles[index].isDirty = false;
      this.openFiles = [...this.openFiles];
    }
  }
}

export const files = new FilesStore();
