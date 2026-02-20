[根目录](../CLAUDE.md) > **electron**

# electron -- Electron 桌面壳

## 模块职责

将点餐系统打包为 Windows 桌面应用。负责启动后端服务进程、创建浏览器窗口加载前端页面、系统托盘、IPC 对话框桥接。

## 入口与启动

- 主进程入口：`main.ts` (编译后 `dist/main.js`)
- 预加载脚本：`preload.ts` (编译后 `dist/preload.js`)
- 启动命令：`npm run electron:dev` (根目录，需先构建 server/web)
- 打包命令：`npm run dist` (electron-builder --win)

## 对外接口

### IPC Handlers

| 通道 | 方向 | 说明 |
|------|------|------|
| `dialog:save` | renderer -> main | 打开保存文件对话框 |
| `dialog:open` | renderer -> main | 打开文件选择对话框 |

## 关键依赖与配置

| 依赖 | 用途 |
|------|------|
| electron 33 | 桌面应用框架 |
| electron-builder 25 | 打包工具 |
| @electron/rebuild | 原生模块重编译 |

- TypeScript 配置：根目录 `tsconfig.electron.json`
- 单实例锁：`app.requestSingleInstanceLock()` 防止多开
- GPU 优化：启用 GPU 光栅化和零拷贝
- 后端启动策略：优先 fork 子进程，失败回退进程内启动

## 数据模型

无独立数据模型。通过 `ELECTRON_USER_DATA` 环境变量传递用户数据目录给后端。

## 测试与质量

当前无自动化测试。

## 常见问题 (FAQ)

- 后端启动超时：15 秒超时，超时后尝试进程内回退启动
- 窗口关闭行为：关闭窗口隐藏到托盘，不退出应用
- 原生模块：better-sqlite3 需要针对 Electron 版本重编译 (`npm run rebuild:native`)

## 相关文件清单

```
electron/
  main.ts              # 主进程入口
  preload.ts           # 预加载脚本
  dist/                # 编译输出
tsconfig.electron.json # TypeScript 配置
```

## 变更记录 (Changelog)

| 时间 | 操作 | 说明 |
|------|------|------|
| 2026-02-20 15:10:51 UTC | 初始化 | 首次生成模块文档 |
