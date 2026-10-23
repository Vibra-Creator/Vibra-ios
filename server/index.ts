import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import { serveStatic } from "./static";
import { createServer } from "http";
import path from "path";

const app = express();

const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(compression());

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

app.post("/api/client-errors", (req, res) => {
  const sameSite = req.get("sec-fetch-site");
  if (sameSite && sameSite !== "same-origin") {
    return res.status(403).json({ message: "Forbidden" });
  }

  const text = (value: unknown, maxLength: number) =>
    typeof value === "string" ? value.slice(0, maxLength) : "";
  const message = text(req.body?.message, 1000);
  if (!message) {
    return res.status(400).json({ message: "Missing error message" });
  }

  console.error("[client-error]", JSON.stringify({
    scope: text(req.body?.scope, 120),
    name: text(req.body?.name, 120),
    message,
    path: text(req.body?.path, 500),
    userAgent: text(req.body?.userAgent, 500),
    stack: text(req.body?.stack, 6000),
    componentStack: text(req.body?.componentStack, 6000),
  }));
  return res.status(204).end();
});

// Redirect dal sottodominio Replit al dominio ufficiale
app.use((req, res, next) => {
  const host = req.hostname || "";
  if (host.endsWith(".replit.app")) {
    const target = `https://vibraalienmatch.com${req.originalUrl}`;
    return res.redirect(301, target);
  }
  next();
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

// ── Avvio rapido ────────────────────────────────────────────────────────────
// Il server inizia ad ascoltare subito, così il controllo di salute della
// pubblicazione riceve risposta mentre le migrazioni sono ancora in corso.
// Durante l'avvio la home riceve subito la pagina dell'app; tutte le altre
// richieste attendono che il server sia pronto (nessuna risposta inventata).
let markReady: () => void = () => {};
const ready = new Promise<void>((resolve) => {
  markReady = resolve;
});
let isReady = false;
app.use((req, res, next) => {
  if (isReady) return next();
  if (
    process.env.NODE_ENV === "production" &&
    (req.method === "GET" || req.method === "HEAD") &&
    req.path === "/"
  ) {
    res.setHeader("Cache-Control", "no-cache");
    return res.sendFile(path.resolve(__dirname, "public", "index.html"));
  }
  ready.then(() => next(), next);
});

const port = parseInt(process.env.PORT || "5000", 10);
httpServer.listen(
  {
    port,
    host: "0.0.0.0",
    reusePort: true,
  },
  () => {
    log(`listening on port ${port} (startup in progress)`);
  },
);

(async () => {
  // Caricati dopo listen(): il caricamento di questi moduli è lento e non
  // deve ritardare la prima risposta al controllo di salute.
  const { registerRoutes } = await import("./routes");
  const { startAutoBackup } = await import("./backup");
  const { db } = await import("./db");
  const { sql } = await import("drizzle-orm");
  const { storage } = await import("./storage");
  const { removeBotProfiles } = await import("./remove-bots");

  // ── Migrazioni DB startup ────────────────────────────────────────────────
  try {
    await db.execute(sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ghost_mode_expires_at TIMESTAMP`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_dna (
        profile_id VARCHAR PRIMARY KEY,
        behavior_vector TEXT NOT NULL DEFAULT '{}',
        last_updated TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS dna_events (
        id VARCHAR PRIMARY KEY,
        profile_id VARCHAR NOT NULL,
        event_type VARCHAR(32) NOT NULL,
        value DOUBLE PRECISION NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS dna_events_profile_idx ON dna_events(profile_id, created_at)`);
    console.log("[migration] VibraDNA + VibraGhost tables ready");

    // ── VibraStory ────────────────────────────────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS stories (
        id VARCHAR PRIMARY KEY,
        room_id VARCHAR,
        theme TEXT NOT NULL,
        description TEXT,
        status VARCHAR(16) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMP
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS story_briciole (
        id VARCHAR PRIMARY KEY,
        story_id VARCHAR NOT NULL,
        profile_id VARCHAR NOT NULL,
        content TEXT NOT NULL,
        media_url TEXT,
        chapter INTEGER NOT NULL DEFAULT 0,
        votes INTEGER NOT NULL DEFAULT 0,
        is_selected BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS story_votes (
        id VARCHAR PRIMARY KEY,
        briola_id VARCHAR NOT NULL,
        profile_id VARCHAR NOT NULL,
        vote_type VARCHAR(8) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(briola_id, profile_id)
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS story_briciole_story_idx ON story_briciole(story_id)`);

    // ── VibraVault ────────────────────────────────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS vault_confessions (
        id VARCHAR PRIMARY KEY,
        profile_id VARCHAR NOT NULL,
        content TEXT NOT NULL,
        media_url TEXT,
        expires_at TIMESTAMP NOT NULL,
        sentiment_legacy TEXT,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS vault_confessions_profile_idx ON vault_confessions(profile_id)`);
    console.log("[migration] VibraStory + VibraVault tables ready");

    // ── Blocco 3-5 ────────────────────────────────────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_quests (
        id VARCHAR PRIMARY KEY,
        profile_id VARCHAR NOT NULL,
        quest_type VARCHAR(32) NOT NULL,
        progress INTEGER NOT NULL DEFAULT 0,
        target INTEGER NOT NULL DEFAULT 1,
        completed BOOLEAN NOT NULL DEFAULT FALSE,
        claimed BOOLEAN NOT NULL DEFAULT FALSE,
        points_reward INTEGER NOT NULL DEFAULT 10,
        date VARCHAR(10) NOT NULL,
        completed_at TIMESTAMP,
        UNIQUE(profile_id, quest_type, date)
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS vibra_legacies (
        profile_id VARCHAR PRIMARY KEY,
        message TEXT NOT NULL,
        media_url TEXT,
        reveal_after_days INTEGER NOT NULL DEFAULT 30,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS consent_requests (
        id VARCHAR PRIMARY KEY,
        from_profile_id VARCHAR NOT NULL,
        to_profile_id VARCHAR NOT NULL,
        content_type VARCHAR(32) NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'pending',
        message TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        responded_at TIMESTAMP
      )
    `);
    await db.execute(sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mystery_mode_expires_at TIMESTAMP`);
    await db.execute(sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS eclipse_until TIMESTAMP`);
    await db.execute(sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS constellation VARCHAR(64)`);
    console.log("[migration] Blocco 3-5 tables ready");

    // ── Blocco 6 — VibraTime ────────────────────────────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_activity_log (
        id SERIAL PRIMARY KEY,
        profile_id VARCHAR NOT NULL,
        hour INTEGER NOT NULL,
        day_of_week INTEGER NOT NULL,
        count INTEGER NOT NULL DEFAULT 1,
        UNIQUE(profile_id, hour, day_of_week)
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS user_activity_log_profile_idx ON user_activity_log(profile_id)`);
    console.log("[migration] Blocco 6 (VibraTime) tables ready");

    // ── Blocco 7 — Pianeti ────────────────────────────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_room_orbits (
        id SERIAL PRIMARY KEY,
        profile_id VARCHAR NOT NULL,
        room_id VARCHAR NOT NULL,
        visit_count INTEGER NOT NULL DEFAULT 1,
        orbit_stability FLOAT NOT NULL DEFAULT 0.1,
        first_visit TIMESTAMP DEFAULT NOW(),
        last_visit TIMESTAMP DEFAULT NOW(),
        UNIQUE(profile_id, room_id)
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS user_room_orbits_profile_idx ON user_room_orbits(profile_id)`);
    console.log("[migration] Blocco 7 (Pianeti) tables ready");

    // ── Hub Posts (Marketplace · Casa · Lavoro · Mobilità) ────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS hub_posts (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        profile_id VARCHAR NOT NULL,
        profile_name TEXT NOT NULL,
        profile_image_url TEXT NOT NULL,
        category TEXT NOT NULL,
        subcategory TEXT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        price INTEGER,
        image_url TEXT,
        city TEXT,
        contact_info TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    await db.execute(sql`
      ALTER TABLE hub_posts
      ADD COLUMN IF NOT EXISTS image_urls TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]
    `);
    await db.execute(sql`
      UPDATE hub_posts
      SET image_urls = ARRAY[image_url]
      WHERE COALESCE(array_length(image_urls, 1), 0) = 0
        AND image_url IS NOT NULL
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS hub_posts_category_idx ON hub_posts(category)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS hub_posts_profile_idx ON hub_posts(profile_id)`);
    console.log("[migration] Hub Posts table ready");

    // ── Social links on profiles ───────────────────────────────────────────
    await db.execute(sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS instagram_handle TEXT`);
    await db.execute(sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tiktok_handle TEXT`);
    await db.execute(sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS facebook_url TEXT`);
    console.log("[migration] Social link columns ready");

    // ── Email verification columns ─────────────────────────────────────────
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token varchar`);
    // Mark all existing users (no pending token) as already verified
    await db.execute(sql`UPDATE users SET email_verified = true WHERE email_verified = false AND email_verification_token IS NULL`);
    console.log("[migration] Email verification columns ready");

    // ── Blog Posts (Giornale Comunitario) ─────────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS blog_posts (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        profile_id VARCHAR NOT NULL,
        profile_name TEXT NOT NULL,
        profile_image_url TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        image_url TEXT,
        category TEXT NOT NULL DEFAULT 'notizie',
        likes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
        likes_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS blog_posts_profile_idx ON blog_posts(profile_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS blog_posts_category_idx ON blog_posts(category)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS blog_posts_created_idx ON blog_posts(created_at DESC)`);
    console.log("[migration] Blog Posts table ready");

    // ── Events (Vibra Events) ──────────────────────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS events (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        profile_id VARCHAR NOT NULL,
        profile_name TEXT NOT NULL,
        profile_image_url TEXT NOT NULL,
        city TEXT NOT NULL,
        event_type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        venue TEXT,
        event_date TEXT NOT NULL,
        event_time TEXT,
        image_url TEXT,
        attendees TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
        going_count INTEGER NOT NULL DEFAULT 0,
        looking_for_company BOOLEAN NOT NULL DEFAULT false,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS events_city_idx ON events(city)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS events_profile_idx ON events(profile_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS events_date_idx ON events(event_date)`);
    console.log("[migration] Events table ready");

    // ── Profile Views ──────────────────────────────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS profile_views (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        viewer_id VARCHAR NOT NULL,
        viewed_id VARCHAR NOT NULL,
        viewed_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS profile_views_viewed_idx ON profile_views(viewed_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS profile_views_viewer_idx ON profile_views(viewer_id)`);
    console.log("[migration] Profile Views table ready");

    // Vibra Dating opzionale: i profili esistenti restano nel dating.
    await db.execute(sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dating_enabled boolean NOT NULL DEFAULT true`);
    await db.execute(sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dating_choice_pending boolean NOT NULL DEFAULT false`);
    console.log("[migration] Dating opt-in columns ready");
  } catch (err) {
    console.error("[migration] startup migration error:", err);
  }

  // ── VibraVault cleanup job (every hour) ────────────────────────────────────
  setInterval(async () => {
    try {
      await storage.cleanExpiredVaultConfessions();
    } catch {}
  }, 60 * 60 * 1000);

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  await removeBotProfiles();
  isReady = true;
  markReady();
  log(`serving on port ${port}`);
  startAutoBackup();
})().catch((err) => {
  console.error("[startup] fatal startup error:", err);
  process.exit(1);
});
