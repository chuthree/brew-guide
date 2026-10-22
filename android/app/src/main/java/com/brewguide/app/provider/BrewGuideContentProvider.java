package com.brewguide.app.provider;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.Binder;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;
import org.json.JSONArray;
import org.json.JSONObject;

/** Android IPC transport for the shared business engine. Public versioned contract: /v1. */
public final class BrewGuideContentProvider extends ContentProvider {
  public static final String AUTHORITY = "com.brewguide.app.data";
  public static final Uri ROOT = Uri.parse("content://" + AUTHORITY + "/v1");
  private static final int MAX_ARGUMENT_BYTES = 512 * 1024;
  private static final Set<String> DOMAINS =
      new HashSet<>(Arrays.asList("brewing", "beans", "notes", "settings"));
  private static final Map<String, String> COLLECTIONS = new HashMap<>();

  static {
    COLLECTIONS.put("beans", "list_beans");
    COLLECTIONS.put("notes", "list_brew_notes");
    COLLECTIONS.put("equipment", "list_equipment");
    COLLECTIONS.put("methods", "list_method");
    COLLECTIONS.put("grinders", "list_grinder");
  }

  private final ExecutorService worker =
      new ThreadPoolExecutor(
          1,
          1,
          0,
          TimeUnit.MILLISECONDS,
          new ArrayBlockingQueue<>(32),
          r -> new Thread(r, "BrewGuideProvider"),
          new ThreadPoolExecutor.AbortPolicy());
  private ProviderRuntime runtime;
  private JSONArray catalog;
  private long runtimeEpoch = -1;
  private final Object previewLock = new Object();
  private final ConcurrentHashMap<String, CompletableFuture<Void>> uploads =
      new ConcurrentHashMap<>();
  private final ExecutorService streams =
      new ThreadPoolExecutor(
          2,
          2,
          0,
          TimeUnit.MILLISECONDS,
          new ArrayBlockingQueue<>(4),
          r -> new Thread(r, "BrewGuideAsset"),
          new ThreadPoolExecutor.AbortPolicy());

  @Override
  public boolean onCreate() {
    return true;
  } // No database, JS engine, Activity or WebView initialization here.

  @Override
  public Bundle call(String method, String arg, Bundle extras) {
    ProviderAccessStore access = ProviderAccessStore.get(appContext());
    ProviderAccessStore.Caller caller = access.captureCaller(Binder.getCallingUid());
    try {
      if ("get_access_status".equals(method)) {
        if (arg != null) throw new IllegalArgumentException("Use extras.arguments, not arg");
        JSONObject args = arguments(extras == null ? null : extras.getString("arguments"));
        if (args.length() != 0)
          throw new IllegalArgumentException("get_access_status has no arguments");
        return response(
            new JSONObject().put("ok", true).put("result", access.accessStatus(caller)));
      }
      if ("request_access".equals(method)) {
        if (arg != null) throw new IllegalArgumentException("Use extras.arguments, not arg");
        JSONObject args = arguments(extras == null ? null : extras.getString("arguments"));
        if (args.length() != 1 || !(args.opt("scopes") instanceof JSONObject))
          throw new IllegalArgumentException("request_access accepts only scopes");
        JSONObject request =
            access.createAuthorizationRequest(caller, args.getJSONObject("scopes"));
        Bundle result =
            response(
                new JSONObject()
                    .put("requestId", request.getString("requestId"))
                    .put("status", request.getString("status"))
                    .put("expiresAt", request.getLong("expiresAt"))
                    .put("contractVersion", 1));
        // PendingIntent must be created under Brew Guide's own identity, not delegated Binder UID.
        long identity = Binder.clearCallingIdentity();
        try {
          result.putParcelable(
              "authorizationIntent",
              ProviderAuthorizationFlow.intent(appContext(), request.getString("requestId")));
        } finally {
          Binder.restoreCallingIdentity(identity);
        }
        return result;
      }
      JSONObject arguments = arguments(extras == null ? null : extras.getString("arguments"));
      if (arg != null) throw new IllegalArgumentException("Use extras.arguments, not arg");
      JSONObject result = run(caller, method, arguments, null);
      if (Arrays.asList("get_bean_image", "get_brew_note_image", "get_roaster_logo")
          .contains(method)) {
        JSONObject body = result.optJSONObject("result");
        if (body == null) body = result;
        JSONObject image = body.optJSONObject("image");
        if (image != null && (image.has("dataUrl") || image.has("blob"))) {
          image.remove("dataUrl");
          image.remove("blob");
          Uri imageUri =
              ROOT.buildUpon()
                  .appendPath("images")
                  .appendPath(
                      ProviderRuntime.hex(
                          MessageDigest.getInstance("SHA-256")
                              .digest((method + arguments).getBytes(StandardCharsets.UTF_8))))
                  .appendQueryParameter("method", method)
                  .appendQueryParameter("arguments", arguments.toString())
                  .build();
          image.put("contentUri", imageUri.toString());
        }
      }
      return response(result);
    } catch (SecurityException denied) {
      return error("PERMISSION_DENIED", denied.getMessage());
    } catch (Exception failure) {
      return failure(failure);
    }
  }

