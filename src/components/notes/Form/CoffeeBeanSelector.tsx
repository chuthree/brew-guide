'use client';

import React, { useMemo, useRef, useEffect, useState } from 'react';
import { Virtuoso } from 'react-virtuoso';
import Image from 'next/image';
import { Plus } from 'lucide-react';
import type { CoffeeBean } from '@/types/app';
import { getRoasterLogoSync } from '@/lib/stores/settingsStore';
import { extractRoasterFromName } from '@/lib/utils/beanVarietyUtils';
import {
  getFlavorInfo,
  sortBeansByFlavorPeriod,
} from '@/lib/utils/beanSortUtils';

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
}

// 定义列表项类型
type VirtuosoItem =
  | { __type: 'create'; name: string }
  | { __type: 'bean'; bean: CoffeeBean };

// 咖啡豆图片组件（支持烘焙商图标）
const BeanImage: React.FC<{ bean: CoffeeBean }> = ({ bean }) => {
  const [imageError, setImageError] = useState(false);
  const [roasterLogo, setRoasterLogo] = useState<string | null>(null);

  useEffect(() => {
    if (!bean.name || bean.image) {
      return;
    }

    const roasterName = extractRoasterFromName(bean.name);
    if (roasterName && roasterName !== '未知烘焙商') {
      const logo = getRoasterLogoSync(roasterName);
      setRoasterLogo(logo || null);
    }
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

const CoffeeBeanSelector: React.FC<CoffeeBeanSelectorProps> = ({
  coffeeBeans,
  selectedCoffeeBean: _selectedCoffeeBean,
  onSelect,
  onCreatePendingBean,
  searchQuery = '',
  highlightedBeanId = null,
  scrollParentRef,
  showStatusDots = true,
}) => {
  const beanItemsRef = useRef<Map<string, HTMLDivElement>>(new Map());

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

  // 渲染创建选项
  const renderCreateItem = (name: string) => (
    <div
      className="group relative cursor-pointer pb-5 text-neutral-500 transition-all duration-300 dark:text-neutral-400"
      onClick={() => onCreatePendingBean?.(name)}
    >
      <div className="cursor-pointer">
        <div className="flex gap-3">
          <div className="relative self-start">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded border border-neutral-200/50 bg-neutral-100 dark:border-neutral-800/50 dark:bg-neutral-800/20">
              <Plus className="h-5 w-5 text-neutral-400 dark:text-neutral-500" />
            </div>
          </div>
          <div className="flex flex-col justify-center gap-y-1.5">
            <div className="line-clamp-2 text-justify text-xs leading-tight font-medium text-neutral-800 dark:text-neutral-100">
              {name}
            </div>
            <div className="text-xs leading-relaxed font-medium tracking-wide text-neutral-600 dark:text-neutral-400">
              <span className="inline">新建咖啡豆</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // 渲染咖啡豆选项
  const renderBeanItem = (bean: CoffeeBean) => {
    let freshStatus = '';
    let statusClass = 'text-neutral-500 dark:text-neutral-400';

    if (bean.isInTransit) {
      freshStatus = '(在途)';
      statusClass = 'text-neutral-600 dark:text-neutral-400';
    } else if (bean.isFrozen) {
      freshStatus = '(冷冻)';
      statusClass = 'text-blue-400 dark:text-blue-300';
    } else if (bean.roastDate) {
      const { phase } = getFlavorInfo(bean);
      if (phase === '养豆期') {
        freshStatus = '(养豆期)';
        statusClass = 'text-neutral-500 dark:text-neutral-400';
      } else if (phase === '赏味期') {
        freshStatus = '(赏味期)';
        statusClass = 'text-emerald-500 dark:text-emerald-400';
      } else {
        freshStatus = '(衰退期)';
        statusClass = 'text-neutral-500 dark:text-neutral-400';
      }
    }

    const formatNumber = (value: string | undefined): string =>
      !value
        ? '0'
        : Number.isInteger(parseFloat(value))
          ? Math.floor(parseFloat(value)).toString()
          : value;

    const formatDateShort = (dateStr: string): string => {
      const date = new Date(dateStr);
      const year = date.getFullYear().toString().slice(-2);
      return `${year}-${date.getMonth() + 1}-${date.getDate()}`;
    };

    const formatPricePerGram = (price: string, capacity: string): string => {
      const priceNum = parseFloat(price);
      const capacityNum = parseFloat(capacity.replace('g', ''));
      if (isNaN(priceNum) || isNaN(capacityNum) || capacityNum === 0) return '';
      const pricePerGram = priceNum / capacityNum;
      return `${pricePerGram.toFixed(2)}元/克`;
    };

    const infoItems = [];

    if (bean.roastDate && !bean.isInTransit) {
      infoItems.push(formatDateShort(bean.roastDate));
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
        case '未知':
        default:
          return 'bg-neutral-400';
      }
    };

    const { phase } = getFlavorInfo(bean);

    return (
      <div
        className="group relative cursor-pointer pb-5 text-neutral-500 transition-all duration-300 dark:text-neutral-400"
        onClick={() => onSelect(bean)}
        ref={setItemRef(bean.id)}
      >
        <div className="cursor-pointer">
          <div className="flex gap-3">
            <div className="relative self-start">
              <div className="relative h-14 w-14 shrink-0 cursor-pointer overflow-hidden rounded border border-neutral-200/50 bg-neutral-100 dark:border-neutral-800/50 dark:bg-neutral-800/20">
                <BeanImage bean={bean} />
              </div>
              {showStatusDots &&
                bean.roastDate &&
                (bean.startDay || bean.endDay || bean.roastLevel) && (
                  <div
                    className={`absolute -right-0.5 -bottom-0.5 h-2 w-2 rounded-full ${getStatusDotColor(phase)} border-2 border-neutral-50 dark:border-neutral-900`}
                  />
                )}
            </div>
            <div className="flex flex-col justify-center gap-y-1.5">
              <div className="line-clamp-2 text-justify text-xs leading-tight font-medium text-neutral-800 dark:text-neutral-100">
                {bean.name}
                {bean.roastLevel && ` ${bean.roastLevel}`}
                <span className={statusClass}> {freshStatus}</span>
              </div>
              <div className="text-xs leading-relaxed font-medium tracking-wide text-neutral-600 dark:text-neutral-400">
                {infoItems.map((item, i) => (
                  <React.Fragment key={i}>
                    <span className="inline">{item}</span>
                    {i < infoItems.length - 1 && (
                      <span className="mx-2 text-neutral-400 dark:text-neutral-600">
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
  };

  // 当有数据时显示列表，否则显示空状态
  const hasData = virtuosoData.length > 0;

  return (
    <div className="py-3">
      <div>
        <div className="space-y-5">
          {hasData ? (
            <Virtuoso
              {...(scrollParentRef
                ? { customScrollParent: scrollParentRef }
                : { useWindowScroll: true })}
              data={virtuosoData}
              components={(() => {
                const ListCmp = React.forwardRef<
                  HTMLDivElement,
                  React.HTMLAttributes<HTMLDivElement>
                >(({ style, children, ...props }, ref) => (
                  <div ref={ref} style={style} {...props}>
                    {children}
                  </div>
                ));
                ListCmp.displayName = 'CoffeeBeanSelectorVirtuosoList';
                return { List: ListCmp };
              })()}
              itemContent={(_index, item: VirtuosoItem) => {
                if (item.__type === 'create') {
                  return renderCreateItem(item.name);
                }
                return renderBeanItem(item.bean);
              }}
            />
          ) : (
            <div className="flex gap-3">
              <div className="h-14 w-14 shrink-0"></div>
              <div className="flex h-14 min-w-0 flex-1 flex-col justify-center">
                <div className="text-xs text-neutral-500 dark:text-neutral-400">
                  {searchQuery.trim()
                    ? `没有找到匹配"${searchQuery.trim()}"的咖啡豆`
                    : '没有可用的咖啡豆，请先添加咖啡豆'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CoffeeBeanSelector;
