package com.brewguide.app.provider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;

/** Internal Capacitor bridge, not an exported SQL IPC endpoint. */
@CapacitorPlugin(name = "BrewGuideDatabase")
public final class BrewGuideDatabasePlugin extends Plugin {
  private final ExecutorService requests = Executors.newFixedThreadPool(4);
  // Waiting new owners must never starve the current owner's commit/release.
  private final ExecutorService sessionRequests = Executors.newSingleThreadExecutor();
  private volatile boolean destroyed;
  private final Map<String, Session> sessions = new HashMap<>();
  private Runnable revisionListener;

  private static final class Session {
    final ProviderDatabase database;
    final ProviderDatabase.Lease lease;
    final boolean outerMutation;

    Session(ProviderDatabase database, ProviderDatabase.Lease lease, boolean outerMutation) {
      this.database = database;
      this.lease = lease;
      this.outerMutation = outerMutation;
    }
  }

  @Override
  public void load() {
    revisionListener =
        () ->
            notifyListeners(
                "providerDataChanged",
                new JSObject().put("revision", ProviderDatabase.get(getContext()).revision()));
    ProviderDatabase.get(getContext()).addListener(revisionListener);
  }

  @PluginMethod
  public void command(PluginCall call) {
    if (destroyed) {
      call.reject("Database bridge has closed");
      return;
    }
    ExecutorService lane = call.getString("session") == null ? requests : sessionRequests;
    try {
      lane.execute(
          () -> {
            try {
              call.resolve(execute(call));
            } catch (Exception error) {
              if ("DATABASE_SESSION_EXPIRED".equals(error.getMessage())) {
                Session expired;
                synchronized (sessions) {
                  expired = sessions.remove(call.getString("session"));
                }
                if (expired != null) expired.lease.close();
              }
              call.reject(
                  error.getMessage() == null ? "Database operation failed" : error.getMessage(),
                  error);
            }
          });
    } catch (java.util.concurrent.RejectedExecutionException error) {
      call.reject("Database bridge has closed", error);
    }
  }

  private JSObject execute(PluginCall call) throws Exception {
    if (destroyed) throw new IllegalStateException("Database bridge has closed");
    String operation = call.getString("operation", "");
    String databaseName = call.getString("database", ProviderDatabase.MAIN_DATABASE);
    ProviderDatabase db = ProviderDatabase.get(getContext(), databaseName);
    if ("deleteTestDatabase".equals(operation)) {
      ProviderDatabase.deleteTestDatabase(getContext());
      return new JSObject();
    }
    String sessionId = call.getString("session");
    if ("begin".equals(operation) && sessionId != null) {
      Session existing;
      synchronized (sessions) {
        existing = sessions.get(sessionId);
      }
      if (existing == null || existing.database != db || !existing.outerMutation)
        throw new IllegalStateException("DATABASE_SESSION_EXPIRED");
      db.begin(sessionId);
      return new JSObject()
          .put("session", sessionId)
          .put("changes", new JSObject().put("changes", 0));
    }
    if ("begin".equals(operation) || "acquireMutation".equals(operation)) {
      String owner = "ui:" + UUID.randomUUID();
      ProviderDatabase.Lease lease = db.acquire(owner, 30_000);
      try {
        if ("begin".equals(operation)) db.begin(owner);
        synchronized (sessions) {
          if (destroyed) throw new IllegalStateException("Database bridge has closed");
          if (sessions.size() >= 32) throw new IllegalStateException("Too many database sessions");
          sessions.put(owner, new Session(db, lease, "acquireMutation".equals(operation)));
        }
        return new JSObject()
            .put("session", owner)
            .put("changes", new JSObject().put("changes", 0));
      } catch (Exception error) {
        lease.close();
        throw error;
      }
    }
    Session session = null;
    if (sessionId != null) {
      synchronized (sessions) {
        session = sessions.get(sessionId);
      }
      if (session == null || session.database != db)
        throw new IllegalStateException("DATABASE_SESSION_EXPIRED");
    }
    String owner = sessionId != null ? sessionId : "uiop:" + UUID.randomUUID();
    ProviderDatabase.Lease operationLease = session == null ? db.acquire(owner, 30_000) : null;
    try {
      if (destroyed) throw new IllegalStateException("Database bridge has closed");
      switch (operation) {
        case "open":
          return new JSObject().put("revision", db.revision());
        case "query":
          return new JSObject().put("values", db.query(owner, requiredSql(call), params(call)));
        case "execute":
          return new JSObject().put("changes", db.execute(owner, requiredSql(call), params(call)));
        case "isTransactionActive":
          return new JSObject().put("result", db.isTransactionActive(owner));
        case "commit":
          if (session == null) throw new IllegalStateException("No active transaction");
          db.commit(owner);
          return new JSObject().put("changes", new JSObject().put("changes", 0));
        case "rollback":
          if (session != null) db.rollback(owner);
          return new JSObject().put("changes", new JSObject().put("changes", 0));
        case "releaseMutation":
        case "close":
          if (session != null) db.rollback(owner);
          return new JSObject();
        case "resetBusinessRuntime":
          db.resetEpoch(owner);
          return new JSObject().put("epoch", db.epoch());
        case "pendingPublications":
          return new JSObject().put("publications", db.pendingPublications(owner));
        case "acknowledgePublication":
          String id = call.getString("id");
          if (id == null || id.length() != 64)
            throw new IllegalArgumentException("Invalid publication ID");
          db.acknowledgePublication(owner, id);
          return new JSObject();
        default:
          throw new IllegalArgumentException("Unsupported internal database operation");
      }
    } finally {
      if (operationLease != null) operationLease.close();
      if (session != null
          && ((!session.outerMutation
                  && ("commit".equals(operation) || "rollback".equals(operation)))
              || "releaseMutation".equals(operation)
              || "close".equals(operation))) {
        synchronized (sessions) {
          sessions.remove(owner);
        }
        session.lease.close();
      }
    }
  }

  private static String requiredSql(PluginCall call) {
    String sql = call.getString("sql");
    if (sql == null || sql.length() > 1_000_000 || sql.isBlank())
      throw new IllegalArgumentException("Invalid SQL");
    return sql;
  }

  private static JSONArray params(PluginCall call) {
    JSONArray result = call.getArray("params");
    return result == null ? new JSONArray() : result;
  }

  @Override
  protected void handleOnDestroy() {
    destroyed = true;
    if (revisionListener != null)
      ProviderDatabase.get(getContext()).removeListener(revisionListener);
    sessionRequests.execute(
        () -> {
          synchronized (sessions) {
            for (Session session : sessions.values()) session.lease.close();
            sessions.clear();
          }
        });
    requests.shutdown();
    sessionRequests.shutdown();
  }
}
