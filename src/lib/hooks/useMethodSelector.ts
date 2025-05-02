import { useCallback } from "react";
import { Method, equipmentList, Stage, commonMethods } from "@/lib/core/config";
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

// 添加StepWithCustomParams类型定义
interface StepWithCustomParams {
	methodIndex?: number;
	isCommonMethod?: boolean;
	customParams?: Record<string, string>;
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
										await import("@/lib/managers/customEquipments");
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

						// 重要：强制重置冲煮状态标志，确保可以正常导航
						window.dispatchEvent(new CustomEvent("brewing:reset"));

						// 设置短暂延迟，确保状态已更新
						const updateParams = async () => {
							try {
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
													"@/lib/managers/customEquipments"
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
			selectedEquipment: string,
			methodIndex: number,
			methodType: string,
			step?: StepWithCustomParams
		): Promise<Method | null> => {
			console.log(
				`选择方法: 器具=${selectedEquipment}, 方法索引=${methodIndex}, 类型=${methodType}`,
				step ? `带自定义参数: ${JSON.stringify(step.customParams)}` : "无自定义参数"
			);

			// 创建一个辅助函数来应用自定义参数
			const applyCustomParams = async (method: Method, customParams?: Record<string, string>, isCustomMethod: boolean = false) => {
				if (customParams) {
					// 创建方法的浅拷贝
					const methodCopy = { ...method };
					
					// 创建参数的浅拷贝
					methodCopy.params = { ...method.params };
					
					// 应用自定义参数到方法参数中
					Object.entries(customParams).forEach(([key, value]) => {
						// 直接检查关键字段并跳过stages
						if (key === 'stages') {
							return; // 跳过stages字段
						}
						
						if (key in methodCopy.params) {
							// 使用类型断言避开TypeScript类型检查
							// @ts-expect-error 自定义参数只应用于标量值，不应应用于stages数组
							methodCopy.params[key] = String(value);
						}
					});
					
					console.log(
						isCustomMethod ? "应用自定义参数到自定义方法:" : "应用自定义参数:", 
						customParams
					);
					console.log(
						isCustomMethod ? "修改后的自定义方法参数:" : "修改后的方法参数:", 
						methodCopy.params
					);
					
					// 使用修改后的方法
					await processSelectedMethod(methodCopy);
					return methodCopy;
				} else {
					// 没有自定义参数，使用原始方法
					await processSelectedMethod(method);
					return method;
				}
			};

			let method: Method | null = null;

			if (methodType === "predefined") {
				try {
					if (
						customMethods &&
						customMethods[selectedEquipment] &&
						customMethods[selectedEquipment][methodIndex]
					) {
						method =
							customMethods[selectedEquipment][methodIndex];
						
						// 使用辅助函数应用自定义参数
						method = await applyCustomParams(method, step?.customParams);
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
					console.error("选择方法时出错:", error);
				}
			} else if (methodType === "common") {
				// 处理通用方法类型
				try {
					// 首先尝试直接从commonMethods中获取方法
					if (
						commonMethods &&
						commonMethods[selectedEquipment] &&
						commonMethods[selectedEquipment][methodIndex]
					) {
						method = commonMethods[selectedEquipment][methodIndex];
						
						// 使用辅助函数应用自定义参数
						method = await applyCustomParams(method, step?.customParams);
					} 
					// 如果直接获取失败，检查是否为自定义器具的通用方法
					else if (selectedEquipment && selectedEquipment.startsWith('custom-')) {
						// 尝试解析自定义器具类型
						let baseEquipmentId = '';
						
						// 从自定义器具ID中识别其基础类型
						if (selectedEquipment.includes('-v60-')) {
							baseEquipmentId = 'V60';
						} else if (selectedEquipment.includes('-clever-')) {
							baseEquipmentId = 'CleverDripper';
						} else if (selectedEquipment.includes('-kalita-')) {
							baseEquipmentId = 'Kalita';
						} else if (selectedEquipment.includes('-origami-')) {
							baseEquipmentId = 'Origami';
						}
						
						// 如果识别出基础器具类型，尝试获取对应的通用方法
						if (
							baseEquipmentId && 
							commonMethods && 
							commonMethods[baseEquipmentId] && 
							commonMethods[baseEquipmentId][methodIndex]
						) {
							console.log(`使用${baseEquipmentId}的通用方法`);
							method = commonMethods[baseEquipmentId][methodIndex];
							
							// 使用辅助函数应用自定义参数
							method = await applyCustomParams(method, step?.customParams);
						} else {
							console.error("无法为自定义器具找到对应的通用方法:", {
								selectedEquipment,
								baseEquipmentId,
								methodIndex,
							});
						}
					} else {
						console.error("找不到通用方法:", {
							selectedEquipment,
							methodIndex,
							hasCommonMethods:
								!!commonMethods[selectedEquipment],
							commonMethodsLength:
								commonMethods[selectedEquipment]?.length,
						});
					}
				} catch (error) {
					// 错误处理
					console.error("选择通用方法时出错:", error);
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
						
						// 使用辅助函数应用自定义参数（标记为自定义方法）
						method = await applyCustomParams(method, step?.customParams, true);
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
		},
		[selectedEquipment, methodType, customMethods, commonMethods, processSelectedMethod]
	);

	return {
		processSelectedMethod,
		handleMethodSelect,
	};
}
