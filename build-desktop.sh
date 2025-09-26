#!/bin/bash

# Brew Guide 桌面应用构建脚本

set -e

echo "🚀 构建 Brew Guide 桌面应用..."

# 构建静态版本
if [ ! -d "out" ]; then
    echo "📦 构建静态版本..."
    pnpm run build
fi

# 创建输出目录
mkdir -p desktop

echo "⚙️ 开始打包..."

# 使用 Pake 打包
pake "./out/index.html" \
    --name "Brew Guide" \
    --icon "./assets/icon.icns" \
    --width 400 \
    --height 800 \
    --use-local-file \
    --hide-title-bar \
    --installer-language zh-CN

# 移动生成的文件到 desktop 目录
if [ -f "Brew Guide.dmg" ]; then
    mv "Brew Guide.dmg" "./desktop/"
    echo "✅ 生成: ./desktop/Brew Guide.dmg"
fi

if [ -d "Brew Guide.app" ]; then
    mv "Brew Guide.app" "./desktop/"
    echo "✅ 生成: ./desktop/Brew Guide.app"
fi

if ls *.deb 1> /dev/null 2>&1; then
    mv *.deb "./desktop/"
    echo "✅ 生成 Linux DEB 包"
fi

if ls *.msi 1> /dev/null 2>&1; then
    mv *.msi "./desktop/"
    echo "✅ 生成 Windows MSI 包"
fi

echo "🎉 构建完成！查看 ./desktop/ 目录"