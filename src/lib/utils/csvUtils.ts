import { CoffeeBean } from '@/types/app';

// 博主类型定义
export type BloggerType = 'peter' | 'fenix';

// 动态导入CSV数据以避免构建时问题
let filterBeans2025CSV: Record<string, string>[] = [];
let espressoBeans2025CSV: Record<string, string>[] = [];
let filterBeans2024CSV: Record<string, string>[] = [];
let espressoBeans2024CSV: Record<string, string>[] = [];
let fenixEspressoBeansCSV: Record<string, string>[] = [];

// 异步加载CSV数据
const loadCSVData = async () => {
    try {
        // 使用fetch来加载CSV数据
        const [filter2025, espresso2025, filter2024, espresso2024, fenixEspresso] = await Promise.all([
            fetch('/data/filter-beans.csv').then(r => r.text()),
            fetch('/data/espresso-beans.csv').then(r => r.text()),
            fetch('/data/filter-beans-2024.csv').then(r => r.text()),
            fetch('/data/espresso-beans-2024.csv').then(r => r.text()),
            fetch('/data/fenix-espresso-beans.csv').then(r => r.text())
        ]);

        // 简单的CSV解析函数
        const parseCSV = (csvText: string) => {
            return csvText.split('\n').map(line => {
                // 简单的CSV解析，处理逗号分隔
                const values = [];
                let current = '';
                let inQuotes = false;

                for (let i = 0; i < line.length; i++) {
                    const char = line[i];
                    if (char === '"') {
                        inQuotes = !inQuotes;
                    } else if (char === ',' && !inQuotes) {
                        values.push(current.trim());
                        current = '';
                    } else {
                        current += char;
                    }
                }
                values.push(current.trim());
                return values;
            });
        };

        filterBeans2025CSV = parseCSV(filter2025) as unknown as Record<string, string>[];
        espressoBeans2025CSV = parseCSV(espresso2025) as unknown as Record<string, string>[];
        filterBeans2024CSV = parseCSV(filter2024) as unknown as Record<string, string>[];
        espressoBeans2024CSV = parseCSV(espresso2024) as unknown as Record<string, string>[];
        fenixEspressoBeansCSV = parseCSV(fenixEspresso) as unknown as Record<string, string>[];
    } catch (error) {
        console.error('加载CSV数据失败:', error);
    }
};

export interface BloggerBean extends CoffeeBean {
    isBloggerRecommended: boolean;
    dataSource?: string;
    videoEpisode?: string; // 视频期数
    year?: number; // Add year identifier
    originalIndex?: number; // Add original index for sorting
    // 临时保留 process 字段用于 CSV 数据兼容
    process?: string;
    // 新增博主类型字段
    blogger?: BloggerType;
    // Fenix博主特有字段
    origin?: string; // 产区
    flavorDescription?: string; // 风味描述
    advantages?: string; // 优点
    disadvantages?: string; // 缺点
    extractionSuggestion?: string; // 萃取建议
    firstTestDate?: string; // 首测日期
    originalRating?: string; // 原始评分格式（保留+/-）
}

