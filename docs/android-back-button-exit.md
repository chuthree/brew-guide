# Android 双击返回键退出应用功能说明

## 概述

本项目已成功实现 Android 设备的双击返回键退出应用功能，使用 Capacitor 的 `@capacitor/app` 插件，这是业界成熟的解决方案。

## 实现内容

### 1. 安装的依赖
- `@capacitor/app@^7.1.0` - Capacitor 官方的 App API 插件，用于处理应用生命周期和硬件返回键事件

### 2. 新增文件

#### `/src/lib/hooks/useBackButtonExit.ts`
自定义 React Hook，封装双击返回键退出逻辑：

**功能特性：**
- ✅ 仅在 Android 原生平台生效
- ✅ 智能判断应用导航状态：
  - 有历史记录时：正常返回上一页
  - 在根页面时：需要双击退出
- ✅ 双击时间间隔：2秒
- ✅ 用户体验友好：首次按返回键显示 Toast 提示"再按一次退出应用"
- ✅ 自动清理：组件卸载时移除监听器

**核心代码逻辑：**
```typescript
// 监听返回键事件
CapacitorApp.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) {
        // 有历史记录，正常返回
        window.history.back();
    } else {
        // 根页面，判断是否双击
        if (timeSinceLastPress < 2000) {
            CapacitorApp.exitApp(); // 退出应用
        } else {
            showToast({ /* 显示提示 */ });
        }
    }
});
```

### 3. 修改的文件

#### `/src/providers/CapacitorProvider.tsx`
在 Capacitor 初始化提供者中集成 `useBackButtonExit` Hook：

```typescript
import { useBackButtonExit } from '@/lib/hooks/useBackButtonExit';

export default function CapacitorInit() {
    // 使用双击返回键退出应用的功能
    useBackButtonExit();
    
    // ... 其他初始化代码
}
```

## 技术方案优势

### 1. 成熟稳定
- 使用 Capacitor 官方插件，经过大量应用验证
- API 设计合理，类型安全

### 2. 用户体验优秀
- 智能判断是否可返回，不影响正常导航
- 提供视觉反馈（Toast 提示），避免误操作
- 2秒间隔设计符合用户习惯

### 3. 代码质量高
- TypeScript 类型完整，无类型错误
- 使用 React Hooks 模式，代码简洁
- 自动管理监听器生命周期，无内存泄漏

### 4. 跨平台考虑
- 只在 Android 平台启用，不影响其他平台
- 代码具有良好的平台兼容性检查

## 使用说明

### 开发环境测试
该功能仅在 Android 原生环境下生效，浏览器预览时不会触发。

### 构建和部署
1. 构建应用：
   ```bash
   pnpm run cap:build
   ```

2. 打开 Android Studio：
   ```bash
   pnpm run cap:android
   ```

3. 在真机或模拟器上运行测试

### 测试场景
1. **场景一：在应用根页面**
   - 按一次返回键 → 显示提示"再按一次退出应用"
   - 2秒内再按返回键 → 应用退出
   - 超过2秒后按返回键 → 重新显示提示

2. **场景二：在子页面**
   - 按返回键 → 返回上一页（正常导航行为）
   - 返回到根页面后 → 切换到场景一的行为

## 相关文档

- [Capacitor App API 文档](https://capacitorjs.com/docs/apis/app)
- [Android 返回键最佳实践](https://developer.android.com/guide/navigation/custom-back)

## 注意事项

1. **插件依赖**：确保 `@capacitor/app` 已正确安装
2. **平台限制**：此功能仅在 Android 原生平台工作
3. **Toast 依赖**：需要项目的 GlobalToast 组件正常工作
4. **同步更新**：修改代码后记得运行 `npx cap sync android` 同步到原生项目

## 版本信息

- Capacitor: ^7.4.2
- @capacitor/app: ^7.1.0
- 实现日期: 2024
