"use client";

import { Capacitor } from "@capacitor/core";
import { TextZoom } from "@capacitor/text-zoom";

/**
 * 检查TextZoom功能是否可用（只在原生Capacitor应用中可用）
 * @returns 返回是否支持TextZoom功能
 */
export const isTextZoomAvailable = (): boolean => {
	return (
		Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("TextZoom")
	);
};

/**
 * 获取当前文本缩放级别
 * @returns 返回当前文本缩放比例，默认为1.0
 */
export const getTextZoom = async (): Promise<number> => {
	try {
		if (isTextZoomAvailable()) {
			const { value } = await TextZoom.get();
			return value;
		}
		return 1.0; // 默认值
	} catch (error) {
		console.error("获取文本缩放级别失败:", error);
		return 1.0; // 出错时返回默认值
	}
};

/**
 * 设置文本缩放级别
 * @param value 缩放级别，范围0.8-1.4，1.0为标准大小
 */
export const setTextZoom = async (value: number): Promise<void> => {
	try {
		if (isTextZoomAvailable()) {
			// 确保缩放值在合理范围内
			const safeValue = Math.min(Math.max(value, 0.8), 1.4);
			await TextZoom.set({ value: safeValue });
		}
	} catch (error) {
		console.error("设置文本缩放级别失败:", error);
	}
};

// 导出默认对象
const textZoomUtils = {
	isAvailable: isTextZoomAvailable,
	get: getTextZoom,
	set: setTextZoom,
};

export default textZoomUtils;
