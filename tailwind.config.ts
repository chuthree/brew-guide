import type { Config } from "tailwindcss";
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
				'safe-top': 'var(--safe-area-top)',
				'safe-bottom': 'var(--safe-area-bottom)',
				'safe-left': 'var(--safe-area-left)',
				'safe-right': 'var(--safe-area-right)',
			},
			margin: {
				'safe-top': 'var(--safe-area-top)',
				'safe-bottom': 'var(--safe-area-bottom)',
				'safe-left': 'var(--safe-area-left)',
				'safe-right': 'var(--safe-area-right)',
			},
			keyframes: {
				"caret-blink": {
					"0%,70%,100%": { opacity: "1" },
					"20%,50%": { opacity: "0" },
				},
				"scan": {
					"0%": { transform: "translateY(0)" },
					"50%": { transform: "translateY(11rem)" },
					"100%": { transform: "translateY(0)" },
				},
			},
			animation: {
				"caret-blink": "caret-blink 1.25s ease-out infinite",
				"scan": "scan 2s ease-in-out infinite",
			},
		},
	},
	plugins: [
		animate,
	],
	future: {
		hoverOnlyWhenSupported: true,
	},
};

export default config;
