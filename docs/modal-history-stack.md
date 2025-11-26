# 统一历史栈管理系统

## 概述

基于 History API 的统一模态框/导航历史栈管理系统，解决 SPA 中浏览器返回键、硬件返回键、iOS 侧滑返回的交互问题。

## 核心文件

```
src/lib/navigation/modalHistory.ts    # 核心管理器（单例）
src/lib/hooks/useModalHistory.ts      # React Hooks
src/providers/ModalHistoryProvider.tsx # 初始化 Provider
```

## 设计理念

1. **单一 popstate 监听器**：由 `ModalHistoryManager` 统一处理所有 popstate 事件
2. **内部栈与浏览器历史同步**：每个模态框/步骤对应一条 `pushState` 记录
3. **主动关闭检测**：区分「popstate 触发的关闭」vs「代码主动关闭」，避免双重处理
4. **动画由组件控制**：历史栈管理器只负责调用 `onClose`，动画由组件自行管理

## API 概览

### modalHistory 单例方法

| 方法                                            | 用途                                             |
| ----------------------------------------------- | ------------------------------------------------ |
| `register(entry)`                               | 注册单个模态框                                   |
| `pushStep(baseId, step, onStepChange, onClose)` | 推入多步骤表单的一个步骤                         |
| `back()`                                        | 返回上一层（触发 history.back）                  |
| `close(id)`                                     | 主动关闭指定模态框并清理历史                     |
| `closeAllByPrefix(prefix)`                      | 关闭所有以前缀开头的模态框（多步骤表单完成时用） |
| `clearAndNavigate()`                            | 清空所有历史并返回根页面（页面跳转时用）         |
| `isOpen(id)`                                    | 检查模态框是否打开                               |

### React Hooks

```typescript
// 单个模态框
useModalHistory({
  id: 'bean-detail',
  isOpen,
  onClose,
  replace?: boolean  // 替换栈顶而非入栈
});

// 多步骤表单/流程
useMultiStepModalHistory({
  id: 'bean-form',
  isOpen,
  step,           // 当前步骤号，从 1 开始
  onStepChange,   // 浏览器返回时的步骤变化回调
  onClose,        // 第一步返回时的关闭回调
});
```

## 已迁移组件

### 咖啡豆相关

- `BeanDetailModal` - 使用 `useModalHistory`
- `BeanRatingModal` - 使用 `useModalHistory`
- `BeanShareModal` - 使用 `useModalHistory`
- `CoffeeBeanFormModal` - 使用 `useMultiStepModalHistory`（4 步表单）
- `BeanImportModal` - 使用 `useModalHistory`
  - 咖啡豆导入页面，支持剪贴板识别、JSON输入、二维码扫描、图片识别
- `BeanSearchModal` - 使用 `useModalHistory`
  - 咖啡豆搜索页面，从远程数据库搜索咖啡豆信息
- `BeanPrintModal` - 使用 `useModalHistory`
  - 咖啡豆打印标签页面，支持多种模板和尺寸设置
- `QRScannerModal` - 使用 `useModalHistory`
  - 二维码扫描模态框，用于扫描咖啡豆分享二维码

### 冲煮流程

- `page.tsx` 冲煮步骤 - 使用 `useMultiStepModalHistory`
  - 有豆：coffeeBean(0) → method(1) → brewing(2) → notes(3)
  - 无豆：method(0) → brewing(1) → notes(2)
- `useBrewingState.ts` - 保存笔记后调用 `clearAndNavigate()`

### 器具管理（嵌套层级 + 子页面独立注册）

支持多层嵌套且不关闭上层的历史栈管理：

```
器具管理抽屉 (equipment-management)
    ↓ 点击"添加器具"（不关闭抽屉）
添加器具表单 (equipment-form)
    ↓ 进入子页面
绘制杯型 (equipment-form-drawing) / 绘制阀门 (equipment-form-valve) / 编辑动画 (equipment-form-animation)
    ↓ 保存或返回
返回到器具表单
```

- `EquipmentManagementDrawer` - 使用 `useModalHistory`
- `CustomEquipmentFormModal` - 使用 `useModalHistory`（单层）
- `CustomEquipmentForm` - 子页面使用 `modalHistory.register()` 独立注册
  - 子页面在 `useEffect` 中动态注册历史条目
  - 保存和返回都使用 `modalHistory.back()` 清理历史栈
- `EquipmentImportModal` - 使用 `useModalHistory`
  - 导入成功后数据回填到表单，而非直接保存