// Parsing function for 2025 CSV data
function parseCSVContent2025(records: unknown[], beanType: 'espresso' | 'filter'): BloggerBean[] {
    // Skip header rows (adjust if necessary, assuming 2 header rows)
    const dataRows = records.slice(2);

    return dataRows
        .filter(row => {
            if (!Array.isArray(row) || row.length < 6) return false; // Basic validation for 2025 format
            // 手冲豆有处理法列，意式豆没有处理法列
            if (beanType === 'filter') {
                if (row.length < 7) return false; // 手冲豆需要至少7列（包含处理法）
                const [_序号, 品牌, 咖啡豆, _处理法, _烘焙度, 克价, 喜好星值] = row;
                return 品牌 && 咖啡豆 && 克价 !== undefined && 喜好星值 !== undefined;
            } else {
                // 意式豆没有处理法列
                const [_序号, 品牌, 咖啡豆, _烘焙度, 克价, 喜好星值] = row;
                return 品牌 && 咖啡豆 && 克价 !== undefined && 喜好星值 !== undefined;
            }
        })
        .map(row => {
            let 序号: string | number, 品牌: string, 咖啡豆: string, 处理法: string, 烘焙度: string, 克价: string | number, 喜好星值: string | number, videoEpisode: string | number, rest: unknown[];

            if (beanType === 'filter') {
                // 手冲豆：序号,品牌,咖啡豆,处理法,烘焙度,克价（元）,喜好星值,视频期数,备注,购买渠道
                const rowArray = row as [
                    string | number, // 序号
                    string,         // 品牌
                    string,         // 咖啡豆
                    string,         // 处理法
                    string,         // 烘焙度
                    string | number, // 克价
                    string | number, // 喜好星值
                    string | number, // 视频期数
                    string | number, // 备注
                    string | number, // 购买渠道
                    ...unknown[]    // 其他数据
                ];
                [序号, 品牌, 咖啡豆, 处理法, 烘焙度, 克价, 喜好星值, videoEpisode, ...rest] = rowArray;
            } else {
                // 意式豆：序号,品牌,咖啡豆,烘焙度,克价（元）,喜好星值,视频期数,美式,奶咖,备注,购买渠道
                const rowArray = row as [
                    string | number, // 序号
                    string,         // 品牌
                    string,         // 咖啡豆
                    string,         // 烘焙度
                    string | number, // 克价
                    string | number, // 喜好星值
                    string | number, // 视频期数
                    string | number, // 美式分数
                    string | number, // 奶咖分数
                    string | number, // 备注
                    string | number, // 购买渠道
                    ...unknown[]    // 其他数据
                ];
                [序号, 品牌, 咖啡豆, 烘焙度, 克价, 喜好星值, videoEpisode, ...rest] = rowArray;
                处理法 = ''; // 意式豆没有处理法信息
            }
            
            const beanId = 序号 !== undefined ? String(序号).trim() : '';
            const price = parseFloat(String(克价)) || 0;
            const rating = parseFloat(String(喜好星值)) || 0;
            const name = `${品牌} ${咖啡豆}`;
            const capacity = '200'; // Default capacity
            const processMethod = String(处理法 || '').trim(); // 处理法信息

            let 备注 = '';
            let purchaseChannel = '';

            if (beanType === 'espresso') {
                // 意式豆：rest = [美式分数, 奶咖分数, 备注, 购买渠道, ...]
                if (rest.length >= 2) {
                    备注 = String(rest[2] || ''); // 备注
                    purchaseChannel = String(rest[3] || ''); // 购买渠道
                }
            } else if (beanType === 'filter') {
                // 手冲豆：rest = [备注, 购买渠道, ...]
                if (rest.length >= 1) {
                    备注 = String(rest[0] || ''); // 备注
                    purchaseChannel = String(rest[1] || ''); // 购买渠道
                }
            }

            const episode = videoEpisode ? String(videoEpisode).trim() : '';
            const uniqueId = `blogger-${beanType}-2025-${beanId}-${name}-${Math.random().toString(36).substring(2, 7)}`;

            return {
                id: uniqueId,
                name,
                beanType,
                year: 2025, // Add year
                roastLevel: String(烘焙度 || '未知'), // Handle potentially undefined roast level
                process: processMethod, // 添加处理法信息
                price: `${(price * 100).toFixed(2)}`, // Convert price per gram to price per 100g
                capacity,
                remaining: capacity,
                overallRating: rating,
                ratingNotes: String(备注 || ''),
                purchaseChannel: purchaseChannel,
                videoEpisode: episode,
                timestamp: Date.now(),
                isBloggerRecommended: true,
                dataSource: '数据来自于 Peter 2025 咖啡豆评测榜单',
                ...(beanType === 'espresso' && rest.length >= 2 && {
                    ratingEspresso: ((value) => {
                        const parsed = parseFloat(String(value));
                        return isNaN(parsed) ? undefined : parsed; // Use undefined if NaN
                    })(rest[0]), // 美式分数
                    ratingMilkBased: ((value) => {
                        const parsed = parseFloat(String(value));
                        return isNaN(parsed) ? undefined : parsed; // Use undefined if NaN
                    })(rest[1]) // 奶咖分数
                })
            } as BloggerBean;
        });
}

