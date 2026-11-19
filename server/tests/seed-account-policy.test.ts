import assert from "node:assert/strict";
import test from "node:test";
import { isSeedAccountBlockedFromLogin } from "../replit_integrations/auth/seed-account-policy";

test("seeded bot and fallback admin accounts cannot sign in", () => {
  assert.equal(isSeedAccountBlockedFromLogin("bot-user-16", "bot-16@accounts.vibra.invalid"), true);
  assert.equal(isSeedAccountBlockedFromLogin("admin-vibra-001", "admin@vibra.com"), true);
  assert.equal(isSeedAccountBlockedFromLogin("legacy-id", " ADMIN@VIBRA.COM "), true);
  assert.equal(isSeedAccountBlockedFromLogin("legacy-bot-id", "nome@vibra.app"), true);
});

test("ordinary user accounts remain eligible to sign in", () => {
  assert.equal(isSeedAccountBlockedFromLogin("user-123", "person@example.test"), false);
  assert.equal(isSeedAccountBlockedFromLogin("user-123", null), false);
});
