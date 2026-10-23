/** UI-only publication is replaced by the durable native publication port. */
const unavailable = (): never => {
  throw new Error(
    'UI operations are unavailable in the Provider business runtime.'
  );
};
const store = { getState: unavailable, setState: unavailable };
export const useCoffeeBeanStore = store;
export const useBrewingNoteStore = store;
export const useCustomEquipmentStore = store;
export const useCustomMethodStore = store;
export const useGrinderStore = store;
export const coffeeBeanImageRepository = { mergeBean: unavailable };
export const brewingNoteImageRepository = { mergeNote: unavailable };
export const clearExpectedCoreDataDeletion = unavailable;
export const markExpectedCoreDataDeletionIfEmpty = unavailable;
