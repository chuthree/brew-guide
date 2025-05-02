# 设计语言规范

## 设计原则

1. **极简主义**
   - 避免卡片式设计
   - 避免过度设计
   - 符合人机交互逻辑
   - 保持设计语言高度统一

2. **移动优先**
   - 目标群体为手机用户
   - 确保在移动设备上的最佳体验

## 颜色系统

### 文本颜色
```css
/* 主要文本（标题/选中文本） */
.text-primary {
  @apply text-neutral-800 dark:text-white;
}

/* 次要文本/说明文本 */
.text-secondary {
  @apply text-neutral-600 dark:text-neutral-400;
}

/* 菜单项悬停效果 */
.hover-effect {
  @apply hover:opacity-80;
}
```

### 边框和分隔线
```css
/* 标准边框 */
.border-standard {
  @apply border-neutral-200 dark:border-neutral-800;
}

/* 选中状态下划线 */
.border-selected {
  @apply bg-neutral-800 dark:bg-white;
}
```

### 背景色
```css
/* 页面背景 */
.bg-page {
  @apply bg-neutral-50 dark:bg-neutral-900;
}

/* 弹出菜单背景 */
.bg-popup {
  @apply bg-white/95 dark:bg-neutral-900/95;
}

/* 选中项背景/高亮 */
.bg-highlight {
  @apply bg-neutral-100/60 dark:bg-neutral-800/30;
}
```

### 进度条
```css
/* 进度条背景 */
.progress-bg {
  @apply bg-neutral-200/50 dark:bg-neutral-800;
}

/* 进度条前景 */
.progress-fg {
  @apply bg-neutral-800 dark:bg-neutral-100;
}
```

## 交互规范

### 按钮和选择器
- 统一使用相同的文本颜色
- 统一使用相同的悬停效果
- 避免使用多种不同的交互样式

### 下拉列表
```css
/* 下拉列表项高亮 */
.dropdown-item {
  @apply data-[highlighted]:opacity-80;
}
```

## 最佳实践

### 1. 颜色使用
- 保持颜色一致性，避免引入新的颜色
- 使用语义化的颜色变量
- 确保颜色对比度符合可访问性标准

### 2. 间距和对齐
- 使用一致的间距系统
- 保持元素对齐
- 遵循视觉层次

### 3. 响应式设计
- 使用相对单位（rem, em）
- 实现流畅的响应式布局
- 考虑不同设备的交互方式

### 4. 暗色模式
- 确保所有组件支持暗色模式
- 保持足够的对比度
- 避免使用绝对的黑色和白色

### 5. 动画和过渡
- 使用简单、流畅的动画
- 保持一致的动画时长
- 考虑用户的动画偏好设置

## 组件示例

### 1. 按钮
```tsx
<button className="text-neutral-800 dark:text-white hover:opacity-80">
  按钮文本
</button>
```

### 2. 输入框
```tsx
<input 
  className="border-neutral-200 dark:border-neutral-800 
             bg-white dark:bg-neutral-900
             text-neutral-800 dark:text-white"
/>
```

### 3. 菜单项
```tsx
<div className="bg-white/95 dark:bg-neutral-900/95 hover:opacity-80">
  菜单项
</div>
```

## 辅助工具

### 1. 通用样式类
```css
/* 标准过渡效果 */
.transition-standard {
  @apply transition-all duration-200 ease-in-out;
}

/* 标准阴影 */
.shadow-standard {
  @apply shadow-sm dark:shadow-none;
}
```

### 2. 工具函数
```typescript
// 根据主题返回适当的颜色
const getThemeColor = (isDark: boolean) => ({
  text: isDark ? 'white' : 'neutral-800',
  background: isDark ? 'neutral-900' : 'neutral-50',
});
```

## 图标规范

### 1. 图标库
- 使用 [Lucide Icons](https://lucide.dev/) 作为统一图标库
- 保持图标风格的一致性
- 优先使用线性图标

### 2. 图标尺寸
```tsx
/* 标准尺寸 */
.icon-xs {
  @apply w-4 h-4;  /* 16px - 小型图标，用于紧凑型UI */
}

.icon-sm {
  @apply w-5 h-5;  /* 20px - 默认大小，用于普通UI元素 */
}

.icon-md {
  @apply w-6 h-6;  /* 24px - 中等大小，用于强调性UI */
}

.icon-lg {
  @apply w-8 h-8;  /* 32px - 大型图标，用于特殊场景 */
}
```

### 3. 图标颜色
```tsx
/* 继承文本颜色 */
.icon-inherit {
  @apply text-current;
}

/* 主要图标 */
.icon-primary {
  @apply text-neutral-800 dark:text-white;
}

/* 次要图标 */
.icon-secondary {
  @apply text-neutral-600 dark:text-neutral-400;
}
```

### 4. 使用示例
```tsx
import { Coffee, Settings, ChevronRight } from 'lucide-react';

// 基础使用
<Coffee className="icon-sm icon-primary" />

// 带交互效果
<button className="flex items-center gap-2 hover:opacity-80">
  <Settings className="icon-sm icon-inherit" />
  <span>设置</span>
</button>

// 导航箭头
<ChevronRight className="icon-xs icon-secondary" />
```

### 5. 最佳实践
- 保持图标大小一致性，同类场景使用相同尺寸
- 图标颜色应与周围文本保持一致
- 交互式图标应有明确的悬停状态
- 避免使用过于复杂的图标
- 确保图标的语义清晰

### 6. 常用图标场景
```tsx
/* 导航栏图标 */
.nav-icon {
  @apply icon-sm icon-primary;
}

/* 操作按钮图标 */
.action-icon {
  @apply icon-sm icon-inherit hover:opacity-80;
}

/* 表单图标 */
.form-icon {
  @apply icon-sm icon-secondary;
}

/* 提示/状态图标 */
.status-icon {
  @apply icon-xs icon-secondary;
}
```

### 7. 动画图标
```tsx
/* 旋转动画 */
.icon-spin {
  @apply animate-spin;
}

/* 脉冲动画 */
.icon-pulse {
  @apply animate-pulse;
}
```

## 设计审查清单

- [ ] 是否遵循极简主义原则
- [ ] 是否保持设计语言统一
- [ ] 是否适配移动设备
- [ ] 是否支持暗色模式
- [ ] 是否符合可访问性标准
- [ ] 是否使用规范的颜色系统
- [ ] 是否保持一致的交互模式
- [ ] 是否考虑边缘情况 