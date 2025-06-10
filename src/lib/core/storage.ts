import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { StorageUtils } from "./storageUtils";

/**
 * 统一的存储接口，支持 IndexedDB、Capacitor Preferences API 和 localStorage
 * 更新支持大容量数据存储
 */
export const Storage = {
	/**
	 * 获取存储的值
	 * @param key 键名
	 * @returns 存储的值，如果不存在则返回 null
	 */
	async get(key: string): Promise<string | null> {
		try {
			// 使用新的StorageUtils获取数据
			return await StorageUtils.getData(key);
		} catch (_error) {
			console.error(`获取存储数据失败 [${key}]:`, _error);
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
			// 使用新的StorageUtils保存数据
			await StorageUtils.saveData(key, value);
		} catch (_error) {
			console.error(`保存数据失败 [${key}]:`, _error);
			throw _error; // 重新抛出错误，让调用者知道存储失败
		}
	},

	/**
	 * 删除存储的值
	 * @param key 键名
	 */
	async remove(key: string): Promise<void> {
		try {
			// 使用新的StorageUtils删除数据
			await StorageUtils.removeData(key);
		} catch (_error) {
			console.error(`删除数据失败 [${key}]:`, _error);
			// 错误处理
		}
	},

	/**
	 * 清除所有存储
	 */
	async clear(): Promise<void> {
		try {
			// 使用新的StorageUtils清除所有数据
			await StorageUtils.clearAllData();
		} catch (_error) {
			console.error('清除所有数据失败:', _error);
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
				// 检查是否在客户端环境
				if (typeof window === 'undefined') {
					return [];
				}
				// 在 Web 平台上使用 localStorage
				return Object.keys(localStorage);
			}
		} catch (_error) {
			console.error('获取所有键失败:', _error);
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
			// 检查是否在客户端环境
			if (typeof window === 'undefined') {
				return null;
			}
			return localStorage.getItem(key);
		} catch (_error) {
			console.error(`同步获取数据失败 [${key}]:`, _error);
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
			// 检查是否在客户端环境
			if (typeof window === 'undefined') {
				return;
			}
			localStorage.setItem(key, value);
		} catch (_error) {
			console.error(`同步保存数据失败 [${key}]:`, _error);
			// 错误处理
		}
	},
	
	/**
	 * 初始化存储系统
	 * 应用启动时调用一次
	 */
	async initialize(): Promise<void> {
		try {
			await StorageUtils.initialize();
			console.log('存储系统初始化完成');
		} catch (error) {
			console.error('存储系统初始化失败:', error);
		}
	}
};
