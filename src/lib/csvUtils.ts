import { CoffeeBean } from '@/app/types';
// Import 2025 data (assuming these are the current files)
import filterBeans2025CSV from '@public/data/filter-beans.csv';
import espressoBeans2025CSV from '@public/data/espresso-beans.csv';
// Import 2024 data
import filterBeans2024CSV from '@public/data/filter-beans-2024.csv';
import espressoBeans2024CSV from '@public/data/espresso-beans-2024.csv';

export interface BloggerBean extends CoffeeBean {
    isBloggerRecommended: boolean;
    dataSource?: string;
    videoEpisode?: string; // 视频期数
    year?: number; // Add year identifier
    originalIndex?: number; // Add original index for sorting
}

// Parsing function for 2025 CSV data
function parseCSVContent2025(records: unknown[], beanType: 'espresso' | 'filter'): BloggerBean[] {
    // Skip header rows (adjust if necessary, assuming 2 header rows)
    const dataRows = records.slice(2); 
    
    return dataRows
        .filter(row => {
            if (!Array.isArray(row) || row.length < 6) return false; // Basic validation for 2025 format
            const [_序号, 品牌, 咖啡豆, _烘焙度, 克价, 喜好星值] = row;
            return 品牌 && 咖啡豆 && 克价 !== undefined && 喜好星值 !== undefined; // Ensure essential fields exist
        })
        .map(row => {
            const rowArray = row as [
                string | number, // 序号
                string,         // 品牌 
                string,         // 咖啡豆
                string,         // 烘焙度
                string | number, // 克价
                string | number, // 喜好星值
                string | number, // 视频期数
                string | number, // 美式分数(意式豆) 或 购买渠道(手冲豆)
                string | number, // 奶咖分数(意式豆) 或 其他数据
                string | number, // 购买渠道(意式豆) 或 其他数据
                string | number, // 备注(意式豆) 或 其他数据
                ...unknown[]    // 其他数据
            ];
            
            const [序号, 品牌, 咖啡豆, 烘焙度, 克价, 喜好星值, videoEpisode, ...rest] = rowArray;
            
            const beanId = 序号 !== undefined ? String(序号).trim() : '';
            const price = parseFloat(String(克价)) || 0;
            const rating = parseFloat(String(喜好星值)) || 0;
            const name = `${品牌} ${咖啡豆}`;
            const capacity = '200'; // Default capacity
            
            let 备注 = '';
            let purchaseChannel = '';
            
            if (beanType === 'espresso') {
                if (rest.length >= 3) {
                    purchaseChannel = String(rest[2] || ''); // 意式豆 - 购买渠道 (Index 9 in original rowArray, rest index 2)
                    备注 = String(rest[3] || ''); // 意式豆 - 备注 (Index 10 in original rowArray, rest index 3)
                }
            } else if (beanType === 'filter') {
                 if (rest.length >= 1) {
                     purchaseChannel = String(rest[0] || ''); // 手冲豆 - 购买渠道 (Index 7 in original rowArray, rest index 0)
                     备注 = String(rest[1] || ''); // 手冲豆 - 备注 (Index 8 in original rowArray, rest index 1)
                 }
            }
            
            const episode = videoEpisode ? String(videoEpisode).trim() : '';
            const uniqueId = `blogger-${beanType}-2025-${beanId}-${name}-${Math.random().toString(36).substr(2, 5)}`;
            
            return {
                id: uniqueId,
                name,
                beanType,
                year: 2025, // Add year
                roastLevel: String(烘焙度 || '未知'), // Handle potentially undefined roast level
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
                    })(rest[0]), // Espresso score (Index 7 in original rowArray, rest index 0)
                    ratingMilkBased: ((value) => {
                        const parsed = parseFloat(String(value));
                        return isNaN(parsed) ? undefined : parsed; // Use undefined if NaN
                    })(rest[1]) // Milk score (Index 8 in original rowArray, rest index 1)
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
                    console.log('Checking simplified filter for 皮爷咖啡 多明戈大街:', { brandExists, nameExists, episodeExists, row });
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

            const uniqueId = `blogger-${beanType}-2024-${beanId}-${name.replace(/\s+/g, '-')}-${Math.random().toString(36).substr(2, 5)}`;

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


export function getBloggerBeans(type: 'all' | 'espresso' | 'filter' = 'all', year: 2024 | 2025 = 2025): BloggerBean[] {
    let beans: BloggerBean[] = [];
    const parseFn = year === 2024 ? parseCSVContent2024 : parseCSVContent2025;
    const filterCSV = year === 2024 ? filterBeans2024CSV : filterBeans2025CSV;
    const espressoCSV = year === 2024 ? espressoBeans2024CSV : espressoBeans2025CSV;

    try {
        if (type === 'all' || type === 'filter') {
            const filterBeans = parseFn(filterCSV, 'filter');
            beans = [...beans, ...filterBeans];
        }

        if (type === 'all' || type === 'espresso') {
            const espressoBeans = parseFn(espressoCSV, 'espresso');
            beans = [...beans, ...espressoBeans];
        }
        
        // Sort based on the original index from the CSV file
        return beans.sort((a, b) => {
            // Use originalIndex for stable sorting based on CSV order
            const indexA = a.originalIndex ?? Infinity;
            const indexB = b.originalIndex ?? Infinity;
            return indexA - indexB;
        });

    } catch (error) {
        console.error(`解析 ${year} 博主榜单咖啡豆数据失败:`, error);
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