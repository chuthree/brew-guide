'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import { ExtendedCoffeeBean } from '@/types/app'
import { BrewingNote } from '@/lib/core/config'
import { parseDateToTimestamp } from '@/lib/utils/dateUtils'
import HighlightText from '@/components/common/ui/HighlightText'
import { Storage } from '@/lib/core/storage'
import { getEquipmentName } from '@/components/notes/utils'
import { formatDate, formatRating } from '@/components/notes/utils'
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer'

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
        <div className={`grid gap-4 ${gridCols} ${className}`}>
            {items.map((item) => (
                <div key={item.key}>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                        {item.label}
                    </div>
                    <div className={`text-sm font-medium ${
                        item.type === 'status' && item.color ?
                        item.color :
                        'text-neutral-800 dark:text-neutral-100'
                    }`}>
                        {item.value}
                    </div>
                </div>
            ))}
        </div>
    )
}

// 信息区域组件
const InfoSection: React.FC<{
    title: string
    items: InfoItem[]
    className?: string
}> = ({ title, items, className = '' }) => {
    if (items.length === 0) return null

    return (
        <div className={`py-3 border-b border-neutral-200/40 dark:border-neutral-800/40 ${className}`}>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">{title}</div>
            <InfoGrid items={items} />
        </div>
    )
}

interface BeanDetailModalProps {
    isOpen: boolean
    bean: ExtendedCoffeeBean | null
    onClose: () => void
    searchQuery?: string
}

