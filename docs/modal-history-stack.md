# 模态框历史栈管理规范

## 概述
支持硬件返回键和浏览器返回按钮关闭模态框，支持多步骤表单。

## 实现方案

### 单层模态框

```typescript
// 添加历史管理
useEffect(() => {
    if (!isOpen) return
    
    window.history.pushState({ modal: 'unique-id' }, '')
    
    const handlePopState = () => onClose()
    window.addEventListener('popstate', handlePopState)
    
    return () => window.removeEventListener('popstate', handlePopState)
}, [isOpen, onClose])

// 关闭处理
const handleClose = () => {
    if (window.history.state?.modal === 'unique-id') {
        window.history.back()
    } else {
        onClose()
    }
}
```

### 多步骤表单模态框

**Modal 组件**：
```typescript
const formRef = useRef<{ handleBackStep: () => boolean } | null>(null)

useEffect(() => {
    if (!showForm) return
    
    // 替换掉父模态框记录
    if (window.history.state?.modal === 'parent-modal-id') {
        window.history.replaceState(null, '')
    }
    
    window.history.pushState({ modal: 'form-id' }, '')
    
    const handlePopState = () => {
        if (formRef.current?.handleBackStep()) {
            // 返回了上一步，重新添加记录
            window.history.pushState({ modal: 'form-id' }, '')
        } else {
            // 已在第一步，关闭
            onClose()
        }
    }
    
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
}, [showForm, onClose])

<Form ref={formRef} ... />
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

## 适配步骤

1. 确定模态框唯一 ID
2. 添加历史栈管理 useEffect
3. 修改 handleClose 函数
4. 多步骤表单：使用 forwardRef + useImperativeHandle

## 已知限制

**侧滑预览闪烁**：PWA/网页侧滑返回时可能短暂看到父模态框，这是浏览器机制限制，无法完全避免。硬件返回键和浏览器按钮工作正常。

## 示例

- **单层**：`src/components/coffee-bean/Detail/BeanDetailModal.tsx`
- **多步骤**：`src/components/coffee-bean/Form/Modal.tsx` + `index.tsx`
