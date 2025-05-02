import { useState, useCallback, useRef, useEffect } from "react";
import { Method, equipmentList, Stage, commonMethods, CustomEquipment } from "@/lib/config";
import { Storage } from "@/lib/storage";
import { BrewingNoteData, CoffeeBean } from "@/types/app";
import {
	loadCustomMethods,
	saveCustomMethod as apiSaveCustomMethod,
	deleteCustomMethod as apiDeleteCustomMethod,
} from "@/lib/customMethods";
import { loadCustomEquipments } from "@/lib/customEquipments";
import { CoffeeBeanManager } from "@/lib/coffeeBeanManager";
import {
	BREWING_EVENTS,
	NavigationOptions,
	STEP_RULES,
} from "../brewing/constants";
import { emitEvent } from "../brewing/events";
import { updateParameterInfo } from "../brewing/parameters";

// 定义标签类型
export type TabType = "咖啡豆" | "器具" | "方案" | "注水" | "记录";

// 添加新的主导航类型
export type MainTabType = "冲煮" | "笔记" | "咖啡豆";

// 修改冲煮步骤类型
export type BrewingStep =
	| "coffeeBean"
	| "equipment"
	| "method"
	| "brewing"
	| "notes";

export interface Step {
	title: string;
	description?: string;
	methodId?: string;
	isCustom?: boolean;
	items?: string[];
	note?: string;
	time?: number;
	pourTime?: number;
	water?: string;
	detail?: string;
	pourType?: string;
	valveStatus?: "open" | "closed";
	originalIndex?: number;
	type?: "pour" | "wait";
	startTime?: number;
	endTime?: number;
	isCommonMethod?: boolean;
	methodIndex?: number;
}

export interface Content {
	咖啡豆: {
		steps: Step[];
	};
	器具: {
		steps: Step[];
	};
	方案: {
		steps: Step[];
		type: "common" | "custom";
	};
	注水: {
		steps: Step[];
	};
	记录: {
		steps: Step[];
	};
}

