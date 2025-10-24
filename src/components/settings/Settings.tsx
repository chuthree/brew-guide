'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { APP_VERSION, sponsorsList } from '@/lib/core/config';
import hapticsUtils from '@/lib/ui/haptics';

import { useTheme } from 'next-themes';
import { LayoutSettings } from '../brewing/Timer/Settings';
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Loader,
  Monitor,
  Archive,
  List,
  CalendarDays,
  Timer,
  Database,
  Bell,
  ClipboardPen,
  Shuffle,
  ArrowUpDown,
  Palette,
  Upload,
  Download,
  ArrowUpDown as ArrowUpDownIcon,
  EyeOff,
} from 'lucide-react';

import Image from 'next/image';
import { getChildPageStyle } from '@/lib/navigation/pageTransition';

// 定义设置选项接口
export interface SettingsOptions {
  notificationSound: boolean;
  hapticFeedback: boolean;
  textZoomLevel: number;
  layoutSettings?: LayoutSettings; // 添加布局设置
  showFlowRate: boolean; // 添加显示流速选项
  username: string; // 添加用户名
  decrementPresets: number[]; // 添加咖啡豆库存快捷扣除量预设值
  enableAllDecrementOption: boolean; // 是否启用ALL扣除选项（扣除剩余库存）
  enableCustomDecrementInput: boolean; // 是否启用用户自定义输入扣除数量
  showOnlyBeanName: boolean; // 是否只显示咖啡豆名称
  dateDisplayMode: 'date' | 'flavorPeriod' | 'agingDays'; // 日期显示模式：日期/赏味期/养豆天数
  showFlavorInfo: boolean; // 是否在备注中显示风味信息
  limitNotesLines: boolean; // 是否限制备注显示行数
  notesMaxLines: number; // 备注最大显示行数
  showTotalPrice: boolean; // 是否显示总价格而不是单价
  showStatusDots: boolean; // 是否显示状态点

  safeAreaMargins?: {
    top: number; // 顶部边距
    bottom: number; // 底部边距
  };
  // 自定义赏味期设置
  customFlavorPeriod?: {
    light: { startDay: number; endDay: number }; // 浅烘焙
    medium: { startDay: number; endDay: number }; // 中烘焙
    dark: { startDay: number; endDay: number }; // 深烘焙
  };
  // 备份提醒设置
  backupReminder?: {
    enabled: boolean;
    interval: string;
    lastBackupDate: string;
    nextBackupDate: string;
  };
  // S3同步设置
  s3Sync?: {
    enabled: boolean;
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    bucketName: string;
    prefix: string;
    endpoint?: string; // 自定义端点，用于七牛云等S3兼容服务
    syncMode: 'manual';
    lastConnectionSuccess?: boolean;
  };
  // 随机咖啡豆设置
  randomCoffeeBeans?: {
    enableLongPressRandomType: boolean; // 长按随机不同类型咖啡豆
    defaultRandomType: 'espresso' | 'filter'; // 默认随机类型（长按时使用）
    flavorPeriodRanges: {
      // 赏味期范围设置
      aging: boolean; // 养豆期
      optimal: boolean; // 赏味期
      decline: boolean; // 衰退期
      frozen: boolean; // 冷冻
      inTransit: boolean; // 在途
      unknown: boolean; // 未知
    };
  };
  // 搜索排序设置
  searchSort?: {
    enabled: boolean; // 是否启用搜索排序功能
    time: boolean; // 是否启用时间排序
    rating: boolean; // 是否启用评分排序
    extractionTime: boolean; // 是否启用萃取时间排序
  };
  // 打印设置
  enableBeanPrint?: boolean; // 是否启用咖啡豆标签保存功能
  // 评分显示设置
  showBeanRating?: boolean; // 是否显示咖啡豆评分区域（默认false，只显示有内容的）
  // 详情页显示设置
  showBeanInfoDivider?: boolean; // 是否显示基础信息和产地信息之间的分割线（默认true）
  // 隐藏的通用方案设置
  hiddenCommonMethods?: {
    [equipmentId: string]: string[]; // 器具ID -> 隐藏的方案ID列表
  };
}

