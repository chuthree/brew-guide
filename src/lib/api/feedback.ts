/**
 * 反馈建议 API 客户端
 */

import { API_CONFIG } from './beanRecognition';

// 反馈状态类型
// pending: 审核中（用户提交后，内容安全未验证）
// open: 待处理（审核通过，等待处理）
// accepted: 已采纳（决定会做）
// rejected: 未采纳（决定不做）
// done: 已完成（已实现）
// pinned: 置顶（重要公告）
export type FeedbackStatus =
  | 'pending'
  | 'open'
  | 'accepted'
  | 'rejected'
  | 'done'
  | 'pinned';

// 反馈项接口
export interface Feedback {
  id: string;
  content: string;
  votes: number;
  status: FeedbackStatus;
  reply: string;
  createdAt: string;
  hasVoted: boolean;
  isOwner: boolean;
}

// API 响应接口
interface FeedbackListResponse {
  feedbacks: Feedback[];
}

interface SubmitFeedbackResponse {
  success: boolean;
  feedback: Feedback;
}

interface VoteResponse {
  success: boolean;
  votes: number;
  hasVoted: boolean;
}

/**
 * 获取反馈列表
 */
export async function getFeedbacks(): Promise<Feedback[]> {
  const response = await fetch(`${API_CONFIG.baseURL}/api/feedbacks`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: '获取反馈失败' }));
    throw new Error(error.error || '获取反馈失败');
  }

  const data: FeedbackListResponse = await response.json();
  return data.feedbacks;
}

/**
 * 提交新反馈
 */
export async function submitFeedback(content: string): Promise<Feedback> {
  const response = await fetch(`${API_CONFIG.baseURL}/api/feedbacks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: '提交反馈失败' }));
    throw new Error(error.error || '提交反馈失败');
  }

  const data: SubmitFeedbackResponse = await response.json();
  return data.feedback;
}

/**
 * 点赞/取消点赞
 */
export async function voteFeedback(id: string): Promise<VoteResponse> {
  const response = await fetch(
    `${API_CONFIG.baseURL}/api/feedbacks/${id}/vote`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '投票失败' }));
    throw new Error(error.error || '投票失败');
  }

  return response.json();
}

/**
 * 管理员：更新反馈状态/回复
 */
export async function updateFeedback(
  id: string,
  adminKey: string,
  data: { status?: FeedbackStatus; reply?: string }
): Promise<{ success: boolean }> {
  const response = await fetch(`${API_CONFIG.baseURL}/api/feedbacks/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': adminKey,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '操作失败' }));
    throw new Error(error.error || '操作失败');
  }

  return response.json();
}

/**
 * 管理员：删除反馈
 */
export async function deleteFeedback(
  id: string,
  adminKey: string
): Promise<{ success: boolean }> {
  const response = await fetch(`${API_CONFIG.baseURL}/api/feedbacks/${id}`, {
    method: 'DELETE',
    headers: {
      'x-admin-key': adminKey,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '删除失败' }));
    throw new Error(error.error || '删除失败');
  }

  return response.json();
}

/**
 * 管理员：获取完整列表（包含审核中）
 */
export async function getAdminFeedbacks(adminKey: string): Promise<Feedback[]> {
  // 彻底清理密钥：移除所有空白字符和不可见字符
  const cleanKey = adminKey.replace(/[\s\u200B-\u200D\uFEFF\u00A0]/g, '');

  const response = await fetch(`${API_CONFIG.baseURL}/api/feedbacks/admin`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': cleanKey,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '获取失败' }));
    throw new Error(error.error || '获取失败');
  }

  const data = await response.json();
  return data.feedbacks;
}

/**
 * 状态显示文本映射
 */
export const STATUS_LABELS: Record<FeedbackStatus, string> = {
  pending: '审核中',
  open: '待处理',
  accepted: '已采纳',
  rejected: '未采纳',
  done: '已完成',
  pinned: '置顶',
};

/**
 * 状态圆点颜色样式映射
 */
export const STATUS_DOT_COLORS: Record<FeedbackStatus, string> = {
  pending: 'bg-neutral-400 dark:bg-neutral-500',
  open: 'bg-blue-500 dark:bg-blue-400',
  accepted: 'bg-emerald-500 dark:bg-emerald-400',
  rejected: 'bg-neutral-300 dark:bg-neutral-600',
  done: 'bg-neutral-900 dark:bg-neutral-100',
  pinned: 'bg-neutral-900 dark:bg-neutral-100',
};
