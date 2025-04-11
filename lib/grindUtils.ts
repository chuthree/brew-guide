import { availableGrinders } from './config';

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
 * @returns 对应的特定磨豆机研磨度设置，如果无法转换则返回原始值及建议
 */
export function convertToSpecificGrind(grindSize: string, grinderId: string): string {
	if (!grindSize) return "";

	const grinder = availableGrinders.find(g => g.id === grinderId);

	// 如果找不到磨豆机或没有特定的研磨度映射，则返回原始值
	if (!grinder || !grinder.grindSizes) {
		return grindSize;
	}

	const grindSizesMap = grinder.grindSizes;

	// 优先处理特定格式（例如幻刺的"格"）
	if (grinder.id === 'phanci_pro' && (grindSize.includes("格") || grindSize.match(/^\d+(-\d+)?$/))) {
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

	// 如果无法转换，返回原始研磨度并附带磨豆机名称
	const fallbackSuggestion = grinder.id === 'phanci_pro' ? " (幻刺建议:手冲8-9格)" : "";
	return `${grindSize}${fallbackSuggestion}`;
}

/**
 * 根据设置格式化研磨度显示（用于UI显示）
 * 这是转化研磨度的主要函数，用于在界面上显示对应磨豆机的研磨度
 * @param grindSize 原始研磨度（通用描述）
 * @param grindType 磨豆机 ID (来自设置)
 * @returns 格式化后的研磨度显示
 */
export function formatGrindSize(
	grindSize: string,
	grindType: string
): string {
	if (!grindSize) return "";

	// 如果不是通用类型，则尝试转换
	if (grindType !== 'generic') {
		return convertToSpecificGrind(grindSize, grindType);
	}

	// 如果是通用类型，直接返回
	return grindSize;
}

/**
 * 获取指定磨豆机的参考研磨度列表（用于设置页面显示）
 * 这是参考研磨度功能，只在设置页面显示，提供参考信息
 * @param grinderId 磨豆机ID
 * @returns 研磨度映射对象，如果未找到则返回空对象
 */
export function getReferenceGrindSizes(grinderId: string): Record<string, string> {
	const grinder = availableGrinders.find(g => g.id === grinderId);
	
	// 如果找到磨豆机且有研磨度映射，返回映射对象
	if (grinder && grinder.grindSizes) {
		return grinder.grindSizes;
	}
	
	// 否则返回空对象
	return {};
}

/**
 * 获取分类后的研磨度参考表
 * @param grinderId 磨豆机ID
 * @returns 包含基础研磨度和特定应用研磨度两个分类的对象
 */
export function getCategorizedGrindSizes(grinderId: string): {
	basicGrindSizes: Record<string, string>;
	applicationGrindSizes: Record<string, string>;
} {
	const grindSizes = getReferenceGrindSizes(grinderId);
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
