import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { seedDatabase } from "./seed";
import { startAutoBackup } from "./backup";
import { db } from "./db";
import { sql } from "drizzle-orm";

const app = express();

async function runBotMatchJob() {
  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    // Find real users who liked bots but have no bot match today and have at least one pending unmatched bot like
    const rows = await db.execute(sql`
      SELECT DISTINCT sw.swiper_id AS real_id
      FROM swipes sw
      JOIN profiles bot ON bot.id = sw.swiped_id AND bot.is_bot = true
      WHERE sw.liked = true
        AND NOT EXISTS (
          SELECT 1 FROM matches m
          WHERE (m.profile1_id = sw.swiper_id AND m.profile2_id = sw.swiped_id)
             OR (m.profile1_id = sw.swiped_id AND m.profile2_id = sw.swiper_id)
        )
        AND NOT EXISTS (
          SELECT 1 FROM bot_daily_match bdm
          WHERE bdm.real_profile_id = sw.swiper_id AND bdm.match_date = ${todayStr}
        )
        AND EXISTS (
          SELECT 1 FROM profiles rp WHERE rp.id = sw.swiper_id AND rp.is_bot = false
        )
    `);

    let matched = 0;
    for (const row of (rows.rows ?? [])) {
      const realId = (row as any).real_id as string;
      // Pick a random unmatched liked bot for this user
      const botRows = await db.execute(sql`
        SELECT sw.swiped_id AS bot_id
        FROM swipes sw
        WHERE sw.swiper_id = ${realId} AND sw.liked = true
          AND NOT EXISTS (
            SELECT 1 FROM matches m
            WHERE (m.profile1_id = ${realId} AND m.profile2_id = sw.swiped_id)
               OR (m.profile1_id = sw.swiped_id AND m.profile2_id = ${realId})
          )
          AND EXISTS (SELECT 1 FROM profiles WHERE id = sw.swiped_id AND is_bot = true)
        ORDER BY RANDOM()
        LIMIT 1
      `);
      const botRow = botRows.rows?.[0] as any;
      if (!botRow) continue;
      const botId = botRow.bot_id as string;
      await db.execute(sql`
        INSERT INTO matches (id, profile1_id, profile2_id, created_at)
        VALUES (gen_random_uuid(), ${realId}, ${botId}, now())
        ON CONFLICT DO NOTHING
      `);
      await db.execute(sql`
        INSERT INTO bot_daily_match (real_profile_id, bot_profile_id, match_date)
        VALUES (${realId}, ${botId}, ${todayStr})
        ON CONFLICT (real_profile_id, match_date) DO NOTHING
      `);
      matched++;
    }
    if (matched > 0) console.log(`[bot-match-job] Created ${matched} bot match(es) for today`);
  } catch (err) {
    console.error("[bot-match-job] Error:", err);
  }
}

function startBotMatchJob() {
  // Run once at startup (after a short delay) then every 24h
  setTimeout(() => {
    runBotMatchJob();
    setInterval(runBotMatchJob, 24 * 60 * 60 * 1000);
  }, 10000);
  console.log("[bot-match-job] Scheduled daily bot match job");
}
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

(async () => {
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

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
      startAutoBackup();
      startBotMatchJob();

      // Run seed in background — non-blocking so server starts instantly
      seedDatabase().catch((err) => console.error("[seed] background error:", err));
    },
  );
})();
