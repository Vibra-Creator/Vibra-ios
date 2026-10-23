import { access, lstat, rm } from "node:fs/promises";
import path from "node:path";

// This is a publishing-only step, never part of the regular workspace build.
// Replit packages the build filesystem, including caches/history that the app
// does not need. Remove those copies only inside the isolated publishing build.
if (process.env.REPLIT_DEPLOYMENT !== "1") {
  throw new Error("Publish cleanup refused: this is not a Replit publishing environment.");
}

const root = process.cwd();
for (const required of ["dist/index.cjs", "dist/public/index.html"]) {
  await access(path.join(root, required));
}

for (const directory of [".cache", ".git"]) {
  const target = path.join(root, directory);
  try {
    await lstat(target);
  } catch (error) {
    if (error.code === "ENOENT") continue;
    throw error;
  }
  await rm(target, { recursive: true, force: true });
  console.log(`[publish] Removed build-only copy of ${directory}`);
}

console.log("[publish] Runtime files and application assets preserved.");
