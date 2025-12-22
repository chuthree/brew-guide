/**
 * 咖啡产区坐标数据
 *
 * 免责声明：
 * 本数据仅用于标注全球咖啡种植产区的地理位置，不涉及任何政治主权或领土主张。
 * 产区划分基于咖啡行业通用的地理分类，仅供咖啡爱好者参考。
 * 地图采用点阵形式呈现，不显示任何政治边界。
 *
 * 使用咖啡产区名称而非国家名称，避免敏感性问题
 * 坐标数据来源: OpenStreetMap Nominatim API
 *
 * 主要咖啡产区分布在"咖啡带"（Coffee Belt）：
 * 北纬25度到南纬25度之间的热带和亚热带地区
 */

export interface CoffeeRegion {
  /** 产区名称（中文） */
  name: string;
  /** 产区名称变体（用于匹配用户输入） */
  aliases: string[];
  /** 纬度 */
  lat: number;
  /** 经度 */
  lng: number;
}

/**
 * 咖啡产区数据
 * 按地理区域分组，便于管理和扩展
 */
export const COFFEE_REGIONS: CoffeeRegion[] = [
  // ==================== 非洲 ====================
  {
    name: '耶加雪菲',
    aliases: ['耶加雪菲', 'Yirgacheffe', 'yirgacheffe', '耶加雪啡', '耶加'],
    lat: 6.152938,
    lng: 38.202317,
  },
  {
    name: '西达摩',
    aliases: ['西达摩', 'Sidamo', 'sidamo', '锡达莫', 'Sidama'],
    lat: 6.65075,
    lng: 38.479679,
  },
  {
    name: '古吉',
    aliases: ['古吉', 'Guji', 'guji', '谷吉'],
    lat: 5.85,
    lng: 38.65,
  },
  {
    name: '哈拉尔',
    aliases: ['哈拉尔', 'Harrar', 'harrar', 'Harar', '哈拉'],
    lat: 9.31184,
    lng: 42.128445,
  },
  {
    name: '利姆',
    aliases: ['利姆', 'Limu', 'limu', '林姆'],
    lat: 8.18333,
    lng: 35.58333,
  },
  {
    name: '埃塞俄比亚',
    aliases: [
      '埃塞俄比亚',
      'Ethiopia',
      'ethiopia',
      '衣索比亚',
      '埃塞',
      '衣索匹亚',
    ],
    lat: 10.21167,
    lng: 38.65212,
  },
  {
    name: '肯尼亚',
    aliases: ['肯尼亚', 'Kenya', 'kenya', '肯亚'],
    lat: 1.442,
    lng: 38.4314,
  },
  {
    name: '尼耶利',
    aliases: ['尼耶利', 'Nyeri', 'nyeri', '涅里'],
    lat: 0.012,
    lng: 37.0766,
  },
  {
    name: '坦桑尼亚',
    aliases: ['坦桑尼亚', 'Tanzania', 'tanzania', '坦尚尼亚'],
    lat: -6.5247,
    lng: 35.7878,
  },
  {
    name: '卢旺达',
    aliases: ['卢旺达', 'Rwanda', 'rwanda', '盧安達'],
    lat: -1.9647,
    lng: 30.0644,
  },
  {
    name: '布隆迪',
    aliases: ['布隆迪', 'Burundi', 'burundi', '蒲隆地'],
    lat: -3.4264,
    lng: 29.9325,
  },
  {
    name: '乌干达',
    aliases: ['乌干达', 'Uganda', 'uganda', '烏干達'],
    lat: 1.5334,
    lng: 32.2167,
  },
  {
    name: '刚果',
    aliases: ['刚果', 'Congo', 'congo', 'DRC', '剛果'],
    lat: -2.9814,
    lng: 23.8223,
  },
  {
    name: '马拉维',
    aliases: ['马拉维', 'Malawi', 'malawi', '馬拉威'],
    lat: -13.2687,
    lng: 33.9302,
  },
  {
    name: '赞比亚',
    aliases: ['赞比亚', 'Zambia', 'zambia', '尚比亞'],
    lat: -14.5189,
    lng: 27.559,
  },
  {
    name: '津巴布韦',
    aliases: ['津巴布韦', 'Zimbabwe', 'zimbabwe', '辛巴威'],
    lat: -18.4555,
    lng: 29.7468,
  },
  {
    name: '喀麦隆',
    aliases: ['喀麦隆', 'Cameroon', 'cameroon', '喀麥隆'],
    lat: 4.6126,
    lng: 13.1536,
  },
  {
    name: '科特迪瓦',
    aliases: [
      '科特迪瓦',
      'Ivory Coast',
      'ivory coast',
      '象牙海岸',
      "Côte d'Ivoire",
    ],
    lat: 7.9897,
    lng: -5.5679,
  },

  // ==================== 中美洲 ====================
  {
    name: '危地马拉',
    aliases: ['危地马拉', 'Guatemala', 'guatemala', '瓜地马拉', '瓜地馬拉'],
    lat: 15.5856,
    lng: -90.3458,
  },
  {
    name: '安提瓜',
    aliases: ['安提瓜', 'Antigua', 'antigua', '安地瓜'],
    lat: 14.5568,
    lng: -90.7337,
  },
  {
    name: '韦韦特南戈',
    aliases: ['韦韦特南戈', 'Huehuetenango', 'huehuetenango', '薇薇特南果'],
    lat: 15.6064,
    lng: -91.6442,
  },
  {
    name: '阿卡特南戈',
    aliases: ['阿卡特南戈', 'Acatenango', 'acatenango'],
    lat: 14.5007,
    lng: -90.8757,
  },
  {
    name: '科班',
    aliases: ['科班', 'Coban', 'coban', '科潘'],
    lat: 15.4702,
    lng: -90.3735,
  },
  {
    name: '哥斯达黎加',
    aliases: ['哥斯达黎加', 'Costa Rica', 'costa rica', '哥斯大黎加'],
    lat: 10.273563,
    lng: -84.07391,
  },
  {
    name: '塔拉珠',
    aliases: ['塔拉珠', 'Tarrazu', 'tarrazu', '塔拉蘇'],
    lat: 9.582803,
    lng: -84.065919,
  },
  {
    name: '西部山谷',
    aliases: ['西部山谷', 'West Valley', 'west valley', '西谷'],
    lat: 10.05,
    lng: -84.25,
  },
  {
    name: '巴拿马',
    aliases: ['巴拿马', 'Panama', 'panama', '巴拿馬'],
    lat: 8.559559,
    lng: -81.130843,
  },
  {
    name: '波奎特',
    aliases: ['波奎特', 'Boquete', 'boquete', '博克特'],
    lat: 8.74075,
    lng: -82.385383,
  },
  {
    name: '沃肯',
    aliases: ['沃肯', 'Volcan', 'volcan', '沃尔坎'],
    lat: 8.780619,
    lng: -82.644269,
  },
  {
    name: '洪都拉斯',
    aliases: ['洪都拉斯', 'Honduras', 'honduras', '宏都拉斯'],
    lat: 15.2572,
    lng: -86.0755,
  },
  {
    name: '萨尔瓦多',
    aliases: ['萨尔瓦多', 'El Salvador', 'el salvador', '薩爾瓦多'],
    lat: 13.8,
    lng: -88.9141,
  },
  {
    name: '尼加拉瓜',
    aliases: ['尼加拉瓜', 'Nicaragua', 'nicaragua'],
    lat: 12.3506,
    lng: -85.7841,
  },
  {
    name: '墨西哥',
    aliases: ['墨西哥', 'Mexico', 'mexico', '墨國'],
    lat: 23.6585,
    lng: -102.0077,
  },
  {
    name: '恰帕斯',
    aliases: ['恰帕斯', 'Chiapas', 'chiapas'],
    lat: 16.5,
    lng: -92.5,
  },
  {
    name: '瓦哈卡',
    aliases: ['瓦哈卡', 'Oaxaca', 'oaxaca'],
    lat: 17.0,
    lng: -96.5,
  },
  {
    name: '韦拉克鲁斯',
    aliases: ['韦拉克鲁斯', 'Veracruz', 'veracruz'],
    lat: 19.3333,
    lng: -96.6667,
  },

  // ==================== 南美洲 ====================
  {
    name: '巴西',
    aliases: ['巴西', 'Brazil', 'brazil', 'Brasil'],
    lat: -10.3333,
    lng: -53.2,
  },
  {
    name: '米纳斯吉拉斯',
    aliases: ['米纳斯吉拉斯', 'Minas Gerais', 'minas gerais', '米納斯'],
    lat: -18.5265,
    lng: -44.1589,
  },
  {
    name: '圣保罗',
    aliases: ['圣保罗', 'Sao Paulo', 'sao paulo', 'São Paulo', '聖保羅'],
    lat: -23.5343,
    lng: -46.6339,
  },
  {
    name: '巴伊亚',
    aliases: ['巴伊亚', 'Bahia', 'bahia', '巴伊亞'],
    lat: -12.2853,
    lng: -41.9295,
  },
  {
    name: '哥伦比亚',
    aliases: ['哥伦比亚', 'Colombia', 'colombia', '哥倫比亞'],
    lat: 4.0999,
    lng: -72.9088,
  },
  {
    name: '慧兰',
    aliases: ['慧兰', 'Huila', 'huila', '惠蘭', '薇拉'],
    lat: 2.4739,
    lng: -75.59,
  },
  {
    name: '娜玲珑',
    aliases: ['娜玲珑', 'Narino', 'narino', 'Nariño', '纳里尼奥'],
    lat: 1.5842,
    lng: -77.8586,
  },
  {
    name: '考卡',
    aliases: ['考卡', 'Cauca', 'cauca'],
    lat: 2.7156,
    lng: -76.6627,
  },
  {
    name: '桑坦德',
    aliases: ['桑坦德', 'Santander', 'santander'],
    lat: 7.0,
    lng: -73.25,
  },
  {
    name: '托利马',
    aliases: ['托利马', 'Tolima', 'tolima'],
    lat: 4.0356,
    lng: -75.2087,
  },
  {
    name: '秘鲁',
    aliases: ['秘鲁', 'Peru', 'peru', '祕魯'],
    lat: -6.87,
    lng: -75.0459,
  },
  {
    name: '卡哈马卡',
    aliases: ['卡哈马卡', 'Cajamarca', 'cajamarca'],
    lat: -6.25,
    lng: -78.8333,
  },
  {
    name: '厄瓜多尔',
    aliases: ['厄瓜多尔', 'Ecuador', 'ecuador', '厄瓜多'],
    lat: -1.3398,
    lng: -79.3667,
  },
  {
    name: '玻利维亚',
    aliases: ['玻利维亚', 'Bolivia', 'bolivia', '玻利維亞'],
    lat: -17.0569,
    lng: -64.9912,
  },

  // ==================== 亚洲 ====================
  {
    name: '印度尼西亚',
    aliases: ['印度尼西亚', 'Indonesia', 'indonesia', '印尼', '印度尼西亞'],
    lat: -2.483383,
    lng: 117.890285,
  },
  {
    name: '苏门答腊',
    aliases: ['苏门答腊', 'Sumatra', 'sumatra', '蘇門答臘'],
    lat: -0.143294,
    lng: 101.624102,
  },
  {
    name: '曼特宁',
    aliases: ['曼特宁', 'Mandheling', 'mandheling', 'Mandailing', '曼特寧'],
    lat: 0.85,
    lng: 99.55,
  },
  {
    name: '亚齐',
    aliases: ['亚齐', 'Aceh', 'aceh', '亞齊', '加佑', 'Gayo'],
    lat: 4.368549,
    lng: 97.025302,
  },
  {
    name: '苏拉威西',
    aliases: ['苏拉威西', 'Sulawesi', 'sulawesi', '蘇拉威西', 'Toraja'],
    lat: -1.9758,
    lng: 120.294886,
  },
  {
    name: '爪哇',
    aliases: ['爪哇', 'Java', 'java', '爪哇島'],
    lat: -7.327969,
    lng: 109.613911,
  },
  {
    name: '巴厘岛',
    aliases: ['巴厘岛', 'Bali', 'bali', '峇里島', '巴厘'],
    lat: -8.227086,
    lng: 115.191879,
  },
  {
    name: '弗洛勒斯',
    aliases: ['弗洛勒斯', 'Flores', 'flores', '佛羅勒斯'],
    lat: -8.51,
    lng: 120.5982,
  },
  {
    name: '越南',
    aliases: ['越南', 'Vietnam', 'vietnam'],
    lat: 15.9267,
    lng: 107.9651,
  },
  {
    name: '大叻',
    aliases: ['大叻', 'Da Lat', 'da lat', 'Dalat', '達叻'],
    lat: 11.9402,
    lng: 108.4376,
  },
  {
    name: '印度',
    aliases: ['印度', 'India', 'india'],
    lat: 22.3511,
    lng: 78.6677,
  },
  {
    name: '卡纳塔克',
    aliases: ['卡纳塔克', 'Karnataka', 'karnataka'],
    lat: 14.5204,
    lng: 75.7224,
  },
  {
    name: '喀拉拉',
    aliases: ['喀拉拉', 'Kerala', 'kerala'],
    lat: 10.3529,
    lng: 76.512,
  },
  {
    name: '泰国',
    aliases: ['泰国', 'Thailand', 'thailand', '泰國'],
    lat: 14.8972,
    lng: 100.8327,
  },
  {
    name: '清迈',
    aliases: ['清迈', 'Chiang Mai', 'chiang mai', '清邁'],
    lat: 18.7883,
    lng: 98.9859,
  },
  {
    name: '清莱',
    aliases: ['清莱', 'Chiang Rai', 'chiang rai', '清萊'],
    lat: 19.759,
    lng: 99.6735,
  },
  {
    name: '缅甸',
    aliases: ['缅甸', 'Myanmar', 'myanmar', 'Burma', '緬甸'],
    lat: 17.175,
    lng: 96.0,
  },
  {
    name: '老挝',
    aliases: ['老挝', 'Laos', 'laos', '寮國'],
    lat: 20.0171,
    lng: 103.3783,
  },
  {
    name: '菲律宾',
    aliases: ['菲律宾', 'Philippines', 'philippines', '菲律賓'],
    lat: 12.7503,
    lng: 122.7312,
  },
  // 中国咖啡产区
  {
    name: '云南',
    aliases: ['云南', 'Yunnan', 'yunnan', 'China Yunnan', '中国云南'],
    lat: 25.0,
    lng: 102.0,
  },
  {
    name: '普洱',
    aliases: ['普洱', "Pu'er", 'puer', 'Pu-erh'],
    lat: 22.827247,
    lng: 100.965015,
  },
  {
    name: '保山',
    aliases: ['保山', 'Baoshan', 'baoshan'],
    lat: 25.114711,
    lng: 99.159162,
  },
  {
    name: '海南',
    aliases: ['海南', 'Hainan', 'hainan'],
    lat: 19.2,
    lng: 109.6,
  },
  // 台湾咖啡产区
  {
    name: '台湾',
    aliases: ['台湾', 'Taiwan', 'taiwan', '臺灣', '台灣', '中国台湾'],
    lat: 23.9739,
    lng: 120.982,
  },
  {
    name: '阿里山',
    aliases: ['阿里山', 'Alishan', 'alishan'],
    lat: 23.515,
    lng: 120.8098,
  },
  {
    name: '尼泊尔',
    aliases: ['尼泊尔', 'Nepal', 'nepal', '尼泊爾'],
    lat: 28.378,
    lng: 84.0,
  },
  {
    name: '东帝汶',
    aliases: ['东帝汶', 'East Timor', 'east timor', 'Timor-Leste', '東帝汶'],
    lat: -8.7443,
    lng: 126.0635,
  },
  {
    name: '也门',
    aliases: ['也门', 'Yemen', 'yemen', '葉門'],
    lat: 16.3471,
    lng: 47.8915,
  },
  {
    name: '摩卡',
    aliases: ['摩卡', 'Mocha', 'mocha', 'Mokha'],
    lat: 13.3179,
    lng: 43.2501,
  },

  // ==================== 大洋洲 ====================
  {
    name: '巴布亚新几内亚',
    aliases: [
      '巴布亚新几内亚',
      'Papua New Guinea',
      'papua new guinea',
      'PNG',
      '巴布亞新幾內亞',
    ],
    lat: -5.6816,
    lng: 144.2489,
  },
  {
    name: '夏威夷',
    aliases: ['夏威夷', 'Hawaii', 'hawaii'],
    lat: 19.5938,
    lng: -155.4284,
  },
  {
    name: '科纳',
    aliases: ['科纳', 'Kona', 'kona', '可娜'],
    lat: 19.6472,
    lng: -155.9966,
  },
  {
    name: '澳大利亚',
    aliases: ['澳大利亚', 'Australia', 'australia', '澳洲', '澳大利亞'],
    lat: -24.7761,
    lng: 134.755,
  },

  // ==================== 加勒比海 ====================
  {
    name: '牙买加',
    aliases: ['牙买加', 'Jamaica', 'jamaica', '牙買加'],
    lat: 18.1851,
    lng: -77.3948,
  },
  {
    name: '蓝山',
    aliases: ['蓝山', 'Blue Mountain', 'blue mountain', '藍山'],
    lat: 18.0739,
    lng: -76.5552,
  },
  {
    name: '古巴',
    aliases: ['古巴', 'Cuba', 'cuba'],
    lat: 23.0131,
    lng: -80.8329,
  },
  {
    name: '多米尼加',
    aliases: [
      '多米尼加',
      'Dominican Republic',
      'dominican republic',
      '多明尼加',
    ],
    lat: 19.0974,
    lng: -70.3028,
  },
  {
    name: '海地',
    aliases: ['海地', 'Haiti', 'haiti'],
    lat: 19.14,
    lng: -72.3571,
  },
  {
    name: '波多黎各',
    aliases: ['波多黎各', 'Puerto Rico', 'puerto rico'],
    lat: 18.224771,
    lng: -66.485829,
  },
];

