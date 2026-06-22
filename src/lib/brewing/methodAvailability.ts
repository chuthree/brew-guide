import {
  commonMethods,
  getBaseEquipmentIdByAnimationType,
  inferBaseEquipmentIdFromCustomEquipmentId,
  type CustomEquipment,
  type Method,
} from '@/lib/core/config';

export const hasBrewingStages = (method: Method): boolean =>
  method.params.stages.length > 0;

export const getCommonMethodBaseEquipmentId = (
  equipmentId: string | null | undefined,
  customEquipments: CustomEquipment[] = []
): string => {
  if (!equipmentId) return '';

  const customEquipment = customEquipments.find(
    equipment => equipment.id === equipmentId || equipment.name === equipmentId
  );

  if (customEquipment) {
    return customEquipment.animationType === 'custom'
      ? ''
      : getBaseEquipmentIdByAnimationType(customEquipment.animationType);
  }

  if (commonMethods[equipmentId]) return equipmentId;

  return equipmentId.startsWith('custom-')
    ? inferBaseEquipmentIdFromCustomEquipmentId(equipmentId)
    : '';
};

export const getCommonMethodsForEquipment = (
  equipmentId: string | null | undefined,
  customEquipments: CustomEquipment[] = []
): Method[] => {
  const baseEquipmentId = getCommonMethodBaseEquipmentId(
    equipmentId,
    customEquipments
  );

  return baseEquipmentId ? commonMethods[baseEquipmentId] || [] : [];
};
