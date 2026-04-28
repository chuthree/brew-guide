export type EstimatedCupBeanType = 'filter' | 'espresso' | 'omni';

export interface EstimatedCupDoseSettings {
  filter: number;
  espresso: number;
  omni: number;
}

export const DEFAULT_ESTIMATED_CUP_DOSE_SETTINGS: EstimatedCupDoseSettings = {
  filter: 15,
  espresso: 18,
  omni: 15,
};

export const ESTIMATED_CUP_DOSE_ITEMS = [
  { key: 'filter', label: '手冲豆' },
  { key: 'espresso', label: '意式豆' },
  { key: 'omni', label: '全能豆' },
] as const satisfies ReadonlyArray<{
  key: EstimatedCupBeanType;
  label: string;
}>;

const roundEstimatedCupDose = (value: number): number =>
  Math.round(value * 10) / 10;

const normalizeEstimatedCupDoseValue = (
  value: unknown,
  fallback: number
): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return roundEstimatedCupDose(value);
};

export const normalizeEstimatedCupDoseSettings = (
  settings?: Partial<EstimatedCupDoseSettings> | null
): EstimatedCupDoseSettings => ({
  filter: normalizeEstimatedCupDoseValue(
    settings?.filter,
    DEFAULT_ESTIMATED_CUP_DOSE_SETTINGS.filter
  ),
  espresso: normalizeEstimatedCupDoseValue(
    settings?.espresso,
    DEFAULT_ESTIMATED_CUP_DOSE_SETTINGS.espresso
  ),
  omni: normalizeEstimatedCupDoseValue(
    settings?.omni,
    DEFAULT_ESTIMATED_CUP_DOSE_SETTINGS.omni
  ),
});

export const getEstimatedCupDose = (
  beanType: EstimatedCupBeanType | undefined,
  settings?: Partial<EstimatedCupDoseSettings> | null
): number => {
  const normalizedSettings = normalizeEstimatedCupDoseSettings(settings);

  if (beanType === 'espresso') {
    return normalizedSettings.espresso;
  }

  if (beanType === 'omni') {
    return normalizedSettings.omni;
  }

  return normalizedSettings.filter;
};

export const parseEstimatedCupRemainingWeight = (
  remaining?: string
): number => {
  const remainingMatch = (remaining || '0').match(/(\d+(?:\.\d+)?)/);
  const remainingWeight = remainingMatch
    ? Number.parseFloat(remainingMatch[1])
    : 0;

  if (!Number.isFinite(remainingWeight) || remainingWeight <= 0) {
    return 0;
  }

  return remainingWeight;
};

export const calculateEstimatedCupsFromWeights = (
  items: Array<{
    beanType?: EstimatedCupBeanType;
    remainingWeight: number;
  }>,
  settings?: Partial<EstimatedCupDoseSettings> | null
): number => {
  const totals = {
    filter: 0,
    espresso: 0,
    omni: 0,
  };

  for (const item of items) {
    if (!Number.isFinite(item.remainingWeight) || item.remainingWeight <= 0) {
      continue;
    }

    if (item.beanType === 'espresso') {
      totals.espresso += item.remainingWeight;
      continue;
    }

    if (item.beanType === 'omni') {
      totals.omni += item.remainingWeight;
      continue;
    }

    totals.filter += item.remainingWeight;
  }

  return (
    Math.floor(totals.filter / getEstimatedCupDose('filter', settings)) +
    Math.floor(totals.espresso / getEstimatedCupDose('espresso', settings)) +
    Math.floor(totals.omni / getEstimatedCupDose('omni', settings))
  );
};

export const formatEstimatedCupDose = (value: number): string => {
  const normalizedValue = roundEstimatedCupDose(value);
  return Number.isInteger(normalizedValue)
    ? String(normalizedValue)
    : normalizedValue.toString();
};

export const sanitizeEstimatedCupDoseInput = (value: string): string => {
  const trimmedValue = value.trim();
  const normalizedValue = trimmedValue
    .replace(/,/g, '.')
    .replace(/[^\d.]/g, '');
  const [integerPart = '', ...decimalParts] = normalizedValue.split('.');

  if (decimalParts.length === 0) {
    return integerPart;
  }

  const decimalPart = decimalParts.join('').slice(0, 1);
  return decimalPart ? `${integerPart}.${decimalPart}` : `${integerPart}.`;
};

export const parseEstimatedCupDoseInput = (value: string): number | null => {
  const parsedValue = Number.parseFloat(value);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return null;
  }

  return roundEstimatedCupDose(parsedValue);
};
