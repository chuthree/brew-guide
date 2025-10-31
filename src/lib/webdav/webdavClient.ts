/**
 * WebDAV 客户端 - 浏览器环境实现
 * 支持标准 WebDAV 协议的文件服务器（Nextcloud、ownCloud、坚果云等）
 */

import type { WebDAVConfig, WebDAVFile } from './types';

export class WebDAVClient {
  private config: WebDAVConfig;
  private authHeader: string;
  private corsProxy: string;

  constructor(config: WebDAVConfig) {
    this.config = config;
    // 创建基础认证头
    this.authHeader = `Basic ${btoa(`${config.username}:${config.password}`)}`;
    // 使用 CORS 代理（仅在浏览器环境下需要）
    this.corsProxy = 'https://cors.chu3.top/raw?url=';
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
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

      if (!baseResponse.ok && baseResponse.status !== 207) {
        console.error(
          `[WebDAV] 无法连接到服务器: ${baseResponse.status} ${baseResponse.statusText}`
        );
        return false;
      }

      console.log('[WebDAV] 服务器连接成功');

      // 然后检查并创建远程路径
      if (this.config.remotePath) {
        const remotePath = this.config.remotePath.endsWith('/')
          ? this.config.remotePath.slice(0, -1)
          : this.config.remotePath;

        console.log(`[WebDAV] 确保远程路径存在: ${remotePath}`);
        const dirCreated = await this.ensureDirectoryExists(remotePath);

        if (!dirCreated) {
          console.warn(
            `[WebDAV] 创建远程路径失败，但将继续尝试: ${remotePath}`
          );
        }
      }

      this.logSummary('test-connection', {
        url: baseUrl,
        remotePath: this.config.remotePath,
        ok: true,
      });

      return true;
    } catch (error) {
      console.error('WebDAV 连接测试失败:', error);
      this.logSummary('test-connection', {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * 上传文件
   */
  async uploadFile(filename: string, content: string): Promise<boolean> {
    try {
      // 🔧 关键修复：上传前先确保目录存在
      const pathParts = filename.split('/');
      if (pathParts.length > 1) {
        // 如果文件在子目录中，先创建目录结构
        const dirPath = pathParts.slice(0, -1).join('/');
        console.log(`[WebDAV] 确保目录存在: ${dirPath}`);
        await this.ensureDirectoryExists(dirPath);
      }

      const url = this.buildUrl(filename);
      const proxiedUrl = this.getProxiedUrl(url);

      console.log(`[WebDAV] 上传文件: ${filename} 到 ${url}`);

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
        console.error(
          `[WebDAV] 上传失败: ${response.status} ${response.statusText}`
        );
      }

      return success;
    } catch (error) {
      console.error('上传文件失败:', error);
      this.logSummary('upload', {
        filename,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
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
   */
  async fileExists(filename: string): Promise<boolean> {
    try {
      const url = this.buildUrl(filename);
      const proxiedUrl = this.getProxiedUrl(url);

      const response = await fetch(proxiedUrl, {
        method: 'HEAD',
        headers: {
          Authorization: this.authHeader,
        },
      });

      this.logSummary('head', {
        filename,
        status: response.status,
        ok: response.ok,
      });

      return response.ok;
    } catch (error) {
      this.logSummary('head', {
        filename,
        ok: false,
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
   * 确保目录存在（递归创建）
   */
  private async ensureDirectoryExists(path: string): Promise<boolean> {
    if (!path) return true;

    try {
      // 检查目录是否已存在
      const url = this.buildUrl(path);
      const proxiedUrl = this.getProxiedUrl(url);

      const checkResponse = await fetch(proxiedUrl, {
        method: 'PROPFIND',
        headers: {
          Authorization: this.authHeader,
          Depth: '0',
        },
      });

      // 目录已存在
      if (checkResponse.ok || checkResponse.status === 207) {
        return true;
      }

      // 目录不存在，需要创建
      if (checkResponse.status === 404) {
        console.log(`[WebDAV] 创建目录: ${path}`);

        // 递归创建父目录
        const pathParts = path.split('/').filter(p => p);
        for (let i = 1; i <= pathParts.length; i++) {
          const currentPath = pathParts.slice(0, i).join('/');
          const currentUrl = this.buildUrl(currentPath);
          const currentProxiedUrl = this.getProxiedUrl(currentUrl);

          const mkcolResponse = await fetch(currentProxiedUrl, {
            method: 'MKCOL',
            headers: {
              Authorization: this.authHeader,
            },
          });

          // 405 表示目录已存在，这是正常的
          if (
            !mkcolResponse.ok &&
            mkcolResponse.status !== 201 &&
            mkcolResponse.status !== 405
          ) {
            console.error(
              `[WebDAV] 创建目录失败: ${currentPath} (${mkcolResponse.status})`
            );
            return false;
          }
        }

        return true;
      }

      return false;
    } catch (error) {
      console.error(`[WebDAV] 确保目录存在失败: ${path}`, error);
      return false;
    }
  }

  /**
   * 获取代理后的 URL
   */
  private getProxiedUrl(originalUrl: string): string {
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

export default WebDAVClient;
