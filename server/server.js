import express from 'express';
import cors from 'cors';
import multer from 'multer';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3100;

// ==================== Rate Limiting ====================
const RATE_LIMIT_CONFIG = {
  windowMs: 60 * 1000, // 1 分钟
  maxRequests: 10, // 每个 IP 最多 10 次请求
};

const requestCounts = new Map();

// 清理过期的请求记录
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of requestCounts.entries()) {
    if (now - data.startTime > RATE_LIMIT_CONFIG.windowMs) {
      requestCounts.delete(ip);
    }
  }
}, RATE_LIMIT_CONFIG.windowMs);

/**
 * Rate Limiting 中间件
 */
function rateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();

  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, { count: 1, startTime: now });
    return next();
  }

  const data = requestCounts.get(ip);

  // 如果超过时间窗口，重置计数
  if (now - data.startTime > RATE_LIMIT_CONFIG.windowMs) {
    requestCounts.set(ip, { count: 1, startTime: now });
    return next();
  }

  // 检查是否超过限制
  if (data.count >= RATE_LIMIT_CONFIG.maxRequests) {
    console.log(`🚫 Rate limit exceeded for IP: ${ip}`);
    return res.status(429).json({
      error: '请求过于频繁，请稍后再试',
      retryAfter: Math.ceil(
        (RATE_LIMIT_CONFIG.windowMs - (now - data.startTime)) / 1000
      ),
    });
  }

  data.count++;
  next();
}

// ==================== AI 提示词配置 ====================
const AI_PROMPT = `请仔细识别图片中的咖啡豆包装信息，提取所有可见文字，返回JSON格式。

## 必填字段
- name: 品牌+产品名(如"西可咖啡 洪都拉斯水洗瑰夏")

## 重要字段(图片中有就必须提取)
- blendComponents: 咖啡豆成分数组，每个成分包含:
  - origin: 产地/产区(如"哥伦比亚""埃塞俄比亚 耶加雪菲")
  - process: 处理法(如"水洗""日晒""蜜处理")
  - variety: 品种(如"瑰夏""铁皮卡""波旁")
- flavor: 风味描述数组(如["柑橘","蜂蜜","花香"])
- roastLevel: 极浅烘焙|浅度烘焙|中浅烘焙|中度烘焙|中深烘焙|深度烘焙
- roastDate: 烘焙日期 YYYY-MM-DD格式(年份没有则默认2025)

## 可选字段
- capacity: 容量克数(纯数字)
- price: 价格(纯数字)
- beanType: espresso|filter|omni
- notes: 庄园名/处理站/海拔等补充信息

## 规则
1. 仔细阅读包装上所有文字
2. 产地、处理法、品种信息放入blendComponents
3. 数值不带单位
4. 不确定的信息不要编造
5. 直接返回JSON`;

// AI API 配置
const AI_CONFIG = {
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
  model: 'qwen3-vl-flash',
  temperature: 0.1,
  maxTokens: 1000,
  timeout: 120000,
};

// 文件上传安全配置
const UPLOAD_CONFIG = {
  // 允许的 MIME 类型
  allowedMimeTypes: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif',
  ],
  // 最大文件大小：5MB（与前端保持一致）
  maxFileSize: 5 * 1024 * 1024,
  // 图片文件魔数（Magic Number）用于验证文件内容
  magicNumbers: {
    'image/jpeg': [
      [0xff, 0xd8, 0xff], // JPEG
    ],
    'image/png': [
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], // PNG
    ],
    'image/gif': [
      [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
      [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], // GIF89a
    ],
    'image/webp': [
      [0x52, 0x49, 0x46, 0x46], // RIFF (WebP 以 RIFF 开头)
    ],
    // HEIC/HEIF 文件结构较复杂，检查 ftyp box
    'image/heic': [
      [0x00, 0x00, 0x00], // ftyp box (前4字节是大小，第5-8字节是 'ftyp')
    ],
    'image/heif': [
      [0x00, 0x00, 0x00], // ftyp box
    ],
  },
};

/**
 * 验证文件的魔数（Magic Number）
 * @param {Buffer} buffer - 文件内容缓冲区
 * @param {string} mimeType - 声明的 MIME 类型
 * @returns {boolean} - 是否通过验证
 */
