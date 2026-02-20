# 📋 实施计划：Electron 桌面应用性能优化

## 方案概述

解决 Electron 打包后帧率低/卡顿问题。核心策略：GPU 验证 → 配置调优 → 架构重构 → 打包优化。

## 任务类型

- [x] 后端 (→ Codex)
- [x] 前端 (→ Gemini)
- [x] 全栈 (→ 并行)

## 技术方案

### 根因与对策映射

| 根因 | 影响 | 对策 |
|------|------|------|
| GPU 可能降级到软件渲染 | 持续低帧率 | Step 1: GPU 诊断 + 配置 |
| backgroundThrottling 默认启用 | 失焦时帧率骤降 | Step 2: BrowserWindow 配置 |
| Express + SQLite 在主进程运行 | 间歇性卡顿 | Step 3: 子进程隔离 |
| asar: false 大量离散文件 I/O | 启动慢 + I/O 抖动 | Step 4: 打包优化 |

## 实施步骤

### Step 1：GPU 诊断与配置

文件：`electron/main.ts`（在 `app.whenReady()` 之前添加）

```typescript
// GPU 诊断（环境变量控制，默认关闭）
if (process.env.ELECTRON_GPU_DIAG === '1') {
  app.commandLine.appendSwitch('enable-logging')
}

// GPU 性能优化开关
app.commandLine.appendSwitch('enable-gpu-rasterization')
app.commandLine.appendSwitch('enable-zero-copy')
```

验证方式：
1. 打包后运行，DevTools 中访问 `chrome://gpu`
2. 确认 Compositing 和 Rasterization 为 "Hardware accelerated"
3. 若为 SwiftShader，添加 `app.commandLine.appendSwitch('ignore-gpu-blocklist')`

风险：强制 GPU 标志在部分显卡上可能不稳定
回退：移除 commandLine 开关

预期产物：确认 GPU 硬件加速状态，必要时启用强制硬件加速

### Step 2：BrowserWindow 性能配置

文件：`electron/main.ts` → `createWindow()` 函数

```typescript
mainWindow = new BrowserWindow({
  width: 1280,
  height: 800,
  minWidth: 1024,
  minHeight: 600,
  title: '点餐系统',
  show: false,
  backgroundColor: '#ffffff',  // 新增：防止白屏闪烁
  icon: path.join(__dirname, '../../assets/icon.png'),
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
    backgroundThrottling: false,  // 新增：禁用后台节流
  },
})
```

风险：失焦时 CPU/GPU 占用略高
回退：移除 `backgroundThrottling: false`

预期产物：窗口失焦后仍保持 60fps 渲染

### Step 3：主进程架构重构（核心修改）

将 Express + better-sqlite3 从主进程迁出到 `child_process.fork` 子进程。

#### 3.1 修改 server 启动逻辑

文件：`server/src/server.ts`

```typescript
import { app } from './app'
import { PORT } from './config/constants'
import { initDb } from './db/client'
import { runMigrations } from './db/migrate'
import type { AddressInfo } from 'net'

export function startServer(): Promise<number> {
  initDb()
  runMigrations()
  return new Promise((resolve) => {
    const srv = app.listen(PORT, '0.0.0.0', () => {
      const addr = srv.address() as AddressInfo
      const port = addr.port
      console.log(`Server running on http://0.0.0.0:${port}`)
      // 通知父进程（Electron 场景）
      if (process.send) {
        process.send({ type: 'listening', port })
      }
      resolve(port)
    })
  })
}

// 独立运行 或 被 fork 时自动启动
if (require.main === module || process.send) {
  startServer()
}
```

#### 3.2 修改 Electron 主进程

文件：`electron/main.ts`

```typescript
import { fork, ChildProcess } from 'child_process'

let serverProcess: ChildProcess | null = null

