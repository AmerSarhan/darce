import { tauriInvoke } from "$lib/utils/ipc";
import { listen } from "@tauri-apps/api/event";
import { terminal } from "$lib/stores/terminal.svelte";

interface BackgroundProcess {
  id: string;
  command: string;
  cwd: string;
  status: "running" | "stopped" | "errored";
  startedAt: number;
  output: string[]; // last 100 lines
}

interface ProcessOutputEvent {
  id: string;
  line: string;
  stream: "stdout" | "stderr";
}

const MAX_OUTPUT_LINES = 100;

class ProcessStore {
  processes = $state<Map<string, BackgroundProcess>>(new Map());

  running = $derived(
    [...this.processes.values()].filter((p) => p.status === "running").length
  );

  async start(command: string, cwd: string): Promise<string> {
    const result = await tauriInvoke<{ id: string; pid: number }>(
      "spawn_background_process",
      { cwd, command }
    );

    const entry: BackgroundProcess = {
      id: result.id,
      command,
      cwd,
      status: "running",
      startedAt: Date.now(),
      output: [],
    };

    this.processes = new Map(this.processes).set(result.id, entry);

    return result.id;
  }

  async stop(id: string): Promise<void> {
    const proc = this.processes.get(id);
    if (!proc) return;

    await tauriInvoke<void>("kill_background_process", { id });

    const updated = new Map(this.processes);
    updated.set(id, { ...proc, status: "stopped" });
    this.processes = updated;
  }

  async restart(id: string): Promise<void> {
    const proc = this.processes.get(id);
    if (!proc) return;

    // Stop the old process if it is still running
    if (proc.status === "running") {
      await tauriInvoke<void>("kill_background_process", { id });
    }

    // Spawn a new backend process with the same command/cwd
    const result = await tauriInvoke<{ id: string; pid: number }>(
      "spawn_background_process",
      { cwd: proc.cwd, command: proc.command }
    );

    // Replace the map entry under the original id, preserving command/cwd,
    // and store the new backend id as the logical id so output events resolve.
    const updated = new Map(this.processes);
    // Remove the old entry
    updated.delete(id);
    // Insert a fresh entry under the new backend id
    const fresh: BackgroundProcess = {
      id: result.id,
      command: proc.command,
      cwd: proc.cwd,
      status: "running",
      startedAt: Date.now(),
      output: [],
    };
    updated.set(result.id, fresh);
    this.processes = updated;
  }

  getOutput(id: string, lastN = 20): string[] {
    const proc = this.processes.get(id);
    if (!proc) return [];
    return proc.output.slice(-lastN);
  }

  cleanup(): void {
    const running = [...this.processes.values()].filter(
      (p) => p.status === "running"
    );
    for (const proc of running) {
      // Fire-and-forget; best-effort on shutdown
      tauriInvoke<void>("kill_background_process", { id: proc.id }).catch(
        () => {}
      );
      const updated = new Map(this.processes);
      updated.set(proc.id, { ...proc, status: "stopped" });
      this.processes = updated;
    }
  }

  init(): void {
    listen<ProcessOutputEvent>("process:output", (event) => {
      const { id, line, stream } = event.payload;

      const proc = this.processes.get(id);
      if (proc) {
        const newOutput = [...proc.output, line];
        if (newOutput.length > MAX_OUTPUT_LINES) {
          newOutput.splice(0, newOutput.length - MAX_OUTPUT_LINES);
        }
        const updated = new Map(this.processes);
        updated.set(id, { ...proc, output: newOutput });
        this.processes = updated;
      }

      terminal.addLine(line, stream === "stderr" ? "stderr" : "stdout");
    });
  }
}

export const processes = new ProcessStore();
