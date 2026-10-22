package com.brewguide.app.provider;

import android.content.Context;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.os.Binder;
import android.os.Build;
import android.util.AtomicFile;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Collection;
import java.util.HashSet;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/** Device-local Provider authorization. This file is outside backup and sync roots. */
public final class ProviderAccessStore {
  public static final Set<String> DOMAINS =
      java.util.Collections.unmodifiableSet(
          new HashSet<>(Arrays.asList("brewing", "beans", "notes", "settings")));
  private static volatile ProviderAccessStore instance;
  private final Context context;
  private final AtomicFile file;
  private JSONObject records;
  private JSONObject requests;
  static final long REQUEST_TTL_MS = 5 * 60_000L;
  private long revision;

  public static ProviderAccessStore get(Context context) {
    if (instance == null)
      synchronized (ProviderAccessStore.class) {
        if (instance == null) instance = new ProviderAccessStore(context.getApplicationContext());
      }
    return instance;
  }

  private ProviderAccessStore(Context context) {
    this.context = context;
    this.file = new AtomicFile(new File(context.getNoBackupFilesDir(), "provider-access-v1.json"));
  }

  private void load() {
    if (records != null) return;
    try {
      JSONObject state = new JSONObject(new String(file.readFully(), StandardCharsets.UTF_8));
      records = state.getJSONObject("callers");
      requests = state.optJSONObject("requests");
      if (requests == null) requests = new JSONObject();
      revision = state.getLong("revision");
    } catch (java.io.FileNotFoundException missing) {
      records = new JSONObject();
      requests = new JSONObject();
    } catch (Exception corrupt) {
      // Corruption must never grant access or silently replace the evidence.
      throw new SecurityException("Provider authorization storage is unreadable", corrupt);
    }
  }

  private void persist(JSONObject next) {
    persist(next, requests, true);
  }

  private void persist(JSONObject next, JSONObject nextRequests, boolean grantsChanged) {
    FileOutputStream out = null;
    long nextRevision = revision + (grantsChanged ? 1 : 0);
    try {
      JSONObject state =
          new JSONObject()
              .put("revision", nextRevision)
              .put("callers", next)
              .put("requests", nextRequests);
      out = file.startWrite();
      out.write(state.toString().getBytes(StandardCharsets.UTF_8));
      file.finishWrite(out);
      records = next;
      requests = nextRequests;
      revision = nextRevision;
    } catch (Exception failure) {
      if (out != null) file.failWrite(out);
      throw new IllegalStateException("Unable to save Provider authorization", failure);
    }
  }

  public static final class Caller {
    public final int uid;
    public final String packageName;
    public final String signingDigest;
    public final String key;

    private Caller(int uid, String packageName, String signingDigest, long installedAt) {
      this.uid = uid;
      this.packageName = packageName;
      this.signingDigest = signingDigest;
      this.key = uid + ":" + packageName + ":" + signingDigest + ":" + installedAt;
    }
  }

  public Caller captureCalling() {
    return captureCaller(Binder.getCallingUid());
  }

  public Caller captureCaller(int uid) {
    try {
      PackageManager pm = context.getPackageManager();
      String[] packages = pm.getPackagesForUid(uid);
      // Shared UIDs cannot establish which application initiated an IPC.
      if (packages == null || packages.length != 1)
        throw new SecurityException("Ambiguous caller UID");
      PackageInfo info =
          pm.getPackageInfo(
              packages[0],
              Build.VERSION.SDK_INT >= 28
                  ? PackageManager.GET_SIGNING_CERTIFICATES
                  : PackageManager.GET_SIGNATURES);
      if (info.applicationInfo == null || info.applicationInfo.uid != uid)
        throw new SecurityException("Caller identity unavailable");
      Signature[] signatures =
          Build.VERSION.SDK_INT >= 28
              ? (info.signingInfo == null ? null : info.signingInfo.getApkContentsSigners())
              : info.signatures;
      if (signatures == null || signatures.length == 0)
        throw new SecurityException("Caller signature unavailable");
      String[] digests = new String[signatures.length];
      for (int i = 0; i < signatures.length; i++)
        digests[i] = hex(MessageDigest.getInstance("SHA-256").digest(signatures[i].toByteArray()));
      Arrays.sort(digests);
      return new Caller(uid, packages[0], String.join(",", digests), info.firstInstallTime);
    } catch (SecurityException denied) {
      throw denied;
    } catch (Exception failure) {
      throw new SecurityException("Unable to verify caller", failure);
    }
  }

