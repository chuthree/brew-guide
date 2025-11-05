'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { BrewingNote } from '@/lib/core/config';
import { CoffeeBean } from '@/types/app';
import { formatDate, formatRating } from '@/components/notes/utils';
import ActionMenu from '@/components/coffee-bean/ui/action-menu';
import { useFlavorDimensions } from '@/lib/hooks/useFlavorDimensions';
import { getChildPageStyle } from '@/lib/navigation/pageTransition';
import { ChevronLeft } from 'lucide-react';

// 动态导入 ImageViewer 组件
const ImageViewer = dynamic(
  () => import('@/components/common/ui/ImageViewer'),
  {
    ssr: false,
  }
);

interface NoteDetailModalProps {
  isOpen: boolean;
  note: BrewingNote | null;
  onClose: () => void;
  equipmentName?: string;
  beanUnitPrice?: number;
  beanInfo?: CoffeeBean | null; // 完整的咖啡豆信息（包括图片）
  onEdit?: (note: BrewingNote) => void;
  onDelete?: (noteId: string) => void;
  onCopy?: (noteId: string) => void;
  onShare?: (noteId: string) => void;
}

const NoteDetailModal: React.FC<NoteDetailModalProps> = ({
  isOpen,
  note,
  onClose,
  equipmentName = '未知器具',
  beanUnitPrice = 0,
  beanInfo = null,
  onEdit,
  onDelete,
  onCopy,
  onShare,
}) => {
  const [imageError, setImageError] = useState(false);
  const [beanImageError, setBeanImageError] = useState(false); // 咖啡豆图片加载错误状态
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState(''); // 当前要查看的图片URL

  // 控制滑入动画
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // 标题可见性状态
  const [isTitleVisible, setIsTitleVisible] = useState(true);

  // 使用风味维度hook
  const { getValidTasteRatings } = useFlavorDimensions();

  // 处理显示/隐藏动画
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // 重置图片错误状态
  useEffect(() => {
    if (note?.image) {
      setImageError(false);
    }
    if (beanInfo?.image) {
      setBeanImageError(false);
    }
  }, [note?.image, beanInfo?.image]);

  // 监测标题可见性
  useEffect(() => {
    if (!isOpen || !isVisible) {
      setIsTitleVisible(true);
      return;
    }

    let observer: IntersectionObserver | null = null;

    const timer = setTimeout(() => {
      const titleElement = document.getElementById('note-detail-title');
      if (!titleElement) {
        return;
      }

      const rect = titleElement.getBoundingClientRect();
      const isVisible = rect.top >= 60;
      setIsTitleVisible(isVisible);

      observer = new IntersectionObserver(
        ([entry]) => {
          setIsTitleVisible(entry.isIntersecting);
        },
        {
          threshold: 0,
          rootMargin: '-60px 0px 0px 0px',
        }
      );

      observer.observe(titleElement);
    }, 100);

    return () => {
      clearTimeout(timer);
      if (observer) {
        observer.disconnect();
      }
    };
  }, [isOpen, isVisible]);

  // 历史栈管理
  useEffect(() => {
    if (!isOpen) return;

    window.history.pushState({ modal: 'note-detail' }, '');

    const handlePopState = () => {
      onClose();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isOpen, onClose]);

  // 处理关闭
  const handleClose = () => {
    setIsVisible(false); // 触发退出动画
    window.dispatchEvent(new CustomEvent('noteDetailClosing')); // 通知父组件

    setTimeout(() => {
      if (window.history.state?.modal === 'note-detail') {
        window.history.back();
      } else {
        onClose();
      }
    }, 350); // 等待动画完成
  };

  // 只在需要时渲染DOM
  if (!shouldRender) return null;

  const beanName = note?.coffeeBeanInfo?.name;
  const validTasteRatings = note ? getValidTasteRatings(note.taste) : [];
  const hasTasteRatings = validTasteRatings.length > 0;

  // 构建标题文本 - 只显示咖啡豆名称
  const getTitleText = () => {
    if (!note) return '未命名';
    return beanName || '未命名';
  };

  return (
    <>
      <div
        className="fixed inset-0 mx-auto flex max-w-[500px] flex-col overflow-hidden bg-neutral-50 dark:bg-neutral-900"
        style={getChildPageStyle(isVisible)}
      >
        {/* 顶部按钮栏 */}
        <div className="pt-safe-top sticky top-0 flex items-center gap-3 bg-neutral-50 p-4 dark:bg-neutral-900">
          {/* 左侧关闭按钮 */}
          <button
            onClick={handleClose}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-neutral-100 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
          >
            <ChevronLeft className="-ml-px h-4.5 w-4.5 text-neutral-600 dark:text-neutral-400" />
          </button>

          {/* 居中标题 - 当原标题不可见时显示 */}
          <div
            className={`flex min-w-0 flex-1 justify-center transition-all duration-300 ${
              isTitleVisible
                ? 'pointer-events-none opacity-0 blur-xs'
                : 'blur-0 opacity-100'
            }`}
            style={{
              transitionProperty: 'opacity, filter, transform',
              transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)',
              willChange: 'opacity, filter, transform',
            }}
          >
            <h2 className="max-w-full truncate px-2 text-center text-sm font-medium text-neutral-800 dark:text-neutral-100">
              {getTitleText()}
            </h2>
          </div>

          {/* 右侧操作按钮 */}
          {note && (onEdit || onDelete || onCopy || onShare) && (
            <div className="flex flex-shrink-0 items-center gap-3">
              <ActionMenu
                items={[
                  ...(onDelete
                    ? [
                        {
                          id: 'delete',
                          label: '删除',
                          onClick: () => {
                            // 添加确认对话框
                            let noteName = '此笔记';
                            if (note.source === 'quick-decrement') {
                              noteName = `${note.coffeeBeanInfo?.name || '未知咖啡豆'}的快捷扣除记录`;
                            } else if (note.source === 'capacity-adjustment') {
                              noteName = `${note.coffeeBeanInfo?.name || '未知咖啡豆'}的容量调整记录`;
                            } else {
                              noteName = note.method || '此笔记';
                            }

                            if (window.confirm(`确认要删除"${noteName}"吗？`)) {
                              onDelete(note.id);
                              onClose();
                            }
                          },
                          color: 'danger' as const,
                        },
                      ]
                    : []),
                  ...(onShare
                    ? [
                        {
                          id: 'share',
                          label: '分享',
                          onClick: () => {
                            onShare(note.id);
                            onClose();
                          },
                          color: 'default' as const,
                        },
                      ]
                    : []),
                  ...(onCopy
                    ? [
                        {
                          id: 'copy',
                          label: '复制',
                          onClick: () => {
                            onCopy(note.id);
                            onClose();
                          },
                          color: 'default' as const,
                        },
                      ]
                    : []),
                  ...(onEdit
                    ? [
                        {
                          id: 'edit',
                          label: '编辑',
                          onClick: () => {
                            onEdit(note);
                            onClose();
                          },
                          color: 'default' as const,
                        },
                      ]
                    : []),
                ].filter(item => item)}
                useMorphingAnimation={true}
                triggerClassName="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
              />
            </div>
          )}
        </div>

        {/* 内容区域 */}
        <div
          className="pb-safe-bottom flex-1 overflow-auto"
          style={{
            overflowY: 'auto',
            touchAction: 'pan-y pinch-zoom',
          }}
        >
          {/* 图片区域 */}
          {(note?.image || beanInfo?.image) && (
            <div className="mb-4">
              <div className="flex cursor-pointer items-end justify-center gap-3 bg-neutral-200/30 px-6 py-3 dark:bg-neutral-800/40">
                {/* 咖啡豆图片 - 当没有笔记图片时显示大图 */}
                {beanInfo?.image && !note?.image && (
                  <div className="relative h-32 overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                    {beanImageError ? (
                      <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-500 dark:text-neutral-400">
                        加载失败
                      </div>
                    ) : (
                      <Image
                        src={beanInfo.image}
                        alt={beanName || '咖啡豆图片'}
                        height={192}
                        width={192}
                        className="h-full w-auto object-cover"
                        onError={() => setBeanImageError(true)}
                        onClick={() => {
                          if (!beanImageError) {
                            setCurrentImageUrl(beanInfo.image || '');
                            setImageViewerOpen(true);
                          }
                        }}
                      />
                    )}
                  </div>
                )}

                {/* 有笔记图片时的布局 */}
                {note?.image && (
                  <>
                    {/* 咖啡豆图片 - 小图 */}
                    {beanInfo?.image && (
                      <div className="relative h-20 flex-shrink-0 overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                        {beanImageError ? (
                          <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-500 dark:text-neutral-400">
                            加载失败
                          </div>
                        ) : (
                          <Image
                            src={beanInfo.image}
                            alt={beanName || '咖啡豆图片'}
                            height={80}
                            width={80}
                            className="h-full w-auto object-cover"
                            onError={() => setBeanImageError(true)}
                            onClick={e => {
                              e.stopPropagation();
                              if (!beanImageError) {
                                setCurrentImageUrl(beanInfo.image || '');
                                setImageViewerOpen(true);
                              }
                            }}
                          />
                        )}
                      </div>
                    )}

                    {/* 笔记图片 */}
                    <div className="relative h-32 overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                      {imageError ? (
                        <div className="absolute inset-0 flex items-center justify-center px-8 text-sm text-neutral-500 dark:text-neutral-400">
                          加载失败
                        </div>
                      ) : (
                        <Image
                          src={note.image}
                          alt={beanName || '笔记图片'}
                          height={192}
                          width={192}
                          className="h-full w-auto object-cover"
                          onError={() => setImageError(true)}
                          onClick={() => {
                            if (!imageError) {
                              setCurrentImageUrl(note.image || '');
                              setImageViewerOpen(true);
                            }
                          }}
                        />
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* 标题区域 */}
          <div className="mb-4 px-6">
            <h2
              id="note-detail-title"
              className="text-sm font-medium text-neutral-800 dark:text-neutral-100"
            >
              {getTitleText()}
            </h2>
          </div>

          {note ? (
            <div className="space-y-4 px-6">
              {/* 器具和方案信息 */}
              <div className="flex items-center gap-3">
                {/* 器具 */}
                <div className="flex flex-1 flex-col">
                  <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    器具
                  </div>
                  <div className="mt-1.5 text-xs font-medium text-neutral-800 dark:text-neutral-100">
                    {equipmentName}
                  </div>
                </div>

                <div className="h-10 w-px border-l border-dashed border-neutral-200 dark:border-neutral-800/70"></div>

                {/* 方案 */}
                <div className="flex flex-1 flex-col">
                  <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    方案
                  </div>
                  <div className="mt-1.5 text-xs font-medium text-neutral-800 dark:text-neutral-100">
                    {note.method || '-'}
                  </div>
                </div>
              </div>

              {/* 参数信息 - 一排四个 */}
              {note.params && (
                <div className="flex items-center gap-3 border-t border-dashed border-neutral-200 pt-4 dark:border-neutral-800">
                  {/* 粉量 */}
                  <div className="flex flex-1 flex-col">
                    <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      粉量
                    </div>
                    <div className="mt-1.5 text-xs font-medium text-neutral-800 dark:text-neutral-100">
                      {note.params.coffee}
                    </div>
                    {beanName && beanUnitPrice > 0 && (
                      <div className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-400">
                        {beanUnitPrice.toFixed(2)}元/克
                      </div>
                    )}
                  </div>

                  <div className="h-10 w-px border-l border-dashed border-neutral-200 dark:border-neutral-800/70"></div>

                  {/* 粉水比 */}
                  <div className="flex flex-1 flex-col">
                    <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      粉水比
                    </div>
                    <div className="mt-1.5 text-xs font-medium text-neutral-800 dark:text-neutral-100">
                      {note.params.ratio}
                    </div>
                  </div>

                  <div className="h-10 w-px border-l border-dashed border-neutral-200 dark:border-neutral-800/70"></div>

                  {/* 研磨度 */}
                  <div className="flex flex-1 flex-col">
                    <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      研磨度
                    </div>
                    <div className="mt-1.5 text-xs font-medium text-neutral-800 dark:text-neutral-100">
                      {note.params.grindSize || '-'}
                    </div>
                  </div>

                  <div className="h-10 w-px border-l border-dashed border-neutral-200 dark:border-neutral-800/70"></div>

                  {/* 水温 */}
                  <div className="flex flex-1 flex-col">
                    <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      水温
                    </div>
                    <div className="mt-1.5 text-xs font-medium text-neutral-800 dark:text-neutral-100">
                      {note.params.temp || '-'}
                    </div>
                  </div>
                </div>
              )}

              {/* 风味评分 - 一排四个 */}
              {hasTasteRatings && (
                <div className="border-t border-dashed border-neutral-200 pt-4 dark:border-neutral-800">
                  <div className="flex items-center gap-3">
                    {validTasteRatings.map((rating, index) => (
                      <React.Fragment key={rating.id}>
                        {index > 0 && (
                          <div className="h-10 w-px border-l border-dashed border-neutral-200 dark:border-neutral-800/70"></div>
                        )}
                        <div className="flex flex-1 flex-col">
                          <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                            {rating.label}
                          </div>
                          <div className="mt-1.5 text-xs font-medium text-neutral-800 dark:text-neutral-100">
                            {rating.value}
                          </div>
                        </div>
                      </React.Fragment>
                    ))}
                    {/* 补充空白占位以保持布局一致 */}
                    {validTasteRatings.length < 4 &&
                      Array.from({ length: 4 - validTasteRatings.length }).map(
                        (_, i) => (
                          <React.Fragment key={`empty-${i}`}>
                            <div className="h-10 w-px border-l border-dashed border-neutral-200 dark:border-neutral-800/70"></div>
                            <div className="flex-1"></div>
                          </React.Fragment>
                        )
                      )}
                  </div>
                </div>
              )}

              {/* 总体评分和时间 - 两格布局 */}
              <div className="border-t border-dashed border-neutral-200 pt-4 dark:border-neutral-800">
                <div className="flex items-center gap-3">
                  {/* 时间 */}
                  <div className="flex flex-1 flex-col">
                    <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      时间
                    </div>
                    <div className="mt-1.5 text-xs font-medium text-neutral-800 dark:text-neutral-100">
                      {formatDate(note.timestamp)}
                    </div>
                  </div>

                  {/* 总体评分 */}
                  {note.rating > 0 && (
                    <>
                      <div className="h-10 w-px border-l border-dashed border-neutral-200 dark:border-neutral-800/70"></div>
                      <div className="flex flex-1 flex-col">
                        <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                          总体评分
                        </div>
                        <div className="mt-1.5 text-xs font-medium text-neutral-800 dark:text-neutral-100">
                          {formatRating(note.rating)}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* 备注信息 */}
              {note.notes && note.notes.trim() && (
                <div className="border-t border-dashed border-neutral-200 pt-4 dark:border-neutral-800">
                  <div className="text-xs font-medium whitespace-pre-line text-neutral-800 dark:text-neutral-100">
                    {note.notes}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* 图片查看器 */}
      {currentImageUrl && imageViewerOpen && (
        <ImageViewer
          isOpen={imageViewerOpen}
          imageUrl={currentImageUrl}
          alt="图片"
          onClose={() => {
            setImageViewerOpen(false);
            setCurrentImageUrl('');
          }}
        />
      )}
    </>
  );
};

export default NoteDetailModal;
