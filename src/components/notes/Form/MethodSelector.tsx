'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Method } from '@/lib/core/config';
import GrindSizeInput from '@/components/ui/GrindSizeInput';
import { useSettingsStore } from '@/lib/stores/settingsStore';

interface MethodSelectorProps {
  selectedEquipment: string;
  selectedMethod: string;
  customMethods: Method[];
  commonMethods: Method[];
  onMethodSelect: (methodId: string) => void;
  onParamsChange: (method: Method) => void;
  grinderDefaultSyncEnabled?: boolean;
}

interface EditingValues {
  coffee: string;
  ratio: string;
  grindSize: string;
  water: string;
  time: string;
  temp: string;
}

// 从带单位的字符串中提取数字
const extractNumber = (str: string): string => {
  const match = str.match(/(\d+(\.\d+)?)/);
  return match ? match[0] : '';
};

// 从 "1:15" 格式中提取比例数字
const extractRatioNumber = (ratio: string): string => {
  const match = ratio.match(/1:(\d+(\.\d+)?)/);
  return match ? match[1] : '';
};

// 根据粉量和比例计算水量
const calculateWater = (coffee: string, ratio: string): string => {
  if (!coffee || !ratio) return '';
  const coffeeVal = parseFloat(coffee);
  const ratioVal = parseFloat(ratio);
  if (isNaN(coffeeVal) || isNaN(ratioVal) || coffeeVal <= 0 || ratioVal <= 0)
    return '';
  return String(Math.round(coffeeVal * ratioVal));
};

// 从 Method 提取编辑值
const extractEditingValues = (method: Method): EditingValues => ({
  coffee: extractNumber(method.params.coffee),
  ratio: extractRatioNumber(method.params.ratio),
  grindSize: method.params.grindSize || '',
  water: extractNumber(method.params.water),
  time: method.params.stages?.[0]?.time?.toString() ?? '',
  temp: extractNumber(method.params.temp || ''),
});

