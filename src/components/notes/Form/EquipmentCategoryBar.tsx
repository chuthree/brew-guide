'use client';

import React from 'react';
import TabButton from '@/components/common/ui/TabButton';
import TabBar from '@/components/common/ui/TabBar';
import { type CustomEquipment } from '@/lib/core/config';
import { useEquipmentList } from '@/lib/equipment/useEquipmentList';
import { type SettingsOptions } from '@/components/settings/Settings';

interface EquipmentCategoryBarProps {
  selectedEquipment: string | null;
  customEquipments: CustomEquipment[];
  onEquipmentSelect: (equipmentId: string) => void;
  settings?: SettingsOptions;
}

const EquipmentCategoryBar: React.FC<EquipmentCategoryBarProps> = ({
  selectedEquipment,
  customEquipments,
  onEquipmentSelect,
  settings,
}) => {

  // 使用自定义Hook管理器具列表
  const { allEquipments } = useEquipmentList({
    customEquipments,
    settings,
  });

  return (
    <TabBar className="mb-3 min-w-0 w-full">
      <div
        data-category-scroll
        className="flex min-w-0 items-center gap-3 overflow-x-auto border-b border-neutral-200/50 dark:border-neutral-800/50"
      >
        {allEquipments.map(equipment => (
          <TabButton
            key={equipment.id}
            isActive={selectedEquipment === equipment.id}
            onClick={() => {
              if (equipment.id !== selectedEquipment) {
                onEquipmentSelect(equipment.id);
              }
            }}
            dataTab={equipment.id}
          >
            {equipment.name}
          </TabButton>
        ))}
      </div>
    </TabBar>
  );
};

export default EquipmentCategoryBar;
