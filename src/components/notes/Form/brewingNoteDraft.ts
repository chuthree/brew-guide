'use client';

import type {
  BrewingNoteData,
  CoffeeBean,
  SelectableCoffeeBean,
} from '@/types/app';
import { getObjectState, saveObjectState } from '@/lib/core/statePersistence';
import {
  normalizeBrewingNoteParams,
  normalizeBrewingNoteDraftSelection,
} from '@/lib/notes/noteDisplay';

const STORAGE_MODULE = 'notes';
const STORAGE_KEY = 'brewing-note-draft';
const CURRENT_VERSION = 1;

const DEFAULT_TASTE = {
  acidity: 0,
  sweetness: 0,
  bitterness: 0,
  body: 0,
};

const DEFAULT_COFFEE_BEAN_INFO = {
  name: '',
  roastLevel: '中度烘焙',
  roastDate: '',
  roaster: undefined,
};

export interface BrewingNoteDraftData extends Partial<BrewingNoteData> {
  coffeeBean?: SelectableCoffeeBean | null;
}

export interface BrewingNoteDraftSession {
  version: number;
  step: number;
  note: BrewingNoteDraftData;
  updatedAt: number;
}

interface CreateBrewingNoteDraftSessionOptions {
  initialNote?: BrewingNoteDraftData;
  persistedEquipment?: string;
  initialStep?: number;
}

const normalizeCoffeeBeanInfo = (
  note?: BrewingNoteDraftData
): BrewingNoteData['coffeeBeanInfo'] => {
  if (note?.coffeeBean) {
    const bean = note.coffeeBean as CoffeeBean;
    return {
      name: note.coffeeBean.name || '',
      roastLevel: bean.roastLevel || '中度烘焙',
      roastDate: bean.roastDate || '',
      roaster: bean.roaster,
    };
  }

  return {
    ...DEFAULT_COFFEE_BEAN_INFO,
    ...note?.coffeeBeanInfo,
  };
};

const normalizeImages = (note?: BrewingNoteDraftData): string[] => {
  if (Array.isArray(note?.images) && note.images.length > 0) {
    return note.images;
  }

  if (typeof note?.image === 'string' && note.image) {
    return [note.image];
  }

  return [];
};

export const createBrewingNoteDraftSession = ({
  initialNote,
  persistedEquipment,
  initialStep = 0,
}: CreateBrewingNoteDraftSessionOptions = {}): BrewingNoteDraftSession => {
  const normalizedSelection = normalizeBrewingNoteDraftSelection({
    equipment: initialNote?.equipment || persistedEquipment || '',
    method: initialNote?.method || '',
  });
  const normalizedParams = normalizeBrewingNoteParams(initialNote?.params);
  const images = normalizeImages(initialNote);

  return {
    version: CURRENT_VERSION,
    step: initialStep,
    updatedAt: Date.now(),
    note: {
      ...initialNote,
      equipment: normalizedSelection.equipment,
      method: normalizedSelection.method,
      coffeeBean: initialNote?.coffeeBean || null,
      coffeeBeanInfo: normalizeCoffeeBeanInfo(initialNote),
      image: images[0] || '',
      images,
      params: normalizedParams,
      rating: initialNote?.rating ?? 0,
      taste: initialNote?.taste || DEFAULT_TASTE,
      notes: initialNote?.notes || '',
      timestamp: initialNote?.timestamp ?? Date.now(),
      totalTime: initialNote?.totalTime,
    },
  };
};

const normalizeComparableNote = (note: BrewingNoteDraftData) => {
  const taste = note.taste || DEFAULT_TASTE;
  const params = normalizeBrewingNoteParams(note.params);
  const images = normalizeImages(note);
  const selectedCoffeeBean = note.coffeeBean;

  return {
    bean: selectedCoffeeBean
      ? {
          id: 'id' in selectedCoffeeBean ? selectedCoffeeBean.id : undefined,
          name: selectedCoffeeBean.name || '',
        }
      : null,
    beanId: note.beanId || '',
    coffeeBeanInfo: {
      name: note.coffeeBeanInfo?.name || '',
      roastLevel: note.coffeeBeanInfo?.roastLevel || '',
      roastDate: note.coffeeBeanInfo?.roastDate || '',
      roaster: note.coffeeBeanInfo?.roaster || '',
    },
    equipment: note.equipment || '',
    method: note.method || '',
    equipmentId: note.equipmentId,
    equipmentName: note.equipmentName,
    methodId: note.methodId,
    methodName: note.methodName,
    params,
    totalTime: note.totalTime || 0,
    rating: note.rating || 0,
    taste,
    notes: note.notes?.trim() || '',
    images,
  };
};

