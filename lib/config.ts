// App Version
export const APP_VERSION = "1.1.0";

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
						detail: "甜度控制，中心圆形注水",
						pourType: "circle",
					},
					{
						time: 130,
						pourTime: 4,
						label: "绕圈注水 (1/3)",
						water: "180g",
						detail: "酸度控制，中心向外螺旋注水",
						pourType: "circle",
					},
					{
						time: 165,
						pourTime: 4,
						label: "绕圈注水 (2/3)",
						water: "240g",
						detail: "酸度控制，中心向外螺旋注水",
						pourType: "circle",
					},
					{
						time: 210,
						pourTime: 4,
						label: "绕圈注水 (3/3)",
						water: "300g",
						detail: "酸度控制，中心向外螺旋注水",
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
						pourTime: 25,
						label: "中心注水",
						water: "240g",
						detail: "中心定点注水，降低萃取率",
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
