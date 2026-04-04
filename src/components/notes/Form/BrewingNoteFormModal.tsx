'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import BrewingNoteForm from './BrewingNoteForm';
import { MethodSelector, CoffeeBeanSelector } from '@/components/notes/Form';
import EquipmentCategoryBar from './EquipmentCategoryBar';
import { useMethodManagement } from '@/components/notes/Form/hooks/useMethodManagement';
import type {
  BrewingNoteData,
  CoffeeBean,
  SelectableCoffeeBean,
} from '@/types/app';
import { SettingsOptions } from '@/components/settings/Settings';
import ActionDrawer from '@/components/common/ui/ActionDrawer';

import NoteSteppedFormModal, { Step } from './NoteSteppedFormModal';
import { type Method, type CustomEquipment } from '@/lib/core/config';
import { loadCustomEquipments } from '@/lib/stores/customEquipmentStore';
import { useEquipmentStore } from '@/lib/stores/equipmentStore';
import CoffeeBeanRandomPicker from '@/components/coffee-bean/RandomPicker/CoffeeBeanRandomPicker';
import { useCoffeeBeanData } from './hooks/useCoffeeBeanData';
import {
  useMultiStepModalHistory,
  modalHistory,
} from '@/lib/hooks/useModalHistory';
import {
  normalizeBrewingNoteParams,
  normalizeBrewingNoteDraftSelection,
  normalizeBrewingNoteSelection,
} from '@/lib/notes/noteDisplay';
import {
  clearBrewingNoteDraftSession,
  createBrewingNoteDraftSession,
  hasBrewingNoteDraftRecordContent,
  loadBrewingNoteDraftSession,
  saveBrewingNoteDraftSession,
  type BrewingNoteDraftData,
  type BrewingNoteDraftSession,
} from './brewingNoteDraft';
import { findCoffeeBeanByIdentity } from '@/lib/utils/coffeeBeanUtils';

interface BrewingNoteFormModalProps {
  showForm: boolean;
  initialNote?: Partial<BrewingNoteData> & {
    coffeeBean?: CoffeeBean | null;
    id?: string;
  };
  onSave: (note: BrewingNoteData) => void;
  onClose: () => void;
  onSaveSuccess?: () => void;
  settings?: SettingsOptions;
}

const EMPTY_COFFEE_BEAN_INFO = {
  name: '',
  roastLevel: '中度烘焙',
  roastDate: '',
  roaster: undefined,
};

const buildCoffeeBeanInfo = (
  coffeeBean: SelectableCoffeeBean | null | undefined,
  fallback?: BrewingNoteDraftData['coffeeBeanInfo']
) => {
  if (coffeeBean) {
    const bean = coffeeBean as CoffeeBean;
    return {
      name: coffeeBean.name || '',
      roastLevel: bean.roastLevel || '中度烘焙',
      roastDate: bean.roastDate || '',
      roaster: bean.roaster,
    };
  }

  return {
    ...EMPTY_COFFEE_BEAN_INFO,
    ...fallback,
  };
};

const normalizeDraftNote = (
  note: BrewingNoteDraftData
): BrewingNoteDraftData => {
  const normalizedSelection = normalizeBrewingNoteDraftSelection({
    equipment: note.equipment || '',
    method: note.method || '',
  });
  const images =
    Array.isArray(note.images) && note.images.length > 0
      ? note.images
      : typeof note.image === 'string' && note.image
        ? [note.image]
        : [];

  return {
    ...note,
    equipment: normalizedSelection.equipment,
    method: normalizedSelection.method,
    coffeeBean: note.coffeeBean || null,
    coffeeBeanInfo: buildCoffeeBeanInfo(note.coffeeBean, note.coffeeBeanInfo),
    image: images[0] || '',
    images,
    params: normalizeBrewingNoteParams(note.params),
    rating: note.rating ?? 0,
    taste: note.taste || {
      acidity: 0,
      sweetness: 0,
      bitterness: 0,
      body: 0,
    },
    notes: note.notes || '',
    timestamp: note.timestamp ?? Date.now(),
  };
};

