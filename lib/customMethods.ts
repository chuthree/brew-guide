import { type Method } from "@/lib/config";
import { methodToReadableText } from "@/lib/jsonUtils";
import { Storage } from "@/lib/storage";
import { v4 as uuidv4 } from "uuid";

/**
 * 从存储加载自定义方案
 * @returns 自定义方案对象
 */
export async function loadCustomMethods(): Promise<Record<string, Method[]>> {
	try {
		// Get all keys from storage
		const keys = await Storage.keys();
		
		// Filter keys for custom methods
		const methodKeys = keys.filter(key => key.startsWith('customMethods_'));
		
		// Create result object
		const result: Record<string, Method[]> = {};
		
		// Load methods for each key
		for (const key of methodKeys) {
			// Extract equipment ID from key
			const equipmentId = key.replace('customMethods_', '');
			
			// Load methods for this equipment
			const methods = await loadCustomMethodsForEquipment(equipmentId);
			
			// Add to result
			result[equipmentId] = methods;
		}
		
		// Also load methods from the legacy storage
		try {
			const legacyMethods = await Storage.get("customMethods");
			if (legacyMethods) {
				const parsedLegacyMethods = JSON.parse(legacyMethods);
				// Merge with result
				for (const equipmentId in parsedLegacyMethods) {
					if (result[equipmentId]) {
						result[equipmentId] = [...result[equipmentId], ...parsedLegacyMethods[equipmentId]];
					} else {
						result[equipmentId] = parsedLegacyMethods[equipmentId];
					}
				}
			}
		} catch (error) {
			console.error('Error loading legacy custom methods:', error);
		}
		
		return result;
	} catch (error) {
		console.error('Error loading all custom methods:', error);
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
	} catch {
		// 错误处理
	}

	return {};
}

/**
 * 加载特定设备的自定义方案
 * @param equipmentId 设备ID
 * @returns 自定义方案数组
 */
