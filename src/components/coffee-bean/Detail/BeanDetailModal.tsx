'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

import { CoffeeBean } from '@/types/app';
import { BrewingNote } from '@/lib/core/config';
import { defaultSettings } from '@/components/settings/Settings';
import { getDefaultFlavorPeriodByRoastLevelSync } from '@/lib/utils/flavorPeriodUtils';
import { getEquipmentName } from '@/components/notes/utils';
import { BREWING_EVENTS } from '@/lib/brewing/constants';
import { useCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore';
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
import DeleteConfirmDrawer from '@/components/common/ui/DeleteConfirmDrawer';

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

// 动态导入
const ImageViewer = dynamic(
  () => import('@/components/common/ui/ImageViewer'),
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
  const [relatedNotes, setRelatedNotes] = useState<BrewingNote[]>([]);
  const [equipmentNames, setEquipmentNames] = useState<Record<string, string>>(
    {}
  );
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState('');
  const [currentBackImageUrl, setCurrentBackImageUrl] = useState<
    string | undefined
  >(undefined);
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
        setRelatedNotes([]);
        setEquipmentNames({});
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

  // 数据刷新
  const refreshBeans = useCoffeeBeanStore(state => state.refreshBeans);

  useEffect(() => {
    if (!isOpen) return;

    const handleCoffeeBeanDataChanged = () => refreshBeans();

    window.addEventListener(
      'coffeeBeanDataChanged',
      handleCoffeeBeanDataChanged as EventListener
    );

    return () => {
      window.removeEventListener(
        'coffeeBeanDataChanged',
        handleCoffeeBeanDataChanged as EventListener
      );
    };
  }, [isOpen, refreshBeans]);

  // 图片错误重置
  useEffect(() => {
    if (bean?.image) setImageError(false);
  }, [bean?.image]);

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

  // 加载相关记录（优化：避免切换时闪烁，关闭时由动画 useEffect 清空）
  useEffect(() => {
    // 如果没有 bean 或未打开，直接返回，不清空数据
    // 数据清空由动画 useEffect 在 350ms 后处理
    if (!bean?.id || !isOpen) {
      return;
    }

    let isCancelled = false;

    const loadRelatedNotes = async () => {
      try {
        // 使用 store 获取笔记，避免每次都读取 Storage
        const { useBrewingNoteStore } = await import(
          '@/lib/stores/brewingNoteStore'
        );
        const allNotes = useBrewingNoteStore.getState().notes;

        // 如果 store 为空，尝试加载
        if (allNotes.length === 0) {
          await useBrewingNoteStore.getState().loadNotes();
        }

        if (isCancelled) return;

        const beanNotes = useBrewingNoteStore
          .getState()
          .notes.filter(note => note.beanId === bean.id);
        const sortedNotes = beanNotes.sort((a, b) => b.timestamp - a.timestamp);

        // 立即设置笔记数据
        setRelatedNotes(sortedNotes);

        // 异步加载设备名称
        const equipmentIds = Array.from(
          new Set(
            sortedNotes
              .map(note => note.equipment)
              .filter((equipment): equipment is string => !!equipment)
          )
        );

        if (equipmentIds.length > 0) {
          const namesMap: Record<string, string> = {};

          // 并行获取所有设备名称
          const results = await Promise.allSettled(
            equipmentIds.map(async equipmentId => {
              const name = await getEquipmentName(equipmentId);
              return { equipmentId, name };
            })
          );

          if (isCancelled) return;

          results.forEach(result => {
            if (result.status === 'fulfilled') {
              namesMap[result.value.equipmentId] = result.value.name;
            }
          });

          setEquipmentNames(namesMap);
        } else {
          // 如果没有设备，清空设备名称映射
          setEquipmentNames({});
        }
      } catch (error) {
        if (!isCancelled) {
          console.error('加载冲煮记录失败:', error);
          setRelatedNotes([]);
        }
      }
    };

    loadRelatedNotes();

    return () => {
      isCancelled = true;
    };
  }, [bean?.id, isOpen]);

  // 通用字段更新
  const handleUpdateField = async (updates: Partial<CoffeeBean>) => {
    if (isAddMode) {
      setTempBean(prev => ({ ...prev, ...updates }));
      return;
    }

    if (!bean?.id) return;

    try {
      const { getCoffeeBeanStore } = await import(
        '@/lib/stores/coffeeBeanStore'
      );
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

  const handlePriceBlur = (value: string) => {
    setEditingPrice(false);
    if (value) handleUpdateField({ price: value });
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
                detail: { beanName: bean.name },
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
      roastLevel: bean.roastLevel,
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
    setCurrentImageUrl(imageUrl);
    setCurrentBackImageUrl(backImageUrl);
    setImageViewerOpen(true);
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

      {/* 图片查看器 */}
      {currentImageUrl && imageViewerOpen && (
        <ImageViewer
          id="bean-detail-image"
          isOpen={imageViewerOpen}
          imageUrl={currentImageUrl}
          backImageUrl={currentBackImageUrl}
          alt="咖啡豆图片"
          onClose={() => {
            setImageViewerOpen(false);
            setCurrentImageUrl('');
            setCurrentBackImageUrl(undefined);
          }}
        />
      )}

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
            const { useCoffeeBeanStore } = await import(
              '@/lib/stores/coffeeBeanStore'
            );
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
