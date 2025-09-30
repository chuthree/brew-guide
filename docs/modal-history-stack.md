# 模态框历史栈管理规范

## 概述
为模态框添加历史栈管理，支持硬件返回键（Android）和浏览器返回按钮关闭模态框。

## 实现模式

### 1. 添加历史栈监听（useEffect）

```typescript
// 历史栈管理 - 支持硬件返回键和浏览器返回按钮
useEffect(() => {
    if (!isOpen) return

    // 添加模态框历史记录
    window.history.pushState({ modal: 'modal-unique-id' }, '')

    // 监听返回事件
    const handlePopState = () => {
        onClose()
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
        window.removeEventListener('popstate', handlePopState)
    }
}, [isOpen, onClose])
```

**关键点：**
- `modal-unique-id`：每个模态框使用唯一标识符
- 依赖项：`[isOpen, onClose]`
- 清理函数：移除事件监听器

### 2. 修改关闭处理函数

```typescript
const handleClose = () => {
    // 如果历史栈中有我们添加的条目，触发返回
    if (window.history.state?.modal === 'modal-unique-id') {
        window.history.back()
    } else {
        // 否则直接关闭
        onClose()
    }
}
```

**关键点：**
- 检查 `window.history.state` 是否包含模态框标识
- 匹配时调用 `window.history.back()`，触发 popstate 事件
- 不匹配时直接调用 `onClose()`

### 3. 移除拖拽动画（可选）

如果之前使用 `framer-motion` 的拖拽关闭功能，需要移除：

```diff
- import { motion, AnimatePresence } from 'framer-motion'
+ import { AnimatePresence } from 'framer-motion'

- <motion.div
-     drag="x"
-     dragConstraints={{ left: 0, right: 0 }}
-     onDragEnd={handleDragEnd}
-     ...
- >
+ <div className="...">
```

## 适配步骤

1. 确定模态框唯一标识符（如：`bean-detail`, `brewing-detail`, `settings`）
2. 在模态框组件中添加历史栈管理 useEffect
3. 修改 handleClose 函数逻辑
4. 测试：点击关闭按钮、硬件返回键、浏览器返回按钮

## 示例：BeanDetailModal

**标识符：** `bean-detail`

**位置：** `src/components/coffee-bean/Detail/BeanDetailModal.tsx`

**修改点：**
1. 第 91-108 行：添加历史栈管理 useEffect
2. 第 363-371 行：修改 handleClose 函数
3. 移除 motion.div 拖拽相关代码

## 注意事项

- 每个模态框使用唯一的 modal 标识符，避免冲突
- 确保 `onClose` 在依赖项中，避免闭包问题
- 移除事件监听器，防止内存泄漏
- 优先使用历史栈返回，保持用户体验一致性
