# Proposal: 交互体验与性能全面优化

## Context

系统部署到服务器后，实际使用中暴露出多个交互体验问题，严重影响操作效率：

1. **上菜队列操作阻塞**：点击"已上菜"后出现 loading 转圈（~1秒），期间无法操作其他菜品，连续点击多道菜时严重影响速度
2. **SSE 事件触发全量刷新**：每个 SSE 事件都触发整个列表的 API 重新请求，导致列表闪烁、滚动位置丢失
3. **缺少安全设置**：系统设置页无修改 PIN 和安全问题的入口，用户被锁定在初始设置中
4. **后端性能瓶颈**：认证中间件每次请求查询数据库、上菜操作 3-4 次 DB 查询、无响应压缩

用户主要使用移动端操作，优化优先级以移动端体验为主。

## Requirements

### R1: 上菜操作乐观更新 — 消除 loading 阻塞

- **场景**: 用户在上菜队列快速连续点击多个"已上菜"按钮
- **当前行为**: 每次点击 → API 请求 → loading 转圈阻塞 → SSE 触发全量 refetch → 再次 loading
- **目标行为**: 点击后菜品立即从列表消失（乐观更新），无 loading 阻塞，失败时回滚并提示
- **技术约束**:
  - `markServed()` 已有本地 filter 逻辑（`orders.ts:44`），但 SSE `serving.updated` 事件又触发 `fetchServingQueue()` 导致全量刷新
  - 需要引入"本地操作防抖"机制：本地操作后短时间内忽略 SSE 触发的 refetch
  - 按钮不显示 loading spinner，改为点击后立即移除该项并显示轻量 toast 反馈
- **影响文件**:
  - `web/src/stores/orders.ts` — 乐观更新 + SSE 防抖
  - `web/src/components/business/ServingQueue.vue` — 移除 handleServe 中的 fetchServedItems 调用
  - `web/src/components/business/ServingItem.vue` — 按钮交互优化
  - `web/src/views/Serving.vue` / `web/src/views/mobile/MobileServing.vue` — SSE 事件处理优化

### R2: SSE 事件增量更新 — 替代全量 refetch

- **场景**: 任何 SSE 事件（serving.updated / ticket.created / table.updated 等）触发时
- **当前行为**: 所有页面收到 SSE 事件后调用 `fetchXxx()` 全量重新请求 API
- **目标行为**: SSE 事件携带变更数据（delta），前端 store 根据 delta 增量更新本地状态
- **技术约束**:
  - 后端 SSE broadcast 已携带部分 delta 数据（如 `serving.updated` 含 `item_id`, `served_delta`）
  - 前端需要根据 event data 做本地 state 操作（增/删/改），而非全量 refetch
  - 对于无法增量更新的复杂场景（如 `ticket.created` 新增多个菜品），可降级为 refetch 但需加防抖
  - 桌台总览页（MobileHome）的 `table.updated` 事件：后端应返回受影响桌台的完整 summary，前端仅更新该桌台
- **影响文件**:
  - `web/src/views/Serving.vue` / `MobileServing.vue` — SSE handler 改为增量更新
  - `web/src/views/mobile/MobileHome.vue` — table.updated 增量更新
  - `web/src/stores/orders.ts` — 新增增量更新方法
  - `web/src/stores/tables.ts` — 新增单桌更新方法
  - `server/src/modules/serving/serving.service.ts` — SSE 事件携带完整 delta
  - `server/src/modules/tables/tables.service.ts` — table.updated 携带桌台 summary

### R3: 操作按钮防重复点击

- **场景**: 用户快速双击"已上菜"、"恢复"、"结账"等操作按钮
- **当前行为**: 无防护，可能发送重复请求导致错误
- **目标行为**: 按钮点击后立即进入 disabled 状态（不显示 loading spinner），防止重复提交
- **技术约束**:
  - 上菜队列的"已上菜"按钮：点击后该项直接移除（乐观更新），天然防重复
  - 其他操作按钮（恢复、结账、提交订单）：点击后 disabled 直到操作完成
  - 不使用全局 loading overlay，仅按钮级别控制
- **影响文件**:
  - `web/src/components/business/ServingItem.vue` — 按钮状态管理
  - `web/src/views/Checkout.vue` — 结账按钮防重复
  - `web/src/views/mobile/MobileOrdering.vue` — 提交订单按钮防重复

### R4: 系统设置页新增安全设置区域

- **场景**: 用户需要修改 PIN 码或更新安全问题
- **当前行为**: 设置页仅有数据库备份/恢复功能，无安全相关设置
- **目标行为**: 设置页顶部新增"安全设置"卡片，包含修改 PIN 和修改安全问题两个功能
- **修改 PIN 流程**:
  1. 输入当前 PIN（验证身份）
  2. 输入新 PIN（6位数字，弱PIN检测）
  3. 确认新 PIN
  4. 提交成功后提示，不影响当前登录状态
- **修改安全问题流程**:
  1. 输入当前 PIN（验证身份）
  2. 输入新安全问题
  3. 输入新安全答案
  4. 提交成功后提示
- **后端新增 API**:
  - `POST /api/v1/auth/change-pin` — body: `{ current_pin, new_pin }`
  - `POST /api/v1/auth/change-security` — body: `{ current_pin, question, answer }`
- **技术约束**:
  - 两个操作都需要先验证当前 PIN（scrypt 验证）
  - 修改 PIN 后不撤销现有 session（用户不需要重新登录）
  - 修改安全问题后旧答案立即失效
  - 移动端不显示设置页（当前设计），此功能仅 PC 端可用
