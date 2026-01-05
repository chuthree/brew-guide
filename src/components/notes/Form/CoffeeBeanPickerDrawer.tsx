'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Shuffle } from 'lucide-react';
import type { CoffeeBean, SelectableCoffeeBean } from '@/types/app';
import CoffeeBeanSelector from './CoffeeBeanSelector';
import { useModalHistory } from '@/lib/hooks/useModalHistory';
import { useThemeColor } from '@/lib/hooks/useThemeColor';
import { useCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore';
import {
  createPendingBean,
  isPendingCoffeeBean,
} from '@/lib/utils/coffeeBeanUtils';
import { showToast } from '@/components/common/feedback/LightToast';
import hapticsUtils from '@/lib/ui/haptics';
import dynamic from 'next/dynamic';

// 动态导入随机选择器
const CoffeeBeanRandomPicker = dynamic(
  () => import('@/components/coffee-bean/RandomPicker/CoffeeBeanRandomPicker'),
  { ssr: false, loading: () => null }
);

interface CoffeeBeanPickerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (bean: SelectableCoffeeBean | null) => void;
  selectedBean?: SelectableCoffeeBean | null;
  showStatusDots?: boolean;
  hapticFeedback?: boolean;
}

const CoffeeBeanPickerDrawer: React.FC<CoffeeBeanPickerDrawerProps> = ({
  isOpen,
  onClose,
  onSelect,
  selectedBean,
  showStatusDots = true,
  hapticFeedback = true,
}) => {
  // 动画状态管理
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // 搜索状态
  const [searchQuery, setSearchQuery] = useState('');
  const [showRandomPicker, setShowRandomPicker] = useState(false);
  const [isLongPressRandom, setIsLongPressRandom] = useState(false);

  // 滚动容器状态
  const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(
    null
  );

  // refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // callback ref: DOM 挂载时更新 state，触发重新渲染
  const contentScrollRefCallback = useCallback(
    (node: HTMLDivElement | null) => {
      setScrollContainer(node);
    },
    []
  );

  // 从 Store 获取咖啡豆数据
  const allBeans = useCoffeeBeanStore(state => state.beans);
  const storeInitialized = useCoffeeBeanStore(state => state.initialized);
  const loadBeans = useCoffeeBeanStore(state => state.loadBeans);

  // 同步顶部安全区颜色
  useThemeColor({ useOverlay: true, enabled: isOpen });

  // 历史栈管理
  useModalHistory({
    id: 'coffee-bean-picker-drawer',
    isOpen,
    onClose,
  });

  // 确保 Store 已初始化
  useEffect(() => {
    if (!storeInitialized) {
      loadBeans();
    }
  }, [storeInitialized, loadBeans]);

  // 处理显示/隐藏动画
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      const timer = setTimeout(() => setIsVisible(true), 10);
      // 动画完成后自动聚焦搜索输入框
      const focusTimer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 400);
      return () => {
        clearTimeout(timer);
        clearTimeout(focusTimer);
      };
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => {
        setShouldRender(false);
        setSearchQuery('');
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // 触感反馈
  const triggerHaptic = useCallback(() => {
    if (hapticFeedback) {
      hapticsUtils.light();
    }
  }, [hapticFeedback]);

  // 处理选择
  const handleSelect = useCallback(
    (bean: CoffeeBean | null) => {
      triggerHaptic();
      onSelect(bean);
      onClose();
    },
    [onSelect, onClose, triggerHaptic]
  );

  // 处理随机选择
  const handleRandomBean = useCallback(
    (isLongPress: boolean = false) => {
      triggerHaptic();

      const availableBeans = allBeans.filter(bean => {
        if (bean.isInTransit) return false;
        if (bean.beanState === 'green') return false;
        if (!bean.capacity || bean.capacity === '0' || bean.capacity === '0g')
          return true;
        return parseFloat(bean.remaining || '0') > 0;
      });

      if (availableBeans.length > 0) {
        setIsLongPressRandom(isLongPress);
        setShowRandomPicker(true);
      } else {
        showToast({ type: 'info', title: '没有可用的咖啡豆', duration: 2000 });
      }
    },
    [allBeans, triggerHaptic]
  );

  // 处理随机选择结果
  const handleRandomSelect = useCallback(
    (bean: CoffeeBean) => {
      setShowRandomPicker(false);
      setIsLongPressRandom(false);
      handleSelect(bean);
    },
    [handleSelect]
  );

  // 处理创建待定咖啡豆（延迟到笔记保存时才真正创建）
  const handleCreatePendingBean = useCallback(
    (name: string) => {
      triggerHaptic();
      const pendingBean = createPendingBean(name);
      onSelect(pendingBean);

      // 使用 setTimeout 将 onClose 推迟到下一个事件循环
      // 确保 onSelect 的状态更新先被 React 处理完成
      setTimeout(() => {
        onClose();
      }, 0);
    },
    [onSelect, onClose, triggerHaptic]
  );

  if (!shouldRender) return null;

  return (
    <>
      {/* 背景遮罩 */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-400 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />

      {/* 抽屉内容 */}
      <div
        ref={modalRef}
        className={`fixed inset-x-0 bottom-0 z-50 mx-auto flex h-[85vh] max-w-md flex-col rounded-t-3xl bg-white shadow-xl transition-transform duration-400 ease-[cubic-bezier(0.32,0.72,0,1)] dark:bg-neutral-900 ${isVisible ? 'translate-y-0' : 'translate-y-full'}`}
      >
        <div className="flex h-full flex-col overflow-hidden px-6 pt-4">
          {/* 顶部搜索区域 */}
          <div className="mb-4 flex shrink-0 items-center gap-2">
            {/* 胶囊搜索输入框 */}
            <div className="relative flex-1">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="输入咖啡豆名称..."
                className="w-full rounded-full border-none bg-neutral-100 px-3 py-3 pl-11 text-sm font-medium text-neutral-800 placeholder-neutral-400 outline-none dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder-neutral-500"
                autoComplete="off"
                onKeyDown={e => {
                  if (e.key === 'Escape') {
                    setSearchQuery('');
                    searchInputRef.current?.blur();
                  }
                }}
              />
              <Search className="pointer-events-none absolute top-1/2 left-4 z-20 h-4 w-4 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute top-1/2 right-3 z-20 -translate-y-1/2 rounded-full p-1 text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
                >
                  <X className="h-4 w-4" strokeWidth="2.5" />
                </button>
              )}
            </div>

            {/* 随机选择按钮 */}
            <button
              type="button"
              onClick={() => handleRandomBean(false)}
              onMouseDown={() => {
                const timer = setTimeout(() => handleRandomBean(true), 500);
                const handleMouseUp = () => {
                  clearTimeout(timer);
                  document.removeEventListener('mouseup', handleMouseUp);
                };
                document.addEventListener('mouseup', handleMouseUp);
              }}
              onTouchStart={() => {
                const timer = setTimeout(() => handleRandomBean(true), 500);
                const handleTouchEnd = () => {
                  clearTimeout(timer);
                  document.removeEventListener('touchend', handleTouchEnd);
                };
                document.addEventListener('touchend', handleTouchEnd);
              }}
              className="flex shrink-0 items-center justify-center rounded-full bg-neutral-100 p-3 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500"
              style={{ height: '44px', width: '44px' }}
            >
              <Shuffle className="h-4 w-4" strokeWidth="2.5" />
            </button>
          </div>

          {/* 咖啡豆列表 */}
          <div
            className="min-h-0 flex-1 overflow-y-auto pb-4"
            ref={contentScrollRefCallback}
          >
            <CoffeeBeanSelector
              coffeeBeans={allBeans}
              selectedCoffeeBean={
                selectedBean && !isPendingCoffeeBean(selectedBean)
                  ? selectedBean
                  : null
              }
              onSelect={handleSelect}
              onCreatePendingBean={handleCreatePendingBean}
              searchQuery={searchQuery}
              showStatusDots={showStatusDots}
              showSkipOption={false}
              scrollParentRef={scrollContainer || undefined}
            />
          </div>
        </div>
      </div>

      {/* 随机选择器 */}
      <CoffeeBeanRandomPicker
        beans={allBeans}
        isOpen={showRandomPicker}
        onClose={() => {
          setShowRandomPicker(false);
          setIsLongPressRandom(false);
        }}
        onSelect={handleRandomSelect}
        isLongPress={isLongPressRandom}
      />
    </>
  );
};

export default CoffeeBeanPickerDrawer;
