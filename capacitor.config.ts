/// <reference types="@capacitor-community/safe-area" />

import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize, KeyboardStyle } from '@capacitor/keyboard';

const config: CapacitorConfig = {
  appId: 'com.brewguide.online',
  appName: 'BrewGuide(OL)',
  webDir: 'out',
  server: {
    url: 'https://coffee.chu3.top/',
    cleartext: false,
    androidScheme: 'https',
    iosScheme: 'https',
    allowNavigation: ['coffee.chu3.top', '*.chu3.top'],
  },
  plugins: {
    Keyboard: {
      resize: KeyboardResize.Native,
      style: KeyboardStyle.Dark,
      resizeOnFullScreen: true,
    },
    SafeArea: {
      enabled: true,
      customColorsForSystemBars: true,
      statusBarColor: '#00000000', // 透明
      statusBarContent: 'light',
      navigationBarColor: '#00000000', // 透明
      navigationBarContent: 'light',
      offset: 0,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#737373',
    },
  },
};

export default config;
