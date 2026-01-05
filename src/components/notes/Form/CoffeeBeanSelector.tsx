'use client';

import React, { useMemo, useRef, useEffect, useState } from 'react';
import { Virtuoso } from 'react-virtuoso';
import Image from 'next/image';
import { Plus } from 'lucide-react';
import type { CoffeeBean } from '@/types/app';
import {
  getRoasterLogoSync,
  useSettingsStore,
} from '@/lib/stores/settingsStore';
import {
  formatBeanDisplayName,
  getRoasterName,
} from '@/lib/utils/beanVarietyUtils';
import { sortBeansByFlavorPeriod } from '@/lib/utils/beanSortUtils';
import { parseDateToTimestamp } from '@/lib/utils/dateUtils';
import {
  calculateFlavorInfo,
  getDefaultFlavorPeriodByRoastLevelSync,
} from '@/lib/utils/flavorPeriodUtils';

interface CoffeeBeanSelectorProps {
  coffeeBeans: CoffeeBean[];
  selectedCoffeeBean: CoffeeBean | null;
  onSelect: (bean: CoffeeBean | null) => void;
  /** 创建待定咖啡豆的回调（延迟到笔记保存时才真正创建） */
  onCreatePendingBean?: (name: string) => void;
  searchQuery?: string;
  highlightedBeanId?: string | null;
  scrollParentRef?: HTMLElement;
  showStatusDots?: boolean;
  /** 是否显示顶部的"跳过咖啡豆选择 / 不使用咖啡豆"选项，默认 true */
  showSkipOption?: boolean;
}

// 定义列表项类型
type VirtuosoItem =
  | { __type: 'create'; name: string }
  | { __type: 'bean'; bean: CoffeeBean };

// 咖啡豆图片组件（支持烘焙商图标）
const BeanImage: React.FC<{
  bean: CoffeeBean;
  roasterSettings: {
    roasterFieldEnabled?: boolean;
    roasterSeparator?: ' ' | '/';
  };
}> = ({ bean, roasterSettings }) => {
  const [imageError, setImageError] = useState(false);
  const [roasterLogo, setRoasterLogo] = useState<string | null>(null);

  useEffect(() => {
    if (!bean.name || bean.image) {
      return;
    }

    const roasterName = getRoasterName(bean, roasterSettings);
    if (roasterName && roasterName !== '未知烘焙商') {
      const logo = getRoasterLogoSync(roasterName);
      setRoasterLogo(logo || null);
    }
  }, [bean.name, bean.image, bean.roaster, roasterSettings]);

  const roasterName = getRoasterName(bean, roasterSettings);

  return (
    <>
      {bean.image && !imageError ? (
        <Image
          src={bean.image}
          alt={bean.name || '咖啡豆图片'}
          height={48}
          width={48}
          unoptimized
          style={{ width: '100%', height: '100%' }}
          className="object-cover"
          sizes="48px"
          priority={true}
          loading="eager"
          onError={() => setImageError(true)}
          placeholder="blur"
          blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
        />
      ) : roasterLogo && !imageError ? (
        <Image
          src={roasterLogo}
          alt={roasterName || '烘焙商图标'}
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
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-neutral-400 dark:text-neutral-600">
          {bean.name ? bean.name.charAt(0) : '豆'}
        </div>
      )}
    </>
  );
};

