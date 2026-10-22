package com.brewguide.app.provider;

import android.app.ActivityOptions;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import com.brewguide.app.MainActivity;
import java.lang.ref.WeakReference;
import java.util.concurrent.CopyOnWriteArrayList;
import org.json.JSONObject;

/**
 * Native-only handoff. The single existing WebView presents consent, never executes Provider work.
 */
public final class ProviderAuthorizationFlow {
  static final String ACTION = "com.brewguide.app.PROVIDER_AUTHORIZATION";
  private static String activeRequest;
  private static WeakReference<ProviderAuthorizationEntryActivity> entry =
      new WeakReference<>(null);
  private static WeakReference<MainActivity> main = new WeakReference<>(null);
  private static final CopyOnWriteArrayList<Runnable> listeners = new CopyOnWriteArrayList<>();
  private static final Handler handler = new Handler(Looper.getMainLooper());

  private ProviderAuthorizationFlow() {}

  public static PendingIntent intent(Context context, String requestId) {
    Intent intent =
        new Intent(context, ProviderAuthorizationEntryActivity.class)
            .setAction(ACTION)
            .setData(
                new Uri.Builder()
                    .scheme("brewguide-authorization")
                    .authority("request")
                    .appendPath(requestId)
                    .build());
    // No NEW_TASK here: startIntentSenderForResult must preserve the caller's result channel.
    android.os.Bundle options = null;
    if (Build.VERSION.SDK_INT >= 35) {
      ActivityOptions activityOptions = ActivityOptions.makeBasic();
      activityOptions.setPendingIntentCreatorBackgroundActivityStartMode(
          ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED);
      options = activityOptions.toBundle();
    }
    return PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_IMMUTABLE, options);
  }

  static synchronized boolean attachEntry(String id, ProviderAuthorizationEntryActivity activity) {
    ProviderAuthorizationEntryActivity current = entry.get();
    if (activeRequest != null
        && (!activeRequest.equals(id)
            || (current != null && current != activity && !current.isDestroyed()))) return false;
    activeRequest = id;
    entry = new WeakReference<>(activity);
    return true;
  }

  /** Only called with Android's saved Activity state, never exported Intent extras. */
  public static synchronized void restoreActive(Context context, String id) {
    if (id == null || activeRequest != null) return;
    try {
      JSONObject request = ProviderAccessStore.get(context).authorizationRequest(id);
      if ("pending".equals(request.getString("status"))) activeRequest = id;
    } catch (Exception unavailable) {
      /* Never recover an unknown or stale authorization. */
    }
  }

  public static synchronized void attachMain(MainActivity activity) {
    main = new WeakReference<>(activity);
  }

  public static synchronized boolean hasActiveRequest() {
    return activeRequest != null;
  }

  public static void addListener(Runnable listener) {
    listeners.add(listener);
  }

  public static void removeListener(Runnable listener) {
    listeners.remove(listener);
  }

  public static synchronized String activeRequestId() {
    return activeRequest;
  }

  public static void mainReady(MainActivity activity) {
    attachMain(activity);
    activity.updateProviderAuthorizationBackHandler();
    if (hasActiveRequest()) for (Runnable listener : listeners) listener.run();
  }

  public static JSONObject pending(Context context) throws Exception {
    String id = activeRequestId();
    if (id == null) return new JSONObject().put("pending", JSONObject.NULL);
    JSONObject state = ProviderAccessStore.get(context).pendingAuthorizationView(id);
    if (state.isNull("pending")) finish(context, id);
    return state;
  }

  public static JSONObject resolve(Context context, String id, String decision) {
    synchronized (ProviderAuthorizationFlow.class) {
      if (id == null || !id.equals(activeRequest))
        throw new SecurityException("Authorization request is not the active user interaction");
    }
    JSONObject result = ProviderAccessStore.get(context).resolveAuthorization(id, decision);
    finish(context, id);
    return result;
  }

  static void finish(Context context, String id) {
    handler.post(
        () -> {
          if (!id.equals(activeRequestId())) return;
          // Timers may wake just before wall-clock expiry; do not discard a live result channel.
          try {
            if ("pending"
                .equals(
                    ProviderAccessStore.get(context)
                        .authorizationRequest(id)
                        .getString("status"))) {
              handler.postDelayed(() -> finish(context, id), 50);
              return;
            }
          } catch (Exception unavailable) {
            /* No authorization can be applied. Close safely. */
          }
          ProviderAuthorizationEntryActivity target;
          MainActivity activity;
          synchronized (ProviderAuthorizationFlow.class) {
            if (!id.equals(activeRequest)) return;
            target = entry.get();
            activity = main.get();
            activeRequest = null;
            entry.clear();
          }
          // Return only through the verified system result channel. Never launch a supplied
          // URI/package.
          boolean hasResultChannel =
              target != null && !target.isDestroyed() && target.completeFromStore();
          if (activity != null && !activity.isDestroyed()) {
            activity.updateProviderAuthorizationBackHandler();
            if (hasResultChannel && activity.hasWindowFocus()) activity.moveTaskToBack(true);
          }
          for (Runnable listener : listeners) listener.run();
        });
  }

  public static boolean cancelFromBack(Context context) {
    String id = activeRequestId();
    if (id == null) return false;
    resolve(context, id, "cancel");
    return true;
  }
}
