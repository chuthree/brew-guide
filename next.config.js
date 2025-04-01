/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'export',
    webpack: (config) => {
        config.module.rules.push({
            test: /\.csv$/,
            use: [
                {
                    loader: 'csv-loader',
                    options: {
                        dynamicTyping: true,
                        header: false, // 不使用 header，我们手动处理
                        skipEmptyLines: 'greedy'
                    }
                }
            ]
        });
        return config;
    }
};

module.exports = nextConfig; 