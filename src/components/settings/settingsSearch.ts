import type { CustomEquipment, Method } from '@/lib/core/config';
import { commonMethods, equipmentList } from '@/lib/core/config';
import type { SettingsOptions } from '@/lib/core/db';
import type { Grinder } from '@/lib/stores/grinderStore';
import type { LucideIcon } from 'lucide-react';
import { pinyin } from 'pinyin-pro';
import {
  CONFIGURABLE_COFFEE_BEAN_VIEW_ORDER,
  getMainNavigationTabLabel,
  MAIN_NAVIGATION_TABS,
  type MainNavigationTab,
} from '@/lib/navigation/navigationSettings';
import {
  SIMPLIFIED_VIEW_LABELS,
  VIEW_LABELS,
} from '@/components/coffee-bean/List/constants';
import type { CoffeeBean } from '@/types/app';
import { extractUniqueRoasters } from '@/lib/utils/beanVarietyUtils';
import { normalizeCoffeeBeanGroups } from '@/lib/utils/coffeeBeanGroupUtils';

export type SettingsSearchPageId =
  | 'settings'
  | 'display-settings'
  | 'navigation-settings'
  | 'stock-settings'
  | 'bean-settings'
  | 'green-bean-settings'
  | 'coffee-bean-group-settings'
  | 'flavor-period-settings'
  | 'brewing-settings'
  | 'timer-settings'
  | 'data-settings'
  | 'notification-settings'
  | 'random-coffee-bean-settings'
  | 'equipment-method-settings'
  | 'note-settings'
  | 'flavor-dimension-settings'
  | 'roaster-logo-settings'
  | 'grinder-settings'
  | 'experimental-settings'
  | 'about-settings';

export interface SettingsSearchTarget {
  pageId: SettingsSearchPageId;
  settingId: string;
}

export interface SettingsSearchItem extends SettingsSearchTarget {
  id: string;
  label: string;
  icon?: LucideIcon;
  value?: string;
  description?: string;
  groupLabel?: string;
  entryPath?: string[];
  keywords?: string[];
}

export interface SettingsSearchEntryMetadata {
  label: string;
  icon?: LucideIcon;
}

export type SettingsSearchEntryMetadataMap = Partial<
  Record<SettingsSearchPageId, SettingsSearchEntryMetadata>
>;

interface BuildSettingsSearchItemsOptions {
  settings: SettingsOptions;
  visibleModules: Record<MainNavigationTab, boolean>;
  hasVisibleNotificationSettings: boolean;
  beans: CoffeeBean[];
  customEquipments: CustomEquipment[];
  customMethodsByEquipment: Record<string, Method[]>;
  grinders: Grinder[];
}

type SearchItemInput = Omit<SettingsSearchItem, 'id' | 'settingId'> & {
  settingId?: string;
};

