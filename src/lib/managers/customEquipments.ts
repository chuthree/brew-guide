import { type CustomEquipment, type Method } from "@/lib/core/config";
import { saveCustomMethod, loadCustomMethodsForEquipment } from "@/lib/managers/customMethods";
import { Storage } from "@/lib/core/storage";
import { db } from "@/lib/core/db";
// @ts-expect-error - keshi类型声明问题，目前仍在使用其默认导出
import Keshi from "keshi";

const STORAGE_KEY = "customEquipments";

// 创建Keshi缓存实例（高性能内存缓存）
const equipmentsCache = new Keshi();

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
 * 强制使缓存失效，允许外部组件在需要时调用
 */
export function invalidateEquipmentsCache(): void {
	equipmentsCache.delete("customEquipments");
}

/**
 * 从存储加载自定义器具
 * @returns 自定义器具数组
 */
export async function loadCustomEquipments(): Promise<CustomEquipment[]> {
	// 使用Keshi的resolve方法处理缓存逻辑
	// 第一个参数是缓存键，第二个参数是获取数据的函数，第三个参数是缓存时间（此处设为10分钟）
	return equipmentsCache.resolve(
		"customEquipments",
		async () => {
			try {
				// 首先尝试从IndexedDB加载数据
				const equipments = await db.customEquipments.toArray();
				
				if (equipments && equipments.length > 0) {
					return equipments;
				}
				
				// 如果IndexedDB中没有数据，尝试从localStorage/Preferences迁移
				const savedEquipments = await Storage.get(STORAGE_KEY);
				if (savedEquipments) {
					const parsedEquipments = JSON.parse(savedEquipments) as CustomEquipment[];
					
					// 将数据保存到IndexedDB
					if (parsedEquipments.length > 0) {
						await db.customEquipments.bulkPut(parsedEquipments);
						
						// 验证迁移
						const migratedCount = await db.customEquipments.count();
						if (migratedCount !== parsedEquipments.length) {
							console.warn(`[loadCustomEquipments] 迁移部分完成：应有${parsedEquipments.length}个，实际只有${migratedCount}个`);
						}
					}
					
					return parsedEquipments;
				}
				
				// 没有找到数据，返回空数组
				return [];
			} catch (error) {
				console.error('[loadCustomEquipments] 加载自定义器具失败:', error);
				throw new CustomEquipmentError("无法加载自定义器具", error);
			}
		},
		"10mins" // 缓存10分钟，防止频繁访问数据库
	);
}

/**
 * 生成唯一的自定义器具ID
 * @param animationType 动画类型
 * @returns 唯一ID
 */
