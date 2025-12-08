# Brew Guide API Server

> 咖啡助手后端服务 - 咖啡豆识别 · 年度报告 · 反馈系统

## 简介

Brew Guide API Server 是 Brew Guide 应用的后端服务，提供咖啡豆包装识别、年度报告生成、用户反馈管理等功能。采用模块化架构设计，从原始的 1550 行单文件重构为 18 个职责清晰的模块。

## 核心功能

- **咖啡豆识别** - AI 视觉识别咖啡豆包装信息（品牌、产地、风味、烘焙度等）
- **年度报告** - 基于用户数据生成个性化的咖啡年度总结
- **反馈系统** - 用户建议提交、点赞投票、管理员审核回复

## 技术栈

- **Runtime**: Node.js v25+
- **Framework**: Express.js 4.x
- **Logger**: Winston 3.x
- **AI API**: 阿里云通义千问（qwen3-vl-flash）、DeepSeek-V3.1
- **Package Manager**: pnpm

## 项目结构

```
server/
├── server.js                    # 应用入口（86 行）
├── config.js                    # 配置管理（200 行）
│
├── middlewares/                 # 中间件层
│   ├── auth.js                  # 管理员认证
│   ├── cors.js                  # 跨域处理
│   ├── error.js                 # 错误处理（404、500）
│   ├── rate-limit.js            # 4 种限流器
│   └── upload.js                # 文件上传验证
│
├── routes/                      # 路由层
│   ├── health.js                # 健康检查
│   ├── bean.js                  # 咖啡豆识别
│   ├── report.js                # 年度报告
│   └── feedback.js              # 反馈系统（6 个端点）
│
├── services/                    # 服务层
│   ├── ai.js                    # AI 调用（流式/非流式）
│   ├── concurrency.js           # 并发控制（信号量）
│   └── feedback-storage.js      # 反馈数据 CRUD
│
├── utils/                       # 工具层
│   ├── logger.js                # Winston 日志系统
│   ├── crypto.js                # 加密、哈希、ID 生成
│   ├── sanitize.js              # XSS 防护
│   ├── validator.js             # 输入验证
│   └── helpers.js               # 通用工具函数
│
├── data/
│   └── feedbacks.json           # 反馈数据存储
│
├── .env                         # 环境变量配置
├── .env.example                 # 配置模板
├── package.json                 # 依赖清单
└── test-server.sh               # 自动化测试脚本
```

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 环境配置

复制环境变量模板并填写配置：

```bash
cp .env.example .env
```

**必需配置：**

- `SILICONFLOW_API_KEY` - 阿里云硅基流动 API 密钥

**可选配置：**

```env
PORT=3100                        # 服务端口
NODE_ENV=development             # 运行环境
LOG_LEVEL=info                   # 日志级别（error/warn/info/debug）
ADMIN_KEY=your-secret-key        # 管理员密钥
ALLOWED_ORIGINS=http://localhost:3000  # 允许的跨域来源
```

### 3. 启动服务

**开发模式（推荐）：**

```bash
pnpm dev
```

**生产模式：**

```bash
node server.js
```

服务启动后访问：`http://localhost:3100`

### 4. 验证运行

**健康检查：**

```bash
curl http://localhost:3100/health
```

**运行测试套件：**

```bash
chmod +x test-server.sh
./test-server.sh
```

## API 接口文档

### 1. 健康检查

```http
GET /health
```

**响应示例：**

```json
{
  "status": "ok",
  "timestamp": "2025-12-08T07:03:39.690Z",
  "service": "brew-guide-api",
  "environment": "development",
  "concurrency": {
    "current": 0,
    "max": 3,
    "queued": 0
  }
}
```

---

### 2. 咖啡豆识别

```http
POST /api/recognize-bean
Content-Type: multipart/form-data
```

**请求参数：**

- `image` (File) - 咖啡豆包装图片（支持 JPEG/PNG/GIF/WebP/HEIC，最大 5MB）

**响应示例：**

```json
{
  "success": true,
  "data": {
    "name": "少数派 花月夜",
    "blendComponents": [
      {
        "origin": "埃塞俄比亚",
        "process": "日晒",
        "variety": "原生种"
      }
    ],
    "flavor": ["柑橘", "蜂蜜", "花香"],
    "roastLevel": "中浅烘焙",
    "beanType": "filter",
    "capacity": 227,
    "price": 128
  },
  "timestamp": "2025-12-08T07:05:22.341Z"
}
```

