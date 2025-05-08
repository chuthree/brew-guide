export const APP_VERSION = "1.2.4.4";

// Types
export interface Stage {
	time: number;
	label: string;
	water: string;
	detail: string;
	pourTime?: number;
	pourType?: string;  // 改为 string 类型以支持自定义注水方式
	valveStatus?: "open" | "closed";
}

export interface MethodParams {
	coffee: string;
	water: string;
	ratio: string;
	grindSize: string;
	temp: string;
	videoUrl: string;
	roastLevel?: string;
	stages: Stage[];
}

export interface Method {
	id?: string;
	name: string;
	params: MethodParams;
	timestamp?: number;
}

export interface BrewingMethods {
	[key: string]: Method[];
}

export interface Equipment {
	id: string;
	name: string;
	description: string;
	note?: string;
}

export interface CustomEquipment extends Equipment {
	animationType: "v60" | "kalita" | "origami" | "clever" | "custom";  // 使用哪种基础器具的动画
	hasValve?: boolean;  // 是否有阀门（类似聪明杯）
	isCustom: true;  // 标记为自定义器具
	customShapeSvg?: string; // 自定义杯型的SVG路径数据
	customValveSvg?: string; // 自定义阀门关闭状态的SVG路径数据
	customValveOpenSvg?: string; // 自定义阀门开启状态的SVG路径数据
	customPourAnimations?: Array<{
		id: string;
		name: string;
		customAnimationSvg: string;
		isSystemDefault?: boolean;
		pourType?: 'center' | 'circle' | 'ice';
		previewFrames?: number;
		frames?: Array<{
			id: string;
			svgData: string;
		}>;
	}>; // 自定义注水动画配置
}

export interface BrewingNote {
	id: string;
	timestamp: number;
	equipment: string;
	method: string;
	params: {
		coffee: string;
		water: string;
		ratio: string;
		grindSize: string;
		temp: string;
	};
	coffeeBeanInfo?: {
		name: string;
		roastLevel: string;
		roastDate?: string;
	};
	image?: string;        // 添加可选的图片字段
	rating: number;
	taste: {
		acidity: number;
		sweetness: number;
		bitterness: number;
		body: number;
	};
	notes: string;
	totalTime: number;
}

// Grinder Types
export interface Grinder {
	id: string;
	name: string;
	grindSizes?: Record<string, string>; // Optional specific grind size mapping
}

