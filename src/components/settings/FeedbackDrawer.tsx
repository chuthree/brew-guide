'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import { showToast } from '@/components/common/feedback/LightToast';
import { useModalHistory } from '@/lib/hooks/useModalHistory';
import {
  getFeedbacks,
  getAdminFeedbacks,
  submitFeedback,
  voteFeedback,
  updateFeedback,
  deleteFeedback,
  Feedback,
  FeedbackStatus,
  STATUS_LABELS,
  STATUS_DOT_COLORS,
} from '@/lib/api/feedback';
import {
  ThumbsUp,
  MessageCircle,
  Shield,
  Trash2,
  ArrowUp,
  Loader2,
} from 'lucide-react';
import { Storage } from '@/lib/core/storage';

// 解码 HTML 实体
const decodeHtml = (text: string): string => {
  if (!text) return '';
  const txt = document.createElement('textarea');
  txt.innerHTML = text;
  return txt.value;
};

interface FeedbackDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  hapticFeedback?: boolean;
}

// 步骤类型
type FeedbackStep = 'list' | 'submit' | 'admin-login' | 'admin-action';

// 管理员密钥存储配置
const ADMIN_KEY_STORAGE_KEY = 'feedbackAdminKey';

// 简单的密钥混淆（增加一层安全性，但不是强加密）
const obfuscateKey = (key: string): string => {
  // 使用 Base64 和简单的字符替换来混淆
  const base64 = btoa(key);
  return base64.split('').reverse().join('');
};

const deobfuscateKey = (obfuscated: string): string => {
  try {
    const reversed = obfuscated.split('').reverse().join('');
    return atob(reversed);
  } catch {
    return '';
  }
};

// 管理员密钥存储（会话级别，关闭后清除）
let adminKeyCache: string | null = null;

// 持久化存储的管理员密钥工具
const AdminKeyStorage = {
  // 保存密钥
  async save(key: string): Promise<void> {
    try {
      const obfuscated = obfuscateKey(key);
      await Storage.set(ADMIN_KEY_STORAGE_KEY, obfuscated);
    } catch (error) {
      console.error('保存管理员密钥失败:', error);
    }
  },

  // 读取密钥
  async load(): Promise<string | null> {
    try {
      const obfuscated = await Storage.get(ADMIN_KEY_STORAGE_KEY);
      if (!obfuscated) return null;
      return deobfuscateKey(obfuscated);
    } catch (error) {
      console.error('读取管理员密钥失败:', error);
      return null;
    }
  },

  // 清除密钥
  async clear(): Promise<void> {
    try {
      await Storage.remove(ADMIN_KEY_STORAGE_KEY);
    } catch (error) {
      console.error('清除管理员密钥失败:', error);
    }
  },
};

