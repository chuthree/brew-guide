package com.brewguide.app.provider;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;
import java.io.*;
import java.security.MessageDigest;
import java.security.SecureRandom;
import org.json.JSONArray;
import org.json.JSONObject;
import org.mozilla.javascript.BaseFunction;
import org.mozilla.javascript.ContextFactory;
import org.mozilla.javascript.Function;
import org.mozilla.javascript.Scriptable;
import org.mozilla.javascript.ScriptableObject;

/** Headless shared business code. No Activity, WebView, HTTP server or Java access. */
final class ProviderRuntime {
  private final Context app;
  private final ProviderDatabase database;
  private final SecureRandom random = new SecureRandom();
  private Scriptable scope;
  private String owner;
  private ProviderAccessStore.Lease authorization;
  private long deadline;
  private String callerNamespace = "";
  private ProviderAccessStore.Caller caller;
  private String primaryDomain;
  private String accessMode;

  void setAccessContext(ProviderAccessStore.Caller caller, String primary, String mode) {
    this.caller = caller;
    this.primaryDomain = primary;
    this.accessMode = mode;
  }

  private String requestId;
  private String originalArgsHash;

  void setRequestBinding(String id, String hash) {
    requestId = id;
    originalArgsHash = hash;
  }

  void setCallerNamespace(String value) {
    callerNamespace = value;
  }

  private final ContextFactory factory =
      new ContextFactory() {
        @Override
        protected org.mozilla.javascript.Context makeContext() {
          org.mozilla.javascript.Context cx = super.makeContext();
          cx.setOptimizationLevel(-1);
          cx.setLanguageVersion(org.mozilla.javascript.Context.VERSION_ES6);
          cx.setInstructionObserverThreshold(10000);
          cx.setClassShutter(name -> false);
          return cx;
        }

        @Override
        protected void observeInstructionCount(org.mozilla.javascript.Context cx, int count) {
          if (Thread.currentThread().isInterrupted() || System.nanoTime() > deadline)
            throw new IllegalStateException(
                "REQUEST_TIMEOUT: execution deadline exceeded; retry with the same requestId");
        }
      };

  ProviderRuntime(Context context) {
    app = context.getApplicationContext();
    database = ProviderDatabase.get(app);
  }

  String invoke(String method, String owner, ProviderAccessStore.Lease lease, String... args) {
    this.owner = owner;
    this.authorization = lease;
    deadline = System.nanoTime() + 30_000_000_000L;
    return factory.call(
        cx -> {
          try {
            if (scope == null) {
              scope = cx.initSafeStandardObjects();
              Scriptable host = cx.newObject(scope);
              ScriptableObject.putProperty(
                  host,
                  "call",
                  new BaseFunction() {
                    @Override
                    public Object call(
                        org.mozilla.javascript.Context current,
                        Scriptable s,
                        Scriptable self,
                        Object[] values) {
                      try {
                        String operation = org.mozilla.javascript.Context.toString(values[0]);
                        JSONObject payload =
                            new JSONObject(org.mozilla.javascript.Context.toString(values[1]));
                        return dispatch(operation, payload).toString();
                      } catch (Exception error) {
                        throw org.mozilla.javascript.Context.throwAsScriptRuntimeEx(error);
                      }
                    }
                  });
              ScriptableObject.putProperty(scope, "__brewHost", host);
              // Only a fixed, APK-signed asset is deserialized; IPC never supplies bytes,
              // class names or paths. Compiler and runtime pin the same Rhino version.
              try (ObjectInputStream input =
                  new ObjectInputStream(
                      new BufferedInputStream(app.getAssets().open("provider/business.bin")))) {
                if (!"BrewGuideProvider/Rhino-1.8.0/1".equals(input.readUTF()))
                  throw new IOException("Packaged interpreter version mismatch");
                if (!packagedSourceHash().equals(input.readUTF()))
                  throw new IOException("Packaged interpreter source mismatch");
                Object compiled = input.readObject();
                if (!(compiled instanceof org.mozilla.javascript.Script))
                  throw new IOException("Invalid packaged interpreter script");
                ((org.mozilla.javascript.Script) compiled).exec(cx, scope);
              } catch (ClassNotFoundException error) {
                throw new IOException("Packaged interpreter version mismatch", error);
              }
            }
            Scriptable api = (Scriptable) ScriptableObject.getProperty(scope, "BrewGuideProvider");
            Function function = (Function) ScriptableObject.getProperty(api, method);
            return org.mozilla.javascript.Context.toString(function.call(cx, scope, api, args));
          } catch (IOException error) {
            throw new IllegalStateException(
                "ENGINE_UNAVAILABLE: packaged business engine is missing", error);
          }
        });
  }

