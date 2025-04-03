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
	customMethods,
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

	// 更新方案列表内容
	useEffect(() => {
		if (selectedEquipment) {
			setContent((prev) => {
				// 检查是否是自定义器具
				console.log('选中的器具:', selectedEquipment);
				console.log('自定义器具列表:', customEquipments);
				console.log('自定义器具的 ID:', customEquipments.map(e => e.id));
				
				// 尝试通过 ID 或名称匹配自定义器具
				const isCustomEquipment = customEquipments?.some(e => 
					e.id === selectedEquipment || 
					e.name === selectedEquipment
				);
				
				console.log('是否是自定义器具:', isCustomEquipment);
				console.log('当前方案类型:', methodType);
				
				// 获取对应的方案列表
				let methodsForEquipment: Method[] = [];
				if (methodType === 'custom') {
					methodsForEquipment = customMethods[selectedEquipment] || [];
					console.log('自定义方案:', methodsForEquipment);
				} else {
					// 如果是自定义器具，根据其 animationType 使用对应的通用方案
					if (isCustomEquipment) {
						// 尝试通过 ID 或名称查找自定义器具
						const customEquipment = customEquipments?.find(e => 
							e.id === selectedEquipment || 
							e.name === selectedEquipment
						);
						console.log('找到的自定义器具:', customEquipment);
						
						if (customEquipment) {
							// 根据 animationType 获取对应的通用方案 ID
							let baseEquipmentId = '';
							const animationType = customEquipment.animationType.toLowerCase();
							console.log('动画类型:', animationType);
							
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
									console.warn('未知的动画类型:', animationType);
									baseEquipmentId = 'V60'; // 默认使用 V60 的方案
							}
							console.log('基础器具ID:', baseEquipmentId);
							console.log('可用的通用方案:', Object.keys(commonMethods));
							// 使用基础器具的通用方案
							methodsForEquipment = commonMethods[baseEquipmentId] || [];
							console.log('获取到的通用方案:', methodsForEquipment);
						}
					} else {
						// 对于预定义器具，直接使用其通用方案
						methodsForEquipment = commonMethods[selectedEquipment as keyof typeof commonMethods] || [];
						console.log('预定义器具的通用方案:', methodsForEquipment);
					}
				}

				const result = {
					...prev,
					方案: {
						type: methodType,
						steps:
							methodType === "common"
								? methodsForEquipment.map((method, methodIndex) => {
										const totalTime =
											method.params.stages[
												method.params.stages.length - 1
											].time;
										return {
											title: method.name,
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
											// 添加方法索引，方便点击事件处理
											methodIndex: methodIndex,
											// 只为自定义器具的通用方案添加标识
											isCommonMethod: isCustomEquipment
										};
								  })
								: methodsForEquipment.map((method) => ({
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
								  })),
					},
				};
				console.log('最终返回的内容:', result);
				return result;
			});
		}
	}, [selectedEquipment, methodType, customMethods, settings.grindType, customEquipments]);

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
			pourType?: "center" | "circle" | "ice" | "other";
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
						detail: "保持耐心，等待咖啡萃取",
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
					detail: "保持耐心，等待咖啡萃取",
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
	};
}

// 定义Stage类型，并导出供其他模块使用
export interface Stage {
	label: string;
	water: string;
	detail: string;
	time: number;
	pourTime?: number;
	pourType?: "center" | "circle" | "ice" | "other";
	valveStatus?: "open" | "closed";
}
