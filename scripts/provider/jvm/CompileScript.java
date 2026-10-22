import java.io.BufferedOutputStream;
import java.io.FileOutputStream;
import java.io.ObjectOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.mozilla.javascript.Context;
import org.mozilla.javascript.Script;

/** Build-time interpreter compilation. No generated JVM classes or business execution. */
public final class CompileScript {
  public static void main(String[] arguments) throws Exception {
    if (arguments.length != 2)
      throw new IllegalArgumentException("Expected source and output paths");
    try (Context context = Context.enter()) {
      context.setOptimizationLevel(-1);
      context.setGeneratingSource(false);
      context.setGeneratingDebug(false);
      context.setLanguageVersion(Context.VERSION_ES6);
      context.setInstructionObserverThreshold(10000);
      byte[] source = Files.readAllBytes(Path.of(arguments[0]));
      Script script =
          context.compileString(
              new String(source, StandardCharsets.UTF_8), "provider/business.js", 1, null);
      Path output = Path.of(arguments[1]);
      Files.createDirectories(output.getParent());
      try (ObjectOutputStream stream =
          new ObjectOutputStream(new BufferedOutputStream(new FileOutputStream(output.toFile())))) {
        stream.writeUTF("BrewGuideProvider/Rhino-1.8.0/1");
        stream.writeUTF(
            java.util.HexFormat.of()
                .formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(source)));
        stream.writeObject(script);
      }
    }
  }
}
