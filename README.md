<div align="center">

<img src="public/images/icons/app/icon-192x192-contained.png" alt="Brew Guide" width="128" height="128" />

<h1>Brew Guide</h1>

一个管理咖啡豆库存、记录品鉴笔记与辅助冲煮的开源应用。

[![最新正式版](https://img.shields.io/github/v/release/chuthree/brew-guide?label=Release&color=525252)](https://github.com/chuthree/brew-guide/releases/latest)
[![下载量](https://img.shields.io/github/downloads/chuthree/brew-guide/total?label=Downloads&color=525252)](https://github.com/chuthree/brew-guide/releases)
[![最近提交](https://img.shields.io/github/last-commit/chuthree/brew-guide?label=Updated&color=525252)](https://github.com/chuthree/brew-guide/commits/main)
[![License: GPL-3.0-only](https://img.shields.io/badge/License-GPL--3.0--only-525252)](LICENSE)

[官网](https://chu3.top/brewguide) · [下载](#使用) · [使用教程](https://chu3.top/brewguide-help) · [更新日志](https://chu3.top/brewguide/changelog) · [网页版](https://coffee.chu3.top/)

</div>

## 功能

- **咖啡豆库存**：拍照识别咖啡豆信息，快捷扣除用量，查看库存与最佳赏味期。
- **品鉴笔记**：按豆子、时间和评分回看品鉴，用雷达图比较各项评分维度。
- **冲煮计时**：预设每段的注水方式、时间与水量，冲煮时实时查看进度。

更多功能介绍见[官网](https://chu3.top/brewguide)。

## 使用

| 平台         | 使用方式                                                                                                                                                                                                                                                                                                                                                                      |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| iOS / iPadOS | [![打开网页版](https://img.shields.io/badge/PWA-%E7%BD%91%E9%A1%B5%E7%89%88-525252)](https://coffee.chu3.top/) [![下载 iOS / iPadOS arm64 IPA 最新正式版](https://img.shields.io/github/v/release/chuthree/brew-guide?label=arm64%20IPA&color=525252)](https://github.com/chuthree/brew-guide/releases/latest)                                                                |
| Android      | [![下载 Android universal APK 最新正式版](https://img.shields.io/github/v/release/chuthree/brew-guide?label=universal%20APK&color=525252)](https://github.com/chuthree/brew-guide/releases/latest)                                                                                                                                                                            |
| macOS        | [![下载 macOS arm64 DMG 最新正式版](https://img.shields.io/github/v/release/chuthree/brew-guide?label=arm64%20DMG&color=525252)](https://github.com/chuthree/brew-guide/releases/latest) [![下载 macOS x64 DMG 最新正式版](https://img.shields.io/github/v/release/chuthree/brew-guide?label=x64%20DMG&color=525252)](https://github.com/chuthree/brew-guide/releases/latest) |
| Windows      | [![下载 Windows x64 EXE 最新正式版](https://img.shields.io/github/v/release/chuthree/brew-guide?label=x64%20EXE&color=525252)](https://github.com/chuthree/brew-guide/releases/latest)                                                                                                                                                                                        |
| Linux        | [![下载 Linux x64 AppImage 最新正式版](https://img.shields.io/github/v/release/chuthree/brew-guide?label=x64%20AppImage&color=525252)](https://github.com/chuthree/brew-guide/releases/latest)                                                                                                                                                                                |

桌面版支持 MCP，可在“设置 → 实验性功能 → MCP 连接”获取配置，供本机客户端按权限查询和管理数据。连接期间需保持应用运行。

## 数据

数据默认保存在设备本地，无需注册账号。网页版和 PWA 使用 IndexedDB，移动端和桌面端应用使用 SQLite。

支持导入导出和备份，也可以自行配置 Supabase、WebDAV 或 S3，在设备之间同步数据。

## 隐私

Brew Guide 不接入广告或行为分析服务，不自动上传用于产品分析的使用数据或崩溃报告。图片识别、云同步等可选功能会按需传输相关数据，联网请求也可能产生必要的运行与安全日志。

完整说明见[隐私政策](https://chu3.top/brewguide/privacy)。

## 开发

基于 Next.js、React、TypeScript 和 Tailwind CSS。移动端使用 Capacitor，桌面端使用 Tauri。

使用 Node.js 24 和 pnpm 12.11.2。

```bash
pnpm install
pnpm dev
```

| 命令                                  | 用途                                                    |
| ------------------------------------- | ------------------------------------------------------- |
| `pnpm build`                          | 构建 Web 静态产物与 PWA Service Worker，输出到 `out/`。 |
| `pnpm cap:build`                      | 构建并同步至移动端工程。                                |
| `pnpm cap:ios` / `pnpm cap:android`   | 打开 iOS / Android 工程。                               |
| `pnpm tauri:dev` / `pnpm tauri:build` | 开发或构建桌面端。                                      |

移动端开发需安装 Xcode 或 Android Studio；桌面端开发需安装 Rust 1.88 或以上版本和 Tauri 对应的系统依赖。

Android 版提供 ContentProvider 接口，供其他应用经用户授权后查询和管理本机数据，详见 [接入指南](docs/android-provider.md)。

## 反馈

问题和建议请提交到 [Issues](https://github.com/chuthree/brew-guide/issues)。报告问题时，请附上应用版本、使用平台和复现步骤。

## 维护状态

自 v1.7.2 长期稳定版起，项目转入维护阶段，后续仅提供必要的问题修复与兼容性更新。

## 相关项目

[brew-guide-cli](https://github.com/swiftwind0405/brew-guide-cli)：社区维护的命令行工具，用于管理 Brew Guide 的 Supabase 同步数据。

[bookoo-brew](https://github.com/iamzzz774/bookoo-brew)：支持蓝牙连接 BOOKOO 咖啡秤和可选的 MT80 磨豆参数，配合 Brew Guide 管理笔记与库存。

## 许可证

[GPL-3.0-only](LICENSE) · © 2026 [chu3](https://github.com/chuthree)
