package com.brewguide.app.provider;

import static org.junit.Assert.*;

import android.content.Context;
import android.content.ContextWrapper;
import android.os.Process;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.lang.reflect.Constructor;
import java.util.Arrays;
import java.util.Collections;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;

/** Isolated authorization tests; ContentResolver integration is a separate external-UID suite. */
public class ProviderAccessStoreTest {
  private ProviderAccessStore store;
  private ProviderAccessStore.Caller caller;
  private Context isolated;

  @Before
  public void setup() throws Exception {
    Context target = InstrumentationRegistry.getInstrumentation().getTargetContext();
    File directory =
        new File(target.getCacheDir(), "provider-auth-test-" + java.util.UUID.randomUUID());
    assertTrue(directory.mkdirs());
    isolated =
        new ContextWrapper(target) {
          @Override
          public File getNoBackupFilesDir() {
            return directory;
          }
        };
    store = open();
    caller = store.captureCaller(Process.myUid());
  }

  @After
  public void cleanup() {
    File directory = isolated.getNoBackupFilesDir();
    File[] files = directory.listFiles();
    if (files != null) for (File file : files) assertTrue(file.delete());
    assertTrue(directory.delete());
  }

  private ProviderAccessStore open() throws Exception {
    Constructor<ProviderAccessStore> constructor =
        ProviderAccessStore.class.getDeclaredConstructor(Context.class);
    constructor.setAccessible(true);
    return constructor.newInstance(isolated);
  }

  private long revision() throws Exception {
    return store.getState().getLong("revision");
  }

  private JSONObject scopes() throws Exception {
    return new JSONObject()
        .put("beans", new JSONObject().put("read", true).put("write", true).put("delete", false));
  }

  private void approved() throws Exception {
    store.requestAccess(caller);
    store.grant(caller.key, scopes(), revision());
  }

  private static void denied(Runnable work) {
    try {
      work.run();
      fail("Expected SecurityException");
    } catch (SecurityException expected) {
      /* denied */
    }
  }

  @Test
  public void pendingRequestCannotReadOrWrite() {
    store.requestAccess(caller);
    denied(() -> store.authorize(caller, Collections.singleton("beans"), "read"));
    denied(() -> store.authorize(caller, Collections.singleton("beans"), "write"));
  }

  @Test
  public void scopeAndDeleteChecksAreIndependent() throws Exception {
    approved();
    store.authorize(caller, Collections.singleton("beans"), "write").check();
    denied(() -> store.authorize(caller, Collections.singleton("beans"), "delete"));
    denied(() -> store.authorize(caller, Arrays.asList("beans", "notes"), "read"));
    denied(() -> store.authorize(caller, Collections.singleton("unknown"), "read"));
  }

  @Test
  public void revocationInvalidatesAlreadyQueuedLeaseAndCommit() throws Exception {
    approved();
    ProviderAccessStore.Lease lease =
        store.authorize(caller, Collections.singleton("beans"), "write");
    store.revoke(caller.key, revision());
    denied(lease::check);
    AtomicBoolean committed = new AtomicBoolean(false);
    denied(() -> lease.commitGuard(() -> committed.set(true)));
    assertFalse(committed.get());
  }

  @Test
  public void permissionsSurviveProcessStoreRecreation() throws Exception {
    approved();
    ProviderAccessStore reopened = open();
    reopened
        .authorize(reopened.captureCaller(Process.myUid()), Collections.singleton("beans"), "write")
        .check();
    assertEquals(revision(), reopened.getState().getLong("revision"));
  }

  @Test
  public void staleAdminRevisionCannotRestoreRevokedGrant() throws Exception {
    approved();
    long oldRevision = revision();
    store.revoke(caller.key, oldRevision);
    try {
      store.grant(caller.key, scopes(), oldRevision);
      fail("Expected stale revision failure");
    } catch (IllegalStateException expected) {
      /* stale */
    }
  }

  @Test
  public void unknownUidIsNotAnApplicationIdentity() {
    denied(() -> store.captureCaller(Integer.MAX_VALUE));
  }

