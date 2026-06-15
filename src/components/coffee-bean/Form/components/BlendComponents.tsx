import React, { useMemo } from 'react';
import AutocompleteInput from '@/components/common/forms/AutocompleteInput';
import { BlendComponent } from '@/types/app';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import BlendComponentFieldRows from './BlendComponentFieldRows';

interface BlendComponentsProps {
  components: BlendComponent[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onChange: (
    index: number,
    field: keyof BlendComponent,
    value: string | number
  ) => void;
}

const BlendComponents: React.FC<BlendComponentsProps> = ({
  components,
  onAdd,
  onRemove,
  onChange,
}) => {
  // 庄园字段显示设置 - 从 settingsStore 获取
  const showEstateFieldSetting = useSettingsStore(
    state => state.settings.showEstateField || false
  );
  const showRegionFieldSetting = useSettingsStore(
    state => state.settings.showRegionField || false
  );
  const showLotFieldSetting = useSettingsStore(
    state => state.settings.showLotField !== false
  );
  const showBatchFieldSetting = useSettingsStore(
    state => state.settings.showBatchField !== false
  );
  const showStationFieldSetting = useSettingsStore(
    state => state.settings.showStationField !== false
  );
  const showAltitudeFieldSetting = useSettingsStore(
    state => state.settings.showAltitudeField || false
  );
  const showSeasonFieldSetting = useSettingsStore(
    state => state.settings.showSeasonField || false
  );
  const showAgtronFieldSetting = useSettingsStore(
    state => state.settings.showAgtronField || false
  );

  // 检查是否有任何成分已有庄园数据
  const hasExistingEstate = useMemo(() => {
    return components.some(comp => comp.estate && comp.estate.trim() !== '');
  }, [components]);
  const hasExistingRegion = useMemo(() => {
    return components.some(comp => comp.region && comp.region.trim() !== '');
  }, [components]);
  const hasExistingLot = useMemo(() => {
    return components.some(comp => comp.lot && comp.lot.trim() !== '');
  }, [components]);
  const hasExistingBatch = useMemo(() => {
    return components.some(comp => comp.batch && comp.batch.trim() !== '');
  }, [components]);
  const hasExistingProcessingStation = useMemo(() => {
    return components.some(comp => comp.station && comp.station.trim() !== '');
  }, [components]);
  const hasExistingAltitude = useMemo(() => {
    return components.some(comp => comp.altitude && comp.altitude.trim() !== '');
  }, [components]);
  const hasExistingSeason = useMemo(() => {
    return components.some(comp => comp.season && comp.season.trim() !== '');
  }, [components]);
  const hasExistingAgtron = useMemo(() => {
    return components.some(comp => comp.agtron && comp.agtron.trim() !== '');
  }, [components]);

  // 是否因”已有/输入过庄园”而触发显示（进入表单后保持到退出）
  const [estateFieldStickyByData, setEstateFieldStickyByData] =
    React.useState(hasExistingEstate);
  const [regionFieldStickyByData, setRegionFieldStickyByData] =
    React.useState(hasExistingRegion);
  const [lotFieldStickyByData, setLotFieldStickyByData] =
    React.useState(hasExistingLot);
  const [batchFieldStickyByData, setBatchFieldStickyByData] =
    React.useState(hasExistingBatch);
  const [stationFieldStickyByData, setProcessingStationFieldStickyByData] =
    React.useState(hasExistingProcessingStation);
  const [altitudeFieldStickyByData, setAltitudeFieldStickyByData] =
    React.useState(hasExistingAltitude);
  const [seasonFieldStickyByData, setSeasonFieldStickyByData] =
    React.useState(hasExistingSeason);
  const [agtronFieldStickyByData, setAgtronFieldStickyByData] =
    React.useState(hasExistingAgtron);

  React.useEffect(() => {
    if (hasExistingEstate) {
      setEstateFieldStickyByData(true);
    }
  }, [hasExistingEstate]);
  React.useEffect(() => {
    if (hasExistingRegion) {
      setRegionFieldStickyByData(true);
    }
  }, [hasExistingRegion]);
  React.useEffect(() => {
    if (hasExistingLot) {
      setLotFieldStickyByData(true);
    }
  }, [hasExistingLot]);
  React.useEffect(() => {
    if (hasExistingBatch) {
      setBatchFieldStickyByData(true);
    }
  }, [hasExistingBatch]);
  React.useEffect(() => {
    if (hasExistingProcessingStation) {
      setProcessingStationFieldStickyByData(true);
    }
  }, [hasExistingProcessingStation]);
  React.useEffect(() => {
    if (hasExistingAltitude) {
      setAltitudeFieldStickyByData(true);
    }
  }, [hasExistingAltitude]);
  React.useEffect(() => {
    if (hasExistingSeason) {
      setSeasonFieldStickyByData(true);
    }
  }, [hasExistingSeason]);
  React.useEffect(() => {
    if (hasExistingAgtron) {
      setAgtronFieldStickyByData(true);
    }
  }, [hasExistingAgtron]);

  // 最终是否显示庄园字段：设置开启 或 数据触发（并在会话内保持）
  const showEstateField = showEstateFieldSetting || estateFieldStickyByData;
  const showRegionField = showRegionFieldSetting || regionFieldStickyByData;
  const showLotField = showLotFieldSetting || lotFieldStickyByData;
  const showBatchField = showBatchFieldSetting || batchFieldStickyByData;
  const showStationField = showStationFieldSetting || stationFieldStickyByData;
  const showAltitudeField = showAltitudeFieldSetting || altitudeFieldStickyByData;
  const showSeasonField = showSeasonFieldSetting || seasonFieldStickyByData;
  const showAgtronField = showAgtronFieldSetting || agtronFieldStickyByData;

  // 计算总百分比
  const totalPercentage = components.reduce(
    (sum, component) =>
      component.percentage ? sum + component.percentage : sum,
    0
  );

  // 计算百分比状态
  const percentageStatus =
    totalPercentage === 100
      ? 'text-green-600 dark:text-green-400'
      : totalPercentage > 100
        ? 'text-red-600 dark:text-red-400'
        : 'text-neutral-500 dark:text-neutral-400';

  // 计算特定成分可用的最大百分比
  const calculateMaxAllowed = (index: number): number => {
    const totalOtherPercentage = components.reduce(
      (sum, comp, i) =>
        i !== index && comp.percentage ? sum + comp.percentage : sum,
      0
    );
    return 100 - totalOtherPercentage;
  };

  // 检查是否可以添加更多成分
  // 只有当组件数量大于1（拼配咖啡）时才考虑百分比限制
  const canAddMoreComponents = components.length === 1 || totalPercentage < 100;

  return (
    <div className="w-full space-y-5">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
          咖啡豆成分
        </label>
        <button
          type="button"
          onClick={onAdd}
          disabled={!canAddMoreComponents}
          className={`rounded-full px-3 py-1 text-xs transition-colors ${
            !canAddMoreComponents
              ? 'cursor-not-allowed bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-600'
              : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600'
          }`}
        >
          添加成分
        </button>
      </div>

      <div className="space-y-4">
        {components.map((component, index) => {
          // 计算当前成分的最大允许百分比
          const maxAllowed = calculateMaxAllowed(index);

          return (
            <div key={index}>
              {components.length > 1 && (
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    成分 #{index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemove(index)}
                    className="text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                  >
                    移除
                  </button>
                </div>
              )}

              {components.length > 1 && (
                <div className="mb-3 space-y-1">
                  <label className="block text-xs text-neutral-500 dark:text-neutral-400">
                    比例 (可选)
                    {maxAllowed === 0 && (
                      <span className="ml-1 text-amber-600 dark:text-amber-400">
                        (已达100%)
                      </span>
                    )}
                  </label>
                  <AutocompleteInput
                    value={
                      component.percentage !== undefined
                        ? component.percentage.toString()
                        : ''
                    }
                    onChange={value => onChange(index, 'percentage', value)}
                    placeholder={maxAllowed > 0 ? `0-${maxAllowed}` : '0'}
                    unit="%"
                    inputType="tel"
                    clearable={true}
                    suggestions={[]}
                    maxValue={maxAllowed}
                    disabled={maxAllowed === 0 && !component.percentage}
                  />
                </div>
              )}

              <BlendComponentFieldRows
                component={component}
                index={index}
                showEstateField={showEstateField}
                showRegionField={showRegionField}
                showLotField={showLotField}
                showBatchField={showBatchField}
                showStationField={showStationField}
                showAltitudeField={showAltitudeField}
                showSeasonField={showSeasonField}
                showAgtronField={showAgtronField}
                onChange={onChange}
              />
            </div>
          );
        })}
      </div>

      {components.length > 1 && (
        <div
          className={`text-xs ${percentageStatus} mt-1 flex items-center justify-between`}
        >
          <span>当前总比例：{totalPercentage}%</span>
          {totalPercentage !== 100 && (
            <span>
              {totalPercentage < 100
                ? `还差 ${100 - totalPercentage}%`
                : `超出 ${totalPercentage - 100}%`}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default BlendComponents;