const normalizeRecordContentComparableNote = (
  currentNote: BrewingNoteDraftData,
  baselineNote?: BrewingNoteDraftData
) => {
  const taste = currentNote.taste || DEFAULT_TASTE;
  const images = normalizeImages(currentNote);
  const baselineTimestamp = baselineNote?.timestamp;
  const currentTimestamp = currentNote.timestamp;
  const hasTimestampChange =
    typeof currentTimestamp === 'number' &&
    typeof baselineTimestamp === 'number' &&
    currentTimestamp !== baselineTimestamp;

  return {
    notes: currentNote.notes?.trim() || '',
    images,
    rating: currentNote.rating || 0,
    taste,
    timestampChanged: hasTimestampChange,
  };
};

const isDraftSession = (value: unknown): value is BrewingNoteDraftSession => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const session = value as Partial<BrewingNoteDraftSession>;
  return (
    typeof session.step === 'number' &&
    typeof session.updatedAt === 'number' &&
    !!session.note &&
    typeof session.note === 'object'
  );
};

export const loadBrewingNoteDraftSession =
  (): BrewingNoteDraftSession | null => {
    const session = getObjectState<BrewingNoteDraftSession | null>(
      STORAGE_MODULE,
      STORAGE_KEY,
      null
    );

    if (!isDraftSession(session)) {
      return null;
    }

    if (session.version !== CURRENT_VERSION) {
      return null;
    }

    return {
      ...session,
      note: {
        ...session.note,
        coffeeBean: session.note.coffeeBean || null,
        coffeeBeanInfo: normalizeCoffeeBeanInfo(session.note),
        images: normalizeImages(session.note),
        image: normalizeImages(session.note)[0] || '',
        params: normalizeBrewingNoteParams(session.note.params),
        taste: session.note.taste || DEFAULT_TASTE,
        notes: session.note.notes || '',
        rating: session.note.rating ?? 0,
        timestamp: session.note.timestamp ?? Date.now(),
      },
    };
  };

export const saveBrewingNoteDraftSession = (
  session: BrewingNoteDraftSession
): void => {
  saveObjectState(STORAGE_MODULE, STORAGE_KEY, {
    ...session,
    version: CURRENT_VERSION,
    updatedAt: Date.now(),
    note: {
      ...session.note,
      coffeeBeanInfo: normalizeCoffeeBeanInfo(session.note),
      images: normalizeImages(session.note),
      image: normalizeImages(session.note)[0] || '',
      params: normalizeBrewingNoteParams(session.note.params),
    },
  });
};

export const clearBrewingNoteDraftSession = (): void => {
  saveObjectState<BrewingNoteDraftSession | null>(
    STORAGE_MODULE,
    STORAGE_KEY,
    null
  );
};

export const hasBrewingNoteDraftChanges = (
  currentSession: BrewingNoteDraftSession,
  baselineSession: BrewingNoteDraftSession
): boolean => {
  return (
    JSON.stringify(normalizeComparableNote(currentSession.note)) !==
    JSON.stringify(normalizeComparableNote(baselineSession.note))
  );
};

export const hasBrewingNoteDraftRecordContent = (
  currentSession: BrewingNoteDraftSession,
  baselineSession: BrewingNoteDraftSession
): boolean => {
  const comparable = normalizeRecordContentComparableNote(
    currentSession.note,
    baselineSession.note
  );

  const hasTasteRating = Object.values(comparable.taste).some(
    value => value > 0
  );

  return Boolean(
    comparable.notes ||
    comparable.images.length > 0 ||
    comparable.rating > 0 ||
    hasTasteRating ||
    comparable.timestampChanged
  );
};
