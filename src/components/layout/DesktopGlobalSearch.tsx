'use client';

import React, {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Command } from 'cmdk';
import { RefreshCw, Upload, Download } from 'lucide-react';
import { useCloudSyncConnection } from '@/lib/hooks/useCloudSync';
import type { SyncDirection } from '@/lib/sync/types';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import type { CustomEquipment, BrewingNote } from '@/lib/core/config';
import type { SettingsOptions } from '@/components/settings/Settings';
import { useCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore';
import { useBrewingNoteStore } from '@/lib/stores/brewingNoteStore';
import type { CoffeeBean } from '@/types/app';
import {
  formatBeanDisplayName,
  formatNoteBeanDisplayName,
} from '@/lib/utils/beanVarietyUtils';
import { getEquipmentNameById } from '@/lib/utils/equipmentUtils';
import { calculateFlavorInfo } from '@/lib/utils/flavorPeriodUtils';
import FlavorStatusRing from '@/components/coffee-bean/List/components/FlavorStatusRing';
import { sortBeansByFlavorPeriod } from '@/lib/utils/beanSortUtils';
import { isBeanEmpty } from '@/components/coffee-bean/List/preferences';

type NoteDetailPayload = {
  note: BrewingNote;
  equipmentName: string;
  beanUnitPrice: number;
  beanInfo: CoffeeBean | null;
};

interface BeanSearchItem {
  id: string;
  title: string;
  searchText: string;
  bean: CoffeeBean;
  isEmpty: boolean;
}

interface NoteSearchItem {
  id: string;
  title: string;
  dateLabel: string;
  searchText: string;
  payload: NoteDetailPayload;
}

interface DesktopGlobalSearchProps {
  syncDisabled?: boolean;
  settings: SettingsOptions;
  customEquipments: CustomEquipment[];
  onSelectBean: (bean: CoffeeBean) => void;
  onSelectNote: (payload: NoteDetailPayload) => void;
}

const extractNumber = (value?: string): number | null => {
  if (!value) return null;
  const match = value.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const parsed = Number.parseFloat(match[1]);
  return Number.isNaN(parsed) ? null : parsed;
};

const getBeanUnitPrice = (bean: CoffeeBean | null): number => {
  if (!bean?.price || !bean.capacity) return 0;

  const price = extractNumber(bean.price);
  const capacity = extractNumber(bean.capacity);
  if (!price || !capacity || capacity <= 0) return 0;

  return price / capacity;
};

const toDesktopDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const currentDayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
  const targetDayStart = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  ).getTime();

  const dayDiff = Math.round((currentDayStart - targetDayStart) / 86400000);
  if (dayDiff === 0) return '今天';
  if (dayDiff === 1) return '昨天';
  if (dayDiff === 2) return '前天';

  const month = date.getMonth() + 1;
  const day = date.getDate();
  if (date.getFullYear() === now.getFullYear()) {
    return `${month}月${day}日`;
  }
  return `${date.getFullYear()}年${month}月${day}日`;
};

const MAX_IDLE_RESULTS = 36;
const MAX_SEARCH_RESULTS = 120;
const MAX_IDLE_EMPTY_RESULTS = 12;
const MAX_SEARCH_EMPTY_RESULTS = 60;

const SYNC_ACTIONS = [
  {
    direction: 'auto',
    label: '同步数据',
    description: '双向合并',
    searchText: '同步数据 云同步 双向合并 sync',
    icon: RefreshCw,
  },
  {
    direction: 'upload',
    label: '上传数据',
    description: '本机覆盖云端',
    searchText: '上传数据 云同步 本机覆盖云端 upload sync',
    icon: Upload,
  },
  {
    direction: 'download',
    label: '下载数据',
    description: '云端覆盖本机',
    searchText: '下载数据 云同步 云端覆盖本机 download sync',
    icon: Download,
  },
] as const;

const formatBeanNumber = (value: string | undefined): string =>
  !value
    ? '0'
    : Number.isInteger(parseFloat(value))
      ? Math.floor(parseFloat(value)).toString()
      : value;