// Parsing function for 2024 CSV data
function parseCSVContent2024(records: unknown[], beanType: 'espresso' | 'filter'): BloggerBean[] {
    // Skip Title (Row 1) and Headers (Row 2)
    const potentiallyDataRows = records.slice(2);

    // Filter out potentially empty rows AND ensure row is an array for type safety
    const validRows: { row: (string | number | null | undefined)[]; originalIndex: number }[] = potentiallyDataRows
        .map((row, index) => ({ row, originalIndex: index })) // Keep original index relative to potentiallyDataRows
        .filter((item): item is { row: (string | number | null | undefined)[]; originalIndex: number } => { 
            // Type guard and empty row check
            return Array.isArray(item.row) && item.row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '');
        });

    // Now map and filter the validated rows
    return validRows
        // .map((row, index) => ({ row, originalIndex: index })) // Mapping already done above
        .filter(({ row }) => { // row is now correctly typed as an array
            // Main data validation filter
            if (beanType === 'filter') {
                if (row.length < 7) return false; 
                const [_序号, 品牌, 豆子, _烘焙度, _推荐值, 元克, 期] = row;
                const brandExists = String(品牌 ?? '').trim().length > 0;
                const nameExists = String(豆子 ?? '').trim().length > 0;
                const priceVal = String(元克 ?? '').replace('没花钱','0').trim();
                const priceIsValid = priceVal.length > 0 && !isNaN(parseFloat(priceVal));
                const episodeExists = 期 !== undefined && 期 !== null && String(期).trim().length > 0;
                return brandExists && nameExists && priceIsValid && episodeExists;
            } else if (beanType === 'espresso') { 
                // Simplify the filter: Check only essential identifiers: Episode, Brand, Name
                if (row.length < 3) return false; // Need at least 期, 品牌, 豆子 columns
                const [期, 品牌, 豆子] = row; // Only need these for the basic check
                const brandExists = String(品牌 ?? '').trim().length > 0;
                const nameExists = String(豆子 ?? '').trim().length > 0;
                const episodeExists = 期 !== undefined && 期 !== null && String(期).trim().length > 0;
                
                // Debug log for the specific bean
                if (String(品牌 ?? '').trim() === '皮爷咖啡' && String(豆子 ?? '').trim() === '多明戈大街') {
                    console.warn('Checking simplified filter for 皮爷咖啡 多明戈大街:', { brandExists, nameExists, episodeExists, row });
                }

                return brandExists && nameExists && episodeExists; // Return based on simplified check
            } else {
               return false; 
            }
        })
        .map(({ row, originalIndex }) => { // Use the preserved original index from validRows mapping
            let _序号_unused: string | number = ''; 
            let 品牌: string = '';
            let 豆子: string = '';
            let 烘焙度: string = '未知';
            let 推荐值: string | number = 0;
            let 元克: string | number = 0;
            let 期: string | number = '';

            // row is already confirmed Array type here
            if (beanType === 'filter') {
                const rowArray = row as [string | number, string, string, string, string | number, string | number, string | number, ...unknown[]];
                [_序号_unused, 品牌, 豆子, 烘焙度, 推荐值, 元克, 期] = rowArray; 
            } else { // espresso
                const rowArray = row as [string | number, string, string, string, string | number, string | number, ...unknown[]];
                [期, 品牌, 豆子, 烘焙度, 推荐值, 元克] = rowArray;
            }

            // Use originalIndex relative to the potentiallyDataRows for consistent ID and sorting key
            const beanId = `${originalIndex + 2}`; // +2 because originalIndex is from potentiallyDataRows which starts after first 2 rows
            const pricePerGram = parseFloat(String(元克 ?? '').replace('没花钱','0')) || 0; 
            const rating = parseFloat(String(推荐值 ?? 0)) || 0;
            const name = `${String(品牌 ?? '').trim()} ${String(豆子 ?? '').trim()}`;
            const capacity = '200'; 
            const episode = 期 ? String(期).trim() : '';

            const uniqueId = `blogger-${beanType}-2024-${beanId}-${name.replace(/\s+/g, '-')}-${Math.random().toString(36).substring(2, 7)}`;

            return {
                id: uniqueId,
                name,
                beanType,
                year: 2024, 
                originalIndex, // Store original index relative to valid data rows for sorting
                roastLevel: String(烘焙度 || '未知').trim(), 
                price: `${(pricePerGram * 100).toFixed(2)}`, 
                capacity,
                remaining: capacity,
                overallRating: rating,
                ratingNotes: '', 
                purchaseChannel: '', 
                videoEpisode: episode,
                timestamp: Date.now(),
                isBloggerRecommended: true,
                dataSource: '数据来自于 Peter 2024 咖啡豆评测榜单',
            } as BloggerBean;
        });
}