  @Override
  public Cursor query(
      Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) {
    return query(uri, projection, selection, selectionArgs, sortOrder, null);
  }

  @Override
  public Cursor query(
      Uri uri,
      String[] projection,
      String selection,
      String[] selectionArgs,
      String sortOrder,
      CancellationSignal signal) {
    if (selection != null || selectionArgs != null || sortOrder != null)
      throw new IllegalArgumentException(
          "Raw SQL is not supported; use documented query parameters");
    List<String> path = checkedPath(uri);
    if (path.size() < 2 || path.size() > 3)
      throw new IllegalArgumentException("Expected /v1/{collection} or /v1/query/{read_method}");
    String method =
        path.get(1).equals("query") && path.size() == 3
            ? path.get(2)
            : COLLECTIONS.get(path.get(1));
    if (method == null) throw new IllegalArgumentException("Unknown collection");
    if (Arrays.asList("get_bean_image", "get_brew_note_image", "get_roaster_logo").contains(method))
      throw new IllegalArgumentException("Use call to obtain an image content URI");
    try {
      JSONObject args = arguments(uri.getQueryParameter("arguments"));
      for (String key : uri.getQueryParameterNames()) {
        if (key.equals("arguments")) continue;
        if (key.equals("limit") || key.equals("offset"))
          args.put(key, Integer.parseInt(uri.getQueryParameter(key)));
        else throw new IllegalArgumentException("Unknown query parameter");
      }
      ProviderAccessStore.Caller caller =
          ProviderAccessStore.get(appContext()).captureCaller(Binder.getCallingUid());
      JSONObject result = run(caller, method, args, signal, true);
      if (!result.optBoolean("ok", true)) throw new IllegalArgumentException(result.toString());
      Object value = result.has("result") ? result.get("result") : result;
      JSONObject body =
          value instanceof JSONObject ? (JSONObject) value : new JSONObject().put("items", value);
      JSONArray items = body.optJSONArray("items");
      if (items == null) items = new JSONArray().put(body);
      LinkedHashSet<String> columns =
          new LinkedHashSet<>(Arrays.asList("_id", "id", "version", "record_json"));
      for (int i = 0; i < items.length(); i++) {
        JSONObject item = items.optJSONObject(i);
        if (item == null) continue;
        Iterator<String> keys = item.keys();
        while (keys.hasNext()) {
          String key = keys.next();
          Object v = item.opt(key);
          if (v == JSONObject.NULL
              || v instanceof String
              || v instanceof Number
              || v instanceof Boolean) columns.add(key);
        }
      }
      String[] selected = projection == null ? columns.toArray(new String[0]) : projection;
      for (String column : selected)
        if (!columns.contains(column))
          throw new IllegalArgumentException("Unknown projection column: " + column);
      MatrixCursor cursor = new MatrixCursor(selected, items.length());
      for (int i = 0; i < items.length(); i++) {
        JSONObject item = items.optJSONObject(i);
        if (item == null) item = new JSONObject().put("value", items.get(i));
        Object[] row = new Object[selected.length];
        for (int n = 0; n < selected.length; n++) {
          String key = selected[n];
          Object v =
              key.equals("_id") ? i : key.equals("record_json") ? item.toString() : item.opt(key);
          row[n] = v == JSONObject.NULL ? null : v instanceof Boolean ? ((Boolean) v ? 1 : 0) : v;
        }
        cursor.addRow(row);
      }
      Bundle metadata = new Bundle();
      metadata.putInt("contractVersion", 1);
      JSONObject page = new JSONObject();
      Iterator<String> metadataKeys = body.keys();
      while (metadataKeys.hasNext()) {
        String key = metadataKeys.next();
        if (!key.equals("items")) page.put(key, body.get(key));
      }
      // Cursor rows use the platform window transport; never duplicate all rows in Binder extras.
      metadata.putString("page", page.toString());
      cursor.setExtras(metadata);
      cursor.setNotificationUri(appContext().getContentResolver(), ROOT);
      return cursor;
    } catch (SecurityException | IllegalArgumentException failure) {
      throw failure;
    } catch (Exception failure) {
      throw new IllegalStateException("Provider query failed", failure);
    }
  }

  private JSONObject run(
      ProviderAccessStore.Caller caller, String method, JSONObject args, CancellationSignal signal)
      throws Exception {
    return run(caller, method, args, signal, false);
  }

