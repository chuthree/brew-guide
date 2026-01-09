'use client';

import React from 'react';
import type { ReactNode } from 'react';
import type { CoffeeBean } from '@/types/app';
import type { BrewingNote, CustomEquipment, Method } from '@/lib/core/config';
import type { SettingsOptions } from '@/components/settings/Settings';
import type { BrewingNoteData } from '@/types/app';
import type { ConvertToGreenPreview } from '@/components/coffee-bean/ConvertToGreenDrawer';

// 导入所有模态框组件
import Settings from '@/components/settings/Settings';
import DisplaySettings from '@/components/settings/DisplaySettings';
import StockSettings from '@/components/settings/StockSettings';
import BeanSettings from '@/components/settings/BeanSettings';
import GreenBeanSettings from '@/components/settings/GreenBeanSettings';
import FlavorPeriodSettings from '@/components/settings/FlavorPeriodSettings';
import TimerSettings from '@/components/settings/TimerSettings';
import DataSettings from '@/components/settings/DataSettings';
import NotificationSettings from '@/components/settings/NotificationSettings';
import RandomCoffeeBeanSettings from '@/components/settings/RandomCoffeeBeanSettings';
import SearchSortSettings from '@/components/settings/SearchSortSettings';
import NoteSettings from '@/components/settings/NoteSettings';
import FlavorDimensionSettings from '@/components/settings/FlavorDimensionSettings';
import HiddenMethodsSettings from '@/components/settings/HiddenMethodsSettings';
import HiddenEquipmentsSettings from '@/components/settings/HiddenEquipmentsSettings';
import RoasterLogoSettings from '@/components/settings/RoasterLogoSettings';
import GrinderSettings from '@/components/settings/GrinderSettings';
import ExperimentalSettings from '@/components/settings/ExperimentalSettings';
import AboutSettings from '@/components/settings/AboutSettings';
import AISettings from '@/components/settings/AISettings';
import NavigationSettings from '@/components/settings/NavigationSettings';
import BrewingSettings from '@/components/settings/BrewingSettings';
import CoffeeBeanFormModal from '@/components/coffee-bean/Form/Modal';
import BeanDetailModal from '@/components/coffee-bean/Detail/BeanDetailModal';
import ImportModal from '@/components/common/modals/BeanImportModal';
import BrewingNoteEditModal from '@/components/notes/Form/BrewingNoteEditModal';
import NoteDetailModal from '@/components/notes/Detail/NoteDetailModal';
import CustomEquipmentFormModal from '@/components/equipment/forms/CustomEquipmentFormModal';
import EquipmentImportModal from '@/components/equipment/import/EquipmentImportModal';
import EquipmentManagementDrawer from '@/components/equipment/EquipmentManagementDrawer';
import ConvertToGreenDrawer from '@/components/coffee-bean/ConvertToGreenDrawer';
import DeleteConfirmDrawer from '@/components/common/ui/DeleteConfirmDrawer';
import ConfirmDrawer from '@/components/common/ui/ConfirmDrawer';
import ImageViewer from '@/components/common/ui/ImageViewer';

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
  handleSettingsChange: (newSettings: SettingsOptions) => Promise<void>;
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
  showSearchSortSettings: boolean;
  setShowSearchSortSettings: (show: boolean) => void;
  showNoteSettings: boolean;
  setShowNoteSettings: (show: boolean) => void;
  showFlavorDimensionSettings: boolean;
  setShowFlavorDimensionSettings: (show: boolean) => void;
  showHiddenMethodsSettings: boolean;
  setShowHiddenMethodsSettings: (show: boolean) => void;
  showHiddenEquipmentsSettings: boolean;
  setShowHiddenEquipmentsSettings: (show: boolean) => void;
  showRoasterLogoSettings: boolean;
  setShowRoasterLogoSettings: (show: boolean) => void;
  showGrinderSettings: boolean;
  setShowGrinderSettings: (show: boolean) => void;
  showExperimentalSettings: boolean;
  setShowExperimentalSettings: (show: boolean) => void;
  showAboutSettings: boolean;
  setShowAboutSettings: (show: boolean) => void;
  showAISettings: boolean;
  setShowAISettings: (show: boolean) => void;

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
  handleSaveBean: (
    bean: Omit<ExtendedCoffeeBean, 'id' | 'timestamp'>
  ) => Promise<void>;
  handleBeanListChange: () => void;

  // 咖啡豆详情（非大屏幕）
  isLargeScreen: boolean;
  beanDetailOpen: boolean;
  setBeanDetailOpen: (open: boolean) => void;
  beanDetailData: ExtendedCoffeeBean | null;
  beanDetailSearchQuery: string;
  beanDetailAddMode: boolean;
  setBeanDetailAddMode: (mode: boolean) => void;
  beanDetailAddBeanState: 'green' | 'roasted';

  // 咖啡豆导入
  showImportBeanForm: boolean;
  setShowImportBeanForm: (show: boolean) => void;
  handleImportBean: (jsonData: string) => Promise<void>;

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
  showEquipmentImportForm: boolean;
  setShowEquipmentImportForm: (show: boolean) => void;
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
  handleReorderEquipments: (newOrder: CustomEquipment[]) => Promise<void>;
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
  imageViewerData: { url: string; alt: string; backUrl?: string } | null;
  setImageViewerData: (
    data: { url: string; alt: string; backUrl?: string } | null
  ) => void;
}

