import test from "node:test";
import assert from "node:assert/strict";
import {
  getLocationShareCutoff,
  isValidLocationCoordinates,
  LOCATION_SHARE_TTL_MS,
} from "../../shared/location-sharing";

test("location shares expire 15 minutes after their last update", () => {
  const now = new Date("2026-11-19T12:00:00.000Z");
  const cutoff = getLocationShareCutoff(now);

  assert.equal(now.getTime() - cutoff.getTime(), LOCATION_SHARE_TTL_MS);
  assert.equal(cutoff.toISOString(), "2026-11-19T11:45:00.000Z");
});

test("location coordinates are validated as finite latitude and longitude", () => {
  assert.equal(isValidLocationCoordinates(0, 0), true);
  assert.equal(isValidLocationCoordinates(-90, -180), true);
  assert.equal(isValidLocationCoordinates(90, 180), true);
  assert.equal(isValidLocationCoordinates(90.01, 0), false);
  assert.equal(isValidLocationCoordinates(0, -180.01), false);
  assert.equal(isValidLocationCoordinates(Number.NaN, 0), false);
  assert.equal(isValidLocationCoordinates(0, Number.POSITIVE_INFINITY), false);
  assert.equal(isValidLocationCoordinates("45", "9"), false);
});
