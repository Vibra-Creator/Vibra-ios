import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clientSource = path.join(projectRoot, "client", "src");
const packageJson = JSON.parse(
  readFileSync(path.join(projectRoot, "package.json"), "utf8"),
);
const productionBuild = packageJson.scripts.build;
const clientGatePosition = productionBuild.indexOf("npm run check:client");
const bundlePosition = productionBuild.indexOf("script/build.ts");

assert(
  clientGatePosition >= 0 && bundlePosition > clientGatePosition,
  "The production build must run check:client before the bundler.",
);

const fixtureDirectory = mkdtempSync(
  path.join(clientSource, "__release-gate-fixture-"),
);
const fixturePath = path.join(fixtureDirectory, "fixture.tsx");

function runClientCheck(label, { shouldPass, diagnostic }) {
  const result = spawnSync(
    "npm",
    ["run", "check:client", "--", "--pretty", "false"],
    {
      cwd: projectRoot,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
      timeout: 120_000,
    },
  );
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;

  assert.equal(
    result.error,
    undefined,
    `${label}: could not run the client check: ${result.error?.message ?? ""}`,
  );
  if (shouldPass) {
    assert.equal(result.status, 0, `${label}: expected the client check to pass.\n${output}`);
  } else {
    assert.notEqual(result.status, 0, `${label}: expected the client check to fail.`);
    assert.equal(result.signal, null, `${label}: client check did not exit normally.`);
    assert(
      output.includes(`${path.relative(projectRoot, fixturePath)}(`),
      `${label}: expected an error in the temporary frontend fixture.\n${output}`,
    );
    assert(
      output.includes(diagnostic),
      `${label}: expected ${diagnostic} in the client check output.\n${output}`,
    );
  }
  console.log(`✓ ${label}`);
}

try {
  writeFileSync(
    fixturePath,
    'import MissingButton from "./missing-button";\nexport default MissingButton;\n',
  );
  runClientCheck("unresolved component imports are rejected (TS2307)", {
    shouldPass: false,
    diagnostic: "TS2307",
  });

  writeFileSync(
    fixturePath,
    "export default function Fixture() { return MissingButton; }\n",
  );
  runClientCheck("undefined UI identifiers are rejected (TS2304)", {
    shouldPass: false,
    diagnostic: "TS2304",
  });

  writeFileSync(
    fixturePath,
    "export default function Fixture(): null { return null; }\n",
  );
  runClientCheck("valid frontend fixtures pass", { shouldPass: true });
} finally {
  rmSync(fixtureDirectory, { recursive: true, force: true });
}

assert.equal(
  existsSync(fixtureDirectory),
  false,
  "Temporary frontend fixtures must be removed from client/src.",
);