// App Version
export const APP_VERSION = "2.2.9";

// Types
export interface Stage {
	time: number;
	label: string;
	water: string;
	detail: string;
	pourTime?: number;
	pourType?: "center" | "circle" | "ice" | "other";
	valveStatus?: "open" | "closed";
}

export interface Method {
	id?: string;
	name: string;
	params: {
		coffee: string;
		water: string;
		ratio: string;
		grindSize: string;
		temp: string;
		videoUrl: string;
		roastLevel?: string;
		stages: Stage[];
	};
}

export interface BrewingMethods {
	[key: string]: Method[];
}

export interface Equipment {
	id: string;
	name: string;
	description: string[];
	note?: string;
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

export interface CoffeeBean {
	id: string;
	name: string;
	roastLevel: string;
	description: string;
	method: Method;
}

export interface Brand {
	id: string;
	name: string;
	description: string;
	beans: CoffeeBean[];
}

// Equipment Data
export const equipmentList: Equipment[] = [
	{
		id: "V60",
		name: "V60",
		description: [
			"经典六十度锥形设计，流速快，风味层次分明",
			"螺旋导流纹路均匀萃取，展现明亮酸质与细腻风味",
		],
	},
	{
		id: "CleverDripper",
		name: "聪明杯",
		description: [
			"结合浸泡与滤纸过滤的冲煮滤杯，操作简单",
			"可控制萃取时间，平衡风味，适合各种烘焙度的咖啡",
		],
	},
	// 可以在这里添加更多滤杯
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
				grindSize: "中细（白砂糖颗粒）",
				temp: "92°C",
				videoUrl: "",
				roastLevel: "中浅烘焙",
				stages: [
					{
						time: 25,
						pourTime: 10,
						label: "焖蒸",
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
				grindSize: "中细（白砂糖颗粒）",
				temp: "92°C",
				videoUrl: "",
				roastLevel: "中浅烘焙",
				stages: [
					{
						time: 25,
						pourTime: 10,
						label: "焖蒸",
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
						time: 90,
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
						label: "甜度控制 (1/2)",
						water: "50g",
						detail: "中心圆形注水，确保均匀浸润",
						pourType: "circle",
					},
					{
						time: 90,
						pourTime: 7,
						label: "甜度控制 (2/2)",
						water: "120g",
						detail: "中心圆形注水",
						pourType: "circle",
					},
					{
						time: 130,
						pourTime: 4,
						label: "酸度控制 (1/3)",
						water: "180g",
						detail: "中心向外螺旋注水",
						pourType: "circle",
					},
					{
						time: 165,
						pourTime: 4,
						label: "酸度控制 (2/3)",
						water: "240g",
						detail: "中心向外螺旋注水",
						pourType: "circle",
					},
					{
						time: 210,
						pourTime: 4,
						label: "酸度控制 (3/3)",
						water: "300g",
						detail: "中心向外螺旋注水",
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
			name: "万能冲煮方案",
			params: {
				coffee: "20g",
				water: "300g",
				ratio: "1:15",
				grindSize: "C40 MK4 28格",
				temp: "90 - 75°C",
				videoUrl: "",
				roastLevel: "中浅烘焙",
				stages: [
					{
						time: 40,
						pourTime: 20,
						label: "绕圈注水[关阀]",
						water: "50g",
						detail: "关闭阀门，绕圈注水",
						pourType: "circle",
						valveStatus: "closed",
					},
					{
						time: 90,
						pourTime: 15,
						label: "绕圈注水[开阀]",
						water: "120g",
						detail: "打开阀门，绕圈注水",
						pourType: "circle",
						valveStatus: "open",
					},
					{
						time: 130,
						pourTime: 15,
						label: "绕圈注水[开阀]",
						water: "200g",
						detail: "保持开阀，绕圈注水",
						pourType: "circle",
						valveStatus: "open",
					},
					{
						time: 165,
						pourTime: 15,
						label: "降温绕圈注水[关阀]",
						water: "300g",
						detail: "关闭阀门，倒入冷水，降温至70-80°C注水",
						pourType: "circle",
						valveStatus: "closed",
					},
					{
						time: 210,
						pourTime: 0,
						label: "等待滴滤完成[开阀]",
						water: "300g",
						detail: "打开阀门等等滴滤完成",
						pourType: "center",
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
};

// Brand Coffee Data
export const brandCoffees: Brand[] = [
	{
		id: "sinloy-coffee",
		name: "Sinloy Coffee",
		description: "中咖旗下的年轻化品牌",
		beans: [
			{
				id: "sinloy-landon",
				name: "蓝冬拼配SOE",
				roastLevel: "中浅烘焙",
				description: "蓝莓 | 蜂糖李 | 杏仁",
				method: {
					name: "一帆手冲方案推荐",
					params: {
						coffee: "15g",
						water: "240g",
						ratio: "1:16",
						grindSize: "Sinloy X1 45格",
						temp: "92°C",
						videoUrl: "",
						roastLevel: "中浅烘焙",
						stages: [
							{
								time: 20,
								pourTime: 20,
								label: "焖蒸",
								water: "40g",
								detail: "水量刚好没过粉层",
								pourType: "circle",
							},
							{
								time: 55,
								pourTime: 35,
								label: "绕圈注水",
								water: "180g",
								detail: "大水流绕圈注水",
								pourType: "circle",
							},
							{
								time: 75,
								pourTime: 20,
								label: "中心注水",
								water: "240g",
								detail: "正常流速中心注水",
								pourType: "center",
							},
						],
					},
				},
			},
			{
				id: "sinloy-1960tiepika",
				name: "1960铁皮卡(水洗)",
				roastLevel: "中浅烘焙",
				description: "焦糖 | 莓果 | 桂圆 | 奶油",
				method: {
					name: "冠军萃取方案#1960铁皮卡",
					params: {
						coffee: "20g",
						water: "320g",
						ratio: "1:16",
						grindSize: "C40 25格",
						temp: "88°C",
						videoUrl: "",
						roastLevel: "中浅烘焙",
						stages: [
							{
								time: 40,
								pourTime: 40,
								label: "焖蒸",
								water: "40g",
								detail: "水量更好没过粉层",
								pourType: "circle",
							},
							{
								time: 50,
								pourTime: 10,
								label: "绕圈注水",
								water: "60g",
								detail: "小水流绕圈注水",
								pourType: "circle",
							},
							{
								time: 60,
								pourTime: 10,
								label: "绕圈注水",
								water: "80g",
								detail: "小水流绕圈注水",
								pourType: "circle",
							},
							{
								time: 100,
								pourTime: 40,
								label: "绕圈注水",
								water: "320g",
								detail: "大水流绕圈注水",
								pourType: "circle",
							},
						],
					},
				},
			},
			{
				id: "sinloy-1960tiepika",
				name: "酒酿圆子(红酒日晒) - 冰手冲",
				roastLevel: "浅度烘焙",
				description: "酒酿圆子 | 红色浆果 | 葡萄酒 | 蜂蜜",
				method: {
					name: "冰手冲",
					params: {
						coffee: "15g",
						water: "240g",
						ratio: "1:16",
						grindSize: "Sinloy X1 40格",
						temp: "90°C",
						videoUrl: "",
						roastLevel: "浅度烘焙",
						stages: [
							{
								time: 20,
								pourTime: 20,
								label: "焖蒸",
								water: "40g",
								detail: "水量更好没过粉层",
								pourType: "circle",
							},
							{
								time: 35,
								pourTime: 15,
								label: "绕圈注水",
								water: "120g",
								detail: "正常流速中心绕圈注水",
								pourType: "circle",
							},
							{
								time: 50,
								pourTime: 15,
								label: "中心注水",
								water: "160g",
								detail: "正常流速中心注水",
								pourType: "center",
							},
							{
								time: 65,
								pourTime: 15,
								label: "* 加入冰块",
								water: "240g",
								detail: "滤杯与分享壶中各加入粉水比1:4的冰块",
								pourType: "ice",
							},
							{
								time: 80,
								pourTime: 15,
								label: "* 倒入咖啡原液",
								water: "240g",
								detail: "将咖啡原液倒入滤杯降温",
								pourType: "circle",
							},
						],
					},
				},
			},
		],
	},
	// 可以在这里添加更多品牌
];
// 将现有的通用方案重命名为 commonMethods
export const commonMethods: BrewingMethods = {
	V60: brewingMethods.V60,
	CleverDripper: brewingMethods.CleverDripper,
};
