import { useState, useCallback, useRef, useEffect } from "react";
import { Method, equipmentList, Stage } from "@/lib/config";
import { Storage } from "@/lib/storage";
import { BrewingNoteData, CoffeeBean } from "@/app/types";
import {
	loadCustomMethods,
	saveCustomMethod,
	deleteCustomMethod,
} from "@/lib/customMethods";
import { CoffeeBeanManager } from "@/lib/coffeeBeanManager";

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
	items: string[];
	note: string;
	methodId?: string;
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
	const [isPourVisualizerPreloaded, setIsPourVisualizerPreloaded] =
		useState(false);
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
	// 添加优化状态追踪
	const [isOptimizing, setIsOptimizing] = useState(false);

	// 在PourOverRecipes组件的开头添加前一个标签的引用
	const prevMainTabRef = useRef<MainTabType | null>(null);

	// 重置冲煮状态函数
	const resetBrewingState = useCallback(
		(preserveMethod = false) => {
			// 如果是从记录页面返回到注水页面的特殊情况，不执行重置
			const fromNotesToBrewing =
				localStorage.getItem("fromNotesToBrewing");
			if (fromNotesToBrewing === "true") {
				// 清除标记
				localStorage.removeItem("fromNotesToBrewing");
				console.log(`[状态重置] 从记录到注水的特殊跳转，跳过重置`);
				return;
			}

			if (!preserveMethod) {
				// 完全重置所有状态
				console.log(`[状态重置] 完全重置所有状态`);
				setIsTimerRunning(false);
				setCurrentStage(0);
				setShowComplete(false);
				setCurrentTime(0);
				setCountdownTime(null);
				setIsPourVisualizerPreloaded(false);
				setSelectedMethod(null);
				setCurrentBrewingMethod(null);
				setSelectedCoffeeBean(null);
				setSelectedCoffeeBeanData(null);
				setActiveBrewingStep("equipment"); // 默认回到器具选择
				setActiveTab("器具");
			} else {
				// 部分重置状态，但保留已选方案、咖啡豆和参数
				console.log(`[状态重置] 部分重置状态，保留已选方案和咖啡豆`);
				setIsTimerRunning(false);
				setCurrentStage(0);
				setShowComplete(false);
				setCurrentTime(0);
				setCountdownTime(null);
				setIsPourVisualizerPreloaded(false);

				// 检查是否有已经选择的方案和咖啡豆
				if (selectedMethod) {
					// 返回到方案步骤或注水步骤
					setActiveBrewingStep("brewing"); // 直接返回到注水步骤而不是方案步骤
					setActiveTab("注水");
				} else if (selectedEquipment) {
					// 有设备但无方案，返回到方案步骤
					setActiveBrewingStep("method");
					setActiveTab("方案");
				} else if (selectedCoffeeBean) {
					// 只有咖啡豆，返回到设备步骤
					setActiveBrewingStep("equipment");
					setActiveTab("器具");
				} else {
					// 没有任何选择，从头开始
					setActiveBrewingStep("equipment");
					setActiveTab("器具");
				}
			}
		},
		[
			setIsTimerRunning,
			setCurrentStage,
			setShowComplete,
			setCurrentTime,
			setCountdownTime,
			setIsPourVisualizerPreloaded,
			setSelectedMethod,
			setCurrentBrewingMethod,
			setSelectedCoffeeBean,
			setSelectedCoffeeBeanData,
			setActiveBrewingStep,
			setActiveTab,
			selectedMethod,
			selectedEquipment,
			selectedCoffeeBean,
		]
	);

	// 处理从笔记页面跳转到导入方案页面的函数
	const jumpToImport = useCallback(async () => {
		try {
			// 重置优化状态
			if (isOptimizing) {
				setIsOptimizing(false);
			}

			// 1. 获取当前优化笔记的器具信息
			const notesStr = await Storage.get("brewingNotes");
			if (!notesStr) return;

			const notes = JSON.parse(notesStr);
			// 获取最新的笔记（通常是刚刚保存的优化笔记）
			const latestNote = notes[0];
			if (!latestNote || !latestNote.equipment) return;

			// 2. 切换到冲煮页面
			setActiveMainTab("冲煮");
			// 3. 隐藏历史记录
			setShowHistory(false);

			// 4. 查找对应的设备ID
			const equipmentId =
				equipmentList.find((e) => e.name === latestNote.equipment)
					?.id || latestNote.equipment;

			// 5. 使用setTimeout确保状态更新完成后再执行后续操作
			setTimeout(() => {
				// 6. 选择对应的器具
				setSelectedEquipment(equipmentId);
				// 7. 直接跳到方案步骤
				setActiveBrewingStep("method");
				// 8. 设置标签为"方案"
				setActiveTab("方案");
				// 9. 设置为自定义方案模式
				setMethodType("custom");

				// 10. 等待界面更新后显示导入表单
				setTimeout(() => {
					setShowImportForm(true);
				}, 100);
			}, 100);
		} catch (error) {
			console.error("获取笔记数据失败:", error);
			// 发生错误时的备用方案：直接跳转到冲煮页面
			setActiveMainTab("冲煮");
			setShowHistory(false);
			setTimeout(() => {
				setMethodType("custom");
				setShowImportForm(true);
			}, 100);
		}
	}, [isOptimizing]);

	// 添加一个函数，在导入方案后自动跳转到注水步骤
	const autoNavigateToBrewingAfterImport = useCallback(
		(methodId?: string) => {
			try {
				// 1. 确保已经选择了方案（如果提供了ID）
				if (methodId) {
					console.log("[自动跳转] 尝试查找方法ID:", methodId);
					console.log("[自动跳转] 当前设备:", selectedEquipment);

					// 定义查找和处理方法的函数
					const processMethodSearch = (
						methodsToSearch: Record<string, Method[]>
					) => {
						// 通过ID查找方法对象
						let foundMethod = null;

						// 打印调试信息
						console.log(
							"[自动跳转] 可用的设备方法:",
							JSON.stringify(methodsToSearch)
						);

						// 在所有设备中查找方法，不仅限于当前选中的设备
						if (
							selectedEquipment &&
							methodsToSearch[selectedEquipment]
						) {
							// 先在当前选中的设备中查找
							foundMethod = methodsToSearch[
								selectedEquipment
							].find((m) => m.id === methodId);
							console.log(
								`[自动跳转] 在设备 ${selectedEquipment} 中${
									foundMethod ? "找到" : "未找到"
								}方法`
							);
						}

						// 如果在当前设备中没找到，尝试在所有设备中查找
						if (!foundMethod) {
							console.log("[自动跳转] 在所有设备中查找方法");
							// 遍历所有设备的方法
							for (const equipId in methodsToSearch) {
								if (equipId === selectedEquipment) continue; // 跳过已检查的设备

								const methodInEquip = methodsToSearch[
									equipId
								].find((m) => m.id === methodId);

								if (methodInEquip) {
									foundMethod = methodInEquip;
									// 如果在其他设备中找到了方法，更新当前选中的设备
									console.log(
										`[自动跳转] 在设备 ${equipId} 中找到方法，更新当前设备`
									);
									setSelectedEquipment(equipId);
									break;
								}
							}
						}

						// 如果找到了方法对象，设置为当前方法
						if (foundMethod) {
							console.log(
								"[自动跳转] 找到导入的方法:",
								foundMethod.name
							);

							// 1.1 设置为选中的方法
							setSelectedMethod(foundMethod);

							// 1.2 设置为当前冲煮方法
							setCurrentBrewingMethod(foundMethod);

							// 1.3 获取设备的中文名称
							const equipmentId =
								selectedEquipment ||
								Object.keys(methodsToSearch).find((key) =>
									methodsToSearch[key].some(
										(m) => m.id === methodId
									)
								);

							const equipmentName = equipmentId
								? equipmentList.find(
										(e) => e.id === equipmentId
								  )?.name || equipmentId
								: null;

							// 1.4 更新参数信息并刷新UI
							if (typeof window !== "undefined") {
								// 创建一个方案选择事件
								window.dispatchEvent(
									new CustomEvent("methodSelected", {
										detail: {
											methodName: foundMethod.name,
											equipment: equipmentName,
											coffee: foundMethod.params.coffee,
											water: foundMethod.params.water,
											ratio: foundMethod.params.ratio,
											grindSize:
												foundMethod.params.grindSize,
											temp: foundMethod.params.temp,
											stages: foundMethod.params.stages,
										},
									})
								);
							}

							// 2. 切换到注水步骤
							setTimeout(() => {
								setActiveBrewingStep("brewing");
								setActiveTab("注水");
							}, 100);
						} else {
							console.error(
								"[自动跳转] 无法找到方法对象，ID:",
								methodId
							);
						}
					};

					// 确保自定义方法对象已更新
					try {
						// 重新从存储加载最新的自定义方法
						import("@/lib/customMethods").then(
							({ loadCustomMethods }) => {
								loadCustomMethods().then((methods) => {
									processMethodSearch(methods);
								});
							}
						);
					} catch (error) {
						console.error("[自动跳转] 加载自定义方法失败:", error);
						// 使用当前内存中的方法
						processMethodSearch(customMethods);
					}
				} else {
					console.error("[自动跳转] 没有提供方法ID");
				}
			} catch (error) {
				console.error("自动跳转到注水步骤失败:", error);
			}
		},
		[
			selectedEquipment,
			customMethods,
			setSelectedMethod,
			setCurrentBrewingMethod,
			setSelectedEquipment,
			setActiveTab,
			setActiveBrewingStep,
		]
	);

	// 处理冲煮步骤点击
	const handleBrewingStepClick = useCallback(
		(step: BrewingStep) => {
			// 如果当前在笔记标签，先切换回冲煮标签
			if (activeMainTab !== "冲煮") {
				setActiveMainTab("冲煮");
				setShowHistory(false);
				// 在状态更新后再处理步骤点击，避免状态不一致
				setTimeout(() => handleBrewingStepClick(step), 0);
				return;
			}

			// 特殊处理：从笔记页面返回注水页面的情况
			if (activeBrewingStep === "notes" && step === "brewing") {
				// 当前在记录页面，要返回到注水页面
				console.log(
					"[步骤导航] 从记录页面返回到注水页面，完全保留参数"
				);

				// 完全保留所有参数，只改变当前步骤
				setActiveBrewingStep("brewing");
				setActiveTab("注水");

				// 重置部分冲煮状态，但保留方法和参数
				setIsTimerRunning(false);
				setCurrentStage(0);
				setShowComplete(false);
				setCurrentTime(0);
				setCountdownTime(null);

				// 触发事件，仅关闭记录表单，不做任何其他操作
				const event = new CustomEvent("closeBrewingNoteForm", {
					detail: { force: true },
				});
				window.dispatchEvent(event);

				// 设置标记，标识这是从记录到注水的特殊跳转
				localStorage.setItem("fromNotesToBrewing", "true");

				return;
			}

			// 如果计时器正在运行，不允许切换步骤
			if (isTimerRunning && !showComplete) {
				return;
			}

			// 清除特殊标记
			localStorage.removeItem("fromNotesToBrewing");

			// 获取步骤索引，用于验证导航
			const stepOrder: BrewingStep[] = [
				"coffeeBean",
				"equipment",
				"method",
				"brewing",
				"notes",
			];
			const currentStepIndex = stepOrder.indexOf(activeBrewingStep);
			const targetStepIndex = stepOrder.indexOf(step);

			// 简化导航逻辑：不允许向前跳转，但有例外
			if (targetStepIndex > currentStepIndex) {
				// 其他情况禁止向前跳转，用户必须通过完成当前步骤来前进
				return;
			}

			// 处理返回到不同步骤的状态重置，但不清除参数信息
			if (step === "coffeeBean") {
				// coffeeBean 步骤不需要重置状态
				// 不重置设备选择，允许用户从咖啡豆步骤返回到之前的设备
			} else if (step === "equipment") {
				// 返回到器具步骤，清空方案相关状态，但不清除selectedEquipment
				setSelectedMethod(null);
				setCurrentBrewingMethod(null);
			} else if (step === "method") {
				// 验证导航条件 - 必须先选择器具
				if (!selectedEquipment) return;

				// 返回到方案步骤，重置注水相关状态
				setIsTimerRunning(false);
				setCurrentStage(-1);
				setCountdownTime(null);
				setShowComplete(false); // 确保重置完成状态
			} else if (step === "brewing") {
				// 验证导航条件 - 必须先选择方案
				if (!selectedMethod) return;

				// 返回到注水步骤，重置注水相关状态
				setIsTimerRunning(false);
				setCurrentStage(0);
				setCountdownTime(null);
				setShowComplete(false); // 确保重置完成状态
			} else if (step === "notes") {
				// 验证导航条件 - 必须先完成冲煮
				if (!showComplete) return;
			}

			// 设置活动步骤
			setActiveBrewingStep(step);
		},
		[
			activeBrewingStep,
			activeMainTab,
			isTimerRunning,
			selectedEquipment,
			selectedMethod,
			showComplete,
			setActiveBrewingStep,
			setActiveMainTab,
			setActiveTab,
			setCurrentBrewingMethod,
			setCurrentStage,
			setCountdownTime,
			setIsTimerRunning,
			setSelectedMethod,
			setShowComplete,
			setShowHistory,
		]
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

			// 根据设备名称找到对应的设备id
			const equipment =
				equipmentList.find((e) => e.name === equipmentName)?.id ||
				equipmentName;

			// 重置方案相关状态
			setSelectedMethod(null);
			setCurrentBrewingMethod(null);

			// 设置新的设备
			setSelectedEquipment(equipment);

			// 设置步骤和标签
			setActiveTab("方案");
			setActiveBrewingStep("method");

			// 返回实际的设备名称，以便外部函数使用
			return equipmentName;
		},
		[activeMainTab]
	);

	// 加载自定义方案
	useEffect(() => {
		const loadMethods = async () => {
			try {
				const methods = await loadCustomMethods();
				setCustomMethods(methods);
			} catch (error) {
				console.error("Error loading custom methods:", error);
			}
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
						console.log(`===== 冲煮完成，扣减咖啡豆用量 =====`);
						console.log(`咖啡豆ID: ${selectedCoffeeBean}`);

						// 解析最终使用的咖啡粉量
						const match =
							currentBrewingMethod.params.coffee.match(
								/(\d+\.?\d*)/
							);
						if (!match) {
							console.error(
								`无法从 "${currentBrewingMethod.params.coffee}" 中提取咖啡用量数字`
							);
						} else {
							const coffeeAmount = parseFloat(match[1]);
							// 格式化数值，如果没有小数部分则显示整数
							const formattedAmount = Number.isInteger(
								coffeeAmount
							)
								? coffeeAmount.toString()
								: coffeeAmount.toFixed(1);

							console.log(`最终咖啡用量: ${formattedAmount}g`);

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
										typeof updatedBean.remaining ===
										"string"
											? parseFloat(updatedBean.remaining)
											: updatedBean.remaining;

									const capacityNum =
										typeof updatedBean.capacity === "string"
											? parseFloat(updatedBean.capacity)
											: updatedBean.capacity;

									const formattedRemaining = Number.isInteger(
										remainingNum
									)
										? remainingNum.toString()
										: remainingNum.toFixed(1);

									const formattedCapacity = Number.isInteger(
										capacityNum
									)
										? capacityNum.toString()
										: capacityNum.toFixed(1);

									console.log(
										`咖啡豆扣减成功，剩余: ${formattedRemaining}g / ${formattedCapacity}g`
									);
								} else {
									console.error(
										"咖啡豆扣减失败：无法找到对应咖啡豆"
									);
								}
							} else {
								console.error(
									`无效的咖啡用量: ${coffeeAmount}g`
								);
							}
						}
						console.log(`===== 扣减完成 =====`);
					} catch (error) {
						console.error("扣减咖啡豆用量失败:", error);
					}
				}

				// 保存后跳转到笔记页面
				setActiveMainTab("笔记");
				setShowHistory(true);

				// 重置冲煮状态
				resetBrewingState();
			} catch (error) {
				console.error("Error saving note:", error);
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
				const result = await saveCustomMethod(
					method,
					selectedEquipment,
					customMethods,
					editingMethod
				);
				setCustomMethods(result.newCustomMethods);
				setSelectedMethod(result.methodWithId);
				setShowCustomForm(false);
				setEditingMethod(undefined);
			} catch (error) {
				console.error("Error saving custom method:", error);
				alert("保存自定义方案时出错，请重试");
			}
		},
		[selectedEquipment, customMethods, editingMethod]
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
					const newCustomMethods = await deleteCustomMethod(
						method,
						selectedEquipment,
						customMethods
					);
					setCustomMethods(newCustomMethods);

					// 如果删除的是当前选中的方案，重置选中的方案
					if (selectedMethod && selectedMethod.id === method.id) {
						setSelectedMethod(null);
					}
				} catch (error) {
					console.error("Error deleting custom method:", error);
					alert("删除自定义方案时出错，请重试");
				}
			}
		},
		[selectedEquipment, customMethods, selectedMethod]
	);

	// 处理咖啡豆选择
	const handleCoffeeBeanSelect = (beanId: string, bean: CoffeeBean) => {
		setSelectedCoffeeBean(beanId);
		setSelectedCoffeeBeanData(bean);

		// 当选择了咖啡豆后，引导用户进入下一步（器具选择）
		setActiveBrewingStep("equipment");
		setActiveTab("器具");
	};

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
		setIsOptimizing,
		prevMainTabRef,
		resetBrewingState,
		jumpToImport,
		autoNavigateToBrewingAfterImport,
		handleBrewingStepClick,
		handleEquipmentSelect,
		handleCoffeeBeanSelect,
		handleSaveNote,
		handleSaveCustomMethod,
		handleEditCustomMethod,
		handleDeleteCustomMethod,
	};
}
