import { useCallback } from "react";
import { Method } from "@/lib/config";
import { EditableParams } from "./useBrewingParameters";
import { TabType, BrewingStep } from "./useBrewingState";
import { Stage } from "./useBrewingContent";

export interface UseMethodSelectorProps {
	selectedEquipment: string | null;
	methodType: "common" | "custom";
	customMethods: Record<string, Method[]>;
	selectedCoffeeBean?: string | null;
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

export function useMethodSelector({
	selectedEquipment,
	methodType,
	customMethods,
	selectedCoffeeBean,
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
		async (method: Method | null) => {
			if (method) {
				// 即使是相同的方案，也强制更新状态和参数信息
				setCurrentBrewingMethod({ ...method });

				// 先设置为null，然后再设置新值，确保即使是相同的方案也会触发更新
				setSelectedMethod(null);

				// 使用setTimeout确保状态更新是分开的，并将回调函数标记为 async
				setTimeout(async () => {
					// 将方法重新设置回来
					setSelectedMethod(method);

					// 打印方法信息，用于调试
					console.log(`[选择方案] 方法名称: ${method.name}`);
					console.log(
						`[选择方案] 默认咖啡用量: ${method.params.coffee}`
					);

					// 直接更新参数信息，不依赖于useEffect
					setParameterInfo({
						equipment: selectedEquipment,
						method: method.name,
						params: {
							coffee: method.params.coffee,
							water: method.params.water,
							ratio: method.params.ratio,
							grindSize: method.params.grindSize,
							temp: method.params.temp,
						},
					});

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

					// 移除这里的扣减逻辑，在实际冲煮完成后再扣减
					// 只记录选择的咖啡豆和方案信息，但不立即扣减咖啡豆
					if (selectedCoffeeBean && method.params.coffee) {
						try {
							// 解析咖啡用量，格式通常为: "20g"
							console.log(
								`[选择方案] 原始咖啡用量: ${method.params.coffee}`
							);

							// 更严格的数字提取方式，只匹配数字部分
							const match =
								method.params.coffee.match(/(\d+\.?\d*)/);
							if (!match) {
								console.error(
									`[选择方案] 无法从 "${method.params.coffee}" 中提取咖啡用量数字`
								);
								return;
							}

							const coffeeAmount = parseFloat(match[1]);
							// 格式化数值，如果没有小数部分则显示整数
							const formattedAmount = Number.isInteger(
								coffeeAmount
							)
								? coffeeAmount.toString()
								: coffeeAmount.toFixed(1);

							console.log(
								`[选择方案] 解析后的咖啡用量: ${formattedAmount}g`
							);
							console.log(
								`[选择方案] 咖啡豆ID: ${selectedCoffeeBean} (保存以备后用，冲煮完成后再扣减)`
							);
						} catch (error) {
							console.error(
								"[选择方案] 解析咖啡用量失败:",
								error
							);
						}
					} else {
						if (!selectedCoffeeBean) {
							console.log("[选择方案] 未选择咖啡豆");
						}
						if (!method.params.coffee) {
							console.log("[选择方案] 方案未提供咖啡用量");
						}
					}
				}, 0);
			}
		},
		[
			selectedEquipment,
			selectedCoffeeBean,
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
		async (methodIndex: number) => {
			if (selectedEquipment) {
				let method: Method | null = null;

				if (methodType === "common") {
					try {
						// 导入commonMethods
						const { commonMethods } = await import("@/lib/config");
						method =
							commonMethods[
								selectedEquipment as keyof typeof commonMethods
							][methodIndex];
						await processSelectedMethod(method);
					} catch (error) {
						console.error("选择方案时出错:", error);
					}
				} else if (methodType === "custom") {
					try {
						method = customMethods[selectedEquipment][methodIndex];
						await processSelectedMethod(method);
					} catch (error) {
						console.error("选择自定义方案时出错:", error);
					}
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
