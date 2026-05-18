'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useCoffeeBeanStore } from '../stores/coffeeBeanStore';
import { useSettingsStore } from '../stores/settingsStore';
import { canUseNativeCalendar } from './nativeCalendar';
import { syncCoffeeBeanCalendarEvents } from './service';

export const useCalendarSync = (enabled: boolean): void => {
  const beans = useCoffeeBeanStore(state => state.beans);
  const settings = useSettingsStore(state => state.settings);
  const syncQueueRef = useRef<Promise<void>>(Promise.resolve());
  const calendarSyncSupported = useMemo(() => canUseNativeCalendar(), []);

  const syncKey = useMemo(
    () =>
      JSON.stringify({
        enabled,
        calendarSync: settings.calendarSync,
        customFlavorPeriod: settings.customFlavorPeriod,
        beans: beans.map(bean => ({
          id: bean.id,
          name: bean.name,
          roaster: bean.roaster,
          roastDate: bean.roastDate,
          roastLevel: bean.roastLevel,
          startDay: bean.startDay,
          endDay: bean.endDay,
          beanState: bean.beanState,
          isFrozen: bean.isFrozen,
          isInTransit: bean.isInTransit,
        })),
      }),
    [beans, enabled, settings.calendarSync, settings.customFlavorPeriod]
  );

  useEffect(() => {
    if (!enabled || !calendarSyncSupported) return;

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
  }, [beans, calendarSyncSupported, enabled, settings, syncKey]);
};
