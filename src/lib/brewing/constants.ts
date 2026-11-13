import type { BrewingStep, TabType } from '../hooks/useBrewingState';

export const BREWING_STEP_TABS: Record<BrewingStep, TabType> = {
  coffeeBean: '咖啡豆',
  method: '方案',
  brewing: '注水',
  notes: '记录',
};

export const BREWING_EVENTS = {
  NAVIGATE_TO_MAIN_TAB: 'brewing:navigateToMainTab',
  NAVIGATE_TO_STEP: 'brewing:navigateToStep',
  SELECT_COFFEE_BEAN: 'brewing:selectCoffeeBean',
  SELECT_EQUIPMENT: 'brewing:selectEquipment',
  SELECT_METHOD: 'brewing:selectMethod',
};

export interface NavigationOptions {
  force?: boolean;
}
