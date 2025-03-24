import { type Method } from "@/lib/config";
import { methodToJson } from "@/lib/jsonUtils";
import { Storage } from "@/lib/storage";

/**
 * 从存储加载自定义方案
 * @returns 自定义方案对象
 */
export async function loadCustomMethods(): Promise<Record<string, Method[]>> {
	try {
		const savedMethods = await Storage.get("customMethods");
		if (savedMethods) {
			const parsedMethods = JSON.parse(savedMethods);

			// 确保所有方法都有唯一ID
			const methodsWithIds: Record<string, Method[]> = {};

			Object.keys(parsedMethods).forEach((equipment) => {
				// 检查 parsedMethods[equipment] 是否为数组
				if (Array.isArray(parsedMethods[equipment])) {
					methodsWithIds[equipment] = parsedMethods[equipment].map(
						(method: Method) => ({
							...method,
							id:
								method.id ||
								`${Date.now()}-${Math.random()
									.toString(36)
									.substr(2, 9)}`,
						})
					);
				} else {
					// 如果不是数组，初始化为空数组
					methodsWithIds[equipment] = [];
				}
			});

			// 更新存储
			await Storage.set("customMethods", JSON.stringify(methodsWithIds));

			return methodsWithIds;
		}
	} catch {
		// 错误处理
	}

	return {};
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
 * 保存自定义方案
 * @param method 方案对象
 * @param selectedEquipment 选中的设备
 * @param customMethods 当前的自定义方案
 * @param editingMethod 正在编辑的方案（如果有）
 * @returns 更新后的自定义方案对象和新方案
 */
export async function saveCustomMethod(
	method: Method,
	selectedEquipment: string | null,
	customMethods: Record<string, Method[]>,
	editingMethod?: Method
): Promise<{
	newCustomMethods: Record<string, Method[]>;
	methodWithId: Method;
}> {
	if (!selectedEquipment) {
		throw new Error("未选择设备");
	}

	// 保留原始ID（如果存在），否则生成新ID
	const methodWithId = {
		...method,
		id:
			method.id ||
			`${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
	};

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
		// 创建模式：添加新方法
		updatedMethods.push(methodWithId);
	}

	const newCustomMethods = {
		...customMethods,
		[selectedEquipment]: updatedMethods,
	};

	// 保存到存储
	await Storage.set("customMethods", JSON.stringify(newCustomMethods));

	return { newCustomMethods, methodWithId };
}

/**
 * 删除自定义方案
 * @param method 要删除的方案
 * @param selectedEquipment 选中的设备
 * @param customMethods 当前的自定义方案
 * @returns 更新后的自定义方案对象
 */
export async function deleteCustomMethod(
	method: Method,
	selectedEquipment: string | null,
	customMethods: Record<string, Method[]>
): Promise<Record<string, Method[]>> {
	if (!selectedEquipment) {
		throw new Error("未选择设备");
	}

	const newCustomMethods = {
		...customMethods,
		[selectedEquipment]: customMethods[selectedEquipment].filter(
			(m) => m.id !== method.id
		),
	};

	// 保存到存储
	await Storage.set("customMethods", JSON.stringify(newCustomMethods));

	return newCustomMethods;
}

/**
 * 复制方案到剪贴板
 * @param method 要复制的方案
 * @returns Promise<boolean> 是否复制成功
 */
export async function copyMethodToClipboard(method: Method): Promise<boolean> {
	try {
		const jsonString = methodToJson(method);

		// 兼容性更好的复制文本方法
		if (navigator.clipboard && navigator.clipboard.writeText) {
			await navigator.clipboard.writeText(jsonString);
			return true;
		}

		// 回退方法：创建临时textarea元素
		const textArea = document.createElement("textarea");
		textArea.value = jsonString;

		// 设置样式使其不可见
		textArea.style.position = "fixed";
		textArea.style.left = "-999999px";
		textArea.style.top = "-999999px";
		document.body.appendChild(textArea);

		// 选择文本并复制
		textArea.focus();
		textArea.select();

		const successful = document.execCommand("copy");
		document.body.removeChild(textArea);

		return successful;
	} catch {
		return false;
	}
}
