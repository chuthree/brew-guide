/**
 * 💚 健康检查路由
 *
 * @module routes/health
 */

import express from 'express';
import { serverConfig } from '../config.js';
import { getConcurrencyStatus } from '../services/concurrency.js';

const router = express.Router();

/**
 * GET /health
 * 健康检查接口
 */
router.get('/health', (req, res) => {
  const status = getConcurrencyStatus();

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'brew-guide-api',
    environment: serverConfig.env,
    concurrency: {
      current: status.current,
      max: status.max,
      queued: status.queued,
    },
  });
});

export default router;
