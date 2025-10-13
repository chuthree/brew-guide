import { create } from 'zustand'
import { CoffeeBean } from '@/types/app'
import { CoffeeBeanManager } from '@/lib/managers/coffeeBeanManager'

interface CoffeeBeanStore {
    beans: CoffeeBean[]
    isLoading: boolean
    error: string | null
    
    // Actions
    loadBeans: () => Promise<void>
    addBean: (bean: CoffeeBean) => Promise<void>
    updateBean: (id: string, updates: Partial<CoffeeBean>) => Promise<void>
    deleteBean: (id: string) => Promise<void>
    updateBeanRating: (id: string, ratings: Partial<CoffeeBean>) => Promise<void>
    refreshBeans: () => Promise<void>
}

export const useCoffeeBeanStore = create<CoffeeBeanStore>((set, get) => ({
    beans: [],
    isLoading: false,
    error: null,

    // 加载所有咖啡豆
    loadBeans: async () => {
        set({ isLoading: true, error: null })
        try {
            const beans = await CoffeeBeanManager.getAllBeans()
            set({ beans, isLoading: false })
        } catch (error) {
            set({ error: '加载咖啡豆失败', isLoading: false })
            console.error('加载咖啡豆失败:', error)
        }
    },

    // 添加咖啡豆
    addBean: async (bean: CoffeeBean) => {
        try {
            const newBean = await CoffeeBeanManager.addBean(bean)
            if (newBean) {
                set(state => ({ beans: [...state.beans, newBean] }))
            }
        } catch (error) {
            console.error('添加咖啡豆失败:', error)
            throw error
        }
    },

    // 更新咖啡豆
    updateBean: async (id: string, updates: Partial<CoffeeBean>) => {
        try {
            const updatedBean = await CoffeeBeanManager.updateBean(id, updates)
            if (updatedBean) {
                set(state => ({
                    beans: state.beans.map(bean => 
                        bean.id === id ? updatedBean : bean
                    )
                }))
            }
        } catch (error) {
            console.error('更新咖啡豆失败:', error)
            throw error
        }
    },

    // 删除咖啡豆
    deleteBean: async (id: string) => {
        try {
            await CoffeeBeanManager.deleteBean(id)
            set(state => ({
                beans: state.beans.filter(bean => bean.id !== id)
            }))
        } catch (error) {
            console.error('删除咖啡豆失败:', error)
            throw error
        }
    },

    // 更新咖啡豆评分
    updateBeanRating: async (id: string, ratings: Partial<CoffeeBean>) => {
        try {
            const updatedBean = await CoffeeBeanManager.updateBeanRatings(id, ratings)
            if (updatedBean) {
                set(state => ({
                    beans: state.beans.map(bean => 
                        bean.id === id ? updatedBean : bean
                    )
                }))
            }
        } catch (error) {
            console.error('更新评分失败:', error)
            throw error
        }
    },

    // 刷新咖啡豆数据
    refreshBeans: async () => {
        await get().loadBeans()
    }
}))
