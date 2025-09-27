'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { calculateFlavorInfo, type FlavorInfo } from '@/lib/utils/flavorPeriodUtils'
import { parseDateToTimestamp } from '@/lib/utils/dateUtils'
import type { CoffeeBean } from '@/types/app'

interface BeanSearchModalProps {
    isOpen: boolean
    onClose: () => void
    onSelectBean: (beanData: CoffeeBean) => void
}

const BeanSearchModal: React.FC<BeanSearchModalProps> = ({
    isOpen,
    onClose,
    onSelectBean
}) => {
    // 搜索相关状态
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<CoffeeBean[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    // 获取用户设置
    const [userSettings, setUserSettings] = useState<Record<string, unknown>>({
        showOnlyBeanName: true,
        dateDisplayMode: 'date',
        showFlavorInfo: false,
        limitNotesLines: true,
        notesMaxLines: 3,
        showTotalPrice: false,
        showStatusDots: true
    });

    useEffect(() => {
        const loadUserSettings = async () => {
            try {
                const { Storage } = await import('@/lib/core/storage');
                const settingsStr = await Storage.get('brewGuideSettings');
                if (settingsStr) {
                    const settings = JSON.parse(settingsStr);
                    setUserSettings({
                        showOnlyBeanName: settings.showOnlyBeanName ?? true,
                        dateDisplayMode: settings.dateDisplayMode ?? 'date',
                        showFlavorInfo: settings.showFlavorInfo ?? false,
                        limitNotesLines: settings.limitNotesLines ?? true,
                        notesMaxLines: settings.notesMaxLines ?? 3,
                        showTotalPrice: settings.showTotalPrice ?? false,
                        showStatusDots: settings.showStatusDots ?? true
                    });
                }
            } catch (error) {
                console.error('加载用户设置失败:', error);
            }
        };
        loadUserSettings();
    }, []);

    // 真实的数据库搜索功能
    const handleSearch = useCallback(async (query: string) => {
        if (!query.trim()) {
            setSearchResults([]);
            return;
        }

        // 取消之前的请求
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        // 创建新的 AbortController
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        setIsSearching(true);
        
        try {
            // 使用自己部署的 CORS 代理服务
            const baseUrl = 'https://gitee.com/chu3/brew-guide-bean-data/raw/master/coffee-beans-database.json';
            // 使用自己部署的 CORS 代理服务 - HTTPS 版本
            const proxyUrl = `https://cors.chu3.top/raw?url=${encodeURIComponent(`${baseUrl}?_=${Date.now()}`)}`;
            
            console.warn('获取咖啡豆数据:', proxyUrl);
            const response = await fetch(proxyUrl, { 
                signal,
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`请求失败: ${response.status}`);
            }
            
            const text = await response.text();
            const databaseData = JSON.parse(text);
            
            // 搜索所有品牌下的咖啡豆
            let allBeans: CoffeeBean[] = [];
            Object.keys(databaseData).forEach(brand => {
                if (Array.isArray(databaseData[brand])) {
                    const brandBeans = databaseData[brand].map((bean: Record<string, unknown>): CoffeeBean => ({
                        id: `db-${brand}-${bean.name}`,
                        timestamp: Date.now(),
                        name: bean.name as string,
                        roastLevel: bean.roastLevel as string,
                        roastDate: "", // 数据库中没有烘焙日期
                        capacity: "200g", // 默认容量
                        remaining: "200g", // 默认剩余量
                        isFrozen: false,
                        isInTransit: false,
                        beanType: bean.beanType as "espresso" | "filter",
                        price: bean.price as string,
                        flavor: bean.flavor as string[],
                        notes: bean.notes as string,
                        blendComponents: bean.blendComponents as Array<{ origin?: string; process?: string; variety?: string; percentage?: number }>,
                        startDay: bean.startDay as number,
                        endDay: bean.endDay as number,
                        image: bean.image as string
                    }));
                    allBeans = allBeans.concat(brandBeans);
                }
            });
            
            // 过滤搜索结果
            const filteredResults = allBeans.filter(bean => 
                bean.name.toLowerCase().includes(query.toLowerCase()) ||
                bean.blendComponents?.some((comp) => 
                    comp.origin?.toLowerCase().includes(query.toLowerCase()) ||
                    comp.process?.toLowerCase().includes(query.toLowerCase()) ||
                    comp.variety?.toLowerCase().includes(query.toLowerCase())
                ) ||
                bean.flavor?.some((f: string) => f.toLowerCase().includes(query.toLowerCase())) ||
                bean.notes?.toLowerCase().includes(query.toLowerCase())
            );
            
            setSearchResults(filteredResults);
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                // 请求被取消，不做任何处理
                return;
            }
            console.error('搜索咖啡豆数据失败:', error);
            // 降级到模拟数据
            const mockResults: CoffeeBean[] = [
                {
                    id: 'db-mock-1',
                    timestamp: Date.now(),
                    name: "Voyage 黑森林",
                    roastLevel: "中度烘焙",
                    beanType: "espresso" as const,
                    price: "79.2",
                    capacity: "200g",
                    remaining: "200g",
                    roastDate: "",
                    flavor: ["巧克力", "坚果"],
                    notes: "Voyage 的招牌意式拼配豆",
                    blendComponents: [{
                        origin: "巴西",
                        process: "半日晒",
                        variety: "卡杜拉",
                        percentage: 60
                    }],
                    startDay: 3,
                    endDay: 28,
                    isFrozen: false,
                    isInTransit: false
                }
            ].filter(bean => 
                bean.name.toLowerCase().includes(query.toLowerCase())
            );
            setSearchResults(mockResults);
        } finally {
            setIsSearching(false);
        }
    }, []);

    // 处理搜索输入变化
    const handleSearchInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value;
        setSearchQuery(query);
        
        if (!query.trim()) {
            setSearchResults([]);
            setIsSearching(false);
        }
    }, []);

    // 处理搜索按钮点击
    const handleSearchButtonClick = useCallback(() => {
        if (searchQuery.trim()) {
            handleSearch(searchQuery.trim());
        }
    }, [searchQuery, handleSearch]);



    // 重置搜索状态
    const resetSearch = useCallback(() => {
        setSearchQuery('');
        setSearchResults([]);
        setIsSearching(false);
        
        // 取消进行中的请求
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
    }, []);

    // 关闭处理
    const handleClose = useCallback(() => {
        resetSearch();
        onClose();
    }, [resetSearch, onClose]);

    // 表单关闭时重置状态
    useEffect(() => {
        if (!isOpen) {
            resetSearch();
        }
    }, [isOpen, resetSearch]);

    // 工具函数 - 与 BeanListItem 保持一致
    const generateBeanTitle = (bean: CoffeeBean, showOnlyName: boolean = false): string => {
        if (showOnlyName) {
            return bean.name;
        }

        const additionalParams: string[] = [];
        
        if (bean.roastLevel) {
            additionalParams.push(bean.roastLevel);
        }
        
        if (bean.blendComponents?.[0]?.origin) {
            additionalParams.push(bean.blendComponents[0].origin);
        }

        return additionalParams.length > 0
            ? `${bean.name} ${additionalParams.join(' ')}`
            : bean.name;
    };

    const formatNumber = (value: string | undefined): string =>
        !value ? '0' : (Number.isInteger(parseFloat(value)) ? Math.floor(parseFloat(value)).toString() : value);

    const formatDateShort = (dateStr: string): string => {
        try {
            const timestamp = parseDateToTimestamp(dateStr);
            const date = new Date(timestamp);
            const year = date.getFullYear().toString().slice(-2);
            return `${year}-${date.getMonth() + 1}-${date.getDate()}`;
        } catch {
            return dateStr;
        }
    };

    const getAgingDaysText = (dateStr: string): string => {
        try {
            const timestamp = parseDateToTimestamp(dateStr);
            const roastDate = new Date(timestamp);
            const today = new Date();
            const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const roastDateOnly = new Date(roastDate.getFullYear(), roastDate.getMonth(), roastDate.getDate());
            const daysSinceRoast = Math.ceil((todayDate.getTime() - roastDateOnly.getTime()) / (1000 * 60 * 60 * 24));
            return `养豆${daysSinceRoast}天`;
        } catch {
            return '养豆0天';
        }
    };

    const formatPrice = (price: string, capacity: string): string => {
        const priceNum = parseFloat(price);
        const capacityNum = parseFloat(capacity.replace('g', ''));
        if (isNaN(priceNum) || isNaN(capacityNum) || capacityNum === 0) return '';

        const pricePerGram = (priceNum / capacityNum).toFixed(2);

        if (userSettings.showTotalPrice as boolean) {
            return `${priceNum}元(${pricePerGram}元/克)`;
        } else {
            return `${pricePerGram}元/克`;
        }
    };

    const getStatusDotColor = (phase: string): string => {
        const colors = {
            '养豆期': 'bg-amber-400',
            '赏味期': 'bg-green-400',
            '衰退期': 'bg-red-400',
            '在途': 'bg-blue-400',
            '冷冻': 'bg-cyan-400'
        };
        return colors[phase as keyof typeof colors] || 'bg-neutral-400';
    };

    const getFlavorPeriodStatus = (flavorInfo: FlavorInfo): string => {
        const phase = flavorInfo.phase;
        const remainingDays = flavorInfo.remainingDays;

        if (phase === '养豆期') {
            return `养豆 ${remainingDays}天`;
        } else if (phase === '赏味期') {
            return `赏味 ${remainingDays}天`;
        } else if (phase === '衰退期') {
            return '已衰退';
        } else if (phase === '在途') {
            return '在途';
        } else if (phase === '冷冻') {
            return '冷冻';
        } else {
            return '未知';
        }
    };

    const getFullNotesContent = (bean: CoffeeBean) => {
        if ((userSettings.showFlavorInfo as boolean) && bean.flavor?.length) {
            const flavorText = bean.flavor.join(' · ');
            return bean.notes ? `${flavorText}\n\n${bean.notes}` : flavorText;
        }
        return bean.notes || '';
    };

    const getLineClampClass = (lines: number): string => {
        const clampClasses = ['', 'line-clamp-1', 'line-clamp-2', 'line-clamp-3', 'line-clamp-4', 'line-clamp-5', 'line-clamp-6'];
        return clampClasses[lines] || 'line-clamp-3';
    };

    // 选择搜索结果
    const handleSelectSearchResult = useCallback((bean: CoffeeBean) => {
        onSelectBean(bean);
        handleClose();
    }, [onSelectBean, handleClose]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="fixed inset-0 bg-neutral-50 dark:bg-neutral-900 z-50 flex flex-col max-w-[500px] mx-auto"
                    initial={{ x: "100%" }}
                    animate={{ x: 0 }}
                    exit={{ x: "100%" }}
                    transition={{
                        duration: 0.35,
                        ease: [0.36, 0.66, 0.04, 1]
                    }}
                >
                    {/* 头部导航栏 */}
                    <div className="flex items-center px-4 py-4 pt-safe-top bg-neutral-50 dark:bg-neutral-900">
                        {/* 返回按钮 */}
                        <button
                            onClick={handleClose}
                            className="flex items-center justify-center w-10 h-10 rounded-full text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 transition-colors shrink-0"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>

                        {/* 搜索框 */}
                        <div className="flex-1">
                            <form onSubmit={(e) => { e.preventDefault(); if (searchQuery.trim()) handleSearch(searchQuery.trim()); }} className="relative">
                                <input
                                    type="search"
                                    value={searchQuery}
                                    onChange={handleSearchInputChange}
                                    placeholder="搜索咖啡豆名称、品牌、风味..."
                                    enterKeyHint="search"
                                    autoComplete="off"
                                    className="w-full h-10 px-4 pr-12 bg-neutral-100/80 dark:bg-neutral-800/80 text-xs text-neutral-800 dark:text-neutral-200 placeholder-neutral-500 dark:placeholder-neutral-400 focus:outline-hidden focus:bg-white dark:focus:bg-neutral-800 focus:border-neutral-300 dark:focus:border-neutral-600 transition-colors"
                                />
                                <button
                                    onClick={handleSearchButtonClick}
                                    disabled={!searchQuery.trim()}
                                    className="absolute right-1 top-1/2 transform -translate-y-1/2 w-8 h-8 rounded flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {isSearching ? (
                                        <div className="animate-spin w-4 h-4 border-2 border-neutral-400 border-t-neutral-700 dark:border-neutral-500 dark:border-t-neutral-300 rounded-full"></div>
                                    ) : (
                                        <svg className="w-4 h-4 text-neutral-600 dark:text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                    )}
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* 内容区域 */}
                    <div className="flex-1 overflow-y-auto pb-safe-bottom">
                        <div className="px-4 pt-4">
                            {searchResults.length > 0 || searchQuery ? (
                                <div className="space-y-3">
                                    {searchResults.length > 0 ? (
                                        searchResults.map((bean, index) => {
                                            const displayTitle = generateBeanTitle(bean, userSettings.showOnlyBeanName as boolean);
                                            const flavorInfo = calculateFlavorInfo(bean);
                                            const shouldShowNotes = ((userSettings.showFlavorInfo as boolean) && bean.flavor?.length) || bean.notes;

                                            return (
                                                <div
                                                    key={index}
                                                    onClick={() => handleSelectSearchResult(bean)}
                                                    className="cursor-pointer bg-neutral-100/80 dark:bg-neutral-800/20 hover:bg-neutral-200/60 dark:hover:bg-neutral-800/40 border transition-colors px-3 py-5"
                                                >
                                                    <div className="flex gap-3">
                                                        <div className="relative self-start">
                                                            <div className="w-14 h-14 relative shrink-0 rounded border border-neutral-200/50 dark:border-neutral-800/50 bg-neutral-100 dark:bg-neutral-800/20 overflow-hidden">
                                                                <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-neutral-400 dark:text-neutral-600">
                                                                    {bean.name ? bean.name.charAt(0) : '豆'}
                                                                </div>
                                                            </div>
                                                            {(userSettings.showStatusDots as boolean) && (
                                                                <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ${bean.roastDate ? getStatusDotColor(flavorInfo.phase) : 'bg-neutral-400'} border-2 border-neutral-50 dark:border-neutral-900`} />
                                                            )}
                                                        </div>

                                                        <div className="flex-1 min-w-0 flex flex-col gap-y-2">
                                                            <div className={`flex flex-col justify-center gap-y-1.5 ${shouldShowNotes ? '' : 'h-14'}`}>
                                                                <div className="text-xs font-medium text-neutral-800 dark:text-neutral-100 pr-2 leading-tight line-clamp-2">
                                                                    {displayTitle}
                                                                </div>

                                                                <div className="flex items-center text-xs font-medium tracking-wide text-neutral-600 dark:text-neutral-400">
                                                                    <span className="shrink-0">
                                                                        {bean.roastDate 
                                                                            ? ((userSettings.dateDisplayMode as string) === 'flavorPeriod'
                                                                                ? getFlavorPeriodStatus(flavorInfo)
                                                                                : (userSettings.dateDisplayMode as string) === 'agingDays'
                                                                                ? getAgingDaysText(bean.roastDate)
                                                                                : formatDateShort(bean.roastDate))
                                                                            : `需养豆 ${bean.startDay || 3}天`
                                                                        }
                                                                    </span>
                                                                    {((bean.capacity && bean.remaining) || (bean.price && bean.capacity)) && (
                                                                        <span className="mx-2 text-neutral-400 dark:text-neutral-600">·</span>
                                                                    )}

                                                                    {bean.capacity && bean.remaining && (
                                                                        <>
                                                                            <span className="shrink-0">
                                                                                <span className="border-dashed border-b border-neutral-400 dark:border-neutral-600">
                                                                                    {formatNumber(bean.remaining)}
                                                                                </span>
                                                                                /{formatNumber(bean.capacity)}克
                                                                            </span>
                                                                            {bean.price && bean.capacity && <span className="mx-2 text-neutral-400 dark:text-neutral-600">·</span>}
                                                                        </>
                                                                    )}

                                                                    {bean.price && bean.capacity && (
                                                                        <span className="shrink-0">{formatPrice(bean.price, bean.capacity)}</span>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {shouldShowNotes && (
                                                                <div className="text-xs font-medium bg-neutral-200/30 dark:bg-neutral-800/40 p-1.5 rounded tracking-widest text-neutral-800/70 dark:text-neutral-400/85 whitespace-pre-line leading-tight">
                                                                    <div className={(userSettings.limitNotesLines as boolean) ? getLineClampClass(userSettings.notesMaxLines as number) : ''}>
                                                                        {getFullNotesContent(bean)}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="text-center text-neutral-500 dark:text-neutral-400 py-16">
                                            <p className="text-sm">未找到相关咖啡豆</p>
                                            <p className="text-xs mt-1 opacity-60">试试搜索其他关键词</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center text-neutral-500 dark:text-neutral-400 py-16">
                                    <div className="text-4xl mb-4">☕</div>
                                    <p className="text-lg mb-2">搜索咖啡豆数据库</p>
                                    <p className="text-sm opacity-60">在上方搜索框中输入关键词</p>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

export default BeanSearchModal