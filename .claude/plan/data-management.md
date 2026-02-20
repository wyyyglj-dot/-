# 📋 实施计划：数据管理模块（备份/导入/迁移）

## 任务类型
- [x] 前端 (→ Gemini)
- [x] 后端 (→ Codex)
- [x] 全栈 (→ 并行)

## 交叉验证摘要

| 维度 | Codex 观点 | Gemini 观点 | 共识 |
|------|-----------|-------------|------|
| 架构方案 | Electron IPC + REST API + Web 上传/下载兜底 | Settings 页面 + IPC 文件对话框 | ✅ 一致 |
| 导航入口 | — | 新增"系统设置"侧边栏项 | ✅ Gemini 主导 |
| 备份方式 | VACUUM INTO（WAL 安全）| 下载按钮 + 原生保存对话框 | ✅ 互补 |
| 恢复安全 | 维护模式 + integrity_check + 自动回滚 | 双重确认弹窗（延时按钮）| ✅ 互补 |
| 路径持久化 | config.json（不存 DB，避免鸡生蛋）| — | ✅ Codex 主导 |
| 移动端 | — | 隐藏/禁用数据管理功能 | ✅ Gemini 主导 |
| 连接管理 | 新增 closeDb/reopenDb + 维护锁 | — | ✅ Codex 主导 |

## 技术方案

### 架构：Electron IPC + REST API 双通道

```
用户操作 → 前端判断环境
  ├─ Electron → IPC 调用原生文件对话框 → 获取路径 → POST /api/v1/system/db/*
  └─ Web → 上传/下载方式 → POST /api/v1/system/db/*
```

### 后端 API 设计（挂载 `/api/v1`）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/system/db` | 获取数据库状态（路径、大小、最后备份时间） |
| POST | `/system/db/backup` | 备份数据库（Electron: 指定路径; Web: 返回文件流下载） |
| POST | `/system/db/restore` | 恢复数据库（Electron: 指定源路径; Web: multipart 上传） |
| POST | `/system/db/migrate` | 迁移数据库路径 |

### 数据库连接管理（核心安全流程）

```
备份流程：
  wal_checkpoint(FULL) → VACUUM INTO <target> → 校验目标文件

恢复流程：
  进入维护模式(503) → closeDb() → 备份现库(.bak) → 替换文件
  → reopenDb() → integrity_check → 成功则删.bak / 失败则回滚

迁移流程：
  进入维护模式(503) → closeDb() → 复制文件到新路径
  → 更新 config.json → reopenDb(newPath) → integrity_check
  → 成功则删旧文件 / 失败则回滚
```

### 路径配置持久化

使用独立 `config.json` 文件（不存 DB 内，避免鸡生蛋问题）：
- Electron: `%APPDATA%/diancan/config.json`
- 开发模式: `./data/config.json`
- 解析优先级: `ENV(DB_PATH)` > `config.json.dbPath` > 默认路径

### 前端页面设计

- 入口：侧边栏新增"系统设置"导航项（最后一项）
- 路由：`/settings`
- 布局：卡片式 Dashboard，分为"存储位置"和"备份与恢复"两个区域
- 移动端：隐藏此页面（数据管理仅限主终端操作）

## 实施步骤

### Step 1：后端 - 数据库管理器 (`server/src/db/client.ts`)

扩展现有 `client.ts`，新增连接生命周期管理：

```typescript
// 新增导出
export function closeDb(): void
export function reopenDb(dbPath?: string): void
export function getDbPath(): string
export function isMaintenanceMode(): boolean
export function withMaintenance<T>(fn: () => T): T
```

- `closeDb()`: 执行 `wal_checkpoint(FULL)` 后关闭连接
- `reopenDb(path?)`: 重新打开数据库（可选新路径），执行 WAL/FK pragma
- `withMaintenance(fn)`: 设置维护标志，执行 fn，清除标志
- 维护模式中间件：请求到达时检查标志，返回 503

预期产物：安全的数据库关闭/重连能力

### Step 2：后端 - 路径配置持久化 (`server/src/config/constants.ts`)

修改 `resolveDbPath()` 支持从 `config.json` 读取：

```typescript
function resolveDbPath(): string {
  if (process.env.DB_PATH) return process.env.DB_PATH
  const configPath = getConfigPath()
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    if (config.dbPath) return config.dbPath
  }
  if (process.env.ELECTRON_USER_DATA) {
    return path.join(process.env.ELECTRON_USER_DATA, 'diancan.db')
  }
  return './data/diancan.db'
}

export function updateDbPathConfig(newPath: string): void
export function getConfigPath(): string
```

预期产物：路径配置可持久化、可运行时更新

### Step 3：后端 - 数据管理 API (`server/src/modules/system/`)

扩展 `system.router.ts`，新增数据管理端点：

**GET `/system/db`**
```json
{ "path": "...", "sizeBytes": 12345, "walMode": true }
```

**POST `/system/db/backup`**
- 请求 `{ targetPath?: string }` — 有 targetPath 则写入指定路径，无则返回文件流
- 使用 `VACUUM INTO` 生成一致性备份
- 校验生成文件可打开

