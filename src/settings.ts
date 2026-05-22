import { App, PluginSettingTab, Setting } from "obsidian";
import type SyncPlugin from "./main";

export interface SyncPluginSettings {
  serverUrl: string;
  userId: string;
  syncIntervalMinutes: number;
}

export const DEFAULT_SETTINGS: SyncPluginSettings = {
  serverUrl: "http://127.0.0.1:8006",
  userId: "",
  syncIntervalMinutes: 5,
};

export class SyncSettingTab extends PluginSettingTab {
  plugin: SyncPlugin;

  constructor(app: App, plugin: SyncPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Sync Plugin Settings" });

    new Setting(containerEl)
      .setName("Server URL")
      .setDesc("Sync server address")
      .addText((text) =>
        text
          .setPlaceholder("http://127.0.0.1:8006")
          .setValue(this.plugin.settings.serverUrl)
          .onChange(async (value) => {
            this.plugin.settings.serverUrl = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("User ID")
      .setDesc("Your user identifier on the sync server")
      .addText((text) =>
        text
          .setPlaceholder("alice")
          .setValue(this.plugin.settings.userId)
          .onChange(async (value) => {
            this.plugin.settings.userId = value.trim();
            await this.plugin.saveSettings();
          })
      );

    const intervalSetting = new Setting(containerEl)
      .setName("Sync interval (minutes)")
      .setDesc("How often to sync (desktop only)")
      .addText((text) => {
        text
          .setPlaceholder("5")
          .setValue(String(this.plugin.settings.syncIntervalMinutes))
          .onChange(async (value) => {
            const trimmed = value.trim();
            // 使用 Number() 替代 parseInt, 拒绝部分数字输入
            const num = Number(trimmed);
            if (trimmed !== "" && !isNaN(num) && num > 0 && Number.isInteger(num)) {
              this.plugin.settings.syncIntervalMinutes = num;
              intervalSetting.setDesc("How often to sync (desktop only)");
              await this.plugin.saveSettings();
              // 设置变更后重启轮询
              this.plugin.syncEngine.restartPolling();
            } else {
              // 无效输入: 给出视觉反馈
              intervalSetting.setDesc("Please enter a positive integer (e.g. 5)");
            }
          });
        return text;
      });
  }
}