### 冲煮方案编辑

- `CustomMethodFormModal` - 使用 `useMultiStepModalHistory`（4 步表单）
  - 由父组件控制步骤状态，通过 `currentStep` 和 `onStepChange` 传递给子组件
  - 保存成功后调用 `modalHistory.closeAllByPrefix()` 清理所有步骤历史
- `CustomMethodForm` - 接受父组件传入的步骤控制
  - 内部维护步骤映射：`['name', 'params', 'stages', 'complete']`
  - 支持外部控制模式和内部控制模式
- `MethodImportModal` - 使用 `useModalHistory`
  - 导入成功后关闭模态框

### 笔记相关

- `NoteDetailModal` - 使用 `useModalHistory`
  - 笔记详情页，支持查看、编辑、删除等操作
  - 关闭时先触发退出动画，延迟后调用 `modalHistory.back()`
  - 编辑笔记时不关闭详情页（叠加式打开编辑模态框）
- `BrewingNoteEditModal` - 使用 `useModalHistory`
  - 笔记编辑页，支持编辑笔记内容和时间戳
  - 关闭时先触发退出动画，延迟后调用 `modalHistory.back()`
- `BrewingNoteFormModal` - 使用 `useMultiStepModalHistory`（4 步表单）
  - 新建笔记的多步骤表单：器具选择 → 方案选择 → 咖啡豆选择 → 笔记详情
  - 由父组件 `BrewingNoteFormModal` 控制步骤状态，通过 `currentStep` 和 `setCurrentStep` 传递给 `NoteSteppedFormModal`
  - `NoteSteppedFormModal` 的返回按钮始终调用 `onClose()`，由历史栈系统统一处理返回逻辑
- `ChangeRecordEditModal` - 使用 `useModalHistory`
  - 变动记录编辑模态框（快捷扣除、容量调整等）
  - 动画由 `shouldRender` 和 `isVisible` 状态控制
  - 关闭时调用 `modalHistory.back()`

### 咖啡豆随机选择

- `CoffeeBeanRandomPicker` - 使用 `useModalHistory`
  - 随机咖啡豆选择器，支持滚轮式动画选择
  - 在两处使用：冲煮界面（TabContent）和手动添加笔记模态框（BrewingNoteFormModal）的咖啡豆选择步骤
  - 使用 `AnimatePresence` 控制进出动画

### 设置相关

- `Settings` - 使用 `useModalHistory`
  - 主设置页面，子设置页面状态由父组件管理
  - 关闭时先触发退出动画，延迟后调用 `modalHistory.back()`
- `DisplaySettings` - 使用 `useModalHistory`
  - 显示设置页面，作为子页面挂载即为打开状态
  - 关闭时派发 `subSettingsClosing` 事件通知父组件
- `BeanSettings` - 使用 `useModalHistory`
  - 豆仓列表显示设置页面
- `DataSettings` - 使用 `useModalHistory`
  - 数据管理设置页面，包含云同步、备份提醒等功能
- `TimerSettings` - 使用 `useModalHistory`
  - 计时器设置页面
- `NotificationSettings` - 使用 `useModalHistory`
  - 通知设置页面，包含触觉反馈、通知时机等设置
- `NavigationSettings` - 使用 `useModalHistory`
  - 导航设置页面，包含首页Tab配置等
- `StockSettings` - 使用 `useModalHistory`
  - 库存设置页面，包含库存预警等功能
- `FlavorPeriodSettings` - 使用 `useModalHistory`
  - 赏味期设置页面，配置咖啡豆的赏味期限规则
- `FlavorDimensionSettings` - 使用 `useModalHistory`
  - 风味维度设置页面，自定义风味评价维度
- `RandomCoffeeBeanSettings` - 使用 `useModalHistory`
  - 随机咖啡豆设置页面，配置随机选择的规则和范围
- `SearchSortSettings` - 使用 `useModalHistory`
  - 搜索排序设置页面，配置咖啡豆列表的默认排序方式
- `HiddenMethodsSettings` - 使用 `useModalHistory`
  - 隐藏方案管理页面，恢复被隐藏的预设冲煮方案
- `HiddenEquipmentsSettings` - 使用 `useModalHistory`
  - 隐藏器具管理页面，恢复被隐藏的预设器具
- `RoasterLogoSettings` - 使用 `useModalHistory`
  - 烘焙商图标设置页面，管理烘焙商Logo上传
