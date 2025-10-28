#!/bin/bash

# 性能检查脚本 - 自动检测常见性能问题

echo "🔍 开始性能检查..."
echo ""

# 颜色定义
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

issues_found=0

# 1. 检查循环中的内联函数
echo "1️⃣  检查循环中的内联函数..."
inline_functions=$(grep -r "\.map.*onClick={() =>" src/components 2>/dev/null | wc -l | tr -d ' ')
if [ "$inline_functions" -gt 0 ]; then
  echo -e "${RED}❌ 发现 $inline_functions 处内联函数定义${NC}"
  echo "   示例:"
  grep -rn "\.map.*onClick={() =>" src/components 2>/dev/null | head -3
  issues_found=$((issues_found + inline_functions))
else
  echo -e "${GREEN}✅ 未发现内联函数问题${NC}"
fi
echo ""

# 2. 检查缺失的 key 属性
echo "2️⃣  检查缺失的 React key..."
missing_keys=$(grep -r "\.map(" src/components | grep -v "key=" | wc -l | tr -d ' ')
if [ "$missing_keys" -gt 5 ]; then
  echo -e "${YELLOW}⚠️  发现 $missing_keys 处可能缺失 key 的 map${NC}"
  issues_found=$((issues_found + missing_keys / 2))
else
  echo -e "${GREEN}✅ key 使用正常${NC}"
fi
echo ""

# 3. 检查大文件（>1000行）
echo "3️⃣  检查过大的组件文件..."
large_files=$(find src/components src/app -name "*.tsx" -o -name "*.ts" | xargs wc -l | awk '$1 > 1000 {print}' | wc -l | tr -d ' ')
if [ "$large_files" -gt 0 ]; then
  echo -e "${YELLOW}⚠️  发现 $large_files 个大文件 (>1000行)${NC}"
  echo "   建议拆分:"
  find src/components src/app -name "*.tsx" -o -name "*.ts" | xargs wc -l | awk '$1 > 1000 {print $1, $2}' | head -5
  issues_found=$((issues_found + large_files))
else
  echo -e "${GREEN}✅ 文件大小合理${NC}"
fi
echo ""

# 4. 检查未使用 useCallback 的事件处理器
echo "4️⃣  检查事件处理器优化..."
event_handlers=$(grep -r "const handle" src/components | grep -v "useCallback" | wc -l | tr -d ' ')
optimized_handlers=$(grep -r "const handle.*useCallback" src/components | wc -l | tr -d ' ')

if [ "$optimized_handlers" -gt 0 ]; then
  ratio=$((event_handlers * 100 / (event_handlers + optimized_handlers)))
  if [ "$ratio" -gt 30 ]; then
    echo -e "${YELLOW}⚠️  ${ratio}% 的事件处理器未使用 useCallback${NC}"
    issues_found=$((issues_found + 5))
  else
    echo -e "${GREEN}✅ 大部分事件处理器已优化${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  未检测到 useCallback 使用${NC}"
fi
echo ""

# 5. 检查 console.log (生产环境不应有)
echo "5️⃣  检查 console.log..."
console_logs=$(grep -r "console\.log" src --exclude-dir=node_modules | wc -l | tr -d ' ')
if [ "$console_logs" -gt 10 ]; then
  echo -e "${YELLOW}⚠️  发现 $console_logs 处 console.log${NC}"
  echo "   生产环境应移除或使用 console.warn/error"
  issues_found=$((issues_found + 2))
else
  echo -e "${GREEN}✅ console 使用合理${NC}"
fi
echo ""

# 6. 统计 useState 数量（单个文件中过多可能需要 useReducer）
echo "6️⃣  检查状态管理..."
max_states=$(find src/components src/app -name "*.tsx" | xargs grep -c "useState" 2>/dev/null | sort -t: -k2 -rn | head -1)
if [ ! -z "$max_states" ]; then
  count=$(echo "$max_states" | cut -d: -f2)
  file=$(echo "$max_states" | cut -d: -f1)
  if [ "$count" -gt 15 ]; then
    echo -e "${YELLOW}⚠️  $file 使用了 $count 个 useState${NC}"
    echo "   建议: 考虑使用 useReducer 或合并相关状态"
    issues_found=$((issues_found + 3))
  else
    echo -e "${GREEN}✅ 状态管理合理${NC}"
  fi
fi
echo ""

# 总结
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$issues_found" -eq 0 ]; then
  echo -e "${GREEN}🎉 恭喜! 未发现明显性能问题${NC}"
  exit 0
elif [ "$issues_found" -lt 10 ]; then
  echo -e "${YELLOW}⚠️  发现 $issues_found 个性能改进点${NC}"
  echo "建议: 查看上述提示并逐步优化"
  exit 0
else
  echo -e "${RED}❌ 发现 $issues_found 个性能问题${NC}"
  echo "建议: 优先修复高优先级问题"
  echo "查看文档: docs/performance-guidelines.md"
  exit 1
fi