// Helper function to parse date and extract year
function parseYearFromDate(dateStr: string): number | null {
    if (!dateStr || dateStr.trim() === '') return null;

    // Handle different date formats: 2023/5/6, 2024/10/30, etc.
    const match = dateStr.match(/(\d{4})/);
    if (match) {
        return parseInt(match[1], 10);
    }
    return null;
}

// Helper function to get the latest year from multiple dates
function getLatestYear(首测日期: string, 复测日期1: string, 复测日期2: string): number {
    const dates = [首测日期, 复测日期1, 复测日期2].filter(date => date && date.trim() !== '');
    const years = dates.map(parseYearFromDate).filter(year => year !== null) as number[];

    if (years.length === 0) {
        return 2025; // Default year if no valid dates found
    }

    return Math.max(...years);
}

// Parsing function for Fenix blogger CSV data
function parseFenixCSVContent(records: unknown[], filterYear?: number): BloggerBean[] {
    // Skip header row
    const dataRows = records.slice(1);

    return dataRows
        .filter(row => {
            if (!Array.isArray(row) || row.length < 10) return false;
            const [_编号, 品牌, _产区, 豆子名称, _风味描述, _参考价格, 每百克价格, _优点, _缺点, 最新评分] = row;
            return 品牌 && 豆子名称 && 每百克价格 !== undefined && 最新评分 !== undefined;
        })
        .map((row, index) => {
            const [编号, 品牌, 产区, 豆子名称, 风味描述, _参考价格, 每百克价格, 优点, 缺点, 最新评分, 萃取建议, 首测日期, 复测日期1, 复测日期2] = row as string[];

            // 确定年份 - 以最新的日期为准
            const beanYear = getLatestYear(String(首测日期 || ''), String(复测日期1 || ''), String(复测日期2 || ''));

            // 解析评分 - 保留原始格式并正确处理正负数
            let rating = 0;
            const ratingStr = String(最新评分 || '').trim();
            const originalRating = ratingStr; // 保留原始评分格式
            if (ratingStr) {
                // 检查是否以"-"结尾（负数）
                const isNegative = ratingStr.endsWith('-');

                // 提取数字部分
                const cleanRating = ratingStr.replace(/[-+]$/, '');
                const parsed = parseFloat(cleanRating);
                if (!isNaN(parsed)) {
                    // 根据符号决定正负
                    rating = isNegative ? -parsed : parsed;
                }
            }

            // 解析价格
            let price = 0;
            const priceStr = String(每百克价格 || '').trim();
            if (priceStr) {
                const parsed = parseFloat(priceStr);
                if (!isNaN(parsed)) {
                    price = parsed;
                }
            }

            // 生成唯一ID
            const uniqueId = `fenix-${编号 || index + 1}-${Date.now()}`;

            // 构建咖啡豆名称
            const name = `${品牌} ${豆子名称}`.trim();

            return {
                id: uniqueId,
                name,
                beanType: 'espresso' as const,
                blogger: 'fenix' as const,
                year: beanYear, // 根据日期确定的年份
                originalIndex: index,
                roastLevel: '未知', // Fenix数据中没有烘焙度信息
                price: `${price.toFixed(2)}`, // 已经是每100g价格，无需转换
                capacity: '250', // 默认容量
                remaining: '250',
                overallRating: rating,
                ratingNotes: '',
                purchaseChannel: '',
                videoEpisode: '',
                timestamp: Date.now(),
                isBloggerRecommended: true,
                dataSource: '数据来自于 矮人(Fenix) 咖啡豆评测榜单',
                // Fenix特有字段
                origin: String(产区 || ''),
                flavorDescription: String(风味描述 || ''),
                advantages: String(优点 || ''),
                disadvantages: String(缺点 || ''),
                extractionSuggestion: String(萃取建议 || ''),
                firstTestDate: String(首测日期 || ''),
                originalRating: originalRating,
            } as BloggerBean;
        })
        .filter(bean => {
            // 如果指定了年份筛选，则只返回对应年份的数据
            if (filterYear !== undefined) {
                return bean.year === filterYear;
            }
            return true;
        });
}


