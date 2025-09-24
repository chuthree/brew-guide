'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import { CoffeeBean } from '@/types/app'
import { BrewingNote } from '@/lib/core/config'
import { parseDateToTimestamp } from '@/lib/utils/dateUtils'
import { calculateFlavorInfo } from '@/lib/utils/flavorPeriodUtils'
import HighlightText from '@/components/common/ui/HighlightText'
import { getEquipmentName } from '@/components/notes/utils'
import { formatDate, formatRating } from '@/components/notes/utils'
import ActionMenu from '@/components/coffee-bean/ui/action-menu'
import { ArrowRight } from 'lucide-react'
import { BREWING_EVENTS } from '@/lib/brewing/constants'

// 动态导入 ImageViewer 组件
const ImageViewer = dynamic(() => import('@/components/common/ui/ImageViewer'), {
    ssr: false
})

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
                    } ${item.key === 'roastDate' ? 'whitespace-pre-line' : ''}`}>
                        {item.value}
                    </div>
                </div>
            ))}
        </div>
    )
}

interface BeanDetailModalProps {
    isOpen: boolean
    bean: CoffeeBean | null
    onClose: () => void
    searchQuery?: string
    onEdit?: (bean: CoffeeBean) => void
    onDelete?: (bean: CoffeeBean) => void
    onShare?: (bean: CoffeeBean) => void
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
            const formattedDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`

            // 计算已过天数
            const today = new Date()
            const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate())
            const roastDateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
            const daysSinceRoast = Math.ceil((todayDate.getTime() - roastDateOnly.getTime()) / (1000 * 60 * 60 * 24))

            // 如果是今天或未来日期，不显示天数
            if (daysSinceRoast <= 0) {
                return formattedDate
            }

            return `${formattedDate}\n(已养豆 ${daysSinceRoast} 天)`
        } catch {
            return dateStr
        }
    }

    // 工具函数：计算赏味期信息
    const getFlavorInfo = () => {
        if (!bean) return { phase: '未知', status: '未知状态' }

        const flavorInfo = calculateFlavorInfo(bean);
        return {
            phase: flavorInfo.phase,
            status: flavorInfo.status || '未知状态'
        };
    }

    // 工具函数：生成基础信息项
    const getBasicInfoItems = (): InfoItem[] => {
        const items: InfoItem[] = []
        const flavorInfo = getFlavorInfo()

        // 容量信息 - 显示为：剩余量/总容量
        if (bean?.capacity && bean?.remaining) {
            items.push({
                key: 'inventory',
                label: '容量',
                value: `${formatNumber(bean.remaining)}/${formatNumber(bean.capacity)}克`,
                type: 'normal'
            })
        }

        // 价格信息 - 显示为：总价(克价)
        if (bean?.price && bean?.capacity) {
            const totalPrice = bean.price
            const capacityNum = parseFloat(bean.capacity)
            const priceNum = parseFloat(totalPrice)
            const pricePerGram = !isNaN(priceNum) && !isNaN(capacityNum) && capacityNum > 0
                ? (priceNum / capacityNum).toFixed(2)
                : '0.00'

            items.push({
                key: 'price',
                label: '价格',
                value: `${totalPrice}元(${pricePerGram}元/克)`,
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
                value: '冷冻',
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



    // 工具函数：创建信息项
    const createInfoItem = (
        key: string,
        label: string,
        blendField: 'origin' | 'process' | 'variety',
        enableHighlight = false
    ): InfoItem | null => {
        if (!bean?.blendComponents) return null

        // 从所有组件中提取并去重字段值
        const values = Array.from(new Set(
            bean.blendComponents
                .map((comp) => comp[blendField])
                .filter((value): value is string =>
                    typeof value === 'string' && value.trim() !== ''
                )
        ))

        if (values.length === 0) return null

        const text = values.join(', ')
        return {
            key,
            label,
            value: enableHighlight && searchQuery ? (
                <HighlightText text={text} highlight={searchQuery} />
            ) : text
        }
    }

    // 工具函数：生成产地信息项
    const getOriginInfoItems = (): InfoItem[] => {
        const items: InfoItem[] = []

        // 使用 createInfoItem 函数，避免重复逻辑
        const originItem = createInfoItem('origin', '产地', 'origin', true)
        if (originItem) items.push(originItem)

        const processItem = createInfoItem('process', '处理法', 'process')
        if (processItem) items.push(processItem)

        const varietyItem = createInfoItem('variety', '品种', 'variety')
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

    // 判断是否为简单的变动记录（快捷扣除或容量调整）
    const isSimpleChangeRecord = (note: BrewingNote): boolean => {
        const isBasicChangeRecord = !(note.taste && Object.values(note.taste).some(value => value > 0)) &&
            note.rating === 0 &&
            (!note.method || note.method.trim() === '') &&
            (!note.equipment || note.equipment.trim() === '' || note.equipment === '未指定') &&
            !note.image

        return !!(
            (note.source === 'quick-decrement' && note.notes === '快捷扣除' && isBasicChangeRecord) ||
            (note.source === 'capacity-adjustment' && note.notes === '容量调整(不计入统计)' && isBasicChangeRecord)
        )
    }

    // 获取相关的冲煮记录
    useEffect(() => {
        const loadRelatedNotes = async () => {
            if (!bean?.id || !isOpen) {
                setRelatedNotes([])
                setIsLoadingNotes(false)
                return
            }

            setIsLoadingNotes(true)
            try {
                const { Storage } = await import('@/lib/core/storage');
                const notesStr = await Storage.get('brewingNotes')
                if (!notesStr) {
                    setRelatedNotes([])
                    setIsLoadingNotes(false)
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

    // 处理关闭
    const handleClose = () => {
        onClose()
    }

    // 处理去冲煮功能
    const handleGoToBrewing = () => {
        handleClose()
        // 等待模态框关闭后再进行导航
        setTimeout(() => {
            // 先切换到冲煮标签页
            document.dispatchEvent(new CustomEvent(BREWING_EVENTS.NAVIGATE_TO_MAIN_TAB, {
                detail: { tab: '冲煮' }
            }))

            // 再切换到咖啡豆步骤
            setTimeout(() => {
                document.dispatchEvent(new CustomEvent(BREWING_EVENTS.NAVIGATE_TO_STEP, {
                    detail: { step: 'coffeeBean' }
                }))

                // 然后选择当前豆子
                if (bean) {
                    setTimeout(() => {
                        document.dispatchEvent(new CustomEvent(BREWING_EVENTS.SELECT_COFFEE_BEAN, {
                            detail: { beanName: bean.name }
                        }))
                    }, 100)
                }
            }, 100)
        }, 300)
    }

    // 处理去记录功能
    const handleGoToNotes = () => {
        handleClose()
        // 保存当前咖啡豆信息，以便笔记页面使用
        if (bean) {
            localStorage.setItem('temp:selectedBean', JSON.stringify({
                id: bean.id,
                name: bean.name,
                roastLevel: bean.roastLevel || '',
                roastDate: bean.roastDate || ''
            }))
        }

        // 等待模态框关闭后再进行导航
        setTimeout(() => {
            // 先切换到笔记标签页
            document.dispatchEvent(new CustomEvent(BREWING_EVENTS.NAVIGATE_TO_MAIN_TAB, {
                detail: { tab: '笔记' }
            }))

            // 延迟一段时间后触发创建新笔记事件
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent('addNewBrewingNote'))
            }, 300)
        }, 300)
    }

    return (
        <>
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.265 }}
                    className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs"
                    onClick={handleClose}
                >
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{
                            type: "tween",
                            ease: [0.33, 1, 0.68, 1], // cubic-bezier(0.33, 1, 0.68, 1) - easeOutCubic
                            duration: 0.265
                        }}
                        style={{
                            willChange: "transform"
                        }}
                        className="absolute inset-x-0 bottom-0 max-w-[500px] mx-auto max-h-[90vh] overflow-hidden rounded-t-2xl bg-neutral-50 dark:bg-neutral-900 shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* 拖动条 */}
                        <div className="sticky top-0 z-10 flex justify-center py-2 bg-neutral-50 dark:bg-neutral-900">
                            <div className="h-1.5 w-12 rounded-full bg-neutral-200 dark:bg-neutral-700" />
                        </div>

                        {/* 内容区域 */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                                type: "tween",
                                ease: "easeOut",
                                duration: 0.265,
                                delay: 0.05
                            }}
                            style={{
                                willChange: "opacity, transform"
                            }}
                            className="px-6 pb-safe-bottom overflow-auto max-h-[calc(85vh-40px)]"
                        >
                            {/* 标题和操作栏 */}
                            <div className="flex items-center justify-between py-4 border-b border-neutral-200/60 dark:border-neutral-800/40 mb-4">
                                <h2 className="text-base font-medium text-neutral-800 dark:text-neutral-100 truncate flex-1">
                                    {searchQuery ? (
                                        <HighlightText text={bean?.name || '未命名'} highlight={searchQuery} />
                                    ) : (bean?.name || '未命名')}
                                </h2>

                                <div className="flex items-center">
                                    {/* 前往按钮 */}
                                    {bean && (
                                        <ActionMenu
                                            items={[
                                                { id: 'brewing', label: '去冲煮', onClick: handleGoToBrewing, color: 'default' as const },
                                                { id: 'notes', label: '去记录', onClick: handleGoToNotes, color: 'default' as const }
                                            ]}
                                            triggerClassName="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors mr-3"
                                            triggerChildren={<ArrowRight className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />}
                                        />
                                    )}
                                    
                                    {/* 原有的操作按钮 */}
                                    {bean && (onEdit || onShare || onDelete) && (
                                        <ActionMenu
                                            items={[
                                                ...(onEdit ? [{ id: 'edit', label: '编辑', onClick: () => { onEdit(bean); handleClose(); }, color: 'default' as const }] : []),
                                                ...(onShare ? [{ id: 'share', label: '分享', onClick: () => { onShare(bean); handleClose(); }, color: 'default' as const }] : []),
                                                ...(onDelete ? [{ id: 'delete', label: '删除', onClick: () => { onDelete(bean); handleClose(); }, color: 'danger' as const }] : [])
                                            ]}
                                            triggerClassName="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                                        />
                                    )}
                                </div>
                            </div>

                            {bean ? (
                                <div className="space-y-4">
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

                                    {(() => {
                                        const originItems = getOriginInfoItems()
                                        const isMultipleBlend = bean?.blendComponents && bean.blendComponents.length > 1
                                        return originItems.length > 0 && !isMultipleBlend && (
                                            <div className="space-y-2">
                                                <InfoGrid items={originItems} />
                                            </div>
                                        )
                                    })()}

                                    {(() => {
                                        const isMultipleBlend = bean?.blendComponents && bean.blendComponents.length > 1
                                        const hasContent = isMultipleBlend || (bean?.flavor && bean.flavor.length > 0) || bean?.notes
                                        return hasContent && (
                                            <div className="space-y-3">
                                                {isMultipleBlend && (
                                                <div>
                                                    <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1.5">拼配成分</div>
                                                    <div className="space-y-2">
                                                        {bean.blendComponents!.map((comp: { origin?: string; variety?: string; process?: string; percentage?: number }, index: number) => {
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
                                                        {bean.flavor.map((flavor: string, index: number) => (
                                                            <span key={index} className="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                                                                {flavor}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {bean.notes && (
                                                <div>
                                                    <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1.5">备注</div>
                                                    <div className="text-xs font-medium text-neutral-800 dark:text-neutral-100 leading-relaxed whitespace-pre-line">
                                                        {searchQuery ? (
                                                            <HighlightText text={bean.notes} highlight={searchQuery} className="text-neutral-700 dark:text-neutral-300" />
                                                        ) : bean.notes}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        )
                                    })()}

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
                                        const isChangeRecord = isSimpleChangeRecord(note)

                                        return (
                                            <div key={note.id} className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded">
                                                {isChangeRecord ? (
                                                    // 变动记录（快捷扣除和容量调整）
                                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                                        {/* 咖啡豆名称 - 固定宽度 */}
                                                        <div className="w-20 text-xs font-medium text-neutral-800 dark:text-neutral-100 truncate" title={bean?.name || '咖啡豆'}>
                                                            {bean?.name || '咖啡豆'}
                                                        </div>

                                                        {/* 变动量标签 - 固定宽度 */}
                                                        {(() => {
                                                            let displayLabel = '0g'

                                                            if (note.source === 'quick-decrement') {
                                                                // 快捷扣除记录
                                                                const amount = note.quickDecrementAmount || 0
                                                                displayLabel = `-${amount}g`
                                                            } else if (note.source === 'capacity-adjustment') {
                                                                // 容量调整记录
                                                                const capacityAdjustment = note.changeRecord?.capacityAdjustment
                                                                const changeAmount = capacityAdjustment?.changeAmount || 0
                                                                const changeType = capacityAdjustment?.changeType || 'set'

                                                                if (changeType === 'increase') {
                                                                    displayLabel = `+${Math.abs(changeAmount)}g`
                                                                } else if (changeType === 'decrease') {
                                                                    displayLabel = `-${Math.abs(changeAmount)}g`
                                                                } else {
                                                                    displayLabel = `${capacityAdjustment?.newAmount || 0}g`
                                                                }
                                                            }

                                                            return (
                                                                <div className="w-12 text-xs font-medium bg-neutral-100 dark:bg-neutral-800 px-1 py-px rounded-xs text-neutral-600 dark:text-neutral-400 text-center whitespace-nowrap overflow-hidden">
                                                                    {displayLabel}
                                                                </div>
                                                            )
                                                        })()}

                                                        {/* 备注 - 弹性宽度，占用剩余空间 */}
                                                        {note.notes && (
                                                            <div className="flex-1 min-w-0 text-xs text-neutral-500 dark:text-neutral-400 truncate" title={note.notes}>
                                                                {note.notes}
                                                            </div>
                                                        )}

                                                        {/* 日期 - 固定宽度 */}
                                                        <div className="w-20 text-xs font-medium tracking-wide text-neutral-600 dark:text-neutral-400 text-right whitespace-nowrap overflow-hidden" title={formatDate(note.timestamp)}>
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
                                                                {Object.values(note.taste).some(value => value > 0) && (
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
                                                                )}

                                                                {/* 时间和评分 */}
                                                                <div className="flex items-baseline justify-between">
                                                                    <div className="text-xs font-medium tracking-wide text-neutral-600 dark:text-neutral-400">
                                                                        {formatDate(note.timestamp)}
                                                                    </div>
                                                                    <div className="text-xs font-medium tracking-wide text-neutral-600 dark:text-neutral-400">
                                                                        {formatRating(note.rating)}
                                                                    </div>
                                                                </div>

                                                                {/* 备注信息 */}
                                                                {note.notes && note.notes.trim() && (
                                                                    <div className="text-xs font-medium bg-neutral-200/30 dark:bg-neutral-700/30 p-1.5 rounded tracking-widest text-neutral-800/70 dark:text-neutral-400/85 whitespace-pre-line leading-tight">
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
                            ) : null}
                        </motion.div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>

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
