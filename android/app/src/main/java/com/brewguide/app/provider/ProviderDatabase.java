package com.brewguide.app.provider;

import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteCursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteProgram;
import android.database.sqlite.SQLiteStatement;
import android.net.Uri;
import android.os.SystemClock;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * The sole Android connection owner. Provider and Capacitor use this connection. SQLite work always
 * runs on one thread (SQLiteDatabase transactions are thread-bound), while a logical lease spans
 * asynchronous Capacitor calls and full Provider requests. Business schema/migrations remain owned
 * by the shared TypeScript bootstrap.
 */
public final class ProviderDatabase {
  public static final String MAIN_DATABASE = "brew-guide";
  private static final long UI_IDLE_TIMEOUT_MS = 60_000L;
  private static final Map<String, ProviderDatabase> INSTANCES = new HashMap<>();
  private final Context context;
  private final String name;
  private final ExecutorService worker =
      Executors.newSingleThreadExecutor(r -> new Thread(r, "BrewGuide-SQLite"));
  private final CopyOnWriteArrayList<Runnable> listeners = new CopyOnWriteArrayList<>();
  private SQLiteDatabase database;
  private String activeOwner;
  private int references;
  private long lastActivity;
  private boolean transaction;
  private long revision;
  private long epoch;

  public static synchronized ProviderDatabase get(Context context) {
    return get(context, MAIN_DATABASE);
  }

  public static synchronized ProviderDatabase get(Context context, String name) {
    if (!MAIN_DATABASE.equals(name) && !"brew-guide-stage3d-test".equals(name))
      throw new IllegalArgumentException("Unsupported database");
    ProviderDatabase current = INSTANCES.get(name);
    if (current == null) {
      current = new ProviderDatabase(context.getApplicationContext(), name);
      INSTANCES.put(name, current);
    }
    return current;
  }

  private ProviderDatabase(Context context, String name) {
    this.context = context;
    this.name = name;
  }

  private SQLiteDatabase connection() {
    if (database == null) {
      // Capacitor Community SQLite uses the exact logical-name + SQLite.db path.
      java.io.File path = context.getDatabasePath(name + "SQLite.db");
      java.io.File parent = path.getParentFile();
      if (parent != null && !parent.exists() && !parent.mkdirs())
        throw new IllegalStateException("Cannot create database directory");
      database = SQLiteDatabase.openOrCreateDatabase(path, null);
      database.setForeignKeyConstraintsEnabled(true);
      // Journal mode/synchronous are configured by the shared schema bootstrap.
      try (Cursor timeout = database.rawQuery("PRAGMA busy_timeout = 5000", null)) {
        timeout.moveToFirst();
      }
    }
    return database;
  }

  private <T> T dispatch(Callable<T> action) {
    Future<T> pending = worker.submit(action);
    boolean interrupted = false;
    try {
      // Never report failure merely because a waiting Binder thread was interrupted:
      // the queued transaction could already have committed. Return its actual result.
      for (; ; ) {
        try {
          return pending.get();
        } catch (InterruptedException ignored) {
          interrupted = true;
        } catch (ExecutionException error) {
          Throwable cause = error.getCause();
          if (cause instanceof RuntimeException) throw (RuntimeException) cause;
          throw new IllegalStateException("SQLite operation failed", cause);
        }
      }
    } finally {
      if (interrupted) Thread.currentThread().interrupt();
    }
  }

  public final class Lease implements AutoCloseable {
    private final String owner;
    private boolean closed;

    private Lease(String owner) {
      this.owner = owner;
    }

    @Override
    public void close() {
      synchronized (ProviderDatabase.this) {
        if (closed) return;
        closed = true;
        if (!owner.equals(activeOwner)) return;
        if (--references == 0) {
          if (transaction) rollbackInternal();
          activeOwner = null;
          ProviderDatabase.this.notifyAll();
        }
      }
    }
  }

  public synchronized Lease acquire(String owner, long timeoutMillis) {
    if (owner == null || owner.isEmpty())
      throw new IllegalArgumentException("Missing database owner");
    long deadline = SystemClock.elapsedRealtime() + Math.min(Math.max(timeoutMillis, 1), 120_000);
    while (activeOwner != null && !owner.equals(activeOwner)) {
      expireAbandonedUi();
      if (activeOwner == null) break;
      long remaining = deadline - SystemClock.elapsedRealtime();
      if (remaining <= 0) throw new IllegalStateException("DATABASE_BUSY");
      try {
        wait(Math.min(remaining, 1_000));
      } catch (InterruptedException error) {
        Thread.currentThread().interrupt();
        throw new IllegalStateException("DATABASE_CANCELLED", error);
      }
    }
    activeOwner = owner;
    references++;
    lastActivity = SystemClock.elapsedRealtime();
    return new Lease(owner);
  }

