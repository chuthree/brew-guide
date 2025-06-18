# 咖啡冲煮指南 (Brew Guide)

![版本](https://img.shields.io/badge/版本-1.3.7-blue)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/chu3/brew-guide)

## 项目简介

咖啡冲煮指南是一款现代化的咖啡冲煮助手应用，帮助咖啡爱好者记录、追踪和优化他们的冲煮过程。本应用作为一个全面的解决方案，支持多种冲煮器具、方法，并提供详细的冲煮记录功能。

### 应用访问

- 🔗 **国内访问**：[https://coffee.chu3.top/](http://coffee.chu3.top/)
- 🔗 **海外访问**：[https://brew-guide.vercel.app/](https://brew-guide.vercel.app/)

### 平台支持

本应用采用 PWA（渐进式 Web 应用）与 Capacitor 结合的方式，支持多平台运行：

| 平台 | 技术 | 特性 |
|------|------|------|
| Web | PWA | 离线支持、输入流畅、及时更新 |
| iOS | Capacitor | 离线支持、字体缩放、震动反馈 |
| Android | Capacitor | 离线支持、字体缩放、震动反馈 |

## 核心功能

### 冲煮流程管理

- 🧰 **多种冲煮器具支持**：V60、聪明杯、Kalita、Origami 等
- 📋 **丰富的冲煮方案库**：预设和自定义的冲煮方法
- ⏱️ **精确的冲煮计时器**：按阶段引导冲煮过程
- 📊 **可视化注水过程**：直观展示不同注水技巧（中心注水、环形注水等）

### 咖啡豆管理

- 📝 **咖啡豆库存**：记录豆子详细信息（产地、处理法、品种、烘焙度等）
- 📅 **烘焙日期追踪**：通过视觉指示器监控豆子新鲜度
- 📉 **消耗追踪**：记录使用情况和查看剩余数量
- 🔍 **豆子搜索**：实时过滤查找豆子
- 🎲 **随机豆子选择**：通过视觉突出显示随机选择用于冲煮的豆子

### 冲煮笔记

- ✍️ **详细的冲煮记录**：记录每次冲煮的评分、口感属性和笔记
- 🔄 **关联数据**：将笔记与特定设备、方法和豆子关联
- 📊 **数据分析**：分析趋势和偏好，优化冲煮技术

### 其他功能

- 🌓 **深色/浅色模式**：适应不同的照明条件
- 📱 **PWA 支持**：可作为独立应用安装
- 💾 **离线数据存储**：完全离线功能
- 📈 **数据统计与分析**：消费模式和偏好分析
- 📤 **数据导入导出**：分享和备份数据
- 🖼️ **墨水屏完全适配**：优化墨水屏显示
- 👁️ **无障碍设计**：色盲友好的设计选项
- 🌐 **多语言支持**：支持多种语言界面

## 快速开始

### 安装与使用

1. **Web 版本**：直接访问应用网址，支持 PWA 安装
2. **iOS/Android**：通过以下链接下载：
   - 国内用户：[123912 网盘](https://www.123912.com/s/prGKTd-HpJWA)
   - 海外用户：[GitHub Releases](https://github.com/chu3/brew-guide/releases)

### 开发环境设置

克隆仓库后，运行以下命令启动开发服务器：

```bash
# 安装依赖
npm install
# 或
pnpm install

# 启动开发服务器
npm run dev
# 或
pnpm dev
```

在浏览器中打开 [http://localhost:3000](http://localhost:3000) 查看应用。

### 构建与部署

```bash
# Web 构建
npm run build
# 或
pnpm build

# Capacitor 构建
npm run cap:build
# 或
pnpm cap:build

# iOS 开发
npm run cap:ios
# 或
pnpm cap:ios

# Android 开发
npm run cap:android
# 或
pnpm cap:android
```

## 技术栈

- [Next.js 15](https://nextjs.org/) - React 框架
- [React 19](https://react.dev/) - 用户界面库
- [Tailwind CSS 4](https://tailwindcss.com/) - 样式解决方案
- [Framer Motion](https://www.framer.com/motion/) - 动画库
- [TypeScript](https://www.typescriptlang.org/) - 类型安全
- [Capacitor](https://capacitorjs.com/) - 跨平台原生运行时
- [Dexie](https://dexie.org/) - IndexedDB 包装器

## 社区与贡献

### 交流群

欢迎加入微信交流群，讨论使用体验和功能建议：

![group-code](https://github.com/user-attachments/assets/8981d69c-5e8d-4595-8244-a7be488230df)


### 贡献指南

欢迎提交问题和功能请求！如果您想贡献代码，请先开一个 issue 讨论您想要更改的内容。

开发时请遵循项目的代码规范和架构设计：
- 代码规范详见 [项目开发规范](docs/project_develop.md)
- 项目结构详见 [项目结构规范](docs/project_struct.md)
- UI 设计参考 [设计系统](docs/design_system.md)

## 许可

本项目采用 [MIT](https://choosealicense.com/licenses/mit/) 许可证。
