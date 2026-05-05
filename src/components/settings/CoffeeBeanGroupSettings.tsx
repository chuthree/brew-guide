'use client';

import React from 'react';
import Image from 'next/image';
import { Drawer } from 'vaul';
import { Check, ChevronRight, Plus, Search, X } from 'lucide-react';

import type { SettingsOptions } from './Settings';
import { SettingPage, SettingSection, SettingRow } from './atomic';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';
import { useThemeColor } from '@/lib/hooks/useThemeColor';
import { useCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import type { CoffeeBeanGroup } from '@/lib/core/db';
import type { CoffeeBean } from '@/types/app';
import { normalizeCoffeeBeanGroups } from '@/lib/utils/coffeeBeanGroupUtils';
import {
  formatBeanDisplayName,
  getBeanDisplayInitial,
  getRoasterName,
} from '@/lib/utils/beanVarietyUtils';
import { sortBeansByFlavorPeriod } from '@/lib/utils/beanSortUtils';
import { parseDateToTimestamp } from '@/lib/utils/dateUtils';
import {
  calculateFlavorInfo,
  getDefaultFlavorPeriodByRoastLevelSync,
} from '@/lib/utils/flavorPeriodUtils';
import hapticsUtils from '@/lib/ui/haptics';

interface CoffeeBeanGroupSettingsProps {
  settings: SettingsOptions;
  onClose: () => void;
  handleChange: <K extends keyof SettingsOptions>(
    key: K,
    value: SettingsOptions[K]
  ) => void | Promise<void>;
}

type RoasterDisplaySettings = {
  roasterFieldEnabled?: boolean;
  roasterSeparator?: ' ' | '/';
};

type BeanDisplaySettings = RoasterDisplaySettings & {
  dateDisplayMode?: 'date' | 'flavorPeriod' | 'agingDays';
  showPrice?: boolean;
  showTotalPrice?: boolean;
};

type EditingDraft = {
  groupId: string | null;
  name: string;
  beanIds: string[];
};

const createGroupId = () =>
  `bean_group_${globalThis.crypto?.randomUUID?.() || Date.now()}`;

const parseWeight = (value?: string) => {
  const parsed = Number.parseFloat(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
};

const hasUsableCapacity = (bean: CoffeeBean) => {
  const capacity = parseWeight(bean.capacity);
  if (!bean.capacity || capacity <= 0) return true;
  return parseWeight(bean.remaining) > 0;
};

const formatNumber = (value: string | undefined): string =>
  !value
    ? '0'
    : Number.isInteger(Number.parseFloat(value))
      ? Math.floor(Number.parseFloat(value)).toString()
      : value;

const formatDateShort = (dateStr: string): string => {
  try {
    const timestamp = parseDateToTimestamp(dateStr);
    const date = new Date(timestamp);
    const year = date.getFullYear().toString().slice(-2);
    return `${year}-${date.getMonth() + 1}-${date.getDate()}`;
  } catch {
    return dateStr;
  }
};

const getAgingDaysText = (dateStr: string): string => {
  try {
    const timestamp = parseDateToTimestamp(dateStr);
    const roastDate = new Date(timestamp);
    const today = new Date();
    const todayDate = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const roastDateOnly = new Date(
      roastDate.getFullYear(),
      roastDate.getMonth(),
      roastDate.getDate()
    );
    const daysSinceRoast = Math.ceil(
      (todayDate.getTime() - roastDateOnly.getTime()) / (1000 * 60 * 60 * 24)
    );
    return `养豆${daysSinceRoast}天`;
  } catch {
    return '养豆0天';
  }
};

const getFlavorStatusText = (
  bean: CoffeeBean,
  displaySettings: RoasterDisplaySettings
) => {
  if (bean.isInTransit) return '在途';
  if (bean.isFrozen) return '冷冻';
  if (!bean.roastDate) return '';

  const flavorInfo = calculateFlavorInfo(bean);
  let startDay = bean.startDay || 0;
  let endDay = bean.endDay || 0;

  if (startDay === 0 && endDay === 0) {
    const roasterName = getRoasterName(bean, displaySettings);
    const defaultPeriod = getDefaultFlavorPeriodByRoastLevelSync(
      bean.roastLevel || '',
      undefined,
      roasterName
    );
    startDay = defaultPeriod.startDay;
    endDay = defaultPeriod.endDay;
  }

  if (flavorInfo.phase === '养豆期') {
    return `养豆 ${flavorInfo.remainingDays}天`;
  }
  if (flavorInfo.phase === '赏味期') {
    return `赏味 ${flavorInfo.remainingDays}天`;
  }
  if (flavorInfo.phase === '衰退期') {
    return '已衰退';
  }
  return '';
};

const formatPrice = (
  price: string,
  capacity: string,
  showTotalPrice?: boolean
): string => {
  const priceNum = Number.parseFloat(price);
  const capacityNum = Number.parseFloat(capacity.replace('g', ''));
  if (Number.isNaN(priceNum) || Number.isNaN(capacityNum) || capacityNum === 0)
    return '';

  const pricePerGram = (priceNum / capacityNum).toFixed(2);
  return showTotalPrice
    ? `${priceNum}元(${pricePerGram}元/克)`
    : `${pricePerGram}元/克`;
};

const getBeanMetaParts = (
  bean: CoffeeBean,
  displaySettings: BeanDisplaySettings
) => {
  const parts: string[] = [];
  const isGreenBean = bean.beanState === 'green';
  const displayDate = isGreenBean ? bean.purchaseDate : bean.roastDate;

  if (bean.isInTransit) {
    parts.push('在途');
  } else if (bean.isFrozen) {
    parts.push('冷冻');
  } else if (
    !isGreenBean &&
    displayDate &&
    displaySettings.dateDisplayMode === 'flavorPeriod'
  ) {
    const statusText = getFlavorStatusText(bean, displaySettings);
    if (statusText) parts.push(statusText);
  } else if (
    !isGreenBean &&
    displayDate &&
    displaySettings.dateDisplayMode === 'agingDays'
  ) {
    parts.push(getAgingDaysText(displayDate));
  } else if (displayDate) {
    parts.push(formatDateShort(displayDate));
  }

  if (bean.capacity && bean.remaining) {
    parts.push(
      `${formatNumber(bean.remaining)}/${formatNumber(bean.capacity)}克`
    );
  }

  if (displaySettings.showPrice && bean.price && bean.capacity) {
    const priceText = formatPrice(
      bean.price,
      bean.capacity,
      displaySettings.showTotalPrice
    );
    if (priceText) parts.push(priceText);
  }

  return parts;
};

const getChipBeanName = (
  bean: CoffeeBean,
  displaySettings: BeanDisplaySettings
) => {
  const displayName = formatBeanDisplayName(bean, displaySettings)
    .replace(/\s+/g, ' ')
    .trim();

  return displayName || bean.name.replace(/\s+/g, ' ').trim();
};

const BeanThumbnail: React.FC<{
  bean: CoffeeBean;
  size?: 'xs' | 'sm' | 'md';
}> = ({ bean, size = 'md' }) => {
  const [imageError, setImageError] = React.useState(false);
  const sizeClass =
    size === 'xs' ? 'h-5 w-5' : size === 'sm' ? 'h-9 w-9' : 'h-12 w-12';

  return (
    <div
      className={`relative ${sizeClass} shrink-0 overflow-hidden rounded-[5px] border border-black/5 bg-neutral-200/60 dark:border-white/5 dark:bg-neutral-800`}
    >
      {bean.image && !imageError ? (
        <Image
          src={bean.image}
          alt={bean.name || '咖啡豆图片'}
          fill
          sizes={size === 'xs' ? '20px' : size === 'sm' ? '36px' : '48px'}
          unoptimized
          className="object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs font-medium text-neutral-500 dark:text-neutral-400">
          {getBeanDisplayInitial(bean)}
        </div>
      )}
    </div>
  );
};

interface StackedDrawerProps {
  isOpen: boolean;
  title: string;
  doneLabel?: string;
  doneDisabled?: boolean;
  onCancel: () => void;
  onDone: () => void;
  children: React.ReactNode;
  historyId: string;
  layer?: 'base' | 'top';
}

const StackedDrawer: React.FC<StackedDrawerProps> = ({
  isOpen,
  title,
  doneLabel = '完成',
  doneDisabled = false,
  onCancel,
  onDone,
  children,
  historyId,
  layer = 'base',
}) => {
  useThemeColor({ useOverlay: true, enabled: isOpen });

  useModalHistory({
    id: historyId,
    isOpen,
    onClose: onCancel,
  });

  const overlayZ = layer === 'top' ? 'z-[70]' : 'z-[60]';
  const contentZ = layer === 'top' ? 'z-[71]' : 'z-[61]';

  return (
    <Drawer.Root
      open={isOpen}
      onOpenChange={open => !open && onCancel()}
      repositionInputs={false}
    >
      <Drawer.Portal>
        <Drawer.Overlay className={`fixed inset-0 ${overlayZ} bg-black/50`} />
        <Drawer.Content
          className={`fixed inset-x-0 bottom-0 ${contentZ} mx-auto flex h-[88vh] max-w-md flex-col rounded-t-3xl bg-neutral-50 outline-none dark:bg-neutral-900`}
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          aria-describedby={undefined}
        >
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex shrink-0 items-center justify-between px-6 py-5">
              <button
                type="button"
                onClick={onCancel}
                className="cursor-pointer rounded-full bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-600 transition active:scale-95 dark:bg-neutral-800 dark:text-neutral-300"
              >
                取消
              </button>
              <Drawer.Title className="truncate px-3 text-center text-base font-semibold text-neutral-900 dark:text-neutral-50">
                {title}
              </Drawer.Title>
              <button
                type="button"
                onClick={onDone}
                disabled={doneDisabled}
                className="cursor-pointer rounded-full bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-800 transition active:scale-95 disabled:cursor-default disabled:opacity-30 disabled:active:scale-100 dark:bg-neutral-800 dark:text-neutral-100"
              >
                {doneLabel}
              </button>
            </div>
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
};

interface GroupEditorDrawerProps {
  isOpen: boolean;
  isNewGroup: boolean;
  name: string;
  onNameChange: (name: string) => void;
  selectedBeans: CoffeeBean[];
  onRemoveBean: (beanId: string) => void;
  onOpenBeanPicker: () => void;
  onCancel: () => void;
  onDone: () => void;
  isDeleteConfirming: boolean;
  onDeleteGroup: () => void;
  displaySettings: BeanDisplaySettings;
}

const GroupEditorDrawer: React.FC<GroupEditorDrawerProps> = ({
  isOpen,
  isNewGroup,
  name,
  onNameChange,
  selectedBeans,
  onRemoveBean,
  onOpenBeanPicker,
  onCancel,
  onDone,
  isDeleteConfirming,
  onDeleteGroup,
  displaySettings,
}) => (
  <StackedDrawer
    isOpen={isOpen}
    title={isNewGroup ? '新分组' : '编辑分组'}
    doneDisabled={!name.trim()}
    onCancel={onCancel}
    onDone={onDone}
    historyId="coffee-bean-group-editor-drawer"
  >
    <div className="min-h-0 flex-1 overflow-y-auto">
      <SettingSection title="分组名称">
        <SettingRow vertical>
          <input
            value={name}
            onChange={event => onNameChange(event.target.value)}
            placeholder="输入分组名称"
            className="w-full bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-neutral-50 dark:placeholder:text-neutral-500"
            autoComplete="off"
          />
        </SettingRow>
      </SettingSection>

      <SettingSection title="包含的咖啡豆">
        {selectedBeans.length === 0 ? (
          <button
            type="button"
            onClick={onOpenBeanPicker}
            className="flex w-full cursor-pointer items-center gap-3 px-3.5 py-3.5 text-left transition active:bg-black/5 dark:active:bg-white/5"
          >
            <div className="flex w-9 shrink-0 items-center justify-center text-neutral-500 dark:text-neutral-400">
              <Plus className="h-4 w-4" strokeWidth={2.25} />
            </div>
            <span className="min-w-0 flex-1 text-sm font-medium text-neutral-900 dark:text-neutral-100">
              添加咖啡豆
            </span>
            <ChevronRight className="h-4 w-4 text-neutral-400 dark:text-neutral-500" />
          </button>
        ) : (
          <div>
            <div className="px-3.5">
              <button
                type="button"
                onClick={onOpenBeanPicker}
                className="flex w-full cursor-pointer items-center gap-3 border-b border-black/5 py-3.5 text-left transition active:opacity-70 dark:border-white/5"
              >
                <div className="flex w-9 shrink-0 items-center justify-center text-neutral-500 dark:text-neutral-400">
                  <Plus className="h-4 w-4" strokeWidth={2.25} />
                </div>
                <span className="min-w-0 flex-1 text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  添加咖啡豆
                </span>
                <ChevronRight className="h-4 w-4 text-neutral-400 dark:text-neutral-500" />
              </button>
            </div>

            {selectedBeans.map((bean, index) => {
              const isLast = index === selectedBeans.length - 1;

              return (
                <div key={bean.id} className="px-3.5">
                  <div
                    className={`flex items-center gap-3 py-3 ${
                      isLast
                        ? ''
                        : 'border-b border-black/5 dark:border-white/5'
                    }`}
                  >
                    <BeanThumbnail bean={bean} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        {formatBeanDisplayName(bean, displaySettings)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveBean(bean.id)}
                      className="shrink-0 cursor-pointer rounded-full px-2 py-1 text-sm font-medium text-neutral-500 transition active:bg-black/5 dark:text-neutral-400 dark:active:bg-white/5"
                      title="移除咖啡豆"
                    >
                      删除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SettingSection>

      {!isNewGroup && (
        <SettingSection title="操作">
          <button
            type="button"
            onClick={onDeleteGroup}
            className={`flex w-full cursor-pointer items-center px-3.5 py-3.5 text-left text-sm font-medium transition active:bg-black/5 dark:active:bg-white/5 ${
              isDeleteConfirming
                ? 'text-red-500 dark:text-red-400'
                : 'text-neutral-600 dark:text-neutral-300'
            }`}
          >
            {isDeleteConfirming ? '确认删除' : '删除分组'}
          </button>
        </SettingSection>
      )}
    </div>
  </StackedDrawer>
);

interface BeanPickerDrawerProps {
  isOpen: boolean;
  beans: CoffeeBean[];
  selectedIds: string[];
  onSelectedIdsChange: (beanIds: string[]) => void;
  onCancel: () => void;
  onDone: () => void;
  displaySettings: BeanDisplaySettings;
}

const BeanPickerDrawer: React.FC<BeanPickerDrawerProps> = ({
  isOpen,
  beans,
  selectedIds,
  onSelectedIdsChange,
  onCancel,
  onDone,
  displaySettings,
}) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [activeSelectedBeanId, setActiveSelectedBeanId] = React.useState<
    string | null
  >(null);
  const [chipScrollShadow, setChipScrollShadow] = React.useState({
    top: false,
    bottom: false,
  });
  const [beanListScrollShadow, setBeanListScrollShadow] = React.useState({
    top: false,
    bottom: false,
  });
  const chipListRef = React.useRef<HTMLDivElement>(null);
  const beanListRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  const selectedIdSet = React.useMemo(
    () => new Set(selectedIds),
    [selectedIds]
  );

  const beanById = React.useMemo(() => {
    const map = new Map<string, CoffeeBean>();
    beans.forEach(bean => map.set(bean.id, bean));
    return map;
  }, [beans]);

  const selectedBeans = React.useMemo(
    () =>
      selectedIds
        .map(beanId => beanById.get(beanId))
        .filter((bean): bean is CoffeeBean => Boolean(bean)),
    [beanById, selectedIds]
  );

  React.useEffect(() => {
    if (!activeSelectedBeanId || selectedIdSet.has(activeSelectedBeanId)) {
      return;
    }

    setActiveSelectedBeanId(null);
  }, [activeSelectedBeanId, selectedIdSet]);

  const updateChipScrollShadow = React.useCallback(() => {
    const element = chipListRef.current;
    if (!element) {
      setChipScrollShadow({ top: false, bottom: false });
      return;
    }

    const canScroll = element.scrollHeight > element.clientHeight + 1;
    setChipScrollShadow({
      top: canScroll && element.scrollTop > 1,
      bottom:
        canScroll &&
        element.scrollTop + element.clientHeight < element.scrollHeight - 1,
    });
  }, []);

  React.useEffect(() => {
    if (selectedBeans.length === 0) {
      setChipScrollShadow({ top: false, bottom: false });
      return;
    }

    const frame = requestAnimationFrame(updateChipScrollShadow);
    return () => cancelAnimationFrame(frame);
  }, [selectedBeans.length, updateChipScrollShadow]);

  const updateBeanListScrollShadow = React.useCallback(() => {
    const element = beanListRef.current;
    if (!element) {
      setBeanListScrollShadow({ top: false, bottom: false });
      return;
    }

    const canScroll = element.scrollHeight > element.clientHeight + 1;
    setBeanListScrollShadow({
      top: canScroll && element.scrollTop > 1,
      bottom:
        canScroll &&
        element.scrollTop + element.clientHeight < element.scrollHeight - 1,
    });
  }, []);

  const filteredBeans = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const selectableBeans = beans.filter(
      bean => bean.beanState !== 'green' && !bean.isInTransit
    );

    const filtered = query
      ? selectableBeans.filter(bean => {
          const displayName = formatBeanDisplayName(
            bean,
            displaySettings
          ).toLowerCase();
          return (
            displayName.includes(query) ||
            bean.name.toLowerCase().includes(query) ||
            bean.roaster?.toLowerCase().includes(query)
          );
        })
      : selectableBeans;

    return sortBeansByFlavorPeriod(filtered).sort((a, b) => {
      const capacityDiff =
        Number(!hasUsableCapacity(a)) - Number(!hasUsableCapacity(b));
      if (capacityDiff !== 0) return capacityDiff;
      return 0;
    });
  }, [beans, displaySettings, searchQuery]);

  React.useEffect(() => {
    const frame = requestAnimationFrame(updateBeanListScrollShadow);
    return () => cancelAnimationFrame(frame);
  }, [filteredBeans.length, updateBeanListScrollShadow]);

  const toggleBean = React.useCallback(
    (beanId: string) => {
      setActiveSelectedBeanId(null);

      if (selectedIdSet.has(beanId)) {
        onSelectedIdsChange(selectedIds.filter(id => id !== beanId));
        return;
      }

      onSelectedIdsChange([...selectedIds, beanId]);
    },
    [onSelectedIdsChange, selectedIdSet, selectedIds]
  );

  const handleSelectedChipClick = React.useCallback(
    (beanId: string) => {
      if (activeSelectedBeanId === beanId) {
        onSelectedIdsChange(selectedIds.filter(id => id !== beanId));
        setActiveSelectedBeanId(null);
        return;
      }

      setActiveSelectedBeanId(beanId);
    },
    [activeSelectedBeanId, onSelectedIdsChange, selectedIds]
  );

  return (
    <StackedDrawer
      isOpen={isOpen}
      title="包含咖啡豆"
      onCancel={onCancel}
      onDone={onDone}
      historyId="coffee-bean-group-bean-picker-drawer"
      layer="top"
    >
      <div className="flex min-h-0 flex-1 flex-col px-6">
        <div
          className={`mb-4 shrink-0 bg-neutral-100 dark:bg-neutral-800 ${
            selectedBeans.length > 0
              ? 'rounded-[22px] px-3 py-3'
              : 'rounded-full'
          }`}
        >
          {selectedBeans.length > 0 && (
            <div className="relative mb-2">
              <div
                ref={chipListRef}
                onScroll={updateChipScrollShadow}
                className="flex max-h-28 flex-wrap gap-2 overflow-y-auto"
              >
                {selectedBeans.map(bean => {
                  const isActive = activeSelectedBeanId === bean.id;
                  const chipName = getChipBeanName(bean, displaySettings);

                  return (
                    <button
                      key={bean.id}
                      type="button"
                      onClick={() => handleSelectedChipClick(bean.id)}
                      title={chipName}
                      className={`flex max-w-full cursor-pointer items-center gap-1.5 rounded-full py-1 pr-3 pl-1.5 text-sm font-medium transition active:scale-[0.98] ${
                        isActive
                          ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                          : 'bg-neutral-200/75 text-neutral-800 dark:bg-neutral-700/70 dark:text-neutral-100'
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full ${
                          isActive
                            ? 'bg-white/15 dark:bg-black/10'
                            : 'bg-neutral-300/60 dark:bg-neutral-600/70'
                        }`}
                      >
                        {isActive ? (
                          <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                        ) : (
                          <BeanThumbnail bean={bean} size="xs" />
                        )}
                      </span>
                      <span className="max-w-28 truncate">
                        {chipName}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div
                className={`pointer-events-none absolute inset-x-0 top-0 h-4 bg-linear-to-b from-neutral-100 to-transparent transition-opacity duration-200 dark:from-neutral-800 ${
                  chipScrollShadow.top ? 'opacity-100' : 'opacity-0'
                }`}
              />
              <div
                className={`pointer-events-none absolute inset-x-0 bottom-0 h-4 bg-linear-to-t from-neutral-100 to-transparent transition-opacity duration-200 dark:from-neutral-800 ${
                  chipScrollShadow.bottom ? 'opacity-100' : 'opacity-0'
                }`}
              />
            </div>
          )}

          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              placeholder="搜索咖啡豆"
              className={`w-full border-none bg-transparent text-sm font-medium text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-neutral-50 dark:placeholder:text-neutral-500 ${
                selectedBeans.length > 0 ? 'h-8 pr-8 pl-8' : 'h-11 pr-10 pl-11'
              }`}
              autoComplete="off"
            />
            <Search
              className={`pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400 dark:text-neutral-500 ${
                selectedBeans.length > 0 ? 'left-1' : 'left-4'
              }`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className={`absolute top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-neutral-400 transition active:bg-black/5 dark:text-neutral-500 dark:active:bg-white/5 ${
                  selectedBeans.length > 0 ? 'right-0' : 'right-3'
                }`}
                title="清除搜索"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="relative min-h-0 flex-1">
          <div
            ref={beanListRef}
            onScroll={updateBeanListScrollShadow}
            className="h-full overflow-y-auto pb-5"
          >
            {filteredBeans.length === 0 ? (
              <div className="px-1 py-6 text-sm text-neutral-500 dark:text-neutral-400">
                {searchQuery.trim() ? '没有找到匹配的咖啡豆' : '还没有咖啡豆'}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredBeans.map(bean => {
                  const selected = selectedIdSet.has(bean.id);
                  const isDepleted = !hasUsableCapacity(bean);
                  const metaParts = getBeanMetaParts(bean, displaySettings);

                  return (
                    <button
                      key={bean.id}
                      type="button"
                      onClick={() => toggleBean(bean.id)}
                      className={`flex w-full cursor-pointer items-center gap-3 text-left transition active:opacity-70 ${
                        isDepleted ? 'opacity-45' : ''
                      }`}
                    >
                      <BeanThumbnail bean={bean} />
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-2 text-xs leading-tight font-medium text-neutral-900 dark:text-neutral-100">
                          {formatBeanDisplayName(bean, displaySettings)}
                        </div>
                        {metaParts.length > 0 && (
                          <div className="mt-1 overflow-hidden text-xs leading-relaxed font-medium text-neutral-500 dark:text-neutral-400">
                            {metaParts.map((part, index) => (
                              <React.Fragment
                                key={`${bean.id}-${part}-${index}`}
                              >
                                {index > 0 && (
                                  <span className="mx-2 text-neutral-400 dark:text-neutral-600">
                                    ·
                                  </span>
                                )}
                                <span className="inline whitespace-nowrap">
                                  {part}
                                </span>
                              </React.Fragment>
                            ))}
                          </div>
                        )}
                      </div>
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
                          selected
                            ? 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-50 dark:bg-neutral-50 dark:text-neutral-900'
                            : 'border-neutral-300 text-transparent dark:border-neutral-600'
                        }`}
                      >
                        <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div
            className={`pointer-events-none absolute inset-x-0 top-0 h-6 bg-linear-to-b from-neutral-50 to-transparent transition-opacity duration-200 dark:from-neutral-900 ${
              beanListScrollShadow.top ? 'opacity-100' : 'opacity-0'
            }`}
          />
          <div
            className={`pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-linear-to-t from-neutral-50 to-transparent transition-opacity duration-200 dark:from-neutral-900 ${
              beanListScrollShadow.bottom ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </div>
      </div>
    </StackedDrawer>
  );
};

const CoffeeBeanGroupSettings: React.FC<CoffeeBeanGroupSettingsProps> = ({
  settings: _settings,
  onClose,
  handleChange: _handleChange,
}) => {
  const settings = useSettingsStore(state => state.settings) as SettingsOptions;
  const updateSettings = useSettingsStore(state => state.updateSettings);
  const beans = useCoffeeBeanStore(state => state.beans);
  const storeInitialized = useCoffeeBeanStore(state => state.initialized);
  const loadBeans = useCoffeeBeanStore(state => state.loadBeans);

  const [isVisible, setIsVisible] = React.useState(false);
  const [draft, setDraft] = React.useState<EditingDraft | null>(null);
  const [pickerSelectedIds, setPickerSelectedIds] = React.useState<string[]>(
    []
  );
  const [isBeanPickerOpen, setIsBeanPickerOpen] = React.useState(false);
  const [isDeleteConfirming, setIsDeleteConfirming] = React.useState(false);

  const onCloseRef = React.useRef(onClose);

  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  React.useEffect(() => {
    if (!storeInitialized) {
      void loadBeans();
    }
  }, [storeInitialized, loadBeans]);

  const handleCloseWithAnimation = React.useCallback(() => {
    setIsVisible(false);
    window.dispatchEvent(new CustomEvent('subSettingsClosing'));
    setTimeout(() => {
      onCloseRef.current();
    }, 350);
  }, []);

  useModalHistory({
    id: 'coffee-bean-group-settings',
    isOpen: true,
    onClose: handleCloseWithAnimation,
  });

  React.useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    });
  }, []);

  const groups = React.useMemo(
    () => normalizeCoffeeBeanGroups(settings.coffeeBeanGroups, beans),
    [settings.coffeeBeanGroups, beans]
  );

  const beanById = React.useMemo(() => {
    const map = new Map<string, CoffeeBean>();
    beans.forEach(bean => map.set(bean.id, bean));
    return map;
  }, [beans]);

  const displaySettings = React.useMemo<BeanDisplaySettings>(
    () => ({
      roasterFieldEnabled: settings.roasterFieldEnabled,
      roasterSeparator: settings.roasterSeparator,
      dateDisplayMode: settings.dateDisplayMode || 'date',
      showPrice: settings.showPrice !== false,
      showTotalPrice: settings.showTotalPrice || false,
    }),
    [
      settings.dateDisplayMode,
      settings.roasterFieldEnabled,
      settings.roasterSeparator,
      settings.showPrice,
      settings.showTotalPrice,
    ]
  );

  const selectedBeans = React.useMemo(() => {
    if (!draft) return [];
    return draft.beanIds
      .map(beanId => beanById.get(beanId))
      .filter((bean): bean is CoffeeBean => Boolean(bean));
  }, [beanById, draft]);

  const updateGroups = React.useCallback(
    async (nextGroups: CoffeeBeanGroup[]) => {
      await updateSettings({ coffeeBeanGroups: nextGroups });
    },
    [updateSettings]
  );

  const triggerHaptic = React.useCallback(() => {
    if (settings.hapticFeedback) {
      hapticsUtils.light();
    }
  }, [settings.hapticFeedback]);

  const openCreateDrawer = React.useCallback(() => {
    setDraft({ groupId: null, name: '', beanIds: [] });
    setIsDeleteConfirming(false);
    triggerHaptic();
  }, [triggerHaptic]);

  const openEditDrawer = React.useCallback(
    (group: CoffeeBeanGroup) => {
      setDraft({
        groupId: group.id,
        name: group.name,
        beanIds: group.beanIds || [],
      });
      setIsDeleteConfirming(false);
      triggerHaptic();
    },
    [triggerHaptic]
  );

  const closeEditor = React.useCallback(() => {
    setIsBeanPickerOpen(false);
    setDraft(null);
    setPickerSelectedIds([]);
    setIsDeleteConfirming(false);
  }, []);

  const saveDraft = React.useCallback(async () => {
    if (!draft) return;

    const name = draft.name.trim();
    if (!name) return;

    const now = Date.now();
    const normalizedBeanIds = Array.from(new Set(draft.beanIds));

    if (draft.groupId) {
      await updateGroups(
        groups.map(group =>
          group.id === draft.groupId
            ? {
                ...group,
                name,
                beanIds: normalizedBeanIds,
                updatedAt: now,
              }
            : group
        )
      );
    } else {
      await updateGroups([
        ...groups,
        {
          id: createGroupId(),
          name,
          beanIds: normalizedBeanIds,
          order: groups.length,
          createdAt: now,
          updatedAt: now,
        },
      ]);
    }

    triggerHaptic();
    closeEditor();
  }, [closeEditor, draft, groups, triggerHaptic, updateGroups]);

  const deleteCurrentGroup = React.useCallback(async () => {
    if (!draft?.groupId) return;

    if (!isDeleteConfirming) {
      setIsDeleteConfirming(true);
      triggerHaptic();
      return;
    }

    await updateGroups(
      groups
        .filter(group => group.id !== draft.groupId)
        .map((group, index) => ({ ...group, order: index }))
    );

    triggerHaptic();
    closeEditor();
  }, [
    closeEditor,
    draft?.groupId,
    groups,
    isDeleteConfirming,
    triggerHaptic,
    updateGroups,
  ]);

  const openBeanPicker = React.useCallback(() => {
    setPickerSelectedIds(draft?.beanIds || []);
    setIsBeanPickerOpen(true);
  }, [draft?.beanIds]);

  const applyPickedBeans = React.useCallback(() => {
    setDraft(current =>
      current ? { ...current, beanIds: pickerSelectedIds } : current
    );
    setIsDeleteConfirming(false);
    setIsBeanPickerOpen(false);
  }, [pickerSelectedIds]);

  const removeBeanFromDraft = React.useCallback((beanId: string) => {
    setIsDeleteConfirming(false);
    setDraft(current =>
      current
        ? { ...current, beanIds: current.beanIds.filter(id => id !== beanId) }
        : current
    );
  }, []);

  const handleClose = () => {
    modalHistory.back();
  };

  return (
    <>
      <SettingPage title="分组" isVisible={isVisible} onClose={handleClose}>
        <SettingSection
          title="分组"
          footer="为不同咖啡豆创建分组，并在筛选分类中快速切换。"
        >
          {groups.length === 0 ? (
            <button
              type="button"
              onClick={openCreateDrawer}
              className="flex w-full cursor-pointer items-center justify-between gap-3 px-3.5 py-3.5 text-left transition active:bg-black/5 dark:active:bg-white/5"
            >
              <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                创建分组
              </span>
              <ChevronRight className="h-4 w-4 text-neutral-400 dark:text-neutral-500" />
            </button>
          ) : (
            <div>
              <div className="px-3.5">
                <button
                  type="button"
                  onClick={openCreateDrawer}
                  className="flex w-full cursor-pointer items-center justify-between gap-3 border-b border-black/5 py-3.5 text-left transition active:opacity-70 dark:border-white/5"
                >
                  <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    创建分组
                  </span>
                  <ChevronRight className="h-4 w-4 text-neutral-400 dark:text-neutral-500" />
                </button>
              </div>

              {groups.map((group, index) => {
                const isLast = index === groups.length - 1;

                return (
                  <div key={group.id} className="px-3.5">
                    <button
                      type="button"
                      onClick={() => openEditDrawer(group)}
                      className={`flex w-full cursor-pointer items-center justify-between gap-3 py-3.5 text-left transition active:opacity-70 ${
                        isLast
                          ? ''
                          : 'border-b border-black/5 dark:border-white/5'
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        {group.name}
                      </span>
                      <span className="shrink-0 text-sm font-medium text-neutral-500 tabular-nums dark:text-neutral-400">
                        {group.beanIds.length} 款
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400 dark:text-neutral-500" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </SettingSection>
      </SettingPage>

      <GroupEditorDrawer
        isOpen={Boolean(draft)}
        isNewGroup={!draft?.groupId}
        name={draft?.name || ''}
        onNameChange={name =>
          setDraft(current => (current ? { ...current, name } : current))
        }
        selectedBeans={selectedBeans}
        onRemoveBean={removeBeanFromDraft}
        onOpenBeanPicker={openBeanPicker}
        onCancel={closeEditor}
        onDone={() => void saveDraft()}
        isDeleteConfirming={isDeleteConfirming}
        onDeleteGroup={() => void deleteCurrentGroup()}
        displaySettings={displaySettings}
      />

      <BeanPickerDrawer
        isOpen={isBeanPickerOpen}
        beans={beans}
        selectedIds={pickerSelectedIds}
        onSelectedIdsChange={setPickerSelectedIds}
        onCancel={() => setIsBeanPickerOpen(false)}
        onDone={applyPickedBeans}
        displaySettings={displaySettings}
      />
    </>
  );
};

export default CoffeeBeanGroupSettings;
