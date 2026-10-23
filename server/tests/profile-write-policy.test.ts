import test from "node:test";
import assert from "node:assert/strict";
import { validateProfileWrite } from "../profile-write-policy";

const existing = { age: 67, imageUrl: "/objects/uploads/real" };

test("unchanged profile data is accepted without rewriting it", () => {
  assert.equal(validateProfileWrite(existing, { age: 67, imageUrl: existing.imageUrl }, {}), null);
});
test("a stale client cannot overwrite a real age with 25", () => {
  assert.ok(validateProfileWrite(existing, { age: 25 }, {}));
  assert.ok(validateProfileWrite(existing, { age: 25 }, { expectedAge: 25 }));
});
test("explicit age edit is accepted against the loaded baseline", () => {
  assert.equal(validateProfileWrite(existing, { age: 68 }, { expectedAge: 67 }), null);
  assert.ok(validateProfileWrite(existing, { age: 0 }, { expectedAge: 67 }));
});
test("a saved photo cannot be replaced by a generic default", () => {
  assert.ok(validateProfileWrite(existing, { imageUrl: "/images/avatar-1.png" }, { expectedImageUrl: existing.imageUrl }));
  assert.ok(validateProfileWrite(existing, { imageUrl: "/images/profile-1.png" }, {}));
});
test("photo selection detects stale forms and gallery snapshots cannot overwrite uploads", () => {
  assert.ok(validateProfileWrite(existing, { imageUrl: "/objects/uploads/older" }, { expectedImageUrl: "/objects/uploads/older" }));
  assert.equal(validateProfileWrite(existing, { imageUrl: "/objects/uploads/new" }, { expectedImageUrl: existing.imageUrl }), null);
  assert.ok(validateProfileWrite(existing, { photos: [] }, {}));
});
