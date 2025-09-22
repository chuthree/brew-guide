'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import ActionMenu from '@/components/coffee-bean/ui/action-menu'
import { NoteItemProps } from '../types'
import { formatDate, formatRating } from '../utils'
import { SettingsOptions, defaultSettings } from '@/components/settings/Settings'
import { formatGrindSize as _formatGrindSize } from '@/lib/utils/grindUtils'
import { availableGrinders } from '@/lib/core/config'

// 动态导入 ImageViewer 组件 - 移除加载占位符
const ImageViewer = dynamic(() => import('@/components/common/ui/ImageViewer'), {
    ssr: false
})

// 优化笔记项组件以避免不必要的重渲染
const NoteItem: React.FC<NoteItemProps> = ({
    note,
    equipmentNames,
    onEdit,
    onDelete,
    unitPriceCache,
    isShareMode = false,
    isSelected = false,
    onToggleSelect,
    isLast = false
}) => {
    // 添加用户设置状态
    const [_settings, setSettings] = useState<SettingsOptions>(defaultSettings);
    const [_grinderName, setGrinderName] = useState<string>("");
    // 图片查看器状态和错误状态
    const [imageViewerOpen, setImageViewerOpen] = useState(false);
    const [imageError, setImageError] = useState(false);

    // 预先计算一些条件，避免在JSX中重复计算
    const hasTasteRatings = Object.values(note.taste).some(value => value > 0);
    const hasNotes = Boolean(note.notes);
    const equipmentName = (note.equipment && note.equipment.trim() !== '') ? (equipmentNames[note.equipment] || note.equipment) : '未知器具';
    const beanName = note.coffeeBeanInfo?.name;
    const beanUnitPrice = beanName ? (unitPriceCache[beanName] || 0) : 0;

    // 获取用户设置
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const { Storage } = await import('@/lib/core/storage');
                const settingsStr = await Storage.get('brewGuideSettings');
                if (settingsStr) {
                    const parsedSettings = JSON.parse(settingsStr) as SettingsOptions;
                    setSettings(parsedSettings);

                    // 获取磨豆机名称
                    if (parsedSettings.grindType !== 'generic') {
                        const grinder = availableGrinders.find(g => g.id === parsedSettings.grindType);
                        if (grinder) {
                            setGrinderName(grinder.name);
                        }
                    }
                }
            } catch (error) {
                console.error('加载用户设置失败', error);
            }
        };

        loadSettings();
    }, []);

    // 处理笔记点击事件
    const handleNoteClick = () => {
        if (isShareMode && onToggleSelect) {
            onToggleSelect(note.id);
        } else if (onEdit) {
            onEdit(note);
        }
    };

    return (
        <div
            className={`group space-y-3 px-6 py-5 ${!isLast ? 'border-b border-neutral-200 dark:border-neutral-800' : ''} ${isShareMode ? 'cursor-pointer' : ''} note-item`}
            onClick={isShareMode ? handleNoteClick : undefined}
            data-note-id={note.id}
        >
            <div className="flex flex-col space-y-3">
                {/* 图片和基本信息区域 */}
                <div className="flex gap-4">
                    {/* 笔记图片 - 只在有图片时显示 */}
                    {note.image && (
                        <div
                            className="w-14 h-14 relative shrink-0 cursor-pointer rounded border border-neutral-200/50 dark:border-neutral-800/50 bg-neutral-100 dark:bg-neutral-800/20 overflow-hidden"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!imageError) setImageViewerOpen(true);
                            }}
                        >
                            {imageError ? (
                                <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-500 dark:text-neutral-400">
                                    加载失败
                                </div>
                            ) : (
                                <Image
                                    src={note.image}
                                    alt={beanName || '笔记图片'}
                                    height={48}
                                    width={48}
                                    unoptimized
                                    style={{ width: '100%', height: '100%' }}
                                    className="object-cover"
                                    sizes="48px"
                                    priority={true}
                                    loading="eager"
                                    onError={() => setImageError(true)}
                                />
                            )}
                        </div>
                    )}

                    {/* 图片查看器 - 只有当需要显示时才渲染 */}
                    {note.image && !imageError && imageViewerOpen && (
                        <ImageViewer
                            isOpen={imageViewerOpen}
                            imageUrl={note.image}
                            alt={beanName || '笔记图片'}
                            onClose={() => setImageViewerOpen(false)}
                        />
                    )}

                    {/* 名称和标签区域 */}
                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0 overflow-hidden">
                                <div className="text-xs font-medium break-words text-neutral-800 dark:text-neutral-100 pr-2">
                                    {/* 根据是否有方案来决定显示内容 */}
                                    {note.method && note.method.trim() !== '' ? (
                                        // 有方案时的显示逻辑
                                        beanName ? (
                                            <>
                                                {beanName}
                                                <span className="mx-1">·</span>
                                                <span>{note.method}</span>
                                            </>
                                        ) : (
                                            <>
                                                {equipmentName}
                                                <span className="mx-1">·</span>
                                                <span>{note.method}</span>
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
                                                    <span className="mx-1">·</span>
                                                    <span>{equipmentName}</span>
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
                                    <div className="text-xs font-medium mt-1.5 tracking-wide text-neutral-600 dark:text-neutral-400 space-x-1 leading-relaxed">
                                        {beanName && (
                                            <>
                                                <span>{equipmentName}</span>
                                                <span>·</span>
                                            </>
                                        )}
                                        <span>
                                            {note.params.coffee}
                                            {beanName && beanUnitPrice > 0 && (
                                                <span className="ml-1">
                                                    ({beanUnitPrice.toFixed(2)}元/克)
                                                </span>
                                            )}
                                        </span>
                                        <span>·</span>
                                        <span>{note.params.ratio}</span>

                                        {/* 合并显示研磨度和水温 */}
                                        {(note.params.grindSize || note.params.temp) && (
                                            <>
                                                <span>·</span>
                                                {note.params.grindSize && note.params.temp ? (
                                                    <span>
                                                        {isShareMode && _settings.grindType !== 'generic' && _grinderName ? (
                                                            // 在分享模式下显示磨豆机名称 + 研磨度
                                                            <>{_grinderName} {_formatGrindSize(note.params.grindSize, _settings.grindType)} · {note.params.temp}</>
                                                        ) : (
                                                            // 普通显示 - 也应用转换
                                                            <>{_formatGrindSize(note.params.grindSize, _settings.grindType)} · {note.params.temp}</>
                                                        )}
                                                    </span>
                                                ) : (
                                                    <span>
                                                        {note.params.grindSize ? (
                                                            isShareMode && _settings.grindType !== 'generic' && _grinderName ? (
                                                                // 在分享模式下只显示研磨度
                                                                <>{_grinderName} {_formatGrindSize(note.params.grindSize, _settings.grindType)}</>
                                                            ) : (
                                                                // 普通显示 - 也应用转换
                                                                <>{_formatGrindSize(note.params.grindSize, _settings.grindType)}</>
                                                            )
                                                        ) : (
                                                            // 只有水温
                                                            <>{note.params.temp}</>
                                                        )}
                                                    </span>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="shrink-0 ml-1 relative h-[16.5px]">
                                {isShareMode ? (
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={(e) => {
                                            e.stopPropagation();
                                            if (onToggleSelect) onToggleSelect(note.id);
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="appearance-none h-4 w-4 rounded-sm border border-neutral-300 dark:border-neutral-700 checked:bg-neutral-800 dark:checked:bg-neutral-200 relative checked:after:absolute checked:after:left-1/2 checked:after:top-1/2 checked:after:-translate-x-1/2 checked:after:-translate-y-1/2 checked:after:content-['✓'] checked:after:text-white dark:checked:after:text-black text-xs"
                                    />
                                ) : (
                                    <ActionMenu
                                        items={[
                                            {
                                                id: 'edit',
                                                label: '编辑',
                                                onClick: () => onEdit(note)
                                            },
                                            {
                                                id: 'delete',
                                                label: '删除',
                                                onClick: () => onDelete(note.id),
                                                color: 'danger'
                                            },
                                            {
                                                id: 'share',
                                                label: '分享',
                                                onClick: () => {
                                                    if (onToggleSelect) {
                                                        onToggleSelect(note.id, true);
                                                    }
                                                }
                                            }
                                        ]}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 风味评分 - 只有当存在有效评分(大于0)时才显示 */}
                {hasTasteRatings ? (
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
                ) : null}

                {/* 时间和评分 */}
                <div className="flex items-baseline justify-between">
                    <div className="text-xs font-medium tracking-wide text-neutral-600 dark:text-neutral-400">
                        {formatDate(note.timestamp)}
                    </div>
                    <div className="text-xs font-medium tracking-wide text-neutral-600 dark:text-neutral-400">
                        {isShareMode ? `总体评分 ${formatRating(note.rating)}` : formatRating(note.rating)}
                    </div>
                </div>

                {/* 备注信息 */}
                {hasNotes && (
                    <div className="text-xs font-medium bg-neutral-200/30 dark:bg-neutral-800/40 p-1.5 rounded tracking-widest text-neutral-800/70 dark:text-neutral-400/85 whitespace-pre-line leading-tight">
                        {note.notes}
                    </div>
                )}
            </div>
        </div>
    )
}

export default NoteItem
