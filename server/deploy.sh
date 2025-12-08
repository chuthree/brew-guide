#!/bin/bash

# 🚀 Brew Guide API Server - 部署脚本
# 用于将重构后的模块化代码部署到阿里云服务器

set -e  # 遇到错误立即退出

echo "╔═══════════════════════════════════════════════════╗"
echo "║   🚀 Brew Guide API Server - 部署开始            ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""

# 配置
REMOTE_USER="aliyun"
REMOTE_HOST="aliyun"
REMOTE_DIR="~/brew-guide/api-server"
LOCAL_DIR="/Users/chu3/Desktop/brew-guide/server"

# 1. 检查本地文件
echo "📦 检查本地文件..."
if [ ! -f "$LOCAL_DIR/server.js" ]; then
  echo "❌ 错误: server.js 不存在"
  exit 1
fi

if [ ! -f "$LOCAL_DIR/config.js" ]; then
  echo "❌ 错误: config.js 不存在"
  exit 1
fi

if [ ! -d "$LOCAL_DIR/middlewares" ]; then
  echo "❌ 错误: middlewares/ 目录不存在"
  exit 1
fi

echo "✅ 本地文件检查通过"
echo ""

# 2. 备份服务器上的旧文件
echo "💾 备份服务器上的旧文件..."
BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ssh $REMOTE_HOST "cd $REMOTE_DIR && [ -f server.js ] && cp server.js server.js.backup.$BACKUP_TIMESTAMP || true"
echo "✅ 备份完成: server.js.backup.$BACKUP_TIMESTAMP"
echo ""

# 3. 同步文件到服务器
echo "📤 同步文件到服务器..."

# 同步主文件
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.env' \
  --exclude '*.log' \
  --exclude 'data/feedbacks.json' \
  --exclude '.git' \
  --exclude 'pnpm-lock.yaml' \
  $LOCAL_DIR/ $REMOTE_HOST:$REMOTE_DIR/

echo "✅ 文件同步完成"
echo ""

# 4. 安装依赖（如果 package.json 有变化）
echo "📦 检查并安装依赖..."
ssh $REMOTE_HOST "cd $REMOTE_DIR && npm install --production"
echo "✅ 依赖安装完成"
echo ""

# 5. 重启 Docker 容器
echo "🔄 重启 Docker 容器..."
ssh $REMOTE_HOST "sudo docker restart brew-guide-api"
echo "✅ Docker 容器已重启"
echo ""

# 6. 等待服务启动
echo "⏳ 等待服务启动（5秒）..."
sleep 5

# 7. 健康检查
echo "🏥 执行健康检查..."
HEALTH_CHECK=$(ssh $REMOTE_HOST "curl -s http://localhost:3100/health" || echo "FAILED")

if echo "$HEALTH_CHECK" | grep -q '"status":"ok"'; then
  echo "✅ 服务运行正常"
  echo ""
  echo "╔═══════════════════════════════════════════════════╗"
  echo "║   🎉 部署成功！                                   ║"
  echo "╚═══════════════════════════════════════════════════╝"
  echo ""
  echo "📊 健康检查响应:"
  echo "$HEALTH_CHECK" | jq . || echo "$HEALTH_CHECK"
else
  echo "❌ 警告: 健康检查失败"
  echo "响应: $HEALTH_CHECK"
  echo ""
  echo "🔍 查看日志："
  echo "  ssh $REMOTE_HOST \"sudo docker logs brew-guide-api --tail 50\""
  exit 1
fi

echo ""
echo "📝 部署详情:"
echo "  - 备份文件: server.js.backup.$BACKUP_TIMESTAMP"
echo "  - 服务地址: http://your-server-ip:3100"
echo "  - 查看日志: ssh $REMOTE_HOST \"sudo docker logs brew-guide-api -f\""
echo ""
