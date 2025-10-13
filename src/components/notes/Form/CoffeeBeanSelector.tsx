'use client'

import React, { useMemo, useRef, useEffect } from 'react'
import { Virtuoso } from 'react-virtuoso'
import Image from 'next/image'
import type { CoffeeBean } from '@/types/app'
import { calculateFlavorInfo } from '@/lib/utils/flavorPeriodUtils'

interface CoffeeBeanSelectorProps {
  coffeeBeans: CoffeeBean[]
  selectedCoffeeBean: CoffeeBean | null
  onSelect: (bean: CoffeeBean | null) => void
  searchQuery?: string
  highlightedBeanId?: string | null
  scrollParentRef?: HTMLElement
  showStatusDots?: boolean
}

// 定义列表项类型
type VirtuosoItem = 
  | { __type: 'none' }
  | { __type: 'bean'; bean: CoffeeBean }

// 计算咖啡豆的赏味期阶段和剩余天数
const getFlavorInfo = (bean: CoffeeBean) => {
  const flavorInfo = calculateFlavorInfo(bean);
  return {
    phase: flavorInfo.phase,
    remainingDays: flavorInfo.remainingDays
  };
}

// 获取阶段数值用于排序
const getPhaseValue = (phase: string): number => {
  switch (phase) {
    case '在途': return -1; // 在途状态优先级最高
    case '冷冻': return 0; // 冷冻状态与赏味期同等优先级
    case '赏味期': return 0;
    case '养豆期': return 1;
    case '衰退期':
    default: return 2;
  }
}

