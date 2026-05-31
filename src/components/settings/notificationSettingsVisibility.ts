import type { MainNavigationTab } from '@/lib/navigation/navigationSettings';

type VisibleModuleMap = Record<MainNavigationTab, boolean>;

export const getNotificationSettingsVisibility = ({
  isNativeApp,
  visibleModules,
}: {
  isNativeApp: boolean;
  visibleModules: VisibleModuleMap;
}) => {
  const showBrewingNotificationSound = visibleModules.brewing;
  const showCoffeeBeanNotifications = visibleModules.coffeeBean;
  const showGeneralNotificationSection =
    showBrewingNotificationSound || isNativeApp;
  const hasVisibleNotificationSettings =
    showGeneralNotificationSection || showCoffeeBeanNotifications;

  return {
    hasVisibleNotificationSettings,
    showBrewingNotificationSound,
    showCoffeeBeanNotifications,
    showGeneralNotificationSection,
  };
};
