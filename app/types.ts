import { Stage } from "@/lib/config";

export interface TasteRatings {
	acidity: number;
	sweetness: number;
	bitterness: number;
	body: number;
}

// 修改 BrewingNoteData 接口，避免使用 any
export interface BrewingNoteData {
	id: string;
	timestamp: number;
	equipment?: string;
	method?: string;
	params?: {
		coffee: string;
		water: string;
		ratio: string;
		grindSize: string;
		temp: string;
	};
	stages?: Stage[];
	totalTime?: number;
	coffeeBeanInfo: {
		name: string;
		roastLevel: string;
		roastDate?: string;
	};
	rating: number;
	taste: TasteRatings;
	notes: string;
	[key: string]: unknown; // 使用 unknown 代替 any
}
