/**
 * WebDAV 客户端 - 浏览器环境实现
 * 支持标准 WebDAV 协议的文件服务器（Nextcloud、ownCloud、坚果云等）
 */

import type { WebDAVConfig, WebDAVFile } from './types';

export class WebDAVClient {
  private config: WebDAVConfig;
  private authHeader: string;
  private corsProxy: string;
  private verifiedDirs = new Set<string>();

  constructor(config: WebDAVConfig) {
    this.config = config;
    // 创建基础认证头
    this.authHeader = `Basic ${btoa(`${config.username}:${config.password}`)}`;
    // 使用同域 EdgeOne Functions 代理（仅在浏览器环境下需要）
    this.corsProxy = '/api/cors-proxy?url=';
  }

  /**
   * 检查代理是否返回了错误
   * 代理会把远程服务器的错误包装成 JSON 格式：{"contents":null,"status":{"error":{...}}}
   */
  private checkProxyError(responseText: string): string | null {
    try {
      // 尝试解析为 JSON（代理的错误响应格式）
      if (responseText.startsWith('{') && responseText.includes('"status"')) {
        const json = JSON.parse(responseText);

        // 检查是否有错误
        if (json.status?.error) {
          const error = json.status.error;
          return error.message || error.code || error.name || '代理请求失败';
        }

        // 检查 contents 是否为 null（代理请求失败的另一种情况）
        if (json.contents === null && json.status) {
          return '代理请求失败：无法获取远程内容';
        }
      }
    } catch {
      // 不是 JSON 格式，不是代理错误
    }
    return null;
  }

  /**
   * 检查 WebDAV 错误响应
   * 如坚果云返回: <d:error xmlns:d="DAV:"><s:exception>ObjectNotFound</s:exception>...</d:error>
   * 注意：OperationNotAllowed 不算真正的错误，只是表示当前位置不支持某些操作
   */
  private checkWebDAVError(responseText: string): string | null {
    // 🔧 OperationNotAllowed 不是真正的错误，忽略它
    if (responseText.includes('OperationNotAllowed')) {
      return null;
    }

    // 检查是否包含 error 标签
    if (
      responseText.includes('<d:error') ||
      responseText.includes('<D:error') ||
      responseText.includes('<error')
    ) {
      // 尝试提取错误信息
      const exceptionMatch = responseText.match(
        /<s:exception>([^<]+)<\/s:exception>/
      );
      const messageMatch = responseText.match(
        /<s:message>([^<]+)<\/s:message>/
      );

      if (exceptionMatch || messageMatch) {
        const exception = exceptionMatch?.[1] || '';
        const message = messageMatch?.[1] || '';
        return `${exception}: ${message}`.trim() || 'WebDAV 错误';
      }

      return 'WebDAV 返回错误响应';
    }

    // 检查常见的 WebDAV 错误
    if (
      responseText.includes('ObjectNotFound') ||
      responseText.includes('does not exist')
    ) {
      return '资源不存在';
    }

    return null;
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    // 清空之前的日志

    try {
      // 首先检查 WebDAV 服务器根路径是否可访问
      const baseUrl = this.config.url.endsWith('/')
        ? this.config.url.slice(0, -1)
        : this.config.url;
      const baseProxiedUrl = this.getProxiedUrl(baseUrl);

      console.log(`[WebDAV] 测试连接到: ${baseUrl}`);

      const baseResponse = await fetch(baseProxiedUrl, {
        method: 'PROPFIND',
        headers: {
          Authorization: this.authHeader,
          Depth: '0',
        },
      });

      console.log(`[WebDAV] HTTP 响应状态: ${baseResponse.status}`);

      // 读取响应内容
      const responseText = await baseResponse.text();
      console.log(`[WebDAV] 响应内容长度: ${responseText.length} 字节`);

      // 🔧 检查代理是否返回了错误（代理会把错误包装成 JSON）
      const proxyError = this.checkProxyError(responseText);
      if (proxyError) {
        console.log(`[WebDAV] 代理返回错误: ${proxyError}`);
        return false;
      }

      // 🔧 优先检查响应内容是否为有效的 WebDAV 成功响应（必须包含 multistatus）
      // 如果包含 multistatus，说明连接成功，即使响应中包含一些警告或错误信息也应该认为成功
      const isValidWebDAV = responseText.includes('multistatus');

      // 🔧 坚果云等服务器在根目录返回 OperationNotAllowed 是正常的
      // 这只是说明根目录不支持某些操作，但认证是成功的
      const isOperationNotAllowed = responseText.includes(
        'OperationNotAllowed'
      );

      if (isValidWebDAV) {
        console.log('[WebDAV] 服务器连接成功，响应为有效的 WebDAV 格式');
      } else if (isOperationNotAllowed) {
        // 坚果云根目录返回 OperationNotAllowed，但这不代表认证失败
        // HTTP 200 + OperationNotAllowed = 认证成功，但当前位置不允许操作
        console.log(
          '[WebDAV] 根目录返回 OperationNotAllowed，认证成功但需要使用子目录'
        );
      } else {
        // 只有在响应不是有效的 WebDAV 格式且不是 OperationNotAllowed 时，才检查错误
        // 🔧 检查是否为 WebDAV 错误响应（如坚果云的 ObjectNotFound）
        const webdavError = this.checkWebDAVError(responseText);
        if (webdavError) {
          console.log(`[WebDAV] WebDAV 错误: ${webdavError}`);
          return false;
        }

        // 检查是否有认证错误响应
        const hasAuthError =
          responseText.includes('401') ||
          responseText.includes('403') ||
          responseText.includes('Unauthorized') ||
          responseText.includes('Forbidden');

        if (hasAuthError) {
          console.log(`[WebDAV] 错误: 响应包含认证错误`);
          console.log(
            `[WebDAV] 响应内容片段: ${responseText.substring(0, 500)}`
          );
          return false;
        }

        console.log(`[WebDAV] 错误: 响应不是有效的 WebDAV 格式`);
        console.log(`[WebDAV] 响应内容片段: ${responseText.substring(0, 500)}`);
        return false;
      }

      // 然后检查并创建远程路径
      if (this.config.remotePath) {
        const remotePath = this.config.remotePath.endsWith('/')
          ? this.config.remotePath.slice(0, -1)
          : this.config.remotePath;

        console.log(`[WebDAV] 检查远程路径: ${remotePath}`);
        const dirCreated = await this.ensureDirectoryExists(remotePath);

        if (!dirCreated) {
          console.log(`[WebDAV] 错误: 远程路径检查/创建失败: ${remotePath}`);
          this.logSummary('test-connection', {
            url: baseUrl,
            remotePath: this.config.remotePath,
            ok: false,
            error: '无法访问或创建远程目录',
          });
          return false;
        }

        console.log(`[WebDAV] 远程路径已就绪: ${remotePath}`);
      }

      console.log('[WebDAV] 连接测试成功');
      this.logSummary('test-connection', {
        url: baseUrl,
        remotePath: this.config.remotePath,
        ok: true,
      });

      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log(`[WebDAV] 错误: 连接测试异常 - ${errorMsg}`);
      this.logSummary('test-connection', {
        ok: false,
        error: errorMsg,
      });
      return false;
    }
  }

