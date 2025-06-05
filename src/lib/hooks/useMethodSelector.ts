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
			if (!selectedEquipment || selectedEquipment.trim() === '') {
				return null;
			}

			let method: Method | null = null;

			// 简化方法获取逻辑
			if (methodType === "predefined" || methodType === "custom") {
				if (customMethods?.[selectedEquipment]?.[methodIndex]) {
					method = customMethods[selectedEquipment][methodIndex];
				}
			} else if (methodType === "common") {
				if (commonMethods?.[selectedEquipment]?.[methodIndex]) {
					method = commonMethods[selectedEquipment][methodIndex];
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