// 默认设置
export const defaultSettings: SettingsOptions = {
  notificationSound: true,
  hapticFeedback: true,
  textZoomLevel: 1.0,
  layoutSettings: {
    stageInfoReversed: false,
    progressBarHeight: 4,
    controlsReversed: false,
    alwaysShowTimerInfo: true, // 默认显示计时器信息
    showStageDivider: true, // 默认显示阶段分隔线
    compactMode: false, // 默认不启用简洁模式
  },
  showFlowRate: false, // 默认不显示流速
  username: '', // 默认用户名为空
  decrementPresets: [15, 16, 18], // 默认的库存扣除量预设值
  enableAllDecrementOption: false, // 默认关闭ALL扣除选项
  enableCustomDecrementInput: true, // 默认启用自定义输入扣除
  showOnlyBeanName: true, // 默认简化咖啡豆名称
  dateDisplayMode: 'date', // 默认显示烘焙日期
  showFlavorInfo: false, // 默认不显示风味信息
  limitNotesLines: true, // 默认限制备注显示行数
  notesMaxLines: 1, // 默认最大显示1行
  showTotalPrice: false, // 默认显示单价
  showStatusDots: true, // 默认显示状态点

  safeAreaMargins: {
    top: 38, // 默认顶部边距 42px
    bottom: 38, // 默认底部边距 42px
  },
  // 默认自定义赏味期设置 - 初始为空，使用预设值
  customFlavorPeriod: {
    light: { startDay: 0, endDay: 0 }, // 0表示使用预设值：养豆7天，赏味期60天
    medium: { startDay: 0, endDay: 0 }, // 0表示使用预设值：养豆10天，赏味期60天
    dark: { startDay: 0, endDay: 0 }, // 0表示使用预设值：养豆14天，赏味期90天
  },
  // 备份提醒设置默认为undefined，将在运行时从BackupReminderUtils加载
  backupReminder: undefined,
  // S3同步设置默认值
  s3Sync: {
    enabled: false,
    accessKeyId: '',
    secretAccessKey: '',
    region: 'cn-south-1',
    bucketName: '',
    prefix: 'brew-guide-data/',
    endpoint: '', // 自定义端点
    syncMode: 'manual',
  },
  // 随机咖啡豆设置默认值
  randomCoffeeBeans: {
    enableLongPressRandomType: false, // 默认不启用长按随机类型
    defaultRandomType: 'espresso', // 默认长按随机意式豆
    flavorPeriodRanges: {
      aging: false, // 默认不包含养豆期
      optimal: true, // 默认包含赏味期
      decline: true, // 默认包含衰退期
      frozen: true, // 默认包含冷冻
      inTransit: false, // 默认不包含在途
      unknown: true, // 默认包含未知状态
    },
  },
  // 搜索排序设置默认值
  searchSort: {
    enabled: false, // 默认启用搜索排序功能
    time: false, // 默认不启用时间排序
    rating: false, // 默认不启用评分排序
    extractionTime: true, // 默认启用萃取时间排序
  },
  // 打印设置默认值
  enableBeanPrint: false, // 默认关闭标签保存功能
  // 评分显示设置默认值
  showBeanRating: false, // 默认不显示评分区域（只显示有内容的）
  // 详情页显示设置默认值
  showBeanInfoDivider: true, // 默认显示基础信息和产地信息之间的分割线
  // 隐藏的通用方案默认值
  hiddenCommonMethods: {}, // 默认没有隐藏的方案
};

