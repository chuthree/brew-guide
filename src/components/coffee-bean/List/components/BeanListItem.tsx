'use client'

import React, { useState, useMemo, useEffect } from 'react'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import ActionMenu, { ActionMenuItem } from '@/components/coffee-bean/ui/action-menu'
import { ExtendedCoffeeBean } from '../types'
import { isBeanEmpty } from '../globalCache'
import { formatDate, parseDateToTimestamp } from '@/lib/utils/dateUtils'
import HighlightText from '@/components/common/ui/HighlightText'
import { Storage } from '@/lib/core/storage'
import { defaultSettings, SettingsOptions } from '@/components/settings/Settings'

// 动态导入 ImageViewer 组件 - 移除加载占位符
const ImageViewer = dynamic(() => import('@/components/common/ui/ImageViewer'), {
    ssr: false
})

interface BeanListItemProps {
    bean: ExtendedCoffeeBean
    title: string
    isLast: boolean
    onEdit: (bean: ExtendedCoffeeBean) => void
    onDelete: (bean: ExtendedCoffeeBean) => void
    onShare: (bean: ExtendedCoffeeBean) => void
    onRemainingClick: (bean: ExtendedCoffeeBean, event: React.MouseEvent) => void
    searchQuery?: string
}

const BeanListItem: React.FC<BeanListItemProps> = ({
    bean,
    title,
    isLast,
    onEdit,
    onDelete,
    onShare,
    onRemainingClick,
    searchQuery = ''
}) => {
    // 图片查看器状态和错误状态
    const [imageViewerOpen, setImageViewerOpen] = useState(false);
    const [imageError, setImageError] = useState(false);
    
    // 添加设置状态
    const [_settings, setSettings] = useState<SettingsOptions>(defaultSettings);
    const [_isMinimalistMode, setIsMinimalistMode] = useState(false);
    const [hideFlavors, setHideFlavors] = useState(false); // 默认显示风味标签
    const [hidePrice, setHidePrice] = useState(false); // 默认显示价格
    const [hideRoastDate, setHideRoastDate] = useState(false); // 默认显示烘焙日期
    
    // 获取全局设置
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const settingsStr = await Storage.get('brewGuideSettings');
                if (settingsStr) {
                    const parsedSettings = JSON.parse(settingsStr) as SettingsOptions;
                    setSettings(parsedSettings);
                    setIsMinimalistMode(parsedSettings.minimalistMode || false);

                    // 加载细粒度设置选项，使用默认值作为后备
                    const minimalistOptions = parsedSettings.minimalistOptions || {
                        hideFlavors: true,
                        hidePrice: false, // 默认显示价格
                        hideRoastDate: false,
                        hideTotalWeight: true
                    };

                    setHideFlavors(parsedSettings.minimalistMode && minimalistOptions.hideFlavors);
                    setHidePrice(parsedSettings.minimalistMode && minimalistOptions.hidePrice);
                    setHideRoastDate(parsedSettings.minimalistMode && minimalistOptions.hideRoastDate);
                } else {
                    // 如果没有设置，使用默认值（价格默认显示）
                    setHideFlavors(false);
                    setHidePrice(false);
                    setHideRoastDate(false);
                }
            } catch (error) {
                console.error('加载设置失败', error);
                // 出错时也使用默认值（价格默认显示）
                setHideFlavors(false);
                setHidePrice(false);
                setHideRoastDate(false);
            }
        };
        
        loadSettings();
        
        // 监听设置变更
        const handleSettingsChange = (e: CustomEvent) => {
            if (e.detail?.key === 'brewGuideSettings') {
                loadSettings();
            }
        };
        
        window.addEventListener('storageChange', handleSettingsChange as EventListener);
        return () => {
            window.removeEventListener('storageChange', handleSettingsChange as EventListener);
        };
    }, []);

    // 计算剩余百分比
    const remainingPercentage = useMemo(() => {
        if (!bean.capacity || !bean.remaining) return 0;
        const capacity = parseFloat(bean.capacity.replace('g', ''));
        const remaining = parseFloat(bean.remaining.replace('g', ''));
        if (isNaN(capacity) || isNaN(remaining) || capacity === 0) return 0;
        return (remaining / capacity) * 100;
    }, [bean.capacity, bean.remaining]);

    // 计算赏味期信息
    const flavorInfo = useMemo(() => {
        // 检查是否为在途状态
        if (bean.isInTransit) {
            return {
                phase: '在途',
                remainingDays: 0,
                progressPercent: 0,
                status: '在途',
                preFlavorPercent: 0,
                flavorPercent: 100, // 在途状态下整个进度条显示为在途区域
                daysSinceRoast: 0,
                endDay: 0,
                isFrozen: false,
                isInTransit: true
            };
        }

        if (!bean.roastDate) return {
            phase: '未知',
            remainingDays: 0,
            progressPercent: 0,
            status: '未知',
            preFlavorPercent: 0,
            flavorPercent: 0,
            daysSinceRoast: 0,
            endDay: 0,
            isFrozen: false,
            isInTransit: false
        };

        // 检查是否为冰冻状态
        if (bean.isFrozen) {
            return {
                phase: '冰冻',
                remainingDays: 0,
                progressPercent: 0,
                status: '冰冻',
                preFlavorPercent: 0,
                flavorPercent: 100, // 冰冻状态下整个进度条显示为赏味期区域
                daysSinceRoast: 0,
                endDay: 0,
                isFrozen: true,
                isInTransit: false
            };
        }

        const today = new Date();
        // 使用日期工具函数解析日期
        const roastTimestamp = parseDateToTimestamp(bean.roastDate);
        const roastDate = new Date(roastTimestamp);
        const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const roastDateOnly = new Date(roastDate.getFullYear(), roastDate.getMonth(), roastDate.getDate());
        const daysSinceRoast = Math.ceil((todayDate.getTime() - roastDateOnly.getTime()) / (1000 * 60 * 60 * 24));

        // 优先使用自定义赏味期参数，如果没有则根据烘焙度计算
        let startDay = bean.startDay || 0;
        let endDay = bean.endDay || 0;

        // 如果没有自定义值，则根据烘焙度设置默认值
        if (startDay === 0 && endDay === 0) {
            if (bean.roastLevel?.includes('浅')) {
                startDay = 7;
                endDay = 30;
            } else if (bean.roastLevel?.includes('深')) {
                startDay = 14;
                endDay = 60;
            } else {
                // 默认为中烘焙
                startDay = 10;
                endDay = 30;
            }
        }

        let phase = '';
        let status = '';
        let remainingDays = 0;
        const progressPercent = Math.min((daysSinceRoast / endDay) * 100, 100);
        const preFlavorPercent = (startDay / endDay) * 100;
        const flavorPercent = ((endDay - startDay) / endDay) * 100;

        if (daysSinceRoast < startDay) {
            phase = '养豆期';
            remainingDays = startDay - daysSinceRoast;
            status = `养豆期剩余 ${remainingDays}天`;
        } else if (daysSinceRoast <= endDay) {
            phase = '赏味期';
            remainingDays = endDay - daysSinceRoast;
            status = `赏味期剩余 ${remainingDays}天`;
        } else {
            phase = '衰退期';
            remainingDays = 0;
            status = '已衰退';
        }

        return { phase, remainingDays, progressPercent, preFlavorPercent, flavorPercent, status, daysSinceRoast, endDay, isFrozen: false, isInTransit: false };
    }, [bean.roastDate, bean.startDay, bean.endDay, bean.roastLevel, bean.isFrozen, bean.isInTransit]);

    // 计算豆子是否为空
    const isEmpty = isBeanEmpty(bean);

    // 操作菜单项
    const actionMenuItems: ActionMenuItem[] = [
        { id: 'edit', label: '编辑', onClick: () => onEdit(bean) },
        { id: 'share', label: '分享', onClick: () => onShare(bean) },
        { id: 'delete', label: '删除', color: 'danger', onClick: () => onDelete(bean) }
    ];

    // 网格布局类名
    const gridClassName = `grid ${(!bean.capacity || !bean.remaining) && !bean.roastDate ? 'grid-cols-1' : (bean.capacity && bean.remaining && bean.roastDate ? 'grid-cols-2' : 'grid-cols-1')} gap-x-4`;
    
    // 格式化数字显示，整数时不显示小数点
    const formatNumber = (value: string | undefined): string => 
        !value ? '0' : (Number.isInteger(parseFloat(value)) ? Math.floor(parseFloat(value)).toString() : value);

    return (
        <div
            className={`group space-y-3 px-6 py-5 ${isLast ? '' : 'border-b border-neutral-200/60 dark:border-neutral-800/40'} ${
                isEmpty ? 'bg-neutral-100/60 dark:bg-neutral-800/30' : ''
            }`}
        >
            <div className="flex flex-col space-y-3">
                {/* 图片和基本信息区域 */}
                <div className="flex gap-4">
                    {/* 咖啡豆图片 - 只在有图片时显示 */}
                    {bean.image && (
                        <div 
                            className="h-14 relative shrink-0 cursor-pointer border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 overflow-hidden"
                            onClick={() => !imageError && setImageViewerOpen(true)}
                        >
                            {imageError ? (
                                <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-500 dark:text-neutral-400">
                                    加载失败
                                </div>
                            ) : (
                                <Image
                                    src={bean.image}
                                    alt={bean.name || '咖啡豆图片'}
                                    height={56}
                                    width={56}
                                    unoptimized
                                    style={{ width: 'auto', height: '100%' }}
                                    className="object-cover"
                                    sizes="56px"
                                    priority={false}
                                    loading="lazy"
                                    onError={() => setImageError(true)}
                                />
                            )}
                        </div>
                    )}

                    {/* 图片查看器 - 只有当需要显示时才渲染 */}
                    {bean.image && !imageError && imageViewerOpen && (
                        <ImageViewer
                            isOpen={imageViewerOpen}
                            imageUrl={bean.image}
                            alt={bean.name || '咖啡豆图片'}
                            onClose={() => setImageViewerOpen(false)}
                        />
                    )}

                    {/* 名称和标签区域 */}
                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0 overflow-hidden">
                                <div className="text-[11px] font-normal break-words text-neutral-800 dark:text-neutral-100 pr-2">
                                    {searchQuery ? (
                                        <HighlightText 
                                            text={title} 
                                            highlight={searchQuery} 
                                        />
                                    ) : (
                                        title
                                    )}
                                </div>
                                {/* 拼配豆信息显示 */}
                                {bean.type === '拼配' && bean.blendComponents && bean.blendComponents.length > 1 && (
                                    <div className="text-[10px] font-normal text-neutral-500 dark:text-neutral-400 pr-2 mt-0.5 flex flex-col">
                                        {bean.blendComponents.map((comp, index) => {
                                            const componentText = [
                                                comp.origin || '',
                                                comp.process || '',
                                                comp.variety || ''
                                            ].filter(Boolean).join(' ');
                                            
                                            const hasPercentage = comp.percentage !== undefined && 
                                                                comp.percentage !== null;
                                            
                                            return (
                                                <span key={index} className="whitespace-nowrap">
                                                    {searchQuery ? (
                                                        <HighlightText 
                                                            text={componentText} 
                                                            highlight={searchQuery} 
                                                            className="text-neutral-500 dark:text-neutral-400"
                                                        />
                                                    ) : (
                                                        componentText
                                                    )}
                                                    {hasPercentage && ` (${comp.percentage}%)`}
                                                </span>
                                            );
                                        })}
                                    </div>
                                )}
                                {isEmpty && (
                                    <div className="text-[10px] font-normal px-1.5 py-0.5 mt-1 inline-block rounded-full bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300 shrink-0">
                                        已用完
                                    </div>
                                )}
                            </div>
                            <div className="shrink-0 ml-1 relative">
                                <ActionMenu items={actionMenuItems} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className={gridClassName}>
                    {/* 剩余量进度条 - 仅当capacity和remaining都存在时显示 */}
                    {bean.capacity && bean.remaining && (
                        <div className="space-y-1">
                            <div className="flex items-center justify-between">
                                <div className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                                    剩余量
                                </div>
                                <div className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                                    <span 
                                        className="cursor-pointer border-dashed border-b border-neutral-400 dark:border-neutral-600 transition-colors"
                                        onClick={(e) => onRemainingClick(bean, e)}
                                    >
                                        {formatNumber(bean.remaining)}g
                                    </span>
                                    {" / "}
                                    {formatNumber(bean.capacity)}g
                                </div>
                            </div>
                            <div
                                className="h-px w-full overflow-hidden bg-neutral-200/50 dark:bg-neutral-800"
                            >
                                <div
                                    style={{ 
                                        width: `${remainingPercentage}%` 
                                    }}
                                    className="h-full bg-neutral-600 dark:bg-neutral-400"
                                />
                            </div>
                        </div>
                    )}

                    {/* 赏味期进度条 - 在途状态或有烘焙日期时显示 */}
                    {(bean.isInTransit || bean.roastDate) && (
                        <div className="space-y-1">
                            <div className="flex items-center justify-between">
                                <div className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                                    {bean.isInTransit ? '状态' : flavorInfo.isFrozen ? '保存方式' : '赏味期'}
                                </div>
                                <div className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                                    {flavorInfo.status}
                                </div>
                            </div>
                            <div className="h-px w-full overflow-hidden bg-neutral-200/50 dark:bg-neutral-800 relative">
                                {bean.isInTransit ? (
                                    // 在途状态进度条样式
                                    <div
                                        className="absolute h-full bg-neutral-400/20 dark:bg-neutral-600/30 w-full"
                                        style={{
                                            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0, 0, 0, 0.1) 2px, rgba(0, 0, 0, 0.1) 4px)'
                                        }}
                                    ></div>
                                ) : flavorInfo.isFrozen ? (
                                    // 冰冻状态进度条样式
                                    <div
                                        className="absolute h-full bg-blue-500/20 dark:bg-blue-600/30 w-full"
                                        style={{
                                            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0, 0, 0, 0.1) 2px, rgba(0, 0, 0, 0.1) 4px)'
                                        }}
                                    ></div>
                                ) : (
                                    <>
                                        {/* 养豆期区间 */}
                                        <div
                                            className="absolute h-full bg-neutral-400/10 dark:bg-neutral-400/10"
                                            style={{
                                                left: '0%',
                                                width: `${flavorInfo.preFlavorPercent}%`
                                            }}
                                        ></div>

                                        {/* 赏味期区间（带纹理） */}
                                        <div
                                            className="absolute h-full bg-green-500/20 dark:bg-green-600/30"
                                            style={{
                                                left: `${flavorInfo.preFlavorPercent}%`,
                                                width: `${flavorInfo.flavorPercent}%`,
                                                backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0, 0, 0, 0.1) 2px, rgba(0, 0, 0, 0.1) 4px)'
                                            }}
                                        ></div>

                                        {/* 进度指示 */}
                                        <div
                                            className={`absolute h-full ${
                                                flavorInfo.daysSinceRoast > flavorInfo.endDay 
                                                    ? 'bg-neutral-500 dark:bg-neutral-500' 
                                                    : flavorInfo.daysSinceRoast >= (bean.startDay || 0) 
                                                        ? 'bg-green-500 dark:bg-green-600' 
                                                        : 'bg-neutral-600 dark:bg-neutral-400'
                                            }`}
                                            style={{
                                                zIndex: 10,
                                                width: `${flavorInfo.progressPercent}%`
                                            }}
                                        ></div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* 风味标签 - 改进显示 - 在极简模式且启用hideFlavors时不显示 */}
                {!hideFlavors && bean.flavor && bean.flavor.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {bean.flavor.map((flavor, idx) => (
                            <div
                                key={idx}
                                className="text-[10px] bg-neutral-100 dark:bg-neutral-800 rounded-full px-2 py-0.5"
                            >
                                {flavor}
                            </div>
                        ))}
                    </div>
                )}

                {/* 底部信息布局优化 - 根据设置控制显示 */}
                <div className="flex items-baseline justify-between text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                    <div>
                        {bean.roastDate && !hideRoastDate && !bean.isInTransit && (
                            <span>烘焙于 {formatDate(bean.roastDate)}</span>
                        )}
                    </div>
                    <div>
                        {!hidePrice && bean.price && (
                            <span>
                                {bean.price}元
                                {bean.capacity && (
                                    <span className="ml-1">
                                        [{(parseFloat(bean.price) / parseFloat(bean.capacity.replace('g', ''))).toFixed(2)}元/克]
                                    </span>
                                )}
                            </span>
                        )}
                    </div>
                </div>

                {/* 备注信息 */}
                {bean.notes && (
                    <div className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400 whitespace-pre-line leading-tight text-justify">
                        {searchQuery ? (
                            <HighlightText 
                                text={bean.notes} 
                                highlight={searchQuery} 
                                className="text-neutral-600 dark:text-neutral-400"
                            />
                        ) : (
                            bean.notes
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

// 使用 React.memo 包装组件以避免不必要的重新渲染
export default React.memo(BeanListItem) 