import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile, access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cleanupScript = fileURLToPath(new URL("./prepare-publish.mjs", import.meta.url));
const fixture = await mkdtemp(path.join(os.tmpdir(), "vibra-publish-"));
const contents = {
  ".git/history": "history",
  ".cache/browser": "cache",
  "dist/index.cjs": "server",
  "dist/public/index.html": "client",
  "dist/public/videos/example.mp4": "video",
  "attached_assets/example.png": "attachment",
  "uploads/photo.png": "user upload",
};

function run(authorization, runtimeDeployment = "") {
  return spawnSync(process.execPath, [cleanupScript], {
    cwd: fixture,
    env: {
      ...process.env,
      VIBRA_PUBLISH_CLEANUP: authorization,
      REPLIT_DEPLOYMENT: runtimeDeployment,
    },
    encoding: "utf8",
  });
}

try {
  for (const [name, content] of Object.entries(contents)) {
    const file = path.join(fixture, name);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);
  }

  const workspace = run("");
  assert.notEqual(workspace.status, 0, "Workspace cleanup must be refused.");
  const runtimeOnly = run("", "1");
  assert.notEqual(runtimeOnly.status, 0, "The runtime flag must not authorize cleanup.");
  for (const [name, content] of Object.entries(contents)) {
    assert.equal(await readFile(path.join(fixture, name), "utf8"), content);
  }

  await rm(path.join(fixture, "dist/index.cjs"));
  const incompleteBuild = run("1");
  assert.notEqual(incompleteBuild.status, 0, "Cleanup requires a complete build.");
  await access(path.join(fixture, ".git/history"));
  await access(path.join(fixture, ".cache/browser"));
  await writeFile(path.join(fixture, "dist/index.cjs"), "server");

  const publish = run("1");
  assert.equal(publish.status, 0, publish.stderr);
  for (const directory of [".git", ".cache"]) {
    await assert.rejects(access(path.join(fixture, directory)), { code: "ENOENT" });
  }
  for (const [name, content] of Object.entries(contents)) {
    if (name.startsWith(".git/") || name.startsWith(".cache/")) continue;
    assert.equal(await readFile(path.join(fixture, name), "utf8"), content);
  }
  assert.equal(run("1").status, 0, "Cleanup must be safe to repeat.");
  console.log("✓ publishing cleanup is guarded, preserves assets, and is repeatable");
} finally {
  await rm(fixture, { recursive: true, force: true });
}
