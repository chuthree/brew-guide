package com.brewguide.app.provider;

import static org.junit.Assert.*;

import android.content.Context;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Native connection tests supplement, not replace, external ContentResolver acceptance. */
@RunWith(AndroidJUnit4.class)
public class ProviderDatabaseTest {
  private Context context;
  private ProviderDatabase db;

  @Before
  public void setup() {
    context = InstrumentationRegistry.getInstrumentation().getTargetContext();
    ProviderDatabase.deleteTestDatabase(context);
    db = ProviderDatabase.get(context, "brew-guide-stage3d-test");
    try (ProviderDatabase.Lease ignored = db.acquire("setup", 1000)) {
      db.execute(
          "setup",
          "CREATE TABLE sample (id TEXT PRIMARY KEY, amount INTEGER, extra TEXT)",
          new JSONArray());
    }
  }

  @After
  public void cleanup() {
    ProviderDatabase.deleteTestDatabase(context);
  }

  @Test
  public void oneTransactionSurvivesDifferentBridgeThreads() throws Exception {
    String owner = "ui:transaction";
    ExecutorService callers = Executors.newFixedThreadPool(2);
    try (ProviderDatabase.Lease ignored = db.acquire(owner, 1000)) {
      callers.submit(() -> db.begin(owner)).get();
      callers
          .submit(
              () ->
                  db.execute(
                      owner,
                      "INSERT INTO sample VALUES (?, ?, ?)",
                      new JSONArray().put("bean").put(12).put(JSONObject.NULL)))
          .get();
      callers.submit(() -> db.commit(owner)).get();
      JSONArray rows =
          db.query(owner, "SELECT * FROM sample WHERE amount = ?", new JSONArray().put(12));
      assertEquals(12, rows.getJSONObject(0).getInt("amount"));
      assertTrue(rows.getJSONObject(0).isNull("extra"));
    } finally {
      callers.shutdownNow();
    }
  }

  @Test
  public void providerCannotInterleaveUiLeaseAndTimeoutDoesNotStealIt() throws Exception {
    ExecutorService callers = Executors.newSingleThreadExecutor();
    try (ProviderDatabase.Lease ignored = db.acquire("ui:outer", 1000)) {
      Future<Boolean> blocked =
          callers.submit(
              () -> {
                try (ProviderDatabase.Lease other = db.acquire("provider:caller", 50)) {
                  return false;
                } catch (IllegalStateException error) {
                  return "DATABASE_BUSY".equals(error.getMessage());
                }
              });
      assertTrue(blocked.get());
      db.begin("ui:outer");
      db.execute("ui:outer", "INSERT INTO sample VALUES ('kept', 1, NULL)", new JSONArray());
      db.commit("ui:outer");
    } finally {
      callers.shutdownNow();
    }
    try (ProviderDatabase.Lease ignored = db.acquire("provider:caller", 1000)) {
      assertEquals(
          1, db.query("provider:caller", "SELECT * FROM sample", new JSONArray()).length());
    }
  }

  @Test
  public void leaseCloseRollsBackUncommittedWrite() {
    try (ProviderDatabase.Lease ignored = db.acquire("provider:failed", 1000)) {
      db.begin("provider:failed");
      db.execute(
          "provider:failed", "INSERT INTO sample VALUES ('rolled-back', 2, NULL)", new JSONArray());
    }
    try (ProviderDatabase.Lease ignored = db.acquire("provider:read", 1000)) {
      assertEquals(0, db.query("provider:read", "SELECT * FROM sample", new JSONArray()).length());
    }
  }

  @Test
  public void wrongOwnerRejectedAndResetInvalidatesEngineEpoch() {
    try (ProviderDatabase.Lease ignored = db.acquire("ui:reset", 1000)) {
      long epoch = db.epoch();
      try {
        db.execute("provider:wrong", "DELETE FROM sample", new JSONArray());
        fail("Wrong owner accepted");
      } catch (IllegalStateException expected) {
        assertEquals("DATABASE_SESSION_EXPIRED", expected.getMessage());
      }
      db.resetEpoch("ui:reset");
      assertEquals(epoch + 1, db.epoch());
    }
  }

  @Test
  public void publicationOutboxIsIdempotentAndDurableUntilAcknowledged() throws Exception {
    try (ProviderDatabase.Lease ignored = db.acquire("provider:publication", 1000)) {
      JSONArray changes =
          new JSONArray()
              .put(
                  new JSONObject()
                      .put("entity", "bean")
                      .put("id", "bean")
                      .put("before", JSONObject.NULL)
                      .put("after", new JSONObject().put("id", "bean")));
      db.publishChanges("provider:publication", changes);
      db.publishChanges("provider:publication", changes);
      JSONArray rows = db.pendingPublications("provider:publication");
      assertEquals(1, rows.length());
      db.acknowledgePublication("provider:publication", rows.getJSONObject(0).getString("id"));
      assertEquals(0, db.pendingPublications("provider:publication").length());
    }
  }
}