function validateMagicNumber(buffer, mimeType) {
  const signatures = UPLOAD_CONFIG.magicNumbers[mimeType];
  if (!signatures) {
    // 对于没有定义魔数的类型，跳过魔数检查但记录警告
    console.warn(`⚠️ 未定义 ${mimeType} 的魔数验证，跳过魔数检查`);
    return true;
  }

  // HEIC/HEIF 特殊处理
  if (mimeType === 'image/heic' || mimeType === 'image/heif') {
    // 检查 ftyp box，通常在第 4-8 字节
    if (buffer.length >= 12) {
      const ftypMarker = buffer.toString('ascii', 4, 8);
      if (ftypMarker === 'ftyp') {
        const brand = buffer.toString('ascii', 8, 12);
        // 常见的 HEIC/HEIF 品牌标识
        const validBrands = ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'];
        return validBrands.some(b => brand.toLowerCase().includes(b));
      }
    }
    return false;
  }

  // WebP 特殊处理
  if (mimeType === 'image/webp') {
    if (buffer.length >= 12) {
      const riff = buffer.toString('ascii', 0, 4);
      const webp = buffer.toString('ascii', 8, 12);
      return riff === 'RIFF' && webp === 'WEBP';
    }
    return false;
  }

  // 标准魔数检查
  for (const signature of signatures) {
    if (buffer.length < signature.length) continue;

    let match = true;
    for (let i = 0; i < signature.length; i++) {
      if (buffer[i] !== signature[i]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }

  return false;
}

/**
 * 验证文件名安全性
 * @param {string} filename - 文件名
 * @returns {boolean} - 是否安全
 */
function isFilenameSafe(filename) {
  // 检查路径遍历攻击
  if (
    filename.includes('..') ||
    filename.includes('/') ||
    filename.includes('\\')
  ) {
    return false;
  }
  // 检查空字节注入
  if (filename.includes('\0')) {
    return false;
  }
  // 文件名长度限制
  if (filename.length > 255) {
    return false;
  }
  return true;
}

// 配置 CORS - 允许你的前端域名访问
app.use(
  cors({
    origin: function (origin, callback) {
      // 允许的域名列表（从环境变量读取，或使用默认开发域名）
      const allowedOrigins = process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',')
        : ['http://localhost:3000', 'http://localhost:3001'];

      // 允许没有 origin 的请求（如 curl、Postman）
      if (!origin) return callback(null, true);

      if (
        allowedOrigins.indexOf(origin) !== -1 ||
        allowedOrigins.includes('*')
      ) {
        callback(null, true);
      } else {
        console.log(`🚫 CORS 拒绝来自 ${origin} 的请求`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['POST', 'GET', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

app.use(express.json({ limit: '10mb' }));

// 配置文件上传
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: UPLOAD_CONFIG.maxFileSize,
  },
  fileFilter: (req, file, cb) => {
    // 验证文件名安全性
    if (!isFilenameSafe(file.originalname)) {
      return cb(new Error('文件名包含非法字符'));
    }

    // 验证 MIME 类型
    if (!UPLOAD_CONFIG.allowedMimeTypes.includes(file.mimetype)) {
      return cb(
        new Error(
          `不支持的文件类型: ${file.mimetype}，请上传 JPG、PNG、GIF 或 WebP 图片`
        )
      );
    }

    cb(null, true);
  },
});

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'brew-guide-api',
  });
});

// 图片识别接口（阿里云通义千问 VL）
app.post(
  '/api/recognize-bean',
  rateLimiter,
  upload.single('image'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: '请上传图片文件',
        });
      }

      const startTime = Date.now();
      console.log(
        `[${new Date().toISOString()}] 收到图片识别请求，文件大小: ${req.file.size} bytes`
      );

      // 二次验证：检查文件魔数（Magic Number）确保文件内容确实是图片
      if (!validateMagicNumber(req.file.buffer, req.file.mimetype)) {
        console.error(
          `❌ 文件魔数验证失败: ${req.file.originalname} (${req.file.mimetype})`
        );
        return res.status(400).json({
          error: '文件内容与声明的类型不匹配，请上传有效的图片文件',
        });
      }
      console.log(`✅ 文件魔数验证通过: ${req.file.mimetype}`);

      // 将图片转换为 base64
      const base64StartTime = Date.now();
      const base64Image = req.file.buffer.toString('base64');
      const imageUrl = `data:${req.file.mimetype};base64,${base64Image}`;
      console.log(`⏱️  Base64 编码耗时: ${Date.now() - base64StartTime}ms`);

      // 调用阿里云通义千问 API
      const apiKey = process.env.SILICONFLOW_API_KEY;
      if (!apiKey) {
        console.error('❌ 未配置 SILICONFLOW_API_KEY');
        return res.status(500).json({
          error: '服务器配置错误：未设置 API Key',
        });
      }

      console.log('🤖 开始调用 AI 识别 (通义千问3-VL-Flash)...');

      const aiStartTime = Date.now();

      // 检查是否支持流式（通过请求头判断）
      const acceptHeader = req.headers.accept || '';
      const supportsStreaming = acceptHeader.includes('text/event-stream');

      if (supportsStreaming) {
        // 流式响应
        console.log('📡 使用流式响应模式');
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const response = await axios.post(
          AI_CONFIG.baseURL,
          {
            model: AI_CONFIG.model,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'image_url',
                    image_url: {
                      url: imageUrl,
                    },
                  },
                  {
                    type: 'text',
                    text: AI_PROMPT,
                  },
                ],
              },
            ],
            stream: true,
            temperature: AI_CONFIG.temperature,
            max_tokens: AI_CONFIG.maxTokens,
            response_format: { type: 'json_object' },
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: AI_CONFIG.timeout,
            maxContentLength: 50 * 1024 * 1024,
            maxBodyLength: 50 * 1024 * 1024,
            responseType: 'stream',
          }
        );

        let fullContent = '';

        for await (const chunk of response.data) {
          const lines = chunk
            .toString()
            .split('\n')
            .filter(line => line.trim() !== '');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);

              if (data === '[DONE]') {
                continue;
              }

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices[0]?.delta?.content || '';
                if (content) {
                  fullContent += content;
                  process.stdout.write(content);
                  res.write(
                    `data: ${JSON.stringify({ content: fullContent })}\n\n`
                  );
                }
              } catch (e) {
                // 忽略解析错误
              }
            }
          }
        }

        console.log('\n');
        const aiDuration = Date.now() - aiStartTime;
        console.log(
          `⏱️  AI 识别耗时: ${aiDuration}ms (${(aiDuration / 1000).toFixed(1)}s)`
        );
        console.log('✅ AI 识别成功 (流式)');

        res.write('data: [DONE]\n\n');
        res.end();

        console.log(
          `⏱️  总耗时: ${Date.now() - startTime}ms (${((Date.now() - startTime) / 1000).toFixed(1)}s)`
        );
        console.log('✅ 响应已发送\n');

        return; // 流式响应完成，提前返回
      }

      // 非流式响应（向后兼容）
      console.log('📦 使用标准响应模式');
      const response = await axios.post(
        AI_CONFIG.baseURL,
        {
          model: AI_CONFIG.model,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: {
                    url: imageUrl,
                  },
                },
                {
                  type: 'text',
                  text: AI_PROMPT,
                },
              ],
            },
          ],
          temperature: AI_CONFIG.temperature,
          max_tokens: AI_CONFIG.maxTokens,
          response_format: { type: 'json_object' },
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: AI_CONFIG.timeout,
          maxContentLength: 50 * 1024 * 1024,
          maxBodyLength: 50 * 1024 * 1024,
        }
      );

      const aiDuration = Date.now() - aiStartTime;
      console.log(
        `⏱️  AI 识别耗时: ${aiDuration}ms (${(aiDuration / 1000).toFixed(1)}s)`
      );
      console.log('✅ AI 识别成功');

      const aiResponse = response.data.choices[0]?.message?.content || '';

      console.log('\n' + '='.repeat(60));
      console.log('🤖 AI 原始返回内容:');
      console.log('='.repeat(60));
      console.log(aiResponse);
      console.log('='.repeat(60) + '\n');

      // 尝试从返回内容中提取 JSON
      let beanData;
      try {
        // 移除可能的 markdown 代码块标记
        let jsonStr = aiResponse.trim();
        if (jsonStr.startsWith('```json')) {
          jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (jsonStr.startsWith('```')) {
          jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        beanData = JSON.parse(jsonStr);

        // 处理可能的嵌套结构 (如 {"单豆": [...]} 或 {"多豆": [...]})
        if (
          beanData &&
          typeof beanData === 'object' &&
          !Array.isArray(beanData)
        ) {
          // 检查是否有 "单豆" 或 "多豆" 等中文键
          const possibleKeys = ['单豆', '多豆', '咖啡豆', 'beans', 'data'];
          for (const key of possibleKeys) {
            if (beanData[key]) {
              beanData = beanData[key];
              console.log(`⚠️ 检测到嵌套结构,已提取 "${key}" 字段`);
              break;
            }
          }
        }

        // 处理数组或单个对象
        const dataArray = Array.isArray(beanData) ? beanData : [beanData];

        // 有效的烘焙度选项
        const validRoastLevels = [
          '极浅烘焙',
          '浅度烘焙',
          '中浅烘焙',
          '中度烘焙',
          '中深烘焙',
          '深度烘焙',
        ];

        // 有效的咖啡豆类型选项
        const validBeanTypes = ['espresso', 'filter', 'omni'];

        // 验证每个咖啡豆
        for (const bean of dataArray) {
          // 验证 name 字段
          if (
            !bean.name ||
            typeof bean.name !== 'string' ||
            bean.name.trim() === ''
          ) {
            throw new Error('识别结果缺少咖啡豆名称');
          }

          // 验证并修正 roastLevel 字段
          if (bean.roastLevel) {
            // 只有当识别到烘焙度时才进行验证
            if (!validRoastLevels.includes(bean.roastLevel)) {
              console.warn(
                `⚠️ 咖啡豆 "${bean.name}" 烘焙度 "${bean.roastLevel}" 不在有效选项中，已删除该字段`
              );
              delete bean.roastLevel;
            }
          }
          // 如果没有识别到烘焙度，不添加该字段（烘焙度不是必需的）

          // 验证并修正 beanType 字段
          if (bean.beanType) {
            // 只有当识别到咖啡豆类型时才进行验证
            if (!validBeanTypes.includes(bean.beanType)) {
              console.warn(
                `⚠️ 咖啡豆 "${bean.name}" 类型 "${bean.beanType}" 不在有效选项中，已删除该字段`
              );
              delete bean.beanType;
            }
          }
          // 如果没有识别到咖啡豆类型，不添加该字段（类型不是必需的）
        }

        console.log('✅ JSON 解析成功');
        console.log('\n' + '='.repeat(60));
        console.log('📋 解析后的咖啡豆数据:');
        console.log('='.repeat(60));
        console.log(JSON.stringify(beanData, null, 2));
        console.log('='.repeat(60) + '\n');
      } catch (parseError) {
        console.error('❌ JSON 解析失败:', parseError.message);
        console.log('AI 原始返回:', aiResponse);

        return res.status(500).json({
          error: '无法识别图片中的咖啡豆信息',
          details: aiResponse,
          parseError: parseError.message,
        });
      }

      // 返回识别结果
      const responseData = {
        success: true,
        data: beanData,
        timestamp: new Date().toISOString(),
      };

      console.log('📤 准备返回响应给前端...');
      res.json(responseData);
      const totalDuration = Date.now() - startTime;
      console.log(
        `⏱️  总耗时: ${totalDuration}ms (${(totalDuration / 1000).toFixed(1)}s)`
      );
      console.log('✅ 响应已发送\n');
    } catch (error) {
      console.error('❌ 识别失败:', error.message);
      console.error('错误堆栈:', error.stack);

      if (error.response) {
        // API 返回错误
        console.error('API 错误详情:', error.response.data);
        return res.status(error.response.status).json({
          error: '图片识别失败',
          details: error.response.data,
        });
      }

      res.status(500).json({
        error: '服务器内部错误',
        message: error.message,
      });
    }
  }
);

