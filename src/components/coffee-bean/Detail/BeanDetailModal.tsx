'use client';

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';

import { CoffeeBean } from '@/types/app';
import { defaultSettings } from '@/components/settings/Settings';
import { getDefaultFlavorPeriodByRoastLevelSync } from '@/lib/utils/flavorPeriodUtils';
import { BREWING_EVENTS } from '@/lib/brewing/constants';
import { useCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore';
import { useBrewingNoteStore } from '@/lib/stores/brewingNoteStore';
import { useCustomEquipmentStore } from '@/lib/stores/customEquipmentStore';
import { RoastingManager } from '@/lib/managers/roastingManager';
import {
  getChildPageStyle,
  useIsLargeScreen,
} from '@/lib/navigation/pageTransition';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';
import {
  getRoasterLogoSync,
  useSettingsStore,
} from '@/lib/stores/settingsStore';
import { getRoasterName } from '@/lib/utils/beanVarietyUtils';
import { openImageViewer } from '@/lib/ui/imageViewer';
import { showToast } from '@/components/common/feedback/LightToast';
import DeleteConfirmDrawer from '@/components/common/ui/DeleteConfirmDrawer';
import RemainingEditor from '@/components/coffee-bean/List/components/RemainingEditor';
import { buildEquipmentNameMap } from '@/lib/notes/noteDisplay';

import {
  BeanDetailModalProps,
  isSimpleChangeRecord,
  isRoastingRecord,
} from './types';
import {
  HeaderBar,
  BeanImageSection,
  BasicInfoSection,
  OriginInfoSection,
  BlendComponentsSection,
  FlavorNotesSection,
  RatingSection,
} from './components';

// 延迟加载记录部分，因为它通常在页面下方
const RelatedRecordsSection = dynamic(
  () => import('./components/RelatedRecordsSection'),
  { ssr: false }
);

const BeanPrintModal = dynamic(
  () => import('@/components/coffee-bean/Print/BeanPrintModal'),
  { ssr: false }
);

const BeanRatingModal = dynamic(
  () => import('@/components/coffee-bean/Rating/Modal'),
  { ssr: false }
);

const BeanDetailModal: React.FC<BeanDetailModalProps> = ({
  isOpen,
  bean: propBean,
  onClose,
  searchQuery = '',
  onEdit,
  onDelete,
  onShare,
  onRate: _onRate,
  onRepurchase: _onRepurchase,
  onRoast,
  onConvertToGreen,
  mode = 'view',
  onSaveNew,
  initialBeanState = 'roasted',
}) => {
  const isLargeScreen = useIsLargeScreen();
  const isAddMode = mode === 'add';

  // 临时 bean 数据（添加模式）
  const [tempBean, setTempBean] = useState<Partial<CoffeeBean>>(() => ({
    name: '',
    beanState: initialBeanState,
    beanType: 'filter',
    capacity: '',
    remaining: '',
    roastLevel: '',
    roastDate: '',
    purchaseDate: '',
    flavor: [],
    notes: '',
    blendComponents: [{ origin: '', estate: '', process: '', variety: '' }],
  }));

  // 重置临时 bean
  useEffect(() => {
    if (isAddMode && isOpen) {
      setTempBean({
        name: '',
        beanState: initialBeanState,
        beanType: 'filter',
        capacity: '',
        remaining: '',
        roastLevel: '',
        roastDate: '',
        purchaseDate: '',
        flavor: [],
        notes: '',
        blendComponents: [{ origin: '', estate: '', process: '', variety: '' }],
      });
    }
  }, [isAddMode, isOpen, initialBeanState]);

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

  const bean = isAddMode ? (tempBean as CoffeeBean) : storeBean || propBean;
  const allBeans = useCoffeeBeanStore(state => state.beans);
  const allNotes = useBrewingNoteStore(state => state.notes);
  const loadNotes = useBrewingNoteStore(state => state.loadNotes);
  const customEquipments = useCustomEquipmentStore(state => state.equipments);
  const customEquipmentInitialized = useCustomEquipmentStore(
    state => state.initialized
  );
  const loadEquipments = useCustomEquipmentStore(state => state.loadEquipments);

  // 关联豆子
  const relatedBeans = React.useMemo(() => {
    if (!bean) return [];
    if (bean.beanState !== 'green' && bean.sourceGreenBeanId) {
      const sourceBean = allBeans.find(b => b.id === bean.sourceGreenBeanId);
      return sourceBean ? [sourceBean] : [];
    }
    return [];
  }, [bean, allBeans]);

  // 状态
  const [imageError, setImageError] = useState(false);
  const [roasterLogo, setRoasterLogo] = useState<string | null>(null);
  const relatedNotes = useMemo(
    () =>
      bean?.id
        ? [...allNotes.filter(note => note.beanId === bean.id)].sort(
            (a, b) => b.timestamp - a.timestamp
          )
        : [],
    [allNotes, bean?.id]
  );
  const equipmentNames = useMemo(
    () => buildEquipmentNameMap(customEquipments),
    [customEquipments]
  );
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printEnabled, setPrintEnabled] = useState(false);
  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  const [isTitleVisible, setIsTitleVisible] = useState(true);
  const [showBeanRating, setShowBeanRating] = useState(false);
  const [showEstateField, setShowEstateField] = useState(false);
  const [showChangeRecords, setShowChangeRecords] = useState(false);
  const [showGreenBeanRecords, setShowGreenBeanRecords] = useState(false);
  const [editingCapacity, setEditingCapacity] = useState(false);
  const [editingRemaining, setEditingRemaining] = useState(false);
  const [editingPrice, setEditingPrice] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [remainingEditorTarget, setRemainingEditorTarget] =
    useState<HTMLElement | null>(null);

  const isGreenBean = bean?.beanState === 'green';

  // 动画处理（优化：使用 flushSync 确保立即渲染，然后触发动画）
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      // 使用 setTimeout(0) 让浏览器先完成 DOM 渲染，然后立即触发动画
      // 比 requestAnimationFrame 更快（~4ms vs ~16ms）
      setTimeout(() => {
        setIsVisible(true);
      }, 0);
    } else {
      setIsVisible(false);
      setPrintModalOpen(false);
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // 记录显示状态
  useEffect(() => {
    if (!bean?.id || !isOpen) return;

    const isGreen = bean.beanState === 'green';
    const roastingRecords = relatedNotes.filter(note => isRoastingRecord(note));
    const brewingRecords = relatedNotes.filter(
      note => !isSimpleChangeRecord(note) && !isRoastingRecord(note)
    );
    const changeRecords = relatedNotes.filter(note =>
      isSimpleChangeRecord(note)
    );
    const primaryRecords = isGreen ? roastingRecords : brewingRecords;
    const hasSourceGreenBean = !isGreen && relatedBeans.length > 0;

    if (primaryRecords.length > 0) {
      setShowChangeRecords(false);
      setShowGreenBeanRecords(false);
    } else if (changeRecords.length > 0) {
      setShowChangeRecords(true);
      setShowGreenBeanRecords(false);
    } else if (hasSourceGreenBean) {
      setShowChangeRecords(false);
      setShowGreenBeanRecords(true);
    } else {
      setShowChangeRecords(false);
      setShowGreenBeanRecords(false);
    }
  }, [bean?.id, bean?.beanState, relatedNotes, relatedBeans, isOpen]);

  // 设置加载（优化：移除 isOpen 依赖，避免每次打开都重新设置）
  const storeSettings = useSettingsStore(state => state.settings);

  useEffect(() => {
    if (storeSettings) {
      setPrintEnabled(storeSettings.enableBeanPrint === true);
      setShowBeanRating(storeSettings.showBeanRating === true);
      setShowEstateField(storeSettings.showEstateField === true);
    } else {
      setPrintEnabled(false);
      setShowBeanRating(false);
      setShowEstateField(false);
    }
  }, [storeSettings]);

  // 标题可见性（优化：减少延迟）
  useEffect(() => {
    if (!isOpen || !isVisible) {
      setIsTitleVisible(true);
      return;
    }

    let observer: IntersectionObserver | null = null;

    // 减少延迟从 100ms 到 50ms
    const timer = setTimeout(() => {
      const titleElement = document.getElementById('bean-detail-title');
      if (!titleElement) return;

      const rect = titleElement.getBoundingClientRect();
      setIsTitleVisible(rect.top >= 60);

      observer = new IntersectionObserver(
        ([entry]) => setIsTitleVisible(entry.isIntersecting),
        { threshold: 0, rootMargin: '-60px 0px 0px 0px' }
      );

      observer.observe(titleElement);
    }, 50);

    return () => {
      clearTimeout(timer);
      if (observer) observer.disconnect();
    };
  }, [isOpen, isVisible]);

  // 历史栈管理
  useModalHistory({
    id: 'bean-detail',
    isOpen,
    onClose: () => {
      onClose();
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('beanDetailClosing'));
      }, 175);
    },
  });

  useEffect(() => {
    if (!isOpen) return;

    if (allNotes.length === 0) {
      void loadNotes();
    }

    if (!customEquipmentInitialized) {
      void loadEquipments();
    }
  }, [
    allNotes.length,
    customEquipmentInitialized,
    isOpen,
    loadEquipments,
    loadNotes,
  ]);

  // 图片错误重置
  useEffect(() => {
    if (bean?.image) setImageError(false);
  }, [bean?.image]);

  useEffect(() => {
    if (!isOpen) {
      setRemainingEditorTarget(null);
    }
  }, [isOpen]);

  // 烘焙商 logo（优化：使用 useMemo 缓存 roasterSettings）
  const roasterSettings = React.useMemo(
    () => ({
      roasterFieldEnabled: storeSettings?.roasterFieldEnabled,
      roasterSeparator: storeSettings?.roasterSeparator,
    }),
    [storeSettings?.roasterFieldEnabled, storeSettings?.roasterSeparator]
  );

  useEffect(() => {
    if (!bean?.name || bean?.image) {
      setRoasterLogo(null);
      return;
    }

    const roasterName = getRoasterName(bean, roasterSettings);
    if (roasterName && roasterName !== '未知烘焙商') {
      const logo = getRoasterLogoSync(roasterName);
      setRoasterLogo(logo || null);
    } else {
      setRoasterLogo(null);
    }
  }, [bean?.name, bean?.image, bean?.roaster, roasterSettings]);

  // 通用字段更新
  const handleUpdateField = async (updates: Partial<CoffeeBean>) => {
    if (isAddMode) {
      setTempBean(prev => ({ ...prev, ...updates }));
      return;
    }

    if (!bean?.id) return;

    try {
      const { getCoffeeBeanStore } =
        await import('@/lib/stores/coffeeBeanStore');
      await getCoffeeBeanStore().updateBean(bean.id, updates);

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
    let startDay = 0;
    let endDay = 0;

    try {
      const settings = useSettingsStore.getState().settings;
      const customFlavorPeriod =
        settings.customFlavorPeriod || defaultSettings.customFlavorPeriod;

      const currentBean = isAddMode ? tempBean : bean;
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

    handleUpdateField({ roastLevel: level, startDay, endDay });
  };

  // 容量/剩余量/价格处理
  const handleCapacityBlur = (value: string) => {
    setEditingCapacity(false);
    if (value) {
      const currentRemaining = isAddMode ? tempBean.remaining : bean?.remaining;
      handleUpdateField({
        capacity: value,
        remaining: currentRemaining || value,
      });
    }
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

    const currentPrice = (isAddMode ? tempBean.price : bean?.price) || '';
    if (normalizedPrice !== currentPrice) {
      await handleUpdateField({ price: normalizedPrice });
    }

    setEditingPrice(false);
  };

  const handleRemainingQuickAction = (
    event: React.MouseEvent<HTMLSpanElement>
  ) => {
    if (isAddMode || !bean) return;

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

  const handleQuickDecrement = async (decrementAmount: number) => {
    if (!bean?.id) return;

    try {
      const beanState = bean.beanState || 'roasted';

      if (beanState === 'green') {
        const result = await RoastingManager.simpleRoast(bean.id, decrementAmount);

        if (result.success && result.greenBean) {
          window.dispatchEvent(
            new CustomEvent('coffeeBeanDataChanged', {
              detail: { action: 'update', beanId: bean.id },
            })
          );
          return;
        }

        showToast({
          type: 'error',
          title: result.error || '烘焙失败',
          duration: 3000,
        });
        return;
      }

      const currentRemaining = parseFloat(bean.remaining || '0');
      if (isNaN(currentRemaining)) {
        showToast({
          type: 'error',
          title: '当前剩余量无效，无法扣除',
          duration: 3000,
        });
        return;
      }

      const actualDecrement = Math.min(decrementAmount, currentRemaining);
      const nextRemaining = Math.max(0, currentRemaining - actualDecrement);
      const formattedValue = nextRemaining.toFixed(1);
      await useCoffeeBeanStore
        .getState()
        .updateBean(bean.id, { remaining: formattedValue });

      window.dispatchEvent(
        new CustomEvent('coffeeBeanDataChanged', {
          detail: { action: 'update', beanId: bean.id },
        })
      );
    } catch (error) {
      console.error('详情页快捷扣除失败:', error);
      showToast({
        type: 'error',
        title: '扣除失败，请重试',
        duration: 3000,
      });
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
    handleUpdateField({ [field]: `${year}-${month}-${day}` });
  };

  // 关闭处理
  const handleClose = () => modalHistory.back();

  // 导航处理
  const handleGoToBrewing = () => {
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
    handleClose();
    if (bean) {
      localStorage.setItem(
        'temp:selectedBean',
        JSON.stringify({
          id: bean.id,
          name: bean.name,
          roastLevel: bean.roastLevel || '',
          roastDate: bean.roastDate || '',
        })
      );
    }
    setTimeout(() => {
      document.dispatchEvent(
        new CustomEvent(BREWING_EVENTS.NAVIGATE_TO_MAIN_TAB, {
          detail: { tab: '笔记' },
        })
      );
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('addNewBrewingNote'));
      }, 300);
    }, 300);
  };

  const handleGoToRoast = () => {
    if (!bean || !onRoast) return;

    const today = new Date().toISOString().split('T')[0];
    const roastedBeanTemplate: Omit<CoffeeBean, 'id' | 'timestamp'> = {
      name: bean.name,
      roaster: bean.roaster,
      beanState: 'roasted',
      beanType: bean.beanType,
      capacity: '',
      remaining: '',
      image: bean.image,
      roastLevel: '',
      roastDate: today,
      flavor: bean.flavor,
      notes: bean.notes,
      brand: bean.brand,
      price: '',
      blendComponents: bean.blendComponents,
      sourceGreenBeanId: bean.id,
    };

    onRoast(bean, roastedBeanTemplate);
  };

  // 图片查看
  const handleImageClick = (imageUrl: string, backImageUrl?: string) => {
    openImageViewer({
      url: imageUrl,
      alt: bean?.name || '咖啡豆图片',
      backUrl: backImageUrl,
    });
  };

  if (!shouldRender) return null;

  return (
    <>
      <div
        className={`flex flex-col overflow-hidden bg-neutral-50 dark:bg-neutral-900 ${
          isLargeScreen ? 'h-full w-full' : 'fixed inset-0 mx-auto'
        }`}
        style={getChildPageStyle(isVisible, undefined, true)}
      >
        <HeaderBar
          isAddMode={isAddMode}
          isGreenBean={isGreenBean}
          isTitleVisible={isTitleVisible}
          bean={bean}
          tempBean={tempBean}
          printEnabled={printEnabled}
          onClose={handleClose}
          onGoToBrewing={handleGoToBrewing}
          onGoToNotes={handleGoToNotes}
          onGoToRoast={handleGoToRoast}
          onPrint={() => setPrintModalOpen(true)}
          onEdit={onEdit}
          onDelete={onDelete}
          onShare={onShare}
          onRoast={onRoast}
          onConvertToGreen={onConvertToGreen}
          onSaveNew={onSaveNew}
          onShowDeleteConfirm={() => setShowDeleteConfirm(true)}
        />

        <div
          className="pb-safe-bottom flex-1 overflow-auto"
          style={{ overflowY: 'auto', touchAction: 'pan-y pinch-zoom' }}
        >
          <BeanImageSection
            bean={bean}
            tempBean={tempBean}
            isAddMode={isAddMode}
            roasterLogo={roasterLogo}
            imageError={imageError}
            setImageError={setImageError}
            setTempBean={setTempBean}
            handleUpdateField={handleUpdateField}
            onImageClick={handleImageClick}
          />

          {bean ? (
            <div className="space-y-3 px-6 pb-6">
              <BasicInfoSection
                bean={bean}
                tempBean={tempBean}
                isAddMode={isAddMode}
                isGreenBean={isGreenBean}
                searchQuery={searchQuery}
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

              <OriginInfoSection
                bean={bean}
                tempBean={tempBean}
                isAddMode={isAddMode}
                searchQuery={searchQuery}
                showEstateField={showEstateField}
                handleUpdateField={handleUpdateField}
                handleRoastLevelSelect={handleRoastLevelSelect}
              />

              <BlendComponentsSection
                bean={bean}
                handleUpdateField={handleUpdateField}
              />

              <FlavorNotesSection
                bean={bean}
                tempBean={tempBean}
                isAddMode={isAddMode}
                searchQuery={searchQuery}
                handleUpdateField={handleUpdateField}
              />

              <RatingSection
                bean={bean}
                isAddMode={isAddMode}
                showBeanRating={showBeanRating}
                onOpenRatingModal={() => setRatingModalOpen(true)}
              />

              <RelatedRecordsSection
                relatedNotes={relatedNotes}
                relatedBeans={relatedBeans}
                equipmentNames={equipmentNames}
                isGreenBean={isGreenBean}
                allBeans={allBeans}
                bean={bean}
                showChangeRecords={showChangeRecords}
                showGreenBeanRecords={showGreenBeanRecords}
                setShowChangeRecords={setShowChangeRecords}
                setShowGreenBeanRecords={setShowGreenBeanRecords}
                onImageClick={handleImageClick}
              />
            </div>
          ) : null}
        </div>
      </div>

      <RemainingEditor
        targetElement={remainingEditorTarget}
        isOpen={!!remainingEditorTarget}
        onOpenChange={open => {
          if (!open) {
            setRemainingEditorTarget(null);
          }
        }}
        onCancel={() => setRemainingEditorTarget(null)}
        onQuickDecrement={handleQuickDecrement}
        coffeeBean={isAddMode ? undefined : bean || undefined}
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
      />
    </>
  );
};

export default BeanDetailModal;
