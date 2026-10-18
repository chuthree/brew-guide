'use client';

/*
 * 笔记列表组件 - 存储架构说明
 *
 * 数据存储分层：
 * 1. 笔记数据 (brewingNotes): 存储在 IndexedDB 中 (通过 Storage API)
 * 2. UI 偏好设置: 存储在 localStorage 中 (视图模式、图片流设置等)
 * 3. 筛选偏好: 存储在 localStorage 中 (通过 globalCache.ts)
 *
 * 事件监听：
 * - storage: localStorage 变化 (仅 UI 偏好设置)
 * - customStorageChange: IndexedDB 变化 (笔记数据)
 * - storage:changed: 存储系统统一事件 (笔记数据)
 * - coffeeBeansUpdated: 咖啡豆数据变化
 * - brewingNotesUpdated: 笔记数据变化
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { BrewingNote } from '@/lib/core/config';
import { BrewingHistoryProps } from '../types';

import FilterTabs from './FilterTabs';
import AddNoteButton from './AddNoteButton';
import BottomActionBar from '@/components/layout/BottomActionBar';
import { showToast } from '@/components/common/feedback/LightToast';

import {
  globalCache,
  saveSelectedEquipmentPreference,
  saveSelectedDatePreference,
  saveFilterModePreference,
  saveSortOptionPreference,
  saveDateGroupingModePreference,
  calculateTotalCoffeeConsumption,
  formatConsumption,
  getSelectedEquipmentPreference,
  getSelectedDatePreference,
  getFilterModePreference,
  getSortOptionPreference,
  getDateGroupingModePreference,
  getSearchHistoryPreference,
  addSearchHistory,
} from './globalCache';
import ListView from './ListView';
import {
  getNotesViewPreference,
  saveNotesViewPreference,
  type NotesViewPreference,
} from './viewPreference';
import { SortOption, DateGroupingMode, type NotesViewMode } from '../types';
import { exportSelectedNotes } from '../Share/NotesExporter';
import {
  buildNoteSearchableTexts,
  filterSearchableNotes,
  getNoteDeleteDisplay,
  sortNotes,
} from '../utils';
import { resolveSelectedDateTimestamp } from '@/lib/utils/dateUtils';
import { useBrewingNoteStore } from '@/lib/stores/brewingNoteStore';
import { useCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore';
import { useCustomEquipmentStore } from '@/lib/stores/customEquipmentStore';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import {
  isSameEquipment,
  getEquipmentIdByName,
} from '@/lib/utils/equipmentUtils';
import ArtisticShareDrawer from '../Share/ArtisticShareDrawer';
import DeleteConfirmDrawer from '@/components/common/ui/DeleteConfirmDrawer';
import {
  buildCoffeeBeanLookup,
  buildEquipmentNameMap,
  EMPTY_EQUIPMENT_NAME_OVERRIDES,
} from '@/lib/notes/noteDisplay';
import { useNavigationSwipe } from '@/lib/navigation/navigationSwipe';
import {
  getDefaultVisibleNotesTableColumns,
  getNotesTableColumnConfig,
  type NotesTableColumnKey,
} from './tableColumns';
import { useBrewingNoteImageCountsState } from '@/lib/hooks/useBrewingNoteImages';
import { revertCapacityAdjustmentRecord } from '@/lib/coffee-beans/capacityAdjustment';
import { createBrewingNoteCopyData } from './brewingNoteCopy';
import { filterNotesByBeanState } from './noteListModel';
import { getValidBeanState } from '@/components/coffee-bean/List/preferences';
import {
  COFFEE_BEAN_NAVIGATION_EVENTS,
  type CoffeeBeanInventoryState,
} from '@/lib/navigation/coffeeBeanNavigation';

const NOTES_TABLE_COLUMNS_STORAGE_KEY = 'notes-table-visible-columns';

const BrewingHistory: React.FC<BrewingHistoryProps> = ({
  isOpen,
  onClose: _onClose,
  onAddNote,
  onCopyRoastingRecord,
  setAlternativeHeaderContent: _setAlternativeHeaderContent, // 不再使用，保留以兼容接口
  setShowAlternativeHeader: _setShowAlternativeHeader, // 不再使用，保留以兼容接口
  settings,
  navigationToggleControl,
  navigationSwipeControl,
}) => {
  const tableColumnOptions = getNotesTableColumnConfig();

  // 用于跟踪用户选择 - 从本地存储初始化
  const [sortOption, setSortOption] = useState<SortOption>(() =>
    getSortOptionPreference()
  );
  const [filterMode, setFilterMode] = useState<'equipment' | 'date'>(() =>
    getFilterModePreference()
  );
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(
    () => getSelectedEquipmentPreference()
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(() =>
    getSelectedDatePreference()
  );
  const [dateGroupingMode, setDateGroupingMode] = useState<DateGroupingMode>(
    () => getDateGroupingModePreference()
  );

  // 模态显示状态（已移除 ChangeRecordEditModal 相关状态和变量）

  // 图文分享状态
  const [showArtisticShareDrawer, setShowArtisticShareDrawer] = useState(false);
  const [artisticShareNote, setArtisticShareNote] =
    useState<BrewingNote | null>(null);

  // 分享模式状态
  const [isShareMode, setIsShareMode] = useState(false);
  const [selectedNotes, setSelectedNotes] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // 搜索相关状态
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchAllScope, setIsSearchAllScope] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  // 删除确认抽屉状态
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmData, setDeleteConfirmData] = useState<{
    noteId: string;
    noteName: string;
    noteSuffix?: string;
  } | null>(null);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);

  // 加载搜索历史
  useEffect(() => {
    setSearchHistory(getSearchHistoryPreference());
  }, []);

  // 监听分享事件 - 从笔记详情触发的分享
  useEffect(() => {
    const handleNoteShareTriggered = (e: Event) => {
      const customEvent = e as CustomEvent<{ noteId: string }>;
      if (customEvent.detail?.noteId) {
        // 进入分享模式并选中该笔记
        setIsShareMode(true);
        setSelectedNotes([customEvent.detail.noteId]);
      }
    };

    window.addEventListener('noteShareTriggered', handleNoteShareTriggered);

    return () => {
      window.removeEventListener(
        'noteShareTriggered',
        handleNoteShareTriggered
      );
    };
  }, []);

  useEffect(() => {
    const handleNoteDetailOpened = (event: Event) => {
      const customEvent = event as CustomEvent<{ note?: BrewingNote }>;
      setActiveNoteId(customEvent.detail?.note?.id ?? null);
    };

    const handleNoteDetailClosing = () => {
      setActiveNoteId(null);
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

  const [viewPreference, setViewPreference] = useState(getNotesViewPreference);
  const { viewMode, imageFlowType } = viewPreference;
  const isImageFlowMode = viewMode === 'gallery' && imageFlowType === 'normal';
  const isDateImageFlowMode = viewMode === 'gallery' && imageFlowType === 'date';

  const updateViewPreference = useCallback((preference: NotesViewPreference) => {
    setViewPreference(preference);
    saveNotesViewPreference(preference);
  }, []);

  const [tableVisibleColumns, setTableVisibleColumns] = useState<
    NotesTableColumnKey[]
  >(() => {
    const defaultColumns = getDefaultVisibleNotesTableColumns();

    if (typeof window === 'undefined') {
      return defaultColumns;
    }

    try {
      const saved = localStorage.getItem(NOTES_TABLE_COLUMNS_STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : null;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      return defaultColumns;
    }

    return defaultColumns;
  });

  const updateTableVisibleColumns = (columns: NotesTableColumnKey[]) => {
    if (columns.length === 0) return;

    setTableVisibleColumns(columns);
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        NOTES_TABLE_COLUMNS_STORAGE_KEY,
        JSON.stringify(columns)
      );
    }
  };

  const availableTableColumnKeys = new Set(
    tableColumnOptions.map(column => column.key)
  );
  const normalizedTableVisibleColumns = tableVisibleColumns.filter(column =>
    availableTableColumnKeys.has(column)
  );
  const effectiveTableVisibleColumns =
    normalizedTableVisibleColumns.length > 0
      ? normalizedTableVisibleColumns
      : getDefaultVisibleNotesTableColumns();

  // 🔥 从 Zustand Store 订阅笔记数据
  const notes = useBrewingNoteStore(state => state.notes);
  const noteIds = useMemo(() => notes.map(note => note.id), [notes]);
  const noteImageVersionKey = useMemo(
    () =>
      notes.map(note => `${note.id}:${note.updatedAt ?? ''}`).join('\u0001'),
    [notes]
  );
  const { imageCounts: noteImageCounts, isLoaded: areNoteImageCountsLoaded } =
    useBrewingNoteImageCountsState(noteIds, noteImageVersionKey);
  const noteHasImage = useCallback(
    (note: BrewingNote) =>
      Boolean(
        noteImageCounts.has(note.id) ||
        (note.image && note.image.trim() !== '') ||
        (note.images && note.images.length > 0)
      ),
    [noteImageCounts]
  );
  const loadNotes = useBrewingNoteStore(state => state.loadNotes);
  const deleteNote = useBrewingNoteStore(state => state.deleteNote);

  // 🔥 从 Zustand Store 订阅咖啡豆数据
  const coffeeBeans = useCoffeeBeanStore(state => state.beans);
  const [beanInventoryState, setBeanInventoryState] =
    useState<CoffeeBeanInventoryState>(() => getValidBeanState());
  const customEquipments = useCustomEquipmentStore(state => state.equipments);
  const customEquipmentInitialized = useCustomEquipmentStore(
    state => state.initialized
  );
  const loadEquipments = useCustomEquipmentStore(state => state.loadEquipments);
  const equipmentNameOverrides = useSettingsStore(
    state =>
      state.settings.equipmentNameOverrides || EMPTY_EQUIPMENT_NAME_OVERRIDES
  );

  useEffect(() => {
    const handleInventoryStateChanged = (
      event: CustomEvent<{ beanState: CoffeeBeanInventoryState }>
    ) => {
      setBeanInventoryState(event.detail.beanState);
    };

    window.addEventListener(
      COFFEE_BEAN_NAVIGATION_EVENTS.INVENTORY_STATE_CHANGED,
      handleInventoryStateChanged as EventListener
    );

    return () => {
      window.removeEventListener(
        COFFEE_BEAN_NAVIGATION_EVENTS.INVENTORY_STATE_CHANGED,
        handleInventoryStateChanged as EventListener
      );
    };
  }, []);

  const equipmentNames = useMemo(
    () => buildEquipmentNameMap(customEquipments, equipmentNameOverrides),
    [customEquipments, equipmentNameOverrides]
  );
  const coffeeBeanLookup = useMemo(
    () => buildCoffeeBeanLookup(coffeeBeans),
    [coffeeBeans]
  );

  // 预览容器引用
  const notesContainerRef = useRef<HTMLDivElement>(null);
  const [notesScrollEl, setNotesScrollEl] = useState<HTMLDivElement | null>(
    null
  );
  const setNotesContainerRef = useCallback((el: HTMLDivElement | null) => {
    notesContainerRef.current = el;
    setNotesScrollEl(el);
  }, []);

  const sortedNotes = useMemo(() => {
    if (!notes || notes.length === 0) return [];

    return filterNotesByBeanState(
      sortNotes(notes, sortOption),
      beanInventoryState,
      coffeeBeans
    );
  }, [notes, sortOption, beanInventoryState, coffeeBeans]);

  //  简化：直接用 useMemo 筛选和排序，不需要复杂的 hook
  const filteredNotes = useMemo(() => {
    if (sortedNotes.length === 0) return [];

    if (filterMode === 'equipment' && selectedEquipment) {
      return sortedNotes.filter((note: BrewingNote) => {
        return isSameEquipment(
          note.equipment,
          selectedEquipment,
          customEquipments
        );
      });
    } else if (filterMode === 'date' && selectedDate) {
      return sortedNotes.filter((note: BrewingNote) => {
        if (!note.timestamp) return false;
        const date = new Date(note.timestamp);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        let noteDate = '';
        if (dateGroupingMode === 'year') noteDate = `${year}`;
        else if (dateGroupingMode === 'month') noteDate = `${year}-${month}`;
        else noteDate = `${year}-${month}-${day}`;

        // 处理相对日期
        if (selectedDate === 'today') {
          const now = new Date();
          const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          return noteDate === todayStr;
        }
        if (selectedDate === 'yesterday') {
          const now = new Date();
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
          return noteDate === yesterdayStr;
        }
        if (selectedDate === 'dayBeforeYesterday') {
          const now = new Date();
          const dayBeforeYesterday = new Date(now);
          dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);
          const dayBeforeYesterdayStr = `${dayBeforeYesterday.getFullYear()}-${String(dayBeforeYesterday.getMonth() + 1).padStart(2, '0')}-${String(dayBeforeYesterday.getDate()).padStart(2, '0')}`;
          return noteDate === dayBeforeYesterdayStr;
        }

        return noteDate === selectedDate;
      });
    }

    return sortedNotes;
  }, [
    sortedNotes,
    filterMode,
    selectedEquipment,
    selectedDate,
    dateGroupingMode,
    customEquipments,
  ]);

  // � 计算可用的设备、日期列表
  const availableEquipments = useMemo(() => {
    const equipmentSet = new Set<string>();
    notes.forEach((note: BrewingNote) => {
      if (note.equipment) {
        const normalizedId = getEquipmentIdByName(
          note.equipment,
          customEquipments
        );
        equipmentSet.add(normalizedId);
      }
    });
    return Array.from(equipmentSet).sort();
  }, [notes, customEquipments]);

  const availableDates = useMemo(() => {
    const dateSet = new Set<string>();
    notes.forEach((note: BrewingNote) => {
      if (note.timestamp) {
        const date = new Date(note.timestamp);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        let dateStr = '';
        if (dateGroupingMode === 'year') dateStr = `${year}`;
        else if (dateGroupingMode === 'month') dateStr = `${year}-${month}`;
        else dateStr = `${year}-${month}-${day}`;

        dateSet.add(dateStr);
      }
    });
    return Array.from(dateSet).sort((a, b) => b.localeCompare(a));
  }, [notes, dateGroupingMode]);

  const totalCount = filteredNotes.length;
  const totalConsumption = useMemo(() => {
    return calculateTotalCoffeeConsumption(filteredNotes);
  }, [filteredNotes]);

  const searchableFilteredNotes = useMemo(
    () =>
      filteredNotes.map(note => ({
        note,
        searchableTexts: buildNoteSearchableTexts(note, coffeeBeanLookup),
      })),
    [filteredNotes, coffeeBeanLookup]
  );

  const currentScopeSearchFilteredNotes = useMemo(() => {
    if (!isSearching || !searchQuery.trim()) return filteredNotes;
    return filterSearchableNotes(searchableFilteredNotes, searchQuery);
  }, [isSearching, searchQuery, filteredNotes, searchableFilteredNotes]);

  const searchableAllScopeNotes = useMemo(
    () =>
      sortedNotes.map(note => ({
        note,
        searchableTexts: buildNoteSearchableTexts(note, coffeeBeanLookup),
      })),
    [sortedNotes, coffeeBeanLookup]
  );

  const searchAllFilteredNotes = useMemo(() => {
    if (!isSearchAllScope) return sortedNotes;
    if (!isSearching || !searchQuery.trim()) return sortedNotes;
    return filterSearchableNotes(searchableAllScopeNotes, searchQuery);
  }, [
    isSearchAllScope,
    isSearching,
    searchQuery,
    searchableAllScopeNotes,
    sortedNotes,
  ]);

  const activeSearchScopeLabel = useMemo(() => {
    if (filterMode === 'equipment' && selectedEquipment) {
      return equipmentNames[selectedEquipment] || selectedEquipment;
    }

    if (filterMode !== 'date' || !selectedDate) {
      return '';
    }

    if (selectedDate === 'today') return '今天';
    if (selectedDate === 'yesterday') return '昨天';
    if (selectedDate === 'dayBeforeYesterday') return '前天';
    if (dateGroupingMode === 'year') return `${selectedDate}年`;
    if (dateGroupingMode === 'month') {
      const [year, month] = selectedDate.split('-');
      return `${year}年${Number(month)}月`;
    }

    return selectedDate;
  }, [
    dateGroupingMode,
    equipmentNames,
    filterMode,
    selectedDate,
    selectedEquipment,
  ]);

  const searchAllScopeLabel = useMemo(() => {
    if (
      !isSearching ||
      !searchQuery.trim() ||
      !activeSearchScopeLabel ||
      isSearchAllScope ||
      currentScopeSearchFilteredNotes.length > 0
    ) {
      return undefined;
    }

    return filterSearchableNotes(searchableAllScopeNotes, searchQuery).length >
      0
      ? activeSearchScopeLabel
      : undefined;
  }, [
    activeSearchScopeLabel,
    currentScopeSearchFilteredNotes.length,
    isSearching,
    isSearchAllScope,
    searchQuery,
    searchableAllScopeNotes,
  ]);

  // 搜索过滤逻辑 - 在Hook之后定义以避免循环依赖
  const searchFilteredNotes = isSearchAllScope
    ? searchAllFilteredNotes
    : currentScopeSearchFilteredNotes;

  // 计算总咖啡消耗量
  const totalCoffeeConsumption = useRef(0);

  // 🔥 组件挂载时加载笔记数据和器具数据（不依赖 isOpen）
  useEffect(() => {
    void loadNotes();
    if (!customEquipmentInitialized) {
      void loadEquipments();
    }
  }, [customEquipmentInitialized, loadEquipments, loadNotes]);

  // 计算总消耗量
  useEffect(() => {
    totalCoffeeConsumption.current = calculateTotalCoffeeConsumption(notes);
  }, [notes]);

  // 显示消息提示 - 使用 LightToast
  const showToastMessage = (
    message: string,
    type: 'success' | 'error' | 'info' = 'info'
  ) => {
    showToast({ title: message, type });
  };

  // 处理删除笔记 - 统一数据流避免竞态条件，并恢复咖啡豆容量
  const handleDelete = async (noteId: string) => {
    try {
      // 找到要删除的笔记
      const noteToDelete = notes.find(note => note.id === noteId);
      if (!noteToDelete) {
        console.warn('未找到要删除的笔记:', noteId);
        return;
      }

      const { itemName: noteName, itemSuffix: noteSuffix } =
        getNoteDeleteDisplay(noteToDelete, coffeeBeanLookup);

      // 显示删除确认抽屉
      setDeleteConfirmData({ noteId, noteName, noteSuffix });
      setShowDeleteConfirm(true);
    } catch (error) {
      console.error('删除笔记失败:', error);
      showToastMessage('删除笔记失败', 'error');
    }
  };

  // 执行删除笔记
  const executeDeleteNote = async (noteId: string) => {
    try {
      const noteToDelete = notes.find(note => note.id === noteId);
      if (!noteToDelete) return;

      if (noteToDelete.source === 'roasting') {
        const { RoastingManager } =
          await import('@/lib/managers/roastingManager');
        const result = await RoastingManager.deleteRoastingRecord(noteId);
        if (!result.success) {
          throw new Error(result.error || '删除烘焙记录失败');
        }

        showToastMessage('烘焙记录已删除', 'success');
        return;
      }

      // 恢复咖啡豆容量（根据笔记类型采用不同的恢复策略）
      try {
        if (noteToDelete.source === 'capacity-adjustment') {
          await revertCapacityAdjustmentRecord(noteToDelete);
        } else {
          // 处理快捷扣除记录和普通笔记的恢复
          const { extractCoffeeAmountFromNote, getNoteAssociatedBeanId } =
            await import('../utils');
          const coffeeAmount = extractCoffeeAmountFromNote(noteToDelete);
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

      // 删除笔记 - 使用 Zustand store
      deleteNote(noteId);

      showToastMessage('笔记已删除', 'success');
    } catch (error) {
      console.error('删除笔记失败:', error);
      showToastMessage('删除笔记失败', 'error');
    }
  };

  // 处理复制笔记 - 打开编辑界面让用户修改后保存，不包含图片
  const handleCopyNote = async (noteId: string) => {
    try {
      const noteToCopy = notes.find(note => note.id === noteId);

      if (!noteToCopy) {
        console.warn('未找到要复制的笔记:', noteId);
        return;
      }

      if (noteToCopy.source === 'roasting') {
        const opened = await onCopyRoastingRecord?.(noteToCopy);
        if (!opened) return;

        showToastMessage('请修改后保存', 'info');
        return;
      }

      // 统一使用 BrewingNoteForm 处理所有类型的笔记复制
      const noteToEdit = createBrewingNoteCopyData(noteToCopy);

      // 通过事件触发模态框打开
      window.dispatchEvent(
        new CustomEvent('brewingNoteEditOpened', {
          detail: {
            data: noteToEdit,
            isCopy: true, // 标记这是复制操作
          },
        })
      );

      // 提示用户
      showToastMessage('请修改后保存', 'info');
    } catch (error) {
      console.error('复制笔记失败:', error);
      showToastMessage('复制笔记失败', 'error');
    }
  };

  // 处理笔记点击 - 统一使用 BrewingNoteForm 组件
  const handleNoteClick = async (note: BrewingNote) => {
    let noteForEdit: BrewingNote;

    try {
      const { getBrewingNoteById } = await import('@/lib/notes/relatedNotes');
      noteForEdit = (await getBrewingNoteById(note.id)) || note;
    } catch (error) {
      console.error('加载完整笔记失败:', error);
      showToastMessage('加载笔记失败，请稍后重试', 'error');
      return;
    }

    // 准备要编辑的笔记数据（包括快捷扣除记录和普通笔记）
    const noteToEdit = {
      id: noteForEdit.id,
      timestamp: noteForEdit.timestamp,
      equipment: noteForEdit.equipment,
      method: noteForEdit.method,
      params: noteForEdit.params,
      coffeeBeanInfo: noteForEdit.coffeeBeanInfo || {
        name: '', // 提供默认值
        roastLevel: '',
      },
      image: noteForEdit.image,
      images: noteForEdit.images,
      rating: noteForEdit.rating,
      taste: noteForEdit.taste,
      notes: noteForEdit.notes,
      totalTime: noteForEdit.totalTime,
      // 确保包含beanId字段，这是咖啡豆容量同步的关键
      beanId: noteForEdit.beanId,
      // 保留快捷扣除和容量调整的特殊字段
      source: noteForEdit.source,
      quickDecrementAmount: noteForEdit.quickDecrementAmount,
      changeRecord: noteForEdit.changeRecord,
    };

    // 通过事件触发模态框打开
    window.dispatchEvent(
      new CustomEvent('brewingNoteEditOpened', {
        detail: { data: noteToEdit },
      })
    );
  };

  // 注意：handleConvertToNormalNote 和 handleSaveChangeRecord 函数已移除
  // 现在统一使用 BrewingNoteForm 处理所有类型的笔记编辑（包括快捷扣除记录）
  // 快捷扣除记录的切换功能已集成到 BrewingNoteForm 内部

  // 处理添加笔记
  const handleAddNote = () => {
    if (!onAddNote) {
      return;
    }

    const syncedTimestamp =
      settings?.syncNewNoteDateWithSelectedDate &&
      filterMode === 'date' &&
      selectedDate
        ? resolveSelectedDateTimestamp(selectedDate, dateGroupingMode)
        : null;

    onAddNote(
      typeof syncedTimestamp === 'number'
        ? { timestamp: syncedTimestamp }
        : undefined
    );
  };

  // 处理排序选项变化
  const handleSortChange = (option: typeof sortOption) => {
    setSortOption(option);
    saveSortOptionPreference(option);
  };

  const handleViewModeChange = useCallback(
    (mode: NotesViewMode) => {
      updateViewPreference({ viewMode: mode, imageFlowType });
    },
    [imageFlowType, updateViewPreference]
  );

  const handleToggleImageFlowMode = useCallback(() => {
    updateViewPreference({ viewMode: 'gallery', imageFlowType: 'normal' });
  }, [updateViewPreference]);

  const handleToggleDateImageFlowMode = useCallback(() => {
    updateViewPreference({ viewMode: 'gallery', imageFlowType: 'date' });
  }, [updateViewPreference]);

  // 双击“全部”恢复上次图片流类型，或返回列表。
  const handleSmartToggleImageFlow = useCallback(() => {
    handleViewModeChange(viewMode === 'gallery' ? 'list' : 'gallery');
  }, [handleViewModeChange, viewMode]);

  // 处理过滤模式变化
  const handleFilterModeChange = (mode: 'equipment' | 'date') => {
    setIsSearchAllScope(false);
    setFilterMode(mode);
    saveFilterModePreference(mode);
    // 已保存到本地存储
    // 切换模式时清空选择
    setSelectedEquipment(null);
    setSelectedDate(null);
    saveSelectedEquipmentPreference(null);
    saveSelectedDatePreference(null);
    globalCache.selectedEquipment = null;
    globalCache.selectedDate = null;
  };

  // 处理设备选择变化
  const handleEquipmentClick = useCallback(
    (equipment: string | null) => {
      setIsSearchAllScope(false);
      setSelectedEquipment(equipment);
      saveSelectedEquipmentPreference(equipment);
    },
    [setIsSearchAllScope, setSelectedEquipment]
  );

  // 处理日期选择变化
  const handleDateClick = useCallback(
    (date: string | null) => {
      setIsSearchAllScope(false);
      setSelectedDate(date);
      saveSelectedDatePreference(date);
    },
    [setIsSearchAllScope, setSelectedDate]
  );

  // 处理日期分组模式变化
  const handleDateGroupingModeChange = useCallback(
    (mode: DateGroupingMode) => {
      setIsSearchAllScope(false);
      setDateGroupingMode(mode);
      saveDateGroupingModePreference(mode);
      setSelectedDate(null);
      saveSelectedDatePreference(null);
      globalCache.dateGroupingMode = mode;
      globalCache.selectedDate = null;
    },
    [setDateGroupingMode, setIsSearchAllScope, setSelectedDate]
  );

  // 处理笔记选择/取消选择
  const handleToggleSelect = (noteId: string, enterShareMode = false) => {
    // 如果需要进入分享模式
    if (enterShareMode && !isShareMode) {
      setIsShareMode(true);
      setSelectedNotes([noteId]);
      return;
    }

    // 在已有选择中切换选中状态
    setSelectedNotes(prev => {
      if (prev.includes(noteId)) {
        return prev.filter(id => id !== noteId);
      } else {
        return [...prev, noteId];
      }
    });
  };

  // 取消分享模式
  const handleCancelShare = () => {
    setIsShareMode(false);
    setSelectedNotes([]);
  };

  // 处理图文分享
  const handleArtisticShare = () => {
    if (selectedNotes.length !== 1) return;
    const noteId = selectedNotes[0];
    const note = notes.find(n => n.id === noteId);
    if (note) {
      setArtisticShareNote(note);
      setShowArtisticShareDrawer(true);
    }
  };

  // 保存并分享笔记截图
  const handleSaveNotes = async () => {
    if (selectedNotes.length === 0 || isSaving) return;

    setIsSaving(true);

    try {
      // 调用导出组件函数
      await exportSelectedNotes({
        selectedNotes,
        notesContainerRef,
        onSuccess: message => showToastMessage(message, 'success'),
        onError: message => showToastMessage(message, 'error'),
        onComplete: () => {
          setIsSaving(false);
          handleCancelShare();
        },
      });
    } catch (error) {
      console.error('导出笔记失败:', error);
      showToastMessage('导出笔记失败', 'error');
      setIsSaving(false);
    }
  };

  // 处理搜索按钮点击
  const handleSearchClick = () => {
    setIsSearching(!isSearching);
    if (isSearching) {
      setSearchQuery('');
      setIsSearchAllScope(false);
    }
  };

  // 处理搜索输入变化
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsSearchAllScope(false);
    setSearchQuery(e.target.value);
  };

  // 处理搜索框键盘事件
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsSearching(false);
      setSearchQuery('');
      setIsSearchAllScope(false);
    }
  };

  // 处理搜索历史点击
  const handleSearchHistoryClick = (query: string) => {
    setIsSearchAllScope(false);
    setSearchQuery(query);
  };

  const handleSearchAllClick = useCallback(() => {
    setIsSearchAllScope(true);
  }, [setIsSearchAllScope]);

  // 自动添加搜索历史 - 延迟1秒后添加
  useEffect(() => {
    if (!isSearching || !searchQuery.trim()) return;

    const timer = setTimeout(() => {
      addSearchHistory(searchQuery.trim());
      setSearchHistory(getSearchHistoryPreference());
    }, 1000);

    return () => clearTimeout(timer);
  }, [searchQuery, isSearching]);

  // 计算当前显示的消耗量 - 使用Hook提供的数据
  const currentConsumption = useMemo(() => {
    // 搜索状态下，计算搜索结果的消耗量
    if (isSearching && searchQuery.trim()) {
      return calculateTotalCoffeeConsumption(searchFilteredNotes);
    }

    // 其他情况使用Hook计算的总消耗量
    return totalConsumption;
  }, [isSearching, searchQuery, searchFilteredNotes, totalConsumption]);

  // 计算图片流模式下的统计信息
  const imageFlowCandidateNotes = useMemo(
    () =>
      isSearching && searchQuery.trim() ? searchFilteredNotes : filteredNotes,
    [filteredNotes, isSearching, searchFilteredNotes, searchQuery]
  );

  const imageFlowStats = useMemo(() => {
    if (!isImageFlowMode && !isDateImageFlowMode) {
      return null;
    }

    // 过滤出有图片的笔记
    const notesWithImages = imageFlowCandidateNotes.filter(noteHasImage);

    // 计算有图片笔记的消耗量
    const imageNotesConsumption =
      calculateTotalCoffeeConsumption(notesWithImages);

    return {
      count: notesWithImages.length,
      consumption: imageNotesConsumption,
      notes: notesWithImages,
    };
  }, [
    isImageFlowMode,
    isDateImageFlowMode,
    imageFlowCandidateNotes,
    noteHasImage,
  ]);

  // 计算是否有图片笔记（用于禁用/启用图片流按钮）
  const hasImageNotes = useMemo(() => {
    return imageFlowCandidateNotes.some(noteHasImage);
  }, [imageFlowCandidateNotes, noteHasImage]);

  // 计算图片流模式下的可用设备列表
  const imageFlowAvailableOptions = useMemo(() => {
    if (!isImageFlowMode && !isDateImageFlowMode) {
      return {
        equipments: availableEquipments,
      };
    }

    // 基于原始的所有笔记数据来计算有图片的分类选项
    // 这样确保即使选择了某个分类，其他分类选项仍然可见

    // 如果是搜索模式，基于搜索结果；否则基于所有原始笔记
    const baseNotes =
      isSearching && searchQuery.trim() ? searchFilteredNotes : notes;

    // 过滤出有图片的记录
    const allNotesWithImages = baseNotes.filter(noteHasImage);

    // 获取有图片记录的设备列表
    const equipmentSet = new Set<string>();
    allNotesWithImages.forEach(note => {
      if (note.equipment) {
        equipmentSet.add(note.equipment);
      }
    });

    return {
      equipments: Array.from(equipmentSet).sort(),
    };
  }, [
    isImageFlowMode,
    isDateImageFlowMode,
    isSearching,
    searchQuery,
    searchFilteredNotes,
    availableEquipments,
    noteHasImage,
    notes,
  ]);

  // 在图片流模式下，如果当前选中的设备没有图片记录，自动切换到"全部"
  useEffect(() => {
    if (!imageFlowStats || !areNoteImageCountsLoaded) return;

    const { equipments } = imageFlowAvailableOptions;

    // 检查当前选中的设备是否在有图片的设备列表中
    if (
      filterMode === 'equipment' &&
      selectedEquipment &&
      !equipments.includes(selectedEquipment)
    ) {
      handleEquipmentClick(null);
    }
  }, [
    areNoteImageCountsLoaded,
    imageFlowStats,
    imageFlowAvailableOptions,
    filterMode,
    selectedEquipment,
    handleEquipmentClick,
  ]);

  const navigationSwipeHandlers = useNavigationSwipe(navigationSwipeControl);

  return (
    <div
      className={`flex h-full flex-col overflow-hidden ${
        isOpen ? '' : 'hidden'
      }`}
    >
      {/* 笔记筛选分类栏 - 只有当有笔记数据时才显示 */}
      {notes.length > 0 && (
        <div
          className={`sticky top-0 z-10 flex-none space-y-6 bg-neutral-50 ${
            navigationSwipeControl?.isCollapsed ? 'pt-0' : 'pt-6'
          } md:pt-0 dark:bg-neutral-900`}
          {...navigationSwipeHandlers}
        >
          {/* 数量显示 */}
          <div className="mb-6 flex items-center justify-between px-6">
            <div
              className={`relative min-w-0 ${navigationToggleControl ? 'pl-6' : ''}`}
            >
              {navigationToggleControl && (
                <div className="absolute top-1/2 -left-1.5 -translate-y-1/2">
                  {navigationToggleControl}
                </div>
              )}
              <div className="min-w-0 text-xs font-medium tracking-wide wrap-break-word text-neutral-800 dark:text-neutral-100">
                {(() => {
                  // 图片流模式下显示有图片的记录统计
                  if (imageFlowStats) {
                    return `${imageFlowStats.count} 条图片记录，已消耗 ${formatConsumption(imageFlowStats.consumption)}`;
                  }

                  // 普通模式下显示总记录统计
                  // 搜索模式：显示搜索结果的统计
                  if (isSearching && searchQuery.trim()) {
                    return `${searchFilteredNotes.length} 条记录，已消耗 ${formatConsumption(currentConsumption)}`;
                  }

                  // 普通模式：显示当前筛选结果的统计
                  return `${totalCount} 条记录，已消耗 ${formatConsumption(currentConsumption)}`;
                })()}
              </div>
            </div>
          </div>

          {/* 设备筛选选项卡 */}
          <FilterTabs
            filterMode={filterMode}
            selectedEquipment={selectedEquipment}
            selectedDate={selectedDate}
            dateGroupingMode={dateGroupingMode}
            availableEquipments={imageFlowAvailableOptions.equipments}
            availableDates={availableDates}
            equipmentNames={equipmentNames}
            onFilterModeChange={handleFilterModeChange}
            onEquipmentClick={handleEquipmentClick}
            onDateClick={handleDateClick}
            onDateGroupingModeChange={handleDateGroupingModeChange}
            isSearching={isSearching}
            searchQuery={searchQuery}
            onSearchClick={handleSearchClick}
            onSearchChange={handleSearchChange}
            onSearchKeyDown={handleSearchKeyDown}
            sortOption={sortOption}
            onSortChange={handleSortChange}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            isImageFlowMode={isImageFlowMode}
            onToggleImageFlowMode={handleToggleImageFlowMode}
            isDateImageFlowMode={isDateImageFlowMode}
            onToggleDateImageFlowMode={handleToggleDateImageFlowMode}
            onSmartToggleImageFlow={handleSmartToggleImageFlow}
            hasImageNotes={hasImageNotes}
            settings={settings}
            searchHistory={searchHistory}
            onSearchHistoryClick={handleSearchHistoryClick}
            searchAllScopeLabel={searchAllScopeLabel}
            onSearchAllClick={handleSearchAllClick}
            tableColumnOptions={tableColumnOptions}
            tableVisibleColumns={effectiveTableVisibleColumns}
            onTableColumnsChange={updateTableVisibleColumns}
          />
        </div>
      )}

      {/* 内容区域 - 可滚动 */}
      <div className="flex-1 overflow-hidden">
        <div
          className={
            viewMode === 'table'
              ? 'h-full w-full overflow-hidden'
              : 'scroll-with-bottom-bar h-full w-full overflow-y-auto'
          }
          ref={setNotesContainerRef}
        >
          {/* 笔记列表视图 - 始终传递正确的笔记数据 */}
          <ListView
            selectedEquipment={selectedEquipment}
            filterMode={filterMode}
            onNoteClick={handleNoteClick}
            onDeleteNote={handleDelete}
            onCopyNote={handleCopyNote}
            isShareMode={isShareMode}
            selectedNotes={selectedNotes}
            onToggleSelect={handleToggleSelect}
            searchQuery={searchQuery}
            isSearching={isSearching}
            emptyStateMessage={searchAllScopeLabel ? null : undefined}
            preFilteredNotes={
              isSearching && searchQuery.trim()
                ? searchFilteredNotes
                : filteredNotes
            }
            viewMode={viewMode}
            isDateImageFlowMode={isDateImageFlowMode}
            scrollParentRef={notesScrollEl ?? undefined}
            equipmentNames={equipmentNames}
            coffeeBeans={coffeeBeans}
            settings={settings}
            tableVisibleColumns={effectiveTableVisibleColumns}
            activeNoteId={activeNoteId}
            noteImageCounts={noteImageCounts}
          />
        </div>
      </div>

      {/* 底部操作栏 - 分享模式下显示保存和取消按钮，图片流模式下隐藏添加按钮 */}
      {isShareMode ? (
        <BottomActionBar
          buttons={[
            {
              text: '取消',
              onClick: handleCancelShare,
            },
            {
              text: isSaving
                ? '生成中...'
                : `保存为图片 (${selectedNotes.length})`,
              onClick: handleSaveNotes,
              className:
                selectedNotes.length === 0 || isSaving
                  ? 'cursor-not-allowed opacity-50'
                  : '',
            },
            {
              text: '图文分享',
              onClick: handleArtisticShare,
              className:
                selectedNotes.length !== 1
                  ? 'cursor-not-allowed opacity-50'
                  : '',
            },
          ]}
        />
      ) : (
        !isImageFlowMode &&
        !isDateImageFlowMode && <AddNoteButton onAddNote={handleAddNote} />
      )}

      {/* 图文分享抽屉 */}
      {artisticShareNote && (
        <ArtisticShareDrawer
          isOpen={showArtisticShareDrawer}
          onClose={() => {
            setShowArtisticShareDrawer(false);
            // 延迟清理数据
            setTimeout(() => {
              setArtisticShareNote(null);
              handleCancelShare(); // 关闭分享模式
            }, 300);
          }}
          note={artisticShareNote}
        />
      )}

      {/* 删除确认抽屉 */}
      <DeleteConfirmDrawer
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => {
          if (deleteConfirmData) {
            executeDeleteNote(deleteConfirmData.noteId);
          }
        }}
        itemName={deleteConfirmData?.noteName || ''}
        itemType="笔记"
        itemSuffix={deleteConfirmData?.noteSuffix}
        extraWarning="删除后咖啡豆库存将恢复。"
        onExitComplete={() => setDeleteConfirmData(null)}
      />
    </div>
  );
};

export default BrewingHistory;
