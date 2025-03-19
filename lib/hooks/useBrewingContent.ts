import { useState, useEffect } from "react";
import {
	Method,
	brewingMethods as commonMethods,
	equipmentList,
} from "@/lib/config";
import { Content } from "./useBrewingState";

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
}

export function useBrewingContent({
	selectedEquipment,
	methodType,
	customMethods,
	selectedMethod,
}: UseBrewingContentProps) {
	const initialContent: Content = {
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
												`研磨度 ${method.params.grindSize}`,
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
											`研磨度 ${method.params.grindSize}`,
										],
										note: "",
								  })),
					},
				};
			});
		}
	}, [selectedEquipment, methodType, customMethods]);

	// 更新注水步骤内容
	const updateBrewingSteps = (
		stages: Array<{
			label: string;
			water: string;
			detail: string;
			time: number;
		}>
	) => {
		setContent((prev) => ({
			...prev,
			注水: {
				steps: stages.map((stage) => ({
					title: stage.label,
					items: [`${stage.water}`, stage.detail],
					note: stage.time + "秒",
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
