import assert from "node:assert/strict";
import test from "node:test";
import { filterOffensiveContent, filterUgcTextPayload } from "./ugc-moderation";

test("masks known prohibited words in submitted text", () => {
  assert.equal(filterOffensiveContent("What the fuck?"), "What the ****?");
});

test("masks administrator-managed terms and supports phrases safely", () => {
  assert.equal(filterOffensiveContent("not allowed here", ["not allowed"]), "*** ******* here");
  assert.equal(filterOffensiveContent("bad.word is blocked", ["bad.word"]), "******** is blocked");
});

test("filters nested user text without changing unrelated fields", () => {
  const filtered = filterUgcTextPayload({
    content: "fuck this",
    profile: { bio: "A shit sample", age: 22 },
    password: "fuck-is-part-of-this-password",
  });

  assert.deepEqual(filtered, {
    content: "**** this",
    profile: { bio: "A **** sample", age: 22 },
    password: "fuck-is-part-of-this-password",
  });
});