package com.brewguide.app;

import static org.junit.Assert.*;

import android.content.Context;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.io.IOException;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class BrewGuideSyncHttpPluginTest {
  @Test
  public void syncFilesStayInPrivateCache() throws Exception {
    Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
    File cache = context.getCacheDir();
    String name = "brew-guide-sync-12345678-1234-1234-1234-123456789abc-response";
    assertEquals(
        new File(cache, name).getCanonicalFile(),
        BrewGuideSyncHttpPlugin.syncCacheFile(cache, name));
    for (String invalid : new String[] {null, "../outside", "/data/local/tmp/file", "other-file"}) {
      try {
        BrewGuideSyncHttpPlugin.syncCacheFile(cache, invalid);
        fail("Invalid sync filename was accepted");
      } catch (IOException expected) {
        assertTrue(expected.getMessage().contains("filename"));
      }
    }
  }
}
