# 需求文档：自动注水检测计时器

## 简介

本功能通过视觉识别技术自动检测"开始注水"动作，并立即触发冲煮计时器，消除手动按下播放按钮的需求。该功能将集成到现有的 BrewingTimer 组件中，利用设备摄像头实时分析视频流，识别注水动作。

## 术语表

- **System**: 自动注水检测计时器系统
- **Camera_Manager**: 摄像头管理器，负责摄像头访问和视频流管理
- **Pour_Detector**: 注水检测器，负责分析视频帧并检测注水动作
- **Frame_Diff_Detector**: 帧差检测器，检测连续帧之间的运动
- **State_Machine**: 状态机，管理检测状态转换和防抖逻辑
- **Timer_Controller**: 计时器控制器，管理冲煮计时器的启动和停止
- **Undo_Controller**: 撤销控制器，管理自动触发后的撤销功能
- **Toast**: 提示通知组件，显示系统消息
- **User**: 使用冲煮计时器的用户
- **Pour_Action**: 注水动作，指用户开始向咖啡粉注水
- **Auto_Start_Mode**: 自动开始模式，检测到注水立即启动计时器
- **Remind_Only_Mode**: 仅提醒模式，检测到注水显示提示但不自动启动
- **Off_Mode**: 关闭模式，完全禁用自动检测
- **Undo_Window**: 撤销窗口，自动触发后允许撤销的时间窗口（2 秒）
- **Detection_State**: 检测状态，包括 idle、monitoring、preparing、triggered
- **Frame**: 视频帧，从视频流中捕获的单帧图像
- **Motion_Score**: 运动分数，表示帧间运动的强度（0-1）
- **Downward_Motion**: 向下运动，注水动作的关键特征
- **Consecutive_Detection**: 连续检测，连续多帧检测到运动
- **Camera_Permission**: 摄像头权限，用户授予应用访问摄像头的权限
- **Video_Stream**: 视频流，从摄像头获取的实时视频数据
- **ROI**: 感兴趣区域（Region of Interest），视频帧中需要检测的特定区域
- **FPS**: 每秒帧数（Frames Per Second），视频流的帧率
- **Experimental_Feature**: 实验性功能，正在测试中的功能

## 需求

### 需求 1：摄像头访问和管理

**用户故事**：作为用户，我希望系统能够访问设备前置摄像头，以便在注水时既能看到屏幕又能被检测到注水动作。

#### 验收标准

1. WHEN THE User 启用自动检测功能 THEN THE Camera_Manager SHALL 请求前置摄像头权限
2. IF THE User 拒绝摄像头权限 THEN THE System SHALL 显示权限请求对话框并提供"去设置"选项
3. WHEN THE Camera_Manager 启动视频流 THEN THE System SHALL 默认使用前置摄像头（facingMode: 'user'）
4. WHEN THE Camera_Manager 启动视频流 THEN THE System SHALL 在 UI 中显示摄像头活跃指示器
5. WHEN THE User 点击停止按钮 THEN THE Camera_Manager SHALL 立即停止视频流并释放摄像头资源
6. WHEN THE User 离开冲煮页面或应用进入后台 THEN THE Camera_Manager SHALL 自动停止视频流
7. THE Camera_Manager SHALL 支持前置和后置摄像头切换，但默认推荐前置摄像头
8. THE Camera_Manager SHALL 支持多种视频分辨率（320x240、640x480）
9. THE Camera_Manager SHALL 支持多种帧率（15、30、60 FPS）
10. THE System SHALL 在首次使用时提示用户："将手机平放在桌面，屏幕朝上，前置摄像头会检测您的注水动作"

### 需求 2：注水动作检测

**用户故事**：作为用户，我希望系统能够准确检测我开始注水的动作，以便自动启动计时器。

#### 验收标准

1. WHEN THE Pour_Detector 接收到视频帧 THEN THE Frame_Diff_Detector SHALL 计算当前帧与前一帧的差异
2. WHEN THE Frame_Diff_Detector 检测到显著运动 THEN THE System SHALL 分析运动区域位置（top/middle/bottom）
3. WHEN THE Frame_Diff_Detector 检测到运动比例超过 80% THEN THE System SHALL 判定为全屏剧变（光线突变或手机移动）并忽略该帧
4. WHEN THE System 检测到画面上部的显著运动 THEN THE State_Machine SHALL 更新检测状态
5. WHEN THE State_Machine 连续检测到 5-8 次画面上部运动 THEN THE System SHALL 触发注水检测事件
6. WHEN THE System 检测到全屏剧变或无运动 THEN THE State_Machine SHALL 重置连续检测计数
7. THE Frame_Diff_Detector SHALL 在 5ms 内完成单帧处理（320x240 分辨率）
8. THE State_Machine SHALL 在 1ms 内完成状态转换
9. THE Pour_Detector SHALL 维护检测状态历史用于调试

