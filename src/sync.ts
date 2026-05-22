import { requestUrl } from "obsidian";
import type SyncPlugin from "./main";

export interface SyncEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  description?: string;
  location?: string;
  attendees?: string;
  agenda?: string;
  action: "create" | "update" | "delete";
}

export interface SyncTodo {
  id: string;
  title: string;
  done: number;
  priority: string;
  due_date: string;
  action: "create" | "update" | "delete";
}

export interface SyncDoc {
  id: string;
  title: string;
  content: string;
  status: string;
  action: "create" | "update" | "delete";
  deleted?: number;
  updated_at?: string;
}

export interface SyncResult {
  events: SyncEvent[];
  todos: SyncTodo[];
  docs: SyncDoc[];
  cursor: string;
}

export class SyncEngine {
  plugin: SyncPlugin;
  private timer: number | null = null;

  constructor(plugin: SyncPlugin) {
    this.plugin = plugin;
  }

  buildSyncUrl(since?: string): string {
    const base = this.plugin.settings.serverUrl.replace(/\/+$/, "");
    const userId = encodeURIComponent(this.plugin.settings.userId);
    let url = `${base}/api/sync?user_id=${userId}`;
    if (since) {
      url += `&since=${encodeURIComponent(since)}`;
    }
    return url;
  }

  async syncNow(): Promise<void> {
    if (!this.plugin.settings.userId) {
      console.warn("[SyncPlugin] User ID not set, skipping sync");
      return;
    }

    try {
      const cursor = await this.plugin.loadCursor();
      const url = this.buildSyncUrl(cursor || undefined);

      const response = await requestUrl({ url, method: "GET" });
      const body = response.json;

      if (!body || !body.success) {
        console.warn("[SyncPlugin] Sync failed:", body?.error || "unknown error");
        return;
      }

      const result: SyncResult = body.data;

      // 运行时校验 API 响应数据结构
      if (!result || !Array.isArray(result.events) || !Array.isArray(result.todos) || !Array.isArray(result.docs) || typeof result.cursor !== "string") {
        console.error("[SyncPlugin] Invalid sync response format:", body);
        this.plugin.lastSyncTime = "Error";
        this.plugin.updateStatusBar();
        return;
      }

      // 写入 vault 文件
      await this.plugin.vaultWriter.writeEvents(result.events);
      await this.plugin.vaultWriter.writeTodos(result.todos);
      await this.plugin.vaultWriter.writeDocs(result.docs);

      await this.plugin.saveCursor(result.cursor);
      this.plugin.lastSyncTime = new Date().toLocaleTimeString();
      this.plugin.updateStatusBar();

      console.log(
        `[SyncPlugin] Synced: ${result.events.length} events, ${result.todos.length} todos, ${result.docs.length} docs`
      );
    } catch (err) {
      console.error("[SyncPlugin] Sync error:", err);
      this.plugin.lastSyncTime = "Error";
      this.plugin.updateStatusBar();
    }
  }

  startPolling(): void {
    this.stopPolling();
    const intervalMs = this.plugin.settings.syncIntervalMinutes * 60 * 1000;

    // 启动时立即同步一次
    this.syncNow();

    this.timer = window.setInterval(() => {
      this.syncNow();
    }, intervalMs);

    console.log(`[SyncPlugin] Polling every ${this.plugin.settings.syncIntervalMinutes} min`);
  }

  stopPolling(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  restartPolling(): void {
    console.log("[SyncPlugin] Restarting polling with new interval");
    this.stopPolling();
    this.startPolling();
  }
}