const FeedbackDrawer: React.FC<FeedbackDrawerProps> = ({
  isOpen,
  onClose,
  hapticFeedback = false,
}) => {
  const [currentStep, setCurrentStep] = useState<FeedbackStep>('list');
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inputContent, setInputContent] = useState('');
  const [votingIds, setVotingIds] = useState<Set<string>>(new Set());
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 列表滚动状态（用于显示渐变阴影）
  const listRef = useRef<HTMLDivElement>(null);
  const [showTopShadow, setShowTopShadow] = useState(false);
  const [showBottomShadow, setShowBottomShadow] = useState(false);

  // 检测列表滚动位置
  const handleListScroll = useCallback(() => {
    if (!listRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    setShowTopShadow(scrollTop > 10);
    setShowBottomShadow(scrollTop < scrollHeight - clientHeight - 10);
  }, []);

  // 筛选状态
  const [activeFilter, setActiveFilter] = useState<FeedbackStatus | 'all'>(
    'open'
  );

  // 管理员模式
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminKeyInput, setAdminKeyInput] = useState('');
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(
    null
  );
  const [adminReply, setAdminReply] = useState('');
  const [isAdminLoading, setIsAdminLoading] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  // 触发震动反馈
  const triggerHaptic = useCallback(async () => {
    if (hapticFeedback) {
      const hapticsUtils = (await import('@/lib/ui/haptics')).default;
      hapticsUtils.light();
    }
  }, [hapticFeedback]);

  // 加载反馈列表
  const loadFeedbacks = useCallback(
    async (useAdminApi = false) => {
      setIsLoading(true);
      try {
        let data: Feedback[];
        if (useAdminApi && adminKeyCache) {
          data = await getAdminFeedbacks(adminKeyCache);
        } else {
          data = await getFeedbacks();
        }
        setFeedbacks(data);
        // 加载完成后延迟检测阴影（等待 DOM 更新）
        setTimeout(() => handleListScroll(), 50);
      } catch (error) {
        console.error('加载反馈失败:', error);
        showToast({
          type: 'error',
          title: error instanceof Error ? error.message : '加载反馈失败',
        });
        // 如果管理员 API 失败，退出管理员模式并清除保存的密钥
        if (useAdminApi) {
          setIsAdminMode(false);
          adminKeyCache = null;
          await AdminKeyStorage.clear();
        }
      } finally {
        setIsLoading(false);
      }
    },
    [handleListScroll]
  );

  // 打开时加载数据
  useEffect(() => {
    if (isOpen) {
      setCurrentStep('list');
      setInputContent('');
      setSelectedFeedback(null);
      setAdminReply('');
      loadFeedbacks(isAdminMode);
    }
  }, [isOpen, loadFeedbacks, isAdminMode]);

  // 初始化时尝试加载已保存的管理员密钥
  useEffect(() => {
    const loadSavedAdminKey = async () => {
      const savedKey = await AdminKeyStorage.load();
      if (savedKey) {
        try {
          // 验证保存的密钥是否仍然有效
          await getAdminFeedbacks(savedKey);
          adminKeyCache = savedKey;
          setIsAdminMode(true);
          console.log('已自动恢复管理员模式');
        } catch {
          // 密钥已失效，清除保存的密钥
          await AdminKeyStorage.clear();
          console.log('保存的管理员密钥已失效，已清除');
        }
      }
    };

    loadSavedAdminKey();
  }, []);

  // 返回列表
  const goBackToList = useCallback(() => {
    setCurrentStep('list');
    setInputContent('');
    setSelectedFeedback(null);
    setAdminReply('');
  }, []);

  // 管理提交步骤的返回行为
  useModalHistory({
    id: 'feedback-submit',
    isOpen:
      isOpen &&
      (currentStep === 'submit' ||
        currentStep === 'admin-login' ||
        currentStep === 'admin-action'),
    onClose: goBackToList,
  });

  // 长按进入管理员登录
  const handleLongPressStart = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      triggerHaptic();
      if (isAdminMode) {
        // 已是管理员模式，长按退出
        setIsAdminMode(false);
        adminKeyCache = null;
        // 清除保存的密钥
        AdminKeyStorage.clear();
        showToast({ type: 'info', title: '已退出管理员模式' });
        loadFeedbacks(false);
      } else {
        // 进入管理员登录
        setCurrentStep('admin-login');
        setAdminKeyInput('');
      }
    }, 800);
  }, [triggerHaptic, isAdminMode, loadFeedbacks]);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // 验证管理员密钥
  const handleAdminLogin = useCallback(async () => {
    if (!adminKeyInput.trim()) {
      showToast({ type: 'error', title: '请输入密钥' });
      return;
    }

    setIsAdminLoading(true);
    try {
      // 尝试获取管理员列表来验证密钥
      await getAdminFeedbacks(adminKeyInput);
      adminKeyCache = adminKeyInput;
      setIsAdminMode(true);
      setCurrentStep('list');
      triggerHaptic();
      // 保存密钥到本地存储
      await AdminKeyStorage.save(adminKeyInput);
      showToast({ type: 'success', title: '已进入管理员模式' });
      loadFeedbacks(true);
    } catch {
      showToast({ type: 'error', title: '密钥错误' });
    } finally {
      setIsAdminLoading(false);
      setAdminKeyInput('');
    }
  }, [adminKeyInput, triggerHaptic, loadFeedbacks]);

  // 管理员操作：更新状态
  const handleUpdateStatus = useCallback(
    async (status: FeedbackStatus) => {
      if (!selectedFeedback || !adminKeyCache) return;

      setIsAdminLoading(true);
      try {
        await updateFeedback(selectedFeedback.id, adminKeyCache, {
          status,
          reply: adminReply.trim() || undefined,
        });
        triggerHaptic();
        showToast({ type: 'success', title: '更新成功' });
        // 先刷新列表，再返回
        await loadFeedbacks(true);
        goBackToList();
      } catch (error) {
        showToast({
          type: 'error',
          title: error instanceof Error ? error.message : '操作失败',
        });
      } finally {
        setIsAdminLoading(false);
      }
    },
    [selectedFeedback, adminReply, triggerHaptic, goBackToList, loadFeedbacks]
  );

  // 管理员操作：删除
  const handleDelete = useCallback(async () => {
    if (!selectedFeedback || !adminKeyCache) return;

    setIsAdminLoading(true);
    try {
      await deleteFeedback(selectedFeedback.id, adminKeyCache);
      triggerHaptic();
      showToast({ type: 'success', title: '已删除' });
      // 先刷新列表，再返回
      await loadFeedbacks(true);
      goBackToList();
    } catch (error) {
      showToast({
        type: 'error',
        title: error instanceof Error ? error.message : '删除失败',
      });
    } finally {
      setIsAdminLoading(false);
    }
  }, [selectedFeedback, triggerHaptic, goBackToList, loadFeedbacks]);

  // 点击反馈卡片（管理员模式）
  const handleFeedbackClick = useCallback(
    (feedback: Feedback) => {
      if (!isAdminMode) return;
      setSelectedFeedback(feedback);
      setAdminReply(feedback.reply || '');
      setCurrentStep('admin-action');
    },
    [isAdminMode]
  );

  // 调整输入框高度
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 120);
    textarea.style.height = `${Math.max(32, newHeight)}px`;
  }, []);

  // 提交反馈
  const handleSubmit = useCallback(async () => {
    const content = inputContent.trim();
    if (!content) {
      showToast({ type: 'error', title: '请输入反馈内容' });
      return;
    }
    if (content.length < 5) {
      showToast({ type: 'error', title: '反馈内容至少需要 5 个字符' });
      return;
    }

    setIsSubmitting(true);
    try {
      const newFeedback = await submitFeedback(content);
      setFeedbacks(prev => [newFeedback, ...prev]);
      setInputContent('');
      if (textareaRef.current) {
        textareaRef.current.style.height = '32px';
      }
      triggerHaptic();
      showToast({ type: 'success', title: '反馈提交成功' });
    } catch (error) {
      showToast({
        type: 'error',
        title: error instanceof Error ? error.message : '提交失败',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [inputContent, triggerHaptic]);

  // 点赞
  const handleVote = useCallback(
    async (id: string) => {
      if (votingIds.has(id)) return;

      setVotingIds(prev => new Set(prev).add(id));
      triggerHaptic();

      try {
        const result = await voteFeedback(id);
        setFeedbacks(prev =>
          prev.map(f =>
            f.id === id
              ? { ...f, votes: result.votes, hasVoted: result.hasVoted }
              : f
          )
        );
      } catch (error) {
        showToast({
          type: 'error',
          title: error instanceof Error ? error.message : '投票失败',
        });
      } finally {
        setVotingIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [votingIds, triggerHaptic]
  );

  // 格式化时间
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return '今天';
    if (days === 1) return '昨天';
    if (days < 7) return `${days}天前`;
    if (days < 30) return `${Math.floor(days / 7)}周前`;
    return `${Math.floor(days / 30)}月前`;
  };

  // 筛选后的反馈列表
  const filteredFeedbacks = feedbacks.filter(f => {
    if (activeFilter === 'all') return true;
    return f.status === activeFilter;
  });

  // 筛选选项配置
  const filterOptions: { key: FeedbackStatus | 'all'; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'pending', label: '审核中' },
    { key: 'pinned', label: '置顶' },
    { key: 'open', label: '待处理' },
    { key: 'accepted', label: '已采纳' },
    { key: 'done', label: '已完成' },
    { key: 'rejected', label: '未采纳' },
  ];

  // 获取各状态的数量
  const getStatusCount = (status: FeedbackStatus | 'all') => {
    if (status === 'all') return feedbacks.length;
    return feedbacks.filter(f => f.status === status).length;
  };

  return (
    <ActionDrawer isOpen={isOpen} onClose={onClose} historyId="feedback-drawer">
      <ActionDrawer.Switcher activeKey={currentStep}>
        {currentStep === 'list' ? (
          <div>
            {/* 标题 */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 select-none">
                <h3 className="text-base font-medium text-neutral-800 dark:text-neutral-200">
                  想法收集站
                </h3>
                {isAdminMode && (
                  <span
                    className="flex items-center gap-1 rounded-full bg-neutral-900 px-2 py-0.5 text-xs text-white dark:bg-white dark:text-neutral-900"
                    title="长按提交按钮可退出管理员模式"
                  >
                    <Shield className="h-3 w-3" />
                    管理
                  </span>
                )}
              </div>
            </div>

            {/* 分类筛选栏 */}
            <div className="-mx-4 mb-3 overflow-x-auto px-4">
              <div className="flex gap-2">
                {filterOptions.map(option => {
                  const count = getStatusCount(option.key);
                  const isActive = activeFilter === option.key;
                  // 如果数量为 0 且不是"全部"，则不显示
                  if (count === 0 && option.key !== 'all') return null;
                  return (
                    <button
                      key={option.key}
                      onClick={() => {
                        setActiveFilter(option.key);
                        triggerHaptic();
                      }}
                      className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-white'
                          : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500'
                      }`}
                    >
                      {option.key !== 'all' && (
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT_COLORS[option.key]}`}
                        />
                      )}
                      {option.label}
                      <span
                        className={`${isActive ? 'text-neutral-500 dark:text-neutral-400' : 'text-neutral-300 dark:text-neutral-600'}`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 列表内容 */}
            <div className="relative">
              {/* 顶部渐变阴影 */}
              <div
                className={`pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-linear-to-b from-white to-transparent transition-opacity duration-200 dark:from-neutral-900 ${showTopShadow ? 'opacity-100' : 'opacity-0'}`}
              />
              <div
                ref={listRef}
                onScroll={handleListScroll}
                className="max-h-[50vh] space-y-3 overflow-y-auto"
              >
                {isLoading ? (
                  <div className="space-y-3">
                    {/* 骨架屏 - 模拟3个反馈卡片 */}
                    {[1, 2, 3, 4].map(i => (
                      <div
                        key={i}
                        className="animate-pulse rounded-xl bg-neutral-100 p-3 dark:bg-neutral-800"
                      >
                        {/* 内容骨架 */}
                        <div className="mb-2 space-y-2">
                          <div className="h-3.5 w-full rounded bg-neutral-200 dark:bg-neutral-700" />
                          <div className="h-3.5 w-4/5 rounded bg-neutral-200 dark:bg-neutral-700" />
                        </div>
                        {/* 底部信息骨架 */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <div className="h-1.5 w-1.5 rounded-full bg-neutral-200 dark:bg-neutral-700" />
                            <div className="h-3 w-16 rounded bg-neutral-200 dark:bg-neutral-700" />
                          </div>
                          <div className="h-6 w-12 rounded-full bg-neutral-200 dark:bg-neutral-700" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredFeedbacks.length === 0 ? (
                  <div className="py-12 text-center text-sm text-neutral-400">
                    <MessageCircle className="mx-auto mb-2 h-8 w-8 opacity-50" />
                    <p>
                      {activeFilter === 'all'
                        ? '还没有想法，来说说你的吧～'
                        : `暂无${STATUS_LABELS[activeFilter]}的想法`}
                    </p>
                  </div>
                ) : (
                  filteredFeedbacks.map(feedback => (
                    <div
                      key={feedback.id}
                      className="rounded-xl bg-neutral-100 p-3 dark:bg-neutral-800"
                    >
                      {/* 内容 */}
                      <p className="mb-2 text-sm leading-relaxed whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">
                        {decodeHtml(feedback.content)}
                      </p>

                      {/* 开发者回复 */}
                      {feedback.reply && (
                        <div className="mb-2 rounded-lg bg-neutral-200/60 p-2 dark:bg-neutral-700">
                          <p className="text-xs text-neutral-600 dark:text-neutral-300">
                            <span className="font-medium text-neutral-500 dark:text-neutral-400">
                              开发者：
                            </span>
                            {decodeHtml(feedback.reply)}
                          </p>
                        </div>
                      )}

                      {/* 底部信息 */}
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() =>
                            isAdminMode && handleFeedbackClick(feedback)
                          }
                          disabled={!isAdminMode}
                          className={`flex items-center gap-1.5 text-xs text-neutral-400 ${
                            isAdminMode
                              ? 'cursor-pointer hover:text-neutral-600 dark:hover:text-neutral-300'
                              : 'cursor-default'
                          }`}
                        >
                          {/* 状态圆点 */}
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_COLORS[feedback.status]}`}
                          />
                          <span>{STATUS_LABELS[feedback.status]}</span>
                          <span>·</span>
                          {/* 时间 */}
                          <span>{formatTime(feedback.createdAt)}</span>
                          {/* 自己提交的标记 */}
                          {feedback.isOwner && (
                            <>
                              <span>·</span>
                              <span>我的</span>
                            </>
                          )}
                          {isAdminMode && (
                            <>
                              <span>·</span>
                              <span className="text-neutral-500">管理</span>
                            </>
                          )}
                        </button>

                        {/* 点赞按钮 */}
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            handleVote(feedback.id);
                          }}
                          disabled={votingIds.has(feedback.id)}
                          className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs transition-all ${
                            feedback.hasVoted
                              ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                              : 'bg-neutral-200 text-neutral-600 hover:bg-neutral-300 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600'
                          } ${votingIds.has(feedback.id) ? 'opacity-50' : 'active:scale-95'}`}
                        >
                          <ThumbsUp
                            className={`h-3 w-3 ${feedback.hasVoted ? 'fill-current' : ''}`}
                          />
                          <span>{feedback.votes}</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {/* 底部渐变阴影 */}
              <div
                className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 h-6 bg-linear-to-t from-white to-transparent transition-opacity duration-200 dark:from-neutral-900 ${showBottomShadow ? 'opacity-100' : 'opacity-0'}`}
              />
            </div>

            {/* 底部输入框 */}
            <div className="relative mt-4">
              <div className="relative flex items-end gap-2 rounded-[22px] bg-neutral-100 p-1.5 transition-colors focus-within:ring-2 focus-within:ring-neutral-200 dark:bg-neutral-800 dark:focus-within:ring-neutral-700">
                <textarea
                  ref={textareaRef}
                  value={inputContent}
                  onChange={e => {
                    setInputContent(e.target.value);
                    adjustHeight();
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder="说说你的想法..."
                  rows={1}
                  maxLength={200}
                  className="max-h-32 min-h-8 w-full resize-none bg-transparent px-3 py-1.5 text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none dark:text-neutral-200"
                  style={{ height: '32px' }}
                />
                <button
                  onClick={() => {
                    if (
                      !inputContent.trim() ||
                      inputContent.trim().length < 5 ||
                      isSubmitting
                    ) {
                      return;
                    }
                    handleSubmit();
                  }}
                  onPointerDown={handleLongPressStart}
                  onPointerUp={handleLongPressEnd}
                  onPointerLeave={handleLongPressEnd}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white transition-all select-none hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200 ${
                    !inputContent.trim() ||
                    inputContent.trim().length < 5 ||
                    isSubmitting
                      ? 'cursor-not-allowed opacity-50'
                      : ''
                  }`}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowUp className="h-4 w-4" strokeWidth={3} />
                  )}
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between px-2 select-none">
                <p className="text-[10px] text-neutral-400">
                  审核通过后展示 · 开发者会认真阅读每一条
                </p>
                <p
                  className={`text-[10px] transition-colors ${
                    inputContent.length >= 200
                      ? 'text-red-500'
                      : 'text-neutral-400'
                  }`}
                >
                  {inputContent.length}/200
                </p>
              </div>
            </div>
          </div>
        ) : currentStep === 'admin-login' ? (
          <div>
            {/* 标题 */}
            <div className="mb-4 flex items-center gap-2">
              <Shield className="h-5 w-5 text-neutral-800 dark:text-neutral-200" />
              <h3 className="text-base font-medium text-neutral-800 dark:text-neutral-200">
                管理员登录
              </h3>
            </div>

            {/* 密钥输入 */}
            <input
              type="password"
              placeholder="请输入管理员密钥"
              value={adminKeyInput}
              onChange={e => setAdminKeyInput(e.target.value.trim())}
              className="mb-4 w-full rounded-lg bg-neutral-100 px-3 py-3 text-sm text-neutral-800 placeholder-neutral-400 focus:ring-2 focus:ring-neutral-900 focus:outline-none dark:bg-neutral-800 dark:text-neutral-200 dark:focus:ring-white"
              autoFocus
            />

            {/* 操作按钮 */}
            <ActionDrawer.Actions>
              <ActionDrawer.SecondaryButton
                onClick={() => setCurrentStep('list')}
              >
                取消
              </ActionDrawer.SecondaryButton>
              <ActionDrawer.PrimaryButton
                onClick={handleAdminLogin}
                disabled={isSubmitting || !adminKeyInput.trim()}
              >
                {isSubmitting ? '验证中...' : '登录'}
              </ActionDrawer.PrimaryButton>
            </ActionDrawer.Actions>
          </div>
        ) : currentStep === 'admin-action' && selectedFeedback ? (
          <div>
            {/* 标题 */}
            <div className="mb-4 flex items-center gap-2">
              <Shield className="h-5 w-5 text-neutral-800 dark:text-neutral-200" />
              <h3 className="text-base font-medium text-neutral-800 dark:text-neutral-200">
                管理反馈
              </h3>
            </div>

            {/* 反馈内容预览 */}
            <div className="mb-4 rounded-lg bg-neutral-100 p-3 dark:bg-neutral-800">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {decodeHtml(selectedFeedback?.content || '')}
              </p>
              <div className="mt-2 flex items-center gap-2 text-xs text-neutral-400">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${selectedFeedback ? STATUS_DOT_COLORS[selectedFeedback.status] : ''}`}
                />
                <span>
                  {selectedFeedback
                    ? STATUS_LABELS[selectedFeedback.status]
                    : ''}
                </span>
                <span>·</span>
                <span>{selectedFeedback?.votes} 票</span>
              </div>
            </div>
            {/* 状态按钮 */}
            <div className="mb-4">
              <p className="mb-2 text-xs font-medium text-neutral-500">
                更改状态
              </p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    'pending',
                    'open',
                    'accepted',
                    'rejected',
                    'done',
                    'pinned',
                  ] as FeedbackStatus[]
                ).map(status => (
                  <button
                    key={status}
                    onClick={() => handleUpdateStatus(status)}
                    disabled={
                      isAdminLoading || selectedFeedback?.status === status
                    }
                    className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      selectedFeedback?.status === status
                        ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT_COLORS[status]}`}
                    />
                    {STATUS_LABELS[status]}
                  </button>
                ))}
              </div>
            </div>

            {/* 回复输入 */}
            <div className="mb-4">
              <p className="mb-2 text-xs font-medium text-neutral-500">
                开发者回复
              </p>
              <textarea
                placeholder="添加或修改回复内容..."
                value={adminReply}
                onChange={e => setAdminReply(e.target.value)}
                rows={2}
                className="w-full resize-none rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-800 placeholder-neutral-400 focus:ring-2 focus:ring-neutral-900 focus:outline-none dark:bg-neutral-800 dark:text-neutral-200 dark:focus:ring-white"
              />
              <button
                onClick={() =>
                  selectedFeedback &&
                  handleUpdateStatus(selectedFeedback.status)
                }
                disabled={isAdminLoading || !adminReply.trim()}
                className="mt-2 rounded-full bg-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-300 disabled:opacity-50 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600"
              >
                保存回复
              </button>
            </div>

            {/* 操作按钮 */}
            <ActionDrawer.Actions>
              <ActionDrawer.SecondaryButton
                onClick={() => {
                  setSelectedFeedback(null);
                  setAdminReply('');
                  setCurrentStep('list');
                }}
              >
                返回
              </ActionDrawer.SecondaryButton>
              <button
                onClick={handleDelete}
                disabled={isAdminLoading}
                className="flex items-center gap-1 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                删除
              </button>
            </ActionDrawer.Actions>
          </div>
        ) : null}
      </ActionDrawer.Switcher>
    </ActionDrawer>
  );
};

export default FeedbackDrawer;
