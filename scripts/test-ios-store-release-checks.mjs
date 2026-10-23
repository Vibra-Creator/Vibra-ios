import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(
  readFileSync(path.join(projectRoot, "package.json"), "utf8"),
);
assert.match(
  packageJson.scripts["build:ios-safe-web"],
  /npm run build && node scripts\/create-ios-safe-web-bundle\.mjs/,
  "The iOS-safe bundle command must run the production build and filtered-bundle creator.",
);

const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), "ios-store-checks-"));
const archiveChecker = path.join(projectRoot, "scripts/check-ios-store-artifact.mjs");
const metadataChecker = path.join(projectRoot, "scripts/check-ios-app-store-metadata.mjs");
const iosBundleGenerator = path.join(projectRoot, "scripts/create-ios-safe-web-bundle.mjs");

function runNode(scriptPath, args, cwd = projectRoot) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });
}

function createWebBundleFixture(name) {
  const root = path.join(temporaryRoot, name);
  const publicDir = path.join(root, "dist", "public");
  const playImagePath = path.join(publicDir, "images", "feature-graphic-playstore.png");
  const playBadgePath = path.join(publicDir, "images", "google-play-badge.png");
  mkdirSync(path.dirname(playImagePath), { recursive: true });
  writeFileSync(
    path.join(publicDir, "index.html"),
    '<html><head><meta name="google-site-verification" content="fixture"></head><body>Vibra</body></html>',
  );
  writeFileSync(playImagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]));
  writeFileSync(playBadgePath, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x01, 0x02]));
  return { root, publicDir, playImagePath, playBadgePath };
}

function assertPass(label, result) {
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  assert.equal(result.error, undefined, `${label}: ${result.error?.message ?? ""}`);
  assert.equal(result.status, 0, `${label}: expected success.\n${output}`);
  console.log(`✓ ${label}`);
}

function assertReject(label, result, expectedText) {
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  assert.equal(result.error, undefined, `${label}: ${result.error?.message ?? ""}`);
  assert.notEqual(result.status, 0, `${label}: expected rejection.`);
  assert(
    output.includes(expectedText),
    `${label}: expected "${expectedText}" in output.\n${output}`,
  );
  console.log(`✓ ${label}`);
}

function createIpaFixture(directory, relativePath, content) {
  const appPath = path.join(directory, "Payload", "Vibra.app");
  mkdirSync(path.dirname(path.join(directory, relativePath)), { recursive: true });
  writeFileSync(path.join(directory, relativePath), content);
  const ipaPath = path.join(temporaryRoot, `${path.basename(directory)}.ipa`);
  const result = spawnSync("zip", ["-q", "-r", ipaPath, "Payload"], {
    cwd: directory,
    encoding: "utf8",
  });
  assert.equal(
    result.error,
    undefined,
    `Could not create IPA fixture with zip: ${result.error?.message ?? ""}`,
  );
  assert.equal(result.status, 0, `Could not create IPA fixture: ${result.stderr ?? ""}`);
  assert(existsSync(appPath), "The IPA fixture must contain an app bundle.");
  return ipaPath;
}

