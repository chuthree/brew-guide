'use client';
import {
  sourceBeanIds,
  noteUsesBean,
  roastingInputs,
} from '@/lib/coffee-beans/roastingBatch';

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { CoffeeBean } from '@/types/app';
import type { BrewingNote } from '@/lib/core/config';
import { defaultSettings } from '@/components/settings/Settings';
import {
  getDefaultFlavorPeriodByRoastLevelSync,
  normalizeFlavorPeriodDay,
} from '@/lib/utils/flavorPeriodUtils';
import { BREWING_EVENTS } from '@/lib/brewing/constants';
import {
  formatCoffeeBeanAmount,
  useCoffeeBeanStore,
} from '@/lib/stores/coffeeBeanStore';
import { useBrewingNoteStore } from '@/lib/stores/brewingNoteStore';
import { useCustomEquipmentStore } from '@/lib/stores/customEquipmentStore';
import { RoastingManager } from '@/lib/managers/roastingManager';
import {
  getChildPageStyle,
  usePageTransitionState,
  useIsLargeScreen,
} from '@/lib/navigation/pageTransition';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';
import { useRoasterLogo, useSettingsStore } from '@/lib/stores/settingsStore';
import { getRoasterName } from '@/lib/utils/beanVarietyUtils';
import { openImageViewer } from '@/lib/ui/imageViewer';
import { showToast } from '@/components/common/feedback/LightToast';
import { getBeanRatingInfo } from '@/lib/utils/beanRatingUtils';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import DeleteConfirmDrawer from '@/components/common/ui/DeleteConfirmDrawer';
import RemainingEditor from '@/components/coffee-bean/List/components/RemainingEditor';
import {
  buildEquipmentNameMap,
  EMPTY_EQUIPMENT_NAME_OVERRIDES,
} from '@/lib/notes/noteDisplay';
import {
  getComponentConfiguredValues,
  getVisibleBeanFieldIds,
  resolveBeanFieldConfig,
} from '@/lib/coffee-beans/beanFields';
import {
  getCapacityChangeUpdates,
  updateBeanWithCapacityAdjustmentRecord,
} from '@/lib/coffee-beans/capacityAdjustment';
import { getRelatedNotesForBean } from '@/lib/notes/relatedNotes';
import { deriveNavigationSettings } from '@/lib/navigation/navigationSettings';

import {
  BeanDetailModalProps,
  isSimpleChangeRecord,
  isRoastingRecord,
} from './types';
import { blurBeanDetailEditorOnEscape } from './utils';
import HeaderBar from './components/HeaderBar';
import BeanImageSection from './components/BeanImageSection';
import BasicInfoSection from './components/BasicInfoSection';
import OriginInfoSection from './components/OriginInfoSection';
import BlendComponentsSection, {
  buildBlendComponentDisplayRows,
} from './components/BlendComponentsSection';
import FlavorNotesSection from './components/FlavorNotesSection';
import RatingSection from './components/RatingSection';
import RelatedRecordsSection from './components/RelatedRecordsSection';
import { useCoffeeBeanDraft } from './hooks/useCoffeeBeanDraft';

const BeanPrintModal = dynamic(
  () => import('@/components/coffee-bean/Print/BeanPrintModal'),
  { ssr: false }
);

const BeanRatingModal = dynamic(
  () => import('@/components/coffee-bean/Rating/Modal'),
  { ssr: false }
);

type RelatedRecordsTab = 'primary' | 'change' | 'green';