  @Test
  public void corruptionNeverFallsBackToAllow() throws Exception {
    File file = new File(isolated.getNoBackupFilesDir(), "provider-access-v1.json");
    try (java.io.FileOutputStream stream = new java.io.FileOutputStream(file)) {
      stream.write("not-json".getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }
    ProviderAccessStore corrupted = open();
    denied(corrupted::getState);
  }

  @Test
  public void revocationCannotInterleaveWithACommitAlreadyInProgress() throws Exception {
    approved();
    ProviderAccessStore.Lease lease =
        store.authorize(caller, Collections.singleton("beans"), "write");
    long rev = revision();
    java.util.concurrent.CountDownLatch entered = new java.util.concurrent.CountDownLatch(1);
    java.util.concurrent.CountDownLatch release = new java.util.concurrent.CountDownLatch(1);
    AtomicBoolean revoked = new AtomicBoolean(false);
    Thread writer =
        new Thread(
            () ->
                lease.commitGuard(
                    () -> {
                      entered.countDown();
                      try {
                        assertTrue(release.await(5, java.util.concurrent.TimeUnit.SECONDS));
                      } catch (InterruptedException failure) {
                        throw new RuntimeException(failure);
                      }
                    }));
    writer.start();
    assertTrue(entered.await(5, java.util.concurrent.TimeUnit.SECONDS));
    Thread revoker =
        new Thread(
            () -> {
              store.revoke(caller.key, rev);
              revoked.set(true);
            });
    revoker.start();
    assertFalse(revoked.get());
    release.countDown();
    writer.join(5000);
    revoker.join(5000);
    assertTrue(revoked.get());
    denied(lease::check);
  }

  @Test
  public void malformedScopesFailClosed() throws Exception {
    for (String input :
        new String[] {
          "{\"sql\":{\"read\":true}}",
          "{\"beans\":{\"write\":true}}",
          "{\"beans\":{\"read\":\"true\"}}",
          "{\"beans\":{\"read\":true,\"admin\":true}}"
        }) {
      try {
        ProviderAccessStore.validateScopes(new JSONObject(input));
        fail("Expected invalid scopes: " + input);
      } catch (IllegalArgumentException expected) {
        /* invalid */
      }
    }
  }

  @Test
  public void requestedScopesNeverExpandAndCancelDoesNotChangeGrants() throws Exception {
    approved();
    long before = revision();
    JSONObject request =
        store.createAuthorizationRequest(
            caller, new JSONObject("{\"notes\":{\"read\":true,\"write\":true}}"));
    assertEquals(1, request.getJSONObject("scopes").length());
    assertFalse(request.getJSONObject("scopes").has("beans"));
    assertEquals(before, revision());
    assertEquals(
        "cancelled",
        store.resolveAuthorization(request.getString("requestId"), "cancel").getString("status"));
    assertEquals(before, revision());
    assertEquals(Collections.singleton("beans"), store.grantedDomains(caller, "write"));
  }

  @Test
  public void approvalMergesOnlyRequestedBitsAndReplayDoesNotGrantAgain() throws Exception {
    approved();
    JSONObject request =
        store.createAuthorizationRequest(
            caller, new JSONObject("{\"notes\":{\"read\":true,\"write\":true}}"));
    String id = request.getString("requestId");
    long before = revision();
    assertEquals("approved", store.resolveAuthorization(id, "approve").getString("status"));
    assertEquals(before + 1, revision());
    assertEquals(
        new java.util.HashSet<>(Arrays.asList("beans", "notes")),
        store.grantedDomains(caller, "write"));
    assertTrue(store.grantedDomains(caller, "delete").isEmpty());
    store.resolveAuthorization(id, "approve");
    assertEquals(before + 1, revision());
    store.revoke(caller.key, revision());
    store.resolveAuthorization(id, "approve");
    assertTrue(store.grantedDomains(caller, "read").isEmpty());
  }

  @Test
  public void freshRequestAfterRevocationDoesNotReuseStaleNonce() throws Exception {
    JSONObject first = store.createAuthorizationRequest(caller, scopes());
    assertEquals(
        first.getString("requestId"),
        store.createAuthorizationRequest(caller, scopes()).getString("requestId"));
    store.revoke(caller.key, revision());
    assertEquals(
        "stale",
        store.resolveAuthorization(first.getString("requestId"), "approve").getString("status"));
    JSONObject second = store.createAuthorizationRequest(caller, scopes());
    assertNotEquals(first.getString("requestId"), second.getString("requestId"));
    assertEquals("pending", second.getString("status"));
  }

  @Test
  public void pendingRequestSurvivesProcessReopenAndCancelledUngrantIsHidden() throws Exception {
    JSONObject request = store.createAuthorizationRequest(caller, scopes());
    String id = request.getString("requestId");
    ProviderAccessStore reopened = open();
    assertEquals("pending", reopened.authorizationRequest(id).getString("status"));
    assertEquals(
        request.getJSONObject("scopes").toString(),
        reopened
            .pendingAuthorizationView(id)
            .getJSONObject("pending")
            .getJSONObject("scopes")
            .toString());
    reopened.resolveAuthorization(id, "cancel");
    assertEquals(0, reopened.getState().getJSONArray("callers").length());
    reopened.requestAccess(caller);
    assertEquals(1, reopened.getState().getJSONArray("callers").length());
  }

  @Test
  public void expiredRequestCannotGrantAndNewRequestGetsFreshNonce() throws Exception {
    JSONObject request = store.createAuthorizationRequest(caller, scopes());
    String id = request.getString("requestId");
    java.lang.reflect.Field field = ProviderAccessStore.class.getDeclaredField("requests");
    field.setAccessible(true);
    ((JSONObject) field.get(store)).getJSONObject(id).put("expiresAt", 0);
    assertEquals("expired", store.resolveAuthorization(id, "approve").getString("status"));
    assertTrue(store.grantedDomains(caller, "read").isEmpty());
    assertNotEquals(id, store.createAuthorizationRequest(caller, scopes()).getString("requestId"));
  }

  @Test
  public void concurrentApproveCancelHasOneDurableOutcome() throws Exception {
    String id = store.createAuthorizationRequest(caller, scopes()).getString("requestId");
    long before = revision();
    java.util.concurrent.ExecutorService executor =
        java.util.concurrent.Executors.newFixedThreadPool(2);
    try {
      java.util.concurrent.Future<JSONObject> approve =
          executor.submit(() -> store.resolveAuthorization(id, "approve"));
      java.util.concurrent.Future<JSONObject> cancel =
          executor.submit(() -> store.resolveAuthorization(id, "cancel"));
      String outcome = approve.get().getString("status");
      assertEquals(outcome, cancel.get().getString("status"));
      assertEquals(before + ("approved".equals(outcome) ? 1 : 0), revision());
      assertEquals(outcome, open().authorizationRequest(id).getString("status"));
    } finally {
      executor.shutdownNow();
    }
  }

  @Test
  public void immutableAuthorizationIntentBelongsToBrewGuide() throws Exception {
    String id = store.createAuthorizationRequest(caller, scopes()).getString("requestId");
    android.app.PendingIntent pending = ProviderAuthorizationFlow.intent(isolated, id);
    assertEquals(isolated.getPackageName(), pending.getCreatorPackage());
    assertEquals(Process.myUid(), pending.getCreatorUid());
    if (android.os.Build.VERSION.SDK_INT >= 31) assertTrue(pending.isImmutable());
    pending.cancel();
  }

  @Test
  public void accessStatusIsCoherentOwnFourDomainSnapshot() throws Exception {
    JSONObject permissions = store.accessStatus(caller).getJSONObject("domainPermissions");
    assertEquals(4, permissions.length());
    for (String domain : ProviderAccessStore.DOMAINS)
      for (String access : Arrays.asList("read", "write", "delete"))
        assertFalse(permissions.getJSONObject(domain).getBoolean(access));
    approved();
    permissions = store.accessStatus(caller).getJSONObject("domainPermissions");
    assertTrue(permissions.getJSONObject("beans").getBoolean("write"));
    assertFalse(permissions.getJSONObject("notes").getBoolean("write"));
    Constructor<ProviderAccessStore.Caller> constructor =
        ProviderAccessStore.Caller.class.getDeclaredConstructor(
            int.class, String.class, String.class, long.class);
    constructor.setAccessible(true);
    ProviderAccessStore.Caller forged =
        constructor.newInstance(caller.uid, "fake.package", caller.signingDigest, 0L);
    denied(() -> store.accessStatus(forged));
  }
}