try {
  const safeBundle = createWebBundleFixture("safe-web-bundle");
  const originalAndroidIndex = readFileSync(path.join(safeBundle.publicDir, "index.html"));
  const originalPlayImage = readFileSync(safeBundle.playImagePath);
  const originalPlayBadge = readFileSync(safeBundle.playBadgePath);
  assertPass(
    "iOS web bundle excludes Play marketing assets",
    runNode(iosBundleGenerator, [], safeBundle.root),
  );
  const iosWebDir = path.join(safeBundle.root, "dist", "ios-web");
  assert.equal(
    existsSync(path.join(iosWebDir, "images", "feature-graphic-playstore.png")),
    false,
    "Play Store feature graphics must not be copied into the iOS bundle.",
  );
  assert.equal(
    existsSync(path.join(iosWebDir, "images", "google-play-badge.png")),
    false,
    "Google Play badges must not be copied into the iOS bundle.",
  );
  assert.deepEqual(
    readFileSync(path.join(safeBundle.publicDir, "index.html")),
    originalAndroidIndex,
    "The Android source HTML must remain unchanged.",
  );
  assert.deepEqual(
    readFileSync(safeBundle.playImagePath),
    originalPlayImage,
    "The Android Play Store feature graphic must remain unchanged.",
  );
  assert.deepEqual(
    readFileSync(safeBundle.playBadgePath),
    originalPlayBadge,
    "The Android Google Play badge must remain unchanged.",
  );
  assert.equal(
    readFileSync(path.join(iosWebDir, "index.html"), "utf8").includes("google-site-verification"),
    false,
    "Google verification metadata must be removed from the iOS copy.",
  );
  console.log("✓ Android source marketing assets remain unchanged");

  const unsafeBundle = createWebBundleFixture("unsafe-web-bundle");
  const unsafeCopy = Buffer.from("Install Vibra from Google Play");
  const androidMarketingText = path.join(unsafeBundle.publicDir, "marketing-copy.txt");
  writeFileSync(androidMarketingText, unsafeCopy);
  assertReject(
    "iOS web bundle generation rejects Google Play text references",
    runNode(iosBundleGenerator, [], unsafeBundle.root),
    "Google Play reference in text content",
  );
  assert.equal(
    existsSync(path.join(unsafeBundle.root, "dist", "ios-web")),
    false,
    "A rejected iOS bundle must be removed rather than left partially generated.",
  );
  assert.deepEqual(
    readFileSync(androidMarketingText),
    unsafeCopy,
    "Rejecting an iOS bundle must not alter Android marketing copy.",
  );
  assert.deepEqual(
    readFileSync(unsafeBundle.playImagePath),
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]),
    "Rejecting an iOS bundle must not alter Android marketing assets.",
  );
  console.log("✓ Android source assets remain unchanged after iOS bundle rejection");

  const utf16Bundle = createWebBundleFixture("utf16-web-bundle");
  const utf16MarketingText = Buffer.from("Available on Google Play", "utf16le");
  const utf16MarketingPath = path.join(utf16Bundle.publicDir, "marketing-copy.txt");
  writeFileSync(utf16MarketingPath, utf16MarketingText);
  assertReject(
    "iOS web bundle generation rejects Google Play text encoded as UTF-16",
    runNode(iosBundleGenerator, [], utf16Bundle.root),
    "Google Play reference in text content",
  );
  assert.equal(
    existsSync(path.join(utf16Bundle.root, "dist", "ios-web")),
    false,
    "A bundle containing UTF-16 Google Play text must not remain available for iOS.",
  );
  assert.deepEqual(
    readFileSync(utf16MarketingPath),
    utf16MarketingText,
    "The UTF-16 source marketing copy must remain unchanged.",
  );

  const xcarchive = path.join(temporaryRoot, "Vibra.xcarchive");
  const xcarchiveApp = path.join(
    xcarchive,
    "Products",
    "Applications",
    "Vibra.app",
  );
  mkdirSync(xcarchiveApp, { recursive: true });
  writeFileSync(path.join(xcarchiveApp, "Info.plist"), "<plist>Vibra</plist>");
  writeFileSync(path.join(xcarchiveApp, "main.js"), "const title = 'Welcome';");

  assertPass("clean xcarchive is accepted", runNode(archiveChecker, [xcarchive]));

  const ordinaryArtworkPath = path.join(xcarchiveApp, "Resources", "profile-art.png");
  mkdirSync(path.dirname(ordinaryArtworkPath), { recursive: true });
  const tinyPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lN8AAAAASUVORK5CYII=",
    "base64",
  );
  writeFileSync(ordinaryArtworkPath, tinyPng);
  const ordinaryArtworkResult = runNode(archiveChecker, [xcarchive]);
  assertPass("ordinary raster app artwork is not treated as Play branding", ordinaryArtworkResult);
  assert.match(
    `${ordinaryArtworkResult.stdout}${ordinaryArtworkResult.stderr}`,
    /Separate visual review required:[\s\S]*Products\/Applications\/Vibra\.app\/Resources\/profile-art\.png/,
    "Raster artwork with a generic filename must be listed for separate visual review.",
  );
  assert.doesNotMatch(
    `${ordinaryArtworkResult.stdout}${ordinaryArtworkResult.stderr}`,
    /Google Play reference in artifact content|Google Play-specific asset name/,
    "Ordinary app artwork must not be misreported as known Google Play branding.",
  );
  rmSync(ordinaryArtworkPath);

  writeFileSync(
    path.join(xcarchiveApp, "Assets.car"),
    Buffer.from("A platform badge: Google Play", "utf16le"),
  );
  assertReject(
    "Google Play text in UTF-16 archive content is rejected",
    runNode(archiveChecker, [xcarchive]),
    "Google Play reference",
  );
  rmSync(path.join(xcarchiveApp, "Assets.car"));

  const urlFilePath = path.join(xcarchiveApp, "embedded-settings.json");
  writeFileSync(
    urlFilePath,
    '{"storeUrl":"https://play.google.com/store/apps/details?id=example"}',
  );
  assertReject(
    "Google Play URLs in the final archive are rejected",
    runNode(archiveChecker, [xcarchive]),
    "Google Play reference",
  );
  rmSync(urlFilePath);

  const playAssetPath = path.join(xcarchiveApp, "Resources", "google-play-badge.png");
  mkdirSync(path.dirname(playAssetPath), { recursive: true });
  writeFileSync(playAssetPath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  assertReject(
    "Google Play-specific archive assets are rejected",
    runNode(archiveChecker, [xcarchive]),
    "Google Play-specific asset name",
  );
  rmSync(playAssetPath);

  const genericPlayArtworkPath = path.join(xcarchiveApp, "Resources", "badge.png");
  writeFileSync(genericPlayArtworkPath, tinyPng);
  const genericArtworkResult = runNode(archiveChecker, [xcarchive]);
  assertPass("generic-named raster artwork is surfaced for visual review", genericArtworkResult);
  assert.match(
    `${genericArtworkResult.stdout}${genericArtworkResult.stderr}`,
    /Separate visual review required:[\s\S]*Products\/Applications\/Vibra\.app\/Resources\/badge\.png/,
    "A generic-named raster asset must be identified even when its pixels contain no readable text.",
  );

  const safeIpa = createIpaFixture(
    path.join(temporaryRoot, "safe-ipa"),
    "Payload/Vibra.app/index.html",
    "<html><title>Vibra</title></html>",
  );
  assertPass("clean IPA is accepted", runNode(archiveChecker, [safeIpa]));

  const unsafeIpa = createIpaFixture(
    path.join(temporaryRoot, "unsafe-ipa"),
    "Payload/Vibra.app/Resources/play-store-badge.png",
    Buffer.from([0x89, 0x50, 0x4e, 0x47]),
  );
  assertReject(
    "Google Play-specific IPA assets are rejected",
    runNode(archiveChecker, [unsafeIpa]),
    "Google Play-specific asset name",
  );

  const genericArtworkIpa = createIpaFixture(
    path.join(temporaryRoot, "generic-artwork-ipa"),
    "Payload/Vibra.app/Resources/badge.png",
    tinyPng,
  );
  const genericArtworkIpaResult = runNode(archiveChecker, [genericArtworkIpa]);
  assertPass("generic-named raster IPA artwork is surfaced for visual review", genericArtworkIpaResult);
  assert.match(
    `${genericArtworkIpaResult.stdout}${genericArtworkIpaResult.stderr}`,
    /Separate visual review required:[\s\S]*Payload\/Vibra\.app\/Resources\/badge\.png/,
    "Generic-named raster artwork inside the IPA must be listed for separate visual review.",
  );

  const metadataFile = path.join(temporaryRoot, "app-store-metadata.txt");
  writeFileSync(metadataFile, "Vibra — connect with people nearby.");
  assertPass("clean App Store metadata is accepted", runNode(metadataChecker, [metadataFile]));

  writeFileSync(
    metadataFile,
    "Download at https://play.google.com/store/apps/details?id=example",
  );
  assertReject(
    "Google Play URLs in App Store metadata are rejected",
    runNode(metadataChecker, [metadataFile]),
    "Google Play reference",
  );
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

assert.equal(existsSync(temporaryRoot), false, "Temporary fixtures must be removed.");