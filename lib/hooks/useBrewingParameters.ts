import { useState, useCallback, useEffect } from "react";
import { Method, Stage } from "@/lib/config";

// 参数显示接口
export interface ParameterInfo {
	equipment: string | null;
	method: string | null;
	params: {
		coffee?: string | null;
		water?: string | null;
		ratio?: string | null;
		grindSize?: string | null;
		temp?: string | null;
	} | null;
}

// 可编辑参数接口
export interface EditableParams {
	coffee: string;
	water: string;
	ratio: string;
}

// 提取数字工具函数
const extractNumber = (str: string) => {
	const match = str.match(/[\d.]+/);
	return match ? parseFloat(match[0]) : 0;
};

// 提取比例数字工具函数
const extractRatioNumber = (ratioStr: string) => {
	// Remove "1:" prefix and extract the number
	const match = ratioStr.match(/1:(\d+\.?\d*)/);
	return match ? parseFloat(match[1]) : 0;
};

// 格式化比例工具函数
const formatRatio = (ratio: number) => {
	return Number.isInteger(ratio) ? ratio.toString() : ratio.toFixed(1);
};

// 格式化数值显示，整数不带小数点
const formatNumber = (value: number) => {
	return Number.isInteger(value) ? value.toString() : value.toFixed(1);
};

