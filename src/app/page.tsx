'use client';

// 导入React和必要的hooks
import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import dynamic from 'next/dynamic';
import {
  equipmentList,
  APP_VERSION,
  commonMethods,
  CustomEquipment,
  type Method,
  type BrewingNote,
} from '@/lib/core/config';
import { initCapacitor } from '@/lib/app/capacitor';
// 只导入需要的类型
import type { CoffeeBean } from '@/types/app';
import {
  useBrewingState,
  MainTabType,
  BrewingStep,
  Step,
} from '@/lib/hooks/useBrewingState';
import { useBrewingParameters } from '@/lib/hooks/useBrewingParameters';
import { useBrewingContent } from '@/lib/hooks/useBrewingContent';
import { useMethodSelector } from '@/lib/hooks/useMethodSelector';
import { EditableParams } from '@/lib/hooks/useBrewingParameters';
import { MethodType, MethodStepConfig } from '@/lib/types/method';
import CustomMethodFormModal from '@/components/method/forms/CustomMethodFormModal';
import NavigationBar from '@/components/layout/NavigationBar';
import Settings, {
  SettingsOptions,
  defaultSettings,
} from '@/components/settings/Settings';
import DisplaySettings from '@/components/settings/DisplaySettings';
import StockSettings from '@/components/settings/StockSettings';
import BeanSettings from '@/components/settings/BeanSettings';
import FlavorPeriodSettings from '@/components/settings/FlavorPeriodSettings';
import TimerSettings from '@/components/settings/TimerSettings';
import DataSettings from '@/components/settings/DataSettings';
import NotificationSettings from '@/components/settings/NotificationSettings';
import RandomCoffeeBeanSettings from '@/components/settings/RandomCoffeeBeanSettings';
import SearchSortSettings from '@/components/settings/SearchSortSettings';
import FlavorDimensionSettings from '@/components/settings/FlavorDimensionSettings';
import HiddenMethodsSettings from '@/components/settings/HiddenMethodsSettings';
import HiddenEquipmentsSettings from '@/components/settings/HiddenEquipmentsSettings';
import RoasterLogoSettings from '@/components/settings/RoasterLogoSettings';
import GrinderSettings from '@/components/settings/GrinderSettings';
import TabContent from '@/components/layout/TabContent';
import MethodTypeSelector from '@/components/method/forms/MethodTypeSelector';
import Onboarding from '@/components/onboarding/Onboarding';
import CoffeeBeanFormModal from '@/components/coffee-bean/Form/Modal';
import ImportModal from '@/components/common/modals/BeanImportModal';
import fontZoomUtils from '@/lib/utils/fontZoomUtils';
import { saveMainTabPreference } from '@/lib/navigation/navigationCache';
import {
  ViewOption,
  VIEW_OPTIONS,
  VIEW_LABELS,
  SIMPLIFIED_VIEW_LABELS,
} from '@/components/coffee-bean/List/constants';
import { getStringState, saveStringState } from '@/lib/core/statePersistence';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronsUpDown } from 'lucide-react';
import hapticsUtils from '@/lib/ui/haptics';
import { BREWING_EVENTS } from '@/lib/brewing/constants';
import type { BrewingNoteData } from '@/types/app';
import { updateParameterInfo } from '@/lib/brewing/parameters';
import BrewingNoteFormModal from '@/components/notes/Form/BrewingNoteFormModal';
import CoffeeBeans from '@/components/coffee-bean/List';
import {
  loadCustomEquipments,
  saveCustomEquipment,
  deleteCustomEquipment,
} from '@/lib/managers/customEquipments';
import CustomEquipmentFormModal from '@/components/equipment/forms/CustomEquipmentFormModal';
import EquipmentImportModal from '@/components/equipment/import/EquipmentImportModal';
import EquipmentManagementDrawer from '@/components/equipment/EquipmentManagementDrawer';
import DataMigrationModal from '@/components/common/modals/DataMigrationModal';
import { showToast } from '@/components/common/feedback/LightToast';
import BackupReminderModal from '@/components/common/modals/BackupReminderModal';
import {
  BackupReminderUtils,
  BackupReminderType,
} from '@/lib/utils/backupReminderUtils';
import {
  getEquipmentNameById,
  getEquipmentById,
} from '@/lib/utils/equipmentUtils';
import {
  pageStackManager,
  getParentPageStyle,
} from '@/lib/navigation/pageTransition';
import BeanDetailModal from '@/components/coffee-bean/Detail/BeanDetailModal';
import BrewingNoteEditModal from '@/components/notes/Form/BrewingNoteEditModal';
import NoteDetailModal from '@/components/notes/Detail/NoteDetailModal';
import ImageViewer from '@/components/common/ui/ImageViewer';
import NavigationSettings from '@/components/settings/NavigationSettings';

// 为Window对象声明类型扩展
declare global {
  interface Window {
    refreshBrewingNotes?: () => void;
  }
}

// 扩展Step类型，添加方案相关字段
interface ExtendedStep extends Step {
  explicitMethodType?: MethodType;
  customParams?: Record<string, string>;
}

interface BlendComponent {
  percentage?: number;
  origin?: string;
  process?: string;
  variety?: string;
}

interface ExtendedCoffeeBean extends CoffeeBean {
  blendComponents?: BlendComponent[];
}

// 动态导入客户端组件
const BrewingTimer = dynamic(
  () => import('@/components/brewing/BrewingTimer'),
  { ssr: false, loading: () => null }
);
const BrewingHistory = dynamic(() => import('@/components/notes/List'), {
  ssr: false,
  loading: () => null,
});

const AppLoader = ({
  onInitialized,
}: {
  onInitialized: (params: { hasBeans: boolean }) => void;
}) => {
  useEffect(() => {
    const loadInitialData = async () => {
      // 确保只在客户端执行
      if (typeof window === 'undefined') {
        onInitialized({ hasBeans: false });
        return;
      }

      try {
        // 动态导入所有需要的模块
        const [{ Storage }, { CoffeeBeanManager }] = await Promise.all([
          import('@/lib/core/storage'),
          import('@/lib/managers/coffeeBeanManager'),
        ]);

        // 检查咖啡豆状态
        const beans = await CoffeeBeanManager.getAllBeans();
        const hasBeans = beans.length > 0;

        // 初始化版本和storage
        try {
          const storageVersion = await Storage.get('brewingNotesVersion');
          if (!storageVersion) {
            await Storage.set('brewingNotesVersion', APP_VERSION);
          }

          // 确保brewingNotes存在且格式正确
          const notes = await Storage.get('brewingNotes');
          if (notes && typeof notes === 'string') {
            try {
              const parsed = JSON.parse(notes);
              if (!Array.isArray(parsed)) {
                await Storage.set('brewingNotes', '[]');
              }
            } catch {
              await Storage.set('brewingNotes', '[]');
            }
          } else {
            await Storage.set('brewingNotes', '[]');
          }
        } catch {
          // 静默处理错误
        }

        // 通知初始化完成，传递咖啡豆状态
        onInitialized({ hasBeans });
      } catch {
        // 出错时假定没有咖啡豆
        onInitialized({ hasBeans: false });
      }
    };

    loadInitialData();
  }, [onInitialized]);

  // 加载过程中不显示任何内容
  return null;
};

const AppContainer = () => {
  const [isAppReady, setIsAppReady] = useState(false);
  const [initialHasBeans, setInitialHasBeans] = useState<boolean | null>(null);

  const handleInitialized = useCallback(
    ({ hasBeans }: { hasBeans: boolean }) => {
      setInitialHasBeans(hasBeans);
      setIsAppReady(true);
    },
    []
  );

  // 如果应用未准备好，显示加载器
  if (!isAppReady || initialHasBeans === null) {
    return <AppLoader onInitialized={handleInitialized} />;
  }

  // 应用准备好后，渲染主组件，传入初始咖啡豆状态
  return <PourOverRecipes initialHasBeans={initialHasBeans} />;
};

