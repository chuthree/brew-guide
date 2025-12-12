// 预设选项
// 产区：咖啡生产国家及子产区
export const DEFAULT_ORIGINS = [
  // ==========================================
  // 非洲 (Africa)
  // ==========================================
  '埃塞俄比亚', // Ethiopia
  '耶加雪菲', // Yirgacheffe - 最著名的埃塞产区
  '西达摩', // Sidamo
  '古吉', // Guji
  '哈拉尔', // Harrar
  '利姆', // Limu
  '金玛', // Jimma
  '科契尔', // Kochere - 耶加雪菲子产区
  '歌迪贝', // Gedeb - 耶加雪菲子产区
  '沃卡', // Worka - 耶加雪菲子产区
  '罕贝拉', // Hambela - 古吉子产区
  '夏奇索', // Shakisso - 古吉子产区
  '乌拉嘎', // Uraga - 古吉子产区
  '肯尼亚', // Kenya
  '涅里', // Nyeri
  '基安布', // Kiambu
  '基里尼亚加', // Kirinyaga
  '穆兰加', // Murang'a
  '锡卡', // Thika
  '恩布', // Embu
  '梅鲁', // Meru
  '卢旺达', // Rwanda
  '布隆迪', // Burundi
  '坦桑尼亚', // Tanzania
  '乌干达', // Uganda
  '刚果', // Congo (DRC)
  '马拉维', // Malawi

  // ==========================================
  // 中南美洲 (Central & South America)
  // ==========================================
  '巴西', // Brazil
  '喜拉多', // Cerrado - 巴西高原产区
  '南米纳斯', // Sul de Minas
  '摩吉安娜', // Mogiana
  '巴伊亚', // Bahia
  '哥伦比亚', // Colombia
  '蕙兰', // Huila - 哥伦比亚最著名产区
  '娜玲珑', // Nariño
  '考卡', // Cauca
  '托利马', // Tolima
  '安蒂奥基亚', // Antioquia
  '桑坦德', // Santander
  '危地马拉', // Guatemala
  '安提瓜', // Antigua
  '薇薇特南果', // Huehuetenango
  '阿卡特南果', // Acatenango
  '科班', // Cobán
  '圣马科斯', // San Marcos
  '新东方', // Nuevo Oriente
  '阿蒂特兰', // Atitlán
  '哥斯达黎加', // Costa Rica
  '塔拉珠', // Tarrazú - 哥斯达黎加最著名产区
  '中央山谷', // Central Valley
  '西部山谷', // West Valley
  '三河区', // Tres Ríos
  '巴拿马', // Panama
  '波奎特', // Boquete - BOP 主产区
  '沃肯', // Volcán
  '洪都拉斯', // Honduras
  '萨尔瓦多', // El Salvador
  '尼加拉瓜', // Nicaragua
  '墨西哥', // Mexico
  '恰帕斯', // Chiapas - 墨西哥主要产区
  '秘鲁', // Peru
  '玻利维亚', // Bolivia
  '厄瓜多尔', // Ecuador

  // ==========================================
  // 亚洲 (Asia)
  // ==========================================
  '印度尼西亚', // Indonesia
  '苏门答腊', // Sumatra
  '亚齐', // Aceh
  '迦佑', // Gayo - 亚齐高地
  '林东', // Lintong
  '曼特宁', // Mandheling - 实为贸易名
  '托巴湖', // Lake Toba
  '苏拉威西', // Sulawesi
  '托拉雅', // Toraja
  '爪哇', // Java
  '巴厘岛', // Bali
  '金塔马尼', // Kintamani
  '弗洛勒斯', // Flores
  '云南', // Yunnan
  '保山', // Baoshan
  '普洱', // Pu'er
  '临沧', // Lincang
  '德宏', // Dehong
  '西双版纳', // Xishuangbanna
  '孟连', // Menglian
  '越南', // Vietnam
  '印度', // India
  '缅甸', // Myanmar
  '泰国', // Thailand
  '老挝', // Laos
  '巴布亚新几内亚', // Papua New Guinea

  // ==========================================
  // 中东/加勒比 (Middle East / Caribbean)
  // ==========================================
  '也门', // Yemen
  '玛塔里', // Mattari - 也门经典产区
  '哈拉兹', // Haraz
  '伊思玛丽', // Ismaili / Bani Ismaili
  '萨那尼', // San'ani
  '牙买加', // Jamaica
  '蓝山', // Blue Mountain
  '夏威夷', // Hawaii
  '科纳', // Kona
  '海地', // Haiti
  '多米尼加', // Dominican Republic
];

