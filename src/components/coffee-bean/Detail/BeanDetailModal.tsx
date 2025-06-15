'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { ExtendedCoffeeBean } from '@/types/app'
import { BrewingNote } from '@/lib/core/config'
import { parseDateToTimestamp } from '@/lib/utils/dateUtils'
import HighlightText from '@/components/common/ui/HighlightText'
import { getEquipmentName } from '@/components/notes/utils'
import { formatDate } from '@/components/notes/utils'

// 动态导入 ImageViewer 组件
const ImageViewer = dynamic(() => import('@/components/common/ui/ImageViewer'), {
    ssr: false
})
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerDescription,
} from '@/components/ui/drawer'
import ActionMenu from '@/components/coffee-bean/ui/action-menu'



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
                    <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5">
                        {item.label}
                    </div>
                    <div className={`text-xs font-medium ${
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
    // 图片查看器状态
    const [imageViewerOpen, setImageViewerOpen] = useState(false)
    const [currentImageUrl, setCurrentImageUrl] = useState('')
    const [noteImageErrors, setNoteImageErrors] = useState<Record<string, boolean>>({})

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
        return !!(bean?.blendComponents && Array.isArray(bean.blendComponents) && bean.blendComponents.length > 1)
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
        // 如果是真正的拼配豆（多个组件），从拼配组件中提取信息
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
        } else {
            // 对于非拼配豆，优先从blendComponents[0]获取信息，然后才是fallbackValue
            let value: string | undefined

            if (bean?.blendComponents && bean.blendComponents.length === 1) {
                // 单一组件的情况，从blendComponents[0]获取信息
                value = bean.blendComponents[0][blendField]
            }

            // 如果blendComponents中没有信息，使用fallbackValue
            if (!value || value.trim() === '') {
                value = fallbackValue
            }

            if (value && value.trim() !== '') {
                return {
                    key,
                    label,
                    value: enableHighlight && searchQuery ? (
                        <HighlightText text={value} highlight={searchQuery} />
                    ) : value
                }
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
        <>
        <Drawer open={isOpen} onOpenChange={handleOpenChange}>
            <DrawerContent className="max-h-[85vh]">
                <DrawerDescription id="drawer-description" className="sr-only">
                    咖啡豆详情信息，包含基本信息、产地信息、风味描述和相关冲煮记录
                </DrawerDescription>
                <DrawerHeader className="border-b border-neutral-200/60 dark:border-neutral-800/40 shrink-0 px-4 py-3">
                    <div className="relative flex items-center justify-between">
                        <div className="flex items-center">
                            <button
                                onClick={onClose}
                                className="text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors px-2 py-1"
                            />
                        </div>

                        <DrawerTitle className="absolute left-1/2 transform -translate-x-1/2 text-base font-medium text-neutral-800 dark:text-neutral-100 leading-tight max-w-[50%]">
                            <div className="truncate text-center">
                                {searchQuery ? (
                                    <HighlightText text={bean?.name || '未命名'} highlight={searchQuery} />
                                ) : (bean?.name || '未命名')}
                            </div>
                        </DrawerTitle>

                        <div className="flex items-center">
                            {bean && (onEdit || onShare || onDelete) && (
                                <ActionMenu
                                    items={[
                                        ...(onEdit ? [{ id: 'edit', label: '编辑', onClick: () => { onEdit(bean); onClose(); }, color: 'default' as const }] : []),
                                        ...(onShare ? [{ id: 'share', label: '分享', onClick: () => { onShare(bean); onClose(); }, color: 'default' as const }] : []),
                                        ...(onDelete ? [{ id: 'delete', label: '删除', onClick: () => { onDelete(bean); onClose(); }, color: 'danger' as const }] : [])
                                    ]}
                                    triggerClassName="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                                />
                            )}
                        </div>
                    </div>
                </DrawerHeader>

                {bean ? (
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-safe-bottom">
                        <div className="flex gap-4 pb-3 border-b border-neutral-200/40 dark:border-neutral-800/40">
                            {bean.image && (
                                <div className="w-16 h-16 relative rounded border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 overflow-hidden flex-shrink-0">
                                    {imageError ? (
                                        <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-500 dark:text-neutral-400">失败</div>
                                    ) : (
                                        <Image src={bean.image} alt={bean.name || '咖啡豆图片'} fill className="object-cover" onError={() => setImageError(true)} />
                                    )}
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <InfoGrid items={getBasicInfoItems()} />
                            </div>
                        </div>

                        {getOriginInfoItems().length > 0 && !hasBlendComponents() && (
                            <div className="space-y-2">
                                <InfoGrid items={getOriginInfoItems()} />
                            </div>
                        )}

                        {(hasBlendComponents() || (bean.flavor && bean.flavor.length > 0) || bean.notes) && (
                            <div className="space-y-3">
                                {hasBlendComponents() && (
                                    <div>
                                        <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1.5">拼配成分</div>
                                        <div className="grid gap-3 grid-cols-2">
                                            {bean.blendComponents!.map((comp: any, index: number) => {
                                                const parts = [comp.origin, comp.variety, comp.process].filter(Boolean)
                                                const displayText = parts.length > 0 ? parts.join(' · ') : `组成 ${index + 1}`

                                                return (
                                                    <div key={index} className="flex items-center gap-2">
                                                        <span className="text-xs font-medium text-neutral-800 dark:text-neutral-100">{displayText}</span>
                                                        {comp.percentage !== undefined && comp.percentage !== null && (
                                                            <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">{comp.percentage}%</span>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}

                                {bean.flavor && bean.flavor.length > 0 && (
                                    <div>
                                        <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1.5">风味</div>
                                        <div className="flex flex-wrap gap-1">
                                            {bean.flavor.map((flavor: any, index: number) => (
                                                <span key={index} className="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-700/50 text-xs text-neutral-700 dark:text-neutral-300">
                                                    {flavor}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {bean.notes && (
                                    <div>
                                        <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1.5">备注</div>
                                        <div className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed whitespace-pre-line">
                                            {searchQuery ? (
                                                <HighlightText text={bean.notes} highlight={searchQuery} className="text-neutral-700 dark:text-neutral-300" />
                                            ) : bean.notes}
                                        </div>
                                    </div>
                                )}
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
                                    {relatedNotes.map((note) => {
                                        const isQuickDecrement = isSimpleQuickDecrementNote(note)

                                        return (
                                            <div key={note.id} className="p-2 bg-neutral-100 dark:bg-neutral-700/50 border border-neutral-200/30 dark:border-neutral-800/30 rounded">
                                                {isQuickDecrement ? (
                                                    // 快捷扣除记录
                                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                                        {/* 咖啡豆名称 */}
                                                        <div className="text-xs font-medium truncate text-neutral-800 dark:text-neutral-100">
                                                            {bean?.name || '咖啡豆'}
                                                        </div>

                                                        {/* 扣除量 */}
                                                        <div className="text-xs font-medium bg-neutral-100 dark:bg-neutral-800 px-2 py-px rounded-xs text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                                                            -{note.quickDecrementAmount || 0}g
                                                        </div>

                                                        {/* 日期 */}
                                                        <div className="text-xs font-medium tracking-wide text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                                                            {formatDate(note.timestamp)}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    // 普通冲煮记录
                                                    <div className="space-y-3">
                                                        {/* 图片和基本信息区域 */}
                                                        <div className="flex gap-4">
                                                            {/* 笔记图片 - 只在有图片时显示 */}
                                                            {note.image && (
                                                                <div
                                                                    className="h-14 overflow-hidden shrink-0 relative cursor-pointer border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (!noteImageErrors[note.id] && note.image) {
                                                                            setCurrentImageUrl(note.image);
                                                                            setImageViewerOpen(true);
                                                                        }
                                                                    }}
                                                                >
                                                                    {noteImageErrors[note.id] ? (
                                                                        <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-500 dark:text-neutral-400">
                                                                            加载失败
                                                                        </div>
                                                                    ) : (
                                                                        <Image
                                                                            src={note.image}
                                                                            alt={bean?.name || '笔记图片'}
                                                                            height={56}
                                                                            width={56}
                                                                            unoptimized
                                                                            style={{ width: 'auto', height: '100%' }}
                                                                            className="object-cover"
                                                                            sizes="56px"
                                                                            priority={false}
                                                                            loading="lazy"
                                                                            onError={() => setNoteImageErrors(prev => ({ ...prev, [note.id]: true }))}
                                                                        />
                                                                    )}
                                                                </div>
                                                            )}

                                                            {/* 内容区域 */}
                                                            <div className="flex-1 min-w-0 space-y-3">
                                                                {/* 标题和参数信息 */}
                                                                <div className="space-y-1">
                                                                    {/* 标题行 - 复杂的显示逻辑 */}
                                                                    <div className="text-xs font-medium text-neutral-800 dark:text-neutral-100 leading-tight">
                                                                        {note.method && note.method.trim() !== '' ? (
                                                                            // 有方案时的显示逻辑
                                                                            bean?.name ? (
                                                                                <>
                                                                                    {bean.name}
                                                                                    <span className="text-neutral-600 dark:text-neutral-400 mx-1">·</span>
                                                                                    <span className="text-neutral-600 dark:text-neutral-400">{note.method}</span>
                                                                                </>
                                                                            ) : (
                                                                                <>
                                                                                    {note.equipment ? (equipmentNames[note.equipment] || note.equipment) : '未知器具'}
                                                                                    <span className="text-neutral-600 dark:text-neutral-400 mx-1">·</span>
                                                                                    <span className="text-neutral-600 dark:text-neutral-400">{note.method}</span>
                                                                                </>
                                                                            )
                                                                        ) : (
                                                                            // 没有方案时的显示逻辑
                                                                            bean?.name ? (
                                                                                bean.name === (note.equipment ? (equipmentNames[note.equipment] || note.equipment) : '未知器具') ? (
                                                                                    bean.name
                                                                                ) : (
                                                                                    <>
                                                                                        {bean.name}
                                                                                        <span className="text-neutral-600 dark:text-neutral-400 mx-1">·</span>
                                                                                        <span className="text-neutral-600 dark:text-neutral-400">{note.equipment ? (equipmentNames[note.equipment] || note.equipment) : '未知器具'}</span>
                                                                                    </>
                                                                                )
                                                                            ) : (
                                                                                note.equipment ? (equipmentNames[note.equipment] || note.equipment) : '未知器具'
                                                                            )
                                                                        )}
                                                                    </div>

                                                                    {/* 方案信息 - 只在有方案时显示 */}
                                                                    {note.params && note.method && note.method.trim() !== '' && (
                                                                        <div className="text-xs font-medium tracking-wide text-neutral-600 dark:text-neutral-400 space-x-1 leading-relaxed">
                                                                            {bean?.name && (
                                                                                <>
                                                                                    <span>{note.equipment ? (equipmentNames[note.equipment] || note.equipment) : '未知器具'}</span>
                                                                                    <span>·</span>
                                                                                </>
                                                                            )}
                                                                            <span>{note.params.coffee}</span>
                                                                            <span>·</span>
                                                                            <span>{note.params.ratio}</span>
                                                                            {(note.params.grindSize || note.params.temp) && (
                                                                                <>
                                                                                    <span>·</span>
                                                                                    <span>{[note.params.grindSize, note.params.temp].filter(Boolean).join(' · ')}</span>
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* 风味评分 - 只有当存在有效评分(大于0)时才显示 */}
                                                                {Object.values(note.taste).some(value => value > 0) ? (
                                                                    <div className="grid grid-cols-2 gap-4">
                                                                        {Object.entries(note.taste)
                                                                            .map(([key, value], _i) => (
                                                                                <div key={key} className="space-y-1">
                                                                                    <div className="flex items-center justify-between">
                                                                                        <div className="text-xs font-medium tracking-wide text-neutral-600 dark:text-neutral-400">
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
                                                                                        <div className="text-xs font-medium tracking-wide text-neutral-600 dark:text-neutral-400">
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
                                                                ) : (
                                                                    // 没有风味评分时显示总体评分
                                                                    <div className="space-y-1">
                                                                        <div className="flex items-center justify-between">
                                                                            <div className="text-xs font-medium tracking-wide text-neutral-600 dark:text-neutral-400">
                                                                                总体评分
                                                                            </div>
                                                                            <div className="text-xs font-medium tracking-wide text-neutral-600 dark:text-neutral-400">
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
                                                                )}

                                                                {/* 时间和评分 */}
                                                                {Object.values(note.taste).some(value => value > 0) ? (
                                                                    <div className="flex items-baseline justify-between">
                                                                        <div className="text-xs font-medium tracking-wide text-neutral-600 dark:text-neutral-400">
                                                                            {formatDate(note.timestamp)}
                                                                        </div>
                                                                        <div className="text-xs font-medium tracking-wide text-neutral-600 dark:text-neutral-400">
                                                                            {note.rating}/5
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-xs font-medium tracking-wide text-neutral-600 dark:text-neutral-400">
                                                                        {formatDate(note.timestamp)}
                                                                    </div>
                                                                )}

                                                                {/* 备注信息 */}
                                                                {note.notes && note.notes.trim() && (
                                                                    <div className="text-xs font-medium tracking-wide text-neutral-600 dark:text-neutral-400 whitespace-pre-line leading-tight break-words overflow-wrap-anywhere">
                                                                        {note.notes}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
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

        {/* 图片查看器 */}
        {currentImageUrl && imageViewerOpen && (
            <ImageViewer
                isOpen={imageViewerOpen}
                imageUrl={currentImageUrl}
                alt="笔记图片"
                onClose={() => {
                    setImageViewerOpen(false)
                    setCurrentImageUrl('')
                }}
            />
        )}
    </>
    )
}

export default BeanDetailModal
