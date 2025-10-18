import { useState, useEffect } from "react";
import {
	Method,
	brewingMethods as commonMethods,
	CustomEquipment,
} from "@/lib/core/config";
import { Content } from "./useBrewingState";
import { formatGrindSize } from "@/lib/utils/grindUtils";
import { SettingsOptions } from "@/components/settings/Settings";
import { loadCustomMethodsForEquipment } from "@/lib/managers/customMethods";
import { Stage } from '@/components/method/forms/components/types';

// 增强 Content.注水.steps 接口以支持 pourType
declare module "./useBrewingState" {
	interface Step {
		pourType?: string;
	}
}

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
			steps: [],
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

				// 检查是否是意式机类型（animationType === 'espresso' 或系统意式机）
				const _isEspressoEquipment = 
					customEquipment?.animationType === 'espresso' || 
					selectedEquipment === 'Espresso';

				// 现在我们将获取两种方案列表
				let customMethodsForEquipment: Method[] = [];
				let commonMethodsForEquipment: Method[] = [];

				// 总是获取自定义方案
				customMethodsForEquipment = currentEquipmentCustomMethods;

				// 获取通用方案
				{
					if (isCustomEquipment && customEquipment) {
						// 自定义器具，根据animationType获取对应的通用方案
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
							case 'espresso':
								baseEquipmentId = 'Espresso';
								break;
							case 'custom':
								// 自定义预设器具不使用任何通用方案
								baseEquipmentId = '';
								break;
							default:
								baseEquipmentId = 'V60'; // 默认使用 V60 的方案
						}

						if (baseEquipmentId) {
							commonMethodsForEquipment = commonMethods[baseEquipmentId] || [];
						} else {
							commonMethodsForEquipment = [];
						}
					} else {
						// 预定义器具，直接使用其通用方案
						commonMethodsForEquipment = commonMethods[selectedEquipment as keyof typeof commonMethods] || [];

						// 从ID推断器具类型的逻辑保持不变
						if (commonMethodsForEquipment.length === 0 && selectedEquipment && selectedEquipment.startsWith('custom-')) {
							let baseEquipmentId = '';

							if (selectedEquipment.includes('-v60-')) {
								baseEquipmentId = 'V60';
							} else if (selectedEquipment.includes('-clever-')) {
								baseEquipmentId = 'CleverDripper';
							} else if (selectedEquipment.includes('-kalita-')) {
								baseEquipmentId = 'Kalita';
							} else if (selectedEquipment.includes('-origami-')) {
								baseEquipmentId = 'Origami';
							} else if (selectedEquipment.includes('-espresso-')) {
								baseEquipmentId = 'Espresso';
							}

							if (baseEquipmentId && commonMethods[baseEquipmentId]) {
								commonMethodsForEquipment = commonMethods[baseEquipmentId] || [];
							}
						}
					}
				}

				// 准备两个方案列表
				const customMethodSteps = customMethodsForEquipment.map(method => {
					// 检查是否是意式咖啡方案
					const isEspressoMethod = method.params.stages.some(stage =>
						stage.pourType === 'extraction' ||
						stage.pourType === 'beverage'
					);

					// 计算总时长
					let totalTime = 0;
					if (isEspressoMethod) {
						// 对于意式咖啡，只计算萃取步骤的时间
						const extractionStage = method.params.stages.find(stage => stage.pourType === 'extraction');
						totalTime = extractionStage?.time || 0;
					} else {
						// 对于常规方法，使用最后一个步骤的时间
						totalTime = method.params.stages[method.params.stages.length - 1]?.time || 0;
					}

					// 针对不同类型的方案显示不同的信息
					let items: string[] = [];
					if (isEspressoMethod) {
						// 意式咖啡方案显示: 粉量、液重、萃取时间
						const extractionStage = method.params.stages.find(stage => stage.pourType === 'extraction');
						items = [
							`粉量 ${method.params.coffee}`,
							`液重 ${extractionStage?.water || method.params.water}`,
							`萃取时间 ${formatTime(totalTime, true)}`,
						];
					} else {
						// 传统方案显示: 水粉比、总时长、研磨度
						items = [
							`水粉比 ${method.params.ratio}`,
							`总时长 ${formatTime(totalTime, true)}`,
							`研磨度 ${formatGrindSize(method.params.grindSize, settings.grindType, settings.customGrinders as Record<string, unknown>[] | undefined)}`,
						];
					}

					return {
						title: method.name,
						methodId: method.id,
						items: items,
						note: "",
						isCustom: true, // 标记为自定义方案
					};
				});

				// 通用方案列表
				const commonMethodSteps = commonMethodsForEquipment.map((method, methodIndex) => {
					// 检查是否是意式咖啡方案
					const isEspressoMethod = method.params.stages.some(stage =>
						stage.pourType === 'extraction' ||
						stage.pourType === 'beverage'
					);

					// 计算总时长
					let totalTime = 0;
					if (isEspressoMethod) {
						// 对于意式咖啡，只计算萃取步骤的时间
						const extractionStage = method.params.stages.find(stage => stage.pourType === 'extraction');
						totalTime = extractionStage?.time || 0;
					} else {
						// 对于常规方法，使用最后一个步骤的时间
						totalTime = method.params.stages[method.params.stages.length - 1]?.time || 0;
					}

					// 针对不同类型的方案显示不同的信息
					let items: string[] = [];
					if (isEspressoMethod) {
						// 意式咖啡方案显示: 粉量、液重、萃取时间
						const extractionStage = method.params.stages.find(stage => stage.pourType === 'extraction');
						items = [
							`粉量 ${method.params.coffee}`,
							`液重 ${extractionStage?.water || method.params.water}`,
							`萃取时间 ${formatTime(totalTime, true)}`,
						];
					} else {
						// 传统方案显示: 水粉比、总时长、研磨度
						items = [
							`水粉比 ${method.params.ratio}`,
							`总时长 ${formatTime(totalTime, true)}`,
							`研磨度 ${formatGrindSize(method.params.grindSize, settings.grindType, settings.customGrinders as Record<string, unknown>[] | undefined)}`,
						];
					}

					return {
						title: method.name,
						methodId: method.id,
						isCommonMethod: true, // 标记为通用方案
						methodIndex: methodIndex,
						items: items,
						note: "",
					};
				});

				// 合并所有步骤：自定义方案 + 分隔符 + 通用方案
				const dividerStep = (customMethodSteps.length > 0 && commonMethodSteps.length > 0) ? [{
					title: "",
					items: [],
					note: "",
					isDivider: true,
					dividerText: "通用方案",
				}] : [];

				const steps = [
					...customMethodSteps,  // 先显示自定义方案
					...dividerStep,        // 添加分隔符
					...commonMethodSteps   // 再显示通用方案
				];

				const result = {
					...prev,
					方案: {
						// 由于已经合并了两种方案，这里的type不再那么重要
						// 但为了兼容性，保留此属性
						type: methodType,
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
		settings.customGrinders,
		customEquipments,
		currentEquipmentCustomMethods, // 添加依赖，确保currentEquipmentCustomMethods变化时更新content
	]);

	// 更新注水步骤内容
	const updateBrewingSteps = (stages: Stage[]) => {
		// 检查是否是意式机预设的步骤
		const isEspressoStages = stages.some(stage =>
			stage.pourType === 'extraction' ||
			stage.pourType === 'beverage'
		);

		// 如果是意式机，使用特殊的处理逻辑
		if (isEspressoStages) {
			// 意式机的步骤不需要拆分注水和等待
			const espressoSteps = stages.map(stage => {
				// 基本步骤信息
				const baseStep = {
					title: stage.label,
					items: stage.pourType === 'other'
						? [stage.detail] // other类型只显示说明
						: [`${stage.water}`, stage.detail], // 其他类型显示水量和说明
					originalIndex: stages.indexOf(stage), // 保留原始索引以便于参考
					pourType: stage.pourType, // 使用统一的pourType字段
				};

				// 根据pourType类型添加不同的属性
				if (stage.pourType === 'extraction') {
					return {
						...baseStep,
						note: `${stage.time}秒`, // 萃取类型显示时间
						type: 'pour' as const, // 使用有效的类型
						startTime: 0, // 萃取从0开始
						endTime: stage.time, // 萃取结束时间
					};
				} else {
					// beverage或其他类型不参与计时
					return {
						...baseStep,
						note: '', // 不显示时间
						type: undefined, // 不是pour或wait类型
						startTime: undefined, // 没有开始时间
						endTime: undefined, // 没有结束时间
					};
				}
			});

			// 更新content的注水部分
			setContent((prev) => ({
				...prev,
				注水: {
					steps: espressoSteps,
				},
			}));

			return;
		}

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
			// Bypass 类型的步骤不参与主要计时，单独处理
			if (stage.pourType === 'bypass') {
				expandedStages.push({
					type: "pour", // 标记为注水类型，但不参与计时
					label: stage.label,
					water: stage.water,
					detail: stage.detail,
					startTime: -1, // 特殊标记，表示不参与计时
					endTime: -1,
					time: 0,
					pourType: stage.pourType,
					originalIndex: index,
				});
				return;
			}

			const prevStageTime = index > 0 ? (stages[index - 1]?.time || 0) : 0;
			const stageTime = stage.time || 0;
			const stagePourTime =
				stage.pourTime === 0
					? 0
					: stage.pourTime ||
					  Math.floor((stageTime - prevStageTime) / 3);

			// 如果pourTime明确设置为0，直接添加一个等待阶段而不拆分
			if (stage.pourTime === 0) {
				expandedStages.push({
					type: "wait",
					label: stage.label,
					water: stage.water,
					detail: stage.detail,
					startTime: prevStageTime,
					endTime: stageTime,
					time: stageTime - prevStageTime,
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
				if (prevStageTime + stagePourTime < stageTime) {
					// 创建等待阶段
					expandedStages.push({
						type: "wait",
						label: "等待",
						water: stage.water, // 水量与前一阶段相同
						detail: "",
						startTime: prevStageTime + stagePourTime,
						endTime: stageTime,
						time: stageTime - (prevStageTime + stagePourTime),
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
					endTime: stageTime,
					time: stageTime - prevStageTime,
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
					note: stage.pourType === 'bypass'
						? '' // Bypass 步骤不显示时间
						: stage.endTime - stage.startTime + "秒", // 显示当前阶段的时长
					type: stage.type, // 添加类型标记
					originalIndex: stage.originalIndex, // 保留原始索引以便于参考
					startTime: stage.startTime, // 保存开始时间
					endTime: stage.endTime, // 保存结束时间
					pourType: stage.pourType, // 添加注水类型标记
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