function startServerProcess(): Promise<number> {
  return new Promise((resolve, reject) => {
    // 根据运行环境确定 server 入口路径
    const serverEntry = app.isPackaged
      ? path.join(process.resourcesPath, 'app/server/dist/server.js')
      : path.join(__dirname, '../../server/dist/server.js')

    serverProcess = fork(serverEntry, [], {
      env: {
        ...process.env,
        NODE_ENV: 'production',
        ELECTRON_USER_DATA: app.getPath('userData'),
      },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    })

    const timeout = setTimeout(() => {
      reject(new Error('Server start timeout (15s)'))
    }, 15000)

    serverProcess.on('message', (msg: any) => {
      if (msg?.type === 'listening') {
        clearTimeout(timeout)
        resolve(msg.port)
      }
    })

    serverProcess.on('exit', (code) => {
      clearTimeout(timeout)
      if (code !== 0) reject(new Error(`Server exited with code ${code}`))
    })

    // 转发 server 日志到主进程 console
    serverProcess.stdout?.on('data', (data) => console.log(`[server] ${data}`))
    serverProcess.stderr?.on('data', (data) => console.error(`[server] ${data}`))
  })
}

// 替换原有的 app.whenReady 逻辑
app.whenReady().then(async () => {
  createAppMenu()
  const port = await startServerProcess()  // 子进程启动 server
  createTray()
  await createWindow(port)
})

// 退出时清理子进程
app.on('before-quit', () => {
  isQuitting = true
  if (serverProcess) {
    serverProcess.kill()
    serverProcess = null
  }
})
```

#### 3.3 移除主进程中的旧 server 导入

删除 `electron/main.ts` 中的：
```typescript
// 删除这行
const { startServer } = require('../../server/dist/server')
```

风险：子进程路径在打包环境中可能不正确
回退：保留旧的 require() 方式作为 fallback，通过环境变量切换

预期产物：主进程事件循环无阻塞，DB 查询只影响子进程

### Step 4：electron-builder 打包优化

文件：`electron-builder.yml`

```yaml
appId: com.diancan.app
productName: 点餐系统
directories:
  output: release
  buildResources: assets
asar: true
asarUnpack:
  - "**/better-sqlite3/**"
  - "**/*.node"
files:
  - electron/dist/**/*
  - server/dist/**/*
  - web-dist/**/*
  - assets/**/*
  - package.json
extraResources:
  - from: server/node_modules
    to: app/server/node_modules
win:
  target:
    - target: nsis
      arch: [x64]
  icon: assets/icon.ico
nsis:
  oneClick: false
  perMachine: false
  allowToChangeInstallationDirectory: true
  installerIcon: assets/icon.ico
  uninstallerIcon: assets/icon.ico
  createDesktopShortcut: true
  createStartMenuShortcut: true
  shortcutName: 点餐系统
  deleteAppDataOnUninstall: false
```

风险：asar 打包后 native 模块加载失败
回退：扩大 asarUnpack 范围或临时回退 asar: false

预期产物：减少文件 I/O，加快启动速度

### Step 5：验证与测试

1. GPU 验证：打包后检查 `chrome://gpu`，确认硬件加速
2. 帧率测试：DevTools Performance 面板录制，对比优化前后 FPS
3. 主进程阻塞检测：确认主进程无长时间阻塞（>50ms）
4. SSE 连通性：确认 SSE 实时推送在子进程模式下正常工作
5. 局域网访问：确认手机端通过 `http://192.168.x.x:3000` 仍可访问
6. 窗口失焦测试：切换到其他窗口后，回来确认动画仍流畅

## 关键文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `electron/main.ts` | 修改 | GPU 配置 + BrowserWindow 调优 + 子进程启动 server |
| `server/src/server.ts` | 修改 | 添加 process.send IPC 通知 + fork 自启动 |
| `electron-builder.yml` | 修改 | asar: true + asarUnpack 配置 |

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| GPU 强制标志导致部分显卡不稳定 | 诊断优先，仅在确认 SwiftShader 时才启用 ignore-gpu-blocklist |
| 子进程路径在打包环境中不正确 | 使用 app.isPackaged 区分开发/生产路径 |
| better-sqlite3 在 asar 中加载失败 | asarUnpack 解包 .node 文件 |
| 子进程崩溃导致服务不可用 | 添加 exit 事件监听，可选自动重启 |
| backgroundThrottling: false 增加功耗 | 可接受，餐饮场景通常插电使用 |

## 实施顺序建议

Step 1 + Step 2 可先行实施（改动最小，快速验证效果）。
Step 3 是核心架构改动，建议单独实施并充分测试。
Step 4 可与 Step 3 同步进行。

## SESSION_ID（供 /ccg:execute 使用）

- CODEX_SESSION: 019c75a7-f1c2-7293-b462-8efd2af02c1f
- GEMINI_SESSION: 77e5ca06-163c-473c-9bf0-f0de99753bb9
