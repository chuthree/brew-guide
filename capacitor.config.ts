import type { CapacitorConfig } from "@capacitor/cli";

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
			resize: "body",
			style: "default",
			resizeOnFullScreen: true,
		},
	},
};

export default config;