const MethodSelector: React.FC<MethodSelectorProps> = ({
  selectedEquipment,
  selectedMethod,
  customMethods,
  commonMethods,
  onMethodSelect,
  onParamsChange,
  grinderDefaultSyncEnabled = true,
}) => {
  const isEspresso =
    selectedEquipment.toLowerCase().includes('espresso') ||
    selectedEquipment.includes('意式');

  const [editingValues, setEditingValues] = useState<EditingValues | null>(
    null
  );

  // 记录当前初始化的方案，避免重复初始化
  const initializedMethodRef = useRef<string | null>(null);

  // Store 方法 - 使用 stable selector
  const setMethodParamOverride = useSettingsStore(
    state => state.setMethodParamOverride
  );
  const clearMethodParamOverride = useSettingsStore(
    state => state.clearMethodParamOverride
  );
  // 直接获取 methodParamOverrides 对象
  const methodParamOverrides = useSettingsStore(
    state => state.settings.methodParamOverrides
  );

  const allMethods = [...customMethods, ...commonMethods];

  const findMethod = useCallback(
    (methodId: string): Method | undefined =>
      allMethods.find(m => m.id === methodId || m.name === methodId),
    [allMethods]
  );

  // 检查是否有覆盖参数
  const hasOverride = useCallback(
    (methodId: string): boolean => {
      if (!selectedEquipment || !methodId) return false;
      const key = `${selectedEquipment}:${methodId}`;
      return methodParamOverrides?.[key] != null;
    },
    [selectedEquipment, methodParamOverrides]
  );

  // 获取覆盖参数
  const getOverride = useCallback(
    (methodId: string) => {
      if (!selectedEquipment || !methodId) return null;
      const key = `${selectedEquipment}:${methodId}`;
      return methodParamOverrides?.[key] ?? null;
    },
    [selectedEquipment, methodParamOverrides]
  );

  // 初始化编辑值 - 仅在方案变化时执行
  useEffect(() => {
    if (!selectedMethod || !selectedEquipment) return;

    // 如果已经初始化过这个方案，不再重复
    const initKey = `${selectedEquipment}:${selectedMethod}`;
    if (initializedMethodRef.current === initKey) return;

    const method = findMethod(selectedMethod);
    if (!method) return;

    initializedMethodRef.current = initKey;

    const override = getOverride(selectedMethod);
    if (override) {
      // 有覆盖参数，使用覆盖值（包括空字符串）
      setEditingValues({
        coffee: extractNumber(override.coffee ?? method.params.coffee),
        ratio: extractRatioNumber(override.ratio ?? method.params.ratio),
        grindSize: override.grindSize ?? method.params.grindSize ?? '',
        water: extractNumber(override.water ?? method.params.water),
        time: method.params.stages?.[0]?.time?.toString() ?? '',
        temp: extractNumber(override.temp ?? method.params.temp ?? ''),
      });
    } else {
      // 无覆盖，使用原始值
      setEditingValues(extractEditingValues(method));
    }

    // 通知父组件
    const effectiveMethod = override
      ? {
          ...method,
          params: {
            ...method.params,
            coffee: override.coffee ?? method.params.coffee,
            water: override.water ?? method.params.water,
            ratio: override.ratio ?? method.params.ratio,
            grindSize: override.grindSize ?? method.params.grindSize,
            temp: override.temp ?? method.params.temp,
          },
        }
      : method;
    onParamsChange(effectiveMethod);
  }, [
    selectedMethod,
    selectedEquipment,
    findMethod,
    getOverride,
    onParamsChange,
  ]);

  // 处理方案选择
  const handleMethodClick = useCallback(
    (methodId: string) => {
      if (methodId === selectedMethod) return;

      // 重置初始化标记，允许新方案初始化
      initializedMethodRef.current = null;
      onMethodSelect(methodId);
    },
    [selectedMethod, onMethodSelect]
  );

  // 还原方案参数
  const handleResetParams = useCallback(
    async (method: Method) => {
      const methodId = method.id || method.name;
      await clearMethodParamOverride(selectedEquipment, methodId);
      setEditingValues(extractEditingValues(method));
      onParamsChange(method);
    },
    [selectedEquipment, clearMethodParamOverride, onParamsChange]
  );

  // 参数更新 - 简单直接，不做过多干涉
  const updateParam = useCallback(
    (key: keyof EditingValues, value: string) => {
      const method = findMethod(selectedMethod);
      if (!method || !editingValues) return;

      // 直接更新编辑值
      const newValues = { ...editingValues, [key]: value };

      // 非意式：修改粉量或比例时自动计算水量
      if (!isEspresso && (key === 'coffee' || key === 'ratio')) {
        const water = calculateWater(newValues.coffee, newValues.ratio);
        if (water) newValues.water = water;
      }

      setEditingValues(newValues);

      // 构建方案参数
      const updatedMethod: Method = {
        ...method,
        params: {
          ...method.params,
          coffee: newValues.coffee ? `${newValues.coffee}g` : '',
          water: newValues.water ? `${newValues.water}g` : '',
          ratio: newValues.ratio ? `1:${newValues.ratio}` : '',
          grindSize: newValues.grindSize,
          temp: newValues.temp ? `${newValues.temp}°C` : '',
          stages: method.params.stages?.map((s, i) => ({
            ...s,
            time:
              i === 0 && newValues.time
                ? parseFloat(newValues.time) || 0
                : s.time,
          })),
        },
      };

      // 保存覆盖参数
      const methodId = method.id || method.name;
      setMethodParamOverride(selectedEquipment, methodId, {
        coffee: updatedMethod.params.coffee,
        water: updatedMethod.params.water,
        ratio: updatedMethod.params.ratio,
        grindSize: updatedMethod.params.grindSize,
        temp: updatedMethod.params.temp,
      });

      onParamsChange(updatedMethod);
    },
    [
      findMethod,
      selectedMethod,
      editingValues,
      isEspresso,
      selectedEquipment,
      setMethodParamOverride,
      onParamsChange,
    ]
  );

  // 渲染参数输入框
  const renderInput = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    unit?: string,
    width = 'w-12',
    prefix?: string
  ) => (
    <div className="flex items-center">
      <label className="w-14 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
        {label}:
      </label>
      <div className="flex items-center">
        {prefix && (
          <span className="mr-0.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {prefix}
          </span>
        )}
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={e => onChange(e.target.value)}
          className={`${width} rounded-sm border border-neutral-300 bg-white px-1 py-0.5 text-left text-xs font-medium text-neutral-800 focus:ring-1 focus:ring-neutral-500 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100`}
        />
        {unit && (
          <span className="ml-0.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {unit}
          </span>
        )}
      </div>
    </div>
  );

  // 渲染参数显示
  const renderDisplay = (label: string, value: string) => (
    <div className="flex items-center">
      <span className="w-14 text-xs font-medium">{label}:</span>
      <span className="text-xs font-medium">{value || '-'}</span>
    </div>
  );

  // 渲染方案
  const renderMethod = (method: Method) => {
    const methodId = method.id || method.name;
    const isSelected =
      selectedMethod === methodId || selectedMethod === method.name;
    const override = getOverride(methodId);

    // 显示参数：优先使用覆盖值（包括空字符串）
    const displayParams = override
      ? {
          coffee: override.coffee ?? method.params.coffee,
          water: override.water ?? method.params.water,
          ratio: override.ratio ?? method.params.ratio,
          grindSize: override.grindSize ?? method.params.grindSize,
          temp: override.temp ?? method.params.temp,
        }
      : method.params;

    return (
      <div key={methodId} className="group relative">
        <div
          className={`group relative border-l ${
            isSelected
              ? 'border-neutral-800/50 dark:border-white'
              : 'border-neutral-200/50 dark:border-neutral-800/50'
          } cursor-pointer pl-6`}
          onClick={() => handleMethodClick(methodId)}
        >
          {isSelected && (
            <div className="absolute top-0 -left-px h-full w-px bg-neutral-800 dark:bg-white" />
          )}

          <div className="flex items-baseline justify-between">
            <div className="flex items-center gap-1">
              <h3 className="truncate text-xs font-medium tracking-wider text-neutral-800 dark:text-neutral-100">
                {method.name}
              </h3>
              {isSelected && hasOverride(methodId) && (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    handleResetParams(method);
                  }}
                  className="text-xs font-medium text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
                >
                  [还原]
                </button>
              )}
            </div>
          </div>

          {!isSelected ? (
            <div className="mt-1.5 space-y-0.5 text-neutral-500 dark:text-neutral-400">
              {renderDisplay('咖啡粉', displayParams.coffee)}
              {isEspresso ? (
                <>
                  {renderDisplay('研磨度', displayParams.grindSize)}
                  {renderDisplay(
                    '萃取时长',
                    `${method.params.stages?.[0]?.duration || 0}s`
                  )}
                  {renderDisplay('液重', displayParams.water)}
                </>
              ) : (
                <>
                  {renderDisplay('粉水比', displayParams.ratio)}
                  {renderDisplay('研磨度', displayParams.grindSize)}
                  {renderDisplay('水温', displayParams.temp || '-')}
                </>
              )}
            </div>
          ) : (
            <div
              className="mt-2 border-t border-dashed border-neutral-200/50 pt-2 dark:border-neutral-700"
              onClick={e => e.stopPropagation()}
            >
              <div className="space-y-2">
                {renderInput(
                  '咖啡粉',
                  editingValues?.coffee ?? '',
                  v => updateParam('coffee', v),
                  'g'
                )}
                {isEspresso ? (
                  <>
                    <div className="flex items-center">
                      <label className="w-14 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                        研磨度:
                      </label>
                      <GrindSizeInput
                        value={editingValues?.grindSize ?? ''}
                        onChange={v => updateParam('grindSize', v)}
                        className="flex items-center"
                        inputClassName="min-w-12 rounded-sm border border-neutral-300 bg-white px-1 py-0.5 text-left text-xs font-medium text-neutral-800 focus:ring-1 focus:ring-neutral-500 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                        autoWidth
                        defaultSyncEnabled={grinderDefaultSyncEnabled}
                        dropdownPlacement="right"
                      />
                    </div>
                    {renderInput(
                      '萃取时长',
                      editingValues?.time ?? '',
                      v => updateParam('time', v),
                      's'
                    )}
                    {renderInput(
                      '液重',
                      editingValues?.water ?? '',
                      v => updateParam('water', v),
                      'g'
                    )}
                  </>
                ) : (
                  <>
                    {renderInput(
                      '粉水比',
                      editingValues?.ratio ?? '',
                      v => updateParam('ratio', v),
                      undefined,
                      'w-10',
                      '1:'
                    )}
                    <div className="flex items-center">
                      <label className="w-14 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                        研磨度:
                      </label>
                      <GrindSizeInput
                        value={editingValues?.grindSize ?? ''}
                        onChange={v => updateParam('grindSize', v)}
                        className="flex items-center"
                        inputClassName="min-w-12 rounded-sm border border-neutral-300 bg-white px-1 py-0.5 text-left text-xs font-medium text-neutral-800 focus:ring-1 focus:ring-neutral-500 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                        autoWidth
                        defaultSyncEnabled={grinderDefaultSyncEnabled}
                        dropdownPlacement="right"
                      />
                    </div>
                    {renderInput(
                      '水温',
                      editingValues?.temp ?? '',
                      v => updateParam('temp', v),
                      '°C'
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const hasMethods = customMethods.length > 0 || commonMethods.length > 0;
  const showDivider = customMethods.length > 0 && commonMethods.length > 0;

  return (
    <div className="py-3">
      {!selectedEquipment ? (
        <div className="border-l border-neutral-200/50 pl-6 text-xs text-neutral-500 dark:border-neutral-800/50 dark:text-neutral-400">
          请先选择器具
        </div>
      ) : !hasMethods ? (
        <div className="border-l border-neutral-200/50 pl-6 text-xs text-neutral-500 dark:border-neutral-800/50 dark:text-neutral-400">
          没有可用的冲煮方案，请前往&ldquo;冲煮&rdquo;页面添加
        </div>
      ) : (
        <div className="space-y-5">
          {customMethods.map(renderMethod)}
          {showDivider && (
            <div className="flex items-center py-3">
              <div className="h-px grow bg-neutral-200 dark:bg-neutral-800" />
              <span className="px-2 text-xs text-neutral-500 dark:text-neutral-400">
                通用方案
              </span>
              <div className="h-px grow bg-neutral-200 dark:bg-neutral-800" />
            </div>
          )}
          {commonMethods.map(renderMethod)}
        </div>
      )}
    </div>
  );
};

export default MethodSelector;
