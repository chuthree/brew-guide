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

## 待迁移组件

以下组件仍使用旧的 `window.history.pushState` + `popstate` 监听：

```
src/components/settings/Settings.tsx
src/components/settings/DisplaySettings.tsx
src/components/settings/BeanSettings.tsx
src/components/settings/DataSettings.tsx
src/components/settings/TimerSettings.tsx
src/components/method/MethodFormModal.tsx
src/components/notes/NoteFormModal.tsx
```

搜索关键词：`pushState`、`popstate`、`__modalHandlingBack`

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
