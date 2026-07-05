'use client';

import React from 'react';
import type { ReactNode } from 'react';
import type { CoffeeBean } from '@/types/app';
import type { BrewingNote, CustomEquipment, Method } from '@/lib/core/config';
import type { SettingsOptions } from '@/components/settings/Settings';
import type { BrewingNoteData } from '@/types/app';
import type { ConvertToGreenPreview } from '@/components/coffee-bean/ConvertToGreenDrawer';
import { formatBeanDisplayName } from '@/lib/utils/beanVarietyUtils';

// 导入所有模态框组件
import Settings from '@/components/settings/Settings';
import DisplaySettings from '@/components/settings/DisplaySettings';
import StockSettings from '@/components/settings/StockSettings';
import BeanSettings from '@/components/settings/BeanSettings';
import GreenBeanSettings from '@/components/settings/GreenBeanSettings';
import CoffeeBeanGroupSettings from '@/components/settings/CoffeeBeanGroupSettings';
import FlavorPeriodSettings from '@/components/settings/FlavorPeriodSettings';
import TimerSettings from '@/components/settings/TimerSettings';
import DataSettings from '@/components/settings/DataSettings';
import NotificationSettings from '@/components/settings/NotificationSettings';
import RandomCoffeeBeanSettings from '@/components/settings/RandomCoffeeBeanSettings';
import NoteSettings from '@/components/settings/NoteSettings';
import FlavorDimensionSettings from '@/components/settings/FlavorDimensionSettings';
import EquipmentMethodSettings from '@/components/settings/EquipmentMethodSettings';
import RoasterLogoSettings from '@/components/settings/RoasterLogoSettings';
import GrinderSettings from '@/components/settings/GrinderSettings';
import ExperimentalSettings from '@/components/settings/ExperimentalSettings';
import AboutSettings from '@/components/settings/AboutSettings';
import NavigationSettings from '@/components/settings/NavigationSettings';
import BrewingSettings from '@/components/settings/BrewingSettings';
import { SettingPageLayoutProvider } from '@/components/settings/atomic/SettingPageLayoutContext';
import { SettingSearchHighlightProvider } from '@/components/settings/atomic';
import type { SettingsSearchTarget } from '@/components/settings/settingsSearch';
import { modalHistory } from '@/lib/hooks/useModalHistory';
import CoffeeBeanFormModal from '@/components/coffee-bean/Form/Modal';
import BeanDetailModal from '@/components/coffee-bean/Detail/BeanDetailModal';
import ImportModal from '@/components/common/modals/BeanImportModal';
import BrewingNoteEditModal from '@/components/notes/Form/BrewingNoteEditModal';
import NoteDetailModal from '@/components/notes/Detail/NoteDetailModal';
import CustomEquipmentFormModal from '@/components/equipment/forms/CustomEquipmentFormModal';
import EquipmentImportFilePicker, {
  type EquipmentImportFilePickerHandle,
} from '@/components/equipment/import/EquipmentImportFilePicker';
import EquipmentManagementDrawer from '@/components/equipment/EquipmentManagementDrawer';
import ConvertToGreenDrawer from '@/components/coffee-bean/ConvertToGreenDrawer';
import DeleteConfirmDrawer from '@/components/common/ui/DeleteConfirmDrawer';
import ConfirmDrawer from '@/components/common/ui/ConfirmDrawer';
import ImageViewer from '@/components/common/ui/ImageViewer';
import type { ImageViewerPayload } from '@/lib/ui/imageViewer';
import {
  createCapacityAdjustmentRecordIfNeeded,
  revertCapacityAdjustmentRecord,
} from '@/lib/coffee-beans/capacityAdjustment';
import RescueModeDrawer from '@/components/layout/RescueModeDrawer';

interface ExtendedCoffeeBean extends CoffeeBean {
  blendComponents?: {
    percentage?: number;
    origin?: string;
    estate?: string;
    process?: string;
    variety?: string;
  }[];
}

export interface AppModalsProps {
  // Settings 相关
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  hasSubSettingsOpen: boolean;
  handleDataChange: () => Promise<void>;
  settings: SettingsOptions;
  handleSubSettingChange: (key: string, value: unknown) => Promise<void>;
  customEquipments: CustomEquipment[];

