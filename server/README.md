# Brew Guide API Server

咖啡豆图片识别 & 用户反馈 API 服务。

## 功能

- 📷 上传咖啡豆包装图片，AI 自动识别并提取咖啡豆信息
- 💬 用户反馈系统（提交建议、投票、管理员审核）
- 🔒 完善的安全校验（文件类型、魔数验证、XSS 防护、限流）

## 快速开始

### 1. 安装依赖

```bash
cd server
pnpm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```bash
# AI 识别 API Key (必填)
SILICONFLOW_API_KEY=your_api_key_here

# 反馈系统管理员密钥 (建议修改)
ADMIN_KEY=your-secure-admin-key

# IP 哈希 salt (建议修改以提高安全性)
IP_HASH_SALT=your-unique-salt
```

### 3. 启动服务

```bash
node server.js
```

服务将在 `http://localhost:3100` 启动。

## API 接口

### 健康检查

```
GET /health
```

### 图片识别

```
POST /api/recognize-bean
Content-Type: multipart/form-data

参数:
- image: 图片文件 (支持 JPG/PNG/GIF/WebP/HEIC，最大 5MB)
```

### 反馈系统

#### 获取反馈列表（公开）

```bash
GET /api/feedbacks
```

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
