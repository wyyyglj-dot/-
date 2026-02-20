# 📋 实施计划：PC 端显示局域网连接地址

## 任务类型
- [x] 全栈 (→ 并行)

## 需求摘要

在 PC 端侧边栏底部新增"手机连接"入口，点击弹出 Modal 显示局域网地址 + QR Code，方便手机扫码或手动输入地址连接。解决 IP 变动和遗忘问题。

## 技术方案

| 层级 | 方案 | 理由 |
|------|------|------|
| 后端 API | `GET /api/v1/system/lan` | Node.js `os.networkInterfaces()` 可靠获取 LAN IP |
| QR 生成 | `qrcode.vue` (前端) | 轻量、Vue 3 原生、SVG 渲染、无后端图像依赖 |
| UI 触发 | 图标按钮（与 ThemeToggle 并排） | 节省侧边栏空间，风格统一 |
| UI 展示 | NModal 弹窗 | QR Code 需要足够空间（≥150px），弹窗聚焦体验好 |
| 端口策略 | 前端 `import.meta.env.DEV ? 5173 : 3000` | 开发/生产自动切换 |

## 实施步骤

### Step 1: 后端 - 新增局域网信息 API

新建 `server/src/modules/system/system.router.ts`

```typescript
// GET /api/v1/system/lan
// 返回格式：
{
  ok: true,
  data: {
    primaryIp: "192.168.1.100",   // 推荐的局域网 IP
    ips: [                         // 所有可用 IP 列表
      { address: "192.168.1.100", family: "IPv4", interface: "Wi-Fi" }
    ],
    hostname: "DESKTOP-XXX"
  }
}
```

IP 选择规则：
- 优先私网 IPv4：`192.168.x.x` > `10.x.x.x` > `172.16-31.x.x`
- 过滤：loopback (`127.0.0.1`)、link-local (`169.254.x.x`)、internal 接口
- 过滤常见虚拟网卡：VMware、VirtualBox、Docker、WSL
- 无可用 IP 时 `primaryIp` 返回 `null`

在 `server/src/app.ts` 中挂载路由。

预期产物：可调用的 `/api/v1/system/lan` 端点

### Step 2: 前端 - 安装 QR Code 依赖

```bash
cd web && npm install qrcode.vue
```

预期产物：`qrcode.vue` 依赖就绪

### Step 3: 前端 - 新增 API 调用

在 `web/src/api/` 新建 `system.ts`：

```typescript
import { get } from './client'

interface LanInfo {
  primaryIp: string | null
  ips: { address: string; family: string; interface: string }[]
  hostname: string
}

export function getLanInfo(): Promise<LanInfo> {
  return get<LanInfo>('/system/lan')
}
```

预期产物：前端可调用的 `getLanInfo()` 函数

### Step 4: 前端 - 新建 MobileConnect 组件

新建 `web/src/components/common/MobileConnect.vue`：

核心逻辑：
1. 点击图标按钮 → 打开 NModal
2. `onMounted` 调用 `getLanInfo()` 获取 IP
3. 拼接 URL：`http://{primaryIp}:{port}/m`
   - 端口：`import.meta.env.DEV ? 5173 : 3000`
4. 用 `qrcode-vue` 渲染 QR Code（白底黑码，不受主题影响）
5. 提供"复制地址"按钮（`navigator.clipboard.writeText`）
6. 提供"刷新 IP"按钮（重新调用 API）
7. 无可用 IP 时显示提示："未检测到局域网连接"

UI 设计要点：
- 按钮样式与 ThemeToggle 一致：`p-2 rounded-xl` + glass border
- Modal 遵循玻璃拟态：`backdrop-blur-xl` + glass bg/border
- QR Code 外层白色圆角容器（`bg-white p-4 rounded-lg`），确保扫码可靠性
- URL 文本可选中（`select-all`），字号较小
- 加载中显示 NSpin

预期产物：独立的 MobileConnect.vue 组件

### Step 5: 前端 - 修改 AppSidebar 集成

修改 `web/src/components/layout/AppSidebar.vue`：

1. 导入 MobileConnect 组件
2. 底部区域改为横向布局：ThemeToggle + MobileConnect 并排
3. 版本号保持在下方

```html
<!-- 修改前 -->
<div class="p-4 border-t ... flex flex-col items-center gap-3">
  <ThemeToggle />
  <div class="text-[10px] ...">v1.0.0</div>
</div>

<!-- 修改后 -->
<div class="p-4 border-t ... flex flex-col items-center gap-3">
  <div class="flex items-center gap-3">
    <ThemeToggle />
    <MobileConnect />
  </div>
  <div class="text-[10px] ...">v1.0.0</div>
</div>
```

预期产物：侧边栏底部集成手机连接入口

## 关键文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `server/src/modules/system/system.router.ts` | 新建 | 局域网信息 API 路由 |
| `server/src/app.ts:22` | 修改 | 挂载 systemRouter |
| `web/src/api/system.ts` | 新建 | 前端 API 调用封装 |
| `web/src/components/common/MobileConnect.vue` | 新建 | 手机连接弹窗组件 |
| `web/src/components/layout/AppSidebar.vue:25-27` | 修改 | 集成 MobileConnect |

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| 多网卡返回错误 IP（VPN/虚拟机） | 过滤虚拟网卡名称，优先 Wi-Fi/以太网 |
| DHCP 导致 IP 变化 | 提供"刷新"按钮，每次打开 Modal 重新获取 |
| 防火墙阻止手机访问 | Modal 中添加提示文案："确保手机与电脑在同一局域网" |
| 无网络连接 | `primaryIp` 为 null 时显示友好提示 |
| `/api/v1/system/lan` 暴露内网信息 | CORS 已为 `*`（局域网场景可接受），生产环境可收紧 |

## SESSION_ID（供 /ccg:execute 使用）
- CODEX_SESSION: 019c7472-ad7e-74c0-9eb7-fa2ee52553c2
- GEMINI_SESSION: 0db7530e-4a74-4d10-ae18-13eb1e8bf297
