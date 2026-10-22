package com.brewguide.app.provider;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import com.brewguide.app.MainActivity;
import org.json.JSONObject;

/**
 * Immutable PendingIntent entry, retaining Android's original caller result channel without a
 * WebView.
 */
public final class ProviderAuthorizationEntryActivity extends Activity {
  private String requestId;
  private boolean verified;
  private final Handler handler = new Handler(Looper.getMainLooper());
  private Runnable expiry;

  @Override
  protected void onCreate(Bundle state) {
    super.onCreate(state);
    try {
      if (!ProviderAuthorizationFlow.ACTION.equals(getIntent().getAction())
          || getIntent().getData() == null) throw new SecurityException("Invalid entry");
      requestId = getIntent().getData().getLastPathSegment();
      JSONObject request = ProviderAccessStore.get(this).authorizationRequest(requestId);
      ComponentName calling = getCallingActivity();
      String callingPackage = getCallingPackage();
      if (calling == null
          || callingPackage == null
          || !calling.getPackageName().equals(callingPackage)
          || !callingPackage.equals(request.getString("packageName")))
        throw new SecurityException(
            "Use an Activity result launch from the requesting application");
      int uid = getPackageManager().getApplicationInfo(callingPackage, 0).uid;
      ProviderAccessStore.Caller caller = ProviderAccessStore.get(this).captureCaller(uid);
      if (!caller.key.equals(request.getString("callerKey")))
        throw new SecurityException("Caller identity changed");
      verified = true;
      if (!"pending".equals(request.getString("status"))) {
        completeFromStore();
        return;
      }
      if (!ProviderAuthorizationFlow.attachEntry(requestId, this)) {
        result("busy");
        return;
      }
      expiry = () -> ProviderAuthorizationFlow.finish(this, requestId);
      handler.postDelayed(
          expiry, Math.max(1, request.getLong("expiresAt") - System.currentTimeMillis()));
      startActivity(
          new Intent(this, MainActivity.class)
              .setAction(ProviderAuthorizationFlow.ACTION)
              .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
    } catch (Exception denied) {
      if (verified
          && requestId != null
          && requestId.equals(ProviderAuthorizationFlow.activeRequestId())) {
        try {
          ProviderAuthorizationFlow.resolve(this, requestId, "cancel");
        } catch (Exception ignored) {
        }
      }
      result("invalid_request");
    }
  }

  @Override
  protected void onResume() {
    super.onResume();
    if (verified && requestId != null) {
      try {
        JSONObject request = ProviderAccessStore.get(this).authorizationRequest(requestId);
        if (!"pending".equals(request.getString("status"))) completeFromStore();
      } catch (Exception unavailable) {
        result("invalid_request");
      }
    }
  }

  boolean completeFromStore() {
    if (!verified || isFinishing()) return false;
    try {
      JSONObject request = ProviderAccessStore.get(this).authorizationRequest(requestId);
      String status = request.getString("status");
      if ("pending".equals(status)) return false;
      result(status);
      return true;
    } catch (Exception unavailable) {
      result("invalid_request");
      return false;
    }
  }

  private void result(String status) {
    Intent result = new Intent().putExtra("requestId", requestId).putExtra("status", status);
    setResult("approved".equals(status) ? RESULT_OK : RESULT_CANCELED, result);
    finish();
  }

  @Override
  public void onBackPressed() {
    if (verified && ProviderAuthorizationFlow.cancelFromBack(this)) return;
    result("cancelled");
  }

  @Override
  protected void onDestroy() {
    if (expiry != null) handler.removeCallbacks(expiry);
    super.onDestroy();
  }
}
