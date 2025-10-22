'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, Search, RefreshCw } from 'lucide-react'
import { calculateFlavorInfo, type FlavorInfo } from '@/lib/utils/flavorPeriodUtils'
import { parseDateToTimestamp } from '@/lib/utils/dateUtils'
import type { CoffeeBean } from '@/types/app'

// 常量定义，避免在每次渲染时重新创建
const CACHE_DURATION = 30 * 60 * 1000; // 30分钟缓存
const SESSION_CACHE_DURATION = 5 * 60 * 1000; // 5分钟会话缓存
const PULL_THRESHOLD = 80; // 触发刷新的距离阈值

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
    const [_searchCache, setSearchCache] = useState<Map<string, CoffeeBean[]>>(new Map());
    
    // 全部咖啡豆数据
    const [allBeans, setAllBeans] = useState<CoffeeBean[]>([]);
    const [beansByBrand, setBeansByBrand] = useState<Record<string, CoffeeBean[]>>({});
    const [isLoadingAll, setIsLoadingAll] = useState(true);
    
    // 缓存相关
    const [lastOpenTime, setLastOpenTime] = useState<number | null>(null);
    
    // 下拉刷新相关
    const [isPullRefreshing, setIsPullRefreshing] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    const [touchStartY, setTouchStartY] = useState(0);
    const [isAtTop, setIsAtTop] = useState(true);

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

    // 历史栈管理 - 支持硬件返回键和浏览器返回按钮
    useEffect(() => {
        if (!isOpen) return

        // 添加搜索模态框历史记录
        window.history.pushState({ modal: 'bean-search' }, '')

        // 监听返回事件
        const handlePopState = (event: PopStateEvent) => {
            // 检查是否是我们的模态框状态
            if (event.state?.modal !== 'bean-search') {
                // 如果当前还显示模态框，说明用户按了返回键，关闭模态框
                if (isOpen) {
                    onClose()
                }
            }
        }

        window.addEventListener('popstate', handlePopState)

        return () => {
            window.removeEventListener('popstate', handlePopState)
        }
    }, [isOpen, onClose])

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

    // 从缓存加载或获取数据
    const loadBeansData = useCallback(async (forceRefresh = false) => {
        setIsLoadingAll(true);
        
        try {
            const { Storage } = await import('@/lib/core/storage');
            const now = Date.now();
            
            // 如果不是强制刷新，检查缓存
            if (!forceRefresh) {
                const cachedData = await Storage.get('brewGuideBeansData');
                const cachedExpiry = await Storage.get('brewGuideBeansCacheExpiry');
                
                // 检查会话缓存：如果距离上次打开时间很短，使用缓存
                const isRecentSession = lastOpenTime && (now - lastOpenTime) < SESSION_CACHE_DURATION;
                const isValidCache = cachedData && cachedExpiry && now < parseInt(cachedExpiry);
                
                if (isValidCache && isRecentSession) {
                    // 使用会话缓存的咖啡豆数据
                    const parsed = JSON.parse(cachedData);
                    setAllBeans(parsed.allBeans);
                    setBeansByBrand(parsed.beansByBrand);
                    setIsLoadingAll(false);
                    return;
                }
            }
            
            // 缓存过期或强制刷新，从网络获取最新数据
            // 获取咖啡豆数据
            const baseUrl = 'https://gitee.com/chu3/brew-guide-bean-data/raw/master/coffee-beans-database.json';
            const proxyUrl = `https://cors.chu3.top/raw?url=${encodeURIComponent(`${baseUrl}?_=${now}`)}`;
            
            const response = await fetch(proxyUrl, { 
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`请求失败: ${response.status}`);
            }
            
            const text = await response.text();
            const databaseData = JSON.parse(text);
            
            // 提取所有品牌下的咖啡豆
            let allBeansData: CoffeeBean[] = [];
            const beansByBrandData: Record<string, CoffeeBean[]> = {};
            
            Object.keys(databaseData).forEach(brand => {
                // 跳过 meta 信息
                if (brand === 'meta' || !Array.isArray(databaseData[brand])) {
                    return;
                }
                
                const brandBeans = databaseData[brand].map((bean: Record<string, unknown>): CoffeeBean => {
                    // 构建咖啡豆对象，只设置确实有值的字段
                    const coffeeBean: CoffeeBean = {
                        // 核心标识
                        id: `db-${brand}-${bean.name}`,
                        timestamp: Date.now(),
                        name: bean.name as string,
                        
                        // 基本信息 - 只设置确实有值的字段
                        image: bean.image ? (bean.image as string).trim() : '',
                        capacity: bean.capacity ? `${bean.capacity}`.trim() : '',
                        remaining: bean.capacity ? `${bean.capacity}`.trim() : '', // 剩余量等于总量
                        price: bean.price ? `${bean.price}`.trim() : '',
                        
                        // 产品特性 - 只设置确实有值的字段
                        roastLevel: bean.roastLevel ? (bean.roastLevel as string).trim() : '',
                        roastDate: bean.roastDate ? (bean.roastDate as string).trim() : '',
                        flavor: (Array.isArray(bean.flavor) && bean.flavor.length > 0) ? bean.flavor as string[] : [],
                        notes: bean.notes ? (bean.notes as string).trim() : '',
                        
                        brand: brand, // 添加品牌信息
                    };
                    
                    // 条件设置可选字段
                    if (bean.startDay !== undefined) coffeeBean.startDay = bean.startDay as number;
                    if (bean.endDay !== undefined) coffeeBean.endDay = bean.endDay as number;
                    if (bean.isFrozen !== undefined) coffeeBean.isFrozen = bean.isFrozen as boolean;
                    if (bean.isInTransit !== undefined) coffeeBean.isInTransit = bean.isInTransit as boolean;
                    if (bean.beanType) coffeeBean.beanType = bean.beanType as "espresso" | "filter";
                    if (bean.blendComponents && Array.isArray(bean.blendComponents) && bean.blendComponents.length > 0) {
                        coffeeBean.blendComponents = bean.blendComponents as Array<{ origin?: string; process?: string; variety?: string; percentage?: number }>;
                    }
                    
                    return coffeeBean;
                });
                allBeansData = allBeansData.concat(brandBeans);
                beansByBrandData[brand] = brandBeans;
            });
            
            // 缓存数据
            const cacheData = { allBeans: allBeansData, beansByBrand: beansByBrandData };
            const expiry = now + CACHE_DURATION;
            
            await Promise.all([
                Storage.set('brewGuideBeansData', JSON.stringify(cacheData)),
                Storage.set('brewGuideBeansCacheExpiry', expiry.toString())
            ]);
            
            setAllBeans(allBeansData);
            setBeansByBrand(beansByBrandData);
            
            // 更新打开时间
            setLastOpenTime(now);
            
        } catch (error) {
            console.error('加载咖啡豆数据失败:', error);
            // 出错时设置为空数组
            setAllBeans([]);
            setBeansByBrand({});
        } finally {
            setIsLoadingAll(false);
        }
    }, [lastOpenTime]); // 添加lastOpenTime依赖项
    
    // 初始化加载数据
    useEffect(() => {
        if (isOpen) {
            const now = Date.now();
            // 检查是否需要刷新数据
            const shouldRefresh = allBeans.length === 0 || 
                                 !lastOpenTime || 
                                 (now - lastOpenTime) > SESSION_CACHE_DURATION;
            
            if (shouldRefresh) {
                loadBeansData(!lastOpenTime); // 如果是第一次打开或会话超时，强制刷新
            }
            
            setLastOpenTime(now);
        }
    }, [isOpen, allBeans.length, loadBeansData, lastOpenTime]); // 添加lastOpenTime依赖项

    // 使用已加载的数据进行搜索（优化版本）
    const handleSearch = useCallback(async (query: string) => {
        if (!query.trim()) {
            setSearchResults([]);
            return;
        }

        const trimmedQuery = query.trim().toLowerCase();
        
        // 检查搜索缓存
        setSearchCache(currentCache => {
            if (currentCache.has(trimmedQuery)) {
                setSearchResults(currentCache.get(trimmedQuery)!);
                return currentCache;
            }
            return currentCache;
        });

        setIsSearching(true);
        
        try {
            // 在已加载的数据中搜索
            const filteredResults = allBeans.filter(bean => 
                bean.name.toLowerCase().includes(trimmedQuery) ||
                bean.brand?.toLowerCase().includes(trimmedQuery) ||
                bean.blendComponents?.some((comp) => 
                    comp.origin?.toLowerCase().includes(trimmedQuery) ||
                    comp.process?.toLowerCase().includes(trimmedQuery) ||
                    comp.variety?.toLowerCase().includes(trimmedQuery)
                ) ||
                bean.flavor?.some((f: string) => f.toLowerCase().includes(trimmedQuery)) ||
                bean.notes?.toLowerCase().includes(trimmedQuery)
            );
            
            // 缓存搜索结果（限制缓存大小）
            setSearchCache(currentCache => {
                const newCache = new Map(currentCache);
                if (newCache.size >= 50) {
                    // 清理最早的缓存项
                    const firstKey = newCache.keys().next().value;
                    if (firstKey) {
                        newCache.delete(firstKey);
                    }
                }
                newCache.set(trimmedQuery, filteredResults);
                return newCache;
            });
            
            setSearchResults(filteredResults);
        } catch (error) {
            console.error('搜索咖啡豆数据失败:', error);
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    }, [allBeans]);

    // 处理搜索输入变化（不再进行实时搜索）
    const handleSearchInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value;
        setSearchQuery(query);
        
        // 如果输入为空，立即清空搜索结果
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

    // 手动刷新数据
    const handleRefresh = useCallback(async () => {
        setIsPullRefreshing(true);
        setSearchCache(new Map()); // 清空搜索缓存
        try {
            await loadBeansData(true); // 强制刷新
        } finally {
            setIsPullRefreshing(false);
            setPullDistance(0);
        }
    }, [loadBeansData]);

    // 下拉刷新相关事件处理
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        if (isAtTop) {
            setTouchStartY(e.touches[0].clientY);
        }
    }, [isAtTop]);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!isAtTop || isPullRefreshing) return;
        
        const currentY = e.touches[0].clientY;
        const deltaY = currentY - touchStartY;
        
        if (deltaY > 0) {
            // 只有在需要时才阻止默认行为，并检查是否可以阻止
            if (e.cancelable) {
                e.preventDefault();
            }
            // 计算下拉距离，添加阻尼效果
            const distance = Math.min(deltaY * 0.5, PULL_THRESHOLD * 1.5);
            setPullDistance(distance);
        }
    }, [touchStartY, isAtTop, isPullRefreshing]); // PULL_THRESHOLD是外部常量，不需要依赖

    const handleTouchEnd = useCallback(() => {
        if (!isAtTop || isPullRefreshing) return;
        
        if (pullDistance >= PULL_THRESHOLD) {
            handleRefresh();
        } else {
            setPullDistance(0);
        }
    }, [isAtTop, isPullRefreshing, pullDistance, handleRefresh]);

    // 监听滚动位置
    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const scrollTop = e.currentTarget.scrollTop;
        setIsAtTop(scrollTop === 0);
    }, []);



    // 重置搜索状态
    const resetSearch = useCallback(() => {
        setSearchQuery('');
        setSearchResults([]);
        setIsSearching(false);
        // 可选：清理搜索缓存以释放内存
        // setSearchCache(new Map());
    }, []);

    // 关闭处理
    const handleClose = useCallback(() => {
        resetSearch();
        
        // 如果历史栈中有我们添加的模态框记录，先返回一步
        if (window.history.state?.modal === 'bean-search') {
            window.history.back()
        } else {
            // 否则直接调用 onClose
            onClose()
        }
    }, [resetSearch, onClose]);

    // 表单关闭时重置状态
    useEffect(() => {
        if (!isOpen) {
            resetSearch();
        }
    }, [isOpen, resetSearch]);

    // 工具函数 - 与 BeanListItem 保持一致
    const generateBeanTitle = useCallback((bean: CoffeeBean, showOnlyName: boolean = false): string => {
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
    }, []);

    const formatNumber = useCallback((value: string | undefined): string => {
        return !value ? '0' : (Number.isInteger(parseFloat(value)) ? Math.floor(parseFloat(value)).toString() : value);
    }, []);

    const formatDateShort = useCallback((dateStr: string): string => {
        try {
            const timestamp = parseDateToTimestamp(dateStr);
            const date = new Date(timestamp);
            const year = date.getFullYear().toString().slice(-2);
            return `${year}-${date.getMonth() + 1}-${date.getDate()}`;
        } catch {
            return dateStr;
        }
    }, []);

    const getAgingDaysText = useCallback((dateStr: string): string => {
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
    }, []);

    const formatPrice = useCallback((price: string, capacity: string): string => {
        const priceNum = parseFloat(price);
        const capacityNum = parseFloat(capacity.replace('g', ''));
        if (isNaN(priceNum) || isNaN(capacityNum) || capacityNum === 0) return '';

        const pricePerGram = (priceNum / capacityNum).toFixed(2);

        if (userSettings.showTotalPrice as boolean) {
            return `${priceNum}元(${pricePerGram}元/克)`;
        } else {
            return `${pricePerGram}元/克`;
        }
    }, [userSettings.showTotalPrice]);

    const getStatusDotColor = useCallback((phase: string): string => {
        const colors = {
            '养豆期': 'bg-amber-400',
            '赏味期': 'bg-green-400',
            '衰退期': 'bg-red-400',
            '在途': 'bg-blue-400',
            '冷冻': 'bg-cyan-400'
        };
        return colors[phase as keyof typeof colors] || 'bg-neutral-400';
    }, []);

    const getFlavorPeriodStatus = useCallback((flavorInfo: FlavorInfo): string => {
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
    }, []);

    const getFullNotesContent = useCallback((bean: CoffeeBean) => {
        if ((userSettings.showFlavorInfo as boolean) && bean.flavor?.length) {
            const flavorText = bean.flavor.join(' · ');
            return bean.notes ? `${flavorText}\n\n${bean.notes}` : flavorText;
        }
        return bean.notes || '';
    }, [userSettings.showFlavorInfo]);

    const getLineClampClass = useCallback((lines: number): string => {
        const clampClasses = ['', 'line-clamp-1', 'line-clamp-2', 'line-clamp-3', 'line-clamp-4', 'line-clamp-5', 'line-clamp-6'];
        return clampClasses[lines] || 'line-clamp-3';
    }, []);

    // 选择搜索结果
    const handleSelectSearchResult = useCallback((bean: CoffeeBean) => {
        onSelectBean(bean);
        handleClose();
    }, [onSelectBean, handleClose]);

    // 统一的咖啡豆项渲染函数
    const renderBeanItem = useCallback((bean: CoffeeBean, index: number, keyPrefix: string = '') => {
        const displayTitle = generateBeanTitle(bean, userSettings.showOnlyBeanName as boolean);
        const flavorInfo = calculateFlavorInfo(bean);
        const shouldShowNotes = ((userSettings.showFlavorInfo as boolean) && bean.flavor?.length) || bean.notes;

        return (
            <div
                key={`${keyPrefix}${index}`}
                onClick={() => handleSelectSearchResult(bean)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelectSearchResult(bean);
                    }
                }}
                tabIndex={0}
                role="button"
                className="cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 rounded"
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

                    <div className="flex flex-col gap-y-2">
                        <div className={`flex flex-col justify-center gap-y-1.5`}>
                            <div className="text-xs font-medium text-neutral-800 dark:text-neutral-100 pr-2 leading-tight line-clamp-2">
                                {displayTitle}
                            </div>

                            <div className="text-xs font-medium tracking-wide text-neutral-600 dark:text-neutral-400 leading-relaxed">
                                <span className="inline">
                                    {bean.roastDate 
                                        ? ((userSettings.dateDisplayMode as string) === 'flavorPeriod'
                                            ? getFlavorPeriodStatus(flavorInfo)
                                            : (userSettings.dateDisplayMode as string) === 'agingDays'
                                            ? getAgingDaysText(bean.roastDate)
                                            : formatDateShort(bean.roastDate))
                                        : `需养豆 ${bean.startDay || 3}天`
                                    }
                                </span>
                                {(bean.capacity || (bean.price && bean.capacity)) && (
                                    <span className="mx-2 text-neutral-400 dark:text-neutral-600">·</span>
                                )}

                                {bean.capacity && (
                                    <span className="inline">
                                        {formatNumber(bean.capacity)}克
                                        {bean.price && bean.capacity && <span className="mx-2 text-neutral-400 dark:text-neutral-600">·</span>}
                                    </span>
                                )}

                                {bean.price && bean.capacity && (
                                    <span className="inline">{formatPrice(bean.price, bean.capacity)}</span>
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
    }, [
        userSettings,
        handleSelectSearchResult,
        generateBeanTitle,
        getStatusDotColor,
        getFlavorPeriodStatus,
        getAgingDaysText,
        formatDateShort,
        formatNumber,
        formatPrice,
        getFullNotesContent,
        getLineClampClass
    ]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="fixed inset-0 bg-neutral-50 dark:bg-neutral-900 z-[70] flex flex-col max-w-[500px] mx-auto"
                    initial={{ x: "100%" }}
                    animate={{ x: 0 }}
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
                            className="flex items-center justify-center w-8 h-8 rounded-full text-neutral-800 dark:text-white hover:opacity-80 transition-opacity"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>

                        {/* 搜索框 */}
                        <div className="flex-1">
                            <form onSubmit={(e) => { 
                                e.preventDefault(); 
                                if (searchQuery.trim()) {
                                    handleSearch(searchQuery.trim());
                                }
                            }} className="relative">
                                <input
                                    type="search"
                                    value={searchQuery}
                                    onChange={handleSearchInputChange}
                                    placeholder="搜索咖啡豆名称、品牌、风味..."
                                    enterKeyHint="search"
                                    autoComplete="off"
                                    className="w-full h-9 px-4 pr-12 bg-neutral-100/80 dark:bg-neutral-800/80 text-xs text-neutral-800 dark:text-neutral-200 placeholder-neutral-500 dark:placeholder-neutral-400 focus:outline-hidden focus:bg-white dark:focus:bg-neutral-800 focus:border-neutral-300 dark:focus:border-neutral-600 transition-colors"
                                />
                                <button
                                    type="submit"
                                    onClick={handleSearchButtonClick}
                                    disabled={!searchQuery.trim()}
                                    className="absolute right-1 top-1/2 transform -translate-y-1/2 w-8 h-8 rounded flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {isSearching ? (
                                        <div className="animate-spin w-4 h-4 border-2 border-neutral-400 border-t-neutral-700 dark:border-neutral-500 dark:border-t-neutral-300 rounded-full"></div>
                                    ) : (
                                        <Search className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
                                    )}
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* 下拉刷新指示器 - 放在内容区域外面，避免被遮挡 */}
                    {(pullDistance > 0 || isPullRefreshing) && (
                        <div 
                            className="absolute top-24 left-0 right-0 z-10 flex items-center justify-center py-3 text-neutral-600 dark:text-neutral-400 "
                            style={{
                                opacity: Math.min(1, pullDistance / PULL_THRESHOLD)
                            }}
                        >
                            <div className="flex items-center gap-2 text-xs font-medium">
                                {isPullRefreshing ? (
                                    <>
                                        <div className="animate-spin w-4 h-4 border-2 border-neutral-400 border-t-neutral-700 dark:border-neutral-500 dark:border-t-neutral-300 rounded-full"></div>
                                        <span>正在刷新数据...</span>
                                    </>
                                ) : pullDistance >= PULL_THRESHOLD ? (
                                    <>
                                        <RefreshCw className="w-4 h-4" />
                                        <span>松开刷新</span>
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw className="w-4 h-4" />
                                        <span>下拉刷新</span>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* 内容区域 */}
                    <div 
                        className="flex-1 overflow-y-auto pb-safe-bottom"
                        onScroll={handleScroll}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                        style={{
                            transform: `translateY(${pullDistance}px)`,
                            transition: isPullRefreshing || pullDistance === 0 ? 'transform 0.3s ease-out' : 'none',
                            // 正常情况下允许垂直滚动
                            overflowY: 'auto',
                            // 使用 CSS 来处理触摸行为
                            touchAction: 'pan-y pinch-zoom'
                        }}
                    >
                        <div className="px-6 pt-4">
                            {searchQuery ? (
                                // 显示搜索结果
                                <div className="space-y-5">
                                    {searchResults.length > 0 ? (
                                        searchResults.map((bean, index) => renderBeanItem(bean, index, 'search-'))
                                    ) : (
                                        <div className="text-center text-neutral-500 dark:text-neutral-400 py-16">
                                            <p className="text-xs mt-1 opacity-60">试试搜索其他关键词</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                // 显示所有咖啡豆，按品牌分组
                                <div className="space-y-6">
                                    {isLoadingAll && !isPullRefreshing ? (
                                        <div className="text-center text-neutral-500 dark:text-neutral-400 py-16">
                                            <div className="animate-spin w-6 h-6 border-2 border-neutral-400 border-t-neutral-700 dark:border-neutral-500 dark:border-t-neutral-300 rounded-full mx-auto mb-4"></div>
                                            <p className="text-sm">加载咖啡豆数据中...</p>
                                        </div>
                                    ) : Object.keys(beansByBrand).length > 0 ? (
                                        Object.entries(beansByBrand).map(([brandName, beans]) => (
                                            <div key={brandName}>
                                                {/* 品牌标题 */}
                                                <div className="z-10 sticky top-0 bg-neutral-50 dark:bg-neutral-900 pb-3">
                                                    <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                                                        {brandName}
                                                    </h3>
                                                </div>

                                                {/* 品牌下的咖啡豆列表 */}
                                                <div className="space-y-5">
                                                    {beans.map((bean, index) => renderBeanItem(bean, index, `${brandName}-`))}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center text-neutral-500 dark:text-neutral-400 py-16">
                                            <p className="text-sm">暂无咖啡豆数据</p>
                                            <p className="text-xs mt-1 opacity-60">请检查网络连接</p>
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            {/* 免责声明 - 更加低调的设计 */}
                            <div className="px-6 pt-16 pb-6">
                                <p className="text-[10px] text-neutral-300 dark:text-neutral-600 text-center opacity-60 leading-relaxed">
                                    数据来源于网络公开资源，仅供学习参考，如有异议请联系 <a href="mailto:chuthree@163.com" className="underline hover:opacity-80">chuthree@163.com</a>
                                </p>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

export default BeanSearchModal