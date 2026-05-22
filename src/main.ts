import { Platform, Plugin } from "obsidian";
import { SyncPluginSettings, DEFAULT_SETTINGS, SyncSettingTab } from "./settings";
import { SyncEngine } from "./sync";
import { VaultWriter } from "./vault_writer";

function isMobile(): boolean {
  return Platform.isMobile || Platform.isAndroidApp || Platform.isIosApp;
}

export default class SyncPlugin extends Plugin {
  settings!: SyncPluginSettings;
  syncEngine!: SyncEngine;
  vaultWriter!: VaultWriter;
  lastSyncTime: string = "";
  private statusBarEl!: HTMLElement;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.syncEngine = new SyncEngine(this);
    this.vaultWriter = new VaultWriter(this.app.vault);

    this.addSettingTab(new SyncSettingTab(this.app, this));

    // 状态栏
    this.statusBarEl = this.addStatusBarItem();
    this.updateStatusBar();

    // Ribbon 图标 - 手动同步
    this.addRibbonIcon("refresh-cw", "Sync now", async () => {
      await this.syncEngine.syncNow();
    });

    // 命令面板 - 手动同步
    this.addCommand({
      id: "sync-now",
      name: "Sync now",
      callback: async () => {
        await this.syncEngine.syncNow();
      },
    });

    // 平台检测：桌面端定时轮询，手机端仅手动触发
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

  onunload(): void {
    this.syncEngine.stopPolling();
    console.log("[SyncPlugin] Unloaded");
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  async loadCursor(): Promise<string | null> {
    const data = await this.loadData();
    return data?._cursor || null;
  }

  async saveCursor(cursor: string): Promise<void> {
    // cursor 存为独立 key, 避免 loadData + mutate + saveData 带来的读-改-写竞态
    const data = await this.loadData();
    data._cursor = cursor;
    await this.saveData(data);
  }

  updateStatusBar(): void {
    if (this.lastSyncTime) {
      this.statusBarEl.setText(`Sync: ${this.lastSyncTime}`);
    } else {
      this.statusBarEl.setText("Sync: --");
    }
  }
}
