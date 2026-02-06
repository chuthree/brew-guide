'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Virtuoso } from 'react-virtuoso';
import { CoffeeBean, BrewingNoteData } from '@/types/app';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { useBrewingNoteStore } from '@/lib/stores/brewingNoteStore';
import { formatBeanDisplayName } from '@/lib/utils/beanVarietyUtils';
import {
  getBeanRatingInfo,
  hasBeanRating,
  type BeanRatingInfo,
} from '@/lib/utils/beanRatingUtils';

// 下划线动画配置
const UNDERLINE_TRANSITION = {
  type: 'spring' as const,
  stiffness: 500,
  damping: 35,
  mass: 1,
};

export const SORT_OPTIONS = {
  ORIGINAL: 'original', // 添加原始排序选项
  RATING_DESC: 'rating_desc',
  RATING_ASC: 'rating_asc',
  NAME_ASC: 'name_asc',
  NAME_DESC: 'name_desc',
  PRICE_ASC: 'price_asc',
  PRICE_DESC: 'price_desc',
} as const;

export type RankingSortOption =
  (typeof SORT_OPTIONS)[keyof typeof SORT_OPTIONS];

// 带评分信息的咖啡豆类型
interface RatedCoffeeBean extends CoffeeBean {
  ratingInfo: BeanRatingInfo;
}

interface CoffeeBeanRankingProps {
  onClose?: () => void;
  onShowRatingForm?: (bean: CoffeeBean, onRatingSaved?: () => void) => void;
  sortOption?: RankingSortOption;
  hideFilters?: boolean;
  beanType?: 'all' | 'espresso' | 'filter' | 'omni';
  isOpen: boolean;
  isSearching?: boolean;
  searchQuery?: string;
  scrollParentRef?: HTMLElement;
}