**POST `/system/db/restore`**
- Electron: `{ sourcePath: string }`
- Web: multipart 文件上传（需添加 multer 中间件）
- 流程：维护模式 → 关闭 → 备份现库 → 替换 → 重开 → integrity_check → 回滚兜底

**POST `/system/db/migrate`**
- 请求 `{ newPath: string, mode: "move" | "copy" }`
- 流程：维护模式 → 关闭 → 复制/移动文件 → 更新 config.json → 重开 → 校验

预期产物：完整的数据管理 REST API

### Step 4：Electron - IPC 桥接 (`electron/main.ts` + `electron/preload.ts`)

**preload.ts** — 通过 contextBridge 暴露安全 API：
```typescript
contextBridge.exposeInMainWorld('electronAPI', {
  showSaveDialog: (options) => ipcRenderer.invoke('dialog:save', options),
  showOpenDialog: (options) => ipcRenderer.invoke('dialog:open', options),
  isElectron: true,
})
```

**main.ts** — 注册 IPC 处理器：
```typescript
ipcMain.handle('dialog:save', (_, options) => dialog.showSaveDialog(mainWindow!, options))
ipcMain.handle('dialog:open', (_, options) => dialog.showOpenDialog(mainWindow!, options))
```

预期产物：Electron 环境下可调用原生文件对话框

### Step 5：前端 - API 层 (`web/src/api/system.ts`)

新增数据管理 API 调用：
```typescript
export function getDbStatus(): Promise<DbStatus>
export function backupDb(targetPath?: string): Promise<void>  // Electron
export function downloadBackup(): Promise<Blob>               // Web
export function restoreDb(sourcePath: string): Promise<void>   // Electron
export function uploadRestore(file: File): Promise<void>       // Web
export function migrateDb(newPath: string, mode: 'move' | 'copy'): Promise<void>
```

预期产物：前端可调用所有数据管理操作

### Step 6：前端 - 设置页面 (`web/src/views/Settings.vue`)

**布局设计（卡片式）：**

```
┌─────────────────────────────────────────────┐
│  系统设置                                     │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─ 存储位置 ─────────────────────────────┐ │
│  │ 当前路径: C:\Users\...\diancan.db      │ │
│  │ 数据库大小: 2.3 MB                     │ │
│  │                        [更改位置]       │ │
│  └────────────────────────────────────────┘ │
│                                             │
│  ┌─ 备份与恢复 ───────────────────────────┐ │
│  │                                        │ │
│  │  [导出备份]          [导入恢复]         │ │
│  │  安全导出数据         从备份文件恢复     │ │
│  │  (绿色/安全)         (红色/危险)        │ │
│  └────────────────────────────────────────┘ │
│                                             │
└─────────────────────────────────────────────┘
```

- 使用 Naive UI 的 NCard、NButton、NModal、NSpin
- 恢复操作：双重确认弹窗（3 秒延时按钮）
- 迁移操作：选择"移动数据"或"仅切换路径"
- 全屏 loading 遮罩用于恢复/迁移期间

预期产物：完整的数据管理 UI 页面

### Step 7：前端 - 路由与导航

- `web/src/router/index.ts`: 新增 `/settings` 路由
- `web/src/components/layout/AppSidebar.vue`: 新增"系统设置"菜单项（最后一项）
- 移动端路由不添加此页面

预期产物：可从侧边栏访问设置页面

## 关键文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `server/src/db/client.ts` | 修改 | 新增 closeDb/reopenDb/维护模式 |
| `server/src/config/constants.ts` | 修改 | 支持 config.json 读取路径 |
| `server/src/modules/system/system.router.ts` | 修改 | 新增 4 个数据管理端点 |
| `electron/main.ts` | 修改 | 新增 IPC dialog 处理器 |
| `electron/preload.ts` | 修改 | 暴露 electronAPI 到渲染进程 |
| `web/src/api/system.ts` | 新建 | 数据管理 API 调用 |
| `web/src/views/Settings.vue` | 新建 | 设置页面 |
| `web/src/router/index.ts` | 修改 | 新增 /settings 路由 |
| `web/src/components/layout/AppSidebar.vue` | 修改 | 新增菜单项 |

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| WAL 模式下备份不完整 | 使用 VACUUM INTO（自动 checkpoint），不直接复制文件 |
| 恢复失败导致数据丢失 | 恢复前自动备份现库为 .bak，失败自动回滚 |
| 迁移中断导致双份或无库 | 先复制再切换，验证成功后才删旧文件 |
| 维护模式期间请求失败 | 前端显示全屏遮罩，后端返回 503 + 友好提示 |
| Web 环境无法选择本地路径 | Web 端仅支持上传/下载，路径迁移仅 Electron 可用 |
| config.json 被手动篡改 | 启动时校验 config.json 格式，无效则回退默认路径 |

## SESSION_ID（供 /ccg:execute 使用）
- CODEX_SESSION: 019c7538-d0b0-77f2-a0d1-28b7a6609f12
- GEMINI_SESSION: 78e5ba50-06df-4505-af0f-a2fda6c3856d
