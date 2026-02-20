import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, dialog } from 'electron'
import path from 'path'
import fs from 'fs'
import { fork, ChildProcess } from 'child_process'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let serverProcess: ChildProcess | null = null

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

// GPU 诊断（环境变量控制）
if (process.env.ELECTRON_GPU_DIAG === '1') {
  app.commandLine.appendSwitch('enable-logging')
}
if (process.env.ELECTRON_IGNORE_GPU_BLOCKLIST === '1') {
  app.commandLine.appendSwitch('ignore-gpu-blocklist')
}

// GPU 性能优化（始终启用）
app.commandLine.appendSwitch('enable-gpu-rasterization')
app.commandLine.appendSwitch('enable-zero-copy')

process.env.NODE_ENV = 'production'
process.env.ELECTRON_USER_DATA = app.getPath('userData')

async function createWindow(port: number) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: '点餐系统',
    show: false,
    backgroundColor: '#ffffff',
    icon: path.join(__dirname, '../../assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  })

  mainWindow.loadURL(`http://127.0.0.1:${port}`)

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('close', (e) => {
    if (!isQuitting && tray) {
      e.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function createTray() {
  const iconPath = path.join(__dirname, '../../assets/icon.png')
  if (!fs.existsSync(iconPath)) {
    console.warn('Tray icon not found, skipping tray creation')
    return
  }
  const icon = nativeImage.createFromPath(iconPath)
  if (icon.isEmpty()) {
    console.warn('Tray icon invalid, skipping tray creation')
    return
  }
  tray = new Tray(icon.resize({ width: 16, height: 16 }))
  tray.setToolTip('点餐系统')
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        mainWindow?.show()
        mainWindow?.focus()
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true
        app.quit()
      },
    },
  ]))
  tray.on('double-click', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })
}

function createAppMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: '文件',
      submenu: [
        { label: '退出', accelerator: 'CmdOrCtrl+Q', click: () => { isQuitting = true; app.quit() } },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', role: 'undo', accelerator: 'CmdOrCtrl+Z' },
        { label: '重做', role: 'redo', accelerator: 'CmdOrCtrl+Shift+Z' },
        { type: 'separator' },
        { label: '剪切', role: 'cut', accelerator: 'CmdOrCtrl+X' },
        { label: '复制', role: 'copy', accelerator: 'CmdOrCtrl+C' },
        { label: '粘贴', role: 'paste', accelerator: 'CmdOrCtrl+V' },
        { label: '全选', role: 'selectAll', accelerator: 'CmdOrCtrl+A' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { label: '重新加载', role: 'reload', accelerator: 'CmdOrCtrl+R' },
        { label: '强制重新加载', role: 'forceReload', accelerator: 'CmdOrCtrl+Shift+R' },
        { type: 'separator' },
        { label: '放大', role: 'zoomIn', accelerator: 'CmdOrCtrl+=' },
        { label: '缩小', role: 'zoomOut', accelerator: 'CmdOrCtrl+-' },
        { label: '重置缩放', role: 'resetZoom', accelerator: 'CmdOrCtrl+0' },
        { type: 'separator' },
        { label: '全屏', role: 'togglefullscreen', accelerator: 'F11' },
      ],
    },
    {
      label: '窗口',
      submenu: [
        { label: '最小化', role: 'minimize', accelerator: 'CmdOrCtrl+M' },
        { label: '关闭', role: 'close', accelerator: 'CmdOrCtrl+W' },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function resolveServerEntry(): string {
  if (app.isPackaged) {
    return path.join(app.getAppPath(), 'server', 'dist', 'server.js')
  }
  return path.join(__dirname, '../../server/dist/server.js')
}

function startServerInChild(): Promise<number> {
  return new Promise((resolve, reject) => {
    const entry = resolveServerEntry()
    let settled = false

    serverProcess = fork(entry, [], {
      env: {
        ...process.env,
        NODE_ENV: 'production',
        ELECTRON_USER_DATA: app.getPath('userData'),
      },
      cwd: app.isPackaged
        ? app.getPath('userData')
        : path.join(__dirname, '../../server'),
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    })

    const timeout = setTimeout(() => {
      if (settled) return
      settled = true
      serverProcess?.kill()
      reject(new Error('Server start timeout (15s)'))
    }, 15000)

    serverProcess.on('message', (msg: any) => {
      if (msg?.type === 'listening' && typeof msg.port === 'number') {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        resolve(msg.port)
      }
    })

    serverProcess.on('error', (err) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      reject(err)
    })

    serverProcess.on('exit', (code, signal) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      reject(new Error(`Server exited: code=${code ?? 'null'} signal=${signal ?? 'null'}`))
    })

    serverProcess.stdout?.on('data', (data: Buffer) => {
      process.stdout.write(`[server] ${data}`)
    })
    serverProcess.stderr?.on('data', (data: Buffer) => {
      process.stderr.write(`[server] ${data}`)
    })
  })
}

ipcMain.handle('dialog:save', async (_event, options) => {
  if (!mainWindow) return { canceled: true, filePath: '' }
  return dialog.showSaveDialog(mainWindow, options ?? {})
})

ipcMain.handle('dialog:open', async (_event, options) => {
  if (!mainWindow) return { canceled: true, filePaths: [] }
  return dialog.showOpenDialog(mainWindow, options ?? {})
})

app.whenReady().then(async () => {
  if (process.env.ELECTRON_GPU_DIAG === '1') {
    try {
      console.log('GPU Feature Status:', app.getGPUFeatureStatus())
      app.getGPUInfo('complete').then((info) => console.log('GPU Info:', info))
    } catch (err) {
      console.warn('GPU diagnostics failed:', err)
    }
  }
  createAppMenu()

  try {
    const port = await startServerInChild()
    createTray()
    await createWindow(port)
  } catch (forkErr: any) {
    console.warn('Fork failed, falling back to in-process server:', forkErr.message)
    try {
      const serverEntry = resolveServerEntry()
      const { startServer } = require(serverEntry)
      const port = await startServer()
      createTray()
      await createWindow(port)
    } catch (err: any) {
      dialog.showErrorBox('启动失败', `服务启动错误: ${err.message}\n请检查日志或联系管理员。`)
      app.quit()
    }
  }
})

app.on('window-all-closed', () => {
  // Windows: keep running in tray
})

app.on('before-quit', () => {
  isQuitting = true
  if (serverProcess) {
    serverProcess.kill()
    serverProcess = null
  }
})
