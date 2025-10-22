# 咖啡冲煮指南 (Brew Guide)

![版本](https://img.shields.io/badge/版本-1.3.12--beta.1-blue)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/chu3/brew-guide)

一站式咖啡小工具，支持辅助冲煮，豆仓管理与品鉴记录功能。

<img width="800" alt="应用截图" src="https://github.com/user-attachments/assets/f1c6d047-3682-4d90-8748-16995456f092" />

## 应用访问

- **国内访问**：[https://coffee.chu3.top/](http://coffee.chu3.top/)
- **海外访问**：[https://brew-guide.vercel.app/](https://brew-guide.vercel.app/)
- **移动应用下载**：
  - 国内用户：[123912 网盘](https://www.123912.com/s/prGKTd-HpJWA)
  - 海外用户：[GitHub Releases](https://github.com/chu3/brew-guide/releases)

## 主要功能

**冲煮管理**
- 支持多种器具（V60、聪明杯、Kalita、Origami 等）
- 丰富的冲煮方案库，预设和自定义方法
- 精确的计时器，按阶段引导冲煮
- 可视化注水过程

**咖啡豆管理**
- 详细库存记录（产地、处理法、品种、烘焙度等）
- 烘焙日期追踪和新鲜度监控
- 消耗跟踪和剩余量管理
- 智能搜索：支持名称、品牌、产区、风味、处理法、品种筛选
- 在线数据库支持，快速导入咖啡豆信息

**冲煮笔记**
- 详细记录评分、口感和笔记
- 关联器具、方法和豆子数据
- 趋势分析和偏好统计

**其他特性**
- PWA 支持，可离线使用
- 深色/浅色模式
- 数据导入导出
- 墨水屏优化
- 多平台支持（Web、iOS、Android、桌面）

## 咖啡豆数据库

应用支持从开源数据库快速添加咖啡豆：

**数据来源**：[https://gitee.com/chu3/brew-guide-bean-data](https://gitee.com/chu3/brew-guide-bean-data)

**使用方法**：
1. 应用内进入"快速添加"功能
2. 点击"搜索咖啡豆"
3. 输入关键词搜索（支持名称、品牌、产区、风味、处理法、品种）
4. 选择并一键导入到库存

**数据维护**：
- 问题反馈：chuthree@163.com
- Issue 提交：[数据库仓库](https://gitee.com/chu3/brew-guide-bean-data/issues)

> 数据来源于网络公开资源，仅供学习使用，实际信息以商家为准

## 开发

**环境要求**：推荐使用 pnpm

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建
pnpm build

# 桌面应用构建
pnpm build:desktop

# 移动端开发
pnpm cap:build
pnpm cap:ios
pnpm cap:android
```

> 桌面应用构建需要预先安装 [Pake](https://github.com/tw93/Pake) 工具

## 技术栈

- [Next.js 15](https://nextjs.org/) - React 框架
- [React 19](https://react.dev/) - 用户界面库
- [Tailwind CSS 4](https://tailwindcss.com/) - 样式解决方案
- [Framer Motion](https://www.framer.com/motion/) - 动画库
- [TypeScript](https://www.typescriptlang.org/) - 类型安全
- [Capacitor](https://capacitorjs.com/) - 跨平台原生运行时
- [Pake](https://github.com/tw93/Pake) - 桌面应用打包工具
- [Dexie](https://dexie.org/) - IndexedDB 包装器

## 贡献

欢迎提交 Issue 和 PR！

- 代码规范：[项目开发规范](docs/project_develop.md)
- 项目结构：[项目结构规范](docs/project_struct.md)
- UI 设计：[设计系统](docs/design_system.md)
- 咖啡豆数据：[数据库仓库](https://gitee.com/chu3/brew-guide-bean-data)

## 许可

本项目采用 [MIT](https://choosealicense.com/licenses/mit/) 许可证。