export function useBrewingParameters() {
	// 参数状态
	const [parameterInfo, setParameterInfo] = useState<ParameterInfo>({
		equipment: null,
		method: null,
		params: null,
	});

	// 可编辑参数状态
	const [editableParams, setEditableParams] = useState<EditableParams | null>(
		null
	);

	// 监听methodSelected事件，确保在导入后正确设置参数信息
	const handleMethodSelectedEvent = useCallback(
		(
			event: CustomEvent<{
				methodName?: string;
				equipment?: string;
				coffee?: string;
				water?: string;
				ratio?: string;
				grindSize?: string;
				temp?: string;
				stages?: Stage[];
			}>
		) => {
			const detail = event.detail;
			console.log("[useBrewingParameters] 收到方案选择事件:", detail);

			if (detail) {
				// 更新参数信息
				setParameterInfo({
					equipment: detail.equipment || null,
					method: detail.methodName || null,
					params: {
						coffee: detail.coffee || null,
						water: detail.water || null,
						ratio: detail.ratio || null,
						grindSize: detail.grindSize || null,
						temp: detail.temp || null,
					},
				});

				// 如果有水和咖啡参数，更新可编辑参数
				if (detail.coffee && detail.water && detail.ratio) {
					setEditableParams({
						coffee: detail.coffee,
						water: detail.water,
						ratio: detail.ratio,
					});
					console.log("[useBrewingParameters] 已更新可编辑参数:", {
						coffee: detail.coffee,
						water: detail.water,
						ratio: detail.ratio,
					});
				}
			}
		},
		[]
	);

	// 添加事件监听器
	useEffect(() => {
		if (typeof window !== "undefined") {
			window.addEventListener(
				"methodSelected",
				handleMethodSelectedEvent as EventListener
			);

			return () => {
				window.removeEventListener(
					"methodSelected",
					handleMethodSelectedEvent as EventListener
				);
			};
		}
	}, [handleMethodSelectedEvent]);

	// 处理参数变更
	const handleParamChange = useCallback(
		async (
			type: keyof EditableParams,
			value: string,
			selectedMethod: Method | null,
			currentBrewingMethod: Method | null,
			updateBrewingSteps: (stages: Stage[]) => void,
			setCurrentBrewingMethod: (method: Method) => void,
			selectedCoffeeBean?: string | null
		) => {
			if (!editableParams || !selectedMethod || !currentBrewingMethod)
				return;

			const currentCoffee = extractNumber(editableParams.coffee);
			const currentRatioNumber = extractRatioNumber(editableParams.ratio);

			let newParams = { ...editableParams };
			const parsedValue = parseFloat(value);

			if (isNaN(parsedValue) || parsedValue <= 0) return;

			// 记录新咖啡量
			let newCoffeeAmount = currentCoffee;

			switch (type) {
				case "coffee": {
					newCoffeeAmount = parsedValue;
					const calculatedWater = Math.round(
						parsedValue * currentRatioNumber
					);
					newParams = {
						coffee: `${parsedValue}g`,
						water: `${calculatedWater}g`,
						ratio: editableParams.ratio,
					};
					const waterRatio =
						calculatedWater /
						extractNumber(selectedMethod.params.water);
					const updatedStages = selectedMethod.params.stages.map(
						(stage) => ({
							...stage,
							water: `${Math.round(
								extractNumber(stage.water) * waterRatio
							)}g`,
						})
					);
					updateBrewingSteps(updatedStages);
					const updatedMethod = {
						...currentBrewingMethod,
						params: {
							...currentBrewingMethod.params,
							coffee: `${parsedValue}g`,
							water: `${calculatedWater}g`,
							stages: updatedStages,
						},
					};
					setCurrentBrewingMethod(updatedMethod);
					break;
				}
				case "water": {
					const calculatedRatio = parsedValue / currentCoffee;
					newParams = {
						coffee: editableParams.coffee,
						water: `${parsedValue}g`,
						ratio: `1:${formatRatio(calculatedRatio)}`,
					};
					const waterRatio =
						parsedValue /
						extractNumber(selectedMethod.params.water);
					const updatedStages = selectedMethod.params.stages.map(
						(stage) => ({
							...stage,
							water: `${Math.round(
								extractNumber(stage.water) * waterRatio
							)}g`,
						})
					);
					updateBrewingSteps(updatedStages);
					const updatedMethod = {
						...currentBrewingMethod,
						params: {
							...currentBrewingMethod.params,
							water: `${parsedValue}g`,
							ratio: `1:${formatRatio(calculatedRatio)}`,
							stages: updatedStages,
						},
					};
					setCurrentBrewingMethod(updatedMethod);
					break;
				}
				case "ratio": {
					const calculatedWater = Math.round(
						currentCoffee * parsedValue
					);
					newParams = {
						coffee: editableParams.coffee,
						water: `${calculatedWater}g`,
						ratio: `1:${formatRatio(parsedValue)}`,
					};
					const waterRatio =
						calculatedWater /
						extractNumber(selectedMethod.params.water);
					const updatedStages = selectedMethod.params.stages.map(
						(stage) => ({
							...stage,
							water: `${Math.round(
								extractNumber(stage.water) * waterRatio
							)}g`,
						})
					);
					updateBrewingSteps(updatedStages);
					const updatedMethod = {
						...currentBrewingMethod,
						params: {
							...currentBrewingMethod.params,
							water: `${calculatedWater}g`,
							ratio: `1:${formatRatio(parsedValue)}`,
							stages: updatedStages,
						},
					};
					setCurrentBrewingMethod(updatedMethod);
					break;
				}
			}

			setEditableParams(newParams);
			setParameterInfo((prev) => ({
				...prev,
				params: {
					...prev.params!,
					...newParams,
				},
			}));

			// 如果咖啡粉量发生变化，并且提供了咖啡豆ID，则更新咖啡豆剩余量
			if (
				type === "coffee" &&
				selectedCoffeeBean &&
				newCoffeeAmount !== currentCoffee
			) {
				try {
					console.log(
						`[参数变更] 咖啡粉量变化: ${formatNumber(
							currentCoffee
						)}g -> ${formatNumber(newCoffeeAmount)}g`
					);

					const coffeeChangeAmount = newCoffeeAmount - currentCoffee;
					console.log(
						`[参数变更] 变化量: ${formatNumber(
							coffeeChangeAmount
						)}g`
					);

					// 移除这里的咖啡豆扣减逻辑，只记录变化，等冲煮完成后再统一扣减
					console.log(
						`[参数变更] 已记录咖啡粉量变化，将在冲煮完成后统一扣减`
					);
					console.log(`[参数变更] 咖啡豆ID: ${selectedCoffeeBean}`);
					console.log(
						`[参数变更] 新咖啡用量: ${formatNumber(
							newCoffeeAmount
						)}g (冲煮完成后扣减)`
					);
				} catch (error) {
					console.error("[参数变更] 记录咖啡用量变化失败:", error);
				}
			} else {
				if (type === "coffee") {
					if (!selectedCoffeeBean) {
						console.log("[参数变更] 未选择咖啡豆");
					} else if (newCoffeeAmount === currentCoffee) {
						console.log(
							`[参数变更] 咖啡粉量未变化: ${currentCoffee}g`
						);
					}
				}
			}
		},
		[editableParams]
	);

	return {
		parameterInfo,
		setParameterInfo,
		editableParams,
		setEditableParams,
		handleParamChange,
		// 导出工具函数以便在组件中使用
		extractNumber,
		extractRatioNumber,
		formatRatio,
		formatNumber,
	};
}
