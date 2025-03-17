"use client";

import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";

export const isNative = () => {
	return Capacitor.isNativePlatform();
};

export const getPlatform = () => {
	return Capacitor.getPlatform();
};

export const initCapacitor = async () => {
	if (isNative()) {
		// 隐藏启动屏幕
		await SplashScreen.hide();

		// 这里可以添加其他 Capacitor 插件的初始化代码
	}
};

const capacitorUtils = {
	isNative,
	getPlatform,
	initCapacitor,
};

export default capacitorUtils;
