package com.brewguide.app;

import android.content.SharedPreferences;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {

  private static final String LAST_REPORT_KEY = "brew-guide:crash-diagnostics:last-report";

  @Override
  protected void onCreate(android.os.Bundle savedInstanceState) {
    registerPlugin(BrewGuideGalleryPlugin.class);
    registerPlugin(BrewGuideDocumentPlugin.class);
    registerPlugin(BrewGuideSyncHttpPlugin.class);
    registerPlugin(com.brewguide.app.provider.BrewGuideDatabasePlugin.class);
    registerPlugin(com.brewguide.app.provider.BrewGuideProviderPlugin.class);

    bridgeBuilder.addWebViewListener(
        new WebViewListener() {
          @Override
          public boolean onRenderProcessGone(WebView webView, RenderProcessGoneDetail detail) {
            persistWebViewCrash(detail);

            if (webView != null) {
              webView.destroy();
            }

            return true;
          }
        });

    super.onCreate(savedInstanceState);
    if (savedInstanceState != null) {
      com.brewguide.app.provider.ProviderAuthorizationFlow.restoreActive(
          this, savedInstanceState.getString("brewGuideProviderAuthorizationRequest"));
    }
    com.brewguide.app.provider.ProviderAuthorizationFlow.mainReady(this);
  }

  @Override
  public void onSaveInstanceState(android.os.Bundle outState) {
    outState.putString(
        "brewGuideProviderAuthorizationRequest",
        com.brewguide.app.provider.ProviderAuthorizationFlow.activeRequestId());
    super.onSaveInstanceState(outState);
  }

  @Override
  public void onDestroy() {
    if (android.os.Build.VERSION.SDK_INT >= 33 && authorizationBackCallback != null) {
      getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback(authorizationBackCallback);
      authorizationBackCallback = null;
    }
    super.onDestroy();
  }

  private android.window.OnBackInvokedCallback authorizationBackCallback;

  public void updateProviderAuthorizationBackHandler() {
    if (android.os.Build.VERSION.SDK_INT < 33) return;
    boolean active = com.brewguide.app.provider.ProviderAuthorizationFlow.hasActiveRequest();
    if (active && authorizationBackCallback == null) {
      authorizationBackCallback =
          () -> com.brewguide.app.provider.ProviderAuthorizationFlow.cancelFromBack(this);
      getOnBackInvokedDispatcher()
          .registerOnBackInvokedCallback(
              android.window.OnBackInvokedDispatcher.PRIORITY_OVERLAY, authorizationBackCallback);
    } else if (!active && authorizationBackCallback != null) {
      getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback(authorizationBackCallback);
      authorizationBackCallback = null;
    }
  }

  @Override
  protected void onNewIntent(android.content.Intent intent) {
    super.onNewIntent(intent);
    // No URL navigation, setIntent, reload, or new WebView for authorization.
    com.brewguide.app.provider.ProviderAuthorizationFlow.mainReady(this);
  }

  @Override
  public void onBackPressed() {
    if (!com.brewguide.app.provider.ProviderAuthorizationFlow.cancelFromBack(this))
      super.onBackPressed();
  }

  @Override
  public void onResume() {
    super.onResume();
    com.brewguide.app.provider.ProviderAuthorizationFlow.mainReady(this);
  }

  private void persistWebViewCrash(RenderProcessGoneDetail detail) {
    SharedPreferences preferences =
        getApplicationContext().getSharedPreferences("CapacitorStorage", MODE_PRIVATE);

    try {
      String timestamp = java.time.Instant.now().toString();

      JSONObject nativeCrash = new JSONObject();
      nativeCrash.put("platform", "android");
      nativeCrash.put("reason", "WebView render process gone");
      nativeCrash.put("didCrash", detail.didCrash());
      nativeCrash.put("rendererPriorityAtExit", detail.rendererPriorityAtExit());
      nativeCrash.put("at", timestamp);

      JSONObject session = new JSONObject();
      session.put("sessionId", "android-render-process-" + System.currentTimeMillis());
      session.put("startedAt", timestamp);
      session.put("updatedAt", timestamp);
      session.put("startupState", "failed");
      session.put("nativeCrash", nativeCrash);

      JSONObject checkpoint = new JSONObject();
      checkpoint.put("name", "android:webview-render-process-gone");
      checkpoint.put("at", timestamp);

      JSONArray checkpoints = new JSONArray();
      checkpoints.put(checkpoint);
      session.put("lastCheckpoint", checkpoint);
      session.put("checkpoints", checkpoints);

      JSONObject report = new JSONObject();
      report.put("source", "native");
      report.put("inferredReason", "Android WebView render process gone");
      report.put("session", session);
      report.put("detectedAt", timestamp);

      preferences.edit().putString(LAST_REPORT_KEY, report.toString()).apply();
    } catch (JSONException exception) {
      android.util.Log.e("BrewGuide", "Failed to persist WebView crash diagnostics", exception);
    }
  }
}
