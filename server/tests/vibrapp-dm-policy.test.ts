import assert from "node:assert/strict";
import test from "node:test";
import { shouldAutoReplyToDirectMessage } from "../vibrapp-dm-policy";

test("does not auto-reply for a real account even if its legacy bot flag is true", () => {
  assert.equal(shouldAutoReplyToDirectMessage({ isBot: true, userId: "real-user-id" }), false);
});

test("auto-replies only for bot profiles without a real account", () => {
  assert.equal(shouldAutoReplyToDirectMessage({ isBot: true, userId: null }), true);
  assert.equal(shouldAutoReplyToDirectMessage({ isBot: false, userId: null }), false);
  assert.equal(shouldAutoReplyToDirectMessage(undefined), false);
});
