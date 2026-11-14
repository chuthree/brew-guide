package com.brewguide.app;

import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.util.Iterator;
import java.util.concurrent.TimeUnit;
import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.ResponseBody;

/** HttpURLConnection does not support WebDAV verbs; OkHttp preserves them. */
@CapacitorPlugin(name = "BrewGuideSyncHttp")
public class BrewGuideSyncHttpPlugin extends Plugin {
  private OkHttpClient client;

  private synchronized OkHttpClient getClient() throws IOException {
    // Capacitor discards constructor failures and reports the entire plugin as unimplemented.
    if (client == null) {
      try {
        client = new OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .callTimeout(90, TimeUnit.SECONDS)
            .followRedirects(false)
            .followSslRedirects(false)
            .retryOnConnectionFailure(false)
            .build();
      } catch (RuntimeException | LinkageError | AssertionError error) {
        throw new IOException(
            "同步网络组件初始化失败（Android " + android.os.Build.VERSION.RELEASE
                + " / API " + android.os.Build.VERSION.SDK_INT
                + " / " + android.os.Build.MANUFACTURER + " " + android.os.Build.MODEL
                + "）", error);
      }
    }
    return client;
  }

  @PluginMethod
  public void request(PluginCall call) {
    request(call, false);
  }

  @PluginMethod
  public void requestFile(PluginCall call) {
    request(call, true);
  }

  static File syncCacheFile(File directory, String name) throws IOException {
    if (name == null || !name.matches("brew-guide-sync-[a-f0-9-]{36}-(request|response)")) {
      throw new IOException("Invalid sync cache filename");
    }
    File file = new File(directory, name).getCanonicalFile();
    if (!directory.getCanonicalFile().equals(file.getParentFile())) {
      throw new IOException("Sync file must remain in the app cache");
    }
    return file;
  }

  private static String sanitizeErrorMessage(String message, PluginCall call) {
    String url = call.getString("url", "");
    if (!url.isEmpty()) message = message.replace(url, "[已隐藏 URL]");
    message = message.replaceAll("(?i)(?:https?|file|content)://[^\\s<>\"']+", "[已隐藏 URL]");
    if (!url.isEmpty()) {
      try {
        String host = URI.create(url).getHost();
        if (host != null && !host.isEmpty()) message = message.replace(host, "[已隐藏主机]");
      } catch (IllegalArgumentException ignored) {
        // Invalid URLs still need to produce a diagnostic.
      }
    }
    JSObject headers = call.getObject("headers", new JSObject());
    Iterator<String> keys = headers.keys();
    while (keys.hasNext()) {
      String value = headers.getString(keys.next());
      if (value != null && !value.isEmpty()) message = message.replace(value, "[已隐藏请求头值]");
    }
    return message
        .replaceAll("(?i)(?:Bearer|Basic)\\s+[^\\s,;]+", "[已隐藏认证信息]")
        .replaceAll("eyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+", "[已隐藏 JWT]")
        .replaceAll("(?i)((?:username|password|passwd|secret(?:AccessKey)?|accessKeyId|api[-_]?key|token|signature|credential|authorization|cookie)\\s*[\"']?\\s*[:=]\\s*)[^\\r\\n]+", "$1[已隐藏]")
        .replaceAll("(?i)data:[^\\s;,]+;base64,[a-z0-9+/=]+", "[已隐藏文件内容]")
        .replaceAll("(?<![A-Za-z0-9])/(?:[^\\s<>\"']+)", "[已隐藏路径或地址]")
        .replaceAll("\\b(?:\\d{1,3}\\.){3}\\d{1,3}(?::\\d+)?\\b", "[已隐藏 IP]")
        .replaceAll("\\[[0-9a-fA-F:%.]+\\](?::\\d+)?", "[已隐藏 IP]");
  }

