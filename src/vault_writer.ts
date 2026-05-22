import { TFile, type Vault } from "obsidian";
import type { SyncEvent, SyncTodo } from "./sync";

export class VaultWriter {
  vault: Vault;
  // 已写入的事件/待办 ID 集合，防止 cursor 丢失导致重复写入
  private writtenEventIds: Set<string> = new Set();
  private writtenTodoIds: Set<string> = new Set();

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

  private async writeEvent(evt: SyncEvent): Promise<void> {
    if (evt.action === "delete") {
      console.log("[SyncPlugin] Event delete ignored (soft delete)");
      return;
    }

    const filePath = `Calendar/${evt.date}.md`;
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

  private formatEventLine(evt: SyncEvent): string {
    const desc = evt.description ? ` - ${evt.description}` : "";
    const duration = evt.duration_minutes ? ` (${evt.duration_minutes}min)` : "";
    return `- **${evt.time}** ${evt.title}${duration}${desc}`;
  }

  private formatTodoLine(todo: SyncTodo): string {
    const checkbox = todo.done ? "[x]" : "[ ]";
    const priority = todo.priority !== "medium" ? ` [!${todo.priority}]` : "";
    const due = todo.due_date ? ` 📅 ${todo.due_date}` : "";
    return `- ${checkbox}${priority} ${todo.title}${due}`;
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
