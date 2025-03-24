"use client";

import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";

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

		// 处理状态栏，确保安全区域正确显示
		const platform = getPlatform();

		if (platform === "android") {
			// 在Android上配置状态栏
			try {
				// 设置透明状态栏，确保WebView内容延伸到状态栏下
				await StatusBar.setOverlaysWebView({ overlay: true });

				// 检测深色模式并设置状态栏颜色
				const prefersDark = window.matchMedia(
					"(prefers-color-scheme: dark)"
				).matches;
				await StatusBar.setStyle({
					style: prefersDark ? Style.Dark : Style.Light,
				});

				// 确保可见，这样安全区域才会正确计算
				await StatusBar.show();

				// 添加CSS类标识当前是Android平台
				document.documentElement.classList.add("android-device");

				// 手动调整顶部填充，解决Android状态栏问题
				const safeElements = document.querySelectorAll(".pt-safe");
				safeElements.forEach((el) => {
					// 将pt-safe替换为android-pt-safe，或者添加android-pt-safe类
					if (el instanceof HTMLElement) {
						el.classList.add("android-pt-safe");
					}
				});
			} catch {}
		} else if (platform === "ios") {
			// 在iOS上配置状态栏
			try {
				// 设置状态栏样式为黑色（亮模式）或白色（暗模式）
				const prefersDark = window.matchMedia(
					"(prefers-color-scheme: dark)"
				).matches;
				await StatusBar.setStyle({
					style: prefersDark ? Style.Dark : Style.Light,
				});

				// 确保WebView内容延伸到状态栏区域
				await StatusBar.setOverlaysWebView({ overlay: true });

				// 确保状态栏可见
				await StatusBar.show();

				// 添加CSS类标识当前是iOS平台
				document.documentElement.classList.add("ios-device");

				// 手动调整顶部填充，解决iOS状态栏问题
				const safeElements = document.querySelectorAll(".pt-safe");
				safeElements.forEach((el) => {
					// 将pt-safe替换为ios-pt-safe，或者添加ios-pt-safe类
					if (el instanceof HTMLElement) {
						el.classList.add("ios-pt-safe");
					}
				});
			} catch {}
		}

		// 监听系统深色模式变化，动态调整状态栏
		window
			.matchMedia("(prefers-color-scheme: dark)")
			.addEventListener("change", async (e) => {
				try {
					await StatusBar.setStyle({
						style: e.matches ? Style.Dark : Style.Light,
					});
				} catch {}
			});
	}
};

const capacitorUtils = {
	isNative,
	getPlatform,
	initCapacitor,
};

export default capacitorUtils;
