import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

/**
 * 触感反馈工具类
 *
 * 提供各种触感反馈功能，适配移动设备
 * - impact: 轻、中、重不同级别的触感反馈
 * - notification: 成功、警告、错误等状态反馈
 * - vibrate: 自定义振动模式
 */
export const hapticFeedback = {
	/**
	 * 轻触反馈 - 用于普通点击、轻微交互
	 */
	light: async () => {
		try {
			await Haptics.impact({ style: ImpactStyle.Light });
		} catch {
			console.log("Haptics not available");
		}
	},

	/**
	 * 中等触感 - 用于确认操作、重要切换
	 */
	medium: async () => {
		try {
			await Haptics.impact({ style: ImpactStyle.Medium });
		} catch {
			console.log("Haptics not available");
		}
	},

	/**
	 * 重触感 - 用于重要操作、强调反馈
	 */
	heavy: async () => {
		try {
			await Haptics.impact({ style: ImpactStyle.Heavy });
		} catch {
			console.log("Haptics not available");
		}
	},

	/**
	 * 成功触感 - 用于操作成功完成
	 */
	success: async () => {
		try {
			await Haptics.notification({ type: NotificationType.Success });
		} catch {
			console.log("Haptics not available");
		}
	},

	/**
	 * 警告触感 - 用于需要注意的操作
	 */
	warning: async () => {
		try {
			await Haptics.notification({ type: NotificationType.Warning });
		} catch {
			console.log("Haptics not available");
		}
	},

	/**
	 * 错误触感 - 用于操作被拒绝或错误
	 */
	error: async () => {
		try {
			await Haptics.notification({ type: NotificationType.Error });
		} catch {
			console.log("Haptics not available");
		}
	},

	/**
	 * 自定义振动模式
	 * @param {number} duration - 振动持续时间（毫秒）
	 */
	vibrate: async (duration: number = 300) => {
		try {
			await Haptics.vibrate({ duration });
		} catch {
			console.log("Haptics not available");
		}
	},

	/**
	 * 多次振动
	 * 可用于计时器等特殊场景
	 * @param {number} count - 振动次数
	 * @param {number} interval - 振动间隔（毫秒）
	 * @param {number} duration - 每次振动持续时间（毫秒）
	 */
	vibrateMultiple: async (
		count: number = 3,
		interval: number = 150,
		duration: number = 100
	) => {
		try {
			for (let i = 0; i < count; i++) {
				await Haptics.vibrate({ duration });
				if (i < count - 1) {
					await new Promise((resolve) =>
						setTimeout(resolve, interval)
					);
				}
			}
		} catch {
			console.log("Haptics not available");
		}
	},

	/**
	 * 根据设备环境检测是否支持触感反馈
	 * @returns {Promise<boolean>} - 是否支持触感反馈
	 */
	isSupported: async (): Promise<boolean> => {
		try {
			// 尝试一个简单的触感来检测是否支持
			await Haptics.impact({ style: ImpactStyle.Light });
			return true;
		} catch {
			return false;
		}
	},
};

export default hapticFeedback;
