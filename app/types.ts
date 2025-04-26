import { Stage } from "@/lib/config";

export interface TasteRatings {
	acidity: number;
	sweetness: number;
	bitterness: number;
	body: number;
}

// 拼配成分接口定义
export interface BlendComponent {
	percentage?: number;  // 百分比 (1-100)，可选
	origin?: string;     // 产地
	process?: string;    // 处理法
	variety?: string;    // 品种
}

// 咖啡豆数据模型
export interface CoffeeBean {
	id: string;
	timestamp: number;
	name: string;
	type: '单品' | '拼配';
	image?: string;
	capacity?: string;
	remaining?: string;
	price?: string;
	roastLevel?: string;
	roastDate?: string;
	origin?: string;
	process?: string;
	variety?: string;
	acidity?: number;
	sweetness?: number;
	body?: number;
	aftertaste?: number;
	flavor?: string[];
	aroma?: number;
	balance?: number;
	clean?: number;
	notes?: string;
	startDay?: number;
	endDay?: number;
	// 榜单相关字段
	beanType?: "espresso" | "filter"; // 豆子类型：意式/手冲
	overallRating?: number; // 总体评分/喜好星值 (1-5)
	ratingEspresso?: number; // 美式评分 (意式豆)
	ratingMilkBased?: number; // 奶咖评分 (意式豆)
	ratingAroma?: number; // 香气评分 (手冲豆)
	ratingFlavor?: number; // 风味评分 (手冲豆)
	ratingAftertaste?: number; // 余韵评分 (手冲豆)
	purchaseChannel?: string; // 购买渠道
	ratingNotes?: string; // 评价备注
}

// 扩展CoffeeBean类型以支持拼配成分
export type ExtendedCoffeeBean = CoffeeBean & {
	blendComponents?: BlendComponent[];
}

// 修改 BrewingNoteData 接口，避免使用 any
export interface BrewingNoteData {
	id: string;
	timestamp: number;
	equipment?: string;
	method?: string;
	params?: {
		coffee: string;
		water: string;
		ratio: string;
		grindSize: string;
		temp: string;
	};
	stages?: Stage[];
	totalTime?: number;
	coffeeBeanInfo: {
		name: string;
		roastLevel: string;
		roastDate?: string;
	};
	rating: number;
	taste: TasteRatings;
	notes: string;
	[key: string]: unknown; // 使用 unknown 代替 any
}
