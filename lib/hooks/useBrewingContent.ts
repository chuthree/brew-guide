import { useState, useEffect } from "react";
import {
	Method,
	brewingMethods as commonMethods,
	equipmentList,
	CustomEquipment,
} from "@/lib/config";
import { Content } from "./useBrewingState";
import { formatGrindSize } from "@/lib/grindUtils";
import { SettingsOptions } from "@/components/Settings";
import { loadCustomMethodsForEquipment } from "@/lib/customMethods";

// 格式化时间工具函数
export const formatTime = (seconds: number, compact: boolean = false) => {
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;

	if (compact) {
		// 简洁模式: 1'20" 或 45"
		return mins > 0
			? `${mins}'${secs.toString().padStart(2, "0")}"`
			: `${secs}"`;
	}
	// 完整模式: 1:20 (用于主计时器显示)
	return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export interface UseBrewingContentProps {
	selectedEquipment: string | null;
	methodType: "common" | "custom";
	customMethods: Record<string, Method[]>;
	selectedMethod: Method | null;
	settings: SettingsOptions;
	customEquipments?: CustomEquipment[]; // 添加自定义器具参数
}

export function useBrewingContent({
	selectedEquipment,
	methodType,
	customMethods, // 不再忽略customMethods参数
	selectedMethod,
	settings,
	customEquipments = [], // 设置默认值为空数组
}: UseBrewingContentProps) {
	const initialContent: Content = {
		咖啡豆: {
			steps: [
				{
					title: "咖啡豆选择",
					items: ["选择您喜欢的咖啡豆"],
					note: "正在开发中",
				},
			],
		},
		器具: {
			steps: [
				...equipmentList.map((equipment) => ({
					title: equipment.name,
					items: [equipment.description],
					note: equipment.note || "",
				})),
				...customEquipments.map((equipment) => ({
					title: equipment.name,
					items: [equipment.description || "自定义器具"],
					note: equipment.note || "",
					isCustom: true, // 标记为自定义器具
				})),
			],
		},
		方案: {
			steps: [],
			type: "common",
		},
		注水: {
			steps: [],
		},
		记录: {
			steps: [],
		},
	};

	const [content, setContent] = useState<Content>(initialContent);
	// 添加状态保存当前设备的自定义方法
	const [currentEquipmentCustomMethods, setCurrentEquipmentCustomMethods] = useState<Method[]>([]);

	// 更新器具列表内容
	useEffect(() => {
		setContent((prev) => ({
			...prev,
			器具: {
				steps: [
					...equipmentList.map((equipment) => ({
						title: equipment.name,
						items: [equipment.description],
						note: equipment.note || "",
					})),
					...customEquipments.map((equipment) => ({
						title: equipment.name,
						items: [equipment.description || "自定义器具"],
						note: equipment.note || "",
						isCustom: true, // 标记为自定义器具
					})),
				],
			},
		}));
	}, [customEquipments]);

	// 当选择器具改变或customMethods改变时，获取自定义方法
	useEffect(() => {
		const updateCustomMethods = async () => {
			if (selectedEquipment) {
				// 首先检查传入的customMethods中是否有当前器具的方法
				const methodsFromProps = customMethods[selectedEquipment] || [];
				
				if (methodsFromProps.length > 0) {
					// 如果传入的customMethods中有数据，优先使用它
					setCurrentEquipmentCustomMethods(methodsFromProps);
				} else {
					// 如果传入的customMethods中没有数据，才从存储中加载
					try {
						const methods = await loadCustomMethodsForEquipment(selectedEquipment);
						setCurrentEquipmentCustomMethods(methods);
					} catch (error) {
						console.error('[useBrewingContent] 加载自定义方法失败:', error);
						setCurrentEquipmentCustomMethods([]);
					}
				}
			}
		};
		
		updateCustomMethods();
	}, [selectedEquipment, customMethods]); // 添加customMethods作为依赖

	// 更新方案列表内容
	useEffect(() => {
		if (selectedEquipment) {
			setContent((prev) => {
				// 首先，尝试通过ID查找自定义器具（优先使用ID匹配）
				const customEquipmentById = customEquipments?.find(e => e.id === selectedEquipment);
				
				// 如果通过ID没找到，再尝试通过名称查找
				const customEquipmentByName = !customEquipmentById 
					? customEquipments?.find(e => e.name === selectedEquipment) 
					: null;
				
				// 合并结果，优先使用ID匹配的结果
				const customEquipment = customEquipmentById || customEquipmentByName;
				
				// 确认是否为自定义器具
				const isCustomEquipment = !!customEquipment;
				
				// 检查是否是自定义预设器具（animationType === 'custom'）
				const isCustomPresetEquipment = customEquipment?.animationType === 'custom';
				
				// 获取对应的方案列表
				let methodsForEquipment: Method[] = [];
				
				// 如果是自定义预设器具，只使用自定义方案（无论methodType是什么）
				if (isCustomPresetEquipment) {
					// 强制使用当前设备的自定义方法
					methodsForEquipment = currentEquipmentCustomMethods;
				}
				// 其他情况按原有逻辑处理
				else if (methodType === 'custom') {
					// 使用当前设备的自定义方法
					methodsForEquipment = currentEquipmentCustomMethods;
				} else {
					// 如果是自定义器具，根据其 animationType 使用对应的通用方案
					if (isCustomEquipment) {
						// 尝试通过 ID 或名称查找自定义器具
						if (customEquipment) {
							// 根据 animationType 获取对应的通用方案 ID
							let baseEquipmentId = '';
							const animationType = customEquipment.animationType.toLowerCase();
							
							switch (animationType) {
								case 'v60':
									baseEquipmentId = 'V60';
									break;
								case 'kalita':
									baseEquipmentId = 'Kalita';
									break;
								case 'origami':
									baseEquipmentId = 'Origami';
									break;
								case 'clever':
									baseEquipmentId = 'CleverDripper';
									break;
								default:
									baseEquipmentId = 'V60'; // 默认使用 V60 的方案
							}
							// 使用基础器具的通用方案
							methodsForEquipment = commonMethods[baseEquipmentId] || [];
						}
					} else {
						// 对于预定义器具，直接使用其通用方案
						methodsForEquipment = commonMethods[selectedEquipment as keyof typeof commonMethods] || [];
						
						// 如果未找到方法但是使用自定义器具ID，尝试从ID推断基础器具类型
						if (methodsForEquipment.length === 0 && selectedEquipment && selectedEquipment.startsWith('custom-')) {
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
							
							// 如果识别出基础器具类型，使用对应的通用方法
							if (baseEquipmentId && commonMethods[baseEquipmentId]) {
								methodsForEquipment = commonMethods[baseEquipmentId] || [];
							}
						}
					}
				}

				const steps = (isCustomPresetEquipment || methodType === "custom")
					? methodsForEquipment.map((method) => ({
							title: method.name,
							methodId: method.id,
							items: [
								`水粉比 ${method.params.ratio}`,
								`总时长 ${formatTime(
									method.params.stages[
										method.params.stages
											.length - 1
									].time,
									true
								)}`,
								`研磨度 ${formatGrindSize(
									method.params.grindSize,
									settings.grindType
								)}`,
							],
							note: "",
					  }))
					: methodsForEquipment.map((method, methodIndex) => {
							const totalTime =
								method.params.stages[
									method.params.stages.length - 1
								].time;
							return {
								title: method.name,
								methodId: method.id,
								isCommonMethod: true,
								methodIndex: methodIndex,
								items: [
									`水粉比 ${method.params.ratio}`,
									`总时长 ${formatTime(
										totalTime,
										true
									)}`,
									`研磨度 ${formatGrindSize(
										method.params.grindSize,
										settings.grindType
									)}`,
								],
								note: "",
							};
					  });
				
				const result = {
					...prev,
					方案: {
						// 如果是自定义预设器具，总是显示为自定义方案类型
						type: isCustomPresetEquipment ? 'custom' : methodType,
						steps: steps
					},
				};
				
				return result;
			});
		}
	}, [
		selectedEquipment,
		methodType,
		settings.grindType,
		customEquipments,
		currentEquipmentCustomMethods, // 添加依赖，确保currentEquipmentCustomMethods变化时更新content
	]);

	// 更新注水步骤内容
	const updateBrewingSteps = (stages: Stage[]) => {
		// 创建扩展阶段数组
		const expandedStages: {
			type: "pour" | "wait";
			label: string;
			water: string;
			detail: string;
			startTime: number; // 开始时间
			endTime: number; // 结束时间
			time: number; // 阶段持续时间
			pourTime?: number; // 注水时间
			originalIndex: number;
			pourType?: string; // 改为string类型以兼容config.ts
			valveStatus?: "open" | "closed";
		}[] = [];

		// 按照BrewingTimer的逻辑扩展阶段
		stages.forEach((stage, index) => {
			const prevStageTime = index > 0 ? stages[index - 1].time : 0;
			const stagePourTime =
				stage.pourTime === 0
					? 0
					: stage.pourTime ||
					  Math.floor((stage.time - prevStageTime) / 3);

			// 如果pourTime明确设置为0，直接添加一个等待阶段而不拆分
			if (stage.pourTime === 0) {
				expandedStages.push({
					type: "wait",
					label: stage.label,
					water: stage.water,
					detail: stage.detail,
					startTime: prevStageTime,
					endTime: stage.time,
					time: stage.time - prevStageTime,
					pourType: stage.pourType,
					valveStatus: stage.valveStatus,
					originalIndex: index,
				});
			}
			// 如果有注水时间，添加一个注水阶段
			else if (stagePourTime > 0) {
				// 创建注水阶段
				expandedStages.push({
					type: "pour",
					label: stage.label,
					water: stage.water,
					detail: stage.detail,
					startTime: prevStageTime,
					endTime: prevStageTime + stagePourTime,
					time: stagePourTime,
					pourTime: stagePourTime,
					pourType: stage.pourType,
					valveStatus: stage.valveStatus,
					originalIndex: index,
				});

				// 只有当注水结束时间小于阶段结束时间时，才添加等待阶段
				if (prevStageTime + stagePourTime < stage.time) {
					// 创建等待阶段
					expandedStages.push({
						type: "wait",
						label: "等待",
						water: stage.water, // 水量与前一阶段相同
						detail: "",
						startTime: prevStageTime + stagePourTime,
						endTime: stage.time,
						time: stage.time - (prevStageTime + stagePourTime),
						pourType: stage.pourType, // 保留注水类型以便视觉一致性
						valveStatus: stage.valveStatus,
						originalIndex: index,
					});
				}
			} else {
				// 如果没有注水时间，只添加一个等待阶段
				expandedStages.push({
					type: "wait",
					label: "等待",
					water: stage.water,
					detail: "",
					startTime: prevStageTime,
					endTime: stage.time,
					time: stage.time - prevStageTime,
					pourType: stage.pourType,
					valveStatus: stage.valveStatus,
					originalIndex: index,
				});
			}
		});

		// 更新content的注水部分
		setContent((prev) => ({
			...prev,
			注水: {
				steps: expandedStages.map((stage) => ({
					title: stage.label,
					items: [`${stage.water}`, stage.detail],
					note: stage.endTime - stage.startTime + "秒", // 显示当前阶段的时长
					type: stage.type, // 添加类型标记
					originalIndex: stage.originalIndex, // 保留原始索引以便于参考
					startTime: stage.startTime, // 保存开始时间
					endTime: stage.endTime, // 保存结束时间
				})),
			},
		}));
	};

	// 当选择方法时更新注水步骤内容
	useEffect(() => {
		if (selectedMethod && selectedMethod.params.stages) {
			updateBrewingSteps(selectedMethod.params.stages);
		}
	}, [selectedMethod]);

	return {
		content,
		setContent,
		updateBrewingSteps,
		formatTime,
		currentEquipmentCustomMethods, // 导出当前设备的自定义方法
	};
}

// 定义Stage类型，并导出供其他模块使用
export interface Stage {
	label: string;
	water: string;
	detail: string;
	time: number;
	pourTime?: number;
	pourType?: string; // 改为string类型以与config.ts兼容
	valveStatus?: "open" | "closed";
}
