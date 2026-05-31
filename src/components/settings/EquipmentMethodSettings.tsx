'use client';

import React from 'react';
import { ChevronRight, Download, Plus } from 'lucide-react';
import { Reorder, motion } from 'framer-motion';

import CustomEquipmentForm, {
  type CustomEquipmentFormHandle,
  type EquipmentFormDrawerChrome,
} from '@/components/equipment/forms/CustomEquipmentForm';
import CustomMethodForm from '@/components/method/forms/CustomMethodForm';
import type { CustomMethodFormHandle } from '@/components/method/forms/CustomMethodForm';
import MethodImportModal from '@/components/method/import/MethodImportModal';
import PageStackDrawer, {
  useDrawerPageStack,
} from '@/components/common/ui/PageStackDrawer';
import { showToast } from '@/components/common/feedback/LightToast';
import {
  commonMethods,
  createEditableMethodFromCommon,
  equipmentList,
  getBaseEquipmentIdByAnimationType,
  type CustomEquipment,
  type Equipment,
  type Method,
} from '@/lib/core/config';
import {
  deleteCustomMethod,
  saveCustomMethod,
  useCustomMethodStore,
} from '@/lib/stores/customMethodStore';
import { useCustomEquipmentStore } from '@/lib/stores/customEquipmentStore';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';
import { modalHistory as drawerModalHistory } from '@/lib/navigation/modalHistory';
import hapticsUtils from '@/lib/ui/haptics';
import { createEditableEquipmentFromPreset } from '@/lib/equipment/editableEquipment';
import { deriveNavigationSettings } from '@/lib/navigation/navigationSettings';
import {
  SettingPage,
  SettingReorderableRow,
  SettingRow,
  SettingSection,
} from '@/components/settings/atomic';
import type { SettingsOptions } from './Settings';

interface EquipmentMethodSettingsProps {
  settings: SettingsOptions;
  customEquipments: CustomEquipment[];
  onClose: () => void;
  onAddEquipment: () => void;
  onSaveEquipment: (equipment: CustomEquipment) => void | Promise<void>;
  onDeleteEquipment: (equipment: CustomEquipment) => void;
  onShareEquipment: (equipment: CustomEquipment) => void | Promise<void>;
}

type ManagedSystemEquipment = Equipment & {
  isCustom: false;
  isUserHidden: boolean;
  isDefaultDisabled: boolean;
  isHidden: boolean;
};

type ManagedCustomEquipment = CustomEquipment & {
  isCustom: true;
  isUserHidden: boolean;
  isDefaultDisabled: boolean;
  isHidden: boolean;
};

type ManagedEquipment = ManagedSystemEquipment | ManagedCustomEquipment;
type DrawerPage =
  | 'overview'
  | 'equipment-form'
  | 'equipment-picker'
  | 'method-form';

const getMethodId = (method: Method) => method.id || method.name;

const buildManagedEquipments = (
  customEquipments: CustomEquipment[],
  settings: SettingsOptions
): ManagedEquipment[] => {
  const orderedIds = settings.equipmentOrder || [];
  const hiddenIds = settings.hiddenEquipments || [];
  const nameOverrides = settings.equipmentNameOverrides || {};
  const systemEquipments: ManagedSystemEquipment[] = equipmentList.map(
    equipment => {
      const isUserHidden = hiddenIds.includes(equipment.id);
      const isDefaultDisabled =
        equipment.defaultEnabled === false &&
        !orderedIds.includes(equipment.id);

      return {
        ...equipment,
        name: nameOverrides[equipment.id]?.trim() || equipment.name,
        isCustom: false,
        isUserHidden,
        isDefaultDisabled,
        isHidden: isUserHidden || isDefaultDisabled,
      };
    }
  );
  const customRows: ManagedCustomEquipment[] = customEquipments.map(
    equipment => {
      const isUserHidden = hiddenIds.includes(equipment.id);

      return {
        ...equipment,
        isUserHidden,
        isDefaultDisabled: false,
        isHidden: isUserHidden,
      };
    }
  );
  const allEquipments = [...systemEquipments, ...customRows];
  const byId = new Map(
    allEquipments.map(equipment => [equipment.id, equipment])
  );
  const ordered = orderedIds
    .map(id => byId.get(id))
    .filter(
      (equipment): equipment is ManagedEquipment => equipment !== undefined
    );
  const unordered = allEquipments.filter(
    equipment => !orderedIds.includes(equipment.id)
  );

  return [...ordered, ...unordered];
};

