# Android ContentProvider

Authority: `com.brewguide.app.data`; versioned root: `content://com.brewguide.app.data/v1`.
This transport is independent of the desktop HTTP MCP service and its permissions.

## Connect

Declare provider visibility in the calling application's manifest:

```xml
<queries><provider android:authorities="com.brewguide.app.data" /></queries>
```

```kotlin
val root = Uri.parse("content://com.brewguide.app.data/v1")
fun invoke(method: String, arguments: JSONObject): JSONObject {
    val extras = Bundle().apply { putString("arguments", arguments.toString()) }
    return JSONObject(contentResolver.call(root, method, null, extras)!!.getString("result")!!)
}
// Run ContentResolver calls off the main thread. Request only what this feature needs.
val scopes = JSONObject("""{
  "beans":"edit",
  "notes":"edit"
}""")
val request = contentResolver.call(root, "request_access", null, Bundle().apply {
    putString("arguments", JSONObject().put("scopes", scopes).toString())
})!!
val entry = request.getParcelable<PendingIntent>("authorizationIntent")
// On the foreground Activity's main thread, after checking the response and creator package:
val options = ActivityOptions.makeBasic()
if (Build.VERSION.SDK_INT >= 34) {
    options.setPendingIntentBackgroundActivityStartMode(
        ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED)
}
startIntentSenderForResult(entry!!.intentSender, AUTHORIZE_REQUEST, null, 0, 0, 0,
    options.toBundle())
// In onActivityResult, re-read actual permissions; a returned result is not itself a grant.
val permissions = invoke("get_access_status", JSONObject()) // Native-only, no business bootstrap.
val capabilities = invoke("get_capabilities", JSONObject()) // Load schemas when needed.
```

The native service verifies UID, installed package, signing identity and installation identity.
Ambiguous shared UIDs are rejected. Four independent scopes are `brewing`, `beans`, `notes`,
`settings`. Both MCP and Android use `scopes: { domain: "read" | "edit" }`:
`read` permits queries; `edit` permits queries, creation, updates **and deletion**.
An omitted domain is not authorized. Defaults grant no domains. Unknown domains, levels,
boolean permission objects and empty authorization requests are rejected. Grants stay in device-local,
no-backup storage, outside SQLite data exports and synchronization. Revocation invalidates
queued operations and is synchronized with transaction commit. Android URI permission grants
never bypass these business permissions.

The visible confirmation drawer lists only the requested scopes and operations, without
permission toggles. Approval merges exactly those permissions with existing grants; cancel,
back and dismissal do not change grants. Invalid or unknown scopes/levels are rejected, not
silently expanded. The immutable authorization entry and expiring request are bound to the
system-verified caller identity and expire after five minutes. Do not send a caller package
name or return Intent. Open the entry only from an explicit foreground user action.
An already open Brew Guide retains its screen and drafts; a cold authorization entry starts
the ordinary UI. Business data operations remain headless.

Manage existing applications in **Settings → 授权管理**, the independent row immediately
below **数据备份**. The row is hidden until an application has requested or received access.
A linked brewing note that deducts inventory needs `notes: "edit"` and `beans: "edit"`;
deleting that note and restoring inventory needs the same two levels. Grinder-history
changes additionally need `settings: "edit"`; merely referring to saved brewing equipment
or recipes needs brewing read access. `edit` is general management permission, not only
stock consumption. Use one `create_brew_note`, not a separate inventory deduction plus note.
`get_access_status.result.scopes` and `get_capabilities.result.scopes` report actual grants.
This development-stage contract replaces the former boolean permission configuration;
unsupported stored authorization is not converted or upgraded. Reconfigure MCP permissions
and request Android authorization again. Application business data is unchanged.

`get_capabilities` returns schemas and currently authorized tools. The complete shared MCP
catalog is the source of truth, including inventory/roasting/conversion, equipment/recipes/SVG,
grinders/history, groups/rating dimensions, settings, icons, statistics and archives. Methods
use their existing tool names and arguments; platform-specific operations fail explicitly.
Catalog/read references require read access; actual secondary mutations (for example inventory
or grinder history changed by a note) are checked before the shared transaction commits.

## Queries and writes

