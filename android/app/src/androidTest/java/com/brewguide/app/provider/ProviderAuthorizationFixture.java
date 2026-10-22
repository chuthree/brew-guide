package com.brewguide.app.provider;

import android.content.Context;
import android.os.Bundle;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.JSONObject;
import org.junit.Test;

/**
 * Test-APK-only setup. Never shipped and never registered as a Provider call or exported component.
 */
public class ProviderAuthorizationFixture {
  @Test
  public void configureExternalCaller() throws Exception {
    Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
    Bundle args = InstrumentationRegistry.getArguments();
    String pkg = args.getString("callerPackage", "com.brewguide.providercaller");
    if (!pkg.startsWith("com.brewguide.providercaller"))
      throw new IllegalArgumentException("Fixture only supports test caller package");
    int uid = context.getPackageManager().getApplicationInfo(pkg, 0).uid;
    ProviderAccessStore store = ProviderAccessStore.get(context);
    ProviderAccessStore.Caller caller = store.captureCaller(uid);
    String action = args.getString("fixtureAction", "grant");
    if (action.equals("revoke")) {
      store.revoke(caller.key, store.getState().getLong("revision"));
    } else if (action.equals("grant")) {
      store.requestAccess(caller);
      JSONObject scopes = new JSONObject(args.getString("scopes", "{}"));
      store.grant(caller.key, scopes, store.getState().getLong("revision"));
    } else throw new IllegalArgumentException("Unknown fixture action");
  }
}
