'use client'

import React, { useMemo, useRef, useEffect } from 'react'
import type { CoffeeBean } from '@/types/app'

interface CoffeeBeanSelectorProps {
  coffeeBeans: CoffeeBean[]
  selectedCoffeeBean: CoffeeBean | null
  onSelect: (bean: CoffeeBean | null) => void
  searchQuery?: string
  highlightedBeanId?: string | null
}

// 计算咖啡豆的赏味期阶段和剩余天数
const getFlavorInfo = (bean: CoffeeBean) => {
  // 处理在途状态
  if (bean.isInTransit) {
    return { phase: '在途', remainingDays: 0 };
  }

  // 处理冰冻状态
  if (bean.isFrozen) {
    return { phase: '冰冻', remainingDays: 0 };
  }

  if (!bean.roastDate) return { phase: '未知', remainingDays: 0 };

  const today = new Date();
  const roastDate = new Date(bean.roastDate);
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

  if (daysSinceRoast < startDay) {
    // 养豆期
    return { phase: '养豆期', remainingDays: startDay - daysSinceRoast };
  } else if (daysSinceRoast <= endDay) {
    // 赏味期
    return { phase: '赏味期', remainingDays: endDay - daysSinceRoast };
  } else {
    // 衰退期
    return { phase: '衰退期', remainingDays: 0 };
  }
}

// 获取阶段数值用于排序
const getPhaseValue = (phase: string): number => {
  switch (phase) {
    case '在途': return -1; // 在途状态优先级最高
    case '冰冻': return 0; // 冰冻状态与赏味期同等优先级
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
  highlightedBeanId = null
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

  return (
    <div className="py-3">
      <div>
        <div className="space-y-5">
          {/* 不选择咖啡豆选项 */}
          <div 
            className="group relative text-neutral-500 dark:text-neutral-400"
            onClick={() => onSelect(null)}
          >
            <div className="group relative border-l border-neutral-200 dark:border-neutral-800 pl-6 cursor-pointer">
              <div className="cursor-pointer">
                <div className="flex items-baseline justify-between">
                  <div className="flex items-baseline gap-3 min-w-0 overflow-hidden">
                    <h3 className="text-xs font-normal tracking-wider truncate">
                      不选择咖啡豆
                    </h3>
                  </div>
                </div>
                <div className="mt-2">
                  <p className="text-xs font-light">
                    不记录咖啡豆信息，也不会减少咖啡豆剩余量
                  </p>
                </div>
              </div>
            </div>
          </div>

          {filteredBeans.length > 0 ? (
            filteredBeans.map((bean) => {
              // 获取赏味期状态
              let freshStatus = "";
              let statusClass = "text-neutral-500 dark:text-neutral-400";

              if (bean.isInTransit) {
                // 在途状态处理
                freshStatus = "(在途)";
                statusClass = "text-neutral-600 dark:text-neutral-400";
              } else if (bean.isFrozen) {
                // 冰冻状态处理
                freshStatus = "(冰冻)";
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

              // 准备简洁的信息列表
              const items = [];

              // 添加容量信息
              const remaining = typeof bean.remaining === 'string' ? parseFloat(bean.remaining) : bean.remaining ?? 0;
              const capacity = typeof bean.capacity === 'string' ? parseFloat(bean.capacity) : bean.capacity ?? 0;
              if (remaining > 0 && capacity > 0) {
                items.push(`容量 ${remaining}/${capacity} g`);
              }

              // 添加烘焙日期（在途状态不显示）
              if (bean.roastDate && !bean.isInTransit) {
                items.push(`烘焙日期 ${bean.roastDate}`);
              }

              // 确定是否高亮当前咖啡豆
              const isHighlighted = highlightedBeanId === bean.id;

              return (
                <div
                  key={bean.id}
                  className="group relative text-neutral-500 dark:text-neutral-400"
                  onClick={() => onSelect(bean)}
                  ref={setItemRef(bean.id)}
                >
                  <div className={`group relative border-l ${isHighlighted
                    ? 'border-neutral-800 dark:border-neutral-100'
                    : 'border-neutral-200 dark:border-neutral-800'}
                    pl-6 cursor-pointer transition-all duration-300`}>
                    <div className="cursor-pointer">
                      <div className="flex gap-4">
                        {/* 左侧图片区域 - 正方形显示 */}
                        {bean.image && (
                          <div className="w-16 h-16 relative shrink-0 border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                            <img
                              src={bean.image}
                              alt={bean.name || '咖啡豆图片'}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                              }}
                            />
                          </div>
                        )}

                        {/* 右侧内容区域 - 与图片等高 */}
                        <div className={`flex-1 min-w-0 flex flex-col ${bean.image ? 'h-16 justify-between' : 'min-h-[2.5rem] justify-start gap-1.5'}`}>
                          {/* 顶部：咖啡豆名称和烘焙度 */}
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <div className="text-xs font-normal text-neutral-800 dark:text-neutral-100 leading-tight line-clamp-2 text-justify">
                              {bean.name}
                              {bean.roastLevel && ` ${bean.roastLevel}`}
                              <span className={statusClass}> {freshStatus}</span>
                            </div>
                          </div>

                          {/* 底部：其他信息 */}
                          <div className="space-y-1">
                            {items.map((item, i) => (
                              <div key={i} className="text-[11px] tracking-widest text-neutral-600 dark:text-neutral-400 truncate leading-none">
                                {item}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-xs text-neutral-500 dark:text-neutral-400 border-l border-neutral-200 dark:border-neutral-800 pl-6">
              {searchQuery.trim() 
                ? `没有找到匹配"${searchQuery.trim()}"的咖啡豆`
                : "没有可用的咖啡豆，请先添加咖啡豆"
              }
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CoffeeBeanSelector 