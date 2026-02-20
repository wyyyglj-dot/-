# auth-ui: 认证相关 UI

## 概述

前端认证界面，包含登录页、PIN 设置引导、恢复流程。共享响应式设计，PC/Mobile 统一组件。

## 需求

### REQ-UI-001: 登录页面

- 路由：`/login`（PC 和 Mobile 共用，不分 `/m/login`）
- 自定义数字键盘（0-9 按钮网格 + 删除 + 确认）
- 6 个圆点指示器显示已输入位数（类似支付密码体验）
- 输入满 6 位自动提交（无需点确认按钮）
- 错误反馈：圆点指示器抖动动画（shake），0.5s 后清空重新输入
- 响应式：Mobile 全屏键盘，PC 居中卡片（max-width: 400px）
- 无 "记住我" 选项（token 始终持久化到 localStorage）

### REQ-UI-002: PIN 设置页面

- 路由：`/setup`
- 触发条件：`GET /api/v1/auth/state` 返回 `setupRequired: true`
- 流程：输入新 PIN → 确认 PIN（二次输入）→ 输入安全问题 → 输入安全答案 → 提交
- 两次 PIN 不一致：提示 "两次输入不一致" + 清空重新输入
- 安全问题：Naive UI NInput 文本框，placeholder "例如：我的宠物叫什么名字？"
- 安全答案：Naive UI NInput 文本框，type="password" 遮罩显示
- 设置成功后自动登录（后端返回 token），跳转首页

### REQ-UI-003: PIN 恢复页面

- 路由：`/recovery`
- 从登录页 "忘记 PIN？" 链接进入
- 显示安全问题文本（从 `GET /api/v1/auth/state` 获取，需扩展接口返回问题文本）
- 输入安全答案 + 新 PIN（两次确认）→ 提交
- 恢复成功后自动登录，跳转首页

### REQ-UI-004: Auth Store (Pinia)

- 文件：`web/src/stores/auth.ts`
- State: `token: string | null`, `setupRequired: boolean`
- Actions: `checkState()`, `login(pin)`, `logout()`, `setup(pin, question, answer)`, `recover(answer, newPin)`
- token 持久化：localStorage key `auth_token`
- `checkState()` 在 App.vue onMounted 时调用

### REQ-UI-005: API Client 改造

- `web/src/api/client.ts` 的 `request()` 函数修改：
  - 从 localStorage 读取 token，存在则添加 `Authorization: Bearer <token>` header
  - 响应 401 时：清除 localStorage token，`window.location.href = '/login'`
- 避免循环依赖：client.ts 直接读 localStorage，不导入 Pinia store

### REQ-UI-006: 路由守卫

- `web/src/router/index.ts` 的 `beforeEach` 修改：
  - 公开路由白名单：`/login`, `/setup`, `/recovery`
  - 守卫顺序：① 移动端检测（现有）→ ② auth 检查
  - 未认证 + 非公开路由 → 重定向 `/login`
  - 已认证 + 访问公开路由 → 重定向 `/`（防止已登录用户看到登录页）

### REQ-UI-007: SSE 认证

- `web/src/api/sse.ts` 修改：
  - `connect()` 时从 localStorage 读取 token
  - URL 改为 `/api/v1/events?token=<token>`
  - `onerror` 重连时重新读取当前 token（防止使用过期 token）

## PBT 属性

### ROUTER_GUARD_UNAUTHENTICATED_REDIRECT
- **不变量**: 无 token 时访问任何非公开路由，始终重定向到 `/login`
- **伪造策略**: 枚举所有路由路径，无 token 状态下导航，断言最终路径为 `/login`

### ROUTER_GUARD_AUTHENTICATED_NO_LOGIN_REDIRECT
- **不变量**: 有有效 token 时访问公开路由（/login, /setup, /recovery），重定向到 `/`
- **伪造策略**: 有 token 状态下导航到公开路由，断言重定向

### API_CLIENT_TOKEN_INJECTION
- **不变量**: localStorage 有 token 时，所有非 auth 请求包含 `Authorization: Bearer` header；无 token 时不包含
- **伪造策略**: mock fetch，检查 header 存在性

### API_CLIENT_401_CLEARS_TOKEN
- **不变量**: 收到 401 响应时，localStorage token 被清除且重定向到 /login
- **伪造策略**: mock 401 响应，断言 localStorage 和 location 变化

### PIN_INPUT_DIGIT_ONLY
- **不变量**: 数字键盘只产生 0-9 数字，输入长度上限 6 位
- **伪造策略**: 模拟键盘点击，断言输入值格式

### SSE_RECONNECT_USES_CURRENT_TOKEN
- **不变量**: SSE 重连时使用当前 localStorage 中的 token，非初始连接时的旧 token
- **伪造策略**: 连接后更新 localStorage token，触发重连，断言新 URL 包含新 token