// Available Grinders
export const availableGrinders: Grinder[] = [
	{ id: "generic", name: "通用" },
	{ id: "phanci_pro", name: "幻刺 Pro", grindSizes: {
		极细: "1-2格", // 意式咖啡
		特细: "2-4格", // 意式适合2-4档
		细: "4-6格", // 摩卡壶适合3-6.5档
		中细: "6.5-8.5格", // 手冲适合6-10档，常用中细为8-9
		中细偏粗: "8.5-10格", // 手冲偏粗
		中粗: "11-12格", // 法压壶适合9-11.5档
		粗: "12-14格", // 法压壶粗一些
		特粗: "15-20格", // 冷萃适合8-12档，但使用特粗研磨度
		意式: "2-4格",
		摩卡壶: "3.5格", // 双阀二杯份摩卡壶，研磨度3.5
		手冲: "6-10格", // v60或b75 0格略微打刀7.5格研磨\n杯测研磨度8.8\n研磨度 8.0到8.5 V60 三段式或46冲\n6.5到8.0\n手冲，聪明杯，幻刺 pro8\n7.8\n手冲：浅烘7，中烘8，深烘8.5
		法压壶: "9-11.5格",
		冷萃: "8-12格", // 星粒三：中浅烘2.7，中深烘3
	}},
	{ id: "c40", name: "C40", grindSizes: {
		极细: "2-8格", // 土耳其咖啡/意式咖啡
		特细: "7-13格", // 意式
		细: "10-14格", // 摩卡壶
		中细: "15-25格", // 手冲V60
		中细偏粗: "16-34格", // 手冲Pour Over
		中粗: "22-35格", // 法压壶/爱乐压
		粗: "26-40格", // 法压壶粗一些
		特粗: "30-40格", // 冷萃
		意式: "7-13格", // 专业意式
		摩卡壶: "14-24格", // 专业摩卡壶设置
		手冲: "15-25格", // V60手冲推荐档位
		聪明杯: "17-30格", // 聪明杯/浸泡释放式
		法压壶: "26-40格", // 法压推荐
		冷萃: "30-40格", // 冷萃专用
	}},
	{ id: "lagom_01", name: "Lagom 01", grindSizes: {
		极细: "1-2格", // 土耳其咖啡
		特细: "2-4格", // 意式咖啡
		细: "4-6格", // 摩卡壶
		中细: "6-8.5格", // 手冲V60
		中细偏粗: "8.5-10格", // 手冲偏粗
		中粗: "10-12格", // 法压壶
		粗: "12-15格", // 法压壶粗一些
		特粗: "15-20格", // 冷萃
		意式: "2-4格", // 专业意式
		摩卡壶: "4-6格", // 专业摩卡壶设置
		手冲: "6.5格", // v60、一刀流、20g粉，6.5格、6档转速
		聪明杯: "8-12格", // 聪明杯/浸泡释放式
		法压壶: "10-15格", // 法压推荐
		冷萃: "15-20格", // 冷萃专用
	}},
	{ id: "varia_evo", name: "Varia EVO", grindSizes: {
		极细: "0-18格", // 土耳其咖啡 (每格0.01mm刀盘间距)
		特细: "11-51格", // 意式咖啡
		细: "48-56格", // 摩卡壶
		中细: "56-90格", // V60手冲
		中细偏粗: "58-100格", // 手冲Pour Over
		中粗: "90-120格", // 法压壶
		粗: "120-140格", // 法压壶粗一些
		特粗: "140-160格", // 冷萃
		意式: "5-24格", // 140格调整-每格对应0.01mm刀盘间距
		摩卡壶: "48-56格", // Moka Pot推荐档位
		手冲: "90格", // 手冲推荐90格
		挂耳: "52格", // 挂耳咖啡专用研磨度
		聪明杯: "66-110格", // 浸泡释放式 66-1+70(110格)
		法压壶: "104-160格", // 法压推荐1+44-2+0(104-160格)
		冷萃: "130-160格", // 冷萃/冷滴1+66-2+0(130-160格)
	}},
	{ id: "1z_kultra", name: "1z KUltra", grindSizes: {
		极细: "2-3格", // 土耳其咖啡
		特细: "3.5-5格", // 意式咖啡
		细: "5-5.5格", // 摩卡壶
		中细: "6.5-8格", // 手冲V60，根据用户反馈
		中细偏粗: "7.5-8.5格", // 手冲偏粗
		中粗: "6-7格", // 爱乐压
		粗: "9-10格", // 法压壶
		特粗: "10格", // 冷萃
		土耳其: "2-3格", // 土耳其咖啡
		意式: "3.5-5格", // 意式咖啡
		摩卡壶: "5-5.5格", // 摩卡壶
		手冲: "6.5-8格", // 手冲，根据用户反馈
		虹吸: "8-9格", // 虹吸壶
		聪明杯: "6.5-8格", // 聪明杯，根据用户反馈
		爱乐压: "6-7格", // 爱乐压
		美式: "6-7.5格", // 美式滴滤
		法压壶: "9-10格", // 法压壶
		冷萃: "10格", // 冷萃
	}},
	{ id: "c3", name: "栗子 C3", grindSizes: {
		极细: "5-7格", // 意式咖啡
		特细: "7-10格", // 意式
		细: "10-13格", // 摩卡壶
		中细: "13-16格", // 手冲
		中细偏粗: "16-20格", // 手冲偏粗
		中粗: "20-25格", // 法压壶
		粗: "25-30格", // 法压壶粗一些
		特粗: "30-35格", // 冷萃
		意式: "7-8.5格", // 玩具机慎用7格不出液
		摩卡壶: "10-13格",
		手冲: "17-20格", // 17为特别情况极端情况，其他是常规情况区间内可卡0.5格
		法压壶: "20-30格",
		冷萃: "30-35格",
	}},
	{ id: "c3_esp", name: "栗子 C3ESP", grindSizes: {
		极细: "18-24格", // 意式咖啡（约0.6-0.8圈）
		特细: "24-33格", // 意式（约0.8-1.1圈）
		细: "33-42格", // 摩卡壶（约1.1-1.4圈）
		中细: "42-60格", // 手冲（约1.4-2.0圈）
		中细偏粗: "54-69格", // 手冲偏粗（约1.8-2.3圈）
		中粗: "60-75格", // 法压壶（约2.0-2.5圈）
		粗: "69-84格", // 法压壶粗一些（约2.3-2.8圈）
		特粗: "84-96格", // 冷萃（约2.8-3.2圈）
		意式: "24-33格", // 约0.8-1.1圈，适合意式咖啡
		摩卡壶: "33-45格", // 约1.1-1.5圈，摩卡壶专用
		手冲: "42-60格", // 约1.4-2.0圈，手冲专用
		法压壶: "60-69格", // 约2.0-2.3圈，法压壶专用
		冷萃: "75-90格", // 约2.5-3.0圈，冷萃推荐
	}},
	{ id: "c3_slim", name: "栗子 Slim", grindSizes: {
		极细: "5-7格", // 意式咖啡
		特细: "7-10格", // 意式
		细: "10-13格", // 摩卡壶
		中细: "13-17格", // 手冲
		中细偏粗: "17-20格", // 手冲偏粗
		中粗: "20-25格", // 法压壶
		粗: "25-30格", // 法压壶粗一些
		特粗: "30-35格", // 冷萃
		意式: "7-10格",
		摩卡壶: "10-13格",
		手冲: "15-20格", // 手冲 15-20
		法压壶: "20-30格",
		冷萃: "30-35格",
	}},
	{ id: "hanjian_k6", name: "汉匠 K6", grindSizes: {
		极细: "30-40格", // 意式咖啡，约0.5-0.7圈
		特细: "40-60格", // 意式，约0.7-1圈
		细: "60-90格", // 摩卡壶，约1-1.5圈
		中细: "90-150格", // 手冲，约1.5-2.5圈
		中细偏粗: "120-150格", // 手冲偏粗，约2-2.5圈
		中粗: "150-180格", // 法压壶，约2.5-3圈
		粗: "180-210格", // 法压壶粗一些，约3-3.5圈
		特粗: "210-240格", // 冷萃，约3.5-4圈
		意式: "30-60格", // 下调手磨约1圈(60格)，上调手磨约0.5-1圈(30-60格)
		摩卡壶: "60-90格", // 下调手磨约1.5圈(90格)，上调手磨约1-1.5圈(60-90格)
		手冲: "90-150格", // 下调手磨约2-2.5圈(120-150格)，上调手磨约1.5-2圈(90-120格)
		法压壶: "150-180格", // 下调手磨约3圈(180格)，上调手磨约2.5圈(150格)
		冷萃: "180-240格", // 约3-4圈
		上调手磨意式: "30-60格", // 上调手磨约0.5-1圈
		上调手磨摩卡: "60-90格", // 上调手磨约1-1.5圈
		上调手磨手冲: "90-120格", // 上调手磨约1.5-2圈
		上调手磨法压: "150格", // 上调手磨约2.5圈
		下调手磨意式: "60格", // 下调手磨约1圈
		下调手磨摩卡: "90格", // 下调手磨约1.5圈
		下调手磨手冲: "120-150格", // 下调手磨约2-2.5圈
		下调手磨法压: "180格", // 下调手磨约3圈
	}},
	{ id: "hanjian_k4", name: "汉匠 K4", grindSizes: {
		极细: "30-40格", // 意式咖啡，约0.5-0.7圈
		特细: "40-60格", // 意式，约0.7-1圈
		细: "60-90格", // 摩卡壶，约1-1.5圈
		中细: "90-150格", // 手冲，约1.5-2.5圈
		中细偏粗: "120-150格", // 手冲偏粗，约2-2.5圈
		中粗: "150-180格", // 法压壶，约2.5-3圈
		粗: "180-210格", // 法压壶粗一些，约3-3.5圈
		特粗: "210-240格", // 冷萃，约3.5-4圈
		意式: "30-60格", // 下调手磨约1圈(60格)，上调手磨约0.5-1圈(30-60格)
		摩卡壶: "60-90格", // 下调手磨约1.5圈(90格)，上调手磨约1-1.5圈(60-90格)
		手冲: "90-150格", // 下调手磨约2-2.5圈(120-150格)，上调手磨约1.5-2圈(90-120格)
		法压壶: "150-180格", // 下调手磨约3圈(180格)，上调手磨约2.5圈(150格)
		冷萃: "180-240格", // 约3-4圈
		上调手磨意式: "30-60格", // 上调手磨约0.5-1圈
		上调手磨摩卡: "60-90格", // 上调手磨约1-1.5圈
		上调手磨手冲: "90-120格", // 上调手磨约1.5-2圈
		上调手磨法压: "150格", // 上调手磨约2.5圈
		下调手磨意式: "60格", // 下调手磨约1圈
		下调手磨摩卡: "90格", // 下调手磨约1.5圈
		下调手磨手冲: "120-150格", // 下调手磨约2-2.5圈
		下调手磨法压: "180格", // 下调手磨约3圈
	}},
	{ id: "hanjian_k0", name: "汉匠 K0", grindSizes: {
		极细: "20-28格", // 意式咖啡，约0.5-0.7圈
		特细: "28-40格", // 意式，约0.7-1圈
		细: "40-60格", // 摩卡壶，约1-1.5圈
		中细: "60-100格", // 手冲，约1.5-2.5圈
		中细偏粗: "80-100格", // 手冲偏粗，约2-2.5圈
		中粗: "100-120格", // 法压壶，约2.5-3圈
		粗: "120-140格", // 法压壶粗一些，约3-3.5圈
		特粗: "140-160格", // 冷萃，约3.5-4圈
		意式: "20-40格", // 下调手磨约1圈(40格)，上调手磨约0.5-1圈(20-40格)
		摩卡壶: "40-60格", // 下调手磨约1.5圈(60格)，上调手磨约1-1.5圈(40-60格)
		手冲: "60-100格", // 下调手磨约2-2.5圈(80-100格)，上调手磨约1.5-2圈(60-80格)
		法压壶: "100-120格", // 下调手磨约3圈(120格)，上调手磨约2.5圈(100格)
		冷萃: "120-160格", // 约3-4圈
		上调手磨意式: "20-40格", // 上调手磨约0.5-1圈
		上调手磨摩卡: "40-60格", // 上调手磨约1-1.5圈
		上调手磨手冲: "60-80格", // 上调手磨约1.5-2圈
		上调手磨法压: "100格", // 上调手磨约2.5圈
		下调手磨意式: "40格", // 下调手磨约1圈
		下调手磨摩卡: "60格", // 下调手磨约1.5圈
		下调手磨手冲: "80-100格", // 下调手磨约2-2.5圈
		下调手磨法压: "120格", // 下调手磨约3圈
	}},
	{ id: "hanjian_k1", name: "汉匠 K1", grindSizes: {
		极细: "20-28格", // 意式咖啡，约0.5-0.7圈
		特细: "28-40格", // 意式，约0.7-1圈
		细: "40-60格", // 摩卡壶，约1-1.5圈
		中细: "60-100格", // 手冲，约1.5-2.5圈
		中细偏粗: "80-100格", // 手冲偏粗，约2-2.5圈
		中粗: "100-120格", // 法压壶，约2.5-3圈
		粗: "120-140格", // 法压壶粗一些，约3-3.5圈
		特粗: "140-160格", // 冷萃，约3.5-4圈
		意式: "20-40格", // 下调手磨约1圈(40格)，上调手磨约0.5-1圈(20-40格)
		摩卡壶: "40-60格", // 下调手磨约1.5圈(60格)，上调手磨约1-1.5圈(40-60格)
		手冲: "60-100格", // 下调手磨约2-2.5圈(80-100格)，上调手磨约1.5-2圈(60-80格)
		法压壶: "100-120格", // 下调手磨约3圈(120格)，上调手磨约2.5圈(100格)
		冷萃: "120-160格", // 约3-4圈
		上调手磨意式: "20-40格", // 上调手磨约0.5-1圈
		上调手磨摩卡: "40-60格", // 上调手磨约1-1.5圈
		上调手磨手冲: "60-80格", // 上调手磨约1.5-2圈
		上调手磨法压: "100格", // 上调手磨约2.5圈
		下调手磨意式: "40格", // 下调手磨约1圈
		下调手磨摩卡: "60格", // 下调手磨约1.5圈
		下调手磨手冲: "80-100格", // 下调手磨约2-2.5圈
		下调手磨法压: "120格", // 下调手磨约3圈
	}},
	{ id: "hanjian_k2", name: "汉匠 K2", grindSizes: {
		极细: "20-28格", // 意式咖啡，约0.5-0.7圈
		特细: "28-40格", // 意式，约0.7-1圈
		细: "40-60格", // 摩卡壶，约1-1.5圈
		中细: "60-100格", // 手冲，约1.5-2.5圈
		中细偏粗: "80-100格", // 手冲偏粗，约2-2.5圈
		中粗: "100-120格", // 法压壶，约2.5-3圈
		粗: "120-140格", // 法压壶粗一些，约3-3.5圈
		特粗: "140-160格", // 冷萃，约3.5-4圈
		意式: "20-40格", // 下调手磨约1圈(40格)，上调手磨约0.5-1圈(20-40格)
		摩卡壶: "40-60格", // 下调手磨约1.5圈(60格)，上调手磨约1-1.5圈(40-60格)
		手冲: "60-100格", // 下调手磨约2-2.5圈(80-100格)，上调手磨约1.5-2圈(60-80格)
		法压壶: "100-120格", // 下调手磨约3圈(120格)，上调手磨约2.5圈(100格)
		冷萃: "120-160格", // 约3-4圈
		上调手磨意式: "20-40格", // 上调手磨约0.5-1圈
		上调手磨摩卡: "40-60格", // 上调手磨约1-1.5圈
		上调手磨手冲: "60-80格", // 上调手磨约1.5-2圈
		上调手磨法压: "100格", // 上调手磨约2.5圈
		下调手磨意式: "40格", // 下调手磨约1圈
		下调手磨摩卡: "60格", // 下调手磨约1.5圈
		下调手磨手冲: "80-100格", // 下调手磨约2-2.5圈
		下调手磨法压: "120格", // 下调手磨约3圈
	}},
	{ id: "the2", name: "大诗 The2", grindSizes: {
		极细: "3-4格", // 意式咖啡（商用机）
		特细: "4-6格", // 意式咖啡（家用机）
		细: "6-8格", // 双闸摩卡壶
		中细: "7-9格", // 单闸摩卡壶
		中细偏粗: "8-18格", // 手冲咖啡
		中粗: "18-28格", // 法压壶
		粗: "28-35格", // 法压壶粗一些
		特粗: "35-40格", // 冷萃
		意式: "3-6格", // 意式3-4档商用机，4-6档家用机
		摩卡壶: "6-9格", // 双闸摩卡壶6-8档，单闸摩卡壶7-9档
		手冲: "8-18格", // 手冲咖啡 一圈+ 3-8档
		蛋糕滤杯: "12-18格", // 蛋糕滤杯专用
		聪明杯: "15-20格", // 聪明杯
		法压壶: "18-28格", // 法压壶 两圈+1-3档
		冷萃: "35-40格", // 冷萃推荐
	}},
	{ id: "foshan", name: "佛山磨公版磨", grindSizes: {
		极细: "20-30格", // 意式咖啡
		特细: "30-45格", // 意式
		细: "45-60格", // 摩卡壶
		中细: "60-72格", // 手冲
		中细偏粗: "72-80格", // 手冲偏粗
		中粗: "80-90格", // 法压壶
		粗: "90-100格", // 法压壶粗一些
		特粗: "100-120格", // 冷萃
		意式: "30-45格",
		摩卡壶: "45-60格",
		手冲: "60-80格", // 手冲68-72格
		法压壶: "80-100格",
		冷萃: "100-120格",
	}},
	{ id: "explorer_edge_plus", name: "探索者 Edge+", grindSizes: {
		极细: "5-10格", // 意式咖啡
		特细: "10-15格", // 意式
		细: "15-30格", // 摩卡壶
		中细: "30-50格", // 手冲
		中细偏粗: "50-80格", // 手冲偏粗
		中粗: "80-100格", // 法压壶
		粗: "100-120格", // 法压壶粗一些
		特粗: "120-150格", // 冷萃
		意式: "11-12格", // 意式11-12档
		摩卡壶: "15-30格",
		手冲: "30-80格", // 手冲50档
		法压壶: "80-120格",
		冷萃: "120-150格", // 95格对应杯测研磨75%\n115格对应杯测研磨61%
	}},
	{ id: "wizard_2", name: "巫师 2 意式版", grindSizes: {
		极细: "8-11格", // 意式咖啡
		特细: "11-14格", // 意式
		细: "14-18格", // 摩卡壶
		中细: "18-25格", // 手冲
		中细偏粗: "25-32格", // 手冲偏粗
		中粗: "32-38格", // 法压壶
		粗: "38-45格", // 法压壶粗一些
		特粗: "45-50格", // 冷萃
		意式: "13-17格", // 气动咖啡机 研磨度 14 格出液丝滑 13 慢 
		摩卡壶: "14-18格",
		手冲: "34-38格", // 星粒三plus 15～17格\n手冲 34～38格
		法压壶: "32-45格",
		冷萃: "45-50格",
	}},
	{ id: "liren_r3", name: "利刃 R3", grindSizes: {
		极细: "5-7格", // 土耳其咖啡
		特细: "6-8格", // 意式咖啡
		细: "8-10格", // 摩卡壶
		中细: "18-23格", // 手冲
		中细偏粗: "15-20格", // 虹吸壶
		中粗: "25-30格", // 法压壶
		粗: "20-25格", // 冷萃
		特粗: "30-35格", // 特殊冷萃
		意式: "6-8格", // 意式咖啡专用
		摩卡壶: "8-10格", // 摩卡壶专用
		手冲: "18-23格", // 手冲咖啡推荐档位
		虹吸壶: "15-20格", // 虹吸咖啡
		法压壶: "25-30格", // 法压壶推荐
		冷萃: "20-25格", // 冷萃推荐
	}},

	// 在这里添加更多磨豆机
];

