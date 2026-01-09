#!/bin/bash

# 🚀 CafeDaily API Server - 部署脚本
# 用于将重构后的模块化代码部署到远程服务器
# Usage: ./server/deploy.sh [host_alias]

set -e  # 遇到错误立即退出

# 1. 配置
# 默认目标主机 (可通过参数覆盖: ./deploy.sh my-server)
REMOTE_HOST="${1:-sh-cafe}"
REMOTE_DIR="~/cafedaily/api-server"

# 动态获取脚本所在目录 (即 server/ 目录的绝对路径)
LOCAL_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "╔═══════════════════════════════════════════════════╗"
echo "║   🚀 CafeDaily API Server - 部署开始             ║"
echo "╚═══════════════════════════════════════════════════╝"
echo "📍 本地目录: $LOCAL_DIR"
echo "🎯 目标主机: $REMOTE_HOST"
echo "📂 远程目录: $REMOTE_DIR"
echo ""

# 2. 检查本地文件
echo "📦 检查本地文件..."
if [ ! -f "$LOCAL_DIR/server.js" ]; then
  echo "❌ 错误: server.js 不存在 (在 $LOCAL_DIR 中未找到)"
  exit 1
fi

if [ ! -f "$LOCAL_DIR/config.js" ]; then
  echo "❌ 错误: config.js 不存在"
  exit 1
fi

echo "✅ 本地文件检查通过"
echo ""

# 3. 准备远程目录
echo "🔧 准备远程目录..."
ssh $REMOTE_HOST "mkdir -p $REMOTE_DIR"
echo "✅ 远程目录已就绪"
echo ""

# 4. 备份服务器上的旧文件
echo "💾 备份服务器上的旧文件..."
BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ssh $REMOTE_HOST "cd $REMOTE_DIR && [ -f server.js ] && cp server.js server.js.backup.$BACKUP_TIMESTAMP || true"
echo "✅ 备份完成: server.js.backup.$BACKUP_TIMESTAMP"
echo ""

# 5. 同步文件到服务器
echo "📤 同步文件到服务器..."

# RSync 同步
# 注意: $LOCAL_DIR/ 表示同步目录下的内容，而不是目录本身
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.env' \
  --exclude '.env.local' \
  --exclude '*.log' \
  --exclude 'data/feedbacks.json' \
  --exclude '.git' \
  --exclude 'pnpm-lock.yaml' \
  --exclude '.DS_Store' \
  "$LOCAL_DIR/" "$REMOTE_HOST:$REMOTE_DIR/"

echo "✅ 文件同步完成"
echo ""

# 5.1 上传环境配置 (.env)
echo "🔑 配置环境变量..."
if [ -f "$LOCAL_DIR/.env.local" ]; then
  echo "  发现本地 .env，同步为远程 .env..."
  scp "$LOCAL_DIR/.env" "$REMOTE_HOST:$REMOTE_DIR/.env"
  echo "  ✅ .env 更新成功"
else
  echo "  ⚠️ 本地未发现 .env.local，检查远程是否存在 .env..."
  if ssh $REMOTE_HOST "[ ! -f $REMOTE_DIR/.env ]"; then
      echo "  ❌ 远程也不存在 .env，Docker 启动可能会失败！"
      echo "  建议：cp server/.env.example server/.env.local 并填入密钥"
      # 不强制退出，也许镜像是自带 env 的（虽然不推荐）
  else
      echo "  ✅ 远程已存在 .env，跳过上传"
  fi
fi
echo ""

# 6. 安装依赖
echo "📦 检查并安装依赖..."
ssh $REMOTE_HOST "cd $REMOTE_DIR && npm install --omit=dev"
echo "✅ 依赖安装完成"
echo ""

# 7. 重启 Docker 容器
# 7. 构建并重启 Docker 容器
echo "🔄 构建并运行 Docker 容器..."
# 始终重建镜像并重启容器，确保代码更新生效
ssh $REMOTE_HOST "cd $REMOTE_DIR && \
  echo '🏗️ 构建 Docker 镜像...' && \
  sudo docker build -t cafedaily-api . && \
  echo '🛑 停止旧容器...' && \
  sudo docker stop cafedaily-api || true && \
  sudo docker rm cafedaily-api || true && \
  echo '🚀 启动新容器...' && \
  sudo docker run -d \
    -p 13141:13141 \
    --name cafedaily-api \
    --restart unless-stopped \
    --env-file .env \
    cafedaily-api"

echo "✅ Docker 容器/服务处理完成"
echo ""

# 8. 等待服务启动
echo "⏳ 等待服务启动（5秒）..."
sleep 5

# 9. 健康检查
echo "🏥 执行健康检查..."
HEALTH_CHECK=$(ssh $REMOTE_HOST "curl -s http://localhost:13141/health" || echo "FAILED")

if echo "$HEALTH_CHECK" | grep -q '"status":"ok"'; then
  echo "✅ 服务运行正常"
  echo ""
  echo "╔═══════════════════════════════════════════════════╗"
  echo "║   🎉 部署成功！                                   ║"
  echo "╚═══════════════════════════════════════════════════╝"
  echo ""
  echo "📊 健康检查响应:"
  echo "$HEALTH_CHECK" | jq . 2>/dev/null || echo "$HEALTH_CHECK"
else
  echo "❌ 警告: 健康检查失败 (可能是启动慢或端口不通)"
  echo "响应: $HEALTH_CHECK"
  echo ""
  echo "🔍 查看日志："
  echo "  ssh $REMOTE_HOST \"sudo docker logs cafedaily-api --tail 50\""
  # 不强制退出，因为有时只是 curl 失败但服务在运行
fi

echo ""
echo "📝 部署详情:"
echo "  - 主机: $REMOTE_HOST"
echo "  - 目录: $REMOTE_DIR"
echo "  - 备份: server.js.backup.$BACKUP_TIMESTAMP"
echo ""
