import type { BrewingNote } from '@/lib/core/config';
import type { AppSettings, Grinder, RoasterConfig } from '@/lib/data/models';
import type { CoffeeBean } from '@/types/app';
import {
  getBeanNameWithoutRoaster,
  getBeanRoasterName,
  normalizeCoffeeBean,
  normalizeCoffeeBeanRoaster,
} from '@/lib/utils/coffeeBeanUtils';
import type { RoasterRenamePersistenceResult } from '@/lib/data/contracts';

type RenameMap = ReadonlyMap<string, string>;

const mergeRoasterConfig = (
  base: RoasterConfig,
  incoming: RoasterConfig,
  now: number
): RoasterConfig => ({
  ...base,
  logoData: base.logoData ?? incoming.logoData,
  logoUpdatedAt:
    base.logoData != null
      ? base.logoUpdatedAt
      : incoming.logoData != null
        ? incoming.logoUpdatedAt
        : Math.max(base.logoUpdatedAt ?? 0, incoming.logoUpdatedAt ?? 0) ||
          undefined,
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

/** Pure record transformation shared by persistence adapters and unit tests. */
export function transformRoasterRenameRecords(input: {
  beans: CoffeeBean[];
  notes: BrewingNote[];
  grinders: Grinder[];
  settings: AppSettings;
  renames: RenameMap;
  now: number;
}): RoasterRenamePersistenceResult {
  const { beans, notes, grinders, settings, renames, now } = input;
  const beanTargetById = new Map<string, string>();
  const updatedBeans: CoffeeBean[] = [];
  const nextBeans = beans.map(bean => {
    const currentRoaster = normalizeCoffeeBeanRoaster(getBeanRoasterName(bean));
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

  const updatedNotes: BrewingNote[] = [];
  const nextNotes = notes.map(note => {
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

  let updatedGrinderCount = 0;
  const nextGrinders = grinders.map(grinder => {
    const history = grinder.grindSizeHistory || [];
    let changed = false;
    const nextHistory = history.map(item => {
      const currentRoaster = normalizeCoffeeBeanRoaster(item.coffeeBeanRoaster);
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

  const renamedConfigs = renameRoasterConfigs(
    settings.roasterConfigs || [],
    renames,
    now
  );

  return {
    beans: nextBeans,
    updatedBeans,
    notes: nextNotes,
    updatedNotes,
    grinders: nextGrinders,
    updatedGrinderCount,
    settings: {
      ...settings,
      roasterConfigs: renamedConfigs.configs,
    },
    updatedConfigCount: renamedConfigs.changedCount,
  };
}
