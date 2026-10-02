import assert from "node:assert/strict";
import test from "node:test";
import { sendVibrappDmPushIfBackground } from "../vibrapp-dm-push";

test("does not send a duplicate push when any Vibrapp tab is foregrounded", async () => {
  const sent: Array<{ profileId: string; url?: string }> = [];
  const sentPush = await sendVibrappDmPushIfBackground(
    "recipient-profile",
    { title: "Sender", body: "Ciao", url: "/vibrapp?dm=sender-profile", type: "vibrapp-dm" },
    (profileId) => profileId === "recipient-profile",
    (profileId, payload) => sent.push({ profileId, url: payload.url }),
  );

  assert.equal(sentPush, false);
  assert.deepEqual(sent, []);
});

test("sends a background DM push that points back to the sender's conversation", async () => {
  const sent: Array<{ profileId: string; title: string; url?: string; type?: string }> = [];
  const sentPush = await sendVibrappDmPushIfBackground(
    "recipient-profile",
    { title: "Sender", body: "Ciao", url: "/vibrapp?dm=sender-profile", type: "vibrapp-dm" },
    () => false,
    (profileId, payload) => sent.push({
      profileId,
      title: payload.title,
      url: payload.url,
      type: payload.type,
    }),
  );

  assert.equal(sentPush, true);
  assert.deepEqual(sent, [{
    profileId: "recipient-profile",
    title: "Sender",
    url: "/vibrapp?dm=sender-profile",
    type: "vibrapp-dm",
  }]);
});