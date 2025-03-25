import { Storage } from "@/lib/storage";
import { CoffeeBean } from "@/app/types";
import { nanoid } from "nanoid";

/**
 * 咖啡豆管理工具类
 */
export const CoffeeBeanManager = {
	/**
	 * 获取所有咖啡豆
	 * @returns 咖啡豆数组
	 */
	async getAllBeans(): Promise<CoffeeBean[]> {
		try {
			const data = await Storage.get("coffeeBeans");
			if (!data) return [];
			return JSON.parse(data) as CoffeeBean[];
		} catch {
			return [];
		}
	},

	/**
	 * 获取单个咖啡豆
	 * @param id 咖啡豆ID
	 * @returns 咖啡豆对象，如果不存在则返回null
	 */
	async getBeanById(id: string): Promise<CoffeeBean | null> {
		try {
			const beans = await this.getAllBeans();
			return beans.find((bean) => bean.id === id) || null;
		} catch {
			return null;
		}
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
			await Storage.set("coffeeBeans", JSON.stringify(beans));
			return newBean;
		} catch {
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

			// 不允许修改id和timestamp
			const { id: _id, timestamp: _timestamp, ...validUpdates } = updates;

			beans[index] = {
				...beans[index],
				...validUpdates,
			};

			await Storage.set("coffeeBeans", JSON.stringify(beans));
			return beans[index];
		} catch {
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

			await Storage.set("coffeeBeans", JSON.stringify(filtered));
			return true;
		} catch {
			return false;
		}
	},

	/**
	 * 格式化数值，当没有小数部分时显示为整数
	 * @param value 数值
	 * @returns 格式化后的字符串
	 */
	formatNumber(value: number): string {
		return Number.isInteger(value) ? value.toString() : value.toFixed(1);
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
			const currentRemaining = parseFloat(bean.remaining) || 0;

			// 确保计算正确，保留一位小数的精度
			const newRemaining = Math.max(0, currentRemaining - usedAmount);

			// 格式化结果
			const formattedNewRemaining = this.formatNumber(newRemaining);

			// 更新咖啡豆剩余量
			const result = await this.updateBean(id, {
				remaining: formattedNewRemaining,
			});

			return result;
		} catch {
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

			// 刷新所有已评分的咖啡豆列表（这里可以做一些额外的处理确保列表更新）
			// 暂不实现缓存机制，每次调用都重新获取数据

			return updatedBean;
		} catch {
			throw new Error("更新咖啡豆评分失败");
		}
	},

	/**
	 * 获取所有已评分的咖啡豆
	 * @returns 已评分的咖啡豆数组
	 */
	async getRatedBeans(): Promise<CoffeeBean[]> {
		try {
			const beans = await this.getAllBeans();
			return beans.filter(
				(bean) => bean.overallRating && bean.overallRating > 0
			);
		} catch {
			return [];
		}
	},

	/**
	 * 获取特定类型的已评分咖啡豆（意式或手冲）
	 * @param type 豆子类型：'espresso' 或 'filter'
	 * @returns 指定类型的已评分咖啡豆数组
	 */
	async getRatedBeansByType(
		type: "espresso" | "filter"
	): Promise<CoffeeBean[]> {
		try {
			const beans = await this.getRatedBeans();
			return beans.filter((bean) => bean.beanType === type);
		} catch {
			return [];
		}
	},
};