  private static void rejectRequest(PluginCall call, String summary, String code, Exception error) {
    StringBuilder detail = new StringBuilder(summary);
    Throwable cause = error;
    for (int depth = 0; cause != null && depth < 4; depth++, cause = cause.getCause()) {
      detail.append(depth == 0 ? "\n" : "\n原因: ").append(cause.getClass().getSimpleName());
      String message = cause.getMessage();
      if (message != null && !message.isEmpty()) {
        message = sanitizeErrorMessage(message, call);
        detail.append(": ").append(message.length() > 1000
            ? message.substring(0, 1000) + "[内容已截断]" : message);
      }
    }
    if (cause != null) detail.append("\n[原因链已截断]");
    // Passing the exception to Capacitor would also log its unredacted message and stack.
    call.reject(detail.toString(), code);
  }

  private void request(PluginCall call, boolean fileTransfer) {
    final OkHttpClient httpClient;
    try {
      httpClient = getClient();
    } catch (IOException error) {
      rejectRequest(call, "同步网络组件初始化失败", "SYNC_HTTP_INIT_FAILED", error);
      return;
    }
    try {
      File responseFile = fileTransfer
          ? syncCacheFile(getContext().getCacheDir(), call.getString("responseFile")) : null;
      String url = call.getString("url");
      String method = call.getString("method", "GET");
      Request.Builder builder = new Request.Builder().url(url);
      JSObject headers = call.getObject("headers", new JSObject());
      Iterator<String> keys = headers.keys();
      while (keys.hasNext()) {
        String key = keys.next();
        builder.header(key, headers.getString(key));
      }
      RequestBody body = null;
      if (fileTransfer) {
        String bodyFile = call.getString("bodyFile");
        if (bodyFile != null) {
          File file = syncCacheFile(getContext().getCacheDir(), bodyFile);
          if (!file.isFile()) throw new IOException("Sync request file is missing");
          body = RequestBody.create(null, file);
        }
      } else {
        String encodedBody = call.getString("body");
        if (encodedBody != null) {
          body = RequestBody.create(null, Base64.decode(encodedBody, Base64.DEFAULT));
        }
      }
      if (body == null && (method.equals("PUT") || method.equals("POST")
          || method.equals("PATCH") || method.equals("PROPPATCH") || method.equals("REPORT"))) {
        body = RequestBody.create(null, new byte[0]);
      }
      builder.method(method, body);
      final long requestBodyBytes = body == null ? 0 : body.contentLength();
      httpClient.newCall(builder.build()).enqueue(new Callback() {
        @Override
        public void onFailure(Call request, IOException error) {
          rejectRequest(call, "原生同步请求失败\n请求体大小: " + requestBodyBytes + " bytes",
              "SYNC_HTTP_REQUEST_FAILED", error);
        }

        @Override
        public void onResponse(Call request, Response response) {
          try (Response closedResponse = response) {
            JSObject responseHeaders = new JSObject();
            for (String name : response.headers().names()) {
              responseHeaders.put(name, response.header(name));
            }
            ResponseBody responseBody = response.body();
            JSObject result = new JSObject();
            result.put("status", response.code());
            result.put("headers", responseHeaders);
            if (responseFile != null) {
              // Stream large backups to disk instead of allocating one Base64 bridge message.
              try (FileOutputStream output = new FileOutputStream(responseFile)) {
                if (responseBody != null) {
                  try (InputStream input = responseBody.byteStream()) {
                    byte[] buffer = new byte[64 * 1024];
                    int count;
                    while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
                  }
                }
              }
            } else {
              result.put("data", responseBody == null ? ""
                  : Base64.encodeToString(responseBody.bytes(), Base64.NO_WRAP));
            }
            call.resolve(result);
          } catch (Exception error) {
            rejectRequest(call, "读取同步响应失败\n请求体大小: " + requestBodyBytes + " bytes",
                "SYNC_HTTP_RESPONSE_FAILED", error);
          }
        }
      });
    } catch (Exception error) {
      rejectRequest(call, "无法发起原生同步请求",
          "SYNC_HTTP_REQUEST_SETUP_FAILED", error);
    }
  }
}
