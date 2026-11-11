import type { CoffeeBean } from '@/types/app';
import { parseBeanName, getNextAvailableNumber } from './repurchaseNaming';
import type { AppSettings } from '@/lib/data/models';
import { normalizeImportedCoffeeBeanPatch } from './beanImport';
import { validateRatingInput } from '@/lib/ratings';

/** Shared by the add form and transactional MCP repurchase commands. */
export function buildRepurchaseBean(
  bean: CoffeeBean,
  allBeans: CoffeeBean[],
  changes: Partial<CoffeeBean> & { capacityGrams?: number } = {},
  settings?: AppSettings
): Omit<CoffeeBean, 'id' | 'timestamp'> {
  const { baseName } = parseBeanName(bean.name);
  const {
    id: _id,
    timestamp: _timestamp,
    overallRating: _overallRating,
    ratingNotes: _ratingNotes,
    sourceGreenBeanId: _sourceGreenBeanId,
    sourceGreenBeanIds: _sourceGreenBeanIds,
    ...copy
  } = bean;
  const draft = {
    ...copy,
    name: `${baseName} #${getNextAvailableNumber(baseName, allBeans)}`,
    remaining: bean.capacity || '',
    roastDate: '',
  };
  const { capacityGrams, ...fields } = changes;
  validateRatingInput(fields, settings);
  const finalDraft = normalizeImportedCoffeeBeanPatch(
    draft,
    {
      ...fields,
      ...(capacityGrams === undefined
        ? {}
        : { capacity: String(capacityGrams) }),
    },
    settings
  );
  // This is still an unsaved new batch, so its final package starts full.
  return { ...finalDraft, remaining: finalDraft.capacity || '' };
}
