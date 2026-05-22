import { TFile, type Vault } from "obsidian";
import type { SyncEvent, SyncTodo, SyncDoc } from "./sync";

export class VaultWriter {
  vault: Vault;
  // 已写入的事件/待办/文档 ID 集合，防止 cursor 丢失导致重复写入
  private writtenEventIds: Set<string> = new Set();
  private writtenTodoIds: Set<string> = new Set();
  private writtenDocIds: Set<string> = new Set();

  constructor(vault: Vault) {
    this.vault = vault;
  }

  async writeEvents(events: SyncEvent[]): Promise<void> {
    for (const evt of events) {
      if (this.writtenEventIds.has(evt.id)) {
        continue;
      }
      await this.writeEvent(evt);
      this.writtenEventIds.add(evt.id);
    }
  }

  async writeTodos(todos: SyncTodo[]): Promise<void> {
    for (const todo of todos) {
      if (this.writtenTodoIds.has(todo.id)) {
        continue;
      }
      await this.writeTodo(todo);
      this.writtenTodoIds.add(todo.id);
    }
  }

  async writeDocs(docs: SyncDoc[]): Promise<void> {
    for (const doc of docs) {
      if (this.writtenDocIds.has(doc.id)) {
        continue;
      }
      await this.writeDoc(doc);
      this.writtenDocIds.add(doc.id);
    }
  }

  private async writeEvent(evt: SyncEvent): Promise<void> {
    if (evt.action === "delete") {
      console.log("[SyncPlugin] Event delete ignored (soft delete)");
      return;
    }

    const date = (evt.start_time || "").slice(0, 10);
    const filePath = `Calendar/${date}.md`;
    const line = this.formatEventLine(evt);

    await this.appendToFile(filePath, line);
  }

  private async writeTodo(todo: SyncTodo): Promise<void> {
    if (todo.action === "delete") {
      console.log("[SyncPlugin] Todo delete ignored (soft delete)");
      return;
    }

    const filePath = `Todos/待办事项.md`;
    const line = this.formatTodoLine(todo);

    await this.appendToFile(filePath, line);
  }

  private async writeDoc(doc: SyncDoc): Promise<void> {
    if (doc.action === "delete" || doc.deleted) {
      console.log("[SyncPlugin] Doc delete ignored (soft delete)");
      return;
    }

    // 文档写入独立文件而非追加
    const filePath = `Docs/${doc.title}.md`;
    const content = this.formatDocContent(doc);

    const abstractFile = this.vault.getAbstractFileByPath(filePath);
    if (abstractFile instanceof TFile) {
      // 已存在则覆盖
      await this.vault.modify(abstractFile, content);
    } else {
      const dirPath = "Docs";
      const dir = this.vault.getAbstractFileByPath(dirPath);
      if (!dir) {
        await this.vault.createFolder(dirPath);
      }
      await this.vault.create(filePath, content);
    }
  }

  private formatEventLine(evt: SyncEvent): string {
    const desc = evt.description ? ` - ${evt.description}` : "";
    const timeLabel = this.formatTimeRange(evt);
    return `- **${timeLabel}** ${evt.title}${desc}`;
  }

  private formatTimeRange(evt: SyncEvent): string {
    const startTime = (evt.start_time || "").trim();
    const endTime = (evt.end_time || "").trim();
    // Extract HH:MM from datetime-local strings like "2026-05-22T14:00"
    const startMatch = startTime.match(/T(\d{2}:\d{2})$/);
    const endMatch = endTime.match(/T(\d{2}:\d{2})$/);
    const startLabel = startMatch ? startMatch[1] : startTime;
    if (endMatch) {
      return `${startLabel}-${endMatch[1]}`;
    }
    return startLabel;
  }

  private formatTodoLine(todo: SyncTodo): string {
    const checkbox = todo.done ? "[x]" : "[ ]";
    const priority = todo.priority !== "medium" ? ` [!${todo.priority}]` : "";
    const due = todo.due_date ? ` 📅 ${todo.due_date}` : "";
    return `- ${checkbox}${priority} ${todo.title}${due}`;
  }

  private formatDocContent(doc: SyncDoc): string {
    const statusLabel: Record<string, string> = {
      draft: "草稿",
      published: "已发布",
      archived: "已归档",
    };
    const status = statusLabel[doc.status] || doc.status;
    const updated = doc.updated_at ? doc.updated_at.slice(0, 10) : "";

    const frontmatter = [
      "---",
      `id: ${doc.id}`,
      `title: ${doc.title}`,
      `status: ${status}`,
      updated ? `updated_at: ${updated}` : "",
      "---",
      "",
    ].filter((line) => line !== "").join("\n");

    return frontmatter + (doc.content || "");
  }

  private async appendToFile(filePath: string, line: string): Promise<void> {
    // 确保目录存在
    const dirPath = filePath.substring(0, filePath.lastIndexOf("/"));
    if (dirPath) {
      const dir = this.vault.getAbstractFileByPath(dirPath);
      if (!dir) {
        await this.vault.createFolder(dirPath);
      }
    }

    const abstractFile = this.vault.getAbstractFileByPath(filePath);
    if (abstractFile instanceof TFile) {
      await this.vault.append(abstractFile, line + "\n");
    } else if (abstractFile === null) {
      await this.vault.create(filePath, line + "\n");
    }
    // abstractFile 为 TFolder 时不可能 (同名路径), 静默跳过
  }
}
