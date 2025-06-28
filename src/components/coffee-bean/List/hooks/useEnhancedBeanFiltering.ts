import { useMemo, useCallback } from 'react'
import { debounce } from 'lodash'
import { ExtendedCoffeeBean, BeanType, BeanFilterMode } from '../types'
import { SortOption, sortBeans } from '../SortSelector'
import { isBeanEmpty } from '../globalCache'
import { 
    beanHasVariety, 
    extractUniqueVarieties,
    beanHasOrigin,
    extractUniqueOrigins,
    beanHasFlavorPeriodStatus,
    extractAvailableFlavorPeriodStatuses,
    beanHasRoaster,
    extractUniqueRoasters,
    FlavorPeriodStatus
} from '@/lib/utils/beanVarietyUtils'

interface UseEnhancedBeanFilteringProps {
    beans: ExtendedCoffeeBean[]
    filterMode: BeanFilterMode
    selectedVariety: string | null
    selectedOrigin: string | null
    selectedFlavorPeriod: FlavorPeriodStatus | null
    selectedRoaster: string | null
    selectedBeanType: BeanType
    showEmptyBeans: boolean
    sortOption: SortOption
}

interface UseEnhancedBeanFilteringReturn {
    filteredBeans: ExtendedCoffeeBean[]
    availableVarieties: string[]
    availableOrigins: string[]
    availableFlavorPeriods: FlavorPeriodStatus[]
    availableRoasters: string[]
    debouncedUpdateFilters: (filters: Partial<UseEnhancedBeanFilteringProps>) => void
}

/**
 * 增强的咖啡豆筛选和排序Hook
 * 支持多种分类模式：品种、产地、赏味期、烘焙商
 */
export const useEnhancedBeanFiltering = ({
    beans,
    filterMode,
    selectedVariety,
    selectedOrigin,
    selectedFlavorPeriod,
    selectedRoaster,
    selectedBeanType,
    showEmptyBeans,
    sortOption
}: UseEnhancedBeanFilteringProps): UseEnhancedBeanFilteringReturn => {

    // 使用useMemo缓存筛选后的豆子，只在依赖项变化时重新计算
    const filteredBeans = useMemo(() => {
        if (!beans || beans.length === 0) return []

        let filtered = beans

        // 1. 按豆子类型筛选
        if (selectedBeanType && selectedBeanType !== 'all') {
            filtered = filtered.filter(bean => bean.beanType === selectedBeanType)
        }

        // 2. 按是否显示空豆子筛选
        if (!showEmptyBeans) {
            filtered = filtered.filter(bean => !isBeanEmpty(bean))
        }

        // 3. 根据当前分类模式进行筛选
        switch (filterMode) {
            case 'variety':
                if (selectedVariety) {
                    filtered = filtered.filter(bean => beanHasVariety(bean, selectedVariety))
                }
                break
            case 'origin':
                if (selectedOrigin) {
                    filtered = filtered.filter(bean => beanHasOrigin(bean, selectedOrigin))
                }
                break
            case 'flavorPeriod':
                if (selectedFlavorPeriod) {
                    filtered = filtered.filter(bean => beanHasFlavorPeriodStatus(bean, selectedFlavorPeriod))
                }
                break
            case 'roaster':
                if (selectedRoaster) {
                    filtered = filtered.filter(bean => beanHasRoaster(bean, selectedRoaster))
                }
                break
        }

        // 4. 排序
        const compatibleBeans = filtered.map(bean => ({
            id: bean.id,
            name: bean.name,
            roastDate: bean.roastDate,
            startDay: bean.startDay,
            endDay: bean.endDay,
            roastLevel: bean.roastLevel,
            capacity: bean.capacity,
            remaining: bean.remaining,
            timestamp: bean.timestamp,
            overallRating: bean.overallRating,
            variety: bean.variety,
            price: bean.price
        }))

        const sortedBeans = sortBeans(compatibleBeans, sortOption)

        // 按照排序后的顺序收集原始豆子
        const resultBeans: ExtendedCoffeeBean[] = []
        for (const sortedBean of sortedBeans) {
            const originalBean = filtered.find(b => b.id === sortedBean.id)
            if (originalBean) {
                resultBeans.push(originalBean)
            }
        }

        return resultBeans
    }, [beans, filterMode, selectedVariety, selectedOrigin, selectedFlavorPeriod, selectedRoaster, selectedBeanType, showEmptyBeans, sortOption])

    // 获取基础筛选后的豆子（用于计算可用分类选项）
    const baseFilteredBeans = useMemo(() => {
        if (!beans || beans.length === 0) return []

        let filtered = beans

        // 按豆子类型筛选
        if (selectedBeanType && selectedBeanType !== 'all') {
            filtered = filtered.filter(bean => bean.beanType === selectedBeanType)
        }

        // 按是否显示空豆子筛选
        if (!showEmptyBeans) {
            filtered = filtered.filter(bean => !isBeanEmpty(bean))
        }

        return filtered
    }, [beans, selectedBeanType, showEmptyBeans])

    // 使用useMemo缓存可用品种列表
    const availableVarieties = useMemo(() => {
        return extractUniqueVarieties(baseFilteredBeans)
    }, [baseFilteredBeans])

    // 使用useMemo缓存可用产地列表
    const availableOrigins = useMemo(() => {
        return extractUniqueOrigins(baseFilteredBeans)
    }, [baseFilteredBeans])

    // 使用useMemo缓存可用赏味期状态列表
    const availableFlavorPeriods = useMemo(() => {
        return extractAvailableFlavorPeriodStatuses(baseFilteredBeans)
    }, [baseFilteredBeans])

    // 使用useMemo缓存可用烘焙商列表
    const availableRoasters = useMemo(() => {
        return extractUniqueRoasters(baseFilteredBeans)
    }, [baseFilteredBeans])

    // 防抖的筛选更新函数
    const debouncedUpdateFilters = useCallback((filters: Partial<UseEnhancedBeanFilteringProps>) => {
        const debouncedHandler = debounce(() => {
            // 这个函数主要用于外部调用时的防抖处理
            // 实际的筛选逻辑已经通过useMemo优化
            console.warn('Enhanced filters updated:', filters)
        }, 300);

        debouncedHandler();
    },
        []
    )

    return {
        filteredBeans,
        availableVarieties,
        availableOrigins,
        availableFlavorPeriods,
        availableRoasters,
        debouncedUpdateFilters
    }
}
