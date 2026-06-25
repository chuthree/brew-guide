'use client';

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { Virtuoso } from 'react-virtuoso';
import Image from 'next/image';
import { CoffeeBean } from '@/types/app';
import CoffeeBeanCreateOption from '@/components/coffee-bean/ui/CoffeeBeanCreateOption';
import { useCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore';
import { useRoasterLogo, useSettingsStore } from '@/lib/stores/settingsStore';
import {
  formatBeanDisplayName,
  getBeanDisplayInitial,
  getRoasterName,
} from '@/lib/utils/beanVarietyUtils';
import { sortBeansByFlavorPeriod } from '@/lib/utils/beanSortUtils';
import { parseDateToTimestamp } from '@/lib/utils/dateUtils';
import { calculateFlavorInfo } from '@/lib/utils/flavorPeriodUtils';
import { useCoffeeBeanImage } from '@/lib/hooks/useCoffeeBeanImage';

const LIST_VIRTUOSO_OVERSCAN = { top: 240, bottom: 480 };
const getCoffeeBeanListItemKey = (_index: number, bean: CoffeeBean) =>
  `bean:${bean.id}`;

type VirtuosoListProps = React.HTMLAttributes<HTMLDivElement> & {
  ref?: React.Ref<HTMLDivElement>;
};

const CoffeeBeanVirtuosoList = ({
  style,
  children,
  ref,
  ...props
}: VirtuosoListProps) => (
  <div ref={ref} style={style} {...props}>
    {children}
  </div>
);

const COFFEE_BEAN_VIRTUOSO_COMPONENTS = {
  List: CoffeeBeanVirtuosoList,
};

// 咖啡豆图片组件（支持烘焙商图标）
const BeanImage: React.FC<{
  bean: CoffeeBean;
  roasterSettings: {
    roasterFieldEnabled?: boolean;
    roasterSeparator?: ' ' | '/';
  };
}> = ({ bean, roasterSettings }) => {
  const [imageError, setImageError] = useState<{
    source: string | null;
    failed: boolean;
  }>({ source: null, failed: false });

  const roasterName = useMemo(
    () => getRoasterName(bean, roasterSettings),
    [bean, roasterSettings]
  );
  const configuredRoasterLogo = useRoasterLogo(roasterName);
  const beanImage = useCoffeeBeanImage(bean.id, {
    preferThumbnail: true,
  });

  const roasterLogo = useMemo(() => {
    if (!bean.name || beanImage) {
      return null;
    }

    if (roasterName && roasterName !== '未知烘焙商') {
      return configuredRoasterLogo;
    }

    return null;
  }, [bean.name, beanImage, configuredRoasterLogo, roasterName]);

  const imageSource = beanImage || roasterLogo;
  const hasImageError = imageError.source === imageSource && imageError.failed;

  return (
    <>
      {beanImage && !hasImageError ? (
        <Image
          src={beanImage}
          alt={bean.name || '咖啡豆图片'}
          width={56}
          height={56}
          className="h-full w-full object-cover"
          loading="eager"
          onError={() =>
            setImageError({ source: beanImage || null, failed: true })
          }
          unoptimized
        />
      ) : roasterLogo && !hasImageError ? (
        <Image
          src={roasterLogo}
          alt={roasterName || '烘焙商图标'}
          width={56}
          height={56}
          className="h-full w-full object-cover"
          loading="eager"
          onError={() => setImageError({ source: roasterLogo, failed: true })}
          unoptimized
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-neutral-400 dark:text-neutral-600">
          {getBeanDisplayInitial(bean)}
        </div>
      )}
    </>
  );
};

// 定义组件属性接口
interface CoffeeBeanListProps {
  onSelect: (beanId: string | null, bean: CoffeeBean | null) => void;
  onCreateBean?: (name: string) => void;
  isOpen?: boolean;
  searchQuery?: string; // 添加搜索查询参数
  highlightedBeanId?: string | null; // 添加高亮咖啡豆ID参数
  scrollParentRef?: HTMLElement;
  showStatusDots?: boolean; // 是否显示状态点
}

const CoffeeBeanList: React.FC<CoffeeBeanListProps> = ({
  onSelect,
  onCreateBean,
  isOpen: _isOpen = true,
  searchQuery = '',
  highlightedBeanId = null,
  scrollParentRef,
  showStatusDots = true,
}) => {
  // 直接从 Store 订阅数据
  const beans = useCoffeeBeanStore(state => state.beans);
  const storeInitialized = useCoffeeBeanStore(state => state.initialized);
  const loadBeans = useCoffeeBeanStore(state => state.loadBeans);

  const beanItemsRef = useRef<Map<string, HTMLDivElement> | null>(null);
  beanItemsRef.current ??= new Map();
  const beanItems = beanItemsRef.current;

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

  // 初始化加载
  useEffect(() => {
    if (!storeInitialized) {
      loadBeans();
    }
  }, [storeInitialized, loadBeans]);

  // 监听数据变化事件
  useEffect(() => {
    const handleBeansUpdated = () => {
      loadBeans();
    };

    window.addEventListener('coffeeBeansUpdated', handleBeansUpdated);
    window.addEventListener('coffeeBeanDataChanged', handleBeansUpdated);
    window.addEventListener('coffeeBeanListChanged', handleBeansUpdated);

    return () => {
      window.removeEventListener('coffeeBeansUpdated', handleBeansUpdated);
      window.removeEventListener('coffeeBeanDataChanged', handleBeansUpdated);
      window.removeEventListener('coffeeBeanListChanged', handleBeansUpdated);
    };
  }, [loadBeans]);

  // 过滤出未用完的咖啡豆，并按规则排序
  const availableBeans = useMemo(() => {
    // 过滤掉剩余量为0(且设置了容量)的咖啡豆，排除生豆，但保留在途状态的咖啡豆
    const filteredBeans = beans.filter(bean => {
      // 排除生豆
      if (bean.beanState === 'green') {
        return false;
      }

      // 如果没有设置容量，则直接显示
      if (!bean.capacity || bean.capacity === '0' || bean.capacity === '0g') {
        return true;
      }

      // 考虑remaining可能是字符串或者数字
      const remaining =
        typeof bean.remaining === 'string'
          ? parseFloat(bean.remaining)
          : Number(bean.remaining);

      // 只过滤掉有容量设置且剩余量为0的咖啡豆
      return remaining > 0;
    });

    // 使用统一的排序函数
    return sortBeansByFlavorPeriod(filteredBeans);
  }, [beans]);

  // 搜索过滤
  const filteredBeans = useMemo(() => {
    if (!searchQuery?.trim()) return availableBeans;

    const query = searchQuery.toLowerCase().trim();
    return availableBeans.filter(
      bean =>
        bean.name?.toLowerCase().includes(query) ||
        bean.roaster?.toLowerCase().includes(query)
    );
  }, [availableBeans, searchQuery]);

  // 计算赏味期信息
  const getFlavorInfo = useCallback((bean: CoffeeBean) => {
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
      status = '';
    }

    return { phase, status, daysSinceRoast };
  }, []);

  const formatNumber = useCallback(
    (value: string | undefined): string =>
      !value
        ? '0'
        : Number.isInteger(parseFloat(value))
          ? Math.floor(parseFloat(value)).toString()
          : value,
    []
  );

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
  }, []);

  const formatPrice = useCallback(
    (price: string, capacity: string): string => {
      const priceNum = parseFloat(price);
      const capacityNum = parseFloat(capacity.replace('g', ''));
      if (isNaN(priceNum) || isNaN(capacityNum) || capacityNum === 0) return '';

      const pricePerGram = (priceNum / capacityNum).toFixed(2);

      if (showTotalPrice) {
        return `${priceNum}元(${pricePerGram}元/克)`;
      } else {
        return `${pricePerGram}元/克`;
      }
    },
    [showTotalPrice]
  );

  const getStatusDotColor = useCallback((phase: string): string => {
    const colors: Record<string, string> = {
      养豆期: 'bg-amber-400',
      赏味期: 'bg-green-400',
      衰退期: 'bg-red-400',
      在途: 'bg-blue-400',
      冷冻: 'bg-cyan-400',
    };
    return colors[phase] || 'bg-neutral-400';
  }, []);

  // 移除IntersectionObserver和分页状态

  // 设置ref的回调函数
  const setItemRef = useCallback(
    (id: string) => (node: HTMLDivElement | null) => {
      if (node) {
        beanItems.set(id, node);
        if (id === highlightedBeanId) {
          node.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }
      } else {
        beanItems.delete(id);
      }
    },
    [beanItems, highlightedBeanId]
  );

  return (
    <div className="pb-20">
      {/* 添加"不选择咖啡豆"选项 */}
      <div
        className="group relative mb-5 cursor-pointer text-neutral-500 transition-all duration-300 dark:text-neutral-400"
        onClick={() => onSelect(null, null)}
      >
        <div className="cursor-pointer">
          <div className="flex gap-3">
            {/* 左侧图标区域 - 实线边框，空内容 */}
            <div className="relative self-start">
              <div className="relative size-14 shrink-0 rounded border border-neutral-200/50 bg-neutral-100 dark:border-neutral-800/50 dark:bg-neutral-800/20">
                {/* 空内容，表示"不选择" */}
              </div>
            </div>

            {/* 右侧内容区域 - 与图片等高 */}
            <div className="flex flex-col justify-center gap-y-1.5">
              {/* 选项名称 */}
              <div className="line-clamp-2 text-xs leading-tight font-medium text-neutral-800 dark:text-neutral-100">
                不使用咖啡豆
              </div>

              {/* 描述信息 */}
              <div className="text-xs leading-relaxed font-medium tracking-wide text-neutral-600 dark:text-neutral-400">
                <span className="inline">跳过咖啡豆选择</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 显示无搜索结果的提示 */}
      {filteredBeans.length === 0 && searchQuery.trim() !== '' && (
        <>
          {onCreateBean && (
            <CoffeeBeanCreateOption
              name={searchQuery.trim()}
              onCreate={onCreateBean}
              className="mb-5"
            />
          )}

          {!onCreateBean && (
            <div className="flex gap-3">
              {/* 左侧占位区域 - 与咖啡豆图片保持一致的尺寸 */}
              <div className="size-14 shrink-0"></div>

              {/* 右侧内容区域 */}
              <div className="flex h-14 min-w-0 flex-1 flex-col justify-center">
                <div className="text-xs text-neutral-500 dark:text-neutral-400">
                  没有找到匹配&quot;{searchQuery.trim()}&quot;的咖啡豆
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <Virtuoso
        customScrollParent={scrollParentRef}
        data={filteredBeans}
        components={COFFEE_BEAN_VIRTUOSO_COMPONENTS}
        computeItemKey={getCoffeeBeanListItemKey}
        increaseViewportBy={LIST_VIRTUOSO_OVERSCAN}
        itemContent={(_index, bean) => {
          const flavorInfo = getFlavorInfo(bean);
          const displayTitle = formatBeanDisplayName(bean, roasterSettings);

          return (
            <div
              ref={setItemRef(bean.id)}
              className="group cursor-pointer pb-3.5 transition-colors"
              onClick={() => onSelect(bean.id, bean)}
            >
              <div className="flex gap-3">
                <div className="relative self-start">
                  <div className="relative size-14 shrink-0 overflow-hidden rounded border border-neutral-200/50 bg-neutral-100 dark:border-neutral-800/50 dark:bg-neutral-800/20">
                    <BeanImage bean={bean} roasterSettings={roasterSettings} />
                  </div>

                  {showStatusDots &&
                    bean.roastDate &&
                    flavorInfo.phase !== '未知' && (
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
                                ? flavorInfo.status ||
                                  getAgingDaysText(displayDate)
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
                        {formatNumber(bean.remaining)}/
                        {formatNumber(bean.capacity)}克
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
        }}
      />
    </div>
  );
};

// 使用 React.memo 包装组件以避免不必要的重新渲染
export default React.memo(CoffeeBeanList);
