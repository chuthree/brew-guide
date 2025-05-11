import { type Method, type CustomEquipment } from "@/lib/core/config";
import { methodToReadableText } from "@/lib/utils/jsonUtils";
import { Storage } from "@/lib/core/storage";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/lib/core/db";

/**
 * 从存储加载自定义方案
 * @returns 自定义方案对象
 */
export async function loadCustomMethods(): Promise<Record<string, Method[]>> {
	try {
		// 尝试从IndexedDB加载自定义方案
		const methodsFromDB = await db.customMethods.toArray();
		
		if (methodsFromDB && methodsFromDB.length > 0) {
			// 将数组转换为记录格式
			const result: Record<string, Method[]> = {};
			for (const item of methodsFromDB) {
				result[item.equipmentId] = item.methods;
			}
			return result;
		}
		
		// 如果IndexedDB中没有数据，尝试从localStorage/Preferences迁移
		// Get all keys from storage
		const keys = await Storage.keys();

		// Filter keys for custom methods
		const methodKeys = keys.filter((key) =>
			key.startsWith("customMethods_")
		);
		
		if (methodKeys.length === 0) {
			return {};
		}
		
		// Create result object
		const result: Record<string, Method[]> = {};

		// Load methods for each key and migrate to IndexedDB
		for (const key of methodKeys) {
			// Extract equipment ID from key
			const equipmentId = key.replace("customMethods_", "");

			// Load methods for this equipment
			const methods = await loadCustomMethodsForEquipment(equipmentId);

			// Add to result if there are methods
			if (methods.length > 0) {
				result[equipmentId] = methods;
				
				// 保存到IndexedDB
				await db.customMethods.put({
					equipmentId,
					methods
				});
			}
		}

		return result;
	} catch (_error) {
		console.error(`加载自定义方案失败:`, _error);
		return {};
	}
}

/**
 * 同步从存储加载自定义方案（用于初始化）
 * @returns 自定义方案对象
 */
export function loadCustomMethodsSync(): Record<string, Method[]> {
	try {
		const savedMethods = Storage.getSync("customMethods");
		if (savedMethods) {
			return JSON.parse(savedMethods);
		}
	} catch (e) {
		console.error(`同步加载方案失败:`, e);
	}

	return {};
}

/**
 * 加载特定设备的自定义方案
 * @param equipmentId 设备ID
 * @returns 自定义方案数组
 */
export async function loadCustomMethodsForEquipment(
	equipmentId: string
): Promise<Method[]> {
	try {
		// 首先尝试从IndexedDB加载
		const methodData = await db.customMethods.get(equipmentId);
		if (methodData && Array.isArray(methodData.methods) && methodData.methods.length > 0) {
			return methodData.methods;
		}
		
		// 如果IndexedDB中没有数据，尝试从旧存储加载
		const storageKey = `customMethods_${equipmentId}`;
		const methodsJson = await Storage.get(storageKey);
		let methods: Method[] = [];

		if (methodsJson) {
			methods = JSON.parse(methodsJson);
			
			// 如果从旧存储加载到了数据，保存到IndexedDB
			if (methods.length > 0) {
				await db.customMethods.put({
					equipmentId,
					methods
				});
			}
		}

		// 检查旧存储并进行迁移
		const legacyMethodsJson = await Storage.get("customMethods");
		if (legacyMethodsJson) {
			const legacyMethods = JSON.parse(legacyMethodsJson);
			if (
				legacyMethods[equipmentId] &&
				Array.isArray(legacyMethods[equipmentId])
			) {
				// 合并旧数据
				const combinedMethods = [
					...methods,
					...legacyMethods[equipmentId],
				];

				// 去重
				methods = removeDuplicateMethods(combinedMethods);

				// 保存到新存储
				await Storage.set(
					storageKey,
					JSON.stringify(methods)
				);
				
				// 保存到IndexedDB
				await db.customMethods.put({
					equipmentId,
					methods
				});

				// 从旧存储中移除这个设备的数据
				delete legacyMethods[equipmentId];
				if (Object.keys(legacyMethods).length > 0) {
					await Storage.set(
						"customMethods",
						JSON.stringify(legacyMethods)
					);
				} else {
					// 如果旧存储已经没有数据了，直接删除它
					await Storage.remove("customMethods");
				}
			}
		}

		// 确保所有方法都有ID
		methods = methods.map((method: Method) => {
			if (!method.id) {
				return {
					...method,
					id: `method-${Date.now()}`,
				};
			}
			return method;
		});

		return methods;
	} catch (error) {
		console.error(`加载方案失败:`, error);
		return [];
	}
}

