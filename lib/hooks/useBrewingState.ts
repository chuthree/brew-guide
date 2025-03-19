import { useState, useCallback, useRef, useEffect } from "react";
import { Method, equipmentList, Stage } from "@/lib/config";
import { Storage } from "@/lib/storage";
import { BrewingNoteData } from "@/app/types";
import {
	loadCustomMethods,
	saveCustomMethod,
	deleteCustomMethod,
} from "@/lib/customMethods";

// 定义标签类型
export type TabType = "器具" | "方案" | "注水" | "记录";

// 添加新的主导航类型
export type MainTabType = "冲煮" | "笔记";

// 修改冲煮步骤类型
export type BrewingStep = "equipment" | "method" | "brewing" | "notes";

export interface Step {
	title: string;
	items: string[];
	note: string;
	methodId?: string;
}

export interface Content {
	器具: {
		steps: Step[];
	};
	方案: {
		steps: Step[];
		type: "common" | "brand" | "custom";
		selectedBrand?: Brand | null;
	};
	注水: {
		steps: Step[];
	};
	记录: {
		steps: Step[];
	};
}

export type Brand = {
	name: string;
	description: string;
	beans: CoffeeBean[];
};

export type CoffeeBean = {
	name: string;
	description: string;
	roastLevel: string;
	method: Method;
};

export function useBrewingState() {
	// 添加主导航状态
	const [activeMainTab, setActiveMainTab] = useState<MainTabType>("冲煮");
	// 修改冲煮步骤状态
	const [activeBrewingStep, setActiveBrewingStep] =
		useState<BrewingStep>("equipment");
	const [activeTab, setActiveTab] = useState<TabType>("器具");

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

	const [methodType, setMethodType] = useState<"common" | "brand" | "custom">(
		"common"
	);
	const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
	const [selectedBean, setSelectedBean] = useState<CoffeeBean | null>(null);

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
	const resetBrewingState = useCallback(() => {
		// 记住当前选择的设备，以便保留设备选择状态
		const currentEquipment = selectedEquipment;
		const equipmentName = currentEquipment
			? equipmentList.find((e) => e.id === currentEquipment)?.name ||
			  currentEquipment
			: null;

		// 重置所有冲煮相关状态到初始值
		setActiveBrewingStep("equipment");
		// 不重置设备选择，允许用户从咖啡豆步骤返回到之前的设备
		// setSelectedEquipment(null);
		setSelectedMethod(null);
		setCurrentBrewingMethod(null);
		setShowComplete(false);
		setCurrentStage(-1);
		setIsTimerRunning(false);
		setCountdownTime(null);

		return { currentEquipment, equipmentName };
	}, [selectedEquipment]);

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
				// 7. 设置冲煮步骤为"method"
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

			// 如果计时器正在运行，不允许切换步骤
			if (isTimerRunning && !showComplete) {
				return;
			}

			// 获取步骤索引，用于验证导航
			const stepOrder: BrewingStep[] = [
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
			if (step === "equipment") {
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
			} else if (step === "notes") {
				// 验证导航条件 - 必须先完成冲煮
				if (!showComplete) return;
			}

			// 设置活动步骤和对应的标签页
			setActiveBrewingStep(step);

			// 根据步骤设置对应的标签页
			switch (step) {
				case "equipment":
					setActiveTab("器具");
					break;
				case "method":
					setActiveTab("方案");
					break;
				case "brewing":
					setActiveTab("注水");
					break;
				case "notes":
					setActiveTab("记录");
					break;
			}
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

			// 如果选择的是聪明杯，确保方案类型不是品牌方案
			if (equipment === "CleverDripper" && methodType === "brand") {
				setMethodType("common");
				setSelectedBrand(null);
				setSelectedBean(null);
			}

			// 设置步骤和标签
			setActiveTab("方案");
			setActiveBrewingStep("method");

			// 返回实际的设备名称，以便外部函数使用
			return equipmentName;
		},
		[activeMainTab, methodType]
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

	// 预加载 PourVisualizer 组件
	useEffect(() => {
		// 当用户选择了器具后就开始预加载 PourVisualizer 组件
		if (selectedEquipment && !isPourVisualizerPreloaded) {
			// 使用动态导入预加载组件
			const preloadComponent = async () => {
				// 动态导入PourVisualizer组件，组件内部会自动处理图片预加载
				await import("@/components/PourVisualizer");
			};

			preloadComponent();
			setIsPourVisualizerPreloaded(true);
		}
	}, [selectedEquipment, isPourVisualizerPreloaded]);

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
		[selectedMethod, resetBrewingState]
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
		selectedBrand,
		setSelectedBrand,
		selectedBean,
		setSelectedBean,
		countdownTime,
		setCountdownTime,
		isPourVisualizerPreloaded,
		customMethods,
		setCustomMethods,
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
		handleBrewingStepClick,
		handleEquipmentSelect,
		handleSaveNote,
		handleSaveCustomMethod,
		handleEditCustomMethod,
		handleDeleteCustomMethod,
	};
}