- **影响文件**:
  - `server/src/modules/auth/auth.router.ts` — 新增两个路由
  - `server/src/modules/auth/auth.service.ts` — 新增 changePin / changeSecurity 方法
  - `server/src/modules/auth/auth.repo.ts` — 新增 updatePin / updateSecurity 方法
  - `web/src/views/Settings.vue` — 新增安全设置卡片
  - `web/src/api/auth.ts` — 新增 API 调用（如不存在则创建）

### R5: 认证中间件 Token 缓存

- **场景**: 每个 API 请求都经过 auth middleware 验证 token
- **当前行为**: 每次验证都查询数据库 `findValidSession(hash)`
- **目标行为**: 使用内存 Map 缓存已验证的 token，TTL 60秒，减少 90%+ 的数据库查询
- **技术约束**:
  - 缓存 key: token SHA-256 hash，value: `{ valid: boolean, ts: number }`
  - logout 时主动清除对应缓存条目
  - 缓存大小上限 1000 条，超出时清理最旧条目
  - 不引入外部依赖（Redis），使用 Map + setInterval 清理
- **影响文件**:
  - `server/src/modules/auth/auth.service.ts` — 新增 token 缓存逻辑
  - `server/src/shared/auth-middleware.ts` — 无需修改（调用 validateToken 即可）

### R6: 401 认证失败优雅处理

- **场景**: API 请求返回 401 时（token 过期或无效）
- **当前行为**: `client.ts` 立即执行 `window.location.href = '/login'`，丢失当前页面状态
- **目标行为**: 显示 toast 提示"登录已过期"，延迟 1.5 秒后跳转登录页，使用 `router.push` 而非 `window.location.href`
- **技术约束**:
  - 使用 Naive UI 的 `useMessage` 或全局 message API 显示提示
  - 避免多个 401 响应触发多次跳转（加锁机制）
  - SSE 连接的 401 也需要优雅处理（断开后提示，不自动重连）
- **影响文件**:
  - `web/src/api/client.ts` — 401 处理逻辑重构
  - `web/src/api/sse.ts` — SSE 连接错误处理优化

### R7: SSE 连接状态指示器

- **场景**: 用户在服务器部署环境使用，网络可能不稳定
- **当前行为**: SSE 断开后静默重连，用户不知道数据是否实时
- **目标行为**: 移动端底部导航栏 / PC 端侧边栏显示连接状态小圆点（绿色=已连接，红色=断开重连中）
- **技术约束**:
  - SSEClient 新增 `status` 响应式属性：`connected` | `reconnecting` | `disconnected`
  - 状态变更通过事件通知 UI 层
  - 重连成功后自动刷新当前页面数据（确保数据同步）
- **影响文件**:
  - `web/src/api/sse.ts` — 新增连接状态管理
  - `web/src/components/layout/MobileNav.vue` — 显示状态指示器
  - `web/src/components/layout/AppSidebar.vue` — 显示状态指示器

### R8: 后端响应压缩

- **场景**: 服务器部署环境，API 响应通过网络传输
- **当前行为**: 响应未压缩，JSON 数据原文传输
- **目标行为**: 启用 gzip/br 压缩，减少 60-80% 传输体积
- **技术约束**:
  - 使用 `compression` 中间件
  - 仅压缩 > 1KB 的响应
  - SSE 连接不压缩（流式传输）
- **影响文件**:
  - `server/src/app.ts` — 添加 compression 中间件
  - `server/package.json` — 新增 compression 依赖

## Success Criteria

1. ✅ 上菜队列连续点击 5 个"已上菜"，每次点击后菜品立即消失，无 loading 阻塞，总耗时 < 3 秒
2. ✅ SSE 事件触发时，列表不闪烁、滚动位置不丢失
3. ✅ 操作按钮无法被重复点击触发多次请求
4. ✅ 系统设置页可修改 PIN，修改后用旧 PIN 无法登录、新 PIN 可登录
5. ✅ 系统设置页可修改安全问题，修改后用新答案可恢复 PIN
6. ✅ Token 缓存生效后，连续 10 次 API 请求仅产生 1 次数据库查询
7. ✅ 401 错误显示 toast 提示后跳转，不直接刷新页面
8. ✅ SSE 断开时 UI 显示红色状态指示，重连后恢复绿色
9. ✅ API 响应启用压缩，Content-Encoding 头包含 gzip 或 br

## Risks

| 风险 | 缓解措施 |
|------|----------|
| 乐观更新后 API 失败，本地状态与服务端不一致 | 失败时回滚本地状态 + toast 提示，3秒后自动 refetch 同步 |
| SSE 增量更新遗漏数据导致状态漂移 | 重连后执行一次全量 refetch；定期（每 5 分钟）静默校验 |
| Token 缓存导致已注销 session 仍可访问 | 缓存 TTL 60秒，logout 主动清除缓存，风险窗口极小 |
| compression 中间件影响 SSE 流式传输 | SSE 路由跳过压缩中间件 |
| 修改 PIN 时 scrypt 计算耗时阻塞 | 单次操作可接受 ~100ms 延迟，非高频操作 |

## Implementation Priority

| 优先级 | 需求 | 理由 |
|--------|------|------|
| P0 | R1 乐观更新 | 用户反馈的核心痛点，直接影响操作效率 |
| P0 | R2 SSE 增量更新 | 与 R1 紧密关联，消除列表闪烁 |
| P0 | R3 按钮防重复 | 防止数据错误，与 R1 配合 |
| P1 | R4 安全设置 | 用户明确需求，功能缺失 |
| P1 | R5 Token 缓存 | 后端性能基础优化 |
| P1 | R6 401 优雅处理 | 改善异常场景体验 |
| P2 | R7 连接状态指示 | 锦上添花，提升信任感 |
| P2 | R8 响应压缩 | 网络传输优化 |
