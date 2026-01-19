/**
 * 🔧 服务器核心配置模块
 *
 * 职责：
 * - 环境变量加载与验证
 * - 配置常量定义
 * - 配置项统一管理
 *
 * @module config
 */

import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

/**
 * 验证必需的环境变量
 * @throws {Error} 如果缺少必需的环境变量
 */
function validateEnv() {
  const required = ['SILICONFLOW_API_KEY', 'QINIU_API_KEY'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `❌ 缺少必需的环境变量: ${missing.join(', ')}\n` +
        `请创建 .env 文件并配置这些变量`
    );
  }
}

// 执行验证
validateEnv();

/**
 * 服务器配置
 */
export const serverConfig = {
  port: parseInt(process.env.PORT, 10) || 3100,
  env: process.env.NODE_ENV || 'development',
  host: '0.0.0.0',
};

/**
 * API 密钥配置
 */
export const apiKeys = {
  siliconflow: process.env.SILICONFLOW_API_KEY,
  qiniu: process.env.QINIU_API_KEY,
  admin: process.env.ADMIN_KEY || 'brew-guide-admin-2025',
};

/**
 * 安全配置
 */
export const securityConfig = {
  ipHashSalt: process.env.IP_HASH_SALT || 'brew-guide-salt-2025-secure',
};

/**
 * CORS 配置
 */
export const corsConfig = {
  allowedOrigins: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS === '*'
      ? '*'
      : process.env.ALLOWED_ORIGINS.split(',')
          .map(o => o.trim())
          .filter(o => o)
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['POST', 'GET', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'x-admin-key',
  ],
};

/**
 * 文件上传配置
 */
export const uploadConfig = {
  maxFileSize: 5 * 1024 * 1024, // 5MB
  // 不支持 GIF，因为无法有效压缩动图
  allowedMimeTypes: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
  ],
  magicNumbers: {
    'image/jpeg': [[0xff, 0xd8, 0xff]],
    'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
    'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF
    'image/heic': [[0x00, 0x00, 0x00]], // ftyp box
    'image/heif': [[0x00, 0x00, 0x00]], // ftyp box
  },
};

/**
 * 速率限制配置
 */
export const rateLimitConfig = {
  // 通用限流
  general: {
    windowMs: 60 * 1000, // 1 分钟
    maxRequests: 30,
  },
  // 年度报告限流
  yearlyReport: {
    windowMs: 24 * 60 * 60 * 1000, // 24 小时
    maxRequests: 5,
  },
  // 反馈提交限流
  feedbackSubmit: {
    windowMs: 60 * 60 * 1000, // 1 小时
    maxSubmissions: 5,
  },
  // 投票限流
  vote: {
    windowMs: 60 * 1000, // 1 分钟
    maxVotes: 10,
  },
};

/**
 * AI 配置
 */
export const aiConfig = {
  // 咖啡豆识别 (七牛云)
  beanRecognition: {
    baseURL: 'https://api.qnaigc.com/v1/chat/completions',
    model: 'qwen-vl-max-2025-01-25',
    temperature: 0,
    maxTokens: 2000,
    timeout: 120000,
    maxRetries: 2,
    retryDelay: 1000,
  },
  // 冲煮方案识别 (七牛云)
  methodRecognition: {
    baseURL: 'https://api.qnaigc.com/v1/chat/completions',
    model: 'qwen-vl-max-2025-01-25',
    temperature: 0,
    maxTokens: 2000,
    timeout: 120000,
    maxRetries: 2,
    retryDelay: 1000,
  },
  // 年度报告生成
  yearlyReport: {
    baseURL:
      'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    model: 'deepseek-v3.1',
    temperature: 0.7,
    maxTokens: 2000,
    timeout: 60000,
  },
  // 反馈审核
  feedbackModeration: {
    baseURL:
      'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    model: 'deepseek-v3.1',
    temperature: 0.1, // 低温度以获得确定性结果
    maxTokens: 500,
    timeout: 10000,
  },
  // 并发控制
  maxConcurrentRequests: 3,
};

/**
 * AI 提示词
 */
