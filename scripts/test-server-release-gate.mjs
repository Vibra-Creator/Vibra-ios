import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverSource = path.join(projectRoot, "server");
const packageJson = JSON.parse(
  readFileSync(path.join(projectRoot, "package.json"), "utf8"),
);
const productionBuild = packageJson.scripts.build;
const serverGatePosition = productionBuild.indexOf("npm run check:server");
const bundlerPosition = productionBuild.indexOf("script/build.ts");

assert(
  serverGatePosition >= 0 && bundlerPosition > serverGatePosition,
  "The production build must run check:server before the bundler.",
);

const temporaryRoot = mkdtempSync(
  path.join(os.tmpdir(), "server-release-gate-"),
);
const fixtureName = "__server_release_gate_fixture__.ts";
const fixturePath = path.join(temporaryRoot, "server", fixtureName);
const missingSymbol = "__missingServerReleaseGateSymbol";

function runProductionBuild() {
  return spawnSync("npm", ["run", "build"], {
    cwd: temporaryRoot,
    encoding: "utf8",
    env: { ...process.env, CI: "true" },
    maxBuffer: 10 * 1024 * 1024,
    timeout: 120_000,
  });
}

try {
  for (const file of [
    "package.json",
    "tsconfig.json",
    "tsconfig.client.json",
    "tsconfig.server.json",
    "vite.config.ts",
    "tailwind.config.ts",
    "postcss.config.js",
  ]) {
    copyFileSync(path.join(projectRoot, file), path.join(temporaryRoot, file));
  }

  cpSync(serverSource, path.join(temporaryRoot, "server"), { recursive: true });
  cpSync(path.join(projectRoot, "script"), path.join(temporaryRoot, "script"), {
    recursive: true,
  });

  for (const directory of [
    "attached_assets",
    "client",
    "node_modules",
    "public",
    "shared",
  ]) {
    symlinkSync(
      path.join(projectRoot, directory),
      path.join(temporaryRoot, directory),
      "dir",
    );
  }

  writeFileSync(
    fixturePath,
    `export const releaseGateProbe = ${missingSymbol};\n`,
  );

  const result = runProductionBuild();
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;

  assert.equal(
    result.error,
    undefined,
    `Could not run the production build: ${result.error?.message ?? ""}`,
  );
  assert.notEqual(
    result.status,
    0,
    `The production build accepted an undefined server symbol.\n${output}`,
  );
  assert.equal(result.signal, null, "The production build must fail normally.");
  assert(
    output.includes(`server/${fixtureName}`),
    `Expected the diagnostic to identify the temporary server fixture.\n${output}`,
  );
  assert(
    output.includes("TS2304") && output.includes(missingSymbol),
    `Expected an undefined-symbol diagnostic (TS2304).\n${output}`,
  );
  assert(
    !output.includes("building client..."),
    `The production build reached the bundler before rejecting the server fixture.\n${output}`,
  );
  assert.equal(
    existsSync(path.join(temporaryRoot, "dist")),
    false,
    "A rejected server fixture must not create production build output.",
  );

  console.log("✓ production builds reject undefined server symbols before bundling");
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

assert.equal(
  existsSync(temporaryRoot),
  false,
  "The isolated project copy and invalid server fixture must be removed.",
);
