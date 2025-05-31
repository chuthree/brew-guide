'use client'

import React, { useState, useMemo, useEffect } from 'react'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import ActionMenu, { ActionMenuItem } from '@/components/coffee-bean/ui/action-menu'
import { ExtendedCoffeeBean } from '../types'
import { isBeanEmpty } from '../globalCache'
import { parseDateToTimestamp } from '@/lib/utils/dateUtils'
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
    onDetailClick?: (bean: ExtendedCoffeeBean) => void
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
    onDetailClick,
    searchQuery = ''
}) => {
    // 图片查看器状态和错误状态
    const [imageViewerOpen, setImageViewerOpen] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [_imageLoaded, _setImageLoaded] = useState(false);
    
    // 添加设置状态
    const [_settings, setSettings] = useState<SettingsOptions>(defaultSettings);
    const [_isMinimalistMode, setIsMinimalistMode] = useState(false);
    // const [hideFlavors, setHideFlavors] = useState(false); // 默认显示风味标签
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

                    // setHideFlavors(parsedSettings.minimalistMode && minimalistOptions.hideFlavors);
                    setHidePrice(parsedSettings.minimalistMode && minimalistOptions.hidePrice);
                    setHideRoastDate(parsedSettings.minimalistMode && minimalistOptions.hideRoastDate);
                } else {
                    // 如果没有设置，使用默认值（价格默认显示）
                    // setHideFlavors(false);
                    setHidePrice(false);
                    setHideRoastDate(false);
                }
            } catch (error) {
                console.error('加载设置失败', error);
                // 出错时也使用默认值（价格默认显示）
                // setHideFlavors(false);
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
            status = `养豆 ${remainingDays}天`;
        } else if (daysSinceRoast <= endDay) {
            phase = '赏味期';
            remainingDays = endDay - daysSinceRoast;
            status = `赏味 ${remainingDays}天`;
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

    // 格式化数字显示，整数时不显示小数点
    const formatNumber = (value: string | undefined): string =>
        !value ? '0' : (Number.isInteger(parseFloat(value)) ? Math.floor(parseFloat(value)).toString() : value);

    // 格式化日期显示（缩写格式）
    const formatDateShort = (dateStr: string): string => {
        try {
            const timestamp = parseDateToTimestamp(dateStr);
            const date = new Date(timestamp);
            const year = date.getFullYear().toString().slice(-2); // 获取年份的最后两位
            return `${year}-${date.getMonth() + 1}-${date.getDate()}`;
        } catch {
            return dateStr;
        }
    };

    // 格式化克价显示（只显示每克价格）
    const formatPricePerGram = (price: string, capacity: string): string => {
        const priceNum = parseFloat(price);
        const capacityNum = parseFloat(capacity.replace('g', ''));
        if (isNaN(priceNum) || isNaN(capacityNum) || capacityNum === 0) return '';
        const pricePerGram = priceNum / capacityNum;
        return `${pricePerGram.toFixed(1)}元/克`;
    };

    // 计算需要显示的简化信息项（去掉标签）
    const infoItems = [];

    // 剩余量信息 - 优化显示格式
    if (bean.capacity && bean.remaining) {
        infoItems.push({
            type: 'remaining',
            value: `${formatNumber(bean.remaining)}/${formatNumber(bean.capacity)}克`,
            clickable: true,
            remainingOnly: formatNumber(bean.remaining) // 只有剩余量数字，用于虚线显示
        });
    }

    // 状态信息 - 直接显示状态
    if (bean.isInTransit || bean.isFrozen || bean.roastDate) {
        infoItems.push({
            type: 'status',
            value: flavorInfo.status,
            clickable: false
        });
    }

    // 烘焙日期信息 - 直接显示日期
    if (bean.roastDate && !hideRoastDate && !bean.isInTransit) {
        infoItems.push({
            type: 'roastDate',
            value: formatDateShort(bean.roastDate),
            clickable: false
        });
    }

    // 价格信息 - 直接显示价格
    if (!hidePrice && bean.price && bean.capacity) {
        infoItems.push({
            type: 'price',
            value: formatPricePerGram(bean.price, bean.capacity),
            clickable: false
        });
    }

    // 处理卡片点击事件
    const handleCardClick = (e: React.MouseEvent) => {
        // 检查点击的目标是否在需要避开的区域内
        const target = e.target as HTMLElement;

        // 避开图片区域、操作菜单、剩余量编辑区域
        if (
            target.closest('[data-click-area="image"]') ||
            target.closest('[data-click-area="action-menu"]') ||
            target.closest('[data-click-area="remaining-edit"]')
        ) {
            return;
        }

        // 调用详情页回调
        if (onDetailClick) {
            onDetailClick(bean);
        }
    };

    return (
        <div
            className={`group px-6 py-4 ${isLast ? '' : 'border-b border-neutral-200/60 dark:border-neutral-800/40'} ${
                isEmpty ? 'bg-neutral-100/60 dark:bg-neutral-800/30' : ''
            } ${onDetailClick ? 'cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors' : ''}`}
            onClick={handleCardClick}
        >
            {/* 主要布局：如果有图片则左图右内容，否则全宽内容 */}
            <div className="flex gap-4">
                {/* 左侧图片区域 - 圆形显示 */}
                {bean.image && (
                    <div
                        className="w-20 h-20 relative shrink-0 cursor-pointer border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 overflow-hidden"
                        onClick={() => !imageError && setImageViewerOpen(true)}
                        data-click-area="image"
                    >
                        {imageError ? (
                            <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-500 dark:text-neutral-400">
                                失败
                            </div>
                        ) : (
                            <Image
                                src={bean.image}
                                alt={bean.name || '咖啡豆图片'}
                                height={80}
                                width={80}
                                unoptimized
                                style={{ width: '100%', height: '100%' }}
                                className="object-cover"
                                sizes="80px"
                                priority={true}  // 设置为高优先级，减少闪烁
                                loading="eager"  // 使用即时加载
                                onError={() => setImageError(true)}
                                placeholder="blur"
                                blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
                            />
                        )}
                    </div>
                )}

                {/* 图片查看器 */}
                {bean.image && !imageError && imageViewerOpen && (
                    <ImageViewer
                        isOpen={imageViewerOpen}
                        imageUrl={bean.image}
                        alt={bean.name || '咖啡豆图片'}
                        onClose={() => setImageViewerOpen(false)}
                    />
                )}

                {/* 右侧内容区域（或全宽内容区域） - 有图片时高度与图片一致，无图片时自适应高度 */}
                <div className={`flex-1 min-w-0 flex flex-col ${bean.image ? 'h-20 justify-between' : 'min-h-[2.5rem] justify-start gap-1.5'}`}>
                    {/* 顶部：标题和操作菜单 */}
                    <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0 overflow-hidden">
                            <div className="text-xs font-normal text-neutral-800 dark:text-neutral-100 pr-2 leading-tight line-clamp-2">
                                {searchQuery ? (
                                    <HighlightText
                                        text={title}
                                        highlight={searchQuery}
                                    />
                                ) : (
                                    title
                                )}
                            </div>
                            {/* 拼配豆信息显示 - 简化版本 */}
                            {bean.blendComponents && bean.blendComponents.length > 1 && (
                                <div className="text-[11px] font-normal text-neutral-500 dark:text-neutral-400 mt-0.5 pr-2 leading-tight overflow-hidden">
                                    <div className="truncate">
                                        {bean.blendComponents.map((comp, index) => {
                                            // 优先显示产地，如果没有则显示品种
                                            const displayText = comp.origin || comp.variety || '';
                                            const hasPercentage = comp.percentage !== undefined && comp.percentage !== null;

                                            return (
                                                <span key={index} className="mr-1.5">
                                                    {searchQuery ? (
                                                        <HighlightText
                                                            text={displayText}
                                                            highlight={searchQuery}
                                                            className="text-neutral-500 dark:text-neutral-400"
                                                        />
                                                    ) : (
                                                        displayText
                                                    )}
                                                    {hasPercentage && `${comp.percentage}%`}
                                                    {index < (bean.blendComponents?.length || 0) - 1 && ' +'}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="shrink-0 ml-2 relative" data-click-area="action-menu">
                            <ActionMenu items={actionMenuItems} />
                        </div>
                    </div>

                    {/* 底部：状态信息和已用完标签 */}
                    <div className={`flex justify-between ${bean.image ? 'items-end' : 'items-start'}`}>
                        {/* 左侧：两排信息显示 */}
                        <div className="flex-1 min-w-0 overflow-hidden space-y-0.5">
                            {/* 第一排：克数和价格 */}
                            <div className="flex items-center text-[11px] tracking-widest text-neutral-600 dark:text-neutral-400 truncate">
                                {/* 剩余量信息 */}
                                {bean.capacity && bean.remaining && (
                                    <span className="shrink-0">
                                        <span
                                            onClick={(e) => onRemainingClick(bean, e)}
                                            className="cursor-pointer"
                                            data-click-area="remaining-edit"
                                        >
                                            <span className="border-dashed border-b border-neutral-400 dark:border-neutral-600 transition-colors">
                                                {formatNumber(bean.remaining)}
                                            </span>
                                            /{formatNumber(bean.capacity)}克
                                        </span>
                                    </span>
                                )}

                                {/* 分隔符 */}
                                {bean.capacity && bean.remaining &&
                                 !hidePrice && bean.price && bean.capacity && (
                                    <span className="mx-2 shrink-0">·</span>
                                )}

                                {/* 价格信息 */}
                                {!hidePrice && bean.price && bean.capacity && (
                                    <span className="shrink-0">
                                        {formatPricePerGram(bean.price, bean.capacity)}
                                    </span>
                                )}
                            </div>

                            {/* 第二排：日期和状态 */}
                            <div className="flex items-center text-[11px] tracking-widest text-neutral-600 dark:text-neutral-400 truncate">
                                {/* 烘焙日期 */}
                                {bean.roastDate && !hideRoastDate && !bean.isInTransit && (
                                    <span className="shrink-0">
                                        {formatDateShort(bean.roastDate)}
                                    </span>
                                )}

                                {/* 分隔符 */}
                                {bean.roastDate && !hideRoastDate && !bean.isInTransit &&
                                 (bean.isInTransit || bean.isFrozen || bean.roastDate) && (
                                    <span className="mx-2 shrink-0">·</span>
                                )}

                                {/* 状态信息 */}
                                {(bean.isInTransit || bean.isFrozen || bean.roastDate) && (
                                    <span className="shrink-0">
                                        {flavorInfo.status}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* 右侧：已用完标签 */}
                        {isEmpty && (
                            <div className="text-[11px] font-normal px-1.5 py-0.5 rounded-full bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300 shrink-0 ml-2">
                                已用完
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 备注区域 - 在整个内容下方独立显示 */}
            {bean.notes && (
                <div className="mt-3">
                    <div className="bg-neutral-100/50 dark:bg-neutral-800/50 px-3 py-2 border border-neutral-200/50 dark:border-neutral-800">
                        <div className="text-[11px] tracking-widest text-neutral-600 dark:text-neutral-400 whitespace-pre-line leading-tight">
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
                    </div>
                </div>
            )}
        </div>
    )
}

// 使用 React.memo 包装组件以避免不必要的重新渲染
export default React.memo(BeanListItem) 