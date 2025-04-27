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
				// 先检查数据大小
				const dataSize = new Blob([value]).size;
				console.log(`[Storage] 设置 ${key} - 数据大小: ${dataSize} 字节`);
				
				// 对于大数据，尝试分段保存或提醒用户
				if (dataSize > 4 * 1024 * 1024) { // 超过4MB的数据
					console.warn(`[Storage] 警告：${key} 数据大小超过4MB，可能会影响性能或存储失败`);
				}
				
				// 尝试保存数据并验证
				try {
					localStorage.setItem(key, value);
					
					// 验证保存是否成功
					const saved = localStorage.getItem(key);
					if (saved !== value) {
						console.warn(`[Storage] 警告：${key} 验证失败，尝试重新保存`);
						// 重试一次
						localStorage.setItem(key, value);
						
						// 再次验证
						const retryVerify = localStorage.getItem(key); 
						if (retryVerify !== value) {
							throw new Error(`数据验证失败，可能存储空间不足`);
						}
					}

					// 对于笔记数据，进行特殊处理
					if (key === 'brewingNotes') {
						try {
							// 解析JSON确保数据有效
							JSON.parse(value);
							
							// 保存一个备份，以便恢复
							const backupKey = `${key}_backup_${Date.now()}`;
							localStorage.setItem(backupKey, value);
							console.log(`[Storage] 已创建笔记数据备份: ${backupKey}`);
							
							// 仅保留最新的3个备份
							const allKeys = Object.keys(localStorage);
							const backupKeys = allKeys.filter(k => k.startsWith(`${key}_backup_`)).sort();
							if (backupKeys.length > 3) {
								// 删除旧备份
								backupKeys.slice(0, backupKeys.length - 3).forEach(oldKey => {
									localStorage.removeItem(oldKey);
									console.log(`[Storage] 已删除旧备份: ${oldKey}`);
								});
							}
						} catch (e) {
							console.error(`[Storage] 笔记数据不是有效的JSON: ${e}`);
							throw new Error(`笔记数据无效，请尝试清除缓存后重试`);
						}
					}
				} catch (e) {
					// 特殊处理 QUOTA_EXCEEDED_ERR 错误
					if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
						console.error(`[Storage] 存储空间不足: ${e}`);
						throw new Error('存储空间不足，请删除部分历史数据或清理浏览器缓存后重试');
					}
					throw e; // 重新抛出其他错误
				}

				// 手动触发自定义存储变更事件
				const event = new CustomEvent('storage:changed', {
					detail: { key, source: 'internal' }
				});
				window.dispatchEvent(event);
			}
		} catch (error) {
			console.error(`[Storage] 设置 ${key} 时出错:`, error);
			throw error; // 重新抛出错误，让调用者知道存储失败
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
