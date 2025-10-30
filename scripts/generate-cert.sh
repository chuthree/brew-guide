#!/bin/bash

# 脚本：生成本地开发用的自签名SSL证书
# 用途：为 HTTPS 开发服务器创建证书

set -e

CERT_DIR=".cert"
CERT_FILE="$CERT_DIR/localhost.pem"
KEY_FILE="$CERT_DIR/localhost-key.pem"

echo "🔐 开始生成自签名 SSL 证书..."

# 创建证书目录
mkdir -p "$CERT_DIR"

# 检查是否已安装 mkcert
if command -v mkcert &> /dev/null; then
  echo "✅ 检测到 mkcert，使用 mkcert 生成证书（推荐）"
  
  # 安装本地 CA（如果还没安装）
  mkcert -install
  
  # 生成证书
  mkcert -key-file "$KEY_FILE" -cert-file "$CERT_FILE" localhost 127.0.0.1 ::1
  
  echo "✅ 证书生成成功！使用 mkcert 生成，浏览器将自动信任。"
else
  echo "⚠️  未检测到 mkcert，使用 openssl 生成证书（浏览器会显示警告）"
  echo ""
  echo "💡 推荐安装 mkcert 以获得更好的开发体验："
  echo "   macOS:   brew install mkcert"
  echo "   Linux:   请参考 https://github.com/FiloSottile/mkcert#installation"
  echo "   Windows: choco install mkcert 或 scoop install mkcert"
  echo ""
  
  # 使用 openssl 生成自签名证书
  openssl req -x509 -newkey rsa:2048 \
    -keyout "$KEY_FILE" \
    -out "$CERT_FILE" \
    -days 365 \
    -nodes \
    -subj "/C=CN/ST=Local/L=Local/O=Dev/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
  
  echo "✅ 证书生成成功！"
  echo "⚠️  浏览器会提示不安全，点击"高级" -> "继续访问"即可。"
fi

echo ""
echo "📁 证书位置："
echo "   私钥: $KEY_FILE"
echo "   证书: $CERT_FILE"
echo ""
echo "🚀 现在可以运行: pnpm start:https"
