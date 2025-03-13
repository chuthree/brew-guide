const fs = require('fs');
const path = require('path');
const { version } = require('./version');

// 需要更新版本号的文件列表
const files = [
    {
        path: 'package.json',
        updateFn: (content) => {
            const pkg = JSON.parse(content);
            pkg.version = version;
            return JSON.stringify(pkg, null, '\t');
        }
    },
    {
        path: 'lib/config.ts',
        updateFn: (content) => {
            return content.replace(
                /export const APP_VERSION = ".*";/,
                `export const APP_VERSION = "${version}";`
            );
        }
    }
];

// 更新每个文件的版本号
files.forEach(file => {
    const filePath = path.join(__dirname, file.path);

    try {
        // 读取文件内容
        const content = fs.readFileSync(filePath, 'utf8');

        // 更新版本号
        const updatedContent = file.updateFn(content);

        // 写入更新后的内容
        fs.writeFileSync(filePath, updatedContent);

        console.log(`✅ 已更新 ${file.path} 的版本号为 ${version}`);
    } catch (error) {
        console.error(`❌ 更新 ${file.path} 失败:`, error.message);
    }
});

console.log(`\n🎉 版本号已更新为 ${version}`); 