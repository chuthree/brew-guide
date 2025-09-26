import { useState, useEffect } from 'react'
import { CustomFlavorDimensionsManager, FlavorDimension } from '@/lib/managers/customFlavorDimensions'

/**
 * 自定义Hook：获取风味维度数据
 */
export const useFlavorDimensions = () => {
    const [dimensions, setDimensions] = useState<FlavorDimension[]>([])
    const [historicalLabels, setHistoricalLabels] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const loadData = async () => {
            try {
                const [dims, labels] = await Promise.all([
                    CustomFlavorDimensionsManager.getFlavorDimensions(),
                    CustomFlavorDimensionsManager.getHistoricalLabels()
                ])
                setDimensions(dims)
                setHistoricalLabels(labels)
            } catch (error) {
                console.error('加载风味维度数据失败:', error)
            } finally {
                setLoading(false)
            }
        }

        const handleFlavorDimensionsChange = (event: CustomEvent) => {
            const { dimensions: newDimensions } = event.detail
            setDimensions(newDimensions)
            // 同时更新历史标签
            CustomFlavorDimensionsManager.getHistoricalLabels().then(setHistoricalLabels)
        }

        loadData()

        // 监听风味维度变化
        window.addEventListener('flavorDimensionsChanged', handleFlavorDimensionsChange as EventListener)

        return () => {
            window.removeEventListener('flavorDimensionsChanged', handleFlavorDimensionsChange as EventListener)
        }
    }, [])

    /**
     * 根据维度ID获取维度标签（支持历史标签）
     */
    const getDimensionLabel = (id: string): string => {
        // 首先尝试从当前维度中查找
        const currentDimension = dimensions.find(d => d.id === id)
        if (currentDimension) {
            return currentDimension.label
        }

        // 如果当前维度中没有，从历史标签中查找
        if (historicalLabels[id]) {
            return historicalLabels[id]
        }

        // 如果历史标签中也没有，返回人性化的默认标签
        if (id.startsWith('custom_')) {
            return '已删除的风味维度'
        }

        return id
    }

    /**
     * 获取所有有效的风味评分（值大于0的评分）
     */
    const getValidTasteRatings = (taste: Record<string, number>): Array<{ id: string; label: string; value: number }> => {
        // 先创建所有有效评分的数组
        const validRatings = Object.entries(taste)
            .filter(([_, value]) => value > 0)
            .map(([id, value]) => ({
                id,
                label: getDimensionLabel(id),
                value
            }))

        // 按照当前维度的order进行排序
        return validRatings.sort((a, b) => {
            const dimA = dimensions.find(d => d.id === a.id)
            const dimB = dimensions.find(d => d.id === b.id)
            
            // 获取order值，如果维度不存在则使用999作为默认值
            const orderA = dimA?.order ?? 999
            const orderB = dimB?.order ?? 999
            
            // 如果order相同，按标签字母顺序排序
            if (orderA === orderB) {
                return a.label.localeCompare(b.label)
            }
            
            return orderA - orderB
        })
    }

    return {
        dimensions,
        loading,
        getDimensionLabel,
        getValidTasteRatings,
        historicalLabels
    }
}