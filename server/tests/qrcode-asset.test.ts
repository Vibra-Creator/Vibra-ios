import assert from "node:assert/strict";
import { existsSync, statSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const projectRoot = process.cwd();
const qrPath = "client/public/images/vibra_qrcode_official.jpeg";

test("QR download uses a versioned runtime asset, not attached_assets", () => {
  const routes = readFileSync(resolve(projectRoot, "server/routes.ts"), "utf8");

  assert.ok(existsSync(resolve(projectRoot, qrPath)), "Versioned QR asset must exist");
  assert.ok(statSync(resolve(projectRoot, qrPath)).size > 0);
  assert.match(routes, /client", "public", "images", "vibra_qrcode_official\.jpeg"/);
  assert.doesNotMatch(routes, /attached_assets.*vibra_qrcode_official\.jpeg/);
});
