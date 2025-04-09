import { type CustomEquipment, type Method } from "@/lib/config";
import { saveCustomMethod, loadCustomMethodsForEquipment } from "@/lib/customMethods";
import { Storage } from "@/lib/storage";

const STORAGE_KEY = "customEquipments";

/**
 * 自定义器具操作错误类型
 */
class CustomEquipmentError extends Error {
	constructor(message: string, public cause?: unknown) {
		super(message);
		this.name = "CustomEquipmentError";
	}
}

/**
 * 从存储加载自定义器具
 * @returns 自定义器具数组
 */
export async function loadCustomEquipments(): Promise<CustomEquipment[]> {
	try {
		const savedEquipments = await Storage.get(STORAGE_KEY);
		if (savedEquipments) {
			return JSON.parse(savedEquipments);
		}
	} catch (error) {
		throw new CustomEquipmentError("无法加载自定义器具", error);
	}
	return [];
}

/**
 * 生成唯一的自定义器具ID
 * @param animationType 动画类型
 * @returns 唯一ID
 */
function generateCustomId(animationType: string): string {
	return `custom-${animationType}-${Date.now()}-${Math.random()
		.toString(36)
		.substr(2, 9)}`;
}

/**
 * 保存自定义器具
 * @param equipment 要保存的器具
 * @param methods 可选的方案数组，如果提供则一并保存
 */
export async function saveCustomEquipment(
	equipment: CustomEquipment,
	methods?: Method[]
): Promise<void> {
	try {
		const equipments = await loadCustomEquipments();

		let updatedEquipments: CustomEquipment[];
		let oldEquipmentName: string | undefined;

		// 如果是更新现有器具
		if (equipment.id) {
			const existingEquipment = equipments.find(
				(e) => e.id === equipment.id
			);
			if (existingEquipment) {
				// 记录旧的器具名称，用于检查名称是否变更
				oldEquipmentName = existingEquipment.name;

				// 更新现有器具
				updatedEquipments = equipments.map((e) =>
					e.id === equipment.id
						? { ...equipment, isCustom: true as const }
						: e
				);
			} else {
				// 如果找不到对应ID的器具，但已有ID，保留原始ID
				// 不再生成新ID，以确保导入导出时方案关联不丢失
				const newEquipment = {
					...equipment,
					isCustom: true as const,
				};
				updatedEquipments = [...equipments, newEquipment];
				console.log(`导入具有ID的新器具: ${equipment.id}`);
			}
		} else {
			// 如果是新建器具，生成新的 ID
			const newId = generateCustomId(equipment.animationType);
			const newEquipment = {
				...equipment,
				id: newId,
				isCustom: true as const,
			};
			updatedEquipments = [...equipments, newEquipment];
		}

		await Storage.set(STORAGE_KEY, JSON.stringify(updatedEquipments));

		// 检查器具名称是否变更
		if (equipment.id && oldEquipmentName && oldEquipmentName !== equipment.name) {
			// 尝试加载该器具的自定义方案
			try {
				const methodsForEquipment = await loadCustomMethodsForEquipment(equipment.id);
				if (methodsForEquipment.length > 0) {
					console.log(`器具 "${oldEquipmentName}" 重命名为 "${equipment.name}"，检测到 ${methodsForEquipment.length} 个方案，确保方案关联更新`);
					
					// 重新保存这些方案，确保它们与更新后的器具正确关联
					for (const method of methodsForEquipment) {
						await saveCustomMethod(equipment.id, method);
					}
				}
			} catch (error) {
				console.error('更新器具名称后迁移方案失败:', error);
			}
		}

		// 如果提供了新方案，则保存方案
		if (methods && methods.length > 0 && equipment.id) {
			console.log(`准备保存器具(${equipment.id})的${methods.length}个方案:`, methods.map(m => m.name));
			
			// 先检查现有方案，确保不会重复保存
			const existingMethods = await loadCustomMethodsForEquipment(equipment.id);
			console.log(`器具(${equipment.id})已有${existingMethods.length}个方案`);
			
			// 过滤出需要保存的新方案（不在现有方案中的）
			const methodsToSave = methods.filter(method => {
				const existingMethod = existingMethods.find(m => 
					(method.id && m.id === method.id) || // 按ID匹配
					(method.name && m.name === method.name) // 按名称匹配
				);
				return !existingMethod;
			});
			
			console.log(`需要保存${methodsToSave.length}个新方案`);
			
			// 保存新方案
			for (const method of methodsToSave) {
				console.log(`保存方案: ${method.name} 到器具 ${equipment.id}`);
				await saveCustomMethod(equipment.id, method);
			}
			
			console.log(`器具${equipment.id}的方案保存完成`);
		} else {
			console.log(`没有方案需要保存，或者器具ID缺失:`, { 
				hasId: !!equipment.id, 
				id: equipment.id, 
				hasMethods: !!methods, 
				methodsCount: methods?.length 
			});
		}
	} catch (error) {
		throw new CustomEquipmentError(
			`${equipment.id ? "更新" : "创建"}自定义器具失败: ${
				equipment.name
			}`,
			error
		);
	}
}

/**
 * 更新自定义器具
 * @param id 器具ID
 * @param equipment 更新的器具数据
 */
export async function updateCustomEquipment(
	id: string,
	equipment: CustomEquipment
): Promise<void> {
	try {
		const equipments = await loadCustomEquipments();
		const index = equipments.findIndex((e) => e.id === id);

		if (index === -1) {
			throw new CustomEquipmentError(`未找到ID为${id}的器具`);
		}

		const updatedEquipments = [
			...equipments.slice(0, index),
			{ ...equipment, id, isCustom: true as const },
			...equipments.slice(index + 1),
		];

		await Storage.set(STORAGE_KEY, JSON.stringify(updatedEquipments));
	} catch (error) {
		throw new CustomEquipmentError(
			`更新自定义器具失败: ${equipment.name}`,
			error
		);
	}
}

/**
 * 删除自定义器具
 * @param id 要删除的器具ID
 */
export async function deleteCustomEquipment(id: string): Promise<void> {
	try {
		const equipments = await loadCustomEquipments();
		const equipment = equipments.find((e) => e.id === id);

		if (!equipment) {
			throw new CustomEquipmentError(`未找到ID为${id}的器具`);
		}

		const filteredEquipments = equipments.filter((e) => e.id !== id);
		await Storage.set(STORAGE_KEY, JSON.stringify(filteredEquipments));
	} catch (error) {
		throw new CustomEquipmentError(`删除自定义器具失败: ${id}`, error);
	}
}

/**
 * 验证器具名称是否可用
 * @param name 器具名称
 * @param currentId 当前器具ID（用于编辑时验证）
 * @returns 名称是否可用
 */
export async function isEquipmentNameAvailable(
	name: string,
	currentId?: string
): Promise<boolean> {
	try {
		const equipments = await loadCustomEquipments();
		return !equipments.some((e) => e.name === name && e.id !== currentId);
	} catch (error) {
		throw new CustomEquipmentError(
			`验证器具名称是否可用失败: ${name}`,
			error
		);
	}
}