const BeanDetailModal: React.FC<BeanDetailModalProps> = ({
    isOpen,
    bean,
    onClose,
    searchQuery = ''
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

    // 工具函数：生成产地信息项
    const getOriginInfoItems = (): InfoItem[] => {
        const items: InfoItem[] = []

        // 处理产地信息
        if (bean?.blendComponents && Array.isArray(bean.blendComponents) && bean.blendComponents.length > 0) {
            // 从blendComponents中提取产地信息
            const origins = bean.blendComponents
                .map(comp => comp.origin)
                .filter((origin): origin is string => origin !== undefined && origin !== null && origin.trim() !== '')

            if (origins.length > 0) {
                const uniqueOrigins = Array.from(new Set(origins))
                items.push({
                    key: 'origin',
                    label: '产地',
                    value: searchQuery ? (
                        <HighlightText text={uniqueOrigins.join(', ')} highlight={searchQuery} />
                    ) : uniqueOrigins.join(', ')
                })
            }
        } else if (bean?.origin) {
            // 兼容旧数据格式
            items.push({
                key: 'origin',
                label: '产地',
                value: searchQuery ? (
                    <HighlightText text={bean.origin} highlight={searchQuery} />
                ) : bean.origin
            })
        }

        // 处理处理法信息
        if (bean?.blendComponents && Array.isArray(bean.blendComponents) && bean.blendComponents.length > 0) {
            // 从blendComponents中提取处理法信息
            const processes = bean.blendComponents
                .map(comp => comp.process)
                .filter((process): process is string => process !== undefined && process !== null && process.trim() !== '')

            if (processes.length > 0) {
                const uniqueProcesses = Array.from(new Set(processes))
                items.push({
                    key: 'process',
                    label: '处理法',
                    value: uniqueProcesses.join(', ')
                })
            }
        } else if (bean?.process) {
            // 兼容旧数据格式
            items.push({
                key: 'process',
                label: '处理法',
                value: bean.process
            })
        }

        // 处理品种信息
        if (bean?.blendComponents && Array.isArray(bean.blendComponents) && bean.blendComponents.length > 0) {
            // 从blendComponents中提取品种信息
            const varieties = bean.blendComponents
                .map(comp => comp.variety)
                .filter((variety): variety is string => variety !== undefined && variety !== null && variety.trim() !== '')

            if (varieties.length > 0) {
                const uniqueVarieties = Array.from(new Set(varieties))
                items.push({
                    key: 'variety',
                    label: '品种',
                    value: uniqueVarieties.join(', ')
                })
            }
        } else if (bean?.variety) {
            // 兼容旧数据格式
            items.push({
                key: 'variety',
                label: '品种',
                value: bean.variety
            })
        }

        if (bean?.roastLevel) {
            items.push({
                key: 'roastLevel',
                label: '烘焙度',
                value: bean.roastLevel
            })
        }

        return items
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
                <DrawerHeader className="border-b border-neutral-200/60 dark:border-neutral-800/40 shrink-0 px-4 py-3">
                    <DrawerTitle className="text-lg font-medium text-center">
                        {searchQuery ? (
                            <HighlightText
                                text={bean?.name || '未命名'}
                                highlight={searchQuery}
                            />
                        ) : (
                            bean?.name || '未命名'
                        )}
                    </DrawerTitle>
                </DrawerHeader>

                {bean ? (
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {/* 图片区域 */}
                        {bean.image && (
                            <div className="flex items-center justify-center pb-3 border-b border-neutral-200/60 dark:border-neutral-800/40">
                                <div className="w-20 h-20 relative border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
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
                            </div>
                        )}

                        <InfoGrid items={getBasicInfoItems()} className="py-3 border-b border-neutral-200/40 dark:border-neutral-800/40" />

                        <InfoSection title="产地信息" items={getOriginInfoItems()} />

                        {/* 拼配信息 */}
                        {bean.blendComponents && bean.blendComponents.length > 1 && (
                            <div className="py-3 border-b border-neutral-200/40 dark:border-neutral-800/40">
                                <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">拼配组成</div>
                                <div className="space-y-1">
                                    {bean.blendComponents.map((comp: any, index: number) => (
                                        <div key={index} className="flex justify-between items-center py-1">
                                            <div className="flex-1 min-w-0">
                                                <span className="text-sm text-neutral-800 dark:text-neutral-100 truncate">
                                                    {comp.origin || `组成 ${index + 1}`}
                                                </span>
                                            </div>
                                            {comp.percentage !== undefined && comp.percentage !== null && (
                                                <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400 ml-2">
                                                    {comp.percentage}%
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 风味标签 */}
                        {bean.flavor && bean.flavor.length > 0 && (
                            <div className="py-3 border-b border-neutral-200/40 dark:border-neutral-800/40">
                                <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">风味</div>
                                <div className="flex flex-wrap gap-1">
                                    {bean.flavor.map((flavor: any, index: number) => (
                                        <span
                                            key={index}
                                            className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-700/50 text-xs text-neutral-700 dark:text-neutral-300"
                                        >
                                            {flavor}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 备注 */}
                        {bean.notes && (
                            <div className="py-3 border-b border-neutral-200/40 dark:border-neutral-800/40">
                                <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">备注</div>
                                <div className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
                                    {searchQuery ? (
                                        <HighlightText
                                            text={bean.notes}
                                            highlight={searchQuery}
                                            className="text-neutral-700 dark:text-neutral-300"
                                        />
                                    ) : (
                                        bean.notes
                                    )}
                                </div>
                            </div>
                        )}

                        {/* 相关冲煮记录 */}
                        <div className="py-3">
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
                                <div className="space-y-3">
                                    {relatedNotes.map((note) => {
                                        // 获取咖啡豆名称和器具名称
                                        const beanName = note.coffeeBeanInfo?.name || bean?.name
                                        const equipmentName = note.equipment ? (equipmentNames[note.equipment] || note.equipment) : '未知器具'

                                        // 检查是否有风味评分
                                        const hasTasteRatings = note.taste && Object.values(note.taste).some(value => value > 0)

                                        // 检查是否有备注
                                        const hasNotes = note.notes && note.notes.trim()

                                        return (
                                            <div key={note.id} className="p-3 bg-neutral-50/50 dark:bg-neutral-800/30 border border-neutral-200/40 dark:border-neutral-800/40 space-y-3">
                                                {/* 标题和基本信息 */}
                                                <div className="flex justify-between items-start">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-xs font-medium text-neutral-800 dark:text-neutral-100 break-words">
                                                            {/* 根据是否有方案来决定显示内容 */}
                                                            {note.method && note.method.trim() !== '' ? (
                                                                // 有方案时的显示逻辑
                                                                beanName ? (
                                                                    <>
                                                                        {beanName}
                                                                        <span className="text-neutral-600 dark:text-neutral-400 mx-1">·</span>
                                                                        <span className="text-neutral-600 dark:text-neutral-400">{note.method}</span>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        {equipmentName}
                                                                        <span className="text-neutral-600 dark:text-neutral-400 mx-1">·</span>
                                                                        <span className="text-neutral-600 dark:text-neutral-400">{note.method}</span>
                                                                    </>
                                                                )
                                                            ) : (
                                                                // 没有方案时的显示逻辑：合并咖啡豆和器具信息
                                                                beanName ? (
                                                                    beanName === equipmentName ? (
                                                                        // 如果咖啡豆名称和器具名称相同，只显示一个
                                                                        beanName
                                                                    ) : (
                                                                        // 显示咖啡豆和器具，用分割符连接
                                                                        <>
                                                                            {beanName}
                                                                            <span className="text-neutral-600 dark:text-neutral-400 mx-1">·</span>
                                                                            <span className="text-neutral-600 dark:text-neutral-400">{equipmentName}</span>
                                                                        </>
                                                                    )
                                                                ) : (
                                                                    // 只有器具信息
                                                                    equipmentName
                                                                )
                                                            )}
                                                        </div>

                                                        {/* 方案信息 - 只在有方案时显示 */}
                                                        {note.params && note.method && note.method.trim() !== '' && (
                                                            <div className="text-xs mt-1 text-neutral-600 dark:text-neutral-400 space-x-1">
                                                                {beanName && (
                                                                    <>
                                                                        <span>{equipmentName}</span>
                                                                        <span>·</span>
                                                                    </>
                                                                )}
                                                                <span>{note.params.coffee}</span>
                                                                <span>·</span>
                                                                <span>{note.params.ratio}</span>

                                                                {/* 合并显示研磨度和水温 */}
                                                                {(note.params.grindSize || note.params.temp) && (
                                                                    <>
                                                                        <span>·</span>
                                                                        {note.params.grindSize && note.params.temp ? (
                                                                            <span>{note.params.grindSize} · {note.params.temp}</span>
                                                                        ) : (
                                                                            <span>{note.params.grindSize || note.params.temp}</span>
                                                                        )}
                                                                    </>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* 风味评分 - 只有当存在有效评分(大于0)时才显示 */}
                                                {hasTasteRatings ? (
                                                    <div className="grid grid-cols-2 gap-3">
                                                        {Object.entries(note.taste)
                                                            .map(([key, value]) => (
                                                                <div key={key} className="space-y-1">
                                                                    <div className="flex items-center justify-between">
                                                                        <div className="text-xs text-neutral-600 dark:text-neutral-400">
                                                                            {(() => {
                                                                                switch (key) {
                                                                                    case 'acidity':
                                                                                        return '酸度';
                                                                                    case 'sweetness':
                                                                                        return '甜度';
                                                                                    case 'bitterness':
                                                                                        return '苦度';
                                                                                    case 'body':
                                                                                        return '口感';
                                                                                    default:
                                                                                        return key;
                                                                                }
                                                                            })()}
                                                                        </div>
                                                                        <div className="text-xs text-neutral-600 dark:text-neutral-400">
                                                                            {value}
                                                                        </div>
                                                                    </div>
                                                                    <div className="h-px w-full overflow-hidden bg-neutral-200/50 dark:bg-neutral-800">
                                                                        <div
                                                                            style={{ width: `${value === 0 ? 0 : (value / 5) * 100}%` }}
                                                                            className="h-full bg-neutral-600 dark:bg-neutral-400"
                                                                        />
                                                                    </div>
                                                                </div>
                                                            ))}
                                                    </div>
                                                ) : null}

                                                {/* 时间和评分 */}
                                                {hasTasteRatings ? (
                                                    <div className="flex items-baseline justify-between">
                                                        <div className="text-xs text-neutral-600 dark:text-neutral-400">
                                                            {formatDate(note.timestamp)}
                                                        </div>
                                                        <div className="text-xs text-neutral-600 dark:text-neutral-400">
                                                            {formatRating(note.rating)}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-3">
                                                        <div className="space-y-1">
                                                            <div className="flex items-center justify-between">
                                                                <div className="text-xs text-neutral-600 dark:text-neutral-400">
                                                                    总体评分
                                                                </div>
                                                                <div className="text-xs text-neutral-600 dark:text-neutral-400">
                                                                    {note.rating}
                                                                </div>
                                                            </div>
                                                            <div className="h-px w-full overflow-hidden bg-neutral-200/50 dark:bg-neutral-800">
                                                                <div
                                                                    style={{ width: `${note.rating === 0 ? 0 : (note.rating / 5) * 100}%` }}
                                                                    className="h-full bg-neutral-600 dark:bg-neutral-400"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="text-xs text-neutral-600 dark:text-neutral-400">
                                                            {formatDate(note.timestamp)}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* 备注信息 */}
                                                {hasNotes && (
                                                    <div className="text-xs text-neutral-600 dark:text-neutral-400 whitespace-pre-line leading-tight">
                                                        {note.notes}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
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
