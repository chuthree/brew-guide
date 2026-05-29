import type { CustomEquipment, Stage } from '@/lib/core/config';

type StageTextDefaults = {
  label: string;
  detail: string;
};

const SYSTEM_STAGE_DEFAULTS: Record<string, StageTextDefaults> = {
  circle: {
    label: '绕圈注水',
    detail: '中心向外缓慢画圈注水，均匀萃取咖啡风味',
  },
  center: {
    label: '中心注水',
    detail: '中心定点注水，降低萃取率',
  },
  ice: {
    label: '添加冰块',
    detail: '添加冰块，降低温度进行冷萃',
  },
  bypass: {
    label: 'Bypass',
    detail: '冲煮完成后添加到咖啡液中，调节浓度和口感',
  },
  wait: {
    label: '等待',
    detail: '',
  },
  other: {
    label: '',
    detail: '',
  },
};

const LEGACY_STAGE_LABELS = ['注水'];
const LEGACY_STAGE_DETAILS = ['注水'];

const getCustomAnimationDefault = (
  pourType: string,
  customEquipment: CustomEquipment
): StageTextDefaults | null => {
  const animation = customEquipment.customPourAnimations?.find(
    anim => !anim.isSystemDefault && anim.id === pourType
  );

  if (!animation?.name) {
    return null;
  }

  return {
    label: animation.name,
    detail: `使用${animation.name}注水`,
  };
};

export const getStageTextDefaults = (
  pourType: string,
  customEquipment: CustomEquipment
): StageTextDefaults => {
  const systemDefaults = SYSTEM_STAGE_DEFAULTS[pourType];

  if (customEquipment.animationType === 'custom' && pourType === 'other') {
    return SYSTEM_STAGE_DEFAULTS.other;
  }

  const customDefaults = getCustomAnimationDefault(pourType, customEquipment);
  if (customDefaults) {
    return customDefaults;
  }

  if (systemDefaults) {
    return systemDefaults;
  }

  return {
    label: '注水',
    detail: '',
  };
};

export const getManagedStageLabels = (
  customEquipment: CustomEquipment
): string[] => {
  const labels = new Set<string>([
    '',
    ...LEGACY_STAGE_LABELS,
    ...Object.values(SYSTEM_STAGE_DEFAULTS).map(item => item.label),
  ]);

  customEquipment.customPourAnimations?.forEach(animation => {
    if (animation.name) {
      labels.add(animation.name);
    }
  });

  return Array.from(labels);
};

export const getManagedStageDetails = (
  customEquipment: CustomEquipment
): string[] => {
  const details = new Set<string>([
    '',
    ...LEGACY_STAGE_DETAILS,
    ...Object.values(SYSTEM_STAGE_DEFAULTS).map(item => item.detail),
  ]);

  customEquipment.customPourAnimations?.forEach(animation => {
    if (animation.name) {
      details.add(`使用${animation.name}注水`);
    }
  });

  return Array.from(details);
};

export const isManagedStageLabel = (
  label: string | undefined,
  customEquipment: CustomEquipment
): boolean => getManagedStageLabels(customEquipment).includes(label || '');

export const isManagedStageDetail = (
  detail: string | undefined,
  customEquipment: CustomEquipment
): boolean => getManagedStageDetails(customEquipment).includes(detail || '');

export const applyRegularStagePourTypeDefaults = (
  stage: Stage,
  pourType: string,
  customEquipment: CustomEquipment
): Stage => {
  const nextStage: Stage = {
    ...stage,
    pourType,
  };

  if (pourType === 'wait') {
    return {
      ...nextStage,
      label: SYSTEM_STAGE_DEFAULTS.wait.label,
      water: '',
      detail: SYSTEM_STAGE_DEFAULTS.wait.detail,
    };
  }

  const defaults = getStageTextDefaults(pourType, customEquipment);
  const wasWaitStage = stage.pourType === 'wait';

  if (wasWaitStage || isManagedStageLabel(stage.label, customEquipment)) {
    nextStage.label = defaults.label;
  }

  if (wasWaitStage || isManagedStageDetail(stage.detail, customEquipment)) {
    nextStage.detail = defaults.detail;
  }

  return nextStage;
};

export const normalizeStageDefaults = (stage: Stage): Stage => {
  if (stage.pourType !== 'wait') {
    return {
      ...stage,
      detail: stage.detail || '',
    };
  }

  return {
    ...stage,
    label: stage.label || SYSTEM_STAGE_DEFAULTS.wait.label,
    water: '',
    detail: LEGACY_STAGE_DETAILS.includes(stage.detail || '')
      ? ''
      : stage.detail || '',
  };
};