// 子设置页面的打开/关闭函数接口
export interface SubSettingsHandlers {
  onOpenDisplaySettings: () => void;
  onOpenStockSettings: () => void;
  onOpenBeanSettings: () => void;
  onOpenFlavorPeriodSettings: () => void;
  onOpenTimerSettings: () => void;
  onOpenDataSettings: () => void;
  onOpenNotificationSettings: () => void;
  onOpenRandomCoffeeBeanSettings: () => void;
  onOpenSearchSortSettings: () => void;
  onOpenFlavorDimensionSettings: () => void;
  onOpenHiddenMethodsSettings: () => void;
}

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SettingsOptions;
  setSettings: (settings: SettingsOptions) => void;
  onDataChange?: () => void;
  subSettingsHandlers: SubSettingsHandlers;
  hasSubSettingsOpen: boolean; // 是否有子设置页面打开
}

const Settings: React.FC<SettingsProps> = ({
  isOpen,
  onClose,
  settings,
  setSettings,
  onDataChange: _onDataChange,
  subSettingsHandlers,
  hasSubSettingsOpen,
}) => {
  // 获取主题相关方法
  const { theme } = useTheme();

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

    // 等待动画完成后再真正关闭
    setTimeout(() => {
      if (window.history.state?.modal === 'settings') {
        window.history.back();
      } else {
        onClose();
      }
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

  // S3同步相关状态（仅用于同步按钮）
  const [s3Status, setS3Status] = useState<
    'disconnected' | 'connecting' | 'connected' | 'error'
  >('disconnected');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSyncNeeded, setIsSyncNeeded] = useState(false);
  const [syncDirection, setSyncDirection] = useState<
    'upload' | 'download' | 'both' | null
  >(null);

  // 通过 DataSettings 组件获取 S3 同步状态
  useEffect(() => {
    const handleS3StatusChange = (event: CustomEvent) => {
      const {
        status,
        syncing,
        needsSync,
        syncDirection: direction,
      } = event.detail;
      setS3Status(status);
      setIsSyncing(syncing);
      setIsSyncNeeded(needsSync);
      setSyncDirection(direction || null);
    };

    // 监听来自 DataSettings 组件的状态更新事件
    window.addEventListener(
      's3StatusChange',
      handleS3StatusChange as EventListener
    );

    return () => {
      window.removeEventListener(
        's3StatusChange',
        handleS3StatusChange as EventListener
      );
    };
  }, []); // 在 Settings 打开时主动检测 S3 同步状态
  useEffect(() => {
    if (!isOpen) return;

    const checkS3Status = async () => {
      try {
        // 动态导入 S3SyncManager
        const S3SyncManager = (await import('@/lib/s3/syncManagerV2')).default;

        // 检查是否已配置并启用 S3 同步
        const s3Config = settings.s3Sync;
        if (
          !s3Config?.enabled ||
          !s3Config.lastConnectionSuccess ||
          !s3Config.accessKeyId ||
          !s3Config.secretAccessKey ||
          !s3Config.bucketName
        ) {
          setS3Status('disconnected');
          return;
        }

        // 尝试初始化连接
        setS3Status('connecting');
        const manager = new S3SyncManager();
        const connected = await manager.initialize({
          region: s3Config.region,
          accessKeyId: s3Config.accessKeyId,
          secretAccessKey: s3Config.secretAccessKey,
          bucketName: s3Config.bucketName,
          prefix: s3Config.prefix,
          endpoint: s3Config.endpoint || undefined,
        });

        if (connected) {
          setS3Status('connected');
          // 检查是否需要同步
          const needsSync = await manager.needsSync();
          setIsSyncNeeded(needsSync);

          // 如果需要同步，尝试获取同步方向
          if (needsSync) {
            try {
              // 获取同步计划来确定方向
              const { SyncPlanner } = await import('@/lib/s3/syncPlanner');
              const { MetadataManager } = await import(
                '@/lib/s3/metadataManager'
              );

              const planner = new SyncPlanner();
              const metadataManager = new MetadataManager(
                manager['client'],
                manager['deviceId']
              );

              // 获取本地、远程和基准元数据
              const localData = await manager['getLocalFilesMetadata']();
              const remoteMetadata = await metadataManager.getRemoteMetadata();
              const baseMetadata = await metadataManager.getLocalMetadata();

              // 计算同步计划
              const plan = planner.calculateSyncPlan(
                localData,
                remoteMetadata,
                baseMetadata
              );

              // 根据计划确定同步方向
              const hasUploads = plan.upload.length > 0;
              const hasDownloads = plan.download.length > 0;

              if (hasUploads && hasDownloads) {
                setSyncDirection('both');
              } else if (hasUploads) {
                setSyncDirection('upload');
              } else if (hasDownloads) {
                setSyncDirection('download');
              } else {
                setSyncDirection(null);
              }
            } catch (error) {
              console.error('无法获取同步方向:', error);
              setSyncDirection(null);
            }
          } else {
            setSyncDirection(null);
          }
        } else {
          setS3Status('error');
        }
      } catch (error) {
        console.error('检测 S3 状态失败:', error);
        setS3Status('error');
      }
    };

    checkS3Status();
  }, [isOpen, settings.s3Sync]);

  // 添加主题颜色更新的 Effect
  useEffect(() => {
    // 确保只在客户端执行
    if (typeof window === 'undefined') return;

    const updateThemeColor = () => {
      const themeColorMeta = document.querySelectorAll(
        'meta[name="theme-color"]'
      );

      // 如果没有找到 meta 标签，创建它们
      if (themeColorMeta.length === 0) {
        const lightMeta = document.createElement('meta');
        lightMeta.name = 'theme-color';
        lightMeta.content = '#fafafa';
        lightMeta.media = '(prefers-color-scheme: light)';
        document.head.appendChild(lightMeta);

        const darkMeta = document.createElement('meta');
        darkMeta.name = 'theme-color';
        darkMeta.content = '#171717';
        darkMeta.media = '(prefers-color-scheme: dark)';
        document.head.appendChild(darkMeta);
      }

      if (theme === 'system') {
        // 对于系统模式，重新创建两个 meta 标签
        themeColorMeta.forEach(meta => meta.remove());

        const lightMeta = document.createElement('meta');
        lightMeta.name = 'theme-color';
        lightMeta.content = '#fafafa';
        lightMeta.media = '(prefers-color-scheme: light)';
        document.head.appendChild(lightMeta);

        const darkMeta = document.createElement('meta');
        darkMeta.name = 'theme-color';
        darkMeta.content = '#171717';
        darkMeta.media = '(prefers-color-scheme: dark)';
        document.head.appendChild(darkMeta);
      } else {
        // 对于明确的主题选择，使用单个 meta 标签
        themeColorMeta.forEach(meta => meta.remove());
        const meta = document.createElement('meta');
        meta.name = 'theme-color';
        meta.content = theme === 'light' ? '#fafafa' : '#171717';
        document.head.appendChild(meta);
      }
    };

    updateThemeColor();

    // 如果是系统模式，添加系统主题变化的监听
    let mediaQuery: MediaQueryList | null = null;
    if (theme === 'system') {
      mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => {
        updateThemeColor();
      };
      mediaQuery.addEventListener('change', handleChange);
      return () => {
        mediaQuery?.removeEventListener('change', handleChange);
      };
    }
  }, [theme]);

  // 历史栈管理 - 支持多层嵌套设置页面
  useEffect(() => {
    if (!isOpen) return;

    // 检查是否已经有设置相关的历史记录
    const hasSettingsHistory =
      window.history.state?.modal?.includes('-settings') ||
      window.history.state?.modal === 'settings';

    if (hasSettingsHistory) {
      // 如果已经有设置历史记录，替换它
      window.history.replaceState({ modal: 'settings' }, '');
    } else {
      // 添加新的历史记录
      window.history.pushState({ modal: 'settings' }, '');
    }

    const handlePopState = (_event: PopStateEvent) => {
      // 子设置页面的状态现在由父组件管理
      // 这里只需要处理主设置页面的关闭
      if (hasSubSettingsOpen) {
        // 如果有子设置页面打开，不关闭主设置，只是重新添加历史记录
        // 实际的子页面关闭由父组件通过监听 popstate 事件处理
        window.history.pushState({ modal: 'settings' }, '');
      } else {
        // 没有子页面打开，关闭主设置
        onClose();
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isOpen, onClose, hasSubSettingsOpen]);

  // 处理设置变更
  const handleChange = async <K extends keyof SettingsOptions>(
    key: K,
    value: SettingsOptions[K]
  ) => {
    // 直接更新设置并保存到存储
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    const { Storage } = await import('@/lib/core/storage');
    await Storage.set('brewGuideSettings', JSON.stringify(newSettings));

    // 触发自定义事件通知其他组件设置已更改
    window.dispatchEvent(
      new CustomEvent('storageChange', {
        detail: { key: 'brewGuideSettings' },
      })
    );
  };

  // 执行同步 - 直接调用 S3SyncManager 的同步功能
  const performSync = useCallback(async () => {
    // 如果 DataSettings 组件已打开，通过事件触发（优先使用 DataSettings 的逻辑）
    if (hasSubSettingsOpen) {
      window.dispatchEvent(new CustomEvent('s3SyncRequested'));
      if (settings.hapticFeedback) {
        hapticsUtils.light();
      }
      return;
    }

    // 如果 DataSettings 未打开，直接在这里执行同步
    if (isSyncing || s3Status !== 'connected') {
      return;
    }

    try {
      setIsSyncing(true);

      // 动态导入 S3SyncManager
      const S3SyncManager = (await import('@/lib/s3/syncManagerV2')).default;

      const s3Config = settings.s3Sync;
      if (!s3Config) return;

      // 初始化管理器
      const manager = new S3SyncManager();
      const connected = await manager.initialize({
        region: s3Config.region,
        accessKeyId: s3Config.accessKeyId,
        secretAccessKey: s3Config.secretAccessKey,
        bucketName: s3Config.bucketName,
        prefix: s3Config.prefix,
        endpoint: s3Config.endpoint || undefined,
      });

      if (!connected) {
        console.error('S3 连接失败');
        return;
      }

      // 执行同步
      const result = await manager.sync({
        preferredDirection: 'auto',
      });

      if (result.success) {
        // 同步完成后，已经是最新状态，不需要显示方向图标
        setIsSyncNeeded(false);
        setSyncDirection(null);

        // 显示同步结果提示
        const { showToast } = await import(
          '@/components/common/feedback/LightToast'
        );

        if (result.uploadedFiles > 0 && result.downloadedFiles > 0) {
          // 双向同步
          showToast({
            type: 'success',
            title: `同步完成：上传 ${result.uploadedFiles} 项，下载 ${result.downloadedFiles} 项，即将重启...`,
            duration: 3000,
          });

          // 双向同步包含下载，刷新页面以加载新数据
          setTimeout(() => {
            window.location.reload();
          }, 3000);
        } else if (result.uploadedFiles > 0) {
          // 仅上传
          showToast({
            type: 'success',
            title: `已上传 ${result.uploadedFiles} 项到云端`,
            duration: 2500,
          });
        } else if (result.downloadedFiles > 0) {
          // 仅下载
          showToast({
            type: 'success',
            title: `已从云端下载 ${result.downloadedFiles} 项，即将重启...`,
            duration: 2500,
          });

          // 下载完成后刷新页面以加载新数据
          setTimeout(() => {
            window.location.reload();
          }, 2500);
        } else {
          // 无变化
          showToast({
            type: 'info',
            title: '数据已是最新，无需同步',
            duration: 2000,
          });
        }

        if (settings.hapticFeedback) {
          hapticsUtils.medium();
        }

        // 触发数据变化事件
        window.dispatchEvent(
          new CustomEvent('storageChange', {
            detail: { key: 'all' },
          })
        );
      } else {
        // 同步失败
        const { showToast } = await import(
          '@/components/common/feedback/LightToast'
        );
        showToast({
          type: 'error',
          title: result.message || '同步失败',
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('同步失败:', error);
      // 显示错误提示
      const { showToast } = await import(
        '@/components/common/feedback/LightToast'
      );
      showToast({
        type: 'error',
        title: `同步失败: ${error instanceof Error ? error.message : '未知错误'}`,
        duration: 3000,
      });
    } finally {
      setIsSyncing(false);
    }
  }, [
    settings.hapticFeedback,
    settings.s3Sync,
    isSyncing,
    s3Status,
    hasSubSettingsOpen,
  ]);

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
      className="fixed inset-0 mx-auto flex max-w-[500px] flex-col bg-neutral-50 dark:bg-neutral-900"
      style={settingsStyle}
    >
      {/* 头部导航栏 */}
      <div className="pt-safe-top relative z-20 flex items-center justify-center py-4">
        <button
          onClick={handleClose}
          className="absolute left-4 flex h-10 w-10 items-center justify-center rounded-full text-neutral-700 dark:text-neutral-300"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="text-md font-medium text-neutral-800 dark:text-neutral-200">
          设置
        </h2>
        {/* 同步按钮 */}
        {s3Status === 'connected' && (
          <button
            onClick={performSync}
            disabled={isSyncing}
            className="absolute right-4 flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 transition-colors hover:bg-neutral-200 active:scale-95 disabled:opacity-50 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
          >
            {isSyncing ? (
              <Loader className="h-5 w-5 animate-spin" />
            ) : syncDirection === 'upload' ? (
              <Upload className="h-5 w-5" />
            ) : syncDirection === 'download' ? (
              <Download className="h-5 w-5" />
            ) : syncDirection === 'both' ? (
              <ArrowUpDownIcon className="h-5 w-5" />
            ) : (
              <RefreshCw className="h-5 w-5" />
            )}
            {isSyncNeeded && !isSyncing && (
              <span className="absolute top-1.5 right-1.5 block h-2.5 w-2.5 rounded-full border-2 border-neutral-100 bg-blue-500 dark:border-neutral-800"></span>
            )}
          </button>
        )}
      </div>

      {/* 滚动内容区域 - 新的简洁设计 */}
      <div className="pb-safe-bottom relative flex-1 divide-y divide-neutral-200 overflow-y-auto dark:divide-neutral-800">
        {/* 顶部渐变阴影（随滚动粘附）*/}
        <div className="pointer-events-none sticky top-0 z-10 h-12 w-full bg-linear-to-b from-neutral-50 to-transparent first:border-b-0 dark:from-neutral-900"></div>
        {/* 赞助支持 */}
        <div className="-mt-4 px-6 py-4">
          <h3 className="mb-3 text-sm font-medium tracking-wider text-neutral-500 uppercase dark:text-neutral-400">
            支持 & 交流
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => {
                if (qrCodeType === 'appreciation') {
                  setQrCodeType(null);
                  setShowQRCodes(false);
                } else {
                  setQrCodeType('appreciation');
                  setShowQRCodes(true);
                }
              }}
              className="flex items-center justify-between rounded bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
            >
              <span>
                {qrCodeType === 'appreciation' ? '收起二维码' : '赞赏码'}
              </span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`ml-2 h-4 w-4 text-neutral-600 transition-transform dark:text-neutral-400 ${qrCodeType === 'appreciation' ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            <button
              onClick={() => {
                if (qrCodeType === 'group') {
                  setQrCodeType(null);
                  setShowQRCodes(false);
                } else {
                  setQrCodeType('group');
                  setShowQRCodes(true);
                }
              }}
              className="flex items-center justify-between rounded bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
            >
              <span>{qrCodeType === 'group' ? '收起二维码' : '交流群'}</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`ml-2 h-4 w-4 text-neutral-600 transition-transform dark:text-neutral-400 ${qrCodeType === 'group' ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          </div>

          {showQRCodes && (
            <div className="mt-4 grid grid-cols-2 gap-4">
              {qrCodeType === 'appreciation' ? (
                <>
                  <div className="flex flex-col items-center">
                    <div className="relative aspect-square w-full overflow-hidden rounded">
                      <Image
                        src="/images/content/appreciation-code.jpg"
                        alt="赞赏码"
                        fill
                        className="object-cover"
                      />
                    </div>
                    <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                      赞赏码（开发不易，要是能支持一下就太好了 www）
                    </p>
                  </div>
                  <div className="flex flex-col items-center opacity-0">
                    <div className="invisible relative aspect-square w-full overflow-hidden rounded">
                      <div className="h-full w-full" />
                    </div>
                    <p className="invisible mt-2 text-xs">占位</p>
                  </div>
                </>
              ) : qrCodeType === 'group' ? (
                <>
                  <div className="flex flex-col items-center opacity-0">
                    <div className="invisible relative aspect-square w-full overflow-hidden rounded">
                      <div className="h-full w-full" />
                    </div>
                    <p className="invisible mt-2 text-xs">占位</p>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="relative aspect-square w-full overflow-hidden rounded">
                      <Image
                        src="https://coffee.chu3.top/images/content/group-code.jpg"
                        alt="交流群"
                        fill
                        className="object-cover"
                      />
                    </div>
                    <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                      交流群（实时更新，随时可用）
                    </p>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </div>

        {/* 个人信息设置组 */}
        <div className="px-6 py-4">
          <div className="space-y-4">
            <div>
              <label
                htmlFor="username"
                className="mb-2 block text-sm font-medium text-neutral-800 dark:text-neutral-200"
              >
                用户名
              </label>
              <input
                type="text"
                id="username"
                value={settings.username}
                onChange={e => handleChange('username', e.target.value)}
                placeholder="请输入您的用户名"
                className="w-full appearance-none rounded bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-900 focus:ring-2 focus:ring-neutral-500 focus:outline-hidden dark:bg-neutral-800 dark:text-neutral-100"
              />
              <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                用于在分享时显示签名
              </p>
            </div>
          </div>
        </div>

        {/* 按钮组 */}
        <div className="space-y-4 px-6 py-4">
          <button
            onClick={subSettingsHandlers.onOpenDisplaySettings}
            className="flex w-full items-center justify-between rounded bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
          >
            <div className="flex items-center space-x-3">
              <Monitor className="h-4 w-4 text-neutral-500" />
              <span>显示设置</span>
            </div>
            <ChevronRight className="h-4 w-4 text-neutral-400" />
          </button>
          <button
            onClick={subSettingsHandlers.onOpenNotificationSettings}
            className="flex w-full items-center justify-between rounded bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
          >
            <div className="flex items-center space-x-3">
              <Bell className="h-4 w-4 text-neutral-500" />
              <span>通知设置</span>
            </div>
            <ChevronRight className="h-4 w-4 text-neutral-400" />
          </button>
        </div>
        <div className="space-y-4 px-6 py-4">
          <button
            onClick={subSettingsHandlers.onOpenTimerSettings}
            className="flex w-full items-center justify-between rounded bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
          >
            <div className="flex items-center space-x-3">
              <Timer className="h-4 w-4 text-neutral-500" />
              <span>计时器设置</span>
            </div>
            <ChevronRight className="h-4 w-4 text-neutral-400" />
          </button>
          <button
            onClick={subSettingsHandlers.onOpenRandomCoffeeBeanSettings}
            className="flex w-full items-center justify-between rounded bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
          >
            <div className="flex items-center space-x-3">
              <Shuffle className="h-4 w-4 text-neutral-500" />
              <span>随机咖啡豆设置</span>
            </div>
            <ChevronRight className="h-4 w-4 text-neutral-400" />
          </button>
          <button
            onClick={subSettingsHandlers.onOpenHiddenMethodsSettings}
            className="flex w-full items-center justify-between rounded bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
          >
            <div className="flex items-center space-x-3">
              <EyeOff className="h-4 w-4 text-neutral-500" />
              <span>隐藏的通用方案</span>
            </div>
            <ChevronRight className="h-4 w-4 text-neutral-400" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-4">
          <button
            onClick={subSettingsHandlers.onOpenBeanSettings}
            className="flex w-full items-center justify-between rounded bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
          >
            <div className="flex items-center space-x-3">
              <List className="h-4 w-4 text-neutral-500" />
              <span>豆仓设置</span>
            </div>
            <ChevronRight className="h-4 w-4 text-neutral-400" />
          </button>

          <button
            onClick={subSettingsHandlers.onOpenStockSettings}
            className="flex w-full items-center justify-between rounded bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
          >
            <div className="flex items-center space-x-3">
              <Archive className="h-4 w-4 text-neutral-500" />
              <span>扣除设置</span>
            </div>
            <ChevronRight className="h-4 w-4 text-neutral-400" />
          </button>

          <button
            onClick={subSettingsHandlers.onOpenFlavorPeriodSettings}
            className="flex w-full items-center justify-between rounded bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
          >
            <div className="flex items-center space-x-3">
              <CalendarDays className="h-4 w-4 text-neutral-500" />
              <span>赏味期设置</span>
            </div>
            <ChevronRight className="h-4 w-4 text-neutral-400" />
          </button>
        </div>

        {/* 笔记相关设置 */}
        <div className="space-y-4 px-6 py-4">
          <button
            onClick={subSettingsHandlers.onOpenSearchSortSettings}
            className="flex w-full items-center justify-between rounded bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
          >
            <div className="flex items-center space-x-3">
              <ArrowUpDown className="h-4 w-4 text-neutral-500" />
              <span>搜索排序设置</span>
            </div>
            <ChevronRight className="h-4 w-4 text-neutral-400" />
          </button>

          <button
            onClick={subSettingsHandlers.onOpenFlavorDimensionSettings}
            className="flex w-full items-center justify-between rounded bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
          >
            <div className="flex items-center space-x-3">
              <Palette className="h-4 w-4 text-neutral-500" />
              <span>风味维度设置</span>
            </div>
            <ChevronRight className="h-4 w-4 text-neutral-400" />
          </button>
        </div>

        {/* 数据管理入口按钮 */}
        <div className="px-6 py-4">
          <button
            onClick={subSettingsHandlers.onOpenDataSettings}
            className="flex w-full items-center justify-between rounded bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
          >
            <div className="flex items-center space-x-3">
              <Database className="h-4 w-4 text-neutral-500" />
              <span>数据管理</span>
            </div>
            <ChevronRight className="h-4 w-4 text-neutral-400" />
          </button>
        </div>

        {/* 意见反馈组 */}
        <div className="px-6 py-4">
          <button
            onClick={() => {
              window.open('https://wj.qq.com/s2/19403076/7f02/', '_blank');
              if (settings.hapticFeedback) {
                hapticsUtils.light();
              }
            }}
            className="flex w-full items-center justify-between rounded bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
          >
            <div className="flex items-center space-x-3">
              <ClipboardPen className="h-4 w-4 text-neutral-500" />
              <span>提交反馈</span>
            </div>
            <ChevronRight className="h-4 w-4 text-neutral-400" />
          </button>
        </div>

        {/* 版本信息 */}
        <div className="px-6 pt-12 text-center text-xs text-neutral-400 dark:text-neutral-600">
          <p>[版本号]</p>
          <p>v{APP_VERSION}</p>

          <p className="mt-12">[感谢]</p>

          <p>感谢以下赞助者的支持</p>
          <p className="mx-auto mt-4 max-w-48 text-left leading-relaxed">
            {sponsorsList
              .sort((a, b) => {
                const isAEnglish = /^[A-Za-z0-9\s:]+$/.test(a.charAt(0));
                const isBEnglish = /^[A-Za-z0-9\s:]+$/.test(b.charAt(0));

                if (isAEnglish && !isBEnglish) return -1;
                if (!isAEnglish && isBEnglish) return 1;
                return a.localeCompare(b, 'zh-CN');
              })
              .join('、')}
            、and You
          </p>
          <p className="mt-12">
            <a
              href="https://github.com/chu3/brew-guide"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              GitHub
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Settings;
