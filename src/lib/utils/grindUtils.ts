import { availableGrinders } from '../core/config';

/**
 * 判断磨豆机是否支持特定刻度（如"格"）
 * @param grinderId 磨豆机ID
 * @returns 是否支持特定刻度
 */
export function hasSpecificGrindScale(grinderId: string): boolean {
	if (grinderId === 'generic') return false;

	const grinder = availableGrinders.find(g => g.id === grinderId);
	return !!(grinder && grinder.grindSizes);
}

/**
 * 获取磨豆机的刻度单位（如"格"、"档"等）
 * @param grinderId 磨豆机ID
 * @returns 刻度单位，如果没有特定单位则返回空字符串
 */
export function getGrindScaleUnit(grinderId: string): string {
	if (grinderId === 'generic') return '';

	const grinder = availableGrinders.find(g => g.id === grinderId);
	if (!grinder || !grinder.grindSizes) return '';

	// 从研磨度映射中推断单位
	const values = Object.values(grinder.grindSizes);
	if (values.length > 0) {
		const firstValue = values[0];
		if (firstValue.includes('格')) return '格';
		if (firstValue.includes('档')) return '档';
		if (firstValue.includes('圈')) return '圈';
	}

	return '';
}

// 幻刺研磨度转换映射表
// const phanciGrindSizes: Record<string, string> = { // Removed unused variable
// 	极细: "1-2格", // 意式咖啡
// 	特细: "2-4格", // 意式适合2-4档
// 	细: "4-6格", // 摩卡壶适合3-6.5档
// 	中细: "8-9格", // 手冲适合6-10档，常用中细为8-9
// 	中细偏粗: "8.5-10格", // 手冲偏粗
// 	中粗: "11-12格", // 法压壶适合9-11.5档
// 	粗: "12-14格", // 法压壶粗一些
// 	特粗: "15-20格", // 冷萃适合8-12档，但使用特粗研磨度
// 	// 添加咖啡冲煮方式的特定转换
// 	意式: "2-4格",
// 	摩卡壶: "3-6.5格",
// 	手冲: "6-10格",
// 	法压壶: "9-11.5格",
// 	冷萃: "8-12格",
// 	// 添加其他常用研磨度转换
// };

/**
 * 将通用研磨度转换为特定磨豆机的研磨度（用于显示在界面上）
 * 这是转化研磨度功能，将通用研磨度描述转换为特定磨豆机的刻度/格数
 * @param grindSize 通用研磨度描述 (e.g., "中细", "手冲")
 * @param grinderId 目标磨豆机 ID
 * @param customGrinders 自定义磨豆机列表
 * @returns 对应的特定磨豆机研磨度设置，如果无法转换则返回原始值及建议
 */
export function convertToSpecificGrind(grindSize: string, grinderId: string, customGrinders?: Record<string, unknown>[]): string {
	if (!grindSize) return "";

	// 使用getReferenceGrindSizes来获取研磨度映射，包含自定义磨豆机
	const grindSizesMap = getReferenceGrindSizes(grinderId, customGrinders);

	// 如果找不到磨豆机或没有特定的研磨度映射，则返回原始值
	if (!grindSizesMap || Object.keys(grindSizesMap).length === 0) {
		return grindSize;
	}

	// 优先处理特定格式（如果输入已经是磨豆机的特定格式，直接返回）
	// 检查是否包含"格"或纯数字格式，这表明用户已经输入了具体的刻度
	if (grindSize.includes("格") || grindSize.match(/^\d+(-\d+)?$/)) {
		return grindSize;
	}

	// 尝试精确匹配通用描述
	let specificGrind = grindSizesMap[grindSize];
	if (specificGrind) {
		return specificGrind;
	}

	// 尝试部分匹配通用描述中的关键字
	for (const [key, value] of Object.entries(grindSizesMap)) {
		if (grindSize.includes(key)) {
			return value;
		}
	}

	// 尝试匹配冲煮方式
	if (grindSize.includes("意式") || grindSize.toLowerCase().includes("espresso")) {
		specificGrind = grindSizesMap["意式"];
	}
	if (grindSize.includes("摩卡") || grindSize.toLowerCase().includes("moka")) {
		specificGrind = grindSizesMap["摩卡壶"];
	}
	if (grindSize.includes("手冲") || grindSize.toLowerCase().includes("pour over")) {
		specificGrind = grindSizesMap["手冲"];
	}
	if (grindSize.includes("法压") || grindSize.toLowerCase().includes("french press")) {
		specificGrind = grindSizesMap["法压壶"];
	}
	if (grindSize.includes("冷萃") || grindSize.toLowerCase().includes("cold brew")) {
		specificGrind = grindSizesMap["冷萃"];
	}

	if (specificGrind) {
		return specificGrind;
	}

	// 如果无法转换，返回原始研磨度
	// 可以考虑添加通用的建议，但不应该硬编码特定磨豆机
	return grindSize;
}

