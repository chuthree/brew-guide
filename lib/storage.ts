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
			let result: string | null = null;
			
			if (Capacitor.isNativePlatform()) {
				// 在原生平台上使用 Capacitor Preferences API
				const { value } = await Preferences.get({ key });
				result = value;
			} else {
				// 在 Web 平台上使用 localStorage
				result = localStorage.getItem(key);
				
				// 对于特殊键brewingNotes，如果获取到的数据不是有效的JSON，重新初始化为空数组
				if (key === 'brewingNotes' && result !== null) {
					try {
						JSON.parse(result);
					} catch (_err) {
						result = '[]';
						localStorage.setItem(key, result);
					}
				}
			}
			
			return result;
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
				
				// 验证保存是否成功
				const saved = localStorage.getItem(key);
				if (saved !== value) {
					// 重试一次
					localStorage.setItem(key, value);
				}

				// 手动触发自定义存储变更事件
				const event = new CustomEvent('storage:changed', {
					detail: { key, source: 'internal' }
				});
				window.dispatchEvent(event);
			}
		} catch (_error) {
			throw _error; // 重新抛出错误，让调用者知道存储失败
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
