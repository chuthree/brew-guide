'use client'

import { Storage } from '@/lib/storage'

export interface BeanMethod {
    id: string
    beanId: string
    equipmentId: string
    methodId: string
    params?: Record<string, string | number | boolean>
    notes?: string
    timestamp: number
}

class BeanMethodManager {
    private static readonly STORAGE_KEY = 'brew-guide:bean-methods'

    // 获取指定咖啡豆的所有方案
    static async getBeanMethods(beanId: string): Promise<BeanMethod[]> {
        try {
            const methods = await this.getAllMethods()
            return methods.filter(method => method.beanId === beanId)
        } catch (error) {
            console.error('获取咖啡豆方案失败:', error)
            return []
        }
    }

    // 获取所有方案
    static async getAllMethods(): Promise<BeanMethod[]> {
        try {
            const data = await Storage.get(this.STORAGE_KEY)
            if (!data) return []
            try {
                return JSON.parse(data) as BeanMethod[]
            } catch {
                return []
            }
        } catch (error) {
            console.error('获取所有方案失败:', error)
            return []
        }
    }

    // 添加方案
    static async addMethod(method: Omit<BeanMethod, 'id' | 'timestamp'>): Promise<BeanMethod | null> {
        try {
            const methods = await this.getAllMethods()
            const newMethod: BeanMethod = {
                ...method,
                id: `method_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                timestamp: Date.now()
            }
            methods.push(newMethod)
            await Storage.set(this.STORAGE_KEY, JSON.stringify(methods))
            return newMethod
        } catch (error) {
            console.error('添加方案失败:', error)
            return null
        }
    }

    // 更新方案
    static async updateMethod(id: string, updates: Partial<BeanMethod>): Promise<BeanMethod | null> {
        try {
            const methods = await this.getAllMethods()
            const index = methods.findIndex(method => method.id === id)
            if (index === -1) return null

            const updatedMethod = {
                ...methods[index],
                ...updates,
                id, // 保持ID不变
                timestamp: Date.now() // 更新时间戳
            }
            methods[index] = updatedMethod
            await Storage.set(this.STORAGE_KEY, JSON.stringify(methods))
            return updatedMethod
        } catch (error) {
            console.error('更新方案失败:', error)
            return null
        }
    }

    // 删除方案
    static async deleteMethod(id: string): Promise<boolean> {
        try {
            const methods = await this.getAllMethods()
            const filteredMethods = methods.filter(method => method.id !== id)
            await Storage.set(this.STORAGE_KEY, JSON.stringify(filteredMethods))
            return true
        } catch (error) {
            console.error('删除方案失败:', error)
            return false
        }
    }

    // 删除指定咖啡豆的所有方案
    static async deleteBeanMethods(beanId: string): Promise<boolean> {
        try {
            const methods = await this.getAllMethods()
            const filteredMethods = methods.filter(method => method.beanId !== beanId)
            await Storage.set(this.STORAGE_KEY, JSON.stringify(filteredMethods))
            return true
        } catch (error) {
            console.error('删除咖啡豆方案失败:', error)
            return false
        }
    }
}

export { BeanMethodManager } 