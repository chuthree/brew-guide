'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import ActionMenu from '@/components/coffee-bean/ui/action-menu'
import { NoteItemProps } from '../types'
import { formatDate, formatRating } from '../utils'
import { Storage } from '@/lib/core/storage'
import { SettingsOptions, defaultSettings } from '@/components/settings/Settings'
import { formatGrindSize } from '@/lib/utils/grindUtils'
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
    onToggleSelect
}) => {
    // 添加用户设置状态
    const [settings, setSettings] = useState<SettingsOptions>(defaultSettings);
    const [grinderName, setGrinderName] = useState<string>("");
    // 图片查看器状态和错误状态
    const [imageViewerOpen, setImageViewerOpen] = useState(false);
    const [imageError, setImageError] = useState(false);

    // 预先计算一些条件，避免在JSX中重复计算
    const hasTasteRatings = Object.values(note.taste).some(value => value > 0);
    const hasNotes = Boolean(note.notes);
    const equipmentName = equipmentNames[note.equipment] || note.equipment;
    const beanName = note.coffeeBeanInfo?.name;
    const beanUnitPrice = beanName ? (unitPriceCache[beanName] || 0) : 0;
    
    // 获取用户设置
    useEffect(() => {
        const loadSettings = async () => {
            try {
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
            className={`group space-y-3 px-6 py-3 border-b border-neutral-200 dark:border-neutral-800 last:border-b-0 ${isShareMode ? 'cursor-pointer' : ''} note-item`}
            onClick={isShareMode ? handleNoteClick : undefined}
            data-note-id={note.id}
        >
            <div className="flex flex-col space-y-3">
                {/* 图片和基本信息区域 */}
                <div className="flex gap-4">
                    {/* 笔记图片 - 只在有图片时显示 */}
                    {note.image && (
                        <div 
                            className="h-14 overflow-hidden flex-shrink-0 relative cursor-pointer border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800"
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
                                    height={56}
                                    width={0}
                                    className="h-14 w-auto object-cover"
                                    sizes="56px"
                                    priority={false}
                                    loading="lazy"
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
                                <div className="text-[11px] font-normal break-words text-neutral-800 dark:text-neutral-100 pr-2">
                                    {beanName ? (
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
                                    )}
                                </div>
                                
                                {/* 方案信息 - 移动到图片右侧标题下方 */}
                                {note.params && (
                                    <div className="text-[10px] mt-0.5 tracking-widest text-neutral-600 dark:text-neutral-400 space-x-1 leading-relaxed">
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
                                                        {/* 直接显示原始研磨度，不再进行转换 */}
                                                        <>{note.params.grindSize} · {note.params.temp}</>
                                                    </span>
                                                ) :
                                                    <span>
                                                        {note.params.grindSize ? (
                                                            // 直接显示原始研磨度
                                                            <>{note.params.grindSize}</>
                                                        ) : (
                                                            // 只有水温
                                                            <>{note.params.temp}</>
                                                        )}
                                                    </span>
                                                }
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="flex-shrink-0 ml-1 relative">
                                {isShareMode ? (
                                    <input 
                                        type="checkbox" 
                                        checked={isSelected}
                                        onChange={(e) => {
                                            e.stopPropagation();
                                            if (onToggleSelect) onToggleSelect(note.id);
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="appearance-none h-4 w-4 rounded border border-neutral-300 dark:border-neutral-700 checked:bg-neutral-800 dark:checked:bg-neutral-200 relative checked:after:absolute checked:after:left-1/2 checked:after:top-1/2 checked:after:-translate-x-1/2 checked:after:-translate-y-1/2 checked:after:content-['✓'] checked:after:text-white dark:checked:after:text-black text-xs"
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
                                        <div className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
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
                                        <div className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                                            {value}
                                        </div>
                                    </div>
                                    <div className="h-px w-full overflow-hidden bg-neutral-200/50 dark:bg-neutral-800">
                                        <div
                                            style={{ width: `${value === 0 ? 0 : (value / 5) * 100}%` }}
                                            className="h-full bg-neutral-800 dark:bg-neutral-100"
                                        />
                                    </div>
                                </div>
                            ))}
                    </div>
                ) : null}

                {/* 时间和评分 */}
                {hasTasteRatings ? (
                    <div className="flex items-baseline justify-between">
                        <div className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                            {formatDate(note.timestamp)}
                        </div>
                        <div className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                            {formatRating(note.rating)}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <div className="flex items-center justify-between">
                                <div className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                                    总体评分
                                </div>
                                <div className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                                    {note.rating}
                                </div>
                            </div>
                            <div className="h-px w-full overflow-hidden bg-neutral-200/50 dark:bg-neutral-800">
                                <div
                                    style={{ width: `${note.rating === 0 ? 0 : (note.rating / 5) * 100}%` }}
                                    className="h-full bg-neutral-800 dark:bg-neutral-100"
                                />
                            </div>
                        </div>
                        <div className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                            {formatDate(note.timestamp)}
                        </div>
                    </div>
                )}

                {/* 备注信息 */}
                {hasNotes && (
                    <div className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400 whitespace-pre-line leading-tight">
                        {note.notes}
                    </div>
                )}
            </div>
        </div>
    )
}

export default NoteItem 