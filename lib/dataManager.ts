import { Storage } from "@/lib/storage";
import { Method } from "@/lib/config";
import { CoffeeBean } from "@/app/types";

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
				appVersion: process.env.NEXT_PUBLIC_APP_VERSION || "unknown",
				data: {},
			};

			// 获取所有数据
			for (const key of APP_DATA_KEYS) {
				const value = await Storage.get(key);
				if (value) {
					try {
						// 尝试解析JSON
						exportData.data[key] = JSON.parse(value);
					} catch {
						// 如果不是JSON，直接存储字符串
						exportData.data[key] = value;
					}
				}
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
	 * @returns 重置结果
	 */
	async resetAllData(): Promise<{ success: boolean; message: string }> {
		try {
			// 清除所有数据
			for (const key of APP_DATA_KEYS) {
				await Storage.remove(key);
			}

			return {
				success: true,
				message: "所有数据已重置",
			};
		} catch (_error) {
			return {
				success: false,
				message: `重置数据失败: ${(_error as Error).message}`,
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
					} else if (key === "brewGuideSettings") {
						// 保留用户现有设置，不覆盖
						if (!existingData) {
							await Storage.set(
								key,
								typeof importData.data[key] === "object"
									? JSON.stringify(importData.data[key])
									: String(importData.data[key])
							);
						}
					} else if (
						key === "coffeeBeans" &&
						existingData &&
						importData.data[key]
					) {
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
	 * 处理无效百分比和不合规的拼配成分数据
	 * @returns {Promise<{success: boolean, message: string, fixedCount: number}>} 修复结果
	 */
	async fixBlendBeansData(): Promise<{ success: boolean; message: string; fixedCount: number }> {
		try {
			// 获取所有咖啡豆数据
			const beansData = await Storage.get("coffeeBeans");
			if (!beansData) {
				return {
					success: true,
					message: "没有发现咖啡豆数据",
					fixedCount: 0
				};
			}

			let beans: CoffeeBean[] = [];
			try {
				beans = JSON.parse(beansData);
			} catch (_error) {
				return {
					success: false,
					message: "解析咖啡豆数据失败",
					fixedCount: 0
				};
			}

			let fixedCount = 0;
			let hasChanges = false;

			// 遍历所有咖啡豆，查找并修复问题
			const fixedBeans = beans.map(bean => {
				// 检查是否是拼配豆且有拼配成分
				if (bean.type === "拼配" && bean.blendComponents) {
					// 确保blendComponents是数组
					if (!Array.isArray(bean.blendComponents) || bean.blendComponents.length === 0) {
						// 创建默认拼配成分
						fixedCount++;
						hasChanges = true;
						return {
							...bean,
							blendComponents: [{
								percentage: 100,
								origin: bean.origin || "",
								process: bean.process || "",
								variety: bean.variety || ""
							}]
						};
					}
					
					// 检查是否有空百分比或非法数据的问题
					const hasInvalidData = bean.blendComponents.some(
						comp => {
							// 检查组件是否是有效对象
							if (!comp || typeof comp !== 'object') return true;
							
							// 处理字符串类型的百分比
							if (typeof comp.percentage === 'string') {
								return comp.percentage === "";
							}
							// 处理其他类型
							return comp.percentage === undefined || comp.percentage === null;
						}
					);

					if (hasInvalidData) {
						// 需要修复
						fixedCount++;
						hasChanges = true;

						// 过滤出有效成分，必须有percentage字段
						const validComponents = bean.blendComponents
							.filter(comp => 
								comp && typeof comp === "object" && 
								comp.percentage !== undefined && comp.percentage !== null && 
								comp.percentage !== ""
							)
							.map(comp => {
								// 确保percentage是数字
								return {
									...comp,
									percentage: typeof comp.percentage === 'string' 
										? parseFloat(comp.percentage) || 0 
										: comp.percentage
								};
							});

						if (validComponents.length > 0) {
							// 重新分配百分比，确保总和为100%
							const totalPercentage = validComponents.reduce(
								(sum, comp) => sum + (typeof comp.percentage === 'number' ? comp.percentage : 0), 
								0
							);
							
							// 如果总和不是100%，按比例调整
							if (Math.abs(totalPercentage - 100) > 0.1) { // 允许0.1%的误差
								const fixedComponents = validComponents.map((comp, index) => {
									if (totalPercentage > 0) {
										// 按比例调整
										const adjustedPercentage = Math.round((comp.percentage / totalPercentage) * 100 * 10) / 10;
										return {
											...comp,
											percentage: index === validComponents.length - 1 
												? 100 - validComponents.slice(0, -1).reduce((sum, c) => sum + c.percentage, 0) 
												: adjustedPercentage
										};
									} else {
										// 如果总和为0，平均分配
										const perComponent = Math.floor(100 / validComponents.length);
										const remainder = 100 - (perComponent * validComponents.length);
										
										return {
											...comp,
											percentage: index === validComponents.length - 1 
												? perComponent + remainder 
												: perComponent
										};
									}
								});
								
								return {
									...bean,
									blendComponents: fixedComponents
								};
							}
							
							// 总和接近100%，使用有效组件
							return {
								...bean,
								blendComponents: validComponents
							};
						} else if (bean.origin) {
							// 如果没有有效成分但有产地信息，创建一个默认成分
							return {
								...bean,
								blendComponents: [{
									percentage: 100,
									origin: bean.origin || "",
									process: bean.process || "",
									variety: bean.variety || ""
								}]
							};
						} else {
							// 无法修复的情况，移除blendComponents
							const { blendComponents: _unusedBlendComponents, ...restBean } = bean;
							return {
								...restBean,
								type: "单品" // 改为单品
							};
						}
					}
				} else if (bean.type !== "拼配" && bean.blendComponents) {
					// 非拼配豆不应该有blendComponents，移除它
					fixedCount++;
					hasChanges = true;
					const { blendComponents: _unusedBlendComponents, ...restBean } = bean;
					return restBean;
				}
				
				// 没有问题或不是拼配豆，返回原样
				return bean;
			});

			// 如果有变更，保存修复后的数据
			if (hasChanges) {
				await Storage.set("coffeeBeans", JSON.stringify(fixedBeans));
				return {
					success: true,
					message: `成功修复了${fixedCount}个拼配豆数据`,
					fixedCount
				};
			}

			return {
				success: true,
				message: "未发现需要修复的拼配豆数据",
				fixedCount: 0
			};
		} catch (error) {
			return {
				success: false,
				message: `修复拼配豆数据失败: ${(error as Error).message}`,
				fixedCount: 0
			};
		}
	},
};
