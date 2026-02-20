# 📋 实施计划：点餐系统 Electron 商业化桌面打包

## 方案概述

将点餐系统打包为 Electron 商业级桌面应用，生成 Windows NSIS 安装包。
双击安装 → 桌面图标启动 → 原生窗口体验 → 系统托盘常驻。

## 任务类型

- [x] 后端 (→ Codex)
- [x] 前端 (→ Gemini)
- [x] 全栈 (→ 并行)

## 技术方案

### 架构设计

```text
diancan/
├── electron/                        # 新增：Electron 层
│   ├── main.ts                      # 主进程入口：启动 Express + 创建窗口
│   ├── preload.ts                   # 预加载脚本（安全桥接）
│   └── tray.ts                      # 系统托盘管理
├── server/                          # 现有后端（微调）
│   ├── src/
│   │   ├── app.ts                   # 修改：添加静态文件托管
│   │   ├── config/constants.ts      # 修改：DB 路径适配 Electron
│   │   └── server.ts                # 修改：导出 startServer() 函数
│   └── ...
├── web/                             # 现有前端（无需修改）
├── electron-builder.yml             # 新增：打包配置
├── tsconfig.electron.json           # 新增：Electron TS 配置
└── package.json                     # 修改：添加 Electron 相关脚本和依赖
```

### 运行时架构

```
Electron Main Process
  ├── 启动 Express Server (内嵌，非子进程)
  │   ├── REST API (/api/v1/*)
  │   ├── SSE (/api/v1/events)
  │   └── 静态文件 (web/dist → /)
  ├── 创建 BrowserWindow → 加载 http://127.0.0.1:3000
  └── 系统托盘（最小化/退出）
```

关键决策：Express 在主进程内直接运行（非 fork），避免 IPC 复杂度。
BrowserWindow 加载 `http://127.0.0.1:3000` 而非 `file://`，保证 SSE/API 同源。

## 实施步骤

### Step 1：安装 Electron 依赖

根 `package.json` 添加：

```json
{
  "devDependencies": {
    "electron": "^33.0.0",
    "electron-builder": "^25.0.0",
    "@electron/rebuild": "^3.7.0"
  },
  "scripts": {
    "electron:dev": "...",
    "electron:build": "...",
    "dist": "electron-builder"
  }
}
```

安装后执行 `npx @electron/rebuild -m server` 为 Electron 的 Node ABI 重编译 `better-sqlite3`。

预期产物：依赖就绪，better-sqlite3 兼容 Electron

### Step 2：修改 server 导出启动函数

文件：`server/src/server.ts`

```typescript
import { app } from './app'
import { PORT } from './config/constants'
import { initDb } from './db/client'
import { runMigrations } from './db/migrate'

export function startServer(): Promise<number> {
  initDb()
  runMigrations()
  return new Promise((resolve) => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`)
      resolve(PORT)
    })
  })
}

// 独立运行时直接启动（兼容非 Electron 场景）
if (require.main === module) {
  startServer()
}
```

预期产物：server 既可独立运行，也可被 Electron 主进程 import 调用

### Step 3：修改 Express 托管前端静态文件

文件：`server/src/app.ts`

在所有 API 路由之后、errorHandler 之前添加：

```typescript
import path from 'path'

// 生产环境：托管前端静态文件
if (process.env.NODE_ENV === 'production') {
  const webRoot = path.join(__dirname, '../../web-dist')
  app.use(express.static(webRoot))
  // SPA fallback
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) return next()
    res.sendFile(path.join(webRoot, 'index.html'))
  })
}

app.use(errorHandler)
```

预期产物：单端口同时提供 API + 前端页面

### Step 4：修改数据库路径策略

文件：`server/src/config/constants.ts`

```typescript
import path from 'path'

function resolveDbPath(): string {
  // 环境变量优先
  if (process.env.DB_PATH) return process.env.DB_PATH
  // Electron 生产环境：使用 userData 目录（可写）
  if (process.env.ELECTRON_USER_DATA) {
    return path.join(process.env.ELECTRON_USER_DATA, 'diancan.db')
  }
  // 开发环境：当前目录
  return './data/diancan.db'
}

export const PORT = Number(process.env.PORT) || 3000
export const DB_PATH = resolveDbPath()
export const CORS_ORIGIN = process.env.CORS_ORIGIN || '*'
```

预期产物：Electron 下数据库存储在 `%APPDATA%/diancan/` 目录，避免权限问题

### Step 5：创建 Electron 主进程

新文件：`electron/main.ts`

```typescript
import { app, BrowserWindow, Tray, Menu, nativeImage } from 'electron'
import path from 'path'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

// 设置环境变量（在 import server 之前）
process.env.NODE_ENV = 'production'
process.env.ELECTRON_USER_DATA = app.getPath('userData')

async function createWindow(port: number) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: '点餐系统',
    icon: path.join(__dirname, '../assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.loadURL(`http://127.0.0.1:${port}`)

  // 关闭时最小化到托盘而非退出
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault()
      mainWindow?.hide()
    }
  })
}

function createTray() {
  const icon = nativeImage.createFromPath(
    path.join(__dirname, '../assets/icon.png')
  )
  tray = new Tray(icon.resize({ width: 16, height: 16 }))
  tray.setToolTip('点餐系统')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示主窗口', click: () => mainWindow?.show() },
    { label: '退出', click: () => { app.isQuitting = true; app.quit() } },
  ]))
  tray.on('double-click', () => mainWindow?.show())
}