  private JSONObject run(
      ProviderAccessStore.Caller caller,
      String method,
      JSONObject args,
      CancellationSignal signal,
      boolean readOnly)
      throws Exception {
    if (signal != null) signal.throwIfCanceled();
    ProviderAccessStore.get(appContext()).authorize(caller, Collections.emptySet(), "read").check();
    Future<JSONObject> future =
        worker.submit(
            () -> {
              if (signal != null) signal.throwIfCanceled();
              ProviderDatabase db = ProviderDatabase.get(appContext());
              String owner = "provider:" + UUID.randomUUID();
              try (AutoCloseable held = db.acquire(owner, 30000)) {
                if (runtime == null || runtimeEpoch != db.epoch()) {
                  runtime = new ProviderRuntime(appContext());
                  runtimeEpoch = db.epoch();
                }
                if (catalog == null)
                  catalog = new JSONArray(runtime.invoke("catalog", owner, null));
                JSONObject definition = null;
                for (int i = 0; i < catalog.length(); i++)
                  if (method.equals(catalog.getJSONObject(i).getString("name"))) {
                    definition = catalog.getJSONObject(i);
                    break;
                  }
                if (definition == null)
                  throw new IllegalArgumentException(
                      "UNKNOWN_METHOD: unsupported business operation");
                JSONObject meta = definition.optJSONObject("_meta");
                String mode =
                    meta == null
                        ? definition.optString("access", "read")
                        : meta.optString("brewGuide/access", "read");
                if (readOnly && !mode.equals("read"))
                  throw new SecurityException("query only accepts read methods");
                Set<String> domains = requiredDomains(definition, method, args);
                ProviderAccessStore accessStore = ProviderAccessStore.get(appContext());
                if (domains.isEmpty()) domains.addAll(accessStore.grantedDomains(caller, "read"));
                ProviderAccessStore.Lease authorization =
                    ProviderAccessStore.get(appContext()).authorize(caller, domains, "read");
                authorization.check();
                String primary =
                    meta == null
                        ? definition.optString("domain")
                        : meta.optString("brewGuide/domain");
                if (DOMAINS.contains(primary))
                  accessStore.authorize(caller, Collections.singleton(primary), mode).check();
                runtime.setAccessContext(caller, primary, mode);
                Set<String> readable = accessStore.grantedDomains(caller, "read");
                JSONObject selection = args.optJSONObject("note");
                if (selection == null) selection = args.optJSONObject("changes");
                if (selection != null
                    && (selection.has("equipmentId")
                        || selection.has("methodId")
                        || selection.optBoolean("applyMethodPreset")))
                  accessStore.authorize(caller, Collections.singleton("brewing"), "read").check();
                boolean capabilities = method.equals("get_capabilities");
                JSONObject permissions = accessStore.accessStatus(caller);
                JSONObject bound = new JSONObject(args.toString());
                if (bound.has("requestId")
                    && (!(bound.get("requestId") instanceof String)
                        || bound.getString("requestId").length() < 8
                        || bound.getString("requestId").length() > 128))
                  throw new IllegalArgumentException("requestId must contain 8 to 128 characters");
                if (bound.has("requestId"))
                  bound.put(
                      "requestId",
                      namespace(caller)
                          + ":"
                          + ProviderRuntime.hex(
                              MessageDigest.getInstance("SHA-256")
                                  .digest(
                                      bound
                                          .getString("requestId")
                                          .getBytes(StandardCharsets.UTF_8))));
                runtime.setCallerNamespace(namespace(caller));
                runtime.setRequestBinding(null, null);
                JSONObject initialized =
                    new JSONObject(runtime.invoke("initialize", owner, authorization));
                if (!initialized.optBoolean("ok")) {
                  runtime = null;
                  return initialized;
                }
                String requestKey = bound.optString("requestId", null);
                String originalHash =
                    ProviderRuntime.hex(
                        MessageDigest.getInstance("SHA-256")
                            .digest(canonical(args).getBytes(StandardCharsets.UTF_8)));
                if (requestKey != null) {
                  JSONObject replay =
                      replay(db, owner, requestKey, originalHash, method, caller, accessStore);
                  if (replay != null) {
                    restoreRequestId(replay, args.getString("requestId"));
                    authorization.check();
                    return replay;
                  }
                }
                checkConfirmation(caller, args);
                expandUploads(caller, bound);
                runtime.setRequestBinding(requestKey, originalHash);
                JSONObject result =
                    new JSONObject(
                        runtime.invoke(
                            "execute",
                            owner,
                            authorization,
                            method,
                            bound.toString(),
                            permissions.toString()));
                if (capabilities && result.optBoolean("ok"))
                  projectCapabilities(result.getJSONObject("result"), caller, accessStore);
                runtime.setRequestBinding(null, null);
                if (result.optJSONObject("error") != null
                    && "RUNTIME_INCOMPLETE"
                        .equals(result.getJSONObject("error").optString("code"))) {
                  db.rollback(owner);
                  runtime = null;
                  return result;
                }
                authorization.check();
                bindConfirmations(caller, result);
                if (args.has("requestId")) restoreRequestId(result, args.getString("requestId"));
                if (!mode.equals("read") && result.optBoolean("ok", true))
                  appContext().getContentResolver().notifyChange(ROOT, null);
                return result;
              } catch (Exception failure) {
                runtime = null;
                throw failure;
              }
            });
    if (signal != null) signal.setOnCancelListener(() -> future.cancel(true));
    try {
      return future.get(45, TimeUnit.SECONDS);
    } catch (TimeoutException error) {
      future.cancel(true);
      throw new IllegalStateException(
          "REQUEST_TIMEOUT: outcome may be committed; retry the identical requestId", error);
    } catch (ExecutionException error) {
      Throwable cause = error.getCause();
      if (cause instanceof Exception) throw (Exception) cause;
      throw error;
    } finally {
      if (signal != null) signal.setOnCancelListener(null);
    }
  }