  private static String hex(byte[] data) {
    StringBuilder result = new StringBuilder();
    for (byte value : data)
      result.append(String.format(java.util.Locale.ROOT, "%02x", value & 255));
    return result.toString();
  }

  private void verify(Caller caller) {
    if (caller == null || !caller.key.equals(captureCaller(caller.uid).key))
      throw new SecurityException("Caller identity changed");
  }

  public synchronized void requestAccess(Caller caller) {
    recordCaller(caller, true);
  }

  private synchronized void recordCaller(Caller caller, boolean manualPending) {
    load();
    verify(caller);
    if (records.has(caller.key)) {
      if (manualPending) {
        try {
          JSONObject next = new JSONObject(records.toString());
          next.getJSONObject(caller.key).put("manualPending", true);
          persist(next, requests, false);
        } catch (Exception failure) {
          throw new IllegalStateException(failure);
        }
      }
      return;
    }
    if (records.length() >= 64) throw new SecurityException("Too many pending callers");
    try {
      JSONObject next = new JSONObject(records.toString());
      String label =
          context
              .getPackageManager()
              .getApplicationLabel(
                  context.getPackageManager().getApplicationInfo(caller.packageName, 0))
              .toString();
      next.put(
          caller.key,
          new JSONObject()
              .put("key", caller.key)
              .put("uid", caller.uid)
              .put("packageName", caller.packageName)
              .put("signingDigest", caller.signingDigest)
              .put("label", label)
              .put("requestedAt", System.currentTimeMillis())
              .put("manualPending", manualPending)
              .put("scopes", new JSONObject()));
      persist(next, requests, false);
    } catch (Exception failure) {
      throw new IllegalStateException("Unable to record caller request", failure);
    }
  }

  /** Requests and grants share one AtomicFile, but request bookkeeping does not change grants. */
  public synchronized JSONObject createAuthorizationRequest(Caller caller, JSONObject scopes) {
    load();
    verify(caller);
    try {
      JSONObject clean = validateScopes(scopes);
      if (clean.length() == 0)
        throw new IllegalArgumentException("Request at least one readable scope");
      recordCaller(caller, false);
      long now = System.currentTimeMillis();
      JSONObject next = new JSONObject(requests.toString());
      java.util.Iterator<String> ids = requests.keys();
      while (ids.hasNext()) {
        String id = ids.next();
        JSONObject existing = requests.getJSONObject(id);
        if (expired(existing)) {
          next.remove(id);
          continue;
        }
        if ("pending".equals(existing.getString("status"))
            && caller.key.equals(existing.getString("callerKey"))) {
          if (existing.getLong("requestedRevision") != revision) {
            next.getJSONObject(id).put("status", "stale");
            continue;
          }
          if (!sameScopes(clean, existing.getJSONObject("scopes")))
            throw new IllegalStateException(
                "An authorization request for this caller is already pending");
          return new JSONObject(existing.toString());
        }
      }
      if (next.length() >= 128) throw new IllegalStateException("Too many authorization requests");
      String id = java.util.UUID.randomUUID().toString();
      JSONObject request =
          new JSONObject()
              .put("requestId", id)
              .put("callerKey", caller.key)
              .put("uid", caller.uid)
              .put("packageName", caller.packageName)
              .put("signingDigest", caller.signingDigest)
              .put("scopes", clean)
              .put("requestedRevision", revision)
              .put("createdAt", now)
              .put("expiresAt", now + REQUEST_TTL_MS)
              .put("createdElapsed", android.os.SystemClock.elapsedRealtime())
              .put("bootCount", bootCount())
              .put("status", "pending");
      next.put(id, request);
      persist(records, next, false);
      return new JSONObject(request.toString());
    } catch (IllegalArgumentException | IllegalStateException failure) {
      throw failure;
    } catch (org.json.JSONException malformed) {
      throw new IllegalArgumentException("Invalid authorization scopes", malformed);
    } catch (Exception failure) {
      throw new IllegalStateException("Unable to create authorization request", failure);
    }
  }