  private void expireAbandonedUi() {
    if (activeOwner != null
        && activeOwner.startsWith("ui:")
        && SystemClock.elapsedRealtime() - lastActivity >= UI_IDLE_TIMEOUT_MS) {
      if (transaction) rollbackInternal();
      activeOwner = null;
      references = 0;
      notifyAll();
    }
  }

  private void requireOwner(String owner) {
    expireAbandonedUi();
    if (owner == null || !owner.equals(activeOwner))
      throw new IllegalStateException("DATABASE_SESSION_EXPIRED");
    lastActivity = SystemClock.elapsedRealtime();
  }

  public synchronized void begin(String owner) {
    requireOwner(owner);
    if (transaction) throw new IllegalStateException("Nested transactions are not supported");
    dispatch(
        () -> {
          connection().beginTransactionNonExclusive();
          return null;
        });
    transaction = true;
  }

  public synchronized void commit(String owner) {
    requireOwner(owner);
    if (!transaction) throw new IllegalStateException("No active transaction");
    try {
      dispatch(
          () -> {
            connection().setTransactionSuccessful();
            connection().endTransaction();
            return null;
          });
    } finally {
      transaction = false;
    }
  }

  public synchronized void rollback(String owner) {
    requireOwner(owner);
    if (transaction) rollbackInternal();
  }

  private void rollbackInternal() {
    try {
      dispatch(
          () -> {
            connection().endTransaction();
            return null;
          });
    } finally {
      transaction = false;
    }
  }

  public synchronized boolean isTransactionActive(String owner) {
    requireOwner(owner);
    return transaction;
  }

  private static void bind(SQLiteProgram statement, JSONArray params) throws Exception {
    for (int index = 0; index < params.length(); index++) {
      Object value = params.get(index);
      if (value == JSONObject.NULL) statement.bindNull(index + 1);
      else if (value instanceof Float || value instanceof Double) {
        double number = ((Number) value).doubleValue();
        if (!Double.isFinite(number))
          throw new IllegalArgumentException("Invalid numeric SQL parameter");
        statement.bindDouble(index + 1, number);
      } else if (value instanceof Number)
        statement.bindLong(index + 1, ((Number) value).longValue());
      else if (value instanceof String) statement.bindString(index + 1, (String) value);
      else throw new IllegalArgumentException("Invalid SQL parameter");
    }
  }

  public synchronized JSONArray query(String owner, String sql, JSONArray params) {
    requireOwner(owner);
    return dispatch(
        () -> {
          JSONArray rows = new JSONArray();
          try (Cursor cursor =
              connection()
                  .rawQueryWithFactory(
                      (db, driver, editTable, query) -> {
                        try {
                          bind(query, params);
                        } catch (Exception error) {
                          throw new IllegalArgumentException(error);
                        }
                        return new SQLiteCursor(driver, editTable, query);
                      },
                      sql,
                      new String[0],
                      null)) {
            while (cursor.moveToNext()) {
              JSONObject row = new JSONObject();
              for (int index = 0; index < cursor.getColumnCount(); index++) {
                Object value;
                switch (cursor.getType(index)) {
                  case Cursor.FIELD_TYPE_NULL:
                    value = JSONObject.NULL;
                    break;
                  case Cursor.FIELD_TYPE_INTEGER:
                    value = cursor.getLong(index);
                    break;
                  case Cursor.FIELD_TYPE_FLOAT:
                    value = cursor.getDouble(index);
                    break;
                  case Cursor.FIELD_TYPE_STRING:
                    value = cursor.getString(index);
                    break;
                  default:
                    throw new IllegalStateException(
                        "BLOB columns are not part of the application schema");
                }
                row.put(cursor.getColumnName(index), value);
              }
              rows.put(row);
            }
          }
          return rows;
        });
  }

