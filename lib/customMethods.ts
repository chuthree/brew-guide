import { type Method, type CustomEquipment } from "@/lib/config";
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
		const methodKeys = keys.filter((key) =>
			key.startsWith("customMethods_")
		);

		// Create result object
		const result: Record<string, Method[]> = {};

		// Load methods for each key
		for (const key of methodKeys) {
			// Extract equipment ID from key
			const equipmentId = key.replace("customMethods_", "");

			// Load methods for this equipment
			const methods = await loadCustomMethodsForEquipment(equipmentId);

			// Add to result if there are methods
			if (methods.length > 0) {
				result[equipmentId] = methods;
			}
		}

		return result;
	} catch (_error) {
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
export async function loadCustomMethodsForEquipment(
	equipmentId: string
): Promise<Method[]> {
	try {
		// 首先尝试从新存储加载
		const methodsJson = await Storage.get(`customMethods_${equipmentId}`);
		let methods: Method[] = [];

		if (methodsJson) {
			methods = JSON.parse(methodsJson);
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
					`customMethods_${equipmentId}`,
					JSON.stringify(methods)
				);

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
					id: `method-${uuidv4()}`,
				};
			}
			return method;
		});

		return methods;
	} catch (_error) {
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
				id: method.id || `method-${uuidv4()}`,
			};

			// 确保方法ID在保存前是唯一的

			// 更新或添加方法
			const updatedMethods = existingMethods.filter(
				(m) => m.id !== methodWithId.id
			);
			updatedMethods.push(methodWithId);

			// 去重并保存
			const uniqueMethods = removeDuplicateMethods(updatedMethods);
			await Storage.set(
				`customMethods_${equipmentId}`,
				JSON.stringify(uniqueMethods)
			);

			return true;
		} catch (_error) {
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
		await Storage.set(
			`customMethods_${selectedEquipment}`,
			JSON.stringify(uniqueMethods)
		);

		// 为了保持向后兼容，也更新内存中的customMethods对象
		const newCustomMethods = {
			...customMethods,
			[selectedEquipment]: uniqueMethods,
		};

		return { newCustomMethods, methodWithId };
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

			// Save updated methods
			await Storage.set(
				`customMethods_${equipmentId}`,
				JSON.stringify(updatedMethods)
			);
			return true;
		} catch (_error) {
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
		await Storage.set(
			`customMethods_${selectedEquipment}`,
			JSON.stringify(updatedMethods)
		);

		return newCustomMethods;
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