### 需求 3：三种检测模式

**用户故事**：作为用户，我希望能够选择不同的检测模式，以适应不同的使用场景。

#### 验收标准

1. WHERE THE User 选择自动开始模式 WHEN THE System 检测到注水 THEN THE Timer_Controller SHALL 立即启动主计时器（跳过 3 秒倒计时）
2. WHERE THE User 选择自动开始模式 WHEN THE System 启动计时器 THEN THE Toast SHALL 显示"检测到注水，已开始计时"消息（持续 2 秒）
3. WHERE THE User 选择仅提醒模式 WHEN THE System 检测到注水 THEN THE Toast SHALL 显示"检测到注水，点击开始"消息（持续 3 秒，带"开始"按钮）
4. WHERE THE User 选择仅提醒模式 WHEN THE System 检测到注水 THEN THE System SHALL 高亮播放按钮（闪烁动画，持续 3 秒）
5. WHERE THE User 选择关闭模式 THEN THE System SHALL 不启动摄像头和检测功能
6. WHERE THE User 选择关闭模式 THEN THE User SHALL 仅能通过手动点击播放按钮启动计时器
7. THE System SHALL 在设置中提供三种模式的选择界面
8. THE System SHALL 将用户选择的模式持久化到本地存储

### 需求 4：撤销功能

**用户故事**：作为用户，我希望在系统误触发时能够撤销自动启动的计时器，以避免影响冲煮过程。

#### 验收标准

1. WHERE THE User 选择自动开始模式 WHEN THE System 启动计时器 THEN THE Undo_Controller SHALL 显示撤销按钮（持续 2 秒）
2. WHEN THE Undo_Controller 显示撤销按钮 THEN THE System SHALL 显示剩余撤销时间倒计时
3. WHEN THE User 在撤销窗口内点击撤销按钮 THEN THE Timer_Controller SHALL 重置计时器到检测前状态
4. WHEN THE User 点击撤销按钮 THEN THE Toast SHALL 显示"已撤销"消息（持续 1 秒）
5. WHEN THE User 点击撤销按钮 THEN THE Camera_Manager SHALL 重新启动视频流和检测
6. WHEN THE 撤销窗口超时（2 秒后）THEN THE Undo_Controller SHALL 自动隐藏撤销按钮
7. WHERE THE User 选择仅提醒模式 THEN THE System SHALL 不显示撤销按钮

### 需求 5：双重启动方式

**用户故事**：作为用户，我希望无论自动检测是否启用，都能手动启动计时器，以保持传统使用方式。

#### 验收标准

1. WHEN THE User 点击播放按钮 THEN THE Timer_Controller SHALL 启动 3 秒倒计时
2. WHEN THE 3 秒倒计时结束 THEN THE Timer_Controller SHALL 启动主计时器
3. THE System SHALL 同时支持手动点击和自动检测两种启动方式
4. WHEN THE System 已通过自动检测启动计时器 THEN THE System SHALL 禁用手动启动按钮
5. WHEN THE System 已通过手动点击启动计时器 THEN THE System SHALL 停止自动检测

### 需求 6：用户界面和反馈

**用户故事**：作为用户，我希望系统提供清晰的视觉反馈，让我了解检测状态和系统行为。

#### 验收标准

1. WHEN THE Camera_Manager 启动视频流 THEN THE System SHALL 在屏幕顶部显示摄像头活跃指示器（红色圆点 + "摄像头已启用"文字）
2. WHEN THE System 显示摄像头活跃指示器 THEN THE System SHALL 提供"停止"按钮
3. WHERE THE User 启用调试模式 THEN THE System SHALL 显示检测状态指示器（当前状态、连续检测次数、运动分数、处理时间）
4. WHEN THE System 触发注水检测 THEN THE Toast SHALL 根据检测模式显示相应的提示消息
5. WHEN THE Toast 显示消息 THEN THE System SHALL 使用适当的图标（✓ 成功、ℹ 信息、✕ 错误、↶ 撤销）
6. WHERE THE User 选择仅提醒模式 WHEN THE System 检测到注水 THEN THE System SHALL 使用脉冲动画高亮播放按钮
7. THE System SHALL 在设置中标记自动检测为"实验性功能"
8. THE System SHALL 在设置中显示警告："此功能正在测试中，可能不稳定"

