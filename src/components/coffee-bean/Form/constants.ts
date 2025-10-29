// 预设选项
export const DEFAULT_ORIGINS = [
  '埃塞俄比亚',
  '巴西',
  '哥伦比亚',
  '危地马拉',
  '肯尼亚',
  '洪都拉斯',
  '哥斯达黎加',
  '秘鲁',
  '印度尼西亚',
  '牙买加',
  '也门',
  '越南',
  '墨西哥',
  '卢旺达',
  '坦桑尼亚',
  '巴拿马',
  '云南',
  '云南保山',
];

export const DEFAULT_PROCESSES = [
  '水洗',
  '日晒',
  '蜜处理',
  '半水洗',
  '黑蜜',
  '白蜜',
  '红蜜',
  '黄蜜',
  '厌氧发酵',
  '碳酸浸泡',
  '双重发酵',
  '干燥处理',
  '湿刷处理',
];

export const DEFAULT_VARIETIES = [
  '铁皮卡',
  '卡杜拉',
  '卡图拉',
  '波旁',
  '原生种',
  '瑰夏',
  '红波旁',
  '黄波旁',
  'SL28',
  'SL34',
  '西达摩',
  '卡蒂姆',
  '帕卡马拉',
  '卡斯蒂洛',
  '芒果',
  '卡杜艾',
  '芒多当新',
  '巴西天然种',
];

// 检查是否在浏览器环境中
const isBrowser = typeof window !== 'undefined';

// 从本地存储获取自定义预设
const getCustomPresets = (key: string): string[] => {
  if (!isBrowser) return []; // 服务器端渲染时返回空数组

  try {
    const stored = localStorage.getItem(`brew-guide:custom-presets:${key}`);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error(`获取自定义${key}失败:`, e);
    return [];
  }
};

// 保存自定义预设到本地存储
const saveCustomPresets = (key: string, presets: string[]): void => {
  if (!isBrowser) return; // 服务器端渲染时不执行

  try {
    localStorage.setItem(
      `brew-guide:custom-presets:${key}`,
      JSON.stringify(presets)
    );
  } catch (e) {
    console.error(`保存自定义${key}失败:`, e);
  }
};

// 添加自定义预设
export const addCustomPreset = (
  key: 'origins' | 'processes' | 'varieties',
  value: string
): void => {
  if (!isBrowser || !value.trim()) return;

  const presets = getCustomPresets(key);
  if (!presets.includes(value)) {
    // 将新预设添加到数组开头，这样最新的预设会优先显示
    presets.unshift(value);
    saveCustomPresets(key, presets);
  }
};

// 删除自定义预设
export const removeCustomPreset = (
  key: 'origins' | 'processes' | 'varieties',
  value: string
): void => {
  if (!isBrowser) return;

  const presets = getCustomPresets(key);
  const index = presets.indexOf(value);
  if (index !== -1) {
    presets.splice(index, 1);
    saveCustomPresets(key, presets);
  }
};

// 检查是否为自定义预设
export const isCustomPreset = (
  key: 'origins' | 'processes' | 'varieties',
  value: string
): boolean => {
  if (!isBrowser) return false;
  return getCustomPresets(key).includes(value);
};

// 获取完整预设列表（自定义+默认）
export const getFullPresets = (
  key: 'origins' | 'processes' | 'varieties'
): string[] => {
  const defaults = {
    origins: DEFAULT_ORIGINS,
    processes: DEFAULT_PROCESSES,
    varieties: DEFAULT_VARIETIES,
  };
  // 将自定义预设放在前面，这样用户最近添加的内容会优先显示
  return [...getCustomPresets(key), ...defaults[key]];
};

// 导出合并后的预设（向后兼容）
const ORIGINS = getFullPresets('origins');
const PROCESSES = getFullPresets('processes');
const VARIETIES = getFullPresets('varieties');