const AppModals: React.FC<AppModalsProps> = ({
  // Settings 相关
  isSettingsOpen,
  setIsSettingsOpen,
  hasSubSettingsOpen,
  handleDataChange,
  settings,
  handleSubSettingChange,
  handleSettingsChange,
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
  showSearchSortSettings,
  setShowSearchSortSettings,
  showNoteSettings,
  setShowNoteSettings,
  showFlavorDimensionSettings,
  setShowFlavorDimensionSettings,
  showHiddenMethodsSettings,
  setShowHiddenMethodsSettings,
  showHiddenEquipmentsSettings,
  setShowHiddenEquipmentsSettings,
  showRoasterLogoSettings,
  setShowRoasterLogoSettings,
  showGrinderSettings,
  setShowGrinderSettings,
  showExperimentalSettings,
  setShowExperimentalSettings,
  showAboutSettings,
  setShowAboutSettings,
  showAISettings,
  setShowAISettings,

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
  handleSaveBean,
  handleBeanListChange,

  // 咖啡豆详情（非大屏幕）
  isLargeScreen,
  beanDetailOpen,
  setBeanDetailOpen,
  beanDetailData,
  beanDetailSearchQuery,
  beanDetailAddMode,
  setBeanDetailAddMode,
  beanDetailAddBeanState,

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
  setNoteDetailData,

  // 器具相关
  showEquipmentForm,
  setShowEquipmentForm,
  editingEquipment,
  setEditingEquipment,
  showEquipmentImportForm,
  setShowEquipmentImportForm,
  pendingImportEquipment,
  setPendingImportEquipment,
  showEquipmentManagement,
  setShowEquipmentManagement,
  handleSaveEquipment,
  handleDeleteEquipment,
  handleAddEquipment,
  handleEditEquipment,
  handleShareEquipment,
  handleReorderEquipments,
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
  // 标记未使用的变量（用于烘焙源生豆ID，在 CoffeeBeanFormModal 内部使用）
  void roastingSourceBeanId;
  void setNoteDetailData;

  return (
    <>
      {/* Settings 组件独立渲染 */}
      <Settings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onDataChange={handleDataChange}
        hasSubSettingsOpen={hasSubSettingsOpen}
        subSettingsHandlers={{
          onOpenDisplaySettings: () => setShowDisplaySettings(true),
          onOpenNavigationSettings: () => setShowNavigationSettings(true),
          onOpenStockSettings: () => setShowStockSettings(true),
          onOpenBeanSettings: () => setShowBeanSettings(true),
          onOpenGreenBeanSettings: () => setShowGreenBeanSettings(true),
          onOpenFlavorPeriodSettings: () => setShowFlavorPeriodSettings(true),
          onOpenBrewingSettings: () => setShowBrewingSettings(true),
          onOpenTimerSettings: () => setShowTimerSettings(true),
          onOpenDataSettings: () => setShowDataSettings(true),
          onOpenNotificationSettings: () => setShowNotificationSettings(true),
          onOpenRandomCoffeeBeanSettings: () =>
            setShowRandomCoffeeBeanSettings(true),
          onOpenSearchSortSettings: () => setShowSearchSortSettings(true),
          onOpenNoteSettings: () => setShowNoteSettings(true),
          onOpenFlavorDimensionSettings: () =>
            setShowFlavorDimensionSettings(true),
          onOpenHiddenMethodsSettings: () => setShowHiddenMethodsSettings(true),
          onOpenHiddenEquipmentsSettings: () =>
            setShowHiddenEquipmentsSettings(true),
          onOpenRoasterLogoSettings: () => setShowRoasterLogoSettings(true),
          onOpenGrinderSettings: () => setShowGrinderSettings(true),
          onOpenExperimentalSettings: () => setShowExperimentalSettings(true),
          onOpenAboutSettings: () => setShowAboutSettings(true),
          onOpenAISettings: () => setShowAISettings(true),
        }}
      />

      {/* 所有子设置页面 */}
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

      {showSearchSortSettings && (
        <SearchSortSettings
          settings={settings}
          onClose={() => setShowSearchSortSettings(false)}
          handleChange={handleSubSettingChange}
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

      {showAISettings && (
        <AISettings
          isVisible={showAISettings}
          onClose={() => setShowAISettings(false)}
        />
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
        }}
        initialBeanState={editingBeanState}
        recognitionImage={recognitionImage}
        onRepurchase={
          editingBean
            ? async () => {
                try {
                  const { createRepurchaseBean } = await import(
                    '@/lib/utils/beanRepurchaseUtils'
                  );
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
              const hapticsUtils = (await import('@/lib/ui/haptics')).default;

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
            settings.enableGreenBeanInventory && settings.enableConvertToGreen
              ? async bean => {
                  try {
                    const { RoastingManager } = await import(
                      '@/lib/managers/roastingManager'
                    );
                    const { showToast } = await import(
                      '@/components/common/feedback/LightToast'
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
                      beanName: p.originalBean.name,
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
                    const { showToast } = await import(
                      '@/components/common/feedback/LightToast'
                    );
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
        onRecognitionImage={setRecognitionImage}
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
              const noteToDelete = notes.find(note => note.id === noteId);
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
                } else if (noteToDelete.source === 'capacity-adjustment') {
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
                        let finalRemaining = Math.max(0, restoredRemaining);

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
                  } else {
                    console.warn('无效的 beanId 或 capacityAdjustment:', {
                      beanId,
                      capacityAdjustment,
                    });
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
              const deleteNote = useBrewingNoteStore.getState().deleteNote;
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
        onImport={() => setShowEquipmentImportForm(true)}
        pendingImportData={pendingImportEquipment}
        onClearPendingImport={() => setPendingImportEquipment(null)}
      />

      <EquipmentImportModal
        showForm={showEquipmentImportForm}
        onImport={handleImportEquipmentToForm}
        onClose={() => setShowEquipmentImportForm(false)}
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
        onReorderEquipments={handleReorderEquipments}
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
      {imageViewerOpen && imageViewerData && (
        <ImageViewer
          id="app-image-viewer"
          isOpen={imageViewerOpen}
          imageUrl={imageViewerData.url}
          backImageUrl={imageViewerData.backUrl}
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

export default AppModals;