### 需求 7：性能要求

**用户故事**：作为用户，我希望自动检测功能不会影响设备性能和电池续航。

#### 验收标准

1. THE Frame_Diff_Detector SHALL 在 5ms 内完成单帧处理（320x240 分辨率）
2. THE State_Machine SHALL 在 1ms 内完成状态转换
3. THE System SHALL 在 30 FPS 下不丢帧
4. THE System SHALL 使用少于 30% 的 CPU 资源
5. THE System SHALL 使用少于 100MB 的内存
6. WHEN THE System 检测到处理延迟过高 THEN THE System SHALL 自动降低帧率
7. WHEN THE System 检测到设备性能不足 THEN THE System SHALL 显示警告并建议降低检测质量或使用手动启动
8. THE System SHALL 在检测成功后自动停止摄像头（可配置）

### 需求 8：隐私和安全

**用户故事**：作为用户，我希望系统保护我的隐私，不会滥用摄像头权限或泄露视频数据。

#### 验收标准

1. THE System SHALL 仅在用户启用自动检测时请求摄像头权限
2. THE System SHALL 在本地处理所有视频数据，不上传到服务器
3. THE System SHALL 不存储任何视频帧或录像
4. WHEN THE Camera_Manager 启动视频流 THEN THE System SHALL 在 UI 中显示明显的摄像头活跃指示器
5. THE System SHALL 提供一键停止摄像头的按钮
6. WHEN THE User 离开冲煮页面 THEN THE System SHALL 立即停止摄像头
7. WHEN THE 应用进入后台 THEN THE System SHALL 立即停止摄像头
8. THE System SHALL 设置最大检测时间为 5 分钟，超时后自动停止

### 需求 9：错误处理

**用户故事**：作为用户，我希望系统能够优雅地处理错误情况，并提供清晰的错误提示和恢复选项。

#### 验收标准

1. IF THE User 拒绝摄像头权限 THEN THE System SHALL 显示友好的权限请求对话框，引导用户在系统设置中授予权限
2. IF THE 设备没有摄像头或摄像头被占用 THEN THE System SHALL 显示"未检测到可用摄像头"错误提示
3. IF THE 视频流初始化失败 THEN THE System SHALL 显示"摄像头启动失败，请重试"错误提示并提供"重试"按钮
4. IF THE 设备性能不足导致丢帧 THEN THE System SHALL 自动降低帧率或显示警告
5. WHEN THE System 发生错误 THEN THE System SHALL 自动回退到手动启动模式
6. WHEN THE System 发生错误 THEN THE System SHALL 记录错误日志用于调试
7. THE System SHALL 为所有错误提供"手动启动"选项作为备选方案

### 需求 10：配置和设置

**用户故事**：作为用户，我希望能够自定义检测参数，以适应不同的环境和个人偏好。

#### 验收标准

1. THE System SHALL 在设置中提供检测模式选择（自动开始 / 仅提醒 / 关闭）
2. THE System SHALL 在设置中提供摄像头朝向选择（前置（推荐）/ 后置）
3. THE System SHALL 默认使用前置摄像头（facingMode: 'user'）
4. THE System SHALL 在设置中提供视频分辨率选择（320x240 / 640x480）
5. THE System SHALL 在设置中提供帧率选择（15 / 30 / 60 FPS）
6. THE System SHALL 在设置中提供灵敏度调节（0-100）
7. THE System SHALL 在设置中提供连续检测次数调节（5-8）
8. THE System SHALL 在设置中提供"显示摄像头预览"开关
9. THE System SHALL 在设置中提供"显示调试信息"开关
10. THE System SHALL 在设置中提供"检测成功后自动停止摄像头"开关
11. THE System SHALL 将所有设置持久化到本地存储（IndexedDB）

### 需求 11：首次使用引导

**用户故事**：作为新用户，我希望系统能够引导我了解和设置自动检测功能。

#### 验收标准

1. WHEN THE User 首次启用自动检测 THEN THE System SHALL 显示功能介绍
2. WHEN THE System 显示功能介绍 THEN THE System SHALL 展示动画演示
3. WHEN THE User 完成功能介绍 THEN THE System SHALL 请求前置摄像头权限
4. WHEN THE System 请求摄像头权限 THEN THE System SHALL 说明"将手机平放在桌面，屏幕朝上，前置摄像头会检测您的注水动作"
5. WHEN THE System 请求摄像头权限 THEN THE System SHALL 说明"您的视频不会被存储或上传"
6. WHEN THE User 授予摄像头权限 THEN THE System SHALL 引导用户选择检测模式
7. WHEN THE System 引导用户选择检测模式 THEN THE System SHALL 提供三种模式的说明和推荐
8. WHEN THE User 选择检测模式 THEN THE System SHALL 提供测试检测功能
9. WHEN THE System 提供测试检测功能 THEN THE System SHALL 提示"请将手机平放在桌面，屏幕朝上，尝试在手机上方做注水动作"
10. THE System SHALL 默认推荐"仅提醒"模式

