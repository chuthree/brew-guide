# 模态框历史栈管理规范

## 概述
支持硬件返回键和浏览器返回按钮关闭模态框，支持多步骤表单。使用 Tailwind CSS 替代 framer-motion 实现动画，更轻量且功能完整。

## 核心原则

1. **简单直接**：每次模态框打开都添加历史记录，不做复杂的状态检查
2. **正确的退出动画**：确保 CSS transition 的 exit 效果能够完整执行
3. **状态重置**：防止表单状态在不同操作间保留
4. **iOS 体验**：滑入动画需要手动实现，滑出动画由系统提供

## 实现方案

### 单层模态框（全屏滑入）

```typescript
// 控制动画状态
const [shouldRender, setShouldRender] = useState(false)
const [isVisible, setIsVisible] = useState(false)

// 处理显示/隐藏动画
useEffect(() => {
    if (isOpen) {
        setShouldRender(true)
        // 短暂延迟确保DOM渲染，然后触发滑入动画
        const timer = setTimeout(() => setIsVisible(true), 10)
        return () => clearTimeout(timer)
    } else {
        setIsVisible(false)
        // 等待动画完成后移除DOM
        const timer = setTimeout(() => setShouldRender(false), 350)
        return () => clearTimeout(timer)
    }
}, [isOpen])

// 历史栈管理
useEffect(() => {
    if (!isOpen) return
    
    window.history.pushState({ modal: 'bean-detail' }, '')
    
    const handlePopState = () => onClose()
    window.addEventListener('popstate', handlePopState)
    
    return () => window.removeEventListener('popstate', handlePopState)
}, [isOpen, onClose])

// 关闭处理
const handleClose = () => {
    if (window.history.state?.modal === 'bean-detail') {
        window.history.back()
    } else {
        onClose()
    }
}

// 渲染
if (!shouldRender) return null

return (
    <div
        className={`
            fixed inset-0 z-50 max-w-[500px] mx-auto overflow-hidden 
            bg-neutral-50 dark:bg-neutral-900 flex flex-col
            transition-transform duration-[350ms] ease-[cubic-bezier(0.36,0.66,0.04,1)]
            ${isVisible ? 'translate-x-0' : 'translate-x-full'}
        `}
    >
        {/* 内容 */}
    </div>
)
```

### 多步骤表单模态框（底部弹出）

**Modal 组件**：
```typescript
const formRef = useRef<{ handleBackStep: () => boolean } | null>(null)

// 历史栈管理 - 支持硬件返回键和浏览器返回按钮
useEffect(() => {
    if (!showForm) return

    // 如果历史栈中有 bean-detail 记录，用 replaceState 替换它
    // 注意：侧滑时可能仍会短暂看到详情页，这是浏览器机制限制
    if (window.history.state?.modal === 'bean-detail') {
        window.history.replaceState({ modal: 'bean-form' }, '')
    } else {
        // 添加表单的历史记录
        window.history.pushState({ modal: 'bean-form' }, '')
    }

    // 监听返回事件
    const handlePopState = () => {
        // 询问表单是否还有上一步
        if (formRef.current?.handleBackStep()) {
            // 表单内部处理了返回（返回上一步），重新添加历史记录
            window.history.pushState({ modal: 'bean-form' }, '')
        } else {
            // 表单已经在第一步，关闭模态框
            onClose()
        }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
}, [showForm, onClose])

// 处理关闭
const handleClose = () => {
    // 如果历史栈中有我们添加的条目，触发返回
    if (window.history.state?.modal === 'bean-form') {
        window.history.back()
    } else {
        // 否则直接关闭
        onClose()
    }
}

// 渲染 - 使用条件渲染和动态key确保表单状态重置
return (
    <div
        className={`
            fixed inset-0 z-50 transition-all duration-300
            ${showForm 
                ? 'opacity-100 pointer-events-auto bg-black/30' 
                : 'opacity-0 pointer-events-none'
            }
        `}
    >
        <div
            className={`
                absolute inset-x-0 bottom-0 max-w-[500px] mx-auto max-h-[85vh] 
                overflow-auto rounded-t-2xl bg-neutral-50 dark:bg-neutral-900 shadow-xl
                transition-transform duration-300 ease-[cubic-bezier(0.33,1,0.68,1)]
                ${showForm ? 'translate-y-0' : 'translate-y-full'}
            `}
        >
            <div className="px-6 pb-safe-bottom overflow-auto max-h-[calc(85vh-40px)] modal-form-container">
                {showForm && (
                    <CoffeeBeanForm
                        key={`bean-form-${initialBean?.id || 'new'}-${Date.now()}`}
                        ref={formRef}
                        onSave={onSave}
                        onCancel={handleClose}
                        initialBean={initialBean || undefined}
                    />
                )}
            </div>
        </div>
    </div>
)
```

**Form 组件**：
```typescript
export interface FormHandle {
    handleBackStep: () => boolean
}

const Form = forwardRef<FormHandle, FormProps>((props, ref) => {
    useImperativeHandle(ref, () => ({
        handleBackStep: () => {
            if (currentStep > 0) {
                setCurrentStep(currentStep - 1)
                return true  // 处理了返回
            }
            return false  // 已在第一步
        }
    }))
    
    // ... 表单逻辑
})

Form.displayName = 'Form'
```

## 关键实现要点

### 1. 动画与DOM管理
- **底部弹出模态框**：可以直接使用 `showForm` 状态控制CSS类，简单高效
- **全屏滑入模态框**：需要双重状态控制（`shouldRender` + `isVisible`）确保滑入动画正确执行

