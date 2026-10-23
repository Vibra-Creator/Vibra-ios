import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  getAssetNameViolation,
  googleSiteVerificationMetaTag,
  playStoreAssetName,
  googleSiteVerificationAssetName,
  StreamingReferenceScanner,
} from "./ios-store-policy.mjs";

const publicDir = path.resolve("dist/public");
const iosWebDir = path.resolve("dist/ios-web");
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
    const nameViolation = getAssetNameViolation(relativePath);
    if (nameViolation) {
      violations.push(`${relativePath}: ${nameViolation}`);
      continue;
    }

    if (!textExtensions.has(path.extname(entry.name).toLowerCase())) continue;
    const scanner = new StreamingReferenceScanner();
    scanner.push(await readFile(entryPath));
    if (scanner.found) {
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

const iosIndexPath = path.join(iosWebDir, "index.html");
const iosIndex = await readFile(iosIndexPath, "utf8");
await writeFile(iosIndexPath, iosIndex.replace(googleSiteVerificationMetaTag, ""));

await scanDirectory(iosWebDir);

if (violations.length > 0) {
  await rm(iosWebDir, { recursive: true, force: true });
  console.error("iOS web bundle rejected; forbidden platform references remain:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`iOS-safe web bundle prepared at ${path.relative(process.cwd(), iosWebDir)}.`);
console.log("Google Play marketing assets remain in their original source location for Android use.");
console.log("Point the iOS wrapper/archive build at dist/ios-web; this script does not create or sign an IPA.");