**限流规则：** 30 次/分钟/IP

**支持流式响应：**

```bash
curl -X POST http://localhost:3100/api/recognize-bean \
  -H "Accept: text/event-stream" \
  -F "image=@coffee.jpg"
```

---

### 3. 年度报告生成

```http
POST /api/yearly-report
Content-Type: application/json
```

```json
{
  "username": "咖啡爱好者",
  "year": 2025,
  "stats": {
    "beanCount": 42,
    "totalWeight": 9540,
    "totalCost": 5376,
    "favoriteRoaster": "少数派",
    "topOrigins": ["埃塞俄比亚", "哥伦比亚", "巴拿马"],
    "brewCount": 365
  }
}
```

**响应：** Server-Sent Events (SSE) 流式输出

**限流规则：** 5 次/天/IP

---

### 4. 反馈系统

#### 4.1 获取反馈列表

```http
GET /api/feedbacks
```

**响应示例：**

```json
{
  "feedbacks": [
    {
      "id": "miwt2u3xgkiibv4",
      "content": "希望支持更多咖啡豆品种识别",
      "votes": 12,
      "status": "open",
      "reply": "感谢建议，我们会持续优化模型",
      "createdAt": "2025-12-08T06:30:00.000Z",
      "hasVoted": false,
      "isOwner": false
    }
  ]
}
```

#### 4.2 提交反馈

```http
POST /api/feedbacks
Content-Type: application/json
```

**请求体：**

```json
{
  "content": "希望支持批量识别功能"
}
```

**限流规则：** 5 次/小时/IP

#### 4.3 点赞/取消点赞

```http
POST /api/feedbacks/:id/vote
```

**限流规则：** 10 次/分钟/IP

#### 4.4 管理员更新反馈（需认证）

```http
PUT /api/feedbacks/:id
Content-Type: application/json
X-Admin-Key: your-admin-key
```

**请求体：**

```json
{
  "status": "accepted",
  "reply": "已采纳，将在下个版本实现"
}
```

**状态值：** `pending` | `open` | `accepted` | `rejected` | `done` | `pinned` | `deleted`

#### 4.5 管理员删除反馈（需认证）

```http
DELETE /api/feedbacks/:id
X-Admin-Key: your-admin-key
```

#### 4.6 管理员获取完整列表（需认证）

```http
GET /api/feedbacks/admin
X-Admin-Key: your-admin-key
```

---

## 架构设计

### 分层架构

```
┌─────────────────────────────────────┐
│         Routes Layer                │  路由层：URL 映射、请求参数验证
├─────────────────────────────────────┤
│       Middlewares Layer             │  中间件层：认证、限流、CORS、错误处理
├─────────────────────────────────────┤
│        Services Layer               │  服务层：业务逻辑、AI 调用、数据管理
├─────────────────────────────────────┤
│         Utils Layer                 │  工具层：日志、加密、验证、辅助函数
├─────────────────────────────────────┤
│         Config Layer                │  配置层：环境变量、常量、验证规则
└─────────────────────────────────────┘
```

### 核心特性

#### 1. 专业日志系统（Winston）

- **多级别日志：** error, warn, info, debug
- **文件持久化：** `error.log`, `combined.log`
- **文件轮转：** 单文件最大 5MB，保留最近 5 个
- **开发模式：** 彩色控制台输出
- **生产模式：** JSON 格式结构化日志

**日志位置：**

```
server/
├── error.log         # 错误日志
├── combined.log      # 所有日志
├── exceptions.log    # 未捕获异常
└── rejections.log    # Promise 拒绝
```

#### 2. 并发控制（信号量模式）

- **最大并发：** 3 个 AI 请求同时进行
- **智能队列：** 超出并发限制的请求自动排队
- **状态监控：** 健康检查接口返回并发状态

#### 3. 限流保护（4 种限流器）

| 限流器   | 窗口期  | 最大次数 | 适用场景 |
| -------- | ------- | -------- | -------- |
| 通用限流 | 1 分钟  | 30 次    | 所有 API |
| 年度报告 | 24 小时 | 5 次     | 报告生成 |
| 反馈提交 | 1 小时  | 5 次     | 提交反馈 |
| 投票限流 | 1 分钟  | 10 次    | 点赞投票 |

