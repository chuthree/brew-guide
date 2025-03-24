import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

/**
 * 统一的存储接口，同时支持 Capacitor Preferences API 和 localStorage
 */
export const Storage = {
	/**
	 * 获取存储的值
	 * @param key 键名
	 * @returns 存储的值，如果不存在则返回 null
	 */
	async get(key: string): Promise<string | null> {
		try {
			if (Capacitor.isNativePlatform()) {
				// 在原生平台上使用 Capacitor Preferences API
				const { value } = await Preferences.get({ key });
				return value;
			} else {
				// 在 Web 平台上使用 localStorage
				return localStorage.getItem(key);
			}
		} catch (_error) {
			return null;
		}
	},

	/**
	 * 设置存储值
	 * @param key 键名
	 * @param value 值
	 */
	async set(key: string, value: string): Promise<void> {
		try {
			if (Capacitor.isNativePlatform()) {
				// 在原生平台上使用 Capacitor Preferences API
				await Preferences.set({ key, value });
			} else {
				// 在 Web 平台上使用 localStorage
				localStorage.setItem(key, value);
			}
		} catch (_error) {
			// 错误处理
		}
	},

	/**
	 * 删除存储的值
	 * @param key 键名
	 */
	async remove(key: string): Promise<void> {
		try {
			if (Capacitor.isNativePlatform()) {
				// 在原生平台上使用 Capacitor Preferences API
				await Preferences.remove({ key });
			} else {
				// 在 Web 平台上使用 localStorage
				localStorage.removeItem(key);
			}
		} catch (_error) {
			// 错误处理
		}
	},

	/**
	 * 清除所有存储
	 */
	async clear(): Promise<void> {
		try {
			if (Capacitor.isNativePlatform()) {
				// 在原生平台上使用 Capacitor Preferences API
				await Preferences.clear();
			} else {
				// 在 Web 平台上使用 localStorage
				localStorage.clear();
			}
		} catch (_error) {
			// 错误处理
		}
	},

	/**
	 * 获取所有键
	 * @returns 所有键的数组
	 */
	async keys(): Promise<string[]> {
		try {
			if (Capacitor.isNativePlatform()) {
				// 在原生平台上使用 Capacitor Preferences API
				const { keys } = await Preferences.keys();
				return keys;
			} else {
				// 在 Web 平台上使用 localStorage
				return Object.keys(localStorage);
			}
		} catch (_error) {
			return [];
		}
	},

	/**
	 * 同步获取存储的值（仅在 Web 平台上有效）
	 * @param key 键名
	 * @returns 存储的值，如果不存在则返回 null
	 */
	getSync(key: string): string | null {
		try {
			return localStorage.getItem(key);
		} catch (_error) {
			return null;
		}
	},

	/**
	 * 同步设置存储值（仅在 Web 平台上有效）
	 * @param key 键名
	 * @param value 值
	 */
	setSync(key: string, value: string): void {
		try {
			localStorage.setItem(key, value);
		} catch (_error) {
			// 错误处理
		}
	},
};
