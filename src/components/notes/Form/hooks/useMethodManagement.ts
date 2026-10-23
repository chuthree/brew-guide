'use client';

import { useEffect, useMemo } from 'react';
import type { Method, CustomEquipment } from '@/lib/core/config';
import type { SettingsOptions } from '@/components/settings/Settings';
import {
  loadCustomMethods,
  useCustomMethodStore,
} from '@/lib/stores/customMethodStore';
import { getCommonMethodsForEquipment } from '@/lib/brewing/methodAvailability';

const EMPTY_METHODS: Method[] = [];

interface UseMethodManagementProps {
  selectedEquipment: string;
  customEquipments: CustomEquipment[];
  settings?: SettingsOptions;
}

export function useMethodManagement({
  selectedEquipment,
  customEquipments,
  settings,
}: UseMethodManagementProps) {
  const customMethods = useCustomMethodStore(
    state => state.methodsByEquipment[selectedEquipment] ?? EMPTY_METHODS
  );
  const hiddenIds = settings?.hiddenCommonMethods?.[selectedEquipment];
  const commonMethodsOnly = useMemo(() => {
    const methods = getCommonMethodsForEquipment(
      selectedEquipment,
      customEquipments
    );
    return hiddenIds?.length
      ? methods.filter(method => !hiddenIds.includes(method.id || method.name))
      : methods;
  }, [selectedEquipment, customEquipments, hiddenIds]);

  // Initialize the shared store once; switching equipment only selects its data.
  useEffect(() => {
    void loadCustomMethods().catch(error => {
      console.error('加载自定义方案失败:', error);
    });
  }, []);

  return { customMethods, commonMethodsOnly };
}
