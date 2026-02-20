[根目录](../CLAUDE.md) > **web**

# web -- Vue 3 前端 SPA

## 模块职责

点餐系统的前端界面，提供 PC 端和移动端双布局。包含桌位总览、点餐、上菜队列、结账、营业统计、菜品管理、历史记录、系统设置等功能页面。

## 入口与启动

- 入口文件：`src/main.ts` -- 创建 Vue 应用，挂载 Pinia/Router/主题
- 启动命令：`npm run dev` (Vite dev server, :5173)
- 构建命令：`npm run build` (vue-tsc + vite build)

## 对外接口

### 路由 (PC)

| 路径 | 页面 | 说明 |
|------|------|------|
| `/` | TableMap | 桌位总览 (自动检测移动端跳转 /m) |
| `/order/:tableId` | Ordering | 点餐页面 |
| `/serving` | Serving | 上菜队列 |
| `/checkout/:sessionId` | Checkout | 结账页面 |
| `/stats` | Stats | 营业统计 |
| `/menu-config` | MenuConfig | 菜品管理 |
| `/history` | History | 历史记录 |
| `/settings` | Settings | 系统设置 |

### 路由 (Mobile, /m 前缀)

| 路径 | 页面 | 说明 |
|------|------|------|
| `/m` | MobileHome | 移动端桌位总览 |
| `/m/serving` | MobileServing | 移动端上菜队列 |
| `/m/stats` | MobileStats | 移动端营业统计 |
| `/m/order/:tableId` | MobileOrdering | 移动端点餐 |

### API 客户端

`src/api/client.ts` 封装 `fetch`，提供 `get/post/patch/del` 方法，统一错误处理。基础路径 `/api/v1`。

API 模块文件：
- `api/menu.ts` -- 菜品/分类 CRUD
- `api/tables.ts` -- 桌位操作
- `api/orders.ts` -- 工单操作
- `api/serving.ts` -- 上菜队列
- `api/checkout.ts` -- 结账
- `api/stats.ts` -- 统计数据
- `api/history.ts` -- 历史记录
- `api/sse.ts` -- SSE 事件订阅
- `api/system.ts` -- 系统管理

## 关键依赖与配置

| 依赖 | 用途 |
|------|------|
| vue 3.5 | 核心框架 |
| vue-router 4 | 路由 |
| pinia 2 | 状态管理 |
| pinia-plugin-persistedstate | 状态持久化 |
| naive-ui 2 | UI 组件库 |
| tailwindcss 3 | 工具类 CSS |
| echarts + vue-echarts | 统计图表 |
| qrcode.vue | 二维码生成 (移动端连接) |
| @vicons/ionicons5 | 图标库 |

- Vite 配置：`vite.config.ts` -- 开发代理 `/api` -> `localhost:3000`
- TailwindCSS：`tailwind.config.ts` -- CSS 变量主题系统 (亮/暗色)
- PostCSS：`postcss.config.cjs`

## 数据模型

类型定义在 `src/types/index.ts`，主要类型：

- `Category` / `Dish` -- 菜品分类与菜品
- `DiningTable` / `TableSummary` -- 桌位与桌位摘要
- `TableSession` / `SessionDetail` -- 用餐会话
- `OrderTicket` / `OrderTicketItem` -- 点餐工单
- `Payment` -- 支付记录
- `CartItem` -- 购物车项
- `ServingQueueItem` / `ServedItem` -- 上菜队列
- `SpiceLevel` -- 辣度等级 (MILD/MEDIUM/HOT)
- `DashboardData` / `RankingItem` -- 统计数据
- `ApiResponse<T>` -- 统一 API 响应类型

## 状态管理 (Pinia Stores)

| Store | 文件 | 职责 |
|-------|------|------|
| cart | `stores/cart.ts` | 购物车状态 |
| menu | `stores/menu.ts` | 菜品/分类缓存 |
| orders | `stores/orders.ts` | 工单状态 |
| tables | `stores/tables.ts` | 桌位状态 |
| theme | `stores/theme.ts` | 主题切换 (亮/暗) |

## 组件结构

```
src/components/
  business/           # 业务组件
    CartPanel.vue       -- 购物车面板
    CategoryManager.vue -- 分类管理
    CategoryTabs.vue    -- 分类标签页
    DishCard.vue        -- 菜品卡片
    QuickAddTile.vue    -- 快速添加磁贴
    ServingItem.vue     -- 上菜项
    ServingQueue.vue    -- 上菜队列
    SpiceRadialMenu.vue -- 辣度径向菜单
    TableCard.vue       -- 桌位卡片
  common/             # 通用组件
    MobileConnect.vue   -- 移动端连接 (二维码)
    PriceDisplay.vue    -- 价格显示
    QuantityStepper.vue -- 数量步进器
    ThemeToggle.vue     -- 主题切换
  layout/             # 布局组件
    AppSidebar.vue      -- PC 侧边栏
    MobileNav.vue       -- 移动端导航
```

## 测试与质量

当前无自动化测试。建议引入 Vitest + @vue/test-utils 进行组件与 store 测试。

## 常见问题 (FAQ)

- 路由懒加载失败：`main.ts` 中已配置 chunk 加载失败自动刷新
- 移动端适配：根路由 `/` 自动检测 `window.innerWidth < 768` 跳转 `/m`
- 主题切换：通过 CSS 变量实现，TailwindCSS 配置引用 `var(--xxx)`

## 相关文件清单

```
web/
  package.json
  vite.config.ts
  tailwind.config.ts
  postcss.config.cjs
  src/
    main.ts              # 入口
    App.vue              # 根组件
    style.css            # 全局样式 / CSS 变量
    env.d.ts             # Vite 类型声明
    types/index.ts       # 全局类型定义
    router/index.ts      # 路由配置
    api/                 # API 调用层 (client + 各模块)
    stores/              # Pinia 状态管理
    views/               # 页面组件 (PC + mobile/)
    components/          # 可复用组件 (business/common/layout)
    composables/         # 组合式函数 (useStickySpice)
    utils/               # 工具函数 (currency, search)
```

## 变更记录 (Changelog)

| 时间 | 操作 | 说明 |
|------|------|------|
| 2026-02-20 15:10:51 UTC | 初始化 | 首次生成模块文档 |
