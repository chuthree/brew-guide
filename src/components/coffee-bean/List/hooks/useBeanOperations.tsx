'use client'

import { useState } from 'react'
import { ExtendedCoffeeBean } from '../types'
import { CoffeeBeanManager } from '@/lib/managers/coffeeBeanManager'
import { globalCache } from '../globalCache'

export const useBeanOperations = () => {
    const [forceRefreshKey, setForceRefreshKey] = useState(0)

    // 处理添加咖啡豆 - 优化为立即更新UI和全局缓存
    const handleSaveBean = async (bean: Omit<ExtendedCoffeeBean, 'id' | 'timestamp'>, editingBean: ExtendedCoffeeBean | null) => {
        try {
            if (editingBean) {
                // 立即更新本地状态，先乐观更新UI
                const optimisticBean = {
                    ...editingBean,
                    ...bean
                };
                
                // 更新全局缓存
                globalCache.beans = globalCache.beans.map(b =>
                    b.id === editingBean.id ? optimisticBean : b
                );
                
                // 异步更新本地存储
                await CoffeeBeanManager.updateBean(editingBean.id, bean);
                
                // 强制刷新数据
                setForceRefreshKey(prev => prev + 1);
                
                return { success: true, bean: optimisticBean };
            } else {
                // 添加新咖啡豆 - 创建临时ID以便乐观更新UI
                const tempId = 'temp_' + Date.now();
                const tempBean = {
                    ...bean,
                    id: tempId,
                    timestamp: Date.now()
                } as ExtendedCoffeeBean;
                
                // 立即更新UI
                globalCache.beans = [...globalCache.beans, tempBean];
                
                // 异步保存到存储
                const result = await CoffeeBeanManager.addBean(bean);
                
                // 强制刷新数据
                setForceRefreshKey(prev => prev + 1);

                // 检查是否是首次添加咖啡豆并触发事件
                const allBeans = await CoffeeBeanManager.getAllBeans();
                if (allBeans.length === 1) {
                    // 触发全局事件，通知应用程序现在有咖啡豆了
                    const event = new CustomEvent('coffeeBeanListChanged', {
                        detail: { hasBeans: true, isFirstBean: true }
                    });
                    window.dispatchEvent(event);
                } else {
                    // 一般性更新，仍然触发事件
                    const event = new CustomEvent('coffeeBeanListChanged', {
                        detail: { hasBeans: true }
                    });
                    window.dispatchEvent(event);
                }
                
                return { success: true, bean: result };
            }
        } catch (error) {
            console.error('保存咖啡豆失败:', error);
            return { success: false, error };
        }
    };

    // 处理咖啡豆删除 - 优化为立即更新UI
    const handleDelete = async (bean: ExtendedCoffeeBean) => {
        if (!window.confirm(`确认要删除咖啡豆"${bean.name}"吗？`)) {
            return { success: false, canceled: true };
        }
        
        try {
            // 立即更新UI
            globalCache.beans = globalCache.beans.filter(b => b.id !== bean.id);
            
            // 异步执行删除操作
            const success = await CoffeeBeanManager.deleteBean(bean.id);
            
            if (!success) {
                // 如果删除失败，重新加载数据
                setForceRefreshKey(prev => prev + 1);
                return { success: false, error: new Error('删除咖啡豆失败') };
            } else {
                // 触发自定义事件以通知组件更新
                window.dispatchEvent(new CustomEvent('coffeeBeansUpdated'));
                return { success: true };
            }
        } catch (error) {
            console.error('删除咖啡豆失败:', error);
            // 重新加载数据恢复状态
            setForceRefreshKey(prev => prev + 1);
            return { success: false, error };
        }
    };

    // 保存咖啡豆评分 - 优化为立即更新UI
    const handleSaveRating = async (id: string, ratings: Partial<ExtendedCoffeeBean>) => {
        try {
            const updatedBean = await CoffeeBeanManager.updateBeanRatings(id, ratings);
            if (updatedBean) {
                // 更新全局缓存
                globalCache.beans = globalCache.beans.map(b =>
                    b.id === updatedBean.id ? updatedBean : b
                );

                // 触发更新
                window.dispatchEvent(new CustomEvent('coffeeBeansUpdated'));
                
                return { success: true, bean: updatedBean };
            }
            return { success: false, error: new Error('更新评分失败') };
        } catch (error) {
            console.error("保存评分失败:", error);
            return { success: false, error };
        }
    };

    // 处理剩余量更新
    const handleRemainingUpdate = async (beanId: string, newValue: string) => {
        try {
            const beanToUpdate = globalCache.beans.find(bean => bean.id === beanId);
            if (!beanToUpdate) return { success: false, error: new Error('找不到咖啡豆') };

            // 验证输入值
            let valueToSave = newValue.trim();
            if (valueToSave === '') valueToSave = '0';
            
            // 确保是有效数字
            const numValue = parseFloat(valueToSave);
            if (isNaN(numValue) || numValue < 0) {
                valueToSave = '0';
            }

            // 优化UI更新：先更新全局缓存
            globalCache.beans = globalCache.beans.map(b => {
                if (b.id === beanId) {
                    return { ...b, remaining: valueToSave };
                }
                return b;
            });

            // 异步更新数据库
            await CoffeeBeanManager.updateBean(beanId, { remaining: valueToSave });

            // 触发自定义事件以通知其他组件更新
            window.dispatchEvent(new CustomEvent('coffeeBeansUpdated'));
            
            // 强制刷新
            setForceRefreshKey(prev => prev + 1);
            
            return { success: true, value: valueToSave };
        } catch (error) {
            console.error('更新剩余量失败:', error);
            return { success: false, error };
        }
    };

    // 处理快捷减量按钮点击
    const handleQuickDecrement = async (beanId: string, currentValue: string, decrementAmount: number) => {
        try {
            const beanToUpdate = globalCache.beans.find(bean => bean.id === beanId);
            if (!beanToUpdate) return { success: false, error: new Error('找不到咖啡豆') };
            
            // 获取当前值（不带单位）
            const currentValueNum = parseFloat(currentValue);
            if (isNaN(currentValueNum)) return { success: false, error: new Error('当前值无效') };
            
            // 计算新值，确保不小于0
            const newValue = Math.max(0, currentValueNum - decrementAmount);
            
            // 是否减到0（剩余量不足）
            const reducedToZero = currentValueNum < decrementAmount;
            
            // 更新全局缓存
            globalCache.beans = globalCache.beans.map(b => {
                if (b.id === beanId) {
                    return { ...b, remaining: newValue.toString() };
                }
                return b;
            });
            
            // 异步更新数据库
            await CoffeeBeanManager.updateBean(beanId, { remaining: newValue.toString() });
            
            // 触发自定义事件以通知其他组件更新
            window.dispatchEvent(new CustomEvent('coffeeBeansUpdated'));
            
            // 强制刷新
            setForceRefreshKey(prev => prev + 1);
            
            return { 
                success: true, 
                value: newValue.toString(), 
                reducedToZero
            };
        } catch (error) {
            console.error('快捷减量失败:', error);
            return { success: false, error };
        }
    };

    // 处理分享咖啡豆信息
    const handleShare = async (bean: ExtendedCoffeeBean, copyFunction: (text: string) => void) => {
        try {
            // 创建一个可分享的咖啡豆对象
            const shareableBean: any = {
                name: bean.name,
                capacity: bean.capacity,
                roastLevel: bean.roastLevel,
                roastDate: bean.roastDate,
                flavor: bean.flavor,
                origin: bean.origin,
                process: bean.process,
                variety: bean.variety,
                price: bean.price,
                type: bean.blendComponents && bean.blendComponents.length > 1 ? '拼配' : '单品',
                beanType: bean.beanType, // 添加beanType信息
                notes: bean.notes,
                startDay: bean.startDay,
                endDay: bean.endDay
            };

            // 添加成分信息
            if (bean.blendComponents && bean.blendComponents.length > 0) {
                shareableBean.blendComponents = bean.blendComponents;
            }

            // 导入转换工具并生成可读文本
            try {
                const { beanToReadableText } = await import('@/lib/utils/jsonUtils');
                // 我们知道这个对象结构与函数期望的类型兼容
                const readableText = beanToReadableText(shareableBean);
                copyFunction(readableText);
                return { success: true };
            } catch (_) {
                // 转换失败时回退到JSON格式
                const jsonString = JSON.stringify(shareableBean, null, 2);
                copyFunction(jsonString);
                return { success: true, usedFallback: true };
            }
        } catch (error) {
            console.error('分享咖啡豆信息时出错:', error);
            return { success: false, error };
        }
    };

    return {
        forceRefreshKey,
        handleSaveBean,
        handleDelete,
        handleSaveRating,
        handleRemainingUpdate,
        handleQuickDecrement,
        handleShare
    };
}; 