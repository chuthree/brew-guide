'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { APP_VERSION, sponsorsList } from '@/lib/core/config';
import { getVersionLabel } from '@/lib/core/buildInfo';
import { pinyin } from 'pinyin-pro';
import hapticsUtils from '@/lib/ui/haptics';
import { restoreDefaultThemeColor } from '@/lib/hooks/useThemeColor';
import {
  checkForUpdates,
  saveCheckTime,
  canAutoCheck,
  postponeUpdateCheck,
} from '@/lib/utils/versionCheck';
import { isNative } from '@/lib/app/capacitor';
import UpdateDrawer from './UpdateDrawer';
import FeedbackDrawer from './FeedbackDrawer';
import SettingGroup from './SettingItem';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';
import { useCloudSyncConnection } from '@/lib/hooks/useCloudSync';
import { useSettingsStore, getSettingsStore } from '@/lib/stores/settingsStore';

import { useTheme } from 'next-themes';
import {
  ChevronLeft,
  Monitor,
  Archive,
  List,
  CalendarDays,
  Timer,
  Database,
  Bell,
  Lightbulb,
  Shuffle,
  ArrowUpDown,
  Palette,
  EyeOff,
  ImagePlus,
  Cloud,
  Upload,
  Download,
  X,
  Settings2,
  Layout,
  CircleHelp,
  Info,
  User,
  MessageCircle,
  ThumbsUp,
  Notebook,
  FlaskConical,
  Box,
  Play,
} from 'lucide-react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

import Image from 'next/image';
import { getChildPageStyle } from '@/lib/navigation/pageTransition';

// 从统一的类型定义导入，避免重复定义
// 类型定义在 db.ts，默认值在 settingsStore.ts
export { type SettingsOptions } from '@/lib/core/db';
export { defaultSettings } from '@/lib/stores/settingsStore';
import type { SettingsOptions } from '@/lib/core/db';

// 子设置页面的打开/关闭函数接口
export interface SubSettingsHandlers {
  onOpenDisplaySettings: () => void;
  onOpenNavigationSettings: () => void;
  onOpenStockSettings: () => void;
  onOpenBeanSettings: () => void;
  onOpenGreenBeanSettings: () => void;
  onOpenFlavorPeriodSettings: () => void;
  onOpenBrewingSettings: () => void;
  onOpenTimerSettings: () => void;
  onOpenDataSettings: () => void;
  onOpenNotificationSettings: () => void;
  onOpenRandomCoffeeBeanSettings: () => void;
  onOpenSearchSortSettings: () => void;
  onOpenFlavorDimensionSettings: () => void;
  onOpenNoteSettings: () => void;
  onOpenHiddenMethodsSettings: () => void;
  onOpenHiddenEquipmentsSettings: () => void;
  onOpenRoasterLogoSettings: () => void;
  onOpenGrinderSettings: () => void;
  onOpenExperimentalSettings: () => void;
  onOpenAboutSettings: () => void;
}

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChange?: () => void;
  subSettingsHandlers: SubSettingsHandlers;
  hasSubSettingsOpen: boolean; // 是否有子设置页面打开
}

// 获取名字的首字母（支持中文拼音）
function getFirstLetter(name: string): string {
  const first = name.charAt(0);
  // 英文字母直接返回大写
  if (/^[A-Za-z]$/.test(first)) {
    return first.toUpperCase();
  }
  // 数字
  if (/^[0-9]$/.test(first)) {
    return '0-9';
  }
  // 中文取拼音首字母
  const py = pinyin(first, { pattern: 'first', toneType: 'none' });
  if (py && /^[a-z]$/i.test(py)) {
    return py.toUpperCase();
  }
  return '#';
}

// 按首字母分组
function groupByFirstLetter(names: string[]) {
  // 先排序：英文/数字在前，中文在后，同类按 zh-CN locale 排序
  const sorted = [...names].sort((a, b) => {
    const isAEnglish = /^[A-Za-z0-9]/.test(a.charAt(0));
    const isBEnglish = /^[A-Za-z0-9]/.test(b.charAt(0));
    if (isAEnglish && !isBEnglish) return -1;
    if (!isAEnglish && isBEnglish) return 1;
    return a.localeCompare(b, 'zh-CN');
  });

  const groups: Record<string, string[]> = {};

  sorted.forEach(name => {
    const key = getFirstLetter(name);
    if (!groups[key]) groups[key] = [];
    groups[key].push(name);
  });

  // 排序：字母 A-Z，然后 0-9，最后 #
  const sortedKeys = Object.keys(groups).sort((a, b) => {
    if (a === '#') return 1;
    if (b === '#') return -1;
    if (a === '0-9') return b === '#' ? -1 : 1;
    if (b === '0-9') return a === '#' ? 1 : -1;
    return a.localeCompare(b);
  });

  return sortedKeys.map(key => ({ letter: key, names: groups[key] }));
}

