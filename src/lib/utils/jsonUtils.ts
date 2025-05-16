import { type Method, type CustomEquipment } from "@/lib/core/config";

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

interface CoffeeBean {
	id?: string;
	name: string;
	origin?: string;
	roaster?: string;
	roastLevel: string;
	roastDate?: string;
	processingMethod?: string;
	process?: string;
	variety?: string;
	flavor?: string[];
	notes?: string;
	favorite?: boolean;
	timestamp?: number;
	capacity?: string;
	remaining?: string;
	price?: string;
	type?: string;
	blendComponents?: BlendComponent[] | undefined;
	startDay?: number;
	endDay?: number;
	beanType?: string;
}

interface BrewingNote {
	id: string;
	beanId: string;
	methodId: string;
	methodName: string;
	equipment: string;
	date: string;
	method?: string;
	coffeeBeanInfo?: {
		name: string;
		roastLevel: string;
	};
	params: {
		coffee: string;
		water: string;
		ratio: string;
		grindSize: string;
		temp: string;
	};
	rating: number;
	notes: string;
	taste: {
		acidity: number;
		sweetness: number;
		bitterness: number;
		body: number;
	};
	brewTime?: string;
	timestamp: number;
}

// 定义BlendComponent接口
interface BlendComponent {
	percentage?: number | string;
	origin?: string;
	process?: string;
	variety?: string;
}

// 定义ParsedStage接口
interface ParsedStage {
	time: number;
	pourTime?: number;
	label: string;
	water: string;
	detail: string;
	pourType?: string;
	valveStatus?: "open" | "closed";
}

/**
 * 清理JSON字符串，移除不必要的包装
 * @param jsonString 可能需要清理的JSON字符串
 * @returns 清理后的JSON字符串
 */
export function cleanJsonString(jsonString: string): string {
	// 去除首尾空白字符
	let cleanedString = jsonString.trim();

	// 检查是否被```json和```包裹，如常见的复制格式
	if (cleanedString.startsWith("```json") && cleanedString.endsWith("```")) {
		cleanedString = cleanedString.slice(7, -3).trim();
	} else if (
		cleanedString.startsWith("```") &&
		cleanedString.endsWith("```")
	) {
		cleanedString = cleanedString.slice(3, -3).trim();
	}

	// 处理掐头掐尾的情况，即前后都有多余内容
	try {
		// 直接尝试解析，如果成功则无需进一步处理
		JSON.parse(cleanedString);
	} catch (_err) {
		// 如果解析失败，尝试查找有效的JSON部分

		// 1. 查找第一个 { 和最后一个 } 之间的内容
		const firstBrace = cleanedString.indexOf("{");
		const lastBrace = cleanedString.lastIndexOf("}");

		if (firstBrace >= 0 && lastBrace > firstBrace) {
			const potentialJson = cleanedString.slice(
				firstBrace,
				lastBrace + 1
			);

			try {
				// 验证提取的内容是否是有效的JSON
				JSON.parse(potentialJson);
				cleanedString = potentialJson;
				console.log("成功从文本中提取有效JSON");
			} catch (_extractErr) {
				// 如果提取的内容仍然不是有效的JSON，保持原样
				console.error("尝试提取JSON失败:", _extractErr);
			}
		}
	}

	return cleanedString;
}

/**
 * 从文本中提取数据
 * @param text 包含数据的文本
 * @param customEquipment 自定义器具配置（可选）
 * @returns 提取的JSON数据或null
 */