// 庄园：咖啡农场、庄园、处理站
export const DEFAULT_ESTATES = [
  // ==========================================
  // 巴拿马 (Panama) - BOP 知名庄园
  // ==========================================
  '翡翠', // Hacienda La Esmeralda - 瑰夏发源地，BOP 常年冠军
  '艾利达', // Elida Estate - Lamastus 家族，BOP 常客
  '哈特曼', // Finca Hartmann - 家族老牌庄园
  '詹森', // Janson Coffee - 家族庄园
  '卡门', // Carmen Estate - BOP 获奖庄园
  'Don Pachi', // Don Pachi Estate - BOP 获奖
  'Finca Deborah', // Finca Deborah - Jamison Savage 创立
  'Finca Sophia', // Finca Sophia - 2100m+ 高海拔，BOP 2025 第3名
  'Altieri', // Altieri Estate - BOP 获奖
  'Ninety Plus', // Ninety Plus Panama - 精品品牌
  'Abu', // Abu Estate
  'Lerida', // Finca Lerida

  // ==========================================
  // 哥伦比亚 (Colombia)
  // ==========================================
  '天堂', // Finca El Paraiso - Diego Bermudez，热冲击处理法创始
  '棕榈树与大嘴鸟', // La Palma y El Tucan (LPET) - Felipe Sardi
  'Inmaculada', // Finca Inmaculada
  'El Diviso', // Finca El Diviso - Los Nogales 关联
  'Los Nogales', // Finca Los Nogales - 发酵创新先驱
  'Monteblanco', // Finca Monteblanco - Rodrigo Sanchez
  'San Luis', // Finca San Luis

  // ==========================================
  // 危地马拉 (Guatemala)
  // ==========================================
  '英赫特', // Finca El Injerto - 8次 COE 冠军
  'Santa Felisa', // Finca Santa Felisa
  'La Soledad', // Finca La Soledad
  'Bella Vista', // Bella Vista

  // ==========================================
  // 哥斯达黎加 (Costa Rica)
  // ==========================================
  '拉米尼塔', // Hacienda La Minita - 塔拉珠传奇
  'Las Lajas', // Finca Las Lajas - 蜜处理先驱 Chacon 家族
  'Herbazú', // Herbazú
  'Don Mayo', // Don Mayo

  // ==========================================
  // 巴西 (Brazil)
  // ==========================================
  'Daterra', // Daterra - 巴西精品先驱，雨林认证
  'Santa Inês', // Fazenda Santa Inês
  'Fortaleza', // Fazenda Ambiental Fortaleza (FAF)
  'Passeio', // Fazenda Passeio
  'Samambaia', // Fazenda Samambaia

  // ==========================================
  // 埃塞俄比亚 (Ethiopia) - 处理站
  // ==========================================
  'Halo Beriti', // Halo Beriti - 耶加雪菲知名处理站
  'Worka Sakaro', // Worka Sakaro
  'Dumerso', // Dumerso
  'Aricha', // Aricha
  'Idido', // Idido - 耶加雪菲
  '孔加', // Konga
  'Buku', // Buku - 古吉
  'Shantawene', // Shantawene
  'Hambela Wamena', // Hambela Wamena

  // ==========================================
  // 肯尼亚 (Kenya) - 处理厂/合作社
  // ==========================================
  'Gakuyuini', // Gakuyuini - Thirikwa 合作社
  'Kii', // Kii Factory - Rungeto 合作社
  '卡洛图', // Karogoto - 明星处理厂
  'Gatura', // Gatura
  'Othaya', // Othaya

  // ==========================================
  // 卢旺达/布隆迪 (Rwanda/Burundi)
  // ==========================================
  'Long Miles', // Long Miles Coffee Project - Burundi
  'Gitwe', // Gitwe - Long Miles 自有农场
  'Heza', // Heza 处理站
  'Buf', // Buf Café - Rwanda
  'Musasa', // Musasa - Rwanda
  'Huye Mountain', // Huye Mountain - Rwanda 南部

  // ==========================================
  // 萨尔瓦多 (El Salvador)
  // ==========================================
  'Santa Rosa', // Finca Santa Rosa - Pacamara 知名
  'San Jose', // Finca San Jose

  // ==========================================
  // 洪都拉斯 (Honduras)
  // ==========================================
  'Las Capucas', // Las Capucas 合作社

  // ==========================================
  // 牙买加 (Jamaica) - 蓝山
  // ==========================================
  'Clifton Mount', // Clifton Mount - 蓝山顶级
  'Wallenford', // Wallenford Estate
  'Mavis Bank', // Mavis Bank

  // ==========================================
  // 夏威夷 (Hawaii)
  // ==========================================
  'Greenwell', // Greenwell Farms - Kona 代表

  // ==========================================
  // 也门 (Yemen)
  // ==========================================
  'Qima', // Qima Coffee - 也门精品先驱，Yemenia 发现者

  // ==========================================
  // 云南 (Yunnan) - 省级精品庄园
  // ==========================================
  '爱伲', // Aini - 首批云南精品庄园
  '天宇', // Tianyu - 首批云南精品庄园
  '来珠克', // Laizhuke - 首批云南精品庄园
  '新寨', // Xinzhai - 首批云南精品庄园
  '漫崖', // Manya - 朱苦拉古树
  '小凹子', // Xiaoaozi - 第二批云南精品庄园
  '比顿', // Bidun - 首批云南精品庄园
  '佐园', // Zuoyuan
  '高晟', // Gaosheng

  // ==========================================
  // 印尼 (Indonesia)
  // ==========================================
  'Wahana', // Wahana Estate - 苏门答腊北部
  'Frinsa', // Frinsa Estate - 西爪哇

  // ==========================================
  // 品牌/项目 (Brands/Projects)
  // ==========================================
  '九十+', // Ninety Plus - 精品咖啡品牌
  '瑰夏村', // Gesha Village - 埃塞俄比亚瑰夏原产地项目
];