function generateCustomId(animationType: string): string {
	return `custom-${animationType}-${Date.now()}-${Math.random()
		.toString(36)
		.substring(2, 9)}`;
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
		// 获取当前器具列表
		const equipments = await loadCustomEquipments();
		let oldEquipmentName: string | undefined;

		// 如果是更新现有器具
		if (equipment.id) {
			const existingIndex = equipments.findIndex(e => e.id === equipment.id);
			
			if (existingIndex >= 0) {
				// 记录旧的器具名称，用于检查名称是否变更
				oldEquipmentName = equipments[existingIndex].name;

				// 准备更新的器具数据
				const updatedEquipment = { 
					...equipment, 
					isCustom: true as const 
				};
				
				// 更新内存中数组的相应项
				equipments[existingIndex] = updatedEquipment;
				
				// 更新IndexedDB中的记录
				await db.customEquipments.put(updatedEquipment);
			} else {
				// 如果找不到对应ID的器具，但已有ID，保留原始ID
				const newEquipment = {
					...equipment,
					isCustom: true as const,
				};
				
				equipments.push(newEquipment);
				
				// 添加到IndexedDB
				await db.customEquipments.put(newEquipment);
			}
		} else {
			// 如果是新建器具，生成新的 ID
			const newId = generateCustomId(equipment.animationType);
			const newEquipment = {
				...equipment,
				id: newId,
				isCustom: true as const,
			};
			
			equipments.push(newEquipment);
			
			// 添加到IndexedDB
			await db.customEquipments.put(newEquipment);
			
			// 更新equipment变量的ID，以便后续保存方案时使用
			equipment.id = newId;
		}

		// 同时更新localStorage（作为备份，后期可移除）
		await Storage.set(STORAGE_KEY, JSON.stringify(equipments));

		// 使缓存失效，确保下次获取最新数据
		invalidateEquipmentsCache();

		// 检查器具名称是否变更
		if (equipment.id && oldEquipmentName && oldEquipmentName !== equipment.name) {
			// 尝试加载该器具的自定义方案
			try {
				const methodsForEquipment = await loadCustomMethodsForEquipment(equipment.id);
				if (methodsForEquipment.length > 0) {
					console.log(`[saveCustomEquipment] 器具 "${oldEquipmentName}" 重命名为 "${equipment.name}"，检测到 ${methodsForEquipment.length} 个方案，确保方案关联更新`);
					
					// 重新保存这些方案，确保它们与更新后的器具正确关联
					for (const method of methodsForEquipment) {
						await saveCustomMethod(equipment.id, method);
					}
				}
			} catch (error) {
				console.error('[saveCustomEquipment] 更新器具名称后迁移方案失败:', error);
			}
		}

		// 如果提供了新方案，则保存方案
		if (methods && methods.length > 0 && equipment.id) {
			console.log(`[saveCustomEquipment] 准备保存器具(${equipment.id})的${methods.length}个方案:`, methods.map(m => m.name));
			
			// 先检查现有方案，确保不会重复保存
			const existingMethods = await loadCustomMethodsForEquipment(equipment.id);
			console.log(`[saveCustomEquipment] 器具(${equipment.id})已有${existingMethods.length}个方案`);
			
			// 过滤出需要保存的新方案（不在现有方案中的）
			const methodsToSave = methods.filter(method => {
				const existingMethod = existingMethods.find(m => 
					(method.id && m.id === method.id) || // 按ID匹配
					(method.name && m.name === method.name) // 按名称匹配
				);
				return !existingMethod;
			});
			
			console.log(`[saveCustomEquipment] 需要保存${methodsToSave.length}个新方案`);
			
			// 保存新方案
			for (const method of methodsToSave) {
				console.log(`[saveCustomEquipment] 保存方案: ${method.name} 到器具 ${equipment.id}`);
				await saveCustomMethod(equipment.id, method);
			}
			
			console.log(`[saveCustomEquipment] 器具${equipment.id}的方案保存完成`);
		}
	} catch (error) {
		console.error('[saveCustomEquipment] 保存器具失败:', error);
		throw new CustomEquipmentError(
			`${equipment.id ? "更新" : "创建"}自定义器具失败: ${equipment.name}`,
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
		// 获取当前器具列表
		const equipments = await loadCustomEquipments();
		const index = equipments.findIndex(e => e.id === id);

		if (index === -1) {
			throw new CustomEquipmentError(`未找到ID为${id}的器具`);
		}

		// 准备更新的器具数据
		const updatedEquipment = { ...equipment, id, isCustom: true as const };
		
		// 更新内存中数组的相应项
		equipments[index] = updatedEquipment;

		// 更新IndexedDB
		await db.customEquipments.put(updatedEquipment);
		console.log(`[updateCustomEquipment] 更新了IndexedDB中的器具: ${id}`);
		
		// 同时更新localStorage作为备份
		await Storage.set(STORAGE_KEY, JSON.stringify(equipments));
		console.log(`[updateCustomEquipment] 同时更新了localStorage作为备份`);
		
		// 使缓存失效
		invalidateEquipmentsCache();
	} catch (error) {
		console.error('[updateCustomEquipment] 更新器具失败:', error);
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
		// 获取当前器具列表
		const equipments = await loadCustomEquipments();
		const equipment = equipments.find(e => e.id === id);

		if (!equipment) {
			throw new CustomEquipmentError(`未找到ID为${id}的器具`);
		}

		// 从数组中移除要删除的器具
		const filteredEquipments = equipments.filter(e => e.id !== id);
		
		// 从IndexedDB删除
		await db.customEquipments.delete(id);
		console.log(`[deleteCustomEquipment] 从IndexedDB删除了器具: ${id}`);
		
		// 同时更新localStorage作为备份
		await Storage.set(STORAGE_KEY, JSON.stringify(filteredEquipments));
		console.log(`[deleteCustomEquipment] 同时更新了localStorage作为备份`);
		
		// 使缓存失效
		invalidateEquipmentsCache();
		
		// 尝试清理相关方案
		try {
			// 检查是否有对应的方案数据
			const methodsKey = `customMethods_${id}`;
			await Storage.remove(methodsKey);
			console.log(`[deleteCustomEquipment] 尝试清理相关方案数据: ${methodsKey}`);
			
			// 从IndexedDB中删除方案
			await db.customMethods.delete(id);
			console.log(`[deleteCustomEquipment] 从IndexedDB删除了器具相关方案: ${id}`);
		} catch (methodError) {
			console.warn(`[deleteCustomEquipment] 清理器具相关方案失败:`, methodError);
			// 不阻止器具删除流程
		}
	} catch (error) {
		console.error('[deleteCustomEquipment] 删除器具失败:', error);
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
		return !equipments.some(e => e.name === name && e.id !== currentId);
	} catch (error) {
		throw new CustomEquipmentError(
			`验证器具名称是否可用失败: ${name}`,
			error
		);
	}
}

// 组件卸载时清理缓存，释放内存
export function teardownCache(): void {
    equipmentsCache.teardown();
}
