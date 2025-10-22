# iOS 风格页面转场动画实现指南

## 概述

本项目实现了类似 iOS 原生的页面转场动画效果：
- 父页面向左滑动 24px，透明度降至 0.9
- 子页面从右侧 24px 处滑入，同时淡入
- 动画持续 350ms，使用 Material Design 缓动曲线
- 支持多层级嵌套（主页 → 设置 → 子设置 → 咖啡豆详情）

## 核心原则

⚠️ **最重要的规则**：**模态框必须在主页面容器外独立渲染，否则会受父容器 transform 影响导致位置错误**

## 快速开始 - 5 步集成

### 1. 在 page.tsx 添加状态管理

⚠️ **最重要的规则**：**模态框必须在主页面容器外独立渲染，否则会受父容器 transform 影响导致位置错误**

```typescript
// 1. 添加模态框状态
const [yourModalOpen, setYourModalOpen] = useState(false)
const [yourModalData, setYourModalData] = useState<YourDataType | null>(null)

// 2. 更新模态框状态计算
const hasAnyModalOpen = isSettingsOpen || hasSubSettingsOpen || yourModalOpen

// 3. 统一管理 pageStackManager
React.useEffect(() => {
    pageStackManager.setModalOpen(hasAnyModalOpen)
}, [hasAnyModalOpen])

// 4. 监听打开/关闭事件
React.useEffect(() => {
    const handleYourModalOpened = (e: Event) => {
        const customEvent = e as CustomEvent<{ data: YourDataType }>
        if (!customEvent.detail || !customEvent.detail.data) {
            console.error('YourModal: 打开事件缺少必要数据')
            return
        }
        setYourModalData(customEvent.detail.data)
        setYourModalOpen(true)
    }
    
    const handleYourModalClosing = () => {
        setYourModalOpen(false)
    }
    
    window.addEventListener('yourModalOpened', handleYourModalOpened as EventListener)
    window.addEventListener('yourModalClosing', handleYourModalClosing)
    
    return () => {
        window.removeEventListener('yourModalOpened', handleYourModalOpened as EventListener)
        window.removeEventListener('yourModalClosing', handleYourModalClosing)
    }
}, [])
```

### 2. 在 page.tsx 底部独立渲染模态框

```tsx
return (
    <>
        {/* 主页面内容 - 应用转场动画 */}
        <div 
            className="h-full flex flex-col overflow-y-scroll"
            style={getParentPageStyle(hasModalOpen)}
        >
            {/* 主页面内容 */}
        </div>

        {/* 模态框独立渲染，在主页面外部 */}
        <Settings isOpen={isSettingsOpen} ... />
        <YourModal 
            isOpen={yourModalOpen}
            data={yourModalData}
            onClose={() => setYourModalOpen(false)}
        />
    </>
)
```

### 3. 创建模态框组件

```tsx
'use client'
import React, { useState, useEffect } from 'react'
import { getChildPageStyle } from '@/lib/navigation/pageTransition'

interface YourModalProps {
    isOpen: boolean
    data: YourDataType | null
    onClose: () => void
}

const YourModal: React.FC<YourModalProps> = ({ isOpen, data, onClose }) => {
    const [shouldRender, setShouldRender] = useState(false)
    const [isVisible, setIsVisible] = useState(false)

    // 处理显示/隐藏动画
    useEffect(() => {
        if (isOpen) {
            setShouldRender(true)
            // 使用 requestAnimationFrame 触发动画（比 setTimeout 更快更流畅）
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setIsVisible(true)
                })
            })
        } else {
            setIsVisible(false)
            const timer = setTimeout(() => {
                setShouldRender(false)
            }, 350) // 与动画时长匹配
            return () => clearTimeout(timer)
        }
    }, [isOpen])

    // 关闭处理
    const handleClose = () => {
        setIsVisible(false) // 触发退出动画
        window.dispatchEvent(new CustomEvent('yourModalClosing')) // 通知父组件
        
        setTimeout(() => {
            onClose() // 350ms 后真正关闭
        }, 350)
    }

    if (!shouldRender) return null

    return (
        <div
            className="fixed inset-0 z-[60] max-w-[500px] mx-auto overflow-hidden bg-neutral-50 dark:bg-neutral-900 flex flex-col"
            style={getChildPageStyle(isVisible)}
        >
            {/* 模态框内容 */}
            <button onClick={handleClose}>关闭</button>
        </div>
    )
}

export default YourModal
```

### 4. 在调用处发送打开事件

```tsx
// 在需要打开模态框的地方
const handleOpenModal = (data: YourDataType) => {
    window.dispatchEvent(new CustomEvent('yourModalOpened', {
        detail: { data }
    }))
}
```

### 5. 设置正确的 z-index 层级

```
主页面：默认 (z-index: 0)
Settings：z-50
子设置/其他模态框：z-[60]
嵌套模态框（在 z-[60] 内打开）：z-[70]
更深层嵌套：z-[80]+
```

**注意**：如果模态框内部需要打开子模态框（如 `BeanImportModal` 中的 `QRScannerModal`），子模态框的 z-index 必须比父模态框高 10，才能正确显示在上层。

## 关键要点

