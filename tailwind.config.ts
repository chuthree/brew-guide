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
				neutral: {
					50: "var(--neutral-50)",
					100: "var(--neutral-100)",
					200: "var(--neutral-200)",
					300: "var(--neutral-300)",
					400: "var(--neutral-400)",
					500: "var(--neutral-500)",
					600: "var(--neutral-600)",
					700: "var(--neutral-700)",
					800: "var(--neutral-800)",
					900: "var(--neutral-900)",
				},
			},
			fontFamily: {
				sans: ["var(--font-sans)"],
				mono: ["var(--font-mono)"],
			},
		},
	},
	plugins: [
		safeArea,
		function({ addBase }: { addBase: (styles: Record<string, Record<string, string>>) => void }) {
			addBase({
				'html': {
					'-webkit-text-size-adjust': '100%',
					'-webkit-font-smoothing': 'antialiased',
					'-moz-osx-font-smoothing': 'grayscale',
				},
				'button, [role="button"]': {
					cursor: 'pointer',
					'-webkit-tap-highlight-color': 'transparent',
				},
				'input, textarea': {
					'-webkit-appearance': 'none',
					'appearance': 'none',
					'border-radius': '0',
				},
				'.overflow-scroll': {
					'-webkit-overflow-scrolling': 'touch',
				},
			})
		}
	],
	future: {
		hoverOnlyWhenSupported: true,
	},
};

export default config;
