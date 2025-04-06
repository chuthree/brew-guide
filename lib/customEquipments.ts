import { type CustomEquipment } from "@/lib/config";
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
        console.error("加载自定义器具失败:", error);
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
    return `custom-${animationType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 保存自定义器具
 * @param equipment 要保存的器具
 */
export async function saveCustomEquipment(equipment: CustomEquipment): Promise<void> {
    try {
        const equipments = await loadCustomEquipments();
        
        let updatedEquipments: CustomEquipment[];
        
        // 如果是更新现有器具
        if (equipment.id) {
            const existingEquipment = equipments.find(e => e.id === equipment.id);
            if (existingEquipment) {
                // 更新现有器具
                updatedEquipments = equipments.map(e => 
                    e.id === equipment.id ? { ...equipment, isCustom: true as const } : e
                );
            } else {
                // 如果找不到对应ID的器具，视为新建器具
                const newId = generateCustomId(equipment.animationType);
                const newEquipment = {
                    ...equipment,
                    id: newId,
                    isCustom: true as const
                };
                updatedEquipments = [...equipments, newEquipment];
            }
        } else {
            // 如果是新建器具，生成新的 ID
            const newId = generateCustomId(equipment.animationType);
            const newEquipment = {
                ...equipment,
                id: newId,
                isCustom: true as const
            };
            updatedEquipments = [...equipments, newEquipment];
        }
        
        await Storage.set(STORAGE_KEY, JSON.stringify(updatedEquipments));
    } catch (error) {
        console.error("保存自定义器具失败:", error);
        throw new CustomEquipmentError(
            `${equipment.id ? '更新' : '创建'}自定义器具失败: ${equipment.name}`,
            error
        );
    }
}

/**
 * 更新自定义器具
 * @param id 器具ID
 * @param equipment 更新的器具数据
 */
export async function updateCustomEquipment(id: string, equipment: CustomEquipment): Promise<void> {
    try {
        const equipments = await loadCustomEquipments();
        const index = equipments.findIndex(e => e.id === id);
        
        if (index === -1) {
            throw new CustomEquipmentError(`未找到ID为${id}的器具`);
        }
        
        const updatedEquipments = [
            ...equipments.slice(0, index),
            { ...equipment, id, isCustom: true as const },
            ...equipments.slice(index + 1)
        ];
        
        await Storage.set(STORAGE_KEY, JSON.stringify(updatedEquipments));
    } catch (error) {
        console.error("更新自定义器具失败:", error);
        throw new CustomEquipmentError(`更新自定义器具失败: ${equipment.name}`, error);
    }
}

/**
 * 删除自定义器具
 * @param id 要删除的器具ID
 */
export async function deleteCustomEquipment(id: string): Promise<void> {
    try {
        const equipments = await loadCustomEquipments();
        const equipment = equipments.find(e => e.id === id);
        
        if (!equipment) {
            throw new CustomEquipmentError(`未找到ID为${id}的器具`);
        }
        
        const filteredEquipments = equipments.filter(e => e.id !== id);
        await Storage.set(STORAGE_KEY, JSON.stringify(filteredEquipments));
    } catch (error) {
        console.error("删除自定义器具失败:", error);
        throw new CustomEquipmentError(`删除自定义器具失败: ${id}`, error);
    }
}

/**
 * 验证器具名称是否可用
 * @param name 器具名称
 * @param currentId 当前器具ID（用于编辑时验证）
 * @returns 名称是否可用
 */
export async function isEquipmentNameAvailable(name: string, currentId?: string): Promise<boolean> {
    try {
        const equipments = await loadCustomEquipments();
        return !equipments.some(e => e.name === name && e.id !== currentId);
    } catch (error) {
        console.error("验证器具名称失败:", error);
        throw new CustomEquipmentError(`验证器具名称是否可用失败: ${name}`, error);
    }
}