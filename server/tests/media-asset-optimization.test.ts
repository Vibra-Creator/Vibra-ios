import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const projectRoot = process.cwd();
const fileSize = (path: string) => statSync(resolve(projectRoot, path)).size;
const source = (path: string) => readFileSync(resolve(projectRoot, path), "utf8");

const mediaPairs = [
  ["client/public/vibra-logo.png", "client/public/vibra-logo.webp"],
  ["client/public/backgrounds/vibra-personality.gif", "client/public/images/vibra-background-animated.webp"],
  ["client/public/videos/vibra-stanze.gif", "client/public/images/vibra-background-animated.webp"],
  ["client/public/backgrounds/vibra-partner-pref.gif", "client/public/backgrounds/vibra-partner-pref.webp"],
  ["client/public/backgrounds/vibra-lingue-bio.gif", "client/public/backgrounds/vibra-lingue-bio.webp"],
  ["client/public/backgrounds/vibra-cosa-cerchi.gif", "client/public/backgrounds/vibra-cosa-cerchi.mp4"],
  ["client/public/images/private-rooms-bg.gif", "client/public/images/private-rooms-bg.mp4"],
  ["client/public/images/onboarding-bg.gif", "client/public/images/onboarding-bg.webp"],
] as const;

test("optimized UI media has smaller copies while originals remain", () => {
  for (const [original, optimized] of mediaPairs) {
    assert.ok(existsSync(resolve(projectRoot, original)), `Original must remain: ${original}`);
    assert.ok(existsSync(resolve(projectRoot, optimized)), `Optimized copy missing: ${optimized}`);
    assert.ok(
      fileSize(optimized) < fileSize(original) * 0.35,
      `${optimized} should be at least 65% smaller than ${original}`,
    );
  }
});

test("UI pages use the optimized copies instead of large originals", () => {
  const profileEdit = source("client/src/pages/profile-edit.tsx");
  const rooms = source("client/src/pages/rooms.tsx");
  const onboarding = source("client/src/pages/onboarding.tsx");
  const privateRooms = source("client/src/pages/private-rooms.tsx");
  const privateRoomDetail = source("client/src/pages/private-room-detail.tsx");
  const splash = source("client/src/components/SplashScreen.tsx");
  const index = source("client/index.html");

  assert.match(profileEdit, /vibra-partner-pref\.webp/);
  assert.match(profileEdit, /vibra-background-animated\.webp/);
  assert.match(profileEdit, /vibra-cosa-cerchi\.mp4/);
  assert.match(profileEdit, /vibra-lingue-bio\.webp/);
  assert.doesNotMatch(profileEdit, /vibra-(partner-pref|personality|cosa-cerchi|lingue-bio)\.gif/);
  assert.match(rooms, /vibra-background-animated\.webp/);
  assert.doesNotMatch(rooms, /vibra-stanze\.gif/);
  assert.match(onboarding, /onboarding-bg\.webp/);
  assert.match(privateRooms, /private-rooms-bg\.mp4/);
  assert.match(privateRoomDetail, /private-rooms-bg\.mp4/);
  assert.match(splash, /src="\/vibra-logo\.webp"/);
  assert.match(index, /preload" href="\/vibra-logo\.webp"/);
  assert.match(index, /img src="\/vibra-logo\.webp"/);
});
