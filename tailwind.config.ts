import type { Config } from "tailwindcss";
import safeArea from "tailwindcss-safe-area";

const config: Config = {
	darkMode: 'class',
	content: [
		"./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
		"./src/components/**/*.{js,ts,jsx,tsx,mdx}",
		"./src/app/**/*.{js,ts,jsx,tsx,mdx}",
		"./src/features/**/*.{js,ts,jsx,tsx,mdx}",
	],
	theme: {
		extend: {
			colors: {
				background: "var(--background)",
				foreground: "var(--foreground)",
			},
			fontFamily: {
				sans: ["var(--font-sans)"],
				mono: ["var(--font-mono)"],
			},
			padding: {
				'safe-top': 'max(env(safe-area-inset-top), 36px)',
				'safe-bottom': 'max(env(safe-area-inset-bottom), 36px)',
			}
		},
	},
	plugins: [
		safeArea,
	],
	future: {
		hoverOnlyWhenSupported: true,
	},
};

export default config;
