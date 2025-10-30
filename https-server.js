import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import handler from 'serve-handler';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const CERT_DIR = path.join(__dirname, '.cert');
const CERT_FILE = path.join(CERT_DIR, 'localhost.pem');
const KEY_FILE = path.join(CERT_DIR, 'localhost-key.pem');

// 检查证书是否存在
if (!fs.existsSync(CERT_FILE) || !fs.existsSync(KEY_FILE)) {
  console.error('❌ 错误：未找到 SSL 证书文件！');
  console.log('\n请先运行以下命令生成证书：');
  console.log('  pnpm run cert:generate\n');
  process.exit(1);
}

// 读取证书
const options = {
  key: fs.readFileSync(KEY_FILE),
  cert: fs.readFileSync(CERT_FILE),
};

// 创建 HTTPS 服务器
const server = https.createServer(options, async (request, response) => {
  // 使用 serve-handler 来服务静态文件
  return handler(request, response, {
    public: 'out',
    cleanUrls: true,
    rewrites: [{ source: '**', destination: '/index.html' }],
  });
});

server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════╗
║   🔒 HTTPS Development Server                     ║
║                                                   ║
║   📡 服务地址: https://localhost:${PORT}            ║
║   📁 静态目录: out/                               ║
║                                                   ║
║   ⚠️  使用自签名证书，浏览器会提示不安全          ║
║   💡 解决方法：点击"高级" -> "继续访问"           ║
║                                                   ║
║   ⏰ 启动时间: ${new Date().toLocaleString('zh-CN')}   ║
╚═══════════════════════════════════════════════════╝
  `);
});

// 优雅退出
process.on('SIGTERM', () => {
  console.log('\n收到 SIGTERM 信号，正在关闭服务器...');
  server.close(() => {
    console.log('✅ 服务器已关闭');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n收到 SIGINT 信号，正在关闭服务器...');
  server.close(() => {
    console.log('✅ 服务器已关闭');
    process.exit(0);
  });
});