  private Set<String> requiredDomains(JSONObject definition, String method, JSONObject args)
      throws Exception {
    Set<String> domains = new HashSet<>();
    JSONArray declared = definition.optJSONArray("requiredDomains");
    if (declared != null)
      for (int i = 0; i < declared.length(); i++) domains.add(declared.getString(i));
    JSONObject meta = definition.optJSONObject("_meta");
    String primary =
        meta == null ? definition.optString("domain") : meta.optString("brewGuide/domain");
    if (DOMAINS.contains(primary)) domains.add(primary);
    if (method.equals("preview_delete")) {
      domains.add(args.optString("entity").startsWith("bean") ? "beans" : "notes");
      if (args.optString("entity").equals("bean") || args.optString("entity").equals("brew_note")) {
        domains.add("beans");
        domains.add("notes");
      }
    }
    if (method.contains("roasting") || method.contains("convert_roasted")) {
      domains.add("beans");
      domains.add("notes");
    }
    if (method.equals("rename_roaster")
        || method.equals("preview_roaster_rename")
        || method.contains("convert_roasted"))
      domains.addAll(Arrays.asList("settings", "beans", "notes"));
    boolean changesNote =
        method.equals("create_brew_note")
            || method.equals("update_brew_note")
            || method.equals("delete_brew_note");
    if (changesNote || method.contains("capacity_adjustment")) {
      domains.add("notes");
      domains.add("beans");
    }
    if (method.equals("adjust_bean_inventory") || method.equals("delete_bean"))
      domains.add("notes");
    JSONObject selection = args.optJSONObject("note");
    if (selection == null) selection = args.optJSONObject("changes");
    if (selection != null) {
      JSONObject params = selection.optJSONObject("params");
      if (params != null && params.has("grindSize")) domains.add("settings");
    }
    if (args.has("grinderId") || args.has("grinder")) domains.add("settings");
    if (args.has("equipmentId") || args.has("methodId")) domains.add("brewing");
    // Core metadata/activity is visible only to an explicitly authorized client.

    return domains;
  }

  private JSONObject replay(
      ProviderDatabase db,
      String owner,
      String requestId,
      String hash,
      String method,
      ProviderAccessStore.Caller caller,
      ProviderAccessStore access)
      throws Exception {
    if (db.query(
                owner,
                "SELECT name FROM sqlite_master WHERE type='table' AND name='provider_requests'",
                new JSONArray())
            .length()
        == 0) return null;
    boolean hasResultDomains = false;
    JSONArray columns = db.query(owner, "PRAGMA table_info(mcp_operations)", new JSONArray());
    for (int i = 0; i < columns.length(); i++)
      if ("result_domains_json".equals(columns.getJSONObject(i).getString("name")))
        hasResultDomains = true;
    JSONArray rows =
        db.query(
            owner,
            "SELECT p.original_args_hash, m.tool, m.result_json, "
                + (hasResultDomains ? "m.result_domains_json" : "NULL AS result_domains_json")
                + " FROM provider_requests p JOIN"
                + " mcp_operations m ON m.request_id=p.request_id WHERE p.request_id=?",
            new JSONArray().put(requestId));
    if (rows.length() == 0) return null;
    JSONObject row = rows.getJSONObject(0);
    if (!hash.equals(row.getString("original_args_hash")) || !method.equals(row.getString("tool")))
      return new JSONObject()
          .put("ok", false)
          .put(
              "error",
              new JSONObject()
                  .put("code", "IDEMPOTENCY_CONFLICT")
                  .put("message", "requestId was used with different arguments"));
    // Cached output may contain cross-domain objects even though this retry performs no writes.
    // Missing legacy metadata fails closed; never re-execute a committed mutation.
    access.authorizeCachedResult(caller, row.opt("result_domains_json"));
    JSONObject result =
        new JSONObject(row.getString("result_json"))
            .put("requestId", requestId)
            .put("replayed", true);
    return new JSONObject().put("ok", true).put("result", result);
  }

