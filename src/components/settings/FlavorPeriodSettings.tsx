'use client';

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { SettingsOptions, defaultSettings } from './Settings';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';
import { SettingPage } from './atomic';
import SettingSection from './atomic/SettingSection';
import SettingRow from './atomic/SettingRow';
import SettingToggle from './atomic/SettingToggle';
import RoasterLogoManager, {
  RoasterConfig,
} from '@/lib/managers/RoasterLogoManager';
import { extractUniqueRoasters } from '@/lib/utils/beanVarietyUtils';
import { CoffeeBeanManager } from '@/lib/managers/coffeeBeanManager';
import { ExtendedCoffeeBean } from '@/components/coffee-bean/List/types';
import { ChevronDown } from 'lucide-react';

// 详细烘焙度定义
type DetailedRoastLevel =
  | 'extraLight'
  | 'light'
  | 'mediumLight'
  | 'medium'
  | 'mediumDark'
  | 'dark';

// 详细烘焙度显示名称
const DETAILED_ROAST_LABELS: Record<DetailedRoastLevel, string> = {
  extraLight: '极浅烘焙',
  light: '浅度烘焙',
  mediumLight: '中浅烘焙',
  medium: '中度烘焙',
  mediumDark: '中深烘焙',
  dark: '深度烘焙',
};

// 详细烘焙度到简单烘焙度的映射（用于继承默认值）
const DETAILED_TO_SIMPLE_MAP: Record<
  DetailedRoastLevel,
  'light' | 'medium' | 'dark'
> = {
  extraLight: 'light',
  light: 'light',
  mediumLight: 'light',
  medium: 'medium',
  mediumDark: 'dark',
  dark: 'dark',
};

// 预设值常量
const PRESET_VALUES = {
  light: { startDay: 7, endDay: 60 },
  medium: { startDay: 10, endDay: 60 },
  dark: { startDay: 14, endDay: 90 },
};

interface FlavorPeriodSettingsProps {
  settings: SettingsOptions;
  onClose: () => void;
  handleChange: <K extends keyof SettingsOptions>(
    key: K,
    value: SettingsOptions[K]
  ) => void | Promise<void>;
}

