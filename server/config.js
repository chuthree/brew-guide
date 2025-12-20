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
  const required = ['SILICONFLOW_API_KEY'];
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
  allowedMimeTypes: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif',
  ],
  magicNumbers: {
    'image/jpeg': [[0xff, 0xd8, 0xff]],
    'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
    'image/gif': [
      [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
      [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], // GIF89a
    ],
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
  // 咖啡豆识别
  beanRecognition: {
    baseURL:
      'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    model: 'qwen3-vl-flash',
    temperature: 0.3,
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
  beanRecognition: `从咖啡豆包装图片提取信息，返回JSON。

{
  "name": "string // 必填，格式：烘焙商 豆名",
  "blendComponents": [{"origin": "string", "estate": "string", "process": "string", "variety": "string"}],
  "flavor": ["string"],
  "roastLevel": "极浅烘焙|浅度烘焙|中浅烘焙|中度烘焙|中深烘焙|深度烘焙",
  "roastDate": "YYYY-MM-DD // 缺年份补2025",
  "capacity": "number // 克，不带单位",
  "price": "number // 元，不带单位",
  "beanType": "filter|espresso|omni",
  "notes": "string // 海拔/处理站/批次号等其他信息(用/分隔)"
}

- 图片有多款(支)咖啡豆时，返回数组[{},{}]
- 只提取图片中可见的信息，未知字段不填
- blendComponents必须是数组，单品豆也用数组包裹
- beanType判断：≥300g/深烘/拼配→espresso；≤200g/浅烘/单品→filter；标注全能→omni；默认filter`,

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
