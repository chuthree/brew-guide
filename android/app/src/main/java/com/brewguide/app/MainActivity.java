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

        bridgeBuilder.addWebViewListener(new WebViewListener() {
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