const formatPricePerGram = (
  price: string | undefined,
  capacity: string | undefined
): string => {
  if (!price || !capacity) return '';
  const priceNum = parseFloat(price);
  const capacityNum = parseFloat(capacity.replace('g', ''));
  if (isNaN(priceNum) || isNaN(capacityNum) || capacityNum <= 0) return '';
  return `${(priceNum / capacityNum).toFixed(2)}元/克`;
};

const getFlavorStatusText = (
  bean: CoffeeBean,
  customFlavorPeriod?: SettingsOptions['customFlavorPeriod']
) => {
  if (bean.isInTransit) return '在途';
  if (bean.isFrozen) return '冷冻';
  if (!bean.roastDate) return '-';

  const info = calculateFlavorInfo(bean, customFlavorPeriod);
  if (info.phase === '养豆期') return `养豆${info.remainingDays}天`;
  if (info.phase === '赏味期') return `赏味${info.remainingDays}天`;
  if (info.phase === '衰退期') return '已衰退';
  return '';
};

const normalizeText = (value: string) =>
  value.toLowerCase().normalize('NFKC').replace(/\s+/g, ' ').trim();

const toTokens = (value: string) =>
  normalizeText(value)
    .split(' ')
    .map(token => token.trim())
    .filter(Boolean);

const matchesAllTokens = (searchText: string, tokens: string[]) => {
  if (tokens.length === 0) return true;
  for (const token of tokens) {
    if (!searchText.includes(token)) return false;
  }
  return true;
};

const filterItems = <T extends { searchText: string }>(
  items: T[],
  tokens: string[],
  limits: {
    idle: number;
    searching: number;
  } = {
    idle: MAX_IDLE_RESULTS,
    searching: MAX_SEARCH_RESULTS,
  }
): T[] => {
  const limit = tokens.length > 0 ? limits.searching : limits.idle;
  if (tokens.length === 0) {
    return items.slice(0, limit);
  }

  const result: T[] = [];
  for (const item of items) {
    if (!matchesAllTokens(item.searchText, tokens)) continue;
    result.push(item);
    if (result.length >= limit) break;
  }
  return result;
};

const isChangeRecordNote = (note: BrewingNote): boolean => {
  if (
    note.source === 'quick-decrement' ||
    note.source === 'capacity-adjustment' ||
    note.source === 'roasting'
  ) {
    return true;
  }

  return Boolean(note.changeRecord);
};

