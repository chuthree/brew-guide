import { useCallback } from "react";
import { Method, equipmentList, Stage } from "@/lib/config";
import { EditableParams } from "./useBrewingParameters";
import { TabType, BrewingStep } from "./useBrewingState";

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
	showComplete?: boolean;
	resetBrewingState?: () => void;
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
	showComplete,
	resetBrewingState,
}: UseMethodSelectorProps) {
	// 处理选中的方法
	const processSelectedMethod = useCallback(
		async (method: Method | null) => {
			// 如果冲煮已完成，需要重置相关状态
			if (showComplete && resetBrewingState) {
				resetBrewingState();

				// 触发一个事件通知其他组件冲煮已经重置
				window.dispatchEvent(new CustomEvent("brewing:reset"));
			}

			// 记录选择的方案
			setCurrentBrewingMethod(method);

			// 更新当前方案
			if (method) {
				setSelectedMethod(method);

				// 即使选择了相同的方案，也更新方案（解决在冲煮完成后重新选择相同方案的问题）
				setTimeout(async () => {
					// 将方法重新设置回来
					setSelectedMethod(method);

					// 获取设备的中文名称而不是使用ID
					const equipmentName = selectedEquipment
						? equipmentList.find((e) => e.id === selectedEquipment)
								?.name || selectedEquipment
						: null;

					// 直接更新参数信息，不依赖于useEffect
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

					// 直接更新可编辑参数，不依赖于useEffect
					setEditableParams({
						coffee: method.params.coffee,
						water: method.params.water,
						ratio: method.params.ratio,
						grindSize: method.params.grindSize || "",
						temp: method.params.temp || "",
					});

					// 更新注水步骤内容
					updateBrewingSteps(method.params.stages);

					// 调整设置步骤和标签的方式，确保即使是在冲煮完成状态下也能正确导航
					setActiveTab("注水");
					setActiveBrewingStep("brewing");

					// 设置标记，表示从方案选择进入注水步骤
					localStorage.setItem("fromMethodToBrewing", "true");

					// 重要：强制重置冲煮状态标志，确保可以正常导航
					window.dispatchEvent(new CustomEvent("brewing:reset"));

					// 设置短暂延迟，确保状态已更新
					setTimeout(() => {
						// 发送特殊事件，表示从方案选择到冲煮的转换
						window.dispatchEvent(
							new CustomEvent("brewing:methodToBrewing", {
								detail: { fromMethod: true },
							})
						);

						// 更新参数栏信息，转换params对象
						const params: Record<string, string | undefined> = {
							coffee: method.params.coffee,
							water: method.params.water,
							ratio: method.params.ratio,
							grindSize: method.params.grindSize,
							temp: method.params.temp,
							videoUrl: method.params.videoUrl,
							roastLevel: method.params.roastLevel,
							// 不包含stages，避免类型不匹配
						};

						// 获取设备的中文名称
						const equipmentNameInner = selectedEquipment
							? equipmentList.find(
									(e) => e.id === selectedEquipment
							  )?.name || selectedEquipment
							: null;

						setParameterInfo({
							equipment: equipmentNameInner, // 使用设备名称而不是ID
							method: method.name,
							params: params,
						});

						// 强制再次设置标记，确保在任何情况下都能返回到方案页面
						localStorage.setItem("fromMethodToBrewing", "true");
					}, 50);

					// 增加另一个延迟检查，确保标记不被其他操作清除
					setTimeout(() => {
						if (
							localStorage.getItem("fromMethodToBrewing") !==
							"true"
						) {
							localStorage.setItem("fromMethodToBrewing", "true");
						}
					}, 300);

					// 移除这里的扣减逻辑，在实际冲煮完成后再扣减
					// 只记录选择的咖啡豆和方案信息，但不立即扣减咖啡豆
					if (selectedCoffeeBean && method.params.coffee) {
						try {
							// 解析咖啡用量，格式通常为: "20g"
							// 更严格的数字提取方式，只匹配数字部分
							const match =
								method.params.coffee.match(/(\d+\.?\d*)/);
							if (!match) {
								return;
							}

							// 这里只解析咖啡用量，但不做任何操作
							parseFloat(match[1]);
						} catch (_error) {
							// 错误处理
						}
					}
				}, 0);

				return true;
			}

			return false;
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
			showComplete,
			resetBrewingState,
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
					} catch (_error) {
						// 错误处理
					}
				} else if (methodType === "custom") {
					try {
						if (
							customMethods &&
							customMethods[selectedEquipment] &&
							customMethods[selectedEquipment][methodIndex]
						) {
							method =
								customMethods[selectedEquipment][methodIndex];
							await processSelectedMethod(method);
						}
					} catch (_error) {
						// 错误处理
					}
				}

				return method;
			}

			return null;
		},
		[selectedEquipment, methodType, customMethods, processSelectedMethod]
	);

	return {
		processSelectedMethod,
		handleMethodSelect,
	};
}