const BrewingNoteFormModal: React.FC<BrewingNoteFormModalProps> = ({
  showForm,
  initialNote,
  onSave,
  onClose,
  onSaveSuccess,
  settings,
}) => {
  const { beans: coffeeBeans } = useCoffeeBeanData();
  const persistedEquipment = useEquipmentStore(
    state => state.selectedEquipment
  );
  const setPersistedEquipment = useEquipmentStore(
    state => state.setSelectedEquipment
  );
  const [customEquipments, setCustomEquipments] = useState<CustomEquipment[]>(
    []
  );
  const [isRandomPickerOpen, setIsRandomPickerOpen] = useState(false);
  const [isLongPressRandom, setIsLongPressRandom] = useState(false);
  const [isExitDrawerOpen, setIsExitDrawerOpen] = useState(false);

  const getInitialDraftEquipmentId = useCallback(
    () =>
      initialNote?.equipment ||
      useEquipmentStore.getState().selectedEquipment ||
      '',
    [initialNote?.equipment]
  );

  const buildBaseSession = useCallback(
    () =>
      createBrewingNoteDraftSession({
        initialNote: initialNote
          ? {
              ...initialNote,
              coffeeBean: initialNote.coffeeBean || null,
            }
          : undefined,
        persistedEquipment: getInitialDraftEquipmentId(),
      }),
    [getInitialDraftEquipmentId, initialNote]
  );

  const [baselineSession, setBaselineSession] =
    useState<BrewingNoteDraftSession>(buildBaseSession);
  const [draftSession, setDraftSession] =
    useState<BrewingNoteDraftSession>(buildBaseSession);
  const historyCloseRequestRef = useRef<() => void>(() => {});
  const latestDraftSessionRef = useRef(draftSession);
  const latestHasDraftRecordContentRef = useRef(false);
  const latestIsCreateModeRef = useRef(!initialNote?.id);
  const shouldAutoPersistRef = useRef(true);

  const setDraftStep = useCallback((value: React.SetStateAction<number>) => {
    setDraftSession(prev => ({
      ...prev,
      step: typeof value === 'function' ? value(prev.step) : value,
      updatedAt: Date.now(),
    }));
  }, []);

  const updateDraftNote = useCallback(
    (
      updater:
        | BrewingNoteDraftData
        | ((prev: BrewingNoteDraftData) => BrewingNoteDraftData)
    ) => {
      setDraftSession(prev => {
        const nextNote =
          typeof updater === 'function' ? updater(prev.note) : updater;

        return {
          ...prev,
          note: normalizeDraftNote(nextNote),
          updatedAt: Date.now(),
        };
      });
    },
    []
  );

  const selectedCoffeeBean = draftSession.note.coffeeBean || null;
  const selectedEquipment = draftSession.note.equipment || '';
  const selectedMethodId = draftSession.note.method || '';
  const currentStep = draftSession.step;
  const maxStepIndex = coffeeBeans.length > 0 ? 2 : 1;
  const boundedCurrentStep = Math.min(currentStep, maxStepIndex);
  const hasDraftRecordContent = useMemo(
    () => hasBrewingNoteDraftRecordContent(draftSession, baselineSession),
    [baselineSession, draftSession]
  );
  const isCreateMode = !initialNote?.id;

  useEffect(() => {
    latestDraftSessionRef.current = draftSession;
    latestHasDraftRecordContentRef.current = hasDraftRecordContent;
    latestIsCreateModeRef.current = isCreateMode;
  }, [draftSession, hasDraftRecordContent, isCreateMode]);

  useEffect(() => {
    if (showForm) {
      shouldAutoPersistRef.current = true;
    }
  }, [showForm]);

  const { customMethods, commonMethodsOnly, setSelectedMethod } =
    useMethodManagement({
      selectedEquipment,
      initialMethod: selectedMethodId,
      customEquipments,
      settings,
    });

  useEffect(() => {
    if (!showForm) {
      return;
    }

    const baseSession = buildBaseSession();
    setBaselineSession(baseSession);

    if (!initialNote?.id) {
      const savedDraft = loadBrewingNoteDraftSession();
      if (savedDraft) {
        setDraftSession({
          ...savedDraft,
          note: normalizeDraftNote(savedDraft.note),
        });
        return;
      }
    }

    setDraftSession(baseSession);
  }, [buildBaseSession, initialNote?.id, showForm]);

  useEffect(() => {
    if (!showForm) {
      setIsExitDrawerOpen(false);
    }
  }, [showForm]);

  useEffect(() => {
    if (!showForm || coffeeBeans.length === 0 || selectedCoffeeBean) {
      return;
    }

    if (draftSession.note.beanId) {
      const foundById = coffeeBeans.find(
        bean => bean.id === draftSession.note.beanId
      );
      if (foundById) {
        updateDraftNote(prev => ({
          ...prev,
          coffeeBean: foundById,
          coffeeBeanInfo: buildCoffeeBeanInfo(foundById, prev.coffeeBeanInfo),
        }));
        return;
      }
    }

    if (draftSession.note.coffeeBeanInfo?.name) {
      const foundByName = findCoffeeBeanByIdentity(
        coffeeBeans,
        draftSession.note.coffeeBeanInfo
      );
      if (foundByName) {
        updateDraftNote(prev => ({
          ...prev,
          coffeeBean: foundByName,
          coffeeBeanInfo: buildCoffeeBeanInfo(foundByName, prev.coffeeBeanInfo),
        }));
      }
    }
  }, [
    coffeeBeans,
    draftSession.note.beanId,
    draftSession.note.coffeeBeanInfo,
    selectedCoffeeBean,
    showForm,
    updateDraftNote,
  ]);

  useEffect(() => {
    if (showForm) {
      loadCustomEquipments()
        .then(equipments => setCustomEquipments(equipments))
        .catch(error => console.error('加载自定义器具失败:', error));
    }
  }, [showForm]);

  const closeModal = useCallback(
    ({ preserveSavedDraft = false }: { preserveSavedDraft?: boolean } = {}) => {
      shouldAutoPersistRef.current = false;

      if (!preserveSavedDraft) {
        clearBrewingNoteDraftSession();
      }

      setIsExitDrawerOpen(false);
      onClose();
    },
    [onClose]
  );

  const handleHistoryCloseRequest = useCallback(() => {
    if (hasDraftRecordContent) {
      modalHistory.pushStep(
        'note-stepped-form',
        boundedCurrentStep + 1,
        step => setDraftStep(() => step - 1),
        () => historyCloseRequestRef.current()
      );
      setIsExitDrawerOpen(true);
      return;
    }

    closeModal();
  }, [boundedCurrentStep, closeModal, hasDraftRecordContent, setDraftStep]);

  useEffect(() => {
    historyCloseRequestRef.current = handleHistoryCloseRequest;
  }, [handleHistoryCloseRequest]);

  useMultiStepModalHistory({
    id: 'note-stepped-form',
    isOpen: showForm,
    step: boundedCurrentStep + 1,
    onStepChange: step => {
      setDraftStep(() => step - 1);
    },
    onClose: handleHistoryCloseRequest,
  });

  const handleCloseRequest = useCallback(() => {
    if (boundedCurrentStep > 0) {
      modalHistory.back();
      return;
    }

    if (hasDraftRecordContent) {
      setIsExitDrawerOpen(true);
      return;
    }

    closeModal();
  }, [boundedCurrentStep, closeModal, hasDraftRecordContent]);

  const handleEquipmentSelect = useCallback(
    (equipmentId: string) => {
      updateDraftNote(prev => {
        const shouldResetMethod = equipmentId !== (prev.equipment || '');

        return {
          ...prev,
          equipment: equipmentId,
          method: shouldResetMethod ? '' : prev.method,
          params: shouldResetMethod
            ? normalizeBrewingNoteParams(undefined)
            : prev.params,
          totalTime: shouldResetMethod ? undefined : prev.totalTime,
        };
      });

      setPersistedEquipment(equipmentId);
      if (equipmentId !== selectedEquipment) {
        setSelectedMethod('');
      }
    },
    [
      selectedEquipment,
      setPersistedEquipment,
      setSelectedMethod,
      updateDraftNote,
    ]
  );

  const handleCoffeeBeanSelect = useCallback(
    (bean: CoffeeBean | null) => {
      updateDraftNote(prev => ({
        ...prev,
        coffeeBean: bean,
        beanId: bean?.id,
        coffeeBeanInfo: buildCoffeeBeanInfo(bean, prev.coffeeBeanInfo),
      }));
      setDraftStep(prev => prev + 1);
    },
    [setDraftStep, updateDraftNote]
  );

  const handleOpenRandomPicker = (isLongPress: boolean = false) => {
    setIsLongPressRandom(isLongPress);
    setIsRandomPickerOpen(true);
  };

  const handleRandomBeanSelect = useCallback(
    (bean: CoffeeBean) => {
      updateDraftNote(prev => ({
        ...prev,
        coffeeBean: bean,
        beanId: bean.id,
        coffeeBeanInfo: buildCoffeeBeanInfo(bean, prev.coffeeBeanInfo),
      }));
      setDraftStep(prev => prev + 1);
    },
    [setDraftStep, updateDraftNote]
  );

  const handleMethodParamsChange = useCallback(
    (method: Method) => {
      const methodIdentifier = method.id || method.name;
      const nextParams = {
        ...normalizeBrewingNoteParams(method.params),
        stages: method.params.stages || [],
      };
      const totalTime =
        method.params.stages?.reduce(
          (acc, stage) => acc + (stage.duration || 0),
          0
        ) || undefined;

      setSelectedMethod(methodIdentifier);
      updateDraftNote(prev => ({
        ...prev,
        method: methodIdentifier,
        params: nextParams,
        totalTime,
      }));

      setTimeout(() => {
        document.dispatchEvent(
          new CustomEvent('methodParamsChanged', {
            detail: { params: method.params },
          })
        );

        const params = method.params;
        if (params.coffee) {
          window.dispatchEvent(
            new CustomEvent('brewing:updateNavbarDisplay', {
              detail: { type: 'coffee', value: params.coffee.replace('g', '') },
            })
          );
        }
        if (params.ratio) {
          window.dispatchEvent(
            new CustomEvent('brewing:updateNavbarDisplay', {
              detail: { type: 'ratio', value: params.ratio.replace('1:', '') },
            })
          );
        }
        if (params.grindSize) {
          window.dispatchEvent(
            new CustomEvent('brewing:updateNavbarDisplay', {
              detail: { type: 'grindSize', value: params.grindSize },
            })
          );
        }
        if (params.temp) {
          window.dispatchEvent(
            new CustomEvent('brewing:updateNavbarDisplay', {
              detail: { type: 'temp', value: params.temp.replace('°C', '') },
            })
          );
        }
      }, 0);
    },
    [setSelectedMethod, updateDraftNote]
  );

  const handleStepComplete = useCallback(() => {
    setTimeout(() => {
      const modalRoot = document.querySelector(
        '[data-note-stepped-form-modal="true"]'
      );
      const form = modalRoot?.querySelector('form');
      if (form) {
        form.dispatchEvent(
          new Event('submit', { cancelable: true, bubbles: true })
        );
      }
    }, 0);
  }, []);

  const handleSaveNote = useCallback(
    (note: BrewingNoteData) => {
      shouldAutoPersistRef.current = false;

      let methodName = selectedMethodId || '';

      if (selectedMethodId) {
        const allMethods = [...commonMethodsOnly, ...customMethods];
        const methodObj = allMethods.find(
          m => m.id === selectedMethodId || m.name === selectedMethodId
        );
        if (methodObj) {
          methodName = methodObj.name;
        }
      }

      const normalizedSelection = normalizeBrewingNoteSelection({
        equipment: selectedEquipment,
        method: methodName,
      });

      const completeNote: BrewingNoteData = {
        ...note,
        equipment: normalizedSelection.equipment,
        method: normalizedSelection.method,
        coffeeBean: undefined,
        params: normalizeBrewingNoteParams(note.params),
      };

      if (
        selectedCoffeeBean &&
        'id' in selectedCoffeeBean &&
        selectedCoffeeBean.id
      ) {
        completeNote.beanId = selectedCoffeeBean.id;
        completeNote.coffeeBeanInfo = buildCoffeeBeanInfo(
          selectedCoffeeBean,
          completeNote.coffeeBeanInfo
        );
      }

      clearBrewingNoteDraftSession();
      onSave(completeNote);
      onClose();
    },
    [
      commonMethodsOnly,
      customMethods,
      onClose,
      onSave,
      selectedCoffeeBean,
      selectedEquipment,
      selectedMethodId,
    ]
  );

  const handleDraftChange = useCallback(
    (nextDraft: BrewingNoteDraftData) => {
      updateDraftNote(prev => ({
        ...prev,
        ...nextDraft,
      }));
    },
    [updateDraftNote]
  );

  const handleSaveDraft = useCallback(() => {
    if (!hasDraftRecordContent) {
      closeModal();
      return;
    }

    saveBrewingNoteDraftSession({
      ...draftSession,
      step: maxStepIndex,
    });
    closeModal({ preserveSavedDraft: true });
  }, [closeModal, draftSession, hasDraftRecordContent, maxStepIndex]);

  const persistDraftSnapshot = useCallback(() => {
    if (
      !shouldAutoPersistRef.current ||
      !latestIsCreateModeRef.current ||
      !latestHasDraftRecordContentRef.current
    ) {
      return;
    }

    saveBrewingNoteDraftSession({
      ...latestDraftSessionRef.current,
      step: maxStepIndex,
    });
  }, [maxStepIndex]);

  useEffect(() => {
    if (!showForm) {
      return;
    }

    const handlePageHide = () => {
      persistDraftSnapshot();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        persistDraftSnapshot();
      }
    };

    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    let removeAppStateListener: (() => void) | undefined;
    let isDisposed = false;

    if (Capacitor.isNativePlatform()) {
      CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) {
          persistDraftSnapshot();
        }
      }).then(listener => {
        if (isDisposed) {
          listener.remove();
          return;
        }

        removeAppStateListener = () => {
          listener.remove();
        };
      });
    }

    return () => {
      isDisposed = true;
      persistDraftSnapshot();
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      removeAppStateListener?.();
    };
  }, [persistDraftSnapshot, showForm]);

  const steps: Step[] = useMemo(
    () => [
      ...(coffeeBeans.length > 0
        ? [
            {
              id: 'coffeeBean',
              label: '选择咖啡豆',
              content: (
                <CoffeeBeanSelector
                  coffeeBeans={coffeeBeans}
                  selectedCoffeeBean={
                    selectedCoffeeBean && 'roastLevel' in selectedCoffeeBean
                      ? (selectedCoffeeBean as CoffeeBean)
                      : null
                  }
                  onSelect={handleCoffeeBeanSelect}
                  showStatusDots={settings?.showStatusDots}
                />
              ),
              isValid: true,
            },
          ]
        : []),
      {
        id: 'method',
        label: '选择方案',
        content: (
          <div>
            <EquipmentCategoryBar
              selectedEquipment={selectedEquipment}
              customEquipments={customEquipments}
              onEquipmentSelect={handleEquipmentSelect}
              settings={settings}
            />
            {selectedEquipment && (
              <MethodSelector
                selectedEquipment={selectedEquipment}
                selectedMethod={selectedMethodId}
                customMethods={customMethods}
                commonMethods={commonMethodsOnly}
                onMethodSelect={(methodId: string) => {
                  setSelectedMethod(methodId);
                  updateDraftNote(prev => ({
                    ...prev,
                    method: methodId,
                    params: normalizeBrewingNoteParams(undefined),
                    totalTime: undefined,
                  }));
                }}
                onParamsChange={handleMethodParamsChange}
                grinderDefaultSyncEnabled={
                  settings?.grinderDefaultSync?.manualNote ?? true
                }
              />
            )}
          </div>
        ),
        isValid: true,
      },
      {
        id: 'note-form',
        label: '冲煮笔记',
        content: (
          <BrewingNoteForm
            id={initialNote?.id}
            onClose={() => {}}
            onSave={handleSaveNote}
            initialData={draftSession.note}
            inBrewPage={true}
            showSaveButton={false}
            onSaveSuccess={onSaveSuccess}
            settings={settings}
            onDraftChange={handleDraftChange}
            syncInitialDataChanges={false}
          />
        ),
        isValid: true,
      },
    ],
    [
      coffeeBeans,
      commonMethodsOnly,
      customEquipments,
      customMethods,
      draftSession.note,
      handleCoffeeBeanSelect,
      handleDraftChange,
      handleEquipmentSelect,
      handleMethodParamsChange,
      handleSaveNote,
      initialNote?.id,
      onSaveSuccess,
      selectedCoffeeBean,
      selectedEquipment,
      selectedMethodId,
      setSelectedMethod,
      settings,
      updateDraftNote,
    ]
  );

  return (
    <>
      <NoteSteppedFormModal
        showForm={showForm}
        onClose={handleCloseRequest}
        onComplete={handleStepComplete}
        steps={steps}
        initialStep={0}
        preserveState={true}
        currentStep={boundedCurrentStep}
        setCurrentStep={setDraftStep}
        onRandomBean={handleOpenRandomPicker}
      />

      <CoffeeBeanRandomPicker
        beans={coffeeBeans}
        isOpen={isRandomPickerOpen}
        onClose={() => {
          setIsRandomPickerOpen(false);
          setIsLongPressRandom(false);
        }}
        onSelect={handleRandomBeanSelect}
        isLongPress={isLongPressRandom}
      />

      <ActionDrawer
        isOpen={isExitDrawerOpen}
        onClose={() => setIsExitDrawerOpen(false)}
        historyId="note-draft-exit-drawer"
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
            onClick={() => closeModal()}
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

export default BrewingNoteFormModal;
