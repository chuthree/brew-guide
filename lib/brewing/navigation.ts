import { BrewingNote } from "@/lib/config";
import { emitEvent } from "./events";
import { BREWING_EVENTS } from "./constants";

/**
 * 从历史记录导航到冲煮流程的服务
 * 模拟用户冲煮->选择咖啡豆->选择器具->选择方案的流程
 * 确保直接跳转到注水步骤
 */
export const navigateFromHistoryToBrewing = (
	note: BrewingNote,
	isFromNotesTab: boolean = false
) => {
	// 提取需要的信息
	const { coffeeBeanInfo, equipment, method, params } = note;

	// 检查是否是从方案名称点击进来的
	const isFromMethodClick =
		localStorage.getItem("clickedFromMethod") === "true";

	// 获取保存的精确方案名称（如果有）
	const exactMethodName = localStorage.getItem("clickedMethodName") || method;

	// 获取方案类型（如果是从方案名称点击进来的）
	const methodType = localStorage.getItem("methodType") || "common";

	// 清除标记
	localStorage.removeItem("clickedFromMethod");
	localStorage.removeItem("clickedMethodName");
	localStorage.removeItem("methodType");

	// 为了调试，记录当前导航信息
	console.log("开始从历史记录导航到冲煮页面", {
		isFromNotesTab,
		isFromMethodClick,
		exactMethodName,
		methodType,
		coffeeBeanInfo,
		equipment,
		method,
		params,
	});

	// 立即设置一个标记，用于页面检测导航意图
	localStorage.setItem("forceNavigateToBrewing", "true");
	localStorage.setItem("forceNavigationEquipment", equipment || "");
	localStorage.setItem("forceNavigationMethod", exactMethodName || "");
	// 保存方案类型，方便页面判断是通用方案还是自定义方案
	localStorage.setItem("forceNavigationMethodType", methodType);
	if (params) {
		localStorage.setItem("forceNavigationParams", JSON.stringify(params));
	}

	// 添加跳转顺序标识，指示我们需要执行完整的导航流程
	localStorage.setItem("navigationStep", "start");

	// 调用强制导航到冲煮页面的函数
	directNavigateToBrewing();
};

// 新增直接导航函数，可以在任何情况下调用
function directNavigateToBrewing() {
	// 强制切换到冲煮标签页，使用DOM操作
	try {
		// 查找并点击冲煮标签页
		const brewingTabElement = document.querySelector('[data-tab="冲煮"]');
		if (brewingTabElement instanceof HTMLElement) {
			brewingTabElement.click();
			console.log("已点击冲煮标签页元素");
		} else {
			// 如果无法找到元素，发出事件通知
			console.log("未找到冲煮标签页元素，使用事件通知");
			emitEvent(BREWING_EVENTS.NAVIGATE_TO_MAIN_TAB, { tab: "冲煮" });
		}

		// 立即设置标记，表示需要导航到注水步骤
		localStorage.setItem("directToBrewing", "true");

		// 延时检查导航状态
		setTimeout(() => {
			// 检查是否已在冲煮页面
			const brewingContainer = document.getElementById("brew-content");
			if (brewingContainer) {
				console.log("已成功导航到冲煮页面");
			} else {
				console.log("无法确认是否已导航到冲煮页面，尝试再次触发事件");
				// 再次触发事件
				emitEvent(BREWING_EVENTS.NAVIGATE_TO_MAIN_TAB, { tab: "冲煮" });
			}
		}, 300);
	} catch (error) {
		console.error("直接导航失败:", error);
		// 使用事件作为回退方案
		emitEvent(BREWING_EVENTS.NAVIGATE_TO_MAIN_TAB, { tab: "冲煮" });
	}
}
