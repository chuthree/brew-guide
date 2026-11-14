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
            .callTimeout(90, TimeUnit.SECONDS)
            .followRedirects(false)
            .followSslRedirects(false)
            .retryOnConnectionFailure(false)
            .build();
      } catch (RuntimeException | LinkageError | AssertionError error) {
        Throwable cause = error.getCause() == null ? error : error.getCause();
        throw new IOException(
            "同步网络组件初始化失败（Android " + android.os.Build.VERSION.RELEASE
                + " / API " + android.os.Build.VERSION.SDK_INT
                + " / " + android.os.Build.MANUFACTURER + " " + android.os.Build.MODEL
                + " / " + cause + "）", error);
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

  private void request(PluginCall call, boolean fileTransfer) {
    final OkHttpClient httpClient;
    try {
      httpClient = getClient();
    } catch (IOException error) {
      call.reject(error.getMessage(), "SYNC_HTTP_INIT_FAILED", error);
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
      httpClient.newCall(builder.build()).enqueue(new Callback() {
        @Override
        public void onFailure(Call request, IOException error) {
          call.reject("原生同步请求失败", error);
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
            call.reject("读取同步响应失败", error);
          }
        }
      });
    } catch (Exception error) {
      call.reject("无法发起原生同步请求", error);
    }
  }
}