// 处理法
export const DEFAULT_PROCESSES = [
  // ==========================================
  // 传统处理法 (Traditional Processing)
  // ==========================================
  '日晒', // Natural / Dry Process - 最古老的处理方式
  '水洗', // Washed / Wet Process - 18世纪荷兰人发明
  '蜜处理', // Honey Process / Miel Process
  '去果皮日晒', // Pulped Natural - 巴西常用
  '半水洗', // Semi-washed
  '湿刨法', // Wet Hulling / Giling Basah - 印尼特有

  // ==========================================
  // 水洗法变体 (Washed Variations)
  // ==========================================
  '肯尼亚式水洗', // Kenya Double Wash - 72小时双重发酵
  '双重水洗', // Double Washed
  '机械水洗', // Mechanical Demucilage

  // ==========================================
  // 蜜处理细分 (Honey Process by Mucilage %)
  // ==========================================
  '白蜜', // White Honey - 10-20% 果胶
  '黄蜜', // Yellow Honey - 25-50% 果胶
  '金蜜', // Gold Honey - 20-25% 果胶，高海拔低温
  '红蜜', // Red Honey - 50-75% 果胶
  '黑蜜', // Black Honey - 75-100% 果胶
  '百香蜜处理', // Passion Honey - 延长干燥至1个月
  '葡萄干蜜处理', // Raisin Honey

  // ==========================================
  // 日晒法变体 (Natural Variations)
  // ==========================================
  '酒香日晒', // Winey Natural - 类似红酒发酵
  '葡萄干日晒', // Raisin Natural
  '慢速日晒', // Slow Dry Natural
  '棚架日晒', // Raised Bed Natural
  '半日晒', // Semi-Natural - 两段式干燥

  // ==========================================
  // 厌氧发酵系列 (Anaerobic Fermentation)
  // ==========================================
  '厌氧发酵', // Anaerobic Fermentation - 密封无氧环境
  '厌氧日晒', // Anaerobic Natural
  '厌氧水洗', // Anaerobic Washed
  '厌氧蜜处理', // Anaerobic Honey
  '双重厌氧', // Double Anaerobic
  '长时厌氧', // Extended Anaerobic - 72小时以上
  '低温厌氧', // Cold Anaerobic - 6-10°C 环境

  // ==========================================
  // 二氧化碳浸渍 (Carbonic Maceration)
  // ==========================================
  '碳酸浸渍', // Carbonic Maceration (CM) - 源自葡萄酒工艺
  'CM日晒', // CM Natural
  'CM水洗', // CM Washed
  'CM蜜处理', // CM Honey

  // ==========================================
  // 菌种接种发酵 (Inoculated Fermentation)
  // ==========================================
  '乳酸发酵', // Lactic Fermentation - 乳酸菌
  '酵母发酵', // Yeast Inoculation - 特定酵母菌株
  '醋酸发酵', // Acetic Fermentation
  '曲菌发酵', // Koji Fermentation - 米曲霉 Aspergillus oryzae

  // ==========================================
  // 共同发酵/浸渍 (Co-Ferment & Infused)
  // ==========================================
  '共同发酵', // Co-Fermentation - 添加水果/香料一同发酵
  '水果发酵', // Fruit Fermentation
  '荔枝发酵', // Lychee Ferment
  '草莓发酵', // Strawberry Ferment
  '百香果发酵', // Passion Fruit Ferment
  '凤梨发酵', // Pineapple Ferment
  '芒果发酵', // Mango Ferment
  '肉桂发酵', // Cinnamon Ferment
  '浸渍处理', // Infused Process - 浸泡吸收风味

  // ==========================================
  // 桶陈/过桶处理 (Barrel Processing)
  // ==========================================
  '酒桶发酵', // Barrel Aged
  '威士忌桶', // Whiskey Barrel
  '朗姆酒桶', // Rum Barrel
  '红酒桶', // Wine Barrel
  '波本桶', // Bourbon Barrel
  '雪莉桶', // Sherry Barrel

  // ==========================================
  // 温控处理 (Temperature Controlled)
  // ==========================================
  '热冲击', // Thermal Shock - Diego Bermudez 代表技术
  '低温慢速发酵', // Cold/Slow Fermentation

  // ==========================================
  // Mossto 处理 (Mossto/Must Process)
  // ==========================================
  'Mossto发酵', // Mossto - 使用发酵液/果汁接种
  '果汁发酵', // Juice Fermentation

  // ==========================================
  // 实验性/特殊处理 (Experimental)
  // ==========================================
  '炼金术', // Alchemy Process - Qima Coffee (也门)
  '双重发酵', // Double Fermentation
  '三重发酵', // Triple Fermentation
  '延长发酵', // Extended Fermentation
];