export const makeSettingsSearchId = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKC')
    .trim()
    .replace(/[\s/]+/g, '-')
    .replace(/[^\p{Letter}\p{Number}_-]+/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'item';

export const makeSettingRowSearchId = (label: string) =>
  `row-${makeSettingsSearchId(label)}`;

export const makeDynamicSettingSearchId = (prefix: string, value: string) =>
  `${prefix}-${makeSettingsSearchId(value)}`;

export const normalizeSettingsSearchText = (value: string) =>
  value.toLowerCase().normalize('NFKC').replace(/\s+/g, ' ').trim();

const getPinyinText = (value: string) => {
  if (!value) return '';

  const full = pinyin(value, { toneType: 'none' });
  const initials = pinyin(value, { pattern: 'first', toneType: 'none' });

  return [
    full,
    full.replace(/\s+/g, ''),
    initials,
    initials.replace(/\s+/g, ''),
  ].join(' ');
};

const buildSettingsSearchText = (item: SettingsSearchItem) =>
  normalizeSettingsSearchText(
    [
      item.label,
      item.value,
      item.description,
      item.groupLabel,
      ...(item.entryPath || []),
      ...(item.keywords || []),
      getPinyinText(item.label),
      item.groupLabel ? getPinyinText(item.groupLabel) : '',
      ...(item.entryPath || []).map(getPinyinText),
      ...(item.keywords || []).map(getPinyinText),
    ]
      .filter(Boolean)
      .join(' ')
  );

export const filterSettingsSearchItems = (
  items: SettingsSearchItem[],
  query: string
) => {
  const tokens = normalizeSettingsSearchText(query).split(' ').filter(Boolean);
  if (tokens.length === 0) return [];

  return items.filter(item => {
    const searchText = buildSettingsSearchText(item);
    return tokens.every(token => searchText.includes(token));
  });
};

const buildEntryPath = (
  entryLabel: string | undefined,
  groupLabel: string | undefined
) => {
  if (!entryLabel) return groupLabel ? [groupLabel] : undefined;
  if (!groupLabel || entryLabel === groupLabel) return [entryLabel];
  if (entryLabel.includes(groupLabel) || groupLabel.includes(entryLabel)) {
    return [entryLabel];
  }
  return [entryLabel, groupLabel];
};

export const applySettingsSearchEntryMetadata = (
  items: SettingsSearchItem[],
  metadata: SettingsSearchEntryMetadataMap
) =>
  items.map(item => {
    const entry = metadata[item.pageId];
    return {
      ...item,
      icon: item.icon ?? entry?.icon,
      entryPath:
        item.entryPath ?? buildEntryPath(entry?.label, item.groupLabel),
    };
  });

const createItem = ({
  pageId,
  settingId,
  label,
  icon,
  value,
  description,
  groupLabel,
  entryPath,
  keywords,
}: SearchItemInput): SettingsSearchItem => {
  const resolvedSettingId = settingId ?? makeSettingRowSearchId(label);
  return {
    id: `${pageId}:${resolvedSettingId}`,
    pageId,
    settingId: resolvedSettingId,
    label,
    icon,
    value,
    description,
    groupLabel,
    entryPath,
    keywords,
  };
};

const createRowItems = (
  pageId: SettingsSearchPageId,
  pageLabel: string,
  labels: Array<
    string | { label: string; description?: string; value?: string }
  >
) =>
  labels.map(item => {
    const data = typeof item === 'string' ? { label: item } : item;
    return createItem({
      pageId,
      groupLabel: pageLabel,
      ...data,
    });
  });

const isModuleVisible = (
  visibleModules: Record<MainNavigationTab, boolean>,
  module: MainNavigationTab
) => visibleModules[module];

const getMethodId = (method: Method) => method.id || method.name;

export const buildSettingsSearchItems = ({
  settings,
  visibleModules,
  hasVisibleNotificationSettings,
  beans,
  customEquipments,
  customMethodsByEquipment,
  grinders,
}: BuildSettingsSearchItemsOptions): SettingsSearchItem[] => {
  const items: SettingsSearchItem[] = [
    ...createRowItems('display-settings', '外观', [
      '外观模式',
      '字体',
      '显示菜单栏图标',
      '顶部边距',
      '底部边距',
    ]),
    ...createRowItems('data-settings', '数据与备份', [
      '同步服务',
      '备份服务',
      '持久化存储',
      '备份提醒',
      '提醒频率',
      '下拉上传',
      '引导式配置',
      '数据管理',
      '导入数据',
      '导出数据',
      '重置数据',
      '图片补压',
    ]),
    ...createRowItems('about-settings', '关于', [
      '隐私政策',
      '开源致谢',
      '相关链接',
    ]),
  ];

  if (hasVisibleNotificationSettings) {
    items.push(
      ...createRowItems('notification-settings', '提醒通知', [
        '提示音',
        '震动反馈',
        '更新提示',
        '提醒弹窗',
        '同步日历',
      ])
    );
  }

  items.push(
    ...createRowItems('navigation-settings', '应用功能', [
      '启用的功能',
      '视图显示',
      '固定视图',
      '简化标签名称',
    ])
  );

  MAIN_NAVIGATION_TABS.forEach(tab => {
    items.push(
      createItem({
        pageId: 'navigation-settings',
        settingId: makeDynamicSettingSearchId('navigation-tab', tab),
        label: getMainNavigationTabLabel(tab, settings.simplifiedViewLabels),
        groupLabel: '启用的功能',
        keywords: [
          getMainNavigationTabLabel(tab, false),
          getMainNavigationTabLabel(tab, true),
          '应用功能',
        ],
      })
    );
  });

  if (visibleModules.coffeeBean) {
    CONFIGURABLE_COFFEE_BEAN_VIEW_ORDER.forEach(view => {
      const label = settings.simplifiedViewLabels
        ? SIMPLIFIED_VIEW_LABELS[view]
        : VIEW_LABELS[view];
      const keywords = [
        VIEW_LABELS[view],
        SIMPLIFIED_VIEW_LABELS[view],
        '视图',
      ];

      items.push(
        createItem({
          pageId: 'navigation-settings',
          settingId: makeDynamicSettingSearchId(
            'navigation-view-display',
            view
          ),
          label,
          groupLabel: '视图显示',
          keywords,
        }),
        createItem({
          pageId: 'navigation-settings',
          settingId: makeDynamicSettingSearchId('navigation-view-pin', view),
          label,
          groupLabel: '固定视图',
          keywords: [...keywords, '固定'],
        })
      );
    });
  }

  if (isModuleVisible(visibleModules, 'brewing')) {
    items.push(
      ...createRowItems('brewing-settings', '冲煮', ['咖啡豆选择步骤']),
      ...createRowItems('timer-settings', '计时器', [
        '显示流速',
        '可视化冲煮',
        '进度条高度',
        '数据显示字体大小',
        '步骤时间显示',
      ])
    );
  }

  if (isModuleVisible(visibleModules, 'coffeeBean')) {
    items.push(
      ...createRowItems('bean-settings', '咖啡豆', [
        '日期模式',
        '价格',
        '总价',
        '状态点',
        '备注',
        '风味',
        '备注内容',
        '备注行数限制',
        '标签打印',
        '评分',
        '十分位制',
        '自动填充图片',
        '烘焙商',
        '烘焙商分隔符',
      ]),
      ...createRowItems('stock-settings', '库存扣除', [
        '启用“全部扣除”选项',
        '启用自定义扣除输入',
        '预设快捷扣除量',
      ]),
      ...createRowItems('green-bean-settings', '生豆库', [
        '启用生豆库',
        '启用"全部烘焙"选项',
        '启用自定义烘焙量输入',
        '预设快捷烘焙量',
        '熟豆转生豆',
      ]),
      ...createRowItems('flavor-period-settings', '赏味期', [
        '浅烘',
        '中烘',
        '深烘',
      ]),
      ...createRowItems('random-coffee-bean-settings', '随机咖啡豆', [
        '长按随机不同类型咖啡豆',
        '长按时随机的类型',
        '养豆期',
        '赏味期',
        '衰退期',
        '冷冻',
        '在途',
        '未知状态',
      ])
    );

    normalizeCoffeeBeanGroups(settings.coffeeBeanGroups, beans).forEach(
      group => {
        items.push(
          createItem({
            pageId: 'coffee-bean-group-settings',
            settingId: makeDynamicSettingSearchId('group', group.id),
            label: group.name,
            value: `${group.beanIds.length} 个豆子`,
            groupLabel: '分组',
            keywords: ['咖啡豆分组', '分组'],
          })
        );
      }
    );

    const roasterNames = new Set([
      ...extractUniqueRoasters(beans, {
        roasterFieldEnabled: settings.roasterFieldEnabled,
        roasterSeparator: settings.roasterSeparator,
      }),
      ...(settings.roasterConfigs || []).map(config => config.roasterName),
    ]);
    const sortedRoasterNames = Array.from(roasterNames)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'zh-CN'));

    if (sortedRoasterNames.length > 0) {
      items.push(
        createItem({
          pageId: 'flavor-period-settings',
          label: '烘焙商特定预设',
          groupLabel: '赏味期',
          keywords: ['烘焙商', '赏味期', '预设'],
        })
      );
    }

    sortedRoasterNames.forEach(roaster => {
      const hasLogo = Boolean(
        settings.roasterConfigs?.find(config => config.roasterName === roaster)
          ?.logoData
      );
      items.push(
        createItem({
          pageId: 'roaster-logo-settings',
          settingId: makeDynamicSettingSearchId('roaster', roaster),
          label: roaster,
          value: hasLogo ? '已设置图标' : undefined,
          groupLabel: '烘焙商图标',
          keywords: ['烘焙商', '图标', 'logo', 'roaster'],
        })
      );
    });
  }

  if (isModuleVisible(visibleModules, 'notes')) {
    items.push(
      ...createRowItems('note-settings', '笔记', [
        '经典列表样式',
        '评分维度入口',
        '价格',
        '养豆',
        '风味',
        '时间',
        '评分',
        '使用滑块评分',
        '风味评分',
        '半分制',
        '十分位制',
        '初始值跟随总评',
        '容量调整记录',
      ])
    );

    (settings.flavorDimensions || []).forEach(dimension => {
      items.push(
        createItem({
          pageId: 'flavor-dimension-settings',
          settingId: makeDynamicSettingSearchId('dimension', dimension.id),
          label: dimension.label,
          value: dimension.isDefault ? '默认维度' : '自定义维度',
          groupLabel: '评分维度',
          keywords: ['风味评分', '评分维度'],
        })
      );
    });
  }

  if (
    isModuleVisible(visibleModules, 'brewing') ||
    isModuleVisible(visibleModules, 'notes')
  ) {
    items.push(
      ...createRowItems('grinder-settings', '磨豆机', [
        '磨豆机系统使用指南',
        '默认同步设置',
        '导航栏参数栏',
        '方案表单',
        '手动添加笔记',
        '笔记编辑表单',
        '显示刻度指示器',
        '添加磨豆机',
      ]),
      ...createRowItems('equipment-method-settings', '器具和方案', ['添加器具'])
    );

    grinders.forEach(grinder => {
      items.push(
        createItem({
          pageId: 'grinder-settings',
          settingId: makeDynamicSettingSearchId('grinder', grinder.id),
          label: grinder.name,
          value: grinder.currentGrindSize,
          groupLabel: '磨豆机',
          keywords: ['磨豆机', '研磨度', '刻度'],
        })
      );
    });

    const customEquipmentIds = new Set(
      customEquipments.map(equipment => equipment.id)
    );
    equipmentList.forEach(equipment => {
      items.push(
        createItem({
          pageId: 'equipment-method-settings',
          settingId: makeDynamicSettingSearchId('equipment', equipment.id),
          label:
            settings.equipmentNameOverrides?.[equipment.id]?.trim() ||
            equipment.name,
          value: settings.hiddenEquipments?.includes(equipment.id)
            ? '已隐藏'
            : undefined,
          groupLabel: '预设器具',
          keywords: ['器具', '方案'],
        })
      );
    });
    customEquipments.forEach(equipment => {
      items.push(
        createItem({
          pageId: 'equipment-method-settings',
          settingId: makeDynamicSettingSearchId('equipment', equipment.id),
          label: equipment.name,
          groupLabel: '自定义器具',
          keywords: ['器具', '方案'],
        })
      );
    });

    Object.entries(customMethodsByEquipment).forEach(
      ([equipmentId, methods]) => {
        methods.forEach(method => {
          const equipmentName =
            customEquipments.find(equipment => equipment.id === equipmentId)
              ?.name ||
            equipmentList.find(equipment => equipment.id === equipmentId)
              ?.name ||
            equipmentId;
          items.push(
            createItem({
              pageId: 'equipment-method-settings',
              settingId: makeDynamicSettingSearchId(
                'method',
                `${equipmentId}-${getMethodId(method)}`
              ),
              label: method.name,
              value: equipmentName,
              groupLabel: '自定义方案',
              keywords: ['冲煮方案', '方案', equipmentName],
            })
          );
        });
      }
    );

    Object.entries(commonMethods).forEach(([equipmentId, methods]) => {
      if (customEquipmentIds.has(equipmentId)) return;

      methods.forEach(method => {
        const methodId = getMethodId(method);
        const equipmentName =
          settings.equipmentNameOverrides?.[equipmentId]?.trim() ||
          equipmentList.find(equipment => equipment.id === equipmentId)?.name ||
          equipmentId;
        items.push(
          createItem({
            pageId: 'equipment-method-settings',
            settingId: makeDynamicSettingSearchId(
              'method',
              `${equipmentId}-${methodId}`
            ),
            label: method.name,
            value: equipmentName,
            groupLabel: '预设方案',
            keywords: ['冲煮方案', '方案', equipmentName],
          })
        );
      });
    });
  }

  if (isModuleVisible(visibleModules, 'coffeeBean')) {
    items.push(
      ...createRowItems('experimental-settings', '实验性功能', [
        '沉浸式表单',
        '咖啡豆字段',
        '产地',
        '产国',
        '产区',
        '庄园',
        '海拔',
        '处理法',
        '批次',
        '品种',
        '设置全局搜索',
        '最大显示容量',
        '自定义识别咖啡豆 API',
      ])
    );
  } else {
    items.push(
      ...createRowItems('experimental-settings', '实验性功能', [
        '设置全局搜索',
      ])
    );
  }

  if (isModuleVisible(visibleModules, 'coffeeBean')) {
    if (settings.enableBeanSummaryCapacityLimit) {
      items.push(
        ...createRowItems('experimental-settings', '实验性功能', [
          '超过上限循环显示',
          '显示上限',
        ])
      );
    }

    if (settings.experimentalBeanRecognitionEnabled) {
      items.push(
        ...createRowItems('experimental-settings', '自定义识别咖啡豆 API', [
          'API URL',
          'API Key',
          'Model',
          'System Prompt',
          '测试连接',
        ])
      );
    }
  }

  if (isModuleVisible(visibleModules, 'notes')) {
    items.push(
      ...createRowItems('experimental-settings', '实验性功能', [
        '同步筛选日期',
        '快捷扣除',
      ])
    );
  }

  return items;
};