// 赞助者名单组件
function SponsorList() {
  const grouped = useMemo(() => groupByFirstLetter(sponsorsList), []);

  return (
    <div className="mt-8 divide-y divide-neutral-100 dark:divide-neutral-800">
      {grouped.map(({ letter, names }) => (
        <div
          key={letter}
          className="flex py-1.5 text-neutral-800 dark:text-neutral-200"
        >
          <span className="w-6 shrink-0 text-neutral-300 dark:text-neutral-600">
            {letter}
          </span>
          <span className="flex-1 text-left">{names.join('、')}</span>
        </div>
      ))}
      <div className="flex py-1.5">
        <span className="w-6 shrink-0 text-neutral-300 dark:text-neutral-600">
          &
        </span>
        <span className="flex-1 text-left text-neutral-800 dark:text-neutral-200">
          You
        </span>
      </div>
    </div>
  );
}

const Settings: React.FC<SettingsProps> = ({
  isOpen,
  onClose,
  onDataChange: _onDataChange,
  subSettingsHandlers,
  hasSubSettingsOpen,
}) => {
  // 使用 Zustand store 管理设置
  const settings = useSettingsStore(state => state.settings);
  const updateSettings = useSettingsStore(state => state.updateSettings);
  const storeInitialized = useSettingsStore(state => state.initialized);
  const loadSettings = useSettingsStore(state => state.loadSettings);

  // 初始化加载设置
  useEffect(() => {
    if (!storeInitialized) {
      loadSettings();
    }
  }, [storeInitialized, loadSettings]);

  // 获取主题相关方法
  const { theme, systemTheme } = useTheme();

  // 控制动画状态
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

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
      // 等待动画完成后移除DOM
      const timer = setTimeout(() => setShouldRender(false), 350);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // 关闭处理
  const handleClose = () => {
    // 立即触发退出动画
    setIsVisible(false);

    // 立即通知父组件 Settings 正在关闭
    window.dispatchEvent(new CustomEvent('settingsClosing'));

    // 等待动画完成后调用 modalHistory.back()
    setTimeout(() => {
      modalHistory.back();
    }, 350); // 与 IOS_TRANSITION_CONFIG.duration 一致
  };

  // 全局历史栈变化监控（仅在开发模式 - 简化版）
  React.useEffect(() => {
    const originalPushState = window.history.pushState;

    window.history.pushState = function (state, title, url) {
      return originalPushState.call(this, state, title, url);
    };

    return () => {
      window.history.pushState = originalPushState;
    };
  }, []);

  // 监听子设置页面的关闭事件
  const [isSubSettingsClosing, setIsSubSettingsClosing] = React.useState(false);

  React.useEffect(() => {
    const handleSubSettingsClosing = () => {
      setIsSubSettingsClosing(true);
      // 350ms 后重置状态
      setTimeout(() => setIsSubSettingsClosing(false), 350);
    };

    window.addEventListener('subSettingsClosing', handleSubSettingsClosing);
    return () =>
      window.removeEventListener(
        'subSettingsClosing',
        handleSubSettingsClosing
      );
  }, []);

  // 添加二维码显示状态
  const [showQRCodes, setShowQRCodes] = useState(false);
  // 添加显示哪种二维码的状态
  const [qrCodeType, setQrCodeType] = useState<'appreciation' | 'group' | null>(
    null
  );
  // 添加确认隐藏状态（跟踪哪个二维码正在确认中）
  const [confirmingHide, setConfirmingHide] = useState<
    'group' | 'appreciation' | null
  >(null);

  // 版本更新检测状态
  const [showUpdateDrawer, setShowUpdateDrawer] = useState(false);
  const [showFeedbackDrawer, setShowFeedbackDrawer] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{
    latestVersion: string;
    downloadUrl: string;
    releaseNotes?: string;
  } | null>(null);

  // 计算是否有隐藏的方案和器具
  const hasHiddenMethods = React.useMemo(() => {
    const hiddenMethods = settings.hiddenCommonMethods || {};
    return Object.values(hiddenMethods).some(methods => methods.length > 0);
  }, [settings.hiddenCommonMethods]);

  const hasHiddenEquipments = React.useMemo(() => {
    const hiddenEquipments = settings.hiddenEquipments || [];
    return hiddenEquipments.length > 0;
  }, [settings.hiddenEquipments]);

  // S3同步相关状态（仅用于同步按钮）
  const {
    status: cloudSyncStatus,
    isSyncing,
    setIsSyncing,
    performSync: performQuickSync,
  } = useCloudSyncConnection(settings as SettingsOptions);
  const [showSyncMenu, setShowSyncMenu] = useState(false);

  // 自动检测更新（仅在 Capacitor 原生环境下）
  // 是否为自动检测触发的更新提示
  const [isAutoCheckUpdate, setIsAutoCheckUpdate] = useState(false);
  const nativeApp = typeof window !== 'undefined' ? isNative() : false;

  useEffect(() => {
    if (!isOpen) return;
    if (!nativeApp) return; // 仅原生平台自动检测

    const autoCheckUpdate = async () => {
      try {
        // 检查是否可以进行自动检测（一天一次，且不在延迟期内）
        const canCheck = await canAutoCheck();
        if (!canCheck) return;

        const result = await checkForUpdates();
        await saveCheckTime(); // 保存检测时间

        if (result.hasUpdate && result.latestVersion && result.downloadUrl) {
          setUpdateInfo({
            latestVersion: result.latestVersion,
            downloadUrl: result.downloadUrl,
            releaseNotes: result.releaseNotes ?? '',
          });
          setIsAutoCheckUpdate(true); // 标记为自动检测
          setShowUpdateDrawer(true);
        }
      } catch (error) {
        // 自动检测失败时静默忽略，不打扰用户
        console.error('自动检测更新失败:', error);
      }
    };

    autoCheckUpdate();
  }, [isOpen, nativeApp]);

  // 点击外部关闭同步菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showSyncMenu) {
        const target = e.target as HTMLElement;
        if (!target.closest('[data-sync-menu]')) {
          setShowSyncMenu(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSyncMenu]);

  // 点击外部恢复隐藏确认状态
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (confirmingHide) {
        const target = e.target as HTMLElement;
        // 如果点击的不是确认按钮本身，则恢复状态
        if (!target.closest('[data-hide-confirm]')) {
          setConfirmingHide(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [confirmingHide]);

  // 添加主题颜色更新的 Effect
  useEffect(() => {
    // 确保只在客户端执行
    if (typeof window === 'undefined') return;

    // 使用统一的工具函数恢复默认 theme-color
    restoreDefaultThemeColor(theme, systemTheme);

    // 如果是系统模式，添加系统主题变化的监听
    let mediaQuery: MediaQueryList | null = null;
    if (theme === 'system') {
      mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => {
        restoreDefaultThemeColor(theme, systemTheme);
      };
      mediaQuery.addEventListener('change', handleChange);
      return () => {
        mediaQuery?.removeEventListener('change', handleChange);
      };
    }
  }, [theme, systemTheme]);

  // 使用统一的历史栈管理系统
  useModalHistory({
    id: 'settings',
    isOpen,
    onClose,
  });

  // 处理设置变更 - 使用 settingsStore 更新
  const handleChange = useCallback(
    async <K extends keyof SettingsOptions>(
      key: K,
      value: SettingsOptions[K]
    ) => {
      try {
        // 使用 settingsStore 更新设置（自动持久化到 IndexedDB）
        // 使用 any 类型绕过 SettingsOptions 和 AppSettings 之间的微小差异
        await updateSettings({ [key]: value } as any);
      } catch (error) {
        console.error('[Settings] handleChange error:', error);
      }
    },
    [updateSettings]
  );

  // 如果shouldRender为false，不渲染任何内容
  if (!shouldRender) return null;

  // 计算 Settings 页面的样式
  // 只在打开时应用滑入动画，子页面打开时应用左移（但不改变透明度）
  const baseStyle = getChildPageStyle(isVisible);

  // Settings 的最终样式
  // 当子设置页面打开时，Settings 需要像主页一样向左滑动 24px
  // 当子设置正在关闭时（isSubSettingsClosing），立即开始恢复动画
  const settingsStyle: React.CSSProperties = {
    ...baseStyle,
    // 如果有子设置页面打开且不是正在关闭，Settings 向左移动
    transform:
      isVisible && hasSubSettingsOpen && !isSubSettingsClosing
        ? 'translate3d(-24px, 0, 0)'
        : baseStyle.transform,
    // 保持完全不透明，不要降低透明度
    opacity: isVisible ? 1 : 0,
  };

  return (
    <div
      className="fixed inset-0 mx-auto flex flex-col bg-neutral-50 dark:bg-neutral-900"
      style={settingsStyle}
    >
      {/* 头部导航栏 */}
      <div className="pt-safe-top relative z-20 flex items-center justify-between px-6">
        <button
          onClick={handleClose}
          className="flex flex-5 items-center rounded-full text-neutral-700 dark:text-neutral-300"
        >
          <ChevronLeft className="-ml-1 h-5 w-5" />
          <h2 className="pl-2.5 text-xl font-medium text-neutral-800 dark:text-neutral-200">
            设置
          </h2>
        </button>

        {/* 云同步快捷按钮 - 仅对手动同步类型（S3/WebDAV）显示 */}
        {cloudSyncStatus === 'connected' &&
          settings.activeSyncType !== 'supabase' && (
            <div
              className="absolute right-6 flex items-center gap-2"
              data-sync-menu
            >
              {/* 上传按钮 - 从右侧滑入 */}
              <button
                onClick={() => {
                  setShowSyncMenu(false);
                  // 延迟执行同步，等待菜单收回动画完成
                  setTimeout(() => performQuickSync('upload'), 250);
                }}
                disabled={isSyncing}
                className={`flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 transition-all hover:bg-neutral-200 active:scale-95 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 ${
                  showSyncMenu && !isSyncing
                    ? 'translate-x-0 opacity-100'
                    : 'pointer-events-none translate-x-4 opacity-0'
                }`}
                style={{ transitionDuration: '200ms' }}
              >
                <Upload className="h-5 w-5" />
              </button>
              {/* 下载按钮 - 从右侧滑入 */}
              <button
                onClick={() => {
                  setShowSyncMenu(false);
                  // 延迟执行同步，等待菜单收回动画完成
                  setTimeout(() => performQuickSync('download'), 250);
                }}
                disabled={isSyncing}
                className={`flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 transition-all hover:bg-neutral-200 active:scale-95 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 ${
                  showSyncMenu && !isSyncing
                    ? 'translate-x-0 opacity-100'
                    : 'pointer-events-none translate-x-4 opacity-0'
                }`}
                style={{ transitionDuration: '250ms' }}
              >
                <Download className="h-5 w-5" />
              </button>
              {/* 云图标/叉号/加载动画切换按钮 */}
              <button
                onClick={() => !isSyncing && setShowSyncMenu(!showSyncMenu)}
                disabled={isSyncing}
                className={`flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 transition-all hover:bg-neutral-200 active:scale-95 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 ${isSyncing ? 'cursor-default' : ''}`}
              >
                {isSyncing ? (
                  <LoadingSpinner className="h-5 w-5" />
                ) : showSyncMenu ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Cloud className="h-5 w-5" />
                )}
              </button>
            </div>
          )}
      </div>

      {/* 滚动内容区域 - 新的简洁设计 */}
      <div className="pb-safe-bottom relative flex-1 overflow-y-auto">
        {/* 顶部渐变阴影（随滚动粘附）*/}
        <div className="pointer-events-none sticky top-0 z-10 h-12 w-full bg-linear-to-b from-neutral-50 to-transparent first:border-b-0 dark:from-neutral-900"></div>

        {/* 帮助与反馈 */}
        <SettingGroup
          className="-mt-4"
          items={[
            {
              icon: CircleHelp,
              label: '帮助文档',
              onClick: () => {
                window.open('https://help.chu3.top/docs', '_blank');
                if (settings.hapticFeedback) {
                  hapticsUtils.light();
                }
              },
            },
            {
              icon: Lightbulb,
              label: '想法收集站',
              onClick: () => {
                setShowFeedbackDrawer(true);
                if (settings.hapticFeedback) {
                  hapticsUtils.light();
                }
              },
            },
            ...(!settings.hideGroupQRCode
              ? [
                  {
                    icon: MessageCircle,
                    label: '交流群',
                    isExpanded: qrCodeType === 'group',
                    onClick: () => {
                      setQrCodeType(qrCodeType === 'group' ? null : 'group');
                      if (settings.hapticFeedback) {
                        hapticsUtils.light();
                      }
                    },
                    expandedContent: (
                      <div className="flex flex-col items-start justify-center pb-3.5 pl-[42px]">
                        <div className="overflow-hidden rounded-lg border border-neutral-400/10 bg-white p-2">
                          <Image
                            src="/images/content/group-code.jpg"
                            alt="交流群二维码"
                            width={200}
                            height={200}
                            className="h-auto w-[200px]"
                          />
                        </div>
                        <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
                          群满 200 人哩，加开发者拉你进群吧
                          {confirmingHide === 'group' ? (
                            <span data-hide-confirm>
                              {' - '}
                              <button
                                onClick={async e => {
                                  e.stopPropagation();
                                  await handleChange('hideGroupQRCode', true);
                                  setConfirmingHide(null);
                                  setQrCodeType(null);
                                  if (settings.hapticFeedback) {
                                    hapticsUtils.medium();
                                  }
                                }}
                                className="cursor-pointer text-red-500 hover:text-red-600 active:text-red-700 dark:text-red-400 dark:hover:text-red-500"
                              >
                                永久隐藏
                              </button>
                            </span>
                          ) : (
                            <span data-hide-confirm>
                              {' - '}
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  setConfirmingHide('group');
                                  if (settings.hapticFeedback) {
                                    hapticsUtils.light();
                                  }
                                }}
                                className="cursor-pointer text-neutral-500 hover:text-neutral-600 active:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
                              >
                                不再显示
                              </button>
                            </span>
                          )}
                        </p>
                      </div>
                    ),
                  },
                ]
              : []),
            ...(!settings.hideAppreciationQRCode
              ? [
                  {
                    icon: ThumbsUp,
                    label: '赞赏码',
                    isExpanded: qrCodeType === 'appreciation',
                    onClick: () => {
                      setQrCodeType(
                        qrCodeType === 'appreciation' ? null : 'appreciation'
                      );
                      if (settings.hapticFeedback) {
                        hapticsUtils.light();
                      }
                    },
                    expandedContent: (
                      <div className="flex flex-col items-start justify-center pb-3.5 pl-[42px]">
                        <div className="overflow-hidden rounded-lg border border-neutral-400/10 bg-white p-2">
                          <Image
                            src="/images/content/appreciation-code.jpg"
                            alt="赞赏码"
                            width={200}
                            height={200}
                            className="h-auto w-[200px]"
                          />
                        </div>
                        <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
                          赞赏码（开发不易，要是能支持一下就太好了 www）
                          {confirmingHide === 'appreciation' ? (
                            <span data-hide-confirm>
                              {' - '}
                              <button
                                onClick={async e => {
                                  e.stopPropagation();
                                  await handleChange(
                                    'hideAppreciationQRCode',
                                    true
                                  );
                                  setConfirmingHide(null);
                                  setQrCodeType(null);
                                  if (settings.hapticFeedback) {
                                    hapticsUtils.medium();
                                  }
                                }}
                                className="cursor-pointer text-red-500 hover:text-red-600 active:text-red-700 dark:text-red-400 dark:hover:text-red-500"
                              >
                                永久隐藏
                              </button>
                            </span>
                          ) : (
                            <span data-hide-confirm>
                              {' - '}
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  setConfirmingHide('appreciation');
                                  if (settings.hapticFeedback) {
                                    hapticsUtils.light();
                                  }
                                }}
                                className="cursor-pointer text-neutral-500 hover:text-neutral-600 active:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
                              >
                                不再显示
                              </button>
                            </span>
                          )}
                        </p>
                      </div>
                    ),
                  },
                ]
              : []),
          ]}
        />

        {/* 显示与界面设置 */}
        <SettingGroup
          items={[
            {
              icon: Monitor,
              label: '外观与字体',
              onClick: subSettingsHandlers.onOpenDisplaySettings,
            },
            {
              icon: Layout,
              label: '导航栏',
              onClick: subSettingsHandlers.onOpenNavigationSettings,
            },
            {
              icon: Bell,
              label: '通知',
              onClick: subSettingsHandlers.onOpenNotificationSettings,
            },
          ]}
        />
        {/* 功能设置 */}
        <SettingGroup
          items={[
            {
              icon: Play,
              label: '冲煮',
              onClick: subSettingsHandlers.onOpenBrewingSettings,
            },
            {
              icon: Timer,
              label: '计时器',
              onClick: subSettingsHandlers.onOpenTimerSettings,
            },
            {
              icon: Settings2,
              label: '磨豆机',
              onClick: subSettingsHandlers.onOpenGrinderSettings,
            },
            {
              icon: Shuffle,
              label: '随机咖啡豆规则',
              onClick: subSettingsHandlers.onOpenRandomCoffeeBeanSettings,
            },
            ...(hasHiddenMethods
              ? [
                  {
                    icon: EyeOff,
                    label: '隐藏的预设方案',
                    onClick: subSettingsHandlers.onOpenHiddenMethodsSettings,
                  },
                ]
              : []),
            ...(hasHiddenEquipments
              ? [
                  {
                    icon: EyeOff,
                    label: '隐藏的预设器具',
                    onClick: subSettingsHandlers.onOpenHiddenEquipmentsSettings,
                  },
                ]
              : []),
          ]}
        />

        {/* 咖啡豆管理 */}
        <SettingGroup
          items={[
            {
              icon: List,
              label: '咖啡豆',
              onClick: subSettingsHandlers.onOpenBeanSettings,
            },
            {
              icon: Box,
              label: '生豆库',
              onClick: subSettingsHandlers.onOpenGreenBeanSettings,
            },
            {
              icon: Archive,
              label: '库存扣除',
              onClick: subSettingsHandlers.onOpenStockSettings,
            },
            {
              icon: CalendarDays,
              label: '赏味期',
              onClick: subSettingsHandlers.onOpenFlavorPeriodSettings,
            },
            {
              icon: ImagePlus,
              label: '烘焙商图标',
              onClick: subSettingsHandlers.onOpenRoasterLogoSettings,
            },
          ]}
        />

        {/* 笔记管理 */}
        <SettingGroup
          items={[
            {
              icon: Notebook,
              label: '笔记',
              onClick: subSettingsHandlers.onOpenNoteSettings,
            },
            {
              icon: ArrowUpDown,
              label: '搜索与排序',
              onClick: subSettingsHandlers.onOpenSearchSortSettings,
            },
            {
              icon: Palette,
              label: '评分维度',
              onClick: subSettingsHandlers.onOpenFlavorDimensionSettings,
            },
          ]}
        />

        {/* 实验性功能 */}
        <SettingGroup
          items={[
            {
              icon: FlaskConical,
              label: '实验性功能',
              onClick: subSettingsHandlers.onOpenExperimentalSettings,
            },
          ]}
        />

        {/* 数据与备份 */}
        <SettingGroup
          items={[
            {
              icon: User,
              label: '用户名',
              value: settings.username,
              placeholder: '点击输入',
              editable: true,
              onSave: value => {
                handleChange('username', value);
                if (settings.hapticFeedback) {
                  hapticsUtils.light();
                }
              },
            },
            {
              icon: Database,
              label: '数据与备份',
              onClick: subSettingsHandlers.onOpenDataSettings,
            },
          ]}
        />

        {/* 关于 */}
        <SettingGroup
          items={[
            {
              icon: Info,
              label: '关于',
              value: getVersionLabel(nativeApp),
              onClick: subSettingsHandlers.onOpenAboutSettings,
            },
          ]}
        />

        {/* 感谢名单 */}
        <div className="px-8 pt-18 pb-8">
          <div className="text-left text-xs select-none">
            <p className="font-medium text-neutral-800 dark:text-neutral-200">
              感谢各位一直以来的支持，自 2025 年 2 月 1
              日首次发布至今，项目已持续运行{' '}
              {Math.floor(
                (Date.now() - new Date('2025-02-01').getTime()) /
                  (1000 * 60 * 60 * 24)
              )}{' '}
              天，你们的每一次鼓励与贡献，都是它不断成长的重要动力。
            </p>
            <SponsorList />
          </div>
        </div>
      </div>

      {/* 版本更新抽屉 */}
      {updateInfo && (
        <UpdateDrawer
          isOpen={showUpdateDrawer}
          onClose={() => {
            setShowUpdateDrawer(false);
            setIsAutoCheckUpdate(false); // 关闭时重置自动检测标记
          }}
          currentVersion={APP_VERSION}
          latestVersion={updateInfo.latestVersion}
          downloadUrl={updateInfo.downloadUrl}
          releaseNotes={updateInfo.releaseNotes}
          isAutoCheck={isAutoCheckUpdate}
          onPostpone={async () => {
            await postponeUpdateCheck(); // 延迟7天后再检测
          }}
        />
      )}

      {/* 反馈建议抽屉 */}
      <FeedbackDrawer
        isOpen={showFeedbackDrawer}
        onClose={() => setShowFeedbackDrawer(false)}
        hapticFeedback={settings.hapticFeedback}
      />
    </div>
  );
};

export default Settings;