/**
 * 根据设置格式化研磨度显示（用于UI显示）
 * 这是转化研磨度的主要函数，用于在界面上显示对应磨豆机的研磨度
 * @param grindSize 原始研磨度（通用描述）
 * @param grindType 磨豆机 ID (来自设置)
 * @param customGrinders 自定义磨豆机列表
 * @returns 格式化后的研磨度显示
 */
export function formatGrindSize(
	grindSize: string,
	grindType: string,
	customGrinders?: Record<string, unknown>[]
): string {
	if (!grindSize) return "";

	// 如果不是通用类型，则尝试转换
	if (grindType !== 'generic') {
		return convertToSpecificGrind(grindSize, grindType, customGrinders);
	}

	// 如果是通用类型，直接返回
	return grindSize;
}

/**
 * 获取指定磨豆机的参考研磨度列表（用于设置页面显示）
 * 这是参考研磨度功能，只在设置页面显示，提供参考信息
 * @param grinderId 磨豆机ID
 * @param customGrinders 自定义磨豆机列表
 * @returns 研磨度映射对象，如果未找到则返回空对象
 */
export function getReferenceGrindSizes(grinderId: string, customGrinders?: Record<string, unknown>[]): Record<string, string> {
	// 先在内置磨豆机中查找
	const grinder = availableGrinders.find(g => g.id === grinderId);

	// 如果找到磨豆机且有研磨度映射，返回映射对象
	if (grinder && grinder.grindSizes) {
		return grinder.grindSizes;
	}

	// 在自定义磨豆机中查找
	if (customGrinders) {
		const customGrinder = customGrinders.find(g => g.id === grinderId);
		if (customGrinder && customGrinder.grindSizes) {
			return customGrinder.grindSizes as Record<string, string>;
		}
	}

	// 否则返回空对象
	return {};
}

/**
 * 获取分类后的研磨度参考表
 * @param grinderId 磨豆机ID
 * @param customGrinders 自定义磨豆机列表
 * @returns 包含基础研磨度和特定应用研磨度两个分类的对象
 */
export function getCategorizedGrindSizes(grinderId: string, customGrinders?: Record<string, unknown>[]): {
	basicGrindSizes: Record<string, string>;
	applicationGrindSizes: Record<string, string>;
} {
	const grindSizes = getReferenceGrindSizes(grinderId, customGrinders);
	const basicGrindSizes: Record<string, string> = {};
	const applicationGrindSizes: Record<string, string> = {};

	// 基础研磨度关键词
	const basicKeywords = ['极细', '特细', '细', '中细', '中细偏粗', '中粗', '粗', '特粗'];
	// 特定应用关键词
	const appKeywords = ['意式', '摩卡壶', '手冲', '法压壶', '冷萃'];

	Object.entries(grindSizes).forEach(([key, value]) => {
		if (basicKeywords.includes(key)) {
			basicGrindSizes[key] = value;
		} else if (appKeywords.includes(key)) {
			applicationGrindSizes[key] = value;
		}
	});

	return { basicGrindSizes, applicationGrindSizes };
}
