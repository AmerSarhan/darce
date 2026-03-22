import type { ChatMessage } from "$lib/types";

class ChatStore {
  messages = $state<ChatMessage[]>([]);
  isStreaming = $state(false);
  streamingContent = $state("");
  error = $state<string | null>(null);

  /** Load saved messages for a project */
  loadForProject(projectId: string) {
    try {
      const saved = localStorage.getItem(`darce_chat_${projectId}`);
      if (saved) {
        this.messages = JSON.parse(saved);
      } else {
        this.messages = [];
      }
    } catch {
      this.messages = [];
    }
    this.error = null;
  }

  private save(projectId: string) {
    try {
      // Keep last 50 messages per project
      const toSave = this.messages.slice(-50);
      localStorage.setItem(`darce_chat_${projectId}`, JSON.stringify(toSave));
    } catch { /* quota exceeded — ignore */ }
  }

  addUserMessage(content: string, projectId: string) {
    const msg: ChatMessage = {
      id: Date.now(),
      projectId,
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };
    this.messages.push(msg);
    this.save(projectId);
    return msg;
  }

  startStreaming() {
    this.isStreaming = true;
    this.streamingContent = "";
    this.error = null;
  }

  appendToken(token: string) {
    this.streamingContent += token;
  }

  finishStreaming(model: string, projectId: string) {
    const msg: ChatMessage = {
      id: Date.now(),
      projectId,
      role: "assistant",
      content: this.streamingContent,
      model,
      createdAt: new Date().toISOString(),
    };
    this.messages.push(msg);
    this.isStreaming = false;
    this.streamingContent = "";
    this.save(projectId);
  }

  setError(error: string) {
    this.isStreaming = false;
    this.error = error;
  }

  clear(projectId?: string) {
    this.messages = [];
    this.streamingContent = "";
    this.isStreaming = false;
    this.error = null;
    if (projectId) {
      localStorage.removeItem(`darce_chat_${projectId}`);
    }
  }
}

export const chat = new ChatStore();
