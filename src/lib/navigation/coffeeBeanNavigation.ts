export const COFFEE_BEAN_NAVIGATION_EVENTS = {
  SYNC_INVENTORY_CONTEXT: 'coffeeBeans:syncInventoryContext',
  INVENTORY_STATE_CHANGED: 'coffeeBeans:inventoryStateChanged',
} as const;

export type CoffeeBeanInventoryState = 'green' | 'roasted';

export interface SyncCoffeeBeanInventoryContextDetail {
  beanState?: CoffeeBeanInventoryState;
  clearSearch?: boolean;
}