  private String packagedSourceHash() throws IOException {
    try {
      MessageDigest hash = MessageDigest.getInstance("SHA-256");
      try (InputStream source = app.getAssets().open("provider/business.js")) {
        byte[] buffer = new byte[8192];
        int count;
        while ((count = source.read(buffer)) != -1) hash.update(buffer, 0, count);
      }
      return hex(hash.digest());
    } catch (java.security.NoSuchAlgorithmException error) {
      throw new IOException("Required source integrity algorithm unavailable", error);
    }
  }

  private Object dispatch(String operation, JSONObject data) throws Exception {
    if (System.nanoTime() > deadline) throw new IllegalStateException("REQUEST_TIMEOUT");
    switch (operation) {
      case "permissions.checkChanges":
        {
          JSONArray changes = data.getJSONArray("changes");
          ProviderAccessStore store = ProviderAccessStore.get(app);
          for (int i = 0; i < changes.length(); i++) {
            JSONObject change = changes.getJSONObject(i);
            String entity = change.getString("entity");
            String domain;
            switch (entity) {
              case "bean":
              case "historical_report":
                domain = "beans";
                break;
              case "brew_note":
                domain = "notes";
                break;
              case "equipment":
              case "method":
                domain = "brewing";
                break;
              case "grinder":
                domain = "settings";
                break;
              case "settings":
                domain = "brewing".equals(primaryDomain) ? "brewing" : "settings";
                break;
              default:
                throw new SecurityException("Unknown mutation entity");
            }
            String mode =
                change.isNull("after")
                        || (domain.equals(primaryDomain) && "delete".equals(accessMode))
                    ? "delete"
                    : "write";
            store.authorize(caller, java.util.Collections.singleton(domain), mode).check();
          }
          return new JSONObject();
        }
      case "migration.canAdoptFresh":
        return database.canAdoptFreshStore();
      case "context.identity":
        return new JSONObject().put("namespace", callerNamespace);
      case "sql.query":
        return database.query(
            owner,
            data.getString("sql"),
            data.optJSONArray("params") == null ? new JSONArray() : data.getJSONArray("params"));
      case "sql.execute":
        if (authorization != null) authorization.check();
        return database.execute(
            owner,
            data.getString("sql"),
            data.optJSONArray("params") == null ? new JSONArray() : data.getJSONArray("params"));
      case "sql.begin":
        database.begin(owner);
        return new JSONObject();
      case "sql.commit":
        persistRequestBinding();
        if (authorization == null) database.commit(owner);
        else authorization.commitGuard(() -> database.commit(owner));
        return new JSONObject();
      case "sql.rollback":
        database.rollback(owner);
        return new JSONObject();
      case "crypto.sha256":
        return new JSONObject()
            .put(
                "hex",
                hex(
                    MessageDigest.getInstance("SHA-256")
                        .digest(Base64.decode(data.getString("bytesBase64"), Base64.DEFAULT))));
      case "crypto.random":
        {
          int length = data.getInt("length");
          if (length < 0 || length > 65536)
            throw new IllegalArgumentException("Invalid random length");
          byte[] bytes = new byte[length];
          random.nextBytes(bytes);
          JSONArray result = new JSONArray();
          for (byte b : bytes) result.put(b & 255);
          return new JSONObject().put("bytes", result);
        }
      case "files.read":
        return new JSONObject()
            .put(
                "base64",
                Base64.encodeToString(
                    readBounded(imageFile(data.getString("relativePath")), 16 * 1024 * 1024),
                    Base64.NO_WRAP));
      case "files.write":
        {
          if (authorization != null) authorization.check();
          File file = imageFile(data.getString("relativePath"));
          byte[] bytes = Base64.decode(data.getString("dataBase64"), Base64.DEFAULT);
          if (bytes.length > 16 * 1024 * 1024)
            throw new IllegalArgumentException("Image exceeds limit");
          if (!file.getParentFile().isDirectory() && !file.getParentFile().mkdirs())
            throw new IOException("Cannot create image storage");
          File temporary = new File(file.getParentFile(), file.getName() + ".tmp");
          try (FileOutputStream out = new FileOutputStream(temporary)) {
            out.write(bytes);
            out.getFD().sync();
          }
          if (!temporary.renameTo(file)) throw new IOException("Cannot publish image");
          return new JSONObject();
        }
      case "files.delete":
        {
          if (authorization != null) authorization.check();
          File file = imageFile(data.getString("relativePath"));
          if (file.exists() && !file.delete()) throw new IOException("Cannot remove image");
          return new JSONObject();
        }
      case "files.exists":
        return imageFile(data.getString("relativePath")).isFile();
      case "files.list":
        {
          File directory = new File(app.getFilesDir(), "images/v1/objects");
          JSONArray names = new JSONArray();
          File[] files = directory.listFiles();
          if (files != null)
            for (File file : files)
              if (file.isFile() && file.getName().matches("[A-Za-z0-9_-]{1,128}"))
                names.put(file.getName());
          return names;
        }
      case "files.stat":
        {
          File file = imageFile(data.getString("relativePath"));
          return new JSONObject().put("exists", file.isFile()).put("size", file.length());
        }
      case "images.process":
        return processImage(data);
      case "events.publish":
        database.publishChanges(owner, data.getJSONArray("changes"));
        return new JSONObject();
      default:
        throw new IllegalArgumentException("Unsupported host operation: " + operation);
    }
  }

