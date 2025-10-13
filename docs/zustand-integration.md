# Zustand 状态管理集成指南

## 概述

使用 Zustand 作为轻量级全局状态管理方案，实现跨组件的实时数据同步。

## 核心文件

```
src/lib/stores/
  └── coffeeBeanStore.ts    # 咖啡豆状态管理
```

## Store 结构模板

```typescript
import { create } from 'zustand'
import { YourType } from '@/types/app'
import { YourManager } from '@/lib/managers/yourManager'

interface YourStore {
    items: YourType[]
    isLoading: boolean
    error: string | null
    
    // Actions
    loadItems: () => Promise<void>
    addItem: (item: YourType) => Promise<void>
    updateItem: (id: string, updates: Partial<YourType>) => Promise<void>
    deleteItem: (id: string) => Promise<void>
    refreshItems: () => Promise<void>
}

export const useYourStore = create<YourStore>((set, get) => ({
    items: [],
    isLoading: false,
    error: null,

    loadItems: async () => {
        set({ isLoading: true, error: null })
        try {
            const items = await YourManager.getAll()
            set({ items, isLoading: false })
        } catch (error) {
            set({ error: '加载失败', isLoading: false })
        }
    },

    addItem: async (item: YourType) => {
        const newItem = await YourManager.add(item)
        set(state => ({ items: [...state.items, newItem] }))
    },

    updateItem: async (id: string, updates: Partial<YourType>) => {
        const updated = await YourManager.update(id, updates)
        set(state => ({
            items: state.items.map(item => 
                item.id === id ? updated : item
            )
        }))
    },

    deleteItem: async (id: string) => {
        await YourManager.delete(id)
        set(state => ({
            items: state.items.filter(item => item.id !== id)
        }))
    },

    refreshItems: async () => {
        await get().loadItems()
    }
}))
```

## 使用方式

### 1. 在组件中订阅数据

```typescript
import { useYourStore } from '@/lib/stores/yourStore'

function Component() {
    // 订阅所有数据
    const items = useYourStore(state => state.items)
    
    // 订阅单个数据
    const item = useYourStore(state => 
        state.items.find(i => i.id === itemId)
    )
    
    // 订阅多个字段
    const { items, isLoading } = useYourStore(state => ({
        items: state.items,
        isLoading: state.isLoading
    }))
    
    return <div>{/* ... */}</div>
}
```

### 2. 调用 Actions

```typescript
function Component() {
    const updateItem = useYourStore(state => state.updateItem)
    
    const handleUpdate = async () => {
        await updateItem(itemId, { field: 'newValue' })
        // 所有订阅该数据的组件会自动更新
    }
    
    return <button onClick={handleUpdate}>更新</button>
}
```

### 3. 在非组件中使用

```typescript
import { useYourStore } from '@/lib/stores/yourStore'

// 直接访问 store 状态
const currentItems = useYourStore.getState().items

// 订阅变化
const unsubscribe = useYourStore.subscribe(
    state => console.log('Items changed:', state.items)
)

// 直接更新状态
useYourStore.setState({ items: newItems })
```

## 性能优化

### 1. 选择器优化

```typescript
// ❌ 不推荐：订阅整个 store
const store = useYourStore()

// ✅ 推荐：只订阅需要的数据
const items = useYourStore(state => state.items)
```

### 2. 派生数据

```typescript
// 使用 useMemo 计算派生数据
const filteredItems = useMemo(() => 
    items.filter(item => item.active),
    [items]
)
```

### 3. 浅比较

```typescript
import { useShallow } from 'zustand/react/shallow'

// 避免对象引用变化导致的重渲染
const { field1, field2 } = useYourStore(
    useShallow(state => ({ 
        field1: state.field1, 
        field2: state.field2 
    }))
)
```

## 集成步骤

### 1. 创建 Store

```bash
# 在 src/lib/stores/ 中创建新的 store 文件
touch src/lib/stores/yourStore.ts
```

### 2. 初始化数据

```typescript
// 在主组件或应用入口中初始化
useEffect(() => {
    useYourStore.getState().loadItems()
}, [])
```

### 3. 同步更新

```typescript
// 在修改数据后同步 store
const handleSave = async (id, data) => {
    // 1. 调用 Manager 保存
    await YourManager.update(id, data)
    
    // 2. 更新 store
    await useYourStore.getState().updateItem(id, data)
}
```

## 常见模式

### 1. 乐观更新

```typescript
updateItem: async (id: string, updates: Partial<YourType>) => {
    // 立即更新 UI
    set(state => ({
        items: state.items.map(item => 
            item.id === id ? { ...item, ...updates } : item
        )
    }))
    
    try {
        // 后台保存
        await YourManager.update(id, updates)
    } catch (error) {
        // 失败时回滚
        await get().loadItems()
        throw error
    }
}
```

### 2. 批量操作

```typescript
batchUpdate: async (updates: Array<{ id: string, data: Partial<YourType> }>) => {
    set({ isLoading: true })
    try {
        await Promise.all(
            updates.map(({ id, data }) => YourManager.update(id, data))
        )
        await get().loadItems()
    } finally {
        set({ isLoading: false })
    }
}
```

### 3. 分页加载

```typescript
interface PaginatedStore {
    items: YourType[]
    page: number
    hasMore: boolean
    
    loadMore: () => Promise<void>
}

export const useYourStore = create<PaginatedStore>((set, get) => ({
    items: [],
    page: 1,
    hasMore: true,
    
    loadMore: async () => {
        const { page } = get()
        const newItems = await YourManager.getPage(page)
        set(state => ({
            items: [...state.items, ...newItems],
            page: page + 1,
            hasMore: newItems.length > 0
        }))
    }
}))
```

## 调试

### 1. Redux DevTools

```typescript
import { devtools } from 'zustand/middleware'

export const useYourStore = create(
    devtools(
        (set, get) => ({
            // ... store 定义
        }),
        { name: 'YourStore' }
    )
)
```

### 2. 日志中间件

```typescript
const log = (config) => (set, get, api) =>
    config(
        (...args) => {
            console.log('  applying', args)
            set(...args)
            console.log('  new state', get())
        },
        get,
        api
    )

export const useYourStore = create(log((set) => ({ /* ... */ })))
```

## 迁移检查清单

- [ ] 创建 store 文件
- [ ] 定义状态类型接口
- [ ] 实现 CRUD actions
- [ ] 在组件中替换为 store 订阅
- [ ] 移除冗余的状态管理代码
- [ ] 测试数据同步是否正常
- [ ] 优化性能（选择器）
- [ ] 添加错误处理

## 参考资源

- [Zustand 官方文档](https://github.com/pmndrs/zustand)
- [TypeScript 使用指南](https://github.com/pmndrs/zustand#typescript-usage)
- [最佳实践](https://github.com/pmndrs/zustand/blob/main/docs/guides/flux-inspired-practice.md)
