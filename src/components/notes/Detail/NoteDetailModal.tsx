'use client';

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { BrewingNote } from '@/lib/core/config';
import { CoffeeBean } from '@/types/app';
import { formatDate } from '@/components/notes/utils';
import ActionMenu from '@/components/coffee-bean/ui/action-menu';
import { useFlavorDimensions } from '@/lib/hooks/useFlavorDimensions';
import { getChildPageStyle } from '@/lib/navigation/pageTransition';
import { ChevronLeft, Pen } from 'lucide-react';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';
import { useBrewingNoteStore } from '@/lib/stores/brewingNoteStore';

// 信息行组件
interface InfoRowProps {
  label: string;
  children: React.ReactNode;
}

const InfoRow: React.FC<InfoRowProps> = ({ label, children }) => (
  <div className="flex items-start">
    <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
      {label}
    </div>
    {children}
  </div>
);

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

  // 备注编辑状态
  const notesRef = useRef<HTMLDivElement>(null);

  // 使用评分维度hook
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

  // 初始化备注值
  useEffect(() => {
    if (note?.notes && notesRef.current) {
      notesRef.current.innerText = note.notes;
    }
  }, [note?.notes, note?.id]);

  // 保存备注的函数
  const handleSaveNotes = useCallback(
    async (newNotes: string) => {
      if (!note?.id) return;

      try {
        // 更新备注 - 保留换行符，不使用 trim()
        await useBrewingNoteStore.getState().updateNote(note.id, {
          notes: newNotes,
        });

        // 触发数据更新事件
        window.dispatchEvent(
          new CustomEvent('brewingNoteDataChanged', {
            detail: {
              action: 'update',
              noteId: note.id,
            },
          })
        );
      } catch (error) {
        console.error('保存备注失败:', error);
      }
    },
    [note?.id]
  );

  // 处理备注内容变化
  const handleNotesInput = useCallback(() => {
    if (notesRef.current) {
      const newContent = notesRef.current.innerText || '';
      handleSaveNotes(newContent);
    }
  }, [handleSaveNotes]);

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

  // 使用统一的历史栈管理
  useModalHistory({
    id: 'note-detail',
    isOpen,
    onClose: () => {
      // 先触发子页面的退出动画
      onClose();
      // 延迟通知父页面开始恢复动画，避免两个动画重叠造成闪烁
      // 在子页面动画进行到一半时通知，让动画更流畅衔接
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('noteDetailClosing'));
      }, 175); // 350ms 动画的一半
    },
  });

  // 处理关闭 - 使用统一的历史栈管理器
  const handleClose = useCallback(() => {
    // 动画由 isOpen 状态变化触发，无需手动设置 isVisible
    modalHistory.back();
  }, []);

  // 判断是否为意式咖啡笔记 - 必须在所有 hooks 调用后，在条件返回前
  const isEspresso = React.useMemo(() => {
    if (!note) return false;
    // 检查器具ID (兼容自定义意式器具ID格式，通常包含 espresso)
    if (
      note.equipment &&
      (note.equipment.toLowerCase().includes('espresso') ||
        note.equipment.includes('意式'))
    ) {
      return true;
    }
    return false;
  }, [note]);

  const beanName = note?.coffeeBeanInfo?.name;
  const validTasteRatings = useMemo(
    () => (note ? getValidTasteRatings(note.taste) : []),
    [note, getValidTasteRatings]
  );
  const hasTasteRatings = validTasteRatings.length > 0;

  // 构建标题文本 - 只显示咖啡豆名称（使用 useMemo 缓存）
  const titleText = useMemo(() => {
    if (!note) return '未命名';
    return beanName || '未命名';
  }, [note, beanName]);

  // 编辑按钮点击处理
  const handleEditClick = useCallback(() => {
    if (note && onEdit) {
      onEdit(note);
      // 不关闭详情页，让编辑表单叠加在上面
    }
  }, [note, onEdit]);

  // ActionMenu 菜单项（使用 useMemo 缓存）
  const actionMenuItems = useMemo(() => {
    if (!note) return [];

    const items = [];

    if (onDelete) {
      items.push({
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
      });
    }

    if (onShare) {
      items.push({
        id: 'share',
        label: '分享',
        onClick: () => {
          onShare(note.id);
          onClose();
        },
        color: 'default' as const,
      });
    }

    if (onCopy) {
      items.push({
        id: 'copy',
        label: '复制',
        onClick: () => {
          onCopy(note.id);
          onClose();
        },
        color: 'default' as const,
      });
    }

    if (onEdit) {
      items.push({
        id: 'edit',
        label: '编辑',
        onClick: () => {
          onEdit(note);
          // 不关闭详情页，让编辑表单叠加在上面
        },
        color: 'default' as const,
      });
    }

    return items;
  }, [note, onDelete, onShare, onCopy, onEdit, onClose]);

  // 只在需要时渲染DOM
  if (!shouldRender) return null;

  return (
    <>
      <div
        className="fixed inset-0 mx-auto flex flex-col overflow-hidden bg-neutral-50 dark:bg-neutral-900"
        style={getChildPageStyle(isVisible)}
      >
        {/* 顶部按钮栏 */}
        <div className="pt-safe-top sticky top-0 flex items-center gap-3 bg-neutral-50 p-4 dark:bg-neutral-900">
          {/* 左侧关闭按钮 */}
          <button
            onClick={handleClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
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
              {titleText}
            </h2>
          </div>

          {/* 右侧操作按钮 */}
          {note && (onEdit || onDelete || onCopy || onShare) && (
            <div className="flex shrink-0 items-center gap-3">
              {/* 编辑按钮 */}
              {onEdit && (
                <button
                  onClick={handleEditClick}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
                >
                  <Pen className="h-3.5 w-3.5 text-neutral-600 dark:text-neutral-400" />
                </button>
              )}

              {/* 更多操作菜单 */}
              {actionMenuItems.length > 0 && (
                <ActionMenu
                  items={actionMenuItems}
                  useMorphingAnimation={true}
                  triggerClassName="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                />
              )}
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
                      <div className="relative h-20 shrink-0 overflow-hidden bg-neutral-100 dark:bg-neutral-800">
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
              {titleText}
            </h2>
          </div>

          {note ? (
            <div className="space-y-3 px-6">
              {/* 咖啡豆信息 */}
              {beanInfo && (
                <>
                  {/* 产地、处理法、品种 */}
                  {[
                    {
                      label: '产地',
                      value: beanInfo.blendComponents?.[0]?.origin,
                    },
                    {
                      label: '处理法',
                      value: beanInfo.blendComponents?.[0]?.process,
                    },
                    {
                      label: '品种',
                      value: beanInfo.blendComponents?.[0]?.variety,
                    },
                  ].map(
                    ({ label, value }) =>
                      value && (
                        <InfoRow key={label} label={label}>
                          <div className="text-xs font-medium text-neutral-800 dark:text-neutral-100">
                            {value}
                          </div>
                        </InfoRow>
                      )
                  )}

                  {/* 风味 */}
                  {beanInfo.flavor && beanInfo.flavor.length > 0 && (
                    <InfoRow label="风味">
                      <div className="flex flex-wrap items-center gap-1">
                        {beanInfo.flavor.map(
                          (flavor: string, index: number) => (
                            <span
                              key={index}
                              className="bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-700 dark:bg-neutral-800/40 dark:text-neutral-300"
                            >
                              {flavor}
                            </span>
                          )
                        )}
                      </div>
                    </InfoRow>
                  )}

                  {/* 分割线 */}
                  <div className="border-t border-dashed border-neutral-200 dark:border-neutral-800"></div>
                </>
              )}

              {/* 方案 */}
              <InfoRow label="方案">
                <div className="space-x-1 text-xs font-medium text-neutral-800 dark:text-neutral-100">
                  <span>{equipmentName}</span>
                  <span className="text-neutral-400 dark:text-neutral-600">
                    ·
                  </span>
                  <span>{note.method || '未命名'}</span>
                </div>
              </InfoRow>

              {/* 参数信息 */}
              {note.params &&
                (() => {
                  // 意式参数：粉量 · 研磨度 · 时间 · 液重
                  // 手冲参数：粉量 · 粉水比 · 研磨度 · 水温
                  const params = isEspresso
                    ? [
                        note.params.coffee,
                        note.params.grindSize || '-',
                        note.totalTime ? `${note.totalTime}s` : '-',
                        note.params.water,
                      ]
                    : [
                        note.params.coffee,
                        note.params.ratio,
                        note.params.grindSize || '-',
                        note.params.temp || '-',
                      ];

                  return (
                    <InfoRow label="参数">
                      <div className="flex flex-col">
                        <div className="space-x-1 text-xs font-medium text-neutral-800 dark:text-neutral-100">
                          {params.map((param, index, arr) => (
                            <React.Fragment key={index}>
                              <span>{param}</span>
                              {index < arr.length - 1 && (
                                <span className="text-neutral-400 dark:text-neutral-600">
                                  ·
                                </span>
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                        {beanName && beanUnitPrice > 0 && (
                          <div className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-400">
                            {beanUnitPrice.toFixed(2)}元/克
                          </div>
                        )}
                      </div>
                    </InfoRow>
                  );
                })()}

              {/* 风味评分 */}
              {hasTasteRatings && (
                <InfoRow label="评分">
                  <div className="flex flex-wrap items-center gap-1">
                    {validTasteRatings.map(rating => (
                      <span
                        key={rating.id}
                        className="bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-700 dark:bg-neutral-800/40 dark:text-neutral-300"
                      >
                        {rating.label}
                        {rating.value}
                      </span>
                    ))}
                  </div>
                </InfoRow>
              )}

              {/* 总体评分 */}
              {note.rating > 0 && (
                <InfoRow label="总评">
                  <span className="bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-700 dark:bg-neutral-800/40 dark:text-neutral-300">
                    {note.rating}/5
                  </span>
                </InfoRow>
              )}

              {/* 时间 */}
              <InfoRow label="时间">
                <div className="text-xs font-medium text-neutral-800 dark:text-neutral-100">
                  {formatDate(note.timestamp)}
                </div>
              </InfoRow>

              {/* 笔记信息 */}
              {note.notes && (
                <InfoRow label="笔记">
                  <div
                    ref={notesRef}
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={handleNotesInput}
                    className="cursor-text text-xs font-medium whitespace-pre-wrap text-neutral-800 outline-none dark:text-neutral-100"
                    style={{
                      minHeight: '1.5em',
                      wordBreak: 'break-word',
                    }}
                  >
                    {note.notes}
                  </div>
                </InfoRow>
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