// Equipment Data
export const equipmentList: Equipment[] = [
	{
		id: "V60",
		name: "V60",
		description: "经典锥形设计，流速快，萃取出层次分明的咖啡风味",
	},
	{
		id: "CleverDripper",
		name: "聪明杯",
		description: "结合浸泡与过滤，操作简单，适合各种烘焙度咖啡",
	},
	{
		id: "Kalita",
		name: "蛋糕滤杯",
		description: "波浪形底部设计，流速稳定，萃取更均匀",
	},
	{
		id: "Origami",
		name: "折纸滤杯",
		description: "褶皱设计兼具美感与实用性，可使用不同形状滤纸",
	},
	// 可以在这里添加更多器具
];

// Brewing Methods Data
export const brewingMethods: BrewingMethods = {
	V60: [
		{
			name: "一刀流(萃取稳定)",
			params: {
				coffee: "15g",
				water: "225g",
				ratio: "1:15",
				grindSize: "中细",
				temp: "92°C",
				videoUrl: "",
				roastLevel: "中浅烘焙",
				stages: [
					{
						time: 25,
						pourTime: 10,
						label: "焖蒸(绕圈注水)",
						water: "30g",
						detail: "中心向外绕圈，确保均匀萃取",
						pourType: "circle",
					},
					{
						time: 120,
						pourTime: 65,
						label: "绕圈注水",
						water: "225g",
						detail: "中心向外缓慢画圈注水，均匀萃取咖啡风味",
						pourType: "circle",
					},
				],
			},
		},
		{
			name: "三段式(兼容性强)",
			params: {
				coffee: "15g",
				water: "225g",
				ratio: "1:15",
				grindSize: "中细",
				temp: "92°C",
				videoUrl: "",
				roastLevel: "中浅烘焙",
				stages: [
					{
						time: 25,
						pourTime: 10,
						label: "焖蒸(绕圈注水)",
						water: "30g",
						detail: "中心向外绕圈，确保均匀萃取",
						pourType: "circle",
					},
					{
						time: 50,
						pourTime: 25,
						label: "绕圈注水",
						water: "140g",
						detail: "中心向外缓慢画圈注水，均匀萃取咖啡风味",
						pourType: "circle",
					},
					{
						time: 120,
						pourTime: 40,
						label: "中心注水",
						water: "225g",
						detail: "中心定点注水，降低萃取率",
						pourType: "center",
					},
				],
			},
		},
		{
			name: "粕谷哲4:6法(甜而平衡)",
			params: {
				coffee: "20g",
				water: "300g",
				ratio: "1:15",
				grindSize: "中细偏粗",
				temp: "96°C",
				videoUrl: "https://youtu.be/OFLaCs99lWY?si=aFJ3KtBXZtAZMbtN",
				roastLevel: "中浅烘焙",
				stages: [
					{
						time: 45,
						pourTime: 10,
						label: "绕圈注水 (1/2)",
						water: "50g",
						detail: "甜度控制，中心圆形注水，确保均匀浸润",
						pourType: "circle",
					},
					{
						time: 90,
						pourTime: 7,
						label: "绕圈注水 (2/2)",
						water: "120g",
						detail: "甜度控制，大水流中心圆形注水",
						pourType: "circle",
					},
					{
						time: 130,
						pourTime: 4,
						label: "绕圈注水 (1/3)",
						water: "180g",
						detail: "酸度控制，大水流中心向外螺旋注水",
						pourType: "circle",
					},
					{
						time: 165,
						pourTime: 4,
						label: "绕圈注水 (2/3)",
						water: "240g",
						detail: "酸度控制，大水流中心向外螺旋注水",
						pourType: "circle",
					},
					{
						time: 210,
						pourTime: 4,
						label: "绕圈注水 (3/3)",
						water: "300g",
						detail: "酸度控制，大水流中心向外螺旋注水",
						pourType: "circle",
					},
				],
			},
		},
		{
			name: "张师傅1:2:3冲煮法(群友力推)",
			params: {
				coffee: "16g",
				water: "240g",
				ratio: "1:15",
				grindSize: "中细",
				temp: "92°C",
				videoUrl: "",
				roastLevel: "中浅烘焙",
				stages: [
					{
						time: 25,
						pourTime: 15,
						label: "焖蒸（绕圈注水）",
						water: "40g",
						detail: "中心向外绕圈，确保均匀萃取",
						pourType: "circle",
					},
					{
						time: 55,
						pourTime: 20,
						label: "绕圈注水",
						water: "120g",
						detail: "中心向外缓慢画圈注水，均匀萃取咖啡风味",
						pourType: "circle",
					},
					{
						time: 70,
						pourTime: 10,
						label: "绕圈注水",
						water: "190g",
						detail: "中心向外缓慢画圈注水，均匀萃取咖啡风味",
						pourType: "circle",
					},
					{
						time: 95,
						pourTime: 5,
						label: "中心注水",
						water: "240g",
						detail: "中心定点大水流注水",
						pourType: "center",
					},
				],
			},
		},
		{
			name: "冰手冲(清爽明亮)",
			params: {
				coffee: "20g",
				water: "200g",
				ratio: "1:10",
				grindSize: "细",
				temp: "96°C",
				videoUrl: "",
				roastLevel: "中浅烘焙",
				stages: [
					{
						time: 40,
						pourTime: 10,
						label: "绕圈注水",
						water: "40g",
						detail: "(分享壶中预先放入50g冰块) 绕圈注水，确保均匀萃取",
						pourType: "circle",
					},
					{
						time: 70,
						pourTime: 10,
						label: "绕圈注水",
						water: "120g",
						detail: "绕圈注水，继续萃取",
						pourType: "circle",
					},
					{
						time: 120,
						pourTime: 10,
						label: "绕圈注水",
						water: "200g",
						detail: "绕圈注水至边缘，完成后杯中加满新鲜冰块",
						pourType: "circle",
					},
				],
			},
		},
		{
			name: "夏季八冲(全宇宙最多人使用的咖啡冲煮手法)",
			params: {
				coffee: "(略)",
				water: "(略)",
				ratio: "(略)",
				grindSize: "(略)",
				temp: "(略)",
				videoUrl: "",
				roastLevel: "(略)",
				stages: [
					{
						time: 0,
						pourTime: 0,
						label: "(略)",
						water: "0g",
						detail: "(略)",
						pourType: "other",
					},
				],
			},
		},
	],
	CleverDripper: [
		{
			name: "万能冲煮方案(兼容性强)",
			params: {
				coffee: "20g",
				water: "300g",
				ratio: "1:15",
				grindSize: "中细偏粗",
				temp: "90 - 75°C",
				videoUrl: "",
				roastLevel: "中浅烘焙",
				stages: [
					{
						time: 40,
						pourTime: 20,
						label: "[关阀]绕圈注水",
						water: "50g",
						detail: "关闭阀门，绕圈注水",
						pourType: "circle",
						valveStatus: "closed",
					},
					{
						time: 90,
						pourTime: 15,
						label: "[开阀]绕圈注水",
						water: "120g",
						detail: "打开阀门，绕圈注水",
						pourType: "circle",
						valveStatus: "open",
					},
					{
						time: 130,
						pourTime: 15,
						label: "[开阀]绕圈注水",
						water: "200g",
						detail: "保持开阀，绕圈注水",
						pourType: "circle",
						valveStatus: "open",
					},
					{
						time: 165,
						pourTime: 15,
						label: "[关阀]降温绕圈注水",
						water: "300g",
						detail: "关闭阀门，倒入冷水，降温至70-80°C注水",
						pourType: "circle",
						valveStatus: "closed",
					},
					{
						time: 210,
						pourTime: 0,
						label: "[开阀]等待滴滤完成",
						water: "300g",
						detail: "打开阀门等等滴滤完成",
						pourType: "center",
						valveStatus: "open",
					},
				],
			},
		},
		{
			name: "冠军冲煮方案(简单好用)",
			params: {
				coffee: "20g",
				water: "300g",
				ratio: "1:15",
				grindSize: "中细偏粗",
				temp: "97°C",
				videoUrl: "",
				roastLevel: "中浅烘焙",
				stages: [
					{
						time: 110,
						pourTime: 20,
						label: "[关阀]绕圈注水",
						water: "240g",
						detail: "关闭阀门，绕圈注水",
						pourType: "circle",
						valveStatus: "closed",
					},
					{
						time: 125,
						pourTime: 0,
						label: "[开阀]等咖啡液流完",
						water: "240g",
						detail: "打开阀门，等待咖啡液流完",
						pourType: "circle",
						valveStatus: "open",
					},
					{
						time: 215,
						pourTime: 10,
						label: "[开阀]绕圈注水",
						water: "300g",
						detail: "保持开阀，由外向内边缘绕圈注水(冲掉边缘咖啡粉)",
						pourType: "circle",
						valveStatus: "open",
					},
				],
			},
		},
		{
			name: "夏季八冲(全宇宙最多人使用的咖啡冲煮手法)",
			params: {
				coffee: "(略)",
				water: "(略)",
				ratio: "(略)",
				grindSize: "(略)",
				temp: "(略)",
				videoUrl: "",
				roastLevel: "(略)",
				stages: [
					{
						time: 0,
						pourTime: 0,
						label: "(略)",
						water: "0g",
						detail: "(略)",
						pourType: "other",
					},
				],
			},
		},
	],
	Kalita: [
		{
			name: "三段式(兼容性强)",
			params: {
				coffee: "15g",
				water: "225g",
				ratio: "1:15",
				grindSize: "中细",
				temp: "92°C",
				videoUrl: "",
				roastLevel: "中浅烘焙",
				stages: [
					{
						time: 30,
						pourTime: 10,
						label: "焖蒸(绕圈注水)",
						water: "30g",
						detail: "中心向外绕圈，确保均匀萃取",
						pourType: "circle",
					},
					{
						time: 70,
						pourTime: 10,
						label: "绕圈注水",
						water: "140g",
						detail: "中心向外缓慢画圈注水，均匀萃取咖啡风味",
						pourType: "circle",
					},
					{
						time: 120,
						pourTime: 40,
						label: "中心注水",
						water: "225g",
						detail: "中心定点注水，降低萃取率",
						pourType: "center",
					},
				],
			},
		},
		{
			name: "夏季八冲(全宇宙最多人使用的咖啡冲煮手法)",
			params: {
				coffee: "(略)",
				water: "(略)",
				ratio: "(略)",
				grindSize: "(略)",
				temp: "(略)",
				videoUrl: "",
				roastLevel: "(略)",
				stages: [
					{
						time: 0,
						pourTime: 0,
						label: "(略)",
						water: "0g",
						detail: "(略)",
						pourType: "other",
					},
				],
			},
		},
	],
	Origami: [
		{
			name: "三段式(兼容性强)",
			params: {
				coffee: "15g",
				water: "225g",
				ratio: "1:15",
				grindSize: "中细",
				temp: "92°C",
				videoUrl: "",
				roastLevel: "中浅烘焙",
				stages: [
					{
						time: 30,
						pourTime: 10,
						label: "焖蒸(绕圈注水)",
						water: "30g",
						detail: "中心向外绕圈，确保均匀萃取",
						pourType: "circle",
					},
					{
						time: 70,
						pourTime: 15,
						label: "绕圈注水",
						water: "140g",
						detail: "中心向外缓慢画圈注水，均匀萃取咖啡风味",
						pourType: "circle",
					},
					{
						time: 120,
						pourTime: 20,
						label: "中心注水",
						water: "225g",
						detail: "中心定点注水，降低萃取率",
						pourType: "center",
					},
				],
			},
		},
		{
			name: "夏季八冲(全宇宙最多人使用的咖啡冲煮手法)",
			params: {
				coffee: "(略)",
				water: "(略)",
				ratio: "(略)",
				grindSize: "(略)",
				temp: "(略)",
				videoUrl: "",
				roastLevel: "(略)",
				stages: [
					{
						time: 0,
						pourTime: 0,
						label: "(略)",
						water: "0g",
						detail: "(略)",
						pourType: "other",
					},
				],
			},
		},
	],
};