  private void projectCapabilities(
      JSONObject result, ProviderAccessStore.Caller caller, ProviderAccessStore access)
      throws Exception {
    Set<String> read = access.grantedDomains(caller, "read"),
        edit = access.grantedDomains(caller, "write");
    result.put("scopes", access.accessStatus(caller).getJSONObject("scopes"));
    JSONArray exposed = new JSONArray();
    for (int i = 0; i < catalog.length(); i++) {
      JSONObject definition = catalog.getJSONObject(i);
      String name = definition.getString("name");
      String mode = definition.getJSONObject("_meta").getString("brewGuide/access");
      Set<String> required = requiredDomains(definition, name, new JSONObject());
      Set<String> allowed = mode.equals("read") ? read : edit;
      if (name.equals("preview_delete")) {
        if (!read.contains("beans") && !read.contains("notes")) continue;
      } else if (!read.containsAll(required)) continue;
      String primary = definition.getJSONObject("_meta").optString("brewGuide/domain");
      if (DOMAINS.contains(primary) && !allowed.contains(primary)) continue;
      exposed.put(
          new JSONObject()
              .put("name", name)
              .put("readOnly", mode.equals("read"))
              .put("access", mode)
              .put("inputSchema", definition.get("inputSchema")));
    }
    result.put("tools", exposed);
  }

  private static String canonical(Object value) throws Exception {
    if (value instanceof JSONObject) {
      JSONObject object = (JSONObject) value;
      List<String> keys = new ArrayList<>();
      Iterator<String> it = object.keys();
      while (it.hasNext()) keys.add(it.next());
      Collections.sort(keys);
      StringBuilder out = new StringBuilder("{");
      for (String key : keys) {
        if (out.length() > 1) out.append(',');
        out.append(JSONObject.quote(key)).append(':').append(canonical(object.get(key)));
      }
      return out.append('}').toString();
    }
    if (value instanceof JSONArray) {
      StringBuilder out = new StringBuilder("[");
      JSONArray array = (JSONArray) value;
      for (int i = 0; i < array.length(); i++) {
        if (i > 0) out.append(',');
        out.append(canonical(array.get(i)));
      }
      return out.append(']').toString();
    }
    if (value instanceof Number)
      return new java.math.BigDecimal(value.toString()).stripTrailingZeros().toPlainString();
    return value instanceof String ? JSONObject.quote((String) value) : String.valueOf(value);
  }

  private static JSONObject arguments(String json) throws Exception {
    if (json == null) return new JSONObject();
    if (json.getBytes(StandardCharsets.UTF_8).length > MAX_ARGUMENT_BYTES)
      throw new IllegalArgumentException(
          "Arguments exceed 512 KiB; use an upload URI for image data");
    return new JSONObject(json);
  }

  private android.content.Context appContext() {
    if (getContext() == null) throw new IllegalStateException("Provider unavailable");
    return getContext();
  }

  private static List<String> checkedPath(Uri uri) {
    if (!AUTHORITY.equals(uri.getAuthority())
        || !"content".equals(uri.getScheme())
        || uri.getPathSegments().isEmpty()
        || !"v1".equals(uri.getPathSegments().get(0)))
      throw new IllegalArgumentException("Unknown Provider URI");
    return uri.getPathSegments();
  }

  private static Bundle response(JSONObject value) {
    Bundle out = new Bundle();
    out.putInt("contractVersion", 1);
    out.putString("result", value.toString());
    return out;
  }

  private static Bundle error(String code, String message) {
    try {
      return response(
          new JSONObject()
              .put("ok", false)
              .put(
                  "error",
                  new JSONObject()
                      .put("code", code)
                      .put("message", message == null ? code : message)));
    } catch (Exception impossible) {
      throw new IllegalStateException(impossible);
    }
  }

  private static Bundle failure(Exception error) {
    String message = error.getMessage();
    return error(
        error instanceof IllegalArgumentException
            ? "INVALID_ARGUMENT"
            : message != null && message.contains("TIMEOUT")
                ? "REQUEST_TIMEOUT"
                : "OPERATION_FAILED",
        message);
  }

  private String namespace(ProviderAccessStore.Caller caller) throws Exception {
    return ProviderRuntime.hex(
            MessageDigest.getInstance("SHA-256")
                .digest(caller.key.getBytes(StandardCharsets.UTF_8)))
        .substring(0, 32);
  }

  private File previewFile() {
    return new File(appContext().getNoBackupFilesDir(), "provider-preview-bindings.json");
  }

