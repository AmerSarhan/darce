import type { FileEntry } from "$lib/types";

class ProjectStore {
  path = $state<string | null>(null);
  name = $state("");
  files = $state<FileEntry[]>([]);
  isLoading = $state(false);
  isOpen = $derived(this.path !== null);

  setProject(path: string, name: string) {
    this.path = path;
    this.name = name;
    this.isLoading = true;
  }

  setFiles(files: FileEntry[]) {
    this.files = files;
    this.isLoading = false;
  }

  close() {
    this.path = null;
    this.name = "";
    this.files = [];
    this.isLoading = false;
  }
}

export const project = new ProjectStore();
