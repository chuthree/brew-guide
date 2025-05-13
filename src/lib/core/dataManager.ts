import { Storage } from "@/lib/core/storage";
import { Method, CustomEquipment } from "@/lib/core/config";
import { CoffeeBean, BlendComponent } from "@/types/app";
import { APP_VERSION } from "@/lib/core/config";
import { SettingsOptions } from "@/components/settings/Settings";
import { LayoutSettings } from "@/components/brewing/Timer/Settings";
import { db } from "@/lib/core/db";

// 检查是否在浏览器环境中
const isBrowser = typeof window !== 'undefined';

// 定义导出数据的接口
interface ExportData {
	exportDate: string;
	appVersion: string;
	data: Record<string, unknown>;
}

// 定义导入数据的接口
interface ImportData {
	exportDate?: string;
	appVersion?: string;
	data?: Record<string, unknown>;
}

// 定义冲煮记录的接口
interface BrewingNote {
	id: string;
	timestamp: number;
	equipment?: string;
	method?: string;
	params?: {
		coffee: string;
		water: string;
		ratio: string;
		grindSize: string;
		temp: string;
	};
	[key: string]: unknown;
}

/**
 * 应用数据键名列表
 */
export const APP_DATA_KEYS = [
	"customMethods", // 自定义冲煮方案
	"brewingNotes", // 冲煮记录
	"brewGuideSettings", // 应用设置
	"brewingNotesVersion", // 数据版本
	"coffeeBeans", // 咖啡豆数据
	"customEquipments", // 自定义器具
	"onboardingCompleted", // 引导完成标记
];

/**
 * 自定义预设键名前缀
 */
const CUSTOM_PRESETS_PREFIX = "brew-guide:custom-presets:";

/**
 * 自定义预设键名列表
 */
const CUSTOM_PRESETS_KEYS = [
	"origins", // 产地
	"processes", // 处理法
	"varieties", // 品种
];

/**
 * 数据管理工具类
 */
