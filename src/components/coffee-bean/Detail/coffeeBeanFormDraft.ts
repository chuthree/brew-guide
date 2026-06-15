'use client';

import type { BlendComponent, CoffeeBean } from '@/types/app';
import { getObjectState, saveObjectState } from '@/lib/core/statePersistence';
import { normalizeDelimitedTextList } from '@/lib/utils/coffeeBeanUtils';

const STORAGE_MODULE = 'coffee-beans';
const STORAGE_KEY = 'coffee-bean-form-draft';
const CURRENT_VERSION = 1;

export interface CoffeeBeanFormDraftSession {
  version: number;
  bean: Partial<CoffeeBean>;
  updatedAt: number;
}

const normalizeText = (value: unknown): string => {
  return typeof value === 'string' ? value.trim() : '';
};

const normalizeBlendComponents = (
  components: Partial<BlendComponent>[] | undefined
): BlendComponent[] => {
  if (!Array.isArray(components) || components.length === 0) {
    return [{ origin: '', region: '', estate: '', lot: '', batch: '', station: '', altitude: '', season: '', process: '', variety: '', agtron: '' }];
  }

  return components.map(component => ({
    ...(typeof component.percentage === 'number'
      ? { percentage: component.percentage }
      : {}),
    origin: normalizeText(component.origin),
    region: normalizeText(component.region),
    estate: normalizeText(component.estate),
    lot: normalizeText(component.lot),
    batch: normalizeText(component.batch),
    station: normalizeText(component.station),
    altitude: normalizeText(component.altitude),
    season: normalizeText(component.season),
    process: normalizeText(component.process),
    variety: normalizeText(component.variety),
    agtron: normalizeText(component.agtron),
  }));
};

export const normalizeCoffeeBeanFormDraft = (
  bean: Partial<CoffeeBean>
): Partial<CoffeeBean> => ({
  ...bean,
  name: normalizeText(bean.name),
  roaster: normalizeText(bean.roaster) || undefined,
  capacity: normalizeText(bean.capacity),
  remaining: normalizeText(bean.remaining),
  price: normalizeText(bean.price),
  roastLevel: normalizeText(bean.roastLevel),
  roastDate: normalizeText(bean.roastDate),
  purchaseDate: normalizeText(bean.purchaseDate),
  notes: normalizeText(bean.notes),
  flavor: normalizeDelimitedTextList(bean.flavor),
  blendComponents: normalizeBlendComponents(bean.blendComponents),
  beanType:
    bean.beanType === 'espresso' || bean.beanType === 'omni'
      ? bean.beanType
      : 'filter',
  beanState: bean.beanState === 'green' ? 'green' : 'roasted',
});

const normalizeComparableBean = (bean: Partial<CoffeeBean>) => {
  const normalized = normalizeCoffeeBeanFormDraft(bean);

  return {
    name: normalized.name || '',
    roaster: normalized.roaster || '',
    beanState: normalized.beanState || 'roasted',
    beanType: normalized.beanType || 'filter',
    capacity: normalized.capacity || '',
    remaining: normalized.remaining || '',
    price: normalized.price || '',
    roastLevel: normalized.roastLevel || '',
    roastDate: normalized.roastDate || '',
    purchaseDate: normalized.purchaseDate || '',
    flavor: normalized.flavor || [],
    notes: normalized.notes || '',
    startDay: normalized.startDay || 0,
    endDay: normalized.endDay || 0,
    image: normalized.image || '',
    backImage: normalized.backImage || '',
    blendComponents: normalizeBlendComponents(normalized.blendComponents),
  };
};

const isDraftSession = (
  value: unknown
): value is CoffeeBeanFormDraftSession => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const session = value as Partial<CoffeeBeanFormDraftSession>;
  return (
    typeof session.updatedAt === 'number' &&
    !!session.bean &&
    typeof session.bean === 'object'
  );
};

export const loadCoffeeBeanFormDraftSession =
  (): CoffeeBeanFormDraftSession | null => {
    const session = getObjectState<CoffeeBeanFormDraftSession | null>(
      STORAGE_MODULE,
      STORAGE_KEY,
      null
    );

    if (!isDraftSession(session) || session.version !== CURRENT_VERSION) {
      return null;
    }

    return {
      ...session,
      bean: normalizeCoffeeBeanFormDraft(session.bean),
    };
  };

export const saveCoffeeBeanFormDraftSession = (
  session: CoffeeBeanFormDraftSession
): void => {
  saveObjectState(STORAGE_MODULE, STORAGE_KEY, {
    ...session,
    version: CURRENT_VERSION,
    updatedAt: Date.now(),
    bean: normalizeCoffeeBeanFormDraft(session.bean),
  });
};

export const clearCoffeeBeanFormDraftSession = (): void => {
  saveObjectState<CoffeeBeanFormDraftSession | null>(
    STORAGE_MODULE,
    STORAGE_KEY,
    null
  );
};

export const hasCoffeeBeanFormDraftContent = (
  currentBean: Partial<CoffeeBean>,
  baselineBean: Partial<CoffeeBean>
): boolean => {
  return (
    JSON.stringify(normalizeComparableBean(currentBean)) !==
    JSON.stringify(normalizeComparableBean(baselineBean))
  );
};
