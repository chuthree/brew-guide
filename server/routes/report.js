/**
 * 📊 年度报告路由
 *
 * @module routes/report
 */

import express from 'express';
import { yearlyReportRateLimiter } from '../middlewares/rate-limit.js';
import {
  acquireAISlot,
  releaseAISlot,
  getConcurrencyStatus,
} from '../services/concurrency.js';
import { generateYearlyReportStreaming } from '../services/ai.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * POST /api/yearly-report
 * 年度报告生成接口（流式）
 */
router.post(
  '/yearly-report',
  yearlyReportRateLimiter,
  express.json(),
  async (req, res) => {
    const startTime = Date.now();

    // 获取 AI 请求许可
    await acquireAISlot();
    const status = getConcurrencyStatus();
    logger.info(
      `📊 [Yearly Report] AI Concurrency: ${status.current}/${status.max}, Queue: ${status.queued}`
    );

    try {
      const { username, year, stats } = req.body;

      // 验证必要参数
      if (!stats || typeof stats !== 'object') {
        releaseAISlot();
        return res.status(400).json({ error: '缺少统计数据' });
      }

      const currentYear = year || new Date().getFullYear();
      const displayName = username || '咖啡爱好者';

      // 构建数据摘要
      const dataSummary = `
## 用户信息
- 用户名: ${displayName}
- 统计年份: ${currentYear}

## 咖啡豆数据
- 购买豆子数量: ${stats.beanCount || 0} 款
- 总重量: ${stats.totalWeight || 0} 克
- 总花费: ${stats.totalCost || 0} 元
- 平均单价: ${stats.avgPrice || 0} 元/包

## 偏好分析
- 最爱烘焙商: ${stats.favoriteRoaster || '暂无数据'}（购买 ${stats.favoriteRoasterCount || 0} 次）
- 最爱产地 TOP3: ${(stats.topOrigins || []).join('、') || '暂无数据'}
- 最爱品种 TOP3: ${(stats.topVarieties || []).join('、') || '暂无数据'}
- 最爱处理法 TOP3: ${(stats.topProcesses || []).join('、') || '暂无数据'}
- 烘焙度偏好: ${stats.roastPreference || '暂无数据'}

## 冲煮数据
- 冲煮次数: ${stats.brewCount || 0} 次
- 常用器具: ${(stats.topEquipments || []).join('、') || '暂无数据'}
- 最早冲煮时间: ${stats.earliestBrewTime || '暂无数据'}
- 最晚冲煮时间: ${stats.latestBrewTime || '暂无数据'}
- 平均评分: ${stats.avgRating || '暂无数据'}
`;

      logger.info('🤖 Generating yearly report (streaming)...');

      // 设置流式响应头
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      // 监听客户端断开
      let isClientDisconnected = false;
      req.on('close', () => {
        if (!res.writableEnded) {
          logger.warn('[Yearly Report] Client disconnected');
          isClientDisconnected = true;
          releaseAISlot();
        }
      });

      const response = await generateYearlyReportStreaming(dataSummary);
      let fullContent = '';

      response.data.on('data', chunk => {
        if (isClientDisconnected) {
          logger.warn('[Yearly Report] Client disconnected, stopping');
          response.data.destroy();
          return;
        }

        const lines = chunk
          .toString()
          .split('\n')
          .filter(line => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || '';
              if (content) {
                fullContent += content;
                if (!isClientDisconnected && !res.writableEnded) {
                  res.write(`data: ${JSON.stringify({ content })}\n\n`);
                }
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      });

      response.data.on('end', () => {
        logger.info(
          `✅ Yearly report completed in ${Date.now() - startTime}ms`
        );
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
        releaseAISlot();
      });

      response.data.on('error', err => {
        logger.error('Yearly report streaming error:', err);
        res.write(`data: ${JSON.stringify({ error: '生成过程中断' })}\n\n`);
        res.end();
        releaseAISlot();
      });
    } catch (error) {
      releaseAISlot();
      logger.error('Yearly report generation failed:', error);

      if (error.response) {
        return res.status(error.response.status).json({
          error: '报告生成失败',
          details: error.response.data,
        });
      }

      res.status(500).json({
        error: '服务器内部错误',
        message: error.message,
      });
    }
  }
);

export default router;
