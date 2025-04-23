import type { Config } from "tailwindcss";
import safeArea from "tailwindcss-safe-area";

const config: Config = {
	darkMode: 'class',
	content: [
		"./pages/**/*.{js,ts,jsx,tsx,mdx}",
		"./components/**/*.{js,ts,jsx,tsx,mdx}",
		"./app/**/*.{js,ts,jsx,tsx,mdx}",
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
				'safe-top': 'max(env(safe-area-inset-top), 24px)',
				'safe-bottom': 'max(env(safe-area-inset-bottom), 28px)',
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
