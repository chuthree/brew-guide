# 极简模式技术文档

## 概述

极简模式是 Brew Guide 应用中的一个显示选项，旨在通过隐藏非必要信息，为用户提供更加精简、专注的界面体验。该模式可以通过设置页面开启或关闭，当开启时，应用的多个组件将采用更简洁的显示方式。用户可以通过细粒度的设置选项，自定义想要隐藏的具体内容。

## 实现原理

### 1. 设置存储与管理

极简模式的状态存储在应用的全局设置中，使用 `minimalistMode` 属性表示是否启用极简模式，使用 `minimalistOptions` 控制细粒度设置。

```typescript
// 在 src/components/settings/Settings.tsx 中定义
export interface SettingsOptions {
    // ...其他设置项
    minimalistMode: boolean // 极简模式开关
    minimalistOptions: {
        hideFlavors: boolean // 隐藏风味标签
        hidePrice: boolean // 隐藏价格信息
        hideRoastDate: boolean // 隐藏烘焙度信息
        hideTotalWeight: boolean // 隐藏总重量显示
    }
}

// 默认设置
export const defaultSettings: SettingsOptions = {
    // ...其他默认值
    minimalistMode: false, // 默认不启用极简模式
    minimalistOptions: {
        hideFlavors: true, // 默认隐藏风味标签
        hidePrice: true, // 默认隐藏价格信息
        hideRoastDate: false, // 默认不隐藏烘焙度信息
        hideTotalWeight: true // 默认隐藏总重量显示
    }
}
```

### 2. 组件中获取极简模式状态

各个组件通过以下方式获取极简模式状态和细粒度设置：

```typescript
// 添加极简模式状态和细粒度设置状态
const [_isMinimalistMode, setIsMinimalistMode] = useState(false);
const [hideFlavors, setHideFlavors] = useState(false);
const [hidePrice, setHidePrice] = useState(false);
const [hideRoastDate, setHideRoastDate] = useState(false);
const [hideTotalWeight, setHideTotalWeight] = useState(false);

// 获取全局设置
useEffect(() => {
    const loadSettings = async () => {
        try {
            const settingsStr = await Storage.get('brewGuideSettings');
            if (settingsStr) {
                const parsedSettings = JSON.parse(settingsStr) as SettingsOptions;
                setIsMinimalistMode(parsedSettings.minimalistMode || false);
                
                // 根据极简模式和具体设置决定显示选项
                if (parsedSettings.minimalistMode) {
                    setHideFlavors(parsedSettings.minimalistOptions.hideFlavors);
                    setHidePrice(parsedSettings.minimalistOptions.hidePrice);
                    setHideRoastDate(parsedSettings.minimalistOptions.hideRoastDate);
                    setHideTotalWeight(parsedSettings.minimalistOptions.hideTotalWeight);
                } else {
                    // 如果极简模式未启用，则所有内容都显示
                    setHideFlavors(false);
                    setHidePrice(false);
                    setHideRoastDate(false);
                    setHideTotalWeight(false);
                }
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

在组件的 JSX 渲染部分，根据细粒度设置的值决定是否显示某些元素：

```jsx
{/* 只在不隐藏风味标签时显示 */}
{!hideFlavors && bean.flavor && bean.flavor.length > 0 && (
    <div className="...">
        {/* 风味标签 */}
    </div>
)}

{/* 根据细粒度设置控制价格显示 */}
{!hidePrice && bean.price && (
    <span>
        {bean.price}元
        {/* ... */}
    </span>
)}

{/* 使用条件表达式 */}
{`${beansCount} 款咖啡豆${!hideTotalWeight && totalWeight ? `，共 ${totalWeight}` : ''}`}
```

## 设置界面

在设置页面，极简模式的设置分为两部分：

1. 主开关：控制是否启用极简模式
2. 细粒度设置：仅在主开关启用时显示，允许用户选择具体要隐藏的内容
   - 隐藏风味标签
   - 隐藏价格信息
   - 隐藏烘焙日期
   - 隐藏总重量显示

```tsx
{/* 极简模式开关 */}
<div className="flex items-center justify-between">
    <div className="text-sm text-neutral-800 dark:text-neutral-200">
        极简模式
    </div>
    <label className="relative inline-flex cursor-pointer items-center">
        <input
            type="checkbox"
            checked={settings.minimalistMode || false}
            onChange={(e) => handleChange('minimalistMode', e.target.checked)}
            className="peer sr-only"
        />
        <div className="peer h-6 w-11 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-neutral-600 peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
    </label>
</div>

