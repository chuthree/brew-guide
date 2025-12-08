/**
 * 💬 反馈存储服务
 *
 * 管理反馈数据的 CRUD 操作
 *
 * @module services/feedback-storage
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FEEDBACK_FILE = path.join(__dirname, '..', 'data', 'feedbacks.json');

/**
 * 确保数据目录和文件存在
 */
function ensureFeedbackFile() {
  const dataDir = path.dirname(FEEDBACK_FILE);

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    logger.info('Created data directory');
  }

  if (!fs.existsSync(FEEDBACK_FILE)) {
    fs.writeFileSync(FEEDBACK_FILE, JSON.stringify({ feedbacks: [] }, null, 2));
    logger.info('Created feedbacks file');
  }
}

/**
 * 读取反馈数据
 *
 * @returns {Object} 反馈数据
 */
export function readFeedbacks() {
  ensureFeedbackFile();

  try {
    const data = fs.readFileSync(FEEDBACK_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    logger.error('Failed to read feedbacks:', error);
    return { feedbacks: [] };
  }
}

/**
 * 写入反馈数据
 *
 * @param {Object} data - 反馈数据
 */
export function writeFeedbacks(data) {
  ensureFeedbackFile();

  try {
    fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    logger.error('Failed to write feedbacks:', error);
    throw error;
  }
}

/**
 * 获取单个反馈
 *
 * @param {string} id - 反馈 ID
 * @returns {Object|null} 反馈对象或 null
 */
export function getFeedbackById(id) {
  const { feedbacks } = readFeedbacks();
  return feedbacks.find(f => f.id === id) || null;
}

/**
 * 添加新反馈
 *
 * @param {Object} feedback - 反馈对象
 * @returns {Object} 添加后的反馈
 */
export function addFeedback(feedback) {
  const data = readFeedbacks();
  data.feedbacks.push(feedback);
  writeFeedbacks(data);
  logger.info(`Added new feedback: ${feedback.id}`);
  return feedback;
}

/**
 * 更新反馈
 *
 * @param {string} id - 反馈 ID
 * @param {Object} updates - 更新的字段
 * @returns {Object|null} 更新后的反馈或 null
 */
export function updateFeedback(id, updates) {
  const data = readFeedbacks();
  const feedback = data.feedbacks.find(f => f.id === id);

  if (!feedback) {
    return null;
  }

  Object.assign(feedback, updates, { updatedAt: new Date().toISOString() });
  writeFeedbacks(data);
  logger.info(`Updated feedback: ${id}`);
  return feedback;
}

/**
 * 删除反馈（软删除）
 *
 * @param {string} id - 反馈 ID
 * @returns {boolean} 是否成功
 */
export function deleteFeedback(id) {
  const data = readFeedbacks();
  const feedbackIndex = data.feedbacks.findIndex(f => f.id === id);

  if (feedbackIndex === -1) {
    return false;
  }

  data.feedbacks[feedbackIndex].status = 'deleted';
  data.feedbacks[feedbackIndex].updatedAt = new Date().toISOString();
  writeFeedbacks(data);
  logger.info(`Deleted feedback: ${id}`);
  return true;
}

export default {
  readFeedbacks,
  writeFeedbacks,
  getFeedbackById,
  addFeedback,
  updateFeedback,
  deleteFeedback,
};
