import type { BrewingNote } from '@/lib/core/config';
import type { SettingsOptions } from '@/components/settings/Settings';
import type { CoffeeBean } from '@/types/app';
import type { CoffeeBeanInventoryState } from '@/lib/navigation/coffeeBeanNavigation';

export const shouldHideNoteInList = (
  note: BrewingNote,
  settings?: SettingsOptions
): boolean =>
  note.source === 'capacity-adjustment' &&
  !(settings?.showCapacityAdjustmentRecords ?? true);

export const isChangeRecordNote = (
  note: BrewingNote,
  settings?: SettingsOptions
): boolean => {
  if (shouldHideNoteInList(note, settings)) {
    return false;
  }

  return (
    note.source === 'quick-decrement' ||
    note.source === 'capacity-adjustment' ||
    note.source === 'roasting'
  );
};

export const filterNotesByBeanState = (
  notes: BrewingNote[],
  beanState: CoffeeBeanInventoryState,
  coffeeBeans: CoffeeBean[]
): BrewingNote[] => {
  if (beanState === 'roasted') return notes;

  const greenBeanIds = new Set(
    coffeeBeans.filter(bean => bean.beanState === 'green').map(bean => bean.id)
  );

  return notes.filter(note => {
    if (note.source === 'roasting' && note.changeRecord?.roastingRecord?.inputs)
      return true;
    const beanId =
      note.source === 'roasting'
        ? (note.changeRecord?.roastingRecord?.greenBeanId ?? note.beanId)
        : note.beanId;

    return beanId !== undefined && greenBeanIds.has(beanId);
  });
};
