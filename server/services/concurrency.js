/**
 * 🚦 并发控制服务
 *
 * 使用信号量模式控制同时进行的 AI 请求数
 *
 * @module services/concurrency
 */

import { aiConfig } from '../config.js';
import logger from '../utils/logger.js';

const MAX_CONCURRENT = aiConfig.maxConcurrentRequests;

let currentRequests = 0;
const requestQueue = [];

/**
 * 获取 AI 请求许可（信号量）
 *
 * @returns {Promise<void>}
 */
export function acquireAISlot() {
  return new Promise(resolve => {
    const tryAcquire = () => {
      if (currentRequests < MAX_CONCURRENT) {
        currentRequests++;
        logger.debug(
          `Acquired AI slot: ${currentRequests}/${MAX_CONCURRENT}, Queue: ${requestQueue.length}`
        );
        resolve();
      } else {
        requestQueue.push(tryAcquire);
        logger.debug(`Queued AI request: ${requestQueue.length} waiting`);
      }
    };
    tryAcquire();
  });
}

/**
 * 释放 AI 请求许可
 */
export function releaseAISlot() {
  if (currentRequests > 0) {
    currentRequests--;
  }

  if (requestQueue.length > 0) {
    const next = requestQueue.shift();
    next();
  }

  logger.debug(
    `Released AI slot: ${currentRequests}/${MAX_CONCURRENT}, Queue: ${requestQueue.length}`
  );
}

/**
 * 获取当前并发状态
 *
 * @returns {Object} 并发状态
 */
export function getConcurrencyStatus() {
  return {
    current: currentRequests,
    max: MAX_CONCURRENT,
    queued: requestQueue.length,
  };
}

export default {
  acquireAISlot,
  releaseAISlot,
  getConcurrencyStatus,
};
