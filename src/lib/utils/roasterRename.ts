import { BrewingNote } from '@/lib/core/config';
import { CoffeeBean } from '@/types/app';
import { useBrewingNoteStore } from '@/lib/stores/brewingNoteStore';
import { useCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore';
import { useGrinderStore } from '@/lib/stores/grinderStore';
import { getSettingsStore, useSettingsStore } from '@/lib/stores/settingsStore';
import {
  coffeeBeanImageRepository,
  roasterRenamePersistence,
} from '@/lib/data/repositories';
import { normalizeCoffeeBeanRoaster } from '@/lib/utils/coffeeBeanUtils';

export interface RoasterRenameResult {
  renamedRoasterCount: number;
  updatedBeanCount: number;
  updatedNoteCount: number;
  updatedGrinderCount: number;
  updatedConfigCount: number;
}

type RenameMap = Map<string, string>;

const normalizeRenameEntries = (renames: Record<string, string>): RenameMap => {
  const normalized = new Map<string, string>();

  Object.entries(renames).forEach(([source, target]) => {
    const sourceName = normalizeCoffeeBeanRoaster(source);
    const targetName = normalizeCoffeeBeanRoaster(target);

    if (sourceName && targetName && sourceName !== targetName) {
      normalized.set(sourceName, targetName);
    }
  });

  return normalized;
};

const resolveRenameTargets = (renames: RenameMap): RenameMap => {
  const resolved = new Map<string, string>();

  renames.forEach((directTarget, source) => {
    let target = directTarget;
    const visited = new Set<string>([source]);

    while (renames.has(target) && !visited.has(target)) {
      visited.add(target);
      target = renames.get(target)!;
    }

    resolved.set(source, target);
  });

  return resolved;
};

const dispatchBeanChanged = async (bean: CoffeeBean) => {
  if (typeof window === 'undefined') return;

  const eventBean = await coffeeBeanImageRepository.mergeBean(bean);
  window.dispatchEvent(
    new CustomEvent('coffeeBeanDataChanged', {
      detail: { action: 'update', beanId: bean.id, bean: eventBean },
    })
  );
};

const dispatchNoteChanged = (note: BrewingNote) => {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent('brewingNoteDataChanged', {
      detail: { action: 'update', noteId: note.id, note },
    })
  );
};

const dispatchSettingsChanged = (
  settings: ReturnType<typeof getSettingsStore>['settings']
) => {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent('settingsChanged', {
      detail: { source: 'local', settings },
    })
  );
};

const dispatchGrinderChanged = () => {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent('grinderDataChanged', { detail: { source: 'local' } })
  );
};

export async function renameRoasters(
  renameEntries: Record<string, string>
): Promise<RoasterRenameResult> {
  const renames = resolveRenameTargets(normalizeRenameEntries(renameEntries));

  if (renames.size === 0) {
    return {
      renamedRoasterCount: 0,
      updatedBeanCount: 0,
      updatedNoteCount: 0,
      updatedGrinderCount: 0,
      updatedConfigCount: 0,
    };
  }

  const now = Date.now();
  const changes = await roasterRenamePersistence.renameReferences({
    renames,
    now,
    getFallbackSettings: () => getSettingsStore().settings,
  });
  const {
    beans: nextBeans,
    updatedBeans,
    notes: nextNotes,
    updatedNotes,
    grinders: nextGrinders,
    updatedGrinderCount,
    settings: nextSettings,
    updatedConfigCount,
  } = changes;

  if (updatedBeans.length > 0) {
    useCoffeeBeanStore.setState({ beans: nextBeans });
  }

  if (updatedNotes.length > 0) {
    useBrewingNoteStore.setState({ notes: nextNotes });
  }

  if (updatedGrinderCount > 0) {
    useGrinderStore.setState({ grinders: nextGrinders });
  }

  if (updatedConfigCount > 0) {
    useSettingsStore.setState({ settings: nextSettings });
    dispatchSettingsChanged(nextSettings);
  }

  await Promise.all(updatedBeans.map(dispatchBeanChanged));
  updatedNotes.forEach(dispatchNoteChanged);

  if (updatedGrinderCount > 0) {
    dispatchGrinderChanged();
  }

  return {
    renamedRoasterCount: renames.size,
    updatedBeanCount: updatedBeans.length,
    updatedNoteCount: updatedNotes.length,
    updatedGrinderCount,
    updatedConfigCount,
  };
}
