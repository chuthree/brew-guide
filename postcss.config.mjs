/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    // 添加OKLCH颜色转换为RGB，适配旧浏览器
    '@csstools/postcss-oklab-function': {
      preserve: true, // 保留原始值以便新浏览器使用
    },
    // 处理CSS自定义属性（变量）
    'postcss-custom-properties': {
      preserve: true,
    },
    '@tailwindcss/postcss': {},
    autoprefixer: {
      flexbox: true,
      grid: true
    }
  },
};

export default config;
