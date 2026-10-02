import { createReadStream } from "node:fs";
import { lstat, readdir, realpath, readlink } from "node:fs/promises";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import {
  getAssetNameViolation,
  StreamingReferenceScanner,
} from "./ios-store-policy.mjs";

const inputPath = process.argv[2];
if (!inputPath || process.argv.length !== 3) {
  console.error("Usage: npm run check:ios-artifact -- <app.ipa|app.xcarchive>");
  process.exit(2);
}

const artifactPath = path.resolve(inputPath);
const artifactExtension = path.extname(artifactPath).toLowerCase();
const violations = [];
let scannedFiles = 0;

function validateArchivePath(entryName) {
  if (
    !entryName ||
    entryName.startsWith("/") ||
    entryName.startsWith("-") ||
    /[\0\r\n]/.test(entryName) ||
    entryName.includes("\\") ||
    entryName.split("/").some((part) => part === "..")
  ) {
    throw new Error(`Unsafe or unsupported path in IPA: ${JSON.stringify(entryName)}`);
  }
}

function recordAssetNameViolation(relativePath) {
  const reason = getAssetNameViolation(relativePath);
  if (reason) violations.push(`${relativePath}: ${reason}`);
}

async function scanFile(filePath, relativePath) {
  recordAssetNameViolation(relativePath);
  const scanner = new StreamingReferenceScanner();
  for await (const chunk of createReadStream(filePath)) {
    scanner.push(chunk);
    if (scanner.found) break;
  }
  scannedFiles += 1;
  if (scanner.found) {
    violations.push(`${relativePath}: Google Play reference in artifact content`);
  }
}

async function scanXcarchive(rootPath) {
  const rootRealPath = await realpath(rootPath);
  const visited = new Set();
  let hasAppBundle = false;

  async function visit(entryPath, displayPath = entryPath) {
    const relativePath = path.relative(rootPath, displayPath).split(path.sep).join("/");
    recordAssetNameViolation(relativePath);

    const entryStat = await lstat(entryPath);
    if (entryStat.isSymbolicLink()) {
      const linkTarget = await readlink(entryPath);
      const linkScanner = new StreamingReferenceScanner();
      linkScanner.push(Buffer.from(linkTarget));
      if (linkScanner.found) {
        violations.push(`${relativePath}: Google Play reference in symbolic-link target`);
      }

      const resolvedPath = await realpath(entryPath);
      if (
        resolvedPath !== rootRealPath &&
        !resolvedPath.startsWith(`${rootRealPath}${path.sep}`)
      ) {
        violations.push(`${relativePath}: symbolic link points outside the xcarchive`);
        return;
      }
      await visit(resolvedPath, displayPath);
      return;
    }

    const resolvedPath = await realpath(entryPath);
    if (visited.has(resolvedPath)) return;
    visited.add(resolvedPath);

    if (entryStat.isDirectory()) {
      const archiveRelativePath = path.relative(rootPath, displayPath).split(path.sep).join("/");
      if (/^Products\/Applications\/[^/]+\.app(?:\/|$)/i.test(archiveRelativePath)) {
        hasAppBundle = true;
      }
      for (const entry of await readdir(entryPath, { withFileTypes: true })) {
        await visit(path.join(entryPath, entry.name));
      }
      return;
    }

    if (entryStat.isFile()) await scanFile(entryPath, relativePath);
  }

  await visit(rootPath);
  if (!hasAppBundle) {
    throw new Error("The xcarchive does not contain Products/Applications/<app>.app.");
  }
}

function listIpaEntries(ipaPath) {
  const result = spawnSync("unzip", ["-Z1", ipaPath], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) {
    throw new Error(`Could not list IPA contents with unzip: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`Could not list IPA contents: ${(result.stderr || "").trim()}`);
  }
  return result.stdout.split(/\r?\n/).filter(Boolean);
}

function scanIpaEntry(ipaPath, entryName) {
  return new Promise((resolve, reject) => {
    const scanner = new StreamingReferenceScanner();
    const child = spawn("unzip", ["-p", ipaPath, entryName], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stdout.on("data", (chunk) => scanner.push(chunk));
    child.stderr.on("data", (chunk) => {
      if (stderr.length < 4096) stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      reject(new Error(`Could not read IPA entry ${entryName}: ${error.message}`));
    });
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Could not read IPA entry ${entryName}: ${stderr.trim()}`));
        return;
      }
      scannedFiles += 1;
      if (scanner.found) {
        violations.push(`${entryName}: Google Play reference in artifact content`);
      }
      resolve();
    });
  });
}

async function scanIpa(ipaPath) {
  const entries = listIpaEntries(ipaPath);
  let hasAppBundle = false;

  for (const entryName of entries) {
    validateArchivePath(entryName);
    recordAssetNameViolation(entryName);
    if (/^Payload\/[^/]+\.app(?:\/|$)/i.test(entryName)) hasAppBundle = true;
    if (entryName.endsWith("/")) continue;
    await scanIpaEntry(ipaPath, entryName);
  }

  if (!hasAppBundle) {
    throw new Error("The IPA does not contain Payload/<app>.app.");
  }
}

try {
  if (artifactExtension === ".ipa") {
    const artifactStat = await lstat(artifactPath);
    if (!artifactStat.isFile()) throw new Error("The .ipa path must be a file.");
    await scanIpa(artifactPath);
  } else if (artifactExtension === ".xcarchive") {
    const artifactStat = await lstat(artifactPath);
    if (!artifactStat.isDirectory()) throw new Error("The .xcarchive path must be a directory.");
    await scanXcarchive(artifactPath);
  } else {
    throw new Error("Expected an .ipa file or an .xcarchive directory.");
  }
} catch (error) {
  console.error(`iOS artifact check failed: ${error.message}`);
  process.exit(1);
}

if (violations.length > 0) {
  console.error("iOS artifact rejected; Google Play references or platform-specific assets remain:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

if (scannedFiles === 0) {
  console.error("iOS artifact check failed: no app files were inspected.");
  process.exit(1);
}

console.log(`iOS artifact passed Google Play checks (${scannedFiles} files scanned).`);