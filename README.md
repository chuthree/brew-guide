# BrewGuide Online Shell

这个分支只维护 BrewGuide 在线版的 Capacitor 原生壳。

应用启动后加载远程前端：

```text
https://coffee.chu3.top/
```

本分支不再维护本地 Next.js 前端、桌面端、旧服务端或静态站点构建产物。

## Android

```bash
pnpm install
pnpm cap:build
pnpm android:release
```

当前在线版版本：

- Android package: `com.brewguide.online`
- Android versionName: `1.0.1`
- Android versionCode: `2`

`versionCode` 必须持续递增，才能让已安装 `1.0.0` 的在线版用户直接升级。
