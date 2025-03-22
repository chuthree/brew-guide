// 幻刺研磨度转换映射表
const phanciGrindSizes: Record<string, string> = {
	极细: "1-2格", // 意式咖啡
	特细: "2-4格", // 意式适合2-4档
	细: "4-6格", // 摩卡壶适合3-6.5档
	中细: "8-9格", // 手冲适合6-10档，常用中细为8-9
	中细偏粗: "8.5-10格", // 手冲偏粗
	中粗: "11-12格", // 法压壶适合9-11.5档
	粗: "12-14格", // 法压壶粗一些
	特粗: "15-20格", // 冷萃适合8-12档，但使用特粗研磨度
	// 添加咖啡冲煮方式的特定转换
	意式: "2-4格",
	摩卡壶: "3-6.5格",
	手冲: "6-10格",
	法压壶: "9-11.5格",
	冷萃: "8-12格",
	// 添加其他常用研磨度转换
};

/**
 * 将通用研磨度转换为幻刺研磨度
 * @param grindSize 通用研磨度描述
 * @returns 对应的幻刺研磨度设置
 */
export function convertToPhanciGrind(grindSize: string): string {
	// 处理特殊情况，例如已经是幻刺格式的
	if (grindSize.includes("格") || grindSize.match(/^\d+(-\d+)?$/)) {
		return grindSize;
	}

	// 尝试匹配完整的研磨度描述
	const exactMatch = phanciGrindSizes[grindSize];
	if (exactMatch) {
		return exactMatch;
	}

	// 尝试部分匹配
	for (const [key, value] of Object.entries(phanciGrindSizes)) {
		if (grindSize.includes(key)) {
			return value;
		}
	}

	// 处理特定咖啡冲煮方式的描述
	if (
		grindSize.includes("意式") ||
		grindSize.toLowerCase().includes("espresso")
	) {
		return phanciGrindSizes["意式"];
	}
	if (
		grindSize.includes("摩卡") ||
		grindSize.toLowerCase().includes("moka")
	) {
		return phanciGrindSizes["摩卡壶"];
	}
	if (
		grindSize.includes("手冲") ||
		grindSize.toLowerCase().includes("pour over")
	) {
		return phanciGrindSizes["手冲"];
	}
	if (
		grindSize.includes("法压") ||
		grindSize.toLowerCase().includes("french press")
	) {
		return phanciGrindSizes["法压壶"];
	}
	if (
		grindSize.includes("冷萃") ||
		grindSize.toLowerCase().includes("cold brew")
	) {
		return phanciGrindSizes["冷萃"];
	}

	// 如果无法转换，返回原始研磨度并添加注释
	return `${grindSize} (幻刺建议:手冲8-9格)`;
}

/**
 * 根据设置格式化研磨度显示
 * @param grindSize 原始研磨度
 * @param grindType 研磨度类型设置
 * @returns 格式化后的研磨度显示
 */
export function formatGrindSize(
	grindSize: string,
	grindType: "通用" | "幻刺"
): string {
	if (!grindSize) return "";

	if (grindType === "幻刺") {
		return convertToPhanciGrind(grindSize);
	}

	return grindSize;
}
