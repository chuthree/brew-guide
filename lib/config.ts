// Types
export interface Stage {
	time: number;
	label: string;
	water: string;
	detail: string;
	pourTime?: number;
}

export interface Method {
	name: string;
	params: {
		coffee: string;
		water: string;
		ratio: string;
		grindSize: string;
		temp: string;
		videoUrl: string;
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

	// 可以在这里添加更多器具
];

// Brewing Methods Data
export const brewingMethods: BrewingMethods = {
	V60: [
		// {
		// 	name: "测试",
		// 	params: {
		// 		coffee: "10g",
		// 		water: "10g",
		// 		ratio: "1:1",
		// 		grindSize: "中细（白砂糖颗粒）",
		// 		temp: "92°C",
		// 		videoUrl: "",
		// 		stages: [
		// 			{
		// 				time: 5,
		// 				pourTime: 3,
		// 				label: "过程",
		// 				water: "5g",
		// 				detail: "2 - 3 - 过程",
		// 			},
		// 			{
		// 				time: 10,
		// 				pourTime: 3,
		// 				label: "完成",
		// 				water: "10g",
		// 				detail: "2 - 3 - 完成",
		// 			},
		// 		],
		// 	},
		// },
		{
			name: "一刀流(萃取稳定)",
			params: {
				coffee: "15g",
				water: "225g",
				ratio: "1:15",
				grindSize: "中细（白砂糖颗粒）",
				temp: "92°C",
				videoUrl: "",
				stages: [
					{
						time: 25,
						pourTime: 10,
						label: "焖蒸",
						water: "30g",
						detail: "中心向外画硬币大小螺旋",
					},
					{
						time: 120,
						pourTime: 65,
						label: "绕圈注水",
						water: "225g",
						detail: "保持匀速硬币大小螺旋",
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
				videoUrl: "https://youtu.be/1oB1oDrDkHM",
				stages: [
					{
						time: 25,
						pourTime: 10,
						label: "焖蒸",
						water: "30g",
						detail: "中心向外画硬币大小螺旋",
					},
					{
						time: 50,
						pourTime: 25,
						label: "绕圈注水",
						water: "140g",
						detail: "保持匀速硬币大小螺旋",
					},
					{
						time: 90,
						pourTime: 40,
						label: "中心注水",
						water: "240g",
						detail: "壶嘴压低快速注入",
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
				videoUrl: "https://youtu.be/OFLaCs99lWY",
				stages: [
					{
						time: 45,
						pourTime: 10,
						label: "甜度控制 (1/2)",
						water: "50g",
						detail: "中心圆形注水，确保均匀浸润",
					},
					{
						time: 90,
						pourTime: 7,
						label: "甜度控制 (2/2)",
						water: "120g",
						detail: "中心圆形注水",
					},
					{
						time: 130,
						pourTime: 4,
						label: "酸度控制 (1/3)",
						water: "180g",
						detail: "中心向外螺旋注水",
					},
					{
						time: 165,
						pourTime: 4,
						label: "酸度控制 (2/3)",
						water: "240g",
						detail: "中心向外螺旋注水",
					},
					{
						time: 210,
						pourTime: 4,
						label: "酸度控制 (3/3)",
						water: "300g",
						detail: "中心向外螺旋注水",
					},
				],
			},
		},
	],
};
