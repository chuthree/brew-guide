'use client';

import React, { useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { type CustomEquipment } from '@/lib/core/config';
import hapticsUtils from '@/lib/ui/haptics';
import { SettingsOptions } from '@/components/settings/Settings';
import { useEquipmentList } from '@/lib/equipment/useEquipmentList';
import {
  useScrollToSelected,
  useScrollBorder,
} from '@/lib/equipment/useScrollToSelected';

// 下划线动画配置
const UNDERLINE_TRANSITION = {
  type: 'spring' as const,
  stiffness: 500,
  damping: 35,
  mass: 1,
};

const useHapticFeedback = (settings: { hapticFeedback?: boolean }) =>
  useCallback(async () => {
    if (settings?.hapticFeedback) hapticsUtils.light();
  }, [settings?.hapticFeedback]);

interface EquipmentBarProps {
  selectedEquipment: string | null;
  customEquipments: CustomEquipment[];
  onEquipmentSelect: (equipmentId: string) => void;
  onToggleManagementDrawer?: () => void;
  settings: SettingsOptions;
  className?: string;
}

const EquipmentBar: React.FC<EquipmentBarProps> = ({
  selectedEquipment,
  customEquipments,
  onEquipmentSelect,
  onToggleManagementDrawer,
  settings,
  className = '',
}) => {
  const triggerHaptic = useHapticFeedback(settings);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 使用自定义Hook管理器具列表
  const { allEquipments } = useEquipmentList({
    customEquipments,
    settings,
  });

  // 使用自定义Hook管理滚动
  useScrollToSelected({
    selectedItem: selectedEquipment,
    containerRef: scrollContainerRef,
  });

  // 使用自定义Hook管理滚动边框
  const { showLeftBorder, showRightBorder } = useScrollBorder({
    containerRef: scrollContainerRef,
    itemCount: allEquipments.length,
  });

  const handleEquipmentSelect = async (equipmentId: string) => {
    await triggerHaptic();
    onEquipmentSelect(equipmentId);
  };

  const handleToggleManagement = async () => {
    await triggerHaptic();
    onToggleManagementDrawer?.();
  };

  return (
    <div
      className={`relative mt-2 w-full overflow-hidden md:mt-7 ${className}`}
    >
      <div className="flex items-center md:flex-col md:items-start md:gap-4">
        {/* 器具选择滚动区域 */}
        <div
          ref={scrollContainerRef}
          className="flex flex-1 items-center gap-4 overflow-x-auto pr-2 md:mt-2 md:w-full md:flex-col md:items-start md:gap-4 md:overflow-x-visible md:overflow-y-auto md:pr-0"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <style jsx>{`
            div::-webkit-scrollbar {
              display: none;
            }
          `}</style>

          {allEquipments.map(equipment => (
            <div
              key={equipment.id}
              className="flex shrink-0 items-center md:w-full"
            >
              <div className="relative flex items-center whitespace-nowrap md:w-full">
                <div
                  onClick={() => handleEquipmentSelect(equipment.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleEquipmentSelect(equipment.id);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`选择器具: ${equipment.name}`}
                  className="relative cursor-pointer pb-2 text-xs font-medium tracking-widest whitespace-nowrap md:pb-0"
                  data-tab={equipment.id}
                >
                  <span
                    className={`relative transition-colors duration-150 ${
                      selectedEquipment === equipment.id
                        ? 'text-neutral-800 dark:text-neutral-100'
                        : 'text-neutral-600 hover:opacity-80 dark:text-neutral-400'
                    }`}
                  >
                    {equipment.name}
                  </span>
                  {selectedEquipment === equipment.id && (
                    <motion.span
                      layoutId="equipment-tab-underline"
                      className="absolute inset-x-0 bottom-0 h-px bg-neutral-800 md:inset-y-0 md:bottom-auto md:left-0 md:h-auto md:w-px dark:bg-neutral-100"
                      transition={UNDERLINE_TRANSITION}
                    />
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* 左边框指示器 - 移动端左侧，桌面端顶部 */}
          <div
            className={`pointer-events-none absolute top-0 left-0 h-full w-6 bg-linear-to-r from-neutral-50/95 to-transparent transition-opacity duration-200 ease-out md:h-6 md:w-full md:bg-linear-to-b dark:from-neutral-900/95 ${
              showLeftBorder ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </div>

        {/* 固定在右侧的管理按钮 - 桌面端在底部 */}
        <div className="relative flex shrink-0 items-center md:w-full">
          <button
            onClick={handleToggleManagement}
            className="relative flex cursor-pointer items-center justify-center pb-2 pl-3 tracking-widest whitespace-nowrap md:flex-col md:items-start md:gap-4 md:pt-0 md:pb-0 md:pl-0"
            aria-label="器具列表"
          >
            <div className="mr-3 h-3 w-px bg-neutral-200 md:mr-0 md:mb-0 md:h-px md:w-6 dark:bg-neutral-800"></div>
            <span className="flex items-center text-xs font-medium whitespace-nowrap text-neutral-600 dark:text-neutral-400">
              编辑
            </span>
          </button>

          {/* 右边渐变指示器 - 移动端右侧，桌面端底部 */}
          <div
            className={`pointer-events-none absolute top-0 -left-6 h-full w-6 bg-linear-to-l from-neutral-50/95 to-transparent transition-opacity duration-200 ease-out md:top-auto md:bottom-0 md:left-0 md:h-6 md:w-full md:bg-linear-to-t dark:from-neutral-900/95 ${
              showRightBorder ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </div>
      </div>
    </div>
  );
};

export default EquipmentBar;
