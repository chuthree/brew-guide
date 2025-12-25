'use client';

import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import Image from 'next/image';
import gsap from 'gsap';
import { ExtendedCoffeeBean, generateBeanTitle } from '../types';
import { isBeanEmpty } from '../preferences';
import { parseDateToTimestamp } from '@/lib/utils/dateUtils';
import { calculateFlavorInfo } from '@/lib/utils/flavorPeriodUtils';
import { getRoasterLogoSync } from '@/lib/stores/settingsStore';
import { extractRoasterFromName } from '@/lib/utils/beanVarietyUtils';

// 表格列配置
export type TableColumnKey =
  | 'roaster'
  | 'name'
  | 'flavorPeriod'
  | 'capacity'
  | 'price'
  | 'beanType'
  | 'origin'
  | 'estate'
  | 'process'
  | 'variety'
  | 'roastLevel'
  | 'flavor'
  | 'rating'
  | 'notes';

export const TABLE_COLUMN_CONFIG: {
  key: TableColumnKey;
  label: string;
  defaultVisible: boolean;
}[] = [
  { key: 'roaster', label: '烘焙商', defaultVisible: false },
  { key: 'name', label: '名称', defaultVisible: true },
  { key: 'flavorPeriod', label: '赏味期', defaultVisible: true },
  { key: 'capacity', label: '容量', defaultVisible: true },
  { key: 'price', label: '价格', defaultVisible: true },
  { key: 'beanType', label: '类型', defaultVisible: true },
  { key: 'origin', label: '产地', defaultVisible: false },
  { key: 'estate', label: '庄园', defaultVisible: false },
  { key: 'process', label: '处理法', defaultVisible: false },
  { key: 'variety', label: '品种', defaultVisible: false },
  { key: 'roastLevel', label: '烘焙度', defaultVisible: false },
  { key: 'flavor', label: '风味', defaultVisible: false },
  { key: 'rating', label: '评分', defaultVisible: true },
  { key: 'notes', label: '备注', defaultVisible: true },
];

// 获取默认可见列
export const getDefaultVisibleColumns = (): TableColumnKey[] =>
  TABLE_COLUMN_CONFIG.filter(c => c.defaultVisible).map(c => c.key);

interface TableViewProps {
  filteredBeans: ExtendedCoffeeBean[];
  emptyBeans: ExtendedCoffeeBean[];
  showEmptyBeans: boolean;
  onEdit?: (bean: ExtendedCoffeeBean) => void;
  onDelete?: (bean: ExtendedCoffeeBean) => void;
  onShare?: (bean: ExtendedCoffeeBean) => void;
  onRate?: (bean: ExtendedCoffeeBean) => void;
  onRemainingClick?: (
    bean: ExtendedCoffeeBean,
    event: React.MouseEvent
  ) => void;
  settings?: {
    dateDisplayMode?: 'date' | 'flavorPeriod' | 'agingDays';
    showOnlyBeanName?: boolean;
  };
  visibleColumns?: TableColumnKey[];
}

// 从名称中移除烘焙商前缀
const removeRoasterFromName = (name: string): string => {
  if (!name) return name;
  const roaster = extractRoasterFromName(name);
  if (roaster === '未知烘焙商') return name;
  // 移除名称开头的烘焙商部分
  const trimmedName = name.trim();
  if (trimmedName.startsWith(roaster)) {
    return trimmedName.slice(roaster.length).trim();
  }
  return name;
};

// 格式化工具函数
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
    return `${daysSinceRoast}天`;
  } catch {
    return '0天';
  }
};

const formatNumber = (value: string | undefined): string =>
  !value
    ? '0'
    : Number.isInteger(parseFloat(value))
      ? Math.floor(parseFloat(value)).toString()
      : value;

