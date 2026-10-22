#!/usr/bin/env bash
# Run only on a disposable emulator/test installation. No production grants or records are used.
set -euo pipefail
ADB=${ADB:-adb}
SERIAL=${ANDROID_SERIAL:?Set ANDROID_SERIAL to the authorized test emulator/device}
ADB_ARGS=(-s "$SERIAL")
CALLER_RUNNER=com.brewguide.providercaller.test/androidx.test.runner.AndroidJUnitRunner
APP_RUNNER=com.brewguide.app.test/androidx.test.runner.AndroidJUnitRunner
CLASS=com.brewguide.providercaller.ProviderIntegrationTest
FULL='{"brewing":{"read":true,"write":true,"delete":true},"beans":{"read":true,"write":true,"delete":true},"notes":{"read":true,"write":true,"delete":true},"settings":{"read":true,"write":true,"delete":true}}'
SETTINGS_READ='{"brewing":{"read":true,"write":true,"delete":true},"beans":{"read":true,"write":true,"delete":true},"notes":{"read":true,"write":true,"delete":true},"settings":{"read":true,"write":false,"delete":false}}'
READ='{"beans":{"read":true,"write":false,"delete":false}}'
run_test() {
  local output
  output=$("$ADB" "${ADB_ARGS[@]}" shell am instrument -w -r -e class "$CLASS#$1" "$CALLER_RUNNER")
  RUN_OUTPUT=$output
  printf '%s\n' "$output"
  grep -q 'OK (1 test)' <<< "$output"
  ! grep -q 'FAILURES\|INSTRUMENTATION_FAILED\|Process crashed' <<< "$output"
}
fixture() {
  local action=$1 scopes=${2:-'{}'} caller=${3:-com.brewguide.providercaller} output
  # JSON quoting is preserved across adb's shell command parsing.
  output=$("$ADB" "${ADB_ARGS[@]}" shell "am instrument -w -r -e class com.brewguide.app.provider.ProviderAuthorizationFixture -e fixtureAction '$action' -e callerPackage '$caller' -e scopes '$scopes' '$APP_RUNNER'")
  printf '%s\n' "$output"
  grep -q 'OK (1 test)' <<< "$output"
}
cold_kill() {
  "$ADB" "${ADB_ARGS[@]}" shell am kill com.brewguide.app
  local pid
  for attempt in $(seq 1 40); do
    pid=$("$ADB" "${ADB_ARGS[@]}" shell pidof com.brewguide.app || true)
    [[ -z "$pid" ]] && break
    sleep 0.25
  done
  if [[ -n "$pid" ]]; then echo "Provider process still alive ($pid); cold-start evidence invalid" >&2; exit 1; fi
  echo 'Cold-start precondition verified: provider process absent, no Activity launch.'
}
run_test unauthorizedAndSpoofedIdentityAreDenied
fixture grant "$READ"
run_test readOnlyAndCrossScopeRestrictionsAreEnforced
fixture grant "$FULL"
cold_kill
run_test allFourScopesAreQueryableWithoutActivity
"$ADB" "${ADB_ARGS[@]}" shell pidof com.brewguide.app
run_test prepareGrinderPermissionFixture
fixture grant "$SETTINGS_READ"
run_test readonlySettingsRejectsGrinderSideEffectsAtomically
fixture grant "$FULL"
run_test sameRequestsSucceedAfterSettingsWriteGrant
run_test noteInventoryRetryVersionAndFailureClosure
run_test concurrentUpdatesPermitOnlyOneVersion
run_test customEquipmentSvgAndMethodRoundTrip
run_test cancellationBeforeQueryDoesNotExecute
run_test beanNotePhotosAndRoasterLogoStreams
run_test prepareDurableRetryAcrossProviderRestart
cold_kill
run_test replayAfterProviderRestart
run_test prepareForegroundFixture
FIXTURE_BEAN=$(sed -n 's/^INSTRUMENTATION_STATUS: fixtureBeanId=//p' <<< "$RUN_OUTPUT" | tr -d '\r')
FIXTURE_NOTE=$(sed -n 's/^INSTRUMENTATION_STATUS: fixtureNoteId=//p' <<< "$RUN_OUTPUT" | tr -d '\r')
[[ -n "$FIXTURE_BEAN" && -n "$FIXTURE_NOTE" ]]
UI_OUTPUT=$("$ADB" "${ADB_ARGS[@]}" shell am instrument -w -r -e class com.brewguide.app.provider.ProviderForegroundTest#providerWritesReachActualAppAndSyncQueue -e fixtureBeanId "$FIXTURE_BEAN" -e fixtureNoteId "$FIXTURE_NOTE" "$APP_RUNNER")
printf '%s\n' "$UI_OUTPUT"
grep -q 'OK (1 test)' <<< "$UI_OUTPUT"
run_test cleanupForegroundFixture
# Distinct test signing keys, installed packages and UIDs, independent grants.
CALLER_RUNNER=com.brewguide.providercaller.other.test/androidx.test.runner.AndroidJUnitRunner run_test unauthorizedAndSpoofedIdentityAreDenied
fixture grant "$FULL" com.brewguide.providercaller.other
run_test prepareCallerBoundPreview
FOREIGN_PREVIEW=$(sed -n 's/^INSTRUMENTATION_STATUS: foreignPreview=//p' <<< "$RUN_OUTPUT" | tr -d '\r')
[[ -n "$FOREIGN_PREVIEW" ]]
OTHER_OUTPUT=$("$ADB" "${ADB_ARGS[@]}" shell "am instrument -w -r -e class '$CLASS#otherApplicationCannotReusePreviewToken' -e foreignPreview '$FOREIGN_PREVIEW' com.brewguide.providercaller.other.test/androidx.test.runner.AndroidJUnitRunner")
printf '%s\n' "$OTHER_OUTPUT"
grep -q 'OK (1 test)' <<< "$OTHER_OUTPUT"
run_test cleanupCallerBoundPreview
fixture revoke '{}' com.brewguide.providercaller.other
run_test prepareImageUriForRevocation
fixture revoke
run_test revokedCallerCannotReadOrWrite
run_test temporaryUriGrantCannotBypassRevokedBusinessPermission
fixture grant "$FULL"
run_test cleanupImageUriRevocationFixture
fixture revoke
printf '\nExternal-UID ContentResolver acceptance suite passed.\n'
