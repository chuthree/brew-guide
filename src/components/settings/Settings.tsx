'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  APP_VERSION,
  sponsorsList,
  type CustomEquipment,
} from '@/lib/core/config';
import { getVersionLabel } from '@/lib/core/buildInfo';
import { pinyin } from 'pinyin-pro';
import hapticsUtils from '@/lib/ui/haptics';
import { restoreDefaultThemeColor } from '@/lib/hooks/useThemeColor';
import { requestPWAUpdateCheck } from '@/lib/utils/pwaUpdateCheck';
import {
  checkForUpdates,
  saveCheckTime,
  canAutoCheck,
  postponeUpdateCheck,
} from '@/lib/utils/versionCheck';
import { getPlatform, isBundledNativeApp } from '@/lib/app/capacitor';
import {
  getOfflineAndroidDownloadUrl,
  getOfflineIosDownloadUrl,
} from '@/lib/utils/downloadUrls';
import { Capacitor } from '@capacitor/core';
import UpdateDrawer from './UpdateDrawer';
import SettingGroup, { type SettingItemData } from './SettingItem';
import SettingsSearchBar from './SettingsSearchBar';
import SettingsSearchResults from './SettingsSearchResults';
import {
  buildSettingsSearchItems,
  filterSettingsSearchItems,
  type SettingsSearchItem,
  type SettingsSearchPageId,
  type SettingsSearchTarget,
} from './settingsSearch';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';
import { useCloudSyncConnection } from '@/lib/hooks/useCloudSync';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { useCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore';
import { useCustomMethodStore } from '@/lib/stores/customMethodStore';
import { useGrinderStore } from '@/lib/stores/grinderStore';
import { deriveNavigationSettings } from '@/lib/navigation/navigationSettings';
import { buildSettingsFeatureGroups } from './settingsFeatureRegistry';
import { getNotificationSettingsVisibility } from './notificationSettingsVisibility';

import { useTheme } from 'next-themes';
import {
  ChevronLeft,
  Monitor,
  Database,
  Bell,
  Cloud,
  Upload,
  Download,
  X,
  Blocks,
  CircleHelp,
  Info,
  User,
  MessageCircle,
  ThumbsUp,
} from 'lucide-react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

import Image from 'next/image';
import {
  getChildPageStyle,
  getParentPageStyle,
  usePageTransitionState,
} from '@/lib/navigation/pageTransition';

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
  onOpenCoffeeBeanGroupSettings: () => void;
  onOpenFlavorPeriodSettings: () => void;
  onOpenBrewingSettings: () => void;
  onOpenTimerSettings: () => void;
  onOpenDataSettings: () => void;
  onOpenNotificationSettings: () => void;
  onOpenRandomCoffeeBeanSettings: () => void;
  onOpenEquipmentMethodSettings: () => void;
  onOpenFlavorDimensionSettings: () => void;
  onOpenNoteSettings: () => void;
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
  isLargeScreen?: boolean;
  activeSubSettingId?: string | null;
  subSettingsContent?: React.ReactNode;
  customEquipments: CustomEquipment[];
  settingsSearchTarget: SettingsSearchTarget | null;
  onSettingsSearchTargetChange: (target: SettingsSearchTarget | null) => void;
}

const APP_FIRST_RELEASE_TIME = new Date('2025-02-01').getTime();
const RUNNING_DAYS = Math.floor(
  (Date.now() - APP_FIRST_RELEASE_TIME) / (1000 * 60 * 60 * 24)
);

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

