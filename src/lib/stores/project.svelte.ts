import type { FileEntry } from "$lib/types";

class ProjectStore {
  path = $state<string | null>(null);
  name = $state("");
  files = $state<FileEntry[]>([]);
  isLoading = $state(false);
  isOpen = $derived(this.path !== null);

  /** Tracks recently modified file paths for the file tree flash animation. */
  recentlyModified = $state<Set<string>>(new Set());

  setProject(path: string, name: string) {
    this.path = path;
    this.name = name;
    this.isLoading = true;
  }

  setFiles(files: FileEntry[]) {
    this.files = files;
    this.isLoading = false;
  }

  /** Mark a file as recently modified — triggers flash in the file tree, auto-clears after 3s. */
  markModified(path: string) {
    this.recentlyModified = new Set([...this.recentlyModified, path]);
    setTimeout(() => {
      const updated = new Set(this.recentlyModified);
      updated.delete(path);
      this.recentlyModified = updated;
    }, 3000);
  }

  close() {
    this.path = null;
    this.name = "";
    this.files = [];
    this.isLoading = false;
    this.recentlyModified = new Set();
  }
}

export const project = new ProjectStore();
