# 云同步连接方式

WebDAV 和 S3 共用 `src/lib/sync/cloudHttp.ts`：

- Android：通过应用内 OkHttp 插件直连，支持 `PROPFIND`、`MKCOL`、`COPY` 等 WebDAV 方法。
- iOS：通过 CapacitorHttp 直连。
- Tauri 桌面端：通过 HTTP 插件直连。权限允许用户配置 HTTP/HTTPS 云存储地址。
- 浏览器及 PWA：由用户填写自己的代理，未填写时不能连接。

原生端忽略代理设置，不回退到公共代理。原生网络能力需要重新打包安装应用，仅更新网页资源不能为旧壳添加 Android/Tauri 插件。原生请求不自动跟随重定向，服务地址应填写最终地址，避免重定向改变 WebDAV 方法或破坏 S3 签名。

## 连接凭据

WebDAV、S3、Supabase 连接配置及当前同步服务选择只保留在本机。普通数据导出、云同步及同步前新生成的备份不携带这些配置，恢复旧备份也不会覆盖本机连接。换设备后需重新配置连接。

本地升级迁移使用的完整恢复快照保留旧存储内容，不属于普通数据导出，可能包含旧凭据，应仅自行保管。历史云备份不会自动删除或重写，曾经通过公共代理使用过的应用密码应在测试后撤销。

WebDAV、S3 的云存储和代理地址要求 HTTPS，仅本机 localhost/127.0.0.1/[::1] 调试允许 HTTP。HTTPS 加密传输链路，公共代理仍可读取其转发的 WebDAV Basic 认证及同步内容。当前本地设置没有额外的凭据加密或钥匙串保护。

## 浏览器配置

应用不再内置 `cors.chu3.top` 或读取 `NEXT_PUBLIC_S3_PROXY_URL`。旧配置没有 `proxyUrl` 时，需要先设置自定义代理，或改用原生应用。

自定义代理分别保存在 WebDAV / S3 设置的 `proxyUrl` 中，随应用设置持久化和导入导出。支持两种格式：

```text
https://proxy.example/raw?url=
https://proxy.example/forward?target={url}
```

前一种在末尾拼接 URL 编码后的目标地址，后一种替换 `{url}`。代理必须返回上游原始响应体、状态码及响应头，不应将错误包装为 HTTP 200。

代理需满足以下条件：

连接测试通过临时文件的 PUT/GET 验证读写，再用 DELETE 清理；元数据直接 GET，复制通过 GET/PUT 完成。已有目录中的基本同步不再先发 PROPFIND。路径不存在时才尝试 WebDAV 建目录；不支持时需在云盘手动创建远程目录及其 backups 子目录。备份历史列表和旧备份清理仍需 PROPFIND。

CorsProxy.io 当前预检未放行 PROPFIND；实测基本连接的 PUT 成功，但 GET 返回 403，错误为免费套餐不支持该内容类型。简化方法不能解除代理的套餐限制。

- 处理浏览器的 OPTIONS 预检，并允许应用来源及实际请求方法、请求头。
- 基本同步转发 GET、PUT、DELETE、Authorization、If-Match 和 If-None-Match。自动建目录及完整备份管理还需要 PROPFIND、MKCOL 和 Depth。
- 转发 S3 请求时保持原始目标路径、查询参数及请求体字节，保留 `Authorization` 和 `x-amz-*` 等签名相关请求头；上游 Host 使用存储服务域名。
- 保留强 ETag、条件写入语义及 HTTP 412，并通过 `Access-Control-Expose-Headers: ETag` 将 ETag 暴露给浏览器。不能支持这些条件时，自动合并会停止以避免覆盖其他设备的更新。
- 不缓存同步请求，不记录应用密码、签名和同步内容。仅使用自己部署或信任的代理。

浏览器跨域权限由服务端提供，预签名 URL 本身不会解除跨域限制。

## 手动验收

使用重新打包的 iOS、Android、桌面安装版分别检查 WebDAV 和 S3 的连接、上传、下载、双向合并、备份列表和恢复，并检查中文及图片数据。确认原生请求直接发往存储服务，没有访问公共代理。

浏览器检查自定义代理、清空/修改代理后重新连接、重新加载后的设置持久化，以及未设置代理时的错误提示。两个设备同时写入时，强 ETag 校验和条件写入仍须阻止覆盖。
