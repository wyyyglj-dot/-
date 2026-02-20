## 📋 实施计划：辣度选择器轻量化重构 (v2)

### 任务类型
- [x] 前端 (→ Gemini)

### 问题分析

当前 `SpiceRadialMenu.vue` 使用全屏遮罩 (`fixed inset-0` + `backdrop-filter: blur(12px)`) 居中显示 SVG 扇形菜单。
仅 3 个选项却占据整个屏幕，造成：
- 上下文断裂：用户注意力从菜品卡片被强制转移到屏幕中央
- 物理距离大：移动端拇指在卡片上，菜单却在屏幕中心
- 视觉干扰重：全屏模糊遮罩完全遮挡点餐界面

### 技术方案

**方案：卡片锚定浮动菜单（Card-Anchored Floating Menu）**

将全屏扇形菜单替换为锚定在 DishCard 上的药丸形按钮组：
- 3 个圆形彩色按钮水平排列，固定出现在触发卡片的中央位置
- 通过卡片的 `getBoundingClientRect()` 计算定位，始终与卡片对齐
- 透明背景层捕获外部点击关闭（无 blur、无背景色）
- 弹性缩放动画（scale 0.8→1）

**定位策略**：
- 水平：卡片水平中心 `rect.left + rect.width / 2`
- 垂直：卡片垂直中心 `rect.top + rect.height / 2`
- 菜单通过 `transform: translate(-50%, -50%)` 居中对齐
- 安全边界 clamp 防止超出视口

### 实施步骤

#### Step 1: DishCard 改为 emit 卡片位置信息

**文件**: `web/src/components/business/DishCard.vue`
**操作**: 小幅修改

变更要点：
1. 添加 template ref `cardRef` 指向根 div
2. `open-spice` 事件签名改为 `[rect: DOMRect, dish: Dish]`（用卡片 DOMRect 替代原始 Event）
3. `handlePressStart` 和 `contextmenu` 中 emit 时传递 `cardRef.value!.getBoundingClientRect()`

```
// 之前
emit('open-spice', event, dish)

// 之后
emit('open-spice', cardRef.value!.getBoundingClientRect(), dish)
```

#### Step 2: 重写 SpiceRadialMenu.vue 组件

**文件**: `web/src/components/business/SpiceRadialMenu.vue`
**操作**: 完全重写

变更要点：
1. Props 改为 `{ visible, anchorRect: DOMRect }` —— 接收卡片位置
2. 移除 SVG 扇形菜单，替换为 3 个圆形按钮的水平药丸布局
3. 全屏遮罩改为透明（无 blur、无背景色），仅用于捕获外部点击
4. 使用 `fixed` 定位，居中于 anchorRect 中心点
5. 添加安全边界检测（clamp），防止菜单超出视口
6. 添加 `pop` 过渡动画（弹性缩放）
7. 移除所有 window 级 mousemove/touchmove 事件监听（不再需要拖拽交互）

伪代码：
```
Props: { visible, anchorRect: DOMRect }
Emits: { select, cancel }

computed menuPos:
  centerX = anchorRect.left + anchorRect.width / 2
  centerY = anchorRect.top + anchorRect.height / 2
  safeX = clamp(centerX, 80, viewportWidth - 80)
  safeY = clamp(centerY, 40, viewportHeight - 40)

Template:
  <Teleport to="body">
    <!-- 透明背景层 (无 blur, 无背景色) -->
    <div fixed inset-0 z-9998 @click="cancel" />

    <!-- 卡片锚定菜单 -->
    <Transition name="pop">
      <div fixed z-9999 :style="{ left: safeX, top: safeY }"
           transform="translate(-50%, -50%)">
        <div class="pill-container glass-effect rounded-full p-2 gap-3">
          <button v-for="opt in options"
                  class="w-12 h-12 rounded-full"
                  :style="{ backgroundColor: opt.color }"
                  @click="emit('select', opt.id)">
            {{ opt.label }}
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
```

#### Step 3: 更新 Ordering.vue 适配新接口

**文件**: `web/src/views/Ordering.vue`
**操作**: 修改

变更要点：
1. 新增 `menuRect` ref 存储 `DOMRect`
2. `handleOpenSpice` 签名改为接收 `(rect: DOMRect, dish: Dish)`
3. `<SpiceRadialMenu>` 传入 `:anchor-rect="menuRect"`

```typescript
const menuRect = ref<DOMRect | null>(null)

function handleOpenSpice(rect: DOMRect, dish: Dish) {
  menuRect.value = rect
  spiceDish.value = dish
  spiceMenuVisible.value = true
}
```

#### Step 4: 更新 MobileOrdering.vue 适配新接口

**文件**: `web/src/views/mobile/MobileOrdering.vue`
**操作**: 修改（与 Step 3 完全相同逻辑）

### 关键文件

| 文件 | 操作 | 说明 |
|------|------|------|
| [DishCard.vue](web/src/components/business/DishCard.vue) | 修改 | emit 卡片 DOMRect 替代原始 Event |
| [SpiceRadialMenu.vue](web/src/components/business/SpiceRadialMenu.vue) | 重写 | 全屏扇形 → 卡片锚定药丸按钮组 |
| [Ordering.vue:113-124](web/src/views/Ordering.vue#L113-L124) | 修改 | 接收 DOMRect，传递给组件 |
| [MobileOrdering.vue:96-107](web/src/views/mobile/MobileOrdering.vue#L96-L107) | 修改 | 同上 |
| [useStickySpice.ts](web/src/composables/useStickySpice.ts) | 不变 | Sticky 机制不受影响 |

### 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| 菜单出现在视口边缘被裁剪 | clamp 安全边界检测，确保距边缘 ≥ 80px |
| 页面滚动后 DOMRect 失效 | 打开菜单时立即快照 rect，菜单存在期间位置固定 |
| 暗色/亮色主题适配 | 使用 glass 效果 + CSS 变量，与现有主题系统一致 |

### SESSION_ID（供 /ccg:execute 使用）
- GEMINI_SESSION: d4a16de2-aa54-4168-a60a-7448daab13e4
