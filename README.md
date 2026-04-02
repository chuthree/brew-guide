# Brew Guide APP

Brew Guide 是一个面向精品咖啡爱好者的开源应用，聚焦冲煮辅助、库存管理与品鉴记录等实际需求。

[在线体验](https://coffee.chu3.top/) · [下载与安装](https://chu3.top/brewguide) · [更新日志](https://chu3.top/notes/brew-guide-changelog) · [帮助文档](https://chu3.top/brewguide-help) · [架构文档](docs/ARCHITECTURE.md)

![应用截图](https://pic1.imgdb.cn/item/6913fbc43203f7be00f6dedd.png)

## 核心能力

- **冲煮引导**：支持多种器具与冲煮方案，提供分阶段计时和注水可视化，帮助稳定复现参数。
- **豆仓管理**：集中管理咖啡豆信息、产地、处理法、品种、烘焙度、容量和新鲜度。
- **烘焙与库存追踪**：支持生豆与熟豆管理、烘焙转换、消耗记录和剩余量查看。
- **品鉴记录**：记录评分、风味、口感、冲煮参数和备注，并关联器具、方案与豆子数据。
- **统计与回顾**：提供偏好统计、历史趋势和年度咖啡报告，方便回看自己的冲煮与喝豆习惯。
- **数据掌控**：默认本地存储，支持导入导出、备份，以及 `Supabase`、`WebDAV`、`S3` 多种同步方式。
- **多端体验**：支持 Web、PWA、iOS、Android、macOS、Windows、Linux，并适配深浅色模式与墨水屏场景。

## 平台支持

| 平台 | 说明 |
| --- | --- |
| Web / PWA | 可直接访问网页使用，也可安装为类原生应用，并支持离线访问 |
| iOS / Android | 基于 Capacitor 打包，便于接入原生能力 |
| macOS / Windows / Linux | 基于 Tauri 构建桌面端 |

## 开发

### 环境要求

- Node.js `>= 18.19.0`
- pnpm

### 本地运行

```bash
pnpm install
pnpm dev
```

### 常用命令

```bash
# Web 构建
pnpm build

# 代码检查
pnpm lint

# HTTPS 开发环境（测试 PWA、相机等能力时使用）
pnpm dev --experimental-https

# 移动端
pnpm cap:build
pnpm cap:ios
pnpm cap:android

# 桌面端
pnpm tauri:dev
pnpm tauri:build
```

## 技术栈

- [Next.js 16](https://nextjs.org/)
- [React 19](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [Framer Motion](https://www.framer.com/motion/)
- [Dexie](https://dexie.org/)
- [Supabase](https://supabase.com/)
- [Capacitor](https://capacitorjs.com/)
- [Tauri](https://tauri.app/)

## 相关项目

- [brew-guide-cli](https://github.com/swiftwind0405/brew-guide-cli)：社区开发的命令行工具，可直接在终端中管理 Brew Guide 的 Supabase 同步数据。

## 贡献

欢迎提交 Issue 和 PR，也欢迎分享使用反馈和改进建议。

## 许可证

本项目采用 [GPL-3.0](https://www.gnu.org/licenses/gpl-3.0.html) 开源协议。

Copyright © 2026 chu3 (chuthree)