{/* 极简模式详细设置 - 仅在极简模式开启时显示 */}
{settings.minimalistMode && (
    <div className="mt-4 ml-3 space-y-3">
        {/* 各细粒度设置开关 */}
        <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                隐藏风味标签
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
                <input
                    type="checkbox"
                    checked={settings.minimalistOptions?.hideFlavors || false}
                    onChange={(e) => {
                        const currentOptions = settings.minimalistOptions || defaultSettings.minimalistOptions;
                        const newOptions = {
                            hideFlavors: e.target.checked,
                            hidePrice: currentOptions.hidePrice,
                            hideRoastDate: currentOptions.hideRoastDate,
                            hideTotalWeight: currentOptions.hideTotalWeight
                        };
                        handleChange('minimalistOptions', newOptions);
                    }}
                    className="peer sr-only"
                />
                <div className="peer h-5 w-9 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-neutral-600 peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
            </label>
        </div>
        {/* ... 其他细粒度设置 ... */}
    </div>
)}
```

## 当前应用位置

极简模式目前已应用在以下组件中：

### 1. BeanListItem 组件 (`src/components/coffee-bean/List/components/BeanListItem.tsx`)

该组件根据细粒度设置控制以下内容的显示：
- 风味标签 (hideFlavors)
- 价格信息 (hidePrice)
- 烘焙日期 (hideRoastDate)

### 2. ViewSwitcher 组件 (`src/components/coffee-bean/List/components/ViewSwitcher.tsx`)

该组件根据细粒度设置控制以下内容的显示：
- 咖啡豆总重量显示 (hideTotalWeight)

## 如何为新组件添加极简模式支持

如需为新组件添加极简模式支持，请按照以下步骤操作：

### 1. 导入必要的依赖

```typescript
import { Storage } from '@/lib/core/storage'
import { SettingsOptions, defaultSettings } from '@/components/settings/Settings'
```

### 2. 添加极简模式状态和加载逻辑

```typescript
// 添加极简模式相关状态
const [_isMinimalistMode, setIsMinimalistMode] = useState(false);
// 根据组件需要，添加具体的显示控制状态
const [hideFlavors, setHideFlavors] = useState(false);
const [hidePrice, setHidePrice] = useState(false);
// ... 其他需要的状态 ...

// 获取全局设置
useEffect(() => {
    const loadSettings = async () => {
        try {
            const settingsStr = await Storage.get('brewGuideSettings');
            if (settingsStr) {
                const parsedSettings = JSON.parse(settingsStr) as SettingsOptions;
                setIsMinimalistMode(parsedSettings.minimalistMode || false);
                
                // 根据极简模式和具体设置决定显示选项
                if (parsedSettings.minimalistMode) {
                    setHideFlavors(parsedSettings.minimalistOptions.hideFlavors);
                    setHidePrice(parsedSettings.minimalistOptions.hidePrice);
                    // ... 设置其他状态 ...
                } else {
                    // 如果极简模式未启用，则显示所有内容
                    setHideFlavors(false);
                    setHidePrice(false);
                    // ... 重置其他状态 ...
                }
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

根据组件的具体需求，使用条件渲染来决定哪些内容应该根据细粒度设置隐藏：

```jsx
{/* 在不隐藏风味标签时显示 */}
{!hideFlavors && (
    <div className="...">
        {/* 需要在隐藏风味标签时隐藏的内容 */}
    </div>
)}

{/* 在不隐藏价格信息时显示 */}
{!hidePrice && (
    <div className="...">
        {/* 需要在隐藏价格信息时隐藏的内容 */}
    </div>
)}

{/* 或者使用条件表达式动态构建字符串 */}
{`${mainInfo}${!hideAdditionalInfo ? ` (${additionalInfo})` : ''}`}
```

### 4. 遵循设计原则

在决定哪些内容应该在极简模式下隐藏时，请遵循以下原则：

- 保留必要的核心信息（如咖啡豆名称、基本参数）
- 使用设置中的细粒度选项来控制不同类型的详细信息的显示
- 确保界面在极简模式下仍然功能完整，只是信息量减少
- 保持一致性，类似的信息在不同组件中应采用相同的隐藏策略

## 测试指南

在为组件添加极简模式支持后，请确保进行以下测试：

1. 进入设置页面，切换极简模式主开关和各个细粒度设置，确认组件正确响应设置变化
2. 检查组件在不同细粒度设置组合下的显示是否符合预期
3. 确保组件在设置切换时不会出现布局混乱或渲染错误
4. 验证在不同设备和屏幕尺寸下极简模式的显示效果

## 更新设置界面

如果需要添加新的细粒度设置选项，需要进行以下修改：

1. 更新 `SettingsOptions` 接口中的 `minimalistOptions` 类型定义
2. 更新 `defaultSettings` 中的 `minimalistOptions` 默认值
3. 在设置界面中添加新的开关选项
4. 更新设置说明文本

```typescript
// 在 src/components/settings/Settings.tsx 中
// 1. 更新类型定义
minimalistOptions: {
    hideFlavors: boolean
    hidePrice: boolean
    hideRoastDate: boolean
    hideTotalWeight: boolean
    // 添加新的选项
    hideNewOption: boolean
}

// 2. 更新默认值
minimalistOptions: {
    hideFlavors: true,
    hidePrice: true,
    hideRoastDate: false,
    hideTotalWeight: true,
    // 设置新选项的默认值
    hideNewOption: false
}

// 3. 添加新的开关选项
<div className="flex items-center justify-between">
    <div className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
        隐藏新选项
    </div>
    <label className="relative inline-flex cursor-pointer items-center">
        <input
            type="checkbox"
            checked={settings.minimalistOptions?.hideNewOption || false}
            onChange={(e) => {
                const currentOptions = settings.minimalistOptions || defaultSettings.minimalistOptions;
                const newOptions = {
                    ...currentOptions,
                    hideNewOption: e.target.checked
                };
                handleChange('minimalistOptions', newOptions);
            }}
            className="peer sr-only"
        />
        <div className="peer h-5 w-9 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-neutral-600 peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
    </label>
</div>

// 4. 更新说明文本
<p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
    开启后可选择隐藏：风味标签、价格信息、烘焙日期、总重量等
</p>
``` 