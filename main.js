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
var import_obsidian3 = require("obsidian");

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
    new import_obsidian.Setting(containerEl).setName("Sync interval (minutes)").setDesc("How often to sync (desktop only)").addText(
      (text) => text.setPlaceholder("5").setValue(String(this.plugin.settings.syncIntervalMinutes)).onChange(async (value) => {
        const num = parseInt(value, 10);
        if (!isNaN(num) && num > 0) {
          this.plugin.settings.syncIntervalMinutes = num;
          await this.plugin.saveSettings();
        }
      })
    );
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
      await this.plugin.saveCursor(result.cursor);
      this.plugin.lastSyncTime = (/* @__PURE__ */ new Date()).toLocaleTimeString();
      this.plugin.updateStatusBar();
      console.log(
        `[SyncPlugin] Synced: ${result.events.length} events, ${result.todos.length} todos`
      );
    } catch (err) {
      console.error("[SyncPlugin] Sync error:", err);
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
};

// src/vault_writer.ts
var VaultWriter = class {
  constructor(vault) {
    this.vault = vault;
  }
  async writeEvents(events) {
    for (const evt of events) {
      await this.writeEvent(evt);
    }
  }
  async writeTodos(todos) {
    for (const todo of todos) {
      await this.writeTodo(todo);
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
  async appendToFile(filePath, line) {
    const dirPath = filePath.substring(0, filePath.lastIndexOf("/"));
    if (dirPath) {
      const dir = this.vault.getAbstractFileByPath(dirPath);
      if (!dir) {
        await this.vault.createFolder(dirPath);
      }
    }
    const abstractFile = this.vault.getAbstractFileByPath(filePath);
    if (abstractFile) {
      await this.vault.append(abstractFile, line + "\n");
    } else {
      await this.vault.create(filePath, line + "\n");
    }
  }
};

// src/main.ts
function isMobile() {
  return import_obsidian3.Platform.isMobile || import_obsidian3.Platform.isAndroidApp || import_obsidian3.Platform.isIosApp;
}
var SyncPlugin = class extends import_obsidian3.Plugin {
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
        this.syncEngine.syncNow();
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
    return data?.cursor || null;
  }
  async saveCursor(cursor) {
    const data = await this.loadData();
    data.cursor = cursor;
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