  private JSONObject previews() throws Exception {
    File file = previewFile();
    return file.exists()
        ? new JSONObject(
            new String(ProviderRuntime.readBounded(file, 256 * 1024), StandardCharsets.UTF_8))
        : new JSONObject();
  }

  private void checkConfirmation(ProviderAccessStore.Caller caller, JSONObject args)
      throws Exception {
    if (!args.has("confirmationToken")) return;
    synchronized (previewLock) {
      JSONObject entry = previews().optJSONObject(args.getString("confirmationToken"));
      if (entry == null || !namespace(caller).equals(entry.optString("caller")))
        throw new SecurityException("Confirmation belongs to another caller or is unknown");
    }
  }

  private void bindConfirmations(ProviderAccessStore.Caller caller, Object value) throws Exception {
    if (value instanceof JSONObject) {
      JSONObject object = (JSONObject) value;
      if (object.has("confirmationToken"))
        synchronized (previewLock) {
          JSONObject all = previews();
          List<String> expired = new ArrayList<>();
          Iterator<String> keys = all.keys();
          while (keys.hasNext()) {
            String key = keys.next();
            if (all.getJSONObject(key).optLong("at") < System.currentTimeMillis() - 86400000)
              expired.add(key);
          }
          for (String key : expired) all.remove(key);
          if (all.length() > 1000)
            throw new IllegalStateException("Too many pending confirmations");
          all.put(
              object.getString("confirmationToken"),
              new JSONObject()
                  .put("caller", namespace(caller))
                  .put("at", System.currentTimeMillis()));
          android.util.AtomicFile file = new android.util.AtomicFile(previewFile());
          FileOutputStream stream = file.startWrite();
          try {
            stream.write(all.toString().getBytes(StandardCharsets.UTF_8));
            file.finishWrite(stream);
          } catch (Exception error) {
            file.failWrite(stream);
            throw error;
          }
        }
      Iterator<String> keys = object.keys();
      while (keys.hasNext()) bindConfirmations(caller, object.get(keys.next()));
    } else if (value instanceof JSONArray)
      for (int i = 0; i < ((JSONArray) value).length(); i++)
        bindConfirmations(caller, ((JSONArray) value).get(i));
  }

  private void restoreRequestId(JSONObject value, String original) throws Exception {
    if (value.has("requestId")) value.put("requestId", original);
    if (value.opt("result") instanceof JSONObject)
      restoreRequestId(value.getJSONObject("result"), original);
  }

  // Upload and managed image stream implementation is below; no arbitrary file paths are exposed.
  private void expandUploads(ProviderAccessStore.Caller caller, Object value) throws Exception {
    if (value instanceof JSONObject) {
      JSONObject object = (JSONObject) value;
      Iterator<String> iterator = object.keys();
      List<String> keys = new ArrayList<>();
      while (iterator.hasNext()) keys.add(iterator.next());
      for (String key : keys) {
        Object child = object.get(key);
        if (child instanceof String
            && ((String) child).startsWith("content://" + AUTHORITY + "/v1/uploads/"))
          object.put(key, uploadData(caller, Uri.parse((String) child)));
        else expandUploads(caller, child);
      }
    } else if (value instanceof JSONArray) {
      JSONArray array = (JSONArray) value;
      for (int i = 0; i < array.length(); i++) {
        Object child = array.get(i);
        if (child instanceof String
            && ((String) child).startsWith("content://" + AUTHORITY + "/v1/uploads/"))
          array.put(i, uploadData(caller, Uri.parse((String) child)));
        else expandUploads(caller, child);
      }
    }
  }

  private File uploadDirectory(ProviderAccessStore.Caller caller) throws Exception {
    File dir = new File(appContext().getCacheDir(), "provider-uploads/" + namespace(caller));
    if (!dir.isDirectory() && !dir.mkdirs()) throw new IOException("Upload storage unavailable");
    return dir;
  }

  private File uploadFile(ProviderAccessStore.Caller caller, Uri uri) throws Exception {
    List<String> p = checkedPath(uri);
    if (p.size() != 3 || !p.get(1).equals("uploads") || !p.get(2).matches("[0-9a-f-]{36}"))
      throw new FileNotFoundException("Invalid upload URI");
    return new File(uploadDirectory(caller), p.get(2));
  }

