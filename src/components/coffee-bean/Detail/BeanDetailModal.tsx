'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';

import { CoffeeBean } from '@/types/app';
import { BrewingNote } from '@/lib/core/config';
import { parseDateToTimestamp } from '@/lib/utils/dateUtils';
import { calculateFlavorInfo } from '@/lib/utils/flavorPeriodUtils';
import HighlightText from '@/components/common/ui/HighlightText';
import { getEquipmentName } from '@/components/notes/utils';
import { formatDate, formatRating } from '@/components/notes/utils';
import ActionMenu from '@/components/coffee-bean/ui/action-menu';
import { ArrowRight } from 'lucide-react';
import { BREWING_EVENTS } from '@/lib/brewing/constants';
import { useFlavorDimensions } from '@/lib/hooks/useFlavorDimensions';
import { useCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore';
import { getChildPageStyle } from '@/lib/navigation/pageTransition';

// 动态导入 ImageViewer 组件
const ImageViewer = dynamic(
  () => import('@/components/common/ui/ImageViewer'),
  {
    ssr: false,
  }
);

// 动态导入 BeanPrintModal 组件
const BeanPrintModal = dynamic(
  () => import('@/components/coffee-bean/Print/BeanPrintModal'),
  {
    ssr: false,
  }
);

// 动态导入 BeanShareModal 组件
const BeanShareModal = dynamic(
  () => import('@/components/coffee-bean/Share/BeanShareModal'),
  {
    ssr: false,
  }
);

// 信息项类型定义
interface InfoItem {
  key: string;
  label: string;
  value: string | React.ReactNode;
  type?: 'normal' | 'status';
  color?: string;
}

// 信息网格组件
const InfoGrid: React.FC<{
  items: InfoItem[];
  className?: string;
}> = ({ items, className = '' }) => {
  if (items.length === 0) return null;

  return (
    <div className={`space-y-3 ${className}`}>
      {items.map(item => (
        <div key={item.key} className="flex items-start">
          <div className="w-16 flex-shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {item.label}
          </div>
          <div
            className={`ml-4 text-xs font-medium ${
              item.type === 'status' && item.color
                ? item.color
                : 'text-neutral-800 dark:text-neutral-100'
            } ${item.key === 'roastDate' ? 'whitespace-pre-line' : ''}`}
          >
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
};

interface BeanDetailModalProps {
  isOpen: boolean;
  bean: CoffeeBean | null;
  onClose: () => void;
  searchQuery?: string;
  onEdit?: (bean: CoffeeBean) => void;
  onDelete?: (bean: CoffeeBean) => void;
  onShare?: (bean: CoffeeBean) => void;
  onRate?: (bean: CoffeeBean) => void;
  onRepurchase?: (bean: CoffeeBean) => void;
}

const BeanDetailModal: React.FC<BeanDetailModalProps> = ({
  isOpen,
  bean: propBean,
  onClose,
  searchQuery = '',
  onEdit,
  onDelete,
  onShare,
  onRate,
  onRepurchase,
}) => {
  // 使用 Zustand Store 获取实时更新的咖啡豆数据
  // 性能优化：只在当前咖啡豆的 ID 匹配时订阅，避免不必要的重新渲染
  const storeBean = useCoffeeBeanStore(state => {
    if (!propBean) return null;
    return state.beans.find(b => b.id === propBean.id) || null;
  });

  // 优先使用 Store 中的实时数据，如果 Store 中没有（初始加载时），则使用 props 传入的数据
  // 这样既能保证初始显示，又能实时响应数据变化
  const bean = storeBean || propBean;

  const [imageError, setImageError] = useState(false);
  const [relatedNotes, setRelatedNotes] = useState<BrewingNote[]>([]);
  const [equipmentNames, setEquipmentNames] = useState<Record<string, string>>(
    {}
  );
  // 图片查看器状态
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState('');
  const [noteImageErrors, setNoteImageErrors] = useState<
    Record<string, boolean>
  >({});

  // 控制滑入动画
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // 打印功能状态
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printEnabled, setPrintEnabled] = useState(false);

  // 分享状态
  const [shareModalOpen, setShareModalOpen] = useState(false);

  // 标题可见性状态
  const [isTitleVisible, setIsTitleVisible] = useState(true);

  // 评分显示设置
  const [showBeanRating, setShowBeanRating] = useState(false);
  // 详情页显示设置
  const [showBeanInfoDivider, setShowBeanInfoDivider] = useState(true);

  // 变动记录显示状态
  const [showChangeRecords, setShowChangeRecords] = useState(false);

  // 处理显示/隐藏动画
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      // 使用 requestAnimationFrame 确保 DOM 已渲染，比 setTimeout 更快更流畅
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    } else {
      setIsVisible(false);
      // 重置打印模态框状态，防止下次打开时直接显示打印界面
      setPrintModalOpen(false);
      // 等待动画完成后再移除DOM
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 350); // 与动画时长匹配
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // 当咖啡豆改变时，智能重置记录显示状态
  useEffect(() => {
    if (!bean?.id || !isOpen) return;

    // 计算普通冲煮记录和变动记录的数量
    const normalNotes = relatedNotes.filter(
      note => !isSimpleChangeRecord(note)
    );
    const changeRecords = relatedNotes.filter(note =>
      isSimpleChangeRecord(note)
    );

    // 如果有普通冲煮记录，默认显示冲煮记录
    // 如果只有变动记录，显示变动记录
    // 如果都没有，状态无所谓（因为整个区域不显示）
    if (normalNotes.length > 0) {
      setShowChangeRecords(false);
    } else if (changeRecords.length > 0) {
      setShowChangeRecords(true);
    }
  }, [bean?.id, relatedNotes, isOpen]);

  // 加载打印和显示设置
  useEffect(() => {
    const loadPrintSettings = async () => {
      try {
        const { Storage } = await import('@/lib/core/storage');
        const settingsStr = await Storage.get('brewGuideSettings');
        if (settingsStr) {
          const settings = JSON.parse(settingsStr);
          const printEnabledValue = settings.enableBeanPrint === true;
          const showRatingValue = settings.showBeanRating === true;
          const showInfoDividerValue = settings.showBeanInfoDivider !== false; // 默认true
          setPrintEnabled(printEnabledValue);
          setShowBeanRating(showRatingValue);
          setShowBeanInfoDivider(showInfoDividerValue);
        } else {
          setPrintEnabled(false);
          setShowBeanRating(false);
          setShowBeanInfoDivider(true); // 默认显示
        }
      } catch (error) {
        console.error('加载打印设置失败:', error);
        setPrintEnabled(false);
        setShowBeanRating(false);
        setShowBeanInfoDivider(true); // 默认显示
      }
    };

    loadPrintSettings();
  }, [isOpen]);

  // 使用风味维度hook
  const { getValidTasteRatings } = useFlavorDimensions();

  // 监测标题可见性
  useEffect(() => {
    if (!isOpen || !isVisible) {
      // 重置状态
      setIsTitleVisible(true);
      return;
    }

    let observer: IntersectionObserver | null = null;

    // 延迟一下，确保 DOM 已经渲染
    const timer = setTimeout(() => {
      const titleElement = document.getElementById('bean-detail-title');
      if (!titleElement) {
        return;
      }

      // 立即检查一次初始状态，避免闪烁
      const rect = titleElement.getBoundingClientRect();
      const isVisible = rect.top >= 60; // 顶部栏高度
      setIsTitleVisible(isVisible);

      observer = new IntersectionObserver(
        ([entry]) => {
          setIsTitleVisible(entry.isIntersecting);
        },
        {
          threshold: 0,
          rootMargin: '-60px 0px 0px 0px', // 考虑顶部栏的高度
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

  // 历史栈管理 - 支持硬件返回键和浏览器返回按钮
  useEffect(() => {
    if (!isOpen) return;

    // 添加模态框历史记录
    window.history.pushState({ modal: 'bean-detail' }, '');

    // 监听返回事件
    const handlePopState = () => {
      // 如果分享模态框打开，先关闭分享模态框
      if (shareModalOpen) {
        setShareModalOpen(false);
      } else {
        // 否则关闭详情模态框
        onClose();
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isOpen, shareModalOpen, onClose]);

  // 重置图片错误状态
  useEffect(() => {
    if (bean?.image) {
      setImageError(false);
    }
  }, [bean?.image]);

  // 工具函数：格式化数字显示
  const formatNumber = (value: string | undefined): string =>
    !value
      ? '0'
      : Number.isInteger(parseFloat(value))
        ? Math.floor(parseFloat(value)).toString()
        : value;

  // 工具函数：格式化日期显示
  const formatDateString = (dateStr: string): string => {
    try {
      const timestamp = parseDateToTimestamp(dateStr);
      const date = new Date(timestamp);
      const formattedDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;

      // 计算已过天数
      const today = new Date();
      const todayDate = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      );
      const roastDateOnly = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
      );
      const daysSinceRoast = Math.ceil(
        (todayDate.getTime() - roastDateOnly.getTime()) / (1000 * 60 * 60 * 24)
      );

      // 如果是今天或未来日期，不显示天数
      if (daysSinceRoast <= 0) {
        return formattedDate;
      }

      return `${formattedDate} (已养豆 ${daysSinceRoast} 天)`;
    } catch {
      return dateStr;
    }
  };

  // 工具函数：计算赏味期信息
  const getFlavorInfo = () => {
    if (!bean) return { phase: '未知', status: '未知状态' };

    const flavorInfo = calculateFlavorInfo(bean);
    return {
      phase: flavorInfo.phase,
      status: flavorInfo.status || '未知状态',
    };
  };

  // 工具函数：生成基础信息项
  const getBasicInfoItems = (): InfoItem[] => {
    const items: InfoItem[] = [];
    const flavorInfo = getFlavorInfo();

    // 容量信息 - 显示为：剩余量/总容量
    if (bean?.capacity && bean?.remaining) {
      items.push({
        key: 'inventory',
        label: '容量',
        value: `${formatNumber(bean.remaining)} / ${formatNumber(bean.capacity)} 克`,
        type: 'normal',
      });
    }

    // 价格信息 - 显示为：总价(克价)
    if (bean?.price && bean?.capacity) {
      const totalPrice = bean.price;
      const capacityNum = parseFloat(bean.capacity);
      const priceNum = parseFloat(totalPrice);
      const pricePerGram =
        !isNaN(priceNum) && !isNaN(capacityNum) && capacityNum > 0
          ? (priceNum / capacityNum).toFixed(2)
          : '0.00';

      items.push({
        key: 'price',
        label: '价格',
        value: `${totalPrice} 元 (${pricePerGram} 元/克)`,
        type: 'normal',
      });
    }

    // 烘焙日期/状态
    if (bean?.isInTransit) {
      items.push({
        key: 'roastDate',
        label: '状态',
        value: '在途',
        type: 'normal',
      });
    } else if (bean?.roastDate) {
      items.push({
        key: 'roastDate',
        label: '烘焙日期',
        value: formatDateString(bean.roastDate),
        type: 'normal',
      });
    }

    // 赏味期/状态
    if (bean?.isFrozen) {
      items.push({
        key: 'flavor',
        label: '状态',
        value: '冷冻',
        type: 'normal',
      });
    } else if (bean?.roastDate && !bean?.isInTransit) {
      items.push({
        key: 'flavor',
        label: '赏味期',
        value: flavorInfo.status,
        type: 'normal',
      });
    }

    return items;
  };

  // 工具函数：创建信息项
  const createInfoItem = (
    key: string,
    label: string,
    blendField: 'origin' | 'process' | 'variety',
    enableHighlight = false
  ): InfoItem | null => {
    if (!bean?.blendComponents) return null;

    // 从所有组件中提取并去重字段值
    const values = Array.from(
      new Set(
        bean.blendComponents
          .map(comp => comp[blendField])
          .filter(
            (value): value is string =>
              typeof value === 'string' && value.trim() !== ''
          )
      )
    );

    if (values.length === 0) return null;

    const text = values.join(', ');
    return {
      key,
      label,
      value:
        enableHighlight && searchQuery ? (
          <HighlightText text={text} highlight={searchQuery} />
        ) : (
          text
        ),
    };
  };

  // 工具函数：生成产地信息项
  const getOriginInfoItems = (): InfoItem[] => {
    const items: InfoItem[] = [];

    // 使用 createInfoItem 函数，避免重复逻辑
    const originItem = createInfoItem('origin', '产地', 'origin', true);
    if (originItem) items.push(originItem);

    const processItem = createInfoItem('process', '处理法', 'process');
    if (processItem) items.push(processItem);

    const varietyItem = createInfoItem('variety', '品种', 'variety');
    if (varietyItem) items.push(varietyItem);

    // 烘焙度
    if (bean?.roastLevel) {
      items.push({
        key: 'roastLevel',
        label: '烘焙度',
        value: bean.roastLevel,
      });
    }

    return items;
  };

  // 判断是否为简单的变动记录（快捷扣除或容量调整）
  const isSimpleChangeRecord = (note: BrewingNote): boolean => {
    // 只依据 source 字段判断是否为变动记录
    // 不再限制备注内容，允许用户自由修改备注
    return (
      note.source === 'quick-decrement' || note.source === 'capacity-adjustment'
    );
  };

  // 获取相关的冲煮记录
  useEffect(() => {
    const loadRelatedNotes = async () => {
      if (!bean?.id || !isOpen) {
        setRelatedNotes([]);
        return;
      }

      try {
        const { Storage } = await import('@/lib/core/storage');
        const notesStr = await Storage.get('brewingNotes');
        if (!notesStr) {
          setRelatedNotes([]);
          return;
        }

        const allNotes: BrewingNote[] = JSON.parse(notesStr);

        // 过滤出与当前咖啡豆相关的记录
        // 优先使用 beanId 匹配，只有在笔记没有 beanId 时才使用名称匹配（向后兼容旧数据）
        const beanNotes = allNotes.filter(note => {
          // 如果笔记有 beanId，严格按 beanId 匹配
          if (note.beanId) {
            return note.beanId === bean.id;
          }
          // 如果笔记没有 beanId（旧数据），使用名称匹配
          return note.coffeeBeanInfo?.name === bean.name;
        });

        // 按时间倒序排列，显示所有记录
        const sortedNotes = beanNotes.sort((a, b) => b.timestamp - a.timestamp);

        // 获取所有设备的名称
        const equipmentIds = Array.from(
          new Set(
            sortedNotes
              .map(note => note.equipment)
              .filter((equipment): equipment is string => !!equipment)
          )
        );

        const namesMap: Record<string, string> = {};
        await Promise.all(
          equipmentIds.map(async equipmentId => {
            try {
              const name = await getEquipmentName(equipmentId);
              namesMap[equipmentId] = name;
            } catch (error) {
              console.error(`获取设备名称失败: ${equipmentId}`, error);
              namesMap[equipmentId] = equipmentId;
            }
          })
        );

        setEquipmentNames(namesMap);
        setRelatedNotes(sortedNotes);
      } catch (error) {
        console.error('加载冲煮记录失败:', error);
        setRelatedNotes([]);
      }
    };

    loadRelatedNotes();
  }, [bean?.id, bean?.name, isOpen]);

  // 处理关闭
  const handleClose = () => {
    setIsVisible(false); // 触发退出动画
    window.dispatchEvent(new CustomEvent('beanDetailClosing')); // 通知父组件

    setTimeout(() => {
      // 如果历史栈中有我们添加的条目，触发返回
      if (window.history.state?.modal === 'bean-detail') {
        window.history.back();
      } else {
        // 否则直接关闭
        onClose();
      }
    }, 350); // 等待动画完成
  };

  // 处理去冲煮功能
  const handleGoToBrewing = () => {
    handleClose();
    // 等待模态框关闭后再进行导航
    setTimeout(() => {
      // 先切换到冲煮标签页
      document.dispatchEvent(
        new CustomEvent(BREWING_EVENTS.NAVIGATE_TO_MAIN_TAB, {
          detail: { tab: '冲煮' },
        })
      );

      // 再切换到咖啡豆步骤
      setTimeout(() => {
        document.dispatchEvent(
          new CustomEvent(BREWING_EVENTS.NAVIGATE_TO_STEP, {
            detail: { step: 'coffeeBean' },
          })
        );

        // 然后选择当前豆子
        if (bean) {
          setTimeout(() => {
            document.dispatchEvent(
              new CustomEvent(BREWING_EVENTS.SELECT_COFFEE_BEAN, {
                detail: { beanName: bean.name },
              })
            );
          }, 100);
        }
      }, 100);
    }, 300);
  };

  // 处理去记录功能
  const handleGoToNotes = () => {
    handleClose();
    // 保存当前咖啡豆信息，以便笔记页面使用
    if (bean) {
      localStorage.setItem(
        'temp:selectedBean',
        JSON.stringify({
          id: bean.id,
          name: bean.name,
          roastLevel: bean.roastLevel || '',
          roastDate: bean.roastDate || '',
        })
      );
    }

    // 等待模态框关闭后再进行导航
    setTimeout(() => {
      // 先切换到笔记标签页
      document.dispatchEvent(
        new CustomEvent(BREWING_EVENTS.NAVIGATE_TO_MAIN_TAB, {
          detail: { tab: '笔记' },
        })
      );

      // 延迟一段时间后触发创建新笔记事件
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('addNewBrewingNote'));
      }, 300);
    }, 300);
  };

  // 处理打印功能
  const handlePrint = () => {
    setPrintModalOpen(true);
  };

  // 只在需要时渲染DOM
  if (!shouldRender) return null;

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
            <svg
              className="h-4 w-4 text-neutral-600 dark:text-neutral-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          {/* 居中标题 - 当原标题不可见时显示，占据剩余空间 */}
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
              {bean?.name || '未命名'}
            </h2>
          </div>

          {/* 右侧操作按钮 */}
          <div className="flex flex-shrink-0 items-center gap-3">
            {/* 前往按钮 */}
            {bean && (
              <ActionMenu
                items={[
                  {
                    id: 'brewing',
                    label: '去冲煮',
                    onClick: handleGoToBrewing,
                    color: 'default' as const,
                  },
                  {
                    id: 'notes',
                    label: '去记录',
                    onClick: handleGoToNotes,
                    color: 'default' as const,
                  },
                ]}
                useMorphingAnimation={true}
                triggerClassName="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                triggerChildren={
                  <ArrowRight className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
                }
              />
            )}

            {/* 原有的操作按钮 */}
            {bean && (onEdit || onShare || onDelete || printEnabled) && (
              <ActionMenu
                items={[
                  ...(onDelete
                    ? [
                        {
                          id: 'delete',
                          label: '删除',
                          onClick: () => {
                            onDelete(bean);
                            handleClose();
                          },
                          color: 'danger' as const,
                        },
                      ]
                    : []),
                  ...(printEnabled
                    ? [
                        {
                          id: 'print',
                          label: '打印',
                          onClick: handlePrint,
                          color: 'default' as const,
                        },
                      ]
                    : []),
                  // 统一分享按钮
                  ...(onShare
                    ? [
                        {
                          id: 'share',
                          label: '分享',
                          onClick: () => setShareModalOpen(true),
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
                            onEdit(bean);
                            onClose();
                          },
                          color: 'default' as const,
                        },
                      ]
                    : []),
                ].filter(item => item)} // 过滤空项
                useMorphingAnimation={true}
                triggerClassName="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
              />
            )}
          </div>
        </div>

        {/* 内容区域 */}
        <div
          className="pb-safe-bottom flex-1 overflow-auto"
          style={{
            // 正常情况下允许垂直滚动
            overflowY: 'auto',
            // 使用 CSS 来处理触摸行为
            touchAction: 'pan-y pinch-zoom',
          }}
        >
          {/* 图片区域 */}
          {bean?.image && (
            <div className="mb-4">
              <div className="flex cursor-pointer justify-center bg-neutral-200/30 p-4 dark:bg-neutral-800/40">
                <div className="relative h-32 overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                  {imageError ? (
                    <div className="absolute inset-0 flex items-center justify-center px-8 text-sm text-neutral-500 dark:text-neutral-400">
                      加载失败
                    </div>
                  ) : (
                    <Image
                      src={bean.image}
                      alt={bean.name || '咖啡豆图片'}
                      height={192}
                      width={192}
                      className="h-full w-auto object-cover"
                      onError={() => setImageError(true)}
                      onClick={() => {
                        if (!imageError) {
                          setCurrentImageUrl(bean.image || '');
                          setImageViewerOpen(true);
                        }
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 标题区域 */}
          <div className="mb-4 px-6">
            <h2
              id="bean-detail-title"
              className="text-sm font-medium text-neutral-800 dark:text-neutral-100"
            >
              {searchQuery ? (
                <HighlightText
                  text={bean?.name || '未命名'}
                  highlight={searchQuery}
                />
              ) : (
                bean?.name || '未命名'
              )}
            </h2>
          </div>

          {bean ? (
            <div className="space-y-3 px-6">
              {/* 咖啡豆信息 */}
              <div className="space-y-3">
                {/* 基础信息 */}
                <InfoGrid items={getBasicInfoItems()} />

                {/* 虚线分割线 - 只在有基础信息且有后续内容时显示 */}
                {(() => {
                  const basicItems = getBasicInfoItems();
                  const originItems = getOriginInfoItems();
                  const isMultipleBlend =
                    bean?.blendComponents && bean.blendComponents.length > 1;
                  const hasOriginInfo =
                    originItems.length > 0 && !isMultipleBlend;
                  const hasBlendInfo = isMultipleBlend;
                  const hasFlavor = bean.flavor && bean.flavor.length > 0;
                  const hasNotes = bean.notes && bean.notes.trim();

                  const hasBasicInfo = basicItems.length > 0;
                  const hasFollowingContent =
                    hasOriginInfo || hasBlendInfo || hasFlavor || hasNotes;

                  return (
                    showBeanInfoDivider &&
                    hasBasicInfo &&
                    hasFollowingContent && (
                      <div className="border-t border-dashed border-neutral-200/70 dark:border-neutral-800/70"></div>
                    )
                  );
                })()}

                {/* 产地信息（单品豆时显示）*/}
                {(() => {
                  const originItems = getOriginInfoItems();
                  const isMultipleBlend =
                    bean?.blendComponents && bean.blendComponents.length > 1;
                  return (
                    originItems.length > 0 &&
                    !isMultipleBlend && <InfoGrid items={originItems} />
                  );
                })()}

                {/* 拼配成分（拼配豆时显示）*/}
                {bean?.blendComponents && bean.blendComponents.length > 1 && (
                  <div className="flex items-start">
                    <div className="w-16 flex-shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      拼配成分
                    </div>
                    <div className="ml-4 space-y-2">
                      {bean.blendComponents.map(
                        (
                          comp: {
                            origin?: string;
                            variety?: string;
                            process?: string;
                            percentage?: number;
                          },
                          index: number
                        ) => {
                          const parts = [
                            comp.origin,
                            comp.variety,
                            comp.process,
                          ].filter(Boolean);
                          const displayText =
                            parts.length > 0
                              ? parts.join(' · ')
                              : `组成 ${index + 1}`;

                          return (
                            <div
                              key={index}
                              className="flex items-center gap-2"
                            >
                              <span className="text-xs font-medium text-neutral-800 dark:text-neutral-100">
                                {displayText}
                              </span>
                              {comp.percentage !== undefined &&
                                comp.percentage !== null && (
                                  <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                                    {comp.percentage}%
                                  </span>
                                )}
                            </div>
                          );
                        }
                      )}
                    </div>
                  </div>
                )}

                {/* 风味 */}
                {bean.flavor && bean.flavor.length > 0 && (
                  <div className="flex items-start">
                    <div className="w-16 flex-shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      风味
                    </div>
                    <div className="ml-4 flex flex-wrap gap-1">
                      {bean.flavor.map((flavor: string, index: number) => (
                        <span
                          key={index}
                          className="bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                        >
                          {flavor}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 备注 */}
                {bean.notes && (
                  <div className="flex items-start">
                    <div className="w-16 flex-shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      备注
                    </div>
                    <div className="ml-4 text-xs font-medium text-neutral-800 dark:text-neutral-100">
                      {searchQuery ? (
                        <HighlightText
                          text={bean.notes}
                          highlight={searchQuery}
                          className="text-neutral-700 dark:text-neutral-300"
                        />
                      ) : (
                        bean.notes
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 个人榜单评价区域 - 根据设置和内容决定是否显示 */}
              {(showBeanRating ||
                (bean.overallRating && bean.overallRating > 0)) && (
                <div className="border-t border-neutral-200/40 pt-3 dark:border-neutral-800/40">
                  {bean.overallRating && bean.overallRating > 0 ? (
                    // 已有评价，显示评价内容
                    <div
                      className="cursor-pointer space-y-3"
                      onClick={() => {
                        if (onRate && bean) {
                          onRate(bean);
                        }
                      }}
                    >
                      {/* 评分 */}
                      <div className="flex items-start">
                        <div className="w-16 flex-shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                          评分
                        </div>
                        <div className="ml-4 text-xs font-medium text-neutral-800 dark:text-neutral-100">
                          {bean.overallRating} / 5
                        </div>
                      </div>

                      {/* 评价备注 */}
                      {bean.ratingNotes && bean.ratingNotes.trim() && (
                        <div className="flex items-start">
                          <div className="w-16 flex-shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                            评价
                          </div>
                          <div className="ml-4 text-xs font-medium whitespace-pre-line text-neutral-800 dark:text-neutral-100">
                            {bean.ratingNotes}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    // 无评价，显示添加提示
                    <div className="flex items-start">
                      <div className="w-16 flex-shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                        评分
                      </div>
                      <button
                        onClick={() => {
                          if (onRate && bean) {
                            onRate(bean);
                          }
                        }}
                        className="ml-4 text-xs font-medium text-neutral-400 transition-colors hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-400"
                      >
                        + 添加评价
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 相关冲煮记录 - 简化布局 - 只在有记录时显示 */}
              {(() => {
                // 分类记录
                const normalNotes = relatedNotes.filter(
                  note => !isSimpleChangeRecord(note)
                );
                const changeRecords = relatedNotes.filter(note =>
                  isSimpleChangeRecord(note)
                );

                // 如果都没有记录，直接返回null，不显示这个区域
                if (normalNotes.length === 0 && changeRecords.length === 0) {
                  return null;
                }

                return (
                  <div className="border-t border-neutral-200/40 pt-3 dark:border-neutral-800/40">
                    {/* Tab切换按钮 - 只显示存在的类型 */}
                    <div className="flex items-center gap-2">
                      {normalNotes.length > 0 && (
                        <button
                          onClick={() => setShowChangeRecords(false)}
                          className={`text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300 ${
                            !showChangeRecords ? 'opacity-100' : 'opacity-50'
                          }`}
                        >
                          冲煮记录 ({normalNotes.length})
                        </button>
                      )}
                      {changeRecords.length > 0 && (
                        <button
                          onClick={() => setShowChangeRecords(true)}
                          className={`text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300 ${
                            showChangeRecords ? 'opacity-100' : 'opacity-50'
                          }`}
                        >
                          变动记录 ({changeRecords.length})
                        </button>
                      )}
                    </div>

                    {/* 记录列表 */}
                    <div className="mt-3 space-y-2">
                      {(showChangeRecords ? changeRecords : normalNotes).map(
                        note => {
                          const isChangeRecord = isSimpleChangeRecord(note);

                          return (
                            <div
                              key={note.id}
                              className="rounded bg-neutral-100 p-1.5 dark:bg-neutral-800"
                            >
                              {/* card wrapper */}
                              {isChangeRecord ? (
                                // 变动记录（快捷扣除和容量调整）
                                <div className="flex items-center gap-2 opacity-80">
                                  {/* 变动量标签 */}
                                  {(() => {
                                    let displayLabel = '0g';

                                    if (note.source === 'quick-decrement') {
                                      // 快捷扣除记录
                                      const amount =
                                        note.quickDecrementAmount || 0;
                                      displayLabel = `-${amount}g`;
                                    } else if (
                                      note.source === 'capacity-adjustment'
                                    ) {
                                      // 容量调整记录
                                      const capacityAdjustment =
                                        note.changeRecord?.capacityAdjustment;
                                      const changeAmount =
                                        capacityAdjustment?.changeAmount || 0;
                                      const changeType =
                                        capacityAdjustment?.changeType || 'set';

                                      if (changeType === 'increase') {
                                        displayLabel = `+${Math.abs(changeAmount)}g`;
                                      } else if (changeType === 'decrease') {
                                        displayLabel = `-${Math.abs(changeAmount)}g`;
                                      } else {
                                        displayLabel = `${capacityAdjustment?.newAmount || 0}g`;
                                      }
                                    }

                                    return (
                                      <div className="w-12 overflow-hidden rounded-xs bg-neutral-200/50 px-1 py-px text-center text-xs font-medium whitespace-nowrap text-neutral-600 dark:bg-neutral-700/50 dark:text-neutral-300">
                                        {displayLabel}
                                      </div>
                                    );
                                  })()}

                                  {/* 备注 - 弹性宽度，占用剩余空间 */}
                                  {note.notes && (
                                    <div
                                      className="min-w-0 flex-1 truncate text-xs text-neutral-600 dark:text-neutral-300"
                                      title={note.notes}
                                    >
                                      {note.notes}
                                    </div>
                                  )}

                                  {/* 日期 - 固定宽度 */}
                                  <div
                                    className="w-20 overflow-hidden text-right text-xs font-medium tracking-wide whitespace-nowrap text-neutral-600 dark:text-neutral-400"
                                    title={formatDate(note.timestamp)}
                                  >
                                    {formatDate(note.timestamp)}
                                  </div>
                                </div>
                              ) : (
                                // 普通冲煮记录
                                <div className="space-y-3">
                                  {/* 图片和标题参数区域 */}
                                  <div className="flex gap-4">
                                    {/* 笔记图片 - 只在有图片时显示 */}
                                    {note.image && (
                                      <div
                                        className="relative h-14 w-14 shrink-0 cursor-pointer overflow-hidden rounded border border-neutral-200/50 bg-neutral-100 dark:border-neutral-700/40 dark:bg-neutral-800/20"
                                        onClick={e => {
                                          e.stopPropagation();
                                          if (
                                            !noteImageErrors[note.id] &&
                                            note.image
                                          ) {
                                            setCurrentImageUrl(note.image);
                                            setImageViewerOpen(true);
                                          }
                                        }}
                                      >
                                        {noteImageErrors[note.id] ? (
                                          <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-500 dark:text-neutral-400">
                                            加载失败
                                          </div>
                                        ) : (
                                          <Image
                                            src={note.image}
                                            alt={bean?.name || '笔记图片'}
                                            height={48}
                                            width={48}
                                            unoptimized
                                            style={{
                                              width: '100%',
                                              height: '100%',
                                            }}
                                            className="object-cover"
                                            sizes="48px"
                                            priority={false}
                                            loading="lazy"
                                            onError={() =>
                                              setNoteImageErrors(prev => ({
                                                ...prev,
                                                [note.id]: true,
                                              }))
                                            }
                                          />
                                        )}
                                      </div>
                                    )}

                                    {/* 名称和标签区域 */}
                                    <div className="min-w-0 flex-1">
                                      <div className="space-y-1.5">
                                        {/* 标题行 - 复杂的显示逻辑 */}
                                        <div className="text-xs font-medium break-words text-neutral-800 dark:text-neutral-100">
                                          {note.method &&
                                          note.method.trim() !== '' ? (
                                            // 有方案时的显示逻辑
                                            bean?.name ? (
                                              <>
                                                {bean.name}
                                                <span className="mx-1">·</span>
                                                <span>{note.method}</span>
                                              </>
                                            ) : (
                                              <>
                                                {note.equipment
                                                  ? equipmentNames[
                                                      note.equipment
                                                    ] || note.equipment
                                                  : '未知器具'}
                                                <span className="mx-1">·</span>
                                                <span>{note.method}</span>
                                              </>
                                            )
                                          ) : // 没有方案时的显示逻辑
                                          bean?.name ? (
                                            bean.name ===
                                            (note.equipment
                                              ? equipmentNames[
                                                  note.equipment
                                                ] || note.equipment
                                              : '未知器具') ? (
                                              bean.name
                                            ) : (
                                              <>
                                                {bean.name}
                                                <span className="mx-1">·</span>
                                                <span>
                                                  {note.equipment
                                                    ? equipmentNames[
                                                        note.equipment
                                                      ] || note.equipment
                                                    : '未知器具'}
                                                </span>
                                              </>
                                            )
                                          ) : note.equipment ? (
                                            equipmentNames[note.equipment] ||
                                            note.equipment
                                          ) : (
                                            '未知器具'
                                          )}
                                        </div>

                                        {/* 参数信息 - 无论是否有方案都显示 */}
                                        {note.params && (
                                          <div className="mt-1.5 space-x-1 text-xs leading-relaxed font-medium tracking-wide text-neutral-600 dark:text-neutral-400">
                                            {bean?.name && (
                                              <>
                                                <span>
                                                  {note.equipment
                                                    ? equipmentNames[
                                                        note.equipment
                                                      ] || note.equipment
                                                    : '未知器具'}
                                                </span>
                                                <span>·</span>
                                              </>
                                            )}
                                            <span>{note.params.coffee}</span>
                                            <span>·</span>
                                            <span>{note.params.ratio}</span>
                                            {(note.params.grindSize ||
                                              note.params.temp) && (
                                              <>
                                                <span>·</span>
                                                <span>
                                                  {[
                                                    note.params.grindSize,
                                                    note.params.temp,
                                                  ]
                                                    .filter(Boolean)
                                                    .join(' · ')}
                                                </span>
                                              </>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* 风味评分 - 只有当存在有效评分(大于0)时才显示 */}
                                  {(() => {
                                    const validTasteRatings =
                                      getValidTasteRatings(note.taste);
                                    const hasTasteRatings =
                                      validTasteRatings.length > 0;

                                    return hasTasteRatings ? (
                                      <div className="grid grid-cols-2 gap-4">
                                        {validTasteRatings.map(rating => (
                                          <div
                                            key={rating.id}
                                            className="space-y-1"
                                          >
                                            <div className="flex items-center justify-between">
                                              <div className="text-xs font-medium tracking-wide text-neutral-600 dark:text-neutral-400">
                                                {rating.label}
                                              </div>
                                              <div className="text-xs font-medium tracking-wide text-neutral-600 dark:text-neutral-400">
                                                {rating.value}
                                              </div>
                                            </div>
                                            <div className="h-px w-full overflow-hidden bg-neutral-200/50 dark:bg-neutral-700/50">
                                              <div
                                                style={{
                                                  width: `${rating.value === 0 ? 0 : (rating.value / 5) * 100}%`,
                                                }}
                                                className="h-full bg-neutral-600 dark:bg-neutral-300"
                                              />
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : null;
                                  })()}

                                  {/* 时间和评分 */}
                                  <div className="flex items-baseline justify-between">
                                    <div className="text-xs font-medium tracking-wide text-neutral-600 dark:text-neutral-400">
                                      {formatDate(note.timestamp)}
                                    </div>
                                    {/* 只有当评分大于 0 时才显示评分 */}
                                    {note.rating > 0 && (
                                      <div className="text-xs font-medium tracking-wide text-neutral-600 dark:text-neutral-400">
                                        {formatRating(note.rating)}
                                      </div>
                                    )}
                                  </div>

                                  {/* 备注信息 */}
                                  {note.notes && note.notes.trim() && (
                                    <div className="rounded bg-neutral-200/50 p-1.5 text-xs leading-tight font-medium tracking-widest whitespace-pre-line text-neutral-800/70 dark:bg-neutral-700/50 dark:text-neutral-400/85">
                                      {note.notes}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        }
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : null}
        </div>
      </div>

      {/* 图片查看器 */}
      {currentImageUrl && imageViewerOpen && (
        <ImageViewer
          isOpen={imageViewerOpen}
          imageUrl={currentImageUrl}
          alt="笔记图片"
          onClose={() => {
            setImageViewerOpen(false);
            setCurrentImageUrl('');
          }}
        />
      )}

      {/* 打印模态框 */}
      {printEnabled && (
        <BeanPrintModal
          isOpen={printModalOpen}
          bean={bean}
          onClose={() => setPrintModalOpen(false)}
        />
      )}

      {/* 分享模态框 */}
      <BeanShareModal
        isOpen={shareModalOpen}
        bean={bean}
        onClose={() => setShareModalOpen(false)}
        onTextShare={bean => {
          if (onShare) {
            onShare(bean);
          }
        }}
      />
    </>
  );
};

export default BeanDetailModal;
