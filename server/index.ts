import express, { type Request, Response, NextFunction } from "express";
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

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

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
  await seedDatabase();
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
    },
  );
})();