export function useBrewingState(initialBrewingStep?: BrewingStep) {
	// 添加主导航状态
	const [activeMainTab, setActiveMainTab] = useState<MainTabType>("冲煮");
	// 修改默认步骤为器具或传入的参数
	const [activeBrewingStep, setActiveBrewingStep] = useState<BrewingStep>(
		initialBrewingStep || "equipment"
	);
	const [activeTab, setActiveTab] = useState<TabType>(
		initialBrewingStep === "coffeeBean" ? "咖啡豆" : "器具"
	);

	// 添加咖啡豆选择状态
	const [selectedCoffeeBean, setSelectedCoffeeBean] = useState<string | null>(
		null
	);
	const [selectedCoffeeBeanData, setSelectedCoffeeBeanData] =
		useState<CoffeeBean | null>(null);

	const [selectedEquipment, setSelectedEquipment] = useState<string | null>(
		null
	);
	const [selectedMethod, setSelectedMethod] = useState<Method | null>(null);
	const [currentBrewingMethod, setCurrentBrewingMethod] =
		useState<Method | null>(null);

	const [isTimerRunning, setIsTimerRunning] = useState(false);
	const [currentStage, setCurrentStage] = useState(-1);
	const [showHistory, setShowHistory] = useState(false);
	const [showComplete, setShowComplete] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);

	const [methodType, setMethodType] = useState<"common" | "custom">("common");

	const [countdownTime, setCountdownTime] = useState<number | null>(null);
	const [isPourVisualizerPreloaded] = useState(false);
	const [customMethods, setCustomMethods] = useState<
		Record<string, Method[]>
	>({});

	const [showCustomForm, setShowCustomForm] = useState(false);
	const [editingMethod, setEditingMethod] = useState<Method | undefined>(
		undefined
	);
	// 添加一个新的状态来跟踪每个卡片的菜单状态
	const [actionMenuStates, setActionMenuStates] = useState<
		Record<string, boolean>
	>({});
	// 添加导入方案表单状态
	const [showImportForm, setShowImportForm] = useState(false);
	// 添加笔记保存状态追踪
	const [isNoteSaved, setIsNoteSaved] = useState(false);

	// 在PourOverRecipes组件的开头添加前一个标签的引用
	const prevMainTabRef = useRef<MainTabType | null>(null);

	// 添加自定义器具状态
	const [customEquipments, setCustomEquipments] = useState<CustomEquipment[]>([]);

	// 加载自定义器具
	useEffect(() => {
		const loadEquipments = async () => {
			try {
				const equipments = await loadCustomEquipments();
				setCustomEquipments(equipments);
			} catch (error) {
				console.error('加载自定义器具失败:', error);
			}
		};

		loadEquipments();
	}, []);

	// 检查步骤导航前置条件
	const checkPrerequisites = useCallback(
		(step: BrewingStep): boolean => {
			const prerequisites = STEP_RULES.prerequisites[step];

			// 检查每个前置条件
			for (const prereq of prerequisites) {
				if (prereq === "equipment" && !selectedEquipment) {
					return false;
				}
				if (prereq === "method" && !selectedMethod) {
					return false;
				}
				if (prereq === "brewing" && activeBrewingStep !== "brewing") {
					return false;
				}
				if (prereq === "showComplete" && !showComplete) {
					return false;
				}
			}

			return true;
		},
		[selectedEquipment, selectedMethod, activeBrewingStep, showComplete]
	);

	// 处理特殊导航情况
	const handleSpecialCases = useCallback(
		(step: BrewingStep): boolean => {
			// 特殊情况1：从记录返回到注水
			if (activeBrewingStep === "notes" && step === "brewing") {
				// 完全保留所有参数，只改变当前步骤
				setActiveBrewingStep("brewing");
				setActiveTab("注水");

				// 重置部分冲煮状态，但保留方法和参数
				setIsTimerRunning(false);
				setCurrentStage(0);
				// 不重置showComplete，以便用户可以返回记录页面
				setCurrentTime(showComplete ? currentTime : 0);
				setCountdownTime(null);

				// 发送关闭记录表单事件
				emitEvent(BREWING_EVENTS.NOTES_FORM_CLOSE, { force: true });

				// 更新参数栏信息 - 显示所有参数，传入自定义器具列表
				updateParameterInfo(
					"brewing",
					selectedEquipment,
					selectedMethod,
					equipmentList,
					customEquipments
				);

				// 设置标记，标识这是从记录到注水的特殊跳转
				localStorage.setItem("fromNotesToBrewing", "true");

				return true;
			}

			// 特殊情况2：从注水返回到记录（冲煮完成后）
			if (
				activeBrewingStep === "brewing" &&
				step === "notes" &&
				showComplete
			) {
				// 完全保留所有参数，只改变当前步骤
				setActiveBrewingStep("notes");
				setActiveTab("记录");

				// 显示记录表单，使用正确的事件名
				emitEvent("showBrewingNoteForm", {});

				// 确保在localStorage中记录状态
				localStorage.setItem("brewingNoteInProgress", "true");

				// 更新参数栏信息 - 保持不变，传入自定义器具列表
				updateParameterInfo(
					"notes",
					selectedEquipment,
					selectedMethod,
					equipmentList,
					customEquipments
				);

				return true;
			}

			return false;
		},
		[
			activeBrewingStep,
			showComplete,
			currentTime,
			setActiveBrewingStep,
			setActiveTab,
			setIsTimerRunning,
			setCurrentStage,
			setCurrentTime,
			setCountdownTime,
			selectedEquipment,
			selectedMethod,
			customEquipments,
		]
	);

	// 更新状态函数
	const updateStates = useCallback(
		(
			step: BrewingStep,
			resetParams: boolean,
			preserveStates: string[],
			preserveCoffeeBean: boolean,
			preserveEquipment: boolean,
			preserveMethod: boolean
		) => {
			// 如果不需要重置参数，直接返回
			if (!resetParams) return;

			// 合并需要保留的状态
			const statesToPreserve = [
				...STEP_RULES.preservedStates[step],
				...preserveStates,
				...(preserveCoffeeBean
					? ["selectedCoffeeBean", "selectedCoffeeBeanData"]
					: []),
				...(preserveEquipment ? ["selectedEquipment"] : []),
				...(preserveMethod
					? ["selectedMethod", "currentBrewingMethod"]
					: []),
			];

			// 重置状态，保留需要保留的状态
			if (
				!statesToPreserve.includes("selectedCoffeeBean") &&
				!statesToPreserve.includes("all")
			) {
				setSelectedCoffeeBean(null);
				setSelectedCoffeeBeanData(null);
			}

			if (
				!statesToPreserve.includes("selectedEquipment") &&
				!statesToPreserve.includes("all")
			) {
				setSelectedEquipment(null);
			}

			if (
				!statesToPreserve.includes("selectedMethod") &&
				!statesToPreserve.includes("all")
			) {
				setSelectedMethod(null);
				setCurrentBrewingMethod(null);
			}

			// 重置计时相关状态
			setIsTimerRunning(false);
			setCurrentStage(0);
			setShowComplete(false);
			setCurrentTime(0);
			setCountdownTime(null);
		},
		[
			setSelectedCoffeeBean,
			setSelectedCoffeeBeanData,
			setSelectedEquipment,
			setSelectedMethod,
			setCurrentBrewingMethod,
			setIsTimerRunning,
			setCurrentStage,
			setShowComplete,
			setCurrentTime,
			setCountdownTime,
		]
	);

	// 统一的步骤导航函数
	const navigateToStep = useCallback(
		(step: BrewingStep, options?: NavigationOptions) => {
			const {
				force = false,
				resetParams = false,
				preserveStates = [],
				preserveMethod = false,
				preserveEquipment = false,
				preserveCoffeeBean = false,
			} = options || {};

			// 如果当前不在冲煮标签，先切换回冲煮标签
			if (activeMainTab !== "冲煮") {
				setActiveMainTab("冲煮");
				setShowHistory(false);
				// 在状态更新后再处理步骤点击，避免状态不一致
				setTimeout(() => navigateToStep(step, options), 0);
				return false;
			}

			// 如果计时器正在运行且未完成，不允许切换步骤（除非强制）
			if (isTimerRunning && !showComplete && !force) {
				return false;
			}

			// 获取特殊标记
			const fromMethodToBrewing = localStorage.getItem(
				"fromMethodToBrewing"
			);

			// 清除fromNotesToBrewing标记，但暂时保留fromMethodToBrewing标记
			localStorage.removeItem("fromNotesToBrewing");

			// 特殊处理：当有fromMethodToBrewing标记时，如果从注水返回到方案步骤，允许自由导航
			if (
				fromMethodToBrewing === "true" &&
				activeBrewingStep === "brewing" &&
				step === "method"
			) {
				// 成功处理了特殊情况，现在可以清除标记
				localStorage.removeItem("fromMethodToBrewing");

				// 设置步骤
				setActiveBrewingStep(step);
				// 设置对应的标签
				setActiveTab(STEP_RULES.tabMapping[step]);
				// 发送步骤变化事件
				emitEvent(BREWING_EVENTS.STEP_CHANGED, {
					step,
					resetParams: false,
					preserveStates: ["all"],
					preserveCoffeeBean: true,
					preserveEquipment: true,
					preserveMethod: true,
				});

				// 更新参数栏信息，传入自定义器具列表
				updateParameterInfo(
					step,
					selectedEquipment,
					selectedMethod,
					equipmentList,
					customEquipments
				);

				return true;
			}

			// 如果不需要特殊处理，现在可以安全地清除fromMethodToBrewing标记
			localStorage.removeItem("fromMethodToBrewing");

			// 处理特殊情况
			if (handleSpecialCases(step)) {
				// 特殊情况已处理
				return true;
			}

			// 检查前置条件
			if (!force && !checkPrerequisites(step)) {
				return false;
			}

			// 更新状态
			updateStates(
				step,
				resetParams,
				preserveStates,
				preserveCoffeeBean,
				preserveEquipment,
				preserveMethod
			);

			// 设置步骤
			setActiveBrewingStep(step);

			// 设置对应的标签
			setActiveTab(STEP_RULES.tabMapping[step]);

			// 发送步骤变化事件
			emitEvent(BREWING_EVENTS.STEP_CHANGED, {
				step,
				resetParams,
				preserveStates,
				preserveCoffeeBean,
				preserveEquipment,
				preserveMethod,
			});

			// 更新参数栏信息，传入自定义器具列表
			updateParameterInfo(
				step,
				selectedEquipment,
				selectedMethod,
				equipmentList,
				customEquipments
			);

			return true;
		},
		[
			activeMainTab,
			activeBrewingStep,
			isTimerRunning,
			showComplete,
			setActiveMainTab,
			setShowHistory,
			checkPrerequisites,
			handleSpecialCases,
			updateStates,
			setActiveBrewingStep,
			setActiveTab,
			selectedEquipment,
			selectedMethod,
			customEquipments,
		]
	);

	// 重置冲煮状态函数
	const resetBrewingState = useCallback(
		(preserveMethod = false) => {
			// 如果是从记录页面返回到注水页面的特殊情况，不执行重置
			const fromNotesToBrewing =
				localStorage.getItem("fromNotesToBrewing");
			if (fromNotesToBrewing === "true") {
				// 清除标记
				localStorage.removeItem("fromNotesToBrewing");

				return;
			}

			if (!preserveMethod) {
				// 完全重置所有状态

				navigateToStep("equipment", { resetParams: true });

				// 确保参数栏信息被清空，传入自定义器具列表
				updateParameterInfo("equipment", null, null, equipmentList, customEquipments);
			} else {
				// 部分重置状态，但保留已选方案、咖啡豆和参数

				// 检查是否有已经选择的方案和咖啡豆
				if (selectedMethod) {
					// 返回到注水步骤而不是方案步骤
					navigateToStep("brewing", {
						preserveMethod: true,
						preserveEquipment: true,
						preserveCoffeeBean: true,
					});

					// 确保参数栏显示完整信息，传入自定义器具列表
					updateParameterInfo(
						"brewing",
						selectedEquipment,
						selectedMethod,
						equipmentList,
						customEquipments
					);
				} else if (selectedEquipment) {
					// 有设备但无方案，返回到方案步骤
					navigateToStep("method", {
						preserveEquipment: true,
						preserveCoffeeBean: true,
					});

					// 确保参数栏只显示设备信息，传入自定义器具列表
					updateParameterInfo(
						"method",
						selectedEquipment,
						null,
						equipmentList,
						customEquipments
					);
				} else if (selectedCoffeeBean) {
					// 只有咖啡豆，返回到设备步骤
					navigateToStep("equipment", {
						preserveCoffeeBean: true,
					});

					// 确保参数栏被清空，传入自定义器具列表
					updateParameterInfo("equipment", null, null, equipmentList, customEquipments);
				} else {
					// 没有任何选择，从头开始
					navigateToStep("equipment", { resetParams: true });

					// 确保参数栏被清空，传入自定义器具列表
					updateParameterInfo("equipment", null, null, equipmentList, customEquipments);
				}
			}
		},
		[navigateToStep, selectedMethod, selectedEquipment, selectedCoffeeBean, customEquipments]
	);

	// 处理器具选择
	const handleEquipmentSelect = useCallback(
		(equipmentName: string) => {
			// 如果当前在笔记标签，先切换回冲煮标签
			if (activeMainTab !== "冲煮") {
				setActiveMainTab("冲煮");
				setShowHistory(false);
				// 在状态更新后再处理器具选择，避免状态不一致
				setTimeout(() => handleEquipmentSelect(equipmentName), 0);
				return equipmentName;
			}

			// 检查冲煮是否已完成，如果是则重置状态
			if (showComplete) {
				resetBrewingState(true);

				// 触发一个事件通知其他组件冲煮已经重置
				window.dispatchEvent(new CustomEvent("brewing:reset"));
			}

			// 根据设备名称找到对应的设备id
			const equipment =
				equipmentList.find((e) => e.name === equipmentName)?.id ||
				equipmentName;

			// 重置方案相关状态
			setSelectedMethod(null);
			setCurrentBrewingMethod(null);
			setMethodType('common');

			// 设置新的设备
			setSelectedEquipment(equipment);

			// 设置步骤和标签
			setActiveTab("方案");
			setActiveBrewingStep("method");

			// 返回实际的设备名称，以便外部函数使用
			return equipmentName;
		},
		[
			activeMainTab,
			showComplete,
			resetBrewingState,
			setActiveMainTab,
			setShowHistory,
			setSelectedMethod,
			setCurrentBrewingMethod,
			setMethodType,
			setSelectedEquipment,
			setActiveTab,
			setActiveBrewingStep,
		]
	);

	// 加载自定义方案
	useEffect(() => {
		const loadMethods = async () => {
			try {
				const methods = await loadCustomMethods();
				setCustomMethods(methods);
			} catch (_error) {}
		};

		loadMethods();
	}, []);

	// 保存笔记的处理函数
	const handleSaveNote = useCallback(
		async (data: BrewingNoteData) => {
			try {
				const notesStr = await Storage.get("brewingNotes");
				const notes = notesStr ? JSON.parse(notesStr) : [];

				// 确保包含stages数据
				let stages: Stage[] = [];
				if (selectedMethod && selectedMethod.params.stages) {
					stages = selectedMethod.params.stages;
				}

				const newNote = {
					...data,
					id: Date.now().toString(),
					timestamp: Date.now(),
					stages: stages, // 添加stages数据
				};
				const updatedNotes = [newNote, ...notes];
				await Storage.set("brewingNotes", JSON.stringify(updatedNotes));

				// 在保存笔记时扣减咖啡豆用量（冲煮完成后）
				if (selectedCoffeeBean && currentBrewingMethod?.params.coffee) {
					try {
						// 解析最终使用的咖啡粉量
						const match =
							currentBrewingMethod.params.coffee.match(
								/(\d+\.?\d*)/
							);
						if (!match) {
						} else {
							const coffeeAmount = parseFloat(match[1]);
							// 格式化数值，如果没有小数部分则显示整数
							const _formattedAmount = Number.isInteger(
								coffeeAmount
							)
								? coffeeAmount.toString()
								: coffeeAmount.toFixed(1);

							if (!isNaN(coffeeAmount) && coffeeAmount > 0) {
								const updatedBean =
									await CoffeeBeanManager.updateBeanRemaining(
										selectedCoffeeBean,
										coffeeAmount
									);

								if (updatedBean) {
									// 格式化剩余量和容量显示
									// 确保剩余量和容量都是数字类型
									const remainingNum =
										typeof updatedBean.remaining === "string"
												? parseFloat(updatedBean.remaining)
												: updatedBean.remaining ?? 0;

									const capacityNum =
										typeof updatedBean.capacity === "string"
												? parseFloat(updatedBean.capacity)
												: updatedBean.capacity ?? 0;

									const _formattedRemaining =
											Number.isInteger(remainingNum)
													? remainingNum.toString()
													: remainingNum.toFixed(1);

									const _formattedCapacity = Number.isInteger(capacityNum)
											? capacityNum.toString()
											: capacityNum.toFixed(1);
								} else {
								}
							} else {
							}
						}
					} catch (_error) {}
				}

				// 保存后跳转到笔记页面
				setActiveMainTab("笔记");
				setShowHistory(true);

				// 重置冲煮状态
				resetBrewingState();
			} catch (_error) {
				alert("保存笔记时出错，请重试");
			}
		},
		[
			selectedMethod,
			resetBrewingState,
			selectedCoffeeBean,
			currentBrewingMethod,
		]
	);

	// 保存自定义方案
	const handleSaveCustomMethod = useCallback(
		async (method: Method) => {
			try {
				if (!selectedEquipment) {
					throw new Error("未选择设备");
				}

				// 注意：我们使用自定义名称避免与导入的函数命名冲突
				const result = await apiSaveCustomMethod(
					method,
					selectedEquipment,
					customMethods,
					editingMethod
				) as { newCustomMethods: Record<string, Method[]>; methodWithId: Method };

				console.log("[useBrewingState] 方案保存成功，正在更新状态...", {
					methodId: result.methodWithId.id,
					methodName: result.methodWithId.name,
					equipmentId: selectedEquipment,
				});

				// 更新自定义方法列表
				setCustomMethods(result.newCustomMethods);
				
				// 确保选中新创建/编辑的方法
				setSelectedMethod(result.methodWithId);
				
				// 关闭表单
				setShowCustomForm(false);
				setEditingMethod(undefined);

				// 这个关键步骤：更新内容状态以触发UI刷新
				// 生成新的方案列表，确保UI会更新
				const updatedMethodSteps = result.newCustomMethods[selectedEquipment].map((m) => ({
					title: m.name,
					methodId: m.id,
				}));

				// 确保content状态中的方案列表会更新
				setContent((prevContent) => ({
					...prevContent,
					方案: {
						...prevContent.方案,
						steps: updatedMethodSteps,
						type: methodType,
					},
				}));

				console.log("[useBrewingState] 方案列表已更新，共有方案:", updatedMethodSteps.length);
			} catch (error) {
				console.error("保存自定义方案时出错:", error);
				alert("保存自定义方案时出错，请重试");
			}
		},
		[selectedEquipment, customMethods, editingMethod, methodType]
	);

	// 处理自定义方案的编辑
	const handleEditCustomMethod = useCallback((method: Method) => {
		setEditingMethod(method);
		setShowCustomForm(true);
	}, []);

	// 处理自定义方案的删除
	const handleDeleteCustomMethod = useCallback(
		async (method: Method) => {
			if (window.confirm(`确定要删除方案"${method.name}"吗？`)) {
				try {
					// 注意：我们使用自定义名称避免与导入的函数命名冲突
					const newCustomMethods = await apiDeleteCustomMethod(
						method,
						selectedEquipment,
						customMethods
					) as Record<string, Method[]>;

					setCustomMethods(newCustomMethods);

					// 如果删除的是当前选中的方案，重置选中的方案
					if (selectedMethod && selectedMethod.id === method.id) {
						setSelectedMethod(null);
					}
				} catch (error) {
					console.error("删除自定义方案时出错:", error);
					alert("删除自定义方案时出错，请重试");
				}
			}
		},
		[selectedEquipment, customMethods, selectedMethod]
	);

	// 处理咖啡豆选择
	const handleCoffeeBeanSelect = useCallback(
		(beanId: string, bean: CoffeeBean) => {
			// 检查冲煮是否已完成，如果是则重置状态
			if (showComplete) {
				resetBrewingState(true);

				// 触发一个事件通知其他组件冲煮已经重置
				window.dispatchEvent(new CustomEvent("brewing:reset"));
			}

			setSelectedCoffeeBean(beanId);
			setSelectedCoffeeBeanData(bean);

			// 当选择了咖啡豆后，引导用户进入下一步（器具选择）
			setActiveBrewingStep("equipment");
			setActiveTab("器具");
		},
		[showComplete, resetBrewingState]
	);

	// 添加 content 状态
	const [content, setContent] = useState<Content>({
		咖啡豆: { steps: [] },
		器具: { steps: [] },
		方案: { steps: [], type: 'common' },
		注水: { steps: [] },
		记录: { steps: [] },
	});

	// 更新 content 状态的计算
	useEffect(() => {
		// 辅助函数：对方法列表进行去重
		const deduplicateMethods = (methods: { title: string; methodId?: string }[]) => {
			const seen = new Set<string>();
			return methods.filter(method => {
				// 如果methodId未定义，生成一个随机ID（这种情况不应该发生，但为了类型安全）
				const id = method.methodId || `fallback-${Math.random().toString(36).substring(2, 9)}`;
				if (seen.has(id)) {
					console.log(`[useBrewingState] 检测到重复方法ID：${id}, 标题: ${method.title}`);
					return false;
				}
				seen.add(id);
				return true;
			});
		};

		const newContent: Content = {
			咖啡豆: {
				steps: [],
			},
			器具: {
				steps: [
					...equipmentList.map((equipment) => ({
						title: equipment.name,
						description: equipment.description,
						isCustom: false,
					})),
					...customEquipments.map((equipment) => ({
						title: equipment.name,
						description: equipment.description,
						isCustom: true,
					})),
				],
			},
			方案: {
				steps:
					selectedEquipment && methodType === "common"
						? deduplicateMethods(commonMethods[selectedEquipment]?.map((method) => ({
							  title: method.name,
							  methodId: method.id,
						  })) || [])
						: selectedEquipment && customMethods[selectedEquipment]
						? deduplicateMethods(customMethods[selectedEquipment].map((method) => ({
							  title: method.name,
							  methodId: method.id,
						  })))
						: [],
				type: methodType,
			},
			注水: {
				steps:
					currentBrewingMethod?.params.stages.map((stage, index) => ({
						title: stage.label,
						time: stage.time,
						pourTime: stage.pourTime,
						water: stage.water,
						detail: stage.detail,
						pourType: stage.pourType,
						valveStatus: stage.valveStatus,
						originalIndex: index,
					})) || [],
			},
			记录: {
				steps: [],
			},
		};

		setContent(newContent);
	}, [
		selectedEquipment,
		methodType,
		commonMethods,
		customMethods,
		currentBrewingMethod,
		customEquipments,
	]);

	return {
		activeMainTab,
		setActiveMainTab,
		activeBrewingStep,
		setActiveBrewingStep,
		activeTab,
		setActiveTab,
		selectedEquipment,
		setSelectedEquipment,
		selectedMethod,
		setSelectedMethod,
		currentBrewingMethod,
		setCurrentBrewingMethod,
		isTimerRunning,
		setIsTimerRunning,
		currentStage,
		setCurrentStage,
		showHistory,
		setShowHistory,
		showComplete,
		setShowComplete,
		currentTime,
		setCurrentTime,
		methodType,
		setMethodType,
		countdownTime,
		setCountdownTime,
		isPourVisualizerPreloaded,
		customMethods,
		setCustomMethods,
		selectedCoffeeBean,
		setSelectedCoffeeBean,
		selectedCoffeeBeanData,
		setSelectedCoffeeBeanData,
		showCustomForm,
		setShowCustomForm,
		editingMethod,
		setEditingMethod,
		actionMenuStates,
		setActionMenuStates,
		showImportForm,
		setShowImportForm,
		isNoteSaved,
		setIsNoteSaved,
		prevMainTabRef,
		content,
		setContent,
		resetBrewingState,
		handleEquipmentSelect,
		handleCoffeeBeanSelect,
		handleSaveNote,
		handleSaveCustomMethod,
		handleEditCustomMethod,
		handleDeleteCustomMethod,
		navigateToStep,
		customEquipments,
		setCustomEquipments,
	};
}
