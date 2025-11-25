/**
 * 器具选择状态管理 - 使用 Zustand 实现跨组件实时同步
 */

import { create } from 'zustand';
import { getStringState, saveStringState } from '@/lib/core/statePersistence';

// 常量
const MODULE_NAME = 'brewing-equipment';
const DEFAULT_EQUIPMENT = 'V60';

// 器具选择状态接口
interface EquipmentState {
  // 当前选中的器具ID
  selectedEquipment: string;

  // 设置选中的器具
  setSelectedEquipment: (equipmentId: string) => void;

  // 初始化（从 localStorage 加载）
  initialize: () => void;
}

/**
 * 器具选择 Store
 * 用于在 EquipmentBar、EquipmentCategoryBar 等组件间同步器具选择状态
 */
export const useEquipmentStore = create<EquipmentState>(set => ({
  // 初始状态：服务端渲染时使用默认值，客户端会通过 initialize 加载
  selectedEquipment: DEFAULT_EQUIPMENT,

  // 设置器具并持久化
  setSelectedEquipment: (equipmentId: string) => {
    set({ selectedEquipment: equipmentId });
    // 同步保存到 localStorage
    saveStringState(MODULE_NAME, 'selectedEquipment', equipmentId);
  },

  // 从 localStorage 初始化状态
  initialize: () => {
    if (typeof window !== 'undefined') {
      const cached = getStringState(
        MODULE_NAME,
        'selectedEquipment',
        DEFAULT_EQUIPMENT
      );
      set({ selectedEquipment: cached });
    }
  },
}));

// 导出工具函数，保持向后兼容
export const getSelectedEquipmentFromStore = (): string => {
  return useEquipmentStore.getState().selectedEquipment;
};

export const setSelectedEquipmentInStore = (equipmentId: string): void => {
  useEquipmentStore.getState().setSelectedEquipment(equipmentId);
};
