# 咖啡冲泡指南 (Brew Guide)

一个现代化的咖啡冲泡助手应用，帮助咖啡爱好者记录和优化他们的冲泡过程。

Web版（支持PWA）：

- 🔗 （国内） [https://coffee.chu3.top/](http://coffee.chu3.top/)
- 🔗 （海外） [https://brew-guide.vercel.app/](https://brew-guide.vercel.app/)

![版本](https://img.shields.io/badge/版本-1.2.4-blue)

## 功能特点

-   🧰 多种冲泡器具支持 (V60, 聪明杯等)
-   📋 丰富的冲泡方案库
-   ⏱️ 精确的冲泡计时器
-   📊 可视化注水过程
-   📝 详细的冲泡记录
-   🔄 自定义冲泡方案
-   🌓 深色/浅色模式

## 开始使用

首先，运行开发服务器:

```bash
npm run dev
# 或
yarn dev
# 或
pnpm dev
# 或
bun dev
```

在浏览器中打开 [http://localhost:3000](http://localhost:3000) 查看应用。

## 使用指南

1. 在首页选择您的冲泡器具（如 V60、聪明杯等）
2. 选择合适的冲泡方案或创建自定义方案
3. 按照指导进行注水操作
4. 记录您的冲泡体验和口感评价
   ...

## 技术栈

-   [Next.js 15](https://nextjs.org/) - React 框架
-   [React 19](https://react.dev/) - 用户界面库
-   [Tailwind CSS 4](https://tailwindcss.com/) - 样式解决方案
-   [Framer Motion](https://www.framer.com/motion/) - 动画库
-   [TypeScript](https://www.typescriptlang.org/) - 类型安全

## 交流群

欢迎加微信交流群～
![CleanShot 2025-04-21 at 22 18 11](https://github.com/user-attachments/assets/dd7c9bc1-1b10-427f-8ac3-3a764fab313e)

## 数据存储

本应用使用IndexedDB存储大容量数据（如冲煮笔记和咖啡豆信息），小型配置数据则使用localStorage或Capacitor Preferences API保存。这种混合存储方式解决了Web存储空间限制的问题。

### 存储实现

- **大数据存储**: 使用IndexedDB（通过Dexie.js实现）
  - 冲煮笔记 (brewingNotes)
  - 咖啡豆数据 (coffeeBeans)
  
- **小型配置数据**: 使用localStorage或Capacitor Preferences API
  - 界面首选项
  - 用户设置
  - 其他小型配置数据

### 迁移说明

应用会自动将localStorage中的大容量数据迁移到IndexedDB。首次运行使用新存储系统时会自动进行迁移，无需用户干预。

## 贡献

欢迎提交问题和功能请求！如果您想贡献代码，请先开一个 issue 讨论您想要更改的内容。

## 许可

[MIT](https://choosealicense.com/licenses/mit/)

## Learn More

To learn more about Next.js, take a look at the following resources:

-   [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
-   [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