export const DataManager = {
	/**
	 * 导出所有数据
	 * @returns 包含所有数据的JSON字符串
	 */
	async exportAllData(): Promise<string> {
		try {
			const exportData: ExportData = {
				exportDate: new Date().toISOString(),
				appVersion: APP_VERSION,
				data: {},
			};

			// 获取所有数据
			for (const key of APP_DATA_KEYS) {
				const value = await Storage.get(key);
				if (value) {
					try {
						// 尝试解析JSON
						exportData.data[key] = JSON.parse(value);
						
						// 如果是冲煮笔记数据，清理冗余的咖啡豆信息
						if (key === "brewingNotes" && Array.isArray(exportData.data[key])) {
							exportData.data[key] = this.cleanBrewingNotesForExport(exportData.data[key] as BrewingNote[]);
						}
					} catch {
						// 如果不是JSON，直接存储字符串
						exportData.data[key] = value;
					}
				}
			}

			// 获取所有自定义方案
			try {
				// 获取所有存储键
				const allKeys = await Storage.keys();
				
				// 过滤出自定义方案键
				const methodKeys = allKeys.filter(key => key.startsWith("customMethods_"));
				
				// 如果有自定义方案，将它们添加到导出数据中
				if (methodKeys.length > 0) {
					// 初始化自定义方案存储结构
					exportData.data.customMethodsByEquipment = {};
					
					// 处理每个器具的自定义方案
					for (const key of methodKeys) {
						// 提取器具ID
						const equipmentId = key.replace("customMethods_", "");
						
						// 加载该器具的方案
						const methodsJson = await Storage.get(key);
						if (methodsJson) {
							try {
								const methods = JSON.parse(methodsJson);
								// 将当前器具的所有方案添加到导出数据中
								(exportData.data.customMethodsByEquipment as Record<string, unknown>)[equipmentId] = methods;
							} catch {
								// 如果JSON解析失败，跳过
								console.error(`解析自定义方案数据失败: ${key}`);
							}
						}
					}
				}
				
				// 尝试从IndexedDB加载更完整的自定义方案数据
				try {
					const methodsFromDB = await db.customMethods.toArray();
					if (methodsFromDB && methodsFromDB.length > 0) {
						// 确保customMethodsByEquipment已初始化
						if (!exportData.data.customMethodsByEquipment) {
							exportData.data.customMethodsByEquipment = {};
						}
						
						// 添加或更新来自IndexedDB的方案数据
						for (const item of methodsFromDB) {
							const { equipmentId, methods } = item;
							if (Array.isArray(methods) && methods.length > 0) {
								// 将当前器具的所有方案添加到导出数据中
								(exportData.data.customMethodsByEquipment as Record<string, unknown>)[equipmentId] = methods;
							}
						}
						
						// 检查自定义器具数据
						if (exportData.data.customEquipments && Array.isArray(exportData.data.customEquipments)) {
							const customEquipments = exportData.data.customEquipments as CustomEquipment[];
						}
					}
				} catch (dbError) {
					console.error("从IndexedDB导出自定义方案失败:", dbError);
				}
			} catch (error) {
				console.error("导出自定义方案失败:", error);
				// 错误处理：即使自定义方案导出失败，也继续导出其他数据
			}

			// 导出自定义预设数据
			try {
				if (isBrowser) {
					// 初始化自定义预设存储结构
					exportData.data.customPresets = {};

					// 处理每个自定义预设类型
					for (const key of CUSTOM_PRESETS_KEYS) {
						const storageKey = `${CUSTOM_PRESETS_PREFIX}${key}`;
						const presetJson = localStorage.getItem(storageKey);
						
						if (presetJson) {
							try {
								const presets = JSON.parse(presetJson);
								// 将当前类型的所有自定义预设添加到导出数据中
								(exportData.data.customPresets as Record<string, unknown>)[key] = presets;
							} catch {
								// 如果JSON解析失败，跳过
								console.error(`解析自定义预设数据失败: ${key}`);
							}
						}
					}
				}
			} catch (error) {
				console.error("导出自定义预设失败:", error);
				// 错误处理：即使自定义预设导出失败，也继续导出其他数据
			}

			return JSON.stringify(exportData, null, 2);
		} catch {
			throw new Error("导出数据失败");
		}
	},

	/**
	 * 导入所有数据
	 * @param jsonString 包含所有数据的JSON字符串
	 * @returns 导入结果
	 */
	async importAllData(
		jsonString: string
	): Promise<{ success: boolean; message: string }> {
		try {
			const importData = JSON.parse(jsonString) as ImportData;

			// 验证数据格式
			if (!importData.data) {
				return {
					success: false,
					message: "导入的数据格式不正确，缺少 data 字段",
				};
			}

			// 导入所有数据
			for (const key of APP_DATA_KEYS) {
				if (importData.data[key] !== undefined) {
					// 如果是对象或数组，转换为JSON字符串
					const value =
						typeof importData.data[key] === "object"
							? JSON.stringify(importData.data[key])
							: String(importData.data[key]);
					await Storage.set(key, value);
					
					// 对于自定义器具，同时更新IndexedDB
					if (key === 'customEquipments' && typeof importData.data[key] === 'object') {
						const rawEquipments = importData.data[key] as unknown[];
						if (Array.isArray(rawEquipments)) {
							// 首先清除现有数据
							await db.customEquipments.clear();
							// 然后导入新数据
							await db.customEquipments.bulkPut(rawEquipments as CustomEquipment[]);
						}
					}
				}
			}
			
			// 导入自定义方案数据
			if (importData.data.customMethodsByEquipment && typeof importData.data.customMethodsByEquipment === 'object') {
				// 清除现有方案数据
				await db.customMethods.clear();
				
				// 遍历所有器具的方案
				const customMethodsByEquipment = importData.data.customMethodsByEquipment as Record<string, unknown>;
				
				// 导入的自定义器具ID列表
				let customEquipmentIds: string[] = [];
				if (importData.data.customEquipments && Array.isArray(importData.data.customEquipments)) {
					customEquipmentIds = (importData.data.customEquipments as CustomEquipment[]).map(e => e.id);
				}
				
				for (const equipmentId of Object.keys(customMethodsByEquipment)) {
					const methods = customMethodsByEquipment[equipmentId];
					if (Array.isArray(methods)) {
						// 保存该器具的所有方案
						const storageKey = `customMethods_${equipmentId}`;
						await Storage.set(storageKey, JSON.stringify(methods));
						
						// 同时更新IndexedDB
						await db.customMethods.put({
							equipmentId,
							methods
						});
					}
				}
			}
			
			// 导入自定义预设数据
			if (isBrowser && importData.data.customPresets && typeof importData.data.customPresets === 'object') {
				// 遍历所有自定义预设类型
				const customPresets = importData.data.customPresets as Record<string, unknown>;
				for (const presetType of Object.keys(customPresets)) {
					if (CUSTOM_PRESETS_KEYS.includes(presetType)) {
						const presets = customPresets[presetType];
						if (Array.isArray(presets)) {
							// 保存该类型的所有自定义预设
							const storageKey = `${CUSTOM_PRESETS_PREFIX}${presetType}`;
							localStorage.setItem(storageKey, JSON.stringify(presets));
						}
					}
				}
			}
			
			// 触发数据变更事件，通知应用中的组件重新加载数据
			if (isBrowser) {
				// 触发自定义器具更新事件
				const equipmentEvent = new CustomEvent('customEquipmentUpdate', {
					detail: { source: 'importAllData' }
				});
				window.dispatchEvent(equipmentEvent);
				
				// 触发自定义方案更新事件
				const methodEvent = new CustomEvent('customMethodUpdate', {
					detail: { source: 'importAllData' }
				});
				window.dispatchEvent(methodEvent);
				
				// 触发一个通用的数据更改事件
				const dataChangeEvent = new CustomEvent('storage:changed', { 
					detail: { key: 'allData', action: 'import' } 
				});
				window.dispatchEvent(dataChangeEvent);
			}
			
			return {
				success: true,
				message: `数据导入成功，导出日期: ${
					importData.exportDate
						? new Date(importData.exportDate).toLocaleString()
						: "未知"
				}`,
			};
		} catch (_error) {
			return {
				success: false,
				message: `导入数据失败: ${(_error as Error).message}`,
			};
		}
	},

	/**
	 * 重置所有数据
	 * @param completeReset 是否完全重置（包括所有设置和缓存）
	 * @returns 重置结果
	 */
	async resetAllData(
		completeReset = false
	): Promise<{ success: boolean; message: string }> {
		try {
			// 清除列表中的数据
			for (const key of APP_DATA_KEYS) {
				await Storage.remove(key);
			}

			// 如果是完全重置，还需要清除其他数据
			if (completeReset) {
				// 获取所有存储键
				const allKeys = await Storage.keys();
				
				// 清除所有自定义方案
				const methodKeys = allKeys.filter(key => key.startsWith("customMethods_"));
				for (const key of methodKeys) {
					await Storage.remove(key);
				}
				
				// 同时清除IndexedDB数据
				await db.customEquipments.clear();
				await db.customMethods.clear();
				
				// 清除所有自定义预设
				if (isBrowser) {
					for (const key of CUSTOM_PRESETS_KEYS) {
						localStorage.removeItem(`${CUSTOM_PRESETS_PREFIX}${key}`);
					}
				}
			}

			return {
				success: true,
				message: completeReset
					? "已完全重置所有数据和设置"
					: "已重置主要数据",
			};
		} catch (_error) {
			return {
				success: false,
				message: "重置数据失败",
			};
		}
	},

	/**
	 * 修复拼配豆数据问题
	 * 处理可能存在问题的拼配豆数据，确保类型和blendComponents字段正确
	 * @returns 修复结果，包含修复数量
	 */
	async fixBlendBeansData(): Promise<{ success: boolean; fixedCount: number }> {
		try {
			// 获取所有咖啡豆数据
			const beansStr = await Storage.get('coffeeBeans');
			if (!beansStr) {
				return { success: true, fixedCount: 0 };
			}

			// 解析咖啡豆数据
			const beans = JSON.parse(beansStr);
			if (!Array.isArray(beans)) {
				return { success: false, fixedCount: 0 };
			}

			let fixedCount = 0;

			// 处理每个咖啡豆
			const fixedBeans = beans.map((bean) => {
				// 检查是否有类型字段
				if (!bean.type) {
					bean.type = '单品';
					fixedCount++;
				}

				// 处理拼配豆
				if (bean.type === '拼配') {
					// 如果标记为拼配豆但没有拼配成分，添加默认拼配成分
					if (!bean.blendComponents || !Array.isArray(bean.blendComponents) || bean.blendComponents.length === 0) {
						bean.blendComponents = [{
							origin: bean.origin || '',
							process: bean.process || '',
							variety: bean.variety || ''
						}];
						fixedCount++;
					}
					// 如果拼配成分只有一个，确保类型是单品
					else if (bean.blendComponents.length === 1) {
						bean.type = '单品';
						fixedCount++;
					}
				}
				// 处理单品豆
				else if (bean.type === '单品') {
					// 如果是单品但拼配成分长度不对，修复
					if (bean.blendComponents && Array.isArray(bean.blendComponents)) {
						if (bean.blendComponents.length > 1) {
							bean.type = '拼配';
							fixedCount++;
						}
					}
					// 确保单品也有blendComponents字段，用于统一处理
					else {
						bean.blendComponents = [{
							origin: bean.origin || '',
							process: bean.process || '',
							variety: bean.variety || ''
						}];
						fixedCount++;
					}
				}

				// 确保所有拼配成分都有正确的属性
				if (bean.blendComponents && Array.isArray(bean.blendComponents)) {
					bean.blendComponents = bean.blendComponents.map((comp: BlendComponent) => {
						// 只修复无效的百分比值，而不是强制设置所有未定义的百分比
						if (comp.percentage !== undefined) {
							// 仅当百分比是无效值时修复
							if (typeof comp.percentage === 'number' && (comp.percentage < 1 || comp.percentage > 100)) {
								// 如果百分比值无效，将其约束在1-100范围内
								comp.percentage = Math.min(Math.max(1, comp.percentage), 100);
								fixedCount++;
							} else if (typeof comp.percentage !== 'number') {
								// 如果不是数字类型，尝试转换为数字
								try {
									const numValue = Number(comp.percentage);
									if (!isNaN(numValue)) {
										comp.percentage = Math.min(Math.max(1, numValue), 100);
									} else {
										// 如果无法转换为有效数字，移除百分比属性
										delete comp.percentage;
									}
									fixedCount++;
								} catch {
									// 转换失败，移除百分比属性
									delete comp.percentage;
									fixedCount++;
								}
							}
						}
						// 如果百分比为undefined，保持原样，不进行修复
						return comp;
					});
				}

				return bean;
			});

			// 如果有修复，更新存储
			if (fixedCount > 0) {
				await Storage.set('coffeeBeans', JSON.stringify(fixedBeans));
			}

			return { success: true, fixedCount };
		} catch (error) {
			console.error('修复拼配豆数据失败:', error);
			return { success: false, fixedCount: 0 };
		}
	},

	/**
	 * 清理冲煮笔记中的冗余咖啡豆数据
	 * 移除每个笔记中的完整coffeeBean对象，只保留必要的beanId和coffeeBeanInfo
	 * @param notes 冲煮笔记数组
	 * @returns 清理后的冲煮笔记数组
	 */
	cleanBrewingNotesForExport(notes: BrewingNote[]): BrewingNote[] {
		return notes.map(note => {
			// 创建笔记的浅拷贝
			const cleanedNote = { ...note };
			
			// 删除coffeeBean字段，它包含完整的咖啡豆对象
			if ('coffeeBean' in cleanedNote) {
				delete cleanedNote.coffeeBean;
			}
			
			return cleanedNote;
		});
	},
};