const ActionRow: React.FC<{
  label: string;
  onClick: () => void;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  isLast?: boolean;
  danger?: boolean;
}> = ({ label, onClick, icon: Icon, isLast, danger = false }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex w-full cursor-pointer items-stretch px-3.5 text-left transition active:bg-black/5 dark:active:bg-white/5"
  >
    <span
      className={`flex min-w-0 flex-1 items-center gap-3 py-3.5 ${
        !isLast ? 'border-b border-black/5 dark:border-white/5' : ''
      }`}
    >
      {Icon ? (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center">
          <Icon
            className="h-4 w-4 text-neutral-500 dark:text-neutral-400"
            strokeWidth={2.25}
          />
        </span>
      ) : null}
      <span
        className={`min-w-0 flex-1 truncate text-sm font-medium ${
          danger
            ? 'text-red-500 dark:text-red-400'
            : 'text-neutral-900 dark:text-neutral-100'
        }`}
      >
        {label}
      </span>
    </span>
  </button>
);

const MethodRow: React.FC<{
  method: Method;
  isCustom: boolean;
  isHidden?: boolean;
  isManageMode?: boolean;
  isDeleteConfirming?: boolean;
  onEdit: () => void;
  onDelete?: () => void;
  onToggleHidden?: () => void;
  isLast?: boolean;
}> = ({
  method,
  isCustom,
  isHidden = false,
  isManageMode = false,
  isDeleteConfirming = false,
  onEdit,
  onDelete,
  onToggleHidden,
  isLast,
}) => {
  const isConfirmingDelete =
    isCustom && isDeleteConfirming && Boolean(onDelete);
  const actionLabel = isConfirmingDelete
    ? '确认删除'
    : isCustom
      ? '删除'
      : isHidden
        ? '恢复'
        : '隐藏';
  const action = isCustom ? onDelete : onToggleHidden;
  const isDanger = isConfirmingDelete;
  const showAction = isManageMode && Boolean(action);

  return (
    <div className="flex w-full items-stretch px-3.5">
      <div
        className={`flex min-w-0 flex-1 items-center gap-3 py-1 ${
          !isLast ? 'border-b border-black/5 dark:border-white/5' : ''
        }`}
      >
        <button
          type="button"
          onClick={onEdit}
          disabled={isManageMode}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left transition-opacity active:opacity-70 disabled:cursor-default disabled:active:opacity-100"
        >
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {method.name}
          </span>

          {!showAction && (
            <span className="flex h-10 w-8 shrink-0 items-center justify-center text-neutral-400 dark:text-neutral-500">
              <ChevronRight className="h-4 w-4" />
            </span>
          )}
        </button>

        {showAction && action && (
          <div className="relative -mr-2 flex h-10 shrink-0 items-center justify-end overflow-hidden">
            <motion.div
              layout
              transition={{ layout: { duration: 0.22, ease: [0.2, 0, 0, 1] } }}
              className="flex h-10 items-center justify-end"
            >
              <motion.button
                key="action"
                layout
                type="button"
                onClick={action}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
                className={`flex h-10 cursor-pointer items-center justify-center rounded-lg px-2 text-sm font-medium whitespace-nowrap active:bg-black/5 dark:active:bg-white/5 ${
                  isDanger
                    ? 'text-red-500 dark:text-red-400'
                    : 'text-neutral-600 dark:text-neutral-300'
                }`}
              >
                {actionLabel}
              </motion.button>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};

const EquipmentMethodSettings: React.FC<EquipmentMethodSettingsProps> = ({
  settings,
  customEquipments,
  onClose,
  onAddEquipment,
  onSaveEquipment,
  onShareEquipment,
}) => {
  const storeSettings = useSettingsStore(
    state => state.settings
  ) as SettingsOptions;
  const hideEquipment = useSettingsStore(state => state.hideEquipment);
  const unhideEquipment = useSettingsStore(state => state.unhideEquipment);
  const setEquipmentOrder = useSettingsStore(state => state.setEquipmentOrder);
  const hideMethod = useSettingsStore(state => state.hideMethod);
  const unhideMethod = useSettingsStore(state => state.unhideMethod);
  const loadMethods = useCustomMethodStore(state => state.loadMethods);
  const methodsInitialized = useCustomMethodStore(state => state.initialized);
  const methodsByEquipment = useCustomMethodStore(
    state => state.methodsByEquipment
  );
  const deleteEquipment = useCustomEquipmentStore(
    state => state.deleteEquipment
  );

  const effectiveSettings = storeSettings || settings;
  const navigationState = deriveNavigationSettings(
    effectiveSettings.navigationSettings
  );
  const [isVisible, setIsVisible] = React.useState(false);
  const [activeEquipmentId, setActiveEquipmentId] = React.useState<
    string | null
  >(null);
  const [showImportForm, setShowImportForm] = React.useState(false);
  const [editingMethod, setEditingMethod] = React.useState<Method | undefined>(
    undefined
  );
  const [methodFormStep, setMethodFormStep] = React.useState(1);
  const [deleteConfirmingMethodId, setDeleteConfirmingMethodId] =
    React.useState<string | null>(null);
  const [isCustomMethodManageMode, setIsCustomMethodManageMode] =
    React.useState(false);
  const [isCommonMethodManageMode, setIsCommonMethodManageMode] =
    React.useState(false);
  const [isDeleteConfirmingEquipment, setIsDeleteConfirmingEquipment] =
    React.useState(false);
  const [isReorderMode, setIsReorderMode] = React.useState(false);
  const [drawerChrome, setDrawerChrome] =
    React.useState<EquipmentFormDrawerChrome>({
      title: '编辑器具',
      doneDisabled: false,
      canGoBack: false,
    });
  const [methodChrome, setMethodChrome] = React.useState({
    doneLabel: '下一步',
    doneDisabled: false,
    canGoBack: false,
  });
  const equipmentFormRef = React.useRef<CustomEquipmentFormHandle>(null);
  const methodFormRef = React.useRef<CustomMethodFormHandle>(null);
  const onCloseRef = React.useRef(onClose);
  const orderedVisibleEquipmentsRef = React.useRef<ManagedEquipment[]>([]);
  const hasPendingEquipmentOrderRef = React.useRef(false);

  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  React.useEffect(() => {
    if (!methodsInitialized) {
      void loadMethods();
    }
  }, [loadMethods, methodsInitialized]);

  React.useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setIsVisible(true));
    });
  }, []);

  const handleCloseWithAnimation = React.useCallback(() => {
    setIsVisible(false);
    window.dispatchEvent(new CustomEvent('subSettingsClosing'));
    setTimeout(() => onCloseRef.current(), 350);
  }, []);

  useModalHistory({
    id: 'equipment-method-settings',
    isOpen: true,
    onClose: handleCloseWithAnimation,
  });

  const managedEquipments = React.useMemo(
    () => buildManagedEquipments(customEquipments, effectiveSettings),
    [customEquipments, effectiveSettings]
  );
  const activeEquipment = React.useMemo(
    () =>
      activeEquipmentId
        ? managedEquipments.find(
            equipment => equipment.id === activeEquipmentId
          )
        : null,
    [activeEquipmentId, managedEquipments]
  );
  const hiddenPresetEquipments = React.useMemo(
    () =>
      managedEquipments.filter(
        equipment => !equipment.isCustom && equipment.isHidden
      ),
    [managedEquipments]
  );
  const visibleEquipments = React.useMemo(
    () => managedEquipments.filter(equipment => !equipment.isHidden),
    [managedEquipments]
  );
  const [orderedVisibleEquipments, setOrderedVisibleEquipments] =
    React.useState<ManagedEquipment[]>(visibleEquipments);
  const isDrawerOpen = Boolean(activeEquipment);

  React.useEffect(() => {
    setOrderedVisibleEquipments(visibleEquipments);
    orderedVisibleEquipmentsRef.current = visibleEquipments;
    hasPendingEquipmentOrderRef.current = false;
  }, [visibleEquipments]);

  React.useEffect(() => {
    if (orderedVisibleEquipments.length <= 1 && isReorderMode) {
      setIsReorderMode(false);
    }
  }, [isReorderMode, orderedVisibleEquipments.length]);

  const drawerStack = useDrawerPageStack<DrawerPage>(
    'overview',
    isDrawerOpen,
    'equipment-method-drawer',
    () => {
      setActiveEquipmentId(null);
      setDeleteConfirmingMethodId(null);
      setIsCustomMethodManageMode(false);
      setIsCommonMethodManageMode(false);
      setIsDeleteConfirmingEquipment(false);
      setDrawerChrome({
        title: '编辑器具',
        doneDisabled: false,
        canGoBack: false,
      });
      setEditingMethod(undefined);
      setMethodFormStep(1);
      setShowImportForm(false);
      setMethodChrome({
        doneLabel: '下一步',
        doneDisabled: false,
        canGoBack: false,
      });
    }
  );

  React.useEffect(() => {
    if (activeEquipmentId && !activeEquipment) {
      setActiveEquipmentId(null);
    }
  }, [activeEquipment, activeEquipmentId]);

  const selectedCustomMethods = activeEquipmentId
    ? methodsByEquipment[activeEquipmentId] || []
    : [];
  const selectedCommonMethods = React.useMemo(() => {
    if (!activeEquipment) return [];

    const sourceId = activeEquipment.isCustom
      ? getBaseEquipmentIdByAnimationType(activeEquipment.animationType)
      : activeEquipment.id;

    return sourceId ? commonMethods[sourceId] || [] : [];
  }, [activeEquipment]);
  const hiddenMethodIds = React.useMemo(
    () =>
      activeEquipmentId
        ? effectiveSettings.hiddenCommonMethods?.[activeEquipmentId] || []
        : [],
    [activeEquipmentId, effectiveSettings.hiddenCommonMethods]
  );
  const visibleCommonMethods = React.useMemo(
    () =>
      selectedCommonMethods.filter(
        method => !hiddenMethodIds.includes(getMethodId(method))
      ),
    [hiddenMethodIds, selectedCommonMethods]
  );
  const hiddenCommonMethods = React.useMemo(
    () =>
      selectedCommonMethods.filter(method =>
        hiddenMethodIds.includes(getMethodId(method))
      ),
    [hiddenMethodIds, selectedCommonMethods]
  );
  const isEquipmentFormPage = drawerStack.currentPage !== 'overview';
  const isEquipmentPickerPage = drawerStack.currentPage === 'equipment-picker';
  const isMethodFormPage = drawerStack.currentPage === 'method-form';
  const isCustomEquipmentFormPage =
    drawerStack.currentPage === 'equipment-form' || isEquipmentPickerPage;
  const drawerTitle = isEquipmentFormPage
    ? isMethodFormPage
      ? editingMethod
        ? '编辑方案'
        : '添加方案'
      : drawerChrome.title
    : activeEquipment?.name || '器具';
  const drawerCanGoBack =
    drawerStack.canGoBack ||
    Boolean(drawerChrome.canGoBack) ||
    (isMethodFormPage && methodChrome.canGoBack);
  const activeCustomEquipment = React.useMemo<CustomEquipment | null>(() => {
    if (!activeEquipment) return null;
    if (activeEquipment.isCustom) return activeEquipment;

    return createEditableEquipmentFromPreset(activeEquipment);
  }, [activeEquipment]);

  const triggerHaptic = React.useCallback(() => {
    if (effectiveSettings.hapticFeedback) {
      void hapticsUtils.light();
    }
  }, [effectiveSettings.hapticFeedback]);

  const openEquipmentDrawer = React.useCallback(
    (equipmentId: string) => {
      setActiveEquipmentId(equipmentId);
      setDeleteConfirmingMethodId(null);
      setIsCustomMethodManageMode(false);
      setIsCommonMethodManageMode(false);
      setIsDeleteConfirmingEquipment(false);
      triggerHaptic();
    },
    [triggerHaptic]
  );

  const closeEquipmentDrawer = React.useCallback(() => {
    drawerModalHistory.back();
  }, []);

  const handleDrawerBack = React.useCallback(() => {
    if (isEquipmentPickerPage) {
      drawerStack.back();
      return;
    }

    if (isMethodFormPage) {
      if (methodChrome.canGoBack) {
        methodFormRef.current?.back();
        return;
      }

      drawerStack.back();
      return;
    }

    if (isCustomEquipmentFormPage && drawerChrome.canGoBack) {
      equipmentFormRef.current?.back();
      return;
    }

    drawerStack.back();
  }, [
    drawerChrome.canGoBack,
    drawerStack,
    isCustomEquipmentFormPage,
    isEquipmentPickerPage,
    isMethodFormPage,
    methodChrome.canGoBack,
  ]);

  const handleDrawerDone = React.useCallback(() => {
    if (isEquipmentPickerPage) {
      drawerStack.back();
      return;
    }

    if (isMethodFormPage) {
      methodFormRef.current?.done();
      return;
    }

    if (isCustomEquipmentFormPage) {
      equipmentFormRef.current?.done();
      return;
    }

    closeEquipmentDrawer();
  }, [
    closeEquipmentDrawer,
    drawerStack,
    isCustomEquipmentFormPage,
    isEquipmentPickerPage,
    isMethodFormPage,
  ]);

  const openEquipmentForm = React.useCallback(() => {
    if (!activeEquipment) return;

    setDrawerChrome({
      title: '编辑器具',
      doneDisabled: false,
      canGoBack: false,
    });
    drawerStack.push('equipment-form');
    triggerHaptic();
  }, [activeEquipment, drawerStack, triggerHaptic]);

  const openNewMethodForm = React.useCallback(() => {
    setEditingMethod(undefined);
    setMethodFormStep(1);
    drawerStack.push('method-form');
    triggerHaptic();
  }, [drawerStack, triggerHaptic]);

  const openImportForm = React.useCallback(() => {
    setShowImportForm(true);
    triggerHaptic();
  }, [triggerHaptic]);

  const openEditCustomMethod = React.useCallback(
    (method: Method) => {
      setEditingMethod(method);
      setMethodFormStep(1);
      drawerStack.push('method-form');
      setDeleteConfirmingMethodId(null);
      triggerHaptic();
    },
    [drawerStack, triggerHaptic]
  );

  const openEditCommonMethod = React.useCallback(
    (method: Method) => {
      setEditingMethod({
        ...createEditableMethodFromCommon(method),
        _isFromCommonMethod: true,
        _originalCommonMethod: method,
      } as Method & {
        _isFromCommonMethod: boolean;
        _originalCommonMethod: Method;
      });
      setMethodFormStep(1);
      drawerStack.push('method-form');
      triggerHaptic();
    },
    [drawerStack, triggerHaptic]
  );

  const handleSaveMethod = React.useCallback(
    async (method: Method) => {
      if (!activeEquipmentId) return;

      const methodWithFlags = method as Method & {
        _isFromCommonMethod?: boolean;
        _originalCommonMethod?: Method;
      };
      const cleanMethod = { ...method };
      delete (
        cleanMethod as Method & {
          _isFromCommonMethod?: boolean;
          _originalCommonMethod?: Method;
        }
      )._isFromCommonMethod;
      delete (
        cleanMethod as Method & {
          _isFromCommonMethod?: boolean;
          _originalCommonMethod?: Method;
        }
      )._originalCommonMethod;

      await saveCustomMethod(
        cleanMethod,
        activeEquipmentId,
        methodsByEquipment,
        methodWithFlags._isFromCommonMethod ? undefined : editingMethod
      );
      showToast({
        type: 'success',
        title: methodWithFlags._isFromCommonMethod
          ? '已保存为自定义方案'
          : '方案已保存',
        duration: 1600,
      });
      setEditingMethod(undefined);
      setMethodFormStep(1);
      setMethodChrome({
        doneLabel: '下一步',
        doneDisabled: false,
        canGoBack: false,
      });
      drawerStack.back();
    },
    [activeEquipmentId, drawerStack, editingMethod, methodsByEquipment]
  );

  const handleImportMethod = React.useCallback(
    async (method: Method) => {
      if (!activeEquipmentId) return;

      await saveCustomMethod(
        method,
        activeEquipmentId,
        methodsByEquipment,
        undefined
      );
      showToast({ type: 'success', title: '方案已导入', duration: 1600 });
    },
    [activeEquipmentId, methodsByEquipment]
  );

  const handleSaveEquipment = React.useCallback(
    async (equipment: CustomEquipment) => {
      await onSaveEquipment(equipment);
      setActiveEquipmentId(equipment.id);
      drawerStack.back();
      showToast({ type: 'success', title: '器具已保存', duration: 1600 });
    },
    [drawerStack, onSaveEquipment]
  );

  const _handleShareEquipment = React.useCallback(async () => {
    if (!activeEquipment) return;

    const editableEquipment = activeEquipment.isCustom
      ? activeEquipment
      : createEditableEquipmentFromPreset(activeEquipment);

    await onShareEquipment(editableEquipment);
    triggerHaptic();
  }, [activeEquipment, onShareEquipment, triggerHaptic]);

  const handleDeleteMethod = React.useCallback(
    async (method: Method) => {
      if (!activeEquipmentId) return;

      const methodId = getMethodId(method);
      if (deleteConfirmingMethodId !== methodId) {
        setDeleteConfirmingMethodId(methodId);
        triggerHaptic();
        return;
      }

      await deleteCustomMethod(activeEquipmentId, methodId);
      setDeleteConfirmingMethodId(null);
      triggerHaptic();
      showToast({ type: 'success', title: '方案已删除', duration: 1600 });
    },
    [activeEquipmentId, deleteConfirmingMethodId, triggerHaptic]
  );

  const handleDeleteEquipment = React.useCallback(async () => {
    if (!activeEquipment?.isCustom) return;

    if (!isDeleteConfirmingEquipment) {
      setIsDeleteConfirmingEquipment(true);
      triggerHaptic();
      return;
    }

    const deleted = await deleteEquipment(activeEquipment.id);
    if (!deleted) {
      showToast({ type: 'error', title: '删除器具失败', duration: 1600 });
      return;
    }

    setIsDeleteConfirmingEquipment(false);
    setActiveEquipmentId(null);
    triggerHaptic();
    showToast({ type: 'success', title: '器具已删除', duration: 1600 });
  }, [
    activeEquipment,
    deleteEquipment,
    isDeleteConfirmingEquipment,
    triggerHaptic,
  ]);

  const toggleCommonMethodHidden = React.useCallback(
    async (method: Method) => {
      if (!activeEquipmentId) return;

      const methodId = getMethodId(method);
      if (hiddenMethodIds.includes(methodId)) {
        await unhideMethod(activeEquipmentId, methodId);
      } else {
        await hideMethod(activeEquipmentId, methodId);
      }

      window.dispatchEvent(new CustomEvent('settingsChanged'));
      triggerHaptic();
    },
    [
      activeEquipmentId,
      hiddenMethodIds,
      hideMethod,
      triggerHaptic,
      unhideMethod,
    ]
  );

  const toggleEquipmentHidden = React.useCallback(
    async (equipment: ManagedEquipment) => {
      if (equipment.isUserHidden || equipment.isDefaultDisabled) {
        await unhideEquipment(equipment.id);
      } else {
        await hideEquipment(equipment.id);
      }

      window.dispatchEvent(new CustomEvent('settingsChanged'));
      triggerHaptic();
    },
    [hideEquipment, triggerHaptic, unhideEquipment]
  );

  const handleReorderEquipments = React.useCallback(
    (nextEquipments: ManagedEquipment[]) => {
      orderedVisibleEquipmentsRef.current = nextEquipments;
      hasPendingEquipmentOrderRef.current = true;
      setOrderedVisibleEquipments(nextEquipments);
    },
    []
  );

  const persistEquipmentOrder = React.useCallback(async () => {
    if (!hasPendingEquipmentOrderRef.current) return;

    hasPendingEquipmentOrderRef.current = false;

    const visibleIds = orderedVisibleEquipmentsRef.current.map(
      equipment => equipment.id
    );
    const currentOrder = effectiveSettings.equipmentOrder || [];
    const nextOrder = [
      ...visibleIds,
      ...currentOrder.filter(id => !visibleIds.includes(id)),
    ];

    try {
      await setEquipmentOrder(nextOrder);
      window.dispatchEvent(new CustomEvent('settingsChanged'));
    } catch (error) {
      console.error('保存器具排序失败:', error);
      orderedVisibleEquipmentsRef.current = visibleEquipments;
      setOrderedVisibleEquipments(visibleEquipments);
    }
  }, [effectiveSettings.equipmentOrder, setEquipmentOrder, visibleEquipments]);

  const toggleReorderMode = React.useCallback(async () => {
    if (isReorderMode) {
      await persistEquipmentOrder();
      setIsReorderMode(false);
      triggerHaptic();
      return;
    }

    setIsReorderMode(true);
    triggerHaptic();
  }, [isReorderMode, persistEquipmentOrder, triggerHaptic]);

  const handlePageClose = React.useCallback(() => {
    void persistEquipmentOrder();
    modalHistory.back();
  }, [persistEquipmentOrder]);

  const equipmentSectionTitle = (
    <div className="flex items-center justify-between pl-3.5">
      <h3 className="text-sm font-semibold tracking-wider text-neutral-500 uppercase dark:text-neutral-400">
        器具
      </h3>
      {orderedVisibleEquipments.length > 1 && (
        <button
          type="button"
          onClick={() => void toggleReorderMode()}
          className="flex shrink-0 cursor-pointer items-center rounded-full px-3 text-sm font-medium whitespace-nowrap text-neutral-600 transition-transform active:scale-[0.96] dark:text-neutral-300"
        >
          {isReorderMode ? '完成' : '编辑'}
        </button>
      )}
    </div>
  );

  const toggleCustomMethodManageMode = React.useCallback(() => {
    setIsCustomMethodManageMode(current => !current);
    setDeleteConfirmingMethodId(null);
    triggerHaptic();
  }, [triggerHaptic]);

  const toggleCommonMethodManageMode = React.useCallback(() => {
    setIsCommonMethodManageMode(current => !current);
    triggerHaptic();
  }, [triggerHaptic]);

  const getMethodSectionTitle = (
    title: string,
    canManage: boolean,
    isManageMode: boolean,
    onToggleManageMode: () => void
  ) => (
    <div className="flex items-center justify-between pl-3.5">
      <h3 className="text-sm font-semibold tracking-wider text-neutral-500 uppercase dark:text-neutral-400">
        {title}
      </h3>
      {canManage && (
        <button
          type="button"
          onClick={onToggleManageMode}
          className="flex shrink-0 cursor-pointer items-center rounded-full px-3 text-sm font-medium whitespace-nowrap text-neutral-600 transition-transform active:scale-[0.96] dark:text-neutral-300"
        >
          {isManageMode ? '完成' : '编辑'}
        </button>
      )}
    </div>
  );

  const renderEquipmentList = () => (
    <>
      <SettingSection title={equipmentSectionTitle} className="-mt-4">
        {orderedVisibleEquipments.length === 0 ? (
          <ActionRow
            label="添加器具"
            onClick={() => {
              triggerHaptic();
              onAddEquipment();
            }}
          />
        ) : (
          <div>
            <ActionRow
              label="添加器具"
              onClick={() => {
                triggerHaptic();
                onAddEquipment();
              }}
            />

            <Reorder.Group
              axis="y"
              values={orderedVisibleEquipments}
              onReorder={handleReorderEquipments}
              className="m-0 list-none p-0"
            >
              {orderedVisibleEquipments.map((equipment, index) => (
                <SettingReorderableRow
                  key={equipment.id}
                  value={equipment}
                  label={equipment.name}
                  isLast={index === orderedVisibleEquipments.length - 1}
                  isReorderMode={isReorderMode}
                  onOpen={equipment => openEquipmentDrawer(equipment.id)}
                  onDragEnd={triggerHaptic}
                />
              ))}
            </Reorder.Group>
          </div>
        )}
      </SettingSection>

      {hiddenPresetEquipments.length > 0 && (
        <SettingSection title="隐藏的预设器具">
          {hiddenPresetEquipments.map((equipment, index) => (
            <SettingRow
              key={equipment.id}
              label={equipment.name}
              isLast={index === hiddenPresetEquipments.length - 1}
            >
              <button
                type="button"
                onClick={() => void toggleEquipmentHidden(equipment)}
                className="cursor-pointer text-sm font-medium text-neutral-600 transition active:opacity-70 dark:text-neutral-300"
              >
                恢复
              </button>
            </SettingRow>
          ))}
        </SettingSection>
      )}
    </>
  );

  const renderOverview = () => {
    if (!activeEquipment) return null;

    return (
      <div>
        <SettingSection
          title={getMethodSectionTitle(
            '自定义方案',
            selectedCustomMethods.length > 0,
            isCustomMethodManageMode,
            toggleCustomMethodManageMode
          )}
        >
          <ActionRow label="添加方案" icon={Plus} onClick={openNewMethodForm} />
          <ActionRow
            label="导入方案"
            icon={Download}
            onClick={openImportForm}
            isLast={selectedCustomMethods.length === 0}
          />
          {selectedCustomMethods.map((method, index) => (
            <MethodRow
              key={getMethodId(method)}
              method={method}
              isCustom
              onEdit={() => openEditCustomMethod(method)}
              onDelete={() => void handleDeleteMethod(method)}
              isManageMode={isCustomMethodManageMode}
              isDeleteConfirming={
                deleteConfirmingMethodId === getMethodId(method)
              }
              isLast={index === selectedCustomMethods.length - 1}
            />
          ))}
        </SettingSection>

        {visibleCommonMethods.length > 0 && (
          <SettingSection
            title={getMethodSectionTitle(
              '预设方案',
              visibleCommonMethods.length > 0,
              isCommonMethodManageMode,
              toggleCommonMethodManageMode
            )}
          >
            {visibleCommonMethods.map((method, index) => {
              const methodId = getMethodId(method);
              return (
                <MethodRow
                  key={methodId}
                  method={method}
                  isCustom={false}
                  isManageMode={isCommonMethodManageMode}
                  onEdit={() => openEditCommonMethod(method)}
                  onToggleHidden={() => void toggleCommonMethodHidden(method)}
                  isLast={index === visibleCommonMethods.length - 1}
                />
              );
            })}
          </SettingSection>
        )}

        {hiddenCommonMethods.length > 0 && (
          <SettingSection title="隐藏的预设方案">
            {hiddenCommonMethods.map((method, index) => (
              <SettingRow
                key={getMethodId(method)}
                label={method.name}
                isLast={index === hiddenCommonMethods.length - 1}
              >
                <button
                  type="button"
                  onClick={() => void toggleCommonMethodHidden(method)}
                  className="cursor-pointer text-sm font-medium text-neutral-600 transition active:opacity-70 dark:text-neutral-300"
                >
                  恢复
                </button>
              </SettingRow>
            ))}
          </SettingSection>
        )}

        <SettingSection title="操作">
          <ActionRow label="编辑器具" onClick={openEquipmentForm} />
          {!activeEquipment.isCustom && (
            <ActionRow
              label={
                activeEquipment.isUserHidden ||
                activeEquipment.isDefaultDisabled
                  ? '恢复器具'
                  : '隐藏器具'
              }
              onClick={() => void toggleEquipmentHidden(activeEquipment)}
              isLast
            />
          )}
          {activeEquipment.isCustom && (
            <ActionRow
              label={isDeleteConfirmingEquipment ? '确认删除' : '删除器具'}
              onClick={() => void handleDeleteEquipment()}
              danger={isDeleteConfirmingEquipment}
              isLast
            />
          )}
        </SettingSection>
      </div>
    );
  };

  const renderDrawerContent = () => {
    if (!activeEquipment) return null;

    if (
      isCustomEquipmentFormPage &&
      activeCustomEquipment &&
      drawerStack.currentPage !== 'method-form'
    ) {
      return (
        <CustomEquipmentForm
          ref={equipmentFormRef}
          key={`equipment-settings-form-${activeCustomEquipment.id}`}
          initialEquipment={activeCustomEquipment}
          activeDrawerPage={isEquipmentPickerPage ? 'equipment-picker' : 'form'}
          onOpenEquipmentPicker={() => drawerStack.push('equipment-picker')}
          onChromeChange={setDrawerChrome}
          onSave={equipment => void handleSaveEquipment(equipment)}
          onCancel={handleDrawerBack}
        />
      );
    }

    if (isMethodFormPage && activeCustomEquipment) {
      return (
        <div className="flex h-[min(72vh,680px)] min-h-[520px] flex-col px-6 pb-2">
          <CustomMethodForm
            ref={methodFormRef}
            initialMethod={editingMethod}
            customEquipment={activeCustomEquipment}
            onSave={method => void handleSaveMethod(method)}
            onBack={handleDrawerBack}
            currentStep={methodFormStep}
            onStepChange={setMethodFormStep}
            chromeMode="drawer"
            onChromeChange={setMethodChrome}
            enableStageEditing={navigationState.visibleTabs.brewing}
            grinderDefaultSyncEnabled={
              effectiveSettings.grinderDefaultSync?.methodForm ?? false
            }
          />
        </div>
      );
    }

    return renderOverview();
  };

  return (
    <>
      <SettingPage
        title="器具和方案"
        isVisible={isVisible}
        onClose={handlePageClose}
      >
        {renderEquipmentList()}
      </SettingPage>

      <PageStackDrawer
        isOpen={isDrawerOpen && !showImportForm}
        title={drawerTitle}
        activeKey={`${drawerStack.currentPage}-${isMethodFormPage ? methodFormStep : drawerChrome.key || activeEquipment?.id || 'empty'}`}
        canGoBack={drawerCanGoBack}
        backLabel={
          isMethodFormPage && methodChrome.canGoBack ? '上一步' : '返回'
        }
        doneLabel={isMethodFormPage ? methodChrome.doneLabel : '完成'}
        doneDisabled={
          isMethodFormPage
            ? methodChrome.doneDisabled
            : isCustomEquipmentFormPage && Boolean(drawerChrome.doneDisabled)
        }
        onCancel={closeEquipmentDrawer}
        onBack={handleDrawerBack}
        onDone={handleDrawerDone}
        historyId="equipment-method-drawer"
      >
        {renderDrawerContent()}
      </PageStackDrawer>

      <MethodImportModal
        showForm={showImportForm}
        onImport={handleImportMethod}
        onClose={() => setShowImportForm(false)}
        existingMethods={selectedCustomMethods}
        customEquipment={activeCustomEquipment || undefined}
        historyId="equipment-method-import-drawer"
        disableHistory={false}
        allowEmptyStages={!navigationState.visibleTabs.brewing}
      />
    </>
  );
};

export default EquipmentMethodSettings;