  /**
   * 上传文件
   */
  async uploadFile(
    filename: string,
    content: string
  ): Promise<boolean | { success: false; error: string }> {
    try {
      // 🔧 修复：上传前先确保完整的目录路径存在
      // 需要确保 remotePath 存在
      if (this.config.remotePath) {
        const remotePath = this.config.remotePath.endsWith('/')
          ? this.config.remotePath.slice(0, -1)
          : this.config.remotePath;
        await this.ensureDirectoryExists(remotePath);
      }

      // 如果文件在子目录中，还需要创建子目录
      const pathParts = filename.split('/');
      if (pathParts.length > 1) {
        const dirPath = pathParts.slice(0, -1).join('/');
        const remotePath = this.config.remotePath
          .replace(/^\/+/, '')
          .replace(/\/+$/, '');
        const fullDirPath = remotePath ? `${remotePath}/${dirPath}` : dirPath;
        await this.ensureDirectoryExists(fullDirPath);
      }

      const url = this.buildUrl(filename);
      const proxiedUrl = this.getProxiedUrl(url);

      const response = await fetch(proxiedUrl, {
        method: 'PUT',
        headers: {
          Authorization: this.authHeader,
          'Content-Type': filename.endsWith('.json')
            ? 'application/json; charset=utf-8'
            : 'application/octet-stream',
        },
        body: content,
      });

      const success =
        response.ok || response.status === 201 || response.status === 204;

      this.logSummary('upload', {
        filename,
        status: response.status,
        ok: success,
      });

      if (!success) {
        // 尝试读取响应体获取更多错误信息
        let errorDetail = `HTTP ${response.status} ${response.statusText}`;
        try {
          const responseText = await response.text();
          if (responseText) {
            // 检查是否有代理错误
            const proxyError = this.checkProxyError(responseText);
            if (proxyError) {
              errorDetail = `代理错误: ${proxyError}`;
            } else {
              // 检查 WebDAV 错误
              const webdavError = this.checkWebDAVError(responseText);
              if (webdavError) {
                errorDetail = `WebDAV 错误: ${webdavError}`;
              } else if (responseText.length < 500) {
                errorDetail = `${errorDetail} - ${responseText}`;
              }
            }
          }
        } catch {
          // 忽略读取响应体的错误
        }
        console.error(`[WebDAV] 上传失败: ${errorDetail}`);
        return { success: false, error: errorDetail };
      }

      return success;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('上传文件失败:', error);
      this.logSummary('upload', {
        filename,
        ok: false,
        error: errorMsg,
      });
      return { success: false, error: `异常: ${errorMsg}` };
    }
  }

