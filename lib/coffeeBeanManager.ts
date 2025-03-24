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
		} catch (error) {
			console.error("获取咖啡豆数据失败:", error);
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
		} catch (error) {
			console.error(`获取咖啡豆(${id})失败:`, error);
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
		} catch (error) {
			console.error("添加咖啡豆失败:", error);
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
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { id: _id, timestamp: _timestamp, ...validUpdates } = updates;

			beans[index] = {
				...beans[index],
				...validUpdates,
			};

			await Storage.set("coffeeBeans", JSON.stringify(beans));
			return beans[index];
		} catch (error) {
			console.error(`更新咖啡豆(${id})失败:`, error);
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
		} catch (error) {
			console.error(`删除咖啡豆(${id})失败:`, error);
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
				console.error(`无效的咖啡豆ID: ${id}`);
				return null;
			}

			if (isNaN(usedAmount) || usedAmount <= 0) {
				console.error(`无效的使用量: ${usedAmount}g，必须大于0`);
				return null;
			}

			const bean = await this.getBeanById(id);
			if (!bean) {
				console.error(`无法找到ID为 ${id} 的咖啡豆`);
				return null;
			}

			// 转换为数字计算
			const currentRemaining = parseFloat(bean.remaining) || 0;
			const currentCapacity = parseFloat(bean.capacity);

			// 格式化显示
			const formattedRemaining = this.formatNumber(currentRemaining);
			const formattedCapacity = this.formatNumber(currentCapacity);
			const formattedUsed = this.formatNumber(usedAmount);

			console.log(`===== 更新咖啡豆剩余量 =====`);
			console.log(`咖啡豆ID: ${id}`);
			console.log(`咖啡豆名称: ${bean.name}`);
			console.log(`当前剩余量: ${formattedRemaining}g`);
			console.log(`总容量: ${formattedCapacity}g`);
			console.log(`使用量: ${formattedUsed}g`);

			// 确保计算正确，保留一位小数的精度
			const newRemaining = Math.max(0, currentRemaining - usedAmount);

			// 格式化结果
			const formattedNewRemaining = this.formatNumber(newRemaining);

			console.log(
				`计算过程: ${formattedRemaining} - ${formattedUsed} = ${formattedNewRemaining}`
			);

			// 更新咖啡豆剩余量
			const result = await this.updateBean(id, {
				remaining: formattedNewRemaining,
			});
			console.log(`更新结果: ${result ? "成功" : "失败"}`);
			if (result) {
				// 显示更新后的剩余量
				const resultRemaining = parseFloat(result.remaining);
				console.log(
					`更新后剩余量: ${this.formatNumber(resultRemaining)}g`
				);
			}
			console.log(`===== 更新结束 =====`);

			return result;
		} catch (error) {
			console.error(`更新咖啡豆剩余量(${id})失败:`, error);
			return null;
		}
	},
};
