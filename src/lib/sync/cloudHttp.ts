import { CapacitorHttp, registerPlugin } from '@capacitor/core';
import { detectAppRuntime } from '@/lib/app/runtime';
import { DEFAULT_CLOUD_PROXY_URL } from './settings';

interface NativeHttpResponse {
  status: number;
  headers: Record<string, string>;
  data: string;
}

const AndroidSyncHttp = registerPlugin<{
  request(options: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: string;
  }): Promise<NativeHttpResponse>;
}>('BrewGuideSyncHttp');

function requireSecureUrl(value: string): void {
  const parsed = new URL(value);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && local)) {
    throw new Error('云存储和代理地址必须使用 HTTPS，本机调试除外');
  }
  if (parsed.username || parsed.password) {
    throw new Error('请勿在地址中包含账号密码');
  }
}

/** Native shells always connect directly; only browsers use a user-supplied proxy. */
export async function cloudFetch(
  url: string,
  init: RequestInit = {},
  proxyUrl?: string
): Promise<Response> {
  requireSecureUrl(url);
  const { runtime, capacitorPlatform } = detectAppRuntime();
  if (runtime === 'tauri') {
    const { fetch } = await import('@tauri-apps/plugin-http');
    return fetch(url, { ...init, maxRedirections: 0, connectTimeout: 15000 });
  }

  if (runtime === 'capacitor') {
    const headers = Object.fromEntries(new Headers(init.headers).entries());
    const method = (init.method || 'GET').toUpperCase();
    // Keep the exact payload bytes: S3 signs the body before sending it.
    const bytes =
      init.body == null
        ? undefined
        : new Uint8Array(await new Response(init.body).arrayBuffer());
    let body: string | undefined;
    if (bytes) {
      const chunks: string[] = [];
      for (let offset = 0; offset < bytes.length; offset += 8192) {
        chunks.push(
          String.fromCharCode(...bytes.subarray(offset, offset + 8192))
        );
      }
      body = btoa(chunks.join(''));
    }

    if (capacitorPlatform === 'android') {
      const result = await AndroidSyncHttp.request({
        url,
        method,
        headers,
        body,
      });
      const data = Uint8Array.from(atob(result.data), char =>
        char.charCodeAt(0)
      );
      return new Response(
        method === 'HEAD' || [204, 205, 304].includes(result.status)
          ? null
          : data,
        { status: result.status, headers: result.headers }
      );
    }

    const result = await CapacitorHttp.request({
      url,
      method,
      headers,
      data: body,
      dataType: 'file',
      responseType: 'text',
      shouldEncodeUrlParams: false,
      disableRedirects: true,
      connectTimeout: 15000,
      readTimeout: 60000,
    });
    // Capacitor parses application/json responses even when text is requested.
    const data =
      typeof result.data === 'string'
        ? result.data
        : JSON.stringify(result.data);
    return new Response(
      method === 'HEAD' || [204, 205, 304].includes(result.status)
        ? null
        : data,
      { status: result.status, headers: result.headers }
    );
  }

  const proxy = (proxyUrl ?? DEFAULT_CLOUD_PROXY_URL).trim();
  if (!proxy) throw new Error('请填写自定义代理');
  requireSecureUrl(proxy);
  const requestUrl = proxy.includes('{url}')
    ? proxy.replace('{url}', encodeURIComponent(url))
    : `${proxy}${encodeURIComponent(url)}`;
  try {
    return await fetch(requestUrl, init);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        `代理请求失败（${init.method || 'GET'}），请检查代理是否允许该方法及认证头，或更换代理`
      );
    }
    throw error;
  }
}
