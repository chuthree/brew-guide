import { APP_VERSION } from '@/lib/core/config';
import {
  brewingNoteImageRepository,
  brewingNoteRepository,
  coffeeBeanImageRepository,
  coffeeBeanRepository,
  customEquipmentRepository,
  customMethodRepository,
  grinderRepository,
} from '@/lib/data/repositories';
import { stripCoffeeBeanImages } from '@/lib/coffee-beans/imageRecords';
import { stripBrewingNoteImages } from '@/lib/notes/imageRecords';

export const RESCUE_MODE_OPEN_EVENT = 'brewGuide:rescue-mode-open';

export interface RescueModeSnapshot {
  beans: number;
  beanImages: number;
  notes: number;
  noteImages: number;
  customEquipments: number;
  customMethods: number;
  grinders: number;
}

interface RescueExportData {
  exportDate: string;
  appVersion: string;
  timeZone: string;
  data: Record<string, unknown>;
}

const CUSTOM_PRESETS_PREFIX = 'brew-guide:custom-presets:';
const CUSTOM_PRESETS_KEYS = [
  'origins',
  'countries',
  'regions',
  'estates',
  'processingStations',
  'altitudes',
  'processes',
  'batches',
  'varieties',
];

const formatDateWithTimezone = (date: Date): string => {
  const pad = (num: number) => num.toString().padStart(2, '0');
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const offsetHours = pad(Math.floor(Math.abs(offset) / 60));
  const offsetMinutes = pad(Math.abs(offset) % 60);

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${date.getMilliseconds().toString().padStart(3, '0')}${sign}${offsetHours}:${offsetMinutes}`;
};

export function openRescueMode(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(RESCUE_MODE_OPEN_EVENT));
}

export async function getRescueModeSnapshot(): Promise<RescueModeSnapshot> {
  const [
    beans,
    beanImageCounts,
    notes,
    noteImageCounts,
    customEquipments,
    customMethods,
    grinders,
  ] = await Promise.all([
    coffeeBeanRepository.count(),
    coffeeBeanImageRepository.getRecordCounts(),
    brewingNoteRepository.count(),
    brewingNoteImageRepository.getRecordCounts(),
    customEquipmentRepository.count(),
    customMethodRepository.count(),
    grinderRepository.count(),
  ]);

  return {
    beans,
    beanImages: beanImageCounts.records,
    notes,
    noteImages: noteImageCounts.records,
    customEquipments,
    customMethods,
    grinders,
  };
}

export async function exportRescueData(): Promise<string> {
  const { getRoasterConfigsSync, getSettingsStore } =
    await import('@/lib/stores/settingsStore');

  const [coffeeBeans, brewingNotes, customEquipments, customMethods, grinders] =
    await Promise.all([
      coffeeBeanRepository.list(),
      brewingNoteRepository.list(),
      customEquipmentRepository.list(),
      customMethodRepository.list(),
      grinderRepository.list(),
    ]);

  const customMethodsByEquipment: Record<string, unknown> = {};
  for (const { equipmentId, methods } of customMethods) {
    if (Array.isArray(methods) && methods.length > 0) {
      customMethodsByEquipment[equipmentId] = methods;
    }
  }

  const data: Record<string, unknown> = {
    brewGuideSettings: getSettingsStore().settings,
    coffeeBeans: coffeeBeans.map(stripCoffeeBeanImages),
    brewingNotes: brewingNotes.map(note => {
      const strippedNote = {
        ...stripBrewingNoteImages(note),
      } as Record<string, unknown>;
      delete strippedNote.coffeeBean;
      return strippedNote;
    }),
    customEquipments,
    customMethodsByEquipment,
    grinders,
  };

  const roasterConfigs = getRoasterConfigsSync();
  if (roasterConfigs.length > 0) {
    data.roasterConfigs = roasterConfigs;
  }

  if (typeof localStorage !== 'undefined') {
    const customPresets: Record<string, unknown> = {};
    for (const key of CUSTOM_PRESETS_KEYS) {
      const presetJson = localStorage.getItem(`${CUSTOM_PRESETS_PREFIX}${key}`);
      if (!presetJson) continue;

      try {
        customPresets[key] = JSON.parse(presetJson);
      } catch {
        customPresets[key] = presetJson;
      }
    }

    if (Object.keys(customPresets).length > 0) {
      data.customPresets = customPresets;
    }
  }

  const exportData: RescueExportData = {
    exportDate: formatDateWithTimezone(new Date()),
    appVersion: APP_VERSION,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    data,
  };

  return JSON.stringify(exportData);
}
