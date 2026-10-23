import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // The publishing build skips copying client/public into dist/public to keep
  // the published image under the size limit, so static assets are served from
  // the original folder as well. dist/public is checked first.
  const sourcePublicPath = path.resolve(process.cwd(), "client", "public");
  const assetRoots = [distPath, sourcePublicPath].filter((dir) => fs.existsSync(dir));
  const resolveAsset = (relative: string) =>
    assetRoots
      .map((root) => path.resolve(root, relative))
      .find((file) => fs.existsSync(file));

  app.get("/.well-known/assetlinks.json", (_req, res) => {
    const filePath = resolveAsset(".well-known/assetlinks.json");
    if (!filePath) return res.status(404).send("Not found");
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.sendFile(filePath);
  });

  app.get("/upload_certificate.pem", (_req, res) => {
    res.status(404).send("Not found");
  });

  app.get("/manifest.json", (_req, res) => {
    const filePath = resolveAsset("manifest.json");
    if (!filePath) return res.status(404).send("Not found");
    res.setHeader("Content-Type", "application/manifest+json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(filePath);
  });

  for (const root of assetRoots) {
    app.use("/icons", (_req, res, next) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "public, max-age=86400");
      next();
    }, express.static(path.join(root, "icons")));

    // Cache images for 1 year (immutable, long-lived static assets)
    app.use("/images", (_req, res, next) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      next();
    }, express.static(path.join(root, "images")));
  }

  for (const root of assetRoots) {
    app.use(express.static(root, { dotfiles: "allow" }));
  }

  app.use("/{*path}", (_req, res) => {
    res.setHeader("X-Robots-Tag", "index, follow");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
