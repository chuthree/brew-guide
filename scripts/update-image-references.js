const fs = require('fs');
const path = require('path');
const glob = require('glob');

// 图片引用更新映射
const referenceUpdates = {
  // 图标
  '/icons/icon-192x192.png': '/images/icons/app/icon-192x192.png',
  '/icons/icon-512x512.png': '/images/icons/app/icon-512x512.png',
  '/favicon.ico': '/images/icons/app/favicon.ico',
  
  // UI 图标
  '/next.svg': '/images/icons/ui/next.svg',
  '/vercel.svg': '/images/icons/ui/vercel.svg',
  '/window.svg': '/images/icons/ui/window.svg',
  '/globe.svg': '/images/icons/ui/globe.svg',
  '/file.svg': '/images/icons/ui/file.svg',
  
  // 内容图片
  '/appreciationCode.jpg': '/images/content/appreciation-code.jpg',
  '/groupCode.jpg': '/images/content/group-code.jpg',
  
  // 动画相关
  '/images/valve-open.svg': '/images/icons/ui/valve-open.svg',
  '/images/valve-closed.svg': '/images/icons/ui/valve-closed.svg',
  '/images/v60-base.svg': '/images/icons/ui/v60-base.svg',
  '/images/kalita-base.svg': '/images/icons/ui/kalita-base.svg',
  '/images/origami-base.svg': '/images/icons/ui/origami-base.svg',
};

// 动画帧更新
const motionPatterns = [
  {
    pattern: '/images/pour-center-motion-',
    target: '/images/icons/ui/pour-center-motion-'
  },
  {
    pattern: '/images/pour-circle-motion-',
    target: '/images/icons/ui/pour-circle-motion-'
  },
  {
    pattern: '/images/pour-ice-motion-',
    target: '/images/icons/ui/pour-ice-motion-'
  }
];

// 更新文件中的图片引用
function updateFileReferences(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let updated = false;
  
  // 更新单个引用
  Object.entries(referenceUpdates).forEach(([oldPath, newPath]) => {
    if (content.includes(oldPath)) {
      content = content.replace(new RegExp(oldPath, 'g'), newPath);
      updated = true;
    }
  });
  
  // 更新动画帧引用
  motionPatterns.forEach(({ pattern, target }) => {
    const regex = new RegExp(`${pattern}\\d+\\.svg`, 'g');
    if (content.match(regex)) {
      content = content.replace(regex, match => {
        const number = match.match(/\d+/)[0];
        return `${target}${number}.svg`;
      });
      updated = true;
    }
  });
  
  if (updated) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated references in: ${filePath}`);
  }
}

// 更新所有文件
function updateAllReferences() {
  // 查找所有 TypeScript 和 TSX 文件
  const files = glob.sync('src/**/*.{ts,tsx}');
  
  files.forEach(file => {
    updateFileReferences(file);
  });
  
  // 更新 manifest.json
  const manifestPath = 'public/manifest.json';
  if (fs.existsSync(manifestPath)) {
    updateFileReferences(manifestPath);
  }
  
  console.log('Image reference updates completed!');
}

updateAllReferences(); 