// 品种：基于 World Coffee Research 官方目录
// 品种：基于 World Coffee Research 官方目录 (varieties.worldcoffeeresearch.org)
export const DEFAULT_VARIETIES = [
  // ==========================================
  // 原生品种 (Foundation Varieties)
  // 咖啡最重要的两大原生品种
  // ==========================================
  '铁皮卡', // Typica - 最古老的阿拉比卡品种之一
  '波旁', // Bourbon - 与铁皮卡并列的重要原生品种

  // ==========================================
  // 波旁自然变异 (Bourbon Natural Mutations)
  // ==========================================
  '红波旁', // Red Bourbon - 经典波旁，红色果实
  '黄波旁', // Yellow Bourbon - 巴西常见，黄色果实
  '粉波旁', // Pink Bourbon - 稀有变异
  '橙波旁', // Orange Bourbon - 稀有变异
  '尖身波旁', // Bourbon Pointu / Laurina - 低咖啡因
  '帕卡斯', // Pacas - 萨尔瓦多发现的波旁矮化变异
  '薇拉萨奇', // Villa Sarchi - 哥斯达黎加发现的波旁矮化变异
  '特奇希克', // Tekisic - 萨尔瓦多改良波旁，高海拔品质出众
  'BM139', // Bourbon Mayaguez 139 - 卢旺达/布隆迪常见
  'BM71', // Bourbon Mayaguez 71 - 卢旺达/布隆迪常见

  // ==========================================
  // 铁皮卡自然变异 (Typica Natural Mutations)
  // ==========================================
  '蓝山', // Blue Mountain - 牙买加铁皮卡变异
  '象豆', // Maragogipe - 巴西发现的大豆变异
  '帕切', // Pache - 危地马拉发现的矮化变异
  '科纳', // Kona - 夏威夷铁皮卡变异
  '爪哇', // Java - 中美洲高品质，抗病性好
  'AB3', // AB3 Java - 爪哇高杯测品质

  // ==========================================
  // 波旁矮化变异 (Bourbon Dwarf/Compact)
  // ==========================================
  '卡杜拉', // Caturra - 波旁自然矮化变异，产量高
  '卡杜艾', // Catuai - 蒙多诺沃×卡杜拉杂交

  // ==========================================
  // 自然杂交品种 (Natural Hybrids)
  // ==========================================
  '蒙多诺沃', // Mundo Novo - 波旁×铁皮卡自然杂交
  '帕卡马拉', // Pacamara - 帕卡斯×象豆杂交，大豆高品质
  '玛拉卡杜拉', // Maracaturra - 象豆×卡杜拉杂交

  // ==========================================
  // 肯尼亚/东非品种 (Kenya/East Africa)
  // Scott Labs 选育系列
  // ==========================================
  'SL28', // SL28 - 肯尼亚经典，高品质抗旱
  'SL34', // SL34 - 肯尼亚经典，卓越杯测品质
  'SL14', // SL14 - 抗旱抗寒高杆品种
  'K7', // K7 - 肯尼亚/坦桑尼亚，抗CBD
  'Ruiru 11', // Ruiru 11 - 肯尼亚抗病矮化杂交
  '巴蒂安', // Batian - 肯尼亚高产抗病高杆品种

  // ==========================================
  // 卢旺达/布隆迪品种 (Rwanda/Burundi)
  // ==========================================
  '杰克逊', // Jackson 2/1257 - 卢旺达/布隆迪常见
  '米比里兹', // Mibirizi - 卢旺达抗旱高品质
  'Pop3303/21', // Pop3303/21 - 卢旺达抗病高产
  'RAB C15', // RAB C15 - 卢旺达新品种

  // ==========================================
  // 埃塞俄比亚品种 (Ethiopian Varieties)
  // JARC 选育系列及原生种
  // ==========================================
  '原生种', // Ethiopian Heirloom / Landrace
  '74110', // JARC 74110 - 抗CBD选育
  '74112', // JARC 74112 - 抗CBD选育
  '74158', // JARC 74158 - 抗CBD选育
  '74148', // JARC 74148
  '74165', // JARC 74165
  '哈拉尔', // Harar - 也门/卢旺达变种

  // ==========================================
  // 瑰夏/艺伎 (Geisha/Gesha)
  // 源自埃塞俄比亚，巴拿马发扬光大
  // ==========================================
  '瑰夏', // Geisha/Gesha - 埃塞原生，巴拿马闻名

  // ==========================================
  // 印度品种 (Indian Varieties)
  // ==========================================
  '肯特', // Kent - 印度早期抗锈品种
  'S795', // S795 (Selection 3) - 印度广泛种植
  'Sln.5B', // Sln.5B (S.2931) - 印度抗锈高产
  'Sln.6', // Sln.6 (S.2828) - 印度中高海拔适应
  'S4808', // S4808 - 印度育种系

  // ==========================================
  // Catimor 系列 (Catimor Group)
  // 卡杜拉×Timor Hybrid 杂交抗病系列
  // ==========================================
  '卡蒂姆', // Catimor - 泛指此系列
  'Catimor 129', // Catimor 129 / Nyika - 马拉维/赞比亚
  'IHCAFE 90', // IHCAFE 90 - 洪都拉斯低海拔适应
  'Costa Rica 95', // Costa Rica 95 - 哥斯达黎加
  'Lempira', // Lempira - 洪都拉斯
  'T5175', // T5175 - 低海拔高肥力
  'T8667', // T8667 - 高产抗锈
  'Anacafe 14', // Anacafe 14 - 危地马拉高产
  'Catisic', // Catisic - 酸性土壤适应
  'Oro Azteca', // Oro Azteca - 墨西哥
  'Fronton', // Fronton - 波多黎各

  // ==========================================
  // Sarchimor 系列 (Sarchimor Group)
  // Villa Sarchi×Timor Hybrid 杂交抗病系列
  // ==========================================
  'IAPAR 59', // IAPAR 59 - 巴西中海拔
  'Marsellesa', // Marsellesa - 中海拔高酸度
  'Parainema', // Parainema - 洪都拉斯抗锈抗线虫
  'Cuscatleco', // Cuscatleco - 萨尔瓦多
  'T5296', // T5296 - 中海拔适应
  'Obata', // Obata Red - 巴西抗锈高产
  'Limani', // Limani - 波多黎各

  // ==========================================
  // F1 杂交品种 (F1 Hybrids)
  // 高产高品质一代杂交
  // ==========================================
  'Centroamericano', // Centroamericano (H1) - WCR高产高品质
  'H3', // H3 - 高海拔高品质
  'Milenio', // Milenio (H10) - 高产抗锈
  'Starmaya', // Starmaya - 高酸度
  'Evaluna', // Evaluna (EC18) - 高海拔高产
  'Mundo Maya', // Mundo Maya (EC16) - 农林复合适应
  'MundoMex', // EC15 / MundoMex - 高产高品质
  'Nayarita', // Nayarita (EC19) - 高海拔高品质
  '希望', // Esperanza (L4 A5) - 高产抗锈湿润环境

  // ==========================================
  // 哥伦比亚品种 (Colombian Varieties)
  // ==========================================
  '卡斯蒂洛', // Castillo - 哥伦比亚主要抗病品种
  '哥伦比亚', // Colombia - 哥伦比亚早期抗病品种
  'Cenicafe 1', // Cenicafe 1 - 哥伦比亚新品种

  // ==========================================
  // 巴西品种 (Brazilian Varieties)
  // ==========================================
  'Catigua MG2', // Catigua MG2 - 巴西精品适应性强
  'IPR 103', // IPR 103 - 抗热抗旱
  'IPR 107', // IPR 107 - 高海拔机采适应
  'Paraiso', // Paraiso - 巴西矮化高产

  // ==========================================
  // 中美洲新品种 (Central American New Varieties)
  // ==========================================
  'Casiopea', // Casiopea - 高海拔卓越品质

  // ==========================================
  // 其他地区品种 (Other Regional Varieties)
  // ==========================================
  'Caripe', // Caripe / Criollo - 委内瑞拉大豆高品质
  'Monte Claro', // Monte Claro / Ombligon - 委内瑞拉
  'Venecia', // Venecia - 多雨区适应
  'Nyasaland', // Nyasaland / Bugisu - 乌干达小农常用
  'KP423', // KP423 - 乌干达抗旱
  'BPL10', // BPL10 Java - 爪哇抗锈
  'Kartika 1', // Kartika 1 - 印尼农林适应

  // ==========================================
  // 罗布斯塔嫁接砧木 (Robusta Rootstock)
  // ==========================================
  'Nemaya', // Nemaya - 抗线虫砧木
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
  key: 'origins' | 'estates' | 'processes' | 'varieties',
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
  key: 'origins' | 'estates' | 'processes' | 'varieties',
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
  key: 'origins' | 'estates' | 'processes' | 'varieties',
  value: string
): boolean => {
  if (!isBrowser) return false;
  return getCustomPresets(key).includes(value);
};

// 获取完整预设列表（自定义+默认）
export const getFullPresets = (
  key: 'origins' | 'estates' | 'processes' | 'varieties'
): string[] => {
  const defaults = {
    origins: DEFAULT_ORIGINS,
    estates: DEFAULT_ESTATES,
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
  duration: 0.2,
};