  // 子设置页面状态
  showDisplaySettings: boolean;
  setShowDisplaySettings: (show: boolean) => void;
  showNavigationSettings: boolean;
  setShowNavigationSettings: (show: boolean) => void;
  showStockSettings: boolean;
  setShowStockSettings: (show: boolean) => void;
  showBeanSettings: boolean;
  setShowBeanSettings: (show: boolean) => void;
  showGreenBeanSettings: boolean;
  setShowGreenBeanSettings: (show: boolean) => void;
  showCoffeeBeanGroupSettings: boolean;
  setShowCoffeeBeanGroupSettings: (show: boolean) => void;
  showFlavorPeriodSettings: boolean;
  setShowFlavorPeriodSettings: (show: boolean) => void;
  showBrewingSettings: boolean;
  setShowBrewingSettings: (show: boolean) => void;
  showTimerSettings: boolean;
  setShowTimerSettings: (show: boolean) => void;
  showDataSettings: boolean;
  setShowDataSettings: (show: boolean) => void;
  showNotificationSettings: boolean;
  setShowNotificationSettings: (show: boolean) => void;
  showRandomCoffeeBeanSettings: boolean;
  setShowRandomCoffeeBeanSettings: (show: boolean) => void;
  showEquipmentMethodSettings: boolean;
  setShowEquipmentMethodSettings: (show: boolean) => void;
  showNoteSettings: boolean;
  setShowNoteSettings: (show: boolean) => void;
  showFlavorDimensionSettings: boolean;
  setShowFlavorDimensionSettings: (show: boolean) => void;
  showRoasterLogoSettings: boolean;
  setShowRoasterLogoSettings: (show: boolean) => void;
  showGrinderSettings: boolean;
  setShowGrinderSettings: (show: boolean) => void;
  showExperimentalSettings: boolean;
  setShowExperimentalSettings: (show: boolean) => void;
  showAboutSettings: boolean;
  setShowAboutSettings: (show: boolean) => void;

  // 咖啡豆表单
  showBeanForm: boolean;
  setShowBeanForm: (show: boolean) => void;
  editingBean: ExtendedCoffeeBean | null;
  setEditingBean: (bean: ExtendedCoffeeBean | null) => void;
  editingBeanState: 'green' | 'roasted';
  setEditingBeanState: (state: 'green' | 'roasted') => void;
  roastingSourceBeanId: string | null;
  setRoastingSourceBeanId: (id: string | null) => void;
  recognitionImage: string | null;
  setRecognitionImage: (image: string | null) => void;
  recognitionImageBeanId: string | null;
  setRecognitionImageBeanId: (id: string | null) => void;
  handleSaveBean: (
    bean: Omit<ExtendedCoffeeBean, 'id' | 'timestamp'>
  ) => Promise<void>;
  handleBeanListChange: () => void;

  // 咖啡豆详情（非大屏幕）
  isLargeScreen: boolean;
  beanDetailOpen: boolean;
  setBeanDetailOpen: (open: boolean) => void;
  beanDetailData: ExtendedCoffeeBean | null;
  setBeanDetailData: (bean: ExtendedCoffeeBean | null) => void;
  beanDetailSearchQuery: string;
  beanDetailAddMode: boolean;
  setBeanDetailAddMode: (mode: boolean) => void;
  beanDetailEditMode: boolean;
  setBeanDetailEditMode: (mode: boolean) => void;
  beanDetailAddBeanState: 'green' | 'roasted';
  onCreateNoteFromBean: (bean: CoffeeBean) => void;
  onOpenNoteDetailFromBean: (detail: {
    note: BrewingNote;
    equipmentName: string;
    beanUnitPrice: number;
    beanInfo?: CoffeeBean | null;
  }) => void;
  onEditRelatedNoteFromBean: (note: BrewingNote) => void;

  // 咖啡豆导入
  showImportBeanForm: boolean;
  setShowImportBeanForm: (show: boolean) => void;
  handleImportBean: (
    jsonData: string,
    options?: { recognitionImage?: string }
  ) => Promise<void>;

  // 笔记编辑
  brewingNoteEditOpen: boolean;
  setBrewingNoteEditOpen: (open: boolean) => void;
  brewingNoteEditData: BrewingNoteData | null;
  setBrewingNoteEditData: (data: BrewingNoteData | null) => void;
  isBrewingNoteCopy: boolean;
  setIsBrewingNoteCopy: (isCopy: boolean) => void;
  handleSaveBrewingNoteEdit: (note: BrewingNoteData) => Promise<void>;

  // 笔记详情（非大屏幕）
  noteDetailOpen: boolean;
  setNoteDetailOpen: (open: boolean) => void;
  noteDetailData: {
    note: BrewingNote;
    equipmentName: string;
    beanUnitPrice: number;
    beanInfo?: CoffeeBean | null;
  } | null;
  onOpenBeanDetailFromNote: (bean: CoffeeBean) => void;
  setNoteDetailData: (
    data: {
      note: BrewingNote;
      equipmentName: string;
      beanUnitPrice: number;
      beanInfo?: CoffeeBean | null;
    } | null
  ) => void;