// 404 处理
app.use((req, res) => {
  res.status(404).json({
    error: '接口不存在',
    path: req.path,
  });
});

// 错误处理中间件
app.use((error, req, res, next) => {
  console.error('服务器错误:', error);

  // 处理 multer 错误
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      const maxSizeMB = UPLOAD_CONFIG.maxFileSize / (1024 * 1024);
      return res.status(400).json({
        error: `文件过大，请上传不超过 ${maxSizeMB}MB 的图片`,
      });
    }
    return res.status(400).json({
      error: '文件上传错误',
      message: error.message,
    });
  }

  // 处理文件验证错误
  if (
    error.message &&
    (error.message.includes('不支持的文件类型') ||
      error.message.includes('文件名包含非法字符'))
  ) {
    return res.status(400).json({
      error: error.message,
    });
  }

  res.status(500).json({
    error: '服务器内部错误',
    message: error.message,
  });
});

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════════════╗
║   🚀 Brew Guide API Server                        ║
║                                                   ║
║   📡 服务地址: http://0.0.0.0:${PORT}              ║
║   🏥 健康检查: http://0.0.0.0:${PORT}/health       ║
║   📝 识别接口: POST /api/recognize-bean           ║
║                                                   ║
║   ⏰ 启动时间: ${new Date().toLocaleString('zh-CN')}   ║
╚═══════════════════════════════════════════════════╝
  `);
});
