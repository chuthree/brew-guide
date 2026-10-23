package com.brewguide.app.provider;

import static org.junit.Assert.*;

import android.app.Instrumentation;
import android.content.Intent;
import android.os.Bundle;
import android.os.SystemClock;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.brewguide.app.MainActivity;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Requires fixtures created by the separate, differently signed ContentResolver caller APK. */
@RunWith(AndroidJUnit4.class)
public class ProviderForegroundTest {
  private MainActivity activity;

  private String evaluate(String script) throws Exception {
    CountDownLatch done = new CountDownLatch(1);
    AtomicReference<String> result = new AtomicReference<>();
    InstrumentationRegistry.getInstrumentation()
        .runOnMainSync(
            () ->
                activity
                    .getBridge()
                    .getWebView()
                    .evaluateJavascript(
                        script,
                        value -> {
                          result.set(value);
                          done.countDown();
                        }));
    assertTrue("WebView evaluation timed out", done.await(10, TimeUnit.SECONDS));
    Object parsed = new JSONTokener(result.get()).nextValue();
    return parsed == JSONObject.NULL ? "" : String.valueOf(parsed);
  }

  private String waitForText(String expected, long timeout) throws Exception {
    long deadline = SystemClock.elapsedRealtime() + timeout;
    String body = "";
    do {
      body = evaluate("document.body ? document.body.innerText : ''");
      if (body.contains(expected)) return body;
      SystemClock.sleep(250);
    } while (SystemClock.elapsedRealtime() < deadline);
    fail("Actual application UI never displayed " + expected + "; last visible text: " + body);
    return body;
  }

  @Test
  public void providerWritesReachActualAppAndSyncQueue() throws Exception {
    Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
    Bundle arguments = InstrumentationRegistry.getArguments();
    String beanId = arguments.getString("fixtureBeanId");
    String noteId = arguments.getString("fixtureNoteId");
    assertNotNull("Run external caller prepareForegroundFixture first", beanId);
    assertNotNull("Run external caller prepareForegroundFixture first", noteId);
    Intent launch =
        new Intent(instrumentation.getTargetContext(), MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    activity = (MainActivity) instrumentation.startActivitySync(launch);
    try {
      waitForText("咖啡豆", 90000);
      assertEquals(
          "clicked",
          evaluate(
              "(function(){var b=document.querySelector('[aria-label=\"切换咖啡豆视图\"]');if(!b)return"
                  + " 'missing';b.click();return 'clicked';})()"));
      waitForText("__PROVIDER_UI_ACCEPTANCE__", 30000);
      assertEquals(
          "clicked",
          evaluate(
              "(function(){var"
                  + " b=document.querySelector('[data-tab=\"笔记\"]')||Array.from(document.querySelectorAll('button')).find(function(x){return"
                  + " x.textContent.trim()==='笔记';});if(!b)return 'missing';b.click();return"
                  + " 'clicked';})()"));
      waitForText("Provider foreground acceptance", 30000);
      ProviderDatabase db = ProviderDatabase.get(instrumentation.getTargetContext());
      long deadline = SystemClock.elapsedRealtime() + 30000;
      while (true) {
        try (ProviderDatabase.Lease ignored = db.acquire("test:foreground-check", 1000)) {
          if (db.pendingPublications("test:foreground-check").length() == 0) {
            JSONArray beans =
                db.query(
                    "test:foreground-check",
                    "SELECT data_json FROM pending_operations WHERE table_name = 'coffee_beans' AND"
                        + " record_id = ?",
                    new JSONArray().put(beanId));
            JSONArray notes =
                db.query(
                    "test:foreground-check",
                    "SELECT data_json FROM pending_operations WHERE table_name = 'brewing_notes'"
                        + " AND record_id = ?",
                    new JSONArray().put(noteId));
            assertEquals(
                "Provider bean mutation reached real offline sync queue", 1, beans.length());
            assertEquals(
                88,
                new JSONObject(beans.getJSONObject(0).getString("data_json"))
                    .getDouble("remaining"),
                0.001);
            assertEquals(
                "Provider note mutation reached real offline sync queue", 1, notes.length());
            break;
          }
        }
        if (SystemClock.elapsedRealtime() > deadline)
          fail("Provider publication outbox was not drained by foreground application");
        SystemClock.sleep(250);
      }
    } finally {
      instrumentation.runOnMainSync(() -> activity.finish());
    }
  }
}