  private int bootCount() {
    try {
      return android.provider.Settings.Global.getInt(
          context.getContentResolver(), android.provider.Settings.Global.BOOT_COUNT, -1);
    } catch (Exception unavailable) {
      return -1;
    }
  }

  private boolean expired(JSONObject request) throws Exception {
    long elapsed = android.os.SystemClock.elapsedRealtime(),
        created = request.optLong("createdElapsed", elapsed);
    return request.getLong("expiresAt") <= System.currentTimeMillis()
        || request.optInt("bootCount", bootCount()) != bootCount()
        || elapsed < created
        || elapsed - created >= REQUEST_TTL_MS;
  }

  private static boolean sameScopes(JSONObject left, JSONObject right) {
    for (String domain : DOMAINS)
      for (String permission : Arrays.asList("read", "write", "delete")) {
        JSONObject a = left.optJSONObject(domain), b = right.optJSONObject(domain);
        if ((a != null && a.optBoolean(permission)) != (b != null && b.optBoolean(permission)))
          return false;
      }
    return true;
  }

  public synchronized JSONObject authorizationRequest(String id) {
    load();
    try {
      JSONObject request = requests.optJSONObject(id);
      if (request == null) throw new SecurityException("Unknown authorization request");
      JSONObject result = new JSONObject(request.toString());
      boolean identityCurrent;
      try {
        identityCurrent =
            request.getString("callerKey").equals(captureCaller(request.getInt("uid")).key);
      } catch (SecurityException unavailable) {
        identityCurrent = false;
      }
      if ("pending".equals(result.getString("status"))) {
        if (!identityCurrent || request.getLong("requestedRevision") != revision)
          result.put("status", "stale");
        else if (expired(request)) result.put("status", "expired");
      }
      if (!identityCurrent) result.put("status", "stale");
      result.put("identityCurrent", identityCurrent);
      return result;
    } catch (SecurityException failure) {
      throw failure;
    } catch (Exception failure) {
      throw new IllegalStateException(failure);
    }
  }

  public synchronized JSONObject pendingAuthorizationView(String id) {
    JSONObject request = authorizationRequest(id);
    try {
      if (!"pending".equals(request.getString("status")))
        return new JSONObject().put("pending", JSONObject.NULL);
      JSONObject caller = applicationView(request.getString("packageName"));
      caller.put("identityCurrent", true);
      return new JSONObject()
          .put(
              "pending",
              new JSONObject()
                  .put("requestId", id)
                  .put("status", "pending")
                  .put("caller", caller)
                  .put("brewGuide", applicationView(context.getPackageName()))
                  .put("scopes", request.getJSONObject("scopes"))
                  .put("expiresAt", request.getLong("expiresAt")));
    } catch (Exception failure) {
      throw new IllegalStateException(failure);
    }
  }

  public synchronized JSONObject resolveAuthorization(String id, String decision) {
    if (!"approve".equals(decision) && !"cancel".equals(decision))
      throw new IllegalArgumentException("Invalid authorization decision");
    JSONObject view = authorizationRequest(id);
    try {
      String status = view.getString("status");
      if (!"pending".equals(status))
        return new JSONObject()
            .put("requestId", id)
            .put("status", status)
            .put("pending", JSONObject.NULL);
      JSONObject nextRequests = new JSONObject(requests.toString());
      JSONObject nextRecords = new JSONObject(records.toString());
      if ("approve".equals(decision)) {
        JSONObject record = nextRecords.getJSONObject(view.getString("callerKey"));
        JSONObject merged = new JSONObject(record.getJSONObject("scopes").toString());
        JSONObject requested = view.getJSONObject("scopes");
        for (String domain : DOMAINS) {
          JSONObject requestedGrant = requested.optJSONObject(domain);
          if (requestedGrant == null) continue;
          JSONObject old = merged.optJSONObject(domain);
          JSONObject grant = old == null ? new JSONObject() : new JSONObject(old.toString());
          for (String access : Arrays.asList("read", "write", "delete"))
            grant.put(
                access,
                grant.optBoolean(access, false) || requestedGrant.optBoolean(access, false));
          merged.put(domain, grant);
        }
        record.put("scopes", validateScopes(merged));
        status = "approved";
      } else status = "cancelled";
      nextRequests
          .getJSONObject(id)
          .put("status", status)
          .put("resolvedAt", System.currentTimeMillis());
      persist(nextRecords, nextRequests, "approved".equals(status));
      return new JSONObject()
          .put("requestId", id)
          .put("status", status)
          .put("pending", JSONObject.NULL);
    } catch (Exception failure) {
      throw new IllegalStateException("Unable to resolve authorization", failure);
    }
  }

