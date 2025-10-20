#!/bin/bash

# 版本号更新脚本
# 使用方法：./scripts/update-version.sh <新版本号> [构建号]
# 例如：./scripts/update-version.sh 1.3.12
# 或者：./scripts/update-version.sh 1.3.12 3

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查参数
if [ -z "$1" ]; then
    echo -e "${RED}错误: 请提供版本号${NC}"
    echo "使用方法: $0 <版本号> [构建号]"
    echo "例如: $0 1.3.12"
    echo "或者: $0 1.3.12 3"
    exit 1
fi

NEW_VERSION=$1
BUILD_NUMBER=${2:-}

# 验证版本号格式 (x.y.z)
if ! [[ $NEW_VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo -e "${RED}错误: 版本号格式不正确，应该是 x.y.z 格式（例如：1.3.12）${NC}"
    exit 1
fi

echo -e "${GREEN}开始更新版本号到 ${NEW_VERSION}${NC}"

# 1. 更新 package.json
echo -e "${YELLOW}更新 package.json...${NC}"
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/" package.json
else
    # Linux
    sed -i "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/" package.json
fi

# 2. 更新 src/lib/core/config.ts
echo -e "${YELLOW}更新 src/lib/core/config.ts...${NC}"
if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/export const APP_VERSION = \".*\"/export const APP_VERSION = \"$NEW_VERSION\"/" src/lib/core/config.ts
else
    sed -i "s/export const APP_VERSION = \".*\"/export const APP_VERSION = \"$NEW_VERSION\"/" src/lib/core/config.ts
fi

# 3. 更新 README.md
echo -e "${YELLOW}更新 README.md...${NC}"
if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/版本-[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*-blue/版本-$NEW_VERSION-blue/" README.md
else
    sed -i "s/版本-[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*-blue/版本-$NEW_VERSION-blue/" README.md
fi

# 4. 更新 Android versionName
echo -e "${YELLOW}更新 android/app/build.gradle...${NC}"
if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/versionName \".*\"/versionName \"$NEW_VERSION\"/" android/app/build.gradle
else
    sed -i "s/versionName \".*\"/versionName \"$NEW_VERSION\"/" android/app/build.gradle
fi

# 5. 更新 Android versionCode (如果提供了构建号)
if [ -n "$BUILD_NUMBER" ]; then
    echo -e "${YELLOW}更新 Android versionCode 到 ${BUILD_NUMBER}...${NC}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/versionCode [0-9][0-9]*/versionCode $BUILD_NUMBER/" android/app/build.gradle
    else
        sed -i "s/versionCode [0-9][0-9]*/versionCode $BUILD_NUMBER/" android/app/build.gradle
    fi
fi

# 6. 更新 iOS MARKETING_VERSION
echo -e "${YELLOW}更新 ios/App/App.xcodeproj/project.pbxproj...${NC}"
if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/MARKETING_VERSION = [0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*;/MARKETING_VERSION = $NEW_VERSION;/g" ios/App/App.xcodeproj/project.pbxproj
else
    sed -i "s/MARKETING_VERSION = [0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*;/MARKETING_VERSION = $NEW_VERSION;/g" ios/App/App.xcodeproj/project.pbxproj
fi

# 7. 更新 iOS CURRENT_PROJECT_VERSION (如果提供了构建号)
if [ -n "$BUILD_NUMBER" ]; then
    echo -e "${YELLOW}更新 iOS CURRENT_PROJECT_VERSION 到 ${BUILD_NUMBER}...${NC}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/CURRENT_PROJECT_VERSION = [0-9][0-9]*;/CURRENT_PROJECT_VERSION = $BUILD_NUMBER;/g" ios/App/App.xcodeproj/project.pbxproj
    else
        sed -i "s/CURRENT_PROJECT_VERSION = [0-9][0-9]*;/CURRENT_PROJECT_VERSION = $BUILD_NUMBER;/g" ios/App/App.xcodeproj/project.pbxproj
    fi
fi

echo -e "${GREEN}✓ 版本号更新完成！${NC}"
echo ""
echo "已更新的文件："
echo "  ✓ package.json"
echo "  ✓ src/lib/core/config.ts"
echo "  ✓ README.md"
echo "  ✓ android/app/build.gradle (versionName)"
echo "  ✓ ios/App/App.xcodeproj/project.pbxproj (MARKETING_VERSION)"

if [ -n "$BUILD_NUMBER" ]; then
    echo "  ✓ android/app/build.gradle (versionCode: $BUILD_NUMBER)"
    echo "  ✓ ios/App/App.xcodeproj/project.pbxproj (CURRENT_PROJECT_VERSION: $BUILD_NUMBER)"
fi

echo ""
echo "版本号: ${GREEN}${NEW_VERSION}${NC}"
if [ -n "$BUILD_NUMBER" ]; then
    echo "构建号: ${GREEN}${BUILD_NUMBER}${NC}"
fi
