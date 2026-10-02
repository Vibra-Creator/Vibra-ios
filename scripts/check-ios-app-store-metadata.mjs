import { createReadStream } from "node:fs";
import { lstat, readdir } from "node:fs/promises";
import path from "node:path";
import {
  getAssetNameViolation,
  StreamingReferenceScanner,
} from "./ios-store-policy.mjs";

const inputs = process.argv.slice(2);
if (inputs.length === 0) {
  console.error(
    "Usage: npm run check:ios-metadata -- <metadata-file-or-export-directory> [...]",
  );
  process.exit(2);
}

const files = [];
const violations = [];

async function collectFiles(inputPath) {
  const absolutePath = path.resolve(inputPath);
  const entryStat = await lstat(absolutePath);
  if (entryStat.isSymbolicLink()) {
    throw new Error(`Metadata input must not be a symbolic link: ${inputPath}`);
  }
  if (entryStat.isDirectory()) {
    for (const entry of await readdir(absolutePath, { withFileTypes: true })) {
      await collectFiles(path.join(absolutePath, entry.name));
    }
    return;
  }
  if (entryStat.isFile()) {
    files.push({ absolutePath, displayPath: inputPath });
  }
}

try {
  for (const input of inputs) await collectFiles(input);
  if (files.length === 0) throw new Error("No metadata files were found.");

  for (const file of files) {
    const nameViolation = getAssetNameViolation(file.displayPath);
    if (nameViolation) {
      violations.push(`${file.displayPath}: ${nameViolation}`);
    }

    const scanner = new StreamingReferenceScanner();
    for await (const chunk of createReadStream(file.absolutePath)) {
      scanner.push(chunk);
      if (scanner.found) break;
    }
    if (scanner.found) {
      violations.push(`${file.displayPath}: Google Play reference in App Store metadata`);
    }
  }
} catch (error) {
  console.error(`App Store metadata check failed: ${error.message}`);
  process.exit(1);
}

if (violations.length > 0) {
  console.error("App Store metadata rejected; Google Play references or assets remain:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`App Store metadata passed Google Play checks (${files.length} files scanned).`);