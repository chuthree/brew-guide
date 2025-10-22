import { type Method, type CustomEquipment } from '@/lib/core/config';
import { methodToReadableText } from '@/lib/utils/jsonUtils';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/core/db';

/**
 * 从存储加载自定义方案
 * @returns 自定义方案对象
 */
export async function loadCustomMethods(): Promise<Record<string, Method[]>> {
  try {
    // 从IndexedDB加载自定义方案
    const methodsFromDB = await db.customMethods.toArray();

    // 将数组转换为记录格式
    const result: Record<string, Method[]> = {};
    for (const item of methodsFromDB) {
      result[item.equipmentId] = item.methods;
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
  // 这个函数已经不再使用，因为我们不能在同步函数中使用动态导入
  // 返回空对象，让调用方使用异步版本
  console.warn(
    'loadCustomMethodsSync 已废弃，请使用 loadCustomMethods 异步版本'
  );
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
    // 从IndexedDB加载
    const methodData = await db.customMethods.get(equipmentId);
    if (methodData && Array.isArray(methodData.methods)) {
      // 确保所有方法都有ID
      const methods = methodData.methods.map((method: Method) => {
        if (!method.id) {
          return {
            ...method,
            id: `method-${Date.now()}`,
          };
        }
        return method;
      });
      return methods;
    }

    return [];
  } catch (_error) {
    console.error(`加载方案失败:`, _error);
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
  methods.forEach(method => {
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
  boolean | { newCustomMethods: Record<string, Method[]>; methodWithId: Method }
> {
  // Check which calling pattern is used
  if (typeof arg1 === 'string') {
    // New pattern: saveCustomMethod(equipmentId, method)
    const equipmentId = arg1;
    const method = arg2 as Method;

    try {
      // Load existing methods for this equipment
      const existingMethods = await loadCustomMethodsForEquipment(equipmentId);

      // Ensure method has an ID
      const methodWithId = {
        ...method,
        id: method.id || `method-${Date.now()}`,
      };

      // 更新或添加方法
      const updatedMethods = existingMethods.filter(
        m => m.id !== methodWithId.id
      );
      updatedMethods.push(methodWithId);

      // 去重并保存到IndexedDB
      const uniqueMethods = removeDuplicateMethods(updatedMethods);
      await db.customMethods.put({
        equipmentId,
        methods: uniqueMethods,
      });

      // 触发自定义方案变化事件，通知所有监听组件
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('customMethodsChanged', {
          detail: { equipmentId },
        });
        window.dispatchEvent(event);
      }

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
      throw new Error('未选择设备');
    }

    // 保留原始ID（如果存在），否则生成新ID
    const methodWithId = {
      ...method,
      id: method.id || `method-${uuidv4()}`,
    };

    // 加载现有方法
    const existingMethods =
      await loadCustomMethodsForEquipment(selectedEquipment);

    // 更新或添加方法
    const updatedMethods = existingMethods.filter(
      m =>
        m.id !== methodWithId.id &&
        (editingMethod ? m.id !== editingMethod.id : true)
    );
    updatedMethods.push(methodWithId);

    // 去重并保存到IndexedDB
    const uniqueMethods = removeDuplicateMethods(updatedMethods);
    await db.customMethods.put({
      equipmentId: selectedEquipment,
      methods: uniqueMethods,
    });

    // 触发自定义方案变化事件，通知所有监听组件
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('customMethodsChanged', {
        detail: { equipmentId: selectedEquipment },
      });
      window.dispatchEvent(event);
    }

    // 重新加载所有方案数据
    try {
      const allMethods = await loadCustomMethods();
      return {
        newCustomMethods: allMethods,
        methodWithId,
      };
    } catch (_error) {
      // 为了保持向后兼容，也更新内存中的customMethods对象
      const newCustomMethods = {
        ...customMethods,
        [selectedEquipment]: uniqueMethods,
      };
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
  if (typeof arg1 === 'string' && typeof arg3 === 'string') {
    // New pattern: deleteCustomMethod(equipmentId, methodId)
    const equipmentId = arg1;
    const methodId = arg3;

    try {
      // Load existing methods
      const existingMethods = await loadCustomMethodsForEquipment(equipmentId);

      // Filter out the method to delete
      const updatedMethods = existingMethods.filter(
        method => method.id !== methodId
      );

      // If no methods were removed, return false
      if (updatedMethods.length === existingMethods.length) {
        return false;
      }

      // 保存到IndexedDB
      await db.customMethods.put({
        equipmentId,
        methods: updatedMethods,
      });

      // 触发自定义方案变化事件，通知所有监听组件
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('customMethodsChanged', {
          detail: { equipmentId },
        });
        window.dispatchEvent(event);
      }

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
      throw new Error('未选择设备');
    }

    const updatedMethods = customMethods[selectedEquipment].filter(
      m => m.id !== method.id
    );

    // 保存到IndexedDB
    await db.customMethods.put({
      equipmentId: selectedEquipment,
      methods: updatedMethods,
    });

    // 触发自定义方案变化事件，通知所有监听组件
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('customMethodsChanged', {
        detail: { equipmentId: selectedEquipment },
      });
      window.dispatchEvent(event);
    }

    // 重新加载所有方案数据
    try {
      const allMethods = await loadCustomMethods();
      return allMethods;
    } catch (_error) {
      const newCustomMethods = {
        ...customMethods,
        [selectedEquipment]: updatedMethods,
      };
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
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  } catch (err) {
    throw err;
  }
}

/**
 * 复制器具配置到剪贴板
 * @param equipment 器具对象
 * @param methods 相关的自定义方案（可选）
 */
export async function copyEquipmentToClipboard(
  equipment: CustomEquipment,
  methods?: Method[]
) {
  try {
    // 准备导出数据
    const exportData = {
      equipment: {
        ...equipment,
        // 确保包含自定义注水动画配置
        customPourAnimations: equipment.customPourAnimations || [],
        // 保留ID信息，确保方案能正确关联
        id: equipment.id,
      },
      methods:
        methods && methods.length > 0
          ? methods.map(method => ({
              ...method,
              // 保留ID，确保关联性
              id: method.id,
            }))
          : [],
    };

    // 转换为JSON格式
    const jsonData = JSON.stringify(exportData, null, 2);

    // 尝试使用现代API
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(jsonData);
    } else {
      // 降级方案
      const textarea = document.createElement('textarea');
      textarea.value = jsonData;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  } catch (err) {
    throw err;
  }
}
