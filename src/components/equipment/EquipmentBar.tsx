'use client';

import React, { useCallback } from 'react';
import TabButton from '@/components/common/ui/TabButton';
import TabBar from '@/components/common/ui/TabBar';
import { type CustomEquipment } from '@/lib/core/config';
import hapticsUtils from '@/lib/ui/haptics';
import { SettingsOptions } from '@/components/settings/Settings';
import { useEquipmentList } from '@/lib/equipment/useEquipmentList';

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

  // 使用自定义Hook管理器具列表
  const { allEquipments } = useEquipmentList({
    customEquipments,
    settings,
  });

  const handleEquipmentSelect = (equipmentId: string) => {
    if (equipmentId === selectedEquipment) return;
    onEquipmentSelect(equipmentId);
    void triggerHaptic();
  };

  const handleToggleManagement = async () => {
    await triggerHaptic();
    onToggleManagementDrawer?.();
  };

  return (
    <TabBar className={`relative min-w-0 w-full overflow-hidden ${className}`}>
      <div className="flex items-end md:flex-col md:items-start md:gap-4">
        {/* 器具选择滚动区域 */}
        <div
          data-category-scroll
          className="flex min-w-0 flex-1 items-end gap-3 overflow-x-auto pr-2 md:min-h-0 md:w-full md:flex-none md:flex-col md:items-start md:gap-4 md:overflow-visible md:pr-0"
        >
          {allEquipments.map(equipment => (
            <div
              key={equipment.id}
              className="flex shrink-0 items-end md:min-w-0 md:w-full md:items-center"
            >
              <div className="relative flex items-end md:min-w-0 md:w-full md:items-center">
                <TabButton
                  isActive={selectedEquipment === equipment.id}
                  onClick={() => handleEquipmentSelect(equipment.id)}
                  aria-label={`选择器具: ${equipment.name}`}
                  className="inline-flex items-center md:min-h-0 md:min-w-0 md:max-w-full md:border-b-0 md:pb-0 md:text-left md:whitespace-normal md:[overflow-wrap:anywhere]"
                  dataTab={equipment.id}
                >
                  {equipment.name}
                </TabButton>
              </div>
            </div>
          ))}

          {/* 横向滚动提示仅在移动端显示 */}
          <div
            data-scroll-shadow="left"
            className="fade-mask-to-r pointer-events-none absolute top-0 left-0 h-full w-6 bg-neutral-50/95 md:hidden dark:bg-neutral-900/95"
          />
        </div>

        {/* 固定在右侧的管理按钮 - 桌面端在底部 */}
        <div className="relative flex shrink-0 items-end md:w-full md:items-start">
          <button
            onClick={handleToggleManagement}
            type="button"
            className="relative inline-flex items-center gap-3 pb-1.5 pl-3 text-xs font-medium whitespace-nowrap text-neutral-600 transition-colors duration-150 hover:opacity-80 md:min-h-0 md:flex-col md:items-start md:gap-4 md:pb-0 md:pl-0 dark:text-neutral-400"
            aria-label="器具列表"
          >
            <span
              aria-hidden="true"
              className="h-3 w-px shrink-0 bg-neutral-200 md:h-px md:w-6 dark:bg-neutral-800"
            />
            <span className="flex items-center whitespace-nowrap">编辑</span>
          </button>

          {/* 横向滚动提示仅在移动端显示 */}
          <div
            data-scroll-shadow="right"
            className="fade-mask-to-l pointer-events-none absolute top-0 -left-6 h-full w-6 bg-neutral-50/95 md:top-auto md:bottom-0 md:left-0 md:hidden dark:bg-neutral-900/95"
          />
        </div>
      </div>
    </TabBar>
  );
};

export default EquipmentBar;
