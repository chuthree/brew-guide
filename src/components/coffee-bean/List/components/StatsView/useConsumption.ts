import { useState, useEffect } from 'react'
import { ExtendedCoffeeBean } from '../../types'
import { Storage } from '@/lib/core/storage'
import { TodayConsumptionData } from './types'

export const useConsumption = (beans: ExtendedCoffeeBean[]): TodayConsumptionData => {
    const [todayConsumption, setTodayConsumption] = useState(0)
    const [todayCost, setTodayCost] = useState(0)
    const [todayEspressoConsumption, setTodayEspressoConsumption] = useState(0)
    const [todayEspressoCost, setTodayEspressoCost] = useState(0)
    const [todayFilterConsumption, setTodayFilterConsumption] = useState(0)
    const [todayFilterCost, setTodayFilterCost] = useState(0)
    
    // 加载今日消耗数据
    useEffect(() => {
        const loadTodayConsumption = async () => {
            try {
                // 获取所有冲煮记录
                const notesStr = await Storage.get('brewingNotes')
                if (!notesStr) return
                
                const notes = JSON.parse(notesStr)
                if (!Array.isArray(notes)) return
                
                // 计算今天的时间戳范围（当天0点到现在）
                const now = new Date()
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
                
                // 筛选今天的冲煮记录
                const todayNotes = notes.filter(note => note.timestamp >= today)
                
                // 计算今日消耗的咖啡量
                let consumption = 0
                let cost = 0
                let espressoConsumption = 0
                let espressoCost = 0
                let filterConsumption = 0
                let filterCost = 0

                todayNotes.forEach(note => {
                    if (note.params?.coffee) {
                        // 提取咖啡量中的数字部分
                        const match = note.params.coffee.match(/(\d+(\.\d+)?)/);
                        if (match) {
                            const coffeeAmount = parseFloat(match[0]);
                            if (!isNaN(coffeeAmount)) {
                                consumption += coffeeAmount;

                                // 判断是否是意式咖啡
                                const isEspresso = note.equipment === 'Espresso' ||
                                                 note.equipment === '意式咖啡机' ||
                                                 (note.stages && Array.isArray(note.stages) &&
                                                  note.stages.some((stage: any) =>
                                                    stage.pourType === 'extraction' || stage.pourType === 'beverage'
                                                  ));

                                // 分别统计手冲和意式消耗
                                if (isEspresso) {
                                    espressoConsumption += coffeeAmount;
                                } else {
                                    filterConsumption += coffeeAmount;
                                }

                                // 计算花费
                                if (note.coffeeBeanInfo?.name) {
                                    // 找到对应的豆子计算价格
                                    const bean = beans.find(b => b.name === note.coffeeBeanInfo?.name)
                                    if (bean && bean.price && bean.capacity) {
                                        const price = parseFloat(bean.price)
                                        const capacity = parseFloat(bean.capacity)
                                        if (capacity > 0) {
                                            const noteCost = coffeeAmount * price / capacity
                                            cost += noteCost

                                            // 分别统计手冲和意式花费
                                            if (isEspresso) {
                                                espressoCost += noteCost;
                                            } else {
                                                filterCost += noteCost;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                })
                
                setTodayConsumption(consumption)
                setTodayCost(cost)
                setTodayEspressoConsumption(espressoConsumption)
                setTodayEspressoCost(espressoCost)
                setTodayFilterConsumption(filterConsumption)
                setTodayFilterCost(filterCost)
            } catch (err) {
                console.error('加载今日消耗数据失败:', err)
            }
        }
        
        loadTodayConsumption()
        
        // 添加事件监听，当冲煮记录更新时重新计算
        const handleStorageChange = (e: CustomEvent) => {
            if (e.detail?.key === 'brewingNotes') {
                loadTodayConsumption()
            }
        }
        
        window.addEventListener('customStorageChange', handleStorageChange as EventListener)
        window.addEventListener('storage:changed', handleStorageChange as EventListener)
        
        return () => {
            window.removeEventListener('customStorageChange', handleStorageChange as EventListener)
            window.removeEventListener('storage:changed', handleStorageChange as EventListener)
        }
    }, [beans])

    return {
        consumption: todayConsumption,
        cost: todayCost,
        espressoConsumption: todayEspressoConsumption,
        espressoCost: todayEspressoCost,
        filterConsumption: todayFilterConsumption,
        filterCost: todayFilterCost
    }
} 