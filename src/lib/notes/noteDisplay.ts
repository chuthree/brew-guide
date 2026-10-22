import type { BrewingNote, CustomEquipment } from '@/lib/core/config';
import { equipmentList } from '@/lib/core/config';
import type { CoffeeBean } from '@/types/app';
import {
  formatNoteBeanDisplayName,
  type RoasterSettings,
} from '@/lib/utils/beanVarietyUtils';
import { parseDateToTimestamp } from '@/lib/utils/dateUtils';

export type CoffeeBeanLookup = ReadonlyMap<string, CoffeeBean>;
export const EMPTY_EQUIPMENT_NAME_OVERRIDES: Record<string, string> = {};

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
  customEquipments: CustomEquipment[],
  equipmentNameOverrides: Record<
    string,
    string
  > = EMPTY_EQUIPMENT_NAME_OVERRIDES
): Record<string, string> => {
  const equipmentNames: Record<string, string> = {};

  equipmentList.forEach(equipment => {
    equipmentNames[equipment.id] =
      equipmentNameOverrides[equipment.id]?.trim() || equipment.name;
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
  note: Pick<BrewingNote, 'equipment' | 'equipmentId' | 'equipmentName'>,
  equipmentNames: Record<string, string>,
  fallbackLabel?: string
): string =>
  note.equipmentName?.trim() ||
  (note.equipmentId === null
    ? note.equipment?.trim() || fallbackLabel || ''
    : resolveEquipmentName(
        note.equipmentId || note.equipment,
        equipmentNames,
        fallbackLabel
      ));

export const resolveNoteMethodName = (
  note: Pick<BrewingNote, 'method' | 'methodName'>
): string => note.methodName?.trim() || note.method?.trim() || '';

/** Filter identity keeps explicitly free labels separate from configured equipment. */
export const noteEquipmentFilterKey = (
  note: Pick<BrewingNote, 'equipment' | 'equipmentId' | 'equipmentName'>,
  normalizeLegacy: (value: string) => string = value => value
): string => {
  if (note.equipmentId) return note.equipmentId;
  const label = note.equipment?.trim() || note.equipmentName?.trim() || '';
  if (!label) return '';
  return note.equipmentId === null
    ? `label:${JSON.stringify(label)}`
    : normalizeLegacy(label);
};

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
    extractionTime: params.extractionTime,
    liquidWeight: normalizeOptionalText(params.liquidWeight),
  };

  return Object.values(normalized).some(Boolean) ? normalized : undefined;
};

export const isCoffeeOnlyNoteParams = (
  params?: BrewingNote['params']
): boolean => {
  if (!params) return true;
  return (
    !!params.coffee &&
    !params.water &&
    !params.ratio &&
    !params.grindSize &&
    !params.temp &&
    params.extractionTime === undefined &&
    !params.liquidWeight
  );
};

/** Read measured espresso values; old notes used totalTime/water for these fields. */
export const getNoteEspressoMeasurements = (
  note: Pick<BrewingNote, 'params' | 'totalTime'>
): { extractionTime: number | undefined; liquidWeight: string } => ({
  extractionTime: note.params?.extractionTime ?? note.totalTime,
  liquidWeight:
    note.params?.liquidWeight?.trim() || note.params?.water?.trim() || '',
});

export const getNoteEspressoParamParts = (
  note: Pick<BrewingNote, 'params' | 'totalTime'>
): string[] => {
  const params = normalizeBrewingNoteParams(note.params);
  const measured = getNoteEspressoMeasurements(note);
  return [
    params?.coffee,
    params?.grindSize,
    measured.extractionTime ? `${measured.extractionTime}s` : '',
    measured.liquidWeight,
  ].filter((value): value is string => !!value);
};

export const hasBrewingNoteParams = (
  params?: BrewingNote['params'] | null
): boolean => !!normalizeBrewingNoteParams(params);

export const normalizeBrewingNoteSelection = (
  selection: Pick<BrewingNote, 'equipment' | 'method'>
): Pick<BrewingNote, 'equipment' | 'method'> => {
  const draftSelection = normalizeBrewingNoteDraftSelection(selection);
  return draftSelection;
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