const CoffeeBeanSelector: React.FC<CoffeeBeanSelectorProps> = ({
  coffeeBeans,
  selectedCoffeeBean: _selectedCoffeeBean,
  onSelect,
  onCreatePendingBean,
  searchQuery = '',
  highlightedBeanId = null,
  scrollParentRef,
  showStatusDots = true,
  showSkipOption = true,
}) => {
  const beanItemsRef = useRef<Map<string, HTMLDivElement>>(new Map());

  // 获取烘焙商字段设置
  const roasterFieldEnabled = useSettingsStore(
    state => state.settings.roasterFieldEnabled
  );
  const roasterSeparator = useSettingsStore(
    state => state.settings.roasterSeparator
  );
  const roasterSettings = useMemo(
    () => ({
      roasterFieldEnabled,
      roasterSeparator,
    }),
    [roasterFieldEnabled, roasterSeparator]
  );

  // 获取日期显示模式设置
  const dateDisplayMode = useSettingsStore(
    state => state.settings.dateDisplayMode ?? 'date'
  );
  const showPrice = useSettingsStore(
    state => state.settings.showPrice !== false
  );
  const showTotalPrice = useSettingsStore(
    state => state.settings.showTotalPrice ?? false
  );

  const setItemRef = React.useCallback(
    (id: string) => (node: HTMLDivElement | null) => {
      if (node) {
        beanItemsRef.current.set(id, node);
      } else {
        beanItemsRef.current.delete(id);
      }
    },
    []
  );

  useEffect(() => {
    if (highlightedBeanId && beanItemsRef.current.has(highlightedBeanId)) {
      const node = beanItemsRef.current.get(highlightedBeanId);
      node?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [highlightedBeanId]);

  const availableBeans = useMemo(() => {
    const filtered = coffeeBeans.filter(bean => {
      if (bean.beanState === 'green') {
        return false;
      }
      if (!bean.capacity || bean.capacity === '0' || bean.capacity === '0g') {
        return true;
      }
      const remaining =
        typeof bean.remaining === 'string'
          ? parseFloat(bean.remaining)
          : Number(bean.remaining);
      return remaining > 0;
    });
    return sortBeansByFlavorPeriod(filtered);
  }, [coffeeBeans]);

  const filteredBeans = useMemo(() => {
    if (!searchQuery?.trim()) return availableBeans;
    const query = searchQuery.toLowerCase().trim();
    return availableBeans.filter(bean =>
      bean.name?.toLowerCase().includes(query)
    );
  }, [availableBeans, searchQuery]);

  // 构造用于渲染的数据：当搜索无结果时显示"创建并选择"选项
  const virtuosoData = useMemo((): VirtuosoItem[] => {
    const trimmedQuery = searchQuery?.trim() || '';

    // 如果有搜索内容但没有匹配结果，显示创建选项
    if (trimmedQuery && filteredBeans.length === 0 && onCreatePendingBean) {
      return [{ __type: 'create', name: trimmedQuery }];
    }

    return filteredBeans.map(b => ({ __type: 'bean' as const, bean: b }));
  }, [filteredBeans, searchQuery, onCreatePendingBean]);

  // 计算赏味期信息
  const getFlavorInfo = (bean: CoffeeBean) => {
    if (bean.isInTransit) {
      return { phase: '在途', status: '在途' };
    }

    if (!bean.roastDate) {
      return { phase: '未知', status: '未知' };
    }

    if (bean.isFrozen) {
      return { phase: '冷冻', status: '冷冻' };
    }

    const flavorInfo = calculateFlavorInfo(bean);
    const today = new Date();
    const roastTimestamp = parseDateToTimestamp(bean.roastDate);
    const roastDate = new Date(roastTimestamp);
    const todayDate = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const roastDateOnly = new Date(
      roastDate.getFullYear(),
      roastDate.getMonth(),
      roastDate.getDate()
    );
    const daysSinceRoast = Math.ceil(
      (todayDate.getTime() - roastDateOnly.getTime()) / (1000 * 60 * 60 * 24)
    );

    let startDay = bean.startDay || 0;
    let endDay = bean.endDay || 0;

    if (startDay === 0 && endDay === 0) {
      const roasterName = getRoasterName(bean, roasterSettings);
      const defaultPeriod = getDefaultFlavorPeriodByRoastLevelSync(
        bean.roastLevel || '',
        undefined,
        roasterName
      );
      startDay = defaultPeriod.startDay;
      endDay = defaultPeriod.endDay;
    }

    const phase = flavorInfo.phase;
    const remainingDays = flavorInfo.remainingDays;
    let status = '';

    if (phase === '养豆期') {
      status = `养豆 ${remainingDays}天`;
    } else if (phase === '赏味期') {
      status = `赏味 ${remainingDays}天`;
    } else if (phase === '衰退期') {
      status = '已衰退';
    } else {
      status = '未知';
    }

    return { phase, status, daysSinceRoast };
  };

  const formatNumber = (value: string | undefined): string =>
    !value
      ? '0'
      : Number.isInteger(parseFloat(value))
        ? Math.floor(parseFloat(value)).toString()
        : value;

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
      const todayDate = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      );
      const roastDateOnly = new Date(
        roastDate.getFullYear(),
        roastDate.getMonth(),
        roastDate.getDate()
      );
      const daysSinceRoast = Math.ceil(
        (todayDate.getTime() - roastDateOnly.getTime()) / (1000 * 60 * 60 * 24)
      );
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

    if (showTotalPrice) {
      return `${priceNum}元(${pricePerGram}元/克)`;
    } else {
      return `${pricePerGram}元/克`;
    }
  };

  const getStatusDotColor = (phase: string): string => {
    const colors: Record<string, string> = {
      养豆期: 'bg-amber-400',
      赏味期: 'bg-green-400',
      衰退期: 'bg-red-400',
      在途: 'bg-blue-400',
      冷冻: 'bg-cyan-400',
    };
    return colors[phase] || 'bg-neutral-400';
  };

  // 渲染创建选项
  const renderCreateItem = (name: string) => (
    <div
      className="group cursor-pointer transition-colors"
      onClick={() => onCreatePendingBean?.(name)}
    >
      <div className="flex gap-3">
        <div className="relative self-start">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded border border-neutral-200/50 bg-neutral-100 dark:border-neutral-800/50 dark:bg-neutral-800/20">
            <Plus className="h-5 w-5 text-neutral-400 dark:text-neutral-500" />
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-y-1">
          <div className="line-clamp-2 text-xs leading-tight font-medium text-neutral-800 dark:text-neutral-100">
            {name}
          </div>
          <div className="text-xs leading-relaxed font-medium text-neutral-600 dark:text-neutral-400">
            <span className="inline whitespace-nowrap">新建咖啡豆</span>
          </div>
        </div>
      </div>
    </div>
  );

  // 渲染咖啡豆选项 - 与 BeanListItem 样式一致（不含备注）
  const renderBeanItem = (bean: CoffeeBean) => {
    const flavorInfo = getFlavorInfo(bean);
    const displayTitle = formatBeanDisplayName(bean, roasterSettings);

    return (
      <div
        className="group cursor-pointer transition-colors"
        onClick={() => onSelect(bean)}
        ref={setItemRef(bean.id)}
        data-bean-item={bean.id}
      >
        <div className="flex gap-3">
          <div className="relative self-start">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded border border-neutral-200/50 bg-neutral-100 dark:border-neutral-800/50 dark:bg-neutral-800/20">
              <BeanImage bean={bean} roasterSettings={roasterSettings} />
            </div>

            {showStatusDots &&
              bean.roastDate &&
              (bean.startDay || bean.endDay || bean.roastLevel) && (
                <div
                  className={`absolute -right-0.5 -bottom-0.5 h-2 w-2 rounded-full ${getStatusDotColor(flavorInfo.phase)} border-2 border-neutral-50 dark:border-neutral-900`}
                />
              )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col justify-center gap-y-1">
            <div className="line-clamp-2 text-xs leading-tight font-medium text-neutral-800 dark:text-neutral-100">
              {displayTitle}
            </div>

            <div className="overflow-hidden text-xs leading-relaxed font-medium text-neutral-600 dark:text-neutral-400">
              {/* 生豆显示购买日期，熟豆显示烘焙日期 */}
              {(() => {
                const isGreenBean = bean.beanState === 'green';
                const displayDate = isGreenBean
                  ? bean.purchaseDate
                  : bean.roastDate;
                return displayDate || bean.isInTransit ? (
                  <span className="inline whitespace-nowrap">
                    {bean.isInTransit
                      ? '在途'
                      : bean.isFrozen
                        ? '冷冻'
                        : !isGreenBean &&
                            displayDate &&
                            dateDisplayMode === 'flavorPeriod'
                          ? flavorInfo.status
                          : !isGreenBean &&
                              displayDate &&
                              dateDisplayMode === 'agingDays'
                            ? getAgingDaysText(displayDate)
                            : displayDate
                              ? formatDateShort(displayDate)
                              : ''}
                    {((bean.capacity && bean.remaining) ||
                      (bean.price && bean.capacity)) && (
                      <span className="mx-2 text-neutral-400 dark:text-neutral-600">
                        ·
                      </span>
                    )}
                  </span>
                ) : null;
              })()}

              {bean.capacity && bean.remaining && (
                <span className="inline whitespace-nowrap">
                  {formatNumber(bean.remaining)}/{formatNumber(bean.capacity)}克
                  {showPrice && bean.price && bean.capacity && (
                    <span className="mx-2 text-neutral-400 dark:text-neutral-600">
                      ·
                    </span>
                  )}
                </span>
              )}

              {showPrice && bean.price && bean.capacity && (
                <span className="inline whitespace-nowrap">
                  {formatPrice(bean.price, bean.capacity)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 当有数据时显示列表，否则显示空状态
  const hasData = virtuosoData.length > 0;

  return (
    <div className="relative h-full w-full">
      {!hasData ? (
        <div className="py-3">
          {showSkipOption && (
            <div
              className="group cursor-pointer transition-colors"
              onClick={() => onSelect(null)}
            >
              <div className="flex gap-3">
                <div className="relative self-start">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded border border-neutral-200/50 bg-neutral-100 dark:border-neutral-800/50 dark:bg-neutral-800/20">
                    {/* 空内容，表示不选择 */}
                  </div>
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-y-1">
                  <div className="line-clamp-2 text-xs leading-tight font-medium text-neutral-800 dark:text-neutral-100">
                    不使用咖啡豆
                  </div>
                  <div className="text-xs leading-relaxed font-medium text-neutral-600 dark:text-neutral-400">
                    <span className="inline whitespace-nowrap">
                      跳过咖啡豆选择
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-5 flex gap-3">
            <div className="h-14 w-14 shrink-0"></div>
            <div className="flex h-14 min-w-0 flex-1 flex-col justify-center">
              <div className="text-xs text-neutral-500 dark:text-neutral-400">
                {searchQuery.trim()
                  ? `没有找到匹配"${searchQuery.trim()}"的咖啡豆`
                  : '没有可用的咖啡豆，请先添加咖啡豆'}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="pb-32">
          {(() => {
            const VirtuosoList = React.forwardRef<
              HTMLDivElement,
              React.HTMLAttributes<HTMLDivElement>
            >(({ style, children, ...props }, ref) => (
              <div
                ref={ref}
                style={style}
                className="flex flex-col gap-y-3.5"
                {...props}
              >
                {children}
              </div>
            ));
            VirtuosoList.displayName = 'CoffeeBeanSelectorVirtuosoList';

            const VirtuosoHeader = () => {
              if (!showSkipOption) return null;

              return (
                <div className="pb-3.5">
                  <div
                    className="group cursor-pointer transition-colors"
                    onClick={() => onSelect(null)}
                  >
                    <div className="flex gap-3">
                      <div className="relative self-start">
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded border border-neutral-200/50 bg-neutral-100 dark:border-neutral-800/50 dark:bg-neutral-800/20">
                          {/* 空内容，表示不选择 */}
                        </div>
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col justify-center gap-y-1">
                        <div className="line-clamp-2 text-xs leading-tight font-medium text-neutral-800 dark:text-neutral-100">
                          不使用咖啡豆
                        </div>
                        <div className="text-xs leading-relaxed font-medium text-neutral-600 dark:text-neutral-400">
                          <span className="inline whitespace-nowrap">
                            跳过咖啡豆选择
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            };

            return (
              <Virtuoso
                data={virtuosoData}
                customScrollParent={scrollParentRef}
                components={{
                  List: VirtuosoList,
                  Header: VirtuosoHeader,
                }}
                itemContent={(_index, item: VirtuosoItem) => {
                  if (item.__type === 'create') {
                    return renderCreateItem(item.name);
                  }
                  return renderBeanItem(item.bean);
                }}
              />
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default CoffeeBeanSelector;
