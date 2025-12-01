'use client';

import React, { useState, useEffect } from 'react';
import { Method } from '@/lib/core/config';
import GrindSizeInput from '@/components/ui/GrindSizeInput';

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

const MethodSelector: React.FC<MethodSelectorProps> = ({
  selectedEquipment,
  selectedMethod,
  customMethods,
  commonMethods,
  onMethodSelect,
  onParamsChange,
  grinderDefaultSyncEnabled = true,
}) => {
  // 判断是否是意式器具
  const isEspresso =
    selectedEquipment.toLowerCase().includes('espresso') ||
    selectedEquipment.includes('意式');

  // 使用状态来存储当前编辑的值，确保输入框可以响应变化
  const [editingValues, setEditingValues] = useState<{
    coffee: string;
    ratio: string;
    grindSize: string;
    water?: string;
    time?: string;
    temp?: string;
  } | null>(null);

  // 获取当前选中的方案
  const getSelectedMethod = (): Method | undefined => {
    if (!selectedMethod) return undefined;
    const allMethods = [...customMethods, ...commonMethods];
    return allMethods.find(
      m => m.id === selectedMethod || m.name === selectedMethod
    );
  };

  // 当选中的方案改变时，初始化编辑值
  useEffect(() => {
    if (!selectedMethod) return;

    const allMethods = [...customMethods, ...commonMethods];
    const method = allMethods.find(
      m => m.id === selectedMethod || m.name === selectedMethod
    );

    if (method) {
      setEditingValues({
        coffee: extractNumber(method.params.coffee),
        ratio: extractRatioNumber(method.params.ratio),
        grindSize: method.params.grindSize,
        water: extractNumber(method.params.water),
        time: method.params.stages?.[0]?.time?.toString() ?? '',
        temp: extractNumber(method.params.temp || ''),
      });
    }
  }, [selectedMethod, customMethods, commonMethods]);

  // 统一的参数更新处理
  const updateParam = (
    key: 'coffee' | 'ratio' | 'grindSize' | 'water' | 'time' | 'temp',
    value: string
  ) => {
    const method = getSelectedMethod();
    if (!method) return;

    // 更新本地编辑状态
    setEditingValues(prev => (prev ? { ...prev, [key]: value } : null));

    // 直接更新方法参数
    if (key === 'coffee') {
      method.params.coffee = `${value}g`;
      if (!isEspresso) {
        const ratio =
          editingValues?.ratio || extractRatioNumber(method.params.ratio);
        const water = calculateWater(value, ratio);
        if (water) method.params.water = water;
      }
    } else if (key === 'ratio') {
      method.params.ratio = `1:${value}`;
      const coffee =
        editingValues?.coffee || extractNumber(method.params.coffee);
      const water = calculateWater(coffee, value);
      if (water) method.params.water = water;
    } else if (key === 'grindSize') {
      method.params.grindSize = value;
    } else if (key === 'water') {
      method.params.water = `${value}g`;
    } else if (key === 'time') {
      if (!method.params.stages) method.params.stages = [];
      if (method.params.stages.length === 0) {
        method.params.stages.push({
          time: 0,
          label: '萃取',
          water: method.params.water,
          detail: '',
          pourType: 'extraction',
        });
      }
      method.params.stages[0].time = parseFloat(value) || 0;
    } else if (key === 'temp') {
      method.params.temp = `${value}°C`;
    }

    onParamsChange(method);
  };

  const isMethodSelected = (method: Method): boolean => {
    return selectedMethod === method.id || selectedMethod === method.name;
  };

  // 渲染参数输入字段
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

    return (
      <div key={methodId} className="group relative">
        <div
          className={`group relative border-l ${
            isSelected
              ? 'border-neutral-800 dark:border-white'
              : 'border-neutral-200 dark:border-neutral-800'
          } cursor-pointer pl-6`}
          onClick={() => onMethodSelect(methodId)}
        >
          {isSelected && (
            <div className="absolute top-0 -left-px h-full w-px bg-neutral-800 dark:bg-white" />
          )}

          <div className="flex items-baseline justify-between">
            <h3 className="truncate text-xs font-medium tracking-wider text-neutral-800 dark:text-neutral-100">
              {method.name}
            </h3>
          </div>

          {!isSelected ? (
            <div className="mt-1.5 space-y-0.5 text-neutral-500 dark:text-neutral-400">
              {renderParamDisplay('咖啡粉', method.params.coffee)}
              {isEspresso ? (
                <>
                  {renderParamDisplay('研磨度', method.params.grindSize)}
                  {renderParamDisplay(
                    '萃取时长',
                    (method.params.stages?.[0]?.time || 0) + 's'
                  )}
                  {renderParamDisplay('液重', method.params.water)}
                </>
              ) : (
                <>
                  {renderParamDisplay('粉水比', method.params.ratio)}
                  {renderParamDisplay('研磨度', method.params.grindSize)}
                  {renderParamDisplay('水温', method.params.temp || '-')}
                </>
              )}
            </div>
          ) : (
            <div
              className="mt-2 border-t border-dashed border-neutral-200 pt-2 dark:border-neutral-700"
              onClick={e => e.stopPropagation()}
            >
              <div className="space-y-2">
                {renderParamInput(
                  '咖啡粉',
                  editingValues?.coffee ?? extractNumber(method.params.coffee),
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
                        value={
                          editingValues?.grindSize ?? method.params.grindSize
                        }
                        onChange={value => updateParam('grindSize', value)}
                        className="flex items-center"
                        inputClassName="min-w-12 rounded-sm border border-neutral-300 bg-white px-1 py-0.5 text-left text-xs font-medium text-neutral-800 focus:ring-1 focus:ring-neutral-500 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                        defaultSyncEnabled={grinderDefaultSyncEnabled}
                        dropdownPlacement="right"
                      />
                    </div>
                    {renderParamInput(
                      '萃取时长',
                      editingValues?.time ??
                        method.params.stages?.[0]?.time?.toString() ??
                        '',
                      value => updateParam('time', value),
                      's'
                    )}
                    {renderParamInput(
                      '液重',
                      editingValues?.water ??
                        extractNumber(method.params.water),
                      value => updateParam('water', value),
                      'g'
                    )}
                  </>
                ) : (
                  <>
                    {renderParamInput(
                      '粉水比',
                      editingValues?.ratio ??
                        extractRatioNumber(method.params.ratio),
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
                        value={
                          editingValues?.grindSize ?? method.params.grindSize
                        }
                        onChange={value => updateParam('grindSize', value)}
                        className="flex items-center"
                        inputClassName="min-w-12 rounded-sm border border-neutral-300 bg-white px-1 py-0.5 text-left text-xs font-medium text-neutral-800 focus:ring-1 focus:ring-neutral-500 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                        defaultSyncEnabled={grinderDefaultSyncEnabled}
                        dropdownPlacement="right"
                      />
                    </div>
                    {renderParamInput(
                      '水温',
                      editingValues?.temp ??
                        extractNumber(method.params.temp ?? ''),
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
        <div className="border-l border-neutral-200 pl-6 text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
          请先选择器具
        </div>
      ) : !hasMethods ? (
        <div className="border-l border-neutral-200 pl-6 text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
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
