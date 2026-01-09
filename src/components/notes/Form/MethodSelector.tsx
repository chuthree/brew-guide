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
  /** 磨豆机同步默认开关状态 */
  grinderDefaultSyncEnabled?: boolean;
}

// 工具函数
const extractNumber = (str: string): string => {
  const match = str.match(/(\d+(\.\d+)?)/);
  return match ? match[0] : '';
};

const extractRatioNumber = (ratio: string): string => {
  const match = ratio.match(/1:(\d+(\.\d+)?)/);
  return match ? match[1] : '';
};

const calculateWater = (coffee: string, ratio: string): string => {
  if (!coffee || !ratio || coffee === '.' || ratio === '.') return '';
  const coffeeValue = parseFloat(coffee);
  const ratioValue = parseFloat(ratio);
  if (isNaN(coffeeValue) || isNaN(ratioValue) || coffeeValue <= 0) return '';
  return `${Math.round(coffeeValue * ratioValue)}g`;
};

/**
 * 根据原始方案和覆盖参数，构建完整的方案对象
 */
const buildMethodWithOverride = (
  method: Method,
  override: {
    coffee?: string;
    water?: string;
    ratio?: string;
    grindSize?: string;
    temp?: string;
  } | null
): Method => {
  if (!override) return method;

  return {
    ...method,
    params: {
      ...method.params,
      coffee: override.coffee || method.params.coffee,
      water: override.water || method.params.water,
      ratio: override.ratio || method.params.ratio,
      grindSize: override.grindSize || method.params.grindSize,
      temp: override.temp || method.params.temp,
    },
  };
};

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

  // 编辑值状态
  const [editingValues, setEditingValues] = useState<{
    coffee: string;
    ratio: string;
    grindSize: string;
    water?: string;
    time?: string;
    temp?: string;
  } | null>(null);

  // 用于跟踪是否是首次加载（避免重复触发 onParamsChange）
  const isInitialMount = useRef(true);
  const lastNotifiedMethodId = useRef<string | null>(null);

  // Store 方法
  const setMethodParamOverride = useSettingsStore(
    state => state.setMethodParamOverride
  );
  const clearMethodParamOverride = useSettingsStore(
    state => state.clearMethodParamOverride
  );
  const getMethodParamOverride = useSettingsStore(
    state => state.getMethodParamOverride
  );

  // 获取所有方案
  const allMethods = [...customMethods, ...commonMethods];

  // 根据 ID 或名称查找方案
  const findMethod = useCallback(
    (methodId: string): Method | undefined => {
      return allMethods.find(m => m.id === methodId || m.name === methodId);
    },
    [allMethods]
  );

  // 检查方案是否有覆盖参数
  const hasOverride = useCallback(
    (methodId: string): boolean => {
      if (!selectedEquipment || !methodId) return false;
      return getMethodParamOverride(selectedEquipment, methodId) !== null;
    },
    [selectedEquipment, getMethodParamOverride]
  );

  // 获取方案的有效参数（合并覆盖）
  const getEffectiveMethod = useCallback(
    (method: Method): Method => {
      const methodId = method.id || method.name;
      const override = getMethodParamOverride(selectedEquipment, methodId);
      return buildMethodWithOverride(method, override);
    },
    [selectedEquipment, getMethodParamOverride]
  );

  // 通知父组件参数变化
  const notifyParamsChange = useCallback(
    (method: Method) => {
      const effectiveMethod = getEffectiveMethod(method);
      onParamsChange(effectiveMethod);
    },
    [getEffectiveMethod, onParamsChange]
  );

  // 处理方案选择
  const handleMethodClick = useCallback(
    (methodId: string) => {
      const method = findMethod(methodId);
      if (!method) return;

      // 先通知选择变化
      onMethodSelect(methodId);

      // 然后通知参数变化（带覆盖参数）
      const effectiveMethod = getEffectiveMethod(method);
      onParamsChange(effectiveMethod);

      // 记录已通知的方案
      lastNotifiedMethodId.current = methodId;
    },
    [findMethod, onMethodSelect, getEffectiveMethod, onParamsChange]
  );

  // 还原方案参数
  const handleResetParams = useCallback(
    async (method: Method) => {
      const methodId = method.id || method.name;
      await clearMethodParamOverride(selectedEquipment, methodId);

      // 重置编辑值为原始方案参数
      setEditingValues({
        coffee: extractNumber(method.params.coffee),
        ratio: extractRatioNumber(method.params.ratio),
        grindSize: method.params.grindSize,
        water: extractNumber(method.params.water),
        time: method.params.stages?.[0]?.time?.toString() ?? '',
        temp: extractNumber(method.params.temp || ''),
      });

      // 通知父组件使用原始参数
      onParamsChange(method);
    },
    [selectedEquipment, clearMethodParamOverride, onParamsChange]
  );

  // 当选中方案改变时，初始化编辑值并通知父组件
  useEffect(() => {
    if (!selectedMethod || !selectedEquipment) return;

    const method = findMethod(selectedMethod);
    if (!method) return;

    const methodId = method.id || method.name;
    const override = getMethodParamOverride(selectedEquipment, methodId);

    // 设置编辑值
    if (override) {
      setEditingValues({
        coffee: override.coffee
          ? extractNumber(override.coffee)
          : extractNumber(method.params.coffee),
        ratio: override.ratio
          ? extractRatioNumber(override.ratio)
          : extractRatioNumber(method.params.ratio),
        grindSize: override.grindSize || method.params.grindSize,
        water: override.water
          ? extractNumber(override.water)
          : extractNumber(method.params.water),
        time: method.params.stages?.[0]?.time?.toString() ?? '',
        temp: override.temp
          ? extractNumber(override.temp)
          : extractNumber(method.params.temp || ''),
      });
    } else {
      setEditingValues({
        coffee: extractNumber(method.params.coffee),
        ratio: extractRatioNumber(method.params.ratio),
        grindSize: method.params.grindSize,
        water: extractNumber(method.params.water),
        time: method.params.stages?.[0]?.time?.toString() ?? '',
        temp: extractNumber(method.params.temp || ''),
      });
    }

    // 首次加载或方案变化时，通知父组件当前有效参数
    // 避免重复通知同一个方案
    if (
      isInitialMount.current ||
      lastNotifiedMethodId.current !== selectedMethod
    ) {
      const effectiveMethod = buildMethodWithOverride(method, override);
      onParamsChange(effectiveMethod);
      lastNotifiedMethodId.current = selectedMethod;
      isInitialMount.current = false;
    }
  }, [
    selectedMethod,
    selectedEquipment,
    findMethod,
    getMethodParamOverride,
    onParamsChange,
  ]);

  // 参数更新处理
  const updateParam = (
    key: 'coffee' | 'ratio' | 'grindSize' | 'water' | 'time' | 'temp',
    value: string
  ) => {
    const method = findMethod(selectedMethod);
    if (!method || !editingValues) return;

    // 更新本地编辑状态
    const newEditingValues = { ...editingValues, [key]: value };
    setEditingValues(newEditingValues);

    // 构建完整参数
    const currentCoffee = key === 'coffee' ? value : newEditingValues.coffee;
    const currentRatio = key === 'ratio' ? value : newEditingValues.ratio;
    const currentGrindSize =
      key === 'grindSize' ? value : newEditingValues.grindSize;
    const currentTemp = key === 'temp' ? value : newEditingValues.temp || '';
    const currentTime = key === 'time' ? value : newEditingValues.time || '';

    // 计算水量
    let currentWater = key === 'water' ? value : newEditingValues.water || '';
    if (!isEspresso && (key === 'coffee' || key === 'ratio')) {
      const water = calculateWater(currentCoffee, currentRatio);
      if (water) currentWater = extractNumber(water);
    }

    // 构建更新后的方案
    const updatedMethod: Method = {
      ...method,
      params: {
        ...method.params,
        coffee: `${currentCoffee}g`,
        water: `${currentWater}g`,
        ratio: `1:${currentRatio}`,
        grindSize: currentGrindSize,
        temp: currentTemp ? `${currentTemp}°C` : method.params.temp,
        stages: method.params.stages
          ? method.params.stages.map((s, i) => ({
              ...s,
              time:
                i === 0 && currentTime ? parseFloat(currentTime) || 0 : s.time,
            }))
          : [],
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

    // 通知父组件
    onParamsChange(updatedMethod);
  };

  const isMethodSelected = (method: Method): boolean => {
    return selectedMethod === method.id || selectedMethod === method.name;
  };

  // 渲染参数输入
  const renderParamInput = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    unit?: string,
    width: string = 'w-12',
    prefix?: string,
    isNumber: boolean = true
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
          inputMode={isNumber ? 'decimal' : 'text'}
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
  const renderParamDisplay = (label: string, value: string) => (
    <div className="flex items-center">
      <span className="w-14 text-xs font-medium">{label}:</span>
      <span className="text-xs font-medium">{value}</span>
    </div>
  );

  // 渲染单个方案
  const renderMethod = (method: Method) => {
    const isSelected = isMethodSelected(method);
    const methodId = method.id || method.name;
    const effectiveMethod = getEffectiveMethod(method);
    const displayParams = effectiveMethod.params;

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
                <>
                  <span className="text-xs text-neutral-400 dark:text-neutral-500">
                    -
                  </span>
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      handleResetParams(method);
                    }}
                    className="text-xs text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
                  >
                    还原
                  </button>
                </>
              )}
            </div>
          </div>

          {!isSelected ? (
            <div className="mt-1.5 space-y-0.5 text-neutral-500 dark:text-neutral-400">
              {renderParamDisplay('咖啡粉', displayParams.coffee)}
              {isEspresso ? (
                <>
                  {renderParamDisplay('研磨度', displayParams.grindSize)}
                  {renderParamDisplay(
                    '萃取时长',
                    (method.params.stages?.[0]?.duration || 0) + 's'
                  )}
                  {renderParamDisplay('液重', displayParams.water)}
                </>
              ) : (
                <>
                  {renderParamDisplay('粉水比', displayParams.ratio)}
                  {renderParamDisplay('研磨度', displayParams.grindSize)}
                  {renderParamDisplay('水温', displayParams.temp || '-')}
                </>
              )}
            </div>
          ) : (
            <div
              className="mt-2 border-t border-dashed border-neutral-200/50 pt-2 dark:border-neutral-700"
              onClick={e => e.stopPropagation()}
            >
              <div className="space-y-2">
                {renderParamInput(
                  '咖啡粉',
                  editingValues?.coffee ?? '',
                  value => updateParam('coffee', value),
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
                        onChange={value => updateParam('grindSize', value)}
                        className="flex items-center"
                        inputClassName="min-w-12 rounded-sm border border-neutral-300 bg-white px-1 py-0.5 text-left text-xs font-medium text-neutral-800 focus:ring-1 focus:ring-neutral-500 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                        autoWidth
                        defaultSyncEnabled={grinderDefaultSyncEnabled}
                        dropdownPlacement="right"
                      />
                    </div>
                    {renderParamInput(
                      '萃取时长',
                      editingValues?.time ?? '',
                      value => updateParam('time', value),
                      's'
                    )}
                    {renderParamInput(
                      '液重',
                      editingValues?.water ?? '',
                      value => updateParam('water', value),
                      'g'
                    )}
                  </>
                ) : (
                  <>
                    {renderParamInput(
                      '粉水比',
                      editingValues?.ratio ?? '',
                      value => updateParam('ratio', value),
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
                        onChange={value => updateParam('grindSize', value)}
                        className="flex items-center"
                        inputClassName="min-w-12 rounded-sm border border-neutral-300 bg-white px-1 py-0.5 text-left text-xs font-medium text-neutral-800 focus:ring-1 focus:ring-neutral-500 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                        autoWidth
                        defaultSyncEnabled={grinderDefaultSyncEnabled}
                        dropdownPlacement="right"
                      />
                    </div>
                    {renderParamInput(
                      '水温',
                      editingValues?.temp ?? '',
                      value => updateParam('temp', value),
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
          {customMethods.map(method => renderMethod(method))}

          {showDivider && (
            <div className="flex items-center py-3">
              <div className="h-px grow bg-neutral-200 dark:bg-neutral-800" />
              <span className="px-2 text-xs text-neutral-500 dark:text-neutral-400">
                通用方案
              </span>
              <div className="h-px grow bg-neutral-200 dark:bg-neutral-800" />
            </div>
          )}

          {commonMethods.map(method => renderMethod(method))}
        </div>
      )}
    </div>
  );
};

export default MethodSelector;
