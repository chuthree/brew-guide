const fs = require('fs');
const path = require('path');

// 图片迁移映射
const imageMigrations = {
  // 图标
  'icons/icon-192x192.png': 'images/icons/app/icon-192x192.png',
  'icons/icon-512x512.png': 'images/icons/app/icon-512x512.png',
  'favicon.ico': 'images/icons/app/favicon.ico',
  
  // UI 图标
  'next.svg': 'images/icons/ui/next.svg',
  'vercel.svg': 'images/icons/ui/vercel.svg',
  'window.svg': 'images/icons/ui/window.svg',
  'globe.svg': 'images/icons/ui/globe.svg',
  'file.svg': 'images/icons/ui/file.svg',
  
  // 内容图片
  'appreciationCode.jpg': 'images/content/appreciation-code.jpg',
  'groupCode.jpg': 'images/content/group-code.jpg',
  
  // 动画相关
  'images/valve-open.svg': 'images/icons/ui/valve-open.svg',
  'images/valve-closed.svg': 'images/icons/ui/valve-closed.svg',
  'images/v60-base.svg': 'images/icons/ui/v60-base.svg',
  'images/kalita-base.svg': 'images/icons/ui/kalita-base.svg',
  'images/origami-base.svg': 'images/icons/ui/origami-base.svg',
};

// 动画帧迁移
const motionPatterns = [
  {
    pattern: 'images/pour-center-motion-*.svg',
    target: 'images/icons/ui/pour-center-motion-*.svg'
  },
  {
    pattern: 'images/pour-circle-motion-*.svg',
    target: 'images/icons/ui/pour-circle-motion-*.svg'
  },
  {
    pattern: 'images/pour-ice-motion-*.svg',
    target: 'images/icons/ui/pour-ice-motion-*.svg'
  }
];

// 确保目标目录存在
function ensureDirectoryExists(filePath) {
  const dirname = path.dirname(filePath);
  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true });
  }
}

// 迁移单个文件
function migrateFile(source, target) {
  const sourcePath = path.join('public', source);
  const targetPath = path.join('public', target);
  
  if (fs.existsSync(sourcePath)) {
    ensureDirectoryExists(targetPath);
    fs.copyFileSync(sourcePath, targetPath);
    console.log(`Migrated: ${source} -> ${target}`);
  } else {
    console.warn(`Warning: Source file not found: ${source}`);
  }
}

// 迁移动画帧
function migrateMotionFrames() {
  motionPatterns.forEach(({ pattern, target }) => {
    const sourceDir = path.join('public', path.dirname(pattern));
    const targetDir = path.join('public', path.dirname(target));
    
    if (fs.existsSync(sourceDir)) {
      const files = fs.readdirSync(sourceDir);
      const patternRegex = new RegExp(pattern.replace('*', '\\d+'));
      
      files.forEach(file => {
        if (patternRegex.test(file)) {
          const source = path.join(path.dirname(pattern), file);
          const target = path.join(path.dirname(target), file);
          migrateFile(source, target);
        }
      });
    }
  });
}

// 执行迁移
function migrateImages() {
  // 迁移单个文件
  Object.entries(imageMigrations).forEach(([source, target]) => {
    migrateFile(source, target);
  });
  
  // 迁移动画帧
  migrateMotionFrames();
  
  console.log('Image migration completed!');
}

migrateImages(); 