### 需求 12：跨平台兼容性

**用户故事**：作为用户，我希望自动检测功能在不同平台和设备上都能正常工作。

#### 验收标准

1. THE Camera_Manager SHALL 在 Web 浏览器环境中使用 MediaDevices API 访问摄像头
2. THE Camera_Manager SHALL 在 iOS 环境中使用 Capacitor Camera Plugin 访问摄像头
3. THE Camera_Manager SHALL 在 Android 环境中使用 Capacitor Camera Plugin 访问摄像头
4. THE Camera_Manager SHALL 在桌面环境中使用 MediaDevices API 访问摄像头
5. THE Pour_Detector SHALL 在所有平台上产生一致的检测结果
6. THE System SHALL 在所有平台上提供一致的用户界面
7. THE System SHALL 在低端设备上自动降低检测质量以保证性能

### 需求 13：状态机行为

**用户故事**：作为开发者，我需要状态机正确管理检测状态转换，防止误触发和重复触发。

#### 验收标准

1. THE State_Machine SHALL 支持五种状态：idle、monitoring、preparing、triggered、cooldown
2. WHEN THE State_Machine 处于 idle 状态且检测到画面上部运动 THEN THE State_Machine SHALL 转换到 monitoring 状态
3. WHEN THE State_Machine 处于 monitoring 状态且检测到显著运动 THEN THE State_Machine SHALL 转换到 preparing 状态
4. WHEN THE State_Machine 处于 preparing 状态且连续检测次数达到阈值 THEN THE State_Machine SHALL 转换到 triggered 状态
5. WHEN THE State_Machine 处于 preparing 状态且检测到无运动或全屏剧变 THEN THE State_Machine SHALL 重置连续检测计数并转换到 monitoring 状态
6. WHEN THE State_Machine 转换到 triggered 状态 THEN THE State_Machine SHALL 触发计时器启动事件
7. WHEN THE User 点击撤销按钮 THEN THE State_Machine SHALL 从 triggered 转换到 cooldown 状态
8. WHEN THE State_Machine 处于 cooldown 状态 THEN THE State_Machine SHALL 等待冷却时间（2 秒）或连续 10 帧静止后才能转换到 idle 状态
9. WHEN THE State_Machine 超时（5 秒无事件）THEN THE State_Machine SHALL 转换到 idle 状态

### 需求 14：资源管理

**用户故事**：作为开发者，我需要系统正确管理资源，防止内存泄漏和资源耗尽。

#### 验收标准

1. WHEN THE Camera_Manager 启动视频流 THEN THE System SHALL 分配必要的视频缓冲区
2. WHEN THE Camera_Manager 停止视频流 THEN THE System SHALL 释放所有视频缓冲区和摄像头资源
3. WHEN THE Pour_Detector 启动检测 THEN THE System SHALL 分配必要的帧处理缓冲区
4. WHEN THE Pour_Detector 停止检测 THEN THE System SHALL 释放所有帧处理缓冲区
5. THE System SHALL 复用 ImageData 对象以减少 GC 压力
6. THE System SHALL 使用对象池管理帧缓冲区
7. THE System SHALL 在组件卸载时清理所有资源
8. THE System SHALL 不存在内存泄漏

### 需求 15：调试和监控

**用户故事**：作为开发者，我需要调试工具来监控检测过程和性能指标。

#### 验收标准

1. WHERE THE User 启用调试模式 THEN THE System SHALL 显示当前检测状态
2. WHERE THE User 启用调试模式 THEN THE System SHALL 显示连续检测次数
3. WHERE THE User 启用调试模式 THEN THE System SHALL 显示运动分数
4. WHERE THE User 启用调试模式 THEN THE System SHALL 显示帧处理时间
5. WHERE THE User 启用调试模式 THEN THE System SHALL 显示当前帧率和丢帧数
6. WHERE THE User 启用调试模式 THEN THE System SHALL 在视频预览上叠加运动区域可视化
7. THE System SHALL 记录检测事件历史用于调试
8. THE System SHALL 提供性能指标（平均处理时间、FPS、CPU 使用率）