export async function getBloggerBeans(type: 'all' | 'espresso' | 'filter' = 'all', year: 2023 | 2024 | 2025 = 2025, blogger: BloggerType = 'peter'): Promise<BloggerBean[]> {
    // 确保CSV数据已加载
    if (filterBeans2025CSV.length === 0) {
        await loadCSVData();
    }

    let beans: BloggerBean[] = [];

    try {
        if (blogger === 'fenix') {
            // Fenix博主只有意式豆数据
            if (type === 'all' || type === 'espresso') {
                const fenixBeans = parseFenixCSVContent(fenixEspressoBeansCSV, year);
                beans = [...beans, ...fenixBeans];
            }
        } else {
            // Peter博主的数据
            const parseFn = year === 2024 ? parseCSVContent2024 : parseCSVContent2025;
            const filterCSV = year === 2024 ? filterBeans2024CSV : filterBeans2025CSV;
            const espressoCSV = year === 2024 ? espressoBeans2024CSV : espressoBeans2025CSV;

            if (type === 'all' || type === 'filter') {
                const filterBeans = parseFn(filterCSV, 'filter');
                beans = [...beans, ...filterBeans];
            }

            if (type === 'all' || type === 'espresso') {
                const espressoBeans = parseFn(espressoCSV, 'espresso');
                beans = [...beans, ...espressoBeans];
            }
        }

        // Sort based on the original index from the CSV file
        return beans.sort((a, b) => {
            // Use originalIndex for stable sorting based on CSV order
            const indexA = a.originalIndex ?? Infinity;
            const indexB = b.originalIndex ?? Infinity;
            return indexA - indexB;
        });

    } catch (error) {
        console.error(`解析 ${blogger} ${year} 博主榜单咖啡豆数据失败:`, error);
        return [];
    }
}

// 为了向后兼容，提供一个同步版本（返回空数组，但会触发异步加载）
export function getBloggerBeansSync(type: 'all' | 'espresso' | 'filter' = 'all', year: 2023 | 2024 | 2025 = 2025, blogger: BloggerType = 'peter'): BloggerBean[] {
    // 如果数据还没加载，触发加载但返回空数组
    if (filterBeans2025CSV.length === 0) {
        loadCSVData();
        return [];
    }

    let beans: BloggerBean[] = [];

    try {
        if (blogger === 'fenix') {
            // Fenix博主只有意式豆数据
            if (type === 'all' || type === 'espresso') {
                const fenixBeans = parseFenixCSVContent(fenixEspressoBeansCSV, year);
                beans = [...beans, ...fenixBeans];
            }
        } else {
            // Peter博主的数据
            const parseFn = year === 2024 ? parseCSVContent2024 : parseCSVContent2025;
            const filterCSV = year === 2024 ? filterBeans2024CSV : filterBeans2025CSV;
            const espressoCSV = year === 2024 ? espressoBeans2024CSV : espressoBeans2025CSV;

            if (type === 'all' || type === 'filter') {
                const filterBeans = parseFn(filterCSV, 'filter');
                beans = [...beans, ...filterBeans];
            }

            if (type === 'all' || type === 'espresso') {
                const espressoBeans = parseFn(espressoCSV, 'espresso');
                beans = [...beans, ...espressoBeans];
            }
        }

        // Sort based on the original index from the CSV file
        return beans.sort((a, b) => {
            // Use originalIndex for stable sorting based on CSV order
            const indexA = a.originalIndex ?? Infinity;
            const indexB = b.originalIndex ?? Infinity;
            return indexA - indexB;
        });

    } catch (error) {
        console.error(`解析 ${blogger} ${year} 博主榜单咖啡豆数据失败:`, error);
        return [];
    }
}

// Helper function - Get video URL from episode
export function getVideoUrlFromEpisode(
    episode?: string, 
    brand?: string, 
    beanName?: string, 
): string {
    if (!episode || !brand || !beanName) return ''; // Need all parts
    
    // Format episode number (zero-pad if single digit)
    const trimmedEpisode = episode.trim();
    const formattedEpisode = trimmedEpisode.length === 1 ? `0${trimmedEpisode}` : trimmedEpisode;

    // Construct the search keyword: formattedEpisode + brand + beanName (without spaces)
    const keyword = `${formattedEpisode}${brand.trim()}${beanName.trim()}`;
    
    // URL encode the keyword
    const encodedKeyword = encodeURIComponent(keyword);
    
    // Construct the final URL
    const baseSearchUrl = 'https://search.bilibili.com/all?keyword=';
    
    return baseSearchUrl + encodedKeyword;
}