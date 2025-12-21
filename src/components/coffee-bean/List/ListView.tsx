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
import { useCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore';
import RoasterLogoManager from '@/lib/managers/RoasterLogoManager';
import { extractRoasterFromName } from '@/lib/utils/beanVarietyUtils';
import {
  getFlavorInfo,
  sortBeansByFlavorPeriod,
} from '@/lib/utils/beanSortUtils';

// 咖啡豆图片组件（支持烘焙商图标）
const BeanImage: React.FC<{
  bean: CoffeeBean;
  forceRefreshKey: number;
}> = ({ bean, forceRefreshKey }) => {
  const [imageError, setImageError] = useState(false);
  const [roasterLogo, setRoasterLogo] = useState<string | null>(null);

  useEffect(() => {
    const loadRoasterLogo = async () => {
      if (!bean.name || bean.image) {
        // 如果咖啡豆有自己的图片，不需要加载烘焙商图标
        return;
      }

      const roasterName = extractRoasterFromName(bean.name);
      if (roasterName && roasterName !== '未知烘焙商') {
        const logo = await RoasterLogoManager.getLogoByRoaster(roasterName);
        setRoasterLogo(logo);
      }
    };

    loadRoasterLogo();
  }, [bean.name, bean.image]);

  return (
    <>
      {bean.image && !imageError ? (
        <Image
          src={bean.image}
          alt={bean.name || '咖啡豆图片'}
          width={56}
          height={56}
          className="h-full w-full object-cover"
          key={`${bean.id}-${forceRefreshKey}`}
          onError={() => setImageError(true)}
          unoptimized
        />
      ) : roasterLogo && !imageError ? (
        <Image
          src={roasterLogo}
          alt={extractRoasterFromName(bean.name) || '烘焙商图标'}
          width={56}
          height={56}
          className="h-full w-full object-cover"
          onError={() => setImageError(true)}
          unoptimized
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-neutral-400 dark:text-neutral-600">
          {bean.name ? bean.name.charAt(0) : '豆'}
        </div>
      )}
    </>
  );
};

// 定义组件属性接口
interface CoffeeBeanListProps {
  onSelect: (beanId: string | null, bean: CoffeeBean | null) => void;
  isOpen?: boolean;
  searchQuery?: string; // 添加搜索查询参数
  highlightedBeanId?: string | null; // 添加高亮咖啡豆ID参数
  scrollParentRef?: HTMLElement;
  showStatusDots?: boolean; // 是否显示状态点
}

const CoffeeBeanList: React.FC<CoffeeBeanListProps> = ({
  onSelect,
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

  const [forceRefreshKey, setForceRefreshKey] = useState(0);
  const beanItemsRef = useRef<Map<string, HTMLDivElement>>(new Map());

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
      setForceRefreshKey(prev => prev + 1);
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
    return availableBeans.filter(bean =>
      bean.name?.toLowerCase().includes(query)
    );
  }, [availableBeans, searchQuery]);

  // 移除IntersectionObserver和分页状态

  // 设置ref的回调函数
  const setItemRef = useCallback(
    (id: string) => (node: HTMLDivElement | null) => {
      if (node) {
        beanItemsRef.current.set(id, node);
      } else {
        beanItemsRef.current.delete(id);
      }
    },
    []
  );

  // 滚动到高亮的咖啡豆
  useEffect(() => {
    if (highlightedBeanId && beanItemsRef.current.has(highlightedBeanId)) {
      // 滚动到高亮的咖啡豆
      const node = beanItemsRef.current.get(highlightedBeanId);
      node?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [highlightedBeanId]);

  // 删除加载动画，直接显示内容

  // Virtuoso 自定义 List - 移除 space-y 避免滚动计算问题
  const VirtList = React.useMemo(() => {
    const Cmp = React.forwardRef<
      HTMLDivElement,
      React.HTMLAttributes<HTMLDivElement>
    >(({ style, children, ...props }, ref) => (
      <div ref={ref} style={style} {...props}>
        {children}
      </div>
    ));
    Cmp.displayName = 'CoffeeBeanVirtuosoList';
    return Cmp;
  }, []);

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
              <div className="relative h-14 w-14 shrink-0 rounded border border-neutral-200/50 bg-neutral-100 dark:border-neutral-800/50 dark:bg-neutral-800/20">
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
        <div className="flex gap-3">
          {/* 左侧占位区域 - 与咖啡豆图片保持一致的尺寸 */}
          <div className="h-14 w-14 shrink-0"></div>

          {/* 右侧内容区域 */}
          <div className="flex h-14 min-w-0 flex-1 flex-col justify-center">
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              没有找到匹配&quot;{searchQuery.trim()}&quot;的咖啡豆
            </div>
          </div>
        </div>
      )}

      <Virtuoso
        customScrollParent={scrollParentRef}
        data={filteredBeans}
        components={{ List: VirtList }}
        itemContent={(_index, bean) => {
          // 预计算所有需要的数据，避免在渲染中重复计算
          const flavorInfo = getFlavorInfo(bean);
          const { phase } = flavorInfo;

          // 获取赏味期状态
          let freshStatus = '';
          let statusClass = 'text-neutral-500 dark:text-neutral-400';

          if (bean.isInTransit) {
            freshStatus = '(在途)';
            statusClass = 'text-neutral-600 dark:text-neutral-400';
          } else if (bean.isFrozen) {
            freshStatus = '(冷冻)';
            statusClass = 'text-blue-400 dark:text-blue-300';
          } else if (phase === '其他') {
            // 没有烘焙日期的豆子
            freshStatus = '';
            statusClass = 'text-neutral-500 dark:text-neutral-400';
          } else if (bean.roastDate) {
            if (phase === '养豆期') {
              freshStatus = `(养豆期)`;
              statusClass = 'text-neutral-500 dark:text-neutral-400';
            } else if (phase === '赏味期') {
              freshStatus = `(赏味期)`;
              statusClass = 'text-emerald-500 dark:text-emerald-400';
            } else {
              freshStatus = '(衰退期)';
              statusClass = 'text-neutral-500 dark:text-neutral-400';
            }
          }

          // 预计算格式化函数
          const formatNumber = (value: string | undefined): string =>
            !value
              ? '0'
              : Number.isInteger(parseFloat(value))
                ? Math.floor(parseFloat(value)).toString()
                : value;

          const formatDateShort = (dateStr: string): string => {
            const date = new Date(dateStr);
            const year = date.getFullYear().toString().slice(-2); // 获取年份的最后两位
            return `${year}-${date.getMonth() + 1}-${date.getDate()}`;
          };

          const formatPricePerGram = (
            price: string,
            capacity: string
          ): string => {
            const priceNum = parseFloat(price);
            const capacityNum = parseFloat(capacity.replace('g', ''));
            if (isNaN(priceNum) || isNaN(capacityNum) || capacityNum === 0)
              return '';
            return `${(priceNum / capacityNum).toFixed(2)}元/克`;
          };

          // 构建参数信息项
          const infoItems = [];
          // 生豆显示购买日期，熟豆显示烘焙日期
          const isGreenBean = bean.beanState === 'green';
          const displayDate = isGreenBean ? bean.purchaseDate : bean.roastDate;
          if (displayDate && !bean.isInTransit) {
            infoItems.push(formatDateShort(displayDate));
          }

          const remaining =
            typeof bean.remaining === 'string'
              ? parseFloat(bean.remaining)
              : (bean.remaining ?? 0);
          const capacity =
            typeof bean.capacity === 'string'
              ? parseFloat(bean.capacity)
              : (bean.capacity ?? 0);
          if (remaining > 0 && capacity > 0) {
            infoItems.push(
              `${formatNumber(bean.remaining)}/${formatNumber(bean.capacity)}克`
            );
          }

          if (bean.price && bean.capacity) {
            infoItems.push(formatPricePerGram(bean.price, bean.capacity));
          }

          // 获取状态圆点的颜色
          const getStatusDotColor = (phase: string): string => {
            switch (phase) {
              case '养豆期':
                return 'bg-amber-400';
              case '赏味期':
                return 'bg-green-400';
              case '衰退期':
                return 'bg-red-400';
              case '在途':
                return 'bg-blue-400';
              case '冷冻':
                return 'bg-cyan-400';
              default:
                return 'bg-neutral-400';
            }
          };

          return (
            <div
              ref={setItemRef(bean.id)}
              className="group relative cursor-pointer pb-5 text-neutral-500 transition-all duration-300 dark:text-neutral-400"
              onClick={() => onSelect(bean.id, bean)}
            >
              <div className="cursor-pointer">
                <div className="flex gap-3">
                  {/* 左侧图片区域 - 固定显示，缩小尺寸 */}
                  <div className="relative self-start">
                    <div className="relative h-14 w-14 shrink-0 cursor-pointer overflow-hidden rounded border border-neutral-200/50 bg-neutral-100 dark:border-neutral-800/50 dark:bg-neutral-800/20">
                      <BeanImage
                        bean={bean}
                        forceRefreshKey={forceRefreshKey}
                      />
                    </div>

                    {/* 状态圆点 - 右下角，边框超出图片边界 - 只有当有赏味期数据时才显示 */}
                    {showStatusDots &&
                      bean.roastDate &&
                      (bean.startDay || bean.endDay || bean.roastLevel) && (
                        <div
                          className={`absolute -right-0.5 -bottom-0.5 h-2 w-2 rounded-full ${getStatusDotColor(phase)} border-2 border-neutral-50 dark:border-neutral-900`}
                        />
                      )}
                  </div>

                  {/* 右侧内容区域 - 与图片等高 */}
                  <div className="flex flex-col justify-center gap-y-1.5">
                    {/* 咖啡豆名称和烘焙度 */}
                    <div className="line-clamp-2 text-xs leading-tight font-medium text-neutral-800 dark:text-neutral-100">
                      {bean.name}
                      {bean.roastLevel && ` ${bean.roastLevel}`}
                      <span className={statusClass}> {freshStatus}</span>
                    </div>

                    {/* 其他信息 */}
                    <div className="text-xs leading-relaxed font-medium tracking-wide text-neutral-600 dark:text-neutral-400">
                      {infoItems.map((item, i) => (
                        <React.Fragment key={i}>
                          <span className="inline">{item}</span>
                          {i < infoItems.length - 1 && (
                            <span className="bg-red mx-2 text-neutral-400 dark:text-neutral-600">
                              ·
                            </span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
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