export function extractJsonFromText(
	text: string,
	customEquipment?: CustomEquipment
): Method | CoffeeBean | BrewingNote | CustomEquipment | CoffeeBean[] | null {
	try {
		// 首先检查是否为自然语言格式的文本
		const originalText = text.trim();

		// 检查是否是冲煮方案文本格式
		if (originalText.startsWith("【冲煮方案】")) {
			console.log("检测到冲煮方案文本格式");
			return parseMethodText(originalText, customEquipment);
		}

		// 检查是否是咖啡豆文本格式
		if (originalText.startsWith("【咖啡豆】") || originalText.startsWith("【咖啡豆信息】")) {
			console.log("检测到咖啡豆文本格式");
			return parseCoffeeBeanText(originalText);
		}

		// 检查是否是冲煮记录文本格式
		if (originalText.startsWith("【冲煮记录】")) {
			console.log("检测到冲煮记录文本格式");
			return parseBrewingNoteText(originalText);
		}

		// 如果不是明确的文本格式，尝试按JSON处理
		const cleanedJson = cleanJsonString(text);
		
		// 尝试解析JSON
		const data = JSON.parse(cleanedJson);
		
		// 检查是否是咖啡豆数组
		if (Array.isArray(data)) {
			// 验证每个元素是否都是咖啡豆数据
			if (data.every(item => typeof item === 'object' && item !== null && 'roastLevel' in item)) {
				console.log("检测到咖啡豆数组格式");
				return data as CoffeeBean[];
			}
			console.log('无法识别的数组JSON结构:', data);
			return null;
		}
		
		// 如果数据不是对象，返回null
		if (typeof data !== 'object' || data === null) {
			return null;
		}

		// 检查是否是器具数据
		if ('equipment' in data) {
			const equipment = data.equipment;
			
			// 验证必要的字段
			if (!equipment.name) {
				throw new Error('器具数据缺少名称');
			}
			
			if (!equipment.animationType || !['v60', 'kalita', 'origami', 'clever', 'custom'].includes(equipment.animationType)) {
				throw new Error('无效的器具动画类型');
			}
			
			// 验证自定义SVG（如果是自定义类型）
			if (equipment.animationType === 'custom' && !equipment.customShapeSvg) {
				throw new Error('自定义器具缺少形状SVG');
			}
			
			// 如果有阀门，验证阀门SVG
			if (equipment.hasValve) {
				if (!equipment.customValveSvg || !equipment.customValveOpenSvg) {
					throw new Error('带阀门的器具缺少阀门SVG');
				}
			}
			
			// 验证methods数组（如果存在）
			if ('methods' in data && data.methods) {
				if (!Array.isArray(data.methods)) {
					throw new Error('methods字段必须是数组');
				}
			}
			
			return data;
		}
		
		// 检查是否是方案数据
		if ('params' in data && 'stages' in data.params) {
			return parseMethodFromJson(cleanedJson);
		}
		
		// 检查是否是咖啡豆数据
		if ('roastLevel' in data && 'name' in data) {
			return data as CoffeeBean;
		}
		
		// 检查是否是笔记数据
		if ('methodName' in data && 'equipment' in data) {
			return data as BrewingNote;
		}

		console.log('无法识别的JSON结构:', data);
		return null;
	} catch (error) {
		console.error('解析JSON失败:', error);
		return null;
	}
}

/**
 * 从优化JSON中解析出Method对象
 */
