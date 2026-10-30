package com.brewguide.app;

import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;
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
  private final OkHttpClient client = new OkHttpClient.Builder()
      .connectTimeout(15, TimeUnit.SECONDS)
      .readTimeout(60, TimeUnit.SECONDS)
      .callTimeout(90, TimeUnit.SECONDS)
      .followRedirects(false)
      .followSslRedirects(false)
      .retryOnConnectionFailure(false)
      .build();

  @PluginMethod
  public void request(PluginCall call) {
    try {
      String url = call.getString("url");
      String method = call.getString("method", "GET");
      Request.Builder builder = new Request.Builder().url(url);
      JSObject headers = call.getObject("headers", new JSObject());
      Iterator<String> keys = headers.keys();
      while (keys.hasNext()) {
        String key = keys.next();
        builder.header(key, headers.getString(key));
      }
      String encodedBody = call.getString("body");
      RequestBody body = encodedBody == null ? null
          : RequestBody.create(null, Base64.decode(encodedBody, Base64.DEFAULT));
      if (body == null && (method.equals("PUT") || method.equals("POST")
          || method.equals("PATCH") || method.equals("PROPPATCH") || method.equals("REPORT"))) {
        body = RequestBody.create(null, new byte[0]);
      }
      builder.method(method, body);
      client.newCall(builder.build()).enqueue(new Callback() {
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
            result.put("data", responseBody == null ? ""
                : Base64.encodeToString(responseBody.bytes(), Base64.NO_WRAP));
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
