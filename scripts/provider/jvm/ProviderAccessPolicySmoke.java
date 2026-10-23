package com.brewguide.app.provider;

import java.lang.reflect.Method;
import org.json.JSONObject;

/** Host-side parity matrix against the actual native policy; Android IPC tests remain separate. */
public final class ProviderAccessPolicySmoke {
  public static void main(String[] args) throws Exception {
    Method allows =
        ProviderAccessStore.class.getDeclaredMethod(
            "allows", JSONObject.class, String.class, String.class);
    allows.setAccessible(true);
    int assertions = 0;
    for (String domain : ProviderAccessStore.DOMAINS) {
      for (String level : new String[] {"absent", "read", "edit"}) {
        JSONObject scopes = new JSONObject();
        if (!level.equals("absent")) scopes.put(domain, level);
        JSONObject validated = ProviderAccessStore.validateScopes(scopes);
        for (String operation : new String[] {"read", "write", "delete"}) {
          boolean expected =
              level.equals("edit") || (level.equals("read") && operation.equals("read"));
          require(
              expected == (Boolean) allows.invoke(null, validated, domain, operation),
              domain + "/" + level + "/" + operation);
          assertions++;
          for (String other : ProviderAccessStore.DOMAINS) {
            if (domain.equals(other)) continue;
            require(
                !(Boolean) allows.invoke(null, validated, other, operation),
                "Cross-domain expansion");
            assertions++;
          }
        }
      }
    }
    for (String malformed :
        new String[] {
          "{\"unknown\":\"edit\"}", "{\"beans\":\"write\"}", "{\"beans\":\"delete\"}",
          "{\"beans\":true}", "{\"beans\":null}",
              "{\"beans\":{\"read\":true,\"write\":true,\"delete\":true}}",
          "{\"beans\":[\"edit\"]}", "{\"beans\":\"EDIT\"}"
        }) {
      try {
        ProviderAccessStore.validateScopes(new JSONObject(malformed));
        throw new AssertionError("Accepted malformed scopes: " + malformed);
      } catch (IllegalArgumentException expected) {
        assertions++;
      }
    }
    require(
        ProviderAccessStore.validateResultDomains("[\"beans\",\"notes\"]").size() == 2,
        "Cached scope metadata");
    assertions++;
    for (Object invalid :
        new Object[] {null, JSONObject.NULL, "null", "{}", "[\"unknown\"]", "[true]", "[1]"}) {
      try {
        ProviderAccessStore.validateResultDomains(invalid);
        throw new AssertionError("Accepted invalid replay metadata");
      } catch (SecurityException expected) {
        assertions++;
      }
    }
    System.out.println(
        "Native two-level policy PASS: "
            + assertions
            + " assertions (actual Java policy; no IPC claim)");
  }

  private static void require(boolean condition, String message) {
    if (!condition) throw new AssertionError(message);
  }
}
