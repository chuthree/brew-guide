'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import { ExtendedCoffeeBean } from '@/types/app'
import { BrewingNote } from '@/lib/core/config'
import { parseDateToTimestamp } from '@/lib/utils/dateUtils'
import HighlightText from '@/components/common/ui/HighlightText'
import { getEquipmentName } from '@/components/notes/utils'
import { formatDate, formatRating } from '@/components/notes/utils'
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerDescription,
} from '@/components/ui/drawer'

// 样式常量
const STYLES = {
    label: 'text-xs text-neutral-500 dark:text-neutral-400',
    value: 'text-xs font-medium text-neutral-800 dark:text-neutral-100',
    muted: 'text-xs text-neutral-600 dark:text-neutral-400',
    border: 'border-neutral-200/40 dark:border-neutral-800/40',
    bgLight: 'bg-neutral-50/50 dark:bg-neutral-800/30',
    bgLighter: 'bg-neutral-50/30 dark:bg-neutral-800/20'
} as const

// 信息项类型定义
interface InfoItem {
    key: string
    label: string
    value: string | React.ReactNode
    type?: 'normal' | 'status'
    color?: string
}

// 信息网格组件
const InfoGrid: React.FC<{
    items: InfoItem[]
    className?: string
}> = ({ items, className = '' }) => {
    if (items.length === 0) return null

    const gridCols = items.length === 1 ? 'grid-cols-1' : 'grid-cols-2'

    return (
        <div className={`grid gap-3 ${gridCols} ${className}`}>
            {items.map((item) => (
                <div key={item.key}>
                    <div className={`${STYLES.label} mb-0.5`}>
                        {item.label}
                    </div>
                    <div className={`text-xs font-medium ${
                        item.type === 'status' && item.color ?
                        item.color :
                        STYLES.value.replace('text-xs font-medium ', '')
                    }`}>
                        {item.value}
                    </div>
                </div>
            ))}
        </div>
    )
}



interface BeanDetailModalProps {
    isOpen: boolean
    bean: ExtendedCoffeeBean | null
    onClose: () => void
    searchQuery?: string
    onEdit?: (bean: ExtendedCoffeeBean) => void
    onDelete?: (bean: ExtendedCoffeeBean) => void
    onShare?: (bean: ExtendedCoffeeBean) => void
}