  private JSONObject applicationView(String packageName) throws Exception {
    PackageManager pm = context.getPackageManager();
    return new JSONObject()
        .put("packageName", packageName)
        .put("label", pm.getApplicationLabel(pm.getApplicationInfo(packageName, 0)).toString())
        .put("iconDataUrl", iconDataUrl(packageName));
  }

  private Object iconDataUrl(String packageName) {
    try {
      android.graphics.drawable.Drawable drawable =
          context.getPackageManager().getApplicationIcon(packageName);
      android.graphics.Bitmap bitmap =
          android.graphics.Bitmap.createBitmap(64, 64, android.graphics.Bitmap.Config.ARGB_8888);
      android.graphics.Canvas canvas = new android.graphics.Canvas(bitmap);
      drawable.setBounds(0, 0, 64, 64);
      drawable.draw(canvas);
      java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream();
      bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, bytes);
      bitmap.recycle();
      return "data:image/png;base64,"
          + android.util.Base64.encodeToString(bytes.toByteArray(), android.util.Base64.NO_WRAP);
    } catch (Exception unavailable) {
      return JSONObject.NULL;
    }
  }

  private boolean hasLiveRequest(String callerKey) throws Exception {
    java.util.Iterator<String> ids = requests.keys();
    while (ids.hasNext()) {
      JSONObject request = requests.getJSONObject(ids.next());
      if (callerKey.equals(request.getString("callerKey"))
          && "pending".equals(request.getString("status"))
          && request.getLong("requestedRevision") == revision
          && !expired(request)) return true;
    }
    return false;
  }

  /** Only expose through the in-process Capacitor administrative bridge. */
  public synchronized JSONObject getState() {
    load();
    try {
      JSONArray callers = new JSONArray();
      java.util.Iterator<String> keys = records.keys();
      while (keys.hasNext()) {
        JSONObject item = new JSONObject(records.getJSONObject(keys.next()).toString());
        if (item.getJSONObject("scopes").length() == 0
            && !item.optBoolean("manualPending", true)
            && !hasLiveRequest(item.getString("key"))) continue;
        boolean current;
        try {
          current = item.getString("key").equals(captureCaller(item.getInt("uid")).key);
        } catch (SecurityException unavailable) {
          current = false;
        }
        item.put("identityCurrent", current);
        item.put(
            "iconDataUrl", current ? iconDataUrl(item.getString("packageName")) : JSONObject.NULL);
        callers.put(item);
      }
      return new JSONObject().put("revision", revision).put("callers", callers);
    } catch (Exception failure) {
      throw new IllegalStateException(failure);
    }
  }

  public synchronized void grant(String key, JSONObject scopes, long expectedRevision) {
    load();
    if (expectedRevision != revision)
      throw new IllegalStateException("Authorization changed; refresh and try again");
    try {
      JSONObject current = records.getJSONObject(key);
      if (!key.equals(captureCaller(current.getInt("uid")).key))
        throw new SecurityException("Caller identity changed");
      JSONObject clean = validateScopes(scopes);
      JSONObject next = new JSONObject(records.toString());
      next.getJSONObject(key).put("scopes", clean);
      persist(next);
    } catch (SecurityException | IllegalStateException failure) {
      throw failure;
    } catch (Exception failure) {
      throw new IllegalArgumentException("Invalid caller or scopes", failure);
    }
  }

  static JSONObject validateScopes(JSONObject scopes) throws Exception {
    JSONObject clean = new JSONObject();
    java.util.Iterator<String> domains = scopes.keys();
    while (domains.hasNext()) {
      String domain = domains.next();
      if (!DOMAINS.contains(domain)) throw new IllegalArgumentException("Unknown data scope");
      JSONObject value = scopes.getJSONObject(domain);
      java.util.Iterator<String> fields = value.keys();
      while (fields.hasNext()) {
        String field = fields.next();
        if (!Arrays.asList("read", "write", "delete").contains(field)
            || !(value.get(field) instanceof Boolean))
          throw new IllegalArgumentException("Invalid scope permission");
      }
      boolean read = value.optBoolean("read", false),
          write = value.optBoolean("write", false),
          delete = value.optBoolean("delete", false);
      if ((write || delete) && !read)
        throw new IllegalArgumentException("Reading must be granted before mutations");
      if (read)
        clean.put(
            domain, new JSONObject().put("read", true).put("write", write).put("delete", delete));
    }
    return clean;
  }

  public synchronized void revoke(String key, long expectedRevision) {
    load();
    if (expectedRevision != revision)
      throw new IllegalStateException("Authorization changed; refresh and try again");
    try {
      JSONObject next = new JSONObject(records.toString());
      next.remove(key);
      persist(next);
    } catch (Exception failure) {
      throw new IllegalStateException(failure);
    }
  }

  public synchronized JSONObject accessStatus(Caller caller) {
    load();
    verify(caller);
    try {
      JSONObject record = records.optJSONObject(caller.key);
      JSONObject scopes = record == null ? null : record.optJSONObject("scopes");
      JSONObject permissions = new JSONObject();
      for (String domain : DOMAINS) {
        JSONObject grant = scopes == null ? null : scopes.optJSONObject(domain);
        JSONObject allowed = new JSONObject();
        for (String mode : Arrays.asList("read", "write", "delete"))
          allowed.put(mode, grant != null && grant.optBoolean(mode, false));
        permissions.put(domain, allowed);
      }
      return new JSONObject().put("domainPermissions", permissions);
    } catch (Exception failure) {
      throw new IllegalStateException(failure);
    }
  }

  public synchronized Set<String> grantedDomains(Caller caller, String access) {
    load();
    verify(caller);
    if (!Arrays.asList("read", "write", "delete").contains(access))
      throw new SecurityException("Unknown access mode");
    JSONObject record = records.optJSONObject(caller.key);
    JSONObject scopes = record == null ? null : record.optJSONObject("scopes");
    Set<String> result = new HashSet<>();
    if (scopes != null)
      for (String domain : DOMAINS) {
        JSONObject grant = scopes.optJSONObject(domain);
        if (grant != null && grant.optBoolean(access, false)) result.add(domain);
      }
    return java.util.Collections.unmodifiableSet(result);
  }

  public synchronized Lease authorize(Caller caller, Collection<String> domains, String access) {
    load();
    verify(caller);
    if (!Arrays.asList("read", "write", "delete").contains(access))
      throw new SecurityException("Unknown access mode");
    if (domains == null) throw new SecurityException("Missing scope contract");
    JSONObject record = records.optJSONObject(caller.key);
    JSONObject scopes = record == null ? null : record.optJSONObject("scopes");
    if (scopes == null || scopes.length() == 0)
      throw new SecurityException("Caller is not authorized");
    for (String domain : domains) {
      JSONObject grant = scopes.optJSONObject(domain);
      if (!DOMAINS.contains(domain) || grant == null || !grant.optBoolean(access, false))
        throw new SecurityException("Caller lacks " + access + " access to " + domain);
    }
    return new Lease(caller, new HashSet<>(domains), access, revision);
  }

  public final class Lease {
    public final Caller caller;
    private final Set<String> domains;
    private final String access;
    private final long grantedRevision;

    private Lease(Caller caller, Set<String> domains, String access, long revision) {
      this.caller = caller;
      this.domains = domains;
      this.access = access;
      this.grantedRevision = revision;
    }

    public void check() {
      synchronized (ProviderAccessStore.this) {
        load();
        if (revision != grantedRevision)
          throw new SecurityException("Authorization changed while request was pending");
        authorize(caller, domains, access);
      }
    }

    /** Revocation and database commit have one ordering point. */
    public void commitGuard(Runnable commit) {
      synchronized (ProviderAccessStore.this) {
        check();
        commit.run();
      }
    }
  }
}
