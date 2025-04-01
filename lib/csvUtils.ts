import { CoffeeBean } from '@/app/types';
import filterBeansCSV from '@/public/data/filter-beans.csv';
import espressoBeansCSV from '@/public/data/espresso-beans.csv';

export interface BloggerBean extends CoffeeBean {
    isBloggerRecommended: boolean;
    dataSource?: string;
    videoEpisode?: string; // 视频期数
}

function parseCSVContent(records: unknown[], beanType: 'espresso' | 'filter'): BloggerBean[] {
    // 跳过前两行（标题行和列名行）
    const dataRows = records.slice(2);
    
    return dataRows
        .filter(row => {
            // 过滤掉空行和无效数据
            if (!Array.isArray(row) || row.length < 5) return false;
            
            const [_序号, 品牌, 咖啡豆, 烘焙度, 克价, _喜好星值] = row;
            
            // 检查是否有品牌和咖啡豆名称
            return 品牌 && 咖啡豆 && 烘焙度 && 克价;
        })
        .map(row => {
            // 使用类型断言，避免 any 类型警告
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
            
            // 序号可能是数字或字符串，确保正确处理
            const beanId = 序号 !== undefined ? String(序号).trim() : '';
            
            // 安全地解析数值
            const price = parseFloat(String(克价)) || 0;
            const rating = parseFloat(String(喜好星值)) || 0;
            const name = `${品牌} ${咖啡豆}`;
            const capacity = '200'; // 默认值
            
            // 获取备注，在意式豆CSV中是第11列(索引为10)，手冲豆中可能在不同位置
            let 备注 = '';
            let purchaseChannel = '';
            
            if (beanType === 'espresso') {
                // 意式豆的处理
                if (rest.length >= 3) {
                    purchaseChannel = String(rest[2] || ''); // 意式豆的购买渠道在第10列
                    备注 = String(rest[3] || ''); // 意式豆的备注在第11列
                }
            } else if (beanType === 'filter') {
                // 手冲豆的处理
                if (rest.length >= 1) {
                    purchaseChannel = String(rest[0] || ''); // 手冲豆的购买渠道在第8列
                    备注 = String(rest[1] || ''); // 手冲豆的备注可能在第9列
                }
            }
            
            // 视频期数处理 - 确保是字符串格式
            const episode = videoEpisode ? String(videoEpisode).trim() : '';
            
            // 生成唯一ID，加入序号以便识别
            const uniqueId = `blogger-${beanType}-${beanId}-${name}-${Math.random().toString(36).substr(2, 5)}`;
            
            return {
                id: uniqueId,
                name,
                beanType,
                roastLevel: String(烘焙度),
                price: `${(price * 100).toFixed(2)}`, // 转换为每百克价格，保留两位小数
                capacity,
                remaining: capacity,
                overallRating: rating,
                ratingNotes: String(备注 || ''),
                purchaseChannel: purchaseChannel,
                videoEpisode: episode,
                timestamp: Date.now(),
                isBloggerRecommended: true,
                dataSource: '数据来自于 Peter 咖啡豆评测榜单',
                ...(beanType === 'espresso' && rest.length >= 2 && {
                    ratingEspresso: ((value) => {
                        const parsed = parseFloat(String(value));
                        return isNaN(parsed) ? 0 : parsed; // 如果解析为NaN则返回0
                    })(rest[0]),
                    ratingMilkBased: ((value) => {
                        const parsed = parseFloat(String(value));
                        return isNaN(parsed) ? 0 : parsed; // 如果解析为NaN则返回0
                    })(rest[1])
                })
            } as BloggerBean;
        });
}

export function getBloggerBeans(type: 'all' | 'espresso' | 'filter' = 'all'): BloggerBean[] {
    let beans: BloggerBean[] = [];

    try {
        if (type === 'all' || type === 'filter') {
            const filterBeans = parseCSVContent(filterBeansCSV, 'filter');
            console.log('加载手冲豆:', filterBeans.length, '款');
            beans = [...beans, ...filterBeans];
        }

        if (type === 'all' || type === 'espresso') {
            const espressoBeans = parseCSVContent(espressoBeansCSV, 'espresso');
            console.log('加载意式豆:', espressoBeans.length, '款');
            beans = [...beans, ...espressoBeans];
        }

        console.log('总共加载博主榜单咖啡豆:', beans.length, '款');
        
        // 修改排序逻辑：
        // 对于博主榜单豆列表，保留原始排序顺序，不排除0分豆子
        return beans.sort((a, b) => {
            // 默认情况下，使用ID中的序号进行排序
            const aId = a.id || '';
            const bId = b.id || '';
            
            // 从 id 中提取序号（格式为 blogger-type-序号-name-随机字符）
            const aMatch = aId.match(/blogger-\w+-(\d+)-/);
            const bMatch = bId.match(/blogger-\w+-(\d+)-/);
            
            if (aMatch && bMatch) {
                // 如果两者都有序号，按序号排序
                return parseInt(aMatch[1]) - parseInt(bMatch[1]);
            } else if (aMatch) {
                // a 有序号，b 没有，a 排前面
                return -1;
            } else if (bMatch) {
                // b 有序号，a 没有，b 排前面
                return 1;
            }
            
            // 如果没有序号信息，则按评分排序
            return (b.overallRating || 0) - (a.overallRating || 0);
        });
    } catch (error) {
        console.error('解析博主榜单咖啡豆数据失败:', error);
        return [];
    }
}

// 辅助函数 - 从视频期数转换为视频链接地址
export function getVideoUrlFromEpisode(episode?: string, beanType?: 'espresso' | 'filter'): string {
    if (!episode) return '';
    
    // 格式化期数，确保是两位数（如 01、02、03）
    const formattedEpisode = episode.trim().length === 1 ? `0${episode.trim()}` : episode.trim();
    
    // 根据豆子类型生成不同的搜索链接
    if (beanType === 'filter') {
        // 手冲豆视频链接
        return `https://search.bilibili.com/all?keyword=Peter%E7%AE%97%E6%98%AF%E5%92%96%E5%95%A1%E4%BA%BA%E3%80%90%E6%89%8B%E5%86%B2%E8%B1%86%E8%AF%84%E6%B5%8B+2.0+%E7%89%88+${formattedEpisode}`;
    } else if (beanType === 'espresso') {
        // 意式豆视频链接
        return `https://search.bilibili.com/all?keyword=Peter%E7%AE%97%E6%98%AF%E5%92%96%E5%95%A1%E4%BA%BA%E3%80%90%E5%92%96%E5%95%A1%E8%B1%86%E8%AF%84%E6%B5%8B+2.0+%E7%89%88+${formattedEpisode}`;
    }
    
    // 默认返回空字符串
    return '';
} 