### ✅ 必须遵循

1. **独立渲染**：模态框必须在主页面的 `</div>` 之外渲染
2. **事件驱动**：通过自定义事件通信，不通过 props 层层传递
3. **延迟关闭**：先播放动画（350ms），再调用 `onClose()`
4. **通知父组件**：关闭时立即触发 `xxxClosing` 事件
5. **使用 requestAnimationFrame**：比 setTimeout 更快更流畅

### ⚠️ 常见错误

| 错误 | 现象 | 解决方案 |
|------|------|---------|
| 模态框在主页面内渲染 | 位置跟随父容器移动，超出界面 | 移到主页面容器外独立渲染 |
| 立即调用 onClose() | 动画无法播放，直接消失 | 延迟 350ms 后再调用 |
| 忘记触发关闭事件 | 父页面不恢复，动画不同步 | handleClose 中调用 dispatchEvent |
| 未更新 hasAnyModalOpen | 父页面不移动 | 将新状态加入计算 |
| 事件 detail 为空 | 运行时报错 | 添加安全检查 |

### 📊 状态更新时序

```
用户点击关闭按钮
    ↓
setIsVisible(false)                 // 立即触发退出动画
    ↓
dispatchEvent('xxxClosing')         // 立即通知父组件
    ↓
父组件 setXxxOpen(false)            // 父组件更新状态
    ↓
hasAnyModalOpen 变为 false          // 触发父页面恢复动画
    ↓
父页面和模态框同时播放动画 (350ms)
    ↓
onClose() / window.history.back()   // 真正卸载组件
```

## 已集成的模态框

### 设置系统
- **Settings** - 主设置页面 (z-50)
- **DisplaySettings** - 显示设置 (z-60)
- **GrinderSettings** - 磨豆机设置 (z-60)
- **StockSettings** - 库存设置 (z-60)
- **BeanSettings** - 咖啡豆设置 (z-60)
- **FlavorPeriodSettings** - 赏味期设置 (z-60)
- **TimerSettings** - 计时器设置 (z-60)
- **DataSettings** - 数据设置 (z-60)
- **NotificationSettings** - 通知设置 (z-60)
- **RandomCoffeeBeanSettings** - 随机咖啡豆设置 (z-60)
- **SearchSortSettings** - 搜索排序设置 (z-60)
- **FlavorDimensionSettings** - 风味维度设置 (z-60)

### 咖啡豆系统
- **BeanDetailModal** - 咖啡豆详情页面 (z-60)
  - 从咖啡豆列表打开
  - 事件：`beanDetailOpened` / `beanDetailClosing`
- **BeanImportModal** - 添加咖啡豆页面 (z-60)
  - 从咖啡豆列表添加按钮打开
  - 事件：`beanImportOpened` / `beanImportClosing`
  - 内部嵌套：
    - **QRScannerModal** - 扫描二维码 (z-70)
    - **BeanSearchModal** - 搜索咖啡豆 (z-70)

### 笔记系统
- **BrewingNoteEditModal** - 编辑笔记页面 (z-60)
  - 从笔记列表点击笔记打开
  - 事件：`brewingNoteEditOpened` / `brewingNoteEditClosing`

## 性能优化技巧

### 使用 requestAnimationFrame 替代 setTimeout

**之前（慢）：**
```typescript
setTimeout(() => setIsVisible(true), 10)  // 固定 10ms 延迟
```

**现在（快）：**
```typescript
requestAnimationFrame(() => {              // 第一帧：等待 DOM 更新
    requestAnimationFrame(() => {          // 第二帧：等待样式计算完成
        setIsVisible(true)                 // 触发动画
    })
})
```

**优势：**
- 延迟通常只有 2-3ms（vs 10ms）
- 与浏览器渲染周期同步
- 动画更流畅
- 页面不可见时自动暂停

## API 参考

### pageTransition.ts

```typescript
// 父页面样式
getParentPageStyle(hasModal: boolean): CSSProperties

// 子页面样式  
getChildPageStyle(isVisible: boolean): CSSProperties

// 全局状态管理
pageStackManager.setModalOpen(isOpen: boolean)
pageStackManager.subscribe(callback: (hasModal: boolean) => void)
```

## 故障排查

| 问题 | 检查项 | 解决方案 |
|------|--------|---------|
| 父页面不移动 | hasAnyModalOpen 是否包含新状态？ | 更新计算逻辑 |
| 位置错误/超出界面 | 模态框是否在主页面容器内？ | 移到容器外独立渲染 |
| 动画不同步 | 是否触发了关闭事件？ | 添加 dispatchEvent |
| 动画卡顿 | 是否使用了 setTimeout？ | 改用 requestAnimationFrame |
| 运行时报错 | 事件 detail 是否为空？ | 添加安全检查 |

## 参考文件

- `src/lib/navigation/pageTransition.ts` - 核心工具库
- `src/app/page.tsx` - 主页面实现
- `src/components/settings/Settings.tsx` - Settings 实现
- `src/components/coffee-bean/Detail/BeanDetailModal.tsx` - 咖啡豆详情实现
- `src/components/notes/Form/BrewingNoteEditModal.tsx` - 笔记编辑实现
