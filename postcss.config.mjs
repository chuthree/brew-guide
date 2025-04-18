/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
    'postcss-preset-env': {
      features: {
        'nesting-rules': false,
        'custom-properties': false
      },
      stage: 3
    },
    'postcss-normalize': {},
    autoprefixer: {},
  },
};

export default config;
