/**
 * 💬 反馈系统路由
 *
 * @module routes/feedback
 */

import express from 'express';
import {
  feedbackRateLimiter,
  voteRateLimiter,
} from '../middlewares/rate-limit.js';
import { adminAuth } from '../middlewares/auth.js';
import {
  readFeedbacks,
  getFeedbackById,
  addFeedback,
  updateFeedback,
  deleteFeedback,
} from '../services/feedback-storage.js';
import { moderateFeedback } from '../services/ai.js';
import { hashIP, generateId } from '../utils/crypto.js';
import { sanitizeContent } from '../utils/sanitize.js';
import {
  validateFeedbackContent,
  isValidFeedbackStatus,
} from '../utils/validator.js';
import { getClientIP } from '../utils/helpers.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/feedbacks
 * 获取反馈列表（公开接口）
 */
router.get('/feedbacks', (req, res) => {
  try {
    const { feedbacks } = readFeedbacks();
    const clientIP = getClientIP(req);
    const clientIpHash = hashIP(clientIP);

    logger.debug(`Fetching feedbacks for IP hash: ${clientIpHash}`);

    // 过滤并格式化反馈
    const publicFeedbacks = feedbacks
      .filter(f => {
        if (f.status === 'deleted') return false;
        if (f.status === 'pending' && f.ipHash !== clientIpHash) return false;
        return true;
      })
      .map(f => ({
        id: f.id,
        content: f.content,
        votes: f.votes,
        status: f.status,
        reply: f.reply,
        createdAt: f.createdAt,
        hasVoted: f.votedIpHashes?.includes(clientIpHash) || false,
        isOwner: f.ipHash === clientIpHash,
      }))
      .sort((a, b) => {
        // 置顶排在前面
        if (a.status === 'pinned' && b.status !== 'pinned') return -1;
        if (b.status === 'pinned' && a.status !== 'pinned') return 1;
        // 按投票数排序
        return b.votes - a.votes;
      });

    res.json({ feedbacks: publicFeedbacks });
  } catch (error) {
    logger.error('Failed to fetch feedbacks:', error);
    res.status(500).json({ error: '获取反馈失败' });
  }
});

/**
 * POST /api/feedbacks
 * 提交新反馈
 */
router.post(
  '/feedbacks',
  feedbackRateLimiter,
  express.json(),
  async (req, res) => {
    try {
      const { content } = req.body;

      // 验证内容
      const validation = validateFeedbackContent(content);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      const clientIP = getClientIP(req);
      const ipHash = hashIP(clientIP);

      // XSS 防护
      const safeContent = sanitizeContent(content.trim());

      // AI 内容审核
      let moderationResult = { safe: false };
      try {
        moderationResult = await moderateFeedback(safeContent);
      } catch (error) {
        logger.error(
          'AI moderation failed, falling back to manual review:',
          error
        );
        // 保持 safe: false, status: pending
      }

      const newFeedback = {
        id: generateId(),
        content: safeContent,
        ipHash,
        votes: 0,
        votedIpHashes: [],
        // 审核通过则直接公开(open)，否则待人工审核(pending)
        status: moderationResult.safe ? 'open' : 'pending',
        aiModeration: moderationResult,
        reply: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      addFeedback(newFeedback);
      logger.info(
        `New feedback submitted: ${safeContent.substring(0, 50)}... [AI: ${
          moderationResult.safe ? 'PASS' : 'FAIL'
        }]`
      );

      res.status(201).json({
        success: true,
        feedback: {
          id: newFeedback.id,
          content: newFeedback.content,
          votes: 0,
          status: newFeedback.status,
          createdAt: newFeedback.createdAt,
          hasVoted: false,
          isOwner: true,
        },
      });
    } catch (error) {
      logger.error('Failed to submit feedback:', error);
      res.status(500).json({ error: '提交反馈失败' });
    }
  }
);

/**
 * POST /api/feedbacks/:id/vote
 * 点赞/取消点赞
 */
router.post('/feedbacks/:id/vote', voteRateLimiter, (req, res) => {
  try {
    const { id } = req.params;
    const clientIP = getClientIP(req);
    const ipHash = hashIP(clientIP);

    const feedback = getFeedbackById(id);

    if (!feedback || feedback.status === 'deleted') {
      return res.status(404).json({ error: '反馈不存在' });
    }

    // 初始化投票数组
    if (!feedback.votedIpHashes) {
      feedback.votedIpHashes = [];
    }

    const hasVoted = feedback.votedIpHashes.includes(ipHash);

    if (hasVoted) {
      // 取消点赞
      feedback.votedIpHashes = feedback.votedIpHashes.filter(h => h !== ipHash);
      feedback.votes = Math.max(0, feedback.votes - 1);
    } else {
      // 点赞
      feedback.votedIpHashes.push(ipHash);
      feedback.votes++;
    }

    updateFeedback(id, {
      votes: feedback.votes,
      votedIpHashes: feedback.votedIpHashes,
    });

    res.json({
      success: true,
      votes: feedback.votes,
      hasVoted: !hasVoted,
    });
  } catch (error) {
    logger.error('Failed to vote:', error);
    res.status(500).json({ error: '投票失败' });
  }
});

/**
 * PUT /api/feedbacks/:id
 * 管理员更新反馈
 */
router.put('/feedbacks/:id', adminAuth, express.json(), (req, res) => {
  try {
    const { id } = req.params;
    const { status, reply } = req.body;

    const feedback = getFeedbackById(id);
    if (!feedback) {
      return res.status(404).json({ error: '反馈不存在' });
    }

    const updates = {};

    // 更新状态
    if (status && isValidFeedbackStatus(status)) {
      updates.status = status;
    }

    // 更新回复
    if (reply !== undefined) {
      updates.reply = sanitizeContent(reply.trim().substring(0, 500));
    }

    const updated = updateFeedback(id, updates);
    logger.info(`Feedback updated: ${id}, status: ${updated.status}`);

    res.json({ success: true, feedback: updated });
  } catch (error) {
    logger.error('Failed to update feedback:', error);
    res.status(500).json({ error: '更新反馈失败' });
  }
});

/**
 * DELETE /api/feedbacks/:id
 * 管理员删除反馈
 */
router.delete('/feedbacks/:id', adminAuth, (req, res) => {
  try {
    const { id } = req.params;

    const success = deleteFeedback(id);
    if (!success) {
      return res.status(404).json({ error: '反馈不存在' });
    }

    logger.info(`Feedback deleted: ${id}`);
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete feedback:', error);
    res.status(500).json({ error: '删除反馈失败' });
  }
});

/**
 * GET /api/feedbacks/admin
 * 管理员获取完整列表
 */
router.get('/feedbacks/admin', adminAuth, (req, res) => {
  try {
    const { feedbacks } = readFeedbacks();
    const activeFeedbacks = feedbacks.filter(f => f.status !== 'deleted');
    res.json({ feedbacks: activeFeedbacks });
  } catch (error) {
    logger.error('Failed to fetch admin feedbacks:', error);
    res.status(500).json({ error: '获取反馈失败' });
  }
});

export default router;
