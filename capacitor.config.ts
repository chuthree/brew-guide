/// <reference types="@capacitor-community/safe-area" />

import type { CapacitorConfig } from "@capacitor/cli";
import { KeyboardResize, KeyboardStyle } from "@capacitor/keyboard";

const config: CapacitorConfig = {
	appId: "com.brewguide.app",
	appName: "Brew Guide",
	webDir: "out",
	server: {
		androidScheme: "https",
		iosScheme: "https",
		hostname: "app",
	},
	plugins: {
		SplashScreen: {
			launchShowDuration: 2000,
			launchAutoHide: true,
			backgroundColor: "#FFFFFF",
			androidSplashResourceName: "splash",
			androidScaleType: "CENTER_CROP",
			showSpinner: false,
			splashFullScreen: true,
			splashImmersive: true,
		},
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
	},
};

export default config;