const FlavorPeriodSettings: React.FC<FlavorPeriodSettingsProps> = ({
  settings,
  onClose,
  handleChange,
}) => {
  // 控制动画状态
  const [shouldRender, setShouldRender] = React.useState(true);
  const [isVisible, setIsVisible] = React.useState(false);

  // 烘焙商相关状态
  const [roasters, setRoasters] = useState<string[]>([]);
  const [roasterConfigs, setRoasterConfigs] = useState<
    Map<string, RoasterConfig>
  >(new Map());
  const [expandedRoaster, setExpandedRoaster] = useState<string | null>(null);

  // 用于保存最新的 onClose 引用
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  // 是否启用详细模式
  const isDetailedMode = settings.detailedFlavorPeriodEnabled ?? false;

  // 关闭处理函数（带动画）
  const handleCloseWithAnimation = React.useCallback(() => {
    setIsVisible(false);
    window.dispatchEvent(new CustomEvent('subSettingsClosing'));
    setTimeout(() => {
      onCloseRef.current();
    }, 350);
  }, []);

  // 使用统一的历史栈管理系统
  useModalHistory({
    id: 'flavor-period-settings',
    isOpen: true,
    onClose: handleCloseWithAnimation,
  });

  // UI 返回按钮点击处理
  const handleClose = () => {
    modalHistory.back();
  };

  // 处理显示/隐藏动画（入场动画）
  React.useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    });
  }, []);

  // 加载烘焙商列表和配置
  useEffect(() => {
    loadRoasters();
    loadConfigs();
  }, []);

  const loadRoasters = async () => {
    try {
      const beans =
        (await CoffeeBeanManager.getAllBeans()) as ExtendedCoffeeBean[];
      const uniqueRoasters = extractUniqueRoasters(beans);
      const filteredRoasters = uniqueRoasters.filter(r => r !== '未知烘焙商');
      setRoasters(filteredRoasters);
    } catch (error) {
      console.error('Failed to load roasters:', error);
    }
  };

  const loadConfigs = async () => {
    try {
      const allConfigs = await RoasterLogoManager.getAllConfigs();
      const configMap = new Map<string, RoasterConfig>();
      allConfigs.forEach(config => {
        configMap.set(config.roasterName, config);
      });
      setRoasterConfigs(configMap);
    } catch (error) {
      console.error('Failed to load configs:', error);
    }
  };

  const toggleExpand = (roasterName: string) => {
    setExpandedRoaster(expandedRoaster === roasterName ? null : roasterName);
  };

  const handleRoasterFlavorPeriodChange = async (
    roaster: string,
    type: 'light' | 'medium' | 'dark',
    field: 'startDay' | 'endDay',
    value: number
  ) => {
    const currentConfig = roasterConfigs.get(roaster);
    const currentFlavorPeriod = currentConfig?.flavorPeriod || {
      light: { startDay: 0, endDay: 0 },
      medium: { startDay: 0, endDay: 0 },
      dark: { startDay: 0, endDay: 0 },
    };

    const newFlavorPeriod = {
      ...currentFlavorPeriod,
      [type]: {
        ...currentFlavorPeriod[type],
        [field]: value,
      },
    };

    await RoasterLogoManager.setFlavorPeriod(roaster, newFlavorPeriod);
    await loadConfigs();
  };

  // 处理详细模式下烘焙商赏味期变更
  const handleRoasterDetailedFlavorPeriodChange = async (
    roaster: string,
    type: DetailedRoastLevel,
    field: 'startDay' | 'endDay',
    value: number
  ) => {
    const currentConfig = roasterConfigs.get(roaster);
    const currentDetailedPeriod = currentConfig?.detailedFlavorPeriod || {
      extraLight: { startDay: 0, endDay: 0 },
      light: { startDay: 0, endDay: 0 },
      mediumLight: { startDay: 0, endDay: 0 },
      medium: { startDay: 0, endDay: 0 },
      mediumDark: { startDay: 0, endDay: 0 },
      dark: { startDay: 0, endDay: 0 },
    };

    const newDetailedPeriod = {
      ...currentDetailedPeriod,
      [type]: {
        ...currentDetailedPeriod[type],
        [field]: value,
      },
    };

    await RoasterLogoManager.setDetailedFlavorPeriod(
      roaster,
      newDetailedPeriod
    );
    await loadConfigs();
  };

  // 辅助函数：更新简单模式的自定义赏味期设置
  const updateCustomFlavorPeriod = useCallback(
    (
      roastType: 'light' | 'medium' | 'dark',
      field: 'startDay' | 'endDay',
      value: number
    ) => {
      const current = settings.customFlavorPeriod || {
        light: { startDay: 0, endDay: 0 },
        medium: { startDay: 0, endDay: 0 },
        dark: { startDay: 0, endDay: 0 },
      };

      const newCustomFlavorPeriod = {
        ...current,
        [roastType]: {
          ...current[roastType],
          [field]: value,
        },
      };
      handleChange('customFlavorPeriod', newCustomFlavorPeriod);
    },
    [settings.customFlavorPeriod, handleChange]
  );

  // 辅助函数：更新详细模式的赏味期设置
  const updateDetailedFlavorPeriod = useCallback(
    (
      roastType: DetailedRoastLevel,
      field: 'startDay' | 'endDay',
      value: number
    ) => {
      const current = settings.detailedFlavorPeriod ||
        defaultSettings.detailedFlavorPeriod || {
          extraLight: { startDay: 0, endDay: 0 },
          light: { startDay: 0, endDay: 0 },
          mediumLight: { startDay: 0, endDay: 0 },
          medium: { startDay: 0, endDay: 0 },
          mediumDark: { startDay: 0, endDay: 0 },
          dark: { startDay: 0, endDay: 0 },
        };

      const newDetailedFlavorPeriod = {
        ...current,
        [roastType]: {
          ...current[roastType],
          [field]: value,
        },
      };
      handleChange('detailedFlavorPeriod', newDetailedFlavorPeriod);
    },
    [settings.detailedFlavorPeriod, handleChange]
  );

  // 获取全局详细烘焙度的有效值（考虑继承逻辑）
  // 用于输入框显示：只继承"自己层级"的设置
  // 全局详细设置 → 全局简单设置（继承自己）
  const getDetailedValue = useCallback(
    (roastType: DetailedRoastLevel, field: 'startDay' | 'endDay'): number => {
      // 1. 如果全局详细设置有值，直接使用
      const detailedValue =
        settings.detailedFlavorPeriod?.[roastType]?.[field] || 0;
      if (detailedValue > 0) return detailedValue;

      // 2. 从全局简单模式继承（继承自己）
      const simpleType = DETAILED_TO_SIMPLE_MAP[roastType];
      const simpleValue =
        settings.customFlavorPeriod?.[simpleType]?.[field] || 0;
      if (simpleValue > 0) return simpleValue;

      // 3. 返回0（让 placeholder 显示系统预设值）
      return 0;
    },
    [settings.detailedFlavorPeriod, settings.customFlavorPeriod]
  );

  // 获取烘焙商详细模式下的有效值（用于输入框显示）
  // 只继承"自己层级"的设置：烘焙商详细设置 → 烘焙商简单设置
  // placeholder 会显示全局的值
  const getRoasterDetailedValue = useCallback(
    (
      roaster: string,
      roastType: DetailedRoastLevel,
      field: 'startDay' | 'endDay'
    ): number => {
      const config = roasterConfigs.get(roaster);
      const simpleType = DETAILED_TO_SIMPLE_MAP[roastType];

      // 1. 烘焙商详细设置
      const roasterDetailedValue =
        config?.detailedFlavorPeriod?.[roastType]?.[field] || 0;
      if (roasterDetailedValue > 0) return roasterDetailedValue;

      // 2. 烘焙商简单设置（继承自己层级的映射）
      const roasterSimpleValue =
        config?.flavorPeriod?.[simpleType]?.[field] || 0;
      if (roasterSimpleValue > 0) return roasterSimpleValue;

      // 3. 返回0（让 placeholder 显示全局值或预设值）
      // 不再继承全局设置到输入框，全局设置应该通过 placeholder 显示
      return 0;
    },
    [roasterConfigs]
  );

  // 获取全局详细烘焙度的 placeholder
  // 全局详细模式的 placeholder 只显示系统预设值
  const getDetailedPlaceholder = useCallback(
    (roastType: DetailedRoastLevel, field: 'startDay' | 'endDay'): string => {
      const simpleType = DETAILED_TO_SIMPLE_MAP[roastType];
      // 直接使用系统预设值作为 placeholder
      return String(PRESET_VALUES[simpleType][field]);
    },
    []
  );

  // 获取烘焙商详细烘焙度的 placeholder
  // 显示会继承的全局值（全局详细 → 全局简单 → 系统预设）
  const getRoasterDetailedPlaceholder = useCallback(
    (roastType: DetailedRoastLevel, field: 'startDay' | 'endDay'): string => {
      const simpleType = DETAILED_TO_SIMPLE_MAP[roastType];

      // 1. 全局详细设置
      const globalDetailedValue =
        settings.detailedFlavorPeriod?.[roastType]?.[field] || 0;
      if (globalDetailedValue > 0) return String(globalDetailedValue);

      // 2. 全局简单设置
      const globalSimpleValue =
        settings.customFlavorPeriod?.[simpleType]?.[field] || 0;
      if (globalSimpleValue > 0) return String(globalSimpleValue);

      // 3. 系统预设值
      return String(PRESET_VALUES[simpleType][field]);
    },
    [settings.detailedFlavorPeriod, settings.customFlavorPeriod]
  );

  // 切换详细模式
  const handleDetailedModeToggle = useCallback(
    (enabled: boolean) => {
      handleChange('detailedFlavorPeriodEnabled', enabled);

      // 当开启详细模式时，如果详细设置为空，则从简单设置初始化
      if (enabled && !settings.detailedFlavorPeriod) {
        const simple = settings.customFlavorPeriod || {
          light: { startDay: 0, endDay: 0 },
          medium: { startDay: 0, endDay: 0 },
          dark: { startDay: 0, endDay: 0 },
        };

        const initialDetailed = {
          extraLight: { ...simple.light },
          light: { ...simple.light },
          mediumLight: { ...simple.light },
          medium: { ...simple.medium },
          mediumDark: { ...simple.dark },
          dark: { ...simple.dark },
        };
        handleChange('detailedFlavorPeriod', initialDetailed);
      }
    },
    [settings.customFlavorPeriod, settings.detailedFlavorPeriod, handleChange]
  );

  const renderFlavorInputs = (
    startDay: number,
    endDay: number,
    onStartChange: (val: number) => void,
    onEndChange: (val: number) => void,
    placeholderStart: string,
    placeholderEnd: string,
    isSmall = false
  ) => (
    <div className={`flex items-center ${isSmall ? 'gap-2.5' : 'space-x-3'}`}>
      <div className={`flex items-center ${isSmall ? 'gap-1.5' : 'space-x-1'}`}>
        <span className="text-sm text-neutral-500 dark:text-neutral-400">
          养豆
        </span>
        <input
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          min="0"
          max="30"
          defaultValue={startDay || ''}
          key={`start-${startDay}`}
          placeholder={placeholderStart}
          onBlur={e => {
            const value =
              e.target.value === '' ? 0 : parseInt(e.target.value) || 0;
            onStartChange(value);
          }}
          className={`${
            isSmall ? 'w-14' : 'w-12'
          } rounded border border-neutral-200 bg-neutral-100 px-2 py-1 text-center text-xs focus:ring-1 focus:ring-neutral-500 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-800`}
        />
        {!isSmall && (
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            天
          </span>
        )}
      </div>
      <div className={`flex items-center ${isSmall ? 'gap-1.5' : 'space-x-1'}`}>
        <span className="text-sm text-neutral-500 dark:text-neutral-400">
          赏味
        </span>
        <input
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          min="1"
          max="90"
          defaultValue={endDay || ''}
          key={`end-${endDay}`}
          placeholder={placeholderEnd}
          onBlur={e => {
            const value =
              e.target.value === '' ? 0 : parseInt(e.target.value) || 0;
            onEndChange(value);
          }}
          className={`${
            isSmall ? 'w-14' : 'w-12'
          } rounded border border-neutral-200 bg-neutral-100 px-2 py-1 text-center text-xs focus:ring-1 focus:ring-neutral-500 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-800`}
        />
        {!isSmall && (
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            天
          </span>
        )}
      </div>
    </div>
  );

  // 详细烘焙度顺序
  const detailedRoastLevels: DetailedRoastLevel[] = [
    'extraLight',
    'light',
    'mediumLight',
    'medium',
    'mediumDark',
    'dark',
  ];

  if (!shouldRender) return null;

  return (
    <SettingPage
      title="自定义赏味期预设"
      isVisible={isVisible}
      onClose={handleClose}
    >
      <div className="mt-4">
        {/* 详细模式开关 */}
        <SettingSection title="模式设置" footer="为每种烘焙度单独设置赏味期">
          <SettingRow label="详细烘焙度设置" isLast>
            <SettingToggle
              checked={isDetailedMode}
              onChange={handleDetailedModeToggle}
            />
          </SettingRow>
        </SettingSection>

        {/* 全局默认预设 - 简单模式 */}
        {!isDetailedMode && (
          <SettingSection
            title="全局默认预设"
            footer="添加咖啡豆时，会根据烘焙度自动设定赏味期。"
          >
            <SettingRow label="浅烘">
              {renderFlavorInputs(
                settings.customFlavorPeriod?.light?.startDay || 0,
                settings.customFlavorPeriod?.light?.endDay || 0,
                val => updateCustomFlavorPeriod('light', 'startDay', val),
                val => updateCustomFlavorPeriod('light', 'endDay', val),
                '7',
                '60'
              )}
            </SettingRow>
            <SettingRow label="中烘">
              {renderFlavorInputs(
                settings.customFlavorPeriod?.medium?.startDay || 0,
                settings.customFlavorPeriod?.medium?.endDay || 0,
                val => updateCustomFlavorPeriod('medium', 'startDay', val),
                val => updateCustomFlavorPeriod('medium', 'endDay', val),
                '10',
                '60'
              )}
            </SettingRow>
            <SettingRow label="深烘" isLast>
              {renderFlavorInputs(
                settings.customFlavorPeriod?.dark?.startDay || 0,
                settings.customFlavorPeriod?.dark?.endDay || 0,
                val => updateCustomFlavorPeriod('dark', 'startDay', val),
                val => updateCustomFlavorPeriod('dark', 'endDay', val),
                '14',
                '90'
              )}
            </SettingRow>
          </SettingSection>
        )}

        {/* 全局默认预设 - 详细模式 */}
        {isDetailedMode && (
          <SettingSection
            title="详细烘焙度预设"
            footer="为每种烘焙度设置专属的赏味期，会自动继承对应类别的设置。"
          >
            {detailedRoastLevels.map((level, index) => {
              const isLast = index === detailedRoastLevels.length - 1;
              const simpleType = DETAILED_TO_SIMPLE_MAP[level];
              // placeholder 只显示系统预设值
              const placeholderStart = String(
                PRESET_VALUES[simpleType].startDay
              );
              const placeholderEnd = String(PRESET_VALUES[simpleType].endDay);

              return (
                <SettingRow
                  key={level}
                  label={DETAILED_ROAST_LABELS[level]}
                  isLast={isLast}
                >
                  {renderFlavorInputs(
                    getDetailedValue(level, 'startDay'),
                    getDetailedValue(level, 'endDay'),
                    val => updateDetailedFlavorPeriod(level, 'startDay', val),
                    val => updateDetailedFlavorPeriod(level, 'endDay', val),
                    placeholderStart,
                    placeholderEnd
                  )}
                </SettingRow>
              );
            })}
          </SettingSection>
        )}

        {/* 烘焙商特定预设 */}
        {roasters.length > 0 && (
          <SettingSection
            title={`烘焙商特定预设 (${roasters.length})`}
            footer="为特定烘焙商设置专属的赏味期，优先级高于全局默认预设。"
          >
            {roasters.map((roaster, index) => {
              const config = roasterConfigs.get(roaster);
              const isExpanded = expandedRoaster === roaster;
              const isLast = index === roasters.length - 1;

              // 简单模式数据
              const flavorPeriod = config?.flavorPeriod || {
                light: { startDay: 0, endDay: 0 },
                medium: { startDay: 0, endDay: 0 },
                dark: { startDay: 0, endDay: 0 },
              };

              // 详细模式数据
              const detailedFlavorPeriod = config?.detailedFlavorPeriod || {
                extraLight: { startDay: 0, endDay: 0 },
                light: { startDay: 0, endDay: 0 },
                mediumLight: { startDay: 0, endDay: 0 },
                medium: { startDay: 0, endDay: 0 },
                mediumDark: { startDay: 0, endDay: 0 },
                dark: { startDay: 0, endDay: 0 },
              };

              return (
                <div key={roaster} className="flex w-full flex-col">
                  {/* Header */}
                  <button
                    onClick={() => toggleExpand(roaster)}
                    className="relative flex w-full items-center justify-between py-3.5 pr-3.5 pl-3.5"
                  >
                    <div className="flex flex-col items-start">
                      <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                        {roaster}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ChevronDown
                        className={`h-4 w-4 text-neutral-400/60 transition-transform duration-200 ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                    {/* Separator */}
                    {!isLast && !isExpanded && (
                      <div className="absolute right-0 bottom-0 left-3.5 h-px bg-black/5 dark:bg-white/5" />
                    )}
                  </button>

                  {/* Expanded Content */}
                  <div
                    className={`grid transition-all duration-300 ease-in-out ${
                      isExpanded
                        ? 'grid-rows-[1fr] opacity-100'
                        : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="px-3.5 pb-3.5">
                        <div className="space-y-2.5 border-t border-black/5 pt-3 dark:border-white/5">
                          {/* 简单模式 */}
                          {!isDetailedMode && (
                            <>
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                                  浅烘
                                </span>
                                {renderFlavorInputs(
                                  flavorPeriod.light.startDay,
                                  flavorPeriod.light.endDay,
                                  val =>
                                    handleRoasterFlavorPeriodChange(
                                      roaster,
                                      'light',
                                      'startDay',
                                      val
                                    ),
                                  val =>
                                    handleRoasterFlavorPeriodChange(
                                      roaster,
                                      'light',
                                      'endDay',
                                      val
                                    ),
                                  '默认',
                                  '默认'
                                )}
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                                  中烘
                                </span>
                                {renderFlavorInputs(
                                  flavorPeriod.medium.startDay,
                                  flavorPeriod.medium.endDay,
                                  val =>
                                    handleRoasterFlavorPeriodChange(
                                      roaster,
                                      'medium',
                                      'startDay',
                                      val
                                    ),
                                  val =>
                                    handleRoasterFlavorPeriodChange(
                                      roaster,
                                      'medium',
                                      'endDay',
                                      val
                                    ),
                                  '默认',
                                  '默认'
                                )}
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                                  深烘
                                </span>
                                {renderFlavorInputs(
                                  flavorPeriod.dark.startDay,
                                  flavorPeriod.dark.endDay,
                                  val =>
                                    handleRoasterFlavorPeriodChange(
                                      roaster,
                                      'dark',
                                      'startDay',
                                      val
                                    ),
                                  val =>
                                    handleRoasterFlavorPeriodChange(
                                      roaster,
                                      'dark',
                                      'endDay',
                                      val
                                    ),
                                  '默认',
                                  '默认'
                                )}
                              </div>
                            </>
                          )}

                          {/* 详细模式 */}
                          {isDetailedMode && (
                            <>
                              {detailedRoastLevels.map(level => (
                                <div
                                  key={level}
                                  className="flex items-center justify-between"
                                >
                                  <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                                    {DETAILED_ROAST_LABELS[level]}
                                  </span>
                                  {renderFlavorInputs(
                                    getRoasterDetailedValue(
                                      roaster,
                                      level,
                                      'startDay'
                                    ),
                                    getRoasterDetailedValue(
                                      roaster,
                                      level,
                                      'endDay'
                                    ),
                                    val =>
                                      handleRoasterDetailedFlavorPeriodChange(
                                        roaster,
                                        level,
                                        'startDay',
                                        val
                                      ),
                                    val =>
                                      handleRoasterDetailedFlavorPeriodChange(
                                        roaster,
                                        level,
                                        'endDay',
                                        val
                                      ),
                                    getRoasterDetailedPlaceholder(
                                      level,
                                      'startDay'
                                    ),
                                    getRoasterDetailedPlaceholder(
                                      level,
                                      'endDay'
                                    )
                                  )}
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      </div>
                      {!isLast && (
                        <div className="ml-3.5 h-px bg-black/5 dark:bg-white/5" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </SettingSection>
        )}

        {/* 底部空间 */}
        <div className="h-16" />
      </div>
    </SettingPage>
  );
};

export default FlavorPeriodSettings;