- `GrinderSettings` - 使用 `useModalHistory`
  - 磨豆机设置页面，管理磨豆机及其刻度

## 迁移完成

所有组件已迁移至统一历史栈管理系统。

搜索关键词（用于验证迁移）：`useModalHistory`、`modalHistory.back()`

## 使用模式

### 单个模态框

```tsx
function MyModal({ isOpen, onClose }) {
  // 动画状态（组件自行管理）
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // 历史栈管理
  useModalHistory({ id: 'my-modal', isOpen, onClose });

  // 动画控制
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setTimeout(() => setIsVisible(true), 10);
    } else {
      setIsVisible(false);
      setTimeout(() => setShouldRender(false), 350);
    }
  }, [isOpen]);

  if (!shouldRender) return null;
  return (
    <div className={isVisible ? 'translate-x-0' : 'translate-x-full'}>...</div>
  );
}
```

### 多步骤表单

```tsx
function MultiStepForm({ isOpen, onClose }) {
  const [step, setStep] = useState(1);

  useMultiStepModalHistory({
    id: 'my-form',
    isOpen,
    step,
    onStepChange: setStep,
    onClose,
  });

  const handleSubmit = () => {
    // 表单完成时，清理所有步骤历史
    modalHistory.closeAllByPrefix('my-form');
    onSave();
  };
}
```

### 页面跳转时清理

```typescript
// 保存笔记后跳转到笔记页面
modalHistory.clearAndNavigate();
setActiveMainTab('笔记');
```

### 嵌套模态框（不关闭上层）

```tsx
// 父级 page.tsx - 状态管理
const [showEquipmentManagement, setShowEquipmentManagement] = useState(false);
const [showEquipmentForm, setShowEquipmentForm] = useState(false);
const [showEquipmentImportForm, setShowEquipmentImportForm] = useState(false);

// 点击添加器具 - 不关闭管理抽屉
const handleAddEquipment = () => {
  setShowEquipmentForm(true);
  // 不再: setShowEquipmentManagement(false)
};
```

### 子页面独立注册历史（动态注册模式）

适用于表单内多个可选子页面，每个子页面独立注册历史条目：

```tsx
// CustomEquipmentForm.tsx 内部

// 子页面状态
const [showDrawingCanvas, setShowDrawingCanvas] = useState(false);

// 动态注册历史条目
useEffect(() => {
  if (showDrawingCanvas) {
    return modalHistory.register({
      id: 'equipment-form-drawing',
      onClose: () => setShowDrawingCanvas(false),
    });
  }
}, [showDrawingCanvas]);

// 保存按钮 - 必须用 modalHistory.back() 清理历史栈
const handleSaveDrawing = () => {
  const svgString = canvasRef.current.save();
  handleDrawingComplete(svgString);
  modalHistory.back(); // 不能只用 setShowDrawingCanvas(false)
};

// 返回按钮 - 同样用 modalHistory.back()
const handleBackToForm = () => {
  modalHistory.back();
};
```

## 关键实现细节

### isClosingProgrammatically 标志

防止主动关闭时 popstate 重复处理：

```typescript
close(id) {
  // ...
  this.state.isClosingProgrammatically = true;
  window.history.go(-closeCount);
  setTimeout(() => {
    this.state.isClosingProgrammatically = false;
  }, 50);
}
```

### Hook 中的 closedByPopstateRef

区分关闭来源，避免 `isOpen=false` 时重复调用 `modalHistory.close()`：

```typescript
useEffect(() => {
  if (isOpen) {
    closedByPopstateRef.current = false;
    // 注册时，onClose 中标记 closedByPopstateRef = true
  } else if (wasOpenRef.current && !closedByPopstateRef.current) {
    // 主动关闭，需要清理浏览器历史
    modalHistory.close(id);
  }
}, [isOpen]);
```

## 注意事项

1. **动画时长**：历史栈管理器不处理动画，组件需自行控制 `shouldRender`/`isVisible`
2. **步骤号从 1 开始**：`useMultiStepModalHistory` 的 `step` 参数从 1 开始，0 表示不注册历史
3. **iOS 侧滑限制**：侧滑返回时可能短暂看到父页面，这是浏览器机制限制
4. **表单内按钮需指定 type="button"**：`<form>` 内的按钮默认 `type="submit"`，会触发表单提交。返回/保存按钮必须显式设置 `type="button"`
5. **子页面保存也要用 modalHistory.back()**：关闭子页面时必须用 `modalHistory.back()` 清理历史栈，不能只 `setState(false)`