  private String uploadData(ProviderAccessStore.Caller caller, Uri uri) throws Exception {
    File file = uploadFile(caller, uri);
    CompletableFuture<Void> pending = uploads.get(file.getPath());
    if (pending != null) pending.get(15, TimeUnit.SECONDS);
    if (!new File(file.getPath() + ".complete").isFile()
        || file.lastModified() < System.currentTimeMillis() - 3600000)
      throw new IOException("Upload incomplete or expired");
    byte[] bytes = ProviderRuntime.readBounded(file, 8 * 1024 * 1024);
    String mime =
        new String(
            ProviderRuntime.readBounded(new File(file.getPath() + ".mime"), 100),
            StandardCharsets.UTF_8);
    return "data:"
        + mime
        + ";base64,"
        + android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP);
  }

  @Override
  public Uri insert(Uri uri, ContentValues values) {
    List<String> p = checkedPath(uri);
    if (p.size() != 2 || !p.get(1).equals("uploads"))
      throw new UnsupportedOperationException("Use named call methods for business writes");
    try {
      ProviderAccessStore access = ProviderAccessStore.get(appContext());
      ProviderAccessStore.Caller caller = access.captureCaller(Binder.getCallingUid());
      String domain = values == null ? "" : values.getAsString("domain");
      access.authorize(caller, Collections.singleton(domain), "write").check();
      String mime = values.getAsString("mime_type");
      if (!Arrays.asList("image/png", "image/jpeg", "image/webp").contains(mime))
        throw new IllegalArgumentException("Unsupported raster format");
      File dir = uploadDirectory(caller);
      File[] existing = dir.listFiles();
      if (existing != null)
        for (File item : existing)
          if (item.lastModified() < System.currentTimeMillis() - 3600000) item.delete();
      if (dir.list() != null && dir.list().length >= 80)
        throw new IllegalStateException("Too many uploads");
      String id = UUID.randomUUID().toString();
      File file = new File(dir, id);
      if (!file.createNewFile()) throw new IOException("Upload creation failed");
      try (FileOutputStream out = new FileOutputStream(new File(dir, id + ".mime"))) {
        out.write(mime.getBytes(StandardCharsets.UTF_8));
      }
      try (FileOutputStream out = new FileOutputStream(new File(dir, id + ".scope"))) {
        out.write(domain.getBytes(StandardCharsets.UTF_8));
      }
      return ROOT.buildUpon().appendPath("uploads").appendPath(id).build();
    } catch (RuntimeException error) {
      throw error;
    } catch (Exception error) {
      throw new IllegalStateException(error);
    }
  }

  @Override
  public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
    try {
      List<String> path = checkedPath(uri);
      ProviderAccessStore access = ProviderAccessStore.get(appContext());
      ProviderAccessStore.Caller caller = access.captureCaller(Binder.getCallingUid());
      if (path.size() == 3 && path.get(1).equals("uploads")) {
        if (!mode.equals("w")) throw new FileNotFoundException("Upload URI is write-only");
        File destination = uploadFile(caller, uri);
        if (!destination.isFile()) throw new FileNotFoundException("Upload expired");
        String domain =
            new String(
                ProviderRuntime.readBounded(new File(destination.getPath() + ".scope"), 32),
                StandardCharsets.UTF_8);
        ProviderAccessStore.Lease uploadLease =
            access.authorize(caller, Collections.singleton(domain), "write");
        uploadLease.check();
        CompletableFuture<Void> completion = new CompletableFuture<>();
        File completed = new File(destination.getPath() + ".complete");
        if (completed.exists() || uploads.putIfAbsent(destination.getPath(), completion) != null)
          throw new IOException("Upload URI is single-use");
        if (completed.exists()) {
          uploads.remove(destination.getPath(), completion);
          throw new IOException("Upload URI is single-use");
        }
        ParcelFileDescriptor[] pipe;
        try {
          pipe = ParcelFileDescriptor.createReliablePipe();
        } catch (IOException failure) {
          uploads.remove(destination.getPath(), completion);
          completion.completeExceptionally(failure);
          throw failure;
        }
        try {
          streams.execute(
              () -> {
                try (InputStream in = new ParcelFileDescriptor.AutoCloseInputStream(pipe[0]);
                    FileOutputStream out = new FileOutputStream(destination)) {
                  byte[] buffer = new byte[8192];
                  int count, total = 0;
                  long expires = android.os.SystemClock.elapsedRealtime() + 30000;
                  while ((count = readStream(in, pipe[0], buffer, uploadLease, expires)) != -1) {
                    uploadLease.check();
                    total += count;
                    if (total > 8 * 1024 * 1024) throw new IOException("Upload exceeds 8MiB");
                    out.write(buffer, 0, count);
                  }
                  out.getFD().sync();
                  uploadLease.check();
                  if (!new File(destination.getPath() + ".complete").createNewFile())
                    throw new IOException("Upload finalization failed");
                  completion.complete(null);
                } catch (Exception error) {
                  destination.delete();
                  completion.completeExceptionally(error);
                } finally {
                  uploads.remove(destination.getPath(), completion);
                }
              });
        } catch (RejectedExecutionException error) {
          pipe[0].close();
          pipe[1].close();
          completion.completeExceptionally(error);
          uploads.remove(destination.getPath(), completion);
          throw error;
        }
        return pipe[1];
      }
      if (!mode.equals("r") || path.size() != 3 || !path.get(1).equals("images"))
        throw new FileNotFoundException("Unknown image URI");
      String method = uri.getQueryParameter("method");
      if (!Arrays.asList("get_bean_image", "get_brew_note_image", "get_roaster_logo")
          .contains(method)) throw new FileNotFoundException("Invalid image kind");
      JSONObject result =
          run(caller, method, arguments(uri.getQueryParameter("arguments")), null, true);
      JSONObject body = result.optJSONObject("result");
      if (body == null) body = result;
      JSONObject image = body.optJSONObject("image");
      if (image == null) throw new FileNotFoundException("Image absent");
      String data = image.optString("dataUrl");
      String base64 =
          data.isEmpty() ? image.optString("blob") : data.substring(data.indexOf(',') + 1);
      if (base64.isEmpty()) throw new FileNotFoundException("Image absent");
      byte[] bytes = android.util.Base64.decode(base64, android.util.Base64.DEFAULT);
      ProviderAccessStore.Lease imageLease =
          access.authorize(
              caller,
              Collections.singleton(
                  method.equals("get_bean_image")
                      ? "beans"
                      : method.equals("get_brew_note_image") ? "notes" : "settings"),
              "read");
      ParcelFileDescriptor[] pipe = ParcelFileDescriptor.createReliablePipe();
      try {
        streams.execute(
            () -> {
              try (OutputStream out = new ParcelFileDescriptor.AutoCloseOutputStream(pipe[1])) {
                long expires = android.os.SystemClock.elapsedRealtime() + 30000;
                int offset = 0;
                while (offset < bytes.length) {
                  imageLease.check();
                  if (!pollStream(pipe[1], android.system.OsConstants.POLLOUT, expires)) continue;
                  int count = Math.min(4096, bytes.length - offset);
                  out.write(bytes, offset, count);
                  offset += count;
                }
              } catch (Exception ignored) {
              }
            });
      } catch (RejectedExecutionException failure) {
        pipe[0].close();
        pipe[1].close();
        throw failure;
      }
      return pipe[0];
    } catch (Exception error) {
      FileNotFoundException failure = new FileNotFoundException(error.getMessage());
      failure.initCause(error);
      throw failure;
    }
  }

  private static int readStream(
      InputStream in,
      ParcelFileDescriptor descriptor,
      byte[] buffer,
      ProviderAccessStore.Lease lease,
      long expires)
      throws Exception {
    for (; ; ) {
      lease.check();
      if (pollStream(descriptor, android.system.OsConstants.POLLIN, expires))
        return in.read(buffer);
    }
  }

  private static boolean pollStream(ParcelFileDescriptor descriptor, int events, long expires)
      throws Exception {
    if (android.os.SystemClock.elapsedRealtime() > expires)
      throw new IOException("Asset stream timed out");
    android.system.StructPollfd poll = new android.system.StructPollfd();
    poll.fd = descriptor.getFileDescriptor();
    poll.events = (short) events;
    int ready = android.system.Os.poll(new android.system.StructPollfd[] {poll}, 250);
    if (ready == 0) return false;
    if ((poll.revents & android.system.OsConstants.POLLNVAL) != 0)
      throw new IOException("Asset descriptor closed");
    return true;
  }

  @Override
  public String getType(Uri uri) {
    List<String> path = checkedPath(uri);
    if (path.size() == 3 && path.get(1).equals("images")) {
      String method = uri.getQueryParameter("method");
      if (!Arrays.asList("get_bean_image", "get_brew_note_image", "get_roaster_logo")
          .contains(method)) throw new IllegalArgumentException("Invalid image kind");
      ProviderAccessStore.Caller caller =
          ProviderAccessStore.get(appContext()).captureCaller(Binder.getCallingUid());
      try {
        JSONObject result =
            run(caller, method, arguments(uri.getQueryParameter("arguments")), null, true);
        JSONObject body = result.optJSONObject("result");
        JSONObject image = body == null ? null : body.optJSONObject("image");
        if (image == null || (!image.has("dataUrl") && !image.has("blob"))) return null;
        String mime = image.optString("mimeType", "application/octet-stream");
        return Arrays.asList("image/jpeg", "image/png", "image/webp").contains(mime)
            ? mime
            : "application/octet-stream";
      } catch (SecurityException denied) {
        throw denied;
      } catch (Exception failure) {
        throw new IllegalStateException("Image metadata unavailable", failure);
      }
    }
    return "vnd.android.cursor.dir/vnd.com.brewguide.app.record";
  }

  @Override
  public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) {
    throw new UnsupportedOperationException("Use named version-checked call methods");
  }

  @Override
  public int delete(Uri uri, String selection, String[] selectionArgs) {
    throw new UnsupportedOperationException("Use preview and named confirmed delete methods");
  }
}