// 将现有的通用方案重命名为 commonMethods
export const commonMethods: BrewingMethods = {
	V60: brewingMethods.V60,
	CleverDripper: brewingMethods.CleverDripper,
	Kalita: brewingMethods.Kalita,
	Origami: brewingMethods.Origami,
};

/**
 * 从通用方案创建一个自定义方案副本
 * @param method 通用方案
 * @param equipmentId 设备ID
 * @returns 可编辑的方案副本
 */
export function createEditableMethodFromCommon(method: Method, namePrefix: string = ""): Method {
	return {
		id: `method-${Date.now()}`,
		name: namePrefix ? `${namePrefix}${method.name}` : `${method.name}(自定义)`,
		params: JSON.parse(JSON.stringify(method.params)), // 深拷贝参数
		timestamp: Date.now()
	};
}

// 赞助者列表
export const sponsorsList = [
	"Asura",
	"QD",
	"dio 哒哒哒的",
	"H.M.S Cheshire",
	"Peter",
	"Wang王",
	"Winsun月餅",
	"ZhAOZzzzz",
	"Liquor",
	"五彩野牛",
	"云峰",
	"凡千百",
	"叫我彩笔就好了",
	"大只赖克宝",
	"忙",
	"橘橘橘です",
	"空青",
	"胡子哥",
	"莫",
	"陈杰",
	"qwq",
	"洛",
	"Loki",
	"🥠",
	"火羽飘飘",
	"Atom Heart",
	"梁炜东",
	"Mr.Wrong",
	"醒来",
	"Nicole",
];
