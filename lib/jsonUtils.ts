import { type Method, type Stage } from "@/lib/config";

// 定义Stage类型的接口，用于解析JSON
interface StageData {
	time?: number;
	pourTime?: number;
	label?: string;
	water?: string;
	detail?: string;
	pourType?: string;
	valveStatus?: string;
}

/**
 * 将冲煮方案转换为优化用的JSON格式
 */
export function generateOptimizationJson(
	equipment: string,
	method: string,
	coffeeBeanInfo: {
		name: string;
		roastLevel: string;
		roastDate?: string;
	},
	params: {
		coffee: string;
		water: string;
		ratio: string;
		grindSize: string;
		temp: string;
	},
	stages: Stage[],
	currentTaste: {
		acidity: number;
		sweetness: number;
		bitterness: number;
		body: number;
	},
	idealTaste: {
		acidity: number;
		sweetness: number;
		bitterness: number;
		body: number;
	},
	notes: string,
	optimizationGoal: string
) {
	// 创建配置对象
	const configObject = {
		equipment,
		method,
		coffeeBeanInfo,
		params: {
			coffee: params.coffee,
			water: params.water,
			ratio: params.ratio,
			grindSize: params.grindSize,
			temp: params.temp,
			stages: stages || [],
		},
		currentTaste,
		idealTaste,
		notes,
		optimizationGoal,
	};

	// 返回格式化的JSON字符串
	return JSON.stringify(configObject, null, 2);
}

/**
 * 从优化JSON中解析出Method对象
 */
export function parseMethodFromJson(jsonString: string): Method | null {
	try {
		// 解析JSON
		const parsedData = JSON.parse(jsonString);

		// 验证必要字段
		if (!parsedData.method && !parsedData.equipment) {
			throw new Error("导入的JSON缺少必要字段 (method)");
		}

		// 构建Method对象 - 始终生成新的ID，避免ID冲突
		const method: Method = {
			id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			name: parsedData.method || `${parsedData.equipment}优化方案`,
			params: {
				coffee: parsedData.params?.coffee || "15g",
				water: parsedData.params?.water || "225g",
				ratio: parsedData.params?.ratio || "1:15",
				grindSize: parsedData.params?.grindSize || "中细",
				temp: parsedData.params?.temp || "92°C",
				videoUrl: parsedData.params?.videoUrl || "",
				stages: [],
			},
		};

		// 处理stages
		if (
			parsedData.params?.stages &&
			Array.isArray(parsedData.params.stages)
		) {
			method.params.stages = parsedData.params.stages.map(
				(stage: StageData) => {
					// 确保pourType是有效的值
					let pourType = stage.pourType || "circle";
					if (
						!["center", "circle", "ice", "other"].includes(pourType)
					) {
						// 映射可能的pourType值
						if (pourType === "spiral") pourType = "circle";
						else pourType = "circle"; // 默认为circle
					}

					// 确保阀门状态是有效的值
					let valveStatus = stage.valveStatus || "";
					if (
						valveStatus &&
						!["open", "closed"].includes(valveStatus)
					) {
						valveStatus = ""; // 如果不是有效值，则设置为空
					}

					return {
						time: stage.time || 0,
						pourTime: stage.pourTime || 0,
						label: stage.label || "",
						water: stage.water || "",
						detail: stage.detail || "",
						pourType: pourType as
							| "center"
							| "circle"
							| "ice"
							| "other",
						valveStatus: valveStatus as "open" | "closed" | "",
					};
				}
			);
		}

		// 验证stages
		if (!method.params.stages || method.params.stages.length === 0) {
			throw new Error("导入的JSON缺少冲煮步骤");
		}

		return method;
	} catch (err) {
		console.error("JSON解析错误:", err);
		return null;
	}
}

/**
 * 获取示例JSON
 */
export function getExampleJson() {
	return `{
  "equipment": "V60",
  "method": "改良分段式一刀流",
  "coffeeBeanInfo": {
    "name": "",
    "roastLevel": "中度烘焙",
    "roastDate": ""
  },
  "params": {
    "coffee": "15g",
    "water": "225g",
    "ratio": "1:15",
    "grindSize": "细（白砂糖颗粒级）",
    "temp": "94°C",
    "videoUrl": "",
    "stages": [
      {
        "time": 30,
        "pourTime": 15,
        "label": "螺旋焖蒸",
        "water": "45g",
        "detail": "加大注水搅拌力度，充分激活咖啡粉层",
        "pourType": "circle"
      },
      {
        "time": 60,
        "pourTime": 20,
        "label": "快节奏中心注水",
        "water": "90g",
        "detail": "高水位快速注入加速可溶性物质释放",
        "pourType": "center"
      },
      {
        "time": 120,
        "pourTime": 30,
        "label": "分层绕圈注水",
        "water": "225g",
        "detail": "分三次间隔注水控制萃取节奏",
        "pourType": "circle"
      }
    ]
  },
  "currentTaste": {
    "acidity": 3,
    "sweetness": 3,
    "bitterness": 3,
    "body": 3
  },
  "idealTaste": {
    "acidity": 4,
    "sweetness": 4,
    "bitterness": 2,
    "body": 4
  },
  "notes": "",
  "optimizationGoal": "希望增加甜度和醇度，减少苦味，保持适中的酸度"
}`;
}

/**
 * 清理JSON数据，移除不必要的字段
 */
export function cleanJsonForOptimization(jsonString: string): string {
	try {
		const data = JSON.parse(jsonString);

		// 定义Stage类型，用于类型安全
		interface CleanStage {
			time?: number;
			pourTime?: number;
			label?: string;
			water?: string;
			detail?: string;
			pourType?: string;
			valveStatus?: string;
		}

		// 保留必要的字段
		const cleanedData = {
			equipment: data.equipment,
			method: data.method,
			params: {
				coffee: data.params?.coffee,
				water: data.params?.water,
				ratio: data.params?.ratio,
				grindSize: data.params?.grindSize,
				temp: data.params?.temp,
				stages: data.params?.stages?.map((stage: CleanStage) => ({
					time: stage.time,
					pourTime: stage.pourTime,
					label: stage.label,
					water: stage.water,
					detail: stage.detail,
					pourType: stage.pourType,
					valveStatus: stage.valveStatus,
				})),
			},
			currentTaste: data.currentTaste,
			idealTaste: data.idealTaste,
			notes: data.notes,
			optimizationGoal: data.optimizationGoal,
		};

		return JSON.stringify(cleanedData, null, 2);
	} catch (err) {
		console.error("JSON清理错误:", err);
		return jsonString;
	}
}

/**
 * 将Method对象转换为JSON字符串，用于分享
 */
export function methodToJson(method: Method): string {
	// 创建配置对象
	const configObject = {
		method: method.name,
		params: {
			coffee: method.params.coffee,
			water: method.params.water,
			ratio: method.params.ratio,
			grindSize: method.params.grindSize,
			temp: method.params.temp,
			stages: method.params.stages || [],
		},
	};

	// 返回格式化的JSON字符串
	return JSON.stringify(configObject, null, 2);
}
