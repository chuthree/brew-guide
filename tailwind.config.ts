import type { Config } from "tailwindcss";
import safeArea from "tailwindcss-safe-area";
import animate from "tailwindcss-animate";

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
			},
			keyframes: {
				"caret-blink": {
					"0%,70%,100%": { opacity: "1" },
					"20%,50%": { opacity: "0" },
				},
			},
			animation: {
				"caret-blink": "caret-blink 1.25s ease-out infinite",
			},
		},
	},
	plugins: [
		safeArea,
		animate,
	],
	future: {
		hoverOnlyWhenSupported: true,
	},
};

export default config;
