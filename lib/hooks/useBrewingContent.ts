import { useState, useEffect } from "react";
import {
	Method,
	brewingMethods as commonMethods,
	equipmentList,
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
}

export function useBrewingContent({
	selectedEquipment,
	methodType,
	customMethods,
	selectedMethod,
	settings,
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
			steps: equipmentList.map((equipment) => ({
				title: equipment.name,
				items: equipment.description,
				note: equipment.note || "",
			})),
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

	// 更新方案列表内容
	useEffect(() => {
		if (selectedEquipment) {
			setContent((prev) => {
				const methodsForEquipment =
					methodType === "custom"
						? customMethods[selectedEquipment] || []
						: commonMethods[
								selectedEquipment as keyof typeof commonMethods
						  ] || [];

				return {
					...prev,
					方案: {
						type: methodType,
						steps:
							methodType === "common"
								? methodsForEquipment.map((method) => {
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
			});
		}
	}, [selectedEquipment, methodType, customMethods, settings.grindType]);

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

			// 如果有注水时间，添加一个注水阶段
			if (stagePourTime > 0) {
				// 创建注水阶段
				expandedStages.push({
					type: "pour",
					label: stage.label,
					water: stage.water,
					detail: stage.detail,
					startTime: prevStageTime,
					endTime: prevStageTime + stagePourTime,
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
