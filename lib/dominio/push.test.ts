import { test } from "node:test";
import assert from "node:assert/strict";
import { endpointPushValido } from "./push.ts";

test("endpoints de Web Push permitidos", () => {
  assert.ok(endpointPushValido("https://fcm.googleapis.com/fcm/send/abc"));
  assert.ok(endpointPushValido("https://updates.push.services.mozilla.com/wpush/v2/abc"));
  assert.ok(endpointPushValido("https://web.push.apple.com/QH8"));
  assert.ok(endpointPushValido("https://wns2-db5p.notify.windows.com/w/?token=x"));
  assert.ok(!endpointPushValido("https://169.254.169.254/latest/meta-data"));
  assert.ok(!endpointPushValido("https://evil.com/fcm.googleapis.com"));
  assert.ok(!endpointPushValido("https://fcm.googleapis.com.evil.com/x"));
  assert.ok(!endpointPushValido("http://fcm.googleapis.com/x"));
  assert.ok(!endpointPushValido("https://fcm.googleapis.com:8443/x"));
  assert.ok(!endpointPushValido("no es una url"));
});
