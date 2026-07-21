import assert from "node:assert/strict";
import test from "node:test";
import { ADMIN_SESSION_COOKIE, adminSessionTokenFromRequest, createAdminSessionToken, isValidAdminPassword, isValidAdminSessionToken, requireAdminSession } from "../lib/admin-session.ts";

test("admin password validation uses the server-side override", () => {
  process.env.SWVAOS_ADMIN_PASSWORD = "unit-test-password";
  assert.equal(isValidAdminPassword("unit-test-password"), true);
  assert.equal(isValidAdminPassword("wrong-password"), false);
  delete process.env.SWVAOS_ADMIN_PASSWORD;
});

test("admin session cookies are signed and required by protected routes", async () => {
  process.env.SWVAOS_SESSION_SECRET = "unit-test-session-secret";
  const token = createAdminSessionToken();
  assert.ok(token);
  assert.equal(isValidAdminSessionToken(token), true);
  assert.equal(isValidAdminSessionToken(`${token}0`), false);

  const authorizedRequest = new Request("https://example.test/api/data", { headers: { cookie: `${ADMIN_SESSION_COOKIE}=${token}` } });
  assert.equal(adminSessionTokenFromRequest(authorizedRequest), token);
  assert.equal(requireAdminSession(authorizedRequest), null);

  const unauthorized = requireAdminSession(new Request("https://example.test/api/data"));
  assert.equal(unauthorized?.status, 401);
  assert.deepEqual(await unauthorized?.json(), { error: "Your SWVAOS session is locked. Sign in again." });
  delete process.env.SWVAOS_SESSION_SECRET;
});