  private void persistRequestBinding() throws Exception {
    if (requestId == null) return;
    JSONArray tables =
        database.query(
            owner,
            "SELECT name FROM sqlite_master WHERE type='table' AND name='mcp_operations'",
            new JSONArray());
    if (tables.length() == 0) return;
    JSONArray committed =
        database.query(
            owner,
            "SELECT request_id FROM mcp_operations WHERE request_id = ?",
            new JSONArray().put(requestId));
    if (committed.length() == 0) return;
    database.execute(
        owner,
        "CREATE TABLE IF NOT EXISTS provider_requests (request_id TEXT NOT NULL PRIMARY KEY,"
            + " original_args_hash TEXT NOT NULL)",
        new JSONArray());
    database.execute(
        owner,
        "INSERT OR IGNORE INTO provider_requests (request_id, original_args_hash) VALUES (?, ?)",
        new JSONArray().put(requestId).put(originalArgsHash));
  }

  private File imageFile(String path) throws IOException {
    if (!path.matches("images/v1/objects/[A-Za-z0-9_-]{1,128}"))
      throw new SecurityException("Invalid managed image path");
    // Capacitor Directory.Library maps to Context.getFilesDir() on Android.
    File root = app.getFilesDir().getCanonicalFile();
    File file = new File(root, path).getCanonicalFile();
    if (!file.getPath().startsWith(root.getPath() + File.separator))
      throw new SecurityException("Invalid image path");
    return file;
  }

