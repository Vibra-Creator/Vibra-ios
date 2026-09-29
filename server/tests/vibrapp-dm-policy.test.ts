import assert from "node:assert/strict";
import test from "node:test";
import { getLegacyBotReplyState, shouldAutoReplyToDirectMessage } from "@shared/vibrapp-dm-policy";

test("does not auto-reply for a real account even if its legacy bot flag is true", () => {
  assert.equal(shouldAutoReplyToDirectMessage({ isBot: true, userId: "real-user-id" }), false);
});

test("hides a saved legacy bot reply and disables bot-style UI for a real account", () => {
  const realAccountWithLegacyBotFlag = { isBot: true, userId: "real-user-id" };
  const oldBotReply = { replied: true, replyContent: "Risposta bot salvata in passato" };

  // SwipeCard uses this eligibility check to decide whether it polls or simulates bot presence.
  assert.equal(shouldAutoReplyToDirectMessage(realAccountWithLegacyBotFlag), false);
  // The check endpoint must also keep historical bot data out of the response.
  assert.deepEqual(getLegacyBotReplyState(realAccountWithLegacyBotFlag, oldBotReply), {
    replied: false,
    replyContent: null,
  });
});

test("auto-replies only for bot profiles without a real account", () => {
  assert.equal(shouldAutoReplyToDirectMessage({ isBot: true, userId: null }), true);
  assert.equal(shouldAutoReplyToDirectMessage({ isBot: false, userId: null }), false);
  assert.equal(shouldAutoReplyToDirectMessage(undefined), false);
});

test("keeps saved replies available for eligible bot profiles", () => {
  assert.deepEqual(
    getLegacyBotReplyState({ isBot: true, userId: null }, { replied: true, replyContent: "Ciao!" }),
    { replied: true, replyContent: "Ciao!" },
  );
});
