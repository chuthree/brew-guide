#!/bin/bash

# 🧪 Server 功能验证脚本
# 用于快速测试重构后的服务器所有功能
# 
# 用法：
#   ./test-server.sh          # 测试本地服务器 (localhost:13141)
#   ./test-server.sh prod     # 测试生产环境 (https://1.15.3.16)

# 检查参数
if [ "$1" = "prod" ] || [ "$1" = "production" ]; then
  MODE="production"
  BASE_URL="http://1.15.3.16"
  echo "╔═══════════════════════════════════════════════════╗"
  echo "║   🧪 CafeDaily API - 生产环境测试                   ║"
  echo "╚═══════════════════════════════════════════════════╝"
else
  MODE="local"
  BASE_URL="http://localhost:13141"
  echo "╔═══════════════════════════════════════════════════╗"
  echo "║   🧪 CafeDaily Server - 本地功能验证            ║"
  echo "╚═══════════════════════════════════════════════════╝"
fi

echo ""

# 从 .env 读取实际的 ADMIN_KEY（仅本地测试需要）
if [ "$MODE" = "local" ]; then
  ADMIN_KEY=$(grep ADMIN_KEY .env 2>/dev/null | cut -d '=' -f2)
  # 如果没有 .env 文件，使用默认值
  if [ -z "$ADMIN_KEY" ]; then
    ADMIN_KEY="cafedaily-admin-2025"
  fi
fi

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试计数器
TOTAL=0
PASSED=0
FAILED=0

# 测试函数
test_endpoint() {
  local name=$1
  local method=$2
  local endpoint=$3
  local data=$4
  local headers=$5
  local expected_status=${6:-200}
  
  TOTAL=$((TOTAL + 1))
  echo -n "[$TOTAL] Testing: $name ... "
  
  if [ -z "$data" ]; then
    if [ -z "$headers" ]; then
      response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint")
    else
      response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" $headers)
    fi
  else
    if [ -z "$headers" ]; then
      response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" \
        -H "Content-Type: application/json" \
        -d "$data")
    else
      response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" \
        -H "Content-Type: application/json" \
        $headers \
        -d "$data")
    fi
  fi
  
  status_code=$(echo "$response" | tail -n 1)
  body=$(echo "$response" | sed '$d')
  
  if [ "$status_code" -eq "$expected_status" ]; then
    echo -e "${GREEN}✅ PASS${NC} (HTTP $status_code)"
    PASSED=$((PASSED + 1))
    return 0
  else
    echo -e "${RED}❌ FAIL${NC} (Expected $expected_status, got $status_code)"
    echo "   Response: $body"
    FAILED=$((FAILED + 1))
    return 1
  fi
}

echo "🔍 检查服务器状态..."
if ! curl -s "$BASE_URL/health" > /dev/null 2>&1; then
  echo -e "${RED}❌ 服务器未运行！${NC}"
  echo "请先启动服务器: cd server && node server.js"
  exit 1
fi
echo -e "${GREEN}✅ 服务器运行中${NC}"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 测试基础接口"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_endpoint "健康检查" "GET" "/health"

if [ "$MODE" = "local" ]; then
  test_endpoint "404 处理" "GET" "/non-existent" "" "" 404
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💬 测试反馈系统"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_endpoint "获取反馈列表" "GET" "/api/feedbacks"

if [ "$MODE" = "local" ]; then
  # 本地环境才测试写入操作
  test_endpoint "提交反馈" "POST" "/api/feedbacks" '{"content":"自动化测试反馈"}' "" 201
  test_endpoint "提交空反馈（应失败）" "POST" "/api/feedbacks" '{"content":""}' "" 400
  test_endpoint "提交过短反馈（应失败）" "POST" "/api/feedbacks" '{"content":"测"}' "" 400

  # 获取刚创建的反馈 ID
  FEEDBACK_ID=$(curl -s "$BASE_URL/api/feedbacks" | jq -r '.feedbacks[0].id // empty')

  if [ -n "$FEEDBACK_ID" ]; then
    test_endpoint "点赞反馈" "POST" "/api/feedbacks/$FEEDBACK_ID/vote"
    test_endpoint "管理员更新反馈" "PUT" "/api/feedbacks/$FEEDBACK_ID" \
      '{"status":"open","reply":"感谢反馈！"}' \
      "-H x-admin-key:$ADMIN_KEY"
    test_endpoint "管理员删除反馈" "DELETE" "/api/feedbacks/$FEEDBACK_ID" "" \
      "-H x-admin-key:$ADMIN_KEY"
  fi

  test_endpoint "未授权的管理员操作（应失败）" "PUT" "/api/feedbacks/test123" \
    '{"status":"open"}' \
    "-H x-admin-key:wrong-key" 403
else
  # 生产环境只测试读取
  echo ""
  echo "📊 反馈系统详情:"
  response=$(curl -s "$BASE_URL/api/feedbacks")
  feedback_count=$(echo "$response" | jq '.feedbacks | length')
  echo "  - 反馈总数: $feedback_count"
  echo "  - 最新反馈:"
  echo "$response" | jq -r '.feedbacks[0] | "    ID: \(.id)\n    内容: \(.content)\n    点赞数: \(.votes)\n    状态: \(.status)"' 2>/dev/null || echo "    无反馈数据"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌿 测试咖啡豆识别"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$MODE" = "local" ]; then
  test_endpoint "无文件上传（应失败）" "POST" "/api/recognize-bean" "" "" 400
else
  echo "⏭️  跳过（生产环境不测试图片上传）"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 测试年度报告"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$MODE" = "local" ]; then
  test_endpoint "缺少数据（应失败）" "POST" "/api/yearly-report" '{}' "" 400
else
  echo "⏭️  跳过（生产环境不测试报告生成）"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 性能测试"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$MODE" = "production" ]; then
  echo ""
  echo "响应时间测试 (5次请求):"
  for i in {1..5}; do
    time_ms=$(curl -s -o /dev/null -w "%{time_total}" "$BASE_URL/health")
    time_s=$(echo "$time_ms * 1000" | bc)
    printf "  请求 %d: %.0f ms\n" $i $time_s
  done
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📈 测试结果汇总"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "总测试数: $TOTAL"
echo -e "${GREEN}通过: $PASSED${NC}"
if [ $FAILED -gt 0 ]; then
  echo -e "${RED}失败: $FAILED${NC}"
else
  echo -e "${GREEN}失败: $FAILED${NC}"
fi

SUCCESS_RATE=$(echo "scale=2; $PASSED * 100 / $TOTAL" | bc)
echo "成功率: $SUCCESS_RATE%"

echo ""
if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}╔═══════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║   🎉 所有测试通过！服务器运行正常   ║${NC}"
  echo -e "${GREEN}╚═══════════════════════════════════════╝${NC}"
  exit 0
else
  echo -e "${RED}╔═══════════════════════════════════════╗${NC}"
  echo -e "${RED}║   ⚠️  部分测试失败，请检查日志      ║${NC}"
  echo -e "${RED}╚═══════════════════════════════════════╝${NC}"
  exit 1
fi