export const aiPrompts = {
  beanRecognition: `你是OCR工具，提取图片中的咖啡豆信息，直接返回JSON（单豆返回对象{}，多豆返回数组[]）。

必填: name（豆名，如"埃塞俄比亚赏花日晒原生种"）

可选（图片有明确信息才填）：
- roaster: 烘焙商/品牌名（如"西可"）
- capacity/remaining/price: 纯数字
- roastDate: YYYY-MM-DD (缺年份补2026)
- roastLevel: 极浅烘焙|浅度烘焙|中浅烘焙|中度烘焙|中深烘焙|深度烘焙
- beanType: filter|espresso|omni（≤200g/浅烘/单品→filter，≥300g/深烘/拼配→espresso，标注全能→omni，默认filter）
- flavor: 风味数组["橘子","荔枝"]
- startDay/endDay: 养豆期/赏味期天数
- blendComponents: 产地/庄园/处理法/品种 [{origin:"埃塞俄比亚",estate:"赏花",process:"日晒",variety:"原生种"}]
- notes: 处理站/海拔/批次号等补充信息（产地和庄园信息放 blendComponents，这里只放补充信息）

规则：数值不带单位/不编造/不确定不填/直接返回JSON`,

  methodRecognition: `你是OCR工具，提取图片中的咖啡冲煮方案，直接返回JSON。

关键规则：
1. 每个注水动作是独立步骤，duration=注水时长（秒）
2. 焖蒸/等待必须拆成两步：注水步骤 + wait步骤
   例：焖蒸30秒注水50g(10秒注完) → 注水10秒50g + 等待20秒
3. wait步骤只有label和duration字段，无water和detail
4. 闷蒸步骤一般是circle注水

JSON格式：
{
  "name":"方案名",
  "params":{
    "coffee":"咖啡粉量如15g",
    "water":"总水量如225g",
    "ratio":"粉水比如1:15",
    "grindSize":"研磨度如中细",
    "temp":"水温如92°C",
    "stages":[
      {"pourType":"center|circle|ice|bypass|wait|other","label":"步骤名","water":"注水量(纯数字)","duration":用时(纯数字),"detail":"说明"}
    ]
  }
}

规则：数值不带单位/不编造/不确定不填/直接返回JSON`,

  yearlyReport: `你是一位专业的咖啡品鉴师和文案作家。请根据用户一年的咖啡消费数据，撰写一份温暖、有趣、个性化的年度咖啡报告。

## 写作风格
- 温暖亲切，像老朋友聊天
- 适度幽默，有咖啡文化底蕴
- 数据与故事结合
- 简洁有力，每段不超过两句话

## 输出格式
直接输出5-7个自然段落，每段之间用空行分隔。不要使用任何标题、标签、编号或特殊格式。

## 内容要点（按顺序，自然融入段落中）
1. 开场问候，提及用户名和年份
2. 年度亮点数据（豆子数量、总重量等）
3. 最爱的烘焙商或产地
4. 口味偏好画像（处理法、品种等）
5. 冲煮习惯（时间、器具等）
6. 一个有趣的发现或计算
7. 结语祝福，期待新一年

## 注意事项
1. 必须使用提供的真实数据，不要编造
2. 如果某项数据为0或缺失，自然跳过不提
3. 保持积极温暖的语调
4. 纯文本输出，不要 JSON、不要 markdown`,

  feedbackModeration: `你是内容审核助手。请检查以下用户反馈内容是否包含违规信息（如仇恨言论、暴力、色情、垃圾广告、政治敏感、人身攻击等）。

## 输出格式（严格遵守 JSON）
{
  "safe": boolean
}

## 审核标准
1. 允许：对产品的建议、Bug反馈、一般性吐槽、咖啡相关讨论。
2. 禁止：
   - 明显的垃圾广告
   - 严重的脏话或人身攻击
   - 色情、暴力、恐怖内容
   - 政治敏感内容
   - 恶意刷屏

请只返回 JSON，不要包含其他文本。`,
};

/**
 * 数据验证规则
 */
export const validationRules = {
  roastLevels: [
    '极浅烘焙',
    '浅度烘焙',
    '中浅烘焙',
    '中度烘焙',
    '中深烘焙',
    '深度烘焙',
  ],
  beanTypes: ['espresso', 'filter', 'omni'],
  feedbackStatuses: [
    'pending',
    'open',
    'accepted',
    'rejected',
    'done',
    'pinned',
    'deleted',
  ],
  feedbackMinLength: 5,
  feedbackMaxLength: 200,
  replyMaxLength: 500,
  filenameMaxLength: 255,
};

export default {
  serverConfig,
  apiKeys,
  securityConfig,
  corsConfig,
  uploadConfig,
  rateLimitConfig,
  aiConfig,
  aiPrompts,
  validationRules,
};
