'use client'

import { useMemo, useCallback } from 'react'
import { BrewingNote, CustomEquipment } from '@/lib/core/config'
import { SortOption } from '../../types'
import { sortNotes, calculateTotalCoffeeConsumption } from '../../utils'
import { isSameEquipment, getEquipmentIdByName } from '@/lib/utils/equipmentUtils'

// 简单的debounce实现
const debounce = <T extends (...args: unknown[]) => unknown>(func: T, wait: number): T => {
    let timeout: NodeJS.Timeout | null = null
    return ((...args: unknown[]) => {
        if (timeout) clearTimeout(timeout)
        timeout = setTimeout(() => func(...args), wait)
    }) as T
}

interface UseEnhancedNotesFilteringProps {
    notes: BrewingNote[]
    sortOption: SortOption
    filterMode: 'equipment' | 'bean'
    selectedEquipment: string | null
    selectedBean: string | null
    searchQuery?: string
    isSearching?: boolean
    preFilteredNotes?: BrewingNote[]
    customEquipments?: CustomEquipment[] // 🔥 添加自定义器具列表用于兼容性比较
}

interface UseEnhancedNotesFilteringReturn {
    filteredNotes: BrewingNote[]
    displayNotes: BrewingNote[]
    totalCount: number
    totalConsumption: number
    availableEquipments: string[]
    availableBeans: string[]
    debouncedUpdateFilters: (filters: Partial<UseEnhancedNotesFilteringProps>) => void
}

/**
 * 增强的笔记筛选和排序Hook
 * 集中处理所有筛选、排序和统计逻辑，确保数据一致性
 */
export const useEnhancedNotesFiltering = ({
    notes,
    sortOption,
    filterMode,
    selectedEquipment,
    selectedBean,
    searchQuery = '',
    isSearching = false,
    preFilteredNotes,
    customEquipments = []
}: UseEnhancedNotesFilteringProps): UseEnhancedNotesFilteringReturn => {

    // 基础筛选：先排序，再应用筛选条件
    const filteredNotes = useMemo(() => {
        if (!notes || notes.length === 0) return []

        // 如果有预筛选的笔记（搜索结果），直接使用
        if (preFilteredNotes && isSearching && searchQuery.trim()) {
            return sortNotes(preFilteredNotes, sortOption)
        }

        // 1. 先对原始数据排序
        const sortedNotes = sortNotes(notes, sortOption)

        // 2. 再应用筛选条件
        let filtered = sortedNotes

        if (filterMode === 'equipment' && selectedEquipment) {
            // 🔥 使用兼容性比较，支持ID和名称混用
            filtered = sortedNotes.filter((note: BrewingNote) => {
                return isSameEquipment(note.equipment, selectedEquipment, customEquipments);
            })
        } else if (filterMode === 'bean' && selectedBean) {
            // 使用简单的咖啡豆名称匹配
            // 复杂的异步匹配逻辑在外部处理
            filtered = sortedNotes.filter((note: BrewingNote) => note.coffeeBeanInfo?.name === selectedBean)
        }

        return filtered
    }, [notes, sortOption, filterMode, selectedEquipment, selectedBean, preFilteredNotes, isSearching, searchQuery, customEquipments])

    // 显示的笔记（用于UI渲染）
    const displayNotes = useMemo(() => {
        return filteredNotes
    }, [filteredNotes])

    // 计算总数量
    const totalCount = useMemo(() => {
        return filteredNotes.length
    }, [filteredNotes])

    // 计算总消耗量
    const totalConsumption = useMemo(() => {
        return calculateTotalCoffeeConsumption(filteredNotes)
    }, [filteredNotes])

    // 🔥 获取可用设备列表（基于原始数据，规范化为ID避免重复）
    const availableEquipments = useMemo(() => {
        if (!notes || notes.length === 0) return []
        
        const equipmentSet = new Set<string>()
        notes.forEach((note: BrewingNote) => {
            if (note.equipment) {
                // 规范化为ID（名称会被转为ID，ID保持不变）
                // 使用getEquipmentIdByName来统一标识
                const normalizedId = getEquipmentIdByName(note.equipment, customEquipments);
                equipmentSet.add(normalizedId)
            }
        })
        
        return Array.from(equipmentSet).sort()
    }, [notes, customEquipments])

    // 获取可用咖啡豆列表（基于原始数据）
    const availableBeans = useMemo(() => {
        if (!notes || notes.length === 0) return []
        
        const beanSet = new Set<string>()
        notes.forEach((note: BrewingNote) => {
            if (note.coffeeBeanInfo?.name) {
                beanSet.add(note.coffeeBeanInfo.name)
            }
        })
        
        return Array.from(beanSet).sort()
    }, [notes])

    // 防抖的筛选更新函数
    const debouncedUpdateFilters = useCallback((_filters: Partial<UseEnhancedNotesFilteringProps>) => {
        const debouncedHandler = debounce(() => {
            // 这个函数主要用于外部调用时的防抖处理
            // 实际的筛选逻辑已经通过useMemo优化
            // 筛选更新完成
        }, 300)

        debouncedHandler()
    }, [])

    return {
        filteredNotes,
        displayNotes,
        totalCount,
        totalConsumption,
        availableEquipments,
        availableBeans,
        debouncedUpdateFilters
    }
}

/**
 * 异步咖啡豆筛选辅助函数
 * 处理复杂的咖啡豆匹配逻辑
 */
export const useAsyncBeanFiltering = () => {
    const filterNotesByBeanAsync = useCallback(async (notes: BrewingNote[], selectedBean: string) => {
        if (!selectedBean || !notes.length) return notes

        try {
            // 动态导入咖啡豆管理器进行复杂匹配
            const { CoffeeBeanManager } = await import('@/lib/managers/coffeeBeanManager')

            const filteredNotes: BrewingNote[] = []

            for (const note of notes) {
                let matches = false

                // 优先通过 beanId 获取最新咖啡豆名称进行匹配
                if (note.beanId) {
                    try {
                        const bean = await CoffeeBeanManager.getBeanById(note.beanId)
                        if (bean?.name === selectedBean) {
                            matches = true
                        }
                    } catch (error) {
                        console.warn('获取咖啡豆信息失败:', error)
                    }
                }

                // 如果通过 beanId 没有匹配，使用笔记中存储的名称
                if (!matches && note.coffeeBeanInfo?.name === selectedBean) {
                    matches = true
                }

                if (matches) {
                    filteredNotes.push(note)
                }
            }

            return filteredNotes
        } catch (error) {
            console.error('异步咖啡豆筛选失败:', error)
            // 降级到简单匹配
            return notes.filter((note: BrewingNote) => note.coffeeBeanInfo?.name === selectedBean)
        }
    }, [])

    return { filterNotesByBeanAsync }
}
