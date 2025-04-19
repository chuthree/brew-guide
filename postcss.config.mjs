/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
    'postcss-preset-env': {
      features: {
        'nesting-rules': false,
        'custom-properties': false
      },
      stage: 3,
      browsers: [
        'last 2 versions',
        '> 1%',
        'iOS >= 9',
        'Android >= 4.4',
        'not dead'
      ],
      autoprefixer: {
        flexbox: true,
        grid: true
      }
    },
    'postcss-normalize': {
      browsers: [
        'last 2 versions',
        '> 1%',
        'iOS >= 9',
        'Android >= 4.4',
        'not dead'
      ]
    },
    autoprefixer: {
      flexbox: true,
      grid: true
    },
  },
};

export default config;