/**
 * 辅助函数：移除重复方法
 * @param methods 方法数组
 * @returns 去重后的方法数组
 */
function removeDuplicateMethods(methods: Method[]): Method[] {
	const seen = new Map<string, Method>();

	// 按照ID和名称进行去重，优先保留有ID的方法
	methods.forEach((method) => {
		const key = method.id || method.name;
		if (!seen.has(key) || method.id) {
			seen.set(key, method);
		}
	});

	return Array.from(seen.values());
}

/**
 * 保存自定义方案
 * 支持两种调用模式:
 * 1. 旧的模式: saveCustomMethod(method, selectedEquipment, customMethods, editingMethod)
 * 2. 新的模式: saveCustomMethod(equipmentId, method)
 * @returns 更新结果
 */
export async function saveCustomMethod(
	arg1: Method | string,
	arg2: string | null | Method,
	arg3?: Record<string, Method[]>,
	editingMethod?: Method
): Promise<
	| boolean
	| { newCustomMethods: Record<string, Method[]>; methodWithId: Method }
> {
	// Check which calling pattern is used
	if (typeof arg1 === "string") {
		// New pattern: saveCustomMethod(equipmentId, method)
		const equipmentId = arg1;
		const method = arg2 as Method;

		try {
			// Load existing methods for this equipment
			const existingMethods = await loadCustomMethodsForEquipment(
				equipmentId
			);

			// Ensure method has an ID
			const methodWithId = {
				...method,
				id: method.id || `method-${Date.now()}`,
			};

			// 更新或添加方法
			const updatedMethods = existingMethods.filter(
				(m) => m.id !== methodWithId.id
			);
			updatedMethods.push(methodWithId);

			// 去重并保存
			const uniqueMethods = removeDuplicateMethods(updatedMethods);
			
			// 保存到IndexedDB
			await db.customMethods.put({
				equipmentId,
				methods: uniqueMethods
			});
			
			// 同时保存到旧存储作为备份
			const storageKey = `customMethods_${equipmentId}`;
			await Storage.set(
				storageKey,
				JSON.stringify(uniqueMethods)
			);

			return true;
		} catch (_error) {
			console.error(`[saveCustomMethod] 保存方案失败:`, _error);
			return false;
		}
	} else {
		// Old pattern: saveCustomMethod(method, selectedEquipment, customMethods, editingMethod)
		const method = arg1 as Method;
		const selectedEquipment = arg2 as string | null;
		const customMethods = arg3 as Record<string, Method[]>;

		if (!selectedEquipment) {
			throw new Error("未选择设备");
		}

		// 保留原始ID（如果存在），否则生成新ID
		const methodWithId = {
			...method,
			id: method.id || `method-${uuidv4()}`,
		};

		// 加载现有方法
		const existingMethods = await loadCustomMethodsForEquipment(
			selectedEquipment
		);

		// 更新或添加方法
		const updatedMethods = existingMethods.filter(
			(m) =>
				m.id !== methodWithId.id &&
				(editingMethod ? m.id !== editingMethod.id : true)
		);
		updatedMethods.push(methodWithId);

		// 去重并保存
		const uniqueMethods = removeDuplicateMethods(updatedMethods);
		
		// 保存到旧格式存储
		await Storage.set(
			`customMethods_${selectedEquipment}`,
			JSON.stringify(uniqueMethods)
		);
		
		// 同时保存到IndexedDB
		console.log(`[saveCustomMethod-旧API] 保存方案到IndexedDB, 器具ID: ${selectedEquipment}, 方案数量: ${uniqueMethods.length}`);
		await db.customMethods.put({
			equipmentId: selectedEquipment,
			methods: uniqueMethods
		});

		// 为了保持向后兼容，也更新内存中的customMethods对象
		const newCustomMethods = {
			...customMethods,
			[selectedEquipment]: uniqueMethods,
		};
		
		// 重新加载所有方案数据
		try {
			const allMethods = await loadCustomMethods();
			return { 
				newCustomMethods: allMethods, 
				methodWithId 
			};
		} catch (error) {
			return { newCustomMethods, methodWithId };
		}
	}
}

