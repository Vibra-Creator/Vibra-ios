import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../../client/index.html", import.meta.url), "utf8");
const manifest = JSON.parse(
  readFileSync(new URL("../../client/public/manifest.json", import.meta.url), "utf8"),
);
const landingSource = readFileSync(new URL("../../client/src/pages/landing.tsx", import.meta.url), "utf8");
const datingSource = readFileSync(new URL("../../client/src/pages/home.tsx", import.meta.url), "utf8");

function readMeta(attr: "name" | "property", key: string): string {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`<meta\\s+${attr}="${escapedKey}"\\s+content="([^"]+)"`));
  assert.ok(match, `Missing ${attr} metadata: ${key}`);
  return match[1];
}

test("app metadata describes Vibra as a hub and marks dating optional", () => {
  const description = "Vibra Hub riunisce community, social, marketplace, mobilità, casa e lavoro. Vibra Dating è una funzione facoltativa.";
  const socialDescription = "Community, social, marketplace, mobilità, casa e lavoro in un unico hub. Vibra Dating è facoltativo.";
  const jsonLd = html.match(/<script\s+type="application\/ld\+json">(.*?)<\/script>/s)?.[1];
  assert.ok(jsonLd, "Missing JSON-LD metadata");

  assert.equal(readMeta("name", "description"), description);
  assert.equal(readMeta("property", "og:description"), socialDescription);
  assert.equal(readMeta("name", "twitter:description"), socialDescription);
  assert.equal(JSON.parse(jsonLd).description, description);
  assert.equal(manifest.description, description);
  assert.ok(landingSource.includes(description));
  assert.ok(landingSource.includes(socialDescription));
  assert.match(datingSource, /Vibra Dating di Vibra Hub/);
  assert.doesNotMatch([html, JSON.stringify(manifest), landingSource, datingSource].join("\n"), /dating app|app di incontri/i);
});