const BeanDetailModal: React.FC<BeanDetailModalProps> = ({
    isOpen,
    bean,
    onClose,
    searchQuery = '',
    onEdit,
    onDelete,
    onShare
}) => {
    const [imageError, setImageError] = useState(false)
    const [relatedNotes, setRelatedNotes] = useState<BrewingNote[]>([])
    const [isLoadingNotes, setIsLoadingNotes] = useState(false)
    const [equipmentNames, setEquipmentNames] = useState<Record<string, string>>({})

    // 重置图片错误状态
    useEffect(() => {
        if (bean?.image) {
            setImageError(false)
        }
    }, [bean?.image])

    // 工具函数：格式化数字显示
    const formatNumber = (value: string | undefined): string =>
        !value ? '0' : (Number.isInteger(parseFloat(value)) ? Math.floor(parseFloat(value)).toString() : value)

    // 工具函数：格式化日期显示
    const formatDateString = (dateStr: string): string => {
        try {
            const timestamp = parseDateToTimestamp(dateStr)
            const date = new Date(timestamp)
            return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`
        } catch {
            return dateStr
        }
    }

    // 工具函数：计算赏味期信息
    const getFlavorInfo = () => {
        if (!bean) return { phase: '未知', status: '加载中...' }
        if (bean.isInTransit) return { phase: '在途', status: '在途中' }
        if (bean.isFrozen) return { phase: '冰冻', status: '冰冻保存' }
        if (!bean.roastDate) return { phase: '未知', status: '未设置烘焙日期' }

        const today = new Date()
        const roastTimestamp = parseDateToTimestamp(bean.roastDate)
        const roastDate = new Date(roastTimestamp)
        const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate())
        const roastDateOnly = new Date(roastDate.getFullYear(), roastDate.getMonth(), roastDate.getDate())
        const daysSinceRoast = Math.ceil((todayDate.getTime() - roastDateOnly.getTime()) / (1000 * 60 * 60 * 24))

        let startDay = bean.startDay || 0
        let endDay = bean.endDay || 0

        if (startDay === 0 && endDay === 0) {
            if (bean.roastLevel?.includes('浅')) {
                startDay = 7; endDay = 30
            } else if (bean.roastLevel?.includes('深')) {
                startDay = 14; endDay = 60
            } else {
                startDay = 10; endDay = 30
            }
        }

        if (daysSinceRoast < startDay) {
            return { phase: '养豆期', status: `还需养豆 ${startDay - daysSinceRoast} 天` }
        } else if (daysSinceRoast <= endDay) {
            return { phase: '赏味期', status: `剩余 ${endDay - daysSinceRoast} 天` }
        } else {
            return { phase: '衰退期', status: '已过赏味期' }
        }
    }

    // 工具函数：生成基础信息项
    const getBasicInfoItems = (): InfoItem[] => {
        const items: InfoItem[] = []
        const flavorInfo = getFlavorInfo()

        // 库存信息
        if (bean?.capacity && bean?.remaining) {
            items.push({
                key: 'inventory',
                label: '库存',
                value: `${formatNumber(bean.remaining)}g`,
                type: 'normal'
            })
        }

        // 价格信息
        if (bean?.price) {
            items.push({
                key: 'price',
                label: '价格',
                value: `¥${bean.price}`,
                type: 'normal'
            })
        }

        // 烘焙日期/状态
        if (bean?.isInTransit) {
            items.push({
                key: 'roastDate',
                label: '状态',
                value: '在途',
                type: 'status',
                color: 'text-blue-600 dark:text-blue-400'
            })
        } else if (bean?.roastDate) {
            items.push({
                key: 'roastDate',
                label: '烘焙日期',
                value: formatDateString(bean.roastDate),
                type: 'normal'
            })
        }

        // 赏味期/状态
        if (bean?.isFrozen) {
            items.push({
                key: 'flavor',
                label: '状态',
                value: '冰冻',
                type: 'status',
                color: 'text-cyan-600 dark:text-cyan-400'
            })
        } else if (bean?.roastDate && !bean?.isInTransit) {
            items.push({
                key: 'flavor',
                label: '赏味期',
                value: flavorInfo.status,
                type: 'normal'
            })
        }

        return items
    }

    // 工具函数：检查是否有拼配组件
    const hasBlendComponents = (): boolean => {
        return !!(bean?.blendComponents && Array.isArray(bean.blendComponents) && bean.blendComponents.length > 0)
    }

    // 工具函数：从拼配组件中提取并去重字段值
    const extractFromBlendComponents = (field: 'origin' | 'process' | 'variety'): string[] => {
        if (!hasBlendComponents() || !bean?.blendComponents) return []

        return Array.from(new Set(
            bean.blendComponents
                .map(comp => comp[field])
                .filter((value): value is string =>
                    value !== undefined && value !== null && value.trim() !== ''
                )
        ))
    }

    // 工具函数：创建信息项
    const createInfoItem = (
        key: string,
        label: string,
        blendField: 'origin' | 'process' | 'variety',
        fallbackValue?: string,
        enableHighlight = false
    ): InfoItem | null => {
        if (hasBlendComponents()) {
            const values = extractFromBlendComponents(blendField)
            if (values.length === 0) return null

            const text = values.join(', ')
            return {
                key,
                label,
                value: enableHighlight && searchQuery ? (
                    <HighlightText text={text} highlight={searchQuery} />
                ) : text
            }
        } else if (fallbackValue) {
            return {
                key,
                label,
                value: enableHighlight && searchQuery ? (
                    <HighlightText text={fallbackValue} highlight={searchQuery} />
                ) : fallbackValue
            }
        }
        return null
    }

    // 工具函数：生成产地信息项
    const getOriginInfoItems = (): InfoItem[] => {
        const items: InfoItem[] = []

        // 产地信息
        const originItem = createInfoItem('origin', '产地', 'origin', bean?.origin, true)
        if (originItem) items.push(originItem)

        // 处理法信息
        const processItem = createInfoItem('process', '处理法', 'process', bean?.process)
        if (processItem) items.push(processItem)

        // 品种信息
        const varietyItem = createInfoItem('variety', '品种', 'variety', bean?.variety)
        if (varietyItem) items.push(varietyItem)

        // 烘焙度
        if (bean?.roastLevel) {
            items.push({
                key: 'roastLevel',
                label: '烘焙度',
                value: bean.roastLevel
            })
        }

        return items
    }

    // 渲染快捷扣除记录
    const renderQuickDecrementNote = (note: BrewingNote) => {
        const amount = note.quickDecrementAmount || 0
        return (
            <div key={note.id} className={`flex items-center justify-between py-1.5 px-2 ${STYLES.bgLighter} border border-neutral-200/30 dark:border-neutral-800/30`}>
                <div className="flex items-center gap-2">
                    <div className={STYLES.value}>
                        {bean?.name || '咖啡豆'}
                    </div>
                    <div className={`${STYLES.value} bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded-xs ${STYLES.muted.replace('text-xs ', '')}`}>
                        -{amount}g
                    </div>
                </div>
                <div className={STYLES.muted}>
                    {formatDate(note.timestamp)}
                </div>
            </div>
        )
    }

    // 渲染普通冲煮记录
    const renderBrewingNote = (note: BrewingNote) => {
        const equipmentName = note.equipment ? (equipmentNames[note.equipment] || note.equipment) : '未知器具'
        const hasNotes = note.notes && note.notes.trim()
        const displayTitle = note.method && note.method.trim() !== '' ? note.method : equipmentName

        return (
            <div key={note.id} className={`p-2 ${STYLES.bgLight} border ${STYLES.border} space-y-1.5`}>
                {/* 标题行 */}
                <div className="flex justify-between items-center">
                    <div className="flex-1 min-w-0">
                        <div className={`${STYLES.value} truncate`}>
                            {displayTitle}
                        </div>
                    </div>
                    <div className={`${STYLES.muted} ml-2`}>
                        {formatDate(note.timestamp)}
                    </div>
                </div>

                {/* 参数行 */}
                {note.params && (
                    <div className={STYLES.muted}>
                        {note.params.coffee} · {note.params.ratio}
                        {(note.params.grindSize || note.params.temp) && (
                            <span> · {[note.params.grindSize, note.params.temp].filter(Boolean).join(' · ')}</span>
                        )}
                    </div>
                )}

                {/* 评分行 */}
                <div className="flex justify-between items-center">
                    <div className={STYLES.muted}>总体评分</div>
                    <div className={STYLES.muted}>{formatRating(note.rating)}</div>
                </div>

                {/* 备注信息 */}
                {hasNotes && (
                    <div className={`${STYLES.muted} whitespace-pre-line leading-tight`}>
                        {note.notes}
                    </div>
                )}
            </div>
        )
    }

    // 渲染拼配组件
    const renderBlendComponents = () => (
        <div>
            <div className={`${STYLES.label} mb-1.5`}>拼配成分</div>
            <div className="grid gap-3 grid-cols-2">
                {bean!.blendComponents!.map((comp: any, index: number) => {
                    const parts = [comp.origin, comp.variety, comp.process].filter(Boolean)
                    const displayText = parts.length > 0 ? parts.join(' · ') : `组成 ${index + 1}`

                    return (
                        <div key={index} className="flex items-center gap-2">
                            <span className={STYLES.value}>
                                {displayText}
                            </span>
                            {comp.percentage !== undefined && comp.percentage !== null && (
                                <span className={`${STYLES.value} ${STYLES.muted.replace('text-xs ', '')}`}>
                                    {comp.percentage}%
                                </span>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )

    // 渲染风味标签
    const renderFlavorTags = () => (
        <div>
            <div className={`${STYLES.label} mb-1.5`}>风味</div>
            <div className="flex flex-wrap gap-1">
                {bean!.flavor!.map((flavor: any, index: number) => (
                    <span
                        key={index}
                        className="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-700/50 text-xs text-neutral-700 dark:text-neutral-300"
                    >
                        {flavor}
                    </span>
                ))}
            </div>
        </div>
    )

    // 渲染备注
    const renderNotes = () => (
        <div>
            <div className={`${STYLES.label} mb-1.5`}>备注</div>
            <div className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed whitespace-pre-line">
                {searchQuery ? (
                    <HighlightText
                        text={bean!.notes!}
                        highlight={searchQuery}
                        className="text-neutral-700 dark:text-neutral-300"
                    />
                ) : (
                    bean!.notes
                )}
            </div>
        </div>
    )

    // 判断是否为简单的快捷扣除记录
    const isSimpleQuickDecrementNote = (note: BrewingNote): boolean => {
        return !!(note.source === 'quick-decrement' &&
            !(note.taste && Object.values(note.taste).some(value => value > 0)) &&
            note.rating === 0 &&
            (!note.method || note.method.trim() === '') &&
            (!note.equipment || note.equipment.trim() === '' || note.equipment === '未指定') &&
            !note.image &&
            note.notes && /^快捷扣除\d+g咖啡豆/.test(note.notes))
    }

    // 获取相关的冲煮记录
    useEffect(() => {
        const loadRelatedNotes = async () => {
            if (!bean?.id || !isOpen) {
                setRelatedNotes([])
                return
            }

            setIsLoadingNotes(true)
            try {
                const { Storage } = await import('@/lib/core/storage');
                const notesStr = await Storage.get('brewingNotes')
                if (!notesStr) {
                    setRelatedNotes([])
                    return
                }

                const allNotes: BrewingNote[] = JSON.parse(notesStr)

                // 过滤出与当前咖啡豆相关的记录
                const beanNotes = allNotes.filter(note =>
                    note.beanId === bean.id ||
                    note.coffeeBeanInfo?.name === bean.name
                )

                // 按时间倒序排列，只取最近的5条记录
                const sortedNotes = beanNotes
                    .sort((a, b) => b.timestamp - a.timestamp)
                    .slice(0, 5)

                // 获取所有设备的名称
                const equipmentIds = Array.from(new Set(
                    sortedNotes
                        .map(note => note.equipment)
                        .filter((equipment): equipment is string => !!equipment)
                ))

                const namesMap: Record<string, string> = {}
                await Promise.all(
                    equipmentIds.map(async (equipmentId) => {
                        try {
                            const name = await getEquipmentName(equipmentId)
                            namesMap[equipmentId] = name
                        } catch (error) {
                            console.error(`获取设备名称失败: ${equipmentId}`, error)
                            namesMap[equipmentId] = equipmentId
                        }
                    })
                )

                setEquipmentNames(namesMap)
                setRelatedNotes(sortedNotes)
            } catch (error) {
                console.error('加载冲煮记录失败:', error)
                setRelatedNotes([])
            } finally {
                setIsLoadingNotes(false)
            }
        }

        loadRelatedNotes()
    }, [bean?.id, bean?.name, isOpen])

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            onClose()
        }
    }

    return (
        <Drawer open={isOpen} onOpenChange={handleOpenChange}>
            <DrawerContent className="max-h-[85vh]">
                <DrawerDescription id="drawer-description" className="sr-only">
                    咖啡豆详情信息，包含基本信息、产地信息、风味描述和相关冲煮记录
                </DrawerDescription>
                <DrawerHeader className="border-b border-neutral-200/60 dark:border-neutral-800/40 shrink-0 px-4 py-3">
                    <div className="relative flex items-center justify-between">
                        {/* 左侧按钮 */}
                        <div className="flex items-center">
                            {bean && onEdit && (
                                <button
                                    onClick={() => {
                                        onEdit(bean)
                                        onClose()
                                    }}
                                    className="text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors px-2 py-1"
                                >
                                    编辑
                                </button>
                            )}
                        </div>

                        {/* 绝对居中的标题 */}
                        <DrawerTitle className="absolute left-1/2 transform -translate-x-1/2 text-base font-medium text-neutral-800 dark:text-neutral-100 leading-tight max-w-[50%]">
                            <div className="truncate text-center">
                                {searchQuery ? (
                                    <HighlightText
                                        text={bean?.name || '未命名'}
                                        highlight={searchQuery}
                                    />
                                ) : (
                                    bean?.name || '未命名'
                                )}
                            </div>
                        </DrawerTitle>

                        {/* 右侧按钮 */}
                        <div className="flex items-center gap-2">
                            {bean && onShare && (
                                <button
                                    onClick={() => {
                                        onShare(bean)
                                        onClose()
                                    }}
                                    className="text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors px-2 py-1"
                                >
                                    分享
                                </button>
                            )}
                            {bean && onDelete && (
                                <button
                                    onClick={() => {
                                        onDelete(bean)
                                        onClose()
                                    }}
                                    className="text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors px-2 py-1"
                                >
                                    删除
                                </button>
                            )}
                        </div>
                    </div>
                </DrawerHeader>

                {bean ? (
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-safe-bottom">
                        {/* 顶部核心信息区域 - 图片与基础信息横向排列 */}
                        <div className="flex gap-4 pb-3 border-b border-neutral-200/40 dark:border-neutral-800/40">
                            {/* 图片 */}
                            {bean.image && (
                                <div className="w-16 h-16 relative border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 overflow-hidden flex-shrink-0">
                                    {imageError ? (
                                        <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-500 dark:text-neutral-400">
                                            失败
                                        </div>
                                    ) : (
                                        <Image
                                            src={bean.image}
                                            alt={bean.name || '咖啡豆图片'}
                                            fill
                                            className="object-cover"
                                            onError={() => setImageError(true)}
                                        />
                                    )}
                                </div>
                            )}

                            {/* 核心信息 */}
                            <div className="flex-1 min-w-0">
                                <InfoGrid items={getBasicInfoItems()} />
                            </div>
                        </div>

                        {/* 详细信息区域 - 更紧凑的布局，拼配豆不显示汇总信息 */}
                        {getOriginInfoItems().length > 0 && !hasBlendComponents() && (
                            <div className="space-y-2">
                                <InfoGrid items={getOriginInfoItems()} />
                            </div>
                        )}

                        {/* 拼配、风味、备注 - 合并为一个紧凑区域 */}
                        {(hasBlendComponents() || (bean.flavor && bean.flavor.length > 0) || bean.notes) && (
                            <div className="space-y-3">
                                {/* 拼配信息 */}
                                {hasBlendComponents() && renderBlendComponents()}

                                {/* 风味标签 */}
                                {bean.flavor && bean.flavor.length > 0 && renderFlavorTags()}

                                {/* 备注 */}
                                {bean.notes && renderNotes()}
                            </div>
                        )}

                        {/* 相关冲煮记录 - 简化布局 */}
                        <div className="border-t border-neutral-200/40 dark:border-neutral-800/40 pt-3">
                            <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
                                冲煮记录 {relatedNotes.length > 0 && `(${relatedNotes.length})`}
                            </div>

                            {isLoadingNotes ? (
                                <div className="text-xs text-neutral-500 dark:text-neutral-400">
                                    加载中...
                                </div>
                            ) : relatedNotes.length === 0 ? (
                                <div className="text-xs text-neutral-500 dark:text-neutral-400">
                                    暂无冲煮记录
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {relatedNotes.map((note) =>
                                        isSimpleQuickDecrementNote(note) ?
                                            renderQuickDecrementNote(note) :
                                            renderBrewingNote(note)
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center p-4">
                        <div className="text-sm text-muted-foreground">
                            加载中...
                        </div>
                    </div>
                )}
            </DrawerContent>
        </Drawer>
    )
}

export default BeanDetailModal