const DesktopGlobalSearch: React.FC<DesktopGlobalSearchProps> = ({
  syncDisabled = false,
  settings,
  customEquipments,
  onSelectBean,
  onSelectNote,
}) => {
  const {
    status: cloudSyncStatus,
    isSyncing,
    performSync,
  } = useCloudSyncConnection(settings);
  const [syncConfirmation, setSyncConfirmation] = useState<{
    direction: 'upload' | 'download';
    open: boolean;
  }>({ direction: 'upload', open: false });
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  const beans = useCoffeeBeanStore(state => state.beans);
  const notes = useBrewingNoteStore(state => state.notes);
  const beanMap = useMemo(
    () => new Map(beans.map(bean => [bean.id, bean])),
    [beans]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (syncConfirmation.open) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(prev => !prev);
      } else if (open && event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        setQuery('');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, syncConfirmation.open]);

  useEffect(() => {
    if (!open) return;
    if (typeof document === 'undefined') return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const buildBeanItem = useCallback(
    (bean: CoffeeBean, isEmpty: boolean): BeanSearchItem => {
      const title = formatBeanDisplayName(bean, {
        roasterFieldEnabled: settings.roasterFieldEnabled,
        roasterSeparator: settings.roasterSeparator,
      });
      const metaParts = [
        getFlavorStatusText(bean, settings.customFlavorPeriod),
        bean.capacity && bean.remaining
          ? `${formatBeanNumber(bean.remaining)}/${formatBeanNumber(
              bean.capacity
            )}克`
          : '',
        formatPricePerGram(bean.price, bean.capacity),
      ].filter(Boolean);

      const searchText = normalizeText(
        [
          title,
          metaParts.join(' '),
          bean.name,
          bean.roaster || '',
          bean.notes || '',
          ...(bean.flavor || []),
        ].join(' ')
      );

      return {
        id: bean.id,
        title,
        searchText,
        bean,
        isEmpty,
      };
    },
    [
      settings.customFlavorPeriod,
      settings.roasterFieldEnabled,
      settings.roasterSeparator,
    ]
  );

  const hasBeanCapacity = useCallback((bean: CoffeeBean) => {
    const capacity = extractNumber(bean.capacity);
    return !!capacity && capacity > 0;
  }, []);

  const { activeBeanItems, emptyBeanItems } = useMemo(() => {
    if (!open) return { activeBeanItems: [], emptyBeanItems: [] };

    // 与 CoffeeBeanList 一致：搜索列表只处理熟豆
    const roastedBeans = beans.filter(bean => bean.beanState !== 'green');
    const emptyBeans = roastedBeans.filter(bean => isBeanEmpty(bean));
    const nonEmptyBeans = roastedBeans.filter(bean => !isBeanEmpty(bean));

    // 先按原列表赏味期排序，再在同序列里把“有容量”提到前面
    const sortedNonEmpty = sortBeansByFlavorPeriod(nonEmptyBeans);
    const prioritizedNonEmpty = [
      ...sortedNonEmpty.filter(hasBeanCapacity),
      ...sortedNonEmpty.filter(bean => !hasBeanCapacity(bean)),
    ];

    const sortedEmpty = sortBeansByFlavorPeriod(emptyBeans);

    return {
      activeBeanItems: prioritizedNonEmpty.map(bean =>
        buildBeanItem(bean, false)
      ),
      emptyBeanItems: sortedEmpty.map(bean => buildBeanItem(bean, true)),
    };
  }, [beans, buildBeanItem, open, hasBeanCapacity]);

  const noteItems = useMemo<NoteSearchItem[]>(() => {
    if (!open) return [];
    return notes
      .filter(note => !isChangeRecordNote(note))
      .sort((a, b) => {
        if (b.timestamp !== a.timestamp) {
          return b.timestamp - a.timestamp;
        }
        return (b.updatedAt || 0) - (a.updatedAt || 0);
      })
      .map(note => {
        const beanDisplayName = formatNoteBeanDisplayName(note.coffeeBeanInfo, {
          roasterFieldEnabled: settings.roasterFieldEnabled,
          roasterSeparator: settings.roasterSeparator,
        });
        const equipmentName =
          note.equipmentName ||
          (note.equipmentId === null
            ? note.equipment
            : getEquipmentNameById(
                note.equipmentId || note.equipment,
                customEquipments
              )) ||
          '未知器具';
        const dateText = toDesktopDate(note.timestamp);

        const title = [
          beanDisplayName,
          note.methodName || note.method || equipmentName,
        ]
          .filter(Boolean)
          .join(' · ');
        const subtitle = [
          dateText,
          note.notes?.trim() ? note.notes.trim().slice(0, 40) : equipmentName,
        ]
          .filter(Boolean)
          .join(' · ');

        const beanInfo = note.beanId ? beanMap.get(note.beanId) || null : null;
        const beanUnitPrice = getBeanUnitPrice(beanInfo);

        const searchText = normalizeText(
          [
            title || equipmentName,
            subtitle,
            note.notes || '',
            note.methodName || note.method || '',
            note.equipmentName || note.equipment || '',
            equipmentName,
            beanDisplayName,
            note.params?.coffee || '',
            note.params?.ratio || '',
            note.params?.grindSize || '',
            note.params?.temp || '',
            note.params?.water || '',
          ].join(' ')
        );

        return {
          id: note.id,
          title: title || equipmentName,
          dateLabel: dateText,
          searchText,
          payload: {
            note,
            equipmentName,
            beanUnitPrice,
            beanInfo,
          },
        };
      });
  }, [
    beanMap,
    customEquipments,
    open,
    notes,
    settings.roasterFieldEnabled,
    settings.roasterSeparator,
  ]);

  const queryTokens = useMemo(() => toTokens(deferredQuery), [deferredQuery]);

  const visibleBeanItems = useMemo(() => {
    if (!open) return [];
    const activeItems = filterItems(activeBeanItems, queryTokens);
    const emptyItems = filterItems(emptyBeanItems, queryTokens, {
      idle: MAX_IDLE_EMPTY_RESULTS,
      searching: MAX_SEARCH_EMPTY_RESULTS,
    });
    return [...activeItems, ...emptyItems];
  }, [activeBeanItems, emptyBeanItems, open, queryTokens]);

  const visibleNoteItems = useMemo(() => {
    if (!open) return [];
    return filterItems(noteItems, queryTokens);
  }, [noteItems, open, queryTokens]);

  const syncActions =
    cloudSyncStatus === 'connected'
      ? SYNC_ACTIONS.filter(action =>
          matchesAllTokens(action.searchText, queryTokens)
        )
      : [];
  const hasResults =
    syncActions.length > 0 ||
    visibleBeanItems.length > 0 ||
    visibleNoteItems.length > 0;

  const handleSelectBean = useCallback(
    (bean: CoffeeBean) => {
      onSelectBean(bean);
      setOpen(false);
      setQuery('');
    },
    [onSelectBean]
  );

  const handleSelectNote = useCallback(
    (payload: NoteDetailPayload) => {
      onSelectNote(payload);
      setOpen(false);
      setQuery('');
    },
    [onSelectNote]
  );

  const closePanel = () => {
    setOpen(false);
    setQuery('');
  };

  const handleSync = (direction: SyncDirection) => {
    if (isSyncing || syncDisabled) return;
    closePanel();
    if (direction === 'auto') void performSync(direction);
    else setSyncConfirmation({ direction, open: true });
  };

  const closeSyncConfirmation = () => {
    setSyncConfirmation(current => ({ ...current, open: false }));
  };

  const confirmSync = () => {
    closeSyncConfirmation();
    if (!isSyncing && !syncDisabled) void performSync(syncConfirmation.direction);
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-90 flex items-center justify-center p-4"
          onMouseDown={event => {
            if (event.target !== event.currentTarget) return;
            closePanel();
          }}
        >
          <div
            className="flex h-[min(76dvh,680px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-neutral-200/50 bg-white shadow-xl dark:border-neutral-800/50 dark:bg-neutral-900"
            onClick={event => event.stopPropagation()}
          >
            <Command
              loop
              shouldFilter={false}
              className="flex h-full w-full flex-col"
            >
              <div className="flex items-center gap-2 border-b border-neutral-200/50 px-4 py-3 dark:border-neutral-800/50">
                <Command.Input
                  autoFocus
                  value={query}
                  onValueChange={setQuery}
                  placeholder="搜索咖啡豆、笔记或操作..."
                  className="h-6 w-full bg-transparent text-base text-neutral-800 outline-none placeholder:text-neutral-400 md:text-sm dark:text-neutral-100"
                />
              </div>

              <Command.List className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">
                {!hasResults && (
                  <div className="px-3 py-6 text-center text-xs text-neutral-500 dark:text-neutral-400">
                    没有找到匹配的结果
                  </div>
                )}

                {syncActions.length > 0 && (
                  <Command.Group
                    heading={isSyncing ? '云同步 · 进行中' : '云同步'}
                    className="py-1 text-xs text-neutral-500 dark:text-neutral-400 **:[[cmdk-group-heading]]:mb-1 **:[[cmdk-group-heading]]:px-0 **:[[cmdk-group-heading]]:pt-2 **:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:font-medium"
                  >
                    {syncActions.map(action => (
                      <Command.Item
                        key={action.direction}
                        value={`action:${action.direction}`}
                        onSelect={() => handleSync(action.direction)}
                        disabled={isSyncing || syncDisabled}
                        className="-mx-2 flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm text-neutral-700 outline-none data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-40 data-[selected=true]:bg-neutral-100 dark:text-neutral-200 dark:data-[selected=true]:bg-neutral-800"
                      >
                        <action.icon className="size-4 shrink-0" aria-hidden="true" />
                        <span className="flex-1">{action.label}</span>
                        <span className="text-xs text-neutral-500 dark:text-neutral-400">
                          {action.description}
                        </span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {visibleBeanItems.length > 0 && (
                  <Command.Group
                    heading={`咖啡豆 ${visibleBeanItems.length}`}
                    className="py-1 text-xs text-neutral-500 dark:text-neutral-400 **:[[cmdk-group-heading]]:mb-1 **:[[cmdk-group-heading]]:px-0 **:[[cmdk-group-heading]]:pt-2 **:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:font-medium"
                  >
                    {visibleBeanItems.map(item => (
                      <Command.Item
                        key={item.id}
                        value={
                          item.isEmpty
                            ? `bean-empty:${item.id}`
                            : `bean:${item.id}`
                        }
                        onSelect={() => handleSelectBean(item.bean)}
                        className={`-mx-2 flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm outline-none data-[selected=true]:bg-neutral-100 dark:data-[selected=true]:bg-neutral-800 ${
                          item.isEmpty
                            ? 'text-neutral-500 dark:text-neutral-400'
                            : 'text-neutral-700 dark:text-neutral-200'
                        }`}
                      >
                        <FlavorStatusRing
                          bean={item.bean}
                          muted={item.isEmpty}
                          className="h-4 w-4 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm">{item.title}</div>
                        </div>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {visibleNoteItems.length > 0 && (
                  <Command.Group
                    heading={`笔记 ${visibleNoteItems.length}`}
                    className="py-1 text-xs text-neutral-500 dark:text-neutral-400 **:[[cmdk-group-heading]]:mb-1 **:[[cmdk-group-heading]]:px-0 **:[[cmdk-group-heading]]:pt-2 **:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:font-medium"
                  >
                    {visibleNoteItems.map(item => (
                      <Command.Item
                        key={item.id}
                        value={`note:${item.id}`}
                        onSelect={() => handleSelectNote(item.payload)}
                        className="-mx-2 flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm text-neutral-700 outline-none data-[selected=true]:bg-neutral-100 dark:text-neutral-200 dark:data-[selected=true]:bg-neutral-800"
                      >
                        <FlavorStatusRing
                          noteRating={item.payload.note.rating}
                          className="h-4 w-4 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm">{item.title}</div>
                        </div>
                        {item.dateLabel && (
                          <div className="ml-2 shrink-0 text-sm text-neutral-500 tabular-nums dark:text-neutral-400">
                            {item.dateLabel}
                          </div>
                        )}
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
              </Command.List>

              <div className="border-t border-neutral-200/50 px-4 py-2 text-[11px] text-neutral-500 dark:border-neutral-800/50 dark:text-neutral-400">
                Enter 选择 · Esc 关闭 · Command + K 唤出
              </div>
            </Command>
          </div>
        </div>
      )}
      <ActionDrawer
        isOpen={syncConfirmation.open}
        onClose={closeSyncConfirmation}
        historyId="command-sync-confirm"
      >
        <ActionDrawer.Content>
          <p className="text-neutral-500 dark:text-neutral-400">
            {syncConfirmation.direction === 'upload'
              ? '上传会用本机数据覆盖云端数据，确认继续吗？'
              : '下载会用云端数据覆盖本机数据，请先备份重要数据。确认继续吗？'}
          </p>
        </ActionDrawer.Content>
        <ActionDrawer.Actions>
          <ActionDrawer.SecondaryButton onClick={closeSyncConfirmation}>
            取消
          </ActionDrawer.SecondaryButton>
          <ActionDrawer.PrimaryButton onClick={confirmSync}>
            {syncConfirmation.direction === 'upload' ? '确认上传' : '确认下载'}
          </ActionDrawer.PrimaryButton>
        </ActionDrawer.Actions>
      </ActionDrawer>
    </>
  );
};

export default DesktopGlobalSearch;
