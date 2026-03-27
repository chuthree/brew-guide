export const ROAST_LEVELS = [
  '极浅烘焙',
  '浅度烘焙',
  '中浅烘焙',
  '中度烘焙',
  '中深烘焙',
  '深度烘焙',
] as const;

export type RoastLevel = (typeof ROAST_LEVELS)[number];

const toFiniteNumber = (
  value: number | string | null | undefined
): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const trimmedValue = value.trim();
    if (!trimmedValue) return null;

    const parsedValue = parseFloat(trimmedValue);
    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  return null;
};

export const formatRoastMetric = (value: number, decimals: number = 1) => {
  return parseFloat(value.toFixed(decimals)).toString();
};

export const inferRoastLevelFromMoistureLoss = (
  moistureLoss: number
): RoastLevel | '' => {
  if (!Number.isFinite(moistureLoss)) return '';
  if (moistureLoss >= 8 && moistureLoss <= 10) return '极浅烘焙';
  if (moistureLoss > 10 && moistureLoss <= 13) return '浅度烘焙';
  if (moistureLoss > 13 && moistureLoss <= 16) return '中度烘焙';
  if (moistureLoss > 16 && moistureLoss < 18) return '中深烘焙';
  if (moistureLoss >= 18) return '深度烘焙';
  return '';
};

export const calculateMoistureLoss = (
  greenAmount: number | string | null | undefined,
  roastedAmount: number | string | null | undefined
): number | null => {
  const green = toFiniteNumber(greenAmount);
  const roasted = toFiniteNumber(roastedAmount);

  if (green === null || roasted === null || green <= 0) {
    return null;
  }

  return ((green - roasted) / green) * 100;
};

export const getRoastProfileFromAmounts = (
  greenAmount: number | string | null | undefined,
  roastedAmount: number | string | null | undefined
) => {
  const moistureLoss = calculateMoistureLoss(greenAmount, roastedAmount);

  if (moistureLoss === null) {
    return {
      moistureLoss: '',
      roastLevel: '',
    };
  }

  return {
    moistureLoss: formatRoastMetric(moistureLoss),
    roastLevel: inferRoastLevelFromMoistureLoss(moistureLoss),
  };
};

export const getRoastProfileFromMoistureLoss = (
  moistureLossValue: number | string | null | undefined,
  greenAmount: number | string | null | undefined
) => {
  const moistureLoss = toFiniteNumber(moistureLossValue);
  const green = toFiniteNumber(greenAmount);

  if (moistureLoss === null || green === null || green <= 0) {
    return {
      moistureLoss: '',
      roastLevel: '',
      roastedAmount: '',
    };
  }

  const roastedAmount = green * (1 - moistureLoss / 100);

  return {
    moistureLoss: formatRoastMetric(moistureLoss),
    roastLevel: inferRoastLevelFromMoistureLoss(moistureLoss),
    roastedAmount: formatRoastMetric(roastedAmount),
  };
};
