'use client';

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import CoffeeBeanFormModal from '@/components/coffee-bean/Form/Modal';
import CoffeeBeanRatingModal from '../Rating/Modal';
import _CoffeeBeanRanking from '../Ranking';
import BottomActionBar from '@/components/layout/BottomActionBar';
import { useCopy } from '@/lib/hooks/useCopy';
import CopyFailureDrawer from '@/components/common/feedback/CopyFailureDrawer';
import { beanToReadableText } from '@/lib/utils/jsonUtils';
import {
  type SortOption,
  sortBeans,
  convertToRankingSortOption as _convertToRankingSortOption,
} from './SortSelector';
import {
  ExtendedCoffeeBean,
  CoffeeBeansProps,
  BeanType,
  BeanState,
  VIEW_OPTIONS,
  ViewOption,
  BeanFilterMode,
} from './types';
import {
  globalCache,
  saveShowEmptyBeansPreference,
  saveShowEmptyBeansByStatePreference,
  getShowEmptyBeansByStatePreference,
  saveSelectedVarietyPreference,
  saveSelectedVarietyByStatePreference,
  getSelectedVarietyByStatePreference,
  saveSelectedBeanTypePreference,
  saveSelectedBeanTypeByStatePreference,
  getSelectedBeanTypeByStatePreference,
  saveSelectedBeanStatePreference,
  getValidBeanState,
  saveViewModePreference,
  saveSortOptionPreference,
  saveInventorySortOptionPreference,
  saveInventorySortOptionByStatePreference,
  getInventorySortOptionByStatePreference,
  saveRankingSortOptionPreference,
  saveRankingBeanTypePreference,
  saveFilterModePreference,
  saveFilterModeByStatePreference,
  getFilterModeByStatePreference,
  saveSelectedOriginPreference,
  saveSelectedOriginByStatePreference,
  getSelectedOriginByStatePreference,
  saveSelectedProcessingMethodPreference,
  saveSelectedProcessingMethodByStatePreference,
  getSelectedProcessingMethodByStatePreference,
  saveSelectedFlavorPeriodPreference,
  saveSelectedFlavorPeriodByStatePreference,
  getSelectedFlavorPeriodByStatePreference,
  saveSelectedRoasterPreference,
  saveSelectedRoasterByStatePreference,
  getSelectedRoasterByStatePreference,
  // 显示模式相关
  type DisplayMode,
  isBeanEmpty,
  getSearchHistoryPreference,
  addSearchHistory,
} from './preferences';
import { useBeanOperations } from './hooks/useBeanOperations';
import { useEnhancedBeanFiltering } from './hooks/useEnhancedBeanFiltering';
import {
  FlavorPeriodStatus,
  beanHasVariety,
  beanHasOrigin,
  beanHasFlavorPeriodStatus,
  beanHasRoaster,
  RoasterSettings,
} from '@/lib/utils/beanVarietyUtils';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import ViewSwitcher from './components/ViewSwitcher';
import InventoryView from './components/InventoryView';
import BeanListItem from './components/BeanListItem';
import StatsView from './components/StatsView';
import { showToast } from '@/components/common/feedback/LightToast';
import { exportListPreview } from './components/ListExporter';
import { useCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore';
import { useBrewingNoteStore } from '@/lib/stores/brewingNoteStore';
import { hasBeanRating } from '@/lib/utils/beanRatingUtils';
import { BrewingNoteData } from '@/types/app';
import {
  type TableColumnKey,
  getDefaultVisibleColumns,
} from './components/TableView';
import DeleteConfirmDrawer from '@/components/common/ui/DeleteConfirmDrawer';
import { calculateEstimatedCupsPerBean } from '@/components/notes/utils';
import EmptyBeanTipDrawer, {
  shouldShowEmptyBeanTip,
} from './components/EmptyBeanTipDrawer';

const CoffeeBeanRanking = _CoffeeBeanRanking;
const convertToRankingSortOption = _convertToRankingSortOption;

globalCache.selectedBeanType = globalCache.selectedBeanType || 'all';

const CoffeeBeans: React.FC<CoffeeBeansProps> = ({
  isOpen,
  showBeanForm,
  onShowImport,
  externalViewMode,
  onExternalViewChange,
  initialViewMode,
  settings,
}) => {
  const { copyText, failureDrawerProps } = useCopy();

  // 直接从 Store 订阅数据
  const beans = useCoffeeBeanStore(
    state => state.beans
  ) as ExtendedCoffeeBean[];
  const storeInitialized = useCoffeeBeanStore(state => state.initialized);
  const loadBeansFromStore = useCoffeeBeanStore(state => state.loadBeans);

  // 获取笔记数据用于计算自动评分
  const notes = useBrewingNoteStore(state => state.notes);

  const [_ratedBeans, setRatedBeans] = useState<ExtendedCoffeeBean[]>(
    globalCache.ratedBeans
  );
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingBean, setEditingBean] = useState<ExtendedCoffeeBean | null>(
    null
  );
  const [sortOption, setSortOption] = useState<SortOption>(
    globalCache.sortOption
  );
  // 视图特定的排序选项
  const [inventorySortOption, setInventorySortOption] = useState<SortOption>(
    globalCache.inventorySortOption
  );
  const [rankingSortOption, setRankingSortOption] = useState<SortOption>(
    globalCache.rankingSortOption
  );
  // 使用外部传递的视图状态，如果没有则使用初始化参数或内部状态作为后备
  const viewMode = externalViewMode || initialViewMode || globalCache.viewMode;
  const setViewMode =
    onExternalViewChange ||
    ((view: ViewOption) => {
      globalCache.viewMode = view;
      saveViewModePreference(view);
    });

  // 评分相关状态
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedBeanForRating, setSelectedBeanForRating] =
    useState<ExtendedCoffeeBean | null>(null);
  const [ratingSavedCallback, setRatingSavedCallback] = useState<
    (() => void) | null
  >(null);

  // 过滤和显示控制状态
  const [selectedVariety, setSelectedVariety] = useState<string | null>(
    globalCache.selectedVariety
  );
  const [selectedBeanType, setSelectedBeanType] = useState<BeanType>(
    globalCache.selectedBeanType
  );
  const [selectedBeanState, setSelectedBeanState] = useState<BeanState>(() => {
    // 使用 getValidBeanState 确保生豆库未启用时不会返回 green 状态
    const validState = getValidBeanState();
    globalCache.selectedBeanState = validState;
    return validState;
  });
  const [showEmptyBeans, setShowEmptyBeans] = useState<boolean>(
    globalCache.showEmptyBeans
  );

  // 备注展开状态管理 - 记录每个咖啡豆的备注是否展开
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>(
    {}
  );

  // 删除确认抽屉状态
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingBean, setDeletingBean] = useState<ExtendedCoffeeBean | null>(
    null
  );

  // 用完咖啡豆提示抽屉状态
  const [showEmptyBeanTip, setShowEmptyBeanTip] = useState(false);

  // 新增分类相关状态
  const [filterMode, setFilterMode] = useState<BeanFilterMode>(
    globalCache.filterMode
  );
  const [selectedOrigin, setSelectedOrigin] = useState<string | null>(
    globalCache.selectedOrigin
  );
  const [selectedProcessingMethod, setSelectedProcessingMethod] = useState<
    string | null
  >(globalCache.selectedProcessingMethod);
  const [selectedFlavorPeriod, setSelectedFlavorPeriod] =
    useState<FlavorPeriodStatus | null>(globalCache.selectedFlavorPeriod);
  const [selectedRoaster, setSelectedRoaster] = useState<string | null>(
    globalCache.selectedRoaster
  );

  const [rankingBeanType, setRankingBeanType] = useState<BeanType>(
    globalCache.rankingBeanType
  );

  // 榜单时间筛选状态
  const [rankingTimeFilter, setRankingTimeFilter] = useState<{
    type: 'all' | 'year' | 'month';
    year?: number;
    month?: number;
  }>({ type: 'all' });
  const [availableTimeOptions, setAvailableTimeOptions] = useState<
    Array<{
      label: string;
      filter: { type: 'all' | 'year' | 'month'; year?: number; month?: number };
    }>
  >([{ label: '全部时间', filter: { type: 'all' } }]);

  const [_isFirstLoad, setIsFirstLoad] = useState<boolean>(!storeInitialized);
  const unmountTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isLoadingRef = useRef<boolean>(false);
  const beansContainerRef = useRef<HTMLDivElement | null>(null);
  const hiddenExportContainerRef = useRef<HTMLDivElement>(null);

  // 处理初始化参数 - 只在组件首次挂载时执行
  useEffect(() => {
    let hasChanges = false;

    if (initialViewMode && initialViewMode !== viewMode) {
      // 如果传入了初始视图模式且与当前不同，更新视图模式
      setViewMode(initialViewMode);
      hasChanges = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 空依赖数组，只在组件挂载时执行一次

  // 使用自定义钩子处理咖啡豆操作
  const {
    handleSaveBean,
    handleDelete: executeDelete,
    handleSaveRating,
    handleQuickDecrement: baseHandleQuickDecrement,
    handleShare,
  } = useBeanOperations();

  // 包装删除函数，添加确认抽屉
  const handleDelete = useCallback((bean: ExtendedCoffeeBean) => {
    setDeletingBean(bean);
    setShowDeleteConfirm(true);
  }, []);

  const handleQuickDecrement = async (
    beanId: string,
    currentValue: string,
    decrementAmount: number
  ): Promise<{
    success: boolean;
    value?: string;
    reducedToZero?: boolean;
    error?: Error;
  }> => {
    try {
      // 获取豆子信息以检查是否为生豆
      const bean = beans.find(b => b.id === beanId);
      const beanState = bean?.beanState || 'roasted';

      // 如果是生豆，使用烘焙功能
      if (beanState === 'green') {
        const { RoastingManager } = await import(
          '@/lib/managers/roastingManager'
        );
        const result = await RoastingManager.simpleRoast(
          beanId,
          decrementAmount
        );

        if (result.success && result.greenBean) {
          // 触发数据更新
          window.dispatchEvent(
            new CustomEvent('coffeeBeanDataChanged', {
              detail: {
                action: 'update',
                beanId: beanId,
              },
            })
          );

          return {
            success: true,
            value: result.greenBean.remaining,
            reducedToZero: parseFloat(result.greenBean.remaining || '0') === 0,
          };
        } else {
          return {
            success: false,
            error: new Error(result.error || '烘焙失败'),
          };
        }
      }

      // 熟豆使用原来的快捷扣除逻辑
      const result = await baseHandleQuickDecrement(
        beanId,
        currentValue,
        decrementAmount
      );
      return {
        success: result.success,
        value: result.value,
        reducedToZero: result.reducedToZero,
        error: result.error ? new Error(String(result.error)) : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  };

  // 滚动容器元素（供虚拟列表 customScrollParent 使用）
  const [inventoryScrollEl, setInventoryScrollEl] =
    React.useState<HTMLElement | null>(null);
  const [rankingScrollEl, setRankingScrollEl] =
    React.useState<HTMLElement | null>(null);

  // 使用增强的筛选Hook
  const {
    filteredBeans,
    emptyBeans,
    availableVarieties,
    availableOrigins,
    availableProcessingMethods,
    availableFlavorPeriods,
    availableRoasters,
  } = useEnhancedBeanFiltering({
    beans,
    filterMode,
    selectedVariety,
    selectedOrigin,
    selectedProcessingMethod,
    selectedFlavorPeriod,
    selectedRoaster,
    selectedBeanType,
    selectedBeanState,
    showEmptyBeans,
    sortOption,
  });

  // 计算当前状态下的豆子统计
  const { currentStateBeanCount, hasEmptyBeansInCurrentState } = useMemo(() => {
    const currentStateBeans = beans.filter(
      bean => (bean.beanState || 'roasted') === selectedBeanState
    );
    return {
      currentStateBeanCount: currentStateBeans.length,
      hasEmptyBeansInCurrentState: currentStateBeans.some(isBeanEmpty),
    };
  }, [beans, selectedBeanState]);

  // 计算每种类型的咖啡豆数量（用于类型筛选显示）
  // 获取烘焙商相关设置 - 使用单独的选择器避免无限循环
  const roasterFieldEnabled = useSettingsStore(
    state => state.settings.roasterFieldEnabled
  );
  const roasterSeparator = useSettingsStore(
    state => state.settings.roasterSeparator
  );
  const roasterSettings = useMemo<RoasterSettings>(
    () => ({
      roasterFieldEnabled,
      roasterSeparator,
    }),
    [roasterFieldEnabled, roasterSeparator]
  );

  // 计算类型统计 - 用于显示剩余量等信息（基于当前所有筛选条件）
  const {
    espressoCount,
    filterCount,
    omniCount,
    espressoRemaining,
    filterRemaining,
    omniRemaining,
  } = useMemo(() => {
    // 根据当前的筛选条件计算不同类型的豆子数量
    let beansToCount = beans;

    // 先按 beanState 筛选
    beansToCount = beansToCount.filter(bean => {
      const beanState = bean.beanState || 'roasted';
      return beanState === selectedBeanState;
    });

    // 如果不显示空豆子，先过滤掉空豆子
    if (!showEmptyBeans) {
      beansToCount = beansToCount.filter(bean => !isBeanEmpty(bean));
    }

    // 根据当前的分类模式和选择进行筛选
    switch (filterMode) {
      case 'variety':
        if (selectedVariety) {
          beansToCount = beansToCount.filter(bean =>
            beanHasVariety(bean, selectedVariety)
          );
        }
        break;
      case 'origin':
        if (selectedOrigin) {
          beansToCount = beansToCount.filter(bean =>
            beanHasOrigin(bean, selectedOrigin)
          );
        }
        break;
      case 'flavorPeriod':
        if (selectedFlavorPeriod) {
          beansToCount = beansToCount.filter(bean =>
            beanHasFlavorPeriodStatus(bean, selectedFlavorPeriod)
          );
        }
        break;
      case 'roaster':
        if (selectedRoaster) {
          beansToCount = beansToCount.filter(bean =>
            beanHasRoaster(bean, selectedRoaster, roasterSettings)
          );
        }
        break;
    }

    // 统计不同类型的豆子数量和剩余量
    const espressoBeans = beansToCount.filter(
      bean => bean.beanType === 'espresso'
    );
    const filterBeans = beansToCount.filter(bean => bean.beanType === 'filter');
    const omniBeans = beansToCount.filter(bean => bean.beanType === 'omni');

    const espresso = espressoBeans.length;
    const filter = filterBeans.length;
    const omni = omniBeans.length;

    // 计算每种类型的剩余量
    const espressoRemaining = espressoBeans.reduce(
      (sum, bean) => sum + parseFloat(bean.remaining || '0'),
      0
    );
    const filterRemaining = filterBeans.reduce(
      (sum, bean) => sum + parseFloat(bean.remaining || '0'),
      0
    );
    const omniRemaining = omniBeans.reduce(
      (sum, bean) => sum + parseFloat(bean.remaining || '0'),
      0
    );

    return {
      espressoCount: espresso,
      filterCount: filter,
      omniCount: omni,
      espressoRemaining,
      filterRemaining,
      omniRemaining,
    };
  }, [
    beans,
    selectedBeanState,
    showEmptyBeans,
    filterMode,
    selectedVariety,
    selectedOrigin,
    selectedFlavorPeriod,
    selectedRoaster,
    roasterSettings,
  ]);

  // 计算总体类型统计 - 用于判断按钮是否应该禁用（考虑分类栏选择，但不考虑类型本身的选择）
  const { totalEspressoCount, totalFilterCount, totalOmniCount } =
    useMemo(() => {
      let beansToCount = beans;

      // 按 beanState 筛选
      beansToCount = beansToCount.filter(bean => {
        const beanState = bean.beanState || 'roasted';
        return beanState === selectedBeanState;
      });

      // 如果不显示空豆子，先过滤掉空豆子
      if (!showEmptyBeans) {
        beansToCount = beansToCount.filter(bean => !isBeanEmpty(bean));
      }

      // 根据当前的分类模式和选择进行筛选（但不考虑类型筛选）
      switch (filterMode) {
        case 'variety':
          if (selectedVariety) {
            beansToCount = beansToCount.filter(bean =>
              beanHasVariety(bean, selectedVariety)
            );
          }
          break;
        case 'origin':
          if (selectedOrigin) {
            beansToCount = beansToCount.filter(bean =>
              beanHasOrigin(bean, selectedOrigin)
            );
          }
          break;
        case 'flavorPeriod':
          if (selectedFlavorPeriod) {
            beansToCount = beansToCount.filter(bean =>
              beanHasFlavorPeriodStatus(bean, selectedFlavorPeriod)
            );
          }
          break;
        case 'roaster':
          if (selectedRoaster) {
            beansToCount = beansToCount.filter(bean =>
              beanHasRoaster(bean, selectedRoaster, roasterSettings)
            );
          }
          break;
      }

      // 统计不同类型的豆子数量（不考虑类型筛选）
      const totalEspresso = beansToCount.filter(
        bean => bean.beanType === 'espresso'
      ).length;
      const totalFilter = beansToCount.filter(
        bean => bean.beanType === 'filter'
      ).length;
      const totalOmni = beansToCount.filter(
        bean => bean.beanType === 'omni'
      ).length;

      return {
        totalEspressoCount: totalEspresso,
        totalFilterCount: totalFilter,
        totalOmniCount: totalOmni,
      };
    }, [
      beans,
      selectedBeanState,
      showEmptyBeans,
      filterMode,
      selectedVariety,
      selectedOrigin,
      selectedFlavorPeriod,
      selectedRoaster,
      roasterSettings,
    ]);

  const updateFilteredBeansAndCategories = useCallback(
    (_beansToSort: ExtendedCoffeeBean[]) => {
      globalCache.varieties = availableVarieties;
      globalCache.availableOrigins = availableOrigins;
      globalCache.availableFlavorPeriods = availableFlavorPeriods;
      globalCache.availableRoasters = availableRoasters;
      globalCache.filteredBeans = filteredBeans;
    },
    [
      availableVarieties,
      availableOrigins,
      availableFlavorPeriods,
      availableRoasters,
      filteredBeans,
    ]
  );

  // 初始化加载数据
  useEffect(() => {
    if (!storeInitialized) {
      loadBeansFromStore();
    }
  }, [storeInitialized, loadBeansFromStore]);

  // 监听咖啡豆数据变化事件，刷新 Store
  useEffect(() => {
    const handleBeansUpdated = () => {
      loadBeansFromStore();
    };

    window.addEventListener('coffeeBeansUpdated', handleBeansUpdated);
    window.addEventListener('coffeeBeanDataChanged', handleBeansUpdated);
    window.addEventListener('coffeeBeanListChanged', handleBeansUpdated);

    return () => {
      window.removeEventListener('coffeeBeansUpdated', handleBeansUpdated);
      window.removeEventListener('coffeeBeanDataChanged', handleBeansUpdated);
      window.removeEventListener('coffeeBeanListChanged', handleBeansUpdated);
    };
  }, [loadBeansFromStore]);

  // 当 beans 变化时更新 globalCache（仅用于 UI 偏好设置）
  useEffect(() => {
    globalCache.filteredBeans = filteredBeans;
    if (beans.length > 0) {
      setIsFirstLoad(false);
    }
  }, [beans, filteredBeans]);

  const [rankingBeansCount, setRankingBeansCount] = useState<number>(0);
  const [rankingEspressoCount, setRankingEspressoCount] = useState<number>(0);
  const [rankingFilterCount, setRankingFilterCount] = useState<number>(0);
  const [rankingOmniCount, setRankingOmniCount] = useState<number>(0);

  // 显示模式状态（持久化记忆 - 参考笔记模块的实现方式）
  // 支持 list（列表）、imageFlow（图片流）、table（表格）三种模式
  const [displayMode, setDisplayModeState] = useState<DisplayMode>(() => {
    if (typeof window !== 'undefined') {
      // 根据当前 beanState 读取对应的显示模式
      const validState = getValidBeanState();
      const storageKey = `brew-guide:coffee-beans:displayMode_${validState}`;
      const saved = localStorage.getItem(storageKey);
      if (saved === 'list' || saved === 'imageFlow' || saved === 'table') {
        return saved;
      }
    }
    return 'list';
  });

  // 图片流模式（向后兼容，从 displayMode 派生）
  const isImageFlowMode = displayMode === 'imageFlow';

  // 表格可见列配置（持久化）
  const [tableVisibleColumns, setTableVisibleColumnsState] = useState<
    TableColumnKey[]
  >(() => {
    if (typeof window !== 'undefined') {
      const storageKey = 'brew-guide:coffee-beans:tableVisibleColumns';
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed as TableColumnKey[];
          }
        } catch {
          // 忽略解析错误
        }
      }
    }
    // 默认可见列
    return getDefaultVisibleColumns();
  });

  // 更新表格可见列（同时更新 state 和 localStorage）
  const updateTableVisibleColumns = useCallback((columns: TableColumnKey[]) => {
    setTableVisibleColumnsState(columns);
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        'brew-guide:coffee-beans:tableVisibleColumns',
        JSON.stringify(columns)
      );
    }
  }, []);

  // 显示模式更新函数（同时更新 state 和 localStorage）
  const updateDisplayMode = useCallback(
    (mode: DisplayMode) => {
      setDisplayModeState(mode);
      if (typeof window !== 'undefined') {
        // 保存到按状态的存储
        const storageKey = `brew-guide:coffee-beans:displayMode_${selectedBeanState}`;
        localStorage.setItem(storageKey, mode);
        // 同时更新 globalCache 保持一致
        globalCache.displayMode = mode;
        globalCache.displayModes[selectedBeanState] = mode;
      }
    },
    [selectedBeanState]
  );

  // 生豆库启用设置 - 从 settingsStore 获取
  const enableGreenBeanInventory = useSettingsStore(
    state => state.settings.enableGreenBeanInventory === true
  );

  // 预计杯数设置
  const showEstimatedCups = useSettingsStore(
    state => state.settings.showEstimatedCups === true
  );

  // 当生豆库被禁用且当前在生豆库视图时，切换回熟豆库
  useEffect(() => {
    if (!enableGreenBeanInventory && selectedBeanState === 'green') {
      setSelectedBeanState('roasted');
      globalCache.selectedBeanState = 'roasted';
      saveSelectedBeanStatePreference('roasted');
    }
  }, [enableGreenBeanInventory, selectedBeanState]);

  // 计算是否有图片咖啡豆（用于禁用/启用图片流按钮）
  const hasImageBeans = useMemo(() => {
    return beans.some(bean => bean.image && bean.image.trim() !== '');
  }, [beans]);

  // 计算预计杯数（使用逐豆计算算法，更准确地反映实际可冲泡杯数）
  const estimatedCups = useMemo(() => {
    // 只在显示预计杯数设置开启且是熟豆时计算
    if (!showEstimatedCups || selectedBeanState !== 'roasted') {
      return undefined;
    }

    return calculateEstimatedCupsPerBean(filteredBeans);
  }, [showEstimatedCups, selectedBeanState, filteredBeans]);

  // 切换图片流模式（简化版，直接使用 updateDisplayMode）
  const handleToggleImageFlowMode = useCallback(() => {
    updateDisplayMode(isImageFlowMode ? 'list' : 'imageFlow');
  }, [isImageFlowMode, updateDisplayMode]);

  // 显示模式切换处理函数（直接使用 updateDisplayMode）
  const handleDisplayModeChange = useCallback(
    (mode: DisplayMode) => {
      updateDisplayMode(mode);
    },
    [updateDisplayMode]
  );

  // 当没有图片咖啡豆时，自动关闭图片流模式
  // 但只在数据已经加载完成后才执行此检查，避免初始化时误判
  useEffect(() => {
    if (
      storeInitialized &&
      isImageFlowMode &&
      !hasImageBeans &&
      beans.length > 0
    ) {
      updateDisplayMode('list');
    }
  }, [
    storeInitialized,
    isImageFlowMode,
    hasImageBeans,
    beans.length,
    updateDisplayMode,
  ]);

  // 从 Store beans 中筛选已评分的咖啡豆（包含手动评分和自动评分）
  const loadRatedBeans = React.useCallback(() => {
    if (viewMode !== VIEW_OPTIONS.RANKING) return;

    // 筛选有评分的豆子（手动评分或有笔记评分）
    const ratedBeansData = beans.filter(bean =>
      hasBeanRating(bean, notes as BrewingNoteData[])
    );

    let filteredRatedBeans = ratedBeansData;
    if (rankingBeanType !== 'all') {
      filteredRatedBeans = ratedBeansData.filter(
        bean => bean.beanType === rankingBeanType
      );
    }

    setRatedBeans(filteredRatedBeans);
    setRankingBeansCount(filteredRatedBeans.length);

    const espresso = ratedBeansData.filter(
      bean => bean.beanType === 'espresso'
    ).length;
    const filter = ratedBeansData.filter(
      bean => bean.beanType === 'filter'
    ).length;
    const omni = ratedBeansData.filter(bean => bean.beanType === 'omni').length;

    setRankingEspressoCount(espresso);
    setRankingFilterCount(filter);
    setRankingOmniCount(omni);

    if (rankingBeanType !== 'all') {
      if (
        (rankingBeanType === 'espresso' && espresso === 0) ||
        (rankingBeanType === 'filter' && filter === 0) ||
        (rankingBeanType === 'omni' && omni === 0)
      ) {
        setRankingBeanType('all');
        globalCache.rankingBeanType = 'all';
        saveRankingBeanTypePreference('all');
        return;
      }
    }

    globalCache.ratedBeans = filteredRatedBeans;
  }, [viewMode, rankingBeanType, beans, notes]);

  // 组件打开时加载榜单数据
  useEffect(() => {
    if (isOpen) {
      if (unmountTimeoutRef.current) {
        clearTimeout(unmountTimeoutRef.current);
        unmountTimeoutRef.current = null;
      }
      loadRatedBeans();
    }
  }, [isOpen, loadRatedBeans]);

  // 清理 timeout
  useEffect(() => {
    return () => {
      if (unmountTimeoutRef.current) {
        clearTimeout(unmountTimeoutRef.current);
        unmountTimeoutRef.current = null;
      }
    };
  }, []);

  // 在视图切换时更新数据
  useEffect(() => {
    if (viewMode === VIEW_OPTIONS.RANKING) {
      loadRatedBeans();
    } else if (viewMode === VIEW_OPTIONS.INVENTORY) {
      // 在切换到库存视图时，应用当前的排序选项重新排序
      if (beans.length > 0) {
        // 使用完整的 beans 对象，不需要映射
        const sortedBeans = sortBeans(beans, sortOption);
        updateFilteredBeansAndCategories(sortedBeans);
      }
    }
  }, [
    viewMode,
    loadRatedBeans,
    beans,
    sortOption,
    updateFilteredBeansAndCategories,
  ]);

  // 确保在榜单beanType变化时更新计数
  useEffect(() => {
    if (viewMode === VIEW_OPTIONS.RANKING) {
      loadRatedBeans();
    }
  }, [rankingBeanType, viewMode, loadRatedBeans]);

  useEffect(() => {
    if (storeInitialized) {
      globalCache.showEmptyBeans = showEmptyBeans;
      globalCache.selectedVariety = selectedVariety;
      globalCache.selectedBeanType = selectedBeanType;
      globalCache.filterMode = filterMode;
      globalCache.selectedOrigin = selectedOrigin;
      globalCache.selectedFlavorPeriod = selectedFlavorPeriod;
      globalCache.selectedRoaster = selectedRoaster;
    }
  }, [
    storeInitialized,
    showEmptyBeans,
    selectedVariety,
    selectedBeanType,
    filterMode,
    selectedOrigin,
    selectedFlavorPeriod,
    selectedRoaster,
  ]);

  useEffect(() => {
    if (storeInitialized) {
      let newSortOption: SortOption;

      switch (viewMode) {
        case VIEW_OPTIONS.INVENTORY:
          newSortOption = inventorySortOption;
          break;
        case VIEW_OPTIONS.RANKING:
          newSortOption = rankingSortOption;
          break;
        default:
          newSortOption = inventorySortOption;
      }

      setSortOption(newSortOption);
      globalCache.sortOption = newSortOption;
      saveSortOptionPreference(newSortOption);
      globalCache.viewMode = viewMode;
      saveViewModePreference(viewMode);
    }
  }, [viewMode, inventorySortOption, rankingSortOption]);

  // 当排序选项改变时更新数据 - 优化防抖动
  useEffect(() => {
    if (viewMode === VIEW_OPTIONS.INVENTORY && beans.length > 0) {
      // 库存视图：使用完整的 beans 对象进行排序
      const sortedBeans = sortBeans(beans, sortOption);
      updateFilteredBeansAndCategories(sortedBeans);
    }
  }, [sortOption, viewMode, beans, updateFilteredBeansAndCategories]);

  // 处理品种标签点击 - 简化版本，优化的Hook会自动处理筛选
  const handleVarietyClick = useCallback(
    (variety: string | null) => {
      setSelectedVariety(variety);
      // 更新全局缓存并保存到本地存储（同时保存到全局和按状态的存储）
      globalCache.selectedVariety = variety;
      globalCache.selectedVarieties[selectedBeanState] = variety;
      saveSelectedVarietyPreference(variety);
      saveSelectedVarietyByStatePreference(selectedBeanState, variety);
    },
    [selectedBeanState]
  );

  // 处理豆子类型点击 - 简化版本，优化的Hook会自动处理筛选
  const handleBeanTypeChange = useCallback(
    (beanType: BeanType) => {
      // 如果点击已选中的类型，则重置为全部
      const newBeanType = beanType === selectedBeanType ? 'all' : beanType;

      setSelectedBeanType(newBeanType);
      // 更新全局缓存并保存到本地存储（同时保存到全局和按状态的存储）
      globalCache.selectedBeanType = newBeanType;
      globalCache.selectedBeanTypes[selectedBeanState] = newBeanType;
      saveSelectedBeanTypePreference(newBeanType);
      saveSelectedBeanTypeByStatePreference(selectedBeanState, newBeanType);
    },
    [selectedBeanType, selectedBeanState]
  );

  // 处理豆子状态切换（生豆/熟豆）
  const handleBeanStateChange = useCallback(
    (beanState: BeanState) => {
      // 先保存当前 beanState 的所有筛选选项
      const currentBeanState = selectedBeanState;
      globalCache.filterModes[currentBeanState] = filterMode;
      saveFilterModeByStatePreference(currentBeanState, filterMode);
      globalCache.inventorySortOptions[currentBeanState] = inventorySortOption;
      saveInventorySortOptionByStatePreference(
        currentBeanState,
        inventorySortOption
      );
      // 保存当前 beanState 的类型筛选
      globalCache.selectedBeanTypes[currentBeanState] = selectedBeanType;
      saveSelectedBeanTypeByStatePreference(currentBeanState, selectedBeanType);
      // 保存当前 beanState 的显示空豆子设置
      globalCache.showEmptyBeansSettings[currentBeanState] = showEmptyBeans;
      saveShowEmptyBeansByStatePreference(currentBeanState, showEmptyBeans);
      // 保存当前 beanState 的显示模式（使用新的 localStorage key）
      globalCache.displayModes[currentBeanState] = displayMode;
      if (typeof window !== 'undefined') {
        localStorage.setItem(
          `brew-guide:coffee-beans:displayMode_${currentBeanState}`,
          displayMode
        );
      }
      // 保存当前 beanState 的分类筛选值
      globalCache.selectedVarieties[currentBeanState] = selectedVariety;
      saveSelectedVarietyByStatePreference(currentBeanState, selectedVariety);
      globalCache.selectedOrigins[currentBeanState] = selectedOrigin;
      saveSelectedOriginByStatePreference(currentBeanState, selectedOrigin);
      globalCache.selectedProcessingMethods[currentBeanState] =
        selectedProcessingMethod;
      saveSelectedProcessingMethodByStatePreference(
        currentBeanState,
        selectedProcessingMethod
      );
      globalCache.selectedFlavorPeriods[currentBeanState] =
        selectedFlavorPeriod;
      saveSelectedFlavorPeriodByStatePreference(
        currentBeanState,
        selectedFlavorPeriod
      );
      globalCache.selectedRoasters[currentBeanState] = selectedRoaster;
      saveSelectedRoasterByStatePreference(currentBeanState, selectedRoaster);

      // 切换 beanState
      setSelectedBeanState(beanState);
      globalCache.selectedBeanState = beanState;
      saveSelectedBeanStatePreference(beanState);

      // 加载目标 beanState 的 filterMode
      const targetFilterMode =
        globalCache.filterModes[beanState] ||
        getFilterModeByStatePreference(beanState);
      setFilterMode(targetFilterMode);
      globalCache.filterMode = targetFilterMode;
      saveFilterModePreference(targetFilterMode);

      // 加载目标 beanState 的 sortOption
      const targetSortOption =
        globalCache.inventorySortOptions[beanState] ||
        getInventorySortOptionByStatePreference(beanState);
      setInventorySortOption(targetSortOption);
      globalCache.inventorySortOption = targetSortOption;
      saveInventorySortOptionPreference(targetSortOption);

      // 加载目标 beanState 的类型筛选
      const targetBeanType =
        globalCache.selectedBeanTypes[beanState] ||
        getSelectedBeanTypeByStatePreference(beanState);
      setSelectedBeanType(targetBeanType);
      globalCache.selectedBeanType = targetBeanType;
      saveSelectedBeanTypePreference(targetBeanType);

      // 加载目标 beanState 的显示空豆子设置
      const targetShowEmptyBeans =
        globalCache.showEmptyBeansSettings[beanState] ??
        getShowEmptyBeansByStatePreference(beanState);
      setShowEmptyBeans(targetShowEmptyBeans);
      globalCache.showEmptyBeans = targetShowEmptyBeans;
      saveShowEmptyBeansPreference(targetShowEmptyBeans);

      // 加载目标 beanState 的显示模式（使用新的 localStorage key）
      let targetDisplayMode: DisplayMode = 'list';
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(
          `brew-guide:coffee-beans:displayMode_${beanState}`
        );
        if (saved === 'list' || saved === 'imageFlow' || saved === 'table') {
          targetDisplayMode = saved;
        }
      }
      // 也检查 globalCache（可能已经在内存中）
      if (globalCache.displayModes[beanState]) {
        targetDisplayMode = globalCache.displayModes[beanState];
      }
      setDisplayModeState(targetDisplayMode);
      globalCache.displayMode = targetDisplayMode;
      globalCache.displayModes[beanState] = targetDisplayMode;

      // 加载目标 beanState 的分类筛选值
      const targetVariety =
        globalCache.selectedVarieties[beanState] ??
        getSelectedVarietyByStatePreference(beanState);
      setSelectedVariety(targetVariety);
      globalCache.selectedVariety = targetVariety;
      saveSelectedVarietyPreference(targetVariety);

      const targetOrigin =
        globalCache.selectedOrigins[beanState] ??
        getSelectedOriginByStatePreference(beanState);
      setSelectedOrigin(targetOrigin);
      globalCache.selectedOrigin = targetOrigin;
      saveSelectedOriginPreference(targetOrigin);

      const targetProcessingMethod =
        globalCache.selectedProcessingMethods[beanState] ??
        getSelectedProcessingMethodByStatePreference(beanState);
      setSelectedProcessingMethod(targetProcessingMethod);
      globalCache.selectedProcessingMethod = targetProcessingMethod;
      saveSelectedProcessingMethodPreference(targetProcessingMethod);

      const targetFlavorPeriod =
        globalCache.selectedFlavorPeriods[beanState] ??
        getSelectedFlavorPeriodByStatePreference(beanState);
      setSelectedFlavorPeriod(targetFlavorPeriod);
      globalCache.selectedFlavorPeriod = targetFlavorPeriod;
      saveSelectedFlavorPeriodPreference(targetFlavorPeriod);

      const targetRoaster =
        globalCache.selectedRoasters[beanState] ??
        getSelectedRoasterByStatePreference(beanState);
      setSelectedRoaster(targetRoaster);
      globalCache.selectedRoaster = targetRoaster;
      saveSelectedRoasterPreference(targetRoaster);
    },
    [
      filterMode,
      selectedBeanState,
      inventorySortOption,
      selectedBeanType,
      showEmptyBeans,
      displayMode,
      selectedVariety,
      selectedOrigin,
      selectedProcessingMethod,
      selectedFlavorPeriod,
      selectedRoaster,
    ]
  );

  // 处理编辑咖啡豆
  const handleEdit = (bean: ExtendedCoffeeBean) => {
    try {
      if (showBeanForm) {
        showBeanForm(bean);
      } else {
        setEditingBean(bean);
      }
    } catch (_error) {
      alert('编辑咖啡豆时出错，请重试');
    }
  };

  // 处理咖啡豆表单保存
  const handleFormSave = async (
    bean: Omit<ExtendedCoffeeBean, 'id' | 'timestamp'>
  ) => {
    try {
      const result = await handleSaveBean(bean, editingBean);
      if (result.success) {
        setShowAddForm(false);
        setEditingBean(null);
      } else {
        alert('保存失败，请重试');
      }
    } catch (error) {
      console.error('保存咖啡豆失败:', error);
      alert('保存失败，请重试');
    }
  };

  // 用于打开评分表单的处理函数
  const handleShowRatingForm = (
    bean: ExtendedCoffeeBean,
    onRatingSaved?: () => void
  ) => {
    setSelectedBeanForRating(bean);
    setShowRatingModal(true);

    // 如果提供了回调函数，存储它
    if (onRatingSaved) {
      setRatingSavedCallback(() => onRatingSaved);
    }
  };

  // 处理评分保存
  const handleRatingSave = async (
    id: string,
    ratings: Partial<ExtendedCoffeeBean>
  ) => {
    try {
      const result = await handleSaveRating(id, ratings);
      if (result.success) {
        return result.bean;
      }
      return null;
    } catch (error) {
      alert('保存评分失败，请重试');
      throw error;
    }
  };

  // 处理备注展开状态切换
  const handleNotesExpandToggle = useCallback(
    (beanId: string, expanded: boolean) => {
      setExpandedNotes(prev => ({
        ...prev,
        [beanId]: expanded,
      }));
    },
    []
  );

  // 计算可用容量和总重量
  const calculateTotalWeight = (beansList?: ExtendedCoffeeBean[]) => {
    const beansToUse = beansList || filteredBeans;
    const totalWeight = beansToUse
      .filter(bean => bean.remaining && parseFloat(bean.remaining) > 0)
      .reduce((sum, bean) => sum + parseFloat(bean.remaining || '0'), 0);

    if (totalWeight < 1000) {
      return `${Math.round(totalWeight)} g`;
    } else {
      return `${(totalWeight / 1000).toFixed(2)} kg`;
    }
  };

  // 计算原始总重量（包括已用完的豆子）
  const calculateOriginalTotalWeight = (beansList?: ExtendedCoffeeBean[]) => {
    const beansToUse = beansList || beans;
    const totalWeight = beansToUse.reduce((sum, bean) => {
      const capacity = bean.capacity ? parseFloat(bean.capacity) : 0;
      return sum + (isNaN(capacity) ? 0 : capacity);
    }, 0);

    if (totalWeight < 1000) {
      return `${Math.round(totalWeight)} g`;
    } else {
      return `${(totalWeight / 1000).toFixed(2)} kg`;
    }
  };

  // 切换显示空豆子状态 - 简化版本，优化的Hook会自动处理筛选
  const toggleShowEmptyBeans = useCallback(() => {
    const newShowEmptyBeans = !showEmptyBeans;
    setShowEmptyBeans(newShowEmptyBeans);
    // 更新全局缓存并保存到本地存储（同时保存到全局和按状态的存储）
    globalCache.showEmptyBeans = newShowEmptyBeans;
    globalCache.showEmptyBeansSettings[selectedBeanState] = newShowEmptyBeans;
    saveShowEmptyBeansPreference(newShowEmptyBeans);
    saveShowEmptyBeansByStatePreference(selectedBeanState, newShowEmptyBeans);
  }, [showEmptyBeans, selectedBeanState]);

  // 开启显示空豆子状态（用于提示抽屉的"帮我开启"按钮）
  const enableShowEmptyBeans = useCallback(() => {
    if (showEmptyBeans) return; // 已经开启了，不需要再开启
    setShowEmptyBeans(true);
    globalCache.showEmptyBeans = true;
    globalCache.showEmptyBeansSettings[selectedBeanState] = true;
    saveShowEmptyBeansPreference(true);
    saveShowEmptyBeansByStatePreference(selectedBeanState, true);
  }, [showEmptyBeans, selectedBeanState]);

  // 处理咖啡豆用完事件 - 显示提示抽屉
  const handleBeanReducedToZero = useCallback(() => {
    // 只在库存视图、未开启【包含已用完】、且未显示过提示时显示
    if (
      viewMode === VIEW_OPTIONS.INVENTORY &&
      !showEmptyBeans &&
      shouldShowEmptyBeanTip()
    ) {
      setShowEmptyBeanTip(true);
    }
  }, [viewMode, showEmptyBeans]);

  // 处理分类模式变更
  const handleFilterModeChange = useCallback(
    (mode: BeanFilterMode) => {
      setFilterMode(mode);
      // 更新全局缓存并保存到本地存储
      globalCache.filterMode = mode;
      globalCache.filterModes[selectedBeanState] = mode;
      saveFilterModePreference(mode);
      saveFilterModeByStatePreference(selectedBeanState, mode);
      // 清除当前选中的分类项
      setSelectedVariety(null);
      setSelectedOrigin(null);
      setSelectedProcessingMethod(null);
      setSelectedFlavorPeriod(null);
      setSelectedRoaster(null);
      globalCache.selectedVariety = null;
      globalCache.selectedOrigin = null;
      globalCache.selectedProcessingMethod = null;
      globalCache.selectedFlavorPeriod = null;
      globalCache.selectedRoaster = null;
      saveSelectedVarietyPreference(null);
      saveSelectedOriginPreference(null);
      saveSelectedProcessingMethodPreference(null);
      saveSelectedFlavorPeriodPreference(null);
      saveSelectedRoasterPreference(null);
    },
    [selectedBeanState]
  );

  // 处理产地点击
  const handleOriginClick = useCallback(
    (origin: string | null) => {
      setSelectedOrigin(origin);
      // 更新全局缓存并保存到本地存储（同时保存到全局和按状态的存储）
      globalCache.selectedOrigin = origin;
      globalCache.selectedOrigins[selectedBeanState] = origin;
      saveSelectedOriginPreference(origin);
      saveSelectedOriginByStatePreference(selectedBeanState, origin);
    },
    [selectedBeanState]
  );

  // 处理处理法点击
  const handleProcessingMethodClick = useCallback(
    (method: string | null) => {
      setSelectedProcessingMethod(method);
      // 更新全局缓存并保存到本地存储（同时保存到全局和按状态的存储）
      globalCache.selectedProcessingMethod = method;
      globalCache.selectedProcessingMethods[selectedBeanState] = method;
      saveSelectedProcessingMethodPreference(method);
      saveSelectedProcessingMethodByStatePreference(selectedBeanState, method);
    },
    [selectedBeanState]
  );

  // 处理赏味期状态点击
  const handleFlavorPeriodClick = useCallback(
    (status: FlavorPeriodStatus | null) => {
      setSelectedFlavorPeriod(status);
      // 更新全局缓存并保存到本地存储（同时保存到全局和按状态的存储）
      globalCache.selectedFlavorPeriod = status;
      globalCache.selectedFlavorPeriods[selectedBeanState] = status;
      saveSelectedFlavorPeriodPreference(status);
      saveSelectedFlavorPeriodByStatePreference(selectedBeanState, status);
    },
    [selectedBeanState]
  );

  // 处理烘焙商点击
  const handleRoasterClick = useCallback(
    (roaster: string | null) => {
      setSelectedRoaster(roaster);
      // 更新全局缓存并保存到本地存储（同时保存到全局和按状态的存储）
      globalCache.selectedRoaster = roaster;
      globalCache.selectedRoasters[selectedBeanState] = roaster;
      saveSelectedRoasterPreference(roaster);
      saveSelectedRoasterByStatePreference(selectedBeanState, roaster);
    },
    [selectedBeanState]
  );

  useEffect(() => {
    if (storeInitialized && viewMode === VIEW_OPTIONS.RANKING) {
      loadRatedBeans();
    }
  }, [storeInitialized, rankingBeanType, loadRatedBeans, viewMode]);

  // 组件加载后初始化各视图的排序选项
  useEffect(() => {
    if (isOpen && !isLoadingRef.current) {
      // 初始化时根据当前视图设置全局排序选项
      let currentSortOption: SortOption;

      switch (viewMode) {
        case VIEW_OPTIONS.INVENTORY:
          currentSortOption = inventorySortOption;
          break;
        case VIEW_OPTIONS.RANKING:
          currentSortOption = rankingSortOption;
          break;
        default:
          currentSortOption = inventorySortOption;
      }

      // 设置当前排序选项
      setSortOption(currentSortOption);
      globalCache.sortOption = currentSortOption;
    }
  }, [isOpen, viewMode, inventorySortOption, rankingSortOption]);

  // 添加搜索状态
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  // 分享模式状态
  const [isShareMode, setIsShareMode] = useState(false);
  const [selectedBeans, setSelectedBeans] = useState<string[]>([]);
  const [isSavingShareImage, setIsSavingShareImage] = useState(false);

  // 监听分享事件 - 从咖啡豆详情触发的分享
  useEffect(() => {
    const handleBeanShareTriggered = (e: Event) => {
      const customEvent = e as CustomEvent<{ beanId: string }>;
      if (customEvent.detail?.beanId) {
        // 进入分享模式并选中该咖啡豆
        setIsShareMode(true);
        setSelectedBeans([customEvent.detail.beanId]);
      }
    };

    window.addEventListener('beanShareTriggered', handleBeanShareTriggered);

    return () => {
      window.removeEventListener(
        'beanShareTriggered',
        handleBeanShareTriggered
      );
    };
  }, []);

  // 加载搜索历史
  useEffect(() => {
    setSearchHistory(getSearchHistoryPreference());
  }, []);

  // 搜索过滤函数 - 可复用于正常豆子和用完的豆子
  const filterBeansBySearch = React.useCallback(
    (beansToFilter: ExtendedCoffeeBean[]): ExtendedCoffeeBean[] => {
      if (!searchQuery.trim() || !isSearching) {
        return beansToFilter;
      }

      // 将查询拆分为多个关键词，移除空字符串
      const queryTerms = searchQuery
        .toLowerCase()
        .trim()
        .split(/\s+/)
        .filter(term => term.length > 0);

      // 给每个咖啡豆计算匹配分数
      const beansWithScores = beansToFilter.map(bean => {
        // 基本信息搜索
        const name = bean.name?.toLowerCase() || '';
        const roaster = bean.roaster?.toLowerCase() || '';
        // 从 blendComponents 获取产地、庄园和处理法信息（用于向后兼容搜索）
        const origin =
          bean.blendComponents
            ?.map(c => c.origin)
            .filter(Boolean)
            .join(' ')
            .toLowerCase() || '';
        const estate =
          bean.blendComponents
            ?.map(c => c.estate)
            .filter(Boolean)
            .join(' ')
            .toLowerCase() || '';
        const process =
          bean.blendComponents
            ?.map(c => c.process)
            .filter(Boolean)
            .join(' ')
            .toLowerCase() || '';
        const notes = bean.notes?.toLowerCase() || '';

        // 额外信息搜索
        const roastLevel = bean.roastLevel?.toLowerCase() || '';
        const roastDate = bean.roastDate?.toLowerCase() || '';
        const price = bean.price?.toLowerCase() || '';
        const beanType = bean.beanType?.toLowerCase() || '';

        // 风味标签搜索 - 将数组转换为字符串进行搜索
        const flavors = bean.flavor?.join(' ').toLowerCase() || '';

        // 拼配组件搜索 - 包含成分中的品种、庄园信息
        const blendComponentsText =
          bean.blendComponents
            ?.map(
              comp =>
                `${comp.percentage || ''} ${comp.origin || ''} ${comp.estate || ''} ${comp.process || ''} ${comp.variety || ''}`
            )
            .join(' ')
            .toLowerCase() || '';

        // 计量信息搜索
        const capacity = bean.capacity?.toLowerCase() || '';
        const remaining = bean.remaining?.toLowerCase() || '';

        // 赏味期搜索 - 将赏味期信息转换为可搜索的文本
        const flavorPeriod =
          `${bean.startDay || ''} ${bean.endDay || ''}`.toLowerCase();

        // 组合所有可搜索文本到一个数组，为不同字段分配权重
        const searchableTexts = [
          { text: name, weight: 3 }, // 名称权重最高
          { text: roaster, weight: 3 }, // 烘焙商权重最高
          { text: origin, weight: 2 }, // 产地权重较高
          { text: estate, weight: 2 }, // 庄园权重较高
          { text: process, weight: 2 }, // 处理法权重较高
          { text: notes, weight: 1 }, // 备注权重一般
          { text: roastLevel, weight: 1 }, // 烘焙度权重一般
          { text: roastDate, weight: 1 }, // 烘焙日期权重一般
          { text: price, weight: 1 }, // 价格权重一般
          { text: beanType, weight: 2 }, // 豆子类型权重较高
          { text: flavors, weight: 2 }, // 风味标签权重较高
          { text: blendComponentsText, weight: 2 }, // 拼配组件权重较高
          { text: capacity, weight: 1 }, // 容量权重一般
          { text: remaining, weight: 1 }, // 剩余量权重一般
          { text: flavorPeriod, weight: 1 }, // 赏味期信息权重一般
        ];

        // 计算匹配分数 - 所有匹配关键词的权重总和
        let score = 0;
        let allTermsMatch = true;

        for (const term of queryTerms) {
          // 检查当前关键词是否至少匹配一个字段
          const termMatches = searchableTexts.some(({ text }) =>
            text.includes(term)
          );

          if (!termMatches) {
            allTermsMatch = false;
            break;
          }

          // 累加匹配到的权重
          for (const { text, weight } of searchableTexts) {
            if (text.includes(term)) {
              score += weight;

              // 精确匹配整个字段给予额外加分
              if (text === term) {
                score += weight * 2;
              }

              // 匹配字段开头给予额外加分
              if (text.startsWith(term)) {
                score += weight;
              }
            }
          }
        }

        return {
          bean,
          score,
          matches: allTermsMatch,
        };
      });

      // 过滤掉不匹配所有关键词的豆子
      const matchingBeans = beansWithScores.filter(item => item.matches);

      // 根据分数排序，分数高的在前面
      matchingBeans.sort((a, b) => b.score - a.score);

      // 返回排序后的豆子列表
      return matchingBeans.map(item => item.bean);
    },
    [searchQuery, isSearching]
  );

  // 搜索过滤后的正常豆子
  const searchFilteredBeans = React.useMemo(() => {
    return filterBeansBySearch(filteredBeans);
  }, [filteredBeans, filterBeansBySearch]);

  // 搜索过滤后的用完的豆子（当showEmptyBeans为true时）
  const searchFilteredEmptyBeans = React.useMemo(() => {
    if (!showEmptyBeans) return [];
    return filterBeansBySearch(emptyBeans);
  }, [emptyBeans, showEmptyBeans, filterBeansBySearch]);

  // 基于搜索结果的类型统计（搜索时使用搜索过滤后的数据）
  const searchAwareTypeStats = React.useMemo(() => {
    const beansToCount = isSearching ? searchFilteredBeans : filteredBeans;

    const espressoBeans = beansToCount.filter(
      bean => bean.beanType === 'espresso'
    );
    const filterBeans = beansToCount.filter(bean => bean.beanType === 'filter');
    const omniBeans = beansToCount.filter(bean => bean.beanType === 'omni');

    return {
      espressoCount: espressoBeans.length,
      filterCount: filterBeans.length,
      omniCount: omniBeans.length,
      espressoRemaining: espressoBeans.reduce(
        (sum, bean) => sum + parseFloat(bean.remaining || '0'),
        0
      ),
      filterRemaining: filterBeans.reduce(
        (sum, bean) => sum + parseFloat(bean.remaining || '0'),
        0
      ),
      omniRemaining: omniBeans.reduce(
        (sum, bean) => sum + parseFloat(bean.remaining || '0'),
        0
      ),
    };
  }, [isSearching, searchFilteredBeans, filteredBeans]);

  // 基于搜索结果的预计杯数
  const searchAwareEstimatedCups = React.useMemo(() => {
    if (!showEstimatedCups || selectedBeanState !== 'roasted') {
      return undefined;
    }
    const beansToCount = isSearching ? searchFilteredBeans : filteredBeans;
    return calculateEstimatedCupsPerBean(beansToCount);
  }, [
    showEstimatedCups,
    selectedBeanState,
    isSearching,
    searchFilteredBeans,
    filteredBeans,
  ]);

  const [isExportingPreview, setIsExportingPreview] = useState(false);

  // 格式化重量显示
  const formatWeight = (weight: number): string => {
    if (weight < 1000) {
      return `${Math.round(weight)} g`;
    }
    return `${(weight / 1000).toFixed(2)} kg`;
  };

  // 处理预览图导出
  const handleExportPreview = async () => {
    if (isExportingPreview) return;

    setIsExportingPreview(true);

    try {
      // 根据【包含已用完】选择情况和搜索状态，获取正确的豆子列表
      const normalBeans = isSearching ? searchFilteredBeans : filteredBeans;
      const emptyBeansToExport = isSearching
        ? searchFilteredEmptyBeans
        : emptyBeans;
      const beansToExport = showEmptyBeans
        ? [...normalBeans, ...emptyBeansToExport]
        : normalBeans;

      // 计算总重量信息和概要文本（传入正确的豆子列表）
      const totalWeightText = calculateTotalWeight(beansToExport);
      const originalTotalWeightText =
        calculateOriginalTotalWeight(beansToExport);

      // 根据豆子状态决定显示文本
      const beanTypeName = selectedBeanState === 'green' ? '生豆' : '咖啡豆';

      // 获取showBeanSummary设置
      const showBeanSummary =
        useSettingsStore.getState().settings.showBeanSummary ?? false;
      const showEstimatedCupsForExport =
        useSettingsStore.getState().settings.showEstimatedCups ?? false;

      // 生成概要文本，与界面显示保持一致
      const summaryText = (() => {
        if (beansToExport.length === 0) return '';

        let text = '';
        if (showEmptyBeans) {
          text = `${beansToExport.length} 款${beanTypeName}，总共 ${originalTotalWeightText}，剩余 ${totalWeightText}`;
        } else {
          text = `${beansToExport.length} 款${beanTypeName}，剩余 ${totalWeightText}`;
        }

        // 添加预计杯数（仅熟豆）- 使用搜索感知的统计值
        if (
          showEstimatedCupsForExport &&
          selectedBeanState === 'roasted' &&
          searchAwareEstimatedCups !== undefined &&
          searchAwareEstimatedCups > 0
        ) {
          text += `，约 ${searchAwareEstimatedCups} 杯`;
        }

        // 添加详细剩余量信息（仅当选择"全部"类型且有多种类型时显示）- 使用搜索感知的统计值
        const typeCount = [
          searchAwareTypeStats.espressoCount > 0,
          searchAwareTypeStats.filterCount > 0,
          searchAwareTypeStats.omniCount > 0,
        ].filter(Boolean).length;
        if (
          showBeanSummary &&
          selectedBeanState === 'roasted' &&
          selectedBeanType === 'all' &&
          typeCount > 1
        ) {
          const details = [
            searchAwareTypeStats.espressoCount > 0 &&
              `意式 ${formatWeight(searchAwareTypeStats.espressoRemaining)}`,
            searchAwareTypeStats.filterCount > 0 &&
              `手冲 ${formatWeight(searchAwareTypeStats.filterRemaining)}`,
            searchAwareTypeStats.omniCount > 0 &&
              `全能 ${formatWeight(searchAwareTypeStats.omniRemaining)}`,
          ].filter(Boolean);
          if (details.length > 0) {
            text += `（${details.join('，')}）`;
          }
        }

        return text;
      })();

      const result = await exportListPreview(
        normalBeans,
        expandedNotes,
        settings, // 传递用户的真实设置
        summaryText,
        {
          emptyBeans: showEmptyBeans ? emptyBeansToExport : undefined, // 传递已用完的豆子列表用于分割线
        }
      );

      showToast({
        type: 'success',
        title: result.message,
      });
    } catch (error) {
      console.error('导出预览图失败:', error);
      showToast({
        type: 'error',
        title: '生成预览图失败',
      });
    } finally {
      setIsExportingPreview(false);
    }
  };

  // 处理排序选项变更
  const handleSortChange = (option: SortOption) => {
    setSortOption(option);

    // 同时更新视图特定的排序选项
    switch (viewMode) {
      case VIEW_OPTIONS.INVENTORY:
        setInventorySortOption(option);
        globalCache.inventorySortOption = option;
        globalCache.inventorySortOptions[selectedBeanState] = option;
        saveInventorySortOptionPreference(option);
        saveInventorySortOptionByStatePreference(selectedBeanState, option);
        break;
      case VIEW_OPTIONS.RANKING:
        setRankingSortOption(option);
        globalCache.rankingSortOption = option;
        saveRankingSortOptionPreference(option);
        break;
    }

    globalCache.sortOption = option;
    saveSortOptionPreference(option);
  };

  // 处理搜索历史点击
  const handleSearchHistoryClick = (query: string) => {
    setSearchQuery(query);
    // 执行搜索 - 不需要添加到历史因为已经在历史中
  };

  // 分享模式相关处理函数
  const handleToggleSelect = (beanId: string) => {
    setSelectedBeans(prev => {
      if (prev.includes(beanId)) {
        return prev.filter(id => id !== beanId);
      } else {
        return [...prev, beanId];
      }
    });
  };

  const handleCancelShare = () => {
    setIsShareMode(false);
    setSelectedBeans([]);
  };

  const handleSaveBeansAsImage = async () => {
    if (selectedBeans.length === 0 || isSavingShareImage) return;

    setIsSavingShareImage(true);

    try {
      const { exportSelectedBeans } = await import(
        '@/components/coffee-bean/Share/BeansExporter'
      );
      await exportSelectedBeans({
        selectedBeans,
        beansData: beans,
        beansContainerRef: hiddenExportContainerRef,
        onSuccess: message => {
          showToast({ type: 'success', title: message, duration: 2000 });
        },
        onError: message => {
          showToast({ type: 'error', title: message, duration: 3000 });
        },
        onComplete: () => {
          setIsSavingShareImage(false);
          handleCancelShare();
        },
      });
    } catch (error) {
      console.error('导出咖啡豆失败:', error);
      showToast({ type: 'error', title: '导出咖啡豆失败', duration: 3000 });
      setIsSavingShareImage(false);
    }
  };

  const handleShareText = async () => {
    if (selectedBeans.length === 0) return;

    try {
      // 获取选中的咖啡豆
      const beansToShare = beans.filter(bean =>
        selectedBeans.includes(bean.id)
      );

      // 生成文本（同步操作，避免打破用户手势调用链）
      const isSingleBean = beansToShare.length === 1;

      const texts = beansToShare.map(bean => {
        const shareableBean = {
          name: bean.name,
          roaster: bean.roaster,
          capacity: bean.capacity,
          roastLevel: bean.roastLevel,
          roastDate: bean.roastDate,
          flavor: bean.flavor,
          blendComponents: bean.blendComponents,
          price: bean.price,
          beanType: bean.beanType,
          notes: bean.notes,
          startDay: bean.startDay,
          endDay: bean.endDay,
        };
        // 单个豆子包含元数据标记，多个豆子不包含（最后统一添加）
        return beanToReadableText(
          shareableBean as Parameters<typeof beanToReadableText>[0],
          { includeMetadata: isSingleBean }
        );
      });

      // 多个咖啡豆时：用分隔线连接，并在最后添加一次元数据标记
      let fullText: string;
      if (isSingleBean) {
        fullText = texts[0];
      } else {
        fullText = texts.join('\n---\n') + '\n---\n@DATA_TYPE:COFFEE_BEAN@\n';
      }

      // 等待复制完成，只有成功才退出分享模式
      const success = await copyText(fullText);
      if (success) {
        handleCancelShare();
      }
    } catch (error) {
      console.error('分享文本失败:', error);
      showToast({ type: 'error', title: '分享文本失败', duration: 3000 });
    }
  };

  // 当搜索查询改变且不为空时，添加到历史记录
  useEffect(() => {
    if (searchQuery.trim() && isSearching) {
      const timeoutId = setTimeout(() => {
        addSearchHistory(searchQuery.trim());
        setSearchHistory(getSearchHistoryPreference());
      }, 1000); // 延迟1秒添加，避免频繁添加

      return () => clearTimeout(timeoutId);
    }
  }, [searchQuery, isSearching]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* 咖啡豆表单弹出框 */}
      <CoffeeBeanFormModal
        showForm={showAddForm || editingBean !== null}
        initialBean={editingBean || undefined}
        onSave={handleFormSave}
        onClose={() => {
          setShowAddForm(false);
          setEditingBean(null);
        }}
        initialBeanState={selectedBeanState}
      />

      {/* 咖啡豆评分表单 */}
      <CoffeeBeanRatingModal
        showModal={showRatingModal}
        coffeeBean={selectedBeanForRating}
        onClose={() => setShowRatingModal(false)}
        onSave={handleRatingSave}
        onAfterSave={() => {
          // 强制刷新榜单数据
          loadRatedBeans();
          // 关闭评分模态框
          setShowRatingModal(false);
          // 关闭咖啡豆详情页（如果打开的话）
          window.dispatchEvent(new CustomEvent('beanDetailClosing'));
          // 调用存储的回调函数
          if (ratingSavedCallback) {
            ratingSavedCallback();
            setRatingSavedCallback(null);
          }
        }}
      />

      {/* ViewSwitcher - 固定在顶部 */}
      <ViewSwitcher
        viewMode={viewMode}
        sortOption={sortOption}
        onSortChange={handleSortChange}
        beansCount={
          isSearching ? searchFilteredBeans.length : filteredBeans.length
        }
        totalBeans={beans.length}
        totalWeight={calculateTotalWeight(
          isSearching ? searchFilteredBeans : filteredBeans
        )}
        rankingBeanType={rankingBeanType}
        onRankingBeanTypeChange={newType => {
          setRankingBeanType(newType);
          // 保存到本地存储
          globalCache.rankingBeanType = newType;
          saveRankingBeanTypePreference(newType);
        }}
        selectedBeanType={selectedBeanType}
        onBeanTypeChange={handleBeanTypeChange}
        selectedBeanState={selectedBeanState}
        onBeanStateChange={handleBeanStateChange}
        selectedVariety={selectedVariety}
        onVarietyClick={handleVarietyClick}
        showEmptyBeans={showEmptyBeans}
        onToggleShowEmptyBeans={toggleShowEmptyBeans}
        availableVarieties={availableVarieties}
        isSearching={isSearching}
        setIsSearching={setIsSearching}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        rankingBeansCount={rankingBeansCount}
        // 榜单各类型豆子数量
        rankingEspressoCount={rankingEspressoCount}
        rankingFilterCount={rankingFilterCount}
        rankingOmniCount={rankingOmniCount}
        isImageFlowMode={isImageFlowMode}
        onToggleImageFlowMode={handleToggleImageFlowMode}
        hasImageBeans={hasImageBeans}
        // 新增显示模式属性
        displayMode={displayMode}
        onDisplayModeChange={handleDisplayModeChange}
        // 表格列配置属性
        tableVisibleColumns={tableVisibleColumns}
        onTableColumnsChange={updateTableVisibleColumns}
        // 新增分类相关属性
        filterMode={filterMode}
        onFilterModeChange={handleFilterModeChange}
        selectedOrigin={selectedOrigin}
        onOriginClick={handleOriginClick}
        selectedProcessingMethod={selectedProcessingMethod}
        onProcessingMethodClick={handleProcessingMethodClick}
        selectedFlavorPeriod={selectedFlavorPeriod}
        onFlavorPeriodClick={handleFlavorPeriodClick}
        selectedRoaster={selectedRoaster}
        onRoasterClick={handleRoasterClick}
        availableOrigins={availableOrigins}
        availableProcessingMethods={availableProcessingMethods}
        availableFlavorPeriods={availableFlavorPeriods}
        availableRoasters={availableRoasters}
        originalTotalWeight={calculateOriginalTotalWeight(
          isSearching ? searchFilteredBeans : filteredBeans
        )}
        // 新增导出相关属性
        onExportPreview={handleExportPreview}
        // 新增类型统计属性（基于搜索结果）
        espressoCount={searchAwareTypeStats.espressoCount}
        filterCount={searchAwareTypeStats.filterCount}
        omniCount={searchAwareTypeStats.omniCount}
        // 新增类型剩余量属性（基于搜索结果）
        espressoRemaining={searchAwareTypeStats.espressoRemaining}
        filterRemaining={searchAwareTypeStats.filterRemaining}
        omniRemaining={searchAwareTypeStats.omniRemaining}
        // 总体类型统计（用于判断按钮禁用状态）
        totalEspressoCount={totalEspressoCount}
        totalFilterCount={totalFilterCount}
        totalOmniCount={totalOmniCount}
        // 新增搜索历史属性
        searchHistory={searchHistory}
        onSearchHistoryClick={handleSearchHistoryClick}
        // 生豆库启用设置
        enableGreenBeanInventory={enableGreenBeanInventory}
        // 预计杯数（基于搜索结果）
        estimatedCups={searchAwareEstimatedCups}
        // 是否有生豆（用于动态调整列标签）
        hasGreenBeans={(isSearching ? searchFilteredBeans : filteredBeans).some(
          bean => bean.beanState === 'green'
        )}
      />

      {/* 内容区域 - 可滚动 */}
      <div className="flex-1 overflow-hidden">
        {/* 根据视图模式显示不同内容 */}
        {viewMode === VIEW_OPTIONS.INVENTORY && (
          <div
            className="h-full w-full overflow-y-auto"
            ref={el => {
              setInventoryScrollEl(el);
              beansContainerRef.current = el;
            }}
          >
            <InventoryView
              filteredBeans={isSearching ? searchFilteredBeans : filteredBeans}
              emptyBeans={isSearching ? searchFilteredEmptyBeans : emptyBeans}
              selectedVariety={selectedVariety}
              showEmptyBeans={showEmptyBeans}
              selectedBeanType={selectedBeanType}
              selectedBeanState={selectedBeanState}
              hasEmptyBeansInCurrentState={hasEmptyBeansInCurrentState}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onShare={bean => handleShare(bean, copyText)}
              onRate={bean => handleShowRatingForm(bean)}
              onQuickDecrement={handleQuickDecrement}
              onBeanReducedToZero={handleBeanReducedToZero}
              isSearching={isSearching}
              searchQuery={searchQuery}
              isImageFlowMode={isImageFlowMode}
              displayMode={displayMode}
              tableVisibleColumns={tableVisibleColumns}
              settings={settings}
              scrollParentRef={inventoryScrollEl ?? undefined}
              expandedNotes={expandedNotes}
              onNotesExpandToggle={handleNotesExpandToggle}
              isShareMode={isShareMode}
              selectedBeans={selectedBeans}
              onToggleSelect={handleToggleSelect}
            />
          </div>
        )}
        {/* 添加统计视图 */}
        {viewMode === VIEW_OPTIONS.STATS && (
          <div className="scroll-with-bottom-bar h-full w-full overflow-y-auto">
            <StatsView
              beans={beans}
              showEmptyBeans={showEmptyBeans}
              enableGreenBeanInventory={enableGreenBeanInventory}
            />
          </div>
        )}
        {/* 添加榜单视图 */}
        {viewMode === VIEW_OPTIONS.RANKING && (
          <div
            className="scroll-with-bottom-bar h-full w-full overflow-y-auto"
            ref={el => setRankingScrollEl(el)}
          >
            <CoffeeBeanRanking
              isOpen={viewMode === VIEW_OPTIONS.RANKING}
              onShowRatingForm={handleShowRatingForm}
              sortOption={convertToRankingSortOption(sortOption, viewMode)}
              hideFilters={true}
              beanType={rankingBeanType}
              isSearching={isSearching}
              searchQuery={searchQuery}
              scrollParentRef={rankingScrollEl ?? undefined}
            />
          </div>
        )}
      </div>

      {/* 添加和导入按钮 - 仅在库存视图且非分享模式下显示 */}
      {viewMode === VIEW_OPTIONS.INVENTORY && !isShareMode && (
        <BottomActionBar
          buttons={[
            {
              icon: '+',
              text: '手动添加',
              onClick: () => {
                // 沉浸式添加模式：触发事件打开详情页添加模式
                if (settings?.immersiveAdd) {
                  window.dispatchEvent(
                    new CustomEvent('immersiveAddOpened', {
                      detail: { beanState: selectedBeanState },
                    })
                  );
                } else if (showBeanForm) {
                  showBeanForm(null, selectedBeanState);
                } else {
                  setShowAddForm(true);
                }
              },
            },
            {
              icon: '↓',
              text: '快速添加',
              onClick: () => {
                if (onShowImport) onShowImport(selectedBeanState);
              },
            },
          ]}
        />
      )}

      {/* 分享模式下的底部操作栏 */}
      {viewMode === VIEW_OPTIONS.INVENTORY && isShareMode && (
        <BottomActionBar
          buttons={[
            {
              text: '取消',
              onClick: handleCancelShare,
            },
            {
              text: isSavingShareImage
                ? '生成中...'
                : `保存为图片 (${selectedBeans.length})`,
              onClick: handleSaveBeansAsImage,
              className:
                selectedBeans.length === 0 || isSavingShareImage
                  ? 'cursor-not-allowed opacity-50'
                  : '',
            },
            {
              text: '分享文本',
              onClick: handleShareText,
              className:
                selectedBeans.length === 0
                  ? 'cursor-not-allowed opacity-50'
                  : '',
            },
          ]}
        />
      )}

      {/* 复制失败抽屉 */}
      <CopyFailureDrawer {...failureDrawerProps} />

      {/* 隐藏的导出容器 - 用于生成图片 */}
      <div
        ref={hiddenExportContainerRef}
        style={{
          position: 'absolute',
          left: '-9999px',
          top: 0,
          width: '375px',
        }}
      >
        {isShareMode &&
          selectedBeans.length > 0 &&
          beans
            .filter(bean => selectedBeans.includes(bean.id))
            .map((bean, index) => (
              <BeanListItem
                key={bean.id}
                bean={bean}
                isLast={index === selectedBeans.length - 1}
                onRemainingClick={() => {}}
                settings={{
                  ...settings,
                  isExportMode: true,
                }}
                isShareMode={false}
              />
            ))}
      </div>

      {/* 删除确认抽屉 */}
      <DeleteConfirmDrawer
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => {
          if (deletingBean) {
            executeDelete(deletingBean);
          }
        }}
        itemName={deletingBean?.name || ''}
        itemType="咖啡豆"
        onExitComplete={() => setDeletingBean(null)}
      />

      {/* 用完咖啡豆提示抽屉 */}
      <EmptyBeanTipDrawer
        isOpen={showEmptyBeanTip}
        onClose={() => setShowEmptyBeanTip(false)}
        onEnableShowEmptyBeans={enableShowEmptyBeans}
      />
    </div>
  );
};

export default CoffeeBeans;