// 预设风味标签
export const FLAVOR_TAGS = [
  // 水果类
  '柑橘',
  '佛手柑',
  '橙子',
  '柠檬',
  '青柠',
  '葡萄柚',
  '橘子',
  '金橘',
  '热带水果',
  '菠萝',
  '芒果',
  '百香果',
  '木瓜',
  '荔枝',
  '龙眼',
  '浆果',
  '蓝莓',
  '草莓',
  '黑莓',
  '树莓',
  '蔓越莓',
  '红醋栗',
  '核果',
  '桃子',
  '杏子',
  '李子',
  '樱桃',
  '油桃',
  '蜜桃',
  '苹果',
  '梨子',
  '水梨',
  '香蕉',
  '西瓜',
  '哈密瓜',
  '鲜枣',
  '干果',
  '葡萄干',
  '无花果',
  '椰子',
  '榴莲',
  '西梅干',
  '石榴',

  // 花香类
  '花香',
  '茉莉',
  '玫瑰',
  '紫罗兰',
  '洋甘菊',
  '橙花',
  '栀子花',
  '金银花',
  '薰衣草',
  '兰花',
  '牡丹',
  '桂花',
  '丁香',
  '香柏',
  '立顿红茶香',

  // 甜味类
  '焦糖',
  '蜂蜜',
  '黑糖',
  '红糖',
  '枫糖',
  '太妃糖',
  '蔗糖',
  '巧克力',
  '牛奶巧克力',
  '黑巧克力',
  '白巧克力',
  '可可粉',
  '可可豆',
  '奶油',
  '奶酪',
  '炼乳',
  '香草',
  '蛋糕',
  '饼干',
  '布丁',
  '糖蜜',
  '棉花糖',
  '麦芽糖',
  '威化',
  '杏仁糖',
  '椰蓉',

  // 坚果类
  '坚果',
  '杏仁',
  '榛子',
  '核桃',
  '腰果',
  '花生',
  '松子',
  '开心果',
  '栗子',
  '夏威夷果',
  '巴西果',
  '碧根果',
  '瓜子',

  // 香料类
  '肉桂',
  '丁香',
  '豆蔻',
  '八角',
  '茴香',
  '花椒',
  '胡椒',
  '黑胡椒',
  '白胡椒',
  '姜',
  '肉豆蔻',
  '藏红花',
  '辣椒',
  '咖喱',
  '茴芹香',
  '辛辣刺感',

  // 草本类
  '草本',
  '薄荷',
  '罗勒',
  '香菜',
  '迷迭香',
  '百里香',
  '鼠尾草',
  '青草',
  '干草',
  '烘干草',
  '绿茶',
  '苔藓',
  '叶子',
  '野草',
  '未成熟',
  '豆荚类',
  '鲜草味',
  '深色青蔬',
  '根茎味',
  '墨西哥斑豆味',
  '生青味',
  '橄榄油感',
  '香草味',

  // 谷物/烘焙类
  '麦芽',
  '烤面包',
  '烤麦',
  '大麦',
  '燕麦',
  '烤杏仁',
  '烤榛子',
  '烤花生',
  '烘焙香',
  '烤坚果',
  '爆米花',
  '饼干',
  '华夫饼',
  '谷物味',
  '棕焙香',
  '烟熏香',
  '灰质感',
  '焦呛苦香',
  '烤制烟草香',
  '复合烟草香',

  // 酒类/发酵类
  '红酒',
  '白葡萄酒',
  '威士忌',
  '朗姆酒',
  '酒酿',
  '发酵',
  '啤酒花',
  '香槟',
  '波特酒',
  '雪莉酒',
  '白兰地',
  '伏特加',
  '发酵感',
  '过度成熟',
  '醋酸',
  '乳酸',
  '柠檬酸',
  '苹果酸',

  // 茶类
  '红茶',
  '伯爵茶',
  '茶香',
  '绿茶',
  '乌龙茶',
  '普洱',
  '抹茶',
  '茉莉茶',
  '菊花茶',
  '铁观音',
  '金骏眉',
  '大红袍',

  // 其他
  '木质',
  '菸草',
  '皮革',
  '松木',
  '杉木',
  '樟木',
  '檀木',
  '清新',
  '回甘',
  '明亮',
  '醇厚',
  '甘甜',
  '酸爽',
  '干净',
  '浓郁',
  '平衡',
  '复杂',
  '层次',
  '丝滑',
  '圆润',
  '顺滑',
  '活泼',
  '沉稳',
  '优雅',
  '野性',
  '馥郁',
  '醇香',
  '细腻',
  '轻盈',
  '厚重',
  '矿物质',
  '海盐',
  '烟熏',
  '焦糖化',
  '橡胶味',
  '臭鼬味',
  '石油味',
  '药物味',
  '酚味',
  '肉香',
  '肉汤香',
  '霉泥味',
  '霉尘味',
  '霉潮味',
  '木质味',
  '滤纸味',
  '卡纸味',
  '氧旧味',
  '咸味',
  '苦味',
  '酸味',
  '鲜味',
  '甜味',
  '粗糙感',
  '砂砾感',
  '粉尘感',
  '细土感',
  '顺滑感',
  '天鹅绒般顺滑',
  '丝绸般顺滑',
  '糖浆般顺滑',
  '油脂感',
  '金属感',
  '口腔发干',
];

