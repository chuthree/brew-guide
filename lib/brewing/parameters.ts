import { Method } from "../config";
import { BrewingStep } from "../hooks/useBrewingState";
import { ParameterInfo } from "./constants";
import { emitEvent } from "./events";
import { BREWING_EVENTS } from "./constants";

interface EquipmentItem {
	id: string;
	name: string;
}

/**
 * 获取设备名称
 * @param equipmentId 设备ID
 * @param equipmentList 设备列表
 * @returns 设备名称
 */
export const getEquipmentName = (
	equipmentId: string | null,
	equipmentList: EquipmentItem[]
): string | null => {
	if (!equipmentId) return null;

	const equipment = equipmentList.find((e) => e.id === equipmentId);
	return equipment ? equipment.name : equipmentId;
};

/**
 * 创建参数对象
 * @param method 方案
 * @returns 参数对象
 */
export const createParamsFromMethod = (
	method: Method | null
): ParameterInfo["params"] => {
	if (!method) return null;

	return {
		coffee: method.params.coffee,
		water: method.params.water,
		ratio: method.params.ratio,
		grindSize: method.params.grindSize,
		temp: method.params.temp,
	};
};

/**
 * 更新参数栏信息
 * @param step 当前步骤
 * @param selectedEquipment 选择的设备
 * @param selectedMethod 选择的方案
 * @param equipmentList 设备列表
 */
export function updateParameterInfo(
	step: BrewingStep,
	selectedEquipment: string | null,
	selectedMethod: Method | null,
	equipmentList: EquipmentItem[]
) {
	// 为了防止任何可能的问题，特别保护fromMethodToBrewing标记
	const hasMethodToBrewing =
		localStorage.getItem("fromMethodToBrewing") === "true";

	// 获取设备名称
	let equipmentName: string | null = null;
	if (selectedEquipment) {
		const equipment = equipmentList.find((e) => e.id === selectedEquipment);
		equipmentName = equipment ? equipment.name : selectedEquipment;
	}

	let paramInfo: ParameterInfo;

	// 根据当前步骤更新不同的参数信息
	switch (step) {
		case "coffeeBean":
			paramInfo = {
				equipment: null,
				method: null,
				params: null,
			};
			break;
		case "equipment":
			paramInfo = {
				equipment: equipmentName,
				method: null,
				params: null,
			};
			break;
		case "method":
			paramInfo = {
				equipment: equipmentName,
				method: null,
				params: null,
			};
			break;
		case "brewing":
			if (selectedMethod) {
				const extractedParams: Record<string, string | undefined> = {
					coffee: selectedMethod.params.coffee,
					water: selectedMethod.params.water,
					ratio: selectedMethod.params.ratio,
					grindSize: selectedMethod.params.grindSize,
					temp: selectedMethod.params.temp,
				};

				paramInfo = {
					equipment: equipmentName,
					method: selectedMethod.name,
					params: extractedParams,
				};
			} else {
				paramInfo = {
					equipment: equipmentName,
					method: null,
					params: null,
				};
			}
			break;
		case "notes":
			if (selectedMethod) {
				const extractedParams: Record<string, string | undefined> = {
					coffee: selectedMethod.params.coffee,
					water: selectedMethod.params.water,
					ratio: selectedMethod.params.ratio,
					grindSize: selectedMethod.params.grindSize,
					temp: selectedMethod.params.temp,
				};

				paramInfo = {
					equipment: equipmentName,
					method: selectedMethod.name,
					params: extractedParams,
				};
			} else {
				paramInfo = {
					equipment: equipmentName,
					method: null,
					params: null,
				};
			}
			break;
		default:
			// 默认清除所有参数
			paramInfo = {
				equipment: null,
				method: null,
				params: null,
			};
	}

	// 发送参数更新事件
	emitEvent(BREWING_EVENTS.PARAMS_UPDATED, paramInfo);

	// 如果之前有fromMethodToBrewing标记，恢复它
	if (hasMethodToBrewing) {
		localStorage.setItem("fromMethodToBrewing", "true");
	}
}
