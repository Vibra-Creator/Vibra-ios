import assert from "node:assert/strict";
import { test } from "node:test";
import { isAdminEmail } from "../admin-access.js";

test("admin email allowlist is case-insensitive and ignores surrounding whitespace", () => {
  assert.equal(isAdminEmail("famax61@gmail.com"), true);
  assert.equal(isAdminEmail("  Famax61@Gmail.com  "), true);
  assert.equal(isAdminEmail("someone@example.com"), false);
  assert.equal(isAdminEmail(null), false);
  assert.equal(isAdminEmail(""), false);
});
