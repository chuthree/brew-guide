# 极简模式技术文档

## 概述

极简模式是 Brew Guide 应用中的一个显示选项，旨在通过隐藏非必要信息，为用户提供更加精简、专注的界面体验。该模式可以通过设置页面开启或关闭，当开启时，应用的多个组件将采用更简洁的显示方式。

## 实现原理

### 1. 设置存储与管理

极简模式的状态存储在应用的全局设置中，使用 `minimalistMode` 属性表示。

```typescript
// 在 src/components/settings/Settings.tsx 中定义
export interface SettingsOptions {
    // ...其他设置项
    minimalistMode: boolean // 极简模式开关
}

// 默认设置
export const defaultSettings: SettingsOptions = {
    // ...其他默认值
    minimalistMode: false // 默认不启用极简模式
}
```

### 2. 组件中获取极简模式状态

各个组件通过以下方式获取极简模式状态：

```typescript
// 添加极简模式状态
const [isMinimalistMode, setIsMinimalistMode] = useState(false);

// 获取全局设置
useEffect(() => {
    const loadSettings = async () => {
        try {
            const settingsStr = await Storage.get('brewGuideSettings');
            if (settingsStr) {
                const parsedSettings = JSON.parse(settingsStr) as SettingsOptions;
                setIsMinimalistMode(parsedSettings.minimalistMode || false);
            }
        } catch (error) {
            console.error('加载设置失败', error);
        }
    };
    
    loadSettings();
    
    // 监听设置变更
    const handleSettingsChange = (e: CustomEvent) => {
        if (e.detail?.key === 'brewGuideSettings') {
            loadSettings();
        }
    };
    
    window.addEventListener('storageChange', handleSettingsChange as EventListener);
    return () => {
        window.removeEventListener('storageChange', handleSettingsChange as EventListener);
    };
}, []);
```

### 3. 响应极简模式的变化

在组件的 JSX 渲染部分，根据 `isMinimalistMode` 的值决定是否显示某些元素：

```jsx
{/* 只在非极简模式下显示 */}
{!isMinimalistMode && (
    <div className="...">
        {/* 要在极简模式下隐藏的内容 */}
    </div>
)}

{/* 或者使用条件表达式 */}
{`${beansCount} 款咖啡豆${!isMinimalistMode && totalWeight ? `，共 ${totalWeight}` : ''}`}
```

## 当前应用位置

极简模式目前已应用在以下组件中：

### 1. BeanListItem 组件 (`src/components/coffee-bean/List/components/BeanListItem.tsx`)

在极简模式下隐藏：
- 风味标签（例如：酸甜/花香等）
- 价格信息（价格和单价）

### 2. ViewSwitcher 组件 (`src/components/coffee-bean/List/components/ViewSwitcher.tsx`)

在极简模式下隐藏：
- 咖啡豆总重量显示（如"共 100克"）

### 3. NoteItem 组件 (`src/components/notes/List/NoteItem.tsx`)

在极简模式下隐藏：
- 价格信息（单价信息）
- 风味评分（酸度、甜度、苦度、口感等详细评分）
- 总体评分的进度条显示

## 如何为新组件添加极简模式支持

如需为新组件添加极简模式支持，请按照以下步骤操作：

### 1. 导入必要的依赖

```typescript
import { Storage } from '@/lib/core/storage'
import { SettingsOptions } from '@/components/settings/Settings'
```

### 2. 添加极简模式状态和加载逻辑

```typescript
// 添加极简模式状态
const [isMinimalistMode, setIsMinimalistMode] = useState(false);

// 获取全局设置
useEffect(() => {
    const loadSettings = async () => {
        try {
            const settingsStr = await Storage.get('brewGuideSettings');
            if (settingsStr) {
                const parsedSettings = JSON.parse(settingsStr) as SettingsOptions;
                setIsMinimalistMode(parsedSettings.minimalistMode || false);
            }
        } catch (error) {
            console.error('加载设置失败', error);
        }
    };
    
    loadSettings();
    
    // 监听设置变更
    const handleSettingsChange = (e: CustomEvent) => {
        if (e.detail?.key === 'brewGuideSettings') {
            loadSettings();
        }
    };
    
    window.addEventListener('storageChange', handleSettingsChange as EventListener);
    return () => {
        window.removeEventListener('storageChange', handleSettingsChange as EventListener);
    };
}, []);
```

### 3. 修改组件渲染逻辑

根据组件的具体需求，使用条件渲染来决定哪些内容在极简模式下应该隐藏：

```jsx
{/* 在极简模式下不显示 */}
{!isMinimalistMode && (
    <div className="...">
        {/* 需要在极简模式下隐藏的次要信息 */}
    </div>
)}

{/* 或者使用条件表达式动态构建字符串 */}
{`${mainInfo}${!isMinimalistMode ? ` (${additionalInfo})` : ''}`}
```

### 4. 遵循设计原则

在决定哪些内容应该在极简模式下隐藏时，请遵循以下原则：

- 保留必要的核心信息（如咖啡豆名称、基本参数）
- 隐藏次要的详细信息（如详细的评分、价格计算、风味描述等）
- 确保界面在极简模式下仍然功能完整，只是信息量减少
- 保持一致性，类似的信息在不同组件中应采用相同的隐藏策略

## 测试指南

在为组件添加极简模式支持后，请确保进行以下测试：

1. 进入设置页面，切换极简模式开关，确认组件正确响应设置变化
2. 检查组件在极简模式下的显示是否符合预期
3. 确保组件在极简模式切换时不会出现布局混乱或渲染错误
4. 验证在不同设备和屏幕尺寸下极简模式的显示效果

## 更新说明文本

当为新组件添加极简模式支持后，记得更新设置页面中的极简模式说明文本，告知用户新增的隐藏内容：

```typescript
// 在 src/components/settings/Settings.tsx 中
<p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
    开启后将隐藏：咖啡豆列表中的风味标签和价格信息、豆子总重量显示等
    {/* 添加新组件中隐藏的内容描述 */}
</p>
``` 