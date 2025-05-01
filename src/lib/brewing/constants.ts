import type { TabType } from "../hooks/useBrewingState";

// 定义参数规则类型
export type ParameterRule =
	| { clear: true }
	| { showEquipment: true }
	| { showAll: true }
	| { preserve: true };

// 定义统一的步骤导航规则
export const STEP_RULES = {
	// 每个步骤的前置条件
	prerequisites: {
		coffeeBean: [], // 咖啡豆步骤没有前置条件
		equipment: [], // 器具步骤可以直接访问
		method: ["equipment"], // 需要先完成器具步骤
		brewing: ["method"], // 需要先完成方案步骤
		notes: ["brewing", "showComplete"], // 需要完成冲煮且显示完成
	},

	// 每个步骤需要保留的状态
	preservedStates: {
		coffeeBean: [], // 咖啡豆步骤不保留任何状态
		equipment: ["selectedCoffeeBean", "selectedCoffeeBeanData"], // 器具步骤保留咖啡豆状态
		method: [
			"selectedCoffeeBean",
			"selectedCoffeeBeanData",
			"selectedEquipment",
		], // 方案步骤保留咖啡豆和器具状态
		brewing: [
			"selectedCoffeeBean",
			"selectedCoffeeBeanData",
			"selectedEquipment",
			"selectedMethod",
			"currentBrewingMethod",
		], // 注水步骤保留所有已选状态
		notes: ["all"], // 记录步骤保留所有状态
	},

	// 步骤对应的标签映射
	tabMapping: {
		coffeeBean: "咖啡豆" as TabType,
		equipment: "器具" as TabType,
		method: "方案" as TabType,
		brewing: "注水" as TabType,
		notes: "记录" as TabType,
	},

	// 定义参数规则类型
	parameterRules: {
		coffeeBean: { clear: true } as ParameterRule, // 咖啡豆步骤清空参数
		equipment: { clear: true } as ParameterRule, // 器具步骤清空参数
		method: { showEquipment: true } as ParameterRule, // 方案步骤显示器具名称
		brewing: { showAll: true } as ParameterRule, // 注水步骤显示完整参数
		notes: { preserve: true } as ParameterRule, // 记录步骤保持参数不变
	},
};

// 定义统一的事件名称
export const BREWING_EVENTS = {
	STEP_CHANGED: "brewing:stepChanged",
	PARAMS_UPDATED: "brewing:paramsUpdated",
	METHOD_SELECTED: "brewing:methodSelected",
	NOTES_FORM_CLOSE: "brewing:notesFormClose",
	// 添加新的导航相关事件
	NAVIGATE_TO_MAIN_TAB: "brewing:navigateToMainTab",
	NAVIGATE_TO_STEP: "brewing:navigateToStep",
	SELECT_COFFEE_BEAN: "brewing:selectCoffeeBean",
	SELECT_EQUIPMENT: "brewing:selectEquipment",
	SELECT_METHOD: "brewing:selectMethod",
	UPDATE_BREWING_PARAMS: "brewing:updateBrewingParams",
};

// 步骤导航选项接口
export interface NavigationOptions {
	force?: boolean; // 是否强制导航（忽略前置条件）
	resetParams?: boolean; // 是否重置参数
	preserveStates?: string[]; // 额外需要保留的状态
	preserveMethod?: boolean; // 是否保留方法（兼容旧接口）
	preserveEquipment?: boolean; // 是否保留设备（兼容旧接口）
	preserveCoffeeBean?: boolean; // 是否保留咖啡豆（兼容旧接口）
}

// 参数栏信息接口
export interface ParameterInfo {
	equipment: string | null;
	method: string | null;
	params: {
		coffee?: string | null;
		water?: string | null;
		ratio?: string | null;
		grindSize?: string | null;
		temp?: string | null;
	} | null;
}