- Paginated collections: `/v1/beans`, `/v1/notes`, `/v1/equipment`, `/v1/methods`, `/v1/grinders`.
- Other structured reads: `/v1/query/<read-tool-name>`.
- URI query parameters: `arguments` (JSON), `limit`, `offset`.
- Cursor includes `_id`, `id`, `version`, `record_json` and scalar fields. Cursor extras retain
  page metadata. Arbitrary SQL, selection and sort clauses are not accepted.
- Complex writes use `call`, not raw table CRUD. Success is `{ "ok": true, "result": ... }`;
  business failures are `{ "ok": false, "error": { "code": ..., "message": ... } }`.
  Invalid transport/security requests may throw Android exceptions. `request_access` returns
  its pending status directly. Observe the root URI for changes.
- Supply a stable `requestId` (8–128 characters) for each mutation and reuse it after an
  uncertain reply. Idempotency and business writes commit together; a reused ID with different
  arguments is rejected. Native upload request bindings commit in the same transaction.
- Use returned versions for edits/deletes and the catalog's preview methods before destructive
  operations. Confirmation credentials are bound to caller, target and version. A reset
  invalidates the engine's preview state. Process-local previews must be requested again after
  a process restart; committed idempotent results remain recoverable.

## Images

Use `insert(root + "/uploads", ContentValues)` with `domain` (`beans`, `notes`, `settings`)
and `mime_type` (`image/jpeg`, `image/png`, `image/webp`). Write bytes to the returned URI with
`openOutputStream(uri, "w")`, close it, then supply that URI in the relevant tool's image field.
Uploads are caller-bound, single-use streams, limited to 8 MiB and expire after one hour.
An already committed request can replay without its temporary upload bytes. Open streams have
bounded deadlines and are closed on revocation. There is no remote URL/arbitrary path import.

Image read tools return a controlled `contentUri`; read it using `openInputStream`.
Shared image policy, native decoding/EXIF orientation and WebP compression apply before image
persistence. File references and rollback cleanup use the same shared mutation logic as MCP.

## Lifecycle and maintenance

The build compiles the shared bundle to pinned Rhino 1.8.0 interpreter instructions; only
the fixed APK-signed asset is loaded (never caller-supplied serialized objects), with format
version and bundled-source SHA-256 checks. This avoids
background cold-start parsing without generating JVM bytecode.

Release builds keep Rhino's reflective bridge and serialized class/member names intact.
`assembleRelease` / `bundleRelease` verify the actual R8 mapping and removal report;
debug-only testing cannot detect this class of packaging failure.

Provider business execution is a packaged shared TypeScript engine running in Rhino, not a
WebView, Activity, browser or HTTP server. The native database coordinator is also used by the
foreground Capacitor application; it serializes complete mutations, migrations and resets.
Durable publications are consumed by the real foreground sync pipeline and refresh stores.
Ordinary process cold starts do not require opening a screen. Android's user force-stop state
is distinct and must not be treated as a supported way to wake a deliberately stopped app.
An old installation whose WebView-only legacy data has not migrated returns `MIGRATION_REQUIRED`:
open Brew Guide once to run its existing migration; the Provider never replaces that data.

Builds generate `android/app/src/main/assets/provider/business.js` and `business.bin` from the
shared source; do not edit or commit these generated artifacts. Shared transactions authorize their actual changes before
commit. Both desktop MCP and Android enforce the requested and actually affected domains;
tool metadata `read` / `write` / `delete` describes operations, not extra grant levels.

## Verification commands

The `provider-caller` and `provider-caller-other` apps and their signing configuration
are local-only tools, excluded from Git and the default build. Automated regression tests
remain in the repository. The ordinary build does not require those caller modules:

```sh
pnpm build:provider
pnpm test:provider
pnpm build && pnpm exec cap sync android
cd android
./gradlew :app:assembleDebug :app:assembleRelease :app:assembleDebugAndroidTest
```

Optional cross-app verification requires current caller modules and their includes in
`android/settings.local.gradle`, using the same `scopes` contract. Build/install their app
and instrumentation APKs alongside Brew Guide, then from the repository root:

```sh
ANDROID_SERIAL=emulator-5554 bash scripts/provider/run-android-integration.sh
```

The independent caller APKs use different generated test signing keys and public ContentResolver APIs, not internal business functions.
The test-only app instrumentation fixture grants those test packages; it is absent from the
production APK. The harness verifies cold process startup, permissions, rollback/retry,
versions, images, SVGs, cross-app tokens, revocation and actual foreground/sync visibility.