/**
 * 删除自定义方案
 * 支持两种调用模式:
 * 1. 旧的模式: deleteCustomMethod(method, selectedEquipment, customMethods)
 * 2. 新的模式: deleteCustomMethod(equipmentId, methodId)
 * @returns 更新结果
 */
export async function deleteCustomMethod(
	arg1: Method | string,
	arg2: string | null,
	arg3?: Record<string, Method[]> | string
): Promise<boolean | Record<string, Method[]>> {
	// Check which calling pattern is used
	if (typeof arg1 === "string" && typeof arg3 === "string") {
		// New pattern: deleteCustomMethod(equipmentId, methodId)
		const equipmentId = arg1;
		const methodId = arg3;

		try {
			// Load existing methods
			const existingMethods = await loadCustomMethodsForEquipment(
				equipmentId
			);

			// Filter out the method to delete
			const updatedMethods = existingMethods.filter(
				(method) => method.id !== methodId
			);

			// If no methods were removed, return false
			if (updatedMethods.length === existingMethods.length) {
				return false;
			}

			console.log(`[deleteCustomMethod] 删除方案, 设备ID: ${equipmentId}, 方案ID: ${methodId}, 剩余方案数: ${updatedMethods.length}`);
			
			// 保存到IndexedDB
			await db.customMethods.put({
				equipmentId,
				methods: updatedMethods
			});
			
			// 同时更新localStorage
			await Storage.set(
				`customMethods_${equipmentId}`,
				JSON.stringify(updatedMethods)
			);
			
			return true;
		} catch (_error) {
			console.error(`[deleteCustomMethod] 删除方案失败:`, _error);
			return false;
		}
	} else {
		// Old pattern: deleteCustomMethod(method, selectedEquipment, customMethods)
		const method = arg1 as Method;
		const selectedEquipment = arg2 as string | null;
		const customMethods = arg3 as Record<string, Method[]>;

		if (!selectedEquipment) {
			throw new Error("未选择设备");
		}

		const updatedMethods = customMethods[selectedEquipment].filter(
			(m) => m.id !== method.id
		);

		const newCustomMethods = {
			...customMethods,
			[selectedEquipment]: updatedMethods,
		};

		// 保存到localStorage
		await Storage.set(
			`customMethods_${selectedEquipment}`,
			JSON.stringify(updatedMethods)
		);
		
		// 同时保存到IndexedDB
		await db.customMethods.put({
			equipmentId: selectedEquipment,
			methods: updatedMethods
		});
		
		// 重新加载所有方案数据
		try {
			const allMethods = await loadCustomMethods();
			return allMethods;
		} catch (error) {
			return newCustomMethods;
		}
	}
}

/**
 * 复制冲煮方案到剪贴板
 * @param method 冲煮方案对象
 * @param customEquipment 自定义器具配置（可选）
 */
export async function copyMethodToClipboard(
	method: Method,
	customEquipment?: CustomEquipment
) {
	try {
		// 使用新的自然语言格式
		const text = methodToReadableText(method, customEquipment);

		// 尝试使用现代API
		if (navigator.clipboard && window.isSecureContext) {
			await navigator.clipboard.writeText(text);
		} else {
			// 降级方案
			const textarea = document.createElement("textarea");
			textarea.value = text;
			document.body.appendChild(textarea);
			textarea.select();
			document.execCommand("copy");
			document.body.removeChild(textarea);
		}
	} catch (err) {
		throw err;
	}
}

/**
 * 修复现有方案与器具的关联问题
 * 针对更新前已有数据的用户，自动检查并修复方案关联
 */
