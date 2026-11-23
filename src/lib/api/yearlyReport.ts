import { API_CONFIG } from './shared/config';

// 年度报告统计数据接口
export interface YearlyReportStats {
  // 咖啡豆数据
  beanCount: number;
  totalWeight: number;
  totalCost: number;
  avgPrice: number;

  // 偏好分析
  favoriteRoaster: string;
  favoriteRoasterCount: number;
  topOrigins: string[];
  topVarieties: string[];
  topProcesses: string[];
  roastPreference: string;

  // 冲煮数据
  brewCount: number;
  topEquipments: string[];
  earliestBrewTime: string;
  latestBrewTime: string;
  avgRating: number;
}

/**
 * 流式生成年度咖啡报告
 * @param username 用户名
 * @param year 统计年份
 * @param stats 统计数据
 * @param onChunk 接收到文本块时的回调
 * @param onComplete 完成时的回调
 * @param onError 错误时的回调
 */
export async function generateYearlyReportStream(
  username: string,
  year: number,
  stats: YearlyReportStats,
  onChunk: (text: string) => void,
  onComplete: () => void | Promise<void>,
  onError: (error: Error) => void
): Promise<void> {
  const apiUrl = `${API_CONFIG.baseURL}/api/yearly-report`;

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        username,
        year,
        stats,
      }),
      signal: AbortSignal.timeout(API_CONFIG.timeoutMs),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: '请求失败' }));
      console.error('❌ 响应错误:', error);
      throw new Error(error.error || `请求失败: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('无法读取响应流');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        throw new Error('报告生成中断，请重试');
      }

      buffer += decoder.decode(value, { stream: true });

      // 处理 SSE 事件
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // 保留不完整的行

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          const parsed = JSON.parse(data);
          if (parsed.error) throw new Error(parsed.error);
          if (parsed.content) onChunk(parsed.content);
          if (parsed.done) {
            await onComplete();
            return;
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ 年度报告请求失败:', error);

    if (
      error instanceof TypeError &&
      error.message.includes('Failed to fetch')
    ) {
      onError(new Error('请求失败，请检查网络连接或尝试更新应用'));
      return;
    }

    onError(error instanceof Error ? error : new Error('未知错误'));
  }
}
