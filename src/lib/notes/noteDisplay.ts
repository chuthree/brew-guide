import type { BrewingNote, CustomEquipment } from '@/lib/core/config';
import { equipmentList } from '@/lib/core/config';
import type { CoffeeBean } from '@/types/app';
import {
  formatNoteBeanDisplayName,
  type RoasterSettings,
} from '@/lib/utils/beanVarietyUtils';
import { parseDateToTimestamp } from '@/lib/utils/dateUtils';

export type CoffeeBeanLookup = ReadonlyMap<string, CoffeeBean>;

const normalizeOptionalText = (value?: string | null): string =>
  value?.trim() ?? '';

const extractNumericValue = (value?: string): number | null => {
  if (!value) return null;

  const match = value.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;

  const parsedValue = Number.parseFloat(match[1]);
  return Number.isNaN(parsedValue) ? null : parsedValue;
};

export const buildCoffeeBeanLookup = (beans: CoffeeBean[]): CoffeeBeanLookup =>
  new Map(beans.map(bean => [bean.id, bean]));

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
  fallbackLabel: string = ''
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

export const normalizeBrewingNoteParams = (
  params?: BrewingNote['params'] | null
): BrewingNote['params'] | undefined => {
  if (!params) {
    return undefined;
  }

  const normalized = {
    coffee: normalizeOptionalText(params.coffee),
    water: normalizeOptionalText(params.water),
    ratio: normalizeOptionalText(params.ratio),
    grindSize: normalizeOptionalText(params.grindSize),
    temp: normalizeOptionalText(params.temp),
  };

  return Object.values(normalized).some(Boolean) ? normalized : undefined;
};

export const hasBrewingNoteParams = (
  params?: BrewingNote['params'] | null
): boolean => !!normalizeBrewingNoteParams(params);

export const normalizeBrewingNoteSelection = (
  selection: Pick<BrewingNote, 'equipment' | 'method'>
): Pick<BrewingNote, 'equipment' | 'method'> => {
  const draftSelection = normalizeBrewingNoteDraftSelection(selection);
  const method = draftSelection.method;

  if (!method) {
    return {
      equipment: undefined,
      method: undefined,
    };
  }

  return {
    equipment: draftSelection.equipment,
    method,
  };
};

export const normalizeBrewingNoteDraftSelection = (
  selection: Pick<BrewingNote, 'equipment' | 'method'>
): Pick<BrewingNote, 'equipment' | 'method'> => {
  const method = normalizeOptionalText(selection.method) || undefined;
  const equipment = normalizeOptionalText(selection.equipment) || undefined;

  return {
    equipment,
    method,
  };
};

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

export const getNoteBeanAgingDays = (
  roastDate?: string | null,
  referenceDate: Date = new Date()
): number | null => {
  const normalizedRoastDate = normalizeOptionalText(roastDate);
  if (!normalizedRoastDate) return null;

  const roastTimestamp = parseDateToTimestamp(normalizedRoastDate);
  if (Number.isNaN(roastTimestamp)) return null;

  const parsedRoastDate = new Date(roastTimestamp);
  const roastDateOnly = new Date(
    parsedRoastDate.getFullYear(),
    parsedRoastDate.getMonth(),
    parsedRoastDate.getDate()
  );
  const referenceDateOnly = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );
  const days = Math.ceil(
    (referenceDateOnly.getTime() - roastDateOnly.getTime()) /
      (1000 * 60 * 60 * 24)
  );

  return Math.max(0, days);
};

export const getNoteBeanAgingDaysForNote = (
  note: Pick<BrewingNote, 'timestamp' | 'coffeeBeanInfo'>,
  bean?: Pick<CoffeeBean, 'roastDate'> | null
): number | null => {
  const roastDate = bean?.roastDate || note.coffeeBeanInfo?.roastDate;
  if (!note.timestamp) return null;

  return getNoteBeanAgingDays(roastDate, new Date(note.timestamp));
};
