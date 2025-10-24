'use client';

import React, { useCallback, useRef } from 'react';
import { type CustomEquipment } from '@/lib/core/config';
import hapticsUtils from '@/lib/ui/haptics';
import { saveStringState } from '@/lib/core/statePersistence';
import { SettingsOptions } from '@/components/settings/Settings';
import { useEquipmentList } from '@/lib/equipment/useEquipmentList';
import {
  useScrollToSelected,
  useScrollBorder,
} from '@/lib/equipment/useScrollToSelected';

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
    saveStringState('brewing-equipment', 'selectedEquipment', equipmentId);
  };

  const handleToggleManagement = async () => {
    await triggerHaptic();
    onToggleManagementDrawer?.();
  };

  return (
    <div className={`relative w-full overflow-hidden ${className}`}>
      <div className="mt-2 flex items-center">
        {/* 器具选择滚动区域 */}
        <div
          ref={scrollContainerRef}
          className="flex flex-1 items-center gap-4 overflow-x-auto pr-2"
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
            <div key={equipment.id} className="flex flex-shrink-0 items-center">
              <div className="relative flex items-center whitespace-nowrap">
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
                  className="relative cursor-pointer pb-2 text-xs font-medium tracking-widest whitespace-nowrap"
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
                    <span className="absolute bottom-0 left-0 h-px w-full bg-neutral-800 dark:bg-neutral-100"></span>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* 左边框指示器 */}
          <div
            className={`pointer-events-none absolute top-0 left-0 h-full w-6 bg-gradient-to-r from-neutral-50/95 to-transparent transition-opacity duration-200 ease-out dark:from-neutral-900/95 ${
              showLeftBorder ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </div>

        {/* 固定在右侧的管理按钮 */}
        <div className="relative flex flex-shrink-0 items-center">
          <button
            onClick={handleToggleManagement}
            className="relative flex cursor-pointer items-center justify-center pb-2 pl-3 tracking-widest whitespace-nowrap"
            aria-label="器具列表"
          >
            <div className="mr-3 h-3 w-px bg-neutral-200 dark:bg-neutral-800"></div>
            <span className="flex items-center text-xs font-medium whitespace-nowrap text-neutral-600 dark:text-neutral-400">
              编辑
            </span>
          </button>

          {/* 右边渐变指示器 - 从按钮左侧开始 */}
          <div
            className={`pointer-events-none absolute top-0 -left-6 h-full w-6 bg-gradient-to-l from-neutral-50/95 to-transparent transition-opacity duration-200 ease-out dark:from-neutral-900/95 ${
              showRightBorder ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </div>
      </div>
    </div>
  );
};

export default EquipmentBar;
