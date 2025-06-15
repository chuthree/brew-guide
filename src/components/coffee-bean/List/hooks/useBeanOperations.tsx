'use client'

import { useState } from 'react'
import { ExtendedCoffeeBean } from '../types'

export const useBeanOperations = () => {
    const [forceRefreshKey, setForceRefreshKey] = useState(0)

    // 处理添加咖啡豆 - 简化为直接存储更新，依赖统一事件机制
    const handleSaveBean = async (bean: Omit<ExtendedCoffeeBean, 'id' | 'timestamp'>, editingBean: ExtendedCoffeeBean | null) => {
        try {
            const { CoffeeBeanManager } = await import('@/lib/managers/coffeeBeanManager');
            let resultBean: ExtendedCoffeeBean;

            if (editingBean) {
                // 更新现有咖啡豆
                const updatedBean = await CoffeeBeanManager.updateBean(editingBean.id, bean);
                if (!updatedBean) {
                    throw new Error('更新咖啡豆失败');
                }
                resultBean = updatedBean as ExtendedCoffeeBean;

                // 触发数据更新事件
                window.dispatchEvent(
                    new CustomEvent('coffeeBeanDataChanged', {
                        detail: {
                            action: 'update',
                            beanId: editingBean.id
                        }
                    })
                );
            } else {
                // 添加新咖啡豆
                const newBean = await CoffeeBeanManager.addBean(bean);
                resultBean = newBean as ExtendedCoffeeBean;

                // 触发数据更新事件
                window.dispatchEvent(
                    new CustomEvent('coffeeBeanDataChanged', {
                        detail: {
                            action: 'add',
                            beanId: newBean.id,
                            isFirstBean: false // 这里会在主页面中重新计算
                        }
                    })
                );
            }

            return { success: true, bean: resultBean };
        } catch (error) {
            console.error('保存咖啡豆失败:', error);
            return { success: false, error };
        }
    };

    // 处理咖啡豆删除 - 使用统一事件机制
    const handleDelete = async (bean: ExtendedCoffeeBean) => {
        if (!window.confirm(`确认要删除咖啡豆"${bean.name}"吗？`)) {
            return { success: false, canceled: true };
        }

        try {
            // 执行删除操作
            const { CoffeeBeanManager } = await import('@/lib/managers/coffeeBeanManager');
            const success = await CoffeeBeanManager.deleteBean(bean.id);

            if (!success) {
                return { success: false, error: new Error('删除咖啡豆失败') };
            }

            // 触发数据更新事件
            window.dispatchEvent(
                new CustomEvent('coffeeBeanDataChanged', {
                    detail: {
                        action: 'delete',
                        beanId: bean.id
                    }
                })
            );

            return { success: true };
        } catch (error) {
            console.error('删除咖啡豆失败:', error);
            return { success: false, error };
        }
    };

    // 保存咖啡豆评分 - 使用统一事件机制
    const handleSaveRating = async (id: string, ratings: Partial<ExtendedCoffeeBean>) => {
        try {
            const { CoffeeBeanManager } = await import('@/lib/managers/coffeeBeanManager');
            const updatedBean = await CoffeeBeanManager.updateBeanRatings(id, ratings);
            if (updatedBean) {
                // 触发数据更新事件
                window.dispatchEvent(
                    new CustomEvent('coffeeBeanDataChanged', {
                        detail: {
                            action: 'update',
                            beanId: id
                        }
                    })
                );

                return { success: true, bean: updatedBean };
            }
            return { success: false, error: new Error('更新评分失败') };
        } catch (error) {
            console.error("保存评分失败:", error);
            return { success: false, error };
        }
    };

    // 处理剩余量更新 - 使用统一事件机制
    const handleRemainingUpdate = async (beanId: string, newValue: string) => {
        try {
            // 验证输入值
            let valueToSave = newValue.trim();
            if (valueToSave === '') valueToSave = '0';

            // 确保是有效数字
            const numValue = parseFloat(valueToSave);
            if (isNaN(numValue) || numValue < 0) {
                valueToSave = '0.0';
            } else {
                // 格式化为保留一位小数的字符串
                valueToSave = numValue.toFixed(1);
            }

            // 更新数据库
            const { CoffeeBeanManager } = await import('@/lib/managers/coffeeBeanManager');
            await CoffeeBeanManager.updateBean(beanId, { remaining: valueToSave });

            // 触发数据更新事件
            window.dispatchEvent(
                new CustomEvent('coffeeBeanDataChanged', {
                    detail: {
                        action: 'update',
                        beanId: beanId
                    }
                })
            );

            return { success: true, value: valueToSave };
        } catch (error) {
            console.error('更新剩余量失败:', error);
            return { success: false, error };
        }
    };

    // 处理快捷减量按钮点击 - 使用统一事件机制，确保扣除量合理
    const handleQuickDecrement = async (beanId: string, currentValue: string, decrementAmount: number) => {
        try {
            // 获取当前值（不带单位）
            const currentValueNum = parseFloat(currentValue);
            if (isNaN(currentValueNum)) return { success: false, error: new Error('当前值无效') };

            // 计算实际扣除量（不能超过当前剩余量）
            const actualDecrementAmount = Math.min(decrementAmount, currentValueNum);

            // 计算新值，确保不小于0
            const newValue = Math.max(0, currentValueNum - actualDecrementAmount);

            // 是否减到0（剩余量不足）
            const reducedToZero = currentValueNum < decrementAmount;

            // 格式化为保留一位小数的字符串
            const formattedValue = newValue.toFixed(1);

            // 更新数据库
            const { CoffeeBeanManager } = await import('@/lib/managers/coffeeBeanManager');
            await CoffeeBeanManager.updateBean(beanId, { remaining: formattedValue });

            // 触发数据更新事件
            window.dispatchEvent(
                new CustomEvent('coffeeBeanDataChanged', {
                    detail: {
                        action: 'update',
                        beanId: beanId
                    }
                })
            );

            return {
                success: true,
                value: formattedValue,
                actualDecrementAmount, // 返回实际扣除量
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
            // Log error in development only
            if (process.env.NODE_ENV === 'development') {
                console.error('分享咖啡豆信息时出错:', error);
            }
            return { success: false, error };
        }
    };

    return {
        forceRefreshKey,
        setForceRefreshKey,
        handleSaveBean,
        handleDelete,
        handleSaveRating,
        handleRemainingUpdate,
        handleQuickDecrement,
        handleShare
    };
}; 