const PourOverRecipes = ({ initialHasBeans }: { initialHasBeans: boolean }) => {
  // 使用设置相关状态
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // 子设置页面的状态
  const [showDisplaySettings, setShowDisplaySettings] = useState(false);
  const [showNavigationSettings, setShowNavigationSettings] = useState(false);
  const [showStockSettings, setShowStockSettings] = useState(false);
  const [showBeanSettings, setShowBeanSettings] = useState(false);
  const [showFlavorPeriodSettings, setShowFlavorPeriodSettings] =
    useState(false);
  const [showTimerSettings, setShowTimerSettings] = useState(false);
  const [showDataSettings, setShowDataSettings] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] =
    useState(false);
  const [showRandomCoffeeBeanSettings, setShowRandomCoffeeBeanSettings] =
    useState(false);
  const [showSearchSortSettings, setShowSearchSortSettings] = useState(false);
  const [showFlavorDimensionSettings, setShowFlavorDimensionSettings] =
    useState(false);
  const [showHiddenMethodsSettings, setShowHiddenMethodsSettings] =
    useState(false);
  const [showHiddenEquipmentsSettings, setShowHiddenEquipmentsSettings] =
    useState(false);
  const [showRoasterLogoSettings, setShowRoasterLogoSettings] = useState(false);
  const [showGrinderSettings, setShowGrinderSettings] = useState(false);

  // 计算是否有任何子设置页面打开
  const hasSubSettingsOpen =
    showDisplaySettings ||
    showNavigationSettings ||
    showStockSettings ||
    showBeanSettings ||
    showFlavorPeriodSettings ||
    showTimerSettings ||
    showDataSettings ||
    showNotificationSettings ||
    showRandomCoffeeBeanSettings ||
    showSearchSortSettings ||
    showFlavorDimensionSettings ||
    showHiddenMethodsSettings ||
    showHiddenEquipmentsSettings ||
    showRoasterLogoSettings ||
    showGrinderSettings;

  const [settings, setSettings] = useState<SettingsOptions>(() => {
    // 使用默认设置作为初始值，稍后在 useEffect 中异步加载
    return defaultSettings;
  });

  // 初始化加载设置
  useEffect(() => {
    let isMounted = true;

    const loadSettings = async () => {
      try {
        const { Storage } = await import('@/lib/core/storage');
        const savedSettings = await Storage.get('brewGuideSettings');

        if (savedSettings && typeof savedSettings === 'string' && isMounted) {
          try {
            let parsedSettings = JSON.parse(savedSettings) as Record<
              string,
              unknown
            >;

            // 检查是否是 Zustand persist 格式，如果是则解包
            if (
              parsedSettings.state &&
              typeof parsedSettings.state === 'object' &&
              (parsedSettings.state as any).settings
            ) {
              parsedSettings = (parsedSettings.state as any).settings;
            }

            // 迁移旧的showFlavorPeriod设置到新的dateDisplayMode
            if (
              parsedSettings.showFlavorPeriod !== undefined &&
              parsedSettings.dateDisplayMode === undefined
            ) {
              parsedSettings.dateDisplayMode = parsedSettings.showFlavorPeriod
                ? 'flavorPeriod'
                : 'date';
              delete parsedSettings.showFlavorPeriod;

              // 保存迁移后的设置
              try {
                await Storage.set(
                  'brewGuideSettings',
                  JSON.stringify(parsedSettings)
                );
              } catch {
                // 静默处理保存错误
              }
            }

            setSettings(parsedSettings as unknown as SettingsOptions);

            // 应用字体缩放级别
            if (
              parsedSettings.textZoomLevel &&
              typeof parsedSettings.textZoomLevel === 'number'
            ) {
              fontZoomUtils.set(parsedSettings.textZoomLevel);
            }
          } catch {
            // JSON解析失败，使用默认设置
          }
        }
      } catch {
        // 静默处理错误
      }
    };

    loadSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  // 咖啡豆表单状态
  const [showBeanForm, setShowBeanForm] = useState(false);
  const [editingBean, setEditingBean] = useState<ExtendedCoffeeBean | null>(
    null
  );
  const [beanListKey, setBeanListKey] = useState(0);
  const [showImportBeanForm, setShowImportBeanForm] = useState(false);

  // 咖啡豆详情状态
  const [beanDetailOpen, setBeanDetailOpen] = useState(false);
  const [beanDetailData, setBeanDetailData] =
    useState<ExtendedCoffeeBean | null>(null);
  const [beanDetailSearchQuery, setBeanDetailSearchQuery] = useState('');

  // 笔记编辑模态框状态
  const [brewingNoteEditOpen, setBrewingNoteEditOpen] = useState(false);
  const [brewingNoteEditData, setBrewingNoteEditData] =
    useState<BrewingNoteData | null>(null);
  const [isBrewingNoteCopy, setIsBrewingNoteCopy] = useState(false); // 标记是否是复制操作

  // 笔记详情状态
  const [noteDetailOpen, setNoteDetailOpen] = useState(false);
  const [noteDetailData, setNoteDetailData] = useState<{
    note: BrewingNote;
    equipmentName: string;
    beanUnitPrice: number;
    beanInfo?: CoffeeBean | null;
  } | null>(null);

  // ImageViewer 状态
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [imageViewerData, setImageViewerData] = useState<{
    url: string;
    alt: string;
  } | null>(null);

  // 计算是否有任何模态框打开（Settings、子设置、咖啡豆详情、添加咖啡豆、笔记详情 或 笔记编辑）
  // 注意：咖啡豆表单是抽屉式组件，不需要触发主页面转场动画
  const hasAnyModalOpen =
    isSettingsOpen ||
    hasSubSettingsOpen ||
    beanDetailOpen ||
    showImportBeanForm ||
    brewingNoteEditOpen ||
    noteDetailOpen;

  // 统一管理 pageStackManager 的状态
  React.useEffect(() => {
    pageStackManager.setModalOpen(hasAnyModalOpen);
  }, [hasAnyModalOpen]);

  // 自动跳转到笔记的状态
  const [hasAutoNavigatedToNotes, setHasAutoNavigatedToNotes] = useState(false);

  const initialStep: BrewingStep = initialHasBeans ? 'coffeeBean' : 'method';
  const [isStageWaiting, setIsStageWaiting] = useState(false);
  const brewingState = useBrewingState(initialStep);
  const {
    activeMainTab,
    setActiveMainTab,
    activeBrewingStep,
    setActiveBrewingStep,
    activeTab,
    setActiveTab,
    selectedEquipment,
    selectedMethod,
    setSelectedMethod,
    currentBrewingMethod,
    setCurrentBrewingMethod,
    isTimerRunning,
    setIsTimerRunning,
    currentStage,
    setCurrentStage,
    showHistory,
    setShowHistory,
    showComplete,
    setShowComplete,
    methodType,
    setMethodType,
    countdownTime,
    setCountdownTime,
    customMethods,
    setCustomMethods,
    selectedCoffeeBean,
    selectedCoffeeBeanData,
    setSelectedCoffeeBean,
    setSelectedCoffeeBeanData,
    showCustomForm,
    setShowCustomForm,
    editingMethod,
    setEditingMethod,
    actionMenuStates,
    setActionMenuStates,
    showImportForm,
    setShowImportForm,

    prevMainTabRef,
    resetBrewingState,
    handleEquipmentSelect,
    handleCoffeeBeanSelect,
    handleSaveCustomMethod,
    handleEditCustomMethod,
    handleDeleteCustomMethod,
    handleHideMethod,
    navigateToStep,
  } = brewingState;

  const parameterHooks = useBrewingParameters();
  const {
    parameterInfo,
    setParameterInfo,
    editableParams,
    setEditableParams,
    handleParamChange,
  } = parameterHooks;

  const [customEquipments, setCustomEquipments] = useState<CustomEquipment[]>(
    []
  );
  const [showEquipmentForm, setShowEquipmentForm] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<
    CustomEquipment | undefined
  >(undefined);
  const [showEquipmentImportForm, setShowEquipmentImportForm] = useState(false);
  const [showEquipmentManagement, setShowEquipmentManagement] = useState(false);
  const [showDataMigration, setShowDataMigration] = useState(false);
  const [migrationData, setMigrationData] = useState<{
    legacyCount: number;
    totalCount: number;
  } | null>(null);

  // 备份提醒状态
  const [showBackupReminder, setShowBackupReminder] = useState(false);
  const [reminderType, setReminderType] = useState<BackupReminderType | null>(
    null
  );

  // 加载自定义器具
  useEffect(() => {
    const loadEquipments = async () => {
      try {
        const equipments = await loadCustomEquipments();
        setCustomEquipments(equipments);
      } catch (error) {
        // Log error in development only
        if (process.env.NODE_ENV === 'development') {
          console.error('加载自定义器具失败:', error);
        }
      }
    };

    const handleEquipmentUpdate = () => {
      loadEquipments();
    };

    const handleStorageChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (
        customEvent.detail?.key === 'allData' ||
        customEvent.detail?.key === 'customEquipments'
      ) {
        loadEquipments();
      }
    };

    loadEquipments();

    window.addEventListener('customEquipmentUpdate', handleEquipmentUpdate);
    window.addEventListener('storage:changed', handleStorageChange);

    return () => {
      window.removeEventListener(
        'customEquipmentUpdate',
        handleEquipmentUpdate
      );
      window.removeEventListener('storage:changed', handleStorageChange);
    };
  }, []);

  const contentHooks = useBrewingContent({
    selectedEquipment,
    methodType,
    customMethods,
    selectedMethod,
    settings,
    customEquipments,
  });

  const { content, updateBrewingSteps } = contentHooks;

  const methodSelector = useMethodSelector({
    selectedEquipment,
    customMethods,
    setSelectedMethod,
    setCurrentBrewingMethod,
    setEditableParams,
    setParameterInfo,
    setActiveTab,
    setActiveBrewingStep,
    updateBrewingSteps,
  });

  const { handleMethodSelect } = methodSelector;

  useEffect(() => {
    let isMounted = true;

    const initializeApp = async () => {
      try {
        // 初始化应用...

        // 继续原有初始化流程
        // 检查coffee beans而不是直接调用不存在的函数
        let hasCoffeeBeans = initialHasBeans;
        try {
          const { Storage } = await import('@/lib/core/storage');
          const beansStr = await Storage.get('coffeeBeans');
          if (beansStr && typeof beansStr === 'string') {
            try {
              const beans = JSON.parse(beansStr);
              hasCoffeeBeans = Array.isArray(beans) && beans.length > 0;
            } catch {
              hasCoffeeBeans = false;
            }
          }
        } catch (error) {
          // Log error in development only
          if (process.env.NODE_ENV === 'development') {
            console.error('检查咖啡豆失败:', error);
          }
        }
        setHasCoffeeBeans(hasCoffeeBeans);

        // 0. 检测数据迁移需求和自动修复
        try {
          // 导入数据管理工具
          const { DataManager } = await import('@/lib/core/dataManager');

          // 检查是否需要数据迁移
          const migrationSkippedThisSession = sessionStorage.getItem(
            'dataMigrationSkippedThisSession'
          );
          if (migrationSkippedThisSession !== 'true') {
            const legacyDetection = await DataManager.detectLegacyBeanData();
            if (legacyDetection.hasLegacyData && isMounted) {
              setMigrationData({
                legacyCount: legacyDetection.legacyCount,
                totalCount: legacyDetection.totalCount,
              });
              setShowDataMigration(true);
            }
          }

          // 自动修复拼配豆数据
          const fixResult = await DataManager.fixBlendBeansData();
          if (fixResult.fixedCount > 0) {
            // 自动修复了拼配豆数据
          }
        } catch (error) {
          // Log error in development only
          if (process.env.NODE_ENV === 'development') {
            console.error('数据检测和修复时出错:', error);
          }
          // 继续初始化，不阻止应用启动
        }

        // 1. 应用字体缩放（如果设置中有值，确保同步）
        // 注意：初始值已在 layout.tsx 的 head 脚本中同步应用，避免闪烁
        if (settings.textZoomLevel && settings.textZoomLevel !== 1.0) {
          fontZoomUtils.set(settings.textZoomLevel);
        }

        // 2. 检查是否首次使用
        try {
          const { Storage } = await import('@/lib/core/storage');
          const onboardingCompleted = await Storage.get('onboardingCompleted');
          if (isMounted) {
            setShowOnboarding(!onboardingCompleted);
          }
        } catch {
          // 静默处理错误
        }

        // 3. 初始化 Capacitor
        initCapacitor();

        // 4. 初始化备份提醒
        try {
          await BackupReminderUtils.initializeFirstUse();
        } catch {
          // 静默处理错误
        }
      } catch {
        // 静默处理错误
      }
    };

    // 立即执行初始化
    initializeApp();

    // 清理函数
    return () => {
      isMounted = false;
    };
  }, [initialHasBeans]);

  // 检查备份提醒
  useEffect(() => {
    const checkBackupReminder = async () => {
      try {
        const shouldShow = await BackupReminderUtils.shouldShowReminder();
        if (shouldShow) {
          const currentReminderType =
            await BackupReminderUtils.getReminderType();
          setReminderType(currentReminderType);
          setShowBackupReminder(true);
        }
      } catch (error) {
        console.error('检查备份提醒失败:', error);
      }
    };

    // 延迟检查，确保应用完全加载
    const timer = setTimeout(checkBackupReminder, 3000);
    return () => clearTimeout(timer);
  }, []);

  // 监听设置变化事件，重新加载设置以更新界面
  useEffect(() => {
    const handleSettingsChanged = async () => {
      try {
        const { Storage } = await import('@/lib/core/storage');
        const savedSettings = await Storage.get('brewGuideSettings');
        if (savedSettings && typeof savedSettings === 'string') {
          const parsedSettings = JSON.parse(savedSettings) as SettingsOptions;
          setSettings(parsedSettings);
        }
      } catch (error) {
        console.error('重新加载设置失败:', error);
      }
    };

    const handleStorageChanged = async (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.key === 'brewGuideSettings') {
        try {
          const { Storage } = await import('@/lib/core/storage');
          const savedSettings = await Storage.get('brewGuideSettings');
          if (savedSettings && typeof savedSettings === 'string') {
            const parsedSettings = JSON.parse(savedSettings) as SettingsOptions;
            setSettings(parsedSettings);
          }
        } catch (error) {
          console.error('重新加载设置失败:', error);
        }
      }
    };

    window.addEventListener('settingsChanged', handleSettingsChanged);
    window.addEventListener('storageChange', handleStorageChanged);
    return () => {
      window.removeEventListener('settingsChanged', handleSettingsChanged);
      window.removeEventListener('storageChange', handleStorageChanged);
    };
  }, []);

  // 监听 ImageViewer 打开事件
  useEffect(() => {
    const handleImageViewerOpen = (
      e: CustomEvent<{ url: string; alt: string }>
    ) => {
      setImageViewerData({ url: e.detail.url, alt: e.detail.alt });
      setImageViewerOpen(true);
    };

    window.addEventListener(
      'imageViewerOpen',
      handleImageViewerOpen as EventListener
    );
    return () =>
      window.removeEventListener(
        'imageViewerOpen',
        handleImageViewerOpen as EventListener
      );
  }, []);

  const [hasCoffeeBeans, setHasCoffeeBeans] = useState(initialHasBeans);

  const [currentBeanView, setCurrentBeanView] = useState<ViewOption>(() => {
    try {
      const savedView = getStringState(
        'coffee-beans',
        'viewMode',
        VIEW_OPTIONS.INVENTORY
      );
      return savedView as ViewOption;
    } catch {
      return VIEW_OPTIONS.INVENTORY;
    }
  });

  // 监听视图固定事件，当固定当前视图时自动切换到其他可用视图
  useEffect(() => {
    const handleViewPinned = (e: Event) => {
      const customEvent = e as CustomEvent<{ pinnedView: ViewOption }>;
      const pinnedView = customEvent.detail.pinnedView;

      // 如果固定的是当前正在查看的视图
      if (pinnedView === currentBeanView) {
        // 获取最新的导航设置
        const { navigationSettings } = settings;
        const pinnedViews = navigationSettings?.pinnedViews || [];
        const coffeeBeanViews = navigationSettings?.coffeeBeanViews || {
          [VIEW_OPTIONS.INVENTORY]: true,
          [VIEW_OPTIONS.RANKING]: true,
          [VIEW_OPTIONS.BLOGGER]: true,
          [VIEW_OPTIONS.STATS]: true,
        };

        // 查找第一个未被固定且启用的视图
        const availableView = Object.values(VIEW_OPTIONS).find(view => {
          // 排除刚刚被固定的视图
          if ([...pinnedViews, pinnedView].includes(view)) return false;
          // 必须是启用的视图
          return coffeeBeanViews[view] !== false;
        });

        // 如果找到可用视图，切换过去
        if (availableView) {
          setCurrentBeanView(availableView);
          saveStringState('coffee-beans', 'viewMode', availableView);
        }
      }
    };

    window.addEventListener('viewPinned', handleViewPinned as EventListener);
    return () => {
      window.removeEventListener(
        'viewPinned',
        handleViewPinned as EventListener
      );
    };
  }, [currentBeanView, settings]);

  // 视图下拉菜单状态
  const [showViewDropdown, setShowViewDropdown] = useState(false);

  // 咖啡豆按钮位置状态
  const [beanButtonPosition, setBeanButtonPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  // 获取咖啡豆按钮位置
  const updateBeanButtonPosition = useCallback(() => {
    const beanButton = (window as unknown as { beanButtonRef?: HTMLElement })
      .beanButtonRef;
    if (beanButton) {
      const rect = beanButton.getBoundingClientRect();
      setBeanButtonPosition({
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  }, []);

  // 监听窗口大小变化和滚动，以及下拉菜单状态变化
  useEffect(() => {
    if (showViewDropdown) {
      // 立即更新位置
      updateBeanButtonPosition();

      const handleResize = () => updateBeanButtonPosition();
      const handleScroll = () => updateBeanButtonPosition();

      window.addEventListener('resize', handleResize);
      window.addEventListener('scroll', handleScroll);

      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('scroll', handleScroll);
      };
    } else {
      // 下拉菜单关闭时清除位置信息
      setBeanButtonPosition(null);
    }
  }, [showViewDropdown, updateBeanButtonPosition]);

  // 在下拉菜单即将显示时预先获取位置
  const handleToggleViewDropdown = useCallback(() => {
    if (!showViewDropdown) {
      // 在显示下拉菜单之前先获取位置
      updateBeanButtonPosition();
    }
    setShowViewDropdown(!showViewDropdown);
  }, [showViewDropdown, updateBeanButtonPosition]);

  // 处理咖啡豆视图切换
  const handleBeanViewChange = (view: ViewOption) => {
    setCurrentBeanView(view);
    // 保存到本地存储
    saveStringState('coffee-beans', 'viewMode', view);
    // 关闭下拉菜单
    setShowViewDropdown(false);
    // 触感反馈
    if (settings.hapticFeedback) {
      hapticsUtils.light();
    }
  };

  // 点击外部关闭视图下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showViewDropdown) {
        const target = event.target as Element;
        // 检查点击是否在视图选择区域外
        if (!target.closest('[data-view-selector]')) {
          setShowViewDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showViewDropdown]);

  const handleParamChangeWrapper = async (
    type: keyof EditableParams,
    value: string
  ) => {
    // 🎯 如果在笔记步骤，直接通过事件通知 BrewingNoteForm 更新参数
    // 不触发全局的参数更新流程，避免 brewing:paramsUpdated 事件导致数据覆盖
    if (activeBrewingStep === 'notes') {
      const event = new CustomEvent('brewing:updateNoteParams', {
        detail: {
          type,
          value,
        },
      });
      window.dispatchEvent(event);

      // 🎯 同时触发导航栏显示更新事件，更新UI显示
      const displayEvent = new CustomEvent('brewing:updateNavbarDisplay', {
        detail: {
          type,
          value,
        },
      });
      window.dispatchEvent(displayEvent);
      return;
    }

    // 其他步骤正常处理参数更新
    await handleParamChange(
      type,
      value,
      selectedMethod,
      currentBrewingMethod,
      updateBrewingSteps,
      setCurrentBrewingMethod,
      selectedCoffeeBean
    );
  };

  const handleExtractionTimeChange = (time: number) => {
    // 优先使用 currentBrewingMethod，因为它包含了用户已修改的其他参数（如粉量、液重）
    // 如果只使用 selectedMethod，会丢失这些修改，导致参数重置
    const baseMethod =
      activeBrewingStep === 'brewing' && currentBrewingMethod
        ? currentBrewingMethod
        : selectedMethod;

    if (!baseMethod || !baseMethod.params.stages) return;

    // 只处理意式咖啡，查找萃取步骤
    const isEspresso = baseMethod.params.stages.some(
      stage => stage.pourType === 'extraction' || stage.pourType === 'beverage'
    );

    if (!isEspresso) return;

    // 创建新的方法对象
    const updatedMethod = {
      ...baseMethod,
      params: {
        ...baseMethod.params,
        stages: baseMethod.params.stages.map(stage => {
          // 只更新萃取类型的步骤时间
          if (stage.pourType === 'extraction') {
            return { ...stage, time };
          }
          return stage;
        }),
      },
    };

    // 更新方法
    setSelectedMethod(updatedMethod);

    // 如果在冲煮步骤，同步更新当前冲煮方法
    if (activeBrewingStep === 'brewing') {
      setCurrentBrewingMethod(updatedMethod);
    }
  };

  // 简化的主标签切换处理
  useEffect(() => {
    // 只在从其他标签切换到冲煮标签时处理
    if (activeMainTab !== '冲煮' || prevMainTabRef.current === '冲煮') {
      prevMainTabRef.current = activeMainTab;
      return;
    }

    // 隐藏历史记录
    setShowHistory(false);

    // 检查特殊跳转标记
    const fromNotesToBrewing = localStorage.getItem('fromNotesToBrewing');
    if (fromNotesToBrewing === 'true') {
      localStorage.removeItem('fromNotesToBrewing');
      prevMainTabRef.current = activeMainTab;
      return;
    }

    // 检查是否应该从咖啡豆步骤开始（仅限特定场景）
    const shouldStartFromCoffeeBeanStep = localStorage.getItem(
      'shouldStartFromCoffeeBeanStep'
    );
    if (shouldStartFromCoffeeBeanStep === 'true' && hasCoffeeBeans) {
      localStorage.removeItem('shouldStartFromCoffeeBeanStep');
      resetBrewingState(false);
      navigateToStep('coffeeBean');
      prevMainTabRef.current = activeMainTab;
      return;
    }

    // 只有从其他标签切换过来时才重置到初始步骤
    // 添加检查：如果当前已经在有效的冲煮步骤中，不强制重置
    const isValidBrewingStep = [
      'coffeeBean',
      'method',
      'brewing',
      'notes',
    ].includes(activeBrewingStep);
    if (isValidBrewingStep && prevMainTabRef.current !== null) {
      // 如果已经在有效的冲煮步骤中，只更新引用，不强制重置
      prevMainTabRef.current = activeMainTab;
      return;
    }

    // 只在确实需要时才重置到初始步骤
    resetBrewingState(false);
    navigateToStep(hasCoffeeBeans ? 'coffeeBean' : 'method');
    prevMainTabRef.current = activeMainTab;
  }, [
    activeMainTab,
    activeBrewingStep,
    resetBrewingState,
    prevMainTabRef,
    setShowHistory,
    navigateToStep,
    hasCoffeeBeans,
  ]);

  const handleMethodTypeChange = useCallback(
    (type: 'common' | 'custom') => {
      const customEquipment = customEquipments.find(
        e => e.id === selectedEquipment || e.name === selectedEquipment
      );

      if (
        customEquipment &&
        customEquipment.animationType === 'custom' &&
        type === 'common'
      ) {
        // 自定义预设器具仅支持自定义方案
        return;
      }

      setMethodType(type);
    },
    [customEquipments, selectedEquipment, setMethodType]
  );

  const [isCoffeeBrewed, setIsCoffeeBrewed] = useState(showComplete);

  const handleSettingsChange = useCallback(
    async (newSettings: SettingsOptions) => {
      setSettings(newSettings);
      try {
        const { Storage } = await import('@/lib/core/storage');
        await Storage.set('brewGuideSettings', JSON.stringify(newSettings));

        if (newSettings.textZoomLevel) {
          fontZoomUtils.set(newSettings.textZoomLevel);
        }
      } catch {
        // 静默处理错误
      }
    },
    [setSettings]
  );

  const handleSubSettingChange = useCallback(
    async (key: string, value: any) => {
      const newSettings = { ...settings, [key]: value };
      setSettings(newSettings);
      try {
        const { Storage } = await import('@/lib/core/storage');
        await Storage.set('brewGuideSettings', JSON.stringify(newSettings));

        // 触发自定义事件通知其他组件设置已更改
        window.dispatchEvent(
          new CustomEvent('storageChange', {
            detail: { key: 'brewGuideSettings' },
          })
        );
      } catch {
        // 静默处理错误
      }
    },
    [settings]
  );

  const handleLayoutChange = useCallback(
    (e: CustomEvent) => {
      if (e.detail && e.detail.layoutSettings) {
        // 接收到布局设置变更
        const newSettings = {
          ...settings,
          layoutSettings: e.detail.layoutSettings,
        };
        handleSettingsChange(newSettings);
      }
    },
    [settings, handleSettingsChange]
  );

  useEffect(() => {
    const handleBrewingComplete = () => {
      setShowComplete(true);
      setIsCoffeeBrewed(true);
    };

    const handleBrewingReset = () => {
      setHasAutoNavigatedToNotes(false);
      setShowComplete(false);
      setIsCoffeeBrewed(false);
    };

    const handleResetAutoNavigation = () => {
      setHasAutoNavigatedToNotes(false);
    };

    const handleMethodToBrewing = () => {
      setShowComplete(false);
      setIsCoffeeBrewed(false);

      if (selectedEquipment && (currentBrewingMethod || selectedMethod)) {
        const method = currentBrewingMethod || selectedMethod;
        updateParameterInfo(
          'brewing',
          selectedEquipment,
          method,
          equipmentList,
          customEquipments
        );
      }
    };

    const handleGetParams = () => {
      if (currentBrewingMethod && currentBrewingMethod.params) {
        const paramsUpdatedEvent = new CustomEvent('brewing:paramsUpdated', {
          detail: {
            params: {
              coffee: currentBrewingMethod.params.coffee,
              water: currentBrewingMethod.params.water,
              ratio: currentBrewingMethod.params.ratio,
              grindSize: currentBrewingMethod.params.grindSize,
              temp: currentBrewingMethod.params.temp,
            },
            coffeeBean: selectedCoffeeBeanData
              ? {
                  name: selectedCoffeeBeanData.name || '',
                  roastLevel: selectedCoffeeBeanData.roastLevel || '中度烘焙',
                  roastDate: selectedCoffeeBeanData.roastDate || '',
                }
              : null,
          },
        });
        window.dispatchEvent(paramsUpdatedEvent);
      }
    };

    const handleTimerStatusChange = (e: CustomEvent) => {
      if (typeof e.detail?.isRunning === 'boolean') {
        setIsTimerRunning(e.detail.isRunning);

        if (!e.detail.isRunning) {
          setCountdownTime(null);
        }
      }
    };

    const handleStageChange = (e: CustomEvent) => {
      if (typeof e.detail?.stage === 'number') {
        setCurrentStage(e.detail.stage);
      } else if (typeof e.detail?.currentStage === 'number') {
        setCurrentStage(e.detail.currentStage);
      }

      if (typeof e.detail?.isWaiting === 'boolean') {
        setIsStageWaiting(e.detail.isWaiting);
      }
    };

    const handleCountdownChange = (e: CustomEvent) => {
      if ('remainingTime' in e.detail) {
        setTimeout(() => {
          setCountdownTime(e.detail.remainingTime);

          if (e.detail.remainingTime !== null) {
            setCurrentStage(-1);
          }
        }, 0);
      }
    };

    window.addEventListener('brewing:complete', handleBrewingComplete);
    window.addEventListener('brewing:reset', handleBrewingReset);
    window.addEventListener(
      'brewing:resetAutoNavigation',
      handleResetAutoNavigation
    );
    window.addEventListener('brewing:methodToBrewing', handleMethodToBrewing);
    window.addEventListener('brewing:getParams', handleGetParams);
    window.addEventListener(
      'brewing:timerStatus',
      handleTimerStatusChange as EventListener
    );
    window.addEventListener(
      'brewing:stageChange',
      handleStageChange as EventListener
    );
    window.addEventListener(
      'brewing:countdownChange',
      handleCountdownChange as EventListener
    );
    window.addEventListener(
      'brewing:layoutChange',
      handleLayoutChange as EventListener
    );

    return () => {
      window.removeEventListener('brewing:complete', handleBrewingComplete);
      window.removeEventListener('brewing:reset', handleBrewingReset);
      window.removeEventListener(
        'brewing:resetAutoNavigation',
        handleResetAutoNavigation
      );
      window.removeEventListener(
        'brewing:methodToBrewing',
        handleMethodToBrewing
      );
      window.removeEventListener('brewing:getParams', handleGetParams);
      window.removeEventListener(
        'brewing:timerStatus',
        handleTimerStatusChange as EventListener
      );
      window.removeEventListener(
        'brewing:stageChange',
        handleStageChange as EventListener
      );
      window.removeEventListener(
        'brewing:countdownChange',
        handleCountdownChange as EventListener
      );
      window.removeEventListener(
        'brewing:layoutChange',
        handleLayoutChange as EventListener
      );
    };
  }, [
    setShowComplete,
    setIsCoffeeBrewed,
    setHasAutoNavigatedToNotes,
    setIsTimerRunning,
    setCurrentStage,
    setCountdownTime,
    setIsStageWaiting,
    currentBrewingMethod,
    selectedCoffeeBeanData,
    selectedEquipment,
    selectedMethod,
    customEquipments,
    handleLayoutChange,
  ]);

  // 简化的返回按钮处理 - 使用统一的步骤流程
  const handleBackClick = useCallback(() => {
    // 定义步骤返回映射
    const BACK_STEPS: Record<BrewingStep, BrewingStep | null> = {
      brewing: 'method',
      method: hasCoffeeBeans ? 'coffeeBean' : null,
      coffeeBean: null,
      notes: 'brewing',
    };

    const backStep = BACK_STEPS[activeBrewingStep];
    if (!backStep) return;

    // 从记录步骤返回时，重置状态
    if (activeBrewingStep === 'notes') {
      window.dispatchEvent(new CustomEvent('brewing:reset'));
      setShowComplete(false);
      setIsCoffeeBrewed(false);
      setHasAutoNavigatedToNotes(false);
    }

    // 从注水返回到方案时，强制导航
    if (activeBrewingStep === 'brewing' && backStep === 'method') {
      if (showComplete || isCoffeeBrewed) {
        setShowComplete(false);
        setIsCoffeeBrewed(false);
      }
      navigateToStep(backStep, { force: true });
      return;
    }

    // 其他情况正常导航
    navigateToStep(backStep);
  }, [
    activeBrewingStep,
    hasCoffeeBeans,
    showComplete,
    isCoffeeBrewed,
    navigateToStep,
    setShowComplete,
    setIsCoffeeBrewed,
    setHasAutoNavigatedToNotes,
  ]);

  const handleMethodSelectWrapper = useCallback(
    async (index: number, step?: Step) => {
      // 检查是否在冲煮完成状态选择了新的方案
      if (isCoffeeBrewed) {
        // 确保isCoffeeBrewed状态被重置，允许正常的步骤导航
        setIsCoffeeBrewed(false);
      }

      // 确保有有效的设备选择
      if (!selectedEquipment || selectedEquipment.trim() === '') {
        console.error('尝试选择方法但没有有效的设备选择:', {
          selectedEquipment,
          index,
          methodType,
        });
        // 尝试从缓存恢复设备选择
        const { getSelectedEquipmentPreference } = await import(
          '@/lib/hooks/useBrewingState'
        );
        const cachedEquipment = getSelectedEquipmentPreference();
        if (cachedEquipment) {
          console.warn('从缓存恢复设备选择:', cachedEquipment);
          // 直接使用handleEquipmentSelect来恢复状态
          handleEquipmentSelect(cachedEquipment);
          // 延迟执行方法选择，等待设备状态更新
          setTimeout(() => {
            handleMethodSelectWrapper(index, step);
          }, 100);
          return;
        } else {
          console.error('无法恢复设备选择，缓存中也没有设备信息');
          return;
        }
      }

      // 确定使用哪种方法类型：
      // 1. 优先使用step中明确指定的方法类型（使用类型断言访问explicitMethodType）
      // 2. 如果没有明确指定，则使用全局methodType状态
      const effectiveMethodType =
        (step as ExtendedStep)?.explicitMethodType || methodType;

      // 将正确的参数传递给 handleMethodSelect
      await handleMethodSelect(
        selectedEquipment,
        index,
        effectiveMethodType,
        step
      );
    },
    [
      handleMethodSelect,
      isCoffeeBrewed,
      setIsCoffeeBrewed,
      selectedEquipment,
      methodType,
      handleEquipmentSelect,
    ]
  );

  useEffect(() => {
    if (
      showComplete &&
      activeMainTab === '冲煮' &&
      activeBrewingStep === 'brewing' &&
      !hasAutoNavigatedToNotes
    ) {
      // 确保清理替代头部状态
      setShowAlternativeHeader(false);
      setAlternativeHeaderContent(null);

      // 使用setTimeout确保状态更新完成后再跳转
      setTimeout(() => {
        navigateToStep('notes', { force: true });
        setHasAutoNavigatedToNotes(true);
      }, 0);
    }
  }, [
    showComplete,
    activeMainTab,
    activeBrewingStep,
    navigateToStep,
    hasAutoNavigatedToNotes,
    setShowComplete,
  ]);

  const handleMainTabClick = (tab: MainTabType) => {
    if (tab === activeMainTab) {
      return;
    }

    saveMainTabPreference(tab);
    setActiveMainTab(tab);
  };

  const [showOnboarding, setShowOnboarding] = useState(false);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
  };

  const handleImportBean = async (jsonData: string) => {
    try {
      // 尝试从文本中提取数据
      const extractedData = await import('@/lib/utils/jsonUtils').then(
        ({ extractJsonFromText }) => extractJsonFromText(jsonData)
      );

      if (!extractedData) {
        throw new Error('无法从输入中提取有效数据');
      }

      // 检查是否是咖啡豆数据类型，通过类型守卫确保安全访问属性
      // 只要求有name字段，其他字段都是可选的
      const isCoffeeBean = (data: unknown): data is CoffeeBean =>
        data !== null &&
        typeof data === 'object' &&
        'name' in data &&
        typeof (data as Record<string, unknown>).name === 'string' &&
        ((data as Record<string, unknown>).name as string).trim() !== '';

      // 检查是否是咖啡豆数组
      const isCoffeeBeanArray = (data: unknown): data is CoffeeBean[] =>
        Array.isArray(data) && data.length > 0 && data.every(isCoffeeBean);

      // 确保提取的数据是咖啡豆或咖啡豆数组
      if (!isCoffeeBean(extractedData) && !isCoffeeBeanArray(extractedData)) {
        throw new Error('导入的数据不是有效的咖啡豆信息（缺少咖啡豆名称）');
      }

      const beansToImport = Array.isArray(extractedData)
        ? extractedData
        : [extractedData];

      let importCount = 0;
      let lastImportedBean: ExtendedCoffeeBean | null = null;

      // 动态导入 CoffeeBeanManager
      const { CoffeeBeanManager } = await import(
        '@/lib/managers/coffeeBeanManager'
      );

      // 开始批量操作，禁用单个添加时的事件触发
      CoffeeBeanManager.startBatchOperation();

      try {
        for (const beanData of beansToImport) {
          // 将导入的咖啡豆转换为ExtendedCoffeeBean类型
          // 构建基础对象，只包含必填字段和确实有值的字段
          const bean: Omit<ExtendedCoffeeBean, 'id' | 'timestamp'> = {
            name: beanData.name, // 必填字段
            // 为了满足TypeScript类型要求，需要设置所有必需字段的默认值
            // 但在实际导入时，我们会过滤掉空值，保持数据严谨
            roastLevel:
              (beanData.roastLevel && beanData.roastLevel.trim()) || '',
            capacity:
              (beanData.capacity && beanData.capacity.toString().trim()) || '',
            remaining: '',
            price: (beanData.price && beanData.price.toString().trim()) || '',
            roastDate: (beanData.roastDate && beanData.roastDate.trim()) || '',
            flavor:
              Array.isArray(beanData.flavor) && beanData.flavor.length > 0
                ? beanData.flavor.filter(f => f && f.trim())
                : [],
            notes: (beanData.notes && beanData.notes.trim()) || '',
          };

          // 特殊处理剩余量：优先使用remaining，如果没有但有capacity，则设置为capacity
          if (beanData.remaining && beanData.remaining.toString().trim()) {
            bean.remaining = beanData.remaining.toString().trim();
          } else if (bean.capacity) {
            bean.remaining = bean.capacity;
          }

          // 只在字段存在时才设置其他可选字段
          if (beanData.startDay !== undefined)
            bean.startDay = beanData.startDay;
          if (beanData.endDay !== undefined) bean.endDay = beanData.endDay;
          if (beanData.image !== undefined) bean.image = beanData.image;
          if (beanData.brand !== undefined) bean.brand = beanData.brand;
          if (beanData.beanType !== undefined)
            bean.beanType = beanData.beanType;
          if (beanData.overallRating !== undefined)
            bean.overallRating = beanData.overallRating;
          if (beanData.ratingNotes !== undefined)
            bean.ratingNotes = beanData.ratingNotes;
          if (beanData.isFrozen !== undefined)
            bean.isFrozen = beanData.isFrozen;
          if (beanData.isInTransit !== undefined)
            bean.isInTransit = beanData.isInTransit;

          // 验证必要的字段（只有名称是必填的）
          if (!bean.name || bean.name.trim() === '') {
            // 导入数据缺少咖啡豆名称，跳过
            continue;
          }

          // 处理拼配成分
          const beanBlendComponents = (
            beanData as unknown as Record<string, unknown>
          ).blendComponents;
          if (beanBlendComponents && Array.isArray(beanBlendComponents)) {
            // 验证拼配成分的格式是否正确
            const validComponents = beanBlendComponents.filter(
              (comp: unknown) =>
                comp &&
                typeof comp === 'object' &&
                comp !== null &&
                ('origin' in comp || 'process' in comp || 'variety' in comp)
            );

            if (validComponents.length > 0) {
              bean.blendComponents = validComponents.map((comp: unknown) => {
                const component = comp as Record<string, unknown>;
                return {
                  origin: (component.origin as string) || '',
                  process: (component.process as string) || '',
                  variety: (component.variety as string) || '',
                  // 只在明确有百分比时才设置百分比值，否则保持为undefined
                  ...(component.percentage !== undefined
                    ? {
                        percentage:
                          typeof component.percentage === 'string'
                            ? parseInt(component.percentage, 10)
                            : typeof component.percentage === 'number'
                              ? component.percentage
                              : undefined,
                      }
                    : {}),
                };
              });
            }
          } else {
            // 检查是否有旧格式的字段，如果有则转换为新格式
            const beanDataRecord = beanData as unknown as Record<
              string,
              unknown
            >;
            const legacyOrigin = beanDataRecord.origin as string;
            const legacyProcess = beanDataRecord.process as string;
            const legacyVariety = beanDataRecord.variety as string;

            if (legacyOrigin || legacyProcess || legacyVariety) {
              bean.blendComponents = [
                {
                  percentage: 100,
                  origin: legacyOrigin || '',
                  process: legacyProcess || '',
                  variety: legacyVariety || '',
                },
              ];
            }
          }

          // beanType字段保持可选，不强制设置默认值

          // 添加到数据库
          const newBean = await CoffeeBeanManager.addBean(bean);
          lastImportedBean = newBean;
          importCount++;
        }
      } finally {
        // 结束批量操作，触发更新事件
        CoffeeBeanManager.endBatchOperation();
      }

      if (importCount === 0) {
        throw new Error('没有导入任何有效咖啡豆数据');
      }

      setShowImportBeanForm(false);

      window.dispatchEvent(
        new CustomEvent('coffeeBeanDataChanged', {
          detail: {
            action: 'import',
            importCount: importCount,
          },
        })
      );

      await new Promise(resolve => setTimeout(resolve, 100));
      handleBeanListChange();
      handleMainTabClick('咖啡豆');

      if (importCount === 1 && lastImportedBean) {
        setTimeout(() => {
          setEditingBean(lastImportedBean);
          setShowBeanForm(true);
        }, 300);
      }
    } catch (error) {
      // 导入失败
      alert(
        '导入失败: ' +
          (error instanceof Error ? error.message : '请检查数据格式')
      );
    }
  };

  const handleBeanForm = (bean: ExtendedCoffeeBean | null = null) => {
    setEditingBean(bean);
    setShowBeanForm(true);
  };

  // 完全重写checkCoffeeBeans函数，简化逻辑
  const checkCoffeeBeans = useCallback(async () => {
    try {
      const { CoffeeBeanManager } = await import(
        '@/lib/managers/coffeeBeanManager'
      );
      const beans = await CoffeeBeanManager.getAllBeans();
      const hasAnyBeans = beans.length > 0;
      const wasHasBeans = hasCoffeeBeans;
      setHasCoffeeBeans(hasAnyBeans);

      // 咖啡豆从有到无的情况需要特殊处理
      if (!hasAnyBeans && wasHasBeans) {
        // 重置选中的咖啡豆
        setSelectedCoffeeBean(null);
        setSelectedCoffeeBeanData(null);

        // 如果在冲煮页面，执行更彻底的重置
        if (activeMainTab === '冲煮') {
          // 执行一次完整的状态重置
          resetBrewingState(false);

          // 使用统一导航函数确保切换到方案步骤
          navigateToStep('method', { resetParams: true });

          // 延迟再次确认步骤，确保UI更新正确
          setTimeout(() => {
            navigateToStep('method', { resetParams: true });
          }, 100);
        }
      }
    } catch (error) {
      // 检查咖啡豆失败
      console.error('检查咖啡豆失败:', error);
    }
  }, [
    activeMainTab,
    hasCoffeeBeans,
    navigateToStep,
    resetBrewingState,
    setSelectedCoffeeBean,
    setSelectedCoffeeBeanData,
  ]);

  const handleBeanListChange = useCallback(() => {
    checkCoffeeBeans();
    setBeanListKey(prevKey => prevKey + 1);

    setTimeout(() => {
      checkCoffeeBeans();
    }, 300);
  }, [checkCoffeeBeans]);

  // 简化的咖啡豆列表变化处理
  useEffect(() => {
    const handleBeanListChanged = (
      e: CustomEvent<{
        hasBeans: boolean;
        isFirstBean?: boolean;
        lastBeanDeleted?: boolean;
        deletedBeanId?: string;
      }>
    ) => {
      // 强制检查咖啡豆状态
      checkCoffeeBeans();

      // 首次添加咖啡豆时，标记从咖啡豆步骤开始
      if (e.detail.isFirstBean && activeMainTab === '咖啡豆') {
        localStorage.setItem('shouldStartFromCoffeeBeanStep', 'true');
        return;
      }

      // 删除最后一个咖啡豆时，强制切换到方案步骤
      if (e.detail.lastBeanDeleted) {
        setSelectedCoffeeBean(null);
        setSelectedCoffeeBeanData(null);

        if (activeMainTab === '冲煮') {
          resetBrewingState(false);
          navigateToStep('method');
        }
        return;
      }

      // 删除了当前选中的咖啡豆（但不是最后一个）
      if (
        e.detail.deletedBeanId &&
        selectedCoffeeBean === e.detail.deletedBeanId
      ) {
        setSelectedCoffeeBean(null);
        setSelectedCoffeeBeanData(null);

        if (activeMainTab === '冲煮' && activeBrewingStep === 'coffeeBean') {
          navigateToStep('method');
        }
      }
    };

    window.addEventListener(
      'coffeeBeanListChanged',
      handleBeanListChanged as EventListener
    );
    return () =>
      window.removeEventListener(
        'coffeeBeanListChanged',
        handleBeanListChanged as EventListener
      );
  }, [
    checkCoffeeBeans,
    activeMainTab,
    activeBrewingStep,
    selectedCoffeeBean,
    setSelectedCoffeeBean,
    setSelectedCoffeeBeanData,
    resetBrewingState,
    navigateToStep,
  ]);

  // 添加从咖啡豆页面切换回冲煮页面的特殊处理
  useEffect(() => {
    if (activeMainTab === '冲煮') {
      // 检查是否应该从咖啡豆步骤开始
      const shouldStartFromCoffeeBeanStep = localStorage.getItem(
        'shouldStartFromCoffeeBeanStep'
      );
      if (shouldStartFromCoffeeBeanStep === 'true' && hasCoffeeBeans) {
        // 重置标记
        localStorage.removeItem('shouldStartFromCoffeeBeanStep');
        // 设置步骤为咖啡豆
        setActiveBrewingStep('coffeeBean');
        setActiveTab('咖啡豆');
      }
    }
  }, [activeMainTab, hasCoffeeBeans, setActiveBrewingStep, setActiveTab]);

  const handleSaveBean = async (
    bean: Omit<ExtendedCoffeeBean, 'id' | 'timestamp'>
  ) => {
    try {
      const { CoffeeBeanManager } = await import(
        '@/lib/managers/coffeeBeanManager'
      );
      const currentBeans = await CoffeeBeanManager.getAllBeans();
      const isFirstBean = !editingBean?.id && currentBeans.length === 0;

      if (editingBean?.id) {
        await CoffeeBeanManager.updateBean(editingBean.id, bean);
      } else {
        await CoffeeBeanManager.addBean(bean);
      }

      setShowBeanForm(false);
      setEditingBean(null);

      window.dispatchEvent(
        new CustomEvent('coffeeBeanDataChanged', {
          detail: {
            action: editingBean?.id ? 'update' : 'add',
            beanId: editingBean?.id,
            isFirstBean: isFirstBean,
          },
        })
      );

      handleBeanListChange();

      if (isFirstBean) {
        window.dispatchEvent(
          new CustomEvent('coffeeBeanListChanged', {
            detail: { hasBeans: true, isFirstBean: true },
          })
        );
      }

      setTimeout(() => {
        checkCoffeeBeans();
      }, 50);
    } catch (_error) {
      // 保存咖啡豆失败
      alert('保存失败，请重试');
    }
  };

  const handleEquipmentSelectWithName = useCallback(
    (equipmentIdOrName: string) => {
      // 使用统一工具函数获取器具信息
      const equipment = getEquipmentById(equipmentIdOrName, customEquipments);
      const equipmentId = equipment?.id || equipmentIdOrName;
      const equipmentName = getEquipmentNameById(
        equipmentIdOrName,
        customEquipments
      );

      setParameterInfo({
        equipment: equipmentName,
        method: null,
        params: null,
      });

      const isCustomPresetEquipment =
        equipment &&
        'animationType' in equipment &&
        equipment.animationType === 'custom';

      if (isCustomPresetEquipment) {
        setMethodType('custom');
        // 检测到自定义预设器具，已自动切换到自定义方案模式
      }

      handleEquipmentSelect(equipmentId);

      // 设备选择完成
    },
    [handleEquipmentSelect, setParameterInfo, customEquipments, setMethodType]
  );

  useEffect(() => {
    const preventScrollOnInputs = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'SELECT' ||
        target.tagName === 'TEXTAREA' ||
        target.closest('.autocomplete-dropdown') ||
        target.closest('li') ||
        target.closest('[data-dropdown]') ||
        target.getAttribute('role') === 'listbox' ||
        target.getAttribute('role') === 'option'
      ) {
        e.stopPropagation();
      }
    };

    document.addEventListener('touchmove', preventScrollOnInputs, {
      passive: true,
    });

    return () => {
      document.removeEventListener('touchmove', preventScrollOnInputs);
    };
  }, []);

  const expandedStagesRef = useRef<
    {
      type: 'pour' | 'wait';
      label: string;
      startTime: number;
      endTime: number;
      time: number;
      pourTime?: number;
      water: string;
      detail: string;
      pourType?: string;
      valveStatus?: 'open' | 'closed';
      originalIndex: number;
    }[]
  >([]);

  const handleMigrationComplete = () => {
    setShowDataMigration(false);
    setMigrationData(null);
    handleBeanListChange();
  };

  const handleDataChange = async () => {
    try {
      const { Storage } = await import('@/lib/core/storage');
      const savedSettings = await Storage.get('brewGuideSettings');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings) as SettingsOptions);
      }
    } catch {
      // 静默处理错误
    }

    try {
      const methods = await import('@/lib/managers/customMethods').then(
        ({ loadCustomMethods }) => {
          return loadCustomMethods();
        }
      );
      setCustomMethods(methods);
    } catch {
      // 静默处理错误
    }

    setSelectedMethod(null);
  };

  // 简化的历史记录导航事件处理
  useEffect(() => {
    // 主标签导航
    const handleMainTabNavigation = (e: CustomEvent) => {
      const { tab } = e.detail;
      if (tab) {
        saveMainTabPreference(tab);
        setActiveMainTab(tab);
      }
    };

    // 步骤导航
    const handleStepNavigation = (e: CustomEvent) => {
      const { step, fromHistory = false, directToBrewing = false } = e.detail;
      if (!step) return;

      if (directToBrewing && step === 'brewing') {
        // 直接跳转到注水步骤，延迟确保UI已更新
        setTimeout(() => navigateToStep('brewing', { force: true }), 300);
      } else {
        navigateToStep(step, { force: fromHistory || directToBrewing });
      }
    };

    // 咖啡豆选择
    const handleCoffeeBeanSelection = async (e: CustomEvent) => {
      const { beanName } = e.detail;
      if (!beanName) return;

      try {
        const { CoffeeBeanManager } = await import(
          '@/lib/managers/coffeeBeanManager'
        );
        const bean = await CoffeeBeanManager.getBeanByName(beanName);
        if (bean) {
          handleCoffeeBeanSelect(bean.id, bean);
        }
      } catch {
        // 忽略错误
      }
    };

    // 器具选择
    const handleEquipmentSelection = (e: CustomEvent) => {
      const { equipmentName } = e.detail;
      if (equipmentName) {
        handleEquipmentSelectWithName(equipmentName);
      }
    };

    // 方案选择
    const handleMethodSelection = (e: CustomEvent) => {
      const { methodName } = e.detail;
      if (!methodName) return;

      const allMethods =
        methodType === 'common'
          ? commonMethods[selectedEquipment || ''] || []
          : customMethods[selectedEquipment || ''] || [];

      const methodIndex = allMethods.findIndex(m => m.name === methodName);
      if (methodIndex !== -1) {
        const method = allMethods[methodIndex];
        setParameterInfo(prevInfo => ({
          ...prevInfo,
          method: method.name,
          params: {
            coffee: method.params.coffee,
            water: method.params.water,
            ratio: method.params.ratio,
            grindSize: method.params.grindSize,
            temp: method.params.temp,
            stages: method.params.stages.map(stage => ({
              label: stage.label,
              time: stage.time || 0,
              water: stage.water,
              detail: stage.detail,
              pourType: stage.pourType,
            })),
          },
        }));
        handleMethodSelectWrapper(methodIndex);
      }
    };

    // 参数更新
    const handleParamsUpdate = (e: CustomEvent) => {
      const { params } = e.detail;
      if (params) {
        setParameterInfo(prevInfo => ({ ...prevInfo, params }));
      }
    };

    // 方案类型切换
    const handleMethodTypeEvent = (e: CustomEvent) => {
      if (e.detail) {
        handleMethodTypeChange(e.detail);
      }
    };

    // 注册事件监听
    document.addEventListener(
      BREWING_EVENTS.NAVIGATE_TO_MAIN_TAB,
      handleMainTabNavigation as EventListener
    );
    document.addEventListener(
      BREWING_EVENTS.NAVIGATE_TO_STEP,
      handleStepNavigation as EventListener
    );
    document.addEventListener(
      BREWING_EVENTS.SELECT_COFFEE_BEAN,
      handleCoffeeBeanSelection as unknown as EventListener
    );
    document.addEventListener(
      BREWING_EVENTS.SELECT_EQUIPMENT,
      handleEquipmentSelection as EventListener
    );
    document.addEventListener(
      BREWING_EVENTS.SELECT_METHOD,
      handleMethodSelection as EventListener
    );
    document.addEventListener(
      BREWING_EVENTS.UPDATE_BREWING_PARAMS,
      handleParamsUpdate as EventListener
    );
    window.addEventListener(
      'methodTypeChange',
      handleMethodTypeEvent as EventListener
    );

    return () => {
      document.removeEventListener(
        BREWING_EVENTS.NAVIGATE_TO_MAIN_TAB,
        handleMainTabNavigation as EventListener
      );
      document.removeEventListener(
        BREWING_EVENTS.NAVIGATE_TO_STEP,
        handleStepNavigation as EventListener
      );
      document.removeEventListener(
        BREWING_EVENTS.SELECT_COFFEE_BEAN,
        handleCoffeeBeanSelection as unknown as EventListener
      );
      document.removeEventListener(
        BREWING_EVENTS.SELECT_EQUIPMENT,
        handleEquipmentSelection as EventListener
      );
      document.removeEventListener(
        BREWING_EVENTS.SELECT_METHOD,
        handleMethodSelection as EventListener
      );
      document.removeEventListener(
        BREWING_EVENTS.UPDATE_BREWING_PARAMS,
        handleParamsUpdate as EventListener
      );
      window.removeEventListener(
        'methodTypeChange',
        handleMethodTypeEvent as EventListener
      );
    };
  }, [
    navigateToStep,
    handleCoffeeBeanSelect,
    handleEquipmentSelectWithName,
    methodType,
    selectedEquipment,
    customMethods,
    handleMethodSelectWrapper,
    setActiveMainTab,
    handleMethodTypeChange,
    setParameterInfo,
  ]);

  // 冲煮页面历史栈管理 - 参考多步骤表单模态框的实现模式
  useEffect(() => {
    // 只在冲煮页面才管理历史栈
    if (activeMainTab !== '冲煮') {
      // 清理非冲煮页面的历史记录
      if (window.history.state?.brewingStep) {
        window.history.replaceState(null, '');
      }
      return;
    }

    // 判断是否为第一步
    const isFirstStep =
      activeBrewingStep === 'coffeeBean' ||
      (activeBrewingStep === 'method' && !hasCoffeeBeans);

    // 监听返回事件
    const handlePopState = () => {
      // 使用微任务队列确保DOM状态检查在其他事件处理后执行
      setTimeout(() => {
        // 方法0：检查是否有模态框正在处理返回事件
        if (window.__modalHandlingBack) {
          return;
        }

        // 检查当前是否有活动的模态框，如果有则不处理冲煮界面的返回
        const currentState = window.history.state;

        // 方法1：通过历史栈状态检查
        if (currentState?.modal) {
          return;
        }

        // 方法2：通过DOM检查是否有模态框组件处于活动状态
        const activeModals = document.querySelectorAll(
          [
            '[data-modal="custom-method-form"]',
            '[data-modal="method-import"]',
            '[data-modal="equipment-form"]',
            '[data-modal="equipment-import"]',
            '[data-modal="equipment-management"]',
          ].join(',')
        );

        if (activeModals.length > 0) {
          return;
        }

        // 如果没有模态框，执行冲煮界面的返回逻辑
        executeBrewingBack();
      }, 0);
    };

    // 提取冲煮界面返回逻辑
    const executeBrewingBack = () => {
      // 询问是否可以返回上一步
      const BACK_STEPS: Record<BrewingStep, BrewingStep | null> = {
        brewing: 'method',
        method: hasCoffeeBeans ? 'coffeeBean' : null,
        coffeeBean: null,
        notes: 'brewing',
      };

      const backStep = BACK_STEPS[activeBrewingStep];
      if (backStep) {
        // 有上一步，执行返回逻辑，但不重新添加历史记录
        handleBackClick();
      }
      // 如果没有上一步（第一步），什么都不做，浏览器会自然停留
    };

    if (isFirstStep) {
      // 第一步时，清理历史记录，并且不监听 popstate
      if (window.history.state?.brewingStep) {
        window.history.replaceState(null, '');
      }
    } else {
      // 非第一步时，添加历史记录并监听返回事件
      const currentState = window.history.state;

      // 关键修复：确保只在步骤真正改变时才添加历史记录
      // 避免在无咖啡豆情况下，method 步骤被重复添加到历史栈
      const shouldAddHistory =
        !currentState?.brewingStep ||
        currentState.brewingStep !== activeBrewingStep;

      if (shouldAddHistory) {
        // 使用 pushState 为每个非第一步添加历史记录
        window.history.pushState({ brewingStep: activeBrewingStep }, '');
      }

      // 添加监听器
      window.addEventListener('popstate', handlePopState);
    }

    return () => {
      // 清理监听器
      window.removeEventListener('popstate', handlePopState);
    };
  }, [activeMainTab, activeBrewingStep, hasCoffeeBeans, handleBackClick]);

  const [showNoteFormModal, setShowNoteFormModal] = useState(false);
  const [currentEditingNote, setCurrentEditingNote] = useState<
    Partial<BrewingNoteData>
  >({});

  const handleAddNote = () => {
    setCurrentEditingNote({
      coffeeBeanInfo: {
        name: '',
        roastLevel: '中度烘焙',
        roastDate: '',
      },
      taste: {
        acidity: 0,
        sweetness: 0,
        bitterness: 0,
        body: 0,
      },
      rating: 0,
      notes: '',
    });
    setShowNoteFormModal(true);
  };

  const handleSaveBrewingNote = async (note: BrewingNoteData) => {
    try {
      // 使用 Zustand store 保存笔记
      const { useBrewingNoteStore } = await import(
        '@/lib/stores/brewingNoteStore'
      );

      const newNoteId = note.id || Date.now().toString();
      const timestamp = note.timestamp || Date.now();

      // 🔥 修复：检查笔记是否真的存在于 store 中，而不是仅判断是否有 ID
      const currentNotes = useBrewingNoteStore.getState().notes;
      const isExistingNote =
        !!note.id && currentNotes.some(n => n.id === note.id);

      const noteToSave = {
        ...note,
        id: newNoteId,
        timestamp,
        equipment: note.equipment || '',
        method: note.method || '',
        params: note.params || {
          coffee: '',
          water: '',
          ratio: '',
          grindSize: '',
          temp: '',
        },
      } as BrewingNote;

      if (isExistingNote) {
        // 更新现有笔记
        await useBrewingNoteStore.getState().updateNote(newNoteId, noteToSave);
      } else {
        // 添加新笔记
        await useBrewingNoteStore.getState().addNote(noteToSave);
      }

      setShowNoteFormModal(false);
      setCurrentEditingNote({});

      // 事件触发已在 store 中自动完成
      saveMainTabPreference('笔记');
      setActiveMainTab('笔记');
    } catch (error) {
      // 保存冲煮笔记失败
      alert('保存失败，请重试');
    }
  };

  // 处理笔记编辑模态框的保存
  const handleSaveBrewingNoteEdit = async (note: BrewingNoteData) => {
    try {
      // 使用 Zustand store 保存笔记
      const { useBrewingNoteStore } = await import(
        '@/lib/stores/brewingNoteStore'
      );

      // 🔥 解构排除变动记录的特有字段，确保转换后的笔记不会被识别为变动记录
      const { source, quickDecrementAmount, changeRecord, ...cleanNote } =
        note as any;

      // 🔥 修复：复制操作应该被视为新笔记，即使它有 id
      const isNewNote = isBrewingNoteCopy || !note.id;

      const noteToSave = {
        ...cleanNote,
        // 🔥 关键修复：复制模式下强制生成新 ID 和新时间戳
        id: isNewNote ? Date.now().toString() : cleanNote.id,
        timestamp: isNewNote ? Date.now() : cleanNote.timestamp || Date.now(),
        equipment: cleanNote.equipment || '',
        method: cleanNote.method || '',
        params: cleanNote.params || {
          coffee: '',
          water: '',
          ratio: '',
          grindSize: '',
          temp: '',
        },
      } as BrewingNote;

      if (isNewNote) {
        // 添加新笔记
        await useBrewingNoteStore.getState().addNote(noteToSave);

        // 如果是复制操作，需要扣除咖啡豆剩余量
        if (isBrewingNoteCopy && note.beanId && note.params?.coffee) {
          try {
            const { CoffeeBeanManager } = await import(
              '@/lib/managers/coffeeBeanManager'
            );
            const coffeeMatch = note.params.coffee.match(/(\d+(?:\.\d+)?)/);
            if (coffeeMatch) {
              const coffeeAmount = parseFloat(coffeeMatch[0]);
              if (!isNaN(coffeeAmount) && coffeeAmount > 0) {
                await CoffeeBeanManager.updateBeanRemaining(
                  note.beanId,
                  coffeeAmount
                );
              }
            } else {
              console.warn('无法从参数中提取咖啡量:', note.params.coffee);
            }
          } catch (error) {
            console.error('扣除咖啡豆剩余量失败:', error);
          }
        }
      } else {
        // 🔥 更新现有笔记 - 使用完全替换策略确保删除变动记录字段
        // 先获取当前所有笔记
        const { Storage } = await import('@/lib/core/storage');
        const savedNotes = await Storage.get('brewingNotes');
        const allNotes: BrewingNote[] = savedNotes
          ? JSON.parse(savedNotes)
          : [];

        // 找到并完全替换目标笔记
        const noteIndex = allNotes.findIndex(n => n.id === noteToSave.id);
        if (noteIndex !== -1) {
          allNotes[noteIndex] = noteToSave; // 完全替换，不是合并
          await Storage.set('brewingNotes', JSON.stringify(allNotes));

          // 更新 Zustand store
          useBrewingNoteStore.setState({ notes: allNotes });
        }
      }

      setBrewingNoteEditOpen(false);
      setBrewingNoteEditData(null);
      setIsBrewingNoteCopy(false);

      // 显示成功提示（事件触发已在 store 中自动完成）
      const { showToast } = await import(
        '@/components/common/feedback/LightToast'
      );
      showToast({
        title: isNewNote ? '笔记已复制' : '笔记已更新',
        type: 'success',
      });
    } catch (error) {
      alert('保存失败，请重试');
    }
  };

  const handleSaveEquipment = async (
    equipment: CustomEquipment,
    methods?: Method[]
  ) => {
    try {
      await saveCustomEquipment(equipment, methods);
      const updatedEquipments = await loadCustomEquipments();
      setCustomEquipments(updatedEquipments);

      // 不再在这里自动关闭表单，让模态框通过历史栈管理自己控制
      // setShowEquipmentForm(false);
      // setEditingEquipment(undefined);
    } catch (_error) {
      // 保存器具失败
      alert('保存器具失败，请重试');
    }
  };

  const handleDeleteEquipment = async (equipment: CustomEquipment) => {
    if (window.confirm('确定要删除这个器具吗？')) {
      try {
        await deleteCustomEquipment(equipment.id);
        const updatedEquipments = await loadCustomEquipments();
        setCustomEquipments(updatedEquipments);
      } catch (error) {
        // Log error in development only
        if (process.env.NODE_ENV === 'development') {
          console.error('删除器具失败:', error);
        }
        alert('删除器具失败，请重试');
      }
    }
  };

  // 器具管理抽屉相关处理函数
  const handleAddEquipment = () => {
    setEditingEquipment(undefined);
    setShowEquipmentForm(true);
    setShowEquipmentManagement(false);
  };

  const handleEditEquipment = (equipment: CustomEquipment) => {
    setEditingEquipment(equipment);
    setShowEquipmentForm(true);
    setShowEquipmentManagement(false);
  };

  const handleShareEquipment = async (equipment: CustomEquipment) => {
    try {
      const methods = customMethods[equipment.id || equipment.name] || [];
      const { copyEquipmentToClipboard } = await import(
        '@/lib/managers/customMethods'
      );
      await copyEquipmentToClipboard(equipment, methods);
      showToast({
        type: 'success',
        title: '器具配置已导出',
        duration: 2000,
      });
    } catch (error) {
      console.error('导出器具失败:', error);
      showToast({
        type: 'error',
        title: '导出失败，请重试',
        duration: 2000,
      });
    }
  };

  const handleReorderEquipments = async (newOrder: CustomEquipment[]) => {
    try {
      const { saveEquipmentOrder, loadEquipmentOrder } = await import(
        '@/lib/managers/customEquipments'
      );
      const { equipmentUtils } = await import('@/lib/equipment/equipmentUtils');

      const currentOrder = await loadEquipmentOrder();
      const allCurrentEquipments = equipmentUtils.getAllEquipments(
        customEquipments,
        currentOrder
      );

      const updatedEquipments = allCurrentEquipments.map(eq => {
        if (!eq.isCustom) return eq;
        const reorderedCustomEq = newOrder.find(newEq => newEq.id === eq.id);
        return reorderedCustomEq
          ? { ...reorderedCustomEq, isCustom: true }
          : eq;
      });

      const newEquipmentOrder =
        equipmentUtils.generateEquipmentOrder(updatedEquipments);

      await saveEquipmentOrder(newEquipmentOrder);
    } catch (error) {
      console.error('保存器具排序失败:', error);
    }
  };

  useEffect(() => {
    if (selectedEquipment) {
      const isCustomPresetEquipment = customEquipments.some(
        e =>
          (e.id === selectedEquipment || e.name === selectedEquipment) &&
          e.animationType === 'custom'
      );

      if (isCustomPresetEquipment && methodType !== 'custom') {
        setMethodType('custom');
        // 设备改变：检测到自定义预设器具，已自动切换到自定义方案模式
      }
    }
  }, [selectedEquipment, customEquipments, methodType, setMethodType]);

  const handleImportEquipment = async (
    equipment: CustomEquipment,
    methods?: Method[]
  ) => {
    try {
      const originalId = equipment.id;
      // 导入器具原始ID

      // 传递methods参数给handleSaveEquipment
      await handleSaveEquipment(equipment, methods);

      // 导入完成后，直接选择该设备
      if (originalId) {
        // 导入完成，设置选定器具ID
        // 直接使用ID选择设备
        handleEquipmentSelect(originalId);

        // 如果是自定义预设器具，强制设置方法类型为'custom'
        if (equipment.animationType === 'custom') {
          setMethodType('custom');
        }
      }

      setShowEquipmentImportForm(false);
    } catch (error) {
      // Log error in development only
      if (process.env.NODE_ENV === 'development') {
        console.error('导入器具失败:', error);
      }
    }
  };

  // 加载自定义方法
  useEffect(() => {
    const loadMethods = async () => {
      try {
        const methods = await import('@/lib/managers/customMethods').then(
          ({ loadCustomMethods }) => {
            return loadCustomMethods();
          }
        );
        setCustomMethods(methods);
      } catch (error) {
        // Log error in development only
        if (process.env.NODE_ENV === 'development') {
          console.error('加载自定义方法失败:', error);
        }
      }
    };

    // 添加自定义方法更新事件监听器
    const handleMethodUpdate = () => {
      loadMethods();
    };

    // 添加数据变更事件监听器
    const handleStorageChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (
        customEvent.detail?.key === 'allData' ||
        customEvent.detail?.key?.startsWith('customMethods')
      ) {
        loadMethods();
      }
    };

    loadMethods();

    // 添加事件监听
    window.addEventListener('customMethodUpdate', handleMethodUpdate);
    window.addEventListener('storage:changed', handleStorageChange);

    // 清理事件监听
    return () => {
      window.removeEventListener('customMethodUpdate', handleMethodUpdate);
      window.removeEventListener('storage:changed', handleStorageChange);
    };
  }, [setCustomMethods]);

  // 添加监听创建新笔记事件
  useEffect(() => {
    const handleAddNewBrewingNote = async () => {
      try {
        // 检查是否存在临时存储的咖啡豆
        const tempBeanJson = localStorage.getItem('temp:selectedBean');
        if (tempBeanJson) {
          const tempBeanInfo = JSON.parse(tempBeanJson);

          // 移除临时存储
          localStorage.removeItem('temp:selectedBean');

          // 如果有ID，尝试获取完整的咖啡豆信息
          if (tempBeanInfo.id) {
            const { CoffeeBeanManager } = await import(
              '@/lib/managers/coffeeBeanManager'
            );
            const fullBean = await CoffeeBeanManager.getBeanById(
              tempBeanInfo.id
            );

            if (fullBean) {
              // 创建笔记并预选该咖啡豆
              setCurrentEditingNote({
                coffeeBean: fullBean,
                beanId: tempBeanInfo.id, // 明确设置beanId，确保表单可以找到对应的咖啡豆
                coffeeBeanInfo: {
                  name: fullBean.name,
                  roastLevel: fullBean.roastLevel || '中度烘焙',
                  roastDate: fullBean.roastDate || '',
                },
                taste: {
                  acidity: 0,
                  sweetness: 0,
                  bitterness: 0,
                  body: 0,
                },
                rating: 0,
                notes: '',
              });
              setShowNoteFormModal(true);
              return;
            }
          }

          // 如果没有找到完整咖啡豆信息，使用临时信息
          setCurrentEditingNote({
            beanId: tempBeanInfo.id, // 如果有id也设置，尽管可能为undefined
            coffeeBeanInfo: {
              name: tempBeanInfo.name || '',
              roastLevel: tempBeanInfo.roastLevel || '中度烘焙',
              roastDate: tempBeanInfo.roastDate || '',
            },
            taste: {
              acidity: 0,
              sweetness: 0,
              bitterness: 0,
              body: 0,
            },
            rating: 0,
            notes: '',
          });
          setShowNoteFormModal(true);
          return;
        }

        // 如果没有临时咖啡豆信息，调用默认的添加笔记函数
        handleAddNote();
      } catch (error) {
        console.error('处理新建笔记事件失败:', error);
        // 出错时调用默认的添加笔记函数
        handleAddNote();
      }
    };

    window.addEventListener('addNewBrewingNote', handleAddNewBrewingNote);

    return () => {
      window.removeEventListener('addNewBrewingNote', handleAddNewBrewingNote);
    };
  }, []);

  // 添加导航栏替代头部相关状态
  const [alternativeHeaderContent, setAlternativeHeaderContent] =
    useState<ReactNode | null>(null);
  const [showAlternativeHeader, setShowAlternativeHeader] = useState(false);

  // 监听清理替代头部事件
  useEffect(() => {
    const handleClearAlternativeHeader = () => {
      setShowAlternativeHeader(false);
      setAlternativeHeaderContent(null);
    };

    window.addEventListener(
      'clearAlternativeHeader',
      handleClearAlternativeHeader
    );

    return () => {
      window.removeEventListener(
        'clearAlternativeHeader',
        handleClearAlternativeHeader
      );
    };
  }, []);

  // 监听模态框打开状态,用于父页面转场动画
  const [hasModalOpen, setHasModalOpen] = React.useState(false);

  React.useEffect(() => {
    // 订阅页面栈管理器
    return pageStackManager.subscribe(setHasModalOpen);
  }, []);

  // 监听 Settings 开始关闭的事件
  React.useEffect(() => {
    const handleSettingsClosing = () => {
      // 立即更新状态，让主页面可以同时播放恢复动画
      // pageStackManager 会通过 hasAnyModalOpen 的 useEffect 自动更新
      setIsSettingsOpen(false);
    };

    window.addEventListener('settingsClosing', handleSettingsClosing);
    return () =>
      window.removeEventListener('settingsClosing', handleSettingsClosing);
  }, []);

  // 监听咖啡豆详情的打开/关闭事件
  React.useEffect(() => {
    const handleBeanDetailOpened = (e: Event) => {
      const customEvent = e as CustomEvent<{
        bean: ExtendedCoffeeBean;
        searchQuery?: string;
      }>;
      // 安全检查
      if (!customEvent.detail || !customEvent.detail.bean) {
        console.error('BeanDetailModal: 打开事件缺少必要数据');
        return;
      }
      setBeanDetailData(customEvent.detail.bean);
      setBeanDetailSearchQuery(customEvent.detail.searchQuery || '');
      setBeanDetailOpen(true);
    };

    const handleBeanDetailClosing = () => {
      setBeanDetailOpen(false);
    };

    window.addEventListener(
      'beanDetailOpened',
      handleBeanDetailOpened as EventListener
    );
    window.addEventListener('beanDetailClosing', handleBeanDetailClosing);

    return () => {
      window.removeEventListener(
        'beanDetailOpened',
        handleBeanDetailOpened as EventListener
      );
      window.removeEventListener('beanDetailClosing', handleBeanDetailClosing);
    };
  }, []);

  // 监听笔记详情的打开/关闭事件
  React.useEffect(() => {
    const handleNoteDetailOpened = (e: Event) => {
      const customEvent = e as CustomEvent<{
        note: BrewingNote;
        equipmentName: string;
        beanUnitPrice: number;
        beanInfo?: CoffeeBean | null;
      }>;
      // 安全检查
      if (!customEvent.detail || !customEvent.detail.note) {
        console.error('NoteDetailModal: 打开事件缺少必要数据');
        return;
      }
      setNoteDetailData({
        note: customEvent.detail.note,
        equipmentName: customEvent.detail.equipmentName,
        beanUnitPrice: customEvent.detail.beanUnitPrice,
        beanInfo: customEvent.detail.beanInfo,
      });
      setNoteDetailOpen(true);
    };

    const handleNoteDetailClosing = () => {
      setNoteDetailOpen(false);
    };

    window.addEventListener(
      'noteDetailOpened',
      handleNoteDetailOpened as EventListener
    );
    window.addEventListener('noteDetailClosing', handleNoteDetailClosing);

    return () => {
      window.removeEventListener(
        'noteDetailOpened',
        handleNoteDetailOpened as EventListener
      );
      window.removeEventListener('noteDetailClosing', handleNoteDetailClosing);
    };
  }, []);

  // 监听添加咖啡豆模态框的打开/关闭事件
  React.useEffect(() => {
    const handleBeanImportOpened = () => {
      setShowImportBeanForm(true);
    };

    const handleBeanImportClosing = () => {
      setShowImportBeanForm(false);
    };

    window.addEventListener('beanImportOpened', handleBeanImportOpened);
    window.addEventListener('beanImportClosing', handleBeanImportClosing);

    return () => {
      window.removeEventListener('beanImportOpened', handleBeanImportOpened);
      window.removeEventListener('beanImportClosing', handleBeanImportClosing);
    };
  }, []);

  // 监听笔记编辑模态框的打开/关闭事件
  React.useEffect(() => {
    const handleBrewingNoteEditOpened = (e: Event) => {
      const customEvent = e as CustomEvent<{
        data: BrewingNoteData;
        isCopy?: boolean;
      }>;
      if (!customEvent.detail || !customEvent.detail.data) {
        console.error('BrewingNoteEditModal: 打开事件缺少必要数据');
        return;
      }
      setBrewingNoteEditData(customEvent.detail.data);
      setIsBrewingNoteCopy(customEvent.detail.isCopy || false);
      setBrewingNoteEditOpen(true);
    };

    const handleBrewingNoteEditClosing = () => {
      setBrewingNoteEditOpen(false);
      setIsBrewingNoteCopy(false);
    };

    window.addEventListener(
      'brewingNoteEditOpened',
      handleBrewingNoteEditOpened as EventListener
    );
    window.addEventListener(
      'brewingNoteEditClosing',
      handleBrewingNoteEditClosing
    );

    return () => {
      window.removeEventListener(
        'brewingNoteEditOpened',
        handleBrewingNoteEditOpened as EventListener
      );
      window.removeEventListener(
        'brewingNoteEditClosing',
        handleBrewingNoteEditClosing
      );
    };
  }, []);

  return (
    <>
      {/* 主页面内容 - 应用转场动画 */}
      <div
        className="flex h-full flex-col overflow-y-scroll"
        style={getParentPageStyle(hasModalOpen)}
      >
        <NavigationBar
          activeMainTab={activeMainTab}
          setActiveMainTab={handleMainTabClick}
          activeBrewingStep={activeBrewingStep}
          parameterInfo={parameterInfo}
          setParameterInfo={setParameterInfo}
          editableParams={editableParams}
          setEditableParams={setEditableParams}
          isTimerRunning={isTimerRunning}
          showComplete={showComplete}
          selectedEquipment={selectedEquipment}
          selectedMethod={
            currentBrewingMethod
              ? {
                  name: currentBrewingMethod.name,
                  params: {
                    coffee: currentBrewingMethod.params.coffee,
                    water: currentBrewingMethod.params.water,
                    ratio: currentBrewingMethod.params.ratio,
                    grindSize: currentBrewingMethod.params.grindSize,
                    temp: currentBrewingMethod.params.temp,
                    stages: currentBrewingMethod.params.stages.map(stage => ({
                      label: stage.label,
                      time: stage.time || 0,
                      water: stage.water,
                      detail: stage.detail,
                      pourType: stage.pourType,
                    })),
                  },
                }
              : null
          }
          handleParamChange={handleParamChangeWrapper}
          handleExtractionTimeChange={handleExtractionTimeChange}
          setShowHistory={setShowHistory}
          onTitleDoubleClick={() => setIsSettingsOpen(true)}
          settings={settings}
          hasCoffeeBeans={hasCoffeeBeans}
          alternativeHeader={alternativeHeaderContent}
          showAlternativeHeader={showAlternativeHeader}
          currentBeanView={currentBeanView}
          showViewDropdown={showViewDropdown}
          onToggleViewDropdown={handleToggleViewDropdown}
          onBeanViewChange={handleBeanViewChange}
          customEquipments={customEquipments}
          onEquipmentSelect={handleEquipmentSelectWithName}
          onAddEquipment={() => setShowEquipmentForm(true)}
          onEditEquipment={equipment => {
            setEditingEquipment(equipment);
            setShowEquipmentForm(true);
          }}
          onDeleteEquipment={handleDeleteEquipment}
          onShareEquipment={handleShareEquipment}
          onBackClick={handleBackClick}
          onToggleEquipmentManagement={() =>
            setShowEquipmentManagement(!showEquipmentManagement)
          }
        />

        {activeMainTab === '冲煮' && (
          <div className="h-full space-y-5 overflow-y-auto">
            <TabContent
              activeMainTab={activeMainTab}
              activeTab={activeTab}
              content={content}
              selectedMethod={selectedMethod as Method}
              currentBrewingMethod={currentBrewingMethod as Method}
              isTimerRunning={isTimerRunning}
              showComplete={showComplete}
              currentStage={currentStage}
              isWaiting={isStageWaiting}
              selectedEquipment={selectedEquipment}
              selectedCoffeeBean={selectedCoffeeBean}
              selectedCoffeeBeanData={selectedCoffeeBeanData}
              countdownTime={countdownTime}
              customMethods={customMethods}
              actionMenuStates={actionMenuStates}
              setActionMenuStates={setActionMenuStates}
              setShowCustomForm={setShowCustomForm}
              setShowImportForm={setShowImportForm}
              settings={settings}
              onMethodSelect={handleMethodSelectWrapper}
              onCoffeeBeanSelect={handleCoffeeBeanSelect}
              onEditMethod={handleEditCustomMethod}
              onDeleteMethod={handleDeleteCustomMethod}
              onHideMethod={handleHideMethod}
              setActiveMainTab={setActiveMainTab}
              resetBrewingState={resetBrewingState}
              customEquipments={customEquipments}
              expandedStages={expandedStagesRef.current}
              setShowEquipmentForm={setShowEquipmentForm}
              setEditingEquipment={setEditingEquipment}
              handleDeleteEquipment={handleDeleteEquipment}
            />
          </div>
        )}
        {activeMainTab === '笔记' && (
          <BrewingHistory
            isOpen={true}
            onClose={() => {
              saveMainTabPreference('冲煮');
              setActiveMainTab('冲煮');
              setShowHistory(false);
            }}
            onAddNote={handleAddNote}
            setAlternativeHeaderContent={setAlternativeHeaderContent}
            setShowAlternativeHeader={setShowAlternativeHeader}
            settings={settings}
          />
        )}
        {activeMainTab === '咖啡豆' && (
          <CoffeeBeans
            key={beanListKey}
            isOpen={activeMainTab === '咖啡豆'}
            showBeanForm={handleBeanForm}
            onShowImport={() => {
              window.dispatchEvent(new CustomEvent('beanImportOpened'));
            }}
            externalViewMode={currentBeanView}
            onExternalViewChange={handleBeanViewChange}
            settings={{
              dateDisplayMode: settings.dateDisplayMode,
              showOnlyBeanName: settings.showOnlyBeanName,
              showFlavorInfo: settings.showFlavorInfo,
              limitNotesLines: settings.limitNotesLines,
              notesMaxLines: settings.notesMaxLines,
              showTotalPrice: settings.showTotalPrice,
              showStatusDots: settings.showStatusDots,
            }}
          />
        )}

        {activeMainTab === '冲煮' &&
          activeBrewingStep === 'method' &&
          selectedEquipment && (
            <MethodTypeSelector
              methodType={methodType}
              settings={settings}
              onSelectMethodType={handleMethodTypeChange}
              hideSelector={customEquipments.some(
                e =>
                  (e.id === selectedEquipment ||
                    e.name === selectedEquipment) &&
                  e.animationType === 'custom'
              )}
            />
          )}

        {activeMainTab === '冲煮' &&
          activeBrewingStep === 'brewing' &&
          currentBrewingMethod &&
          !showHistory && (
            <BrewingTimer
              currentBrewingMethod={currentBrewingMethod as Method}
              onStatusChange={({ isRunning }) => {
                const event = new CustomEvent('brewing:timerStatus', {
                  detail: {
                    isRunning,
                    status: isRunning ? 'running' : 'stopped',
                  },
                });
                window.dispatchEvent(event);
              }}
              onStageChange={({ currentStage, progress, isWaiting }) => {
                const event = new CustomEvent('brewing:stageChange', {
                  detail: {
                    currentStage,
                    stage: currentStage,
                    progress,
                    isWaiting,
                  },
                });
                window.dispatchEvent(event);
              }}
              onCountdownChange={time => {
                setTimeout(() => {
                  const event = new CustomEvent('brewing:countdownChange', {
                    detail: { remainingTime: time },
                  });
                  window.dispatchEvent(event);
                }, 0);
              }}
              onComplete={isComplete => {
                if (isComplete) {
                  const event = new CustomEvent('brewing:complete');
                  window.dispatchEvent(event);
                }
              }}
              onTimerComplete={() => {
                // 冲煮完成后的处理，确保显示笔记表单
                // 这里不需要额外设置，因为BrewingTimer组件内部已经处理了显示笔记表单的逻辑
              }}
              onExpandedStagesChange={stages => {
                expandedStagesRef.current = stages;
              }}
              settings={settings}
              selectedEquipment={selectedEquipment}
              isCoffeeBrewed={isCoffeeBrewed}
              layoutSettings={settings.layoutSettings}
            />
          )}

        <CustomMethodFormModal
          showCustomForm={showCustomForm}
          showImportForm={showImportForm}
          editingMethod={editingMethod}
          selectedEquipment={selectedEquipment}
          customMethods={customMethods}
          onSaveCustomMethod={method => {
            handleSaveCustomMethod(method);
          }}
          onCloseCustomForm={() => {
            setShowCustomForm(false);
            setEditingMethod(undefined);
          }}
          onCloseImportForm={() => {
            setShowImportForm(false);
          }}
        />

        <BrewingNoteFormModal
          key="note-form-modal"
          showForm={showNoteFormModal}
          initialNote={currentEditingNote}
          onSave={handleSaveBrewingNote}
          onClose={() => {
            setShowNoteFormModal(false);
            setCurrentEditingNote({});
          }}
          settings={settings}
        />

        <CustomEquipmentFormModal
          showForm={showEquipmentForm}
          onClose={() => {
            setShowEquipmentForm(false);
            setEditingEquipment(undefined);
          }}
          onSave={handleSaveEquipment}
          editingEquipment={editingEquipment}
          onImport={() => setShowEquipmentImportForm(true)}
        />

        <EquipmentImportModal
          showForm={showEquipmentImportForm}
          onImport={handleImportEquipment}
          onClose={() => setShowEquipmentImportForm(false)}
          existingEquipments={customEquipments}
        />

        {migrationData && (
          <DataMigrationModal
            isOpen={showDataMigration}
            onClose={() => setShowDataMigration(false)}
            legacyCount={migrationData.legacyCount}
            onMigrationComplete={handleMigrationComplete}
          />
        )}

        {showOnboarding && (
          <Onboarding
            onSettingsChange={handleSettingsChange}
            onComplete={handleOnboardingComplete}
          />
        )}

        <BackupReminderModal
          isOpen={showBackupReminder}
          onClose={() => setShowBackupReminder(false)}
          reminderType={reminderType}
        />
      </div>

      {/* 页面级别的视图选择覆盖层 - 独立渲染，不受父容器转场影响 */}
      <AnimatePresence>
        {showViewDropdown && activeMainTab === '咖啡豆' && (
          <>
            {/* 模糊背景 - 移动设备优化的动画 */}
            <motion.div
              initial={{
                opacity: 0,
                backdropFilter: 'blur(0px)',
              }}
              animate={{
                opacity: 1,
                backdropFilter: 'blur(20px)',
                transition: {
                  opacity: {
                    duration: 0.2,
                    ease: [0.25, 0.46, 0.45, 0.94],
                  },
                  backdropFilter: {
                    duration: 0.3,
                    ease: [0.25, 0.46, 0.45, 0.94],
                  },
                },
              }}
              exit={{
                opacity: 0,
                backdropFilter: 'blur(0px)',
                transition: {
                  opacity: {
                    duration: 0.15,
                    ease: [0.4, 0.0, 1, 1],
                  },
                  backdropFilter: {
                    duration: 0.2,
                    ease: [0.4, 0.0, 1, 1],
                  },
                },
              }}
              className="fixed inset-0 z-60"
              style={{
                backgroundColor:
                  'color-mix(in srgb, var(--background) 40%, transparent)',
                WebkitBackdropFilter: 'blur(4px)',
              }}
              onClick={() => setShowViewDropdown(false)}
            />

            {beanButtonPosition && (
              <motion.div
                initial={{ opacity: 1, scale: 1 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{
                  opacity: 0,
                  scale: 0.98,
                  transition: {
                    duration: 0.12,
                    ease: [0.4, 0.0, 1, 1],
                  },
                }}
                className="fixed z-80"
                style={{
                  top: `${beanButtonPosition.top}px`,
                  left: `${beanButtonPosition.left}px`,
                  minWidth: `${beanButtonPosition.width}px`,
                }}
                data-view-selector
              >
                <motion.button
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 1 }}
                  onClick={() => setShowViewDropdown(false)}
                  className="flex cursor-pointer items-center pb-3 text-left text-xs font-medium tracking-widest whitespace-nowrap text-neutral-800 transition-colors dark:text-neutral-100"
                  style={{ paddingBottom: '12px' }}
                >
                  <span className="relative inline-block">
                    {settings.simplifiedViewLabels
                      ? SIMPLIFIED_VIEW_LABELS[currentBeanView]
                      : VIEW_LABELS[currentBeanView]}
                  </span>
                  <ChevronsUpDown
                    size={12}
                    className="ml-1 text-neutral-400 dark:text-neutral-600"
                    color="currentColor"
                  />
                </motion.button>
              </motion.div>
            )}

            {beanButtonPosition && (
              <motion.div
                initial={{
                  opacity: 0,
                  y: -8,
                  scale: 0.96,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  transition: {
                    duration: 0.25,
                    ease: [0.25, 0.46, 0.45, 0.94],
                  },
                }}
                exit={{
                  opacity: 0,
                  y: -6,
                  scale: 0.98,
                  transition: {
                    duration: 0.15,
                    ease: [0.4, 0.0, 1, 1],
                  },
                }}
                className="fixed z-80"
                style={{
                  top: `${beanButtonPosition.top + 30}px`,
                  left: `${beanButtonPosition.left}px`,
                  minWidth: `${beanButtonPosition.width}px`,
                }}
                data-view-selector
              >
                <div className="flex flex-col">
                  {Object.entries(VIEW_LABELS)
                    .filter(([key]) => {
                      const viewKey = key as ViewOption;
                      if (viewKey === currentBeanView) return false;

                      // 如果已经被固定到导航栏，不显示在下拉菜单中
                      const isPinned =
                        settings.navigationSettings?.pinnedViews?.includes(
                          viewKey
                        );
                      if (isPinned) return false;

                      // Check visibility setting
                      const isVisible =
                        settings.navigationSettings?.coffeeBeanViews?.[
                          viewKey
                        ] ?? true;
                      return isVisible;
                    })
                    .map(([key], index) => {
                      const label = settings.simplifiedViewLabels
                        ? SIMPLIFIED_VIEW_LABELS[key as ViewOption]
                        : VIEW_LABELS[key as ViewOption];
                      return (
                        <motion.button
                          key={key}
                          initial={{
                            opacity: 0,
                            y: -6,
                            scale: 0.98,
                          }}
                          animate={{
                            opacity: 1,
                            y: 0,
                            scale: 1,
                            transition: {
                              delay: index * 0.04,
                              duration: 0.2,
                              ease: [0.25, 0.46, 0.45, 0.94],
                            },
                          }}
                          exit={{
                            opacity: 0,
                            y: -4,
                            scale: 0.98,
                            transition: {
                              delay:
                                (Object.keys(VIEW_LABELS).length - index - 1) *
                                0.02,
                              duration: 0.12,
                              ease: [0.4, 0.0, 1, 1],
                            },
                          }}
                          onClick={() =>
                            handleBeanViewChange(key as ViewOption)
                          }
                          className="flex items-center pb-3 text-left text-xs font-medium tracking-widest whitespace-nowrap text-neutral-500 transition-colors hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
                          style={{ paddingBottom: '12px' }}
                        >
                          <span className="relative inline-block">{label}</span>
                          <span className="ml-1 h-3 w-3" />
                        </motion.button>
                      );
                    })}
                </div>
              </motion.div>
            )}
          </>
        )}
      </AnimatePresence>

      {/* Settings 组件独立渲染，不受父容器转场影响 */}
      <Settings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        setSettings={setSettings}
        onDataChange={handleDataChange}
        hasSubSettingsOpen={hasSubSettingsOpen}
        subSettingsHandlers={{
          onOpenDisplaySettings: () => setShowDisplaySettings(true),
          onOpenNavigationSettings: () => setShowNavigationSettings(true),
          onOpenStockSettings: () => setShowStockSettings(true),
          onOpenBeanSettings: () => setShowBeanSettings(true),
          onOpenFlavorPeriodSettings: () => setShowFlavorPeriodSettings(true),
          onOpenTimerSettings: () => setShowTimerSettings(true),
          onOpenDataSettings: () => setShowDataSettings(true),
          onOpenNotificationSettings: () => setShowNotificationSettings(true),
          onOpenRandomCoffeeBeanSettings: () =>
            setShowRandomCoffeeBeanSettings(true),
          onOpenSearchSortSettings: () => setShowSearchSortSettings(true),
          onOpenFlavorDimensionSettings: () =>
            setShowFlavorDimensionSettings(true),
          onOpenHiddenMethodsSettings: () => setShowHiddenMethodsSettings(true),
          onOpenHiddenEquipmentsSettings: () =>
            setShowHiddenEquipmentsSettings(true),
          onOpenRoasterLogoSettings: () => setShowRoasterLogoSettings(true),
          onOpenGrinderSettings: () => setShowGrinderSettings(true),
        }}
      />

      {/* 所有子设置页面独立渲染，与 Settings 同级 */}
      {showDisplaySettings && (
        <DisplaySettings
          settings={settings}
          onClose={() => setShowDisplaySettings(false)}
          handleChange={handleSubSettingChange}
        />
      )}

      {showNavigationSettings && (
        <NavigationSettings
          settings={settings}
          onClose={() => setShowNavigationSettings(false)}
          handleChange={handleSubSettingChange}
        />
      )}

      {showStockSettings && (
        <StockSettings
          settings={settings}
          onClose={() => setShowStockSettings(false)}
          handleChange={handleSubSettingChange}
        />
      )}

      {showBeanSettings && (
        <BeanSettings
          settings={settings}
          onClose={() => setShowBeanSettings(false)}
          handleChange={handleSubSettingChange}
        />
      )}

      {showFlavorPeriodSettings && (
        <FlavorPeriodSettings
          settings={settings}
          onClose={() => setShowFlavorPeriodSettings(false)}
          handleChange={handleSubSettingChange}
        />
      )}

      {showTimerSettings && (
        <TimerSettings
          settings={settings}
          onClose={() => setShowTimerSettings(false)}
          handleChange={handleSubSettingChange}
        />
      )}

      {showDataSettings && (
        <DataSettings
          settings={settings}
          onClose={() => setShowDataSettings(false)}
          handleChange={handleSubSettingChange}
          onDataChange={handleDataChange}
        />
      )}

      {showNotificationSettings && (
        <NotificationSettings
          settings={settings}
          onClose={() => setShowNotificationSettings(false)}
          handleChange={handleSubSettingChange}
        />
      )}

      {showRandomCoffeeBeanSettings && (
        <RandomCoffeeBeanSettings
          settings={settings}
          onClose={() => setShowRandomCoffeeBeanSettings(false)}
          handleChange={handleSubSettingChange}
        />
      )}

      {showSearchSortSettings && (
        <SearchSortSettings
          settings={settings}
          onClose={() => setShowSearchSortSettings(false)}
          handleChange={handleSubSettingChange}
        />
      )}

      {showFlavorDimensionSettings && (
        <FlavorDimensionSettings
          settings={settings}
          onClose={() => setShowFlavorDimensionSettings(false)}
          handleChange={handleSubSettingChange}
        />
      )}

      {showHiddenMethodsSettings && (
        <HiddenMethodsSettings
          settings={settings}
          customEquipments={customEquipments}
          onClose={() => setShowHiddenMethodsSettings(false)}
          onChange={handleSettingsChange}
        />
      )}

      {showHiddenEquipmentsSettings && (
        <HiddenEquipmentsSettings
          settings={settings}
          customEquipments={customEquipments}
          onClose={() => setShowHiddenEquipmentsSettings(false)}
          onChange={handleSettingsChange}
        />
      )}

      {showRoasterLogoSettings && (
        <RoasterLogoSettings
          isOpen={showRoasterLogoSettings}
          onClose={() => setShowRoasterLogoSettings(false)}
          hapticFeedback={settings.hapticFeedback}
        />
      )}

      {showGrinderSettings && (
        <GrinderSettings
          settings={settings}
          onClose={() => setShowGrinderSettings(false)}
          handleChange={handleSubSettingChange}
        />
      )}

      {/* 咖啡豆表单模态框独立渲染，与 Settings 同级 */}
      <CoffeeBeanFormModal
        showForm={showBeanForm}
        initialBean={editingBean}
        onSave={handleSaveBean}
        onClose={() => {
          setShowBeanForm(false);
          setEditingBean(null);
        }}
        onRepurchase={
          editingBean
            ? async () => {
                try {
                  const { createRepurchaseBean } = await import(
                    '@/lib/utils/beanRepurchaseUtils'
                  );
                  const newBeanData = await createRepurchaseBean(editingBean);
                  // 关闭当前表单
                  setShowBeanForm(false);
                  setEditingBean(null);
                  // 打开新的表单用于续购
                  setTimeout(() => {
                    setEditingBean(newBeanData as ExtendedCoffeeBean);
                    setShowBeanForm(true);
                  }, 300);
                } catch (error) {
                  console.error('续购失败:', error);
                }
              }
            : undefined
        }
      />

      {/* 咖啡豆详情独立渲染，与 Settings 同级 */}
      <BeanDetailModal
        isOpen={beanDetailOpen}
        bean={beanDetailData}
        onClose={() => setBeanDetailOpen(false)}
        searchQuery={beanDetailSearchQuery}
        onEdit={bean => {
          setBeanDetailOpen(false);
          setEditingBean(bean);
          setShowBeanForm(true);
        }}
        onDelete={async bean => {
          setBeanDetailOpen(false);
          try {
            const { CoffeeBeanManager } = await import(
              '@/lib/managers/coffeeBeanManager'
            );
            await CoffeeBeanManager.deleteBean(bean.id);
            handleBeanListChange();
          } catch (error) {
            console.error('删除咖啡豆失败:', error);
          }
        }}
        onShare={async bean => {
          // 处理文本分享 - 复制到剪贴板
          try {
            const { beanToReadableText } = await import(
              '@/lib/utils/jsonUtils'
            );
            const { copyToClipboard } = await import('@/lib/utils/exportUtils');
            const { showToast } = await import(
              '@/components/common/feedback/LightToast'
            );

            const text = beanToReadableText(bean);
            const result = await copyToClipboard(text);

            if (result.success) {
              showToast({
                type: 'success',
                title: '已复制到剪贴板',
                duration: 2000,
              });

              // 触发震动反馈
              if (settings.hapticFeedback) {
                hapticsUtils.light();
              }
            } else {
              showToast({
                type: 'error',
                title: '复制失败',
                duration: 2000,
              });
            }
          } catch (error) {
            console.error('复制失败:', error);
          }
        }}
        onRepurchase={async bean => {
          setBeanDetailOpen(false);
          try {
            const { createRepurchaseBean } = await import(
              '@/lib/utils/beanRepurchaseUtils'
            );
            const newBeanData = await createRepurchaseBean(bean);
            // 直接传入新数据作为 initialBean，因为没有 id，会被当作新建
            setEditingBean(newBeanData as ExtendedCoffeeBean);
            setShowBeanForm(true);
          } catch (error) {
            console.error('续购失败:', error);
          }
        }}
      />

      {/* 添加咖啡豆模态框独立渲染，与 Settings 同级 */}
      <ImportModal
        showForm={showImportBeanForm}
        onImport={handleImportBean}
        onClose={() => setShowImportBeanForm(false)}
      />

      {/* 笔记编辑模态框独立渲染，与 Settings 同级 */}
      <BrewingNoteEditModal
        showModal={brewingNoteEditOpen}
        initialData={brewingNoteEditData}
        onSave={handleSaveBrewingNoteEdit}
        onClose={() => {
          setBrewingNoteEditOpen(false);
          setBrewingNoteEditData(null);
          setIsBrewingNoteCopy(false);
        }}
        settings={settings}
        isCopy={isBrewingNoteCopy}
      />

      {/* 笔记详情模态框独立渲染，与 Settings 同级 */}
      {noteDetailData && (
        <NoteDetailModal
          isOpen={noteDetailOpen}
          note={noteDetailData.note}
          onClose={() => setNoteDetailOpen(false)}
          equipmentName={noteDetailData.equipmentName}
          beanUnitPrice={noteDetailData.beanUnitPrice}
          beanInfo={noteDetailData.beanInfo}
          onEdit={async note => {
            setNoteDetailOpen(false);
            // 加载完整的笔记数据用于编辑
            const { Storage } = await import('@/lib/core/storage');
            const notesStr = await Storage.get('brewingNotes');
            if (notesStr) {
              const allNotes: BrewingNote[] = JSON.parse(notesStr);
              const fullNote = allNotes.find(n => n.id === note.id);
              if (fullNote) {
                setBrewingNoteEditData(fullNote as BrewingNoteData);
                setBrewingNoteEditOpen(true);
              }
            }
          }}
          onDelete={async noteId => {
            setNoteDetailOpen(false);
            try {
              const { Storage } = await import('@/lib/core/storage');
              const savedNotes = await Storage.get('brewingNotes');
              if (!savedNotes) return;

              const notes: BrewingNote[] = JSON.parse(savedNotes);

              // 找到要删除的笔记
              const noteToDelete = notes.find(note => note.id === noteId);
              if (!noteToDelete) {
                console.warn('未找到要删除的笔记:', noteId);
                return;
              }

              // 恢复咖啡豆容量（根据笔记类型采用不同的恢复策略）
              try {
                if (noteToDelete.source === 'capacity-adjustment') {
                  // 处理容量调整记录的恢复
                  const beanId = noteToDelete.beanId;
                  const capacityAdjustment =
                    noteToDelete.changeRecord?.capacityAdjustment;

                  if (beanId && capacityAdjustment) {
                    const changeAmount = capacityAdjustment.changeAmount;
                    if (
                      typeof changeAmount === 'number' &&
                      !isNaN(changeAmount) &&
                      changeAmount !== 0
                    ) {
                      const { CoffeeBeanManager } = await import(
                        '@/lib/managers/coffeeBeanManager'
                      );

                      // 获取当前咖啡豆信息
                      const currentBean =
                        await CoffeeBeanManager.getBeanById(beanId);
                      if (currentBean) {
                        const currentRemaining = parseFloat(
                          currentBean.remaining || '0'
                        );
                        const restoredRemaining =
                          currentRemaining - changeAmount; // 反向操作
                        let finalRemaining = Math.max(0, restoredRemaining);

                        // 确保不超过总容量
                        if (currentBean.capacity) {
                          const totalCapacity = parseFloat(
                            currentBean.capacity
                          );
                          if (!isNaN(totalCapacity) && totalCapacity > 0) {
                            finalRemaining = Math.min(
                              finalRemaining,
                              totalCapacity
                            );
                          }
                        }

                        const formattedRemaining =
                          CoffeeBeanManager.formatNumber(finalRemaining);
                        await CoffeeBeanManager.updateBean(beanId, {
                          remaining: formattedRemaining,
                        });
                      }
                    }
                  } else {
                    // 检测到无效的 beanId 或 capacityAdjustment，记录警告
                    console.warn('无效的 beanId 或 capacityAdjustment:', {
                      beanId,
                      capacityAdjustment,
                    });
                  }
                } else {
                  // 处理快捷扣除记录和普通笔记的恢复
                  const {
                    extractCoffeeAmountFromNote,
                    getNoteAssociatedBeanId,
                  } = await import('@/components/notes/utils');
                  const coffeeAmount =
                    extractCoffeeAmountFromNote(noteToDelete);
                  const beanId = getNoteAssociatedBeanId(noteToDelete);

                  if (beanId && coffeeAmount > 0) {
                    const { CoffeeBeanManager } = await import(
                      '@/lib/managers/coffeeBeanManager'
                    );
                    await CoffeeBeanManager.increaseBeanRemaining(
                      beanId,
                      coffeeAmount
                    );
                  }
                }
              } catch (error) {
                console.error('恢复咖啡豆容量失败:', error);
                // 容量恢复失败不应阻止笔记删除，但需要记录错误
              }

              // 删除笔记 - 使用 Zustand store
              const { useBrewingNoteStore } = await import(
                '@/lib/stores/brewingNoteStore'
              );
              const deleteNote = useBrewingNoteStore.getState().deleteNote;
              await deleteNote(noteId);
            } catch (error) {
              console.error('删除笔记失败:', error);
            }
          }}
          onCopy={async noteId => {
            setNoteDetailOpen(false);
            // 加载完整的笔记数据用于复制
            const { Storage } = await import('@/lib/core/storage');
            const notesStr = await Storage.get('brewingNotes');
            if (notesStr) {
              const allNotes: BrewingNote[] = JSON.parse(notesStr);
              const fullNote = allNotes.find(n => n.id === noteId);
              if (fullNote) {
                setBrewingNoteEditData(fullNote as BrewingNoteData);
                setIsBrewingNoteCopy(true);
                setBrewingNoteEditOpen(true);
              }
            }
          }}
          onShare={noteId => {
            // 关闭详情模态框
            setNoteDetailOpen(false);
            // 触发分享模式 - 通过自定义事件通知笔记列表组件
            window.dispatchEvent(
              new CustomEvent('noteShareTriggered', {
                detail: { noteId },
              })
            );
          }}
        />
      )}

      {/* 器具管理抽屉独立渲染，与 Settings 同级 */}
      <EquipmentManagementDrawer
        isOpen={showEquipmentManagement}
        onClose={() => setShowEquipmentManagement(false)}
        customEquipments={customEquipments}
        onAddEquipment={handleAddEquipment}
        onEditEquipment={handleEditEquipment}
        onDeleteEquipment={handleDeleteEquipment}
        onShareEquipment={handleShareEquipment}
        onReorderEquipments={handleReorderEquipments}
        settings={settings}
      />

      {/* ImageViewer 独立渲染在最外层，避免受到父组件透明度影响 */}
      {imageViewerOpen && imageViewerData && (
        <ImageViewer
          isOpen={imageViewerOpen}
          imageUrl={imageViewerData.url}
          alt={imageViewerData.alt}
          onClose={() => {
            setImageViewerOpen(false);
            setImageViewerData(null);
          }}
        />
      )}
    </>
  );
};

export default AppContainer;
