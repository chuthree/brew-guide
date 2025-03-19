import { useCallback } from "react";
import { Method } from "@/lib/config";
import { ParameterInfo, EditableParams } from "./useBrewingParameters";

export interface UseMethodSelectorProps {
	selectedEquipment: string | null;
	methodType: "common" | "custom";
	customMethods: Record<string, Method[]>;
	setSelectedMethod: (method: Method | null) => void;
	setCurrentBrewingMethod: (method: Method | null) => void;
	setEditableParams: (params: EditableParams | null) => void;
	setParameterInfo: (
		info: ParameterInfo | ((prev: ParameterInfo) => ParameterInfo)
	) => void;
	setActiveTab: (tab: "器具" | "方案" | "注水" | "记录") => void;
	setActiveBrewingStep: (
		step: "equipment" | "method" | "brewing" | "notes"
	) => void;
	updateBrewingSteps: (
		stages: Array<{
			label: string;
			water: string;
			detail: string;
			time: number;
		}>
	) => void;
}

export function useMethodSelector({
	selectedEquipment,
	methodType,
	customMethods,
	setSelectedMethod,
	setCurrentBrewingMethod,
	setEditableParams,
	setParameterInfo,
	setActiveTab,
	setActiveBrewingStep,
	updateBrewingSteps,
}: UseMethodSelectorProps) {
	// 处理选中的方法
	const processSelectedMethod = useCallback(
		(method: Method | null) => {
			if (method) {
				// 即使是相同的方案，也强制更新状态和参数信息
				setCurrentBrewingMethod({ ...method });

				// 先设置为null，然后再设置新值，确保即使是相同的方案也会触发更新
				setSelectedMethod(null);

				// 使用setTimeout确保状态更新是分开的
				setTimeout(() => {
					setSelectedMethod(method);

					// 直接更新参数信息，不依赖于useEffect
					setParameterInfo((prev) => ({
						...prev,
						method: method.name,
						params: {
							coffee: method.params.coffee,
							water: method.params.water,
							ratio: method.params.ratio,
							grindSize: method.params.grindSize,
							temp: method.params.temp,
						},
					}));

					// 直接更新可编辑参数，不依赖于useEffect
					setEditableParams({
						coffee: method.params.coffee,
						water: method.params.water,
						ratio: method.params.ratio,
					});

					// 更新注水步骤内容
					updateBrewingSteps(method.params.stages);

					setActiveTab("注水");
					setActiveBrewingStep("brewing");
				}, 0);
			}
		},
		[
			setSelectedMethod,
			setCurrentBrewingMethod,
			setEditableParams,
			setParameterInfo,
			updateBrewingSteps,
			setActiveTab,
			setActiveBrewingStep,
		]
	);

	const handleMethodSelect = useCallback(
		(methodIndex: number) => {
			if (selectedEquipment) {
				let method: Method | null = null;

				if (methodType === "common") {
					// 导入commonMethods
					import("@/lib/config").then(({ commonMethods }) => {
						method =
							commonMethods[
								selectedEquipment as keyof typeof commonMethods
							][methodIndex];
						processSelectedMethod(method);
					});
				} else if (methodType === "custom") {
					method = customMethods[selectedEquipment][methodIndex];
					processSelectedMethod(method);
				}
			}
		},
		[selectedEquipment, methodType, customMethods, processSelectedMethod]
	);

	return {
		handleMethodSelect,
		processSelectedMethod,
	};
}
