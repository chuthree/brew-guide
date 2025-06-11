import { CoffeeBean } from "@/types/app";
import { nanoid } from "nanoid";
import { db } from "@/lib/core/db";
// @ts-expect-error - keshi类型声明问题，目前仍在使用其默认导出
import Keshi from "keshi";

// 创建Keshi缓存实例（高性能内存缓存）
const beanCache = new Keshi();

// 缓存键常量
const BEAN_CACHE_KEY = "allBeans";
const RATED_BEANS_CACHE_KEY = "ratedBeans";
const BEANS_BY_TYPE_PREFIX = "beansByType_";

// 批量操作标志
let isBatchOperation = false;

// 动态导入 Storage 的辅助函数
const getStorage = async () => {
	const { Storage } = await import('@/lib/core/storage');
	return Storage;
};

/**
 * 咖啡豆管理工具类
 */
export const CoffeeBeanManager = {
	/**
	 * 获取所有咖啡豆
	 * @returns 咖啡豆数组
	 */
	async getAllBeans(): Promise<CoffeeBean[]> {
		return beanCache.resolve(
			BEAN_CACHE_KEY,
			async () => {
				try {
					// 优先从IndexedDB加载
					const beans = await db.coffeeBeans.toArray();
					if (beans && beans.length > 0) {
						return beans;
					}

					// 如果IndexedDB中没有数据，尝试从Storage加载
					const storage = await getStorage();
					const data = await storage.get("coffeeBeans");
					if (!data) return [];

					const parsedBeans = JSON.parse(data) as CoffeeBean[];

					// 将数据保存到IndexedDB以便下次使用
					if (parsedBeans.length > 0) {
						await db.coffeeBeans.bulkPut(parsedBeans);
					}

					return parsedBeans;
				} catch (error) {
					console.error("加载咖啡豆数据失败:", error);
					return [];
				}
			},
			"5mins" // 缓存5分钟，平衡性能和数据新鲜度
		);
	},

	/**
	 * 清除所有缓存
	 */
	clearCache() {
		beanCache.clear();
	},
	
	/**
	 * 组件卸载时清理缓存资源
	 */
	teardownCache() {
		beanCache.teardown();
	},

	/**
	 * 获取单个咖啡豆
	 * @param id 咖啡豆ID
	 * @returns 咖啡豆对象，如果不存在则返回null
	 */
	async getBeanById(id: string): Promise<CoffeeBean | null> {
		return beanCache.resolve(
			`bean_${id}`,
			async () => {
				try {
					// 优先从IndexedDB查询单个记录
					const bean = await db.coffeeBeans.get(id);
					if (bean) {
						return bean;
					}
					
					// 如果没有找到，尝试从所有豆子中查找
					const beans = await this.getAllBeans();
					return beans.find((bean) => bean.id === id) || null;
				} catch (error) {
					console.error(`获取咖啡豆[${id}]失败:`, error);
					return null;
				}
			},
			"10mins"
		);
	},

	/**
	 * 添加新咖啡豆
	 * @param bean 咖啡豆数据（不含ID和时间戳）
	 * @returns 添加后的咖啡豆对象
	 */
	async addBean(
		bean: Omit<CoffeeBean, "id" | "timestamp">
	): Promise<CoffeeBean> {
		try {
			const beans = await this.getAllBeans();

			// 确保烘焙度有默认值
			const beanWithDefaults = {
				...bean,
				roastLevel: bean.roastLevel || "浅度烘焙",
			};

			const newBean: CoffeeBean = {
				...beanWithDefaults,
				id: nanoid(),
				timestamp: Date.now(),
			};
			beans.push(newBean);
			
			// 保存到存储
			const storage = await getStorage();
			await storage.set("coffeeBeans", JSON.stringify(beans));

			// 保存到IndexedDB
			await db.coffeeBeans.put(newBean);
			
			// 使缓存失效，确保下次获取最新数据
			this._invalidateCaches();

			// 触发咖啡豆更新事件（除非在批量操作中）
			if (typeof window !== 'undefined' && !isBatchOperation) {
				window.dispatchEvent(new CustomEvent('coffeeBeansUpdated'));
			}

			return newBean;
		} catch (error) {
			console.error('添加咖啡豆失败:', error);
			throw new Error("添加咖啡豆失败");
		}
	},

	/**
	 * 更新咖啡豆
	 * @param id 咖啡豆ID
	 * @param updates 要更新的字段
	 * @returns 更新后的咖啡豆对象，如果不存在则返回null
	 */
	async updateBean(
		id: string,
		updates: Partial<CoffeeBean>
	): Promise<CoffeeBean | null> {
		try {
			const beans = await this.getAllBeans();
			const index = beans.findIndex((bean) => bean.id === id);
			if (index === -1) return null;

			// 不允许直接修改id，但允许更新timestamp为当前时间以反映修改时间
			const { id: _id, ...validUpdates } = updates;

			// 创建更新后的咖啡豆对象
			const updatedBean = {
				...beans[index],
				...validUpdates,
				// 更新timestamp为当前时间，反映最后修改时间
				timestamp: Date.now()
			};
			
			// 更新内存中的数组
			beans[index] = updatedBean;

			// 保存更新后的数据
			const storage = await getStorage();
			await storage.set("coffeeBeans", JSON.stringify(beans));

			// 更新IndexedDB
			await db.coffeeBeans.put(updatedBean);
			
			// 使缓存失效，确保下次获取最新数据
			this._invalidateCaches();

			// 特别使单个豆子的缓存失效
			beanCache.delete(`bean_${id}`);

			// 触发咖啡豆更新事件（除非在批量操作中）
			if (typeof window !== 'undefined' && !isBatchOperation) {
				window.dispatchEvent(new CustomEvent('coffeeBeansUpdated'));
			}

			return updatedBean;
		} catch (error) {
			console.error('更新咖啡豆失败:', error);
			throw new Error("更新咖啡豆失败");
		}
	},

	/**
	 * 删除咖啡豆
	 * @param id 咖啡豆ID
	 * @returns 操作是否成功
	 */
	async deleteBean(id: string): Promise<boolean> {
		try {
			const beans = await this.getAllBeans();
			const filtered = beans.filter((bean) => bean.id !== id);

			if (filtered.length === beans.length) {
				// 没有找到需要删除的咖啡豆
				return false;
			}

			// 保存更新后的数组
			const storage = await getStorage();
			await storage.set("coffeeBeans", JSON.stringify(filtered));

			// 从IndexedDB删除
			await db.coffeeBeans.delete(id);
			
			// 使缓存失效
			this._invalidateCaches();

			// 特别使单个豆子的缓存失效
			beanCache.delete(`bean_${id}`);

			// 触发咖啡豆更新事件（除非在批量操作中）
			if (typeof window !== 'undefined' && !isBatchOperation) {
				window.dispatchEvent(new CustomEvent('coffeeBeansUpdated'));
			}

			return true;
		} catch (error) {
			console.error('删除咖啡豆失败:', error);
			return false;
		}
	},

	/**
	 * 格式化数值，对于整数不显示小数部分，非整数保留一位小数
	 * @param value 数值
	 * @returns 格式化后的字符串
	 */
	formatNumber(value: number): string {
		// 检查是否为整数
		if (Number.isInteger(value)) {
			return value.toString();
		}
		// 非整数保留一位小数
		return value.toFixed(1);
	},

	/**
	 * 更新咖啡豆剩余量
	 * @param id 咖啡豆ID
	 * @param usedAmount 使用的咖啡量(g)
	 * @returns 更新后的咖啡豆对象，如果不存在则返回null
	 */
	async updateBeanRemaining(
		id: string,
		usedAmount: number
	): Promise<CoffeeBean | null> {
		try {
			if (!id) {
				return null;
			}

			if (isNaN(usedAmount) || usedAmount <= 0) {
				return null;
			}

			const bean = await this.getBeanById(id);
			if (!bean) {
				return null;
			}

			// 转换为数字计算
			const currentRemaining = bean.remaining ? parseFloat(bean.remaining) : 0;

			// 确保计算正确，保留一位小数的精度
			const newRemaining = Math.max(0, currentRemaining - usedAmount);

			// 格式化结果
			const formattedNewRemaining = this.formatNumber(newRemaining);

			// 更新咖啡豆剩余量（timestamp会在updateBean中自动更新）
			const result = await this.updateBean(id, {
				remaining: formattedNewRemaining,
			});

			return result;
		} catch (error) {
			console.error('更新咖啡豆剩余量失败:', error);
			return null;
		}
	},

	/**
	 * 更新咖啡豆评分
	 * @param id 咖啡豆ID
	 * @param ratings 评分数据
	 * @returns 更新后的咖啡豆对象，如果不存在则返回null
	 */
	async updateBeanRatings(
		id: string,
		ratings: Partial<CoffeeBean>
	): Promise<CoffeeBean | null> {
		try {
			// 确保评分是有效的数字
			if (
				ratings.overallRating !== undefined &&
				ratings.overallRating > 0
			) {
				// 如果bean类型未定义，设置默认值
				if (!ratings.beanType) {
					ratings.beanType = "filter";
				}
			}

			// 更新咖啡豆
			const updatedBean = await this.updateBean(id, ratings);
			
			// 更新后清除已评分豆子相关的缓存
			beanCache.delete(RATED_BEANS_CACHE_KEY);
			beanCache.delete(`${BEANS_BY_TYPE_PREFIX}espresso`);
			beanCache.delete(`${BEANS_BY_TYPE_PREFIX}filter`);

			return updatedBean;
		} catch (error) {
			console.error('更新咖啡豆评分失败:', error);
			throw new Error("更新咖啡豆评分失败");
		}
	},

	/**
	 * 获取所有已评分的咖啡豆
	 * @returns 已评分的咖啡豆数组
	 */
	async getRatedBeans(): Promise<CoffeeBean[]> {
		// 修复排序问题：每次获取数据时都清除缓存，确保获取最新数据
		beanCache.delete(RATED_BEANS_CACHE_KEY);
		
		return beanCache.resolve(
			RATED_BEANS_CACHE_KEY,
			async () => {
				try {
					const beans = await this.getAllBeans();
					return beans.filter(
						(bean) => bean.overallRating && bean.overallRating > 0
					);
				} catch (error) {
					console.error('获取已评分咖啡豆失败:', error);
					return [];
				}
			},
			"10mins"
		);
	},

	/**
	 * 获取特定类型的已评分咖啡豆（意式或手冲）
	 * @param type 豆子类型：'espresso' 或 'filter'
	 * @returns 特定类型的已评分咖啡豆数组
	 */
	async getRatedBeansByType(
		type: "espresso" | "filter"
	): Promise<CoffeeBean[]> {
		// 修复排序问题：每次获取数据时都清除缓存，确保获取最新数据
		beanCache.delete(`${BEANS_BY_TYPE_PREFIX}${type}`);
		
		return beanCache.resolve(
			`${BEANS_BY_TYPE_PREFIX}${type}`,
			async () => {
				try {
					const beans = await this.getRatedBeans();
					return beans.filter((bean) => bean.beanType === type);
				} catch (error) {
					console.error(`获取${type}类型已评分咖啡豆失败:`, error);
					return [];
				}
			},
			"10mins"
		);
	},

	/**
	 * 根据名称获取咖啡豆
	 * @param name 咖啡豆名称
	 * @returns 匹配的咖啡豆对象，如果不存在则返回null
	 */
	async getBeanByName(name: string): Promise<CoffeeBean | null> {
		return beanCache.resolve(
			`beanByName_${name}`,
			async () => {
				try {
					const beans = await this.getAllBeans();
					return beans.find((bean) => bean.name === name) || null;
				} catch (error) {
					console.error(`通过名称获取咖啡豆[${name}]失败:`, error);
					return null;
				}
			},
			"10mins"
		);
	},
	
	/**
	 * 开始批量操作（禁用自动事件触发）
	 */
	startBatchOperation() {
		isBatchOperation = true;
	},

	/**
	 * 结束批量操作（重新启用自动事件触发并触发一次更新事件）
	 */
	endBatchOperation() {
		isBatchOperation = false;
		// 触发一次更新事件
		if (typeof window !== 'undefined') {
			window.dispatchEvent(new CustomEvent('coffeeBeansUpdated'));
		}
	},

	/**
	 * 使所有相关缓存失效（私有方法）
	 */
	_invalidateCaches() {
		beanCache.delete(BEAN_CACHE_KEY);
		beanCache.delete(RATED_BEANS_CACHE_KEY);
		beanCache.delete(`${BEANS_BY_TYPE_PREFIX}espresso`);
		beanCache.delete(`${BEANS_BY_TYPE_PREFIX}filter`);
	}
};
