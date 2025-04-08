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
				// 使用异步函数包装器
				const setupMethod = async () => {
					try {
						// 将方法重新设置回来
						setSelectedMethod(method);

						// 获取设备的中文名称而不是使用ID
						// 先尝试从标准设备列表中获取设备名称
						let equipmentName: string | null = null;
						if (selectedEquipment) {
							const standardEquipment = equipmentList.find(
								(e) => e.id === selectedEquipment
							);
							if (standardEquipment) {
								equipmentName = standardEquipment.name;
							} else {
								// 如果不是标准设备，尝试加载自定义设备
								try {
									const { loadCustomEquipments } =
										await import("@/lib/customEquipments");
									const { getEquipmentName } = await import(
										"@/lib/brewing/parameters"
									);
									const customEquipments =
										await loadCustomEquipments();
									equipmentName = getEquipmentName(
										selectedEquipment,
										equipmentList,
										customEquipments
									);
								} catch (error) {
									console.error("加载自定义设备失败:", error);
									equipmentName = selectedEquipment; // 出错时使用原始ID
								}
							}
						}

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
						const updateParams = async () => {
							try {
								// 发送特殊事件，表示从方案选择到冲煮的转换
								window.dispatchEvent(
									new CustomEvent("brewing:methodToBrewing", {
										detail: { fromMethod: true },
									})
								);

								// 更新参数栏信息，转换params对象
								const params: Record<
									string,
									string | undefined
								> = {
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
								// 先尝试从标准设备列表中获取设备名称
								let equipmentNameInner: string | null = null;
								if (selectedEquipment) {
									const standardEquipment =
										equipmentList.find(
											(e) => e.id === selectedEquipment
										);
									if (standardEquipment) {
										equipmentNameInner =
											standardEquipment.name;
									} else {
										// 如果不是标准设备，尝试加载自定义设备
										try {
											const { loadCustomEquipments } =
												await import(
													"@/lib/customEquipments"
												);
											const { getEquipmentName } =
												await import(
													"@/lib/brewing/parameters"
												);
											const customEquipments =
												await loadCustomEquipments();
											equipmentNameInner =
												getEquipmentName(
													selectedEquipment,
													equipmentList,
													customEquipments
												);
										} catch (error) {
											console.error(
												"加载自定义设备失败:",
												error
											);
											equipmentNameInner =
												selectedEquipment; // 出错时使用原始ID
										}
									}
								}

								setParameterInfo({
									equipment: equipmentNameInner, // 使用设备名称而不是ID
									method: method.name,
									params: params,
								});

								// 强制再次设置标记，确保在任何情况下都能返回到方案页面
								localStorage.setItem(
									"fromMethodToBrewing",
									"true"
								);
							} catch (error) {
								console.error("更新参数栏时出错:", error);
							}
						};

						setTimeout(() => {
							updateParams();
						}, 50);

						// 增加另一个延迟检查，确保标记不被其他操作清除
						setTimeout(() => {
							if (
								localStorage.getItem("fromMethodToBrewing") !==
								"true"
							) {
								localStorage.setItem(
									"fromMethodToBrewing",
									"true"
								);
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
					} catch (error) {
						console.error("处理方案选择时出错:", error);
					}
				};

				setTimeout(() => {
					setupMethod();
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
		async (
			methodIndex: number,
			step?: {
				methodIndex?: number;
				isCommonMethod?: boolean;
			}
		) => {
			if (selectedEquipment) {
				let method: Method | null = null;

				// 检查是否是预设器具（直接从equipmentList中检查）
				const { equipmentList } = await import("@/lib/config");
				const isPredefinedEquipment = equipmentList.some(
					(e) => e.id === selectedEquipment
				);

				// 更新判断逻辑：只有当器具不是预设器具且其他条件满足时，才认为是自定义器具的通用方案
				const isCustomEquipmentCommonMethod =
					step?.isCommonMethod === true &&
					methodType === "common" &&
					!isPredefinedEquipment;

				// 添加调试信息
				console.log("方法选择:", {
					methodIndex,
					methodType,
					selectedEquipment,
					step,
					isPredefinedEquipment,
					isCustomEquipmentCommonMethod,
					hasMethodIndex: step?.methodIndex !== undefined,
				});

				// 获取有效的方法索引
				const effectiveMethodIndex =
					step?.methodIndex !== undefined
						? step.methodIndex
						: methodIndex;

				if (methodType === "common") {
					try {
						// 导入commonMethods
						const { commonMethods } = await import("@/lib/config");

						// 修改逻辑顺序：先检查是否是自定义器具
						if (isCustomEquipmentCommonMethod) {
							console.log("处理自定义器具的通用方案");
							// 尝试使用step中的animationType属性来确定基础设备
							// 这部分逻辑需要与useBrewingContent中的逻辑保持一致
							const { loadCustomEquipments } = await import(
								"@/lib/customEquipments"
							);
							const loadedEquipments =
								await loadCustomEquipments();

							const customEquipment = loadedEquipments.find(
								(e) =>
									e.id === selectedEquipment ||
									e.name === selectedEquipment
							);

							if (customEquipment) {
								console.log("找到自定义器具:", customEquipment);
								let baseEquipmentId = "";
								const animationType =
									customEquipment.animationType.toLowerCase();
								console.log("动画类型:", animationType);

								switch (animationType) {
									case "v60":
										baseEquipmentId = "V60";
										break;
									case "kalita":
										baseEquipmentId = "Kalita";
										break;
									case "origami":
										baseEquipmentId = "Origami";
										break;
									case "clever":
										baseEquipmentId = "CleverDripper";
										break;
									default:
										console.warn(
											"未知的动画类型:",
											animationType
										);
										baseEquipmentId = "V60"; // 默认使用 V60 的方案
								}

								console.log(
									"使用基础器具:",
									baseEquipmentId,
									"方法索引:",
									effectiveMethodIndex
								);

								// 确保 baseEquipmentId 存在于 commonMethods 中
								if (commonMethods[baseEquipmentId]) {
									// 确保方法索引有效
									if (
										effectiveMethodIndex >= 0 &&
										effectiveMethodIndex <
											commonMethods[baseEquipmentId]
												.length
									) {
										method =
											commonMethods[baseEquipmentId][
												effectiveMethodIndex
											];
										console.log(
											"找到自定义器具的通用方案:",
											method?.name
										);
									} else {
										console.error(
											"方法索引超出范围:",
											effectiveMethodIndex,
											"可用方法数量:",
											commonMethods[baseEquipmentId]
												.length
										);
									}
								} else {
									console.error(
										"找不到基础器具:",
										baseEquipmentId
									);
								}
							} else {
								console.error(
									"找不到自定义器具:",
									selectedEquipment
								);
							}
						} else {
							// 对于预定义器具，直接使用其通用方案
							// 检查 selectedEquipment 是否存在于 commonMethods 中
							if (
								commonMethods[
									selectedEquipment as keyof typeof commonMethods
								]
							) {
								method =
									commonMethods[
										selectedEquipment as keyof typeof commonMethods
									][effectiveMethodIndex];
								console.log(
									"找到预定义器具的通用方案:",
									method?.name
								);
							} else {
								console.error(
									"找不到预定义器具的通用方案:",
									selectedEquipment
								);
							}
						}

						if (method) {
							await processSelectedMethod(method);
						} else {
							console.error("未能找到合适的方法");
						}
					} catch (error) {
						// 错误处理
						console.error("选择方法时出错:", error);
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
						} else {
							console.error("找不到自定义方法:", {
								selectedEquipment,
								methodIndex,
								hasCustomMethods:
									!!customMethods[selectedEquipment],
								customMethodsLength:
									customMethods[selectedEquipment]?.length,
							});
						}
					} catch (error) {
						// 错误处理
						console.error("选择自定义方法时出错:", error);
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