// 风味分类
export const FLAVOR_CATEGORIES = {
  水果类: [
    '柑橘',
    '柠檬',
    '酸橙',
    '青柠',
    '苹果',
    '葡萄',
    '蓝莓',
    '草莓',
    '樱桃',
    '桃子',
    '杏子',
    '菠萝',
    '热带水果',
    '红酒',
    '葡萄柚',
    '橙子',
    '椰子',
    '梨',
    '石榴',
    '西梅干',
    '葡萄干',
  ],
  花香类: ['茉莉', '玫瑰', '紫罗兰', '橙花', '薰衣草', '洋甘菊', '立顿红茶香'],
  甜味类: [
    '焦糖',
    '太妃糖',
    '蜂蜜',
    '红糖',
    '黑糖',
    '可可',
    '巧克力',
    '麦芽糖',
    '枫糖',
    '糖蜜',
  ],
  坚果类: ['杏仁', '榛子', '核桃', '花生', '腰果', '开心果'],
  香料类: [
    '肉桂',
    '丁香',
    '豆蔻',
    '胡椒',
    '姜',
    '肉豆蔻',
    '辛辣刺感',
    '茴芹香',
  ],
  '谷物/烘焙类': [
    '烤面包',
    '饼干',
    '谷物',
    '麦片',
    '麦芽',
    '烤核桃',
    '谷物味',
    '棕焙香',
    '烟熏香',
    '灰质感',
    '焦呛苦香',
  ],
  '酒类/发酵类': [
    '红酒',
    '威士忌',
    '发酵感',
    '过度成熟',
    '醋酸',
    '乳酸',
    '柠檬酸',
    '苹果酸',
  ],
  茶类: ['红茶', '绿茶', '花茶', '白茶'],
  烟草类: ['烤制烟草香', '复合烟草香', '菸草'],
  '青涩/植蔬类': [
    '未成熟',
    '豆荚类',
    '鲜草味',
    '深色青蔬',
    '根茎味',
    '干草味',
    '香草味',
    '墨西哥斑豆味',
    '生青味',
    '橄榄油感',
  ],
  口感类: [
    '粗糙感',
    '砂砾感',
    '粉尘感',
    '细土感',
    '顺滑感',
    '天鹅绒般顺滑',
    '丝绸般顺滑',
    '糖浆般顺滑',
    '油脂感',
    '金属感',
    '口腔发干',
  ],
  其他: [
    '矿物质',
    '海盐',
    '烟熏',
    '焦糖化',
    '清爽',
    '醇厚',
    '皮革',
    '橡胶味',
    '臭鼬味',
    '石油味',
    '药物味',
    '酚味',
    '肉香',
    '肉汤香',
    '霉泥味',
    '霉尘味',
    '霉潮味',
    '木质味',
    '滤纸味',
    '卡纸味',
    '氧旧味',
    '咸味',
    '苦味',
    '酸味',
    '鲜味',
    '甜味',
  ],
};

// 动画配置
export const pageVariants = {
  initial: {
    opacity: 0,
  },
  in: {
    opacity: 1,
  },
  out: {
    opacity: 0,
  },
};

export const pageTransition = {
  type: 'tween',
  ease: 'easeInOut',
  duration: 0.2,
};
