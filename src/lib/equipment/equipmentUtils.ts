/**
 * 器具相关的工具函数和类型定义
 */

import { equipmentList, type CustomEquipment } from '@/lib/core/config';

// 器具项目数据类型
export interface EquipmentItem {
  type: 'equipment' | 'addButton';
  id: string;
  name: string;
  isSelected: boolean;
  isCustom: boolean;
  onClick: () => void;
}

// 器具排序数据
export interface EquipmentOrder {
  equipmentIds: string[]; // 所有器具的ID顺序（包含系统和自定义器具）
}

// 器具栏相关工具函数
export const equipmentUtils = {
  /**
   * 合并所有器具数据（内置 + 自定义）并应用排序
   */
  getAllEquipments: (
    customEquipments: CustomEquipment[],
    equipmentOrder?: EquipmentOrder
  ) => {
    const systemEquipments = equipmentList.map(eq => ({
      ...eq,
      isCustom: false,
    }));
    const customEquipmentsWithFlag = customEquipments.map(eq => ({
      ...eq,
      isCustom: true,
    }));

    // 合并所有器具
    const allEquipments = [...systemEquipments, ...customEquipmentsWithFlag];

    // 如果没有排序信息，返回默认顺序
    if (!equipmentOrder || equipmentOrder.equipmentIds.length === 0) {
      return allEquipments;
    }

    // 按照排序重新排列
    const sortedEquipments: typeof allEquipments = [];

    // 按排序顺序添加器具
    for (const id of equipmentOrder.equipmentIds) {
      const equipment = allEquipments.find(eq => eq.id === id);
      if (equipment) {
        sortedEquipments.push(equipment);
      }
    }

    // 添加未在排序中的器具（新增的器具）
    allEquipments.forEach(eq => {
      if (!equipmentOrder.equipmentIds.includes(eq.id)) {
        sortedEquipments.push(eq);
      }
    });

    return sortedEquipments;
  },

  /**
   * 获取器具名称
   */
  getEquipmentName: (
    selectedEquipment: string | null,
    customEquipments: CustomEquipment[] = []
  ): string | null => {
    if (!selectedEquipment) return null;

    const allEquipments = equipmentUtils.getAllEquipments(customEquipments);
    const equipment = allEquipments.find(eq => eq.id === selectedEquipment);
    return equipment?.name || null;
  },

  /**
   * 检查是否为自定义器具
   */
  isCustomEquipment: (
    equipmentId: string,
    customEquipments: CustomEquipment[]
  ): boolean => {
    return customEquipments.some(eq => eq.id === equipmentId);
  },

  /**
   * 从排序后的器具列表生成排序数据
   */
  generateEquipmentOrder: (
    allEquipments: Array<{ id: string }>
  ): EquipmentOrder => {
    return {
      equipmentIds: allEquipments.map(eq => eq.id),
    };
  },

  /**
   * 创建器具项目数据
   */
  createEquipmentItems: (
    allEquipments: Array<{ id: string; name: string; isCustom?: boolean }>,
    selectedEquipment: string | null,
    onEquipmentClick: (id: string) => void,
    onAddClick: () => void
  ): EquipmentItem[] => [
    ...allEquipments.map(equipment => ({
      type: 'equipment' as const,
      id: equipment.id,
      name: equipment.name,
      isSelected: selectedEquipment === equipment.id,
      isCustom: equipment.isCustom || false,
      onClick: () => onEquipmentClick(equipment.id),
    })),
    {
      type: 'addButton' as const,
      id: 'add',
      name: '添加器具',
      isSelected: false,
      isCustom: false,
      onClick: onAddClick,
    },
  ],

  /**
   * 滚动到选中的器具
   */
  scrollToSelected: (
    container: HTMLDivElement | null,
    selectedEquipment: string | null
  ) => {
    if (!container || !selectedEquipment) return;

    const selectedElement = container.querySelector(
      `[data-tab="${selectedEquipment}"]`
    );
    if (!selectedElement) return;

    const containerRect = container.getBoundingClientRect();
    const elementRect = selectedElement.getBoundingClientRect();

    // 计算元素相对于容器的位置
    const elementLeft =
      elementRect.left - containerRect.left + container.scrollLeft;
    const elementWidth = elementRect.width;
    const containerWidth = containerRect.width;

    // 计算目标滚动位置（将选中项居中）
    const targetScrollLeft = elementLeft - (containerWidth - elementWidth) / 2;

    // 平滑滚动到目标位置
    container.scrollTo({
      left: Math.max(0, targetScrollLeft),
      behavior: 'smooth',
    });
  },

  /**
   * 检查滚动边框显示状态
   */
  getScrollBorderState: (
    container: HTMLDivElement
  ): {
    showLeftBorder: boolean;
    showRightBorder: boolean;
  } => {
    const scrollLeft = container.scrollLeft;
    const scrollWidth = container.scrollWidth;
    const clientWidth = container.clientWidth;

    // 左边框：当向右滚动时显示
    const showLeftBorder = scrollLeft > 0;

    // 右边框：当还能继续向右滚动时显示
    const maxScrollLeft = scrollWidth - clientWidth;
    const showRightBorder = maxScrollLeft > 0 && scrollLeft < maxScrollLeft - 1;

    return { showLeftBorder, showRightBorder };
  },
};

export default equipmentUtils;
