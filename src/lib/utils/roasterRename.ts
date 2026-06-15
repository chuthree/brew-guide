import { db, RoasterConfig } from '@/lib/core/db';
import { BrewingNote } from '@/lib/core/config';
import { CoffeeBean } from '@/types/app';
import { useBrewingNoteStore } from '@/lib/stores/brewingNoteStore';
import { useCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore';
import { useGrinderStore } from '@/lib/stores/grinderStore';
import { getSettingsStore, useSettingsStore } from '@/lib/stores/settingsStore';
import { mergeBeanWithStoredImages } from '@/lib/coffee-beans/imageRepository';
import {
  getBeanNameWithoutRoaster,
  getBeanRoasterName,
  normalizeCoffeeBean,
  normalizeCoffeeBeanRoaster,
} from '@/lib/utils/coffeeBeanUtils';

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

const mergeRoasterConfig = (
  base: RoasterConfig,
  incoming: RoasterConfig,
  now: number
): RoasterConfig => ({
  ...base,
  logoData: base.logoData ?? incoming.logoData,
  flavorPeriod: base.flavorPeriod ?? incoming.flavorPeriod,
  updatedAt: now,
});

const renameRoasterConfigs = (
  configs: RoasterConfig[],
  renames: RenameMap,
  now: number
): { configs: RoasterConfig[]; changedCount: number } => {
  const nextConfigs = new Map<string, RoasterConfig>();
  let changedCount = 0;

  configs.forEach(config => {
    const sourceName = normalizeCoffeeBeanRoaster(config.roasterName);
    if (!renames.has(sourceName)) {
      nextConfigs.set(config.roasterName, config);
    }
  });

  configs.forEach(config => {
    const sourceName = normalizeCoffeeBeanRoaster(config.roasterName);
    const targetName = renames.get(sourceName);

    if (!targetName) {
      return;
    }

    changedCount += 1;
    const renamedConfig: RoasterConfig = {
      ...config,
      roasterName: targetName,
      updatedAt: now,
    };
    const existing = nextConfigs.get(targetName);
    nextConfigs.set(
      targetName,
      existing
        ? mergeRoasterConfig(existing, renamedConfig, now)
        : renamedConfig
    );
  });

  return {
    configs: Array.from(nextConfigs.values()),
    changedCount,
  };
};

const dispatchBeanChanged = async (bean: CoffeeBean) => {
  if (typeof window === 'undefined') return;

  const eventBean = await mergeBeanWithStoredImages(bean);
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
      detail: { settings },
    })
  );
};

const dispatchGrinderChanged = () => {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(new CustomEvent('grinderDataChanged'));
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
  let nextBeans: CoffeeBean[] = [];
  const updatedBeans: CoffeeBean[] = [];
  let nextNotes: BrewingNote[] = [];
  const updatedNotes: BrewingNote[] = [];
  let nextGrinders = useGrinderStore.getState().grinders;
  let updatedGrinderCount = 0;
  let nextSettings = getSettingsStore().settings;
  let updatedConfigCount = 0;

  await db.transaction(
    'rw',
    db.coffeeBeans,
    db.brewingNotes,
    db.grinders,
    db.appSettings,
    async () => {
      const [beans, notes, grinders, settingsRecord] = await Promise.all([
        db.coffeeBeans.toArray(),
        db.brewingNotes.toArray(),
        db.grinders.toArray(),
        db.appSettings.get('main'),
      ]);
      const beanTargetById = new Map<string, string>();

      nextBeans = beans.map(bean => {
        const currentRoaster = normalizeCoffeeBeanRoaster(
          getBeanRoasterName(bean)
        );
        const targetRoaster = renames.get(currentRoaster);

        if (!targetRoaster) {
          return bean;
        }

        const updatedBean = normalizeCoffeeBean(
          {
            ...bean,
            name: getBeanNameWithoutRoaster(bean),
            roaster: targetRoaster,
            timestamp: now,
          },
          { ensureFlavorArray: true }
        ) as CoffeeBean;

        beanTargetById.set(bean.id, targetRoaster);
        updatedBeans.push(updatedBean);
        return updatedBean;
      });

      nextNotes = notes.map(note => {
        const coffeeBeanInfo = note.coffeeBeanInfo;
        if (!coffeeBeanInfo) {
          return note;
        }

        const noteRoaster = normalizeCoffeeBeanRoaster(
          getBeanRoasterName(coffeeBeanInfo)
        );
        const targetRoaster =
          (note.beanId ? beanTargetById.get(note.beanId) : undefined) ||
          renames.get(noteRoaster);

        if (!targetRoaster) {
          return note;
        }

        const updatedNote: BrewingNote = {
          ...note,
          coffeeBeanInfo: {
            ...coffeeBeanInfo,
            name: noteRoaster
              ? getBeanNameWithoutRoaster({
                  name: coffeeBeanInfo.name,
                  roaster: noteRoaster,
                })
              : coffeeBeanInfo.name,
            roaster: targetRoaster,
          },
          updatedAt: now,
        };

        updatedNotes.push(updatedNote);
        return updatedNote;
      });

      nextGrinders = grinders.map(grinder => {
        const history = grinder.grindSizeHistory || [];
        let changed = false;
        const nextHistory = history.map(item => {
          const currentRoaster = normalizeCoffeeBeanRoaster(
            item.coffeeBeanRoaster
          );
          const targetRoaster = renames.get(currentRoaster);

          if (!targetRoaster) {
            return item;
          }

          changed = true;
          return {
            ...item,
            coffeeBeanRoaster: targetRoaster,
          };
        });

        if (!changed) {
          return grinder;
        }

        updatedGrinderCount += 1;
        return {
          ...grinder,
          grindSizeHistory: nextHistory,
        };
      });

      const currentSettings =
        settingsRecord?.data || getSettingsStore().settings;
      const renamedConfigs = renameRoasterConfigs(
        currentSettings.roasterConfigs || [],
        renames,
        now
      );
      updatedConfigCount = renamedConfigs.changedCount;
      nextSettings = {
        ...currentSettings,
        roasterConfigs: renamedConfigs.configs,
      };

      if (updatedBeans.length > 0) {
        await db.coffeeBeans.bulkPut(updatedBeans);
      }

      if (updatedNotes.length > 0) {
        await db.brewingNotes.bulkPut(updatedNotes);
      }

      if (updatedGrinderCount > 0) {
        await db.grinders.bulkPut(nextGrinders);
      }

      if (updatedConfigCount > 0) {
        await db.appSettings.put({ id: 'main', data: nextSettings });
      }
    }
  );

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
