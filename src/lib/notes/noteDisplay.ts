import type { BrewingNote, CustomEquipment } from '@/lib/core/config';
import { equipmentList } from '@/lib/core/config';
import type { CoffeeBean } from '@/types/app';
import {
  formatNoteBeanDisplayName,
  type RoasterSettings,
} from '@/lib/utils/beanVarietyUtils';

export type CoffeeBeanLookup = ReadonlyMap<string, CoffeeBean>;

const extractNumericValue = (value?: string): number | null => {
  if (!value) return null;

  const match = value.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;

  const parsedValue = Number.parseFloat(match[1]);
  return Number.isNaN(parsedValue) ? null : parsedValue;
};

export const buildCoffeeBeanLookup = (
  beans: CoffeeBean[]
): CoffeeBeanLookup => new Map(beans.map(bean => [bean.id, bean]));

export const buildEquipmentNameMap = (
  customEquipments: CustomEquipment[]
): Record<string, string> => {
  const equipmentNames: Record<string, string> = {};

  equipmentList.forEach(equipment => {
    equipmentNames[equipment.id] = equipment.name;
  });

  customEquipments.forEach(equipment => {
    equipmentNames[equipment.id] = equipment.name;
  });

  return equipmentNames;
};

export const resolveNoteBean = (
  note: Pick<BrewingNote, 'beanId'>,
  coffeeBeanLookup?: CoffeeBeanLookup,
  fallbackBean?: CoffeeBean | null
): CoffeeBean | null => {
  if (note.beanId) {
    return coffeeBeanLookup?.get(note.beanId) ?? fallbackBean ?? null;
  }

  return fallbackBean ?? null;
};

export const resolveNoteCoffeeBeanInfo = (
  note: Pick<BrewingNote, 'beanId' | 'coffeeBeanInfo'>,
  coffeeBeanLookup?: CoffeeBeanLookup,
  fallbackBean?: CoffeeBean | null
): BrewingNote['coffeeBeanInfo'] | null => {
  const linkedBean = resolveNoteBean(note, coffeeBeanLookup, fallbackBean);
  const snapshot = note.coffeeBeanInfo;

  const name = linkedBean?.name?.trim() || snapshot?.name?.trim() || '';
  const roastLevel =
    linkedBean?.roastLevel?.trim() || snapshot?.roastLevel?.trim() || '';
  const roastDate =
    linkedBean?.roastDate?.trim() || snapshot?.roastDate?.trim() || undefined;
  const roaster =
    linkedBean?.roaster?.trim() || snapshot?.roaster?.trim() || undefined;

  if (!name && !roastLevel && !roastDate && !roaster) {
    return null;
  }

  return {
    name,
    roastLevel,
    ...(roastDate ? { roastDate } : {}),
    ...(roaster ? { roaster } : {}),
  };
};

export const resolveNoteBeanDisplayName = (
  note: Pick<BrewingNote, 'beanId' | 'coffeeBeanInfo'>,
  coffeeBeanLookup?: CoffeeBeanLookup,
  settings?: RoasterSettings,
  fallbackBean?: CoffeeBean | null
): string =>
  formatNoteBeanDisplayName(
    resolveNoteCoffeeBeanInfo(note, coffeeBeanLookup, fallbackBean),
    settings
  );

export const resolveEquipmentName = (
  equipmentId: string | null | undefined,
  equipmentNames: Record<string, string>,
  fallbackLabel: string = '未知器具'
): string => {
  if (!equipmentId || equipmentId.trim() === '') {
    return fallbackLabel;
  }

  return equipmentNames[equipmentId] || equipmentId;
};

export const resolveNoteEquipmentName = (
  note: Pick<BrewingNote, 'equipment'>,
  equipmentNames: Record<string, string>,
  fallbackLabel?: string
): string =>
  resolveEquipmentName(note.equipment, equipmentNames, fallbackLabel);

export const getBeanUnitPrice = (
  bean?: Pick<CoffeeBean, 'price' | 'capacity'> | null
): number => {
  if (!bean?.price || !bean.capacity) return 0;

  const price = extractNumericValue(bean.price);
  const capacity = extractNumericValue(bean.capacity);

  if (price === null || capacity === null || capacity <= 0) {
    return 0;
  }

  return price / capacity;
};
