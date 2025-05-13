import { Stage } from "@/lib/core/config";

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

// 咖啡豆数据模型 - 重构优化版
export interface CoffeeBean {
	// 核心标识
	id: string;           // 唯一标识
	timestamp: number;    // 时间戳
	name: string;         // 咖啡豆名称
	type: '单品' | '拼配';  // 咖啡豆类型
	
	// 基本信息
	image?: string;       // 图片
	capacity?: string;    // 容量
	remaining?: string;   // 剩余量
	price?: string;       // 价格
	
	// 产品特性
	roastLevel?: string;  // 烘焙度
	roastDate?: string;   // 烘焙日期
	origin?: string;      // 产地
	process?: string;     // 处理法
	variety?: string;     // 品种
	flavor?: string[];    // 风味描述
	notes?: string;       // 备注
	
	// 时间管理
	startDay?: number;    // 开始使用天数
	endDay?: number;      // 结束使用天数
	isFrozen?: boolean;   // 是否冰冻状态
	
	// 分类标签
	beanType?: "espresso" | "filter"; // 豆子类型：意式/手冲
	
	// 评分相关字段 (榜单功能使用)
	overallRating?: number;       // 总体评分/喜好星值 (1-5)
	ratingNotes?: string;         // 评价备注
	
	// 博主榜单专用字段
	ratingEspresso?: number;      // 美式评分 (博主榜单 - 意式豆)
	ratingMilkBased?: number;     // 奶咖评分 (博主榜单 - 意式豆)
	purchaseChannel?: string;     // 购买渠道 (博主榜单)
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
	source?: string; // 笔记来源，如'quick-decrement'表示快捷扣除自动生成
	quickDecrementAmount?: number; // 快捷扣除的数量，仅对source为'quick-decrement'的笔记有效
	beanId?: string; // 关联的咖啡豆ID
	[key: string]: unknown; // 使用 unknown 代替 any
}
