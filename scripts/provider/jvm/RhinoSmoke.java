// Test-only JDBC host. Supply Rhino 1.8.0, sqlite-jdbc, and org.json on the classpath.
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.Base64;
import java.util.HexFormat;
import org.json.JSONArray;
import org.json.JSONObject;
import org.mozilla.javascript.BaseFunction;
import org.mozilla.javascript.Context;
import org.mozilla.javascript.Function;
import org.mozilla.javascript.Scriptable;
import org.mozilla.javascript.ScriptableObject;

public final class RhinoSmoke {
  private static Connection database;
  private static int events;

  private static String dispatch(String operation, String json) throws Exception {
    JSONObject args = new JSONObject(json);
    switch (operation) {
      case "migration.canAdoptFresh":
        return "true";
      case "files.list":
        return "[]";
      case "sql.query":
      case "sql.execute":
        try (PreparedStatement statement = database.prepareStatement(args.getString("sql"))) {
          JSONArray params = args.optJSONArray("params");
          if (params != null) {
            for (int i = 0; i < params.length(); i++) {
              statement.setObject(i + 1, params.isNull(i) ? null : params.get(i));
            }
          }
          if (operation.equals("sql.query")) {
            JSONArray rows = new JSONArray();
            try (ResultSet result = statement.executeQuery()) {
              while (result.next()) {
                JSONObject row = new JSONObject();
                for (int i = 1; i <= result.getMetaData().getColumnCount(); i++) {
                  Object value = result.getObject(i);
                  row.put(
                      result.getMetaData().getColumnLabel(i),
                      value == null ? JSONObject.NULL : value);
                }
                rows.put(row);
              }
            }
            return rows.toString();
          }
          statement.execute();
          return new JSONObject()
              .put("changes", Math.max(statement.getUpdateCount(), 0))
              .toString();
        }
      case "sql.begin":
      case "sql.commit":
      case "sql.rollback":
        String sql =
            operation.equals("sql.begin")
                ? "BEGIN IMMEDIATE"
                : operation.equals("sql.commit") ? "COMMIT" : "ROLLBACK";
        try (var statement = database.createStatement()) {
          statement.execute(sql);
        }
        break;
      case "crypto.sha256":
        byte[] hash =
            MessageDigest.getInstance("SHA-256")
                .digest(Base64.getDecoder().decode(args.getString("bytesBase64")));
        return new JSONObject().put("hex", HexFormat.of().formatHex(hash)).toString();
      case "crypto.random":
        byte[] bytes = new byte[args.getInt("length")];
        new SecureRandom().nextBytes(bytes);
        JSONArray values = new JSONArray();
        for (byte value : bytes) values.put(value & 255);
        return new JSONObject().put("bytes", values).toString();
      case "permissions.checkChanges":
        break;
      case "events.publish":
        events++;
        break;
      default:
        throw new IllegalArgumentException(operation);
    }
    return "null";
  }

  private static void requireSuccess(Object response) {
    JSONObject result = new JSONObject(Context.toString(response));
    if (!result.optBoolean("ok")) throw new AssertionError(result.toString());
  }

  private static Object invoke(Context context, Scriptable scope, String name, Object... args) {
    Scriptable api = (Scriptable) scope.get("BrewGuideProvider", scope);
    return ((Function) api.get(name, api)).call(context, scope, api, args);
  }

  public static void main(String[] args) throws Exception {
    Path file = Files.createTempFile("provider-rhino-", ".db");
    int[] observations = {0};
    org.mozilla.javascript.ContextFactory factory =
        new org.mozilla.javascript.ContextFactory() {
          @Override
          protected void observeInstructionCount(Context cx, int count) {
            observations[0]++;
          }
        };
    try (Connection connection = DriverManager.getConnection("jdbc:sqlite:" + file);
        Context context = factory.enterContext()) {
      database = connection;
      context.setOptimizationLevel(-1);
      context.setLanguageVersion(Context.VERSION_ES6);
      context.setInstructionObserverThreshold(10000);
      ScriptableObject scope = context.initSafeStandardObjects();
      ScriptableObject host = (ScriptableObject) context.newObject(scope);
      host.put(
          "call",
          host,
          new BaseFunction() {
            @Override
            public Object call(Context cx, Scriptable sc, Scriptable self, Object[] values) {
              try {
                return dispatch(Context.toString(values[0]), Context.toString(values[1]));
              } catch (Exception error) {
                throw Context.throwAsScriptRuntimeEx(error);
              }
            }
          });
      scope.put("__brewHost", scope, host);
      if (args[0].endsWith(".bin")) {
        try (var input =
            new java.io.ObjectInputStream(
                new java.io.BufferedInputStream(Files.newInputStream(Path.of(args[0]))))) {
          if (!"BrewGuideProvider/Rhino-1.8.0/1".equals(input.readUTF()))
            throw new AssertionError("Interpreter artifact version mismatch");
          if (!input.readUTF().matches("[0-9a-f]{64}"))
            throw new AssertionError("Missing source integrity binding");
          ((org.mozilla.javascript.Script) input.readObject()).exec(context, scope);
        }
      } else {
        context.evaluateString(scope, Files.readString(Path.of(args[0])), "business.js", 1, null);
      }
      requireSuccess(invoke(context, scope, "initialize"));
      if (new JSONArray(Context.toString(invoke(context, scope, "catalog"))).length() != 80) {
        throw new AssertionError("Incomplete tool catalog");
      }
      String grants = "{\"scopes\":{\"beans\":\"edit\",\"notes\":\"edit\",\"brewing\":\"edit\",\"settings\":\"edit\"}}";
      requireSuccess(invoke(context, scope, "execute", "list_beans", "{}", grants));
      requireSuccess(
          invoke(
              context,
              scope,
              "execute",
              "create_bean",
              "{\"requestId\":\"rhino-smoke-create-1\",\"bean\":{\"name\":\"Rhino smoke\","
                  + "\"capacityGrams\":100,\"remainingGrams\":100}}",
              grants));
      if (observations[0] == 0) throw new AssertionError("Instruction deadlines were disabled");
      if (events != 1) throw new AssertionError("Publication was not delivered");
      System.out.println(
          "Rhino shared-runtime compatibility passed: "
              + "initialize, catalog80, query, mutation, publication.");
    } finally {
      Files.deleteIfExists(file);
    }
  }
}
