# CafeDaily API Server

> ☕️ 独立部署的高性能咖啡助手后端服务
> 
> 提供咖啡豆识别 (AI Vision)、年度报告 (AI Generation)、反馈管理 (CRUD) 等核心能力。

## 📖 简介

CafeDaily API Server 是一个 **完全独立** 的后端服务。可以单独部署在任何 Node.js 环境或 Docker 容器中。

前端 (Next.js) 通过 RESTful API 与此服务通信。这意味着你可以将此 Server 部署在阿里云、AWS 或内网服务器上，而前端可以托管在 Vercel 或 Netlify 上。

## 🚀 独立部署指南

此服务不依赖于前端代码，只需要 `server/` 目录下的文件即可运行。

### 方式一：Docker 部署 (推荐)

最简单的部署方式，只需构建镜像并运行。

```bash
# 1. 构建镜像 (在 server/ 目录下)
docker build -t cafedaily-api .

# 2. 运行容器
docker run -d \
  -p 13141:13141 \
  -e SILICONFLOW_API_KEY="sk-..." \
  -e QINIU_API_KEY="sk-..." \
  -e ALLOWED_ORIGINS="https://your-frontend-domain.com" \
  --name cafedaily-api \
  cafedaily-api
```

### 方式二：Node.js 原生部署

适用于传统云服务器 (如 ECS, CVM) 或 PM2 管理环境。

**1. 准备文件**
将 `server/` 目录下的所有文件上传到服务器 (排除 `node_modules`)。可以使用我们提供的部署脚本：
```bash
#只需在项目根目录运行 (脚本会自动同步文件、构建 Docker 镜像并启动容器)
./server/deploy.sh
```

**2. 安装依赖**
```bash
cd /path/to/server
pnpm install --production
```

**3. 配置环境变量**
复制 `.env.example` 为 `.env.local` 并填入密钥。
*注意：在生产环境中，建议将 `ALLOWED_ORIGINS` 设置为你的前端域名，以防止未授权调用。*

**4. 启动服务**
```bash
# 使用 PM2 (推荐)
pm2 start server.js --name cafedaily-api

# 或直接运行
node server.js
```

## 🔐 生产环境关键配置

独立部署时，请务必关注以下环境变量：

| 变量 | 必填 | 生产建议 | 说明 |
| :--- | :--- | :--- | :--- |
| `SILICONFLOW_API_KEY` | ✅ | `sk-...` | **实际为阿里云 DashScope Key** (见下文) |
| `QINIU_API_KEY` | ✅ | `sk-...` | 七牛云 Key，用于图片识别 |
| `ALLOWED_ORIGINS` | ❌ | `https://your-domain.com` | **安全核心**：指定允许访问的前端域名，逗号分隔多个 |
| `ADMIN_KEY` | ❌ | (设置复杂密码) | 用于管理接口的鉴权 |
| `PORT` | ❌ | `13141` | 建议配合 Nginx 反向代理使用 |

**⚠️ 关于 SILICONFLOW_API_KEY 的特别说明：**
项目代码目前通过此变量名读取 AI 密钥，但实际上后端配置使用的是 **阿里云 DashScope (百炼)** 的兼容接口。请务必填入 **DashScope API Key** (开头通常为 `sk-`)。

## 🛠️ 接口调试

一旦部署成功，你可以通过以下方式验证服务是否独立运行正常：

```bash
# 1. 健康检查 (不依赖数据库或 AI)
curl http://your-server-ip:13141/health
# 预期返回: {"status":"ok", ...}

# 2. 测试 AI 连通性 (需要有效 Key)
curl -X POST http://your-server-ip:13141/api/feedbacks/moderate \
  -H "Content-Type: application/json" \
  -d '{"content":"test"}'
```

## 📂 项目结构 (Server 独立视角)

```
server/
├── Dockerfile                   # Docker 构建文件
├── deploy.sh                    # 自动化部署脚本
├── server.js                    # 启动入口
├── config.js                    # 集中配置
├── routes/                      # API 路由定义
├── services/                    # 业务逻辑与 AI 适配器
├── middlewares/                 # 鉴权与限流
└── utils/                       # 通用工具
```

## 🤝 贡献与支持

如果你在独立部署过程中遇到问题，请检查 `combined.log` 或 `error.log` 中的详细报错信息。
