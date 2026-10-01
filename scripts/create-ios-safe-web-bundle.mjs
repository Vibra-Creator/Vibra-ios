import { cp, mkdir, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";

const publicDir = path.resolve("dist/public");
const iosWebDir = path.resolve("dist/ios-web");
const playStoreAssetName = /(?:google[\s._-]*play|play[\s._-]*store)/i;
const googleSiteVerificationAssetName = /^google[a-f0-9]{16,}\.html$/i;
const forbiddenReference = /(?:google[\s._-]*play|play\.google\.com|play[\s._-]*store|google-site-verification)/i;
const textExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".map",
  ".mjs",
  ".svg",
  ".txt",
  ".webmanifest",
  ".xml",
]);
const violations = [];

async function scanDirectory(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await scanDirectory(entryPath);
      continue;
    }

    const relativePath = path.relative(iosWebDir, entryPath);
    if (playStoreAssetName.test(relativePath)) {
      violations.push(`${relativePath}: Play Store-specific asset name`);
      continue;
    }
    if (googleSiteVerificationAssetName.test(path.basename(relativePath))) {
      violations.push(`${relativePath}: non-user-facing Google site-verification asset`);
      continue;
    }

    if (!textExtensions.has(path.extname(entry.name).toLowerCase())) continue;
    const content = await readFile(entryPath, "utf8");
    if (forbiddenReference.test(content)) {
      violations.push(`${relativePath}: Google Play reference in text content`);
    }
  }
}

try {
  await readdir(publicDir);
} catch {
  console.error(`Missing ${publicDir}; run the project build before preparing the iOS web bundle.`);
  process.exit(1);
}

await rm(iosWebDir, { recursive: true, force: true });
await mkdir(iosWebDir, { recursive: true });
await cp(publicDir, iosWebDir, {
  recursive: true,
  filter: (sourcePath) => (
    !playStoreAssetName.test(path.basename(sourcePath)) &&
    !googleSiteVerificationAssetName.test(path.basename(sourcePath))
  ),
});

await scanDirectory(iosWebDir);

if (violations.length > 0) {
  await rm(iosWebDir, { recursive: true, force: true });
  console.error("iOS web bundle rejected; Google Play references remain:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`iOS-safe web bundle prepared at ${path.relative(process.cwd(), iosWebDir)}.`);
console.log("Google Play marketing assets remain in their original source location for Android use.");
console.log("Point the iOS wrapper/archive build at dist/ios-web; this script does not create or sign an IPA.");