app.whenReady().then(async () => {
  // 动态导入 server（确保环境变量已设置）
  const { startServer } = require('../server/dist/server')
  const port = await startServer()

  createTray()
  await createWindow(port)
})

app.on('window-all-closed', () => {
  // Windows: 不退出，保持托盘运行
})
```

预期产物：Electron 主进程，管理窗口生命周期 + 系统托盘

### Step 6：创建 Electron 预加载脚本

新文件：`electron/preload.ts`

```typescript
// 最小预加载脚本，保持安全隔离
// 如需后续扩展（如暴露版本号），在此添加 contextBridge
```

预期产物：安全的渲染进程隔离

### Step 7：创建 electron-builder 打包配置

新文件：`electron-builder.yml`

```yaml
appId: com.diancan.app
productName: 点餐系统
directories:
  output: release
  buildResources: assets
files:
  - electron/dist/**/*
  - server/dist/**/*
  - server/node_modules/**/*
  - web-dist/**/*
  - assets/**/*
asarUnpack:
  - "**/*.node"
  - server/node_modules/better-sqlite3/**/*
win:
  target:
    - target: nsis
      arch: [x64]
  icon: assets/icon.ico
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  installerIcon: assets/icon.ico
  uninstallerIcon: assets/icon.ico
  createDesktopShortcut: true
  createStartMenuShortcut: true
  shortcutName: 点餐系统
```

关键：`asarUnpack` 将 `better-sqlite3` 的 `.node` 文件解包到磁盘，避免 asar 虚拟文件系统无法加载原生模块。

预期产物：electron-builder 配置，生成 NSIS 安装包

### Step 8：创建 Electron TypeScript 配置

新文件：`tsconfig.electron.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "electron/dist",
    "rootDir": "electron",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["electron/**/*.ts"]
}
```

预期产物：Electron 层独立编译配置

### Step 9：添加构建脚本

根 `package.json` 添加 scripts：

```json
{
  "scripts": {
    "build:server": "cd server && npm run build",
    "build:web": "cd web && npm run build && cp -r dist ../web-dist",
    "build:electron": "tsc -p tsconfig.electron.json",
    "rebuild:native": "npx @electron/rebuild -m server",
    "predist": "npm run build:server && npm run build:web && npm run build:electron",
    "dist": "electron-builder --win",
    "electron:dev": "npm run build:server && npm run build:electron && electron ."
  },
  "main": "electron/dist/main.js"
}
```

预期产物：一键构建 + 打包命令

### Step 10：准备应用图标

新目录：`assets/`

- `assets/icon.png` — 512x512 应用图标
- `assets/icon.ico` — Windows ICO 格式（含 16/32/48/256 多尺寸）

预期产物：应用图标资源（需用户提供或生成）

### Step 11：验证与测试

1. 开发模式验证：`npm run electron:dev`
2. 打包验证：`npm run dist`
3. 安装包测试：在干净 Windows 10 环境安装并验证
4. 验证项：
   - 安装/卸载流程
   - 启动速度
   - API 请求 + SSE 实时推送
   - SQLite 数据库读写
   - 系统托盘（最小化/恢复/退出）
   - 手机局域网访问（`http://192.168.x.x:3000`）
   - 关闭窗口后服务仍运行（托盘模式）

预期产物：验证通过的安装包

## 关键文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `package.json` | 修改 | 添加 Electron 依赖 + 构建脚本 + main 入口 |
| `server/src/server.ts` | 修改 | 导出 startServer() 函数 |
| `server/src/app.ts` | 修改 | 添加静态文件托管 + SPA fallback |
| `server/src/config/constants.ts` | 修改 | DB 路径适配 Electron userData |
| `electron/main.ts` | 新建 | Electron 主进程 |
| `electron/preload.ts` | 新建 | 预加载脚本 |
| `electron-builder.yml` | 新建 | 打包配置 |
| `tsconfig.electron.json` | 新建 | Electron TS 编译配置 |
| `assets/icon.png` | 新建 | 应用图标 |
| `assets/icon.ico` | 新建 | Windows ICO 图标 |

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| better-sqlite3 与 Electron Node ABI 不匹配 | 使用 @electron/rebuild 重编译；asarUnpack 解包 .node 文件 |
| Electron 体积大 (~150MB+) | 可接受，餐饮场景对体积不敏感；后续可用 electron-builder 的 delta 更新 |
| Windows 防火墙阻止局域网访问 | 首次启动时 Windows 会弹出防火墙提示，用户允许即可 |
| 数据库写入权限 | 使用 app.getPath('userData') 即 %APPDATA%，天然可写 |
| 端口 3000 被占用 | 添加端口检测，自动 fallback 到 3001-3010 |
| 用户误关窗口导致服务中断 | 关闭窗口 → 最小化到托盘，需右键托盘"退出"才真正关闭 |
| server 使用 ESM (type: module) 但 Electron 需要 CJS | server 编译为 CJS (tsconfig target commonjs)，Electron 用 require() 导入 |

## 打包产物

```
release/
├── 点餐系统 Setup 1.0.0.exe        # NSIS 安装包 (~150-180MB)
└── win-unpacked/                    # 解压版（便携使用）
```

## SESSION_ID（供 /ccg:execute 使用）

- CODEX_SESSION: 019c74d7-9a00-7942-8c09-f1f9971d4c02
- GEMINI_SESSION: 6b2573f4-adf1-49f3-b661-42ac42e69d0e