  // 器具相关
  showEquipmentForm: boolean;
  setShowEquipmentForm: (show: boolean) => void;
  editingEquipment: CustomEquipment | undefined;
  setEditingEquipment: (equipment: CustomEquipment | undefined) => void;
  pendingImportEquipment: {
    equipment: CustomEquipment;
    methods?: Method[];
  } | null;
  setPendingImportEquipment: (
    data: { equipment: CustomEquipment; methods?: Method[] } | null
  ) => void;
  showEquipmentManagement: boolean;
  setShowEquipmentManagement: (show: boolean) => void;
  handleSaveEquipment: (
    equipment: CustomEquipment,
    methods?: Method[]
  ) => Promise<void>;
  handleDeleteEquipment: (equipment: CustomEquipment) => Promise<void>;
  handleAddEquipment: () => void;
  handleEditEquipment: (equipment: CustomEquipment) => void;
  handleShareEquipment: (equipment: CustomEquipment) => Promise<void>;
  handleImportEquipmentToForm: (
    equipment: CustomEquipment,
    methods?: Method[]
  ) => void;

  // 转生豆
  showConvertToGreenDrawer: boolean;
  setShowConvertToGreenDrawer: (show: boolean) => void;
  convertToGreenPreview: ConvertToGreenPreview | null;
  setConvertToGreenPreview: (preview: ConvertToGreenPreview | null) => void;
  handleConvertToGreenConfirm: () => Promise<void>;

  // 删除确认
  showDeleteConfirm: boolean;
  setShowDeleteConfirm: (show: boolean) => void;
  deleteConfirmData: {
    itemName: string;
    itemType: string;
    onConfirm: () => void;
  } | null;
  setDeleteConfirmData: (
    data: { itemName: string; itemType: string; onConfirm: () => void } | null
  ) => void;

  // 通用确认
  showConfirmDrawer: boolean;
  setShowConfirmDrawer: (show: boolean) => void;
  confirmDrawerData: {
    message: ReactNode;
    confirmText: string;
    onConfirm: () => void;
  } | null;
  setConfirmDrawerData: (
    data: {
      message: ReactNode;
      confirmText: string;
      onConfirm: () => void;
    } | null
  ) => void;

  // ImageViewer
  imageViewerOpen: boolean;
  setImageViewerOpen: (open: boolean) => void;
  imageViewerData: ImageViewerPayload | null;
  setImageViewerData: (data: ImageViewerPayload | null) => void;
}