const CoffeeBeanSelector: React.FC<CoffeeBeanSelectorProps> = ({
  coffeeBeans,
  selectedCoffeeBean: _selectedCoffeeBean,
  onSelect,
  searchQuery = '',
  highlightedBeanId = null,
  scrollParentRef,
  showStatusDots = true
}) => {
  // 添加ref用于存储咖啡豆元素列表
  const beanItemsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  
  // 设置ref的回调函数
  const setItemRef = React.useCallback((id: string) => (node: HTMLDivElement | null) => {
    if (node) {
      beanItemsRef.current.set(id, node);
    } else {
      beanItemsRef.current.delete(id);
    }
  }, []);
  
  // 滚动到高亮的咖啡豆
  useEffect(() => {
    if (highlightedBeanId && beanItemsRef.current.has(highlightedBeanId)) {
      // 滚动到高亮的咖啡豆
      const node = beanItemsRef.current.get(highlightedBeanId);
      node?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [highlightedBeanId]);

  // 过滤出未用完的咖啡豆，并按赏味期排序
  const availableBeans = useMemo(() => {
    // 首先过滤掉剩余量为0(且设置了容量)的咖啡豆和在途状态的咖啡豆
    const filteredBeans = coffeeBeans.filter(bean => {
      // 过滤掉在途状态的咖啡豆
      if (bean.isInTransit) {
        return false;
      }

      // 如果没有设置容量，则直接显示
      if (!bean.capacity || bean.capacity === '0' || bean.capacity === '0g') {
        return true;
      }

      // 考虑remaining可能是字符串或者数字
      const remaining = typeof bean.remaining === 'string'
        ? parseFloat(bean.remaining)
        : Number(bean.remaining);

      // 只过滤掉有容量设置且剩余量为0的咖啡豆
      return remaining > 0;
    });

    // 然后按照赏味期等进行排序（与冲煮-咖啡豆列表保持一致）
    return [...filteredBeans].sort((a, b) => {
      const { phase: phaseA, remainingDays: daysA } = getFlavorInfo(a);
      const { phase: phaseB, remainingDays: daysB } = getFlavorInfo(b);

      // 首先按照阶段排序：赏味期 > 养豆期 > 衰退期
      if (phaseA !== phaseB) {
        const phaseValueA = getPhaseValue(phaseA);
        const phaseValueB = getPhaseValue(phaseB);
        return phaseValueA - phaseValueB;
      }

      // 如果阶段相同，根据不同阶段有不同的排序逻辑
      if (phaseA === '赏味期') {
        // 赏味期内，剩余天数少的排在前面
        return daysA - daysB;
      } else if (phaseA === '养豆期') {
        // 养豆期内，剩余天数少的排在前面（离赏味期近的优先）
        return daysA - daysB;
      } else {
        // 衰退期按烘焙日期新的在前
        if (!a.roastDate || !b.roastDate) return 0;
        return new Date(b.roastDate).getTime() - new Date(a.roastDate).getTime();
      }
    });
  }, [coffeeBeans]);

  // 搜索过滤
  const filteredBeans = useMemo(() => {
    if (!searchQuery?.trim()) return availableBeans;
    
    const query = searchQuery.toLowerCase().trim();
    return availableBeans.filter(bean => 
      bean.name?.toLowerCase().includes(query)
    );
  }, [availableBeans, searchQuery]);

  // 构造用于渲染的数据：把“不要使用咖啡豆”作为第一个虚拟项，与豆子列表一起滚动
  const virtuosoData = useMemo(() => {
    return [{ __type: 'none' } as const, ...filteredBeans.map(b => ({ __type: 'bean' as const, bean: b }))];
  }, [filteredBeans]);

  return (
    <div className="py-3">
      <div>
        <div className="space-y-5">
          {filteredBeans.length > 0 ? (
            <Virtuoso
              {...(scrollParentRef ? { customScrollParent: scrollParentRef } : { useWindowScroll: true })}
              data={virtuosoData}
              components={(() => {
                const ListCmp = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ style, children, ...props }, ref) => (
                  <div ref={ref} style={style} {...props}>
                    {children}
                  </div>
                ));
                ListCmp.displayName = 'CoffeeBeanSelectorVirtuosoList';
                return { List: ListCmp };
              })()}
              itemContent={(_index, item: VirtuosoItem) => {
              if (item.__type === 'none') {
                return (
                  <div
                    className="group relative cursor-pointer text-neutral-500 dark:text-neutral-400 transition-all duration-300 pb-5"
                    onClick={() => onSelect(null)}
                  >
                    <div className="cursor-pointer">
                      <div className="flex gap-3">
                        <div className="relative self-start">
                          <div className="w-14 h-14 relative shrink-0 rounded border border-neutral-200/50 dark:border-neutral-800/50 bg-neutral-100 dark:bg-neutral-800/20" />
                        </div>
                        <div className="flex flex-col justify-center gap-y-1.5">
                          <div className="text-xs font-medium text-neutral-800 dark:text-neutral-100 leading-tight line-clamp-2 text-justify">
                            不使用咖啡豆
                          </div>
                          <div className="text-xs font-medium tracking-wide text-neutral-600 dark:text-neutral-400 leading-relaxed">
                            <span className="inline">跳过咖啡豆选择</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }
              const bean = item.bean;
              // 获取赏味期状态
              let freshStatus = "";
              let statusClass = "text-neutral-500 dark:text-neutral-400";

              if (bean.isInTransit) {
                // 在途状态处理
                freshStatus = "(在途)";
                statusClass = "text-neutral-600 dark:text-neutral-400";
              } else if (bean.isFrozen) {
                // 冷冻状态处理
                freshStatus = "(冷冻)";
                statusClass = "text-blue-400 dark:text-blue-300";
              } else if (bean.roastDate) {
                const { phase } = getFlavorInfo(bean);
                
                if (phase === '养豆期') {
                  freshStatus = `(养豆期)`;
                  statusClass = "text-neutral-500 dark:text-neutral-400";
                } else if (phase === '赏味期') {
                  freshStatus = `(赏味期)`;
                  statusClass = "text-emerald-500 dark:text-emerald-400";
                } else {
                  freshStatus = "(衰退期)";
                  statusClass = "text-neutral-500 dark:text-neutral-400";
                }
              }

              // 格式化数字显示，整数时不显示小数点
              const formatNumber = (value: string | undefined): string =>
                !value ? '0' : (Number.isInteger(parseFloat(value)) ? Math.floor(parseFloat(value)).toString() : value);

              // 格式化日期显示
              const formatDateShort = (dateStr: string): string => {
                const date = new Date(dateStr);
                const year = date.getFullYear().toString().slice(-2); // 获取年份的最后两位
                return `${year}-${date.getMonth() + 1}-${date.getDate()}`;
              };

              // 格式化克价显示（只显示每克价格）
              const formatPricePerGram = (price: string, capacity: string): string => {
                const priceNum = parseFloat(price);
                const capacityNum = parseFloat(capacity.replace('g', ''));
                if (isNaN(priceNum) || isNaN(capacityNum) || capacityNum === 0) return '';
                const pricePerGram = priceNum / capacityNum;
                return `${pricePerGram.toFixed(2)}元/克`;
              };

              // 构建参数信息项（使用与咖啡豆库存列表相同的格式）
              const infoItems = [];

              // 添加烘焙日期（在途状态不显示）
              if (bean.roastDate && !bean.isInTransit) {
                infoItems.push(formatDateShort(bean.roastDate));
              }

              // 添加容量信息
              const remaining = typeof bean.remaining === 'string' ? parseFloat(bean.remaining) : bean.remaining ?? 0;
              const capacity = typeof bean.capacity === 'string' ? parseFloat(bean.capacity) : bean.capacity ?? 0;
              if (remaining > 0 && capacity > 0) {
                infoItems.push(`${formatNumber(bean.remaining)}/${formatNumber(bean.capacity)}克`);
              }

              // 添加价格信息
              if (bean.price && bean.capacity) {
                infoItems.push(formatPricePerGram(bean.price, bean.capacity));
              }

              // 获取状态圆点的颜色
              const getStatusDotColor = (phase: string): string => {
                switch (phase) {
                  case '养豆期':
                    return 'bg-amber-400'; // 黄色
                  case '赏味期':
                    return 'bg-green-400'; // 绿色
                  case '衰退期':
                    return 'bg-red-400'; // 红色
                  case '在途':
                    return 'bg-blue-400'; // 蓝色
                  case '冷冻':
                    return 'bg-cyan-400'; // 冰蓝色
                  case '未知':
                  default:
                    return 'bg-neutral-400'; // 灰色
                }
              };

              // 获取当前豆子的状态阶段
              const { phase } = getFlavorInfo(bean);

              return (
                <div
                  className="group relative cursor-pointer text-neutral-500 dark:text-neutral-400 transition-all duration-300 pb-5"
                  onClick={() => onSelect(bean)}
                  ref={setItemRef(bean.id)}
                >
                  <div className="cursor-pointer">
                    <div className="flex gap-3">
                      {/* 左侧图片区域 - 固定显示，缩小尺寸 */}
                      <div className="relative self-start">
                        <div className="w-14 h-14 relative shrink-0 cursor-pointer rounded border border-neutral-200/50 dark:border-neutral-800/50 bg-neutral-100 dark:bg-neutral-800/20 overflow-hidden">
                          {bean.image ? (
                            <Image
                              src={bean.image}
                              alt={bean.name || '咖啡豆图片'}
                              width={56}
                              height={56}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-neutral-400 dark:text-neutral-600">
                              {bean.name ? bean.name.charAt(0) : '豆'}
                            </div>
                          )}
                        </div>

                        {/* 状态圆点 - 右下角，边框超出图片边界 - 只有当有赏味期数据时才显示 */}
                        {showStatusDots && bean.roastDate && (bean.startDay || bean.endDay || bean.roastLevel) && (
                          <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ${getStatusDotColor(phase)} border-2 border-neutral-50 dark:border-neutral-900`} />
                        )}
                      </div>

                      {/* 右侧内容区域 - 与图片等高 */}
                      <div className="flex flex-col justify-center gap-y-1.5">
                        {/* 咖啡豆名称和烘焙度 */}
                        <div className="text-xs font-medium text-neutral-800 dark:text-neutral-100 leading-tight line-clamp-2 text-justify">
                          {bean.name}
                          {bean.roastLevel && ` ${bean.roastLevel}`}
                          <span className={statusClass}> {freshStatus}</span>
                        </div>

                        {/* 其他信息 */}
                        <div className="text-xs font-medium tracking-wide text-neutral-600 dark:text-neutral-400 leading-relaxed">
                          {infoItems.map((item, i) => (
                            <React.Fragment key={i}>
                              <span className="inline">{item}</span>
                              {i < infoItems.length - 1 && (
                                <span className="mx-2 text-neutral-400 dark:text-neutral-600">·</span>
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
          ) : (
            <div className="flex gap-3">
              {/* 左侧占位区域 - 与咖啡豆图片保持一致的尺寸 */}
              <div className="w-14 h-14 shrink-0"></div>

              {/* 右侧内容区域 */}
              <div className="flex-1 min-w-0 flex flex-col justify-center h-14">
                <div className="text-xs text-neutral-500 dark:text-neutral-400">
                  {searchQuery.trim()
                    ? `没有找到匹配"${searchQuery.trim()}"的咖啡豆`
                    : "没有可用的咖啡豆，请先添加咖啡豆"
                  }
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CoffeeBeanSelector 