### 2. 表单状态重置
**问题**：移除 framer-motion 后，组件不再自动卸载，表单状态会保留
**解决**：使用条件渲染 + 动态key强制重新创建表单组件
```typescript
{showForm && (
    <Form key={`form-${id}-${Date.now()}`} />
)}
```

### 3. 历史栈管理
**核心原则**：保持简单，每次都 `pushState`，不做复杂检查
**特殊处理**：从详情页进入编辑时，用 `replaceState` 替换详情页记录

### 4. iOS 动画体验
- **滑入**：需要手动实现CSS动画（系统不提供）
- **滑出**：iOS系统自动提供统一的返回动画效果

## 动画配置

### 底部弹出（easeOutCubic）
```css
transition-transform duration-300 ease-[cubic-bezier(0.33,1,0.68,1)]
```

### 全屏滑入（自定义缓动）
```css
transition-transform duration-[350ms] ease-[cubic-bezier(0.36,0.66,0.04,1)]
```

## 常见问题解决

### Q: 多次点击按钮后模态框无法显示
**A**: 历史栈状态污染，添加组件key或优化历史栈管理

### Q: 表单内容在不同操作间保留
**A**: 使用条件渲染 + 动态key确保组件重新创建

### Q: iOS上没有滑入动画
**A**: 实现双重状态控制，确保从初始状态到最终状态的完整过渡

### Q: 退出动画不完整
**A**: 确保CSS有 exit 过渡效果，给足够时间让动画完成后再移除DOM

### 多层嵌套设置页面（设置界面特殊处理）

设置界面是一个复杂的多层嵌套结构，包含主设置页面和多个子设置页面。需要特殊的历史栈管理策略：

**主设置组件**：
```typescript
// 历史栈管理 - 支持多层嵌套设置页面
useEffect(() => {
    if (!isOpen) return
    
    // 检查是否已经有设置相关的历史记录
    const hasSettingsHistory = window.history.state?.modal?.includes('-settings') || 
                              window.history.state?.modal === 'settings'
    
    if (hasSettingsHistory) {
        // 如果已经有设置历史记录，替换它
        window.history.replaceState({ modal: 'settings' }, '')
    } else {
        // 添加新的历史记录
        window.history.pushState({ modal: 'settings' }, '')
    }
    
    const handlePopState = () => {
        // 检查是否有子设置页面打开
        const hasSubSettingsOpen = showDisplaySettings || showGrinderSettings || 
                                  showBeanSettings || showTimerSettings || showDataSettings
        
        if (hasSubSettingsOpen) {
            // 如果有子设置页面打开，关闭它们
            setShowDisplaySettings(false)
            setShowGrinderSettings(false)
            // ... 关闭所有子设置页面
            // 重新添加主设置的历史记录
            window.history.pushState({ modal: 'settings' }, '')
        } else {
            // 没有子页面打开，关闭主设置
            onClose()
        }
    }
    
    window.addEventListener('popstate', handlePopState)
    
    return () => window.removeEventListener('popstate', handlePopState)
}, [isOpen, onClose, showDisplaySettings, showGrinderSettings, /* ... 所有子设置状态 */])
```

**子设置组件**：
```typescript
// 子设置页面的历史栈管理
React.useEffect(() => {
    window.history.pushState({ modal: 'display-settings' }, '')
    
    const handlePopState = () => onClose()
    window.addEventListener('popstate', handlePopState)
    
    return () => window.removeEventListener('popstate', handlePopState)
}, [onClose])

// 关闭处理
const handleClose = () => {
    if (window.history.state?.modal === 'display-settings') {
        window.history.back()
    } else {
        onClose()
    }
}

// 控制动画状态
const [shouldRender, setShouldRender] = React.useState(false)
const [isVisible, setIsVisible] = React.useState(false)

// 处理显示/隐藏动画
React.useEffect(() => {
    setShouldRender(true)
    // 短暂延迟确保DOM渲染，然后触发滑入动画
    const timer = setTimeout(() => setIsVisible(true), 10)
    return () => clearTimeout(timer)
}, [])

// 渲染
if (!shouldRender) return null

return (
    <div
        className={`
            fixed inset-0 z-50 flex flex-col bg-neutral-50 dark:bg-neutral-900 max-w-[500px] mx-auto
            transition-transform duration-[350ms] ease-[cubic-bezier(0.36,0.66,0.04,1)]
            ${isVisible ? 'translate-x-0' : 'translate-x-full'}
        `}
    >
        {/* 内容 */}
    </div>
)
```

**关键实现要点**：
1. **智能历史记录管理**：主设置页面检测是否已有设置相关历史记录，避免重复添加
2. **多层返回处理**：从子设置页面返回时，主设置页面不关闭，而是重新添加自己的历史记录
3. **统一命名规范**：所有设置相关的 modal 标识都包含 'settings'，便于识别和管理
4. **完整状态追踪**：主设置组件监听所有子设置页面的状态，确保准确判断当前层级

## 已知限制

**侧滑预览闪烁**：PWA/网页侧滑返回时可能短暂看到父模态框，这是浏览器机制限制，无法完全避免。硬件返回键和浏览器按钮工作正常。

## 示例参考

- **全屏滑入**：`src/components/coffee-bean/Detail/BeanDetailModal.tsx`
- **底部弹出多步骤**：`src/components/coffee-bean/Form/Modal.tsx` + `index.tsx`
- **底部弹出简单**：参考笔记表单的实现模式
- **多层嵌套设置**：`src/components/settings/Settings.tsx` + 各子设置组件
