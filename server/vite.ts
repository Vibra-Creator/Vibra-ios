import { type Express } from "express";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { storage } from "./storage";
import {
  renderLandingVideoSeoHtml,
  renderPublicProfileSeoHtml,
} from "./public-profile-seo";

const viteLogger = createLogger();

export async function setupVite(server: Server, app: Express) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server, path: "/vite-hmr" },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.get("/manifest.json", (_req, res) => {
    res.setHeader("Content-Type", "application/manifest+json");
    const manifestPath = path.resolve(import.meta.dirname, "..", "client", "public", "manifest.json");
    res.sendFile(manifestPath);
  });

  app.use(vite.middlewares);

  app.use("/{*path}", async (req, res, next) => {
    const url = req.originalUrl;

    // Don't intercept API routes
    if (url.startsWith("/api")) {
      return next();
    }

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      let page = await vite.transformIndexHtml(url, template);
      const requestPath = url.split("?")[0]?.split("#")[0] || "/";
      const isAuthenticated = Boolean((req as any).user || (req as any).session?.userId);
      if ((requestPath === "/" || requestPath === "/landing") && !isAuthenticated) {
        page = renderLandingVideoSeoHtml(
          page,
          requestPath === "/landing" ? "/landing" : "/",
        );
      } else if (requestPath.startsWith("/p/")) {
        const profileId = decodeURIComponent(requestPath.slice("/p/".length));
        if (profileId && !profileId.includes("/")) {
          const profile = await storage.getProfile(profileId);
          if (profile) {
            page = renderPublicProfileSeoHtml(page, {
              id: profile.id,
              name: profile.name,
              age: profile.age,
              imageUrl: profile.imageUrl,
              location: profile.location,
              alienType: profile.alienType,
              profileVideoUrl: profile.profileVideoUrl,
            });
          }
        }
      }
      res.status(200).set({
        "Content-Type": "text/html",
        "X-Robots-Tag": "index, follow",
      }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}