#### 4. 安全防护

- ✅ **文件验证：** 魔数检查，防止伪装文件
- ✅ **XSS 防护：** 内容过滤，防止脚本注入
- ✅ **时序攻击防护：** 使用 `crypto.timingSafeEqual` 比较密钥
- ✅ **隐私保护：** IP 地址 SHA-256 哈希化
- ✅ **输入验证：** 文件名、内容长度、状态值校验

#### 5. 优雅关闭

- **信号处理：** 监听 `SIGTERM` / `SIGINT`
- **等待完成：** 等待当前请求处理完成
- **超时保护：** 30 秒后强制退出
- **资源清理：** 关闭数据库连接、清理临时文件

---

## 开发指南

### 添加新路由

1. 在 `routes/` 创建新路由文件：

```javascript
// routes/new-feature.js
import express from 'express';
const router = express.Router();

router.get('/new-feature', (req, res) => {
  res.json({ message: 'Hello World' });
});

export default router;
```

2. 在 `server.js` 注册路由：

```javascript
import newFeatureRouter from './routes/new-feature.js';
app.use('/api', newFeatureRouter);
```

### 添加新中间件

在 `middlewares/` 创建中间件文件并在 `server.js` 中引入。

### 日志使用示例

```javascript
import logger from './utils/logger.js';

// 基础日志
logger.info('Server started');
logger.warn('Rate limit exceeded');
logger.error('Database connection failed', { error });

// 便捷方法
logger.logRequest(req, 200, 123); // HTTP 请求
logger.logAI('qwen3-vl-flash', 2340); // AI 调用
logger.logSecurity('Admin auth failed', { ip }); // 安全事件
```

---

## 运维部署

### PM2 部署（推荐）

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start server.js --name brew-guide-api

# 查看日志
pm2 logs brew-guide-api

# 重启
pm2 restart brew-guide-api

# 停止
pm2 stop brew-guide-api
```

### Docker 部署

```dockerfile
FROM node:25-alpine
WORKDIR /app
COPY package*.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
EXPOSE 3100
CMD ["node", "server.js"]
```

```bash
docker build -t brew-guide-api .
docker run -d -p 3100:3100 --env-file .env brew-guide-api
```

### 环境变量说明

| 变量                  | 说明               | 默认值                      | 必需 |
| --------------------- | ------------------ | --------------------------- | ---- |
| `SILICONFLOW_API_KEY` | 阿里云 AI API 密钥 | -                           | ✅   |
| `PORT`                | 服务端口           | 3100                        | ❌   |
| `NODE_ENV`            | 运行环境           | development                 | ❌   |
| `LOG_LEVEL`           | 日志级别           | info                        | ❌   |
| `ADMIN_KEY`           | 管理员密钥         | brew-guide-admin-2025       | ❌   |
| `ALLOWED_ORIGINS`     | 允许的跨域来源     | localhost:3000,3001         | ❌   |
| `IP_HASH_SALT`        | IP 哈希盐值        | brew-guide-salt-2025-secure | ❌   |

---

## 性能优化建议

1. **启用 Node.js Cluster 模式：** 利用多核 CPU
2. **使用 Redis 缓存：** 缓存 AI 识别结果
3. **CDN 加速：** 静态资源分发
4. **数据库优化：** 使用 PostgreSQL/MongoDB 替代 JSON 文件
5. **负载均衡：** Nginx 反向代理多实例

---

## 故障排查

### 服务无法启动

**问题：** `Missing required env vars: SILICONFLOW_API_KEY`  
**解决：** 检查 `.env` 文件是否存在且包含 `SILICONFLOW_API_KEY`

### AI 调用失败

**问题：** `AI recognition failed: timeout`  
**解决：**

1. 检查网络连接
2. 增加 `aiConfig.beanRecognition.timeout` 配置
3. 检查 API 密钥是否有效

### 日志文件过大

**问题：** 磁盘空间不足  
**解决：** Winston 自动轮转，默认保留 5 个文件，每个最大 5MB。可调整 `logger.js` 中的 `maxsize` 和 `maxFiles`。

---

## 测试

```bash
# 运行自动化测试
./test-server.sh

# 手动测试健康检查
curl http://localhost:3100/health

# 测试图片识别
curl -X POST http://localhost:3100/api/recognize-bean \
  -F "image=@test.jpg"

