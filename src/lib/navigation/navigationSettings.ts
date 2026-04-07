import type { AppSettings } from '@/lib/core/db';
import {
  VIEW_OPTIONS,
  type ViewOption,
} from '@/components/coffee-bean/List/constants';

export type MainNavigationTab = keyof NonNullable<
  AppSettings['navigationSettings']
>['visibleTabs'];

export const DEFAULT_NAVIGATION_SETTINGS: NonNullable<
  AppSettings['navigationSettings']
> = {
  visibleTabs: {
    brewing: true,
    coffeeBean: true,
    notes: true,
  },
  coffeeBeanViews: {
    [VIEW_OPTIONS.INVENTORY]: true,
    [VIEW_OPTIONS.RANKING]: true,
    [VIEW_OPTIONS.STATS]: true,
  },
  pinnedViews: [],
};

export const MAIN_NAVIGATION_TABS: MainNavigationTab[] = [
  'brewing',
  'coffeeBean',
  'notes',
];

export const COFFEE_BEAN_VIEW_ORDER: ViewOption[] = [
  VIEW_OPTIONS.INVENTORY,
  VIEW_OPTIONS.RANKING,
  VIEW_OPTIONS.STATS,
];

const isViewOption = (value: string): value is ViewOption =>
  COFFEE_BEAN_VIEW_ORDER.includes(value as ViewOption);

export const normalizeNavigationSettings = (
  navigationSettings?: AppSettings['navigationSettings']
): NonNullable<AppSettings['navigationSettings']> => {
  const visibleTabs = {
    ...DEFAULT_NAVIGATION_SETTINGS.visibleTabs,
    ...(navigationSettings?.visibleTabs ?? {}),
  };

  const coffeeBeanViews = {
    ...DEFAULT_NAVIGATION_SETTINGS.coffeeBeanViews,
    ...(navigationSettings?.coffeeBeanViews ?? {}),
  };

  const pinnedViews = Array.from(
    new Set((navigationSettings?.pinnedViews ?? []).filter(isViewOption))
  );

  return {
    visibleTabs,
    coffeeBeanViews,
    pinnedViews,
  };
};

export const mergeNavigationSettings = (
  current?: AppSettings['navigationSettings'],
  updates?: Partial<NonNullable<AppSettings['navigationSettings']>>
): NonNullable<AppSettings['navigationSettings']> => {
  const normalizedCurrent = normalizeNavigationSettings(current);

  return normalizeNavigationSettings({
    ...normalizedCurrent,
    ...updates,
    visibleTabs: {
      ...normalizedCurrent.visibleTabs,
      ...(updates?.visibleTabs ?? {}),
    },
    coffeeBeanViews: {
      ...normalizedCurrent.coffeeBeanViews,
      ...(updates?.coffeeBeanViews ?? {}),
    },
    pinnedViews: updates?.pinnedViews ?? normalizedCurrent.pinnedViews,
  });
};

export interface DerivedNavigationSettings {
  visibleTabs: NonNullable<AppSettings['navigationSettings']>['visibleTabs'];
  coffeeBeanViews: NonNullable<
    AppSettings['navigationSettings']
  >['coffeeBeanViews'];
  pinnedViews: ViewOption[];
  enabledViews: ViewOption[];
  enabledUnpinnedViews: ViewOption[];
  hasPinnedViews: boolean;
  showCoffeeBeanMainTab: boolean;
  canConfigureCoffeeBeanMainTab: boolean;
  renderedMainTabs: MainNavigationTab[];
}

export const deriveNavigationSettings = (
  navigationSettings?: AppSettings['navigationSettings']
): DerivedNavigationSettings => {
  const normalized = normalizeNavigationSettings(navigationSettings);
  const pinnedViews = normalized.pinnedViews as ViewOption[];

  const enabledViews = COFFEE_BEAN_VIEW_ORDER.filter(
    view => normalized.coffeeBeanViews[view] !== false
  );
  const enabledUnpinnedViews = enabledViews.filter(
    view => !pinnedViews.includes(view)
  );

  const showCoffeeBeanMainTab =
    normalized.visibleTabs.coffeeBean && enabledUnpinnedViews.length > 0;

  const renderedMainTabs = MAIN_NAVIGATION_TABS.filter(tab => {
    if (tab === 'coffeeBean') {
      return showCoffeeBeanMainTab;
    }
    return normalized.visibleTabs[tab];
  });

  return {
    visibleTabs: normalized.visibleTabs,
    coffeeBeanViews: normalized.coffeeBeanViews,
    pinnedViews,
    enabledViews,
    enabledUnpinnedViews,
    hasPinnedViews: pinnedViews.length > 0,
    showCoffeeBeanMainTab,
    canConfigureCoffeeBeanMainTab: enabledUnpinnedViews.length > 0,
    renderedMainTabs,
  };
};

export const canDisableMainNavigationTab = (
  navigationSettings: AppSettings['navigationSettings'] | undefined,
  tab: MainNavigationTab
) => {
  const derived = deriveNavigationSettings(navigationSettings);

  if (tab === 'coffeeBean' && !derived.canConfigureCoffeeBeanMainTab) {
    return false;
  }

  if (!derived.renderedMainTabs.includes(tab)) {
    return true;
  }

  return derived.renderedMainTabs.length > 1;
};

export const canDisableCoffeeBeanView = (
  navigationSettings: AppSettings['navigationSettings'] | undefined,
  view: ViewOption
) => {
  const derived = deriveNavigationSettings(navigationSettings);

  if (!derived.enabledViews.includes(view)) {
    return true;
  }

  return derived.enabledViews.length > 1;
};
