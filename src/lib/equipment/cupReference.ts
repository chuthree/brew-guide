export type CupShapeType = 'default' | 'custom';

export type CupReference =
  | {
      kind: 'custom';
      svg: string;
    }
  | {
      kind: 'preset';
      iconUrl: string;
      hasValve: boolean;
    };

interface ResolveCupReferenceOptions {
  presetValue: string;
  cupShapeType: CupShapeType;
  customShapeSvg?: string;
  defaultShapeIcon?: string;
  hasValve?: boolean;
}

export function resolveCupReference({
  presetValue,
  cupShapeType,
  customShapeSvg,
  defaultShapeIcon,
  hasValve = false,
}: ResolveCupReferenceOptions): CupReference | null {
  const normalizedCustomSvg = customShapeSvg?.trim();

  if (cupShapeType === 'custom' && normalizedCustomSvg) {
    return {
      kind: 'custom',
      svg: normalizedCustomSvg,
    };
  }

  if (presetValue === 'custom') {
    return null;
  }

  if (cupShapeType === 'default' && defaultShapeIcon) {
    return {
      kind: 'preset',
      iconUrl: defaultShapeIcon,
      hasValve,
    };
  }

  return null;
}
