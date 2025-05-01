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
	grindSize: string;
	temp: string;
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
						grindSize: detail.grindSize || "",
						temp: detail.temp || "",
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
						...editableParams,
						coffee: `${parsedValue}g`,
						water: `${calculatedWater}g`,
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
				case "ratio": {
					const newRatio = parsedValue;
					const calculatedWater = Math.round(currentCoffee * newRatio);
					newParams = {
						...editableParams,
						ratio: `1:${newRatio}`,
						water: `${calculatedWater}g`,
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
							ratio: `1:${newRatio}`,
							water: `${calculatedWater}g`,
							stages: updatedStages,
						},
					};
					setCurrentBrewingMethod(updatedMethod);
					break;
				}
				case "grindSize": {
					// 存储原始输入的研磨度值，不进行转换，确保通用研磨度值保存
					newParams = {
						...editableParams,
						grindSize: value
					};
					const updatedMethod = {
						...currentBrewingMethod,
						params: {
							...currentBrewingMethod.params,
							grindSize: value
						},
					};
					setCurrentBrewingMethod(updatedMethod);
					break;
				}
				case "temp": {
					const formattedTemp = value.includes('°C') ? value : `${value}°C`;
					newParams = {
						...editableParams,
						temp: formattedTemp
					};
					const updatedMethod = {
						...currentBrewingMethod,
						params: {
							...currentBrewingMethod.params,
							temp: formattedTemp
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
					// 只是记录变化，等冲煮完成后再统一扣减
				} catch {
					// 错误处理
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
