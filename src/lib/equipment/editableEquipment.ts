import {
  getAnimationTypeFromEquipmentId,
  type CustomEquipment,
  type Equipment,
} from '@/lib/core/config';

type EquipmentSource = Pick<Equipment, 'id' | 'name' | 'note'>;

export function createEditableEquipmentFromPreset(
  equipment: EquipmentSource
): CustomEquipment {
  return {
    id: equipment.id,
    name: equipment.name,
    note: equipment.note,
    isCustom: true,
    animationType: getAnimationTypeFromEquipmentId(equipment.id),
    hasValve: equipment.id === 'CleverDripper',
  };
}
