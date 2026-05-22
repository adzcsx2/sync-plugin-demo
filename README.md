# Sync Plugin Demo

将远程服务器的日程和待办同步到 Obsidian vault。支持桌面端（定时自动轮询）和手机端（打开即同步 + 手动触发）。

---

## 安装

### 方式一：BRAT 插件安装（推荐）

BRAT（Beta Reviewers Auto-update Tester）支持从任意 Git 仓库安装插件，无需通过官方市场。

1. 先在 Obsidian 中安装 BRAT 插件（社区插件市场搜索 "BRAT"）
2. 打开 BRAT 设置，点击 **Add Beta plugin**
3. 输入本仓库地址：

   ```
   https://gitee.com/Hoyn/sync-plugin-demo
   ```

4. 安装完毕后，在第三方插件列表中找到 **Sync Plugin Demo**，打开开关

> BRAT 会自动检测仓库更新，有新版本时会提示升级。

### 方式二：手动安装

1. 在本仓库页面点击「克隆/下载」→「下载 ZIP」
2. 解压后将整个文件夹放入 vault 的 `.obsidian/plugins/` 目录
3. 在 Obsidian 的第三方插件列表中启用 **Sync Plugin Demo**

---

## 配置

启用后在插件设置中填写：

| 设置项 | 说明 | 示例 |
|--------|------|------|
| Server URL | 同步服务器地址 | 桌面端 `http://127.0.0.1:8006`，手机端填电脑局域网 IP |
| User ID | 用户标识，需和 Web 端一致 | `alice` |
| Sync interval | 同步间隔（分钟），仅桌面端生效 | `5` |

---

## 同步效果

| 平台 | 同步方式 |
|------|----------|
| 桌面端 | 启动后每隔 N 分钟自动轮询 + 左侧 Ribbon 图标 + 命令面板 `Sync now` |
| 手机端 | 打开 Obsidian 时同步一次 + Ribbon 图标 + 命令面板 `Sync now` |

同步成功后，vault 中生成以下文件：

```
Calendar/
  2026-05-22.md       # 该日期的日程

Todos/
  待办事项.md          # 待办清单
```

---

## 自己搭建服务器

本插件需要配合后端服务使用。详见 [Obsidian Demo 项目](https://gitee.com/Hoyn/sync-plugin-demo)。

简要步骤：

```bash
# 1. 配置
cp .env.example .env

# 2. 启动
./start.sh

# 3. 验证
curl http://127.0.0.1:8006/api/status
```

---

## 开发

```bash
npm install
npm run dev          # 监听模式，文件变更自动重新编译
npm run build        # 生产构建（类型检查 + 打包）
```
