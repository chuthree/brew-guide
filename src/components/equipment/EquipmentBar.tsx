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
    <div className={`relative w-full overflow-hidden ${className}`}>
      <div className="flex items-end md:flex-col md:items-start md:gap-4">
        {/* 器具选择滚动区域 */}
        <div
          ref={scrollContainerRef}
          className="flex min-h-7 flex-1 items-end gap-4 overflow-x-auto pr-2 md:min-h-0 md:w-full md:flex-col md:items-start md:gap-4 md:overflow-x-visible md:overflow-y-auto md:pr-0"
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
              className="flex shrink-0 items-end md:w-full md:items-center"
            >
              <div className="relative flex items-end whitespace-nowrap md:w-full md:items-center">
                <button
                  type="button"
                  onClick={() => handleEquipmentSelect(equipment.id)}
                  aria-label={`选择器具: ${equipment.name}`}
                  aria-pressed={selectedEquipment === equipment.id}
                  className="relative inline-flex min-h-6 items-center pb-1.5 text-xs font-medium tracking-widest whitespace-nowrap transition-colors duration-150 md:min-h-0 md:pb-0"
                  data-tab={equipment.id}
                >
                  <span
                    className={`relative ${
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
                </button>
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
        <div className="relative flex shrink-0 items-end md:w-full md:items-start">
          <button
            onClick={handleToggleManagement}
            type="button"
            className="relative inline-flex min-h-6 items-center gap-3 pb-1.5 pl-3 text-xs font-medium tracking-widest whitespace-nowrap text-neutral-600 transition-colors duration-150 hover:opacity-80 md:min-h-0 md:flex-col md:items-start md:gap-4 md:pb-0 md:pl-0 dark:text-neutral-400"
            aria-label="器具列表"
          >
            <span
              aria-hidden="true"
              className="h-3 w-px shrink-0 bg-neutral-200 md:h-px md:w-6 dark:bg-neutral-800"
            />
            <span className="flex items-center whitespace-nowrap">编辑</span>
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