  private JSONObject processImage(JSONObject data) throws Exception {
    String source = data.getString("dataUrl");
    if (!source.matches("(?s)^data:image/(png|jpeg|webp);base64,.*"))
      throw new IllegalArgumentException("Unsupported image");
    byte[] bytes = Base64.decode(source.substring(source.indexOf(',') + 1), Base64.DEFAULT);
    if (bytes.length > 8 * 1024 * 1024)
      throw new IllegalArgumentException("Image exceeds source limit");
    BitmapFactory.Options bounds = new BitmapFactory.Options();
    bounds.inJustDecodeBounds = true;
    BitmapFactory.decodeByteArray(bytes, 0, bytes.length, bounds);
    if (bounds.outWidth < 1
        || bounds.outHeight < 1
        || bounds.outWidth > 16384
        || bounds.outHeight > 16384
        || (long) bounds.outWidth * bounds.outHeight > 32_000_000L)
      throw new IllegalArgumentException("Invalid image dimensions");
    JSONObject options = data.optJSONObject("options");
    JSONObject compression = options == null ? null : options.optJSONObject("compression");
    if (compression == null) compression = options == null ? new JSONObject() : options;
    int max = Math.min(1200, Math.max(1, compression.optInt("maxWidthOrHeight", 1200)));
    int quality =
        (int)
            Math.round(
                Math.min(1, Math.max(0.1, compression.optDouble("initialQuality", .8))) * 100);
    int target = (int) (compression.optDouble("maxSizeMB", .1) * 1024 * 1024);
    // Decode near the final dimensions before EXIF transforms: a compressed 32MP image
    // must not allocate several full-resolution bitmaps in a cold background process.
    BitmapFactory.Options decode = new BitmapFactory.Options();
    decode.inSampleSize = 1;
    while (Math.max(bounds.outWidth, bounds.outHeight) / (decode.inSampleSize * 2) >= max)
      decode.inSampleSize *= 2;
    Bitmap bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length, decode);
    if (bitmap == null) throw new IllegalArgumentException("Image decode failed");
    try {
      androidx.exifinterface.media.ExifInterface exif =
          new androidx.exifinterface.media.ExifInterface(new ByteArrayInputStream(bytes));
      int orientation =
          exif.getAttributeInt(
              androidx.exifinterface.media.ExifInterface.TAG_ORIENTATION,
              androidx.exifinterface.media.ExifInterface.ORIENTATION_NORMAL);
      android.graphics.Matrix transform = new android.graphics.Matrix();
      switch (orientation) {
        case 2:
          transform.setScale(-1, 1);
          break;
        case 3:
          transform.setRotate(180);
          break;
        case 4:
          transform.setScale(1, -1);
          break;
        case 5:
          transform.setRotate(90);
          transform.postScale(-1, 1);
          break;
        case 6:
          transform.setRotate(90);
          break;
        case 7:
          transform.setRotate(-90);
          transform.postScale(-1, 1);
          break;
        case 8:
          transform.setRotate(-90);
          break;
        default:
          break;
      }
      if (!transform.isIdentity()) {
        Bitmap oriented =
            Bitmap.createBitmap(
                bitmap, 0, 0, bitmap.getWidth(), bitmap.getHeight(), transform, true);
        if (oriented != bitmap) {
          bitmap.recycle();
          bitmap = oriented;
        }
      }
      double scale = Math.min(1, (double) max / Math.max(bitmap.getWidth(), bitmap.getHeight()));
      if (scale < 1) {
        Bitmap smaller =
            Bitmap.createScaledBitmap(
                bitmap,
                Math.max(1, (int) Math.round(bitmap.getWidth() * scale)),
                Math.max(1, (int) Math.round(bitmap.getHeight() * scale)),
                true);
        bitmap.recycle();
        bitmap = smaller;
      }
      String requestedMime = compression.optString("fileType", "image/webp");
      boolean png = requestedMime.equals("image/png");
      Bitmap.CompressFormat format =
          png
              ? Bitmap.CompressFormat.PNG
              : requestedMime.equals("image/jpeg")
                  ? Bitmap.CompressFormat.JPEG
                  : android.os.Build.VERSION.SDK_INT >= 30
                      ? Bitmap.CompressFormat.WEBP_LOSSY
                      : Bitmap.CompressFormat.WEBP;
      ByteArrayOutputStream output = new ByteArrayOutputStream();
      do {
        output.reset();
        bitmap.compress(format, quality, output);
        quality -= 10;
      } while (!png && output.size() > target && quality >= 10);
      String mime =
          png ? "image/png" : requestedMime.equals("image/jpeg") ? "image/jpeg" : "image/webp";
      return new JSONObject()
          .put(
              "compressed",
              "data:"
                  + mime
                  + ";base64,"
                  + Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP));
    } finally {
      bitmap.recycle();
    }
  }

  static byte[] readBounded(File file, int max) throws IOException {
    if (file.length() > max) throw new IOException("File exceeds limit");
    try (InputStream in = new FileInputStream(file);
        ByteArrayOutputStream out = new ByteArrayOutputStream()) {
      byte[] buffer = new byte[8192];
      int count;
      while ((count = in.read(buffer)) != -1) {
        if (out.size() + count > max) throw new IOException("File exceeds limit");
        out.write(buffer, 0, count);
      }
      return out.toByteArray();
    }
  }

  static String hex(byte[] bytes) {
    StringBuilder value = new StringBuilder();
    for (byte b : bytes) value.append(String.format(java.util.Locale.ROOT, "%02x", b & 255));
    return value.toString();
  }
}