export async function repairMethodsAssociation(): Promise<void> {
	try {
		console.log('[数据修复] 开始检查方案与器具关联...');
		
		// 获取所有存储键
		const keys = await Storage.keys();
		
		// 获取所有自定义器具
		const customEquipmentsStr = await Storage.get('customEquipments');
		if (!customEquipmentsStr) {
			console.log('[数据修复] 没有找到自定义器具数据');
			return;
		}
		
		const customEquipments: CustomEquipment[] = JSON.parse(customEquipmentsStr);
		console.log(`[数据修复] 找到${customEquipments.length}个自定义器具`);
		
		// 查找老格式的方案存储
		const legacyMethodsKey = keys.find(key => key === 'customMethods');
		if (legacyMethodsKey) {
			console.log('[数据修复] 找到旧格式方案存储，开始迁移...');
			const legacyMethodsStr = await Storage.get('customMethods');
			if (legacyMethodsStr) {
				const legacyMethods = JSON.parse(legacyMethodsStr);
				
				// 遍历所有设备ID
				for (const equipmentId in legacyMethods) {
					const methods = legacyMethods[equipmentId];
					if (Array.isArray(methods) && methods.length > 0) {
						// 检查该ID是否在当前器具列表中
						const equipment = customEquipments.find((e: CustomEquipment) => e.id === equipmentId);
						
						if (equipment) {
							console.log(`[数据修复] 为器具 ${equipment.name}(${equipmentId}) 迁移${methods.length}个方案`);
							
							// 保存方案到新格式
							const storageKey = `customMethods_${equipmentId}`;
							await Storage.set(storageKey, JSON.stringify(methods));
							
							// 如果器具名称与ID不一致，也为名称创建一个副本
							const equipmentByName = customEquipments.find((e: CustomEquipment) => e.name === equipmentId);
							if (equipmentByName && equipmentByName.id !== equipmentId) {
								console.log(`[数据修复] 同时为名称匹配的器具 ${equipmentByName.name}(${equipmentByName.id}) 创建方案副本`);
								const nameKey = `customMethods_${equipmentByName.id}`;
								await Storage.set(nameKey, JSON.stringify(methods));
							}
						} else {
							// 尝试通过名称查找设备
							const equipmentByName = customEquipments.find((e: CustomEquipment) => e.name === equipmentId);
							if (equipmentByName) {
								console.log(`[数据修复] 通过名称找到器具 ${equipmentByName.name}(${equipmentByName.id})，迁移${methods.length}个方案`);
								
								// 保存方案到新格式
								const storageKey = `customMethods_${equipmentByName.id}`;
								await Storage.set(storageKey, JSON.stringify(methods));
							} else {
								console.log(`[数据修复] 找不到对应器具: ${equipmentId}`);
							}
						}
					}
				}
				
				// 迁移完成后，可以考虑删除旧格式数据
				// await Storage.remove('customMethods');
				console.log('[数据修复] 旧格式方案迁移完成');
			}
		}
		
		// 检查所有方案存储是否都有对应的器具
		const methodKeys = keys.filter(key => key.startsWith('customMethods_'));
		for (const methodKey of methodKeys) {
			const equipmentId = methodKey.replace('customMethods_', '');
			
			// 检查该ID是否在当前器具列表中
			const equipment = customEquipments.find((e: CustomEquipment) => e.id === equipmentId);
			if (!equipment) {
				console.log(`[数据修复] 方案存储 ${methodKey} 没有找到对应的器具ID: ${equipmentId}`);
				
				// 尝试通过名称查找设备
				const equipmentByName = customEquipments.find((e: CustomEquipment) => e.name === equipmentId);
				if (equipmentByName) {
					console.log(`[数据修复] 但找到了名称匹配的器具: ${equipmentByName.name}(${equipmentByName.id}), 进行方案复制`);
					
					// 读取原方案数据
					const methodsStr = await Storage.get(methodKey);
					if (methodsStr) {
						// 创建新的方案存储
						const newKey = `customMethods_${equipmentByName.id}`;
						await Storage.set(newKey, methodsStr);
						console.log(`[数据修复] 已将方案复制到: ${newKey}`);
					}
				}
			}
		}
		
		console.log('[数据修复] 方案与器具关联检查修复完成');
	} catch (error) {
		console.error('[数据修复] 出错:', error);
	}
}
