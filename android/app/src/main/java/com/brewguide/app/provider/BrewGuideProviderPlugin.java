package com.brewguide.app.provider;

import android.os.Binder;
import android.os.Process;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** No exported Android component can invoke these administrative operations. */
@CapacitorPlugin(name = "BrewGuideProvider")
public class BrewGuideProviderPlugin extends Plugin {
  private Runnable authorizationListener;

  @Override
  public void load() {
    authorizationListener =
        () ->
            notifyListeners(
                "authorizationRequested",
                new JSObject().put("requestId", ProviderAuthorizationFlow.activeRequestId()),
                true);
    ProviderAuthorizationFlow.addListener(authorizationListener);
    if (ProviderAuthorizationFlow.hasActiveRequest()) authorizationListener.run();
  }

  @Override
  protected void handleOnDestroy() {
    if (authorizationListener != null)
      ProviderAuthorizationFlow.removeListener(authorizationListener);
  }

  @PluginMethod
  public void getPendingAuthorization(PluginCall call) {
    bridge.execute(
        () -> {
          try {
            store();
            call.resolve(new JSObject(ProviderAuthorizationFlow.pending(getContext()).toString()));
          } catch (Exception failure) {
            call.reject(failure.getMessage(), failure);
          }
        });
  }

  @PluginMethod
  public void resolveAuthorization(PluginCall call) {
    bridge.execute(
        () -> {
          try {
            store();
            String id = call.getString("requestId"), decision = call.getString("decision");
            call.resolve(
                new JSObject(
                    ProviderAuthorizationFlow.resolve(getContext(), id, decision).toString()));
          } catch (Exception failure) {
            call.reject(failure.getMessage(), failure);
          }
        });
  }

  private ProviderAccessStore store() {
    if (Binder.getCallingUid() != Process.myUid())
      throw new SecurityException("Administrative caller must be Brew Guide");
    return ProviderAccessStore.get(getContext());
  }

  private void respond(PluginCall call, Runnable mutation) {
    bridge.execute(
        () -> {
          try {
            mutation.run();
            call.resolve(new JSObject(store().getState().toString()));
          } catch (Exception failure) {
            call.reject(failure.getMessage(), failure);
          }
        });
  }

  private static Long readRevision(PluginCall call) {
    Object value = call.getData().opt("expectedRevision");
    if (!(value instanceof Number)) return null;
    double number = ((Number) value).doubleValue();
    if (!Double.isFinite(number)
        || number < 0
        || number > 9007199254740991L
        || number != Math.floor(number)) return null;
    return ((Number) value).longValue();
  }

  @PluginMethod
  public void getState(PluginCall call) {
    respond(call, () -> {});
  }

  @PluginMethod
  public void grant(PluginCall call) {
    respond(
        call,
        () -> {
          String key = call.getString("key");
          JSObject scopes = call.getObject("scopes");
          Long revision = readRevision(call);
          if (key == null || scopes == null || revision == null)
            throw new IllegalArgumentException("Missing authorization fields");
          store().grant(key, scopes, revision);
        });
  }

  @PluginMethod
  public void revoke(PluginCall call) {
    respond(
        call,
        () -> {
          String key = call.getString("key");
          Long revision = readRevision(call);
          if (key == null || revision == null)
            throw new IllegalArgumentException("Missing authorization fields");
          store().revoke(key, revision);
        });
  }
}