export async function loadCustomMethodsForEquipment(equipmentId: string): Promise<Method[]> {
	try {
		// Load methods from per-equipment storage
		const methodsJson = await Storage.get(`customMethods_${equipmentId}`);
		let methods: Method[] = [];
		
		// If methods found, parse them
		if (methodsJson) {
			methods = JSON.parse(methodsJson);
		}
		
		// Also check legacy storage
		const legacyMethodsJson = await Storage.get("customMethods");
		if (legacyMethodsJson) {
			const legacyMethods = JSON.parse(legacyMethodsJson);
			if (legacyMethods[equipmentId] && Array.isArray(legacyMethods[equipmentId])) {
				// Merge with methods from per-equipment storage
				methods = [...methods, ...legacyMethods[equipmentId]];
			}
		}
		
		// 去重复 - 先使用自定义的去重函数
		methods = removeDuplicateMethods(methods);
		
		console.log(`[customMethods] 加载设备 ${equipmentId} 的方法: ${methods.length}个, 去重后`);
		
		// Ensure all methods have IDs
		return methods.map((method: Method) => {
			// 检查是否已经有ID
			if (method.id) {
				return method;
			}
			
			// 为每个方法生成唯一ID，使用UUID
			return {
				...method,
				id: `method-${uuidv4()}`
			};
		});
	} catch (error) {
		console.error('Error loading custom methods for equipment:', error);
		return [];
	}
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
): Promise<boolean | { newCustomMethods: Record<string, Method[]>; methodWithId: Method }> {
	// Check which calling pattern is used
	if (typeof arg1 === 'string') {
		// New pattern: saveCustomMethod(equipmentId, method)
		const equipmentId = arg1;
		const method = arg2 as Method;
		
		try {
			// Load existing methods for this equipment
			const existingMethods = await loadCustomMethodsForEquipment(equipmentId);
			
			// Check if we're updating an existing method
			const existingIndex = existingMethods.findIndex(m => m.id === method.id);
			
			// Ensure method has an ID
			const methodWithId = {
				...method,
				id: method.id || `method-${uuidv4()}`
			};
			
			// 确保方法ID在保存前是唯一的
			console.log(`[customMethods] 保存方法 ${methodWithId.name}, ID: ${methodWithId.id}`);
			
			if (existingIndex >= 0) {
				// Update existing method
				existingMethods[existingIndex] = methodWithId;
			} else {
				// Add new method - 检查是否已经存在同名同ID的方法
				const duplicateMethod = existingMethods.find(m => 
					m.id === methodWithId.id || 
					(m.name === methodWithId.name && !method.id) // 如果是新方法（没有id）且名称相同，也视为重复
				);
				
				if (duplicateMethod) {
					console.warn(`[customMethods] 检测到重复方法，跳过保存: ${methodWithId.name}`);
					// 返回方法，但不实际添加到列表中
					return true;
				}
				
				// 正常添加新方法
				existingMethods.push(methodWithId);
			}
			
			// 去重复后保存
			const uniqueMethods = removeDuplicateMethods(existingMethods);
			if (uniqueMethods.length < existingMethods.length) {
				console.warn(`[customMethods] 在保存前移除了 ${existingMethods.length - uniqueMethods.length} 个重复方法`);
			}
			
			// Save updated methods
			await Storage.set(`customMethods_${equipmentId}`, JSON.stringify(uniqueMethods));
			return true;
		} catch (error) {
			console.error('Error saving custom method:', error);
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
		
		console.log(`[customMethods] 保存方法(旧模式) ${methodWithId.name}, ID: ${methodWithId.id}`);

		// 检查是否是编辑模式
		const isEditing = editingMethod !== undefined;

		// 创建新的自定义方法列表
		let updatedMethods = [...(customMethods[selectedEquipment] || [])];

		if (isEditing) {
			// 编辑模式：移除旧方法，添加新方法
			updatedMethods = updatedMethods.filter(
				(m) => m.id !== editingMethod?.id
			);
			updatedMethods.push(methodWithId);
		} else {
			// 创建模式：检查是否存在重复方法
			const duplicateMethod = updatedMethods.find(m => 
				m.id === methodWithId.id || 
				(m.name === methodWithId.name) // 名称相同也视为重复
			);
			
			if (duplicateMethod) {
				console.warn(`[customMethods] 检测到重复方法，跳过保存: ${methodWithId.name}`);
				// 返回方法信息，但不添加到列表
				return { 
					newCustomMethods: customMethods, 
					methodWithId 
				};
			}
			
			// 正常添加新方法
			updatedMethods.push(methodWithId);
		}
		
		// 创建前去重
		updatedMethods = removeDuplicateMethods(updatedMethods);

		const newCustomMethods = {
			...customMethods,
			[selectedEquipment]: updatedMethods,
		};

		// 保存到存储
		await Storage.set("customMethods", JSON.stringify(newCustomMethods));
		
		// 为了防止数据重复，先加载当前数据再合并保存
		try {
			const existingMethods = await loadCustomMethodsForEquipment(selectedEquipment);
			// 合并并去重
			const combinedMethods = removeDuplicateMethods([...existingMethods, ...updatedMethods]);
			
			// 保存合并后的数据
			await Storage.set(`customMethods_${selectedEquipment}`, JSON.stringify(combinedMethods));
		} catch (error) {
			console.error('Error merging methods:', error);
		}

		return { newCustomMethods, methodWithId };
	}
}

// 辅助函数：移除重复方法
function removeDuplicateMethods(methods: Method[]): Method[] {
	const seen = new Map<string, Method>();
	const seenNames = new Map<string, Method>();
	
	// 先处理有ID的方法
	methods.forEach(method => {
		if (method.id) {
			seen.set(method.id, method);
		}
	});
	
	// 再处理没有ID但有名称的方法
	methods.forEach(method => {
		if (!method.id && method.name && !seenNames.has(method.name)) {
			seenNames.set(method.name, method);
		}
	});
	
	// 使用Array.from处理Map值
	return [...Array.from(seen.values()), ...Array.from(seenNames.values())];
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
	if (typeof arg1 === 'string' && typeof arg3 === 'string') {
		// New pattern: deleteCustomMethod(equipmentId, methodId)
		const equipmentId = arg1;
		const methodId = arg3;
		
		try {
			// Load existing methods
			const existingMethods = await loadCustomMethodsForEquipment(equipmentId);
			
			// Filter out the method to delete
			const updatedMethods = existingMethods.filter(method => method.id !== methodId);
			
			// If no methods were removed, return false
			if (updatedMethods.length === existingMethods.length) {
				return false;
			}
			
			// Save updated methods
			await Storage.set(`customMethods_${equipmentId}`, JSON.stringify(updatedMethods));
			return true;
		} catch (error) {
			console.error('Error deleting custom method:', error);
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

		// 保存到存储
		await Storage.set("customMethods", JSON.stringify(newCustomMethods));
		
		// Also save to per-equipment storage for compatibility with new pattern
		await Storage.set(`customMethods_${selectedEquipment}`, JSON.stringify(updatedMethods));

		return newCustomMethods;
	}
}

/**
 * 复制冲煮方案到剪贴板
 * @param method 冲煮方案对象
 */
export async function copyMethodToClipboard(method: Method) {
	try {
		// 使用新的自然语言格式
		const text = methodToReadableText(method);

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
		console.error("复制失败:", err);
		throw err;
	}
}
