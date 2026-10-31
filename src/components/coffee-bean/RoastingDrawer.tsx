'use client';

import React, { useEffect, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import { ChevronsUpDown } from 'lucide-react';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import { modalHistory } from '@/lib/navigation/modalHistory';
import SettingSelect from '@/components/settings/atomic/SettingSelect';
import SettingSection from '@/components/settings/atomic/SettingSection';
import SettingRow from '@/components/settings/atomic/SettingRow';
import SettingInput from '@/components/settings/atomic/SettingInput';
import { SettingPageLayoutProvider } from '@/components/settings/atomic/SettingPageLayoutContext';
import { DatePicker } from '@/components/common/ui/DatePicker';
import AutoResizeTextarea from '@/components/common/forms/AutoResizeTextarea';
import { useCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { formatBeanDisplayName } from '@/lib/utils/beanVarietyUtils';
import {
  prepareCoffeeBeanRoasterFieldsForFormDraft,
  normalizeFlavorList,
} from '@/lib/utils/coffeeBeanUtils';
import { saveRoastingBatch } from '@/lib/managers/roastingBatchManager';
import {
  roundGrams,
  RoastingValidationError,
} from '@/lib/coffee-beans/roastingBatch';
import { parseCoffeeBeanAmount } from '@/lib/coffee-beans/amount';
import { inferBeanType } from '@/lib/utils/beanTypeInference';
import { getDefaultFlavorPeriodByRoastLevelSync } from '@/lib/utils/flavorPeriodUtils';
import {
  parseBeanName,
  getNextAvailableNumber,
} from '@/lib/coffee-beans/repurchaseNaming';
import {
  getRoastProfileFromAmounts,
  formatRoastMetric,
} from '@/lib/utils/roastProfileUtils';
import type { BrewingNote } from '@/lib/core/config';
import type { CoffeeBean } from '@/types/app';
import { showToast } from '@/components/common/feedback/LightToast';
import {
  useRoastLevelSuggestions,
  useFlavorSuggestions,
} from './Form/hooks/useCoffeeBeanFieldSuggestions';
import TagAutocompleteInput from './Detail/components/TagAutocompleteInput';

interface Props {
  isOpen: boolean;
  sourceIds: string[];
  onClose: () => void;
  onSaved?: (note: BrewingNote) => void;
  canReselect?: boolean;
}

const weightInputPattern = /^\d*(?:\.\d{0,2})?$/;

const getWeightError = (value: string, label: string) => {
  if (!value.trim()) return `请填写${label}`;
  const weight = Number(value);
  if (!Number.isFinite(weight)) return '请输入有效重量';
  if (weight <= 0) return `${label}须大于零`;
  if (Number(weight.toFixed(2)) !== weight) return '最多保留两位小数';
  return undefined;
};

const localDate = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export default function RoastingDrawer({
  isOpen,
  sourceIds,
  onClose,
  onSaved,
  canReselect = false,
}: Props) {
  const beans = useCoffeeBeanStore(state => state.beans);
  const roastLevelSuggestions = useRoastLevelSuggestions();
  const settings = useSettingsStore(state => state.settings);
  const { username, roasterFieldEnabled, roasterSeparator } = settings;
  const namingOptions = { roasterFieldEnabled, separator: roasterSeparator };
  const sources = sourceIds.map(id => beans.find(bean => bean.id === id));
  const namingSource = sources.length === 1 ? sources[0] : undefined;
  const nameFields = {
    name: namingSource
      ? prepareCoffeeBeanRoasterFieldsForFormDraft(namingSource, {
          roasterFieldEnabled: true,
          separator: roasterSeparator,
        }).name
      : sources
          .map(bean =>
            bean
              ? formatBeanDisplayName(bean, {
                  roasterFieldEnabled,
                  roasterSeparator,
                })
              : ''
          )
          .filter(Boolean)
          .join(' + '),
    roaster: username?.trim() ?? '',
  };
  const [customRoaster, setRoaster] = useState<string | null>(null);
  const roaster = customRoaster ?? nameFields.roaster;
  const suggestedName = () => {
    const proposed = nameFields.name;
    const { baseName } = parseBeanName(proposed);
    const namedBeans = beans.map(bean =>
      prepareCoffeeBeanRoasterFieldsForFormDraft(bean, namingOptions)
    );
    return namedBeans.some(
      bean =>
        bean.beanState !== 'green' &&
        parseBeanName(bean.name).baseName === baseName
    )
      ? `${baseName} #${getNextAvailableNumber(baseName, namedBeans)}`
      : baseName;
  };
  const [customName, setName] = useState<string | null>(null);
  const name = customName ?? suggestedName();
  const [date, setDate] = useState(localDate);
  const [amount, setAmount] = useState('');
  const [manualLevel, setLevel] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [beanType, setBeanType] = useState<CoffeeBean['beanType']>(
    sources.length === 1 ? sources[0]?.beanType : undefined
  );
  const [customFlavors, setFlavors] = useState<string[] | null>(null);
  const flavorInputRef = useRef<HTMLInputElement>(null);
  const [flavorScrollElement, setFlavorScrollElement] =
    useState<HTMLDivElement | null>(null);
  const [flavorEdges, setFlavorEdges] = useState({ left: false, right: false });
  useEffect(() => {
    if (!isOpen) return;
    const element = flavorScrollElement;
    if (!element) return;
    const update = () => {
      const left = element.scrollLeft > 1;
      const right =
        element.scrollLeft + element.clientWidth < element.scrollWidth - 1;
      setFlavorEdges(current =>
        current.left === left && current.right === right
          ? current
          : { left, right }
      );
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    element.addEventListener('scroll', update, { passive: true });
    update();
    return () => {
      observer.disconnect();
      element.removeEventListener('scroll', update);
    };
  }, [isOpen, flavorScrollElement]);
  const flavors =
    customFlavors ??
    normalizeFlavorList(
      sources.flatMap(source => source?.flavor ?? [])
    );
  useEffect(() => {
    if (!isOpen) return;
    const frame = requestAnimationFrame(() => {
      const element = flavorScrollElement;
      if (element) element.scrollLeft = element.scrollWidth;
    });
    return () => cancelAnimationFrame(frame);
  }, [isOpen, flavors.length, flavorScrollElement]);
  const flavorSuggestions = useFlavorSuggestions();
  const suggestedFlavors = normalizeFlavorList([
    ...sources.flatMap(source => source?.flavor ?? []),
    ...flavorSuggestions.suggestions,
  ]).filter(flavor => !flavors.includes(flavor));
  const addFlavors = (value: string) =>
    setFlavors(
      normalizeFlavorList([...flavors, ...normalizeFlavorList(value)])
    );
  const [inputWeights, setInputWeights] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const handleBack = () => {
    if (savingRef.current) return;
    setSubmitted(false);
    modalHistory.back();
  };
  const inputs = sourceIds.map(id => ({
    greenBeanId: id,
    amount: Number(inputWeights[id] ?? ''),
  }));
  const inputTotal = inputs.every(
    input => Number.isFinite(input.amount) && input.amount >= 0
  )
    ? roundGrams(inputs.reduce((sum, input) => sum + input.amount, 0))
    : NaN;
  const level =
    manualLevel ??
    (inputs.length > 0 &&
    inputs.every(input => Number.isFinite(input.amount) && input.amount > 0) &&
    Number.isFinite(inputTotal) &&
    Number(amount) > 0 &&
    Number(amount) <= inputTotal
      ? getRoastProfileFromAmounts(inputTotal, Number(amount)).roastLevel
      : '');
  const presetPeriod = getDefaultFlavorPeriodByRoastLevelSync(
    level,
    settings.customFlavorPeriod,
    roaster.trim()
  );
  const [customPeriod, setCustomPeriod] = useState<{
    level: string;
    roaster: string;
    startDay: string;
    endDay: string;
  } | null>(null);
  const period =
    customPeriod?.level === level && customPeriod.roaster === roaster.trim()
      ? customPeriod
      : {
          startDay: String(presetPeriod.startDay),
          endDay: String(presetPeriod.endDay),
        };
  const title = sourceIds.length > 1 ? '拼配烘焙' : '烘焙';
  const validateFields = () => {
    const fieldErrors: Record<string, string> = {};
    if (!name.trim()) fieldErrors.name = '请填写咖啡豆名称';
    if (!date) {
      fieldErrors.date = '请选择烘焙日期';
    } else if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date
    ) {
      fieldErrors.date = '请选择有效的烘焙日期';
    }
    inputs.forEach((input, index) => {
      const source = sources[index];
      const remaining = parseCoffeeBeanAmount(source?.remaining);
      const available = remaining;
      const weightError = getWeightError(
        inputWeights[input.greenBeanId] ?? '',
        '投豆量'
      );
      if (!source) {
        fieldErrors[input.greenBeanId] = '来源生豆已删除，请重新选择';
      } else if (source.beanState !== 'green') {
        fieldErrors[input.greenBeanId] = '来源已不是生豆，请重新选择';
      } else if (source.isInTransit) {
        fieldErrors[input.greenBeanId] = '生豆尚未到货';
      } else if (weightError) {
        fieldErrors[input.greenBeanId] = weightError;
      } else if (available === null || input.amount > available) {
        fieldErrors[input.greenBeanId] =
          available === null
            ? '生豆库存无效'
            : `库存不足，可用 ${roundGrams(available)}g`;
      }
    });
    const weight = Number(amount);
    const outputError = getWeightError(amount, '出豆量');
    if (outputError) {
      fieldErrors.amount = outputError;
    } else if (
      inputs.length > 0 &&
      inputs.every(input => !fieldErrors[input.greenBeanId]) &&
      weight > inputTotal
    ) {
      fieldErrors.amount = '出豆量不能超过投豆量';
    }
    return fieldErrors;
  };
  const save = async () => {
    if (savingRef.current) return;
    setSubmitted(true);
    const errors = validateFields();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    if (!inputs.length) {
      setFieldErrors({ form: '请先选择生豆' });
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      const result = await saveRoastingBatch({
        noteId: nanoid(),
        beanId: nanoid(),
        draft: {
          inputs,
          startDay: Number(period.startDay),
          endDay: Number(period.endDay),
          name,
          roaster,
          roastDate: date,
          outputAmount: Number(amount),
          roastLevel: level,
          beanType: beanType ?? null,
          notes,
          flavor: normalizeFlavorList([
            ...flavors,
            ...normalizeFlavorList(flavorInputRef.current?.value ?? ''),
          ]),
        },
      });
      showToast({
        type: 'success',
        title: '烘焙记录已保存，熟豆已入库',
      });
      if (result.note) onSaved?.(result.note);
      onClose();
    } catch (error) {
      setFieldErrors({
        [error instanceof RoastingValidationError ? error.field : 'form']:
          error instanceof Error ? error.message : '保存失败，请重试',
      });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  return (
    <ActionDrawer
      isOpen={isOpen}
      title={title}
      onClose={onClose}
      dismissible={!saving}
      historyId="roasting-drawer"
      onExitComplete={() => {
        setSubmitted(false);
      }}
    >
      <div className="-mx-6 -mt-6 max-h-[calc(60dvh+1.5rem)] overflow-y-auto rounded-t-3xl">
        <div
          aria-hidden="true"
          className="fade-mask-to-b pointer-events-none sticky top-0 z-10 h-6 bg-white dark:bg-neutral-900"
        />
        <SettingPageLayoutProvider mode="overlay">
          <fieldset disabled={saving} className="min-w-0">
            <SettingSection contentShape="card" className="pb-3!">
              {roasterFieldEnabled && (
                <SettingRow label="烘焙商" expandControl>
                  <SettingInput
                    aria-label="烘焙商"
                    value={roaster}
                    onChange={event => setRoaster(event.target.value)}
                    placeholder="烘焙商名称"
                  />
                </SettingRow>
              )}
              <SettingRow
                label="咖啡豆名称"
                required
                error={submitted ? fieldErrors.name : undefined}
                errorId="roasting-name-error"
                expandControl
              >
                <SettingInput
                  aria-label="咖啡豆名称"
                  required
                  aria-invalid={submitted && !!fieldErrors.name}
                  aria-describedby={
                    submitted && fieldErrors.name
                      ? 'roasting-name-error'
                      : undefined
                  }
                  value={name}
                  onChange={event => setName(event.target.value)}
                  placeholder="咖啡豆名称"
                />
              </SettingRow>
            </SettingSection>
            <SettingSection contentShape="card" className="pb-3!">
              {sources.map((source, index) => {
                const id = sourceIds[index];
                const grams = inputs[index].amount;
                const sourceName = source
                  ? formatBeanDisplayName(source, {
                      roasterFieldEnabled,
                      roasterSeparator,
                    })
                  : '来源已删除';
                return (
                  <SettingRow
                    key={id}
                    error={submitted ? fieldErrors[id] : undefined}
                    errorId={`roasting-input-${id}-error`}
                    label={sourceIds.length === 1 ? '投豆量' : sourceName}
                    required
                    labelSuffix={
                      sourceIds.length > 1
                        ? `（${inputTotal > 0 && Number.isFinite(inputTotal) ? formatRoastMetric((grams / inputTotal) * 100) : '—'}%）`
                        : undefined
                    }
                  >
                    <div className="flex h-4 w-24 items-center gap-2">
                      <SettingInput
                        aria-label={`${sourceName}投豆量（克）`}
                        aria-invalid={submitted && !!fieldErrors[id]}
                        aria-describedby={
                          submitted && fieldErrors[id]
                            ? `roasting-input-${id}-error`
                            : undefined
                        }
                        required
                        inputMode="decimal"
                        value={inputWeights[id] ?? ''}
                        onChange={event => {
                          const value = event.target.value;
                          if (!weightInputPattern.test(value)) return;
                          setInputWeights(current => ({
                            ...current,
                            [id]: value,
                          }));
                        }}
                        placeholder="填写重量"
                      />
                      <span className="w-4 shrink-0 text-center text-sm leading-none text-neutral-500">
                        g
                      </span>
                    </div>
                  </SettingRow>
                );
              })}
              {sourceIds.length > 1 && (
                <SettingRow label="投豆量" isSubSetting>
                  <output
                    aria-label="投豆量合计"
                    aria-live="polite"
                    className="flex h-4 w-24 items-center justify-end gap-2 text-sm leading-none text-neutral-500"
                  >
                    <span>
                      {Number.isFinite(inputTotal) ? inputTotal : '—'}
                    </span>
                    <span className="w-4 shrink-0 text-center">g</span>
                  </output>
                </SettingRow>
              )}
              <SettingRow
                label="出豆量"
                required
                error={submitted ? fieldErrors.amount : undefined}
                errorId="roasting-amount-error"
              >
                <div className="flex h-4 w-24 items-center gap-2">
                  <SettingInput
                    aria-label="出豆量（克）"
                    aria-invalid={submitted && !!fieldErrors.amount}
                    aria-describedby={
                      submitted && fieldErrors.amount
                        ? 'roasting-amount-error'
                        : undefined
                    }
                    required
                    inputMode="decimal"
                    value={amount}
                    onChange={event => {
                      const value = event.target.value;
                      if (!weightInputPattern.test(value)) return;
                      setAmount(value);
                      if (beanType !== 'omni') {
                        const inferredType = inferBeanType(value);
                        if (inferredType) setBeanType(inferredType);
                      }
                    }}
                    placeholder="填写重量"
                  />
                  <span className="w-4 shrink-0 text-center text-sm leading-none text-neutral-500">
                    g
                  </span>
                </div>
              </SettingRow>
            </SettingSection>
            <SettingSection contentShape="card" className="pb-3!">
              <SettingRow label="烘焙度">
                <SettingSelect
                  ariaLabel="烘焙度"
                  value={level || 'unset'}
                  options={[
                    { value: 'unset', label: '未填写' },
                    ...Array.from(
                      new Set([
                        ...roastLevelSuggestions.suggestions,
                        ...(level ? [level] : []),
                      ])
                    ).map(value => ({ value, label: value })),
                  ]}
                  onChange={value => setLevel(value === 'unset' ? '' : value)}
                  disabled={saving}
                />
              </SettingRow>
              <SettingRow label="赏味期">
                <div className="grid h-4 grid-cols-[3ch_auto_3ch_auto] items-center gap-2">
                  <SettingInput
                    aria-label="赏味期开始天数"
                    style={{ textAlign: 'center' }}
                    inputMode="numeric"
                    value={period.startDay}
                    placeholder="天数"
                    disabled={saving}
                    onChange={event => {
                      if (!/^\d*$/.test(event.target.value)) return;
                      setCustomPeriod({
                        ...period,
                        level,
                        roaster: roaster.trim(),
                        startDay: event.target.value,
                      });
                    }}
                  />
                  <span className="text-sm text-neutral-400">–</span>
                  <SettingInput
                    aria-label="赏味期结束天数"
                    style={{ textAlign: 'center' }}
                    inputMode="numeric"
                    value={period.endDay}
                    placeholder="天数"
                    disabled={saving}
                    onChange={event => {
                      if (!/^\d*$/.test(event.target.value)) return;
                      setCustomPeriod({
                        ...period,
                        level,
                        roaster: roaster.trim(),
                        endDay: event.target.value,
                      });
                    }}
                  />
                  <span className="shrink-0 text-sm text-neutral-500">天</span>
                </div>
              </SettingRow>
              <SettingRow
                label="烘焙日期"
                required
                error={submitted ? fieldErrors.date : undefined}
                errorId="roasting-date-error"
              >
                <DatePicker
                  ariaLabel="烘焙日期"
                  aria-invalid={submitted && !!fieldErrors.date}
                  aria-describedby={
                    submitted && fieldErrors.date
                      ? 'roasting-date-error'
                      : undefined
                  }
                  date={new Date(`${date}T12:00:00`)}
                  onDateChange={selected =>
                    setDate(
                      `${selected.getFullYear()}-${String(selected.getMonth() + 1).padStart(2, '0')}-${String(selected.getDate()).padStart(2, '0')}`
                    )
                  }
                  disabled={saving}
                  triggerClassName="h-4 justify-end gap-2 border-0 p-0 text-sm leading-none font-normal whitespace-nowrap text-neutral-600 dark:text-neutral-300 [&>span]:text-inherit"
                  triggerIcon={
                    <ChevronsUpDown
                      aria-hidden="true"
                      className="size-4 shrink-0 text-neutral-400 dark:text-neutral-500"
                    />
                  }
                  contentClassName="z-90"
                />
              </SettingRow>
              <SettingRow label="类型">
                <SettingSelect
                  ariaLabel="类型"
                  value={beanType ?? 'unset'}
                  options={[
                    { value: 'unset', label: '未填写' },
                    { value: 'filter', label: '手冲' },
                    { value: 'espresso', label: '意式' },
                    { value: 'omni', label: '全能' },
                  ]}
                  onChange={value =>
                    setBeanType(value === 'unset' ? undefined : value)
                  }
                  disabled={saving}
                />
              </SettingRow>
              <SettingRow label="风味" expandControl>
                <div className="relative -my-1 h-6 w-full min-w-0">
                  <div
                    ref={setFlavorScrollElement}
                    data-vaul-no-drag
                    onPointerDown={event => event.stopPropagation()}
                    onFocusCapture={event =>
                      event.target.scrollIntoView({
                        block: 'nearest',
                        inline: 'nearest',
                      })
                    }
                    className="scrollbar-hide h-6 w-full min-w-0 overflow-x-auto overflow-y-hidden"
                  >
                    <div className="flex h-6 w-max min-w-full items-center justify-end gap-1 [&>*]:shrink-0">
                      {flavors.map((flavor, index) => (
                        <span
                          key={flavor}
                          contentEditable={!saving}
                          suppressContentEditableWarning
                          role="textbox"
                          aria-label={`修改风味：${flavor}`}
                          onKeyDown={event => {
                            if (
                              event.key === 'Enter' &&
                              !event.nativeEvent.isComposing
                            ) {
                              event.preventDefault();
                              event.currentTarget.blur();
                            }
                          }}
                          onBlur={event => {
                            const value = event.currentTarget.textContent ?? '';
                            if (value === flavor) return;
                            setFlavors(
                              normalizeFlavorList([
                                ...flavors.slice(0, index),
                                ...normalizeFlavorList(value),
                                ...flavors.slice(index + 1),
                              ])
                            );
                          }}
                          className="inline-flex h-6 cursor-text items-center rounded-sm bg-neutral-200/60 px-1.5 text-sm leading-4 font-normal whitespace-nowrap text-neutral-600 select-text focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-neutral-600 dark:bg-neutral-700/40 dark:text-neutral-300 dark:focus-visible:outline-neutral-300"
                        >
                          {flavor}
                        </span>
                      ))}
                      <TagAutocompleteInput
                        ref={flavorInputRef}
                        ariaLabel="添加风味"
                        className="h-4 appearance-none rounded-none border-0 bg-transparent p-0 text-right text-sm leading-none font-normal text-neutral-600 shadow-none dark:bg-transparent dark:text-neutral-300"
                        placeholder={
                          flavors.length ? '+ ' : '输入风味，逗号分隔'
                        }
                        suggestions={suggestedFlavors}
                        onCommit={addFlavors}
                        isCustomPreset={flavorSuggestions.isRemovableSuggestion}
                        onRemovePreset={flavorSuggestions.removeSuggestion}
                        onBackspaceEmpty={() => {
                          const last = flavors[flavors.length - 1];
                          setFlavors(flavors.slice(0, -1));
                          return last;
                        }}
                      />
                    </div>
                  </div>
                  <div
                    aria-hidden="true"
                    className={`fade-mask-to-r pointer-events-none absolute inset-y-0 left-0 z-10 w-4 bg-neutral-100 transition-opacity duration-200 dark:bg-neutral-900 ${flavorEdges.left ? 'opacity-100' : 'opacity-0'}`}
                  />
                  <div
                    aria-hidden="true"
                    className={`fade-mask-to-l pointer-events-none absolute inset-y-0 right-0 z-10 w-4 bg-neutral-100 transition-opacity duration-200 dark:bg-neutral-900 ${flavorEdges.right ? 'opacity-100' : 'opacity-0'}`}
                  />
                </div>
              </SettingRow>
              <SettingRow vertical>
                <AutoResizeTextarea
                  id="roasting-notes"
                  aria-label="本次烘焙备注"
                  value={notes}
                  onChange={event => setNotes(event.target.value)}
                  minRows={1}
                  placeholder="备注"
                  className="block text-sm leading-4 text-neutral-600 placeholder:text-neutral-400 dark:text-neutral-300"
                />
              </SettingRow>
            </SettingSection>
            {submitted && fieldErrors.form && (
              <p
                role="alert"
                className="px-3.5 pb-3.5 text-xs text-red-600 dark:text-red-400"
              >
                {fieldErrors.form}
              </p>
            )}
          </fieldset>
        </SettingPageLayoutProvider>
        <div
          aria-hidden="true"
          className="fade-mask-to-t pointer-events-none sticky bottom-0 z-10 -mt-4 h-4 bg-white dark:bg-neutral-900"
        />
      </div>
      <ActionDrawer.Actions>
        <ActionDrawer.SecondaryButton onClick={handleBack} disabled={saving}>
          {canReselect ? '返回选豆' : '取消'}
        </ActionDrawer.SecondaryButton>
        <ActionDrawer.PrimaryButton onClick={save} disabled={saving}>
          {saving ? '保存中…' : '确认烘焙'}
        </ActionDrawer.PrimaryButton>
      </ActionDrawer.Actions>
    </ActionDrawer>
  );
}

export function RoastingDrawerHost() {
  const [isOpen, setIsOpen] = useState(false);
  const [request, setRequest] = useState<{
    sourceIds: string[];
    key: number;
  } | null>(null);
  useEffect(() => {
    const open = (event: Event) => {
      setRequest({
        ...(event as CustomEvent<Omit<NonNullable<typeof request>, 'key'>>)
          .detail,
        key: Date.now(),
      });
      setIsOpen(true);
    };
    window.addEventListener('openRoastingDrawer', open);
    return () => window.removeEventListener('openRoastingDrawer', open);
  }, []);
  return request ? (
    <RoastingDrawer
      key={request.key}
      sourceIds={request.sourceIds}
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
    />
  ) : null;
}
