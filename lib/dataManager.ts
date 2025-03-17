import { Storage } from "@/lib/storage";
import { Method } from "@/lib/config";

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
		} catch (error) {
			console.error("导出数据失败:", error);
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
		} catch (error) {
			console.error("导入数据失败:", error);
			return {
				success: false,
				message: `导入数据失败: ${(error as Error).message}`,
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
		} catch (error) {
			console.error("重置数据失败:", error);
			return {
				success: false,
				message: `重置数据失败: ${(error as Error).message}`,
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
		} catch (error) {
			console.error("合并数据失败:", error);
			return {
				success: false,
				message: `合并数据失败: ${(error as Error).message}`,
			};
		}
	},
};
