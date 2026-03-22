export type Gear = "ship" | "understand" | "learn";

export interface Project {
  id: string;
  name: string;
  path: string;
}

export interface ChatMessage {
  id: number;
  projectId: string;
  role: "user" | "assistant" | "system";
  content: string;
  model?: string;
  createdAt: string;
}

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  children?: FileEntry[];
}

export interface OpenFile {
  path: string;
  name: string;
  content: string;
  language: string;
  isDirty: boolean;
}

export interface TerminalLine {
  id: number;
  text: string;
  stream: "stdout" | "stderr" | "system";
  timestamp: number;
}

export interface AppSettings {
  apiKey: string;
  defaultModel: string;
  gear: Gear;
}