# 测试反馈提交
curl -X POST http://localhost:3100/api/feedbacks \
  -H "Content-Type: application/json" \
  -d '{"content":"测试反馈"}'
```

---

## 许可证

MIT License

---

## 联系方式

- **Issues:** https://github.com/chuthree/brew-guide/issues
- **Documentation:** 见本 README

---

**更新日期：** 2025-12-08  
**版本：** 2.0.0  
**维护者：** Brew Guide Team
{
"username": "咖啡爱好者",
"year": 2025,
"stats": {
"beanCount": 42,
"totalWeight": 9540,
"totalCost": 5376,
"favoriteRoaster": "少数派",
"topOrigins": ["埃塞俄比亚", "哥伦比亚", "巴拿马"],
"brewCount": 365
}
}

````

**响应：** Server-Sent Events (SSE) 流式输出

**限流规则：** 5 次/天/IP

---

### 4. 反馈系统

#### 4.1 获取反馈列表

```http
GET /api/feedbacks
````

**响应示例：**

```json
{
  "feedbacks": [
    {
      "id": "miwt2u3xgkiibv4",
      "content": "希望支持更多咖啡豆品种识别",
      "votes": 12,
      "status": "open",
      "reply": "感谢建议，我们会持续优化模型",
      "createdAt": "2025-12-08T06:30:00.000Z",
      "hasVoted": false,
      "isOwner": false
    }
  ]
}
```

#### 4.2 提交反馈

````http
POST /api/feedbacks
Content-Type: application/json

### 反馈系统

#### 获取反馈列表（公开）

```bash
GET /api/feedbacks
````

返回所有已审核的反馈，待审核的反馈仅提交者可见。

#### 提交新反馈

```bash
POST /api/feedbacks
Content-Type: application/json

{"content": "建议内容（5-200字符）"}
```

限流：每个 IP 每小时最多 5 条。

#### 点赞/取消点赞

```bash
POST /api/feedbacks/:id/vote
```

限流：每个 IP 每分钟最多 10 次。

#### 管理员：获取全部反馈

```bash
GET /api/feedbacks/admin
Header: x-admin-key: <ADMIN_KEY>
```

#### 管理员：更新反馈状态/回复

```bash
PUT /api/feedbacks/:id
Header: x-admin-key: <ADMIN_KEY>
Content-Type: application/json

{"status": "accepted", "reply": "感谢反馈！"}
```

状态值：

- `pending` - 审核中（用户提交后默认状态，仅自己可见）
- `open` - 待处理（审核通过，公开可见）
- `accepted` - 已采纳（决定会做）
- `rejected` - 未采纳（决定不做）
- `done` - 已完成（已实现）
- `pinned` - 置顶（重要公告）
- `deleted` - 已删除（软删除）

#### 管理员：删除反馈

```bash
DELETE /api/feedbacks/:id
Header: x-admin-key: <ADMIN_KEY>
```

## Docker 部署

```bash
docker build -t brew-guide-api .
docker run -d -p 3100:3100 --env-file .env brew-guide-api
```

## 环境变量

| 变量名                | 必填 | 默认值                      | 说明                       |
| --------------------- | ---- | --------------------------- | -------------------------- |
| `SILICONFLOW_API_KEY` | ✅   | -                           | AI 识别 API Key            |
| `ADMIN_KEY`           | ⚠️   | brew-guide-admin-2025       | 反馈管理员密钥（建议修改） |
| `IP_HASH_SALT`        | ⚠️   | brew-guide-salt-2025-secure | IP 哈希 salt（建议修改）   |
| `PORT`                | ❌   | 3100                        | 服务端口                   |
| `ALLOWED_ORIGINS`     | ❌   | localhost                   | 允许的前端域名（逗号分隔） |

## 安全说明

- **API Key 保护**：通过环境变量配置，不暴露在代码中
- **CORS 白名单**：可配置允许的前端域名
- **文件上传安全**：MIME 类型和魔数双重验证，文件名安全检查
- **XSS 防护**：用户输入内容自动过滤危险字符
- **限流保护**：提交和投票接口均有速率限制
- **时序攻击防护**：管理员密钥使用时间安全比较
- **隐私保护**：IP 地址哈希化存储，公开 API 不暴露敏感信息
- **操作日志**：记录管理员验证和操作

## License

MIT