const AppModals: React.FC<AppModalsProps> = ({
  // Settings 相关
  isSettingsOpen,
  setIsSettingsOpen,
  hasSubSettingsOpen,
  handleDataChange,
  settings,
  handleSubSettingChange,
  customEquipments,

  // 子设置页面状态
  showDisplaySettings,
  setShowDisplaySettings,
  showNavigationSettings,
  setShowNavigationSettings,
  showStockSettings,
  setShowStockSettings,
  showBeanSettings,
  setShowBeanSettings,
  showGreenBeanSettings,
  setShowGreenBeanSettings,
  showCoffeeBeanGroupSettings,
  setShowCoffeeBeanGroupSettings,
  showFlavorPeriodSettings,
  setShowFlavorPeriodSettings,
  showBrewingSettings,
  setShowBrewingSettings,
  showTimerSettings,
  setShowTimerSettings,
  showDataSettings,
  setShowDataSettings,
  showNotificationSettings,
  setShowNotificationSettings,
  showRandomCoffeeBeanSettings,
  setShowRandomCoffeeBeanSettings,
  showEquipmentMethodSettings,
  setShowEquipmentMethodSettings,
  showNoteSettings,
  setShowNoteSettings,
  showFlavorDimensionSettings,
  setShowFlavorDimensionSettings,
  showRoasterLogoSettings,
  setShowRoasterLogoSettings,
  showGrinderSettings,
  setShowGrinderSettings,
  showExperimentalSettings,
  setShowExperimentalSettings,
  showAboutSettings,
  setShowAboutSettings,

  // 咖啡豆表单
  showBeanForm,
  setShowBeanForm,
  editingBean,
  setEditingBean,
  editingBeanState,
  setEditingBeanState,
  roastingSourceBeanId,
  setRoastingSourceBeanId,
  recognitionImage,
  setRecognitionImage,
  recognitionImageBeanId,
  setRecognitionImageBeanId,
  handleSaveBean,
  handleBeanListChange,

  // 咖啡豆详情（非大屏幕）
  isLargeScreen,
  beanDetailOpen,
  setBeanDetailOpen,
  beanDetailData,
  setBeanDetailData,
  beanDetailSearchQuery,
  beanDetailAddMode,
  setBeanDetailAddMode,
  beanDetailEditMode,
  setBeanDetailEditMode,
  beanDetailAddBeanState,
  onCreateNoteFromBean,
  onOpenNoteDetailFromBean,
  onEditRelatedNoteFromBean,

  // 咖啡豆导入
  showImportBeanForm,
  setShowImportBeanForm,
  handleImportBean,

  // 笔记编辑
  brewingNoteEditOpen,
  setBrewingNoteEditOpen,
  brewingNoteEditData,
  setBrewingNoteEditData,
  isBrewingNoteCopy,
  setIsBrewingNoteCopy,
  handleSaveBrewingNoteEdit,

  // 笔记详情（非大屏幕）
  noteDetailOpen,
  setNoteDetailOpen,
  noteDetailData,
  onOpenBeanDetailFromNote,
  setNoteDetailData,

  // 器具相关
  showEquipmentForm,
  setShowEquipmentForm,
  editingEquipment,
  setEditingEquipment,
  pendingImportEquipment,
  setPendingImportEquipment,
  showEquipmentManagement,
  setShowEquipmentManagement,
  handleSaveEquipment,
  handleDeleteEquipment,
  handleAddEquipment,
  handleEditEquipment,
  handleShareEquipment,
  handleImportEquipmentToForm,

  // 转生豆
  showConvertToGreenDrawer,
  setShowConvertToGreenDrawer,
  convertToGreenPreview,
  setConvertToGreenPreview,
  handleConvertToGreenConfirm,

  // 删除确认
  showDeleteConfirm,
  setShowDeleteConfirm,
  deleteConfirmData,
  setDeleteConfirmData,

  // 通用确认
  showConfirmDrawer,
  setShowConfirmDrawer,
  confirmDrawerData,
  setConfirmDrawerData,

  // ImageViewer
  imageViewerOpen,
  setImageViewerOpen,
  imageViewerData,
  setImageViewerData,
}) => {
  // 标记未使用的变量
  void setNoteDetailData;

  const equipmentImportPickerRef =
    React.useRef<EquipmentImportFilePickerHandle>(null);

  const handleOpenEquipmentImport = React.useCallback(() => {
    equipmentImportPickerRef.current?.open();
  }, []);

  const subSettingStates = [
    {
      id: 'display-settings',
      isOpen: showDisplaySettings,
    },
    {
      id: 'navigation-settings',
      isOpen: showNavigationSettings,
    },
    {
      id: 'stock-settings',
      isOpen: showStockSettings,
    },
    {
      id: 'bean-settings',
      isOpen: showBeanSettings,
    },
    {
      id: 'green-bean-settings',
      isOpen: showGreenBeanSettings,
    },
    {
      id: 'coffee-bean-group-settings',
      isOpen: showCoffeeBeanGroupSettings,
    },
    {
      id: 'flavor-period-settings',
      isOpen: showFlavorPeriodSettings,
    },
    {
      id: 'brewing-settings',
      isOpen: showBrewingSettings,
    },
    {
      id: 'timer-settings',
      isOpen: showTimerSettings,
    },
    {
      id: 'data-settings',
      isOpen: showDataSettings,
    },
    {
      id: 'notification-settings',
      isOpen: showNotificationSettings,
    },
    {
      id: 'random-coffee-bean-settings',
      isOpen: showRandomCoffeeBeanSettings,
    },
    {
      id: 'equipment-method-settings',
      isOpen: showEquipmentMethodSettings,
    },
    {
      id: 'note-settings',
      isOpen: showNoteSettings,
    },
    {
      id: 'flavor-dimension-settings',
      isOpen: showFlavorDimensionSettings,
    },
    {
      id: 'roaster-logo-settings',
      isOpen: showRoasterLogoSettings,
    },
    {
      id: 'grinder-settings',
      isOpen: showGrinderSettings,
    },
    {
      id: 'experimental-settings',
      isOpen: showExperimentalSettings,
    },
    {
      id: 'about-settings',
      isOpen: showAboutSettings,
    },
  ] as const;
  const activeSubSettingId =
    subSettingStates.find(subSetting => subSetting.isOpen)?.id ?? null;
  const [settingsSearchTarget, setSettingsSearchTarget] =
    React.useState<SettingsSearchTarget | null>(null);
  const activeChildSearchSettingId =
    settingsSearchTarget?.pageId === activeSubSettingId
      ? settingsSearchTarget.settingId
      : null;

  const closeAllSubSettings = React.useCallback(() => {
    setShowDisplaySettings(false);
    setShowNavigationSettings(false);
    setShowStockSettings(false);
    setShowBeanSettings(false);
    setShowGreenBeanSettings(false);
    setShowCoffeeBeanGroupSettings(false);
    setShowFlavorPeriodSettings(false);
    setShowBrewingSettings(false);
    setShowTimerSettings(false);
    setShowDataSettings(false);
    setShowNotificationSettings(false);
    setShowRandomCoffeeBeanSettings(false);
    setShowEquipmentMethodSettings(false);
    setShowNoteSettings(false);
    setShowFlavorDimensionSettings(false);
    setShowRoasterLogoSettings(false);
    setShowGrinderSettings(false);
    setShowExperimentalSettings(false);
    setShowAboutSettings(false);
  }, [
    setShowDisplaySettings,
    setShowNavigationSettings,
    setShowStockSettings,
    setShowBeanSettings,
    setShowGreenBeanSettings,
    setShowCoffeeBeanGroupSettings,
    setShowFlavorPeriodSettings,
    setShowBrewingSettings,
    setShowTimerSettings,
    setShowDataSettings,
    setShowNotificationSettings,
    setShowRandomCoffeeBeanSettings,
    setShowEquipmentMethodSettings,
    setShowNoteSettings,
    setShowFlavorDimensionSettings,
    setShowRoasterLogoSettings,
    setShowGrinderSettings,
    setShowExperimentalSettings,
    setShowAboutSettings,
  ]);

  const openSubSetting = (id: string, setter: (show: boolean) => void) => {
    const activeSubSetting =
      subSettingStates.find(subSetting => subSetting.isOpen) ?? null;

    if (activeSubSetting?.id === id) {
      return;
    }

    // 大屏切换右侧设置内容时，复用同一层历史记录，避免栈深不断增加
    if (
      isLargeScreen &&
      activeSubSetting &&
      modalHistory.isTop(activeSubSetting.id)
    ) {
      modalHistory.replace({
        id,
        onClose: () => setter(false),
      });
    }

    closeAllSubSettings();
    setter(true);
  };

  const handleSettingsClose = React.useCallback(() => {
    // 退出设置时，一次性清理 settings 及其上方所有子设置历史
    if (modalHistory.isOpen('settings')) {
      modalHistory.close('settings');
    }
    setIsSettingsOpen(false);
    closeAllSubSettings();
  }, [setIsSettingsOpen, closeAllSubSettings]);

  const subSettingsContent = (
    <>
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

      {showGreenBeanSettings && (
        <GreenBeanSettings
          settings={settings}
          onClose={() => setShowGreenBeanSettings(false)}
          handleChange={handleSubSettingChange}
        />
      )}

      {showCoffeeBeanGroupSettings && (
        <CoffeeBeanGroupSettings
          settings={settings}
          onClose={() => setShowCoffeeBeanGroupSettings(false)}
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

      {showBrewingSettings && (
        <BrewingSettings
          isVisible={showBrewingSettings}
          onClose={() => setShowBrewingSettings(false)}
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

      {showEquipmentMethodSettings && (
        <EquipmentMethodSettings
          settings={settings}
          customEquipments={customEquipments}
          onClose={() => setShowEquipmentMethodSettings(false)}
          onAddEquipment={handleAddEquipment}
          onSaveEquipment={handleSaveEquipment}
          onDeleteEquipment={handleDeleteEquipment}
          onShareEquipment={handleShareEquipment}
        />
      )}

      {showNoteSettings && (
        <NoteSettings
          settings={settings}
          onClose={() => setShowNoteSettings(false)}
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

      {showExperimentalSettings && (
        <ExperimentalSettings
          settings={settings}
          onClose={() => setShowExperimentalSettings(false)}
          handleChange={handleSubSettingChange}
        />
      )}

      {showAboutSettings && (
        <AboutSettings onClose={() => setShowAboutSettings(false)} />
      )}
    </>
  );

  return (
    <>
      {/* Settings 组件独立渲染 */}
      <Settings
        isOpen={isSettingsOpen}
        onClose={handleSettingsClose}
        onDataChange={handleDataChange}
        hasSubSettingsOpen={hasSubSettingsOpen}
        isLargeScreen={isLargeScreen}
        activeSubSettingId={activeSubSettingId}
        customEquipments={customEquipments}
        settingsSearchTarget={settingsSearchTarget}
        onSettingsSearchTargetChange={setSettingsSearchTarget}
        subSettingsContent={
          isLargeScreen ? (
            <SettingSearchHighlightProvider
              highlightedSettingId={activeChildSearchSettingId}
            >
              <SettingPageLayoutProvider mode="embedded">
                {subSettingsContent}
              </SettingPageLayoutProvider>
            </SettingSearchHighlightProvider>
          ) : null
        }
        subSettingsHandlers={{
          onOpenDisplaySettings: () =>
            openSubSetting('display-settings', setShowDisplaySettings),
          onOpenNavigationSettings: () =>
            openSubSetting('navigation-settings', setShowNavigationSettings),
          onOpenStockSettings: () =>
            openSubSetting('stock-settings', setShowStockSettings),
          onOpenBeanSettings: () =>
            openSubSetting('bean-settings', setShowBeanSettings),
          onOpenGreenBeanSettings: () =>
            openSubSetting('green-bean-settings', setShowGreenBeanSettings),
          onOpenCoffeeBeanGroupSettings: () =>
            openSubSetting(
              'coffee-bean-group-settings',
              setShowCoffeeBeanGroupSettings
            ),
          onOpenFlavorPeriodSettings: () =>
            openSubSetting(
              'flavor-period-settings',
              setShowFlavorPeriodSettings
            ),
          onOpenBrewingSettings: () =>
            openSubSetting('brewing-settings', setShowBrewingSettings),
          onOpenTimerSettings: () =>
            openSubSetting('timer-settings', setShowTimerSettings),
          onOpenDataSettings: () =>
            openSubSetting('data-settings', setShowDataSettings),
          onOpenNotificationSettings: () =>
            openSubSetting(
              'notification-settings',
              setShowNotificationSettings
            ),
          onOpenRandomCoffeeBeanSettings: () =>
            openSubSetting(
              'random-coffee-bean-settings',
              setShowRandomCoffeeBeanSettings
            ),
          onOpenEquipmentMethodSettings: () =>
            openSubSetting(
              'equipment-method-settings',
              setShowEquipmentMethodSettings
            ),
          onOpenNoteSettings: () =>
            openSubSetting('note-settings', setShowNoteSettings),
          onOpenFlavorDimensionSettings: () =>
            openSubSetting(
              'flavor-dimension-settings',
              setShowFlavorDimensionSettings
            ),
          onOpenRoasterLogoSettings: () =>
            openSubSetting('roaster-logo-settings', setShowRoasterLogoSettings),
          onOpenGrinderSettings: () =>
            openSubSetting('grinder-settings', setShowGrinderSettings),
          onOpenExperimentalSettings: () =>
            openSubSetting(
              'experimental-settings',
              setShowExperimentalSettings
            ),
          onOpenAboutSettings: () =>
            openSubSetting('about-settings', setShowAboutSettings),
        }}
      />

      {/* 所有子设置页面 */}
      {!isLargeScreen && (
        <SettingSearchHighlightProvider
          highlightedSettingId={activeChildSearchSettingId}
        >
          {subSettingsContent}
        </SettingSearchHighlightProvider>
      )}

      {/* 咖啡豆表单模态框 */}
      <CoffeeBeanFormModal
        showForm={showBeanForm}
        initialBean={editingBean}
        onSave={handleSaveBean}
        onClose={() => {
          setShowBeanForm(false);
          setEditingBean(null);
          setEditingBeanState('roasted');
          setRoastingSourceBeanId(null);
          setRecognitionImage(null);
          setRecognitionImageBeanId(null);
        }}
        initialBeanState={editingBeanState}
        roastingSourceBeanId={roastingSourceBeanId}
        recognitionImage={
          recognitionImageBeanId && editingBean?.id === recognitionImageBeanId
            ? recognitionImage
            : null
        }
        onRepurchase={
          editingBean
            ? async () => {
                try {
                  const { createRepurchaseBean } =
                    await import('@/lib/utils/beanRepurchaseUtils');
                  const newBeanData = await createRepurchaseBean(editingBean);
                  setShowBeanForm(false);
                  setEditingBean(null);
                  setBeanDetailOpen(false);
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

      {/* 咖啡豆详情 - 仅在非大屏幕时渲染 */}
      {!isLargeScreen && (
        <BeanDetailModal
          isOpen={beanDetailOpen}
          bean={beanDetailData}
          onClose={() => {
            setBeanDetailOpen(false);
            setBeanDetailAddMode(false);
            setBeanDetailEditMode(false);
          }}
          onCreateNoteFromBean={onCreateNoteFromBean}
          onOpenRelatedNote={onOpenNoteDetailFromBean}
          onEditRelatedNote={onEditRelatedNoteFromBean}
          searchQuery={beanDetailSearchQuery}
          mode={
            beanDetailAddMode ? 'add' : beanDetailEditMode ? 'edit' : 'view'
          }
          initialBeanState={beanDetailAddBeanState}
          onSaveNew={async newBean => {
            try {
              const { getCoffeeBeanStore } =
                await import('@/lib/stores/coffeeBeanStore');
              await getCoffeeBeanStore().addBean(newBean);
              handleBeanListChange();
              setBeanDetailAddMode(false);
            } catch (error) {
              console.error('添加咖啡豆失败:', error);
              throw error;
            }
          }}
          onSaveEdit={async (bean, updates) => {
            try {
              const { getCoffeeBeanStore } =
                await import('@/lib/stores/coffeeBeanStore');
              await getCoffeeBeanStore().updateBean(bean.id, updates);
              try {
                await createCapacityAdjustmentRecordIfNeeded(
                  bean,
                  bean.remaining,
                  updates.remaining
                );
              } catch (recordError) {
                console.error('创建容量变动记录失败:', recordError);
              }
              handleBeanListChange();
              setBeanDetailEditMode(false);
            } catch (error) {
              console.error('编辑咖啡豆失败:', error);
              throw error;
            }
          }}
          onExitEdit={() => setBeanDetailEditMode(false)}
          onEdit={bean => {
            if (settings.immersiveAdd) {
              setBeanDetailAddMode(false);
              setBeanDetailEditMode(true);
              setBeanDetailOpen(true);
              return;
            }

            setEditingBean(bean);
            setShowBeanForm(true);
          }}
          onDelete={async bean => {
            setBeanDetailOpen(false);
            setBeanDetailEditMode(false);
            try {
              const { getCoffeeBeanStore } =
                await import('@/lib/stores/coffeeBeanStore');
              await getCoffeeBeanStore().deleteBean(bean.id);
              handleBeanListChange();
            } catch (error) {
              console.error('删除咖啡豆失败:', error);
            }
          }}
          onShare={async bean => {
            try {
              const [
                { beanToReadableText },
                { copyToClipboard },
                { showToast },
              ] = await Promise.all([
                import('@/lib/utils/jsonUtils'),
                import('@/lib/utils/exportUtils'),
                import('@/components/common/feedback/LightToast'),
              ]);

              const text = beanToReadableText(bean);
              const result = await copyToClipboard(text);

              if (result.success) {
                showToast({
                  type: 'success',
                  title: '已复制到剪贴板',
                  duration: 2000,
                });
                if (settings.hapticFeedback) {
                  const hapticsUtils = (await import('@/lib/ui/haptics'))
                    .default;
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
            try {
              const { createRepurchaseBean } =
                await import('@/lib/utils/beanRepurchaseUtils');
              const newBeanData = await createRepurchaseBean(bean);

              if (settings.immersiveAdd) {
                setShowBeanForm(false);
                setEditingBean(null);
                setBeanDetailData(newBeanData as ExtendedCoffeeBean);
                setBeanDetailAddMode(true);
                setBeanDetailEditMode(false);
                setBeanDetailOpen(true);
                return;
              }

              setBeanDetailOpen(false);
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
            settings.enableGreenBeanInventory && settings.enableConvertToGreen
              ? async bean => {
                  try {
                    const [{ RoastingManager }, { showToast }] =
                      await Promise.all([
                        import('@/lib/managers/roastingManager'),
                        import('@/components/common/feedback/LightToast'),
                      ]);

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
                        roasterFieldEnabled: settings.roasterFieldEnabled,
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
                    const { showToast } =
                      await import('@/components/common/feedback/LightToast');
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

      {/* 添加咖啡豆模态框 */}
      <ImportModal
        showForm={showImportBeanForm}
        onImport={handleImportBean}
        onClose={() => setShowImportBeanForm(false)}
        settings={settings}
      />

      {/* 笔记编辑模态框 */}
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

      {/* 笔记详情模态框 - 仅在非大屏幕时渲染 */}
      {!isLargeScreen && noteDetailData && (
        <NoteDetailModal
          isOpen={noteDetailOpen}
          note={noteDetailData.note}
          onClose={() => setNoteDetailOpen(false)}
          equipmentName={noteDetailData.equipmentName}
          beanUnitPrice={noteDetailData.beanUnitPrice}
          beanInfo={noteDetailData.beanInfo}
          onOpenBeanDetail={onOpenBeanDetailFromNote}
          onEdit={async note => {
            const { getBrewingNoteById } =
              await import('@/lib/notes/relatedNotes');
            const fullNote = await getBrewingNoteById(note.id);
            if (fullNote) {
              setBrewingNoteEditData(fullNote as BrewingNoteData);
              setBrewingNoteEditOpen(true);
            }
          }}
          onDelete={async noteId => {
            setNoteDetailOpen(false);
            try {
              const { getBrewingNoteById } =
                await import('@/lib/notes/relatedNotes');
              const noteToDelete = await getBrewingNoteById(noteId);
              if (!noteToDelete) {
                console.warn('未找到要删除的笔记:', noteId);
                return;
              }

              try {
                if (noteToDelete.source === 'roasting') {
                  const { RoastingManager } =
                    await import('@/lib/managers/roastingManager');
                  const result =
                    await RoastingManager.deleteRoastingRecord(noteId);
                  if (!result.success) {
                    console.error('删除烘焙记录失败:', result.error);
                  }
                  return;
                } else if (noteToDelete.source === 'capacity-adjustment') {
                  await revertCapacityAdjustmentRecord(noteToDelete);
                } else {
                  const {
                    extractCoffeeAmountFromNote,
                    getNoteAssociatedBeanId,
                  } = await import('@/components/notes/utils');
                  const coffeeAmount =
                    extractCoffeeAmountFromNote(noteToDelete);
                  const beanId = getNoteAssociatedBeanId(noteToDelete);

                  if (beanId && coffeeAmount > 0) {
                    const { increaseBeanRemaining } =
                      await import('@/lib/stores/coffeeBeanStore');
                    await increaseBeanRemaining(beanId, coffeeAmount);
                  }
                }
              } catch (error) {
                console.error('恢复咖啡豆容量失败:', error);
              }

              const { useBrewingNoteStore } =
                await import('@/lib/stores/brewingNoteStore');
              const deleteNote = useBrewingNoteStore.getState().deleteNote;
              await deleteNote(noteId);
            } catch (error) {
              console.error('删除笔记失败:', error);
            }
          }}
          onCopy={async noteId => {
            setNoteDetailOpen(false);
            const { getBrewingNoteById } =
              await import('@/lib/notes/relatedNotes');
            const fullNote = await getBrewingNoteById(noteId);
            if (fullNote) {
              setBrewingNoteEditData(fullNote as BrewingNoteData);
              setIsBrewingNoteCopy(true);
              setBrewingNoteEditOpen(true);
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

      {/* 器具相关模态框 */}
      <CustomEquipmentFormModal
        showForm={showEquipmentForm}
        onClose={() => {
          setShowEquipmentForm(false);
          setEditingEquipment(undefined);
          setPendingImportEquipment(null);
        }}
        onSave={handleSaveEquipment}
        editingEquipment={editingEquipment}
        onImport={handleOpenEquipmentImport}
        pendingImportData={pendingImportEquipment}
        onClearPendingImport={() => setPendingImportEquipment(null)}
      />

      <EquipmentImportFilePicker
        ref={equipmentImportPickerRef}
        onImport={handleImportEquipmentToForm}
        existingEquipments={customEquipments}
      />

      <EquipmentManagementDrawer
        isOpen={showEquipmentManagement}
        onClose={() => setShowEquipmentManagement(false)}
        customEquipments={customEquipments}
        onAddEquipment={handleAddEquipment}
        onEditEquipment={handleEditEquipment}
        onDeleteEquipment={handleDeleteEquipment}
        onShareEquipment={handleShareEquipment}
        settings={settings}
      />

      {/* 转生豆确认抽屉 */}
      <ConvertToGreenDrawer
        isOpen={showConvertToGreenDrawer}
        onClose={() => {
          setShowConvertToGreenDrawer(false);
        }}
        onExitComplete={() => {
          setConvertToGreenPreview(null);
        }}
        onConfirm={handleConvertToGreenConfirm}
        preview={convertToGreenPreview}
      />

      {/* 统一删除确认抽屉 */}
      <DeleteConfirmDrawer
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => deleteConfirmData?.onConfirm()}
        itemName={deleteConfirmData?.itemName || ''}
        itemType={deleteConfirmData?.itemType || '项目'}
        onExitComplete={() => setDeleteConfirmData(null)}
      />

      {/* 通用确认抽屉 */}
      <ConfirmDrawer
        isOpen={showConfirmDrawer}
        onClose={() => setShowConfirmDrawer(false)}
        onConfirm={() => confirmDrawerData?.onConfirm()}
        message={confirmDrawerData?.message || ''}
        confirmText={confirmDrawerData?.confirmText || '确认'}
        onExitComplete={() => setConfirmDrawerData(null)}
      />

      {/* ImageViewer */}
      {imageViewerData && (
        <ImageViewer
          id="app-image-viewer"
          isOpen={imageViewerOpen}
          imageUrl={imageViewerData.url}
          backImageUrl={imageViewerData.backUrl}
          alt={imageViewerData.alt}
          items={imageViewerData.items}
          initialIndex={imageViewerData.index}
          sourceElement={imageViewerData.sourceElement}
          sourceElements={imageViewerData.sourceElements}
          action={imageViewerData.action}
          onClose={() => setImageViewerOpen(false)}
          onExitComplete={() => setImageViewerData(null)}
        />
      )}

      <RescueModeDrawer />
    </>
  );
};

export default AppModals;
