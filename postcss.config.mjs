/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {
      flexbox: true,
      grid: true
    }
  },
};

export default config;
