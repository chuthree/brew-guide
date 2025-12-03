# Brew Guide API Server

咖啡豆图片识别 API 服务，基于阿里云通义千问 VL 模型。

## 功能

- 📷 上传咖啡豆包装图片
- 🤖 AI 自动识别并提取咖啡豆信息（品牌、产地、处理法、风味等）
- 🔒 完善的安全校验（文件类型、魔数验证、文件名检查）

## 快速开始

### 1. 安装依赖

```bash
cd server
npm install express cors multer axios dotenv
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入你的 API Key：

```
SILICONFLOW_API_KEY=your_api_key_here
```

> API Key 获取：[阿里云百炼平台](https://bailian.console.aliyun.com/)

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

**响应示例：**

```json
{
  "success": true,
  "data": {
    "name": "西可咖啡 洪都拉斯水洗瑰夏",
    "blendComponents": [
      {
        "origin": "洪都拉斯",
        "process": "水洗",
        "variety": "瑰夏"
      }
    ],
    "flavor": ["柑橘", "蜂蜜", "花香"],
    "roastLevel": "浅度烘焙",
    "roastDate": "2025-01-15",
    "capacity": 200
  },
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

## Docker 部署

```bash
docker build -t brew-guide-api .
docker run -d -p 3100:3100 --env-file .env brew-guide-api
```

## 环境变量

| 变量名                | 必填 | 默认值    | 说明                       |
| --------------------- | ---- | --------- | -------------------------- |
| `SILICONFLOW_API_KEY` | ✅   | -         | 阿里云百炼 API Key         |
| `PORT`                | ❌   | 3100      | 服务端口                   |
| `ALLOWED_ORIGINS`     | ❌   | localhost | 允许的前端域名（逗号分隔） |

## 安全说明

- API Key 通过环境变量配置，不会暴露在代码中
- 支持 CORS 白名单配置
- 文件上传有 MIME 类型和魔数双重验证
- 文件名安全检查（防止路径遍历攻击）

## License

MIT