  public synchronized JSONObject execute(String owner, String sql, JSONArray params) {
    requireOwner(owner);
    return dispatch(
        () -> {
          try (SQLiteStatement statement = connection().compileStatement(sql)) {
            bind(statement, params);
            statement.execute();
          }
          long changes;
          try (SQLiteStatement statement = connection().compileStatement("SELECT changes()")) {
            changes = statement.simpleQueryForLong();
          }
          return new JSONObject().put("changes", changes);
        });
  }

  private void ensureOutbox() {
    connection()
        .execSQL(
            "CREATE TABLE IF NOT EXISTS provider_publications (id TEXT NOT NULL PRIMARY KEY,"
                + " changes_json TEXT NOT NULL, created_at_ms INTEGER NOT NULL)");
  }

  /** Durable outbox is stored before the shared MCP publication is acknowledged. */
  public synchronized void publishChanges(String owner, JSONArray changes) {
    requireOwner(owner);
    if (changes.length() == 0) return;
    dispatch(
        () -> {
          ensureOutbox();
          String json = changes.toString();
          byte[] hash =
              MessageDigest.getInstance("SHA-256").digest(json.getBytes(StandardCharsets.UTF_8));
          StringBuilder id = new StringBuilder();
          for (byte item : hash) id.append(String.format("%02x", item & 255));
          connection()
              .execSQL(
                  "INSERT OR IGNORE INTO provider_publications (id, changes_json, created_at_ms)"
                      + " VALUES (?, ?, ?)",
                  new Object[] {id.toString(), json, System.currentTimeMillis()});
          return null;
        });
    revision++;
    context
        .getContentResolver()
        .notifyChange(Uri.parse("content://" + context.getPackageName() + ".data/v1"), null);
    for (Runnable listener : listeners) listener.run();
  }

  public void publishChanges(JSONArray changes) {
    String owner = "publication:" + UUID.randomUUID();
    try (Lease ignored = acquire(owner, 30_000)) {
      publishChanges(owner, changes);
    }
  }

  public synchronized long revision() {
    return revision;
  }

  public synchronized long epoch() {
    return epoch;
  }

  public synchronized void resetEpoch(String owner) {
    requireOwner(owner);
    epoch++;
  }

  public void addListener(Runnable listener) {
    listeners.add(listener);
  }

  public void removeListener(Runnable listener) {
    listeners.remove(listener);
  }

  public JSONArray pendingPublications(String owner) {
    synchronized (this) {
      requireOwner(owner);
      dispatch(
          () -> {
            ensureOutbox();
            return null;
          });
      return query(
          owner,
          "SELECT id, changes_json FROM provider_publications ORDER BY created_at_ms, id",
          new JSONArray());
    }
  }

  public void acknowledgePublication(String owner, String id) {
    execute(owner, "DELETE FROM provider_publications WHERE id = ?", new JSONArray().put(id));
  }

  /** Conservative native-only legacy detection. Never opens a hidden WebView. */
  public boolean canAdoptFreshStore() {
    if (!context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE).getAll().isEmpty())
      return false;
    java.io.File web = new java.io.File(context.getApplicationInfo().dataDir, "app_webview");
    return !hasLegacyWebData(web, 0, new int[] {0}, false);
  }

  private boolean hasLegacyWebData(
      java.io.File entry, int depth, int[] visited, boolean legacyRoot) {
    if (!entry.exists()) return false;
    if (depth > 10 || ++visited[0] > 4096) return true;
    String name = entry.getName().toLowerCase(java.util.Locale.ROOT);
    boolean legacy =
        legacyRoot
            || name.contains("indexeddb")
            || name.contains("local storage")
            || name.endsWith(".localstorage");
    if (entry.isFile()) return legacy && entry.length() > 0;
    java.io.File[] children = entry.listFiles();
    if (children == null) return true;
    for (java.io.File child : children)
      if (hasLegacyWebData(child, depth + 1, visited, legacy)) return true;
    return false;
  }

  public static synchronized void deleteTestDatabase(Context context) {
    ProviderDatabase test = INSTANCES.get("brew-guide-stage3d-test");
    if (test != null) {
      synchronized (test) {
        if (test.activeOwner != null) throw new IllegalStateException("Test database is busy");
        test.dispatch(
            () -> {
              if (test.database != null) test.database.close();
              test.database = null;
              return null;
            });
      }
    }
    context.deleteDatabase("brew-guide-stage3d-testSQLite.db");
  }
}