/**
 * 根据名称查找产区
 * 支持模糊匹配：
 * 1. 精确匹配产区名或别名
 * 2. 用户输入包含产区名/别名（如 "云南 普洱" 包含 "云南"）
 * 3. 产区名/别名包含用户输入（如 "Yirgacheffe" 包含 "yirga"）
 */
export function findRegionByName(name: string): CoffeeRegion | undefined {
  const normalizedName = name.trim().toLowerCase();
  if (!normalizedName) return undefined;

  // 1. 先尝试精确匹配
  const exactMatch = COFFEE_REGIONS.find(
    region =>
      region.name.toLowerCase() === normalizedName ||
      region.aliases.some(alias => alias.toLowerCase() === normalizedName)
  );
  if (exactMatch) return exactMatch;

  // 2. 模糊匹配：检查用户输入是否包含产区名/别名
  const containsMatch = COFFEE_REGIONS.find(
    region =>
      normalizedName.includes(region.name.toLowerCase()) ||
      region.aliases.some(alias => normalizedName.includes(alias.toLowerCase()))
  );
  if (containsMatch) return containsMatch;

  // 3. 反向模糊匹配：检查产区名/别名是否包含用户输入（仅当输入较长时）
  if (normalizedName.length >= 3) {
    const reverseMatch = COFFEE_REGIONS.find(
      region =>
        region.name.toLowerCase().includes(normalizedName) ||
        region.aliases.some(alias =>
          alias.toLowerCase().includes(normalizedName)
        )
    );
    if (reverseMatch) return reverseMatch;
  }

  return undefined;
}

/**
 * 根据名称列表批量查找产区
 * 返回找到的产区数组（去重）
 */
export function findRegionsByNames(names: string[]): CoffeeRegion[] {
  const foundRegions = new Map<string, CoffeeRegion>();

  for (const name of names) {
    const region = findRegionByName(name);
    if (region && !foundRegions.has(region.name)) {
      foundRegions.set(region.name, region);
    }
  }

  return Array.from(foundRegions.values());
}
