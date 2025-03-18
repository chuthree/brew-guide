# 触感反馈功能使用指南

## 概述

本应用使用 Capacitor Haptics API 实现了触感反馈功能，为用户提供更加沉浸式的交互体验。触感反馈能够在用户进行操作时提供适当的物理反馈，使应用交互更加自然、直观。

## 安装与配置

1. **安装依赖**

    ```bash
    npm install @capacitor/haptics
    ```

2. **导入与使用**

    我们已在 `lib/haptics.ts` 中封装了触感反馈功能，你可以在任何组件中导入并使用：

    ```typescript
    import hapticFeedback from "@/lib/haptics";

    // 使用不同类型的触感反馈
    hapticFeedback.light(); // 轻触反馈
    hapticFeedback.medium(); // 中等反馈
    hapticFeedback.heavy(); // 重触反馈
    hapticFeedback.success(); // 成功反馈
    hapticFeedback.warning(); // 警告反馈
    hapticFeedback.error(); // 错误反馈
    ```

## 触感类型及应用场景

我们定义了不同类型的触感反馈，适用于不同的交互场景：

### 基本触感类型

1. **轻触反馈** (`light`)

    - 用于普通按钮点击
    - 轻微的界面交互
    - 导航标签切换

2. **中等触感** (`medium`)

    - 表单提交
    - 重要项目选择
    - 菜单项激活

3. **重触感** (`heavy`)
    - 完成重要操作
    - 确认关键决策
    - 双击激活特殊功能

### 通知类触感

1. **成功触感** (`success`)

    - 操作成功完成
    - 数据保存成功
    - 参数设置确认

2. **警告触感** (`warning`)

    - 操作被取消
    - 需要确认的操作
    - 修改未保存提醒

3. **错误触感** (`error`)
    - 操作被拒绝
    - 表单验证错误
    - 访问受限功能

### 自定义振动

1. **单次振动** (`vibrate`)

    ```typescript
    // 自定义振动持续时间（毫秒）
    hapticFeedback.vibrate(200);
    ```

2. **多次振动** (`vibrateMultiple`)
    ```typescript
    // 参数：次数、间隔(ms)、每次持续时间(ms)
    hapticFeedback.vibrateMultiple(3, 150, 100);
    ```

## 在组件中使用

为确保在不支持触感反馈的设备上优雅降级，我们提供了检测机制和统一调用方式：

```typescript
// 检测设备是否支持触感反馈
const [isHapticsSupported, setIsHapticsSupported] = useState(false);

useEffect(() => {
	const checkHapticsSupport = async () => {
		const supported = await hapticFeedback.isSupported();
		setIsHapticsSupported(supported);
	};

	checkHapticsSupport();
}, []);

// 封装触感调用函数
const triggerHaptic = async (type: keyof typeof hapticFeedback) => {
	if (isHapticsSupported && typeof hapticFeedback[type] === "function") {
		await hapticFeedback[type]();
	}
};

// 在UI事件中使用
const handleButtonClick = () => {
	triggerHaptic("light");
	// 执行其他操作...
};
```

## 触感反馈最佳实践

1. **保持一致性**：为相似的交互提供相同类型的触感反馈
2. **适当使用**：避免过度使用触感反馈，以免让用户感到疲劳
3. **考虑上下文**：在用户操作被拒绝时提供错误触感，成功时提供成功触感
4. **优雅降级**：始终检查设备是否支持触感反馈，并提供备选的视觉反馈
5. **性能考虑**：触感反馈是异步操作，不要在性能关键路径上阻塞

## 应用场景示例

在我们的咖啡应用中，我们在以下场景使用了触感反馈：

1. **导航栏**：切换主标签时提供轻触反馈
2. **冲煮步骤**：选择步骤时提供中等触感
3. **参数编辑**：
    - 开始编辑：中等触感
    - 编辑确认：成功触感
    - 取消编辑：警告触感
4. **错误操作**：
    - 尝试访问禁用步骤：错误触感
    - 计时器运行中尝试编辑：错误触感

## 调试与测试

要测试触感反馈，你需要在真实的移动设备上运行应用，因为模拟器和浏览器不支持触感反馈。

要检查触感反馈是否正常工作，可以在开发者模式下监控控制台日志：

-   "设备支持触感反馈" - 表示设备支持触感
-   "设备不支持触感反馈" - 表示设备不支持触感
-   "Haptics not available" - 表示触发触感时出现错误

## 扩展与自定义

如需添加新的触感模式或修改现有模式，请在 `lib/haptics.ts` 文件中进行更改。
