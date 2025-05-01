import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// 添加处理透明度的辅助函数，帮助替换斜杠透明度语法
export function withOpacity(className: string, opacityValue: number): string {
	// 将斜杠语法转换为 Tailwind v3 支持的格式
	// 例如：将 bg-neutral-800/70 转换为 bg-neutral-800 bg-opacity-70
	const [prefix, colorClass] = className.split('-', 2);
	const baseClass = `${prefix}-${colorClass}`;
	const opacityClass = `${prefix}-opacity-${opacityValue}`;
	
	return `${baseClass} ${opacityClass}`;
}

// 辅助函数用于替换 border 透明度
export function withBorderOpacity(colorClass: string, opacityValue: number): string {
	return `${colorClass} border-opacity-${opacityValue}`;
}
