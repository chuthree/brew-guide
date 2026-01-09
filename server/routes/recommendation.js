/**
 * ☕️ 咖啡推荐路由
 *
 * @module routes/recommendation
 */

import express from 'express';
import { rateLimiter } from '../middlewares/rate-limit.js';
import { recommendBean } from '../services/ai.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * POST /api/recommend-bean
 * 每日咖啡推荐
 */
router.post(
  '/recommend-bean',
  rateLimiter,
  express.json(),
  async (req, res) => {
    try {
      const { history, inventory } = req.body;

      if (!inventory || !Array.isArray(inventory) || inventory.length === 0) {
        return res.status(400).json({ error: '库存不能为空' });
      }

      // 解析 AI Header
      const aiConfigHeader = req.headers['x-ai-config'];
      let aiConfig = null;
      if (aiConfigHeader) {
        try {
          aiConfig = JSON.parse(decodeURIComponent(aiConfigHeader));
        } catch (e) {
          logger.warn('Failed to parse X-AI-Config header', e);
        }
      }

      logger.info('🎲 Starting bean recommendation...');
      const recommendation = await recommendBean(history || [], inventory, aiConfig);
      
      res.json({
        success: true,
        data: recommendation,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Recommendation failed:', error);
      res.status(500).json({ error: '推荐生成失败' });
    }
  }
);

export default router;
