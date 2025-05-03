import { Storage } from "@/lib/core/storage";
import { Method } from "@/lib/core/config";
import { CoffeeBean, BlendComponent } from "@/types/app";
import { APP_VERSION } from "@/lib/core/config";
import { SettingsOptions } from "@/components/settings/Settings";
import { LayoutSettings } from "@/components/brewing/Timer/Settings";

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
				}
			}
			
			// 导入自定义方案数据
			if (importData.data.customMethodsByEquipment && typeof importData.data.customMethodsByEquipment === 'object') {
				// 遍历所有器具的方案
				const customMethodsByEquipment = importData.data.customMethodsByEquipment as Record<string, unknown>;
				for (const equipmentId of Object.keys(customMethodsByEquipment)) {
					const methods = customMethodsByEquipment[equipmentId];
					if (Array.isArray(methods)) {
						// 保存该器具的所有方案
						const storageKey = `customMethods_${equipmentId}`;
						await Storage.set(storageKey, JSON.stringify(methods));
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
	 * 合并数据
	 * 将导入的数据与现有数据合并，而不是完全替换
	 * @param jsonString 包含要合并数据的JSON字符串
	 * @returns 合并结果
	 */
	async mergeData(
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

			// 合并所有数据
			for (const key of APP_DATA_KEYS) {
				if (importData.data[key] !== undefined) {
					// 获取现有数据
					const existingDataStr = await Storage.get(key);
					let existingData: unknown = null;

					try {
						if (existingDataStr) {
							existingData = JSON.parse(existingDataStr);
						}
					} catch {
						// 如果不是JSON，直接使用字符串
						existingData = existingDataStr;
					}

					// 根据数据类型进行合并
					if (
						key === "customMethods" &&
						existingData &&
						importData.data[key]
					) {
						// 合并自定义方案
						const mergedMethods = {
							...(existingData as Record<string, Method[]>),
						};

						// 遍历导入的设备
						const importedMethods = importData.data[key] as Record<
							string,
							unknown
						>;
						Object.keys(importedMethods).forEach((equipment) => {
							if (!mergedMethods[equipment]) {
								mergedMethods[equipment] = [];
							}

							// 添加不重复的方案
							const methodsForEquipment =
								(importedMethods[equipment] as Method[]) || [];
							methodsForEquipment.forEach(
								(importedMethod: Method) => {
									// 检查是否已存在相同名称的方案
									const exists = mergedMethods[
										equipment
									].some(
										(m: Method) =>
											m.name === importedMethod.name
									);

									if (!exists) {
										// 生成新ID避免冲突
										const methodWithNewId = {
											...importedMethod,
											id: `${Date.now()}-${Math.random()
												.toString(36)
												.substr(2, 9)}`,
										};
										mergedMethods[equipment].push(
											methodWithNewId
										);
									}
								}
							);
						});

						await Storage.set(key, JSON.stringify(mergedMethods));
					} else if (
						key === "brewGuideSettings" &&
						existingData &&
						importData.data[key]
					) {
						// 合并应用设置
						const existingSettings = typeof existingData === 'object'
							? existingData as SettingsOptions
							: {} as SettingsOptions;
						const importedSettings = typeof importData.data[key] === 'object'
							? importData.data[key] as SettingsOptions
							: {} as SettingsOptions;

						// 为设置项创建一个深合并
						const mergedSettings: SettingsOptions = {
							...existingSettings,
							...importedSettings,
							// 特殊处理预设值，确保不会丢失
							decrementPresets: importedSettings.decrementPresets || existingSettings.decrementPresets,
							// 保留任何其他特殊需要保持的设置
							layoutSettings: {
								...(existingSettings.layoutSettings || {}),
								...(importedSettings.layoutSettings || {})
							} as LayoutSettings
						};

						await Storage.set(key, JSON.stringify(mergedSettings));
					} else if (
						key === "brewingNotes" &&
						existingData &&
						importData.data[key]
					) {
						// 合并冲煮记录
						const existingNotes = Array.isArray(existingData)
							? (existingData as BrewingNote[])
							: [];
						const importedNotes = Array.isArray(
							importData.data[key]
						)
							? (importData.data[key] as BrewingNote[])
							: [];

						// 创建ID映射以避免重复
						const existingIds = new Set(
							existingNotes.map((note: BrewingNote) => note.id)
						);

						// 添加不重复的记录
						const newNotes = importedNotes.filter(
							(note: BrewingNote) => !existingIds.has(note.id)
						);

						// 为导入的记录生成新ID
						const notesWithNewIds = newNotes.map(
							(note: BrewingNote) => ({
								...note,
								id: `${Date.now()}-${Math.random()
									.toString(36)
									.substr(2, 9)}`,
							})
						);

						const mergedNotes = [
							...existingNotes,
							...notesWithNewIds,
						];

						// 按时间戳排序
						mergedNotes.sort(
							(a: BrewingNote, b: BrewingNote) =>
								b.timestamp - a.timestamp
						);

						await Storage.set(key, JSON.stringify(mergedNotes));
					} else if (key === "coffeeBeans") {
						// 合并咖啡豆数据
						const existingBeans = Array.isArray(existingData)
							? (existingData as CoffeeBean[])
							: [];
						const importedBeans = Array.isArray(
							importData.data[key]
						)
							? (importData.data[key] as CoffeeBean[])
							: [];

						// 创建ID映射以避免重复
						const existingIds = new Set(
							existingBeans.map((bean) => bean.id)
						);

						// 添加不重复的咖啡豆
						const newBeans = importedBeans.filter(
							(bean) => !existingIds.has(bean.id)
						);

						// 为导入的咖啡豆生成新ID
						const beansWithNewIds = newBeans.map((bean) => ({
							...bean,
							id: `${Date.now()}-${Math.random()
								.toString(36)
								.substr(2, 9)}`,
						}));

						const mergedBeans = [
							...existingBeans,
							...beansWithNewIds,
						];

						// 按时间戳排序（如果有）
						if (
							mergedBeans.length > 0 &&
							mergedBeans[0].timestamp
						) {
							mergedBeans.sort(
								(a, b) => b.timestamp - a.timestamp
							);
						}

						await Storage.set(key, JSON.stringify(mergedBeans));
					} else if (key === "brewingNotesVersion") {
						// 数据版本处理：保留较大的版本号
						if (existingData && importData.data[key]) {
							const existingVersion = Number(existingData);
							const importedVersion = Number(
								importData.data[key]
							);

							if (
								!isNaN(existingVersion) &&
								!isNaN(importedVersion)
							) {
								const newVersion = Math.max(
									existingVersion,
									importedVersion
								);
								await Storage.set(key, String(newVersion));
							} else {
								// 如果现有版本无效，使用导入的版本
								await Storage.set(
									key,
									String(importData.data[key])
								);
							}
						} else if (importData.data[key]) {
							// 如果不存在现有版本，使用导入的版本
							await Storage.set(
								key,
								String(importData.data[key])
							);
						}
					} else if (key === "customEquipments") {
						// 合并自定义器具
						const existingEquipments = existingData as Record<string, string[]>;
						const importedEquipments = importData.data[key] as Record<string, string[]>;

						const mergedEquipments = {
							...existingEquipments,
						};

						Object.keys(importedEquipments).forEach((equipment) => {
							if (!mergedEquipments[equipment]) {
								mergedEquipments[equipment] = [];
							}

							// 添加不重复的设备
							const equipmentList = importedEquipments[equipment] as string[];
							equipmentList.forEach((importedEquipment) => {
								if (!mergedEquipments[equipment].includes(importedEquipment)) {
									mergedEquipments[equipment].push(importedEquipment);
								}
							});
						});

						await Storage.set(key, JSON.stringify(mergedEquipments));
					} else if (key === "onboardingCompleted") {
						// 保留用户现有设置，不覆盖
						if (!existingData) {
							await Storage.set(
								key,
								typeof importData.data[key] === "object"
									? JSON.stringify(importData.data[key])
									: String(importData.data[key])
							);
						}
					} else {
						// 其他数据直接覆盖
						await Storage.set(
							key,
							typeof importData.data[key] === "object"
								? JSON.stringify(importData.data[key])
								: String(importData.data[key])
						);
					}
				}
			}

			// 合并自定义方案数据
			if (importData.data.customMethodsByEquipment && typeof importData.data.customMethodsByEquipment === 'object') {
				// 遍历所有器具的方案
				const customMethodsByEquipment = importData.data.customMethodsByEquipment as Record<string, Method[]>;
				for (const equipmentId of Object.keys(customMethodsByEquipment)) {
					const importedMethods = customMethodsByEquipment[equipmentId];
					
					// 读取现有的方案数据
					const storageKey = `customMethods_${equipmentId}`;
					const existingMethodsStr = await Storage.get(storageKey);
					let existingMethods: Method[] = [];
					
					try {
						if (existingMethodsStr) {
							existingMethods = JSON.parse(existingMethodsStr);
						}
					} catch {
						// 如果解析失败，使用空数组
						existingMethods = [];
					}
					
					// 合并方案：保留现有方案，添加不重复的导入方案
					const mergedMethods = [...existingMethods];
					
					// 遍历导入的方案
					for (const importedMethod of importedMethods) {
						// 检查是否存在同ID或同名方案
						const existsById = mergedMethods.some(m => m.id === importedMethod.id);
						const existsByName = mergedMethods.some(m => m.name === importedMethod.name);
						
						if (!existsById && !existsByName) {
							// 为新方案生成新ID，避免ID冲突
							const methodWithNewId = {
								...importedMethod,
								id: importedMethod.id || `method-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
							};
							mergedMethods.push(methodWithNewId);
						}
					}
					
					// 保存合并后的方案
					await Storage.set(storageKey, JSON.stringify(mergedMethods));
				}
			}

			return {
				success: true,
				message: `数据合并成功，导出日期: ${
					importData.exportDate
						? new Date(importData.exportDate).toLocaleString()
						: "未知"
				}`,
			};
		} catch (_error) {
			return {
				success: false,
				message: `合并数据失败: ${(_error as Error).message}`,
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
							percentage: 100,
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
							percentage: 100,
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
						// 确保percentage存在且在合理范围内
						if (typeof comp.percentage !== 'number' || comp.percentage < 1 || comp.percentage > 100) {
							comp.percentage = 100;
							fixedCount++;
						}
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