export function parseMethodFromJson(jsonString: string): Method | null {
	try {
		// 清理输入的JSON字符串
		const cleanedJsonString = cleanJsonString(jsonString);

		// 解析JSON
		const parsedData = JSON.parse(cleanedJsonString);

		// 验证必要字段 - 优先使用name字段，其次是method字段
		const methodName =
			parsedData.name ||
			parsedData.method ||
			parsedData.coffeeBeanInfo?.method ||
			`${parsedData.equipment}优化方案`;

		if (!methodName && !parsedData.equipment) {
			throw new Error("导入的JSON缺少必要字段 (name或method)");
		}
		
		// 检查是否是意式咖啡方案 - 改进识别逻辑
		const isEspresso = parsedData.equipment === 'Espresso' || 
			  parsedData.equipment === '意式咖啡机' ||
			  parsedData.isEspresso === true ||
			  (parsedData.params?.stages && Array.isArray(parsedData.params.stages) && 
			   parsedData.params.stages.some((stage: StageData) => 
			     stage.pourType === 'extraction' || stage.pourType === 'beverage'
			   ));

		// 构建Method对象 - 始终生成新的ID，避免ID冲突
		const method: Method = {
			id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			name: methodName,
			params: {
				coffee: parsedData.params?.coffee || "15g",
				water: parsedData.params?.water || "225g",
				ratio: parsedData.params?.ratio || "1:15",
				grindSize: parsedData.params?.grindSize || "中细",
				temp: parsedData.params?.temp || "93°C",
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
						!["center", "circle", "ice", "other", "extraction", "beverage"].includes(pourType)
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
					
					// 基本步骤对象
					const parsedStage: any = {
						time: stage.time || 0,
						label: stage.label || "",
						water: stage.water || "",
						detail: stage.detail || "",
						pourType: pourType,
						valveStatus: valveStatus as "open" | "closed" | "",
					};
					
					// 只有非意式咖啡方法才需要pourTime字段
					if (!isEspresso) {
						parsedStage.pourTime = stage.pourTime || 0;
					}
					
					// 如果是意式咖啡方案，为特定类型的步骤设置特殊属性
					if (isEspresso) {
						// 意式咖啡的萃取步骤不需要pourTime
						if (pourType === 'extraction') {
							// 确保没有pourTime字段
							delete parsedStage.pourTime;
						} else if (pourType === 'beverage') {
							// 饮料步骤不需要时间和注水时间
							parsedStage.time = 0;
							delete parsedStage.pourTime;
						}
					}

					// 如果是意式咖啡，根据label推断pourType
					if (isEspresso && !stage.pourType) {
						// 默认为萃取
						if (parsedStage.label.includes('饮料')) {
							parsedStage.pourType = 'beverage';
						} else {
							parsedStage.pourType = 'extraction';
						}
					}

					return parsedStage;
				}
			);
		}

		// 验证stages
		if (!method.params.stages || method.params.stages.length === 0) {
			throw new Error("导入的JSON缺少冲煮步骤");
		}

		// 强制确保name字段不为空
		if (!method.name) {
			method.name = `${parsedData.equipment || ""}优化冲煮方案`;
		}

		// 调试信息
		console.log("解析后的Method对象:", method);

		return method;
	} catch (err) {
		console.error("解析方法JSON出错:", err);
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
    "grindSize": "中细",
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
  "notes": ""
}`;
}

/**
 * 将Method对象转换为JSON字符串，用于分享
 */
export function methodToJson(method: Method): string {
	// 检查是否是意式咖啡方案
	const isEspresso = method.params.stages.some(stage => 
		stage.pourType === 'extraction' || 
		stage.pourType === 'beverage'
	);
	
	// 创建深拷贝
	const methodCopy = JSON.parse(JSON.stringify(method));
	
	// 对意式咖啡方案进行特殊处理
	if (isEspresso) {
		methodCopy.isEspresso = true;
	}
	
	// 创建配置对象
	const configObject = {
		method: methodCopy.name,
		isEspresso: isEspresso,
		params: {
			coffee: methodCopy.params.coffee,
			water: methodCopy.params.water,
			ratio: methodCopy.params.ratio,
			grindSize: methodCopy.params.grindSize,
			temp: methodCopy.params.temp,
			stages: methodCopy.params.stages,
		},
	};

	// 返回格式化的JSON字符串
	return JSON.stringify(configObject, null, 2);
}

/**
 * 生成咖啡豆识别模板JSON
 * 用于生成AI识别咖啡豆图片的提示词
 */
export function generateBeanTemplateJson() {
	return `{
  "id": "",
  "name": "",
  "image": "",
  "price": "",
  "capacity": "",
  "remaining": "",
  "roastLevel": "浅度烘焙",
  "roastDate": "",
  "flavor": [],
  "origin": "",
  "process": "",
  "variety": "",
  "type": "",
  "notes": ""
}`;
}

/**
 * 将咖啡豆对象转换为可读文本格式
 * @param bean 咖啡豆对象
 * @returns 格式化的可读文本
 */
export function beanToReadableText(bean: CoffeeBean): string {
	let text = `【咖啡豆信息】${bean.name}\n`;
	
	// 确定豆子类型（单品/拼配）
	const isBlend = bean.blendComponents && Array.isArray(bean.blendComponents) && bean.blendComponents.length > 1;
	const beanType = isBlend ? '拼配' : '单品';
	
	text += `类型: ${beanType}\n`;
	
	// 如果有beanType字段（手冲/意式），添加用途信息
	if (bean.beanType) {
		text += `用途: ${bean.beanType === 'filter' ? '手冲' : '意式'}\n`;
	}
	
	// 原始咖啡豆属性
	if (bean.price) {
		text += `价格: ${bean.price}元\n`;
	}
	
	if (bean.capacity) {
		text += `容量: ${bean.capacity}g\n`;
	}
	
	if (bean.roastLevel) {
		text += `烘焙度: ${bean.roastLevel}\n`;
	}
	
	if (bean.roastDate) {
		text += `烘焙日期: ${bean.roastDate}\n`;
	}
	
	if (!isBlend) {
		// 单品豆特有信息
		if (bean.origin) {
			text += `产地: ${bean.origin}\n`;
		}
		
		if (bean.process) {
			text += `处理法: ${bean.process}\n`;
		}
		
		if (bean.variety) {
			text += `品种: ${bean.variety}\n`;
		}
	} else if (bean.blendComponents && Array.isArray(bean.blendComponents) && bean.blendComponents.length > 0) {
		// 拼配豆成分信息
		text += `拼配成分:\n`;
		
		bean.blendComponents.forEach((component, index) => {
			const componentText = [
				component.origin || "",
				component.process || "",
				component.variety || ""
			]
				.filter(v => v) // 过滤掉空值
				.join(" | ");
			
			const percentageText = component.percentage 
				? `${component.percentage}% ` 
				: "";
			
			text += `${index + 1}. ${percentageText}${componentText}\n`;
		});
	}
	
	// 风味和备注
	if (bean.flavor && Array.isArray(bean.flavor) && bean.flavor.length) {
		text += `风味标签: ${bean.flavor.join(", ")}\n`;
	}
	
	if (bean.startDay || bean.endDay) {
		if (bean.startDay) {
			text += `养豆期: ${bean.startDay}天\n`;
		}
		
		if (bean.endDay) {
			text += `赏味期: ${bean.endDay}天\n`;
		}
	}
	
	if (bean.notes) {
		text += `备注信息:\n${bean.notes}\n`;
	}
	
	// 元数据标记
	text += "\n---\n@DATA_TYPE:COFFEE_BEAN@\n";
	return text;
}

// 获取自定义注水方式的名称
function getCustomPourTypeName(pourType: string, customEquipment?: CustomEquipment): string {
	// 如果有自定义器具配置
	if (customEquipment?.customPourAnimations) {
		// 查找对应的自定义注水动画
		const customAnimation = customEquipment.customPourAnimations.find(
			anim => anim.id === pourType
		);
		if (customAnimation) {
			return customAnimation.name;
		}
	}
	return pourType;
}

/**
 * 根据注水方式名称查找对应的自定义注水方式ID
 * @param name 注水方式名称
 * @param customEquipment 自定义器具配置
 * @returns 对应的自定义注水方式ID，如果找不到则返回名称本身
 */
function findCustomPourTypeIdByName(name: string, customEquipment?: CustomEquipment): string {
	// 如果没有自定义器具或名称为空，直接返回名称本身
	if (!customEquipment?.customPourAnimations || !name) {
		return name;
	}

	// 查找名称匹配的自定义注水动画
	const customAnimation = customEquipment.customPourAnimations.find(
		anim => anim.name === name
	);

	// 如果找到匹配的动画，返回其ID
	if (customAnimation) {
		console.log(`[jsonUtils] 找到自定义注水方式ID: ${customAnimation.id}，名称: ${name}`);
		return customAnimation.id;
	}

	// 如果没有找到，返回名称本身
	return name;
}

/**
 * 将冲煮方案对象转换为可读文本格式
 * @param method 冲煮方案对象
 * @param customEquipment 自定义器具配置（可选）
 * @returns 格式化的可读文本
 */
export function methodToReadableText(method: Method, customEquipment?: CustomEquipment): string {
	const { name, params } = method;

	// 检查是否是意式咖啡方案 - 改进判断逻辑
	const isEspresso = customEquipment?.animationType === 'espresso' || 
	                  params.stages.some(stage => 
	                    stage.pourType === 'extraction' || 
	                    stage.pourType === 'beverage'
	                  );

	// 构建可读文本
	let text = `【冲煮方案】${name}\n\n`;
	text += `咖啡粉量: ${params.coffee || "未设置"}\n`;
	text += `粉水比: ${params.ratio || "未设置"}\n`;
	text += `研磨度: ${params.grindSize || "未设置"}\n`;
	text += `水温: ${params.temp || "未设置"}\n`;
	
	// 如果是意式咖啡，添加一个标记
	if (isEspresso) {
		text += `器具类型: 意式咖啡机\n`;
	}

	if (params.stages && params.stages.length > 0) {
		text += "\n冲煮步骤:\n\n";
		params.stages.forEach((stage, index: number) => {
			// 确保 stage.time 有值
			const stageTime = stage.time || 0;
			const timeText = `${Math.floor(stageTime / 60)}分${
				stageTime % 60
			}秒`;

			// 分别生成注水时间和注水方式文本
			let pourTimeText = "";
			// 只有非意式咖啡方案才显示注水时间
			if (!isEspresso && stage.pourTime) {
				pourTimeText = ` (注水${stage.pourTime}秒)`;
			}

			// 添加注水方式信息 [注水方式]
			let pourTypeText = "";
			
			// 处理pourType
			if (stage.pourType) {
				// 检查customEquipment中是否有对应的自定义注水方式
				let pourTypeName = "";
				
				if (customEquipment?.customPourAnimations) {
					const customAnimation = customEquipment.customPourAnimations.find(
						(anim) => anim.id === stage.pourType
					);
					if (customAnimation && customAnimation.name) {
						pourTypeName = customAnimation.name;
					}
				}
				
				// 如果没有找到自定义注水方式的名称，则使用系统默认名称
				if (!pourTypeName) {
					// 系统默认注水方式
					if (stage.pourType === "center") pourTypeName = "中心注水";
					else if (stage.pourType === "circle") pourTypeName = "绕圈注水";
					else if (stage.pourType === "ice") pourTypeName = "添加冰块";
					else if (stage.pourType === "extraction") pourTypeName = "萃取";
					else if (stage.pourType === "beverage") pourTypeName = "饮料";
					else pourTypeName = stage.pourType;
				}
				
				// 添加注水方式标记
				pourTypeText = ` [${pourTypeName}]`;
			}

			// 确保标签和详情是分开的
			text += `${
				index + 1
			}. [${timeText}]${pourTimeText}${pourTypeText} ${stage.label} - ${
				stage.water
			}\n`;

			if (stage.detail) {
				text += `   ${stage.detail}\n`;
			}

			text += "\n"; // 每个步骤后添加空行
		});
	}

	// 添加隐藏的序列化标识
	text += `@DATA_TYPE:BREWING_METHOD@`;

	return text;
}

/**
 * 将冲煮记录对象转换为可读文本格式
 * @param note 冲煮记录对象
 * @returns 格式化的可读文本
 */
export function brewingNoteToReadableText(note: BrewingNote): string {
	const { equipment, method, params, coffeeBeanInfo, rating, taste, notes } =
		note;

	// 构建可读文本
	let text = `【冲煮记录】\n`;
	text += `设备: ${equipment || "未设置"}\n`;
	text += `方法: ${method || "未设置"}\n`;
	text += `咖啡豆: ${coffeeBeanInfo?.name || "未设置"}\n`;
	text += `烘焙度: ${coffeeBeanInfo?.roastLevel || "未设置"}\n`;

	if (params) {
		text += `\n参数设置:\n`;
		text += `咖啡粉量: ${params.coffee || "未设置"}\n`;
		text += `水量: ${params.water || "未设置"}\n`;
		text += `比例: ${params.ratio || "未设置"}\n`;
		text += `研磨度: ${params.grindSize || "未设置"}\n`;
		text += `水温: ${params.temp || "未设置"}\n`;
	}

	if (taste) {
		text += `\n风味评分:\n`;
		text += `酸度: ${taste.acidity || 0}/5\n`;
		text += `甜度: ${taste.sweetness || 0}/5\n`;
		text += `苦度: ${taste.bitterness || 0}/5\n`;
		text += `醇厚度: ${taste.body || 0}/5\n`;
	}

	if (rating) {
		text += `\n综合评分: ${rating}/5\n`;
	}

	if (notes) {
		text += `\n笔记:\n${notes}\n`;
	}

	// 添加隐藏的序列化标识（不再包含JSON）
	text += `@DATA_TYPE:BREWING_NOTE@`;

	return text;
}

/**
 * 从自然语言文本中解析咖啡豆数据
 * @param text 咖啡豆的文本描述
 * @returns 结构化的咖啡豆数据
 */
function parseCoffeeBeanText(text: string): CoffeeBean | null {
	const bean: CoffeeBean = {
		name: "",
		capacity: "",
		remaining: "",
		roastLevel: "浅度烘焙",
		flavor: [],
	};

	// 提取名称
	const nameMatch = text.match(/【咖啡豆】(.*?)(?:\n|$)/) || text.match(/【咖啡豆信息】(.*?)(?:\n|$)/);
	if (nameMatch && nameMatch[1]) {
		bean.name = nameMatch[1].trim();
	}

	// 提取容量和剩余容量
	const capacityMatch = text.match(/容量:\s*(\d+)\/(\d+)g/);
	if (capacityMatch && capacityMatch[1] && capacityMatch[2]) {
		bean.remaining = capacityMatch[1];
		bean.capacity = capacityMatch[2];
	} else {
		// 兼容旧格式
		const oldCapacityMatch = text.match(/容量:\s*(\d+)g/);
		if (oldCapacityMatch && oldCapacityMatch[1]) {
			bean.capacity = oldCapacityMatch[1];

			// 尝试提取旧格式的剩余容量
			const oldRemainingMatch = text.match(/剩余(\d+)g/);
			if (oldRemainingMatch && oldRemainingMatch[1]) {
				bean.remaining = oldRemainingMatch[1];
			} else {
				bean.remaining = bean.capacity;
			}
		}
	}

	// 提取烘焙度
	const roastMatch = text.match(/烘焙度:\s*(.*?)(?:\n|$)/);
	if (roastMatch && roastMatch[1] && roastMatch[1] !== "未知") {
		bean.roastLevel = roastMatch[1].trim();
	}

	// 提取烘焙日期
	const dateMatch = text.match(/烘焙日期:\s*(.*?)(?:\n|$)/);
	if (dateMatch && dateMatch[1]) {
		bean.roastDate = dateMatch[1].trim();
	}

	// 提取产地
	const originMatch = text.match(/产地:\s*(.*?)(?:\n|$)/);
	if (originMatch && originMatch[1]) {
		bean.origin = originMatch[1].trim();
	}

	// 提取处理法
	const processMatch = text.match(/处理法:\s*(.*?)(?:\n|$)/);
	if (processMatch && processMatch[1]) {
		bean.process = processMatch[1].trim();
	}

	// 提取品种
	const varietyMatch = text.match(/品种:\s*(.*?)(?:\n|$)/);
	if (varietyMatch && varietyMatch[1]) {
		bean.variety = varietyMatch[1].trim();
	}

	// 提取类型
	const typeMatch = text.match(/类型:\s*(.*?)(?:\n|$)/);
	if (typeMatch && typeMatch[1]) {
		bean.type = typeMatch[1].trim();
	}

	// 提取用途
	const usageMatch = text.match(/用途:\s*(.*?)(?:\n|$)/);
	if (usageMatch && usageMatch[1]) {
		if (usageMatch[1].includes('手冲')) {
			bean.beanType = 'filter';
		} else if (usageMatch[1].includes('意式')) {
			bean.beanType = 'espresso';
		}
	}

	// 提取价格 - 改进价格提取逻辑
	const priceMatch = text.match(/价格:\s*(\d+(?:\.\d+)?)元(?:\/g)?/);
	if (priceMatch && priceMatch[1]) {
		bean.price = priceMatch[1];
	}

	// 提取养豆期
	const startDayMatch = text.match(/养豆期:\s*(\d+)天/);
	if (startDayMatch && startDayMatch[1]) {
		bean.startDay = parseInt(startDayMatch[1]);
	}
	
	// 提取赏味期
	const endDayMatch = text.match(/赏味期:\s*(\d+)天/);
	if (endDayMatch && endDayMatch[1]) {
		bean.endDay = parseInt(endDayMatch[1]);
	}

	// 提取风味
	const flavorMatch = text.match(/风味标签:\s*(.*?)(?:\n|$)/);
	if (flavorMatch && flavorMatch[1]) {
		bean.flavor = flavorMatch[1].split(",").map((f: string) => f.trim());
	}

	// 提取备注（支持多行）
	if (text.includes("备注信息:")) {
		// 备注信息可能是多行的，获取备注信息部分直到下一个区域标识符
		const notesSection = text.split("备注信息:")[1];
		// 截取到 "---" 或文档结尾
		const endIndex = notesSection.indexOf("\n---");
		const noteContent = endIndex !== -1 ? 
			notesSection.substring(0, endIndex).trim() : 
			notesSection.trim();
		bean.notes = noteContent;
	} else {
		// 兼容旧格式的单行备注
		const notesMatch = text.match(/备注:\s*(.*?)(?:\n|$)/);
		if (notesMatch && notesMatch[1]) {
			bean.notes = notesMatch[1].trim();
		}
	}

	// 提取拼配成分（如果有）
	if (text.includes("拼配成分:")) {
		bean.blendComponents = [];
		const blendSection = text.split("拼配成分:")[1];
		// 找到拼配成分部分的结束位置（下一个主要部分或文档结尾）
		const endIndex = Math.min(
			...[
				blendSection.indexOf("\n风味标签:"),
				blendSection.indexOf("\n备注信息:"),
				blendSection.indexOf("\n备注:"),
				blendSection.indexOf("\n---")
			].filter(idx => idx !== -1)
		);
		
		const blendContent = endIndex !== Infinity ? 
			blendSection.substring(0, endIndex) : 
			blendSection.split("\n---")[0];
			
		const componentLines = blendContent
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line.length > 0);

		for (const line of componentLines) {
			// 尝试匹配有百分比的行，例如 "1. 50% 哥伦比亚 | 水洗 | 卡杜拉"
			const matchWithPercentage = line.match(/\d+\.\s*(\d+)%\s*(.*)/);
			// 尝试匹配没有百分比的行，例如 "1. 肯尼亚 | 日晒 | SL28"
			const matchWithoutPercentage = line.match(/\d+\.\s*(.*)/);
			
			if (matchWithPercentage) {
				// 处理有百分比的情况
				const percentage = matchWithPercentage[1];
				const detailsText = matchWithPercentage[2].trim();

				// 分割详情字段（以 | 分隔）
				const details = detailsText
					.split("|")
					.map((part) => part.trim());

				const component: BlendComponent = {
					percentage: parseInt(percentage, 10),
				};

				// 根据分割的详情字段数量分配到相应属性
				if (details.length >= 1 && details[0])
					component.origin = details[0];
				if (details.length >= 2 && details[1])
					component.process = details[1];
				if (details.length >= 3 && details[2])
					component.variety = details[2];

				bean.blendComponents.push(component);
			} else if (matchWithoutPercentage) {
				// 处理没有百分比的情况
				const detailsText = matchWithoutPercentage[1].trim();
				
				// 分割详情字段（以 | 分隔）
				const details = detailsText
					.split("|")
					.map((part) => part.trim());
				
				const component: BlendComponent = {};
				
				// 根据分割的详情字段数量分配到相应属性
				if (details.length >= 1 && details[0])
					component.origin = details[0];
				if (details.length >= 2 && details[1])
					component.process = details[1];
				if (details.length >= 3 && details[2])
					component.variety = details[2];
				
				bean.blendComponents.push(component);
			}
		}
	}

	return bean;
}

/**
 * 从自然语言文本中解析冲煮方案数据
 * @param text 冲煮方案的文本描述
 * @param customEquipment 自定义器具配置（可选）
 * @returns 结构化的冲煮方案数据
 */
function parseMethodText(text: string, customEquipment?: CustomEquipment): Method | null {
	const method: Method = {
		id: `method-${Date.now()}`,
		name: "",
		params: {
			coffee: "",
			water: "",
			ratio: "",
			grindSize: "",
			temp: "",
			videoUrl: "",
			stages: [],
		},
	};

	// 提取名称
	const nameMatch = text.match(/【冲煮方案】(.*?)(?:\n|$)/);
	if (nameMatch && nameMatch[1]) {
		method.name = nameMatch[1].trim();
	}

	// 提取参数
	const coffeeMatch = text.match(/咖啡粉量:\s*(.*?)(?:\n|$)/);
	if (coffeeMatch && coffeeMatch[1] && coffeeMatch[1] !== "未设置") {
		method.params.coffee = coffeeMatch[1].trim();
	}

	const waterMatch = text.match(/水量:\s*(.*?)(?:\n|$)/);
	if (waterMatch && waterMatch[1] && waterMatch[1] !== "未设置") {
		method.params.water = waterMatch[1].trim();
	}

	const ratioMatch = text.match(/比例:\s*(.*?)(?:\n|$)/);
	if (ratioMatch && ratioMatch[1] && ratioMatch[1] !== "未设置") {
		method.params.ratio = ratioMatch[1].trim();
	}

	const grindMatch = text.match(/研磨度:\s*(.*?)(?:\n|$)/);
	if (grindMatch && grindMatch[1] && grindMatch[1] !== "未设置") {
		method.params.grindSize = grindMatch[1].trim();
	}

	const tempMatch = text.match(/水温:\s*(.*?)(?:\n|$)/);
	if (tempMatch && tempMatch[1] && tempMatch[1] !== "未设置") {
		method.params.temp = tempMatch[1].trim();
	}
	
	// 检查是否是意式咖啡方案 - 改进判断逻辑
	const isEspresso = text.includes("器具类型: 意式咖啡机") || 
	                   customEquipment?.animationType === 'espresso' ||
	                   text.includes("[萃取]") ||
	                   text.includes("[extraction]") ||
	                   text.includes("[beverage]");

	// 尝试提取ID（如果有）
	const idMatch = text.match(/@METHOD_ID:(method-[a-zA-Z0-9-]+)@/);
	if (idMatch && idMatch[1]) {
		method.id = idMatch[1];
	}

	// 提取冲煮步骤
	if (text.includes("冲煮步骤:")) {
		const stagesSection = text.split("冲煮步骤:")[1].split("@DATA_TYPE")[0];
		const stageLines = stagesSection
			.split("\n")
			.filter((line) => line.trim() !== "");

		// 分组解析步骤和详细信息
		for (let i = 0; i < stageLines.length; i++) {
			const line = stageLines[i];
			// 如果是主步骤行
			if (line.match(/^\d+\.\s*\[.*?\]/)) {
				// 修改正则表达式以正确提取各部分
				const stageMatch = line.match(
					/\d+\.\s*\[(\d+)分(\d+)秒\](?:\s*\(注水(\d+)秒\))?(?:\s*\[(.*?)\])?\s*(.*?)\s*-\s*(.*?)(?:\n|$)/
				);
				if (stageMatch) {
					const minutes = parseInt(stageMatch[1]);
					const seconds = parseInt(stageMatch[2]);
					const time = minutes * 60 + seconds;
					const pourTime = stageMatch[3]
						? parseInt(stageMatch[3])
						: Math.min(20, Math.ceil(time * 0.25));
					const pourTypeText = stageMatch[4] || "";
					const label = stageMatch[5].trim();
					const water = stageMatch[6].trim();

					// 创建步骤对象
					let stage: ParsedStage = {
						time,
						label,
						water,
						detail: "",
						pourType: "",
					};
					
					// 只有非意式咖啡才添加pourTime字段
					if (!isEspresso) {
						stage.pourTime = pourTime;
					}
					
					// 处理pourType
					if (pourTypeText) {
						// 查找自定义注水方式或使用系统默认注水方式
						if (pourTypeText === "中心注水") {
							stage.pourType = "center";
						} else if (pourTypeText === "绕圈注水") {
							stage.pourType = "circle";
						} else if (pourTypeText === "添加冰块") {
							stage.pourType = "ice";
						} else if (pourTypeText === "萃取") {
							stage.pourType = "extraction";
						} else if (pourTypeText === "饮料") {
							stage.pourType = "beverage";
						} else {
							// 查找自定义注水方式
							stage.pourType = findCustomPourTypeIdByName(pourTypeText, customEquipment);
						}
					}
					
					// 如果是意式咖啡，根据label推断pourType
					if (isEspresso && !stage.pourType) {
						// 默认为萃取
						if (label.includes('饮料')) {
							stage.pourType = 'beverage';
						} else {
							stage.pourType = 'extraction';
						}
					}

					// 检查下一行是否是详细信息（以空格开头）
					if (i + 1 < stageLines.length && stageLines[i + 1].trim().length > 0 && stageLines[i + 1].startsWith(" ")) {
						stage.detail = stageLines[i + 1].trim();
						i++; // 跳过详细信息行
					}

					method.params.stages.push(stage);
				}
			}
		}
	}

	return method;
}

/**
 * 从自然语言文本中解析冲煮记录数据
 * @param text 冲煮记录的文本描述
 * @returns 结构化的冲煮记录数据
 */
function parseBrewingNoteText(text: string): BrewingNote | null {
	const note: BrewingNote = {
		id: `note-${Date.now()}`,
		beanId: "",
		methodId: "",
		methodName: "",
		equipment: "",
		date: "",
		params: {
			coffee: "",
			water: "",
			ratio: "",
			grindSize: "",
			temp: "",
		},
		rating: 0,
		notes: "",
		taste: {
			acidity: 0,
			sweetness: 0,
			bitterness: 0,
			body: 0,
		},
		timestamp: Date.now(),
	};

	// 提取设备
	const equipmentMatch = text.match(/设备:\s*(.*?)(?:\n|$)/);
	if (equipmentMatch && equipmentMatch[1] && equipmentMatch[1] !== "未设置") {
		note.equipment = equipmentMatch[1].trim();
	}

	// 提取方法
	const methodMatch = text.match(/方法:\s*(.*?)(?:\n|$)/);
	if (methodMatch && methodMatch[1] && methodMatch[1] !== "未设置") {
		note.methodName = methodMatch[1].trim();
	}

	// 提取咖啡豆信息
	const beanMatch = text.match(/咖啡豆:\s*(.*?)(?:\n|$)/);
	if (beanMatch && beanMatch[1] && beanMatch[1] !== "未设置") {
		note.beanId = beanMatch[1].trim();
	}

	// 提取参数
	if (text.includes("参数设置:")) {
		const coffeeMatch = text.match(/咖啡粉量:\s*(.*?)(?:\n|$)/);
		if (coffeeMatch && coffeeMatch[1] && coffeeMatch[1] !== "未设置") {
			note.params.coffee = coffeeMatch[1].trim();
		}

		const waterMatch = text.match(/水量:\s*(.*?)(?:\n|$)/);
		if (waterMatch && waterMatch[1] && waterMatch[1] !== "未设置") {
			note.params.water = waterMatch[1].trim();
		}

		const ratioMatch = text.match(/比例:\s*(.*?)(?:\n|$)/);
		if (ratioMatch && ratioMatch[1] && ratioMatch[1] !== "未设置") {
			note.params.ratio = ratioMatch[1].trim();
		}

		const grindMatch = text.match(/研磨度:\s*(.*?)(?:\n|$)/);
		if (grindMatch && grindMatch[1] && grindMatch[1] !== "未设置") {
			note.params.grindSize = grindMatch[1].trim();
		}

		const tempMatch = text.match(/水温:\s*(.*?)(?:\n|$)/);
		if (tempMatch && tempMatch[1] && tempMatch[1] !== "未设置") {
			note.params.temp = tempMatch[1].trim();
		}
	}

	// 提取风味评分
	if (text.includes("风味评分:")) {
		const acidityMatch = text.match(/酸度:\s*(\d+)\/5/);
		if (acidityMatch && acidityMatch[1]) {
			note.taste.acidity = parseInt(acidityMatch[1]);
		}

		const sweetnessMatch = text.match(/甜度:\s*(\d+)\/5/);
		if (sweetnessMatch && sweetnessMatch[1]) {
			note.taste.sweetness = parseInt(sweetnessMatch[1]);
		}

		const bitternessMatch = text.match(/苦度:\s*(\d+)\/5/);
		if (bitternessMatch && bitternessMatch[1]) {
			note.taste.bitterness = parseInt(bitternessMatch[1]);
		}

		const bodyMatch = text.match(/醇厚度:\s*(\d+)\/5/);
		if (bodyMatch && bodyMatch[1]) {
			note.taste.body = parseInt(bodyMatch[1]);
		}
	}

	// 提取综合评分
	const ratingMatch = text.match(/综合评分:\s*(\d+)\/5/);
	if (ratingMatch && ratingMatch[1]) {
		note.rating = parseInt(ratingMatch[1]);
	}

	// 提取笔记
	if (text.includes("笔记:")) {
		const notesSection = text.split("笔记:")[1].split("\n---")[0];
		note.notes = notesSection.trim();
	}

	return note;
}
