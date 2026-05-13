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

  app.get("/.well-known/assetlinks.json", (_req, res) => {
    const filePath = path.resolve(distPath, ".well-known/assetlinks.json");
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.sendFile(filePath);
  });

  app.get("/upload_certificate.pem", (_req, res) => {
    res.status(404).send("Not found");
  });

  app.get("/manifest.json", (_req, res) => {
    res.setHeader("Content-Type", "application/manifest+json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(path.resolve(distPath, "manifest.json"));
  });

  app.use("/icons", (_req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=86400");
    next();
  }, express.static(path.join(distPath, "icons")));

  app.use(express.static(distPath, { dotfiles: "allow" }));

  app.use("/{*path}", (_req, res) => {
    res.setHeader("X-Robots-Tag", "index, follow");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
