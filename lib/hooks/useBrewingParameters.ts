import { useState, useCallback } from "react";
import { Method, Stage } from "@/lib/config";

// 参数显示接口
export interface ParameterInfo {
	equipment: string | null;
	method: string | null;
	params: {
		coffee?: string;
		water?: string;
		ratio?: string;
		grindSize?: string;
		temp?: string;
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

	// 处理参数变更
	const handleParamChange = useCallback(
		(
			type: keyof EditableParams,
			value: string,
			selectedMethod: Method | null,
			currentBrewingMethod: Method | null,
			updateBrewingSteps: (stages: Stage[]) => void,
			setCurrentBrewingMethod: (method: Method) => void
		) => {
			if (!editableParams || !selectedMethod || !currentBrewingMethod)
				return;

			const currentCoffee = extractNumber(editableParams.coffee);
			const currentRatioNumber = extractRatioNumber(editableParams.ratio);

			let newParams = { ...editableParams };
			const parsedValue = parseFloat(value);

			if (isNaN(parsedValue) || parsedValue <= 0) return;

			switch (type) {
				case "coffee": {
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
	};
}