const formatPrice = (price: string, capacity: string): string => {
  const priceNum = parseFloat(price);
  const capacityNum = parseFloat(capacity.replace('g', ''));
  if (isNaN(priceNum) || isNaN(capacityNum) || capacityNum === 0) return '-';
  return `${(priceNum / capacityNum).toFixed(2)}元/克`;
};

const getFlavorStatus = (bean: ExtendedCoffeeBean): string => {
  if (bean.isInTransit) return '在途';
  if (!bean.roastDate) return '-';
  if (bean.isFrozen) return '冷冻';

  const info = calculateFlavorInfo(bean);
  if (info.phase === '养豆期') return `养豆${info.remainingDays}天`;
  if (info.phase === '赏味期') return `赏味${info.remainingDays}天`;
  if (info.phase === '衰退期') return '已衰退';
  return info.phase;
};

const TableView: React.FC<TableViewProps> = ({
  filteredBeans,
  emptyBeans,
  showEmptyBeans,
  onRemainingClick,
  settings,
  visibleColumns = getDefaultVisibleColumns(),
}) => {
  const showOnlyBeanName = settings?.showOnlyBeanName ?? true;
  const dateDisplayMode = settings?.dateDisplayMode ?? 'date';

  // 鼠标跟随图片状态
  const [hoveredBean, setHoveredBean] = useState<ExtendedCoffeeBean | null>(
    null
  );
  const imageRef = useRef<HTMLDivElement>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [roasterLogos, setRoasterLogos] = useState<
    Record<string, string | null>
  >({});

  // 检测是否是桌面端
  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.matchMedia('(pointer: fine)').matches);
    };
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  // 加载所有咖啡豆的烘焙商图标
  useEffect(() => {
    const allBeans = [...filteredBeans, ...(showEmptyBeans ? emptyBeans : [])];
    const logos: Record<string, string | null> = {};

    allBeans.forEach(bean => {
      if (!bean.image && bean.name) {
        const roasterName = extractRoasterFromName(bean.name);
        if (roasterName && roasterName !== '未知烘焙商') {
          const logo = getRoasterLogoSync(roasterName);
          logos[bean.id] = logo || null;
        }
      }
    });

    setRoasterLogos(logos);
  }, [filteredBeans, emptyBeans, showEmptyBeans]);

  // GSAP 动画：鼠标进入时显示图片
  const handleMouseEnter = useCallback(
    (bean: ExtendedCoffeeBean, e: React.MouseEvent) => {
      if (!isDesktop) return;

      const imageUrl = bean.image || roasterLogos[bean.id];
      if (!imageUrl) return;

      setHoveredBean(bean);

      if (imageRef.current) {
        gsap.killTweensOf(imageRef.current);
        gsap.set(imageRef.current, {
          x: e.clientX + 16,
          y: e.clientY + 16,
          scale: 0.8,
          opacity: 0,
        });
        gsap.to(imageRef.current, {
          scale: 1,
          opacity: 1,
          duration: 0.25,
          ease: 'power2.out',
        });
      }
    },
    [isDesktop, roasterLogos]
  );

  // GSAP 动画：鼠标离开时隐藏图片
  const handleMouseLeave = useCallback(() => {
    if (!isDesktop) return;

    if (imageRef.current) {
      gsap.killTweensOf(imageRef.current);
      gsap.to(imageRef.current, {
        scale: 0.8,
        opacity: 0,
        duration: 0.2,
        ease: 'power2.in',
        onComplete: () => {
          setHoveredBean(null);
        },
      });
    }
  }, [isDesktop]);

  // GSAP 动画：鼠标移动时更新图片位置
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDesktop || !hoveredBean) return;

      if (imageRef.current) {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const imageSize = 160;
        const offset = 16;

        let x = e.clientX + offset;
        let y = e.clientY + offset;

        if (x + imageSize > viewportWidth - 20) {
          x = e.clientX - imageSize - offset;
        }
        if (y + imageSize > viewportHeight - 20) {
          y = e.clientY - imageSize - offset;
        }

        gsap.to(imageRef.current, {
          x,
          y,
          duration: 0.15,
          ease: 'power2.out',
        });
      }
    },
    [isDesktop, hoveredBean]
  );

  // 处理详情点击
  const handleDetailClick = (bean: ExtendedCoffeeBean) => {
    window.dispatchEvent(
      new CustomEvent('beanDetailOpened', {
        detail: { bean },
      })
    );
  };

  // 合并正常豆子和用完的豆子
  const allBeans = useMemo(() => {
    if (!showEmptyBeans) {
      return filteredBeans;
    }
    return [...filteredBeans, ...emptyBeans];
  }, [filteredBeans, emptyBeans, showEmptyBeans]);

  // 渲染单元格内容
  const renderCellContent = (
    bean: ExtendedCoffeeBean,
    columnKey: TableColumnKey,
    isEmpty: boolean
  ) => {
    const isGreenBean = bean.beanState === 'green';
    const displayDate = isGreenBean ? bean.purchaseDate : bean.roastDate;

    switch (columnKey) {
      case 'roaster':
        return extractRoasterFromName(bean.name || '') || '-';
      case 'name': {
        // 如果烘焙商列可见，则从名称中移除烘焙商
        const showRoasterColumn = visibleColumns.includes('roaster');
        const title = generateBeanTitle(bean, showOnlyBeanName);
        return showRoasterColumn ? removeRoasterFromName(title) : title;
      }
      case 'flavorPeriod':
        return displayDate
          ? bean.isInTransit
            ? '在途'
            : bean.isFrozen
              ? '冷冻'
              : !isGreenBean && dateDisplayMode === 'flavorPeriod'
                ? getFlavorStatus(bean)
                : !isGreenBean && dateDisplayMode === 'agingDays'
                  ? getAgingDaysText(displayDate)
                  : formatDateShort(displayDate)
          : '-';
      case 'capacity':
        return bean.capacity && bean.remaining ? (
          <>
            <span
              className={
                isEmpty
                  ? ''
                  : 'border-b border-dashed border-neutral-400 dark:border-neutral-600'
              }
            >
              {formatNumber(bean.remaining)}
            </span>
            /{formatNumber(bean.capacity)}g
          </>
        ) : (
          '-'
        );
      case 'price':
        return bean.price && bean.capacity
          ? formatPrice(bean.price, bean.capacity)
          : '-';
      case 'beanType':
        return bean.beanType === 'espresso'
          ? '意式'
          : bean.beanType === 'filter'
            ? '手冲'
            : bean.beanType === 'omni'
              ? '全能'
              : '-';
      case 'origin':
        return bean.blendComponents?.[0]?.origin || '-';
      case 'estate':
        return bean.blendComponents?.[0]?.estate || '-';
      case 'process':
        return bean.blendComponents?.[0]?.process || '-';
      case 'variety':
        return bean.blendComponents?.[0]?.variety || '-';
      case 'roastLevel':
        return bean.roastLevel || '-';
      case 'flavor':
        return bean.flavor?.join('、') || '-';
      case 'rating':
        return bean.overallRating && bean.overallRating > 0
          ? bean.overallRating
          : '-';
      case 'notes':
        return bean.notes || '-';
      default:
        return '-';
    }
  };

  // 按照配置顺序渲染可见列
  const orderedColumns = useMemo(
    () => TABLE_COLUMN_CONFIG.filter(col => visibleColumns.includes(col.key)),
    [visibleColumns]
  );

  // 渲染表格行
  const renderRow = (bean: ExtendedCoffeeBean) => {
    const isEmpty = isBeanEmpty(bean);

    // 统一两种样式：名称样式（主要）和信息样式（次要）
    const nameCellClass = 'text-xs text-neutral-800 dark:text-neutral-100';
    const infoCellClass = 'text-xs text-neutral-500 dark:text-neutral-500';

    return (
      <tr
        key={bean.id}
        className={`cursor-pointer border-b border-neutral-100 transition-colors hover:bg-neutral-50 dark:border-neutral-800/50 dark:hover:bg-neutral-800/30 ${isEmpty ? 'opacity-50' : ''}`}
        onMouseEnter={e => handleMouseEnter(bean, e)}
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}
        onClick={() => handleDetailClick(bean)}
      >
        {orderedColumns.map((col, index) => {
          const isFirst = index === 0;
          const isLast = index === orderedColumns.length - 1;
          const isName = col.key === 'name';
          const isCapacity = col.key === 'capacity';

          // 只有名称列使用主要样式，其他列使用次要样式
          const cellClass = isName ? nameCellClass : infoCellClass;
          const paddingClass = `py-2.5 ${isFirst ? 'pl-6 pr-3' : isLast ? 'pl-3 pr-6' : 'px-3'}`;
          // 名称、备注、风味列需要限制宽度
          const widthClass =
            col.key === 'name' || col.key === 'notes' || col.key === 'flavor'
              ? 'max-w-[200px] truncate'
              : 'whitespace-nowrap';

          return (
            <td
              key={col.key}
              className={`${cellClass} ${paddingClass} ${widthClass}`}
              onClick={
                isCapacity
                  ? e => {
                      if (bean.capacity && bean.remaining) {
                        e.stopPropagation();
                        onRemainingClick?.(bean, e);
                      }
                    }
                  : undefined
              }
            >
              {renderCellContent(bean, col.key, isEmpty)}
            </td>
          );
        })}
      </tr>
    );
  };

  if (allBeans.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
        [ 暂无咖啡豆数据 ]
      </div>
    );
  }

  const hoveredImageUrl =
    hoveredBean?.image || (hoveredBean ? roasterLogos[hoveredBean.id] : null);

  return (
    <div className="relative h-full w-full">
      {/* 横向滚动容器 */}
      <div
        className="scroll-with-bottom-bar h-full overflow-x-auto overflow-y-auto pb-20"
        style={{
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <table className="w-full min-w-max border-collapse">
          {/* 表头 - 使用 shadow 模拟底边框，因为 border-collapse 表格中 sticky 元素的 border 会被吞掉 */}
          <thead className="sticky top-0 z-10 bg-neutral-50 dark:bg-neutral-900">
            <tr>
              {orderedColumns.map((col, index) => {
                const isFirst = index === 0;
                const isLast = index === orderedColumns.length - 1;
                const paddingClass = `py-2 ${isFirst ? 'pl-6 pr-3' : isLast ? 'pl-3 pr-6' : 'px-3'}`;
                return (
                  <th
                    key={col.key}
                    className={`${paddingClass} border-b border-neutral-100 text-left text-xs whitespace-nowrap text-neutral-500 dark:border-neutral-800/50 dark:text-neutral-500`}
                  >
                    {col.label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {showEmptyBeans &&
            emptyBeans.length > 0 &&
            filteredBeans.length > 0 ? (
              <>
                {filteredBeans.map(renderRow)}
                {emptyBeans.map(renderRow)}
              </>
            ) : (
              allBeans.map(renderRow)
            )}
          </tbody>
        </table>
      </div>

      {/* 鼠标跟随图片 - 仅桌面端 */}
      {isDesktop && hoveredBean && hoveredImageUrl && (
        <div
          ref={imageRef}
          className="pointer-events-none fixed top-0 left-0 z-50 overflow-hidden border border-neutral-200/50 bg-white shadow-xl dark:border-neutral-700/50 dark:bg-neutral-800"
          style={{
            width: 160,
            height: 160,
            opacity: 0,
          }}
        >
          <Image
            src={hoveredImageUrl}
            alt={hoveredBean.name || '咖啡豆图片'}
            fill
            className="object-cover"
            sizes="160px"
            unoptimized
          />
        </div>
      )}
    </div>
  );
};

export default TableView;