const CoffeeBeanRanking: React.FC<CoffeeBeanRankingProps> = ({
  isOpen,
  onShowRatingForm,
  sortOption = SORT_OPTIONS.RATING_DESC,
  hideFilters = false,
  beanType: externalBeanType,
  isSearching = false,
  searchQuery = '',
  scrollParentRef,
}) => {
  // 获取烘焙商显示设置
  const roasterFieldEnabled = useSettingsStore(
    state => state.settings.roasterFieldEnabled
  );
  const roasterSeparator = useSettingsStore(
    state => state.settings.roasterSeparator
  );
  const roasterSettings = useMemo(
    () => ({ roasterFieldEnabled, roasterSeparator }),
    [roasterFieldEnabled, roasterSeparator]
  );

  // 获取笔记数据用于计算自动评分
  const notes = useBrewingNoteStore(state => state.notes);

  const [ratedBeans, setRatedBeans] = useState<RatedCoffeeBean[]>([]);
  const [unratedBeans, setUnratedBeans] = useState<CoffeeBean[]>([]);
  const [beanType, setBeanType] = useState<
    'all' | 'espresso' | 'filter' | 'omni'
  >(externalBeanType || 'all');
  const [showUnrated, setShowUnrated] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // 监听外部传入的筛选类型变化
  useEffect(() => {
    if (externalBeanType !== undefined) {
      setBeanType(externalBeanType);
    }
  }, [externalBeanType]);

  // 排序咖啡豆的函数（使用综合评分信息）
  const sortBeans = useCallback(
    (
      beansToSort: RatedCoffeeBean[],
      option: RankingSortOption
    ): RatedCoffeeBean[] => {
      const sorted = [...beansToSort];

      switch (option) {
        case SORT_OPTIONS.ORIGINAL:
          return sorted;

        case SORT_OPTIONS.RATING_DESC:
          return sorted.sort((a, b) => {
            return b.ratingInfo.rating - a.ratingInfo.rating;
          });

        case SORT_OPTIONS.RATING_ASC:
          return sorted.sort((a, b) => {
            return a.ratingInfo.rating - b.ratingInfo.rating;
          });

        case SORT_OPTIONS.NAME_ASC:
          return sorted.sort((a, b) => a.name.localeCompare(b.name));

        case SORT_OPTIONS.NAME_DESC:
          return sorted.sort((a, b) => b.name.localeCompare(a.name));

        case SORT_OPTIONS.PRICE_ASC:
          return sorted.sort((a, b) => {
            const aPrice = a.price
              ? parseFloat(a.price.replace(/[^\d.]/g, ''))
              : 0;
            const bPrice = b.price
              ? parseFloat(b.price.replace(/[^\d.]/g, ''))
              : 0;
            return aPrice - bPrice;
          });

        case SORT_OPTIONS.PRICE_DESC:
          return sorted.sort((a, b) => {
            const aPrice = a.price
              ? parseFloat(a.price.replace(/[^\d.]/g, ''))
              : 0;
            const bPrice = b.price
              ? parseFloat(b.price.replace(/[^\d.]/g, ''))
              : 0;
            return bPrice - aPrice;
          });

        default:
          return sorted;
      }
    },
    []
  );

  // 加载咖啡豆数据的函数
  const loadBeans = useCallback(async () => {
    if (!isOpen) return;

    try {
      const { getCoffeeBeanStore } =
        await import('@/lib/stores/coffeeBeanStore');
      const allBeans = getCoffeeBeanStore().beans;

      // 按类型筛选
      let filteredBeans = allBeans;
      if (beanType !== 'all') {
        filteredBeans = allBeans.filter(bean => bean.beanType === beanType);
      }

      // 计算每个豆子的评分信息，区分有评分和无评分
      const ratedBeansData: RatedCoffeeBean[] = [];
      const unratedBeansData: CoffeeBean[] = [];

      for (const bean of filteredBeans) {
        const hasRating = hasBeanRating(bean, notes as BrewingNoteData[]);
        if (hasRating) {
          const ratingInfo = getBeanRatingInfo(
            bean,
            notes as BrewingNoteData[]
          );
          ratedBeansData.push({ ...bean, ratingInfo });
        } else {
          unratedBeansData.push(bean);
        }
      }

      setRatedBeans(sortBeans(ratedBeansData, sortOption));
      setUnratedBeans(
        unratedBeansData.sort((a, b) => b.timestamp - a.timestamp)
      );
    } catch (error) {
      console.error('加载咖啡豆数据失败:', error);
      setRatedBeans([]);
      setUnratedBeans([]);
    }
  }, [isOpen, beanType, sortOption, sortBeans, notes]);

  // 在组件挂载、isOpen变化、beanType变化、sortOption变化或refreshTrigger变化时重新加载数据
  useEffect(() => {
    loadBeans();
  }, [loadBeans, refreshTrigger]);

  // 计算每克价格
  const calculatePricePerGram = (bean: CoffeeBean) => {
    if (!bean.price || !bean.capacity) return null;

    const price = parseFloat(bean.price.replace(/[^\d.]/g, ''));
    const capacity = parseFloat(bean.capacity.replace(/[^\d.]/g, ''));

    if (isNaN(price) || isNaN(capacity) || capacity === 0) return null;

    return (price / capacity).toFixed(2);
  };

  // 评分保存后的回调函数
  const handleRatingSaved = useCallback(() => {
    // 触发数据刷新
    setRefreshTrigger(prev => prev + 1);

    // 不再自动折叠未评分列表，让用户自行控制
  }, []);

  // 搜索过滤逻辑
  const filteredRatedBeans = React.useMemo(() => {
    if (!isSearching || !searchQuery.trim()) {
      return ratedBeans;
    }

    const query = searchQuery.toLowerCase().trim();
    const queryTerms = query.split(/\s+/).filter(term => term.length > 0);

    return ratedBeans.filter(bean => {
      const nameMatch = bean.name?.toLowerCase().includes(query);
      const roasterMatch = bean.roaster?.toLowerCase().includes(query);
      const roastLevelMatch = bean.roastLevel?.toLowerCase().includes(query);
      const notesMatch =
        bean.notes?.toLowerCase().includes(query) ||
        bean.ratingNotes?.toLowerCase().includes(query);

      const multiTermMatch = queryTerms.every(term => {
        return (
          bean.name?.toLowerCase().includes(term) ||
          bean.roaster?.toLowerCase().includes(term) ||
          bean.roastLevel?.toLowerCase().includes(term) ||
          bean.notes?.toLowerCase().includes(term) ||
          bean.ratingNotes?.toLowerCase().includes(term)
        );
      });

      return (
        nameMatch ||
        roasterMatch ||
        roastLevelMatch ||
        notesMatch ||
        multiTermMatch
      );
    });
  }, [ratedBeans, isSearching, searchQuery]);

  const filteredUnratedBeans = React.useMemo(() => {
    if (!isSearching || !searchQuery.trim()) {
      return unratedBeans;
    }

    const query = searchQuery.toLowerCase().trim();
    const queryTerms = query.split(/\s+/).filter(term => term.length > 0);

    return unratedBeans.filter(bean => {
      // 检查豆子名称
      const nameMatch = bean.name?.toLowerCase().includes(query);

      // 检查烘焙商
      const roasterMatch = bean.roaster?.toLowerCase().includes(query);

      // 检查烘焙度
      const roastLevelMatch = bean.roastLevel?.toLowerCase().includes(query);

      // 检查备注
      const notesMatch = bean.notes?.toLowerCase().includes(query);

      // 检查风味描述（如果有）
      const flavorMatch = bean.flavor?.some(f =>
        f.toLowerCase().includes(query)
      );

      // 多关键词搜索：所有关键词都必须在某个字段中找到
      const multiTermMatch = queryTerms.every(term => {
        return (
          bean.name?.toLowerCase().includes(term) ||
          bean.roaster?.toLowerCase().includes(term) ||
          bean.roastLevel?.toLowerCase().includes(term) ||
          bean.notes?.toLowerCase().includes(term) ||
          bean.flavor?.some(f => f.toLowerCase().includes(term))
        );
      });

      return (
        nameMatch ||
        roasterMatch ||
        roastLevelMatch ||
        notesMatch ||
        flavorMatch ||
        multiTermMatch
      );
    });
  }, [unratedBeans, isSearching, searchQuery]);

  const handleRateBeanClick = (bean: CoffeeBean) => {
    // 将回调函数传递给评分表单
    onShowRatingForm?.(bean, handleRatingSaved);
  };

  // 切换显示未评分咖啡豆
  const toggleShowUnrated = () => {
    setShowUnrated(prev => !prev);
  };

  if (!isOpen) return null;

  return (
    <div className="coffee-bean-ranking-container pb-16">
      {/* 头部 - 只在hideFilters为false时显示 */}
      {!hideFilters && (
        <>
          {/* 豆子筛选选项卡 */}
          <div className="flex justify-between border-b border-neutral-200/50 px-3 dark:border-neutral-800">
            <div className="flex">
              <button
                className={`relative px-3 pb-1.5 text-xs ${beanType === 'all' ? 'text-neutral-800 dark:text-neutral-100' : 'text-neutral-600 dark:text-neutral-400'}`}
                onClick={() => setBeanType('all')}
              >
                <span className="relative">全部豆子</span>
                {beanType === 'all' && (
                  <motion.span
                    layoutId="ranking-internal-underline"
                    className="absolute inset-x-0 bottom-0 h-px bg-neutral-800 dark:bg-white"
                    transition={UNDERLINE_TRANSITION}
                  />
                )}
              </button>
              <button
                className={`relative px-3 pb-1.5 text-xs ${beanType === 'espresso' ? 'text-neutral-800 dark:text-neutral-100' : 'text-neutral-600 dark:text-neutral-400'}`}
                onClick={() => setBeanType('espresso')}
              >
                <span className="relative">意式豆</span>
                {beanType === 'espresso' && (
                  <motion.span
                    layoutId="ranking-internal-underline"
                    className="absolute inset-x-0 bottom-0 h-px bg-neutral-800 dark:bg-white"
                    transition={UNDERLINE_TRANSITION}
                  />
                )}
              </button>
              <button
                className={`relative px-3 pb-1.5 text-xs ${beanType === 'filter' ? 'text-neutral-800 dark:text-neutral-100' : 'text-neutral-600 dark:text-neutral-400'}`}
                onClick={() => setBeanType('filter')}
              >
                <span className="relative">手冲豆</span>
                {beanType === 'filter' && (
                  <motion.span
                    layoutId="ranking-internal-underline"
                    className="absolute inset-x-0 bottom-0 h-px bg-neutral-800 dark:bg-white"
                    transition={UNDERLINE_TRANSITION}
                  />
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {/* 已评分咖啡豆区域 */}
      {filteredRatedBeans.length === 0 ? (
        <div className="flex h-28 items-center justify-center text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
          {isSearching && ratedBeans.length > 0 ? (
            <div className="text-center">
              <div>[ 没有找到匹配的咖啡豆 ]</div>
              <div className="mt-1 text-[9px] opacity-70">
                尝试使用其他关键词搜索
              </div>
            </div>
          ) : (
            <div>[ 有咖啡豆数据后，再来查看吧～ ]</div>
          )}
        </div>
      ) : (
        <div className="w-full">
          <Virtuoso
            data={filteredRatedBeans}
            customScrollParent={scrollParentRef}
            itemContent={(index, bean) => (
              <div
                className={`${index < filteredRatedBeans.length - 1 ? 'border-b border-neutral-200/60 dark:border-neutral-800/40' : ''}`}
              >
                <div className="flex items-start px-6 py-3">
                  <div className="mr-2 w-4 shrink-0 text-xs font-medium text-neutral-600 dark:text-neutral-400">
                    {index + 1}
                  </div>

                  <div
                    className="min-w-0 flex-1 cursor-pointer"
                    onClick={() => handleRateBeanClick(bean)}
                  >
                    <div className="flex items-center leading-none">
                      <div className="truncate text-xs font-medium text-neutral-800 dark:text-neutral-100">
                        {formatBeanDisplayName(bean, roasterSettings)}
                      </div>
                      <div className="ml-2 shrink-0 text-xs font-medium text-neutral-800 dark:text-neutral-100">
                        {bean.ratingInfo.isAutoCalculated && (
                          <span className="mr-0.5 opacity-30">≈</span>
                        )}
                        +{bean.ratingInfo.rating}
                      </div>
                    </div>
                    <div className="mt-1.5 text-justify text-xs font-medium text-neutral-600 dark:text-neutral-400">
                      {(() => {
                        const infoArray: (React.ReactNode | string)[] = [];

                        if (beanType === 'all') {
                          const currentBeanType = bean.beanType;
                          infoArray.push(
                            currentBeanType === 'espresso'
                              ? '意式豆'
                              : currentBeanType === 'filter'
                                ? '手冲豆'
                                : '全能豆'
                          );
                        }

                        if (bean.roastLevel && bean.roastLevel !== '未知') {
                          infoArray.push(bean.roastLevel);
                        }

                        const pricePerGram = calculatePricePerGram(bean);
                        if (pricePerGram) {
                          infoArray.push(`${pricePerGram}元/克`);
                        }

                        return infoArray.map((info, index) => (
                          <React.Fragment key={index}>
                            {index > 0 && <span className="mx-1">·</span>}
                            {info}
                          </React.Fragment>
                        ));
                      })()}
                    </div>

                    {(() => {
                      const rn = bean.ratingNotes;
                      return typeof rn === 'string' && rn.trim();
                    })() && (
                      <div className="mt-2">
                        <div className="rounded bg-neutral-200/30 p-1.5 text-xs leading-tight font-medium tracking-widest whitespace-pre-wrap text-neutral-800/70 dark:bg-neutral-800/40 dark:text-neutral-400/85">
                          {bean.ratingNotes as string}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          />
        </div>
      )}

      {/* 分割线和未评分咖啡豆区域 */}
      {filteredUnratedBeans.length > 0 && (
        <div className="mt-4">
          <div
            className="relative mb-4 flex cursor-pointer items-center"
            onClick={toggleShowUnrated}
          >
            <div className="grow border-t border-neutral-200/50 dark:border-neutral-800/50"></div>
            <button className="mx-3 flex items-center justify-center text-[10px] text-neutral-600 dark:text-neutral-400">
              {isSearching &&
              filteredUnratedBeans.length !== unratedBeans.length
                ? `${filteredUnratedBeans.length}/${unratedBeans.length}款未评分咖啡豆`
                : `${unratedBeans.length}款未评分咖啡豆`}
              <svg
                className={`ml-1 h-3 w-3 transition-transform duration-200 ${showUnrated ? 'rotate-180' : ''}`}
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M6 9L12 15L18 9"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <div className="grow border-t border-neutral-200/50 dark:border-neutral-800/50"></div>
          </div>

          {/* 未评分咖啡豆列表 */}
          {showUnrated && (
            <div className="opacity-60">
              {filteredUnratedBeans.map((bean, index) => (
                <div
                  key={bean.id}
                  className={`${index < filteredUnratedBeans.length - 1 ? 'border-b border-neutral-200/60 dark:border-neutral-800/40' : ''}`}
                >
                  <div className="flex items-start justify-between px-6 py-2.5">
                    <div className="flex items-start">
                      {/* 咖啡豆信息 */}
                      <div className="cursor-pointer">
                        <div className="flex items-center">
                          <div className="text-xs text-neutral-800 dark:text-neutral-100">
                            {formatBeanDisplayName(bean, roasterSettings)}
                          </div>
                        </div>
                        <div className="mt-0.5 text-justify text-xs text-neutral-600 dark:text-neutral-400">
                          {(() => {
                            // 显示信息数组
                            const infoArray: (React.ReactNode | string)[] = [];

                            // 豆子类型 - 只有在"全部豆子"视图下显示
                            if (beanType === 'all') {
                              infoArray.push(
                                bean.beanType === 'espresso'
                                  ? '意式豆'
                                  : bean.beanType === 'filter'
                                    ? '手冲豆'
                                    : '全能豆'
                              );
                            }

                            // Roast Level - Conditionally display
                            if (bean.roastLevel && bean.roastLevel !== '未知') {
                              infoArray.push(bean.roastLevel);
                            }

                            // 每克价格
                            const pricePerGram = calculatePricePerGram(bean);
                            if (pricePerGram) {
                              infoArray.push(`${pricePerGram}元/克`);
                            }

                            return infoArray.map((info, index) => (
                              <React.Fragment key={index}>
                                {index > 0 && <span className="mx-1">·</span>}
                                {info}
                              </React.Fragment>
                            ));
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* 添加评分按钮 */}
                    <button
                      onClick={() => handleRateBeanClick(bean as CoffeeBean)}
                      className="text-xs text-neutral-800 hover:opacity-80 dark:text-neutral-100"
                    >
                      + 添加评分
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CoffeeBeanRanking;
