/**
 * WebDAV 客户端 - 浏览器环境实现
 * 支持标准 WebDAV 协议的文件服务器（Nextcloud、ownCloud、坚果云等）
 */

import { redactSyncDiagnosticUrl, type SyncDiagnostic } from '@/lib/sync/types';
import type { WebDAVConfig, WebDAVFile } from './types';
import { cloudFetch } from '@/lib/sync/cloudHttp';
import { detectAppRuntime } from '@/lib/app/runtime';

export class WebDAVClient {
  private config: WebDAVConfig;
  private authHeader: string;
  private verifiedDirs = new Set<string>();
  private lastError: string | null = null;
  private lastDiagnostic: SyncDiagnostic | null = null;

  constructor(config: WebDAVConfig) {
    this.config = config;
    // 创建基础认证头
    this.authHeader = `Basic ${btoa(`${config.username}:${config.password}`)}`;
  }

  getLastError(): string | null {
    return this.lastError;
  }

  getLastDiagnostic(): SyncDiagnostic | null {
    return this.lastDiagnostic;
  }

  clearDiagnostic(): void {
    this.lastDiagnostic = null;
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
    // JSON 中的笔记内容可能包含 XML 标签或错误名称，不能当作服务端错误。
    if (!responseText.trimStart().startsWith('<')) return null;
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

  private getResponseErrorDetail(
    response: Pick<Response, 'status' | 'statusText'>,
    responseText: string
  ): string {
    const proxyError = this.checkProxyError(responseText);
    if (proxyError) return `代理错误: ${proxyError}`;

    const webdavError = this.checkWebDAVError(responseText);
    if (webdavError) return `WebDAV 错误: ${webdavError}`;

    const statusText = response.statusText ? ` ${response.statusText}` : '';
    const snippet = responseText.trim().replace(/\s+/g, ' ').slice(0, 300);
    return snippet
      ? `HTTP ${response.status}${statusText} - ${snippet}`
      : `HTTP ${response.status}${statusText}`;
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    const key = `.brew-guide-connection-test-${crypto.randomUUID()}.json`;
    const content = JSON.stringify({ test: key });
    let uploaded = false;
    try {
      this.lastError = null;

      const result = await this.uploadFile(key, content);
      if (result !== true) {
        throw new Error(
          typeof result === 'object' ? result.error : '连接测试写入失败'
        );
      }
      uploaded = true;
      const downloaded = await this.downloadFile(key);
      if (downloaded === null) {
        throw new Error(this.lastDiagnostic?.error || '连接测试读取失败');
      }
      if (downloaded !== content) {
        throw new Error('连接测试读取失败，请检查代理是否原样转发数据');
      }
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.lastError = errorMsg;
      this.logSummary('test-connection', {
        ok: false,
        error: errorMsg,
      });
      return false;
    } finally {
      if (uploaded && !(await this.deleteFile(key))) {
        console.warn('[WebDAV] 连接测试文件清理失败');
      }
    }
  }

  /**
   * 上传文件
   */
  async uploadFile(
    filename: string,
    content: string,
    expectedEtag?: string | null
  ): Promise<boolean | { success: false; error: string }> {
    try {
      const url = this.buildUrl(filename);
      const request: RequestInit = {
        method: 'PUT',
        headers: {
          ...(expectedEtag === null
            ? { 'If-None-Match': '*' }
            : expectedEtag
              ? { 'If-Match': expectedEtag }
              : {}),
          Authorization: this.authHeader,
          'Content-Type': filename.endsWith('.json')
            ? 'application/json; charset=utf-8'
            : 'application/octet-stream',
        },
        body: content,
      };
      let response = await this.request(url, request);
      // 已有目录无需探测；仅在服务器报告路径缺失时尝试建目录。
      if (response.status === 404 || response.status === 409) {
        const directory = [
          this.config.remotePath,
          ...filename.split('/').slice(0, -1),
        ]
          .filter(Boolean)
          .join('/')
          .replace(/^\/+|\/+$/g, '');
        if (directory) {
          if (!(await this.ensureDirectoryExists(directory))) {
            throw new Error(
              `无法自动创建目录，请先在云盘创建 ${directory} 后重试`
            );
          }
          response = await this.request(url, request);
        }
      }

      const success =
        response.ok || response.status === 201 || response.status === 204;

      let errorDetail: string | undefined;
      if (!success) {
        // 尝试读取响应体获取更多错误信息
        errorDetail = `HTTP ${response.status} ${response.statusText}`;
        try {
          const responseText = await response.text();
          if (responseText) {
            errorDetail = this.getResponseErrorDetail(response, responseText);
          }
        } catch {
          // 忽略读取响应体的错误
        }
      }

      this.logSummary('upload', {
        filename,
        url,
        status: response.status,
        statusText: response.statusText,
        ok: success,
        error: errorDetail,
      });

      if (!success) {
        // 412 是条件写入的正常拒绝，由同步层区分安全探测和真实冲突。
        if (response.status !== 412)
          console.error(`[WebDAV] 上传失败: ${errorDetail}`);
        return { success: false, error: errorDetail || '上传失败' };
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

      const response = await this.request(url, {
        method: 'GET',
        headers: {
          Authorization: this.authHeader,
        },
      });

      let responseSnippet: string | undefined;
      let errorDetail: string | undefined;
      if (!response.ok) {
        try {
          responseSnippet = (await response.clone().text()).slice(0, 300);
          errorDetail = this.getResponseErrorDetail(response, responseSnippet);
        } catch {
          errorDetail = `HTTP ${response.status} ${response.statusText}`;
        }
      }

      this.logSummary('download', {
        filename,
        url,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        error: errorDetail,
        errorSnippet: responseSnippet,
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

  async readSyncFile(
    filename: string
  ): Promise<{ content: string; etag: string } | null> {
    const response = await this.request(this.buildUrl(filename), {
      headers: { Authorization: this.authHeader },
    });
    if (response.status === 404) return null;
    const content = await response.text();
    const error =
      this.checkProxyError(content) || this.checkWebDAVError(content);
    if (!response.ok || error)
      throw new Error(error || `读取云端数据失败：HTTP ${response.status}`);
    const etag = response.headers.get('etag');
    if (!etag || etag.startsWith('W/')) {
      throw new Error(
        'WebDAV 服务或代理未提供可用于安全同步的 ETag，已停止同步'
      );
    }
    return { content, etag };
  }

  /** 条件头不可用时，先验证完整代理链路的锁语义，再在锁内重新校验版本。 */
  async uploadFileWithLock(
    filename: string,
    content: string,
    expectedEtag: string | null,
    probeKey: string
  ): Promise<boolean | { success: false; error: string }> {
    const put = (key: string, body: string, token?: string) =>
      this.request(this.buildUrl(key), {
        method: 'PUT',
        headers: {
          Authorization: this.authHeader,
          'Content-Type': 'application/json; charset=utf-8',
          ...(token ? { If: `(${token})` } : {}),
        },
        body,
      });
    try {
      let expiredToken = '';
      await this.withWriteLock(probeKey, async token => {
        expiredToken = token;
        const unlocked = await put(probeKey, '{}');
        const invalid = await put(
          probeKey,
          '{}',
          `<urn:uuid:${crypto.randomUUID()}>`
        );
        if (unlocked.status !== 423 || invalid.status !== 412) {
          throw new Error('WebDAV 服务或代理未执行独占锁校验，已停止同步');
        }
        const valid = await put(probeKey, '{}', token);
        if (!valid.ok) {
          throw new Error(`WebDAV 锁令牌写入失败：HTTP ${valid.status}`);
        }
      });
      // 必须拒绝已释放的令牌，防止锁过期或服务器重启后继续覆盖。
      if ((await put(probeKey, '{}', expiredToken)).status !== 412) {
        throw new Error('WebDAV 服务或代理未拒绝失效锁令牌，已停止同步');
      }
      this.clearDiagnostic();
      await this.withWriteLock(filename, async (token, created) => {
        if (created !== (expectedEtag === null)) {
          throw new Error('云端文件已被创建或删除，请重试');
        }
        const current = await this.readSyncFile(filename);
        if (
          !current ||
          (created ? current.content !== '' : current.etag !== expectedEtag)
        ) {
          throw new Error('云端已被其他设备更新，请重试');
        }
        // 读取可能耗时；只刷新仍有效的锁，绝不重新获取锁后继续旧操作。
        const refreshed = await this.request(this.buildUrl(filename), {
          method: 'LOCK',
          headers: {
            Authorization: this.authHeader,
            If: `(${token})`,
            Timeout: 'Second-60',
          },
        });
        if (refreshed.status !== 200) {
          throw new Error(
            `WebDAV 锁已失效或无法续期：HTTP ${refreshed.status}，请重试`
          );
        }
        const response = await put(filename, content, token);
        this.logSummary('upload', {
          filename,
          status: response.status,
          ok: response.ok,
        });
        if (!response.ok) {
          throw new Error(`WebDAV 锁内写入失败：HTTP ${response.status}`);
        }
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logSummary('locked-upload', { filename, ok: false, error: message });
      return { success: false, error: message };
    }
  }

  private async withWriteLock(
    filename: string,
    write: (token: string, created: boolean) => Promise<void>
  ): Promise<void> {
    const url = this.buildUrl(filename);
    const response = await this.request(url, {
      method: 'LOCK',
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/xml; charset=utf-8',
        Depth: '0',
        Timeout: 'Second-60',
      },
      body: '<D:lockinfo xmlns:D="DAV:"><D:lockscope><D:exclusive/></D:lockscope><D:locktype><D:write/></D:locktype></D:lockinfo>',
    });
    const token = response.headers.get('Lock-Token');
    if (
      ![200, 201].includes(response.status) ||
      !token ||
      !/^<[^<>\s]+>$/.test(token)
    ) {
      throw new Error(
        `无法获取 WebDAV 独占锁（HTTP ${response.status}），请检查服务和代理的 LOCK、UNLOCK、If 及 Lock-Token 支持`
      );
    }
    let removed = false;
    try {
      await write(token, response.status === 201);
    } catch (error) {
      // 只删除本次 LOCK 创建且仍为空的占位文件，保留可能已成功写入的数据。
      if (response.status === 201) {
        try {
          const current = await this.readSyncFile(filename);
          if (current?.content === '') {
            const deleted = await this.request(url, {
              method: 'DELETE',
              headers: { Authorization: this.authHeader, If: `(${token})` },
            });
            removed = deleted.ok;
          }
        } catch {
          console.warn('[WebDAV] 空占位文件清理失败，请检查云端数据');
        }
      }
      throw error;
    } finally {
      // 删除锁根已释放锁；解锁异常不能覆盖写入结果或原始错误。
      if (!removed) {
        try {
          const unlocked = await this.request(url, {
            method: 'UNLOCK',
            headers: { Authorization: this.authHeader, 'Lock-Token': token },
          });
          if (!unlocked.ok) throw new Error(`HTTP ${unlocked.status}`);
        } catch (error) {
          this.logSummary('unlock', {
            filename,
            ok: false,
            error: `WebDAV 解锁未确认，请等待锁过期后重试：${String(error)}`,
          });
        }
      }
    }
  }

  /**
   * 使用普通读写复制，避免要求代理支持 COPY。
   */
  async copyFile(source: string, destination: string): Promise<boolean> {
    try {
      const content = await this.downloadFile(source);
      if (content === null) return false;
      return (await this.uploadFile(destination, content)) === true;
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

      const response = await this.request(url, {
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

      const ok = response.ok || response.status === 207;
      let responseSnippet: string | undefined;
      let errorDetail: string | undefined;
      if (!ok) {
        try {
          responseSnippet = (await response.clone().text()).slice(0, 300);
          errorDetail = this.getResponseErrorDetail(response, responseSnippet);
        } catch {
          errorDetail = `HTTP ${response.status} ${response.statusText}`;
        }
      }

      this.logSummary('list', {
        path,
        url,
        status: response.status,
        statusText: response.statusText,
        ok,
        error: errorDetail,
        errorSnippet: responseSnippet,
      });

      if (ok) {
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

      const response = await this.request(url, {
        method: 'DELETE',
        headers: {
          Authorization: this.authHeader,
        },
      });

      this.logSummary('delete', {
        filename,
        url,
        status: response.status,
        statusText: response.statusText,
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

      const checkResponse = await this.request(url, {
        method: 'PROPFIND',
        headers: {
          Authorization: this.authHeader,
          Depth: '0',
        },
      });

      const responseText = await checkResponse.text();

      const proxyError = this.checkProxyError(responseText);
      if (proxyError) {
        this.lastError = `代理错误: ${proxyError}`;
        this.logSummary('mkdir-check', {
          path,
          url,
          status: checkResponse.status,
          statusText: checkResponse.statusText,
          ok: false,
          error: this.lastError,
          errorSnippet: responseText.slice(0, 300),
        });
        return false;
      }

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

          const mkcolResponse = await this.request(currentUrl, {
            method: 'MKCOL',
            headers: { Authorization: this.authHeader },
          });

          const mkcolText = await mkcolResponse.text();

          const mkcolProxyError = this.checkProxyError(mkcolText);
          if (mkcolProxyError) {
            this.lastError = `代理错误: ${mkcolProxyError}`;
            this.logSummary('mkdir', {
              path: currentPath,
              url: currentUrl,
              status: mkcolResponse.status,
              statusText: mkcolResponse.statusText,
              ok: false,
              error: this.lastError,
              errorSnippet: mkcolText.slice(0, 300),
            });
            return false;
          }

          const hasAuthError =
            mkcolText.includes('401') ||
            mkcolText.includes('403') ||
            mkcolText.includes('Unauthorized') ||
            mkcolText.includes('Forbidden');
          if (hasAuthError) {
            this.lastError = '创建目录失败：认证或权限不足';
            this.logSummary('mkdir', {
              path: currentPath,
              url: currentUrl,
              status: mkcolResponse.status,
              statusText: mkcolResponse.statusText,
              ok: false,
              error: this.lastError,
              errorSnippet: mkcolText.slice(0, 300),
            });
            return false;
          }

          const mkcolSuccess =
            mkcolResponse.status === 201 ||
            mkcolResponse.status === 405 ||
            mkcolText === '' ||
            mkcolText.includes('Created');

          if (!mkcolSuccess) {
            console.error(`[WebDAV] 创建目录失败: ${currentPath}`);
            this.lastError = `创建目录失败: ${currentPath}`;
            this.logSummary('mkdir', {
              path: currentPath,
              url: currentUrl,
              status: mkcolResponse.status,
              statusText: mkcolResponse.statusText,
              ok: false,
              error: this.getResponseErrorDetail(mkcolResponse, mkcolText),
              errorSnippet: mkcolText.slice(0, 300),
            });
            return false;
          }
          this.verifiedDirs.add(currentPath);
        }

        this.verifiedDirs.add(path);
        return true;
      }

      this.lastError = this.getResponseErrorDetail(checkResponse, responseText);
      this.logSummary('mkdir-check', {
        path,
        url,
        status: checkResponse.status,
        statusText: checkResponse.statusText,
        ok: false,
        error: this.lastError,
        errorSnippet: responseText.slice(0, 300),
      });
      return false;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.lastError = errorMsg;
      this.logSummary('mkdir-check', {
        path,
        ok: false,
        error: errorMsg,
      });
      return false;
    }
  }

  private request(url: string, init: RequestInit): Promise<Response> {
    // 浏览器由 cache 模式添加防缓存头，显式添加会要求代理额外放行 CORS。
    const headers = new Headers(init.headers);
    if (detectAppRuntime().runtime !== 'web') {
      headers.set('Cache-Control', 'no-cache');
    }
    return cloudFetch(
      url,
      { ...init, headers, cache: 'no-store' },
      this.config.proxyUrl
    );
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
    const diagnostic = this.buildDiagnostic(event, detail);
    if (this.shouldKeepDiagnostic(diagnostic)) {
      this.lastDiagnostic = diagnostic;
    }

    // eslint-disable-next-line no-console
    console.log(`[WebDAV:${event}]`, {
      ...detail,
      url: redactSyncDiagnosticUrl(this.asString(detail.url)),
    });
  }

  private buildDiagnostic(
    event: string,
    detail: Record<string, unknown>
  ): SyncDiagnostic {
    return {
      provider: 'WebDAV',
      operation: event,
      target:
        this.asString(detail.filename) ||
        this.asString(detail.path) ||
        this.asString(detail.destination) ||
        this.asString(detail.source),
      method: this.getMethodForEvent(event),
      url: this.asString(detail.url) || this.asString(detail.path),
      status: this.asNumber(detail.status),
      statusText: this.asString(detail.statusText),
      ok: this.asBoolean(detail.ok),
      error: this.asString(detail.error),
      responseSnippet: this.asString(detail.errorSnippet),
      details: {
        source: this.asString(detail.source),
        destination: this.asString(detail.destination),
        remotePath: this.asString(detail.remotePath),
      },
    };
  }

  private shouldKeepDiagnostic(diagnostic: SyncDiagnostic): boolean {
    return (
      diagnostic.ok === false ||
      diagnostic.error !== undefined ||
      (typeof diagnostic.status === 'number' && diagnostic.status >= 400)
    );
  }

  private getMethodForEvent(event: string): string | undefined {
    switch (event) {
      case 'upload':
        return 'PUT';
      case 'download':
        return 'GET';
      case 'delete':
        return 'DELETE';
      case 'list':
      case 'mkdir-check':
        return 'PROPFIND';
      case 'mkdir':
        return 'MKCOL';
      default:
        return undefined;
    }
  }

  private asString(value: unknown): string | undefined {
    return typeof value === 'string' && value ? value : undefined;
  }

  private asNumber(value: unknown): number | undefined {
    return typeof value === 'number' ? value : undefined;
  }

  private asBoolean(value: unknown): boolean | undefined {
    return typeof value === 'boolean' ? value : undefined;
  }
}
