# 设置模块重构指南

## 概述

本文档描述如何将设置模块重构为二级菜单结构，使用显示设置（DisplaySettings）作为示例模板。

## 重构步骤

### 1. 创建新的设置组件

在 `src/components/settings/` 目录下创建新的设置组件：

```tsx
'use client'

import React from 'react'
import { ChevronLeft } from 'lucide-react'
import { SettingsOptions } from './Settings'
import { ButtonGroup } from '../ui/ButtonGroup'
import { motion } from 'framer-motion'

interface YourSettingsProps {
    settings: SettingsOptions
    onClose: () => void
    handleChange: <K extends keyof SettingsOptions>(key: K, value: SettingsOptions[K]) => void | Promise<void>
}

const YourSettings: React.FC<YourSettingsProps> = ({
    settings,
    onClose,
    handleChange
}) => {
    return (
        <motion.div
            className="fixed inset-0 z-50 flex flex-col bg-neutral-50 dark:bg-neutral-900 max-w-[500px] mx-auto"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ 
                duration: 0.35,
                ease: [0.36, 0.66, 0.04, 1]
            }}
        >
            {/* 头部导航栏 */}
            <div className="relative flex items-center justify-center py-4 pt-safe-top">
                <button
                    onClick={onClose}
                    className="absolute left-4 flex items-center justify-center w-10 h-10 rounded-full text-neutral-700 bg-neutral-100 dark:text-neutral-300 dark:bg-neutral-800 transition-colors"
                >
                    <ChevronLeft className="h-5 w-5" />
                </button>
                <h2 className="text-md font-medium text-neutral-800 dark:text-neutral-200">
                    你的设置标题
                </h2>
            </div>

            {/* 滚动内容区域 */}
            <div className="relative flex-1 overflow-y-auto pb-safe-bottom divide-y divide-neutral-200 dark:divide-neutral-800">
                {/* 顶部渐变阴影 */}
                <div className="sticky top-0 z-10 h-12 w-full bg-linear-to-b from-neutral-50 dark:from-neutral-900 to-transparent pointer-events-none first:border-b-0"></div>

                {/* 设置内容 */}
                <div className="px-6 py-4 -mt-8">
                    {/* 在这里添加你的设置内容 */}
                </div>
            </div>
        </motion.div>
    )
}

export default YourSettings
```

### 2. 在 Settings.tsx 中添加入口按钮

在主设置页面添加新设置的入口按钮：

```tsx
// 1. 导入组件和图标
import YourSettings from './YourSettings'
import { YourIcon } from 'lucide-react'

// 2. 添加状态
const [showYourSettings, setShowYourSettings] = useState(false)

// 3. 添加入口按钮
<button
    onClick={() => setShowYourSettings(true)}
    className="w-full py-3 px-4 text-sm font-medium text-neutral-800 bg-neutral-100 rounded transition-colors hover:bg-neutral-200 dark:text-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 flex items-center justify-between"
>
    <div className="flex items-center space-x-3">
        <YourIcon className="h-4 w-4 text-neutral-500" />
        <span>你的设置名称</span>
    </div>
    <ChevronRight className="h-4 w-4 text-neutral-400" />
</button>

// 4. 添加组件渲染
<AnimatePresence>
    {showYourSettings && (
        <YourSettings
            settings={settings}
            onClose={() => setShowYourSettings(false)}
            handleChange={handleChange}
        />
    )}
</AnimatePresence>
```

### 3. 移动相关代码

1. 从 `Settings.tsx` 中找到相关的设置代码
2. 将代码移动到新的组件中
3. 确保所有类型、状态和功能都正确迁移
4. 保留必要的接口和类型定义在 `Settings.tsx` 中

### 4. 注意事项

- 保持组件命名一致性，例如：TimerSettings、BeanSettings 等
- 确保所有状态和设置都通过 `handleChange` 正确更新
- 使用合适的图标来表示设置类别
- 保持样式和动画效果的一致性
- 注意处理任何可能的副作用（useEffect）
- 确保正确处理黑暗模式

## 建议的设置分类和图标

| 设置类别 | 组件名 | 推荐图标 |
|---------|--------|----------|
| 显示设置 | DisplaySettings | Monitor, Eye |
| 磨豆机设置 | GrinderSettings | Settings, Coffee |
| 计时器布局 | TimerSettings | Timer, Layout |
| 数据管理 | DataSettings | Database, Save |
| 咖啡豆管理 | BeanSettings | Bean, List |

## 测试清单

- [ ] 确保设置正确保存和加载
- [ ] 验证动画效果是否流畅
- [ ] 测试黑暗模式切换
- [ ] 确认所有交互响应
- [ ] 验证设置项更新后的效果
- [ ] 测试返回按钮功能

## 常见问题

1. 设置没有正确保存
   - 确认是否正确使用了 handleChange
   - 检查类型定义是否正确

2. 动画不流畅
   - 确认是否正确使用了 AnimatePresence
   - 检查动画参数设置

3. 样式不一致
   - 复用现有的样式类
   - 参考 DisplaySettings 的实现