const settingsFeatureGroupLabels: Record<string, string> = {
  brewing: '冲煮',
  brewingEquipment: '器具',
  coffeeBean: '咖啡豆',
  notes: '笔记',
  experimental: '实验',
};

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
  isLargeScreen = false,
  activeSubSettingId = null,
  subSettingsContent = null,
  customEquipments,
  settingsSearchTarget,
  onSettingsSearchTargetChange,
}) => {
  // 使用 Zustand store 管理设置
  const settings = useSettingsStore(state => state.settings);
  const navigationState = deriveNavigationSettings(settings.navigationSettings);
  const settingsFeatureGroups = buildSettingsFeatureGroups({
    settings: settings as SettingsOptions,
    subSettingsHandlers,
    visibleModules: navigationState.visibleTabs,
  });
  const { hasVisibleNotificationSettings } = getNotificationSettingsVisibility({
    isNativeApp: Capacitor.isNativePlatform(),
    visibleModules: navigationState.visibleTabs,
  });
  const updateSettings = useSettingsStore(state => state.updateSettings);
  const storeInitialized = useSettingsStore(state => state.initialized);
  const loadSettings = useSettingsStore(state => state.loadSettings);
  const shouldReduceMotion = useReducedMotion();
  const beans = useCoffeeBeanStore(state => state.beans);
  const beansInitialized = useCoffeeBeanStore(state => state.initialized);
  const loadBeans = useCoffeeBeanStore(state => state.loadBeans);
  const grinders = useGrinderStore(state => state.grinders);
  const grindersInitialized = useGrinderStore(state => state.initialized);
  const initializeGrinders = useGrinderStore(state => state.initialize);
  const customMethodsByEquipment = useCustomMethodStore(
    state => state.methodsByEquipment
  );
  const customMethodsInitialized = useCustomMethodStore(
    state => state.initialized
  );
  const loadCustomMethods = useCustomMethodStore(state => state.loadMethods);

  // 初始化加载设置
  useEffect(() => {
    if (!storeInitialized) {
      loadSettings();
    }
  }, [storeInitialized, loadSettings]);

  useEffect(() => {
    if (!isOpen) return;

    if (!beansInitialized) {
      void loadBeans();
    }

    if (!grindersInitialized) {
      void initializeGrinders();
    }

    if (!customMethodsInitialized) {
      void loadCustomMethods();
    }
  }, [
    beansInitialized,
    customMethodsInitialized,
    grindersInitialized,
    initializeGrinders,
    isOpen,
    loadBeans,
    loadCustomMethods,
  ]);

  // 获取主题相关方法
  const { theme, systemTheme } = useTheme();
  const runningDays = RUNNING_DAYS;

  const { shouldRender, isVisible } = usePageTransitionState(isOpen);

  // 关闭处理
  const handleClose = () => {
    if (isLargeScreen) {
      onClose();
      return;
    }

    modalHistory.back();
  };

  // 监听子设置页面的关闭事件
  const [isSubSettingsClosing, setIsSubSettingsClosing] = React.useState(false);

  React.useEffect(() => {
    const handleSubSettingsClosing = () => {
      setIsSubSettingsClosing(true);
    };

    window.addEventListener('subSettingsClosing', handleSubSettingsClosing);
    return () =>
      window.removeEventListener(
        'subSettingsClosing',
        handleSubSettingsClosing
      );
  }, []);

  if (!hasSubSettingsOpen && isSubSettingsClosing) {
    setIsSubSettingsClosing(false);
  }

  // 添加显示哪种二维码的状态
  const [qrCodeType, setQrCodeType] = useState<'appreciation' | 'group' | null>(
    null
  );

  // 版本更新检测状态
  const [showUpdateDrawer, setShowUpdateDrawer] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{
    latestVersion: string;
    downloadUrl: string;
    releaseNotes?: string;
  } | null>(null);

  // S3同步相关状态（仅用于同步按钮）
  const {
    status: cloudSyncStatus,
    isSyncing,
    performSync: performQuickSync,
  } = useCloudSyncConnection(settings as SettingsOptions);
  const [showSyncMenu, setShowSyncMenu] = useState(false);
  const [settingsSearchQuery, setSettingsSearchQuery] = useState('');
  const searchHighlightTimerRef = React.useRef<number | null>(null);
  const clearSearchHighlightTimer = useCallback(() => {
    if (searchHighlightTimerRef.current !== null) {
      window.clearTimeout(searchHighlightTimerRef.current);
      searchHighlightTimerRef.current = null;
    }
  }, []);

  // 自动检测更新（仅在本地打包的 Capacitor 环境下）
  // 是否为自动检测触发的更新提示
  const [isAutoCheckUpdate, setIsAutoCheckUpdate] = useState(false);
  const bundledNativeApp =
    typeof window !== 'undefined' ? isBundledNativeApp() : false;

  const getNativeUpdateDownloadUrl = useCallback((version: string) => {
    const platform = getPlatform();

    if (platform === 'ios') {
      return getOfflineIosDownloadUrl(version);
    }

    if (platform === 'android') {
      return getOfflineAndroidDownloadUrl(version);
    }

    return null;
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    requestPWAUpdateCheck();
  }, [isOpen]);

  useEffect(() => {
    return () => {
      clearSearchHighlightTimer();
      onSettingsSearchTargetChange(null);
    };
  }, [clearSearchHighlightTimer, onSettingsSearchTargetChange]);

  useEffect(() => {
    if (!isOpen) return;
    if (!bundledNativeApp) return; // 仅本地打包原生平台自动检测
    if (settings.showUpdatePrompt === false) return;

    const autoCheckUpdate = async () => {
      try {
        // 检查是否可以进行自动检测（一天一次，且不在延迟期内）
        const canCheck = await canAutoCheck();
        if (!canCheck) return;

        const result = await checkForUpdates();
        await saveCheckTime(); // 保存检测时间

        if (result.hasUpdate && result.latestVersion) {
          const downloadUrl = getNativeUpdateDownloadUrl(result.latestVersion);
          if (!downloadUrl) return;

          setUpdateInfo({
            latestVersion: result.latestVersion,
            downloadUrl,
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
  }, [
    isOpen,
    bundledNativeApp,
    getNativeUpdateDownloadUrl,
    settings.showUpdatePrompt,
  ]);

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
    skipPageExitTransitionOnHistory: true,
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

  const handleSettingsSearchSelect = useCallback(
    (item: SettingsSearchItem) => {
      clearSearchHighlightTimer();
      setSettingsSearchQuery('');

      onSettingsSearchTargetChange({
        pageId: item.pageId,
        settingId: item.settingId,
      });

      const pageHandlers: Partial<Record<SettingsSearchPageId, () => void>> = {
        'display-settings': subSettingsHandlers.onOpenDisplaySettings,
        'navigation-settings': subSettingsHandlers.onOpenNavigationSettings,
        'stock-settings': subSettingsHandlers.onOpenStockSettings,
        'bean-settings': subSettingsHandlers.onOpenBeanSettings,
        'green-bean-settings': subSettingsHandlers.onOpenGreenBeanSettings,
        'coffee-bean-group-settings':
          subSettingsHandlers.onOpenCoffeeBeanGroupSettings,
        'flavor-period-settings':
          subSettingsHandlers.onOpenFlavorPeriodSettings,
        'brewing-settings': subSettingsHandlers.onOpenBrewingSettings,
        'timer-settings': subSettingsHandlers.onOpenTimerSettings,
        'data-settings': subSettingsHandlers.onOpenDataSettings,
        'notification-settings': subSettingsHandlers.onOpenNotificationSettings,
        'random-coffee-bean-settings':
          subSettingsHandlers.onOpenRandomCoffeeBeanSettings,
        'equipment-method-settings':
          subSettingsHandlers.onOpenEquipmentMethodSettings,
        'note-settings': subSettingsHandlers.onOpenNoteSettings,
        'flavor-dimension-settings':
          subSettingsHandlers.onOpenFlavorDimensionSettings,
        'roaster-logo-settings': subSettingsHandlers.onOpenRoasterLogoSettings,
        'grinder-settings': subSettingsHandlers.onOpenGrinderSettings,
        'experimental-settings': subSettingsHandlers.onOpenExperimentalSettings,
        'about-settings': subSettingsHandlers.onOpenAboutSettings,
      };

      pageHandlers[item.pageId]?.();

      if (settings.hapticFeedback) {
        hapticsUtils.light();
      }

      searchHighlightTimerRef.current = window.setTimeout(() => {
        onSettingsSearchTargetChange(null);
        searchHighlightTimerRef.current = null;
      }, 1800);
    },
    [
      clearSearchHighlightTimer,
      onSettingsSearchTargetChange,
      settings.hapticFeedback,
      setSettingsSearchQuery,
      subSettingsHandlers,
    ]
  );

  // 如果shouldRender为false，不渲染任何内容
  if (!shouldRender) return null;

  // 计算 Settings 页面的样式
  // 只在打开时应用滑入动画，子页面打开时应用左移（但不改变透明度）
  const baseStyle = getChildPageStyle(isVisible);
  const shouldApplySubSettingsParentStyle =
    !isLargeScreen && isVisible && (hasSubSettingsOpen || isSubSettingsClosing);
  const subSettingsParentStyle = shouldApplySubSettingsParentStyle
    ? getParentPageStyle(hasSubSettingsOpen && !isSubSettingsClosing)
    : null;

  // Settings 的最终样式
  // 当子设置页面打开时，Settings 需要像主页一样向左滑动 24px
  // 当系统手势返回时，复用 parent skip，避免系统动画后 Web 再恢复一次
  const settingsStyle: React.CSSProperties = {
    ...baseStyle,
    transform: subSettingsParentStyle?.transform ?? baseStyle.transform,
    transition: subSettingsParentStyle?.transition ?? baseStyle.transition,
    // 保持完全不透明，不要降低透明度
    opacity: isVisible ? 1 : 0,
  };

  const headerContent = (
    <div className="pt-safe-top relative z-20 flex items-center justify-between px-6">
      <button
        type="button"
        onClick={handleClose}
        className="flex flex-5 cursor-pointer items-center rounded-full text-neutral-700 dark:text-neutral-300"
      >
        <ChevronLeft className="-ml-1 size-5" />
        <h2 className="pl-2.5 text-xl font-medium text-neutral-800 dark:text-neutral-200">
          设置
        </h2>
      </button>

      {/* 手动同步/备份快捷按钮 - 支持主手动同步和 Supabase 下的双备份 */}
      {cloudSyncStatus === 'connected' && (
        <div
          className="absolute right-6 flex items-center gap-2"
          data-sync-menu
        >
          {/* 上传按钮 - 从右侧滑入 */}
          <button
            type="button"
            onClick={() => {
              setShowSyncMenu(false);
              // 延迟执行同步，等待菜单收回动画完成
              setTimeout(() => performQuickSync('upload'), 250);
            }}
            disabled={isSyncing}
            className={`flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 transition-[transform,opacity,background-color] ease-out hover:bg-neutral-200 active:scale-95 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 ${
              showSyncMenu && !isSyncing
                ? 'translate-x-0 opacity-100'
                : 'pointer-events-none translate-x-4 opacity-0'
            }`}
            style={{ transitionDuration: '200ms' }}
          >
            <Upload className="size-5" />
          </button>
          {/* 下载按钮 - 从右侧滑入 */}
          <button
            type="button"
            onClick={() => {
              setShowSyncMenu(false);
              // 延迟执行同步，等待菜单收回动画完成
              setTimeout(() => performQuickSync('download'), 250);
            }}
            disabled={isSyncing}
            className={`flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 transition-[transform,opacity,background-color] ease-out hover:bg-neutral-200 active:scale-95 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 ${
              showSyncMenu && !isSyncing
                ? 'translate-x-0 opacity-100'
                : 'pointer-events-none translate-x-4 opacity-0'
            }`}
            style={{ transitionDuration: '250ms' }}
          >
            <Download className="size-5" />
          </button>
          {/* 云图标/叉号/加载动画切换按钮 */}
          <button
            type="button"
            onClick={() => !isSyncing && setShowSyncMenu(!showSyncMenu)}
            disabled={isSyncing}
            className={`flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 transition-[transform,background-color] duration-150 ease-out hover:bg-neutral-200 active:scale-95 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 ${isSyncing ? 'cursor-default' : ''}`}
          >
            {isSyncing ? (
              <LoadingSpinner className="size-5" />
            ) : showSyncMenu ? (
              <X className="size-5" />
            ) : (
              <Cloud className="size-5" />
            )}
          </button>
        </div>
      )}
    </div>
  );
  const shouldDimSubSettingEntries = isLargeScreen && !!activeSubSettingId;
  const masterGroupPaddingClass = isLargeScreen ? 'pl-6 pr-3' : 'px-6';
  const masterColumnClass = isLargeScreen
    ? 'relative flex min-h-0 w-96 shrink-0 flex-col'
    : 'relative flex min-h-0 flex-1 flex-col';
  const interfaceSettingsItems: SettingItemData[] = [
    {
      icon: Monitor,
      label: '外观',
      settingId: 'display-settings',
      onClick: subSettingsHandlers.onOpenDisplaySettings,
    },
    {
      icon: Blocks,
      label: '应用功能',
      settingId: 'navigation-settings',
      onClick: subSettingsHandlers.onOpenNavigationSettings,
    },
  ];

  if (hasVisibleNotificationSettings) {
    interfaceSettingsItems.push({
      icon: Bell,
      label: '提醒通知',
      settingId: 'notification-settings',
      onClick: subSettingsHandlers.onOpenNotificationSettings,
    });
  }

  const dataSettingsItems: SettingItemData[] = [
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
      settingId: 'data-settings',
      onClick: subSettingsHandlers.onOpenDataSettings,
    },
  ];
  const aboutSettingsItems: SettingItemData[] = [
    {
      icon: Info,
      label: '关于',
      settingId: 'about-settings',
      value: getVersionLabel(),
      onClick: subSettingsHandlers.onOpenAboutSettings,
    },
  ];
  const settingsHomeSearchItems: SettingsSearchItem[] = [
    {
      groupLabel: '显示与界面',
      items: interfaceSettingsItems,
    },
    ...settingsFeatureGroups.map(group => ({
      groupLabel: settingsFeatureGroupLabels[group.id],
      items: group.items,
    })),
    {
      groupLabel: '数据与备份',
      items: dataSettingsItems,
    },
    {
      groupLabel: '关于',
      items: aboutSettingsItems,
    },
  ].flatMap(group =>
    group.items
      .filter(
        (
          item
        ): item is SettingItemData & {
          settingId: SettingsSearchPageId;
        } => Boolean(item.settingId)
      )
      .map(item => ({
        id: `settings-entry:${item.settingId}`,
        pageId: item.settingId,
        settingId: item.settingId,
        label: item.label,
        value: item.value,
        description: item.description,
        groupLabel: group.groupLabel,
      }))
  );
  const settingsSearchItems = [
    ...settingsHomeSearchItems,
    ...buildSettingsSearchItems({
      settings: settings as SettingsOptions,
      visibleModules: navigationState.visibleTabs,
      hasVisibleNotificationSettings,
      beans,
      customEquipments,
      customMethodsByEquipment,
      grinders,
    }),
  ];
  const settingsSearchResults = filterSettingsSearchItems(
    settingsSearchItems,
    settingsSearchQuery
  );
  const shouldShowSearchResults = settingsSearchQuery.trim().length > 0;
  const highlightedHomeSettingId =
    settingsSearchTarget?.pageId === 'settings'
      ? settingsSearchTarget.settingId
      : null;

  return (
    <div
      className="fixed inset-0 mx-auto flex flex-col bg-neutral-50 dark:bg-neutral-900"
      style={settingsStyle}
    >
      {!isLargeScreen && headerContent}

      {/* 滚动内容区域 - 新的简洁设计 */}
      <div className="flex min-h-0 flex-1">
        <div className={masterColumnClass}>
          {isLargeScreen && headerContent}

          <div
            className="relative min-h-0 flex-1 overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+7rem)]"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {/* 顶部渐变阴影（随滚动粘附）*/}
            <div className="fade-mask-to-b pointer-events-none sticky top-0 z-10 h-12 w-full bg-neutral-50 first:border-b-0 dark:bg-neutral-900"></div>

            {shouldShowSearchResults ? (
              <SettingsSearchResults
                query={settingsSearchQuery}
                results={settingsSearchResults}
                paddingClass={masterGroupPaddingClass}
                onSelect={handleSettingsSearchSelect}
              />
            ) : (
              <>
                {/* 帮助与反馈 */}
                <SettingGroup
                  className="-mt-4"
                  paddingClass={masterGroupPaddingClass}
                  items={[
                    {
                      icon: CircleHelp,
                      label: '帮助文档',
                      onClick: () => {
                        window.open(
                          'https://chu3.top/brewguide-help',
                          '_blank'
                        );
                        if (settings.hapticFeedback) {
                          hapticsUtils.light();
                        }
                      },
                    },
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
                        <div className="flex flex-col items-start justify-center pb-3.5 pl-10.5">
                          <div className="overflow-hidden rounded-lg border border-neutral-400/10 bg-white p-2">
                            <Image
                              src="/images/content/group-code.jpg"
                              alt="交流群二维码"
                              width={200}
                              height={200}
                              className="h-auto w-50"
                            />
                          </div>
                          <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
                            群满 200 人哩，加开发者拉你进群吧
                          </p>
                        </div>
                      ),
                    },
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
                        <div className="flex flex-col items-start justify-center pb-3.5 pl-10.5">
                          <div className="overflow-hidden rounded-lg border border-neutral-400/10 bg-white p-2">
                            <Image
                              src="/images/content/appreciation-code.jpg"
                              alt="赞赏码"
                              width={200}
                              height={200}
                              className="h-auto w-50"
                            />
                          </div>
                          <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
                            赞赏码（开发不易，要是能支持一下就太好了 www）
                          </p>
                        </div>
                      ),
                    },
                  ]}
                />

                {/* 显示与界面设置 */}
                <SettingGroup
                  paddingClass={masterGroupPaddingClass}
                  activeSettingId={activeSubSettingId}
                  highlightedSettingId={highlightedHomeSettingId}
                  dimUnselectedItems={shouldDimSubSettingEntries}
                  items={interfaceSettingsItems}
                />
                {settingsFeatureGroups.map(group => (
                  <SettingGroup
                    key={group.id}
                    paddingClass={masterGroupPaddingClass}
                    activeSettingId={activeSubSettingId}
                    highlightedSettingId={highlightedHomeSettingId}
                    dimUnselectedItems={shouldDimSubSettingEntries}
                    items={group.items}
                  />
                ))}

                {/* 数据与备份 */}
                <SettingGroup
                  paddingClass={masterGroupPaddingClass}
                  activeSettingId={activeSubSettingId}
                  highlightedSettingId={highlightedHomeSettingId}
                  dimUnselectedItems={shouldDimSubSettingEntries}
                  items={dataSettingsItems}
                />

                {/* 关于 */}
                <SettingGroup
                  paddingClass={masterGroupPaddingClass}
                  activeSettingId={activeSubSettingId}
                  highlightedSettingId={highlightedHomeSettingId}
                  dimUnselectedItems={shouldDimSubSettingEntries}
                  items={aboutSettingsItems}
                />

                {/* 感谢名单 */}
                <div className="px-8 pt-18 pb-8">
                  <div className="text-left text-xs select-none">
                    <p className="font-medium text-neutral-800 dark:text-neutral-200">
                      感谢各位一直以来的支持，自 2025 年 2 月 1
                      日首次发布至今，项目已持续运行 {runningDays}{' '}
                      天，你们的每一次鼓励与贡献，都是它不断成长的重要动力。
                    </p>
                    <SponsorList />
                  </div>
                </div>
              </>
            )}
          </div>
          <SettingsSearchBar
            query={settingsSearchQuery}
            firstResult={settingsSearchResults[0] ?? null}
            onQueryChange={setSettingsSearchQuery}
            onSelect={handleSettingsSearchSelect}
          />
        </div>
        {isLargeScreen && (
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <AnimatePresence mode="wait" initial={false}>
              {activeSubSettingId ? (
                <motion.div
                  key={activeSubSettingId}
                  className="h-full"
                  initial={
                    shouldReduceMotion
                      ? { opacity: 0 }
                      : { opacity: 0, transform: 'translate3d(12px, 0, 0)' }
                  }
                  animate={
                    shouldReduceMotion
                      ? { opacity: 1 }
                      : { opacity: 1, transform: 'translate3d(0, 0, 0)' }
                  }
                  exit={
                    shouldReduceMotion
                      ? { opacity: 0 }
                      : { opacity: 0, transform: 'translate3d(-8px, 0, 0)' }
                  }
                  transition={{
                    duration: shouldReduceMotion ? 0.12 : 0.2,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  {subSettingsContent}
                </motion.div>
              ) : (
                <motion.div
                  key="settings-empty-detail"
                  className="h-full"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                />
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* 版本更新抽屉 */}
      {updateInfo && (
        <UpdateDrawer
          isOpen={showUpdateDrawer && settings.showUpdatePrompt !== false}
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
    </div>
  );
};

export default Settings;
