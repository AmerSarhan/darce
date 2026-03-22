import type { TerminalLine } from "$lib/types";

class TerminalStore {
  lines = $state<TerminalLine[]>([]);
  isRunning = $state(false);
  private nextId = 0;

  addLine(text: string, stream: "stdout" | "stderr" | "system" = "stdout") {
    this.lines.push({ id: this.nextId++, text, stream, timestamp: Date.now() });
    if (this.lines.length > 1000) {
      this.lines = this.lines.slice(-1000);
    }
  }

  setRunning(running: boolean) {
    this.isRunning = running;
  }

  clear() {
    this.lines = [];
  }
}

export const terminal = new TerminalStore();
