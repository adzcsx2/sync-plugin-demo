"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => SyncPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian4 = require("obsidian");

// src/settings.ts
var import_obsidian = require("obsidian");
var DEFAULT_SETTINGS = {
  serverUrl: "http://127.0.0.1:8006",
  userId: "",
  syncIntervalMinutes: 5
};
var SyncSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Sync Plugin Settings" });
    new import_obsidian.Setting(containerEl).setName("Server URL").setDesc("Sync server address").addText(
      (text) => text.setPlaceholder("http://127.0.0.1:8006").setValue(this.plugin.settings.serverUrl).onChange(async (value) => {
        this.plugin.settings.serverUrl = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("User ID").setDesc("Your user identifier on the sync server").addText(
      (text) => text.setPlaceholder("alice").setValue(this.plugin.settings.userId).onChange(async (value) => {
        this.plugin.settings.userId = value.trim();
        await this.plugin.saveSettings();
      })
    );
    const intervalSetting = new import_obsidian.Setting(containerEl).setName("Sync interval (minutes)").setDesc("How often to sync (desktop only)").addText((text) => {
      text.setPlaceholder("5").setValue(String(this.plugin.settings.syncIntervalMinutes)).onChange(async (value) => {
        const trimmed = value.trim();
        const num = Number(trimmed);
        if (trimmed !== "" && !isNaN(num) && num > 0 && Number.isInteger(num)) {
          this.plugin.settings.syncIntervalMinutes = num;
          intervalSetting.setDesc("How often to sync (desktop only)");
          await this.plugin.saveSettings();
          this.plugin.syncEngine.restartPolling();
        } else {
          intervalSetting.setDesc("Please enter a positive integer (e.g. 5)");
        }
      });
      return text;
    });
  }
};

// src/sync.ts
var import_obsidian2 = require("obsidian");
var SyncEngine = class {
  constructor(plugin) {
    this.timer = null;
    this.plugin = plugin;
  }
  buildSyncUrl(since) {
    const base = this.plugin.settings.serverUrl.replace(/\/+$/, "");
    const userId = encodeURIComponent(this.plugin.settings.userId);
    let url = `${base}/api/sync?user_id=${userId}`;
    if (since) {
      url += `&since=${encodeURIComponent(since)}`;
    }
    return url;
  }
  async syncNow() {
    if (!this.plugin.settings.userId) {
      console.warn("[SyncPlugin] User ID not set, skipping sync");
      return;
    }
    try {
      const cursor = await this.plugin.loadCursor();
      const url = this.buildSyncUrl(cursor || void 0);
      const response = await (0, import_obsidian2.requestUrl)({ url, method: "GET" });
      const body = response.json;
      if (!body || !body.success) {
        console.warn("[SyncPlugin] Sync failed:", body?.error || "unknown error");
        return;
      }
      const result = body.data;
      if (!result || !Array.isArray(result.events) || !Array.isArray(result.todos) || !Array.isArray(result.docs) || typeof result.cursor !== "string") {
        console.error("[SyncPlugin] Invalid sync response format:", body);
        this.plugin.lastSyncTime = "Error";
        this.plugin.updateStatusBar();
        return;
      }
      await this.plugin.vaultWriter.writeEvents(result.events);
      await this.plugin.vaultWriter.writeTodos(result.todos);
      await this.plugin.vaultWriter.writeDocs(result.docs);
      await this.plugin.saveCursor(result.cursor);
      this.plugin.lastSyncTime = (/* @__PURE__ */ new Date()).toLocaleTimeString();
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
  startPolling() {
    this.stopPolling();
    const intervalMs = this.plugin.settings.syncIntervalMinutes * 60 * 1e3;
    this.syncNow();
    this.timer = window.setInterval(() => {
      this.syncNow();
    }, intervalMs);
    console.log(`[SyncPlugin] Polling every ${this.plugin.settings.syncIntervalMinutes} min`);
  }
  stopPolling() {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }
  restartPolling() {
    console.log("[SyncPlugin] Restarting polling with new interval");
    this.stopPolling();
    this.startPolling();
  }
};

// src/vault_writer.ts
var import_obsidian3 = require("obsidian");
var VaultWriter = class {
  constructor(vault) {
    // 已写入的事件/待办/文档 ID 集合，防止 cursor 丢失导致重复写入
    this.writtenEventIds = /* @__PURE__ */ new Set();
    this.writtenTodoIds = /* @__PURE__ */ new Set();
    this.writtenDocIds = /* @__PURE__ */ new Set();
    this.vault = vault;
  }
  async writeEvents(events) {
    for (const evt of events) {
      if (this.writtenEventIds.has(evt.id)) {
        continue;
      }
      await this.writeEvent(evt);
      this.writtenEventIds.add(evt.id);
    }
  }
  async writeTodos(todos) {
    for (const todo of todos) {
      if (this.writtenTodoIds.has(todo.id)) {
        continue;
      }
      await this.writeTodo(todo);
      this.writtenTodoIds.add(todo.id);
    }
  }
  async writeDocs(docs) {
    for (const doc of docs) {
      if (this.writtenDocIds.has(doc.id)) {
        continue;
      }
      await this.writeDoc(doc);
      this.writtenDocIds.add(doc.id);
    }
  }
  async writeEvent(evt) {
    if (evt.action === "delete") {
      console.log("[SyncPlugin] Event delete ignored (soft delete)");
      return;
    }
    const filePath = `Calendar/${evt.date}.md`;
    const line = this.formatEventLine(evt);
    await this.appendToFile(filePath, line);
  }
  async writeTodo(todo) {
    if (todo.action === "delete") {
      console.log("[SyncPlugin] Todo delete ignored (soft delete)");
      return;
    }
    const filePath = `Todos/\u5F85\u529E\u4E8B\u9879.md`;
    const line = this.formatTodoLine(todo);
    await this.appendToFile(filePath, line);
  }
  async writeDoc(doc) {
    if (doc.action === "delete" || doc.deleted) {
      console.log("[SyncPlugin] Doc delete ignored (soft delete)");
      return;
    }
    const filePath = `Docs/${doc.title}.md`;
    const content = this.formatDocContent(doc);
    const abstractFile = this.vault.getAbstractFileByPath(filePath);
    if (abstractFile instanceof import_obsidian3.TFile) {
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
  formatEventLine(evt) {
    const desc = evt.description ? ` - ${evt.description}` : "";
    const duration = evt.duration_minutes ? ` (${evt.duration_minutes}min)` : "";
    return `- **${evt.time}** ${evt.title}${duration}${desc}`;
  }
  formatTodoLine(todo) {
    const checkbox = todo.done ? "[x]" : "[ ]";
    const priority = todo.priority !== "medium" ? ` [!${todo.priority}]` : "";
    const due = todo.due_date ? ` \u{1F4C5} ${todo.due_date}` : "";
    return `- ${checkbox}${priority} ${todo.title}${due}`;
  }
  formatDocContent(doc) {
    const statusLabel = {
      draft: "\u8349\u7A3F",
      published: "\u5DF2\u53D1\u5E03",
      archived: "\u5DF2\u5F52\u6863"
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
      ""
    ].filter((line) => line !== "").join("\n");
    return frontmatter + (doc.content || "");
  }
  async appendToFile(filePath, line) {
    const dirPath = filePath.substring(0, filePath.lastIndexOf("/"));
    if (dirPath) {
      const dir = this.vault.getAbstractFileByPath(dirPath);
      if (!dir) {
        await this.vault.createFolder(dirPath);
      }
    }
    const abstractFile = this.vault.getAbstractFileByPath(filePath);
    if (abstractFile instanceof import_obsidian3.TFile) {
      await this.vault.append(abstractFile, line + "\n");
    } else if (abstractFile === null) {
      await this.vault.create(filePath, line + "\n");
    }
  }
};

// src/main.ts
function isMobile() {
  return import_obsidian4.Platform.isMobile || import_obsidian4.Platform.isAndroidApp || import_obsidian4.Platform.isIosApp;
}
var SyncPlugin = class extends import_obsidian4.Plugin {
  constructor() {
    super(...arguments);
    this.lastSyncTime = "";
  }
  async onload() {
    await this.loadSettings();
    this.syncEngine = new SyncEngine(this);
    this.vaultWriter = new VaultWriter(this.app.vault);
    this.addSettingTab(new SyncSettingTab(this.app, this));
    this.statusBarEl = this.addStatusBarItem();
    this.updateStatusBar();
    this.addRibbonIcon("refresh-cw", "Sync now", async () => {
      await this.syncEngine.syncNow();
    });
    this.addCommand({
      id: "sync-now",
      name: "Sync now",
      callback: async () => {
        await this.syncEngine.syncNow();
      }
    });
    if (isMobile()) {
      console.log("[SyncPlugin] Mobile platform detected - manual sync only");
      this.app.workspace.onLayoutReady(() => {
        this.syncEngine.syncNow().catch((err) => {
          console.error("[SyncPlugin] Initial mobile sync failed:", err);
        });
      });
    } else {
      console.log("[SyncPlugin] Desktop platform detected - starting auto-polling");
      this.app.workspace.onLayoutReady(() => {
        this.syncEngine.startPolling();
      });
    }
    console.log("[SyncPlugin] Loaded. Server:", this.settings.serverUrl);
  }
  onunload() {
    this.syncEngine.stopPolling();
    console.log("[SyncPlugin] Unloaded");
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  async loadCursor() {
    const data = await this.loadData();
    return data?._cursor || null;
  }
  async saveCursor(cursor) {
    const data = await this.loadData();
    data._cursor = cursor;
    await this.saveData(data);
  }
  updateStatusBar() {
    if (this.lastSyncTime) {
      this.statusBarEl.setText(`Sync: ${this.lastSyncTime}`);
    } else {
      this.statusBarEl.setText("Sync: --");
    }
  }
};
