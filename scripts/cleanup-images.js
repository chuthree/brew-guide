const fs = require('fs');
const path = require('path');

// 要删除的文件列表
const filesToDelete = [
  // 根目录下的文件
  'next.svg',
  'vercel.svg',
  'window.svg',
  'globe.svg',
  'file.svg',
  'appreciationCode.jpg',
  'groupCode.jpg',
  'favicon.ico',
  
  // images 目录下的文件
  'images/valve-open.svg',
  'images/valve-closed.svg',
  'images/v60-base.svg',
  'images/kalita-base.svg',
  'images/origami-base.svg',
];

// 要删除的动画帧文件
const motionPatterns = [
  'images/pour-center-motion-*.svg',
  'images/pour-circle-motion-*.svg',
  'images/pour-ice-motion-*.svg',
];

// 删除单个文件
function deleteFile(filePath) {
  const fullPath = path.join('public', filePath);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
    console.log(`Deleted: ${filePath}`);
  }
}

// 删除动画帧文件
function deleteMotionFrames() {
  motionPatterns.forEach(pattern => {
    const dirPath = path.join('public', path.dirname(pattern));
    if (fs.existsSync(dirPath)) {
      const files = fs.readdirSync(dirPath);
      const patternRegex = new RegExp(pattern.replace('*', '\\d+'));
      
      files.forEach(file => {
        if (patternRegex.test(file)) {
          const filePath = path.join(path.dirname(pattern), file);
          deleteFile(filePath);
        }
      });
    }
  });
}

// 删除空目录
function deleteEmptyDirectories() {
  const dirsToCheck = [
    '/images',
    'public/icons',
  ];
  
  dirsToCheck.forEach(dir => {
    const dirPath = path.join('public', dir);
    if (fs.existsSync(dirPath)) {
      const files = fs.readdirSync(dirPath);
      if (files.length === 0) {
        fs.rmdirSync(dirPath);
        console.log(`Deleted empty directory: ${dir}`);
      }
    }
  });
}

// 执行清理
function cleanupImages() {
  console.log('Starting cleanup...');
  
  // 删除单个文件
  filesToDelete.forEach(file => {
    deleteFile(file);
  });
  
  // 删除动画帧文件
  deleteMotionFrames();
  
  // 删除空目录
  deleteEmptyDirectories();
  
  console.log('Cleanup completed!');
}

// 执行清理
cleanupImages(); 