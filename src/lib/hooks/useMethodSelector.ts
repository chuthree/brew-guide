import { useCallback } from "react";
import { Method, equipmentList, Stage, commonMethods } from "@/lib/core/config";
import { EditableParams } from "./useBrewingParameters";
import { TabType, BrewingStep } from "./useBrewingState";

export interface UseMethodSelectorProps {
	selectedEquipment: string | null;
	customMethods: Record<string, Method[]>;
	setSelectedMethod: (method: Method | null) => void;
	setCurrentBrewingMethod: (method: Method | null) => void;
	setEditableParams: (params: EditableParams | null) => void;
	setParameterInfo: (info: {
		equipment: string | null;
		method: string | null;
		params: Record<string, string | undefined> | null;
	}) => void;
	setActiveTab: (tab: TabType) => void;
	setActiveBrewingStep: (step: BrewingStep) => void;
	updateBrewingSteps: (stages: Stage[]) => void;
}

// 添加StepWithCustomParams类型定义
interface StepWithCustomParams {
	methodIndex?: number;
	isCommonMethod?: boolean;
	customParams?: Record<string, string>;
}

export function useMethodSelector({
	selectedEquipment,
	customMethods,
	setSelectedMethod,
	setCurrentBrewingMethod,
	setEditableParams,
	setParameterInfo,
	setActiveTab,
	setActiveBrewingStep,
	updateBrewingSteps,
}: UseMethodSelectorProps) {
	// 简化方法选择处理
	const processSelectedMethod = useCallback(
		async (method: Method | null) => {
			if (!method) return false;

			// 设置选中的方案
			setCurrentBrewingMethod(method);
			setSelectedMethod(method);

			// 设置可编辑参数
			setEditableParams({
				coffee: method.params.coffee || "",
				water: method.params.water || "",
				ratio: method.params.ratio || "",
				grindSize: method.params.grindSize || "",
				temp: method.params.temp || "",
			});

			// 更新注水步骤内容
			updateBrewingSteps(method.params.stages);

			// 更新参数栏信息
			const equipmentName = selectedEquipment ?
				equipmentList.find(e => e.id === selectedEquipment)?.name || selectedEquipment
				: null;

			setParameterInfo({
				equipment: equipmentName,
				method: method.name,
				params: {
					coffee: method.params.coffee,
					water: method.params.water,
					ratio: method.params.ratio,
					grindSize: method.params.grindSize,
					temp: method.params.temp,
				},
			});

			// 简单的步骤切换：选择方案后进入注水步骤
			setActiveTab("注水");
			setActiveBrewingStep("brewing");

			return true;
	},
	[
		selectedEquipment,
		setSelectedMethod,
		setCurrentBrewingMethod,
		setEditableParams,
		setParameterInfo,
		updateBrewingSteps,
		setActiveTab,
		setActiveBrewingStep,
		equipmentList,
	]
);

	const handleMethodSelect = useCallback(
		async (
			selectedEquipment: string,
			methodIndex: number,
			methodType: string,
			step?: StepWithCustomParams
		): Promise<Method | null> => {
			console.log(`[useMethodSelector] handleMethodSelect 调用`, {
				selectedEquipment,
				methodIndex,
				methodType,
				step: step ? { title: step.title, isCommonMethod: step.isCommonMethod } : null
			});

			if (!selectedEquipment || selectedEquipment.trim() === '') {
				console.log(`[useMethodSelector] 无效的设备选择: ${selectedEquipment}`);
				return null;
			}

			let method: Method | null = null;

			// 简化方法获取逻辑
			if (methodType === "predefined" || methodType === "custom") {
				if (customMethods?.[selectedEquipment]?.[methodIndex]) {
					method = customMethods[selectedEquipment][methodIndex];
					console.log(`[useMethodSelector] 找到自定义方案: ${method.name}`);
				} else {
					console.log(`[useMethodSelector] 未找到自定义方案`, {
						hasCustomMethods: !!customMethods?.[selectedEquipment],
						methodCount: customMethods?.[selectedEquipment]?.length || 0,
						methodIndex
					});
				}
			} else if (methodType === "common") {
				// 对于自定义器具，需要找到对应的基础器具ID
				let targetEquipmentId = selectedEquipment;

				// 检查是否是自定义器具（通过ID或名称）
				const { equipmentList } = await import('@/lib/core/config');
				const customEquipmentById = equipmentList.find(e => e.id === selectedEquipment && 'animationType' in e);
				const customEquipmentByName = !customEquipmentById
					? equipmentList.find(e => e.name === selectedEquipment && 'animationType' in e)
					: null;
				const customEquipment = customEquipmentById || customEquipmentByName;

				if (customEquipment && 'animationType' in customEquipment) {
					// 这是自定义器具，需要找到基础器具ID
					const animationType = (customEquipment as any).animationType?.toLowerCase();
					switch (animationType) {
						case 'v60': targetEquipmentId = 'V60'; break;
						case 'clever': targetEquipmentId = 'CleverDripper'; break;
						case 'espresso': targetEquipmentId = 'Espresso'; break;
						case 'kalita': targetEquipmentId = 'Kalita'; break;
						case 'origami': targetEquipmentId = 'Origami'; break;
						case 'custom':
							// 自定义预设器具不使用通用方案
							targetEquipmentId = '';
							break;
						default: targetEquipmentId = 'V60';
					}
					console.log(`[useMethodSelector] 自定义器具 ${selectedEquipment} (${animationType}) 映射到基础器具 ${targetEquipmentId}`);
				} else if (selectedEquipment.startsWith('custom-')) {
					// 通过ID推断器具类型的逻辑（兼容旧版本）
					if (selectedEquipment.includes('-v60-')) {
						targetEquipmentId = 'V60';
					} else if (selectedEquipment.includes('-clever-')) {
						targetEquipmentId = 'CleverDripper';
					} else if (selectedEquipment.includes('-kalita-')) {
						targetEquipmentId = 'Kalita';
					} else if (selectedEquipment.includes('-origami-')) {
						targetEquipmentId = 'Origami';
					} else if (selectedEquipment.includes('-espresso-')) {
						targetEquipmentId = 'Espresso';
					} else {
						targetEquipmentId = 'V60'; // 默认
					}
					console.log(`[useMethodSelector] 通过ID推断自定义器具 ${selectedEquipment} 映射到基础器具 ${targetEquipmentId}`);
				}

				if (targetEquipmentId && commonMethods?.[targetEquipmentId]?.[methodIndex]) {
					method = commonMethods[targetEquipmentId][methodIndex];
					console.log(`[useMethodSelector] 找到通用方案: ${method.name} (来自 ${targetEquipmentId})`);
				} else {
					console.log(`[useMethodSelector] 未找到通用方案`, {
						selectedEquipment,
						targetEquipmentId,
						hasCommonMethods: !!commonMethods?.[targetEquipmentId],
						methodCount: commonMethods?.[targetEquipmentId]?.length || 0,
						methodIndex
					});
				}
			}

			if (method) {
				// 应用自定义参数（如果有）
				if (step?.customParams) {
					const methodCopy = { ...method, params: { ...method.params } };
					Object.entries(step.customParams).forEach(([key, value]) => {
						if (key !== 'stages' && key in methodCopy.params) {
							(methodCopy.params as any)[key] = String(value);
						}
					});
					method = methodCopy;
				}

				await processSelectedMethod(method);
			}

			return method;
		},
		[customMethods, commonMethods, processSelectedMethod]
	);

	return {
		processSelectedMethod,
		handleMethodSelect,
	};
}