  /**
   * 下载文件
   */
  async downloadFile(filename: string): Promise<string | null> {
    try {
      const url = this.buildUrl(filename);
      const proxiedUrl = this.getProxiedUrl(url);

      const response = await fetch(proxiedUrl, {
        method: 'GET',
        headers: {
          Authorization: this.authHeader,
        },
      });

      this.logSummary('download', {
        filename,
        status: response.status,
        ok: response.ok,
      });

      if (response.ok) {
        return await response.text();
      }

      return null;
    } catch (error) {
      console.error('下载文件失败:', error);
      this.logSummary('download', {
        filename,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * 服务器端复制文件（不消耗客户端带宽）
   */
  async copyFile(source: string, destination: string): Promise<boolean> {
    try {
      // 🔧 复制前确保目标目录存在（如 backups/）
      const pathParts = destination.split('/');
      if (pathParts.length > 1) {
        const dirPath = pathParts.slice(0, -1).join('/');
        const remotePath = this.config.remotePath
          .replace(/^\/+/, '')
          .replace(/\/+$/, '');
        const fullDirPath = remotePath ? `${remotePath}/${dirPath}` : dirPath;
        await this.ensureDirectoryExists(fullDirPath);
      }

      const sourceUrl = this.buildUrl(source);
      const destUrl = this.buildUrl(destination);
      const proxiedUrl = this.getProxiedUrl(sourceUrl);

      const response = await fetch(proxiedUrl, {
        method: 'COPY',
        headers: {
          Authorization: this.authHeader,
          Destination: destUrl,
          Overwrite: 'T',
        },
      });

      const ok =
        response.ok || response.status === 201 || response.status === 204;
      this.logSummary('copy', {
        source,
        destination,
        status: response.status,
        ok,
      });
      return ok;
    } catch (error) {
      console.error('复制文件失败:', error);
      return false;
    }
  }

  /**
   * 列出文件
   */
  async listFiles(path: string = ''): Promise<WebDAVFile[]> {
    try {
      const url = this.buildUrl(path);
      const proxiedUrl = this.getProxiedUrl(url);

      const response = await fetch(proxiedUrl, {
        method: 'PROPFIND',
        headers: {
          Authorization: this.authHeader,
          Depth: '1',
          'Content-Type': 'application/xml; charset=utf-8',
        },
        body: `<?xml version="1.0" encoding="utf-8" ?>
<D:propfind xmlns:D="DAV:">
  <D:prop>
    <D:getlastmodified/>
    <D:getcontentlength/>
    <D:resourcetype/>
    <D:getetag/>
  </D:prop>
</D:propfind>`,
      });

      this.logSummary('list', {
        path,
        status: response.status,
        ok: response.ok || response.status === 207,
      });

      if (response.ok || response.status === 207) {
        const xmlText = await response.text();
        return this.parseListResponse(xmlText, path);
      }

      return [];
    } catch (error) {
      console.error('列出文件失败:', error);
      this.logSummary('list', {
        path,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * 列出目录文件（IStorageClient 接口实现）
   */
  async listFilesSimple(
    prefix: string
  ): Promise<{ key: string; lastModified?: Date }[]> {
    const files = await this.listFiles(prefix);
    return files.map(f => ({
      key: f.filename,
      lastModified: new Date(f.lastmod),
    }));
  }

  /**
   * 删除文件
   */
  async deleteFile(filename: string): Promise<boolean> {
    try {
      const url = this.buildUrl(filename);
      const proxiedUrl = this.getProxiedUrl(url);

      const response = await fetch(proxiedUrl, {
        method: 'DELETE',
        headers: {
          Authorization: this.authHeader,
        },
      });

      this.logSummary('delete', {
        filename,
        status: response.status,
        ok: response.ok || response.status === 204,
      });

      return response.ok || response.status === 204;
    } catch (error) {
      console.error('删除文件失败:', error);
      this.logSummary('delete', {
        filename,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * 检查文件是否存在
   * 使用 PROPFIND 方法代替 HEAD，因为 CORS 代理可能不支持 HEAD 请求
   */
  async fileExists(filename: string): Promise<boolean> {
    try {
      const url = this.buildUrl(filename);
      const proxiedUrl = this.getProxiedUrl(url);

      // 使用 PROPFIND 检查文件是否存在，Depth: 0 只获取目标资源本身
      const response = await fetch(proxiedUrl, {
        method: 'PROPFIND',
        headers: {
          Authorization: this.authHeader,
          Depth: '0',
          'Content-Type': 'application/xml; charset=utf-8',
        },
        body: `<?xml version="1.0" encoding="utf-8" ?>
<D:propfind xmlns:D="DAV:">
  <D:prop>
    <D:resourcetype/>
  </D:prop>
</D:propfind>`,
      });

      // WebDAV PROPFIND 成功返回 207 Multi-Status
      const exists = response.ok || response.status === 207;

      this.logSummary('fileExists', {
        filename,
        status: response.status,
        ok: exists,
        path: url,
      });

      return exists;
    } catch (error) {
      this.logSummary('fileExists', {
        filename,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * 创建目录（如果需要）
   */
  async createDirectory(path: string): Promise<boolean> {
    try {
      const url = this.buildUrl(path);
      const proxiedUrl = this.getProxiedUrl(url);

      const response = await fetch(proxiedUrl, {
        method: 'MKCOL',
        headers: {
          Authorization: this.authHeader,
        },
      });

      this.logSummary('mkcol', {
        path,
        status: response.status,
        ok: response.ok || response.status === 201 || response.status === 405, // 405 表示目录已存在
      });

      return response.ok || response.status === 201 || response.status === 405;
    } catch (error) {
      console.error('创建目录失败:', error);
      this.logSummary('mkcol', {
        path,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * 构建目录操作的 URL（不包含 remotePath，因为目录操作可能就是针对 remotePath 本身）
   */
  private buildDirectoryUrl(dirPath: string): string {
    // 移除 URL 末尾的斜杠
    const baseUrl = this.config.url.endsWith('/')
      ? this.config.url.slice(0, -1)
      : this.config.url;

    // 移除路径开头和末尾的斜杠
    const normalizedPath = dirPath.replace(/^\/+/, '').replace(/\/+$/, '');

    if (!normalizedPath) {
      return baseUrl;
    }

    return `${baseUrl}/${normalizedPath}`;
  }

  /**
   * 确保目录存在（递归创建）
   */
  private async ensureDirectoryExists(path: string): Promise<boolean> {
    if (!path || this.verifiedDirs.has(path)) return true;

    try {
      const url = this.buildDirectoryUrl(path);
      const proxiedUrl = this.getProxiedUrl(url);

      const checkResponse = await fetch(proxiedUrl, {
        method: 'PROPFIND',
        headers: {
          Authorization: this.authHeader,
          Depth: '0',
        },
      });

      const responseText = await checkResponse.text();

      const proxyError = this.checkProxyError(responseText);
      if (proxyError) return false;

      // 验证是否为有效的 WebDAV 成功响应（必须包含 multistatus）
      const isValidWebDAV = responseText.includes('multistatus');

      // 目录已存在（必须是有效的 WebDAV multistatus 响应）
      if (isValidWebDAV) {
        this.verifiedDirs.add(path);
        return true;
      }

      // 目录不存在
      const hasNotFoundError =
        responseText.includes('ObjectNotFound') ||
        responseText.includes('does not exist') ||
        checkResponse.status === 404;

      if (hasNotFoundError) {
        // 递归创建父目录
        const pathParts = path.split('/').filter(p => p);
        for (let i = 1; i <= pathParts.length; i++) {
          const currentPath = pathParts.slice(0, i).join('/');
          if (this.verifiedDirs.has(currentPath)) continue;

          const currentUrl = this.buildDirectoryUrl(currentPath);
          const currentProxiedUrl = this.getProxiedUrl(currentUrl);

          const mkcolResponse = await fetch(currentProxiedUrl, {
            method: 'MKCOL',
            headers: { Authorization: this.authHeader },
          });

          const mkcolText = await mkcolResponse.text();

          if (this.checkProxyError(mkcolText)) return false;

          const hasAuthError =
            mkcolText.includes('401') ||
            mkcolText.includes('403') ||
            mkcolText.includes('Unauthorized') ||
            mkcolText.includes('Forbidden');
          if (hasAuthError) return false;

          const mkcolSuccess =
            mkcolResponse.status === 201 ||
            mkcolResponse.status === 405 ||
            mkcolText === '' ||
            mkcolText.includes('Created');

          if (!mkcolSuccess) {
            console.error(`[WebDAV] 创建目录失败: ${currentPath}`);
            return false;
          }
          this.verifiedDirs.add(currentPath);
        }

        this.verifiedDirs.add(path);
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * 获取代理后的 URL
   */
  private getProxiedUrl(originalUrl: string): string {
    // 如果用户明确设置不使用代理，直接返回原始 URL
    if (this.config.useProxy === false) {
      return originalUrl;
    }

    // 在浏览器环境下使用 CORS 代理
    if (typeof window !== 'undefined') {
      return `${this.corsProxy}${encodeURIComponent(originalUrl)}`;
    }

    // 在 Node.js 或 Capacitor 原生环境下直接使用原始 URL
    return originalUrl;
  }

  /**
   * 构建完整的 URL
   */
  private buildUrl(filename: string): string {
    // 移除 URL 末尾的斜杠
    const baseUrl = this.config.url.endsWith('/')
      ? this.config.url.slice(0, -1)
      : this.config.url;

    // 移除路径开头和末尾的斜杠
    let remotePath = this.config.remotePath.startsWith('/')
      ? this.config.remotePath.slice(1)
      : this.config.remotePath;

    remotePath = remotePath.endsWith('/')
      ? remotePath.slice(0, -1)
      : remotePath;

    // 移除文件名开头的斜杠
    const normalizedFilename = filename.startsWith('/')
      ? filename.slice(1)
      : filename;

    // 组合完整路径 - 过滤掉空字符串
    const parts = [baseUrl, remotePath, normalizedFilename].filter(
      part => part && part.length > 0
    );
    return parts.join('/');
  }

  /**
   * 解析 PROPFIND 响应
   */
  private parseListResponse(xmlText: string, basePath: string): WebDAVFile[] {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlText, 'text/xml');
      const responses = doc.querySelectorAll('response');
      const files: WebDAVFile[] = [];

      // 构建基础路径用于过滤
      const normalizedBasePath = basePath.endsWith('/')
        ? basePath
        : `${basePath}/`;

      responses.forEach(response => {
        const hrefElement = response.querySelector('href');
        if (!hrefElement) return;

        const href = hrefElement.textContent || '';

        // 跳过当前目录本身
        if (href.endsWith(normalizedBasePath) || href === basePath) {
          return;
        }

        // 获取文件信息
        const resourceType = response.querySelector('resourcetype collection');
        const lastModified = response.querySelector('getlastmodified');
        const contentLength = response.querySelector('getcontentlength');
        const etag = response.querySelector('getetag');

        // 提取文件名（去除基础路径和 URL 编码）
        let filename = href;
        try {
          filename = decodeURIComponent(href);
        } catch {
          // 如果解码失败，使用原始 href
        }

        // 移除基础路径
        const remotePath = this.config.remotePath.endsWith('/')
          ? this.config.remotePath
          : `${this.config.remotePath}/`;

        if (filename.includes(remotePath)) {
          filename = filename.split(remotePath).pop() || '';
        }

        // 移除路径前缀和末尾斜杠
        filename = filename.replace(/^\/+/, '').replace(/\/+$/, '');

        if (filename) {
          files.push({
            filename,
            basename: filename.split('/').pop() || filename,
            lastmod: lastModified?.textContent || new Date().toISOString(),
            size: parseInt(contentLength?.textContent || '0', 10),
            type: resourceType ? 'directory' : 'file',
            etag: etag?.textContent?.replace(/"/g, ''),
          });
        }
      });

      // 只返回文件，不返回目录
      return files.filter(f => f.type === 'file');
    } catch (error) {
      console.error('解析 WebDAV 响应失败:', error);
      return [];
    }
  }

  /**
   * 记录日志摘要
   */
  private logSummary(event: string, detail: Record<string, unknown>): void {
    if (typeof console !== 'undefined' && typeof console.log === 'function') {
      // eslint-disable-next-line no-console
      console.log(`[WebDAV:${event}]`, {
        ...detail,
        // 只保留关键信息
        filename: detail.filename,
        path: detail.path,
        status: detail.status,
        ok: detail.ok,
      });
    }
  }
}
