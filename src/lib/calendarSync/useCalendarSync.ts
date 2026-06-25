'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useCoffeeBeanStore } from '../stores/coffeeBeanStore';
import { useSettingsStore } from '../stores/settingsStore';
import { canUseNativeCalendar } from './nativeCalendar';
import { syncCoffeeBeanCalendarEvents } from './service';
import { deriveNavigationSettings } from '../navigation/navigationSettings';

export const useCalendarSync = (enabled: boolean): void => {
  const beans = useCoffeeBeanStore(state => state.beans);
  const settings = useSettingsStore(state => state.settings);
  const syncQueueRef = useRef<Promise<void>>(Promise.resolve());
  const calendarSyncSupported = useMemo(() => canUseNativeCalendar(), []);
  const coffeeBeanModuleVisible = deriveNavigationSettings(
    settings.navigationSettings
  ).visibleTabs.coffeeBean;

  const syncKey = useMemo(
    () =>
      JSON.stringify({
        enabled,
        coffeeBeanModuleVisible,
        calendarSync: settings.calendarSync,
        beans: beans.map(bean => ({
          id: bean.id,
          name: bean.name,
          roaster: bean.roaster,
          roastDate: bean.roastDate,
          roastLevel: bean.roastLevel,
          startDay: bean.startDay,
          endDay: bean.endDay,
          remaining: bean.remaining,
          beanState: bean.beanState,
          isFrozen: bean.isFrozen,
          isInTransit: bean.isInTransit,
        })),
      }),
    [beans, coffeeBeanModuleVisible, enabled, settings.calendarSync]
  );

  useEffect(() => {
    if (!enabled || !calendarSyncSupported || !coffeeBeanModuleVisible) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;

      syncQueueRef.current = syncQueueRef.current
        .catch(() => undefined)
        .then(() => syncCoffeeBeanCalendarEvents(beans, settings));
    }, 500);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    beans,
    calendarSyncSupported,
    coffeeBeanModuleVisible,
    enabled,
    settings,
    syncKey,
  ]);
};
