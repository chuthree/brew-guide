# 咖啡冲煮指南 (Brew Guide)

一站式咖啡小工具,支持辅助冲煮,豆仓管理与品鉴记录功能。

![应用截图](https://pic1.imgdb.cn/item/6913fbc43203f7be00f6dedd.png)

## 网页版访问

- **全球**：[https://coffee.chu3.top/](http://coffee.chu3.top/)

## 主要功能

**冲煮管理**

- 支持多种器具（V60、聪明杯、折纸滤杯、蛋糕滤杯等）
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
- 多平台支持（Web、iOS、Android）

## 开发

**环境要求**：推荐使用 pnpm

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建
pnpm build

# 移动端开发
pnpm cap:build
pnpm cap:ios
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

## 贡献

欢迎提交 Issue 和 PR！

- 项目架构：[架构文档](docs/ARCHITECTURE.md)

## 许可

**Copyright © 2025 chuthree. All rights reserved.**

本项目采用 [GPL-3.0](https://www.gnu.org/licenses/gpl-3.0.html) 许可证开源。

**这意味着**：

- ✅ 可以自由使用、修改和分发
- ✅ 可以用于商业用途
- ❌ 衍生作品必须同样采用 GPL-3.0 开源
- ❌ 不能闭源商用

**官方仓库**：

- GitHub: https://github.com/chuthree/brew-guide
- Gitee: https://gitee.com/chu3/brew-guide

**首次发布**：2025-02-01

## 相关链接

- **服务状态**：[https://status.chu3.top/](https://status.chu3.top/)
