'use client';

// 导入React和必要的hooks
import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useLayoutEffect,
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
import { SettingsOptions } from '@/components/settings/Settings';
import { useSettingsStore, getSettingsStore } from '@/lib/stores/settingsStore';
import TabContent from '@/components/layout/TabContent';
import MethodTypeSelector from '@/components/method/forms/MethodTypeSelector';
import Onboarding from '@/components/onboarding/Onboarding';
import AppModals from '@/components/layout/AppModals';
import fontZoomUtils from '@/lib/utils/fontZoomUtils';
import { saveMainTabPreference } from '@/lib/navigation/navigationCache';
import {
  useMultiStepModalHistory,
  modalHistory,
} from '@/lib/hooks/useModalHistory';
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
} from '@/lib/stores/customEquipmentStore';
import { useDataLayer } from '@/providers/DataLayerProvider';
import DataMigrationModal from '@/components/common/modals/DataMigrationModal';
import { showToast } from '@/components/common/feedback/LightToast';
import BackupReminderModal from '@/components/common/modals/BackupReminderModal';
import {
  BackupReminderUtils,
  BackupReminderType,
} from '@/lib/utils/backupReminderUtils';
import YearlyReviewReminderDrawer from '@/components/common/modals/YearlyReviewReminderDrawer';
import { YearlyReviewReminderUtils } from '@/lib/utils/yearlyReviewReminderUtils';
import {
  getEquipmentNameById,
  getEquipmentById,
} from '@/lib/utils/equipmentUtils';
import {
  pageStackManager,
  getParentPageStyle,
  useIsLargeScreen,
} from '@/lib/navigation/pageTransition';
import BeanDetailModal from '@/components/coffee-bean/Detail/BeanDetailModal';
import NoteDetailModal from '@/components/notes/Detail/NoteDetailModal';
import type { ConvertToGreenPreview } from '@/components/coffee-bean/ConvertToGreenDrawer';
import { formatBeanDisplayName } from '@/lib/utils/beanVarietyUtils';

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
  estate?: string;
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
  // 等待 DataLayerProvider 完成初始化
  const { isInitialized: isDataLayerReady } = useDataLayer();

  useEffect(() => {
    // 必须等待数据层初始化完成
    if (!isDataLayerReady) return;

    const loadInitialData = async () => {
      // 确保只在客户端执行
      if (typeof window === 'undefined') {
        onInitialized({ hasBeans: false });
        return;
      }

      try {
        // 动态导入所有需要的模块
        const [{ Storage }, { getCoffeeBeanStore }] = await Promise.all([
          import('@/lib/core/storage'),
          import('@/lib/stores/coffeeBeanStore'),
        ]);

        // 检查咖啡豆状态
        const store = getCoffeeBeanStore();
        if (!store.initialized) {
          await store.loadBeans();
        }
        const beans = store.beans;
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
  }, [isDataLayerReady, onInitialized]);

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
  // 检测是否为大屏幕（lg 断点）- 用于三栏布局
  const isLargeScreen = useIsLargeScreen();

  // 使用设置相关状态
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // 子设置页面的状态
  const [showDisplaySettings, setShowDisplaySettings] = useState(false);
  const [showNavigationSettings, setShowNavigationSettings] = useState(false);
  const [showStockSettings, setShowStockSettings] = useState(false);
  const [showBeanSettings, setShowBeanSettings] = useState(false);
  const [showGreenBeanSettings, setShowGreenBeanSettings] = useState(false);
  const [showFlavorPeriodSettings, setShowFlavorPeriodSettings] =
    useState(false);
  const [showBrewingSettings, setShowBrewingSettings] = useState(false);
  const [showTimerSettings, setShowTimerSettings] = useState(false);
  const [showDataSettings, setShowDataSettings] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] =
    useState(false);
  const [showRandomCoffeeBeanSettings, setShowRandomCoffeeBeanSettings] =
    useState(false);
  const [showSearchSortSettings, setShowSearchSortSettings] = useState(false);
  const [showNoteSettings, setShowNoteSettings] = useState(false);
  const [showFlavorDimensionSettings, setShowFlavorDimensionSettings] =
    useState(false);
  const [showHiddenMethodsSettings, setShowHiddenMethodsSettings] =
    useState(false);
  const [showHiddenEquipmentsSettings, setShowHiddenEquipmentsSettings] =
    useState(false);
  const [showRoasterLogoSettings, setShowRoasterLogoSettings] = useState(false);
  const [showGrinderSettings, setShowGrinderSettings] = useState(false);
  const [showExperimentalSettings, setShowExperimentalSettings] =
    useState(false);
  const [showAboutSettings, setShowAboutSettings] = useState(false);

  // 计算是否有任何子设置页面打开
  const hasSubSettingsOpen =
    showDisplaySettings ||
    showNavigationSettings ||
    showStockSettings ||
    showBeanSettings ||
    showGreenBeanSettings ||
    showFlavorPeriodSettings ||
    showBrewingSettings ||
    showTimerSettings ||
    showDataSettings ||
    showNotificationSettings ||
    showRandomCoffeeBeanSettings ||
    showSearchSortSettings ||
    showNoteSettings ||
    showFlavorDimensionSettings ||
    showHiddenMethodsSettings ||
    showHiddenEquipmentsSettings ||
    showRoasterLogoSettings ||
    showGrinderSettings ||
    showExperimentalSettings ||
    showAboutSettings;

  // 使用 Zustand settingsStore 管理设置
  const settings = useSettingsStore(state => state.settings) as SettingsOptions;
  const updateSettings = useSettingsStore(state => state.updateSettings);
  const storeInitialized = useSettingsStore(state => state.initialized);
  const loadSettingsFromStore = useSettingsStore(state => state.loadSettings);

  // 初始化加载设置 - 使用 settingsStore
  useEffect(() => {
    const initSettings = async () => {
      if (!storeInitialized) {
        await loadSettingsFromStore();
      }
      // 应用字体缩放级别
      const currentSettings = getSettingsStore().settings;
      if (
        currentSettings.textZoomLevel &&
        typeof currentSettings.textZoomLevel === 'number'
      ) {
        fontZoomUtils.set(currentSettings.textZoomLevel);
      }
    };

    initSettings();
  }, [storeInitialized, loadSettingsFromStore]);

  // 咖啡豆表单状态
  const [showBeanForm, setShowBeanForm] = useState(false);
  const [editingBeanState, setEditingBeanState] = useState<'green' | 'roasted'>(
    'roasted'
  );
  const [editingBean, setEditingBean] = useState<ExtendedCoffeeBean | null>(
    null
  );
  // 烘焙来源生豆ID（当从生豆详情页点击"去烘焙"时设置）
  const [roastingSourceBeanId, setRoastingSourceBeanId] = useState<
    string | null
  >(null);
  const [beanListKey, setBeanListKey] = useState(0);
  const [showImportBeanForm, setShowImportBeanForm] = useState(false);
  const [importingBeanState, setImportingBeanState] = useState<
    'green' | 'roasted'
  >('roasted');
  // 识别时使用的原始图片 base64（用于在表单中显示）
  const [recognitionImage, setRecognitionImage] = useState<string | null>(null);

  // 咖啡豆详情状态
  const [beanDetailOpen, setBeanDetailOpen] = useState(false);
  const [beanDetailData, setBeanDetailData] =
    useState<ExtendedCoffeeBean | null>(null);
  const [beanDetailSearchQuery, setBeanDetailSearchQuery] = useState('');
  // 沉浸式添加模式状态
  const [beanDetailAddMode, setBeanDetailAddMode] = useState(false);
  const [beanDetailAddBeanState, setBeanDetailAddBeanState] = useState<
    'green' | 'roasted'
  >('roasted');

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

  // 详情面板宽度拖动状态（大屏幕）
  const DETAIL_PANEL_MIN_WIDTH = 320; // 最小宽度
  const DETAIL_PANEL_MAX_WIDTH = 640; // 最大宽度
  const DETAIL_PANEL_DEFAULT_WIDTH = 384; // 默认宽度 (w-96)
  const DETAIL_PANEL_STORAGE_KEY = 'detailPanelWidth';

  // 导航栏宽度拖动状态（大屏幕）
  const NAV_PANEL_MIN_WIDTH = 120; // 最小宽度
  const NAV_PANEL_MAX_WIDTH = 280; // 最大宽度
  const NAV_PANEL_DEFAULT_WIDTH = 144; // 默认宽度 (w-36 = 9rem = 144px)
  const NAV_PANEL_STORAGE_KEY = 'navPanelWidth';

  const [navPanelWidth, setNavPanelWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(NAV_PANEL_STORAGE_KEY);
      if (saved) {
        const width = parseInt(saved, 10);
        if (
          !isNaN(width) &&
          width >= NAV_PANEL_MIN_WIDTH &&
          width <= NAV_PANEL_MAX_WIDTH
        ) {
          return width;
        }
      }
    }
    return NAV_PANEL_DEFAULT_WIDTH;
  });
  const [isNavResizing, setIsNavResizing] = useState(false);
  const navResizeStartXRef = useRef(0);
  const navResizeStartWidthRef = useRef(NAV_PANEL_DEFAULT_WIDTH);

  const [detailPanelWidth, setDetailPanelWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(DETAIL_PANEL_STORAGE_KEY);
      if (saved) {
        const width = parseInt(saved, 10);
        if (
          !isNaN(width) &&
          width >= DETAIL_PANEL_MIN_WIDTH &&
          width <= DETAIL_PANEL_MAX_WIDTH
        ) {
          return width;
        }
      }
    }
    return DETAIL_PANEL_DEFAULT_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(DETAIL_PANEL_DEFAULT_WIDTH);

  // 拖动处理函数
  const handleResizeStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      setIsResizing(true);
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      resizeStartXRef.current = clientX;
      resizeStartWidthRef.current = detailPanelWidth;
    },
    [detailPanelWidth]
  );

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      // 从右向左拖动增加宽度，所以是起始位置减去当前位置
      const delta = resizeStartXRef.current - clientX;
      const newWidth = Math.min(
        DETAIL_PANEL_MAX_WIDTH,
        Math.max(DETAIL_PANEL_MIN_WIDTH, resizeStartWidthRef.current + delta)
      );
      setDetailPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      // 保存到 localStorage
      localStorage.setItem(
        DETAIL_PANEL_STORAGE_KEY,
        detailPanelWidth.toString()
      );
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleMouseMove);
    document.addEventListener('touchend', handleMouseUp);

    // 拖动时禁用文本选择
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleMouseMove);
      document.removeEventListener('touchend', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing, detailPanelWidth]);

  // 导航栏拖动处理函数
  const handleNavResizeStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      setIsNavResizing(true);
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      navResizeStartXRef.current = clientX;
      navResizeStartWidthRef.current = navPanelWidth;
    },
    [navPanelWidth]
  );

  useEffect(() => {
    if (!isNavResizing) return;

    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      // 从左向右拖动增加宽度
      const delta = clientX - navResizeStartXRef.current;
      const newWidth = Math.min(
        NAV_PANEL_MAX_WIDTH,
        Math.max(NAV_PANEL_MIN_WIDTH, navResizeStartWidthRef.current + delta)
      );
      setNavPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsNavResizing(false);
      // 保存到 localStorage
      localStorage.setItem(NAV_PANEL_STORAGE_KEY, navPanelWidth.toString());
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleMouseMove);
    document.addEventListener('touchend', handleMouseUp);

    // 拖动时禁用文本选择
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleMouseMove);
      document.removeEventListener('touchend', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isNavResizing, navPanelWidth]);

  // ImageViewer 状态
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [imageViewerData, setImageViewerData] = useState<{
    url: string;
    alt: string;
    backUrl?: string;
  } | null>(null);

  // 计算是否有任何模态框打开（Settings、子设置、咖啡豆详情、笔记详情）
  // 注意：咖啡豆导入是 ActionDrawer 抽屉式组件，不需要触发主页面转场动画
  // 注意：brewingNoteEditOpen 使用 ResponsiveModal，自己管理动画和历史栈
  const hasAnyModalOpen =
    isSettingsOpen || hasSubSettingsOpen || beanDetailOpen || noteDetailOpen;

  // 详情页类型的模态框（咖啡豆/笔记详情）- 在大屏幕时作为右侧面板显示，主页面不需要动画
  const hasDetailModalOpen = beanDetailOpen || noteDetailOpen;

  // 其他模态框（设置页等）- 在大屏幕时仍然是全屏覆盖，主页面需要动画
  // 注意：brewingNoteEditOpen 使用 ResponsiveModal，自己管理动画，不需要触发主页面转场
  const hasOverlayModalOpen = isSettingsOpen || hasSubSettingsOpen;

  // 统一管理 pageStackManager 的状态
  React.useEffect(() => {
    pageStackManager.setModalOpen(hasAnyModalOpen);
  }, [hasAnyModalOpen]);

  // 自动跳转到笔记的状态
  const [hasAutoNavigatedToNotes, setHasAutoNavigatedToNotes] = useState(false);

  // 始终从 method 步骤开始，避免在设置加载前进入咖啡豆步骤
  // 后续的 useEffect 会根据设置和咖啡豆状态调整到正确的步骤
  const [isStageWaiting, setIsStageWaiting] = useState(false);
  const brewingState = useBrewingState('method');
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
    handleDeleteCustomMethod: executeDeleteCustomMethod,
    handleHideMethod: executeHideMethod,
    navigateToStep,
  } = brewingState;

  // 包装删除方案函数，添加确认抽屉
  const handleDeleteCustomMethod = useCallback(
    async (method: Method) => {
      setDeleteConfirmData({
        itemName: method.name,
        itemType: '方案',
        onConfirm: () => executeDeleteCustomMethod(method),
      });
      setShowDeleteConfirm(true);
    },
    [executeDeleteCustomMethod]
  );

  // 包装隐藏方案函数，添加确认抽屉
  const handleHideMethod = useCallback(
    async (method: Method) => {
      setConfirmDrawerData({
        message: (
          <>
            确定要隐藏方案
            <span className="text-neutral-800 dark:text-neutral-200">
              「{method.name}」
            </span>
            吗？隐藏的方案可以在设置中恢复。
          </>
        ),
        confirmText: '确认隐藏',
        onConfirm: () => executeHideMethod(method),
      });
      setShowConfirmDrawer(true);
    },
    [executeHideMethod]
  );

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
  // 用于导入器具后回填数据到添加器具表单
  const [pendingImportEquipment, setPendingImportEquipment] = useState<{
    equipment: CustomEquipment;
    methods?: Method[];
  } | null>(null);
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

  // 年度回顾提醒状态
  const [showYearlyReviewReminder, setShowYearlyReviewReminder] =
    useState(false);

  // 转生豆确认抽屉状态
  const [showConvertToGreenDrawer, setShowConvertToGreenDrawer] =
    useState(false);
  const [convertToGreenPreview, setConvertToGreenPreview] =
    useState<ConvertToGreenPreview | null>(null);

  // 转生豆确认处理函数
  const handleConvertToGreenConfirm = useCallback(async () => {
    if (!convertToGreenPreview) return;

    try {
      const { RoastingManager } = await import(
        '@/lib/managers/roastingManager'
      );

      const result = await RoastingManager.convertRoastedToGreen(
        convertToGreenPreview.beanId
      );

      if (result.success) {
        setBeanDetailOpen(false);

        showToast({
          type: 'success',
          title: '转换成功',
          duration: 2000,
        });

        handleBeanListChange();
      } else {
        showToast({
          type: 'error',
          title: result.error || '转换失败',
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('转换失败:', error);
      showToast({
        type: 'error',
        title: '转换失败',
        duration: 2000,
      });
    }
  }, [convertToGreenPreview]);

  // 删除确认抽屉状态
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmData, setDeleteConfirmData] = useState<{
    itemName: string;
    itemType: string;
    onConfirm: () => void;
  } | null>(null);

  // 通用确认抽屉状态（用于隐藏方案等非删除操作）
  const [showConfirmDrawer, setShowConfirmDrawer] = useState(false);
  const [confirmDrawerData, setConfirmDrawerData] = useState<{
    message: React.ReactNode;
    confirmText: string;
    onConfirm: () => void;
  } | null>(null);

  // 在 settings 加载完成后，根据 showCoffeeBeanSelectionStep 设置调整初始步骤
  // 这是为了处理初始化时 settings 还未加载的情况
  const hasAdjustedInitialStep = useRef(false);
  useEffect(() => {
    // 只在 settings 初始化完成后执行一次
    if (!storeInitialized || hasAdjustedInitialStep.current) return;
    hasAdjustedInitialStep.current = true;

    const showBeanStep = settings.showCoffeeBeanSelectionStep !== false;
    // 检查冲煮 tab 是否可见
    const isBrewingTabVisible =
      settings.navigationSettings?.visibleTabs?.brewing !== false;

    // 只有当冲煮 tab 可见且当前在冲煮 tab 时，才调整冲煮步骤
    if (isBrewingTabVisible && activeMainTab === '冲煮') {
      // 如果设置开启了咖啡豆步骤且有咖啡豆，且当前在 method 步骤，则跳转到咖啡豆步骤
      if (showBeanStep && initialHasBeans && activeBrewingStep === 'method') {
        navigateToStep('coffeeBean');
      }
      // 如果设置关闭了咖啡豆步骤，且当前在咖啡豆步骤，则跳转到方案步骤
      else if (!showBeanStep && activeBrewingStep === 'coffeeBean') {
        navigateToStep('method');
      }
    }

    // 标记首次初始化完成，更新 prevMainTabRef 以避免主 tab 切换 useEffect 重复处理
    prevMainTabRef.current = activeMainTab;
  }, [
    storeInitialized,
    settings.showCoffeeBeanSelectionStep,
    settings.navigationSettings?.visibleTabs?.brewing,
    activeMainTab,
    activeBrewingStep,
    navigateToStep,
    initialHasBeans,
  ]);

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

    // 添加事件监听（监听多个事件名以确保兼容）
    window.addEventListener('customEquipmentUpdate', handleEquipmentUpdate);
    window.addEventListener(
      'customEquipmentDataChanged',
      handleEquipmentUpdate
    );
    window.addEventListener('storage:changed', handleStorageChange);

    return () => {
      window.removeEventListener(
        'customEquipmentUpdate',
        handleEquipmentUpdate
      );
      window.removeEventListener(
        'customEquipmentDataChanged',
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
          let isCompleted = onboardingCompleted === 'true';
          if (!isCompleted) {
            try {
              const { db } = await import('@/lib/core/db');
              const fallback = await db.settings.get('onboardingCompleted');
              isCompleted = fallback?.value === 'true';
            } catch {
              // 静默处理错误
            }
          }
          if (isMounted) {
            setShowOnboarding(!isCompleted);
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

  // 检查备份提醒和年度回顾提醒
  useEffect(() => {
    const checkReminders = async () => {
      try {
        // 先检查备份提醒
        const shouldShowBackup = await BackupReminderUtils.shouldShowReminder();
        if (shouldShowBackup) {
          const currentReminderType =
            await BackupReminderUtils.getReminderType();
          setReminderType(currentReminderType);
          setShowBackupReminder(true);
          // 如果显示了备份提醒，不再检查年度回顾提醒
          return;
        }

        // 没有备份提醒时，检查年度回顾提醒
        const shouldShowYearlyReview =
          await YearlyReviewReminderUtils.shouldShowReminder();
        if (shouldShowYearlyReview) {
          setShowYearlyReviewReminder(true);
        }
      } catch (error) {
        console.error('检查提醒失败:', error);
      }
    };

    // 延迟检查，确保应用完全加载
    const timer = setTimeout(checkReminders, 3000);
    return () => clearTimeout(timer);
  }, []);

  // 设置变化事件监听已由 settingsStore 自动处理
  // settingsStore 使用 subscribeWithSelector 会自动触发 UI 更新
  // 保留事件监听用于兼容旧代码（如第三方组件监听 settingsChanged 事件）

  // 监听 ImageViewer 打开事件
  useEffect(() => {
    const handleImageViewerOpen = (
      e: CustomEvent<{ url: string; alt: string; backUrl?: string }>
    ) => {
      setImageViewerData({
        url: e.detail.url,
        alt: e.detail.alt,
        backUrl: e.detail.backUrl,
      });
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
    // 切换视图时关闭咖啡豆详情页（大屏幕三栏布局下）
    if (beanDetailOpen) {
      setBeanDetailOpen(false);
      setBeanDetailAddMode(false);
    }

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
          // 只更新萃取类型的步骤时间（使用 duration 字段）
          if (stage.pourType === 'extraction') {
            return { ...stage, duration: time };
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

    // 首次加载时（prevMainTabRef.current === null），由 hasAdjustedInitialStep useEffect 处理
    // 等待它完成初始化后再处理后续的标签切换
    if (prevMainTabRef.current === null) {
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
    // 只有当设置开启且有咖啡豆时才从咖啡豆步骤开始
    const showBeanStep = settings.showCoffeeBeanSelectionStep !== false;
    if (
      shouldStartFromCoffeeBeanStep === 'true' &&
      hasCoffeeBeans &&
      showBeanStep
    ) {
      localStorage.removeItem('shouldStartFromCoffeeBeanStep');
      resetBrewingState(false);
      navigateToStep('coffeeBean');
      prevMainTabRef.current = activeMainTab;
      return;
    }
    // 如果设置关闭，清除标记
    if (shouldStartFromCoffeeBeanStep === 'true' && !showBeanStep) {
      localStorage.removeItem('shouldStartFromCoffeeBeanStep');
    }

    // 从其他标签切换到冲煮标签时，根据设置决定起始步骤
    // 如果开启了咖啡豆选择步骤且有咖啡豆，应该从咖啡豆步骤开始
    // 如果关闭了咖啡豆选择步骤，应该从方案步骤开始
    const targetStep = hasCoffeeBeans && showBeanStep ? 'coffeeBean' : 'method';

    // 只有当当前步骤不是目标起始步骤时才需要重置
    // 例如：如果已经在 brewing 或 notes 步骤，说明用户正在进行冲煮流程，不应该打断
    const isInActiveBrewingFlow =
      activeBrewingStep === 'brewing' || activeBrewingStep === 'notes';
    if (isInActiveBrewingFlow) {
      // 用户正在冲煮流程中，不打断
      prevMainTabRef.current = activeMainTab;
      return;
    }

    // 重置到正确的起始步骤
    resetBrewingState(false);
    navigateToStep(targetStep);
    prevMainTabRef.current = activeMainTab;
  }, [
    activeMainTab,
    activeBrewingStep,
    resetBrewingState,
    prevMainTabRef,
    setShowHistory,
    navigateToStep,
    hasCoffeeBeans,
    settings.showCoffeeBeanSelectionStep,
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

  // 处理设置变更 - 使用 settingsStore
  const handleSettingsChange = useCallback(
    async (newSettings: SettingsOptions) => {
      try {
        // 使用 any 类型绕过 SettingsOptions 和 AppSettings 之间的微小差异
        await updateSettings(newSettings as any);
        if (newSettings.textZoomLevel) {
          fontZoomUtils.set(newSettings.textZoomLevel);
        }
      } catch (error) {
        console.error('[page] handleSettingsChange error:', error);
      }
    },
    [updateSettings]
  );

  // 处理子设置变更 - 使用 settingsStore
  const handleSubSettingChange = useCallback(
    async (key: string, value: any) => {
      try {
        await updateSettings({ [key]: value } as any);
      } catch (error) {
        console.error('[page] handleSubSettingChange error:', error);
      }
    },
    [updateSettings]
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
    // 根据设置决定是否显示咖啡豆选择步骤
    const showBeanStep = settings.showCoffeeBeanSelectionStep !== false;
    // 定义步骤返回映射
    const BACK_STEPS: Record<BrewingStep, BrewingStep | null> = {
      brewing: 'method',
      method: hasCoffeeBeans && showBeanStep ? 'coffeeBean' : null,
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
    settings.showCoffeeBeanSelectionStep,
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

    // 切换主 Tab 时关闭详情页（大屏幕三栏布局下）
    if (beanDetailOpen) {
      setBeanDetailOpen(false);
      setBeanDetailAddMode(false);
    }
    if (noteDetailOpen) {
      setNoteDetailOpen(false);
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

      // 动态导入 coffeeBeanStore
      const { getCoffeeBeanStore } = await import(
        '@/lib/stores/coffeeBeanStore'
      );
      const store = getCoffeeBeanStore();

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
            // 生豆模式下，将roastDate作为purchaseDate处理
            roastDate:
              importingBeanState === 'green'
                ? ''
                : (beanData.roastDate && beanData.roastDate.trim()) || '',
            // 生豆模式下，使用roastDate作为purchaseDate（因为AI识别返回的是roastDate字段）
            ...(importingBeanState === 'green' &&
            beanData.roastDate &&
            beanData.roastDate.trim()
              ? { purchaseDate: beanData.roastDate.trim() }
              : {}),
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

          // 设置 beanState（根据当前导入模式）
          bean.beanState = importingBeanState;

          // 只在字段存在时才设置其他可选字段
          if (beanData.roaster !== undefined) bean.roaster = beanData.roaster;
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
                ('origin' in comp ||
                  'estate' in comp ||
                  'process' in comp ||
                  'variety' in comp)
            );

            if (validComponents.length > 0) {
              bean.blendComponents = validComponents.map((comp: unknown) => {
                const component = comp as Record<string, unknown>;
                return {
                  origin: (component.origin as string) || '',
                  estate: (component.estate as string) || '',
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
            const legacyEstate = beanDataRecord.estate as string;
            const legacyProcess = beanDataRecord.process as string;
            const legacyVariety = beanDataRecord.variety as string;

            if (
              legacyOrigin ||
              legacyEstate ||
              legacyProcess ||
              legacyVariety
            ) {
              bean.blendComponents = [
                {
                  percentage: 100,
                  origin: legacyOrigin || '',
                  estate: legacyEstate || '',
                  process: legacyProcess || '',
                  variety: legacyVariety || '',
                },
              ];
            }
          }

          // beanType字段保持可选，不强制设置默认值

          // 添加到数据库
          const newBean = await store.addBean(bean);
          lastImportedBean = newBean;
          importCount++;
        }
      } finally {
        // 批量操作完成
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

  const handleBeanForm = (
    bean: ExtendedCoffeeBean | null = null,
    beanState?: 'green' | 'roasted'
  ) => {
    setEditingBean(bean);
    setEditingBeanState(beanState || 'roasted');
    setShowBeanForm(true);
  };

  // 完全重写checkCoffeeBeans函数，简化逻辑
  const checkCoffeeBeans = useCallback(async () => {
    try {
      const { getCoffeeBeanStore } = await import(
        '@/lib/stores/coffeeBeanStore'
      );
      const beans = getCoffeeBeanStore().beans;
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

  // 注意：从咖啡豆页面切换回冲煮页面的特殊处理已在上面的 useEffect 中统一处理
  // shouldStartFromCoffeeBeanStep 标记会在主 Tab 切换逻辑中被检查和清除

  const handleSaveBean = async (
    bean: Omit<ExtendedCoffeeBean, 'id' | 'timestamp'>
  ) => {
    try {
      const { getCoffeeBeanStore } = await import(
        '@/lib/stores/coffeeBeanStore'
      );
      const store = getCoffeeBeanStore();
      const currentBeans = store.beans;
      const isFirstBean = !editingBean?.id && currentBeans.length === 0;

      // 检查是否是烘焙操作（从生豆转换为熟豆）
      if (roastingSourceBeanId && bean.sourceGreenBeanId) {
        // 调用 RoastingManager 完成烘焙转熟豆流程
        const { RoastingManager } = await import(
          '@/lib/managers/roastingManager'
        );
        const { showToast } = await import(
          '@/components/common/feedback/LightToast'
        );

        // 获取烘焙量（用户填写的容量）
        const roastedAmount = parseFloat(bean.capacity || '0');

        if (roastedAmount <= 0) {
          showToast({
            type: 'error',
            title: '请填写烘焙后的容量',
            duration: 2000,
          });
          return;
        }

        // 如果用户没有填写价格，自动根据生豆价格计算
        let finalBean = { ...bean };
        if (!bean.price || bean.price.trim() === '') {
          const greenBean = store.getBeanById(roastingSourceBeanId);
          if (greenBean?.price && greenBean?.capacity) {
            const greenPrice = parseFloat(greenBean.price);
            const greenCapacity = parseFloat(greenBean.capacity);
            if (greenPrice > 0 && greenCapacity > 0) {
              // 熟豆价格 = 生豆单价 × 烘焙量
              const roastedPrice = (greenPrice / greenCapacity) * roastedAmount;
              finalBean.price = roastedPrice.toFixed(2);
            }
          }
        }

        // 调用烘焙方法，会自动扣除生豆容量并创建烘焙记录
        const result = await RoastingManager.roastGreenBean(
          roastingSourceBeanId,
          roastedAmount,
          finalBean
        );

        if (!result.success) {
          showToast({
            type: 'error',
            title: result.error || '烘焙失败',
            duration: 2000,
          });
          return;
        }

        showToast({
          type: 'success',
          title: `烘焙成功，已创建熟豆`,
          duration: 2000,
        });

        // 清除烘焙源生豆ID
        setRoastingSourceBeanId(null);
      } else if (editingBean?.id) {
        // 普通编辑操作
        await store.updateBean(editingBean.id, bean);
      } else {
        // 普通新增操作
        await store.addBean(bean);
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
    // 重新加载设置 - 使用 settingsStore
    try {
      await loadSettingsFromStore();
    } catch (error) {
      console.error('[page] handleDataChange: 加载设置失败', error);
    }

    try {
      const methods = await import('@/lib/stores/customMethodStore').then(
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

  // ==================== 云同步相关状态和处理 ====================
  // 检查云同步是否已启用且连接成功，并且开启了下拉上传功能
  const isCloudSyncEnabled = useCallback(() => {
    const activeType = settings.activeSyncType;
    if (!activeType || activeType === 'none') return false;

    if (activeType === 's3') {
      return (
        settings.s3Sync?.lastConnectionSuccess &&
        settings.s3Sync?.enablePullToSync !== false
      );
    }
    if (activeType === 'webdav') {
      return (
        settings.webdavSync?.lastConnectionSuccess &&
        settings.webdavSync?.enablePullToSync !== false
      );
    }
    return false; // Supabase 不支持下拉同步
  }, [settings.activeSyncType, settings.s3Sync, settings.webdavSync]);

  // 下拉上传处理函数
  const handlePullToSync = useCallback(async (): Promise<{
    success: boolean;
    message?: string;
  }> => {
    try {
      const activeType = settings.activeSyncType;
      if (!activeType || activeType === 'none') {
        return { success: false, message: '云同步未配置' };
      }

      let connected = false;
      let result: {
        success: boolean;
        uploadedFiles?: number;
        message?: string;
      } | null = null;

      if (activeType === 's3' && settings.s3Sync?.lastConnectionSuccess) {
        const { S3SyncManager } = await import('@/lib/s3/syncManagerV2');
        const cfg = settings.s3Sync;
        const mgr = new S3SyncManager();
        connected = await mgr.initialize({
          region: cfg.region,
          accessKeyId: cfg.accessKeyId,
          secretAccessKey: cfg.secretAccessKey,
          bucketName: cfg.bucketName,
          prefix: cfg.prefix,
          endpoint: cfg.endpoint || undefined,
        });
        if (connected) {
          result = await mgr.sync({ preferredDirection: 'upload' });
        }
      } else if (
        activeType === 'webdav' &&
        settings.webdavSync?.lastConnectionSuccess
      ) {
        const { WebDAVSyncManager } = await import('@/lib/webdav/syncManager');
        const cfg = settings.webdavSync;
        const mgr = new WebDAVSyncManager();
        connected = await mgr.initialize({
          url: cfg.url,
          username: cfg.username,
          password: cfg.password,
          remotePath: cfg.remotePath,
        });
        if (connected) {
          result = await mgr.sync({ preferredDirection: 'upload' });
        }
      } else {
        return { success: false, message: '云同步未配置' };
      }

      if (!connected || !result) {
        return { success: false, message: '云同步连接失败' };
      }

      if (result.success) {
        const uploaded = result.uploadedFiles ?? 0;
        if (uploaded > 0) {
          return { success: true, message: `已上传 ${uploaded} 项` };
        } else {
          return { success: true, message: '数据已是最新' };
        }
      } else {
        return { success: false, message: result.message || '上传失败' };
      }
    } catch (error) {
      console.error('下拉上传失败:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : '上传失败',
      };
    }
  }, [settings.activeSyncType, settings.s3Sync, settings.webdavSync]);
  // ==================== 云同步相关状态和处理结束 ====================

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
        const { getBeanByName } = await import('@/lib/stores/coffeeBeanStore');
        const bean = await getBeanByName(beanName);
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
              duration: stage.duration,
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

  // 冲煮页面历史栈管理 - 使用统一的多步骤历史栈系统
  // 将冲煮步骤映射为数字步骤（根据是否有咖啡豆和设置调整）：
  // 有豆且设置开启时：coffeeBean=0(起点), method=1, brewing=2, notes=3
  // 无豆或设置关闭时：method=0(起点), brewing=1, notes=2
  const getBrewingStepNumber = (): number => {
    if (activeMainTab !== '冲煮') return 0;

    const showBeanStep = settings.showCoffeeBeanSelectionStep !== false;

    if (hasCoffeeBeans && showBeanStep) {
      // 有咖啡豆且设置开启的流程
      switch (activeBrewingStep) {
        case 'coffeeBean':
          return 0; // 起点，不添加历史
        case 'method':
          return 1;
        case 'brewing':
          return 2;
        case 'notes':
          return 3;
        default:
          return 0;
      }
    } else {
      // 无咖啡豆或设置关闭的流程
      switch (activeBrewingStep) {
        case 'method':
          return 0; // 起点，不添加历史
        case 'brewing':
          return 1;
        case 'notes':
          return 2;
        default:
          return 0;
      }
    }
  };

  const brewingStep = getBrewingStepNumber();
  const isInBrewingFlow = activeMainTab === '冲煮' && brewingStep > 0;
  const isBrewingMainTab = activeMainTab === '冲煮';
  const isNotesMainTab = activeMainTab === '笔记';
  const isBeansMainTab = activeMainTab === '咖啡豆';
  const shouldShowBrewingTimer =
    activeBrewingStep === 'brewing' && currentBrewingMethod && !showHistory;

  const brewingTimerRef = useRef<HTMLDivElement | null>(null);
  const [brewingTimerHeight, setBrewingTimerHeight] = useState(0);

  useLayoutEffect(() => {
    if (!shouldShowBrewingTimer || !brewingTimerRef.current) {
      setBrewingTimerHeight(0);
      return;
    }

    const element = brewingTimerRef.current;
    const updateHeight = () => {
      setBrewingTimerHeight(element.offsetHeight || 0);
    };

    updateHeight();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateHeight);
      observer.observe(element);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, [shouldShowBrewingTimer]);

  useMultiStepModalHistory({
    id: 'brewing',
    isOpen: isInBrewingFlow,
    step: brewingStep || 1, // 确保最小为 1
    onStepChange: () => {
      // 浏览器返回时，调用 handleBackClick 处理步骤导航
      handleBackClick();
    },
    onClose: handleBackClick,
  });

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

      // 复制操作应该被视为新笔记，即使它有 id
      const isNewNote = isBrewingNoteCopy || !note.id;

      // 构建保存数据
      const noteToSave = {
        ...note,
        id: isNewNote ? Date.now().toString() : note.id,
        timestamp: isNewNote ? Date.now() : note.timestamp || Date.now(),
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

      if (isNewNote) {
        // 添加新笔记
        await useBrewingNoteStore.getState().addNote(noteToSave);

        // 注意：咖啡豆剩余量的扣除已在 BrewingNoteForm.handleSubmit 中处理
        // 这里不再重复扣除，避免重复减少剩余量
      } else {
        // 🔥 更新现有笔记 - 使用 Store 方法
        const { useBrewingNoteStore } = await import(
          '@/lib/stores/brewingNoteStore'
        );
        await useBrewingNoteStore
          .getState()
          .updateNote(noteToSave.id, noteToSave);

        // 🔥 更新笔记详情页的数据，使其与编辑后的数据同步
        if (noteDetailData && noteDetailData.note.id === noteToSave.id) {
          setNoteDetailData({
            ...noteDetailData,
            note: noteToSave,
          });
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
    setDeleteConfirmData({
      itemName: equipment.name,
      itemType: '器具',
      onConfirm: async () => {
        try {
          await deleteCustomEquipment(equipment.id);
          const updatedEquipments = await loadCustomEquipments();
          setCustomEquipments(updatedEquipments);
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('删除器具失败:', error);
          }
          alert('删除器具失败，请重试');
        }
      },
    });
    setShowDeleteConfirm(true);
  };

  // 器具管理抽屉相关处理函数
  const handleAddEquipment = () => {
    setEditingEquipment(undefined);
    setPendingImportEquipment(null); // 清除待回填数据
    setShowEquipmentForm(true);
    // 不再关闭器具管理抽屉，保持层级结构
  };

  const handleEditEquipment = (equipment: CustomEquipment) => {
    setEditingEquipment(equipment);
    setPendingImportEquipment(null); // 清除待回填数据
    setShowEquipmentForm(true);
    // 不再关闭器具管理抽屉，保持层级结构
  };

  const handleShareEquipment = async (equipment: CustomEquipment) => {
    try {
      const methods = customMethods[equipment.id || equipment.name] || [];
      const { copyEquipmentToClipboard } = await import(
        '@/lib/stores/customMethodStore'
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
        '@/lib/stores/settingsStore'
      );
      const { equipmentUtils } = await import('@/lib/equipment/equipmentUtils');

      const currentOrder = loadEquipmentOrder();
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

  // 处理从导入模态框回填数据到添加器具表单
  const handleImportEquipmentToForm = (
    equipment: CustomEquipment,
    methods?: Method[]
  ) => {
    // 存储导入的数据，等待回填到表单
    setPendingImportEquipment({ equipment, methods });
    // 注意：不要在这里设置 setShowEquipmentImportForm(false)
    // 让 EquipmentImportModal 自己通过 modalHistory.back() 关闭
    // 这样可以避免双重关闭导致的历史栈问题
    // 确保添加器具表单是打开的
    if (!showEquipmentForm) {
      setShowEquipmentForm(true);
    }
  };

  // 加载自定义方法
  useEffect(() => {
    const loadMethods = async () => {
      try {
        const methods = await import('@/lib/stores/customMethodStore').then(
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

    // 添加事件监听（监听多个事件名以确保兼容）
    window.addEventListener('customMethodUpdate', handleMethodUpdate);
    window.addEventListener('customMethodsChanged', handleMethodUpdate);
    window.addEventListener('customMethodDataChanged', handleMethodUpdate);
    window.addEventListener('storage:changed', handleStorageChange);

    // 清理事件监听
    return () => {
      window.removeEventListener('customMethodUpdate', handleMethodUpdate);
      window.removeEventListener('customMethodsChanged', handleMethodUpdate);
      window.removeEventListener('customMethodDataChanged', handleMethodUpdate);
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
            const { getCoffeeBeanStore } = await import(
              '@/lib/stores/coffeeBeanStore'
            );
            const fullBean = getCoffeeBeanStore().getBeanById(tempBeanInfo.id);

            if (fullBean) {
              // 创建笔记并预选该咖啡豆
              setCurrentEditingNote({
                coffeeBean: fullBean,
                beanId: tempBeanInfo.id, // 明确设置beanId，确保表单可以找到对应的咖啡豆
                coffeeBeanInfo: {
                  name: fullBean.name,
                  roastLevel: fullBean.roastLevel || '中度烘焙',
                  roastDate: fullBean.roastDate || '',
                  roaster: fullBean.roaster,
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
              roaster: tempBeanInfo.roaster,
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
      // 重置添加模式状态
      setBeanDetailAddMode(false);
    };

    // 监听沉浸式添加模式事件
    const handleImmersiveAddOpened = (e: Event) => {
      const customEvent = e as CustomEvent<{
        beanState?: 'green' | 'roasted';
      }>;
      setBeanDetailAddMode(true);
      setBeanDetailAddBeanState(customEvent.detail?.beanState || 'roasted');
      setBeanDetailData(null);
      setBeanDetailSearchQuery('');
      setBeanDetailOpen(true);
    };

    window.addEventListener(
      'beanDetailOpened',
      handleBeanDetailOpened as EventListener
    );
    window.addEventListener('beanDetailClosing', handleBeanDetailClosing);
    window.addEventListener(
      'immersiveAddOpened',
      handleImmersiveAddOpened as EventListener
    );

    return () => {
      window.removeEventListener(
        'beanDetailOpened',
        handleBeanDetailOpened as EventListener
      );
      window.removeEventListener('beanDetailClosing', handleBeanDetailClosing);
      window.removeEventListener(
        'immersiveAddOpened',
        handleImmersiveAddOpened as EventListener
      );
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
    const handleBeanImportOpened = (
      event: CustomEvent<{ beanState?: 'green' | 'roasted' }>
    ) => {
      const beanState = event.detail?.beanState || 'roasted';
      setImportingBeanState(beanState);
      setShowImportBeanForm(true);
    };

    const handleBeanImportClosing = () => {
      setShowImportBeanForm(false);
    };

    window.addEventListener(
      'beanImportOpened',
      handleBeanImportOpened as EventListener
    );
    window.addEventListener('beanImportClosing', handleBeanImportClosing);

    return () => {
      window.removeEventListener(
        'beanImportOpened',
        handleBeanImportOpened as EventListener
      );
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
      {/* 大屏幕时：只有非详情页模态框（设置等）需要主页动画 */}
      {/* 小屏幕时：所有模态框都需要主页动画 */}
      <div
        className="flex h-full flex-col md:flex-row"
        style={
          {
            ...getParentPageStyle(
              isLargeScreen ? hasOverlayModalOpen : hasModalOpen
            ),
            // CSS 变量用于 BottomActionBar 等组件
            '--nav-panel-width': isLargeScreen ? `${navPanelWidth}px` : '0px',
            '--detail-panel-width':
              isLargeScreen && (beanDetailOpen || noteDetailOpen)
                ? `${detailPanelWidth}px`
                : '0px',
          } as React.CSSProperties
        }
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
                      duration: stage.duration,
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
          cloudSyncEnabled={isCloudSyncEnabled()}
          onPullToSync={handlePullToSync}
          width={isLargeScreen ? navPanelWidth : undefined}
          isResizing={isNavResizing}
        />

        {/* 导航栏拖动条 - 大屏幕时显示，放在 NavigationBar 和 main 之间避免被裁切 */}
        {isLargeScreen && (
          <div
            className="group relative z-10 hidden h-full w-0 cursor-col-resize select-none md:block"
            onMouseDown={handleNavResizeStart}
            onTouchStart={handleNavResizeStart}
          >
            {/* 可视化拖动指示器 - 居中显示 */}
            <div
              className={`absolute top-1/2 left-1/2 h-12 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-200 ${
                isNavResizing
                  ? 'scale-y-150 bg-neutral-400 dark:bg-neutral-500'
                  : 'bg-transparent group-hover:bg-neutral-300 dark:group-hover:bg-neutral-600'
              }`}
            />
            {/* 扩大触摸区域 - 左右各扩展8px */}
            <div className="absolute inset-y-0 -right-2 -left-2" />
          </div>
        )}

        {/* 主内容区域 - 桌面端独立滚动 */}
        <main
          className={`md:pt-safe-top h-full flex-1 ${
            activeMainTab === '冲煮' &&
            activeBrewingStep === 'brewing' &&
            currentBrewingMethod &&
            !showHistory
              ? 'flex flex-col overflow-hidden'
              : 'overflow-y-auto md:overflow-y-scroll'
          }`}
        >
          <div
            className={
              isBrewingMainTab
                ? `relative ${
                    shouldShowBrewingTimer ? 'flex h-full flex-col' : 'h-full'
                  }`
                : 'hidden'
            }
            aria-hidden={!isBrewingMainTab}
            data-main-tab="brewing"
          >
            <div
              className={
                shouldShowBrewingTimer
                  ? 'min-h-0 flex-1 overflow-y-auto'
                  : 'h-full space-y-5 overflow-y-auto'
              }
              style={
                shouldShowBrewingTimer && brewingTimerHeight > 0
                  ? { paddingBottom: `${brewingTimerHeight}px` }
                  : undefined
              }
            >
              <TabContent
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

            {shouldShowBrewingTimer && (
              <div
                ref={brewingTimerRef}
                className="pointer-events-auto absolute right-0 bottom-0 left-0 z-10"
              >
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
                      const event = new CustomEvent(
                        'brewing:countdownChange',
                        {
                          detail: { remainingTime: time },
                        }
                      );
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
              </div>
            )}

            {activeBrewingStep === 'method' && selectedEquipment && (
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
          </div>

          <div
            className={isNotesMainTab ? 'h-full' : 'hidden'}
            aria-hidden={!isNotesMainTab}
            data-main-tab="notes"
          >
            <BrewingHistory
              isOpen={isNotesMainTab}
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
          </div>

          <div
            className={isBeansMainTab ? 'h-full' : 'hidden'}
            aria-hidden={!isBeansMainTab}
            data-main-tab="coffee-beans"
          >
            <CoffeeBeans
              key={beanListKey}
              isOpen={isBeansMainTab}
              showBeanForm={handleBeanForm}
              onShowImport={beanState => {
                window.dispatchEvent(
                  new CustomEvent('beanImportOpened', {
                    detail: { beanState },
                  })
                );
              }}
              externalViewMode={currentBeanView}
              onExternalViewChange={handleBeanViewChange}
              settings={{
                dateDisplayMode: settings.dateDisplayMode,
                showFlavorInfo: settings.showFlavorInfo,
                showBeanNotes: settings.showBeanNotes,
                limitNotesLines: settings.limitNotesLines,
                notesMaxLines: settings.notesMaxLines,
                showPrice: settings.showPrice,
                showTotalPrice: settings.showTotalPrice,
                showStatusDots: settings.showStatusDots,
                immersiveAdd: settings.immersiveAdd,
              }}
            />
          </div>

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
            grinderDefaultSyncEnabled={
              settings.grinderDefaultSync?.methodForm ?? false
            }
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
        </main>

        {/* 大屏幕详情面板区域 - 三栏布局的右侧，支持拖动调整宽度 */}
        {isLargeScreen && (
          <aside
            className={`relative h-full shrink-0 ${
              isResizing
                ? ''
                : 'transition-[width,border-color] duration-350 ease-[cubic-bezier(0.4,0,0.2,1)]'
            } ${
              beanDetailOpen || noteDetailOpen
                ? 'border-l border-neutral-200/50 dark:border-neutral-800/50'
                : 'w-0 border-l border-transparent'
            }`}
            style={{
              width:
                beanDetailOpen || noteDetailOpen ? `${detailPanelWidth}px` : 0,
            }}
          >
            {/* 拖动条 - 居中跨越左边界 */}
            {(beanDetailOpen || noteDetailOpen) && (
              <div
                className="group absolute top-0 left-0 z-10 h-full w-0 -translate-x-1/2 cursor-col-resize select-none"
                onMouseDown={handleResizeStart}
                onTouchStart={handleResizeStart}
              >
                {/* 可视化拖动指示器 - 居中显示 */}
                <div
                  className={`absolute top-1/2 left-1/2 h-12 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-200 ${
                    isResizing
                      ? 'scale-y-150 bg-neutral-400 dark:bg-neutral-500'
                      : 'bg-transparent group-hover:bg-neutral-300 dark:group-hover:bg-neutral-600'
                  }`}
                />
                {/* 扩大触摸区域 - 左右各扩展8px */}
                <div className="absolute inset-y-0 -right-2 -left-2" />
              </div>
            )}
            {/* 内部容器使用动态宽度 */}
            <div
              className={`h-full overflow-hidden ${
                isResizing
                  ? ''
                  : 'transition-opacity duration-350 ease-[cubic-bezier(0.4,0,0.2,1)]'
              } ${
                beanDetailOpen || noteDetailOpen ? 'opacity-100' : 'opacity-0'
              }`}
              style={{
                width: `${detailPanelWidth}px`,
              }}
            >
              {/* 咖啡豆详情 */}
              {beanDetailOpen && (
                <BeanDetailModal
                  isOpen={beanDetailOpen}
                  bean={beanDetailData}
                  onClose={() => {
                    setBeanDetailOpen(false);
                    setBeanDetailAddMode(false);
                  }}
                  searchQuery={beanDetailSearchQuery}
                  mode={beanDetailAddMode ? 'add' : 'view'}
                  initialBeanState={beanDetailAddBeanState}
                  onSaveNew={async newBean => {
                    try {
                      const { getCoffeeBeanStore } = await import(
                        '@/lib/stores/coffeeBeanStore'
                      );
                      await getCoffeeBeanStore().addBean(newBean);
                      handleBeanListChange();
                      setBeanDetailAddMode(false);
                    } catch (error) {
                      console.error('添加咖啡豆失败:', error);
                    }
                  }}
                  onEdit={bean => {
                    setEditingBean(bean);
                    setShowBeanForm(true);
                  }}
                  onDelete={async bean => {
                    setBeanDetailOpen(false);
                    try {
                      const { getCoffeeBeanStore } = await import(
                        '@/lib/stores/coffeeBeanStore'
                      );
                      await getCoffeeBeanStore().deleteBean(bean.id);
                      handleBeanListChange();
                    } catch (error) {
                      console.error('删除咖啡豆失败:', error);
                    }
                  }}
                  onShare={async bean => {
                    try {
                      const { beanToReadableText } = await import(
                        '@/lib/utils/jsonUtils'
                      );
                      const { copyToClipboard } = await import(
                        '@/lib/utils/exportUtils'
                      );
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
                      setEditingBean(newBeanData as ExtendedCoffeeBean);
                      setShowBeanForm(true);
                    } catch (error) {
                      console.error('续购失败:', error);
                    }
                  }}
                  onRoast={(greenBean, roastedBeanTemplate) => {
                    setRoastingSourceBeanId(greenBean.id);
                    setEditingBean(roastedBeanTemplate as ExtendedCoffeeBean);
                    setShowBeanForm(true);
                  }}
                  onConvertToGreen={
                    settings.enableGreenBeanInventory &&
                    settings.enableConvertToGreen
                      ? async bean => {
                          try {
                            const { RoastingManager } = await import(
                              '@/lib/managers/roastingManager'
                            );

                            const preview =
                              await RoastingManager.previewConvertRoastedToGreen(
                                bean.id
                              );

                            if (!preview.success || !preview.preview) {
                              showToast({
                                type: 'error',
                                title: preview.error || '无法转换',
                                duration: 3000,
                              });
                              return;
                            }

                            const p = preview.preview;

                            setConvertToGreenPreview({
                              beanId: bean.id,
                              beanName: formatBeanDisplayName(bean, {
                                roasterFieldEnabled:
                                  settings.roasterFieldEnabled,
                                roasterSeparator: settings.roasterSeparator,
                              }),
                              originalBean: {
                                capacity: p.originalBean.capacity,
                                remaining: p.originalBean.remaining,
                              },
                              greenBean: {
                                capacity: p.greenBean.capacity,
                                remaining: p.greenBean.remaining,
                              },
                              roastingAmount: p.roastingAmount,
                              newRoastedBean: {
                                capacity: p.newRoastedBean.capacity,
                                remaining: p.newRoastedBean.remaining,
                              },
                              brewingNotesCount: p.brewingNotesCount,
                              noteUsageTotal: p.noteUsageTotal,
                              recordsToDeleteCount: p.recordsToDeleteCount,
                              directConvert: p.directConvert,
                            });
                            setShowConvertToGreenDrawer(true);
                          } catch (error) {
                            console.error('预览转换失败:', error);
                            showToast({
                              type: 'error',
                              title: '转换失败',
                              duration: 2000,
                            });
                          }
                        }
                      : undefined
                  }
                />
              )}
              {/* 笔记详情 */}
              {noteDetailOpen && noteDetailData && (
                <NoteDetailModal
                  isOpen={noteDetailOpen}
                  note={noteDetailData.note}
                  onClose={() => setNoteDetailOpen(false)}
                  equipmentName={noteDetailData.equipmentName}
                  beanUnitPrice={noteDetailData.beanUnitPrice}
                  beanInfo={noteDetailData.beanInfo}
                  onEdit={async note => {
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
                      const noteToDelete = notes.find(
                        note => note.id === noteId
                      );
                      if (!noteToDelete) {
                        console.warn('未找到要删除的笔记:', noteId);
                        return;
                      }

                      try {
                        if (noteToDelete.source === 'roasting') {
                          const { RoastingManager } = await import(
                            '@/lib/managers/roastingManager'
                          );
                          const result =
                            await RoastingManager.deleteRoastingRecord(noteId);
                          if (!result.success) {
                            console.error('删除烘焙记录失败:', result.error);
                          }
                          return;
                        } else if (
                          noteToDelete.source === 'capacity-adjustment'
                        ) {
                          const beanId = noteToDelete.beanId;
                          const capacityAdjustment =
                            noteToDelete.changeRecord?.capacityAdjustment;

                          if (beanId && capacityAdjustment) {
                            const changeAmount =
                              capacityAdjustment.changeAmount;
                            if (
                              typeof changeAmount === 'number' &&
                              !isNaN(changeAmount) &&
                              changeAmount !== 0
                            ) {
                              const { getCoffeeBeanStore } = await import(
                                '@/lib/stores/coffeeBeanStore'
                              );
                              const store = getCoffeeBeanStore();
                              const currentBean = store.getBeanById(beanId);
                              if (currentBean) {
                                const currentRemaining = parseFloat(
                                  currentBean.remaining || '0'
                                );
                                const restoredRemaining =
                                  currentRemaining - changeAmount;
                                let finalRemaining = Math.max(
                                  0,
                                  restoredRemaining
                                );

                                if (currentBean.capacity) {
                                  const totalCapacity = parseFloat(
                                    currentBean.capacity
                                  );
                                  if (
                                    !isNaN(totalCapacity) &&
                                    totalCapacity > 0
                                  ) {
                                    finalRemaining = Math.min(
                                      finalRemaining,
                                      totalCapacity
                                    );
                                  }
                                }

                                const formattedRemaining = Number.isInteger(
                                  finalRemaining
                                )
                                  ? finalRemaining.toString()
                                  : finalRemaining.toFixed(1);
                                await store.updateBean(beanId, {
                                  remaining: formattedRemaining,
                                });
                              }
                            }
                          }
                        } else {
                          const {
                            extractCoffeeAmountFromNote,
                            getNoteAssociatedBeanId,
                          } = await import('@/components/notes/utils');
                          const coffeeAmount =
                            extractCoffeeAmountFromNote(noteToDelete);
                          const beanId = getNoteAssociatedBeanId(noteToDelete);

                          if (beanId && coffeeAmount > 0) {
                            const { increaseBeanRemaining } = await import(
                              '@/lib/stores/coffeeBeanStore'
                            );
                            await increaseBeanRemaining(beanId, coffeeAmount);
                          }
                        }
                      } catch (error) {
                        console.error('恢复咖啡豆容量失败:', error);
                      }

                      const { useBrewingNoteStore } = await import(
                        '@/lib/stores/brewingNoteStore'
                      );
                      const deleteNote =
                        useBrewingNoteStore.getState().deleteNote;
                      await deleteNote(noteId);
                    } catch (error) {
                      console.error('删除笔记失败:', error);
                    }
                  }}
                  onCopy={async noteId => {
                    setNoteDetailOpen(false);
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
                    setNoteDetailOpen(false);
                    window.dispatchEvent(
                      new CustomEvent('noteShareTriggered', {
                        detail: { noteId },
                      })
                    );
                  }}
                />
              )}
            </div>
          </aside>
        )}

        <BackupReminderModal
          isOpen={showBackupReminder}
          onClose={() => setShowBackupReminder(false)}
          reminderType={reminderType}
        />

        <YearlyReviewReminderDrawer
          isOpen={showYearlyReviewReminder}
          onClose={() => setShowYearlyReviewReminder(false)}
          onGoToReview={() => {
            // 1. 切换到咖啡豆 Tab
            setActiveMainTab('咖啡豆');
            // 2. 切换到统计视图
            handleBeanViewChange(VIEW_OPTIONS.STATS);
            // 3. 延迟打开年度回顾抽屉，确保视图已切换
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('openYearlyReview'));
            }, 300);
          }}
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

      {/* 所有模态框组件 */}
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

      <AppModals
        // Settings 相关
        isSettingsOpen={isSettingsOpen}
        setIsSettingsOpen={setIsSettingsOpen}
        hasSubSettingsOpen={hasSubSettingsOpen}
        handleDataChange={handleDataChange}
        settings={settings}
        handleSubSettingChange={handleSubSettingChange}
        handleSettingsChange={handleSettingsChange}
        customEquipments={customEquipments}
        // 子设置页面状态
        showDisplaySettings={showDisplaySettings}
        setShowDisplaySettings={setShowDisplaySettings}
        showNavigationSettings={showNavigationSettings}
        setShowNavigationSettings={setShowNavigationSettings}
        showStockSettings={showStockSettings}
        setShowStockSettings={setShowStockSettings}
        showBeanSettings={showBeanSettings}
        setShowBeanSettings={setShowBeanSettings}
        showGreenBeanSettings={showGreenBeanSettings}
        setShowGreenBeanSettings={setShowGreenBeanSettings}
        showFlavorPeriodSettings={showFlavorPeriodSettings}
        setShowFlavorPeriodSettings={setShowFlavorPeriodSettings}
        showBrewingSettings={showBrewingSettings}
        setShowBrewingSettings={setShowBrewingSettings}
        showTimerSettings={showTimerSettings}
        setShowTimerSettings={setShowTimerSettings}
        showDataSettings={showDataSettings}
        setShowDataSettings={setShowDataSettings}
        showNotificationSettings={showNotificationSettings}
        setShowNotificationSettings={setShowNotificationSettings}
        showRandomCoffeeBeanSettings={showRandomCoffeeBeanSettings}
        setShowRandomCoffeeBeanSettings={setShowRandomCoffeeBeanSettings}
        showSearchSortSettings={showSearchSortSettings}
        setShowSearchSortSettings={setShowSearchSortSettings}
        showNoteSettings={showNoteSettings}
        setShowNoteSettings={setShowNoteSettings}
        showFlavorDimensionSettings={showFlavorDimensionSettings}
        setShowFlavorDimensionSettings={setShowFlavorDimensionSettings}
        showHiddenMethodsSettings={showHiddenMethodsSettings}
        setShowHiddenMethodsSettings={setShowHiddenMethodsSettings}
        showHiddenEquipmentsSettings={showHiddenEquipmentsSettings}
        setShowHiddenEquipmentsSettings={setShowHiddenEquipmentsSettings}
        showRoasterLogoSettings={showRoasterLogoSettings}
        setShowRoasterLogoSettings={setShowRoasterLogoSettings}
        showGrinderSettings={showGrinderSettings}
        setShowGrinderSettings={setShowGrinderSettings}
        showExperimentalSettings={showExperimentalSettings}
        setShowExperimentalSettings={setShowExperimentalSettings}
        showAboutSettings={showAboutSettings}
        setShowAboutSettings={setShowAboutSettings}
        // 咖啡豆表单
        showBeanForm={showBeanForm}
        setShowBeanForm={setShowBeanForm}
        editingBean={editingBean}
        setEditingBean={setEditingBean}
        editingBeanState={editingBeanState}
        setEditingBeanState={setEditingBeanState}
        roastingSourceBeanId={roastingSourceBeanId}
        setRoastingSourceBeanId={setRoastingSourceBeanId}
        recognitionImage={recognitionImage}
        setRecognitionImage={setRecognitionImage}
        handleSaveBean={handleSaveBean}
        handleBeanListChange={handleBeanListChange}
        // 咖啡豆详情（非大屏幕）
        isLargeScreen={isLargeScreen}
        beanDetailOpen={beanDetailOpen}
        setBeanDetailOpen={setBeanDetailOpen}
        beanDetailData={beanDetailData}
        beanDetailSearchQuery={beanDetailSearchQuery}
        beanDetailAddMode={beanDetailAddMode}
        setBeanDetailAddMode={setBeanDetailAddMode}
        beanDetailAddBeanState={beanDetailAddBeanState}
        // 咖啡豆导入
        showImportBeanForm={showImportBeanForm}
        setShowImportBeanForm={setShowImportBeanForm}
        handleImportBean={handleImportBean}
        // 笔记编辑
        brewingNoteEditOpen={brewingNoteEditOpen}
        setBrewingNoteEditOpen={setBrewingNoteEditOpen}
        brewingNoteEditData={brewingNoteEditData}
        setBrewingNoteEditData={setBrewingNoteEditData}
        isBrewingNoteCopy={isBrewingNoteCopy}
        setIsBrewingNoteCopy={setIsBrewingNoteCopy}
        handleSaveBrewingNoteEdit={handleSaveBrewingNoteEdit}
        // 笔记详情（非大屏幕）
        noteDetailOpen={noteDetailOpen}
        setNoteDetailOpen={setNoteDetailOpen}
        noteDetailData={noteDetailData}
        setNoteDetailData={setNoteDetailData}
        // 器具相关
        showEquipmentForm={showEquipmentForm}
        setShowEquipmentForm={setShowEquipmentForm}
        editingEquipment={editingEquipment}
        setEditingEquipment={setEditingEquipment}
        showEquipmentImportForm={showEquipmentImportForm}
        setShowEquipmentImportForm={setShowEquipmentImportForm}
        pendingImportEquipment={pendingImportEquipment}
        setPendingImportEquipment={setPendingImportEquipment}
        showEquipmentManagement={showEquipmentManagement}
        setShowEquipmentManagement={setShowEquipmentManagement}
        handleSaveEquipment={handleSaveEquipment}
        handleDeleteEquipment={handleDeleteEquipment}
        handleAddEquipment={handleAddEquipment}
        handleEditEquipment={handleEditEquipment}
        handleShareEquipment={handleShareEquipment}
        handleReorderEquipments={handleReorderEquipments}
        handleImportEquipmentToForm={handleImportEquipmentToForm}
        // 转生豆
        showConvertToGreenDrawer={showConvertToGreenDrawer}
        setShowConvertToGreenDrawer={setShowConvertToGreenDrawer}
        convertToGreenPreview={convertToGreenPreview}
        setConvertToGreenPreview={setConvertToGreenPreview}
        handleConvertToGreenConfirm={handleConvertToGreenConfirm}
        // 删除确认
        showDeleteConfirm={showDeleteConfirm}
        setShowDeleteConfirm={setShowDeleteConfirm}
        deleteConfirmData={deleteConfirmData}
        setDeleteConfirmData={setDeleteConfirmData}
        // 通用确认
        showConfirmDrawer={showConfirmDrawer}
        setShowConfirmDrawer={setShowConfirmDrawer}
        confirmDrawerData={confirmDrawerData}
        setConfirmDrawerData={setConfirmDrawerData}
        // ImageViewer
        imageViewerOpen={imageViewerOpen}
        setImageViewerOpen={setImageViewerOpen}
        imageViewerData={imageViewerData}
        setImageViewerData={setImageViewerData}
      />
    </>
  );
};

export default AppContainer;