const BeanDetailModal: React.FC<BeanDetailModalProps> = ({
  isOpen,
  bean: propBean,
  onClose,
  onCreateNoteFromBean,
  onOpenRelatedNote,
  onOpenRelatedBean,
  onEditRelatedNote,
  onEdit,
  onDelete,
  onShare,
  onRate: _onRate,
  onRepurchase,
  onRoast,
  onConvertToGreen,
  mode = 'view',
  onSaveNew,
  onSaveEdit,
  onExitEdit,
  initialBeanState = 'roasted',
}) => {
  const isLargeScreen = useIsLargeScreen();
  const isAddMode = mode === 'add';
  const isEditMode = mode === 'edit';
  const isFormMode = isAddMode || isEditMode;
  const isRepurchaseMode = isAddMode && !!propBean;
  const storeSettings = useSettingsStore(state => state.settings);

  // Store 数据（优化：使用 useMemo 避免每次渲染都查找）
  const storeBean = useCoffeeBeanStore(
    React.useCallback(
      state => {
        if (!propBean) return null;
        return state.beans.find(b => b.id === propBean.id) || null;
      },
      [propBean]
    )
  );

  const persistedBean = storeBean || propBean;

  const {
    tempBean,
    setTempBean,
    hasAddDraftContent,
    hasDraftContentRef,
    disableAutoPersist,
    saveDraft,
    clearDraft,
  } = useCoffeeBeanDraft({
    isAddMode,
    isEditMode,
    isFormMode,
    isOpen,
    propBean,
    persistedBean,
    initialBeanState,
    roasterFieldEnabled: storeSettings.roasterFieldEnabled,
    roasterSeparator: storeSettings.roasterSeparator,
  });

  const bean = isFormMode ? (tempBean as CoffeeBean) : persistedBean;
  const currentBeanId = bean?.id;
  const allBeans = useCoffeeBeanStore(state => state.beans);
  const allNotes = useBrewingNoteStore(state => state.notes);
  const notesInitialized = useBrewingNoteStore(state => state.initialized);
  const customEquipments = useCustomEquipmentStore(state => state.equipments);
  const customEquipmentInitialized = useCustomEquipmentStore(
    state => state.initialized
  );
  const loadEquipments = useCustomEquipmentStore(state => state.loadEquipments);

  const [lazyRelatedNotesState, setLazyRelatedNotesState] = useState<{
    beanId: string;
    notes: BrewingNote[];
  } | null>(null);
  const lazyRelatedNotes = useMemo(() => {
    if (!currentBeanId || lazyRelatedNotesState?.beanId !== currentBeanId) {
      return [];
    }

    return lazyRelatedNotesState.notes;
  }, [currentBeanId, lazyRelatedNotesState]);

  // 关联豆子
  const sourceRoastingRecord = React.useMemo(
    () =>
      bean?.id && bean.beanState !== 'green'
        ? (notesInitialized ? allNotes : lazyRelatedNotes).find(
            note =>
              note.source === 'roasting' &&
              note.changeRecord?.roastingRecord?.roastedBeanId === bean?.id
          )?.changeRecord?.roastingRecord
        : undefined,
    [bean, allNotes, notesInitialized, lazyRelatedNotes]
  );
  const relatedBeans = React.useMemo(() => {
    if (!bean) return [];
    if (bean.beanState !== 'green') {
      return sourceBeanIds(bean).map(
        id =>
          allBeans.find(source => source.id === id) ?? {
            id,
            timestamp: 0,
            beanState: 'green' as const,
            name: `${roastingInputs(sourceRoastingRecord).find(input => input.greenBeanId === id)?.greenBeanName ?? '来源生豆'}（已删除）`,
          }
      );
    }
    return [];
  }, [bean, allBeans, sourceRoastingRecord]);

  // 状态
  const relatedNotesLoading =
    !!currentBeanId &&
    !notesInitialized &&
    lazyRelatedNotesState?.beanId !== currentBeanId;
  const relatedNotes = useMemo(() => {
    if (!currentBeanId) return [];

    if (!notesInitialized) {
      return lazyRelatedNotes.filter(note => noteUsesBean(note, currentBeanId));
    }

    return [...allNotes.filter(note => noteUsesBean(note, currentBeanId))].sort(
      (a, b) => b.timestamp - a.timestamp
    );
  }, [allNotes, currentBeanId, lazyRelatedNotes, notesInitialized]);
  const equipmentNameOverrides = useSettingsStore(
    state =>
      state.settings.equipmentNameOverrides || EMPTY_EQUIPMENT_NAME_OVERRIDES
  );
  const equipmentNames = useMemo(
    () => buildEquipmentNameMap(customEquipments, equipmentNameOverrides),
    [customEquipments, equipmentNameOverrides]
  );
  const { shouldRender, isVisible, skipNextExitAnimation } =
    usePageTransitionState(isOpen);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  const [observedTitleVisible, setObservedTitleVisible] = useState(true);
  const printEnabled = storeSettings.enableBeanPrint === true;
  const showBeanRating = storeSettings.showBeanRating === true;
  const ratingInfo = useMemo(() => {
    if (!bean) return null;
    const info = getBeanRatingInfo(bean, allNotes);
    return info.rating > 0 ? info : null;
  }, [allNotes, bean]);
  const detailBean = isFormMode ? tempBean : bean;
  const detailBlendComponents = detailBean?.blendComponents ?? [];
  const visibleBeanFieldIds = getVisibleBeanFieldIds(
    resolveBeanFieldConfig(storeSettings),
    [
      ...detailBlendComponents,
      ...(isEditMode ? (persistedBean?.blendComponents ?? []) : []),
    ]
  );
  const hasOriginInfoSection =
    isFormMode ||
    !!detailBean?.roastLevel ||
    (detailBlendComponents.length <= 1 &&
      getComponentConfiguredValues(
        detailBlendComponents[0],
        visibleBeanFieldIds
      ).length > 0);
  const hasBlendComponentsSection =
    !isFormMode &&
    detailBlendComponents.length > 1 &&
    buildBlendComponentDisplayRows(detailBlendComponents, visibleBeanFieldIds)
      .length > 0;
  const hasFlavorNotesSection =
    isFormMode || !!(bean?.flavor?.length || bean?.notes);
  const hasRatingSection = !isFormMode && (showBeanRating || !!ratingInfo);
  const hasBeanProfileSection =
    hasOriginInfoSection || hasBlendComponentsSection || hasFlavorNotesSection;
  const showBasicInfoDivider = hasBeanProfileSection || hasRatingSection;
  const showRatingDivider = hasBeanProfileSection && hasRatingSection;
  const [relatedRecordsTabOverride, setRelatedRecordsTabOverride] = useState<{
    beanId: string;
    tab: RelatedRecordsTab;
  } | null>(null);
  const [editingCapacity, setEditingCapacity] = useState(false);
  const [editingRemaining, setEditingRemaining] = useState(false);
  const [editingPrice, setEditingPrice] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDraftExitDrawerOpen, setIsDraftExitDrawerOpen] = useState(false);
  const [remainingEditorTarget, setRemainingEditorTarget] =
    useState<HTMLElement | null>(null);

  const isGreenBean = bean?.beanState === 'green';

  if (!isOpen && printModalOpen) {
    setPrintModalOpen(false);
  }

  // 记录显示状态
  const relatedRecordAvailability = useMemo(() => {
    const isGreen = bean?.beanState === 'green';
    const roastingRecords = relatedNotes.filter(note => isRoastingRecord(note));
    const brewingRecords = relatedNotes.filter(
      note => !isSimpleChangeRecord(note) && !isRoastingRecord(note)
    );
    const changeRecords = relatedNotes.filter(note =>
      isSimpleChangeRecord(note)
    );
    const primaryRecords = isGreen ? roastingRecords : brewingRecords;
    const hasSourceGreenBean = !isGreen && relatedBeans.length > 0;

    return {
      hasPrimaryRecords: primaryRecords.length > 0,
      hasChangeRecords: changeRecords.length > 0,
      hasSourceGreenBean,
    };
  }, [bean?.beanState, relatedBeans.length, relatedNotes]);

  const defaultRelatedRecordsTab: RelatedRecordsTab =
    relatedRecordAvailability.hasPrimaryRecords
      ? 'primary'
      : relatedRecordAvailability.hasChangeRecords
        ? 'change'
        : relatedRecordAvailability.hasSourceGreenBean
          ? 'green'
          : 'primary';

  const relatedRecordsTab = useMemo<RelatedRecordsTab>(() => {
    const currentBeanId = bean?.id;
    const overrideTab =
      currentBeanId && relatedRecordsTabOverride?.beanId === currentBeanId
        ? relatedRecordsTabOverride.tab
        : null;

    if (
      overrideTab === 'primary' &&
      relatedRecordAvailability.hasPrimaryRecords
    ) {
      return overrideTab;
    }
    if (
      overrideTab === 'change' &&
      relatedRecordAvailability.hasChangeRecords
    ) {
      return overrideTab;
    }
    if (
      overrideTab === 'green' &&
      relatedRecordAvailability.hasSourceGreenBean
    ) {
      return overrideTab;
    }

    return defaultRelatedRecordsTab;
  }, [
    bean?.id,
    defaultRelatedRecordsTab,
    relatedRecordAvailability,
    relatedRecordsTabOverride,
  ]);

  const showChangeRecords = relatedRecordsTab === 'change';
  const showGreenBeanRecords = relatedRecordsTab === 'green';

  const setRelatedRecordsTabForCurrentBean = React.useCallback(
    (tab: RelatedRecordsTab) => {
      if (!currentBeanId) return;
      setRelatedRecordsTabOverride({ beanId: currentBeanId, tab });
    },
    [currentBeanId]
  );

  const setShowChangeRecords = React.useCallback(
    (show: boolean) => {
      if (show) {
        setRelatedRecordsTabForCurrentBean('change');
        return;
      }

      setRelatedRecordsTabOverride(current => {
        if (
          current &&
          current.beanId === currentBeanId &&
          current.tab === 'change'
        ) {
          return currentBeanId
            ? { beanId: currentBeanId, tab: 'primary' }
            : null;
        }
        return current;
      });
    },
    [currentBeanId, setRelatedRecordsTabForCurrentBean]
  );

  const setShowGreenBeanRecords = React.useCallback(
    (show: boolean) => {
      if (show) {
        setRelatedRecordsTabForCurrentBean('green');
        return;
      }

      setRelatedRecordsTabOverride(current => {
        if (
          current &&
          current.beanId === currentBeanId &&
          current.tab === 'green'
        ) {
          return currentBeanId
            ? { beanId: currentBeanId, tab: 'primary' }
            : null;
        }
        return current;
      });
    },
    [currentBeanId, setRelatedRecordsTabForCurrentBean]
  );

  // 设置加载（优化：移除 isOpen 依赖，避免每次打开都重新设置）
  const navigationState = deriveNavigationSettings(
    storeSettings.navigationSettings
  );

  // 标题可见性（优化：减少延迟）
  const shouldObserveTitle = isOpen && isVisible && !isFormMode;
  const isTitleVisible = shouldObserveTitle ? observedTitleVisible : true;

  useEffect(() => {
    if (!shouldObserveTitle) return;

    let observer: IntersectionObserver | null = null;

    // 减少延迟从 100ms 到 50ms
    const timer = setTimeout(() => {
      const titleElement = document.getElementById('bean-detail-title');
      if (!titleElement) {
        setObservedTitleVisible(true);
        return;
      }

      const rect = titleElement.getBoundingClientRect();
      setObservedTitleVisible(rect.top >= 60);

      observer = new IntersectionObserver(
        ([entry]) => setObservedTitleVisible(entry.isIntersecting),
        { threshold: 0, rootMargin: '-60px 0px 0px 0px' }
      );

      observer.observe(titleElement);
    }, 50);

    return () => {
      clearTimeout(timer);
      if (observer) observer.disconnect();
    };
  }, [bean?.id, shouldObserveTitle]);

  const completeClose = React.useCallback(
    ({
      preserveSavedDraft = false,
      closeHistory = true,
    }: {
      preserveSavedDraft?: boolean;
      closeHistory?: boolean;
    } = {}) => {
      disableAutoPersist();

      if (isAddMode && !preserveSavedDraft) {
        clearDraft();
      }

      setIsDraftExitDrawerOpen(false);

      if (closeHistory) {
        modalHistory.close('bean-detail');
      }

      onClose();
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('beanDetailClosing'));
      }, 175);
    },
    [clearDraft, disableAutoPersist, isAddMode, onClose]
  );

  const historyCloseRequestRef = React.useRef<() => void>(() => {});

  const handleHistoryCloseRequest = React.useCallback(() => {
    if (isAddMode && hasDraftContentRef.current) {
      modalHistory.pushStep(
        'bean-detail',
        1,
        () => {},
        () => historyCloseRequestRef.current()
      );
      setIsDraftExitDrawerOpen(true);
      return;
    }

    completeClose({ closeHistory: false });
  }, [completeClose, hasDraftContentRef, isAddMode]);

  useEffect(() => {
    historyCloseRequestRef.current = handleHistoryCloseRequest;
  }, [handleHistoryCloseRequest]);

  // 历史栈管理
  useModalHistory({
    id: 'bean-detail',
    isOpen,
    onClose: event => {
      if (event.source === 'history' && !hasDraftContentRef.current) {
        skipNextExitAnimation();
      }
      handleHistoryCloseRequest();
    },
  });

  useModalHistory({
    id: 'bean-detail-edit',
    isOpen: isOpen && isEditMode,
    onClose: () => {
      onExitEdit?.();
    },
  });

  useEffect(() => {
    if (!isOpen) return;

    if (!customEquipmentInitialized) {
      void loadEquipments();
    }
  }, [customEquipmentInitialized, isOpen, loadEquipments]);

  useEffect(() => {
    if (!isOpen || !bean?.id || notesInitialized) return;

    let cancelled = false;
    const beanId = bean.id;

    const loadRelatedNotes = async () => {
      try {
        const notes = await getRelatedNotesForBean(beanId);
        if (!cancelled) {
          setLazyRelatedNotesState({ beanId, notes });
        }
      } catch (error) {
        console.warn('[BeanDetailModal] 加载关联记录失败:', error);
        if (!cancelled) {
          setLazyRelatedNotesState({ beanId, notes: [] });
        }
      }
    };

    void loadRelatedNotes();

    if (typeof window === 'undefined') {
      return () => {
        cancelled = true;
      };
    }

    const handleNotesChanged = () => {
      void loadRelatedNotes();
    };

    window.addEventListener('brewingNoteDataChanged', handleNotesChanged);
    window.addEventListener('brewingNotesUpdated', handleNotesChanged);

    return () => {
      cancelled = true;
      window.removeEventListener('brewingNoteDataChanged', handleNotesChanged);
      window.removeEventListener('brewingNotesUpdated', handleNotesChanged);
    };
  }, [bean?.id, isOpen, notesInitialized]);

  // 烘焙商 logo（优化：使用 useMemo 缓存 roasterSettings）
  const roasterSettings = React.useMemo(
    () => ({
      roasterFieldEnabled: storeSettings?.roasterFieldEnabled,
      roasterSeparator: storeSettings?.roasterSeparator,
    }),
    [storeSettings?.roasterFieldEnabled, storeSettings?.roasterSeparator]
  );

  const roasterLogoName = useMemo(() => {
    if (!bean?.name || bean?.image) {
      return null;
    }

    const roasterName = getRoasterName(bean, roasterSettings);
    if (roasterName && roasterName !== '未知烘焙商') {
      return roasterName;
    }

    return null;
  }, [bean, roasterSettings]);
  const roasterLogo = useRoasterLogo(roasterLogoName);

  // 通用字段更新
  const handleUpdateField = async (updates: Partial<CoffeeBean>) => {
    if (isFormMode) {
      setTempBean(prev => ({ ...prev, ...updates }));
      return;
    }

    if (!bean?.id) return;

    try {
      await updateBeanWithCapacityAdjustmentRecord(bean.id, updates);

      window.dispatchEvent(
        new CustomEvent('coffeeBeanDataChanged', {
          detail: { action: 'update', beanId: bean.id },
        })
      );
    } catch (error) {
      console.error('更新字段失败:', error);
    }
  };

  // 烘焙度选择
  const handleRoastLevelSelect = async (level: string) => {
    if (!level) {
      await handleUpdateField({ roastLevel: '' });
      return;
    }

    let startDay = 0;
    let endDay = 0;

    try {
      const settings = useSettingsStore.getState().settings;
      const customFlavorPeriod =
        settings.customFlavorPeriod || defaultSettings.customFlavorPeriod;

      const currentBean = isFormMode ? tempBean : bean;
      const roasterSettings = {
        roasterFieldEnabled: settings.roasterFieldEnabled,
        roasterSeparator: settings.roasterSeparator,
      };
      const roasterName = getRoasterName(
        currentBean as CoffeeBean,
        roasterSettings
      );

      const flavorPeriod = getDefaultFlavorPeriodByRoastLevelSync(
        level,
        customFlavorPeriod,
        roasterName
      );
      startDay = flavorPeriod.startDay;
      endDay = flavorPeriod.endDay;
    } catch (error) {
      console.error('获取自定义赏味期设置失败，使用默认值:', error);
      const flavorPeriod = getDefaultFlavorPeriodByRoastLevelSync(level);
      startDay = flavorPeriod.startDay;
      endDay = flavorPeriod.endDay;
    }

    handleUpdateField({
      roastLevel: level,
      startDay: normalizeFlavorPeriodDay(startDay) || undefined,
      endDay: normalizeFlavorPeriodDay(endDay) || undefined,
    });
  };

  // 容量/剩余量/价格处理
  const handleCapacityBlur = (value: string) => {
    setEditingCapacity(false);
    if (!value) return;

    const previousBean = isFormMode ? tempBean : bean;
    if (!previousBean) return;

    void handleUpdateField(
      getCapacityChangeUpdates(
        previousBean.capacity,
        previousBean.remaining,
        value
      )
    );
  };

  const handleRemainingBlur = (value: string) => {
    setEditingRemaining(false);
    if (value) handleUpdateField({ remaining: value });
  };

  const handlePriceBlur = async (value: string) => {
    const sanitized = value
      .trim()
      .replace(/[^\d.]/g, '')
      .replace(/(\..*)\./g, '$1');

    let normalizedPrice = '';
    if (!sanitized) {
      normalizedPrice = '';
    } else {
      const parsed = parseFloat(sanitized);
      if (!isNaN(parsed)) {
        // 与表单保持一致：价格最多保留 2 位小数
        normalizedPrice = parsed.toFixed(2).replace(/\.?0+$/, '');
      }
    }

    const currentPrice = (isFormMode ? tempBean.price : bean?.price) || '';
    if (normalizedPrice !== currentPrice) {
      await handleUpdateField({ price: normalizedPrice });
    }

    setEditingPrice(false);
  };

  const handleRemainingQuickAction = (
    event: React.MouseEvent<HTMLSpanElement>
  ) => {
    if (isFormMode || !bean) return;

    event.stopPropagation();
    const target = event.currentTarget;
    if (!target || !document.body.contains(target)) return;

    // toggle: 点击同一目标时关闭，再次点击可重新打开
    if (remainingEditorTarget === target) {
      setRemainingEditorTarget(null);
      return;
    }

    setRemainingEditorTarget(target);
  };

  const handleQuickDecrement = async (
    decrementAmount: number
  ): Promise<boolean> => {
    if (!bean?.id) return false;

    try {
      const beanState = bean.beanState || 'roasted';

      if (beanState === 'green') {
        const result = await RoastingManager.simpleRoast(
          bean.id,
          decrementAmount
        );

        if (result.success && result.greenBean) {
          window.dispatchEvent(
            new CustomEvent('coffeeBeanDataChanged', {
              detail: { action: 'update', beanId: bean.id },
            })
          );
          return true;
        }

        showToast({
          type: 'error',
          title: result.error || '烘焙失败',
          duration: 3000,
        });
        return false;
      }

      const currentRemaining = parseFloat(bean.remaining || '0');
      if (isNaN(currentRemaining)) {
        showToast({
          type: 'error',
          title: '当前剩余量无效，无法扣除',
          duration: 3000,
        });
        return false;
      }

      const actualDecrement = Math.min(decrementAmount, currentRemaining);
      const nextRemaining = Math.max(0, currentRemaining - actualDecrement);
      const formattedValue = formatCoffeeBeanAmount(nextRemaining);
      const updatedBean = await useCoffeeBeanStore
        .getState()
        .updateBean(bean.id, { remaining: formattedValue });
      if (!updatedBean) return false;

      window.dispatchEvent(
        new CustomEvent('coffeeBeanDataChanged', {
          detail: { action: 'update', beanId: bean.id },
        })
      );
      return true;
    } catch (error) {
      console.error('详情页快捷扣除失败:', error);
      showToast({
        type: 'error',
        title: '扣除失败，请重试',
        duration: 3000,
      });
      return false;
    }
  };

  // 日期处理
  const handleDateChange = (
    date: Date,
    field: 'roastDate' | 'purchaseDate'
  ) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    handleUpdateField({
      [field]: `${year}-${month}-${day}`,
      isInTransit: false,
    });
  };

  // 关闭处理
  const handleClose = () => {
    if (isAddMode && hasAddDraftContent) {
      setIsDraftExitDrawerOpen(true);
      return;
    }

    modalHistory.back();
  };

  const handleFormSaveComplete = () => {
    if (isEditMode) {
      modalHistory.close('bean-detail-edit');
      onExitEdit?.();
      return;
    }

    completeClose();
  };

  const handleSaveDraft = () => {
    if (!hasAddDraftContent) {
      completeClose();
      return;
    }

    saveDraft();
    completeClose({ preserveSavedDraft: true });
  };

  const handleDetailKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!modalHistory.isTop(isEditMode ? 'bean-detail-edit' : 'bean-detail'))
      return;

    blurBeanDetailEditorOnEscape(event);
  };

  // 导航处理
  const handleGoToBrewing = () => {
    if (!navigationState.visibleTabs.brewing) return;

    handleClose();
    setTimeout(() => {
      document.dispatchEvent(
        new CustomEvent(BREWING_EVENTS.NAVIGATE_TO_MAIN_TAB, {
          detail: { tab: '冲煮' },
        })
      );
      setTimeout(() => {
        document.dispatchEvent(
          new CustomEvent(BREWING_EVENTS.NAVIGATE_TO_STEP, {
            detail: { step: 'coffeeBean' },
          })
        );
        if (bean) {
          setTimeout(() => {
            document.dispatchEvent(
              new CustomEvent(BREWING_EVENTS.SELECT_COFFEE_BEAN, {
                detail: {
                  beanId: bean.id,
                  beanName: bean.name,
                  roaster: bean.roaster,
                },
              })
            );
          }, 100);
        }
      }, 100);
    }, 300);
  };

  const handleGoToNotes = () => {
    if (!bean || !navigationState.visibleTabs.notes) return;

    handleClose();

    setTimeout(() => {
      onCreateNoteFromBean?.(bean);
    }, 360);
  };

  const handleGoToRoast = () => {
    if (!bean || !onRoast) return;
    onRoast(bean);
  };

  // 图片查看
  const handleImageClick = (
    imageUrl: string,
    backImageUrl?: string,
    sourceElement?: HTMLElement | null
  ) => {
    openImageViewer({
      url: imageUrl,
      alt: bean?.name || '咖啡豆图片',
      backUrl: backImageUrl,
      sourceElement,
    });
  };

  if (!shouldRender) return null;

  const activeRemainingEditorTarget = isOpen ? remainingEditorTarget : null;

  return (
    <>
      <div
        onKeyDown={handleDetailKeyDown}
        className={`flex flex-col overflow-hidden bg-neutral-50 dark:bg-neutral-900 ${
          isLargeScreen ? 'h-full w-full' : 'fixed inset-0 mx-auto'
        }`}
        style={getChildPageStyle(isVisible, undefined, true)}
      >
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div className="absolute inset-0 flex min-h-0 flex-col bg-neutral-50 dark:bg-neutral-900">
            <HeaderBar
              isAddMode={isFormMode}
              isEditMode={isEditMode}
              isGreenBean={isGreenBean}
              isTitleVisible={isTitleVisible}
              bean={bean}
              tempBean={tempBean}
              printEnabled={printEnabled}
              saveButtonLabel={isRepurchaseMode ? '添加' : undefined}
              canGoToBrewing={navigationState.visibleTabs.brewing}
              canGoToNotes={navigationState.visibleTabs.notes}
              onClose={handleClose}
              onGoToBrewing={handleGoToBrewing}
              onGoToNotes={handleGoToNotes}
              onGoToRoast={handleGoToRoast}
              onPrint={() => setPrintModalOpen(true)}
              onEdit={onEdit}
              onDelete={onDelete}
              onShare={onShare}
              onRoast={onRoast}
              onRepurchase={onRepurchase}
              onConvertToGreen={onConvertToGreen}
              onSaveNew={onSaveNew}
              onSaveEdit={
                isEditMode && persistedBean
                  ? updates => onSaveEdit?.(persistedBean, updates)
                  : undefined
              }
              onSaveComplete={handleFormSaveComplete}
              onShowDeleteConfirm={() => setShowDeleteConfirm(true)}
            />

            <div
              className="pb-safe-bottom flex-1 overflow-auto"
              style={{ overflowY: 'auto', touchAction: 'pan-y pinch-zoom' }}
            >
              <BeanImageSection
                bean={bean}
                tempBean={tempBean}
                isAddMode={isFormMode}
                roasterLogo={roasterLogo}
                setTempBean={setTempBean}
                handleUpdateField={handleUpdateField}
                onImageClick={handleImageClick}
              />

              {bean ? (
                <div className="space-y-3 px-6 pb-6 select-text">
                  <BasicInfoSection
                    bean={bean}
                    tempBean={tempBean}
                    isAddMode={isFormMode}
                    isEditMode={isEditMode}
                    editingCapacity={editingCapacity}
                    editingRemaining={editingRemaining}
                    editingPrice={editingPrice}
                    setEditingCapacity={setEditingCapacity}
                    setEditingRemaining={setEditingRemaining}
                    setEditingPrice={setEditingPrice}
                    handleUpdateField={handleUpdateField}
                    handleCapacityBlur={handleCapacityBlur}
                    handleRemainingBlur={handleRemainingBlur}
                    handleRemainingQuickAction={handleRemainingQuickAction}
                    handlePriceBlur={handlePriceBlur}
                    handleDateChange={handleDateChange}
                  />

                  {showBasicInfoDivider && (
                    <div
                      aria-hidden
                      className="border-t border-dashed border-neutral-200/70 dark:border-neutral-800/70"
                    />
                  )}

                  <BlendComponentsSection
                    fieldIds={visibleBeanFieldIds}
                    bean={bean}
                    isAddMode={isFormMode}
                    handleUpdateField={handleUpdateField}
                  />

                  <OriginInfoSection
                    fieldIds={visibleBeanFieldIds}
                    bean={bean}
                    tempBean={tempBean}
                    isAddMode={isFormMode}
                    handleUpdateField={handleUpdateField}
                    handleRoastLevelSelect={handleRoastLevelSelect}
                  />

                  <FlavorNotesSection
                    bean={bean}
                    tempBean={tempBean}
                    isAddMode={isFormMode}
                    handleUpdateField={handleUpdateField}
                  />

                  {showRatingDivider && (
                    <div
                      aria-hidden
                      className="border-t border-dashed border-neutral-200/70 dark:border-neutral-800/70"
                    />
                  )}

                  <RatingSection
                    bean={bean}
                    isAddMode={isFormMode}
                    showBeanRating={showBeanRating}
                    ratingInfo={ratingInfo}
                    onOpenRatingModal={() => setRatingModalOpen(true)}
                  />

                  {!isFormMode && (
                    <RelatedRecordsSection
                      relatedNotes={relatedNotes}
                      relatedBeans={relatedBeans}
                      sourceInputs={roastingInputs(sourceRoastingRecord)}
                      equipmentNames={equipmentNames}
                      isGreenBean={isGreenBean}
                      allBeans={allBeans}
                      bean={bean}
                      showChangeRecords={showChangeRecords}
                      showGreenBeanRecords={showGreenBeanRecords}
                      relatedNotesLoading={relatedNotesLoading}
                      setShowChangeRecords={setShowChangeRecords}
                      setShowGreenBeanRecords={setShowGreenBeanRecords}
                      onOpenNoteDetail={
                        navigationState.visibleTabs.notes
                          ? onOpenRelatedNote
                          : undefined
                      }
                      onEditNote={onEditRelatedNote}
                      onOpenBeanDetail={onOpenRelatedBean}
                    />
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <RemainingEditor
        targetElement={activeRemainingEditorTarget}
        isOpen={!!activeRemainingEditorTarget}
        onOpenChange={open => {
          if (!open) {
            setRemainingEditorTarget(null);
          }
        }}
        onCancel={() => setRemainingEditorTarget(null)}
        onQuickDecrement={handleQuickDecrement}
        coffeeBean={isFormMode ? undefined : bean || undefined}
      />
      {/* 打印模态框 */}
      {printEnabled && (
        <BeanPrintModal
          isOpen={printModalOpen}
          bean={bean}
          onClose={() => setPrintModalOpen(false)}
        />
      )}

      {/* 评分模态框 */}
      <BeanRatingModal
        showModal={ratingModalOpen}
        coffeeBean={bean}
        onClose={() => setRatingModalOpen(false)}
        onSave={async (id: string, ratings: Partial<CoffeeBean>) => {
          try {
            const { useCoffeeBeanStore } =
              await import('@/lib/stores/coffeeBeanStore');
            await useCoffeeBeanStore.getState().updateBean(id, ratings);
          } catch (error) {
            console.error('保存评分失败:', error);
          }
        }}
      />

      {/* 删除确认抽屉 */}
      <DeleteConfirmDrawer
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => {
          if (bean && onDelete) {
            onDelete(bean);
            handleClose();
          }
        }}
        itemName={bean?.name || ''}
        itemType="咖啡豆"
        extraWarning="冲煮和烘焙记录会保留，用掉的生豆不会退回。"
      />

      <ActionDrawer
        isOpen={isDraftExitDrawerOpen}
        onClose={() => setIsDraftExitDrawerOpen(false)}
        historyId="bean-draft-exit-drawer"
      >
        <ActionDrawer.Content>
          <p className="text-neutral-500 dark:text-neutral-400">
            当前内容尚未完成，你可以先
            <span className="text-neutral-800 dark:text-neutral-200">
              保存为草稿
            </span>
            ，稍后继续；也可以直接离开。
          </p>
        </ActionDrawer.Content>
        <ActionDrawer.Actions>
          <ActionDrawer.SecondaryButton
            onClick={() => completeClose()}
            className="text-neutral-500 dark:text-neutral-400"
          >
            离开
          </ActionDrawer.SecondaryButton>
          <ActionDrawer.PrimaryButton
            onClick={handleSaveDraft}
            className="bg-neutral-200 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-100"
          >
            保存草稿
          </ActionDrawer.PrimaryButton>
        </ActionDrawer.Actions>
      </ActionDrawer>
    </>
  );
};

export default BeanDetailModal;
