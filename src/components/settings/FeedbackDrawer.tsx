'use client';

import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  useLayoutEffect,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { ThumbsUp, MessageCircle, Loader2, Shield, Trash2 } from 'lucide-react';

// 反转义 HTML 实体（服务端存储时已转义）
const decodeHtmlEntities = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
};

// 可折叠内容组件
const CollapsibleContent: React.FC<{
  content: string;
  id: string;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
}> = ({ content, id, expandedIds, onToggle }) => {
  const contentRef = useRef<HTMLParagraphElement>(null);
  const [needsCollapse, setNeedsCollapse] = useState<boolean | null>(null);
  const isExpanded = expandedIds.has(id);

  // 解码内容
  const decodedContent = decodeHtmlEntities(content);

  // 使用 useLayoutEffect 在绘制前同步检测高度，避免闪烁
  useLayoutEffect(() => {
    if (contentRef.current) {
      // 检查是否超过 3 行（大约 60px）
      setNeedsCollapse(contentRef.current.scrollHeight > 60);
    }
  }, [decodedContent]);

  // 高度还没检测完成时，先显示固定高度避免闪烁
  const height =
    needsCollapse === null
      ? 60 // 初始状态用固定高度
      : isExpanded
        ? 'auto'
        : needsCollapse
          ? 60
          : 'auto';

  return (
    <div
      className={`relative mb-2 ${needsCollapse ? 'cursor-pointer' : ''}`}
      onClick={() => needsCollapse && onToggle(id)}
    >
      <div
        style={{
          height: typeof height === 'number' ? height : undefined,
          overflow: 'hidden',
        }}
        className={needsCollapse !== null ? undefined : 'overflow-hidden'}
      >
        {needsCollapse !== null ? (
          <motion.div
            initial={false}
            animate={{ height }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1.0] }}
            className="overflow-hidden"
          >
            <p
              ref={contentRef}
              className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300"
            >
              {decodedContent}
            </p>
          </motion.div>
        ) : (
          <p
            ref={contentRef}
            className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300"
          >
            {decodedContent}
          </p>
        )}
      </div>
      {/* 渐变阴影遮罩 */}
      <AnimatePresence>
        {needsCollapse && !isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-linear-to-t from-neutral-100 to-transparent dark:from-neutral-800"
          />
        )}
      </AnimatePresence>
    </div>
  );
};

interface FeedbackDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  hapticFeedback?: boolean;
}

// 步骤类型
type FeedbackStep = 'list' | 'submit' | 'admin-login' | 'admin-action';

// 管理员密钥存储（会话级别，关闭后清除）
let adminKeyCache: string | null = null;

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
    'all'
  );

  // 展开状态管理（记录哪些反馈内容是展开的）
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const handleToggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

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
        // 如果管理员 API 失败，退出管理员模式
        if (useAdminApi) {
          setIsAdminMode(false);
          adminKeyCache = null;
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
        // 已是管理员模式，退出
        setIsAdminMode(false);
        adminKeyCache = null;
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

  // 进入提交界面
  const handleGoToSubmit = useCallback(() => {
    setCurrentStep('submit');
    triggerHaptic();
    // 延迟聚焦输入框
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 300);
  }, [triggerHaptic]);

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
      setCurrentStep('list');
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
    { key: 'pinned', label: '置顶' },
    { key: 'done', label: '已完成' },
    { key: 'accepted', label: '已采纳' },
    { key: 'open', label: '待处理' },
    { key: 'rejected', label: '未采纳' },
    ...(isAdminMode ? [{ key: 'pending' as const, label: '审核中' }] : []),
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
              <div className="flex items-center gap-2">
                <h3 className="text-base font-medium text-neutral-800 dark:text-neutral-200">
                  想法收集站
                </h3>
                {isAdminMode && (
                  <span className="flex items-center gap-1 rounded-full bg-neutral-900 px-2 py-0.5 text-xs text-white dark:bg-white dark:text-neutral-900">
                    <Shield className="h-3 w-3" />
                    管理
                  </span>
                )}
              </div>
              <button
                onClick={handleGoToSubmit}
                onPointerDown={handleLongPressStart}
                onPointerUp={handleLongPressEnd}
                onPointerLeave={handleLongPressEnd}
                className="rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-600 transition-transform active:scale-95 dark:bg-neutral-800 dark:text-neutral-300"
              >
                提交想法
              </button>
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
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
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
                      onClick={() => handleFeedbackClick(feedback)}
                      className={`rounded-xl bg-neutral-100 p-3 dark:bg-neutral-800 ${isAdminMode ? 'cursor-pointer transition-colors active:bg-neutral-200 dark:active:bg-neutral-700' : ''}`}
                    >
                      {/* 内容 */}
                      <CollapsibleContent
                        content={feedback.content}
                        id={feedback.id}
                        expandedIds={expandedIds}
                        onToggle={handleToggleExpand}
                      />

                      {/* 开发者回复 */}
                      {feedback.reply && (
                        <div className="mb-2 rounded-lg bg-neutral-200/60 p-2 dark:bg-neutral-700">
                          <p className="text-xs text-neutral-600 dark:text-neutral-300">
                            <span className="font-medium text-neutral-500 dark:text-neutral-400">
                              开发者：
                            </span>
                            {decodeHtmlEntities(feedback.reply)}
                          </p>
                        </div>
                      )}

                      {/* 底部信息 */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs text-neutral-400">
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
                        </div>

                        {/* 点赞按钮 */}
                        <button
                          onClick={() => handleVote(feedback.id)}
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
          </div>
        ) : currentStep === 'submit' ? (
          <div>
            {/* 标题 */}
            <h3 className="mb-4 text-base font-medium text-neutral-800 dark:text-neutral-200">
              提交想法
            </h3>

            {/* 输入框 */}
            <textarea
              ref={textareaRef}
              value={inputContent}
              onChange={e => setInputContent(e.target.value)}
              placeholder="说说你的想法吧～"
              maxLength={200}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="mb-2 h-32 w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:placeholder:text-neutral-500 dark:focus:border-neutral-500"
            />

            {/* 字数统计 */}
            <p className="mb-4 text-right text-xs text-neutral-400">
              {inputContent.length}/200
            </p>

            {/* 提示 */}
            <p className="mb-4 text-xs text-neutral-400">
              审核通过后会展示出来，其他用户可以点赞支持。开发者会认真看每一条～
            </p>

            {/* 操作按钮 */}
            <ActionDrawer.Actions>
              <ActionDrawer.SecondaryButton onClick={goBackToList}>
                返回
              </ActionDrawer.SecondaryButton>
              <ActionDrawer.PrimaryButton
                onClick={handleSubmit}
                disabled={isSubmitting || inputContent.trim().length < 5}
              >
                {isSubmitting ? '提交中...' : '提交'}
              </ActionDrawer.PrimaryButton>
            </ActionDrawer.Actions>
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
                {decodeHtmlEntities(selectedFeedback?.content || '')}
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
